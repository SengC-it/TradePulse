import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { BACKTEST_POLICY } from "../backtest/constants.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import { RESEARCH_FOLD_IDS } from "./constants.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import { deepFreeze } from "./utils.ts";

export const M3_R7_RESEARCH_ROUND_ID = "baseline-002-research-round-007" as const;
export const M3_R7_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R7_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const M3_R7_RESEARCH_RANGE = Object.freeze({
  startTime: Date.parse(M3_R7_RESEARCH_START_ISO),
  endTime: Date.parse(M3_R7_RESEARCH_END_ISO),
  classification: "RESEARCH_AVAILABLE_SEEN_DATA",
} as const);
export const M3_R7_PROTOCOL_VERSION = "m3-r7-round-007-model-level-profitability-rebuild-001" as const;
export const M3_R7_PERFORMANCE_LOCK = "FIRST_M3_R7_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R7_POST_LOCK_INVALIDATION = "ROUND_007_INVALIDATION_REQUIRED" as const;
export const M3_R7_FREEZE_SOURCE_SHA = "230c9301b8324446327c1274f4ba05089a4b4f99" as const;
export const M3_R7_CONTROL_ID = "R7-CONTROL-BASELINE-001" as const;
export const M3_R7_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R7_NO_CANDIDATE_OUTCOME = "NO BASELINE-002 CANDIDATE — ROUND-007" as const;

export const R7_SYMBOLS = Object.freeze([...RESEARCH_SYMBOLS]) as readonly ResearchSymbol[];
export const R7_FROZEN_FOLD_IDS = Object.freeze([...RESEARCH_FOLD_IDS]);
export const R7_FROZEN_FOLDS = RESEARCH_FOLDS;

export const M3_R7_CANDIDATE_IDS = Object.freeze([
  "R7-R1-REGIME-EXPECTANCY-ROUTER",
  "R7-E1-PULLBACK-RECLAIM",
  "R7-E2-BREAKOUT-RETEST",
  "R7-S1-CALIBRATED-SCORE-V2",
  "R7-C1-RECLAIM-CALIBRATED-SCORE-V2",
] as const);
export type R7CandidateId = (typeof M3_R7_CANDIDATE_IDS)[number];
export type R7Direction = "LONG" | "SHORT";

export type R7ComplexityTuple = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

export type R7CandidateDefinition = Readonly<{
  candidateId: R7CandidateId;
  variantId: string;
  mechanismFamily: "REGIME_ROUTING" | "PULLBACK_RECLAIM" | "BREAKOUT_RETEST" | "CALIBRATED_SCORE" | "RECLAIM_CALIBRATED_SCORE";
  kind: "ROUTER" | "EVENT" | "MODEL_FILTER" | "COMBINED";
  parameters: Readonly<Record<string, number | string | boolean>>;
  signalRule: string;
  dataRule: string;
  composition: "SINGLE_MECHANISM" | "PREDECLARED_COMBINATION";
}>;

