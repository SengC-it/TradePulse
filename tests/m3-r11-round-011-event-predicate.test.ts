import { describe, expect, it } from "vitest";

import type { BacktestData, BacktestSignalSnapshot } from "../src/lib/backtest/types.ts";
import { adaptBacktestSignalResult } from "../src/lib/research/adapter.ts";
import { calculateResearchDiagnostics } from "../src/lib/research/diagnostics.ts";
import { buildHistoricalIndexes } from "../src/lib/backtest/windows.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import {
  findR11E2BreakoutSource,
  isR11DecisionTimeInFrozenRange,
  isR11E2RetestInBand,
  type R11FeatureContext,
  type R11SymbolIndicatorContext,
} from "../src/lib/research/m3-r11-round-011-candidates.ts";
import { settleR11OpportunityIntent } from "../src/lib/research/m3-r11-round-011-performance.ts";
import { classifyR11SettlementHorizon } from "../src/lib/research/m3-r11-round-011-settlement.ts";
import type { R11OpportunityIntent } from "../src/lib/research/m3-r11-round-011-candidates.ts";
import { R11_SPEC_CONFORMANCE_REPORT, validateR11SpecConformance } from "../src/lib/research/m3-r11-round-011-conformance.ts";

function candle(symbol: ResearchSymbol, timeframe: "1h" | "4h", openTime: number, low: number, high: number, close: number): {
  symbol: ResearchSymbol;
  timeframe: "1h" | "4h";
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  tradeCount: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
} {
  const intervalMs = timeframe === "1h" ? 3_600_000 : 14_400_000;
  return { symbol, timeframe, openTime, closeTime: openTime + intervalMs - 1, open: (low + high) / 2, high, low, close, volume: 1, quoteVolume: 1, tradeCount: 1, takerBuyBaseVolume: 0.5, takerBuyQuoteVolume: 0.5 };
}

function e2Context(distance: 1 | 2 | 3 | 4, direction: "LONG" | "SHORT", previousClose: number): R11FeatureContext {
  const targetIndex = 8;
  const breakoutIndex = targetIndex - distance;
  const candles = Array.from({ length: targetIndex + 1 }, (_, index) => direction === "LONG"
    ? candle("BTCUSDT", "1h", Date.parse("2024-01-01T00:00:00.000Z") + index * 3_600_000, 99, 100, 99.5)
    : candle("BTCUSDT", "1h", Date.parse("2024-01-01T00:00:00.000Z") + index * 3_600_000, 100, 101, 100.5));
  candles[breakoutIndex] = direction === "LONG"
    ? candle("BTCUSDT", "1h", candles[breakoutIndex]!.openTime, 99, 102, 101)
    : candle("BTCUSDT", "1h", candles[breakoutIndex]!.openTime, 98, 101, 99);
  if (breakoutIndex !== targetIndex - 1) {
    candles[targetIndex - 1] = direction === "LONG"
      ? candle("BTCUSDT", "1h", candles[targetIndex - 1]!.openTime, 99, 102, previousClose)
      : candle("BTCUSDT", "1h", candles[targetIndex - 1]!.openTime, 98, 101, previousClose);
  }
  candles[targetIndex] = direction === "LONG"
    ? candle("BTCUSDT", "1h", candles[targetIndex]!.openTime, 100, 103, 101)
    : candle("BTCUSDT", "1h", candles[targetIndex]!.openTime, 97, 100, 99);
  const selected: R11SymbolIndicatorContext = {
    symbol: "BTCUSDT",
    candles1h: candles,
    candles4h: [],
    ema20_1h: [],
    ema50_1h: [],
    atr14_1h: Object.freeze(candles.map((_, index) => index === breakoutIndex ? 4 : null)),
    ema50_4h: [],
    ema200_4h: [],
    atr14_4h: [],
  };
  return { bySymbol: { BTCUSDT: selected } } as unknown as R11FeatureContext;
}

function periodEndData(): Readonly<{ data: BacktestData; intent: R11OpportunityIntent }> {
  const signalOpenTime = Date.parse("2025-12-31T23:00:00.000Z");
  const signal = candle("BTCUSDT", "1h", signalOpenTime, 99, 101, 100);
  const trend = candle("BTCUSDT", "4h", Date.parse("2025-12-31T20:00:00.000Z"), 99, 101, 100);
  const datasets = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, {
    candles1h: [candle(symbol, "1h", signalOpenTime, 99, 101, 100)],
    candles4h: [candle(symbol, "4h", trend.openTime, 99, 101, 100)],
  }])) as unknown as BacktestData["datasets"];
  const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
  const snapshot: BacktestSignalSnapshot = {
    strategyVersion: "baseline-001",
    symbol: "BTCUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_NEUTRAL",
    entryReference: 100,
    stopReference: 90,
    takeProfitReference: 120,
    stopDistance: 10,
    stopAtr: 1,
    breakdown: { trendStrength: 1, pullbackQuality: 0, breakoutStrength: 0, volumeScore: 0, riskRewardScore: 2 },
    totalScore: 80,
    grade: "A",
    backtestPolicyVersion: "bt-policy-003",
    signalTime: signal.closeTime,
  };
  const candidate = { ...snapshot, formalSignal: true };
  return {
    data: { datasets, funding, manifests: [] },
    intent: {
      candidateId: "R11-E1-PULLBACK-RECLAIM",
      stream: "NEW_ENTRY_EVENT_STREAM",
      symbol: "BTCUSDT",
      direction: "LONG",
      decisionTime: signal.closeTime,
      signalCandle: signal,
      candidate,
    },
  };
}

