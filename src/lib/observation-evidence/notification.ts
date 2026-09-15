import { createHash } from "node:crypto";

import type { SignalAdvisory, SignalClaimResult } from "../signal-advisory/types.ts";
import {
  buildClaimDecisionEvidence,
  calculateNotificationDecisionId,
  validateNotificationTerminalEvent,
  type NotificationEvidenceEvent,
} from "../signal-advisory/notification-evidence.ts";
import { canonicalJson } from "./canonical.ts";
import {
  R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  R22_OBSERVATION_TIMESTAMP_AUTHORITY,
} from "./snapshot.ts";
import type { ObservationEvidenceCandidate, ObservationJsonValue } from "./types.ts";
import {
  isCanonicalUtcTimestamp,
  validateObservationAdvisoryIdentity,
  validateObservationEvidenceCandidate,
} from "./validator.ts";

export const R22_R8_NOTIFICATION_EVENT_TYPES = Object.freeze([
  "CLAIM_DECISION",
  "DELIVERY_ATTEMPTED",
  "DELIVERED",
  "DELIVERY_FAILED",
  "DELIVERY_REGISTRY_PERSISTENCE_FAILED",
] as const);

export type NotificationObservationCandidateInput = Readonly<{
  advisory: SignalAdvisory;
  event: NotificationEvidenceEvent;
  observedAt: string;
  capturedAt: string;
}>;

export class NotificationObservationNotEvaluableError extends Error {
  readonly code = "NOT_EVALUABLE" as const;
  readonly reason: string;

  constructor(reason: string) {
    super(`R22_R8_NOTIFICATION_NOT_EVALUABLE:${reason}`);
    this.name = "NotificationObservationNotEvaluableError";
    this.reason = reason;
  }
}

