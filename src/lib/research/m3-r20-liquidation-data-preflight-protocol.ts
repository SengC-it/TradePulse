export const R20_LIQUIDATION_PREFLIGHT_SCHEMA_VERSION = "m3-r20-liquidation-data-preflight-001" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_RESEARCH_ROUND_ID = "baseline-002-research-round-020" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_PHASE = "DATA_ACQUISITION_PREFLIGHT" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_RESEARCH_SOURCE = "e9a0b39622401b7b512043417545afe33c98a99a" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_DESIGN_MERGE = "bff63214c9a31c516816d8756e560475a86e1746" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_BRANCH = "research/round-020-liquidation-data-preflight" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH = "docs/research/round-020-liquidation-data-design.json" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_MARKDOWN_PATH = "docs/research/round-020-liquidation-data-design.md" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_JSON_PATH = "docs/research/round-020-liquidation-data-preflight.json" as const;
export const ROUND_020_LIQUIDATION_PREFLIGHT_MARKDOWN_PATH = "docs/research/round-020-liquidation-data-preflight.md" as const;

export const R20_LIQUIDATION_PREFLIGHT_SOURCE_ID = "TARDIS_BINANCE_USDT_FUTURES_LIQUIDATIONS" as const;
export const R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS = Object.freeze([
  "TARDIS_NORMALIZED_LIQUIDATIONS_CSV",
  "TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY",
] as const);
export type R20LiquidationPreflightRepresentation = (typeof R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS)[number];

