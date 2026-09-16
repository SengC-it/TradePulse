import { createHash } from "node:crypto";

import { stableStringify } from "./utils.ts";

export const R25_RESEARCH_ROUND_ID = "baseline-002-research-round-025" as const;
export const R25_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R25_BASE_SHA = "1b1bbb8de0fa38969865b62cee64b015a8b42027" as const;
export const R25_BRANCH = "research/round-025-targeted-directional-redesign" as const;
export const R25_PHASE = "BOUNDED_DEVELOPMENT_ONLY" as const;

export const R25_DEVELOPMENT_DATA_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R25_DEVELOPMENT_DATA_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const R25_HORIZON_HOURS = 4 as const;
export const R25_PURGE_EMBARGO_HOURS = 24 as const;
export const R25_MANUAL_LATENCY_MINUTES = 7 as const;
export const R25_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const);
export const R25_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export const R25_FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);

export const R25_DEVELOPMENT_DATA_SOURCE = Object.freeze({
  status: "ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED",
  canonicalObservationPath: ".cache/tradepulse/round-014/observations.ndjson",
  manifestPath: "docs/research/round-014-observation-freeze.json",
  observationDataSha256: "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359",
  observationDataBytes: 1_893_811_055,
  observationCount: 244_810,
  freezeManifestSha256: "7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6",
  freezeCommit: "44d630dd387e75ed9a46713a94f38221fa48ab0f",
  networkAcquired: false,
  newHistoricalDevelopmentDataFetched: false,
  developmentOnly: true,
});

export const R25_FOLDS_SOURCE = Object.freeze({
  path: "src/lib/research/folds.ts",
  gitBlobSha: "e9556ea7302779a680e435799f9ebd5235d08658",
  definitionIdentity: "RESEARCH_FOLDS / R13_FOLDS",
  purgeEmbargoHours: R25_PURGE_EMBARGO_HOURS,
});

export const R25_COST_POLICY = Object.freeze({
  policyVersion: "bt-policy-003",
  feeRatePerSide: 0.0005,
  slippageRatePerSide: 0.0005,
  funding: "actual Binance USD-M funding events/rates with direction-correct sign",
  longFundingSign: "-fundingRate * markPrice",
  shortFundingSign: "+fundingRate * markPrice",
  manualLatencyMinutes: R25_MANUAL_LATENCY_MINUTES,
  entry: "first complete 1m open at or after signalTime + 7 minutes",
  exit: "first causally resolved TP/SL event, otherwise 4h time exit",
  ambiguousIntrabar: "NOT_EVALUABLE",
  optimisticTpSelection: false,
  netFormula: "netReturn = grossReturn - feeCost - slippageCost - fundingCost",
  stress: "1.5x total fee + slippage + funding cost",
  sourceFiles: Object.freeze([
    Object.freeze({ path: "src/lib/backtest/constants.ts", gitBlobSha: "41d4d2b5d20c3013c631851217dff1ce6182caf6", sha256: "d00794b9bda54321c848efedfac0d8891fcb6d1aec04b2ebab2265bfdf9f1014" }),
    Object.freeze({ path: "src/lib/backtest/settlement.ts", gitBlobSha: "826caace4c99359c5a2551ec8a046b218954fc1f", sha256: "22da94ff239f3e1d424218242d4ceca25803b32b71b80bf42d247b323cd53180" }),
    Object.freeze({ path: "src/lib/backtest/funding.ts", gitBlobSha: "4a7cd0cac0a02465f382ecf70a8859e69ecdf076", sha256: "448ccd029451b67ebda2122d50f35d4e997b41f209ec33f5180c3bd59654a9ae" }),
  ]),
});

export const R25_COST_POLICY_HASH = createHash("sha256").update(stableStringify(R25_COST_POLICY), "utf8").digest("hex");
export const R25_SETTLEMENT_HASH = "22da94ff239f3e1d424218242d4ceca25803b32b71b80bf42d247b323cd53180" as const;

export const R25_DEVELOPMENT_GATES = Object.freeze({
  minimumSelectedAlerts: 50,
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

export const R25_GOVERNANCE = Object.freeze({
  humanDecisionRequired: true,
  automaticTrading: false,
  productionUnchanged: true,
  mainUnchanged: true,
  emailRestorationAuthorized: false,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  historicalWindowNowSeen: true,
  historicalWindowReuseForAuthoritativeEvaluation: false,
  forwardEconomicValuesRead: false,
  forwardReturnRead: false,
  forwardValidationAuthorized: false,
  newPostFreezeForwardDataFetched: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
});

export const R25_PROTOCOL_OBJECT = Object.freeze({
  schemaVersion: "m3-r25-targeted-directional-redesign-protocol-001",
  researchRoundId: R25_RESEARCH_ROUND_ID,
  phase: R25_PHASE,
  base: Object.freeze({ branch: R25_BASE_BRANCH, sha: R25_BASE_SHA }),
  branch: R25_BRANCH,
  developmentWindow: Object.freeze({ start: R25_DEVELOPMENT_DATA_START_ISO, end: R25_DEVELOPMENT_DATA_END_ISO, classification: "DEVELOPMENT_ONLY" }),
  source: R25_DEVELOPMENT_DATA_SOURCE,
  folds: R25_FOLDS_SOURCE,
  costPolicy: R25_COST_POLICY,
  searchSpace: Object.freeze({ maximumLongConfigurations: 3, maximumShortConfigurations: 3, maximumTotalConfigurations: 6, completeEvaluationExecutionCount: 1 }),
  configurations: Object.freeze({
    long: Object.freeze([
      "R25_LONG_TREND_PULLBACK_VOLUME_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.10",
      "R25_LONG_TREND_PULLBACK_VOLUME_NEUTRALIZED_LAMBDA_10_THRESHOLD_0.15",
      "R25_LONG_TREND_PULLBACK_NO_VOLUME_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.10",
    ]),
    short: Object.freeze([
      "R25_SHORT_TREND_VOLATILITY_FUNDING_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.03",
      "R25_SHORT_RELATIVE_FLOW_FUNDING_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.03",
      "R25_SHORT_RELATIVE_FLOW_FUNDING_NEUTRALIZED_LAMBDA_100_THRESHOLD_0.03",
    ]),
  }),
  normalization: "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME;PIT_CLOSED_CANDLE_ONLY",
  modelSelection: "FAMILY_LOCAL_ALL_FROZEN_GATES_THEN_WORST_FOLD_COST_DRAWDOWN_LEXICAL_TIE_BREAK",
  noForwardReuse: true,
  governance: R25_GOVERNANCE,
});

export const R25_PROTOCOL_SHA256 = createHash("sha256").update(stableStringify(R25_PROTOCOL_OBJECT), "utf8").digest("hex");

export type R25Direction = (typeof R25_DIRECTIONS)[number];
export type R25FoldId = (typeof R25_FOLD_IDS)[number];
export type R25Symbol = (typeof R25_SYMBOLS)[number];
