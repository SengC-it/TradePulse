import { createHash } from "node:crypto";

import type { SignalClaimResult } from "./types.ts";

export const NOTIFICATION_EVIDENCE_CHANNEL = "EMAIL" as const;

export type NotificationFailureCode =
  | "EMAIL_CONFIGURATION_INVALID"
  | "SMTP_AUTH_FAILED"
  | "SMTP_DELIVERY_FAILED";

export type NotificationTerminalOutcome = "DELIVERED" | "DELIVERY_FAILED";

export type NotificationDecisionMetadata = Readonly<{
  scanId: string;
  signalId: string;
  channel: typeof NOTIFICATION_EVIDENCE_CHANNEL;
  decisionType: SignalClaimResult;
  notificationDecisionId: string;
  attemptSequence: 1 | 2 | null;
  attemptSequenceSource: string;
}>;

export type NotificationTerminalEvent = Readonly<{
  notificationDecisionId: string;
  terminalEventId: string;
  terminalOutcome: NotificationTerminalOutcome;
  failureCode: NotificationFailureCode | null;
}>;

export type NotificationEvidenceEvent =
  | Readonly<{
      type: "CLAIM_DECISION";
      metadata: NotificationDecisionMetadata;
      outcome: "CLAIMED" | "RETRY_CLAIMED" | "DUPLICATE_SKIPPED" | "SUPPRESSED";
      suppressionReason?: "EXPIRED";
    }>
  | Readonly<{
      type: "DELIVERY_ATTEMPTED";
      metadata: NotificationDecisionMetadata;
    }>
  | Readonly<{
      type: "DELIVERED";
      metadata: NotificationDecisionMetadata;
      terminalEvent: NotificationTerminalEvent;
    }>
  | Readonly<{
      type: "DELIVERY_FAILED";
      metadata: NotificationDecisionMetadata;
      terminalEvent: NotificationTerminalEvent;
      failureCode: NotificationFailureCode;
    }>
  | Readonly<{
      type: "DELIVERY_REGISTRY_PERSISTENCE_FAILED";
      metadata: NotificationDecisionMetadata;
      terminalEvent: NotificationTerminalEvent;
      technicalCode: "DELIVERY_REGISTRY_PERSISTENCE_FAILED";
    }>;

export type NotificationEvidenceObserver = (event: NotificationEvidenceEvent) => void | Promise<void>;

type TerminalTransitionValidation = Readonly<{
  status: "APPEND" | "IDEMPOTENT_REPLAY" | "NOT_EVALUABLE";
  reason: "NONE" | "IDEMPOTENT_REPLAY" | "TERMINAL_CONFLICT" | "TERMINAL_ID_MISMATCH" | "INVALID_EXISTING" | "INVALID_CANDIDATE";
}>;

