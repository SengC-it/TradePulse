import { describe, expect, it } from "vitest";

import {
  R22_APPEND_ONLY_POLICY,
  R22_FAILURE_ISOLATION,
  R22_IDEMPOTENCY_DESIGN,
  R22_INSTRUMENTATION_GATES,
  R22_NOTIFICATION_ATTEMPT_SEQUENCE_SOURCE,
  R22_NOTIFICATION_RUNTIME_MAPPING,
  R22_OBSERVATION_INSTRUMENTATION_ACCEPTED_SOURCE,
  R22_OBSERVATION_INSTRUMENTATION_FINAL_DECISION,
  R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE,
  R22_OBSERVATION_INSTRUMENTATION_SCHEMA_VERSION,
  R22_PERSISTENCE_DESIGN,
  R22_SERVER_TIMESTAMP_POLICY,
  R22_SNAPSHOT_ARTIFACT_TYPES,
  R22_TIMESTAMP_DESIGNS,
  calculateR22HumanReviewIdempotencyKey,
  calculateR22NotificationIdempotencyKey,
  calculateR22SnapshotContentHash,
  calculateR22SnapshotEvidenceHash,
  calculateR22SnapshotIdempotencyKey,
  isR22ObservationInstrumentationDesignReady,
  isR22ObservationInstrumentationGovernanceSafe,
  validateR22AppendOnlyWrite,
  validateR22HumanReviewObservation,
  validateR22NotificationObservation,
  validateR22SnapshotArtifact,
  type R22AdvisoryIdentity,
  type R22HumanReviewObservation,
  type R22NotificationObservation,
  type R22SnapshotArtifact,
} from "@/lib/research/round-022-observation-instrumentation-protocol";

const signalTime = "2026-01-01T00:00:00.000Z";
const identity: R22AdvisoryIdentity = {
  signalId: "signal-001",
  symbol: "BTCUSDT",
  direction: "LONG",
  signalTime,
  strategyId: "baseline-001",
  strategyVersion: "baseline-001",
};
const timestampAuthority = {
  capturedAtAuthority: "SERVER_WALL_CLOCK" as const,
  informationAsOfAuthority: "SERVER_SOURCE_CUTOFF" as const,
  userSuppliedCapturedAt: false as const,
  userSuppliedInformationAsOf: false as const,
  backdated: false as const,
};

function artifact(overrides: Partial<R22SnapshotArtifact> = {}): R22SnapshotArtifact {
  const base = {
    evidenceId: "evidence-001",
    artifactId: "artifact-001",
    artifactType: "QUALITY_SNAPSHOT" as const,
    schemaVersion: R22_OBSERVATION_INSTRUMENTATION_SCHEMA_VERSION,
    advisoryIdentity: identity,
    informationAsOf: "2025-12-31T23:59:00.000Z",
    capturedAt: "2026-01-01T00:00:02.000Z",
    sourceRef: "src/lib/signal-quality/evaluator.ts",
    contentHash: "",
    evidenceHash: "",
    payload: { grade: "A", explanationCode: "CONTEXT_ALIGNED" },
    idempotencyKey: "",
    supersedesArtifactId: null,
    timestampAuthority,
    persistenceOperation: "APPEND" as const,
  };
  const merged = { ...base, ...overrides };
  const contentHash = overrides.contentHash ?? calculateR22SnapshotContentHash(merged);
  const idempotencyKey = overrides.idempotencyKey ?? calculateR22SnapshotIdempotencyKey({
    signalId: merged.advisoryIdentity.signalId,
    artifactType: merged.artifactType,
    schemaVersion: merged.schemaVersion,
    informationAsOf: merged.informationAsOf,
    contentHash,
  });
  const evidenceHash = overrides.evidenceHash ?? calculateR22SnapshotEvidenceHash({
    contentHash,
    capturedAt: merged.capturedAt,
    timestampAuthority: merged.timestampAuthority,
    artifactId: merged.artifactId,
  });
  return { ...merged, contentHash, evidenceHash, idempotencyKey };
}

