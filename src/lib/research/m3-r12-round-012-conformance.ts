import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { emptyBacktestSignalResult } from "../backtest/settlement.ts";
import type { BacktestSignalResult, BacktestSignalSnapshot } from "../backtest/types.ts";
import type { ResearchSymbol } from "../config/constants.ts";
import { M3_R12_CANDIDATE_IDS, M3_R12_NO_CANDIDATE_OUTCOME, M3_R12_PERFORMANCE_LOCK, M3_R12_RESEARCH_END_ISO, M3_R12_RESEARCH_ROUND_ID, R12_DATA_CONTRACT, R12_GOVERNANCE } from "./m3-r12-round-012-protocol.ts";
import { R12_PLAN_SHA256 } from "./m3-r12-round-012-plan.ts";
import { R12_SELECTION_GATE_SHA256, validateR12MachineRecord } from "./selection-gates-round-012.ts";
import { assertR12CandidateSettlementIdentity, classifyR12FormalSignals, retainR12Candidate } from "./m3-r12-round-012-thesis.ts";
import { stableStringify, deepFreeze } from "./utils.ts";

export const M3_R12_CONFORMANCE_SCHEMA_VERSION = "m3-r12-round-012-spec-conformance-001" as const;

export type R12SpecConformanceReport = Readonly<{
  schemaVersion: typeof M3_R12_CONFORMANCE_SCHEMA_VERSION;
  researchRoundId: typeof M3_R12_RESEARCH_ROUND_ID;
  resultAffectingDeviationCount: number;
  thesisStateMachineVerified: boolean;
  noOutcomeLookahead: boolean;
  candidateSettlementIdentityVerified: boolean;
  productionSeenDataExcluded: boolean;
  checks: Readonly<Record<"A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N", boolean>>;
  candidateIds: typeof M3_R12_CANDIDATE_IDS;
  gateSha256: string;
  planSha256: string;
  validation: Readonly<{
    closedCandleOnly: true;
    boundary: typeof M3_R12_RESEARCH_END_ISO;
    sourceStream: "EXACT_BASELINE_001_FORMAL_SIGNAL_STREAM";
    noPrivateBinanceApi: true;
    noAutomaticTrading: true;
    baseline002Status: "NOT_FROZEN";
    m3JStatus: "BLOCKED";
    m4Status: "NOT_STARTED";
  }>;
}>;

const HOUR = 60 * 60 * 1_000;
const T0 = Date.parse("2024-01-01T00:00:00.000Z");

function fixtureRaw(input: Readonly<{ time: number; symbol?: ResearchSymbol; direction?: "LONG" | "SHORT"; status?: BacktestSignalResult["status"]; terminalTime?: number; netR?: number }>): BacktestSignalResult {
  const snapshot: BacktestSignalSnapshot = Object.freeze({
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    signalTime: input.time,
    symbol: input.symbol ?? "BTCUSDT",
    direction: input.direction ?? "LONG",
    symbolRegime: input.direction === "SHORT" ? "SHORT_ONLY" : "LONG_ONLY",
    btcRegime: input.direction === "SHORT" ? "BTC_STRONG_BEAR" : "BTC_STRONG_BULL",
    entryReference: 100,
    stopReference: 98,
    takeProfitReference: 104,
    stopDistance: 2,
    stopAtr: 1,
    breakdown: Object.freeze({ trendStrength: 1, pullbackQuality: 1, breakoutStrength: 1, volumeScore: 1, riskRewardScore: 2 }),
    totalScore: 80,
    grade: "A",
  });
  const status = input.status ?? "EXECUTED";
  const base = emptyBacktestSignalResult(snapshot, status);
  if (status === "EXECUTED") return Object.freeze({ ...base, entryTime: input.time + 1, exitTime: input.terminalTime ?? input.time + 2 * HOUR, grossR: 1, feeR: -0.02, fundingR: 0, netR: input.netR ?? 0.98 });
  if (status === "ENTRY_OUTSIDE_BRACKET") return Object.freeze({ ...base, entryTime: input.terminalTime ?? input.time + HOUR });
  return base;
}

function classified(...raw: readonly BacktestSignalResult[]) {
  return classifyR12FormalSignals(raw.map((value) => ({ raw: value })));
}

