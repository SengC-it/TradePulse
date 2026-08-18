import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BASELINE_002_RESEARCH_ROUND_004_CANONICAL_JSON,
  BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES,
  M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R4_ROUND_004_CANDIDATE_IDS,
  M3_R4_ROUND_004_COMPLEXITY_TUPLES,
  M3_R4_ROUND_004_CONTROL_ID,
  M3_R4_ROUND_004_HARD_GATE_IDENTITIES,
  M3_R4_ROUND_004_INVALIDATING_CATEGORIES,
  M3_R4_ROUND_004_INHERITED_SELECTION_GATE_SHA256,
  M3_R4_ROUND_004_MECHANISM_IDS,
  M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME,
  M3_R4_ROUND_004_PERFORMANCE_LOCK,
  M3_R4_ROUND_004_PLAN,
  M3_R4_ROUND_004_PLAN_CANONICAL_JSON,
  M3_R4_ROUND_004_PLAN_SCHEMA_VERSION,
  M3_R4_ROUND_004_R4A_DIAGNOSIS_RAW_SHA256,
  M3_R4_ROUND_004_R4A_PROTOCOL_RAW_SHA256,
  M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  M3_R4_ROUND_004_SOURCE_SHA,
  M3_R4_ROUND_004_SYMBOL_ORDER,
  M3_R4_ROUND_004_DATA_CLASSIFICATION,
  allDecisionTimeCandles,
  computeH11BreakoutLevel,
  computeH11RiskGeometry,
  computeH12RiskGeometry,
  computeH14Momentum24hAtSignal,
  computeH14Momentum24h,
  evaluateH11Retest,
  evaluateH12Reclaim,
  evaluateH13ExitStep,
  evaluateH14Eligibility,
  M3_R4_BT_POLICY_003_GLOBAL_HELD_CANDLE_COUNT,
  resolveH13TrendExitAtNextOpen,
  h13EntryProtectiveStopValid,
  isDecisionTimeCandle,
  m3R4SignalIdentity,
  rankH14RelativeStrength,
  reuseH14ControlOutcome,
  selectH11QualifyingOrigin,
  selectH11QualifiedRetestOrigin,
  validateM3R4Round004MachineRecord,
  validateM3R4Round004Plan,
  type M3R4BaselineFormalOrigin,
  type M3R4Candle,
  type H12ReclaimInput,
  type H11QualifiedOriginCandidate,
} from "../src/lib/research/index.ts";

const HOUR = 60 * 60 * 1000;

function candle(closeTime: number, values: Partial<Omit<M3R4Candle, "openTime" | "closeTime">> = {}): M3R4Candle {
  const open = values.open ?? 100;
  const close = values.close ?? 101;
  const high = values.high ?? Math.max(open, close) + 1;
  const low = values.low ?? Math.min(open, close) - 1;
  return { openTime: closeTime - HOUR + 1, closeTime, open, high, low, close };
}

function origin(overrides: Partial<M3R4BaselineFormalOrigin> = {}): M3R4BaselineFormalOrigin {
  return {
    signalTime: 4 * HOUR,
    evaluationClosedThrough: 4 * HOUR,
    symbol: "ETHUSDT",
    direction: "LONG",
    formalSignal: true,
    totalScore: 70,
    grade: "C",
    originStopReference: 98,
    ...overrides,
  };
}

function h11Candidate(
  signalTime = 4 * HOUR,
  overrides: Partial<H11QualifiedOriginCandidate> = {},
): H11QualifiedOriginCandidate {
  const base: H11QualifiedOriginCandidate = {
    ...origin({ signalTime, originStopReference: 100 }),
    candlesBeforeOrigin: [
      candle(signalTime - 3 * HOUR, { high: 103 }),
      candle(signalTime - 2 * HOUR, { high: 104 }),
      candle(signalTime - HOUR, { high: 105 }),
    ],
    candlesFromFirstAfterOrigin: [],
  };
  return { ...base, ...overrides };
}

function h11Current(closeTime: number, values: Partial<Omit<M3R4Candle, "openTime" | "closeTime">> = {}) {
  return { ...candle(closeTime, { open: 105, low: 104, close: 106, ...values }), atr14: 2 };
}

type H12Overrides = Omit<Partial<H12ReclaimInput>, "previous" | "current"> & {
  previous?: Partial<H12ReclaimInput["previous"]>;
  current?: Partial<H12ReclaimInput["current"]>;
};

function h12(overrides: H12Overrides = {}): H12ReclaimInput {
  const base: H12ReclaimInput = {
    signalTime: 10 * HOUR,
    symbol: "ETHUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_STRONG_BULL",
    previous: { openTime: 8 * HOUR + 1, closeTime: 9 * HOUR, high: 101, low: 99, close: 99.5, ema20: 100, ema50: 102 },
    current: { openTime: 9 * HOUR + 1, closeTime: 10 * HOUR, high: 103, low: 100, close: 102, ema20: 100.5, rsi14: 60, atr14: 2 },
  };
  const { previous: previousOverrides, current: currentOverrides, ...scalarOverrides } = overrides;
  return {
    ...base,
    ...scalarOverrides,
    previous: { ...base.previous, ...previousOverrides },
    current: { ...base.current, ...currentOverrides },
  };
}

