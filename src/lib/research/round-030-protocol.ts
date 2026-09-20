import { createHash } from "node:crypto";

import { R13_DIRECTIONS, R13_FEATURE_NAMES, R13_FOLD_IDS, R13_FOLDS, R13_SYMBOLS, type R13FeatureName } from "./m3-r13-round-013-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R30_RESEARCH_ROUND_ID = "baseline-002-research-round-030" as const;
export const R30_PHASE = "TARGET_AND_SOURCE_DIAGNOSTIC_ONLY" as const;
export const R30_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R30_BASE_SHA = "bea7f4bba421e9dcec1a17b8b952cf183fbe35dc" as const;
export const R30_BRANCH = "research/round-030-stress-target-source-admission" as const;

export const R30_SOURCE_PATH = ".cache/tradepulse/round-014/observations.ndjson" as const;
export const R30_SOURCE_MANIFEST_PATH = "docs/research/round-014-observation-freeze.json" as const;
export const R30_SOURCE_SHA256 = "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359" as const;
export const R30_SOURCE_MANIFEST_SHA256 = "7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6" as const;
export const R30_SOURCE_BYTES = 1_893_811_055 as const;
export const R30_SOURCE_OBSERVATION_COUNT = 244_810 as const;
export const R30_SOURCE_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R30_SOURCE_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const R30_SOURCE_FREEZE_COMMIT = "44d630dd387e75ed9a46713a94f38221fa48ab0f" as const;

export const R30_HORIZON_HOURS = 4 as const;
export const R30_PURGE_EMBARGO_HOURS = 24 as const;
export const R30_LOGISTIC_LAMBDA = 10 as const;
export const R30_LOGISTIC_MAX_ITERATIONS = 100 as const;
export const R30_LOGISTIC_TOLERANCE = 1e-10 as const;
export const R30_LOGISTIC_PREDICTOR_CLAMP = Object.freeze({ min: -30, max: 30 } as const);

export const R30_DIRECTIONS = Object.freeze([...R13_DIRECTIONS] as const);
export type R30Direction = (typeof R30_DIRECTIONS)[number];
export const R30_FOLD_IDS = Object.freeze([...R13_FOLD_IDS] as const);
export type R30FoldId = (typeof R30_FOLD_IDS)[number];
export const R30_FOLDS = R13_FOLDS;
export const R30_SYMBOLS = Object.freeze([...R13_SYMBOLS] as const);
export const R30_FEATURE_NAMES = Object.freeze([...R13_FEATURE_NAMES] as const);
export type R30FeatureName = R13FeatureName;

export const R30_TARGET_IDS = Object.freeze(["T0", "T1", "T2", "T3"] as const);
export type R30TargetId = (typeof R30_TARGET_IDS)[number];
export const R30_REDESIGN_TARGET_IDS = Object.freeze(["T1", "T2", "T3"] as const);
export type R30RedesignTargetId = (typeof R30_REDESIGN_TARGET_IDS)[number];

export const R30_MODEL_ARCHITECTURES = Object.freeze({
  LONG: "RAW_LINEAR_ALL18",
  SHORT: "XS_LINEAR_ALL18",
} as const);

export const R30_TARGET_DEFINITIONS = Object.freeze({
  T0: Object.freeze({ id: "T0", name: "PRIMARY_POSITIVE", source: "labels[4]", definition: "status === EXECUTED && netForwardAtr > 0 => 1; netForwardAtr <= 0 => 0", baselineOnly: true }),
  T1: Object.freeze({ id: "T1", name: "PRIMARY_COST_STRESS_POSITIVE", source: "labels[4]", definition: "status === EXECUTED && netForwardAtrCostStress > 0 => 1; netForwardAtrCostStress <= 0 => 0", baselineOnly: false }),
  T2: Object.freeze({ id: "T2", name: "LATENCY_POSITIVE", source: "latencyStressLabels[4]", definition: "status === EXECUTED && netForwardAtr > 0 => 1; netForwardAtr <= 0 => 0", baselineOnly: false }),
  T3: Object.freeze({ id: "T3", name: "LATENCY_COST_STRESS_POSITIVE", source: "latencyStressLabels[4]", definition: "status === EXECUTED && netForwardAtrCostStress > 0 => 1; netForwardAtrCostStress <= 0 => 0", baselineOnly: false }),
} as const);

