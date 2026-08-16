import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import {
  BACKTEST_PERIOD_RANGES,
  BACKTEST_POLICY,
  evaluateBacktestAcceptance,
  latestAsOfWindow,
  buildStrategyInput,
  calculateBacktestMetrics,
  getHeldCandles,
  runBacktest,
  serializeBacktestReport,
  settleBacktestSignal,
  snapshotFromCandidate,
} from "../src/lib/backtest/index.ts";
import type { BacktestData, BacktestSignalResult, BacktestSignalSnapshot } from "../src/lib/backtest/types.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import { parseBinanceFundingRateHistory } from "../src/lib/historical-data/binance/parser.ts";
import { HistoricalDataError } from "../src/lib/historical-data/errors.ts";
import { validateFundingRecords, validateHistoricalCandleSeries } from "../src/lib/historical-data/validation.ts";
import { INTERVAL_MS, type MarketTimeframe } from "../src/lib/market-data/intervals.ts";
import type { Candle } from "../src/lib/market-data/types.ts";

const HOUR = INTERVAL_MS["1h"];

function makeCandle(
  symbol: ResearchSymbol,
  timeframe: MarketTimeframe,
  openTime: number,
  overrides: Partial<Candle> = {},
): Candle {
  const interval = INTERVAL_MS[timeframe];
  const open = overrides.open ?? 100;
  const close = overrides.close ?? open;
  const high = overrides.high ?? Math.max(open, close);
  const low = overrides.low ?? Math.min(open, close);
  return Object.freeze({
    symbol,
    timeframe,
    openTime,
    closeTime: openTime + interval - 1,
    open,
    high,
    low,
    close,
    volume: overrides.volume ?? 10,
    quoteVolume: overrides.quoteVolume ?? 1_000,
    tradeCount: overrides.tradeCount ?? 10,
    takerBuyBaseVolume: overrides.takerBuyBaseVolume ?? 5,
    takerBuyQuoteVolume: overrides.takerBuyQuoteVolume ?? 500,
  });
}

function makeSnapshot(overrides: Partial<BacktestSignalSnapshot> = {}): BacktestSignalSnapshot {
  return Object.freeze({
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-001",
    signalTime: 10 * HOUR - 1,
    symbol: "BTCUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_NEUTRAL",
    entryReference: 100,
    stopReference: 95,
    takeProfitReference: 110,
    stopDistance: 5,
    stopAtr: 1,
    breakdown: {
      trendStrength: 40,
      pullbackQuality: 20,
      breakoutStrength: 20,
      volumeScore: 10,
      riskRewardScore: 10,
    },
    totalScore: 100,
    grade: "A",
    ...overrides,
  });
}

function makeHeldCandles(signalOpenTime: number, overrides: Partial<Candle> = {}): readonly Candle[] {
  return Object.freeze(
    Array.from({ length: BACKTEST_POLICY.heldCandleCount }, (_, index) =>
      makeCandle("BTCUSDT", "1h", signalOpenTime + (index + 1) * HOUR, overrides),
    ),
  );
}

function makeExecutedResult(overrides: Partial<BacktestSignalResult> = {}): BacktestSignalResult {
  const snapshot = makeSnapshot(overrides.snapshot);
  return Object.freeze({
    snapshot,
    status: "EXECUTED",
    entryTime: snapshot.signalTime + HOUR,
    rawEntryPrice: 100,
    entryFill: 100.05,
    exitTime: snapshot.signalTime + 2 * HOUR,
    rawExitPrice: 110,
    exitFill: 109.945,
    heldCandleNumber: 2,
    exitReason: "TP",
    fundingCharges: Object.freeze([]),
    fundingPnL: 0,
    priceR: 1.979,
    feeR: 0.021,
    fundingR: 0,
    grossR: 1.979,
    netR: 1.958,
    ...overrides,
  });
}

