import { describe, expect, it, vi } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import { BACKTEST_PERIOD_RANGES } from "../src/lib/backtest/constants.ts";
import { runBacktest } from "../src/lib/backtest/runner.ts";
import type { BacktestData } from "../src/lib/backtest/types.ts";
import type { HistoricalManifest } from "../src/lib/historical-data/types.ts";
import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import type { StrategyEngineResult } from "../src/lib/strategy/types.ts";

const strategyMock = vi.hoisted(() => ({
  evaluateStrategy: vi.fn(),
}));

vi.mock("../src/lib/strategy/engine.ts", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/strategy/engine.ts")>("../src/lib/strategy/engine.ts");
  return { ...actual, evaluateStrategy: strategyMock.evaluateStrategy };
});

function makeCandle(symbol: ResearchSymbol, timeframe: "1h" | "4h", openTime: number): Candle {
  const interval = INTERVAL_MS[timeframe];
  return {
    symbol,
    timeframe,
    openTime,
    closeTime: openTime + interval - 1,
    open: 100,
    high: 100.5,
    low: 99.5,
    close: 100,
    volume: 10,
    quoteVolume: 1_000,
    tradeCount: 10,
    takerBuyBaseVolume: 5,
    takerBuyQuoteVolume: 500,
  };
}

function backtestData(): BacktestData {
  const periodStart = BACKTEST_PERIOD_RANGES.DEV.startTime;
  const oneHourStart = periodStart - 250 * INTERVAL_MS["1h"];
  const fourHourStart = periodStart - 250 * INTERVAL_MS["4h"];
  const datasets = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [
      symbol,
      {
        candles1h: Array.from({ length: 275 }, (_, index) => makeCandle(symbol, "1h", oneHourStart + index * INTERVAL_MS["1h"])),
        candles4h: Array.from({ length: 250 }, (_, index) => makeCandle(symbol, "4h", fourHourStart + index * INTERVAL_MS["4h"])),
      },
    ]),
  ) as unknown as BacktestData["datasets"];
  const funding = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [
      symbol,
      symbol === "BTCUSDT"
        ? [{ symbol, fundingTime: periodStart + 2 * INTERVAL_MS["1h"], fundingRate: 0.0001, directMarkPrice: 100 }]
        : [],
    ]),
  ) as unknown as BacktestData["funding"];
  const manifests = RESEARCH_SYMBOLS.flatMap((symbol) => [
    {
      kind: "candles" as const,
      provider: "binance-usdm-public" as const,
      source: "/fapi/v1/klines" as const,
      symbol,
      timeframe: "1h" as const,
      requestedStartTime: oneHourStart,
      requestedEndTime: BACKTEST_PERIOD_RANGES.DEV.endTime,
      actualStartTime: oneHourStart,
      actualEndTime: BACKTEST_PERIOD_RANGES.DEV.endTime,
      rowCount: 275,
      retrievedAt: "2026-08-22T00:00:00.000Z",
      sha256: "0".repeat(64),
      settlementOnly: false,
    },
    {
      kind: "candles" as const,
      provider: "binance-usdm-public" as const,
      source: "/fapi/v1/klines" as const,
      symbol,
      timeframe: "4h" as const,
      requestedStartTime: fourHourStart,
      requestedEndTime: BACKTEST_PERIOD_RANGES.DEV.endTime,
      actualStartTime: fourHourStart,
      actualEndTime: BACKTEST_PERIOD_RANGES.DEV.endTime,
      rowCount: 250,
      retrievedAt: "2026-08-22T00:00:00.000Z",
      sha256: "0".repeat(64),
      settlementOnly: false,
    },
    {
      kind: "funding" as const,
      provider: "binance-usdm-public" as const,
      source: "/fapi/v1/fundingRate" as const,
      symbol,
      requestedStartTime: fourHourStart,
      requestedEndTime: BACKTEST_PERIOD_RANGES.DEV.endTime,
      actualStartTime: null,
      actualEndTime: null,
      rowCount: 0,
      retrievedAt: "2026-08-22T00:00:00.000Z",
      sha256: "0".repeat(64),
      settlementOnly: false,
      markPriceField: "markPrice" as const,
    },
  ]) as HistoricalManifest[];
  return { datasets, funding, manifests };
}

function formalEngineResult(): StrategyEngineResult {
  const candidate = {
    strategyVersion: "baseline-001" as const,
    symbol: "BTCUSDT" as const,
    direction: "LONG" as const,
    symbolRegime: "LONG_ONLY" as const,
    btcRegime: "BTC_STRONG_BULL" as const,
    entryReference: 100,
    stopReference: 99,
    takeProfitReference: 102,
    stopDistance: 1,
    stopAtr: 1,
    breakdown: {
      trendStrength: 20,
      pullbackQuality: 20,
      breakoutStrength: 20,
      volumeScore: 20,
      riskRewardScore: 20,
    },
    totalScore: 100,
    grade: "A" as const,
    formalSignal: true,
  };
  return {
    strategyVersion: "baseline-001",
    btcRegime: "BTC_STRONG_BULL",
    evaluations: [{
      strategyVersion: "baseline-001",
      symbol: "BTCUSDT",
      direction: "LONG",
      status: "FORMAL_SIGNAL",
      reason: null,
      symbolRegime: "LONG_ONLY",
      btcRegime: "BTC_STRONG_BULL",
      candidate,
    }],
    rankedCandidates: [candidate],
  };
}

describe("M3-R5-B.2 runner performance-result lock callback", () => {
  it("notifies at the first real signal result before later report work", () => {
    strategyMock.evaluateStrategy.mockReturnValue(formalEngineResult());
    const observed: string[] = [];

    expect(() => runBacktest({
      period: "DEV",
      policy: "bt-policy-001",
      data: backtestData(),
      onPerformanceResultGenerated: (result) => {
        observed.push(result.status);
        throw new Error("STOP_AFTER_FIRST_SIGNAL_RESULT");
      },
    })).toThrow("STOP_AFTER_FIRST_SIGNAL_RESULT");

    expect(observed).toEqual(["EXECUTED"]);
    expect(strategyMock.evaluateStrategy).toHaveBeenCalledTimes(1);
  });
});
