import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import type { BTCRegime, SignalGrade, StrategyDirection, SymbolRegime } from "../strategy/types.ts";

export const RESEARCH_DIAGNOSTICS_SCHEMA_VERSION = "m3-g-research-diagnostics-001" as const;
export const RESEARCH_CONTROL_EXPERIMENT_ID = "CONTROL_BASELINE_001" as const;
export const RESEARCH_CONTROL_VARIANT_ID = "CONTROL_BASELINE_001" as const;

export const RESEARCH_HYPOTHESIS_IDS = Object.freeze([
  "H1_SIGNAL_REDUNDANCY",
  "H2_COST_ADJUSTED_EDGE",
  "H3_SCORE_CALIBRATION",
  "H4_SIGNAL_DENSITY",
  "H5_REGIME_QUALITY",
] as const);
export type ResearchHypothesisId = (typeof RESEARCH_HYPOTHESIS_IDS)[number];

export const RESEARCH_FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);
export type ResearchFoldId = (typeof RESEARCH_FOLD_IDS)[number];

export const RESEARCH_FOLD_ROLES = Object.freeze(["RESEARCH", "VALIDATION"] as const);
export type ResearchFoldRole = (typeof RESEARCH_FOLD_ROLES)[number];

export const RESEARCH_DATA_CLASSIFICATIONS = Object.freeze([
  "RESEARCH_AVAILABLE_SEEN_DATA",
  "SYNTHETIC_FIXTURE",
] as const);
export type ResearchDataClassification = (typeof RESEARCH_DATA_CLASSIFICATIONS)[number];

export const RESEARCH_SIGNAL_STATUSES = Object.freeze([
  "EXECUTED",
  "PERIOD_END_CENSORED",
  "ENTRY_OUTSIDE_BRACKET",
  "DATA_INCOMPLETE",
  "SETTLEMENT_AMBIGUOUS",
  "NOT_EXECUTED",
] as const);
export type ResearchSignalStatus = (typeof RESEARCH_SIGNAL_STATUSES)[number];

export const RESEARCH_DIRECTION_ORDER = Object.freeze(["LONG", "SHORT"] as const);
export const RESEARCH_GRADE_ORDER = Object.freeze(["A", "B", "C", "UNGRADED"] as const);
export const RESEARCH_BTC_REGIME_ORDER = Object.freeze([
  "BTC_STRONG_BULL",
  "BTC_NEUTRAL",
  "BTC_STRONG_BEAR",
] as const);
export const RESEARCH_SYMBOL_REGIME_ORDER = Object.freeze([
  "LONG_ONLY",
  "SHORT_ONLY",
  "NO_TRADE",
] as const);
export const RESEARCH_SYMBOL_ORDER = Object.freeze([...RESEARCH_SYMBOLS]) as readonly ResearchSymbol[];

export type ResearchDirection = StrategyDirection;
export type ResearchGrade = SignalGrade;
export type ResearchBtcRegime = BTCRegime;
export type ResearchSymbolRegime = SymbolRegime;

export const RESEARCH_BACKTEST_POLICY_VERSION = "bt-policy-003" as const;
