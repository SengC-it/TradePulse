export const R22_ADVISORY_EVALUATION_SCHEMA_VERSION = "m3-r22-advisory-evaluation-design-001" as const;
export const R22_ADVISORY_EVALUATION_ROUND_ID = "baseline-002-research-round-022" as const;
export const R22_ADVISORY_EVALUATION_PHASE = "ADVISORY_EVALUATION_DESIGN_ONLY" as const;
export const R22_ADVISORY_EVALUATION_ACCEPTED_SOURCE = "d5ead14573153c24de7d6d37bd63086f9475cde5" as const;
export const R22_ADVISORY_EVALUATION_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_ADVISORY_EVALUATION_BRANCH = "research/round-022-advisory-evaluation-design" as const;
export const R22_ADVISORY_EVALUATION_CONTRACT_PATH = "docs/research/round-022-advisory-evaluation-contract.json" as const;
export const R22_ADVISORY_EVALUATION_DESIGN_PATH = "docs/research/round-022-advisory-evaluation-design.md" as const;

export const R22_ADVISORY_EVALUATION_DIRECTIONS = Object.freeze([
  "LONG",
  "SHORT",
  "NO_SIGNAL",
] as const);
export type R22AdvisoryEvaluationDirection = (typeof R22_ADVISORY_EVALUATION_DIRECTIONS)[number];

export const R22_ADVISORY_EVALUATION_QUALITY_GRADES = Object.freeze([
  "A",
  "B",
  "C",
  "IGNORE",
] as const);
export type R22AdvisoryEvaluationQualityGrade = (typeof R22_ADVISORY_EVALUATION_QUALITY_GRADES)[number];

export const R22_ADVISORY_EVALUATION_REVIEW_STATUSES = Object.freeze([
  "IDENTITY_ONLY",
  "NOT_REVIEWED",
  "UNAVAILABLE",
] as const);
export type R22AdvisoryEvaluationReviewStatus = (typeof R22_ADVISORY_EVALUATION_REVIEW_STATUSES)[number];

export const R22_ADVISORY_EVALUATION_NOTIFICATION_DISPOSITIONS = Object.freeze([
  "DELIVERED",
  "IGNORED",
  "SUPPRESSED",
  "DUPLICATE_SKIPPED",
] as const);
export type R22AdvisoryEvaluationNotificationDisposition =
  (typeof R22_ADVISORY_EVALUATION_NOTIFICATION_DISPOSITIONS)[number];

export const R22_ADVISORY_EVALUATION_QUALITY_METRICS = Object.freeze([
  "signalClarity",
  "explanationCompleteness",
  "riskVisibility",
  "contextCompleteness",
] as const);

export const R22_ADVISORY_EVALUATION_NOISE_METRICS = Object.freeze([
  "unnecessaryAlertRate",
  "ignoreRatio",
  "duplicateAlertRate",
] as const);

export const R22_ADVISORY_EVALUATION_REVIEW_METRICS = Object.freeze([
  "reviewCompleteness",
  "informationSufficiency",
  "decisionLatencyProxyMs",
] as const);

export const R22_ADVISORY_EVALUATION_FORBIDDEN_INPUT_FIELDS = Object.freeze([
  "pnl",
  "profit",
  "loss",
  "forwardReturn",
  "performance",
  "economicOutcome",
] as const);

export type R22AdvisoryEvaluationObservation = Readonly<{
  signal: Readonly<{
    direction: R22AdvisoryEvaluationDirection;
    identityKey: string | null;
  }> | null;
  qualitySnapshot: Readonly<{
    available: boolean;
    grade: R22AdvisoryEvaluationQualityGrade | null;
  }> | null;
  marketContext: Readonly<{
    available: boolean;
  }> | null;
  riskAdvisory: Readonly<{
    available: boolean;
  }> | null;
  historicalReview: Readonly<{
    status: R22AdvisoryEvaluationReviewStatus;
    identityMetadataPresent: boolean;
  }> | null;
  presentation: Readonly<{
    signalClarity: boolean;
    explanationCompleteness: boolean;
    riskVisibility: boolean;
    contextCompleteness: boolean;
    unnecessaryAlert: boolean;
    notificationDisposition: R22AdvisoryEvaluationNotificationDisposition;
  }> | null;
  humanReview: Readonly<{
    reviewComplete: boolean;
    informationSufficient: boolean;
    decisionLatencyProxyMs: number | null;
  }> | null;
}>;

export type R22AdvisoryEvaluationMetrics = Readonly<{
  advisoryQuality: Readonly<{
    signalClarity: number;
    explanationCompleteness: number;
    riskVisibility: number;
    contextCompleteness: number;
  }>;
  noiseReduction: Readonly<{
    unnecessaryAlertRate: number;
    ignoreRatio: number;
    duplicateAlertRate: number;
  }>;
  humanReviewEfficiency: Readonly<{
    reviewCompleteness: number;
    informationSufficiency: number;
    decisionLatencyProxyMs: number;
  }>;
}>;

export type R22AdvisoryEvaluationStatus = "OBSERVABLE" | "NOT_EVALUABLE";
export type R22AdvisoryEvaluationReason =
  | "NONE"
  | "MISSING_SIGNAL"
  | "NO_SIGNAL_NOT_AN_ALERT"
  | "MISSING_QUALITY_SNAPSHOT"
  | "MISSING_MARKET_CONTEXT"
  | "MISSING_RISK_ADVISORY"
  | "MISSING_HISTORICAL_REVIEW"
  | "MISSING_PRESENTATION_OBSERVATION"
  | "MISSING_HUMAN_REVIEW_OBSERVATION"
  | "INVALID_DECISION_LATENCY_PROXY";

