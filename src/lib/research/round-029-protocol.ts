import { createHash } from "node:crypto";

import {
  R13_FEATURE_NAMES,
  R13_FOLDS,
  R13_SYMBOLS,
  type R13FeatureName,
} from "./m3-r13-round-013-protocol.ts";
import { R25_COST_POLICY, R25_COST_POLICY_HASH, R25_FOLDS_SOURCE, R25_SETTLEMENT_HASH } from "./round-025-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R29_RESEARCH_ROUND_ID = "baseline-002-research-round-029" as const;
export const R29_PHASE = "HYBRID_DIRECTIONAL_ARCHITECTURE_DEVELOPMENT_ONLY" as const;
export const R29_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R29_BASE_SHA = "39b0fbec69ba5fc59b5c57d028b654f361ea19ce" as const;
export const R29_BRANCH = "research/round-029-hybrid-directional-architecture-development" as const;

export const R29_SOURCE_PATH = ".cache/tradepulse/round-014/observations.ndjson" as const;
export const R29_SOURCE_MANIFEST_PATH = "docs/research/round-014-observation-freeze.json" as const;
export const R29_SOURCE_SHA256 = "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359" as const;
export const R29_SOURCE_MANIFEST_SHA256 = "7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6" as const;
export const R29_SOURCE_BYTES = 1_893_811_055 as const;
export const R29_SOURCE_OBSERVATION_COUNT = 244_810 as const;
export const R29_SOURCE_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R29_SOURCE_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const R29_SOURCE_FREEZE_COMMIT = "44d630dd387e75ed9a46713a94f38221fa48ab0f" as const;

export const R29_HORIZON_HOURS = 4 as const;
export const R29_PURGE_EMBARGO_HOURS = 24 as const;
export const R29_MANUAL_LATENCY_MINUTES = 7 as const;
export const R29_CALIBRATION_QUANTILE = 0.90 as const;
export const R29_LOGISTIC_LAMBDA = 10 as const;
export const R29_LOGISTIC_MAX_ITERATIONS = 100 as const;
export const R29_LOGISTIC_TOLERANCE = 1e-10 as const;
export const R29_LOGISTIC_LINEAR_PREDICTOR_CLAMP = Object.freeze({ min: -30, max: 30 } as const);

export const R29_SYMBOLS = Object.freeze([...R13_SYMBOLS] as const);
export const R29_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export const R29_FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);
export const R29_FEATURE_NAMES = Object.freeze([...R13_FEATURE_NAMES] as const);

export type R29Direction = (typeof R29_DIRECTIONS)[number];
export type R29Symbol = (typeof R29_SYMBOLS)[number];
export type R29FoldId = (typeof R29_FOLD_IDS)[number];
export type R29FeatureName = (typeof R29_FEATURE_NAMES)[number] | R13FeatureName;
export type R29Family = "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY";
export type R29ArchitectureType =
  | "RAW_LINEAR_ALL18"
  | "XS_LINEAR_ALL18"
  | "RAW_QUADRATIC_TOP4";
export type R29CandidateId =
  | "R29_LONG_RAW_LINEAR_GATE_XS_RANK"
  | "R29_LONG_RAW_QUADRATIC_GATE_XS_RANK"
  | "R29_LONG_RAW_GATE_BLENDED_RANK"
  | "R29_SHORT_XS_TOP_SCORE_Q90"
  | "R29_SHORT_XS_MARGIN_Q90"
  | "R29_SHORT_XS_RANK_RAW_QUADRATIC_GATE";

