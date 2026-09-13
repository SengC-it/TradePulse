import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";

export const R22_HISTORICAL_REVIEW_SCHEMA_VERSION = "m3-r22-historical-review-design-001" as const;
export const R22_HISTORICAL_REVIEW_ROUND_ID = "baseline-002-research-round-022" as const;
export const R22_HISTORICAL_REVIEW_PHASE = "HISTORICAL_SIGNAL_REVIEW_DESIGN_ONLY" as const;
export const R22_HISTORICAL_REVIEW_ACCEPTED_SOURCE = "9358efc5b78a4f57560c44fa8a7315f08cc59092" as const;
export const R22_HISTORICAL_REVIEW_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_HISTORICAL_REVIEW_BRANCH = "research/round-022-historical-review-design" as const;
export const R22_HISTORICAL_REVIEW_CONTRACT_PATH = "docs/research/round-022-historical-review-contract.json" as const;
export const R22_HISTORICAL_REVIEW_DESIGN_PATH = "docs/research/round-022-historical-review-design.md" as const;

export const R22_HISTORICAL_REVIEW_IDENTITY_FIELDS = Object.freeze([
  "signalId",
  "symbol",
  "direction",
  "signalTime",
  "strategyId",
  "strategyVersion",
] as const);

export const R22_HISTORICAL_REVIEW_DIRECTIONS = Object.freeze([
  "LONG",
  "SHORT",
  "NO_SIGNAL",
] as const);
export type R22HistoricalReviewDirection = (typeof R22_HISTORICAL_REVIEW_DIRECTIONS)[number];

export const R22_HISTORICAL_REVIEW_STATUSES = Object.freeze([
  "IDENTITY_VERIFIED",
  "QUALITY_SNAPSHOT_AVAILABLE",
  "QUALITY_SNAPSHOT_MISSING",
  "IDENTITY_INVALID",
  "NOT_REVIEWABLE",
] as const);
export type R22HistoricalReviewStatus = (typeof R22_HISTORICAL_REVIEW_STATUSES)[number];

export type R22HistoricalReviewIdentity = Readonly<{
  signalId: string;
  symbol: ResearchSymbol;
  direction: R22HistoricalReviewDirection;
  signalTime: string;
  strategyId: string;
  strategyVersion: string;
}>;

export type R22HistoricalReviewInput = Readonly<{
  identity: R22HistoricalReviewIdentity;
  qualitySnapshotStatus: "AVAILABLE" | "MISSING" | "NOT_APPLICABLE";
}>;

export type R22HistoricalReviewResult = Readonly<{
  reviewKey: string;
  status: R22HistoricalReviewStatus;
  identityValid: boolean;
  qualitySnapshotStatus: R22HistoricalReviewInput["qualitySnapshotStatus"];
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

export type R22HistoricalReviewGovernance = Readonly<{
  designOnly: true;
  performanceExecuted: false;
  backtestExecuted: false;
  selectionExecuted: false;
  economicEvaluationExecuted: false;
  economicValuesRead: false;
  newMarketDataFetched: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  productionUnchanged: true;
  baseline001Unchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
  humanDecisionRequired: true;
}>;

export const R22_HISTORICAL_REVIEW_GOVERNANCE: R22HistoricalReviewGovernance = Object.freeze({
  designOnly: true,
  performanceExecuted: false,
  backtestExecuted: false,
  selectionExecuted: false,
  economicEvaluationExecuted: false,
  economicValuesRead: false,
  newMarketDataFetched: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  productionUnchanged: true,
  baseline001Unchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  automaticTrading: false,
  humanDecisionRequired: true,
});

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function canonicalIsoTimestamp(value: string): boolean {
  if (!nonEmpty(value) || !value.endsWith("Z")) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function isR22HistoricalReviewIdentityValid(
  identity: R22HistoricalReviewIdentity,
): boolean {
  return nonEmpty(identity.signalId)
    && (RESEARCH_SYMBOLS as readonly string[]).includes(identity.symbol)
    && R22_HISTORICAL_REVIEW_DIRECTIONS.includes(identity.direction)
    && canonicalIsoTimestamp(identity.signalTime)
    && nonEmpty(identity.strategyId)
    && nonEmpty(identity.strategyVersion);
}

export function createR22HistoricalReviewKey(
  identity: R22HistoricalReviewIdentity,
): string {
  return JSON.stringify([
    R22_HISTORICAL_REVIEW_SCHEMA_VERSION,
    identity.signalId,
    identity.symbol,
    identity.direction,
    identity.signalTime,
    identity.strategyId,
    identity.strategyVersion,
  ]);
}

export function classifyR22HistoricalReview(
  input: R22HistoricalReviewInput,
): R22HistoricalReviewResult {
  const identityValid = isR22HistoricalReviewIdentityValid(input.identity);
  const reviewKey = createR22HistoricalReviewKey(input.identity);

  if (!identityValid) {
    return {
      reviewKey,
      status: "IDENTITY_INVALID",
      identityValid: false,
      qualitySnapshotStatus: input.qualitySnapshotStatus,
      humanDecisionRequired: true,
      automaticTrading: false,
    };
  }

  if (input.identity.direction === "NO_SIGNAL") {
    return {
      reviewKey,
      status: "NOT_REVIEWABLE",
      identityValid: true,
      qualitySnapshotStatus: "NOT_APPLICABLE",
      humanDecisionRequired: true,
      automaticTrading: false,
    };
  }

  return {
    reviewKey,
    status: input.qualitySnapshotStatus === "AVAILABLE"
      ? "QUALITY_SNAPSHOT_AVAILABLE"
      : "QUALITY_SNAPSHOT_MISSING",
    identityValid: true,
    qualitySnapshotStatus: input.qualitySnapshotStatus,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function isR22HistoricalReviewDesignOnlyGovernance(
  status: R22HistoricalReviewGovernance,
): boolean {
  return status.designOnly
    && status.performanceExecuted === false
    && status.backtestExecuted === false
    && status.selectionExecuted === false
    && status.economicEvaluationExecuted === false
    && status.economicValuesRead === false
    && status.newMarketDataFetched === false
    && status.performanceExecutionCount === 0
    && status.performanceLedgerPresent === false
    && status.productionUnchanged
    && status.baseline001Unchanged
    && status.baseline002Status === "NOT_FROZEN"
    && status.m3JStatus === "BLOCKED"
    && status.m4Status === "NOT_STARTED"
    && status.automaticTrading === false
    && status.humanDecisionRequired === true;
}
