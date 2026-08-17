import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import {
  BACKTEST_POLICY,
  buildIntrabarSettlementAudit,
  runBacktest,
  serializeBacktestReport,
  settleBacktestSignal,
  validateIntrabarSettlementManifestCoverage,
  resolveFundingCharges,
} from "../src/lib/backtest/index.ts";
import type {
  BacktestData,
  BacktestSignalSnapshot,
} from "../src/lib/backtest/types.ts";
import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import {
  createIntrabarSettlementManifest,
} from "../src/lib/historical-data/manifest.ts";
import {
  parseBinanceIntrabarKlines,
} from "../src/lib/historical-data/binance/intrabar.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import type { BinancePublicClient } from "../src/lib/market-data/binance/client.ts";
import {
  validateIntrabarSettlementWindow,
} from "../src/lib/historical-data/validation.ts";
import type {
  HistoricalIntrabarSettlementManifest,
  IntrabarSettlementCandle,
} from "../src/lib/historical-data/types.ts";

const HOUR = INTERVAL_MS["1h"];
const MINUTE = 60_000;

function makeCandle(
  symbol: ResearchSymbol,
  timeframe: "1h" | "4h",
  openTime: number,
  overrides: Partial<Candle> = {},
): Candle {
  const interval = INTERVAL_MS[timeframe];
  const open = overrides.open ?? 100;
  const close = overrides.close ?? open;
  return Object.freeze({
    symbol,
    timeframe,
    openTime,
    closeTime: openTime + interval - 1,
    open,
    high: overrides.high ?? Math.max(open, close),
    low: overrides.low ?? Math.min(open, close),
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
    backtestPolicyVersion: "bt-policy-003",
    signalTime: HOUR - 1,
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

function makeHeldCandles(): readonly Candle[] {
  return Object.freeze(
    Array.from({ length: BACKTEST_POLICY.heldCandleCount }, (_, index) =>
      makeCandle("BTCUSDT", "1h", (index + 1) * HOUR, index === 1 ? { high: 110, low: 95 } : {}),
    ),
  );
}

function makeIntrabarWindow(overrides: Readonly<{
  tpMinute?: number;
  slMinute?: number;
  firstOpen?: number;
  lastClose?: number;
  high?: number;
  low?: number;
}> = {}): readonly IntrabarSettlementCandle[] {
  const exitOpen = 2 * HOUR;
  return Object.freeze(
    Array.from({ length: 60 }, (_, index) => {
      const openTime = exitOpen + index * MINUTE;
      const high = index === overrides.tpMinute ? overrides.high ?? 110 : 100;
      const low = index === overrides.slMinute ? overrides.low ?? 95 : 100;
      const open = index === 0 ? overrides.firstOpen ?? 100 : 100;
      const close = index === 59 ? overrides.lastClose ?? 100 : 100;
      return Object.freeze({
        symbol: "BTCUSDT" as const,
        timeframe: "1m" as const,
        openTime,
        closeTime: openTime + MINUTE - 1,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        volume: 1,
        quoteVolume: 100,
        tradeCount: 1,
        takerBuyBaseVolume: 0.5,
        takerBuyQuoteVolume: 50,
      });
    }),
  );
}

function asManifest(window: readonly IntrabarSettlementCandle[], settlementOnly = false): HistoricalIntrabarSettlementManifest {
  return createIntrabarSettlementManifest({
    symbol: "BTCUSDT",
    exitCandleOpenTime: 2 * HOUR,
    range: { startTime: 2 * HOUR, endTime: 3 * HOUR - 1, settlementOnly },
    candles: window,
    retrievedAt: "2026-01-01T00:00:00.000Z",
  });
}

function emptyData(): BacktestData {
  const datasets = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, { candles1h: [], candles4h: [] }]),
  ) as unknown as BacktestData["datasets"];
  const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
  return { datasets, funding, manifests: [] };
}

