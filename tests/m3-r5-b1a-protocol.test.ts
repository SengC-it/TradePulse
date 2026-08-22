import { readFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync as readBytes, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
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

function makeH17Manifest(startTime: number, endTime: number, rowCount: number) {
  return {
    provider: "binance-usdm-public" as const,
    source: "/fapi/v1/fundingRate" as const,
    requestedStartTime: startTime,
    requestedEndTime: endTime,
    actualStartTime: rowCount > 0 ? startTime : null,
    actualEndTime: rowCount > 0 ? endTime : null,
    rowCount,
    sha256: "a".repeat(64),
  };
}

function makeH17Input(symbol: ResearchSymbol, slots: readonly number[], records = slots.map((fundingTime) => ({ symbol, fundingTime, fundingRate: 0.0001 })), paginationComplete = true, requestedStartTime = slots[0] ?? 0, requestedEndTime = slots[slots.length - 1] ?? 0): H17QualificationInput {
  return {
    symbol,
    records,
    paginationComplete,
    pageCount: 1,
    manifest: makeH17Manifest(requestedStartTime, requestedEndTime, records.length),
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
  it("uses the prior 20 4H candles, strict breakout, 4H signal time, and next-open entry", () => {
    const candles4h = Array.from({ length: 70 }, (_, index) =>
      makeCandle("4h", index, index === 60 ? { close: 200, high: 201, low: 199 } : undefined),
    );
    const signalCandle = candles4h[60]!;
    const candles1h = [makeCandle("1h", 0, { open: 1 })];
    candles1h[0] = { ...candles1h[0]!, openTime: signalCandle.closeTime + 1, closeTime: signalCandle.closeTime + HOUR };
    const result = evaluateR5H15({ symbol: "BTCUSDT", candles4h, candles1h, currentIndex: 60 });
    expect(result.status).toBe("SIGNAL");
    if (result.status !== "SIGNAL") return;
    expect(result.signal.direction).toBe("LONG");
    expect(result.signal.signalTime).toBe(signalCandle.closeTime);
    expect(result.signal.entryOpenTime).toBe(signalCandle.closeTime + 1);
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

  it("fails closed when no strictly later entry candle exists", () => {
    const candles4h = Array.from({ length: 60 }, (_, index) => makeCandle("4h", index));
    const result = evaluateR5H15({ symbol: "BTCUSDT", candles4h, candles1h: [makeCandle("1h", 0)], currentIndex: 59 });
    expect(result.status).toBe("NO_SIGNAL");
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

  it("freezes the 12-held-candle contract and actual-entry risk geometry", () => {
    const plan = calculateR5RiskPlan({ direction: "SHORT", entryFill: 100, atr: 2, stopAtrMultiple: 1.5, takeProfitR: 3, maxHeldCandles: 12 });
    expect(plan).toMatchObject({ stopPrice: 103, stopDistance: 3, takeProfitPrice: 91, maxHeldCandles: 12 });
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
    expect(serialized).not.toMatch(/min|max|mean|median|quantile|distribution|threshold-hit|signal count|performance/iu);
    expect(serializeH17QualificationReport(report)).toBe(serialized);
  });

  it("classifies a missing canonical slot as DATA_NOT_AVAILABLE", () => {
    const inputs = makeSmallH17Inputs();
    inputs[0] = makeH17Input("BTCUSDT", [0, 8 * HOUR]);
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
    const result = qualifyH17FundingUniverse({ startTime: 0, endTime: 16 * HOUR, symbols: inputs });
    expect(result[0]!.paginationComplete).toBe(false);
    expect(result[0]!.qualificationStatus).toBe("DATA_NOT_AVAILABLE");
  });

  it("uses the first 1H open strictly after funding time and preserves 1.5 ATR/3R/24h", () => {
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
    expect(result.signal.entryOpenTime).toBe(21 * HOUR);
    expect(result.signal.stopAtrMultiple).toBe(1.5);
    expect(result.signal.takeProfitR).toBe(3);
    expect(result.signal.maxHeldCandles).toBe(24);
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
    expect(result.status).toBe("SIGNAL");
    if (result.status !== "SIGNAL") return;
    expect(result.signal.entryOpenTime).toBe(candles[47]!.openTime);
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
