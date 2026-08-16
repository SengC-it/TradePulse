import { STRATEGY_VERSION, type ResearchSymbol } from "../config/constants.ts";
import type { Candle } from "../market-data/types.ts";

export const STRATEGY_DIRECTIONS = ["LONG", "SHORT"] as const;

export type StrategyDirection = (typeof STRATEGY_DIRECTIONS)[number];

export type SymbolRegime = "LONG_ONLY" | "SHORT_ONLY" | "NO_TRADE";

export type BTCRegime =
  | "BTC_STRONG_BULL"
  | "BTC_NEUTRAL"
  | "BTC_STRONG_BEAR";

export type SignalGrade = "A" | "B" | "C";

export const STRATEGY_REASON_CODES = [
  "INSUFFICIENT_HISTORY",
  "INDICATOR_UNAVAILABLE",
  "INVALID_CANDLE_SERIES",
  "INVALID_ATR",
  "INVALID_VOLUME_BASELINE",
  "INVALID_BTC_INPUT",
  "SYMBOL_REGIME_NO_TRADE",
  "SYMBOL_DIRECTION_MISMATCH",
  "BTC_DIRECTION_BLOCKED",
  "PULLBACK_NOT_FOUND",
  "BREAKOUT_NOT_CONFIRMED",
  "RSI_OUT_OF_RANGE",
  "STOP_ATR_OUT_OF_RANGE",
  "SCORE_UNAVAILABLE",
] as const;

export type StrategyReasonCode = (typeof STRATEGY_REASON_CODES)[number];

export type StrategyDataset = Readonly<{
  symbol: ResearchSymbol;
  candles1h: readonly Candle[];
  candles4h: readonly Candle[];
}>;

export type StrategyInput = Readonly<{
  datasets: Readonly<Record<ResearchSymbol, StrategyDataset | null>>;
}>;

export type StrategyScoreBreakdown = Readonly<{
  trendStrength: number;
  pullbackQuality: number;
  breakoutStrength: number;
  volumeScore: number;
  riskRewardScore: number;
}>;

export type StrategyEvaluationStatus =
  | "INVALID"
  | "NO_ELIGIBLE_CANDIDATE"
  | "CANDIDATE_BELOW_THRESHOLD"
  | "FORMAL_SIGNAL";

export type StrategyCandidate = Readonly<{
  strategyVersion: typeof STRATEGY_VERSION;
  symbol: ResearchSymbol;
  direction: StrategyDirection;
  symbolRegime: SymbolRegime;
  btcRegime: BTCRegime;
  entryReference: number;
  stopReference: number;
  takeProfitReference: number;
  stopDistance: number;
  stopAtr: number;
  breakdown: StrategyScoreBreakdown;
  totalScore: number;
  grade: SignalGrade | null;
  formalSignal: boolean;
}>;

export type StrategyEvaluation = Readonly<{
  strategyVersion: typeof STRATEGY_VERSION;
  symbol: ResearchSymbol;
  direction: StrategyDirection;
  status: StrategyEvaluationStatus;
  reason: StrategyReasonCode | null;
  symbolRegime: SymbolRegime | null;
  btcRegime: BTCRegime | null;
  candidate: StrategyCandidate | null;
}>;

export type StrategyEngineResult = Readonly<{
  strategyVersion: typeof STRATEGY_VERSION;
  btcRegime: BTCRegime | null;
  evaluations: readonly StrategyEvaluation[];
  rankedCandidates: readonly StrategyCandidate[];
}>;
