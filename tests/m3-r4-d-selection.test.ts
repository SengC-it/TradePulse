import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { getResearchFoldRoleRange } from "../src/lib/research/folds.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
  M3_R4_ROUND_004_CANDIDATE_IDS,
  M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME,
  M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  validateM3R4Round004MachineRecord,
} from "../src/lib/research/selection-gates-round-004.ts";
import {
  M3_R4_ROUND_004_PLAN,
  M3_R4_ROUND_004_PLAN_SHA256,
  validateM3R4Round004Plan,
} from "../src/lib/research/m3-r4-round-004-plan.ts";
import {
  M3_R4_D_BASELINE_002_STATUS,
  M3_R4_D_EXPECTED_DECISION,
  M3_R4_D_EXPECTED_INPUT_AUDIT_SHA256,
  M3_R4_D_EXPECTED_INPUT_RESULTS_SHA256,
  M3_R4_D_EXPECTED_INPUT_SUMMARY_SHA256,
  M3_R4_D_EXPECTED_PERFORMANCE_EXECUTION_SOURCE_SHA,
  M3_R4_D_M3_J_STATUS,
  M3_R4_D_M4_STATUS,
  M3_R4_D_SELECTION_SCHEMA_VERSION,
  type M3R4DIdentitySignal,
  createM3R4DSelectionReport,
  evaluateM3R4DSelection,
  hashM3R4DIdentityRecords,
  publishM3R4DSelectionOutputsAtomically,
  renderM3R4DSelectionMarkdown,
  serializeM3R4DSelectionReport,
} from "../src/lib/research/m3-r4-d-selection.ts";
import { parseM3R4DSelectionArguments, validateM3R4DAuthoritativeSource } from "../scripts/m3-r4-d-select.ts";

type MutableRecord = Record<string, unknown>;

const FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;
const UNIVERSE = M3_R4_ROUND_004_PLAN.researchUniverse;
const F1_VALIDATION = getResearchFoldRoleRange("F1", "VALIDATION");
const AGGREGATE_RANGE = {
  startTime: getResearchFoldRoleRange("F1", "VALIDATION").startTime,
  endTime: getResearchFoldRoleRange("F6", "VALIDATION").endTime,
};
const D2_GATE_APPLICATION_SOURCE_SHA = "f".repeat(40);

function signal(overrides: MutableRecord = {}): MutableRecord {
  return {
    signalTime: F1_VALIDATION.startTime,
    symbol: "BTCUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_STRONG_BULL",
    totalScore: 80,
    grade: "B",
    status: "EXECUTED",
    entryTime: F1_VALIDATION.startTime + 1,
    exitTime: F1_VALIDATION.startTime + 3_600_001,
    grossR: 0.2,
    feeR: 0.01,
    fundingR: 0.01,
    netR: 0.18,
    ...overrides,
  };
}

