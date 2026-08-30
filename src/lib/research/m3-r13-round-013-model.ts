import { createHash } from "node:crypto";

import { R13_FEATURE_NAMES, type R13FeatureName } from "./m3-r13-round-013-protocol.ts";
import { featureVectorFromOrderedValues, type R13FeatureVector } from "./m3-r13-round-013-features.ts";
import { stableStringify } from "./utils.ts";

export type R13FitExample = Readonly<{
  features: R13FeatureVector;
  targetNetForwardAtr: number;
}>;

export type R13Standardization = Readonly<{
  featureNames: typeof R13_FEATURE_NAMES;
  means: Readonly<Record<R13FeatureName, number>>;
  standardDeviations: Readonly<Record<R13FeatureName, number>>;
  identitySha256: string;
}>;

export type R13RidgeModel = Readonly<{
  modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION";
  lambda: 10;
  interceptPenalized: false;
  featureNames: typeof R13_FEATURE_NAMES;
  intercept: number;
  coefficients: Readonly<Record<R13FeatureName, number>>;
  standardization: R13Standardization;
  trainingExamples: number;
  trainingTargetRange: Readonly<{ min: number; max: number }>;
  modelIdentitySha256: string;
}>;

export const R13_RIDGE_LAMBDA = 10 as const;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function assertFeatureVector(features: R13FeatureVector): void {
  for (const name of R13_FEATURE_NAMES) assertFinite(features[name], `R13 feature ${name}`);
}

function assertExample(example: R13FitExample): void {
  assertFeatureVector(example.features);
  assertFinite(example.targetNetForwardAtr, "R13 target");
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function gaussianSolve(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) throw new Error("R13 ridge normal matrix is singular.");
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

function standardizeValues(features: R13FeatureVector, standardization: R13Standardization): number[] {
  return R13_FEATURE_NAMES.map((name) => (features[name] - standardization.means[name]) / standardization.standardDeviations[name]);
}

export function standardizeR13Features(features: R13FeatureVector, standardization: R13Standardization): R13FeatureVector {
  assertFeatureVector(features);
  return featureVectorFromOrderedValues(standardizeValues(features, standardization));
}

export function fitR13Standardization(examples: readonly R13FitExample[]): R13Standardization {
  if (examples.length === 0) throw new Error("R13 standardization requires research examples.");
  examples.forEach(assertExample);
  const means = Object.fromEntries(R13_FEATURE_NAMES.map((name) => [name, examples.reduce((sum, example) => sum + example.features[name], 0) / examples.length])) as Record<R13FeatureName, number>;
  const standardDeviations = Object.fromEntries(R13_FEATURE_NAMES.map((name) => {
    const variance = examples.reduce((sum, example) => sum + (example.features[name] - means[name]) ** 2, 0) / examples.length;
    return [name, Math.sqrt(variance) || 1];
  })) as Record<R13FeatureName, number>;
  const identity = { featureNames: R13_FEATURE_NAMES, means, standardDeviations, fitScope: "RESEARCH_ONLY" as const };
  return Object.freeze({ featureNames: R13_FEATURE_NAMES, means: Object.freeze(means), standardDeviations: Object.freeze(standardDeviations), identitySha256: sha256(identity) });
}

export function fitR13RidgeModel(examples: readonly R13FitExample[]): R13RidgeModel {
  if (examples.length < R13_FEATURE_NAMES.length + 1) throw new Error("R13 ridge requires more examples than fixed feature dimensions.");
  examples.forEach(assertExample);
  const standardization = fitR13Standardization(examples);
  const dimension = R13_FEATURE_NAMES.length + 1;
  const matrix = Array.from({ length: dimension }, () => Array<number>(dimension).fill(0));
  const vector = Array<number>(dimension).fill(0);
  for (const example of examples) {
    const values = [1, ...standardizeValues(example.features, standardization)];
    for (let row = 0; row < dimension; row += 1) {
      vector[row] += values[row]! * example.targetNetForwardAtr;
      for (let column = 0; column < dimension; column += 1) matrix[row]![column] += values[row]! * values[column]!;
    }
  }
  for (let index = 1; index < dimension; index += 1) matrix[index]![index] += R13_RIDGE_LAMBDA;
  const solution = gaussianSolve(matrix, vector);
  const coefficients = Object.fromEntries(R13_FEATURE_NAMES.map((name, index) => [name, solution[index + 1]!])) as Record<R13FeatureName, number>;
  let targetMin = Number.POSITIVE_INFINITY;
  let targetMax = Number.NEGATIVE_INFINITY;
  for (const example of examples) {
    targetMin = Math.min(targetMin, example.targetNetForwardAtr);
    targetMax = Math.max(targetMax, example.targetNetForwardAtr);
  }
  const targetRange = { min: targetMin, max: targetMax };
  const modelIdentity = { modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION", lambda: R13_RIDGE_LAMBDA, interceptPenalized: false, featureNames: R13_FEATURE_NAMES, intercept: solution[0], coefficients, standardization, trainingExamples: examples.length, targetRange };
  return Object.freeze({
    modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION",
    lambda: R13_RIDGE_LAMBDA,
    interceptPenalized: false,
    featureNames: R13_FEATURE_NAMES,
    intercept: solution[0]!,
    coefficients: Object.freeze(coefficients),
    standardization,
    trainingExamples: examples.length,
    trainingTargetRange: Object.freeze(targetRange),
    modelIdentitySha256: sha256(modelIdentity),
  });
}

export function predictR13RidgeModel(model: R13RidgeModel, features: R13FeatureVector): number {
  assertFeatureVector(features);
  const standardized = standardizeValues(features, model.standardization);
  const prediction = model.intercept + R13_FEATURE_NAMES.reduce((sum, name, index) => sum + model.coefficients[name] * standardized[index]!, 0);
  assertFinite(prediction, "R13 prediction");
  return prediction;
}

export function predictionDecile(prediction: number, orderedPredictions: readonly number[]): number {
  assertFinite(prediction, "R13 prediction decile value");
  if (orderedPredictions.length === 0 || orderedPredictions.some((value) => !Number.isFinite(value))) throw new Error("R13 prediction deciles require finite predictions.");
  const rank = [...orderedPredictions].sort((left, right) => left - right).findIndex((value) => value >= prediction);
  return Math.min(9, Math.max(0, Math.floor((Math.max(0, rank) / orderedPredictions.length) * 10)));
}
