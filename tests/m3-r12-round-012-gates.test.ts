import { describe, expect, it } from "vitest";

import { R12_HARD_GATE_IDENTITIES, R12_MACHINE_RECORD, R12_SELECTION_GATE_SHA256, evaluateR12CandidateGates, isWithinInclusiveR12ExpectancyTieBand, selectR12Candidate, validateR12MachineRecord } from "../src/lib/research/selection-gates-round-012.ts";

function passingInput(candidateId: "R12-D1-FIRST-ONLY" | "R12-D2-FIRST-PLUS-ONE") {
  return {
    candidateId,
    resultStatus: "COMPLETE" as const,
    aggregateExecutedTrades: 400,
    minimumValidationFoldExecutedTrades: 40,
    netExpectancyR: 0.05,
    profitFactor: 1.4,
    aggregateImprovement: 0.12,
    improvedValidationFolds: 5,
    positiveValidationFolds: 5,
    catastrophicFolds: 0,
    drawdownMagnitudeImprovement: 0.25,
    topSymbolShareOfPositiveNetR: 0.4,
    largestSinglePositiveTradeShare: 0.08,
    evidenceComplete: true,
  };
}

describe("M3-R12 fixed gates and mechanical selection", () => {
  it("freezes all required gates and validates the canonical record", () => {
    expect(R12_HARD_GATE_IDENTITIES).toHaveLength(12);
    expect(R12_SELECTION_GATE_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(() => validateR12MachineRecord()).not.toThrow();
    expect(R12_MACHINE_RECORD.performanceExecutionSourceSha).toBeNull();
  });

  it("requires every hard gate and fails incomplete evidence closed", () => {
    const evaluation = evaluateR12CandidateGates(passingInput("R12-D1-FIRST-ONLY"));
    expect(evaluation.eligibility).toBe("ELIGIBLE");
    expect(evaluation.passedApplicableGateCount).toBe(12);
    expect(evaluateR12CandidateGates({ ...passingInput("R12-D1-FIRST-ONLY"), evidenceComplete: false }).eligibility).toBe("INCOMPLETE");
    expect(evaluateR12CandidateGates({ ...passingInput("R12-D1-FIRST-ONLY"), aggregateExecutedTrades: 299 }).failedGateIds).toContain("minimumAggregateExecutedTrades");
  });

  it("uses an inclusive scale-aware expectancy tie band", () => {
    expect(isWithinInclusiveR12ExpectancyTieBand(0.06, 0.05, 0.01)).toBe(true);
    expect(isWithinInclusiveR12ExpectancyTieBand(0.070000000001, 0.06, 0.01)).toBe(false);
    expect(isWithinInclusiveR12ExpectancyTieBand(0.06, 0.049, 0.01)).toBe(false);
  });

  it("selects only eligible candidates and applies deterministic tie-breaks", () => {
    const first = passingInput("R12-D1-FIRST-ONLY");
    const second = passingInput("R12-D2-FIRST-PLUS-ONE");
    const evaluated = [evaluateR12CandidateGates(first), evaluateR12CandidateGates(second)];
    const selected = selectR12Candidate([
      { candidateId: first.candidateId, eligible: evaluated[0]!.eligibility === "ELIGIBLE", aggregateValidationExpectancyR: 0.05, maxDrawdownR: -10, aggregateValidationProfitFactor: 1.4, formalSignals: 100 },
      { candidateId: second.candidateId, eligible: evaluated[1]!.eligibility === "ELIGIBLE", aggregateValidationExpectancyR: 0.055, maxDrawdownR: -8, aggregateValidationProfitFactor: 1.3, formalSignals: 120 },
    ]);
    expect(selected.eligibleCandidateIds).toEqual(["R12-D1-FIRST-ONLY", "R12-D2-FIRST-PLUS-ONE"]);
    expect(selected.selectedCandidateId).toBe("R12-D2-FIRST-PLUS-ONE");
    expect(selectR12Candidate([]).finalDecision).toBe("NO THESIS-DEDUP CANDIDATE — ROUND-012");
  });
});
