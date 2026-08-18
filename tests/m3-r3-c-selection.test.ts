import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
  M3_R3_ROUND_003_CANDIDATE_IDS,
  M3_R3_ROUND_003_RESEARCH_ROUND_ID,
} from "../src/lib/research/selection-gates-round-003.ts";
import {
  M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256,
  M3_R3_C_EXPECTED_POLICY_VERSION,
  M3_R3_C_EXPECTED_SCHEMA_VERSION,
  M3_R3_C_EXPECTED_STRATEGY_VERSION,
  M3_R3_C_M3_J_STATUS,
  M3_R3_C_M4_STATUS,
  M3_R3_C_BASELINE_002_STATUS,
  M3_R3_C_SELECTION_SCHEMA_VERSION,
  M3_R3_C_SOURCE_MAIN_SHA,
  createM3R3CSelectionReport,
  evaluateM3R3CSelection,
  renderM3R3CSelectionMarkdown,
  serializeM3R3CSelectionReport,
} from "../src/lib/research/m3-r3-c-selection.ts";
import {
  M3_R3_ROUND_003_PLAN,
  M3_R3_ROUND_003_PLAN_SHA256,
  validateM3R3Round003Plan,
} from "../src/lib/research/m3-r3-round-003-plan.ts";
import { validateM3R3Round003MachineRecord } from "../src/lib/research/selection-gates-round-003.ts";
import { getResearchFoldRoleRange } from "../src/lib/research/folds.ts";

type MutableRecord = Record<string, unknown>;

const FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;
const EXPECTED_SOURCE_SHA = "d2325b195564bfe74654bd64d501a388f8999c87";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function diagnostics(overrides: MutableRecord = {}): MutableRecord {
  return {
    formalSignals: 400,
    executedTrades: 40,
    grossR: 10,
    expectancyR: 0.15,
    profitFactor: 1.5,
    profitFactorStatus: "NORMAL",
    topSymbolShareOfPositiveNetR: 0.2,
    largestSingleTradeShareOfPositiveNetR: 0.05,
    feeBurdenRatio: 0.5,
    overlappingSignalRate: 0.8,
    ...overrides,
  };
}

function sha256Fixture(value: number): string {
  return value.toString(16).padStart(2, "0").repeat(32);
}

function complexity(candidateId: string): MutableRecord {
  const tuples = M3_R3_ROUND_003_PLAN.complexityTuples as Readonly<Record<string, MutableRecord>>;
  return clone(tuples[candidateId]!);
}

function makeVariant(candidateId: string, index: number, control = false): MutableRecord {
  const aggregate = diagnostics(control ? { expectancyR: 0 } : {});
  const folds = FOLD_IDS.map((foldId) => ({
    foldId,
    foldRole: "VALIDATION",
    range: { ...getResearchFoldRoleRange(foldId, "VALIDATION") },
    diagnostics: diagnostics(control ? { expectancyR: 0.1 } : { expectancyR: 0.13 }),
  }));
  const variant: MutableRecord = {
    candidateId,
    complexity: complexity(candidateId),
    aggregateValidation: { diagnostics: aggregate },
    folds,
    redundancyApplicability: "NOT_APPLICABLE",
    redundancyRelativeReductionVsControl: null,
    formalIdentitySha256: sha256Fixture(index + 1),
    executedIdentitySha256: sha256Fixture(index + 21),
    selectedFormalSignals: 400,
    executedTrades: 40,
  };
  if (!control) {
    variant.aggregateExpectancyDeltaVsControl = 0.15;
    variant.foldExpectancyDeltaVsControl = Object.fromEntries(FOLD_IDS.map((foldId) => [foldId, 0.03]));
  }
  return variant;
}

function makeEvidence(): MutableRecord {
  return {
    schemaVersion: M3_R3_C_EXPECTED_SCHEMA_VERSION,
    researchRoundId: M3_R3_ROUND_003_RESEARCH_ROUND_ID,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R3_ROUND_003_PLAN_SHA256,
    recoveryMainBaseSha: "1399ef6921b2930fb51d49c1b8c29260f1087678",
    executionSourceSha: EXPECTED_SOURCE_SHA,
    strategyVersion: M3_R3_C_EXPECTED_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R3_C_EXPECTED_POLICY_VERSION,
    controlReportSchemaVersion: "m3-b-report-004",
    dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
    performanceLock: "FIRST_M3_R3_B_PERFORMANCE_RESULT_GENERATED",
    performanceLockTriggered: true,
    evidenceStatus: "COMPLETE",
    decision: "DEFER_TO_M3_R3_C_FROZEN_GATE_APPLICATION",
    snapshotCount: 7500,
    controlExecutedTrades: 40,
    controlFormalSignals: 400,
    control: makeVariant("R2-CONTROL-BASELINE-001", 0, true),
    candidates: M3_R3_ROUND_003_CANDIDATE_IDS.map((candidateId, index) => makeVariant(candidateId, index + 1)),
  };
}

