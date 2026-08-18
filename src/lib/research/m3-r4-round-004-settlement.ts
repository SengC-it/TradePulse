import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import {
  validateIntrabarSettlementWindow,
  validateFundingRecords,
} from "../historical-data/validation.ts";
import type {
  HistoricalFundingRecord,
  HistoricalIntrabarSettlementWindow,
  HistoricalMarkPriceCandle,
  HistoricalMarkPriceSegment,
} from "../historical-data/types.ts";
import { BACKTEST_POLICY, type BacktestPeriod } from "../backtest/constants.ts";
import { requiresIntrabarFundingResolution, resolveFundingCharges } from "../backtest/funding.ts";
import type { BacktestFundingCharge, BacktestSignalSnapshot } from "../backtest/types.ts";
import { isIntrabarSettlementOnly } from "../backtest/ranges.ts";
import {
  evaluateH13ExitStep,
  resolveH13TrendExitAtNextOpen,
  type H13ExitStepResult,
} from "./m3-r4-round-004-protocol.ts";

export const M3_R4_H13_EXIT_REASONS = Object.freeze(["SL", "TREND_EXIT", "TIME_EXIT"] as const);
export type M3R4H13ExitReason = (typeof M3_R4_H13_EXIT_REASONS)[number];

export const M3_R4_H13_RAW_STATUSES = Object.freeze([
  "EXECUTED",
  "DATA_INCOMPLETE",
  "PERIOD_END_CENSORED",
  "ENTRY_OUTSIDE_PROTECTIVE_STOP",
  "SETTLEMENT_AMBIGUOUS",
] as const);
export type M3R4H13RawStatus = (typeof M3_R4_H13_RAW_STATUSES)[number];

export type H13DecisionAudit = Readonly<{
  baselineCandidateSnapshot: BacktestSignalSnapshot;
  originalTakeProfitReference: number;
}>;

export type H13SettlementOutcomeAudit = Readonly<{
  exitReason: M3R4H13ExitReason;
  trendTriggerHeldCandleNumber: number | null;
  heldCandleNumber: number | null;
  trendTriggerClose: number | null;
  trendTriggerEma20: number | null;
  rawExitPrice: number | null;
  exitFill: number | null;
  exitTime: number | null;
  originalStopDistance: number;
}>;

export type H13RawResult = Readonly<{
  snapshot: BacktestSignalSnapshot;
  status: M3R4H13RawStatus;
  entryTime: number | null;
  rawEntryPrice: number | null;
  entryFill: number | null;
  exitTime: number | null;
  rawExitPrice: number | null;
  exitFill: number | null;
  heldCandleNumber: number | null;
  exitReason: M3R4H13ExitReason | null;
  fundingCharges: readonly BacktestFundingCharge[];
  fundingPnL: number | null;
  priceR: number | null;
  feeR: number | null;
  fundingR: number | null;
  grossR: number | null;
  netR: number | null;
  decisionAudit: H13DecisionAudit;
  settlementAudit: H13SettlementOutcomeAudit;
  diagnostic?: string;
}>;

export type H13ExitPlan = Readonly<{
  exitReason: M3R4H13ExitReason;
  heldCandleNumber: number;
  exitCandle: Candle;
  rawExitPrice: number;
  exitTime: number;
  trendTriggerHeldCandleNumber: number | null;
  trendTriggerClose: number | null;
  trendTriggerEma20: number | null;
}>;

export type H13SettlementInput = Readonly<{
  snapshot: BacktestSignalSnapshot;
  signalCandle: Candle;
  heldCandles: readonly Candle[];
  ema20ByHeldCandle: readonly (number | null)[];
  funding: readonly HistoricalFundingRecord[];
  markPriceCandles?: readonly HistoricalMarkPriceCandle[];
  markPriceSegments?: readonly HistoricalMarkPriceSegment[];
  intrabarSettlementWindows?: readonly HistoricalIntrabarSettlementWindow[];
  serverTime?: number;
  period: Exclude<BacktestPeriod, "COMBINED">;
  periodEndTime: number;
}>;

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positive(value: number | null | undefined): value is number {
  return finite(value) && value > 0;
}

