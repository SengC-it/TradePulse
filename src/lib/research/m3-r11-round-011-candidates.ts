import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { calculateAtr14 } from "../indicators/atr.ts";
import { calculateEma20, calculateEma50, calculateEma200 } from "../indicators/ema.ts";
import type { Candle } from "../market-data/types.ts";
import type { BacktestData, BacktestSignalResult } from "../backtest/types.ts";
import { buildHistoricalIndexes, buildStrategyInputFromIndexes } from "../backtest/windows.ts";
import { calculateBTCRegime, calculateSymbolRegime } from "../strategy/regimes.ts";
import { evaluateStrategy } from "../strategy/engine.ts";
import type { StrategyCandidate, StrategyDirection } from "../strategy/types.ts";
import { BACKTEST_PERIOD_RANGES } from "../backtest/constants.ts";
import { R11_FEATURE_NAMES, M3_R11_CANDIDATE_IDS } from "./m3-r11-round-011-protocol.ts";
import { featureVectorFromOrderedValues, type R11FeatureVector } from "./m3-r11-round-011-model.ts";
import { buildR11E1RiskGeometry, buildR11E2RiskGeometry } from "./m3-r11-round-011-risk-geometry.ts";

type NumericSeries = readonly (number | null)[];

export type R11SymbolIndicatorContext = Readonly<{
  symbol: ResearchSymbol;
  candles1h: readonly Candle[];
  candles4h: readonly Candle[];
  ema20_1h: NumericSeries;
  ema50_1h: NumericSeries;
  atr14_1h: NumericSeries;
  ema50_4h: NumericSeries;
  ema200_4h: NumericSeries;
  atr14_4h: NumericSeries;
}>;

export type R11FeatureContext = Readonly<{
  bySymbol: Readonly<Record<ResearchSymbol, R11SymbolIndicatorContext>>;
}>;

export type R11OpportunityStream =
  | "BASELINE_FORMAL_STREAM"
  | "BASELINE_PRE_SCORE_ELIGIBLE_STREAM"
  | "NEW_ENTRY_EVENT_STREAM";

export type R11OpportunityIntent = Readonly<{
  candidateId: typeof M3_R11_CANDIDATE_IDS[number] | "R11-CONTROL-BASELINE-001" | "R11-PRE-SCORE";
  stream: R11OpportunityStream;
  symbol: ResearchSymbol;
  direction: StrategyDirection;
  decisionTime: number;
  signalCandle: Candle;
  candidate: StrategyCandidate;
  eventIdentity?: Readonly<{ event: "E1_RECLAIM" | "E2_RETEST"; sourceBreakoutTime?: number }>;
}>;

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function findClosedIndex(candles: readonly Candle[], signalTime: number): number {
  let low = 0;
  let high = candles.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    if (candles[middle]!.closeTime <= signalTime) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

function requireNumber(value: number | null | undefined, label: string): number {
  if (!finite(value)) throw new Error(`R11 decision-time value unavailable: ${label}.`);
  return value;
}

export function createR11FeatureContext(data: BacktestData): R11FeatureContext {
  const bySymbol = Object.fromEntries(Object.entries(data.datasets).map(([symbol, dataset]) => [symbol, Object.freeze({
    symbol: symbol as ResearchSymbol,
    candles1h: dataset.candles1h,
    candles4h: dataset.candles4h,
    ema20_1h: calculateEma20(dataset.candles1h.map((candle) => candle.close)),
    ema50_1h: calculateEma50(dataset.candles1h.map((candle) => candle.close)),
    atr14_1h: calculateAtr14(dataset.candles1h),
    ema50_4h: calculateEma50(dataset.candles4h.map((candle) => candle.close)),
    ema200_4h: calculateEma200(dataset.candles4h.map((candle) => candle.close)),
    atr14_4h: calculateAtr14(dataset.candles4h),
  })])) as Record<ResearchSymbol, R11SymbolIndicatorContext>;
  return Object.freeze({ bySymbol: Object.freeze(bySymbol) });
}

function directionSign(direction: StrategyDirection): number {
  return direction === "LONG" ? 1 : -1;
}

function previousQuoteVolumeMean(candles: readonly Candle[], index: number): number {
  const values = candles.slice(index - 20, index).map((candle) => candle.quoteVolume);
  if (values.length !== 20) throw new Error("R11 volume feature lacks its closed 20-candle baseline.");
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!finite(mean) || mean <= 0) throw new Error("R11 volume feature has an invalid closed baseline.");
  return mean;
}

