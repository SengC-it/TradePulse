import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import { validateFundingRecords, validateIntrabarSettlementWindow } from "../historical-data/validation.ts";
import type {
  HistoricalFundingRecord,
  HistoricalIntrabarSettlementWindow,
  HistoricalMarkPriceCandle,
  HistoricalMarkPriceSegment,
  IntrabarSettlementCandle,
} from "../historical-data/types.ts";
import { BACKTEST_POLICY } from "../backtest/constants.ts";
import { requiresIntrabarFundingResolution, resolveFundingCharges } from "../backtest/funding.ts";
import type { BacktestSignalSnapshot, BacktestFundingCharge, BacktestFundingOrderAudit } from "../backtest/types.ts";
import type { R5CandidateSignal, R5Direction } from "./m3-r5-round-005-protocol.ts";

export type R5ExecutionStatus =
  | "EXECUTED"
  | "ENTRY_UNAVAILABLE"
  | "ENTRY_OUTSIDE_PROTECTIVE_STOP"
  | "INVALID_TARGET_GEOMETRY"
  | "PERIOD_END_CENSORED"
  | "DATA_INCOMPLETE"
  | "SETTLEMENT_AMBIGUOUS";

export type R5SettlementResult = Readonly<{
  signal: R5CandidateSignal;
  status: R5ExecutionStatus;
  entryTime: number | null;
  rawEntryPrice: number | null;
  entryFill: number | null;
  exitTime: number | null;
  rawExitPrice: number | null;
  exitFill: number | null;
  heldCandleNumber: number | null;
  exitReason: "TP" | "SL" | "TIME_EXIT" | null;
  fundingCharges: readonly BacktestFundingCharge[];
  fundingOrderAudits: readonly BacktestFundingOrderAudit[];
  fundingPnL: number | null;
  priceR: number | null;
  feeR: number | null;
  fundingR: number | null;
  grossR: number | null;
  netR: number | null;
  settlementAmbiguousExitCandleOpenTime?: number;
  diagnostic?: string;
}>;

function emptyResult(
  signal: R5CandidateSignal,
  status: R5ExecutionStatus,
  diagnostic?: string,
  details: Partial<R5SettlementResult> = {},
): R5SettlementResult {
  return Object.freeze({
    signal,
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
    fundingOrderAudits: Object.freeze([]),
    fundingPnL: null,
    priceR: null,
    feeR: null,
    fundingR: null,
    grossR: null,
    netR: null,
    ...(diagnostic ? { diagnostic } : {}),
    ...details,
  });
}

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function snapshotForFunding(signal: R5CandidateSignal, stopDistance: number): BacktestSignalSnapshot {
  return {
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    signalTime: signal.signalTime,
    symbol: signal.symbol,
    direction: signal.direction,
    symbolRegime: "NO_TRADE",
    btcRegime: "BTC_NEUTRAL",
    entryReference: signal.signalTime,
    stopReference: 1,
    takeProfitReference: 1,
    stopDistance,
    stopAtr: signal.stopAtrMultiple,
    breakdown: {
      trendStrength: 0,
      pullbackQuality: 0,
      breakoutStrength: 0,
      volumeScore: 0,
      riskRewardScore: 0,
    },
    totalScore: 0,
    grade: null,
  };
}

function candleIsValid(candle: Candle, symbol: string, expectedOpenTime: number): boolean {
  return candle.symbol === symbol &&
    candle.timeframe === "1h" &&
    candle.openTime === expectedOpenTime &&
    candle.closeTime === expectedOpenTime + INTERVAL_MS["1h"] - 1 &&
    [candle.open, candle.high, candle.low, candle.close].every(positive) &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close) &&
    candle.high >= candle.low;
}

function exitMinuteFor(
  candles: readonly IntrabarSettlementCandle[],
  direction: R5Direction,
  exitReason: "TP" | "SL",
  stopPrice: number,
  takeProfitPrice: number,
): IntrabarSettlementCandle | null {
  return candles.find((candle) => {
    return exitReason === "SL"
      ? direction === "LONG" ? candle.low <= stopPrice : candle.high >= stopPrice
      : direction === "LONG" ? candle.high >= takeProfitPrice : candle.low <= takeProfitPrice;
  }) ?? null;
}

