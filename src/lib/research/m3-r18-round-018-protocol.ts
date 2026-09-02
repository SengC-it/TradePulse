export const ROUND_018_RESEARCH_ROUND_ID = "baseline-002-research-round-018" as const;
export const ROUND_018_PHASE = "DESIGN_ONLY" as const;
export const ROUND_018_ACCEPTED_SOURCE = "e10d1bdc90f841ba647172c05b2a19717ec6b28b" as const;
export const ROUND_018_ACCEPTED_SOURCE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_018_BOUNDARY_END = "2026-08-15T23:59:59.999Z" as const;
export const ROUND_018_OBSERVATION_SOURCE =
  ".cache/tradepulse/round-014/observations.ndjson" as const;
export const ROUND_018_OBSERVATION_COUNT = 244_810 as const;
export const ROUND_018_OBSERVATION_SHA256 =
  "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359" as const;

export const ROUND_018_UNIVERSE = Object.freeze([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const);

export const ROUND_018_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export const ROUND_018_FOLDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);
export const ROUND_018_PRIMARY_HORIZON_HOURS = 4 as const;
export const ROUND_018_BACKTEST_POLICY_VERSION = "bt-policy-003" as const;

export const ROUND_018_SCORE_COMPONENTS = Object.freeze([
  "trendStrength",
  "pullbackQuality",
  "breakoutStrength",
  "volumeScore",
  "riskRewardScore",
] as const);

export const ROUND_018_SCORE_COMPONENT_WEIGHTS = Object.freeze({
  trendStrength: 40,
  pullbackQuality: 20,
  breakoutStrength: 20,
  volumeScore: 10,
  riskRewardScore: 10,
} as const);

export const ROUND_018_FORMAL_PREDICATE =
  "candidate?.formalSignal && candidate.totalScore >= 70" as const;
export const ROUND_018_GRADE_C_THRESHOLD = 70 as const;
export const ROUND_018_ACTIVE_HYPOTHESIS_ID = "R18-ALL-COMPONENT-CONSENSUS" as const;
export const ROUND_018_CANDIDATE_RULE_ID =
  "ALL_FIVE_EXISTING_SCORE_COMPONENTS_STRICTLY_POSITIVE" as const;
export const ROUND_018_CANDIDATE_RULE = Object.freeze({
  trendStrength: "> 0",
  pullbackQuality: "> 0",
  breakoutStrength: "> 0",
  volumeScore: "> 0",
  riskRewardScore: "> 0",
} as const);

export const ROUND_018_REGIMES = Object.freeze([
  "BTC_STRONG_BULL",
  "BTC_NEUTRAL",
  "BTC_STRONG_BEAR",
] as const);

export const ROUND_018_STRUCTURAL_GATES = Object.freeze([
  "G01_DATA_PROVENANCE",
  "G02_POINT_IN_TIME",
  "G03_AGGREGATE_BREADTH",
  "G04_FOLD_BREADTH",
  "G05_SYMBOL_BREADTH",
  "G06_REGIME_BREADTH",
  "G07_STRUCTURAL_DISCRIMINATION",
] as const);

export const ROUND_018_PERFORMANCE_GATES = Object.freeze([
  "G08_ABSOLUTE_H4_EDGE",
  "G09_H4_PROFIT_FACTOR",
  "G10_INCREMENTAL_H4_EDGE",
  "G11_FOLD_INCREMENTAL_ROBUSTNESS",
  "G12_FOLD_ABSOLUTE_ROBUSTNESS",
  "G13_COST_STRESS",
  "G14_LATENCY_STRESS",
  "G15_DRAWDOWN_NON_DEGRADATION",
] as const);

export const ROUND_018_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS = 1 as const;
export const ROUND_018_PERFORMANCE_LEDGER_PATH =
  "docs/research/round-018-performance-ledger.json" as const;

export type Round018DesignOnlyStatus = Readonly<{
  phase: typeof ROUND_018_PHASE;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  performanceExecuted: false;
  selectionExecuted: false;
  economicValuesCalculated: false;
  economicValuesViewed: false;
  newMarketDataFetched: false;
  productionUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
}>;

export function isRound018DesignOnlyStatus(status: Round018DesignOnlyStatus): boolean {
  return (
    status.phase === ROUND_018_PHASE &&
    status.performanceExecutionCount === 0 &&
    status.performanceLedgerPresent === false &&
    status.performanceExecuted === false &&
    status.selectionExecuted === false &&
    status.economicValuesCalculated === false &&
    status.economicValuesViewed === false &&
    status.newMarketDataFetched === false &&
    status.productionUnchanged === true &&
    status.baseline002Status === "NOT_FROZEN" &&
    status.m3JStatus === "BLOCKED" &&
    status.m4Status === "NOT_STARTED" &&
    status.automaticTrading === false
  );
}
