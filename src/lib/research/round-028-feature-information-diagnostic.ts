import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import { scanR23MetadataOnly } from "./round-023-development-data.ts";
import { streamR14Observations, readR14ObservationFreeze } from "./m3-r14-round-014-observations.ts";
import type { R13ForwardLabel, R13LabelStatus } from "./m3-r13-round-013-labels.ts";
import type { R13Observation } from "./m3-r13-round-013-performance.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { stableStringify } from "./utils.ts";
import {
  R28_BASE_SHA,
  R28_CROSS_SECTIONAL_COLLAPSE_RATE,
  R28_DIRECTIONS,
  R28_FOLD_IDS,
  R28_FEATURE_NAMES,
  R28_FOLDS,
  R28_HORIZON_HOURS,
  R28_LOGISTIC_LAMBDA,
  R28_LOGISTIC_MAX_ITERATIONS,
  R28_LOGISTIC_TOLERANCE,
  R28_PROBE_IDS,
  R28_REPRESENTATIONS,
  R28_SOURCE_BYTES,
  R28_SOURCE_END_ISO,
  R28_SOURCE_MANIFEST_PATH,
  R28_SOURCE_MANIFEST_SHA256,
  R28_SOURCE_OBSERVATION_COUNT,
  R28_SOURCE_PATH,
  R28_SOURCE_SHA256,
  R28_SOURCE_START_ISO,
  R28_SYMBOLS,
  R28_TARGET_IDS,
  R28_THRESHOLDS,
  type R28Direction,
  type R28FeatureName,
  type R28ProbeId,
  type R28Representation,
  type R28TargetId,
} from "./round-028-protocol.ts";

const HOUR_MS = 60 * 60 * 1_000;
const PURGE_MS = 24 * HOUR_MS;
const LOGISTIC_CLAMP = Object.freeze({ min: -40, max: 40 });

export type R28ValidationFeatureRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R28Direction;
  features: readonly number[];
}>;

export type R28DiagnosticOutcomeProjection = Readonly<{
  observationId: string;
  primaryPositive: 0 | 1 | null;
  costStressPositive: 0 | 1 | null;
  latencyPositive: 0 | 1 | null;
  primaryContinuous: number | null;
}>;

type R28SourceRow = Readonly<{
  featureRow: R28ValidationFeatureRow;
  primaryStatus: R13LabelStatus;
  costStatus: R13LabelStatus;
  latencyStatus: R13LabelStatus;
  outcome: R28DiagnosticOutcomeProjection;
}>;

type R28RepresentedRow = R28ValidationFeatureRow;

type R28MetricInput = Readonly<{
  row: R28RepresentedRow;
  score: number;
  target: 0 | 1 | null;
}>;
type R28ValidMetricInput = R28MetricInput & Readonly<{ target: 0 | 1 }>;

export type R28FeatureFoldMetric = Readonly<{
  featureName: R28FeatureName;
  direction: R28Direction;
  foldId: (typeof R28_FOLD_IDS)[number];
  representation: R28Representation;
  trainingOrientation: 1 | -1;
  validationExamplesPrimary: number;
  validationExamplesCostStress: number;
  validationExamplesLatency: number;
  primaryAuc: number | null;
  costStressAuc: number | null;
  latencyAuc: number | null;
  primarySpearman: number | null;
  costStressSpearman: number | null;
  latencySpearman: number | null;
  meanTimestampPrimarySpearman: number | null;
  meanTimestampCostStressSpearman: number | null;
  meanTimestampLatencySpearman: number | null;
  crossSectionalNonZeroDecisionTimeRate: number;
}>;

export type R28ProbeFoldMetric = Readonly<{
  probeId: R28ProbeId;
  direction: R28Direction;
  foldId: (typeof R28_FOLD_IDS)[number];
  termCount: number;
  top4FeatureNames: readonly R28FeatureName[];
  primaryAuc: number | null;
  costStressAuc: number | null;
  latencyAuc: number | null;
  primaryPositiveFoldIndicator: boolean;
  costPositiveFoldIndicator: boolean;
  latencyPositiveFoldIndicator: boolean;
  primaryMeanTimestampSpearman: number | null;
  costMeanTimestampSpearman: number | null;
  latencyMeanTimestampSpearman: number | null;
  primaryValidExampleCount: number;
  costValidExampleCount: number;
  latencyValidExampleCount: number;
  trainingPositiveRate: number | null;
  scoreMin: number | null;
  scoreP50: number | null;
  scoreP90: number | null;
  scoreP95: number | null;
  scoreP99: number | null;
  scoreMax: number | null;
}>;

export type R28ProbeAggregate = Readonly<{
  probeId: R28ProbeId;
  direction: R28Direction;
  foldMetrics: readonly R28ProbeFoldMetric[];
  primaryMedianAuc: number | null;
  costMedianAuc: number | null;
  latencyMedianAuc: number | null;
  primaryMedianRankIc: number | null;
  costMedianRankIc: number | null;
  latencyMedianRankIc: number | null;
  primaryPositiveAucFolds: number;
  costPositiveAucFolds: number;
  latencyPositiveAucFolds: number;
  primaryPositiveRankIcFolds: number;
  latencyPositiveRankIcFolds: number;
  absoluteInformationPass: boolean;
  rankingInformationPass: boolean;
  usableInformationPass: boolean;
}>;

export type R28DirectionClassification = Readonly<{
  direction: R28Direction;
  featuresCollapsedByCrossSectionalNormalization: readonly R28FeatureName[];
  stableRawInformationFeatures: readonly R28FeatureName[];
  probes: readonly R28ProbeAggregate[];
  directionClassification: "CROSS_SECTIONAL_NORMALIZATION_INFORMATION_LOSS" | "NONLINEAR_CAPACITY_LIMITATION" | "INFORMATION_PRESENT_BUT_R27_ARCHITECTURE_MISMATCH" | "WEAK_OR_UNSTABLE_INFORMATION_ONLY" | "EXISTING_FEATURE_INFORMATION_INSUFFICIENT";
  recommendedNextStage: "HYBRID_RAW_PLUS_CROSS_SECTIONAL_ARCHITECTURE_REQUIRED" | "BOUNDED_NONLINEAR_MODEL_DEVELOPMENT_REQUIRED" | "SELECTION_AND_MODEL_ARCHITECTURE_REDESIGN_REQUIRED" | "FEATURE_ENGINEERING_AND_REGIME_DECOMPOSITION_REQUIRED" | "NEW_INFORMATION_SOURCE_REQUIRED";
}>;

