import type { ResearchSymbol } from "../config/constants.ts";
import type { AdvisoryDirection } from "../signal-advisory/types.ts";

import {
  R22_OBSERVATION_SCHEMA_VERSION,
  type ObservationEvidenceCandidate,
  type ObservationJsonValue,
} from "./types.ts";
import { R22_OBSERVATION_TIMESTAMP_AUTHORITY } from "./snapshot.ts";
import { validateObservationEvidenceCandidate, isCanonicalUtcTimestamp } from "./validator.ts";

export const R22_HUMAN_REVIEW_SCHEMA_VERSION = R22_OBSERVATION_SCHEMA_VERSION;
export const R22_HUMAN_REVIEW_SOURCE_PREFIX = "tp_signal_advisories:";

export type R22HumanReviewEventType = "REVIEW_STARTED" | "REVIEW_SUBMITTED";

export type R22HumanReviewLabels = Readonly<{
  reviewComplete: boolean;
  informationSufficient: boolean;
  unnecessaryAlert: boolean;
}>;

const R22_HUMAN_REVIEW_LABEL_KEYS = [
  "reviewComplete",
  "informationSufficient",
  "unnecessaryAlert",
] as const;

export type R22HumanReviewValidation = Readonly<{
  status: "OBSERVABLE" | "NOT_EVALUABLE";
  reason:
    | "NONE"
    | "INVALID_EVIDENCE"
    | "REVIEW_IDENTITY_MISMATCH"
    | "START_FIELDS_MUST_BE_EMPTY"
    | "SUBMIT_FIELDS_REQUIRED"
    | "DECISION_LATENCY_INVALID";
}>;

export type R22HumanReviewAdvisoryIdentity = Readonly<{
  signalId: string;
  symbol: ResearchSymbol;
  direction: AdvisoryDirection;
  signalTime: string;
  strategyId: string;
  strategyVersion: string;
}>;

function eventSuffix(eventType: R22HumanReviewEventType): "START" | "SUBMIT" {
  return eventType === "REVIEW_STARTED" ? "START" : "SUBMIT";
}

export function calculateR22ReviewObservationId(signalId: string): string {
  return ["R22_REVIEW", signalId, R22_HUMAN_REVIEW_SCHEMA_VERSION].join("|");
}

export function calculateR22HumanReviewIdempotencyKey(
  reviewObservationId: string,
  eventType: R22HumanReviewEventType,
): string {
  return ["REVIEW", reviewObservationId, eventSuffix(eventType)].join("|");
}

function calculateEvidenceId(reviewObservationId: string, eventType: R22HumanReviewEventType): string {
  return ["R22_REVIEW_EVIDENCE", reviewObservationId, eventSuffix(eventType)].join("|");
}

function sourceRef(signalId: string): string {
  return `${R22_HUMAN_REVIEW_SOURCE_PREFIX}${signalId}`;
}

