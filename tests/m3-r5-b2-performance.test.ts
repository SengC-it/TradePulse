import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import type { BacktestData } from "../src/lib/backtest/types.ts";
import {
  M3_R5_ROUND_005_OUTPUT_PATHS,
  assertRound005PerformancePreflight,
  buildRound005HistoricalLoadRanges,
  discoverRound005IntrabarRequirements,
} from "../src/lib/research/m3-r5-round-005-performance.ts";
import {
  R5_EXECUTION_CONTRACTS,
  makeR5CandidateIdentity,
  resolveR5Entry,
  type R5CandidateSignal,
} from "../src/lib/research/m3-r5-round-005-protocol.ts";
import { settleR5Candidate } from "../src/lib/research/m3-r5-round-005-settlement.ts";
import { publishRound005ArtifactsAtomically, round005ArtifactStagingPrefix, parseRound005AuthoritativeArguments } from "../scripts/m3-r5-performance.ts";

const HOUR = INTERVAL_MS["1h"];
const BASE = Date.parse("2026-01-01T00:00:00.000Z");

function candle(index: number, values: Partial<Candle> = {}): Candle {
  const openTime = BASE + index * HOUR;
  return {
    symbol: "BTCUSDT",
    timeframe: "1h",
    openTime,
    closeTime: openTime + HOUR - 1,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 10,
    quoteVolume: 1_000,
    tradeCount: 10,
    takerBuyBaseVolume: 5,
    takerBuyQuoteVolume: 500,
    ...values,
  };
}

function signal(overrides: Partial<R5CandidateSignal> = {}): R5CandidateSignal {
  return {
    candidateId: "R5-H18-COMPRESSION-EXPANSION",
    hypothesisId: "H18_VOLATILITY_COMPRESSION_EXPANSION",
    symbol: "BTCUSDT",
    direction: "LONG",
    signalTime: candle(0).closeTime,
    decisionAtr: 2,
    stopAtrMultiple: 1.5,
    takeProfitR: 3,
    maxHeldCandles: 24,
    ...overrides,
  };
}

function fundingRecord(fundingTime: number, directMarkPrice: number | null = 100) {
  return [{ symbol: "BTCUSDT" as const, fundingTime, fundingRate: 0.0001, directMarkPrice }];
}

function emptyData(): BacktestData {
  const datasets = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, { candles1h: [], candles4h: [] }])) as unknown as BacktestData["datasets"];
  const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
  return { datasets, funding, manifests: [] };
}

describe("M3-R5-B.2 frozen native data and execution contracts", () => {
  it("loads the complete native performance module graph without invoking main", () => {
    const smokeScript = path.resolve("scripts/m3-r5-runtime-import-smoke.ts");
    const output = execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", smokeScript],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output).toContain("M3-R5 runtime-import smoke: PASS");
  });

  it("uses native 1H and native 4H ranges with a 48-candle settlement tail", () => {
    const ranges = buildRound005HistoricalLoadRanges();
    expect(ranges.candleRange["1h"].startTime).toBe(BASE - 250 * HOUR - (BASE - Date.parse("2023-01-01T00:00:00.000Z")));
    expect(ranges.candleRange["4h"].startTime % INTERVAL_MS["4h"]).toBe(0);
    expect(ranges.settlementTail.candleRange.settlementOnly).toBe(true);
    expect(ranges.settlementTail.candleRange.endTime - Math.floor(Date.parse("2026-08-15T23:59:59.999Z") / HOUR) * HOUR).toBe(48 * HOUR);
  });

  it("keeps the frozen H15/H16/H18 execution contracts", () => {
    expect(R5_EXECUTION_CONTRACTS.h15).toEqual({ stopAtr: 2, takeProfitR: 3, maxHeldCandles: 48 });
    expect(R5_EXECUTION_CONTRACTS.h16).toEqual({ stopAtr: 1.5, takeProfitR: "FIXED_DECISION_EMA20", maxHeldCandles: 12 });
    expect(R5_EXECUTION_CONTRACTS.h18).toEqual({ stopAtr: 1.5, takeProfitR: 3, maxHeldCandles: 24 });
  });

  it("uses the first native 1H open strictly after signalTime", () => {
    const result = resolveR5Entry({ signal: signal(), candles1h: [candle(0), candle(1), candle(2)] });
    expect(result.status).toBe("EXECUTION_READY");
    if (result.status === "EXECUTION_READY") expect(result.entryOpenTime).toBe(candle(1).openTime);
  });

  it("keeps candidate identity candidate-independent for cross-candidate evidence", () => {
    expect(makeR5CandidateIdentity({ symbol: "BTCUSDT", direction: "LONG", signalTime: BASE })).toBe(`BTCUSDT|LONG|${BASE}`);
  });
});

