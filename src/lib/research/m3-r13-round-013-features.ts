import type { ResearchSymbol } from "../config/constants.ts";
import type { HistoricalFundingRecord } from "../historical-data/types.ts";
import type { Candle } from "../market-data/types.ts";
import { R13_FEATURE_NAMES, type R13Direction, type R13FeatureName } from "./m3-r13-round-013-protocol.ts";
import { requireSafeTimestamp } from "./utils.ts";

const HOUR_MS = 60 * 60 * 1_000;
const FOUR_HOUR_MS = 4 * HOUR_MS;
const ROLLING_30_DAYS_HOURS = 30 * 24;

export type R13FeatureVector = Readonly<Record<R13FeatureName, number>>;

export type R13FeatureInput = Readonly<{
  symbol: ResearchSymbol;
  direction: R13Direction;
  signalTime: number;
  candles1h: readonly Candle[];
  candles4h: readonly Candle[];
  allSymbolCandles1h: Readonly<Record<ResearchSymbol, readonly Candle[]>>;
  funding: readonly HistoricalFundingRecord[];
}>;

type IndicatorSeries = Readonly<{
  ema20: readonly (number | null)[];
  ema50: readonly (number | null)[];
  ema200: readonly (number | null)[];
  atr14: readonly (number | null)[];
}>;

function directionSign(direction: R13Direction): 1 | -1 {
  return direction === "LONG" ? 1 : -1;
}

function finite(value: number | null | undefined, label: string): number {
  if (value === null || value === undefined || !Number.isFinite(value)) throw new Error(`R13 feature ${label} is unavailable.`);
  return value;
}

function closedCandles(candles: readonly Candle[], signalTime: number): readonly Candle[] {
  requireSafeTimestamp(signalTime, "R13 signalTime");
  const result = candles
    .filter((candle) => candle.closeTime <= signalTime)
    .slice()
    .sort((left, right) => left.openTime - right.openTime);
  for (let index = 1; index < result.length; index += 1) {
    if (result[index]!.openTime <= result[index - 1]!.openTime) throw new Error("R13 feature candles are not strictly chronological.");
  }
  return result;
}

function emaSeries(candles: readonly Candle[], period: number): readonly (number | null)[] {
  const values = Array<number | null>(candles.length).fill(null);
  if (candles.length < period) return values;
  const multiplier = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
  values[period - 1] = ema;
  for (let index = period; index < candles.length; index += 1) {
    ema = (candles[index]!.close - ema) * multiplier + ema;
    values[index] = ema;
  }
  return values;
}

function atr14Series(candles: readonly Candle[]): readonly (number | null)[] {
  const period = 14;
  const values = Array<number | null>(candles.length).fill(null);
  const trueRanges: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const previousClose = candles[index - 1]!.close;
    trueRanges.push(Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose)));
    if (trueRanges.length >= period) values[index] = trueRanges.slice(-period).reduce((sum, value) => sum + value, 0) / period;
  }
  return values;
}

function indicators(candles: readonly Candle[]): IndicatorSeries {
  return {
    ema20: emaSeries(candles, 20),
    ema50: emaSeries(candles, 50),
    ema200: emaSeries(candles, 200),
    atr14: atr14Series(candles),
  };
}

function latestIndex(candles: readonly Candle[], signalTime: number, exact = false): number {
  const index = candles.length - 1;
  if (index < 0) throw new Error("R13 feature candle history is empty.");
  if (exact && candles[index]!.closeTime !== signalTime) throw new Error("R13 feature history does not contain the decision candle at signalTime.");
  return index;
}

function returnOver(candles: readonly Candle[], index: number, bars: number): number {
  const prior = candles[index - bars];
  const current = candles[index];
  if (!prior || !current || prior.close <= 0) throw new Error(`R13 feature requires ${bars} closed bars of return history.`);
  return current.close / prior.close - 1;
}

function ratio(value: number, denominator: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isFinite(denominator) || denominator === 0) throw new Error(`R13 feature ${label} has an invalid denominator.`);
  return value / denominator;
}

