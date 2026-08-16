import type { IndicatorSeries } from "../indicators/ema.ts";
import type { ResearchSymbol } from "../config/constants.ts";
import type { Candle } from "../market-data/types.ts";
import type {
  BTCRegime,
  StrategyDirection,
  StrategyReasonCode,
  SymbolRegime,
} from "./types.ts";

export type CandidateInput = Readonly<{
  symbol: ResearchSymbol;
  direction: StrategyDirection;
  candles1h: readonly Candle[];
  candles4h: readonly Candle[];
  ema20_1h: IndicatorSeries;
  ema50_1h: IndicatorSeries;
  rsi14_1h: IndicatorSeries;
  atr14_1h: IndicatorSeries;
  ema50_4h: IndicatorSeries;
  ema200_4h: IndicatorSeries;
  atr14_4h: IndicatorSeries;
  symbolRegime: SymbolRegime | null;
  btcRegime: BTCRegime | null;
}>;

export type CandidateFeatures = Readonly<{
  entryReference: number;
  stopReference: number;
  takeProfitReference: number;
  stopDistance: number;
  stopAtr: number;
  pullbackQuality: number;
  breakoutDistance: number;
  volumeRatio: number;
  close4h: number;
  ema50_4h: number;
  ema200_4h: number;
  ema200FiveBarsAgo: number;
  atr14_4h: number;
  atr14_1h: number;
}>;

export type CandidateResult =
  | Readonly<{
      kind: "INELIGIBLE";
      reason: StrategyReasonCode;
    }>
  | Readonly<{
      kind: "ELIGIBLE";
      features: CandidateFeatures;
    }>;

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function finiteCandle(candle: Candle | undefined): boolean {
  if (!candle) {
    return false;
  }

  return [
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
  ].every((value) => Number.isFinite(value)) && candle.high >= candle.low;
}

function finiteCandleSeries(candles: readonly Candle[]): boolean {
  return candles.every(finiteCandle);
}

function valueAt(series: IndicatorSeries, index: number): number | null {
  const value = series[index];
  return finite(value) ? value : null;
}

function ineligible(reason: StrategyReasonCode): CandidateResult {
  return Object.freeze({ kind: "INELIGIBLE", reason });
}

function recencyBonus(offset: number): number {
  if (offset <= 2) {
    return 5;
  }

  if (offset === 3) {
    return 3;
  }

  return 1;
}

