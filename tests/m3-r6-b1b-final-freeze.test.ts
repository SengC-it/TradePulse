import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R6_ROUND_006_CANDIDATE_IDS,
  M3_R6_ROUND_006_CONTROL_ID,
  M3_R6_ROUND_006_DEFINITIONS,
  M3_R6_ROUND_006_MACHINE_RECORD,
  M3_R6_ROUND_006_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_VARIANT_REGISTRY,
  evaluateM3R6CandidateGates,
  isWithinInclusiveExpectancyTieBand,
  selectM3R6Candidate,
  validateM3R6Round006MachineRecord,
  type M3R6CandidateGateInput,
  type M3R6SelectionCandidate,
} from "../src/lib/research/selection-gates-round-006.ts";
import {
  M3_R6_ROUND_006_PLAN,
  M3_R6_ROUND_006_PLAN_CANONICAL_JSON,
  M3_R6_ROUND_006_PLAN_SCHEMA_VERSION,
  M3_R6_ROUND_006_PLAN_SHA256,
  M3_R6_ROUND_006_METRIC_STATUS_CONTRACT,
  validateM3R6Round006Plan,
} from "../src/lib/research/m3-r6-round-006-plan.ts";
import { R6_COMPLEXITY_TUPLES } from "../src/lib/research/m3-r6-round-006-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

function passingGateInput(
  candidateId: M3R6CandidateGateInput["candidateId"] = M3_R6_ROUND_006_CANDIDATE_IDS[0],
  overrides: Partial<M3R6CandidateGateInput> = {},
): M3R6CandidateGateInput {
  return {
    candidateId,
    resultStatus: "COMPLETE",
    aggregateImprovement: 0.1,
    improvedValidationFolds: 4,
    catastrophicFolds: 0,
    netExpectancyR: 0.03,
    profitFactor: 1.2,
    profitFactorStatus: "NORMAL",
    topSymbolShareOfPositiveNetR: 0.5,
    largestSingleTradeShareOfPositiveNetR: 0.1,
    feeBurdenRatio: 0.1,
    formalSignals: 300,
    minimumFoldExecutedTrades: 30,
    redundancyImprovement: 0.3,
    ...overrides,
  };
}

function selectionCandidate(
  candidateId: M3R6SelectionCandidate["candidateId"],
  overrides: Partial<M3R6SelectionCandidate> = {},
): M3R6SelectionCandidate {
  return {
    candidateId,
    eligible: true,
    improvedValidationFolds: 4,
    aggregateValidationExpectancyR: 0.05,
    complexityTuple: R6_COMPLEXITY_TUPLES[candidateId],
    aggregateValidationProfitFactor: 1.3,
    ...overrides,
  };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [Array.from(items)];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) result.push([item, ...tail]);
  });
  return result;
}

