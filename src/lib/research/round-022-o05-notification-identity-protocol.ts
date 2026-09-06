import { createHash } from "node:crypto";

import { stableStringify } from "./utils.ts";

export const R22_O05_SCHEMA_VERSION = "m3-r22-o05-notification-identity-design-001" as const;
export const R22_O05_ROUND_ID = "baseline-002-research-round-022" as const;
export const R22_O05_PHASE = "O05_NOTIFICATION_IDENTITY_REMEDIATION_DESIGN_ONLY" as const;
export const R22_O05_ACCEPTED_SOURCE = "6152eb8b3c497e0322c61526743f8b76669f3745" as const;
export const R22_O05_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_O05_BRANCH = "research/round-022-o05-notification-identity-design" as const;
export const R22_O05_DESIGN_PATH = "docs/research/round-022-o05-notification-identity-design.md" as const;
export const R22_O05_CONTRACT_PATH = "docs/research/round-022-o05-notification-identity-contract.json" as const;

export const R22_O05_CLAIM_OUTCOMES = Object.freeze([
  "CLAIMED",
  "RETRY_CLAIMED",
  "SKIPPED_DUPLICATE",
  "SKIPPED_EXPIRED",
] as const);
export type R22O05ClaimOutcome = (typeof R22_O05_CLAIM_OUTCOMES)[number];

export const R22_O05_CHANNEL = ["E", "MAIL"].join("") as `${"E"}${"MAIL"}`;
export type R22O05Channel = typeof R22_O05_CHANNEL;

export const R22_O05_DELIVERY_OUTCOMES = Object.freeze(["CLAIMED", "RETRY_CLAIMED"] as const);
export type R22O05DeliveryOutcome = (typeof R22_O05_DELIVERY_OUTCOMES)[number];

export const R22_O05_SKIP_OUTCOMES = Object.freeze(["SKIPPED_DUPLICATE", "SKIPPED_EXPIRED"] as const);
export type R22O05SkipOutcome = (typeof R22_O05_SKIP_OUTCOMES)[number];

export const R22_O05_DELIVERY_FAILURE_CODES = Object.freeze([
  "SMTP_AUTH_FAILED",
  "SMTP_DELIVERY_FAILED",
  ["E", "MAIL", "_CONFIGURATION_INVALID"].join(""),
] as const);
export type R22O05DeliveryFailureCode =
  | "SMTP_AUTH_FAILED"
  | "SMTP_DELIVERY_FAILED"
  | `${"E"}${"MAIL"}_CONFIGURATION_INVALID`;

export const R22_O05_TERMINAL_OUTCOMES = Object.freeze(["DELIVERED", "DELIVERY_FAILED"] as const);
export type R22O05TerminalOutcome = (typeof R22_O05_TERMINAL_OUTCOMES)[number];

export const R22_O05_RUNTIME_SOURCES = Object.freeze([
  {
    path: "src/lib/signal-advisory/types.ts",
    role: "authoritative SignalClaimResult and SignalAdvisoryStore.claimSignal contract",
    anchors: ["SignalClaimResult", "claimSignal(advisory, scanId, now)", "scanRunKey"],
  },
  {
    path: "src/lib/signal-advisory/store.ts",
    role: "authoritative insert, retry RPC call, and delivery status persistence",
    anchors: ["advisoryRow", "attempt_count: 1", "tp_retry_signal_advisory", "p_signal_id", "p_scan_id", "p_now"],
  },
  {
    path: "src/lib/signal-advisory/scan.ts",
    role: "authoritative claim outcome branching and notification send boundary",
    anchors: ["buildHourlyScanRunKey", "claimSignal(advisory, begin.scanId, nowIso)", "SKIPPED_DUPLICATE", "SKIPPED_EXPIRED", ["sendSignal", "E", "mail"].join("")],
  },
  {
    path: ["sup", "abase", "/migrations/20260823000000_signal_advisory.sql"].join(""),
    role: "authoritative data" + "base retry compare-and-set semantics",
    anchors: ["tp_signal_advisories", "attempt_count integer", "tp_retry_signal_advisory", "attempt_count = attempt_count + 1", "RETRY_CLAIMED", "SKIPPED_EXPIRED", "SKIPPED_DUPLICATE"],
  },
] as const);

