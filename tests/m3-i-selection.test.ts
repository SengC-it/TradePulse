import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  evaluateM3ISelection,
  M3_I_EXPECTED_CONTROL_REPORT_SHA256,
  M3_I_EXPECTED_EXECUTION_SOURCE_SHA,
  M3_I_EXPECTED_EXPERIMENT_PLAN_SHA256,
  M3_I_EXPECTED_STUDY_SERVER_TIME,
} from "../src/lib/research/m3-i-selection.ts";
import type { M3HResearchEvidence } from "../src/lib/research/m3-h-evidence.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const EVIDENCE_PATH = "docs/evidence/M3_H_ROUND_001_SUMMARY.json";
const CANDIDATE_IDS = [
  "R1-H1-CD-06H",
  "R1-H1-CD-12H",
  "R1-H1-CD-24H",
  "R2-H4-TOPN-1",
  "R2-H4-TOPN-2",
  "R2-H4-TOPN-3",
  "R3-H2-COST-010",
  "R3-H2-COST-015",
  "R3-H2-COST-020",
  "R3-H2-COST-025",
  "R4-H3-SCORE-075",
  "R4-H3-SCORE-080",
  "R4-H3-SCORE-085",
] as const;

type MutableDiagnostics = Record<string, unknown>;
type MutableVariant = {
  variantId: string;
  hypothesisId: string;
  aggregateValidation: { diagnostics: MutableDiagnostics };
  folds: Array<{ diagnostics: MutableDiagnostics }>;
};
type MutableEvidence = {
  evidenceStatus: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  candidates: MutableVariant[];
  control: MutableVariant;
};

function loadEvidence(): M3HResearchEvidence {
  return JSON.parse(readFileSync(EVIDENCE_PATH, "utf8")) as M3HResearchEvidence;
}

function mutable(evidence: M3HResearchEvidence): MutableEvidence {
  return evidence as unknown as MutableEvidence;
}

function variant(evidence: M3HResearchEvidence, id: string): MutableVariant {
  const value = id === "CONTROL_BASELINE_001"
    ? mutable(evidence).control
    : mutable(evidence).candidates.find((candidate) => candidate.variantId === id);
  if (!value) throw new Error(`Missing fixture candidate ${id}.`);
  return value;
}

function setAggregate(evidence: M3HResearchEvidence, id: string, changes: Record<string, unknown>): void {
  Object.assign(variant(evidence, id).aggregateValidation.diagnostics, changes);
}

function setFold(evidence: M3HResearchEvidence, id: string, index: number, changes: Record<string, unknown>): void {
  Object.assign(variant(evidence, id).folds[index].diagnostics, changes);
}

function normalizeControl(evidence: M3HResearchEvidence): void {
  setAggregate(evidence, "CONTROL_BASELINE_001", {
    formalSignals: 300,
    executedTrades: 180,
    grossR: 1,
    expectancyR: 0,
    profitFactor: 1.2,
    profitFactorStatus: "NORMAL",
    topSymbolShareOfPositiveNetR: 0.5,
    largestSingleTradeShareOfPositiveNetR: 0.1,
    feeBurdenRatio: 0.5,
    overlappingSignalRate: 1,
  });
  for (let index = 0; index < 6; index += 1) {
    setFold(evidence, "CONTROL_BASELINE_001", index, {
      executedTrades: 30,
      expectancyR: 0,
      profitFactor: 1.2,
      profitFactorStatus: "NORMAL",
    });
  }
}

function makePassingCandidate(evidence: M3HResearchEvidence, id: string): void {
  const candidate = variant(evidence, id);
  setAggregate(evidence, id, {
    formalSignals: 300,
    executedTrades: 180,
    grossR: 1,
    expectancyR: 0.1,
    profitFactor: 1.2,
    profitFactorStatus: "NORMAL",
    topSymbolShareOfPositiveNetR: 0.5,
    largestSingleTradeShareOfPositiveNetR: 0.1,
    feeBurdenRatio: 0.75,
    overlappingSignalRate: candidate.hypothesisId === "H1_SIGNAL_REDUNDANCY" || candidate.hypothesisId === "H4_SIGNAL_DENSITY" ? 0.7 : null,
  });
  for (let index = 0; index < 6; index += 1) {
    setFold(evidence, id, index, {
      executedTrades: 30,
      expectancyR: 0.05,
      profitFactor: 1.2,
      profitFactorStatus: "NORMAL",
    });
  }
}

