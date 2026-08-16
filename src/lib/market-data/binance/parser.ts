import { MarketDataError } from "../errors.ts";
import type { MarketTimeframe } from "../intervals.ts";
import type { Candle } from "../types.ts";
import type { ResearchSymbol } from "../../config/constants.ts";

function parseFiniteNumber(value: unknown, field: string, symbol: ResearchSymbol, timeframe: MarketTimeframe): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    throw new MarketDataError({
      code: "INVALID_NUMBER",
      message: `Binance kline ${field} is empty.`,
      symbol,
      timeframe,
      retryable: false,
    });
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new MarketDataError({
      code: "INVALID_NUMBER",
      message: `Binance kline ${field} is not finite.`,
      symbol,
      timeframe,
      retryable: false,
    });
  }
  return parsed;
}

function parseTimestamp(value: unknown, field: string, symbol: ResearchSymbol, timeframe: MarketTimeframe): number {
  const parsed = parseFiniteNumber(value, field, symbol, timeframe);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new MarketDataError({
      code: "INVALID_TIMESTAMP",
      message: `Binance kline ${field} is not a valid UTC epoch millisecond timestamp.`,
      symbol,
      timeframe,
      retryable: false,
    });
  }
  return parsed;
}

function parseTradeCount(value: unknown, symbol: ResearchSymbol, timeframe: MarketTimeframe): number {
  const parsed = parseFiniteNumber(value, "tradeCount", symbol, timeframe);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new MarketDataError({
      code: "INVALID_NUMBER",
      message: "Binance kline tradeCount is not a non-negative integer.",
      symbol,
      timeframe,
      retryable: false,
    });
  }
  return parsed;
}

export function parseBinanceKlines(
  payload: unknown,
  symbol: ResearchSymbol,
  timeframe: MarketTimeframe,
): readonly Candle[] {
  if (!Array.isArray(payload)) {
    throw new MarketDataError({
      code: "INVALID_RESPONSE",
      message: "Binance klines response is not an array.",
      symbol,
      timeframe,
      retryable: false,
    });
  }

  return Object.freeze(
    payload.map((row) => {
      if (!Array.isArray(row) || row.length !== 12) {
        throw new MarketDataError({
          code: "INVALID_RESPONSE",
          message: "Binance kline row does not contain the required 12 fields.",
          symbol,
          timeframe,
          retryable: false,
        });
      }

      const [
        openTime,
        open,
        high,
        low,
        close,
        volume,
        closeTime,
        quoteVolume,
        tradeCount,
        takerBuyBaseVolume,
        takerBuyQuoteVolume,
      ] = row;

      return Object.freeze({
        symbol,
        timeframe,
        openTime: parseTimestamp(openTime, "openTime", symbol, timeframe),
        closeTime: parseTimestamp(closeTime, "closeTime", symbol, timeframe),
        open: parseFiniteNumber(open, "open", symbol, timeframe),
        high: parseFiniteNumber(high, "high", symbol, timeframe),
        low: parseFiniteNumber(low, "low", symbol, timeframe),
        close: parseFiniteNumber(close, "close", symbol, timeframe),
        volume: parseFiniteNumber(volume, "volume", symbol, timeframe),
        quoteVolume: parseFiniteNumber(quoteVolume, "quoteVolume", symbol, timeframe),
        tradeCount: parseTradeCount(tradeCount, symbol, timeframe),
        takerBuyBaseVolume: parseFiniteNumber(
          takerBuyBaseVolume,
          "takerBuyBaseVolume",
          symbol,
          timeframe,
        ),
        takerBuyQuoteVolume: parseFiniteNumber(
          takerBuyQuoteVolume,
          "takerBuyQuoteVolume",
          symbol,
          timeframe,
        ),
      });
    }),
  );
}