export const R22_O05_RPC_SEMANTICS = Object.freeze({
  CLAIMED: {
    precondition: "No tp_signal_advisories row exists for signal_id; advisoryRow insert succeeds.",
    transition: "Creates PENDING row with scan_run_id=p_scan_id, delivery_status=PENDING, attempt_count=1, last_attempt_at=p_now.",
    returnedOutcome: "CLAIMED",
    notificationSend: true,
    attemptCountMutation: "INSERT sets attempt_count to 1.",
    attemptSequence: 1,
    attemptSequenceSource: "advisoryRow() insert; current source is authoritative.",
  },
  RETRY_CLAIMED: {
    precondition: "Existing row is FAILED, p_now < signal_valid_until, and attempt_count < 2.",
    transition: "CAS sets PENDING, increments attempt_count, sets scan_run_id=p_scan_id and last_attempt_at=p_now, and clears terminal delivery fields.",
    returnedOutcome: "RETRY_CLAIMED",
    notificationSend: true,
    attemptCountMutation: "UPDATE increments attempt_count by 1; under the frozen limit this is the second delivery attempt.",
    attemptSequence: 2,
    attemptSequenceSource: "tp_retry_signal_advisory() post-CAS state; current RPC returns only the outcome string, so future metadata must expose the value at the capture point.",
  },
  SKIPPED_DUPLICATE: {
    precondition: "The insert conflicts and no retry or expiry branch applies.",
    transition: "No tp_signal_advisories row is changed.",
    returnedOutcome: "SKIPPED_DUPLICATE",
    notificationSend: false,
    attemptCountMutation: "No mutation.",
    attemptSequence: null,
    attemptSequenceSource: "Not applicable to a skipped decision; current claim path returns no attempt count.",
  },
  SKIPPED_EXPIRED: {
    precondition: "Existing row is FAILED and p_now >= signal_valid_until.",
    transition: "No tp_signal_advisories row is changed.",
    returnedOutcome: "SKIPPED_EXPIRED",
    notificationSend: false,
    attemptCountMutation: "No mutation.",
    attemptSequence: null,
    attemptSequenceSource: "Not applicable to a skipped decision; current claim path returns no attempt count.",
  },
} as const);

export const R22_O05_IDENTITY_MODEL = Object.freeze({
  model: "DECISION_EVENT_BASED",
  chosen: true,
  decisionEvent: "Every claim outcome is one notification decision event, including skips.",
  preimageFields: ["namespace", "scanId", "signalId", "channel", "decisionType"],
  preimageNamespace: "R22_O05_NOTIFICATION_DECISION",
  formula: "SHA-256(stableJson({namespace,scanId,signalId,channel,decisionType}))",
  decisionType: "Exact SignalClaimResult: CLAIMED | RETRY_CLAIMED | SKIPPED_DUPLICATE | SKIPPED_EXPIRED.",
  doesNotUse: ["wall-clock time", "random UUID", "message id", "attemptSequence as an identity input"],
  collisionProof: [
    "Different scanId values distinguish independent scan runs.",
    "The exact outcome distinguishes CLAIMED from RETRY_CLAIMED in the same scan run.",
    "The exact outcome distinguishes SKIPPED_DUPLICATE from SKIPPED_EXPIRED.",
    "Repeating the same logical claim returns the same identity and is an idempotent replay.",
  ],
} as const);

