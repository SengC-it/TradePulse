import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { RESEARCH_FOLDS } from "../src/lib/research/folds.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES,
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
} from "../src/lib/research/selection-gates-round-004.ts";
import {
  M3_R5_DATA_CLASSIFICATION,
  M3_R5_RESEARCH_END_ISO,
  M3_R5_RESEARCH_RANGE,
  M3_R5_RESEARCH_START_ISO,
} from "../src/lib/research/m3-r5-round-005-protocol.ts";
import {
  M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_CANDIDATE_IDS,
  M3_R5_ROUND_005_COMPLEXITY_TUPLES,
  M3_R5_ROUND_005_CONTROL_ID,
  M3_R5_ROUND_005_DEFINITIONS,
  M3_R5_ROUND_005_EXCLUDED_CANDIDATES,
  M3_R5_ROUND_005_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_INVALIDATING_CATEGORIES,
  M3_R5_ROUND_005_MACHINE_RECORD,
  M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME,
  M3_R5_ROUND_005_PERFORMANCE_LOCK,
  M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
  M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
  M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  M3_R5_ROUND_005_REDUNDANCY_APPLICABILITY,
  M3_R5_ROUND_005_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_SELECTION_GATES,
  M3_R5_ROUND_005_SOURCE_SHA,
  validateM3R5Round005MachineRecord,
} from "../src/lib/research/selection-gates-round-005.ts";
import {
  M3_R5_ROUND_005_PLAN,
  M3_R5_ROUND_005_PLAN_CANONICAL_JSON,
  M3_R5_ROUND_005_PLAN_SCHEMA_VERSION,
  M3_R5_ROUND_005_PLAN_SHA256,
  M3_R5_ROUND_005_POLICY_VERSION,
  M3_R5_ROUND_005_STRATEGY_VERSION,
  validateM3R5Round005Plan,
} from "../src/lib/research/m3-r5-round-005-plan.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const qualificationJsonPath = "docs/evidence/M3_R5_H17_DATA_QUALIFICATION.json";
const qualificationMarkdownPath = "docs/M3_R5_H17_DATA_QUALIFICATION.md";
const qualification = JSON.parse(readFileSync(qualificationJsonPath, "utf8")) as {
  schemaVersion: string;
  researchRoundId: string;
  sourceSha: string;
  requestedStartTime: number;
  requestedEndTime: number;
  requestedStartIso: string;
  requestedEndIso: string;
  qualificationStatus: string;
  h17DataQualification: string;
  symbols: Array<{
    symbol: string;
    expectedCanonicalSlotCount: number;
    observedCanonicalSlotCount: number;
    missingCanonicalSlotCount: number;
    duplicateSlotCount: number;
    extraNonCanonicalCount: number;
    sourceChronological: boolean;
    paginationComplete: boolean;
    pageCount: number;
    terminationReason: string;
    manifestChecksumVerified: boolean;
    qualificationStatus: string;
  }>;
};

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("M3-R5-B.1B-F final registry, Gate, and Plan freeze", () => {
  it("preserves the authoritative H17 JSON bytes", () => {
    expect(sha256(qualificationJsonPath)).toBe(M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256);
  });

  it("preserves the authoritative H17 Markdown bytes", () => {
    expect(sha256(qualificationMarkdownPath)).toBe(M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256);
  });

  it("parses the qualification with the frozen provenance and status", () => {
    expect(qualification.schemaVersion).toBe("m3-r5-h17-data-qualification-001");
    expect(qualification.researchRoundId).toBe(M3_R5_ROUND_005_RESEARCH_ROUND_ID);
    expect(qualification.sourceSha).toBe(M3_R5_ROUND_005_SOURCE_SHA);
    expect(qualification.requestedStartTime).toBe(1672531200000);
    expect(qualification.requestedEndTime).toBe(1786838399999);
    expect(qualification.requestedStartIso).toBe(M3_R5_RESEARCH_START_ISO);
    expect(qualification.requestedEndIso).toBe(M3_R5_RESEARCH_END_ISO);
    expect(qualification.qualificationStatus).toBe("DATA_NOT_AVAILABLE");
    expect(qualification.h17DataQualification).toBe("DATA_NOT_AVAILABLE");
  });

  it("records DATA_NOT_AVAILABLE diagnostics for all five symbols", () => {
    expect(qualification.symbols.map(({ symbol }) => symbol)).toEqual([...RESEARCH_SYMBOLS]);
    for (const diagnostic of qualification.symbols) {
      expect(diagnostic.expectedCanonicalSlotCount).toBe(3969);
      expect(diagnostic.observedCanonicalSlotCount).toBe(2556);
      expect(diagnostic.missingCanonicalSlotCount).toBe(1413);
      expect(diagnostic.duplicateSlotCount).toBe(0);
      expect(diagnostic.extraNonCanonicalCount).toBe(1413);
      expect(diagnostic.sourceChronological).toBe(true);
      expect(diagnostic.paginationComplete).toBe(true);
      expect(diagnostic.pageCount).toBe(4);
      expect(diagnostic.terminationReason).toBe("SHORT_PAGE");
      expect(diagnostic.manifestChecksumVerified).toBe(true);
      expect(diagnostic.qualificationStatus).toBe("DATA_NOT_AVAILABLE");
    }
  });

  it("validates the frozen Gate and Plan machine records", () => {
    expect(validateM3R5Round005MachineRecord()).toBe(M3_R5_ROUND_005_MACHINE_RECORD);
    expect(validateM3R5Round005Plan()).toBe(M3_R5_ROUND_005_PLAN);
  });

  it("freezes the exact standalone performance registry", () => {
    expect(M3_R5_ROUND_005_CANDIDATE_IDS).toEqual([
      "R5-H15-HTF-TREND",
      "R5-H16-NEUTRAL-MEAN-REVERSION",
      "R5-H18-COMPRESSION-EXPANSION",
    ]);
    expect(M3_R5_ROUND_005_CANDIDATE_IDS).not.toContain("R5-H17-FUNDING-REVERSAL");
    expect(M3_R5_ROUND_005_CONTROL_ID).toBe("R5-CONTROL-BASELINE-001");
    expect(M3_R5_ROUND_005_EXCLUDED_CANDIDATES).toEqual([{
      candidateId: "R5-H17-FUNDING-REVERSAL",
      status: "DATA_NOT_AVAILABLE",
      performanceEligible: false,
      exclusionReason: "H17_DATA_QUALIFICATION_DATA_NOT_AVAILABLE",
      qualificationSourceSha: M3_R5_ROUND_005_SOURCE_SHA,
      qualificationJsonSha256: M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
      qualificationMarkdownSha256: M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
    }]);
  });

  it("rejects H17 if a future edit tries to add it to the Gate registry", () => {
    const altered = JSON.parse(JSON.stringify(M3_R5_ROUND_005_MACHINE_RECORD)) as { candidateIds: string[] };
    altered.candidateIds.push("R5-H17-FUNDING-REVERSAL");
    expect(() => validateM3R5Round005MachineRecord(altered as never)).toThrow();
  });

  it("rejects H17 if a future edit tries to add it to the Plan registry", () => {
    const altered = JSON.parse(JSON.stringify(M3_R5_ROUND_005_PLAN)) as { candidateIds: string[] };
    altered.candidateIds.push("R5-H17-FUNDING-REVERSAL");
    expect(() => validateM3R5Round005Plan(altered as never)).toThrow();
  });

  it("inherits all Round-004 Gate values and formulas without weakening them", () => {
    expect(M3_R5_ROUND_005_SELECTION_GATES).toEqual({
      ...BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES,
      researchRoundId: M3_R5_ROUND_005_RESEARCH_ROUND_ID,
      sourceSha: M3_R5_ROUND_005_SOURCE_SHA,
    });
    expect(M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256).toBe(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256);
    expect(M3_R5_ROUND_005_DEFINITIONS.hardGateIdentities).toEqual(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.hardGateIdentities);
  });

  it("freezes eleven hard-gate identities and ten applicable gates", () => {
    expect(M3_R5_ROUND_005_HARD_GATE_IDENTITIES).toHaveLength(11);
    expect(M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES).toHaveLength(10);
    expect(M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES).not.toContain("requiredRedundancyImprovement");
    expect(M3_R5_ROUND_005_HARD_GATE_IDENTITIES).toEqual(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.hardGateIdentities);
  });

  it("marks redundancy NOT_APPLICABLE for every performance candidate", () => {
    expect(M3_R5_ROUND_005_REDUNDANCY_APPLICABILITY).toEqual({
      "R5-H15-HTF-TREND": "NOT_APPLICABLE",
      "R5-H16-NEUTRAL-MEAN-REVERSION": "NOT_APPLICABLE",
      "R5-H18-COMPRESSION-EXPANSION": "NOT_APPLICABLE",
    });
    expect(M3_R5_ROUND_005_DEFINITIONS.redundancyApplicability.notApplicableCountsAsPass).toBe(false);
  });

  it.each([
    ["minimumAggregateImprovement", 0.1],
    ["minimumImprovedValidationFolds", 4],
    ["catastrophicFoldLimit", 0],
    ["minimumNetExpectancy", 0.03],
    ["minimumProfitFactor", 1.2],
    ["maximumSymbolConcentration", 0.5],
    ["maximumSingleTradeConcentration", 0.1],
    ["maximumFeeBurdenRatio", 0.75],
    ["requiredRedundancyImprovement", 0.3],
    ["minimumFormalSignals", 300],
    ["minimumExecutedTrades", 30],
  ] as const)("freezes the %s threshold at %s", (gate, value) => {
    expect(M3_R5_ROUND_005_SELECTION_GATES[gate].value).toBe(value);
  });

  it("freezes grossR null/zero and fee-burden fail-closed semantics", () => {
    expect(M3_R5_ROUND_005_SELECTION_GATES.maximumFeeBurdenRatio.denominator).toContain("grossR == 0 or null fails");
    expect(M3_R5_ROUND_005_SELECTION_GATES.maximumFeeBurdenRatio.comparison).toBe("AT_MOST");
  });

  it("freezes fold, catastrophic, and profit-factor boundary semantics", () => {
    expect(M3_R5_ROUND_005_DEFINITIONS.foldImprovementDeltaR).toBe(0.02);
    expect(M3_R5_ROUND_005_DEFINITIONS.validationFoldCount).toBe(6);
    expect(M3_R5_ROUND_005_DEFINITIONS.catastrophicFold.expectancyRAtMost).toBe(-0.1);
    expect(M3_R5_ROUND_005_DEFINITIONS.catastrophicFold.normalProfitFactorBelow).toBe(0.8);
    expect(M3_R5_ROUND_005_DEFINITIONS.catastrophicFold.noTradesIsCatastrophic).toBe(true);
    expect(M3_R5_ROUND_005_DEFINITIONS.profitFactorStatusSemantics.NO_LOSSES).toContain("ALL_SAMPLE_GATES");
    expect(M3_R5_ROUND_005_DEFINITIONS.profitFactorStatusSemantics.NO_TRADES).toBe("FAIL");
  });

  it("freezes concentration, signal, and per-fold sample floors", () => {
    expect(M3_R5_ROUND_005_SELECTION_GATES.maximumSymbolConcentration.value).toBe(0.5);
    expect(M3_R5_ROUND_005_SELECTION_GATES.maximumSingleTradeConcentration.value).toBe(0.1);
    expect(M3_R5_ROUND_005_SELECTION_GATES.maximumFeeBurdenRatio.value).toBe(0.75);
    expect(M3_R5_ROUND_005_SELECTION_GATES.minimumFormalSignals.value).toBe(300);
    expect(M3_R5_ROUND_005_SELECTION_GATES.minimumExecutedTrades.value).toBe(30);
  });

  it("keeps the exact inclusive boundary directions for all acceptance examples", () => {
    expect(0.1 >= M3_R5_ROUND_005_SELECTION_GATES.minimumAggregateImprovement.value).toBe(true);
    expect(0.02 >= M3_R5_ROUND_005_DEFINITIONS.foldImprovementDeltaR).toBe(true);
    expect(-0.1 <= M3_R5_ROUND_005_DEFINITIONS.catastrophicFold.expectancyRAtMost).toBe(true);
    expect(0.8 < M3_R5_ROUND_005_DEFINITIONS.catastrophicFold.normalProfitFactorBelow).toBe(false);
    expect(0.79 < M3_R5_ROUND_005_DEFINITIONS.catastrophicFold.normalProfitFactorBelow).toBe(true);
    expect(0.03 >= M3_R5_ROUND_005_SELECTION_GATES.minimumNetExpectancy.value).toBe(true);
    expect(1.2 >= M3_R5_ROUND_005_SELECTION_GATES.minimumProfitFactor.value).toBe(true);
    expect(0.5 <= M3_R5_ROUND_005_SELECTION_GATES.maximumSymbolConcentration.value).toBe(true);
    expect(0.1 <= M3_R5_ROUND_005_SELECTION_GATES.maximumSingleTradeConcentration.value).toBe(true);
    expect(0.75 <= M3_R5_ROUND_005_SELECTION_GATES.maximumFeeBurdenRatio.value).toBe(true);
    expect(300 >= M3_R5_ROUND_005_SELECTION_GATES.minimumFormalSignals.value).toBe(true);
    expect(30 >= M3_R5_ROUND_005_SELECTION_GATES.minimumExecutedTrades.value).toBe(true);
  });

  it("freezes the three candidate complexity tuples", () => {
    expect(M3_R5_ROUND_005_COMPLEXITY_TUPLES).toEqual({
      "R5-H15-HTF-TREND": { newRules: 3, newTunableThresholds: 3, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 },
      "R5-H16-NEUTRAL-MEAN-REVERSION": { newRules: 4, newTunableThresholds: 5, modifiedBaselineRules: 4, mechanismFamiliesUsed: 1 },
      "R5-H18-COMPRESSION-EXPANSION": { newRules: 4, newTunableThresholds: 4, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 },
    });
  });

  it("freezes conjunctive eligibility, no early exit, and the selection order", () => {
    expect(M3_R5_ROUND_005_DEFINITIONS.allApplicableGatesConjunctive).toBe(true);
    expect(M3_R5_ROUND_005_DEFINITIONS.noEarlyEligibilityExit).toBe(true);
    expect(M3_R5_ROUND_005_DEFINITIONS.selectionAlgorithm.complexityTieThresholdR).toBe(0.01);
    expect(M3_R5_ROUND_005_DEFINITIONS.selectionAlgorithm.orderedCriteria).toEqual([
      { criterion: "improvedValidationFolds", direction: "DESCENDING" },
      { criterion: "aggregateValidationExpectancyR", direction: "DESCENDING_IF_DIFFERENCE_GT_COMPLEXITY_TIE_THRESHOLD" },
      { criterion: "complexityTuple", direction: "LEXICOGRAPHIC_ASCENDING" },
      { criterion: "aggregateValidationProfitFactor", direction: "DESCENDING" },
      { criterion: "candidateId", direction: "LEXICOGRAPHIC_ASCENDING" },
    ]);
  });

  it("freezes the exact no-candidate outcome", () => {
    expect(M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME).toBe("NO BASELINE-002 CANDIDATE — ROUND-005");
    expect(M3_R5_ROUND_005_DEFINITIONS.noCandidateOutcome).toBe(M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME);
    expect(M3_R5_ROUND_005_PLAN.selection.noCandidateOutcome).toBe(M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME);
  });

  it("freezes the performance lock and invalidation categories", () => {
    expect(M3_R5_ROUND_005_PERFORMANCE_LOCK).toBe("FIRST_M3_R5_PERFORMANCE_RESULT_GENERATED");
    expect(M3_R5_ROUND_005_DEFINITIONS.roundImmutability.becomesImmutableAt).toBe(M3_R5_ROUND_005_PERFORMANCE_LOCK);
    expect(M3_R5_ROUND_005_DEFINITIONS.roundImmutability.actionOnChange).toBe("ROUND_005_INVALIDATION_REQUIRED");
    expect(M3_R5_ROUND_005_INVALIDATING_CATEGORIES).toContain("H17_QUALIFICATION_STATUS");
    expect(M3_R5_ROUND_005_INVALIDATING_CATEGORIES).toContain("CANDIDATE_AVAILABILITY_RULE");
  });

  it("pins the Round-005 range, seen-data classification, symbols, and folds", () => {
    expect(M3_R5_ROUND_005_PLAN_SCHEMA_VERSION).toBe("m3-r5-round-005-plan-001");
    expect(M3_R5_ROUND_005_PLAN.researchRoundId).toBe(M3_R5_ROUND_005_RESEARCH_ROUND_ID);
    expect(M3_R5_ROUND_005_PLAN.sourceSha).toBe(M3_R5_ROUND_005_SOURCE_SHA);
    expect(M3_R5_ROUND_005_PLAN.dataClassification).toBe(M3_R5_DATA_CLASSIFICATION);
    expect(M3_R5_ROUND_005_PLAN.researchUniverse).toEqual({
      startTime: M3_R5_RESEARCH_RANGE.startTime,
      endTime: M3_R5_RESEARCH_RANGE.endTime,
      startIso: M3_R5_RESEARCH_START_ISO,
      endIso: M3_R5_RESEARCH_END_ISO,
      rule: "RESEARCH_AVAILABLE_SEEN_DATA",
    });
    expect(M3_R5_ROUND_005_PLAN.symbols).toEqual([...RESEARCH_SYMBOLS]);
    expect(M3_R5_ROUND_005_PLAN.folds).toEqual(RESEARCH_FOLDS);
  });

  it("pins baseline-001, bt-policy-003, and the control report schema", () => {
    expect(M3_R5_ROUND_005_STRATEGY_VERSION).toBe("baseline-001");
    expect(M3_R5_ROUND_005_POLICY_VERSION).toBe("bt-policy-003");
    expect(M3_R5_ROUND_005_PLAN.control.strategyVersion).toBe("baseline-001");
    expect(M3_R5_ROUND_005_PLAN.control.backtestPolicyVersion).toBe("bt-policy-003");
    expect(M3_R5_ROUND_005_PLAN.control.reportSchemaVersion).toBe("m3-b-report-004");
  });

  it("keeps performance unauthorized and does not predeclare an execution SHA", () => {
    expect(M3_R5_ROUND_005_PLAN.performance.status).toBe("NOT_GENERATED");
    expect(M3_R5_ROUND_005_PLAN.performance.authorization).toBe("NOT_AUTHORIZED");
    expect(Object.prototype.hasOwnProperty.call(M3_R5_ROUND_005_PLAN.performance, "executionSourceSha")).toBe(false);
    expect(M3_R5_ROUND_005_PLAN.governance.oneAuthoritativePerformanceExecutionOnlyLater).toBe(true);
  });

  it("keeps combinations, tuning, optimizer, random search, sweep, and replacement prohibited", () => {
    expect(M3_R5_ROUND_005_PLAN.governance).toMatchObject({
      noCombinations: true,
      noTuning: true,
      noOptimizer: true,
      noRandomSearch: true,
      noThresholdSweep: true,
      noPostResultCandidateReplacement: true,
    });
    expect(M3_R5_ROUND_005_PLAN.governance.noFutureDataAfter).toBe(M3_R5_RESEARCH_END_ISO);
  });

  it("keeps H17 qualification provenance and status fail-closed", () => {
    expect(M3_R5_ROUND_005_PLAN.h17).toEqual({
      status: "DATA_NOT_AVAILABLE",
      performanceEligible: false,
      exclusionReason: "H17_DATA_QUALIFICATION_DATA_NOT_AVAILABLE",
      qualificationSourceSha: M3_R5_ROUND_005_SOURCE_SHA,
      qualificationJsonSha256: M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
      qualificationMarkdownSha256: M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
    });
    expect(M3_R5_ROUND_005_DEFINITIONS.h17Qualification.performanceEligible).toBe(false);
    expect(M3_R5_ROUND_005_DEFINITIONS.h17Qualification.status).toBe("DATA_NOT_AVAILABLE");
  });

  it("keeps the Round-005 Gate canonical hash deterministic", () => {
    expect(createHash("sha256").update(stableStringify(M3_R5_ROUND_005_MACHINE_RECORD), "utf8").digest("hex")).toBe(M3_R5_ROUND_005_SELECTION_GATE_SHA256);
    expect(M3_R5_ROUND_005_SELECTION_GATE_SHA256).toBe("e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5");
  });

  it("keeps the Round-005 Plan canonical hash deterministic", () => {
    expect(createHash("sha256").update(M3_R5_ROUND_005_PLAN_CANONICAL_JSON, "utf8").digest("hex")).toBe(M3_R5_ROUND_005_PLAN_SHA256);
    expect(M3_R5_ROUND_005_PLAN_SHA256).toBe("ab16a63462825441e00682f2b2bcbe04cb249e469843ce7f9a097017d992b6d1");
  });

  it("keeps the milestone status boundary closed", () => {
    expect(M3_R5_ROUND_005_PLAN.status).toEqual({
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
    });
  });
});