function stableValue(value: unknown): unknown {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Identity input must contain only finite numbers.");
  }
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(stableValue(value));
  if (serialized === undefined) {
    throw new Error("Identity input must be JSON-safe.");
  }
  return serialized;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty.`);
  }
}

function expectedAttemptSequence(decisionType: SignalClaimResult): 1 | 2 | null {
  if (decisionType === "CLAIMED") return 1;
  if (decisionType === "RETRY_CLAIMED") return 2;
  return null;
}

function attemptSequenceSource(decisionType: SignalClaimResult): string {
  if (decisionType === "CLAIMED") {
    return "authoritative initial advisory insert contract";
  }
  if (decisionType === "RETRY_CLAIMED") {
    return "authoritative retry compare-and-set transition plus frozen retry limit";
  }
  return "not applicable: skipped decisions have no delivery attempt";
}

export function calculateNotificationDecisionId(input: Readonly<{
  scanId: string;
  signalId: string;
  channel: typeof NOTIFICATION_EVIDENCE_CHANNEL;
  decisionType: SignalClaimResult;
}>): string {
  requireNonEmpty(input.scanId, "scanId");
  requireNonEmpty(input.signalId, "signalId");
  if (input.channel !== NOTIFICATION_EVIDENCE_CHANNEL) {
    throw new Error("Only the existing email notification channel is supported.");
  }
  return `notification-decision:${sha256({
    namespace: "R22_O05_NOTIFICATION_DECISION",
    scanId: input.scanId,
    signalId: input.signalId,
    channel: input.channel,
    decisionType: input.decisionType,
  })}`;
}

export function calculateNotificationTerminalEventId(notificationDecisionId: string): string {
  requireNonEmpty(notificationDecisionId, "notificationDecisionId");
  return `notification-terminal:${sha256({
    namespace: "R22_O05_NOTIFICATION_TERMINAL",
    notificationDecisionId,
  })}`;
}

export function buildNotificationDecisionMetadata(input: Readonly<{
  scanId: string;
  signalId: string;
  decisionType: SignalClaimResult;
}>): NotificationDecisionMetadata {
  return Object.freeze({
    scanId: input.scanId,
    signalId: input.signalId,
    channel: NOTIFICATION_EVIDENCE_CHANNEL,
    decisionType: input.decisionType,
    notificationDecisionId: calculateNotificationDecisionId({
      ...input,
      channel: NOTIFICATION_EVIDENCE_CHANNEL,
    }),
    attemptSequence: expectedAttemptSequence(input.decisionType),
    attemptSequenceSource: attemptSequenceSource(input.decisionType),
  });
}

export function buildNotificationTerminalEvent(input: Readonly<{
  notificationDecisionId: string;
  terminalOutcome: NotificationTerminalOutcome;
  failureCode?: NotificationFailureCode | null;
}>): NotificationTerminalEvent {
  requireNonEmpty(input.notificationDecisionId, "notificationDecisionId");
  const failureCode = input.failureCode ?? null;
  if (input.terminalOutcome === "DELIVERED" && failureCode !== null) {
    throw new Error("DELIVERED cannot carry a delivery failure code.");
  }
  if (input.terminalOutcome === "DELIVERY_FAILED" && failureCode === null) {
    throw new Error("DELIVERY_FAILED requires a delivery failure code.");
  }
  return Object.freeze({
    notificationDecisionId: input.notificationDecisionId,
    terminalEventId: calculateNotificationTerminalEventId(input.notificationDecisionId),
    terminalOutcome: input.terminalOutcome,
    failureCode,
  });
}

export function validateNotificationTerminalEvent(
  event: NotificationTerminalEvent,
): "VALID" | "NOT_EVALUABLE" {
  if (event.notificationDecisionId.trim().length === 0) return "NOT_EVALUABLE";
  if (event.terminalEventId !== calculateNotificationTerminalEventId(event.notificationDecisionId)) {
    return "NOT_EVALUABLE";
  }
  if (event.terminalOutcome === "DELIVERY_FAILED" && event.failureCode === null) {
    return "NOT_EVALUABLE";
  }
  if (event.terminalOutcome === "DELIVERED" && event.failureCode !== null) {
    return "NOT_EVALUABLE";
  }
  return "VALID";
}

export function validateNotificationTerminalTransition(
  existing: NotificationTerminalEvent | null,
  candidate: NotificationTerminalEvent,
): TerminalTransitionValidation {
  if (validateNotificationTerminalEvent(candidate) !== "VALID") {
    return { status: "NOT_EVALUABLE", reason: "INVALID_CANDIDATE" };
  }
  if (existing === null) {
    return { status: "APPEND", reason: "NONE" };
  }
  if (validateNotificationTerminalEvent(existing) !== "VALID") {
    return { status: "NOT_EVALUABLE", reason: "INVALID_EXISTING" };
  }
  if (
    existing.notificationDecisionId !== candidate.notificationDecisionId
    || existing.terminalEventId !== candidate.terminalEventId
  ) {
    return { status: "NOT_EVALUABLE", reason: "TERMINAL_ID_MISMATCH" };
  }
  if (
    existing.terminalOutcome === candidate.terminalOutcome
    && existing.failureCode === candidate.failureCode
  ) {
    return { status: "IDEMPOTENT_REPLAY", reason: "IDEMPOTENT_REPLAY" };
  }
  return { status: "NOT_EVALUABLE", reason: "TERMINAL_CONFLICT" };
}

export function buildClaimDecisionEvidence(
  metadata: NotificationDecisionMetadata,
): Extract<NotificationEvidenceEvent, { type: "CLAIM_DECISION" }> {
  if (metadata.decisionType === "SKIPPED_DUPLICATE") {
    return { type: "CLAIM_DECISION", metadata, outcome: "DUPLICATE_SKIPPED" };
  }
  if (metadata.decisionType === "SKIPPED_EXPIRED") {
    return { type: "CLAIM_DECISION", metadata, outcome: "SUPPRESSED", suppressionReason: "EXPIRED" };
  }
  return { type: "CLAIM_DECISION", metadata, outcome: metadata.decisionType };
}

export function buildDeliveryAttemptedEvidence(
  metadata: NotificationDecisionMetadata,
): Extract<NotificationEvidenceEvent, { type: "DELIVERY_ATTEMPTED" }> {
  return { type: "DELIVERY_ATTEMPTED", metadata };
}

export function buildDeliveredEvidence(
  metadata: NotificationDecisionMetadata,
): Extract<NotificationEvidenceEvent, { type: "DELIVERED" }> {
  return {
    type: "DELIVERED",
    metadata,
    terminalEvent: buildNotificationTerminalEvent({
      notificationDecisionId: metadata.notificationDecisionId,
      terminalOutcome: "DELIVERED",
    }),
  };
}

export function buildDeliveryFailedEvidence(
  metadata: NotificationDecisionMetadata,
  failureCode: NotificationFailureCode,
): Extract<NotificationEvidenceEvent, { type: "DELIVERY_FAILED" }> {
  return {
    type: "DELIVERY_FAILED",
    metadata,
    failureCode,
    terminalEvent: buildNotificationTerminalEvent({
      notificationDecisionId: metadata.notificationDecisionId,
      terminalOutcome: "DELIVERY_FAILED",
      failureCode,
    }),
  };
}

export function buildDeliveryRegistryPersistenceFailureEvidence(
  metadata: NotificationDecisionMetadata,
): Extract<NotificationEvidenceEvent, { type: "DELIVERY_REGISTRY_PERSISTENCE_FAILED" }> {
  return {
    type: "DELIVERY_REGISTRY_PERSISTENCE_FAILED",
    metadata,
    technicalCode: "DELIVERY_REGISTRY_PERSISTENCE_FAILED",
    terminalEvent: buildNotificationTerminalEvent({
      notificationDecisionId: metadata.notificationDecisionId,
      terminalOutcome: "DELIVERED",
    }),
  };
}
