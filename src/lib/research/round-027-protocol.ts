import { createHash } from "node:crypto";

import { LONG_FEATURE_NAMES } from "./round-024-long-candidate.ts";
import { SHORT_ALTERNATE_FEATURE_NAMES, SHORT_FEATURE_NAMES } from "./round-024-short-candidate.ts";
import { R25_COST_POLICY, R25_COST_POLICY_HASH, R25_FOLDS_SOURCE, R25_SETTLEMENT_HASH } from "./round-025-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R27_RESEARCH_ROUND_ID = "baseline-002-research-round-027" as const;
export const R27_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R27_BASE_SHA = "919265491bb85e2cc780acab4c6ebc18a42cfe9a" as const;
export const R27_BRANCH = "research/round-027-directional-target-model-redesign" as const;
export const R27_PHASE = "BOUNDED_DEVELOPMENT_ONLY" as const;

export const R27_DEVELOPMENT_DATA_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R27_DEVELOPMENT_DATA_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const R27_HORIZON_HOURS = 4 as const;
export const R27_PURGE_EMBARGO_HOURS = 24 as const;
export const R27_MANUAL_LATENCY_MINUTES = 7 as const;
export const R27_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const);
export const R27_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export const R27_FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);

export const R27_LOGISTIC_LAMBDA = 10 as const;
export const R27_LOGISTIC_MAX_ITERATIONS = 100 as const;
export const R27_LOGISTIC_TOLERANCE = 1e-10 as const;
export const R27_LOGISTIC_LINEAR_PREDICTOR_CLAMP = Object.freeze({ min: -30, max: 30 } as const);
export const R27_POSITIVE_PROBABILITY_THRESHOLD = 0.5 as const;
export const R27_PAIRWISE_SCORE_THRESHOLD = 0.6 as const;

export const R27_DEVELOPMENT_DATA_SOURCE = Object.freeze({
  status: "ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED",
  canonicalObservationPath: ".cache/tradepulse/round-014/observations.ndjson",
  manifestPath: "docs/research/round-014-observation-freeze.json",
  observationDataSha256: "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359",
  observationDataBytes: 1_893_811_055,
  observationCount: 244_810,
  developmentWindow: Object.freeze({ start: R27_DEVELOPMENT_DATA_START_ISO, end: R27_DEVELOPMENT_DATA_END_ISO }),
  classification: "DEVELOPMENT_ONLY / ALREADY_SEEN",
  freezeManifestSha256: "7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6",
  freezeCommit: "44d630dd387e75ed9a46713a94f38221fa48ab0f",
  networkAcquired: false,
  newHistoricalDevelopmentDataFetched: false,
  postBoundaryDataFetched: false,
  developmentOnly: true,
});

export type R27Direction = (typeof R27_DIRECTIONS)[number];
export type R27FoldId = (typeof R27_FOLD_IDS)[number];
export type R27Symbol = (typeof R27_SYMBOLS)[number];
export type R27FeatureName = string;
export type R27TargetType = "POSITIVE_NET_PROBABILITY" | "CROSS_SECTIONAL_PAIRWISE_RANKING_PLUS_POSITIVE_NET_PROBABILITY_GATE";
export type R27Family = "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY";

export type R27CandidateConfiguration = Readonly<{
  candidateConfigurationId: string;
  family: R27Family;
  direction: R27Direction;
  targetType: R27TargetType;
  featureSubsetId: string;
  featureNames: readonly R27FeatureName[];
  lambda: typeof R27_LOGISTIC_LAMBDA;
  positiveProbabilityThreshold: typeof R27_POSITIVE_PROBABILITY_THRESHOLD;
  pairwiseScoreThreshold: typeof R27_PAIRWISE_SCORE_THRESHOLD | null;
  horizonHours: 4;
  normalization: "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME";
  regimeGate: null;
  selectionPolicy: "TOP_ONE_PER_DECISION_TIME" | "TOP_ONE_PAIRWISE_SCORE_WITH_POSITIVE_PROBABILITY_GATE";
}>;

export const R27_LONG_FEATURE_NAMES = LONG_FEATURE_NAMES;
export const R27_LONG_NO_VOLUME_FEATURE_NAMES = Object.freeze([
  "F01_directionAdjustedClose4hMinusEma200Atr",
  "F05_directionAdjustedEma20MinusEma50Atr",
  "F09_directionAdjustedClose1hMinusEma20Atr",
  "F10_atr14OverClose1h",
  "F17_directionAdjustedEma50Breadth",
] as const);
export const R27_SHORT_FEATURE_NAMES = SHORT_FEATURE_NAMES;
export const R27_SHORT_ALTERNATE_FEATURE_NAMES = SHORT_ALTERNATE_FEATURE_NAMES;

