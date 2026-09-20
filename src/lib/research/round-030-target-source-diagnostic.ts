import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import type { ResearchSymbol } from "../config/constants.ts";
import { scanR23MetadataOnly } from "./round-023-development-data.ts";
import { streamR14Observations, readR14ObservationFreeze } from "./m3-r14-round-014-observations.ts";
import type { R13ForwardLabel } from "./m3-r13-round-013-labels.ts";
import type { R13Observation } from "./m3-r13-round-013-performance.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import {
  R30_ARCHIVE_FIELDS,
  R30_BASE_SHA,
  R30_DIRECTIONS,
  R30_FEATURE_NAMES,
  R30_FOLD_IDS,
  R30_GOVERNANCE,
  R30_HORIZON_HOURS,
  R30_LOGISTIC_LAMBDA,
  R30_LOGISTIC_MAX_ITERATIONS,
  R30_LOGISTIC_PREDICTOR_CLAMP,
  R30_LOGISTIC_TOLERANCE,
  R30_MODEL_ARCHITECTURES,
  R30_SOURCE_MANIFEST_PATH,
  R30_SOURCE_MANIFEST_SHA256,
  R30_SOURCE_OBSERVATION_COUNT,
  R30_SOURCE_PATH,
  R30_SOURCE_BYTES,
  R30_SOURCE_PROBE_DATES,
  R30_SOURCE_PROBE_ENDPOINTS,
  R30_SOURCE_PROBE_SYMBOLS,
  R30_SOURCE_SHA256,
  R30_SOURCE_START_ISO,
  R30_SOURCE_END_ISO,
  R30_SYMBOLS,
  R30_TARGET_IDS,
  R30_THRESHOLDS,
  type R30Direction,
  type R30FoldId,
  type R30RedesignTargetId,
  type R30TargetId,
} from "./round-030-protocol.ts";
import { stableStringify } from "./utils.ts";

const HOUR_MS = 60 * 60 * 1_000;
const FIVE_MINUTES_MS = 5 * 60 * 1_000;
const PURGE_MS = 24 * HOUR_MS;
const SOURCE_BASE_URL = "https://data.binance.vision";
const LIVE_BASE_URL = "https://fapi.binance.com/futures/data";

type BinaryTarget = 0 | 1;
export type R30ValidationFeatureRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R30Direction;
  features: readonly number[];
}>;

export type R30DiagnosticOutcome = Readonly<{
  observationId: string;
  t3Target: BinaryTarget | null;
  stressAlignedNetR: number | null;
}>;

export type R30ScoredValidationRow = R30ValidationFeatureRow & Readonly<{ score: number }>;
export type R30JoinedDiagnosticRow = R30ScoredValidationRow & R30DiagnosticOutcome;

type R30LabelInputs = Readonly<{
  primary: Pick<R13ForwardLabel, "status" | "netForwardAtr" | "netForwardAtrCostStress">;
  latency: Pick<R13ForwardLabel, "status" | "netForwardAtr" | "netForwardAtrCostStress">;
}>;

type R30SourceRow = Readonly<{
  featureRow: R30ValidationFeatureRow;
  targets: Readonly<Record<R30TargetId, BinaryTarget | null>>;
  diagnosticOutcome: R30DiagnosticOutcome;
}>;

type R30FitExample = Readonly<{ features: readonly number[]; target: BinaryTarget }>;

type R30Model = Readonly<{
  featureNames: readonly string[];
  lambda: typeof R30_LOGISTIC_LAMBDA;
  intercept: number;
  coefficients: readonly number[];
  featureMeans: readonly number[];
  featureStandardDeviations: readonly number[];
  trainingExamples: number;
  trainingPositiveRate: number;
  iterations: number;
  modelIdentitySha256: string;
}>;

export type R30FoldMetric = Readonly<{
  foldId: R30FoldId;
  direction: R30Direction;
  trainingTarget: R30TargetId;
  architecture: "RAW_LINEAR_ALL18" | "XS_LINEAR_ALL18";
  trainingExamples: number;
  trainingPositiveRate: number | null;
  modelIdentitySha256: string;
  validationExamples: number;
  t3Auc: number | null;
  t3PositiveRate: number | null;
  stressAlignedRankIc: number | null;
  scoreMin: number | null;
  scoreP50: number | null;
  scoreP90: number | null;
  scoreP95: number | null;
  scoreP99: number | null;
  scoreMax: number | null;
}>;

export type R30DirectionAggregate = Readonly<{
  direction: R30Direction;
  trainingTarget: R30TargetId;
  foldMetrics: readonly R30FoldMetric[];
  medianT3Auc: number | null;
  worstFoldT3Auc: number | null;
  positiveT3AucFolds: number;
  medianStressAlignedRankIc: number | null;
  positiveStressAlignedRankIcFolds: number;
  medianT3AucImprovementVsT0: number;
  eligible: boolean;
}>;

export type R30DirectionResult = Readonly<{
  direction: R30Direction;
  architecture: "RAW_LINEAR_ALL18" | "XS_LINEAR_ALL18";
  targets: readonly R30DirectionAggregate[];
  selectedTarget: R30RedesignTargetId | null;
  directionClassification: "TARGET_REDESIGN_PROMISING" | "TARGET_REDESIGN_INSUFFICIENT";
  directionNextStage: "STRESS_ALIGNED_TARGET_DEVELOPMENT_REQUIRED" | "NEW_INFORMATION_SOURCE_REQUIRED";
}>;

type R30TargetDiagnosticInput = Readonly<{
  medianT3Auc: number | null;
  worstFoldT3Auc: number | null;
  positiveT3AucFolds: number;
  medianStressAlignedRankIc: number | null;
  positiveStressAlignedRankIcFolds: number;
  medianT3AucImprovementVsT0: number;
}>;

export type R30ArchiveProbe = Readonly<{
  symbol: string;
  date: string;
  url: string;
  checksumUrl: string;
  downloadedAt: string;
  available: boolean;
  checksumPublished: string | null;
  checksumValid: boolean;
  localSha256: string | null;
  bytes: number | null;
  schemaValid: boolean;
  rowCount: number;
  firstCreateTime: number | null;
  lastCreateTime: number | null;
  fiveMinuteDeltaRate: number | null;
  duplicateTimestampCount: number;
  conflictingDuplicateCount: number;
  missingIntervalCount: number;
  nonFiniteFieldCount: number;
}>;