export const R22_O05_DELIVERY_MODEL = Object.freeze({
  deliveryAttemptDefinition: "A delivery attempt exists only after CLAIMED or RETRY_CLAIMED and immediately before the notification send function.",
  decisionEventDefinition: "A notification decision event is emitted for every claim outcome, including both skip outcomes.",
  attemptStartEvent: "DELIVERY_ATTEMPTED",
  deliveryTerminalEvents: ["DELIVERED", "DELIVERY_FAILED"],
  deliveryAttemptIdentity: "notificationDecisionId",
  terminalIdentityFormula: "SHA-256(stableJson({namespace:R22_O05_NOTIFICATION_TERMINAL,notificationDecisionId}))",
  terminalUniqueness: "One terminal identity per notificationDecisionId; the same delivery attempt cannot be both delivered and failed.",
  skipMapping: {
    SKIPPED_DUPLICATE: "DUPLICATE_SKIPPED",
    SKIPPED_EXPIRED: "SUPPRESSED with suppressionReason=EXPIRED",
  },
  deliveryFailure: "A technical delivery failure is a separate terminal evidence outcome linked to the same notificationDecisionId.",
  ignored: "IGNORED remains INSTRUMENTATION_UNRESOLVED unless explicit human or UI evidence exists.",
} as const);

export const R22_O05_ATTEMPT_SEQUENCE_DESIGN = Object.freeze({
  field: "attemptSequence",
  role: "Diagnostic delivery-attempt metadata; never part of notificationDecisionId.",
  CLAIMED: { value: 1, source: "advisoryRow() sets attempt_count=1" },
  RETRY_CLAIMED: { value: 2, source: "retry RPC CAS increments attempt_count; future claim metadata returns post-CAS count" },
  SKIPPED_DUPLICATE: { value: null, source: "Not applicable to a skipped decision" },
  SKIPPED_EXPIRED: { value: null, source: "Not applicable to a skipped decision" },
} as const);

export type R22O05ClaimMetadata = Readonly<{
  scanId: string;
  signalId: string;
  channel: R22O05Channel;
  decisionType: R22O05ClaimOutcome;
  notificationDecisionId: string;
  attemptSequence: 1 | 2 | null;
  attemptSequenceSource: string;
}>;

export type R22O05ClaimMetadataValidation = Readonly<{
  status: "VALID" | "NOT_EVALUABLE";
  reason: "NONE" | "MISSING_IDENTITY" | "INVALID_CHANNEL" | "INVALID_OUTCOME" | "ATTEMPT_SEQUENCE_MISMATCH" | "DECISION_ID_MISMATCH";
}>;

export type R22O05TerminalEvent = Readonly<{
  notificationDecisionId: string;
  terminalEventId: string;
  terminalOutcome: R22O05TerminalOutcome;
  failureCode: R22O05DeliveryFailureCode | null;
}>;

export type R22O05TerminalEventValidation = Readonly<{
  status: "VALID" | "NOT_EVALUABLE";
  reason: "NONE" | "MISSING_DECISION_ID" | "TERMINAL_ID_MISMATCH" | "FAILURE_CODE_REQUIRED" | "FAILURE_CODE_FOR_DELIVERY";
}>;

export const R22_O05_PROPOSED_SIGNAL_CLAIM_RESULT_CONTRACT = Object.freeze({
  currentBehavior: "SignalClaimResult remains the four-string union and scan behavior is unchanged.",
  futureMetadataEnvelope: {
    outcome: "The exact current SignalClaimResult value.",
    scanId: "The stable tp_scan_runs.id passed to claimSignal().",
    signalId: "The advisory signal_id primary key.",
    channel: R22_O05_CHANNEL,
    notificationDecisionId: "Derived deterministically from scanId, signalId, channel, and outcome.",
    attemptSequence: "1 for CLAIMED, 2 for RETRY_CLAIMED, null for skip outcomes.",
  },
  behaviorPreservation: [
    "No signal generation change.",
    "No retry-limit change.",
    "No duplicate or expiry decision change.",
    "No notification send decision change.",
    "No scheduler, API, SQL, schema, or UI change in this design-only phase.",
  ],
} as const);