export function evaluateCandidate(input: CandidateInput): CandidateResult {
  const { candles1h, candles4h } = input;
  const signalIndex = candles1h.length - 1;
  const trendIndex = candles4h.length - 1;

  // EMA50 must already exist at t-5, so the 1H series needs 50 seed candles
  // plus the five fully closed candles in W_t before the signal candle.
  if (candles1h.length < 55 || candles4h.length < 205) {
    return ineligible("INSUFFICIENT_HISTORY");
  }

  if (!finiteCandleSeries(candles1h) || !finiteCandleSeries(candles4h)) {
    return ineligible("INVALID_CANDLE_SERIES");
  }

  const atr14_4h = valueAt(input.atr14_4h, trendIndex);
  if (atr14_4h === null) {
    return ineligible("INDICATOR_UNAVAILABLE");
  }

  if (atr14_4h <= 0) {
    return ineligible("INVALID_ATR");
  }

  const close4h = candles4h[trendIndex]?.close;
  const ema50_4h = valueAt(input.ema50_4h, trendIndex);
  const ema200_4h = valueAt(input.ema200_4h, trendIndex);
  const ema200FiveBarsAgo = valueAt(input.ema200_4h, trendIndex - 5);

  if (
    !finite(close4h) ||
    ema50_4h === null ||
    ema200_4h === null ||
    ema200FiveBarsAgo === null
  ) {
    return ineligible("INDICATOR_UNAVAILABLE");
  }

  if (input.symbolRegime === null) {
    return ineligible("INDICATOR_UNAVAILABLE");
  }

  if (input.symbolRegime === "NO_TRADE") {
    return ineligible("SYMBOL_REGIME_NO_TRADE");
  }

  if (
    (input.direction === "LONG" && input.symbolRegime !== "LONG_ONLY") ||
    (input.direction === "SHORT" && input.symbolRegime !== "SHORT_ONLY")
  ) {
    return ineligible("SYMBOL_DIRECTION_MISMATCH");
  }

  if (input.btcRegime === null) {
    return ineligible("INVALID_BTC_INPUT");
  }

  if (
    input.symbol !== "BTCUSDT" &&
    ((input.btcRegime === "BTC_STRONG_BULL" && input.direction === "SHORT") ||
      (input.btcRegime === "BTC_STRONG_BEAR" && input.direction === "LONG"))
  ) {
    return ineligible("BTC_DIRECTION_BLOCKED");
  }

  const atr14_1h = valueAt(input.atr14_1h, signalIndex);
  const rsi14_1h = valueAt(input.rsi14_1h, signalIndex);
  const entryReference = candles1h[signalIndex]?.close;

  if (atr14_1h === null || rsi14_1h === null || !finite(entryReference)) {
    return ineligible("INDICATOR_UNAVAILABLE");
  }

  if (atr14_1h <= 0) {
    return ineligible("INVALID_ATR");
  }

  const volumeWindow = candles1h.slice(signalIndex - 20, signalIndex);
  if (
    volumeWindow.length !== 20 ||
    !volumeWindow.every((candle) => finite(candle.quoteVolume))
  ) {
    return ineligible("INVALID_VOLUME_BASELINE");
  }

  const previous20QuoteVolumeMean =
    volumeWindow.reduce((sum, candle) => sum + candle.quoteVolume, 0) / 20;
  const currentQuoteVolume = candles1h[signalIndex]?.quoteVolume;

  if (!finite(previous20QuoteVolumeMean) || previous20QuoteVolumeMean <= 0) {
    return ineligible("INVALID_VOLUME_BASELINE");
  }

  if (!finite(currentQuoteVolume)) {
    return ineligible("INVALID_VOLUME_BASELINE");
  }

  const volumeRatio = currentQuoteVolume / previous20QuoteVolumeMean;
  if (!finite(volumeRatio)) {
    return ineligible("INVALID_VOLUME_BASELINE");
  }

  const pullbackStart = signalIndex - 5;
  let ema20Touched = false;
  let ema50Touched = false;
  let latestTouchOffset = Number.POSITIVE_INFINITY;

  for (let offset = 1; offset <= 5; offset += 1) {
    const index = signalIndex - offset;
    const candle = candles1h[index];
    const ema20 = valueAt(input.ema20_1h, index);
    const ema50 = valueAt(input.ema50_1h, index);

    if (!candle || ema20 === null || ema50 === null) {
      return ineligible("INDICATOR_UNAVAILABLE");
    }

    const touched =
      input.direction === "LONG"
        ? candle.low <= ema20 || candle.low <= ema50
        : candle.high >= ema20 || candle.high >= ema50;

    if (!touched) {
      continue;
    }

    latestTouchOffset = Math.min(latestTouchOffset, offset);
    if (
      input.direction === "LONG"
        ? candle.low <= ema20
        : candle.high >= ema20
    ) {
      ema20Touched = true;
    }

    if (
      input.direction === "LONG"
        ? candle.low <= ema50
        : candle.high >= ema50
    ) {
      ema50Touched = true;
    }
  }

  if (!ema20Touched && !ema50Touched) {
    return ineligible("PULLBACK_NOT_FOUND");
  }

  const pullbackQuality =
    (ema50Touched ? 15 : 10) + recencyBonus(latestTouchOffset);

  const breakoutCandles = candles1h.slice(signalIndex - 3, signalIndex);
  if (breakoutCandles.length !== 3) {
    return ineligible("INSUFFICIENT_HISTORY");
  }

  const priorHigh = Math.max(...breakoutCandles.map((candle) => candle.high));
  const priorLow = Math.min(...breakoutCandles.map((candle) => candle.low));
  const breakoutDistance =
    input.direction === "LONG"
      ? (entryReference - priorHigh) / atr14_1h
      : (priorLow - entryReference) / atr14_1h;

  if (!finite(breakoutDistance) || breakoutDistance <= 0) {
    return ineligible("BREAKOUT_NOT_CONFIRMED");
  }

  if (
    (input.direction === "LONG" && !(rsi14_1h > 50 && rsi14_1h < 70)) ||
    (input.direction === "SHORT" && !(rsi14_1h > 30 && rsi14_1h < 50))
  ) {
    return ineligible("RSI_OUT_OF_RANGE");
  }

  const windowCandles = candles1h.slice(pullbackStart, signalIndex);
  const stopReference =
    input.direction === "LONG"
      ? Math.min(...windowCandles.map((candle) => candle.low)) - 0.2 * atr14_1h
      : Math.max(...windowCandles.map((candle) => candle.high)) + 0.2 * atr14_1h;
  const stopDistance = Math.abs(entryReference - stopReference);
  const stopAtr = stopDistance / atr14_1h;

  if (!finite(stopReference) || !finite(stopDistance) || !finite(stopAtr)) {
    return ineligible("INVALID_ATR");
  }

  if (stopAtr < 0.8 || stopAtr > 3) {
    return ineligible("STOP_ATR_OUT_OF_RANGE");
  }

  const takeProfitReference =
    input.direction === "LONG"
      ? entryReference + 2 * stopDistance
      : entryReference - 2 * stopDistance;

  if (!finite(takeProfitReference)) {
    return ineligible("INDICATOR_UNAVAILABLE");
  }

  return Object.freeze({
    kind: "ELIGIBLE",
    features: Object.freeze({
      entryReference,
      stopReference,
      takeProfitReference,
      stopDistance,
      stopAtr,
      pullbackQuality,
      breakoutDistance,
      volumeRatio,
      close4h,
      ema50_4h,
      ema200_4h,
      ema200FiveBarsAgo,
      atr14_4h,
      atr14_1h,
    }),
  });
}
