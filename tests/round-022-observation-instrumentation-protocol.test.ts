import { describe, expect, it } from "vitest";
import {
  R22_APPEND_ONLY_POLICY,
  R22_FAILURE_ISOLATION,
  R22_INSTRUMENTATION_GATES,
  R22_OBSERVATION_INSTRUMENTATION_ACCEPTED_SOURCE,
  R22_OBSERVATION_INSTRUMENTATION_FINAL_DECISION,
  R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE,
  R22_OBSERVATION_INSTRUMENTATION_SCHEMA_VERSION,
  R22_SERVER_TIMESTAMP_POLICY,
  R22_SNAPSHOT_ARTIFACT_TYPES,
  R22_TIMESTAMP_DESIGNS,
  calculateR22SnapshotSourceHash,
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
  const requestedSourceHash = overrides.sourceHash;
  const base = {
    artifactId: "artifact-001",
    artifactType: "QUALITY_SNAPSHOT" as const,
    schemaVersion: R22_OBSERVATION_INSTRUMENTATION_SCHEMA_VERSION,
    advisoryIdentity: identity,
    informationAsOf: "2025-12-31T23:59:00.000Z",
    capturedAt: "2026-01-01T00:00:02.000Z",
    sourceRef: "src/lib/signal-quality/evaluator.ts",
    sourceHash: "",
    payload: { grade: "A", explanationCode: "CONTEXT_ALIGNED" },
    idempotencyKey: "signal-001|QUALITY_SNAPSHOT|v1|hash",
    supersedesArtifactId: null,
    timestampAuthority,
    persistenceOperation: "APPEND" as const,
    ...overrides,
  };
  return {
    ...base,
    sourceHash: requestedSourceHash ?? calculateR22SnapshotSourceHash(base),
  };
}

function notification(overrides: Partial<R22NotificationObservation> = {}): R22NotificationObservation {
  return {
    notificationObservationId: "notification-001",
    advisoryIdentity: identity,
    channel: "EMAIL",
    attemptSequence: 1,
    observedAt: "2026-01-01T00:00:03.000Z",
    disposition: "DELIVERED",
    evidenceSource: "SERVER_DELIVERY_EVENT",
    idempotencyKey: "signal-001|EMAIL|1",
    ...overrides,
  };
}

function review(overrides: Partial<R22HumanReviewObservation> = {}): R22HumanReviewObservation {
  return {
    reviewObservationId: "review-001",
    advisoryIdentity: identity,
    reviewStartedAt: "2026-01-01T00:00:04.000Z",
    reviewSubmittedAt: "2026-01-01T00:00:05.000Z",
    reviewComplete: true,
    informationSufficient: true,
    unnecessaryAlert: false,
    labelSource: "EXPLICIT_HUMAN_LABEL",
    idempotencyKey: "review-001",
    ...overrides,
  };
}

