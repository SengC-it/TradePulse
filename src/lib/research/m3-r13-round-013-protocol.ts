import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import { RESEARCH_FOLD_IDS, type ResearchFoldId } from "./constants.ts";
import { deepFreeze } from "./utils.ts";

export const M3_R13_RESEARCH_ROUND_ID = "baseline-002-research-round-013" as const;
export const M3_R13_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R13_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const M3_R13_ACCEPTED_R11_SOURCE_SHA = "8c38c3eb9a97e9f92654fc4f211c5a8aad96c225" as const;
export const M3_R13_PROTOCOL_VERSION = "m3-r13-round-013-forward-edge-discovery-001" as const;
export const M3_R13_PERFORMANCE_LOCK = "FIRST_M3_R13_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R13_CONTROL_ID = "R13-CONTROL-ALL-CLOSED-CROSS-SECTIONAL-OPPORTUNITIES" as const;
export const M3_R13_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R13_NO_EDGE_OUTCOME = "NO ROBUST FORWARD EDGE — ROUND-013" as const;

export const M3_R13_RESEARCH_RANGE = deepFreeze({
  startTime: Date.parse(M3_R13_RESEARCH_START_ISO),
  endTime: Date.parse(M3_R13_RESEARCH_END_ISO),
  classification: "RESEARCH_AVAILABLE_SEEN_DATA",
} as const);

export const R13_SYMBOLS = Object.freeze([...RESEARCH_SYMBOLS]) as readonly ResearchSymbol[];
export const R13_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export type R13Direction = (typeof R13_DIRECTIONS)[number];
export const R13_HORIZON_HOURS = Object.freeze([4, 8, 12, 24] as const);
export type R13HorizonHours = (typeof R13_HORIZON_HOURS)[number];
export const R13_FOLD_IDS = Object.freeze([...RESEARCH_FOLD_IDS]) as readonly ResearchFoldId[];
export const R13_FOLDS = RESEARCH_FOLDS;

export const R13_EXECUTION_ALIGNMENT = deepFreeze({
  decisionCandle: "FULLY_CLOSED_1H_CANDLE",
  signalTime: "CLOSED_1H_CANDLE_CLOSE_TIME",
  primaryDelayMinutes: 6,
  stressDelayMinutes: 7,
  primaryActionableAt: "signalTime + 6_MINUTES + CANONICAL_UTC_TIMESTAMP_NORMALIZATION",
  entry: "FIRST_CANONICAL_COMPLETE_1M_OPEN_AT_OR_AFTER_ACTIONABLE_AT",
  validUntil: "signalTime + 60_MINUTES",
  noEntryBeforeActionableAt: true,
  noEntryAfterSignalValidUntil: true,
  stressOnlyDelay: true,
} as const);

export const R13_FEATURE_NAMES = Object.freeze([
  "F01_directionAdjustedClose4hMinusEma200Atr",
  "F02_directionAdjustedEma50MinusEma200Atr",
  "F03_directionAdjustedEma200FiveBarSlopeAtr",
  "F04_directionAdjustedReturn12hAtrPriceScale",
  "F05_directionAdjustedEma20MinusEma50Atr",
  "F06_directionAdjustedEma20ThreeBarSlopeAtr",
  "F07_directionAdjustedReturn4hAtrPriceScale",
  "F08_directionAdjustedReturn12hAtrPriceScale",
  "F09_directionAdjustedClose1hMinusEma20Atr",
  "F10_atr14OverClose1h",
  "F11_rollingAtrPricePercentile30d",
  "F12_logClippedQuoteVolumeOverPast20hMedian",
  "F13_directionAdjustedTakerImbalance",
  "F14_directionAdjustedSymbolMinusBtcReturn12h",
  "F15_directionAdjustedSymbolMinusBtcReturn24h",
  "F16_directionAdjustedSettledFundingBurden",
  "F17_directionAdjustedEma50Breadth",
  "F18_directionAdjustedMomentumBreadth12h",
] as const);
export type R13FeatureName = (typeof R13_FEATURE_NAMES)[number];

