import { describe, expect, it } from "vitest";

import {
  M3_R7_CANDIDATE_IDS,
  R7_COMPLEXITY_TUPLES,
} from "../src/lib/research/m3-r7-round-007-protocol.ts";
import {
  R7_HARD_GATE_IDENTITIES,
  evaluateR7CandidateGates,
  isWithinInclusiveR7ExpectancyTieBand,
  selectR7Candidate,
  type R7CandidateGateInput,
  type R7SelectionCandidate,
} from "../src/lib/research/selection-gates-round-007.ts";

function passingInput(overrides: Partial<R7CandidateGateInput> = {}): R7CandidateGateInput {
  return {
    candidateId: M3_R7_CANDIDATE_IDS[0],
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
    formalSignals: 2_853,
    minimumFoldExecutedTrades: 272,
    ...overrides,
  };
}

function selectionCandidate(candidateId: R7SelectionCandidate["candidateId"], expectancy: number, improvedValidationFolds = 4): R7SelectionCandidate {
  return {
    candidateId,
    eligible: true,
    improvedValidationFolds,
    aggregateValidationExpectancyR: expectancy,
    complexityTuple: R7_COMPLEXITY_TUPLES[candidateId],
    aggregateValidationProfitFactor: 1.3,
  };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [Array.from(items)];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [item, ...tail]));
}

describe("M3-R7 Gate semantics and mechanical selection", () => {
  it("applies numeric directions independently of PERIOD_END_CENSORED", () => {
    const evaluation = evaluateR7CandidateGates(passingInput({ resultStatus: "PERIOD_END_CENSORED" }));
    expect(evaluation.eligibility).toBe("ELIGIBLE");
    expect(evaluation.failedGateIds).toEqual([]);
    expect(evaluation.gateResults).toHaveLength(R7_HARD_GATE_IDENTITIES.length);

    expect(evaluateR7CandidateGates(passingInput({ topSymbolShareOfPositiveNetR: 0.51 })).failedGateIds).toContain("maximumSymbolConcentration");
    expect(evaluateR7CandidateGates(passingInput({ formalSignals: 299 })).failedGateIds).toContain("minimumFormalSignals");
    expect(evaluateR7CandidateGates(passingInput({ minimumFoldExecutedTrades: 29 })).failedGateIds).toContain("minimumExecutedTrades");
  });

  it("fails closed only when the applicable validation evidence is incomplete", () => {
    expect(evaluateR7CandidateGates(passingInput({ resultStatus: "DATA_INCOMPLETE" })).eligibility).toBe("INCOMPLETE");
    expect(evaluateR7CandidateGates(passingInput({ validationIncomplete: true, resultStatus: "PERIOD_END_CENSORED" })).eligibility).toBe("INCOMPLETE");
  });

  it("freezes inclusive expectancy boundaries with scale-aware IEEE-754 tolerance", () => {
    expect(isWithinInclusiveR7ExpectancyTieBand(0.060, 0.050, 0.01)).toBe(true);
    expect(isWithinInclusiveR7ExpectancyTieBand(0.070, 0.060, 0.01)).toBe(true);
    expect(isWithinInclusiveR7ExpectancyTieBand(0.130, 0.120, 0.01)).toBe(true);
    expect(isWithinInclusiveR7ExpectancyTieBand(0.070000000001, 0.060, 0.01)).toBe(false);
    expect(isWithinInclusiveR7ExpectancyTieBand(0.061, 0.050, 0.01)).toBe(false);
    expect(isWithinInclusiveR7ExpectancyTieBand(0.011, 0, 0.01)).toBe(false);
  });

  it("keeps the mechanical selection invariant across all 24 permutations", () => {
    const candidates = M3_R7_CANDIDATE_IDS.slice(0, 4).map((candidateId, index) => selectionCandidate(candidateId, index === 0 ? 0.06 : 0.052));
    const expected = selectR7Candidate(candidates);
    for (const permutation of permutations(candidates)) expect(selectR7Candidate(permutation)).toEqual(expected);
    expect(expected.selectionAlgorithmApplied).toBe(true);
    expect(expected.selectedCandidateId).toBe("R7-R1-REGIME-EXPECTANCY-ROUTER");
    expect(expected.eligibleCandidateIds).toEqual([...M3_R7_CANDIDATE_IDS.slice(0, 4)].sort());
  });

  it("returns the exact zero-eligible result without applying selection", () => {
    const result = selectR7Candidate([{ ...selectionCandidate(M3_R7_CANDIDATE_IDS[0], 0.05, 0), eligible: false }]);
    expect(result.selectionAlgorithmApplied).toBe(false);
    expect(result.selectedCandidateId).toBeNull();
    expect(result.finalDecision).toBe("NO BASELINE-002 CANDIDATE — ROUND-007");
  });
});
