import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { BACKTEST_POLICY } from "../backtest/constants.ts";
import type { Candle } from "../market-data/types.ts";
import { RESEARCH_FOLD_IDS, type ResearchFoldId } from "./constants.ts";
import { RESEARCH_FOLDS } from "./folds.ts";

export const M3_R6_RESEARCH_ROUND_ID = "baseline-002-research-round-006" as const;
export const M3_R6_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R6_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const M3_R6_RESEARCH_RANGE = Object.freeze({
  startTime: Date.parse(M3_R6_RESEARCH_START_ISO),
  endTime: Date.parse(M3_R6_RESEARCH_END_ISO),
  classification: "RESEARCH_AVAILABLE_SEEN_DATA",
} as const);
export const M3_R6_PROTOCOL_VERSION = "m3-r6-b1a-protocol-001" as const;
export const M3_R6_PERFORMANCE_LOCK = "FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R6_POST_LOCK_INVALIDATION = "ROUND_006_INVALIDATION_REQUIRED" as const;

export const R6_SYMBOLS = RESEARCH_SYMBOLS;
export const R6_FROZEN_FOLD_IDS = Object.freeze([...RESEARCH_FOLD_IDS]) as readonly ResearchFoldId[];
export const R6_FROZEN_FOLDS = RESEARCH_FOLDS;

const HOUR_MS = 60 * 60 * 1000;
const FOUR_HOUR_MS = 4 * HOUR_MS;

export type R6Direction = "LONG" | "SHORT";
export type R6HypothesisId =
  | "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH"
  | "R6-H20-STRUCTURAL-TREND-CONTINUATION"
  | "R6-H21-ECONOMIC-RANGE-IMPULSE"
  | "R6-H22-PREDECLARED-REGIME-ROUTING";
export type R6MechanismFamily =
  | "CROSS_SECTIONAL_RELATIVE_STRENGTH"
  | "STRUCTURAL_TREND_CONTINUATION"
  | "ECONOMIC_RANGE_IMPULSE"
  | "PREDECLARED_REGIME_ROUTING";
export type R6CandidateId = R6HypothesisId;
export type R6StopReference =
  | "SIGNAL_CANDLE_OPPOSITE_EXTREME"
  | "H20_RETRACEMENT_EXTREME";

export type R6ComplexityTuple = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

export type R6CandidateSignal = Readonly<{
  candidateId: R6CandidateId;
  hypothesisId: R6HypothesisId;
  mechanismFamily: R6MechanismFamily;
  symbol: ResearchSymbol;
  direction: R6Direction;
  signalTime: number;
  stopReference: R6StopReference;
  stopReferencePrice: number;
  takeProfitR: 2;
  maxHeldCandles: 24;
  internalRoute?: "INTERNAL_DIRECTIONAL_CONTINUATION";
}>;

export type R6CandidateEvaluation = Readonly<{
  status: "SIGNALS" | "NO_SIGNAL" | "DATA_INCOMPLETE";
  signals: readonly R6CandidateSignal[];
  reason?: string;
}>;

export type R6EntryResolution =
  | Readonly<{
      status: "READY";
      signal: R6CandidateSignal;
      entryOpenTime: number;
      rawEntryPrice: number;
    }>
  | Readonly<{
      status: "ENTRY_UNAVAILABLE" | "PERIOD_END_CENSORED";
      signal: R6CandidateSignal;
      reason: string;
      entryOpenTime?: number;
    }>;

export type R6SymbolCandleInput = Readonly<{
  symbol: ResearchSymbol;
  candles1h: readonly Candle[];
}>;

export const R6_H19_PARAMETERS = Object.freeze({
  decisionCadence: "ONE_DECISION_PER_4H_UTC_BLOCK",
  returnLookbackClosed1hCandles: 24,
  leaderSelection: "MAX_RETURN_THEN_SYMBOL_ASCENDING",
  laggardSelection: "MIN_RETURN_THEN_SYMBOL_DESCENDING",
  tieHandling: "LEADER_IS_FIRST_ASCENDING_SYMBOL;LAGGARD_IS_LAST_ASCENDING_SYMBOL",
  missingSymbolBehavior: "DATA_INCOMPLETE",
  signalMultiplicity: "ONE_LONG_LEADER_AND_ONE_SHORT_LAGGARD_PER_TIMESTAMP",
} as const);

