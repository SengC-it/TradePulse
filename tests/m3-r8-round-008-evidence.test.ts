import { describe, expect, it } from "vitest";

import {
  classifyResearchEvidenceStatus,
  runR8SyntheticLifecycleContract,
  type R8EvidenceLifecycleInput,
} from "../src/lib/research/m3-r8-round-008-evidence.ts";
import {
  evaluateR7CandidateGates,
  R7_HARD_GATE_IDENTITIES,
  type R7CandidateGateInput,
} from "../src/lib/research/selection-gates-round-007.ts";
import { R8_CANDIDATE_IDS } from "../src/lib/research/m3-r8-round-008-protocol.ts";

function complete(overrides: Partial<R8EvidenceLifecycleInput> = {}): R8EvidenceLifecycleInput {
  return {
    datasetFreezeCompleted: true,
    integrityErrors: [],
    requiredDataIncomplete: false,
    unresolvedSettlementAmbiguity: false,
    requiredValidationDatasetsComplete: true,
    controlExecutionCompletedStructurally: true,
    controlEconomicStatus: "FAIL",
    ...overrides,
  };
}

function passingGateInput(overrides: Partial<R7CandidateGateInput> = {}): R7CandidateGateInput {
  return {
    candidateId: R8_CANDIDATE_IDS[0],
    resultStatus: "COMPLETE",
    aggregateImprovement: 0.21,
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

describe("M3-R8 evidence lifecycle", () => {
  it("keeps economic CONTROL failure separate from structural evidence completeness", () => {
    expect(classifyResearchEvidenceStatus(complete({ controlEconomicStatus: "FAIL" }))).toBe("COMPLETE");
    expect(classifyResearchEvidenceStatus(complete({ controlEconomicStatus: "PASS" }))).toBe("COMPLETE");
    expect(classifyResearchEvidenceStatus(complete({ controlEconomicStatus: "FAIL", allCandidatesEconomicallyFail: true }))).toBe("COMPLETE");
  });

  it("fails closed for data, settlement, integrity, and structural lifecycle failures", () => {
    expect(classifyResearchEvidenceStatus(complete({ requiredDataIncomplete: true }))).toBe("INCOMPLETE");
    expect(classifyResearchEvidenceStatus(complete({ unresolvedSettlementAmbiguity: true }))).toBe("INCOMPLETE");
    expect(classifyResearchEvidenceStatus(complete({ integrityErrors: ["bad checksum"] }))).toBe("INCOMPLETE");
    expect(classifyResearchEvidenceStatus(complete({ requiredValidationDatasetsComplete: false }))).toBe("INCOMPLETE");
    expect(classifyResearchEvidenceStatus(complete({ controlExecutionCompletedStructurally: false }))).toBe("INCOMPLETE");
  });

  it("passes every mandatory synthetic contract scenario", () => {
    const result = runR8SyntheticLifecycleContract();
    expect(result.passed).toBe(true);
    expect(result.scenarios).toEqual([
      { id: "A_CONTROL_ECONOMIC_FAIL", expected: "COMPLETE", actual: "COMPLETE", candidateExecutionContinues: true },
      { id: "B_ALL_CANDIDATES_ECONOMIC_FAIL", expected: "COMPLETE", actual: "COMPLETE", candidateExecutionContinues: true },
      { id: "C_CONTROL_ECONOMIC_PASS", expected: "COMPLETE", actual: "COMPLETE", candidateExecutionContinues: true },
      { id: "D_DATA_INCOMPLETE", expected: "INCOMPLETE", actual: "INCOMPLETE", candidateExecutionContinues: false },
      { id: "E_SETTLEMENT_AMBIGUOUS", expected: "INCOMPLETE", actual: "INCOMPLETE", candidateExecutionContinues: false },
      { id: "F_INTEGRITY_ERROR", expected: "INCOMPLETE", actual: "INCOMPLETE", candidateExecutionContinues: false },
    ]);
  });

  it("keeps independent frozen gate directions and boundary values", () => {
    const passing = evaluateR7CandidateGates(passingGateInput());
    expect(passing.gateResults).toHaveLength(R7_HARD_GATE_IDENTITIES.length);
    expect(passing.failedGateIds).toEqual([]);
    expect(passing.eligibility).toBe("ELIGIBLE");
    expect(evaluateR7CandidateGates(passingGateInput({ topSymbolShareOfPositiveNetR: 0.5 })).failedGateIds).not.toContain("maximumSymbolConcentration");
    expect(evaluateR7CandidateGates(passingGateInput({ formalSignals: 2_853 })).failedGateIds).not.toContain("minimumFormalSignals");
    expect(evaluateR7CandidateGates(passingGateInput({ minimumFoldExecutedTrades: 272 })).failedGateIds).not.toContain("minimumExecutedTrades");
    expect(evaluateR7CandidateGates(passingGateInput({ netExpectancyR: -0.01 })).failedGateIds).toContain("minimumNetExpectancy");
    expect(evaluateR7CandidateGates(passingGateInput({ profitFactor: 0.88 })).failedGateIds).toContain("minimumProfitFactor");
    expect(evaluateR7CandidateGates(passingGateInput({ positiveNetValidationFolds: 4 })).failedGateIds).not.toContain("positiveNetValidationFolds");
    expect(evaluateR7CandidateGates(passingGateInput({ positiveNetValidationFolds: 3 })).failedGateIds).toContain("positiveNetValidationFolds");
    expect(evaluateR7CandidateGates(passingGateInput({ catastrophicFolds: 0 })).failedGateIds).not.toContain("catastrophicFoldLimit");
    expect(evaluateR7CandidateGates(passingGateInput({ catastrophicFolds: 1 })).failedGateIds).toContain("catastrophicFoldLimit");
  });
});
