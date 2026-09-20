export const ROUND_021_SCHEMA_VERSION = "m3-r21-positioning-crowding-design-001" as const;
export const ROUND_021_RESEARCH_ROUND_ID = "baseline-002-research-round-021" as const;
export const ROUND_021_PHASE = "HYPOTHESIS_DESIGN_ONLY" as const;
export const ROUND_021_ACCEPTED_SOURCE = "3b12136faf9219070609174ca4af226c07f15a9e" as const;
export const ROUND_021_ACCEPTED_SOURCE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_021_BRANCH = "research/round-021-positioning-crowding-design" as const;
export const ROUND_021_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_021_DESIGN_JSON_PATH = "docs/research/round-021-positioning-crowding-design.json" as const;
export const ROUND_021_DESIGN_MARKDOWN_PATH = "docs/research/round-021-positioning-crowding-design.md" as const;
export const R21_AUTHORITATIVE_MECHANISM_LEDGER_PATH = "docs/research/round-020-space-reset.json" as const;
export const R21_AUTHORITATIVE_MECHANISM_LEDGER_FIELD = "mechanismFamilyLedger[].mechanismFamilyId" as const;
export const R21_ROUND020_CLOSURE_PATH = "docs/research/round-020-liquidation-data-preflight.json" as const;
export const ROUND_021_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const ROUND_021_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;

export const ROUND_021_MECHANISM_FAMILY = "POSITIONING_CROWDING_STATE" as const;
export const ROUND_021_HYPOTHESIS_ID = "R21-TOP-TRADER-POSITION-CONCENTRATION-UNWIND" as const;
export const ROUND_021_DIRECTIONAL_THESIS = "CONTRARIAN CROWD-UNWIND" as const;