export const R6_H20_PARAMETERS = Object.freeze({
  structuralTrendBars4h: 3,
  retracementBars1h: 2,
  confirmationBars1h: 1,
  trendRule: "STRICTLY_MONOTONIC_HIGH_AND_LOW_SEQUENCE",
  retracementRule: "TWO_CLOSED_MONOTONIC_COUNTER_TREND_CLOSES_ABOVE_OR_BELOW_STRUCTURAL_ANCHOR",
  confirmationRule: "CURRENT_CLOSED_1H_CLOSE_CROSSES_BOTH_RETRACEMENT_HIGHS_OR_LOWS",
} as const);

export const R6_H21_PARAMETERS = Object.freeze({
  closeLocationFraction: 0.75,
  moveToCostMultiple: 8,
  rangeFormula: "(high - low) / open",
  directionFormula: "LONG_IF_close_gt_open;SHORT_IF_close_lt_open;EQUAL_IS_NO_SIGNAL",
  unifiedEvent: "CLOSED_CANDLE_RANGE_AND_CLOSE_LOCATION_PASS_TOGETHER",
} as const);

export type R6H22Regime = "UP_REGIME" | "DOWN_REGIME" | "BALANCED" | "INACTIVE";
export type R6H22InternalRoute = "INTERNAL_DIRECTIONAL_CONTINUATION" | "NO_TRADE";

export const R6_H22_PARAMETERS = Object.freeze({
  classifierWindow4h: 3,
  upRule: "ALL_THREE_CLOSED_4H_CLOSES_GREATER_THAN_OPENS",
  downRule: "ALL_THREE_CLOSED_4H_CLOSES_LESS_THAN_OPENS",
  tieRule: "ANY_EQUAL_OPEN_CLOSE_OR_MIXED_DIRECTION_IS_BALANCED",
  fallbackRule: "INSUFFICIENT_DATA_IS_INACTIVE_AND_DATA_INCOMPLETE",
  internalSignalRule: "CURRENT_CLOSED_1H_CLOSE_CROSSES_PRIOR_1H_EXTREME_IN_CLASSIFIED_DIRECTION",
} as const);

export const R6_H22_ROUTE_MAP: Readonly<Record<R6H22Regime, R6H22InternalRoute>> = Object.freeze({
  UP_REGIME: "INTERNAL_DIRECTIONAL_CONTINUATION",
  DOWN_REGIME: "INTERNAL_DIRECTIONAL_CONTINUATION",
  BALANCED: "NO_TRADE",
  INACTIVE: "NO_TRADE",
});

export const R6_EXECUTION_CONTRACTS = Object.freeze({
  common: Object.freeze({
    backtestPolicyVersion: "bt-policy-003",
    entry: "FIRST_1H_OPEN_STRICTLY_AFTER_SIGNAL_TIME",
    feeRate: BACKTEST_POLICY.feeRate,
    slippageRate: BACKTEST_POLICY.slippageRate,
    funding: "OFFICIAL_FUNDING_WITH_FROZEN_MARK_PRICE_FALLBACK",
    settlement: "SL_FIRST_INTRABAR_ORDERING",
    timeExit: "CLOSE_OF_HELD_CANDLE_24",
    heldCandleCount: BACKTEST_POLICY.heldCandleCount,
  }),
  "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH": Object.freeze({
    stop: "SIGNAL_CANDLE_OPPOSITE_EXTREME",
    takeProfit: "EXACTLY_2R",
    maxHeldCandles: 24,
  }),
  "R6-H20-STRUCTURAL-TREND-CONTINUATION": Object.freeze({
    stop: "H20_RETRACEMENT_EXTREME",
    takeProfit: "EXACTLY_2R",
    maxHeldCandles: 24,
  }),
  "R6-H21-ECONOMIC-RANGE-IMPULSE": Object.freeze({
    stop: "SIGNAL_CANDLE_OPPOSITE_EXTREME",
    takeProfit: "EXACTLY_2R",
    maxHeldCandles: 24,
  }),
  "R6-H22-PREDECLARED-REGIME-ROUTING": Object.freeze({
    stop: "SIGNAL_CANDLE_OPPOSITE_EXTREME",
    takeProfit: "EXACTLY_2R",
    maxHeldCandles: 24,
  }),
} as const);

