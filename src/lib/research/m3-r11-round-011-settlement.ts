import { BACKTEST_PERIOD_RANGES, BACKTEST_POLICY } from "../backtest/constants.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";

export const R11_EVENT_HOLDING_CANDLES = BACKTEST_POLICY.heldCandleCount;

export type R11SettlementHorizonStatus = "FULL_HORIZON_AVAILABLE" | "PERIOD_END_CENSORED";

/** The last required held candle is measured from the signal candle's open. */
export function r11ExpectedHeldLastClose(signalCandleOpenTime: number, heldCandleCount = R11_EVENT_HOLDING_CANDLES): number {
  return signalCandleOpenTime + (heldCandleCount + 1) * INTERVAL_MS["1h"] - 1;
}
export function classifyR11SettlementHorizon(
  signalCandleOpenTime: number,
  period: keyof typeof BACKTEST_PERIOD_RANGES,
  heldCandleCount = R11_EVENT_HOLDING_CANDLES,
): R11SettlementHorizonStatus {
  return r11ExpectedHeldLastClose(signalCandleOpenTime, heldCandleCount) > BACKTEST_PERIOD_RANGES[period].endTime
    ? "PERIOD_END_CENSORED"
    : "FULL_HORIZON_AVAILABLE";
}
