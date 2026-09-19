import type { R25CandidateConfiguration, R25Direction } from "./round-025-candidate-model.ts";
import {
  R25_BASE_BRANCH,
  R25_FOLD_IDS,
  R25_SYMBOLS,
  type R25FoldId,
} from "./round-025-protocol.ts";

export const R26_RESEARCH_ROUND_ID = "baseline-002-research-round-026" as const;
export const R26_BASE_BRANCH = R25_BASE_BRANCH;
export const R26_BASE_SHA = "99ecad9cfca8487c17a31fbf2c8878e5c9c71ed1" as const;
export const R26_BRANCH = "research/round-026-directional-score-calibration-diagnostic" as const;
export const R26_PHASE = "SCORE_DIAGNOSTIC_ONLY" as const;

export const R26_SOURCE = Object.freeze({
  canonicalObservationPath: ".cache/tradepulse/round-014/observations.ndjson",
  manifestPath: "docs/research/round-014-observation-freeze.json",
  observationDataSha256: "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359",
  observationDataBytes: 1_893_811_055,
  observationCount: 244_810,
  windowStart: "2023-01-01T00:00:00.000Z",
  windowEnd: "2026-08-15T23:59:59.999Z",
  classification: "SEEN_DEVELOPMENT_DIAGNOSTIC_ONLY",
  networkAcquired: false,
});

export const R26_ALLOWED_VALIDATION_FIELDS = Object.freeze([
  "decisionTime",
  "symbol",
  "direction",
  "features",
] as const);

export const R26_FORBIDDEN_VALIDATION_FIELDS = Object.freeze([
  "labels",
  "latencyStressLabels",
  "netForwardAtr",
  "netForwardAtrCostStress",
  "PnL",
  "profitFactor",
  "drawdown",
  "forwardReturn",
] as const);

export const R26_GOVERNANCE = Object.freeze({
  diagnosticOnly: true,
  economicEvaluationPerformed: false,
  validationEconomicValuesRead: true,
  historicalTrainingTargetValuesRead: true,
  globalHistoricalEconomicLabelsRead: true,
  sameFoldValidationEconomicValuesUsedForFit: false,
  sameFoldValidationEconomicValuesUsedForScoring: false,
  validationOutcomeInfluencedDiagnostic: false,
  crossFoldExpandingWindowResearchReuse: true,
  scoreCalibrationDiagnosticExecutionCount: 1,
  developmentEconomicEvaluationExecutionCount: 1,
  forwardEconomicValuesRead: false,
  forwardReturnRead: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  automaticTrading: false,
  humanDecisionRequired: true,
  productionUnchanged: true,
  mainUnchanged: true,
  emailRestorationAuthorized: false,
});

export type R26DiagnosticClassification =
  | "PIPELINE_INTEGRITY_FAILURE"
  | "MODEL_POSITIVE_SCORE_COLLAPSE"
  | "FIXED_RAW_THRESHOLD_SCALE_DRIFT"
  | "SCORE_SCALE_OK_MODEL_EDGE_REDESIGN_REQUIRED";

export type R26ScoreDistribution = Readonly<{
  count: number;
  min: number | null;
  mean: number | null;
  stddev: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  max: number | null;
}>;

export type R26ThresholdDiagnostics = Readonly<{
  threshold: number;
  topScoreGreaterThanZeroCount: number;
  topScoreGreaterThanZeroRate: number;
  thresholdExceedanceCount: number;
  thresholdExceedanceRate: number;
  thresholdAboveTopP90: boolean;
  thresholdAboveTopP95: boolean;
  thresholdAboveTopP99: boolean;
  thresholdAboveTopMax: boolean;
  topP95ToThresholdRatio: number | null;
  topP99ToThresholdRatio: number | null;
  topMaxToThresholdRatio: number | null;
}>;

export type R26ModelScaleDiagnostics = Readonly<{
  intercept: number;
  coefficientL1Norm: number;
  coefficientL2Norm: number;
  maximumAbsCoefficient: number;
}>;

export type R26ModelScaleDrift = Readonly<{
  foldId: R25FoldId;
  interceptDeltaFromF1: number;
  coefficientL1DeltaFromF1: number;
  coefficientL2DeltaFromF1: number;
  maximumAbsCoefficientDeltaFromF1: number;
}>;