describe("M3-D.1 intrabar data integrity", () => {
  it("parses exactly the Binance 12-field 1m row shape", () => {
    const parsed = parseBinanceIntrabarKlines(
      [[0, "100", "101", "99", "100", "1", MINUTE - 1, "100", 1, "0.5", "50", "0"]],
      "BTCUSDT",
    );
    expect(parsed[0]).toMatchObject({ timeframe: "1m", openTime: 0, closeTime: MINUTE - 1 });
  });

  it("requires exactly 60 chronological 1m candles", () => {
    const window = makeIntrabarWindow();
    expect(
      validateIntrabarSettlementWindow(window, {
        symbol: "BTCUSDT",
        exitCandleOpenTime: 2 * HOUR,
        exitCandleCloseTime: 3 * HOUR - 1,
        serverTime: 3 * HOUR,
      }),
    ).toHaveLength(60);
    expect(() =>
      validateIntrabarSettlementWindow(window.slice(0, 59), {
        symbol: "BTCUSDT",
        exitCandleOpenTime: 2 * HOUR,
        exitCandleCloseTime: 3 * HOUR - 1,
        serverTime: 3 * HOUR,
      }),
    ).toThrow(/exactly 60/);
  });

  it.each([
    ["gap", (window: readonly IntrabarSettlementCandle[]) => window.map((candle, index) => index === 10 ? { ...candle, openTime: candle.openTime + MINUTE } : candle)],
    ["duplicate", (window: readonly IntrabarSettlementCandle[]) => window.map((candle, index) => index === 10 ? { ...candle, openTime: window[9]!.openTime } : candle)],
    ["future", (window: readonly IntrabarSettlementCandle[]) => window.map((candle, index) => index === 59 ? { ...candle, closeTime: 4 * HOUR } : candle)],
    ["malformed OHLC", (window: readonly IntrabarSettlementCandle[]) => window.map((candle, index) => index === 10 ? { ...candle, high: 90 } : candle)],
  ])("rejects a required %s window without sorting or repair", (_name, mutate) => {
    const changed = mutate(makeIntrabarWindow()) as readonly IntrabarSettlementCandle[];
    expect(() =>
      validateIntrabarSettlementWindow(changed, {
        symbol: "BTCUSDT",
        exitCandleOpenTime: 2 * HOUR,
        exitCandleCloseTime: 3 * HOUR - 1,
        serverTime: 3 * HOUR,
      }),
    ).toThrow();
  });

  it("rejects a closeTime equal to the single study serverTime", () => {
    const window = makeIntrabarWindow();
    expect(() =>
      validateIntrabarSettlementWindow(window, {
        symbol: "BTCUSDT",
        exitCandleOpenTime: 2 * HOUR,
        exitCandleCloseTime: 3 * HOUR - 1,
        serverTime: 3 * HOUR - 1,
      }),
    ).toThrow(/fully closed/);
  });

  it("validates intrabar provenance and exact required boundaries", () => {
    const window = makeIntrabarWindow();
    const manifest = asManifest(window);
    const requirement = [{
      symbol: "BTCUSDT" as const,
      exitCandleOpenTime: 2 * HOUR,
      exitCandleCloseTime: 3 * HOUR - 1,
      settlementOnly: false,
    }];
    expect(validateIntrabarSettlementManifestCoverage([manifest], requirement)).toMatchObject({ valid: true });
    expect(
      validateIntrabarSettlementManifestCoverage([{ ...manifest, sha256: "bad" }], requirement).valid,
    ).toBe(false);
    expect(
      validateIntrabarSettlementManifestCoverage([{ ...manifest, settlementOnly: true }], requirement).valid,
    ).toBe(false);
  });

  it("requests the exact 1m settlement range with the study server time", async () => {
    const calls: unknown[][] = [];
    const rawRows = Array.from({ length: 60 }, (_, index) => {
      const openTime = 2 * HOUR + index * MINUTE;
      return [openTime, "100", "100", "100", "100", "1", openTime + MINUTE - 1, "100", "1", "0.5", "50", "0"];
    });
    const client = {
      getIntrabarKlinesRange: async (...args: unknown[]) => {
        calls.push(args);
        return { data: rawRows, diagnostics: {} };
      },
    } as unknown as BinancePublicClient;
    const loader = new BinanceHistoricalDataLoader({ client, now: () => 0 });
    const window = await loader.loadIntrabarSettlementWindow({
      symbol: "BTCUSDT",
      exitCandleOpenTime: 2 * HOUR,
      settlementOnly: true,
      serverTime: 3 * HOUR,
    });
    expect(calls).toEqual([["BTCUSDT", 2 * HOUR, 3 * HOUR - 1, 60]]);
    expect(window.manifest).toMatchObject({
      kind: "intrabar-settlement",
      source: "/fapi/v1/klines",
      timeframe: "1m",
      rowCount: 60,
      settlementOnly: true,
    });
  });
});

