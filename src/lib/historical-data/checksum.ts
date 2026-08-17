import { createHash } from "node:crypto";

import type { Candle } from "../market-data/types.ts";
import type {
  HistoricalFundingRecord,
  HistoricalMarkPriceCandle,
  IntrabarSettlementCandle,
} from "./types.ts";

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot checksum a non-finite historical value.");
  }
  return String(value);
}

export function canonicalCandleRow(candle: Candle): string {
  return [
    candle.symbol,
    candle.timeframe,
    canonicalNumber(candle.openTime),
    canonicalNumber(candle.closeTime),
    canonicalNumber(candle.open),
    canonicalNumber(candle.high),
    canonicalNumber(candle.low),
    canonicalNumber(candle.close),
    canonicalNumber(candle.volume),
    canonicalNumber(candle.quoteVolume),
    canonicalNumber(candle.tradeCount),
    canonicalNumber(candle.takerBuyBaseVolume),
    canonicalNumber(candle.takerBuyQuoteVolume),
  ].join(",");
}

export function canonicalFundingRow(record: HistoricalFundingRecord): string {
  return [
    record.symbol,
    canonicalNumber(record.fundingTime),
    canonicalNumber(record.fundingRate),
    record.directMarkPrice === null ? "null" : canonicalNumber(record.directMarkPrice),
  ].join(",");
}

export function canonicalMarkPriceRow(candle: HistoricalMarkPriceCandle): string {
  return [
    candle.symbol,
    canonicalNumber(candle.openTime),
    canonicalNumber(candle.closeTime),
    canonicalNumber(candle.open),
    canonicalNumber(candle.high),
    canonicalNumber(candle.low),
    canonicalNumber(candle.close),
  ].join(",");
}

export function sha256Rows(rows: readonly string[]): string {
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}

export function checksumCandles(candles: readonly Candle[]): string {
  return sha256Rows(candles.map(canonicalCandleRow));
}

export function checksumFunding(records: readonly HistoricalFundingRecord[]): string {
  return sha256Rows(records.map(canonicalFundingRow));
}

export function checksumMarkPrice(candles: readonly HistoricalMarkPriceCandle[]): string {
  return sha256Rows(candles.map(canonicalMarkPriceRow));
}

export function canonicalIntrabarSettlementRow(candle: IntrabarSettlementCandle): string {
  return [
    candle.symbol,
    candle.timeframe,
    canonicalNumber(candle.openTime),
    canonicalNumber(candle.closeTime),
    canonicalNumber(candle.open),
    canonicalNumber(candle.high),
    canonicalNumber(candle.low),
    canonicalNumber(candle.close),
    canonicalNumber(candle.volume),
    canonicalNumber(candle.quoteVolume),
    canonicalNumber(candle.tradeCount),
    canonicalNumber(candle.takerBuyBaseVolume),
    canonicalNumber(candle.takerBuyQuoteVolume),
  ].join(",");
}

export function checksumIntrabarSettlement(candles: readonly IntrabarSettlementCandle[]): string {
  return sha256Rows(candles.map(canonicalIntrabarSettlementRow));
}
