import type { IntrabarSettlementCandle } from "../historical-data/types.ts";

export const R13_INDEXED_ONE_MINUTE_MS = 60_000 as const;

export type R13OneMinuteLookup = Readonly<{
  length: number;
  firstOpenTime: number;
  lastOpenTime: number;
  getExact(openTime: number): IntrabarSettlementCandle | undefined;
  openAtOrAfter(timestamp: number): IntrabarSettlementCandle | undefined;
  getRange(startTime: number, endTime: number): readonly IntrabarSettlementCandle[];
}>;

function isCompleteCandle(candle: IntrabarSettlementCandle): boolean {
  return Number.isSafeInteger(candle.openTime)
    && candle.openTime % R13_INDEXED_ONE_MINUTE_MS === 0
    && candle.closeTime === candle.openTime + R13_INDEXED_ONE_MINUTE_MS - 1
    && Number.isFinite(candle.open)
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low)
    && Number.isFinite(candle.close)
    && candle.open > 0
    && candle.high >= candle.low;
}

/**
 * An immutable contiguous 1m series. Chronology is checked once at dataset
 * construction; label lookups then use timestamp arithmetic instead of
 * sorting or scanning the full series for every label.
 */
export class R13OneMinuteIndexedSeries implements R13OneMinuteLookup {
  readonly length: number;
  readonly firstOpenTime: number;
  readonly lastOpenTime: number;
  private readonly candles: readonly IntrabarSettlementCandle[];

  constructor(candles: readonly IntrabarSettlementCandle[]) {
    if (candles.length === 0) throw new Error("R13 indexed 1m series cannot be empty.");
    for (let index = 0; index < candles.length; index += 1) {
      const candle = candles[index]!;
      if (!isCompleteCandle(candle)) throw new Error("R13 indexed 1m series contains a malformed candle.");
      if (index > 0 && candle.openTime !== candles[index - 1]!.openTime + R13_INDEXED_ONE_MINUTE_MS) {
        throw new Error("R13 indexed 1m series contains a gap or duplicate.");
      }
    }
    this.candles = Object.isFrozen(candles) ? candles : Object.freeze([...candles]);
    this.length = this.candles.length;
    this.firstOpenTime = this.candles[0]!.openTime;
    this.lastOpenTime = this.candles[this.candles.length - 1]!.openTime;
  }

  getExact(openTime: number): IntrabarSettlementCandle | undefined {
    const index = (openTime - this.firstOpenTime) / R13_INDEXED_ONE_MINUTE_MS;
    return Number.isInteger(index) && index >= 0 && index < this.length ? this.candles[index]! : undefined;
  }

  openAtOrAfter(timestamp: number): IntrabarSettlementCandle | undefined {
    const index = Math.max(0, Math.ceil((timestamp - this.firstOpenTime) / R13_INDEXED_ONE_MINUTE_MS));
    return index < this.length ? this.candles[index]! : undefined;
  }

  getRange(startTime: number, endTime: number): readonly IntrabarSettlementCandle[] {
    if (endTime < startTime || endTime < this.firstOpenTime || startTime > this.lastOpenTime) return Object.freeze([]);
    const firstIndex = Math.max(0, Math.ceil((startTime - this.firstOpenTime) / R13_INDEXED_ONE_MINUTE_MS));
    const lastIndex = Math.min(this.length - 1, Math.floor((endTime - this.firstOpenTime) / R13_INDEXED_ONE_MINUTE_MS));
    return firstIndex > lastIndex ? Object.freeze([]) : this.candles.slice(firstIndex, lastIndex + 1);
  }
}

export function r13IndexedSeriesLookupBounded(series: R13OneMinuteLookup, startTime: number, endTime: number): boolean {
  const expected = endTime < startTime ? 0 : Math.max(0, Math.floor((endTime - startTime) / R13_INDEXED_ONE_MINUTE_MS) + 1);
  return series.getRange(startTime, endTime).length <= expected;
}