describe("M3-R5-B.2 settlement using bt-policy-003", () => {
  it("retains a formal signal when the next entry is unavailable", () => {
    const result = settleR5Candidate({ signal: signal(), candles1h: [candle(0)], funding: fundingRecord(BASE + HOUR), periodEndTime: BASE + 100 * HOUR });
    expect(result.status).toBe("ENTRY_UNAVAILABLE");
    expect(result.signal.candidateId).toBe("R5-H18-COMPRESSION-EXPANSION");
  });

  it("settles a 24-candle H18 TIME_EXIT with actual fill prices and funding", () => {
    const candles = [candle(0), ...Array.from({ length: 24 }, (_, index) => candle(index + 1))];
    const result = settleR5Candidate({ signal: signal(), candles1h: candles, funding: fundingRecord(BASE + 2 * HOUR), periodEndTime: BASE + 100 * HOUR });
    expect(result.status).toBe("EXECUTED");
    expect(result.exitReason).toBe("TIME_EXIT");
    expect(result.heldCandleNumber).toBe(24);
    expect(result.entryFill).toBeCloseTo(100.05);
    expect(result.exitFill).toBeCloseTo(99.95);
    expect(result.grossR).toBeTypeOf("number");
    expect(result.netR).toBeTypeOf("number");
  });

  it("applies SL before TP when the same candle touches both", () => {
    const candles = [candle(0), candle(1, { high: 110, low: 95 }), ...Array.from({ length: 23 }, (_, index) => candle(index + 2))];
    const result = settleR5Candidate({ signal: signal(), candles1h: candles, funding: fundingRecord(BASE + HOUR), periodEndTime: BASE + 100 * HOUR });
    expect(result.status).toBe("EXECUTED");
    expect(result.exitReason).toBe("SL");
    expect(result.heldCandleNumber).toBe(1);
  });

  it("censors only when the required held horizon exceeds the frozen research end", () => {
    const candles = [candle(0), ...Array.from({ length: 24 }, (_, index) => candle(index + 1))];
    const result = settleR5Candidate({ signal: signal(), candles1h: candles, funding: fundingRecord(BASE + HOUR), periodEndTime: candle(1).closeTime });
    expect(result.status).toBe("PERIOD_END_CENSORED");
  });

  it("reports missing intrabar settlement as unresolved, with exit-candle provenance", () => {
    const exitOpen = candle(1).openTime;
    const candles = [candle(0), candle(1, { high: 110, low: 99 }), ...Array.from({ length: 23 }, (_, index) => candle(index + 2))];
    const result = settleR5Candidate({ signal: signal(), candles1h: candles, funding: fundingRecord(exitOpen + 30 * 60_000), periodEndTime: BASE + 100 * HOUR });
    expect(result.status).toBe("SETTLEMENT_AMBIGUOUS");
    expect(result.settlementAmbiguousExitCandleOpenTime).toBe(exitOpen);
  });
});

describe("M3-R5-B.2 phase-A and CLI safety boundaries", () => {
  it("does not discover intrabar windows when the data contains no formal trades", () => {
    expect(discoverRound005IntrabarRequirements({ data: emptyData() })).toEqual([]);
  });

  it("requires explicit performance authorization and exact provenance", () => {
    const valid = {
      confirmAuthoritativePerformance: true,
      sourceSha: "a".repeat(40),
      round: "baseline-002-research-round-005",
      gateSha: "e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5",
      planSha: "ab16a63462825441e00682f2b2bcbe04cb249e469843ce7f9a097017d992b6d1",
      headSha: "a".repeat(40),
      cleanWorktree: true,
      existingOutputArtifacts: [],
      gateValidatorPass: true,
      planValidatorPass: true,
    } as const;
    expect(() => assertRound005PerformancePreflight(valid)).not.toThrow();
    expect(() => assertRound005PerformancePreflight({ ...valid, confirmAuthoritativePerformance: false })).toThrow();
    expect(() => assertRound005PerformancePreflight({ ...valid, gateSha: "b".repeat(64) })).toThrow();
    expect(() => assertRound005PerformancePreflight({ ...valid, planSha: "b".repeat(64) })).toThrow();
    expect(() => assertRound005PerformancePreflight({ ...valid, existingOutputArtifacts: [M3_R5_ROUND_005_OUTPUT_PATHS[0]] })).toThrow();
  });

  it("parses only the explicit authoritative command contract", () => {
    const args = parseRound005AuthoritativeArguments([
      "node",
      "scripts/m3-r5-performance.ts",
      "--confirm-authoritative-performance",
      "--source-sha",
      "a".repeat(40),
      "--round",
      "baseline-002-research-round-005",
      "--gate-sha",
      "g".repeat(64),
      "--plan-sha",
      "p".repeat(64),
    ]);
    expect(args.confirmAuthoritativePerformance).toBe(true);
    expect(args.sourceSha).toHaveLength(40);
  });
});

