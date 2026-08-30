import { createHash } from "node:crypto";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { M3_R13_RESEARCH_END_ISO, M3_R13_RESEARCH_RANGE, R13_FOLDS, R13_HORIZON_HOURS, R13_SYMBOLS, type R13Direction } from "./m3-r13-round-013-protocol.ts";
import { stableStringify } from "./utils.ts";

export const M3_R15_RESEARCH_ROUND_ID = "baseline-002-research-round-015" as const;
export const M3_R15_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R15_RESEARCH_END_ISO = M3_R13_RESEARCH_END_ISO;
export const M3_R15_ACCEPTED_R14_SOURCE_SHA = "d377d9336b539fc03b21c48405c7ea23f908191e" as const;
export const M3_R15_SOURCE_DATASET_SHA256 = "cf836dd3344ef4a896c7a9520c65a648c19f2fa25f5f849ea6ab4e9050d32e26" as const;
export const M3_R15_SOURCE_MANIFEST_SHA256 = "2ffa7eda3a53edfeaa2e4443812c4380d0a15dd581442eec47e3f8cd82557175" as const;
export const M3_R15_SOURCE_OBSERVATION_SHA256 = "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359" as const;
export const R15_SOURCE_DATASET_SHA256 = M3_R15_SOURCE_DATASET_SHA256;
export const R15_SOURCE_MANIFEST_SHA256 = M3_R15_SOURCE_MANIFEST_SHA256;
export const R15_SOURCE_OBSERVATION_SHA256 = M3_R15_SOURCE_OBSERVATION_SHA256;
export const M3_R15_PROTOCOL_VERSION = "m3-r15-round-015-beta-alpha-decomposition-001" as const;
export const M3_R15_PERFORMANCE_LOCK = "FIRST_M3_R15_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R15_NO_CANDIDATE_OUTCOME = "NO BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015" as const;
export const M3_R15_CANDIDATE_OUTCOME = "HISTORICAL BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015" as const;
export const R15_HORIZON_HOURS = 4 as const;
export const R15_TARGET_THRESHOLD = 0.10 as const;
export const R15_RIDGE_LAMBDA = 10 as const;
export const R15_PURGE_EMBARGO_HOURS = 24 as const;
export const R15_ARTIFACT_HASH_METHOD = "SHA256_EXACT_COMMITTED_UTF8_BYTES" as const;

export const R15_SYMBOLS = Object.freeze([...RESEARCH_SYMBOLS]) as readonly ResearchSymbol[];
export const R15_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export type R15Direction = (typeof R15_DIRECTIONS)[number];
export const R15_FOLD_IDS = Object.freeze(Object.keys(R13_FOLDS) as (keyof typeof R13_FOLDS)[]);

export const R15_RESEARCH_RANGE = Object.freeze({
  startTime: Date.parse(M3_R15_RESEARCH_START_ISO),
  endTime: Date.parse(M3_R15_RESEARCH_END_ISO),
  classification: "RESEARCH_AVAILABLE_SEEN_DATA" as const,
});

export const R15_BETA_FEATURE_NAMES = Object.freeze([
  "B01_directionAdjustedBtcReturn1hAtrPriceScale",
  "B02_directionAdjustedBtcReturn4hAtrPriceScale",
  "B03_directionAdjustedBtcReturn12hAtrPriceScale",
  "B04_directionAdjustedBtcEma20MinusEma50Atr",
  "B05_directionAdjustedBtcEma50MinusEma200Atr",
  "B06_btcAtrPercentile30d",
  "B07_directionAdjustedBtcTakerImbalance",
  "B08_directionAdjustedBtcSettledFundingBurden",
  "B09_directionAdjustedFiveSymbolEma50Breadth",
  "B10_directionAdjustedFiveSymbolPositive12hBreadth",
] as const);
export type R15BetaFeatureName = (typeof R15_BETA_FEATURE_NAMES)[number];

export const R15_ALPHA_FEATURE_NAMES = Object.freeze([
  "A01_directionAdjustedSymbolMinusBtcReturn1hAtrPriceScale",
  "A02_directionAdjustedSymbolMinusBtcReturn4hAtrPriceScale",
  "A03_directionAdjustedSymbolMinusBtcReturn12hAtrPriceScale",
  "A04_directionAdjustedSymbolMinusBtcReturn24hAtrPriceScale",
  "A05_directionAdjustedEma20ExtensionAtrMinusMedian",
  "A06_directionAdjustedEma20MinusEma50AtrMinusMedian",
  "A07_atrPercentile30dMinusMedian",
  "A08_logVolumeRatioMinusMedian",
  "A09_directionAdjustedTakerImbalanceMinusMedian",
  "A10_directionAdjustedSettledFundingBurdenMinusMedian",
] as const);
export type R15AlphaFeatureName = (typeof R15_ALPHA_FEATURE_NAMES)[number];