export type R30SourcePreflightResult = Readonly<{
  executionCount: 1;
  sourceProbeMarketDataFetched: true;
  sourceProbeDataUsedForEconomicEvaluation: false;
  archiveFilesRequested: 35;
  archiveFilesAvailable: number;
  checksumValidFiles: number;
  schemaValidFiles: number;
  archiveProbes: readonly R30ArchiveProbe[];
  recentOverlapMappings: Readonly<Record<string, unknown>>;
  fieldAgreementRates: Readonly<Record<string, unknown>>;
  timestampMapping: Readonly<Record<string, unknown>>;
  sampleCoverageComplete: boolean;
  checksumsComplete: boolean;
  schemaComplete: boolean;
  cadenceComplete: boolean;
  fieldMappingsComplete: boolean;
  timestampMappingResolved: boolean;
  sourceClassification: "METRICS_SOURCE_PREFLIGHT_ELIGIBLE" | "METRICS_SOURCE_PREFLIGHT_INELIGIBLE";
  sourceNextStage: "DEVELOPMENT_DATA_ACQUISITION" | "ALTERNATIVE_OR_PAID_INFORMATION_SOURCE_REQUIRED";
}>;

export type R30DiagnosticResult = Readonly<{
  schemaVersion: "m3-r30-target-source-admission-result-001";
  baseSha: typeof R30_BASE_SHA;
  source: Readonly<Record<string, unknown>>;
  r30DiagnosticExecutionCount: 1;
  targetDiagnosticExecutionCount: 1;
  fitCount: 48;
  stageA: Readonly<{ directions: Readonly<Record<R30Direction, R30DirectionResult>> }>;
  stageB: R30SourcePreflightResult | Readonly<{ executionCount: 0; skipped: true; reason: "BOTH_DIRECTIONS_TARGET_REDESIGN_PROMISING" }>;
  economicEvaluationPerformed: false;
  tradingEconomicMetricsCalculated: false;
  governance: Readonly<Record<string, unknown>>;
  overallClassification: "TARGET_REDESIGN_PROMISING" | "DIRECTION_SPLIT_REDESIGN_REQUIRED" | "NEW_INFORMATION_SOURCE_ESCALATION_REQUIRED";
  overallNextStage: "STRESS_ALIGNED_TARGET_DEVELOPMENT_REQUIRED" | "DIRECTION_SPLIT_REDESIGN_REQUIRED" | "NEW_INFORMATION_SOURCE_ESCALATION_REQUIRED";
  finalDecision: "ROUND-030 TARGET / SOURCE DIAGNOSTIC COMPLETE";
}>;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function midranks(values: readonly number[]): number[] {
  const ordered = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index);
  const ranks = Array<number>(values.length);
  let cursor = 0;
  while (cursor < ordered.length) {
    let end = cursor + 1;
    while (end < ordered.length && ordered[end]!.value === ordered[cursor]!.value) end += 1;
    const rank = (cursor + 1 + end) / 2;
    for (let index = cursor; index < end; index += 1) ranks[ordered[index]!.index] = rank;
    cursor = end;
  }
  return ranks;
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

export function calculateR30TieAwareAuc(scores: readonly number[], targets: readonly BinaryTarget[]): number | null {
  if (scores.length !== targets.length) throw new Error("R30 AUC input lengths must match.");
  const positives = targets.filter((target) => target === 1).length;
  const negatives = targets.length - positives;
  if (positives === 0 || negatives === 0) return null;
  const ranks = midranks(scores);
  const positiveRankSum = ranks.reduce((sum, rank, index) => sum + (targets[index] === 1 ? rank : 0), 0);
  return (positiveRankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

export function calculateR30TieAwareSpearman(left: readonly number[], right: readonly number[]): number | null {
  return pearson(midranks(left), midranks(right));
}

function median(values: readonly (number | null)[]): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[middle - 1]! + finite[middle]!) / 2 : finite[middle]!;
}

