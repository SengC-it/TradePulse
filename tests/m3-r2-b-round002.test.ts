import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { STRATEGY_VERSION, type ResearchSymbol } from "../src/lib/config/constants.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import type { StrategyCandidate, StrategyDataset } from "../src/lib/strategy/types.ts";
import {
  BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256,
  BASELINE_002_RESEARCH_ROUND_001_SOURCE_SHA,
  BASELINE_002_RESEARCH_ROUND_002_CANONICAL_JSON,
  BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_002_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
  BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES,
  M3_H_ROUND_001_PLAN_SHA256,
  M3_R2_ROUND_002_CANDIDATE_COUNT,
  M3_R2_ROUND_002_CANDIDATE_DEFINITIONS,
  M3_R2_ROUND_002_CANDIDATE_IDS,
  M3_R2_ROUND_002_COMPLEXITY_TUPLES,
  M3_R2_ROUND_002_CONTROL_ID,
  M3_R2_ROUND_002_DECISION_SNAPSHOT_FIELDS,
  M3_R2_ROUND_002_FORBIDDEN_SELECTOR_FIELDS,
  M3_R2_ROUND_002_NO_CANDIDATE_OUTCOME,
  M3_R2_ROUND_002_PLAN,
  M3_R2_ROUND_002_PLAN_CANONICAL_JSON,
  M3_R2_ROUND_002_PLAN_SHA256,
  M3_R2_ROUND_002_RESULT_IDENTITY_COUNT,
  M3_R2_ROUND_002_RESULT_IDENTITY_ORDER,
  M3_R2_ROUND_002_RESEARCH_ROUND_ID,
  M3_R2_ROUND_002_SELECTOR_SPECS,
  M3_R2_ROUND_002_SOURCE_SHA,
  M3_R2_ROUND_002_REDUNDANCY_APPLICABILITY,
  M3_R2_ROUND_002_INVALIDATING_CATEGORIES,
  M3R2FeatureError,
  M3R2SelectorError,
  extractM3R2DecisionSnapshot,
  m3R2DecisionSnapshotIdentity,
  passesM3R2H6,
  passesM3R2H7,
  passesM3R2H8,
  passesM3R2H9,
  passesM3R2H10,
  selectM3R2CandidateSnapshots,
  selectM3R2Candidates,
  validateM3R2Round002MachineRecord,
  validateM3R2Round002Plan,
  type M3R2DecisionSnapshot,
} from "../src/lib/research/index.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const HOUR = 60 * 60 * 1_000;
const BASE_TIME = Date.parse("2026-01-15T00:00:00.000Z");

function makeCandle(
  symbol: ResearchSymbol,
  timeframe: "1h" | "4h",
  index: number,
  signalTime = BASE_TIME,
  direction: "LONG" | "SHORT" = "LONG",
): Candle {
  const interval = timeframe === "1h" ? HOUR : 4 * HOUR;
  const closeTime = signalTime - (249 - index) * interval;
  const trendBase = timeframe === "1h" ? 100 + index * 0.05 : 200 + index * 0.2;
  const breakoutBump = timeframe === "1h" && index === 249 ? 0.5 : 0;
  const base = direction === "LONG" ? trendBase + breakoutBump : trendBase - breakoutBump;
  const open = base - (direction === "LONG" ? 0.05 : -0.05);
  const close = base + (direction === "LONG" ? 0.05 : -0.05);
  const low = direction === "LONG" && index === 248 ? base - 1 : direction === "SHORT" && index === 248 ? close - 0.05 : Math.min(open, close) - 0.1;
  const high = direction === "SHORT" && index === 248 ? base + 1 : Math.max(open, close) + 0.1;
  return {
    symbol,
    timeframe,
    openTime: closeTime - interval + 1,
    closeTime,
    open,
    high,
    low,
    close,
    volume: 999,
    quoteVolume: timeframe === "1h" && index === 249 ? 200 : 100,
    tradeCount: 100,
    takerBuyBaseVolume: 50,
    takerBuyQuoteVolume: 50,
  };
}

function makeDataset(
  symbol: ResearchSymbol = "ETHUSDT",
  direction: "LONG" | "SHORT" = "LONG",
): StrategyDataset {
  return {
    symbol,
    candles1h: Object.freeze(Array.from({ length: 250 }, (_, index) => makeCandle(symbol, "1h", index, BASE_TIME, direction))),
    candles4h: Object.freeze(Array.from({ length: 250 }, (_, index) => makeCandle(symbol, "4h", index, BASE_TIME, direction))),
  };
}

