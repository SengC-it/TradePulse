import type { HistoricalFundingRecord } from "../historical-data/types.ts";
import type { HistoricalMarkPriceCandle, HistoricalMarkPriceSegment } from "../historical-data/types.ts";
import type { BacktestPolicyVersion } from "./constants.ts";
import type { BacktestFundingCharge, BacktestSignalSnapshot } from "./types.ts";

export type FundingExitReason = "TP" | "SL" | "TIME_EXIT";

export type FundingResolution = Readonly<{
  charges: readonly BacktestFundingCharge[];
  ambiguous: boolean;
}>;

function directMarkPrice(event: HistoricalFundingRecord): number | null {
  const value = event.directMarkPrice;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function findPreEventMarkPrice(
  candles: readonly HistoricalMarkPriceCandle[],
  fundingTime: number,
): HistoricalMarkPriceCandle | null {
  let low = 0;
  let high = candles.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (candles[middle]!.closeTime < fundingTime) low = middle + 1;
    else high = middle;
  }
  const candidate = candles[low - 1];
  return candidate &&
    candidate.closeTime < fundingTime &&
    Number.isFinite(candidate.close) &&
    candidate.close > 0
    ? candidate
    : null;
}

function sameMarkPriceCandle(left: HistoricalMarkPriceCandle, right: HistoricalMarkPriceCandle): boolean {
  return (
    left === right ||
    (left.symbol === right.symbol &&
      left.openTime === right.openTime &&
      left.closeTime === right.closeTime &&
      left.open === right.open &&
      left.high === right.high &&
      left.low === right.low &&
      left.close === right.close)
  );
}

function findMarkPriceManifestSegment(
  candle: HistoricalMarkPriceCandle,
  segments: readonly HistoricalMarkPriceSegment[] | undefined,
  baseEndTime: number | undefined,
): "base" | "settlement-tail" | undefined {
  if (segments) {
    return segments.find((segment) => segment.candles.some((candidate) => sameMarkPriceCandle(candidate, candle)))?.segment;
  }
  if (baseEndTime !== undefined) {
    return candle.closeTime <= baseEndTime ? "base" : "settlement-tail";
  }
  return undefined;
}

export function resolveFundingCharges(input: Readonly<{
  funding: readonly HistoricalFundingRecord[];
  entryTime: number;
  exitReason: FundingExitReason;
  exitCandle: Readonly<{ openTime: number; closeTime: number }>;
  exitTime: number;
  direction: BacktestSignalSnapshot["direction"];
  policy?: BacktestPolicyVersion;
  markPriceCandles?: readonly HistoricalMarkPriceCandle[];
  markPriceSegments?: readonly HistoricalMarkPriceSegment[];
  markPriceBaseEndTime?: number;
}>): FundingResolution {
  const policy = input.policy ?? "bt-policy-001";
  const charges: BacktestFundingCharge[] = [];
  for (const event of input.funding) {
    if (event.fundingTime <= input.entryTime) continue;

    if (input.exitReason !== "TIME_EXIT") {
      if (event.fundingTime > input.exitCandle.closeTime) continue;
      if (event.fundingTime > input.exitCandle.openTime) {
        return { charges: Object.freeze([]), ambiguous: true };
      }
    } else if (event.fundingTime > input.exitTime) {
      continue;
    }

    const direct = directMarkPrice(event);
    const fallbackCandle =
      direct === null && policy === "bt-policy-002"
        ? findPreEventMarkPrice(input.markPriceCandles ?? [], event.fundingTime)
        : null;
    const markPrice = direct ?? fallbackCandle?.close ?? null;
    if (markPrice === null) {
      throw new Error(
        policy === "bt-policy-002"
          ? `No valid pre-event mark-price Kline exists for funding time ${event.fundingTime}.`
          : `Funding history markPrice is invalid for funding time ${event.fundingTime}.`,
      );
    }
    const markPriceSource = direct !== null ? "FUNDING_RATE_HISTORY" : "MARK_PRICE_KLINE_PRE_EVENT_CLOSE";
    const markPriceManifestSegment =
      fallbackCandle
        ? findMarkPriceManifestSegment(fallbackCandle, input.markPriceSegments, input.markPriceBaseEndTime)
        : undefined;
    const fundingPnL =
      input.direction === "LONG"
        ? -event.fundingRate * markPrice
        : event.fundingRate * markPrice;
    if (!Number.isFinite(fundingPnL)) {
      throw new Error("Funding calculation produced a non-finite value.");
    }
    charges.push(
      Object.freeze({
        fundingTime: event.fundingTime,
        fundingRate: event.fundingRate,
        markPrice,
        ...(policy === "bt-policy-002" ? { markPriceSource } : {}),
        ...(policy === "bt-policy-002" && markPriceManifestSegment ? { markPriceManifestSegment } : {}),
        fundingPnL: Object.is(fundingPnL, -0) ? 0 : fundingPnL,
      }),
    );
  }
  return { charges: Object.freeze(charges), ambiguous: false };
}
