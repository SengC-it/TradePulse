import { createHash } from "node:crypto";

import { BACKTEST_POLICY, type BacktestPolicyVersion } from "../backtest/constants.ts";
import { R13_FEATURE_NAMES, R13_FOLDS, type R13FeatureName } from "./m3-r13-round-013-protocol.ts";
import { R15_ALPHA_FEATURE_NAMES, R15_BETA_FEATURE_NAMES } from "./m3-r15-round-015-protocol.ts";
import { RESEARCH_FOLD_IDS, type ResearchFoldId } from "./constants.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const R23_RESEARCH_ROUND_ID = "baseline-002-research-round-023" as const;
export const R23_BRANCH = "research/round-023-forward-net-expectancy-validation" as const;
export const R23_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R23_BASE_SHA = "6924783d26e377a543bfc0d438a2bf6e6c40ba8a" as const;
export const R23_PROTOCOL_SCHEMA_VERSION = "m3-r23-forward-net-expectancy-development-protocol-001" as const;

export const R23_R15_FIRST_SPEC_COMMIT = "f46e06083894f99eaf84bec818bf19b564c8603a" as const;
export const R23_R15_RESULT_PUBLICATION_COMMIT = "c3986653f8b7ef26bb0e58b545fa3426386605e4" as const;
export const R23_R15_REJECTION_REASON =
  "R15 is not a forward candidate: its final decision was ineligible, its selectedCandidateId was null, no immutable final model artifact was committed, and reproducing it requires fit/refit." as const;

export const R23_DEVELOPMENT_DATA_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R23_DEVELOPMENT_DATA_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const R23_EXISTING_DATA_MANIFEST_PATH = "docs/research/round-015-observation-freeze.json" as const;
export const R23_EXISTING_DATA_PATH = ".cache/tradepulse/round-015/observations.ndjson" as const;
export const R23_EXISTING_DATA_MANIFEST_SHA256 = "214b263282be58908b631f4c4f63c85daab0a1ffee5b6ef24cb4a3c79af7d1bc" as const;
export const R23_EXISTING_DATA_SHA256 = "6f16065a7c1a763a2da35f2f60afc5c2b2a95cf44da5586abcfa760fdc7a1574" as const;
export const R23_EXISTING_DATA_SOURCE_STATUS = "REQUIRED_EXISTING_CACHE_NOT_MATERIALIZED" as const;

export const R23_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const);
export const R23_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export type R23Direction = (typeof R23_DIRECTIONS)[number];
export const R23_HORIZON_HOURS = 4 as const;
export const R23_PRIMARY_LATENCY_MINUTES = 7 as const;
export const R23_COST_STRESS_MULTIPLIER = 1.5 as const;
export const R23_PURGE_EMBARGO_HOURS = 24 as const;
export const R23_BT_POLICY_VERSION: BacktestPolicyVersion = "bt-policy-003";

export const R23_R15_BETA_FEATURES = Object.freeze([...R15_BETA_FEATURE_NAMES] as readonly string[]);
export const R23_R15_ALPHA_FEATURES = Object.freeze([...R15_ALPHA_FEATURE_NAMES] as readonly string[]);

const R23_TREND_CONTEXT_FEATURES = Object.freeze([
  "F01_directionAdjustedClose4hMinusEma200Atr",
  "F02_directionAdjustedEma50MinusEma200Atr",
  "F03_directionAdjustedEma200FiveBarSlopeAtr",
  "F05_directionAdjustedEma20MinusEma50Atr",
  "F06_directionAdjustedEma20ThreeBarSlopeAtr",
  "F09_directionAdjustedClose1hMinusEma20Atr",
  "F10_atr14OverClose1h",
  "F11_rollingAtrPricePercentile30d",
] as const satisfies readonly R13FeatureName[]);