describe("M3 historical data validation and pagination", () => {
  it("rejects duplicate, gap, and malformed historical candles", () => {
    const first = makeCandle("BTCUSDT", "1h", 0);
    expect(() => validateHistoricalCandleSeries([first, first], { symbol: "BTCUSDT", timeframe: "1h" })).toThrowError(
      HistoricalDataError,
    );
    expect(() =>
      validateHistoricalCandleSeries([first, makeCandle("BTCUSDT", "1h", 2 * HOUR)], {
        symbol: "BTCUSDT",
        timeframe: "1h",
      }),
    ).toThrowError(HistoricalDataError);
    expect(() =>
      validateHistoricalCandleSeries([makeCandle("BTCUSDT", "1h", 0, { high: Number.NaN })], {
        symbol: "BTCUSDT",
        timeframe: "1h",
      }),
    ).toThrowError(HistoricalDataError);
  });

  it("requires the official funding markPrice and does not infer a value", () => {
    const payload = [{ symbol: "BTCUSDT", fundingTime: 1, fundingRate: "0.001", markPrice: "100" }];
    const records = parseBinanceFundingRateHistory(payload, "BTCUSDT");
    expect(records[0]).toMatchObject({ fundingTime: 1, fundingRate: 0.001, markPrice: 100 });
    expect(() => parseBinanceFundingRateHistory([{ ...payload[0], markPrice: undefined }], "BTCUSDT")).toThrowError(
      HistoricalDataError,
    );
    expect(() => validateFundingRecords([{ ...records[0]!, markPrice: 0 }], { symbol: "BTCUSDT" })).toThrowError(
      HistoricalDataError,
    );
  });

  it("paginates Klines from the last accepted open time without repeating a page", async () => {
    const calls: URL[] = [];
    const raw = (openTime: number) => [openTime, "100", "100", "100", "100", "10", openTime + HOUR - 1, "1000", "10", "5", "500", "0"];
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input.toString());
      calls.push(url);
      const start = Number(url.searchParams.get("startTime"));
      const page = [start, start + HOUR].filter((value) => value <= 3 * HOUR).map(raw);
      return new Response(JSON.stringify(page), { status: 200, headers: { "content-type": "application/json" } });
    };
    const loader = new BinanceHistoricalDataLoader({ clientOptions: { fetchImpl }, klineLimit: 2, now: () => 123 });
    const dataset = await loader.loadCandles({
      symbol: "BTCUSDT",
      timeframe: "1h",
      range: { startTime: 0, endTime: 3 * HOUR },
    });
    expect(dataset.candles).toHaveLength(4);
    expect(calls.map((call) => Number(call.searchParams.get("startTime")))).toEqual([0, 2 * HOUR]);
    expect(dataset.manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(dataset.manifest.retrievedAt).toBe("1970-01-01T00:00:00.123Z");
  });
});

describe("M3 exact as-of windows and held horizon", () => {
  it("passes exactly 250 latest closed candles for every symbol and timeframe", () => {
    const datasets = Object.fromEntries(
      RESEARCH_SYMBOLS.map((symbol) => [
        symbol,
        {
          candles1h: Array.from({ length: 1_100 }, (_, index) => makeCandle(symbol, "1h", index * HOUR)),
          candles4h: Array.from({ length: 250 }, (_, index) => makeCandle(symbol, "4h", index * INTERVAL_MS["4h"])),
        },
      ]),
    ) as unknown as Record<ResearchSymbol, { candles1h: readonly Candle[]; candles4h: readonly Candle[] }>;
    const evaluationTime = 1_099 * HOUR + HOUR - 1;
    const input = buildStrategyInput(datasets, evaluationTime);
    for (const symbol of RESEARCH_SYMBOLS) {
      expect(input.datasets[symbol]?.candles1h).toHaveLength(250);
      expect(input.datasets[symbol]?.candles4h).toHaveLength(250);
      expect(input.datasets[symbol]?.candles1h.every((candle) => candle.closeTime <= evaluationTime)).toBe(true);
      expect(input.datasets[symbol]?.candles4h.every((candle) => candle.closeTime <= evaluationTime)).toBe(true);
    }
    expect(latestAsOfWindow(datasets.BTCUSDT.candles1h, evaluationTime)).toHaveLength(250);
  });

  it("uses the next-open candle as held #1 and never creates held #25", () => {
    const signalOpen = 10 * HOUR;
    const signal = makeCandle("BTCUSDT", "1h", signalOpen);
    const candles = [signal, ...makeHeldCandles(signalOpen)];
    const held = getHeldCandles(candles, signal.closeTime);
    expect(held).toHaveLength(24);
    expect(held[0]?.openTime).toBe(signalOpen + HOUR);
    expect(held[23]?.openTime).toBe(signalOpen + 24 * HOUR);
    expect(held[24]).toBeUndefined();
  });
});

