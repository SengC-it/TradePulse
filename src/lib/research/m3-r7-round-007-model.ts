import { createHash } from "node:crypto";

import { R7_FEATURE_NAMES, type R7FeatureName } from "./m3-r7-round-007-protocol.ts";
import { stableStringify } from "./utils.ts";

export type R7FeatureVector = Readonly<Record<R7FeatureName, number>>;

export type R7FitExample = Readonly<{
  features: R7FeatureVector;
  netR: number;
}>;

export type R7Standardization = Readonly<{
  featureNames: typeof R7_FEATURE_NAMES;
  means: Readonly<Record<R7FeatureName, number>>;
  standardDeviations: Readonly<Record<R7FeatureName, number>>;
  identitySha256: string;
}>;

export type R7RidgeModel = Readonly<{
  modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE";
  lambda: 10;
  interceptPenalized: false;
  featureNames: typeof R7_FEATURE_NAMES;
  intercept: number;
  coefficients: Readonly<Record<R7FeatureName, number>>;
  standardization: R7Standardization;
  trainingExamples: number;
  trainingNetRRange: Readonly<{ min: number; max: number }>;
  modelIdentitySha256: string;
}>;

export const R7_RIDGE_LAMBDA = 10 as const;
export const R7_PREDICTION_BUCKETS = Object.freeze([
  { id: "LT_NEGATIVE_0_10", minInclusive: Number.NEGATIVE_INFINITY, maxExclusive: -0.1 },
  { id: "NEGATIVE_0_10_TO_0", minInclusive: -0.1, maxExclusive: 0 },
  { id: "ZERO_TO_0_05", minInclusive: 0, maxExclusive: 0.05 },
  { id: "0_05_TO_0_10", minInclusive: 0.05, maxExclusive: 0.1 },
  { id: "GTE_0_10", minInclusive: 0.1, maxExclusive: null },
] as const);

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function assertFeatureVector(features: R7FeatureVector): void {
  for (const name of R7_FEATURE_NAMES) {
    if (!finite(features[name])) throw new Error(`R7 feature is not finite: ${name}.`);
  }
}

function assertExample(example: R7FitExample): void {
  assertFeatureVector(example.features);
  if (!finite(example.netR)) throw new Error("R7 ridge labels must be finite netR values.");
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
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) {
      throw new Error("R7 ridge normal matrix is singular.");
    }
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
  const solution = augmented.map((row) => row[size]!);
  if (!solution.every(finite)) throw new Error("R7 ridge solution is not finite.");
  return solution;
}

function makeStandardization(examples: readonly R7FitExample[]): R7Standardization {
  const means = {} as Record<R7FeatureName, number>;
  const standardDeviations = {} as Record<R7FeatureName, number>;
  for (const name of R7_FEATURE_NAMES) {
    const mean = examples.reduce((sum, example) => sum + example.features[name], 0) / examples.length;
    const variance = examples.reduce((sum, example) => sum + (example.features[name] - mean) ** 2, 0) / examples.length;
    const deviation = Math.sqrt(variance);
    means[name] = mean;
    standardDeviations[name] = deviation > Number.EPSILON ? deviation : 1;
  }
  const identity = { featureNames: R7_FEATURE_NAMES, means, standardDeviations };
  return Object.freeze({
    featureNames: R7_FEATURE_NAMES,
    means: Object.freeze(means),
    standardDeviations: Object.freeze(standardDeviations),
    identitySha256: sha256(identity),
  });
}

function standardized(features: R7FeatureVector, standardization: R7Standardization): number[] {
  return R7_FEATURE_NAMES.map((name) => (features[name] - standardization.means[name]) / standardization.standardDeviations[name]);
}

/** Fits exactly one fixed-lambda model on the caller-provided research fold. */
export function fitR7RidgeModel(examples: readonly R7FitExample[]): R7RidgeModel {
  if (examples.length < R7_FEATURE_NAMES.length + 1) throw new Error("R7 ridge fit requires more examples than features.");
  examples.forEach(assertExample);
  const standardization = makeStandardization(examples);
  const design = examples.map((example) => [1, ...standardized(example.features, standardization)]);
  const size = R7_FEATURE_NAMES.length + 1;
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  const target = Array.from({ length: size }, () => 0);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      matrix[row]![column] = design.reduce((sum, values) => sum + values[row]! * values[column]!, 0);
    }
    target[row] = design.reduce((sum, values, index) => sum + values[row]! * examples[index]!.netR, 0);
  }
  for (let diagonal = 1; diagonal < size; diagonal += 1) matrix[diagonal]![diagonal] += R7_RIDGE_LAMBDA;
  const solution = gaussianSolve(matrix, target);
  const coefficients = Object.fromEntries(R7_FEATURE_NAMES.map((name, index) => [name, solution[index + 1]!])) as Record<R7FeatureName, number>;
  const netValues = examples.map((example) => example.netR);
  const modelIdentity = {
    modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE",
    lambda: R7_RIDGE_LAMBDA,
    interceptPenalized: false,
    featureNames: R7_FEATURE_NAMES,
    intercept: solution[0],
    coefficients,
    standardization,
    trainingExamples: examples.length,
  };
  return Object.freeze({
    modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE",
    lambda: R7_RIDGE_LAMBDA,
    interceptPenalized: false,
    featureNames: R7_FEATURE_NAMES,
    intercept: solution[0]!,
    coefficients: Object.freeze(coefficients),
    standardization,
    trainingExamples: examples.length,
    trainingNetRRange: Object.freeze({ min: Math.min(...netValues), max: Math.max(...netValues) }),
    modelIdentitySha256: sha256(modelIdentity),
  });
}

export function predictR7RidgeModel(model: R7RidgeModel, features: R7FeatureVector): number {
  assertFeatureVector(features);
  const values = standardized(features, model.standardization);
  const prediction = model.intercept + R7_FEATURE_NAMES.reduce((sum, name, index) => sum + model.coefficients[name] * values[index]!, 0);
  if (!finite(prediction)) throw new Error("R7 ridge prediction is not finite.");
  return prediction;
}

export function featureVectorFromOrderedValues(values: readonly number[]): R7FeatureVector {
  if (values.length !== R7_FEATURE_NAMES.length || !values.every(finite)) throw new Error("R7 feature vector has an invalid shape.");
  return Object.freeze(Object.fromEntries(R7_FEATURE_NAMES.map((name, index) => [name, values[index]!])) as Record<R7FeatureName, number>);
}

export function predictionBucket(prediction: number): (typeof R7_PREDICTION_BUCKETS)[number] {
  if (!finite(prediction)) throw new Error("R7 prediction bucket requires a finite prediction.");
  return R7_PREDICTION_BUCKETS.find((bucket) => prediction >= bucket.minInclusive && (bucket.maxExclusive === null || prediction < bucket.maxExclusive))!;
}

export function standardizeR7Features(features: R7FeatureVector, standardization: R7Standardization): R7FeatureVector {
  return featureVectorFromOrderedValues(standardized(features, standardization));
}
