import {
  buildR22AlertIntelligence,
  type R22AlertHistoricalReviewMetadata,
  type R22AlertIntelligenceInput,
  type R22AlertIntelligenceResult,
  type R22AlertMarketContextSnapshot,
  type R22AlertRiskSnapshot,
  type R22AlertSignalSnapshot,
  type R22AlertQualitySnapshot,
} from "../research/alert-intelligence-protocol.ts";

export type AlertIntelligenceInput = Readonly<{
  signal: R22AlertSignalSnapshot | null;
  qualitySnapshot: R22AlertQualitySnapshot | null;
  marketContext: R22AlertMarketContextSnapshot | null;
  riskAdvisory: R22AlertRiskSnapshot | null;
  historicalReview: R22AlertHistoricalReviewMetadata | null;
}>;

export type AlertIntelligencePayload = Readonly<{
  signal: R22AlertSignalSnapshot | null;
  alertIntelligence: R22AlertIntelligenceResult;
}>;

export type AlertPriority = Readonly<Pick<
  R22AlertIntelligenceResult,
  "priority" | "notificationImportance" | "attentionRank" | "confidence"
>>;

const MISSING_QUALITY: R22AlertQualitySnapshot = Object.freeze({
  status: "MISSING",
  grade: null,
  score: null,
  explanations: [],
});

const MISSING_CONTEXT: R22AlertMarketContextSnapshot = Object.freeze({
  status: "MISSING",
  regime: null,
  alignment: null,
  explanation: null,
});

const MISSING_RISK: R22AlertRiskSnapshot = Object.freeze({
  status: "MISSING",
  level: null,
  explanation: null,
});

const MISSING_HISTORICAL_REVIEW: R22AlertHistoricalReviewMetadata = Object.freeze({
  status: "MISSING",
  reviewStatus: null,
  contextSummary: null,
});

const MISSING_SIGNAL: R22AlertSignalSnapshot = Object.freeze({
  direction: "NO_SIGNAL",
  identity: null,
  triggerExplanation: null,
});

function toProtocolInput(input: AlertIntelligenceInput): R22AlertIntelligenceInput {
  return {
    signal: input.signal ?? MISSING_SIGNAL,
    quality: input.qualitySnapshot ?? MISSING_QUALITY,
    marketContext: input.marketContext ?? MISSING_CONTEXT,
    riskAdvisory: input.riskAdvisory ?? MISSING_RISK,
    historicalReview: input.historicalReview ?? MISSING_HISTORICAL_REVIEW,
  };
}

export function buildAlertIntelligence(input: AlertIntelligenceInput): R22AlertIntelligenceResult {
  return buildR22AlertIntelligence(toProtocolInput(input));
}

export function buildAlertPriority(input: AlertIntelligenceInput): AlertPriority {
  const result = buildAlertIntelligence(input);
  return {
    priority: result.priority,
    notificationImportance: result.notificationImportance,
    attentionRank: result.attentionRank,
    confidence: result.confidence,
  };
}

export function buildAlertExplanation(input: AlertIntelligenceInput): R22AlertIntelligenceResult["explanation"] {
  return buildAlertIntelligence(input).explanation;
}

export function buildAlertPayload(input: AlertIntelligenceInput): AlertIntelligencePayload {
  return Object.freeze({
    signal: input.signal,
    alertIntelligence: buildAlertIntelligence(input),
  });
}