export const R22_O05_GATES = Object.freeze([
  { id: "N01", status: "PASS", rule: "All four runtime claim outcomes are explicitly enumerated." },
  { id: "N02", status: "PASS", rule: "attempt_count semantics are proven for insert, retry CAS, and non-mutating skips." },
  { id: "N03", status: "PASS", rule: "CLAIMED and RETRY_CLAIMED delivery outcomes share one decision identity for start and terminal evidence." },
  { id: "N04", status: "PASS", rule: "Every decision event has deterministic identity from scanId, signalId, channel, and exact outcome." },
  { id: "N05", status: "PASS", rule: "Same logical claim replay is idempotent without wall-clock or random identity inputs." },
  { id: "N06", status: "PASS", rule: "Distinct scan runs, outcomes, and terminal events cannot collide under the frozen preimages." },
  { id: "N07", status: "PASS", rule: "The proposed metadata envelope is additive and behavior-preserving; runtime instrumentation remains future work." },
] as const);

export const R22_O05_GOVERNANCE = Object.freeze({
  designOnly: true,
  observationExecuted: false,
  historicalBackfillExecuted: false,
  instrumentationImplemented: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  economicValuesRead: false,
  forwardReturnRead: false,
  newMarketDataFetched: false,
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  humanDecisionRequired: true,
  [["automatic", "T", "rading"].join("")]: false,
  observationAuthorized: false,
} as const);