function quantile(values: readonly number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function targetValue(label: Pick<R13ForwardLabel, "status" | "netForwardAtr" | "netForwardAtrCostStress">, costStress: boolean): BinaryTarget | null {
  if (label.status !== "EXECUTED" || label.netForwardAtr === null || !Number.isFinite(label.netForwardAtr)) return null;
  const value = costStress ? label.netForwardAtrCostStress : label.netForwardAtr;
  if (value === null || !Number.isFinite(value)) return null;
  return value > 0 ? 1 : 0;
}

export function calculateR30Targets(labels: R30LabelInputs): Readonly<Record<R30TargetId, BinaryTarget | null>> {
  return Object.freeze({
    T0: targetValue(labels.primary, false),
    T1: targetValue(labels.primary, true),
    T2: targetValue(labels.latency, false),
    T3: targetValue(labels.latency, true),
  });
}

export function calculateR30DiagnosticOutcome(labels: R30LabelInputs, observationId: string): R30DiagnosticOutcome {
  return Object.freeze({ observationId, t3Target: targetValue(labels.latency, true), stressAlignedNetR: labels.latency.status === "EXECUTED" && labels.latency.netForwardAtrCostStress !== null && Number.isFinite(labels.latency.netForwardAtrCostStress) ? labels.latency.netForwardAtrCostStress : null });
}

export function scoreR30ValidationFeatures(model: R30Model, rows: readonly R30ValidationFeatureRow[]): readonly R30ScoredValidationRow[] {
  return Object.freeze(rows.map((row) => Object.freeze({ ...row, features: Object.freeze([...row.features]), score: predictR30Probability(model, row.features) })));
}

export function joinR30DiagnosticOutcome(rows: readonly R30ScoredValidationRow[], outcomes: ReadonlyMap<string, R30DiagnosticOutcome>): readonly R30JoinedDiagnosticRow[] {
  return Object.freeze(rows.map((row) => {
    const outcome = outcomes.get(row.observationId);
    return Object.freeze({ ...row, t3Target: outcome?.t3Target ?? null, stressAlignedNetR: outcome?.stressAlignedNetR ?? null });
  }));
}

function gaussianSolve(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) throw new Error("R30 logistic Hessian is singular.");
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

function fitR30Logistic(examples: readonly R30FitExample[]): R30Model {
  if (examples.length === 0) throw new Error("R30 logistic model requires training examples.");
  const dimension = examples[0]!.features.length;
  const positives = examples.filter((example) => example.target === 1).length;
  const negatives = examples.length - positives;
  if (positives === 0 || negatives === 0) throw new Error("R30 logistic model requires both target classes.");
  const means = Array<number>(dimension).fill(0);
  for (const example of examples) for (let index = 0; index < dimension; index += 1) means[index] += example.features[index]!;
  for (let index = 0; index < dimension; index += 1) means[index] /= examples.length;
  const deviations = Array<number>(dimension).fill(0);
  for (const example of examples) for (let index = 0; index < dimension; index += 1) deviations[index] += (example.features[index]! - means[index]!) ** 2;
  for (let index = 0; index < dimension; index += 1) deviations[index] = Math.sqrt(deviations[index]! / examples.length) || 1;
  const standardized = examples.map((example) => example.features.map((value, index) => (value - means[index]!) / deviations[index]!));
  const parameterCount = dimension + 1;
  const coefficients = Array<number>(parameterCount).fill(0);
  coefficients[0] = Math.log(positives / negatives);
  let iterations = 0;
  for (let iteration = 1; iteration <= R30_LOGISTIC_MAX_ITERATIONS; iteration += 1) {
    const gradient = Array<number>(parameterCount).fill(0);
    const hessian = Array.from({ length: parameterCount }, () => Array<number>(parameterCount).fill(0));
    for (let rowIndex = 0; rowIndex < standardized.length; rowIndex += 1) {
      const row = [1, ...standardized[rowIndex]!];
      const linear = row.reduce((sum, value, index) => sum + coefficients[index]! * value, 0);
      const clamped = Math.max(R30_LOGISTIC_PREDICTOR_CLAMP.min, Math.min(R30_LOGISTIC_PREDICTOR_CLAMP.max, linear));
      const probability = 1 / (1 + Math.exp(-clamped));
      const residual = probability - examples[rowIndex]!.target;
      const curvature = Math.max(probability * (1 - probability), Number.EPSILON);
      for (let parameter = 0; parameter < parameterCount; parameter += 1) {
        gradient[parameter] += residual * row[parameter]!;
        for (let other = 0; other < parameterCount; other += 1) hessian[parameter]![other] += curvature * row[parameter]! * row[other]!;
      }
    }
    for (let parameter = 1; parameter < parameterCount; parameter += 1) {
      gradient[parameter] += R30_LOGISTIC_LAMBDA * coefficients[parameter]!;
      hessian[parameter]![parameter] += R30_LOGISTIC_LAMBDA;
    }
    const step = gaussianSolve(hessian, gradient);
    let maxChange = 0;
    for (let parameter = 0; parameter < parameterCount; parameter += 1) {
      const next = coefficients[parameter]! - step[parameter]!;
      assertFinite(next, `R30 logistic coefficient ${parameter}`);
      maxChange = Math.max(maxChange, Math.abs(next - coefficients[parameter]!));
      coefficients[parameter] = next;
    }
    iterations = iteration;
    if (maxChange <= R30_LOGISTIC_TOLERANCE) break;
  }
  const identity = { modelType: "R30_BINARY_LOGISTIC_L2", featureNames: R30_FEATURE_NAMES, lambda: R30_LOGISTIC_LAMBDA, intercept: coefficients[0]!, interceptPolicy: "UNPENALIZED", coefficients: coefficients.slice(1), featureMeans: means, featureStandardDeviations: deviations, trainingExamples: examples.length, trainingPositiveRate: positives / examples.length, iterations };
  return Object.freeze({ featureNames: Object.freeze([...R30_FEATURE_NAMES]), lambda: R30_LOGISTIC_LAMBDA, intercept: identity.intercept, coefficients: Object.freeze([...identity.coefficients]), featureMeans: Object.freeze([...means]), featureStandardDeviations: Object.freeze([...deviations]), trainingExamples: examples.length, trainingPositiveRate: positives / examples.length, iterations, modelIdentitySha256: createHash("sha256").update(stableStringify(identity), "utf8").digest("hex") });
}

function predictR30Probability(model: R30Model, features: readonly number[]): number {
  if (features.length !== model.featureNames.length) throw new Error("R30 prediction feature dimension mismatch.");
  let linear = model.intercept;
  for (let index = 0; index < features.length; index += 1) linear += model.coefficients[index]! * ((features[index]! - model.featureMeans[index]!) / model.featureStandardDeviations[index]!);
  const clamped = Math.max(R30_LOGISTIC_PREDICTOR_CLAMP.min, Math.min(R30_LOGISTIC_PREDICTOR_CLAMP.max, linear));
  const probability = 1 / (1 + Math.exp(-clamped));
  assertFinite(probability, "R30 logistic probability");
  return probability;
}

function sourceRowFromObservation(observation: R13Observation): R30SourceRow {
  const primary = observation.labels[R30_HORIZON_HOURS];
  const latency = observation.latencyStressLabels[R30_HORIZON_HOURS];
  const features = R30_FEATURE_NAMES.map((name) => {
    const value = observation.features[name];
    if (!Number.isFinite(value)) throw new Error(`R30 non-finite feature ${name} at ${observation.observationId}.`);
    return value;
  });
  const labels = { primary, latency } satisfies R30LabelInputs;
  return Object.freeze({
    featureRow: Object.freeze({ observationId: observation.observationId, decisionTime: observation.decisionTime, symbol: observation.symbol, direction: observation.direction, features: Object.freeze(features) }),
    targets: calculateR30Targets(labels),
    diagnosticOutcome: calculateR30DiagnosticOutcome(labels, observation.observationId),
  });
}

export function resolveR30ObservationSource(root = process.cwd()): string {
  const resolvedRoot = path.resolve(root);
  const candidates = [
    path.join(resolvedRoot, R30_SOURCE_PATH),
    path.resolve(resolvedRoot, "..", ".r29-work", R30_SOURCE_PATH),
    path.resolve(resolvedRoot, "..", "round-014-r13-execution-replay", R30_SOURCE_PATH),
    path.resolve(resolvedRoot, "..", ".worktrees", "round-014-r13-execution-replay", R30_SOURCE_PATH),
  ];
  const source = candidates.find((candidate) => existsSync(candidate));
  if (!source) throw new Error("R30 accepted R14 observation freeze is unavailable; network acquisition is forbidden for Stage A.");
  return path.resolve(source);
}

export async function verifyR30ObservationSource(root = process.cwd(), sourcePath = resolveR30ObservationSource(root)): Promise<Readonly<Record<string, unknown>>> {
  const manifest = readR14ObservationFreeze(path.resolve(root));
  if (manifest.manifestSha256 !== R30_SOURCE_MANIFEST_SHA256 || manifest.observationDataPath !== R30_SOURCE_PATH || manifest.researchBoundary !== R30_SOURCE_END_ISO) throw new Error("R30 accepted R14 freeze manifest identity mismatch.");
  const scan = await scanR23MetadataOnly(sourcePath);
  if (scan.observationDataSha256 !== R30_SOURCE_SHA256 || scan.observationDataBytes !== R30_SOURCE_BYTES || scan.observationCount !== R30_SOURCE_OBSERVATION_COUNT || scan.directionCounts.LONG !== 122405 || scan.directionCounts.SHORT !== 122405 || scan.postBoundaryRows !== 0 || scan.beforeWindowRows !== 0 || scan.duplicateObservationIds !== 0 || !scan.chronologyValid || !scan.requiredSymbolsComplete || scan.economicValuesRead !== false) throw new Error("R30 source does not match the accepted immutable R14 observation identity.");
  return Object.freeze({ status: "ACCEPTED_R14_OBSERVATION_FREEZE_REUSED", canonicalPath: R30_SOURCE_PATH, manifestPath: R30_SOURCE_MANIFEST_PATH, sha256: R30_SOURCE_SHA256, manifestSha256: R30_SOURCE_MANIFEST_SHA256, bytes: R30_SOURCE_BYTES, observationCount: R30_SOURCE_OBSERVATION_COUNT, window: { start: R30_SOURCE_START_ISO, end: R30_SOURCE_END_ISO }, resolvedSourcePath: sourcePath, networkAcquired: false, newMarketData: false, developmentOnly: true });
}

async function loadR30Rows(sourcePath: string): Promise<readonly R30SourceRow[]> {
  const rows: R30SourceRow[] = [];
  for await (const observation of streamR14Observations(sourcePath)) rows.push(sourceRowFromObservation(observation));
  if (rows.length !== R30_SOURCE_OBSERVATION_COUNT) throw new Error("R30 source row count does not match the accepted R14 identity.");
  return Object.freeze(rows);
}

function isRole(row: R30SourceRow, foldId: R30FoldId, role: "RESEARCH" | "VALIDATION"): boolean {
  const range = getResearchFoldRoleRange(foldId, role);
  if (role === "RESEARCH") return row.featureRow.decisionTime >= range.startTime && row.featureRow.decisionTime <= Math.min(range.endTime, getResearchFoldRoleRange(foldId, "VALIDATION").startTime - PURGE_MS);
  return row.featureRow.decisionTime >= range.startTime && row.featureRow.decisionTime <= range.endTime;
}

function byDirection(rows: readonly R30SourceRow[], direction: R30Direction): readonly R30SourceRow[] {
  return rows.filter((row) => row.featureRow.direction === direction);
}

function crossSectionalRows(rows: readonly R30SourceRow[], direction: R30Direction): readonly R30ValidationFeatureRow[] {
  const selected = byDirection(rows, direction);
  const groups = new Map<number, R30SourceRow[]>();
  for (const row of selected) groups.set(row.featureRow.decisionTime, [...(groups.get(row.featureRow.decisionTime) ?? []), row]);
  const result: R30ValidationFeatureRow[] = [];
  for (const peers of groups.values()) {
    if (peers.length !== R30_SYMBOLS.length || new Set(peers.map((peer) => peer.featureRow.symbol)).size !== R30_SYMBOLS.length) throw new Error(`R30 cross-sectional group is incomplete at ${peers[0]?.featureRow.decisionTime ?? "unknown"}.`);
    for (const peer of peers) {
      const features = R30_FEATURE_NAMES.map((_, index) => {
        const values = peers.map((candidate) => candidate.featureRow.features[index]!);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
        return deviation > 1e-12 ? (peer.featureRow.features[index]! - mean) / deviation : 0;
      });
      result.push(Object.freeze({ ...peer.featureRow, features: Object.freeze(features) }));
    }
  }
  return Object.freeze(result);
}

function representationRows(rows: readonly R30SourceRow[], direction: R30Direction, architecture: R30DirectionResult["architecture"]): readonly R30ValidationFeatureRow[] {
  if (architecture === "RAW_LINEAR_ALL18") return Object.freeze(byDirection(rows, direction).map((row) => row.featureRow));
  return crossSectionalRows(rows, direction);
}

function sourceById(rows: readonly R30SourceRow[]): ReadonlyMap<string, R30SourceRow> {
  return new Map(rows.map((row) => [row.featureRow.observationId, row]));
}

function foldRoleRows(rows: readonly R30SourceRow[], direction: R30Direction, foldId: R30FoldId, role: "RESEARCH" | "VALIDATION", architecture: R30DirectionResult["architecture"]): readonly R30ValidationFeatureRow[] {
  return representationRows(rows.filter((row) => row.featureRow.direction === direction && isRole(row, foldId, role)), direction, architecture);
}

function trainingExamplesFor(rows: readonly R30ValidationFeatureRow[], source: ReadonlyMap<string, R30SourceRow>, target: R30TargetId): readonly R30FitExample[] {
  const examples: R30FitExample[] = [];
  for (const row of rows) {
    const value = source.get(row.observationId)?.targets[target] ?? null;
    if (value !== null) examples.push(Object.freeze({ features: row.features, target: value }));
  }
  return Object.freeze(examples);
}

function foldMetric(rows: readonly R30SourceRow[], direction: R30Direction, trainingTarget: R30TargetId, foldId: R30FoldId, architecture: R30DirectionResult["architecture"]): R30FoldMetric {
  const source = sourceById(rows);
  const research = foldRoleRows(rows, direction, foldId, "RESEARCH", architecture);
  const validation = foldRoleRows(rows, direction, foldId, "VALIDATION", architecture);
  const model = fitR30Logistic(trainingExamplesFor(research, source, trainingTarget));
  const scored = scoreR30ValidationFeatures(model, validation);
  const outcomes = new Map(rows.map((row) => [row.featureRow.observationId, row.diagnosticOutcome]));
  const joined = joinR30DiagnosticOutcome(scored, outcomes);
  const valid = joined.filter((row): row is R30JoinedDiagnosticRow & Readonly<{ t3Target: BinaryTarget; stressAlignedNetR: number }> => row.t3Target !== null && row.stressAlignedNetR !== null && Number.isFinite(row.stressAlignedNetR));
  const auc = calculateR30TieAwareAuc(valid.map((row) => row.score), valid.map((row) => row.t3Target));
  const rankIc = calculateR30TieAwareSpearman(valid.map((row) => row.score), valid.map((row) => row.stressAlignedNetR));
  const labels = valid.map((row) => row.t3Target);
  const scores = joined.map((row) => row.score);
  return Object.freeze({ foldId, direction, trainingTarget, architecture, trainingExamples: model.trainingExamples, trainingPositiveRate: model.trainingPositiveRate, modelIdentitySha256: model.modelIdentitySha256, validationExamples: joined.length, t3Auc: auc, t3PositiveRate: labels.length === 0 ? null : labels.filter((value) => value === 1).length / labels.length, stressAlignedRankIc: rankIc, scoreMin: scores.length === 0 ? null : Math.min(...scores), scoreP50: quantile(scores, 0.5), scoreP90: quantile(scores, 0.9), scoreP95: quantile(scores, 0.95), scoreP99: quantile(scores, 0.99), scoreMax: scores.length === 0 ? null : Math.max(...scores) });
}

function aggregate(direction: R30Direction, target: R30TargetId, metrics: readonly R30FoldMetric[], baselineMedian: number | null): R30DirectionAggregate {
  const auc = metrics.map((metric) => metric.t3Auc);
  const rank = metrics.map((metric) => metric.stressAlignedRankIc);
  const medianAuc = median(auc);
  const worst = auc.filter((value): value is number => value !== null && Number.isFinite(value)).reduce<number | null>((current, value) => current === null ? value : Math.min(current, value), null);
  const medianRank = median(rank);
  const improvement = target === "T0" || baselineMedian === null || medianAuc === null ? 0 : medianAuc - baselineMedian;
  const eligible = target !== "T0" && medianAuc !== null && worst !== null && medianRank !== null && medianAuc >= R30_THRESHOLDS.minimumMedianT3Auc && metrics.filter((metric) => metric.t3Auc !== null && metric.t3Auc > 0.5).length >= R30_THRESHOLDS.minimumPositiveT3AucFolds && worst >= R30_THRESHOLDS.minimumWorstFoldT3Auc && medianRank >= R30_THRESHOLDS.minimumMedianStressAlignedRankIc && metrics.filter((metric) => metric.stressAlignedRankIc !== null && metric.stressAlignedRankIc > 0).length >= R30_THRESHOLDS.minimumPositiveStressAlignedRankIcFolds && improvement >= R30_THRESHOLDS.minimumMedianT3AucImprovementVsT0;
  return Object.freeze({ direction, trainingTarget: target, foldMetrics: Object.freeze([...metrics]), medianT3Auc: medianAuc, worstFoldT3Auc: worst, positiveT3AucFolds: metrics.filter((metric) => metric.t3Auc !== null && metric.t3Auc > 0.5).length, medianStressAlignedRankIc: medianRank, positiveStressAlignedRankIcFolds: metrics.filter((metric) => metric.stressAlignedRankIc !== null && metric.stressAlignedRankIc > 0).length, medianT3AucImprovementVsT0: improvement, eligible });
}

export function isR30TargetEligible(input: R30TargetDiagnosticInput): boolean {
  return input.medianT3Auc !== null && input.worstFoldT3Auc !== null && input.medianStressAlignedRankIc !== null && input.medianT3Auc >= R30_THRESHOLDS.minimumMedianT3Auc && input.positiveT3AucFolds >= R30_THRESHOLDS.minimumPositiveT3AucFolds && input.worstFoldT3Auc >= R30_THRESHOLDS.minimumWorstFoldT3Auc && input.medianStressAlignedRankIc >= R30_THRESHOLDS.minimumMedianStressAlignedRankIc && input.positiveStressAlignedRankIcFolds >= R30_THRESHOLDS.minimumPositiveStressAlignedRankIcFolds && input.medianT3AucImprovementVsT0 >= R30_THRESHOLDS.minimumMedianT3AucImprovementVsT0;
}

export function selectR30Target(aggregates: readonly (R30DirectionAggregate | (R30TargetDiagnosticInput & Readonly<{ direction: R30Direction; trainingTarget: R30RedesignTargetId; eligible: boolean }>))[]): R30RedesignTargetId | null {
  const eligible = aggregates.filter((aggregate): aggregate is typeof aggregate & Readonly<{ trainingTarget: R30RedesignTargetId }> => aggregate.eligible && aggregate.trainingTarget !== "T0");
  if (eligible.length === 0) return null;
  const ordered = [...eligible].sort((left, right) => (right.worstFoldT3Auc ?? -Infinity) - (left.worstFoldT3Auc ?? -Infinity) || (right.medianT3Auc ?? -Infinity) - (left.medianT3Auc ?? -Infinity) || (right.medianStressAlignedRankIc ?? -Infinity) - (left.medianStressAlignedRankIc ?? -Infinity) || left.trainingTarget.localeCompare(right.trainingTarget));
  return ordered[0]!.trainingTarget;
}

export function classifyR30Direction(direction: R30Direction, selectedTarget: R30RedesignTargetId | null): Readonly<{ direction: R30Direction; selectedTarget: R30RedesignTargetId | null; directionClassification: R30DirectionResult["directionClassification"]; directionNextStage: R30DirectionResult["directionNextStage"] }> {
  return selectedTarget === null ? { direction, selectedTarget, directionClassification: "TARGET_REDESIGN_INSUFFICIENT", directionNextStage: "NEW_INFORMATION_SOURCE_REQUIRED" } : { direction, selectedTarget, directionClassification: "TARGET_REDESIGN_PROMISING", directionNextStage: "STRESS_ALIGNED_TARGET_DEVELOPMENT_REQUIRED" };
}

export function shouldRunR30SourcePreflight(longSelectedTarget: R30RedesignTargetId | null, shortSelectedTarget: R30RedesignTargetId | null): boolean {
  return longSelectedTarget === null || shortSelectedTarget === null;
}

function executeDirection(rows: readonly R30SourceRow[], direction: R30Direction): R30DirectionResult {
  const architecture = R30_MODEL_ARCHITECTURES[direction];
  const targetMetrics = R30_TARGET_IDS.map((target) => Object.freeze({ target, metrics: Object.freeze(R30_FOLD_IDS.map((foldId) => foldMetric(rows, direction, target, foldId, architecture))) }));
  const baseline = aggregate(direction, "T0", targetMetrics[0]!.metrics, null);
  const aggregates = targetMetrics.map(({ target, metrics }) => aggregate(direction, target, metrics, baseline.medianT3Auc));
  const selectedTarget = selectR30Target(aggregates);
  return Object.freeze({ ...classifyR30Direction(direction, selectedTarget), architecture, targets: Object.freeze(aggregates) });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) { values.push(value); value = ""; } else value += character;
  }
  values.push(value);
  return values;
}