function notification(overrides: Partial<R22NotificationObservation> = {}): R22NotificationObservation {
  const base = {
    evidenceId: "notification-evidence-001",
    notificationObservationId: "notification-001",
    advisoryIdentity: identity,
    channel: "EMAIL" as const,
    attemptSequence: 1,
    observedAt: "2026-01-01T00:00:03.000Z",
    disposition: "DELIVERED" as const,
    evidenceSource: "SERVER_DELIVERY_EVENT" as const,
    suppressionReason: null,
    deliveryFailureCode: null,
    idempotencyKey: "",
  };
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    idempotencyKey: overrides.idempotencyKey ?? calculateR22NotificationIdempotencyKey({
      signalId: merged.advisoryIdentity.signalId,
      channel: merged.channel,
      attemptSequence: merged.attemptSequence,
    }),
  };
}

function review(
  eventType: R22HumanReviewObservation["eventType"],
  overrides: Partial<R22HumanReviewObservation> = {},
): R22HumanReviewObservation {
  const base = {
    evidenceId: `review-evidence-${eventType}`,
    reviewObservationId: "review-001",
    eventType,
    advisoryIdentity: identity,
    reviewStartedAt: "2026-01-01T00:00:04.000Z",
    reviewSubmittedAt: eventType === "REVIEW_SUBMITTED" ? "2026-01-01T00:00:05.000Z" : null,
    reviewComplete: eventType === "REVIEW_SUBMITTED" ? true : null,
    informationSufficient: eventType === "REVIEW_SUBMITTED" ? true : null,
    unnecessaryAlert: eventType === "REVIEW_SUBMITTED" ? false : null,
    labelSource: eventType === "REVIEW_SUBMITTED" ? "EXPLICIT_HUMAN_LABEL" as const : null,
    idempotencyKey: "",
  };
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    idempotencyKey: overrides.idempotencyKey ?? calculateR22HumanReviewIdempotencyKey(
      merged.reviewObservationId,
      merged.eventType,
    ),
  };
}

