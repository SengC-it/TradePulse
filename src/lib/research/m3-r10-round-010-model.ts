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

/** R10 keeps the already frozen deterministic ridge arithmetic; only the protocol identity is R10. */
export type R10FeatureVector = R7FeatureVector;
export type R10FitExample = R7FitExample;
export type R10RidgeModel = R7RidgeModel;
export type R10Standardization = R7Standardization;

export const R10_RIDGE_LAMBDA = 10 as const;

export function fitR10RidgeModel(examples: readonly R10FitExample[]): R10RidgeModel {
  return fitR7RidgeModel(examples);
}

export function predictR10RidgeModel(model: R10RidgeModel, features: R10FeatureVector): number {
  return predictR7RidgeModel(model, features);
}

export function featureVectorFromOrderedValues(values: readonly number[]): R10FeatureVector {
  return featureVectorFromOrderedR7Values(values);
}

export function standardizeR10Features(features: R10FeatureVector, standardization: R10Standardization): R10FeatureVector {
  return standardizeR7Features(features, standardization);
}

export const predictionBucket = predictionBucketR7;
