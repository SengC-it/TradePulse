export const ROUND_020_RESEARCH_ROUND_ID = "baseline-002-research-round-020" as const;
export const ROUND_020_PHASE = "RESEARCH_SPACE_RESET_ONLY" as const;
export const ROUND_020_ACCEPTED_SOURCE = "c3409d38cf6f102d4213ecd6718ccc846702b9ab" as const;
export const ROUND_020_ACCEPTED_SOURCE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_020_BRANCH = "research/round-020-space-reset" as const;
export const ROUND_020_BASE_BRANCH = ROUND_020_ACCEPTED_SOURCE_BRANCH;
export const ROUND_020_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const ROUND_020_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const ROUND_020_DESIGN_PATH = "docs/research/round-020-space-reset.json" as const;

export const R20_SYMBOLS = Object.freeze([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const);

export const R20_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);

export const R20_FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);

export const R20_MECHANISM_FAMILY_IDS = Object.freeze([
  "FORCED_DELEVERAGING_LIQUIDATION_STATE",
  "POSITIONING_CROWDING_STATE",
  "SPOT_PERPETUAL_LEAD_LAG_DISLOCATION",
  "CROSS_EXCHANGE_FRAGMENTATION",
  "OPTIONS_IMPLIED_STATE",
  "ON_CHAIN_CAPITAL_FLOW",
  "EXTERNAL_EVENT_INFORMATION_SHOCK",
] as const);

export type R20MechanismFamilyId = (typeof R20_MECHANISM_FAMILY_IDS)[number];

export const R20_ADMISSIBILITY_STATUSES = Object.freeze([
  "ADMISSIBLE_EXISTING_DATA",
  "ADMISSIBLE_NEW_DATA_REQUIRED",
  "REJECTED_PRIOR_MECHANISM_OVERLAP",
  "REJECTED_POINT_IN_TIME_RISK",
  "REJECTED_INSUFFICIENT_BREADTH",
  "DEFERRED_LOW_VALUE",
] as const);

export type R20AdmissibilityStatus = (typeof R20_ADMISSIBILITY_STATUSES)[number];

export const R20_DATA_SURFACE_STATUSES = Object.freeze([
  "EXISTING_FROZEN_AVAILABLE",
  "EXISTING_BUT_CONSUMED",
  "EXISTING_INCOMPLETE",
  "NOT_PRESENT_NEW_DATA_REQUIRED",
] as const);

export type R20DataSurfaceStatus = (typeof R20_DATA_SURFACE_STATUSES)[number];

export const R20_MECHANISM_LEDGER_STATUSES = Object.freeze([
  "NEGATIVE_ECONOMIC_EVIDENCE",
  "DATA_INELIGIBLE",
  "DESIGN_REJECTED",
  "FORBIDDEN_RETEST",
  "PROVENANCE_ONLY",
  "STILL_OPEN",
] as const);

export type R20MechanismLedgerStatus = (typeof R20_MECHANISM_LEDGER_STATUSES)[number];

export const R20_RECOMMENDED_NEXT_FAMILY = "FORCED_DELEVERAGING_LIQUIDATION_STATE" as const;

export const R20_FORBIDDEN_OPERATIONS = Object.freeze([
  "ROUND_020_PREFLIGHT",
  "ROUND_020_PERFORMANCE",
  "ROUND_020_BACKTEST",
  "ROUND_020_SELECTION",
  "FORWARD_ECONOMIC_NUMERIC_READ",
  "ECONOMIC_LABEL_NUMERIC_READ",
  "THRESHOLD_SWEEP",
  "OPTIMIZER_OR_HYPERPARAMETER_SEARCH",
  "CANDIDATE_TUNING",
  "NEW_MARKET_DATA_ACQUISITION",
  "PRODUCTION_MODIFICATION",
  "SHADOW_OR_SCHEDULER_ACTIVATION",
  "AUTOMATIC_TRADING",
] as const);

export type Round020SpaceResetStatus = Readonly<{
  phase: typeof ROUND_020_PHASE;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  preflightAuthorized: false;
  performanceExecuted: false;
  selectionExecuted: false;
  economicValuesRead: false;
  economicValuesCalculated: false;
  economicValuesInspected: false;
  newMarketDataFetched: false;
  productionUnchanged: true;
  baseline001Unchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
}>;

