import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { BacktestReport, BacktestSignalResult } from "../src/lib/backtest/types.ts";
import { adaptBacktestSignalResult } from "../src/lib/research/adapter.ts";
import { RESEARCH_FOLDS, getResearchFoldRoleRange, selectRecordsForFoldRole } from "../src/lib/research/folds.ts";
import type { M3HResearchEvidence } from "../src/lib/research/m3-h-evidence.ts";
import type { M3R2DecisionSnapshot } from "../src/lib/research/m3-r2-decision-snapshot.ts";
import {
  BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATES,
  M3_R3_ROUND_003_CANDIDATE_IDS,
  M3_R3_ROUND_003_INHERITED_PLAN_SHA256,
  M3_R3_ROUND_003_INHERITED_SELECTION_GATE_SHA256,
  M3_R3_ROUND_003_RESEARCH_ROUND_ID,
  validateM3R3Round003MachineRecord,
} from "../src/lib/research/selection-gates-round-003.ts";
import { BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES } from "../src/lib/research/selection-gates-round-002.ts";
import { BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES } from "../src/lib/research/selection-gates-round-001.ts";
import {
  M3_R3_ROUND_003_PLAN,
  M3_R3_ROUND_003_PLAN_SHA256,
  M3_R3_ROUND_003_SELECTOR_SPECS_SHA256,
  validateM3R3Round003Plan,
} from "../src/lib/research/m3-r3-round-003-plan.ts";
import {
  M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE,
  M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS,
  M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256,
  M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256,
  M3_R3_ROUND_003_EXPECTED_EXECUTED_COUNT,
  M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256,
  M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT,
  M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME,
  M3R3RecoveryError,
  calculateM3R3AggregateDiagnostics,
  canonicalM3R3IdentityStrings,
  m3R3ExecutedIdentityHash,
  m3R3FormalIdentityHash,
  parseM3R3ControlReportBytes,
  parseM3R3Round001EvidenceBytes,
  parseM3R3Round002SnapshotArtifact,
  sha256M3R3RawBytes,
  validateM3R3ControlParity,
  validateM3R3ControlReportContract,
  validateM3R3IdentityRecord,
  verifyM3R3Round002InputArtifacts,
} from "../src/lib/research/m3-r3-round-003-recovery.ts";
import { M3_R2_ROUND_002_SELECTOR_SPECS } from "../src/lib/research/m3-r2-round-002-plan.ts";
import type { NormalizedResearchSignal } from "../src/lib/research/types.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;
const HOUR_MS = 60 * 60 * 1_000;
const F1_START = RESEARCH_FOLDS.F1.validation.startTime;
const F6_END = RESEARCH_FOLDS.F6.validation.endTime;

function expectRecoveryFailure(action: () => unknown, code: string): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(M3R3RecoveryError);
  expect((thrown as M3R3RecoveryError).code).toBe(code);
}

function record(overrides: Partial<NormalizedResearchSignal> = {}): NormalizedResearchSignal {
  return {
    signalTime: F1_START,
    symbol: "BTCUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_STRONG_BULL",
    totalScore: 80,
    grade: "B",
    status: "EXECUTED",
    entryTime: F1_START + 1,
    exitTime: F1_START + 2,
    grossR: 1,
    feeR: 0.1,
    fundingR: 0,
    netR: 0.9,
    ...overrides,
  };
}

function makeSnapshot(index: number, overrides: Partial<M3R2DecisionSnapshot> = {}): M3R2DecisionSnapshot {
  const symbol = (["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const)[index % 5]!;
  const direction = index % 2 === 0 ? "LONG" : "SHORT";
  return {
    signalTime: F1_START + index * HOUR_MS,
    symbol,
    direction,
    btcRegime: "BTC_NEUTRAL",
    symbol4hClose: 100,
    symbol4hEma50: 99,
    symbol4hEma200: 98,
    symbol4hAtr: 2,
    symbol4hEma200FiveBarsAgo: 97,
    nearestBaselinePullbackTouchAgeBars: 2,
    current1hQuoteVolume: 200,
    previous20Closed1hQuoteVolumeMean: 100,
    current1hClose: 101,
    previous3BreakoutExtreme: direction === "LONG" ? 100 : 102,
    current1hAtr: 1,
    breakoutMarginAtr: 1,
    ...overrides,
  };
}

function makeSnapshotArtifact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "m3-r2-decision-snapshots-001",
    researchRoundId: "baseline-002-research-round-002",
    executionSourceSha: "9df170b7f72a95971825e126d4096e1e4f16be5f",
    selectionGateSha256: "9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0",
    experimentPlanSha256: "82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511",
    backtestPolicyVersion: "bt-policy-003",
    strategyVersion: "baseline-001",
    studyServerTime: M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME,
    controlReportSha256: M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256,
    snapshotCount: M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT,
    snapshots: Array.from({ length: M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT }, (_, index) => makeSnapshot(index)),
    ...overrides,
  };
}

