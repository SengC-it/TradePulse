import {
  compareR22AdvisoryEvaluationStability,
  evaluateR22AdvisoryObservation,
  type R22AdvisoryEvaluationMetrics,
  type R22AdvisoryEvaluationObservation,
  type R22AdvisoryEvaluationReason,
  type R22AdvisoryEvaluationResult,
  type R22AdvisoryEvaluationStability,
} from "../research/advisory-evaluation-protocol.ts";

export type AdvisoryEvaluationObservation = R22AdvisoryEvaluationObservation;
export type AdvisoryEvaluationResult = R22AdvisoryEvaluationResult;
export type AdvisoryEvaluationStability = R22AdvisoryEvaluationStability;

export type AdvisoryEvaluationBatchMetrics = Readonly<{
  advisoryQuality: Readonly<{
    signalClarity: number;
    explanationCompleteness: number;
    riskVisibility: number;
    contextCompleteness: number;
  }>;
  noiseReduction: Readonly<{
    unnecessaryAlertRate: number;
    ignoreRatio: number;
    duplicateAlertRate: number;
  }>;
  humanReviewEfficiency: Readonly<{
    reviewCompleteness: number;
    informationSufficiency: number;
    decisionLatencyProxyMs: number;
  }>;
}>;

export type AdvisoryEvaluationBatchResult = Readonly<{
  status: "OBSERVABLE" | "NOT_EVALUABLE";
  evaluableCount: number;
  notEvaluableCount: number;
  notEvaluableReasons: readonly R22AdvisoryEvaluationReason[];
  metrics: AdvisoryEvaluationBatchMetrics | null;
  observedOnly: true;
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

export function evaluateAdvisoryObservation(
  observation: AdvisoryEvaluationObservation,
): AdvisoryEvaluationResult {
  return evaluateR22AdvisoryObservation(observation);
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const result = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number.isFinite(result) ? result : null;
}

function metricsAreFinite(metrics: R22AdvisoryEvaluationMetrics): boolean {
  return [
    metrics.advisoryQuality.signalClarity,
    metrics.advisoryQuality.explanationCompleteness,
    metrics.advisoryQuality.riskVisibility,
    metrics.advisoryQuality.contextCompleteness,
    metrics.noiseReduction.unnecessaryAlertRate,
    metrics.noiseReduction.ignoreRatio,
    metrics.noiseReduction.duplicateAlertRate,
    metrics.humanReviewEfficiency.reviewCompleteness,
    metrics.humanReviewEfficiency.informationSufficiency,
    metrics.humanReviewEfficiency.decisionLatencyProxyMs,
  ].every(Number.isFinite);
}

function batchWithoutMetrics(
  results: readonly AdvisoryEvaluationResult[],
): AdvisoryEvaluationBatchResult {
  const reasons = Array.from(new Set(
    results
      .filter((result) => result.status === "NOT_EVALUABLE")
      .map((result) => result.reason),
  ));
  return {
    status: "NOT_EVALUABLE",
    evaluableCount: 0,
    notEvaluableCount: results.length,
    notEvaluableReasons: reasons,
    metrics: null,
    observedOnly: true,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function aggregateAdvisoryEvaluations(
  observations: readonly AdvisoryEvaluationObservation[],
): AdvisoryEvaluationBatchResult {
  const results = observations.map(evaluateAdvisoryObservation);
  const evaluable = results.filter((result) => result.status === "OBSERVABLE");
  const notEvaluable = results.filter((result) => result.status === "NOT_EVALUABLE");

  if (evaluable.length === 0) {
    return batchWithoutMetrics(results);
  }

  const metrics = evaluable.map((result) => result.metrics).filter(
    (value): value is R22AdvisoryEvaluationMetrics => value !== null,
  );
  if (metrics.length !== evaluable.length) {
    return batchWithoutMetrics(results);
  }

  const aggregated: AdvisoryEvaluationBatchMetrics = {
    advisoryQuality: {
      signalClarity: mean(metrics.map((value) => value.advisoryQuality.signalClarity)) ?? Number.NaN,
      explanationCompleteness: mean(metrics.map((value) => value.advisoryQuality.explanationCompleteness)) ?? Number.NaN,
      riskVisibility: mean(metrics.map((value) => value.advisoryQuality.riskVisibility)) ?? Number.NaN,
      contextCompleteness: mean(metrics.map((value) => value.advisoryQuality.contextCompleteness)) ?? Number.NaN,
    },
    noiseReduction: {
      unnecessaryAlertRate: mean(metrics.map((value) => value.noiseReduction.unnecessaryAlertRate)) ?? Number.NaN,
      ignoreRatio: mean(metrics.map((value) => value.noiseReduction.ignoreRatio)) ?? Number.NaN,
      duplicateAlertRate: mean(metrics.map((value) => value.noiseReduction.duplicateAlertRate)) ?? Number.NaN,
    },
    humanReviewEfficiency: {
      reviewCompleteness: mean(metrics.map((value) => value.humanReviewEfficiency.reviewCompleteness)) ?? Number.NaN,
      informationSufficiency: mean(metrics.map((value) => value.humanReviewEfficiency.informationSufficiency)) ?? Number.NaN,
      decisionLatencyProxyMs: mean(metrics.map((value) => value.humanReviewEfficiency.decisionLatencyProxyMs)) ?? Number.NaN,
    },
  };

  if (!metricsAreFinite(aggregated)) {
    return batchWithoutMetrics(results);
  }

  return {
    status: "OBSERVABLE",
    evaluableCount: evaluable.length,
    notEvaluableCount: notEvaluable.length,
    notEvaluableReasons: Array.from(new Set(notEvaluable.map((result) => result.reason))),
    metrics: aggregated,
    observedOnly: true,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function compareAdvisoryEvaluationStability(
  first: AdvisoryEvaluationResult,
  second: AdvisoryEvaluationResult,
): AdvisoryEvaluationStability {
  return compareR22AdvisoryEvaluationStability(first, second);
}
