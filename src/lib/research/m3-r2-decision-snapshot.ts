import { calculateAtr14 } from "../indicators/atr.ts";
import { calculateEma20, calculateEma50, calculateEma200 } from "../indicators/ema.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol, STRATEGY_VERSION } from "../config/constants.ts";
import type { Candle } from "../market-data/types.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { StrategyCandidate, StrategyDataset, StrategyDirection, BTCRegime } from "../strategy/types.ts";
import {
  M3_R2_ROUND_002_DECISION_SNAPSHOT_FIELDS,
  M3_R2_ROUND_002_FORBIDDEN_SELECTOR_FIELDS,
} from "./m3-r2-round-002-plan.ts";
import { requireSafeTimestamp } from "./utils.ts";

export { M3_R2_ROUND_002_DECISION_SNAPSHOT_FIELDS, M3_R2_ROUND_002_FORBIDDEN_SELECTOR_FIELDS };

export type M3R2DecisionSnapshot = Readonly<{
  signalTime: number;
  symbol: ResearchSymbol;
  direction: StrategyDirection;
  btcRegime: BTCRegime;
  symbol4hClose: number;
  symbol4hEma50: number;
  symbol4hEma200: number;
  symbol4hAtr: number;
  symbol4hEma200FiveBarsAgo: number;
  nearestBaselinePullbackTouchAgeBars: number;
  current1hQuoteVolume: number;
  previous20Closed1hQuoteVolumeMean: number;
  current1hClose: number;
  previous3BreakoutExtreme: number;
  current1hAtr: number;
  breakoutMarginAtr: number;
}>;

export class M3R2FeatureError extends Error {
  public readonly name = "M3R2FeatureError";
}

