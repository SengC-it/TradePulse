import { RESEARCH_SYMBOLS } from "../config/constants.ts";

import {
  calculateObservationSnapshotContentHash,
  calculateObservationSnapshotEvidenceHash,
  calculateObservationSnapshotIdempotencyKey,
  R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
} from "./snapshot.ts";
import {
  R22_OBSERVATION_ARTIFACT_TYPES,
  R22_OBSERVATION_EVENT_KINDS,
  type ObservationAdvisoryIdentity,
  type ObservationCausalTimestampInput,
  type ObservationCausalValidation,
  type ObservationEvidenceCandidate,
  type ObservationEvidenceValidation,
  type ObservationSnapshotArtifact,
  type ObservationSnapshotValidation,
  type ObservationTimestampAuthority,
} from "./types.ts";
import { isCanonicalJsonValue } from "./canonical.ts";

const FORBIDDEN_FIELD_NAMES = new Set([
  "pnl",
  "profit",
  "loss",
  "return",
  "forwardreturn",
  "futureprice",
  "futurecandle",
  "win",
  "losslabel",
  "takeprofithit",
  "stoplosshit",
  "profitfactor",
  "sharpe",
  "calmar",
  "drawdown",
  "expectedreturn",
  "tradeoutcome",
  "economicoutcome",
  "realizedpnl",
  "unrealizedpnl",
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedFieldName(value: string): string {
  return value.replace(/[_.-]/g, "").toLowerCase();
}

function forbiddenField(value: unknown, path = "payload"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = forbiddenField(value[index], `${path}[${index}]`);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizedFieldName(key);
    if (FORBIDDEN_FIELD_NAMES.has(normalized)) {
      return `${path}.${key}`;
    }
    const found = forbiddenField(child, `${path}.${key}`);
    if (found !== null) return found;
  }
  return null;
}

export function findForbiddenObservationEconomicField(value: unknown): string | null {
  return forbiddenField(value);
}

export function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function atOrBefore(left: string, right: string): boolean {
  return Date.parse(left) <= Date.parse(right);
}

export function validateObservationAdvisoryIdentity(
  identity: ObservationAdvisoryIdentity,
): boolean {
  return nonEmpty(identity.signalId)
    && (RESEARCH_SYMBOLS as readonly string[]).includes(identity.symbol)
    && (identity.direction === "LONG" || identity.direction === "SHORT")
    && isCanonicalUtcTimestamp(identity.signalTime)
    && nonEmpty(identity.strategyId)
    && nonEmpty(identity.strategyVersion);
}

function invalidCausality(reason: ObservationCausalValidation["reason"]): ObservationCausalValidation {
  return { status: "NOT_EVALUABLE", reason };
}

export function validateObservationCausalTimestamps(
  input: ObservationCausalTimestampInput,
): ObservationCausalValidation {
  const timestamps = [
    input.signalTime,
    input.informationAsOf,
    input.capturedAt,
    input.advisoryCreationTime ?? null,
    input.notificationObservedAt ?? null,
    input.reviewStartedAt ?? null,
    input.reviewSubmittedAt ?? null,
  ];
  if (!isCanonicalUtcTimestamp(input.signalTime)
    || timestamps.some((value) => value !== null && !isCanonicalUtcTimestamp(value))) {
    return invalidCausality("INVALID_TIMESTAMP");
  }
  if (input.capturedAt === null
    || (input.requireSnapshotPIT !== false && input.informationAsOf === null)) {
    return invalidCausality("INVALID_TIMESTAMP");
  }
  if (input.informationAsOf !== null && !atOrBefore(input.informationAsOf, input.signalTime)) {
    return invalidCausality("INFORMATION_AFTER_SIGNAL");
  }
  if (input.informationAsOf !== null && !atOrBefore(input.informationAsOf, input.capturedAt)) {
    return invalidCausality("CAPTURE_BEFORE_INFORMATION_AS_OF");
  }
  if (!atOrBefore(input.signalTime, input.capturedAt)) {
    return invalidCausality("CAPTURE_BEFORE_SIGNAL");
  }
  if (input.advisoryCreationTime !== undefined
    && input.advisoryCreationTime !== null
    && !atOrBefore(input.signalTime, input.advisoryCreationTime)) {
    return invalidCausality("ADVISORY_BEFORE_SIGNAL");
  }
  if (input.notificationObservedAt !== undefined
    && input.notificationObservedAt !== null
    && !atOrBefore(input.signalTime, input.notificationObservedAt)) {
    return invalidCausality("NOTIFICATION_BEFORE_SIGNAL");
  }
  if (input.reviewStartedAt !== undefined
    && input.reviewStartedAt !== null
    && !atOrBefore(input.signalTime, input.reviewStartedAt)) {
    return invalidCausality("REVIEW_BEFORE_SIGNAL");
  }
  if (input.reviewSubmittedAt !== undefined && input.reviewSubmittedAt !== null) {
    if (input.reviewStartedAt === undefined || input.reviewStartedAt === null) {
      return invalidCausality("REVIEW_START_REQUIRED");
    }
    if (!atOrBefore(input.reviewStartedAt, input.reviewSubmittedAt)) {
      return invalidCausality("REVIEW_TIMESTAMP_INVERSION");
    }
  }
  return { status: "VALID", reason: "NONE" };
}

function timestampAuthorityValid(authority: ObservationTimestampAuthority): boolean {
  return authority.capturedAtAuthority === "SERVER_WALL_CLOCK"
    && authority.informationAsOfAuthority === "SERVER_SOURCE_CUTOFF"
    && authority.userSuppliedCapturedAt === false
    && authority.userSuppliedInformationAsOf === false
    && authority.backdated === false;
}

function snapshotFailure(
  artifact: ObservationSnapshotArtifact,
  reason: ObservationSnapshotValidation["reason"],
  extras: Partial<Omit<ObservationSnapshotValidation, "status" | "artifactId" | "reason">> = {},
): ObservationSnapshotValidation {
  return {
    status: "NOT_EVALUABLE",
    artifactId: artifact.artifactId,
    reason,
    forbiddenField: null,
    expectedContentHash: null,
    expectedEvidenceHash: null,
    expectedIdempotencyKey: null,
    ...extras,
  };
}

export function validateObservationSnapshot(
  artifact: ObservationSnapshotArtifact,
): ObservationSnapshotValidation {
  if (!nonEmpty(artifact.evidenceId)
    || !nonEmpty(artifact.artifactId)
    || !nonEmpty(artifact.signalId)
    || artifact.signalId !== artifact.advisoryIdentity.signalId
    || !validateObservationAdvisoryIdentity(artifact.advisoryIdentity)) {
    return snapshotFailure(artifact, "MISSING_IDENTITY");
  }
  if (!R22_OBSERVATION_ARTIFACT_TYPES.includes(artifact.artifactType)) {
    return snapshotFailure(artifact, "INVALID_ARTIFACT_TYPE");
  }
  if (artifact.schemaVersion !== R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION) {
    return snapshotFailure(artifact, "INVALID_SCHEMA_VERSION");
  }
  if (!nonEmpty(artifact.sourceRef) || !nonEmpty(artifact.idempotencyKey)) {
    return snapshotFailure(artifact, "MISSING_PROVENANCE");
  }
  if (!isCanonicalJsonValue(artifact.payload)) {
    return snapshotFailure(artifact, "NON_CANONICAL_PAYLOAD");
  }
  const causal = validateObservationCausalTimestamps({
    signalTime: artifact.advisoryIdentity.signalTime,
    informationAsOf: artifact.informationAsOf,
    capturedAt: artifact.capturedAt,
  });
  if (causal.status !== "VALID") {
    return snapshotFailure(artifact, causal.reason === "INFORMATION_AFTER_SIGNAL"
      ? "INFORMATION_AFTER_SIGNAL"
      : causal.reason === "CAPTURE_BEFORE_INFORMATION_AS_OF"
        ? "CAPTURE_BEFORE_INFORMATION_AS_OF"
        : causal.reason === "CAPTURE_BEFORE_SIGNAL"
          ? "CAPTURE_BEFORE_SIGNAL"
          : "INVALID_TIMESTAMP");
  }
  if (!timestampAuthorityValid(artifact.timestampAuthority)) {
    return snapshotFailure(artifact, "TIMESTAMP_AUTHORITY_INVALID");
  }
  const prohibited = forbiddenField(artifact.payload);
  if (prohibited !== null) {
    return snapshotFailure(artifact, "FORBIDDEN_ECONOMIC_FIELD", { forbiddenField: prohibited });
  }
  if (!/^[a-f0-9]{64}$/i.test(artifact.contentHash)) {
    return snapshotFailure(artifact, "CONTENT_HASH_INVALID");
  }
  const expectedContentHash = calculateObservationSnapshotContentHash(artifact);
  if (expectedContentHash !== artifact.contentHash.toLowerCase()) {
    return snapshotFailure(artifact, "CONTENT_HASH_MISMATCH", { expectedContentHash });
  }
  if (!/^[a-f0-9]{64}$/i.test(artifact.evidenceHash)) {
    return snapshotFailure(artifact, "EVIDENCE_HASH_INVALID", { expectedContentHash });
  }
  const expectedEvidenceHash = calculateObservationSnapshotEvidenceHash(artifact);
  if (expectedEvidenceHash !== artifact.evidenceHash.toLowerCase()) {
    return snapshotFailure(artifact, "EVIDENCE_HASH_MISMATCH", {
      expectedContentHash,
      expectedEvidenceHash,
    });
  }
  const expectedIdempotencyKey = calculateObservationSnapshotIdempotencyKey({
    signalId: artifact.signalId,
    artifactType: artifact.artifactType,
    schemaVersion: artifact.schemaVersion,
    informationAsOf: artifact.informationAsOf,
    contentHash: artifact.contentHash,
  });
  if (expectedIdempotencyKey !== artifact.idempotencyKey) {
    return snapshotFailure(artifact, "IDEMPOTENCY_KEY_MISMATCH", {
      expectedContentHash,
      expectedEvidenceHash,
      expectedIdempotencyKey,
    });
  }
  if (artifact.persistenceOperation !== "APPEND"
    || (artifact.supersedesArtifactId !== null && artifact.supersedesArtifactId === artifact.artifactId)) {
    return snapshotFailure(artifact, "APPEND_ONLY_VIOLATION");
  }
  return {
    status: "OBSERVABLE",
    artifactId: artifact.artifactId,
    reason: "NONE",
    forbiddenField: null,
    expectedContentHash,
    expectedEvidenceHash,
    expectedIdempotencyKey,
  };
}

function candidateSnapshot(candidate: ObservationEvidenceCandidate): ObservationSnapshotArtifact {
  return {
    evidenceId: candidate.evidenceId,
    artifactId: candidate.artifactId ?? "",
    artifactType: candidate.artifactType ?? "QUALITY_SNAPSHOT",
    schemaVersion: candidate.schemaVersion,
    advisoryIdentity: {
      signalId: candidate.signalId,
      symbol: candidate.symbol,
      direction: candidate.direction,
      signalTime: candidate.signalTime,
      strategyId: candidate.strategyId,
      strategyVersion: candidate.strategyVersion,
    },
    signalId: candidate.signalId,
    informationAsOf: candidate.informationAsOf ?? "",
    capturedAt: candidate.capturedAt,
    sourceRef: candidate.sourceRef,
    payload: candidate.payload,
    contentHash: candidate.contentHash ?? "",
    evidenceHash: candidate.evidenceHash ?? "",
    idempotencyKey: candidate.idempotencyKey,
    supersedesArtifactId: candidate.supersedesArtifactId,
    timestampAuthority: candidate.timestampAuthority,
    persistenceOperation: candidate.persistenceOperation,
  };
}

function evidenceFailure(
  reason: ObservationEvidenceValidation["reason"],
  candidate: ObservationEvidenceCandidate,
  extras: Partial<Omit<ObservationEvidenceValidation, "status" | "reason">> = {},
): ObservationEvidenceValidation {
  return {
    status: "NOT_EVALUABLE",
    reason,
    forbiddenField: null,
    causalReason: "NONE",
    snapshotReason: null,
    ...extras,
  };
}

export function validateObservationEvidenceCandidate(
  candidate: ObservationEvidenceCandidate,
): ObservationEvidenceValidation {
  if (!R22_OBSERVATION_EVENT_KINDS.includes(candidate.eventKind)) {
    return evidenceFailure("INVALID_EVENT_KIND", candidate);
  }
  if (candidate.schemaVersion !== R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION) {
    return evidenceFailure("INVALID_SCHEMA_VERSION", candidate);
  }
  if (!nonEmpty(candidate.evidenceId)
    || !nonEmpty(candidate.signalId)
    || !validateObservationAdvisoryIdentity({
      signalId: candidate.signalId,
      symbol: candidate.symbol,
      direction: candidate.direction,
      signalTime: candidate.signalTime,
      strategyId: candidate.strategyId,
      strategyVersion: candidate.strategyVersion,
    })
    || !nonEmpty(candidate.sourceRef)
    || !nonEmpty(candidate.idempotencyKey)) {
    return evidenceFailure("MISSING_IDENTITY", candidate);
  }
  if (!isCanonicalJsonValue(candidate.payload)) {
    return evidenceFailure("NON_CANONICAL_PAYLOAD", candidate);
  }
  const prohibited = forbiddenField(candidate.payload);
  if (prohibited !== null) {
    return evidenceFailure("FORBIDDEN_ECONOMIC_FIELD", candidate, { forbiddenField: prohibited });
  }
  const causal = validateObservationCausalTimestamps({
    signalTime: candidate.signalTime,
    informationAsOf: candidate.informationAsOf,
    capturedAt: candidate.capturedAt,
    requireSnapshotPIT: candidate.eventKind === "SNAPSHOT",
    notificationObservedAt: candidate.observedAt,
    reviewStartedAt: candidate.reviewStartedAt,
    reviewSubmittedAt: candidate.reviewSubmittedAt,
  });
  if (causal.status !== "VALID") {
    return evidenceFailure("CAUSAL_TIMESTAMP_INVALID", candidate, { causalReason: causal.reason });
  }
  if (!timestampAuthorityValid(candidate.timestampAuthority)) {
    return evidenceFailure("TIMESTAMP_AUTHORITY_INVALID", candidate);
  }
  if (candidate.persistenceOperation !== "APPEND"
    || candidate.supersedesEvidenceId === candidate.evidenceId) {
    return evidenceFailure("APPEND_ONLY_VIOLATION", candidate);
  }
  if (candidate.eventKind === "SNAPSHOT") {
    const snapshot = validateObservationSnapshot(candidateSnapshot(candidate));
    if (snapshot.status !== "OBSERVABLE") {
      return evidenceFailure("SNAPSHOT_INVALID", candidate, { snapshotReason: snapshot.reason });
    }
  }
  return {
    status: "VALID",
    reason: "NONE",
    forbiddenField: null,
    causalReason: "NONE",
    snapshotReason: null,
  };
}