/** Builds all ten fixed features from decision-time closed candles only. */
export function buildR11FeatureVector(context: R11FeatureContext, result: BacktestSignalResult): R11FeatureVector {
  const selected = context.bySymbol[result.snapshot.symbol];
  if (!selected) throw new Error(`R11 feature context is missing ${result.snapshot.symbol}.`);
  const direction = directionSign(result.snapshot.direction);
  const index1h = findClosedIndex(selected.candles1h, result.snapshot.signalTime);
  const index4h = findClosedIndex(selected.candles4h, result.snapshot.signalTime);
  if (index1h < 20 || index4h < 5) throw new Error("R11 feature warm-up window is incomplete.");
  const candle1h = selected.candles1h[index1h]!;
  const close1h = candle1h.close;
  const ema20 = requireNumber(selected.ema20_1h[index1h], "EMA20 1h");
  const ema50 = requireNumber(selected.ema50_1h[index1h], "EMA50 1h");
  const atr1h = requireNumber(selected.atr14_1h[index1h], "ATR14 1h");
  const close4h = selected.candles4h[index4h]!.close;
  const ema50_4h = requireNumber(selected.ema50_4h[index4h], "EMA50 4h");
  const ema200_4h = requireNumber(selected.ema200_4h[index4h], "EMA200 4h");
  const atr4h = requireNumber(selected.atr14_4h[index4h], "ATR14 4h");
  const ema200FiveBarsAgo = requireNumber(selected.ema200_4h[index4h - 5], "EMA200 4h slope");
  const ema20ThreeBarsAgo = requireNumber(selected.ema20_1h[index1h - 3], "EMA20 1h slope");
  const prior5 = selected.candles1h.slice(index1h - 5, index1h);
  const prior3 = selected.candles1h.slice(index1h - 3, index1h);
  const interactionCount = prior5.reduce((count, candle, offset) => {
    const at = index1h - 5 + offset;
    const fast = selected.ema20_1h[at];
    const slow = selected.ema50_1h[at];
    return count + (finite(fast) && finite(slow) && ((candle.low <= fast && candle.high >= fast) || (candle.low <= slow && candle.high >= slow)) ? 1 : 0);
  }, 0);
  const btc = context.bySymbol.BTCUSDT!;
  const btcIndex = findClosedIndex(btc.candles1h, result.snapshot.signalTime);
  if (btcIndex < 12) throw new Error("R11 BTC relative-return feature lacks its closed 12-candle baseline.");
  const priorExtreme = result.snapshot.direction === "LONG"
    ? Math.max(...prior3.map((candle) => candle.high))
    : Math.min(...prior3.map((candle) => candle.low));
  const volumeRatio = candle1h.quoteVolume / previousQuoteVolumeMean(selected.candles1h, index1h);
  const values = [
    direction * (close4h - ema200_4h) / atr4h,
    direction * (ema50_4h - ema200_4h) / atr4h,
    direction * (ema200_4h - ema200FiveBarsAgo) / atr4h,
    direction * (ema20 - ema50) / atr1h,
    direction * (ema20 - ema20ThreeBarsAgo) / atr1h,
    direction * (close1h - ema20) / atr1h,
    interactionCount,
    direction * (close1h - priorExtreme) / atr1h,
    Math.max(-5, Math.min(5, Math.log1p(volumeRatio))),
    direction * ((close1h / selected.candles1h[index1h - 12]!.close - 1) - (btc.candles1h[btcIndex]!.close / btc.candles1h[btcIndex - 12]!.close - 1)),
  ];
  if (!values.every(finite)) throw new Error("R11 feature vector contains a non-finite value.");
  return featureVectorFromOrderedValues(values);
}