function notEvaluable(reason: string): never {
  throw new NotificationObservationNotEvaluableError(reason);
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function advisoryIdentity(advisory: SignalAdvisory) {
  return {
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
  } as const;
}

function expectedAttemptSequence(decisionType: SignalClaimResult): 1 | 2 | null {
  if (decisionType === "CLAIMED") return 1;
  if (decisionType === "RETRY_CLAIMED") return 2;
  return null;
}

type TerminalNotificationEvent = Extract<
  NotificationEvidenceEvent,
  { type: "DELIVERED" | "DELIVERY_FAILED" | "DELIVERY_REGISTRY_PERSISTENCE_FAILED" }
>;

function isTerminalNotificationEvent(event: NotificationEvidenceEvent): event is TerminalNotificationEvent {
  return event.type === "DELIVERED"
    || event.type === "DELIVERY_FAILED"
    || event.type === "DELIVERY_REGISTRY_PERSISTENCE_FAILED";
}

function validateEventIdentity(advisory: SignalAdvisory, event: NotificationEvidenceEvent): void {
  const metadata = event.metadata;
  if (metadata.signalId !== advisory.signalId) return notEvaluable("SIGNAL_ID_MISMATCH");
  if (metadata.channel !== "EMAIL") return notEvaluable("CHANNEL_MISMATCH");
  if (metadata.attemptSequence !== expectedAttemptSequence(metadata.decisionType)) {
    return notEvaluable("ATTEMPT_SEQUENCE_MISMATCH");
  }
  if (metadata.attemptSequenceSource.trim().length === 0) {
    return notEvaluable("ATTEMPT_SEQUENCE_SOURCE_MISSING");
  }
  const expectedDecisionId = calculateNotificationDecisionId({
    scanId: metadata.scanId,
    signalId: metadata.signalId,
    channel: metadata.channel,
    decisionType: metadata.decisionType,
  });
  if (metadata.notificationDecisionId !== expectedDecisionId) {
    return notEvaluable("NOTIFICATION_DECISION_ID_MISMATCH");
  }

  if (event.type === "CLAIM_DECISION") {
    const expectedClaim = buildClaimDecisionEvidence(metadata);
    if (event.outcome !== expectedClaim.outcome
      || (event.suppressionReason ?? null) !== (expectedClaim.suppressionReason ?? null)) {
      return notEvaluable("CLAIM_OUTCOME_MISMATCH");
    }
  } else if (metadata.decisionType !== "CLAIMED" && metadata.decisionType !== "RETRY_CLAIMED") {
    return notEvaluable("SKIPPED_DECISION_HAS_DELIVERY_EVENT");
  }

  if (!isTerminalNotificationEvent(event)) return;
  const terminal = event.terminalEvent;
  if (terminal.notificationDecisionId !== metadata.notificationDecisionId
    || validateNotificationTerminalEvent(terminal) !== "VALID") {
    return notEvaluable("TERMINAL_IDENTITY_INVALID");
  }
  if (event.type === "DELIVERY_FAILED") {
    if (terminal.terminalOutcome !== "DELIVERY_FAILED" || terminal.failureCode !== event.failureCode) {
      return notEvaluable("TERMINAL_PAYLOAD_MISMATCH");
    }
  } else if (terminal.terminalOutcome !== "DELIVERED" || terminal.failureCode !== null) {
    return notEvaluable("TERMINAL_PAYLOAD_MISMATCH");
  }
  if (event.type === "DELIVERY_REGISTRY_PERSISTENCE_FAILED"
    && event.technicalCode !== "DELIVERY_REGISTRY_PERSISTENCE_FAILED") {
    return notEvaluable("REGISTRY_FAILURE_CODE_INVALID");
  }
}

function notificationIdentityPreimage(event: NotificationEvidenceEvent): Readonly<Record<string, unknown>> {
  const terminalEventId = isTerminalNotificationEvent(event)
    ? event.terminalEvent.terminalEventId
    : null;
  return {
    namespace: "R22_R8_NOTIFICATION_OBSERVATION",
    notificationDecisionId: event.metadata.notificationDecisionId,
    eventType: event.type,
    terminalEventId,
    claimOutcome: event.type === "CLAIM_DECISION" ? event.outcome : null,
    suppressionReason: event.type === "CLAIM_DECISION" ? event.suppressionReason ?? null : null,
  };
}

function notificationPayload(event: NotificationEvidenceEvent, advisory: SignalAdvisory): ObservationJsonValue {
  const notification: Record<string, ObservationJsonValue> = {
    eventType: event.type,
    notificationDecisionId: event.metadata.notificationDecisionId,
    channel: event.metadata.channel,
    decisionType: event.metadata.decisionType,
    attemptSequence: event.metadata.attemptSequence,
    attemptSequenceSource: event.metadata.attemptSequenceSource,
    claimOutcome: event.type === "CLAIM_DECISION" ? event.outcome : null,
    suppressionReason: event.type === "CLAIM_DECISION" ? event.suppressionReason ?? null : null,
    terminalEventId: isTerminalNotificationEvent(event) ? event.terminalEvent.terminalEventId : null,
    terminalOutcome: isTerminalNotificationEvent(event) ? event.terminalEvent.terminalOutcome : null,
    failureCode: event.type === "DELIVERY_FAILED"
      ? event.failureCode
      : isTerminalNotificationEvent(event)
        ? event.terminalEvent.failureCode
        : null,
    technicalCode: event.type === "DELIVERY_REGISTRY_PERSISTENCE_FAILED"
      ? event.technicalCode
      : null,
  };
  return {
    source: "R22_O05_NOTIFICATION_EVIDENCE",
    advisoryIdentity: advisoryIdentity(advisory),
    notification,
    observedAtAuthority: "SERVER_WALL_CLOCK",
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function calculateNotificationObservationId(event: NotificationEvidenceEvent): string {
  return `notification-observation:${hashCanonical(notificationIdentityPreimage(event))}`;
}

export function buildNotificationObservationCandidate(
  input: NotificationObservationCandidateInput,
): ObservationEvidenceCandidate {
  const { advisory, event, observedAt, capturedAt } = input;
  const identity = advisoryIdentity(advisory);
  if (!validateObservationAdvisoryIdentity(identity)) return notEvaluable("ADVISORY_IDENTITY_INVALID");
  if (!isCanonicalUtcTimestamp(observedAt) || !isCanonicalUtcTimestamp(capturedAt)) {
    return notEvaluable("INVALID_TIMESTAMP");
  }
  validateEventIdentity(advisory, event);

  const payload = notificationPayload(event, advisory);
  const notificationObservationId = calculateNotificationObservationId(event);
  const idempotencyKey = `notification-idempotency:${hashCanonical({
    namespace: "R22_R8_NOTIFICATION_IDEMPOTENCY",
    notificationObservationId,
    payload,
  })}`;
  const evidenceId = `notification-evidence:${hashCanonical({
    namespace: "R22_R8_NOTIFICATION_EVIDENCE",
    notificationObservationId,
    idempotencyKey,
  })}`;
  const candidate: ObservationEvidenceCandidate = Object.freeze({
    evidenceId,
    eventKind: "NOTIFICATION",
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
    artifactId: null,
    artifactType: null,
    notificationObservationId,
    reviewObservationId: null,
    eventType: null,
    informationAsOf: null,
    capturedAt,
    observedAt,
    reviewStartedAt: null,
    reviewSubmittedAt: null,
    sourceRef: `tp_signal_advisories:${advisory.signalId}`,
    contentHash: null,
    evidenceHash: null,
    idempotencyKey,
    supersedesArtifactId: null,
    supersedesEvidenceId: null,
    payload,
    timestampAuthority: R22_OBSERVATION_TIMESTAMP_AUTHORITY,
    persistenceOperation: "APPEND",
  });
  const validation = validateObservationEvidenceCandidate(candidate);
  if (validation.status !== "VALID") {
    return notEvaluable(validation.causalReason === "NONE" ? validation.reason : validation.causalReason);
  }
  return candidate;
}
