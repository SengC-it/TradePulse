import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";

export const R22_ALERT_INTELLIGENCE_SCHEMA_VERSION = "m3-r22-alert-intelligence-design-001" as const;
export const R22_ALERT_INTELLIGENCE_ROUND_ID = "baseline-002-research-round-022" as const;
export const R22_ALERT_INTELLIGENCE_PHASE = "ALERT_INTELLIGENCE_DESIGN_ONLY" as const;
export const R22_ALERT_INTELLIGENCE_ACCEPTED_SOURCE = "32617afd2bf576465ddec04dccff7c93e47639e7" as const;
export const R22_ALERT_INTELLIGENCE_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_ALERT_INTELLIGENCE_BRANCH = "research/round-022-alert-intelligence-design" as const;
export const R22_ALERT_INTELLIGENCE_CONTRACT_PATH = "docs/research/round-022-alert-intelligence-contract.json" as const;
export const R22_ALERT_INTELLIGENCE_DESIGN_PATH = "docs/research/round-022-alert-intelligence-design.md" as const;

export const R22_ALERT_DIRECTIONS = Object.freeze(["LONG", "SHORT", "NO_SIGNAL"] as const);
export type R22AlertDirection = (typeof R22_ALERT_DIRECTIONS)[number];

export const R22_ALERT_QUALITY_GRADES = Object.freeze(["A", "B", "C", "IGNORE"] as const);
export type R22AlertQualityGrade = (typeof R22_ALERT_QUALITY_GRADES)[number];

export const R22_ALERT_CONTEXT_REGIMES = Object.freeze(["BULL", "NEUTRAL", "BEAR", "UNKNOWN"] as const);
export type R22AlertContextRegime = (typeof R22_ALERT_CONTEXT_REGIMES)[number];

export const R22_ALERT_CONTEXT_ALIGNMENTS = Object.freeze([
  "SUPPORTIVE",
  "NEUTRAL",
  "ADVERSE",
  "UNAVAILABLE",
  "NOT_APPLICABLE",
] as const);
export type R22AlertContextAlignment = (typeof R22_ALERT_CONTEXT_ALIGNMENTS)[number];

export const R22_ALERT_RISK_LEVELS = Object.freeze([
  "STANDARD",
  "CAUTION",
  "UNAVAILABLE",
  "NOT_APPLICABLE",
] as const);
export type R22AlertRiskLevel = (typeof R22_ALERT_RISK_LEVELS)[number];

export const R22_ALERT_PRIORITIES = Object.freeze(["P1", "P2", "P3", "IGNORE"] as const);
export type R22AlertPriority = (typeof R22_ALERT_PRIORITIES)[number];

export const R22_ALERT_NOTIFICATION_IMPORTANCE = Object.freeze([
  "HIGH",
  "NORMAL",
  "LOW",
  "DO_NOT_NOTIFY",
] as const);
export type R22AlertNotificationImportance = (typeof R22_ALERT_NOTIFICATION_IMPORTANCE)[number];

export const R22_ALERT_CONFIDENCE = Object.freeze(["HIGH", "MEDIUM", "LOW", "UNAVAILABLE"] as const);
export type R22AlertConfidence = (typeof R22_ALERT_CONFIDENCE)[number];

export const R22_ALERT_PRESENTATION_STATUSES = Object.freeze([
  "PRESENTABLE",
  "DEGRADED",
  "SUPPRESSED",
] as const);
export type R22AlertPresentationStatus = (typeof R22_ALERT_PRESENTATION_STATUSES)[number];

export type R22AlertIdentity = Readonly<{
  signalId: string;
  symbol: ResearchSymbol;
  direction: Exclude<R22AlertDirection, "NO_SIGNAL">;
  signalTime: string;
  strategyId: string;
  strategyVersion: string;
}>;

export type R22AlertSignalSnapshot = Readonly<{
  direction: R22AlertDirection;
  identity: R22AlertIdentity | null;
  triggerExplanation: string | null;
}>;

export type R22AlertQualitySnapshot = Readonly<{
  status: "AVAILABLE" | "MISSING";
  grade: R22AlertQualityGrade | null;
  score: number | null;
  explanations: readonly string[];
}>;

export type R22AlertMarketContextSnapshot = Readonly<{
  status: "AVAILABLE" | "MISSING";
  regime: R22AlertContextRegime | null;
  alignment: R22AlertContextAlignment | null;
  explanation: string | null;
}>;

export type R22AlertRiskSnapshot = Readonly<{
  status: "AVAILABLE" | "MISSING";
  level: R22AlertRiskLevel | null;
  explanation: string | null;
}>;