export const R23_MODEL_FAMILIES = deepFreeze([
  {
    modelFamilyId: "R23_RIDGE_R13_ALL_EXISTING_FEATURES",
    model: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION",
    lambda: 10,
    featureSubsetId: "R13_ALL_EXISTING_FEATURES",
    featureNames: R13_FEATURE_NAMES,
  },
  {
    modelFamilyId: "R23_RIDGE_R13_TREND_CONTEXT_SUBSET",
    model: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION",
    lambda: 10,
    featureSubsetId: "R13_TREND_CONTEXT_EXISTING_FEATURES",
    featureNames: R23_TREND_CONTEXT_FEATURES,
  },
] as const);

export const R23_THRESHOLD_VALUES = Object.freeze([0.05, 0.1] as const);

export type R23CandidateConfiguration = Readonly<{
  candidateConfigurationId: string;
  modelFamilyId: string;
  model: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION";
  lambda: 10;
  featureSubsetId: string;
  featureNames: readonly R13FeatureName[];
  threshold: number;
}>;

export const R23_CANDIDATE_CONFIGURATIONS = deepFreeze(
  R23_MODEL_FAMILIES.flatMap((family) =>
    R23_THRESHOLD_VALUES.map((threshold) => ({
      candidateConfigurationId: `${family.modelFamilyId}_THRESHOLD_${threshold.toFixed(2)}`,
      modelFamilyId: family.modelFamilyId,
      model: family.model,
      lambda: family.lambda,
      featureSubsetId: family.featureSubsetId,
      featureNames: family.featureNames,
      threshold,
    })),
  ),
) as readonly R23CandidateConfiguration[];

export const R23_FOLD_IDS = Object.freeze([...RESEARCH_FOLD_IDS] as readonly ResearchFoldId[]);
export const R23_FOLDS = deepFreeze(
  Object.fromEntries(R23_FOLD_IDS.map((foldId) => [foldId, RESEARCH_FOLDS[foldId]])),
) as Readonly<Record<ResearchFoldId, (typeof RESEARCH_FOLDS)[ResearchFoldId]>>;

export const R23_FROZEN_COST_MODEL = deepFreeze({
  policyVersion: R23_BT_POLICY_VERSION,
  implementation: [
    {
      path: "src/lib/backtest/constants.ts",
      gitBlobSha: "41d4d2b5d20c3013c631851217dff1ce6182caf6",
      sha256: "d00794b9bda54321c848efedfac0d8891fcb6d1aec04b2ebab2265bfdf9f1014",
      bytes: 2423,
    },
    {
      path: "src/lib/backtest/settlement.ts",
      gitBlobSha: "826caace4c99359c5a2551ec8a046b218954fc1f",
      sha256: "22da94ff239f3e1d424218242d4ceca25803b32b71b80bf42d247b323cd53180",
      bytes: 14073,
    },
    {
      path: "src/lib/backtest/funding.ts",
      gitBlobSha: "4a7cd0cac0a02465f382ecf70a8859e69ecdf076",
      sha256: "448ccd029451b67ebda2122d50f35d4e997b41f209ec33f5180c3bd59654a9ae",
      bytes: 7478,
    },
  ],
  feeRule: {
    ratePerSide: BACKTEST_POLICY.feeRate,
    formula: "entryFill * feeRate + exitFill * feeRate",
  },
  slippageRule: {
    ratePerSide: BACKTEST_POLICY.slippageRate,
    formula: "direction-adjusted adverse fill on entry and exit",
  },
  fundingRule: {
    source: "actual funding timestamp/rate events during the held interval",
    longSign: "-fundingRate * markPrice",
    shortSign: "+fundingRate * markPrice",
    noCrossedEvent: "zero only when no funding event is strictly inside the held interval",
    missingMarkPrice: "FAIL_CLOSED",
  },
  settlementRule: {
    entry: "first complete 1m open at or after signalTime + 7 minutes",
    exit: "first causally resolved TP/SL event, otherwise 4h time exit",
    sameCandle: "bt-policy-003 1m resolution when required; unresolved ambiguity is NOT_EVALUABLE",
    optimisticTpSelection: false,
  },
  netFormula: "netReturn = grossReturn - feeCost - slippageCost - fundingCost",
  stress: "1.5x total fee + slippage + funding cost",
} as const);