export type R28DiagnosticResult = Readonly<{
  schemaVersion: "m3-r28-feature-information-capacity-reassessment-result-001";
  baseSha: typeof R28_BASE_SHA;
  source: Readonly<Record<string, unknown>>;
  featureInformationDiagnosticExecutionCount: 1;
  economicEvaluationPerformed: false;
  tradingEconomicMetricsCalculated: false;
  validationOutcomeValuesReadForDiagnostic: true;
  globalHistoricalEconomicLabelsRead: true;
  sameFoldValidationOutcomeUsedForFit: false;
  sameFoldValidationOutcomeUsedForScoring: false;
  crossFoldExpandingWindowResearchReuse: true;
  featureMetrics: readonly R28FeatureFoldMetric[];
  directions: Readonly<Record<R28Direction, R28DirectionClassification>>;
  governance: Readonly<Record<string, unknown>>;
}>;

type LogisticExample = Readonly<{ features: readonly number[]; target: 0 | 1 }>;
type LogisticModel = Readonly<{ means: readonly number[]; deviations: readonly number[]; intercept: number; coefficients: readonly number[]; trainingPositiveRate: number; terms: number }>;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function midranks(values: readonly number[]): number[] {
  const ordered = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index);
  const result = Array<number>(values.length);
  let index = 0;
  while (index < ordered.length) {
    let end = index + 1;
    while (end < ordered.length && ordered[end]!.value === ordered[index]!.value) end += 1;
    const rank = (index + 1 + end) / 2;
    for (let cursor = index; cursor < end; cursor += 1) result[ordered[cursor]!.index] = rank;
    index = end;
  }
  return result;
}

function pearson(left: readonly number[], right: readonly number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index]! - leftMean;
    const rightDelta = right[index]! - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  if (leftVariance === 0 || rightVariance === 0) return null;
  return numerator / Math.sqrt(leftVariance * rightVariance);
}

export function calculateR28TieAwareSpearman(left: readonly number[], right: readonly number[]): number | null {
  return pearson(midranks(left), midranks(right));
}

export function calculateR28TieAwareAuc(scores: readonly number[], targets: readonly (0 | 1)[]): number | null {
  if (scores.length !== targets.length) throw new Error("R28 AUC input lengths must match.");
  const positiveScores = scores.filter((_, index) => targets[index] === 1);
  const negativeScores = scores.filter((_, index) => targets[index] === 0);
  if (positiveScores.length === 0 || negativeScores.length === 0) return null;
  const ranks = midranks(scores);
  let positiveRankSum = 0;
  for (let index = 0; index < targets.length; index += 1) if (targets[index] === 1) positiveRankSum += ranks[index]!;
  return (positiveRankSum - (positiveScores.length * (positiveScores.length + 1)) / 2) / (positiveScores.length * negativeScores.length);
}

function median(values: readonly number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[middle - 1]! + finite[middle]!) / 2 : finite[middle]!;
}

function quantile(values: readonly number[], probability: number): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const position = (finite.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return finite[lower]! + (finite[upper]! - finite[lower]!) * (position - lower);
}

function targetValue(outcome: R28DiagnosticOutcomeProjection, target: R28TargetId): 0 | 1 | null {
  if (target === "PRIMARY_POSITIVE") return outcome.primaryPositive;
  if (target === "COST_STRESS_POSITIVE") return outcome.costStressPositive;
  return outcome.latencyPositive;
}

function labelTarget(label: R13ForwardLabel): 0 | 1 | null {
  if (label.status !== "EXECUTED" || label.netForwardAtr === null || !Number.isFinite(label.netForwardAtr)) return null;
  return label.netForwardAtr > 0 ? 1 : 0;
}

function costTarget(label: R13ForwardLabel): 0 | 1 | null {
  if (label.status !== "EXECUTED" || label.netForwardAtrCostStress === null || !Number.isFinite(label.netForwardAtrCostStress)) return null;
  return label.netForwardAtrCostStress > 0 ? 1 : 0;
}

function latencyTarget(label: R13ForwardLabel): 0 | 1 | null {
  if (label.status !== "EXECUTED" || label.netForwardAtr === null || !Number.isFinite(label.netForwardAtr)) return null;
  return label.netForwardAtr > 0 ? 1 : 0;
}

function rowFromObservation(observation: R13Observation): R28SourceRow {
  const primary = observation.labels[R28_HORIZON_HOURS];
  const cost = primary;
  const latency = observation.latencyStressLabels[R28_HORIZON_HOURS];
  const features = R28_FEATURE_NAMES.map((name) => {
    const value = observation.features[name];
    if (!Number.isFinite(value)) throw new Error(`R28 non-finite feature ${name} at ${observation.observationId}.`);
    return value;
  });
  return Object.freeze({
    featureRow: Object.freeze({ observationId: observation.observationId, decisionTime: observation.decisionTime, symbol: observation.symbol, direction: observation.direction, features: Object.freeze(features) }),
    primaryStatus: primary.status,
    costStatus: cost.status,
    latencyStatus: latency.status,
    outcome: Object.freeze({ observationId: observation.observationId, primaryPositive: labelTarget(primary), costStressPositive: costTarget(cost), latencyPositive: latencyTarget(latency), primaryContinuous: primary.status === "EXECUTED" && primary.netForwardAtr !== null && Number.isFinite(primary.netForwardAtr) ? primary.netForwardAtr : null }),
  });
}

export function resolveR28ObservationSource(root = process.cwd()): string {
  const resolvedRoot = path.resolve(root);
  const candidates = [
    path.join(resolvedRoot, R28_SOURCE_PATH),
    path.resolve(resolvedRoot, "..", "round-014-r13-execution-replay", R28_SOURCE_PATH),
  ];
  const source = candidates.find((candidate) => existsSync(candidate));
  if (!source) throw new Error("R28 accepted R14 observation freeze is unavailable; network acquisition is forbidden.");
  return path.resolve(source);
}

