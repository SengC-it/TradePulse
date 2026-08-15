export type ScoreBreakdown = {
  trendStrength: number;
  pullbackQuality: number;
  breakoutStrength: number;
  volumeScore: number;
  riskRewardScore: number;
};

export function calculateScoreTotal(breakdown: ScoreBreakdown): number {
  const rawTotal =
    breakdown.trendStrength +
    breakdown.pullbackQuality +
    breakdown.breakoutStrength +
    breakdown.volumeScore +
    breakdown.riskRewardScore;

  // The database stores every score field to two decimal places. Normalize
  // the JavaScript representation before comparing it with that exact value.
  return Math.round((rawTotal + Number.EPSILON) * 100) / 100;
}

export function areScoresConsistent(input: {
  signalScore: number;
  totalScore: number;
  breakdown: ScoreBreakdown;
}): boolean {
  const calculatedTotal = calculateScoreTotal(input.breakdown);

  return input.totalScore === calculatedTotal && input.signalScore === input.totalScore;
}
