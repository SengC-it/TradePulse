import type { Candle } from "../market-data/types.ts";

import type { IndicatorSeries } from "./ema.ts";

function isValidCandleForAtr(candle: Candle): boolean {
  return (
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    candle.high >= candle.low
  );
}

export function calculateWilderAtr(
  candles: readonly Candle[],
  period = 14,
): IndicatorSeries {
  const result: Array<number | null> = Array.from({ length: candles.length }, () => null);

  if (!Number.isInteger(period) || period <= 0 || candles.length < period) {
    return Object.freeze(result);
  }

  let averageTrueRange: number | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!isValidCandleForAtr(candle)) {
      break;
    }

    const previousClose = index === 0 ? null : candles[index - 1]?.close;
    if (index > 0 && !Number.isFinite(previousClose)) {
      break;
    }

    const trueRange =
      index === 0
        ? candle.high - candle.low
        : Math.max(
            candle.high - candle.low,
            Math.abs(candle.high - (previousClose as number)),
            Math.abs(candle.low - (previousClose as number)),
          );

    if (!Number.isFinite(trueRange) || trueRange < 0) {
      break;
    }

    if (index < period - 1) {
      continue;
    }

    if (index === period - 1) {
      const initialTrueRanges: number[] = [];
      for (let seedIndex = 0; seedIndex <= index; seedIndex += 1) {
        const seedCandle = candles[seedIndex];
        const seedPreviousClose = seedIndex === 0 ? null : candles[seedIndex - 1]?.close;
        if (
          !isValidCandleForAtr(seedCandle) ||
          (seedIndex > 0 && !Number.isFinite(seedPreviousClose))
        ) {
          return Object.freeze(result);
        }
        const seedTrueRange =
          seedIndex === 0
            ? seedCandle.high - seedCandle.low
            : Math.max(
                seedCandle.high - seedCandle.low,
                Math.abs(seedCandle.high - (seedPreviousClose as number)),
                Math.abs(seedCandle.low - (seedPreviousClose as number)),
              );
        if (!Number.isFinite(seedTrueRange) || seedTrueRange < 0) {
          return Object.freeze(result);
        }
        initialTrueRanges.push(seedTrueRange);
      }

      averageTrueRange = initialTrueRanges.reduce((sum, item) => sum + item, 0) / period;
      if (!Number.isFinite(averageTrueRange)) {
        return Object.freeze(result);
      }
      result[index] = averageTrueRange;
      continue;
    }

    if (averageTrueRange === null) {
      break;
    }
    averageTrueRange = (averageTrueRange * (period - 1) + trueRange) / period;
    if (!Number.isFinite(averageTrueRange)) {
      break;
    }
    result[index] = averageTrueRange;
  }

  return Object.freeze(result);
}

export function calculateAtr14(candles: readonly Candle[]): IndicatorSeries {
  return calculateWilderAtr(candles, 14);
}
