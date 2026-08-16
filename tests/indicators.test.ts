import { describe, expect, it } from "vitest";

import { calculateAtr14, calculateEma, calculateEma20, calculateEma50, calculateEma200, calculateRsi14 } from "@/lib/indicators";
import type { Candle } from "@/lib/market-data/types";

function makeCandle(index: number, close: number, high = close + 1, low = close - 1): Candle {
  return {
    symbol: "BTCUSDT",
    timeframe: "1h",
    openTime: index * 3_600_000,
    closeTime: index * 3_600_000 + 3_599_999,
    open: close,
    high,
    low,
    close,
    volume: 10,
    quoteVolume: 1_000,
    tradeCount: 10,
    takerBuyBaseVolume: 5,
    takerBuyQuoteVolume: 500,
  };
}

describe("frozen baseline-001 indicators", () => {
  it("seeds EMA with an SMA and applies the standard recurrence", () => {
    expect(calculateEma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
    expect(calculateEma([1, 2, 3], 3)).toEqual([null, null, 2]);
  });

  it("keeps EMA20, EMA50, and EMA200 unavailable before their seed index", () => {
    const values = Array.from({ length: 200 }, (_, index) => index + 1);

    expect(calculateEma20(values).slice(0, 19).every((value) => value === null)).toBe(true);
    expect(calculateEma50(values).slice(0, 49).every((value) => value === null)).toBe(true);
    expect(calculateEma200(values).slice(0, 199).every((value) => value === null)).toBe(true);
    expect(calculateEma200(values)[199]).toBe(100.5);
  });

  it("does not mutate input values", () => {
    const values = [1, 2, 3, 4];
    const candles = [makeCandle(0, 10), makeCandle(1, 11)];
    const valuesBefore = [...values];
    const candlesBefore = structuredClone(candles);

    calculateEma(values, 2);
    calculateAtr14(candles);

    expect(values).toEqual(valuesBefore);
    expect(candles).toEqual(candlesBefore);
  });

  it("uses Wilder RSI seeding and the exact flat/rising/falling edges", () => {
    const flat = Array.from({ length: 16 }, () => 100);
    const rising = Array.from({ length: 16 }, (_, index) => 100 + index);
    const falling = Array.from({ length: 16 }, (_, index) => 116 - index);

    expect(calculateRsi14(flat).slice(0, 14).every((value) => value === null)).toBe(true);
    expect(calculateRsi14(flat)[14]).toBe(50);
    expect(calculateRsi14(rising)[14]).toBe(100);
    expect(calculateRsi14(falling)[14]).toBe(0);
  });

  it("uses true range, SMA ATR seeding, and Wilder ATR smoothing", () => {
    const candles = Array.from({ length: 15 }, (_, index) =>
      makeCandle(index, 100 + index, 102 + index, 99 + index),
    );
    candles[0] = makeCandle(0, 101, 102, 100);
    candles[14] = makeCandle(14, 114, 117, 113);

    const atr = calculateAtr14(candles);
    const firstAtr = (2 + 13 * 3) / 14;
    const expectedNext = (firstAtr * 13 + 4) / 14;

    expect(atr.slice(0, 13).every((value) => value === null)).toBe(true);
    expect(atr[13]).toBeCloseTo(firstAtr, 12);
    expect(atr[14]).toBeCloseTo(expectedNext, 12);
  });

  it("uses the previous close gap when it is larger than high-low", () => {
    const candles = Array.from({ length: 14 }, (_, index) =>
      makeCandle(index, index === 0 ? 100 : 110, index === 0 ? 101 : 111, index === 0 ? 99 : 109),
    );

    expect(calculateAtr14(candles)[13]).toBeCloseTo((2 + 11 + 12 * 2) / 14, 12);
  });

  it("handles a gap-down true range symmetrically", () => {
    const candles = Array.from({ length: 14 }, (_, index) =>
      makeCandle(index, index === 0 ? 100 : 90, index === 0 ? 101 : 91, index === 0 ? 99 : 89),
    );

    expect(calculateAtr14(candles)[13]).toBeCloseTo((2 + 11 + 12 * 2) / 14, 12);
  });

  it("applies Wilder RSI smoothing after the initial SMA", () => {
    const closes = [100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107, 109];
    const rsi = calculateRsi14(closes);
    const expectedInitial = 100 - 100 / (1 + 1 / 0.5);
    const nextAverageGain = (1 * 13 + 2) / 14;
    const nextAverageLoss = (0.5 * 13 + 0) / 14;
    const expectedNext = 100 - 100 / (1 + nextAverageGain / nextAverageLoss);

    expect(rsi[14]).toBeCloseTo(expectedInitial, 12);
    expect(rsi[15]).toBeCloseTo(expectedNext, 12);
  });

  it("represents a zero ATR explicitly instead of substituting a fallback", () => {
    const flatCandles = Array.from({ length: 14 }, (_, index) => makeCandle(index, 100, 100, 100));

    expect(calculateAtr14(flatCandles)[13]).toBe(0);
  });
});