function extensionBucket(extension: number): string {
  if (extension < 0) return "NEGATIVE_OR_NEUTRAL";
  if (extension <= 0.75) return "0_TO_0_75_ATR";
  return "ABOVE_0_75_ATR";
}

/** R11 uses ATR14_1h / close1h, not an average high-low proxy. */
export function r11VolatilityBucket(context: R11FeatureContext, symbol: ResearchSymbol, index: number): string {
  const selected = context.bySymbol[symbol];
  const close = selected?.candles1h[index]?.close;
  const atr = selected?.atr14_1h[index];
  if (!finite(close) || !finite(atr) || close <= 0) return "INVALID";
  const relative = atr / close;
  if (!finite(relative)) return "INVALID";
  if (relative < 0.005) return "LOW";
  if (relative < 0.02) return "NORMAL";
  return "HIGH";
}

export function classifyR11Router(context: R11FeatureContext, result: BacktestSignalResult): Readonly<{ routerCell: string }> {
  const selected = context.bySymbol[result.snapshot.symbol];
  if (!selected) return Object.freeze({ routerCell: "INVALID" });
  const index = findClosedIndex(selected.candles1h, result.snapshot.signalTime);
  const trendIndex = findClosedIndex(selected.candles4h, result.snapshot.signalTime);
  if (index < 5 || trendIndex < 5) return Object.freeze({ routerCell: "INVALID" });
  const feature = buildR11FeatureVector(context, result);
  const sign = directionSign(result.snapshot.direction);
  const fresh4h = sign * (requireNumber(selected.ema200_4h[trendIndex], "EMA200 4h") - requireNumber(selected.ema200_4h[trendIndex - 5], "EMA200 4h slope")) > 0;
  const fresh1h = sign * (requireNumber(selected.ema20_1h[index], "EMA20 1h") - requireNumber(selected.ema20_1h[index - 3], "EMA20 1h slope")) > 0;
  return Object.freeze({ routerCell: [
    fresh4h ? "FRESH_POSITIVE" : "STALE_OR_NEGATIVE",
    fresh1h ? "FRESH_POSITIVE" : "STALE_OR_NEGATIVE",
    extensionBucket(feature.priceExtensionFrom1hEma20Atr),
    r11VolatilityBucket(context, result.snapshot.symbol, index),
  ].join("|") });
}

function periodFor(time: number): "DEV" | "OOS" {
  return time <= BACKTEST_PERIOD_RANGES.DEV.endTime ? "DEV" : "OOS";
}

export function r11PeriodFor(time: number): "DEV" | "OOS" {
  if (time < BACKTEST_PERIOD_RANGES.DEV.startTime || time > BACKTEST_PERIOD_RANGES.OOS.endTime) {
    throw new Error(`R11 decision time is outside the research range: ${time}.`);
  }
  return periodFor(time);
}

export function isR11DecisionTimeInFrozenRange(decisionTime: number): boolean {
  return decisionTime >= Date.parse("2023-01-01T00:00:00.000Z") && decisionTime <= Date.parse("2026-08-15T23:59:59.999Z");
}

