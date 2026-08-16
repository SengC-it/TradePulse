import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";

export const BACKTEST_POLICY_VERSION = "bt-policy-001" as const;
export const BACKTEST_PERIODS = ["DEV", "OOS", "COMBINED"] as const;
export type BacktestPeriod = (typeof BACKTEST_PERIODS)[number];

export const BACKTEST_PERIOD_RANGES = Object.freeze({
  DEV: Object.freeze({
    startTime: Date.parse("2023-01-01T00:00:00.000Z"),
    endTime: Date.parse("2025-12-31T23:59:59.999Z"),
  }),
  OOS: Object.freeze({
    startTime: Date.parse("2026-01-01T00:00:00.000Z"),
    endTime: Date.parse("2026-08-15T23:59:59.999Z"),
  }),
});

export const BACKTEST_POLICY = Object.freeze({
  strategyWindowCandles: 250,
  indicatorWarmupMinimum1h: 55,
  indicatorWarmupMinimum4h: 205,
  historicalLookback1h: 250,
  historicalLookback4h: 250,
  // Compatibility names retained for the frozen M3-A documentation contract.
  warmupCandles1h: 55,
  warmupCandles4h: 205,
  slippageRate: 0.0005,
  feeRate: 0.0005,
  takeProfitR: 2,
  heldCandleCount: 24,
  signalLevelDisclaimer: "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.",
});

export const BACKTEST_SYMBOL_ORDER = Object.freeze([...RESEARCH_SYMBOLS]) as readonly ResearchSymbol[];
export const BACKTEST_DIRECTION_ORDER = ["LONG", "SHORT"] as const;
export const BACKTEST_GRADE_ORDER = ["A", "B", "C"] as const;
export const BACKTEST_BTC_REGIME_ORDER = ["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"] as const;

export function isBacktestPeriod(value: unknown): value is BacktestPeriod {
  return BACKTEST_PERIODS.includes(value as BacktestPeriod);
}