export async function verifyR28ObservationSource(root = process.cwd(), sourcePath = resolveR28ObservationSource(root)): Promise<Readonly<Record<string, unknown>>> {
  const manifest = readR14ObservationFreeze(path.resolve(root));
  if (manifest.observationDataSha256 !== R28_SOURCE_SHA256 || manifest.observationDataBytes !== R28_SOURCE_BYTES || manifest.observationCount !== R28_SOURCE_OBSERVATION_COUNT || manifest.manifestSha256 !== R28_SOURCE_MANIFEST_SHA256 || manifest.observationDataPath !== R28_SOURCE_PATH || manifest.researchBoundary !== R28_SOURCE_END_ISO) throw new Error("R28 accepted R14 freeze identity mismatch.");
  const scan = await scanR23MetadataOnly(sourcePath);
  if (scan.observationDataSha256 !== R28_SOURCE_SHA256 || scan.observationDataBytes !== R28_SOURCE_BYTES || scan.observationCount !== R28_SOURCE_OBSERVATION_COUNT || scan.directionCounts.LONG !== 122405 || scan.directionCounts.SHORT !== 122405 || scan.postBoundaryRows !== 0 || scan.beforeWindowRows !== 0 || scan.duplicateObservationIds !== 0 || !scan.chronologyValid || !scan.requiredSymbolsComplete || scan.economicValuesRead !== false) throw new Error("R28 source does not match the accepted immutable R14 observation identity.");
  return Object.freeze({ status: "ACCEPTED_R14_OBSERVATION_FREEZE_REUSED", canonicalPath: R28_SOURCE_PATH, manifestPath: R28_SOURCE_MANIFEST_PATH, sha256: R28_SOURCE_SHA256, manifestSha256: R28_SOURCE_MANIFEST_SHA256, bytes: R28_SOURCE_BYTES, observationCount: R28_SOURCE_OBSERVATION_COUNT, window: { start: R28_SOURCE_START_ISO, end: R28_SOURCE_END_ISO }, resolvedSourcePath: sourcePath, metadataOnlyEconomicValuesRead: scan.economicValuesRead, networkAcquired: false, developmentOnly: true });
}

async function loadR28Rows(sourcePath: string): Promise<readonly R28SourceRow[]> {
  const rows: R28SourceRow[] = [];
  for await (const observation of streamR14Observations(sourcePath)) rows.push(rowFromObservation(observation));
  if (rows.length !== R28_SOURCE_OBSERVATION_COUNT) throw new Error("R28 source row count does not match the accepted R14 identity.");
  return Object.freeze(rows);
}

function isRole(row: R28SourceRow, foldId: (typeof R28_FOLD_IDS)[number], role: "RESEARCH" | "VALIDATION"): boolean {
  const range = getResearchFoldRoleRange(foldId, role);
  if (role === "RESEARCH") return row.featureRow.decisionTime >= range.startTime && row.featureRow.decisionTime <= Math.min(range.endTime, getResearchFoldRoleRange(foldId, "VALIDATION").startTime - PURGE_MS);
  return row.featureRow.decisionTime >= range.startTime && row.featureRow.decisionTime <= range.endTime;
}

function byDirection(rows: readonly R28SourceRow[], direction: R28Direction): readonly R28SourceRow[] {
  return rows.filter((row) => row.featureRow.direction === direction);
}

function crossSectionalValues(rows: readonly R28SourceRow[], direction: R28Direction): Readonly<{ rows: readonly R28RepresentedRow[]; nonZeroRates: readonly number[] }> {
  const selected = byDirection(rows, direction);
  const groups = new Map<number, R28SourceRow[]>();
  for (const row of selected) groups.set(row.featureRow.decisionTime, [...(groups.get(row.featureRow.decisionTime) ?? []), row]);
  const nonZeroCounts = Array<number>(R28_FEATURE_NAMES.length).fill(0);
  const allGroups = [...groups.values()];
  const represented: R28RepresentedRow[] = [];
  for (const peers of allGroups) {
    const symbols = new Set(peers.map((peer) => peer.featureRow.symbol));
    if (peers.length !== R28_SYMBOLS.length || symbols.size !== R28_SYMBOLS.length) throw new Error(`R28 cross-sectional group is incomplete at ${peers[0]?.featureRow.decisionTime ?? "unknown"}.`);
    for (let featureIndex = 0; featureIndex < R28_FEATURE_NAMES.length; featureIndex += 1) {
      const values = peers.map((peer) => peer.featureRow.features[featureIndex]!);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
      if (Math.sqrt(variance) > 1e-12) nonZeroCounts[featureIndex] += 1;
    }
    for (const peer of peers) {
      const features = peer.featureRow.features.map((_, featureIndex) => {
        const values = peers.map((candidate) => candidate.featureRow.features[featureIndex]!);
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
        const deviation = Math.sqrt(variance);
        return deviation > 1e-12 ? (peer.featureRow.features[featureIndex]! - average) / deviation : 0;
      });
      represented.push(Object.freeze({ ...peer.featureRow, features: Object.freeze(features) }));
    }
  }
  const denominator = Math.max(allGroups.length, 1);
  return Object.freeze({ rows: Object.freeze(represented), nonZeroRates: Object.freeze(nonZeroCounts.map((count) => count / denominator)) });
}

export function buildR28CrossSectionalFeatureRows(rows: readonly R28SourceRow[], direction: R28Direction): readonly R28ValidationFeatureRow[] {
  return crossSectionalValues(rows, direction).rows;
}

function featureRowsForRepresentation(rows: readonly R28SourceRow[], direction: R28Direction, representation: R28Representation): Readonly<{ rows: readonly R28ValidationFeatureRow[]; nonZeroRates: readonly number[] }> {
  if (representation === "RAW_PIT") {
    const selected = byDirection(rows, direction).map((row) => row.featureRow);
    const xs = crossSectionalValues(rows, direction);
    return Object.freeze({ rows: Object.freeze(selected), nonZeroRates: xs.nonZeroRates });
  }
  return crossSectionalValues(rows, direction);
}

function mergeFeatureRowsWithOutcomes(featureRows: readonly R28ValidationFeatureRow[], rows: readonly R28SourceRow[]): ReadonlyMap<string, R28DiagnosticOutcomeProjection> {
  const outcomes = new Map(rows.map((row) => [row.featureRow.observationId, row.outcome]));
  for (const row of featureRows) if (!outcomes.has(row.observationId)) throw new Error(`R28 missing outcome projection for ${row.observationId}.`);
  return outcomes;
}

function validMetricInputs(rows: readonly R28ValidationFeatureRow[], outcomes: ReadonlyMap<string, R28DiagnosticOutcomeProjection>, target: R28TargetId, score: (row: R28ValidationFeatureRow) => number): R28MetricInput[] {
  const result: R28MetricInput[] = [];
  for (const row of rows) {
    const outcome = outcomes.get(row.observationId);
    if (!outcome) throw new Error(`R28 outcome join failed for ${row.observationId}.`);
    result.push(Object.freeze({ row, score: score(row), target: targetValue(outcome, target) }));
  }
  return result;
}

