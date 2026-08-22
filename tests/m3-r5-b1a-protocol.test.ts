import { readFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync as readBytes, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import { checksumFunding } from "../src/lib/historical-data/checksum.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import {
  M3_R5_DATA_CLASSIFICATION,
  M3_R5_PERFORMANCE_LOCK,
  M3_R5_POST_LOCK_INVALIDATION,
  M3_R5_RESEARCH_RANGE,
  M3_R5_RESEARCH_ROUND_ID,
  R5_COMPLEXITY_TUPLES,
  R5_EXECUTION_CONTRACTS,
  R5_FUTURE_GATE_REQUIREMENTS,
  R5_PROVISIONAL_CANDIDATES,
  canonicalFundingSlots,
  calculateR5RiskPlan,
  evaluateR5H15,
  evaluateR5H16,
  evaluateR5H17,
  evaluateR5H18,
  h15BreakoutDirection,
  h16MeanReversionDirection,
  h16NeutralRegime,
  h16TargetGeometry,
  h17FundingDirection,
  h18BreakoutDirection,
  h18CompressionPass,
  h18ExpansionPass,
  makeR5CandidateIdentity,
  resolveR5Entry,
  type R5Candle,
} from "../src/lib/research/m3-r5-round-005-protocol.ts";
import {
  M3_R5_H17_OUTPUT_PATHS,
  assertH17QualificationPreflight,
  createH17QualificationReport,
  h17QualificationRawSha256,
  publishH17QualificationArtifactsAtomically,
  qualifyH17FundingUniverse,
  renderH17QualificationMarkdown,
  serializeH17QualificationReport,
  type H17QualificationInput,
} from "../src/lib/research/m3-r5-h17-funding-qualification.ts";
import { parseM3R5H17QualificationArguments } from "../scripts/m3-r5-h17-qualify.ts";

const HOUR = 60 * 60 * 1000;
const FOUR_HOURS = 4 * HOUR;

function makeCandle(
  timeframe: "1h" | "4h",
  index: number,
  overrides: Partial<Pick<R5Candle, "open" | "high" | "low" | "close">> = {},
): R5Candle {
  const interval = timeframe === "1h" ? HOUR : FOUR_HOURS;
  const openTime = index * interval;
  const close = overrides.close ?? 100 + index;
  const open = overrides.open ?? close;
  const high = overrides.high ?? Math.max(open, close) + 1;
  const low = overrides.low ?? Math.min(open, close) - 1;
  return {
    symbol: "BTCUSDT",
    timeframe,
    openTime,
    closeTime: openTime + interval - 1,
    open,
    high,
    low,
    close,
    volume: 100,
    quoteVolume: 100,
    tradeCount: 1,
    takerBuyBaseVolume: 50,
    takerBuyQuoteVolume: 50,
  };
}

function makeH17Manifest(symbol: ResearchSymbol, startTime: number, endTime: number, records: readonly { readonly symbol: ResearchSymbol; readonly fundingTime: number; readonly fundingRate: number; readonly directMarkPrice: number | null }[]) {
  let sha256: string;
  try {
    sha256 = checksumFunding(records);
  } catch {
    sha256 = "a".repeat(64);
  }
  return {
    kind: "funding" as const,
    provider: "binance-usdm-public" as const,
    source: "/fapi/v1/fundingRate" as const,
    symbol,
    requestedStartTime: startTime,
    requestedEndTime: endTime,
    actualStartTime: records[0]?.fundingTime ?? null,
    actualEndTime: records[records.length - 1]?.fundingTime ?? null,
    rowCount: records.length,
    sha256,
  };
}

function makeH17Input(
  symbol: ResearchSymbol,
  slots: readonly number[],
  records: readonly { readonly symbol: ResearchSymbol; readonly fundingTime: number; readonly fundingRate: number; readonly directMarkPrice?: number | null }[] = slots.map((fundingTime) => ({ symbol, fundingTime, fundingRate: 0.0001, directMarkPrice: null })),
  paginationComplete = true,
  requestedStartTime = slots[0] ?? 0,
  requestedEndTime = slots[slots.length - 1] ?? 0,
): H17QualificationInput {
  const normalizedRecords = records.map((record) => ({ ...record, directMarkPrice: record.directMarkPrice ?? null }));
  const firstReturnedFundingTime = normalizedRecords[0]?.fundingTime ?? null;
  const lastReturnedFundingTime = normalizedRecords[normalizedRecords.length - 1]?.fundingTime ?? null;
  return {
    symbol,
    records: normalizedRecords,
    pagination: {
      pageCount: 1,
      paginationComplete,
      terminationReason: "SHORT_PAGE",
      requestedStartTime,
      requestedEndTime,
      firstReturnedFundingTime,
      lastReturnedFundingTime,
      finalCursor: lastReturnedFundingTime === null ? requestedStartTime : lastReturnedFundingTime + 1,
    },
    manifest: makeH17Manifest(symbol, requestedStartTime, requestedEndTime, normalizedRecords),
  };
}