export const R7_CANDIDATE_REGISTRY: readonly R7CandidateDefinition[] = deepFreeze<R7CandidateDefinition[]>([
  {
    candidateId: "R7-R1-REGIME-EXPECTANCY-ROUTER",
    variantId: "R7-R1-V1",
    mechanismFamily: "REGIME_ROUTING",
    kind: "ROUTER",
    parameters: { minimumResearchCellExecuted: 100, minimumResearchCellExpectancyR: 0.05, cellCount: 48 },
    signalRule: "RETAIN_BASELINE_FORMAL_OPPORTUNITIES_ONLY_WHEN_THE_PREDECLARED_FOLD_LOCAL_REGIME_CELL_PASSES_THE_FIXED_RESEARCH_SAMPLE_AND_EXPECTANCY_FLOOR",
    dataRule: "CLOSED_4H_TREND_FRESHNESS_1H_TREND_FRESHNESS_EXTENSION_AND_ROLLING_ATR_PRICE_VOLATILITY;RESEARCH_CELL_FIT_IS_NOT_UPDATED_BY_VALIDATION",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R7-E1-PULLBACK-RECLAIM",
    variantId: "R7-E1-V1",
    mechanismFamily: "PULLBACK_RECLAIM",
    kind: "EVENT",
    parameters: { pullbackWindowCandles: 5, emaFast: 20, emaSlow: 50, maximumExtensionAtr: 0.75, stopBufferAtr: 0.2, takeProfitR: 2 },
    signalRule: "AFTER_A_CLOSED_1H_CANDLE_RECLAIMS_EMA20_AFTER_A_PRIOR_FIVE_CANDLE_EMA20_OR_EMA50_INTERACTION_WITH_ALIGNED_EMA20_EMA50_AND_WITHOUT_A_THREE_CANDLE_BREAKOUT",
    dataRule: "CLOSED_1H_AND_CLOSED_4H_DATA_THROUGH_DECISION_CANDLE_ONLY;NEXT_1H_OPEN_ENTRY;MIRRORED_LONG_SHORT",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R7-E2-BREAKOUT-RETEST",
    variantId: "R7-E2-V1",
    mechanismFamily: "BREAKOUT_RETEST",
    kind: "EVENT",
    parameters: { breakoutLookbackCandles: 3, retestWindowCandles: 3, retestToleranceAtr: 0.25, stopBufferAtr: 0.2, takeProfitR: 2 },
    signalRule: "A_CLOSED_DIRECTIONAL_BREAKOUT_IS_FOLLOWED_BY_A_RETEST_WITHIN_THREE_CLOSED_1H_CANDLES_AND_A_CLOSED_DIRECTIONAL_RECLAIM;NO_IMMEDIATE_BREAKOUT_ENTRY",
    dataRule: "CLOSED_1H_AND_CLOSED_4H_DATA_THROUGH_RECLAIM_CANDLE_ONLY;NEXT_1H_OPEN_ENTRY;MIRRORED_LONG_SHORT",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R7-S1-CALIBRATED-SCORE-V2",
    variantId: "R7-S1-V1",
    mechanismFamily: "CALIBRATED_SCORE",
    kind: "MODEL_FILTER",
    parameters: { ridgeLambda: 10, minimumPredictedNetR: 0.05, featureCount: 10 },
    signalRule: "RETAIN_BASELINE_FORMAL_OPPORTUNITIES_WHEN_THE_FOLD_LOCAL_RESEARCH_ONLY_RIDGE_MODEL_PREDICTS_NET_R_AT_LEAST_0_05",
    dataRule: "BASELINE_FORMAL_STREAM;TEN_DECISION_TIME_CLOSED_DATA_FEATURES;RESEARCH_FIT_AND_VALIDATION_PREDICTION_ARE_SEPARATE",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R7-C1-RECLAIM-CALIBRATED-SCORE-V2",
    variantId: "R7-C1-V1",
    mechanismFamily: "RECLAIM_CALIBRATED_SCORE",
    kind: "COMBINED",
    parameters: { ridgeLambda: 10, minimumPredictedNetR: 0.05, featureCount: 10, upstreamEvent: 1 },
    signalRule: "RETAIN_E1_PULLBACK_RECLAIM_OPPORTUNITIES_WHEN_THE_FOLD_LOCAL_RESEARCH_ONLY_E1_RIDGE_MODEL_PREDICTS_NET_R_AT_LEAST_0_05",
    dataRule: "E1_OPPORTUNITY_STREAM;TEN_DECISION_TIME_CLOSED_DATA_FEATURES;RESEARCH_FIT_AND_VALIDATION_PREDICTION_ARE_SEPARATE",
    composition: "PREDECLARED_COMBINATION",
  },
]);

