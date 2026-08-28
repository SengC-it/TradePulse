import { describe, expect, it } from "vitest";

import { M3_R11_CANDIDATE_IDS, R11_COMPLEXITY_TUPLES } from "../src/lib/research/m3-r11-round-011-protocol.ts";
import { R11_HARD_GATE_IDENTITIES, evaluateR11CandidateGates, isWithinInclusiveR11ExpectancyTieBand, selectR11Candidate, type R11CandidateGateInput, type R11SelectionCandidate } from "../src/lib/research/selection-gates-round-011.ts";

function passingInput(overrides: Partial<R11CandidateGateInput> = {}): R11CandidateGateInput {
  return { candidateId: M3_R11_CANDIDATE_IDS[0], resultStatus: "COMPLETE", aggregateImprovement: 0.1, improvedValidationFolds: 4, catastrophicFolds: 0, positiveNetValidationFolds: 4, netExpectancyR: 0.03, profitFactor: 1.2, profitFactorStatus: "NORMAL", topSymbolShareOfPositiveNetR: 0.21, largestSingleTradeShareOfPositiveNetR: 0.1, feeBurdenRatio: 0.1, formalSignals: 300, minimumFoldExecutedTrades: 30, ...overrides };
}

function candidate(candidateId: R11SelectionCandidate["candidateId"], expectancy: number): R11SelectionCandidate {
  return { candidateId, eligible: true, improvedValidationFolds: 4, aggregateValidationExpectancyR: expectancy, complexityTuple: R11_COMPLEXITY_TUPLES[candidateId], aggregateValidationProfitFactor: 1.3 };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [Array.from(items)];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [item, ...tail]));
}

describe("M3-R11 Gate and selection conformance", () => {
  it("uses the inclusive scale-aware expectancy tie band", () => {
    expect(isWithinInclusiveR11ExpectancyTieBand(0.060, 0.050, 0.01)).toBe(true);
    expect(isWithinInclusiveR11ExpectancyTieBand(0.070, 0.060, 0.01)).toBe(true);
    expect(isWithinInclusiveR11ExpectancyTieBand(0.130, 0.120, 0.01)).toBe(true);
    expect(isWithinInclusiveR11ExpectancyTieBand(0.070000000001, 0.060, 0.01)).toBe(false);
    expect(isWithinInclusiveR11ExpectancyTieBand(0.011, 0, 0.01)).toBe(false);
  });

  it("evaluates every applicable gate and fails closed for incomplete evidence", () => {
    expect(evaluateR11CandidateGates(passingInput()).eligibility).toBe("ELIGIBLE");
    expect(evaluateR11CandidateGates(passingInput()).gateResults).toHaveLength(R11_HARD_GATE_IDENTITIES.length);
    expect(evaluateR11CandidateGates(passingInput({ resultStatus: "DATA_INCOMPLETE" })).eligibility).toBe("INCOMPLETE");
    expect(evaluateR11CandidateGates(passingInput({ modelRequired: true, modelIntegrity: false })).failedGateIds).toContain("modelIntegrity");
  });

  it("keeps the mechanical selection invariant across all 24 permutations", () => {
    const candidates = M3_R11_CANDIDATE_IDS.slice(0, 4).map((candidateId, index) => candidate(candidateId, index === 0 ? 0.06 : 0.052));
    const expected = selectR11Candidate(candidates);
    for (const permutation of permutations(candidates)) expect(selectR11Candidate(permutation)).toEqual(expected);
    expect(expected.selectedCandidateId).toBe("R11-R1-REGIME-EXPECTANCY-ROUTER");
    expect(expected.eligibleCandidateIds).toEqual([...M3_R11_CANDIDATE_IDS.slice(0, 4)].sort());
  });
});
