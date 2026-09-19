import { createHash } from "node:crypto";

import { R13_FEATURE_NAMES, R13_FOLD_IDS, R13_FOLDS, R13_DIRECTIONS, R13_SYMBOLS, type R13Direction, type R13FeatureName } from "./m3-r13-round-013-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R28_RESEARCH_ROUND_ID = "baseline-002-research-round-028" as const;
export const R28_PHASE = "FEATURE_INFORMATION_DIAGNOSTIC_ONLY" as const;
export const R28_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R28_BASE_SHA = "aef30226d4caa9cc3a579621579170ea8d8f872e" as const;
export const R28_BRANCH = "research/round-028-feature-information-capacity-reassessment" as const;
export const R28_SOURCE_PATH = ".cache/tradepulse/round-014/observations.ndjson" as const;
export const R28_SOURCE_MANIFEST_PATH = "docs/research/round-014-observation-freeze.json" as const;
export const R28_SOURCE_SHA256 = "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359" as const;
export const R28_SOURCE_MANIFEST_SHA256 = "7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6" as const;
export const R28_SOURCE_BYTES = 1_893_811_055 as const;
export const R28_SOURCE_OBSERVATION_COUNT = 244_810 as const;
export const R28_SOURCE_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R28_SOURCE_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const R28_PURGE_EMBARGO_HOURS = 24 as const;
export const R28_HORIZON_HOURS = 4 as const;
export const R28_LOGISTIC_LAMBDA = 10 as const;
export const R28_LOGISTIC_MAX_ITERATIONS = 100 as const;
export const R28_LOGISTIC_TOLERANCE = 1e-10 as const;
export const R28_CROSS_SECTIONAL_COLLAPSE_RATE = 0.05 as const;

export const R28_DIRECTIONS = R13_DIRECTIONS;
export type R28Direction = R13Direction;
export const R28_FOLD_IDS = R13_FOLD_IDS;
export const R28_FOLDS = R13_FOLDS;
export const R28_FEATURE_NAMES = R13_FEATURE_NAMES;
export type R28FeatureName = R13FeatureName;
export const R28_SYMBOLS = R13_SYMBOLS;

export const R28_REPRESENTATIONS = Object.freeze(["RAW_PIT", "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME"] as const);
export type R28Representation = (typeof R28_REPRESENTATIONS)[number];
export const R28_PROBE_IDS = Object.freeze(["XS_LINEAR_ALL18", "RAW_LINEAR_ALL18", "RAW_QUADRATIC_TOP4"] as const);
export type R28ProbeId = (typeof R28_PROBE_IDS)[number];
export const R28_TARGET_IDS = Object.freeze(["PRIMARY_POSITIVE", "COST_STRESS_POSITIVE", "LATENCY_POSITIVE"] as const);
export type R28TargetId = (typeof R28_TARGET_IDS)[number];

export const R28_THRESHOLDS = Object.freeze({
  stableOrientationMinimumFolds: 5,
  stablePrimaryMedianAuc: 0.52,
  stablePrimaryPositiveFolds: 4,
  stableCostMedianAuc: 0.51,
  stableCostPositiveFolds: 4,
  stableLatencyMedianAuc: 0.51,
  stableLatencyPositiveFolds: 4,
  absolutePrimaryMedianAuc: 0.53,
  absolutePrimaryPositiveFolds: 4,
  absoluteCostMedianAuc: 0.52,
  absoluteCostPositiveFolds: 4,
  absoluteLatencyMedianAuc: 0.52,
  absoluteLatencyPositiveFolds: 4,
  rankingPrimaryMedianSpearman: 0.05,
  rankingPrimaryPositiveFolds: 4,
  rankingCostMedianSpearman: 0.03,
  rankingLatencyMedianSpearman: 0.03,
  rankingLatencyPositiveFolds: 4,
  crossSectionalCollapseRate: R28_CROSS_SECTIONAL_COLLAPSE_RATE,
  informationLossDelta: 0.02,
} as const);

export const R28_GOVERNANCE = Object.freeze({
  economicEvaluationPerformed: false,
  tradingEconomicMetricsCalculated: false,
  validationOutcomeValuesReadForDiagnostic: true,
  globalHistoricalEconomicLabelsRead: true,
  sameFoldValidationOutcomeUsedForFit: false,
  sameFoldValidationOutcomeUsedForScoring: false,
  crossFoldExpandingWindowResearchReuse: true,
  newMarketDataFetched: false,
  forwardEconomicValuesRead: false,
  forwardReturnRead: false,
  performanceExecutionCount: 0,
  candidateExecutableFrozen: false,
  forwardCandidateExists: false,
  forwardValidationAuthorized: false,
  emailRestorationAuthorized: false,
  humanDecisionRequired: true,
  automaticTrading: false,
  productionUnchanged: true,
  mainUnchanged: true,
  baseline002Status: "NOT_FROZEN" as const,
  m3JStatus: "BLOCKED" as const,
  m4Status: "NOT_STARTED" as const,
});