function candidate(evidence: MutableRecord, candidateId: string): MutableRecord {
  return (evidence.candidates as MutableRecord[]).find((value) => value.candidateId === candidateId)!;
}

function aggregate(evidence: MutableRecord, candidateId: string, changes: MutableRecord): void {
  Object.assign((candidate(evidence, candidateId).aggregateValidation as MutableRecord).diagnostics as MutableRecord, changes);
}

function fold(evidence: MutableRecord, candidateId: string, index: number, changes: MutableRecord): void {
  const folds = candidate(evidence, candidateId).folds as MutableRecord[];
  Object.assign(folds[index]!.diagnostics as MutableRecord, changes);
}

function removeConvenienceFields(evidence: MutableRecord): void {
  for (const value of evidence.candidates as MutableRecord[]) {
    delete value.aggregateExpectancyDeltaVsControl;
    delete value.foldExpectancyDeltaVsControl;
  }
}

function isolate(evidence: MutableRecord, ids: readonly string[]): void {
  removeConvenienceFields(evidence);
  for (const id of M3_R3_ROUND_003_CANDIDATE_IDS) {
    if (!ids.includes(id)) aggregate(evidence, id, { formalSignals: 0 });
  }
}

function result(evidence: MutableRecord, candidateId: string): ReturnType<typeof evaluateM3R3CSelection>["candidates"][number] {
  return evaluateM3R3CSelection(evidence, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).candidates.find((value) => value.candidateId === candidateId)!;
}

function gate(evidence: MutableRecord, candidateId: string, gateId: string) {
  return result(evidence, candidateId).gateResults.find((value) => value.gateId === gateId)!;
}

function passingPair(first: string, second: string): MutableRecord {
  const evidence = makeEvidence();
  isolate(evidence, [first, second]);
  return evidence;
}