function makeSmallH17Inputs(startTime = 0, endTime = 16 * HOUR): H17QualificationInput[] {
  const slots = canonicalFundingSlots(startTime, endTime);
  return RESEARCH_SYMBOLS.map((symbol) => makeH17Input(symbol, slots));
}

function makeFrozenH17Inputs(): H17QualificationInput[] {
  const slots = canonicalFundingSlots(M3_R5_RESEARCH_RANGE.startTime, M3_R5_RESEARCH_RANGE.endTime);
  return RESEARCH_SYMBOLS.map((symbol) => makeH17Input(symbol, slots, undefined, true, M3_R5_RESEARCH_RANGE.startTime, M3_R5_RESEARCH_RANGE.endTime));
}

describe("M3-R5-B.1A protocol freeze", () => {
  it("freezes the round, seen-data boundary, five symbols, and provisional registry", () => {
    expect(M3_R5_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-005");
    expect(M3_R5_DATA_CLASSIFICATION).toBe("RESEARCH_AVAILABLE_SEEN_DATA");
    expect(M3_R5_RESEARCH_RANGE.startTime).toBe(Date.parse("2023-01-01T00:00:00.000Z"));
    expect(M3_R5_RESEARCH_RANGE.endTime).toBe(Date.parse("2026-08-15T23:59:59.999Z"));
    expect(RESEARCH_SYMBOLS).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
    expect(R5_PROVISIONAL_CANDIDATES.map((candidate) => candidate.candidateId)).toEqual([
      "R5-H15-HTF-TREND",
      "R5-H16-NEUTRAL-MEAN-REVERSION",
      "R5-H17-FUNDING-REVERSAL",
      "R5-H18-COMPRESSION-EXPANSION",
    ]);
  });

  it("freezes exact execution contracts and complexity tuples", () => {
    expect(R5_EXECUTION_CONTRACTS.h15).toEqual({ stopAtr: 2, takeProfitR: 3, maxHeldCandles: 48 });
    expect(R5_EXECUTION_CONTRACTS.h16).toEqual({ stopAtr: 1.5, takeProfitR: "FIXED_DECISION_EMA20", maxHeldCandles: 12 });
    expect(R5_EXECUTION_CONTRACTS.h17).toEqual({ stopAtr: 1.5, takeProfitR: 3, maxHeldCandles: 24 });
    expect(R5_EXECUTION_CONTRACTS.h18).toEqual({ stopAtr: 1.5, takeProfitR: 3, maxHeldCandles: 24 });
    expect(R5_COMPLEXITY_TUPLES["R5-H15-HTF-TREND"]).toEqual({ newRules: 3, newTunableThresholds: 3, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 });
    expect(R5_COMPLEXITY_TUPLES["R5-H16-NEUTRAL-MEAN-REVERSION"]).toEqual({ newRules: 4, newTunableThresholds: 5, modifiedBaselineRules: 4, mechanismFamiliesUsed: 1 });
    expect(R5_COMPLEXITY_TUPLES["R5-H17-FUNDING-REVERSAL"]).toEqual({ newRules: 3, newTunableThresholds: 3, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 });
    expect(R5_COMPLEXITY_TUPLES["R5-H18-COMPRESSION-EXPANSION"]).toEqual({ newRules: 4, newTunableThresholds: 4, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 });
  });

  it("inherits ten applicable hard gates and defers the final Gate/Plan", () => {
    expect(R5_FUTURE_GATE_REQUIREMENTS.requiredRedundancyImprovement).toBe("NOT_APPLICABLE");
    expect(R5_FUTURE_GATE_REQUIREMENTS.applicableHardGateCount).toBe(10);
    expect(R5_FUTURE_GATE_REQUIREMENTS.gateNames).toHaveLength(10);
  });

  it("freezes the identity, lock, and invalidation semantics", () => {
    expect(makeR5CandidateIdentity({ symbol: "BTCUSDT", direction: "LONG", signalTime: 123 })).toBe("BTCUSDT|LONG|123");
    expect(M3_R5_PERFORMANCE_LOCK).toBe("FIRST_M3_R5_PERFORMANCE_RESULT_GENERATED");
    expect(M3_R5_POST_LOCK_INVALIDATION).toBe("ROUND_005_INVALIDATION_REQUIRED");
  });
});

describe("H15 HTF trend", () => {
  it("uses only decision-time data and does not require a future entry candle", () => {
    const candles4h = Array.from({ length: 70 }, (_, index) =>
      makeCandle("4h", index, index === 60 ? { close: 200, high: 201, low: 199 } : undefined),
    );
    const signalCandle = candles4h[60]!;
    const result = evaluateR5H15({ symbol: "BTCUSDT", candles4h, candles1h: [], currentIndex: 60 });
    const withFuture = evaluateR5H15({
      symbol: "BTCUSDT",
      candles4h,
      candles1h: [makeCandle("1h", 100, { open: 1, close: 1 })],
      currentIndex: 60,
    });
    const withFutureModified = evaluateR5H15({
      symbol: "BTCUSDT",
      candles4h,
      candles1h: [makeCandle("1h", 100, { open: 10_000, close: 10_500 })],
      currentIndex: 60,
    });
    expect(result.status).toBe("SIGNAL");
    expect(withFuture).toEqual(result);
    expect(withFutureModified).toEqual(result);
    if (result.status !== "SIGNAL") return;
    expect(result.signal.direction).toBe("LONG");
    expect(result.signal.signalTime).toBe(signalCandle.closeTime);
    expect(Object.hasOwn(result.signal, "entryOpenTime")).toBe(false);
    expect(result.signal.stopAtrMultiple).toBe(2);
    expect(result.signal.takeProfitR).toBe(3);
    expect(result.signal.maxHeldCandles).toBe(48);
  });

  it("does not allow the current candle at the breakout boundary", () => {
    expect(h15BreakoutDirection({ ema20: 10, ema50: 9, currentClose: 20, priorHigh: 20, priorLow: 0 })).toBeNull();
    expect(h15BreakoutDirection({ ema20: 10, ema50: 9, currentClose: 20.0001, priorHigh: 20, priorLow: 0 })).toBe("LONG");
    expect(h15BreakoutDirection({ ema20: 9, ema50: 10, currentClose: 0, priorHigh: 20, priorLow: 0 })).toBeNull();
    expect(h15BreakoutDirection({ ema20: 9, ema50: 10, currentClose: -0.0001, priorHigh: 20, priorLow: 0 })).toBe("SHORT");
  });

  it("keeps the formal signal present when execution data is not yet available", () => {
    const candles4h = Array.from({ length: 70 }, (_, index) =>
      makeCandle("4h", index, index === 60 ? { close: 200, high: 201, low: 199 } : undefined),
    );
    expect(evaluateR5H15({ symbol: "BTCUSDT", candles4h, candles1h: [], currentIndex: 60 }).status).toBe("SIGNAL");
  });

  it("uses actual entry fill for the fixed 2 ATR / 3R contract", () => {
    const plan = calculateR5RiskPlan({ direction: "LONG", entryFill: 100, atr: 2, stopAtrMultiple: 2, takeProfitR: 3, maxHeldCandles: 48 });
    expect(plan).toMatchObject({ stopPrice: 96, stopDistance: 4, takeProfitPrice: 112, maxHeldCandles: 48 });
  });
});

describe("H16 neutral mean reversion", () => {
  it("accepts exactly the 0.50 neutral boundary and rejects values above it", () => {
    expect(h16NeutralRegime(100, 99, 2)).toBe(true);
    expect(h16NeutralRegime(100, 98.99, 2)).toBe(false);
  });

  it("freezes exact 1.50 ATR and RSI 30/70 thresholds", () => {
    expect(h16MeanReversionDirection({ neutral: true, currentClose: 97, ema20: 100, atr14: 2, rsi14: 30 })).toBe("LONG");
    expect(h16MeanReversionDirection({ neutral: true, currentClose: 97.0001, ema20: 100, atr14: 2, rsi14: 30 })).toBeNull();
    expect(h16MeanReversionDirection({ neutral: true, currentClose: 103, ema20: 100, atr14: 2, rsi14: 70 })).toBe("SHORT");
    expect(h16MeanReversionDirection({ neutral: true, currentClose: 102.9999, ema20: 100, atr14: 2, rsi14: 70 })).toBeNull();
  });

  it("keeps the decision EMA20 target fixed and fails closed on invalid geometry", () => {
    expect(h16TargetGeometry("LONG", 101, 100)).toBe(true);
    expect(h16TargetGeometry("LONG", 100, 100)).toBe(false);
    expect(h16TargetGeometry("SHORT", 99, 100)).toBe(true);
    expect(h16TargetGeometry("SHORT", 100, 100)).toBe(false);
  });

  it("does not let future 1H candles change the formal H16 decision", () => {
    const candles4h = Array.from({ length: 60 }, (_, index) => makeCandle("4h", index, { open: 100, high: 101, low: 99, close: 100 }));
    const decisionCandles = Array.from({ length: 240 }, (_, index) => makeCandle("1h", index, { open: 100, high: 101, low: 99, close: 100 }));
    decisionCandles[239] = makeCandle("1h", 239, { open: 100, high: 100, low: 95, close: 95 });
    const withFuture = [...decisionCandles, makeCandle("1h", 240, { open: 1, high: 2, low: 0.5, close: 1 })];
    const withFutureModified = [...decisionCandles, makeCandle("1h", 240, { open: 10_000, high: 11_000, low: 9_000, close: 10_500 })];
    const withoutFuture = evaluateR5H16({ symbol: "BTCUSDT", candles4h, candles1h: decisionCandles, currentIndex: 239 });
    const normalFuture = evaluateR5H16({ symbol: "BTCUSDT", candles4h, candles1h: withFuture, currentIndex: 239 });
    const modifiedFuture = evaluateR5H16({ symbol: "BTCUSDT", candles4h, candles1h: withFutureModified, currentIndex: 239 });
    expect(withoutFuture).toEqual(normalFuture);
    expect(withoutFuture).toEqual(modifiedFuture);
    expect(withoutFuture.status).toBe("SIGNAL");
  });

  it("freezes the 12-held-candle contract and actual-entry risk geometry", () => {
    const plan = calculateR5RiskPlan({ direction: "SHORT", entryFill: 100, atr: 2, stopAtrMultiple: 1.5, takeProfitR: 3, maxHeldCandles: 12 });
    expect(plan).toMatchObject({ stopPrice: 103, stopDistance: 3, takeProfitPrice: 91, maxHeldCandles: 12 });
  });

  it("keeps the formal signal when adverse entry slippage crosses the fixed target", () => {
    const signal = {
      candidateId: "R5-H16-NEUTRAL-MEAN-REVERSION" as const,
      hypothesisId: "H16_NEUTRAL_REGIME_MEAN_REVERSION" as const,
      symbol: "BTCUSDT" as const,
      direction: "LONG" as const,
      signalTime: 0,
      decisionAtr: 2,
      stopAtrMultiple: 1.5,
      takeProfitR: "FIXED_DECISION_EMA20" as const,
      maxHeldCandles: 12,
      fixedTargetPrice: 100,
    };
    const crossing = resolveR5Entry({ signal, candles1h: [makeCandle("1h", 1, { open: 99.99 })] });
    expect(crossing.status).toBe("INVALID_TARGET_GEOMETRY");
    expect(crossing.signal).toEqual(signal);
    const safe = resolveR5Entry({ signal, candles1h: [makeCandle("1h", 1, { open: 99 })] });
    expect(safe.status).toBe("EXECUTION_READY");
    if (safe.status === "EXECUTION_READY") expect(safe.riskPlan.takeProfitPrice).toBe(100);
  });
});

describe("H17 funding qualification and reversal", () => {
  it("generates the exact UTC 00/08/16 canonical slot grid", () => {
    expect(canonicalFundingSlots(0, 16 * HOUR)).toEqual([0, 8 * HOUR, 16 * HOUR]);
    expect(() => canonicalFundingSlots(HOUR, 16 * HOUR)).toThrow();
  });

  it("requires all five symbols and proves complete canonical coverage without rate statistics", () => {
    const report = createH17QualificationReport({
      sourceSha: "b".repeat(40),
      researchRoundId: M3_R5_RESEARCH_ROUND_ID,
      startTime: M3_R5_RESEARCH_RANGE.startTime,
      endTime: M3_R5_RESEARCH_RANGE.endTime,
      symbols: makeFrozenH17Inputs(),
    });
    expect(report.qualificationStatus).toBe("COMPLETE");
    expect(report.h17DataQualification).toBe("PASS");
    expect(report.symbols).toHaveLength(5);
    const serialized = serializeH17QualificationReport(report);
    expect(serialized).not.toContain("fundingRate");
    for (const forbiddenField of [
      '"fundingRate"',
      '"fundingMin"',
      '"fundingMax"',
      '"fundingMean"',
      '"fundingMedian"',
      '"fundingQuantile"',
      '"distribution"',
      '"thresholdHitCount"',
      '"signalCount"',
      '"performance"',
    ]) expect(serialized).not.toContain(forbiddenField);
    expect(serializeH17QualificationReport(report)).toBe(serialized);
  });

  it("classifies a missing canonical slot as DATA_NOT_AVAILABLE", () => {
    const inputs = makeSmallH17Inputs();
    inputs[0] = makeH17Input("BTCUSDT", [0, 8 * HOUR], undefined, true, 0, 16 * HOUR);
    const result = qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: inputs });
    expect(result[0]!.qualificationStatus).toBe("DATA_NOT_AVAILABLE");
    expect(result[0]!.missingCanonicalSlotCount).toBe(1);
  });

  it("classifies duplicates as DATA_NOT_AVAILABLE", () => {
    const slots = canonicalFundingSlots(0, 16 * HOUR);
    const duplicate = [
      { symbol: "BTCUSDT" as const, fundingTime: slots[0]!, fundingRate: 0 },
      { symbol: "BTCUSDT" as const, fundingTime: slots[0]!, fundingRate: 0 },
      { symbol: "BTCUSDT" as const, fundingTime: slots[1]!, fundingRate: 0 },
      { symbol: "BTCUSDT" as const, fundingTime: slots[2]!, fundingRate: 0 },
    ];
    const inputs = makeSmallH17Inputs();
    inputs[0] = makeH17Input("BTCUSDT", slots, duplicate);
    const result = qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: inputs });
    expect(result[0]!.duplicateSlotCount).toBe(1);
    expect(result[0]!.qualificationStatus).toBe("DATA_NOT_AVAILABLE");
  });

  it("rejects malformed timestamps and invalid manifest provenance", () => {
    const slots = canonicalFundingSlots(0, 16 * HOUR);
    const malformedInputs = makeSmallH17Inputs();
    malformedInputs[0] = makeH17Input("BTCUSDT", slots, [
      { symbol: "BTCUSDT", fundingTime: Number.NaN, fundingRate: 0 },
      ...slots.slice(1).map((fundingTime) => ({ symbol: "BTCUSDT" as const, fundingTime, fundingRate: 0 })),
    ]);
    const malformedResult = qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: malformedInputs });
    expect(malformedResult[0]!.qualificationStatus).toBe("DATA_NOT_AVAILABLE");

    const invalidManifestInputs = makeSmallH17Inputs();
    invalidManifestInputs[0] = {
      ...invalidManifestInputs[0]!,
      manifest: { ...invalidManifestInputs[0]!.manifest, sha256: "not-a-sha" },
    };
    const invalidManifestResult = qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: invalidManifestInputs });
    expect(invalidManifestResult[0]!.qualificationStatus).toBe("DATA_NOT_AVAILABLE");
  });

  it("requires the exact full-record funding checksum and manifest provenance", () => {
    const cases: readonly [string, (manifest: H17QualificationInput["manifest"]) => H17QualificationInput["manifest"]][] = [
      ["forged checksum", (manifest) => ({ ...manifest, sha256: "f".repeat(64) })],
      ["wrong symbol", (manifest) => ({ ...manifest, symbol: "ETHUSDT" })],
      ["wrong provider", (manifest) => ({ ...manifest, provider: "other-provider" as never })],
      ["wrong source", (manifest) => ({ ...manifest, source: "/wrong" as never })],
      ["wrong requested range", (manifest) => ({ ...manifest, requestedStartTime: 1 })],
      ["wrong row count", (manifest) => ({ ...manifest, rowCount: manifest.rowCount + 1 })],
    ];
    for (const [label, mutate] of cases) {
      const inputs = makeSmallH17Inputs();
      inputs[0] = { ...inputs[0]!, manifest: mutate(inputs[0]!.manifest) };
      const result = qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: inputs });
      expect(result[0]!.qualificationStatus, label).toBe("DATA_NOT_AVAILABLE");
    }
    const valid = makeSmallH17Inputs()[0]!;
    const validResult = qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: makeSmallH17Inputs() });
    expect(validResult[0]!.manifestChecksumVerified).toBe(true);
    expect(valid.manifest.sha256).toHaveLength(64);
  });

  it("allows extra noncanonical records without allowing them to create alpha", () => {
    const slots = canonicalFundingSlots(0, 16 * HOUR);
    const records = [
      { symbol: "BTCUSDT" as const, fundingTime: slots[0]!, fundingRate: 0 },
      { symbol: "BTCUSDT" as const, fundingTime: HOUR, fundingRate: 1 },
      { symbol: "BTCUSDT" as const, fundingTime: slots[1]!, fundingRate: 0 },
      { symbol: "BTCUSDT" as const, fundingTime: slots[2]!, fundingRate: 0 },
    ];
    const inputs = makeSmallH17Inputs();
    inputs[0] = makeH17Input("BTCUSDT", slots, records);
    const result = qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: inputs });
    expect(result[0]!.qualificationStatus).toBe("PASS");
    expect(result[0]!.extraNonCanonicalCount).toBe(1);
    expect(h17FundingDirection(0.0001999)).toBeNull();
    expect(h17FundingDirection(0.0002)).toBe("SHORT");
    expect(h17FundingDirection(-0.0002)).toBe("LONG");
  });

  it("requires completed pagination and valid manifest provenance", () => {
    const inputs = makeSmallH17Inputs();
    inputs[0] = makeH17Input("BTCUSDT", canonicalFundingSlots(0, 16 * HOUR), undefined, false);
    expect(() => qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: inputs })).toThrow("RETRIEVAL_ABORT");
    const inconsistent = makeSmallH17Inputs();
    inconsistent[0] = {
      ...inconsistent[0]!,
      pagination: { ...inconsistent[0]!.pagination, finalCursor: 0 },
    };
    expect(() => qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: inconsistent })).toThrow("RETRIEVAL_ABORT");
  });

  it("classifies an API failure on page N as retrieval abort before any artifact", async () => {
    let calls = 0;
    const loader = new BinanceHistoricalDataLoader({
      fundingLimit: 1,
      clientOptions: {
        fetchImpl: async () => {
          calls += 1;
          if (calls === 1) return new Response(JSON.stringify([{ symbol: "BTCUSDT", fundingTime: 0, fundingRate: "0.001" }]), { status: 200 });
          throw new Error("page N failed");
        },
      },
    });
    await expect(loader.loadFunding({ symbol: "BTCUSDT", range: { startTime: 0, endTime: HOUR }, policy: "bt-policy-003" })).rejects.toMatchObject({ code: "DATA_INCOMPLETE" });
    expect(calls).toBeGreaterThan(1);
    expect(existsSync(M3_R5_H17_OUTPUT_PATHS.json)).toBe(false);
    expect(existsSync(M3_R5_H17_OUTPUT_PATHS.markdown)).toBe(false);
  });

  it("freezes the formal signal before resolving the first 1H open", () => {
    const candles = Array.from({ length: 22 }, (_, index) => makeCandle("1h", index));
    const fundingTime = 20 * HOUR;
    const result = evaluateR5H17({
      record: { symbol: "BTCUSDT", fundingTime, fundingRate: 0.0002 },
      h17DataQualification: "PASS",
      candles1h: candles,
    });
    expect(result.status).toBe("SIGNAL");
    if (result.status !== "SIGNAL") return;
    expect(result.signal.direction).toBe("SHORT");
    expect(Object.hasOwn(result.signal, "entryOpenTime")).toBe(false);
    expect(result.signal.stopAtrMultiple).toBe(1.5);
    expect(result.signal.takeProfitR).toBe(3);
    expect(result.signal.maxHeldCandles).toBe(24);
    const execution = resolveR5Entry({ signal: result.signal, candles1h: candles });
    expect(execution.status).toBe("EXECUTION_READY");
    if (execution.status === "EXECUTION_READY") expect(execution.entryOpenTime).toBe(21 * HOUR);
    expect(evaluateR5H17({
      record: { symbol: "BTCUSDT", fundingTime, fundingRate: 0.0002 },
      h17DataQualification: "PASS",
      candles1h: candles.slice(0, 21),
    })).toEqual(result);
    expect(evaluateR5H17({
      record: { symbol: "BTCUSDT", fundingTime, fundingRate: 0.0002 },
      h17DataQualification: "PASS",
      candles1h: [...candles.slice(0, 21), makeCandle("1h", 21, { open: 10_000, close: 10_500 })],
    })).toEqual(result);
  });

  it("blocks H17 when qualification is not PASS", () => {
    const result = evaluateR5H17({ record: { symbol: "BTCUSDT", fundingTime: 0, fundingRate: 1 }, h17DataQualification: "DATA_NOT_AVAILABLE", candles1h: [] });
    expect(result).toEqual({ status: "NO_SIGNAL", reason: "H17_DATA_NOT_AVAILABLE" });
  });
});