function emptyResult(
  snapshot: BacktestSignalSnapshot,
  status: M3R4H13RawStatus,
  decisionAudit: H13DecisionAudit,
  diagnostic?: string,
): H13RawResult {
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
    fundingPnL: null,
    priceR: null,
    feeR: null,
    fundingR: null,
    grossR: null,
    netR: null,
    decisionAudit,
    settlementAudit: Object.freeze({
      exitReason: "TIME_EXIT",
      trendTriggerHeldCandleNumber: null,
      heldCandleNumber: null,
      trendTriggerClose: null,
      trendTriggerEma20: null,
      rawExitPrice: null,
      exitFill: null,
      exitTime: null,
      originalStopDistance: snapshot.stopDistance,
    }),
    ...(diagnostic ? { diagnostic } : {}),
  });
}

function validHeldCandleSequence(signalCandle: Candle, heldCandles: readonly Candle[]): boolean {
  if (heldCandles.length !== 48) return false;
  return heldCandles.every((candle, index) =>
    candle.symbol === signalCandle.symbol &&
    candle.timeframe === "1h" &&
    candle.openTime === signalCandle.openTime + (index + 1) * INTERVAL_MS["1h"] &&
    candle.closeTime === candle.openTime + INTERVAL_MS["1h"] - 1 &&
    [candle.open, candle.high, candle.low, candle.close].every(positive) &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close) &&
    candle.high >= candle.low,
  );
}

function validateEmaHistory(ema20ByHeldCandle: readonly (number | null)[]): boolean {
  return ema20ByHeldCandle.length >= 47 && ema20ByHeldCandle.slice(0, 47).every(finite);
}

/**
 * Phase A H13 exit planning. It computes only the frozen exit path and no
 * funding, R, metrics, or evidence fields.
 */
export function planH13Exit(input: Readonly<{
  direction: BacktestSignalSnapshot["direction"];
  heldCandles: readonly Candle[];
  ema20ByHeldCandle: readonly (number | null)[];
  stopReference: number;
}>): H13ExitPlan | null {
  if (!finite(input.stopReference) || input.stopReference <= 0 || input.heldCandles.length !== 48) return null;
  if (!validateEmaHistory(input.ema20ByHeldCandle)) return null;
  for (let index = 0; index < 48; index += 1) {
    const candle = input.heldCandles[index]!;
    const step: H13ExitStepResult = evaluateH13ExitStep({
      direction: input.direction,
      heldCandleNumber: index + 1,
      candle,
      ema20: index < 47 ? input.ema20ByHeldCandle[index]! : 0,
      stopReference: input.stopReference,
    });
    if (step.action === "SL") {
      return Object.freeze({
        exitReason: "SL",
        heldCandleNumber: index + 1,
        exitCandle: candle,
        rawExitPrice: input.stopReference,
        exitTime: candle.closeTime,
        trendTriggerHeldCandleNumber: null,
        trendTriggerClose: null,
        trendTriggerEma20: null,
      });
    }
    if (step.action === "TREND_EXIT_TRIGGER") {
      const nextCandle = input.heldCandles[index + 1];
      const resolution = nextCandle
        ? resolveH13TrendExitAtNextOpen({ triggerHeldCandleNumber: index + 1, nextCandle })
        : null;
      if (!resolution) return null;
      return Object.freeze({
        exitReason: "TREND_EXIT",
        heldCandleNumber: resolution.heldCandleNumber,
        exitCandle: nextCandle!,
        rawExitPrice: resolution.rawExitPrice,
        exitTime: resolution.exitTime,
        trendTriggerHeldCandleNumber: index + 1,
        trendTriggerClose: candle.close,
        trendTriggerEma20: input.ema20ByHeldCandle[index]!,
      });
    }
  }
  const last = input.heldCandles[47]!;
  return Object.freeze({
    exitReason: "TIME_EXIT",
    heldCandleNumber: 48,
    exitCandle: last,
    rawExitPrice: last.close,
    exitTime: last.closeTime,
    trendTriggerHeldCandleNumber: null,
    trendTriggerClose: null,
    trendTriggerEma20: null,
  });
}

function findStopMinute(
  window: HistoricalIntrabarSettlementWindow,
  direction: BacktestSignalSnapshot["direction"],
  stopReference: number,
): Readonly<{ openTime: number; closeTime: number }> | null {
  const minute = window.candles.find((candle) =>
    direction === "LONG" ? candle.low <= stopReference : candle.high >= stopReference,
  );
  return minute ? Object.freeze({ openTime: minute.openTime, closeTime: minute.closeTime }) : null;
}

