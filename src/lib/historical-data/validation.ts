import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { validateCandle } from "../market-data/validation.ts";
import { INTERVAL_MS, isMarketTimeframe, type MarketTimeframe } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import { HistoricalDataError } from "./errors.ts";
import type { HistoricalFundingRecord } from "./types.ts";

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
  options: Readonly<{ symbol: ResearchSymbol; startTime?: number; endTime?: number }>,
): readonly HistoricalFundingRecord[] {
  const seen = new Set<number>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (
      record.symbol !== options.symbol ||
      !Number.isInteger(record.fundingTime) ||
      record.fundingTime < 0 ||
      !finiteNumber(record.fundingRate) ||
      !finiteNumber(record.markPrice) ||
      record.markPrice <= 0
    ) {
      throw new HistoricalDataError({
        code: record.markPrice <= 0 || !finiteNumber(record.markPrice) ? "MARK_PRICE_UNAVAILABLE" : "INVALID_FUNDING",
        message: "Funding records require a valid time, finite rate, and finite positive official markPrice.",
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

export const validateHistoricalCandles = validateHistoricalCandleSeries;
export const validateHistoricalFunding = validateFundingRecords;