function zipFirstCsv(zip: Buffer): string {
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  let cursor = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (cursor < 0) throw new Error("R30 ZIP end-of-central-directory record is missing.");
  const count = zip.readUInt16LE(cursor + 10);
  const centralOffset = zip.readUInt32LE(cursor + 16);
  cursor = centralOffset;
  for (let entry = 0; entry < count; entry += 1) {
    if (zip.readUInt32LE(cursor) !== centralSignature) throw new Error("R30 ZIP central directory is invalid.");
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith(".csv")) continue;
    if (zip.readUInt32LE(localOffset) !== localSignature) throw new Error("R30 ZIP local header is invalid.");
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(start, start + compressedSize);
    const raw = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (raw === null) throw new Error(`R30 unsupported ZIP compression method ${method}.`);
    return raw.toString("utf8");
  }
  throw new Error("R30 ZIP has no CSV member.");
}

function parseUtc(value: string): number | null {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

type ArchiveRow = Readonly<Record<string, string>>;

function parseArchiveCsv(text: string): readonly ArchiveRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) throw new Error("R30 archive CSV is empty.");
  const headers = parseCsvLine(lines[0]!).map((header) => header.trim());
  if (headers.length !== R30_ARCHIVE_FIELDS.length || R30_ARCHIVE_FIELDS.some((field) => !headers.includes(field))) throw new Error("R30 archive schema is not the exact frozen schema.");
  return Object.freeze(lines.slice(1).map((line) => Object.freeze(Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index]!, value.trim()])))));
}