const POSITIVE = {
  targetType: "POSITIVE_NET_PROBABILITY" as const,
  lambda: R27_LOGISTIC_LAMBDA,
  positiveProbabilityThreshold: R27_POSITIVE_PROBABILITY_THRESHOLD,
  pairwiseScoreThreshold: null,
  horizonHours: R27_HORIZON_HOURS,
  normalization: "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME" as const,
  regimeGate: null,
  selectionPolicy: "TOP_ONE_PER_DECISION_TIME" as const,
};

const PAIRWISE = {
  targetType: "CROSS_SECTIONAL_PAIRWISE_RANKING_PLUS_POSITIVE_NET_PROBABILITY_GATE" as const,
  lambda: R27_LOGISTIC_LAMBDA,
  positiveProbabilityThreshold: R27_POSITIVE_PROBABILITY_THRESHOLD,
  pairwiseScoreThreshold: R27_PAIRWISE_SCORE_THRESHOLD,
  horizonHours: R27_HORIZON_HOURS,
  normalization: "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME" as const,
  regimeGate: null,
  selectionPolicy: "TOP_ONE_PAIRWISE_SCORE_WITH_POSITIVE_PROBABILITY_GATE" as const,
};

export const R27_LONG_CANDIDATE_CONFIGURATIONS: readonly R27CandidateConfiguration[] = Object.freeze([
  { candidateConfigurationId: "R27_LONG_POSITIVE_LOGIT_TREND_PULLBACK_VOLUME", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_TREND_PULLBACK_VOLUME", featureNames: R27_LONG_FEATURE_NAMES, ...POSITIVE },
  { candidateConfigurationId: "R27_LONG_POSITIVE_LOGIT_TREND_PULLBACK_NO_VOLUME", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_TREND_PULLBACK_NO_VOLUME", featureNames: R27_LONG_NO_VOLUME_FEATURE_NAMES, ...POSITIVE },
  { candidateConfigurationId: "R27_LONG_PAIRWISE_RANK_POSITIVE_GATE_TREND_PULLBACK_VOLUME", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", featureSubsetId: "LONG_TREND_PULLBACK_VOLUME", featureNames: R27_LONG_FEATURE_NAMES, ...PAIRWISE },
]);

export const R27_SHORT_CANDIDATE_CONFIGURATIONS: readonly R27CandidateConfiguration[] = Object.freeze([
  { candidateConfigurationId: "R27_SHORT_POSITIVE_LOGIT_TREND_VOLATILITY_FUNDING", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_TREND_VOLATILITY_FUNDING", featureNames: R27_SHORT_FEATURE_NAMES, ...POSITIVE },
  { candidateConfigurationId: "R27_SHORT_POSITIVE_LOGIT_RELATIVE_FLOW_FUNDING", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_RELATIVE_FLOW_FUNDING", featureNames: R27_SHORT_ALTERNATE_FEATURE_NAMES, ...POSITIVE },
  { candidateConfigurationId: "R27_SHORT_PAIRWISE_RANK_POSITIVE_GATE_TREND_VOLATILITY_FUNDING", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", featureSubsetId: "SHORT_TREND_VOLATILITY_FUNDING", featureNames: R27_SHORT_FEATURE_NAMES, ...PAIRWISE },
]);

export const R27_CANDIDATE_CONFIGURATIONS: readonly R27CandidateConfiguration[] = Object.freeze([
  ...R27_LONG_CANDIDATE_CONFIGURATIONS,
  ...R27_SHORT_CANDIDATE_CONFIGURATIONS,
]);

export const R27_DEVELOPMENT_GATES = Object.freeze({
  minimumSelectedAlerts: 50,
  minimumSelectedAlertsPerFold: 10,
  minimumDistinctUtcDecisionDates: 10,
  minimumMeanNetExpectancy: 0,
  minimumNetProfitFactor: 1,
  minimumPositiveTemporalFolds: 4,
  maximumCatastrophicFolds: 0,
  catastrophicFoldThreshold: -0.1,
  minimumCostStressMeanNetExpectancy: 0,
  minimumLatencyMeanNetExpectancy: 0,
  maximumPositiveSymbolContributionShare: 0.5,
});

export const R27_COST_POLICY = R25_COST_POLICY;

export const R27_GOVERNANCE = Object.freeze({
  humanDecisionRequired: true,
  automaticTrading: false,
  productionUnchanged: true,
  mainUnchanged: true,
  emailRestorationAuthorized: false,
  baseline002Status: "NOT_FROZEN" as const,
  m3JStatus: "BLOCKED" as const,
  m4Status: "NOT_STARTED" as const,
  forwardEconomicValuesRead: false,
  forwardReturnRead: false,
  forwardValidationAuthorized: false,
  newPostFreezeForwardDataFetched: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
});

export const R27_PROTOCOL_OBJECT = Object.freeze({
  schemaVersion: "m3-r27-directional-target-model-redesign-protocol-001",
  researchRoundId: R27_RESEARCH_ROUND_ID,
  phase: R27_PHASE,
  base: Object.freeze({ branch: R27_BASE_BRANCH, sha: R27_BASE_SHA }),
  branch: R27_BRANCH,
  developmentWindow: Object.freeze({ start: R27_DEVELOPMENT_DATA_START_ISO, end: R27_DEVELOPMENT_DATA_END_ISO, classification: "DEVELOPMENT_ONLY / ALREADY_SEEN" }),
  source: R27_DEVELOPMENT_DATA_SOURCE,
  folds: R25_FOLDS_SOURCE,
  purgeEmbargoHours: R27_PURGE_EMBARGO_HOURS,
  horizonHours: R27_HORIZON_HOURS,
  symbols: R27_SYMBOLS,
  directions: R27_DIRECTIONS,
  normalization: "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME",
  peerRequirement: "EXACTLY_FIVE_SYMBOLS_PER_DIRECTION_AND_DECISION_TIME_OR_FAIL_CLOSED",
  modelTargets: Object.freeze({
    positive: Object.freeze({ target: "EXECUTED primary 4h netForwardAtr > 0 => 1; EXECUTED netForwardAtr <= 0 => 0; non-EXECUTED excluded", model: "BINARY_LOGISTIC_L2", lambda: R27_LOGISTIC_LAMBDA, intercept: "UNPENALIZED", maxIterations: R27_LOGISTIC_MAX_ITERATIONS, tolerance: R27_LOGISTIC_TOLERANCE, predictorClamp: R27_LOGISTIC_LINEAR_PREDICTOR_CLAMP }),
    pairwise: Object.freeze({ target: "same-direction same-time unordered pairs; ten pairs, two directed samples; equal netR skipped", model: "BINARY_LOGISTIC_L2", lambda: R27_LOGISTIC_LAMBDA, intercept: "FIXED_ZERO", maxIterations: R27_LOGISTIC_MAX_ITERATIONS, tolerance: R27_LOGISTIC_TOLERANCE, antiSymmetry: true }),
  }),
  configurations: R27_CANDIDATE_CONFIGURATIONS,
  selection: Object.freeze({ positiveThreshold: R27_POSITIVE_PROBABILITY_THRESHOLD, pairwiseThreshold: R27_PAIRWISE_SCORE_THRESHOLD, tieBreak: ["score DESC", "frozen symbol order", "observationId lexical ASC"], topOnePerDecisionTime: true }),
  costPolicy: R27_COST_POLICY,
  costPolicyHash: R25_COST_POLICY_HASH,
  settlementHash: R25_SETTLEMENT_HASH,
  searchSpace: Object.freeze({ maximumLongConfigurations: 3, maximumShortConfigurations: 3, maximumTotalConfigurations: 6, completeEvaluationExecutionCount: 1, noThresholdSweep: true, noLambdaSweep: true, noFeatureCombinatorialSearch: true, noHorizonExpansion: true }),
  validationOrder: ["FIT_RESEARCH_ONLY", "SCORE_VALIDATION_FEATURES", "SELECT_FROZEN_ALERTS", "READ_SELECTED_VALIDATION_ECONOMIC_LABELS", "COMPUTE_DEVELOPMENT_METRICS"],
  developmentGates: R27_DEVELOPMENT_GATES,
  championSelection: ["worst-fold mean net DESC", "cost-stress mean DESC", "absolute maximum drawdown ASC", "candidateConfigurationId lexical ASC"],
  noForwardReuse: true,
  governance: R27_GOVERNANCE,
});

export const R27_PROTOCOL_SHA256 = createHash("sha256").update(stableStringify(R27_PROTOCOL_OBJECT), "utf8").digest("hex");
export const R27_COST_POLICY_HASH = R25_COST_POLICY_HASH;
export const R27_SETTLEMENT_HASH = R25_SETTLEMENT_HASH;
export const R27_FOLDS_SOURCE = R25_FOLDS_SOURCE;

export const R27_RUNNER_BOUNDARY = Object.freeze({
  sourcePath: "src/lib/research/round-027-development-runner.ts",
  developmentCommand: "research:round027:development",
  noNetworkAcquisition: true,
  noForwardLoader: true,
  developmentOnly: true,
  economicRunnerFrozenBeforeOutcomeRead: true,
});
