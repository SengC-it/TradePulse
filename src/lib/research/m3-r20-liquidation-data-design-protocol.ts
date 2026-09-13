export const ROUND_020_LIQUIDATION_RESEARCH_ROUND_ID = "baseline-002-research-round-020" as const;
export const ROUND_020_LIQUIDATION_PHASE = "DATA_ACQUISITION_DESIGN_ONLY" as const;
export const ROUND_020_LIQUIDATION_ACCEPTED_SOURCE = "65a1a133c356264c58a38584e38d214d33577ba4" as const;
export const ROUND_020_LIQUIDATION_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_020_LIQUIDATION_BRANCH = "research/round-020-liquidation-data-design" as const;
export const ROUND_020_LIQUIDATION_DESIGN_PATH = "docs/research/round-020-liquidation-data-design.json" as const;
export const ROUND_020_LIQUIDATION_DESIGN_MARKDOWN_PATH = "docs/research/round-020-liquidation-data-design.md" as const;

export const R20_LIQUIDATION_SYMBOLS = Object.freeze([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const);

export const R20_LIQUIDATION_VENUE = "BINANCE_USDM" as const;
export const R20_LIQUIDATION_MARKET_TYPE = "USD_M_PERPETUALS" as const;
export const R20_LIQUIDATION_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R20_LIQUIDATION_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const R20_LIQUIDATION_MECHANISM_FAMILY = "FORCED_DELEVERAGING_LIQUIDATION_STATE" as const;

export const R20_LIQUIDATION_SOURCE_CLASSIFICATIONS = Object.freeze([
  "QUALIFIED_FULL_TARGET_COVERAGE",
  "QUALIFIED_PARTIAL_TARGET_COVERAGE",
  "LIVE_ONLY_NOT_HISTORICAL",
  "INSUFFICIENT_PROVENANCE",
  "INSUFFICIENT_PIT",
  "INSUFFICIENT_SYMBOL_BREADTH",
  "UNKNOWN_REQUIRES_METADATA_PROBE",
] as const);

export type R20LiquidationSourceClassification = (typeof R20_LIQUIDATION_SOURCE_CLASSIFICATIONS)[number];

export const R20_LIQUIDATION_RANKING_DIMENSIONS = Object.freeze([
  "officialProvenance",
  "pointInTimeIntegrity",
  "historicalCoverage",
  "symbolBreadth",
  "completenessTransparency",
  "immutableArchiveAvailability",
  "reproducibility",
  "schemaQuality",
  "licensingStability",
  "acquisitionFeasibility",
] as const);

export type R20LiquidationRankingDimension = (typeof R20_LIQUIDATION_RANKING_DIMENSIONS)[number];
export type R20LiquidationDimensionScores = Readonly<Record<R20LiquidationRankingDimension, number>>;

export const R20_LIQUIDATION_RANKING_METHOD = "EQUAL_WEIGHT_ARITHMETIC_MEAN" as const;
export const R20_LIQUIDATION_RANKING_ROUNDING = "ROUND_TO_3_DECIMAL_PLACES" as const;
export const R20_LIQUIDATION_RANKING_TIE_BREAK = "overallScoreDescending_then_sourceIdLexicalAscending" as const;
export const R20_LIQUIDATION_RANKING_WEIGHTS: R20LiquidationDimensionScores = Object.freeze({
  officialProvenance: 1,
  pointInTimeIntegrity: 1,
  historicalCoverage: 1,
  symbolBreadth: 1,
  completenessTransparency: 1,
  immutableArchiveAvailability: 1,
  reproducibility: 1,
  schemaQuality: 1,
  licensingStability: 1,
  acquisitionFeasibility: 1,
});

export const R20_LIQUIDATION_ALLOWED_RECOMMENDATION_STATUSES = Object.freeze([
  "QUALIFIED_FULL_TARGET_COVERAGE",
  "QUALIFIED_PARTIAL_TARGET_COVERAGE",
  "UNKNOWN_REQUIRES_METADATA_PROBE",
] as const);

export type R20LiquidationSourceForRanking = Readonly<{
  sourceId: string;
  classification: R20LiquidationSourceClassification;
  recommendationEligible: boolean;
  dimensionScores: R20LiquidationDimensionScores;
}>;

export type R20LiquidationRankedSource = R20LiquidationSourceForRanking & Readonly<{
  rank: number;
  overallResearchPriority: number;
  eligibleForRecommendation: boolean;
}>;

function hasExactlyTenValidScores(scores: R20LiquidationDimensionScores): boolean {
  const keys = Object.keys(scores);
  return keys.length === R20_LIQUIDATION_RANKING_DIMENSIONS.length
    && R20_LIQUIDATION_RANKING_DIMENSIONS.every((dimension) => {
      const value = scores[dimension];
      return Number.isInteger(value) && value >= 0 && value <= 5;
    })
    && keys.every((key) => R20_LIQUIDATION_RANKING_DIMENSIONS.includes(key as R20LiquidationRankingDimension));
}

export function calculateR20LiquidationSourcePriority(
  dimensionScores: R20LiquidationDimensionScores,
): number {
  if (!hasExactlyTenValidScores(dimensionScores)) {
    throw new Error("Round-020 liquidation ranking requires exactly ten integer dimensions in the range 0..5");
  }

  const sum = R20_LIQUIDATION_RANKING_DIMENSIONS.reduce(
    (total, dimension) => total + dimensionScores[dimension] * R20_LIQUIDATION_RANKING_WEIGHTS[dimension],
    0,
  );
  return Math.round((sum / R20_LIQUIDATION_RANKING_DIMENSIONS.length) * 1000) / 1000;
}

function isRecommendationEligible(
  source: R20LiquidationSourceForRanking,
): boolean {
  return source.recommendationEligible
    && R20_LIQUIDATION_ALLOWED_RECOMMENDATION_STATUSES.some((status) => status === source.classification);
}

export function rankR20LiquidationSources(
  sources: readonly R20LiquidationSourceForRanking[],
): R20LiquidationRankedSource[] {
  return sources
    .map((source) => ({
      ...source,
      overallResearchPriority: calculateR20LiquidationSourcePriority(source.dimensionScores),
      eligibleForRecommendation: isRecommendationEligible(source),
      rank: 0,
    }))
    .sort((left, right) => right.overallResearchPriority - left.overallResearchPriority
      || left.sourceId.localeCompare(right.sourceId))
    .map((source, index) => ({ ...source, rank: index + 1 }));
}

export const R20_LIQUIDATION_CANONICAL_EVENT_FIELDS = Object.freeze([
  "source",
  "venue",
  "marketType",
  "symbol",
  "eventTime",
  "publicationTime",
  "liquidationSide",
  "executionSide",
  "price",
  "quantity",
  "notional",
  "eventSequence",
  "sourceIdentity",
  "contractType",
  "rawProvenance",
] as const);

export const R20_LIQUIDATION_SIDE_SEMANTICS = Object.freeze({
  liquidationSide: "The position side forced out: LONG or SHORT; must be supplied or explicitly mapped by the source contract.",
  executionSide: "The aggressor/order execution side; it is not a substitute for liquidationSide.",
  forbiddenInference: "Do not infer liquidationSide from executionSide without a source-documented mapping.",
} as const);

export type R20LiquidationIdentityParts = Readonly<{
  venue: string;
  symbol: string;
  eventTime: string;
  liquidationSide: "LONG" | "SHORT" | "UNKNOWN";
  price: string;
  quantity: string;
  sourceSequence: string;
}>;

export function buildR20LiquidationCompositeIdentity(parts: R20LiquidationIdentityParts): string {
  return [
    parts.venue,
    parts.symbol,
    parts.eventTime,
    parts.liquidationSide,
    parts.price,
    parts.quantity,
    parts.sourceSequence,
  ].join("|");
}

export function exactR20LiquidationIdentityMatches(
  left: R20LiquidationIdentityParts,
  right: R20LiquidationIdentityParts,
): boolean {
  return R20_LIQUIDATION_CANONICAL_IDENTITY_PARTS.every((part) => left[part] === right[part]);
}

export const R20_LIQUIDATION_CANONICAL_IDENTITY_PARTS = Object.freeze([
  "venue",
  "symbol",
  "eventTime",
  "liquidationSide",
  "price",
  "quantity",
  "sourceSequence",
] as const);

export function isR20LiquidationPointInTimeAdmissible(
  eventTimeMs: number,
  publicationTimeMs: number | null,
  decisionTimeMs: number,
): boolean {
  if (!Number.isFinite(eventTimeMs) || !Number.isFinite(decisionTimeMs) || eventTimeMs > decisionTimeMs) {
    return false;
  }
  return publicationTimeMs === null
    || (Number.isFinite(publicationTimeMs) && publicationTimeMs <= decisionTimeMs);
}

export const R20_LIQUIDATION_COMPLETENESS_STATUSES = Object.freeze([
  "COMPLETE_EVENT_STREAM",
  "SAMPLED_EVENT_STREAM",
  "AGGREGATED_EVENT_STREAM",
  "SNAPSHOT_ONLY",
  "UNKNOWN_COMPLETENESS",
] as const);

export const R20_LIQUIDATION_FUTURE_MANIFEST_REQUIRED_FIELDS = Object.freeze([
  "acquisitionId",
  "sourceId",
  "sourceUrl",
  "acquiredAt",
  "range",
  "symbols",
  "venue",
  "marketType",
  "files",
  "bytes",
  "sha256PerFile",
  "aggregateSha256",
  "eventCount",
  "firstEventTime",
  "lastEventTime",
  "duplicateCount",
  "malformedCount",
  "gapAssessment",
  "coverageClassification",
  "documentationSnapshot",
  "networkAcquired",
] as const);

export type R20LiquidationDesignGovernance = Readonly<{
  phase: typeof ROUND_020_LIQUIDATION_PHASE;
  activeHypothesis: null;
  candidateCreated: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  preflightAuthorized: false;
  performanceAuthorized: false;
  performanceExecuted: false;
  selectionExecuted: false;
  economicValuesRead: false;
  economicValuesCalculated: false;
  economicValuesInspected: false;
  newMarketDataFetched: false;
  acquisitionBytes: 0;
  productionUnchanged: true;
  baseline001Unchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
}>;

export const R20_LIQUIDATION_DESIGN_GOVERNANCE: R20LiquidationDesignGovernance = Object.freeze({
  phase: ROUND_020_LIQUIDATION_PHASE,
  activeHypothesis: null,
  candidateCreated: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  preflightAuthorized: false,
  performanceAuthorized: false,
  performanceExecuted: false,
  selectionExecuted: false,
  economicValuesRead: false,
  economicValuesCalculated: false,
  economicValuesInspected: false,
  newMarketDataFetched: false,
  acquisitionBytes: 0,
  productionUnchanged: true,
  baseline001Unchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  automaticTrading: false,
});

export function isR20LiquidationDesignOnlyGovernance(
  governance: R20LiquidationDesignGovernance,
): boolean {
  return governance.phase === ROUND_020_LIQUIDATION_PHASE
    && governance.activeHypothesis === null
    && governance.candidateCreated === false
    && governance.performanceExecutionCount === 0
    && governance.performanceLedgerPresent === false
    && governance.preflightAuthorized === false
    && governance.performanceAuthorized === false
    && governance.performanceExecuted === false
    && governance.selectionExecuted === false
    && governance.economicValuesRead === false
    && governance.economicValuesCalculated === false
    && governance.economicValuesInspected === false
    && governance.newMarketDataFetched === false
    && governance.acquisitionBytes === 0
    && governance.productionUnchanged === true
    && governance.baseline001Unchanged === true
    && governance.baseline002Status === "NOT_FROZEN"
    && governance.m3JStatus === "BLOCKED"
    && governance.m4Status === "NOT_STARTED"
    && governance.automaticTrading === false;
}
