import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import {
  BACKTEST_PERIOD_RANGES,
  BACKTEST_POLICY,
  evaluateBacktestAcceptance,
  evaluateOverallBacktestAcceptance,
  latestAsOfWindow,
  buildStrategyInput,
  buildStrategyInputFromIndexes,
  buildHistoricalIndexes,
  buildHistoricalLoadRanges,
  evaluationTimesForPeriod,
  validateRequiredManifestCoverage,
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
import type { HistoricalManifest } from "../src/lib/historical-data/types.ts";

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

type ExecutedResultOverrides = Omit<Partial<BacktestSignalResult>, "snapshot"> & {
  snapshot?: Partial<BacktestSignalSnapshot>;
};

function makeExecutedResult(overrides: ExecutedResultOverrides = {}): BacktestSignalResult {
  const { snapshot: snapshotOverrides, ...resultOverrides } = overrides;
  const snapshot = makeSnapshot(snapshotOverrides);
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
    ...resultOverrides,
  });
}

function makeTestManifest(
  symbol: ResearchSymbol,
  kind: "candles" | "funding",
  timeframe: "1h" | "4h" | "funding",
  settlementOnly: boolean,
  requestedStartTime = 0,
  requestedEndTime = 1,
): HistoricalManifest {
  const common = {
    provider: "binance-usdm-public" as const,
    symbol,
    requestedStartTime,
    requestedEndTime,
    actualStartTime: requestedStartTime,
    actualEndTime: requestedEndTime,
    rowCount: 1,
    retrievedAt: "2026-01-01T00:00:00.000Z",
    sha256: "a".repeat(64),
    settlementOnly,
  };
  if (kind === "candles") {
    return {
      ...common,
      kind: "candles",
      source: "/fapi/v1/klines",
      timeframe: timeframe as "1h" | "4h",
    } as HistoricalManifest;
  }
  return {
    ...common,
    kind: "funding",
    source: "/fapi/v1/fundingRate",
    markPriceField: "markPrice" as const,
  } as HistoricalManifest;
}

