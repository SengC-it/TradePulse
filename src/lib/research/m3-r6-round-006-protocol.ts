import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { BACKTEST_POLICY } from "../backtest/constants.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import { RESEARCH_FOLD_IDS, type ResearchFoldId } from "./constants.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import { deepFreeze } from "./utils.ts";

export const M3_R6_RESEARCH_ROUND_ID = "baseline-002-research-round-006" as const;
export const M3_R6_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R6_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const M3_R6_RESEARCH_RANGE = Object.freeze({
  startTime: Date.parse(M3_R6_RESEARCH_START_ISO),
  endTime: Date.parse(M3_R6_RESEARCH_END_ISO),
  classification: "RESEARCH_AVAILABLE_SEEN_DATA",
} as const);
export const M3_R6_PROTOCOL_VERSION = "m3-r6-round-006-profitability-rebuild-001" as const;
export const M3_R6_PERFORMANCE_LOCK = "FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R6_POST_LOCK_INVALIDATION = "ROUND_006_INVALIDATION_REQUIRED" as const;

export const R6_SYMBOLS = RESEARCH_SYMBOLS;
export const R6_FROZEN_FOLD_IDS = Object.freeze([...RESEARCH_FOLD_IDS]) as readonly ResearchFoldId[];
export const R6_FROZEN_FOLDS = RESEARCH_FOLDS;

export type R6Direction = "LONG" | "SHORT";

export const M3_R6_ROUND_006_CANDIDATE_IDS = Object.freeze([
  "R6-A1-COOLDOWN-12H",
  "R6-A2-COOLDOWN-24H",
  "R6-A3-COOLDOWN-48H",
  "R6-B1-TOP1-SCORE",
  "R6-B2-TOP2-SCORE",
  "R6-B3-TOP1-RELATIVE-STRENGTH",
  "R6-B4-TOP2-RELATIVE-STRENGTH",
  "R6-C1-TREND-FRESHNESS",
  "R6-C2-FRESHNESS-TOP1-SCORE",
  "R6-D1-BREAKOUT-QUALITY",
  "R6-D2-PULLBACK-BREAKOUT-QUALITY",
  "R6-D3-PULLBACK-BREAKOUT-TOP1",
] as const);
export type R6CandidateId = (typeof M3_R6_ROUND_006_CANDIDATE_IDS)[number];

export type R6MechanismFamily =
  | "REDUNDANCY_COOLDOWN"
  | "CROSS_SECTIONAL_SCORE"
  | "CROSS_SECTIONAL_RELATIVE_STRENGTH"
  | "TREND_FRESHNESS"
  | "BREAKOUT_QUALITY";

export type R6CandidateKind =
  | "COOLDOWN"
  | "TOP_N_SCORE"
  | "TOP_N_RELATIVE_STRENGTH"
  | "TREND_FRESHNESS"
  | "TREND_FRESHNESS_TOP_N_SCORE"
  | "BREAKOUT"
  | "PULLBACK_BREAKOUT"
  | "PULLBACK_BREAKOUT_TOP_N_SCORE";

export type R6ComplexityTuple = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

export type R6CandidateDefinition = Readonly<{
  candidateId: R6CandidateId;
  variantId: string;
  family: "A" | "B" | "C" | "D";
  mechanismFamily: R6MechanismFamily;
  kind: R6CandidateKind;
  parameters: Readonly<Record<string, number | readonly string[]>>;
  signalRule: string;
  dataRule: string;
  composition: "SINGLE_MECHANISM" | "PREDECLARED_DUAL_CONFIRMATION";
}>;

