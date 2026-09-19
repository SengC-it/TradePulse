import {
  calculateNotificationTerminalEventId,
} from "../signal-advisory/notification-evidence.ts";
import {
  R22_ADVISORY_EVALUATION_QUALITY_GRADES,
  evaluateR22AdvisoryObservation,
  type R22AdvisoryEvaluationNotificationDisposition,
  type R22AdvisoryEvaluationObservation,
  type R22AdvisoryEvaluationResult,
} from "../research/advisory-evaluation-protocol.ts";
import {
  parseR22HumanReviewLabels,
  validateR22HumanReviewCandidate,
} from "../observation-evidence/human-review.ts";
import {
  R22_R8_NOTIFICATION_EVENT_TYPES,
} from "../observation-evidence/notification.ts";
import {
  R22_OBSERVATION_ARTIFACT_TYPES,
  type ObservationAdvisoryIdentity,
  type ObservationArtifactType,
  type ObservationEvidenceCandidate,
  type ObservationJsonValue,
} from "../observation-evidence/types.ts";
import {
  validateObservationAdvisoryIdentity,
  validateObservationEvidenceCandidate,
} from "../observation-evidence/validator.ts";

export type R22EvidenceCompletenessReason =
  | "NONE"
  | "INVALID_P01_IDENTITY"
  | "STORE_READ_FAILED"
  | "MISSING_EVIDENCE"
  | "DUPLICATE_LOGICAL_IDENTITY"
  | "IDENTITY_MISMATCH"
  | "INVALID_EVIDENCE"
  | "HASH_INVALID"
  | "PIT_INVALID"
  | "CAUSAL_INVALID"
  | "NOTIFICATION_IDENTITY_INVALID"
  | "REVIEW_IDENTITY_INVALID"
  | "FORBIDDEN_ECONOMIC_FIELD"
  | "SNAPSHOT_PAYLOAD_INVALID";

export type R22EvidenceInventoryItem = Readonly<{
  evidenceId: string;
  eventKind: ObservationEvidenceCandidate["eventKind"];
  artifactType: ObservationArtifactType | null;
  notificationObservationId: string | null;
  reviewObservationId: string | null;
  eventType: ObservationEvidenceCandidate["eventType"];
  sourceRef: string;
}>;

export type R22CompleteAdvisoryEvidence = Readonly<{
  identity: ObservationAdvisoryIdentity;
  qualitySnapshot: ObservationEvidenceCandidate;
  marketContext: ObservationEvidenceCandidate;
  riskAdvisory: ObservationEvidenceCandidate;
  historicalReviewMetadata: ObservationEvidenceCandidate;
  alertIntelligence: ObservationEvidenceCandidate;
  presentation: ObservationEvidenceCandidate;
  notifications: readonly ObservationEvidenceCandidate[];
  reviewStarted: ObservationEvidenceCandidate;
  reviewSubmitted: ObservationEvidenceCandidate;
}>;

export type R22EvidenceCompletenessResult = Readonly<{
  status: "OBSERVABLE" | "NOT_EVALUABLE";
  reason: R22EvidenceCompletenessReason;
  signalId: string;
  evidenceIds: readonly string[];
  evidenceInventory: readonly R22EvidenceInventoryItem[];
  evidence: R22CompleteAdvisoryEvidence | null;
  readOnly: true;
}>;

export type R22EvidenceCompletenessReadStore = Readonly<{
  findEvidenceBySignalId(signalId: string): Promise<readonly ObservationEvidenceCandidate[]>;
}>;

type JsonRecord = { readonly [key: string]: ObservationJsonValue };

type NotificationMetadata = Readonly<{
  candidate: ObservationEvidenceCandidate;
  eventType: string;
  decisionType: string;
  claimOutcome: string | null;
  terminal: Readonly<{
    notificationDecisionId: string;
    terminalEventId: string;
    terminalOutcome: "DELIVERED" | "DELIVERY_FAILED";
    failureCode: string | null;
  }> | null;
}>;

const DECISION_TYPES = new Set([
  "CLAIMED",
  "RETRY_CLAIMED",
  "SKIPPED_DUPLICATE",
  "SKIPPED_EXPIRED",
]);