export type R26PipelineDiagnostics = Readonly<{
  trainingExamples: number;
  expectedTrainingExamples: number;
  modelIdentitySha256: string;
  expectedModelIdentitySha256: string;
  modelIdentityMatched: boolean;
  validationDecisionTimeCount: number;
  validationRowCount: number;
  peerCountMin: number | null;
  peerCountMax: number | null;
  peerCountsValid: boolean;
  nonFinitePredictionCount: number;
}>;

export type R26FoldDiagnostics = Readonly<{
  foldId: R25FoldId;
  predictionDistribution: R26ScoreDistribution;
  topPredictionDistribution: R26ScoreDistribution;
  thresholdDiagnostics: R26ThresholdDiagnostics;
  modelScale: R26ModelScaleDiagnostics;
  pipeline: R26PipelineDiagnostics;
}>;

export type R26CandidateDiagnostics = Readonly<{
  candidateConfigurationId: string;
  family: R25CandidateConfiguration["family"];
  direction: R25Direction;
  threshold: number;
  folds: readonly R26FoldDiagnostics[];
  thresholdExceedancesByFold: Readonly<Record<R25FoldId, number>>;
  shareOfExceedancesInLargestFold: number;
  foldsWithZeroThresholdExceedances: number;
  foldsThresholdAboveP99: number;
  foldsThresholdAboveMax: number;
  modelScaleDriftByFold: readonly R26ModelScaleDrift[];
  reproducedR25SelectedAlertCount: number;
  acceptedR25SelectedAlertCount: number;
  selectedAlertCountReproduced: boolean;
}>;

export type R26DiagnosticResult = Readonly<{
  schemaVersion: "m3-r26-score-calibration-diagnostic-001";
  researchRoundId: typeof R26_RESEARCH_ROUND_ID;
  phase: typeof R26_PHASE;
  base: Readonly<{ branch: typeof R26_BASE_BRANCH; sha: typeof R26_BASE_SHA }>;
  source: Readonly<{
    canonicalObservationPath: string;
    actualPath: string;
    manifestPath: string;
    observationDataSha256: string;
    observationDataBytes: number;
    observationCount: number;
    networkAcquired: false;
    classification: typeof R26_SOURCE.classification;
  }>;
  diagnosticOnly: true;
  economicEvaluationPerformed: false;
  validationEconomicValuesRead: true;
  historicalTrainingTargetValuesRead: true;
  globalHistoricalEconomicLabelsRead: true;
  sameFoldValidationEconomicValuesUsedForFit: false;
  sameFoldValidationEconomicValuesUsedForScoring: false;
  validationOutcomeInfluencedDiagnostic: false;
  crossFoldExpandingWindowResearchReuse: true;
  validationFieldsRead: readonly string[];
  forbiddenValidationFields: readonly string[];
  scoreCalibrationDiagnosticExecutionCount: 1;
  developmentEconomicEvaluationExecutionCount: 1;
  candidateConfigurationsDefined: 6;
  candidateConfigurationsEvaluated: 6;
  candidateFoldExecutionCount: 36;
  candidateDiagnostics: readonly R26CandidateDiagnostics[];
  pipelineIntegrity: Readonly<{
    pipelineNormal: boolean;
    modelIdentitiesMatched: boolean;
    peerCountsValid: boolean;
    nonFinitePredictions: number;
    deterministic: true;
    r25SelectedAlertCountsReproduced: boolean;
  }>;
  primaryLongClassification: R26DiagnosticClassification;
  primaryShortClassification: R26DiagnosticClassification;
  recommendedNextDesign: string;
  forwardEconomicValuesRead: false;
  forwardReturnRead: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  automaticTrading: false;
  humanDecisionRequired: true;
  productionUnchanged: true;
  mainUnchanged: true;
  emailRestorationAuthorized: false;
  newMarketDataFetched: false;
  selectionExecuted: false;
  forwardValidationAuthorized: false;
  purpose: string;
  governance: typeof R26_GOVERNANCE;
  finalDecision: "ROUND-026 SCORE CALIBRATION DIAGNOSTIC COMPLETE";
  nextStage: string;
}>;