export type R29CandidateConfiguration = Readonly<{
  candidateConfigurationId: R29CandidateId;
  family: R29Family;
  direction: R29Direction;
  architectureType: R29ArchitectureType;
  rankArchitecture: R29ArchitectureType | "BLENDED_RAW_XS";
  absoluteArchitecture: R29ArchitectureType | null;
  calibrationStatistic: "RAW_PROBABILITY" | "RAW_QUADRATIC_PROBABILITY" | "XS_PROBABILITY" | "XS_MARGIN";
  calibrationSource: "RESEARCH_SELECTED_ONLY";
  rankWeights: Readonly<{ raw: number; xs: number }>;
  probabilityGate: "Q90";
  horizonHours: typeof R29_HORIZON_HOURS;
  selectionPolicy: "TOP_ONE_PER_COMPLETE_DECISION_TIME";
}>;

export const R29_MODEL_PRIMITIVES = Object.freeze({
  RAW_LINEAR_ALL18: Object.freeze({
    architectureType: "RAW_LINEAR_ALL18" as const,
    representation: "RAW_PIT" as const,
    featureCount: 18,
    featureNames: R29_FEATURE_NAMES,
    model: "BINARY_LOGISTIC_L2" as const,
    lambda: R29_LOGISTIC_LAMBDA,
    intercept: "UNPENALIZED" as const,
  }),
  XS_LINEAR_ALL18: Object.freeze({
    architectureType: "XS_LINEAR_ALL18" as const,
    representation: "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME" as const,
    featureCount: 18,
    featureNames: R29_FEATURE_NAMES,
    model: "BINARY_LOGISTIC_L2" as const,
    lambda: R29_LOGISTIC_LAMBDA,
    intercept: "UNPENALIZED" as const,
  }),
  RAW_QUADRATIC_TOP4: Object.freeze({
    architectureType: "RAW_QUADRATIC_TOP4" as const,
    representation: "RAW_PIT" as const,
    top4Selection: "RESEARCH_ONLY_PRIMARY_POSITIVE_AUC" as const,
    originalFeatureCount: 4,
    squareTermCount: 4,
    interactionTermCount: 6,
    expandedTermCount: 14,
    model: "BINARY_LOGISTIC_L2" as const,
    lambda: R29_LOGISTIC_LAMBDA,
    intercept: "UNPENALIZED" as const,
  }),
});

export const R29_SOURCE = Object.freeze({
  status: "ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED" as const,
  canonicalPath: R29_SOURCE_PATH,
  manifestPath: R29_SOURCE_MANIFEST_PATH,
  sha256: R29_SOURCE_SHA256,
  manifestSha256: R29_SOURCE_MANIFEST_SHA256,
  bytes: R29_SOURCE_BYTES,
  observationCount: R29_SOURCE_OBSERVATION_COUNT,
  symbols: R29_SYMBOLS,
  directions: R29_DIRECTIONS,
  window: Object.freeze({ start: R29_SOURCE_START_ISO, end: R29_SOURCE_END_ISO }),
  classification: "DEVELOPMENT_ONLY / ALREADY_SEEN" as const,
  freezeCommit: R29_SOURCE_FREEZE_COMMIT,
  networkAcquired: false,
  newHistoricalDevelopmentDataFetched: false,
  postBoundaryDataFetched: false,
});

const rawLinear = {
  architectureType: "RAW_LINEAR_ALL18" as const,
  rankArchitecture: "XS_LINEAR_ALL18" as const,
  absoluteArchitecture: "RAW_LINEAR_ALL18" as const,
  calibrationSource: "RESEARCH_SELECTED_ONLY" as const,
  probabilityGate: "Q90" as const,
  horizonHours: R29_HORIZON_HOURS,
  selectionPolicy: "TOP_ONE_PER_COMPLETE_DECISION_TIME" as const,
};
const rawQuadratic = {
  architectureType: "RAW_QUADRATIC_TOP4" as const,
  rankArchitecture: "XS_LINEAR_ALL18" as const,
  absoluteArchitecture: "RAW_QUADRATIC_TOP4" as const,
  calibrationSource: "RESEARCH_SELECTED_ONLY" as const,
  probabilityGate: "Q90" as const,
  horizonHours: R29_HORIZON_HOURS,
  selectionPolicy: "TOP_ONE_PER_COMPLETE_DECISION_TIME" as const,
};
const blended = {
  architectureType: "RAW_LINEAR_ALL18" as const,
  rankArchitecture: "BLENDED_RAW_XS" as const,
  absoluteArchitecture: "RAW_LINEAR_ALL18" as const,
  calibrationSource: "RESEARCH_SELECTED_ONLY" as const,
  probabilityGate: "Q90" as const,
  horizonHours: R29_HORIZON_HOURS,
  selectionPolicy: "TOP_ONE_PER_COMPLETE_DECISION_TIME" as const,
};