export const R13_FEATURE_DEFINITIONS: Readonly<Record<R13FeatureName, string>> = deepFreeze({
  F01_directionAdjustedClose4hMinusEma200Atr: "direction * (close4h - EMA200_4h) / ATR14_4h",
  F02_directionAdjustedEma50MinusEma200Atr: "direction * (EMA50_4h - EMA200_4h) / ATR14_4h",
  F03_directionAdjustedEma200FiveBarSlopeAtr: "direction * (EMA200_4h(t) - EMA200_4h(t-5)) / ATR14_4h",
  F04_directionAdjustedReturn12hAtrPriceScale: "direction * 12h_symbol_return / (ATR14_1h / close1h)",
  F05_directionAdjustedEma20MinusEma50Atr: "direction * (EMA20_1h - EMA50_1h) / ATR14_1h",
  F06_directionAdjustedEma20ThreeBarSlopeAtr: "direction * (EMA20_1h(t) - EMA20_1h(t-3)) / ATR14_1h",
  F07_directionAdjustedReturn4hAtrPriceScale: "direction * 4h_symbol_return / (ATR14_1h / close1h)",
  F08_directionAdjustedReturn12hAtrPriceScale: "direction * 12h_symbol_return / (ATR14_1h / close1h)",
  F09_directionAdjustedClose1hMinusEma20Atr: "direction * (close1h - EMA20_1h) / ATR14_1h",
  F10_atr14OverClose1h: "ATR14_1h / close1h",
  F11_rollingAtrPricePercentile30d: "percentile(current ATR14_1h / close1h within the fixed past 30 closed days)",
  F12_logClippedQuoteVolumeOverPast20hMedian: "clamp(log(current closed 1h quote-volume / median(previous 20 closed 1h quote-volumes)), -5, 5)",
  F13_directionAdjustedTakerImbalance: "LONG: 2 * takerBuyRatio - 1; SHORT: 1 - 2 * takerBuyRatio; takerBuyRatio = takerBuyQuoteVolume / quoteVolume",
  F14_directionAdjustedSymbolMinusBtcReturn12h: "direction * (symbol 12h return - BTC 12h return)",
  F15_directionAdjustedSymbolMinusBtcReturn24h: "direction * (symbol 24h return - BTC 24h return)",
  F16_directionAdjustedSettledFundingBurden: "-direction * most recently settled funding rate known at decision time",
  F17_directionAdjustedEma50Breadth: "LONG: fraction of five symbols above EMA50_1h; SHORT: one minus that fraction",
  F18_directionAdjustedMomentumBreadth12h: "LONG: fraction of five symbols with positive 12h return; SHORT: one minus that fraction",
});

export const R13_DATA_CONTRACT = deepFreeze({
  provider: "binance-usdm-public",
  symbols: R13_SYMBOLS,
  timeframes: ["1h", "4h", "1m", "fundingRate", "markPrice1h"] as const,
  decisionTime: "CLOSED_1H_CANDLE_CLOSE_TIME",
  observationUniverse: "EVERY_COMPLETE_DECISION_TIME_SYMBOL_DIRECTION_PAIR",
  postBoundaryProductionData: "POST_BOUNDARY_SEEN_HYPOTHESIS_ONLY_EXCLUDED_FROM_MODEL_GATE_SELECTION",
  missingOrMalformedData: "FAIL_CLOSED_AS_INCOMPLETE_EVIDENCE",
  rawCache: "LOCAL_RESUMABLE_PAGE_CHECKPOINTS_NOT_COMMITTED",
  noPrivateApi: true,
});