export const R30_THRESHOLDS = Object.freeze({
  minimumMedianT3Auc: 0.53,
  minimumPositiveT3AucFolds: 4,
  minimumWorstFoldT3Auc: 0.48,
  minimumMedianStressAlignedRankIc: 0.05,
  minimumPositiveStressAlignedRankIcFolds: 4,
  minimumMedianT3AucImprovementVsT0: 0.01,
} as const);

export const R30_SOURCE_PROBE_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const);
export const R30_SOURCE_PROBE_DATES = Object.freeze(["2023-01-03", "2024-01-15", "2025-01-15", "2026-06-24", "2026-06-26", "2026-08-15", "2026-09-18"] as const);
export const R30_SOURCE_PROBE_ENDPOINTS = Object.freeze(["openInterestHist", "topLongShortAccountRatio", "topLongShortPositionRatio", "globalLongShortAccountRatio", "takerlongshortRatio"] as const);
export type R30SourceProbeEndpoint = (typeof R30_SOURCE_PROBE_ENDPOINTS)[number];
export const R30_ARCHIVE_FIELDS = Object.freeze([
  "create_time",
  "symbol",
  "sum_open_interest",
  "sum_open_interest_value",
  "count_toptrader_long_short_ratio",
  "sum_toptrader_long_short_ratio",
  "count_long_short_ratio",
  "sum_taker_long_short_vol_ratio",
] as const);
export const R30_FIELD_MAPPINGS = Object.freeze({
  openInterest: Object.freeze({ archiveField: "sum_open_interest", endpoint: "openInterestHist", liveField: "sumOpenInterest" }),
  topAccount: Object.freeze({ archiveField: "count_toptrader_long_short_ratio", endpoint: "topLongShortAccountRatio", liveField: "longShortRatio" }),
  topPosition: Object.freeze({ archiveField: "sum_toptrader_long_short_ratio", endpoint: "topLongShortPositionRatio", liveField: "longShortRatio" }),
  globalRatio: Object.freeze({ archiveField: "count_long_short_ratio", endpoint: "globalLongShortAccountRatio", liveField: "longShortRatio" }),
  takerRatio: Object.freeze({ archiveField: "sum_taker_long_short_vol_ratio", endpoint: "takerlongshortRatio", liveField: "buySellRatio" }),
} as const);
export const R30_TIMESTAMP_MAPPING_OPTIONS = Object.freeze(["EXACT", "ARCHIVE_MINUS_5M", "ARCHIVE_PLUS_5M"] as const);
export const R30_ARCHIVE_FEATURE_AVAILABLE_LAG_MINUTES = 5 as const;

export const R30_GOVERNANCE = Object.freeze({
  candidateExecutableFrozen: false,
  forwardCandidateExists: false,
  forwardValidationAuthorized: false,
  forwardEconomicValuesRead: false,
  forwardReturnRead: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  automaticTrading: false,
  humanDecisionRequired: true,
  productionUnchanged: true,
  emailRestorationAuthorized: false,
  baseline002Status: "NOT_FROZEN",
  m3GStatus: "EXCLUDED_FROM_ROUND_030",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
} as const);

