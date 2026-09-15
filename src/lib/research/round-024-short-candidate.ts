import { createHash } from "node:crypto";

import { stableStringify } from "./utils.ts";

export const SHORT_FEATURE_NAMES = Object.freeze([
  "F03_directionAdjustedEma200FiveBarSlopeAtr",
  "F07_directionAdjustedReturn4hAtrPriceScale",
  "F08_directionAdjustedReturn12hAtrPriceScale",
  "F11_rollingAtrPricePercentile30d",
  "F16_directionAdjustedSettledFundingBurden",
  "F18_directionAdjustedMomentumBreadth12h",
] as const);

export const SHORT_ALTERNATE_FEATURE_NAMES = Object.freeze([
  "F02_directionAdjustedEma50MinusEma200Atr",
  "F04_directionAdjustedReturn1hAtrPriceScale",
  "F09_directionAdjustedClose1hMinusEma20Atr",
  "F13_directionAdjustedTakerImbalance",
  "F14_directionAdjustedSymbolMinusBtcReturn12h",
  "F16_directionAdjustedSettledFundingBurden",
] as const);

export type ShortFeatureName = (typeof SHORT_FEATURE_NAMES)[number] | (typeof SHORT_ALTERNATE_FEATURE_NAMES)[number];
export type ShortFeatureSubsetId = "SHORT_TREND_VOLATILITY_FUNDING" | "SHORT_RELATIVE_FLOW_FUNDING";

export type ShortCandidateConfiguration = Readonly<{
  candidateConfigurationId: string;
  family: "SHORT-CANDIDATE-FAMILY";
  direction: "SHORT";
  featureSubsetId: ShortFeatureSubsetId;
  featureNames: readonly ShortFeatureName[];
  threshold: number;
  horizonHours: 4;
  regimeGate: null;
  selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME";
}>;

export type ShortFitExample = Readonly<{ features: Readonly<Record<string, number>>; targetNetR: number }>;

