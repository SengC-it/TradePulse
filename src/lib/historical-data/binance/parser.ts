import type { ResearchSymbol } from "../../config/constants.ts";
import { HistoricalDataError } from "../errors.ts";
import type { HistoricalFundingRecord } from "../types.ts";

function finite(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown): number | null {
  const parsed = finite(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

export function parseBinanceFundingRateHistory(
  payload: unknown,
  symbol: ResearchSymbol,
): readonly HistoricalFundingRecord[] {
  if (!Array.isArray(payload)) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Binance funding-rate response is not an array.",
      symbol,
    });
  }

  return Object.freeze(
    payload.map((row) => {
      if (typeof row !== "object" || row === null) {
        throw new HistoricalDataError({
          code: "INVALID_FUNDING",
          message: "Binance funding-rate row is not an object.",
          symbol,
        });
      }
      const record = row as Record<string, unknown>;
      const fundingTime = integer(record.fundingTime);
      const fundingRate = finite(record.fundingRate);
      const directMarkPrice = finite(record.markPrice);
      if (record.symbol !== symbol || fundingTime === null || fundingTime < 0 || fundingRate === null) {
        throw new HistoricalDataError({
          code: "INVALID_FUNDING",
          message: "Binance funding-rate row has invalid symbol, time, or rate.",
          symbol,
        });
      }
      return Object.freeze({ symbol, fundingTime, fundingRate, directMarkPrice });
    }),
  );
}