function passingEvidence(id: string): M3HResearchEvidence {
  const evidence = loadEvidence();
  normalizeControl(evidence);
  for (const candidateId of CANDIDATE_IDS) setAggregate(evidence, candidateId, { formalSignals: 0 });
  makePassingCandidate(evidence, id);
  return evidence;
}

function isolatedEvidence(ids: readonly string[]): M3HResearchEvidence {
  const evidence = loadEvidence();
  normalizeControl(evidence);
  for (const candidateId of CANDIDATE_IDS) setAggregate(evidence, candidateId, { formalSignals: 0 });
  for (const id of ids) makePassingCandidate(evidence, id);
  return evidence;
}

function gate(evidence: M3HResearchEvidence, id: string, gateId: string) {
  const result = evaluateM3ISelection(evidence);
  return result.candidates.find((candidate) => candidate.variantId === id)!.gateResults.find((item) => item.gateId === gateId)!;
}

function candidateResult(evidence: M3HResearchEvidence, id: string) {
  return evaluateM3ISelection(evidence).candidates.find((candidate) => candidate.variantId === id)!;
}

function setImprovedFoldCountFixture(evidence: M3HResearchEvidence, id: string, count: number): void {
  for (let index = 0; index < 6; index += 1) {
    setFold(evidence, id, index, { expectancyR: index < count ? 0.02 : 0 });
  }
}

