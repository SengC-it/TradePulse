import { describe, expect, it } from "vitest";

import { M3_R9_CANDIDATE_IDS, R9_COMPLEXITY_TUPLES } from "../src/lib/research/m3-r9-round-009-protocol.ts";
import { R9_HARD_GATE_IDENTITIES, evaluateR9CandidateGates, isWithinInclusiveR9ExpectancyTieBand, selectR9Candidate, type R9CandidateGateInput, type R9SelectionCandidate } from "../src/lib/research/selection-gates-round-009.ts";

function passingInput(overrides: Partial<R9CandidateGateInput> = {}): R9CandidateGateInput {
  return {
    candidateId: M3_R9_CANDIDATE_IDS[0],
    resultStatus: "COMPLETE",
    aggregateImprovement: 0.1,
    improvedValidationFolds: 4,
    catastrophicFolds: 0,
    positiveNetValidationFolds: 4,
    netExpectancyR: 0.03,
    profitFactor: 1.2,
    profitFactorStatus: "NORMAL",
    topSymbolShareOfPositiveNetR: 0.21,
    largestSingleTradeShareOfPositiveNetR: 0.1,
    feeBurdenRatio: 0.1,
    formalSignals: 300,
    minimumFoldExecutedTrades: 30,
    ...overrides,
  };
}

function candidate(candidateId: R9SelectionCandidate["candidateId"], expectancy: number): R9SelectionCandidate {
  return { candidateId, eligible: true, improvedValidationFolds: 4, aggregateValidationExpectancyR: expectancy, complexityTuple: R9_COMPLEXITY_TUPLES[candidateId], aggregateValidationProfitFactor: 1.3 };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [Array.from(items)];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [item, ...tail]));
}

describe("M3-R9 gate and selection conformance", () => {
  it("keeps the inclusive expectancy boundary scale-aware", () => {
    expect(isWithinInclusiveR9ExpectancyTieBand(0.060, 0.050, 0.01)).toBe(true);
    expect(isWithinInclusiveR9ExpectancyTieBand(0.070, 0.060, 0.01)).toBe(true);
    expect(isWithinInclusiveR9ExpectancyTieBand(0.130, 0.120, 0.01)).toBe(true);
    expect(isWithinInclusiveR9ExpectancyTieBand(0.070000000001, 0.060, 0.01)).toBe(false);
    expect(isWithinInclusiveR9ExpectancyTieBand(0.011, 0, 0.01)).toBe(false);
  });

  it("evaluates every applicable gate and fails closed for incomplete evidence", () => {
    const evaluation = evaluateR9CandidateGates(passingInput());
    expect(evaluation.eligibility).toBe("ELIGIBLE");
    expect(evaluation.gateResults).toHaveLength(R9_HARD_GATE_IDENTITIES.length);
    expect(evaluateR9CandidateGates(passingInput({ resultStatus: "DATA_INCOMPLETE" })).eligibility).toBe("INCOMPLETE");
    expect(evaluateR9CandidateGates(passingInput({ modelRequired: true, modelIntegrity: false })).failedGateIds).toContain("modelIntegrity");
  });

  it("keeps the mechanical selection invariant across 24 permutations", () => {
    const candidates = M3_R9_CANDIDATE_IDS.slice(0, 4).map((candidateId, index) => candidate(candidateId, index === 0 ? 0.06 : 0.052));
    const expected = selectR9Candidate(candidates);
    for (const permutation of permutations(candidates)) expect(selectR9Candidate(permutation)).toEqual(expected);
    expect(expected.selectionAlgorithmApplied).toBe(true);
    expect(expected.selectedCandidateId).toBe("R9-R1-REGIME-EXPECTANCY-ROUTER");
    expect(expected.eligibleCandidateIds).toEqual([...M3_R9_CANDIDATE_IDS.slice(0, 4)].sort());
  });

  it("does not apply selection when every candidate is ineligible", () => {
    const result = selectR9Candidate([{ ...candidate(M3_R9_CANDIDATE_IDS[0], 0.05), eligible: false }]);
    expect(result.selectionAlgorithmApplied).toBe(false);
    expect(result.selectedCandidateId).toBeNull();
    expect(result.finalDecision).toBe("NO BASELINE-002 CANDIDATE — ROUND-009");
  });
});