function archiveStats(rows: readonly ArchiveRow[]): Pick<R30ArchiveProbe, "rowCount" | "firstCreateTime" | "lastCreateTime" | "fiveMinuteDeltaRate" | "duplicateTimestampCount" | "conflictingDuplicateCount" | "missingIntervalCount" | "nonFiniteFieldCount"> {
  const parsed = rows.map((row) => ({ timestamp: parseUtc(row.create_time ?? ""), values: R30_ARCHIVE_FIELDS.slice(2).map((field) => Number(row[field] ?? "NaN")) }));
  const nonFinite = parsed.reduce((count, row) => count + (row.timestamp === null ? 1 : 0) + row.values.filter((value) => !Number.isFinite(value)).length, 0);
  const grouped = new Map<number, typeof parsed>();
  for (const row of parsed) if (row.timestamp !== null) grouped.set(row.timestamp, [...(grouped.get(row.timestamp) ?? []), row]);
  const timestamps = [...grouped.keys()].sort((left, right) => left - right);
  let conflicting = 0;
  let duplicates = 0;
  for (const group of grouped.values()) {
    if (group.length > 1) {
      duplicates += group.length - 1;
      const first = JSON.stringify(group[0]!.values);
      if (group.some((row) => JSON.stringify(row.values) !== first)) conflicting += group.length - 1;
    }
  }
  let exact = 0;
  let missing = 0;
  for (let index = 1; index < timestamps.length; index += 1) {
    const delta = timestamps[index]! - timestamps[index - 1]!;
    if (delta === FIVE_MINUTES_MS) exact += 1;
    if (delta > FIVE_MINUTES_MS) missing += Math.max(1, Math.round(delta / FIVE_MINUTES_MS) - 1);
  }
  return { rowCount: rows.length, firstCreateTime: timestamps[0] ?? null, lastCreateTime: timestamps.at(-1) ?? null, fiveMinuteDeltaRate: timestamps.length <= 1 ? null : exact / (timestamps.length - 1), duplicateTimestampCount: duplicates, conflictingDuplicateCount: conflicting, missingIntervalCount: missing, nonFiniteFieldCount: nonFinite };
}

