import { describe, expect, it, vi } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "@/lib/config/constants";
import {
  BinanceMarketDataProvider,
  BinancePublicClient,
  INTERVAL_MS,
  MarketDataError,
  buildClosedCandleDataset,
  parseBinanceKlines,
  REQUIRED_CLOSED_CANDLES,
  type MarketTimeframe,
} from "@/lib/market-data";

const SERVER_TIME = Date.UTC(2026, 7, 16, 12, 0, 0);

function makeRawKline(
  openTime: number,
  intervalMs: number,
  index: number,
  overrides: { closeTime?: number; volume?: string | number; high?: string | number } = {},
): unknown[] {
  const open = 100 + index;
  return [
    openTime,
    open.toString(),
    overrides.high ?? (open + 2).toString(),
    (open - 1).toString(),
    (open + 1).toString(),
    overrides.volume ?? "10.5",
    overrides.closeTime ?? openTime + intervalMs - 1,
    "1050.5",
    100 + index,
    "5.25",
    "525.25",
    "0",
  ];
}

function makeRawKlines(
  timeframe: MarketTimeframe,
  count: number,
  serverTime = SERVER_TIME,
  finalOpenTime = Math.floor(serverTime / INTERVAL_MS[timeframe]) * INTERVAL_MS[timeframe] - INTERVAL_MS[timeframe],
): unknown[][] {
  const intervalMs = INTERVAL_MS[timeframe];
  const firstOpenTime = finalOpenTime - (count - 1) * intervalMs;
  return Array.from({ length: count }, (_, index) =>
    makeRawKline(firstOpenTime + index * intervalMs, intervalMs, index),
  );
}

function expectMarketDataError(action: () => unknown, code: MarketDataError["code"]): void {
  try {
    action();
    throw new Error(`Expected ${code} to be thrown.`);
  } catch (error) {
    expect(error).toBeInstanceOf(MarketDataError);
    expect((error as MarketDataError).code).toBe(code);
  }
}

function makeExchangeInfo(unavailable?: ResearchSymbol): Record<string, unknown> {
  return {
    symbols: RESEARCH_SYMBOLS.map((symbol) => ({
      symbol,
      status: symbol === unavailable ? "BREAK" : "TRADING",
      contractType: "PERPETUAL",
      baseAsset: symbol.replace("USDT", ""),
      quoteAsset: "USDT",
      marginAsset: "USDT",
    })),
  };
}

