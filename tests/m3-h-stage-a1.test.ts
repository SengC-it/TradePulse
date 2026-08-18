import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  BINANCE_HTTP_TIMEOUT_MS,
  BINANCE_MAX_ATTEMPTS,
} from "../src/lib/market-data/intervals.ts";
import {
  BINANCE_PUBLIC_BASE_URL,
  BinancePublicClient,
} from "../src/lib/market-data/binance/client.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import {
  M3_H_CONTROL_CLIENT_OPTIONS,
  createM3HControlLoader,
} from "../scripts/m3-h-capture-control.ts";
import {
  M3_H_ROUND_001_EXPERIMENTS,
  M3_H_ROUND_001_PLAN_CANONICAL_JSON,
  M3_H_ROUND_001_PLAN_SHA256,
  M3_H_ROUND_001_SELECTION_GATE_SHA256,
} from "../src/lib/research/m3-h-round-001-plan.ts";

describe("M3-H Stage-A.1 capture reliability boundary", () => {
  it("keeps the global market-data defaults unchanged", () => {
    expect(BINANCE_HTTP_TIMEOUT_MS).toBe(5_000);
    expect(BINANCE_MAX_ATTEMPTS).toBe(3);
  });

  it("uses the execution-only 15-second profile with three client attempts", () => {
    expect(M3_H_CONTROL_CLIENT_OPTIONS).toEqual({ timeoutMs: 15_000, maxAttempts: 3 });
    expect(createM3HControlLoader()).toBeInstanceOf(BinanceHistoricalDataLoader);
  });

  it("keeps the official Binance public base URL and does not add alternate routing", () => {
    expect(BINANCE_PUBLIC_BASE_URL).toBe("https://fapi.binance.com");
    const captureSource = readFileSync(new URL("../scripts/m3-h-capture-control.ts", import.meta.url), "utf8");
    expect(captureSource).toContain("BinanceHistoricalDataLoader");
    expect(captureSource).not.toMatch(/(?:proxy|alternate|fallback|Date\.now)/i);
  });

  it("keeps authoritative study time on getServerTime with no local-clock fallback", async () => {
    const requestedPaths: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input.toString());
      requestedPaths.push(url.pathname);
      if (url.pathname === "/fapi/v1/time") {
        return new Response(JSON.stringify({ serverTime: 4_000_000 }), { status: 200 });
      }
      return new Response(JSON.stringify([[0, "100", "101", "99", "100", "1", 3_599_999, "100", "1", "1", "1", "0"]]), {
        status: 200,
      });
    };
    const loader = new BinanceHistoricalDataLoader({
      now: () => 9_999,
      clientOptions: { fetchImpl, sleep: async () => undefined },
    });

    const dataset = await loader.loadCandles({
      symbol: "BTCUSDT",
      timeframe: "1h",
      range: { startTime: 0, endTime: 0 },
    });

    expect(requestedPaths[0]).toBe("/fapi/v1/time");
    expect(dataset.candles).toHaveLength(1);
    expect(dataset.manifest.retrievedAt).toBe("1970-01-01T00:00:09.999Z");
  });

  it("fails closed after bounded timeout exhaustion", async () => {
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
      timeoutMs: 1,
      maxAttempts: 3,
      sleep: async () => undefined,
    });

    await expect(client.getServerTime()).rejects.toMatchObject({
      code: "HTTP_TIMEOUT",
      retryable: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("keeps the frozen plan, gate, and all 13 canonical experiment definitions unchanged", () => {
    expect(createHash("sha256").update(M3_H_ROUND_001_PLAN_CANONICAL_JSON).digest("hex")).toBe(
      M3_H_ROUND_001_PLAN_SHA256,
    );
    expect(M3_H_ROUND_001_PLAN_SHA256).toBe("2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a");
    expect(M3_H_ROUND_001_SELECTION_GATE_SHA256).toBe("11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd");
    expect(M3_H_ROUND_001_EXPERIMENTS).toHaveLength(13);
    expect(M3_H_ROUND_001_EXPERIMENTS.map((experiment) => experiment.experimentId)).toEqual([
      "R1-H1-CD-06H",
      "R1-H1-CD-12H",
      "R1-H1-CD-24H",
      "R2-H4-TOPN-1",
      "R2-H4-TOPN-2",
      "R2-H4-TOPN-3",
      "R3-H2-COST-010",
      "R3-H2-COST-015",
      "R3-H2-COST-020",
      "R3-H2-COST-025",
      "R4-H3-SCORE-075",
      "R4-H3-SCORE-080",
      "R4-H3-SCORE-085",
    ]);
  });
});