function percentileRank(value: number, values: readonly number[]): number {
  if (values.length === 0) throw new Error("R13 feature percentile history is empty.");
  return values.filter((candidate) => candidate <= value).length / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("R13 feature median history is empty.");
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!;
}

function latestFunding(funding: readonly HistoricalFundingRecord[], signalTime: number): HistoricalFundingRecord {
  const eligible = funding.filter((event) => event.fundingTime <= signalTime).sort((left, right) => left.fundingTime - right.fundingTime);
  const event = eligible[eligible.length - 1];
  if (!event || !Number.isFinite(event.fundingRate)) throw new Error("R13 feature requires a settled funding rate at decision time.");
  return event;
}

function featureFromSymbolAtDecision(
  candles: readonly Candle[],
  signalTime: number,
): Readonly<{ close: number; ema50: number; return12h: number }> {
  const closed = closedCandles(candles, signalTime);
  const index = latestIndex(closed, signalTime, true);
  const series = indicators(closed);
  return {
    close: closed[index]!.close,
    ema50: finite(series.ema50[index], "cross-sectional EMA50"),
    return12h: returnOver(closed, index, 12),
  };
}

/**
 * Computes the one fixed R13 feature vector. Every lookup is bounded by
 * signalTime; a caller may pass a larger cache, but future candle values are
 * never used.
 */
