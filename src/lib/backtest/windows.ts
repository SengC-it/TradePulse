import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import type { StrategyDataset, StrategyInput } from "../strategy/types.ts";
import { validateHistoricalCandleSeries } from "../historical-data/validation.ts";
import { BacktestError } from "./errors.ts";
import { BACKTEST_POLICY, BACKTEST_PERIOD_RANGES, type BacktestPeriod } from "./constants.ts";

export type IndexedCandleSeries = Readonly<{
  candles: readonly Candle[];
  closeTimes: readonly number[];
  openTimes: readonly number[];
  timeframe: "1h" | "4h";
}>;

export type IndexedSymbolDataset = Readonly<{
  candles1h: IndexedCandleSeries;
  candles4h: IndexedCandleSeries;
}>;

export type HistoricalIndexes = Readonly<{
  bySymbol: Readonly<Record<ResearchSymbol, IndexedSymbolDataset>>;
  timeline1h: readonly number[];
}>;

function assertEvaluationTime(evaluationTime: number): void {
  if (!Number.isInteger(evaluationTime) || evaluationTime < 0) {
    throw new BacktestError("INVALID_INPUT", "Backtest evaluationTime must be a UTC epoch millisecond integer.");
  }
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (values[middle]! < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function rightMostClosedIndex(series: IndexedCandleSeries, evaluationTime: number): number {
  assertEvaluationTime(evaluationTime);
  let low = 0;
  let high = series.closeTimes.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    if (series.closeTimes[middle]! <= evaluationTime) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

function asDataIncomplete(error: unknown, fallback: string): never {
  throw new BacktestError("DATA_INCOMPLETE", error instanceof Error ? error.message : fallback);
}

function indexSeries(
  symbol: ResearchSymbol,
  timeframe: "1h" | "4h",
  candles: readonly Candle[],
): IndexedCandleSeries {
  let normalized: readonly Candle[];
  try {
    normalized = validateHistoricalCandleSeries(candles, { symbol, timeframe });
  } catch (error) {
    asDataIncomplete(error, `Historical ${timeframe} series is invalid for ${symbol}.`);
  }
  return Object.freeze({
    candles: normalized,
    closeTimes: Object.freeze(normalized.map((candle) => candle.closeTime)),
    openTimes: Object.freeze(normalized.map((candle) => candle.openTime)),
    timeframe,
  });
}

export function buildHistoricalIndexes(
  datasets: Readonly<Record<ResearchSymbol, Readonly<{ candles1h: readonly Candle[]; candles4h: readonly Candle[] }>>>,
): HistoricalIndexes {
  const bySymbol = {} as Record<ResearchSymbol, IndexedSymbolDataset>;
  for (const symbol of RESEARCH_SYMBOLS) {
    const dataset = datasets[symbol];
    if (!dataset) {
      throw new BacktestError("DATA_INCOMPLETE", `Historical dataset is missing for ${symbol}.`);
    }
    bySymbol[symbol] = Object.freeze({
      candles1h: indexSeries(symbol, "1h", dataset.candles1h),
      candles4h: indexSeries(symbol, "4h", dataset.candles4h),
    });
  }

  const timeline1h = bySymbol.BTCUSDT!.candles1h.closeTimes;
  for (const symbol of RESEARCH_SYMBOLS) {
    const symbolTimeline = bySymbol[symbol]!.candles1h.closeTimes;
    if (
      symbolTimeline.length !== timeline1h.length ||
      symbolTimeline.some((closeTime, index) => closeTime !== timeline1h[index])
    ) {
      throw new BacktestError("DATA_INCOMPLETE", `${symbol} is not aligned to the BTCUSDT 1H evaluation timeline.`);
    }
  }

  return Object.freeze({
    bySymbol: Object.freeze(bySymbol),
    timeline1h: Object.freeze([...timeline1h]),
  });
}

function windowFromIndex(
  series: IndexedCandleSeries,
  evaluationTime: number,
  requiredCandles: number,
): readonly Candle[] {
  const rightMost = rightMostClosedIndex(series, evaluationTime);
  const first = rightMost - requiredCandles + 1;
  if (first < 0) {
    throw new BacktestError(
      "DATA_INCOMPLETE",
      `Exactly ${requiredCandles} fully closed candles are required for the strategy window.`,
    );
  }
  const window = series.candles.slice(first, rightMost + 1);
  if (window.length !== requiredCandles) {
    throw new BacktestError("DATA_INCOMPLETE", "The historical strategy window is not complete.");
  }
  return Object.freeze([...window]);
}

export function latestAsOfWindow(
  candles: readonly Candle[],
  evaluationTime: number,
  requiredCandles = BACKTEST_POLICY.strategyWindowCandles,
): readonly Candle[] {
  assertEvaluationTime(evaluationTime);
  if (!Number.isInteger(requiredCandles) || requiredCandles < 1) {
    throw new BacktestError("INVALID_INPUT", "The as-of window size must be a positive integer.");
  }
  const first = candles[0];
  if (!first || (first.timeframe !== "1h" && first.timeframe !== "4h")) {
    throw new BacktestError("DATA_INCOMPLETE", "The historical strategy window has no valid timeframe.");
  }
  return windowFromIndex(indexSeries(first.symbol, first.timeframe, candles), evaluationTime, requiredCandles);
}

export const buildAsOfWindow = latestAsOfWindow;

export function buildStrategyInputFromIndexes(indexes: HistoricalIndexes, evaluationTime: number): StrategyInput {
  assertEvaluationTime(evaluationTime);
  const normalized = {} as Record<ResearchSymbol, StrategyDataset>;
  for (const symbol of RESEARCH_SYMBOLS) {
    const dataset = indexes.bySymbol[symbol];
    normalized[symbol] = Object.freeze({
      symbol,
      candles1h: windowFromIndex(dataset.candles1h, evaluationTime, BACKTEST_POLICY.strategyWindowCandles),
      candles4h: windowFromIndex(dataset.candles4h, evaluationTime, BACKTEST_POLICY.strategyWindowCandles),
    });
  }
  return Object.freeze({ evaluationTime, datasets: Object.freeze(normalized) });
}

export function buildStrategyInput(
  datasets: Readonly<Record<ResearchSymbol, Readonly<{ candles1h: readonly Candle[]; candles4h: readonly Candle[] }>>>,
  evaluationTime: number,
): StrategyInput {
  return buildStrategyInputFromIndexes(buildHistoricalIndexes(datasets), evaluationTime);
}

export const buildAsOfStrategyInput = buildStrategyInput;
export const buildRollingStrategyInput = buildStrategyInput;
export const getLatestAsOfWindow = latestAsOfWindow;

export function findCandleIndexAtCloseTime(series: IndexedCandleSeries, closeTime: number): number {
  const index = lowerBound(series.closeTimes, closeTime);
  return series.closeTimes[index] === closeTime ? index : -1;
}

export function findSignalCandle(candles: readonly Candle[], signalTime: number): Candle {
  const first = candles[0];
  if (!first || first.timeframe !== "1h") {
    throw new BacktestError("DATA_INCOMPLETE", "The signal candle series is unavailable.");
  }
  const series = indexSeries(first.symbol, "1h", candles);
  const index = findCandleIndexAtCloseTime(series, signalTime);
  if (index < 0) {
    throw new BacktestError("DATA_INCOMPLETE", "The signal candle is not present in the historical 1H series.");
  }
  return series.candles[index]!;
}

export function getHeldCandlesFromIndex(
  series: IndexedCandleSeries,
  signalTime: number,
  heldCandleCount = BACKTEST_POLICY.heldCandleCount,
): readonly Candle[] {
  const signalIndex = findCandleIndexAtCloseTime(series, signalTime);
  if (signalIndex < 0) {
    throw new BacktestError("DATA_INCOMPLETE", "The signal candle is not present in the historical 1H series.");
  }
  const signalCandle = series.candles[signalIndex]!;
  const held = series.candles.slice(signalIndex + 1, signalIndex + 1 + heldCandleCount);
  if (held.length !== heldCandleCount) {
    throw new BacktestError("DATA_INCOMPLETE", `Exactly ${heldCandleCount} held candles are required; no held #25 exists.`);
  }
  for (let index = 0; index < held.length; index += 1) {
    const expectedOpen = signalCandle.openTime + INTERVAL_MS["1h"] * (index + 1);
    if (held[index]!.openTime !== expectedOpen) {
      throw new BacktestError("DATA_INCOMPLETE", "The required held 1H candles contain a gap.");
    }
  }
  return Object.freeze([...held]);
}

export function getHeldCandles(
  candles: readonly Candle[],
  signalTime: number,
  heldCandleCount = BACKTEST_POLICY.heldCandleCount,
): readonly Candle[] {
  const first = candles[0];
  if (!first || first.timeframe !== "1h") {
    throw new BacktestError("DATA_INCOMPLETE", "The held-candle series is unavailable.");
  }
  return getHeldCandlesFromIndex(indexSeries(first.symbol, "1h", candles), signalTime, heldCandleCount);
}

export function evaluationTimesForPeriod(
  indexes: HistoricalIndexes,
  period: Exclude<BacktestPeriod, "COMBINED">,
): readonly number[] {
  const range = BACKTEST_PERIOD_RANGES[period];
  const startIndex = lowerBound(indexes.timeline1h, range.startTime);
  const endIndex = lowerBound(indexes.timeline1h, range.endTime + 1);
  const times = indexes.timeline1h.slice(startIndex, endIndex);
  if (times.length === 0) {
    throw new BacktestError("DATA_INCOMPLETE", `No 1H evaluation points are available for ${period}.`);
  }
  return Object.freeze([...times]);
}