describe("Round-022 observation instrumentation design", () => {
  it("freezes the accepted source, design-only decision, and governance", () => {
    expect(R22_OBSERVATION_INSTRUMENTATION_ACCEPTED_SOURCE).toBe("3df85901f36e1f6feced5ad3b3f4a8329c731250");
    expect(R22_OBSERVATION_INSTRUMENTATION_FINAL_DECISION).toEqual({
      decision: "ROUND-022 OBSERVATION INSTRUMENTATION DESIGN READY",
      nextStage: "STOP_PENDING_DESIGN_ACCEPTANCE",
      performanceAuthorized: false,
      observationAuthorized: false,
    });
    expect(isR22ObservationInstrumentationGovernanceSafe(R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE)).toBe(true);
  });

  it("specifies every causal timestamp and distinguishes unavailable current capture from design readiness", () => {
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

  it("validates a snapshot with informationAsOf <= signalTime <= capturedAt", () => {
    expect(validateR22SnapshotArtifact(artifact())).toMatchObject({ status: "OBSERVABLE", reason: "NONE" });
  });

  it("rejects causal timestamp inversions and invalid authority", () => {
    expect(validateR22SnapshotArtifact(artifact({ capturedAt: "2025-12-31T23:59:59.999Z" })).reason).toBe("CAPTURE_BEFORE_SIGNAL");
    expect(validateR22SnapshotArtifact(artifact({ informationAsOf: "2026-01-01T00:00:00.001Z" })).reason).toBe("INFORMATION_AFTER_SIGNAL");
    expect(validateR22SnapshotArtifact(artifact({
      informationAsOf: "2025-12-31T23:59:59.999Z",
      capturedAt: "2025-12-31T23:59:59.998Z",
    })).reason).toBe("CAPTURE_BEFORE_INFORMATION_AS_OF");
    expect(validateR22SnapshotArtifact(artifact({
      timestampAuthority: { ...timestampAuthority, backdated: true } as unknown as R22SnapshotArtifact["timestampAuthority"],
    })).reason).toBe("TIMESTAMP_AUTHORITY_INVALID");
  });

  it("uses canonical stable serialization and detects provenance/payload changes", () => {
    const first = artifact({ payload: { z: "last", a: "first" } });
    const reordered = artifact({ payload: { a: "first", z: "last" }, sourceHash: "" });
    expect(calculateR22SnapshotSourceHash(first)).toBe(calculateR22SnapshotSourceHash(reordered));
    expect(validateR22SnapshotArtifact(artifact({ sourceHash: "0".repeat(64) })).reason).toBe("SOURCE_HASH_MISMATCH");
    expect(validateR22SnapshotArtifact(artifact({ payload: { futurePrice: 123 } })).reason).toBe("FORBIDDEN_ECONOMIC_FIELD");
  });

  it("keeps snapshots append-only and distinguishes retry replay from artifact reuse", () => {
    expect(R22_APPEND_ONLY_POLICY.updateAllowed).toBe(false);
    expect(validateR22AppendOnlyWrite({
      artifact: artifact(),
      existingArtifactIds: new Set(),
      existingIdempotencyKeys: new Set(),
    })).toEqual({ status: "APPEND", reason: "NONE" });
    expect(validateR22AppendOnlyWrite({
      artifact: artifact(),
      existingArtifactIds: new Set(["other-artifact"]),
      existingIdempotencyKeys: new Set([artifact().idempotencyKey]),
    })).toEqual({ status: "IDEMPOTENT_REPLAY", reason: "IDEMPOTENCY_REPLAY" });
    expect(validateR22AppendOnlyWrite({
      artifact: artifact(),
      existingArtifactIds: new Set([artifact().artifactId]),
      existingIdempotencyKeys: new Set(),
    })).toEqual({ status: "NOT_EVALUABLE", reason: "ARTIFACT_ID_REUSE" });
    expect(validateR22SnapshotArtifact(artifact({ supersedesArtifactId: "artifact-001" })).reason).toBe("APPEND_ONLY_VIOLATION");
  });

  it("requires objective notification provenance and never infers IGNORED", () => {
    for (const disposition of ["DELIVERED", "SUPPRESSED", "DUPLICATE_SKIPPED"] as const) {
      const evidenceSource = {
        DELIVERED: "SERVER_DELIVERY_EVENT",
        SUPPRESSED: "SERVER_SUPPRESSION_EVENT",
        DUPLICATE_SKIPPED: "SERVER_DEDUP_EVENT",
      }[disposition] as R22NotificationObservation["evidenceSource"];
      expect(validateR22NotificationObservation(notification({ disposition, evidenceSource })).status).toBe("OBSERVABLE");
    }
    expect(validateR22NotificationObservation(notification({
      disposition: "IGNORED",
      evidenceSource: null,
    }))).toMatchObject({
      status: "INSTRUMENTATION_UNRESOLVED",
      disposition: "INSTRUMENTATION_UNRESOLVED",
    });
    expect(validateR22NotificationObservation(notification({
      disposition: "IGNORED",
      evidenceSource: "EXPLICIT_HUMAN_OR_UI",
    }))).toMatchObject({ status: "OBSERVABLE", disposition: "IGNORED" });
    expect(validateR22NotificationObservation(notification({ observedAt: "2025-12-31T23:59:59.999Z" })).reason).toBe("NOTIFICATION_BEFORE_SIGNAL");
  });

  it("uses server review timestamps and explicit human labels only", () => {
    expect(validateR22HumanReviewObservation(review())).toEqual({
      status: "OBSERVABLE",
      reviewObservationId: "review-001",
      reason: "NONE",
    });
    expect(validateR22HumanReviewObservation(review({ reviewStartedAt: "2025-12-31T23:59:59.999Z" })).reason).toBe("REVIEW_BEFORE_SIGNAL");
    expect(validateR22HumanReviewObservation(review({
      reviewStartedAt: "2026-01-01T00:00:05.000Z",
      reviewSubmittedAt: "2026-01-01T00:00:04.000Z",
    })).reason).toBe("REVIEW_TIMESTAMP_INVERSION");
    expect(validateR22HumanReviewObservation(review({ labelSource: "SERVER_DERIVED" as R22HumanReviewObservation["labelSource"] })).reason).toBe("MISSING_HUMAN_LABEL_SOURCE");
  });

  it("keeps O03-O06 runtime gates required while making their designs ready", () => {
    expect(R22_INSTRUMENTATION_GATES.map((gate) => gate.id)).toEqual(["O03", "O04", "O05", "O06"]);
    expect(R22_INSTRUMENTATION_GATES.every((gate) => gate.runtimeStatus === "INSTRUMENTATION_REQUIRED")).toBe(true);
    expect(R22_INSTRUMENTATION_GATES.every((gate) => gate.designStatus === "DESIGN_READY")).toBe(true);
    expect(isR22ObservationInstrumentationDesignReady()).toBe(true);
    expect(R22_SNAPSHOT_ARTIFACT_TYPES).toHaveLength(6);
  });

  it("isolates instrumentation from signal and trading behavior", () => {
    expect(R22_FAILURE_ISOLATION.upstreamImpact).toMatch(/must not change signal generation/);
    expect(JSON.stringify(R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE)).toContain('"automaticTrading":false');
    expect(JSON.stringify(R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE)).not.toMatch(/order|position|leverage/i);
  });
});