export const R6_COMPLEXITY_TUPLES: Readonly<Record<R6CandidateId, R6ComplexityTuple>> = Object.freeze({
  "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH": Object.freeze({ newRules: 6, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 }),
  "R6-H20-STRUCTURAL-TREND-CONTINUATION": Object.freeze({ newRules: 8, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 }),
  "R6-H21-ECONOMIC-RANGE-IMPULSE": Object.freeze({ newRules: 5, newTunableThresholds: 2, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 }),
  "R6-H22-PREDECLARED-REGIME-ROUTING": Object.freeze({ newRules: 7, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 }),
});

export const R6_CANDIDATE_REGISTRY = Object.freeze([
  Object.freeze({ candidateId: "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH", mechanismFamily: "CROSS_SECTIONAL_RELATIVE_STRENGTH", variantCount: 1, complexity: R6_COMPLEXITY_TUPLES["R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH"] }),
  Object.freeze({ candidateId: "R6-H20-STRUCTURAL-TREND-CONTINUATION", mechanismFamily: "STRUCTURAL_TREND_CONTINUATION", variantCount: 1, complexity: R6_COMPLEXITY_TUPLES["R6-H20-STRUCTURAL-TREND-CONTINUATION"] }),
  Object.freeze({ candidateId: "R6-H21-ECONOMIC-RANGE-IMPULSE", mechanismFamily: "ECONOMIC_RANGE_IMPULSE", variantCount: 1, complexity: R6_COMPLEXITY_TUPLES["R6-H21-ECONOMIC-RANGE-IMPULSE"] }),
  Object.freeze({ candidateId: "R6-H22-PREDECLARED-REGIME-ROUTING", mechanismFamily: "PREDECLARED_REGIME_ROUTING", variantCount: 1, complexity: R6_COMPLEXITY_TUPLES["R6-H22-PREDECLARED-REGIME-ROUTING"] }),
] as const);

export const R6_REQUIRED_CANDLE_FIELDS = Object.freeze([
  "symbol", "timeframe", "openTime", "closeTime", "open", "high", "low", "close",
  "volume", "quoteVolume", "tradeCount", "takerBuyBaseVolume", "takerBuyQuoteVolume",
] as const);

export const R6_DATA_CONTRACT = Object.freeze({
  common: Object.freeze({
    fields: R6_REQUIRED_CANDLE_FIELDS,
    timestamp: "UTC_MILLISECONDS;signalTime_IS_CLOSED_CANDLE_CLOSE_TIME",
    missingData: "DATA_INCOMPLETE",
    futureData: "IGNORED_BEYOND_DECISION_TIME_AND_NEVER_USED_FOR_SIGNAL_FORMATION",
  }),
  h19: Object.freeze({ timeframes: ["1h"], symbols: R6_SYMBOLS, required: "25_CLOSED_1H_CANDLES_PER_SYMBOL_AT_ONE_SYNCHRONIZED_DECISION_TIME" }),
  h20: Object.freeze({ timeframes: ["1h", "4h"], required: "4_CLOSED_1H_CANDLES_AND_3_CLOSED_4H_STRUCTURAL_CANDLES" }),
  h21: Object.freeze({ timeframes: ["1h"], required: "ONE_CLOSED_1H_CANDLE_AT_DECISION_TIME" }),
  h22: Object.freeze({ timeframes: ["1h", "4h"], required: "TWO_CLOSED_1H_CANDLES_AND_3_CLOSED_4H_REGIME_CANDLES" }),
} as const);