describe("M3 bt-policy-001 settlement", () => {
  it("settles TIME_EXIT at held #24 and applies funding after entry", () => {
    const signal = makeCandle("BTCUSDT", "1h", 10 * HOUR);
    const snapshot = makeSnapshot({ signalTime: signal.closeTime });
    const held = makeHeldCandles(signal.openTime);
    const result = settleBacktestSignal({
      snapshot,
      signalCandle: signal,
      heldCandles: held,
      funding: [{ symbol: "BTCUSDT", fundingTime: signal.openTime + 2 * HOUR, fundingRate: 0.001, markPrice: 100 }],
      period: "OOS",
      periodEndTime: BACKTEST_PERIOD_RANGES.OOS.endTime,
    });
    expect(result.status).toBe("EXECUTED");
    expect(result.exitReason).toBe("TIME_EXIT");
    expect(result.heldCandleNumber).toBe(24);
    expect(result.exitTime).toBe(held[23]!.closeTime);
    expect(result.fundingCharges).toHaveLength(1);
    expect(result.netR).toBeTypeOf("number");
  });

  it("resolves a same-candle TP/SL conflict conservatively as SL", () => {
    const signal = makeCandle("BTCUSDT", "1h", 10 * HOUR);
    const held = makeHeldCandles(signal.openTime, { low: 94, high: 111 });
    const result = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: signal.closeTime }),
      signalCandle: signal,
      heldCandles: held,
      funding: [{ symbol: "BTCUSDT", fundingTime: signal.openTime + 2 * HOUR, fundingRate: 0, markPrice: 100 }],
      period: "OOS",
      periodEndTime: BACKTEST_PERIOD_RANGES.OOS.endTime,
    });
    expect(result.status).toBe("EXECUTED");
    expect(result.exitReason).toBe("SL");
    expect(result.heldCandleNumber).toBe(1);
  });

  it("marks a TP/SL exit with unknown intrabar funding order ambiguous", () => {
    const signal = makeCandle("BTCUSDT", "1h", 10 * HOUR);
    const held = makeHeldCandles(signal.openTime, { high: 111 });
    const result = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: signal.closeTime }),
      signalCandle: signal,
      heldCandles: held,
      funding: [{ symbol: "BTCUSDT", fundingTime: held[0]!.openTime + 1, fundingRate: 0, markPrice: 100 }],
      period: "OOS",
      periodEndTime: BACKTEST_PERIOD_RANGES.OOS.endTime,
    });
    expect(result.status).toBe("SETTLEMENT_AMBIGUOUS");
  });

  it("censors DEV using held #24 close, while an invalid bracket is not a fill", () => {
    const signal = makeCandle("BTCUSDT", "1h", BACKTEST_PERIOD_RANGES.DEV.endTime - 10 * HOUR);
    const held = makeHeldCandles(signal.openTime);
    const censored = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: signal.closeTime }),
      signalCandle: signal,
      heldCandles: held,
      funding: [{ symbol: "BTCUSDT", fundingTime: signal.openTime + 2 * HOUR, fundingRate: 0, markPrice: 100 }],
      period: "DEV",
      periodEndTime: BACKTEST_PERIOD_RANGES.DEV.endTime,
    });
    expect(censored.status).toBe("PERIOD_END_CENSORED");

    const outside = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: 10 * HOUR - 1, takeProfitReference: 100.04 }),
      signalCandle: makeCandle("BTCUSDT", "1h", 10 * HOUR),
      heldCandles: makeHeldCandles(10 * HOUR),
      funding: [{ symbol: "BTCUSDT", fundingTime: 12 * HOUR, fundingRate: 0, markPrice: 100 }],
      period: "OOS",
      periodEndTime: BACKTEST_PERIOD_RANGES.OOS.endTime,
    });
    expect(outside.status).toBe("ENTRY_OUTSIDE_BRACKET");
    expect(outside.exitFill).toBeNull();
  });
});