function eventCandidate(
  context: R11FeatureContext,
  symbol: ResearchSymbol,
  direction: StrategyDirection,
  index: number,
  eventIdentity?: R11OpportunityIntent["eventIdentity"],
): StrategyCandidate | null {
  const selected = context.bySymbol[symbol];
  const candle = selected?.candles1h[index];
  const trendIndex = selected ? findClosedIndex(selected.candles4h, candle?.closeTime ?? -1) : -1;
  const btc = context.bySymbol.BTCUSDT;
  const btcIndex = btc ? findClosedIndex(btc.candles4h, candle?.closeTime ?? -1) : -1;
  if (!selected || !candle || trendIndex < 5 || btcIndex < 5 || index < 20) return null;
  const sign = directionSign(direction);
  const atr = selected.atr14_1h[index];
  const ema20 = selected.ema20_1h[index];
  const ema50 = selected.ema50_1h[index];
  const ema50_4h = selected.ema50_4h[trendIndex];
  const ema200_4h = selected.ema200_4h[trendIndex];
  const ema200Five = selected.ema200_4h[trendIndex - 5];
  const atr4h = selected.atr14_4h[trendIndex];
  const btcClose = btc.candles4h[btcIndex]!.close;
  const btcEma50 = btc.ema50_4h[btcIndex];
  const btcEma200 = btc.ema200_4h[btcIndex];
  const btcEma200Five = btc.ema200_4h[btcIndex - 5];
  const btcAtr = btc.atr14_4h[btcIndex];
  if (!finite(atr) || !finite(ema20) || !finite(ema50) || !finite(ema50_4h) || !finite(ema200_4h) || !finite(ema200Five) || !finite(atr4h) || !finite(btcEma50) || !finite(btcEma200) || !finite(btcEma200Five) || !finite(btcAtr)) return null;
  if (atr <= 0 || atr4h <= 0 || btcAtr <= 0) return null;
  const symbolRegime = calculateSymbolRegime({ close: selected.candles4h[trendIndex]!.close, ema50: ema50_4h, ema200: ema200_4h, ema200FiveBarsAgo: ema200Five });
  const btcRegime = calculateBTCRegime({ close: btcClose, ema50: btcEma50, ema200: btcEma200, ema200FiveBarsAgo: btcEma200Five, atr14: btcAtr });
  if (!symbolRegime || !btcRegime || (direction === "LONG" && symbolRegime !== "LONG_ONLY") || (direction === "SHORT" && symbolRegime !== "SHORT_ONLY")) return null;
  const risk = eventIdentity?.event === "E1_RECLAIM"
    ? buildR11E1RiskGeometry({ direction, entryReference: candle.close, atr14_1h: atr, previousFiveClosedCandles: selected.candles1h.slice(index - 5, index) })
    : eventIdentity?.event === "E2_RETEST" && eventIdentity.sourceBreakoutTime !== undefined
      ? (() => {
          const breakoutIndex = selected.candles1h.findIndex((value) => value.openTime === eventIdentity.sourceBreakoutTime);
          return breakoutIndex >= 0 && breakoutIndex <= index
            ? buildR11E2RiskGeometry({ direction, entryReference: candle.close, atr14_1h: atr, breakoutThroughReclaimClosedCandles: selected.candles1h.slice(breakoutIndex, index + 1) })
            : null;
        })()
      : null;
  if (!risk) return null;
  return Object.freeze({
    strategyVersion: "baseline-001",
    symbol,
    direction,
    symbolRegime,
    btcRegime,
    entryReference: candle.close,
    stopReference: risk.stopReference,
    takeProfitReference: risk.takeProfitReference,
    stopDistance: risk.stopDistance,
    stopAtr: risk.stopAtr,
    breakdown: Object.freeze({
      trendStrength: sign * (ema50_4h - ema200_4h) / atr4h,
      pullbackQuality: 0,
      breakoutStrength: 0,
      volumeScore: 0,
      riskRewardScore: 2,
    }),
    totalScore: 0,
    grade: null,
    formalSignal: true,
  });
}

function interacted(context: R11SymbolIndicatorContext, index: number): boolean {
  return context.candles1h.slice(index - 5, index).some((candle, offset) => {
    const at = index - 5 + offset;
    const ema20 = context.ema20_1h[at];
    const ema50 = context.ema50_1h[at];
    return finite(ema20) && finite(ema50) && ((candle.low <= ema20 && candle.high >= ema20) || (candle.low <= ema50 && candle.high >= ema50));
  });
}