describe("M3-R5-B.2 destination-filesystem publication", () => {
  function tempPublicationDirectory(): string {
    return mkdtempSync(path.join(os.tmpdir(), "tradepulse-m3-r5-test-"));
  }

  function publicationInput(directory: string) {
    return {
      summaryPath: path.join(directory, "summary.json"),
      auditPath: path.join(directory, "audit.json"),
      resultsPath: path.join(directory, "results.md"),
      summary: "SUMMARY-BYTES\n",
      audit: "AUDIT-BYTES\n",
      results: "RESULTS-BYTES\n",
    };
  }

  it("stages beside the destination and never calls os.tmpdir during publication", () => {
    const directory = tempPublicationDirectory();
    const input = publicationInput(directory);
    const tmpdir = vi.spyOn(os, "tmpdir");
    publishRound005ArtifactsAtomically(input);
    expect(tmpdir).not.toHaveBeenCalled();
    expect(readdirSync(directory).sort()).toEqual(["audit.json", "results.md", "summary.json"]);
    expect(round005ArtifactStagingPrefix(input.summaryPath)).toContain(directory);
    rmSync(directory, { recursive: true, force: true });
  });

  it("publishes exact bytes in AUDIT, RESULTS, SUMMARY order", () => {
    const directory = tempPublicationDirectory();
    const input = publicationInput(directory);
    const order: string[] = [];
    publishRound005ArtifactsAtomically({ ...input, rename: (from, to) => { order.push(path.basename(String(to))); return renameSync(from, to); } });
    expect(order).toEqual(["audit.json", "results.md", "summary.json"]);
    expect(readFileSync(input.auditPath, "utf8")).toBe(input.audit);
    expect(readFileSync(input.resultsPath, "utf8")).toBe(input.results);
    expect(readFileSync(input.summaryPath, "utf8")).toBe(input.summary);
    rmSync(directory, { recursive: true, force: true });
  });

  it("rolls back after AUDIT publication fails before RESULTS", () => {
    const directory = tempPublicationDirectory();
    const input = publicationInput(directory);
    expect(() => publishRound005ArtifactsAtomically({ ...input, rename: () => { throw new Error("RESULTS_RENAME_FAILED"); } })).toThrow("RESULTS_RENAME_FAILED");
    expect(existsSync(input.auditPath)).toBe(false);
    expect(existsSync(input.resultsPath)).toBe(false);
    expect(existsSync(input.summaryPath)).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
    rmSync(directory, { recursive: true, force: true });
  });

  it("rolls back after AUDIT and RESULTS publication fail before SUMMARY", () => {
    const directory = tempPublicationDirectory();
    const input = publicationInput(directory);
    let calls = 0;
    const realRename = renameSync;
    expect(() => publishRound005ArtifactsAtomically({ ...input, rename: (from, to) => { calls += 1; if (calls === 3) throw new Error("SUMMARY_RENAME_FAILED"); return realRename(from, to); } })).toThrow("SUMMARY_RENAME_FAILED");
    expect(existsSync(input.auditPath)).toBe(false);
    expect(existsSync(input.resultsPath)).toBe(false);
    expect(existsSync(input.summaryPath)).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
    rmSync(directory, { recursive: true, force: true });
  });

  it("rejects pre-existing output before staging and preserves it", () => {
    const directory = tempPublicationDirectory();
    const input = publicationInput(directory);
    writeFileSync(input.auditPath, "PREEXISTING\n", "utf8");
    expect(() => publishRound005ArtifactsAtomically(input)).toThrow("already exists");
    expect(readFileSync(input.auditPath, "utf8")).toBe("PREEXISTING\n");
    expect(readdirSync(directory).sort()).toEqual(["audit.json"]);
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("M3-R5-B.2 reserved outputs and frozen evidence", () => {
  it("does not create any Round-005 performance output during offline tests", () => {
    for (const outputPath of M3_R5_ROUND_005_OUTPUT_PATHS) expect(existsSync(outputPath)).toBe(false);
  });

  it("keeps the H17 qualification files byte-stable", () => {
    expect(createHash("sha256").update(readFileSync("docs/evidence/M3_R5_H17_DATA_QUALIFICATION.json")).digest("hex")).toBe("aa0898d6f760e79675eae251f04fbcdc7afd584bfebf567cdd77189210d8b234");
    expect(createHash("sha256").update(readFileSync("docs/M3_R5_H17_DATA_QUALIFICATION.md")).digest("hex")).toBe("01aa31e0390c51369ffcff45757eb43226b3ef74084964d0fbde1fd741a51950");
  });
});