describe("M3 deterministic metrics and report gates", () => {
  it("uses no Infinity/NaN for empty metrics and keeps concentration positive-only", () => {
    const metrics = calculateBacktestMetrics({ evaluations: [], signalResults: [] });
    expect(metrics.executedTrades).toBe(0);
    expect(metrics.profitFactor).toBeNull();
    expect(metrics.profitFactorStatus).toBe("NO_TRADES");
    expect(metrics.executionFillRate).toBeNull();
    expect(metrics.topSymbolShareOfPositiveNetR).toBeNull();
    expect(JSON.stringify(metrics)).not.toContain("Infinity");

    const results = [makeExecutedResult({ netR: 2, grossR: 2 }), makeExecutedResult({ netR: -1, grossR: -1 })];
    const withNegative = calculateBacktestMetrics({ evaluations: [], signalResults: results });
    expect(withNegative.totalPositiveNetR).toBe(2);
    expect(withNegative.topSymbolShareOfPositiveNetR).toBe(1);
    expect(withNegative.largestSingleTradeShareOfPositiveNetR).toBe(1);
  });

  it("applies INCOMPLETE before sample/fail/pass outcomes", () => {
    const incomplete = evaluateBacktestAcceptance({
      period: "OOS",
      runStatus: "INCOMPLETE",
      metrics: calculateBacktestMetrics({ evaluations: [], signalResults: [] }),
    });
    expect(incomplete.status).toBe("INCOMPLETE");
    const insufficient = evaluateBacktestAcceptance({
      period: "OOS",
      metrics: calculateBacktestMetrics({ evaluations: [], signalResults: [] }),
    });
    expect(insufficient.status).toBe("INSUFFICIENT_SAMPLE");
  });

  it("serializes a deterministic report without a wall-clock field", () => {
    const data = Object.fromEntries(
      RESEARCH_SYMBOLS.map((symbol) => [symbol, { candles1h: [], candles4h: [] }]),
    ) as unknown as BacktestData["datasets"];
    const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
    const first = runBacktest({ period: "DEV", data: { datasets: data, funding } });
    const second = runBacktest({ period: "DEV", data: { datasets: data, funding } });
    expect(serializeBacktestReport(first)).toBe(serializeBacktestReport(second));
    expect(serializeBacktestReport(first)).not.toContain("Date.now");
  });

  it("copies the frozen candidate into an auditable versioned snapshot", () => {
    const snapshot = snapshotFromCandidate(
      {
        strategyVersion: "baseline-001",
        symbol: "BTCUSDT",
        direction: "LONG",
        symbolRegime: "LONG_ONLY",
        btcRegime: "BTC_NEUTRAL",
        entryReference: 100,
        stopReference: 95,
        takeProfitReference: 110,
        stopDistance: 5,
        stopAtr: 1,
        breakdown: makeSnapshot().breakdown,
        totalScore: 100,
        grade: "A",
        formalSignal: true,
      },
      123,
    );
    expect(snapshot.strategyVersion).toBe("baseline-001");
    expect(snapshot.backtestPolicyVersion).toBe("bt-policy-001");
    expect(snapshot.signalTime).toBe(123);
  });
});