function resolveWindow(
  input: H13SettlementInput,
  plan: H13ExitPlan,
): Readonly<{ window?: HistoricalIntrabarSettlementWindow; exitMinute?: Readonly<{ openTime: number; closeTime: number }>; error?: string }> {
  const requiresIntrabar = requiresIntrabarFundingResolution({
    funding: input.funding,
    entryTime: input.heldCandles[0]!.openTime,
    exitReason: "SL",
    exitCandle: plan.exitCandle,
  });
  if (plan.exitReason !== "SL" || !requiresIntrabar) return Object.freeze({});
  const expectedSettlementOnly = isIntrabarSettlementOnly(input.period, plan.exitCandle);
  const window = input.intrabarSettlementWindows?.find(
    (candidate) => candidate.symbol === input.snapshot.symbol && candidate.exitCandleOpenTime === plan.exitCandle.openTime,
  );
  if (!window || window.settlementOnly !== expectedSettlementOnly || input.serverTime === undefined) {
    return Object.freeze({ error: "Required H13 SL intrabar settlement window is missing." });
  }
  try {
    const candles = validateIntrabarSettlementWindow(window.candles, {
      symbol: input.snapshot.symbol,
      exitCandleOpenTime: plan.exitCandle.openTime,
      exitCandleCloseTime: plan.exitCandle.closeTime,
      serverTime: input.serverTime,
    });
    const validatedWindow = Object.freeze({ ...window, candles });
    const exitMinute = findStopMinute(validatedWindow, input.snapshot.direction, input.snapshot.stopReference);
    return exitMinute
      ? Object.freeze({ window: validatedWindow, exitMinute })
      : Object.freeze({ error: "No 1m candle reproduces the frozen H13 SL exit." });
  } catch (error) {
    return Object.freeze({ error: error instanceof Error ? error.message : "H13 intrabar data is invalid." });
  }
}

