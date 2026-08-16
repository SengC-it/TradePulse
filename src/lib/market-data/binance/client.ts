import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../../config/constants.ts";

import { MarketDataError, type SafeDiagnostics } from "../errors.ts";
import {
  BINANCE_HTTP_TIMEOUT_MS,
  BINANCE_MAX_ATTEMPTS,
  BINANCE_MAX_RETRY_DELAY_MS,
  REQUESTED_CANDLE_LIMIT,
  isMarketTimeframe,
  type MarketTimeframe,
} from "../intervals.ts";

export const BINANCE_PUBLIC_BASE_URL = "https://fapi.binance.com";

export type BinanceRequestDiagnostics = SafeDiagnostics &
  Readonly<{
    operationStartedAt: number;
    attemptStartedAt: number;
    attemptCompletedAt: number;
    roundTripMs: number;
    attempts: number;
  }>;

export type BinanceResponse<T> = Readonly<{
  data: T;
  diagnostics: BinanceRequestDiagnostics;
}>;

type BinanceServerTimePayload = Readonly<{
  serverTime: number;
}>;

export type BinancePublicClientOptions = Readonly<{
  baseUrl?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isResearchSymbol(value: string): value is ResearchSymbol {
  return (RESEARCH_SYMBOLS as readonly string[]).includes(value);
}

function parseServerTime(value: unknown): number {
  if (!isRecord(value) || (typeof value.serverTime !== "number" && typeof value.serverTime !== "string")) {
    throw new MarketDataError({
      code: "SERVER_TIME_UNAVAILABLE",
      message: "Binance server time response has an invalid shape.",
      retryable: true,
    });
  }

  const serverTime = typeof value.serverTime === "number" ? value.serverTime : Number(value.serverTime);
  if (!Number.isInteger(serverTime) || serverTime < 0) {
    throw new MarketDataError({
      code: "SERVER_TIME_UNAVAILABLE",
      message: "Binance server time response is invalid.",
      retryable: true,
    });
  }
  return serverTime;
}

type RetryAfterDecision = Readonly<{
  delayMs?: number;
  exceedsMax: boolean;
}>;

function parseRetryAfterMilliseconds(
  value: string | null,
  now: number,
  maxRetryDelayMs: number,
): RetryAfterDecision {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return { exceedsMax: false };
  }

  const seconds = Number(normalizedValue);
  let delayMs: number | undefined;
  if (Number.isFinite(seconds) && seconds >= 0) {
    const rawDelayMs = seconds * 1000;
    if (!Number.isFinite(rawDelayMs)) {
      return { delayMs: maxRetryDelayMs + 1, exceedsMax: true };
    }
    delayMs = Math.ceil(rawDelayMs);
  } else {
    const retryAt = Date.parse(normalizedValue);
    if (!Number.isFinite(retryAt)) {
      return { exceedsMax: false };
    }
    delayMs = Math.max(0, retryAt - now);
  }

  return {
    delayMs,
    exceedsMax: delayMs > maxRetryDelayMs,
  };
}

function getRequestWeight(response: Response): string | undefined {
  return (
    response.headers.get("x-mbx-used-weight-1m") ??
    response.headers.get("x-mbx-used-weight-1m-ip") ??
    undefined
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError")
  );
}

