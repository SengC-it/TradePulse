import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { BACKTEST_POLICY } from "../backtest/constants.ts";
import { calculateAtr14 } from "../indicators/atr.ts";
import { calculateEma20, calculateEma50 } from "../indicators/ema.ts";
import { calculateRsi14 } from "../indicators/rsi.ts";
import type { Candle } from "../market-data/types.ts";

export const M3_R5_RESEARCH_ROUND_ID = "baseline-002-research-round-005" as const;
export const M3_R5_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R5_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const M3_R5_RESEARCH_RANGE = Object.freeze({
  startTime: Date.parse(M3_R5_RESEARCH_START_ISO),
  endTime: Date.parse(M3_R5_RESEARCH_END_ISO),
  startIso: M3_R5_RESEARCH_START_ISO,
  endIso: M3_R5_RESEARCH_END_ISO,
  classification: "RESEARCH_AVAILABLE_SEEN_DATA",
} as const);
export const M3_R5_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;
export const M3_R5_PROTOCOL_VERSION = "m3-r5-b1a-protocol-001" as const;
export const M3_R5_H17_CANONICAL_SLOT_MS = 8 * 60 * 60 * 1000;
const M3_R5_H17_LAST_CANONICAL_TIME = M3_R5_RESEARCH_RANGE.startTime
  + Math.floor((M3_R5_RESEARCH_RANGE.endTime - M3_R5_RESEARCH_RANGE.startTime) / M3_R5_H17_CANONICAL_SLOT_MS) * M3_R5_H17_CANONICAL_SLOT_MS;

export const R5_SYMBOLS = RESEARCH_SYMBOLS;
export type R5Direction = "LONG" | "SHORT";
export type R5HypothesisId =
  | "H15_HTF_LOW_FREQUENCY_TREND"
  | "H16_NEUTRAL_REGIME_MEAN_REVERSION"
  | "H17_FUNDING_CROWDING_REVERSAL"
  | "H18_VOLATILITY_COMPRESSION_EXPANSION";
export type R5MechanismFamily =
  | "SIGNAL_TIMEFRAME_REDESIGN"
  | "EDGE_FAMILY_REDESIGN"
  | "DERIVATIVES_POSITIONING_ALPHA"
  | "VOLATILITY_STATE_ENTRY";
export type R5CandidateId =
  | "R5-H15-HTF-TREND"
  | "R5-H16-NEUTRAL-MEAN-REVERSION"
  | "R5-H17-FUNDING-REVERSAL"
  | "R5-H18-COMPRESSION-EXPANSION";

export const R5_PROVISIONAL_CANDIDATES = Object.freeze([
  Object.freeze({
    candidateId: "R5-H15-HTF-TREND",
    hypothesisId: "H15_HTF_LOW_FREQUENCY_TREND",
    mechanismFamily: "SIGNAL_TIMEFRAME_REDESIGN",
  }),
  Object.freeze({
    candidateId: "R5-H16-NEUTRAL-MEAN-REVERSION",
    hypothesisId: "H16_NEUTRAL_REGIME_MEAN_REVERSION",
    mechanismFamily: "EDGE_FAMILY_REDESIGN",
  }),
  Object.freeze({
    candidateId: "R5-H17-FUNDING-REVERSAL",
    hypothesisId: "H17_FUNDING_CROWDING_REVERSAL",
    mechanismFamily: "DERIVATIVES_POSITIONING_ALPHA",
  }),
  Object.freeze({
    candidateId: "R5-H18-COMPRESSION-EXPANSION",
    hypothesisId: "H18_VOLATILITY_COMPRESSION_EXPANSION",
    mechanismFamily: "VOLATILITY_STATE_ENTRY",
  }),
] as const);

