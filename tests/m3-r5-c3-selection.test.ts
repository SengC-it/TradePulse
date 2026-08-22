import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  M3_R5_C3A_EXPECTED_INPUT_AUDIT_SHA256,
  M3_R5_C3A_EXPECTED_INPUT_RESULTS_SHA256,
  M3_R5_C3A_EXPECTED_INPUT_SUMMARY_SHA256,
  M3_R5_C3A_SELECTION_SCHEMA_VERSION,
  compareM3R5C3ASelectionOrder,
  evaluateM3R5C3ASelection,
  hashM3R5C3AIdentityRecords,
  publishM3R5C3ASelectionOutputsAtomically,
  sha256M3R5C3ARawBytes,
  type M3R5C3AInputHashes,
  type M3R5C3ACandidateEvaluation,
} from "../src/lib/research/m3-r5-c3-selection.ts";
import {
  M3_R5_ROUND_005_CANDIDATE_IDS,
  M3_R5_ROUND_005_CONTROL_ID,
  M3_R5_ROUND_005_EXCLUDED_CANDIDATES,
  M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME,
  M3_R5_ROUND_005_PERFORMANCE_LOCK,
  M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  M3_R5_ROUND_005_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_SELECTION_GATES,
} from "../src/lib/research/selection-gates-round-005.ts";
import { M3_R5_ROUND_005_PLAN, M3_R5_ROUND_005_PLAN_SHA256 } from "../src/lib/research/m3-r5-round-005-plan.ts";
import { getResearchFoldRoleRange } from "../src/lib/research/folds.ts";
import {
  parseM3R5C3ASelectionArguments,
  validateM3R5C3AAuthoritativeSource,
  validateM3R5C3ACommittedBlobHash,
  validateM3R5C3AOutputsAbsent,
  validateM3R5C3AWorktreeStatus,
} from "../scripts/m3-r5-c3-select.ts";

type MutableRecord = Record<string, unknown>;
type FrozenRange = Readonly<{ startTime: number; endTime: number }>;

const INPUT_HASHES: M3R5C3AInputHashes = {
  summary: M3_R5_C3A_EXPECTED_INPUT_SUMMARY_SHA256,
  audit: M3_R5_C3A_EXPECTED_INPUT_AUDIT_SHA256,
  results: M3_R5_C3A_EXPECTED_INPUT_RESULTS_SHA256,
};

const FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;

function record(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected object");
  return value as MutableRecord;
}