export type R22AlertHistoricalReviewMetadata = Readonly<{
  status: "AVAILABLE" | "MISSING";
  reviewStatus: "IDENTITY_ONLY" | "NOT_REVIEWED" | "UNAVAILABLE" | null;
  contextSummary: string | null;
}>;

export type R22AlertIntelligenceInput = Readonly<{
  signal: R22AlertSignalSnapshot;
  quality: R22AlertQualitySnapshot;
  marketContext: R22AlertMarketContextSnapshot;
  riskAdvisory: R22AlertRiskSnapshot;
  historicalReview: R22AlertHistoricalReviewMetadata;
}>;

export type R22AlertExplanation = Readonly<{
  whyTriggered: string;
  currentEnvironment: string;
  risk: string;
  historicalReference: string;
}>;

export type R22AlertIntelligenceResult = Readonly<{
  presentationStatus: R22AlertPresentationStatus;
  alertSummary: string;
  direction: R22AlertDirection;
  qualityGrade: R22AlertQualityGrade;
  qualityScore: number | null;
  priority: R22AlertPriority;
  notificationImportance: R22AlertNotificationImportance;
  attentionRank: 1 | 2 | 3 | null;
  confidence: R22AlertConfidence;
  riskExplanation: string;
  historicalContext: string;
  humanReviewNotes: readonly string[];
  explanation: R22AlertExplanation;
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

export type R22AlertIntelligenceGovernance = Readonly<{
  designOnly: true;
  implementationAuthorized: false;
  performanceExecuted: false;
  backtestExecuted: false;
  selectionExecuted: false;
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

export const R22_ALERT_INTELLIGENCE_GOVERNANCE: R22AlertIntelligenceGovernance = Object.freeze({
  designOnly: true,
  implementationAuthorized: false,
  performanceExecuted: false,
  backtestExecuted: false,
  selectionExecuted: false,
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

function nonEmpty(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function canonicalIsoTimestamp(value: string): boolean {
  if (!nonEmpty(value) || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isIdentityComplete(
  signal: R22AlertSignalSnapshot,
): signal is R22AlertSignalSnapshot & { identity: R22AlertIdentity } {
  const identity = signal.identity;
  return identity !== null
    && nonEmpty(identity.signalId)
    && (RESEARCH_SYMBOLS as readonly string[]).includes(identity.symbol)
    && signal.direction !== "NO_SIGNAL"
    && identity.direction === signal.direction
    && canonicalIsoTimestamp(identity.signalTime)
    && nonEmpty(identity.strategyId)
    && nonEmpty(identity.strategyVersion);
}

function qualityAvailable(input: R22AlertQualitySnapshot): input is R22AlertQualitySnapshot & {
  status: "AVAILABLE";
  grade: R22AlertQualityGrade;
} {
  return input.status === "AVAILABLE"
    && input.grade !== null
    && R22_ALERT_QUALITY_GRADES.includes(input.grade)
    && (input.score === null || Number.isFinite(input.score));
}

function contextAvailable(input: R22AlertMarketContextSnapshot): input is R22AlertMarketContextSnapshot & {
  status: "AVAILABLE";
  regime: R22AlertContextRegime;
  alignment: R22AlertContextAlignment;
  explanation: string;
} {
  return input.status === "AVAILABLE"
    && input.regime !== null
    && R22_ALERT_CONTEXT_REGIMES.includes(input.regime)
    && input.alignment !== null
    && R22_ALERT_CONTEXT_ALIGNMENTS.includes(input.alignment)
    && nonEmpty(input.explanation);
}

function riskAvailable(input: R22AlertRiskSnapshot): input is R22AlertRiskSnapshot & {
  status: "AVAILABLE";
  level: R22AlertRiskLevel;
  explanation: string;
} {
  return input.status === "AVAILABLE"
    && input.level !== null
    && R22_ALERT_RISK_LEVELS.includes(input.level)
    && nonEmpty(input.explanation);
}

function historicalText(input: R22AlertHistoricalReviewMetadata): string {
  if (input.status !== "AVAILABLE" || !nonEmpty(input.contextSummary)) {
    return "Historical review context is unavailable; no outcome is inferred.";
  }
  return input.contextSummary;
}

function priorityFor(
  quality: R22AlertQualitySnapshot,
  context: R22AlertMarketContextSnapshot,
  risk: R22AlertRiskSnapshot,
): Readonly<{
  priority: R22AlertPriority;
  notificationImportance: R22AlertNotificationImportance;
  attentionRank: 1 | 2 | 3;
  confidence: R22AlertConfidence;
}> {
  if (!qualityAvailable(quality) || !contextAvailable(context) || !riskAvailable(risk)) {
    return {
      priority: "P3",
      notificationImportance: "LOW",
      attentionRank: 3,
      confidence: "LOW",
    };
  }

  if (
    quality.grade === "A"
    && context.alignment === "SUPPORTIVE"
    && risk.level === "STANDARD"
  ) {
    return {
      priority: "P1",
      notificationImportance: "HIGH",
      attentionRank: 1,
      confidence: "HIGH",
    };
  }

  return {
    priority: "P2",
    notificationImportance: "NORMAL",
    attentionRank: 2,
    confidence: "MEDIUM",
  };
}

export function buildR22AlertIntelligence(
  input: R22AlertIntelligenceInput,
): R22AlertIntelligenceResult {
  const identityComplete = isIdentityComplete(input.signal);
  const direction = input.signal.direction;
  const noDirectionalSignal = direction === "NO_SIGNAL";
  const qualityIsAvailable = qualityAvailable(input.quality);
  const contextIsAvailable = contextAvailable(input.marketContext);
  const riskIsAvailable = riskAvailable(input.riskAdvisory);
  const historicalContext = historicalText(input.historicalReview);

  if (noDirectionalSignal || !identityComplete) {
    const reason = noDirectionalSignal ? "NO_SIGNAL" : "SIGNAL_IDENTITY_INCOMPLETE";
    const explanation: R22AlertExplanation = {
      whyTriggered: input.signal.triggerExplanation ?? "No verifiable trigger explanation is available.",
      currentEnvironment: contextIsAvailable
        ? input.marketContext.explanation
        : "Market context is unavailable; manual review is required.",
      risk: riskIsAvailable
        ? input.riskAdvisory.explanation
        : "Risk advisory is unavailable; no risk conclusion is formed.",
      historicalReference: historicalContext,
    };
    return {
      presentationStatus: "SUPPRESSED",
      alertSummary: "Alert suppressed until a complete advisory identity is available.",
      direction,
      qualityGrade: "IGNORE",
      qualityScore: null,
      priority: "IGNORE",
      notificationImportance: "DO_NOT_NOTIFY",
      attentionRank: null,
      confidence: "UNAVAILABLE",
      riskExplanation: explanation.risk,
      historicalContext,
      humanReviewNotes: [reason, "No notification-ready advisory is produced."],
      explanation,
      humanDecisionRequired: true,
      automaticTrading: false,
    };
  }

  const priority = priorityFor(input.quality, input.marketContext, input.riskAdvisory);
  const humanReviewNotes: string[] = [];
  if (!qualityIsAvailable) humanReviewNotes.push("QUALITY_SNAPSHOT_MISSING");
  if (!contextIsAvailable) humanReviewNotes.push("MARKET_CONTEXT_MISSING");
  if (!riskIsAvailable) humanReviewNotes.push("RISK_ADVISORY_MISSING");
  if (input.historicalReview.status !== "AVAILABLE") {
    humanReviewNotes.push("HISTORICAL_REVIEW_METADATA_MISSING");
  }
  if (humanReviewNotes.length === 0) humanReviewNotes.push("MANUAL_REVIEW_REQUIRED");

  const qualityGrade = qualityIsAvailable ? input.quality.grade : "IGNORE";
  const qualityScore = qualityIsAvailable ? input.quality.score : null;
  const explanation: R22AlertExplanation = {
    whyTriggered: input.signal.triggerExplanation ?? "Trigger explanation is unavailable; manual review is required.",
    currentEnvironment: contextIsAvailable
      ? input.marketContext.explanation
      : "Market context is unavailable; confidence is reduced.",
    risk: riskIsAvailable
      ? input.riskAdvisory.explanation
      : "Risk advisory is unavailable; confidence is reduced.",
    historicalReference: historicalContext,
  };

  return {
    presentationStatus: priority.confidence === "LOW" ? "DEGRADED" : "PRESENTABLE",
    alertSummary: `${direction} advisory requires a human decision; no execution action is implied.`,
    direction,
    qualityGrade,
    qualityScore,
    priority: priority.priority,
    notificationImportance: priority.notificationImportance,
    attentionRank: priority.attentionRank,
    confidence: priority.confidence,
    riskExplanation: explanation.risk,
    historicalContext,
    humanReviewNotes,
    explanation,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export class R22AlertIntelligence {
  present(input: R22AlertIntelligenceInput): R22AlertIntelligenceResult {
    return buildR22AlertIntelligence(input);
  }
}

export const r22AlertIntelligence = new R22AlertIntelligence();

export function isR22AlertIntelligenceDesignOnlyGovernance(
  status: R22AlertIntelligenceGovernance,
): boolean {
  return status.designOnly
    && status.implementationAuthorized === false
    && status.performanceExecuted === false
    && status.backtestExecuted === false
    && status.selectionExecuted === false
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
