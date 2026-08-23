import type { ReviewMetrics } from "./types.ts";

type ResolvedResult = Readonly<{
  resultR: number | null;
}>;

export function calculateReviewMetrics(rows: readonly ResolvedResult[]): ReviewMetrics {
  const values = rows
    .map((row) => row.resultR)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length === 0) {
    return {
      hasValidSample: false,
      reviewedSignals: 0,
      wins: 0,
      losses: 0,
      winRate: null,
      cumulativeR: null,
      averageR: null,
      profitFactor: null,
      maxDrawdownR: null,
    };
  }

  const wins = values.filter((value) => value > 0).length;
  const losses = values.filter((value) => value < 0).length;
  const cumulativeR = values.reduce((total, value) => total + value, 0);
  let runningR = 0;
  let peakR = 0;
  let maxDrawdownR = 0;
  for (const value of values) {
    runningR += value;
    peakR = Math.max(peakR, runningR);
    maxDrawdownR = Math.min(maxDrawdownR, runningR - peakR);
  }

  const positiveR = values.filter((value) => value > 0).reduce((total, value) => total + value, 0);
  const negativeR = Math.abs(values.filter((value) => value < 0).reduce((total, value) => total + value, 0));

  return {
    hasValidSample: true,
    reviewedSignals: values.length,
    wins,
    losses,
    winRate: wins / values.length,
    cumulativeR,
    averageR: cumulativeR / values.length,
    profitFactor: negativeR > 0 ? positiveR / negativeR : positiveR > 0 ? Number.POSITIVE_INFINITY : null,
    maxDrawdownR,
  };
}
