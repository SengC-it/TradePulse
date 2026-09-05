export const ROUND_022_SCHEMA_VERSION = "m3-r22-signal-quality-design-001" as const;
export const ROUND_022_RESEARCH_ROUND_ID = "baseline-002-research-round-022" as const;
export const ROUND_022_PHASE = "SIGNAL_QUALITY_RISK_ADVISORY_DESIGN_ONLY" as const;
export const ROUND_022_ACCEPTED_SOURCE = "1a8b9c04c9dc9fa6614a7114a01addc4c6744579" as const;
export const ROUND_022_ACCEPTED_SOURCE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_022_BRANCH = "research/round-022-signal-quality-design" as const;
export const ROUND_022_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_022_DESIGN_JSON_PATH = "docs/research/round-022-signal-quality-design.json" as const;
export const ROUND_022_DESIGN_MARKDOWN_PATH = "docs/research/round-022-signal-quality-design.md" as const;

export const R22_DIRECTION_VALUES = Object.freeze(["LONG", "SHORT", "NO_SIGNAL"] as const);
export type R22Direction = (typeof R22_DIRECTION_VALUES)[number];

export const R22_QUALITY_GRADES = Object.freeze(["A", "B", "C", "IGNORE"] as const);
export type R22QualityGrade = (typeof R22_QUALITY_GRADES)[number];

export const R22_MARKET_REGIMES = Object.freeze(["BULL", "NEUTRAL", "BEAR", "UNKNOWN"] as const);
export type R22MarketRegime = (typeof R22_MARKET_REGIMES)[number];

export const R22_CONTEXT_ALIGNMENTS = Object.freeze([
  "SUPPORTIVE",
  "NEUTRAL",
  "ADVERSE",
  "UNAVAILABLE",
  "NOT_APPLICABLE",
] as const);
export type R22ContextAlignment = (typeof R22_CONTEXT_ALIGNMENTS)[number];

export const R22_RISK_STATES = Object.freeze([
  "STANDARD",
  "CAUTION",
  "UNAVAILABLE",
  "NOT_APPLICABLE",
] as const);
export type R22RiskState = (typeof R22_RISK_STATES)[number];

export const R22_DESIGN_GATE_IDS = Object.freeze([
  "D01_SIGNAL_SCOPE",
  "D02_DIRECTIONAL_ASSESSMENT",
  "D03_QUALITY_GRADING",
  "D04_MARKET_CONTEXT_ADVISORY",
  "D05_RISK_ADVISORY",
  "D06_HISTORICAL_REVIEW_BOUNDARY",
  "D07_DESIGN_ONLY_GOVERNANCE",
] as const);
export type R22DesignGateId = (typeof R22_DESIGN_GATE_IDS)[number];

