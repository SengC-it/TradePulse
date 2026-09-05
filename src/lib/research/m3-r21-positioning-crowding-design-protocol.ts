export const ROUND_021_SCHEMA_VERSION = "m3-r21-positioning-crowding-design-001" as const;
export const ROUND_021_RESEARCH_ROUND_ID = "baseline-002-research-round-021" as const;
export const ROUND_021_PHASE = "HYPOTHESIS_DESIGN_ONLY" as const;
export const ROUND_021_ACCEPTED_SOURCE = "3b12136faf9219070609174ca4af226c07f15a9e" as const;
export const ROUND_021_ACCEPTED_SOURCE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_021_BRANCH = "research/round-021-positioning-crowding-design" as const;
export const ROUND_021_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_021_DESIGN_JSON_PATH = "docs/research/round-021-positioning-crowding-design.json" as const;
export const ROUND_021_DESIGN_MARKDOWN_PATH = "docs/research/round-021-positioning-crowding-design.md" as const;
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
  "R13_DIRECTIONAL_RETURN_TREND_MOMENTUM",
  "R13_R14_CANDLE_BODY_DIRECTION_REVERSAL",
  "R14_VOLATILITY_RANGE_COMPRESSION",
  "R14_VOLUME",
  "R15_BETA_ALPHA",
  "R16_AGGREGATE_OPEN_INTEREST",
  "R16_FUNDING_CARRY",
  "R16_TAKER_FLOW",
  "R16_PRICE_RETURN_MOMENTUM",
  "R16_EMA_ATR_VOLATILITY_BASIS",
  "R16_SYMBOL_RELATIVE_TO_BTC",
  "R17_LIFECYCLE_STATE_DEDUP",
  "R18_COMPONENT_CONSENSUS_REWEIGHTING",
  "R18_SCORE_GRADE_THRESHOLD",
  "R18_REGIME_OR_HORIZON_RESCUE",
  "R20_FORCED_LIQUIDATION_EVENT",
] as const);

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

export type R21DesignGateInput = Readonly<{
  acceptedSourceCommit: string;
  mechanismFamily: string;
  mechanismFamilyIndependent: boolean;
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
      status: input.mechanismFamily === ROUND_021_MECHANISM_FAMILY && input.mechanismFamilyIndependent ? "PASS" : "FAIL",
      reason: "Position-size distribution and participant crowding are distinct from R13-R20 signal families.",
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
    finalDecision: accepted
      ? "ROUND-021 POSITIONING CROWDING HYPOTHESIS DESIGN ACCEPTED"
      : "ROUND-021 NO ADMISSIBLE POSITIONING CROWDING HYPOTHESIS",
    nextStage: accepted ? "DATA_ACQUISITION_DESIGN" : "STOP",
  };
}
