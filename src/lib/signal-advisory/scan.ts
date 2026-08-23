import { BinanceMarketDataProvider } from "../market-data/binance/provider.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle, MarketSnapshot } from "../market-data/types.ts";
import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "../config/constants.ts";
import { evaluateStrategy } from "../strategy/engine.ts";
import type { StrategyCandidate } from "../strategy/types.ts";
import { buildHourlyScanRunKey } from "../scanning/run-idempotency.ts";
import { sendSignalEmail } from "./email.ts";
import { buildDeterministicSignalId } from "./identity.ts";
import { createSignalAdvisoryStore } from "./store.ts";
import type {
  SignalAdvisory,
  SignalAdvisoryScanDependencies,
  SignalAdvisoryScanResult,
} from "./types.ts";

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function isoTimestamp(value: number): string | null {
  if (!Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  const timestamp = new Date(value).toISOString();
  return Number.isNaN(Date.parse(timestamp)) ? null : timestamp;
}

function datasetFor(snapshot: MarketSnapshot, symbol: ResearchSymbol) {
  const symbolSnapshot = snapshot.symbols[symbol];
  if (!symbolSnapshot || symbolSnapshot.status !== "VALID") {
    return null;
  }
  return symbolSnapshot.datasets["1h"];
}

function buildAdvisory(input: {
  snapshot: MarketSnapshot;
  candidate: StrategyCandidate;
  scanRunKey: string;
  recipient: string;
}): SignalAdvisory | null {
  const serverTime = input.snapshot.serverTime?.serverTime;
  const dataset = datasetFor(input.snapshot, input.candidate.symbol);
  const candle: Candle | undefined = dataset?.candles[dataset.candles.length - 1];

  if (!finite(serverTime) || !candle || candle.closeTime >= serverTime) {
    return null;
  }

  const signalTime = isoTimestamp(candle.closeTime);
  const signalValidUntil = isoTimestamp(candle.closeTime + INTERVAL_MS["1h"]);
  const sourceServerTime = isoTimestamp(serverTime);
  const ageMs = serverTime - candle.closeTime;

  if (
    !signalTime ||
    !signalValidUntil ||
    !sourceServerTime ||
    ageMs < 0 ||
    ageMs >= INTERVAL_MS["1h"] ||
    !finite(candle.close) ||
    candle.close <= 0 ||
    !finite(input.candidate.entryReference) ||
    !finite(input.candidate.stopReference) ||
    !finite(input.candidate.takeProfitReference) ||
    !finite(input.candidate.stopDistance) ||
    input.candidate.stopDistance <= 0 ||
    !finite(input.candidate.totalScore) ||
    !input.candidate.grade
  ) {
    return null;
  }

  const riskReward =
    Math.abs(input.candidate.takeProfitReference - input.candidate.entryReference) /
    input.candidate.stopDistance;
  if (!finite(riskReward) || riskReward <= 0) {
    return null;
  }

  const signalId = buildDeterministicSignalId({
    symbol: input.candidate.symbol,
    direction: input.candidate.direction,
    signalTime,
    strategyVersion: input.candidate.strategyVersion,
  });

  return Object.freeze({
    signalId,
    symbol: input.candidate.symbol,
    direction: input.candidate.direction,
    strategyId: "baseline-001",
    strategyVersion: input.candidate.strategyVersion,
    signalTime,
    signalValidUntil,
    currentReferencePrice: candle.close,
    suggestedEntryReference: input.candidate.entryReference,
    stopLoss: input.candidate.stopReference,
    takeProfit: input.candidate.takeProfitReference,
    riskReward,
    score: input.candidate.totalScore,
    grade: input.candidate.grade,
    marketRegime: {
      btcRegime: input.candidate.btcRegime,
      symbolRegime: input.candidate.symbolRegime,
    },
    dataFreshness: {
      status: "FRESH" as const,
      sourceServerTime,
      candleCloseTime: signalTime,
      ageMs,
    },
    recipient: input.recipient,
    scanRunKey: input.scanRunKey,
  });
}

function snapshotIsFresh(snapshot: MarketSnapshot): boolean {
  if (snapshot.status !== "VALID" || !snapshot.serverTime) {
    return false;
  }

  return RESEARCH_SYMBOLS.every((symbol) => {
    const dataset = datasetFor(snapshot, symbol);
    const candle = dataset?.candles[dataset.candles.length - 1];
    return Boolean(
      dataset &&
        candle &&
        candle.closeTime < snapshot.serverTime!.serverTime &&
        snapshot.serverTime!.serverTime - candle.closeTime < INTERVAL_MS["1h"],
    );
  });
}

function errorCode(error: unknown): string {
  return error instanceof Error && error.message.includes("SMTP")
    ? "SMTP_DELIVERY_FAILED"
    : "SIGNAL_ADVISORY_SCAN_FAILED";
}

async function recordEvent(
  dependencies: SignalAdvisoryScanDependencies,
  input: Parameters<SignalAdvisoryScanDependencies["store"]["recordSystemEvent"]>[0],
  errors: string[],
): Promise<void> {
  try {
    await dependencies.store.recordSystemEvent(input);
  } catch {
    errors.push("SYSTEM_EVENT_PERSISTENCE_FAILED");
  }
}

export async function runSignalAdvisoryScan(input: Readonly<{
  dependencies: SignalAdvisoryScanDependencies;
  scheduledFor?: Date | string;
}>): Promise<SignalAdvisoryScanResult> {
  const dependencies = input.dependencies;
  const now = dependencies.now ?? Date.now;
  const scheduledFor = input.scheduledFor ?? new Date(now()).toISOString();
  const scheduledDate = new Date(scheduledFor);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("scheduledFor must be a valid date");
  }

  const runKey = buildHourlyScanRunKey(scheduledDate);
  const nowIso = new Date(now()).toISOString();
  const begin = await dependencies.store.beginScanRun({
    runKey,
    scheduledFor: scheduledDate.toISOString(),
    now: nowIso,
  });

  if (begin.action !== "RUN") {
    return {
      outcome: "SKIPPED",
      scanId: begin.scanId,
      runKey,
      strategyVersion: STRATEGY_VERSION,
      symbolsScanned: 0,
      signalsGenerated: 0,
      signalsSent: 0,
      signalsSkipped: 0,
      errors: [],
      dataFreshness: "UNKNOWN",
    };
  }

  const errors: string[] = [];
  let signalsGenerated = 0;
  let signalsSent = 0;
  let signalsSkipped = 0;
  let snapshot: MarketSnapshot;

  try {
    snapshot = await dependencies.marketData.getMarketSnapshot();
  } catch {
    errors.push("MARKET_DATA_UNAVAILABLE");
    await dependencies.store.completeScanRun({
      scanId: begin.scanId,
      status: "FAILED",
      symbolsRequested: RESEARCH_SYMBOLS.length,
      symbolsCompleted: 0,
      signalsGenerated,
      signalsSent,
      signalsSkipped,
      errorCode: "MARKET_DATA_UNAVAILABLE",
      errorMessage: "Market data provider failed before a valid snapshot was available.",
      completedAt: new Date(now()).toISOString(),
    });
    await recordEvent(
      dependencies,
      {
        level: "ERROR",
        operation: "signal-advisory-scan",
        status: "FAILED",
        errorCode: "MARKET_DATA_UNAVAILABLE",
        scanId: begin.scanId,
      },
      errors,
    );
    return {
      outcome: "FAILED",
      scanId: begin.scanId,
      runKey,
      strategyVersion: STRATEGY_VERSION,
      symbolsScanned: RESEARCH_SYMBOLS.length,
      signalsGenerated,
      signalsSent,
      signalsSkipped,
      errors,
      dataFreshness: "UNKNOWN",
    };
  }

  if (!snapshotIsFresh(snapshot)) {
    errors.push("NO_SIGNAL_DATA_NOT_FRESH");
    await dependencies.store.completeScanRun({
      scanId: begin.scanId,
      status: "PARTIAL",
      symbolsRequested: RESEARCH_SYMBOLS.length,
      symbolsCompleted: 0,
      signalsGenerated,
      signalsSent,
      signalsSkipped,
      errorCode: "NO_SIGNAL_DATA",
      errorMessage: "Missing, stale, malformed, or incomplete closed-candle data.",
      completedAt: new Date(now()).toISOString(),
    });
    await recordEvent(
      dependencies,
      {
        level: "WARN",
        operation: "signal-advisory-scan",
        status: "NO_SIGNAL",
        errorCode: "NO_SIGNAL_DATA",
        scanId: begin.scanId,
        metadata: { dataFreshness: "NO_SIGNAL", symbolsScanned: RESEARCH_SYMBOLS.length },
      },
      errors,
    );
    return {
      outcome: "NO_SIGNAL",
      scanId: begin.scanId,
      runKey,
      strategyVersion: STRATEGY_VERSION,
      symbolsScanned: RESEARCH_SYMBOLS.length,
      signalsGenerated,
      signalsSent,
      signalsSkipped,
      errors,
      dataFreshness: "NO_SIGNAL",
    };
  }

  const evaluationTime = snapshot.serverTime!.serverTime;
  const datasets = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => {
      const symbolSnapshot = snapshot.symbols[symbol];
      return [
        symbol,
        symbolSnapshot.status === "VALID"
          ? {
              symbol,
              candles1h: symbolSnapshot.datasets["1h"].candles,
              candles4h: symbolSnapshot.datasets["4h"].candles,
            }
          : null,
      ];
    }),
  ) as Parameters<typeof evaluateStrategy>[0]["datasets"];
  const strategyResult = evaluateStrategy({ evaluationTime, datasets });
  const advisories = strategyResult.rankedCandidates.flatMap((candidate) => {
    const advisory = buildAdvisory({
      snapshot,
      candidate,
      scanRunKey: runKey,
      recipient: dependencies.recipient,
    });
    return advisory ? [advisory] : [];
  });
  signalsGenerated = advisories.length;

  for (const advisory of advisories) {
    try {
      const claim = await dependencies.store.claimSignal(advisory, begin.scanId);
      if (claim === "SKIPPED_DUPLICATE") {
        signalsSkipped += 1;
        continue;
      }

      try {
        const delivery = await dependencies.sendSignalEmail(advisory);
        await dependencies.store.markSignalSent({
          signalId: advisory.signalId,
          sentAt: new Date(now()).toISOString(),
          emailMessageId: delivery.emailMessageId,
        });
        signalsSent += 1;
      } catch {
        errors.push("SMTP_DELIVERY_FAILED");
        await dependencies.store.markSignalFailed({
          signalId: advisory.signalId,
          failedAt: new Date(now()).toISOString(),
          failureReason: "SMTP_DELIVERY_FAILED",
        });
        await recordEvent(
          dependencies,
          {
            level: "ERROR",
            operation: "signal-advisory-email",
            status: "FAILED",
            errorCode: "SMTP_DELIVERY_FAILED",
            scanId: begin.scanId,
            symbol: advisory.symbol,
            metadata: { signalId: advisory.signalId },
          },
          errors,
        );
      }
    } catch (error) {
      errors.push(errorCode(error));
    }
  }

  const completionStatus = errors.length > 0 ? "PARTIAL" : "SUCCEEDED";
  await dependencies.store.completeScanRun({
    scanId: begin.scanId,
    status: completionStatus,
    symbolsRequested: RESEARCH_SYMBOLS.length,
    symbolsCompleted: RESEARCH_SYMBOLS.length,
    signalsGenerated,
    signalsSent,
    signalsSkipped,
    ...(errors.length > 0 ? { errorCode: errors[0], errorMessage: "Signal advisory scan completed with recorded errors." } : {}),
    completedAt: new Date(now()).toISOString(),
  });
  await recordEvent(
    dependencies,
    {
      level: errors.length > 0 ? "WARN" : "INFO",
      operation: "signal-advisory-scan",
      status: signalsGenerated === 0 ? "NO_SIGNAL" : completionStatus,
      scanId: begin.scanId,
      metadata: {
        scanTime: nowIso,
        strategyVersion: STRATEGY_VERSION,
        symbolsScanned: RESEARCH_SYMBOLS.length,
        signalsGenerated,
        signalsSent,
        signalsSkipped,
        errors,
        dataFreshness: "FRESH",
      },
    },
    errors,
  );

  return {
    outcome: signalsGenerated === 0 ? "NO_SIGNAL" : completionStatus === "SUCCEEDED" ? "SUCCESS" : "PARTIAL",
    scanId: begin.scanId,
    runKey,
    strategyVersion: STRATEGY_VERSION,
    symbolsScanned: RESEARCH_SYMBOLS.length,
    signalsGenerated,
    signalsSent,
    signalsSkipped,
    errors,
    dataFreshness: "FRESH",
  };
}

export function createDefaultSignalAdvisoryScanDependencies(): SignalAdvisoryScanDependencies {
  const recipient = process.env.ALERT_EMAIL_TO;
  if (!recipient) {
    throw new Error("ALERT_EMAIL_TO is required for signal advisory scans.");
  }

  return {
    marketData: new BinanceMarketDataProvider(),
    store: createSignalAdvisoryStore(),
    sendSignalEmail: (advisory) => sendSignalEmail(advisory),
    recipient,
  };
}