export class BinancePublicClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;

  constructor(options: BinancePublicClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? BINANCE_PUBLIC_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? BINANCE_HTTP_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? BINANCE_MAX_ATTEMPTS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.random = options.random ?? Math.random;
  }

  async getServerTime(): Promise<BinanceResponse<BinanceServerTimePayload>> {
    const response = await this.getJson<unknown>("/fapi/v1/time");
    const serverTime = parseServerTime(response.data);
    const midpoint = Math.round(
      (response.diagnostics.attemptStartedAt + response.diagnostics.attemptCompletedAt) / 2,
    );

    return {
      data: { serverTime },
      diagnostics: {
        ...response.diagnostics,
        estimatedClockOffsetMs: serverTime - midpoint,
      },
    };
  }

  async getExchangeInfo(): Promise<BinanceResponse<unknown>> {
    return this.getJson<unknown>("/fapi/v1/exchangeInfo");
  }

  async getKlines(
    symbol: ResearchSymbol,
    timeframe: MarketTimeframe,
    limit = REQUESTED_CANDLE_LIMIT,
  ): Promise<BinanceResponse<unknown>> {
    if (!isResearchSymbol(symbol)) {
      throw new MarketDataError({
        code: "INVALID_SYMBOL",
        message: "Requested symbol is outside the approved research universe.",
        retryable: false,
      });
    }

    if (!isMarketTimeframe(timeframe)) {
      throw new MarketDataError({
        code: "INVALID_RESPONSE",
        message: "Requested timeframe is outside the M1 timeframe set.",
        symbol,
        retryable: false,
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 1_500) {
      throw new MarketDataError({
        code: "INVALID_RESPONSE",
        message: "Kline limit must be between 1 and Binance's public maximum of 1500.",
        symbol,
        timeframe,
        retryable: false,
      });
    }

    return this.getJson<unknown>("/fapi/v1/klines", {
      symbol,
      interval: timeframe,
      limit: String(limit),
    });
  }

  private async getJson<T>(path: string, query?: Readonly<Record<string, string>>): Promise<BinanceResponse<T>> {
    const url = new URL(path, `${this.baseUrl.replace(/\/$/, "")}/`);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    const operationStartedAt = this.now();
    let lastError: MarketDataError | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      lastError = undefined;
      const attemptStartedAt = this.now();
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response | undefined;
      let attemptCompletedAt = attemptStartedAt;

      try {
        response = await this.fetchImpl(url, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        attemptCompletedAt = this.now();
      } catch (error) {
        attemptCompletedAt = this.now();
        clearTimeout(timeoutHandle);
        const isTimeout = isAbortError(error);
        lastError = new MarketDataError({
          code: isTimeout ? "HTTP_TIMEOUT" : "NETWORK_ERROR",
          message: isTimeout ? "Binance public request timed out." : "Binance public request failed at the network layer.",
          retryable: true,
          diagnostics: {
            endpoint: path,
            attempts: attempt,
            operationStartedAt,
            attemptStartedAt,
            attemptCompletedAt,
            roundTripMs: Math.max(0, attemptCompletedAt - attemptStartedAt),
          },
        });
      }

      if (lastError) {
        if (!lastError.retryable || attempt >= this.maxAttempts) {
          throw lastError;
        }
        await this.sleep(this.getRetryDelay(attempt));
        continue;
      }

      if (!response) {
        throw new MarketDataError({
          code: "NETWORK_ERROR",
          message: "Binance public request returned without a response.",
          retryable: true,
          diagnostics: {
            endpoint: path,
            attempts: attempt,
            operationStartedAt,
            attemptStartedAt,
            attemptCompletedAt,
            roundTripMs: Math.max(0, attemptCompletedAt - attemptStartedAt),
          },
        });
      }

      clearTimeout(timeoutHandle);
      const requestDiagnostics: BinanceRequestDiagnostics = {
        endpoint: path,
        attempts: attempt,
        operationStartedAt,
        attemptStartedAt,
        attemptCompletedAt,
        roundTripMs: Math.max(0, attemptCompletedAt - attemptStartedAt),
        ...(getRequestWeight(response) ? { requestWeight: getRequestWeight(response) } : {}),
      };

      if (!response.ok) {
        const isRateLimited = response.status === 429;
        const isTimeout = response.status === 408;
        const isUpstreamFailure = response.status >= 500 && response.status <= 599;
        const isAccessRestricted = response.status === 451;
        const retryAfter = isRateLimited
          ? parseRetryAfterMilliseconds(
              response.headers.get("retry-after"),
              attemptCompletedAt,
              BINANCE_MAX_RETRY_DELAY_MS,
            )
          : { exceedsMax: false };
        const retryable = (isRateLimited || isTimeout || isUpstreamFailure) && !retryAfter.exceedsMax;
        lastError = new MarketDataError({
          code: isRateLimited
            ? "RATE_LIMITED"
            : isTimeout
              ? "HTTP_TIMEOUT"
              : isUpstreamFailure
                ? "UPSTREAM_5XX"
                : isAccessRestricted
                  ? "UPSTREAM_ACCESS_RESTRICTED"
                : "INVALID_RESPONSE",
          message: isRateLimited
            ? retryAfter.exceedsMax
              ? "Binance rate limit requested a retry delay above the configured maximum."
              : "Binance rate limit was reached."
            : isTimeout
              ? "Binance public request timed out upstream."
              : isUpstreamFailure
                ? "Binance public endpoint returned an upstream server error."
                : isAccessRestricted
                  ? "Binance public endpoint access is restricted in this environment."
                : "Binance public endpoint returned an invalid HTTP status.",
          retryable,
          diagnostics: {
            ...requestDiagnostics,
            httpStatus: response.status,
            ...(retryAfter.delayMs !== undefined ? { retryAfterMs: retryAfter.delayMs } : {}),
            ...(isRateLimited ? { maxRetryDelayMs: BINANCE_MAX_RETRY_DELAY_MS } : {}),
          },
        });

        if (!retryable || attempt >= this.maxAttempts) {
          throw lastError;
        }
        const retryDelay = retryAfter.delayMs ?? this.getRetryDelay(attempt);
        await this.sleep(Math.min(BINANCE_MAX_RETRY_DELAY_MS, retryDelay));
        continue;
      }

      try {
        const data = (await response.json()) as T;
        return { data, diagnostics: requestDiagnostics };
      } catch {
        throw new MarketDataError({
          code: "INVALID_RESPONSE",
          message: "Binance public endpoint returned invalid JSON.",
          retryable: false,
          diagnostics: requestDiagnostics,
        });
      }
    }

    throw (
      lastError ??
      new MarketDataError({
        code: "NETWORK_ERROR",
        message: "Binance public request failed without a classified error.",
        retryable: true,
      })
    );
  }

  private getRetryDelay(attempt: number): number {
    const exponentialDelay = Math.min(BINANCE_MAX_RETRY_DELAY_MS, 100 * 2 ** (attempt - 1));
    return Math.min(
      BINANCE_MAX_RETRY_DELAY_MS,
      exponentialDelay + Math.floor(Math.max(0, Math.min(1, this.random())) * exponentialDelay),
    );
  }
}
