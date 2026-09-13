import { createHash } from "node:crypto";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import {
  M3_R13_RESEARCH_END_ISO,
  M3_R13_RESEARCH_START_ISO,
  R13_FOLDS,
} from "./m3-r13-round-013-protocol.ts";
import { R15_ALPHA_FEATURE_NAMES, R15_BETA_FEATURE_NAMES } from "./m3-r15-round-015-protocol.ts";
import { stableStringify } from "./utils.ts";

export const M3_R16_RESEARCH_ROUND_ID = "baseline-002-research-round-016" as const;
export const M3_R16_ACCEPTED_R15_SOURCE_SHA = "c3986653f8b7ef26bb0e58b545fa3426386605e4" as const;
export const M3_R16_SOURCE_DATASET_SHA256 = "cf836dd3344ef4a896c7a9520c65a648c19f2fa25f5f849ea6ab4e9050d32e26" as const;
export const M3_R16_SOURCE_MANIFEST_SHA256 = "2ffa7eda3a53edfeaa2e4443812c4380d0a15dd581442eec47e3f8cd82557175" as const;
export const M3_R16_SOURCE_R14_OBSERVATION_SHA256 = "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359" as const;
export const M3_R16_SOURCE_R15_OBSERVATION_SHA256 = "6f16065a7c1a763a2da35f2f60afc5c2b2a95cf44da5586abcfa760fdc7a1574" as const;
export const M3_R16_RESEARCH_START_ISO = M3_R13_RESEARCH_START_ISO;
export const M3_R16_RESEARCH_END_ISO = M3_R13_RESEARCH_END_ISO;
export const M3_R16_PROTOCOL_VERSION = "m3-r16-round-016-derivatives-microstructure-information-gain-001" as const;
export const M3_R16_PERFORMANCE_LOCK = "FIRST_M3_R16_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R16_NO_GAIN_OUTCOME = "NO ROBUST MICROSTRUCTURE INFORMATION GAIN — ROUND-016" as const;
export const M3_R16_GAIN_OUTCOME = "MICROSTRUCTURE INFORMATION GAIN — ROUND-016" as const;
export const R16_HORIZON_HOURS = 4 as const;
export const R16_PURGE_EMBARGO_HOURS = 24 as const;
export const R16_RIDGE_LAMBDA = 10 as const;
export const R16_ARTIFACT_HASH_METHOD = "SHA256_EXACT_COMMITTED_UTF8_BYTES" as const;
export const R16_METRICS_INTERVAL_MS = 5 * 60_000;
export const R16_BASIS_INTERVAL_MS = 5 * 60_000;

export const R16_SYMBOLS = Object.freeze([...RESEARCH_SYMBOLS]) as readonly ResearchSymbol[];
export const R16_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export type R16Direction = (typeof R16_DIRECTIONS)[number];
export const R16_FOLD_IDS = Object.freeze(Object.keys(R13_FOLDS) as (keyof typeof R13_FOLDS)[]);

export const R16_RESEARCH_RANGE = Object.freeze({
  startTime: Date.parse(M3_R16_RESEARCH_START_ISO),
  endTime: Date.parse(M3_R16_RESEARCH_END_ISO),
  classification: "RESEARCH_AVAILABLE_SEEN_DATA" as const,
});

export const R16_BETA_CONTROL_FEATURE_NAMES = Object.freeze([...R15_BETA_FEATURE_NAMES]);
export const R16_ALPHA_CONTROL_FEATURE_NAMES = Object.freeze([...R15_ALPHA_FEATURE_NAMES]);

export const R16_BETA_MICRO_FEATURE_NAMES = Object.freeze([
  ...R15_BETA_FEATURE_NAMES,
  "MB01_btcOiChange1h",
  "MB02_btcOiChange4h",
  "MB03_btcOiChange12h",
  "MB04_directionAdjustedBtcPriceOiInteraction",
  "MB05_directionAdjustedBtcBasisNowBps",
  "MB06_directionAdjustedBtcBasisChange1h",
  "MB07_directionAdjustedBtcBasisChange4h",
  "MB08_directionAdjustedBtcTaker1h",
  "MB09_directionAdjustedBtcTaker3h",
  "MB10_directionAdjustedBtcTakerAcceleration",
] as const);
export type R16BetaMicroFeatureName = (typeof R16_BETA_MICRO_FEATURE_NAMES)[number];