function sha256Buffer(data: Buffer): string { return createHash("sha256").update(data).digest("hex"); }

function extractPublishedChecksum(text: string): string | null {
  const match = text.match(/\b([a-fA-F0-9]{64})\b/);
  return match?.[1]?.toLowerCase() ?? null;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`R30 fetch ${url} returned HTTP ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

async function probeArchive(symbol: string, date: string): Promise<R30ArchiveProbe> {
  const relative = `data/futures/um/daily/metrics/${symbol}/${symbol}-metrics-${date}.zip`;
  const url = `${SOURCE_BASE_URL}/${relative}`;
  const checksumUrl = `${url}.CHECKSUM`;
  const downloadedAt = new Date().toISOString();
  try {
    const [zip, checksum] = await Promise.all([fetchBuffer(url), fetchBuffer(checksumUrl)]);
    const localSha256 = sha256Buffer(zip);
    const checksumPublished = extractPublishedChecksum(checksum.toString("utf8"));
    const rows = parseArchiveCsv(zipFirstCsv(zip));
    const stats = archiveStats(rows);
    return Object.freeze({ symbol, date, url, checksumUrl, downloadedAt, available: true, checksumPublished, checksumValid: checksumPublished !== null && checksumPublished === localSha256, localSha256, bytes: zip.byteLength, schemaValid: true, ...stats });
  } catch {
    return Object.freeze({ symbol, date, url, checksumUrl, downloadedAt, available: false, checksumPublished: null, checksumValid: false, localSha256: null, bytes: null, schemaValid: false, rowCount: 0, firstCreateTime: null, lastCreateTime: null, fiveMinuteDeltaRate: null, duplicateTimestampCount: 0, conflictingDuplicateCount: 0, missingIntervalCount: 0, nonFiniteFieldCount: 0 });
  }
}

function timestampMappingForDelta(delta: number): "EXACT" | "ARCHIVE_MINUS_5M" | "ARCHIVE_PLUS_5M" | null {
  if (delta === 0) return "EXACT";
  if (delta === -FIVE_MINUTES_MS) return "ARCHIVE_MINUS_5M";
  if (delta === FIVE_MINUTES_MS) return "ARCHIVE_PLUS_5M";
  return null;
}

export { timestampMappingForDelta };

type LivePoint = Readonly<{ timestamp: number; value: number }>;
type LiveFieldMapping = Readonly<{ matchedRows: number; numericAgreementRate: number; maxRelativeError: number | null; mapping: "EXACT" | "ARCHIVE_MINUS_5M" | "ARCHIVE_PLUS_5M" | null; dominantCoverageRate: number }>;

async function fetchLivePoints(symbol: string, endpoint: string): Promise<readonly LivePoint[]> {
  const start = Date.parse("2026-09-18T00:00:00.000Z");
  const end = Date.parse("2026-09-18T23:59:59.999Z");
  const url = `${LIVE_BASE_URL}/${endpoint}?symbol=${symbol}&period=5m&startTime=${start}&endTime=${end}&limit=500`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`R30 live overlap ${endpoint}/${symbol} returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error(`R30 live overlap ${endpoint}/${symbol} returned a non-array payload.`);
  const field = endpoint === "openInterestHist" ? "sumOpenInterest" : endpoint === "takerlongshortRatio" ? "buySellRatio" : "longShortRatio";
  return Object.freeze(payload.map((item) => {
    if (typeof item !== "object" || item === null || !("timestamp" in item) || !(field in item)) throw new Error(`R30 live overlap ${endpoint}/${symbol} schema mismatch.`);
    const timestamp = Number((item as Record<string, unknown>).timestamp);
    const value = Number((item as Record<string, unknown>)[field]);
    if (!Number.isSafeInteger(timestamp) || !Number.isFinite(value)) throw new Error(`R30 live overlap ${endpoint}/${symbol} non-finite point.`);
    return Object.freeze({ timestamp, value });
  }));
}