export const R15_BETA_FEATURE_DEFINITIONS: Readonly<Record<R15BetaFeatureName, string>> = Object.freeze({
  B01_directionAdjustedBtcReturn1hAtrPriceScale: "direction * BTC 1h return / (BTC ATR14_1h / BTC close1h)",
  B02_directionAdjustedBtcReturn4hAtrPriceScale: "direction * BTC 4h return / (BTC ATR14_1h / BTC close1h)",
  B03_directionAdjustedBtcReturn12hAtrPriceScale: "direction * BTC 12h return / (BTC ATR14_1h / BTC close1h)",
  B04_directionAdjustedBtcEma20MinusEma50Atr: "direction * (BTC EMA20_1h - BTC EMA50_1h) / BTC ATR14_1h",
  B05_directionAdjustedBtcEma50MinusEma200Atr: "direction * (BTC EMA50_4h - BTC EMA200_4h) / BTC ATR14_4h",
  B06_btcAtrPercentile30d: "BTC ATR14_1h / close percentile over the past 30 closed days",
  B07_directionAdjustedBtcTakerImbalance: "direction-adjusted BTC closed 1h taker imbalance",
  B08_directionAdjustedBtcSettledFundingBurden: "direction-adjusted latest settled BTC funding burden",
  B09_directionAdjustedFiveSymbolEma50Breadth: "direction-adjusted fraction of the five symbols above EMA50_1h",
  B10_directionAdjustedFiveSymbolPositive12hBreadth: "direction-adjusted fraction of the five symbols with positive 12h return",
});

export const R15_ALPHA_FEATURE_DEFINITIONS: Readonly<Record<R15AlphaFeatureName, string>> = Object.freeze({
  A01_directionAdjustedSymbolMinusBtcReturn1hAtrPriceScale: "(direction * symbol 1h return - direction * BTC 1h return) / symbol ATR-price scale",
  A02_directionAdjustedSymbolMinusBtcReturn4hAtrPriceScale: "(direction * symbol 4h return - direction * BTC 4h return) / symbol ATR-price scale",
  A03_directionAdjustedSymbolMinusBtcReturn12hAtrPriceScale: "(direction * symbol 12h return - direction * BTC 12h return) / symbol ATR-price scale",
  A04_directionAdjustedSymbolMinusBtcReturn24hAtrPriceScale: "direction * (symbol 24h return - BTC 24h return) / symbol ATR-price scale",
  A05_directionAdjustedEma20ExtensionAtrMinusMedian: "direction-adjusted symbol EMA20 extension ATR minus same-time cross-sectional median",
  A06_directionAdjustedEma20MinusEma50AtrMinusMedian: "direction-adjusted symbol EMA20-EMA50 spread ATR minus same-time cross-sectional median",
  A07_atrPercentile30dMinusMedian: "symbol 30d ATR percentile minus same-time cross-sectional median",
  A08_logVolumeRatioMinusMedian: "symbol log volume-ratio feature minus same-time cross-sectional median",
  A09_directionAdjustedTakerImbalanceMinusMedian: "direction-adjusted symbol taker imbalance minus same-time cross-sectional median",
  A10_directionAdjustedSettledFundingBurdenMinusMedian: "direction-adjusted symbol settled funding burden minus same-time cross-sectional median",
});

export const R15_GATE_THRESHOLDS = Object.freeze({
  minimumSelectedValidationObservationsAggregate: 500,
  minimumSelectedValidationObservationsPerFold: 50,
  minimumMeanNetForwardAtr: 0.10,
  minimumProfitFactor: 1.30,
  minimumPositiveFolds: 5,
  maximumCatastrophicFolds: 0,
  minimumBetaPositiveCorrelationFolds: 5,
  minimumAlphaPositiveCorrelationFolds: 5,
  minimumPooledAlphaSpearman: 0.03,
  minimumAlphaTopBottomSpread: 0.15,
  minimumAlphaPositiveSpreadFolds: 5,
  minimumCostStressMean: 0,
  minimumCostStressProfitFactor: 1.05,
  minimumLatencyStressMean: 0,
  maximumPositiveSymbolContributionShare: 0.50,
  maximumSinglePositiveObservationContribution: 0.05,
} as const);

export const R15_GOVERNANCE = Object.freeze({
  studyClassification: "HISTORICAL_DEVELOPMENT_STUDY",
  historicalEvidenceSelectionBasis: "SEEN_HYPOTHESIS_FROM_R14",
  forwardShadowRequiredAfterSpecPublication: true,
  productionEligibleDirectly: false,
  noPrivateBinanceApi: true,
  noAutomaticTrading: true,
  tradingEnabled: false,
  baseline001Unchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  productionDataExcluded: true,
  networkDisabledDuringPerformance: true,
});