function fail(message: string): never {
  throw new M3R2FeatureError(message);
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function validSymbol(value: string): value is ResearchSymbol {
  return RESEARCH_SYMBOLS.includes(value as ResearchSymbol);
}

function validDirection(value: string): value is StrategyDirection {
  return value === "LONG" || value === "SHORT";
}

function validBtcRegime(value: string): value is BTCRegime {
  return value === "BTC_STRONG_BULL" || value === "BTC_NEUTRAL" || value === "BTC_STRONG_BEAR";
}

function validateCandle(candle: Candle | undefined, expectedSymbol: ResearchSymbol, expectedTimeframe: "1h" | "4h", previous: Candle | undefined): void {
  if (!candle || candle.symbol !== expectedSymbol || candle.timeframe !== expectedTimeframe) {
    fail(`Invalid ${expectedTimeframe} candle identity.`);
  }
  const finiteValues = [
    candle.openTime,
    candle.closeTime,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
    candle.quoteVolume,
    candle.tradeCount,
    candle.takerBuyBaseVolume,
    candle.takerBuyQuoteVolume,
  ];
  if (!finiteValues.every(finite) || !Number.isSafeInteger(candle.openTime) || !Number.isSafeInteger(candle.closeTime)) {
    fail(`Non-finite or unsafe ${expectedTimeframe} candle value.`);
  }
  if (candle.openTime < 0 || candle.closeTime <= candle.openTime || candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) {
    fail(`Invalid positive OHLC or timestamp in ${expectedTimeframe} candle.`);
  }
  if (candle.high < Math.max(candle.open, candle.close, candle.low) || candle.low > Math.min(candle.open, candle.close, candle.high)) {
    fail(`Invalid OHLC relationship in ${expectedTimeframe} candle.`);
  }
  if (candle.volume < 0 || candle.quoteVolume < 0 || candle.tradeCount < 0 || candle.takerBuyBaseVolume < 0 || candle.takerBuyQuoteVolume < 0) {
    fail(`Invalid non-negative volume fields in ${expectedTimeframe} candle.`);
  }
  const interval = INTERVAL_MS[expectedTimeframe];
  if (candle.closeTime - candle.openTime + 1 !== interval) fail(`Invalid ${expectedTimeframe} candle interval.`);
  if (previous) {
    if (candle.openTime !== previous.openTime + interval || candle.closeTime !== previous.closeTime + interval) {
      fail(`Non-contiguous ${expectedTimeframe} candle series.`);
    }
  }
}

function validateSeries(
  candles: readonly Candle[],
  expectedSymbol: ResearchSymbol,
  timeframe: "1h" | "4h",
  signalTime: number,
): void {
  if (candles.length !== 250) fail(`${timeframe} feature window must contain exactly 250 closed candles.`);
  let previous: Candle | undefined;
  for (const candle of candles) {
    if (candle && Number.isFinite(candle.closeTime) && candle.closeTime > signalTime) {
      fail(`${timeframe} feature window contains future data.`);
    }
    validateCandle(candle, expectedSymbol, timeframe, previous);
    previous = candle;
  }
}

function valueAt(series: readonly (number | null)[], index: number, label: string): number {
  const value = series[index];
  if (value === null || value === undefined || !finite(value)) fail(`${label} is unavailable.`);
  return value;
}

function validateBaselineCandidate(
  signalTime: number,
  baselineCandidate: StrategyCandidate,
  dataset: StrategyDataset,
): void {
  try {
    requireSafeTimestamp(signalTime, "M3-R2 signalTime");
  } catch (error) {
    fail(error instanceof Error ? error.message : "Invalid M3-R2 signalTime.");
  }
  if (!baselineCandidate.formalSignal) fail("M3-R2 snapshot requires a formal baseline signal.");
  if (baselineCandidate.strategyVersion !== STRATEGY_VERSION) fail("M3-R2 baseline strategy version mismatch.");
  if (baselineCandidate.symbol !== dataset.symbol) fail("M3-R2 candidate and dataset symbols differ.");
  if (!validSymbol(dataset.symbol) || !validDirection(baselineCandidate.direction) || !validBtcRegime(baselineCandidate.btcRegime)) {
    fail("M3-R2 candidate identity is invalid.");
  }
}

export function extractM3R2DecisionSnapshot(input: Readonly<{
  signalTime: number;
  baselineCandidate: StrategyCandidate;
  dataset: StrategyDataset;
}>): M3R2DecisionSnapshot {
  validateBaselineCandidate(input.signalTime, input.baselineCandidate, input.dataset);
  const { signalTime, baselineCandidate, dataset } = input;
  validateSeries(dataset.candles1h, dataset.symbol, "1h", signalTime);
  validateSeries(dataset.candles4h, dataset.symbol, "4h", signalTime);

  const candles1h = dataset.candles1h;
  const candles4h = dataset.candles4h;
  const signalIndex = candles1h.length - 1;
  const trendIndex = candles4h.length - 1;
  const signalCandle = candles1h[signalIndex];
  const trendCandle = candles4h[trendIndex];
  if (!signalCandle || signalCandle.closeTime !== signalTime) fail("Final 1H candle must close at signalTime.");
  if (!trendCandle || trendCandle.closeTime > signalTime) fail("Final 4H candle must be closed by signalTime.");

  const closes1h = candles1h.map((candle) => candle.close);
  const closes4h = candles4h.map((candle) => candle.close);
  const ema20_1h = calculateEma20(closes1h);
  const ema50_1h = calculateEma50(closes1h);
  const ema50_4h = calculateEma50(closes4h);
  const ema200_4h = calculateEma200(closes4h);
  const atr14_1h = calculateAtr14(candles1h);
  const atr14_4h = calculateAtr14(candles4h);

  const symbol4hClose = valueAt(closes4h, trendIndex, "symbol4hClose");
  const symbol4hEma50 = valueAt(ema50_4h, trendIndex, "symbol4hEma50");
  const symbol4hEma200 = valueAt(ema200_4h, trendIndex, "symbol4hEma200");
  const symbol4hAtr = valueAt(atr14_4h, trendIndex, "symbol4hAtr");
  const symbol4hEma200FiveBarsAgo = valueAt(ema200_4h, trendIndex - 5, "symbol4hEma200FiveBarsAgo");
  if (symbol4hAtr <= 0) fail("symbol4h ATR must be positive.");

  let nearestBaselinePullbackTouchAgeBars = Number.POSITIVE_INFINITY;
  for (let offset = 1; offset <= 5; offset += 1) {
    const index = signalIndex - offset;
    const candle = candles1h[index];
    const ema20 = valueAt(ema20_1h, index, "baseline EMA20");
    const ema50 = valueAt(ema50_1h, index, "baseline EMA50");
    if (!candle) fail("Baseline pullback candle is unavailable.");
    const touched = baselineCandidate.direction === "LONG"
      ? candle.low <= ema20 || candle.low <= ema50
      : candle.high >= ema20 || candle.high >= ema50;
    if (touched) nearestBaselinePullbackTouchAgeBars = Math.min(nearestBaselinePullbackTouchAgeBars, offset);
  }
  if (!Number.isInteger(nearestBaselinePullbackTouchAgeBars) || nearestBaselinePullbackTouchAgeBars < 1 || nearestBaselinePullbackTouchAgeBars > 5) {
    fail("Baseline pullback touch is unavailable.");
  }

  const current1hQuoteVolume = signalCandle.quoteVolume;
  const previous20 = candles1h.slice(signalIndex - 20, signalIndex).map((candle) => candle.quoteVolume);
  if (previous20.length !== 20 || !previous20.every((value) => finite(value) && value >= 0)) {
    fail("Previous 20 closed 1H quote volumes are unavailable.");
  }
  const previous20Closed1hQuoteVolumeMean = previous20.reduce((sum, value) => sum + value, 0) / previous20.length;
  if (!finite(current1hQuoteVolume) || current1hQuoteVolume < 0 || !finite(previous20Closed1hQuoteVolumeMean) || previous20Closed1hQuoteVolumeMean <= 0) {
    fail("Quote-volume feature denominator is invalid.");
  }

  const current1hAtr = valueAt(atr14_1h, signalIndex, "current1hAtr");
  if (current1hAtr <= 0) fail("current1h ATR must be positive.");
  const previous3 = candles1h.slice(signalIndex - 3, signalIndex);
  if (previous3.length !== 3) fail("Previous 3 breakout candles are unavailable.");
  const previous3BreakoutExtreme = baselineCandidate.direction === "LONG"
    ? Math.max(...previous3.map((candle) => candle.high))
    : Math.min(...previous3.map((candle) => candle.low));
  const breakoutMarginAtr = baselineCandidate.direction === "LONG"
    ? (signalCandle.close - previous3BreakoutExtreme) / current1hAtr
    : (previous3BreakoutExtreme - signalCandle.close) / current1hAtr;
  if (!finite(previous3BreakoutExtreme) || !finite(breakoutMarginAtr) || breakoutMarginAtr <= 0) {
    fail("Breakout feature is unavailable.");
  }

  return Object.freeze({
    signalTime,
    symbol: baselineCandidate.symbol,
    direction: baselineCandidate.direction,
    btcRegime: baselineCandidate.btcRegime,
    symbol4hClose,
    symbol4hEma50,
    symbol4hEma200,
    symbol4hAtr,
    symbol4hEma200FiveBarsAgo,
    nearestBaselinePullbackTouchAgeBars,
    current1hQuoteVolume,
    previous20Closed1hQuoteVolumeMean,
    current1hClose: signalCandle.close,
    previous3BreakoutExtreme,
    current1hAtr,
    breakoutMarginAtr,
  });
}