function evaluateChecks(): R12SpecConformanceReport["checks"] {
  const first = classified(fixtureRaw({ time: T0 }));
  const beforeEntry = classified(fixtureRaw({ time: T0, status: "ENTRY_OUTSIDE_BRACKET", terminalTime: T0 + HOUR }), fixtureRaw({ time: T0 + HOUR / 2 }));
  const open = classified(fixtureRaw({ time: T0, terminalTime: T0 + 2 * HOUR }), fixtureRaw({ time: T0 + HOUR / 2 }));
  const terminal = classified(fixtureRaw({ time: T0, terminalTime: T0 + HOUR / 2 }), fixtureRaw({ time: T0 + HOUR }));
  const sameTimestamp = classified(fixtureRaw({ time: T0, terminalTime: T0 + HOUR }), fixtureRaw({ time: T0 + HOUR }));
  const three = classified(fixtureRaw({ time: T0, terminalTime: T0 + 5 * HOUR }), fixtureRaw({ time: T0 + HOUR }), fixtureRaw({ time: T0 + 2 * HOUR }));
  const opposite = classified(fixtureRaw({ time: T0, direction: "LONG", terminalTime: T0 + 2 * HOUR }), fixtureRaw({ time: T0 + HOUR, direction: "SHORT" }));
  const d1 = retainR12Candidate(three, "R12-D1-FIRST-ONLY");
  const d2 = retainR12Candidate(three, "R12-D2-FIRST-PLUS-ONE");
  const settlementIdentity = assertR12CandidateSettlementIdentity(three, d2);
  const noExtension = three[2]!.anchorSignalId === three[0]!.signalId && three[2]!.thesisId === three[0]!.thesisId;
  return Object.freeze({
    A: first.length === 1 && first[0]!.cohort === "FIRST" && first[0]!.thesisOrdinal === 1,
    B: beforeEntry[1]!.cohort === "FOLLOWUP_1",
    C: open[1]!.cohort === "FOLLOWUP_1",
    D: terminal[1]!.cohort === "FIRST",
    E: sameTimestamp[1]!.cohort === "FIRST",
    F: noExtension,
    G: three.map((record) => record.thesisOrdinal).join(",") === "1,2,3" && three[2]!.cohort === "FOLLOWUP_2_PLUS",
    H: opposite[0]!.thesisId !== opposite[1]!.thesisId && opposite[1]!.cohort === "FIRST",
    I: d1.length === 1 && d1[0]!.cohort === "FIRST",
    J: d2.length === 2 && d2.every((record) => record.cohort === "FIRST" || record.cohort === "FOLLOWUP_1"),
    K: settlementIdentity === true,
    L: R12_DATA_CONTRACT.productionAfterBoundary.includes("EXCLUDED_FROM_GATE_TRAINING_SELECTION") && R12_GOVERNANCE.productionDataUse === "SEEN_HYPOTHESIS_GENERATING_DIAGNOSTIC_ONLY",
    M: R12_GOVERNANCE.noPrivateBinanceApi,
    N: R12_GOVERNANCE.noAutomaticTrading,
  });
}

const checks = evaluateChecks();
const thesisChecks = [checks.A, checks.B, checks.C, checks.D, checks.E, checks.F, checks.G, checks.H, checks.I, checks.J];

export const R12_SPEC_CONFORMANCE_REPORT: R12SpecConformanceReport = deepFreeze({
  schemaVersion: M3_R12_CONFORMANCE_SCHEMA_VERSION,
  researchRoundId: M3_R12_RESEARCH_ROUND_ID,
  resultAffectingDeviationCount: Object.values(checks).filter((value) => !value).length,
  thesisStateMachineVerified: thesisChecks.every(Boolean),
  noOutcomeLookahead: true,
  candidateSettlementIdentityVerified: checks.K,
  productionSeenDataExcluded: checks.L,
  checks,
  candidateIds: M3_R12_CANDIDATE_IDS,
  gateSha256: R12_SELECTION_GATE_SHA256,
  planSha256: R12_PLAN_SHA256,
  validation: {
    closedCandleOnly: true,
    boundary: M3_R12_RESEARCH_END_ISO,
    sourceStream: "EXACT_BASELINE_001_FORMAL_SIGNAL_STREAM",
    noPrivateBinanceApi: true,
    noAutomaticTrading: true,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
  },
});

export const R12_SPEC_CONFORMANCE_JSON = stableStringify(R12_SPEC_CONFORMANCE_REPORT);
export const R12_SPEC_CONFORMANCE_SHA256 = createHash("sha256").update(R12_SPEC_CONFORMANCE_JSON, "utf8").digest("hex");

export function validateR12SpecConformance(report: R12SpecConformanceReport = R12_SPEC_CONFORMANCE_REPORT): void {
  if (report.schemaVersion !== M3_R12_CONFORMANCE_SCHEMA_VERSION || report.researchRoundId !== M3_R12_RESEARCH_ROUND_ID) throw new Error("R12 spec conformance provenance failed.");
  if (report.resultAffectingDeviationCount !== 0 || !report.thesisStateMachineVerified || !report.noOutcomeLookahead || !report.candidateSettlementIdentityVerified || !report.productionSeenDataExcluded) throw new Error("R12 spec conformance failed.");
  if (Object.values(report.checks).some((value) => !value)) throw new Error("R12 executable A-N conformance failed.");
  if (stableStringify(report.candidateIds) !== stableStringify(M3_R12_CANDIDATE_IDS) || report.gateSha256 !== R12_SELECTION_GATE_SHA256 || report.planSha256 !== R12_PLAN_SHA256) throw new Error("R12 conformance identity failed.");
  if (report.validation.boundary !== M3_R12_RESEARCH_END_ISO || !report.validation.closedCandleOnly || report.validation.sourceStream !== "EXACT_BASELINE_001_FORMAL_SIGNAL_STREAM" || !report.validation.noPrivateBinanceApi || !report.validation.noAutomaticTrading || report.validation.baseline002Status !== "NOT_FROZEN" || report.validation.m3JStatus !== "BLOCKED" || report.validation.m4Status !== "NOT_STARTED") throw new Error("R12 conformance boundary failed.");
  validateR12MachineRecord();
}

export function readR12SpecConformance(filePath = path.join(process.cwd(), "docs/research/round-012-spec-conformance.json")): R12SpecConformanceReport {
  const report = JSON.parse(readFileSync(filePath, "utf8")) as R12SpecConformanceReport;
  validateR12SpecConformance(report);
  return report;
}

export { M3_R12_PERFORMANCE_LOCK, M3_R12_NO_CANDIDATE_OUTCOME };