function reviewPayload(
  eventType: R22HumanReviewEventType,
  labels: R22HumanReviewLabels | null,
  decisionLatencyProxyMs: number | null,
): ObservationJsonValue {
  if (eventType === "REVIEW_STARTED") {
    return {
      reviewLifecycle: "R22_HUMAN_REVIEW",
      eventType,
      humanDecisionRequired: true,
      automaticTrading: false,
    };
  }

  if (labels === null || decisionLatencyProxyMs === null) {
    throw new Error("R22 REVIEW_SUBMITTED requires explicit human labels and server latency.");
  }

  return {
    reviewLifecycle: "R22_HUMAN_REVIEW",
    eventType,
    humanReview: labels,
    labelSource: "EXPLICIT_HUMAN_LABEL",
    decisionLatencyProxyMs,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

function buildCandidate(input: Readonly<{
  advisory: R22HumanReviewAdvisoryIdentity;
  eventType: R22HumanReviewEventType;
  reviewObservationId: string;
  reviewStartedAt: string;
  reviewSubmittedAt: string | null;
  capturedAt: string;
  labels: R22HumanReviewLabels | null;
  decisionLatencyProxyMs: number | null;
}>): ObservationEvidenceCandidate {
  return {
    evidenceId: calculateEvidenceId(input.reviewObservationId, input.eventType),
    eventKind: "REVIEW",
    schemaVersion: R22_HUMAN_REVIEW_SCHEMA_VERSION,
    signalId: input.advisory.signalId,
    symbol: input.advisory.symbol,
    direction: input.advisory.direction,
    signalTime: input.advisory.signalTime,
    strategyId: input.advisory.strategyId,
    strategyVersion: input.advisory.strategyVersion,
    artifactId: null,
    artifactType: null,
    notificationObservationId: null,
    reviewObservationId: input.reviewObservationId,
    eventType: input.eventType,
    informationAsOf: null,
    capturedAt: input.capturedAt,
    observedAt: null,
    reviewStartedAt: input.reviewStartedAt,
    reviewSubmittedAt: input.reviewSubmittedAt,
    sourceRef: sourceRef(input.advisory.signalId),
    contentHash: null,
    evidenceHash: null,
    idempotencyKey: calculateR22HumanReviewIdempotencyKey(
      input.reviewObservationId,
      input.eventType,
    ),
    supersedesArtifactId: null,
    supersedesEvidenceId: null,
    payload: reviewPayload(input.eventType, input.labels, input.decisionLatencyProxyMs),
    timestampAuthority: R22_OBSERVATION_TIMESTAMP_AUTHORITY,
    persistenceOperation: "APPEND",
  };
}

export function buildR22ReviewStartedCandidate(input: Readonly<{
  advisory: R22HumanReviewAdvisoryIdentity;
  reviewStartedAt: string;
  capturedAt: string;
}>): ObservationEvidenceCandidate {
  return buildCandidate({
    ...input,
    eventType: "REVIEW_STARTED",
    reviewObservationId: calculateR22ReviewObservationId(input.advisory.signalId),
    reviewSubmittedAt: null,
    labels: null,
    decisionLatencyProxyMs: null,
  });
}

export function buildR22ReviewSubmittedCandidate(input: Readonly<{
  advisory: R22HumanReviewAdvisoryIdentity;
  reviewObservationId: string;
  reviewStartedAt: string;
  reviewSubmittedAt: string;
  capturedAt: string;
  labels: R22HumanReviewLabels;
}>): ObservationEvidenceCandidate {
  const decisionLatencyProxyMs = Date.parse(input.reviewSubmittedAt) - Date.parse(input.reviewStartedAt);
  return buildCandidate({
    ...input,
    eventType: "REVIEW_SUBMITTED",
    reviewSubmittedAt: input.reviewSubmittedAt,
    labels: input.labels,
    decisionLatencyProxyMs,
  });
}

function objectPayload(value: ObservationJsonValue): Record<string, ObservationJsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, ObservationJsonValue>
    : null;
}

function isBoolean(value: ObservationJsonValue | undefined): value is boolean {
  return typeof value === "boolean";
}

export function parseR22HumanReviewLabels(value: unknown): R22HumanReviewLabels | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length !== R22_HUMAN_REVIEW_LABEL_KEYS.length
    || R22_HUMAN_REVIEW_LABEL_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(input, key))) {
    return null;
  }
  if (typeof input.reviewComplete !== "boolean"
    || typeof input.informationSufficient !== "boolean"
    || typeof input.unnecessaryAlert !== "boolean") {
    return null;
  }
  return {
    reviewComplete: input.reviewComplete,
    informationSufficient: input.informationSufficient,
    unnecessaryAlert: input.unnecessaryAlert,
  };
}

export function validateR22HumanReviewCandidate(
  candidate: ObservationEvidenceCandidate,
): R22HumanReviewValidation {
  const generic = validateObservationEvidenceCandidate(candidate);
  if (generic.status !== "VALID") {
    return { status: "NOT_EVALUABLE", reason: "INVALID_EVIDENCE" };
  }
  if (candidate.eventKind !== "REVIEW"
    || candidate.reviewObservationId === null
    || candidate.eventType === null
    || candidate.reviewObservationId !== calculateR22ReviewObservationId(candidate.signalId)
    || candidate.idempotencyKey !== calculateR22HumanReviewIdempotencyKey(
      candidate.reviewObservationId,
      candidate.eventType,
    )) {
    return { status: "NOT_EVALUABLE", reason: "REVIEW_IDENTITY_MISMATCH" };
  }
  if (!isCanonicalUtcTimestamp(candidate.reviewStartedAt)) {
    return { status: "NOT_EVALUABLE", reason: "INVALID_EVIDENCE" };
  }

  const payload = objectPayload(candidate.payload);
  if (payload === null || payload.humanDecisionRequired !== true || payload.automaticTrading !== false) {
    return { status: "NOT_EVALUABLE", reason: "INVALID_EVIDENCE" };
  }

  if (candidate.eventType === "REVIEW_STARTED") {
    if (candidate.reviewSubmittedAt !== null || "humanReview" in payload || "labelSource" in payload) {
      return { status: "NOT_EVALUABLE", reason: "START_FIELDS_MUST_BE_EMPTY" };
    }
    return { status: "OBSERVABLE", reason: "NONE" };
  }

  const humanReview = parseR22HumanReviewLabels(payload.humanReview ?? null);
  const latency = payload.decisionLatencyProxyMs;
  if (candidate.reviewSubmittedAt === null
    || payload.labelSource !== "EXPLICIT_HUMAN_LABEL"
    || humanReview === null
    || !isBoolean(humanReview.reviewComplete)
    || !isBoolean(humanReview.informationSufficient)
    || !isBoolean(humanReview.unnecessaryAlert)
    || typeof latency !== "number"
    || !Number.isSafeInteger(latency)
    || latency < 0
    || latency !== Date.parse(candidate.reviewSubmittedAt) - Date.parse(candidate.reviewStartedAt)) {
    return {
      status: "NOT_EVALUABLE",
      reason: typeof latency === "number" && (!Number.isSafeInteger(latency) || latency < 0)
        ? "DECISION_LATENCY_INVALID"
        : "SUBMIT_FIELDS_REQUIRED",
    };
  }
  return { status: "OBSERVABLE", reason: "NONE" };
}
