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

/** R11 keeps the already frozen deterministic ridge arithmetic; only the protocol identity is R11. */
export type R11FeatureVector = R7FeatureVector;
export type R11FitExample = R7FitExample;
export type R11RidgeModel = R7RidgeModel;
export type R11Standardization = R7Standardization;

export const R11_RIDGE_LAMBDA = 10 as const;

export function fitR11RidgeModel(examples: readonly R11FitExample[]): R11RidgeModel {
  return fitR7RidgeModel(examples);
}

export function predictR11RidgeModel(model: R11RidgeModel, features: R11FeatureVector): number {
  return predictR7RidgeModel(model, features);
}

export function featureVectorFromOrderedValues(values: readonly number[]): R11FeatureVector {
  return featureVectorFromOrderedR7Values(values);
}

export function standardizeR11Features(features: R11FeatureVector, standardization: R11Standardization): R11FeatureVector {
  return standardizeR7Features(features, standardization);
}

export const predictionBucket = predictionBucketR7;
