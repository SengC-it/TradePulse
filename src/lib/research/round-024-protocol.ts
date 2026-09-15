import { createHash } from "node:crypto";

import { stableStringify } from "./utils.ts";

export const R24_RESEARCH_ROUND_ID = "baseline-002-research-round-024" as const;
export const R24_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R24_BASE_SHA = "494d41f0d08f6a4931fa887f47af1c514aab1351" as const;
export const R24_BRANCH = "research/round-024-directional-candidate-families" as const;
export const R24_PHASE = "DEVELOPMENT_THEN_PRE_OUTCOME_EXECUTABLE_FREEZE" as const;

export const R24_DEVELOPMENT_DATA_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R24_DEVELOPMENT_DATA_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const R24_HORIZON_HOURS = 4 as const;
export const R24_PURGE_EMBARGO_HOURS = 24 as const;
export const R24_MANUAL_LATENCY_MINUTES = 7 as const;
export const R24_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const);
export const R24_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export const R24_FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);

export const R24_DEVELOPMENT_DATA_SOURCE = Object.freeze({
  status: "ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED",
  observationPath: ".cache/tradepulse/round-014/observations.ndjson",
  manifestPath: "docs/research/round-023-development-data-manifest.json",
  observationDataSha256: "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359",
  observationDataBytes: 1_893_811_055,
  freezeManifestPath: "docs/research/round-014-observation-freeze.json",
  freezeManifestSha256: "7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6",
  freezeCommit: "44d630dd387e75ed9a46713a94f38221fa48ab0f",
  networkAcquired: false,
  newHistoricalDevelopmentDataFetched: false,
  developmentOnly: true,
});

export const R24_FOLDS_SOURCE = Object.freeze({
  path: "src/lib/research/folds.ts",
  gitBlobSha: "e9556ea7302779a680e435799f9ebd5235d08658",
  definitionIdentity: "RESEARCH_FOLDS / R13_FOLDS",
  purgeEmbargoHours: R24_PURGE_EMBARGO_HOURS,
});

export const R24_COST_POLICY = Object.freeze({
  policyVersion: "bt-policy-003",
  feeRatePerSide: 0.0005,
  slippageRatePerSide: 0.0005,
  funding: "actual Binance USD-M funding events/rates with direction-correct sign",
  longFundingSign: "-fundingRate * markPrice",
  shortFundingSign: "+fundingRate * markPrice",
  manualLatencyMinutes: R24_MANUAL_LATENCY_MINUTES,
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

export const R24_COST_POLICY_HASH = createHash("sha256").update(stableStringify(R24_COST_POLICY), "utf8").digest("hex");
export const R24_SETTLEMENT_HASH = "22da94ff239f3e1d424218242d4ceca25803b32b71b80bf42d247b323cd53180" as const;

export const R24_DEVELOPMENT_GATES = Object.freeze({
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
  maximumSinglePositiveObservationContribution: 0.05,
});

export const R24_GOVERNANCE = Object.freeze({
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
  newPostFreezeForwardDataFetched: false,
});

export const R24_PROTOCOL_OBJECT = Object.freeze({
  schemaVersion: "m3-r24-directional-candidate-families-protocol-001",
  researchRoundId: R24_RESEARCH_ROUND_ID,
  phase: R24_PHASE,
  base: Object.freeze({ branch: R24_BASE_BRANCH, sha: R24_BASE_SHA }),
  branch: R24_BRANCH,
  developmentWindow: Object.freeze({ start: R24_DEVELOPMENT_DATA_START_ISO, end: R24_DEVELOPMENT_DATA_END_ISO, classification: "DEVELOPMENT_ONLY" }),
  dataSource: R24_DEVELOPMENT_DATA_SOURCE,
  folds: R24_FOLDS_SOURCE,
  costPolicy: R24_COST_POLICY,
  candidateFamilies: Object.freeze(["LONG-CANDIDATE-FAMILY", "SHORT-CANDIDATE-FAMILY"]),
  maximumConfigurationsPerFamily: 4,
  randomShuffleCv: false,
  modelFreeze: "PRE_OUTCOME_EXECUTABLE_FREEZE",
  forwardRule: "signalTime > remote executable freeze timestamp",
  governance: R24_GOVERNANCE,
});

export const R24_PROTOCOL_SHA256 = createHash("sha256").update(stableStringify(R24_PROTOCOL_OBJECT), "utf8").digest("hex");

export type R24Direction = (typeof R24_DIRECTIONS)[number];
export type R24FoldId = (typeof R24_FOLD_IDS)[number];
export type R24Symbol = (typeof R24_SYMBOLS)[number];