describe("H18 compression to expansion", () => {
  it("freezes six compression candles, .75 boundary, 1.50 expansion, and prior-12 strict breakout", () => {
    expect(h18CompressionPass([0.75, 0.75, 0.75, 0.75, 0.75, 0.75], [1, 1, 1, 1, 1, 1])).toBe(true);
    expect(h18CompressionPass([0.7501, 0.75, 0.75, 0.75, 0.75, 0.75], [1, 1, 1, 1, 1, 1])).toBe(false);
    expect(h18ExpansionPass(1.5, 1)).toBe(true);
    expect(h18ExpansionPass(1.4999, 1)).toBe(false);
    expect(h18BreakoutDirection(10, 10, 0)).toBeNull();
    expect(h18BreakoutDirection(10.0001, 10, 0)).toBe("LONG");
    expect(h18BreakoutDirection(-0.0001, 10, 0)).toBe("SHORT");
  });

  it("evaluates a synthetic 1H compression/expansion signal without future candles", () => {
    const candles = Array.from({ length: 48 }, (_, index) => {
      if (index >= 40 && index <= 45) {
        const close = 140 + index - 40;
        return makeCandle("1h", index, { close, high: close + 1, low: close - 1 });
      }
      if (index === 46) return makeCandle("1h", index, { close: 220, high: 224, low: 216 });
      return makeCandle("1h", index, { close: 100 + index, high: 102 + index, low: 98 + index });
    });
    const result = evaluateR5H18({ symbol: "BTCUSDT", candles1h: candles, currentIndex: 46 });
    const withoutFuture = evaluateR5H18({ symbol: "BTCUSDT", candles1h: candles.slice(0, 47), currentIndex: 46 });
    const modifiedFuture = evaluateR5H18({
      symbol: "BTCUSDT",
      candles1h: [...candles.slice(0, 47), makeCandle("1h", 47, { open: 10_000, high: 11_000, low: 9_000, close: 10_500 })],
      currentIndex: 46,
    });
    expect(result.status).toBe("SIGNAL");
    expect(withoutFuture).toEqual(result);
    expect(modifiedFuture).toEqual(result);
    if (result.status !== "SIGNAL") return;
    expect(Object.hasOwn(result.signal, "entryOpenTime")).toBe(false);
    expect(result.signal.stopAtrMultiple).toBe(1.5);
    expect(result.signal.takeProfitR).toBe(3);
    expect(result.signal.maxHeldCandles).toBe(24);
  });
});

