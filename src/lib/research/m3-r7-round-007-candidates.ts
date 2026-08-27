import type { ResearchSymbol } from "../config/constants.ts";
import { calculateAtr14 } from "../indicators/atr.ts";
import { calculateEma20, calculateEma50, calculateEma200 } from "../indicators/ema.ts";
import type { Candle } from "../market-data/types.ts";
import type { BacktestData, BacktestSignalResult } from "../backtest/types.ts";
import type { StrategyDirection } from "../strategy/types.ts";
import { R7_FEATURE_NAMES } from "./m3-r7-round-007-protocol.ts";
import type { R7FeatureVector } from "./m3-r7-round-007-model.ts";
import { featureVectorFromOrderedValues } from "./m3-r7-round-007-model.ts";

type NumericSeries = readonly (number | null)[];

export type R7SymbolIndicatorContext = Readonly<{
  symbol: ResearchSymbol;
  candles1h: readonly Candle[];
  candles4h: readonly Candle[];
  ema20_1h: NumericSeries;
  ema50_1h: NumericSeries;
  atr14_1h: NumericSeries;
  ema20_4h: NumericSeries;
  ema50_4h: NumericSeries;
  ema200_4h: NumericSeries;
  atr14_4h: NumericSeries;
}>;

export type R7FeatureContext = Readonly<{
  bySymbol: Readonly<Record<ResearchSymbol, R7SymbolIndicatorContext>>;
}>;

export type R7OpportunityClassification = Readonly<{
  e1PullbackReclaim: boolean;
  e2BreakoutRetest: boolean;
  routerCell: string;
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
    } else high = middle - 1;
  }
  return result;
}

function requireNumber(value: number | null | undefined, label: string): number {
  if (!finite(value)) throw new Error(`R7 decision-time feature unavailable: ${label}.`);
  return value;
}

export function createR7FeatureContext(data: BacktestData): R7FeatureContext {
  const bySymbol = Object.fromEntries(Object.entries(data.datasets).map(([symbol, dataset]) => {
    const closes1h = dataset.candles1h.map((candle) => candle.close);
    const closes4h = dataset.candles4h.map((candle) => candle.close);
    return [symbol, Object.freeze({
      symbol: symbol as ResearchSymbol,
      candles1h: dataset.candles1h,
      candles4h: dataset.candles4h,
      ema20_1h: calculateEma20(closes1h),
      ema50_1h: calculateEma50(closes1h),
      atr14_1h: calculateAtr14(dataset.candles1h),
      ema20_4h: calculateEma20(closes4h),
      ema50_4h: calculateEma50(closes4h),
      ema200_4h: calculateEma200(closes4h),
      atr14_4h: calculateAtr14(dataset.candles4h),
    })];
  })) as Record<ResearchSymbol, R7SymbolIndicatorContext>;
  return Object.freeze({ bySymbol: Object.freeze(bySymbol) });
}

function directionSign(direction: StrategyDirection): number {
  return direction === "LONG" ? 1 : -1;
}

function previousQuoteVolumeMean(candles: readonly Candle[], index: number): number {
  const start = index - 20;
  if (start < 0) throw new Error("R7 volume feature lacks its closed 20-candle baseline.");
  const values = candles.slice(start, index).map((candle) => candle.quoteVolume);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!finite(mean) || mean <= 0) throw new Error("R7 volume feature has an invalid closed baseline.");
  return mean;
}

function asOfFourHourIndex(candles: readonly Candle[], signalTime: number): number {
  return findClosedIndex(candles, signalTime);
}

