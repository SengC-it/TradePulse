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

export const ACQUISITION_FAILURE_CLASSIFICATIONS = [
  "TRANSIENT",
  "NON_TRANSIENT",
  "ACQUISITION_ROOT_CAUSE_UNKNOWN",
] as const;

export type AcquisitionFailureClassification = (typeof ACQUISITION_FAILURE_CLASSIFICATIONS)[number];

const TRANSIENT_ACQUISITION_ROOT_CAUSES = new Set([
  "HTTP_TIMEOUT",
  "NETWORK_ERROR",
  "RATE_LIMITED",
  "UPSTREAM_5XX",
  "HTTP_408",
  "HTTP_429",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

const NON_TRANSIENT_ACQUISITION_ROOT_CAUSES = new Set([
  "CANDLE_GAP",
  "DUPLICATE_CANDLE",
  "INVALID_HISTORICAL_DATA",
  "INVALID_FUNDING",
  "INVALID_RANGE",
  "INVALID_TIMESTAMP",
  "INVALID_RESPONSE",
  "OUT_OF_ORDER_CANDLES",
  "MARK_PRICE_UNAVAILABLE",
  "CHECKSUM_MISMATCH",
  "CACHE_INTEGRITY_ERROR",
  "CHRONOLOGY_VIOLATION",
  "FUTURE_CANDLE",
  "CONFLICTING_SETTLEMENT_IDENTITY",
  "UPSTREAM_ACCESS_RESTRICTED",
  "HTTP_451",
]);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeRootCauseCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/gu, "_");
}

function findAcquisitionRootCause(error: unknown, seen = new Set<object>()): string | number | undefined {
  if (!isRecord(error) || seen.has(error)) return undefined;
  seen.add(error);

  const diagnostics = isRecord(error.diagnostics) ? error.diagnostics : undefined;
  for (const key of ["rootCauseCode", "upstreamCode"] as const) {
    const code = safeString(diagnostics?.[key]);
    if (code && normalizeRootCauseCode(code) !== "DATA_INCOMPLETE") return code;
  }

  const code = safeString(error.code);
  if (code && normalizeRootCauseCode(code) !== "DATA_INCOMPLETE") return code;

  const status = diagnostics?.httpStatus;
  if (typeof status === "number" && Number.isInteger(status)) return status;

  return findAcquisitionRootCause(error.cause, seen);
}

/**
 * Classifies only the deepest safe acquisition cause. A bare DATA_INCOMPLETE
 * is intentionally unknown so callers cannot mistake a wrapper for a
 * resumable transport failure.
 */
export function classifyHistoricalAcquisitionFailure(error: unknown): AcquisitionFailureClassification {
  const rootCause = findAcquisitionRootCause(error);
  const code = typeof rootCause === "string" ? rootCause : undefined;

  if (
    (typeof rootCause === "number" && (rootCause === 408 || rootCause === 429))
    || (code !== undefined && TRANSIENT_ACQUISITION_ROOT_CAUSES.has(code))
  ) {
    return "TRANSIENT";
  }
  if (
    (typeof rootCause === "number" && rootCause === 451)
    || (code !== undefined && NON_TRANSIENT_ACQUISITION_ROOT_CAUSES.has(code))
  ) {
    return "NON_TRANSIENT";
  }
  return "ACQUISITION_ROOT_CAUSE_UNKNOWN";
}