export const R6_FORMULA_DEFINITIONS = Object.freeze({
  h19: Object.freeze({
    return: "return_s = close_s(t) / close_s(t-24_closed_1h) - 1",
    leader: "argmax(return_s, tie=symbol_ASC)",
    laggard: "last(argmax(return_s, tie=symbol_ASC))",
    cadence: "current_1h.openTime mod 4h == 0",
  }),
  h20: Object.freeze({
    longTrend: "h[-3].high < h[-2].high < h[-1].high AND h[-3].low < h[-2].low < h[-1].low",
    shortTrend: "h[-3].high > h[-2].high > h[-1].high AND h[-3].low > h[-2].low > h[-1].low",
    longRetracement: "c[-3].close <= c[-4].close AND c[-2].close <= c[-3].close AND c[-3].low,c[-2].low > h[-3].low",
    shortRetracement: "c[-3].close >= c[-4].close AND c[-2].close >= c[-3].close AND c[-3].high,c[-2].high < h[-3].high",
    longConfirmation: "c[-1].close > max(c[-3].high,c[-2].high) AND c[-1].close > c[-1].open",
    shortConfirmation: "c[-1].close < min(c[-3].low,c[-2].low) AND c[-1].close < c[-1].open",
  }),
  h21: Object.freeze({
    event: "rangeFraction >= 8 * (2*feeRate + 2*slippageRate) AND closeLocation >= 0.75 AND direction != null",
    rangeFraction: "(high - low) / open",
    longCloseLocation: "(close - low) / (high - low)",
    shortCloseLocation: "(high - close) / (high - low)",
  }),
  h22: Object.freeze({
    upRegime: "all(last3_4h, close > open)",
    downRegime: "all(last3_4h, close < open)",
    balanced: "otherwise_with_complete_data",
    longRoute: "UP_REGIME AND current_1h.close > prior_1h.high AND current_1h.close > current_1h.open",
    shortRoute: "DOWN_REGIME AND current_1h.close < prior_1h.low AND current_1h.close < current_1h.open",
  }),
} as const);

export const R6_GATE_INHERITANCE = Object.freeze({
  inheritedFrom: "ACCEPTED_ROUND_005_GATE_SEMANTICS_NO_WEAKER",
  numericValues: "DEFERRED_TO_B1B;NO_GATE_SHA_CREATED_IN_B1A",
  requiredGateNames: Object.freeze([
    "minimumAggregateImprovement",
    "minimumImprovedValidationFolds",
    "catastrophicFoldLimit",
    "minimumNetExpectancy",
    "minimumProfitFactor",
    "maximumSymbolConcentration",
    "maximumSingleTradeConcentration",
    "maximumFeeBurdenRatio",
    "minimumFormalSignals",
    "minimumExecutedTrades",
  ]),
} as const);

export const R6_PROTOCOL_MACHINE_RECORD = Object.freeze({
  protocolVersion: M3_R6_PROTOCOL_VERSION,
  researchRoundId: M3_R6_RESEARCH_ROUND_ID,
  researchRange: M3_R6_RESEARCH_RANGE,
  symbolUniverse: R6_SYMBOLS,
  foldIds: R6_FROZEN_FOLD_IDS,
  candidateRegistry: R6_CANDIDATE_REGISTRY,
  formulas: R6_FORMULA_DEFINITIONS,
  dataContract: R6_DATA_CONTRACT,
  executionContracts: R6_EXECUTION_CONTRACTS,
  complexityTuples: R6_COMPLEXITY_TUPLES,
  gateInheritance: R6_GATE_INHERITANCE,
  performanceLock: M3_R6_PERFORMANCE_LOCK,
  postLockChangeAction: M3_R6_POST_LOCK_INVALIDATION,
  baseline002Status: "NOT_FROZEN",
  m3R6B1BStatus: "NOT_STARTED",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
} as const);

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function finitePositive(value: number): boolean {
  return finite(value) && value > 0;
}

function safeTimestamp(value: number): boolean {
  return Number.isSafeInteger(value);
}

function validDecisionTime(decisionTime: number): boolean {
  return safeTimestamp(decisionTime)
    && decisionTime >= M3_R6_RESEARCH_RANGE.startTime
    && decisionTime <= M3_R6_RESEARCH_RANGE.endTime;
}

function validCandle(candle: Candle, symbol: ResearchSymbol, timeframe: "1h" | "4h"): boolean {
  return candle.symbol === symbol
    && candle.timeframe === timeframe
    && safeTimestamp(candle.openTime)
    && safeTimestamp(candle.closeTime)
    && candle.closeTime >= candle.openTime
    && finitePositive(candle.open)
    && finitePositive(candle.high)
    && finitePositive(candle.low)
    && finitePositive(candle.close)
    && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close)
    && candle.high >= candle.low;
}

function closedSeries(
  candles: readonly Candle[],
  symbol: ResearchSymbol,
  timeframe: "1h" | "4h",
  decisionTime: number,
): readonly Candle[] | null {
  const closed = candles.filter((candle) => candle.symbol === symbol && candle.timeframe === timeframe && candle.closeTime <= decisionTime);
  if (closed.length === 0 || !closed.every((candle) => validCandle(candle, symbol, timeframe))) return null;
  for (let index = 1; index < closed.length; index += 1) {
    if (closed[index - 1]!.openTime >= closed[index]!.openTime || closed[index - 1]!.closeTime >= closed[index]!.closeTime) return null;
  }
  return closed;
}