export const R7_COMPLEXITY_TUPLES: Readonly<Record<R7CandidateId, R7ComplexityTuple>> = deepFreeze({
  "R7-R1-REGIME-EXPECTANCY-ROUTER": { newRules: 2, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R7-E1-PULLBACK-RECLAIM": { newRules: 4, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R7-E2-BREAKOUT-RETEST": { newRules: 3, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R7-S1-CALIBRATED-SCORE-V2": { newRules: 2, newTunableThresholds: 0, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
  "R7-C1-RECLAIM-CALIBRATED-SCORE-V2": { newRules: 5, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 2 },
});

export const R7_FEATURE_NAMES = Object.freeze([
  "directionAdjusted4hEma200DistanceAtr",
  "directionAdjusted4hEma50Ema200SpreadAtr",
  "directionAdjusted4hEmaSlopeAtr",
  "directionAdjusted1hEma20Ema50SpreadAtr",
  "directionAdjusted1hEma20Slope3Atr",
  "priceExtensionFrom1hEma20Atr",
  "pullbackQuality",
  "breakoutReclaimStrengthAtr",
  "logClippedVolumeRatio",
  "symbolReturnMinusBtcReturn12h",
] as const);
export type R7FeatureName = (typeof R7_FEATURE_NAMES)[number];

export const R7_FEATURE_DEFINITIONS = deepFreeze({
  directionAdjusted4hEma200DistanceAtr: "direction * (close4h - EMA200_4h) / ATR14_4h",
  directionAdjusted4hEma50Ema200SpreadAtr: "direction * (EMA50_4h - EMA200_4h) / ATR14_4h",
  directionAdjusted4hEmaSlopeAtr: "direction * (EMA200_4h(t) - EMA200_4h(t-5)) / ATR14_4h",
  directionAdjusted1hEma20Ema50SpreadAtr: "direction * (EMA20_1h - EMA50_1h) / ATR14_1h",
  directionAdjusted1hEma20Slope3Atr: "direction * (EMA20_1h(t) - EMA20_1h(t-3)) / ATR14_1h",
  priceExtensionFrom1hEma20Atr: "direction * (close1h - EMA20_1h) / ATR14_1h",
  pullbackQuality: "closed_decision_time_count_of_prior_five_candles_interacting_with_EMA20_or_EMA50",
  breakoutReclaimStrengthAtr: "direction * (close1h - prior_three_candle_extreme) / ATR14_1h",
  logClippedVolumeRatio: "clamp(log1p(current_quote_volume / prior_twenty_quote_volume_mean), -5, 5)",
  symbolReturnMinusBtcReturn12h: "direction * ((close1h / close1h_12_bars_ago - 1) - (btc_close1h / btc_close1h_12_bars_ago - 1))",
});

export const R7_ROUTER_BUCKETS = deepFreeze({
  trendFreshness4h: ["STALE_OR_NEGATIVE", "FRESH_POSITIVE"] as const,
  trendFreshness1h: ["STALE_OR_NEGATIVE", "FRESH_POSITIVE"] as const,
  extension: ["NEGATIVE_OR_NEUTRAL", "0_TO_0_75_ATR", "ABOVE_0_75_ATR"] as const,
  volatility: ["LOW", "NORMAL", "HIGH", "INVALID"] as const,
  cellRule: "2 * 2 * 3 * 4 = 48 fixed cells; no cell search or threshold tuning",
});

export const R7_DATA_CONTRACT = deepFreeze({
  provider: "binance-usdm-public",
  symbols: R7_SYMBOLS,
  timeframes: ["1h", "4h", "1m-settlement"] as const,
  researchStartIso: M3_R7_RESEARCH_START_ISO,
  researchEndIso: M3_R7_RESEARCH_END_ISO,
  decisionTime: "SIGNAL_CANDLE_CLOSE_TIME;CLOSED_CANDLES_ONLY",
  missingOrMalformedData: "FAIL_CLOSED_AS_INCOMPLETE_EVIDENCE",
  intrabar: "DECLARED_BEFORE_DATASET_FREEZE;NO_POST_LOCK_FETCH",
});

export const R7_EXECUTION_CONTRACT = deepFreeze({
  strategyVersion: "baseline-001",
  backtestPolicyVersion: M3_R7_POLICY_VERSION,
  feeRate: BACKTEST_POLICY.feeRate,
  slippageRate: BACKTEST_POLICY.slippageRate,
  funding: "EXISTING_BT_POLICY_003_FUNDING_RATE_AND_MARK_PRICE_SEMANTICS",
  settlement: "EXISTING_BT_POLICY_003_SL_FIRST_INTRABAR_ORDERING",
  entry: "EXISTING_IMMEDIATE_NEXT_CANONICAL_1H_ENTRY",
  holdingHorizon: BACKTEST_POLICY.heldCandleCount,
  noProductionExecution: true,
});

export const R7_MODEL_CONTRACT = deepFreeze({
  model: "DETERMINISTIC_INTERPRETABLE_RIDGE",
  lambda: 10,
  interceptPenalized: false,
  fitScope: "EACH_FOLD_RESEARCH_ONLY",
  standardizationScope: "EACH_FOLD_RESEARCH_ONLY",
  validationUse: "PREDICT_ONLY;NO_REFIT;NO_THRESHOLD_UPDATE",
  minimumPredictedNetR: 0.05,
  featureNames: R7_FEATURE_NAMES,
  noLambdaSearch: true,
  noOptimizer: true,
});

export const R7_CENSOR_SEMANTICS = deepFreeze({
  PERIOD_END_CENSORED: "FORMAL_AND_NON_EXECUTED;EXCLUDED_FROM_EXECUTED_METRICS;DOES_NOT_INVALIDATE_A_COMPLETE_VALIDATION_SEGMENT",
  DATA_INCOMPLETE: "FAIL_CLOSED;INVALIDATES_THE_APPLICABLE_VALIDATION_SEGMENT",
  executedMetrics: "ONLY_EXECUTED_RECORDS_WITH_FINITE_NET_R",
});

export const R7_GOVERNANCE = deepFreeze({
  noPrivateBinanceApi: true,
  noAutomaticTrading: true,
  noThresholdSweep: true,
  noOptimizer: true,
  noNewSymbols: true,
  noForwardDataInFeatures: true,
  validationCannotFitOrTune: true,
  performanceExactlyOnceAfterLock: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R7_PROTOCOL_MACHINE_RECORD = deepFreeze({
  protocolVersion: M3_R7_PROTOCOL_VERSION,
  researchRoundId: M3_R7_RESEARCH_ROUND_ID,
  freezeSourceSha: M3_R7_FREEZE_SOURCE_SHA,
  sourceIdentity: {
    path: "src/lib/research/m3-r7-round-007-protocol.ts",
    sourceSha: M3_R7_FREEZE_SOURCE_SHA,
    identityRule: "ROUND_007_DEFINITIONS_FROZEN_FROM_MERGED_MAIN_BEFORE_PERFORMANCE",
  },
  universe: M3_R7_RESEARCH_RANGE,
  symbols: R7_SYMBOLS,
  folds: R7_FROZEN_FOLDS,
  candidateIds: M3_R7_CANDIDATE_IDS,
  candidateRegistry: R7_CANDIDATE_REGISTRY,
  complexityTuples: R7_COMPLEXITY_TUPLES,
  features: R7_FEATURE_DEFINITIONS,
  routerBuckets: R7_ROUTER_BUCKETS,
  dataContract: R7_DATA_CONTRACT,
  executionContract: R7_EXECUTION_CONTRACT,
  modelContract: R7_MODEL_CONTRACT,
  censorSemantics: R7_CENSOR_SEMANTICS,
  governance: R7_GOVERNANCE,
  performanceExecutionSourceSha: null,
});

export const R7_REQUIRED_CANDLE_INTERVALS = Object.freeze({
  oneHour: INTERVAL_MS["1h"],
  fourHour: INTERVAL_MS["4h"],
});