describe("M3-R11 event predicate and period-end conformance", () => {
  it("uses inclusive two-sided E2 bands with directional close reclaim", () => {
    const level = 100;
    const breakoutAtr = 4;
    const lower = level - 0.25 * breakoutAtr;
    const upper = level + 0.25 * breakoutAtr;
    expect(isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr, current: { low: lower, high: 103, close: 101 } })).toBe(true);
    expect(isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr, current: { low: upper, high: 103, close: 101 } })).toBe(true);
    expect(isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr, current: { low: lower - 0.01, high: 103, close: 101 } })).toBe(false);
    expect(isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr, current: { low: upper + 0.01, high: 103, close: 101 } })).toBe(false);
    expect(isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr, current: { low: lower, high: 103, close: level } })).toBe(false);
    expect(isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr, current: { low: 97, high: lower, close: 99 } })).toBe(true);
    expect(isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr, current: { low: 97, high: upper, close: 99 } })).toBe(true);
    expect(isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr, current: { low: 97, high: lower - 0.01, close: 99 } })).toBe(false);
    expect(isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr, current: { low: 97, high: upper + 0.01, close: 99 } })).toBe(false);
    expect(isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr, current: { low: 97, high: upper, close: level } })).toBe(false);
  });

  it("allows a prior close on the breakout side and expires after three candles", () => {
    expect(findR11E2BreakoutSource(e2Context(2, "LONG", 101), "BTCUSDT", "LONG", 8)).not.toBeNull();
    expect(findR11E2BreakoutSource(e2Context(2, "SHORT", 99), "BTCUSDT", "SHORT", 8)).not.toBeNull();
    for (const distance of [1, 2, 3] as const) expect(findR11E2BreakoutSource(e2Context(distance, "LONG", 100), "BTCUSDT", "LONG", 8)).not.toBeNull();
    expect(findR11E2BreakoutSource(e2Context(4, "LONG", 100), "BTCUSDT", "LONG", 8)).toBeNull();
  });

  it("retains a final-boundary formal event and classifies its missing horizon as a censor", () => {
    const { data, intent } = periodEndData();
    expect(isR11DecisionTimeInFrozenRange(intent.decisionTime)).toBe(true);
    expect(classifyR11SettlementHorizon(intent.signalCandle.openTime, "DEV")).toBe("PERIOD_END_CENSORED");
    const result = settleR11OpportunityIntent(data, buildHistoricalIndexes(data.datasets), intent);
    expect(intent.candidate.formalSignal).toBe(true);
    expect(result.status).toBe("PERIOD_END_CENSORED");
    expect(result.entryTime).toBeNull();
    expect(result.netR).toBeNull();
    const diagnostics = calculateResearchDiagnostics({ records: [adaptBacktestSignalResult(result)], range: { startTime: intent.decisionTime, endTime: intent.decisionTime } });
    expect(diagnostics.formalSignals).toBe(1);
    expect(diagnostics.executedTrades).toBe(0);
    expect(diagnostics.expectancyR).toBeNull();
    expect(diagnostics.profitFactorStatus).toBe("NO_TRADES");
  });

  it("requires every result-affecting conformance boundary before performance", () => {
    validateR11SpecConformance();
    expect(R11_SPEC_CONFORMANCE_REPORT.resultAffectingDeviationCount).toBe(0);
    for (const field of [
      "e1IndependentUniverse",
      "e1StructuralStop",
      "e2IndependentUniverse",
      "e2TwoSidedRetestBand",
      "e2NoPriorClosePrerequisite",
      "e2ThreeCandleExpiry",
      "e2StructuralStop",
      "stopBufferSemantics",
      "stopAtrBoundary",
      "tpUsesFullRiskDistance",
      "s1UsesPreScoreUniverse",
      "feature4hCloseUses4hClose",
      "routerVolatilityUsesAtrPrice",
      "candidateLocalModelIntegrity",
      "c1UsesE1SettlementIdentity",
      "periodEndCensorPreserved",
      "noPostLockFetch",
      "noPrivateBinanceApi",
      "noAutomaticTrading",
    ] as const) expect(R11_SPEC_CONFORMANCE_REPORT[field]).toBe(true);
  });
});