describe("M3-R3-C Round-003 mechanical selection", () => {
  const cases: readonly [string, () => void][] = [
    ["01 freezes the selection schema", () => expect(M3_R3_C_SELECTION_SCHEMA_VERSION).toBe("m3-r3-c-selection-001")],
    ["02 freezes the main source SHA", () => expect(M3_R3_C_SOURCE_MAIN_SHA).toBe("4172c77398ee18d9e109396415cc9970fa1800ae")],
    ["03 freezes the input evidence SHA", () => expect(M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).toBe("6b86ef4ef8bb9bbf8c0047b57d4322fc61f843cad6c9fdd55ab513e00b6d8d69")],
    ["04 freezes the report schema", () => expect(M3_R3_C_EXPECTED_SCHEMA_VERSION).toBe("m3-r3-round-003-report-001")],
    ["05 freezes the research round", () => expect(M3_R3_ROUND_003_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-003")],
    ["06 requires COMPLETE evidence", () => { const e = makeEvidence(); e.evidenceStatus = "INCOMPLETE"; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["07 requires the deferred decision", () => { const e = makeEvidence(); e.decision = "OTHER"; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["08 requires the performance lock", () => { const e = makeEvidence(); e.performanceLockTriggered = false; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["09 exposes exactly nine candidates", () => expect(makeEvidence().candidates).toHaveLength(9)],
    ["10 retains the exact candidate order", () => expect((evaluateM3R3CSelection(makeEvidence(), M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).candidates).map((value) => value.candidateId)).toEqual([...M3_R3_ROUND_003_CANDIDATE_IDS])],
    ["11 retains the exact complexity tuples", () => { const e = evaluateM3R3CSelection(makeEvidence(), M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256); expect(e.candidates.map((value) => value.complexity)).toEqual(M3_R3_ROUND_003_CANDIDATE_IDS.map(complexity)); }],
    ["12 rejects a wrong complexity tuple", () => { const e = makeEvidence(); (candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).complexity as MutableRecord).newRules = 99; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["13 uses aggregateValidation diagnostics for aggregate gates", () => { const e = makeEvidence(); const c = candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!); c.selectedFormalSignals = 0; c.executedTrades = 0; expect(result(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).eligibility).toBe("ELIGIBLE"); }],
    ["14 minimumFormalSignals ignores selectedFormalSignals", () => { const e = makeEvidence(); candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).selectedFormalSignals = 0; expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumFormalSignals").status).toBe("PASS"); }],
    ["15 fold sample ignores top-level executedTrades", () => { const e = makeEvidence(); candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).executedTrades = 0; expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumExecutedTrades").status).toBe("PASS"); }],
    ["16 recomputes aggregate expectancy delta", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: 0.1 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumAggregateImprovement").actualValue).toBe(0.1); }],
    ["17 convenience aggregate mismatch is incomplete", () => { const e = makeEvidence(); (candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!) as MutableRecord).aggregateExpectancyDeltaVsControl = 0.2; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["18 aggregate improvement +0.10 passes", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: 0.1 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumAggregateImprovement").status).toBe("PASS"); }],
    ["19 aggregate improvement just below +0.10 fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: 0.099999 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumAggregateImprovement").status).toBe("FAIL"); }],
    ["20 improved fold +0.02 counts", () => { const e = makeEvidence(); removeConvenienceFields(e); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, 0, { expectancyR: 0.12000000000000001 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumImprovedValidationFolds").actualValue).toBe(6); }],
    ["21 improved fold just below +0.02 does not count", () => { const e = makeEvidence(); removeConvenienceFields(e); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, 0, { expectancyR: 0.119999 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumImprovedValidationFolds").actualValue).toBe(5); }],
    ["22 insufficient sample fold cannot improve", () => { const e = makeEvidence(); removeConvenienceFields(e); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, 0, { executedTrades: 29, expectancyR: 0.3 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumImprovedValidationFolds").actualValue).toBe(5); }],
    ["23 four improved folds pass", () => { const e = makeEvidence(); removeConvenienceFields(e); for (const index of [0, 1, 2, 3]) fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, index, { expectancyR: 0.12000000000000001 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumImprovedValidationFolds").status).toBe("PASS"); }],
    ["24 three improved folds fail", () => { const e = makeEvidence(); removeConvenienceFields(e); for (const index of [0, 1, 2]) fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, index, { expectancyR: 0.12000000000000001 }); for (const index of [3, 4, 5]) fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, index, { expectancyR: 0.1 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumImprovedValidationFolds").status).toBe("FAIL"); }],
    ["25 expectancy -0.10 is catastrophic", () => { const e = makeEvidence(); removeConvenienceFields(e); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, 0, { expectancyR: -0.1 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "catastrophicFoldLimit").status).toBe("FAIL"); }],
    ["26 NORMAL PF 0.80 is not catastrophic from PF rule", () => { const e = makeEvidence(); removeConvenienceFields(e); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, 0, { profitFactor: 0.8 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "catastrophicFoldLimit").actualValue).toBe(0); }],
    ["27 NORMAL PF below 0.80 is catastrophic", () => { const e = makeEvidence(); removeConvenienceFields(e); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, 0, { profitFactor: 0.799999 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "catastrophicFoldLimit").status).toBe("FAIL"); }],
    ["28 NO_TRADES is catastrophic", () => { const e = makeEvidence(); removeConvenienceFields(e); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, 0, { executedTrades: 0, profitFactor: null, profitFactorStatus: "NO_TRADES" }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "catastrophicFoldLimit").status).toBe("FAIL"); }],
    ["29 NO_LOSSES is not catastrophic solely because PF is null", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { profitFactor: null, profitFactorStatus: "NO_LOSSES" }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "catastrophicFoldLimit").actualValue).toBe(0); }],
    ["30 catastrophic count zero passes", () => expect(gate(makeEvidence(), M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "catastrophicFoldLimit").status).toBe("PASS")],
    ["31 aggregate expectancy +0.03 passes", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: 0.03 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumNetExpectancy").status).toBe("PASS"); }],
    ["32 aggregate expectancy just below +0.03 fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: 0.029999 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumNetExpectancy").status).toBe("FAIL"); }],
    ["33 NORMAL PF 1.20 passes", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { profitFactor: 1.2 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumProfitFactor").status).toBe("PASS"); }],
    ["34 NORMAL PF just below 1.20 fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { profitFactor: 1.199999 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumProfitFactor").status).toBe("FAIL"); }],
    ["35 NO_TRADES PF path fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { profitFactor: null, profitFactorStatus: "NO_TRADES" }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumProfitFactor").status).toBe("FAIL"); }],
    ["36 NO_LOSSES PF path uses sample semantics", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { profitFactor: null, profitFactorStatus: "NO_LOSSES" }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumProfitFactor").status).toBe("PASS"); }],
    ["37 symbol concentration 0.50 passes", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { topSymbolShareOfPositiveNetR: 0.5 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumSymbolConcentration").status).toBe("PASS"); }],
    ["38 symbol concentration above 0.50 fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { topSymbolShareOfPositiveNetR: 0.500001 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumSymbolConcentration").status).toBe("FAIL"); }],
    ["39 null symbol concentration fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { topSymbolShareOfPositiveNetR: null }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumSymbolConcentration").status).toBe("FAIL"); }],
    ["40 single-trade concentration 0.10 passes", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { largestSingleTradeShareOfPositiveNetR: 0.1 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumSingleTradeConcentration").status).toBe("PASS"); }],
    ["41 single-trade concentration above 0.10 fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { largestSingleTradeShareOfPositiveNetR: 0.100001 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumSingleTradeConcentration").status).toBe("FAIL"); }],
    ["42 null single-trade concentration fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { largestSingleTradeShareOfPositiveNetR: null }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumSingleTradeConcentration").status).toBe("FAIL"); }],
    ["43 fee burden 0.75 passes", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { feeBurdenRatio: 0.75 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumFeeBurdenRatio").status).toBe("PASS"); }],
    ["44 fee burden above 0.75 fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { feeBurdenRatio: 0.750001 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumFeeBurdenRatio").status).toBe("FAIL"); }],
    ["45 null fee burden fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { feeBurdenRatio: null }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "maximumFeeBurdenRatio").status).toBe("FAIL"); }],
    ["46 aggregate formal signals 300 passes", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { formalSignals: 300 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumFormalSignals").status).toBe("PASS"); }],
    ["47 aggregate formal signals 299 fails", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { formalSignals: 299 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumFormalSignals").status).toBe("FAIL"); }],
    ["48 every fold with 30 trades passes", () => { const e = makeEvidence(); removeConvenienceFields(e); const folds = candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).folds as MutableRecord[]; for (const value of folds) { Object.assign(value.diagnostics as MutableRecord, { executedTrades: 30 }); } expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumExecutedTrades").status).toBe("PASS"); }],
    ["49 any fold with 29 trades fails", () => { const e = makeEvidence(); removeConvenienceFields(e); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, 0, { executedTrades: 29 }); expect(gate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "minimumExecutedTrades").status).toBe("FAIL"); }],
    ["50 redundancy is NOT_APPLICABLE", () => expect(gate(makeEvidence(), M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "requiredRedundancyImprovement").applicability).toBe("NOT_APPLICABLE")],
    ["51 redundancy N/A is not PASS", () => expect(gate(makeEvidence(), M3_R3_ROUND_003_CANDIDATE_IDS[0]!, "requiredRedundancyImprovement").status).toBe("NOT_APPLICABLE")],
    ["52 every candidate has 11 gate records", () => expect(result(makeEvidence(), M3_R3_ROUND_003_CANDIDATE_IDS[0]!).gateResults).toHaveLength(11)],
    ["53 applicable gate count is 10", () => expect(result(makeEvidence(), M3_R3_ROUND_003_CANDIDATE_IDS[0]!).applicableGateCount).toBe(10)],
    ["54 failed gates do not short-circuit", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: -0.2 }); expect(result(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).gateResults).toHaveLength(11); }],
    ["55 one failed applicable gate makes candidate ineligible", () => { const e = makeEvidence(); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { topSymbolShareOfPositiveNetR: 0.6 }); expect(result(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).eligibility).toBe("INELIGIBLE"); }],
    ["56 all ten applicable gates pass makes candidate eligible", () => expect(result(makeEvidence(), M3_R3_ROUND_003_CANDIDATE_IDS[0]!).eligibility).toBe("ELIGIBLE")],
    ["57 zero eligible candidates has exact decision", () => { const e = makeEvidence(); removeConvenienceFields(e); for (const id of M3_R3_ROUND_003_CANDIDATE_IDS) aggregate(e, id, { formalSignals: 0 }); const value = evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256); expect(value.finalDecision).toBe("NO BASELINE-002 CANDIDATE — ROUND-003"); }],
    ["58 zero eligible candidates has null selection", () => { const e = makeEvidence(); removeConvenienceFields(e); for (const id of M3_R3_ROUND_003_CANDIDATE_IDS) aggregate(e, id, { formalSignals: 0 }); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).selectedCandidateId).toBeNull(); }],
    ["59 higher improved fold count wins", () => { const e = passingPair(M3_R3_ROUND_003_CANDIDATE_IDS[0]!, M3_R3_ROUND_003_CANDIDATE_IDS[1]!); for (const index of [4, 5]) fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, index, { expectancyR: 0.1 }); fold(e, M3_R3_ROUND_003_CANDIDATE_IDS[1]!, 5, { expectancyR: 0.1 }); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).selectedCandidateId).toBe(M3_R3_ROUND_003_CANDIDATE_IDS[1]); }],
    ["60 expectancy difference above 0.01 wins", () => { const e = passingPair(M3_R3_ROUND_003_CANDIDATE_IDS[0]!, M3_R3_ROUND_003_CANDIDATE_IDS[1]!); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: 0.2 }); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[1]!, { expectancyR: 0.3 }); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).selectedCandidateId).toBe(M3_R3_ROUND_003_CANDIDATE_IDS[1]); }],
    ["61 expectancy difference exactly 0.01 uses complexity", () => { const e = passingPair(M3_R3_ROUND_003_CANDIDATE_IDS[0]!, M3_R3_ROUND_003_CANDIDATE_IDS[1]!); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: 0.2 }); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[1]!, { expectancyR: 0.21 }); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).selectedCandidateId).toBe(M3_R3_ROUND_003_CANDIDATE_IDS[0]); }],
    ["62 expectancy difference below 0.01 uses complexity", () => { const e = passingPair(M3_R3_ROUND_003_CANDIDATE_IDS[0]!, M3_R3_ROUND_003_CANDIDATE_IDS[1]!); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!, { expectancyR: 0.2 }); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[1]!, { expectancyR: 0.205 }); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).selectedCandidateId).toBe(M3_R3_ROUND_003_CANDIDATE_IDS[0]); }],
    ["63 complexity tuple is lexicographic", () => { const e = passingPair("R2-H8-RECENT-PULLBACK", "R2-H10-BREAKOUT-010"); removeConvenienceFields(e); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).selectedCandidateId).toBe("R2-H10-BREAKOUT-010"); }],
    ["64 PF breaks an equal-complexity tie", () => { const e = passingPair("R2-H8-RECENT-PULLBACK", "R2-H10-BREAKOUT-010"); removeConvenienceFields(e); aggregate(e, "R2-H8-RECENT-PULLBACK", { profitFactor: 1.3 }); aggregate(e, "R2-H10-BREAKOUT-010", { profitFactor: 1.4 }); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).selectedCandidateId).toBe("R2-H10-BREAKOUT-010"); }],
    ["65 candidateId is the final tiebreak", () => { const e = passingPair("R2-H8-RECENT-PULLBACK", "R2-H10-BREAKOUT-010"); removeConvenienceFields(e); aggregate(e, "R2-H8-RECENT-PULLBACK", { profitFactor: 1.4 }); aggregate(e, "R2-H10-BREAKOUT-010", { profitFactor: 1.4 }); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).selectedCandidateId).toBe("R2-H10-BREAKOUT-010"); }],
    ["66 ineligible candidates never enter tie selection", () => { const e = passingPair(M3_R3_ROUND_003_CANDIDATE_IDS[0]!, M3_R3_ROUND_003_CANDIDATE_IDS[1]!); removeConvenienceFields(e); aggregate(e, M3_R3_ROUND_003_CANDIDATE_IDS[1]!, { formalSignals: 0 }); const value = evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256); expect(value.selectedCandidateId).toBe(M3_R3_ROUND_003_CANDIDATE_IDS[0]); expect(value.eligibleCandidateIds).toEqual([M3_R3_ROUND_003_CANDIDATE_IDS[0]]); }],
    ["67 candidate registry order is retained", () => expect(evaluateM3R3CSelection(makeEvidence(), M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).candidates.map((value) => value.candidateId)).toEqual([...M3_R3_ROUND_003_CANDIDATE_IDS])],
    ["68 wrong raw evidence SHA fails closed", () => expect(evaluateM3R3CSelection(makeEvidence(), "0".repeat(64)).finalDecision).toBe("INCOMPLETE_EVIDENCE")],
    ["69 missing aggregate diagnostics fails closed", () => { const e = makeEvidence(); delete (candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).aggregateValidation as MutableRecord).diagnostics; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["70 missing fold fails closed", () => { const e = makeEvidence(); (candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).folds as MutableRecord[]).pop(); expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["71 wrong fold role fails closed", () => { const e = makeEvidence(); (candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).folds as MutableRecord[])[0]!.foldRole = "RESEARCH"; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["72 wrong frozen fold range fails closed", () => { const e = makeEvidence(); ((candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!).folds as MutableRecord[])[0]!.range as MutableRecord).startTime = 99; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["73 duplicate identity hashes fail closed", () => { const e = makeEvidence(); const first = candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[0]!); const second = candidate(e, M3_R3_ROUND_003_CANDIDATE_IDS[1]!); second.formalIdentitySha256 = first.formalIdentitySha256; expect(evaluateM3R3CSelection(e, M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256).finalDecision).toBe("INCOMPLETE_EVIDENCE"); }],
    ["74 output report includes baseline status", () => { const e = makeEvidence(); const report = createM3R3CSelectionReport({ evidence: e, inputEvidencePath: "docs/evidence/M3_R3_ROUND_003_SUMMARY.json", inputEvidenceSha256: M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256, executionSourceSha: "a".repeat(40) }); expect(report.baseline002Status).toBe(M3_R3_C_BASELINE_002_STATUS); expect(report.m3JStatus).toBe(M3_R3_C_M3_J_STATUS); expect(report.m4Status).toBe(M3_R3_C_M4_STATUS); }],
    ["75 serialization is deterministic", () => { const e = makeEvidence(); const input = { evidence: e, inputEvidencePath: "input", inputEvidenceSha256: M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256, executionSourceSha: "a".repeat(40) }; expect(serializeM3R3CSelectionReport(createM3R3CSelectionReport(input))).toBe(serializeM3R3CSelectionReport(createM3R3CSelectionReport(input))); }],
    ["76 markdown shows all 11 gate statuses", () => { const e = makeEvidence(); const report = createM3R3CSelectionReport({ evidence: e, inputEvidencePath: "input", inputEvidenceSha256: M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256, executionSourceSha: "a".repeat(40) }); const markdown = renderM3R3CSelectionMarkdown(report, "b".repeat(64)); expect((markdown.match(/- [a-zA-Z]+[A-Za-z]+:/g) ?? []).length).toBeGreaterThanOrEqual(99); }],
    ["77 markdown records the selection JSON SHA", () => { const e = makeEvidence(); const report = createM3R3CSelectionReport({ evidence: e, inputEvidencePath: "input", inputEvidenceSha256: M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256, executionSourceSha: "a".repeat(40) }); expect(renderM3R3CSelectionMarkdown(report, "b".repeat(64))).toContain("m3R3CSelectionSha256: "); }],
    ["78 selection module has no network fetch", () => { const source = readFileSync("src/lib/research/m3-r3-c-selection.ts", "utf8"); expect(source).not.toMatch(/\bfetch\s*\(/u); }],
    ["79 selection module has no backtest execution imports", () => { const source = readFileSync("src/lib/research/m3-r3-c-selection.ts", "utf8"); expect(source).not.toContain("runBacktest"); expect(source).not.toContain("evaluateStrategy"); expect(source).not.toContain("historical-loader"); }],
    ["80 selection script has no Binance or historical execution path", () => { const source = readFileSync("scripts/m3-r3-c-select.ts", "utf8"); expect(source).not.toContain("Binance"); expect(source).not.toContain("runBacktest"); expect(source).not.toContain("settlement"); expect(source).not.toContain("funding"); }],
    ["81 selection script is not part of npm test", () => { const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }; expect(packageJson.scripts.test).not.toContain("m3-r3-c-select"); }],
    ["82 gate and plan validators remain canonical", () => { expect(validateM3R3Round003MachineRecord().researchRoundId).toBe(M3_R3_ROUND_003_RESEARCH_ROUND_ID); expect(validateM3R3Round003Plan().researchRoundId).toBe(M3_R3_ROUND_003_RESEARCH_ROUND_ID); }],
  ];

  for (const [name, test] of cases) it(name, test);
});