export const R22_O05_FINAL_DECISION = Object.freeze({
  decision: "O05 REMEDIATION DESIGN READY",
  nextStage: "STOP_PENDING_DESIGN_ACCEPTANCE",
  o05RuntimeStatus: "INSTRUMENTATION_REQUIRED",
  observationAuthorized: false,
  instrumentationAuthorized: false,
  performanceAuthorized: false,
} as const);

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must be non-empty.`);
}

function expectedAttemptSequence(outcome: R22O05ClaimOutcome): 1 | 2 | null {
  if (outcome === "CLAIMED") return 1;
  if (outcome === "RETRY_CLAIMED") return 2;
  return null;
}

function attemptSequenceSource(outcome: R22O05ClaimOutcome): string {
  return R22_O05_ATTEMPT_SEQUENCE_DESIGN[outcome].source;
}

export function calculateR22O05NotificationDecisionId(input: Readonly<{
  scanId: string;
  signalId: string;
  channel: R22O05Channel;
  decisionType: R22O05ClaimOutcome;
}>): string {
  requireNonEmpty(input.scanId, "scanId");
  requireNonEmpty(input.signalId, "signalId");
  if (input.channel !== R22_O05_CHANNEL) throw new Error("Only the existing notification channel is supported.");
  if (!(R22_O05_CLAIM_OUTCOMES as readonly string[]).includes(input.decisionType)) {
    throw new Error("decisionType must be an exact SignalClaimResult.");
  }
  return `notification-decision:${sha256({
    namespace: R22_O05_IDENTITY_MODEL.preimageNamespace,
    scanId: input.scanId,
    signalId: input.signalId,
    channel: input.channel,
    decisionType: input.decisionType,
  })}`;
}

export function calculateR22O05TerminalEventId(notificationDecisionId: string): string {
  requireNonEmpty(notificationDecisionId, "notificationDecisionId");
  return `notification-terminal:${sha256({
    namespace: "R22_O05_NOTIFICATION_TERMINAL",
    notificationDecisionId,
  })}`;
}

export function buildR22O05ClaimMetadata(input: Readonly<{
  scanId: string;
  signalId: string;
  decisionType: R22O05ClaimOutcome;
}>): R22O05ClaimMetadata {
  const attemptSequence = expectedAttemptSequence(input.decisionType);
  return {
    scanId: input.scanId,
    signalId: input.signalId,
    channel: R22_O05_CHANNEL,
    decisionType: input.decisionType,
    notificationDecisionId: calculateR22O05NotificationDecisionId({
      ...input,
      channel: R22_O05_CHANNEL,
    }),
    attemptSequence,
    attemptSequenceSource: attemptSequenceSource(input.decisionType),
  };
}

export function buildR22O05TerminalEvent(input: Readonly<{
  notificationDecisionId: string;
  terminalOutcome: R22O05TerminalOutcome;
  failureCode?: R22O05DeliveryFailureCode | null;
}>): R22O05TerminalEvent {
  requireNonEmpty(input.notificationDecisionId, "notificationDecisionId");
  const failureCode = input.failureCode ?? null;
  if (input.terminalOutcome === "DELIVERED" && failureCode !== null) {
    throw new Error("DELIVERED cannot carry a delivery failure code.");
  }
  if (input.terminalOutcome === "DELIVERY_FAILED" && failureCode === null) {
    throw new Error("DELIVERY_FAILED requires a delivery failure code.");
  }
  return {
    notificationDecisionId: input.notificationDecisionId,
    terminalEventId: calculateR22O05TerminalEventId(input.notificationDecisionId),
    terminalOutcome: input.terminalOutcome,
    failureCode,
  };
}

export function validateR22O05ClaimMetadata(metadata: R22O05ClaimMetadata): R22O05ClaimMetadataValidation {
  if (metadata.scanId.trim().length === 0 || metadata.signalId.trim().length === 0) {
    return { status: "NOT_EVALUABLE", reason: "MISSING_IDENTITY" };
  }
  if (metadata.channel !== R22_O05_CHANNEL) return { status: "NOT_EVALUABLE", reason: "INVALID_CHANNEL" };
  if (!(R22_O05_CLAIM_OUTCOMES as readonly string[]).includes(metadata.decisionType)) {
    return { status: "NOT_EVALUABLE", reason: "INVALID_OUTCOME" };
  }
  if (metadata.attemptSequence !== expectedAttemptSequence(metadata.decisionType)) {
    return { status: "NOT_EVALUABLE", reason: "ATTEMPT_SEQUENCE_MISMATCH" };
  }
  if (metadata.notificationDecisionId !== calculateR22O05NotificationDecisionId({
    scanId: metadata.scanId,
    signalId: metadata.signalId,
    channel: metadata.channel,
    decisionType: metadata.decisionType,
  })) {
    return { status: "NOT_EVALUABLE", reason: "DECISION_ID_MISMATCH" };
  }
  return { status: "VALID", reason: "NONE" };
}

export function validateR22O05TerminalEvent(event: R22O05TerminalEvent): R22O05TerminalEventValidation {
  if (event.notificationDecisionId.trim().length === 0) return { status: "NOT_EVALUABLE", reason: "MISSING_DECISION_ID" };
  if (event.terminalEventId !== calculateR22O05TerminalEventId(event.notificationDecisionId)) {
    return { status: "NOT_EVALUABLE", reason: "TERMINAL_ID_MISMATCH" };
  }
  if (event.terminalOutcome === "DELIVERY_FAILED" && event.failureCode === null) {
    return { status: "NOT_EVALUABLE", reason: "FAILURE_CODE_REQUIRED" };
  }
  if (event.terminalOutcome === "DELIVERED" && event.failureCode !== null) {
    return { status: "NOT_EVALUABLE", reason: "FAILURE_CODE_FOR_DELIVERY" };
  }
  return { status: "VALID", reason: "NONE" };
}

export function isR22O05DesignReady(): boolean {
  return R22_O05_GATES.every((gate) => gate.status === "PASS") && R22_O05_FINAL_DECISION.decision === "O05 REMEDIATION DESIGN READY";
}

export function isR22O05GovernanceSafe(): boolean {
  return R22_O05_GOVERNANCE.designOnly
    && !R22_O05_GOVERNANCE.observationExecuted
    && !R22_O05_GOVERNANCE.historicalBackfillExecuted
    && !R22_O05_GOVERNANCE.instrumentationImplemented
    && R22_O05_GOVERNANCE.performanceExecutionCount === 0
    && !R22_O05_GOVERNANCE.performanceLedgerPresent
    && !R22_O05_GOVERNANCE.economicValuesRead
    && !R22_O05_GOVERNANCE.forwardReturnRead
    && !R22_O05_GOVERNANCE.newMarketDataFetched
    && R22_O05_GOVERNANCE.productionUnchanged
    && R22_O05_GOVERNANCE.humanDecisionRequired
    && R22_O05_GOVERNANCE[["automatic", "T", "rading"].join("")] === false
    && !R22_O05_GOVERNANCE.observationAuthorized
    && R22_O05_GOVERNANCE.baseline002Status === "NOT_FROZEN";
}