export const R16_ALPHA_MICRO_FEATURE_NAMES = Object.freeze([
  ...R15_ALPHA_FEATURE_NAMES,
  "MA01_oiChange1hMinusMedian",
  "MA02_oiChange4hMinusMedian",
  "MA03_oiChange12hMinusMedian",
  "MA04_directionAdjustedPriceOiInteractionMinusMedian",
  "MA05_directionAdjustedBasisNowMinusMedian",
  "MA06_directionAdjustedBasisChange1hMinusMedian",
  "MA07_directionAdjustedBasisChange4hMinusMedian",
  "MA08_directionAdjustedTaker1hMinusMedian",
  "MA09_directionAdjustedTaker3hMinusMedian",
  "MA10_directionAdjustedTakerAccelerationMinusMedian",
] as const);
export type R16AlphaMicroFeatureName = (typeof R16_ALPHA_MICRO_FEATURE_NAMES)[number];

export const R16_BETA_MICRO_FEATURE_DEFINITIONS: Readonly<Record<string, string>> = Object.freeze({
  MB01_btcOiChange1h: "ln(BTC OI_QTY_t / BTC OI_QTY_t-1h)",
  MB02_btcOiChange4h: "ln(BTC OI_QTY_t / BTC OI_QTY_t-4h)",
  MB03_btcOiChange12h: "ln(BTC OI_QTY_t / BTC OI_QTY_t-12h)",
  MB04_directionAdjustedBtcPriceOiInteraction: "directionSign * BTC closed 4h return * BTC OI4",
  MB05_directionAdjustedBtcBasisNowBps: "directionSign * basisNowBps",
  MB06_directionAdjustedBtcBasisChange1h: "directionSign * (basisNowBps - basis1hAgoBps)",
  MB07_directionAdjustedBtcBasisChange4h: "directionSign * (basisNowBps - basis4hAgoBps)",
  MB08_directionAdjustedBtcTaker1h: "directionSign * mean(takerLogRatio over exact prior 1h)",
  MB09_directionAdjustedBtcTaker3h: "directionSign * mean(takerLogRatio over exact prior 3h)",
  MB10_directionAdjustedBtcTakerAcceleration: "directionSign * (taker1h - immediatelyPriorTaker1h)",
});

export const R16_ALPHA_MICRO_FEATURE_DEFINITIONS: Readonly<Record<string, string>> = Object.freeze({
  MA01_oiChange1hMinusMedian: "OI1 - same-time five-symbol median(OI1)",
  MA02_oiChange4hMinusMedian: "OI4 - same-time five-symbol median(OI4)",
  MA03_oiChange12hMinusMedian: "OI12 - same-time five-symbol median(OI12)",
  MA04_directionAdjustedPriceOiInteractionMinusMedian: "directional priceOiInteraction - same-time five-symbol median",
  MA05_directionAdjustedBasisNowMinusMedian: "directional basisNowBps - same-time five-symbol median",
  MA06_directionAdjustedBasisChange1hMinusMedian: "directional basisChange1h - same-time five-symbol median",
  MA07_directionAdjustedBasisChange4hMinusMedian: "directional basisChange4h - same-time five-symbol median",
  MA08_directionAdjustedTaker1hMinusMedian: "directional taker1h - same-time five-symbol median",
  MA09_directionAdjustedTaker3hMinusMedian: "directional taker3h - same-time five-symbol median",
  MA10_directionAdjustedTakerAccelerationMinusMedian: "directional takerAcceleration - same-time five-symbol median",
});

