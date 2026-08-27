import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import type { BacktestData, BacktestSignalResult } from "../src/lib/backtest/types.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import {
  directionAdjustedRelativeStrength,
  passesRound006BreakoutQuality,
  passesRound006TrendFreshness,
  selectRound006Cooldown,
  selectRound006TopNByRelativeStrength,
  selectRound006TopNByScore,
} from "../src/lib/research/m3-r6-round-006-selectors.ts";

const HOUR = 60 * 60 * 1000;
const BASE = Date.parse("2024-01-01T00:00:00.000Z");

function makeCandle(symbol: ResearchSymbol, openTime: number, close: number): Candle {
  return {
    symbol,
    timeframe: "1h",
    openTime,
    closeTime: openTime + HOUR - 1,
    open: close,
    high: close + 1,
    low: Math.max(1, close - 1),
    close,
    volume: 100,
    quoteVolume: close * 100,
    tradeCount: 1,
    takerBuyBaseVolume: 50,
    takerBuyQuoteVolume: close * 50,
  };
}

function makeResult(input: Readonly<{
  symbol?: ResearchSymbol;
  direction?: "LONG" | "SHORT";
  signalTime?: number;
  totalScore?: number;
  breakoutStrength?: number;
  pullbackQuality?: number;
}> = {}): BacktestSignalResult {
  const symbol = input.symbol ?? "BTCUSDT";
  const direction = input.direction ?? "LONG";
  return {
    snapshot: {
      strategyVersion: "baseline-001",
      backtestPolicyVersion: "bt-policy-003",
      signalTime: input.signalTime ?? BASE,
      symbol,
      direction,
      symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
      btcRegime: direction === "LONG" ? "BTC_STRONG_BULL" : "BTC_STRONG_BEAR",
      entryReference: 100,
      stopReference: direction === "LONG" ? 99 : 101,
      takeProfitReference: direction === "LONG" ? 102 : 98,
      stopDistance: 1,
      stopAtr: 1,
      breakdown: {
        trendStrength: 20,
        pullbackQuality: input.pullbackQuality ?? 20,
        breakoutStrength: input.breakoutStrength ?? 20,
        volumeScore: 20,
        riskRewardScore: 20,
      },
      totalScore: input.totalScore ?? 80,
      grade: "A",
    },
    status: "EXECUTED",
    entryTime: (input.signalTime ?? BASE) + HOUR,
    rawEntryPrice: 100,
    entryFill: 100,
    exitTime: (input.signalTime ?? BASE) + 2 * HOUR,
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

function makeData(
  closeFor: (symbol: ResearchSymbol, index: number) => number,
  count = 25,
): BacktestData {
  const datasets = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, {
    candles1h: Array.from({ length: count }, (_, index) => makeCandle(symbol, BASE + index * HOUR, closeFor(symbol, index))),
    candles4h: [],
  }])) as unknown as BacktestData["datasets"];
  const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
  return { datasets, funding, manifests: [], serverTime: BASE + count * HOUR };
}

describe("M3-R6 Round-006 frozen selectors", () => {
  it("applies strict same-symbol/same-direction cooldown boundaries", () => {
    const first = BASE;
    const results = [
      makeResult({ signalTime: first }),
      makeResult({ signalTime: first + 12 * HOUR }),
      makeResult({ signalTime: first + 12 * HOUR + 1 }),
      makeResult({ direction: "SHORT", signalTime: first + 12 * HOUR }),
    ];
    expect(selectRound006Cooldown(results, 12).map((result) => result.snapshot.signalTime)).toEqual([
      first,
      first + 12 * HOUR,
      first + 12 * HOUR + 1,
    ]);
    expect(selectRound006Cooldown(results, 24).map((result) => result.snapshot.signalTime)).toEqual([first, first + 12 * HOUR]);
  });

  it("selects deterministic score TOP-N within identical signal-time groups", () => {
    const signalTime = BASE + HOUR;
    const results = [
      makeResult({ symbol: "BTCUSDT", signalTime, totalScore: 90 }),
      makeResult({ symbol: "ETHUSDT", signalTime, totalScore: 95 }),
      makeResult({ symbol: "SOLUSDT", signalTime, totalScore: 95 }),
    ];
    expect(selectRound006TopNByScore(results, 1).map((result) => result.snapshot.symbol)).toEqual(["ETHUSDT"]);
    expect(selectRound006TopNByScore(results, 2).map((result) => result.snapshot.symbol)).toEqual(["ETHUSDT", "SOLUSDT"]);
  });

  it("uses only closed decision-time data for direction-adjusted relative strength", () => {
    const data = makeData((symbol, index) => {
      if (symbol === "BTCUSDT") return 100;
      if (symbol === "SOLUSDT") return 100 + index * 2;
      return 100 + index;
    });
    const signalTime = BASE + 24 * HOUR + HOUR - 1;
    const sol = makeResult({ symbol: "SOLUSDT", signalTime });
    const eth = makeResult({ symbol: "ETHUSDT", signalTime });
    expect(directionAdjustedRelativeStrength(sol, data)).toBeGreaterThan(directionAdjustedRelativeStrength(eth, data)!);
    expect(selectRound006TopNByRelativeStrength([eth, sol], data, 1).map((result) => result.snapshot.symbol)).toEqual(["SOLUSDT"]);
    expect(directionAdjustedRelativeStrength(sol, makeData(() => 100, 12))).toBeNull();
  });

  it("requires the exact frozen EMA20/EMA50 fresh trend condition", () => {
    const longData = makeData((_symbol, index) => 100 + index, 60);
    const shortData = makeData((_symbol, index) => 200 - index, 60);
    const signalTime = BASE + 59 * HOUR + HOUR - 1;
    expect(passesRound006TrendFreshness(makeResult({ signalTime }), longData)).toBe(true);
    expect(passesRound006TrendFreshness(makeResult({ direction: "SHORT", signalTime }), shortData)).toBe(true);
    expect(passesRound006TrendFreshness(makeResult({ signalTime: BASE + 2 * HOUR + HOUR - 1 }), longData)).toBe(false);
    const futureChanged = { ...longData, datasets: {
      ...longData.datasets,
      BTCUSDT: {
        ...longData.datasets.BTCUSDT,
        candles1h: [...longData.datasets.BTCUSDT.candles1h, makeCandle("BTCUSDT", BASE + 60 * HOUR, 10_000)],
      },
    } } satisfies BacktestData;
    expect(passesRound006TrendFreshness(makeResult({ signalTime }), futureChanged)).toBe(true);
  });

  it("keeps breakout and pullback thresholds inclusive at their frozen boundaries", () => {
    expect(passesRound006BreakoutQuality(makeResult({ breakoutStrength: 16 }), false)).toBe(false);
    expect(passesRound006BreakoutQuality(makeResult({ breakoutStrength: 17 }), false)).toBe(true);
    expect(passesRound006BreakoutQuality(makeResult({ breakoutStrength: 17, pullbackQuality: 17 }), true)).toBe(false);
    expect(passesRound006BreakoutQuality(makeResult({ breakoutStrength: 17, pullbackQuality: 18 }), true)).toBe(true);
  });
});