export function isR11E1PullbackReclaim(context: R11FeatureContext, symbol: ResearchSymbol, direction: StrategyDirection, index: number): boolean {
  const selected = context.bySymbol[symbol];
  const current = selected?.candles1h[index];
  const previous = selected?.candles1h[index - 1];
  const trendIndex = selected && current ? findClosedIndex(selected.candles4h, current.closeTime) : -1;
  if (!selected || !current || !previous || index < 20 || trendIndex < 5 || !interacted(selected, index)) return false;
  const ema20 = selected.ema20_1h[index];
  const ema50 = selected.ema50_1h[index];
  const priorEma20 = selected.ema20_1h[index - 1];
  const atr = selected.atr14_1h[index];
  const trendEma50 = selected.ema50_4h[trendIndex];
  const trendEma200 = selected.ema200_4h[trendIndex];
  const trendEma200Five = selected.ema200_4h[trendIndex - 5];
  if (!finite(ema20) || !finite(ema50) || !finite(priorEma20) || !finite(atr) || !finite(trendEma50) || !finite(trendEma200) || !finite(trendEma200Five) || atr <= 0) return false;
  const trend = calculateSymbolRegime({ close: selected.candles4h[trendIndex]!.close, ema50: trendEma50, ema200: trendEma200, ema200FiveBarsAgo: trendEma200Five });
  if (direction === "LONG") return trend === "LONG_ONLY" && ema20 > ema50 && current.close > ema20 && previous.close <= priorEma20 && (current.close - ema20) / atr <= 0.75;
  return trend === "SHORT_ONLY" && ema20 < ema50 && current.close < ema20 && previous.close >= priorEma20 && (ema20 - current.close) / atr <= 0.75;
}

export function findR11E2BreakoutSource(context: R11FeatureContext, symbol: ResearchSymbol, direction: StrategyDirection, index: number): number | null {
  const selected = context.bySymbol[symbol];
  const current = selected?.candles1h[index];
  if (!selected || !current || index < 6) return null;
  for (const distance of [1, 2, 3]) {
    const breakoutIndex = index - distance;
    if (breakoutIndex < 3) continue;
    const breakout = selected.candles1h[breakoutIndex]!;
    const levelCandles = selected.candles1h.slice(breakoutIndex - 3, breakoutIndex);
    const level = direction === "LONG" ? Math.max(...levelCandles.map((candle) => candle.high)) : Math.min(...levelCandles.map((candle) => candle.low));
    const breakoutAtr = selected.atr14_1h[breakoutIndex];
    if (!finite(breakoutAtr)) continue;
    const breakoutPassed = direction === "LONG" ? breakout.close > level : breakout.close < level;
    const retest = isR11E2RetestInBand({ direction, level, breakoutAtr, current });
    if (breakoutPassed && retest) return breakout.openTime;
  }
  return null;
}

/**
 * The E2 retest is a same-candle, two-sided inclusive band around the
 * breakout level. It intentionally has no prior-close prerequisite.
 */
export function isR11E2RetestInBand(input: Readonly<{
  direction: StrategyDirection;
  level: number;
  breakoutAtr: number;
  current: Pick<Candle, "low" | "high" | "close">;
}>): boolean {
  if (!finite(input.level) || !finite(input.breakoutAtr) || input.breakoutAtr <= 0 || !finite(input.current.low) || !finite(input.current.high) || !finite(input.current.close)) return false;
  const lower = input.level - 0.25 * input.breakoutAtr;
  const upper = input.level + 0.25 * input.breakoutAtr;
  return input.direction === "LONG"
    ? input.current.low >= lower && input.current.low <= upper && input.current.close > input.level
    : input.current.high >= lower && input.current.high <= upper && input.current.close < input.level;
}

