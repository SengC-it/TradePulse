import { BACKTEST_PERIOD_RANGES, BACKTEST_POLICY, type BacktestPeriod } from "./constants.ts";
import { INTERVAL_MS, type MarketTimeframe } from "../market-data/intervals.ts";
import type { HistoricalRange } from "../historical-data/types.ts";

export type HistoricalLoadRanges = Readonly<{
  candleRange: Readonly<Record<"1h" | "4h", HistoricalRange>>;
  fundingRange: HistoricalRange;
  settlementTail?: Readonly<{
    candleRange: HistoricalRange;
    fundingRange: HistoricalRange;
  }>;
}>;

function floorToInterval(value: number, interval: number): number {
  return Math.floor(value / interval) * interval;
}

function periodBounds(period: BacktestPeriod): Readonly<{
  startTime: number;
  endTime: number;
}> {
  return Object.freeze({
    startTime: period === "OOS" ? BACKTEST_PERIOD_RANGES.OOS.startTime : BACKTEST_PERIOD_RANGES.DEV.startTime,
    endTime: period === "DEV" ? BACKTEST_PERIOD_RANGES.DEV.endTime : BACKTEST_PERIOD_RANGES.OOS.endTime,
  });
}

/**
 * Builds the exact historical request ranges used by the formal CLI loader.
 * Indicator warm-up is deliberately separate from the 250-candle strategy window.
 */
export function buildHistoricalLoadRanges(period: BacktestPeriod): HistoricalLoadRanges {
  const bounds = periodBounds(period);
  const lookbackStart1h = bounds.startTime - BACKTEST_POLICY.historicalLookback1h * INTERVAL_MS["1h"];
  const lookbackStart4h = bounds.startTime - BACKTEST_POLICY.historicalLookback4h * INTERVAL_MS["4h"];
  const baseEnd1h = floorToInterval(bounds.endTime, INTERVAL_MS["1h"]);
  const baseEnd4h = floorToInterval(bounds.endTime, INTERVAL_MS["4h"]);

  const ranges: HistoricalLoadRanges = {
    candleRange: {
      "1h": {
        startTime: floorToInterval(lookbackStart1h, INTERVAL_MS["1h"]),
        endTime: baseEnd1h,
      },
      "4h": {
        startTime: floorToInterval(lookbackStart4h, INTERVAL_MS["4h"]),
        endTime: baseEnd4h,
      },
    } satisfies Readonly<Record<MarketTimeframe, HistoricalRange>>,
    // Funding timestamps are event timestamps, not candle opens. Cover the
    // complete frozen period, including its final millisecond.
    fundingRange: {
      startTime: lookbackStart4h,
      endTime: bounds.endTime,
    },
  };

  if (period !== "DEV") {
    const tailStart = bounds.endTime + 1;
    const tailCandleEnd = baseEnd1h + BACKTEST_POLICY.heldCandleCount * INTERVAL_MS["1h"];
    const tailFundingEnd = tailCandleEnd + INTERVAL_MS["1h"] - 1;
    return Object.freeze({
      ...ranges,
      settlementTail: Object.freeze({
        candleRange: Object.freeze({
          startTime: tailStart,
          endTime: tailCandleEnd,
          settlementOnly: true,
        }),
        fundingRange: Object.freeze({
          startTime: tailStart,
          endTime: tailFundingEnd,
          settlementOnly: true,
        }),
      }),
    });
  }

  return Object.freeze(ranges);
}

export const loadRanges = buildHistoricalLoadRanges;