function metricInputsForTarget(inputs: readonly R28MetricInput[]): readonly R28ValidMetricInput[] {
  return inputs.filter((input): input is R28ValidMetricInput => input.target !== null);
}

function metricAuc(inputs: readonly R28MetricInput[]): number | null {
  const valid = metricInputsForTarget(inputs);
  return calculateR28TieAwareAuc(valid.map((input) => input.score), valid.map((input) => input.target));
}

function metricSpearman(inputs: readonly R28MetricInput[]): number | null {
  const valid = metricInputsForTarget(inputs);
  return calculateR28TieAwareSpearman(valid.map((input) => input.score), valid.map((input) => input.target));
}

function timestampSpearman(inputs: readonly R28MetricInput[]): number | null {
  const groups = new Map<number, R28MetricInput[]>();
  for (const input of metricInputsForTarget(inputs)) groups.set(input.row.decisionTime, [...(groups.get(input.row.decisionTime) ?? []), input]);
  const values: number[] = [];
  for (const group of groups.values()) {
    const value = calculateR28TieAwareSpearman(group.map((input) => input.score), group.map((input) => input.target!));
    if (value !== null) values.push(value);
  }
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function orientR28TrainingFeature(rows: readonly R28ValidationFeatureRow[], outcomes: ReadonlyMap<string, R28DiagnosticOutcomeProjection>, featureIndex: number): 1 | -1 {
  const paired: Array<{ feature: number; continuous: number }> = [];
  for (const row of rows) {
    const continuous = outcomes.get(row.observationId)?.primaryContinuous ?? null;
    if (continuous !== null && Number.isFinite(continuous)) paired.push({ feature: row.features[featureIndex]!, continuous });
  }
  const correlation = calculateR28TieAwareSpearman(paired.map((item) => item.feature), paired.map((item) => item.continuous));
  return correlation !== null && correlation < 0 ? -1 : 1;
}

function featureTrainingAuc(rows: readonly R28ValidationFeatureRow[], outcomes: ReadonlyMap<string, R28DiagnosticOutcomeProjection>, featureIndex: number): number | null {
  const orientation = orientR28TrainingFeature(rows, outcomes, featureIndex);
  const inputs = validMetricInputs(rows, outcomes, "PRIMARY_POSITIVE", (row) => orientation * row.features[featureIndex]!);
  return metricAuc(inputs);
}

export function selectR28RawQuadraticTop4(rows: readonly R28ValidationFeatureRow[], outcomes: ReadonlyMap<string, R28DiagnosticOutcomeProjection>): readonly R28FeatureName[] {
  return Object.freeze(R28_FEATURE_NAMES.map((featureName, featureIndex) => ({ featureName, featureIndex, auc: featureTrainingAuc(rows, outcomes, featureIndex) ?? 0.5 })).sort((left, right) => Math.abs(right.auc - 0.5) - Math.abs(left.auc - 0.5) || left.featureIndex - right.featureIndex).slice(0, 4).map((item) => item.featureName));
}

export function expandR28QuadraticTop4Features(features: readonly number[], top4Indexes: readonly number[]): number[] {
  if (top4Indexes.length !== 4) throw new Error("R28 quadratic probe requires exactly four top feature indexes.");
  const terms = top4Indexes.map((index) => features[index]!);
  const squares = terms.map((value) => value ** 2);
  const interactions: number[] = [];
  for (let left = 0; left < terms.length; left += 1) for (let right = left + 1; right < terms.length; right += 1) interactions.push(terms[left]! * terms[right]!);
  return [...terms, ...squares, ...interactions];
}

function gaussianSolve(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) throw new Error("R28 logistic Hessian is singular.");
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    for (let index = column; index <= size; index += 1) augmented[column]![index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      if (factor === 0) continue;
      for (let index = column; index <= size; index += 1) augmented[row]![index] -= factor * augmented[column]![index]!;
    }
  }
  return augmented.map((row) => row[size]!);
}

function fitR28Logistic(examples: readonly LogisticExample[]): LogisticModel {
  if (examples.length === 0) throw new Error("R28 logistic probe requires research examples.");
  const terms = examples[0]!.features.length;
  const positives = examples.filter((example) => example.target === 1).length;
  const negatives = examples.length - positives;
  if (positives === 0 || negatives === 0) throw new Error("R28 logistic probe requires both primary classes.");
  const means = Array<number>(terms).fill(0);
  for (const example of examples) for (let index = 0; index < terms; index += 1) means[index] += example.features[index]!;
  for (let index = 0; index < terms; index += 1) means[index] /= examples.length;
  const deviations = Array<number>(terms).fill(0);
  for (const example of examples) for (let index = 0; index < terms; index += 1) deviations[index] += (example.features[index]! - means[index]!) ** 2;
  for (let index = 0; index < terms; index += 1) deviations[index] = Math.sqrt(deviations[index]! / examples.length) || 1;
  const standardized = examples.map((example) => example.features.map((value, index) => (value - means[index]!) / deviations[index]!));
  const parameterCount = terms + 1;
  const coefficients = Array<number>(parameterCount).fill(0);
  coefficients[0] = Math.log(positives / negatives);
  for (let iteration = 0; iteration < R28_LOGISTIC_MAX_ITERATIONS; iteration += 1) {
    const gradient = Array<number>(parameterCount).fill(0);
    const hessian = Array.from({ length: parameterCount }, () => Array<number>(parameterCount).fill(0));
    for (let rowIndex = 0; rowIndex < standardized.length; rowIndex += 1) {
      const row = [1, ...standardized[rowIndex]!];
      let linear = 0;
      for (let parameter = 0; parameter < parameterCount; parameter += 1) linear += coefficients[parameter]! * row[parameter]!;
      const probability = 1 / (1 + Math.exp(-Math.max(LOGISTIC_CLAMP.min, Math.min(LOGISTIC_CLAMP.max, linear))));
      const residual = probability - examples[rowIndex]!.target;
      const curvature = Math.max(probability * (1 - probability), Number.EPSILON);
      for (let parameter = 0; parameter < parameterCount; parameter += 1) {
        gradient[parameter] += residual * row[parameter]!;
        for (let other = 0; other < parameterCount; other += 1) hessian[parameter]![other] += curvature * row[parameter]! * row[other]!;
      }
    }
    for (let parameter = 1; parameter < parameterCount; parameter += 1) {
      gradient[parameter] += R28_LOGISTIC_LAMBDA * coefficients[parameter]!;
      hessian[parameter]![parameter] += R28_LOGISTIC_LAMBDA;
    }
    const step = gaussianSolve(hessian, gradient);
    let maxChange = 0;
    for (let parameter = 0; parameter < parameterCount; parameter += 1) {
      const next = coefficients[parameter]! - step[parameter]!;
      assertFinite(next, `R28 logistic coefficient ${parameter}`);
      maxChange = Math.max(maxChange, Math.abs(next - coefficients[parameter]!));
      coefficients[parameter] = next;
    }
    if (maxChange <= R28_LOGISTIC_TOLERANCE) break;
  }
  return Object.freeze({ means: Object.freeze(means), deviations: Object.freeze(deviations), intercept: coefficients[0]!, coefficients: Object.freeze(coefficients.slice(1)), trainingPositiveRate: positives / examples.length, terms });
}

