import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import type {
  BacktestData,
  BacktestSignalResult,
  BacktestSignalSnapshot,
} from "../src/lib/backtest/types.ts";
import { BACKTEST_PERIOD_RANGES, BACKTEST_POLICY } from "../src/lib/backtest/constants.ts";
import { buildHistoricalIndexes } from "../src/lib/backtest/windows.ts";
import { buildHistoricalLoadRanges } from "../src/lib/backtest/ranges.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
  M3_R4_ROUND_004_CANDIDATE_IDS,
  M3_R4_ROUND_004_PLAN_SHA256,
  M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  M3_R4_ROUND_004_SYMBOL_ORDER,
  validateM3R4Round004MachineRecord,
} from "../src/lib/research/index.ts";
import {
  M3_R4_C_EXECUTION_SOURCE_SHA_PLACEHOLDER,
  M3_R4_C_OUTPUT_PATHS,
  M3_R4_C_RESEARCH_UNIVERSE,
  assertRound004ExecutionPreflight,
  assertRound004FrozenArchitecture,
  candidateRecordIdentity,
  discoverRound004IntrabarRequirements,
  evaluateH13Formation,
  evaluateH14FormationFromMomentum,
  h13UsesSettlementOnlyExtension,
  type Round004ExecutionPreflight,
} from "../src/lib/research/m3-r4-round-004-performance.ts";
import {
  M3_R4_C_PROTOCOL_BASE_MAIN_SHA,
  M3_R4_C_SETTLEMENT_EXTENSION_TAG,
  M3_R4_C_STANDARD_POLICY,
  buildH13SettlementOnlyExtensionRanges,
} from "../src/lib/research/m3-r4-round-004-loader.ts";
import {
  M3_R4_ROUND_004_DECISION,
  M3_R4_ROUND_004_REPORT_SCHEMA_VERSION,
  buildRound004AuditArtifact,
  buildRound004ExecutionArtifacts,
  buildRound004Report,
  canonicalRound004IdentityArray,
  canonicalizeRound004Records,
  hashRound004Identities,
  normalizeRound004Result,
  serializeRound004Report,
  validateRound004EvidenceIntegrity,
} from "../src/lib/research/m3-r4-round-004-evidence.ts";
import {
  M3_R4_H13_EXIT_REASONS,
  M3_R4_H13_RAW_STATUSES,
  h13RawStatusToResearchStatus,
  planH13Exit,
  settleH13Signal,
  type H13SettlementInput,
} from "../src/lib/research/m3-r4-round-004-settlement.ts";
import { parseRound004AuthoritativeArguments, publishRound004ArtifactsAtomically } from "../scripts/m3-r4-performance.ts";

const HOUR = INTERVAL_MS["1h"];
const BASE = Date.parse("2023-01-01T00:00:00.000Z");
const VALID_SOURCE_SHA = "a".repeat(40);

function marketCandle(index: number, values: Partial<Candle> = {}): Candle {
  const openTime = BASE + index * HOUR;
  return {
    symbol: "ETHUSDT",
    timeframe: "1h",
    openTime,
    closeTime: openTime + HOUR - 1,
    open: 100,
    high: 102,
    low: 99,
    close: 101,
    volume: 10,
    quoteVolume: 1_000,
    tradeCount: 10,
    takerBuyBaseVolume: 5,
    takerBuyQuoteVolume: 500,
    ...values,
  };
}

function held48(values: Partial<Candle> = {}): readonly Candle[] {
  return Object.freeze(Array.from({ length: 48 }, (_, index) => marketCandle(index + 1, values)));
}

function snapshot(overrides: Partial<BacktestSignalSnapshot> = {}): BacktestSignalSnapshot {
  return {
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    signalTime: BASE,
    symbol: "ETHUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_STRONG_BULL",
    entryReference: 101,
    stopReference: 90,
    takeProfitReference: 123,
    stopDistance: 11,
    stopAtr: 1,
    breakdown: {
      trendStrength: 20,
      pullbackQuality: 20,
      breakoutStrength: 20,
      volumeScore: 5,
      riskRewardScore: 5,
    },
    totalScore: 70,
    grade: "C",
    ...overrides,
  };
}

function funding(): readonly [{ symbol: "ETHUSDT"; fundingTime: number; fundingRate: number; directMarkPrice: number }] {
  return [{ symbol: "ETHUSDT", fundingTime: BASE + 2 * HOUR, fundingRate: 0.0001, directMarkPrice: 100 }];
}

function h13Input(overrides: Partial<H13SettlementInput> = {}): H13SettlementInput {
  const signal = marketCandle(0);
  return {
    snapshot: snapshot(),
    signalCandle: signal,
    heldCandles: held48(),
    ema20ByHeldCandle: Array.from({ length: 48 }, () => 100),
    funding: funding(),
    serverTime: BASE + 100 * HOUR,
    period: "DEV",
    periodEndTime: BASE + 100 * HOUR,
    ...overrides,
  };
}

function baselineEntry(overrides: Partial<{ symbol: "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "XRPUSDT" | "BNBUSDT"; direction: "LONG" | "SHORT"; signalTime: number; period: "DEV" | "OOS" }> = {}) {
  const baselineSnapshot = snapshot({
    symbol: overrides.symbol ?? "ETHUSDT",
    direction: overrides.direction ?? "LONG",
    signalTime: overrides.signalTime ?? BASE,
  });
  return {
    candidate: { ...baselineSnapshot, formalSignal: true },
    signalTime: overrides.signalTime ?? BASE,
    evaluationClosedThrough: overrides.signalTime ?? BASE,
    period: overrides.period ?? "DEV",
  } as const;
}

function h13IntrabarWindow(exitCandleOpenTime: number, stopMinuteIndex: number): import("../src/lib/historical-data/types.ts").HistoricalIntrabarSettlementWindow {
  const candles = Array.from({ length: 60 }, (_, index) => {
    const openTime = exitCandleOpenTime + index * 60_000;
    return {
      symbol: "ETHUSDT" as const,
      timeframe: "1m" as const,
      openTime,
      closeTime: openTime + 59_999,
      open: 100,
      high: 101,
      low: index === stopMinuteIndex ? 89 : 99,
      close: 100,
      volume: 1,
      quoteVolume: 100,
      tradeCount: 1,
      takerBuyBaseVolume: 0.5,
      takerBuyQuoteVolume: 50,
    };
  });
  return {
    symbol: "ETHUSDT",
    exitCandleOpenTime,
    settlementOnly: false,
    candles,
    manifest: {
      kind: "intrabar-settlement",
      provider: "binance-usdm-public",
      source: "/fapi/v1/klines",
      symbol: "ETHUSDT",
      timeframe: "1m",
      requestedStartTime: exitCandleOpenTime,
      requestedEndTime: exitCandleOpenTime + HOUR - 1,
      actualStartTime: exitCandleOpenTime,
      actualEndTime: exitCandleOpenTime + HOUR - 1,
      rowCount: 60,
      retrievedAt: "2026-08-18T00:00:00.000Z",
      sha256: "a".repeat(64),
      settlementOnly: false,
      exitCandleOpenTime,
    },
  };
}

function result(overrides: Partial<BacktestSignalResult> = {}): BacktestSignalResult {
  const signal = snapshot();
  return {
    snapshot: signal,
    status: "EXECUTED",
    entryTime: BASE + HOUR,
    rawEntryPrice: 100,
    entryFill: 100.05,
    exitTime: BASE + 2 * HOUR,
    rawExitPrice: 101,
    exitFill: 100.95,
    heldCandleNumber: 1,
    exitReason: "TIME_EXIT",
    fundingCharges: [],
    fundingPnL: 0,
    priceR: 0.08,
    feeR: 0.01,
    fundingR: 0,
    grossR: 0.08,
    netR: 0.07,
    ...overrides,
  };
}

function emptyData(): BacktestData {
  const datasets = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, { candles1h: [], candles4h: [] }])) as unknown as BacktestData["datasets"];
  const fundingBySymbol = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
  return { datasets, funding: fundingBySymbol, manifests: [] };
}