function requiredTestManifests(period: "DEV" | "OOS" | "COMBINED"): readonly HistoricalManifest[] {
  const baseEnd = period === "DEV" ? BACKTEST_PERIOD_RANGES.DEV.endTime : BACKTEST_PERIOD_RANGES.OOS.endTime;
  return RESEARCH_SYMBOLS.flatMap((symbol) => [
    makeTestManifest(symbol, "candles", "1h", false),
    makeTestManifest(symbol, "candles", "4h", false),
    makeTestManifest(symbol, "funding", "funding", false, 0, baseEnd),
    ...(period === "DEV"
      ? []
      : [
          makeTestManifest(
            symbol,
            "candles",
            "1h",
            true,
            BACKTEST_PERIOD_RANGES.OOS.endTime + 1,
            Math.floor(BACKTEST_PERIOD_RANGES.OOS.endTime / HOUR) * HOUR + BACKTEST_POLICY.heldCandleCount * HOUR,
          ),
          makeTestManifest(
            symbol,
            "funding",
            "funding",
            true,
            BACKTEST_PERIOD_RANGES.OOS.endTime + 1,
            BACKTEST_PERIOD_RANGES.OOS.endTime + BACKTEST_POLICY.heldCandleCount * HOUR,
          ),
        ]),
  ]);
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
      serverTime: 4 * HOUR,
    });
    expect(dataset.candles).toHaveLength(4);
    expect(calls.map((call) => Number(call.searchParams.get("startTime")))).toEqual([0, 2 * HOUR]);
    expect(dataset.manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(dataset.manifest.retrievedAt).toBe("1970-01-01T00:00:00.123Z");
  });

  it("paginates funding across a page boundary and rejects duplicate or out-of-order pages", async () => {
    const row = (fundingTime: number) => ({
      symbol: "BTCUSDT",
      fundingTime,
      fundingRate: "0.001",
      markPrice: "100",
    });
    const calls: number[] = [];
    const loader = new BinanceHistoricalDataLoader({
      clientOptions: {
        fetchImpl: async (input) => {
          const url = new URL(input.toString());
          const startTime = Number(url.searchParams.get("startTime"));
          calls.push(startTime);
          const page = startTime === 0 ? [row(0), row(1)] : [row(2)];
          return new Response(JSON.stringify(page), { status: 200 });
        },
      },
      fundingLimit: 2,
    });
    const dataset = await loader.loadFunding({ symbol: "BTCUSDT", range: { startTime: 0, endTime: 2 } });
    expect(calls).toEqual([0, 2]);
    expect(dataset.records.map((record) => record.fundingTime)).toEqual([0, 1, 2]);

    const duplicateLoader = new BinanceHistoricalDataLoader({
      clientOptions: {
        fetchImpl: async (input) => {
          const startTime = Number(new URL(input.toString()).searchParams.get("startTime"));
          return new Response(JSON.stringify(startTime === 0 ? [row(0), row(1)] : [row(1), row(2)]), { status: 200 });
        },
      },
      fundingLimit: 2,
    });
    await expect(duplicateLoader.loadFunding({ symbol: "BTCUSDT", range: { startTime: 0, endTime: 2 } })).rejects.toMatchObject({
      code: "INVALID_FUNDING",
    });

    const outOfOrderLoader = new BinanceHistoricalDataLoader({
      clientOptions: {
        fetchImpl: async () => new Response(JSON.stringify([row(1), row(0)]), { status: 200 }),
      },
      fundingLimit: 2,
    });
    await expect(outOfOrderLoader.loadFunding({ symbol: "BTCUSDT", range: { startTime: 0, endTime: 1 } })).rejects.toMatchObject({
      code: "OUT_OF_ORDER_CANDLES",
    });
  });

  it("requires official positive markPrice and makes no candle-price fallback", async () => {
    const invalidRows = [
      { symbol: "BTCUSDT", fundingTime: 0, fundingRate: "0.001" },
      { symbol: "BTCUSDT", fundingTime: 0, fundingRate: "0.001", markPrice: "0" },
    ];
    for (const row of invalidRows) {
      const loader = new BinanceHistoricalDataLoader({
        clientOptions: { fetchImpl: async () => new Response(JSON.stringify([row]), { status: 200 }) },
      });
      await expect(loader.loadFunding({ symbol: "BTCUSDT", range: { startTime: 0, endTime: 0 } })).rejects.toBeInstanceOf(
        HistoricalDataError,
      );
    }
  });

  it("fetches Binance server time once for a study load and passes it to all candle validation", async () => {
    let serverTimeCalls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input.toString());
      if (url.pathname === "/fapi/v1/time") {
        serverTimeCalls += 1;
        return new Response(JSON.stringify({ serverTime: 1_000_000_000 }), { status: 200 });
      }
      const symbol = url.searchParams.get("symbol") as ResearchSymbol;
      if (url.pathname === "/fapi/v1/klines") {
        const timeframe = url.searchParams.get("interval") as MarketTimeframe;
        const interval = INTERVAL_MS[timeframe];
        const openTime = Number(url.searchParams.get("startTime"));
        return new Response(JSON.stringify([[openTime, "100", "100", "100", "100", "10", openTime + interval - 1, "1000", "10", "5", "500", "0"]]), { status: 200 });
      }
      return new Response(JSON.stringify([{ symbol, fundingTime: 0, fundingRate: "0", markPrice: "100" }]), { status: 200 });
    };
    const loader = new BinanceHistoricalDataLoader({ clientOptions: { fetchImpl } });
    const study = await loader.loadStudyData({
      candleRange: {
        "1h": { startTime: 0, endTime: 0 },
        "4h": { startTime: 0, endTime: 0 },
      },
      fundingRange: { startTime: 0, endTime: 0 },
    });
    expect(serverTimeCalls).toBe(1);
    expect(study.serverTime).toBe(1_000_000_000);
  });

  it("accepts only candles fully closed before the authoritative Binance server time", () => {
    const candle = makeCandle("BTCUSDT", "1h", 0);
    expect(() =>
      validateHistoricalCandleSeries([candle], {
        symbol: "BTCUSDT",
        timeframe: "1h",
        serverTime: candle.closeTime + 1,
      }),
    ).not.toThrow();
    expect(() =>
      validateHistoricalCandleSeries([candle], {
        symbol: "BTCUSDT",
        timeframe: "1h",
        serverTime: candle.closeTime,
      }),
    ).toThrowError(HistoricalDataError);
    expect(() =>
      validateHistoricalCandleSeries([candle], {
        symbol: "BTCUSDT",
        timeframe: "1h",
        serverTime: candle.closeTime - 1,
      }),
    ).toThrowError(HistoricalDataError);
  });

  it("fails a forming settlement-tail candle before any partial High/Low can be used", async () => {
    const raw = (openTime: number) => [openTime, "100", "111", "94", "100", "10", openTime + HOUR - 1, "1000", "10", "5", "500", "0"];
    const tailEnd = buildHistoricalLoadRanges("OOS").settlementTail!.candleRange.endTime;
    const loader = new BinanceHistoricalDataLoader({
      clientOptions: {
        fetchImpl: async () => new Response(JSON.stringify([raw(tailEnd)]), { status: 200 }),
      },
    });
    await expect(
      loader.loadCandles({
        symbol: "BTCUSDT",
        timeframe: "1h",
        range: { startTime: tailEnd, endTime: tailEnd, settlementOnly: true },
        serverTime: tailEnd + HOUR - 1,
      }),
    ).rejects.toMatchObject({ code: "DATA_INCOMPLETE" });
  });
});

