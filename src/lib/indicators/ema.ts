export type IndicatorValue = number | null;
export type IndicatorSeries = readonly IndicatorValue[];

export function calculateEma(
  values: readonly number[],
  period: number,
): IndicatorSeries {
  const result: IndicatorValue[] = Array.from({ length: values.length }, () => null);

  if (!Number.isInteger(period) || period <= 0 || values.length === 0) {
    return Object.freeze(result);
  }

  const alpha = 2 / (period + 1);

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) {
      break;
    }

    if (index < period - 1) {
      continue;
    }

    if (index === period - 1) {
      const seed = values.slice(0, period);
      const seedSum = seed.reduce((sum, item) => sum + item, 0);
      const seedValue = seedSum / period;
      if (!Number.isFinite(seedValue)) {
        break;
      }
      result[index] = seedValue;
      continue;
    }

    const previous = result[index - 1];
    if (previous === null || !Number.isFinite(previous)) {
      break;
    }

    const next = alpha * value + (1 - alpha) * previous;
    if (!Number.isFinite(next)) {
      break;
    }
    result[index] = next;
  }

  return Object.freeze(result);
}

export function calculateEma20(values: readonly number[]): IndicatorSeries {
  return calculateEma(values, 20);
}

export function calculateEma50(values: readonly number[]): IndicatorSeries {
  return calculateEma(values, 50);
}

export function calculateEma200(values: readonly number[]): IndicatorSeries {
  return calculateEma(values, 200);
}
