import {
  SIGNAL_GRADE_THRESHOLDS,
  SCORE_COMPONENTS,
  type ResearchSymbol,
} from "../config/constants.ts";
import { calculateScoreTotal } from "../scoring/score-consistency.ts";
import type { CandidateFeatures } from "./candidate.ts";
import type {
  SignalGrade,
  StrategyDirection,
  StrategyScoreBreakdown,
} from "./types.ts";

export type StrategyScoreResult = Readonly<{
  breakdown: StrategyScoreBreakdown;
  totalScore: number;
}>;

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function thresholdScore(
  value: number,
  thresholds: readonly [number, number, number, number],
  points: readonly [number, number, number, number],
): number {
  if (value >= thresholds[3]) {
    return points[3];
  }

  if (value >= thresholds[2]) {
    return points[2];
  }

  if (value >= thresholds[1]) {
    return points[1];
  }

  if (value > thresholds[0]) {
    return points[0];
  }

  return 0;
}

function trendStrength(
  direction: StrategyDirection,
  features: CandidateFeatures,
): number {
  const closeDistance =
    direction === "LONG"
      ? (features.close4h - features.ema200_4h) / features.atr14_4h
      : (features.ema200_4h - features.close4h) / features.atr14_4h;
  const emaSpread =
    direction === "LONG"
      ? (features.ema50_4h - features.ema200_4h) / features.atr14_4h
      : (features.ema200_4h - features.ema50_4h) / features.atr14_4h;
  const emaSlope =
    direction === "LONG"
      ? (features.ema200_4h - features.ema200FiveBarsAgo) / features.atr14_4h
      : (features.ema200FiveBarsAgo - features.ema200_4h) / features.atr14_4h;

  if (![closeDistance, emaSpread, emaSlope].every(finite)) {
    return Number.NaN;
  }

  return (
    thresholdScore(closeDistance, [0, 0.5, 1, 1.5], [4, 8, 12, 15]) +
    thresholdScore(emaSpread, [0, 0.25, 0.5, 0.75], [4, 8, 12, 15]) +
    thresholdScore(emaSlope, [0, 0.05, 0.1, 0.2], [2, 5, 8, 10])
  );
}

function breakoutStrength(distance: number): number {
  if (distance >= 0.5) {
    return SCORE_COMPONENTS.breakoutStrength;
  }

  if (distance >= 0.25) {
    return 17;
  }

  if (distance >= 0.1) {
    return 14;
  }

  if (distance > 0) {
    return 10;
  }

  return 0;
}

function volumeScore(ratio: number): number {
  if (ratio >= 1.5) {
    return SCORE_COMPONENTS.volume;
  }

  if (ratio >= 1.2) {
    return 7;
  }

  if (ratio >= 1) {
    return 4;
  }

  return 0;
}

function riskRewardScore(stopAtr: number): number {
  if (stopAtr >= 1 && stopAtr <= 2) {
    return 10;
  }

  if (
    (stopAtr >= 0.8 && stopAtr < 1) ||
    (stopAtr > 2 && stopAtr <= 2.5)
  ) {
    return 7;
  }

  if (stopAtr > 2.5 && stopAtr <= 3) {
    return SCORE_COMPONENTS.riskReward - 6;
  }

  return 0;
}

export function scoreCandidate(
  direction: StrategyDirection,
  features: CandidateFeatures,
): StrategyScoreResult | null {
  const values = [
    features.atr14_4h,
    features.atr14_1h,
    features.stopAtr,
    features.breakoutDistance,
    features.volumeRatio,
    features.pullbackQuality,
  ];

  if (!values.every(finite) || features.atr14_4h <= 0 || features.atr14_1h <= 0) {
    return null;
  }

  const breakdown: StrategyScoreBreakdown = Object.freeze({
    trendStrength: trendStrength(direction, features),
    pullbackQuality: features.pullbackQuality,
    breakoutStrength: breakoutStrength(features.breakoutDistance),
    volumeScore: volumeScore(features.volumeRatio),
    riskRewardScore: riskRewardScore(features.stopAtr),
  });

  if (
    ![
      breakdown.trendStrength,
      breakdown.pullbackQuality,
      breakdown.breakoutStrength,
      breakdown.volumeScore,
      breakdown.riskRewardScore,
    ].every(finite)
  ) {
    return null;
  }

  return Object.freeze({
    breakdown,
    totalScore: calculateScoreTotal(breakdown),
  });
}

export function gradeForScore(score: number): SignalGrade | null {
  if (!finite(score) || score < SIGNAL_GRADE_THRESHOLDS.C) {
    return null;
  }

  if (score >= SIGNAL_GRADE_THRESHOLDS.A) {
    return "A";
  }

  if (score >= SIGNAL_GRADE_THRESHOLDS.B) {
    return "B";
  }

  return "C";
}

export function isFormalScore(score: number): boolean {
  return finite(score) && score >= SIGNAL_GRADE_THRESHOLDS.C;
}

export function fixedSymbolOrder(symbol: ResearchSymbol): number {
  switch (symbol) {
    case "BTCUSDT":
      return 0;
    case "ETHUSDT":
      return 1;
    case "SOLUSDT":
      return 2;
    case "XRPUSDT":
      return 3;
    case "BNBUSDT":
      return 4;
  }
}