export const R20_LIQUIDATION_PREFLIGHT_VENUE = "BINANCE_USDM" as const;
export const R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID = "binance-futures" as const;
export const R20_LIQUIDATION_PREFLIGHT_MARKET_TYPE = "USD_M_PERPETUALS" as const;
export const R20_LIQUIDATION_PREFLIGHT_SYMBOLS = Object.freeze([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const);
export const R20_LIQUIDATION_PREFLIGHT_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R20_LIQUIDATION_PREFLIGHT_END_ISO = "2026-08-15T23:59:59.999Z" as const;

export const R20_LIQUIDATION_PREFLIGHT_GATE_IDS = Object.freeze([
  "P01_ACCEPTED_SOURCE_DESIGN_INTEGRITY",
  "P02_TARGET_COVERAGE",
  "P03_POINT_IN_TIME_TIMESTAMP_PROVENANCE",
  "P04_EXACT_EVENT_IDENTITY",
  "P05_COMPLETENESS_SNAPSHOT_GAP_SEMANTICS",
  "P06_SIDE_QUANTITY_SCHEMA_CONTRACT",
  "P07_REVISION_ARCHIVE_LICENSE_REPRODUCIBILITY_ENTITLEMENT",
] as const);
export type R20LiquidationPreflightGateId = (typeof R20_LIQUIDATION_PREFLIGHT_GATE_IDS)[number];

export const R20_LIQUIDATION_PREFLIGHT_GATE_STATUSES = Object.freeze([
  "PASS",
  "FAIL",
  "UNKNOWN",
] as const);
export type R20LiquidationPreflightGateStatus = (typeof R20_LIQUIDATION_PREFLIGHT_GATE_STATUSES)[number];

export const R20_LIQUIDATION_PREFLIGHT_FINAL_DECISIONS = Object.freeze([
  "ROUND-020 DATA ACQUISITION PREFLIGHT PASS",
  "ROUND-020 DATA ACQUISITION INELIGIBLE",
] as const);
export type R20LiquidationPreflightFinalDecision = (typeof R20_LIQUIDATION_PREFLIGHT_FINAL_DECISIONS)[number];

export type R20LiquidationPreflightGate = Readonly<{
  id: R20LiquidationPreflightGateId;
  status: R20LiquidationPreflightGateStatus;
  reason: string;
}>;

export type R20LiquidationMetadataCoverage = Readonly<{
  exchangeId: string;
  datasetType: string;
  formats: readonly string[];
  exportedFrom: string | null;
  exportedUntil: string | null;
  targetSymbolAvailability: Readonly<Record<string, Readonly<{
    availableSince: string | null;
    availableTo: string | null;
    liquidationDatasetAdvertised: boolean;
  }>>>;
  exactDailyFileMatrixProbed: boolean;
}>;

export type R20LiquidationRepresentationEvidence = Readonly<{
  representation: R20LiquidationPreflightRepresentation;
  immutableEventIdentityProven: boolean;
  sourceSequenceProven: boolean;
  eventTimestampProven: boolean;
  publicationTimestampProven: boolean;
  fallbackTimestampRuleProven: boolean;
  dailySegmentationRuleProven: boolean;
  replayLeakageExcluded: boolean;
  gapEvidenceProven: boolean;
  sideMappingProven: boolean;
  quantityMappingProven: boolean;
  revisionPolicyProven: boolean;
  entitlementVerified: boolean;
  completenessStatus: "SAMPLED_EVENT_STREAM" | "COMPLETE_EVENT_STREAM" | "UNKNOWN_COMPLETENESS";
  normalizedIdMayBeEmpty: boolean;
  rawPayloadIdentityMayBeMissing: boolean;
}>;

export type R20LiquidationPreflightInput = Readonly<{
  acceptedSourceIntegrity: boolean;
  recommendedSourceUnchanged: boolean;
  candidateCreated: boolean;
  performanceExecutionCount: number;
  coverage: R20LiquidationMetadataCoverage;
  representations: readonly R20LiquidationRepresentationEvidence[];
  marketEventBodyRequests: number;
  marketEventBytesDownloaded: number;
  rawMarketEventsRead: boolean;
  performanceLedgerPresent: boolean;
  economicValuesRead: boolean;
  economicValuesCalculated: boolean;
  economicValuesInspected: boolean;
  newMarketDataFetched: boolean;
  productionUnchanged: boolean;
  baseline002Status: "NOT_FROZEN" | string;
  m3JStatus: "BLOCKED" | string;
  m4Status: "NOT_STARTED" | string;
  automaticTrading: boolean;
}>;

export type R20LiquidationPreflightEvaluation = Readonly<{
  gateResults: readonly R20LiquidationPreflightGate[];
  finalDecision: R20LiquidationPreflightFinalDecision;
  recommendedRepresentation: R20LiquidationPreflightRepresentation | null;
}>;

export const R20_LIQUIDATION_PREFLIGHT_METADATA_ENDPOINT = "https://api.tardis.dev/v1/exchanges/binance-futures" as const;
export const R20_LIQUIDATION_PREFLIGHT_DOCUMENTATION_URLS = Object.freeze([
  "https://docs.tardis.dev/faq/data",
  "https://docs.tardis.dev/downloadable-csv-files/data-types",
  "https://docs.tardis.dev/downloadable-csv-files",
  "https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Liquidation-Order-Streams",
] as const);

function isTargetSymbol(symbol: string): boolean {
  return R20_LIQUIDATION_PREFLIGHT_SYMBOLS.includes(symbol as (typeof R20_LIQUIDATION_PREFLIGHT_SYMBOLS)[number]);
}

function isValidIso(value: string | null): boolean {
  return value !== null && Number.isFinite(Date.parse(value));
}

export function isR20LiquidationTargetCoverageSatisfied(
  coverage: R20LiquidationMetadataCoverage,
): boolean {
  const start = Date.parse(R20_LIQUIDATION_PREFLIGHT_START_ISO);
  const end = Date.parse(R20_LIQUIDATION_PREFLIGHT_END_ISO);
  return coverage.exchangeId === R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID
    && coverage.datasetType === "liquidations"
    && coverage.formats.includes("csv")
    && isValidIso(coverage.exportedFrom)
    && isValidIso(coverage.exportedUntil)
    && Date.parse(coverage.exportedFrom as string) <= start
    && Date.parse(coverage.exportedUntil as string) >= end
    && R20_LIQUIDATION_PREFLIGHT_SYMBOLS.every((symbol) => {
      const row = coverage.targetSymbolAvailability[symbol];
      return row !== undefined
        && row.liquidationDatasetAdvertised
        && isValidIso(row.availableSince)
        && Date.parse(row.availableSince as string) <= start
        && (row.availableTo === null || Date.parse(row.availableTo) >= end);
    });
}

export function isR20LiquidationPointInTimeContractSatisfied(
  evidence: readonly R20LiquidationRepresentationEvidence[],
): boolean {
  return evidence.length === R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS.length
    && evidence.every((row) => row.eventTimestampProven
      && row.publicationTimestampProven
      && row.fallbackTimestampRuleProven
      && row.dailySegmentationRuleProven
      && row.replayLeakageExcluded);
}

export function isR20LiquidationExactIdentityContractSatisfied(
  evidence: readonly R20LiquidationRepresentationEvidence[],
): boolean {
  return evidence.length === R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS.length
    && evidence.every((row) => row.immutableEventIdentityProven || row.sourceSequenceProven)
    && evidence.every((row) => !row.normalizedIdMayBeEmpty || row.sourceSequenceProven || row.immutableEventIdentityProven);
}

export function isR20LiquidationGapContractSatisfied(
  evidence: readonly R20LiquidationRepresentationEvidence[],
): boolean {
  return evidence.length === R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS.length
    && evidence.every((row) => row.gapEvidenceProven
      && row.completenessStatus === "SAMPLED_EVENT_STREAM");
}

export function isR20LiquidationSideSchemaContractSatisfied(
  evidence: readonly R20LiquidationRepresentationEvidence[],
): boolean {
  return evidence.length === R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS.length
    && evidence.every((row) => row.sideMappingProven && row.quantityMappingProven);
}

export function isR20LiquidationRevisionEntitlementContractSatisfied(
  evidence: readonly R20LiquidationRepresentationEvidence[],
): boolean {
  return evidence.length === R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS.length
    && evidence.every((row) => row.revisionPolicyProven && row.entitlementVerified);
}

function findRepresentation(
  evidence: readonly R20LiquidationRepresentationEvidence[],
  representation: R20LiquidationPreflightRepresentation,
): R20LiquidationRepresentationEvidence | undefined {
  return evidence.find((row) => row.representation === representation);
}

export function evaluateR20LiquidationPreflight(
  input: R20LiquidationPreflightInput,
): R20LiquidationPreflightEvaluation {
  const normalized = findRepresentation(input.representations, "TARDIS_NORMALIZED_LIQUIDATIONS_CSV");
  const raw = findRepresentation(input.representations, "TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY");
  const representationSetIsExact = input.representations.length === 2 && normalized !== undefined && raw !== undefined;
  const gates: R20LiquidationPreflightGate[] = [
    {
      id: "P01_ACCEPTED_SOURCE_DESIGN_INTEGRITY",
      status: input.acceptedSourceIntegrity
        && input.recommendedSourceUnchanged
        && !input.candidateCreated
        && input.performanceExecutionCount === 0
        ? "PASS" : "FAIL",
      reason: "Accepted research/design identity and design-only governance must remain exact.",
    },
    {
      id: "P02_TARGET_COVERAGE",
      status: isR20LiquidationTargetCoverageSatisfied(input.coverage) ? "PASS" : "FAIL",
      reason: "Metadata must cover liquidations for all five symbols and the complete frozen period.",
    },
    {
      id: "P03_POINT_IN_TIME_TIMESTAMP_PROVENANCE",
      status: representationSetIsExact && isR20LiquidationPointInTimeContractSatisfied(input.representations) ? "PASS" : "FAIL",
      reason: "Event and publication/arrival timestamp semantics must both be frozen for normalized and raw representations.",
    },
    {
      id: "P04_EXACT_EVENT_IDENTITY",
      status: representationSetIsExact && isR20LiquidationExactIdentityContractSatisfied(input.representations) ? "PASS" : "FAIL",
      reason: "Every representation must prove immutable event identity or source sequence; empty normalized id cannot be replaced by a weaker identity.",
    },
    {
      id: "P05_COMPLETENESS_SNAPSHOT_GAP_SEMANTICS",
      status: representationSetIsExact && isR20LiquidationGapContractSatisfied(input.representations) ? "PASS" : "FAIL",
      reason: "Snapshot sampling remains SAMPLED_EVENT_STREAM and disconnect/gap provenance must be proven for both representations.",
    },
    {
      id: "P06_SIDE_QUANTITY_SCHEMA_CONTRACT",
      status: representationSetIsExact && isR20LiquidationSideSchemaContractSatisfied(input.representations) ? "PASS" : "FAIL",
      reason: "Liquidation side, execution side, price, quantity, and forceOrder-to-normalized mapping must be source-documented.",
    },
    {
      id: "P07_REVISION_ARCHIVE_LICENSE_REPRODUCIBILITY_ENTITLEMENT",
      status: representationSetIsExact && isR20LiquidationRevisionEntitlementContractSatisfied(input.representations) ? "PASS" : "FAIL",
      reason: "Revision/checksum/reproducibility policy and access entitlement must be verified before acquisition.",
    },
  ];
  const allPassed = gates.every((gate) => gate.status === "PASS")
    && input.marketEventBodyRequests === 0
    && input.marketEventBytesDownloaded === 0
    && input.rawMarketEventsRead === false
    && input.performanceLedgerPresent === false
    && input.performanceExecutionCount === 0
    && input.economicValuesRead === false
    && input.economicValuesCalculated === false
    && input.economicValuesInspected === false
    && input.newMarketDataFetched === false
    && input.productionUnchanged === true
    && input.baseline002Status === "NOT_FROZEN"
    && input.m3JStatus === "BLOCKED"
    && input.m4Status === "NOT_STARTED"
    && input.automaticTrading === false;
  return {
    gateResults: gates,
    finalDecision: allPassed
      ? "ROUND-020 DATA ACQUISITION PREFLIGHT PASS"
      : "ROUND-020 DATA ACQUISITION INELIGIBLE",
    recommendedRepresentation: allPassed ? "TARDIS_NORMALIZED_LIQUIDATIONS_CSV" : null,
  };
}

export const R20_LIQUIDATION_PREFLIGHT_METADATA_ONLY_GOVERNANCE = Object.freeze({
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  candidateCreated: false,
  economicValuesRead: false,
  economicValuesCalculated: false,
  economicValuesInspected: false,
  rawMarketEventsRead: false,
  marketEventBytesDownloaded: 0,
  automaticTrading: false,
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
} as const);

export function isR20LiquidationPreflightMetadataOnly(
  input: Pick<R20LiquidationPreflightInput, "marketEventBodyRequests" | "marketEventBytesDownloaded" | "rawMarketEventsRead" | "performanceExecutionCount" | "performanceLedgerPresent" | "candidateCreated" | "economicValuesRead" | "economicValuesCalculated" | "economicValuesInspected" | "newMarketDataFetched">,
): boolean {
  return input.marketEventBodyRequests === 0
    && input.marketEventBytesDownloaded === 0
    && input.rawMarketEventsRead === false
    && input.performanceExecutionCount === 0
    && input.performanceLedgerPresent === false
    && input.candidateCreated === false
    && input.economicValuesRead === false
    && input.economicValuesCalculated === false
    && input.economicValuesInspected === false
    && input.newMarketDataFetched === false;
}

export function isR20LiquidationPreflightGovernanceSafe(
  input: Pick<R20LiquidationPreflightInput, "performanceExecutionCount" | "performanceLedgerPresent" | "candidateCreated" | "economicValuesRead" | "economicValuesCalculated" | "economicValuesInspected" | "newMarketDataFetched" | "productionUnchanged" | "baseline002Status" | "m3JStatus" | "m4Status" | "automaticTrading">,
): boolean {
  return input.performanceExecutionCount === 0
    && input.performanceLedgerPresent === false
    && input.candidateCreated === false
    && input.economicValuesRead === false
    && input.economicValuesCalculated === false
    && input.economicValuesInspected === false
    && input.newMarketDataFetched === false
    && input.productionUnchanged === true
    && input.baseline002Status === "NOT_FROZEN"
    && input.m3JStatus === "BLOCKED"
    && input.m4Status === "NOT_STARTED"
    && input.automaticTrading === false;
}

export function isR20LiquidationPreflightTargetSymbol(symbol: string): boolean {
  return isTargetSymbol(symbol);
}
