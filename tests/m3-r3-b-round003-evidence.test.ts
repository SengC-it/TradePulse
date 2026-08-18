import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { BacktestSignalResult } from "../src/lib/backtest/types.ts";
import type { M3R2DecisionSnapshot } from "../src/lib/research/m3-r2-decision-snapshot.ts";
import {
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
  M3_R3_ROUND_003_CANDIDATE_IDS,
} from "../src/lib/research/selection-gates-round-003.ts";
import {
  M3_R3_B_AGGREGATE_RANGE,
  M3_R3_B_CONTROL_REPORT_SCHEMA_VERSION,
  M3_R3_B_DATA_CLASSIFICATION,
  M3_R3_B_DECISION,
  M3_R3_B_PERFORMANCE_LOCK,
  M3_R3_B_RECOVERY_MAIN_BASE_SHA,
  M3_R3_B_REPORT_SCHEMA_VERSION,
  M3_R3_B_REUSE_VERIFICATION_SCHEMA,
  M3_R3_B_REUSE_VERIFICATION_SOURCE_SHA,
  M3_R3_B_STRATEGY_VERSION,
  M3_R3_B_POLICY_VERSION,
  validateM3R3BIdentitySets,
  validateM3R3BPreflight,
  validateM3R3BCandidateSelections,
} from "../src/lib/research/m3-r3-b-round-003-evidence.ts";
import { selectM3R2CandidateSnapshots } from "../src/lib/research/m3-r2-selectors.ts";
import { getResearchFoldRoleRange } from "../src/lib/research/folds.ts";

const EXPORTED_CANDIDATE_IDS = M3_R3_ROUND_003_CANDIDATE_IDS;

const BASE_TIME = Date.parse("2024-01-01T00:00:00.000Z");
const HOUR = 60 * 60 * 1_000;

function makeDecisionSnapshot(index: number, overrides: Partial<M3R2DecisionSnapshot> = {}): M3R2DecisionSnapshot {
  return {
    signalTime: BASE_TIME + index * HOUR,
    symbol: "ETHUSDT",
    direction: "LONG",
    btcRegime: "BTC_STRONG_BULL",
    symbol4hClose: 102,
    symbol4hEma50: 100,
    symbol4hEma200: 98,
    symbol4hAtr: 2,
    symbol4hEma200FiveBarsAgo: 97.8,
    nearestBaselinePullbackTouchAgeBars: 1,
    current1hQuoteVolume: 100,
    previous20Closed1hQuoteVolumeMean: 100,
    current1hClose: 100.2,
    previous3BreakoutExtreme: 100,
    current1hAtr: 2,
    breakoutMarginAtr: 0.1,
    ...overrides,
  };
}

function makeResult(index: number, overrides: Partial<BacktestSignalResult> = {}): BacktestSignalResult {
  const signal = makeDecisionSnapshot(index);
  return {
    snapshot: {
      strategyVersion: "baseline-001",
      backtestPolicyVersion: "bt-policy-003",
      signalTime: signal.signalTime,
      symbol: signal.symbol,
      direction: signal.direction,
      symbolRegime: "LONG_ONLY",
      btcRegime: signal.btcRegime,
      entryReference: 100,
      stopReference: 99,
      takeProfitReference: 102,
      stopDistance: 1,
      stopAtr: 1,
      breakdown: {
        trendStrength: 40,
        pullbackQuality: 20,
        breakoutStrength: 20,
        volumeScore: 10,
        riskRewardScore: 10,
      },
      totalScore: 90,
      grade: "A",
    },
    status: "EXECUTED",
    entryTime: signal.signalTime + 1,
    rawEntryPrice: 100,
    entryFill: 100.05,
    exitTime: signal.signalTime + 24 * HOUR,
    rawExitPrice: 101,
    exitFill: 100.95,
    heldCandleNumber: 24,
    exitReason: "TIME_EXIT",
    fundingCharges: [],
    fundingPnL: 0,
    priceR: 0.95,
    feeR: 0.05,
    fundingR: 0,
    grossR: 0.95,
    netR: 0.9,
    ...overrides,
  };
}