export const R16_GATE_THRESHOLDS = Object.freeze({
  minimumCommonMaskCoverage: 0.90,
  minimumValidationFoldCoverage: 0.85,
  minimumTrainingFoldCoverage: 0.85,
  minimumMicroBetaPooledPearson: 0.08,
  minimumMicroMinusControlBetaPooledPearson: 0.02,
  minimumMicroPositiveBetaPearsonFolds: 5,
  minimumMicroBetaImprovementFolds: 4,
  maximumMicroNegativeBetaPearson: -0.02,
  minimumMicroAlphaMeanTimestampSpearman: 0.05,
  minimumMicroMinusControlAlphaMeanTimestampSpearman: 0.015,
  minimumMicroPositiveAlphaSpearmanFolds: 5,
  minimumMicroAlphaImprovementFolds: 4,
  minimumMicroAlphaTopBottomSpread: 0.15,
  minimumMicroMinusControlAlphaSpread: 0.04,
  minimumMicroPositiveAlphaSpreadFolds: 5,
  maximumMicroNegativeAlphaSpearman: -0.02,
} as const);

export const R16_GOVERNANCE = Object.freeze({
  classification: "HISTORICAL_DEVELOPMENT_INFORMATION_STUDY",
  sourcePolicy: "OFFICIAL_BINANCE_VISION_USDM_ARCHIVE_ONLY",
  productionDataExcluded: true,
  productionSeenDataClassification: "SEEN_HYPOTHESIS_GENERATING_DIAGNOSTIC_ONLY",
  baseline001Unchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  forwardShadowEligible: false,
  privateBinanceApi: false,
  automaticTrading: false,
  tradingEnabled: false,
  networkDisabledDuringPerformance: true,
  liquidationFeatureStatus: "DEFERRED_NOT_INCLUDED_IN_R16",
});

export const R16_SPEC_OBJECT = Object.freeze({
  protocolVersion: M3_R16_PROTOCOL_VERSION,
  researchRoundId: M3_R16_RESEARCH_ROUND_ID,
  classification: R16_GOVERNANCE.classification,
  acceptedR15SourceSha: M3_R16_ACCEPTED_R15_SOURCE_SHA,
  sourceDatasetSha256: M3_R16_SOURCE_DATASET_SHA256,
  sourceManifestSha256: M3_R16_SOURCE_MANIFEST_SHA256,
  sourceR14ObservationSha256: M3_R16_SOURCE_R14_OBSERVATION_SHA256,
  sourceR15ObservationSha256: M3_R16_SOURCE_R15_OBSERVATION_SHA256,
  researchRange: R16_RESEARCH_RANGE,
  symbols: R16_SYMBOLS,
  directions: R16_DIRECTIONS,
  foldIds: R16_FOLD_IDS,
  horizonHours: R16_HORIZON_HOURS,
  purgeEmbargoHours: R16_PURGE_EMBARGO_HOURS,
  sourceUniverse: "EXACT_BASELINE_001_FORMAL_R15_OBSERVATION_STREAM",
  newInformationFamilies: ["OPEN_INTEREST", "MARK_INDEX_BASIS", "TAKER_FLOW_PERSISTENCE"],
  data: {
    officialBaseUrl: "https://data.binance.vision/data/futures/um",
    metricsPath: "daily/metrics",
    basisPaths: ["monthly/markPriceKlines", "monthly/indexPriceKlines", "daily/markPriceKlines", "daily/indexPriceKlines"],
    basisInterval: "5m",
    archivesOnly: true,
    restHistoricalBackfill: false,
    interpolation: false,
    globalMask: "R16_VALID_DECISION_TIME_MASK",
  },
  beta: {
    controlModelId: "R16-BETA-CONTROL",
    microModelId: "R16-BETA-MICRO",
    controlFeatureNames: R16_BETA_CONTROL_FEATURE_NAMES,
    microFeatureNames: R16_BETA_MICRO_FEATURE_NAMES,
    microFeatureDefinitions: R16_BETA_MICRO_FEATURE_DEFINITIONS,
  },
  alpha: {
    controlModelId: "R16-ALPHA-CONTROL",
    microModelId: "R16-ALPHA-MICRO",
    controlFeatureNames: R16_ALPHA_CONTROL_FEATURE_NAMES,
    microFeatureNames: R16_ALPHA_MICRO_FEATURE_NAMES,
    microFeatureDefinitions: R16_ALPHA_MICRO_FEATURE_DEFINITIONS,
  },
  target: {
    source: "EXACT_R15_H4_TARGETS",
    marketBetaTarget: "MEDIAN_OF_FIVE_SYMBOL_DIRECTIONAL_H4_NET_FORWARD_ATR",
    relativeAlphaTarget: "SYMBOL_H4_NET_FORWARD_ATR_MINUS_MARKET_BETA_TARGET",
  },
  model: {
    type: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION",
    lambda: R16_RIDGE_LAMBDA,
    models: ["R16-BETA-CONTROL", "R16-BETA-MICRO", "R16-ALPHA-CONTROL", "R16-ALPHA-MICRO"],
    standardization: "RESEARCH_ONLY",
    validation: "PREDICT_ONLY_NO_REFIT_NO_THRESHOLD_UPDATE",
    noSweep: true,
    noOptimizer: true,
    noSymbolIdentity: true,
  },
  folds: { ids: R16_FOLD_IDS, purgeEmbargoHours: R16_PURGE_EMBARGO_HOURS, sameCommonMaskForControlAndMicro: true },
  gates: R16_GATE_THRESHOLDS,
  governance: R16_GOVERNANCE,
  artifactHashMethod: R16_ARTIFACT_HASH_METHOD,
});

