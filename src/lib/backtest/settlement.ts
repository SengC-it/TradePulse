import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import { validateFundingRecords } from "../historical-data/validation.ts";
import { validateIntrabarSettlementWindow } from "../historical-data/validation.ts";
import type { IntrabarSettlementCandle } from "../historical-data/types.ts";
import { BACKTEST_POLICY } from "./constants.ts";
import { requiresIntrabarFundingResolution, resolveFundingCharges } from "./funding.ts";
import { isIntrabarSettlementOnly } from "./ranges.ts";
import type {
  BacktestSignalResult,
  BacktestSignalSnapshot,
  SettlementInput,
} from "./types.ts";
import type { StrategyCandidate } from "../strategy/types.ts";
import type { BacktestPolicyVersion } from "./constants.ts";

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function resolveIntrabarExitMinute(
  candles: readonly IntrabarSettlementCandle[],
  direction: BacktestSignalSnapshot["direction"],
  exitReason: "TP" | "SL",
  stopReference: number,
  takeProfitReference: number,
): IntrabarSettlementCandle | null {
  for (const candle of candles) {
    const touched =
      exitReason === "SL"
        ? direction === "LONG"
          ? candle.low <= stopReference
          : candle.high >= stopReference
        : direction === "LONG"
          ? candle.high >= takeProfitReference
          : candle.low <= takeProfitReference;
    if (touched) return candle;
  }
  return null;
}

function reconcileIntrabarWindow(window: readonly IntrabarSettlementCandle[], exitCandle: Candle): boolean {
  if (window.length !== 60) return false;
  const maxHigh = Math.max(...window.map((candle) => candle.high));
  const minLow = Math.min(...window.map((candle) => candle.low));
  return (
    window[0]?.openTime === exitCandle.openTime &&
    window.at(-1)?.closeTime === exitCandle.closeTime &&
    window[0]?.open === exitCandle.open &&
    window.at(-1)?.close === exitCandle.close &&
    maxHigh === exitCandle.high &&
    minLow === exitCandle.low
  );
}

export type FrozenBacktestExit = Readonly<{
  exitCandle: Candle;
  exitReason: "TP" | "SL" | "TIME_EXIT";
  heldCandleNumber: number;
}>;

export function determineFrozenBacktestExit(
  snapshot: BacktestSignalSnapshot,
  heldCandles: readonly Candle[],
): FrozenBacktestExit {
  let exitCandle: Candle | null = null;
  let exitReason: "TP" | "SL" | "TIME_EXIT" = "TIME_EXIT";
  let heldCandleNumber = BACKTEST_POLICY.heldCandleCount;
  for (let index = 0; index < heldCandles.length; index += 1) {
    const candle = heldCandles[index]!;
    const stopTouched =
      snapshot.direction === "LONG"
        ? candle.low <= snapshot.stopReference
        : candle.high >= snapshot.stopReference;
    const takeProfitTouched =
      snapshot.direction === "LONG"
        ? candle.high >= snapshot.takeProfitReference
        : candle.low <= snapshot.takeProfitReference;
    if (stopTouched || takeProfitTouched) {
      exitCandle = candle;
      exitReason = stopTouched ? "SL" : "TP";
      heldCandleNumber = index + 1;
      break;
    }
  }
  return Object.freeze({
    exitCandle: exitCandle ?? heldCandles[BACKTEST_POLICY.heldCandleCount - 1]!,
    exitReason,
    heldCandleNumber,
  });
}

export function emptyBacktestSignalResult(
  snapshot: BacktestSignalSnapshot,
  status: BacktestSignalResult["status"],
  diagnostic?: string,
): BacktestSignalResult {
  return Object.freeze({
    snapshot,
    status,
    entryTime: null,
    rawEntryPrice: null,
    entryFill: null,
    exitTime: null,
    rawExitPrice: null,
    exitFill: null,
    heldCandleNumber: null,
    exitReason: null,
    fundingCharges: Object.freeze([]),
    fundingPnL: 0,
    priceR: null,
    feeR: null,
    fundingR: null,
    grossR: null,
    netR: null,
    ...(diagnostic ? { diagnostic } : {}),
  });
}

function asAmbiguous(
  snapshot: BacktestSignalSnapshot,
  entryTime: number,
  rawEntryPrice: number,
  entryFill: number,
  diagnostic: string,
): BacktestSignalResult {
  return Object.freeze({
    ...emptyBacktestSignalResult(snapshot, "SETTLEMENT_AMBIGUOUS", diagnostic),
    entryTime,
    rawEntryPrice,
    entryFill,
  });
}