export const R28_CLASSIFICATION_RULES = Object.freeze({
  A: Object.freeze({ classification: "CROSS_SECTIONAL_NORMALIZATION_INFORMATION_LOSS", next: "HYBRID_RAW_PLUS_CROSS_SECTIONAL_ARCHITECTURE_REQUIRED" }),
  B: Object.freeze({ classification: "NONLINEAR_CAPACITY_LIMITATION", next: "BOUNDED_NONLINEAR_MODEL_DEVELOPMENT_REQUIRED" }),
  C: Object.freeze({ classification: "INFORMATION_PRESENT_BUT_R27_ARCHITECTURE_MISMATCH", next: "SELECTION_AND_MODEL_ARCHITECTURE_REDESIGN_REQUIRED" }),
  D: Object.freeze({ classification: "WEAK_OR_UNSTABLE_INFORMATION_ONLY", next: "FEATURE_ENGINEERING_AND_REGIME_DECOMPOSITION_REQUIRED" }),
  E: Object.freeze({ classification: "EXISTING_FEATURE_INFORMATION_INSUFFICIENT", next: "NEW_INFORMATION_SOURCE_REQUIRED" }),
} as const);

export const R28_PROTOCOL_OBJECT = Object.freeze({
  schemaVersion: "m3-r28-feature-information-capacity-reassessment-protocol-001",
  researchRoundId: R28_RESEARCH_ROUND_ID,
  phase: R28_PHASE,
  base: Object.freeze({ branch: R28_BASE_BRANCH, sha: R28_BASE_SHA }),
  branch: R28_BRANCH,
  source: Object.freeze({
    status: "ACCEPTED_R14_OBSERVATION_FREEZE_REUSED",
    canonicalPath: R28_SOURCE_PATH,
    manifestPath: R28_SOURCE_MANIFEST_PATH,
    sha256: R28_SOURCE_SHA256,
    manifestSha256: R28_SOURCE_MANIFEST_SHA256,
    bytes: R28_SOURCE_BYTES,
    observationCount: R28_SOURCE_OBSERVATION_COUNT,
    window: Object.freeze({ start: R28_SOURCE_START_ISO, end: R28_SOURCE_END_ISO }),
    classification: "DEVELOPMENT_ONLY / ALREADY_SEEN",
    networkAcquired: false,
    postBoundaryDataFetched: false,
  }),
  features: R28_FEATURE_NAMES,
  symbols: R28_SYMBOLS,
  directions: R28_DIRECTIONS,
  folds: R28_FOLDS,
  purgeEmbargoHours: R28_PURGE_EMBARGO_HOURS,
  representations: R28_REPRESENTATIONS,
  targets: Object.freeze({
    training: "labels[4].status === EXECUTED && netForwardAtr > 0 => 1; netForwardAtr <= 0 => 0",
    validation: Object.freeze({ primary: "labels[4].netForwardAtr > 0", costStress: "labels[4].netForwardAtrCostStress > 0", latency: "latencyStressLabels[4].netForwardAtr > 0" }),
  }),
  validationBoundary: Object.freeze({
    featureOnlyKeys: Object.freeze(["observationId", "decisionTime", "symbol", "direction", "features"]),
    forbiddenKeys: Object.freeze(["primaryStatus", "latencyStatus", "netR", "costStressNetR", "latencyNetR", "labels", "sourceObservation"]),
    scoreBeforeOutcomeJoin: true,
    outcomeJoinKey: "observationId",
  }),
  probes: Object.freeze({
    ids: R28_PROBE_IDS,
    exactlyThreePerDirection: true,
    xsLinear: Object.freeze({ representation: "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME", terms: 18 }),
    rawLinear: Object.freeze({ representation: "RAW_PIT", terms: 18 }),
    rawQuadraticTop4: Object.freeze({ representation: "RAW_PIT", topFeatures: 4, originalTerms: 4, squareTerms: 4, interactionTerms: 6, totalTerms: 14 }),
    target: "PRIMARY_POSITIVE",
    model: Object.freeze({ type: "DETERMINISTIC_L2_LOGISTIC", lambda: R28_LOGISTIC_LAMBDA, intercept: "UNPENALIZED", maxIterations: R28_LOGISTIC_MAX_ITERATIONS, tolerance: R28_LOGISTIC_TOLERANCE }),
  }),
  thresholds: R28_THRESHOLDS,
  classificationRules: R28_CLASSIFICATION_RULES,
  governance: R28_GOVERNANCE,
  diagnosticExecutionCount: 1,
  noEconomicEvaluation: true,
} as const);

export const R28_PROTOCOL_SHA256 = createHash("sha256").update(stableStringify(R28_PROTOCOL_OBJECT), "utf8").digest("hex");
