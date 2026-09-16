import { createHash } from "node:crypto";

import { LONG_FEATURE_NAMES } from "./round-024-long-candidate.ts";
import { SHORT_ALTERNATE_FEATURE_NAMES, SHORT_FEATURE_NAMES } from "./round-024-short-candidate.ts";
import { stableStringify } from "./utils.ts";

export const R25_LONG_NO_VOLUME_FEATURE_NAMES = Object.freeze([
  "F01_directionAdjustedClose4hMinusEma200Atr",
  "F05_directionAdjustedEma20MinusEma50Atr",
  "F09_directionAdjustedClose1hMinusEma20Atr",
  "F10_atr14OverClose1h",
  "F17_directionAdjustedEma50Breadth",
] as const);

export type R25FeatureName = string;
export type R25Normalization = "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME";
export type R25Direction = "LONG" | "SHORT";

export type R25CandidateConfiguration = Readonly<{
  candidateConfigurationId: string;
  family: "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY";
  direction: R25Direction;
  featureSubsetId: string;
  featureNames: readonly R25FeatureName[];
  lambda: number;
  threshold: number;
  horizonHours: 4;
  normalization: R25Normalization;
  regimeGate: null;
  selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME";
}>;

export type R25FitExample = Readonly<{ features: Readonly<Record<string, number>>; targetNetR: number }>;