export function calculateR26Quantile(values: readonly number[], probability: number): number | null {
  if (values.length === 0) return null;
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error("R26 quantile probability must be between 0 and 1.");
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower]!;
  return ordered[lower]! + (ordered[upper]! - ordered[lower]!) * (position - lower);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number | null {
  const average = mean(values);
  return average === null ? null : Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

export function buildR26ScoreDistribution(values: readonly number[]): R26ScoreDistribution {
  return Object.freeze({
    count: values.length,
    min: values.length === 0 ? null : Math.min(...values),
    mean: mean(values),
    stddev: standardDeviation(values),
    p50: calculateR26Quantile(values, 0.5),
    p75: calculateR26Quantile(values, 0.75),
    p90: calculateR26Quantile(values, 0.9),
    p95: calculateR26Quantile(values, 0.95),
    p99: calculateR26Quantile(values, 0.99),
    max: values.length === 0 ? null : Math.max(...values),
  });
}

export function buildR26ThresholdDiagnostics(
  threshold: number,
  topScores: readonly number[],
): R26ThresholdDiagnostics {
  const distribution = buildR26ScoreDistribution(topScores);
  const count = topScores.length;
  const exceedances = topScores.filter((score) => score >= threshold).length;
  const ratio = (value: number | null): number | null => value === null || threshold === 0 ? null : value / threshold;
  return Object.freeze({
    threshold,
    topScoreGreaterThanZeroCount: topScores.filter((score) => score > 0).length,
    topScoreGreaterThanZeroRate: count === 0 ? 0 : topScores.filter((score) => score > 0).length / count,
    thresholdExceedanceCount: exceedances,
    thresholdExceedanceRate: count === 0 ? 0 : exceedances / count,
    thresholdAboveTopP90: distribution.p90 !== null && threshold > distribution.p90,
    thresholdAboveTopP95: distribution.p95 !== null && threshold > distribution.p95,
    thresholdAboveTopP99: distribution.p99 !== null && threshold > distribution.p99,
    thresholdAboveTopMax: distribution.max !== null && threshold > distribution.max,
    topP95ToThresholdRatio: ratio(distribution.p95),
    topP99ToThresholdRatio: ratio(distribution.p99),
    topMaxToThresholdRatio: ratio(distribution.max),
  });
}

export function classifyR26Direction(
  candidates: readonly R26CandidateDiagnostics[],
): R26DiagnosticClassification {
  const folds = candidates.flatMap((candidate) => candidate.folds);
  if (folds.some((fold) => !fold.pipeline.modelIdentityMatched || !fold.pipeline.peerCountsValid || fold.pipeline.nonFinitePredictionCount > 0)
    || candidates.some((candidate) => !candidate.selectedAlertCountReproduced)) {
    return "PIPELINE_INTEGRITY_FAILURE";
  }
  if (candidates.some((candidate) => candidate.folds.filter((fold) => fold.topPredictionDistribution.p99 !== null && fold.topPredictionDistribution.p99 <= 0).length >= 4)) {
    return "MODEL_POSITIVE_SCORE_COLLAPSE";
  }
  if (candidates.some((candidate) => {
    const driftFolds = candidate.folds.filter((fold) => fold.thresholdDiagnostics.thresholdAboveTopP99);
    const hasPortableFold = candidate.folds.some((fold) => !fold.thresholdDiagnostics.thresholdAboveTopP90 || fold.thresholdDiagnostics.thresholdExceedanceCount > 0);
    return driftFolds.length >= 4 && hasPortableFold;
  })) {
    return "FIXED_RAW_THRESHOLD_SCALE_DRIFT";
  }
  return "SCORE_SCALE_OK_MODEL_EDGE_REDESIGN_REQUIRED";
}

export function recommendedR26NextDesign(
  longClassification: R26DiagnosticClassification,
  shortClassification: R26DiagnosticClassification,
): string {
  const classifications = new Set([longClassification, shortClassification]);
  if (classifications.has("PIPELINE_INTEGRITY_FAILURE")) return "FIX_SCORE_PIPELINE_BEFORE_ANY_NEW_ECONOMIC_EVALUATION";
  if (classifications.has("FIXED_RAW_THRESHOLD_SCALE_DRIFT")) return "TRAINING_ONLY_SCORE_CALIBRATION_REDESIGN_REQUIRED";
  return "DIRECTIONAL_FEATURE_MODEL_REDESIGN_REQUIRED";
}

export function r26FoldIds(): readonly R25FoldId[] {
  return R25_FOLD_IDS;
}

export function r26Symbols(): readonly string[] {
  return R25_SYMBOLS;
}
