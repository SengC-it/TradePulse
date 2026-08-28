import {
  featureVectorFromOrderedValues as featureVectorFromOrderedR7Values,
  fitR7RidgeModel,
  predictR7RidgeModel,
  predictionBucket as predictionBucketR7,
  standardizeR7Features,
  type R7FeatureVector,
  type R7FitExample,
  type R7RidgeModel,
  type R7Standardization,
} from "./m3-r7-round-007-model.ts";

/** R9 keeps the already frozen deterministic ridge arithmetic; only the protocol identity is R9. */
export type R9FeatureVector = R7FeatureVector;
export type R9FitExample = R7FitExample;
export type R9RidgeModel = R7RidgeModel;
export type R9Standardization = R7Standardization;

export const R9_RIDGE_LAMBDA = 10 as const;

export function fitR9RidgeModel(examples: readonly R9FitExample[]): R9RidgeModel {
  return fitR7RidgeModel(examples);
}

export function predictR9RidgeModel(model: R9RidgeModel, features: R9FeatureVector): number {
  return predictR7RidgeModel(model, features);
}

export function featureVectorFromOrderedValues(values: readonly number[]): R9FeatureVector {
  return featureVectorFromOrderedR7Values(values);
}

export function standardizeR9Features(features: R9FeatureVector, standardization: R9Standardization): R9FeatureVector {
  return standardizeR7Features(features, standardization);
}

export const predictionBucket = predictionBucketR7;