describe("M3-D.1 funding order and frozen reason", () => {
  function resolve(events: number[]) {
    return resolveFundingCharges({
      policy: "bt-policy-003",
      funding: events.map((fundingTime, index) => ({
        symbol: "BTCUSDT" as const,
        fundingTime,
        fundingRate: index === 1 ? -0.001 : 0.001,
        directMarkPrice: 100,
      })),
      entryTime: HOUR,
      exitReason: "SL",
      exitCandle: { openTime: 2 * HOUR, closeTime: 3 * HOUR - 1 },
      exitTime: 2 * HOUR + 40 * MINUTE + MINUTE - 1,
      exitMinute: { openTime: 2 * HOUR + 40 * MINUTE, closeTime: 2 * HOUR + 41 * MINUTE - 1 },
      direction: "LONG",
    });
  }

  it("includes before-minute and exact-minute-open events, excludes after-minute events", () => {
    const resolution = resolve([
      2 * HOUR + 5 * MINUTE,
      2 * HOUR + 40 * MINUTE,
      2 * HOUR + 42 * MINUTE,
    ]);
    expect(resolution.ambiguous).toBe(false);
    expect(resolution.charges).toHaveLength(2);
    expect(resolution.audits?.map((audit) => [audit.included, audit.resolution])).toEqual([
      [true, "ONE_MINUTE_RESOLVED"],
      [true, "ONE_MINUTE_RESOLVED"],
      [false, "ONE_MINUTE_RESOLVED"],
    ]);
  });

  it("applies negative same-minute funding and audits positive funding without credit", () => {
    const resolution = resolve([
      2 * HOUR + 40 * MINUTE + 1,
      2 * HOUR + 40 * MINUTE + 2,
    ]);
    expect(resolution.charges).toHaveLength(1);
    expect(resolution.audits?.map((audit) => [audit.included, audit.resolution])).toEqual([
      [true, "CONSERVATIVE_SAME_MINUTE"],
      [false, "CONSERVATIVE_SAME_MINUTE"],
    ]);
  });

  it("keeps the frozen 1H SL reason when 1m TP occurs first", () => {
    const signal = makeCandle("BTCUSDT", "1h", 0);
    const result = settleBacktestSignal({
      snapshot: makeSnapshot(),
      signalCandle: signal,
      heldCandles: makeHeldCandles(),
      funding: [{ symbol: "BTCUSDT", fundingTime: HOUR + 1, fundingRate: 0, directMarkPrice: 100 }],
      intrabarSettlementWindow: {
        symbol: "BTCUSDT",
        exitCandleOpenTime: 2 * HOUR,
        settlementOnly: false,
        candles: makeIntrabarWindow({ tpMinute: 10, slMinute: 40 }),
        manifest: asManifest(makeIntrabarWindow({ tpMinute: 10, slMinute: 40 })),
      },
      serverTime: 3 * HOUR,
      policy: "bt-policy-003",
      period: "DEV",
      periodEndTime: Number.MAX_SAFE_INTEGER,
    });
    expect(result).toMatchObject({ status: "EXECUTED", exitReason: "SL", exitTime: 2 * HOUR + 41 * MINUTE - 1 });
    expect(result.rawExitPrice).toBe(95);
  });

  it("fails closed when the frozen reason is not reproduced by 1m data", () => {
    const window = makeIntrabarWindow({ tpMinute: 10 });
    const result = settleBacktestSignal({
      snapshot: makeSnapshot(),
      signalCandle: makeCandle("BTCUSDT", "1h", 0),
      heldCandles: makeHeldCandles(),
      funding: [{ symbol: "BTCUSDT", fundingTime: HOUR + 1, fundingRate: 0, directMarkPrice: 100 }],
      intrabarSettlementWindow: {
        symbol: "BTCUSDT",
        exitCandleOpenTime: 2 * HOUR,
        settlementOnly: false,
        candles: window,
        manifest: asManifest(window),
      },
      serverTime: 3 * HOUR,
      policy: "bt-policy-003",
      period: "DEV",
      periodEndTime: Number.MAX_SAFE_INTEGER,
    });
    expect(result.status).toBe("DATA_INCOMPLETE");
  });

  it("does not load or require 1m data for TIME_EXIT", () => {
    const held = Object.freeze(Array.from({ length: 24 }, (_, index) => makeCandle("BTCUSDT", "1h", (index + 1) * HOUR)));
    const result = settleBacktestSignal({
      snapshot: makeSnapshot(),
      signalCandle: makeCandle("BTCUSDT", "1h", 0),
      heldCandles: held,
      funding: [{ symbol: "BTCUSDT", fundingTime: HOUR + 1, fundingRate: 0, directMarkPrice: 100 }],
      serverTime: 30 * HOUR,
      policy: "bt-policy-003",
      period: "DEV",
      periodEndTime: Number.MAX_SAFE_INTEGER,
    });
    expect(result).toMatchObject({ status: "EXECUTED", exitReason: "TIME_EXIT" });
    expect(result.fundingOrderAudits?.[0]?.resolution).toBe("ONE_HOUR_UNAMBIGUOUS");
  });
});