function predictR28Logistic(model: LogisticModel, features: readonly number[]): number {
  if (features.length !== model.terms) throw new Error("R28 logistic prediction dimension mismatch.");
  let linear = model.intercept;
  for (let index = 0; index < features.length; index += 1) linear += model.coefficients[index]! * ((features[index]! - model.means[index]!) / model.deviations[index]!);
  return 1 / (1 + Math.exp(-Math.max(LOGISTIC_CLAMP.min, Math.min(LOGISTIC_CLAMP.max, linear))));
}

export function scoreR28ValidationFeatures(model: LogisticModel, rows: readonly R28ValidationFeatureRow[], featureTransform: (row: R28ValidationFeatureRow) => readonly number[]): readonly Readonly<{ observationId: string; decisionTime: number; symbol: ResearchSymbol; direction: R28Direction; features: readonly number[]; score: number }>[] {
  return Object.freeze(rows.map((row) => Object.freeze({ ...row, features: Object.freeze([...featureTransform(row)]), score: predictR28Logistic(model, featureTransform(row)) })));
}

function foldFeatureMetrics(rows: readonly R28SourceRow[], direction: R28Direction, foldId: (typeof R28_FOLD_IDS)[number], representation: R28Representation): readonly R28FeatureFoldMetric[] {
  const represented = featureRowsForRepresentation(rows, direction, representation);
  const researchSource = rows.filter((row) => row.featureRow.direction === direction && isRole(row, foldId, "RESEARCH"));
  const validationSource = rows.filter((row) => row.featureRow.direction === direction && isRole(row, foldId, "VALIDATION"));
  const researchFeatures = featureRowsForRepresentation(researchSource, direction, representation).rows;
  const validationFeatures = featureRowsForRepresentation(validationSource, direction, representation).rows;
  const researchOutcomes = mergeFeatureRowsWithOutcomes(researchFeatures, researchSource);
  const validationOutcomes = mergeFeatureRowsWithOutcomes(validationFeatures, validationSource);
  return Object.freeze(R28_FEATURE_NAMES.map((featureName, featureIndex) => {
    const orientation = orientR28TrainingFeature(researchFeatures, researchOutcomes, featureIndex);
    const scoring = (row: R28ValidationFeatureRow) => orientation * row.features[featureIndex]!;
    const primary = validMetricInputs(validationFeatures, validationOutcomes, "PRIMARY_POSITIVE", scoring);
    const cost = validMetricInputs(validationFeatures, validationOutcomes, "COST_STRESS_POSITIVE", scoring);
    const latency = validMetricInputs(validationFeatures, validationOutcomes, "LATENCY_POSITIVE", scoring);
    return Object.freeze({ featureName, direction, foldId, representation, trainingOrientation: orientation, validationExamplesPrimary: metricInputsForTarget(primary).length, validationExamplesCostStress: metricInputsForTarget(cost).length, validationExamplesLatency: metricInputsForTarget(latency).length, primaryAuc: metricAuc(primary), costStressAuc: metricAuc(cost), latencyAuc: metricAuc(latency), primarySpearman: metricSpearman(primary), costStressSpearman: metricSpearman(cost), latencySpearman: metricSpearman(latency), meanTimestampPrimarySpearman: timestampSpearman(primary), meanTimestampCostStressSpearman: timestampSpearman(cost), meanTimestampLatencySpearman: timestampSpearman(latency), crossSectionalNonZeroDecisionTimeRate: represented.nonZeroRates[featureIndex]! });
  }));
}

function transformedFeatureRows(rows: readonly R28SourceRow[], direction: R28Direction, representation: R28Representation, foldId: (typeof R28_FOLD_IDS)[number], role: "RESEARCH" | "VALIDATION"): Readonly<{ rows: readonly R28ValidationFeatureRow[]; outcomes: ReadonlyMap<string, R28DiagnosticOutcomeProjection> }> {
  const selected = rows.filter((row) => row.featureRow.direction === direction && isRole(row, foldId, role));
  const features = featureRowsForRepresentation(selected, direction, representation).rows;
  return Object.freeze({ rows: features, outcomes: mergeFeatureRowsWithOutcomes(features, selected) });
}

function probeFeatureRows(rows: readonly R28SourceRow[], direction: R28Direction, probeId: R28ProbeId, foldId: (typeof R28_FOLD_IDS)[number], role: "RESEARCH" | "VALIDATION"): Readonly<{ rows: readonly R28ValidationFeatureRow[]; outcomes: ReadonlyMap<string, R28DiagnosticOutcomeProjection>; top4: readonly R28FeatureName[] }> {
  if (probeId === "XS_LINEAR_ALL18") {
    const value = transformedFeatureRows(rows, direction, "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME", foldId, role);
    return Object.freeze({ ...value, top4: Object.freeze([]) });
  }
  const value = transformedFeatureRows(rows, direction, "RAW_PIT", foldId, role);
  const top4 = role === "RESEARCH" ? selectR28RawQuadraticTop4(value.rows, value.outcomes) : selectR28RawQuadraticTop4(transformedFeatureRows(rows, direction, "RAW_PIT", foldId, "RESEARCH").rows, transformedFeatureRows(rows, direction, "RAW_PIT", foldId, "RESEARCH").outcomes);
  if (probeId === "RAW_LINEAR_ALL18") return Object.freeze({ ...value, top4: Object.freeze([]) });
  const indexes = top4.map((name) => R28_FEATURE_NAMES.indexOf(name));
  const expanded = value.rows.map((row) => Object.freeze({ ...row, features: Object.freeze(expandR28QuadraticTop4Features(row.features, indexes)) }));
  return Object.freeze({ rows: Object.freeze(expanded), outcomes: value.outcomes, top4 });
}