export const R23_FROZEN_IMPLEMENTATIONS = deepFreeze([
  {
    path: "src/lib/research/m3-r13-round-013-protocol.ts",
    role: "existing feature, label, PIT and fold contract",
    gitBlobSha: "fd149404f47410fb9f8d40e5b14c6f78af503c57",
    sha256: "ba3731752914357578d03835e35a23e42c94b864e96cc8a05ee1aed72477d510",
    bytes: 9387,
  },
  {
    path: "src/lib/research/m3-r13-round-013-features.ts",
    role: "existing closed-candle feature generation",
    gitBlobSha: "0006678ef47a2c6adf1f6f91cb976dbcbee9caac",
    sha256: "e8009ed42a11b7a79db3b474382223061be8d4c3fb20c54aecddccbc03b554b2",
    bytes: 14077,
  },
  {
    path: "src/lib/research/m3-r15-round-015-model.ts",
    role: "existing ridge implementation identity only; no R15 coefficients are reused",
    gitBlobSha: "8af9207c567d6f94d19f9852516433b36a4eb98b",
    sha256: "c1e0a60f379270eb2b47667bac43f1d3ff0147a99c1574b8f9d543d51fc406c6",
    bytes: 6914,
  },
] as const);

export const R23_DEVELOPMENT_GATES = deepFreeze({
  minimumSettledAlerts: 50,
  minimumDistinctUtcDecisionDates: 10,
  minimumAggregateMeanNetExpectancy: 0,
  minimumAggregateNetProfitFactor: 1.1,
  minimumPositiveTemporalFolds: 4,
  maximumCatastrophicFolds: 0,
  costStress: { multiplier: R23_COST_STRESS_MULTIPLIER, minimumMeanNetExpectancy: 0, minimumProfitFactor: 1.05 },
  manualLatencyPrimary: { minutes: R23_PRIMARY_LATENCY_MINUTES, minimumMeanNetExpectancy: 0, minimumProfitFactor: 1.05 },
  maximumPositiveSymbolContributionShare: 0.5,
  maximumSinglePositiveObservationContribution: 0.05,
  unresolvedDataOrAmbiguity: "NO_FORWARD_CANDIDATE_OR_INVALID_DATA",
} as const);

export const R23_SELECTION_ALGORITHM = Object.freeze([
  "PASS_ALL_HARD_GATES",
  "HIGHEST_WORST_FOLD_NET_EXPECTANCY",
  "HIGHEST_COST_STRESS_EXPECTANCY",
  "LOWEST_MAXIMUM_DRAWDOWN_R",
  "SIMPLER_MODEL_FEWER_PARAMETERS",
  "CANDIDATE_CONFIGURATION_ID_LEXICAL_ASCENDING",
] as const);

export const R23_STATISTICAL_CONTRACT = deepFreeze({
  validation: "blocked temporal walk-forward; train only on earlier observations; validation predict-only",
  split: "RESEARCH_FOLD_ROLE_THEN_VALIDATION_ROLE",
  randomShuffle: false,
  purgeEmbargoHours: R23_PURGE_EMBARGO_HOURS,
  bootstrap: "temporal decision-time block bootstrap for the later forward result only",
  bootstrapSeed: 230023,
  bootstrapResamples: 10000,
  confidenceInterval: "one-sided 95 percent lower confidence bound",
  iidAssumption: false,
} as const);

export const R23_GOVERNANCE = deepFreeze({
  phase: "A0_DEVELOPMENT_PROTOCOL_FREEZE",
  r15ForwardCandidateRejected: true,
  candidateProtocolFrozenForValidation: true,
  historicalDevelopmentAllowedAfterA0RemoteFreeze: true,
  forwardEconomicValuesRead: false,
  forwardReturnRead: false,
  newMarketDataFetched: false,
  newPostFreezeMarketDataFetched: false,
  forwardPerformanceExecutionCount: 0,
  performanceAuthorized: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  observationExecuted: false,
  historicalBackfillExecuted: false,
  economicValuesRead: false,
  automaticTrading: false,
  humanDecisionRequired: true,
  productionUnchanged: true,
  mainUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  emailRestorationAuthorized: false,
} as const);