describe("M3-D.1 policy-003 schema and audit", () => {
  it("keeps 001/002 report schemas isolated from 003 fields", () => {
    const legacy = runBacktest({ period: "DEV", policy: "bt-policy-001", data: emptyData() });
    const compatibility = runBacktest({ period: "DEV", policy: "bt-policy-002", data: emptyData() });
    const intrabar = runBacktest({ period: "DEV", policy: "bt-policy-003", data: emptyData() });
    expect(legacy.schemaVersion).toBe("m3-b-report-001");
    expect(compatibility.schemaVersion).toBe("m3-b-report-002");
    expect(intrabar.schemaVersion).toBe("m3-b-report-003");
    expect(legacy).not.toHaveProperty("intrabarSettlementWindowsLoaded");
    expect(compatibility).not.toHaveProperty("intrabarSettlementWindowsLoaded");
    expect(intrabar).toHaveProperty("remainingSettlementAmbiguousCount", 0);
    expect(intrabar).toHaveProperty("fundingFallbackRate");
    expect(serializeBacktestReport(legacy)).not.toContain("intrabarSettlement");
    expect(serializeBacktestReport(compatibility)).not.toContain("intrabarSettlement");
  });

  it("counts loaded windows and both included and excluded same-minute audits", () => {
    const audit = buildIntrabarSettlementAudit(
      [
        {
          snapshot: makeSnapshot(),
          status: "EXECUTED",
          entryTime: HOUR,
          rawEntryPrice: 100,
          entryFill: 100,
          exitTime: 3 * HOUR,
          rawExitPrice: 95,
          exitFill: 95,
          heldCandleNumber: 2,
          exitReason: "SL",
          fundingCharges: [],
          fundingOrderAudits: [
            {
              symbol: "BTCUSDT",
              fundingTime: 2 * HOUR + 1,
              fundingRate: -0.001,
              theoreticalFundingPnL: -0.1,
              included: true,
              resolution: "CONSERVATIVE_SAME_MINUTE",
              exitCandleOpenTime: 2 * HOUR,
              exitCandleCloseTime: 3 * HOUR - 1,
              markPrice: 100,
              markPriceSource: "FUNDING_RATE_HISTORY",
            },
            {
              symbol: "BTCUSDT",
              fundingTime: 2 * HOUR + 2,
              fundingRate: 0.001,
              theoreticalFundingPnL: 0.1,
              included: false,
              resolution: "CONSERVATIVE_SAME_MINUTE",
              exitCandleOpenTime: 2 * HOUR,
              exitCandleCloseTime: 3 * HOUR - 1,
              markPrice: 100,
              markPriceSource: "FUNDING_RATE_HISTORY",
            },
          ],
          fundingPnL: 0,
          priceR: 0,
          feeR: 0,
          fundingR: 0,
          grossR: 0,
          netR: 0,
        },
      ],
      [{ symbol: "BTCUSDT", exitCandleOpenTime: 2 * HOUR, settlementOnly: false, candles: [], manifest: asManifest(makeIntrabarWindow()) }],
    );
    expect(audit).toMatchObject({
      intrabarSettlementWindowsLoaded: 1,
      conservativeSameMinuteCount: 2,
      intrabarResolvedFundingOrderCount: 0,
    });
  });
});