export const R29_CANDIDATE_CONFIGURATIONS: readonly R29CandidateConfiguration[] = Object.freeze([
  { candidateConfigurationId: "R29_LONG_RAW_LINEAR_GATE_XS_RANK", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", ...rawLinear, calibrationStatistic: "RAW_PROBABILITY", rankWeights: Object.freeze({ raw: 0, xs: 1 }) },
  { candidateConfigurationId: "R29_LONG_RAW_QUADRATIC_GATE_XS_RANK", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", ...rawQuadratic, calibrationStatistic: "RAW_QUADRATIC_PROBABILITY", rankWeights: Object.freeze({ raw: 0, xs: 1 }) },
  { candidateConfigurationId: "R29_LONG_RAW_GATE_BLENDED_RANK", family: "LONG-CANDIDATE-FAMILY", direction: "LONG", ...blended, calibrationStatistic: "RAW_PROBABILITY", rankWeights: Object.freeze({ raw: 0.5, xs: 0.5 }) },
  { candidateConfigurationId: "R29_SHORT_XS_TOP_SCORE_Q90", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", architectureType: "XS_LINEAR_ALL18", rankArchitecture: "XS_LINEAR_ALL18", absoluteArchitecture: null, calibrationStatistic: "XS_PROBABILITY", calibrationSource: "RESEARCH_SELECTED_ONLY", probabilityGate: "Q90", horizonHours: R29_HORIZON_HOURS, selectionPolicy: "TOP_ONE_PER_COMPLETE_DECISION_TIME", rankWeights: Object.freeze({ raw: 0, xs: 1 }) },
  { candidateConfigurationId: "R29_SHORT_XS_MARGIN_Q90", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", architectureType: "XS_LINEAR_ALL18", rankArchitecture: "XS_LINEAR_ALL18", absoluteArchitecture: null, calibrationStatistic: "XS_MARGIN", calibrationSource: "RESEARCH_SELECTED_ONLY", probabilityGate: "Q90", horizonHours: R29_HORIZON_HOURS, selectionPolicy: "TOP_ONE_PER_COMPLETE_DECISION_TIME", rankWeights: Object.freeze({ raw: 0, xs: 1 }) },
  { candidateConfigurationId: "R29_SHORT_XS_RANK_RAW_QUADRATIC_GATE", family: "SHORT-CANDIDATE-FAMILY", direction: "SHORT", architectureType: "RAW_QUADRATIC_TOP4", rankArchitecture: "XS_LINEAR_ALL18", absoluteArchitecture: "RAW_QUADRATIC_TOP4", calibrationStatistic: "RAW_QUADRATIC_PROBABILITY", calibrationSource: "RESEARCH_SELECTED_ONLY", probabilityGate: "Q90", horizonHours: R29_HORIZON_HOURS, selectionPolicy: "TOP_ONE_PER_COMPLETE_DECISION_TIME", rankWeights: Object.freeze({ raw: 0, xs: 1 }) },
]);

export const R29_DEVELOPMENT_GATES = Object.freeze({
  minimumSelectedAlerts: 50,
  minimumSelectedAlertsPerFold: 10,
  minimumDistinctUtcDecisionDates: 10,
  minimumMeanNetExpectancy: 0,
  minimumNetProfitFactor: 1,
  minimumPositiveTemporalFolds: 4,
  maximumCatastrophicFolds: 0,
  catastrophicFoldThreshold: -0.10,
  minimumCostStressMeanNetExpectancy: 0,
  minimumLatencyMeanNetExpectancy: 0,
  maximumPositiveSymbolContributionShare: 0.50,
  maximumSelectedDecisionTimeRatePerFold: 0.25,
});

export const R29_GOVERNANCE = Object.freeze({
  developmentOnly: true,
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

export const R29_PROTOCOL_OBJECT = Object.freeze({
  schemaVersion: "m3-r29-hybrid-directional-architecture-development-protocol-001",
  researchRoundId: R29_RESEARCH_ROUND_ID,
  phase: R29_PHASE,
  base: Object.freeze({ branch: R29_BASE_BRANCH, sha: R29_BASE_SHA }),
  branch: R29_BRANCH,
  source: R29_SOURCE,
  folds: R13_FOLDS,
  purgeEmbargoHours: R29_PURGE_EMBARGO_HOURS,
  horizonHours: R29_HORIZON_HOURS,
  manualLatencyMinutes: R29_MANUAL_LATENCY_MINUTES,
  symbols: R29_SYMBOLS,
  directions: R29_DIRECTIONS,
  modelPrimitives: R29_MODEL_PRIMITIVES,
  candidates: R29_CANDIDATE_CONFIGURATIONS,
  calibration: Object.freeze({ statistic: "candidate-specific research-selected statistic", quantile: R29_CALIBRATION_QUANTILE, interpolation: "sorted ascending; position=(n-1)*0.90; linear interpolation" }),
  tieBreak: Object.freeze(["score DESC", "R29_SYMBOLS frozen order", "observationId lexical ASC"]),
  validationOrder: Object.freeze(["FIT_RESEARCH_ONLY", "CALIBRATE_SELECTION_FROM_RESEARCH_SCORES_ONLY", "SCORE_VALIDATION_FEATURES_ONLY", "SELECT_FROZEN_ALERT_IDS", "READ_ECONOMIC_LABELS_FOR_SELECTED_IDS_ONLY", "COMPUTE_DEVELOPMENT_ECONOMICS"]),
  validationFeatureOnlyKeys: Object.freeze(["observationId", "decisionTime", "symbol", "direction", "features"]),
  forbiddenValidationKeys: Object.freeze(["primaryStatus", "latencyStatus", "netR", "costStressNetR", "latencyNetR", "labels", "sourceObservation"]),
  costs: R25_COST_POLICY,
  costPolicyHash: R25_COST_POLICY_HASH,
  settlementHash: R25_SETTLEMENT_HASH,
  foldsSource: R25_FOLDS_SOURCE,
  searchSpace: Object.freeze({ longConfigurations: 3, shortConfigurations: 3, totalConfigurations: 6, exactlyOneEconomicEvaluation: true, noThresholdSweep: true, noQuantileSweep: true, noLambdaSweep: true, noFeatureSubsetGrid: true, noHorizonSweep: true, noPostResultCandidateAddition: true }),
  developmentGates: R29_DEVELOPMENT_GATES,
  championSelection: Object.freeze(["worst-fold mean net expectancy DESC", "latencyStressMeanNetExpectancy DESC", "costStressMeanNetExpectancy DESC", "absolute maximum drawdown ASC", "candidateConfigurationId lexical ASC"]),
  noForwardReuse: true,
  governance: R29_GOVERNANCE,
});

export const R29_PROTOCOL_SHA256 = createHash("sha256").update(stableStringify(R29_PROTOCOL_OBJECT), "utf8").digest("hex");
export const R29_COST_POLICY_HASH = R25_COST_POLICY_HASH;
export const R29_SETTLEMENT_HASH = R25_SETTLEMENT_HASH;
export const R29_FOLDS_SOURCE = R25_FOLDS_SOURCE;