export const R6_CANDIDATE_REGISTRY: readonly R6CandidateDefinition[] = deepFreeze<R6CandidateDefinition[]>([
  {
    candidateId: "R6-A1-COOLDOWN-12H",
    variantId: "R6-A1-V1",
    family: "A",
    mechanismFamily: "REDUNDANCY_COOLDOWN",
    kind: "COOLDOWN",
    parameters: { cooldownHours: 12 },
    signalRule: "RETAIN_THE_FIRST_BASELINE_FORMAL_SIGNAL_THEN_RETAIN_A_LATER_SIGNAL_ONLY_WHEN_ELAPSED_TIME_IS_GREATER_THAN_12_HOURS_FOR_THE_SAME_SYMBOL_AND_DIRECTION",
    dataRule: "CHRONOLOGICAL_CLOSED_CANDLE_BASELINE_STREAM_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-A2-COOLDOWN-24H",
    variantId: "R6-A2-V1",
    family: "A",
    mechanismFamily: "REDUNDANCY_COOLDOWN",
    kind: "COOLDOWN",
    parameters: { cooldownHours: 24 },
    signalRule: "RETAIN_THE_FIRST_BASELINE_FORMAL_SIGNAL_THEN_RETAIN_A_LATER_SIGNAL_ONLY_WHEN_ELAPSED_TIME_IS_GREATER_THAN_24_HOURS_FOR_THE_SAME_SYMBOL_AND_DIRECTION",
    dataRule: "CHRONOLOGICAL_CLOSED_CANDLE_BASELINE_STREAM_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-A3-COOLDOWN-48H",
    variantId: "R6-A3-V1",
    family: "A",
    mechanismFamily: "REDUNDANCY_COOLDOWN",
    kind: "COOLDOWN",
    parameters: { cooldownHours: 48 },
    signalRule: "RETAIN_THE_FIRST_BASELINE_FORMAL_SIGNAL_THEN_RETAIN_A_LATER_SIGNAL_ONLY_WHEN_ELAPSED_TIME_IS_GREATER_THAN_48_HOURS_FOR_THE_SAME_SYMBOL_AND_DIRECTION",
    dataRule: "CHRONOLOGICAL_CLOSED_CANDLE_BASELINE_STREAM_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-B1-TOP1-SCORE",
    variantId: "R6-B1-V1",
    family: "B",
    mechanismFamily: "CROSS_SECTIONAL_SCORE",
    kind: "TOP_N_SCORE",
    parameters: { topN: 1 },
    signalRule: "RETAIN_TOP_1_BASELINE_FORMAL_CANDIDATE_PER_IDENTICAL_SIGNAL_TIME_BY_EXISTING_TOTAL_SCORE",
    dataRule: "IDENTICAL_SIGNAL_TIME_GROUPS_AND_CLOSED_CANDLE_BASELINE_SCORES_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-B2-TOP2-SCORE",
    variantId: "R6-B2-V1",
    family: "B",
    mechanismFamily: "CROSS_SECTIONAL_SCORE",
    kind: "TOP_N_SCORE",
    parameters: { topN: 2 },
    signalRule: "RETAIN_TOP_2_BASELINE_FORMAL_CANDIDATES_PER_IDENTICAL_SIGNAL_TIME_BY_EXISTING_TOTAL_SCORE",
    dataRule: "IDENTICAL_SIGNAL_TIME_GROUPS_AND_CLOSED_CANDLE_BASELINE_SCORES_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-B3-TOP1-RELATIVE-STRENGTH",
    variantId: "R6-B3-V1",
    family: "B",
    mechanismFamily: "CROSS_SECTIONAL_RELATIVE_STRENGTH",
    kind: "TOP_N_RELATIVE_STRENGTH",
    parameters: { topN: 1, horizons: ["4h", "12h", "24h"] },
    signalRule: "RETAIN_TOP_1_BY_DETERMINISTIC_DECISION_TIME_DIRECTION_ADJUSTED_SYMBOL_RETURN_MINUS_BTC_RETURN_RANK",
    dataRule: "CLOSED_1H_CANDLES_AT_SIGNAL_TIME_AND_4H_12H_24H_PRIOR_CLOSED_HORIZONS_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-B4-TOP2-RELATIVE-STRENGTH",
    variantId: "R6-B4-V1",
    family: "B",
    mechanismFamily: "CROSS_SECTIONAL_RELATIVE_STRENGTH",
    kind: "TOP_N_RELATIVE_STRENGTH",
    parameters: { topN: 2, horizons: ["4h", "12h", "24h"] },
    signalRule: "RETAIN_TOP_2_BY_DETERMINISTIC_DECISION_TIME_DIRECTION_ADJUSTED_SYMBOL_RETURN_MINUS_BTC_RETURN_RANK",
    dataRule: "CLOSED_1H_CANDLES_AT_SIGNAL_TIME_AND_4H_12H_24H_PRIOR_CLOSED_HORIZONS_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-C1-TREND-FRESHNESS",
    variantId: "R6-C1-V1",
    family: "C",
    mechanismFamily: "TREND_FRESHNESS",
    kind: "TREND_FRESHNESS",
    parameters: { emaFast: 20, emaSlow: 50, slopeLookbackBars: 3 },
    signalRule: "LONG_REQUIRES_CLOSED_1H_EMA20_GREATER_THAN_EMA50_AND_EMA20_SLOPE_OVER_THE_PRIOR_3_CLOSED_1H_BARS_POSITIVE;SHORT_MIRRORED",
    dataRule: "CLOSED_1H_CANDLES_THROUGH_SIGNAL_TIME_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-C2-FRESHNESS-TOP1-SCORE",
    variantId: "R6-C2-V1",
    family: "C",
    mechanismFamily: "TREND_FRESHNESS",
    kind: "TREND_FRESHNESS_TOP_N_SCORE",
    parameters: { emaFast: 20, emaSlow: 50, slopeLookbackBars: 3, topN: 1 },
    signalRule: "APPLY_CLOSED_1H_TREND_FRESHNESS_THEN_RETAIN_TOP_1_BY_EXISTING_TOTAL_SCORE_PER_IDENTICAL_SIGNAL_TIME",
    dataRule: "CLOSED_1H_CANDLES_THROUGH_SIGNAL_TIME_AND_IDENTICAL_SIGNAL_TIME_GROUPS_ONLY",
    composition: "PREDECLARED_DUAL_CONFIRMATION",
  },
  {
    candidateId: "R6-D1-BREAKOUT-QUALITY",
    variantId: "R6-D1-V1",
    family: "D",
    mechanismFamily: "BREAKOUT_QUALITY",
    kind: "BREAKOUT",
    parameters: { breakoutDistanceAtr: 0.25 },
    signalRule: "RETAIN_BASELINE_FORMAL_SIGNALS_WITH_EXISTING_BREAKOUT_DISTANCE_AT_LEAST_0_25_ATR_SCORING_TIER",
    dataRule: "USE_EXISTING_CLOSED_DECISION_TIME_BREAKOUT_FEATURE_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-D2-PULLBACK-BREAKOUT-QUALITY",
    variantId: "R6-D2-V1",
    family: "D",
    mechanismFamily: "BREAKOUT_QUALITY",
    kind: "PULLBACK_BREAKOUT",
    parameters: { pullbackQuality: 18, breakoutDistanceAtr: 0.25 },
    signalRule: "RETAIN_BASELINE_FORMAL_SIGNALS_WITH_EXISTING_PULLBACK_QUALITY_AT_LEAST_18_AND_BREAKOUT_DISTANCE_AT_LEAST_0_25_ATR_SCORING_TIER",
    dataRule: "USE_EXISTING_CLOSED_DECISION_TIME_FEATURES_ONLY",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R6-D3-PULLBACK-BREAKOUT-TOP1",
    variantId: "R6-D3-V1",
    family: "D",
    mechanismFamily: "BREAKOUT_QUALITY",
    kind: "PULLBACK_BREAKOUT_TOP_N_SCORE",
    parameters: { pullbackQuality: 18, breakoutDistanceAtr: 0.25, topN: 1 },
    signalRule: "APPLY_D2_BREAKOUT_QUALITY_THEN_RETAIN_TOP_1_BY_EXISTING_TOTAL_SCORE_PER_IDENTICAL_SIGNAL_TIME",
    dataRule: "USE_EXISTING_CLOSED_DECISION_TIME_FEATURES_AND_IDENTICAL_SIGNAL_TIME_GROUPS_ONLY",
    composition: "PREDECLARED_DUAL_CONFIRMATION",
  },
]);