function intent(
  context: R11FeatureContext,
  candidateId: R11OpportunityIntent["candidateId"],
  stream: R11OpportunityStream,
  symbol: ResearchSymbol,
  direction: StrategyDirection,
  index: number,
  eventIdentity?: R11OpportunityIntent["eventIdentity"],
): R11OpportunityIntent | null {
  const selected = context.bySymbol[symbol];
  const signalCandle = selected?.candles1h[index];
  const candidate = eventCandidate(context, symbol, direction, index, eventIdentity);
  if (!signalCandle || !candidate) return null;
  return Object.freeze({ candidateId, stream, symbol, direction, decisionTime: signalCandle.closeTime, signalCandle, candidate, ...(eventIdentity ? { eventIdentity } : {}) });
}

export function generateR11EventIntents(data: BacktestData, context = createR11FeatureContext(data)): readonly R11OpportunityIntent[] {
  const intents: R11OpportunityIntent[] = [];
  for (const symbol of RESEARCH_SYMBOLS) {
    const selected = context.bySymbol[symbol]!;
    for (let index = 20; index < selected.candles1h.length; index += 1) {
      const decisionTime = selected.candles1h[index]!.closeTime;
      if (!isR11DecisionTimeInFrozenRange(decisionTime)) continue;
      for (const direction of ["LONG", "SHORT"] as const) {
        if (isR11E1PullbackReclaim(context, symbol, direction, index)) {
          const value = intent(context, "R11-E1-PULLBACK-RECLAIM", "NEW_ENTRY_EVENT_STREAM", symbol, direction, index, { event: "E1_RECLAIM" });
          if (value) intents.push(value);
        }
        const breakoutTime = findR11E2BreakoutSource(context, symbol, direction, index);
        if (breakoutTime !== null) {
          const value = intent(context, "R11-E2-BREAKOUT-RETEST", "NEW_ENTRY_EVENT_STREAM", symbol, direction, index, { event: "E2_RETEST", sourceBreakoutTime: breakoutTime });
          if (value) intents.push(value);
        }
      }
    }
  }
  return Object.freeze(intents);
}

/** Collects baseline candidates without settling them. This is the two baseline streams' pre-lock intent pass. */
export function generateR11BaselineIntents(data: BacktestData): readonly R11OpportunityIntent[] {
  const indexes = buildHistoricalIndexes(data.datasets);
  const candleBySymbolAndClose = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [
    symbol,
    new Map(indexes.bySymbol[symbol]!.candles1h.candles.map((candle) => [candle.closeTime, candle])),
  ])) as Record<ResearchSymbol, Map<number, Candle>>;
  const intents: R11OpportunityIntent[] = [];
  for (const decisionTime of indexes.timeline1h) {
    if (!isR11DecisionTimeInFrozenRange(decisionTime)) continue;
    let engine;
    try {
      engine = evaluateStrategy(buildStrategyInputFromIndexes(indexes, decisionTime));
    } catch {
      continue;
    }
    for (const evaluation of engine.evaluations) {
      const candidate = evaluation.candidate;
      if (!candidate) continue;
      const signalCandle = candleBySymbolAndClose[candidate.symbol]?.get(decisionTime);
      if (!signalCandle) continue;
      if (candidate.formalSignal && candidate.totalScore >= 70) {
        intents.push(Object.freeze({
          candidateId: "R11-CONTROL-BASELINE-001",
          stream: "BASELINE_FORMAL_STREAM",
          symbol: candidate.symbol,
          direction: candidate.direction,
          decisionTime,
          signalCandle,
          candidate,
        }));
      }
      intents.push(Object.freeze({
        candidateId: "R11-PRE-SCORE",
        stream: "BASELINE_PRE_SCORE_ELIGIBLE_STREAM",
        symbol: candidate.symbol,
        direction: candidate.direction,
        decisionTime,
        signalCandle,
        candidate,
      }));
    }
  }
  return Object.freeze(intents);
}

export function r11FeatureNames(): readonly string[] {
  return R11_FEATURE_NAMES;
}