/** Builds the ten fixed features using only candles closed at signalTime. */
export function buildR7FeatureVector(context: R7FeatureContext, result: BacktestSignalResult): R7FeatureVector {
  const symbolContext = context.bySymbol[result.snapshot.symbol];
  if (!symbolContext) throw new Error(`R7 feature context is missing ${result.snapshot.symbol}.`);
  const direction = directionSign(result.snapshot.direction);
  const index1h = findClosedIndex(symbolContext.candles1h, result.snapshot.signalTime);
  const index4h = asOfFourHourIndex(symbolContext.candles4h, result.snapshot.signalTime);
  if (index1h < 20 || index4h < 5) throw new Error("R7 feature warm-up window is incomplete.");
  const candle1h = symbolContext.candles1h[index1h]!;
  const close1h = candle1h.close;
  const ema20_1h = requireNumber(symbolContext.ema20_1h[index1h], "EMA20 1h");
  const ema50_1h = requireNumber(symbolContext.ema50_1h[index1h], "EMA50 1h");
  const atr1h = requireNumber(symbolContext.atr14_1h[index1h], "ATR14 1h");
  const ema50_4h = requireNumber(symbolContext.ema50_4h[index4h], "EMA50 4h");
  const ema200_4h = requireNumber(symbolContext.ema200_4h[index4h], "EMA200 4h");
  const atr4h = requireNumber(symbolContext.atr14_4h[index4h], "ATR14 4h");
  const ema200FiveBarsAgo = requireNumber(symbolContext.ema200_4h[index4h - 5], "EMA200 4h slope");
  const ema20ThreeBarsAgo = requireNumber(symbolContext.ema20_1h[index1h - 3], "EMA20 1h slope");
  const prior5 = symbolContext.candles1h.slice(index1h - 5, index1h);
  const prior3 = symbolContext.candles1h.slice(index1h - 3, index1h);
  const interactionCount = prior5.reduce((count, candle, offset) => {
    const priorIndex = index1h - 5 + offset;
    const ema20 = symbolContext.ema20_1h[priorIndex];
    const ema50 = symbolContext.ema50_1h[priorIndex];
    return count + (finite(ema20) && finite(ema50) && ((candle.low <= ema20 && candle.high >= ema20) || (candle.low <= ema50 && candle.high >= ema50)) ? 1 : 0);
  }, 0);
  const volumeRatio = candle1h.quoteVolume / previousQuoteVolumeMean(symbolContext.candles1h, index1h);
  if (!finite(volumeRatio) || volumeRatio <= 0) throw new Error("R7 volume ratio is invalid.");
  const btcContext = context.bySymbol.BTCUSDT!;
  const btcIndex = findClosedIndex(btcContext.candles1h, result.snapshot.signalTime);
  if (btcIndex < 12) throw new Error("R7 BTC relative-return feature lacks its closed 12-candle baseline.");
  const btcClose = btcContext.candles1h[btcIndex]!.close;
  const symbolPastClose = symbolContext.candles1h[index1h - 12]!.close;
  const btcPastClose = btcContext.candles1h[btcIndex - 12]!.close;
  const priorExtreme = result.snapshot.direction === "LONG"
    ? Math.max(...prior3.map((candle) => candle.high))
    : Math.min(...prior3.map((candle) => candle.low));
  const values = [
    direction * (close1h - ema200_4h) / atr4h,
    direction * (ema50_4h - ema200_4h) / atr4h,
    direction * (ema200_4h - ema200FiveBarsAgo) / atr4h,
    direction * (ema20_1h - ema50_1h) / atr1h,
    direction * (ema20_1h - ema20ThreeBarsAgo) / atr1h,
    direction * (close1h - ema20_1h) / atr1h,
    interactionCount,
    direction * (close1h - priorExtreme) / atr1h,
    Math.max(-5, Math.min(5, Math.log1p(volumeRatio))),
    direction * ((close1h / symbolPastClose - 1) - (btcClose / btcPastClose - 1)),
  ];
  if (!values.every(finite)) throw new Error("R7 feature vector contains a non-finite value.");
  return featureVectorFromOrderedValues(values);
}

function extensionBucket(extension: number): string {
  if (extension < 0) return "NEGATIVE_OR_NEUTRAL";
  if (extension <= 0.75) return "0_TO_0_75_ATR";
  return "ABOVE_0_75_ATR";
}

function volatilityBucket(candles: readonly Candle[], index: number): string {
  const close = candles[index]!.close;
  const range = candles.slice(index - 14, index + 1).reduce((sum, candle) => sum + (candle.high - candle.low), 0) / 15;
  const relative = range / close;
  if (!finite(relative)) return "INVALID";
  if (relative < 0.005) return "LOW";
  if (relative < 0.02) return "NORMAL";
  return "HIGH";
}

