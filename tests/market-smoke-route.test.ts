import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RESEARCH_SYMBOLS } from "@/lib/config/constants";
import { BinanceMarketDataProvider, MARKET_TIMEFRAMES } from "@/lib/market-data";
import type { MarketSnapshot } from "@/lib/market-data";
import { GET } from "@/app/api/diagnostics/market-smoke/route";

vi.mock("@/lib/market-data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/market-data")>("@/lib/market-data");
  return {
    ...actual,
    BinanceMarketDataProvider: vi.fn(),
  };
});

const TEST_SECRET = "diagnostic-test-secret";
const getMarketSnapshot = vi.fn();
const mockedProvider = vi.mocked(BinanceMarketDataProvider);

function makeSnapshot(status: MarketSnapshot["status"]): MarketSnapshot {
  const symbols = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => {
      const invalid =
        status === "INVALID" ||
        (status === "PARTIAL" && symbol === "SOLUSDT");

      if (invalid) {
        const datasets = Object.fromEntries(
          MARKET_TIMEFRAMES.map((timeframe) => [
            timeframe,
            {
              status: "INVALID",
              error: {
                code: "UPSTREAM_ACCESS_RESTRICTED",
                message: "Test fixture.",
                symbol,
                timeframe,
                retryable: false,
              },
            },
          ]),
        );

        return [
          symbol,
          {
            symbol,
            status: "INVALID",
            datasets,
            error: {
              code: "UPSTREAM_ACCESS_RESTRICTED",
              message: "Test fixture.",
              symbol,
              retryable: false,
            },
          },
        ];
      }

      const datasets = Object.fromEntries(
        MARKET_TIMEFRAMES.map((timeframe) => [
          timeframe,
          {
            symbol,
            timeframe,
            candles: Array.from({ length: 250 }, () => null),
          },
        ]),
      );

      return [symbol, { symbol, status: "VALID", datasets }];
    }),
  );

  return {
    status,
    provider: "test-provider",
    generatedAt: 1_000,
    serverTime: {
      serverTime: 1_000,
      operationStartedAt: 900,
      attemptStartedAt: 950,
      attemptCompletedAt: 960,
      roundTripMs: 10,
      estimatedClockOffsetMs: 40,
    },
    symbols,
    diagnostics: {
      operationStartedAt: 900,
      operationCompletedAt: 1_100,
      roundTripMs: 200,
      requestCount: 12,
      requestWeightHeaders: [],
    },
  } as unknown as MarketSnapshot;
}

function makeRequest(
  authorized = true,
  useDiagnosticHeader = false,
): Request {
  const headers = new Headers();
  if (authorized) {
    headers.set(
      useDiagnosticHeader
        ? "x-tradepulse-market-smoke-secret"
        : "authorization",
      useDiagnosticHeader ? TEST_SECRET : `Bearer ${TEST_SECRET}`,
    );
  }

  return new Request("https://example.test/api/diagnostics/market-smoke", {
    headers: authorized ? headers : undefined,
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = TEST_SECRET;
  process.env.TRADEPULSE_MARKET_SMOKE_SECRET = TEST_SECRET;
  getMarketSnapshot.mockReset();
  mockedProvider.mockImplementation(
    function MockProvider() {
      return { getMarketSnapshot };
    } as unknown as typeof BinanceMarketDataProvider,
  );
});

afterAll(() => {
  delete process.env.CRON_SECRET;
  delete process.env.TRADEPULSE_MARKET_SMOKE_SECRET;
});

describe("market smoke diagnostic route HTTP semantics", () => {
  it.each([
    ["VALID", 200],
    ["PARTIAL", 503],
    ["INVALID", 503],
  ] as const)("returns %s snapshot with HTTP %s", async (status, expectedHttpStatus) => {
    getMarketSnapshot.mockResolvedValue(makeSnapshot(status));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(expectedHttpStatus);
    expect(body).toMatchObject({
      ok: status === "VALID",
      runtime: "nodejs",
      nodeVersion: process.version,
      snapshotStatus: status,
      latencyMs: 200,
    });
    expect(body.datasets["BTCUSDT 1h"]).toEqual(
      status === "INVALID"
        ? {
            status: "INVALID",
            closedCandleCount: 0,
            errorCode: "UPSTREAM_ACCESS_RESTRICTED",
          }
        : {
            status: "VALID",
            closedCandleCount: 250,
            errorCode: null,
          },
    );
    expect(body).not.toHaveProperty("CRON_SECRET");
  });

  it("returns 401 without invoking the provider when unauthorized", async () => {
    const response = await GET(makeRequest(false));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "unauthorized" });
    expect(getMarketSnapshot).not.toHaveBeenCalled();
  });

  it("accepts the temporary server-only diagnostic secret header", async () => {
    getMarketSnapshot.mockResolvedValue(makeSnapshot("VALID"));

    const response = await GET(makeRequest(true, true));

    expect(response.status).toBe(200);
  });

  it("returns 500 with a safe body when the provider throws unexpectedly", async () => {
    getMarketSnapshot.mockRejectedValue(new Error("test failure"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      runtime: "nodejs",
      nodeVersion: process.version,
      snapshotStatus: "INVALID",
      errorCode: "INVALID_RESPONSE",
    });
    expect(body).not.toHaveProperty("message");
    expect(body).not.toHaveProperty("CRON_SECRET");
  });
});