describe("M1 candle normalization and validation", () => {
  it("keeps only the approved 1h and 4h interval definitions", () => {
    expect(INTERVAL_MS).toEqual({ "1h": 3_600_000, "4h": 14_400_000 });
  });

  it("normalizes Binance's twelve-field kline tuple into a Candle", () => {
    const candles = parseBinanceKlines(makeRawKlines("1h", 1), "BTCUSDT", "1h");

    expect(candles[0]).toEqual({
      symbol: "BTCUSDT",
      timeframe: "1h",
      openTime: SERVER_TIME - INTERVAL_MS["1h"],
      closeTime: SERVER_TIME - 1,
      open: 100,
      high: 102,
      low: 99,
      close: 101,
      volume: 10.5,
      quoteVolume: 1050.5,
      tradeCount: 100,
      takerBuyBaseVolume: 5.25,
      takerBuyQuoteVolume: 525.25,
    });
  });

  it("filters a forming candle and returns exactly the latest 250 closed candles", () => {
    const intervalMs = INTERVAL_MS["1h"];
    const expectedLatestOpenTime = SERVER_TIME - intervalMs;
    const closedRows = makeRawKlines("1h", REQUIRED_CLOSED_CANDLES);
    const formingRow = makeRawKline(
      expectedLatestOpenTime + intervalMs,
      intervalMs,
      REQUIRED_CLOSED_CANDLES,
      { closeTime: SERVER_TIME + 1_000 },
    );
    const candles = parseBinanceKlines([...closedRows, formingRow], "BTCUSDT", "1h");
    const dataset = buildClosedCandleDataset({
      symbol: "BTCUSDT",
      timeframe: "1h",
      candles,
      serverTime: SERVER_TIME,
    });

    expect(dataset.candles).toHaveLength(REQUIRED_CLOSED_CANDLES);
    expect(dataset.candles.at(-1)?.openTime).toBe(expectedLatestOpenTime);
    expect(dataset.candles.every((candle) => candle.closeTime < SERVER_TIME)).toBe(true);
  });

  it.each([
    ["duplicate", "DUPLICATE_CANDLE"],
    ["out of order", "OUT_OF_ORDER_CANDLES"],
    ["gap", "CANDLE_GAP"],
  ] as const)("rejects %s candle sequences", (kind, code) => {
    const rows = makeRawKlines("1h", 251);
    if (kind === "duplicate") {
      rows[100] = rows[99];
    }
    if (kind === "out of order") {
      [rows[100], rows[101]] = [rows[101], rows[100]];
    }
    if (kind === "gap") {
      rows.splice(100, 1);
    }

    const candles = parseBinanceKlines(rows, "BTCUSDT", "1h");
    expectMarketDataError(
      () =>
        buildClosedCandleDataset({
          symbol: "BTCUSDT",
          timeframe: "1h",
          candles,
          serverTime: SERVER_TIME,
        }),
      code,
    );
  });

  it("rejects malformed numbers, negative volume, and invalid OHLC relationships", () => {
    const malformed = makeRawKlines("1h", 251);
    malformed[0][1] = "NaN";
    expectMarketDataError(
      () => parseBinanceKlines(malformed, "BTCUSDT", "1h"),
      "INVALID_NUMBER",
    );

    const negativeVolume = parseBinanceKlines(
      makeRawKlines("1h", 251).map((row, index) =>
        index === 0 ? makeRawKline(row[0] as number, INTERVAL_MS["1h"], 0, { volume: -1 }) : row,
      ),
      "BTCUSDT",
      "1h",
    );
    expectMarketDataError(
      () =>
        buildClosedCandleDataset({
          symbol: "BTCUSDT",
          timeframe: "1h",
          candles: negativeVolume,
          serverTime: SERVER_TIME,
        }),
      "INVALID_NUMBER",
    );

    const invalidOhlc = parseBinanceKlines(
      makeRawKlines("1h", 251).map((row, index) =>
        index === 0
          ? makeRawKline(row[0] as number, INTERVAL_MS["1h"], 0, { high: 50 })
          : row,
      ),
      "BTCUSDT",
      "1h",
    );
    expectMarketDataError(
      () =>
        buildClosedCandleDataset({
          symbol: "BTCUSDT",
          timeframe: "1h",
          candles: invalidOhlc,
          serverTime: SERVER_TIME,
        }),
      "INVALID_OHLC",
    );
  });

  it("rejects insufficient history and stale closed data", () => {
    const shortHistory = parseBinanceKlines(makeRawKlines("4h", 249), "ETHUSDT", "4h");
    expectMarketDataError(
      () =>
        buildClosedCandleDataset({
          symbol: "ETHUSDT",
          timeframe: "4h",
          candles: shortHistory,
          serverTime: SERVER_TIME,
        }),
      "INSUFFICIENT_HISTORY",
    );

    const staleFinalOpenTime = SERVER_TIME - 2 * INTERVAL_MS["4h"];
    const stale = parseBinanceKlines(
      makeRawKlines("4h", 251, SERVER_TIME, staleFinalOpenTime),
      "ETHUSDT",
      "4h",
    );
    expectMarketDataError(
      () =>
        buildClosedCandleDataset({
          symbol: "ETHUSDT",
          timeframe: "4h",
          candles: stale,
          serverTime: SERVER_TIME,
        }),
      "STALE_DATA",
    );
  });
});

