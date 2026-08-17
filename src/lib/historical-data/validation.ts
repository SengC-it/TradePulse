import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { validateCandle } from "../market-data/validation.ts";
import { INTERVAL_MS, isMarketTimeframe, type MarketTimeframe } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import { HistoricalDataError } from "./errors.ts";
import type {
  HistoricalFundingRecord,
  HistoricalMarkPriceCandle,
  IntrabarSettlementCandle,
} from "./types.ts";

function assertRange(startTime: number, endTime: number, label: string): void {
  if (!Number.isInteger(startTime) || startTime < 0 || !Number.isInteger(endTime) || endTime < startTime) {
    throw new HistoricalDataError({
      code: "INVALID_RANGE",
      message: `${label} range must be an ordered non-negative UTC epoch interval.`,
    });
  }
}

function isResearchSymbol(value: string): value is ResearchSymbol {
  return (RESEARCH_SYMBOLS as readonly string[]).includes(value);
}

export type HistoricalCandleValidationOptions = Readonly<{
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
  expectedStartTime?: number;
  expectedEndTime?: number;
  /** Binance server time captured once for the enclosing load operation. */
  serverTime?: number;
}>;

export function validateHistoricalCandleSeries(
  candles: readonly Candle[],
  options: HistoricalCandleValidationOptions,
): readonly Candle[] {
  const intervalMs = INTERVAL_MS[options.timeframe];
  if (!isResearchSymbol(options.symbol) || !isMarketTimeframe(options.timeframe)) {
    throw new HistoricalDataError({
      code: "INVALID_HISTORICAL_DATA",
      message: "Historical candle validation received an unapproved symbol or timeframe.",
      symbol: options.symbol,
      timeframe: options.timeframe,
    });
  }

  if (candles.length === 0) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Historical candle response is empty.",
      symbol: options.symbol,
      timeframe: options.timeframe,
    });
  }

  const seen = new Set<number>();
  if (
    options.serverTime !== undefined &&
    (!Number.isInteger(options.serverTime) || options.serverTime < 0)
  ) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Authoritative Binance server time is invalid.",
      symbol: options.symbol,
      timeframe: options.timeframe,
    });
  }
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    try {
      validateCandle(candle, options.timeframe);
    } catch (error) {
      throw new HistoricalDataError({
        code: "INVALID_HISTORICAL_DATA",
        message: error instanceof Error ? error.message : "Historical candle is invalid.",
        symbol: options.symbol,
        timeframe: options.timeframe,
      });
    }

    if (candle.symbol !== options.symbol || candle.timeframe !== options.timeframe) {
      throw new HistoricalDataError({
        code: "INVALID_HISTORICAL_DATA",
        message: "Historical candle identity does not match the requested dataset.",
        symbol: options.symbol,
        timeframe: options.timeframe,
      });
    }

    if (seen.has(candle.openTime)) {
      throw new HistoricalDataError({
        code: "DUPLICATE_CANDLE",
        message: "Historical candle open times must be unique.",
        symbol: options.symbol,
        timeframe: options.timeframe,
        diagnostics: { openTime: candle.openTime },
      });
    }
    seen.add(candle.openTime);

    if (
      candle.openTime % intervalMs !== 0 ||
      candle.closeTime !== candle.openTime + intervalMs - 1
    ) {
      throw new HistoricalDataError({
        code: "INVALID_HISTORICAL_DATA",
        message: "Historical candle timestamps are not exactly timeframe-aligned.",
        symbol: options.symbol,
        timeframe: options.timeframe,
        diagnostics: { openTime: candle.openTime, closeTime: candle.closeTime, intervalMs },
      });
    }

    if (options.serverTime !== undefined && candle.closeTime >= options.serverTime) {
      throw new HistoricalDataError({
        code: "DATA_INCOMPLETE",
        message: "Historical candle is not fully closed according to Binance server time.",
        symbol: options.symbol,
        timeframe: options.timeframe,
        diagnostics: { candleCloseTime: candle.closeTime, serverTime: options.serverTime },
      });
    }

    const previous = candles[index - 1];
    if (previous) {
      const actualInterval = candle.openTime - previous.openTime;
      if (actualInterval <= 0) {
        throw new HistoricalDataError({
          code: "OUT_OF_ORDER_CANDLES",
          message: "Historical candles must be strictly chronological.",
          symbol: options.symbol,
          timeframe: options.timeframe,
        });
      }
      if (actualInterval !== intervalMs) {
        throw new HistoricalDataError({
          code: "CANDLE_GAP",
          message: "Historical candle series contains a missing or repeated interval.",
          symbol: options.symbol,
          timeframe: options.timeframe,
          diagnostics: { expectedIntervalMs: intervalMs, actualIntervalMs: actualInterval },
        });
      }
    }
  }

  const first = candles[0]?.openTime;
  const last = candles[candles.length - 1]?.openTime;
  if (options.expectedStartTime !== undefined) {
    assertRange(options.expectedStartTime, options.expectedEndTime ?? options.expectedStartTime, "Historical candle");
    if (first !== options.expectedStartTime) {
      throw new HistoricalDataError({
        code: "DATA_INCOMPLETE",
        message: "Historical candle series does not begin at the required open time.",
        symbol: options.symbol,
        timeframe: options.timeframe,
        diagnostics: { expectedStartTime: options.expectedStartTime, actualStartTime: first ?? -1 },
      });
    }
  }
  if (options.expectedEndTime !== undefined && last !== options.expectedEndTime) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Historical candle series does not end at the required open time.",
      symbol: options.symbol,
      timeframe: options.timeframe,
      diagnostics: { expectedEndTime: options.expectedEndTime, actualEndTime: last ?? -1 },
    });
  }

  return Object.freeze([...candles]);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateFundingRecords(
  records: readonly HistoricalFundingRecord[],
  options: Readonly<{
    symbol: ResearchSymbol;
    startTime?: number;
    endTime?: number;
    policy?: "bt-policy-001" | "bt-policy-002" | "bt-policy-003";
  }>,
): readonly HistoricalFundingRecord[] {
  const policy = options.policy ?? "bt-policy-001";
  const seen = new Set<number>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const directMarkPrice = record?.directMarkPrice;
    const directMarkPriceValid = finiteNumber(directMarkPrice) && directMarkPrice > 0;
    if (
      record.symbol !== options.symbol ||
      !Number.isInteger(record.fundingTime) ||
      record.fundingTime < 0 ||
      !finiteNumber(record.fundingRate) ||
      (policy === "bt-policy-001" && !directMarkPriceValid)
    ) {
      throw new HistoricalDataError({
        code: policy === "bt-policy-001" && !directMarkPriceValid ? "MARK_PRICE_UNAVAILABLE" : "INVALID_FUNDING",
        message:
          policy === "bt-policy-001"
            ? "Legacy funding records require a finite positive official markPrice."
            : "Funding records require a valid time and finite rate; direct markPrice may be resolved by policy.",
        symbol: options.symbol,
      });
    }
    if (seen.has(record.fundingTime)) {
      throw new HistoricalDataError({
        code: "INVALID_FUNDING",
        message: "Funding records must be duplicate-free.",
        symbol: options.symbol,
      });
    }
    seen.add(record.fundingTime);
    const previous = records[index - 1];
    if (previous && record.fundingTime <= previous.fundingTime) {
      throw new HistoricalDataError({
        code: "OUT_OF_ORDER_CANDLES",
        message: "Funding records must be strictly chronological.",
        symbol: options.symbol,
      });
    }
    if (options.startTime !== undefined && record.fundingTime < options.startTime) {
      throw new HistoricalDataError({
        code: "INVALID_FUNDING",
        message: "Funding record is outside the requested range.",
        symbol: options.symbol,
      });
    }
    if (options.endTime !== undefined && record.fundingTime > options.endTime) {
      throw new HistoricalDataError({
        code: "INVALID_FUNDING",
        message: "Funding record is outside the requested range.",
        symbol: options.symbol,
      });
    }
  }
  return Object.freeze([...records]);
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export type HistoricalMarkPriceValidationOptions = Readonly<{
  symbol: ResearchSymbol;
  serverTime: number;
  expectedStartTime?: number;
  expectedEndTime?: number;
}>;