export type R25ModelArtifact = Readonly<{
  modelType: "R25_DIRECTIONAL_RIDGE";
  direction: R25Direction;
  family: "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY";
  lambda: number;
  featureNames: readonly R25FeatureName[];
  normalization: R25Normalization;
  intercept: number;
  coefficients: Readonly<Record<string, number>>;
  means: Readonly<Record<string, number>>;
  standardDeviations: Readonly<Record<string, number>>;
  trainingExamples: number;
  trainingTargetRange: Readonly<{ min: number; max: number }>;
  modelIdentitySha256: string;
}>;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function featureValues(features: Readonly<Record<string, number>>, names: readonly string[]): number[] {
  return names.map((name) => {
    const value = features[name];
    if (typeof value !== "number") throw new Error(`R25 feature ${name} is missing.`);
    assertFinite(value, `R25 feature ${name}`);
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
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) throw new Error("R25 ridge normal matrix is singular.");
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

export function fitR25CandidateModel(examples: readonly R25FitExample[], config: R25CandidateConfiguration): R25ModelArtifact {
  if (examples.length < config.featureNames.length + 1) throw new Error(`R25 ${config.direction} model requires more research examples than feature dimensions.`);
  const values = examples.map((example) => featureValues(example.features, config.featureNames));
  const means = Object.fromEntries(config.featureNames.map((name, index) => [name, values.reduce((sum, row) => sum + row[index]!, 0) / values.length])) as Record<string, number>;
  const standardDeviations = Object.fromEntries(config.featureNames.map((name, index) => {
    const variance = values.reduce((sum, row) => sum + (row[index]! - means[name]!) ** 2, 0) / values.length;
    return [name, Math.sqrt(variance) || 1];
  })) as Record<string, number>;
  const standardized = values.map((row) => row.map((value, index) => (value - means[config.featureNames[index]!]!) / standardDeviations[config.featureNames[index]!]!));
  const dimension = config.featureNames.length + 1;
  const matrix = Array.from({ length: dimension }, () => Array<number>(dimension).fill(0));
  const vector = Array<number>(dimension).fill(0);
  for (let exampleIndex = 0; exampleIndex < examples.length; exampleIndex += 1) {
    const row = [1, ...standardized[exampleIndex]!];
    const target = examples[exampleIndex]!.targetNetR;
    assertFinite(target, `R25 ${config.direction} target`);
    for (let r = 0; r < dimension; r += 1) {
      vector[r] += row[r]! * target;
      for (let c = 0; c < dimension; c += 1) matrix[r]![c] += row[r]! * row[c]!;
    }
  }
  for (let index = 1; index < dimension; index += 1) matrix[index]![index] += config.lambda;
  const solution = gaussianSolve(matrix, vector);
  const coefficients = Object.fromEntries(config.featureNames.map((name, index) => [name, solution[index + 1]!])) as Record<string, number>;
  const targets = examples.map((example) => example.targetNetR);
  const targetRange = { min: Math.min(...targets), max: Math.max(...targets) };
  const identity = { modelType: "R25_DIRECTIONAL_RIDGE", direction: config.direction, family: config.family, lambda: config.lambda, featureNames: config.featureNames, normalization: config.normalization, intercept: solution[0], coefficients, means, standardDeviations, trainingExamples: examples.length, targetRange };
  return Object.freeze({
    modelType: "R25_DIRECTIONAL_RIDGE",
    direction: config.direction,
    family: config.family,
    lambda: config.lambda,
    featureNames: config.featureNames,
    normalization: config.normalization,
    intercept: solution[0]!,
    coefficients: Object.freeze(coefficients),
    means: Object.freeze(means),
    standardDeviations: Object.freeze(standardDeviations),
    trainingExamples: examples.length,
    trainingTargetRange: Object.freeze(targetRange),
    modelIdentitySha256: createHash("sha256").update(stableStringify(identity), "utf8").digest("hex"),
  });
}

export function predictR25Candidate(model: R25ModelArtifact, features: Readonly<Record<string, number>>): number {
  const values = featureValues(features, model.featureNames);
  const prediction = model.intercept + model.featureNames.reduce((sum, name, index) => sum + model.coefficients[name]! * ((values[index]! - model.means[name]!) / model.standardDeviations[name]!), 0);
  assertFinite(prediction, `R25 ${model.direction} prediction`);
  return prediction;
}

const NORMALIZATION: R25Normalization = "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME";

export const R25_LONG_CANDIDATE_CONFIGURATIONS: readonly R25CandidateConfiguration[] = Object.freeze([
  { candidateConfigurationId: "R25_LONG_TREND_PULLBACK_VOLUME_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.10", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_TREND_PULLBACK_VOLUME", featureNames: LONG_FEATURE_NAMES, lambda: 30, threshold: 0.1, horizonHours: 4, normalization: NORMALIZATION, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R25_LONG_TREND_PULLBACK_VOLUME_NEUTRALIZED_LAMBDA_10_THRESHOLD_0.15", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_TREND_PULLBACK_VOLUME", featureNames: LONG_FEATURE_NAMES, lambda: 10, threshold: 0.15, horizonHours: 4, normalization: NORMALIZATION, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R25_LONG_TREND_PULLBACK_NO_VOLUME_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.10", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_TREND_PULLBACK_NO_VOLUME", featureNames: R25_LONG_NO_VOLUME_FEATURE_NAMES, lambda: 30, threshold: 0.1, horizonHours: 4, normalization: NORMALIZATION, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
]);

export const R25_SHORT_CANDIDATE_CONFIGURATIONS: readonly R25CandidateConfiguration[] = Object.freeze([
  { candidateConfigurationId: "R25_SHORT_TREND_VOLATILITY_FUNDING_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.03", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_TREND_VOLATILITY_FUNDING", featureNames: SHORT_FEATURE_NAMES, lambda: 30, threshold: 0.03, horizonHours: 4, normalization: NORMALIZATION, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R25_SHORT_RELATIVE_FLOW_FUNDING_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.03", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_RELATIVE_FLOW_FUNDING", featureNames: SHORT_ALTERNATE_FEATURE_NAMES, lambda: 30, threshold: 0.03, horizonHours: 4, normalization: NORMALIZATION, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
  { candidateConfigurationId: "R25_SHORT_RELATIVE_FLOW_FUNDING_NEUTRALIZED_LAMBDA_100_THRESHOLD_0.03", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_RELATIVE_FLOW_FUNDING", featureNames: SHORT_ALTERNATE_FEATURE_NAMES, lambda: 100, threshold: 0.03, horizonHours: 4, normalization: NORMALIZATION, regimeGate: null, selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME" },
]);