function firstEvaluationDatasets(period: "DEV" | "OOS"): BacktestData["datasets"] {
  const ranges = buildHistoricalLoadRanges(period);
  const periodStart = BACKTEST_PERIOD_RANGES[period].startTime;
  const oneHourStart = ranges.candleRange["1h"].startTime;
  const fourHourStart = ranges.candleRange["4h"].startTime;
  const oneHourCount = Math.floor((periodStart - oneHourStart) / HOUR) + 1;
  const datasets = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [
      symbol,
      {
        candles1h: Array.from({ length: oneHourCount }, (_, index) => makeCandle(symbol, "1h", oneHourStart + index * HOUR)),
        // The last 4H candle closes one millisecond before the first 1H evaluation.
        candles4h: Array.from({ length: BACKTEST_POLICY.strategyWindowCandles }, (_, index) =>
          makeCandle(symbol, "4h", fourHourStart + index * INTERVAL_MS["4h"]),
        ),
      },
    ]),
  );
  return datasets as unknown as BacktestData["datasets"];
}

describe("M3 historical load ranges and exact first evaluation", () => {
  it("uses 250-candle historical lookback rather than the 205 indicator minimum", () => {
    for (const period of ["DEV", "OOS"] as const) {
      const ranges = buildHistoricalLoadRanges(period);
      const periodStart = BACKTEST_PERIOD_RANGES[period].startTime;
      expect(ranges.candleRange["4h"].startTime).toBe(
        periodStart - BACKTEST_POLICY.strategyWindowCandles * INTERVAL_MS["4h"],
      );
      const firstEvaluationTime = periodStart + HOUR - 1;
      const datasets = firstEvaluationDatasets(period);
      const indexes = buildHistoricalIndexes(datasets);
      const input = buildStrategyInput(datasets, firstEvaluationTime);
      const indexedInput = buildStrategyInputFromIndexes(indexes, firstEvaluationTime);
      expect(evaluationTimesForPeriod(indexes, period)).toEqual([firstEvaluationTime]);
      for (const symbol of RESEARCH_SYMBOLS) {
        expect(input.datasets[symbol]?.candles4h).toHaveLength(BACKTEST_POLICY.strategyWindowCandles);
        expect(input.datasets[symbol]?.candles4h.at(-1)?.closeTime).toBe(firstEvaluationTime - HOUR);
        expect(indexedInput.datasets[symbol]?.candles4h).toEqual(input.datasets[symbol]?.candles4h);
      }
    }
  });

  it("covers the exact period end and makes the OOS funding tail contiguous", () => {
    const devRanges = buildHistoricalLoadRanges("DEV");
    const oosRanges = buildHistoricalLoadRanges("OOS");
    expect(devRanges.fundingRange.endTime).toBe(BACKTEST_PERIOD_RANGES.DEV.endTime);
    expect(oosRanges.fundingRange.endTime).toBe(BACKTEST_PERIOD_RANGES.OOS.endTime);
    expect(oosRanges.settlementTail?.fundingRange.startTime).toBe(BACKTEST_PERIOD_RANGES.OOS.endTime + 1);
    expect(oosRanges.settlementTail?.fundingRange.startTime).toBe(oosRanges.fundingRange.endTime + 1);

    const finalHourOpen = oosRanges.candleRange["1h"].endTime;
    expect(finalHourOpen + 1).toBeLessThanOrEqual(oosRanges.fundingRange.endTime);
    expect(oosRanges.settlementTail?.fundingRange.endTime).toBe(
      BACKTEST_PERIOD_RANGES.OOS.endTime + BACKTEST_POLICY.heldCandleCount * HOUR,
    );
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
    const indexes = buildHistoricalIndexes(datasets);
    const input = buildStrategyInputFromIndexes(indexes, evaluationTime);
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

  it("uses strict funding boundaries for entry, TP/SL candle open, and TIME_EXIT", () => {
    const signal = makeCandle("BTCUSDT", "1h", 10 * HOUR);
    const held = makeHeldCandles(signal.openTime);
    const entryBoundary = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: signal.closeTime }),
      signalCandle: signal,
      heldCandles: held,
      funding: [{ symbol: "BTCUSDT", fundingTime: held[0]!.openTime, fundingRate: 0.001, markPrice: 100 }],
      period: "OOS",
      periodEndTime: BACKTEST_PERIOD_RANGES.OOS.endTime,
    });
    expect(entryBoundary.status).toBe("EXECUTED");
    expect(entryBoundary.fundingCharges).toHaveLength(0);

    const tpHeld = Object.freeze(
      held.map((candle, index) =>
        index === 1
          ? makeCandle("BTCUSDT", "1h", candle.openTime, { open: candle.open, close: candle.close, high: 111 })
          : candle,
      ),
    );
    const exitOpen = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: signal.closeTime }),
      signalCandle: signal,
      heldCandles: tpHeld,
      funding: [
        { symbol: "BTCUSDT", fundingTime: held[0]!.openTime, fundingRate: 0.001, markPrice: 100 },
        { symbol: "BTCUSDT", fundingTime: held[1]!.openTime, fundingRate: 0.001, markPrice: 100 },
      ],
      period: "OOS",
      periodEndTime: BACKTEST_PERIOD_RANGES.OOS.endTime,
    });
    expect(exitOpen.exitReason).toBe("TP");
    expect(exitOpen.fundingCharges).toHaveLength(1);
    expect(exitOpen.fundingCharges[0]?.fundingTime).toBe(held[1]!.openTime);

    const ambiguous = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: signal.closeTime }),
      signalCandle: signal,
      heldCandles: tpHeld,
      funding: [{ symbol: "BTCUSDT", fundingTime: held[1]!.openTime + 1, fundingRate: 0.001, markPrice: 100 }],
      period: "OOS",
      periodEndTime: BACKTEST_PERIOD_RANGES.OOS.endTime,
    });
    expect(ambiguous.status).toBe("SETTLEMENT_AMBIGUOUS");

    const timeExit = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: signal.closeTime }),
      signalCandle: signal,
      heldCandles: held,
      funding: [{ symbol: "BTCUSDT", fundingTime: held[23]!.closeTime, fundingRate: 0.001, markPrice: 100 }],
      period: "OOS",
      periodEndTime: BACKTEST_PERIOD_RANGES.OOS.endTime,
    });
    expect(timeExit.status).toBe("EXECUTED");
    expect(timeExit.fundingCharges).toHaveLength(1);
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

  it("executes a DEV signal when held #24 closes exactly at the frozen DEV end", () => {
    const signalOpen = BACKTEST_PERIOD_RANGES.DEV.endTime - (BACKTEST_POLICY.heldCandleCount + 1) * HOUR + 1;
    const signal = makeCandle("BTCUSDT", "1h", signalOpen);
    const result = settleBacktestSignal({
      snapshot: makeSnapshot({ signalTime: signal.closeTime }),
      signalCandle: signal,
      heldCandles: makeHeldCandles(signal.openTime),
      funding: [{ symbol: "BTCUSDT", fundingTime: signal.openTime + HOUR, fundingRate: 0, markPrice: 100 }],
      period: "DEV",
      periodEndTime: BACKTEST_PERIOD_RANGES.DEV.endTime,
    });
    expect(result.status).toBe("EXECUTED");
    expect(result.exitReason).toBe("TIME_EXIT");
    expect(result.exitTime).toBe(BACKTEST_PERIOD_RANGES.DEV.endTime);
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

  it("enforces exact PF boundaries and the concentration boundaries", () => {
    const makeTrades = (count: number, winR: number): readonly BacktestSignalResult[] =>
      Array.from({ length: count }, (_, index) =>
        makeExecutedResult({
          snapshot: {
            signalTime: (index + 1) * HOUR,
            symbol: RESEARCH_SYMBOLS[index % RESEARCH_SYMBOLS.length]!,
          },
          netR: index < count / 2 ? winR : -1,
          grossR: index < count / 2 ? winR : -1,
        }),
      );
    const combinedAtBoundary = calculateBacktestMetrics({
      evaluations: [],
      signalResults: makeTrades(100, 1.25),
    });
    expect(evaluateBacktestAcceptance({ period: "COMBINED", metrics: combinedAtBoundary }).status).toBe("PASS");
    const combinedBelowBoundary = calculateBacktestMetrics({
      evaluations: [],
      signalResults: makeTrades(100, 1.249),
    });
    expect(evaluateBacktestAcceptance({ period: "COMBINED", metrics: combinedBelowBoundary }).status).toBe("FAIL");

    const oosAtBoundary = calculateBacktestMetrics({ evaluations: [], signalResults: makeTrades(30, 1.1) });
    expect(evaluateBacktestAcceptance({ period: "OOS", metrics: oosAtBoundary }).status).toBe("PASS");
    expect(
      evaluateBacktestAcceptance({
        period: "COMBINED",
        metrics: { ...combinedAtBoundary, topSymbolShareOfPositiveNetR: 0.6, largestSingleTradeShareOfPositiveNetR: 0.2 },
      }).status,
    ).toBe("PASS");
    expect(
      evaluateBacktestAcceptance({
        period: "COMBINED",
        metrics: { ...combinedAtBoundary, topSymbolShareOfPositiveNetR: 0.6001 },
      }).status,
    ).toBe("FAIL");
  });

  it("requires both COMBINED and OOS for the formal overall decision", () => {
    const pass = Object.freeze({ status: "PASS" as const, reasons: Object.freeze([]), checks: Object.freeze({}) });
    const fail = Object.freeze({ status: "FAIL" as const, reasons: Object.freeze(["OOS failed"]), checks: Object.freeze({}) });
    const incomplete = Object.freeze({ status: "INCOMPLETE" as const, reasons: Object.freeze(["missing data"]), checks: Object.freeze({}) });
    expect(
      evaluateOverallBacktestAcceptance({
        period: "COMBINED",
        acceptanceByPeriod: { DEV: null, COMBINED: pass, OOS: fail },
      }).status,
    ).toBe("FAIL");
    expect(
      evaluateOverallBacktestAcceptance({
        period: "COMBINED",
        acceptanceByPeriod: { DEV: null, COMBINED: pass, OOS: incomplete },
      }).status,
    ).toBe("INCOMPLETE");
  });

  it("fails closed when required manifests are absent and validates deterministic checksums", () => {
    expect(validateRequiredManifestCoverage([], "COMBINED").valid).toBe(false);
    const manifests = requiredTestManifests("COMBINED");
    expect(validateRequiredManifestCoverage(manifests, "COMBINED")).toMatchObject({ valid: true, diagnostics: [] });
    expect(validateRequiredManifestCoverage(manifests.slice(0, -1), "COMBINED").valid).toBe(false);
    expect(manifests.every((manifest) => /^[a-f0-9]{64}$/.test(manifest.sha256))).toBe(true);
  });

  it("serializes a deterministic report without a wall-clock field", () => {
    const data = Object.fromEntries(
      RESEARCH_SYMBOLS.map((symbol) => [symbol, { candles1h: [], candles4h: [] }]),
    ) as unknown as BacktestData["datasets"];
    const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
    const first = runBacktest({ period: "DEV", data: { datasets: data, funding, manifests: [] } });
    const second = runBacktest({ period: "DEV", data: { datasets: data, funding, manifests: [] } });
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
