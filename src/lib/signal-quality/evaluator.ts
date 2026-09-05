export const SIGNAL_QUALITY_DIRECTIONS = Object.freeze(["LONG", "SHORT", "NO_SIGNAL"] as const);
export type SignalQualityDirection = (typeof SIGNAL_QUALITY_DIRECTIONS)[number];

export const SIGNAL_QUALITY_GRADES = Object.freeze(["A", "B", "C", "IGNORE"] as const);
export type SignalQualityGrade = (typeof SIGNAL_QUALITY_GRADES)[number];

export const SIGNAL_QUALITY_REGIMES = Object.freeze(["BULL", "NEUTRAL", "BEAR", "UNKNOWN"] as const);
export type SignalQualityRegime = (typeof SIGNAL_QUALITY_REGIMES)[number];

export const SIGNAL_QUALITY_CONTEXT_ALIGNMENTS = Object.freeze([
  "SUPPORTIVE",
  "NEUTRAL",
  "ADVERSE",
  "UNAVAILABLE",
  "NOT_APPLICABLE",
] as const);
export type SignalQualityContextAlignment = (typeof SIGNAL_QUALITY_CONTEXT_ALIGNMENTS)[number];

export const SIGNAL_QUALITY_RISK_LEVELS = Object.freeze([
  "STANDARD",
  "CAUTION",
  "UNAVAILABLE",
  "NOT_APPLICABLE",
] as const);
export type SignalQualityRiskLevel = (typeof SIGNAL_QUALITY_RISK_LEVELS)[number];

export const SIGNAL_QUALITY_SCORE_BY_GRADE: Readonly<Record<SignalQualityGrade, number>> = Object.freeze({
  A: 3,
  B: 2,
  C: 1,
  IGNORE: 0,
});

export type SignalQualityInput = Readonly<{
  direction: SignalQualityDirection;
  referencePrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  closedCandle: boolean;
  freshData: boolean;
  identityComplete: boolean;
  strategySnapshotComplete: boolean;
  marketRegime: SignalQualityRegime;
}>;

export type SignalQualityDirectionalInput = Readonly<Pick<
  SignalQualityInput,
  "referencePrice" | "stopLoss" | "takeProfit"
>>;

export type MarketContextAdvisory = Readonly<{
  regime: SignalQualityRegime;
  alignment: SignalQualityContextAlignment;
  explanation: string;
}>;

export type RiskAdvisory = Readonly<{
  level: SignalQualityRiskLevel;
  valid: boolean;
  riskDistance: number | null;
  rewardDistance: number | null;
  riskRewardRatio: number | null;
  flags: readonly string[];
}>;

export type LongQualityAssessment = Readonly<{
  direction: "LONG";
  valid: boolean;
  explanations: readonly string[];
}>;

export type ShortQualityAssessment = Readonly<{
  direction: "SHORT";
  valid: boolean;
  explanations: readonly string[];
}>;