export const R5_EXECUTION_CONTRACTS = Object.freeze({
  h15: Object.freeze({ stopAtr: 2, takeProfitR: 3, maxHeldCandles: 48 }),
  h16: Object.freeze({ stopAtr: 1.5, takeProfitR: "FIXED_DECISION_EMA20", maxHeldCandles: 12 }),
  h17: Object.freeze({ stopAtr: 1.5, takeProfitR: 3, maxHeldCandles: 24 }),
  h18: Object.freeze({ stopAtr: 1.5, takeProfitR: 3, maxHeldCandles: 24 }),
  common: Object.freeze({ entry: "FIRST_1H_OPEN_STRICTLY_AFTER_SIGNAL_TIME", sl: "SL_FIRST", timeExit: "CLOSE_OF_HELD_CANDLE" }),
} as const);

export type R5ComplexityTuple = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

export const R5_COMPLEXITY_TUPLES: Readonly<Record<R5CandidateId, R5ComplexityTuple>> = Object.freeze({
  "R5-H15-HTF-TREND": Object.freeze({ newRules: 3, newTunableThresholds: 3, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 }),
  "R5-H16-NEUTRAL-MEAN-REVERSION": Object.freeze({ newRules: 4, newTunableThresholds: 5, modifiedBaselineRules: 4, mechanismFamiliesUsed: 1 }),
  "R5-H17-FUNDING-REVERSAL": Object.freeze({ newRules: 3, newTunableThresholds: 3, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 }),
  "R5-H18-COMPRESSION-EXPANSION": Object.freeze({ newRules: 4, newTunableThresholds: 4, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 }),
});