describe("M3-I round-001 mechanical selection", () => {
  it("accepts the exact frozen evidence provenance", () => {
    const result = evaluateM3ISelection(loadEvidence());
    expect(result.integrityStatus).toBe("COMPLETE");
    expect(M3_I_EXPECTED_EXECUTION_SOURCE_SHA).toBe("7b3fa166d01fde79dc95ced182c3c515f904a847");
    expect(M3_I_EXPECTED_CONTROL_REPORT_SHA256).toBe("0d620013f85bff28de11fc9ca4765d300d29630a0e0e04f9175e9c6b97715020");
    expect(M3_I_EXPECTED_EXPERIMENT_PLAN_SHA256).toBe("2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a");
    expect(M3_I_EXPECTED_STUDY_SERVER_TIME).toBe(1787016706276);
  });

  it("fails integrity when the selection gate hash is wrong", () => {
    const evidence = loadEvidence();
    mutable(evidence).selectionGateSha256 = "wrong-gate";
    const result = evaluateM3ISelection(evidence);
    expect(result.finalDecision).toBe("INCOMPLETE_EVIDENCE");
    expect(result.integrityStatus).toBe("INCOMPLETE_EVIDENCE");
  });

  it("fails integrity when the experiment plan hash is wrong", () => {
    const evidence = loadEvidence();
    mutable(evidence).experimentPlanSha256 = "wrong-plan";
    expect(evaluateM3ISelection(evidence).finalDecision).toBe("INCOMPLETE_EVIDENCE");
  });

  it("fails integrity when the execution source, CONTROL hash, or study clock changes", () => {
    const source = loadEvidence();
    (source as unknown as { executionSourceSha: string }).executionSourceSha = "wrong-source";
    expect(evaluateM3ISelection(source).finalDecision).toBe("INCOMPLETE_EVIDENCE");
    const control = loadEvidence();
    (control as unknown as { controlReportSha256: string }).controlReportSha256 = "wrong-control";
    expect(evaluateM3ISelection(control).finalDecision).toBe("INCOMPLETE_EVIDENCE");
    const clock = loadEvidence();
    (clock as unknown as { studyServerTime: number }).studyServerTime = M3_I_EXPECTED_STUDY_SERVER_TIME + 1;
    expect(evaluateM3ISelection(clock).finalDecision).toBe("INCOMPLETE_EVIDENCE");
  });

  it("fails closed for incomplete M3-H evidence", () => {
    const evidence = loadEvidence();
    mutable(evidence).evidenceStatus = "INCOMPLETE";
    const result = evaluateM3ISelection(evidence);
    expect(result.integrityStatus).toBe("INCOMPLETE_EVIDENCE");
    expect(result.selectedCandidateId).toBeNull();
  });

  it("requires exactly the frozen 13 candidate identities", () => {
    const evidence = loadEvidence();
    mutable(evidence).candidates.pop();
    expect(evaluateM3ISelection(evidence).finalDecision).toBe("INCOMPLETE_EVIDENCE");
  });

  it("rejects duplicate candidate identities", () => {
    const evidence = loadEvidence();
    mutable(evidence).candidates[1].variantId = mutable(evidence).candidates[0].variantId;
    expect(evaluateM3ISelection(evidence).finalDecision).toBe("INCOMPLETE_EVIDENCE");
  });

  it("fails integrity for non-finite required aggregate metrics", () => {
    const evidence = loadEvidence();
    setAggregate(evidence, "R1-H1-CD-06H", { formalSignals: Number.POSITIVE_INFINITY });
    expect(evaluateM3ISelection(evidence).finalDecision).toBe("INCOMPLETE_EVIDENCE");
  });

  it("returns all 11 gate results and does not count N/A redundancy as PASS", () => {
    const evidence = passingEvidence("R3-H2-COST-010");
    const result = candidateResult(evidence, "R3-H2-COST-010");
    const redundancy = result.gateResults.find((item) => item.gateId === "requiredRedundancyImprovement")!;
    expect(result.gateResults).toHaveLength(11);
    expect(redundancy.applicability).toBe("NOT_APPLICABLE");
    expect(redundancy.status).toBe("NOT_APPLICABLE");
    expect(result.applicableGateCount).toBe(10);
    expect(result.passedApplicableGateCount).toBe(10);
    expect(result.eligibility).toBe("ELIGIBLE");
  });

  it("emits only the frozen gate statuses", () => {
    const result = candidateResult(passingEvidence("R1-H1-CD-06H"), "R1-H1-CD-06H");
    expect(result.gateResults.every((item) => ["PASS", "FAIL", "NOT_APPLICABLE"].includes(item.status))).toBe(true);
  });

  it("requires redundancy improvement for H1 and H4", () => {
    const h1 = passingEvidence("R1-H1-CD-06H");
    setAggregate(h1, "R1-H1-CD-06H", { overlappingSignalRate: 0.8 });
    expect(gate(h1, "R1-H1-CD-06H", "requiredRedundancyImprovement").status).toBe("FAIL");
    const h4 = passingEvidence("R2-H4-TOPN-1");
    setAggregate(h4, "R2-H4-TOPN-1", { overlappingSignalRate: 0.8 });
    expect(gate(h4, "R2-H4-TOPN-1", "requiredRedundancyImprovement").status).toBe("FAIL");
  });

  it("passes aggregate improvement at the inclusive 0.10 boundary", () => {
    const evidence = passingEvidence("R1-H1-CD-06H");
    const result = gate(evidence, "R1-H1-CD-06H", "minimumAggregateImprovement");
    expect(result.actualValue).toBe(0.1);
    expect(result.status).toBe("PASS");
  });

  it("passes improved validation folds at the inclusive boundary of four", () => {
    const evidence = passingEvidence("R1-H1-CD-06H");
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-06H", 4);
    const result = candidateResult(evidence, "R1-H1-CD-06H");
    expect(result.metrics.improvedValidationFolds).toBe(4);
    expect(gate(evidence, "R1-H1-CD-06H", "minimumImprovedValidationFolds").status).toBe("PASS");
  });

  it("passes catastrophic count zero and fails one catastrophic fold", () => {
    const passing = passingEvidence("R1-H1-CD-06H");
    expect(gate(passing, "R1-H1-CD-06H", "catastrophicFoldLimit").status).toBe("PASS");
    const failing = passingEvidence("R1-H1-CD-06H");
    setFold(failing, "R1-H1-CD-06H", 0, { expectancyR: -0.1 });
    expect(gate(failing, "R1-H1-CD-06H", "catastrophicFoldLimit").status).toBe("FAIL");
  });

  it("passes minimum expectancy at the inclusive +0.03 boundary", () => {
    const evidence = passingEvidence("R1-H1-CD-06H");
    setAggregate(evidence, "R1-H1-CD-06H", { expectancyR: 0.03 });
    expect(gate(evidence, "R1-H1-CD-06H", "minimumNetExpectancy").status).toBe("PASS");
  });

  it("passes NORMAL profit factor at the inclusive 1.20 boundary", () => {
    const evidence = passingEvidence("R1-H1-CD-06H");
    expect(gate(evidence, "R1-H1-CD-06H", "minimumProfitFactor").status).toBe("PASS");
  });

  it("fails NO_TRADES and applies NO_LOSSES sample semantics", () => {
    const noTrades = passingEvidence("R1-H1-CD-06H");
    setAggregate(noTrades, "R1-H1-CD-06H", { profitFactor: null, profitFactorStatus: "NO_TRADES" });
    expect(gate(noTrades, "R1-H1-CD-06H", "minimumProfitFactor").status).toBe("FAIL");
    const noLosses = passingEvidence("R1-H1-CD-06H");
    setAggregate(noLosses, "R1-H1-CD-06H", { profitFactor: null, profitFactorStatus: "NO_LOSSES" });
    expect(gate(noLosses, "R1-H1-CD-06H", "minimumProfitFactor").status).toBe("PASS");
    setAggregate(noLosses, "R1-H1-CD-06H", { formalSignals: 299 });
    expect(gate(noLosses, "R1-H1-CD-06H", "minimumProfitFactor").status).toBe("FAIL");
  });

  it("fails null symbol and single-trade concentration", () => {
    const symbol = passingEvidence("R1-H1-CD-06H");
    setAggregate(symbol, "R1-H1-CD-06H", { topSymbolShareOfPositiveNetR: null });
    expect(gate(symbol, "R1-H1-CD-06H", "maximumSymbolConcentration").status).toBe("FAIL");
    const single = passingEvidence("R1-H1-CD-06H");
    setAggregate(single, "R1-H1-CD-06H", { largestSingleTradeShareOfPositiveNetR: null });
    expect(gate(single, "R1-H1-CD-06H", "maximumSingleTradeConcentration").status).toBe("FAIL");
  });

  it("passes fee burden at 0.75 and fails an invalid zero-gross ratio", () => {
    const passing = passingEvidence("R1-H1-CD-06H");
    expect(gate(passing, "R1-H1-CD-06H", "maximumFeeBurdenRatio").status).toBe("PASS");
    const invalid = passingEvidence("R1-H1-CD-06H");
    setAggregate(invalid, "R1-H1-CD-06H", { grossR: 0 });
    expect(gate(invalid, "R1-H1-CD-06H", "maximumFeeBurdenRatio").status).toBe("FAIL");
  });

  it("passes formal signals at 300 and requires every fold to have 30 trades", () => {
    const passing = passingEvidence("R1-H1-CD-06H");
    expect(gate(passing, "R1-H1-CD-06H", "minimumFormalSignals").status).toBe("PASS");
    expect(gate(passing, "R1-H1-CD-06H", "minimumExecutedTrades").status).toBe("PASS");
    const failing = passingEvidence("R1-H1-CD-06H");
    setFold(failing, "R1-H1-CD-06H", 2, { executedTrades: 29 });
    expect(gate(failing, "R1-H1-CD-06H", "minimumExecutedTrades").status).toBe("FAIL");
    expect(gate(failing, "R1-H1-CD-06H", "catastrophicFoldLimit").status).toBe("FAIL");
  });

  it("requires every applicable gate for eligibility", () => {
    const evidence = passingEvidence("R3-H2-COST-010");
    setAggregate(evidence, "R3-H2-COST-010", { expectancyR: 0.029 });
    const result = candidateResult(evidence, "R3-H2-COST-010");
    expect(result.eligibility).toBe("INELIGIBLE");
    expect(result.failedGateIds).toContain("minimumNetExpectancy");
  });

  it("keeps CONTROL as comparator and never selects it", () => {
    const result = evaluateM3ISelection(loadEvidence());
    expect(result.candidates.some((candidate) => candidate.experimentId === "CONTROL_BASELINE_001")).toBe(false);
    expect(result.selectedCandidateId).not.toBe("CONTROL_BASELINE_001");
  });

  it("returns the exact no-candidate outcome for the committed evidence", () => {
    const result = evaluateM3ISelection(loadEvidence());
    expect(result.finalDecision).toBe("NO BASELINE-002 CANDIDATE");
    expect(result.eligibleCandidateIds).toEqual([]);
  });

  it("selects the candidate with more improved folds at STEP 1", () => {
    const evidence = isolatedEvidence(["R1-H1-CD-06H", "R1-H1-CD-12H"]);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-06H", 4);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-12H", 5);
    expect(evaluateM3ISelection(evidence).selectedCandidateId).toBe("R1-H1-CD-12H");
  });

  it("selects higher expectancy at STEP 2 only beyond the frozen tie threshold", () => {
    const evidence = isolatedEvidence(["R1-H1-CD-06H", "R1-H1-CD-12H"]);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-06H", 4);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-12H", 4);
    setAggregate(evidence, "R1-H1-CD-06H", { expectancyR: 0.1 });
    setAggregate(evidence, "R1-H1-CD-12H", { expectancyR: 0.12 });
    expect(evaluateM3ISelection(evidence).selectedCandidateId).toBe("R1-H1-CD-12H");
  });

  it("uses the complexity tuple at STEP 3 within the expectancy tie threshold", () => {
    const evidence = isolatedEvidence(["R1-H1-CD-06H", "R4-H3-SCORE-075"]);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-06H", 4);
    setImprovedFoldCountFixture(evidence, "R4-H3-SCORE-075", 4);
    expect(evaluateM3ISelection(evidence).selectedCandidateId).toBe("R4-H3-SCORE-075");
  });

  it("uses higher PF at STEP 4 after equal complexity", () => {
    const evidence = isolatedEvidence(["R1-H1-CD-06H", "R1-H1-CD-12H"]);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-06H", 4);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-12H", 4);
    setAggregate(evidence, "R1-H1-CD-06H", { profitFactor: 1.2 });
    setAggregate(evidence, "R1-H1-CD-12H", { profitFactor: 1.3 });
    expect(evaluateM3ISelection(evidence).selectedCandidateId).toBe("R1-H1-CD-12H");
  });

  it("uses experimentId lexical order at STEP 5", () => {
    const evidence = isolatedEvidence(["R1-H1-CD-06H", "R1-H1-CD-12H"]);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-06H", 4);
    setImprovedFoldCountFixture(evidence, "R1-H1-CD-12H", 4);
    expect(evaluateM3ISelection(evidence).selectedCandidateId).toBe("R1-H1-CD-06H");
  });

  it("produces deterministic output for the committed real evidence", () => {
    const evidence = loadEvidence();
    const first = evaluateM3ISelection(evidence);
    const second = evaluateM3ISelection(evidence);
    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(first.finalDecision).toBe("NO BASELINE-002 CANDIDATE");
  });

  it("contains no network, backtest, Strategy Engine, clock, or randomness path", () => {
    const source = readFileSync("src/lib/research/m3-i-selection.ts", "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(|runBacktest|Binance|Date\.now|Math\.random/);
  });
});