function current1h(input: Readonly<{ symbol: ResearchSymbol; candles1h: readonly Candle[]; decisionTime: number }>):
  | Readonly<{ series: readonly Candle[]; current: Candle }>
  | null {
  if (!validDecisionTime(input.decisionTime)) return null;
  const series = closedSeries(input.candles1h, input.symbol, "1h", input.decisionTime);
  const current = series?.at(-1);
  if (!series || !current || current.closeTime !== input.decisionTime) return null;
  return { series, current };
}

function incomplete(reason: string): R6CandidateEvaluation {
  return Object.freeze({ status: "DATA_INCOMPLETE", signals: Object.freeze([]), reason });
}

function noSignal(reason: string): R6CandidateEvaluation {
  return Object.freeze({ status: "NO_SIGNAL", signals: Object.freeze([]), reason });
}

function signals(signalsValue: readonly R6CandidateSignal[]): R6CandidateEvaluation {
  return Object.freeze({ status: "SIGNALS", signals: Object.freeze([...signalsValue]) });
}

function makeSignal(input: Omit<R6CandidateSignal, "takeProfitR" | "maxHeldCandles">): R6CandidateSignal {
  return Object.freeze({ ...input, takeProfitR: 2 as const, maxHeldCandles: 24 as const });
}

export function makeR6CandidateIdentity(input: Readonly<Pick<R6CandidateSignal, "symbol" | "direction" | "signalTime">>): string {
  return `${input.symbol}|${input.direction}|${input.signalTime}`;
}

function fullUniverse(inputs: readonly R6SymbolCandleInput[]): boolean {
  if (inputs.length !== R6_SYMBOLS.length) return false;
  const symbols = new Set(inputs.map((input) => input.symbol));
  return symbols.size === R6_SYMBOLS.length && R6_SYMBOLS.every((symbol) => symbols.has(symbol));
}

export function evaluateR6H19(input: Readonly<{
  decisionTime: number;
  snapshots: readonly R6SymbolCandleInput[];
}>): R6CandidateEvaluation {
  if (!validDecisionTime(input.decisionTime) || !fullUniverse(input.snapshots)) return incomplete("SYNCHRONIZED_FIVE_SYMBOL_INPUT_REQUIRED");
  const observations: Array<{ symbol: ResearchSymbol; returnValue: number; current: Candle }> = [];
  for (const snapshot of input.snapshots) {
    const currentInput = current1h({ ...snapshot, decisionTime: input.decisionTime });
    if (!currentInput || currentInput.series.length < R6_H19_PARAMETERS.returnLookbackClosed1hCandles + 1) return incomplete("H19_RETURN_LOOKBACK_UNAVAILABLE");
    const lookback = currentInput.series.at(-(R6_H19_PARAMETERS.returnLookbackClosed1hCandles + 1));
    if (!lookback || !finitePositive(lookback.close) || !finitePositive(currentInput.current.close)) return incomplete("H19_RETURN_INPUT_INVALID");
    const returnValue = currentInput.current.close / lookback.close - 1;
    if (!finite(returnValue)) return incomplete("H19_RETURN_NONFINITE");
    if (currentInput.current.openTime % FOUR_HOUR_MS !== 0) return noSignal("H19_CADENCE_NOT_DUE");
    observations.push({ symbol: snapshot.symbol, returnValue, current: currentInput.current });
  }
  const ordered = observations.slice().sort((left, right) => right.returnValue - left.returnValue || left.symbol.localeCompare(right.symbol));
  const leader = ordered[0];
  const laggard = ordered.at(-1);
  if (!leader || !laggard || leader.symbol === laggard.symbol) return noSignal("H19_LEADER_LAGGARD_NOT_DISTINCT");
  return signals([
    makeSignal({
      candidateId: "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
      hypothesisId: "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
      mechanismFamily: "CROSS_SECTIONAL_RELATIVE_STRENGTH",
      symbol: leader.symbol,
      direction: "LONG",
      signalTime: leader.current.closeTime,
      stopReference: "SIGNAL_CANDLE_OPPOSITE_EXTREME",
      stopReferencePrice: leader.current.low,
    }),
    makeSignal({
      candidateId: "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
      hypothesisId: "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
      mechanismFamily: "CROSS_SECTIONAL_RELATIVE_STRENGTH",
      symbol: laggard.symbol,
      direction: "SHORT",
      signalTime: laggard.current.closeTime,
      stopReference: "SIGNAL_CANDLE_OPPOSITE_EXTREME",
      stopReferencePrice: laggard.current.high,
    }),
  ]);
}

