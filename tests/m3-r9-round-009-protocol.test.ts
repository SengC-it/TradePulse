import { describe, expect, it } from "vitest";

import { R9_CANDIDATE_REGISTRY, R9_DATA_CONTRACT, R9_FEATURE_DEFINITIONS, R9_GOVERNANCE, R9_MODEL_CONTRACT, M3_R9_CANDIDATE_IDS, M3_R9_RESEARCH_END_ISO } from "../src/lib/research/m3-r9-round-009-protocol.ts";
import { R9_PLAN, validateR9Plan } from "../src/lib/research/m3-r9-round-009-plan.ts";
import { R9_SPEC_CONFORMANCE_REPORT, validateR9SpecConformance } from "../src/lib/research/m3-r9-round-009-conformance.ts";
import { isR9E1PullbackReclaim } from "../src/lib/research/m3-r9-round-009-candidates.ts";
import type { R9FeatureContext, R9SymbolIndicatorContext } from "../src/lib/research/m3-r9-round-009-candidates.ts";
import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import type { Candle } from "../src/lib/market-data/types.ts";

const HOUR = INTERVAL_MS["1h"];
const BASE = Date.parse("2024-01-01T00:00:00.000Z");

function candle(symbol: ResearchSymbol, index: number, overrides: Partial<Candle> = {}): Candle {
  const openTime = BASE + index * HOUR;
  const open = overrides.open ?? 100;
  const close = overrides.close ?? open;
  return { symbol, timeframe: "1h", openTime, closeTime: openTime + HOUR - 1, open, high: overrides.high ?? Math.max(open, close), low: overrides.low ?? Math.min(open, close), close, volume: 10, quoteVolume: 1_000, tradeCount: 10, takerBuyBaseVolume: 5, takerBuyQuoteVolume: 500 };
}

function context(): R9FeatureContext {
  const bySymbol = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => {
    const candles1h = Array.from({ length: 30 }, (_, index) => index === 24 ? candle(symbol, index, { open: 100, close: 101, high: 102, low: 99 }) : candle(symbol, index, { open: 100, close: index === 23 ? 99 : 100, high: 101, low: 99 }));
    const candles4h = Array.from({ length: 10 }, (_, index) => ({ symbol, timeframe: "4h" as const, openTime: BASE + index * INTERVAL_MS["4h"], closeTime: BASE + (index + 1) * INTERVAL_MS["4h"] - 1, open: 110, high: 111, low: 109, close: 110, volume: 10, quoteVolume: 1_000, tradeCount: 10, takerBuyBaseVolume: 5, takerBuyQuoteVolume: 500 }));
    const indicator: R9SymbolIndicatorContext = { symbol, candles1h, candles4h, ema20_1h: Array(30).fill(100), ema50_1h: Array(30).fill(90), atr14_1h: Array(30).fill(20), ema50_4h: Array(10).fill(110), ema200_4h: Array.from({ length: 10 }, (_, value) => 99 + value), atr14_4h: Array(10).fill(10) };
    return [symbol, indicator];
  })) as Record<ResearchSymbol, R9SymbolIndicatorContext>;
  return { bySymbol };
}

describe("M3-R9 protocol and structural conformance", () => {
  it("freezes the five candidates, boundary, streams, and safety controls", () => {
    expect(M3_R9_CANDIDATE_IDS).toHaveLength(5);
    expect(M3_R9_RESEARCH_END_ISO).toBe("2026-08-15T23:59:59.999Z");
    expect(R9_DATA_CONTRACT.opportunityStreams).toEqual(["BASELINE_FORMAL_STREAM", "BASELINE_PRE_SCORE_ELIGIBLE_STREAM", "NEW_ENTRY_EVENT_STREAM"]);
    expect(R9_GOVERNANCE.noPrivateBinanceApi).toBe(true);
    expect(R9_GOVERNANCE.noAutomaticTrading).toBe(true);
    expect(R9_MODEL_CONTRACT.lambda).toBe(10);
    expect(R9_CANDIDATE_REGISTRY.find((candidate) => candidate.candidateId === "R9-E1-PULLBACK-RECLAIM")?.signalRule).toContain("NO_BASELINE_FORMAL_MEMBERSHIP_PREREQUISITE");
    expect(R9_CANDIDATE_REGISTRY.find((candidate) => candidate.candidateId === "R9-E2-BREAKOUT-RETEST")?.signalRule).toContain("NO_BASELINE_FORMAL_MEMBERSHIP_PREREQUISITE");
  });

  it("pins the exact feature and volatility identities", () => {
    expect(R9_FEATURE_DEFINITIONS.directionAdjusted4hEma200DistanceAtr).toContain("close4h");
    expect(R9_CANDIDATE_REGISTRY[0]!.dataRule).toContain("ATR14_1H_DIVIDED_BY_CLOSE1H");
    expect(R9_PLAN.performance.authorization).toBe("NOT_AUTHORIZED");
    validateR9Plan();
    validateR9SpecConformance();
    expect(R9_SPEC_CONFORMANCE_REPORT.resultAffectingDeviationCount).toBe(0);
  });

  it("allows direct E1 generation without a baseline formal prerequisite", () => {
    const candidateContext = context();
    expect(isR9E1PullbackReclaim(candidateContext, "BTCUSDT", "LONG", 24)).toBe(true);
  });
});