export const R5_FUTURE_GATE_REQUIREMENTS = Object.freeze({
  inheritedFrom: "Round-004-without-weakening",
  requiredRedundancyImprovement: "NOT_APPLICABLE",
  applicableHardGateCount: 10,
  gateNames: Object.freeze([
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

export const R5_PERFORMANCE_LOCK = "FIRST_M3_R5_PERFORMANCE_RESULT_GENERATED" as const;
export const R5_POST_LOCK_INVALIDATION = "ROUND_005_INVALIDATION_REQUIRED" as const;
export const M3_R5_PERFORMANCE_LOCK = R5_PERFORMANCE_LOCK;
export const M3_R5_POST_LOCK_INVALIDATION = R5_POST_LOCK_INVALIDATION;

export type R5Candle = Candle;
export type R5FundingDecisionRecord = Readonly<{
  symbol: ResearchSymbol;
  fundingTime: number;
  fundingRate: number;
}>;

export type R5RiskPlan = Readonly<{
  entryFill: number;
  stopPrice: number;
  stopDistance: number;
  takeProfitPrice: number;
  stopAtrMultiple: number;
  takeProfitR: number | "FIXED_DECISION_EMA20";
  maxHeldCandles: number;
}>;

export type R5CandidateSignal = Readonly<{
  candidateId: R5CandidateId;
  hypothesisId: R5HypothesisId;
  symbol: ResearchSymbol;
  direction: R5Direction;
  signalTime: number;
  decisionAtr: number;
  stopAtrMultiple: number;
  takeProfitR: number | "FIXED_DECISION_EMA20";
  maxHeldCandles: number;
  fixedTargetPrice?: number;
}>;

export type R5DecisionResult =
  | Readonly<{ status: "NO_SIGNAL"; reason: string }>
  | Readonly<{ status: "SIGNAL"; signal: R5CandidateSignal }>;

export type R5ExecutionResult =
  | Readonly<{
      status: "EXECUTION_READY";
      signal: R5CandidateSignal;
      entryOpenTime: number;
      rawEntryPrice: number;
      entryFill: number;
      riskPlan: R5RiskPlan;
    }>
  | Readonly<{
      status: "INVALID_TARGET_GEOMETRY";
      signal: R5CandidateSignal;
      entryOpenTime: number;
      rawEntryPrice: number;
      entryFill: number;
      riskPlan: R5RiskPlan;
    }>
  | Readonly<{
      status: "ENTRY_UNAVAILABLE" | "PERIOD_END_CENSORED" | "DATA_INCOMPLETE";
      signal: R5CandidateSignal;
      reason: string;
      entryOpenTime?: number;
      rawEntryPrice?: number;
      entryFill?: number;
      riskPlan?: R5RiskPlan;
    }>;

function noSignal(reason: string): R5DecisionResult {
  return Object.freeze({ status: "NO_SIGNAL", reason });
}

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function indicatorAt(series: readonly (number | null)[], index: number): number | null {
  const value = series[index];
  return finite(value) ? value : null;
}

function candleIsClosedAt(candle: Candle | undefined, time: number): candle is Candle {
  return Boolean(candle && Number.isInteger(candle.closeTime) && candle.closeTime <= time);
}

function maxFinite(values: readonly number[]): number | null {
  return values.length > 0 && values.every(finite) ? Math.max(...values) : null;
}

function minFinite(values: readonly number[]): number | null {
  return values.length > 0 && values.every(finite) ? Math.min(...values) : null;
}

function trueRange(candle: Candle, previousClose: number): number | null {
  if (!finite(candle.high) || !finite(candle.low) || !finite(previousClose) || candle.high < candle.low) return null;
  const value = Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  return finite(value) && value >= 0 ? value : null;
}

export function h15BreakoutDirection(input: Readonly<{
  ema20: number;
  ema50: number;
  currentClose: number;
  priorHigh: number;
  priorLow: number;
}>): R5Direction | null {
  if (input.ema20 > input.ema50 && input.currentClose > input.priorHigh) return "LONG";
  if (input.ema20 < input.ema50 && input.currentClose < input.priorLow) return "SHORT";
  return null;
}

export function h16NeutralRegime(ema20: number, ema50: number, atr14: number): boolean {
  return finite(ema20) && finite(ema50) && finitePositive(atr14) && Math.abs(ema20 - ema50) / atr14 <= 0.5;
}

export function h16MeanReversionDirection(input: Readonly<{
  neutral: boolean;
  currentClose: number;
  ema20: number;
  atr14: number;
  rsi14: number;
}>): R5Direction | null {
  if (!input.neutral || !finite(input.currentClose) || !finite(input.ema20) || !finitePositive(input.atr14) || !finite(input.rsi14)) return null;
  if (input.currentClose <= input.ema20 - 1.5 * input.atr14 && input.rsi14 <= 30) return "LONG";
  if (input.currentClose >= input.ema20 + 1.5 * input.atr14 && input.rsi14 >= 70) return "SHORT";
  return null;
}

export function h16TargetGeometry(direction: R5Direction, targetPrice: number, entryFill: number): boolean {
  if (!finite(targetPrice) || !finitePositive(entryFill)) return false;
  return direction === "LONG" ? targetPrice > entryFill : targetPrice < entryFill;
}

export function h17FundingDirection(fundingRate: number): R5Direction | null {
  if (!finite(fundingRate)) return null;
  if (fundingRate >= 0.0002) return "SHORT";
  if (fundingRate <= -0.0002) return "LONG";
  return null;
}

export function h18CompressionPass(trueRanges: readonly number[], atrValues: readonly number[]): boolean {
  return trueRanges.length === 6 && atrValues.length === 6 && trueRanges.every((value, index) => finite(value) && finitePositive(atrValues[index]) && value <= 0.75 * atrValues[index]!);
}

export function h18ExpansionPass(currentTrueRange: number, previousAtr14: number): boolean {
  return finite(currentTrueRange) && finitePositive(previousAtr14) && currentTrueRange >= 1.5 * previousAtr14;
}

export function h18BreakoutDirection(currentClose: number, priorHigh: number, priorLow: number): R5Direction | null {
  if (currentClose > priorHigh) return "LONG";
  if (currentClose < priorLow) return "SHORT";
  return null;
}

function buildSignal(input: R5CandidateSignal): R5DecisionResult {
  return Object.freeze({ status: "SIGNAL", signal: Object.freeze(input) });
}

export function makeR5CandidateIdentity(input: Readonly<{
  symbol: ResearchSymbol;
  direction: R5Direction;
  signalTime: number;
}>): string {
  return `${input.symbol}|${input.direction}|${input.signalTime}`;
}

export function calculateR5RiskPlan(input: Readonly<{
  direction: R5Direction;
  entryFill: number;
  atr: number;
  stopAtrMultiple: number;
  takeProfitR: number;
  maxHeldCandles: number;
}>): R5RiskPlan | null {
  if (
    !finitePositive(input.entryFill) ||
    !finitePositive(input.atr) ||
    !finitePositive(input.stopAtrMultiple) ||
    !finitePositive(input.takeProfitR) ||
    !Number.isInteger(input.maxHeldCandles) ||
    input.maxHeldCandles <= 0
  ) return null;
  const stopDistance = input.atr * input.stopAtrMultiple;
  if (!finitePositive(stopDistance)) return null;
  const stopPrice = input.direction === "LONG" ? input.entryFill - stopDistance : input.entryFill + stopDistance;
  const takeProfitPrice = input.direction === "LONG"
    ? input.entryFill + stopDistance * input.takeProfitR
    : input.entryFill - stopDistance * input.takeProfitR;
  if (!finitePositive(stopPrice) || !finitePositive(takeProfitPrice)) return null;
  return Object.freeze({
    entryFill: input.entryFill,
    stopPrice,
    stopDistance,
    takeProfitPrice,
    stopAtrMultiple: input.stopAtrMultiple,
    takeProfitR: input.takeProfitR,
    maxHeldCandles: input.maxHeldCandles,
  });
}

function calculateSignalRiskPlan(signal: R5CandidateSignal, entryFill: number): R5RiskPlan | null {
  if (signal.takeProfitR !== "FIXED_DECISION_EMA20") {
    return calculateR5RiskPlan({
      direction: signal.direction,
      entryFill,
      atr: signal.decisionAtr,
      stopAtrMultiple: signal.stopAtrMultiple,
      takeProfitR: signal.takeProfitR,
      maxHeldCandles: signal.maxHeldCandles,
    });
  }

  const stopDistance = signal.decisionAtr * signal.stopAtrMultiple;
  const fixedTargetPrice = signal.fixedTargetPrice;
  if (!finitePositive(entryFill) || !finitePositive(signal.decisionAtr) || !finitePositive(stopDistance) || !finite(fixedTargetPrice)) return null;
  const stopPrice = signal.direction === "LONG" ? entryFill - stopDistance : entryFill + stopDistance;
  if (!finitePositive(stopPrice) || !finitePositive(fixedTargetPrice)) return null;
  return Object.freeze({
    entryFill,
    stopPrice,
    stopDistance,
    takeProfitPrice: fixedTargetPrice,
    stopAtrMultiple: signal.stopAtrMultiple,
    takeProfitR: "FIXED_DECISION_EMA20" as const,
    maxHeldCandles: signal.maxHeldCandles,
  });
}

export function resolveR5Entry(input: Readonly<{
  signal: R5CandidateSignal;
  candles1h: readonly Candle[];
  periodEndTime?: number;
}>): R5ExecutionResult {
  const entry = input.candles1h.find(
    (candle) => candle.timeframe === "1h" && candle.openTime > input.signal.signalTime && finitePositive(candle.open),
  );
  if (!entry) return Object.freeze({ status: "ENTRY_UNAVAILABLE", signal: input.signal, reason: "NEXT_1H_OPEN_UNAVAILABLE" });
  if (input.periodEndTime !== undefined && entry.openTime > input.periodEndTime) {
    return Object.freeze({ status: "PERIOD_END_CENSORED", signal: input.signal, reason: "NEXT_1H_OPEN_AFTER_PERIOD_END", entryOpenTime: entry.openTime });
  }

  const rawEntryPrice = entry.open;
  const entryFill = input.signal.direction === "LONG"
    ? rawEntryPrice * (1 + BACKTEST_POLICY.slippageRate)
    : rawEntryPrice * (1 - BACKTEST_POLICY.slippageRate);
  const riskPlan = calculateSignalRiskPlan(input.signal, entryFill);
  if (!finitePositive(rawEntryPrice) || !finitePositive(entryFill) || !riskPlan) {
    return Object.freeze({ status: "DATA_INCOMPLETE", signal: input.signal, reason: "INVALID_NEXT_OPEN_ENTRY_OR_RISK_PLAN", entryOpenTime: entry.openTime, rawEntryPrice, entryFill });
  }
  if (input.signal.takeProfitR === "FIXED_DECISION_EMA20" && !h16TargetGeometry(input.signal.direction, riskPlan.takeProfitPrice, entryFill)) {
    return Object.freeze({ status: "INVALID_TARGET_GEOMETRY", signal: input.signal, entryOpenTime: entry.openTime, rawEntryPrice, entryFill, riskPlan });
  }
  return Object.freeze({ status: "EXECUTION_READY", signal: input.signal, entryOpenTime: entry.openTime, rawEntryPrice, entryFill, riskPlan });
}

export function evaluateR5H15(input: Readonly<{
  symbol: ResearchSymbol;
  candles4h: readonly Candle[];
  candles1h: readonly Candle[];
  currentIndex: number;
}>): R5DecisionResult {
  const decisionCandles = input.candles4h.slice(0, input.currentIndex + 1);
  const current = decisionCandles.at(-1);
  const prior = decisionCandles.slice(-21, -1);
  if (!current || current.timeframe !== "4h" || !candleIsClosedAt(current, current.closeTime) || prior.length !== 20) return noSignal("WARMUP_OR_INVALID_4H_WINDOW");
  const decisionIndex = decisionCandles.length - 1;
  const closes = decisionCandles.map((candle) => candle.close);
  const ema20 = indicatorAt(calculateEma20(closes), decisionIndex);
  const ema50 = indicatorAt(calculateEma50(closes), decisionIndex);
  const atr = indicatorAt(calculateAtr14(decisionCandles), decisionIndex);
  const priorHigh = maxFinite(prior.map((candle) => candle.high));
  const priorLow = minFinite(prior.map((candle) => candle.low));
  if (ema20 === null || ema50 === null || !finitePositive(atr) || priorHigh === null || priorLow === null) return noSignal("INDICATOR_UNAVAILABLE");
  const direction = h15BreakoutDirection({ ema20, ema50, currentClose: current.close, priorHigh, priorLow });
  if (!direction) return noSignal("H15_RULES_NOT_SATISFIED");
  return buildSignal({
    candidateId: "R5-H15-HTF-TREND",
    hypothesisId: "H15_HTF_LOW_FREQUENCY_TREND",
    symbol: input.symbol,
    direction,
    signalTime: current.closeTime,
    decisionAtr: atr,
    stopAtrMultiple: 2,
    takeProfitR: 3,
    maxHeldCandles: 48,
  });
}

export function evaluateR5H16(input: Readonly<{
  symbol: ResearchSymbol;
  candles4h: readonly Candle[];
  candles1h: readonly Candle[];
  currentIndex: number;
}>): R5DecisionResult {
  const current = input.candles1h[input.currentIndex];
  if (!current || current.timeframe !== "1h" || !candleIsClosedAt(current, current.closeTime)) return noSignal("INVALID_1H_DECISION_CANDLE");
  const decisionCandles1h = input.candles1h.slice(0, input.currentIndex + 1);
  const decisionCandles4h = input.candles4h.filter((candle) => candleIsClosedAt(candle, current.closeTime));
  const contextIndex = decisionCandles4h.length - 1;
  if (contextIndex < 0) return noSignal("HTF_CONTEXT_UNAVAILABLE");
  const decisionIndex1h = decisionCandles1h.length - 1;
  const ema20_4h = indicatorAt(calculateEma20(decisionCandles4h.map((candle) => candle.close)), contextIndex);
  const ema50_4h = indicatorAt(calculateEma50(decisionCandles4h.map((candle) => candle.close)), contextIndex);
  const atr4h = indicatorAt(calculateAtr14(decisionCandles4h), contextIndex);
  const ema20_1h = indicatorAt(calculateEma20(decisionCandles1h.map((candle) => candle.close)), decisionIndex1h);
  const atr1h = indicatorAt(calculateAtr14(decisionCandles1h), decisionIndex1h);
  const rsi1h = indicatorAt(calculateRsi14(decisionCandles1h.map((candle) => candle.close)), decisionIndex1h);
  if (ema20_4h === null || ema50_4h === null || !finitePositive(atr4h) || ema20_1h === null || !finitePositive(atr1h) || rsi1h === null) return noSignal("INDICATOR_UNAVAILABLE");
  const neutral = h16NeutralRegime(ema20_4h, ema50_4h, atr4h);
  if (!neutral) return noSignal("NOT_NEUTRAL");
  const direction = h16MeanReversionDirection({ neutral, currentClose: current.close, ema20: ema20_1h, atr14: atr1h, rsi14: rsi1h });
  if (!direction) return noSignal("H16_RULES_NOT_SATISFIED");
  return buildSignal({
    candidateId: "R5-H16-NEUTRAL-MEAN-REVERSION" as const,
    hypothesisId: "H16_NEUTRAL_REGIME_MEAN_REVERSION" as const,
    symbol: input.symbol,
    direction,
    signalTime: current.closeTime,
    decisionAtr: atr1h,
    stopAtrMultiple: 1.5,
    takeProfitR: "FIXED_DECISION_EMA20" as const,
    maxHeldCandles: 12,
    fixedTargetPrice: ema20_1h,
  });
}

export function evaluateR5H17(input: Readonly<{
  record: R5FundingDecisionRecord;
  h17DataQualification: "PASS" | "DATA_NOT_AVAILABLE";
  candles1h: readonly Candle[];
}>): R5DecisionResult {
  if (input.h17DataQualification !== "PASS") return noSignal("H17_DATA_NOT_AVAILABLE");
  const { record } = input;
  if (!Number.isInteger(record.fundingTime) || !finite(record.fundingRate)) return noSignal("INVALID_FUNDING_RECORD");
  if (!isR5H17CanonicalFundingTime(record.fundingTime)) return noSignal("NONCANONICAL_FUNDING_TIME");
  const direction = h17FundingDirection(record.fundingRate);
  if (!direction) return noSignal("FUNDING_THRESHOLD_NOT_REACHED");
  const decisionCandles = input.candles1h.filter((candle) => candle.closeTime < record.fundingTime);
  const atrIndex = decisionCandles.length - 1;
  if (atrIndex < 0) return noSignal("ATR_PRECEDING_FUNDING_UNAVAILABLE");
  const atr = indicatorAt(calculateAtr14(decisionCandles), atrIndex);
  if (!finitePositive(atr)) return noSignal("ATR_PRECEDING_FUNDING_UNAVAILABLE");
  return buildSignal({
    candidateId: "R5-H17-FUNDING-REVERSAL",
    hypothesisId: "H17_FUNDING_CROWDING_REVERSAL",
    symbol: record.symbol,
    direction,
    signalTime: record.fundingTime,
    decisionAtr: atr,
    stopAtrMultiple: 1.5,
    takeProfitR: 3,
    maxHeldCandles: 24,
  });
}

export function evaluateR5H18(input: Readonly<{
  symbol: ResearchSymbol;
  candles1h: readonly Candle[];
  currentIndex: number;
}>): R5DecisionResult {
  const decisionCandles = input.candles1h.slice(0, input.currentIndex + 1);
  const current = decisionCandles.at(-1);
  const previous = decisionCandles.at(-2);
  if (!current || !previous || current.timeframe !== "1h" || previous.timeframe !== "1h" || !candleIsClosedAt(current, current.closeTime)) return noSignal("INVALID_1H_DECISION_CANDLE");
  const decisionIndex = decisionCandles.length - 1;
  const atrSeries = calculateAtr14(decisionCandles);
  const currentAtr = indicatorAt(atrSeries, decisionIndex);
  const previousAtr = indicatorAt(atrSeries, decisionIndex - 1);
  if (!finitePositive(currentAtr) || !finitePositive(previousAtr)) return noSignal("INDICATOR_UNAVAILABLE");
  const compression = decisionCandles.slice(-7, -1);
  const priorDirection = decisionCandles.slice(-13, -1);
  if (compression.length !== 6 || priorDirection.length !== 12) return noSignal("WARMUP_OR_INVALID_1H_WINDOW");
  const compressionRanges: number[] = [];
  const compressionAtrs: number[] = [];
  for (const [offset, candle] of compression.entries()) {
    const index = decisionIndex - 6 + offset;
    const candleAtr = indicatorAt(atrSeries, index);
    const priorClose = decisionCandles[index - 1]?.close;
    const range = finite(priorClose) ? trueRange(candle, priorClose) : null;
    if (range !== null && candleAtr !== null) {
      compressionRanges.push(range);
      compressionAtrs.push(candleAtr);
    }
  }
  const compressionPass = h18CompressionPass(compressionRanges, compressionAtrs);
  const currentRange = trueRange(current, previous.close);
  const expansionPass = currentRange !== null && h18ExpansionPass(currentRange, previousAtr);
  const priorHigh = maxFinite(priorDirection.map((candle) => candle.high));
  const priorLow = minFinite(priorDirection.map((candle) => candle.low));
  if (!compressionPass || !expansionPass || priorHigh === null || priorLow === null) return noSignal("H18_RULES_NOT_SATISFIED");
  const direction = h18BreakoutDirection(current.close, priorHigh, priorLow);
  if (!direction) return noSignal("H18_BREAKOUT_NOT_SATISFIED");
  return buildSignal({
    candidateId: "R5-H18-COMPRESSION-EXPANSION",
    hypothesisId: "H18_VOLATILITY_COMPRESSION_EXPANSION",
    symbol: input.symbol,
    direction,
    signalTime: current.closeTime,
    decisionAtr: currentAtr,
    stopAtrMultiple: 1.5,
    takeProfitR: 3,
    maxHeldCandles: 24,
  });
}

export function canonicalFundingSlots(startTime: number, endTime: number): readonly number[] {
  if (!Number.isInteger(startTime) || !Number.isInteger(endTime) || startTime < 0 || endTime < startTime || startTime % M3_R5_H17_CANONICAL_SLOT_MS !== 0) {
    throw new Error("H17 canonical funding range must use an ordered UTC 8-hour grid.");
  }
  const slots: number[] = [];
  for (let timestamp = startTime; timestamp <= endTime; timestamp += M3_R5_H17_CANONICAL_SLOT_MS) slots.push(timestamp);
  return Object.freeze(slots);
}

export function isR5H17CanonicalFundingTime(fundingTime: number): boolean {
  return Number.isSafeInteger(fundingTime)
    && fundingTime >= M3_R5_RESEARCH_RANGE.startTime
    && fundingTime <= M3_R5_H17_LAST_CANONICAL_TIME
    && (fundingTime - M3_R5_RESEARCH_RANGE.startTime) % M3_R5_H17_CANONICAL_SLOT_MS === 0;
}