export type SignalQualityResult = Readonly<{
  direction: SignalQualityDirection;
  qualityGrade: SignalQualityGrade;
  qualityScore: number;
  qualityStatus: "ADVISORY_VALID" | "IGNORED";
  marketContext: MarketContextAdvisory;
  riskLevel: SignalQualityRiskLevel;
  riskAdvisory: RiskAdvisory;
  explanations: readonly string[];
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

function isFinitePositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function normalizeDirection(value: SignalQualityDirection): SignalQualityDirection {
  return value === "LONG" || value === "SHORT" || value === "NO_SIGNAL"
    ? value
    : "NO_SIGNAL";
}

function normalizeRegime(value: SignalQualityRegime): SignalQualityRegime {
  return value === "BULL" || value === "NEUTRAL" || value === "BEAR" || value === "UNKNOWN"
    ? value
    : "UNKNOWN";
}

export function deriveMarketContextAdvisory(
  direction: SignalQualityDirection,
  regime: SignalQualityRegime,
): MarketContextAdvisory {
  const normalizedDirection = normalizeDirection(direction);
  const normalizedRegime = normalizeRegime(regime);

  if (normalizedDirection === "NO_SIGNAL") {
    return {
      regime: normalizedRegime,
      alignment: "NOT_APPLICABLE",
      explanation: "No directional signal is present.",
    };
  }

  if (normalizedRegime === "UNKNOWN") {
    return {
      regime: normalizedRegime,
      alignment: "UNAVAILABLE",
      explanation: "Market context is unavailable; manual review is required.",
    };
  }

  if (normalizedRegime === "NEUTRAL") {
    return {
      regime: normalizedRegime,
      alignment: "NEUTRAL",
      explanation: "Market context is neutral to the advisory direction.",
    };
  }

  const supportive = (normalizedDirection === "LONG" && normalizedRegime === "BULL")
    || (normalizedDirection === "SHORT" && normalizedRegime === "BEAR");
  return supportive
    ? {
      regime: normalizedRegime,
      alignment: "SUPPORTIVE",
      explanation: "Market context is directionally supportive; this is not an execution instruction.",
    }
    : {
      regime: normalizedRegime,
      alignment: "ADVERSE",
      explanation: "Market context is directionally adverse; elevated human review is required.",
    };
}

export function deriveRiskAdvisory(input: SignalQualityInput): RiskAdvisory {
  const direction = normalizeDirection(input.direction);
  if (direction === "NO_SIGNAL") {
    return {
      level: "NOT_APPLICABLE",
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
      level: "UNAVAILABLE",
      valid: false,
      riskDistance: null,
      rewardDistance: null,
      riskRewardRatio: null,
      flags: ["RISK_GEOMETRY_UNAVAILABLE"],
    };
  }

  const directionallyOrdered = direction === "LONG"
    ? input.stopLoss < input.referencePrice && input.referencePrice < input.takeProfit
    : input.takeProfit < input.referencePrice && input.referencePrice < input.stopLoss;
  if (!directionallyOrdered) {
    return {
      level: "UNAVAILABLE",
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
      level: "UNAVAILABLE",
      valid: false,
      riskDistance,
      rewardDistance,
      riskRewardRatio: null,
      flags: ["RISK_GEOMETRY_NON_FINITE"],
    };
  }

  return {
    level: riskRewardRatio >= 1 ? "STANDARD" : "CAUTION",
    valid: true,
    riskDistance,
    rewardDistance,
    riskRewardRatio,
    flags: riskRewardRatio >= 1 ? [] : ["REWARD_BELOW_RISK"],
  };
}

export function assessLongQuality(input: SignalQualityDirectionalInput): LongQualityAssessment {
  const riskAdvisory = deriveRiskAdvisory({
    ...input,
    direction: "LONG",
    closedCandle: true,
    freshData: true,
    identityComplete: true,
    strategySnapshotComplete: true,
    marketRegime: "UNKNOWN",
  });
  return {
    direction: "LONG",
    valid: riskAdvisory.valid,
    explanations: riskAdvisory.flags,
  };
}

export function assessShortQuality(input: SignalQualityDirectionalInput): ShortQualityAssessment {
  const riskAdvisory = deriveRiskAdvisory({
    ...input,
    direction: "SHORT",
    closedCandle: true,
    freshData: true,
    identityComplete: true,
    strategySnapshotComplete: true,
    marketRegime: "UNKNOWN",
  });
  return {
    direction: "SHORT",
    valid: riskAdvisory.valid,
    explanations: riskAdvisory.flags,
  };
}

function ignoredResult(
  direction: SignalQualityDirection,
  marketContext: MarketContextAdvisory,
  riskAdvisory: RiskAdvisory,
  explanations: readonly string[],
): SignalQualityResult {
  return {
    direction,
    qualityGrade: "IGNORE",
    qualityScore: SIGNAL_QUALITY_SCORE_BY_GRADE.IGNORE,
    qualityStatus: "IGNORED",
    marketContext,
    riskLevel: riskAdvisory.level,
    riskAdvisory,
    explanations,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function evaluateSignalQuality(input: SignalQualityInput): SignalQualityResult {
  const direction = normalizeDirection(input.direction);
  const marketContext = deriveMarketContextAdvisory(direction, input.marketRegime);
  const riskAdvisory = deriveRiskAdvisory({ ...input, direction });

  if (direction === "NO_SIGNAL") {
    return ignoredResult(direction, marketContext, riskAdvisory, ["NO_SIGNAL"]);
  }

  const explanations: string[] = [];
  if (!input.closedCandle) explanations.push("CANDLE_NOT_CLOSED");
  if (!input.freshData) explanations.push("DATA_STALE");
  if (!input.identityComplete) explanations.push("SIGNAL_IDENTITY_INCOMPLETE");
  if (!input.strategySnapshotComplete) explanations.push("STRATEGY_SNAPSHOT_INCOMPLETE");
  if (!riskAdvisory.valid) explanations.push(...riskAdvisory.flags);

  if (explanations.length > 0) {
    return ignoredResult(direction, marketContext, riskAdvisory, explanations);
  }

  const qualityGrade: SignalQualityGrade = marketContext.alignment === "SUPPORTIVE"
    && riskAdvisory.level === "STANDARD"
    ? "A"
    : marketContext.alignment === "ADVERSE" || marketContext.alignment === "UNAVAILABLE"
      ? "C"
      : "B";

  return {
    direction,
    qualityGrade,
    qualityScore: SIGNAL_QUALITY_SCORE_BY_GRADE[qualityGrade],
    qualityStatus: "ADVISORY_VALID",
    marketContext,
    riskLevel: riskAdvisory.level,
    riskAdvisory,
    explanations: [marketContext.explanation, ...riskAdvisory.flags],
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export class SignalQualityEvaluator {
  evaluate(input: SignalQualityInput): SignalQualityResult {
    return evaluateSignalQuality(input);
  }
}

export const signalQualityEvaluator = new SignalQualityEvaluator();