export const R21_SYMBOLS = Object.freeze([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const);
export type R21Symbol = (typeof R21_SYMBOLS)[number];

export const R21_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export type R21Direction = (typeof R21_DIRECTIONS)[number];

export const R21_SIGNAL_INPUTS = Object.freeze([
  "topTraderAccountLongShortRatio",
  "topTraderPositionLongShortRatio",
  "globalAccountLongShortRatio",
] as const);
export type R21SignalInput = (typeof R21_SIGNAL_INPUTS)[number];

export const R21_SOURCE_METRIC_CANDIDATES = Object.freeze([
  "count_toptrader_long_short_ratio",
  "sum_toptrader_long_short_ratio",
  "count_long_short_ratio",
] as const);

export const R21_SOURCE_FAMILY = "BINANCE_VISION_USDM_METRICS_ARCHIVE" as const;
export const R21_SOURCE_FIELD_MAPPING_STATUS = "REQUIRES_SOURCE_DOCUMENTATION_PROOF" as const;
export const R21_PUBLICATION_PROVENANCE_STATUS = "REQUIRES_DATA_ACQUISITION_DESIGN_PROOF" as const;
export const R21_DECISION_CADENCE = "NOT_YET_FROZEN_PENDING_SOURCE_CADENCE" as const;
export const R21_PRIMARY_HOLDING_HORIZON = "NOT_YET_FROZEN_PENDING_SOURCE_CADENCE" as const;

export const R21_LONG_CROWD_PREDICATE = "P > 0 && P > A && A > G" as const;
export const R21_SHORT_CROWD_PREDICATE = "P < 0 && P < A && A < G" as const;
export const R21_SIGNAL_PREDICATE = Object.freeze({
  longCrowd: R21_LONG_CROWD_PREDICATE,
  shortCrowd: R21_SHORT_CROWD_PREDICATE,
  longCrowdAdvisoryDirection: "SHORT",
  shortCrowdAdvisoryDirection: "LONG",
  otherwise: "NO_SIGNAL",
} as const);

export const R21_DESIGN_GATE_IDS = Object.freeze([
  "D01_SOURCE_INTEGRITY",
  "D02_NOVEL_FAMILY",
  "D03_ONE_HYPOTHESIS",
  "D04_ZERO_TUNED_STRUCTURE",
  "D05_DATA_CONTRACT",
  "D06_PIT_FAIL_CLOSED",
  "D07_GOVERNANCE",
] as const);
export type R21DesignGateId = (typeof R21_DESIGN_GATE_IDS)[number];

export const R21_EXCLUDED_PRIOR_INFORMATION_FAMILIES = Object.freeze([
  "R13_TREND",
  "R13_EMA_STATE",
  "R13_SHORT_MEDIUM_RETURN_MOMENTUM",
  "R13_VOLATILITY_ATR",
  "R13_VOLUME",
  "R13_TAKER_IMBALANCE",
  "R13_SYMBOL_VS_BTC_RELATIVE_RETURN",
  "R13_FUNDING",
  "R13_CROSS_SYMBOL_BREADTH",
  "R13_RIDGE_FEATURE_COMBINATION_FORWARD_EDGE",
  "R14_EXACT_R13_REPLAY",
  "R15_BETA_ALPHA_DECOMPOSITION",
  "R15_MARKET_RELATIVE_DIRECTIONAL_STRUCTURE",
  "R16_OPEN_INTEREST",
  "R16_MARK_INDEX_BASIS",
  "R16_TAKER_FLOW_PERSISTENCE",
  "R17_THESIS_LIFECYCLE",
  "R17_FIRST_FOLLOW_UP_STATE",
  "R17_DEDUP_PERSISTENCE",
  "R17_SESSION_CALENDAR",
  "R18_SCORE_COMPONENT_CONSENSUS",
  "R18_5_OF_5_CONSENSUS",
  "R18_4_OF_5_CONSENSUS",
  "R18_3_OF_5_CONSENSUS",
  "R18_SCORE_THRESHOLD",
  "R18_GRADE",
  "R18_COMPONENT_REWEIGHTING",
  "R18_COMPRESSION_EXPANSION_REPACKAGING",
  "R19_PRIOR_CANDLE_COUNTER_MOVE",
  "R19_STATE_TRANSITION",
  "R19_MARKET_RELATIVE_CONFIRMATION",
  "R19_CALENDAR_SESSION",
  "R19_RANGE_EXPANSION",
] as const);
export const R21_ROUND020_LIQUIDATION_MECHANISM_FAMILY = "FORCED_DELEVERAGING_LIQUIDATION_STATE" as const;

export type R21DesignGovernance = Readonly<{
  newMarketDataFetched: false;
  marketDataPayloadDownloaded: false;
  preflightExecuted: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  performanceAuthorized: false;
  performanceExecuted: false;
  selectionExecuted: false;
  economicValuesRead: false;
  economicValuesCalculated: false;
  economicValuesInspected: false;
  productionUnchanged: true;
  baseline001Unchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
}>;

export const R21_DESIGN_GOVERNANCE: R21DesignGovernance = Object.freeze({
  newMarketDataFetched: false,
  marketDataPayloadDownloaded: false,
  preflightExecuted: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  performanceAuthorized: false,
  performanceExecuted: false,
  selectionExecuted: false,
  economicValuesRead: false,
  economicValuesCalculated: false,
  economicValuesInspected: false,
  productionUnchanged: true,
  baseline001Unchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  automaticTrading: false,
});

export type R21PositioningRatios = Readonly<{
  topTraderAccountLongShortRatio: number;
  topTraderPositionLongShortRatio: number;
  globalAccountLongShortRatio: number;
}>;

export type R21AdvisoryDirection = R21Direction | "NO_SIGNAL";

export function isR21PositioningRatioInput(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
export function classifyR21PositionCrowding(input: R21PositioningRatios): R21AdvisoryDirection {
  if (!R21_SIGNAL_INPUTS.every((name) => isR21PositioningRatioInput(input[name]))) {
    return "NO_SIGNAL";
  }

  const A = Math.log(input.topTraderAccountLongShortRatio);
  const P = Math.log(input.topTraderPositionLongShortRatio);
  const G = Math.log(input.globalAccountLongShortRatio);

  if (P > 0 && P > A && A > G) {
    return "SHORT";
  }
  if (P < 0 && P < A && A < G) {
    return "LONG";
  }
  return "NO_SIGNAL";
}

export type R21Round020ClosureBinding = Readonly<{
  sourceCommit: string;
  sourcePath: string;
  mechanismFamilyId: string;
  finalDecision: string;
  recommendedRepresentation: null;
}>;

export type R21AuthoritativeLedgerCoverage = Readonly<{
  authoritativeIds: readonly string[];
  coveredIds: readonly string[];
  missingIds: readonly string[];
  duplicateIds: readonly string[];
  unknownIds: readonly string[];
  complete: boolean;
}>;

export function auditR21AuthoritativeLedgerCoverage(
  authoritativeIds: readonly string[],
  coveredIds: readonly string[],
): R21AuthoritativeLedgerCoverage {
  const authoritativeSet = new Set(authoritativeIds);
  const coveredSet = new Set(coveredIds);
  const counts = new Map<string, number>();
  for (const id of coveredIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  const missingIds = authoritativeIds.filter((id) => !coveredSet.has(id));
  const duplicateIds = [...counts.entries()]
    .filter(([, count]) => count !== 1)
    .map(([id]) => id);
  const unknownIds = coveredIds.filter((id) => !authoritativeSet.has(id));
  const complete = authoritativeIds.length > 0
    && coveredIds.length === authoritativeIds.length
    && missingIds.length === 0
    && duplicateIds.length === 0
    && unknownIds.length === 0
    && coveredSet.size === authoritativeSet.size;

  return {
    authoritativeIds,
    coveredIds,
    missingIds,
    duplicateIds,
    unknownIds,
    complete,
  };
}

export function isR21Round020ClosureComplete(binding: R21Round020ClosureBinding): boolean {
  return binding.sourceCommit === ROUND_021_ACCEPTED_SOURCE
    && binding.sourcePath === R21_ROUND020_CLOSURE_PATH
    && binding.mechanismFamilyId === R21_ROUND020_LIQUIDATION_MECHANISM_FAMILY
    && binding.finalDecision === "ROUND-020 DATA ACQUISITION INELIGIBLE"
    && binding.recommendedRepresentation === null;
}

export type R21DesignGateInput = Readonly<{
  acceptedSourceCommit: string;
  mechanismFamily: string;
  authoritativePriorLedgerIds: readonly string[];
  coveredAuthoritativeIds: readonly string[];
  round020Closure: R21Round020ClosureBinding;
  activeHypothesisCount: number;
  hypothesisId: string;
  directionalThesis: string;
  longPredicate: string;
  shortPredicate: string;
  zeroTunedStructure: boolean;
  signalInputs: readonly string[];
  sourceFieldMappingStatus: string;
  publicationProvenanceStatus: string;
  performanceAuthorized: boolean;
  governance: R21DesignGovernance;
}>;

export type R21DesignGate = Readonly<{
  id: R21DesignGateId;
  status: "PASS" | "FAIL";
  reason: string;
}>;

export type R21DesignEvaluation = Readonly<{
  gateResults: readonly R21DesignGate[];
  authoritativePriorLedgerCoverageComplete: boolean;
  round020ClosureCoverageComplete: boolean;
  finalDecision:
    | "ROUND-021 POSITIONING CROWDING HYPOTHESIS DESIGN ACCEPTED"
    | "ROUND-021 NO ADMISSIBLE POSITIONING CROWDING HYPOTHESIS";
  nextStage: "DATA_ACQUISITION_DESIGN" | "STOP";
}>;

export function isR21DesignOnlyGovernance(status: R21DesignGovernance): boolean {
  return status.newMarketDataFetched === false
    && status.marketDataPayloadDownloaded === false
    && status.preflightExecuted === false
    && status.performanceExecutionCount === 0
    && status.performanceLedgerPresent === false
    && status.performanceAuthorized === false
    && status.performanceExecuted === false
    && status.selectionExecuted === false
    && status.economicValuesRead === false
    && status.economicValuesCalculated === false
    && status.economicValuesInspected === false
    && status.productionUnchanged === true
    && status.baseline001Unchanged === true
    && status.baseline002Status === "NOT_FROZEN"
    && status.m3JStatus === "BLOCKED"
    && status.m4Status === "NOT_STARTED"
    && status.automaticTrading === false;
}

export function evaluateR21DesignGates(input: R21DesignGateInput): R21DesignEvaluation {
  const ledgerCoverage = auditR21AuthoritativeLedgerCoverage(
    input.authoritativePriorLedgerIds,
    input.coveredAuthoritativeIds,
  );
  const round020ClosureCoverageComplete = isR21Round020ClosureComplete(input.round020Closure);
  const exactInputs = input.signalInputs.length === R21_SIGNAL_INPUTS.length
    && new Set(input.signalInputs).size === R21_SIGNAL_INPUTS.length
    && R21_SIGNAL_INPUTS.every((name) => input.signalInputs.includes(name));
  const gateResults: R21DesignGate[] = [
    {
      id: "D01_SOURCE_INTEGRITY",
      status: input.acceptedSourceCommit === ROUND_021_ACCEPTED_SOURCE ? "PASS" : "FAIL",
      reason: "The design is bound to the single accepted research-chain commit.",
    },
    {
      id: "D02_NOVEL_FAMILY",
      status: input.mechanismFamily === ROUND_021_MECHANISM_FAMILY
        && ledgerCoverage.complete
        && round020ClosureCoverageComplete ? "PASS" : "FAIL",
      reason: "D02 requires exact accepted R13-R19 ledger coverage and a separately bound, closed Round-020 liquidation record; no self-attested independence flag is sufficient.",
    },
    {
      id: "D03_ONE_HYPOTHESIS",
      status: input.activeHypothesisCount === 1 && input.hypothesisId === ROUND_021_HYPOTHESIS_ID && input.directionalThesis === ROUND_021_DIRECTIONAL_THESIS ? "PASS" : "FAIL",
      reason: "Exactly one contrarian crowd-unwind hypothesis is frozen.",
    },
    {
      id: "D04_ZERO_TUNED_STRUCTURE",
      status: input.longPredicate === R21_LONG_CROWD_PREDICATE
        && input.shortPredicate === R21_SHORT_CROWD_PREDICATE
        && input.zeroTunedStructure ? "PASS" : "FAIL",
      reason: "The predicate uses only sign and ordinal ordering; no tuned magnitude threshold is allowed.",
    },
    {
      id: "D05_DATA_CONTRACT",
      status: exactInputs && input.sourceFieldMappingStatus === R21_SOURCE_FIELD_MAPPING_STATUS ? "PASS" : "FAIL",
      reason: "Exactly three positioning primitives are frozen while archive mapping remains an explicit proof obligation.",
    },
    {
      id: "D06_PIT_FAIL_CLOSED",
      status: input.publicationProvenanceStatus === R21_PUBLICATION_PROVENANCE_STATUS && input.performanceAuthorized === false ? "PASS" : "FAIL",
      reason: "Unproven publication provenance is fail-closed and cannot authorize performance.",
    },
    {
      id: "D07_GOVERNANCE",
      status: isR21DesignOnlyGovernance(input.governance) ? "PASS" : "FAIL",
      reason: "Design-only governance forbids acquisition, preflight, performance, selection, economics, and production changes.",
    },
  ];
  const accepted = gateResults.every((gate) => gate.status === "PASS");
  return {
    gateResults,
    authoritativePriorLedgerCoverageComplete: ledgerCoverage.complete,
    round020ClosureCoverageComplete,
    finalDecision: accepted
      ? "ROUND-021 POSITIONING CROWDING HYPOTHESIS DESIGN ACCEPTED"
      : "ROUND-021 NO ADMISSIBLE POSITIONING CROWDING HYPOTHESIS",
    nextStage: accepted ? "DATA_ACQUISITION_DESIGN" : "STOP",
  };
}
