/**
 * Round-021 data-acquisition design protocol.
 *
 * This module is deliberately metadata-only. It defines the proof obligations
 * for a future acquisition preflight; it never fetches, parses, or derives a
 * market-data payload.
 */

export const R21_DATA_DESIGN_SCHEMA_VERSION = "m3-r21-positioning-crowding-data-design-001" as const;
export const R21_DATA_DESIGN_ROUND_ID = "baseline-002-research-round-021" as const;
export const R21_DATA_DESIGN_PHASE = "DATA_ACQUISITION_DESIGN_ONLY" as const;
export const R21_DATA_DESIGN_ACCEPTED_SOURCE = "7710eae9b69218bb157c5448209bcf2595199252" as const;
export const R21_DATA_DESIGN_ACCEPTED_SOURCE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R21_DATA_DESIGN_BRANCH = "research/round-021-positioning-crowding-data-design" as const;
export const R21_DATA_DESIGN_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R21_DATA_DESIGN_JSON_PATH = "docs/research/round-021-positioning-crowding-data-design.json" as const;
export const R21_DATA_DESIGN_MARKDOWN_PATH = "docs/research/round-021-positioning-crowding-data-design.md" as const;
export const R21_ACCEPTED_HYPOTHESIS_PATH = "docs/research/round-021-positioning-crowding-design.json" as const;
export const R21_ROUND020_CLOSURE_PATH = "docs/research/round-020-liquidation-data-preflight.json" as const;

