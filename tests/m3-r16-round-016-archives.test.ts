import { describe, expect, it } from "vitest";

import {
  R16ArchiveError,
  buildR16ArchiveRequests,
  parseR16BasisCsv,
  parseR16MetricsCsv,
  r16ArchiveChecksumUrl,
  r16ArchiveUrl,
  r16ExpectedBasisCadence,
  r16ExpectedMetricsCadence,
} from "../src/lib/research/m3-r16-round-016-archives.ts";

describe("Round-016 official archive conformance", () => {
  it("uses the official Binance Vision archive names and checksum URLs", () => {
    const metrics = { kind: "metrics" as const, frequency: "daily" as const, symbol: "BTCUSDT" as const, period: "2026-08-15" };
    const mark = { kind: "markPriceKlines" as const, frequency: "monthly" as const, symbol: "BTCUSDT" as const, period: "2026-07", interval: "5m" as const };
    const index = { kind: "indexPriceKlines" as const, frequency: "daily" as const, symbol: "BTCUSDT" as const, period: "2026-08-15", interval: "5m" as const };
    expect(r16ArchiveUrl(metrics)).toBe("https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-2026-08-15.zip");
    expect(r16ArchiveUrl(mark)).toBe("https://data.binance.vision/data/futures/um/monthly/markPriceKlines/BTCUSDT/5m/BTCUSDT-5m-2026-07.zip");
    expect(r16ArchiveUrl(index)).toBe("https://data.binance.vision/data/futures/um/daily/indexPriceKlines/BTCUSDT/5m/BTCUSDT-5m-2026-08-15.zip");
    expect(r16ArchiveChecksumUrl(mark)).toBe(`${r16ArchiveUrl(mark)}.CHECKSUM`);
    expect(r16ExpectedMetricsCadence()).toBe(5 * 60_000);
    expect(r16ExpectedBasisCadence()).toBe(5 * 60_000);
  });

  it("requests completed months as monthly archives and the boundary month as daily archives", () => {
    const requests = buildR16ArchiveRequests();
    const mark = requests.filter((value) => value.kind === "markPriceKlines" && value.symbol === "BTCUSDT");
    expect(mark).toContainEqual({ kind: "markPriceKlines", frequency: "monthly", symbol: "BTCUSDT", period: "2026-07", interval: "5m" });
    expect(mark).toContainEqual({ kind: "markPriceKlines", frequency: "daily", symbol: "BTCUSDT", period: "2026-08-01", interval: "5m" });
    expect(mark).toContainEqual({ kind: "markPriceKlines", frequency: "daily", symbol: "BTCUSDT", period: "2026-08-15", interval: "5m" });
    expect(mark).not.toContainEqual({ kind: "markPriceKlines", frequency: "monthly", symbol: "BTCUSDT", period: "2026-08", interval: "5m" });
    expect(requests.filter((value) => value.kind === "metrics" && value.symbol === "BTCUSDT").every((value) => value.frequency === "daily")).toBe(true);
  });

  it("parses the required metrics schema and rejects malformed or non-positive values", () => {
    const csv = [
      "create_time,symbol,sum_open_interest,sum_open_interest_value,sum_taker_long_short_vol_ratio",
      "1700000000000,BTCUSDT,100,1000000,1.25",
      "1700000300000,BTCUSDT,101,1010000,0.8",
    ].join("\n");
    const rows = parseR16MetricsCsv(csv, "BTCUSDT");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ symbol: "BTCUSDT", timestamp: 1700000000000, sumOpenInterest: 100, sumOpenInterestValue: 1_000_000, sumTakerLongShortVolRatio: 1.25 });
    expect(() => parseR16MetricsCsv(csv.replace("101,1010000,0.8", "-1,1010000,0.8"), "BTCUSDT")).toThrow(R16ArchiveError);
    expect(() => parseR16MetricsCsv(csv.replace("101,1010000,0.8", "101,1010000,not-a-number"), "BTCUSDT")).toThrow(R16ArchiveError);
  });

  it("parses Binance Vision create_time text as UTC milliseconds", () => {
    const csv = [
      "create_time,symbol,sum_open_interest,sum_open_interest_value,sum_taker_long_short_vol_ratio",
      "2023-01-01 00:00:00,BTCUSDT,100,1000000,1.25",
      "2023-01-01 00:05:00,BTCUSDT,101,1010000,0.8",
    ].join("\n");
    expect(parseR16MetricsCsv(csv, "BTCUSDT").map((row) => row.timestamp)).toEqual([
      Date.parse("2023-01-01T00:00:00.000Z"),
      Date.parse("2023-01-01T00:05:00.000Z"),
    ]);
  });

  it("accepts only canonical closed 5-minute basis candles", () => {
    const openTime = 1700000100000 - (1700000100000 % (5 * 60_000));
    const csv = [
      "open_time,open,high,low,close,volume,close_time",
      `${openTime},100,101,99,100.5,10,${openTime + 5 * 60_000 - 1}`,
    ].join("\n");
    expect(parseR16BasisCsv(csv, "BTCUSDT")).toEqual([expect.objectContaining({ symbol: "BTCUSDT", openTime, closeTime: openTime + 5 * 60_000 - 1, close: 100.5 })]);
    expect(() => parseR16BasisCsv(csv.replace(String(openTime + 5 * 60_000 - 1), String(openTime + 5 * 60_000)), "BTCUSDT")).toThrow(/canonical closed/u);
    expect(() => parseR16BasisCsv(csv.replace(",100.5,10,", ",0,10,"), "BTCUSDT")).toThrow(/canonical closed/u);
  });
});