function diagnostics(range: MutableRecord, overrides: MutableRecord = {}): MutableRecord {
  return {
    range,
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

function candidate(candidateId: string, control = false): MutableRecord {
  const current = signal();
  const records = [current];
  const folds = FOLD_IDS.map((foldId) => {
    const range = getResearchFoldRoleRange(foldId, "VALIDATION");
    return {
      foldId,
      validation: {
        range,
        records: foldId === "F1" ? records : [],
        diagnostics: diagnostics(range, { expectancyR: control ? 0 : 0.13 }),
      },
    };
  });
  return {
    candidateId,
    fullSeenUniverse: {
      range: UNIVERSE,
      records,
      diagnostics: diagnostics(UNIVERSE, { expectancyR: control ? 0 : 0.15 }),
    },
    folds,
    aggregateValidation: {
      segments: FOLD_IDS.map((foldId) => getResearchFoldRoleRange(foldId, "VALIDATION")),
      records,
      diagnostics: diagnostics(AGGREGATE_RANGE, { expectancyR: control ? 0 : 0.15 }),
    },
    formalIdentitySha256: hashM3R4DIdentityRecords(candidateId, records as unknown as readonly M3R4DIdentitySignal[]),
    executedIdentitySha256: hashM3R4DIdentityRecords(candidateId, records as unknown as readonly M3R4DIdentitySignal[], true),
  };
}

function evidence(): MutableRecord {
  return {
    schemaVersion: "m3-r4-round-004-report-001",
    researchRoundId: M3_R4_ROUND_004_RESEARCH_ROUND_ID,
    protocolBaseMainSha: "a".repeat(40),
    executionSourceSha: M3_R4_D_EXPECTED_PERFORMANCE_EXECUTION_SOURCE_SHA,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R4_ROUND_004_PLAN_SHA256,
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
    researchUniverse: UNIVERSE,
    performanceLock: "FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED",
    performanceLockTriggered: true,
    evidenceStatus: "COMPLETE",
    integrityErrors: [],
    auditArtifactSha256: "b".repeat(64),
    decision: M3_R4_D_EXPECTED_DECISION,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    control: candidate("CONTROL", true),
    candidates: M3_R4_ROUND_004_CANDIDATE_IDS.map((candidateId) => candidate(candidateId)),
  };
}

function candidateValue(value: MutableRecord, candidateId: string): MutableRecord {
  return (value.candidates as MutableRecord[]).find((item) => item.candidateId === candidateId)!;
}

function aggregate(value: MutableRecord, candidateId: string, changes: MutableRecord): void {
  Object.assign((candidateValue(value, candidateId).aggregateValidation as MutableRecord).diagnostics as MutableRecord, changes);
}

function fold(value: MutableRecord, candidateId: string, index: number, changes: MutableRecord): void {
  const folds = candidateValue(value, candidateId).folds as MutableRecord[];
  Object.assign((folds[index]!.validation as MutableRecord).diagnostics as MutableRecord, changes);
}

function inputHashes() {
  return {
    summary: M3_R4_D_EXPECTED_INPUT_SUMMARY_SHA256,
    audit: M3_R4_D_EXPECTED_INPUT_AUDIT_SHA256,
    results: M3_R4_D_EXPECTED_INPUT_RESULTS_SHA256,
  } as const;
}

function publicationFixture() {
  const root = mkdtempSync(join(process.cwd(), ".m3-r4-d-publication-"));
  const jsonPath = join(root, "evidence", "M3_R4_D_SELECTION.json");
  const markdownPath = join(root, "docs", "M3_R4_D_SELECTION.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  return {
    root,
    jsonPath,
    markdownPath,
    jsonBytes: Buffer.from('{"artifact":"json"}\n', "utf8"),
    markdownBytes: Buffer.from("# artifact\n", "utf8"),
  };
}

function result(value: MutableRecord, candidateId: string): ReturnType<typeof evaluateM3R4DSelection>["candidates"][number] {
  return evaluateM3R4DSelection(value, inputHashes()).candidates.find((item) => item.candidateId === candidateId)!;
}

describe("M3-R4-D.1 frozen Round-004 gate applicator", () => {
  it("freezes the D.1 schema and statuses", () => {
    expect(M3_R4_D_SELECTION_SCHEMA_VERSION).toBe("m3-r4-d-selection-001");
    expect(M3_R4_D_BASELINE_002_STATUS).toBe("NOT_FROZEN");
    expect(M3_R4_D_M3_J_STATUS).toBe("BLOCKED");
    expect(M3_R4_D_M4_STATUS).toBe("NOT_STARTED");
  });

  it("validates the canonical Gate and Plan", () => {
    expect(validateM3R4Round004MachineRecord().researchRoundId).toBe(M3_R4_ROUND_004_RESEARCH_ROUND_ID);
    expect(validateM3R4Round004Plan().schemaVersion).toBe("m3-r4-round-004-plan-001");
  });

  it("accepts a synthetic all-gates-pass fixture", () => {
    const evaluation = evaluateM3R4DSelection(evidence(), inputHashes());
    expect(evaluation.integrityStatus).toBe("COMPLETE");
    expect(evaluation.candidates).toHaveLength(4);
    expect(evaluation.candidates.every((item) => item.eligibility === "ELIGIBLE")).toBe(true);
    expect(evaluation.candidates[0]!.gateResults).toHaveLength(11);
    expect(evaluation.candidates[0]!.applicableGateCount).toBe(10);
  });

  it.each([
    ["minimumAggregateImprovement", () => ({ expectancyR: 0.099 })],
    ["minimumImprovedValidationFolds", () => ({ foldAll: { changes: { expectancyR: 0.019 } } })],
    ["catastrophicFoldLimit", () => ({ fold: { index: 0, changes: { expectancyR: -0.1 } } })],
    ["minimumNetExpectancy", () => ({ expectancyR: 0.029 })],
    ["minimumProfitFactor", () => ({ profitFactor: 1.199 })],
    ["maximumSymbolConcentration", () => ({ topSymbolShareOfPositiveNetR: 0.501 })],
    ["maximumSingleTradeConcentration", () => ({ largestSingleTradeShareOfPositiveNetR: 0.101 })],
    ["maximumFeeBurdenRatio", () => ({ feeBurdenRatio: 0.751 })],
    ["minimumFormalSignals", () => ({ formalSignals: 299 })],
    ["minimumExecutedTrades", () => ({ fold: { index: 0, changes: { executedTrades: 29 } } })],
  ] as const)("evaluates %s as an independent failing gate", (gateId, change) => {
    const value = evidence();
    const update = change();
    if ("foldAll" in update) for (const index of [0, 1, 2, 3, 4, 5]) fold(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, index, update.foldAll.changes);
    else if ("fold" in update) fold(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, update.fold.index, update.fold.changes);
    else aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, update);
    expect(result(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).gateResults.find((gate) => gate.gateId === gateId)?.status).toBe("FAIL");
  });

  it("accepts the exact inclusive boundaries for the numeric and sample gates", () => {
    const candidateId = M3_R4_ROUND_004_CANDIDATE_IDS[0]!;
    const expectGate = (value: MutableRecord, gateId: string) => expect(result(value, candidateId).gateResults.find((gate) => gate.gateId === gateId)?.status).toBe("PASS");

    const aggregateValue = evidence();
    aggregate(aggregateValue, candidateId, { expectancyR: 0.1 });
    expectGate(aggregateValue, "minimumAggregateImprovement");

    const expectancy = evidence();
    aggregate(expectancy, candidateId, { expectancyR: 0.03 });
    expectGate(expectancy, "minimumNetExpectancy");

    const profitFactor = evidence();
    aggregate(profitFactor, candidateId, { profitFactor: 1.2 });
    expectGate(profitFactor, "minimumProfitFactor");

    const symbolConcentration = evidence();
    aggregate(symbolConcentration, candidateId, { topSymbolShareOfPositiveNetR: 0.5 });
    expectGate(symbolConcentration, "maximumSymbolConcentration");

    const singleTradeConcentration = evidence();
    aggregate(singleTradeConcentration, candidateId, { largestSingleTradeShareOfPositiveNetR: 0.1 });
    expectGate(singleTradeConcentration, "maximumSingleTradeConcentration");

    const fee = evidence();
    aggregate(fee, candidateId, { feeBurdenRatio: 0.75 });
    expectGate(fee, "maximumFeeBurdenRatio");

    const zeroGross = evidence();
    aggregate(zeroGross, candidateId, { grossR: 0, feeBurdenRatio: 0 });
    expect(result(zeroGross, candidateId).gateResults.find((gate) => gate.gateId === "maximumFeeBurdenRatio")?.status).toBe("FAIL");

    const formalSignals = evidence();
    aggregate(formalSignals, candidateId, { formalSignals: 300 });
    expectGate(formalSignals, "minimumFormalSignals");

    const executedTrades = evidence();
    for (const index of [0, 1, 2, 3, 4, 5]) fold(executedTrades, candidateId, index, { executedTrades: 30 });
    expectGate(executedTrades, "minimumExecutedTrades");
  });

  it("uses the exact 0.02 improved-fold boundary", () => {
    const value = evidence();
    for (const index of [0, 1, 2, 3, 4, 5]) fold(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, index, { expectancyR: 0.02 });
    expect(result(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).metrics.improvedValidationFoldCount).toBe(6);
    for (const index of [0, 1, 2, 3, 4, 5]) fold(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, index, { expectancyR: 0.019999 });
    expect(result(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).metrics.improvedValidationFoldCount).toBe(0);
  });

  it("uses the exact catastrophic expectancy and PF boundaries", () => {
    const value = evidence();
    fold(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, 0, { expectancyR: -0.1 });
    expect(result(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).metrics.catastrophicFoldCount).toBe(1);
    const second = evidence();
    fold(second, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, 0, { profitFactor: 0.8 });
    expect(result(second, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).metrics.catastrophicFoldCount).toBe(0);
    fold(second, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, 0, { profitFactor: 0.799 });
    expect(result(second, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).metrics.catastrophicFoldCount).toBe(1);
  });

  it("applies NO_TRADES and NO_LOSSES PF semantics", () => {
    const noTrades = evidence();
    fold(noTrades, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, 0, { executedTrades: 0, profitFactor: null, profitFactorStatus: "NO_TRADES" });
    expect(result(noTrades, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).gateResults.find((gate) => gate.gateId === "catastrophicFoldLimit")?.status).toBe("FAIL");
    const noLosses = evidence();
    aggregate(noLosses, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, { profitFactor: null, profitFactorStatus: "NO_LOSSES" });
    expect(result(noLosses, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).gateResults.find((gate) => gate.gateId === "minimumProfitFactor")?.status).toBe("PASS");
    fold(noLosses, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, 0, { executedTrades: 29 });
    expect(result(noLosses, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).gateResults.find((gate) => gate.gateId === "minimumProfitFactor")?.status).toBe("FAIL");
  });

  it("fails closed when required diagnostics grossR is null", () => {
    const value = evidence();
    aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, { grossR: null });
    const evaluation = evaluateM3R4DSelection(value, inputHashes());
    expect(evaluation.finalDecision).toBe("INCOMPLETE_EVIDENCE");
    expect(evaluation.integrityErrors.some((error) => error.includes("grossR is invalid"))).toBe(true);
  });

  it("keeps redundancy NOT_APPLICABLE and outside eligibility", () => {
    const gate = result(evidence(), M3_R4_ROUND_004_CANDIDATE_IDS[0]!).gateResults.find((item) => item.gateId === "requiredRedundancyImprovement")!;
    expect(gate.applicability).toBe("NOT_APPLICABLE");
    expect(gate.status).toBe("NOT_APPLICABLE");
  });

  it("evaluates all gates after an early failure", () => {
    const value = evidence();
    aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, { expectancyR: -1 });
    const evaluation = result(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!);
    expect(evaluation.gateResults.map((gate) => gate.gateId)).toEqual([...BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.hardGateIdentities]);
    expect(evaluation.failedGateIds.length).toBeGreaterThan(1);
  });

  it("returns the exact no-candidate outcome", () => {
    const value = evidence();
    for (const candidateId of M3_R4_ROUND_004_CANDIDATE_IDS) aggregate(value, candidateId, { formalSignals: 0 });
    const evaluation = evaluateM3R4DSelection(value, inputHashes());
    expect(evaluation.eligibleCandidateIds).toEqual([]);
    expect(evaluation.selectionAlgorithmApplied).toBe(false);
    expect(evaluation.selectedCandidateId).toBeNull();
    expect(evaluation.finalDecision).toBe(M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME);
  });

  it("selects one eligible candidate only", () => {
    const value = evidence();
    for (const candidateId of M3_R4_ROUND_004_CANDIDATE_IDS.slice(1)) aggregate(value, candidateId, { formalSignals: 0 });
    const evaluation = evaluateM3R4DSelection(value, inputHashes());
    expect(evaluation.eligibleCandidateIds).toEqual([M3_R4_ROUND_004_CANDIDATE_IDS[0]]);
    expect(evaluation.selectedCandidateId).toBe(M3_R4_ROUND_004_CANDIDATE_IDS[0]);
  });

  it("uses more improved folds before expectancy", () => {
    const value = evidence();
    for (const candidateId of M3_R4_ROUND_004_CANDIDATE_IDS.slice(2)) aggregate(value, candidateId, { formalSignals: 0 });
    for (const index of [4, 5]) fold(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, index, { expectancyR: 0.01 });
    const evaluation = evaluateM3R4DSelection(value, inputHashes());
    expect(evaluation.selectedCandidateId).toBe(M3_R4_ROUND_004_CANDIDATE_IDS[1]);
  });

  it("uses expectancy only beyond the frozen complexity threshold", () => {
    const value = evidence();
    for (const candidateId of M3_R4_ROUND_004_CANDIDATE_IDS.slice(2)) aggregate(value, candidateId, { formalSignals: 0 });
    aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, { expectancyR: 0.3 });
    aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[1]!, { expectancyR: 0.15 });
    expect(evaluateM3R4DSelection(value, inputHashes()).selectedCandidateId).toBe(M3_R4_ROUND_004_CANDIDATE_IDS[0]);
    aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, { expectancyR: 0.16 });
    expect(evaluateM3R4DSelection(value, inputHashes()).selectedCandidateId).toBe(M3_R4_ROUND_004_CANDIDATE_IDS[1]);
    aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, { expectancyR: 0.159999 });
    expect(evaluateM3R4DSelection(value, inputHashes()).selectedCandidateId).toBe(M3_R4_ROUND_004_CANDIDATE_IDS[1]);
  });

  it("uses the frozen complexity tuple and then PF", () => {
    const value = evidence();
    for (const candidateId of M3_R4_ROUND_004_CANDIDATE_IDS.slice(2)) aggregate(value, candidateId, { formalSignals: 0 });
    aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[0]!, { profitFactor: 1.3 });
    aggregate(value, M3_R4_ROUND_004_CANDIDATE_IDS[1]!, { profitFactor: 1.4 });
    expect(evaluateM3R4DSelection(value, inputHashes()).selectedCandidateId).toBe(M3_R4_ROUND_004_CANDIDATE_IDS[1]);
  });

  it("fails closed on wrong provenance or malformed evidence", () => {
    expect(evaluateM3R4DSelection(evidence(), { ...inputHashes(), summary: "0".repeat(64) }).finalDecision).toBe("INCOMPLETE_EVIDENCE");
    const wrongGate = evidence();
    wrongGate.selectionGateSha256 = "0".repeat(64);
    expect(evaluateM3R4DSelection(wrongGate, inputHashes()).finalDecision).toBe("INCOMPLETE_EVIDENCE");
    const missing = evidence();
    delete (candidateValue(missing, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).aggregateValidation as MutableRecord).diagnostics;
    expect(evaluateM3R4DSelection(missing, inputHashes()).finalDecision).toBe("INCOMPLETE_EVIDENCE");
  });

  it("fails closed on wrong fold range, aggregate construction, and identity provenance", () => {
    const wrongRange = evidence();
    ((candidateValue(wrongRange, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).folds as MutableRecord[])[0]!.validation as MutableRecord).range = { startTime: 1, endTime: F1_VALIDATION.endTime };
    expect(evaluateM3R4DSelection(wrongRange, inputHashes()).finalDecision).toBe("INCOMPLETE_EVIDENCE");
    const wrongAggregate = evidence();
    (candidateValue(wrongAggregate, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).aggregateValidation as MutableRecord).records = [];
    expect(evaluateM3R4DSelection(wrongAggregate, inputHashes()).finalDecision).toBe("INCOMPLETE_EVIDENCE");
    const wrongIdentity = evidence();
    candidateValue(wrongIdentity, M3_R4_ROUND_004_CANDIDATE_IDS[0]!).formalIdentitySha256 = "0".repeat(64);
    expect(evaluateM3R4DSelection(wrongIdentity, inputHashes()).finalDecision).toBe("INCOMPLETE_EVIDENCE");
  });

  it("serializes reports deterministically and preserves D.1 statuses", () => {
    const input = { evidence: evidence(), inputSummaryPath: "input", inputHashes: inputHashes(), gateApplicationSourceSha: D2_GATE_APPLICATION_SOURCE_SHA };
    const first = createM3R4DSelectionReport(input);
    const second = createM3R4DSelectionReport(input);
    expect(serializeM3R4DSelectionReport(first)).toBe(serializeM3R4DSelectionReport(second));
    expect(first.baseline002Status).toBe(M3_R4_D_BASELINE_002_STATUS);
    expect(first.m3JStatus).toBe(M3_R4_D_M3_J_STATUS);
    expect(first.m4Status).toBe(M3_R4_D_M4_STATUS);
    expect(renderM3R4DSelectionMarkdown(first, "c".repeat(64))).toContain("m3R4DSelectionSha256:");
  });

  it("keeps performance provenance separate from the future D.2 source", () => {
    const report = createM3R4DSelectionReport({
      evidence: evidence(),
      inputSummaryPath: "input",
      inputHashes: inputHashes(),
      gateApplicationSourceSha: D2_GATE_APPLICATION_SOURCE_SHA,
    });
    expect(report.performanceExecutionSourceSha).toBe(M3_R4_D_EXPECTED_PERFORMANCE_EXECUTION_SOURCE_SHA);
    expect(report.gateApplicationSourceSha).toBe(D2_GATE_APPLICATION_SOURCE_SHA);
    expect(report.gateApplicationSourceSha).not.toBe(report.performanceExecutionSourceSha);
  });

  it("accepts a valid D.2 source at the current HEAD without equating it to performance", () => {
    expect(() => validateM3R4DAuthoritativeSource(D2_GATE_APPLICATION_SOURCE_SHA, D2_GATE_APPLICATION_SOURCE_SHA)).not.toThrow();
    expect(D2_GATE_APPLICATION_SOURCE_SHA).not.toBe(M3_R4_D_EXPECTED_PERFORMANCE_EXECUTION_SOURCE_SHA);
    expect(() => validateM3R4DAuthoritativeSource("e".repeat(40), D2_GATE_APPLICATION_SOURCE_SHA)).toThrow("source SHA mismatch");
  });

  it("rejects an invalid gate-application source in the report", () => {
    const report = createM3R4DSelectionReport({
      evidence: evidence(),
      inputSummaryPath: "input",
      inputHashes: inputHashes(),
      gateApplicationSourceSha: "not-a-sha",
    });
    expect(report.integrityStatus).toBe("INCOMPLETE_EVIDENCE");
    expect(report.finalDecision).toBe("INCOMPLETE_EVIDENCE");
  });

  it("fails closed when CLI authorization is missing", () => {
    expect(() => parseM3R4DSelectionArguments([])).toThrow("missing --confirm-authoritative-selection");
    expect(() => parseM3R4DSelectionArguments(["--confirm-authoritative-selection"])).toThrow("missing --source-sha");
  });

  it("does not create D.2 outputs and has no network/performance path", () => {
    const selectionSource = readFileSync("src/lib/research/m3-r4-d-selection.ts", "utf8");
    const scriptSource = readFileSync("scripts/m3-r4-d-select.ts", "utf8");
    expect(selectionSource).not.toMatch(/\bfetch\s*\(/u);
    expect(selectionSource).not.toContain("runBacktest");
    expect(selectionSource).not.toContain("Binance");
    expect(selectionSource).not.toContain("tmpdir(");
    expect(scriptSource).not.toContain("research:m3r4:performance");
    expect(scriptSource).not.toContain("Binance");
    expect(readFileSync("package.json", "utf8")).toContain("research:m3r4:select");
  });

  it("publishes exact bytes in Markdown-then-JSON order and cleans destination-local staging", () => {
    const fixture = publicationFixture();
    const order: string[] = [];
    let stagingDirectory = "";
    try {
      publishM3R4DSelectionOutputsAtomically(fixture, {
        onStagingDirectory: (path) => { stagingDirectory = path; },
        renameFile: (source, destination) => { order.push(destination); renameSync(source, destination); },
      });
      expect(order).toEqual([fixture.markdownPath, fixture.jsonPath]);
      expect(readFileSync(fixture.markdownPath)).toEqual(fixture.markdownBytes);
      expect(readFileSync(fixture.jsonPath)).toEqual(fixture.jsonBytes);
      expect(stagingDirectory).not.toBe("");
      expect(dirname(stagingDirectory)).toBe(dirname(fixture.jsonPath));
      expect(existsSync(stagingDirectory)).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rolls back all destinations when publication fails before the first rename", () => {
    const fixture = publicationFixture();
    let stagingDirectory = "";
    try {
      expect(() => publishM3R4DSelectionOutputsAtomically(fixture, {
        onStagingDirectory: (path) => { stagingDirectory = path; },
        renameFile: () => { throw new Error("before first publication"); },
      })).toThrow("before first publication");
      expect(existsSync(fixture.markdownPath)).toBe(false);
      expect(existsSync(fixture.jsonPath)).toBe(false);
      expect(stagingDirectory).not.toBe("");
      expect(existsSync(stagingDirectory)).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("rolls back Markdown when JSON publication fails and removes staging", () => {
    const fixture = publicationFixture();
    let stagingDirectory = "";
    let renameCount = 0;
    try {
      expect(() => publishM3R4DSelectionOutputsAtomically(fixture, {
        onStagingDirectory: (path) => { stagingDirectory = path; },
        renameFile: (source, destination) => {
          renameCount += 1;
          if (renameCount === 2) throw new Error("before JSON publication");
          renameSync(source, destination);
        },
      })).toThrow("before JSON publication");
      expect(existsSync(fixture.markdownPath)).toBe(false);
      expect(existsSync(fixture.jsonPath)).toBe(false);
      expect(stagingDirectory).not.toBe("");
      expect(existsSync(stagingDirectory)).toBe(false);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it.each(["json", "markdown"] as const)("rejects a pre-existing %s destination before staging", (existing) => {
    const fixture = publicationFixture();
    const existingPath = existing === "json" ? fixture.jsonPath : fixture.markdownPath;
    const oldBytes = Buffer.from(`old-${existing}\n`, "utf8");
    writeFileSync(existingPath, oldBytes);
    let stagingDirectory = "";
    try {
      expect(() => publishM3R4DSelectionOutputsAtomically(fixture, {
        onStagingDirectory: (path) => { stagingDirectory = path; },
      })).toThrow("already exists");
      expect(readFileSync(existingPath)).toEqual(oldBytes);
      expect(existsSync(existing === "json" ? fixture.markdownPath : fixture.jsonPath)).toBe(false);
      expect(stagingDirectory).toBe("");
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
