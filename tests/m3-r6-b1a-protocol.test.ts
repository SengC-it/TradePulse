import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import {
  M3_R6_PERFORMANCE_LOCK,
  M3_R6_POST_LOCK_INVALIDATION,
  M3_R6_RESEARCH_END_ISO,
  M3_R6_RESEARCH_RANGE,
  M3_R6_RESEARCH_ROUND_ID,
  R6_CANDIDATE_REGISTRY,
  R6_COMPLEXITY_TUPLES,
  R6_DATA_CONTRACT,
  R6_FROZEN_FOLD_IDS,
  R6_FORMULA_DEFINITIONS,
  R6_GATE_INHERITANCE,
  R6_H21_PARAMETERS,
  R6_H22_ROUTE_MAP,
  R6_SYMBOLS,
  evaluateR6H19,
  evaluateR6H20,
  evaluateR6H21,
  evaluateR6H22,
  classifyR6H22Regime,
  resolveR6NextOpenEntry,
} from "../src/lib/research/m3-r6-round-006-protocol.ts";

const HOUR = 60 * 60 * 1000;
const FOUR_HOURS = 4 * HOUR;
const BASE = Date.parse("2024-01-01T00:00:00.000Z");

function makeCandle(input: Readonly<{
  symbol?: ResearchSymbol;
  timeframe?: "1h" | "4h";
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}>): Candle {
  const interval = input.timeframe === "4h" ? FOUR_HOURS : HOUR;
  return {
    symbol: input.symbol ?? "BTCUSDT",
    timeframe: input.timeframe ?? "1h",
    openTime: input.openTime,
    closeTime: input.openTime + interval - 1,
    open: input.open,
    high: input.high,
    low: input.low,
    close: input.close,
    volume: 100,
    quoteVolume: 100,
    tradeCount: 1,
    takerBuyBaseVolume: 50,
    takerBuyQuoteVolume: 50,
  };
}

function simpleSeries(symbol: ResearchSymbol, count: number, startTime = BASE): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const price = 100 + index;
    return makeCandle({
      symbol,
      openTime: startTime + index * HOUR,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
    });
  });
}

function h19Snapshot(symbol: ResearchSymbol, finalClose: number): readonly Candle[] {
  const candles = simpleSeries(symbol, 25);
  const last = candles.at(-1)!;
  candles[0] = makeCandle({ symbol, openTime: BASE, open: 100, high: 101, low: 99, close: 100 });
  candles[24] = makeCandle({
    symbol,
    openTime: last.openTime,
    open: finalClose,
    high: finalClose + 1,
    low: finalClose - 1,
    close: finalClose,
  });
  return candles;
}

function h20Input() {
  const candles4h = [
    makeCandle({ timeframe: "4h", openTime: BASE, open: 100, high: 105, low: 95, close: 101 }),
    makeCandle({ timeframe: "4h", openTime: BASE + FOUR_HOURS, open: 110, high: 115, low: 105, close: 111 }),
    makeCandle({ timeframe: "4h", openTime: BASE + 2 * FOUR_HOURS, open: 120, high: 125, low: 115, close: 121 }),
  ];
  const startTime = BASE + 13 * HOUR;
  const candles1h = [
    makeCandle({ openTime: startTime, open: 130, high: 136, low: 129, close: 135 }),
    makeCandle({ openTime: startTime + HOUR, open: 135, high: 136, low: 132, close: 134 }),
    makeCandle({ openTime: startTime + 2 * HOUR, open: 134, high: 135, low: 131, close: 133 }),
    makeCandle({ openTime: startTime + 3 * HOUR, open: 133, high: 141, low: 132, close: 140 }),
  ];
  return { symbol: "BTCUSDT" as const, candles1h, candles4h, decisionTime: candles1h.at(-1)!.closeTime };
}

function h21Input(rangeFraction: number, closeLocation = 0.8) {
  const open = 1_000;
  const low = open - 10;
  const range = open * rangeFraction;
  const high = low + range;
  const close = low + range * closeLocation;
  const candle = makeCandle({ openTime: BASE, open, high, low, close });
  return { symbol: "BTCUSDT" as const, candles1h: [candle], decisionTime: candle.closeTime };
}