export const R15_SPEC_OBJECT = Object.freeze({
  protocolVersion: M3_R15_PROTOCOL_VERSION,
  researchRoundId: M3_R15_RESEARCH_ROUND_ID,
  classification: "HISTORICAL_DEVELOPMENT_STUDY",
  acceptedR14SourceSha: M3_R15_ACCEPTED_R14_SOURCE_SHA,
  sourceDatasetSha256: M3_R15_SOURCE_DATASET_SHA256,
  sourceManifestSha256: M3_R15_SOURCE_MANIFEST_SHA256,
  sourceObservationSha256: M3_R15_SOURCE_OBSERVATION_SHA256,
  researchUniverse: R15_RESEARCH_RANGE,
  symbols: R15_SYMBOLS,
  directions: R15_DIRECTIONS,
  folds: R15_FOLD_IDS,
  horizonHours: R15_HORIZON_HOURS,
  h4SelectionBasis: "SEEN_HYPOTHESIS_FROM_R14",
  target: {
    marketBeta: "MEDIAN_OF_FIVE_SYMBOL_DIRECTIONAL_H4_NET_FORWARD_ATR_AT_SAME_DECISION_TIME",
    relativeAlpha: "SYMBOL_DIRECTIONAL_H4_NET_FORWARD_ATR_MINUS_MARKET_BETA_TARGET",
    symbolTargetReconstruction: "MARKET_BETA_TARGET_PLUS_RELATIVE_ALPHA_TARGET_EXACTLY",
  },
  betaModel: {
    modelId: "R15-BETA-H4",
    model: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION",
    lambda: R15_RIDGE_LAMBDA,
    trainingRow: "DECISION_TIME_X_DIRECTION",
    noSymbolIdentity: true,
    featureNames: R15_BETA_FEATURE_NAMES,
    featureDefinitions: R15_BETA_FEATURE_DEFINITIONS,
  },
  alphaModel: {
    modelId: "R15-ALPHA-H4",
    model: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION",
    lambda: R15_RIDGE_LAMBDA,
    trainingRow: "DECISION_TIME_X_SYMBOL_X_DIRECTION",
    noSymbolIdentity: true,
    noPerSymbolCoefficients: true,
    featureNames: R15_ALPHA_FEATURE_NAMES,
    featureDefinitions: R15_ALPHA_FEATURE_DEFINITIONS,
  },
  training: {
    standardization: "RESEARCH_ONLY",
    validation: "PREDICT_ONLY_NO_REFIT_NO_THRESHOLD_UPDATE",
    purgeEmbargoHours: R15_PURGE_EMBARGO_HOURS,
  },
  combinedPrediction: "PREDICTED_MARKET_BETA_PLUS_PREDICTED_RELATIVE_ALPHA_ONLY",
  selection: {
    threshold: R15_TARGET_THRESHOLD,
    thresholdMeaning: "PREDECLARED_ECONOMIC_SAFETY_MARGIN",
    maximumSignalsPerDecisionTime: 1,
    belowThreshold: "NO_TRADE",
    tieBreak: ["higher predictedNetAtr", "R15 symbol order", "LONG before SHORT"],
  },
  stress: { transactionCostMultiplier: 1.5, actionableLatencyMinutes: 7, retraining: false },
  gates: R15_GATE_THRESHOLDS,
  governance: R15_GOVERNANCE,
  artifactHashMethod: R15_ARTIFACT_HASH_METHOD,
});

export const R15_SPEC_CANONICAL_JSON = stableStringify(R15_SPEC_OBJECT);
export const R15_SPEC_SHA256 = createHash("sha256").update(R15_SPEC_CANONICAL_JSON, "utf8").digest("hex");

export const R15_REQUIRED_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R15_ROUND_015_SUMMARY.json",
  "docs/evidence/M3_R15_ROUND_015_AUDIT.json",
  "docs/M3_R15_ROUND_015_RESULTS.md",
  "docs/evidence/M3_R15_ROUND_015_SELECTION.json",
  "docs/evidence/M3_R15_ROUND_015_SELECTION.md",
] as const);
export const R15_SPEC_PATH = "docs/research/round-015-spec.json" as const;
export const R15_PLAN_PATH = "docs/research/round-015-plan.json" as const;
export const R15_CONFORMANCE_PATH = "docs/research/round-015-conformance.json" as const;
export const R15_OBSERVATION_FREEZE_PATH = "docs/research/round-015-observation-freeze.json" as const;
export const R15_OBSERVATION_DATA_PATH = ".cache/tradepulse/round-015/observations.ndjson" as const;
export const R15_PUBLICATION_HASHES_PATH = "docs/research/round-015-publication-hashes.json" as const;

export function r15HashUtf8Bytes(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

export function r15DirectionSign(direction: R13Direction | R15Direction): 1 | -1 {
  return direction === "LONG" ? 1 : -1;
}

export const R15_SOURCE_R13_HORIZON_HOURS = R13_HORIZON_HOURS;
export const R15_SOURCE_R13_RANGE = M3_R13_RESEARCH_RANGE;
export const R15_SOURCE_R13_SYMBOLS = R13_SYMBOLS;
