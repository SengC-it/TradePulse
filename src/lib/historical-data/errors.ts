export const HISTORICAL_DATA_ERROR_CODES = [
  "DATA_INCOMPLETE",
  "INVALID_HISTORICAL_DATA",
  "DUPLICATE_CANDLE",
  "CANDLE_GAP",
  "OUT_OF_ORDER_CANDLES",
  "INVALID_FUNDING",
  "MARK_PRICE_UNAVAILABLE",
  "INVALID_RANGE",
] as const;

export type HistoricalDataErrorCode = (typeof HISTORICAL_DATA_ERROR_CODES)[number];

export type HistoricalDataErrorDetails = Readonly<{
  code: HistoricalDataErrorCode;
  message: string;
  symbol?: string;
  timeframe?: string;
  diagnostics?: Readonly<Record<string, number | string | boolean>>;
}>;

export class HistoricalDataError extends Error {
  readonly code: HistoricalDataErrorCode;
  readonly symbol?: string;
  readonly timeframe?: string;
  readonly diagnostics?: Readonly<Record<string, number | string | boolean>>;

  constructor(input: HistoricalDataErrorDetails) {
    super(input.message);
    this.name = "HistoricalDataError";
    this.code = input.code;
    this.symbol = input.symbol;
    this.timeframe = input.timeframe;
    this.diagnostics = input.diagnostics;
  }

  get details(): HistoricalDataErrorDetails {
    return {
      code: this.code,
      message: this.message,
      ...(this.symbol ? { symbol: this.symbol } : {}),
      ...(this.timeframe ? { timeframe: this.timeframe } : {}),
      ...(this.diagnostics ? { diagnostics: this.diagnostics } : {}),
    };
  }
}

export function toHistoricalDataErrorDetails(
  error: unknown,
  fallback: HistoricalDataErrorDetails,
): HistoricalDataErrorDetails {
  if (error instanceof HistoricalDataError) {
    return error.details;
  }
  return fallback;
}
