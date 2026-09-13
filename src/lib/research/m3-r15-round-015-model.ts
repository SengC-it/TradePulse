import { createHash } from "node:crypto";

import { R15_RIDGE_LAMBDA } from "./m3-r15-round-015-protocol.ts";
import { stableStringify } from "./utils.ts";

export type R15FeatureVector = Readonly<Record<string, number>>;

export type R15FitExample = Readonly<{
  features: R15FeatureVector;
  target: number;
}>;

export type R15Standardization = Readonly<{
  featureNames: readonly string[];
  means: Readonly<Record<string, number>>;
  standardDeviations: Readonly<Record<string, number>>;
  identitySha256: string;
}>;

export type R15RidgeModel = Readonly<{
  modelId: string;
  modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION";
  lambda: typeof R15_RIDGE_LAMBDA;
  interceptPenalized: false;
  featureNames: readonly string[];
  intercept: number;
  coefficients: Readonly<Record<string, number>>;
  standardization: R15Standardization;
  trainingExamples: number;
  trainingTargetRange: Readonly<{ min: number; max: number }>;
  modelIdentitySha256: string;
}>;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function assertFeatures(featureNames: readonly string[], features: R15FeatureVector): void {
  if (Object.keys(features).sort().join("|") !== [...featureNames].sort().join("|")) throw new Error("R15 feature identity mismatch.");
  for (const name of featureNames) assertFinite(features[name]!, `R15 feature ${name}`);
}

function assertExample(featureNames: readonly string[], example: R15FitExample): void {
  assertFeatures(featureNames, example.features);
  assertFinite(example.target, "R15 target");
}

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function gaussianSolve(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) throw new Error("R15 ridge normal matrix is singular.");
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

function standardizeValues(featureNames: readonly string[], features: R15FeatureVector, standardization: R15Standardization): number[] {
  assertFeatures(featureNames, features);
  return featureNames.map((name) => (features[name]! - standardization.means[name]!) / standardization.standardDeviations[name]!);
}

export function fitR15Standardization(featureNames: readonly string[], examples: readonly R15FitExample[]): R15Standardization {
  if (featureNames.length === 0 || examples.length === 0) throw new Error("R15 standardization requires fixed features and research examples.");
  examples.forEach((example) => assertExample(featureNames, example));
  const means = Object.fromEntries(featureNames.map((name) => [name, examples.reduce((sum, example) => sum + example.features[name]!, 0) / examples.length])) as Record<string, number>;
  const standardDeviations = Object.fromEntries(featureNames.map((name) => {
    const variance = examples.reduce((sum, example) => sum + (example.features[name]! - means[name]!) ** 2, 0) / examples.length;
    return [name, Math.sqrt(variance) || 1];
  })) as Record<string, number>;
  const identity = { featureNames, means, standardDeviations, fitScope: "RESEARCH_ONLY" as const };
  return Object.freeze({ featureNames: Object.freeze([...featureNames]), means: Object.freeze(means), standardDeviations: Object.freeze(standardDeviations), identitySha256: hash(identity) });
}

export function fitR15RidgeModel(modelId: string, featureNames: readonly string[], examples: readonly R15FitExample[]): R15RidgeModel {
  if (examples.length < featureNames.length + 1) throw new Error(`R15 ${modelId} ridge requires more examples than fixed feature dimensions.`);
  examples.forEach((example) => assertExample(featureNames, example));
  const standardization = fitR15Standardization(featureNames, examples);
  const dimension = featureNames.length + 1;
  const matrix = Array.from({ length: dimension }, () => Array<number>(dimension).fill(0));
  const vector = Array<number>(dimension).fill(0);
  for (const example of examples) {
    const values = [1, ...standardizeValues(featureNames, example.features, standardization)];
    for (let row = 0; row < dimension; row += 1) {
      vector[row] += values[row]! * example.target;
      for (let column = 0; column < dimension; column += 1) matrix[row]![column] += values[row]! * values[column]!;
    }
  }
  for (let index = 1; index < dimension; index += 1) matrix[index]![index] += R15_RIDGE_LAMBDA;
  const solution = gaussianSolve(matrix, vector);
  const coefficients = Object.fromEntries(featureNames.map((name, index) => [name, solution[index + 1]!])) as Record<string, number>;
  let targetMin = Number.POSITIVE_INFINITY;
  let targetMax = Number.NEGATIVE_INFINITY;
  for (const example of examples) {
    targetMin = Math.min(targetMin, example.target);
    targetMax = Math.max(targetMax, example.target);
  }
  const targetRange = { min: targetMin, max: targetMax };
  const identity = { modelId, modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION", lambda: R15_RIDGE_LAMBDA, interceptPenalized: false, featureNames, intercept: solution[0], coefficients, standardization, trainingExamples: examples.length, targetRange };
  return Object.freeze({ modelId, modelType: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION", lambda: R15_RIDGE_LAMBDA, interceptPenalized: false, featureNames: Object.freeze([...featureNames]), intercept: solution[0]!, coefficients: Object.freeze(coefficients), standardization, trainingExamples: examples.length, trainingTargetRange: Object.freeze(targetRange), modelIdentitySha256: hash(identity) });
}

export function predictR15RidgeModel(model: R15RidgeModel, features: R15FeatureVector): number {
  const standardized = standardizeValues(model.featureNames, features, model.standardization);
  const prediction = model.intercept + model.featureNames.reduce((sum, name, index) => sum + model.coefficients[name]! * standardized[index]!, 0);
  assertFinite(prediction, `R15 ${model.modelId} prediction`);
  return prediction;
}