const TERMINAL_EVENT_TYPES = new Set([
  "DELIVERED",
  "DELIVERY_FAILED",
  "DELIVERY_REGISTRY_PERSISTENCE_FAILED",
]);

function isRecord(value: ObservationJsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: ObservationJsonValue | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function recordField(record: JsonRecord, key: string): JsonRecord | null {
  return isRecord(record[key]) ? record[key] : null;
}

function identityMatchesCandidate(
  identity: ObservationAdvisoryIdentity,
  candidate: ObservationEvidenceCandidate,
): boolean {
  return candidate.signalId === identity.signalId
    && candidate.symbol === identity.symbol
    && candidate.direction === identity.direction
    && candidate.signalTime === identity.signalTime
    && candidate.strategyId === identity.strategyId
    && candidate.strategyVersion === identity.strategyVersion;
}

function inventory(candidates: readonly ObservationEvidenceCandidate[]): readonly R22EvidenceInventoryItem[] {
  return candidates.map((candidate) => ({
    evidenceId: candidate.evidenceId,
    eventKind: candidate.eventKind,
    artifactType: candidate.artifactType,
    notificationObservationId: candidate.notificationObservationId,
    reviewObservationId: candidate.reviewObservationId,
    eventType: candidate.eventType,
    sourceRef: candidate.sourceRef,
  }));
}

function failed(
  identity: ObservationAdvisoryIdentity,
  candidates: readonly ObservationEvidenceCandidate[],
  reason: Exclude<R22EvidenceCompletenessReason, "NONE">,
): R22EvidenceCompletenessResult {
  return {
    status: "NOT_EVALUABLE",
    reason,
    signalId: identity.signalId,
    evidenceIds: candidates.map((candidate) => candidate.evidenceId),
    evidenceInventory: inventory(candidates),
    evidence: null,
    readOnly: true,
  };
}

function validationReason(
  candidate: ObservationEvidenceCandidate,
): Exclude<R22EvidenceCompletenessReason, "NONE"> | null {
  const validation = validateObservationEvidenceCandidate(candidate);
  if (validation.status === "VALID") return null;
  if (validation.reason === "FORBIDDEN_ECONOMIC_FIELD") return "FORBIDDEN_ECONOMIC_FIELD";
  if (validation.reason === "CAUSAL_TIMESTAMP_INVALID") return "CAUSAL_INVALID";
  if (validation.reason === "SNAPSHOT_INVALID") {
    if (validation.snapshotReason?.includes("HASH") || validation.snapshotReason === "IDEMPOTENCY_KEY_MISMATCH") {
      return "HASH_INVALID";
    }
    if (validation.snapshotReason?.includes("INFORMATION") || validation.snapshotReason === "CAPTURE_BEFORE_SIGNAL") {
      return "PIT_INVALID";
    }
  }
  return "INVALID_EVIDENCE";
}

function snapshotPayloadContract(
  candidate: ObservationEvidenceCandidate,
  artifactType: ObservationArtifactType,
  identity: ObservationAdvisoryIdentity,
): boolean {
  if (candidate.eventKind !== "SNAPSHOT"
    || candidate.artifactType !== artifactType
    || candidate.artifactId === null
    || candidate.informationAsOf === null
    || candidate.contentHash === null
    || candidate.evidenceHash === null) {
    return false;
  }
  const payload = isRecord(candidate.payload) ? candidate.payload : null;
  if (payload === null
    || payload.humanDecisionRequired !== true
    || payload.automaticTrading !== false) {
    return false;
  }
  const payloadIdentityMatches = (record: JsonRecord | null): boolean => record !== null
    && record.signalId === identity.signalId
    && record.symbol === identity.symbol
    && record.direction === identity.direction
    && record.signalTime === identity.signalTime
    && record.strategyId === identity.strategyId
    && record.strategyVersion === identity.strategyVersion;
  if (artifactType === "QUALITY_SNAPSHOT") {
    return candidate.sourceRef === `tp_signal_advisories:${identity.signalId}`
      && R22_ADVISORY_EVALUATION_QUALITY_GRADES.includes(
      payload.qualityGrade as typeof R22_ADVISORY_EVALUATION_QUALITY_GRADES[number],
      )
      && nonEmpty(payload.qualityStatus)
      && Array.isArray(payload.explanations)
      && payload.explanations.every((value) => typeof value === "string");
  }
  if (artifactType === "MARKET_CONTEXT") {
    return candidate.sourceRef.startsWith("market-context-source:")
      && payload.symbol === identity.symbol
      && payload.direction === identity.direction
      && recordField(payload, "sourceManifest") !== null;
  }
  if (artifactType === "RISK_ADVISORY") {
    return candidate.sourceRef.startsWith("risk-advisory-source:")
      && payload.symbol === identity.symbol
      && payload.direction === identity.direction
      && recordField(payload, "geometry") !== null
      && recordField(payload, "sourceManifest") !== null;
  }
  if (artifactType === "HISTORICAL_REVIEW_METADATA") {
    return candidate.sourceRef.startsWith("historical-review-source:")
      && payloadIdentityMatches(recordField(payload, "currentIdentity"))
      && recordField(payload, "priorContext") !== null
      && payload.informationAsOf === candidate.informationAsOf;
  }
  if (artifactType === "ALERT_INTELLIGENCE") {
    const signal = recordField(payload, "signal");
    const alertIntelligence = recordField(payload, "alertIntelligence");
    return candidate.sourceRef.startsWith("alert-intelligence-source:")
      && signal !== null
      && signal.direction === identity.direction
      && alertIntelligence !== null
      && recordField(alertIntelligence, "explanation") !== null
      && recordField(payload, "sourceAdapters") !== null
      && Array.isArray(payload.inputManifest);
  }
  const presentation = recordField(payload, "presentation");
  const alertEvidence = recordField(payload, "alertIntelligenceEvidence");
  return candidate.sourceRef.startsWith("presentation-source:")
    && presentation !== null
    && (presentation.channel === "EMAIL" || presentation.channel === "WEB")
    && recordField(presentation, "payload") !== null
    && alertEvidence !== null
    && nonEmpty(alertEvidence.artifactId)
    && nonEmpty(alertEvidence.contentHash)
    && nonEmpty(alertEvidence.idempotencyKey);
}

function validateNotificationCandidate(
  identity: ObservationAdvisoryIdentity,
  candidate: ObservationEvidenceCandidate,
): NotificationMetadata | null {
  if (candidate.eventKind !== "NOTIFICATION"
    || candidate.artifactType !== null
    || candidate.notificationObservationId === null
    || candidate.observedAt === null
    || candidate.informationAsOf !== null
    || candidate.contentHash !== null
    || candidate.evidenceHash !== null
    || candidate.sourceRef !== `tp_signal_advisories:${identity.signalId}`) {
    return null;
  }
  const payload = isRecord(candidate.payload) ? candidate.payload : null;
  const advisoryIdentity = payload ? recordField(payload, "advisoryIdentity") : null;
  const notification = payload ? recordField(payload, "notification") : null;
  if (payload === null
    || payload.source !== "R22_O05_NOTIFICATION_EVIDENCE"
    || payload.humanDecisionRequired !== true
    || payload.automaticTrading !== false
    || advisoryIdentity === null
    || notification === null
    || !identityMatchesCandidate(identity, {
      ...candidate,
      signalId: typeof advisoryIdentity.signalId === "string" ? advisoryIdentity.signalId : "",
      symbol: advisoryIdentity.symbol as ObservationEvidenceCandidate["symbol"],
      direction: advisoryIdentity.direction as ObservationEvidenceCandidate["direction"],
      signalTime: typeof advisoryIdentity.signalTime === "string" ? advisoryIdentity.signalTime : "",
      strategyId: typeof advisoryIdentity.strategyId === "string" ? advisoryIdentity.strategyId : "",
      strategyVersion: typeof advisoryIdentity.strategyVersion === "string" ? advisoryIdentity.strategyVersion : "",
    })
    || !nonEmpty(notification.notificationDecisionId)
    || !R22_R8_NOTIFICATION_EVENT_TYPES.includes(notification.eventType as typeof R22_R8_NOTIFICATION_EVENT_TYPES[number])
    || notification.channel !== "EMAIL"
    || !nonEmpty(notification.decisionType)
    || !DECISION_TYPES.has(notification.decisionType)
    || !nonEmpty(notification.attemptSequenceSource)) {
    return null;
  }

  const expectedAttemptSequence = notification.decisionType === "CLAIMED"
    ? 1
    : notification.decisionType === "RETRY_CLAIMED"
      ? 2
      : null;
  if (notification.attemptSequence !== expectedAttemptSequence) return null;

  const eventTypeValue = notification.eventType;
  const decisionTypeValue = notification.decisionType;
  if (typeof eventTypeValue !== "string" || typeof decisionTypeValue !== "string") return null;
  const eventType = eventTypeValue;
  const decisionType = decisionTypeValue;
  const claimOutcome = typeof notification.claimOutcome === "string" ? notification.claimOutcome : null;
  if (eventType === "CLAIM_DECISION") {
    const expectedOutcome = decisionType === "SKIPPED_DUPLICATE"
      ? "DUPLICATE_SKIPPED"
      : decisionType === "SKIPPED_EXPIRED"
        ? "SUPPRESSED"
        : decisionType;
    if (claimOutcome !== expectedOutcome) return null;
    if (decisionType === "SKIPPED_EXPIRED" && notification.suppressionReason !== "EXPIRED") return null;
    if (decisionType === "SKIPPED_DUPLICATE" && notification.suppressionReason !== null) return null;
  } else if (!((decisionType === "CLAIMED" || decisionType === "RETRY_CLAIMED")
    && (eventType === "DELIVERY_ATTEMPTED" || TERMINAL_EVENT_TYPES.has(eventType)))) {
    return null;
  }

  if (!TERMINAL_EVENT_TYPES.has(eventType)) {
    if (notification.terminalEventId !== null
      || notification.terminalOutcome !== null
      || notification.failureCode !== null
      || notification.technicalCode !== null) {
      return null;
    }
    return { candidate, eventType, decisionType, claimOutcome, terminal: null };
  }

  const terminalEventId = notification.terminalEventId;
  const terminalOutcome = notification.terminalOutcome;
  const failureCode = notification.failureCode;
  if (!nonEmpty(terminalEventId)
    || !nonEmpty(notification.notificationDecisionId)
    || terminalEventId !== calculateNotificationTerminalEventId(notification.notificationDecisionId)
    || (terminalOutcome !== "DELIVERED" && terminalOutcome !== "DELIVERY_FAILED")) {
    return null;
  }
  if (eventType === "DELIVERY_FAILED") {
    if (terminalOutcome !== "DELIVERY_FAILED" || !nonEmpty(failureCode)) return null;
  } else if (terminalOutcome !== "DELIVERED" || failureCode !== null) {
    return null;
  }
  if (eventType === "DELIVERY_REGISTRY_PERSISTENCE_FAILED"
    && notification.technicalCode !== "DELIVERY_REGISTRY_PERSISTENCE_FAILED") {
    return null;
  }
  return {
    candidate,
    eventType,
    decisionType,
    claimOutcome,
    terminal: {
      notificationDecisionId: notification.notificationDecisionId,
      terminalEventId,
      terminalOutcome,
      failureCode,
    },
  };
}

function validReviewPayload(
  candidate: ObservationEvidenceCandidate,
): boolean {
  const payload = isRecord(candidate.payload) ? candidate.payload : null;
  return payload !== null
    && payload.reviewLifecycle === "R22_HUMAN_REVIEW"
    && payload.eventType === candidate.eventType
    && payload.humanDecisionRequired === true
    && payload.automaticTrading === false;
}

function notificationDisposition(
  notifications: readonly NotificationMetadata[],
): R22AdvisoryEvaluationNotificationDisposition | null {
  if (notifications.some((metadata) => metadata.terminal?.terminalOutcome === "DELIVERED")) {
    return "DELIVERED";
  }
  if (notifications.some((metadata) => metadata.terminal?.terminalOutcome === "DELIVERY_FAILED")) {
    return "SUPPRESSED";
  }
  if (notifications.some((metadata) => metadata.claimOutcome === "DUPLICATE_SKIPPED")) {
    return "DUPLICATE_SKIPPED";
  }
  if (notifications.some((metadata) => metadata.claimOutcome === "SUPPRESSED")) return "SUPPRESSED";
  return null;
}

function reviewIdentityCandidate(
  candidate: ObservationEvidenceCandidate,
): boolean {
  return candidate.eventKind === "REVIEW"
    && candidate.reviewObservationId !== null
    && candidate.eventType !== null
    && candidate.sourceRef === `tp_signal_advisories:${candidate.signalId}`
    && validateR22HumanReviewCandidate(candidate).status === "OBSERVABLE"
    && validReviewPayload(candidate);
}

function duplicateIdentity(
  candidates: readonly ObservationEvidenceCandidate[],
): boolean {
  const evidenceIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  const artifactIds = new Set<string>();
  const notificationIds = new Set<string>();
  const reviewIds = new Set<string>();
  for (const candidate of candidates) {
    if (evidenceIds.has(candidate.evidenceId) || idempotencyKeys.has(candidate.idempotencyKey)) return true;
    evidenceIds.add(candidate.evidenceId);
    idempotencyKeys.add(candidate.idempotencyKey);
    if (candidate.artifactId !== null) {
      if (artifactIds.has(candidate.artifactId)) return true;
      artifactIds.add(candidate.artifactId);
    }
    if (candidate.notificationObservationId !== null) {
      if (notificationIds.has(candidate.notificationObservationId)) return true;
      notificationIds.add(candidate.notificationObservationId);
    }
    if (candidate.reviewObservationId !== null && candidate.eventType !== null) {
      const reviewKey = `${candidate.reviewObservationId}|${candidate.eventType}`;
      if (reviewIds.has(reviewKey)) return true;
      reviewIds.add(reviewKey);
    }
  }
  return false;
}

function validateTerminalConflicts(
  notifications: readonly NotificationMetadata[],
): boolean {
  const terminalById = new Map<string, string>();
  for (const metadata of notifications) {
    if (metadata.terminal === null) continue;
    const payload = `${metadata.terminal.terminalOutcome}|${metadata.terminal.failureCode ?? ""}`;
    const existing = terminalById.get(metadata.terminal.terminalEventId);
    if (existing !== undefined && existing !== payload) return false;
    terminalById.set(metadata.terminal.terminalEventId, payload);
  }
  return true;
}

function completeResult(
  identity: ObservationAdvisoryIdentity,
  candidates: readonly ObservationEvidenceCandidate[],
  evidence: R22CompleteAdvisoryEvidence,
): R22EvidenceCompletenessResult {
  return {
    status: "OBSERVABLE",
    reason: "NONE",
    signalId: identity.signalId,
    evidenceIds: candidates.map((candidate) => candidate.evidenceId),
    evidenceInventory: inventory(candidates),
    evidence,
    readOnly: true,
  };
}

export function evaluateR22AdvisoryEvidenceCompleteness(
  identity: ObservationAdvisoryIdentity,
  candidates: readonly ObservationEvidenceCandidate[],
): R22EvidenceCompletenessResult {
  if (!validateObservationAdvisoryIdentity(identity)) {
    return failed(identity, candidates, "INVALID_P01_IDENTITY");
  }
  if (candidates.length === 0) return failed(identity, candidates, "MISSING_EVIDENCE");

  for (const candidate of candidates) {
    if (!identityMatchesCandidate(identity, candidate)) {
      return failed(identity, candidates, "IDENTITY_MISMATCH");
    }
    const reason = validationReason(candidate);
    if (reason !== null) return failed(identity, candidates, reason);
  }
  if (duplicateIdentity(candidates)) return failed(identity, candidates, "DUPLICATE_LOGICAL_IDENTITY");

  const snapshots = new Map<ObservationArtifactType, ObservationEvidenceCandidate>();
  for (const candidate of candidates) {
    if (candidate.eventKind === "SNAPSHOT") {
      if (candidate.artifactType === null
        || !R22_OBSERVATION_ARTIFACT_TYPES.includes(candidate.artifactType)) {
        return failed(identity, candidates, "INVALID_EVIDENCE");
      }
      if (snapshots.has(candidate.artifactType)) {
        return failed(identity, candidates, "DUPLICATE_LOGICAL_IDENTITY");
      }
      snapshots.set(candidate.artifactType, candidate);
    } else if (candidate.eventKind === "INSTRUMENTATION_FAILURE") {
      return failed(identity, candidates, "INVALID_EVIDENCE");
    }
  }

  for (const artifactType of R22_OBSERVATION_ARTIFACT_TYPES) {
    const candidate = snapshots.get(artifactType);
    if (candidate === undefined) return failed(identity, candidates, "MISSING_EVIDENCE");
    if (!snapshotPayloadContract(candidate, artifactType, identity)) {
      return failed(identity, candidates, "SNAPSHOT_PAYLOAD_INVALID");
    }
  }

  const notifications = candidates
    .filter((candidate) => candidate.eventKind === "NOTIFICATION")
    .map((candidate) => validateNotificationCandidate(identity, candidate));
  if (notifications.some((metadata): metadata is null => metadata === null)) {
    return failed(identity, candidates, "NOTIFICATION_IDENTITY_INVALID");
  }
  const validNotifications = notifications as NotificationMetadata[];
  if (validNotifications.length === 0
    || notificationDisposition(validNotifications) === null
    || !validateTerminalConflicts(validNotifications)) {
    return failed(identity, candidates, "NOTIFICATION_IDENTITY_INVALID");
  }

  const reviews = candidates.filter((candidate) => candidate.eventKind === "REVIEW");
  if (reviews.some((candidate) => !reviewIdentityCandidate(candidate))) {
    return failed(identity, candidates, "REVIEW_IDENTITY_INVALID");
  }
  const reviewStarted = reviews.filter((candidate) => candidate.eventType === "REVIEW_STARTED");
  const reviewSubmitted = reviews.filter((candidate) => candidate.eventType === "REVIEW_SUBMITTED");
  if (reviewStarted.length !== 1 || reviewSubmitted.length !== 1) {
    return failed(identity, candidates, "MISSING_EVIDENCE");
  }
  const submittedPayload = isRecord(reviewSubmitted[0]!.payload)
    ? reviewSubmitted[0]!.payload
    : null;
  const labels = submittedPayload ? parseR22HumanReviewLabels(submittedPayload.humanReview ?? null) : null;
  if (labels === null || typeof submittedPayload?.decisionLatencyProxyMs !== "number") {
    return failed(identity, candidates, "REVIEW_IDENTITY_INVALID");
  }

  return completeResult(identity, candidates, {
    identity,
    qualitySnapshot: snapshots.get("QUALITY_SNAPSHOT")!,
    marketContext: snapshots.get("MARKET_CONTEXT")!,
    riskAdvisory: snapshots.get("RISK_ADVISORY")!,
    historicalReviewMetadata: snapshots.get("HISTORICAL_REVIEW_METADATA")!,
    alertIntelligence: snapshots.get("ALERT_INTELLIGENCE")!,
    presentation: snapshots.get("PRESENTATION")!,
    notifications: validNotifications.map((metadata) => metadata.candidate),
    reviewStarted: reviewStarted[0]!,
    reviewSubmitted: reviewSubmitted[0]!,
  });
}

export async function resolveR22AdvisoryEvidenceCompleteness(input: Readonly<{
  identity: ObservationAdvisoryIdentity;
  evidenceStore: R22EvidenceCompletenessReadStore;
}>): Promise<R22EvidenceCompletenessResult> {
  let candidates: readonly ObservationEvidenceCandidate[];
  try {
    candidates = await input.evidenceStore.findEvidenceBySignalId(input.identity.signalId);
  } catch {
    return failed(input.identity, [], "STORE_READ_FAILED");
  }
  return evaluateR22AdvisoryEvidenceCompleteness(input.identity, candidates);
}

function payload(candidate: ObservationEvidenceCandidate): JsonRecord {
  return isRecord(candidate.payload) ? candidate.payload : {};
}

function hasText(record: JsonRecord | null, key: string): boolean {
  return record !== null && nonEmpty(record[key]);
}

function mapCompleteEvidenceToObservation(
  complete: R22CompleteAdvisoryEvidence,
): R22AdvisoryEvaluationObservation {
  const qualityPayload = payload(complete.qualitySnapshot);
  const marketPayload = payload(complete.marketContext);
  const riskPayload = payload(complete.riskAdvisory);
  const historicalPayload = payload(complete.historicalReviewMetadata);
  const alertPayload = payload(complete.alertIntelligence);
  const presentationPayload = payload(complete.presentation);
  const alertIntelligence = recordField(alertPayload, "alertIntelligence");
  const explanation = alertIntelligence ? recordField(alertIntelligence, "explanation") : null;
  const presentation = recordField(presentationPayload, "presentation");
  const renderedPresentation = presentation ? recordField(presentation, "payload") : null;
  const historicalIdentity = recordField(historicalPayload, "currentIdentity");
  const historicalContext = recordField(historicalPayload, "priorContext");
  const submitPayload = payload(complete.reviewSubmitted);
  const labels = parseR22HumanReviewLabels(submitPayload.humanReview ?? null);
  const notificationMetadata = complete.notifications
    .map((candidate) => validateNotificationCandidate(complete.identity, candidate))
    .filter((metadata): metadata is NotificationMetadata => metadata !== null);
  const notification = notificationDisposition(notificationMetadata);
  const grade = qualityPayload.qualityGrade;
  const qualityGrade = R22_ADVISORY_EVALUATION_QUALITY_GRADES.includes(
    grade as typeof R22_ADVISORY_EVALUATION_QUALITY_GRADES[number],
  ) ? grade as typeof R22_ADVISORY_EVALUATION_QUALITY_GRADES[number] : null;
  return {
    signal: {
      direction: complete.identity.direction,
      identityKey: complete.identity.signalId,
    },
    qualitySnapshot: { available: true, grade: qualityGrade },
    marketContext: { available: Object.keys(marketPayload).length > 0 },
    riskAdvisory: { available: Object.keys(riskPayload).length > 0 },
    historicalReview: {
      status: "IDENTITY_ONLY",
      identityMetadataPresent: historicalIdentity !== null && historicalContext !== null,
    },
    presentation: {
      signalClarity: complete.identity.signalId.length > 0 && complete.identity.direction !== undefined,
      explanationCompleteness: hasText(explanation, "whyTriggered")
        && hasText(explanation, "currentEnvironment")
        && hasText(explanation, "risk")
        && hasText(explanation, "historicalReference"),
      riskVisibility: hasText(explanation, "risk") && Object.keys(riskPayload).length > 0,
      contextCompleteness: hasText(explanation, "currentEnvironment")
        && Object.keys(marketPayload).length > 0
        && renderedPresentation !== null,
      unnecessaryAlert: labels?.unnecessaryAlert ?? false,
      notificationDisposition: notification ?? "IGNORED",
    },
    humanReview: {
      reviewComplete: labels?.reviewComplete ?? false,
      informationSufficient: labels?.informationSufficient ?? false,
      decisionLatencyProxyMs: typeof submitPayload.decisionLatencyProxyMs === "number"
        ? submitPayload.decisionLatencyProxyMs
        : null,
    },
  };
}

export function evaluateR22CompleteAdvisoryEvidence(
  completeness: R22EvidenceCompletenessResult,
): R22AdvisoryEvaluationResult {
  if (completeness.status !== "OBSERVABLE" || completeness.evidence === null) {
    return {
      status: "NOT_EVALUABLE",
      reason: "INCOMPLETE_EVIDENCE_CHAIN",
      direction: "NO_SIGNAL",
      identityKey: completeness.signalId,
      metrics: null,
      observedOnly: true,
      humanDecisionRequired: true,
      automaticTrading: false,
    };
  }
  return evaluateR22AdvisoryObservation(mapCompleteEvidenceToObservation(completeness.evidence));
}