function reconcileIntrabar(
  candles: readonly IntrabarSettlementCandle[],
  exitCandle: Candle,
): boolean {
  return candles.length === 60 &&
    candles[0]?.openTime === exitCandle.openTime &&
    candles.at(-1)?.closeTime === exitCandle.closeTime &&
    candles[0]?.open === exitCandle.open &&
    candles.at(-1)?.close === exitCandle.close &&
    Math.max(...candles.map((candle) => candle.high)) === exitCandle.high &&
    Math.min(...candles.map((candle) => candle.low)) === exitCandle.low;
}

function findSignalCandle(candles: readonly Candle[], signalTime: number): Candle | undefined {
  return candles.find((candle) => candle.timeframe === "1h" && candle.closeTime === signalTime);
}

function findEntry(candles: readonly Candle[], signalTime: number): Candle | undefined {
  return candles.find((candle) => candle.timeframe === "1h" && candle.openTime > signalTime && positive(candle.open));
}

function findHeldCandles(
  candles: readonly Candle[],
  entry: Candle,
  count: number,
): readonly Candle[] | null {
  const held = candles.filter((candle) => candle.openTime >= entry.openTime).slice(0, count);
  if (held.length !== count) return null;
  if (!held.every((candle, index) => candleIsValid(candle, entry.symbol, entry.openTime + index * INTERVAL_MS["1h"]))) return null;
  return Object.freeze(held);
}

function frozenExit(
  signal: R5CandidateSignal,
  heldCandles: readonly Candle[],
  stopPrice: number,
  takeProfitPrice: number,
): Readonly<{ candle: Candle; reason: "TP" | "SL" | "TIME_EXIT"; number: number }> {
  for (let index = 0; index < heldCandles.length; index += 1) {
    const candle = heldCandles[index]!;
    const stopTouched = signal.direction === "LONG" ? candle.low <= stopPrice : candle.high >= stopPrice;
    const targetTouched = signal.direction === "LONG" ? candle.high >= takeProfitPrice : candle.low <= takeProfitPrice;
    if (stopTouched || targetTouched) {
      return Object.freeze({ candle, reason: stopTouched ? "SL" : "TP", number: index + 1 });
    }
  }
  const candle = heldCandles.at(-1)!;
  return Object.freeze({ candle, reason: "TIME_EXIT", number: heldCandles.length });
}

/**
 * Settles one formal Round-005 signal using bt-policy-003. This function is
 * deliberately data-in/data-out: it does not fetch data, calculate metrics,
 * select a candidate, or write evidence.
 */
