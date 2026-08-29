import { describe, expect, it } from "vitest";

import { emptyBacktestSignalResult } from "../src/lib/backtest/settlement.ts";
import type { BacktestSignalResult, BacktestSignalSnapshot } from "../src/lib/backtest/types.ts";
import { M3_R12_CANDIDATE_IDS, R12_CANDIDATE_REGISTRY, R12_THESIS_CONTRACT } from "../src/lib/research/m3-r12-round-012-protocol.ts";
import { assertR12CandidateSettlementIdentity, classifyR12FormalSignals, r12AnchorTerminalTime, retainR12Candidate } from "../src/lib/research/m3-r12-round-012-thesis.ts";

const HOUR = 60 * 60 * 1_000;
const T0 = Date.parse("2024-01-01T00:00:00.000Z");

function raw(time: number, options: Readonly<{ direction?: "LONG" | "SHORT"; status?: BacktestSignalResult["status"]; terminalTime?: number; entryReference?: number }> = {}): BacktestSignalResult {
  const direction = options.direction ?? "LONG";
  const snapshot: BacktestSignalSnapshot = Object.freeze({
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    signalTime: time,
    symbol: "BTCUSDT",
    direction,
    symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
    btcRegime: direction === "LONG" ? "BTC_STRONG_BULL" : "BTC_STRONG_BEAR",
    entryReference: options.entryReference ?? 100,
    stopReference: direction === "LONG" ? 98 : 102,
    takeProfitReference: direction === "LONG" ? 104 : 96,
    stopDistance: 2,
    stopAtr: 1,
    breakdown: Object.freeze({ trendStrength: 1, pullbackQuality: 1, breakoutStrength: 1, volumeScore: 1, riskRewardScore: 2 }),
    totalScore: 80,
    grade: "A",
  });
  const status = options.status ?? "EXECUTED";
  const base = emptyBacktestSignalResult(snapshot, status);
  if (status === "EXECUTED") return Object.freeze({ ...base, entryTime: time + 1, exitTime: options.terminalTime ?? time + 2 * HOUR, grossR: 1, feeR: -0.02, fundingR: 0, netR: 0.98 });
  if (status === "ENTRY_OUTSIDE_BRACKET") return Object.freeze({ ...base, entryTime: options.terminalTime ?? time + HOUR });
  return base;
}

function classify(...records: readonly BacktestSignalResult[]) {
  return classifyR12FormalSignals(records.map((record) => ({ raw: record })));
}

describe("M3-R12 thesis deduplication state machine", () => {
  it("starts a FIRST anchor and records deterministic diagnostic identity", () => {
    const [record] = classify(raw(T0, { entryReference: 101 }));
    expect(record?.cohort).toBe("FIRST");
    expect(record?.thesisOrdinal).toBe(1);
    expect(record?.anchorSignalId).toBe(record?.signalId);
    expect(record?.thesisId).toContain("BTCUSDT-LONG");
    expect(record?.directionAdjustedPriceExtensionFromFirstAtr).toBe(0);
  });

  it("classifies pre-entry and open same-direction signals as follow-ups", () => {
    expect(classify(raw(T0, { status: "ENTRY_OUTSIDE_BRACKET", terminalTime: T0 + HOUR }), raw(T0 + HOUR / 2))[1]?.cohort).toBe("FOLLOWUP_1");
    expect(classify(raw(T0, { terminalTime: T0 + 2 * HOUR }), raw(T0 + HOUR / 2))[1]?.cohort).toBe("FOLLOWUP_1");
  });

  it("ends the thesis before a later signal, including at the same timestamp", () => {
    expect(classify(raw(T0, { terminalTime: T0 + HOUR / 2 }), raw(T0 + HOUR))[1]?.cohort).toBe("FIRST");
    expect(classify(raw(T0, { terminalTime: T0 + HOUR }), raw(T0 + HOUR))[1]?.cohort).toBe("FIRST");
    expect(r12AnchorTerminalTime(raw(T0, { status: "ENTRY_OUTSIDE_BRACKET", terminalTime: T0 + HOUR }))).toBe(T0 + HOUR);
  });

  it("does not let follow-ups extend the anchor and keeps directions separate", () => {
    const records = classify(raw(T0, { terminalTime: T0 + 2 * HOUR }), raw(T0 + HOUR), raw(T0 + 3 * HOUR));
    expect(records.map((record) => record.cohort)).toEqual(["FIRST", "FOLLOWUP_1", "FIRST"]);
    expect(records[1]?.anchorSignalId).toBe(records[0]?.signalId);
    const opposite = classify(raw(T0, { direction: "LONG", terminalTime: T0 + 2 * HOUR }), raw(T0 + HOUR, { direction: "SHORT" }));
    expect(opposite.map((record) => record.cohort)).toEqual(["FIRST", "FIRST"]);
    expect(opposite[0]?.thesisId).not.toBe(opposite[1]?.thesisId);
  });

  it("assigns FOLLOWUP_1 and FOLLOWUP_2_PLUS deterministically", () => {
    const records = classify(raw(T0, { terminalTime: T0 + 10 * HOUR }), raw(T0 + HOUR), raw(T0 + 2 * HOUR), raw(T0 + 3 * HOUR));
    expect(records.map((record) => [record.thesisOrdinal, record.cohort])).toEqual([[1, "FIRST"], [2, "FOLLOWUP_1"], [3, "FOLLOWUP_2_PLUS"], [4, "FOLLOWUP_2_PLUS"]]);
  });

  it("fails closed for ambiguous or incomplete settlement", () => {
    expect(() => classify(raw(T0, { status: "DATA_INCOMPLETE" }))).toThrow("fail-closed");
    expect(() => classify(raw(T0, { status: "SETTLEMENT_AMBIGUOUS" }))).toThrow("fail-closed");
  });

  it("retains exactly the frozen D1 and D2 cohorts and reuses settlement", () => {
    const control = classify(raw(T0, { terminalTime: T0 + 10 * HOUR }), raw(T0 + HOUR), raw(T0 + 2 * HOUR));
    const d1 = retainR12Candidate(control, "R12-D1-FIRST-ONLY");
    const d2 = retainR12Candidate(control, "R12-D2-FIRST-PLUS-ONE");
    expect(d1).toHaveLength(1);
    expect(d2).toHaveLength(2);
    expect(assertR12CandidateSettlementIdentity(control, d2)).toBe(true);
    expect(d2[1]?.raw).toBe(control[1]?.raw);
  });

  it("freezes exactly two non-tuned retention candidates", () => {
    expect(M3_R12_CANDIDATE_IDS).toEqual(["R12-D1-FIRST-ONLY", "R12-D2-FIRST-PLUS-ONE"]);
    expect(R12_CANDIDATE_REGISTRY).toHaveLength(2);
    expect(R12_CANDIDATE_REGISTRY.every((candidate) => Object.keys(candidate.parameters).length === 0)).toBe(true);
    expect(R12_THESIS_CONTRACT.followupsDoNotExtendAnchor).toBe(true);
  });
});