function makeCandidate(
  symbol: ResearchSymbol = "ETHUSDT",
  direction: "LONG" | "SHORT" = "LONG",
  btcRegime: StrategyCandidate["btcRegime"] = direction === "LONG" ? "BTC_STRONG_BULL" : "BTC_STRONG_BEAR",
): StrategyCandidate {
  return {
    strategyVersion: STRATEGY_VERSION,
    symbol,
    direction,
    symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
    btcRegime,
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
    formalSignal: true,
  };
}

function replace1h(dataset: StrategyDataset, index: number, changes: Partial<Candle>): StrategyDataset {
  return { ...dataset, candles1h: dataset.candles1h.map((candle, current) => current === index ? { ...candle, ...changes } : candle) };
}

function replaceAll1h(dataset: StrategyDataset, changes: Partial<Candle>): StrategyDataset {
  return { ...dataset, candles1h: dataset.candles1h.map((candle) => ({ ...candle, ...changes })) };
}

function snapshot(overrides: Partial<M3R2DecisionSnapshot> = {}): M3R2DecisionSnapshot {
  return {
    signalTime: BASE_TIME,
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

function shortSnapshot(overrides: Partial<M3R2DecisionSnapshot> = {}): M3R2DecisionSnapshot {
  return snapshot({
    symbol: "ETHUSDT",
    direction: "SHORT",
    btcRegime: "BTC_STRONG_BEAR",
    symbol4hClose: 98,
    symbol4hEma50: 100,
    symbol4hEma200: 102,
    symbol4hEma200FiveBarsAgo: 102.2,
    current1hClose: 99.8,
    previous3BreakoutExtreme: 100,
    ...overrides,
  });
}

describe("M3-R2-B Round-002 pre-performance freeze and pure tooling (97 dedicated tests)", () => {
  it("01 preserves the Round-001 selection-gate SHA", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256).toBe("11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd");
  });
  it("02 preserves the Round-001 source SHA", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_SOURCE_SHA).toBe("2f2c8f442b86bb730745908a6d6bf6a76ac43dd6");
  });
  it("03 freezes the Round-002 research round identity", () => {
    expect(M3_R2_ROUND_002_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-002");
  });
  it("04 freezes the Round-002 source SHA", () => {
    expect(M3_R2_ROUND_002_SOURCE_SHA).toBe("26d18ef314594f0e79583da617a0d8c17e812be9");
  });
  it("05 inherits every hard gate identity", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.hardGateIdentities).toEqual(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.hardGateIdentities);
  });
  it("06 inherits every numeric gate value and formula", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_MACHINE_RECORD.selectionGates).toEqual({
      ...BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD.selectionGates,
      researchRoundId: M3_R2_ROUND_002_RESEARCH_ROUND_ID,
      sourceSha: M3_R2_ROUND_002_SOURCE_SHA,
    });
  });
  it("07 preserves fold improvement semantics", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.foldImprovementDeltaR).toBe(0.02);
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.validationFoldCount).toBe(6);
  });
  it("08 preserves catastrophic-fold semantics", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.catastrophicFold).toEqual(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.catastrophicFold);
  });
  it("09 preserves profit-factor semantics", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.profitFactorStatusSemantics).toEqual(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.profitFactorStatusSemantics);
  });
  it("10 preserves aggregate-validation construction", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.aggregateValidationDefinition).toEqual(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.aggregateValidationDefinition);
  });
  it("11 preserves concentration and fee-burden denominators", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES.maximumSymbolConcentration.denominator).toBe(BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD.selectionGates.maximumSymbolConcentration.denominator);
    expect(BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES.maximumFeeBurdenRatio.denominator).toBe(BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD.selectionGates.maximumFeeBurdenRatio.denominator);
  });
  it("12 preserves the complexity tie threshold", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES.complexityTieThreshold.value).toBe(0.01);
  });
  it("13 preserves deterministic selection ordering", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.selectionAlgorithm).toEqual(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.selectionAlgorithm);
  });
  it("14 marks all nine Round-002 redundancy gates not applicable", () => {
    expect(Object.keys(M3_R2_ROUND_002_REDUNDANCY_APPLICABILITY)).toHaveLength(9);
    expect(Object.values(M3_R2_ROUND_002_REDUNDANCY_APPLICABILITY).every((value) => value === "NOT_APPLICABLE")).toBe(true);
  });
  it("15 does not encode redundancy N/A as PASS", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.redundancyApplicability.notApplicableCountsAsPass).toBe(false);
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.redundancyApplicability.notApplicableRepresentation).toBe("NOT_APPLICABLE");
  });
  it("16 freezes the exact Round-002 no-candidate outcome", () => {
    expect(M3_R2_ROUND_002_NO_CANDIDATE_OUTCOME).toBe("NO BASELINE-002 CANDIDATE — ROUND-002");
    expect(M3_R2_ROUND_002_NO_CANDIDATE_OUTCOME).not.toBe(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.noCandidateOutcome);
  });
  it("17 validates the Round-002 machine record and canonical SHA", () => {
    expect(() => validateM3R2Round002MachineRecord()).not.toThrow();
    expect(createHash("sha256").update(BASELINE_002_RESEARCH_ROUND_002_CANONICAL_JSON, "utf8").digest("hex")).toBe(BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256);
  });
  it("18 uses a new gate SHA for Round-002", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256).not.toBe(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256);
  });
  it("19 freezes the complete invalidating-category list", () => {
    expect(M3_R2_ROUND_002_INVALIDATING_CATEGORIES).toEqual([
      "GATE_VALUE", "GATE_FORMULA", "FOLD_IMPROVEMENT_DEFINITION", "CATASTROPHIC_FOLD_DEFINITION", "APPLICABILITY_RULE", "SAMPLE_FLOOR", "SELECTION_TIE_RULE", "AGGREGATE_VALIDATION_DEFINITION", "CANDIDATE_DEFINITION", "FEATURE_FORMULA", "SELECTOR_FORMULA", "COMPLEXITY_TUPLE", "COST_ASSUMPTION",
    ]);
  });
  it("20 has no gate-change escape hatch", () => {
    expect(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.roundImmutability.actionOnChange).toBe("STOP_AND_REQUIRE_NEW_RESEARCH_ROUND_DECISION");
    expect(stableStringify(BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS)).not.toContain("unless");
  });

  it("21 registers the exact Round-002 control", () => {
    expect(M3_R2_ROUND_002_CONTROL_ID).toBe("R2-CONTROL-BASELINE-001");
  });
  it("22 registers exactly the nine candidates", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_IDS).toEqual([
      "R2-H6-STRICT-BTC", "R2-H7-STRONG-SYMBOL", "R2-H8-RECENT-PULLBACK", "R2-H9-VOLUME-CONFIRM", "R2-H10-BREAKOUT-010", "R2-C1-BTC-STRONG-SYMBOL", "R2-C2-STRONG-SYMBOL-RECENT-PULLBACK", "R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT", "R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT",
    ]);
  });
  it("23 freezes candidateCount at nine", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_COUNT).toBe(9);
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS).toHaveLength(10);
  });
  it("24 freezes resultIdentityCount at ten", () => {
    expect(M3_R2_ROUND_002_RESULT_IDENTITY_COUNT).toBe(10);
    expect(M3_R2_ROUND_002_RESULT_IDENTITY_ORDER).toHaveLength(10);
  });
  it("25 rejects duplicate registry identities", () => {
    expect(new Set(M3_R2_ROUND_002_RESULT_IDENTITY_ORDER).size).toBe(10);
  });
  it("26 freezes registry order", () => {
    expect(M3_R2_ROUND_002_RESULT_IDENTITY_ORDER[0]).toBe(M3_R2_ROUND_002_CONTROL_ID);
    expect(M3_R2_ROUND_002_RESULT_IDENTITY_ORDER.slice(1)).toEqual(M3_R2_ROUND_002_CANDIDATE_IDS);
  });
  it("27 freezes mechanism IDs and candidate mapping", () => {
    expect(M3_R2_ROUND_002_PLAN.mechanismIds).toEqual(["H6_STRICT_BTC_ALIGNMENT", "H7_STRONG_SYMBOL_REGIME", "H8_RECENT_PULLBACK", "H9_VOLUME_CONFIRMATION", "H10_BREAKOUT_BUFFER"]);
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS.slice(1, 6).map((candidate) => candidate.mechanismIds[0])).toEqual([...M3_R2_ROUND_002_PLAN.mechanismIds]);
  });
  it("28 freezes H6 with no tested parameters", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS[1].parametersTested).toEqual([]);
  });
  it("29 freezes H7 parameter values", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS[2].parametersTested.map((parameter) => parameter.values)).toEqual([[1], [0.5], [0.1]]);
  });
  it("30 freezes H8 parameter values", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS[3].parametersTested.map((parameter) => parameter.values)).toEqual([[2]]);
  });
  it("31 freezes H9 quote-volume parameter values", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS[4].parametersTested.map((parameter) => parameter.values)).toEqual([[20], [1]]);
  });
  it("32 freezes H10 parameter values", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS[5].parametersTested.map((parameter) => parameter.values)).toEqual([[0.1]]);
  });
  it("33 proves no candidate parameter grid exists", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS.every((candidate) => candidate.parametersTested.every((parameter) => parameter.values.length <= 1))).toBe(true);
  });
  it("34 freezes exact combination inheritance", () => {
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS[6].inheritedFromCandidateIds).toEqual(["R2-H6-STRICT-BTC", "R2-H7-STRONG-SYMBOL"]);
    expect(M3_R2_ROUND_002_CANDIDATE_DEFINITIONS[9].inheritedFromCandidateIds).toEqual(["R2-H6-STRICT-BTC", "R2-H7-STRONG-SYMBOL", "R2-H9-VOLUME-CONFIRM", "R2-H10-BREAKOUT-010"]);
  });
  it("35 freezes all complexity tuples", () => {
    expect(M3_R2_ROUND_002_COMPLEXITY_TUPLES).toMatchObject({
      [M3_R2_ROUND_002_CONTROL_ID]: { newRules: 0, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 0 },
      "R2-H6-STRICT-BTC": { newRules: 0, newTunableThresholds: 0, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
      "R2-H7-STRONG-SYMBOL": { newRules: 0, newTunableThresholds: 3, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
      "R2-H8-RECENT-PULLBACK": { newRules: 0, newTunableThresholds: 1, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
      "R2-H9-VOLUME-CONFIRM": { newRules: 1, newTunableThresholds: 2, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
      "R2-H10-BREAKOUT-010": { newRules: 0, newTunableThresholds: 1, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
      "R2-C1-BTC-STRONG-SYMBOL": { newRules: 0, newTunableThresholds: 3, modifiedBaselineRules: 2, mechanismFamiliesUsed: 2 },
      "R2-C2-STRONG-SYMBOL-RECENT-PULLBACK": { newRules: 0, newTunableThresholds: 4, modifiedBaselineRules: 2, mechanismFamiliesUsed: 2 },
      "R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT": { newRules: 1, newTunableThresholds: 6, modifiedBaselineRules: 2, mechanismFamiliesUsed: 3 },
      "R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT": { newRules: 1, newTunableThresholds: 6, modifiedBaselineRules: 3, mechanismFamiliesUsed: 4 },
    });
  });
  it("36 enforces non-negative integer complexity dimensions", () => {
    for (const tuple of Object.values(M3_R2_ROUND_002_COMPLEXITY_TUPLES)) {
      expect(Object.values(tuple).every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
    }
  });
  it("37 freezes the plan SHA", () => {
    expect(validateM3R2Round002Plan()).toBe(M3_R2_ROUND_002_PLAN);
    expect(createHash("sha256").update(M3_R2_ROUND_002_PLAN_CANONICAL_JSON, "utf8").digest("hex")).toBe(M3_R2_ROUND_002_PLAN_SHA256);
  });
  it("38 freezes pre-performance status", () => {
    expect(M3_R2_ROUND_002_PLAN.performanceStatus).toBe("NOT_GENERATED");
    expect(M3_R2_ROUND_002_PLAN.candidateIds).toHaveLength(9);
  });

  it("39 extracts an exact 250-by-250 synthetic decision snapshot", () => {
    const result = extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset: makeDataset() });
    expect(result.signalTime).toBe(BASE_TIME);
    expect(result.symbol).toBe("ETHUSDT");
  });
  it("40 rejects a wrong 1H count", () => {
    expect(() => extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset: { ...makeDataset(), candles1h: makeDataset().candles1h.slice(1) } })).toThrow(M3R2FeatureError);
  });
  it("41 rejects future 1H data", () => {
    const dataset = replace1h(makeDataset(), 249, { closeTime: BASE_TIME + 1, openTime: BASE_TIME - HOUR + 2 });
    expect(() => extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset })).toThrow(/future|signalTime/);
  });
  it("42 rejects future 4H data", () => {
    const base = makeDataset();
    const dataset = { ...base, candles4h: base.candles4h.map((candle, index) => index === 249 ? { ...candle, closeTime: BASE_TIME + 1, openTime: BASE_TIME - 4 * HOUR + 2 } : candle) };
    expect(() => extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset })).toThrow(/future|signalTime/);
  });
  it("43 requires the final 1H closeTime to equal signalTime", () => {
    const dataset = replace1h(makeDataset(), 249, { closeTime: BASE_TIME - 1, openTime: BASE_TIME - HOUR });
    expect(() => extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset })).toThrow(/contiguous|signalTime/);
  });
  it("44 rejects a non-formal baseline candidate", () => {
    expect(() => extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: { ...makeCandidate(), formalSignal: false }, dataset: makeDataset() })).toThrow(/formal/);
  });
  it("45 rejects candidate and dataset symbol mismatch", () => {
    expect(() => extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate("BTCUSDT"), dataset: makeDataset("ETHUSDT") })).toThrow(/symbols differ/);
  });
  it("46 rejects an invalid ATR denominator", () => {
    const dataset = replaceAll1h(makeDataset(), { open: 100, high: 100, low: 100, close: 100 });
    expect(() => extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset })).toThrow(/ATR/);
  });
  it("47 records the nearest baseline pullback touch age", () => {
    const result = extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset: makeDataset() });
    expect(result.nearestBaselinePullbackTouchAgeBars).toBe(1);
  });
  it("48 records a touch at exactly age three when ages one and two do not touch", () => {
    const base = makeDataset();
    const dataset = [248, 247, 245, 244].reduce((current, index) => replace1h(current, index, { low: current.candles1h[index]!.open }), base);
    const result = extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset: replace1h(dataset, 246, { low: 1 }) });
    expect(result.nearestBaselinePullbackTouchAgeBars).toBe(3);
  });
  it("49 uses quoteVolume rather than base volume", () => {
    const result = extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset: makeDataset() });
    expect(result.current1hQuoteVolume).toBe(200);
    expect(result.previous20Closed1hQuoteVolumeMean).toBe(100);
  });
  it("50 excludes the current quoteVolume from the 20-bar mean", () => {
    const result = extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset: makeDataset() });
    expect(result.previous20Closed1hQuoteVolumeMean).toBe(100);
    expect(result.current1hQuoteVolume).not.toBe(result.previous20Closed1hQuoteVolumeMean);
  });
  it("51 extracts a positive LONG breakout margin", () => {
    const result = extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset: makeDataset() });
    expect(result.breakoutMarginAtr).toBeGreaterThan(0);
    expect(result.previous3BreakoutExtreme).toBeLessThan(result.current1hClose);
  });
  it("52 extracts a positive SHORT breakout margin", () => {
    const dataset = makeDataset("ETHUSDT", "SHORT");
    const result = extractM3R2DecisionSnapshot({ signalTime: BASE_TIME, baselineCandidate: makeCandidate("ETHUSDT", "SHORT"), dataset });
    expect(result.breakoutMarginAtr).toBeGreaterThan(0);
    expect(result.previous3BreakoutExtreme).toBeGreaterThan(result.current1hClose);
  });
  it("53 is deterministic for the same synthetic input", () => {
    const input = { signalTime: BASE_TIME, baselineCandidate: makeCandidate(), dataset: makeDataset() };
    expect(extractM3R2DecisionSnapshot(input)).toEqual(extractM3R2DecisionSnapshot(input));
  });

  it("54 lets BTC pass H6", () => {
    expect(passesM3R2H6(snapshot({ symbol: "BTCUSDT", btcRegime: "BTC_NEUTRAL" }))).toBe(true);
  });
  it("55 lets a non-BTC LONG pass H6 only in strong bull", () => {
    expect(passesM3R2H6(snapshot({ btcRegime: "BTC_STRONG_BULL" }))).toBe(true);
  });
  it("56 rejects a non-BTC LONG in neutral regime", () => {
    expect(passesM3R2H6(snapshot({ btcRegime: "BTC_NEUTRAL" }))).toBe(false);
  });
  it("57 rejects a non-BTC LONG in strong bear", () => {
    expect(passesM3R2H6(snapshot({ btcRegime: "BTC_STRONG_BEAR" }))).toBe(false);
  });
  it("58 lets a non-BTC SHORT pass H6 only in strong bear", () => {
    expect(passesM3R2H6(shortSnapshot())).toBe(true);
  });
  it("59 rejects a non-BTC SHORT in neutral regime", () => {
    expect(passesM3R2H6(shortSnapshot({ btcRegime: "BTC_NEUTRAL" }))).toBe(false);
  });
  it("60 includes H7 LONG equality boundaries", () => {
    expect(passesM3R2H7(snapshot())).toBe(true);
  });
  it("61 rejects H7 when close distance is below one ATR", () => {
    expect(passesM3R2H7(snapshot({ symbol4hClose: 100.999, symbol4hEma50: 100.5, symbol4hEma200: 99, symbol4hAtr: 2, symbol4hEma200FiveBarsAgo: 98.8 }))).toBe(false);
  });
  it("62 includes H7 SHORT equality boundaries", () => {
    expect(passesM3R2H7(shortSnapshot())).toBe(true);
  });
  it("63 rejects H7 with an invalid ATR", () => {
    expect(passesM3R2H7(snapshot({ symbol4hAtr: 0 }))).toBe(false);
  });
  it("64 includes H8 age one", () => {
    expect(passesM3R2H8(snapshot({ nearestBaselinePullbackTouchAgeBars: 1 }))).toBe(true);
  });
  it("65 includes H8 age two", () => {
    expect(passesM3R2H8(snapshot({ nearestBaselinePullbackTouchAgeBars: 2 }))).toBe(true);
  });
  it("66 rejects H8 age three", () => {
    expect(passesM3R2H8(snapshot({ nearestBaselinePullbackTouchAgeBars: 3 }))).toBe(false);
  });
  it("67 rejects H8 non-integer age", () => {
    expect(passesM3R2H8(snapshot({ nearestBaselinePullbackTouchAgeBars: 1.5 }))).toBe(false);
  });
  it("68 includes H9 ratio equality", () => {
    expect(passesM3R2H9(snapshot({ current1hQuoteVolume: 100, previous20Closed1hQuoteVolumeMean: 100 }))).toBe(true);
  });
  it("69 rejects H9 below mean", () => {
    expect(passesM3R2H9(snapshot({ current1hQuoteVolume: 99.999 }))).toBe(false);
  });
  it("70 rejects H9 invalid or zero denominator", () => {
    expect(passesM3R2H9(snapshot({ previous20Closed1hQuoteVolumeMean: 0 }))).toBe(false);
    expect(passesM3R2H9(snapshot({ previous20Closed1hQuoteVolumeMean: Number.NaN }))).toBe(false);
  });
  it("71 includes H10 buffer equality", () => {
    expect(passesM3R2H10(snapshot({ breakoutMarginAtr: 0.1 }))).toBe(true);
  });
  it("72 rejects H10 below the frozen buffer", () => {
    expect(passesM3R2H10(snapshot({ breakoutMarginAtr: 0.099999 }))).toBe(false);
  });
  it("73 applies C1 as exact H6 AND H7", () => {
    expect(selectM3R2CandidateSnapshots("R2-C1-BTC-STRONG-SYMBOL", [snapshot()])).toHaveLength(1);
    expect(selectM3R2CandidateSnapshots("R2-C1-BTC-STRONG-SYMBOL", [snapshot({ btcRegime: "BTC_NEUTRAL" })])).toHaveLength(0);
  });
  it("74 applies C2 as exact H7 AND H8", () => {
    expect(selectM3R2CandidateSnapshots("R2-C2-STRONG-SYMBOL-RECENT-PULLBACK", [snapshot()])).toHaveLength(1);
    expect(selectM3R2CandidateSnapshots("R2-C2-STRONG-SYMBOL-RECENT-PULLBACK", [snapshot({ nearestBaselinePullbackTouchAgeBars: 3 })])).toHaveLength(0);
  });
  it("75 applies C3 as exact H7 AND H9 AND H10", () => {
    expect(selectM3R2CandidateSnapshots("R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT", [snapshot()])).toHaveLength(1);
    expect(selectM3R2CandidateSnapshots("R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT", [snapshot({ current1hQuoteVolume: 99 })])).toHaveLength(0);
  });
  it("76 applies C4 as exact H6 AND H7 AND H9 AND H10", () => {
    expect(selectM3R2CandidateSnapshots("R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT", [snapshot()])).toHaveLength(1);
    expect(selectM3R2CandidateSnapshots("R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT", [snapshot({ btcRegime: "BTC_NEUTRAL" })])).toHaveLength(0);
  });
  it("77 does not use OR or scores for combinations", () => {
    expect(selectM3R2CandidateSnapshots("R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT", [snapshot({ current1hQuoteVolume: 99, breakoutMarginAtr: 0.2 })])).toHaveLength(0);
  });
  it("78 returns a strict subset of original snapshot references", () => {
    const first = snapshot({ signalTime: BASE_TIME });
    const second = snapshot({ signalTime: BASE_TIME + HOUR, nearestBaselinePullbackTouchAgeBars: 3 });
    const selected = selectM3R2CandidateSnapshots("R2-H8-RECENT-PULLBACK", [first, second]);
    expect(selected).toEqual([first]);
    expect(selected[0]).toBe(first);
  });
  it("79 selectors cannot create identities", () => {
    const input = [snapshot()];
    const selected = selectM3R2CandidateSnapshots("R2-H6-STRICT-BTC", input);
    expect(selected.every((value) => input.includes(value))).toBe(true);
    expect(m3R2DecisionSnapshotIdentity(selected[0]!)).toBe(`ETHUSDT|LONG|${BASE_TIME}`);
  });
  it("80 rejects duplicate snapshot identities", () => {
    expect(() => selectM3R2CandidateSnapshots("R2-H6-STRICT-BTC", [snapshot(), snapshot()])).toThrow(M3R2SelectorError);
  });
  it("81 orders snapshots by time, symbol, then direction", () => {
    const values = [snapshot({ symbol: "ETHUSDT", direction: "SHORT", signalTime: BASE_TIME + HOUR, btcRegime: "BTC_STRONG_BEAR" }), snapshot({ symbol: "BTCUSDT", direction: "LONG", signalTime: BASE_TIME }), shortSnapshot({ symbol: "BTCUSDT", signalTime: BASE_TIME })];
    expect(selectM3R2CandidateSnapshots("R2-C1-BTC-STRONG-SYMBOL", values).map((value) => `${value.symbol}|${value.direction}`)).toEqual(["BTCUSDT|LONG", "BTCUSDT|SHORT"]);
  });
  it("82 does not mutate the input collection", () => {
    const values = [snapshot({ signalTime: BASE_TIME + HOUR }), snapshot({ signalTime: BASE_TIME })];
    const before = [...values];
    selectM3R2CandidateSnapshots("R2-H6-STRICT-BTC", values);
    expect(values).toEqual(before);
  });
  it("83 returns all nine pure candidate selections", () => {
    const result = selectM3R2Candidates([snapshot()]);
    expect(Object.keys(result)).toHaveLength(9);
    expect(result["R2-H7-STRONG-SYMBOL"]).toHaveLength(1);
  });

  it("84 excludes outcomes from the snapshot contract", () => {
    expect(M3_R2_ROUND_002_DECISION_SNAPSHOT_FIELDS).not.toContain("netR");
    expect(M3_R2_ROUND_002_FORBIDDEN_SELECTOR_FIELDS).toContain("netR");
    expect(readFileSync("src/lib/research/m3-r2-decision-snapshot.ts", "utf8")).not.toMatch(/entryTime|exitTime|grossR|feeR|fundingR|netR|settlement/);
  });
  it("85 stays outside network, historical, performance, strategy, and optimizer boundaries", () => {
    const sources = [
      readFileSync("src/lib/research/selection-gates-round-002.ts", "utf8"),
      readFileSync("src/lib/research/m3-r2-round-002-plan.ts", "utf8"),
      readFileSync("src/lib/research/m3-r2-decision-snapshot.ts", "utf8"),
      readFileSync("src/lib/research/m3-r2-selectors.ts", "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(/binance|historical-loader|backtest-run|settlement-adapter|Math\.random|Date\.now|optimizer|gridSearch/i);
    expect(readFileSync("src/lib/strategy/candidate.ts", "utf8")).not.toContain("baseline-002");
    expect(M3_R2_ROUND_002_PLAN.performanceStatus).toBe("NOT_GENERATED");
  });
  it("86 preserves the exact Round-001 plan SHA", () => {
    expect(M3_H_ROUND_001_PLAN_SHA256).toBe("2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a");
  });
  it("87 passes the discriminating LONG H7 EMA200 close-distance fixture", () => {
    expect(passesM3R2H7(snapshot({
      symbol4hClose: 101,
      symbol4hEma50: 100.5,
      symbol4hEma200: 99,
      symbol4hAtr: 2,
      symbol4hEma200FiveBarsAgo: 98.8,
    }))).toBe(true);
  });
  it("88 passes the discriminating SHORT H7 EMA200 close-distance fixture", () => {
    expect(passesM3R2H7(shortSnapshot({
      symbol4hClose: 99,
      symbol4hEma50: 99.5,
      symbol4hEma200: 101,
      symbol4hAtr: 2,
      symbol4hEma200FiveBarsAgo: 101.2,
    }))).toBe(true);
  });
  it("89 keeps H7 close-distance measurement independent of EMA50", () => {
    const first = snapshot({ symbol4hClose: 101, symbol4hEma50: 100.5, symbol4hEma200: 99, symbol4hAtr: 2, symbol4hEma200FiveBarsAgo: 98.8 });
    const second = { ...first, symbol4hEma50: 100.25 };
    expect(passesM3R2H7(first)).toBe(true);
    expect(passesM3R2H7(second)).toBe(true);
  });
  it("90 applies the independent LONG close-distance boundary", () => {
    const exact = snapshot({ symbol4hClose: 101, symbol4hEma50: 100.5, symbol4hEma200: 99, symbol4hAtr: 2, symbol4hEma200FiveBarsAgo: 98.8 });
    expect(passesM3R2H7(exact)).toBe(true);
    expect(passesM3R2H7({ ...exact, symbol4hClose: 100.999 })).toBe(false);
  });
  it("91 applies the independent LONG EMA-spread boundary", () => {
    const exact = snapshot({ symbol4hClose: 101, symbol4hEma50: 100, symbol4hEma200: 99, symbol4hAtr: 2, symbol4hEma200FiveBarsAgo: 98.8 });
    expect(passesM3R2H7(exact)).toBe(true);
    expect(passesM3R2H7({ ...exact, symbol4hEma50: 99.999 })).toBe(false);
  });
  it("92 applies the independent LONG EMA200-slope boundary", () => {
    const exact = snapshot({ symbol4hClose: 101, symbol4hEma50: 100, symbol4hEma200: 99, symbol4hAtr: 2, symbol4hEma200FiveBarsAgo: 98.8 });
    expect(passesM3R2H7(exact)).toBe(true);
    expect(passesM3R2H7({ ...exact, symbol4hEma200FiveBarsAgo: 98.801 })).toBe(false);
  });
  it("93 applies the independent SHORT close-distance boundary", () => {
    const exact = shortSnapshot({ symbol4hClose: 99, symbol4hEma50: 99.5, symbol4hEma200: 101, symbol4hAtr: 2, symbol4hEma200FiveBarsAgo: 101.2 });
    expect(passesM3R2H7(exact)).toBe(true);
    expect(passesM3R2H7({ ...exact, symbol4hClose: 99.001 })).toBe(false);
  });
  it("94 applies the independent SHORT EMA-spread boundary", () => {
    const exact = shortSnapshot({ symbol4hClose: 98.999, symbol4hEma50: 100, symbol4hEma200: 101, symbol4hAtr: 2, symbol4hEma200FiveBarsAgo: 101.2 });
    expect(passesM3R2H7(exact)).toBe(true);
    expect(passesM3R2H7({ ...exact, symbol4hEma200: 100.999 })).toBe(false);
  });
  it("95 applies the independent SHORT EMA200-slope boundary", () => {
    const exact = shortSnapshot({ symbol4hClose: 99, symbol4hEma50: 100, symbol4hEma200: 101, symbol4hAtr: 2, symbol4hEma200FiveBarsAgo: 101.2 });
    expect(passesM3R2H7(exact)).toBe(true);
    expect(passesM3R2H7({ ...exact, symbol4hEma200FiveBarsAgo: 101.199 })).toBe(false);
  });
  it("96 includes the exact H7-H10 specs in the canonical plan", () => {
    expect(M3_R2_ROUND_002_PLAN.selectorSpecs).toEqual(M3_R2_ROUND_002_SELECTOR_SPECS);
    expect(M3_R2_ROUND_002_PLAN.selectorSpecs.H7.LONG.closeDistanceNumerator).toBe("symbol4hClose - symbol4hEma200");
    expect(M3_R2_ROUND_002_PLAN_CANONICAL_JSON).toContain("symbol4hEma200");
    expect(M3_R2_ROUND_002_PLAN_CANONICAL_JSON).toContain("Candle.quoteVolume");
  });
  it("97 matches selector behavior to the frozen selector specifications", () => {
    expect(M3_R2_ROUND_002_SELECTOR_SPECS.H7.thresholds.closeDistanceAtrMin).toBe(1);
    expect(M3_R2_ROUND_002_SELECTOR_SPECS.H7.thresholds.emaSpreadAtrMin).toBe(0.5);
    expect(M3_R2_ROUND_002_SELECTOR_SPECS.H7.thresholds.ema200SlopeAtrMin).toBe(0.1);
    expect(M3_R2_ROUND_002_SELECTOR_SPECS.H8.maxTouchAgeBars).toBe(2);
    expect(M3_R2_ROUND_002_SELECTOR_SPECS.H9.ratioMinimum).toBe(1);
    expect(M3_R2_ROUND_002_SELECTOR_SPECS.H10.marginMinimumAtr).toBe(0.1);
    expect(passesM3R2H8(snapshot({ nearestBaselinePullbackTouchAgeBars: M3_R2_ROUND_002_SELECTOR_SPECS.H8.maxTouchAgeBars }))).toBe(true);
    expect(passesM3R2H9(snapshot({ current1hQuoteVolume: 100, previous20Closed1hQuoteVolumeMean: 100 }))).toBe(true);
    expect(passesM3R2H10(snapshot({ breakoutMarginAtr: M3_R2_ROUND_002_SELECTOR_SPECS.H10.marginMinimumAtr }))).toBe(true);
  });
});
