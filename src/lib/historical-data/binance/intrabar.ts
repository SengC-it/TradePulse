import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../../config/constants.ts";
import { HistoricalDataError } from "../errors.ts";
import type { IntrabarSettlementCandle } from "../types.ts";

function finite(value: unknown, field: string, symbol: ResearchSymbol): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: `Binance 1m Kline ${field} is not finite.`,
      symbol,
    });
  }
  return parsed;
}

function timestamp(value: unknown, field: string, symbol: ResearchSymbol): number {
  const parsed = finite(value, field, symbol);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: `Binance 1m Kline ${field} is not a valid timestamp.`,
      symbol,
    });
  }
  return parsed;
}

function tradeCount(value: unknown, symbol: ResearchSymbol): number {
  const parsed = timestamp(value, "tradeCount", symbol);
  return parsed;
}

export function parseBinanceIntrabarKlines(
  payload: unknown,
  symbol: ResearchSymbol,
): readonly IntrabarSettlementCandle[] {
  if (!RESEARCH_SYMBOLS.includes(symbol) || !Array.isArray(payload)) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Binance 1m Kline response is not an array for an approved symbol.",
      symbol,
    });
  }

  return Object.freeze(
    payload.map((row) => {
      if (!Array.isArray(row) || row.length !== 12) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Binance 1m Kline row does not contain the required fields.",
          symbol,
        });
      }
      return Object.freeze({
        symbol,
        timeframe: "1m" as const,
        openTime: timestamp(row[0], "openTime", symbol),
        open: finite(row[1], "open", symbol),
        high: finite(row[2], "high", symbol),
        low: finite(row[3], "low", symbol),
        close: finite(row[4], "close", symbol),
        volume: finite(row[5], "volume", symbol),
        closeTime: timestamp(row[6], "closeTime", symbol),
        quoteVolume: finite(row[7], "quoteVolume", symbol),
        tradeCount: tradeCount(row[8], symbol),
        takerBuyBaseVolume: finite(row[9], "takerBuyBaseVolume", symbol),
        takerBuyQuoteVolume: finite(row[10], "takerBuyQuoteVolume", symbol),
      });
    }),
  );
}
