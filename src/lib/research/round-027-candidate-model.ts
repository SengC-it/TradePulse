import { createHash } from "node:crypto";

import {
  R27_LOGISTIC_LAMBDA,
  R27_LOGISTIC_LINEAR_PREDICTOR_CLAMP,
  R27_LOGISTIC_MAX_ITERATIONS,
  R27_LOGISTIC_TOLERANCE,
  type R27FeatureName,
} from "./round-027-protocol.ts";
import { stableStringify } from "./utils.ts";

export type R27LogisticFitExample = Readonly<{
  features: readonly number[];
  target: 0 | 1;
}>;

export type R27LogisticModelArtifact = Readonly<{
  modelType: "R27_BINARY_LOGISTIC_L2" | "R27_PAIRWISE_BINARY_LOGISTIC_L2";
  featureNames: readonly R27FeatureName[];
  lambda: typeof R27_LOGISTIC_LAMBDA;
  intercept: number;
  interceptPolicy: "UNPENALIZED" | "FIXED_ZERO";
  coefficients: readonly number[];
  featureMeans: readonly number[];
  featureStandardDeviations: readonly number[];
  trainingExamples: number;
  positiveExamples: number;
  negativeExamples: number;
  trainingPositiveRate: number;
  iterations: number;
  converged: true;
  modelIdentitySha256: string;
}>;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function gaussianSolve(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(augmented[pivot]![column]!) <= Number.EPSILON) throw new Error("R27 logistic Hessian is singular.");
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

function sigmoid(linearPredictor: number): number {
  const clamped = Math.max(R27_LOGISTIC_LINEAR_PREDICTOR_CLAMP.min, Math.min(R27_LOGISTIC_LINEAR_PREDICTOR_CLAMP.max, linearPredictor));
  const result = 1 / (1 + Math.exp(-clamped));
  assertFinite(result, "R27 logistic probability");
  return result;
}

function featureStats(examples: readonly R27LogisticFitExample[], dimension: number): Readonly<{ means: number[]; standardDeviations: number[] }> {
  const means = Array<number>(dimension).fill(0);
  for (const example of examples) {
    if (example.features.length !== dimension) throw new Error("R27 logistic feature dimension mismatch.");
    for (let index = 0; index < dimension; index += 1) {
      assertFinite(example.features[index]!, `R27 logistic feature ${index}`);
      means[index] += example.features[index]!;
    }
  }
  for (let index = 0; index < dimension; index += 1) means[index] /= examples.length;
  const standardDeviations = Array<number>(dimension).fill(0);
  for (const example of examples) for (let index = 0; index < dimension; index += 1) standardDeviations[index] += (example.features[index]! - means[index]!) ** 2;
  for (let index = 0; index < dimension; index += 1) {
    standardDeviations[index] = Math.sqrt(standardDeviations[index]! / examples.length);
    if (standardDeviations[index] === 0) standardDeviations[index] = 1;
    assertFinite(standardDeviations[index]!, `R27 logistic standard deviation ${index}`);
  }
  return Object.freeze({ means, standardDeviations });
}

function standardizedFeatures(features: readonly number[], means: readonly number[], standardDeviations: readonly number[]): number[] {
  return features.map((value, index) => {
    assertFinite(value, `R27 logistic feature ${index}`);
    const standardized = (value - means[index]!) / standardDeviations[index]!;
    assertFinite(standardized, `R27 standardized feature ${index}`);
    return standardized;
  });
}