export const R6_COMPLEXITY_TUPLES: Readonly<Record<R6CandidateId, R6ComplexityTuple>> = deepFreeze({
  "R6-A1-COOLDOWN-12H": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-A2-COOLDOWN-24H": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-A3-COOLDOWN-48H": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-B1-TOP1-SCORE": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-B2-TOP2-SCORE": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-B3-TOP1-RELATIVE-STRENGTH": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-B4-TOP2-RELATIVE-STRENGTH": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-C1-TREND-FRESHNESS": { newRules: 2, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-C2-FRESHNESS-TOP1-SCORE": { newRules: 3, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-D1-BREAKOUT-QUALITY": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-D2-PULLBACK-BREAKOUT-QUALITY": { newRules: 2, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R6-D3-PULLBACK-BREAKOUT-TOP1": { newRules: 3, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
});

export const R6_REQUIRED_CANDLE_FIELDS = Object.freeze([
  "symbol",
  "timeframe",
  "openTime",
  "closeTime",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "quoteVolume",
  "tradeCount",
  "takerBuyBaseVolume",
  "takerBuyQuoteVolume",
] as const);

export const R6_DATA_CONTRACT = deepFreeze({
  provider: "binance-usdm-public",
  timeframes: ["1h", "4h"],
  symbols: R6_SYMBOLS,
  researchStartIso: M3_R6_RESEARCH_START_ISO,
  researchEndIso: M3_R6_RESEARCH_END_ISO,
  decisionTime: "SIGNAL_CANDLE_CLOSE_TIME;CLOSED_CANDLES_ONLY",
  relativeStrengthHorizons: ["4h", "12h", "24h"],
  requiredCandleFields: R6_REQUIRED_CANDLE_FIELDS,
  missingOrMalformedData: "FAIL_CLOSED_AS_INCOMPLETE_EVIDENCE",
});

export const R6_EXECUTION_CONTRACTS = deepFreeze({
  strategyVersion: "baseline-001",
  backtestPolicyVersion: "bt-policy-003",
  feeRate: BACKTEST_POLICY.feeRate,
  slippageRate: BACKTEST_POLICY.slippageRate,
  funding: "OFFICIAL_FUNDING_RATE_HISTORY_WITH_MARK_PRICE_KLINE_PRE_EVENT_CLOSE_FALLBACK",
  settlement: "EXISTING_BT_POLICY_003_SL_FIRST_INTRABAR_ORDERING",
  entry: "EXISTING_IMMEDIATE_NEXT_CANONICAL_1H_ENTRY",
  timeExit: "EXISTING_BT_POLICY_003_TIME_EXIT",
  candidateEconomics: "CANDIDATES_FILTER_OR_RANK_BASELINE_FORMAL_SIGNALS;NO_SETTLEMENT_REWRITE",
});

export const R6_FORMULA_DEFINITIONS = deepFreeze({
  cooldown: "retain first; for later same-symbol/same-direction signal retain iff (signalTime - lastAcceptedSignalTime) > cooldownHours * 3600000",
  scoreTopN: "group by identical signalTime; order totalScore DESC, frozen symbol order, LONG before SHORT; retain first topN",
  relativeStrength: "for h in {4h,12h,24h}: directionAdjusted(symbolReturn_h - btcReturn_h); combinedScore = arithmeticMean(h); LONG uses symbolReturn - btcReturn; SHORT uses btcReturn - symbolReturn",
  relativeStrengthRank: "within identical signalTime order combinedScore DESC, then totalScore DESC, frozen symbol order, LONG before SHORT",
  trendFreshness: "LONG iff EMA20_1h(t) > EMA50_1h(t) AND EMA20_1h(t) - EMA20_1h(t-3 closed bars) > 0; SHORT is mirrored",
  breakoutQuality: "breakoutDistance / ATR >= 0.25 is represented by the existing breakoutStrength >= 17 tier; pullbackQuality >= 18 is inclusive",
  closedDataBoundary: "every feature uses candles with closeTime <= signalTime; no future candle is read",
});

export const R6_COMPLEXITY_COUNTING_RUBRIC = deepFreeze({
  version: "m3-r6-round-006-complexity-rubric-001",
  dimensionOrder: ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"],
  fixedStructuralValues: ["cooldown hours", "EMA lengths", "EMA slope lookback", "relative-strength horizon set", "topN"],
  candidateSpecificThresholds: "NONE_ADDED;ALL_NUMERIC_VALUES_ARE_PREDECLARED_STRUCTURAL_BOUNDARIES_OR_INHERITED_SCORING_TIERS",
  baselineModificationCount: 0,
  compositionPolicy: "NO_BRUTE_FORCE_COMBINATIONS;ONLY_PREDECLARED_C2_AND_D3_COMPOSITIONS",
});

export const R6_GATE_INHERITANCE = deepFreeze({
  inheritedRound004GateSha256: "c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54",
  inheritedRound005GateSha256: "e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5",
  rule: "REUSE_EXISTING_HARD_GATE_VALUES_AND_FORMULAS_WITHOUT_WEAKENING",
});

export const R6_PROTOCOL_MACHINE_RECORD = deepFreeze({
  protocolVersion: M3_R6_PROTOCOL_VERSION,
  researchRoundId: M3_R6_RESEARCH_ROUND_ID,
  freezeSourceSha: "009b0c2aa11d7f8b387c130f8172ec60e9efa333",
  sourceIdentity: {
    path: "src/lib/research/m3-r6-round-006-protocol.ts",
    sourceSha: "009b0c2aa11d7f8b387c130f8172ec60e9efa333",
    identityRule: "ROUND_FREEZE_SOURCE_IS_THE_AUTHORITATIVE_MAIN_SHA_AT_ROUND_START",
  },
  universe: M3_R6_RESEARCH_RANGE,
  symbols: R6_SYMBOLS,
  folds: R6_FROZEN_FOLDS,
  candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
  candidateRegistry: R6_CANDIDATE_REGISTRY,
  complexityTuples: R6_COMPLEXITY_TUPLES,
  formulas: R6_FORMULA_DEFINITIONS,
  dataContract: R6_DATA_CONTRACT,
  executionContract: R6_EXECUTION_CONTRACTS,
  gateInheritance: R6_GATE_INHERITANCE,
  governance: {
    noTuning: true,
    noSweep: true,
    noOptimizer: true,
    noBruteForceCombinations: true,
    noPostResultCandidateReplacement: true,
    liveObservationsClassification: "SEEN_DIAGNOSTIC_DATA_ONLY",
    performanceExecutionSourceSha: null,
  },
});

export const R6_PROTOCOL_SOURCE_SHA = R6_PROTOCOL_MACHINE_RECORD.sourceIdentity.sourceSha;
export const R6_CANDIDATE_FAMILIES = Object.freeze(["A", "B", "C", "D"] as const);
export const R6_HORIZON_HOURS = Object.freeze([4, 12, 24] as const);
export const R6_HORIZON_MS = Object.freeze(R6_HORIZON_HOURS.map((hours) => hours * INTERVAL_MS["1h"]));
export const R6_FOUR_HOUR_MS = INTERVAL_MS["4h"];

export type R6ProtocolMachineRecord = typeof R6_PROTOCOL_MACHINE_RECORD;
export type R6FrozenFoldId = (typeof R6_FROZEN_FOLD_IDS)[number];
export type R6FrozenSymbol = ResearchSymbol;