export type R22AdvisoryEvaluationResult = Readonly<{
  status: R22AdvisoryEvaluationStatus;
  reason: R22AdvisoryEvaluationReason;
  direction: R22AdvisoryEvaluationDirection;
  identityKey: string | null;
  metrics: R22AdvisoryEvaluationMetrics | null;
  observedOnly: true;
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

export type R22AdvisoryEvaluationStability = "STABLE" | "NOT_STABLE" | "NOT_EVALUABLE";

export type R22AdvisoryEvaluationGovernance = Readonly<{
  designOnly: true;
  implementationAuthorized: false;
  performanceExecuted: false;
  backtestExecuted: false;
  selectionExecuted: false;
  economicEvaluationExecuted: false;
  economicValuesRead: false;
  forwardReturnRead: false;
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

export const R22_ADVISORY_EVALUATION_GOVERNANCE: R22AdvisoryEvaluationGovernance = Object.freeze({
  designOnly: true,
  implementationAuthorized: false,
  performanceExecuted: false,
  backtestExecuted: false,
  selectionExecuted: false,
  economicEvaluationExecuted: false,
  economicValuesRead: false,
  forwardReturnRead: false,
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

function notEvaluable(
  observation: R22AdvisoryEvaluationObservation,
  reason: Exclude<R22AdvisoryEvaluationReason, "NONE">,
): R22AdvisoryEvaluationResult {
  return {
    status: "NOT_EVALUABLE",
    reason,
    direction: observation.signal?.direction ?? "NO_SIGNAL",
    identityKey: observation.signal?.identityKey ?? null,
    metrics: null,
    observedOnly: true,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

function binaryMetric(value: boolean): number {
  return value ? 1 : 0;
}

function isValidLatency(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

export function evaluateR22AdvisoryObservation(
  observation: R22AdvisoryEvaluationObservation,
): R22AdvisoryEvaluationResult {
  if (observation.signal === null) {
    return notEvaluable(observation, "MISSING_SIGNAL");
  }
  if (observation.signal.direction === "NO_SIGNAL") {
    return notEvaluable(observation, "NO_SIGNAL_NOT_AN_ALERT");
  }
  if (observation.signal.identityKey === null) {
    return notEvaluable(observation, "MISSING_SIGNAL");
  }
  if (observation.qualitySnapshot === null || !observation.qualitySnapshot.available) {
    return notEvaluable(observation, "MISSING_QUALITY_SNAPSHOT");
  }
  if (
    observation.qualitySnapshot.grade === null
    || !R22_ADVISORY_EVALUATION_QUALITY_GRADES.includes(observation.qualitySnapshot.grade)
  ) {
    return notEvaluable(observation, "MISSING_QUALITY_SNAPSHOT");
  }
  if (observation.marketContext === null || !observation.marketContext.available) {
    return notEvaluable(observation, "MISSING_MARKET_CONTEXT");
  }
  if (observation.riskAdvisory === null || !observation.riskAdvisory.available) {
    return notEvaluable(observation, "MISSING_RISK_ADVISORY");
  }
  if (
    observation.historicalReview === null
    || !observation.historicalReview.identityMetadataPresent
    || observation.historicalReview.status === "UNAVAILABLE"
  ) {
    return notEvaluable(observation, "MISSING_HISTORICAL_REVIEW");
  }
  if (observation.presentation === null) {
    return notEvaluable(observation, "MISSING_PRESENTATION_OBSERVATION");
  }
  if (observation.humanReview === null) {
    return notEvaluable(observation, "MISSING_HUMAN_REVIEW_OBSERVATION");
  }
  if (!isValidLatency(observation.humanReview.decisionLatencyProxyMs)) {
    return notEvaluable(observation, "INVALID_DECISION_LATENCY_PROXY");
  }

  return {
    status: "OBSERVABLE",
    reason: "NONE",
    direction: observation.signal.direction,
    identityKey: observation.signal.identityKey,
    metrics: {
      advisoryQuality: {
        signalClarity: binaryMetric(observation.presentation.signalClarity),
        explanationCompleteness: binaryMetric(observation.presentation.explanationCompleteness),
        riskVisibility: binaryMetric(observation.presentation.riskVisibility),
        contextCompleteness: binaryMetric(observation.presentation.contextCompleteness),
      },
      noiseReduction: {
        unnecessaryAlertRate: binaryMetric(observation.presentation.unnecessaryAlert),
        ignoreRatio: binaryMetric(observation.presentation.notificationDisposition === "IGNORED"),
        duplicateAlertRate: binaryMetric(observation.presentation.notificationDisposition === "DUPLICATE_SKIPPED"),
      },
      humanReviewEfficiency: {
        reviewCompleteness: binaryMetric(observation.humanReview.reviewComplete),
        informationSufficiency: binaryMetric(observation.humanReview.informationSufficient),
        decisionLatencyProxyMs: observation.humanReview.decisionLatencyProxyMs,
      },
    },
    observedOnly: true,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function compareR22AdvisoryEvaluationStability(
  first: R22AdvisoryEvaluationResult,
  second: R22AdvisoryEvaluationResult,
): R22AdvisoryEvaluationStability {
  if (first.status !== "OBSERVABLE" || second.status !== "OBSERVABLE") {
    return "NOT_EVALUABLE";
  }
  return JSON.stringify(first) === JSON.stringify(second) ? "STABLE" : "NOT_STABLE";
}