function records(value: unknown): MutableRecord[] {
  if (!Array.isArray(value)) throw new Error("expected array");
  return value as MutableRecord[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function diagnostics(range: FrozenRange, overrides: MutableRecord = {}): MutableRecord {
  return {
    range: clone(range),
    formalSignals: 400,
    executedTrades: 40,
    grossR: 10,
    expectancyR: 0.15,
    profitFactor: 1.5,
    profitFactorStatus: "NORMAL",
    topSymbolShareOfPositiveNetR: 0.2,
    largestSingleTradeShareOfPositiveNetR: 0.05,
    feeBurdenRatio: 0.5,
    ...overrides,
  };
}

function signal(range: FrozenRange): MutableRecord {
  return {
    signalTime: range.startTime,
    symbol: "BTCUSDT",
    direction: "LONG",
    status: "EXECUTED",
  };
}

type CandidateOptions = Readonly<{
  aggregate?: MutableRecord;
  full?: MutableRecord;
  folds?: readonly MutableRecord[];
  aggregateExpectancy?: number;
  foldExpectancy?: number;
}>;

function makeCandidate(candidateId: string, options: CandidateOptions = {}): MutableRecord {
  const fullRange = M3_R5_ROUND_005_PLAN.researchUniverse;
  const foldRecords = FOLD_IDS.map((foldId) => signal(getResearchFoldRoleRange(foldId, "VALIDATION")));
  const folds = FOLD_IDS.map((foldId, index) => {
    const range = getResearchFoldRoleRange(foldId, "VALIDATION");
    return {
      foldId,
      validation: {
        range: clone(range),
        records: [clone(foldRecords[index]!)],
        diagnostics: diagnostics(range, {
          expectancyR: options.foldExpectancy ?? 0.1,
          ...(options.folds?.[index] ?? {}),
        }),
      },
    };
  });
  const aggregateRange = {
    startTime: getResearchFoldRoleRange("F1", "VALIDATION").startTime,
    endTime: getResearchFoldRoleRange("F6", "VALIDATION").endTime,
  };
  return {
    candidateId,
    fullSeenUniverse: {
      range: clone(fullRange),
      records: clone(foldRecords),
      diagnostics: diagnostics(fullRange, { expectancyR: options.aggregateExpectancy ?? 0.15, ...(options.full ?? {}) }),
    },
    folds,
    aggregateValidation: {
      segments: FOLD_IDS.map((foldId) => clone(getResearchFoldRoleRange(foldId, "VALIDATION"))),
      records: clone(foldRecords),
      diagnostics: diagnostics(aggregateRange, { expectancyR: options.aggregateExpectancy ?? 0.15, ...(options.aggregate ?? {}) }),
    },
    formalIdentitySha256: hashM3R5C3AIdentityRecords(foldRecords as never),
    executedIdentitySha256: hashM3R5C3AIdentityRecords(foldRecords as never, true),
  };
}

function makeEvidence(): MutableRecord {
  return {
    schemaVersion: "m3-r5-round-005-report-001",
    researchRoundId: M3_R5_ROUND_005_RESEARCH_ROUND_ID,
    executionSourceSha: "7e1652c30d3bc092f3161b9b36b7b11debebf161",
    selectionGateSha256: M3_R5_ROUND_005_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R5_ROUND_005_PLAN_SHA256,
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    controlReportSchemaVersion: "m3-b-report-004",
    dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
    researchUniverse: clone(M3_R5_ROUND_005_PLAN.researchUniverse),
    performanceLock: M3_R5_ROUND_005_PERFORMANCE_LOCK,
    performanceLockTriggered: true,
    performanceLifecycle: "PERFORMANCE_LOCKED",
    evidenceStatus: "COMPLETE",
    integrityErrors: [],
    selectionApplied: false,
    selectedCandidateId: null,
    candidateRegistry: clone(M3_R5_ROUND_005_CANDIDATE_IDS),
    excludedCandidates: clone(M3_R5_ROUND_005_EXCLUDED_CANDIDATES),
    control: makeCandidate(M3_R5_ROUND_005_CONTROL_ID, { aggregateExpectancy: 0, foldExpectancy: 0 }),
    candidates: M3_R5_ROUND_005_CANDIDATE_IDS.map((candidateId) => makeCandidate(candidateId)),
  };
}

function candidateById(evidence: MutableRecord, candidateId: string): MutableRecord {
  const candidate = records(evidence.candidates).map(record).find((item) => item.candidateId === candidateId);
  if (!candidate) throw new Error(`candidate ${candidateId} not found`);
  return candidate;
}

function aggregateDiagnostics(candidate: MutableRecord): MutableRecord {
  return record(record(candidate.aggregateValidation).diagnostics);
}

function foldDiagnostics(candidate: MutableRecord, index: number): MutableRecord {
  const fold = records(candidate.folds)[index];
  if (!fold) throw new Error(`fold ${index} not found`);
  return record(record(record(fold).validation).diagnostics);
}

function candidateEvaluation(evidence: MutableRecord, candidateId: string) {
  const result = evaluateM3R5C3ASelection(evidence, INPUT_HASHES);
  const candidate = result.candidates.find((item) => item.candidateId === candidateId);
  if (!candidate) throw new Error(`evaluation ${candidateId} not found`);
  return candidate;
}

describe("M3-R5-C.3A frozen selection implementation", () => {
  it("keeps the frozen provenance and registry boundaries", () => {
    expect(M3_R5_ROUND_005_SELECTION_GATES.researchRoundId).toBe(M3_R5_ROUND_005_RESEARCH_ROUND_ID);
    expect(M3_R5_ROUND_005_SELECTION_GATES.sourceSha).toBe("b59b9e86a8b1070275c157f571901a6165114670");
    expect(M3_R5_ROUND_005_CANDIDATE_IDS).toEqual([
      "R5-H15-HTF-TREND",
      "R5-H16-NEUTRAL-MEAN-REVERSION",
      "R5-H18-COMPRESSION-EXPANSION",
    ]);
    expect(M3_R5_ROUND_005_EXCLUDED_CANDIDATES[0]?.candidateId).toBe("R5-H17-FUNDING-REVERSAL");
  });

  it("evaluates all 10 applicable gates and keeps redundancy NOT_APPLICABLE", () => {
    const result = evaluateM3R5C3ASelection(makeEvidence(), INPUT_HASHES);
    expect(result.integrityStatus).toBe("COMPLETE");
    expect(result.integrityErrors).toEqual([]);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]?.gateResults).toHaveLength(11);
    expect(result.candidates[0]?.applicableGateCount).toBe(10);
    expect(result.candidates[0]?.passedApplicableGateCount).toBe(10);
    expect(result.candidates[0]?.eligibility).toBe("ELIGIBLE");
    expect(result.candidates[0]?.gateResults.find((gate) => gate.gateId === "requiredRedundancyImprovement")).toMatchObject({
      applicability: "NOT_APPLICABLE",
      status: "NOT_APPLICABLE",
    });
  });

  const gateFailures: readonly (readonly [string, (evidence: MutableRecord) => void])[] = [
    ["minimumAggregateImprovement", (evidence) => Object.assign(aggregateDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND")), { expectancyR: 0.099 })],
    ["minimumImprovedValidationFolds", (evidence) => {
      const candidate = candidateById(evidence, "R5-H15-HTF-TREND");
      for (const index of [0, 1, 2]) Object.assign(foldDiagnostics(candidate, index), { expectancyR: 0.01 });
    }],
    ["catastrophicFoldLimit", (evidence) => Object.assign(foldDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND"), 0), { expectancyR: -0.1 })],
    ["minimumNetExpectancy", (evidence) => Object.assign(aggregateDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND")), { expectancyR: 0.029 })],
    ["minimumProfitFactor", (evidence) => Object.assign(aggregateDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND")), { profitFactor: 1.199 })],
    ["maximumSymbolConcentration", (evidence) => Object.assign(aggregateDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND")), { topSymbolShareOfPositiveNetR: 0.501 })],
    ["maximumSingleTradeConcentration", (evidence) => Object.assign(aggregateDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND")), { largestSingleTradeShareOfPositiveNetR: 0.101 })],
    ["maximumFeeBurdenRatio", (evidence) => Object.assign(aggregateDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND")), { feeBurdenRatio: 0.751 })],
    ["minimumFormalSignals", (evidence) => Object.assign(aggregateDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND")), { formalSignals: 299 })],
    ["minimumExecutedTrades", (evidence) => Object.assign(foldDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND"), 0), { executedTrades: 29 })],
  ];

  it.each(gateFailures)("fails only when %s is below/above its frozen boundary", (gateId, mutate) => {
    const evidence = makeEvidence();
    mutate(evidence);
    const evaluation = candidateEvaluation(evidence, "R5-H15-HTF-TREND");
    expect(evaluation.gateResults.find((gate) => gate.gateId === gateId)?.status).toBe("FAIL");
    expect(evaluation.eligibility).toBe("INELIGIBLE");
  });

  it("uses inclusive gate boundaries and the exact +0.02 fold delta", () => {
    const evidence = makeEvidence();
    const candidate = candidateById(evidence, "R5-H15-HTF-TREND");
    Object.assign(aggregateDiagnostics(candidate), {
      expectancyR: 0.1,
      profitFactor: 1.2,
      topSymbolShareOfPositiveNetR: 0.5,
      largestSingleTradeShareOfPositiveNetR: 0.1,
      feeBurdenRatio: 0.75,
      formalSignals: 300,
    });
    for (let index = 0; index < 6; index += 1) Object.assign(foldDiagnostics(candidate, index), { expectancyR: 0.02, executedTrades: 30 });
    const evaluation = candidateEvaluation(evidence, "R5-H15-HTF-TREND");
    expect(evaluation.metrics.aggregateImprovement).toBe(0.1);
    expect(evaluation.metrics.improvedValidationFoldCount).toBe(6);
    expect(evaluation.eligibility).toBe("ELIGIBLE");
  });

  it("fails a null or zero grossR fee denominator instead of accepting the fee ratio", () => {
    for (const grossR of [0, null]) {
      const evidence = makeEvidence();
      Object.assign(aggregateDiagnostics(candidateById(evidence, "R5-H15-HTF-TREND")), { grossR });
      expect(candidateEvaluation(evidence, "R5-H15-HTF-TREND").gateResults.find((gate) => gate.gateId === "maximumFeeBurdenRatio")?.status).toBe("FAIL");
    }
  });

  it("evaluates the conjunction without early exit", () => {
    const evidence = makeEvidence();
    for (const candidate of records(evidence.candidates)) {
      Object.assign(aggregateDiagnostics(candidate), { expectancyR: -1, profitFactor: 0.1, formalSignals: 0 });
    }
    const result = evaluateM3R5C3ASelection(evidence, INPUT_HASHES);
    expect(result.candidates.every((candidate) => candidate.gateResults)).toBe(true);
    expect(result.candidates[0]?.failedGateCount).toBeGreaterThan(1);
    expect(result.candidates[0]?.gateResults).toHaveLength(11);
  });

  it("handles catastrophic expectancy/PF, NO_TRADES, NO_LOSSES, and the 30-trade fold floor", () => {
    const catastrophic = makeEvidence();
    Object.assign(foldDiagnostics(candidateById(catastrophic, "R5-H15-HTF-TREND"), 0), { expectancyR: -0.1001 });
    expect(candidateEvaluation(catastrophic, "R5-H15-HTF-TREND").metrics.catastrophicFoldCount).toBe(1);

    const noTrades = makeEvidence();
    Object.assign(aggregateDiagnostics(candidateById(noTrades, "R5-H15-HTF-TREND")), { profitFactor: null, profitFactorStatus: "NO_TRADES" });
    expect(candidateEvaluation(noTrades, "R5-H15-HTF-TREND").gateResults.find((gate) => gate.gateId === "minimumProfitFactor")?.status).toBe("FAIL");

    const noLosses = makeEvidence();
    Object.assign(aggregateDiagnostics(candidateById(noLosses, "R5-H15-HTF-TREND")), { profitFactor: null, profitFactorStatus: "NO_LOSSES" });
    expect(candidateEvaluation(noLosses, "R5-H15-HTF-TREND").gateResults.find((gate) => gate.gateId === "minimumProfitFactor")?.status).toBe("PASS");

    const shortFold = makeEvidence();
    Object.assign(foldDiagnostics(candidateById(shortFold, "R5-H15-HTF-TREND"), 0), { executedTrades: 29 });
    expect(candidateEvaluation(shortFold, "R5-H15-HTF-TREND").metrics.minimumFoldExecutedTrades).toBe(29);
  });

  it("returns the exact no-candidate decision when no candidate is eligible", () => {
    const evidence = makeEvidence();
    for (const candidate of records(evidence.candidates)) Object.assign(aggregateDiagnostics(candidate), { formalSignals: 0 });
    const result = evaluateM3R5C3ASelection(evidence, INPUT_HASHES);
    expect(result.eligibleCandidateIds).toEqual([]);
    expect(result.selectionAlgorithmApplied).toBe(false);
    expect(result.selectedCandidateId).toBeNull();
    expect(result.finalDecision).toBe(M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME);
  });

  it("applies improved-fold, expectancy, complexity, PF, and ID tie rules deterministically", () => {
    const moreFolds = makeEvidence();
    Object.assign(foldDiagnostics(candidateById(moreFolds, "R5-H16-NEUTRAL-MEAN-REVERSION"), 5), { expectancyR: 0.01 });
    Object.assign(foldDiagnostics(candidateById(moreFolds, "R5-H18-COMPRESSION-EXPANSION"), 4), { expectancyR: 0.01 });
    expect(evaluateM3R5C3ASelection(moreFolds, INPUT_HASHES).selectedCandidateId).toBe("R5-H15-HTF-TREND");

    const exactComplexityTie = makeEvidence();
    Object.assign(aggregateDiagnostics(candidateById(exactComplexityTie, "R5-H15-HTF-TREND")), { expectancyR: 0.14 });
    Object.assign(aggregateDiagnostics(candidateById(exactComplexityTie, "R5-H16-NEUTRAL-MEAN-REVERSION")), { expectancyR: 0.15 });
    expect(evaluateM3R5C3ASelection(exactComplexityTie, INPUT_HASHES).selectedCandidateId).toBe("R5-H15-HTF-TREND");

    const expectancyWins = makeEvidence();
    Object.assign(aggregateDiagnostics(candidateById(expectancyWins, "R5-H16-NEUTRAL-MEAN-REVERSION")), { expectancyR: 0.161 });
    expect(evaluateM3R5C3ASelection(expectancyWins, INPUT_HASHES).selectedCandidateId).toBe("R5-H16-NEUTRAL-MEAN-REVERSION");
  });

  function syntheticEvaluation(candidateId: string, profitFactor: number, complexity: Readonly<Record<string, number>>): M3R5C3ACandidateEvaluation {
    return {
      candidateId,
      complexity,
      metrics: {
        aggregateImprovement: 0.1,
        improvedValidationFoldCount: 6,
        catastrophicFoldCount: 0,
        expectancyR: 0.1,
        profitFactor,
        profitFactorStatus: "NORMAL",
        topSymbolShareOfPositiveNetR: 0.2,
        largestSingleTradeShareOfPositiveNetR: 0.05,
        feeBurdenRatio: 0.5,
        formalSignals: 300,
        minimumFoldExecutedTrades: 30,
      },
      gateResults: [],
      applicableGateCount: 10,
      passedApplicableGateCount: 10,
      failedGateCount: 0,
      failedGateIds: [],
      eligibility: "ELIGIBLE",
    };
  }

  it("applies PF and candidate-ID tie-breakers after equal complexity", () => {
    const complexity = { newRules: 1, newTunableThresholds: 1, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 };
    expect(compareM3R5C3ASelectionOrder(syntheticEvaluation("left", 2, complexity), syntheticEvaluation("right", 1, complexity))).toBeLessThan(0);
    expect(compareM3R5C3ASelectionOrder(syntheticEvaluation("A", 1, complexity), syntheticEvaluation("B", 1, complexity))).toBeLessThan(0);
  });

  it.each([
    ["selectionGateSha256", "bad"],
    ["experimentPlanSha256", "bad"],
    ["executionSourceSha", "bad"],
    ["selectionApplied", true],
  ] as const)("fails closed for invalid %s", (field, value) => {
    const evidence = makeEvidence();
    evidence[field] = value;
    const result = evaluateM3R5C3ASelection(evidence, INPUT_HASHES);
    expect(result.integrityStatus).toBe("INCOMPLETE_EVIDENCE");
    expect(result.selectionAlgorithmApplied).toBe(false);
  });

  it("fails closed when any committed input artifact hash does not match the frozen evidence", () => {
    const input = { ...INPUT_HASHES, summary: "0".repeat(64) };
    const result = evaluateM3R5C3ASelection(makeEvidence(), input);
    expect(result.integrityStatus).toBe("INCOMPLETE_EVIDENCE");
    expect(result.integrityErrors).toContain("input summary SHA-256 mismatch.");
  });

  it("rejects H17 entering the candidate registry and preserves the reserved output boundary", () => {
    const evidence = makeEvidence();
    evidence.candidateRegistry = [...M3_R5_ROUND_005_CANDIDATE_IDS, "R5-H17-FUNDING-REVERSAL"];
    expect(evaluateM3R5C3ASelection(evidence, INPUT_HASHES).integrityStatus).toBe("INCOMPLETE_EVIDENCE");
    expect(existsSync(resolve("docs/evidence/M3_R5_C3_SELECTION.json"))).toBe(false);
    expect(existsSync(resolve("docs/M3_R5_C3_SELECTION.md"))).toBe(false);
  });

  it("parses every required authorization flag and validates the source SHA", () => {
    expect(() => parseM3R5C3ASelectionArguments([])).toThrow("missing --confirm-authoritative-selection");
    const args = parseM3R5C3ASelectionArguments([
      "--confirm-authoritative-selection",
      "--source-sha", "7e1652c30d3bc092f3161b9b36b7b11debebf161",
      "--round", M3_R5_ROUND_005_RESEARCH_ROUND_ID,
      "--gate-sha", M3_R5_ROUND_005_SELECTION_GATE_SHA256,
      "--plan-sha", M3_R5_ROUND_005_PLAN_SHA256,
      "--input-summary-sha", INPUT_HASHES.summary,
      "--input-audit-sha", INPUT_HASHES.audit,
      "--input-results-sha", INPUT_HASHES.results,
    ]);
    expect(args.inputResultsSha).toBe(INPUT_HASHES.results);
    expect(() => validateM3R5C3AAuthoritativeSource("a".repeat(40), "b".repeat(40))).toThrow("source SHA mismatch");
    expect(() => validateM3R5C3AAuthoritativeSource("a".repeat(40), "a".repeat(40))).not.toThrow();
  });

  it("locks future preflight refusals for dirty worktrees, existing outputs, and Git blob hashes", () => {
    expect(() => validateM3R5C3AWorktreeStatus(" M package.json\n")).toThrow("worktree is not clean");
    expect(() => validateM3R5C3AWorktreeStatus("?? generated-output.json\n")).toThrow("worktree is not clean");
    expect(() => validateM3R5C3AWorktreeStatus("")).not.toThrow();
    expect(() => validateM3R5C3AOutputsAbsent(true, false)).toThrow("selection output already exists");
    expect(() => validateM3R5C3AOutputsAbsent(false, true)).toThrow("selection output already exists");
    expect(() => validateM3R5C3AOutputsAbsent(false, false)).not.toThrow();
    const committedBytes = Buffer.from("committed\n", "utf8");
    const committedSha = sha256M3R5C3ARawBytes(committedBytes);
    const workingTreeBytes = Buffer.from("committed\r\n", "utf8");
    expect(sha256M3R5C3ARawBytes(workingTreeBytes)).not.toBe(committedSha);
    expect(() => validateM3R5C3ACommittedBlobHash("summary", committedSha, committedSha)).not.toThrow();
    expect(() => validateM3R5C3ACommittedBlobHash("summary", sha256M3R5C3ARawBytes(workingTreeBytes), committedSha)).toThrow("committed Git blob SHA-256 mismatch");
    expect(committedBytes.toString("utf8")).toBe("committed\n");
  });

  it("serializes a deterministic report without invoking real evidence or network code", () => {
    const evidence = makeEvidence();
    const first = evaluateM3R5C3ASelection(evidence, INPUT_HASHES);
    const second = evaluateM3R5C3ASelection(clone(evidence), INPUT_HASHES);
    expect(first).toEqual(second);
    expect(M3_R5_C3A_SELECTION_SCHEMA_VERSION).toBe("m3-r5-c3-selection-001");
    const source = readFileSync(resolve("src/lib/research/m3-r5-c3-selection.ts"), "utf8");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("fapi.binance.com");
  });

  describe("destination-local atomic publication", () => {
    function publicationFixture() {
      const root = mkdtempSync(join(tmpdir(), "m3-r5-c3-publication-"));
      const jsonPath = join(root, "evidence", "M3_R5_C3_SELECTION.json");
      const markdownPath = join(root, "docs", "M3_R5_C3_SELECTION.md");
      mkdirSync(dirname(jsonPath), { recursive: true });
      mkdirSync(dirname(markdownPath), { recursive: true });
      return { root, jsonPath, markdownPath };
    }

    it("stages on the JSON destination filesystem and preserves exact bytes", () => {
      const fixture = publicationFixture();
      const jsonBytes = Buffer.from([0, 1, 2, 255]);
      const markdownBytes = Buffer.from("# exact\r\n", "utf8");
      const staging: string[] = [];
      try {
        publishM3R5C3ASelectionOutputsAtomically({ jsonPath: fixture.jsonPath, markdownPath: fixture.markdownPath, jsonBytes, markdownBytes }, { onStagingDirectory: (path) => staging.push(path) });
        expect(readFileSync(fixture.jsonPath)).toEqual(jsonBytes);
        expect(readFileSync(fixture.markdownPath)).toEqual(markdownBytes);
        expect(staging).toHaveLength(1);
        expect(dirname(staging[0]!)).toBe(dirname(fixture.jsonPath));
        expect(existsSync(staging[0]!)).toBe(false);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });

    it("rolls back an earlier publication when the later rename fails", () => {
      const fixture = publicationFixture();
      const staging: string[] = [];
      let renameCount = 0;
      try {
        expect(() => publishM3R5C3ASelectionOutputsAtomically(
          { jsonPath: fixture.jsonPath, markdownPath: fixture.markdownPath, jsonBytes: Buffer.from("json"), markdownBytes: Buffer.from("md") },
          {
            onStagingDirectory: (path) => staging.push(path),
            renameFile: (source, destination) => {
              renameCount += 1;
              if (renameCount === 2) throw new Error("simulated second publication failure");
              renameSync(source, destination);
            },
          },
        )).toThrow("simulated second publication failure");
        expect(existsSync(fixture.jsonPath)).toBe(false);
        expect(existsSync(fixture.markdownPath)).toBe(false);
        expect(staging[0] ? existsSync(staging[0]) : true).toBe(false);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });

    it("rejects a pre-existing destination before staging and leaves it unchanged", () => {
      const fixture = publicationFixture();
      const original = Buffer.from("old");
      const staging: string[] = [];
      try {
        writeFileSync(fixture.jsonPath, original);
        expect(() => publishM3R5C3ASelectionOutputsAtomically(
          { jsonPath: fixture.jsonPath, markdownPath: fixture.markdownPath, jsonBytes: Buffer.from("new"), markdownBytes: Buffer.from("md") },
          { onStagingDirectory: (path) => staging.push(path) },
        )).toThrow("output already exists");
        expect(readFileSync(fixture.jsonPath)).toEqual(original);
        expect(existsSync(fixture.markdownPath)).toBe(false);
        expect(staging).toEqual([]);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  });
});
