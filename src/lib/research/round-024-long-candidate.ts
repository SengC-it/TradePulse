import { createHash } from "node:crypto";

import { stableStringify } from "./utils.ts";

export const LONG_FEATURE_NAMES = Object.freeze([
  "F01_directionAdjustedClose4hMinusEma200Atr",
  "F05_directionAdjustedEma20MinusEma50Atr",
  "F09_directionAdjustedClose1hMinusEma20Atr",
  "F10_atr14OverClose1h",
  "F12_logClippedQuoteVolumeOverPast20hMedian",
  "F17_directionAdjustedEma50Breadth",
] as const);

export const LONG_ALTERNATE_FEATURE_NAMES = Object.freeze([
  "F02_directionAdjustedEma50MinusEma200Atr",
  "F04_directionAdjustedReturn1hAtrPriceScale",
  "F06_directionAdjustedEma20ThreeBarSlopeAtr",
  "F11_rollingAtrPricePercentile30d",
  "F13_directionAdjustedTakerImbalance",
  "F18_directionAdjustedMomentumBreadth12h",
] as const);

export type LongFeatureName = (typeof LONG_FEATURE_NAMES)[number] | (typeof LONG_ALTERNATE_FEATURE_NAMES)[number];
export type LongFeatureSubsetId = "LONG_TREND_PULLBACK_VOLUME" | "LONG_SLOPE_VOLATILITY_FLOW";

export type LongCandidateConfiguration = Readonly<{
  candidateConfigurationId: string;
  family: "LONG-CANDIDATE-FAMILY";
  direction: "LONG";
  featureSubsetId: LongFeatureSubsetId;
  featureNames: readonly LongFeatureName[];
  threshold: number;
  horizonHours: 4;
  regimeGate: null;
  selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME";
}>;

export type LongFitExample = Readonly<{ features: Readonly<Record<string, number>>; targetNetR: number }>;

export type LongModelArtifact = Readonly<{
  modelType: "R24_LONG_DIRECTIONAL_RIDGE";
  family: "LONG-CANDIDATE-FAMILY";
  lambda: 10;
  featureNames: readonly LongFeatureName[];
  intercept: number;
  coefficients: Readonly<Record<LongFeatureName, number>>;
  means: Readonly<Record<LongFeatureName, number>>;
  standardDeviations: Readonly<Record<LongFeatureName, number>>;
  trainingExamples: number;
  trainingTargetRange: Readonly<{ min: number; max: number }>;
  modelIdentitySha256: string;
}>;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function featureValues(features: Readonly<Record<string, number>>, names: readonly LongFeatureName[]): number[] {
  return names.map((name) => {
    const value = features[name];
    assertFinite(value, `LONG feature ${name}`);
    return value;
  });
}

function gaussianSolve(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) throw new Error("LONG ridge normal matrix is singular.");
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    for (let item = column; item <= size; item += 1) augmented[column]![item] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      if (factor === 0) continue;
      for (let item = column; item <= size; item += 1) augmented[row]![item] -= factor * augmented[column]![item]!;
    }
  }
  return augmented.map((row) => row[size]!);
}

function featureNamesForSubset(subsetId: LongFeatureSubsetId): readonly LongFeatureName[] {
  return subsetId === "LONG_TREND_PULLBACK_VOLUME" ? LONG_FEATURE_NAMES : LONG_ALTERNATE_FEATURE_NAMES;
}

export function buildLongFeaturePipeline(features: Readonly<Record<string, number>>, subsetId: LongFeatureSubsetId): readonly number[] {
  return Object.freeze(featureValues(features, featureNamesForSubset(subsetId)));
}

