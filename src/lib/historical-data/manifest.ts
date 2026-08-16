import type { MarketTimeframe } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import { checksumCandles, checksumFunding } from "./checksum.ts";
import type {
  HistoricalCandleManifest,
  HistoricalFundingManifest,
  HistoricalFundingRecord,
  HistoricalRange,
  HISTORICAL_PROVIDER,
} from "./types.ts";
import type { ResearchSymbol } from "../config/constants.ts";

function isoTimestamp(value: string | number): string {
  const timestamp = typeof value === "number" ? new Date(value) : new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error("Manifest retrieval time must be a valid timestamp.");
  }
  return timestamp.toISOString();
}

export function createCandleManifest(input: {
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
  range: HistoricalRange;
  candles: readonly Candle[];
  retrievedAt: string | number;
}): HistoricalCandleManifest {
  return Object.freeze({
    kind: "candles",
    provider: "binance-usdm-public" as typeof HISTORICAL_PROVIDER,
    source: "/fapi/v1/klines",
    symbol: input.symbol,
    timeframe: input.timeframe,
    requestedStartTime: input.range.startTime,
    requestedEndTime: input.range.endTime,
    actualStartTime: input.candles[0]?.openTime ?? null,
    actualEndTime: input.candles[input.candles.length - 1]?.closeTime ?? null,
    rowCount: input.candles.length,
    retrievedAt: isoTimestamp(input.retrievedAt),
    sha256: checksumCandles(input.candles),
    settlementOnly: input.range.settlementOnly ?? false,
  });
}

export function createFundingManifest(input: {
  symbol: ResearchSymbol;
  range: HistoricalRange;
  records: readonly HistoricalFundingRecord[];
  retrievedAt: string | number;
}): HistoricalFundingManifest {
  return Object.freeze({
    kind: "funding",
    provider: "binance-usdm-public" as typeof HISTORICAL_PROVIDER,
    source: "/fapi/v1/fundingRate",
    symbol: input.symbol,
    requestedStartTime: input.range.startTime,
    requestedEndTime: input.range.endTime,
    actualStartTime: input.records[0]?.fundingTime ?? null,
    actualEndTime: input.records[input.records.length - 1]?.fundingTime ?? null,
    rowCount: input.records.length,
    retrievedAt: isoTimestamp(input.retrievedAt),
    sha256: checksumFunding(input.records),
    settlementOnly: input.range.settlementOnly ?? false,
    markPriceField: "markPrice",
  });
}