function h22Input() {
  const candles4h = [
    makeCandle({ timeframe: "4h", openTime: BASE, open: 100, high: 105, low: 99, close: 101 }),
    makeCandle({ timeframe: "4h", openTime: BASE + FOUR_HOURS, open: 110, high: 115, low: 109, close: 111 }),
    makeCandle({ timeframe: "4h", openTime: BASE + 2 * FOUR_HOURS, open: 120, high: 125, low: 119, close: 121 }),
  ];
  const startTime = BASE + 13 * HOUR;
  const candles1h = [
    makeCandle({ openTime: startTime, open: 130, high: 132, low: 129, close: 131 }),
    makeCandle({ openTime: startTime + HOUR, open: 131, high: 141, low: 130, close: 140 }),
  ];
  return { symbol: "BTCUSDT" as const, candles1h, candles4h, decisionTime: candles1h.at(-1)!.closeTime };
}

describe("M3-R6-B.1A machine-readable protocol", () => {
  it("freezes the Round-006 boundary, universe, folds, and four one-variant candidates", () => {
    expect(M3_R6_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-006");
    expect(M3_R6_RESEARCH_END_ISO).toBe("2026-08-15T23:59:59.999Z");
    expect(M3_R6_RESEARCH_RANGE).toMatchObject({
      startTime: Date.parse("2023-01-01T00:00:00.000Z"),
      endTime: Date.parse("2026-08-15T23:59:59.999Z"),
      classification: "RESEARCH_AVAILABLE_SEEN_DATA",
    });
    expect(R6_SYMBOLS).toEqual(RESEARCH_SYMBOLS);
    expect(R6_FROZEN_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(R6_CANDIDATE_REGISTRY.map((candidate) => candidate.candidateId)).toEqual([
      "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
      "R6-H20-STRUCTURAL-TREND-CONTINUATION",
      "R6-H21-ECONOMIC-RANGE-IMPULSE",
      "R6-H22-PREDECLARED-REGIME-ROUTING",
    ]);
    expect(R6_CANDIDATE_REGISTRY.every((candidate) => candidate.variantCount === 1)).toBe(true);
    expect(Object.values(R6_COMPLEXITY_TUPLES).every((tuple) => tuple.mechanismFamiliesUsed === 1)).toBe(true);
  });

  it("inherits the named gates without creating a final Gate or Plan", () => {
    expect(R6_GATE_INHERITANCE.numericValues).toBe("DEFERRED_TO_B1B;NO_GATE_SHA_CREATED_IN_B1A");
    expect(R6_GATE_INHERITANCE.requiredGateNames).toEqual([
      "minimumAggregateImprovement",
      "minimumImprovedValidationFolds",
      "catastrophicFoldLimit",
      "minimumNetExpectancy",
      "minimumProfitFactor",
      "maximumSymbolConcentration",
      "maximumSingleTradeConcentration",
      "maximumFeeBurdenRatio",
      "minimumFormalSignals",
      "minimumExecutedTrades",
    ]);
    expect(M3_R6_PERFORMANCE_LOCK).toBe("FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED");
    expect(M3_R6_POST_LOCK_INVALIDATION).toBe("ROUND_006_INVALIDATION_REQUIRED");
  });

  it("freezes the existing Candle data contract and closed-only timing", () => {
    expect(R6_DATA_CONTRACT.common.fields).toEqual([
      "symbol", "timeframe", "openTime", "closeTime", "open", "high", "low", "close",
      "volume", "quoteVolume", "tradeCount", "takerBuyBaseVolume", "takerBuyQuoteVolume",
    ]);
    expect(R6_DATA_CONTRACT.common.missingData).toBe("DATA_INCOMPLETE");
    expect(R6_DATA_CONTRACT.common.futureData).toContain("NEVER_USED_FOR_SIGNAL_FORMATION");
    expect(R6_FORMULA_DEFINITIONS.h19.cadence).toContain("first_closed_1h_candle_opening_at_each_utc_4h_block");
    expect(R6_DATA_CONTRACT.common.fieldValidation).toContain("tradeCount_NON_NEGATIVE_INTEGER");
    expect(R6_DATA_CONTRACT.common.continuity).toContain("STRICTLY_CONTIGUOUS");
    expect(R6_FORMULA_DEFINITIONS.h19.laggard).toBe("argmin(return_s, tie=symbol_DESC)");
    expect(R6_FORMULA_DEFINITIONS.h21.event).toContain("8 * (2*feeRate + 2*slippageRate)");
  });
});

describe("R6-H19 cross-sectional relative strength", () => {
  it("ranks the synchronized five-symbol universe and handles ties deterministically", () => {
    const snapshots = RESEARCH_SYMBOLS.map((symbol) => ({
      symbol,
      candles1h: h19Snapshot(symbol,
        symbol === "BNBUSDT" ? 120
          : symbol === "BTCUSDT" ? 110
            : symbol === "SOLUSDT" || symbol === "XRPUSDT" ? 80
              : 100),
    }));
    const result = evaluateR6H19({ decisionTime: snapshots[0]!.candles1h.at(-1)!.closeTime, snapshots });
    expect(result.status).toBe("SIGNALS");
    if (result.status !== "SIGNALS") return;
    expect(result.signals.map((signal) => [signal.symbol, signal.direction])).toEqual([
      ["BNBUSDT", "LONG"],
      ["XRPUSDT", "SHORT"],
    ]);
    expect(result.signals.every((signal) => signal.signalTime === snapshots[0]!.candles1h.at(-1)!.closeTime)).toBe(true);
  });

  it("fails closed when any required symbol or synchronized lookback is absent", () => {
    const complete = RESEARCH_SYMBOLS.map((symbol) => ({ symbol, candles1h: h19Snapshot(symbol, 100) }));
    const decisionTime = complete[0]!.candles1h.at(-1)!.closeTime;
    expect(evaluateR6H19({ decisionTime, snapshots: complete.slice(0, -1) }).status).toBe("DATA_INCOMPLETE");
    expect(evaluateR6H19({
      decisionTime,
      snapshots: complete.map((snapshot, index) => index === 0 ? { ...snapshot, candles1h: snapshot.candles1h.slice(1) } : snapshot),
    }).status).toBe("DATA_INCOMPLETE");
  });

  it("rejects internal gaps, duplicates, malformed duration, and timestamp-window mismatch", () => {
    const complete = RESEARCH_SYMBOLS.map((symbol) => ({ symbol, candles1h: h19Snapshot(symbol, 100) }));
    const decisionTime = complete[0]!.candles1h.at(-1)!.closeTime;
    const gap = complete.map((snapshot, snapshotIndex) => snapshotIndex === 0
      ? { ...snapshot, candles1h: snapshot.candles1h.filter((_candle, index) => index !== 12) }
      : snapshot);
    expect(evaluateR6H19({ decisionTime, snapshots: gap }).status).toBe("DATA_INCOMPLETE");

    const duplicate = complete.map((snapshot, snapshotIndex) => snapshotIndex === 0
      ? { ...snapshot, candles1h: [...snapshot.candles1h.slice(0, 12), snapshot.candles1h[11]!, ...snapshot.candles1h.slice(12)] }
      : snapshot);
    expect(evaluateR6H19({ decisionTime, snapshots: duplicate }).status).toBe("DATA_INCOMPLETE");

    const malformedDuration = complete.map((snapshot, snapshotIndex) => snapshotIndex === 0
      ? { ...snapshot, candles1h: snapshot.candles1h.map((candle, index) => index === 12 ? { ...candle, closeTime: candle.closeTime - 1 } : candle) }
      : snapshot);
    expect(evaluateR6H19({ decisionTime, snapshots: malformedDuration }).status).toBe("DATA_INCOMPLETE");

    const timestampMismatch = complete.map((snapshot, snapshotIndex) => snapshotIndex === 0
      ? { ...snapshot, candles1h: snapshot.candles1h.map((candle, index) => index === 0 ? { ...candle, openTime: candle.openTime + HOUR, closeTime: candle.closeTime + HOUR } : candle) }
      : snapshot);
    expect(evaluateR6H19({ decisionTime, snapshots: timestampMismatch }).status).toBe("DATA_INCOMPLETE");
  });

  it("fails closed when a declared Candle field is invalid", () => {
    const snapshots = RESEARCH_SYMBOLS.map((symbol) => ({ symbol, candles1h: h19Snapshot(symbol, 100) }));
    const invalid = snapshots.map((snapshot, index) => index === 0
      ? { ...snapshot, candles1h: snapshot.candles1h.map((candle, candleIndex) => candleIndex === 12 ? { ...candle, volume: Number.NaN } : candle) }
      : snapshot);
    expect(evaluateR6H19({ decisionTime: snapshots[0]!.candles1h.at(-1)!.closeTime, snapshots: invalid }).status).toBe("DATA_INCOMPLETE");
  });

  it("does not change when future candle values are mutated and separates next-open entry", () => {
    const snapshots = RESEARCH_SYMBOLS.map((symbol) => ({ symbol, candles1h: h19Snapshot(symbol, 100) }));
    const decisionTime = snapshots[0]!.candles1h.at(-1)!.closeTime;
    const result = evaluateR6H19({ decisionTime, snapshots });
    const future = makeCandle({ symbol: "BTCUSDT", openTime: decisionTime + 1, open: 50_000, high: 60_000, low: 40_000, close: 55_000 });
    const withFuture = evaluateR6H19({
      decisionTime,
      snapshots: snapshots.map((snapshot) => snapshot.symbol === "BTCUSDT" ? { ...snapshot, candles1h: [...snapshot.candles1h, future] } : snapshot),
    });
    expect(withFuture).toEqual(result);
    expect(result.status).toBe("SIGNALS");
    if (result.status !== "SIGNALS") return;
    const entryCandle = makeCandle({ symbol: result.signals[0]!.symbol, openTime: result.signals[0]!.signalTime + 1, open: 101, high: 102, low: 100, close: 101 });
    expect(resolveR6NextOpenEntry({ signal: result.signals[0]!, candles1h: [...snapshots[0]!.candles1h, entryCandle] }).status).toBe("READY");
  });
});

describe("R6-H20 structural trend continuation", () => {
  it("requires the exact three-4H / two-retracement / one-confirmation structure", () => {
    const input = h20Input();
    const result = evaluateR6H20(input);
    expect(result.status).toBe("SIGNALS");
    if (result.status !== "SIGNALS") return;
    expect(result.signals[0]).toMatchObject({
      candidateId: "R6-H20-STRUCTURAL-TREND-CONTINUATION",
      direction: "LONG",
      stopReference: "H20_RETRACEMENT_EXTREME",
      stopReferencePrice: 131,
    });
    expect(evaluateR6H20({ ...input, candles1h: [...input.candles1h, makeCandle({ openTime: input.decisionTime + 1, open: 1_000, high: 2_000, low: 500, close: 1_800 })] })).toEqual(result);
  });

  it("fails closed when the structural history is unavailable", () => {
    const input = h20Input();
    expect(evaluateR6H20({ ...input, candles4h: input.candles4h.slice(0, 2) }).status).toBe("DATA_INCOMPLETE");
    expect(evaluateR6H20({ ...input, candles1h: input.candles1h.slice(0, 3) }).status).toBe("DATA_INCOMPLETE");
  });

  it("rejects a structural 4H candle that overlaps the H20 event window", () => {
    const input = h20Input();
    const overlapStart = BASE + 9 * HOUR;
    const overlapCandles = input.candles1h.map((candle, index) => makeCandle({
      openTime: overlapStart + index * HOUR,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    const result = evaluateR6H20({ ...input, candles1h: overlapCandles, decisionTime: overlapCandles.at(-1)!.closeTime });
    expect(result).toMatchObject({ status: "NO_SIGNAL", reason: "H20_STRUCTURAL_EVENT_OVERLAP" });
  });

  it("proves H20 is not the retired EMA/pullback or H15 breakout family", () => {
    const protocol = readFileSync("docs/M3_R6_B1A_PROTOCOL.md", "utf8");
    const h20Section = protocol.slice(protocol.indexOf("## H20"), protocol.indexOf("## H21"));
    expect(h20Section).toContain("does not use EMA20/EMA50");
    expect(h20Section).toContain("20-candle");
    expect(h20Section).toContain("breakout window");
    expect(h20Section).toContain("If this predicate collapses");
    expect(h20Section).toContain("PROTOCOL_REJECTED");
    expect(h20Section).not.toContain("R6-H19");
  });
});

describe("R6-H21 economic range impulse", () => {
  it("uses one exact conjunction and accepts the frozen economic boundary", () => {
    const input = h21Input(0.016, 0.75);
    const result = evaluateR6H21(input);
    expect(R6_H21_PARAMETERS).toMatchObject({ closeLocationFraction: 0.75, moveToCostMultiple: 8 });
    expect(result.status).toBe("SIGNALS");
    if (result.status !== "SIGNALS") return;
    expect(result.signals[0]).toMatchObject({
      candidateId: "R6-H21-ECONOMIC-RANGE-IMPULSE",
      direction: "LONG",
      stopReferencePrice: 990,
    });
  });

  it("freezes actual-fill stop and 2R geometry for valid LONG and SHORT entries", () => {
    const longSignalResult = evaluateR6H21(h21Input(0.02, 0.8));
    expect(longSignalResult.status).toBe("SIGNALS");
    if (longSignalResult.status !== "SIGNALS") return;
    const longSignal = longSignalResult.signals[0]!;
    const longEntry = makeCandle({ symbol: "BTCUSDT", openTime: longSignal.signalTime + 1, open: 1_000, high: 1_002, low: 998, close: 1_000 });
    const longExecution = resolveR6NextOpenEntry({ signal: longSignal, candles1h: [...h21Input(0.02, 0.8).candles1h, longEntry] });
    expect(longExecution).toMatchObject({ status: "READY", rawEntryPrice: 1_000, actualEntryFill: 1_000.5, stopReferencePrice: 990, riskDistance: 10.5, takeProfitPrice: 1_021.5 });

    const shortCandle = makeCandle({ openTime: BASE, open: 1_000, high: 1_010, low: 990, close: 994 });
    const shortSignalResult = evaluateR6H21({ symbol: "BTCUSDT", candles1h: [shortCandle], decisionTime: shortCandle.closeTime });
    expect(shortSignalResult.status).toBe("SIGNALS");
    if (shortSignalResult.status !== "SIGNALS") return;
    const shortSignal = shortSignalResult.signals[0]!;
    const shortEntry = makeCandle({ symbol: "BTCUSDT", openTime: shortSignal.signalTime + 1, open: 1_000, high: 1_002, low: 998, close: 1_000 });
    const shortExecution = resolveR6NextOpenEntry({ signal: shortSignal, candles1h: [shortCandle, shortEntry] });
    expect(shortExecution).toMatchObject({ status: "READY", actualEntryFill: 999.5, stopReferencePrice: 1_010, riskDistance: 10.5, takeProfitPrice: 978.5 });
  });

  it.each([
    ["LONG fill equals stop", "LONG", 1_000.5],
    ["LONG fill below stop", "LONG", 1_001],
    ["SHORT fill equals stop", "SHORT", 999.5],
    ["SHORT fill above stop", "SHORT", 999],
  ] as const)("returns INVALID_STOP_GEOMETRY for %s", (_label, direction, stopReferencePrice) => {
    const candle = makeCandle({ openTime: BASE, open: 1_000, high: 1_010, low: 990, close: direction === "LONG" ? 1_006 : 994 });
    const baseSignal = {
      candidateId: "R6-H21-ECONOMIC-RANGE-IMPULSE" as const,
      hypothesisId: "R6-H21-ECONOMIC-RANGE-IMPULSE" as const,
      mechanismFamily: "ECONOMIC_RANGE_IMPULSE" as const,
      symbol: "BTCUSDT" as const,
      direction,
      signalTime: candle.closeTime,
      stopReference: "SIGNAL_CANDLE_OPPOSITE_EXTREME" as const,
      stopReferencePrice,
      takeProfitR: 2 as const,
      maxHeldCandles: 24 as const,
    };
    const entry = makeCandle({ symbol: "BTCUSDT", openTime: candle.closeTime + 1, open: 1_000, high: 1_002, low: 998, close: 1_000 });
    expect(resolveR6NextOpenEntry({ signal: baseSignal, candles1h: [candle, entry] })).toMatchObject({ status: "INVALID_STOP_GEOMETRY", reason: "STOP_NOT_PROTECTIVE_AFTER_SLIPPAGE" });
  });

  it("rejects a sub-cost range, weak close location, and equal open/close", () => {
    expect(evaluateR6H21(h21Input(0.01599, 0.8)).status).toBe("NO_SIGNAL");
    expect(evaluateR6H21(h21Input(0.02, 0.7499)).status).toBe("NO_SIGNAL");
    const equal = makeCandle({ openTime: BASE, open: 100, high: 102, low: 98, close: 100 });
    expect(evaluateR6H21({ symbol: "BTCUSDT", candles1h: [equal], decisionTime: equal.closeTime }).status).toBe("NO_SIGNAL");
  });

  it("does not use compression or H18 predicates and ignores future values", () => {
    const input = h21Input(0.02, 0.8);
    const result = evaluateR6H21(input);
    const withFuture = evaluateR6H21({
      ...input,
      candles1h: [...input.candles1h, makeCandle({ openTime: input.decisionTime + 1, open: 1, high: 10_000, low: 0.1, close: 9_000 })],
    });
    expect(withFuture).toEqual(result);
    expect(R6_FORMULA_DEFINITIONS.h21.event).not.toContain("compression");
    expect(R6_FORMULA_DEFINITIONS.h21.event).not.toContain("H18");
    const protocol = readFileSync("docs/M3_R6_B1A_PROTOCOL.md", "utf8");
    const h21Section = protocol.slice(protocol.indexOf("## H21"), protocol.indexOf("## H22"));
    expect(h21Section).toContain("exactly one unified event");
    expect(h21Section).toContain("does not use prior compression");
    expect(h21Section).not.toContain("compression OR impulse");
  });
});

describe("R6-H22 standalone regime route", () => {
  it("classifies a regime and emits only an H22 signal through its internal route", () => {
    const input = h22Input();
    expect(classifyR6H22Regime(input.candles4h, input.symbol, input.decisionTime)).toBe("UP_REGIME");
    const result = evaluateR6H22(input);
    expect(result.status).toBe("SIGNALS");
    if (result.status !== "SIGNALS") return;
    expect(result.signals[0]).toMatchObject({
      candidateId: "R6-H22-PREDECLARED-REGIME-ROUTING",
      direction: "LONG",
      internalRoute: "INTERNAL_DIRECTIONAL_CONTINUATION",
    });
  });

  it("never routes to H19/H20/H21 and fails closed on missing regime data", () => {
    expect(Object.values(R6_H22_ROUTE_MAP)).not.toContain("R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH");
    expect(Object.values(R6_H22_ROUTE_MAP)).not.toContain("R6-H20-STRUCTURAL-TREND-CONTINUATION");
    expect(Object.values(R6_H22_ROUTE_MAP)).not.toContain("R6-H21-ECONOMIC-RANGE-IMPULSE");
    const input = h22Input();
    const balanced4h = input.candles4h.map((candle, index) => index === 1 ? { ...candle, close: candle.open } : candle);
    expect(classifyR6H22Regime(balanced4h, input.symbol, input.decisionTime)).toBe("BALANCED");
    expect(evaluateR6H22({ ...input, candles4h: balanced4h }).status).toBe("NO_SIGNAL");
    expect(evaluateR6H22({ ...input, candles4h: input.candles4h.slice(0, 2) }).status).toBe("DATA_INCOMPLETE");
  });

  it("keeps the signal unchanged when future candle data is mutated", () => {
    const input = h22Input();
    const result = evaluateR6H22(input);
    const future = makeCandle({ openTime: input.decisionTime + 1, open: 1, high: 100_000, low: 0.1, close: 90_000 });
    expect(evaluateR6H22({ ...input, candles1h: [...input.candles1h, future] })).toEqual(result);
  });
});

describe("R6-B.1A offline-only boundary", () => {
  it("contains no performance command or network/data-loader path", () => {
    const source = readFileSync("src/lib/research/m3-r6-round-006-protocol.ts", "utf8");
    expect(source).not.toContain("research:m3r4:performance");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("Binance");
  });
});