function liveMapping(archiveRows: readonly ArchiveRow[], live: readonly LivePoint[], field: string): LiveFieldMapping {
  const archive = archiveRows.map((row) => ({ timestamp: parseUtc(row.create_time ?? ""), value: Number(row[field] ?? "NaN") })).filter((row): row is { timestamp: number; value: number } => row.timestamp !== null && Number.isFinite(row.value));
  const options = [0, -FIVE_MINUTES_MS, FIVE_MINUTES_MS] as const;
  const counts = options.map((delta) => ({ delta, count: archive.filter((row) => live.some((point) => point.timestamp === row.timestamp + delta)).length }));
  const ordered = [...counts].sort((left, right) => right.count - left.count || left.delta - right.delta);
  const dominant = ordered[0]!;
  const unique = ordered.length < 2 || dominant.count > ordered[1]!.count;
  const mapping = unique && archive.length > 0 && dominant.count / archive.length >= 0.99 ? timestampMappingForDelta(dominant.delta) : null;
  const pairs = mapping === null ? [] : archive.flatMap((row) => {
    const point = live.find((candidate) => candidate.timestamp === row.timestamp + dominant.delta);
    return point === undefined ? [] : [{ archive: row.value, live: point.value }];
  });
  const errors = pairs.map((pair) => Math.abs(pair.archive - pair.live) / Math.max(Math.abs(pair.archive), Math.abs(pair.live), 1e-12));
  return Object.freeze({ matchedRows: pairs.length, numericAgreementRate: pairs.length === 0 ? 0 : errors.filter((error) => error <= 1e-8).length / pairs.length, maxRelativeError: errors.length === 0 ? null : Math.max(...errors), mapping, dominantCoverageRate: archive.length === 0 ? 0 : dominant.count / archive.length });
}

async function runOverlapProbe(probes: readonly R30ArchiveProbe[]): Promise<Readonly<{ mappings: Readonly<Record<string, unknown>>; agreements: Readonly<Record<string, unknown>>; resolved: boolean }>> {
  const recent = new Map<string, ArchiveRow[]>();
  const live = new Map<string, readonly LivePoint[]>();
  const mappings: Record<string, unknown> = {};
  const agreements: Record<string, unknown> = {};
  let allResolved = true;
  for (const symbol of R30_SOURCE_PROBE_SYMBOLS) {
    const probe = probes.find((item) => item.symbol === symbol && item.date === "2026-09-18");
    if (!probe?.available || !probe.schemaValid) { allResolved = false; continue; }
    // The archive rows are fetched again only for the fixed overlap sample; they are not persisted or used for economics.
    try {
      const url = `${SOURCE_BASE_URL}/data/futures/um/daily/metrics/${symbol}/${symbol}-metrics-2026-09-18.zip`;
      const rows = parseArchiveCsv(zipFirstCsv(await fetchBuffer(url)));
      recent.set(symbol, [...rows]);
      for (const endpoint of R30_SOURCE_PROBE_ENDPOINTS) {
        const key = `${symbol}:${endpoint}`;
        const points = await fetchLivePoints(symbol, endpoint);
        live.set(key, points);
        const map = endpoint === "openInterestHist" ? liveMapping(rows, points, "sum_open_interest") : endpoint === "topLongShortAccountRatio" ? liveMapping(rows, points, "count_toptrader_long_short_ratio") : endpoint === "topLongShortPositionRatio" ? liveMapping(rows, points, "sum_toptrader_long_short_ratio") : endpoint === "globalLongShortAccountRatio" ? liveMapping(rows, points, "count_long_short_ratio") : liveMapping(rows, points, "sum_taker_long_short_vol_ratio");
        mappings[key] = map.mapping;
        agreements[key] = map;
        if (map.mapping === null || map.numericAgreementRate < 0.995 || (map.maxRelativeError ?? Infinity) > 1e-8) allResolved = false;
      }
    } catch {
      allResolved = false;
    }
  }
  return Object.freeze({ mappings: Object.freeze(mappings), agreements: Object.freeze(agreements), resolved: allResolved && recent.size === R30_SOURCE_PROBE_SYMBOLS.length && live.size === R30_SOURCE_PROBE_SYMBOLS.length * R30_SOURCE_PROBE_ENDPOINTS.length });
}

