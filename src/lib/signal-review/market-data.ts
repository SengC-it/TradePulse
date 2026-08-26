import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { BINANCE_HISTORICAL_KLINE_MAX_LIMIT } from "../market-data/intervals.ts";
import { BinancePublicClient } from "../market-data/binance/client.ts";

import { REVIEW_ONE_MINUTE_MS, type ReviewCandle, type ReviewMarketDataProvider } from "./types.ts";

export type ReviewMarketDataErrorCode =
  | "REVIEW_DATA_INVALID"
  | "REVIEW_DATA_INCOMPLETE"
  | "REVIEW_DATA_GAP"
  | "REVIEW_DATA_DUPLICATE"
  | "REVIEW_DATA_UNORDERED"
  | "REVIEW_DATA_FORMING_CANDLE";

export class ReviewMarketDataError extends Error {
  readonly code: ReviewMarketDataErrorCode;

  constructor(code: ReviewMarketDataErrorCode, message: string) {
    super(message);
    this.name = "ReviewMarketDataError";
    this.code = code;
  }
}

function numberValue(value: unknown, field: string): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review Kline " + field + " is empty.");
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review Kline " + field + " is not finite.");
  }
  return parsed;
}

function integerValue(value: unknown, field: string): number {
  const parsed = numberValue(value, field);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review Kline " + field + " is not a safe integer.");
  }
  return parsed;
}

function assertReviewCandle(candle: ReviewCandle): void {
  if (
    !Number.isSafeInteger(candle.openTime) ||
    candle.openTime < 0 ||
    candle.openTime % REVIEW_ONE_MINUTE_MS !== 0 ||
    candle.closeTime !== candle.openTime + REVIEW_ONE_MINUTE_MS - 1 ||
    !Number.isFinite(candle.open) ||
    !Number.isFinite(candle.high) ||
    !Number.isFinite(candle.low) ||
    !Number.isFinite(candle.close) ||
    candle.open <= 0 ||
    candle.high <= 0 ||
    candle.low <= 0 ||
    candle.close <= 0 ||
    !Number.isFinite(candle.volume) ||
    candle.volume < 0 ||
    !Number.isFinite(candle.quoteVolume) ||
    candle.quoteVolume < 0 ||
    !Number.isSafeInteger(candle.tradeCount) ||
    candle.tradeCount < 0 ||
    !Number.isFinite(candle.takerBuyBaseVolume) ||
    candle.takerBuyBaseVolume < 0 ||
    !Number.isFinite(candle.takerBuyQuoteVolume) ||
    candle.takerBuyQuoteVolume < 0 ||
    candle.high < candle.open ||
    candle.high < candle.close ||
    candle.high < candle.low ||
    candle.low > candle.open ||
    candle.low > candle.close
  ) {
    throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review Kline candle is malformed.");
  }
}

