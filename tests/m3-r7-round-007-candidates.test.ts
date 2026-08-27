import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import type { BacktestSignalResult } from "../src/lib/backtest/types.ts";
import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import {
  classifyR7Opportunity,
  type R7FeatureContext,
  type R7SymbolIndicatorContext,
} from "../src/lib/research/m3-r7-round-007-candidates.ts";

const HOUR = INTERVAL_MS["1h"];
const BASE = Date.parse("2024-01-01T00:00:00.000Z");
const SIGNAL_INDEX = 25;
const SIGNAL_TIME = BASE + (SIGNAL_INDEX + 1) * HOUR - 1;

type Scenario = Readonly<{
  direction: "LONG" | "SHORT";
  breakout: boolean;
  currentClose?: number;
  atr?: number;
  priorExtreme?: number;
  retestOutside?: boolean;
  trendAligned?: boolean;
}>;

function candle(symbol: ResearchSymbol, timeframe: "1h" | "4h", index: number, overrides: Partial<Candle> = {}): Candle {
  const interval = INTERVAL_MS[timeframe];
  const openTime = BASE + index * interval;
  const open = overrides.open ?? 100;
  const close = overrides.close ?? open;
  return {
    symbol,
    timeframe,
    openTime,
    closeTime: openTime + interval - 1,
    open,
    high: overrides.high ?? Math.max(open, close),
    low: overrides.low ?? Math.min(open, close),
    close,
    volume: 10,
    quoteVolume: 1_000,
    tradeCount: 10,
    takerBuyBaseVolume: 5,
    takerBuyQuoteVolume: 500,
  };
}

function symbolContext(symbol: ResearchSymbol, scenario: Scenario): R7SymbolIndicatorContext {
  const long = scenario.direction === "LONG";
  const atr = scenario.atr ?? 20;
  const level = long ? 104 : 96;
  const priorExtreme = scenario.priorExtreme ?? (long ? 110 : 90);
  const currentClose = scenario.currentClose ?? (long ? 110 : 90);
  const candles1h = Array.from({ length: 30 }, (_, index) => {
    let close = 100;
    let high = 101;
    let low = 99;
    if (index >= 20 && index <= 24) {
      close = long ? 100 : 100;
      high = 101;
      low = 99;
    }
    if (scenario.breakout && index >= 20 && index <= 22) {
      high = long ? level : 101;
      low = long ? 99 : level;
    }
    if (scenario.breakout && index === 23) close = long ? 110 : 90;
    if (scenario.breakout && index === 24) close = long ? level : level;
    if (index === 24 && !scenario.breakout) close = long ? 99 : 101;
    if (index === SIGNAL_INDEX) {
      close = scenario.breakout ? currentClose : currentClose;
      if (scenario.breakout) {
        const tolerance = 0.25 * atr;
        if (long) low = scenario.retestOutside ? level + tolerance + 0.001 : level + tolerance;
        else high = scenario.retestOutside ? level - tolerance - 0.001 : level - tolerance;
      } else if (long) {
        high = Math.max(priorExtreme, close);
        low = close - 1;
      } else {
        low = Math.min(priorExtreme, close);
        high = close + 1;
      }
    }
    if (!scenario.breakout && index >= 22 && index <= 24) {
      if (long) high = priorExtreme;
      else low = priorExtreme;
    }
    return candle(symbol, "1h", index, { open: close, close, high, low });
  });
  const candles4h = Array.from({ length: 10 }, (_, index) => candle(symbol, "4h", index));
  const aligned = scenario.trendAligned ?? true;
  const trendLong = long === aligned;
  return {
    symbol,
    candles1h,
    candles4h,
    ema20_1h: Array(30).fill(100),
    ema50_1h: Array(30).fill(long ? 90 : 110),
    atr14_1h: Array(30).fill(atr),
    ema20_4h: Array(10).fill(100),
    ema50_4h: Array(10).fill(trendLong ? 110 : 90),
    ema200_4h: Array(10).fill(100),
    atr14_4h: Array(10).fill(10),
  };
}

function context(scenario: Scenario): R7FeatureContext {
  const bySymbol = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, symbolContext(symbol, symbol === "ETHUSDT" ? scenario : { direction: "LONG", breakout: false })]));
  return { bySymbol: bySymbol as R7FeatureContext["bySymbol"] };
}

