import type { MarketTimeframe } from "./intervals.ts";
import type { ResearchSymbol } from "../config/constants.ts";

export const MARKET_DATA_ERROR_CODES = [
  "SERVER_TIME_UNAVAILABLE",
  "HTTP_TIMEOUT",
  "NETWORK_ERROR",
  "RATE_LIMITED",
  "UPSTREAM_5XX",
  "UPSTREAM_ACCESS_RESTRICTED",
  "INVALID_RESPONSE",
  "INVALID_SYMBOL",
  "SYMBOL_UNAVAILABLE",
  "INSUFFICIENT_HISTORY",
  "INVALID_TIMESTAMP",
  "INVALID_NUMBER",
  "INVALID_OHLC",
  "OUT_OF_ORDER_CANDLES",
  "DUPLICATE_CANDLE",
  "CANDLE_GAP",
  "STALE_DATA",
] as const;

export type MarketDataErrorCode = (typeof MARKET_DATA_ERROR_CODES)[number];

export type SafeDiagnostics = Readonly<{
  endpoint?: string;
  httpStatus?: number;
  attempts?: number;
  operationStartedAt?: number;
  attemptStartedAt?: number;
  attemptCompletedAt?: number;
  roundTripMs?: number;
  estimatedClockOffsetMs?: number;
  requestWeight?: string;
  retryAfterMs?: number;
  maxRetryDelayMs?: number;
  expectedLatestOpenTime?: number;
  actualLatestOpenTime?: number;
  previousOpenTime?: number;
  nextOpenTime?: number;
  expectedIntervalMs?: number;
  actualIntervalMs?: number;
  requiredCandles?: number;
  receivedCandles?: number;
}>;

export type MarketDataErrorDetails = Readonly<{
  code: MarketDataErrorCode;
  message: string;
  symbol?: ResearchSymbol;
  timeframe?: MarketTimeframe;
  retryable: boolean;
  diagnostics?: SafeDiagnostics;
}>;

export class MarketDataError extends Error {
  readonly code: MarketDataErrorCode;
  readonly symbol?: ResearchSymbol;
  readonly timeframe?: MarketTimeframe;
  readonly retryable: boolean;
  readonly diagnostics?: SafeDiagnostics;

  constructor(input: {
    code: MarketDataErrorCode;
    message: string;
    symbol?: ResearchSymbol;
    timeframe?: MarketTimeframe;
    retryable: boolean;
    diagnostics?: SafeDiagnostics;
  }) {
    super(input.message);
    this.name = "MarketDataError";
    this.code = input.code;
    this.symbol = input.symbol;
    this.timeframe = input.timeframe;
    this.retryable = input.retryable;
    this.diagnostics = input.diagnostics;
  }

  get details(): MarketDataErrorDetails {
    return {
      code: this.code,
      message: this.message,
      ...(this.symbol ? { symbol: this.symbol } : {}),
      ...(this.timeframe ? { timeframe: this.timeframe } : {}),
      retryable: this.retryable,
      ...(this.diagnostics ? { diagnostics: this.diagnostics } : {}),
    };
  }

  toJSON(): MarketDataErrorDetails {
    return this.details;
  }
}

export function toMarketDataErrorDetails(
  error: unknown,
  fallback: Omit<MarketDataErrorDetails, "message"> & { message?: string },
): MarketDataErrorDetails {
  if (error instanceof MarketDataError) {
    return error.details;
  }

  return {
    code: fallback.code,
    message: fallback.message ?? "Market data request failed.",
    ...(fallback.symbol ? { symbol: fallback.symbol } : {}),
    ...(fallback.timeframe ? { timeframe: fallback.timeframe } : {}),
    retryable: fallback.retryable,
    ...(fallback.diagnostics ? { diagnostics: fallback.diagnostics } : {}),
  };
}