export function buildR13FeatureVector(input: R13FeatureInput): R13FeatureVector {
  requireSafeTimestamp(input.signalTime, "R13 signalTime");
  const direction = directionSign(input.direction);
  const candles1h = closedCandles(input.candles1h, input.signalTime);
  const candles4h = closedCandles(input.candles4h, input.signalTime);
  const index1h = latestIndex(candles1h, input.signalTime, true);
  const index4h = latestIndex(candles4h, input.signalTime);
  const oneHour = indicators(candles1h);
  const fourHour = indicators(candles4h);
  const close1h = candles1h[index1h]!.close;
  const close4h = candles4h[index4h]!.close;
  const atr1h = finite(oneHour.atr14[index1h], "ATR14_1h");
  const atr4h = finite(fourHour.atr14[index4h], "ATR14_4h");
  if (close1h <= 0 || close4h <= 0 || atr1h <= 0 || atr4h <= 0) throw new Error("R13 feature prices and ATR must be positive.");
  const ema20_1h = finite(oneHour.ema20[index1h], "EMA20_1h");
  const ema50_1h = finite(oneHour.ema50[index1h], "EMA50_1h");
  const ema50_4h = finite(fourHour.ema50[index4h], "EMA50_4h");
  const ema200_4h = finite(fourHour.ema200[index4h], "EMA200_4h");
  const ema200_4h_5 = finite(fourHour.ema200[index4h - 5], "EMA200_4h five-bar slope");
  const ema20_1h_3 = finite(oneHour.ema20[index1h - 3], "EMA20_1h three-bar slope");
  const normalizedAtrPrice = atr1h / close1h;
  if (normalizedAtrPrice <= 0) throw new Error("R13 feature normalized ATR must be positive.");
  const rollingVolatility: number[] = [];
  const rollingStart = Math.max(0, index1h - ROLLING_30_DAYS_HOURS + 1);
  for (let index = rollingStart; index <= index1h; index += 1) {
    const atr = oneHour.atr14[index];
    const close = candles1h[index]!.close;
    if (atr !== null && close > 0) rollingVolatility.push(atr / close);
  }
  if (rollingVolatility.length < ROLLING_30_DAYS_HOURS) throw new Error("R13 feature requires the fixed past 30 closed days for F11.");
  const previousVolumes = candles1h.slice(Math.max(0, index1h - 20), index1h).map((candle) => candle.quoteVolume);
  if (previousVolumes.length !== 20 || previousVolumes.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("R13 feature requires 20 prior closed quote volumes for F12.");
  const volumeRatio = ratio(candles1h[index1h]!.quoteVolume, median(previousVolumes), "quote volume");
  if (volumeRatio <= 0) throw new Error("R13 feature current quote volume must be positive.");
  const takerBuyRatio = ratio(candles1h[index1h]!.takerBuyQuoteVolume, candles1h[index1h]!.quoteVolume, "taker imbalance");
  const btcCandles = closedCandles(input.allSymbolCandles1h.BTCUSDT ?? [], input.signalTime);
  const btcIndex = latestIndex(btcCandles, input.signalTime, true);
  const symbolReturn12h = returnOver(candles1h, index1h, 12);
  const symbolReturn24h = returnOver(candles1h, index1h, 24);
  const btcReturn12h = returnOver(btcCandles, btcIndex, 12);
  const btcReturn24h = returnOver(btcCandles, btcIndex, 24);
  const latestSettledFunding = latestFunding(input.funding, input.signalTime);
  const crossSection = R13_SYMBOLS_FOR_BREADTH.map((symbol) => featureFromSymbolAtDecision(input.allSymbolCandles1h[symbol] ?? [], input.signalTime));
  const aboveEma50 = crossSection.filter((value) => value.close > value.ema50).length / crossSection.length;
  const positiveMomentum = crossSection.filter((value) => value.return12h > 0).length / crossSection.length;
  const values: readonly number[] = [
    direction * ratio(close4h - ema200_4h, atr4h, "F01"),
    direction * ratio(ema50_4h - ema200_4h, atr4h, "F02"),
    direction * ratio(ema200_4h - ema200_4h_5, atr4h, "F03"),
    direction * ratio(symbolReturn12h, normalizedAtrPrice, "F04"),
    direction * ratio(ema20_1h - ema50_1h, atr1h, "F05"),
    direction * ratio(ema20_1h - ema20_1h_3, atr1h, "F06"),
    direction * ratio(returnOver(candles1h, index1h, 4), normalizedAtrPrice, "F07"),
    direction * ratio(symbolReturn12h, normalizedAtrPrice, "F08"),
    direction * ratio(close1h - ema20_1h, atr1h, "F09"),
    ratio(atr1h, close1h, "F10"),
    percentileRank(atr1h / close1h, rollingVolatility),
    Math.max(-5, Math.min(5, Math.log(volumeRatio))),
    input.direction === "LONG" ? 2 * takerBuyRatio - 1 : 1 - 2 * takerBuyRatio,
    direction * (symbolReturn12h - btcReturn12h),
    direction * (symbolReturn24h - btcReturn24h),
    -direction * latestSettledFunding.fundingRate,
    input.direction === "LONG" ? aboveEma50 : 1 - aboveEma50,
    input.direction === "LONG" ? positiveMomentum : 1 - positiveMomentum,
  ];
  return featureVectorFromOrderedValues(values);
}

const R13_SYMBOLS_FOR_BREADTH = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const;

export function featureVectorFromOrderedValues(values: readonly number[]): R13FeatureVector {
  if (values.length !== R13_FEATURE_NAMES.length || values.some((value) => !Number.isFinite(value))) throw new Error("R13 feature vector has an invalid shape or non-finite value.");
  return Object.freeze(Object.fromEntries(R13_FEATURE_NAMES.map((name, index) => [name, values[index]!])) as Record<R13FeatureName, number>);
}

export function r13DirectionSign(direction: R13Direction): 1 | -1 {
  return directionSign(direction);
}

export function r13ClosedCandleHistory(candles: readonly Candle[], signalTime: number): readonly Candle[] {
  return closedCandles(candles, signalTime);
}

export function r13Atr14AtDecision(candles: readonly Candle[], signalTime: number): number {
  const closed = closedCandles(candles, signalTime);
  const index = latestIndex(closed, signalTime, true);
  return finite(indicators(closed).atr14[index], "ATR14_1h");
}

export const R13_FEATURE_FORMULA_COUNT = R13_FEATURE_NAMES.length;
export const R13_INTERVAL_CONSTANTS = Object.freeze({ HOUR_MS, FOUR_HOUR_MS, ROLLING_30_DAYS_HOURS });
