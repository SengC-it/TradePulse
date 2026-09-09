import { BinanceMarketDataProvider } from "../market-data/binance/provider.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle, MarketSnapshot } from "../market-data/types.ts";
import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "../config/constants.ts";
import { evaluateStrategy } from "../strategy/engine.ts";
import type { StrategyCandidate } from "../strategy/types.ts";
import { buildHourlyScanRunKey } from "../scanning/run-idempotency.ts";
import { sendSignalEmail, SmtpConfigurationError } from "./email.ts";
import { buildDeterministicSignalId } from "./identity.ts";
import { mapStrategyEvaluations } from "./evaluations.ts";
import {
  buildClaimDecisionEvidence,
  buildDeliveredEvidence,
  buildDeliveryAttemptedEvidence,
  buildDeliveryFailedEvidence,
  buildDeliveryRegistryPersistenceFailureEvidence,
  buildNotificationDecisionMetadata,
} from "./notification-evidence.ts";
import type { NotificationEvidenceEvent } from "./notification-evidence.ts";
import { createSignalAdvisoryStore } from "./store.ts";
import { createObservationEvidenceStore } from "../observation-evidence/store.ts";
import { buildQualitySnapshotCandidate } from "../observation-evidence/quality-snapshot.ts";
import { buildMarketContextSnapshotCandidate } from "../observation-evidence/market-context.ts";
import { buildRiskAdvisorySnapshotCandidate } from "../observation-evidence/risk-advisory.ts";
import {
  buildHistoricalReviewMetadataSnapshotCandidate,
} from "../observation-evidence/historical-review-metadata.ts";
import {
  buildAlertIntelligenceSnapshotCandidate,
} from "../observation-evidence/alert-intelligence.ts";
import type { ObservationEvidenceCandidate } from "../observation-evidence/types.ts";
import { historicalContextPublicationFor } from "../historical-review-context/registry.ts";
import { createHistoricalReviewContextRegistry } from "../historical-review-context/store.ts";
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

function errorProperty(error: unknown, property: string): unknown {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return property in error ? (error as Record<string, unknown>)[property] : undefined;
}

type SmtpFailureClass = "EMAIL_CONFIGURATION_INVALID" | "SMTP_AUTH_FAILED" | "SMTP_DELIVERY_FAILED";

type ObservationStageAppendStatus = "APPENDED" | "IDEMPOTENT_REPLAY" | "NOT_EVALUABLE" | "FAILED";

function observationAppendSucceeded(status: ObservationStageAppendStatus): boolean {
  return status === "APPENDED" || status === "IDEMPOTENT_REPLAY";
}

function classifySmtpFailure(error: unknown): SmtpFailureClass {
  if (error instanceof SmtpConfigurationError) {
    return "EMAIL_CONFIGURATION_INVALID";
  }

  if (errorProperty(error, "code") === "EAUTH" || errorProperty(error, "responseCode") === 535) {
    return "SMTP_AUTH_FAILED";
  }

  return "SMTP_DELIVERY_FAILED";
}