function h20TrendDirection(candles: readonly Candle[]): R6Direction | null {
  const first = candles.at(-3);
  const second = candles.at(-2);
  const third = candles.at(-1);
  if (!first || !second || !third) return null;
  if (first.high < second.high && second.high < third.high && first.low < second.low && second.low < third.low) return "LONG";
  if (first.high > second.high && second.high > third.high && first.low > second.low && second.low > third.low) return "SHORT";
  return null;
}

export function evaluateR6H20(input: Readonly<{
  symbol: ResearchSymbol;
  candles1h: readonly Candle[];
  candles4h: readonly Candle[];
  decisionTime: number;
}>): R6CandidateEvaluation {
  const currentInput = current1h(input);
  if (!currentInput || currentInput.series.length < 4) return incomplete("H20_1H_STRUCTURE_UNAVAILABLE");
  const higherTimeframe = closedSeries(input.candles4h, input.symbol, "4h", input.decisionTime);
  if (!higherTimeframe || higherTimeframe.length < R6_H20_PARAMETERS.structuralTrendBars4h) return incomplete("H20_4H_STRUCTURE_UNAVAILABLE");
  const direction = h20TrendDirection(higherTimeframe);
  if (!direction) return noSignal("H20_STRUCTURAL_TREND_NOT_SATISFIED");
  const window = currentInput.series.slice(-4);
  const leg = window[0]!;
  const retracementOne = window[1]!;
  const retracementTwo = window[2]!;
  const confirmation = window[3]!;
  const anchor = higherTimeframe.at(-3)!;
  const retracement = direction === "LONG"
    ? retracementOne.close <= leg.close && retracementTwo.close <= retracementOne.close
      && retracementOne.low > anchor.low && retracementTwo.low > anchor.low
    : retracementOne.close >= leg.close && retracementTwo.close >= retracementOne.close
      && retracementOne.high < anchor.high && retracementTwo.high < anchor.high;
  if (!retracement) return noSignal("H20_CONTROLLED_RETRACEMENT_NOT_SATISFIED");
  const confirmed = direction === "LONG"
    ? confirmation.close > Math.max(retracementOne.high, retracementTwo.high) && confirmation.close > confirmation.open
    : confirmation.close < Math.min(retracementOne.low, retracementTwo.low) && confirmation.close < confirmation.open;
  if (!confirmed) return noSignal("H20_STRUCTURAL_CONTINUATION_NOT_CONFIRMED");
  const stopReferencePrice = direction === "LONG"
    ? Math.min(retracementOne.low, retracementTwo.low)
    : Math.max(retracementOne.high, retracementTwo.high);
  return signals([makeSignal({
    candidateId: "R6-H20-STRUCTURAL-TREND-CONTINUATION",
    hypothesisId: "R6-H20-STRUCTURAL-TREND-CONTINUATION",
    mechanismFamily: "STRUCTURAL_TREND_CONTINUATION",
    symbol: input.symbol,
    direction,
    signalTime: confirmation.closeTime,
    stopReference: "H20_RETRACEMENT_EXTREME",
    stopReferencePrice,
  })]);
}

export function evaluateR6H21(input: Readonly<{
  symbol: ResearchSymbol;
  candles1h: readonly Candle[];
  decisionTime: number;
}>): R6CandidateEvaluation {
  const currentInput = current1h(input);
  if (!currentInput) return incomplete("H21_DECISION_CANDLE_UNAVAILABLE");
  const current = currentInput.current;
  const range = current.high - current.low;
  if (!finitePositive(range)) return incomplete("H21_RANGE_INVALID");
  const rangeFraction = range / current.open;
  const roundTripCostRate = 2 * BACKTEST_POLICY.feeRate + 2 * BACKTEST_POLICY.slippageRate;
  const minimumRangeFraction = R6_H21_PARAMETERS.moveToCostMultiple * roundTripCostRate;
  const direction: R6Direction | null = current.close > current.open ? "LONG" : current.close < current.open ? "SHORT" : null;
  const closeLocation = direction === "LONG"
    ? (current.close - current.low) / range
    : direction === "SHORT"
      ? (current.high - current.close) / range
      : null;
  if (direction === null || closeLocation === null || rangeFraction < minimumRangeFraction || closeLocation < R6_H21_PARAMETERS.closeLocationFraction) return noSignal("H21_UNIFIED_RANGE_IMPULSE_NOT_SATISFIED");
  return signals([makeSignal({
    candidateId: "R6-H21-ECONOMIC-RANGE-IMPULSE",
    hypothesisId: "R6-H21-ECONOMIC-RANGE-IMPULSE",
    mechanismFamily: "ECONOMIC_RANGE_IMPULSE",
    symbol: input.symbol,
    direction,
    signalTime: current.closeTime,
    stopReference: "SIGNAL_CANDLE_OPPOSITE_EXTREME",
    stopReferencePrice: direction === "LONG" ? current.low : current.high,
  })]);
}