function fitProbe(rows: readonly R28SourceRow[], direction: R28Direction, probeId: R28ProbeId, foldId: (typeof R28_FOLD_IDS)[number]): Readonly<{ model: LogisticModel; research: ReturnType<typeof probeFeatureRows>; validation: ReturnType<typeof probeFeatureRows> }> {
  const research = probeFeatureRows(rows, direction, probeId, foldId, "RESEARCH");
  const validation = probeFeatureRows(rows, direction, probeId, foldId, "VALIDATION");
  const examples: LogisticExample[] = [];
  for (const row of research.rows) {
    const target = research.outcomes.get(row.observationId)?.primaryPositive ?? null;
    if (target !== null) examples.push({ features: row.features, target });
  }
  return Object.freeze({ model: fitR28Logistic(examples), research, validation });
}

function probeFoldMetric(rows: readonly R28SourceRow[], direction: R28Direction, probeId: R28ProbeId, foldId: (typeof R28_FOLD_IDS)[number]): R28ProbeFoldMetric {
  const fitted = fitProbe(rows, direction, probeId, foldId);
  const scored = scoreR28ValidationFeatures(fitted.model, fitted.validation.rows, (row) => row.features);
  const makeInputs = (target: R28TargetId): R28MetricInput[] => scored.map((row) => Object.freeze({ row, score: row.score, target: targetValue(fitted.validation.outcomes.get(row.observationId)!, target) }));
  const primary = makeInputs("PRIMARY_POSITIVE");
  const cost = makeInputs("COST_STRESS_POSITIVE");
  const latency = makeInputs("LATENCY_POSITIVE");
  const allScores = scored.map((row) => row.score);
  const primaryValid = metricInputsForTarget(primary);
  const costValid = metricInputsForTarget(cost);
  const latencyValid = metricInputsForTarget(latency);
  const trainingTargets = fitted.research.rows.map((row) => fitted.research.outcomes.get(row.observationId)?.primaryPositive).filter((value): value is 0 | 1 => value !== null);
  return Object.freeze({ probeId, direction, foldId, termCount: fitted.model.terms, top4FeatureNames: fitted.validation.top4, primaryAuc: metricAuc(primary), costStressAuc: metricAuc(cost), latencyAuc: metricAuc(latency), primaryPositiveFoldIndicator: (metricAuc(primary) ?? 0.5) > 0.5, costPositiveFoldIndicator: (metricAuc(cost) ?? 0.5) > 0.5, latencyPositiveFoldIndicator: (metricAuc(latency) ?? 0.5) > 0.5, primaryMeanTimestampSpearman: timestampSpearman(primary), costMeanTimestampSpearman: timestampSpearman(cost), latencyMeanTimestampSpearman: timestampSpearman(latency), primaryValidExampleCount: primaryValid.length, costValidExampleCount: costValid.length, latencyValidExampleCount: latencyValid.length, trainingPositiveRate: trainingTargets.length === 0 ? null : trainingTargets.filter((value) => value === 1).length / trainingTargets.length, scoreMin: allScores.length === 0 ? null : Math.min(...allScores), scoreP50: quantile(allScores, 0.5), scoreP90: quantile(allScores, 0.9), scoreP95: quantile(allScores, 0.95), scoreP99: quantile(allScores, 0.99), scoreMax: allScores.length === 0 ? null : Math.max(...allScores) });
}

function probeAggregate(foldMetrics: readonly R28ProbeFoldMetric[], probeId: R28ProbeId, direction: R28Direction): R28ProbeAggregate {
  const primaryAuc = foldMetrics.map((metric) => metric.primaryAuc).filter((value): value is number => value !== null);
  const costAuc = foldMetrics.map((metric) => metric.costStressAuc).filter((value): value is number => value !== null);
  const latencyAuc = foldMetrics.map((metric) => metric.latencyAuc).filter((value): value is number => value !== null);
  const primaryRank = foldMetrics.map((metric) => metric.primaryMeanTimestampSpearman).filter((value): value is number => value !== null);
  const costRank = foldMetrics.map((metric) => metric.costMeanTimestampSpearman).filter((value): value is number => value !== null);
  const latencyRank = foldMetrics.map((metric) => metric.latencyMeanTimestampSpearman).filter((value): value is number => value !== null);
  const absoluteInformationPass = (median(primaryAuc) ?? 0) >= R28_THRESHOLDS.absolutePrimaryMedianAuc && primaryAuc.filter((value) => value > 0.5).length >= R28_THRESHOLDS.absolutePrimaryPositiveFolds && (median(costAuc) ?? 0) >= R28_THRESHOLDS.absoluteCostMedianAuc && costAuc.filter((value) => value > 0.5).length >= R28_THRESHOLDS.absoluteCostPositiveFolds && (median(latencyAuc) ?? 0) >= R28_THRESHOLDS.absoluteLatencyMedianAuc && latencyAuc.filter((value) => value > 0.5).length >= R28_THRESHOLDS.absoluteLatencyPositiveFolds;
  const rankingInformationPass = (median(primaryRank) ?? -1) >= R28_THRESHOLDS.rankingPrimaryMedianSpearman && primaryRank.filter((value) => value > 0).length >= R28_THRESHOLDS.rankingPrimaryPositiveFolds && (median(costRank) ?? -1) >= R28_THRESHOLDS.rankingCostMedianSpearman && (median(latencyRank) ?? -1) >= R28_THRESHOLDS.rankingLatencyMedianSpearman && latencyRank.filter((value) => value > 0).length >= R28_THRESHOLDS.rankingLatencyPositiveFolds;
  return Object.freeze({ probeId, direction, foldMetrics: Object.freeze([...foldMetrics]), primaryMedianAuc: median(primaryAuc), costMedianAuc: median(costAuc), latencyMedianAuc: median(latencyAuc), primaryMedianRankIc: median(primaryRank), costMedianRankIc: median(costRank), latencyMedianRankIc: median(latencyRank), primaryPositiveAucFolds: primaryAuc.filter((value) => value > 0.5).length, costPositiveAucFolds: costAuc.filter((value) => value > 0.5).length, latencyPositiveAucFolds: latencyAuc.filter((value) => value > 0.5).length, primaryPositiveRankIcFolds: primaryRank.filter((value) => value > 0).length, latencyPositiveRankIcFolds: latencyRank.filter((value) => value > 0).length, absoluteInformationPass, rankingInformationPass, usableInformationPass: absoluteInformationPass && rankingInformationPass });
}