function errorCode(error: unknown): string {
  if (error instanceof SmtpConfigurationError) {
    return "EMAIL_CONFIGURATION_INVALID";
  }

  if (errorProperty(error, "code") === "EAUTH" || errorProperty(error, "responseCode") === 535) {
    return "SMTP_AUTH_FAILED";
  }

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

function observeNotificationEvidence(
  dependencies: SignalAdvisoryScanDependencies,
  event: NotificationEvidenceEvent,
): void {
  const observer = dependencies.observeNotificationEvidence;
  if (!observer) return;

  try {
    const pending = observer(event);
    if (pending && typeof pending.then === "function") {
      void Promise.resolve(pending).catch(() => {
        // Evidence observation is a best-effort runtime sidecar. It is not a
        // durable writer, transaction participant, or delivery acknowledgement.
      });
    }
  } catch {
    // Evidence observation is a best-effort runtime sidecar. It must never
    // alter scan or delivery truth.
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
  try {
    await dependencies.store.recordStrategyEvaluations(
      mapStrategyEvaluations({
        scanRunId: begin.scanId,
        evaluatedAt: new Date(evaluationTime).toISOString(),
        evaluations: strategyResult.evaluations,
      }),
    );
  } catch {
    errors.push("EVALUATION_PERSISTENCE_FAILED");
    await recordEvent(
      dependencies,
      {
        level: "ERROR",
        operation: "signal-advisory-evaluation-persistence",
        status: "FAILED",
        errorCode: "EVALUATION_PERSISTENCE_FAILED",
        scanId: begin.scanId,
        metadata: { evaluationCount: strategyResult.evaluations.length },
      },
      errors,
    );
  }
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
      const claim = await dependencies.store.claimSignal(advisory, begin.scanId, nowIso);
      let qualitySnapshot: ObservationEvidenceCandidate | null = null;
      let qualitySnapshotAppend: { status: ObservationStageAppendStatus };
      try {
        qualitySnapshot = buildQualitySnapshotCandidate({
          advisory,
          capturedAt: new Date(now()).toISOString(),
        });
        try {
          const appendResult = await dependencies.observationEvidenceStore.appendEvidence(qualitySnapshot);
          qualitySnapshotAppend = { status: appendResult.status };
        } catch {
          qualitySnapshotAppend = { status: "FAILED" };
        }
      } catch {
        qualitySnapshotAppend = { status: "NOT_EVALUABLE" };
      }
      if (!observationAppendSucceeded(qualitySnapshotAppend.status)) {
        errors.push("QUALITY_SNAPSHOT_EVIDENCE_FAILED");
        await recordEvent(
          dependencies,
          {
            level: "ERROR",
            operation: "round-022-quality-snapshot",
            status: qualitySnapshotAppend.status,
            errorCode: "QUALITY_SNAPSHOT_EVIDENCE_FAILED",
            scanId: begin.scanId,
            symbol: advisory.symbol,
            metadata: {
              signalId: advisory.signalId,
              appendStatus: qualitySnapshotAppend.status,
            },
          },
          errors,
        );
      }
      let marketContext: ObservationEvidenceCandidate | null = null;
      let marketContextAppend: { status: ObservationStageAppendStatus };
      try {
        marketContext = buildMarketContextSnapshotCandidate({
          advisory,
          snapshot,
          capturedAt: new Date(now()).toISOString(),
        });
        try {
          const appendResult = await dependencies.observationEvidenceStore.appendEvidence(marketContext);
          marketContextAppend = { status: appendResult.status };
        } catch {
          marketContextAppend = { status: "FAILED" };
        }
      } catch {
        marketContextAppend = { status: "NOT_EVALUABLE" };
      }
      if (!observationAppendSucceeded(marketContextAppend.status)) {
        errors.push("MARKET_CONTEXT_EVIDENCE_FAILED");
        await recordEvent(
          dependencies,
          {
            level: "ERROR",
            operation: "round-022-market-context",
            status: marketContextAppend.status,
            errorCode: "MARKET_CONTEXT_EVIDENCE_FAILED",
            scanId: begin.scanId,
            symbol: advisory.symbol,
            metadata: {
              signalId: advisory.signalId,
              appendStatus: marketContextAppend.status,
            },
          },
          errors,
        );
      }
      let riskAdvisory: ObservationEvidenceCandidate | null = null;
      let riskAdvisoryAppend: { status: ObservationStageAppendStatus };
      try {
        riskAdvisory = buildRiskAdvisorySnapshotCandidate({
          advisory,
          capturedAt: new Date(now()).toISOString(),
        });
        try {
          const appendResult = await dependencies.observationEvidenceStore.appendEvidence(riskAdvisory);
          riskAdvisoryAppend = { status: appendResult.status };
        } catch {
          riskAdvisoryAppend = { status: "FAILED" };
        }
      } catch {
        riskAdvisoryAppend = { status: "NOT_EVALUABLE" };
      }
      if (!observationAppendSucceeded(riskAdvisoryAppend.status)) {
        errors.push("RISK_ADVISORY_EVIDENCE_FAILED");
        await recordEvent(
          dependencies,
          {
            level: "ERROR",
            operation: "round-022-risk-advisory",
            status: riskAdvisoryAppend.status,
            errorCode: "RISK_ADVISORY_EVIDENCE_FAILED",
            scanId: begin.scanId,
            symbol: advisory.symbol,
            metadata: {
              signalId: advisory.signalId,
              appendStatus: riskAdvisoryAppend.status,
            },
          },
          errors,
        );
      }
      const contextRegistry = dependencies.historicalReviewContextRegistry;
      let historicalReviewMetadata: ObservationEvidenceCandidate | null = null;
      let historicalReviewAppendStatus: ObservationStageAppendStatus = "NOT_EVALUABLE";
      if (contextRegistry) {
        try {
          const lookup = await contextRegistry.findPriorContext({
            currentSignalId: advisory.signalId,
            symbol: advisory.symbol,
            signalTime: advisory.signalTime,
          });
          if (lookup.status === "FOUND") {
            let historicalReviewAppend: { status: ObservationStageAppendStatus };
            try {
              historicalReviewMetadata = buildHistoricalReviewMetadataSnapshotCandidate({
                advisory,
                priorContext: lookup.context,
                capturedAt: new Date(now()).toISOString(),
              });
              try {
                const appendResult = await dependencies.observationEvidenceStore.appendEvidence(
                  historicalReviewMetadata,
                );
                historicalReviewAppend = { status: appendResult.status };
                historicalReviewAppendStatus = appendResult.status;
              } catch {
                historicalReviewAppend = { status: "FAILED" };
                historicalReviewAppendStatus = "FAILED";
              }
            } catch {
              historicalReviewAppend = { status: "NOT_EVALUABLE" };
              historicalReviewAppendStatus = "NOT_EVALUABLE";
            }
            if (!observationAppendSucceeded(historicalReviewAppend.status)) {
              errors.push("HISTORICAL_REVIEW_METADATA_EVIDENCE_FAILED");
              await recordEvent(
                dependencies,
                {
                  level: "ERROR",
                  operation: "round-022-historical-review-metadata",
                  status: historicalReviewAppend.status,
                  errorCode: "HISTORICAL_REVIEW_METADATA_EVIDENCE_FAILED",
                  scanId: begin.scanId,
                  symbol: advisory.symbol,
                  metadata: {
                    signalId: advisory.signalId,
                    appendStatus: historicalReviewAppend.status,
                  },
                },
                errors,
              );
            }
          } else if (lookup.status === "NOT_EVALUABLE") {
            errors.push("HISTORICAL_REVIEW_METADATA_EVIDENCE_FAILED");
            await recordEvent(
              dependencies,
              {
                level: "ERROR",
                operation: "round-022-historical-review-metadata",
                status: lookup.status,
                errorCode: "HISTORICAL_REVIEW_METADATA_EVIDENCE_FAILED",
                scanId: begin.scanId,
                symbol: advisory.symbol,
                metadata: { signalId: advisory.signalId, reason: lookup.reason },
              },
              errors,
            );
          }
        } catch {
          errors.push("HISTORICAL_REVIEW_CONTEXT_REGISTRY_FAILED");
          await recordEvent(
            dependencies,
            {
              level: "ERROR",
              operation: "round-022-historical-review-context-registry",
              status: "FAILED",
              errorCode: "HISTORICAL_REVIEW_CONTEXT_REGISTRY_FAILED",
              scanId: begin.scanId,
              symbol: advisory.symbol,
              metadata: { signalId: advisory.signalId, phase: "LOOKUP" },
            },
            errors,
          );
        }

        let alertIntelligenceAppend: { status: ObservationStageAppendStatus };
        try {
          const alertIntelligence = buildAlertIntelligenceSnapshotCandidate({
            advisory,
            qualityEvidence: observationAppendSucceeded(qualitySnapshotAppend.status) ? qualitySnapshot : null,
            marketContextEvidence: observationAppendSucceeded(marketContextAppend.status) ? marketContext : null,
            riskAdvisoryEvidence: observationAppendSucceeded(riskAdvisoryAppend.status) ? riskAdvisory : null,
            historicalReviewEvidence: observationAppendSucceeded(historicalReviewAppendStatus)
              ? historicalReviewMetadata
              : null,
            capturedAt: new Date(now()).toISOString(),
          });
          try {
            const appendResult = await dependencies.observationEvidenceStore.appendEvidence(alertIntelligence);
            alertIntelligenceAppend = { status: appendResult.status };
          } catch {
            alertIntelligenceAppend = { status: "FAILED" };
          }
        } catch {
          alertIntelligenceAppend = { status: "NOT_EVALUABLE" };
        }
        if (!observationAppendSucceeded(alertIntelligenceAppend.status)) {
          errors.push("ALERT_INTELLIGENCE_EVIDENCE_FAILED");
          await recordEvent(
            dependencies,
            {
              level: "ERROR",
              operation: "round-022-alert-intelligence",
              status: alertIntelligenceAppend.status,
              errorCode: "ALERT_INTELLIGENCE_EVIDENCE_FAILED",
              scanId: begin.scanId,
              symbol: advisory.symbol,
              metadata: {
                signalId: advisory.signalId,
                appendStatus: alertIntelligenceAppend.status,
              },
            },
            errors,
          );
        }

        try {
          const published = await contextRegistry.publishContext(
            historicalContextPublicationFor(advisory),
          );
          if (published.status !== "APPENDED" && published.status !== "IDEMPOTENT_REPLAY") {
            throw new Error("Historical review context publication returned an unsupported status.");
          }
        } catch {
          errors.push("HISTORICAL_REVIEW_CONTEXT_REGISTRY_FAILED");
          await recordEvent(
            dependencies,
            {
              level: "ERROR",
              operation: "round-022-historical-review-context-registry",
              status: "FAILED",
              errorCode: "HISTORICAL_REVIEW_CONTEXT_REGISTRY_FAILED",
              scanId: begin.scanId,
              symbol: advisory.symbol,
              metadata: { signalId: advisory.signalId, phase: "PUBLISH" },
            },
            errors,
          );
        }
      }
      const metadata = buildNotificationDecisionMetadata({
        scanId: begin.scanId,
        signalId: advisory.signalId,
        decisionType: claim,
      });
      observeNotificationEvidence(dependencies, buildClaimDecisionEvidence(metadata));
      if (claim === "SKIPPED_DUPLICATE" || claim === "SKIPPED_EXPIRED") {
        signalsSkipped += 1;
        continue;
      }

      observeNotificationEvidence(dependencies, buildDeliveryAttemptedEvidence(metadata));
      let delivery: { emailMessageId: string };
      try {
        delivery = await dependencies.sendSignalEmail(advisory);
      } catch (error) {
        const failureClass = classifySmtpFailure(error);
        observeNotificationEvidence(dependencies, buildDeliveryFailedEvidence(metadata, failureClass));
        errors.push(failureClass);
        await dependencies.store.markSignalFailed({
          signalId: advisory.signalId,
          failedAt: new Date(now()).toISOString(),
          failureReason: failureClass,
        });
        await recordEvent(
          dependencies,
          {
            level: "ERROR",
            operation: "signal-advisory-email",
            status: "FAILED",
            errorCode: failureClass,
            scanId: begin.scanId,
            symbol: advisory.symbol,
            metadata: { signalId: advisory.signalId, failureClass },
          },
          errors,
        );
        continue;
      }

      signalsSent += 1;
      observeNotificationEvidence(dependencies, buildDeliveredEvidence(metadata));
      try {
        await dependencies.store.markSignalSent({
          signalId: advisory.signalId,
          sentAt: new Date(now()).toISOString(),
          emailMessageId: delivery.emailMessageId,
        });
      } catch {
        const persistenceFailure = "DELIVERY_REGISTRY_PERSISTENCE_FAILED" as const;
        observeNotificationEvidence(
          dependencies,
          buildDeliveryRegistryPersistenceFailureEvidence(metadata),
        );
        errors.push(persistenceFailure);
        await recordEvent(
          dependencies,
          {
            level: "ERROR",
            operation: "signal-advisory-delivery-registry-persistence",
            status: "FAILED",
            errorCode: persistenceFailure,
            scanId: begin.scanId,
            symbol: advisory.symbol,
            metadata: { signalId: advisory.signalId, technicalCode: persistenceFailure },
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
    observationEvidenceStore: createObservationEvidenceStore(),
    historicalReviewContextRegistry: createHistoricalReviewContextRegistry(),
    sendSignalEmail: (advisory) => sendSignalEmail(advisory),
    recipient,
  };
}