export function parseReviewKlinePayload(
  payload: unknown,
  symbol: ResearchSymbol,
): readonly ReviewCandle[] {
  if (!Array.isArray(payload)) {
    throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review Kline response is not an array.");
  }

  return Object.freeze(
    payload.map((row) => {
      if (!Array.isArray(row) || row.length !== 12) {
        throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review Kline row has an invalid shape.");
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
      const candle: ReviewCandle = {
        symbol,
        openTime: integerValue(openTime, "openTime"),
        closeTime: integerValue(closeTime, "closeTime"),
        open: numberValue(open, "open"),
        high: numberValue(high, "high"),
        low: numberValue(low, "low"),
        close: numberValue(close, "close"),
        volume: numberValue(volume, "volume"),
        quoteVolume: numberValue(quoteVolume, "quoteVolume"),
        tradeCount: integerValue(tradeCount, "tradeCount"),
        takerBuyBaseVolume: numberValue(takerBuyBaseVolume, "takerBuyBaseVolume"),
        takerBuyQuoteVolume: numberValue(takerBuyQuoteVolume, "takerBuyQuoteVolume"),
      };
      assertReviewCandle(candle);
      return Object.freeze(candle);
    }),
  );
}

export function validateClosedReviewCandles(input: Readonly<{
  candles: readonly ReviewCandle[];
  symbol: ResearchSymbol;
  startTime: number;
  endTime: number;
  serverTime: number;
}>): readonly ReviewCandle[] {
  const { candles, symbol, startTime, endTime, serverTime } = input;
  if (
    !Number.isSafeInteger(startTime) ||
    startTime < 0 ||
    startTime % REVIEW_ONE_MINUTE_MS !== 0 ||
    !Number.isSafeInteger(endTime) ||
    endTime < startTime ||
    !Number.isSafeInteger(serverTime)
  ) {
    throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review Kline range is invalid.");
  }

  const latestClosedOpenTime = Math.floor((serverTime - REVIEW_ONE_MINUTE_MS) / REVIEW_ONE_MINUTE_MS) * REVIEW_ONE_MINUTE_MS;
  const requestedLastOpenTime = Math.floor(endTime / REVIEW_ONE_MINUTE_MS) * REVIEW_ONE_MINUTE_MS;
  const expectedLastOpenTime = Math.min(requestedLastOpenTime, latestClosedOpenTime);
  if (expectedLastOpenTime < startTime) {
    return Object.freeze([]);
  }

  const closed = candles.filter((candle) => candle.closeTime < serverTime);
  if (closed.length === 0) {
    throw new ReviewMarketDataError("REVIEW_DATA_INCOMPLETE", "Review Kline response has no required closed candles.");
  }

  const seen = new Set<number>();
  for (let index = 0; index < closed.length; index += 1) {
    const candle = closed[index];
    if (candle.symbol !== symbol) {
      throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review Kline symbol is inconsistent.");
    }
    assertReviewCandle(candle);
    if (seen.has(candle.openTime)) {
      throw new ReviewMarketDataError("REVIEW_DATA_DUPLICATE", "Review Kline response contains duplicates.");
    }
    seen.add(candle.openTime);
    if (index > 0) {
      const previous = closed[index - 1];
      if (candle.openTime <= previous.openTime) {
        throw new ReviewMarketDataError("REVIEW_DATA_UNORDERED", "Review Kline response is not ascending.");
      }
      if (candle.openTime - previous.openTime !== REVIEW_ONE_MINUTE_MS) {
        throw new ReviewMarketDataError("REVIEW_DATA_GAP", "Review Kline response contains a gap.");
      }
    }
  }

  if (closed[0].openTime !== startTime || closed[closed.length - 1].openTime !== expectedLastOpenTime) {
    throw new ReviewMarketDataError("REVIEW_DATA_INCOMPLETE", "Review Kline response does not cover the required range.");
  }
  return Object.freeze([...closed]);
}

export class BinanceReviewMarketDataProvider implements ReviewMarketDataProvider {
  private readonly client: BinancePublicClient;

  constructor(client = new BinancePublicClient()) {
    this.client = client;
  }

  async getServerTime(): Promise<number> {
    const response = await this.client.getServerTime();
    return response.data.serverTime;
  }

  async getClosedCandles(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
    serverTime: number,
  ): Promise<readonly ReviewCandle[]> {
    if (!(RESEARCH_SYMBOLS as readonly string[]).includes(symbol)) {
      throw new ReviewMarketDataError("REVIEW_DATA_INVALID", "Review symbol is not approved.");
    }
    if (endTime < startTime) {
      return Object.freeze([]);
    }

    const effectiveEndTime = Math.min(endTime, serverTime - 1);
    if (effectiveEndTime < startTime) {
      return Object.freeze([]);
    }

    const allCandles: ReviewCandle[] = [];
    let cursor = startTime;
    while (cursor <= effectiveEndTime) {
      const response = await this.client.getOneMinuteKlinesRange(
        symbol,
        cursor,
        effectiveEndTime,
        BINANCE_HISTORICAL_KLINE_MAX_LIMIT,
      );
      const page = parseReviewKlinePayload(response.data, symbol);
      if (page.length === 0) {
        break;
      }
      for (const candle of page) {
        if (candle.openTime >= startTime && candle.openTime <= effectiveEndTime) {
          allCandles.push(candle);
        }
      }

      const lastOpenTime = page[page.length - 1].openTime;
      const nextCursor = lastOpenTime + REVIEW_ONE_MINUTE_MS;
      if (nextCursor <= cursor) {
        throw new ReviewMarketDataError("REVIEW_DATA_UNORDERED", "Review Kline pagination did not advance.");
      }
      cursor = nextCursor;
    }

    return validateClosedReviewCandles({
      candles: allCandles,
      symbol,
      startTime,
      endTime: effectiveEndTime,
      serverTime,
    });
  }
}