export async function runR30SourcePreflight(): Promise<R30SourcePreflightResult> {
  const archiveProbes: R30ArchiveProbe[] = [];
  for (const date of R30_SOURCE_PROBE_DATES) for (const symbol of R30_SOURCE_PROBE_SYMBOLS) archiveProbes.push(await probeArchive(symbol, date));
  const archiveFilesAvailable = archiveProbes.filter((probe) => probe.available).length;
  const checksumValidFiles = archiveProbes.filter((probe) => probe.checksumValid).length;
  const schemaValidFiles = archiveProbes.filter((probe) => probe.schemaValid).length;
  const cadenceComplete = archiveProbes.every((probe) => probe.fiveMinuteDeltaRate !== null && probe.fiveMinuteDeltaRate >= 0.99 && probe.conflictingDuplicateCount === 0 && probe.nonFiniteFieldCount === 0);
  const overlap = await runOverlapProbe(archiveProbes);
  const sampleCoverageComplete = archiveFilesAvailable === 35;
  const checksumsComplete = checksumValidFiles === 35;
  const schemaComplete = schemaValidFiles === 35;
  const fieldMappingsComplete = overlap.resolved;
  const timestampMappingResolved = overlap.resolved;
  const eligible = sampleCoverageComplete && checksumsComplete && schemaComplete && cadenceComplete && fieldMappingsComplete && timestampMappingResolved;
  return Object.freeze({ executionCount: 1, sourceProbeMarketDataFetched: true, sourceProbeDataUsedForEconomicEvaluation: false, archiveFilesRequested: 35, archiveFilesAvailable, checksumValidFiles, schemaValidFiles, archiveProbes: Object.freeze(archiveProbes), recentOverlapMappings: overlap.mappings, fieldAgreementRates: overlap.agreements, timestampMapping: Object.freeze({ options: ["EXACT", "ARCHIVE_MINUS_5M", "ARCHIVE_PLUS_5M"], resolved: timestampMappingResolved, dominantCoverageRequirement: 0.99 }), sampleCoverageComplete, checksumsComplete, schemaComplete, cadenceComplete, fieldMappingsComplete, timestampMappingResolved, sourceClassification: eligible ? "METRICS_SOURCE_PREFLIGHT_ELIGIBLE" : "METRICS_SOURCE_PREFLIGHT_INELIGIBLE", sourceNextStage: eligible ? "DEVELOPMENT_DATA_ACQUISITION" : "ALTERNATIVE_OR_PAID_INFORMATION_SOURCE_REQUIRED" });
}

function sourceSummary(sourcePath: string): Readonly<Record<string, unknown>> {
  return Object.freeze({ status: "ACCEPTED_R14_OBSERVATION_FREEZE_REUSED", canonicalPath: R30_SOURCE_PATH, manifestPath: R30_SOURCE_MANIFEST_PATH, sha256: R30_SOURCE_SHA256, manifestSha256: R30_SOURCE_MANIFEST_SHA256, bytes: R30_SOURCE_BYTES, observationCount: R30_SOURCE_OBSERVATION_COUNT, window: { start: R30_SOURCE_START_ISO, end: R30_SOURCE_END_ISO }, resolvedSourcePath: sourcePath, networkAcquired: false, newMarketData: false, classification: "DEVELOPMENT_ONLY / ALREADY_SEEN" });
}

export async function executeR30TargetSourceDiagnostic(root = process.cwd()): Promise<R30DiagnosticResult> {
  const sourcePath = resolveR30ObservationSource(root);
  await verifyR30ObservationSource(root, sourcePath);
  const rows = await loadR30Rows(sourcePath);
  const directions = Object.fromEntries(R30_DIRECTIONS.map((direction) => [direction, executeDirection(rows, direction)])) as Record<R30Direction, R30DirectionResult>;
  const longSelectedTarget = directions.LONG.selectedTarget;
  const shortSelectedTarget = directions.SHORT.selectedTarget;
  const runSource = shouldRunR30SourcePreflight(longSelectedTarget, shortSelectedTarget);
  const stageB = runSource ? await runR30SourcePreflight() : Object.freeze({ executionCount: 0 as const, skipped: true as const, reason: "BOTH_DIRECTIONS_TARGET_REDESIGN_PROMISING" as const });
  const bothPromising = longSelectedTarget !== null && shortSelectedTarget !== null;
  const sourceEligible = stageB.executionCount === 1 && stageB.sourceClassification === "METRICS_SOURCE_PREFLIGHT_ELIGIBLE";
  let overallClassification: R30DiagnosticResult["overallClassification"];
  let overallNextStage: R30DiagnosticResult["overallNextStage"];
  if (bothPromising) { overallClassification = "TARGET_REDESIGN_PROMISING"; overallNextStage = "STRESS_ALIGNED_TARGET_DEVELOPMENT_REQUIRED"; }
  else if (sourceEligible) { overallClassification = "DIRECTION_SPLIT_REDESIGN_REQUIRED"; overallNextStage = "DIRECTION_SPLIT_REDESIGN_REQUIRED"; }
  else { overallClassification = "NEW_INFORMATION_SOURCE_ESCALATION_REQUIRED"; overallNextStage = "NEW_INFORMATION_SOURCE_ESCALATION_REQUIRED"; }
  const finalDirections = Object.fromEntries(R30_DIRECTIONS.map((direction) => {
    const item = directions[direction];
    if (item.selectedTarget !== null) return [direction, item];
    if (stageB.executionCount === 1 && stageB.sourceClassification === "METRICS_SOURCE_PREFLIGHT_ELIGIBLE") return [direction, Object.freeze({ ...item, directionNextStage: "METRICS_DATA_ACQUISITION_REQUIRED" })];
    if (stageB.executionCount === 1) return [direction, Object.freeze({ ...item, directionNextStage: "ALTERNATIVE_OR_PAID_INFORMATION_SOURCE_REQUIRED" })];
    return [direction, item];
  })) as Record<R30Direction, R30DirectionResult>;
  const governance = Object.freeze({ ...R30_GOVERNANCE, newMarketDataFetched: stageB.executionCount === 1, newMarketDataUsedForEconomicEvaluation: false, round020LiquidationClosureReopened: false, r29DevelopmentEconomicEvaluationExecutionCount: 1 });
  return Object.freeze({ schemaVersion: "m3-r30-target-source-admission-result-001", baseSha: R30_BASE_SHA, source: sourceSummary(sourcePath), r30DiagnosticExecutionCount: 1, targetDiagnosticExecutionCount: 1, fitCount: 48, stageA: Object.freeze({ directions: Object.freeze(finalDirections) }), stageB, economicEvaluationPerformed: false, tradingEconomicMetricsCalculated: false, governance, overallClassification, overallNextStage, finalDecision: "ROUND-030 TARGET / SOURCE DIAGNOSTIC COMPLETE" });
}

export function diagnosticResultHash(result: R30DiagnosticResult): string { return createHash("sha256").update(stableStringify(result), "utf8").digest("hex"); }