export type R22DesignGovernance = Readonly<{
  designOnly: true;
  performanceExecuted: false;
  backtestExecuted: false;
  selectionExecuted: false;
  parameterOptimizationExecuted: false;
  economicEvaluationExecuted: false;
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

export const R22_DESIGN_GOVERNANCE: R22DesignGovernance = Object.freeze({
  designOnly: true,
  performanceExecuted: false,
  backtestExecuted: false,
  selectionExecuted: false,
  parameterOptimizationExecuted: false,
  economicEvaluationExecuted: false,
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

export type R22SignalQualityInput = Readonly<{
  direction: R22Direction;
  referencePrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  closedCandle: boolean;
  freshData: boolean;
  identityComplete: boolean;
  strategySnapshotComplete: boolean;
  marketRegime: R22MarketRegime;
}>;

export type R22RiskGeometry = Readonly<{
  state: R22RiskState;
  valid: boolean;
  riskDistance: number | null;
  rewardDistance: number | null;
  riskRewardRatio: number | null;
  flags: readonly string[];
}>;

export type R22MarketContextAdvisory = Readonly<{
  regime: R22MarketRegime;
  alignment: R22ContextAlignment;
  message: string;
}>;

export type R22SignalQualityResult = Readonly<{
  direction: R22Direction;
  qualityGrade: R22QualityGrade;
  qualityStatus: "ADVISORY_VALID" | "IGNORED";
  marketContext: R22MarketContextAdvisory;
  riskAdvisory: R22RiskGeometry;
  reasons: readonly string[];
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

function isFinitePositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

export function deriveR22RiskGeometry(input: Pick<
  R22SignalQualityInput,
  "direction" | "referencePrice" | "stopLoss" | "takeProfit"
>): R22RiskGeometry {
  if (input.direction === "NO_SIGNAL") {
    return {
      state: "NOT_APPLICABLE",
      valid: false,
      riskDistance: null,
      rewardDistance: null,
      riskRewardRatio: null,
      flags: ["NO_SIGNAL"],
    };
  }

  if (!isFinitePositive(input.referencePrice)
    || !isFinitePositive(input.stopLoss)
    || !isFinitePositive(input.takeProfit)) {
    return {
      state: "UNAVAILABLE",
      valid: false,
      riskDistance: null,
      rewardDistance: null,
      riskRewardRatio: null,
      flags: ["RISK_GEOMETRY_UNAVAILABLE"],
    };
  }

  const directionallyOrdered = input.direction === "LONG"
    ? input.stopLoss < input.referencePrice && input.referencePrice < input.takeProfit
    : input.takeProfit < input.referencePrice && input.referencePrice < input.stopLoss;
  if (!directionallyOrdered) {
    return {
      state: "UNAVAILABLE",
      valid: false,
      riskDistance: null,
      rewardDistance: null,
      riskRewardRatio: null,
      flags: ["DIRECTIONAL_RISK_ORDER_INVALID"],
    };
  }

  const riskDistance = Math.abs(input.referencePrice - input.stopLoss);
  const rewardDistance = Math.abs(input.takeProfit - input.referencePrice);
  const riskRewardRatio = rewardDistance / riskDistance;
  if (!Number.isFinite(riskRewardRatio) || riskDistance <= 0 || rewardDistance <= 0) {
    return {
      state: "UNAVAILABLE",
      valid: false,
      riskDistance,
      rewardDistance,
      riskRewardRatio: null,
      flags: ["RISK_GEOMETRY_NON_FINITE"],
    };
  }

  return riskRewardRatio >= 1
    ? {
      state: "STANDARD",
      valid: true,
      riskDistance,
      rewardDistance,
      riskRewardRatio,
      flags: [],
    }
    : {
      state: "CAUTION",
      valid: true,
      riskDistance,
      rewardDistance,
      riskRewardRatio,
      flags: ["REWARD_BELOW_RISK"],
    };
}

export function deriveR22MarketContext(
  direction: R22Direction,
  regime: R22MarketRegime,
): R22MarketContextAdvisory {
  if (direction === "NO_SIGNAL") {
    return { regime, alignment: "NOT_APPLICABLE", message: "No directional signal is present." };
  }
  if (regime === "UNKNOWN") {
    return { regime, alignment: "UNAVAILABLE", message: "Market context is unavailable; manual review is required." };
  }
  if (regime === "NEUTRAL") {
    return { regime, alignment: "NEUTRAL", message: "Market context is neutral to the advisory direction." };
  }

  const supportive = (direction === "LONG" && regime === "BULL")
    || (direction === "SHORT" && regime === "BEAR");
  return supportive
    ? { regime, alignment: "SUPPORTIVE", message: "Market context is directionally supportive; this is not an execution instruction." }
    : { regime, alignment: "ADVERSE", message: "Market context is directionally adverse; elevated human review is required." };
}

export function assessR22SignalQuality(input: R22SignalQualityInput): R22SignalQualityResult {
  const marketContext = deriveR22MarketContext(input.direction, input.marketRegime);
  const riskAdvisory = deriveR22RiskGeometry(input);
  const reasons: string[] = [];

  if (input.direction === "NO_SIGNAL") {
    return {
      direction: "NO_SIGNAL",
      qualityGrade: "IGNORE",
      qualityStatus: "IGNORED",
      marketContext,
      riskAdvisory,
      reasons: ["NO_SIGNAL"],
      humanDecisionRequired: true,
      automaticTrading: false,
    };
  }

  if (!input.closedCandle) reasons.push("CANDLE_NOT_CLOSED");
  if (!input.freshData) reasons.push("DATA_STALE");
  if (!input.identityComplete) reasons.push("SIGNAL_IDENTITY_INCOMPLETE");
  if (!input.strategySnapshotComplete) reasons.push("STRATEGY_SNAPSHOT_INCOMPLETE");
  if (!riskAdvisory.valid) reasons.push(...riskAdvisory.flags);

  if (reasons.length > 0) {
    return {
      direction: input.direction,
      qualityGrade: "IGNORE",
      qualityStatus: "IGNORED",
      marketContext,
      riskAdvisory,
      reasons,
      humanDecisionRequired: true,
      automaticTrading: false,
    };
  }

  const qualityGrade: R22QualityGrade = marketContext.alignment === "SUPPORTIVE"
    && riskAdvisory.state === "STANDARD"
    ? "A"
    : marketContext.alignment === "ADVERSE" || marketContext.alignment === "UNAVAILABLE"
      ? "C"
      : "B";

  return {
    direction: input.direction,
    qualityGrade,
    qualityStatus: "ADVISORY_VALID",
    marketContext,
    riskAdvisory,
    reasons,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export type R22DesignGate = Readonly<{
  id: R22DesignGateId;
  status: "PASS";
  definition: string;
}>;

export const R22_DESIGN_GATES: readonly R22DesignGate[] = Object.freeze([
  {
    id: "D01_SIGNAL_SCOPE",
    status: "PASS",
    definition: "The layer is advisory-only and emits LONG, SHORT, or NO_SIGNAL.",
  },
  {
    id: "D02_DIRECTIONAL_ASSESSMENT",
    status: "PASS",
    definition: "LONG and SHORT use the same deterministic contract with direction-aware risk ordering.",
  },
  {
    id: "D03_QUALITY_GRADING",
    status: "PASS",
    definition: "A, B, C, and IGNORE are derived from integrity, context, and pre-trade risk geometry only.",
  },
  {
    id: "D04_MARKET_CONTEXT_ADVISORY",
    status: "PASS",
    definition: "Context is an advisory classification and never changes the underlying signal direction.",
  },
  {
    id: "D05_RISK_ADVISORY",
    status: "PASS",
    definition: "Risk output is static entry/stop/target geometry; it does not size, place, modify, or close trades.",
  },
  {
    id: "D06_HISTORICAL_REVIEW_BOUNDARY",
    status: "PASS",
    definition: "Historical review is identity-only until a separately approved result-linkage contract exists.",
  },
  {
    id: "D07_DESIGN_ONLY_GOVERNANCE",
    status: "PASS",
    definition: "No performance, backtest, selection, optimization, economic evaluation, or production operation is authorized.",
  },
]);

export function isR22DesignOnlyGovernance(status: R22DesignGovernance): boolean {
  return status.designOnly
    && status.performanceExecuted === false
    && status.backtestExecuted === false
    && status.selectionExecuted === false
    && status.parameterOptimizationExecuted === false
    && status.economicEvaluationExecuted === false
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