export function snapshotFromCandidate(
  candidate: StrategyCandidate,
  signalTime: number,
  backtestPolicyVersion: BacktestPolicyVersion = "bt-policy-001",
): BacktestSignalSnapshot {
  return Object.freeze({
    strategyVersion: candidate.strategyVersion,
    symbol: candidate.symbol,
    direction: candidate.direction,
    symbolRegime: candidate.symbolRegime,
    btcRegime: candidate.btcRegime,
    entryReference: candidate.entryReference,
    stopReference: candidate.stopReference,
    takeProfitReference: candidate.takeProfitReference,
    stopDistance: candidate.stopDistance,
    stopAtr: candidate.stopAtr,
    breakdown: candidate.breakdown,
    totalScore: candidate.totalScore,
    grade: candidate.grade,
    backtestPolicyVersion,
    signalTime,
  });
}

export function settleBacktestSignal(input: SettlementInput): BacktestSignalResult {
  const { snapshot, heldCandles, signalCandle } = input;
  const policy = input.policy ?? snapshot.backtestPolicyVersion;
  if (heldCandles.length !== BACKTEST_POLICY.heldCandleCount) {
    return emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", "Exactly 24 held candles are required.");
  }
  if (
    !finitePositive(snapshot.stopDistance) ||
    !finite(snapshot.stopReference) ||
    !finite(snapshot.takeProfitReference)
  ) {
    return emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", "Signal references or stop distance are invalid.");
  }

  const held24 = heldCandles[BACKTEST_POLICY.heldCandleCount - 1]!;
  if (input.period === "DEV" && held24.closeTime > input.periodEndTime) {
    return emptyBacktestSignalResult(snapshot, "PERIOD_END_CENSORED", "Held candle #24 closes after the frozen DEV end.");
  }

  const firstHeld = heldCandles[0]!;
  if (firstHeld.openTime !== signalCandle.openTime + INTERVAL_MS["1h"]) {
    return emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", "Held candle #1 is not the next 1H candle.");
  }

  const rawEntryPrice = firstHeld.open;
  const entryFill =
    snapshot.direction === "LONG"
      ? rawEntryPrice * (1 + BACKTEST_POLICY.slippageRate)
      : rawEntryPrice * (1 - BACKTEST_POLICY.slippageRate);
  if (!finitePositive(rawEntryPrice) || !finitePositive(entryFill)) {
    return emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", "The next-open entry price is invalid.");
  }

  const bracketValid =
    snapshot.direction === "LONG"
      ? snapshot.stopReference < entryFill && entryFill < snapshot.takeProfitReference
      : snapshot.takeProfitReference < entryFill && entryFill < snapshot.stopReference;
  if (!bracketValid) {
    return Object.freeze({
      ...emptyBacktestSignalResult(snapshot, "ENTRY_OUTSIDE_BRACKET", "The adverse next-open fill is not strictly inside the frozen bracket."),
      entryTime: firstHeld.openTime,
      rawEntryPrice,
      entryFill,
    });
  }

  const frozenExit = determineFrozenBacktestExit(snapshot, heldCandles);
  const { exitCandle, exitReason, heldCandleNumber } = frozenExit;

  const resolvedExitCandle = exitCandle ?? held24;
  const rawExitPrice =
    exitReason === "TIME_EXIT"
      ? resolvedExitCandle.close
      : exitReason === "SL"
        ? snapshot.stopReference
        : snapshot.takeProfitReference;
  const exitFill =
    snapshot.direction === "LONG"
      ? rawExitPrice * (1 - BACKTEST_POLICY.slippageRate)
      : rawExitPrice * (1 + BACKTEST_POLICY.slippageRate);
  const entryTime = firstHeld.openTime;
  let exitTime = resolvedExitCandle.closeTime;
  let exitMinute: Readonly<{ openTime: number; closeTime: number }> | undefined;
  let intrabarCandles: readonly IntrabarSettlementCandle[] | undefined;
  const requiresIntrabar =
    policy === "bt-policy-003" &&
    requiresIntrabarFundingResolution({
      funding: input.funding,
      entryTime,
      exitReason,
      exitCandle: resolvedExitCandle,
    });
  if (requiresIntrabar && exitReason !== "TIME_EXIT") {
    const expectedSettlementOnly = isIntrabarSettlementOnly(input.period, resolvedExitCandle);
    const window =
      input.intrabarSettlementWindow ??
      input.intrabarSettlementWindows?.find(
        (candidate) =>
          candidate.symbol === snapshot.symbol && candidate.exitCandleOpenTime === resolvedExitCandle.openTime,
      );
    if (
      !window ||
      input.serverTime === undefined ||
      window.symbol !== snapshot.symbol ||
      window.exitCandleOpenTime !== resolvedExitCandle.openTime ||
      window.settlementOnly !== expectedSettlementOnly
    ) {
      return Object.freeze({
        ...emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", "Required intrabar settlement window is missing."),
        entryTime,
        rawEntryPrice,
        entryFill,
      });
    }
    try {
      intrabarCandles = validateIntrabarSettlementWindow(window.candles, {
        symbol: snapshot.symbol,
        exitCandleOpenTime: resolvedExitCandle.openTime,
        exitCandleCloseTime: resolvedExitCandle.closeTime,
        serverTime: input.serverTime,
      });
    } catch (error) {
      return Object.freeze({
        ...emptyBacktestSignalResult(
          snapshot,
          "DATA_INCOMPLETE",
          error instanceof Error ? error.message : "Intrabar settlement data is invalid.",
        ),
        entryTime,
        rawEntryPrice,
        entryFill,
      });
    }
    if (!reconcileIntrabarWindow(intrabarCandles, resolvedExitCandle)) {
      return Object.freeze({
        ...emptyBacktestSignalResult(
          snapshot,
          "DATA_INCOMPLETE",
          "Intrabar settlement does not exactly reconcile to the frozen 1H exit candle.",
        ),
        entryTime,
        rawEntryPrice,
        entryFill,
      });
    }
    const resolvedMinute = resolveIntrabarExitMinute(
      intrabarCandles,
      snapshot.direction,
      exitReason,
      snapshot.stopReference,
      snapshot.takeProfitReference,
    );
    if (!resolvedMinute) {
      return Object.freeze({
        ...emptyBacktestSignalResult(
          snapshot,
          "DATA_INCOMPLETE",
          "No 1m candle reproduces the frozen 1H TP/SL exit reason.",
        ),
        entryTime,
        rawEntryPrice,
        entryFill,
      });
    }
    exitMinute = { openTime: resolvedMinute.openTime, closeTime: resolvedMinute.closeTime };
    exitTime = resolvedMinute.closeTime;
  }
  if (!finitePositive(rawExitPrice) || !finitePositive(exitFill)) {
    return Object.freeze({
      ...emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", "The deterministic exit price is invalid."),
      entryTime,
      rawEntryPrice,
      entryFill,
    });
  }

  try {
    validateFundingRecords(input.funding, {
      symbol: snapshot.symbol,
      policy,
    });
  } catch (error) {
    return Object.freeze({
      ...emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", error instanceof Error ? error.message : "Funding data is invalid."),
      entryTime,
      rawEntryPrice,
      entryFill,
    });
  }
  if (input.funding.length === 0) {
    return Object.freeze({
      ...emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", "Required historical funding coverage is missing."),
      entryTime,
      rawEntryPrice,
      entryFill,
    });
  }

  let fundingResolution;
  try {
    fundingResolution = resolveFundingCharges({
    funding: input.funding,
    entryTime,
    exitReason,
    exitCandle: resolvedExitCandle,
    exitTime,
    direction: snapshot.direction,
    policy,
    markPriceCandles: input.markPriceCandles,
    markPriceSegments: input.markPriceSegments,
    markPriceBaseEndTime: input.periodEndTime,
    ...(exitMinute ? { exitMinute } : {}),
  });
  } catch (error) {
    return Object.freeze({
      ...emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", error instanceof Error ? error.message : "Funding calculation failed."),
      entryTime,
      rawEntryPrice,
      entryFill,
    });
  }
  if (fundingResolution.ambiguous) {
    return asAmbiguous(
      snapshot,
      entryTime,
      rawEntryPrice,
      entryFill,
      "Funding timestamp falls within the TP/SL exit candle before intrabar order is known.",
    );
  }

  const fundingCharges = fundingResolution.charges;
  const fundingPnL = fundingCharges.reduce((total, charge) => total + charge.fundingPnL, 0);
  const priceR =
    snapshot.direction === "LONG"
      ? (exitFill - entryFill) / snapshot.stopDistance
      : (entryFill - exitFill) / snapshot.stopDistance;
  const feeR = (entryFill * BACKTEST_POLICY.feeRate + exitFill * BACKTEST_POLICY.feeRate) / snapshot.stopDistance;
  const fundingR = fundingPnL / snapshot.stopDistance;
  const netR = priceR - feeR + fundingR;
  if (![fundingPnL, priceR, feeR, fundingR, netR].every(finite)) {
    return Object.freeze({
      ...emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", "R normalization produced a non-finite value."),
      entryTime,
      rawEntryPrice,
      entryFill,
    });
  }

  return Object.freeze({
    snapshot,
    status: "EXECUTED",
    entryTime,
    rawEntryPrice,
    entryFill,
    exitTime,
    rawExitPrice,
    exitFill,
    heldCandleNumber,
    exitReason,
    fundingCharges,
    ...(policy === "bt-policy-003" ? { fundingOrderAudits: fundingResolution.audits ?? Object.freeze([]) } : {}),
    fundingPnL: normalizeZero(fundingPnL),
    priceR: normalizeZero(priceR),
    feeR: normalizeZero(feeR),
    fundingR: normalizeZero(fundingR),
    grossR: normalizeZero(priceR),
    netR: normalizeZero(netR),
  });
}

export const settleSignal = settleBacktestSignal;
