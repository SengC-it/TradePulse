import { describe, expect, it } from "vitest";

import { M3_R10_CANDIDATE_IDS, R10_COMPLEXITY_TUPLES } from "../src/lib/research/m3-r10-round-010-protocol.ts";
import { R10_HARD_GATE_IDENTITIES, evaluateR10CandidateGates, isWithinInclusiveR10ExpectancyTieBand, selectR10Candidate, type R10CandidateGateInput, type R10SelectionCandidate } from "../src/lib/research/selection-gates-round-010.ts";

function passingInput(overrides: Partial<R10CandidateGateInput> = {}): R10CandidateGateInput {
  return { candidateId: M3_R10_CANDIDATE_IDS[0], resultStatus: "COMPLETE", aggregateImprovement: 0.1, improvedValidationFolds: 4, catastrophicFolds: 0, positiveNetValidationFolds: 4, netExpectancyR: 0.03, profitFactor: 1.2, profitFactorStatus: "NORMAL", topSymbolShareOfPositiveNetR: 0.21, largestSingleTradeShareOfPositiveNetR: 0.1, feeBurdenRatio: 0.1, formalSignals: 300, minimumFoldExecutedTrades: 30, ...overrides };
}

function candidate(candidateId: R10SelectionCandidate["candidateId"], expectancy: number): R10SelectionCandidate {
  return { candidateId, eligible: true, improvedValidationFolds: 4, aggregateValidationExpectancyR: expectancy, complexityTuple: R10_COMPLEXITY_TUPLES[candidateId], aggregateValidationProfitFactor: 1.3 };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [Array.from(items)];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [item, ...tail]));
}

describe("M3-R10 Gate and selection conformance", () => {
  it("uses the inclusive scale-aware expectancy tie band", () => {
    expect(isWithinInclusiveR10ExpectancyTieBand(0.060, 0.050, 0.01)).toBe(true);
    expect(isWithinInclusiveR10ExpectancyTieBand(0.070, 0.060, 0.01)).toBe(true);
    expect(isWithinInclusiveR10ExpectancyTieBand(0.130, 0.120, 0.01)).toBe(true);
    expect(isWithinInclusiveR10ExpectancyTieBand(0.070000000001, 0.060, 0.01)).toBe(false);
    expect(isWithinInclusiveR10ExpectancyTieBand(0.011, 0, 0.01)).toBe(false);
  });

  it("evaluates every applicable gate and fails closed for incomplete evidence", () => {
    expect(evaluateR10CandidateGates(passingInput()).eligibility).toBe("ELIGIBLE");
    expect(evaluateR10CandidateGates(passingInput()).gateResults).toHaveLength(R10_HARD_GATE_IDENTITIES.length);
    expect(evaluateR10CandidateGates(passingInput({ resultStatus: "DATA_INCOMPLETE" })).eligibility).toBe("INCOMPLETE");
    expect(evaluateR10CandidateGates(passingInput({ modelRequired: true, modelIntegrity: false })).failedGateIds).toContain("modelIntegrity");
  });

  it("keeps the mechanical selection invariant across all 24 permutations", () => {
    const candidates = M3_R10_CANDIDATE_IDS.slice(0, 4).map((candidateId, index) => candidate(candidateId, index === 0 ? 0.06 : 0.052));
    const expected = selectR10Candidate(candidates);
    for (const permutation of permutations(candidates)) expect(selectR10Candidate(permutation)).toEqual(expected);
    expect(expected.selectedCandidateId).toBe("R10-R1-REGIME-EXPECTANCY-ROUTER");
    expect(expected.eligibleCandidateIds).toEqual([...M3_R10_CANDIDATE_IDS.slice(0, 4)].sort());
  });
});