describe("M1 Binance public client", () => {
  it("uses the documented public kline parameters and calculates server-time diagnostics", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ serverTime: SERVER_TIME }), {
        status: 200,
        headers: { "x-mbx-used-weight-1m": "3" },
      });
    });
    const clock = [1_000, 1_120];
    const client = new BinancePublicClient({
      fetchImpl,
      now: () => clock.shift() ?? 1_120,
      sleep: async () => undefined,
    });

    const serverTime = await client.getServerTime();
    const klineResponse = await client.getKlines("BTCUSDT", "4h");

    expect(serverTime.data.serverTime).toBe(SERVER_TIME);
    expect(serverTime.diagnostics.estimatedClockOffsetMs).toBe(SERVER_TIME - 1_060);
    expect(serverTime.diagnostics.requestWeight).toBe("3");
    expect(klineResponse.diagnostics.requestWeight).toBe("3");
    expect(new URL(requestedUrls[1]).pathname).toBe("/fapi/v1/klines");
    expect(new URL(requestedUrls[1]).searchParams.get("symbol")).toBe("BTCUSDT");
    expect(new URL(requestedUrls[1]).searchParams.get("interval")).toBe("4h");
    expect(new URL(requestedUrls[1]).searchParams.get("limit")).toBe("251");
  });

  it("retries 429 and 5xx only with bounded backoff and does not retry ordinary 4xx", async () => {
    const sleep = vi.fn(async () => undefined);
    const rateLimitedFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0.2" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ serverTime: SERVER_TIME }), { status: 200 }));
    const rateLimitedClient = new BinancePublicClient({
      fetchImpl: rateLimitedFetch,
      sleep,
      random: () => 0,
    });

    await rateLimitedClient.getServerTime();
    expect(rateLimitedFetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(200);

    const upstreamFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ serverTime: SERVER_TIME }), { status: 200 }));
    const upstreamClient = new BinancePublicClient({
      fetchImpl: upstreamFetch,
      sleep,
      random: () => 0,
    });
    await upstreamClient.getServerTime();
    expect(upstreamFetch).toHaveBeenCalledTimes(3);

    const ordinaryClient = new BinancePublicClient({
      fetchImpl: vi.fn().mockResolvedValue(new Response("", { status: 400 })),
      sleep,
    });
    await expect(ordinaryClient.getServerTime()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      retryable: false,
    });
  });

  it("classifies an aborted request as a bounded timeout", async () => {
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );
    const client = new BinancePublicClient({
      fetchImpl,
      timeoutMs: 5,
      sleep: async () => undefined,
    });

    await expect(client.getServerTime()).rejects.toMatchObject({
      code: "HTTP_TIMEOUT",
      retryable: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("M1 Binance provider contract", () => {
  it("builds a valid five-symbol, two-timeframe snapshot without leaking raw tuples", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/fapi/v1/time") {
        return new Response(JSON.stringify({ serverTime: SERVER_TIME }), { status: 200 });
      }
      if (url.pathname === "/fapi/v1/exchangeInfo") {
        return new Response(JSON.stringify(makeExchangeInfo()), { status: 200 });
      }
      if (url.pathname === "/fapi/v1/klines") {
        const timeframe = url.searchParams.get("interval") as MarketTimeframe;
        return new Response(JSON.stringify(makeRawKlines(timeframe, 251)), { status: 200 });
      }
      return new Response("", { status: 404 });
    });
    const provider = new BinanceMarketDataProvider({
      client: new BinancePublicClient({
        fetchImpl,
        sleep: async () => undefined,
      }),
      now: () => SERVER_TIME + 10,
    });

    const snapshot = await provider.getMarketSnapshot();

    expect(snapshot.status).toBe("VALID");
    expect(Object.keys(snapshot.symbols)).toEqual([...RESEARCH_SYMBOLS]);
    for (const symbol of RESEARCH_SYMBOLS) {
      const result = snapshot.symbols[symbol];
      expect(result.status).toBe("VALID");
      if (result.status === "VALID") {
        expect(result.datasets["1h"].candles).toHaveLength(250);
        expect(result.datasets["4h"].candles).toHaveLength(250);
        expect(result.datasets["1h"].candles[0]).not.toBeInstanceOf(Array);
      }
    }

    const klineUrls = fetchImpl.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname === "/fapi/v1/klines");
    expect(klineUrls).toHaveLength(10);
    expect(klineUrls.every((url) => url.searchParams.get("limit") === "251")).toBe(true);
  });

  it("reports a single unavailable symbol as PARTIAL without fabricating its data", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/fapi/v1/time") {
        return new Response(JSON.stringify({ serverTime: SERVER_TIME }), { status: 200 });
      }
      if (url.pathname === "/fapi/v1/exchangeInfo") {
        return new Response(JSON.stringify(makeExchangeInfo("SOLUSDT")), { status: 200 });
      }
      if (url.pathname === "/fapi/v1/klines") {
        return new Response(JSON.stringify(makeRawKlines(url.searchParams.get("interval") as MarketTimeframe, 251)), {
          status: 200,
        });
      }
      return new Response("", { status: 404 });
    });
    const provider = new BinanceMarketDataProvider({
      client: new BinancePublicClient({ fetchImpl, sleep: async () => undefined }),
      now: () => SERVER_TIME,
    });

    const snapshot = await provider.getMarketSnapshot();

    expect(snapshot.status).toBe("PARTIAL");
    expect(snapshot.symbols.SOLUSDT.status).toBe("INVALID");
    if (snapshot.symbols.SOLUSDT.status === "INVALID") {
      expect(snapshot.symbols.SOLUSDT.error.code).toBe("SYMBOL_UNAVAILABLE");
      expect(snapshot.symbols.SOLUSDT.datasets["1h"].status).toBe("INVALID");
    }
    expect(fetchImpl.mock.calls.filter(([input]) => String(input).includes("/fapi/v1/klines")).length).toBe(8);
  });
});