export function settleH13Signal(input: H13SettlementInput): H13RawResult {
  const decisionAudit: H13DecisionAudit = Object.freeze({
    baselineCandidateSnapshot: input.snapshot,
    originalTakeProfitReference: input.snapshot.takeProfitReference,
  });
  if (!positive(input.snapshot.stopDistance) || !positive(input.snapshot.stopReference)) {
    return emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, "Original baseline stop geometry is invalid.");
  }
  if (!validHeldCandleSequence(input.signalCandle, input.heldCandles)) {
    return emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, "Exactly 48 contiguous held candles are required for H13.");
  }
  if (input.period === "DEV" && input.heldCandles[47]!.closeTime > input.periodEndTime) {
    return emptyResult(input.snapshot, "PERIOD_END_CENSORED", decisionAudit, "The H13 held-48 close crosses the frozen DEV end.");
  }
  const rawEntryPrice = input.heldCandles[0]!.open;
  const entryFill = input.snapshot.direction === "LONG"
    ? rawEntryPrice * (1 + BACKTEST_POLICY.slippageRate)
    : rawEntryPrice * (1 - BACKTEST_POLICY.slippageRate);
  const entryTime = input.heldCandles[0]!.openTime;
  if (!positive(rawEntryPrice) || !positive(entryFill)) {
    return Object.freeze({ ...emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, "H13 next-open entry is invalid."), entryTime, rawEntryPrice, entryFill });
  }
  const protectiveStopValid = input.snapshot.direction === "LONG"
    ? entryFill > input.snapshot.stopReference
    : entryFill < input.snapshot.stopReference;
  if (!protectiveStopValid) {
    return Object.freeze({
      ...emptyResult(input.snapshot, "ENTRY_OUTSIDE_PROTECTIVE_STOP", decisionAudit, "The adverse next-open entry fill is not beyond the protective stop."),
      entryTime,
      rawEntryPrice,
      entryFill,
    });
  }
  const plan = planH13Exit({
    direction: input.snapshot.direction,
    heldCandles: input.heldCandles,
    ema20ByHeldCandle: input.ema20ByHeldCandle,
    stopReference: input.snapshot.stopReference,
  });
  if (!plan) {
    return Object.freeze({ ...emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, "H13 EMA history or exit plan is incomplete."), entryTime, rawEntryPrice, entryFill });
  }
  const windowResult = resolveWindow(input, plan);
  if (windowResult.error) {
    return Object.freeze({ ...emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, windowResult.error), entryTime, rawEntryPrice, entryFill });
  }
  try {
    validateFundingRecords(input.funding, { symbol: input.snapshot.symbol, policy: "bt-policy-003" });
  } catch (error) {
    return Object.freeze({ ...emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, error instanceof Error ? error.message : "H13 funding data is invalid."), entryTime, rawEntryPrice, entryFill });
  }
  if (input.funding.length === 0) {
    return Object.freeze({ ...emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, "H13 funding coverage is missing."), entryTime, rawEntryPrice, entryFill });
  }
  let fundingResolution;
  try {
    fundingResolution = resolveFundingCharges({
      funding: input.funding,
      entryTime,
      exitReason: plan.exitReason === "SL" ? "SL" : "TIME_EXIT",
      exitCandle: plan.exitCandle,
      exitTime: plan.exitTime,
      direction: input.snapshot.direction,
      policy: "bt-policy-003",
      markPriceCandles: input.markPriceCandles,
      markPriceSegments: input.markPriceSegments,
      markPriceBaseEndTime: input.periodEndTime,
      ...(windowResult.exitMinute ? { exitMinute: windowResult.exitMinute } : {}),
    });
  } catch (error) {
    return Object.freeze({ ...emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, error instanceof Error ? error.message : "H13 funding calculation failed."), entryTime, rawEntryPrice, entryFill });
  }
  if (fundingResolution.ambiguous) {
    return Object.freeze({
      ...emptyResult(input.snapshot, "SETTLEMENT_AMBIGUOUS", decisionAudit, "H13 funding order remains ambiguous."),
      entryTime,
      rawEntryPrice,
      entryFill,
    });
  }
  const exitFill = input.snapshot.direction === "LONG"
    ? plan.rawExitPrice * (1 - BACKTEST_POLICY.slippageRate)
    : plan.rawExitPrice * (1 + BACKTEST_POLICY.slippageRate);
  const fundingPnL = fundingResolution.charges.reduce((sum, charge) => sum + charge.fundingPnL, 0);
  const priceR = input.snapshot.direction === "LONG"
    ? (exitFill - entryFill) / input.snapshot.stopDistance
    : (entryFill - exitFill) / input.snapshot.stopDistance;
  const feeR = (entryFill * BACKTEST_POLICY.feeRate + exitFill * BACKTEST_POLICY.feeRate) / input.snapshot.stopDistance;
  const fundingR = fundingPnL / input.snapshot.stopDistance;
  const netR = priceR - feeR + fundingR;
  if (![exitFill, fundingPnL, priceR, feeR, fundingR, netR].every(Number.isFinite)) {
    return Object.freeze({ ...emptyResult(input.snapshot, "DATA_INCOMPLETE", decisionAudit, "H13 R normalization produced a non-finite value."), entryTime, rawEntryPrice, entryFill });
  }
  const settlementAudit: H13SettlementOutcomeAudit = Object.freeze({
    exitReason: plan.exitReason,
    trendTriggerHeldCandleNumber: plan.trendTriggerHeldCandleNumber,
    heldCandleNumber: plan.heldCandleNumber,
    trendTriggerClose: plan.trendTriggerClose,
    trendTriggerEma20: plan.trendTriggerHeldCandleNumber === null ? null : input.ema20ByHeldCandle[plan.trendTriggerHeldCandleNumber - 1] ?? null,
    rawExitPrice: plan.rawExitPrice,
    exitFill,
    exitTime: plan.exitTime,
    originalStopDistance: input.snapshot.stopDistance,
  });
  return Object.freeze({
    snapshot: input.snapshot,
    status: "EXECUTED",
    entryTime,
    rawEntryPrice,
    entryFill,
    exitTime: plan.exitTime,
    rawExitPrice: plan.rawExitPrice,
    exitFill,
    heldCandleNumber: plan.heldCandleNumber,
    exitReason: plan.exitReason,
    fundingCharges: fundingResolution.charges,
    fundingPnL,
    priceR,
    feeR,
    fundingR,
    grossR: priceR,
    netR,
    decisionAudit,
    settlementAudit,
  });
}

export function h13RawStatusToResearchStatus(status: M3R4H13RawStatus): "EXECUTED" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED" | "NOT_EXECUTED" | "SETTLEMENT_AMBIGUOUS" {
  if (status === "ENTRY_OUTSIDE_PROTECTIVE_STOP") return "NOT_EXECUTED";
  return status;
}
