import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import { HistoricalDataError, classifyHistoricalAcquisitionFailure } from "../src/lib/historical-data/errors.ts";
import { BinancePublicClient } from "../src/lib/market-data/binance/client.ts";
import { MarketDataError } from "../src/lib/market-data/errors.ts";
import {
  ROUND006_PAGE_CACHE_SCHEMA_VERSION,
  Round006CacheIntegrityError,
  Round006CachedBinanceClient,
  latestClosedCandleWindow,
  runRound006PublicDataPreflight,
  validateRound006PreflightCandle,
} from "../src/lib/research/m3-r6-round-006-data.ts";

const HOUR = 60 * 60 * 1_000;
const MINUTE = 60 * 1_000;
const SYMBOL = "BTCUSDT" as const;

function temporaryDirectory(): string {
  return mkdtempSync(path.join(os.tmpdir(), "tradepulse-r6-data-test-"));
}

function candleRow(openTime: number, intervalMs = HOUR): readonly (number | string)[] {
  return [openTime, "100", "110", "90", "105", "10", openTime + intervalMs - 1, "1000", 10, "5", "500", 0];
}

function intrabarRows(openTime: number): readonly (readonly (number | string)[])[] {
  return Array.from({ length: 60 }, (_, index) => candleRow(openTime + index * 60_000, 60_000));
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject.");
}

function clientFor(
  cacheDirectory: string,
  fetchImpl: typeof fetch,
  maxAttempts = 5,
): Round006CachedBinanceClient {
  return new Round006CachedBinanceClient({
    cacheDirectory,
    clientOptions: {
      fetchImpl,
      maxAttempts,
      sleep: async () => undefined,
      random: () => 0,
    },
  });
}

