import type { IndicatorSeries } from "./ema.ts";

function calculateRsiValue(averageGain: number, averageLoss: number): number | null {
  if (!Number.isFinite(averageGain) || !Number.isFinite(averageLoss)) {
    return null;
  }

  if (averageLoss === 0 && averageGain > 0) {
    return 100;
  }
  if (averageGain === 0 && averageLoss > 0) {
    return 0;
  }
  if (averageGain === 0 && averageLoss === 0) {
    return 50;
  }
  if (averageLoss <= 0) {
    return null;
  }

  const relativeStrength = averageGain / averageLoss;
  const rsi = 100 - 100 / (1 + relativeStrength);
  return Number.isFinite(rsi) ? rsi : null;
}

export function calculateWilderRsi(
  closes: readonly number[],
  period = 14,
): IndicatorSeries {
  const result: Array<number | null> = Array.from({ length: closes.length }, () => null);

  if (!Number.isInteger(period) || period <= 0 || closes.length <= period) {
    return Object.freeze(result);
  }

  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const previousClose = closes[index - 1];
    const close = closes[index];
    if (!Number.isFinite(previousClose) || !Number.isFinite(close)) {
      return Object.freeze(result);
    }

    const delta = close - previousClose;
    averageGain += Math.max(delta, 0);
    averageLoss += Math.max(-delta, 0);
  }

  averageGain /= period;
  averageLoss /= period;
  result[period] = calculateRsiValue(averageGain, averageLoss);

  if (result[period] === null) {
    return Object.freeze(result);
  }

  for (let index = period + 1; index < closes.length; index += 1) {
    const previousClose = closes[index - 1];
    const close = closes[index];
    if (!Number.isFinite(previousClose) || !Number.isFinite(close)) {
      break;
    }

    const delta = close - previousClose;
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    result[index] = calculateRsiValue(averageGain, averageLoss);

    if (result[index] === null) {
      break;
    }
  }

  return Object.freeze(result);
}

export function calculateRsi14(closes: readonly number[]): IndicatorSeries {
  return calculateWilderRsi(closes, 14);
}
