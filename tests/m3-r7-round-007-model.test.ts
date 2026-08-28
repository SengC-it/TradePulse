import { describe, expect, it } from "vitest";

import {
  R7_FEATURE_NAMES,
  R7_MODEL_CONTRACT,
} from "../src/lib/research/m3-r7-round-007-protocol.ts";
import {
  R7_RIDGE_LAMBDA,
  featureVectorFromOrderedValues,
  fitR7RidgeModel,
  predictR7RidgeModel,
  predictionBucket,
  standardizeR7Features,
} from "../src/lib/research/m3-r7-round-007-model.ts";

function vector(sample: number) {
  return featureVectorFromOrderedValues(R7_FEATURE_NAMES.map((_, index) => Math.sin((sample + 1) * (index + 1)) + sample / 100));
}

function examples() {
  return Array.from({ length: 24 }, (_, index) => ({
    features: vector(index),
    netR: Math.cos(index / 3) / 10,
  }));
}

describe("M3-R7 Score V2 model", () => {
  it("fits a deterministic fixed-lambda ridge model on caller-provided research examples", () => {
    const first = fitR7RidgeModel(examples());
    const second = fitR7RidgeModel(examples());
    expect(first).toEqual(second);
    expect(first.lambda).toBe(R7_RIDGE_LAMBDA);
    expect(first.lambda).toBe(R7_MODEL_CONTRACT.lambda);
    expect(first.interceptPenalized).toBe(false);
    expect(first.featureNames).toEqual(R7_FEATURE_NAMES);
    expect(first.trainingExamples).toBe(24);
    expect(Object.keys(first.coefficients)).toEqual([...R7_FEATURE_NAMES]);
    expect(predictR7RidgeModel(first, vector(30))).toBeCloseTo(predictR7RidgeModel(second, vector(30)), 12);
  });

  it("standardizes with research statistics and produces finite validation predictions", () => {
    const model = fitR7RidgeModel(examples());
    const standardized = standardizeR7Features(vector(5), model.standardization);
    expect(Object.values(standardized).every((value) => Number.isFinite(value))).toBe(true);
    expect(Number.isFinite(predictR7RidgeModel(model, vector(31)))).toBe(true);
    expect(model.standardization.identitySha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(model.modelIdentitySha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(R7_FEATURE_NAMES).not.toContain("symbol");
  });

  it("rejects insufficient or non-finite training data and keeps threshold buckets deterministic", () => {
    expect(() => fitR7RidgeModel(examples().slice(0, 10))).toThrow("more examples than features");
    expect(() => fitR7RidgeModel([{ ...examples()[0]!, netR: Number.NaN }, ...examples().slice(1)])).toThrow("finite netR");
    expect(predictionBucket(0.05).id).toBe("0_05_TO_0_10");
    expect(predictionBucket(0.1).id).toBe("GTE_0_10");
    expect(() => predictionBucket(Number.NaN)).toThrow("finite prediction");
  });
});
