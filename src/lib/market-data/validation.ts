import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";

import { MarketDataError } from "./errors.ts";
import { INTERVAL_MS, type MarketTimeframe } from "./intervals.ts";
import type { Candle, ClosedCandleDataset } from "./types.ts";

const NUMERIC_FIELDS = [
  "open",
  "high",
  "low",
  "close",
  "volume",
  "quoteVolume",
  "takerBuyBaseVolume",
  "takerBuyQuoteVolume",
] as const;

function isApprovedSymbol(value: string): value is ResearchSymbol {
  return (RESEARCH_SYMBOLS as readonly string[]).includes(value);
}

function assertFiniteNumber(value: number, field: string, candle: Candle): void {
  if (!Number.isFinite(value)) {
    throw new MarketDataError({
      code: "INVALID_NUMBER",
      message: `Candle ${field} must be finite.`,
      symbol: candle.symbol,
      timeframe: candle.timeframe,
      retryable: false,
    });
  }
}

export function validateCandle(candle: Candle, timeframe: MarketTimeframe): void {
  if (!isApprovedSymbol(candle.symbol)) {
    throw new MarketDataError({
      code: "INVALID_SYMBOL",
      message: "Candle symbol is outside the approved research universe.",
      retryable: false,
    });
  }

  if (candle.timeframe !== timeframe) {
    throw new MarketDataError({
      code: "INVALID_RESPONSE",
      message: "Candle timeframe does not match the requested timeframe.",
      symbol: candle.symbol,
      timeframe,
      retryable: false,
    });
  }

  if (
    !Number.isInteger(candle.openTime) ||
    candle.openTime < 0 ||
    !Number.isInteger(candle.closeTime) ||
    candle.closeTime < 0 ||
    candle.closeTime <= candle.openTime
  ) {
    throw new MarketDataError({
      code: "INVALID_TIMESTAMP",
      message: "Candle timestamps must be finite UTC epoch milliseconds with closeTime after openTime.",
      symbol: candle.symbol,
      timeframe,
      retryable: false,
    });
  }

  for (const field of NUMERIC_FIELDS) {
    assertFiniteNumber(candle[field], field, candle);
  }
  assertFiniteNumber(candle.tradeCount, "tradeCount", candle);

  if (
    candle.open <= 0 ||
    candle.high <= 0 ||
    candle.low <= 0 ||
    candle.close <= 0 ||
    candle.volume < 0 ||
    candle.quoteVolume < 0 ||
    candle.tradeCount < 0 ||
    candle.takerBuyBaseVolume < 0 ||
    candle.takerBuyQuoteVolume < 0 ||
    !Number.isInteger(candle.tradeCount)
  ) {
    throw new MarketDataError({
      code: "INVALID_NUMBER",
      message: "Candle numeric fields are outside their allowed ranges.",
      symbol: candle.symbol,
      timeframe,
      retryable: false,
    });
  }

  if (
    candle.high < candle.open ||
    candle.high < candle.close ||
    candle.high < candle.low ||
    candle.low > candle.open ||
    candle.low > candle.close
  ) {
    throw new MarketDataError({
      code: "INVALID_OHLC",
      message: "Candle OHLC relationships are invalid.",
      symbol: candle.symbol,
      timeframe,
      retryable: false,
    });
  }
}

export function buildClosedCandleDataset(input: {
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
  candles: readonly Candle[];
  serverTime: number;
  requiredClosedCandles?: number;
}): ClosedCandleDataset {
  const requiredClosedCandles = input.requiredClosedCandles ?? 250;
  const intervalMs = INTERVAL_MS[input.timeframe];

  if (!Number.isInteger(input.serverTime) || input.serverTime < 0) {
    throw new MarketDataError({
      code: "SERVER_TIME_UNAVAILABLE",
      message: "Binance server time is unavailable or invalid.",
      retryable: true,
    });
  }

  const seenOpenTimes = new Set<number>();
  for (const candle of input.candles) {
    if (candle.symbol !== input.symbol) {
      throw new MarketDataError({
        code: "INVALID_RESPONSE",
        message: "Candle symbol does not match the requested dataset symbol.",
        symbol: input.symbol,
        timeframe: input.timeframe,
        retryable: false,
      });
    }
    validateCandle(candle, input.timeframe);

    if (seenOpenTimes.has(candle.openTime)) {
      throw new MarketDataError({
        code: "DUPLICATE_CANDLE",
        message: "The kline response contains duplicate candle open times.",
        symbol: input.symbol,
        timeframe: input.timeframe,
        retryable: false,
        diagnostics: { actualLatestOpenTime: candle.openTime },
      });
    }
    seenOpenTimes.add(candle.openTime);
  }

  for (let index = 1; index < input.candles.length; index += 1) {
    const previous = input.candles[index - 1];
    const current = input.candles[index];

    if (current.openTime < previous.openTime) {
      throw new MarketDataError({
        code: "OUT_OF_ORDER_CANDLES",
        message: "The kline response is not ordered by ascending open time.",
        symbol: input.symbol,
        timeframe: input.timeframe,
        retryable: false,
        diagnostics: {
          previousOpenTime: previous.openTime,
          nextOpenTime: current.openTime,
        },
      });
    }
  }

  for (let index = 1; index < input.candles.length; index += 1) {
    const previous = input.candles[index - 1];
    const current = input.candles[index];
    const actualIntervalMs = current.openTime - previous.openTime;
    if (actualIntervalMs !== intervalMs) {
      throw new MarketDataError({
        code: "CANDLE_GAP",
        message: "The kline response contains a missing or misaligned candle.",
        symbol: input.symbol,
        timeframe: input.timeframe,
        retryable: false,
        diagnostics: {
          previousOpenTime: previous.openTime,
          nextOpenTime: current.openTime,
          expectedIntervalMs: intervalMs,
          actualIntervalMs,
        },
      });
    }
  }

  const closedCandles = input.candles.filter((candle) => candle.closeTime < input.serverTime);
  if (closedCandles.length < requiredClosedCandles) {
    throw new MarketDataError({
      code: "INSUFFICIENT_HISTORY",
      message: "The response does not contain the required number of closed candles.",
      symbol: input.symbol,
      timeframe: input.timeframe,
      retryable: false,
      diagnostics: {
        requiredCandles: requiredClosedCandles,
        receivedCandles: closedCandles.length,
      },
    });
  }

  const recentClosedCandles = closedCandles.slice(-requiredClosedCandles);
  const expectedLatestOpenTime =
    Math.floor(input.serverTime / intervalMs) * intervalMs - intervalMs;
  const actualLatestOpenTime = recentClosedCandles[recentClosedCandles.length - 1]?.openTime;

  if (actualLatestOpenTime !== expectedLatestOpenTime) {
    throw new MarketDataError({
      code: "STALE_DATA",
      message: "The latest closed candle is not the expected most recent candle.",
      symbol: input.symbol,
      timeframe: input.timeframe,
      retryable: false,
      diagnostics: {
        expectedLatestOpenTime,
        actualLatestOpenTime,
      },
    });
  }

  return Object.freeze({
    symbol: input.symbol,
    timeframe: input.timeframe,
    serverTime: input.serverTime,
    expectedLatestOpenTime,
    candles: Object.freeze([...recentClosedCandles]),
  });
}