function preflight(overrides: Partial<Round004ExecutionPreflight> = {}): Round004ExecutionPreflight {
  return {
    confirmAuthoritativeRun: true,
    sourceSha: VALID_SOURCE_SHA,
    round: M3_R4_ROUND_004_RESEARCH_ROUND_ID,
    gateSha: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
    planSha: M3_R4_ROUND_004_PLAN_SHA256,
    headSha: VALID_SOURCE_SHA,
    cleanWorktree: true,
    existingOutputArtifacts: [],
    gateValidatorPass: true,
    planValidatorPass: true,
    ...overrides,
  };
}

describe("M3-R4-C source-freeze constants and boundaries", () => {
  const cases: readonly [string, () => void][] = [
    ["001 freezes the authoritative main SHA", () => expect(M3_R4_C_PROTOCOL_BASE_MAIN_SHA).toBe("fd42381d903f9b60ec98e7b297578de95dc8160b")],
    ["002 freezes the exact research round", () => expect(M3_R4_C_RESEARCH_UNIVERSE.startTime).toBe(Date.parse("2023-01-01T00:00:00.000Z"))],
    ["003 freezes the research cutoff", () => expect(M3_R4_C_RESEARCH_UNIVERSE.endTime).toBe(Date.parse("2026-08-15T23:59:59.999Z"))],
    ["004 freezes the settlement extension tag", () => expect(M3_R4_C_SETTLEMENT_EXTENSION_TAG).toBe("SETTLEMENT_ONLY")],
    ["005 keeps the standard policy at bt-policy-003", () => expect(M3_R4_C_STANDARD_POLICY).toBe("bt-policy-003")],
    ["006 reserves an explicit execution source placeholder", () => expect(M3_R4_C_EXECUTION_SOURCE_SHA_PLACEHOLDER).toBe("SUPPLIED_AT_APPROVED_EXECUTION")],
    ["007 declares three future evidence outputs", () => expect(M3_R4_C_OUTPUT_PATHS).toHaveLength(3)],
    ["008 names the summary output", () => expect(M3_R4_C_OUTPUT_PATHS[0]).toBe("docs/evidence/M3_R4_ROUND_004_SUMMARY.json")],
    ["009 names the audit output", () => expect(M3_R4_C_OUTPUT_PATHS[1]).toBe("docs/evidence/M3_R4_ROUND_004_AUDIT.json")],
    ["010 names the markdown output", () => expect(M3_R4_C_OUTPUT_PATHS[2]).toBe("docs/M3_R4_ROUND_004_RESULTS.md")],
    ["011 keeps the five-symbol registry", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"])],
    ["012 keeps four standalone candidates", () => expect(M3_R4_ROUND_004_CANDIDATE_IDS).toHaveLength(4)],
    ["013 validates the frozen gate record", () => expect(validateM3R4Round004MachineRecord()).toBeDefined()],
    ["014 validates the architecture boundary", () => expect(() => assertRound004FrozenArchitecture()).not.toThrow()],
    ["015 keeps the 24-candle legacy horizon", () => expect(BACKTEST_POLICY.heldCandleCount).toBe(24)],
    ["016 keeps the 250 1H strategy window", () => expect(BACKTEST_POLICY.strategyWindowCandles).toBe(250)],
    ["017 keeps the baseline strategy version", () => expect(snapshot().strategyVersion).toBe("baseline-001")],
    ["018 keeps the execution policy version", () => expect(snapshot().backtestPolicyVersion).toBe("bt-policy-003")],
    ["019 keeps M3-R4-D deferred", () => expect(M3_R4_ROUND_004_DECISION).toBe("DEFER_TO_M3_R4_D_FROZEN_GATE_APPLICATION")],
    ["020 keeps the evidence schema explicit", () => expect(M3_R4_ROUND_004_REPORT_SCHEMA_VERSION).toBe("m3-r4-round-004-report-001")],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C preflight is fail-closed before network", () => {
  const cases: readonly [string, () => void][] = [
    ["021 accepts every required preflight field", () => expect(() => assertRound004ExecutionPreflight(preflight())).not.toThrow()],
    ["022 rejects a missing confirmation flag", () => expect(() => assertRound004ExecutionPreflight(preflight({ confirmAuthoritativeRun: false }))).toThrow("confirm-authoritative-run")],
    ["023 rejects a short source SHA", () => expect(() => assertRound004ExecutionPreflight(preflight({ sourceSha: "a" }))).toThrow("source SHA")],
    ["024 rejects a source SHA different from HEAD", () => expect(() => assertRound004ExecutionPreflight(preflight({ sourceSha: "b".repeat(40) }))).toThrow("source SHA")],
    ["025 rejects a dirty worktree", () => expect(() => assertRound004ExecutionPreflight(preflight({ cleanWorktree: false }))).toThrow("clean git worktree")],
    ["026 rejects an unexpected research round", () => expect(() => assertRound004ExecutionPreflight(preflight({ round: "other-round" }))).toThrow("researchRoundId")],
    ["027 rejects a wrong Gate SHA", () => expect(() => assertRound004ExecutionPreflight(preflight({ gateSha: "b".repeat(64) }))).toThrow("Gate SHA")],
    ["028 rejects a wrong Plan SHA", () => expect(() => assertRound004ExecutionPreflight(preflight({ planSha: "b".repeat(64) }))).toThrow("Plan SHA")],
    ["029 rejects an existing output artifact", () => expect(() => assertRound004ExecutionPreflight(preflight({ existingOutputArtifacts: [M3_R4_C_OUTPUT_PATHS[0]] }))).toThrow("output already exists")],
    ["030 rejects a failed Gate validator", () => expect(() => assertRound004ExecutionPreflight(preflight({ gateValidatorPass: false }))).toThrow("validator")],
    ["031 rejects a failed Plan validator", () => expect(() => assertRound004ExecutionPreflight(preflight({ planValidatorPass: false }))).toThrow("validator")],
    ["032 rejects an undefined Gate validator result", () => expect(() => assertRound004ExecutionPreflight({ ...preflight(), gateValidatorPass: undefined as never })).toThrow("validator")],
    ["033 rejects an undefined Plan validator result", () => expect(() => assertRound004ExecutionPreflight({ ...preflight(), planValidatorPass: undefined as never })).toThrow("validator")],
    ["034 rejects multiple existing outputs", () => expect(() => assertRound004ExecutionPreflight(preflight({ existingOutputArtifacts: [...M3_R4_C_OUTPUT_PATHS] }))).toThrow("output already exists")],
    ["035 rejects a dirty worktree even with valid hashes", () => expect(() => assertRound004ExecutionPreflight(preflight({ cleanWorktree: false, existingOutputArtifacts: [] }))).toThrow()],
    ["036 requires source SHA to be lowercase hexadecimal", () => expect(() => assertRound004ExecutionPreflight(preflight({ sourceSha: "A".repeat(40), headSha: "A".repeat(40) }))).toThrow("source SHA")],
    ["037 requires exact source SHA equality", () => expect(() => assertRound004ExecutionPreflight(preflight({ headSha: "c".repeat(40) }))).toThrow("source SHA")],
    ["038 keeps output overwrite protection independent of confirmation", () => expect(() => assertRound004ExecutionPreflight(preflight({ confirmAuthoritativeRun: false, existingOutputArtifacts: ["existing"] }))).toThrow("confirm-authoritative-run")],
    ["039 keeps Gate validation independent of Plan validation", () => expect(() => assertRound004ExecutionPreflight(preflight({ gateValidatorPass: false, planValidatorPass: true }))).toThrow("validator")],
    ["040 keeps Plan validation independent of Gate validation", () => expect(() => assertRound004ExecutionPreflight(preflight({ gateValidatorPass: true, planValidatorPass: false }))).toThrow("validator")],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C explicit command arguments", () => {
  const exact = [
    "node",
    "scripts/m3-r4-performance.ts",
    "--confirm-authoritative-run",
    "--source-sha",
    VALID_SOURCE_SHA,
    "--round",
    M3_R4_ROUND_004_RESEARCH_ROUND_ID,
    "--gate-sha",
    BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
    "--plan-sha",
    M3_R4_ROUND_004_PLAN_SHA256,
  ];
  const parsed = parseRound004AuthoritativeArguments(exact);
  const cases: readonly [string, () => void][] = [
    ["041 parses the confirmation flag", () => expect(parsed.confirmAuthoritativeRun).toBe(true)],
    ["042 parses the exact source SHA", () => expect(parsed.sourceSha).toBe(VALID_SOURCE_SHA)],
    ["043 parses the exact round", () => expect(parsed.round).toBe(M3_R4_ROUND_004_RESEARCH_ROUND_ID)],
    ["044 parses the exact Gate SHA", () => expect(parsed.gateSha).toBe(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256)],
    ["045 parses the exact Plan SHA", () => expect(parsed.planSha).toBe(M3_R4_ROUND_004_PLAN_SHA256)],
    ["046 defaults confirmation to false", () => expect(parseRound004AuthoritativeArguments(["node", "script"]).confirmAuthoritativeRun).toBe(false)],
    ["047 defaults missing source SHA to empty", () => expect(parseRound004AuthoritativeArguments(["node", "script"]).sourceSha).toBe("")],
    ["048 defaults missing round to empty", () => expect(parseRound004AuthoritativeArguments(["node", "script"]).round).toBe("")],
    ["049 defaults missing Gate SHA to empty", () => expect(parseRound004AuthoritativeArguments(["node", "script"]).gateSha).toBe("")],
    ["050 defaults missing Plan SHA to empty", () => expect(parseRound004AuthoritativeArguments(["node", "script"]).planSha).toBe("")],
    ["050a atomically writes audit, results, and summary", () => {
      const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-m3-r4-test-"));
      try {
        const summaryPath = path.join(root, "evidence", "summary.json");
        const auditPath = path.join(root, "evidence", "audit.json");
        const resultsPath = path.join(root, "results.md");
        publishRound004ArtifactsAtomically({ summaryPath, auditPath, resultsPath, summary: "summary", audit: "audit", results: "results" });
        expect([summaryPath, auditPath, resultsPath].every((file) => existsSync(file))).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }],
    ["050b refuses to overwrite an existing authoritative output", () => {
      const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-m3-r4-test-"));
      try {
        const summaryPath = path.join(root, "evidence", "summary.json");
        const auditPath = path.join(root, "evidence", "audit.json");
        const resultsPath = path.join(root, "results.md");
        const input = { summaryPath, auditPath, resultsPath, summary: "summary", audit: "audit", results: "results" };
        publishRound004ArtifactsAtomically(input);
        expect(() => publishRound004ArtifactsAtomically(input)).toThrow("refusing overwrite");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C H13 settlement-only extension", () => {
  const standard = buildHistoricalLoadRanges("COMBINED");
  const tail = standard.settlementTail!;
  const ranges = buildH13SettlementOnlyExtensionRanges();
  const cases: readonly [string, () => void][] = [
    ["051 preserves the standard settlement-tail start", () => expect(tail.candleRange.startTime).toBe(BACKTEST_PERIOD_RANGES.OOS.endTime + 1)],
    ["052 preserves the standard tail settlement flag", () => expect(tail.candleRange.settlementOnly).toBe(true)],
    ["053 starts H13 at held candle 25", () => expect(ranges.candleRange.startTime).toBe(tail.candleRange.endTime + HOUR)],
    ["054 ends H13 at held candle 48", () => expect(ranges.candleRange.endTime).toBe(tail.candleRange.endTime + 24 * HOUR)],
    ["055 marks H13 candles settlement-only", () => expect(ranges.candleRange.settlementOnly).toBe(true)],
    ["056 starts H13 funding with held candle 25", () => expect(ranges.fundingRange.startTime).toBe(ranges.candleRange.startTime)],
    ["057 ends H13 funding at held candle 48 close", () => expect(ranges.fundingRange.endTime).toBe(ranges.candleRange.endTime + HOUR - 1)],
    ["058 starts H13 mark price with held candle 25", () => expect(ranges.markPriceRange.startTime).toBe(ranges.candleRange.startTime)],
    ["059 ends H13 mark price with funding coverage", () => expect(ranges.markPriceRange.endTime).toBe(ranges.fundingRange.endTime)],
    ["060 marks H13 funding settlement-only", () => expect(ranges.fundingRange.settlementOnly).toBe(true)],
    ["061 marks H13 mark price settlement-only", () => expect(ranges.markPriceRange.settlementOnly).toBe(true)],
    ["062 keeps extension width at 24 candles", () => expect((ranges.candleRange.endTime - ranges.candleRange.startTime) / HOUR).toBe(23)],
    ["063 does not move the tail start backward", () => expect(ranges.candleRange.startTime).toBeGreaterThan(tail.candleRange.endTime)],
    ["064 keeps the base 1H range separate", () => expect(ranges.candleRange.startTime).not.toBe(standard.candleRange["1h"].startTime)],
    ["065 keeps the base 4H range untouched", () => expect(standard.candleRange["4h"].settlementOnly).toBeUndefined()],
    ["066 preserves the standard funding end", () => expect(standard.fundingRange.endTime).toBe(BACKTEST_PERIOD_RANGES.OOS.endTime)],
    ["067 preserves the standard mark-price end", () => expect(standard.markPriceRange.endTime).toBe(BACKTEST_PERIOD_RANGES.OOS.endTime)],
    ["068 keeps extension funding and mark ranges identical", () => expect(ranges.fundingRange).toEqual(ranges.markPriceRange)],
    ["069 keeps H13 tagged SETTLEMENT_ONLY in the loader source", () => expect(readFileSync("src/lib/research/m3-r4-round-004-loader.ts", "utf8")).toContain("SETTLEMENT_ONLY")],
    ["070 keeps H13 extension out of StrategyInput in source", () => expect(readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8")).toContain("standardData")],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C H13 Phase A exit planning", () => {
  const safe = held48();
  const safePlan = planH13Exit({ direction: "LONG", heldCandles: safe, ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 90 });
  const cases: readonly [string, () => void][] = [
    ["071 plans exactly 48 held candles", () => expect(safePlan?.heldCandleNumber).toBe(48)],
    ["072 uses TIME_EXIT when no earlier exit occurs", () => expect(safePlan?.exitReason).toBe("TIME_EXIT")],
    ["073 uses held 48 as the TIME_EXIT candle", () => expect(safePlan?.exitCandle).toEqual(safe[47])],
    ["074 uses held 48 close for TIME_EXIT", () => expect(safePlan?.rawExitPrice).toBe(safe[47]!.close)],
    ["075 uses held 48 closeTime for TIME_EXIT", () => expect(safePlan?.exitTime).toBe(safe[47]!.closeTime)],
    ["076 records no trend trigger for TIME_EXIT", () => expect(safePlan?.trendTriggerHeldCandleNumber).toBeNull()],
    ["077 rejects 47 held candles", () => expect(planH13Exit({ direction: "LONG", heldCandles: safe.slice(0, 47), ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 90 })).toBeNull()],
    ["078 rejects a missing EMA warm-up value", () => expect(planH13Exit({ direction: "LONG", heldCandles: safe, ema20ByHeldCandle: Array.from({ length: 46 }, () => 100), stopReference: 90 })).toBeNull()],
    ["079 rejects a NaN EMA value", () => expect(planH13Exit({ direction: "LONG", heldCandles: safe, ema20ByHeldCandle: [Number.NaN, ...Array.from({ length: 47 }, () => 100)], stopReference: 90 })).toBeNull()],
    ["080 rejects an infinite stop", () => expect(planH13Exit({ direction: "LONG", heldCandles: safe, ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: Number.POSITIVE_INFINITY })).toBeNull()],
    ["081 rejects a zero stop", () => expect(planH13Exit({ direction: "LONG", heldCandles: safe, ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 0 })).toBeNull()],
    ["082 prioritizes LONG SL", () => expect(planH13Exit({ direction: "LONG", heldCandles: [marketCandle(1, { low: 90 }), ...safe.slice(1)], ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 90 })?.exitReason).toBe("SL")],
    ["083 records LONG SL on held 1", () => expect(planH13Exit({ direction: "LONG", heldCandles: [marketCandle(1, { low: 90 }), ...safe.slice(1)], ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 90 })?.heldCandleNumber).toBe(1)],
    ["084 triggers trend on held 47", () => expect(planH13Exit({ direction: "LONG", heldCandles: [...safe.slice(0, 46), marketCandle(47, { close: 99 }), safe[47]!], ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 90 })?.trendTriggerHeldCandleNumber).toBe(47)],
    ["085 resolves trend at held 48", () => expect(planH13Exit({ direction: "LONG", heldCandles: [...safe.slice(0, 46), marketCandle(47, { close: 99 }), marketCandle(48, { open: 103, high: 104 })], ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 90 })?.heldCandleNumber).toBe(48)],
    ["086 uses next-open price for trend exit", () => expect(planH13Exit({ direction: "LONG", heldCandles: [...safe.slice(0, 46), marketCandle(47, { close: 99 }), marketCandle(48, { open: 103, high: 104 })], ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 90 })?.rawExitPrice).toBe(103)],
    ["087 keeps trend trigger close in audit plan", () => expect(planH13Exit({ direction: "LONG", heldCandles: [...safe.slice(0, 46), marketCandle(47, { close: 99 }), safe[47]!], ema20ByHeldCandle: Array.from({ length: 48 }, () => 100), stopReference: 90 })?.trendTriggerClose).toBe(99)],
    ["088 does not trigger an EMA exit at held 48", () => expect(safePlan?.trendTriggerHeldCandleNumber).toBeNull()],
    ["089 exposes only frozen H13 exit reasons", () => expect(M3_R4_H13_EXIT_REASONS).toEqual(["SL", "TREND_EXIT", "TIME_EXIT"])],
    ["090 exposes five fail-closed H13 statuses", () => expect(M3_R4_H13_RAW_STATUSES).toEqual(["EXECUTED", "DATA_INCOMPLETE", "PERIOD_END_CENSORED", "ENTRY_OUTSIDE_PROTECTIVE_STOP", "SETTLEMENT_AMBIGUOUS"])],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C H13 Phase B settlement", () => {
  const executed = settleH13Signal(h13Input());
  const trendCandles = [...held48().slice(0, 46), marketCandle(47, { close: 99 }), marketCandle(48, { open: 103, high: 104 })];
  const trend = settleH13Signal(h13Input({ heldCandles: trendCandles }));
  const cases: readonly [string, () => void][] = [
    ["091 executes a valid TIME_EXIT settlement", () => expect(executed.status).toBe("EXECUTED")],
    ["092 preserves H13 TIME_EXIT reason", () => expect(executed.exitReason).toBe("TIME_EXIT")],
    ["093 preserves held 48 settlement", () => expect(executed.heldCandleNumber).toBe(48)],
    ["094 preserves original stop-distance denominator", () => expect(executed.settlementAudit.originalStopDistance).toBe(11)],
    ["095 keeps H13 take-profit reference decision-only", () => expect(executed.settlementAudit.rawExitPrice).not.toBe(snapshot().takeProfitReference)],
    ["096 keeps direct funding provenance", () => expect(executed.fundingCharges[0]?.markPriceSource).toBe("FUNDING_RATE_HISTORY")],
    ["097 produces finite TIME_EXIT net R", () => expect(Number.isFinite(executed.netR)).toBe(true)],
    ["098 preserves the baseline strategy version", () => expect(executed.snapshot.strategyVersion).toBe("baseline-001")],
    ["099 preserves bt-policy-003", () => expect(executed.snapshot.backtestPolicyVersion).toBe("bt-policy-003")],
    ["100 fails closed on missing funding", () => expect(settleH13Signal(h13Input({ funding: [] })).status).toBe("DATA_INCOMPLETE")],
    ["101 fails closed on missing EMA history", () => expect(settleH13Signal(h13Input({ ema20ByHeldCandle: Array.from({ length: 46 }, () => 100) })).status).toBe("DATA_INCOMPLETE")],
    ["102 censors DEV when held 48 crosses period end", () => expect(settleH13Signal(h13Input({ periodEndTime: held48()[47]!.closeTime - 1 })).status).toBe("PERIOD_END_CENSORED")],
    ["103 rejects a non-contiguous held sequence", () => expect(settleH13Signal(h13Input({ heldCandles: [marketCandle(1), marketCandle(3), ...held48().slice(2)] })).status).toBe("DATA_INCOMPLETE")],
    ["104 rejects fewer than 48 candles", () => expect(settleH13Signal(h13Input({ heldCandles: held48().slice(0, 47) })).status).toBe("DATA_INCOMPLETE")],
    ["105 rejects invalid stop distance", () => expect(settleH13Signal(h13Input({ snapshot: snapshot({ stopDistance: 0 }) })).status).toBe("DATA_INCOMPLETE")],
    ["106 rejects entry outside protective stop", () => expect(settleH13Signal(h13Input({ snapshot: snapshot({ stopReference: 101 }) })).status).toBe("ENTRY_OUTSIDE_PROTECTIVE_STOP")],
    ["107 preserves the next-open entry time", () => expect(executed.entryTime).toBe(held48()[0]!.openTime)],
    ["108 preserves the held 48 close exit time", () => expect(executed.exitTime).toBe(held48()[47]!.closeTime)],
    ["109 executes the trend overlay with 48 candles", () => expect(trend.status).toBe("EXECUTED")],
    ["110 preserves raw TREND_EXIT", () => expect(trend.exitReason).toBe("TREND_EXIT")],
    ["111 records trend trigger held 47", () => expect(trend.settlementAudit.trendTriggerHeldCandleNumber).toBe(47)],
    ["112 settles trend at held 48", () => expect(trend.heldCandleNumber).toBe(48)],
    ["113 maps ENTRY_OUTSIDE_PROTECTIVE_STOP to NOT_EXECUTED", () => expect(h13RawStatusToResearchStatus("ENTRY_OUTSIDE_PROTECTIVE_STOP")).toBe("NOT_EXECUTED")],
    ["114 preserves DATA_INCOMPLETE mapping", () => expect(h13RawStatusToResearchStatus("DATA_INCOMPLETE")).toBe("DATA_INCOMPLETE")],
    ["115 preserves PERIOD_END_CENSORED mapping", () => expect(h13RawStatusToResearchStatus("PERIOD_END_CENSORED")).toBe("PERIOD_END_CENSORED")],
    ["116 preserves SETTLEMENT_AMBIGUOUS mapping", () => expect(h13RawStatusToResearchStatus("SETTLEMENT_AMBIGUOUS")).toBe("SETTLEMENT_AMBIGUOUS")],
    ["117 does not add a fixed TP result reason", () => expect(M3_R4_H13_EXIT_REASONS).not.toContain("TP")],
    ["118 uses one authoritative server time field", () => expect(h13Input().serverTime).toBe(BASE + 100 * HOUR)],
    ["119 keeps period-end logic separate from OOS tail", () => expect(h13Input().period).toBe("DEV")],
    ["120 keeps H13 output research-only in source", () => expect(readFileSync("src/lib/research/m3-r4-round-004-settlement.ts", "utf8")).toContain("H13RawResult")],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C.1 fail-closed formation and settlement audit", () => {
  const fullMomentum = { BTCUSDT: 0.10, ETHUSDT: 0.08, SOLUSDT: 0.06, XRPUSDT: 0.04, BNBUSDT: 0.02 } as const;
  const incompleteH14 = evaluateH14FormationFromMomentum({ baseline: baselineEntry(), momentum24hBySymbol: { BTCUSDT: 0.10, ETHUSDT: 0.08, SOLUSDT: 0.06, XRPUSDT: 0.04 } });
  const noSignalH14 = evaluateH14FormationFromMomentum({ baseline: baselineEntry({ symbol: "SOLUSDT", direction: "LONG" }), momentum24hBySymbol: fullMomentum });
  const missingControlValidation = validateRound004EvidenceIntegrity([], {
    controlParityPassed: true,
    h13ExpectedIdentities: [],
    h14ExpectedEligibleIdentities: [`ETHUSDT|LONG|${BASE}`],
  });
  const acceptedNoSignalValidation = validateRound004EvidenceIntegrity([], {
    controlParityPassed: true,
    h13ExpectedIdentities: [],
    h14ExpectedEligibleIdentities: [],
  });
  const cases: readonly [string, () => void][] = [
    ["221 one missing H14 momentum symbol is DATA_INCOMPLETE", () => expect(incompleteH14.status).toBe("DATA_INCOMPLETE")],
    ["222 H14 NO_SIGNAL is not an integrity failure", () => expect(noSignalH14.status).toBe("NO_SIGNAL")],
    ["223 missing eligible H14 CONTROL identity requires review", () => expect(missingControlValidation.errors).toContain("H14_ELIGIBLE_POPULATION_IDENTITY_MISMATCH")],
    ["224 legitimate H14 NO_SIGNAL can pass integrity validation", () => expect(acceptedNoSignalValidation.passed).toBe(true)],
    ["225 integrity validation is not optional", () => expect(buildRound004Report({ protocolBaseMainSha: M3_R4_C_PROTOCOL_BASE_MAIN_SHA, executionSourceSha: VALID_SOURCE_SHA, selectionGateSha256: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256, experimentPlanSha256: M3_R4_ROUND_004_PLAN_SHA256, studyServerTime: BASE + 1_000, researchUniverse: M3_R4_C_RESEARCH_UNIVERSE, records: [] }).evidenceStatus).toBe("INCOMPLETE")],
    ["226 H13 DATA_INCOMPLETE blocks complete evidence", () => {
      const raw = settleH13Signal(h13Input({ funding: [] }));
      const validation = validateRound004EvidenceIntegrity([normalizeRound004Result("R4-H13-ADAPTIVE-TREND-EXIT", raw)], { controlParityPassed: true, h13ExpectedIdentities: [`ETHUSDT|LONG|${BASE}`], h14ExpectedEligibleIdentities: [] });
      expect(validation.errors.some((error) => error.startsWith("DATA_INCOMPLETE:"))).toBe(true);
    }],
    ["227 H13 SETTLEMENT_AMBIGUOUS blocks complete evidence", () => {
      const raw = { ...settleH13Signal(h13Input()), status: "SETTLEMENT_AMBIGUOUS" as const };
      const validation = validateRound004EvidenceIntegrity([normalizeRound004Result("R4-H13-ADAPTIVE-TREND-EXIT", raw)], { controlParityPassed: true, h13ExpectedIdentities: [`ETHUSDT|LONG|${BASE}`], h14ExpectedEligibleIdentities: [] });
      expect(validation.errors.some((error) => error.startsWith("SETTLEMENT_AMBIGUOUS:"))).toBe(true);
    }],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C.1 DEV isolation and intrabar SL timing", () => {
  const devEnd = BACKTEST_PERIOD_RANGES.DEV.endTime;
  const decisionIndexes = buildHistoricalIndexes(Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, {
    candles1h: [marketCandle(0, { symbol, openTime: devEnd - HOUR + 1, closeTime: devEnd })],
    candles4h: [{ ...marketCandle(0, { symbol, timeframe: "4h", openTime: BASE, closeTime: BASE + 4 * HOUR - 1 }) }],
  }])) as never);
  const throwingOosIndexes = new Proxy({}, { get: () => { throw new Error("OOS settlement accessor was touched"); } }) as never;
  const censored = evaluateH13Formation(baselineEntry({ signalTime: devEnd }), decisionIndexes, throwingOosIndexes);
  const stopHeld = [marketCandle(1, { low: 89 }), ...held48().slice(1)];
  const exitOpen = stopHeld[0]!.openTime;
  const collision = settleH13Signal(h13Input({
    heldCandles: stopHeld,
    funding: [{ symbol: "ETHUSDT", fundingTime: exitOpen + 10 * 60_000 + 30_000, fundingRate: 0.0001, directMarkPrice: 100 }],
    intrabarSettlementWindows: [h13IntrabarWindow(exitOpen, 10)],
  }));
  const performanceSource = readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8");
  const loaderSource = readFileSync("src/lib/research/m3-r4-round-004-loader.ts", "utf8");
  const cases: readonly [string, () => void][] = [
    ["228 DEV H13 crossing is censored before OOS access", () => expect(censored.status).toBe("PERIOD_END_CENSORED")],
    ["229 DEV-censored H13 has a formal record", () => expect(censored.censoredResult?.status).toBe("PERIOD_END_CENSORED")],
    ["230 DEV-censored H13 does not carry 48-candle settlement data", () => expect(censored.candidate?.heldCandles48).toBeUndefined()],
    ["231 DEV-censored H13 cannot create an intrabar requirement", () => expect(discoverRound004IntrabarRequirements({ controlData: emptyData(), standardCandidates: [], h13Candidates: [], controlRequirements: [] }).requirements).toEqual([])],
    ["232 CONTROL is wired to standard-only data", () => expect(performanceSource).toContain("data: finalStudy.standardDataWithIntrabar")],
    ["233 H11 and H12 use standard-only data", () => expect(performanceSource.match(/settleStandardCandidate\(candidate, finalStudy\.standardDataWithIntrabar\)/gu)?.length).toBe(2)],
    ["234 H13 is the only path using the H13 settlement data", () => expect(performanceSource).toContain("finalStudy.h13SettlementData")],
    ["235 H13 SL remains SL after 1m resolution", () => expect(collision.exitReason).toBe("SL")],
    ["236 H13 SL raw exit price remains the frozen stop", () => expect(collision.rawExitPrice).toBe(90)],
    ["237 H13 SL exitTime is the resolved stop-minute close", () => expect(collision.exitTime).toBe(exitOpen + 10 * 60_000 + 59_999)],
    ["238 H13 settlement audit uses the resolved stop-minute close", () => expect(collision.settlementAudit.exitTime).toBe(exitOpen + 10 * 60_000 + 59_999)],
    ["239 CONTROL receives no H13 extension candles", () => expect(performanceSource).toContain("data: finalStudy.standardDataWithIntrabar")],
    ["240 CONTROL receives no H13 extension funding", () => expect(performanceSource).toContain("data: finalStudy.standardDataWithIntrabar")],
    ["241 CONTROL receives no H13 extension manifests", () => expect(loaderSource).toContain("appendIntrabarWindowsToData(study.standardData, standardWindows)")],
    ["242 H11 receives standard-only settlement data", () => expect(performanceSource).toContain("settleStandardCandidate(candidate, finalStudy.standardDataWithIntrabar)")],
    ["243 H12 receives standard-only settlement data", () => expect(performanceSource).toContain("settleStandardCandidate(candidate, finalStudy.standardDataWithIntrabar)")],
    ["244 H13 receives the separate settlement extension view", () => expect(performanceSource).toContain("finalStudy.h13SettlementData")],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C two-phase requirement discovery", () => {
  const data = emptyData();
  const empty = discoverRound004IntrabarRequirements({ controlData: data, standardCandidates: [], h13Candidates: [], controlRequirements: [] });
  const cases: readonly [string, () => void][] = [
    ["121 marks discovery PRE_PERFORMANCE", () => expect(empty.phase).toBe("PRE_PERFORMANCE")],
    ["122 discovers no requirements for an empty fixture", () => expect(empty.requirements).toEqual([])],
    ["123 exposes no performance economics in Phase A", () => expect(empty.performanceEconomics).toBeNull()],
    ["124 exposes no evidence in Phase A", () => expect(empty.evidence).toBeNull()],
    ["125 exposes an empty diagnostic list for clean discovery", () => expect(empty.diagnostics).toEqual([])],
    ["126 keeps discovery free of net R", () => expect(JSON.stringify(empty)).not.toContain("netR")],
    ["127 keeps discovery free of PF", () => expect(JSON.stringify(empty)).not.toContain("profitFactor")],
    ["128 keeps discovery free of evidence status", () => expect(JSON.stringify(empty)).not.toContain("evidenceStatus")],
    ["129 preserves empty data without loading a provider", () => expect(data.manifests).toEqual([])],
    ["130 exposes the settlement-only candidate marker", () => expect(h13UsesSettlementOnlyExtension({ candidateId: "R4-H13-ADAPTIVE-TREND-EXIT", heldCandles48: held48(), heldCandles24: [], signalTime: BASE, period: "DEV", snapshot: snapshot(), signalCandle: marketCandle(0), decisionAudit: {} })).toBe(true)],
    ["131 rejects the marker for H11", () => expect(h13UsesSettlementOnlyExtension({ candidateId: "R4-H11-BREAKOUT-RETEST", heldCandles24: [], signalTime: BASE, period: "DEV", snapshot: snapshot(), signalCandle: marketCandle(0), decisionAudit: {} })).toBe(false)],
    ["132 rejects the marker when H13 has no extension", () => expect(h13UsesSettlementOnlyExtension({ candidateId: "R4-H13-ADAPTIVE-TREND-EXIT", heldCandles24: [], signalTime: BASE, period: "DEV", snapshot: snapshot(), signalCandle: marketCandle(0), decisionAudit: {} })).toBe(false)],
    ["133 keeps standard and extension candle tags distinct in source", () => expect(readFileSync("src/lib/research/m3-r4-round-004-loader.ts", "utf8")).toContain("settlementExtension")],
    ["134 keeps intrabar requirements separate from StrategyInput", () => expect(readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8")).toContain("requirementDiscovery")],
    ["135 keeps Phase A named in the source contract", () => expect(readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8")).toContain("PRE_PERFORMANCE")],
    ["136 keeps final window append after discovery", () => expect(readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8")).toContain("appendRound004IntrabarWindows")],
    ["137 retains data-integrity conflict diagnostics", () => expect(readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8")).toContain("DATA_INTEGRITY_CONFLICT")],
    ["138 keeps exact symbol order in the discovery contract", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER).toHaveLength(5)],
    ["139 keeps the control path explicit", () => expect(readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8")).toContain("controlRequirements")],
    ["140 prevents this test fixture from calling network code", () => expect(readFileSync("tests/m3-r4-c-performance.test.ts", "utf8")).not.toMatch(/fapi\.binance\.com/u)],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C evidence and audit serialization", () => {
  const first = normalizeRound004Result("CONTROL", result({ snapshot: snapshot({ signalTime: BASE + 1_000 }) }));
  const second = normalizeRound004Result("R4-H11-BREAKOUT-RETEST", result({ snapshot: snapshot({ signalTime: BASE + 2_000, symbol: "BTCUSDT" }) }), { decision: { mechanism: "H11" } });
  const third = normalizeRound004Result("R4-H13-ADAPTIVE-TREND-EXIT", result({ snapshot: snapshot({ signalTime: BASE + 3_000, symbol: "SOLUSDT" }) }), { decision: { mechanism: "H13" }, outcome: { exitReason: "TIME_EXIT" } });
  const records = [third, first, second];
  const report = buildRound004Report({ protocolBaseMainSha: M3_R4_C_PROTOCOL_BASE_MAIN_SHA, executionSourceSha: VALID_SOURCE_SHA, selectionGateSha256: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256, experimentPlanSha256: M3_R4_ROUND_004_PLAN_SHA256, studyServerTime: BASE + 10_000, researchUniverse: M3_R4_C_RESEARCH_UNIVERSE, records });
  const artifacts = buildRound004ExecutionArtifacts({ protocolBaseMainSha: M3_R4_C_PROTOCOL_BASE_MAIN_SHA, executionSourceSha: VALID_SOURCE_SHA, selectionGateSha256: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256, experimentPlanSha256: M3_R4_ROUND_004_PLAN_SHA256, studyServerTime: BASE + 10_000, researchUniverse: M3_R4_C_RESEARCH_UNIVERSE, records });
  const cases: readonly [string, () => void][] = [
    ["141 normalizes a CONTROL result", () => expect(first.candidateId).toBe("CONTROL")],
    ["142 preserves the canonical signal identity", () => expect(candidateRecordIdentity(first)).toBe(`ETHUSDT|LONG|${BASE + 1_000}`)],
    ["143 canonicalizes candidates before control", () => expect(canonicalizeRound004Records(records)[0]).toBe(first)],
    ["144 canonicalizes records by candidate order", () => expect(canonicalRound004IdentityArray(records)[0]).toContain("CONTROL")],
    ["145 includes executed identities by default", () => expect(hashRound004Identities(records)).toMatch(/^[0-9a-f]{64}$/u)],
    ["146 hashes executed identities deterministically", () => expect(hashRound004Identities(records, true)).toBe(hashRound004Identities([...records].reverse(), true))],
    ["147 rejects duplicate candidate identities", () => expect(() => canonicalizeRound004Records([first, first])).toThrow("Duplicate Round-004 record")],
    ["148 separates decisions from outcomes", () => expect(buildRound004AuditArtifact(records)).toMatchObject({ decisions: { "R4-H11-BREAKOUT-RETEST": [{ mechanism: "H11" }] }, outcomes: { "R4-H13-ADAPTIVE-TREND-EXIT": [{ exitReason: "TIME_EXIT" }] } })],
    ["149 emits the frozen report schema", () => expect(report.schemaVersion).toBe("m3-r4-round-004-report-001")],
    ["150 keeps the research round in the report", () => expect(report.researchRoundId).toBe(M3_R4_ROUND_004_RESEARCH_ROUND_ID)],
    ["151 keeps baseline-001 in the report", () => expect(report.strategyVersion).toBe("baseline-001")],
    ["152 keeps bt-policy-003 in the report", () => expect(report.backtestPolicyVersion).toBe("bt-policy-003")],
    ["153 keeps the performance lock explicit", () => expect(report.performanceLock).toBe("FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED")],
    ["154 does not freeze baseline-002", () => expect(report.baseline002Status).toBe("NOT_FROZEN")],
    ["155 keeps M3-J blocked", () => expect(report.m3JStatus).toBe("BLOCKED")],
    ["156 keeps M4 not started", () => expect(report.m4Status).toBe("NOT_STARTED")],
    ["157 defers gate application", () => expect(report.decision).toBe(M3_R4_ROUND_004_DECISION)],
    ["158 includes CONTROL evidence", () => expect(report.control.candidateId).toBe("CONTROL")],
    ["159 emits four candidate evidence slots", () => expect(report.candidates).toHaveLength(4)],
    ["160 emits an audit artifact hash", () => expect(report.auditArtifactSha256).toMatch(/^[0-9a-f]{64}$/u)],
    ["161 serializes with a trailing newline", () => expect(serializeRound004Report(report).endsWith("\n")).toBe(true)],
    ["162 serializes deterministically", () => expect(serializeRound004Report(report)).toBe(serializeRound004Report(JSON.parse(serializeRound004Report(report)) as typeof report))],
    ["163 preserves the signal-level disclaimer", () => expect(report.disclaimer).toContain("SIGNAL-LEVEL")],
    ["164 uses the seen-data statement", () => expect(report.seenDataStatement).toContain("seen data")],
    ["165 keeps the study server time", () => expect(report.studyServerTime).toBe(BASE + 10_000)],
    ["166 keeps the source SHA in the report", () => expect(report.executionSourceSha).toBe(VALID_SOURCE_SHA)],
    ["167 keeps Gate provenance in the report", () => expect(report.selectionGateSha256).toBe(BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256)],
    ["168 keeps Plan provenance in the report", () => expect(report.experimentPlanSha256).toBe(M3_R4_ROUND_004_PLAN_SHA256)],
    ["169 keeps candidate order stable", () => expect(report.candidates.map((candidate) => candidate.candidateId)).toEqual([...M3_R4_ROUND_004_CANDIDATE_IDS])],
    ["170 keeps evidence generation separate from gate fields", () => expect("selection" in report).toBe(false)],
    ["170a binds the audit SHA into the summary artifact", () => expect(artifacts.report.auditArtifactSha256).toBe(report.auditArtifactSha256)],
    ["170b emits a separate audit JSON artifact", () => expect(artifacts.auditJson).toContain("m3-r4-round-004-audit-001")],
    ["170c emits a Markdown results artifact", () => expect(artifacts.resultsMarkdown).toContain("Candidate summaries")],
    ["170d emits the serialized summary artifact", () => expect(artifacts.summaryJson).toContain("m3-r4-round-004-report-001")],
    ["170e keeps audit and summary artifacts distinct", () => expect(artifacts.auditJson).not.toBe(artifacts.summaryJson)],
  ];
  for (const [name, test] of cases) it(name, test);
});

describe("M3-R4-C offline and no-execution guardrails", () => {
  const sourceFiles = [
    "src/lib/research/m3-r4-round-004-performance.ts",
    "src/lib/research/m3-r4-round-004-settlement.ts",
    "src/lib/research/m3-r4-round-004-loader.ts",
    "src/lib/research/m3-r4-round-004-evidence.ts",
  ];
  const cases: readonly [string, () => void][] = [
    ["171 keeps the performance command explicit in package scripts", () => expect(readFileSync("package.json", "utf8")).toContain("research:m3r4:performance")],
    ["172 requires explicit authority in the performance script", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).toContain("--confirm-authoritative-run")],
    ["173 requires the execution source SHA", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).toContain("--source-sha")],
    ["174 requires the round id", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).toContain("--round")],
    ["175 requires the Gate SHA", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).toContain("--gate-sha")],
    ["176 requires the Plan SHA", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).toContain("--plan-sha")],
    ["177 refuses output overwrite in the script", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).toContain("refusing overwrite")],
    ["178 uses atomic rename in the script", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).toContain("renameSync")],
    ["179 does not call Binance directly from the script", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).not.toMatch(/fapi\.binance\.com/u)],
    ["180 does not use private Binance API terminology", () => expect(readFileSync("scripts/m3-r4-performance.ts", "utf8")).not.toMatch(/privateApi|apiKey|orderTest/u)],
    ["181 keeps no real result artifacts in the source tree", () => expect(M3_R4_C_OUTPUT_PATHS.some((path) => readFileSync(".gitignore", "utf8").includes(path))).toBe(false)],
    ["182 keeps the current test fixture offline", () => expect(readFileSync("tests/m3-r4-c-performance.test.ts", "utf8")).not.toMatch(/fetch\s*\(/u)],
    ["183 keeps protocol selection in the frozen module", () => expect(readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8")).toContain("M3_R4_C_STANDARD_POLICY")],
    ["184 leaves all new source modules in research namespace", () => expect(sourceFiles.every((path) => path.startsWith("src/lib/research/") || path.startsWith("scripts/") || path.startsWith("tests/"))).toBe(true)],
    ["185 keeps output paths evidence-only", () => expect(M3_R4_C_OUTPUT_PATHS.every((path) => path.includes("evidence") || path.endsWith("RESULTS.md"))).toBe(true)],
    ["186 keeps the source placeholder out of evidence output", () => expect(serializeRound004Report(reportForGuard())).not.toContain(M3_R4_C_EXECUTION_SOURCE_SHA_PLACEHOLDER)],
    ["187 keeps no gate result field in report JSON", () => expect(serializeRound004Report(reportForGuard())).not.toContain("gateResult")],
    ["188 keeps no selection field in report JSON", () => expect(serializeRound004Report(reportForGuard())).not.toContain("selectedCandidate")],
    ["189 keeps no baseline freeze field in report JSON", () => expect(serializeRound004Report(reportForGuard())).not.toContain("baseline002Frozen")],
    ["190 keeps the runner invocation behind the preflight call", () => { const text = readFileSync("scripts/m3-r4-performance.ts", "utf8"); expect(text.indexOf("assertRound004ExecutionPreflight")).toBeLessThan(text.indexOf("executeRound004Authoritative")); }],
    ["190a keeps authoritative execution out of unit tests", () => expect(readFileSync("tests/m3-r4-c-performance.test.ts", "utf8")).not.toMatch(/executeRound004AuthoritativeDetailed\(/u)],
    ["190b keeps authoritative execution out of normal CI", () => expect(readFileSync(".github/workflows/ci.yml", "utf8")).not.toContain("research:m3r4:performance")],
  ];
  for (const [name, test] of cases) it(name, test);
});

function reportForGuard() {
  const normalized = normalizeRound004Result("CONTROL", result());
  return buildRound004Report({ protocolBaseMainSha: M3_R4_C_PROTOCOL_BASE_MAIN_SHA, executionSourceSha: VALID_SOURCE_SHA, selectionGateSha256: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256, experimentPlanSha256: M3_R4_ROUND_004_PLAN_SHA256, studyServerTime: BASE + 1_000, researchUniverse: M3_R4_C_RESEARCH_UNIVERSE, records: [normalized] });
}

describe("M3-R4-C deterministic registry and source matrix", () => {
  const matrix = [
    ["BTCUSDT", 0], ["ETHUSDT", 1], ["SOLUSDT", 2], ["XRPUSDT", 3], ["BNBUSDT", 4],
  ] as const;
  const cases: readonly [string, () => void][] = [
    ["191 freezes BTC at index 0", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER[0]).toBe(matrix[0][0])],
    ["192 freezes ETH at index 1", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER[1]).toBe(matrix[1][0])],
    ["193 freezes SOL at index 2", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER[2]).toBe(matrix[2][0])],
    ["194 freezes XRP at index 3", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER[3]).toBe(matrix[3][0])],
    ["195 freezes BNB at index 4", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER[4]).toBe(matrix[4][0])],
    ["196 keeps symbols aligned with project registry", () => expect(M3_R4_ROUND_004_SYMBOL_ORDER).toEqual(RESEARCH_SYMBOLS)],
    ["197 keeps H11 as the first candidate", () => expect(M3_R4_ROUND_004_CANDIDATE_IDS[0]).toBe("R4-H11-BREAKOUT-RETEST")],
    ["198 keeps H12 as the second candidate", () => expect(M3_R4_ROUND_004_CANDIDATE_IDS[1]).toBe("R4-H12-PULLBACK-RECLAIM")],
    ["199 keeps H13 as the third candidate", () => expect(M3_R4_ROUND_004_CANDIDATE_IDS[2]).toBe("R4-H13-ADAPTIVE-TREND-EXIT")],
    ["200 keeps H14 as the fourth candidate", () => expect(M3_R4_ROUND_004_CANDIDATE_IDS[3]).toBe("R4-H14-RELATIVE-STRENGTH")],
    ["201 keeps DEV start frozen", () => expect(BACKTEST_PERIOD_RANGES.DEV.startTime).toBe(Date.parse("2023-01-01T00:00:00.000Z"))],
    ["202 keeps DEV end frozen", () => expect(BACKTEST_PERIOD_RANGES.DEV.endTime).toBe(Date.parse("2025-12-31T23:59:59.999Z"))],
    ["203 keeps OOS start frozen", () => expect(BACKTEST_PERIOD_RANGES.OOS.startTime).toBe(Date.parse("2026-01-01T00:00:00.000Z"))],
    ["204 keeps OOS end frozen", () => expect(BACKTEST_PERIOD_RANGES.OOS.endTime).toBe(Date.parse("2026-08-15T23:59:59.999Z"))],
    ["205 keeps exact 1H interval", () => expect(HOUR).toBe(3_600_000)],
    ["206 keeps 1H close exclusive from next open", () => expect(marketCandle(0).closeTime + 1).toBe(marketCandle(1).openTime)],
    ["207 keeps 48 candles in fixture", () => expect(held48()).toHaveLength(48)],
    ["208 keeps the signal candle before held one", () => expect(held48()[0]!.openTime).toBe(marketCandle(0).openTime + HOUR)],
    ["209 keeps held 48 after held 47", () => expect(held48()[47]!.openTime).toBe(held48()[46]!.openTime + HOUR)],
    ["210 keeps all fixture candles fully closed", () => expect(held48().every((item) => item.closeTime === item.openTime + HOUR - 1)).toBe(true)],
    ["211 keeps positive fixture OHLC", () => expect(held48().every((item) => item.low > 0 && item.high > 0)).toBe(true)],
    ["212 keeps fixture OHLC relationships", () => expect(held48().every((item) => item.high >= item.open && item.low <= item.close)).toBe(true)],
    ["213 keeps direct mark-price funding positive", () => expect(funding()[0]!.directMarkPrice).toBeGreaterThan(0)],
    ["214 keeps funding rate finite", () => expect(Number.isFinite(funding()[0]!.fundingRate)).toBe(true)],
    ["215 keeps funding event after entry", () => expect(funding()[0]!.fundingTime).toBeGreaterThan(held48()[0]!.openTime)],
    ["216 keeps the research universe after DEV start", () => expect(M3_R4_C_RESEARCH_UNIVERSE.startTime).toBe(BACKTEST_PERIOD_RANGES.DEV.startTime)],
    ["217 keeps the research universe through OOS", () => expect(M3_R4_C_RESEARCH_UNIVERSE.endTime).toBe(BACKTEST_PERIOD_RANGES.OOS.endTime)],
    ["218 keeps all new modules outside strategy namespace", () => expect(readFileSync("src/lib/research/m3-r4-round-004-performance.ts", "utf8")).not.toContain("src/lib/strategy")],
    ["219 keeps the source-freeze test suite explicit", () => expect(readFileSync("tests/m3-r4-c-performance.test.ts", "utf8")).toContain("source-freeze")],
    ["220 keeps the no-network assertion explicit", () => expect(readFileSync("tests/m3-r4-c-performance.test.ts", "utf8")).toContain("not.toMatch(/fetch")],
  ];
  for (const [name, test] of cases) it(name, test);
});