function controlOutcome(overrides: Partial<{ symbol: "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "XRPUSDT" | "BNBUSDT"; direction: "LONG" | "SHORT"; signalTime: number }> = {}) {
  return { symbol: "ETHUSDT" as const, direction: "LONG" as const, signalTime: 10 * HOUR, result: "CONTROL_RESULT", ...overrides };
}

describe("M3-R4-B machine gate and governance", () => {
  const cases: readonly [string, () => void][] = [
    ["01 freezes the research round id", () => expect(M3_R4_ROUND_004_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-004")],
    ["02 freezes the authoritative source SHA", () => expect(M3_R4_ROUND_004_SOURCE_SHA).toBe("1bab6066cd4e9933c3d50ab29a38e9ad0792e5c8")],
    ["03 inherits the Round-003 gate SHA", () => expect(M3_R4_ROUND_004_INHERITED_SELECTION_GATE_SHA256).toBe("297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2")],
    ["04 validates the canonical gate record", () => expect(validateM3R4Round004MachineRecord()).toBe(BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD)],
    ["05 recomputes the canonical gate SHA", () => expect(createHash("sha256").update(BASELINE_002_RESEARCH_ROUND_004_CANONICAL_JSON, "utf8").digest("hex")).toBe(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256)],
    ["06 freezes the plan schema", () => expect(M3_R4_ROUND_004_PLAN_SCHEMA_VERSION).toBe("m3-r4-round-004-plan-001")],
    ["07 validates the canonical plan", () => expect(validateM3R4Round004Plan()).toBe(M3_R4_ROUND_004_PLAN)],
    ["08 recomputes the canonical plan SHA", () => expect(createHash("sha256").update(M3_R4_ROUND_004_PLAN_CANONICAL_JSON, "utf8").digest("hex")).toBe("f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981")],
    ["09 freezes the CONTROL id", () => expect(M3_R4_ROUND_004_CONTROL_ID).toBe("R4-CONTROL-BASELINE-001")],
    ["10 freezes baseline-001 for CONTROL", () => expect(M3_R4_ROUND_004_PLAN.control.strategyVersion).toBe("baseline-001")],
    ["11 freezes bt-policy-003 for CONTROL", () => expect(M3_R4_ROUND_004_PLAN.control.backtestPolicyVersion).toBe("bt-policy-003")],
    ["12 keeps the candidate count at four", () => expect(M3_R4_ROUND_004_PLAN.candidateCount).toBe(4)],
    ["13 preserves exact candidate order", () => expect(M3_R4_ROUND_004_PLAN.candidateIds).toEqual([...M3_R4_ROUND_004_CANDIDATE_IDS])],
    ["14 preserves exact mechanism order", () => expect(M3_R4_ROUND_004_PLAN.mechanismIds).toEqual([...M3_R4_ROUND_004_MECHANISM_IDS])],
    ["15 freezes H11 complexity", () => expect(M3_R4_ROUND_004_COMPLEXITY_TUPLES["R4-H11-BREAKOUT-RETEST"]).toEqual({ newRules: 3, newTunableThresholds: 1, modifiedBaselineRules: 2, mechanismFamiliesUsed: 1 })],
    ["16 freezes H12 complexity", () => expect(M3_R4_ROUND_004_COMPLEXITY_TUPLES["R4-H12-PULLBACK-RECLAIM"]).toEqual({ newRules: 3, newTunableThresholds: 0, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 })],
    ["17 freezes H13 complexity", () => expect(M3_R4_ROUND_004_COMPLEXITY_TUPLES["R4-H13-ADAPTIVE-TREND-EXIT"]).toEqual({ newRules: 2, newTunableThresholds: 1, modifiedBaselineRules: 2, mechanismFamiliesUsed: 1 })],
    ["18 freezes H14 complexity", () => expect(M3_R4_ROUND_004_COMPLEXITY_TUPLES["R4-H14-RELATIVE-STRENGTH"]).toEqual({ newRules: 1, newTunableThresholds: 2, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 })],
    ["19 keeps performance ungenerated", () => expect(M3_R4_ROUND_004_PLAN.performanceStatus).toBe("NOT_GENERATED")],
    ["20 keeps performance unauthorized in R4-B", () => expect(M3_R4_ROUND_004_PLAN.performanceAuthorization).toBe("NONE_IN_M3_R4_B")],
    ["21 forbids candidate combinations", () => expect(M3_R4_ROUND_004_PLAN.noCombinations).toBe(true)],
    ["22 forbids tuning", () => expect(M3_R4_ROUND_004_PLAN.noTuning).toBe(true)],
    ["23 binds R4-A diagnosis provenance", () => expect(M3_R4_ROUND_004_PLAN.r4AProvenance.diagnosisRawSha256).toBe(M3_R4_ROUND_004_R4A_DIAGNOSIS_RAW_SHA256)],
    ["24 binds R4-A protocol provenance", () => expect(M3_R4_ROUND_004_PLAN.r4AProvenance.protocolRawSha256).toBe(M3_R4_ROUND_004_R4A_PROTOCOL_RAW_SHA256)],
    ["25 freezes seen-data classification", () => expect(M3_R4_ROUND_004_DATA_CLASSIFICATION).toBe("RESEARCH_AVAILABLE_SEEN_DATA")],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-B H11 breakout-retest", () => {
  const cases: readonly [string, () => void][] = [
    ["26 selects the newest age-1 qualifying origin", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(5 * HOUR), symbol: "ETHUSDT", direction: "LONG", origins: [origin()] }).origin?.signalTime).toBe(4 * HOUR)],
    ["27 accepts the oldest frozen age-4 origin", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(8 * HOUR), symbol: "ETHUSDT", direction: "LONG", origins: [origin()] }).originAgeBars).toBe(4)],
    ["28 rejects an age-5 origin", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(9 * HOUR), symbol: "ETHUSDT", direction: "LONG", origins: [origin()] }).origin).toBeNull()],
    ["29 skips a newer non-formal origin", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(6 * HOUR), symbol: "ETHUSDT", direction: "LONG", origins: [origin({ signalTime: 5 * HOUR, formalSignal: false }), origin()] }).origin?.signalTime).toBe(4 * HOUR)],
    ["30 accepts totalScore exactly 70", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(5 * HOUR), symbol: "ETHUSDT", direction: "LONG", origins: [origin({ totalScore: 70 })] }).reason).toBe("PASS")],
    ["31 rejects totalScore 69", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(5 * HOUR), symbol: "ETHUSDT", direction: "LONG", origins: [origin({ totalScore: 69 })] }).origin).toBeNull()],
    ["32 rejects a different symbol", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(5 * HOUR), symbol: "BTCUSDT", direction: "LONG", origins: [origin()] }).origin).toBeNull()],
    ["33 rejects a different direction", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(5 * HOUR), symbol: "ETHUSDT", direction: "SHORT", origins: [origin()] }).origin).toBeNull()],
    ["34 rejects an origin evaluated with future data", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(5 * HOUR), symbol: "ETHUSDT", direction: "LONG", origins: [origin({ evaluationClosedThrough: 5 * HOUR })] }).reason).toBe("FUTURE_DATA_REJECTED")],
    ["35 reports no qualifying origin without future data", () => expect(selectH11QualifyingOrigin({ currentCandle: candle(5 * HOUR), symbol: "ETHUSDT", direction: "LONG", origins: [origin({ formalSignal: false })] }).reason).toBe("NO_QUALIFYING_ORIGIN")],
    ["36 computes a LONG maximum breakout level", () => expect(computeH11BreakoutLevel({ direction: "LONG", originSignalTime: 4 * HOUR, candlesBeforeOrigin: [candle(HOUR, { high: 103 }), candle(2 * HOUR, { high: 107 }), candle(3 * HOUR, { high: 105 })] })).toBe(107)],
    ["37 computes a SHORT minimum breakout level", () => expect(computeH11BreakoutLevel({ direction: "SHORT", originSignalTime: 4 * HOUR, candlesBeforeOrigin: [candle(HOUR, { low: 97 }), candle(2 * HOUR, { low: 94 }), candle(3 * HOUR, { low: 96 })] })).toBe(94)],
    ["38 requires exactly three breakout candles", () => expect(computeH11BreakoutLevel({ direction: "LONG", originSignalTime: 4 * HOUR, candlesBeforeOrigin: [candle(HOUR), candle(2 * HOUR)] })).toBeNull()],
    ["39 rejects a breakout candle not closed before origin", () => expect(computeH11BreakoutLevel({ direction: "LONG", originSignalTime: 4 * HOUR, candlesBeforeOrigin: [candle(HOUR), candle(2 * HOUR), candle(4 * HOUR)] })).toBeNull()],
    ["40 accepts a LONG strict close reclaim", () => expect(evaluateH11Retest({ direction: "LONG", originSignalTime: 4 * HOUR, originStopReference: 98, breakoutLevel: 105, candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 106 })], currentCandle: candle(5 * HOUR, { open: 105, low: 104, close: 106 }) }).reason).toBe("PASS")],
    ["41 accepts a SHORT strict close reclaim", () => expect(evaluateH11Retest({ direction: "SHORT", originSignalTime: 4 * HOUR, originStopReference: 108, breakoutLevel: 95, candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 95, high: 96, close: 94 })], currentCandle: candle(5 * HOUR, { open: 95, high: 96, close: 94 }) }).reason).toBe("PASS")],
    ["42 rejects LONG close equal to breakout", () => expect(evaluateH11Retest({ direction: "LONG", originSignalTime: 4 * HOUR, originStopReference: 98, breakoutLevel: 105, candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 105 })], currentCandle: candle(5 * HOUR, { open: 105, low: 104, close: 105 }) }).reason).toBe("RETEST_NOT_CONFIRMED")],
    ["43 rejects SHORT close equal to breakout", () => expect(evaluateH11Retest({ direction: "SHORT", originSignalTime: 4 * HOUR, originStopReference: 108, breakoutLevel: 95, candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 95, high: 96, close: 95 })], currentCandle: candle(5 * HOUR, { open: 95, high: 96, close: 95 }) }).reason).toBe("RETEST_NOT_CONFIRMED")],
    ["44 invalidates LONG origin on stop touch", () => expect(evaluateH11Retest({ direction: "LONG", originSignalTime: 4 * HOUR, originStopReference: 98, breakoutLevel: 105, candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 98, close: 106 })], currentCandle: candle(5 * HOUR, { open: 105, low: 98, close: 106 }) }).reason).toBe("ORIGIN_STOP_TOUCHED")],
    ["45 invalidates SHORT origin on stop touch", () => expect(evaluateH11Retest({ direction: "SHORT", originSignalTime: 4 * HOUR, originStopReference: 108, breakoutLevel: 95, candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 95, high: 108, close: 94 })], currentCandle: candle(5 * HOUR, { open: 95, high: 108, close: 94 }) }).reason).toBe("ORIGIN_STOP_TOUCHED")],
    ["46 checks the confirmation candle for stop invalidation", () => expect(evaluateH11Retest({ direction: "LONG", originSignalTime: 4 * HOUR, originStopReference: 98, breakoutLevel: 105, candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 97, close: 106 })], currentCandle: candle(5 * HOUR, { open: 105, low: 97, close: 106 }) }).originInvalidatedByStop).toBe(true)],
    ["47 rejects invalid ATR risk geometry", () => expect(computeH11RiskGeometry({ direction: "LONG", entryReference: 106, stopReference: 98, atr14: 0 })).toBeNull()],
    ["48 includes stopAtr lower boundary 0.8", () => expect(computeH11RiskGeometry({ direction: "LONG", entryReference: 101.6, stopReference: 100, atr14: 2 })?.eligible).toBe(true)],
    ["49 includes stopAtr upper boundary 3.0", () => expect(computeH11RiskGeometry({ direction: "LONG", entryReference: 106, stopReference: 100, atr14: 2 })?.eligible).toBe(true)],
    ["50 rejects stopAtr above 3.0", () => expect(computeH11RiskGeometry({ direction: "LONG", entryReference: 106.01, stopReference: 100, atr14: 2 })?.eligible).toBe(false)],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-B H11 complete origin pipeline", () => {
  const cases: readonly [string, () => void][] = [
    ["51 selects a valid age-1 origin", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(5 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 106 })] })],
    }).originAgeBars).toBe(1)],
    ["52 skips age-1 after stop invalidation and accepts age-2", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(6 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [
        h11Candidate(5 * HOUR, { candlesFromFirstAfterOrigin: [candle(6 * HOUR, { open: 105, low: 99, close: 106 })] }),
        h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 106 }), candle(6 * HOUR, { open: 105, low: 104, close: 106 })] }),
      ],
    }).origin?.signalTime).toBe(4 * HOUR)],
    ["53 skips age-1 when retest fails and accepts age-2", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(6 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [
        h11Candidate(5 * HOUR, { candlesBeforeOrigin: [candle(2 * HOUR, { high: 106 }), candle(3 * HOUR, { high: 106 }), candle(4 * HOUR, { high: 106 })], candlesFromFirstAfterOrigin: [candle(6 * HOUR, { open: 105, low: 104, close: 106 })] }),
        h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 106 }), candle(6 * HOUR, { open: 105, low: 104, close: 106 })] }),
      ],
    }).origin?.signalTime).toBe(4 * HOUR)],
    ["54 skips a non-formal age-1 origin", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(6 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [
        h11Candidate(5 * HOUR, { formalSignal: false, candlesFromFirstAfterOrigin: [candle(6 * HOUR, { open: 105, low: 104, close: 106 })] }),
        h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 106 }), candle(6 * HOUR, { open: 105, low: 104, close: 106 })] }),
      ],
    }).origin?.signalTime).toBe(4 * HOUR)],
    ["55 skips a future-data age-1 origin", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(6 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [
        h11Candidate(5 * HOUR, { evaluationClosedThrough: 6 * HOUR, candlesFromFirstAfterOrigin: [candle(6 * HOUR, { open: 105, low: 104, close: 106 })] }),
        h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 106 }), candle(6 * HOUR, { open: 105, low: 104, close: 106 })] }),
      ],
    }).origin?.signalTime).toBe(4 * HOUR)],
    ["56 rejects a current-candle stop touch", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(5 * HOUR, { low: 100 }), symbol: "ETHUSDT", direction: "LONG",
      origins: [h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 100, close: 106 })] })],
    }).origin).toBeNull()],
    ["57 fails closed when an intermediate post-origin candle is missing", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(6 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(6 * HOUR, { open: 105, low: 104, close: 106 })] })],
    }).origin).toBeNull()],
    ["58 fails closed on a duplicate post-origin candle", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(6 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 106 }), candle(5 * HOUR, { open: 105, low: 104, close: 106 }), candle(6 * HOUR, { open: 105, low: 104, close: 106 })] })],
    }).origin).toBeNull()],
    ["59 fails closed when the post-origin sequence does not end at current", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(6 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [candle(5 * HOUR, { open: 105, low: 104, close: 106 })] })],
    }).origin).toBeNull()],
    ["60 accepts an age-4 origin", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(8 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [5, 6, 7, 8].map((hour) => candle(hour * HOUR, { open: 105, low: 104, close: 106 })) })],
    }).originAgeBars).toBe(4)],
    ["61 never accepts an age-5 origin", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(9 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [h11Candidate(4 * HOUR, { candlesFromFirstAfterOrigin: [5, 6, 7, 8, 9].map((hour) => candle(hour * HOUR, { open: 105, low: 104, close: 106 })) })],
    }).origin).toBeNull()],
    ["62 returns no origin when all four candidates fail", () => expect(selectH11QualifiedRetestOrigin({
      currentCandle: h11Current(8 * HOUR), symbol: "ETHUSDT", direction: "LONG",
      origins: [1, 2, 3, 4].map((age) => h11Candidate((8 - age) * HOUR, { formalSignal: false, candlesFromFirstAfterOrigin: [] })),
    }).origin).toBeNull()],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-B H12 pullback-reclaim", () => {
  const cases: readonly [string, () => void][] = [
    ["51 accepts the LONG reclaim", () => expect(evaluateH12Reclaim(h12()).reason).toBe("PASS")],
    ["52 accepts the SHORT reclaim", () => expect(evaluateH12Reclaim(h12({ direction: "SHORT", symbolRegime: "SHORT_ONLY", btcRegime: "BTC_STRONG_BEAR", previous: { high: 101, low: 99, close: 100.5, ema20: 100, ema50: 98 }, current: { high: 100, low: 97, close: 98, ema20: 99, rsi14: 40, atr14: 2 } })).reason).toBe("PASS")],
    ["53 rejects LONG RSI equal to 50", () => expect(evaluateH12Reclaim(h12({ current: { ...h12().current, rsi14: 50 } })).eligible).toBe(false)],
    ["54 rejects LONG RSI equal to 70", () => expect(evaluateH12Reclaim(h12({ current: { ...h12().current, rsi14: 70 } })).eligible).toBe(false)],
    ["55 rejects SHORT RSI equal to 30", () => expect(evaluateH12Reclaim(h12({ direction: "SHORT", symbolRegime: "SHORT_ONLY", btcRegime: "BTC_STRONG_BEAR", previous: { high: 101, low: 99, close: 100.5, ema20: 100, ema50: 98 }, current: { high: 100, low: 97, close: 98, ema20: 99, rsi14: 30, atr14: 2 } })).eligible).toBe(false)],
    ["56 rejects SHORT RSI equal to 50", () => expect(evaluateH12Reclaim(h12({ direction: "SHORT", symbolRegime: "SHORT_ONLY", btcRegime: "BTC_STRONG_BEAR", previous: { high: 101, low: 99, close: 100.5, ema20: 100, ema50: 98 }, current: { high: 100, low: 97, close: 98, ema20: 99, rsi14: 50, atr14: 2 } })).eligible).toBe(false)],
    ["57 fails closed on missing EMA", () => expect(evaluateH12Reclaim(h12({ previous: { ...h12().previous, ema20: undefined } })).reason).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["58 fails closed on ATR zero", () => expect(evaluateH12Reclaim(h12({ current: { ...h12().current, atr14: 0 } })).reason).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["59 blocks NO_TRADE regime", () => expect(evaluateH12Reclaim(h12({ symbolRegime: "NO_TRADE" })).reason).toBe("BASELINE_CONTEXT_BLOCKED")],
    ["60 blocks LONG with SHORT_ONLY regime", () => expect(evaluateH12Reclaim(h12({ symbolRegime: "SHORT_ONLY" })).reason).toBe("BASELINE_CONTEXT_BLOCKED")],
    ["61 blocks a missing BTC regime", () => expect(evaluateH12Reclaim(h12({ btcRegime: null })).reason).toBe("BASELINE_CONTEXT_BLOCKED")],
    ["62 blocks non-BTC LONG in strong bear", () => expect(evaluateH12Reclaim(h12({ btcRegime: "BTC_STRONG_BEAR" })).reason).toBe("BASELINE_CONTEXT_BLOCKED")],
    ["63 blocks non-BTC SHORT in strong bull", () => expect(evaluateH12Reclaim(h12({ direction: "SHORT", symbolRegime: "SHORT_ONLY", previous: { high: 101, low: 99, close: 100.5, ema20: 100, ema50: 98 }, current: { high: 100, low: 97, close: 98, ema20: 99, rsi14: 40, atr14: 2 } })).reason).toBe("BASELINE_CONTEXT_BLOCKED")],
    ["64 applies BTC exception to LONG", () => expect(evaluateH12Reclaim(h12({ symbol: "BTCUSDT", btcRegime: "BTC_STRONG_BEAR" })).eligible).toBe(true)],
    ["65 rejects a missing pullback", () => expect(evaluateH12Reclaim(h12({ previous: { high: 104, low: 103, close: 102, ema20: 100, ema50: 102 } })).reason).toBe("PULLBACK_NOT_FOUND")],
    ["66 rejects an unconfirmed reclaim", () => expect(evaluateH12Reclaim(h12({ current: { ...h12().current, close: 100.5 } })).reason).toBe("RECLAIM_NOT_CONFIRMED")],
    ["67 enforces strict LONG close above EMA20", () => expect(evaluateH12Reclaim(h12({ current: { ...h12().current, close: 100.5 } })).eligible).toBe(false)],
    ["68 enforces strict LONG close above previous high", () => expect(evaluateH12Reclaim(h12({ current: { ...h12().current, close: 101 } })).eligible).toBe(false)],
    ["69 requires exactly five prior candles for risk geometry", () => expect(computeH12RiskGeometry({ direction: "LONG", currentClose: 105, currentAtr14: 2, priorFiveCandles: [candle(HOUR)] })).toBeNull()],
    ["70 applies the prior-five 0.2 ATR stop offset", () => expect(computeH12RiskGeometry({ direction: "LONG", currentClose: 105, currentAtr14: 2, priorFiveCandles: Array.from({ length: 5 }, (_, index) => ({ high: 105 + index, low: 100 + index })) })?.stopReference).toBe(99.6)],
    ["71 accepts exact p=t-1 timestamp alignment", () => expect(evaluateH12Reclaim(h12()).reason).toBe("PASS")],
    ["72 rejects a t-2 previous candle", () => expect(evaluateH12Reclaim(h12({ previous: { openTime: 7 * HOUR + 1, closeTime: 8 * HOUR } })).reason).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["73 rejects a same-time previous candle", () => expect(evaluateH12Reclaim(h12({ previous: { openTime: 9 * HOUR + 1, closeTime: 10 * HOUR } })).reason).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["74 rejects a future current candle", () => expect(evaluateH12Reclaim(h12({ signalTime: 9 * HOUR })).reason).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-B H13 adaptive exit", () => {
  const cases: readonly [string, () => void][] = [
    ["71 continues a safe LONG candle", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 1, candle: { high: 102, low: 99, close: 101 }, ema20: 100, stopReference: 98 }).action).toBe("CONTINUE")],
    ["72 continues a safe SHORT candle", () => expect(evaluateH13ExitStep({ direction: "SHORT", heldCandleNumber: 1, candle: { high: 101, low: 98, close: 99 }, ema20: 100, stopReference: 103 }).action).toBe("CONTINUE")],
    ["73 prioritizes LONG stop", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 10, candle: { high: 102, low: 98, close: 99 }, ema20: 100, stopReference: 98 }).action).toBe("SL")],
    ["74 prioritizes SHORT stop", () => expect(evaluateH13ExitStep({ direction: "SHORT", heldCandleNumber: 10, candle: { high: 103, low: 98, close: 101 }, ema20: 100, stopReference: 103 }).action).toBe("SL")],
    ["75 triggers LONG trend exit below EMA20", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 10, candle: { high: 102, low: 99, close: 99 }, ema20: 100, stopReference: 98 }).action).toBe("TREND_EXIT_TRIGGER")],
    ["76 triggers SHORT trend exit above EMA20", () => expect(evaluateH13ExitStep({ direction: "SHORT", heldCandleNumber: 10, candle: { high: 102, low: 98, close: 101 }, ema20: 100, stopReference: 103 }).action).toBe("TREND_EXIT_TRIGGER")],
    ["77 returns TIME_EXIT at held 48", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 48, candle: { high: 102, low: 99, close: 99 }, ema20: 100, stopReference: 98 }).action).toBe("TIME_EXIT")],
    ["78 keeps SL before held-48 TIME_EXIT", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 48, candle: { high: 102, low: 98, close: 99 }, ema20: 100, stopReference: 98 }).action).toBe("SL")],
    ["79 does not trigger EMA exit after held 48", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 48, candle: { high: 102, low: 99, close: 99 }, ema20: 100, stopReference: 98 }).trendTriggerHeldCandleNumber).toBeNull()],
    ["80 records the held number for trend trigger", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 47, candle: { high: 102, low: 99, close: 99 }, ema20: 100, stopReference: 98 }).trendTriggerHeldCandleNumber).toBe(47)],
    ["81 continues held 47 when no trigger", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 47, candle: { high: 102, low: 101, close: 101 }, ema20: 100, stopReference: 98 }).action).toBe("CONTINUE")],
    ["82 accepts held candle one", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 1, candle: { high: 102, low: 99, close: 101 }, ema20: 100, stopReference: 98 }).heldCandleNumber).toBe(1)],
    ["83 rejects held candle 49", () => expect(() => evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 49, candle: { high: 102, low: 99, close: 101 }, ema20: 100, stopReference: 98 })).toThrow()],
    ["84 rejects held candle zero", () => expect(() => evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 0, candle: { high: 102, low: 99, close: 101 }, ema20: 100, stopReference: 98 })).toThrow()],
    ["85 rejects non-finite exit input", () => expect(() => evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 1, candle: { high: Number.NaN, low: 99, close: 101 }, ema20: 100, stopReference: 98 })).toThrow()],
    ["86 accepts a protected LONG fill", () => expect(h13EntryProtectiveStopValid({ direction: "LONG", entryFill: 101, stopReference: 100 })).toBe(true)],
    ["87 rejects a LONG fill at stop", () => expect(h13EntryProtectiveStopValid({ direction: "LONG", entryFill: 100, stopReference: 100 })).toBe(false)],
    ["88 accepts a protected SHORT fill", () => expect(h13EntryProtectiveStopValid({ direction: "SHORT", entryFill: 99, stopReference: 100 })).toBe(true)],
    ["89 rejects a SHORT fill at stop", () => expect(h13EntryProtectiveStopValid({ direction: "SHORT", entryFill: 100, stopReference: 100 })).toBe(false)],
    ["90 never exposes a fixed TP decision in the pure exit helper", () => expect(evaluateH13ExitStep({ direction: "LONG", heldCandleNumber: 12, candle: { high: 110, low: 99, close: 101 }, ema20: 100, stopReference: 98 }).action).toBe("CONTINUE")],
    ["91 resolves a held-47 trend trigger at held-48 open", () => expect(resolveH13TrendExitAtNextOpen({ triggerHeldCandleNumber: 47, nextCandle: candle(48 * HOUR, { open: 123 }) })).toMatchObject({ exitReason: "TREND_EXIT", heldCandleNumber: 48, rawExitPrice: 123 })],
    ["92 never schedules another trend exit from held-48", () => expect(resolveH13TrendExitAtNextOpen({ triggerHeldCandleNumber: 48, nextCandle: candle(49 * HOUR) })).toBeNull()],
    ["93 preserves bt-policy-003 global 24-candle horizon", () => expect(M3_R4_BT_POLICY_003_GLOBAL_HELD_CANDLE_COUNT).toBe(24)],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-B H14 relative strength", () => {
  const cases: readonly [string, () => void][] = [
    ["91 computes a simple 24-interval momentum", () => expect(computeH14Momentum24h({ closeNow: 110, close24BarsAgo: 100 })).toMatchObject({ status: "VALID", momentum24h: expect.closeTo(0.1, 10) })],
    ["92 rejects zero current close", () => expect(computeH14Momentum24h({ closeNow: 0, close24BarsAgo: 100 }).status).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["93 rejects zero historical close", () => expect(computeH14Momentum24h({ closeNow: 100, close24BarsAgo: 0 }).status).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["94 rejects non-finite momentum input", () => expect(computeH14Momentum24h({ closeNow: Number.NaN, close24BarsAgo: 100 }).status).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["95 accepts exact t-24 timestamp alignment", () => expect(computeH14Momentum24hAtSignal({ signalTime: 25 * HOUR, currentCandle: candle(25 * HOUR, { close: 110 }), historicalCandle: candle(HOUR, { close: 100 }) })).toMatchObject({ status: "VALID", momentum24h: expect.closeTo(0.1, 10) })],
    ["96 rejects t-23 historical data", () => expect(computeH14Momentum24hAtSignal({ signalTime: 25 * HOUR, currentCandle: candle(25 * HOUR), historicalCandle: candle(2 * HOUR) }).status).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["97 rejects t-25 historical data", () => expect(computeH14Momentum24hAtSignal({ signalTime: 25 * HOUR, currentCandle: candle(25 * HOUR), historicalCandle: candle(0) }).status).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["98 rejects a future current candle", () => expect(computeH14Momentum24hAtSignal({ signalTime: 25 * HOUR, currentCandle: candle(26 * HOUR), historicalCandle: candle(2 * HOUR) }).status).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["99 rejects an invalid close", () => expect(computeH14Momentum24hAtSignal({ signalTime: 25 * HOUR, currentCandle: candle(25 * HOUR, { close: Number.NaN }), historicalCandle: candle(HOUR) }).status).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["100 ranks all five symbols descending", () => expect(rankH14RelativeStrength({ BTCUSDT: 0.1, ETHUSDT: 0.2, SOLUSDT: 0.05, XRPUSDT: -0.1, BNBUSDT: 0 }).orderedSymbols).toEqual(["ETHUSDT", "BTCUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"])],
    ["101 resolves equal momentum by frozen symbol order", () => expect(rankH14RelativeStrength({ BTCUSDT: 0.1, ETHUSDT: 0.1, SOLUSDT: 0, XRPUSDT: 0, BNBUSDT: -0.1 }).orderedSymbols).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"])],
    ["102 fails closed when a symbol is missing", () => expect(rankH14RelativeStrength({ BTCUSDT: 0.1, ETHUSDT: 0.1, SOLUSDT: 0.1, XRPUSDT: 0.1 }).status).toBe("FAIL_CLOSED_DATA_INCOMPLETE")],
    ["103 admits LONG rank one", () => expect(evaluateH14Eligibility({ direction: "LONG", rank: 1 })).toBe(true)],
    ["104 admits LONG rank two", () => expect(evaluateH14Eligibility({ direction: "LONG", rank: 2 })).toBe(true)],
    ["105 blocks LONG rank three", () => expect(evaluateH14Eligibility({ direction: "LONG", rank: 3 })).toBe(false)],
    ["106 admits SHORT rank four", () => expect(evaluateH14Eligibility({ direction: "SHORT", rank: 4 })).toBe(true)],
    ["107 admits SHORT rank five", () => expect(evaluateH14Eligibility({ direction: "SHORT", rank: 5 })).toBe(true)],
    ["108 blocks SHORT rank three", () => expect(evaluateH14Eligibility({ direction: "SHORT", rank: 3 })).toBe(false)],
    ["109 freezes exact signal identity", () => expect(m3R4SignalIdentity({ symbol: "ETHUSDT", direction: "LONG", signalTime: 123 })).toBe("ETHUSDT|LONG|123")],
    ["110 reuses an exact CONTROL outcome", () => expect(reuseH14ControlOutcome({ symbol: "ETHUSDT", direction: "LONG", signalTime: 10 * HOUR, controlResults: [controlOutcome()] }).status).toBe("REUSED")],
    ["111 fails closed when CONTROL outcome is missing", () => expect(reuseH14ControlOutcome({ symbol: "ETHUSDT", direction: "LONG", signalTime: 11 * HOUR, controlResults: [controlOutcome()] }).status).toBe("DATA_INCOMPLETE")],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-B selection gates", () => {
  const cases: readonly [string, () => void][] = [
    ["107 preserves aggregate improvement +0.10", () => expect(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.minimumAggregateImprovement.value).toBe(0.1)],
    ["108 preserves improved folds 4 of 6", () => expect(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.minimumImprovedValidationFolds.value).toBe(4)],
    ["109 preserves fold delta +0.02", () => expect(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.foldImprovementDeltaR).toBe(0.02)],
    ["110 preserves catastrophic limit zero", () => expect(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.catastrophicFoldLimit.value).toBe(0)],
    ["111 preserves expectancy +0.03", () => expect(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.minimumNetExpectancy.value).toBe(0.03)],
    ["112 preserves PF 1.20", () => expect(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.minimumProfitFactor.value).toBe(1.2)],
    ["113 preserves concentration .50/.10", () => expect([BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.maximumSymbolConcentration.value, BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.maximumSingleTradeConcentration.value]).toEqual([0.5, 0.1])],
    ["114 preserves fee burden .75", () => expect(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.maximumFeeBurdenRatio.value).toBe(0.75)],
    ["115 preserves sample floors 300 and 30", () => expect([BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.minimumFormalSignals.value, BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES.minimumExecutedTrades.value]).toEqual([300, 30])],
    ["116 restores the exact eleven hard gate identities", () => expect(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.hardGateIdentities).toEqual([...M3_R4_ROUND_004_HARD_GATE_IDENTITIES])],
    ["117 exposes exactly ten applicable hard gates", () => expect(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.applicableHardGateIdentities).toEqual([...M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES])],
    ["118 marks all four candidates redundancy N/A", () => expect(Object.values(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.redundancyApplicability)).toEqual(["NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_APPLICABLE"])],
    ["119 excludes N/A redundancy from conjunction and PASS", () => expect(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.eligibilityPolicy.notApplicableHandling).toBe("EXCLUDED_FROM_CONJUNCTION_NOT_COUNTED_AS_PASS")],
    ["120 preserves the no-candidate outcome", () => expect(M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME).toBe("NO BASELINE-002 CANDIDATE — ROUND-004")],
    ["121 freezes the performance lock", () => expect(M3_R4_ROUND_004_PERFORMANCE_LOCK).toBe("FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED")],
    ["122 keeps no-loss PF semantics", () => expect(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.profitFactorStatusSemantics.NO_LOSSES).toContain("PF_GATE_PASSES_ONLY")],
    ["123 freezes the Round-004 invalidation action", () => expect(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.roundImmutability.actionOnChange).toBe("ROUND_004_INVALIDATION_REQUIRED")],
    ["124 freezes every Round-004 invalidating category", () => expect(BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.invalidatingCategories).toEqual([...M3_R4_ROUND_004_INVALIDATING_CATEGORIES])],
    ["125 freezes the complete H11 origin selection rule", () => expect(M3_R4_ROUND_004_PLAN.candidateDefinitions[0].originSelection.selectionRule).toBe("FIRST ORIGIN IN AGE 1→4 ORDER THAT PASSES THE COMPLETE ORIGIN+INVALIDATION+RETEST+RISK PIPELINE.")],
    ["126 freezes H13 next-open and original-R denominator metadata", () => { expect(M3_R4_ROUND_004_PLAN.candidateDefinitions[2].exit.trendExitSettlement).toContain("n+1 OPEN"); expect(M3_R4_ROUND_004_PLAN.candidateDefinitions[2].exit.stopDistanceRDenominator).toBe("ORIGINAL_BASELINE_STOP_DISTANCE"); }],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-B boundary and fail-closed tests", () => {
  const cases: readonly [string, () => void][] = [
    ["122 accepts a candle closing exactly at signalTime", () => expect(isDecisionTimeCandle(candle(10 * HOUR), 10 * HOUR)).toBe(true)],
    ["123 rejects a candle closing after signalTime", () => expect(isDecisionTimeCandle(candle(11 * HOUR), 10 * HOUR)).toBe(false)],
    ["124 rejects invalid OHLC relationships", () => expect(isDecisionTimeCandle(candle(10 * HOUR, { high: 99 }), 10 * HOUR)).toBe(false)],
    ["125 rejects unsafe timestamps", () => expect(isDecisionTimeCandle(candle(10 * HOUR), Number.MAX_SAFE_INTEGER + 1)).toBe(false)],
    ["126 validates an all-decision-time snapshot", () => expect(allDecisionTimeCandles([candle(9 * HOUR), candle(10 * HOUR)], 10 * HOUR)).toBe(true)],
    ["127 rejects a mixed future snapshot", () => expect(allDecisionTimeCandles([candle(9 * HOUR), candle(11 * HOUR)], 10 * HOUR)).toBe(false)],
    ["128 rejects the origin candle as a post-origin support candle", () => expect(evaluateH11Retest({ direction: "LONG", originSignalTime: 4 * HOUR, originStopReference: 98, breakoutLevel: 105, candlesFromFirstAfterOrigin: [candle(4 * HOUR, { open: 105, low: 104, close: 106 })], currentCandle: candle(5 * HOUR, { open: 105, low: 104, close: 106 }) }).reason).toBe("INVALID_INPUT")],
    ["129 keeps protocol module free of network fetch", () => expect(readFileSync("src/lib/research/m3-r4-round-004-protocol.ts", "utf8")).not.toMatch(/\bfetch\s*\(/u)],
    ["130 keeps protocol module free of backtest execution", () => expect(readFileSync("src/lib/research/m3-r4-round-004-protocol.ts", "utf8")).not.toMatch(/runBacktest|historical-loader|evaluateStrategy/u)],
    ["131 keeps the plan pre-performance", () => expect(readFileSync("src/lib/research/m3-r4-round-004-plan.ts", "utf8")).not.toMatch(/runBacktest|research:m3|capture-control/u)],
    ["132 leaves R4-A diagnosis bytes unchanged", () => expect(createHash("sha256").update(readFileSync("docs/BASELINE_002_DIAGNOSIS_R4.md")).digest("hex")).toBe(M3_R4_ROUND_004_R4A_DIAGNOSIS_RAW_SHA256)],
    ["133 leaves R4-A protocol bytes unchanged", () => expect(createHash("sha256").update(readFileSync("docs/BASELINE_002_RESEARCH_R4.md")).digest("hex")).toBe(M3_R4_ROUND_004_R4A_PROTOCOL_RAW_SHA256)],
    ["134 preserves frozen symbol order", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"])],
  ];
  for (const [name, test] of cases) it(name, test);
});
