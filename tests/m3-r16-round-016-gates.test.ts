import { describe, expect, it } from "vitest";

import { evaluateR16Gates, type R16GateInput } from "../src/lib/research/selection-gates-round-016.ts";

const PASSING_INPUT: R16GateInput = {
  pooledCoverage: 0.95,
  validationFoldCoverages: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
  trainingFoldCoverages: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
  microBetaPooledPearson: 0.1,
  deltaBetaPooledPearson: 0.03,
  microBetaPositivePearsonFolds: 5,
  betaImprovementFolds: 4,
  microBetaFoldPearsons: [0.01, 0.02, 0.03, 0.04, 0.05, 0.06],
  microAlphaMeanTimestampSpearman: 0.06,
  deltaAlphaMeanTimestampSpearman: 0.02,
  microAlphaPositiveSpearmanFolds: 5,
  alphaImprovementFolds: 4,
  microAlphaFoldSpearmans: [0.01, 0.02, 0.03, 0.04, 0.05, 0.06],
  microAlphaTopBottomSpread: 0.2,
  deltaAlphaTopBottomSpread: 0.05,
  microAlphaPositiveSpreadFolds: 5,
  evidenceComplete: true,
  provenanceComplete: true,
};

describe("Round-016 D1-D16 gates", () => {
  it("requires every conjunctive information, coverage, evidence, and provenance gate", () => {
    const result = evaluateR16Gates(PASSING_INPUT);
    expect(result.eligibility).toBe("ELIGIBLE");
    expect(result.failedGateIds).toEqual([]);
    expect(result.gateResults.map((value) => value.gateId)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13", "D14", "D15", "D16"]);
    expect(result.gateResults).toHaveLength(16);
  });

  it("fails closed for null metrics, insufficient coverage, negative folds, incomplete evidence, and incomplete provenance", () => {
    expect(evaluateR16Gates({ ...PASSING_INPUT, pooledCoverage: 0.89 }).failedGateIds).toContain("D1");
    expect(evaluateR16Gates({ ...PASSING_INPUT, microBetaPooledPearson: null }).failedGateIds).toContain("D2");
    expect(evaluateR16Gates({ ...PASSING_INPUT, microBetaFoldPearsons: [0.01, -0.02, 0.03, 0.04, 0.05, 0.06] }).failedGateIds).toContain("D6");
    expect(evaluateR16Gates({ ...PASSING_INPUT, microAlphaMeanTimestampSpearman: null }).failedGateIds).toContain("D7");
    expect(evaluateR16Gates({ ...PASSING_INPUT, microAlphaFoldSpearmans: [0.01, -0.02, 0.03, 0.04, 0.05, 0.06] }).failedGateIds).toContain("D14");
    expect(evaluateR16Gates({ ...PASSING_INPUT, evidenceComplete: false }).failedGateIds).toContain("D15");
    expect(evaluateR16Gates({ ...PASSING_INPUT, provenanceComplete: false }).failedGateIds).toContain("D16");
  });

  it("does not substitute a best-available or partial result for the all-gates decision", () => {
    const result = evaluateR16Gates({ ...PASSING_INPUT, deltaBetaPooledPearson: null, deltaAlphaMeanTimestampSpearman: null, deltaAlphaTopBottomSpread: null });
    expect(result.eligibility).toBe("INELIGIBLE");
    expect(result.failedGateIds).toEqual(["D3", "D8", "D12"]);
    expect(result.gateResults.find((value) => value.gateId === "D3")?.requirement).toContain("pooled Beta Pearson");
  });
});