export function classifyR6H22Regime(candles4h: readonly Candle[], symbol: ResearchSymbol, decisionTime: number): R6H22Regime {
  const closed = closedSeries(candles4h, symbol, "4h", decisionTime);
  if (!closed || closed.length < R6_H22_PARAMETERS.classifierWindow4h) return "INACTIVE";
  const window = closed.slice(-R6_H22_PARAMETERS.classifierWindow4h);
  if (window.every((candle) => candle.close > candle.open)) return "UP_REGIME";
  if (window.every((candle) => candle.close < candle.open)) return "DOWN_REGIME";
  return "BALANCED";
}

export function evaluateR6H22(input: Readonly<{
  symbol: ResearchSymbol;
  candles1h: readonly Candle[];
  candles4h: readonly Candle[];
  decisionTime: number;
}>): R6CandidateEvaluation {
  const currentInput = current1h(input);
  if (!currentInput || currentInput.series.length < 2) return incomplete("H22_1H_INPUT_UNAVAILABLE");
  const regime = classifyR6H22Regime(input.candles4h, input.symbol, input.decisionTime);
  if (regime === "INACTIVE") return incomplete("H22_REGIME_INPUT_UNAVAILABLE");
  const current = currentInput.current;
  const prior = currentInput.series.at(-2)!;
  const direction: R6Direction | null = regime === "UP_REGIME" ? "LONG" : regime === "DOWN_REGIME" ? "SHORT" : null;
  if (direction === null) return noSignal("H22_BALANCED_REGIME_NO_TRADE");
  const confirmed = direction === "LONG"
    ? current.close > prior.high && current.close > current.open
    : current.close < prior.low && current.close < current.open;
  if (!confirmed) return noSignal("H22_INTERNAL_ROUTE_NOT_TRIGGERED");
  return signals([makeSignal({
    candidateId: "R6-H22-PREDECLARED-REGIME-ROUTING",
    hypothesisId: "R6-H22-PREDECLARED-REGIME-ROUTING",
    mechanismFamily: "PREDECLARED_REGIME_ROUTING",
    symbol: input.symbol,
    direction,
    signalTime: current.closeTime,
    stopReference: "SIGNAL_CANDLE_OPPOSITE_EXTREME",
    stopReferencePrice: direction === "LONG" ? current.low : current.high,
    internalRoute: "INTERNAL_DIRECTIONAL_CONTINUATION",
  })]);
}

export function resolveR6NextOpenEntry(input: Readonly<{
  signal: R6CandidateSignal;
  candles1h: readonly Candle[];
  periodEndTime?: number;
}>): R6EntryResolution {
  const entry = input.candles1h.find((candle) =>
    candle.symbol === input.signal.symbol
    && candle.timeframe === "1h"
    && candle.openTime > input.signal.signalTime
    && finitePositive(candle.open)
    && safeTimestamp(candle.openTime),
  );
  if (!entry) return Object.freeze({ status: "ENTRY_UNAVAILABLE", signal: input.signal, reason: "NEXT_1H_OPEN_UNAVAILABLE" });
  if (input.periodEndTime !== undefined && entry.openTime > input.periodEndTime) {
    return Object.freeze({ status: "PERIOD_END_CENSORED", signal: input.signal, reason: "NEXT_1H_OPEN_AFTER_PERIOD_END", entryOpenTime: entry.openTime });
  }
  return Object.freeze({ status: "READY", signal: input.signal, entryOpenTime: entry.openTime, rawEntryPrice: entry.open });
}