function result(direction: "LONG" | "SHORT"): BacktestSignalResult {
  return {
    snapshot: {
      strategyVersion: "baseline-001",
      backtestPolicyVersion: "bt-policy-003",
      signalTime: SIGNAL_TIME,
      symbol: "ETHUSDT",
      direction,
      symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
      btcRegime: direction === "LONG" ? "BTC_STRONG_BULL" : "BTC_STRONG_BEAR",
      entryReference: 100,
      stopReference: 95,
      takeProfitReference: 110,
      stopDistance: 5,
      stopAtr: 1,
      breakdown: { trendStrength: 20, pullbackQuality: 20, breakoutStrength: 20, volumeScore: 20, riskRewardScore: 20 },
      totalScore: 100,
      grade: "A",
    },
    status: "EXECUTED",
    entryTime: SIGNAL_TIME + HOUR,
    rawEntryPrice: 100,
    entryFill: 100,
    exitTime: SIGNAL_TIME + 2 * HOUR,
    rawExitPrice: 101,
    exitFill: 101,
    heldCandleNumber: 1,
    exitReason: "TP",
    fundingCharges: [],
    fundingPnL: 0,
    priceR: 1,
    feeR: 0,
    fundingR: 0,
    grossR: 1,
    netR: 1,
  };
}

describe("M3-R7 closed-candle candidate architectures", () => {
  it("recognizes LONG and SHORT pullback reclaim only after the closed decision candle", () => {
    const longResult = result("LONG");
    const shortResult = result("SHORT");
    expect(classifyR7Opportunity(context({ direction: "LONG", breakout: false }), longResult).e1PullbackReclaim).toBe(true);
    expect(classifyR7Opportunity(context({ direction: "SHORT", breakout: false }), shortResult).e1PullbackReclaim).toBe(true);
    expect(longResult.entryTime).toBe(longResult.snapshot.signalTime + HOUR);
    expect(shortResult.entryTime).toBe(shortResult.snapshot.signalTime + HOUR);
  });

  it("uses the exact 0.75 ATR extension boundary and rejects a wider extension", () => {
    expect(classifyR7Opportunity(context({ direction: "LONG", breakout: false, currentClose: 115, priorExtreme: 120 }), result("LONG")).e1PullbackReclaim).toBe(true);
    expect(classifyR7Opportunity(context({ direction: "LONG", breakout: false, currentClose: 115.0001, priorExtreme: 120 }), result("LONG")).e1PullbackReclaim).toBe(false);
  });

  it("recognizes a closed breakout retest at the exact 0.25 ATR tolerance, but not outside it", () => {
    const exact = classifyR7Opportunity(context({ direction: "LONG", breakout: true, atr: 8 }), result("LONG"));
    const outside = classifyR7Opportunity(context({ direction: "LONG", breakout: true, atr: 8, retestOutside: true }), result("LONG"));
    expect(exact.e2BreakoutRetest).toBe(true);
    expect(outside.e2BreakoutRetest).toBe(false);
    expect(exact.e1PullbackReclaim).toBe(false);
  });

  it("expires a retest after three candles and ignores future candles", () => {
    const noRetest = classifyR7Opportunity(context({ direction: "LONG", breakout: false }), result("LONG"));
    const baseContext = context({ direction: "LONG", breakout: false });
    const target = baseContext.bySymbol.ETHUSDT!;
    const futureContext: R7FeatureContext = {
      bySymbol: {
        ...baseContext.bySymbol,
        ETHUSDT: {
          ...target,
          candles1h: [...target.candles1h, candle("ETHUSDT", "1h", 30, { close: 10_000, high: 20_000 })],
        },
      },
    };
    expect(noRetest.e2BreakoutRetest).toBe(false);
    expect(classifyR7Opportunity(futureContext, result("LONG"))).toEqual(classifyR7Opportunity(baseContext, result("LONG")));
  });

  it("fails closed when the decision-time warm-up window is insufficient or the 4h anchor disagrees", () => {
    const baseContext = context({ direction: "LONG", breakout: false });
    const target = baseContext.bySymbol.ETHUSDT!;
    const shortContext: R7FeatureContext = { bySymbol: { ...baseContext.bySymbol, ETHUSDT: { ...target, candles1h: target.candles1h.slice(0, 4) } } };
    expect(classifyR7Opportunity(shortContext, result("LONG")).e1PullbackReclaim).toBe(false);
    expect(classifyR7Opportunity(context({ direction: "LONG", breakout: false, trendAligned: false }), result("LONG")).e1PullbackReclaim).toBe(false);
  });
});