describe("M3-R5 H17 preflight and publication", () => {
  it("requires explicit authorization, exact source/range, clean worktree, and absent outputs", () => {
    const base = {
      headSha: "a".repeat(40),
      requestedSourceSha: "a".repeat(40),
      round: M3_R5_RESEARCH_ROUND_ID,
      startTime: M3_R5_RESEARCH_RANGE.startTime,
      endTime: M3_R5_RESEARCH_RANGE.endTime,
      cleanWorktree: true,
      existingOutputArtifacts: [],
      confirmAuthoritativeQualification: true,
    };
    expect(() => assertH17QualificationPreflight(base)).not.toThrow();
    expect(() => assertH17QualificationPreflight({ ...base, confirmAuthoritativeQualification: false })).toThrow("no network access");
    expect(() => assertH17QualificationPreflight({ ...base, existingOutputArtifacts: [M3_R5_H17_OUTPUT_PATHS.json] })).toThrow("already exist");
    expect(() => assertH17QualificationPreflight({ ...base, startTime: base.startTime + HOUR })).toThrow("frozen Round-005 range");
  });

  it("parses the future CLI contract without executing it", () => {
    const args = parseM3R5H17QualificationArguments([
      "--confirm-authoritative-qualification",
      "--source-sha", "a".repeat(40),
      "--round", M3_R5_RESEARCH_ROUND_ID,
      "--start-time", String(M3_R5_RESEARCH_RANGE.startTime),
      "--end-time", String(M3_R5_RESEARCH_RANGE.endTime),
    ]);
    expect(args.confirmAuthoritativeQualification).toBe(true);
    expect(args.startTime).toBe(M3_R5_RESEARCH_RANGE.startTime);
    expect(() => parseM3R5H17QualificationArguments([])).toThrow("missing --source-sha");
  });

  it("publishes exact bytes Markdown-first and JSON-last with destination-local staging", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".m3-r5-b1a-publish-"));
    const jsonPath = path.join(root, "evidence", "qualification.json");
    const markdownPath = path.join(root, "qualification.md");
    const jsonBytes = Buffer.from("{\"status\":\"COMPLETE\"}\n", "utf8");
    const markdownBytes = Buffer.from("# qualification\n", "utf8");
    const order: string[] = [];
    let stagingDirectory = "";
    try {
      publishH17QualificationArtifactsAtomically({
        jsonPath,
        markdownPath,
        jsonBytes,
        markdownBytes,
        onStagingDirectory: (directory) => { stagingDirectory = directory; },
        renameFile: (source, destination) => { order.push(String(destination)); renameSync(source, destination); },
      });
      expect(order).toEqual([markdownPath, jsonPath]);
      expect(readBytes(markdownPath)).toEqual(markdownBytes);
      expect(readBytes(jsonPath)).toEqual(jsonBytes);
      expect(path.dirname(stagingDirectory)).toBe(path.dirname(jsonPath));
      expect(existsSync(stagingDirectory)).toBe(false);
      expect(h17QualificationRawSha256(jsonBytes)).toHaveLength(64);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back all destinations when JSON publication fails", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".m3-r5-b1a-publish-"));
    const jsonPath = path.join(root, "evidence", "qualification.json");
    const markdownPath = path.join(root, "qualification.md");
    let stagingDirectory = "";
    let renameCount = 0;
    try {
      expect(() => publishH17QualificationArtifactsAtomically({
        jsonPath,
        markdownPath,
        jsonBytes: Buffer.from("json"),
        markdownBytes: Buffer.from("markdown"),
        onStagingDirectory: (directory) => { stagingDirectory = directory; },
        renameFile: (source, destination) => {
          renameCount += 1;
          if (renameCount === 2) throw new Error("JSON publication failed");
          renameSync(source, destination);
        },
      })).toThrow("JSON publication failed");
      expect(existsSync(markdownPath)).toBe(false);
      expect(existsSync(jsonPath)).toBe(false);
      expect(existsSync(stagingDirectory)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects pre-existing output before staging and preserves its bytes", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".m3-r5-b1a-publish-"));
    const jsonPath = path.join(root, "evidence", "qualification.json");
    const markdownPath = path.join(root, "qualification.md");
    const oldBytes = Buffer.from("old\n");
    mkdirSync(path.dirname(markdownPath), { recursive: true });
    writeFileSync(markdownPath, oldBytes);
    let stagingDirectory = "";
    try {
      expect(() => publishH17QualificationArtifactsAtomically({
        jsonPath,
        markdownPath,
        jsonBytes: Buffer.from("new json"),
        markdownBytes: Buffer.from("new markdown"),
        onStagingDirectory: (directory) => { stagingDirectory = directory; },
      })).toThrow("refusing overwrite");
      expect(readBytes(markdownPath)).toEqual(oldBytes);
      expect(existsSync(jsonPath)).toBe(false);
      expect(stagingDirectory).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not call os.tmpdir and does not invoke performance/network paths", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".m3-r5-b1a-publish-"));
    const jsonPath = path.join(root, "evidence", "qualification.json");
    const markdownPath = path.join(root, "qualification.md");
    try {
      publishH17QualificationArtifactsAtomically({ jsonPath, markdownPath, jsonBytes: Buffer.from("json"), markdownBytes: Buffer.from("markdown") });
      expect(readFileSync("src/lib/research/m3-r5-h17-funding-qualification.ts", "utf8")).not.toContain("os.tmpdir");
      expect(readFileSync("src/lib/research/m3-r5-h17-funding-qualification.ts", "utf8")).not.toContain("tmpdir(");
      expect(readFileSync("src/lib/research/m3-r5-h17-funding-qualification.ts", "utf8")).not.toContain("fetch(");
      const script = readFileSync("scripts/m3-r5-h17-qualify.ts", "utf8");
      expect(script).not.toContain("research:m3r4:performance");
      expect(script).not.toContain("runBacktest");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the reserved B.1A outputs absent", () => {
    expect(existsSync(M3_R5_H17_OUTPUT_PATHS.json)).toBe(false);
    expect(existsSync(M3_R5_H17_OUTPUT_PATHS.markdown)).toBe(false);
    expect(renderH17QualificationMarkdown).toBeTypeOf("function");
  });
});