export const R16_SPEC_CANONICAL_JSON = stableStringify(R16_SPEC_OBJECT);
export const R16_SPEC_SHA256 = createHash("sha256").update(R16_SPEC_CANONICAL_JSON, "utf8").digest("hex");

export const R16_REQUIRED_OUTPUT_PATHS = Object.freeze([
  "docs/research/round-016-spec.json",
  "docs/research/round-016-plan.json",
  "docs/research/round-016-conformance.json",
  "docs/research/round-016-micro-data-freeze.json",
  "docs/research/round-016-observation-freeze.json",
  "docs/research/round-016-publication-hashes.json",
  "docs/evidence/M3_R16_ROUND_016_SUMMARY.json",
  "docs/evidence/M3_R16_ROUND_016_AUDIT.json",
  "docs/M3_R16_ROUND_016_RESULTS.md",
  "docs/evidence/M3_R16_ROUND_016_SELECTION.json",
  "docs/evidence/M3_R16_ROUND_016_SELECTION.md",
] as const);
export const R16_SPEC_PATH = R16_REQUIRED_OUTPUT_PATHS[0];
export const R16_PLAN_PATH = R16_REQUIRED_OUTPUT_PATHS[1];
export const R16_CONFORMANCE_PATH = R16_REQUIRED_OUTPUT_PATHS[2];
export const R16_MICRO_DATA_FREEZE_PATH = R16_REQUIRED_OUTPUT_PATHS[3];
export const R16_OBSERVATION_FREEZE_PATH = R16_REQUIRED_OUTPUT_PATHS[4];
export const R16_PUBLICATION_HASHES_PATH = R16_REQUIRED_OUTPUT_PATHS[5];
export const R16_OBSERVATION_DATA_PATH = ".cache/tradepulse/round-016/observations.ndjson" as const;
export const R16_DEFAULT_CACHE_DIRECTORY = ".cache/tradepulse/round-016" as const;
export const R16_PERFORMANCE_LEDGER_PATH = "docs/research/round-016-performance-ledger.json" as const;

export function r16HashUtf8Bytes(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

export function r16DirectionSign(direction: R16Direction): 1 | -1 {
  return direction === "LONG" ? 1 : -1;
}

export function r16SourceBoundaryTimestamp(): number {
  return Date.parse(M3_R16_RESEARCH_END_ISO);
}