export function settleR5Candidate(input: Readonly<{
  signal: R5CandidateSignal;
  candles1h: readonly Candle[];
  funding: readonly HistoricalFundingRecord[];
  markPriceCandles?: readonly HistoricalMarkPriceCandle[];
  markPriceSegments?: readonly HistoricalMarkPriceSegment[];
  intrabarSettlementWindows?: readonly HistoricalIntrabarSettlementWindow[];
  serverTime?: number;
  periodEndTime: number;
}>): R5SettlementResult {
  const signalCandle = findSignalCandle(input.candles1h, input.signal.signalTime);
  const entry = findEntry(input.candles1h, input.signal.signalTime);
  if (!signalCandle || !entry) return emptyResult(input.signal, "ENTRY_UNAVAILABLE", "NEXT_1H_OPEN_UNAVAILABLE");

  const rawEntryPrice = entry.open;
  const entryFill = input.signal.direction === "LONG"
    ? rawEntryPrice * (1 + BACKTEST_POLICY.slippageRate)
    : rawEntryPrice * (1 - BACKTEST_POLICY.slippageRate);
  const stopDistance = input.signal.decisionAtr * input.signal.stopAtrMultiple;
  const stopPrice = input.signal.direction === "LONG" ? entryFill - stopDistance : entryFill + stopDistance;
  const takeProfitPrice = input.signal.takeProfitR === "FIXED_DECISION_EMA20"
    ? input.signal.fixedTargetPrice ?? Number.NaN
    : input.signal.direction === "LONG"
      ? entryFill + stopDistance * input.signal.takeProfitR
      : entryFill - stopDistance * input.signal.takeProfitR;

  const baseDetails = { entryTime: entry.openTime, rawEntryPrice, entryFill };
  if (!positive(rawEntryPrice) || !positive(entryFill) || !positive(stopDistance) || !positive(stopPrice) || !positive(takeProfitPrice)) {
    return emptyResult(input.signal, "DATA_INCOMPLETE", "INVALID_ENTRY_OR_RISK_GEOMETRY", baseDetails);
  }
  const validTargetGeometry = input.signal.direction === "LONG"
    ? takeProfitPrice > entryFill && stopPrice < entryFill
    : takeProfitPrice < entryFill && stopPrice > entryFill;
  if (!validTargetGeometry) return emptyResult(input.signal, "INVALID_TARGET_GEOMETRY", "INVALID_TARGET_GEOMETRY", { ...baseDetails });

  const heldCandles = findHeldCandles(input.candles1h, entry, input.signal.maxHeldCandles);
  const expectedLastClose = entry.openTime + input.signal.maxHeldCandles * INTERVAL_MS["1h"] - 1;
  if (expectedLastClose > input.periodEndTime) {
    return emptyResult(input.signal, "PERIOD_END_CENSORED", "REQUIRED_HELD_CANDLE_CLOSE_AFTER_RESEARCH_END", baseDetails);
  }
  if (!heldCandles) return emptyResult(input.signal, "DATA_INCOMPLETE", "REQUIRED_HELD_CANDLES_UNAVAILABLE_OR_INVALID", baseDetails);

  const exit = frozenExit(input.signal, heldCandles, stopPrice, takeProfitPrice);
  const rawExitPrice = exit.reason === "TIME_EXIT" ? exit.candle.close : exit.reason === "SL" ? stopPrice : takeProfitPrice;
  const exitFill = input.signal.direction === "LONG"
    ? rawExitPrice * (1 - BACKTEST_POLICY.slippageRate)
    : rawExitPrice * (1 + BACKTEST_POLICY.slippageRate);
  if (!positive(rawExitPrice) || !positive(exitFill)) {
    return emptyResult(input.signal, "DATA_INCOMPLETE", "INVALID_EXIT_PRICE", { ...baseDetails, exitTime: exit.candle.closeTime, exitReason: exit.reason, heldCandleNumber: exit.number });
  }

  try {
    validateFundingRecords(input.funding, { symbol: input.signal.symbol, policy: "bt-policy-003" });
  } catch (error) {
    return emptyResult(input.signal, "DATA_INCOMPLETE", error instanceof Error ? error.message : "INVALID_FUNDING_DATA", { ...baseDetails, exitTime: exit.candle.closeTime, exitReason: exit.reason, heldCandleNumber: exit.number });
  }
  if (input.funding.length === 0) {
    return emptyResult(input.signal, "DATA_INCOMPLETE", "REQUIRED_FUNDING_COVERAGE_MISSING", { ...baseDetails, exitTime: exit.candle.closeTime, exitReason: exit.reason, heldCandleNumber: exit.number });
  }

  let exitMinute: Readonly<{ openTime: number; closeTime: number }> | undefined;
  const needsIntrabar = requiresIntrabarFundingResolution({
    funding: input.funding,
    entryTime: entry.openTime,
    exitReason: exit.reason,
    exitCandle: exit.candle,
  });
  if (needsIntrabar && exit.reason !== "TIME_EXIT") {
    const window = input.intrabarSettlementWindows?.find(
      (candidate) => candidate.symbol === input.signal.symbol && candidate.exitCandleOpenTime === exit.candle.openTime,
    );
    if (!window || input.serverTime === undefined) {
      return emptyResult(input.signal, "SETTLEMENT_AMBIGUOUS", "REQUIRED_INTRABAR_SETTLEMENT_WINDOW_MISSING", {
        ...baseDetails,
        exitTime: exit.candle.closeTime,
        exitReason: exit.reason,
        heldCandleNumber: exit.number,
        settlementAmbiguousExitCandleOpenTime: exit.candle.openTime,
      });
    }
    try {
      const candles = validateIntrabarSettlementWindow(window.candles, {
        symbol: input.signal.symbol,
        exitCandleOpenTime: exit.candle.openTime,
        exitCandleCloseTime: exit.candle.closeTime,
        serverTime: input.serverTime,
      });
      if (!reconcileIntrabar(candles, exit.candle)) throw new Error("INTRABAR_SETTLEMENT_RECONCILIATION_FAILED");
      const minute = exitMinuteFor(candles, input.signal.direction, exit.reason, stopPrice, takeProfitPrice);
      if (!minute) throw new Error("INTRABAR_EXIT_TRIGGER_NOT_REPRODUCED");
      exitMinute = { openTime: minute.openTime, closeTime: minute.closeTime };
    } catch (error) {
      return emptyResult(input.signal, "DATA_INCOMPLETE", error instanceof Error ? error.message : "INVALID_INTRABAR_SETTLEMENT", {
        ...baseDetails,
        exitTime: exit.candle.closeTime,
        exitReason: exit.reason,
        heldCandleNumber: exit.number,
      });
    }
  }

  let fundingResolution;
  try {
    fundingResolution = resolveFundingCharges({
      funding: input.funding,
      entryTime: entry.openTime,
      exitReason: exit.reason,
      exitCandle: exit.candle,
      exitTime: exit.candle.closeTime,
      direction: input.signal.direction,
      policy: "bt-policy-003",
      markPriceCandles: input.markPriceCandles,
      markPriceSegments: input.markPriceSegments,
      ...(exitMinute ? { exitMinute } : {}),
    });
  } catch (error) {
    return emptyResult(input.signal, "DATA_INCOMPLETE", error instanceof Error ? error.message : "FUNDING_CALCULATION_FAILED", {
      ...baseDetails,
      exitTime: exit.candle.closeTime,
      exitReason: exit.reason,
      heldCandleNumber: exit.number,
    });
  }

  if (fundingResolution.ambiguous) {
    return emptyResult(input.signal, "SETTLEMENT_AMBIGUOUS", "FUNDING_ORDER_REMAINS_AMBIGUOUS", {
      ...baseDetails,
      exitTime: exit.candle.closeTime,
      exitReason: exit.reason,
      heldCandleNumber: exit.number,
      settlementAmbiguousExitCandleOpenTime: exit.candle.openTime,
    });
  }

  const fundingPnL = fundingResolution.charges.reduce((total, charge) => total + charge.fundingPnL, 0);
  const priceR = input.signal.direction === "LONG"
    ? (exitFill - entryFill) / stopDistance
    : (entryFill - exitFill) / stopDistance;
  const feeR = (entryFill * BACKTEST_POLICY.feeRate + exitFill * BACKTEST_POLICY.feeRate) / stopDistance;
  const fundingR = fundingPnL / stopDistance;
  const netR = priceR - feeR + fundingR;
  if (![fundingPnL, priceR, feeR, fundingR, netR].every(finite)) {
    return emptyResult(input.signal, "DATA_INCOMPLETE", "NON_FINITE_R_NORMALIZATION", {
      ...baseDetails,
      exitTime: exit.candle.closeTime,
      exitReason: exit.reason,
      heldCandleNumber: exit.number,
    });
  }
  return Object.freeze({
    signal: input.signal,
    status: "EXECUTED",
    entryTime: entry.openTime,
    rawEntryPrice,
    entryFill,
    exitTime: exit.candle.closeTime,
    rawExitPrice,
    exitFill,
    heldCandleNumber: exit.number,
    exitReason: exit.reason,
    fundingCharges: fundingResolution.charges,
    fundingOrderAudits: fundingResolution.audits ?? Object.freeze([]),
    fundingPnL,
    priceR,
    feeR,
    fundingR,
    grossR: priceR,
    netR,
  });
}

export function r5FundingSnapshot(signal: R5CandidateSignal, stopDistance: number): BacktestSignalSnapshot {
  return snapshotForFunding(signal, stopDistance);
}