function makeReuseVerification(): Record<string, unknown> {
  return {
    schemaVersion: M3_R3_B_REUSE_VERIFICATION_SCHEMA,
    researchRoundId: "baseline-002-research-round-003",
    verificationSourceSha: M3_R3_B_REUSE_VERIFICATION_SOURCE_SHA,
    controlReportSha256: "5ecfae3258d2ace774965eba12df25b888b04593b32e1b92a2593c41fdad8b33",
    decisionSnapshotArtifactSha256: "65a011d813c55f936f89069706730f5de33dfda9f2eba94f0dfb2b914818eec9",
    round001EvidenceSha256: "883001ac34470120cdbc754c2f47437bf13b6f13ce6ffb3e4f7795558a6a2fc7",
    studyServerTime: 1787031883099,
    snapshotCount: 7500,
    artifactReuseStatus: "VERIFIED_REUSABLE_INPUT",
    controlValidationStatus: "PASS",
    controlParityStatus: "PASS",
  };
}

const snapshots = Array.from({ length: 10 }, (_, index) => makeDecisionSnapshot(index));
const results = snapshots.map((_, index) => makeResult(index));
const subsetSelections = Object.fromEntries(
  M3_R3_ROUND_003_CANDIDATE_IDS.map((candidateId) => [candidateId, [snapshots[0]]]),
) as unknown as Record<(typeof M3_R3_ROUND_003_CANDIDATE_IDS)[number], readonly M3R2DecisionSnapshot[]>;

function expectSelectionFailure(change: (selections: typeof subsetSelections) => typeof subsetSelections): void {
  expect(() => validateM3R3BCandidateSelections({
    controlResults: results,
    decisionSnapshots: snapshots,
    candidateSelections: change({ ...subsetSelections }),
    expectedSnapshotCount: 10,
  })).toThrow();
}