export const R21_DATA_DESIGN_SOURCE_FAMILY = "BINANCE_VISION_USDM_METRICS_ARCHIVE" as const;
export const R21_DATA_DESIGN_SYMBOLS = Object.freeze([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const);
export const R21_DATA_DESIGN_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const R21_DATA_DESIGN_END_ISO = "2026-08-15T23:59:59.999Z" as const;

export const R21_USDM_MARKET_DATA_DOC_URL =
  "https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data" as const;
export const R21_USDM_CONNECTOR_EVIDENCE_COMMIT =
  "d30576a6d8e6edb706c8b013eb11167b58e9c33a" as const;
export const R21_USDM_CONNECTOR_EVIDENCE_PATH = "binance/um_futures/market.py" as const;
export const R21_USDM_CONNECTOR_EVIDENCE_DATE = "2022-08-29" as const;
export const R21_USDM_ENDPOINTS = Object.freeze([
  "/futures/data/globalLongShortAccountRatio",
  "/futures/data/topLongShortAccountRatio",
  "/futures/data/topLongShortPositionRatio",
] as const);
export const R21_USDM_PERIODS = Object.freeze([
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "12h",
  "1d",
] as const);

export const R21_DATA_DESIGN_HYPOTHESIS_ID = "R21-TOP-TRADER-POSITION-CONCENTRATION-UNWIND" as const;
export const R21_DATA_DESIGN_MECHANISM_FAMILY = "POSITIONING_CROWDING_STATE" as const;
export const R21_DATA_DESIGN_DIRECTIONAL_THESIS = "CONTRARIAN CROWD-UNWIND" as const;
export const R21_DATA_DESIGN_INPUTS = Object.freeze([
  "topTraderAccountLongShortRatio",
  "topTraderPositionLongShortRatio",
  "globalAccountLongShortRatio",
] as const);
export const R21_DATA_DESIGN_SOURCE_FIELDS = Object.freeze([
  "count_toptrader_long_short_ratio",
  "sum_toptrader_long_short_ratio",
  "count_long_short_ratio",
] as const);
export const R21_DATA_DESIGN_LONG_PREDICATE = "P > 0 && P > A && A > G" as const;
export const R21_DATA_DESIGN_SHORT_PREDICATE = "P < 0 && P < A && A < G" as const;

export const R21_REQUIRED_DECISION_CADENCE = "1h" as const;
export const R21_REQUIRED_PRIMARY_HOLDING_HORIZON = "4h" as const;
export const R21_MAX_NATIVE_CADENCE_MINUTES = 60 as const;

export const R21_DATA_DESIGN_GATE_IDS = Object.freeze([
  "A01_ACCEPTED_SOURCE",
  "A02_SINGLE_SOURCE_FAMILY",
  "A03_OFFICIAL_FIELD_MAPPING",
  "A04_CONTEMPORANEOUS_PIT_AVAILABILITY",
  "A05_NATIVE_CADENCE_AND_HORIZON",
  "A06_COVERAGE_AND_CONTINUITY_CONTRACT",
  "A07_REPRODUCIBILITY_CONTRACT",
  "A08_ZERO_ECONOMIC_READ",
  "A09_GOVERNANCE",
] as const);
export type R21DataDesignGateId = (typeof R21_DATA_DESIGN_GATE_IDS)[number];
export type R21DataDesignGateStatus = "PASS" | "FAIL";
export type R21DataDesignFinalDecision =
  | "ROUND-021 DATA ACQUISITION DESIGN ACCEPTED"
  | "ROUND-021 DATA ACQUISITION DESIGN INELIGIBLE";

export type R21DataDesignGovernance = Readonly<{
  newMarketDataFetched: false;
  marketDataPayloadDownloaded: false;
  preflightExecuted: false;
  performanceExecuted: false;
  selectionExecuted: false;
  economicValuesRead: false;
  forwardReturnsRead: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  productionUnchanged: true;
  baseline001Unchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
}>;

export const R21_DATA_DESIGN_GOVERNANCE: R21DataDesignGovernance = Object.freeze({
  newMarketDataFetched: false,
  marketDataPayloadDownloaded: false,
  preflightExecuted: false,
  performanceExecuted: false,
  selectionExecuted: false,
  economicValuesRead: false,
  forwardReturnsRead: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  productionUnchanged: true,
  baseline001Unchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  automaticTrading: false,
});

export type R21DataDesignGateResult = Readonly<{
  id: R21DataDesignGateId;
  status: R21DataDesignGateStatus;
  reason: string;
}>;

export type R21DataDesignEvaluation = Readonly<{
  gateResults: readonly R21DataDesignGateResult[];
  finalDecision: R21DataDesignFinalDecision;
  nextStage: "DATA_ACQUISITION_PREFLIGHT" | "STOP";
  performanceAuthorized: false;
  selectionAuthorized: false;
}>;

export type R21DataDesignGateInputs = Readonly<{
  acceptedSourceCommit: string;
  sourceFamily: string;
  archiveFieldMappingProven: boolean;
  usdMEndpointDocumentationProven: boolean;
  usdMSemanticSeriesProven: boolean;
  usdMSupportedPeriodsProven: boolean;
  usdMPeriodTimestampSemanticsProven: boolean;
  historicalEndpointExistenceProven: boolean;
  periodEndTimestampSemanticsProven: boolean;
  archiveNextDayReleaseProven: boolean;
  archiveToLiveSeriesEquivalenceProven: boolean;
  publicationLatencyUpperBoundProven: boolean;
  decisionTimeAvailabilityRuleProven: boolean;
  archiveNativeCadenceMinutes: number | null;
  archiveNativeCadenceProven: boolean;
  symbolUniverseComplete: boolean;
  observationContractComplete: boolean;
  duplicateContractComplete: boolean;
  coverageContractComplete: boolean;
  reproducibilityContractComplete: boolean;
  governance: R21DataDesignGovernance;
}>;

export type R21DuplicateClassification =
  | "PRESENT_UNIQUE"
  | "MISSING"
  | "EXACT_DUPLICATE"
  | "CONFLICTING_DUPLICATE"
  | "INVALID_ROW";

export type R21MetricRow = Readonly<{
  timestamp: number;
  topTraderAccountLongShortRatio: number;
  topTraderPositionLongShortRatio: number;
  globalAccountLongShortRatio: number;
}>;

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidMetricRow(value: unknown): value is R21MetricRow {
  if (value === null || typeof value !== "object") return false;
  const row = value as Partial<R21MetricRow>;
  return (
    typeof row.timestamp === "number" &&
    Number.isInteger(row.timestamp) &&
    row.timestamp >= 0 &&
    isFinitePositive(row.topTraderAccountLongShortRatio) &&
    isFinitePositive(row.topTraderPositionLongShortRatio) &&
    isFinitePositive(row.globalAccountLongShortRatio)
  );
}

/** Classifies only identity/row-shape duplication; it does not inspect outcomes. */
export function classifyR21MetricRow(
  existingRows: readonly R21MetricRow[],
  incomingRow: unknown,
): R21DuplicateClassification {
  if (incomingRow === null || incomingRow === undefined) return "MISSING";
  if (!isValidMetricRow(incomingRow)) return "INVALID_ROW";

  const matchingTimestampRows = existingRows.filter((row) => row.timestamp === incomingRow.timestamp);
  if (matchingTimestampRows.length === 0) return "PRESENT_UNIQUE";

  const isExact = matchingTimestampRows.every(
    (row) =>
      row.topTraderAccountLongShortRatio === incomingRow.topTraderAccountLongShortRatio &&
      row.topTraderPositionLongShortRatio === incomingRow.topTraderPositionLongShortRatio &&
      row.globalAccountLongShortRatio === incomingRow.globalAccountLongShortRatio,
  );
  return isExact ? "EXACT_DUPLICATE" : "CONFLICTING_DUPLICATE";
}

/** Cadence can be frozen only after authoritative source evidence exists. */
export function isR21CadenceEligible(nativeCadenceMinutes: number | null, authoritative: boolean): boolean {
  return (
    authoritative &&
    typeof nativeCadenceMinutes === "number" &&
    Number.isFinite(nativeCadenceMinutes) &&
    nativeCadenceMinutes > 0 &&
    nativeCadenceMinutes <= R21_MAX_NATIVE_CADENCE_MINUTES
  );
}

export function isR21DataDesignOnlyGovernance(governance: R21DataDesignGovernance): boolean {
  return (
    governance.newMarketDataFetched === false &&
    governance.marketDataPayloadDownloaded === false &&
    governance.preflightExecuted === false &&
    governance.performanceExecuted === false &&
    governance.selectionExecuted === false &&
    governance.economicValuesRead === false &&
    governance.forwardReturnsRead === false &&
    governance.performanceExecutionCount === 0 &&
    governance.performanceLedgerPresent === false &&
    governance.productionUnchanged === true &&
    governance.baseline001Unchanged === true &&
    governance.baseline002Status === "NOT_FROZEN" &&
    governance.m3JStatus === "BLOCKED" &&
    governance.m4Status === "NOT_STARTED" &&
    governance.automaticTrading === false
  );
}

export function evaluateR21DataDesignGates(input: R21DataDesignGateInputs): R21DataDesignEvaluation {
  const cadenceEligible = isR21CadenceEligible(input.archiveNativeCadenceMinutes, input.archiveNativeCadenceProven);
  const liveSeriesDocumentationProven =
    input.usdMEndpointDocumentationProven &&
    input.usdMSemanticSeriesProven &&
    input.usdMSupportedPeriodsProven &&
    input.usdMPeriodTimestampSemanticsProven;
  const contemporaneousAvailabilityProven =
    input.historicalEndpointExistenceProven &&
    input.periodEndTimestampSemanticsProven &&
    input.archiveNextDayReleaseProven &&
    input.archiveToLiveSeriesEquivalenceProven &&
    input.publicationLatencyUpperBoundProven &&
    input.decisionTimeAvailabilityRuleProven;
  const gateResults: R21DataDesignGateResult[] = [
    {
      id: "A01_ACCEPTED_SOURCE",
      status: input.acceptedSourceCommit === R21_DATA_DESIGN_ACCEPTED_SOURCE ? "PASS" : "FAIL",
      reason: "The design must bind to the exact accepted research-chain commit.",
    },
    {
      id: "A02_SINGLE_SOURCE_FAMILY",
      status: input.sourceFamily === R21_DATA_DESIGN_SOURCE_FAMILY ? "PASS" : "FAIL",
      reason: "Only the official Binance Vision USD-M metrics archive is admissible.",
    },
    {
      id: "A03_OFFICIAL_FIELD_MAPPING",
      status: input.archiveFieldMappingProven ? "PASS" : "FAIL",
      reason: input.archiveFieldMappingProven
        ? "Exact archive-field-to-live-series mapping is proven by Tier-1 evidence."
        : liveSeriesDocumentationProven
          ? "USD-M live-series semantics are proven, but exact Binance Vision archive-field-to-live-series mapping lacks Tier-1 proof."
          : "USD-M live-series documentation is incomplete and exact archive-field mapping is not proven.",
    },
    {
      id: "A04_CONTEMPORANEOUS_PIT_AVAILABILITY",
      status: contemporaneousAvailabilityProven ? "PASS" : "FAIL",
      reason: contemporaneousAvailabilityProven
        ? "Historical endpoint existence, archive/live equivalence, and the availability-lag contract are proven."
        : "The USD-M series existed before the target start and period-end timestamps are documented, but no Tier-1 proof establishes exact archive/live-series equivalence plus a historical publication-latency bound sufficient to guarantee publicationAvailableTime <= decisionTime.",
    },
    {
      id: "A05_NATIVE_CADENCE_AND_HORIZON",
      status: cadenceEligible ? "PASS" : "FAIL",
      reason: cadenceEligible
        ? "The archive native cadence is authoritatively proven at or below one hour."
        : "Live endpoint period options are proven, but the native cadence of the Binance Vision USD-M metrics archive is not yet proven by Tier-1 archive documentation without reading market-data payloads.",
    },
    {
      id: "A06_COVERAGE_AND_CONTINUITY_CONTRACT",
      status:
        input.symbolUniverseComplete &&
        input.observationContractComplete &&
        input.duplicateContractComplete &&
        input.coverageContractComplete
          ? "PASS"
          : "FAIL",
      reason: "The five-symbol identity, duplicate, missingness, and coverage rules must be complete and fail-closed.",
    },
    {
      id: "A07_REPRODUCIBILITY_CONTRACT",
      status: input.reproducibilityContractComplete ? "PASS" : "FAIL",
      reason: "Object identity, checksum, revision, and manifest rules must make a future acquisition reproducible.",
    },
    {
      id: "A08_ZERO_ECONOMIC_READ",
      status: isR21DataDesignOnlyGovernance(input.governance) ? "PASS" : "FAIL",
      reason: "Design validation is metadata-only and cannot read forward or economic values.",
    },
    {
      id: "A09_GOVERNANCE",
      status: isR21DataDesignOnlyGovernance(input.governance) ? "PASS" : "FAIL",
      reason: "No acquisition, preflight, performance, selection, production, or trading operation is authorized.",
    },
  ];

  const allPass = gateResults.every((gate) => gate.status === "PASS");
  return {
    gateResults,
    finalDecision: allPass
      ? "ROUND-021 DATA ACQUISITION DESIGN ACCEPTED"
      : "ROUND-021 DATA ACQUISITION DESIGN INELIGIBLE",
    nextStage: allPass ? "DATA_ACQUISITION_PREFLIGHT" : "STOP",
    performanceAuthorized: false,
    selectionAuthorized: false,
  };
}