export const R30_PROTOCOL_OBJECT = Object.freeze({
  schemaVersion: "m3-r30-target-source-admission-protocol-001",
  researchRoundId: R30_RESEARCH_ROUND_ID,
  phase: R30_PHASE,
  base: Object.freeze({ branch: R30_BASE_BRANCH, sha: R30_BASE_SHA }),
  branch: R30_BRANCH,
  inheritedR29Conclusion: Object.freeze({ eligibleLongCandidates: 0, eligibleShortCandidates: 0, longChampionId: null, shortChampionId: null, developmentClassification: "NO_DEVELOPMENT_CHAMPION", direction: "CURRENT_FEATURE_INFORMATION_NOT_ECONOMICALLY_ACTIONABLE" }),
  source: Object.freeze({ status: "ACCEPTED_R14_OBSERVATION_FREEZE_REUSED", canonicalPath: R30_SOURCE_PATH, manifestPath: R30_SOURCE_MANIFEST_PATH, sha256: R30_SOURCE_SHA256, manifestSha256: R30_SOURCE_MANIFEST_SHA256, bytes: R30_SOURCE_BYTES, observationCount: R30_SOURCE_OBSERVATION_COUNT, window: Object.freeze({ start: R30_SOURCE_START_ISO, end: R30_SOURCE_END_ISO }), classification: "DEVELOPMENT_ONLY / ALREADY_SEEN", networkAcquired: false, newMarketData: false }),
  features: R30_FEATURE_NAMES,
  symbols: R30_SYMBOLS,
  directions: R30_DIRECTIONS,
  folds: R30_FOLDS,
  purgeEmbargoHours: R30_PURGE_EMBARGO_HOURS,
  horizonHours: R30_HORIZON_HOURS,
  targets: R30_TARGET_DEFINITIONS,
  architectures: R30_MODEL_ARCHITECTURES,
  model: Object.freeze({ type: "BINARY_LOGISTIC_REGRESSION", lambda: R30_LOGISTIC_LAMBDA, intercept: "UNPENALIZED", maxIterations: R30_LOGISTIC_MAX_ITERATIONS, tolerance: R30_LOGISTIC_TOLERANCE, predictorClamp: R30_LOGISTIC_PREDICTOR_CLAMP, architectureSearch: false, thresholdSearch: false, horizonSearch: false }),
  validationBoundary: Object.freeze({ featureOnlyKeys: Object.freeze(["observationId", "decisionTime", "symbol", "direction", "features"]), forbiddenKeys: Object.freeze(["labels", "latencyStressLabels", "primaryStatus", "latencyStatus", "netR", "costStressNetR", "sourceObservation"]), scoreBeforeOutcomeJoin: true, outcomeJoinKey: "observationId" }),
  executionMatrix: Object.freeze({ directions: 2, trainingTargets: 4, folds: 6, totalFits: 48, r30DiagnosticExecutionCount: 1, targetDiagnosticExecutionCount: 1 }),
  finalDiagnosticOutcome: Object.freeze({ target: "T3", continuous: "latencyStressLabels[4].netForwardAtrCostStress", allowedUses: Object.freeze(["T3 AUC", "Spearman / rank IC"]), forbiddenUses: Object.freeze(["PnL", "PF", "drawdown", "candidate selection"]) }),
  thresholds: R30_THRESHOLDS,
  targetSelection: Object.freeze({ eligibleTargets: R30_REDESIGN_TARGET_IDS, sort: Object.freeze(["worstFoldT3Auc DESC", "medianT3Auc DESC", "medianStressAlignedRankIc DESC", "targetId lexical ASC"]), maximumPerDirection: 1, t0BaselineOnly: true }),
  stageB: Object.freeze({ trigger: "LONG selectedTarget === null OR SHORT selectedTarget === null", sourceFamily: "BINANCE_VISION_USDM_METRICS", allowedNetwork: Object.freeze(["public metadata/documentation", "public Binance Vision sample downloads", "public Binance futures market-data endpoints"]), privateApi: false, paidVendor: false, economicEvaluation: false, symbols: R30_SOURCE_PROBE_SYMBOLS, dates: R30_SOURCE_PROBE_DATES, archivePath: "data/futures/um/daily/metrics/{SYMBOL}/{SYMBOL}-metrics-{YYYY-MM-DD}.zip", checksumSuffix: ".CHECKSUM", archiveCanBeRevised: true, timestampOptions: R30_TIMESTAMP_MAPPING_OPTIONS, minimumAgreementRate: 0.995, maximumRelativeError: 1e-8, minimum5mDeltaRate: 0.99, maximumConflictingDuplicates: 0, featureAvailableTimeRule: "archive create_time + 5 minutes", prospectiveSource: "live public endpoints with localReceiptTimestamp <= decisionTime; archive never prospective" }),
  closedPriorRounds: Object.freeze({ round020LiquidationClosureReopened: false }),
  governance: R30_GOVERNANCE,
  economicEvaluationPerformed: false,
  tradingEconomicMetricsCalculated: false,
  noForwardData: true,
} as const);

export const R30_PROTOCOL_SHA256 = createHash("sha256").update(stableStringify(R30_PROTOCOL_OBJECT), "utf8").digest("hex");

export function assertR30ProtocolRuntime(): true {
  if (R30_BASE_SHA !== "bea7f4bba421e9dcec1a17b8b952cf183fbe35dc") throw new Error("R30 base identity changed.");
  if (R30_SOURCE_SHA256 !== "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359") throw new Error("R30 R14 source identity changed.");
  if (R30_TARGET_IDS.length !== 4 || R30_REDESIGN_TARGET_IDS.length !== 3 || R30_FOLD_IDS.length !== 6 || R30_SOURCE_PROBE_SYMBOLS.length !== 5 || R30_SOURCE_PROBE_DATES.length !== 7) throw new Error("R30 fixed cardinality changed.");
  if (R30_GOVERNANCE.automaticTrading !== false || R30_GOVERNANCE.performanceExecutionCount !== 0) throw new Error("R30 governance boundary changed.");
  return true;
}
