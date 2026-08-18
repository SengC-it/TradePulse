import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { RESEARCH_FOLDS } from "../src/lib/research/folds.ts";
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
  M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT,
  M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME,
  calculateM3R3AggregateDiagnostics,
  canonicalM3R3IdentityStrings,
  m3R3ExecutedIdentityHash,
  m3R3FormalIdentityHash,
  sha256M3R3RawBytes,
  verifyM3R3Round002InputArtifacts,
  M3R3RecoveryError,
} from "../src/lib/research/m3-r3-round-003-recovery.ts";
import { M3_R2_ROUND_002_SELECTOR_SPECS } from "../src/lib/research/m3-r2-round-002-plan.ts";
import type { NormalizedResearchSignal } from "../src/lib/research/types.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const F1_START = RESEARCH_FOLDS.F1.validation.startTime;
const F6_END = RESEARCH_FOLDS.F6.validation.endTime;

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

describe("M3-R3-A Round-003 machine freeze", () => {
  it("uses a new round while retaining the exact nine candidate identities", () => {
    expect(M3_R3_ROUND_003_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-003");
    expect(M3_R3_ROUND_003_CANDIDATE_IDS).toEqual([
      "R2-H6-STRICT-BTC",
      "R2-H7-STRONG-SYMBOL",
      "R2-H8-RECENT-PULLBACK",
      "R2-H9-VOLUME-CONFIRM",
      "R2-H10-BREAKOUT-010",
      "R2-C1-BTC-STRONG-SYMBOL",
      "R2-C2-STRONG-SYMBOL-RECENT-PULLBACK",
      "R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT",
      "R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT",
    ]);
    expect(BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256).toBe(
      "297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2",
    );
    expect(M3_R3_ROUND_003_INHERITED_SELECTION_GATE_SHA256).toBe(
      "9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0",
    );
    expect(M3_R3_ROUND_003_PLAN_SHA256).toBe(
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

describe("M3-R3-A aggregate validation repair", () => {
  it("filters a pre-F1 record before calling diagnostics", () => {
    const beforeF1 = record({ signalTime: Date.parse("2023-01-10T08:59:59.999Z") });
    const inValidation = record({ signalTime: F1_START + 1_000 });
    const diagnostics = calculateM3R3AggregateDiagnostics([beforeF1, inValidation]);
    expect(diagnostics.formalSignals).toBe(1);
    expect(diagnostics.range).toEqual(M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE);
  });

  it("excludes the exact invalidated timestamp from F1-F6 aggregate diagnostics", () => {
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
});

describe("M3-R3-A canonical identity hashing repair", () => {
  it("orders by time, then frozen symbol, then direction", () => {
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

  it("uses all formal records for formal hash and EXECUTED records for executed hash", () => {
    const executed = record({ signalTime: F1_START });
    const censored = record({ signalTime: F1_START + 10, status: "PERIOD_END_CENSORED", entryTime: null, exitTime: null, grossR: null, feeR: null, fundingR: null, netR: null });
    expect(m3R3FormalIdentityHash([censored, executed])).toBe(
      sha256M3R3RawBytes(Buffer.from(stableStringify([`BTCUSDT|LONG|${F1_START}`, `BTCUSDT|LONG|${F1_START + 10}`]), "utf8")),
    );
    expect(m3R3ExecutedIdentityHash([censored, executed])).toBe(
      sha256M3R3RawBytes(Buffer.from(stableStringify([`BTCUSDT|LONG|${F1_START}`]), "utf8")),
    );
  });

  it("rejects duplicate identities fail-closed", () => {
    expect(() => canonicalM3R3IdentityStrings([record(), record()])).toThrow(M3R3RecoveryError);
  });
});

describe("M3-R3-A artifact reuse boundary", () => {
  it("requires exact raw hashes and the invalidated Round-002 envelope", () => {
    const controlBytes = new TextEncoder().encode("control");
    const snapshotBytes = new TextEncoder().encode("snapshots");
    const controlHash = sha256M3R3RawBytes(controlBytes);
    const snapshotHash = sha256M3R3RawBytes(snapshotBytes);
    const expectedControl = M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256;
    const expectedSnapshots = M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256;
    expect(controlHash).not.toBe(expectedControl);
    expect(snapshotHash).not.toBe(expectedSnapshots);
    expect(() => verifyM3R3Round002InputArtifacts({
      controlReportBytes: controlBytes,
      decisionSnapshotBytes: snapshotBytes,
      snapshotEnvelope: {
        researchRoundId: "baseline-002-research-round-002",
        executionSourceSha: "9df170b7f72a95971825e126d4096e1e4f16be5f",
        selectionGateSha256: "9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0",
        experimentPlanSha256: "82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511",
        studyServerTime: M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME,
        controlReportSha256: expectedControl,
        snapshotCount: M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT,
      },
    })).toThrow(M3R3RecoveryError);
    expect(M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS).toBe("VERIFIED_REUSABLE_INPUT");
  });

  it("does not import network, historical, backtest, or settlement execution paths", () => {
    const source = readFileSync("src/lib/research/m3-r3-round-003-recovery.ts", "utf8");
    expect(source).not.toMatch(/Binance|historical loader|runBacktest|evaluateStrategy|settlement runner|fetch\(/i);
  });
});