describe("Round-006 research acquisition transport", () => {
  it("preserves and classifies the terminal acquisition cause without double-wrapping", async () => {
    const root = temporaryDirectory();
    const request = {
      symbol: SYMBOL,
      timeframe: "1h" as const,
      range: { startTime: HOUR, endTime: HOUR },
      serverTime: 3 * HOUR,
    };
    try {
      const timeout = new MarketDataError({
        code: "HTTP_TIMEOUT",
        message: "timeout",
        retryable: true,
        diagnostics: { endpoint: "/fapi/v1/klines", attempts: 5, httpStatus: 408 },
      });
      const timeoutClient = { getKlinesRange: async () => { throw timeout; } } as unknown as BinancePublicClient;
      const timeoutLoader = new BinanceHistoricalDataLoader({ client: timeoutClient, klineLimit: 1 });
      const timeoutError = await captureRejection(timeoutLoader.loadCandles(request));
      expect(timeoutError).toMatchObject({
        code: "DATA_INCOMPLETE",
        diagnostics: {
          rootCauseCode: "HTTP_TIMEOUT",
          upstreamCode: "HTTP_TIMEOUT",
          endpoint: "/fapi/v1/klines",
          attempts: 5,
          httpStatus: 408,
        },
      });
      expect(classifyHistoricalAcquisitionFailure(timeoutError)).toBe("TRANSIENT");

      const network = new MarketDataError({
        code: "NETWORK_ERROR",
        message: "network unavailable",
        retryable: true,
      });
      const networkClient = { getKlinesRange: async () => { throw network; } } as unknown as BinancePublicClient;
      const networkLoader = new BinanceHistoricalDataLoader({ client: networkClient, klineLimit: 1 });
      const networkError = await captureRejection(networkLoader.loadCandles(request));
      expect(networkError).toBeInstanceOf(HistoricalDataError);
      expect(networkError).toMatchObject({ diagnostics: { rootCauseCode: "NETWORK_ERROR" } });
      expect(classifyHistoricalAcquisitionFailure(networkError)).toBe("TRANSIENT");

      const candleGap = new HistoricalDataError({
        code: "CANDLE_GAP",
        message: "gap",
        symbol: SYMBOL,
        timeframe: "1h",
      });
      const gapClient = { getKlinesRange: async () => { throw candleGap; } } as unknown as BinancePublicClient;
      const gapLoader = new BinanceHistoricalDataLoader({ client: gapClient, klineLimit: 1 });
      const gapError = await captureRejection(gapLoader.loadCandles(request));
      expect(gapError).toBe(candleGap);
      expect(classifyHistoricalAcquisitionFailure(gapError)).toBe("NON_TRANSIENT");

      const upstreamFailure = new HistoricalDataError({
        code: "DATA_INCOMPLETE",
        message: "wrapped upstream failure",
        diagnostics: { rootCauseCode: "UPSTREAM_5XX" },
      });
      expect(classifyHistoricalAcquisitionFailure(upstreamFailure)).toBe("TRANSIENT");

      const unknown = new HistoricalDataError({
        code: "DATA_INCOMPLETE",
        message: "nested incomplete",
        diagnostics: { upstreamCode: "DATA_INCOMPLETE" },
      });
      expect(classifyHistoricalAcquisitionFailure(unknown)).toBe("ACQUISITION_ROOT_CAUSE_UNKNOWN");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("derives the latest fully closed 1h candle from UTC epoch server time", () => {
    expect(latestClosedCandleWindow(10 * HOUR + 46 * MINUTE, HOUR)).toEqual({
      openTime: 9 * HOUR,
      closeTime: 10 * HOUR - 1,
    });
    expect(latestClosedCandleWindow(11 * HOUR, HOUR)).toEqual({
      openTime: 10 * HOUR,
      closeTime: 11 * HOUR - 1,
    });
    expect(latestClosedCandleWindow(11 * HOUR - 1, HOUR)).toEqual({
      openTime: 9 * HOUR,
      closeTime: 10 * HOUR - 1,
    });
  });

  it("uses the same UTC epoch calculation for 4h candles", () => {
    expect(latestClosedCandleWindow(11 * HOUR + 15 * MINUTE, 4 * HOUR)).toEqual({
      openTime: 4 * HOUR,
      closeTime: 8 * HOUR - 1,
    });
    expect(latestClosedCandleWindow(12 * HOUR, 4 * HOUR)).toEqual({
      openTime: 8 * HOUR,
      closeTime: 12 * HOUR - 1,
    });
    expect(latestClosedCandleWindow(12 * HOUR - 1, 4 * HOUR)).toEqual({
      openTime: 4 * HOUR,
      closeTime: 8 * HOUR - 1,
    });
  });

  it("rejects a current/forming candle and accepts the exact previous closed candle", () => {
    const serverTime = 10 * HOUR + 46 * MINUTE;
    const formingOpenTime = 10 * HOUR;
    expect(() => validateRound006PreflightCandle(
      { data: [candleRow(formingOpenTime)] },
      SYMBOL,
      "1h",
      formingOpenTime,
      serverTime,
    )).toThrowError(/fully closed/u);

    const closedOpenTime = 9 * HOUR;
    expect(() => validateRound006PreflightCandle(
      { data: [candleRow(closedOpenTime)] },
      SYMBOL,
      "1h",
      closedOpenTime,
      serverTime,
    )).not.toThrow();
  });

  it("retries timeout, 5xx, and 429 responses with bounded attempts", async () => {
    const root = temporaryDirectory();
    try {
      let timeoutCalls = 0;
      const timeoutClient = clientFor(root, async () => {
        timeoutCalls += 1;
        if (timeoutCalls < 3) {
          const error = new Error("timeout");
          error.name = "AbortError";
          throw error;
        }
        return jsonResponse([candleRow(HOUR)]);
      });
      const timeoutResponse = await timeoutClient.getKlinesRange(SYMBOL, "1h", HOUR, HOUR, 1);
      expect(timeoutResponse.diagnostics.attempts).toBe(3);
      expect(timeoutCalls).toBe(3);

      let serverCalls = 0;
      const serverClient = clientFor(root, async () => {
        serverCalls += 1;
        return serverCalls < 5 ? jsonResponse({ error: "busy" }, 503) : jsonResponse([candleRow(2 * HOUR)]);
      });
      const serverResponse = await serverClient.getKlinesRange(SYMBOL, "1h", 2 * HOUR, 2 * HOUR, 1);
      expect(serverResponse.diagnostics.attempts).toBe(5);
      expect(serverCalls).toBe(5);

      let rateCalls = 0;
      const rateClient = clientFor(root, async () => {
        rateCalls += 1;
        return rateCalls === 1 ? jsonResponse({ error: "rate limited" }, 429) : jsonResponse([candleRow(3 * HOUR)]);
      });
      const rateResponse = await rateClient.getKlinesRange(SYMBOL, "1h", 3 * HOUR, 3 * HOUR, 1);
      expect(rateResponse.diagnostics.attempts).toBe(2);
      expect(rateCalls).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not retry 451 or invalid JSON", async () => {
    const root = temporaryDirectory();
    try {
      let restrictedCalls = 0;
      const restricted = clientFor(root, async () => {
        restrictedCalls += 1;
        return jsonResponse({ error: "restricted" }, 451);
      });
      await expect(restricted.getKlinesRange(SYMBOL, "1h", HOUR, HOUR, 1)).rejects.toMatchObject({
        code: "UPSTREAM_ACCESS_RESTRICTED",
      });
      expect(restrictedCalls).toBe(1);

      let invalidCalls = 0;
      const invalid = clientFor(root, async () => {
        invalidCalls += 1;
        return new Response("not-json", { status: 200 });
      });
      await expect(invalid.getKlinesRange(SYMBOL, "1h", 2 * HOUR, 2 * HOUR, 1)).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
      expect(invalidCalls).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stops after the frozen retry budget is exhausted", async () => {
    const root = temporaryDirectory();
    try {
      let calls = 0;
      const client = clientFor(root, async () => {
        calls += 1;
        const error = new Error("timeout");
        error.name = "AbortError";
        throw error;
      });
      await expect(client.getKlinesRange(SYMBOL, "1h", HOUR, HOUR, 1)).rejects.toMatchObject({
        code: "HTTP_TIMEOUT",
        diagnostics: { attempts: 5 },
      });
      expect(calls).toBe(5);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("caches only validated pages and resumes after a later page fails", async () => {
    const root = temporaryDirectory();
    const start = 10 * HOUR;
    try {
      let firstRunCalls = 0;
      const firstRunClient = clientFor(root, async (input) => {
        firstRunCalls += 1;
        const requestedStart = Number(new URL(String(input)).searchParams.get("startTime"));
        if (requestedStart !== start) throw new Error("second page unavailable");
        return jsonResponse([candleRow(start)]);
      }, 1);
      const firstRunLoader = new BinanceHistoricalDataLoader({ client: firstRunClient, klineLimit: 1 });
      await expect(firstRunLoader.loadCandles({
        symbol: SYMBOL,
        timeframe: "1h",
        range: { startTime: start, endTime: start + HOUR },
        serverTime: start + 3 * HOUR,
      })).rejects.toThrow();
      expect(firstRunCalls).toBe(2);
      expect(readdirSync(root).some((name) => name.endsWith(".json"))).toBe(true);

      let resumedCalls = 0;
      const resumedClient = clientFor(root, async (input) => {
        resumedCalls += 1;
        const requestedStart = Number(new URL(String(input)).searchParams.get("startTime"));
        return jsonResponse([candleRow(requestedStart)]);
      }, 1);
      const resumedLoader = new BinanceHistoricalDataLoader({ client: resumedClient, klineLimit: 1 });
      const resumed = await resumedLoader.loadCandles({
        symbol: SYMBOL,
        timeframe: "1h",
        range: { startTime: start, endTime: start + HOUR },
        serverTime: start + 3 * HOUR,
      });
      expect(resumed.candles).toHaveLength(2);
      expect(resumedCalls).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a cached payload checksum is changed", async () => {
    const root = temporaryDirectory();
    try {
      const first = clientFor(root, async () => jsonResponse([candleRow(HOUR)]), 1);
      await first.getKlinesRange(SYMBOL, "1h", HOUR, HOUR, 1);
      const cachePath = path.join(root, readdirSync(root).find((name) => name.endsWith(".json"))!);
      const cached = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>;
      cached.payloadSha256 = "0".repeat(64);
      writeFileSync(cachePath, JSON.stringify(cached), "utf8");

      let networkCalls = 0;
      const second = clientFor(root, async () => {
        networkCalls += 1;
        return jsonResponse([candleRow(HOUR)]);
      });
      await expect(second.getKlinesRange(SYMBOL, "1h", HOUR, HOUR, 1)).rejects.toBeInstanceOf(Round006CacheIntegrityError);
      expect(networkCalls).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps all historical network operations at two concurrent requests", async () => {
    const root = temporaryDirectory();
    try {
      let active = 0;
      let maxActive = 0;
      const client = clientFor(root, async (input) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        const requestedStart = Number(new URL(String(input)).searchParams.get("startTime"));
        return jsonResponse([candleRow(requestedStart)]);
      }, 1);
      await Promise.all(Array.from({ length: 6 }, (_, index) => client.getKlinesRange(
        SYMBOL,
        "1h",
        (index + 1) * HOUR,
        (index + 1) * HOUR,
        1,
      )));
      expect(maxActive).toBeLessThanOrEqual(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preflights public data without invoking a performance path", async () => {
    const root = temporaryDirectory();
    const serverTime = 1_800_000_000_000;
    try {
      const client = clientFor(root, async (input) => {
        const url = new URL(String(input));
        const symbol = url.searchParams.get("symbol")!;
        if (url.pathname.endsWith("/time")) return jsonResponse({ serverTime });
        const start = Number(url.searchParams.get("startTime"));
        if (url.pathname.endsWith("/fundingRate")) {
          return jsonResponse([{ symbol, fundingTime: start + 1, fundingRate: "0.0001", markPrice: "100" }]);
        }
        if (url.pathname.endsWith("/markPriceKlines")) return jsonResponse([[start, "100", "110", "90", "105", "0", start + HOUR - 1]]);
        if (url.searchParams.get("interval") === "1m") return jsonResponse(intrabarRows(start));
        const interval = url.searchParams.get("interval") === "4h" ? 4 * HOUR : HOUR;
        return jsonResponse([candleRow(start, interval)]);
      });
      const report = await runRound006PublicDataPreflight(client);
      expect(report.status).toBe("PASS");
      expect(report.requestCount).toBe(26);
      expect(report.transport.maxConcurrency).toBe(2);
      expect(ROUND006_PAGE_CACHE_SCHEMA_VERSION).toBe("m3-r6-round-006-page-cache-001");
      expect(existsSync(path.join(root, readdirSync(root).find((name) => name.endsWith(".json"))!))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