function makeControlResult(foldId: (typeof FOLD_IDS)[number], index: number, status?: string): BacktestSignalResult {
  const range = getResearchFoldRoleRange(foldId, "VALIDATION");
  const foldIndex = FOLD_IDS.indexOf(foldId);
  const signalTime = index < 10
    ? range.startTime + index * HOUR_MS
    : F1_START - (foldIndex * 1_250 + index + 1) * HOUR_MS;
  const direction = index % 2 === 0 ? "LONG" : "SHORT";
  const symbol = (["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const)[index % 5]!;
  const resultStatus = status ?? (foldId === "F1" && index < 5 ? "PERIOD_END_CENSORED" : "EXECUTED");
  const executed = resultStatus === "EXECUTED";
  return {
    snapshot: {
      strategyVersion: "baseline-001",
      backtestPolicyVersion: "bt-policy-003",
      signalTime,
      symbol,
      direction,
      symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
      btcRegime: "BTC_NEUTRAL",
      entryReference: 100,
      stopReference: 99,
      takeProfitReference: 102,
      stopDistance: 1,
      stopAtr: 1,
      breakdown: {
        trendStrength: 20,
        pullbackQuality: 20,
        breakoutStrength: 20,
        volumeScore: 10,
        riskRewardScore: 10,
      },
      totalScore: 80,
      grade: "B",
    },
    status: resultStatus as BacktestSignalResult["status"],
    entryTime: executed ? signalTime + 1 : null,
    rawEntryPrice: executed ? 100 : null,
    entryFill: executed ? 100.05 : null,
    exitTime: executed ? signalTime + 2 : null,
    rawExitPrice: executed ? 101 : null,
    exitFill: executed ? 100.95 : null,
    heldCandleNumber: executed ? 1 : null,
    exitReason: executed ? "TP" : null,
    fundingCharges: [],
    fundingOrderAudits: [],
    fundingPnL: 0,
    priceR: executed ? 1 : null,
    feeR: executed ? 0.1 : null,
    fundingR: executed ? 0 : null,
    grossR: executed ? 1 : null,
    netR: executed ? 0.9 : null,
  };
}

function makeControlResults(): BacktestSignalResult[] {
  return FOLD_IDS.flatMap((foldId) => Array.from({ length: 1_250 }, (_, index) => makeControlResult(foldId, index)));
}

function makeControlValue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "m3-b-report-004",
    backtestPolicyVersion: "bt-policy-003",
    strategyVersion: "baseline-001",
    period: "COMBINED",
    studyServerTime: M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME,
    status: "FAIL",
    diagnostics: [],
    signalResults: makeControlResults(),
    ...overrides,
  };
}

function makeParityEvidence(results: readonly BacktestSignalResult[]): M3HResearchEvidence {
  const records = results.map(adaptBacktestSignalResult);
  const folds = FOLD_IDS.map((foldId) => {
    const range = getResearchFoldRoleRange(foldId, "VALIDATION");
    const foldRecords = selectRecordsForFoldRole(records, foldId, "VALIDATION");
    return {
      foldId,
      range,
      diagnostics: calculateM3R3AggregateDiagnostics(foldRecords, range),
    };
  });
  return {
    control: {
      formalIdentitySha256: m3R3FormalIdentityHash(records),
      executedIdentitySha256: m3R3ExecutedIdentityHash(records),
      aggregateValidation: { diagnostics: calculateM3R3AggregateDiagnostics(records) },
      folds,
    },
  } as unknown as M3HResearchEvidence;
}