describe("M3-R6-B.1B final Gate and Plan freeze", () => {
  it("freezes the 12 candidates, one variant each, and the CONTROL identity", () => {
    expect(M3_R6_ROUND_006_VARIANT_REGISTRY).toHaveLength(12);
    expect(M3_R6_ROUND_006_VARIANT_REGISTRY.map((candidate) => candidate.candidateId)).toEqual([...M3_R6_ROUND_006_CANDIDATE_IDS]);
    expect(new Set(M3_R6_ROUND_006_VARIANT_REGISTRY.map((candidate) => candidate.variantId)).size).toBe(12);
    expect(M3_R6_ROUND_006_CONTROL_ID).toBe("R6-CONTROL-BASELINE-001");
    expect(M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES.length).toBeGreaterThan(0);
  });

  it("passes every inherited gate for a fully passing candidate and requires redundancy only where applicable", () => {
    const evaluation = evaluateM3R6CandidateGates(passingGateInput());
    expect(evaluation.eligibility).toBe("ELIGIBLE");
    expect(evaluation.failedGateIds).toEqual([]);
    expect(evaluation.passedApplicableGateCount).toBe(evaluation.applicableGateCount);

    const nonRedundancy = evaluateM3R6CandidateGates(passingGateInput("R6-C1-TREND-FRESHNESS", {
      redundancyImprovement: null,
    }));
    expect(nonRedundancy.eligibility).toBe("ELIGIBLE");
    expect(nonRedundancy.gateResults.find((gate) => gate.gateId === "requiredRedundancyImprovement")?.status).toBe("NOT_APPLICABLE");
  });

  it("fails closed for incomplete data and for an unmet redundancy gate", () => {
    expect(evaluateM3R6CandidateGates(passingGateInput(M3_R6_ROUND_006_CANDIDATE_IDS[0], {
      resultStatus: "DATA_INCOMPLETE",
    })).eligibility).toBe("INCOMPLETE");
    const failed = evaluateM3R6CandidateGates(passingGateInput(M3_R6_ROUND_006_CANDIDATE_IDS[0], {
      redundancyImprovement: 0.29,
    }));
    expect(failed.eligibility).toBe("INELIGIBLE");
    expect(failed.failedGateIds).toContain("requiredRedundancyImprovement");
  });

  it("freezes the inclusive scale-aware IEEE-754 expectancy tie-band rule", () => {
    expect(isWithinInclusiveExpectancyTieBand(0.060, 0.050, 0.01)).toBe(true);
    expect(isWithinInclusiveExpectancyTieBand(0.070, 0.060, 0.01)).toBe(true);
    expect(isWithinInclusiveExpectancyTieBand(0.130, 0.120, 0.01)).toBe(true);
    expect(isWithinInclusiveExpectancyTieBand(0.070000000001, 0.060, 0.01)).toBe(false);
    expect(isWithinInclusiveExpectancyTieBand(0.061, 0.050, 0.01)).toBe(false);
    expect(M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandBoundary).toBe("INCLUSIVE");
    expect(M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandFloatingComparison).toBe("SCALE_AWARE_NUMBER_EPSILON");
    expect(M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandFloatingToleranceFormula).toContain("Number.EPSILON");
  });

  it("keeps selection invariant across all 24 input permutations", () => {
    const four = M3_R6_ROUND_006_CANDIDATE_IDS.slice(0, 4).map((candidateId, index) => selectionCandidate(candidateId, {
      aggregateValidationExpectancyR: index === 0 ? 0.06 : 0.052,
    }));
    const expected = selectM3R6Candidate(four);
    for (const permutation of permutations(four)) expect(selectM3R6Candidate(permutation)).toEqual(expected);
    expect(expected.selectionAlgorithmApplied).toBe(true);
    expect(expected.selectedCandidateId).toBe("R6-A1-COOLDOWN-12H");
    expect(expected.eligibleCandidateIds).toEqual([...M3_R6_ROUND_006_CANDIDATE_IDS.slice(0, 4)].sort());
  });

  it("validates the canonical Gate and Plan hashes and preserves the pre-execution boundary", () => {
    expect(() => validateM3R6Round006MachineRecord()).not.toThrow();
    expect(() => validateM3R6Round006Plan()).not.toThrow();
    expect(createHash("sha256").update(stableStringify(M3_R6_ROUND_006_MACHINE_RECORD), "utf8").digest("hex")).toBe(M3_R6_ROUND_006_SELECTION_GATE_SHA256);
    expect(createHash("sha256").update(M3_R6_ROUND_006_PLAN_CANONICAL_JSON, "utf8").digest("hex")).toBe(M3_R6_ROUND_006_PLAN_SHA256);
    expect(M3_R6_ROUND_006_PLAN.schemaVersion).toBe(M3_R6_ROUND_006_PLAN_SCHEMA_VERSION);
    expect(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT.numericNormalization.finiteNumbersOnly).toBe(true);
    expect(M3_R6_ROUND_006_PLAN.performance.status).toBe("NOT_GENERATED");
    expect(M3_R6_ROUND_006_PLAN.performance.authorization).toBe("NOT_AUTHORIZED");
    expect(M3_R6_ROUND_006_PLAN.status.baseline002Status).toBe("NOT_FROZEN");
    expect(M3_R6_ROUND_006_PLAN.status.m3JStatus).toBe("BLOCKED");
    expect(M3_R6_ROUND_006_PLAN.status.m4Status).toBe("NOT_STARTED");
  });
});