export const R20_SPACE_RESET_STATUS: Round020SpaceResetStatus = Object.freeze({
  phase: ROUND_020_PHASE,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  preflightAuthorized: false,
  performanceExecuted: false,
  selectionExecuted: false,
  economicValuesRead: false,
  economicValuesCalculated: false,
  economicValuesInspected: false,
  newMarketDataFetched: false,
  productionUnchanged: true,
  baseline001Unchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  automaticTrading: false,
});

type R20DataSurfaceLike = Readonly<{
  status: R20DataSurfaceStatus;
  canonicalRepositoryPath?: unknown;
  manifestPath?: unknown;
  sourceCommit?: unknown;
  fileSha256?: unknown;
  dataSha256?: unknown;
  sourceStatus?: unknown;
  networkAcquired?: unknown;
  repositoryPaths?: unknown;
}>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function isCommitSha(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{40}$/i.test(value);
}

export function isRound020SpaceResetStatus(status: Round020SpaceResetStatus): boolean {
  return status.phase === ROUND_020_PHASE
    && status.performanceExecutionCount === 0
    && status.performanceLedgerPresent === false
    && status.preflightAuthorized === false
    && status.performanceExecuted === false
    && status.selectionExecuted === false
    && status.economicValuesRead === false
    && status.economicValuesCalculated === false
    && status.economicValuesInspected === false
    && status.newMarketDataFetched === false
    && status.productionUnchanged === true
    && status.baseline001Unchanged === true
    && status.baseline002Status === "NOT_FROZEN"
    && status.m3JStatus === "BLOCKED"
    && status.m4Status === "NOT_STARTED"
    && status.automaticTrading === false;
}

export function hasConcreteProvenanceForExistingDataSurface(surface: R20DataSurfaceLike): boolean {
  if (surface.status === "NOT_PRESENT_NEW_DATA_REQUIRED") {
    return true;
  }

  return isNonEmptyString(surface.canonicalRepositoryPath)
    && isNonEmptyString(surface.manifestPath)
    && isCommitSha(surface.sourceCommit)
    && isSha256(surface.fileSha256)
    && isSha256(surface.dataSha256)
    && isNonEmptyString(surface.sourceStatus)
    && surface.networkAcquired === false
    && Array.isArray(surface.repositoryPaths)
    && surface.repositoryPaths.length > 0
    && surface.repositoryPaths.every(isNonEmptyString);
}

export function hasAtMostOneRecommendation(decision: Readonly<{
  recommendedNextFamily?: unknown;
  recommendedFamilies?: unknown;
  recommendationCount?: unknown;
}>): boolean {
  const recommendedFamilies = decision.recommendedFamilies;
  const recommendationCount = decision.recommendationCount;

  return Array.isArray(recommendedFamilies)
    && recommendedFamilies.length <= 1
    && recommendationCount === recommendedFamilies.length
    && (recommendedFamilies.length === 0 || recommendedFamilies[0] === decision.recommendedNextFamily);
}

const DISALLOWED_RANKING_KEYS = new Set([
  "netR",
  "profitFactor",
  "pnl",
  "drawdown",
  "winLoss",
  "forwardReturn",
  "economicLabelValue",
]);

export function rankingUsesNoEconomicFields(ranking: unknown): boolean {
  if (ranking === null || typeof ranking !== "object" || Array.isArray(ranking)) {
    return false;
  }

  const record = ranking as Record<string, unknown>;
  return record.usesForwardEconomicValues === false
    && record.usesHistoricalEconomicResults === false
    && Object.keys(record).every((key) => !DISALLOWED_RANKING_KEYS.has(key));
}

export function isRound020DesignOnlyRecord(record: Readonly<{
  schemaVersion?: unknown;
  researchRoundId?: unknown;
  phase?: unknown;
  acceptedResearchSource?: unknown;
  decision?: unknown;
  authoritativeExecutionGovernance?: unknown;
}>): boolean {
  return record.schemaVersion === "m3-r20-space-reset-001"
    && record.researchRoundId === ROUND_020_RESEARCH_ROUND_ID
    && record.phase === ROUND_020_PHASE
    && record.acceptedResearchSource !== null
    && typeof record.acceptedResearchSource === "object"
    && record.decision !== null
    && typeof record.decision === "object"
    && record.authoritativeExecutionGovernance !== null
    && typeof record.authoritativeExecutionGovernance === "object";
}