export const R13_LABEL_CONTRACT = deepFreeze({
  horizonsHours: R13_HORIZON_HOURS,
  maximumLabelHorizonHours: 24,
  entry: R13_EXECUTION_ALIGNMENT.entry,
  exit: "FIRST_CANONICAL_COMPLETE_1M_OPEN_AT_OR_AFTER_ENTRY_TIME_PLUS_HORIZON",
  validWindow: R13_EXECUTION_ALIGNMENT.validUntil,
  target: "netForwardAtr_H",
  mfeMae: "MFE_ATR_H_MAE_ATR_H_AND_TIME_TO_EXTREME_FROM_ENTRY_OVER_CANONICAL_1M_INTERVAL",
  funding: "ALL_SETTLEMENTS_STRICTLY_BETWEEN_ENTRY_AND_EXIT_WITH_BT_POLICY_003_MARK_PRICE_SEMANTICS",
  costStress: "1.5_TIMES_TOTAL_TRANSACTION_COST_ONLY_DIAGNOSTIC",
  latencyStress: "7_MINUTES_ONLY_DIAGNOSTIC",
  noRMultipleLabel: true,
});

export const R13_MODEL_CONTRACT = deepFreeze({
  model: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION",
  lambda: 10,
  interceptPenalized: false,
  featureNames: R13_FEATURE_NAMES,
  fitScope: "EACH_OUTER_FOLD_RESEARCH_ONLY",
  standardizationScope: "EACH_OUTER_FOLD_RESEARCH_ONLY",
  pooledAcrossSymbols: true,
  validationUse: "PREDICT_ONLY_NO_REFIT_NO_THRESHOLD_UPDATE",
  target: "netForwardAtr_H",
  horizons: R13_HORIZON_HOURS,
  noOptimizer: true,
  noSweep: true,
  noSymbolIdentity: true,
});

export const R13_GATE_THRESHOLDS = deepFreeze({
  minimumSelectedValidationObservationsAggregate: 500,
  minimumSelectedValidationObservationsPerFold: 50,
  minimumMeanNetForwardAtr: 0.10,
  minimumProfitFactor: 1.30,
  minimumPositiveFolds: 5,
  maximumCatastrophicFolds: 0,
  minimumPositiveSpearmanFolds: 5,
  minimumPooledSpearman: 0.03,
  minimumTopBottomDecileSpread: 0.15,
  minimumPositiveSpreadFolds: 5,
  minimumCostStressMean: 0,
  minimumCostStressProfitFactor: 1.05,
  minimumLatencyStressMean: 0,
  maximumPositiveContributionSymbolShare: 0.50,
  maximumSinglePositiveObservationContribution: 0.05,
} as const);

export const R13_GOVERNANCE = deepFreeze({
  noPrivateBinanceApi: true,
  noAutomaticTrading: true,
  tradingEnabled: false,
  noBaseline001FormalUniverseRestriction: true,
  noFeatureSearch: true,
  noThresholdSweep: true,
  noOptimizer: true,
  noProductionDataInHistoricalModel: true,
  noPostLockMarketFetch: true,
  performanceExactlyOnceAfterLock: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R13_PROTOCOL_MACHINE_RECORD = deepFreeze({
  protocolVersion: M3_R13_PROTOCOL_VERSION,
  researchRoundId: M3_R13_RESEARCH_ROUND_ID,
  acceptedSourceSha: M3_R13_ACCEPTED_R11_SOURCE_SHA,
  universe: M3_R13_RESEARCH_RANGE,
  symbols: R13_SYMBOLS,
  directions: R13_DIRECTIONS,
  folds: R13_FOLDS,
  horizons: R13_HORIZON_HOURS,
  executionAlignment: R13_EXECUTION_ALIGNMENT,
  dataContract: R13_DATA_CONTRACT,
  featureDefinitions: R13_FEATURE_DEFINITIONS,
  labelContract: R13_LABEL_CONTRACT,
  modelContract: R13_MODEL_CONTRACT,
  gates: R13_GATE_THRESHOLDS,
  governance: R13_GOVERNANCE,
  performanceLock: M3_R13_PERFORMANCE_LOCK,
  performanceExecutionSourceSha: null,
});

export const R13_REQUIRED_CANDLE_INTERVALS = Object.freeze({ oneMinute: 60_000, oneHour: INTERVAL_MS["1h"], fourHour: INTERVAL_MS["4h"] });