export function validateMarkPriceCandleSeries(
  candles: readonly HistoricalMarkPriceCandle[],
  options: HistoricalMarkPriceValidationOptions,
): readonly HistoricalMarkPriceCandle[] {
  if (
    !Number.isInteger(options.serverTime) ||
    options.serverTime < 0 ||
    candles.length === 0
  ) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Required mark-price Kline data is empty or has invalid server time.",
      symbol: options.symbol,
    });
  }

  const interval = INTERVAL_MS["1h"];
  const firstExpected =
    options.expectedStartTime === undefined
      ? undefined
      : Math.ceil(options.expectedStartTime / interval) * interval;
  const lastExpected =
    options.expectedEndTime === undefined
      ? undefined
      : Math.floor(options.expectedEndTime / interval) * interval;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const expectedOpen = index === 0 ? undefined : candles[index - 1]!.openTime + interval;
    if (
      candle.symbol !== options.symbol ||
      !Number.isInteger(candle.openTime) ||
      candle.openTime < 0 ||
      candle.openTime % interval !== 0 ||
      !Number.isInteger(candle.closeTime) ||
      candle.closeTime !== candle.openTime + interval - 1 ||
      (expectedOpen !== undefined && candle.openTime !== expectedOpen) ||
      !finitePositive(candle.open) ||
      !finitePositive(candle.high) ||
      !finitePositive(candle.low) ||
      !finitePositive(candle.close) ||
      candle.high < candle.low ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) ||
      candle.closeTime >= options.serverTime
    ) {
      throw new HistoricalDataError({
        code: "DATA_INCOMPLETE",
        message: "Mark-price Kline data is malformed, non-contiguous, or not fully closed.",
        symbol: options.symbol,
        diagnostics: { index },
      });
    }
  }

  const first = candles[0]!.openTime;
  const last = candles[candles.length - 1]!.openTime;
  if (firstExpected !== undefined && first !== firstExpected) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Mark-price Kline data does not begin at the requested boundary.",
      symbol: options.symbol,
      diagnostics: { expectedStartTime: firstExpected, actualStartTime: first },
    });
  }
  if (lastExpected !== undefined && last !== lastExpected) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Mark-price Kline data does not end at the requested boundary.",
      symbol: options.symbol,
      diagnostics: { expectedEndTime: lastExpected, actualEndTime: last },
    });
  }

  return Object.freeze([...candles]);
}