export const R23_PROTOCOL_OBJECT = deepFreeze({
  schemaVersion: R23_PROTOCOL_SCHEMA_VERSION,
  researchRoundId: R23_RESEARCH_ROUND_ID,
  branch: R23_BRANCH,
  base: { branch: R23_BASE_BRANCH, sha: R23_BASE_SHA },
  phase: "A0_DEVELOPMENT_PROTOCOL_FREEZE",
  r15ForwardCandidate: {
    rejected: true,
    rejectionReasons: [R23_R15_REJECTION_REASON, "Do not refit, recover approximate coefficients, average folds, choose the best fold, or synthesize a final R15 model."],
    provenanceOnly: {
      firstSpecCommit: R23_R15_FIRST_SPEC_COMMIT,
      resultPublicationCommit: R23_R15_RESULT_PUBLICATION_COMMIT,
      finalDecision: "NO BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015",
      forwardShadowEligible: false,
      selectedCandidateId: null,
    },
  },
  developmentData: {
    start: R23_DEVELOPMENT_DATA_START_ISO,
    end: R23_DEVELOPMENT_DATA_END_ISO,
    manifestPath: R23_EXISTING_DATA_MANIFEST_PATH,
    manifestSha256: R23_EXISTING_DATA_MANIFEST_SHA256,
    observationDataPath: R23_EXISTING_DATA_PATH,
    observationDataSha256: R23_EXISTING_DATA_SHA256,
    sourceStatusAtA0: R23_EXISTING_DATA_SOURCE_STATUS,
    sourcePolicy: "EXISTING_HISTORICAL_CACHE_ONLY_NO_NETWORK",
    networkAcquired: false,
    postBoundaryExcluded: true,
  },
  searchSpace: {
    maximumModelFamilies: 3,
    maximumThresholdsPerFamily: 3,
    maximumFeatureSubsetsPerFamily: 3,
    maximumCandidateConfigurations: 20,
    modelFamilies: R23_MODEL_FAMILIES,
    thresholdValues: R23_THRESHOLD_VALUES,
    candidateConfigurations: R23_CANDIDATE_CONFIGURATIONS,
    featureSource: "EXISTING_R13_FEATURE_DEFINITIONS_ONLY",
    noNewIndicators: true,
  },
  universe: { symbols: R23_SYMBOLS, directions: R23_DIRECTIONS, timeframe: "1h decision / 4h horizon", horizonHours: R23_HORIZON_HOURS },
  folds: { ids: R23_FOLD_IDS, definitions: R23_FOLDS, source: "RESEARCH_FOLDS_FROM_EXISTING_REPOSITORY" },
  costModel: R23_FROZEN_COST_MODEL,
  statisticalContract: R23_STATISTICAL_CONTRACT,
  developmentGates: R23_DEVELOPMENT_GATES,
  candidateSelection: { algorithm: R23_SELECTION_ALGORITHM, noBestHistoricalReturnSelection: true },
  governance: R23_GOVERNANCE,
} as const);

export const R23_PROTOCOL_CANONICAL_JSON = stableStringify(R23_PROTOCOL_OBJECT);
export const R23_PROTOCOL_SHA256 = createHash("sha256").update(R23_PROTOCOL_CANONICAL_JSON, "utf8").digest("hex");

export const R23_NO_FORWARD_CANDIDATE = "NO_FORWARD_CANDIDATE" as const;
export const R23_DEVELOPMENT_CLASSIFICATION = "HISTORICAL_CANDIDATE_DEVELOPMENT" as const;

export function calculateR23CandidateConfigurationCount(): number {
  return R23_MODEL_FAMILIES.length * R23_THRESHOLD_VALUES.length;
}

export function isR23ExistingFeatureName(value: string): value is R13FeatureName {
  return (R13_FEATURE_NAMES as readonly string[]).includes(value);
}

export function r23FoldDefinitionsEqualFrozenSource(): boolean {
  return R23_FOLD_IDS.every((foldId) => stableStringify(R23_FOLDS[foldId]) === stableStringify(R13_FOLDS[foldId]));
}
