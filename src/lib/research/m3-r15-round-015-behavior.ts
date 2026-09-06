import { R15_SYMBOLS, R15_TARGET_THRESHOLD, type R15Direction } from "./m3-r15-round-015-protocol.ts";

export type R15MetricDecile = Readonly<{ decile: number; count: number; mean: number | null }>;

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function symbolOrder(symbol: string): number {
  return R15_SYMBOLS.indexOf(symbol as (typeof R15_SYMBOLS)[number]);
}

function directionOrder(direction: R15Direction): number {
  return direction === "LONG" ? 0 : 1;
}

export function r15Ranks(values: readonly number[]): readonly number[] {
  const order = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index);
  const output = Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start + 1;
    while (end < order.length && order[end]!.value === order[start]!.value) end += 1;
    const averageRank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) output[order[index]!.index] = averageRank;
    start = end;
  }
  return Object.freeze(output);
}

function pearson(left: readonly number[], right: readonly number[]): number | null {
  if (left.length < 2 || left.length !== right.length) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index]! - rightMean), 0);
  const leftDenom = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0));
  const rightDenom = Math.sqrt(right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
  return leftDenom === 0 || rightDenom === 0 ? null : numerator / (leftDenom * rightDenom);
}

export function r15Spearman(left: readonly number[], right: readonly number[]): number | null {
  if (left.length < 2 || left.length !== right.length) return null;
  return pearson(r15Ranks(left), r15Ranks(right));
}

export type R15SelectionPrediction = Readonly<{ symbol: string; direction: R15Direction; predictedNetAtr: number }>;

export function r15SelectTopOne<T extends R15SelectionPrediction>(predictions: readonly T[]): T | null {
  const finite = predictions.filter((prediction) => Number.isFinite(prediction.predictedNetAtr));
  const top = [...finite].sort((left, right) => right.predictedNetAtr - left.predictedNetAtr || symbolOrder(left.symbol) - symbolOrder(right.symbol) || directionOrder(left.direction) - directionOrder(right.direction))[0];
  return top && top.predictedNetAtr >= R15_TARGET_THRESHOLD ? top : null;
}

export function r15Deciles(reportedValues: readonly number[], sortValues: readonly number[]): readonly R15MetricDecile[] {
  if (reportedValues.length !== sortValues.length) throw new Error("R15 decile inputs must have equal lengths.");
  return Object.freeze(Array.from({ length: 10 }, (_, decile) => {
    const bucket = sortValues.map((sortValue, index) => ({ sortValue, reportedValue: reportedValues[index]!, index })).sort((left, right) => left.sortValue - right.sortValue || left.reportedValue - right.reportedValue || left.index - right.index);
    const start = Math.floor(bucket.length * decile / 10);
    const end = Math.floor(bucket.length * (decile + 1) / 10);
    const selected = bucket.slice(start, end).map((value) => value.reportedValue);
    return Object.freeze({ decile, count: selected.length, mean: mean(selected) });
  }));
}

export type R15PredictedRealized = Readonly<{ predicted: number; realized: number; symbol: string }>;

export function r15OrderByPredictionDescending<T extends R15PredictedRealized>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values].sort((left, right) => right.predicted - left.predicted || symbolOrder(left.symbol) - symbolOrder(right.symbol)));
}

export function r15TopBottomRealizedSpread(values: readonly R15PredictedRealized[]): number | null {
  const ordered = r15OrderByPredictionDescending(values);
  return ordered.length === 0 ? null : ordered[0]!.realized - ordered[ordered.length - 1]!.realized;
}