describe("M3-R3-A Round-003 machine freeze", () => {
  it("uses a new round while retaining the exact nine candidate identities", () => {
    expect(M3_R3_ROUND_003_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-003");
    expect(M3_R3_ROUND_003_CANDIDATE_IDS).toHaveLength(9);
    expect(BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256).toBe(
      "297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2",
    );
    expect(M3_R3_ROUND_003_INHERITED_SELECTION_GATE_SHA256).toBe(
      "9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0",
    );
    expect(M3_R3_ROUND_003_PLAN_SHA256).not.toBe(
      "6501a1d8264728cc955a905e03f8a99c157629113a9efbb5fcb544a81d7ed2ab",
    );
    expect(M3_R3_ROUND_003_INHERITED_PLAN_SHA256).toBe(
      "82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511",
    );
    expect(validateM3R3Round003MachineRecord()).toBe(BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD);
    expect(validateM3R3Round003Plan()).toBe(M3_R3_ROUND_003_PLAN);
  });

  it("keeps the Round-002 gate values and selector semantics equivalent", () => {
    const withoutProvenance = (value: Record<string, unknown>) => {
      const { researchRoundId, sourceSha, ...semantics } = value;
      void researchRoundId;
      void sourceSha;
      return semantics;
    };
    expect(withoutProvenance(BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATES)).toEqual(
      withoutProvenance(BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES),
    );
    expect(withoutProvenance(BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATES)).toEqual(
      withoutProvenance(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES),
    );
    expect(Object.values(BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD.definitions.round002CandidateRedundancyApplicability)).toEqual(
      Array.from({ length: 9 }, () => "NOT_APPLICABLE"),
    );
    expect(stableStringify(M3_R3_ROUND_003_PLAN.selectorSpecs)).toBe(stableStringify(M3_R2_ROUND_002_SELECTOR_SPECS));
    expect(M3_R3_ROUND_003_SELECTOR_SPECS_SHA256).toBe(
      createHash("sha256").update(stableStringify(M3_R2_ROUND_002_SELECTOR_SPECS), "utf8").digest("hex"),
    );
  });

  it("freezes the explicit artifact, CONTROL, parity, and authorization preconditions", () => {
    expect(M3_R3_ROUND_003_PLAN.artifactRawBinding).toBe("PARSE_ENVELOPE_FROM_SHA_VERIFIED_RAW_BYTES");
    expect(M3_R3_ROUND_003_PLAN.controlValidation).toContain("7500 formal");
    expect(M3_R3_ROUND_003_PLAN.round001EvidenceSha256).toBe(M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256);
    expect(M3_R3_ROUND_003_PLAN.controlParity).toEqual({
      formalIdentity: "formal identity SHA",
      executedIdentity: "executed identity SHA",
      aggregateValidation: "aggregate F1-F6 diagnostics",
      folds: "F1-F6 diagnostics",
    });
    expect(M3_R3_ROUND_003_PLAN.m3R3BRequiredStatuses).toEqual({
      artifactReuseStatus: "VERIFIED_REUSABLE_INPUT",
      controlValidationStatus: "PASS",
      controlParityStatus: "PASS",
    });
  });

  it("retains exact complexity tuples and F1-F6 fold boundaries", () => {
    expect(M3_R3_ROUND_003_PLAN.complexityTuples["R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT"]).toEqual({
      newRules: 1,
      newTunableThresholds: 6,
      modifiedBaselineRules: 3,
      mechanismFamiliesUsed: 4,
    });
    expect(M3_R3_ROUND_003_PLAN.folds).toEqual(RESEARCH_FOLDS);
    expect(M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE).toEqual({ startTime: F1_START, endTime: F6_END });
  });
});

describe("M3-R3-A aggregate validation and identity fail-closed rules", () => {
  it("filters a pre-F1 record before calling diagnostics", () => {
    const beforeF1 = record({ signalTime: Date.parse("2023-01-10T08:59:59.999Z") });
    const inValidation = record({ signalTime: F1_START + 1_000 });
    const diagnostics = calculateM3R3AggregateDiagnostics([beforeF1, inValidation]);
    expect(diagnostics.formalSignals).toBe(1);
    expect(diagnostics.range).toEqual(M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE);
  });

  it("excludes the exact invalidated timestamp from aggregate diagnostics", () => {
    const invalidated = record({ signalTime: 1673341199999 });
    const diagnostics = calculateM3R3AggregateDiagnostics([invalidated]);
    expect(diagnostics.formalSignals).toBe(0);
    expect(diagnostics.executedTrades).toBe(0);
  });

  it("keeps records at both inclusive validation boundaries", () => {
    const diagnostics = calculateM3R3AggregateDiagnostics([
      record({ signalTime: F1_START }),
      record({ signalTime: F6_END, symbol: "ETHUSDT" }),
    ]);
    expect(diagnostics.formalSignals).toBe(2);
  });

  it("orders by time, then frozen symbol, then LONG before SHORT", () => {
    const values = [
      record({ signalTime: F1_START + 10, symbol: "ETHUSDT", direction: "SHORT" }),
      record({ signalTime: F1_START + 10, symbol: "BTCUSDT", direction: "SHORT" }),
      record({ signalTime: F1_START + 10, symbol: "BTCUSDT", direction: "LONG" }),
      record({ signalTime: F1_START, symbol: "BNBUSDT", direction: "LONG" }),
    ];
    expect(canonicalM3R3IdentityStrings(values)).toEqual([
      `BNBUSDT|LONG|${F1_START}`,
      `BTCUSDT|LONG|${F1_START + 10}`,
      `BTCUSDT|SHORT|${F1_START + 10}`,
      `ETHUSDT|SHORT|${F1_START + 10}`,
    ]);
  });

  it("uses all formal records and only EXECUTED records for the two hashes", () => {
    const executed = record({ signalTime: F1_START });
    const censored = record({ signalTime: F1_START + 10, status: "PERIOD_END_CENSORED", entryTime: null, exitTime: null, grossR: null, feeR: null, fundingR: null, netR: null });
    expect(m3R3FormalIdentityHash([censored, executed])).toBe(
      sha256M3R3RawBytes(Buffer.from(stableStringify([`BTCUSDT|LONG|${F1_START}`, `BTCUSDT|LONG|${F1_START + 10}`]), "utf8")),
    );
    expect(m3R3ExecutedIdentityHash([censored, executed])).toBe(
      sha256M3R3RawBytes(Buffer.from(stableStringify([`BTCUSDT|LONG|${F1_START}`]), "utf8")),
    );
  });

  it("rejects one unsupported symbol before sorting", () => {
    expectRecoveryFailure(() => canonicalM3R3IdentityStrings([{ signalTime: F1_START, symbol: "DOGEUSDT", direction: "LONG" } as never]), "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED");
  });

  it("rejects one unsupported direction before sorting", () => {
    expectRecoveryFailure(() => canonicalM3R3IdentityStrings([{ signalTime: F1_START, symbol: "BTCUSDT", direction: "BUY" } as never]), "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED");
  });

  it("rejects an unsafe timestamp before sorting", () => {
    expectRecoveryFailure(() => canonicalM3R3IdentityStrings([{ signalTime: Number.MAX_SAFE_INTEGER + 1, symbol: "BTCUSDT", direction: "LONG" }]), "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED");
  });

  it("rejects a duplicate identity before hashing", () => {
    expectRecoveryFailure(() => canonicalM3R3IdentityStrings([record(), record()]), "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED");
  });

  it("exposes the identity validator as an explicit pre-sort check", () => {
    const value = { signalTime: F1_START, symbol: "BTCUSDT", direction: "LONG" };
    expect(() => validateM3R3IdentityRecord(value)).not.toThrow();
  });
});

describe("M3-R3-A raw decision snapshot artifact contract", () => {
  it("accepts an exact synthetic 7500-snapshot artifact", () => {
    const parsed = parseM3R3Round002SnapshotArtifact(makeSnapshotArtifact());
    expect(parsed.snapshotCount).toBe(7_500);
    expect(parsed.snapshots).toHaveLength(7_500);
  });

  it("rejects malformed snapshot JSON", () => {
    expectRecoveryFailure(() => parseM3R3Round002SnapshotArtifact("{"), "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED");
  });

  it("rejects a snapshotCount that does not equal snapshots.length", () => {
    const snapshots = Array.from({ length: 7_499 }, (_, index) => makeSnapshot(index));
    expectRecoveryFailure(() => parseM3R3Round002SnapshotArtifact(makeSnapshotArtifact({ snapshotCount: 7_499, snapshots })), "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED");
  });

  it("rejects every mismatched raw envelope field", () => {
    const mismatches = [
      ["schemaVersion", "wrong-schema"],
      ["researchRoundId", "wrong-round"],
      ["executionSourceSha", "wrong-source"],
      ["selectionGateSha256", "wrong-gate"],
      ["experimentPlanSha256", "wrong-plan"],
      ["studyServerTime", 1],
      ["controlReportSha256", "wrong-control"],
    ] as const;
    for (const [field, value] of mismatches) {
      expectRecoveryFailure(
        () => parseM3R3Round002SnapshotArtifact(makeSnapshotArtifact({ [field]: value })),
        "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED",
      );
    }
  });

  it("rejects an invalid snapshot identity or denominator", () => {
    expectRecoveryFailure(
      () => parseM3R3Round002SnapshotArtifact(makeSnapshotArtifact({ snapshots: Array.from({ length: 7_500 }, (_, index) => makeSnapshot(index, index === 1 ? { symbol: "DOGEUSDT" as never } : {})) })),
      "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED",
    );
    expectRecoveryFailure(
      () => parseM3R3Round002SnapshotArtifact(makeSnapshotArtifact({ snapshots: Array.from({ length: 7_500 }, (_, index) => makeSnapshot(index, index === 1 ? { symbol4hAtr: 0 } : {})) })),
      "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED",
    );
  });
});

describe("M3-R3-A raw CONTROL contract", () => {
  const mismatches = [
    ["schemaVersion", "wrong-schema"],
    ["backtestPolicyVersion", "bt-policy-001"],
    ["strategyVersion", "baseline-002"],
    ["period", "DEV"],
    ["studyServerTime", 1],
  ] as const;

  it.each(mismatches)("rejects CONTROL %s mismatch", (field, value) => {
    expectRecoveryFailure(
      () => validateM3R3ControlReportContract(makeControlValue({ [field]: value })),
      "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED",
    );
  });

  it("rejects a formal signal count mismatch", () => {
    expectRecoveryFailure(
      () => validateM3R3ControlReportContract(makeControlValue({ signalResults: makeControlResults().slice(0, 7_499) })),
      "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED",
    );
  });

  it("rejects an EXECUTED count mismatch", () => {
    const results = makeControlResults();
    results[5] = makeControlResult("F1", 5, "ENTRY_OUTSIDE_BRACKET");
    expectRecoveryFailure(
      () => validateM3R3ControlReportContract(makeControlValue({ signalResults: results })),
      "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED",
    );
  });

  it("rejects non-empty diagnostics", () => {
    expectRecoveryFailure(
      () => validateM3R3ControlReportContract(makeControlValue({ diagnostics: ["unexpected"] })),
      "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED",
    );
  });

  it.each(["DATA_INCOMPLETE", "SETTLEMENT_AMBIGUOUS"] as const)("rejects %s signal status", (status) => {
    const results = makeControlResults();
    results[10] = makeControlResult("F1", 10, status);
    expectRecoveryFailure(
      () => validateM3R3ControlReportContract(makeControlValue({ signalResults: results })),
      "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED",
    );
  });

  it("allows economic FAIL when the structural contract passes", () => {
    const report = validateM3R3ControlReportContract(makeControlValue({ status: "FAIL" }));
    expect(report.status).toBe("FAIL");
  });

  it("parses CONTROL from the supplied raw bytes", () => {
    const bytes = new TextEncoder().encode(JSON.stringify(makeControlValue()));
    expect(parseM3R3ControlReportBytes(bytes).signalResults).toHaveLength(7_500);
  });
});

describe("M3-R3-A offline CONTROL parity", () => {
  it("passes formal identity, executed identity, aggregate, and F1-F6 fixtures", () => {
    const results = makeControlResults();
    expect(validateM3R3ControlParity({
      controlReport: makeControlValue() as unknown as BacktestReport,
      round001Evidence: makeParityEvidence(results),
    })).toEqual({ controlParityStatus: "PASS" });
  });

  it("maps formal or executed identity drift to the exact parity failure", () => {
    const results = makeControlResults();
    const evidence = makeParityEvidence(results);
    expectRecoveryFailure(
      () => validateM3R3ControlParity({
        controlReport: makeControlValue() as unknown as BacktestReport,
        round001Evidence: { ...evidence, control: { ...evidence.control, formalIdentitySha256: "drift" } },
      }),
      "ROUND_003_CONTROL_PARITY_FAILED",
    );
    expectRecoveryFailure(
      () => validateM3R3ControlParity({
        controlReport: makeControlValue() as unknown as BacktestReport,
        round001Evidence: { ...evidence, control: { ...evidence.control, executedIdentitySha256: "drift" } },
      }),
      "ROUND_003_CONTROL_PARITY_FAILED",
    );
  });

  it("maps aggregate diagnostic drift to the exact parity failure", () => {
    const results = makeControlResults();
    const evidence = makeParityEvidence(results);
    const diagnostics = evidence.control.aggregateValidation!.diagnostics;
    expectRecoveryFailure(
      () => validateM3R3ControlParity({
        controlReport: makeControlValue() as unknown as BacktestReport,
        round001Evidence: {
          ...evidence,
          control: {
            ...evidence.control,
            aggregateValidation: { diagnostics: { ...diagnostics, netR: diagnostics.netR + 1 } } as never,
          },
        },
      }),
      "ROUND_003_CONTROL_PARITY_FAILED",
    );
  });

  it("maps individual fold diagnostic drift to the exact parity failure", () => {
    const results = makeControlResults();
    const evidence = makeParityEvidence(results);
    const folds = evidence.control.folds.map((fold, index) => index === 0
      ? { ...fold, diagnostics: { ...fold.diagnostics, formalSignals: fold.diagnostics.formalSignals + 1 } }
      : fold);
    expectRecoveryFailure(
      () => validateM3R3ControlParity({
        controlReport: makeControlValue() as unknown as BacktestReport,
        round001Evidence: { ...evidence, control: { ...evidence.control, folds } },
      }),
      "ROUND_003_CONTROL_PARITY_FAILED",
    );
  });

  it("does not compare Round-001 studyServerTime during parity", () => {
    const results = makeControlResults();
    const evidence = makeParityEvidence(results);
    expect(validateM3R3ControlParity({
      controlReport: makeControlValue() as unknown as BacktestReport,
      round001Evidence: { ...evidence, studyServerTime: 1 },
    })).toEqual({ controlParityStatus: "PASS" });
  });
});

describe("M3-R3-A raw-byte verifier and offline boundary", () => {
  it("has one object argument and no independently supplied snapshot envelope", () => {
    const source = readFileSync("src/lib/research/m3-r3-round-003-recovery.ts", "utf8");
    expect(verifyM3R3Round002InputArtifacts.length).toBe(1);
    expect(source).not.toMatch(/snapshotEnvelope/);
  });

  it("fails raw artifact hash mismatches before parsing caller content", () => {
    const controlBytes = new TextEncoder().encode("control");
    const snapshotBytes = new TextEncoder().encode("snapshots");
    expect(sha256M3R3RawBytes(controlBytes)).not.toBe(M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256);
    expect(sha256M3R3RawBytes(snapshotBytes)).not.toBe(M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256);
    expectRecoveryFailure(
      () => verifyM3R3Round002InputArtifacts({ controlReportBytes: controlBytes, decisionSnapshotBytes: snapshotBytes }),
      "ROUND_003_INPUT_ARTIFACT_HASH_MISMATCH",
    );
  });

  it("verifies the immutable Round-001 evidence SHA and contract", () => {
    const bytes = readFileSync("docs/evidence/M3_H_ROUND_001_SUMMARY.json");
    expect(sha256M3R3RawBytes(bytes)).toBe(M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256);
    expect(parseM3R3Round001EvidenceBytes(bytes).evidenceStatus).toBe("COMPLETE");
  });

  it("imports no Binance, network, historical, backtest, settlement, or candidate execution path", () => {
    const recoverySource = readFileSync("src/lib/research/m3-r3-round-003-recovery.ts", "utf8");
    const scriptSource = readFileSync("scripts/m3-r3-a-verify-reuse.ts", "utf8");
    expect(recoverySource).not.toMatch(/Binance|historical loader|runBacktest|evaluateStrategy|settlement runner|fetch\(/i);
    expect(scriptSource).not.toMatch(/fetch\(|https?:\/\/|selector|performance|candidate/i);
  });

  it("keeps the Round-003 gate SHA exact and the plan SHA self-consistent", () => {
    expect(BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256).toBe(
      "297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2",
    );
    expect(createHash("sha256").update(stableStringify(M3_R3_ROUND_003_PLAN), "utf8").digest("hex")).toBe(M3_R3_ROUND_003_PLAN_SHA256);
    expect(M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS).toBe("VERIFIED_REUSABLE_INPUT");
    expect(M3_R3_ROUND_003_EXPECTED_EXECUTED_COUNT).toBe(7_495);
    expect(M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT).toBe(7_500);
  });
});