export function classifyR7Opportunity(context: R7FeatureContext, result: BacktestSignalResult): R7OpportunityClassification {
  const symbolContext = context.bySymbol[result.snapshot.symbol];
  if (!symbolContext) return Object.freeze({ e1PullbackReclaim: false, e2BreakoutRetest: false, routerCell: "INVALID" });
  const index = findClosedIndex(symbolContext.candles1h, result.snapshot.signalTime);
  const trendIndex = findClosedIndex(symbolContext.candles4h, result.snapshot.signalTime);
  if (index < 5 || trendIndex < 5) return Object.freeze({ e1PullbackReclaim: false, e2BreakoutRetest: false, routerCell: "INVALID" });
  const direction = result.snapshot.direction;
  const sign = directionSign(direction);
  const current = symbolContext.candles1h[index]!;
  const previous = symbolContext.candles1h[index - 1]!;
  const ema20 = symbolContext.ema20_1h[index];
  const ema50 = symbolContext.ema50_1h[index];
  const priorEma20 = symbolContext.ema20_1h[index - 1];
  const atr = symbolContext.atr14_1h[index];
  const trendEma50 = symbolContext.ema50_4h[trendIndex];
  const trendEma200 = symbolContext.ema200_4h[trendIndex];
  const prior5 = symbolContext.candles1h.slice(index - 5, index);
  const prior3 = symbolContext.candles1h.slice(index - 3, index);
  const interaction = prior5.some((candle, offset) => {
    const at = index - 5 + offset;
    const fast = symbolContext.ema20_1h[at];
    const slow = symbolContext.ema50_1h[at];
    return finite(fast) && finite(slow) && ((candle.low <= fast && candle.high >= fast) || (candle.low <= slow && candle.high >= slow));
  });
  const e1Direction = direction === "LONG"
    ? finite(ema20) && finite(ema50) && finite(priorEma20) && finite(atr) && finite(trendEma50) && finite(trendEma200) && trendEma50 > trendEma200 && ema20 > ema50 && current.close > ema20 && previous.close <= priorEma20 && interaction && (current.close - ema20) / atr <= 0.75 && current.close <= Math.max(...prior3.map((candle) => candle.high))
    : finite(ema20) && finite(ema50) && finite(priorEma20) && finite(atr) && finite(trendEma50) && finite(trendEma200) && trendEma50 < trendEma200 && ema20 < ema50 && current.close < ema20 && previous.close >= priorEma20 && interaction && (ema20 - current.close) / atr <= 0.75 && current.close >= Math.min(...prior3.map((candle) => candle.low));
  const e2Direction = [1, 2, 3].some((distance) => {
    const breakoutIndex = index - distance;
    if (breakoutIndex < 3) return false;
    const breakout = symbolContext.candles1h[breakoutIndex]!;
    const levelCandles = symbolContext.candles1h.slice(breakoutIndex - 3, breakoutIndex);
    const level = direction === "LONG"
      ? Math.max(...levelCandles.map((candle) => candle.high))
      : Math.min(...levelCandles.map((candle) => candle.low));
    const localAtr = symbolContext.atr14_1h[breakoutIndex];
    if (!finite(localAtr)) return false;
    const breakoutPassed = direction === "LONG" ? breakout.close > level : breakout.close < level;
    const retest = direction === "LONG"
      ? current.low <= level + 0.25 * localAtr && current.close > level && previous.close <= level
      : current.high >= level - 0.25 * localAtr && current.close < level && previous.close >= level;
    return breakoutPassed && retest;
  });
  const feature = buildR7FeatureVector(context, result);
  const extension = feature.priceExtensionFrom1hEma20Atr;
  const fresh4h = sign * (requireNumber(symbolContext.ema200_4h[trendIndex], "router EMA200") - requireNumber(symbolContext.ema200_4h[trendIndex - 5], "router EMA200 slope")) > 0;
  const fresh1h = sign * (requireNumber(symbolContext.ema20_1h[index], "router EMA20") - requireNumber(symbolContext.ema20_1h[index - 3], "router EMA20 slope")) > 0;
  const routerCell = [fresh4h ? "FRESH_POSITIVE" : "STALE_OR_NEGATIVE", fresh1h ? "FRESH_POSITIVE" : "STALE_OR_NEGATIVE", extensionBucket(extension), volatilityBucket(symbolContext.candles1h, index)].join("|");
  return Object.freeze({ e1PullbackReclaim: e1Direction, e2BreakoutRetest: e2Direction, routerCell });
}

export function r7FeatureNames(): readonly string[] {
  return R7_FEATURE_NAMES;
}
