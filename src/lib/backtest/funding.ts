import type { HistoricalFundingRecord } from "../historical-data/types.ts";
import type { HistoricalMarkPriceCandle, HistoricalMarkPriceSegment } from "../historical-data/types.ts";
import type { BacktestPolicyVersion } from "./constants.ts";
import type {
  BacktestFundingCharge,
  BacktestFundingOrderAudit,
  BacktestSignalSnapshot,
} from "./types.ts";

export type FundingExitReason = "TP" | "SL" | "TIME_EXIT";

export type FundingResolution = Readonly<{
  charges: readonly BacktestFundingCharge[];
  ambiguous: boolean;
  audits?: readonly BacktestFundingOrderAudit[];
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
  exitMinute?: Readonly<{ openTime: number; closeTime: number }>;
}>): FundingResolution {
  const policy = input.policy ?? "bt-policy-001";
  const charges: BacktestFundingCharge[] = [];
  const audits: BacktestFundingOrderAudit[] = [];
  const intrabar = policy === "bt-policy-003";
  for (const event of input.funding) {
    if (event.fundingTime <= input.entryTime) continue;

    let include = true;
    let resolution: BacktestFundingOrderAudit["resolution"] = "ONE_HOUR_UNAMBIGUOUS";
    if (input.exitReason !== "TIME_EXIT") {
      if (event.fundingTime > input.exitCandle.closeTime) continue;
      if (event.fundingTime > input.exitCandle.openTime) {
        if (!intrabar) return { charges: Object.freeze([]), ambiguous: true };
        if (!input.exitMinute) {
          throw new Error("bt-policy-003 requires a resolved 1m exit minute for TP/SL.");
        }
        resolution = "ONE_MINUTE_RESOLVED";
        if (event.fundingTime <= input.exitMinute.openTime) {
          include = true;
        } else if (event.fundingTime > input.exitMinute.closeTime) {
          include = false;
        } else {
          resolution = "CONSERVATIVE_SAME_MINUTE";
        }
      }
    } else if (event.fundingTime > input.exitTime) {
      continue;
    }

    const direct = directMarkPrice(event);
    const fallbackCandle =
      direct === null && (policy === "bt-policy-002" || policy === "bt-policy-003")
        ? findPreEventMarkPrice(input.markPriceCandles ?? [], event.fundingTime)
        : null;
    const markPrice = direct ?? fallbackCandle?.close ?? null;
    if (markPrice === null) {
      throw new Error(
        policy === "bt-policy-002" || policy === "bt-policy-003"
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
    if (resolution === "CONSERVATIVE_SAME_MINUTE") {
      // A negative funding amount is a charge and is conservatively applied;
      // a positive amount is never converted into an artificial credit.
      include = fundingPnL <= 0;
    }
    if (intrabar) {
      audits.push(
        Object.freeze({
          symbol: event.symbol,
          fundingTime: event.fundingTime,
          fundingRate: event.fundingRate,
          theoreticalFundingPnL: Object.is(fundingPnL, -0) ? 0 : fundingPnL,
          included: include,
          resolution,
          exitCandleOpenTime: input.exitCandle.openTime,
          exitCandleCloseTime: input.exitCandle.closeTime,
          ...(input.exitMinute && resolution !== "ONE_HOUR_UNAMBIGUOUS"
            ? {
                exitMinuteOpenTime: input.exitMinute.openTime,
                exitMinuteCloseTime: input.exitMinute.closeTime,
              }
            : {}),
          markPrice,
          markPriceSource,
          ...(markPriceManifestSegment ? { markPriceManifestSegment } : {}),
        }),
      );
    }
    if (!include) continue;
    charges.push(
      Object.freeze({
        fundingTime: event.fundingTime,
        fundingRate: event.fundingRate,
        markPrice,
        ...((policy === "bt-policy-002" || policy === "bt-policy-003") ? { markPriceSource } : {}),
        ...((policy === "bt-policy-002" || policy === "bt-policy-003") && markPriceManifestSegment
          ? { markPriceManifestSegment }
          : {}),
        fundingPnL: Object.is(fundingPnL, -0) ? 0 : fundingPnL,
      }),
    );
  }
  return {
    charges: Object.freeze(charges),
    ambiguous: false,
    ...(intrabar ? { audits: Object.freeze(audits) } : {}),
  };
}