export type ShortModelArtifact = Readonly<{
  modelType: "R24_SHORT_DIRECTIONAL_RIDGE";
  family: "SHORT-CANDIDATE-FAMILY";
  lambda: 10;
  featureNames: readonly ShortFeatureName[];
  intercept: number;
  coefficients: Readonly<Record<ShortFeatureName, number>>;
  means: Readonly<Record<ShortFeatureName, number>>;
  standardDeviations: Readonly<Record<ShortFeatureName, number>>;
  trainingExamples: number;
  trainingTargetRange: Readonly<{ min: number; max: number }>;
  modelIdentitySha256: string;
}>;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function featureValues(features: Readonly<Record<string, number>>, names: readonly ShortFeatureName[]): number[] {
  return names.map((name) => {
    const value = features[name];
    assertFinite(value, `SHORT feature ${name}`);
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
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) throw new Error("SHORT ridge normal matrix is singular.");
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

function featureNamesForSubset(subsetId: ShortFeatureSubsetId): readonly ShortFeatureName[] {
  return subsetId === "SHORT_TREND_VOLATILITY_FUNDING" ? SHORT_FEATURE_NAMES : SHORT_ALTERNATE_FEATURE_NAMES;
}

export function buildShortFeaturePipeline(features: Readonly<Record<string, number>>, subsetId: ShortFeatureSubsetId): readonly number[] {
  return Object.freeze(featureValues(features, featureNamesForSubset(subsetId)));
}

export function fitShortCandidateModel(examples: readonly ShortFitExample[], subsetId: ShortFeatureSubsetId): ShortModelArtifact {
  if (examples.length < featureNamesForSubset(subsetId).length + 1) throw new Error("SHORT candidate model requires more research examples than feature dimensions.");
  const featureNames = featureNamesForSubset(subsetId);
  const values = examples.map((example) => buildShortFeaturePipeline(example.features, subsetId));
  const means = Object.fromEntries(featureNames.map((name, index) => [name, values.reduce((sum, row) => sum + row[index]!, 0) / values.length])) as Record<ShortFeatureName, number>;
  const standardDeviations = Object.fromEntries(featureNames.map((name, index) => {
    const variance = values.reduce((sum, row) => sum + (row[index]! - means[name]) ** 2, 0) / values.length;
    return [name, Math.sqrt(variance) || 1];
  })) as Record<ShortFeatureName, number>;
  const standardized = values.map((row) => row.map((value, index) => (value - means[featureNames[index]!]!) / standardDeviations[featureNames[index]!]!));
  const dimension = featureNames.length + 1;
  const matrix = Array.from({ length: dimension }, () => Array<number>(dimension).fill(0));
  const vector = Array<number>(dimension).fill(0);
  for (let exampleIndex = 0; exampleIndex < examples.length; exampleIndex += 1) {
    const row = [1, ...standardized[exampleIndex]!];
    const target = examples[exampleIndex]!.targetNetR;
    assertFinite(target, "SHORT target");
    for (let r = 0; r < dimension; r += 1) {
      vector[r] += row[r]! * target;
      for (let c = 0; c < dimension; c += 1) matrix[r]![c] += row[r]! * row[c]!;
    }
  }
  for (let index = 1; index < dimension; index += 1) matrix[index]![index] += 10;
  const solution = gaussianSolve(matrix, vector);
  const coefficients = Object.fromEntries(featureNames.map((name, index) => [name, solution[index + 1]!])) as Record<ShortFeatureName, number>;
  const targets = examples.map((example) => example.targetNetR);
  const targetRange = { min: Math.min(...targets), max: Math.max(...targets) };
  const identity = { modelType: "R24_SHORT_DIRECTIONAL_RIDGE", family: "SHORT-CANDIDATE-FAMILY", lambda: 10, featureNames, intercept: solution[0], coefficients, means, standardDeviations, trainingExamples: examples.length, targetRange };
  return Object.freeze({
    modelType: "R24_SHORT_DIRECTIONAL_RIDGE",
    family: "SHORT-CANDIDATE-FAMILY",
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

export function predictShortCandidate(model: ShortModelArtifact, features: Readonly<Record<string, number>>): number {
  const subsetId = model.featureNames === SHORT_FEATURE_NAMES ? "SHORT_TREND_VOLATILITY_FUNDING" : "SHORT_RELATIVE_FLOW_FUNDING";
  const values = buildShortFeaturePipeline(features, subsetId);
  const prediction = model.intercept + model.featureNames.reduce((sum, name, index) => sum + model.coefficients[name]! * ((values[index]! - model.means[name]!) / model.standardDeviations[name]!), 0);
  assertFinite(prediction, "SHORT prediction");
  return prediction;
}

export const SHORT_CANDIDATE_CONFIGURATIONS: readonly ShortCandidateConfiguration[] = Object.freeze([
  { candidateConfigurationId: "R24_SHORT_TREND_VOLATILITY_FUNDING_THRESHOLD_0.05", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_TREND_VOLATILITY_FUNDING", featureNames: SHORT_FEATURE_NAMES, threshold: 0.05, horizonHours: 4, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R24_SHORT_TREND_VOLATILITY_FUNDING_THRESHOLD_0.10", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_TREND_VOLATILITY_FUNDING", featureNames: SHORT_FEATURE_NAMES, threshold: 0.1, horizonHours: 4, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R24_SHORT_RELATIVE_FLOW_FUNDING_THRESHOLD_0.05", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_RELATIVE_FLOW_FUNDING", featureNames: SHORT_ALTERNATE_FEATURE_NAMES, threshold: 0.05, horizonHours: 4, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R24_SHORT_RELATIVE_FLOW_FUNDING_THRESHOLD_0.10", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_RELATIVE_FLOW_FUNDING", featureNames: SHORT_ALTERNATE_FEATURE_NAMES, threshold: 0.1, horizonHours: 4, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
]);