export function validateIntrabarSettlementWindow(
  candles: readonly IntrabarSettlementCandle[],
  options: Readonly<{
    symbol: ResearchSymbol;
    exitCandleOpenTime: number;
    exitCandleCloseTime: number;
    serverTime: number;
  }>,
): readonly IntrabarSettlementCandle[] {
  const interval = 60_000;
  if (
    candles.length !== 60 ||
    !Number.isInteger(options.exitCandleOpenTime) ||
    options.exitCandleOpenTime < 0 ||
    options.exitCandleOpenTime % INTERVAL_MS["1h"] !== 0 ||
    !Number.isInteger(options.exitCandleCloseTime) ||
    options.exitCandleCloseTime !== options.exitCandleOpenTime + INTERVAL_MS["1h"] - 1 ||
    !Number.isInteger(options.serverTime) ||
    options.serverTime < 0
  ) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Intrabar settlement requires exactly 60 valid 1m candles and one valid study server time.",
      symbol: options.symbol,
    });
  }

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const expectedOpen = options.exitCandleOpenTime + index * interval;
    const expectedClose = expectedOpen + interval - 1;
    const values = [
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.quoteVolume,
      candle.tradeCount,
      candle.takerBuyBaseVolume,
      candle.takerBuyQuoteVolume,
    ];
    if (
      candle.symbol !== options.symbol ||
      candle.timeframe !== "1m" ||
      candle.openTime !== expectedOpen ||
      candle.closeTime !== expectedClose ||
      candle.closeTime >= options.serverTime ||
      values.some((value) => !Number.isFinite(value)) ||
      candle.open <= 0 ||
      candle.high <= 0 ||
      candle.low <= 0 ||
      candle.close <= 0 ||
      candle.volume < 0 ||
      candle.quoteVolume < 0 ||
      candle.tradeCount < 0 ||
      !Number.isInteger(candle.tradeCount) ||
      candle.takerBuyBaseVolume < 0 ||
      candle.takerBuyQuoteVolume < 0 ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) ||
      candle.high < candle.low
    ) {
      throw new HistoricalDataError({
        code: "DATA_INCOMPLETE",
        message: "Intrabar settlement Kline data is malformed, non-contiguous, or not fully closed.",
        symbol: options.symbol,
        diagnostics: { index, expectedOpen, expectedClose },
      });
    }
  }

  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  if (first.openTime !== options.exitCandleOpenTime || last.closeTime !== options.exitCandleCloseTime) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Intrabar settlement window does not exactly cover the frozen 1H exit candle.",
      symbol: options.symbol,
    });
  }
  return Object.freeze([...candles]);
}

export const validateHistoricalCandles = validateHistoricalCandleSeries;
export const validateHistoricalFunding = validateFundingRecords;