function featureDirectionSummary(featureMetrics: readonly R28FeatureFoldMetric[], direction: R28Direction): Readonly<{ collapsed: readonly R28FeatureName[]; stable: readonly R28FeatureName[] }> {
  const raw = featureMetrics.filter((metric) => metric.direction === direction && metric.representation === "RAW_PIT");
  const xs = featureMetrics.filter((metric) => metric.direction === direction && metric.representation === "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME");
  const collapsed = R28_FEATURE_NAMES.filter((name) => (xs.find((metric) => metric.featureName === name)?.crossSectionalNonZeroDecisionTimeRate ?? 1) <= R28_CROSS_SECTIONAL_COLLAPSE_RATE);
  const stable = R28_FEATURE_NAMES.filter((name) => {
    const metrics = raw.filter((metric) => metric.featureName === name);
    const signs = new Set(metrics.map((metric) => metric.trainingOrientation));
    const primary = metrics.map((metric) => metric.primaryAuc).filter((value): value is number => value !== null);
    const cost = metrics.map((metric) => metric.costStressAuc).filter((value): value is number => value !== null);
    const latency = metrics.map((metric) => metric.latencyAuc).filter((value): value is number => value !== null);
    return signs.size === 1 && metrics.length >= R28_THRESHOLDS.stableOrientationMinimumFolds && primary.filter((value) => value > 0.5).length >= R28_THRESHOLDS.stablePrimaryPositiveFolds && (median(primary) ?? 0) >= R28_THRESHOLDS.stablePrimaryMedianAuc && cost.filter((value) => value > 0.5).length >= R28_THRESHOLDS.stableCostPositiveFolds && (median(cost) ?? 0) >= R28_THRESHOLDS.stableCostMedianAuc && latency.filter((value) => value > 0.5).length >= R28_THRESHOLDS.stableLatencyPositiveFolds && (median(latency) ?? 0) >= R28_THRESHOLDS.stableLatencyMedianAuc;
  });
  return Object.freeze({ collapsed: Object.freeze(collapsed), stable: Object.freeze(stable) });
}

export function classifyR28Direction(direction: R28Direction, featureMetrics: readonly R28FeatureFoldMetric[], probes: readonly R28ProbeAggregate[]): R28DirectionClassification {
  const summary = featureDirectionSummary(featureMetrics, direction);
  const xs = probes.find((probe) => probe.probeId === "XS_LINEAR_ALL18" && probe.direction === direction)!;
  const raw = probes.find((probe) => probe.probeId === "RAW_LINEAR_ALL18" && probe.direction === direction)!;
  const quadratic = probes.find((probe) => probe.probeId === "RAW_QUADRATIC_TOP4" && probe.direction === direction)!;
  const rawPrimaryDelta = (raw.primaryMedianAuc ?? 0) - (xs.primaryMedianAuc ?? 0);
  const rawLatencyDelta = (raw.latencyMedianAuc ?? 0) - (xs.latencyMedianAuc ?? 0);
  const quadraticDelta = (quadratic.primaryMedianAuc ?? 0) - (raw.primaryMedianAuc ?? 0);
  let directionClassification: R28DirectionClassification["directionClassification"];
  let recommendedNextStage: R28DirectionClassification["recommendedNextStage"];
  if (raw.usableInformationPass && !xs.usableInformationPass && (rawPrimaryDelta >= R28_THRESHOLDS.informationLossDelta || rawLatencyDelta >= R28_THRESHOLDS.informationLossDelta)) {
    directionClassification = "CROSS_SECTIONAL_NORMALIZATION_INFORMATION_LOSS";
    recommendedNextStage = "HYBRID_RAW_PLUS_CROSS_SECTIONAL_ARCHITECTURE_REQUIRED";
  } else if (!raw.usableInformationPass && quadratic.usableInformationPass && quadraticDelta >= R28_THRESHOLDS.informationLossDelta) {
    directionClassification = "NONLINEAR_CAPACITY_LIMITATION";
    recommendedNextStage = "BOUNDED_NONLINEAR_MODEL_DEVELOPMENT_REQUIRED";
  } else if (xs.usableInformationPass || raw.usableInformationPass || quadratic.usableInformationPass) {
    directionClassification = "INFORMATION_PRESENT_BUT_R27_ARCHITECTURE_MISMATCH";
    recommendedNextStage = "SELECTION_AND_MODEL_ARCHITECTURE_REDESIGN_REQUIRED";
  } else if (summary.stable.length >= 2) {
    directionClassification = "WEAK_OR_UNSTABLE_INFORMATION_ONLY";
    recommendedNextStage = "FEATURE_ENGINEERING_AND_REGIME_DECOMPOSITION_REQUIRED";
  } else {
    directionClassification = "EXISTING_FEATURE_INFORMATION_INSUFFICIENT";
    recommendedNextStage = "NEW_INFORMATION_SOURCE_REQUIRED";
  }
  return Object.freeze({ direction, featuresCollapsedByCrossSectionalNormalization: summary.collapsed, stableRawInformationFeatures: summary.stable, probes: Object.freeze([...probes.filter((probe) => probe.direction === direction)]), directionClassification, recommendedNextStage });
}