export function fitLongCandidateModel(examples: readonly LongFitExample[], subsetId: LongFeatureSubsetId): LongModelArtifact {
  if (examples.length < featureNamesForSubset(subsetId).length + 1) throw new Error("LONG candidate model requires more research examples than feature dimensions.");
  const featureNames = featureNamesForSubset(subsetId);
  const values = examples.map((example) => buildLongFeaturePipeline(example.features, subsetId));
  const means = Object.fromEntries(featureNames.map((name, index) => [name, values.reduce((sum, row) => sum + row[index]!, 0) / values.length])) as Record<LongFeatureName, number>;
  const standardDeviations = Object.fromEntries(featureNames.map((name, index) => {
    const variance = values.reduce((sum, row) => sum + (row[index]! - means[name]) ** 2, 0) / values.length;
    return [name, Math.sqrt(variance) || 1];
  })) as Record<LongFeatureName, number>;
  const standardized = values.map((row) => row.map((value, index) => (value - means[featureNames[index]!]!) / standardDeviations[featureNames[index]!]!));
  const dimension = featureNames.length + 1;
  const matrix = Array.from({ length: dimension }, () => Array<number>(dimension).fill(0));
  const vector = Array<number>(dimension).fill(0);
  for (let exampleIndex = 0; exampleIndex < examples.length; exampleIndex += 1) {
    const row = [1, ...standardized[exampleIndex]!];
    const target = examples[exampleIndex]!.targetNetR;
    assertFinite(target, "LONG target");
    for (let r = 0; r < dimension; r += 1) {
      vector[r] += row[r]! * target;
      for (let c = 0; c < dimension; c += 1) matrix[r]![c] += row[r]! * row[c]!;
    }
  }
  for (let index = 1; index < dimension; index += 1) matrix[index]![index] += 10;
  const solution = gaussianSolve(matrix, vector);
  const coefficients = Object.fromEntries(featureNames.map((name, index) => [name, solution[index + 1]!])) as Record<LongFeatureName, number>;
  const targets = examples.map((example) => example.targetNetR);
  const targetRange = { min: Math.min(...targets), max: Math.max(...targets) };
  const identity = { modelType: "R24_LONG_DIRECTIONAL_RIDGE", family: "LONG-CANDIDATE-FAMILY", lambda: 10, featureNames, intercept: solution[0], coefficients, means, standardDeviations, trainingExamples: examples.length, targetRange };
  return Object.freeze({
    modelType: "R24_LONG_DIRECTIONAL_RIDGE",
    family: "LONG-CANDIDATE-FAMILY",
    lambda: 10,
    featureNames,
    intercept: solution[0]!,
    coefficients: Object.freeze(coefficients),
    means: Object.freeze(means),
    standardDeviations: Object.freeze(standardDeviations),
    trainingExamples: examples.length,
    trainingTargetRange: Object.freeze(targetRange),
    modelIdentitySha256: createHash("sha256").update(stableStringify(identity), "utf8").digest("hex"),
  });
}

export function predictLongCandidate(model: LongModelArtifact, features: Readonly<Record<string, number>>): number {
  const values = buildLongFeaturePipeline(features, model.featureNames === LONG_FEATURE_NAMES ? "LONG_TREND_PULLBACK_VOLUME" : "LONG_SLOPE_VOLATILITY_FLOW");
  const prediction = model.intercept + model.featureNames.reduce((sum, name, index) => sum + model.coefficients[name]! * ((values[index]! - model.means[name]!) / model.standardDeviations[name]!), 0);
  assertFinite(prediction, "LONG prediction");
  return prediction;
}

export const LONG_CANDIDATE_CONFIGURATIONS: readonly LongCandidateConfiguration[] = Object.freeze([
  { candidateConfigurationId: "R24_LONG_TREND_PULLBACK_VOLUME_THRESHOLD_0.05", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_TREND_PULLBACK_VOLUME", featureNames: LONG_FEATURE_NAMES, threshold: 0.05, horizonHours: 4, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R24_LONG_TREND_PULLBACK_VOLUME_THRESHOLD_0.10", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_TREND_PULLBACK_VOLUME", featureNames: LONG_FEATURE_NAMES, threshold: 0.1, horizonHours: 4, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R24_LONG_SLOPE_VOLATILITY_FLOW_THRESHOLD_0.05", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_SLOPE_VOLATILITY_FLOW", featureNames: LONG_ALTERNATE_FEATURE_NAMES, threshold: 0.05, horizonHours: 4, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R24_LONG_SLOPE_VOLATILITY_FLOW_THRESHOLD_0.10", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_SLOPE_VOLATILITY_FLOW", featureNames: LONG_ALTERNATE_FEATURE_NAMES, threshold: 0.1, horizonHours: 4, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
]);