describe("Round-022 observation instrumentation remediation", () => {
  it("freezes the accepted source, ineligible O05 decision, and governance", () => {
    expect(R22_OBSERVATION_INSTRUMENTATION_ACCEPTED_SOURCE).toBe("3df85901f36e1f6feced5ad3b3f4a8329c731250");
    expect(R22_OBSERVATION_INSTRUMENTATION_FINAL_DECISION).toEqual({
      decision: "ROUND-022 OBSERVATION INSTRUMENTATION DESIGN INELIGIBLE",
      nextStage: "STOP",
      performanceAuthorized: false,
      observationAuthorized: false,
    });
    expect(isR22ObservationInstrumentationGovernanceSafe(R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE)).toBe(true);
  });

  it("specifies causal timestamps and unresolved current capture honestly", () => {
    expect(R22_TIMESTAMP_DESIGNS.map((item) => item.timestampName)).toEqual([
      "signalTime",
      "advisoryCreationTime",
      "informationAsOf",
      "capturedAt",
      "notification.observedAt",
      "reviewStartedAt",
      "reviewSubmittedAt",
    ]);
    expect(R22_TIMESTAMP_DESIGNS.every((item) => item.idempotencyKey && item.immutability === "IMMUTABLE" && item.serverAuthoritative)).toBe(true);
    expect(R22_TIMESTAMP_DESIGNS.filter((item) => item.currentCaptureStatus === "UNRESOLVED_CURRENT_SOURCE")).toHaveLength(5);
    expect(R22_SERVER_TIMESTAMP_POLICY).toMatchObject({
      userSuppliedCapturedAt: false,
      userSuppliedInformationAsOf: false,
      backdatingAllowed: false,
    });
  });

  it("keeps contentHash and idempotency stable while evidenceHash follows capture time", () => {
    const first = artifact({ capturedAt: "2026-01-01T00:00:02.000Z" });
    const retry = artifact({ capturedAt: "2026-01-01T00:00:05.000Z" });
    expect(first.contentHash).toBe(retry.contentHash);
    expect(first.idempotencyKey).toBe(retry.idempotencyKey);
    expect(first.evidenceHash).not.toBe(retry.evidenceHash);
    expect(validateR22SnapshotArtifact(first)).toMatchObject({ status: "OBSERVABLE", reason: "NONE" });
    expect(validateR22SnapshotArtifact(retry)).toMatchObject({ status: "OBSERVABLE", reason: "NONE" });
  });

  it("rejects a snapshot with a wrong deterministic idempotency key or evidence hash", () => {
    expect(validateR22SnapshotArtifact(artifact({ idempotencyKey: "wrong" })).reason).toBe("IDEMPOTENCY_KEY_MISMATCH");
    expect(validateR22SnapshotArtifact(artifact({ evidenceHash: "0".repeat(64) })).reason).toBe("EVIDENCE_HASH_MISMATCH");
  });

  it("rejects non-canonical payload values before hashing", () => {
    const invalidValues: unknown[] = [
      undefined,
      new Date("2026-01-01T00:00:00.000Z"),
      new Map([["key", "value"]]),
      new Set(["value"]),
      BigInt(1),
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      { nested: undefined },
      new (class PayloadClass { value = "x" })(),
    ];
    for (const payload of invalidValues) {
      expect(validateR22SnapshotArtifact(artifact({
        payload,
        contentHash: "0".repeat(64),
        evidenceHash: "0".repeat(64),
        idempotencyKey: "invalid",
      })).reason).toBe("NON_CANONICAL_PAYLOAD");
    }
  });

  it("returns IDEMPOTENT_REPLAY without reusing a physical evidence id", () => {
    const record = {
      evidenceId: "evidence-001",
      idempotencyKey: artifact().idempotencyKey,
      supersedesEvidenceId: null,
      persistenceOperation: "APPEND" as const,
    };
    expect(validateR22AppendOnlyWrite({
      record,
      existingEvidenceIds: new Set(),
      existingIdempotencyKeys: new Set(),
    })).toEqual({ status: "APPEND", reason: "NONE" });
    expect(validateR22AppendOnlyWrite({
      record,
      existingEvidenceIds: new Set(["other-evidence"]),
      existingIdempotencyKeys: new Set([record.idempotencyKey]),
    })).toEqual({ status: "IDEMPOTENT_REPLAY", reason: "IDEMPOTENCY_REPLAY" });
    expect(validateR22AppendOnlyWrite({
      record,
      existingEvidenceIds: new Set([record.evidenceId]),
      existingIdempotencyKeys: new Set(),
    })).toEqual({ status: "NOT_EVALUABLE", reason: "EVIDENCE_ID_REUSE" });
  });

  it("maps runtime notification facts without inventing a suppression source", () => {
    expect(validateR22NotificationObservation(notification({
      disposition: "DUPLICATE_SKIPPED",
      evidenceSource: "SERVER_DUPLICATE_SKIP_EVENT",
    })).status).toBe("OBSERVABLE");
    expect(validateR22NotificationObservation(notification({
      disposition: "SUPPRESSED",
      evidenceSource: "SERVER_EXPIRED_SKIP_EVENT",
      suppressionReason: "EXPIRED",
    })).status).toBe("OBSERVABLE");
    expect(validateR22NotificationObservation(notification({
      disposition: "DELIVERY_FAILED",
      evidenceSource: "SERVER_DELIVERY_FAILURE_EVENT",
      deliveryFailureCode: "SMTP_AUTH_FAILED",
    })).status).toBe("OBSERVABLE");
    expect(validateR22NotificationObservation(notification({
      disposition: "SUPPRESSED",
      evidenceSource: "SERVER_EXPIRED_SKIP_EVENT",
      suppressionReason: null,
    })).reason).toBe("SUPPRESSION_REASON_REQUIRED");
    expect(validateR22NotificationObservation(notification({
      disposition: "IGNORED",
      evidenceSource: null,
    })).status).toBe("INSTRUMENTATION_UNRESOLVED");
    expect(validateR22NotificationObservation(notification({
      disposition: "IGNORED",
      evidenceSource: "EXPLICIT_HUMAN_OR_UI",
    })).status).toBe("OBSERVABLE");
    expect(validateR22NotificationObservation(notification({
      observedAt: "2025-12-31T23:59:59.999Z",
    })).reason).toBe("NOTIFICATION_BEFORE_SIGNAL");
  });

  it("documents why O05 is ineligible until attemptSequence is returned", () => {
    expect(R22_NOTIFICATION_ATTEMPT_SEQUENCE_SOURCE.currentStatus).toBe("UNRESOLVED_CURRENT_SOURCE");
    expect(R22_NOTIFICATION_RUNTIME_MAPPING.SKIPPED_DUPLICATE.attemptSequence).toMatch(/not returned/);
    expect(R22_NOTIFICATION_RUNTIME_MAPPING.SKIPPED_EXPIRED.attemptSequence).toMatch(/not returned/);
    expect(R22_INSTRUMENTATION_GATES.find((gate) => gate.id === "O05")).toMatchObject({
      runtimeStatus: "INSTRUMENTATION_REQUIRED",
      designStatus: "DESIGN_INELIGIBLE",
    });
  });

  it("uses distinct append-only START and SUBMIT review identities", () => {
    const start = review("REVIEW_STARTED");
    const submit = review("REVIEW_SUBMITTED");
    expect(validateR22HumanReviewObservation(start)).toEqual({
      status: "OBSERVABLE",
      reviewObservationId: "review-001",
      reason: "NONE",
    });
    expect(validateR22HumanReviewObservation(submit)).toEqual({
      status: "OBSERVABLE",
      reviewObservationId: "review-001",
      reason: "NONE",
    });
    expect(start.idempotencyKey).toBe("REVIEW|review-001|START");
    expect(submit.idempotencyKey).toBe("REVIEW|review-001|SUBMIT");
    expect(start.idempotencyKey).not.toBe(submit.idempotencyKey);
    expect(validateR22AppendOnlyWrite({
      record: {
        evidenceId: start.evidenceId,
        idempotencyKey: start.idempotencyKey,
        supersedesEvidenceId: null,
        persistenceOperation: "APPEND",
      },
      existingEvidenceIds: new Set(),
      existingIdempotencyKeys: new Set([start.idempotencyKey]),
    })).toEqual({ status: "IDEMPOTENT_REPLAY", reason: "IDEMPOTENCY_REPLAY" });
    expect(validateR22AppendOnlyWrite({
      record: {
        evidenceId: submit.evidenceId,
        idempotencyKey: submit.idempotencyKey,
        supersedesEvidenceId: null,
        persistenceOperation: "APPEND",
      },
      existingEvidenceIds: new Set([start.evidenceId]),
      existingIdempotencyKeys: new Set([start.idempotencyKey]),
    })).toEqual({ status: "APPEND", reason: "NONE" });
  });

  it("requires explicit human labels and causal review ordering", () => {
    expect(validateR22HumanReviewObservation(review("REVIEW_STARTED", {
      reviewStartedAt: "2025-12-31T23:59:59.999Z",
    })).reason).toBe("REVIEW_BEFORE_SIGNAL");
    expect(validateR22HumanReviewObservation(review("REVIEW_SUBMITTED", {
      reviewSubmittedAt: "2026-01-01T00:00:03.000Z",
    })).reason).toBe("REVIEW_TIMESTAMP_INVERSION");
    expect(validateR22HumanReviewObservation(review("REVIEW_SUBMITTED", {
      labelSource: null,
    })).reason).toBe("SUBMIT_FIELDS_REQUIRED");
  });

  it("freezes the single-table physical identity and retry contract", () => {
    expect(R22_PERSISTENCE_DESIGN.primaryKey).toBe("evidence_id");
    expect(R22_PERSISTENCE_DESIGN.logicalIdentifiers.review).toContain("review_observation_id,event_type");
    expect(R22_PERSISTENCE_DESIGN.uniqueConstraints).toContain("idempotency_key");
    expect(R22_IDEMPOTENCY_DESIGN.snapshotContentHash).toContain("payload");
    expect(R22_IDEMPOTENCY_DESIGN.snapshotEvidenceHash).toContain("capturedAt");
    expect(R22_APPEND_ONLY_POLICY.updateAllowed).toBe(false);
    expect(R22_APPEND_ONLY_POLICY.deleteAllowed).toBe(false);
  });

  it("keeps runtime gates required while stopping the ineligible design", () => {
    expect(R22_INSTRUMENTATION_GATES.map((gate) => gate.id)).toEqual(["O03", "O04", "O05", "O06"]);
    expect(R22_INSTRUMENTATION_GATES.every((gate) => gate.runtimeStatus === "INSTRUMENTATION_REQUIRED")).toBe(true);
    expect(R22_INSTRUMENTATION_GATES.filter((gate) => gate.designStatus === "DESIGN_READY")).toHaveLength(3);
    expect(isR22ObservationInstrumentationDesignReady()).toBe(false);
    expect(R22_SNAPSHOT_ARTIFACT_TYPES).toHaveLength(6);
  });

  it("isolates instrumentation from signal and trading behavior", () => {
    expect(R22_FAILURE_ISOLATION.upstreamImpact).toMatch(/must not change signal generation/);
    expect(JSON.stringify(R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE)).toContain('"automaticTrading":false');
    expect(JSON.stringify(R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE)).not.toMatch(/order|position|leverage/i);
  });
});
