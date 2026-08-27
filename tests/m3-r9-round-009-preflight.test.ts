import { describe, expect, it } from "vitest";

import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import { latestClosedCandleWindow, validateRound006PreflightCandle } from "../src/lib/research/m3-r6-round-006-data.ts";

const HOUR = INTERVAL_MS["1h"];
const FOUR_HOURS = INTERVAL_MS["4h"];

function row(openTime: number, interval: number): readonly (number | string)[] {
  return [openTime, "100", "101", "99", "100", "10", openTime + interval - 1, "1000", 10, "5", "500", "0"];
}

describe("Round-009 closed-candle boundary", () => {
  it("selects the previous fully closed hour in the middle of an hour", () => {
    const serverTime = Date.parse("2026-01-01T10:46:00.000Z");
    expect(latestClosedCandleWindow(serverTime, HOUR)).toEqual({ openTime: Date.parse("2026-01-01T09:00:00.000Z"), closeTime: Date.parse("2026-01-01T09:59:59.999Z") });
  });

  it("selects the immediately preceding hour at an exact hour boundary", () => {
    const serverTime = Date.parse("2026-01-01T11:00:00.000Z");
    expect(latestClosedCandleWindow(serverTime, HOUR)).toEqual({ openTime: Date.parse("2026-01-01T10:00:00.000Z"), closeTime: Date.parse("2026-01-01T10:59:59.999Z") });
  });

  it("does not treat the 10:59:59.999 forming boundary as closed", () => {
    const serverTime = Date.parse("2026-01-01T10:59:59.999Z");
    expect(latestClosedCandleWindow(serverTime, HOUR)).toEqual({ openTime: Date.parse("2026-01-01T09:00:00.000Z"), closeTime: Date.parse("2026-01-01T09:59:59.999Z") });
  });

  it("uses the same UTC epoch calculation for four-hour candles", () => {
    const serverTime = Date.parse("2026-01-01T11:46:00.000Z");
    expect(latestClosedCandleWindow(serverTime, FOUR_HOURS)).toEqual({ openTime: Date.parse("2026-01-01T04:00:00.000Z"), closeTime: Date.parse("2026-01-01T07:59:59.999Z") });
  });

  it("rejects a forming response and accepts the exact previous closed response", () => {
    const serverTime = Date.parse("2026-01-01T10:46:00.000Z");
    const expectedOpen = Date.parse("2026-01-01T09:00:00.000Z");
    expect(() => validateRound006PreflightCandle({ data: [row(expectedOpen + HOUR, HOUR)] }, "BTCUSDT", "1h", expectedOpen, serverTime)).toThrow();
    expect(() => validateRound006PreflightCandle({ data: [row(expectedOpen, HOUR)] }, "BTCUSDT", "1h", expectedOpen, serverTime)).not.toThrow();
  });
});