function fitLogistic(
  examples: readonly R27LogisticFitExample[],
  featureNames: readonly R27FeatureName[],
  interceptPolicy: "UNPENALIZED" | "FIXED_ZERO",
  modelType: R27LogisticModelArtifact["modelType"],
): R27LogisticModelArtifact {
  if (examples.length === 0) throw new Error("R27 logistic model requires training examples.");
  const positiveExamples = examples.filter((example) => example.target === 1).length;
  const negativeExamples = examples.length - positiveExamples;
  if (positiveExamples === 0 || negativeExamples === 0) throw new Error("R27 logistic model requires both target classes.");
  const dimension = featureNames.length;
  const stats = featureStats(examples, dimension);
  const standardized = examples.map((example) => standardizedFeatures(example.features, stats.means, stats.standardDeviations));
  const parameterCount = interceptPolicy === "UNPENALIZED" ? dimension + 1 : dimension;
  const coefficients = Array<number>(parameterCount).fill(0);
  if (interceptPolicy === "UNPENALIZED") {
    const rate = positiveExamples / examples.length;
    coefficients[0] = Math.log(rate / (1 - rate));
  }
  let iterations = 0;
  let converged = false;
  for (let iteration = 1; iteration <= R27_LOGISTIC_MAX_ITERATIONS; iteration += 1) {
    const gradient = Array<number>(parameterCount).fill(0);
    const hessian = Array.from({ length: parameterCount }, () => Array<number>(parameterCount).fill(0));
    for (let exampleIndex = 0; exampleIndex < examples.length; exampleIndex += 1) {
      const row = interceptPolicy === "UNPENALIZED" ? [1, ...standardized[exampleIndex]!] : standardized[exampleIndex]!;
      let linear = 0;
      for (let parameter = 0; parameter < parameterCount; parameter += 1) linear += coefficients[parameter]! * row[parameter]!;
      const probability = sigmoid(linear);
      const residual = probability - examples[exampleIndex]!.target;
      const curvature = Math.max(probability * (1 - probability), Number.EPSILON);
      for (let parameter = 0; parameter < parameterCount; parameter += 1) {
        gradient[parameter] += residual * row[parameter]!;
        for (let other = 0; other < parameterCount; other += 1) hessian[parameter]![other] += curvature * row[parameter]! * row[other]!;
      }
    }
    const firstPenalizedParameter = interceptPolicy === "UNPENALIZED" ? 1 : 0;
    for (let parameter = firstPenalizedParameter; parameter < parameterCount; parameter += 1) {
      gradient[parameter] += R27_LOGISTIC_LAMBDA * coefficients[parameter]!;
      hessian[parameter]![parameter] += R27_LOGISTIC_LAMBDA;
    }
    const step = gaussianSolve(hessian, gradient);
    let maxChange = 0;
    for (let parameter = 0; parameter < parameterCount; parameter += 1) {
      const next = coefficients[parameter]! - step[parameter]!;
      assertFinite(next, `R27 logistic coefficient ${parameter}`);
      maxChange = Math.max(maxChange, Math.abs(next - coefficients[parameter]!));
      coefficients[parameter] = next;
    }
    iterations = iteration;
    if (maxChange <= R27_LOGISTIC_TOLERANCE) {
      converged = true;
      break;
    }
  }
  if (!converged) throw new Error("R27 logistic model did not converge within the frozen iteration limit.");
  const intercept = interceptPolicy === "UNPENALIZED" ? coefficients.shift()! : 0;
  const finalCoefficients = [...coefficients];
  const identity = {
    modelType,
    featureNames,
    lambda: R27_LOGISTIC_LAMBDA,
    intercept,
    interceptPolicy,
    coefficients: finalCoefficients,
    featureMeans: stats.means,
    featureStandardDeviations: stats.standardDeviations,
    trainingExamples: examples.length,
    positiveExamples,
    negativeExamples,
    trainingPositiveRate: positiveExamples / examples.length,
    iterations,
    converged: true as const,
  };
  return Object.freeze({
    ...identity,
    featureNames: Object.freeze([...featureNames]),
    coefficients: Object.freeze(finalCoefficients),
    featureMeans: Object.freeze([...stats.means]),
    featureStandardDeviations: Object.freeze([...stats.standardDeviations]),
    modelIdentitySha256: createHash("sha256").update(stableStringify(identity), "utf8").digest("hex"),
  });
}

export function fitR27PositiveLogistic(
  examples: readonly R27LogisticFitExample[],
  featureNames: readonly R27FeatureName[],
): R27LogisticModelArtifact {
  return fitLogistic(examples, featureNames, "UNPENALIZED", "R27_BINARY_LOGISTIC_L2");
}

export function fitR27PairwiseLogistic(
  examples: readonly R27LogisticFitExample[],
  featureNames: readonly R27FeatureName[],
): R27LogisticModelArtifact {
  return fitLogistic(examples, featureNames, "FIXED_ZERO", "R27_PAIRWISE_BINARY_LOGISTIC_L2");
}

function predict(model: R27LogisticModelArtifact, features: readonly number[]): number {
  if (features.length !== model.featureNames.length) throw new Error("R27 prediction feature dimension mismatch.");
  const standardized = standardizedFeatures(features, model.featureMeans, model.featureStandardDeviations);
  const linear = model.intercept + standardized.reduce((sum, value, index) => sum + model.coefficients[index]! * value, 0);
  return sigmoid(linear);
}

export function predictR27PositiveProbability(model: R27LogisticModelArtifact, features: readonly number[]): number {
  if (model.modelType !== "R27_BINARY_LOGISTIC_L2" || model.interceptPolicy !== "UNPENALIZED") throw new Error("R27 positive model identity mismatch.");
  return predict(model, features);
}

export function predictR27PairwiseProbability(model: R27LogisticModelArtifact, featureDifference: readonly number[]): number {
  if (model.modelType !== "R27_PAIRWISE_BINARY_LOGISTIC_L2" || model.interceptPolicy !== "FIXED_ZERO") throw new Error("R27 pairwise model identity mismatch.");
  return predict(model, featureDifference);
}