describe("M3-R3-B Round-003 offline evidence source freeze", () => {
  const cases: readonly [string, () => void][] = [
    ["01 freezes the report schema", () => expect(M3_R3_B_REPORT_SCHEMA_VERSION).toBe("m3-r3-round-003-report-001")],
    ["02 freezes the research round", () => expect(M3_R3_B_DECISION).toContain("M3_R3_C")],
    ["03 freezes the recovery main base", () => expect(M3_R3_B_RECOVERY_MAIN_BASE_SHA).toBe("1399ef6921b2930fb51d49c1b8c29260f1087678")],
    ["04 freezes baseline-001", () => expect(M3_R3_B_STRATEGY_VERSION).toBe("baseline-001")],
    ["05 freezes bt-policy-003", () => expect(M3_R3_B_POLICY_VERSION).toBe("bt-policy-003")],
    ["06 freezes the CONTROL schema", () => expect(M3_R3_B_CONTROL_REPORT_SCHEMA_VERSION).toBe("m3-b-report-004")],
    ["07 freezes seen-data classification", () => expect(M3_R3_B_DATA_CLASSIFICATION).toBe("RESEARCH_AVAILABLE_SEEN_DATA")],
    ["08 freezes the performance lock label", () => expect(M3_R3_B_PERFORMANCE_LOCK).toBe("FIRST_M3_R3_B_PERFORMANCE_RESULT_GENERATED")],
    ["09 freezes the deferred decision", () => expect(M3_R3_B_DECISION).toBe("DEFER_TO_M3_R3_C_FROZEN_GATE_APPLICATION")],
    ["10 exports the nine frozen candidate IDs", () => expect(EXPORTED_CANDIDATE_IDS).toHaveLength(9)],
    ["11 preserves candidate registry order", () => expect(EXPORTED_CANDIDATE_IDS).toEqual(M3_R3_ROUND_003_CANDIDATE_IDS)],
    ["12 includes H6", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-H6-STRICT-BTC")],
    ["13 includes H7", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-H7-STRONG-SYMBOL")],
    ["14 includes H8", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-H8-RECENT-PULLBACK")],
    ["15 includes H9", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-H9-VOLUME-CONFIRM")],
    ["16 includes H10", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-H10-BREAKOUT-010")],
    ["17 includes C1", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-C1-BTC-STRONG-SYMBOL")],
    ["18 includes C2", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-C2-STRONG-SYMBOL-RECENT-PULLBACK")],
    ["19 includes C3", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT")],
    ["20 includes C4", () => expect(EXPORTED_CANDIDATE_IDS).toContain("R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT")],
    ["21 validates the exact selection gate SHA", () => expect(BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256).toBe("297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2")],
    ["22 validates the exact reuse record", () => expect(validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: makeReuseVerification() }).controlParityStatus).toBe("PASS")],
    ["23 rejects a changed reuse schema", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: { ...makeReuseVerification(), schemaVersion: "wrong" } })).toThrow()],
    ["24 rejects a changed reuse source SHA", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: { ...makeReuseVerification(), verificationSourceSha: "b".repeat(40) } })).toThrow()],
    ["25 rejects a changed reuse CONTROL SHA", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: { ...makeReuseVerification(), controlReportSha256: "b".repeat(64) } })).toThrow()],
    ["26 rejects a changed reuse snapshot SHA", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: { ...makeReuseVerification(), decisionSnapshotArtifactSha256: "b".repeat(64) } })).toThrow()],
    ["27 rejects a changed Round-001 evidence SHA", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: { ...makeReuseVerification(), round001EvidenceSha256: "b".repeat(64) } })).toThrow()],
    ["28 rejects a changed study server time", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: { ...makeReuseVerification(), studyServerTime: 1 } })).toThrow()],
    ["29 rejects a changed snapshot count", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: { ...makeReuseVerification(), snapshotCount: 1 } })).toThrow()],
    ["30 rejects a non-Commit-A execution SHA", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "not-a-sha", recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA, reuseVerification: makeReuseVerification() })).toThrow()],
    ["31 rejects a wrong recovery base", () => expect(() => validateM3R3BPreflight({ executionSourceSha: "a".repeat(40), recoveryMainBaseSha: "b".repeat(40), reuseVerification: makeReuseVerification() })).toThrow()],
    ["32 validates CONTROL and snapshot identity equality", () => expect(validateM3R3BIdentitySets({ controlResults: results, decisionSnapshots: snapshots, expectedSnapshotCount: 10 }).controlIdentityStrings).toHaveLength(10)],
    ["33 rejects a missing snapshot identity", () => expect(() => validateM3R3BIdentitySets({ controlResults: results, decisionSnapshots: snapshots.map((value, index) => index === 9 ? makeDecisionSnapshot(99) : value), expectedSnapshotCount: 10 })).toThrow()],
    ["34 rejects an extra snapshot identity", () => expect(() => validateM3R3BIdentitySets({ controlResults: results, decisionSnapshots: [...snapshots, makeDecisionSnapshot(99)], expectedSnapshotCount: 10 })).toThrow()],
    ["35 rejects a duplicate CONTROL identity", () => expect(() => validateM3R3BIdentitySets({ controlResults: [...results.slice(0, 9), results[0]!], decisionSnapshots: snapshots, expectedSnapshotCount: 10 })).toThrow()],
    ["36 rejects a duplicate snapshot identity", () => expect(() => validateM3R3BIdentitySets({ controlResults: results, decisionSnapshots: [...snapshots.slice(0, 9), snapshots[0]!], expectedSnapshotCount: 10 })).toThrow()],
    ["37 validates all nine selections are present", () => expect(validateM3R3BCandidateSelections({ controlResults: results, decisionSnapshots: snapshots, candidateSelections: subsetSelections, expectedSnapshotCount: 10 })).toBe(subsetSelections)],
    ["38 rejects a missing candidate selection", () => expectSelectionFailure((value) => ({ ...value, [EXPORTED_CANDIDATE_IDS[0]!]: undefined } as unknown as typeof subsetSelections))],
    ["39 rejects an empty candidate selection", () => expectSelectionFailure((value) => ({ ...value, [EXPORTED_CANDIDATE_IDS[0]!]: [] }))],
    ["40 rejects a full candidate selection", () => expectSelectionFailure((value) => ({ ...value, [EXPORTED_CANDIDATE_IDS[0]!]: snapshots }))],
    ["41 rejects a non-CONTROL candidate identity", () => expectSelectionFailure((value) => ({ ...value, [EXPORTED_CANDIDATE_IDS[0]!]: [makeDecisionSnapshot(99)] }))],
    ["42 rejects a foreign snapshot reference", () => expectSelectionFailure((value) => ({ ...value, [EXPORTED_CANDIDATE_IDS[0]!]: [{ ...snapshots[0]! }] }))],
    ["43 rejects a duplicate candidate identity", () => expectSelectionFailure((value) => ({ ...value, [EXPORTED_CANDIDATE_IDS[0]!]: [snapshots[0]!, snapshots[0]!] }))],
    ["44 accepts a non-empty strict subset", () => expect(validateM3R3BCandidateSelections({ controlResults: results, decisionSnapshots: snapshots, candidateSelections: subsetSelections, expectedSnapshotCount: 10 })[EXPORTED_CANDIDATE_IDS[0]!] ).toHaveLength(1)],
    ["45 preserves selector snapshot references", () => expect(selectM3R2CandidateSnapshots("R2-H6-STRICT-BTC", snapshots)[0]).toBe(snapshots[0])],
    ["46 uses the selector's canonical ordering", () => expect(selectM3R2CandidateSnapshots("R2-H6-STRICT-BTC", [...snapshots].reverse()).map((value) => value.signalTime)).toEqual(snapshots.map((value) => value.signalTime))],
    ["47 keeps selector input limited to decision snapshots", () => expect(readFileSync("src/lib/research/m3-r2-selectors.ts", "utf8")).not.toContain("BacktestSignalResult")],
    ["48 keeps the Round-003 evidence source offline", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).not.toMatch(/\bfetch\s*\(/u)],
    ["49 does not import the historical loader", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).not.toContain("historical-loader")],
    ["50 does not call runBacktest", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).not.toContain("runBacktest")],
    ["51 does not call evaluateStrategy", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).not.toContain("evaluateStrategy")],
    ["52 does not call Date.now", () => expect(readFileSync("scripts/m3-r3-b-derive-evidence.ts", "utf8")).not.toContain("Date.now")],
    ["53 uses the existing diagnostics helper", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).toContain("calculateM3R3AggregateDiagnostics")],
    ["54 preserves the F1-through-F6 aggregate boundary", () => expect(M3_R3_B_AGGREGATE_RANGE).toEqual({ startTime: getResearchFoldRoleRange("F1", "VALIDATION").startTime, endTime: getResearchFoldRoleRange("F6", "VALIDATION").endTime })],
    ["55 uses validation fold roles", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).toContain('"VALIDATION"')],
    ["56 keeps redundancy not applicable", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).toContain('"NOT_APPLICABLE"')],
    ["57 keeps redundancy reduction null", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).toContain("redundancyRelativeReductionVsControl: null")],
    ["58 does not define an eligibility field", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).not.toContain("eligible")],
    ["59 does not define a winner field", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).not.toContain("winner")],
    ["60 does not define a rank field", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).not.toContain("rank")],
    ["61 preserves raw CONTROL result references", () => expect(results[0]!.snapshot.signalTime).toBe(snapshots[0]!.signalTime)],
    ["62 preserves inherited exit economics", () => expect(makeResult(0).netR).toBe(0.9)],
    ["63 preserves inherited funding charges", () => expect(makeResult(0).fundingCharges).toEqual([])],
    ["64 keeps the lock true only after candidate diagnostics", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).toContain("performanceLockTriggered = true")],
    ["65 exposes the frozen performance lock label", () => expect(M3_R3_B_PERFORMANCE_LOCK).toBe("FIRST_M3_R3_B_PERFORMANCE_RESULT_GENERATED")],
    ["66 does not alter the selection gate source", () => expect(readFileSync("src/lib/research/selection-gates-round-003.ts", "utf8")).toContain("BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256")],
    ["67 keeps the package command separate", () => expect(JSON.parse(readFileSync("package.json", "utf8")).scripts["research:m3r3:derive-evidence"]).toBe("node --experimental-strip-types --no-warnings scripts/m3-r3-b-derive-evidence.ts")],
    ["68 keeps evidence output paths in the script", () => expect(readFileSync("scripts/m3-r3-b-derive-evidence.ts", "utf8")).toContain("docs/evidence/M3_R3_ROUND_003_SUMMARY.json")],
    ["69 keeps markdown output descriptive", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).toContain("Candidate gate application is deferred")],
    ["70 records the signal-level disclaimer", () => expect(readFileSync("src/lib/research/m3-r3-b-round-003-evidence.ts", "utf8")).toContain("THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.")],
  ];

  for (const [name, test] of cases) it(name, test);
});
