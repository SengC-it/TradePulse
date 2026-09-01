import { describe, expect, it } from "vitest";

import type { ResearchSymbol } from "../src/lib/config/constants.ts";
import {
  R16_BASIS_INTERVAL_MS,
  R16_METRICS_INTERVAL_MS,
  R16_SYMBOLS,
} from "../src/lib/research/m3-r16-round-016-protocol.ts";
import { deriveR16MicroValue } from "../src/lib/research/m3-r16-round-016-data.ts";
import type { R16AcquisitionManifest, R16BasisRow, R16MetricRow, R16MicroSeries } from "../src/lib/research/m3-r16-round-016-archives.ts";

const DECISION_TIME = Date.parse("2024-01-01T12:00:00.000Z");

function acquisition(): R16AcquisitionManifest {
  return {
    schemaVersion: "m3-r16-round-016-micro-acquisition-001",
    source: "BINANCE_VISION_ARCHIVE",
    cacheDirectory: ".cache/tradepulse/round-016",
    archiveCount: 0,
    archiveProvenance: [],
    officialChecksumsVerified: true,
    metricsSchemaVerified: true,
    metricsCadenceVerified: true,
    markIndexPairingVerified: true,
    detectedCadenceBySourcePeriod: {},
    dataSourceIdentitySha256: "0".repeat(64),
    completed: true,
  };
}

function metricRows(): readonly R16MetricRow[] {
  return Object.freeze(Array.from({ length: 145 }, (_, index) => {
    const timestamp = DECISION_TIME - index * R16_METRICS_INTERVAL_MS;
    return Object.freeze({
      symbol: "BTCUSDT" as const,
      timestamp,
      sumOpenInterest: 100 - index * 0.1,
      sumOpenInterestValue: 1_000_000 - index * 1_000,
      sumTakerLongShortVolRatio: 1 + index / 1_000,
    });
  }).sort((left, right) => left.timestamp - right.timestamp));
}

function basisRows(symbol: ResearchSymbol): readonly R16BasisRow[] {
  return Object.freeze(Array.from({ length: 145 }, (_, index) => {
    const openTime = DECISION_TIME - index * R16_BASIS_INTERVAL_MS;
    const isFormingAtDecision = openTime === DECISION_TIME;
    const markClose = isFormingAtDecision ? 999 : openTime === DECISION_TIME - R16_BASIS_INTERVAL_MS ? 101 : 100;
    const indexClose = 100;
    return Object.freeze({ symbol, openTime, closeTime: openTime + R16_BASIS_INTERVAL_MS - 1, markClose, indexClose, basisBps: 10_000 * (markClose - indexClose) / indexClose });
  }).sort((left, right) => left.openTime - right.openTime));
}

function series(options: Readonly<{ omitMetricAt?: readonly number[]; omitBasisAt?: number }> = {}): R16MicroSeries {
  const omittedMetricTimes = new Set(options.omitMetricAt ?? []);
  const metrics = Object.fromEntries(R16_SYMBOLS.map((symbol) => [symbol, symbol === "BTCUSDT" ? metricRows().filter((row) => !omittedMetricTimes.has(row.timestamp)) : []])) as unknown as R16MicroSeries["metrics"];
  const basis = Object.fromEntries(R16_SYMBOLS.map((symbol) => [symbol, basisRows(symbol).filter((row) => row.openTime !== options.omitBasisAt)])) as unknown as R16MicroSeries["basis"];
  return Object.freeze({ metrics: Object.freeze(metrics), basis: Object.freeze(basis), acquisition: acquisition() });
}

describe("Round-016 microstructure materialization inputs", () => {
  it("uses the latest fully closed 5-minute basis candle, never the forming candle", () => {
    const value = deriveR16MicroValue({ series: series(), symbol: "BTCUSDT", direction: "LONG", decisionTime: DECISION_TIME, return4h: 0.5 });
    expect(value.basisNow).toBe(100);
    expect(value.basisChange1h).toBe(100);
    expect(Number.isFinite(value.taker1h)).toBe(true);
    expect(deriveR16MicroValue({ series: series(), symbol: "BTCUSDT", direction: "SHORT", decisionTime: DECISION_TIME, return4h: 0.5 }).basisNow).toBe(-100);

    const oneMillisecondLater = deriveR16MicroValue({ series: series(), symbol: "BTCUSDT", direction: "LONG", decisionTime: DECISION_TIME + 1, return4h: 0.5 });
    expect(oneMillisecondLater.basisNow).toBe(100);
  });

  it("rejects a missing exact closed basis pair or missing canonical metric sample", () => {
    expect(() => deriveR16MicroValue({ series: series({ omitBasisAt: DECISION_TIME - R16_BASIS_INTERVAL_MS }), symbol: "BTCUSDT", direction: "SHORT", decisionTime: DECISION_TIME, return4h: 0.5 })).toThrow(/canonical current basis/u);
    expect(() => deriveR16MicroValue({ series: series({ omitMetricAt: [DECISION_TIME, DECISION_TIME - R16_METRICS_INTERVAL_MS] }), symbol: "BTCUSDT", direction: "LONG", decisionTime: DECISION_TIME, return4h: 0.5 })).toThrow(/canonical current metrics/u);
  });

  it("requires complete exact prior taker windows and positive finite values", () => {
    const incomplete = series({ omitMetricAt: [DECISION_TIME - 55 * 60_000] });
    expect(() => deriveR16MicroValue({ series: incomplete, symbol: "BTCUSDT", direction: "LONG", decisionTime: DECISION_TIME, return4h: 0.5 })).toThrow(/taker window/u);
    const invalid = metricRows().map((row) => row.timestamp === DECISION_TIME ? { ...row, sumTakerLongShortVolRatio: 0 } : row);
    const metrics = Object.fromEntries(R16_SYMBOLS.map((symbol) => [symbol, symbol === "BTCUSDT" ? invalid : []])) as unknown as R16MicroSeries["metrics"];
    const invalidSeries = Object.freeze({ metrics: Object.freeze(metrics), basis: series().basis, acquisition: acquisition() });
    expect(() => deriveR16MicroValue({ series: invalidSeries, symbol: "BTCUSDT", direction: "LONG", decisionTime: DECISION_TIME, return4h: 0.5 })).toThrow(/invalid current metrics/u);
  });

  it("uses the same exact windows with indexed lookup", () => {
    const value = deriveR16MicroValue({ series: series(), symbol: "BTCUSDT", direction: "LONG", decisionTime: DECISION_TIME, return4h: 0.5 });
    const expected = Array.from({ length: 12 }, (_, index) => Math.log(1 + index / 1_000)).reduce((sum, item) => sum + item, 0) / 12;
    expect(value.taker1h).toBeCloseTo(expected, 12);
  });
});
