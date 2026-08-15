export const RESEARCH_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const;

export type ResearchSymbol = (typeof RESEARCH_SYMBOLS)[number];

export const TIMEFRAMES = {
  trend: "4h",
  signal: "1h",
} as const;

export const STRATEGY_VERSION = "baseline-001" as const;

export const SCORE_COMPONENTS = {
  trendStrength: 40,
  pullbackQuality: 20,
  breakoutStrength: 20,
  volume: 10,
  riskReward: 10,
} as const;

export const SIGNAL_GRADE_THRESHOLDS = {
  A: 85,
  B: 75,
  C: 70,
} as const;

export const FORWARD_TRACKING_POLICY = {
  takeProfitR: 2,
  timeExitCandles: 24,
  timeExitMinimumR: 0.5,
} as const;

export const EMAIL_GRADE_POLICY = {
  A: true,
  B: true,
  C: false,
} as const;
