import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../../config/constants.ts";
import { HistoricalDataError } from "../errors.ts";
import type { HistoricalMarkPriceCandle } from "../types.ts";

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
      message: `Binance mark-price Kline ${field} is not finite.`,
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
      message: `Binance mark-price Kline ${field} is not a valid timestamp.`,
      symbol,
    });
  }
  return parsed;
}

export function parseBinanceMarkPriceKlines(
  payload: unknown,
  symbol: ResearchSymbol,
): readonly HistoricalMarkPriceCandle[] {
  if (!RESEARCH_SYMBOLS.includes(symbol) || !Array.isArray(payload)) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Binance mark-price Kline response is not an array for an approved symbol.",
      symbol,
    });
  }

  return Object.freeze(
    payload.map((row) => {
      if (!Array.isArray(row) || row.length < 7) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Binance mark-price Kline row does not contain the required fields.",
          symbol,
        });
      }
      return Object.freeze({
        symbol,
        openTime: timestamp(row[0], "openTime", symbol),
        open: finite(row[1], "open", symbol),
        high: finite(row[2], "high", symbol),
        low: finite(row[3], "low", symbol),
        close: finite(row[4], "close", symbol),
        closeTime: timestamp(row[6], "closeTime", symbol),
      });
    }),
  );
}
