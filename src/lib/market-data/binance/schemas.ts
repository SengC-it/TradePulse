import { MarketDataError } from "../errors.ts";

export type BinanceExchangeSymbol = Readonly<{
  symbol: string;
  status: string;
  contractType: string;
  baseAsset: string;
  quoteAsset: string;
  marginAsset?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRequiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new MarketDataError({
      code: "INVALID_RESPONSE",
      message: `Binance exchangeInfo is missing a valid ${field}.`,
      retryable: false,
    });
  }
  return value;
}

export function parseBinanceExchangeInfo(payload: unknown): readonly BinanceExchangeSymbol[] {
  if (!isRecord(payload) || !Array.isArray(payload.symbols)) {
    throw new MarketDataError({
      code: "INVALID_RESPONSE",
      message: "Binance exchangeInfo response has an invalid shape.",
      retryable: false,
    });
  }

  return Object.freeze(
    payload.symbols.map((value) => {
      if (!isRecord(value)) {
        throw new MarketDataError({
          code: "INVALID_RESPONSE",
          message: "Binance exchangeInfo contains an invalid symbol entry.",
          retryable: false,
        });
      }

      return Object.freeze({
        symbol: readRequiredString(value, "symbol"),
        status: readRequiredString(value, "status"),
        contractType: readRequiredString(value, "contractType"),
        baseAsset: readRequiredString(value, "baseAsset"),
        quoteAsset: readRequiredString(value, "quoteAsset"),
        ...(typeof value.marginAsset === "string" ? { marginAsset: value.marginAsset } : {}),
      });
    }),
  );
}