function diagnosticsMarkdown(result: R28DiagnosticResult): string {
  const lines = [
    "# Round-028 Feature Information / Model Capacity Diagnostic",
    "",
    "Status: FEATURE_INFORMATION_DIAGNOSTIC_ONLY",
    "",
    `- Base SHA: ${result.baseSha}`,
    `- Accepted source: ${R28_SOURCE_PATH}`,
    `- Source SHA256: ${R28_SOURCE_SHA256}`,
    `- Feature information diagnostic executions: ${result.featureInformationDiagnosticExecutionCount}`,
    "- Economic evaluation performed: false",
    "- Trading economic metrics calculated: false",
    "- Historical labels read only for diagnostic AUC/Spearman/rank information: true",
    "- Candidate/champion/forward selection: not applicable and not emitted",
    "",
  ];
  for (const direction of R28_DIRECTIONS) {
    const summary = result.directions[direction];
    lines.push(`## ${direction}`, "", `- Classification: ${summary.directionClassification}`, `- Recommended next stage: ${summary.recommendedNextStage}`, `- Features collapsed by cross-sectional normalization: ${summary.featuresCollapsedByCrossSectionalNormalization.join(", ") || "none"}`, `- Stable raw information features: ${summary.stableRawInformationFeatures.join(", ") || "none"}`, "");
    for (const probe of summary.probes) lines.push(`### ${probe.probeId}`, "", `- Primary median AUC: ${probe.primaryMedianAuc ?? "null"}`, `- Cost-stress median AUC: ${probe.costMedianAuc ?? "null"}`, `- Latency median AUC: ${probe.latencyMedianAuc ?? "null"}`, `- Primary median rank IC: ${probe.primaryMedianRankIc ?? "null"}`, `- Latency median rank IC: ${probe.latencyMedianRankIc ?? "null"}`, `- Absolute information pass: ${probe.absoluteInformationPass}`, `- Ranking information pass: ${probe.rankingInformationPass}`, `- Usable information pass: ${probe.usableInformationPass}`, `- F1-F6 primary AUC: ${probe.foldMetrics.map((metric) => metric.primaryAuc ?? "null").join(", ")}`, `- F1-F6 latency AUC: ${probe.foldMetrics.map((metric) => metric.latencyAuc ?? "null").join(", ")}`, "");
  }
  lines.push("## Governance", "", "- newMarketDataFetched=false", "- forwardEconomicValuesRead=false", "- forwardReturnRead=false", "- performanceExecutionCount=0", "- candidateExecutableFrozen=false", "- forwardCandidateExists=false", "- forwardValidationAuthorized=false", "- automaticTrading=false", "- humanDecisionRequired=true", "- Production unchanged", "- emailRestorationAuthorized=false", "");
  return lines.join("\n");
}

export async function executeR28FeatureInformationDiagnostic(root = process.cwd()): Promise<Readonly<{ result: R28DiagnosticResult; markdown: string }>> {
  const sourcePath = resolveR28ObservationSource(root);
  const source = await verifyR28ObservationSource(root, sourcePath);
  const rows = await loadR28Rows(sourcePath);
  const featureMetrics = R28_DIRECTIONS.flatMap((direction) => R28_FOLD_IDS.flatMap((foldId) => R28_REPRESENTATIONS.flatMap((representation) => foldFeatureMetrics(rows, direction, foldId, representation))));
  const directions = Object.fromEntries(R28_DIRECTIONS.map((direction) => {
    const probes = R28_PROBE_IDS.map((probeId) => probeAggregate(R28_FOLD_IDS.map((foldId) => probeFoldMetric(rows, direction, probeId, foldId)), probeId, direction));
    return [direction, classifyR28Direction(direction, featureMetrics, probes)];
  })) as Record<R28Direction, R28DirectionClassification>;
  const result: R28DiagnosticResult = Object.freeze({ schemaVersion: "m3-r28-feature-information-capacity-reassessment-result-001", baseSha: R28_BASE_SHA, source, featureInformationDiagnosticExecutionCount: 1, economicEvaluationPerformed: false, tradingEconomicMetricsCalculated: false, validationOutcomeValuesReadForDiagnostic: true, globalHistoricalEconomicLabelsRead: true, sameFoldValidationOutcomeUsedForFit: false, sameFoldValidationOutcomeUsedForScoring: false, crossFoldExpandingWindowResearchReuse: true, featureMetrics: Object.freeze(featureMetrics), directions: Object.freeze(directions), governance: Object.freeze({ newMarketDataFetched: false, forwardEconomicValuesRead: false, forwardReturnRead: false, performanceExecutionCount: 0, candidateExecutableFrozen: false, forwardCandidateExists: false, forwardValidationAuthorized: false, emailRestorationAuthorized: false, automaticTrading: false, humanDecisionRequired: true, productionUnchanged: true, mainUnchanged: true, baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" }) });
  return Object.freeze({ result, markdown: diagnosticsMarkdown(result) });
}

export function diagnosticResultHash(result: R28DiagnosticResult): string {
  return createHash("sha256").update(stableStringify(result), "utf8").digest("hex");
}

export const R28_RUNTIME_IMPORT_GUARDS = Object.freeze({
  sourcePath: R28_SOURCE_PATH,
  manifestPath: R28_SOURCE_MANIFEST_PATH,
  sourceSha256: R28_SOURCE_SHA256,
  sourceManifestSha256: R28_SOURCE_MANIFEST_SHA256,
  sourceBytes: R28_SOURCE_BYTES,
  sourceObservationCount: R28_SOURCE_OBSERVATION_COUNT,
  economicEvaluationPerformed: false,
  tradingEconomicMetricsCalculated: false,
  featureCount: R28_FEATURE_NAMES.length,
  foldCount: R28_FOLD_IDS.length,
  directionCount: R28_DIRECTIONS.length,
  targetCount: R28_TARGET_IDS.length,
  probeCount: R28_PROBE_IDS.length,
  crossSectionalCollapseRate: R28_CROSS_SECTIONAL_COLLAPSE_RATE,
});

export function assertR28ProtocolRuntime(): true {
  if (R28_FEATURE_NAMES.length !== 18 || R28_FOLD_IDS.length !== 6 || R28_DIRECTIONS.length !== 2 || R28_PROBE_IDS.length !== 3 || R28_TARGET_IDS.length !== 3) throw new Error("R28 protocol cardinality mismatch.");
  if (R28_LOGISTIC_LAMBDA !== 10 || R28_LOGISTIC_MAX_ITERATIONS !== 100 || R28_LOGISTIC_TOLERANCE !== 1e-10) throw new Error("R28 logistic contract mismatch.");
  if (R28_SOURCE_END_ISO !== "2026-08-15T23:59:59.999Z" || R28_SOURCE_BYTES !== 1_893_811_055 || R28_SOURCE_OBSERVATION_COUNT !== 244_810) throw new Error("R28 source identity mismatch.");
  if (R28_FOLDS.F1.research.startTime >= R28_FOLDS.F1.validation.startTime) throw new Error("R28 fold ordering mismatch.");
  return true;
}

export function readR28ProtocolDocument(root = process.cwd()): Readonly<Record<string, unknown>> {
  const documentPath = path.join(root, "docs", "research", "round-028-protocol.json");
  return JSON.parse(readFileSync(documentPath, "utf8")) as Readonly<Record<string, unknown>>;
}
