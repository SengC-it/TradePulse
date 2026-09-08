import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  calculateR22SnapshotContentHash,
  calculateR22SnapshotEvidenceHash,
  calculateR22SnapshotIdempotencyKey as calculateResearchSnapshotIdempotencyKey,
} from "@/lib/research/round-022-observation-instrumentation-protocol";
import {
  R22_SOURCE_REMEDIATION_DAG,
  R22_SOURCE_REMEDIATION_GOVERNANCE,
  R22_SOURCE_REMEDIATION_STAGES,
} from "@/lib/research/round-022-observation-source-remediation-protocol";
import {
  canonicalJson,
  calculateObservationSnapshotContentHash,
  calculateObservationSnapshotEvidenceHash,
  calculateObservationSnapshotIdempotencyKey,
  OBSERVATION_EVIDENCE_TABLE,
  R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  R22_OBSERVATION_TIMESTAMP_AUTHORITY,
  R22_R1_IMPLEMENTATION_STATUS,
  SupabaseObservationEvidenceStore,
  validateObservationCausalTimestamps,
  validateObservationEvidenceCandidate,
  validateObservationSnapshot,
  type ObservationEvidenceCandidate,
  type ObservationEvidenceClient,
  type ObservationSnapshotArtifact,
} from "@/lib/observation-evidence/index";

const signalTime = "2026-09-08T14:30:00.000Z";
const identity = {
  signalId: "signal-r22-001",
  symbol: "BTCUSDT" as const,
  direction: "LONG" as const,
  signalTime,
  strategyId: "baseline-001",
  strategyVersion: "baseline-001",
};

function snapshot(overrides: Partial<ObservationSnapshotArtifact> = {}): ObservationSnapshotArtifact {
  const base = {
    evidenceId: "evidence-r22-001",
    artifactId: "artifact-r22-001",
    artifactType: "QUALITY_SNAPSHOT" as const,
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    advisoryIdentity: identity,
    signalId: identity.signalId,
    informationAsOf: "2026-09-08T14:29:00.000Z",
    capturedAt: "2026-09-08T14:30:02.000Z",
    sourceRef: "src/lib/signal-quality/evaluator.ts",
    payload: { grade: "A", explanationCode: "CONTEXT_ALIGNED" },
    contentHash: "",
    evidenceHash: "",
    idempotencyKey: "",
    supersedesArtifactId: null,
    timestampAuthority: R22_OBSERVATION_TIMESTAMP_AUTHORITY,
    persistenceOperation: "APPEND" as const,
  };
  const merged = { ...base, ...overrides };
  const contentHash = overrides.contentHash ?? calculateObservationSnapshotContentHash(merged);
  const evidenceHash = overrides.evidenceHash ?? calculateObservationSnapshotEvidenceHash({
    contentHash,
    capturedAt: merged.capturedAt,
    timestampAuthority: merged.timestampAuthority,
    artifactId: merged.artifactId,
  });
  const idempotencyKey = overrides.idempotencyKey ?? calculateObservationSnapshotIdempotencyKey({
    signalId: merged.signalId,
    artifactType: merged.artifactType,
    schemaVersion: merged.schemaVersion,
    informationAsOf: merged.informationAsOf,
    contentHash,
  });
  return { ...merged, contentHash, evidenceHash, idempotencyKey };
}

function candidate(overrides: Partial<ObservationEvidenceCandidate> = {}): ObservationEvidenceCandidate {
  const artifactOverrides: Partial<ObservationSnapshotArtifact> = {};
  for (const key of [
    "evidenceId",
    "artifactId",
    "artifactType",
    "schemaVersion",
    "advisoryIdentity",
    "signalId",
    "informationAsOf",
    "capturedAt",
    "sourceRef",
    "payload",
    "timestampAuthority",
    "supersedesArtifactId",
  ] as const) {
    if (key in overrides) {
      (artifactOverrides as Record<string, unknown>)[key] = overrides[key as keyof ObservationEvidenceCandidate];
    }
  }
  const artifact = snapshot(artifactOverrides);
  const base: ObservationEvidenceCandidate = {
    evidenceId: artifact.evidenceId,
    eventKind: "SNAPSHOT",
    schemaVersion: artifact.schemaVersion,
    signalId: artifact.signalId,
    symbol: artifact.advisoryIdentity.symbol,
    direction: artifact.advisoryIdentity.direction,
    signalTime: artifact.advisoryIdentity.signalTime,
    strategyId: artifact.advisoryIdentity.strategyId,
    strategyVersion: artifact.advisoryIdentity.strategyVersion,
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    notificationObservationId: null,
    reviewObservationId: null,
    eventType: null,
    informationAsOf: artifact.informationAsOf,
    capturedAt: artifact.capturedAt,
    observedAt: null,
    reviewStartedAt: null,
    reviewSubmittedAt: null,
    sourceRef: artifact.sourceRef,
    contentHash: artifact.contentHash,
    evidenceHash: artifact.evidenceHash,
    idempotencyKey: artifact.idempotencyKey,
    supersedesArtifactId: artifact.supersedesArtifactId,
    supersedesEvidenceId: null,
    payload: artifact.payload,
    timestampAuthority: artifact.timestampAuthority,
    persistenceOperation: "APPEND",
  };
  return { ...base, ...overrides,
    contentHash: overrides.contentHash ?? artifact.contentHash,
    evidenceHash: overrides.evidenceHash ?? artifact.evidenceHash,
    idempotencyKey: overrides.idempotencyKey ?? artifact.idempotencyKey,
  };
}

type FakeRow = Record<string, unknown>;
type FakeError = { code: string; message?: string };

class FakeQuery {
  private readonly filters: Array<readonly [string, unknown]> = [];

  public constructor(private readonly owner: FakeClient) {}

  public insert(values: FakeRow): Promise<{ data: null; error: FakeError | null }> {
    return Promise.resolve(this.owner.insert(values));
  }

  public select(columns?: string): FakeQuery {
    void columns;
    return this;
  }

  public eq(column: string, value: unknown): FakeQuery {
    this.filters.push([column, value]);
    return this;
  }

  public maybeSingle(): Promise<{ data: FakeRow | null; error: FakeError | null }> {
    const row = this.owner.rows.find((candidateRow) =>
      this.filters.every(([column, value]) => candidateRow[column] === value));
    return Promise.resolve({ data: row ?? null, error: null });
  }
}

class FakeClient {
  public readonly rows: FakeRow[] = [];
  public insertError: FakeError | null = null;
  public insertCalls = 0;

  public from(table: string): FakeQuery {
    void table;
    return new FakeQuery(this);
  }

  public insert(values: FakeRow): { data: null; error: FakeError | null } {
    this.insertCalls += 1;
    if (this.insertError) return { data: null, error: this.insertError };
    const duplicate = this.rows.some((row) =>
      row.idempotency_key === values.idempotency_key
      || row.evidence_id === values.evidence_id
      || (values.artifact_id !== null && row.artifact_id === values.artifact_id)
      || (values.notification_observation_id !== null
        && row.notification_observation_id === values.notification_observation_id)
      || (values.review_observation_id !== null
        && row.review_observation_id === values.review_observation_id
        && row.event_type === values.event_type));
    if (duplicate) return { data: null, error: { code: "23505" } };
    this.rows.push({ ...values });
    return { data: null, error: null };
  }
}

function storeWith(client: FakeClient): SupabaseObservationEvidenceStore {
  return new SupabaseObservationEvidenceStore(client as unknown as ObservationEvidenceClient);
}

describe("Round-022 R1 evidence foundation", () => {
  it("freezes foundation implementation without closing any readiness node", () => {
    expect(R22_R1_IMPLEMENTATION_STATUS).toMatchObject({
      r1FoundationImplemented: true,
      sharedEvidenceIdentityImplemented: true,
      snapshotHashingImplemented: true,
      snapshotIdempotencyImplemented: true,
      appendOnlyEvidenceFoundationImplemented: true,
      pitValidatorPrimitivesImplemented: true,
      basicCausalValidatorPrimitivesImplemented: true,
      observationInstrumentationImplemented: false,
      observationAuthorized: false,
      observationExecuted: false,
      performanceAuthorized: false,
      performanceExecutionCount: 0,
      economicValuesRead: false,
      automaticTrading: false,
    });
    expect(R22_SOURCE_REMEDIATION_STAGES.find((stage) => stage.id === "R1")?.closesReadinessNodes).toEqual([]);
    expect(R22_SOURCE_REMEDIATION_DAG.filter((node) => /^S\d+$/.test(node.id)).every((node) => node.currentStatus === "FAIL")).toBe(true);
    expect(R22_SOURCE_REMEDIATION_DAG.find((node) => node.id === "S07")?.currentStatus).toBe("FAIL");
    expect(R22_SOURCE_REMEDIATION_DAG.find((node) => node.id === "S10")?.currentStatus).toBe("FAIL");
  });

  it("canonicalizes object keys recursively but preserves array order", () => {
    expect(canonicalJson({ b: 2, a: { d: true, c: 1 } })).toBe('{"a":{"c":1,"d":true},"b":2}');
    expect(canonicalJson({ a: ["first", { z: 1, y: 2 }] })).toBe('{"a":["first",{"y":2,"z":1}]}');
    expect(canonicalJson({ a: [1, 2] })).not.toBe(canonicalJson({ a: [2, 1] }));
  });

  it("rejects non-canonical JSON values fail-closed", () => {
    const invalidValues: unknown[] = [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      BigInt(1),
      Symbol("payload"),
      () => "not-json",
      new Date("2026-09-08T14:30:00.000Z"),
      new Map([["key", "value"]]),
      new (class CustomPayload { public value = "x" })(),
      { nested: undefined },
    ];
    for (const value of invalidValues) {
      expect(() => canonicalJson(value)).toThrow();
    }
  });

  it("matches the frozen research protocol for all three hashes", () => {
    const artifact = snapshot();
    expect(calculateObservationSnapshotContentHash(artifact)).toBe(calculateR22SnapshotContentHash(artifact));
    expect(calculateObservationSnapshotEvidenceHash(artifact)).toBe(calculateR22SnapshotEvidenceHash(artifact));
    expect(calculateObservationSnapshotIdempotencyKey({
      signalId: artifact.signalId,
      artifactType: artifact.artifactType,
      schemaVersion: artifact.schemaVersion,
      informationAsOf: artifact.informationAsOf,
      contentHash: artifact.contentHash,
    })).toBe(calculateResearchSnapshotIdempotencyKey({
      signalId: artifact.signalId,
      artifactType: artifact.artifactType,
      schemaVersion: artifact.schemaVersion,
      informationAsOf: artifact.informationAsOf,
      contentHash: artifact.contentHash,
    }));
  });

  it("keeps contentHash and idempotency stable while captured evidenceHash changes", () => {
    const first = snapshot({ capturedAt: "2026-09-08T14:30:02.000Z" });
    const retry = snapshot({ capturedAt: "2026-09-08T14:30:05.000Z" });
    expect(first.contentHash).toBe(retry.contentHash);
    expect(first.idempotencyKey).toBe(retry.idempotencyKey);
    expect(first.evidenceHash).not.toBe(retry.evidenceHash);
    expect(validateObservationSnapshot(first).status).toBe("OBSERVABLE");
    expect(validateObservationSnapshot(retry).status).toBe("OBSERVABLE");
  });

  it("validates PIT and basic causal timestamp primitives", () => {
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:29:00.000Z",
      capturedAt: "2026-09-08T14:30:02.000Z",
    })).toEqual({ status: "VALID", reason: "NONE" });
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: signalTime,
      capturedAt: signalTime,
    }).status).toBe("VALID");
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:31:00.000Z",
      capturedAt: "2026-09-08T14:31:00.000Z",
    }).reason).toBe("INFORMATION_AFTER_SIGNAL");
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:29:00.000Z",
      capturedAt: "2026-09-08T14:29:59.999Z",
    }).reason).toBe("CAPTURE_BEFORE_SIGNAL");
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:29:30.000Z",
      capturedAt: "2026-09-08T14:29:00.000Z",
    }).reason).toBe("CAPTURE_BEFORE_INFORMATION_AS_OF");
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:29:00.000Z",
      capturedAt: "2026-09-08T14:30:02.000Z",
      advisoryCreationTime: "2026-09-08T14:29:59.999Z",
    }).reason).toBe("ADVISORY_BEFORE_SIGNAL");
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:29:00.000Z",
      capturedAt: "2026-09-08T14:30:02.000Z",
      notificationObservedAt: "2026-09-08T14:29:59.999Z",
    }).reason).toBe("NOTIFICATION_BEFORE_SIGNAL");
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:29:00.000Z",
      capturedAt: "2026-09-08T14:30:02.000Z",
      reviewStartedAt: "2026-09-08T14:29:59.999Z",
    }).reason).toBe("REVIEW_BEFORE_SIGNAL");
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:29:00.000Z",
      capturedAt: "2026-09-08T14:30:02.000Z",
      reviewStartedAt: "2026-09-08T14:31:00.000Z",
      reviewSubmittedAt: "2026-09-08T14:30:59.999Z",
    }).reason).toBe("REVIEW_TIMESTAMP_INVERSION");
    expect(validateObservationCausalTimestamps({
      signalTime,
      informationAsOf: "2026-09-08T14:29:00Z",
      capturedAt: "2026-09-08T14:30:02.000Z",
    }).reason).toBe("INVALID_TIMESTAMP");
  });

  it("uses exact normalized forbidden-field membership", () => {
    for (const payload of [
      { windowSize: 1 },
      { windowCount: 2 },
      { losslessEncoding: "json" },
      { returnAddress: "mailbox" },
      { returnPolicyCode: "R22" },
      { winnerMetadata: { source: "system" } },
      { profitabilityContext: { label: "advisory-only" } },
    ]) {
      expect(validateObservationSnapshot(snapshot({ payload: payload as never }))).toMatchObject({
        status: "OBSERVABLE",
        reason: "NONE",
      });
    }
  });

  it("rejects exact normalized forbidden economic fields recursively", () => {
    for (const payload of [
      { PnL: 1 },
      { profit: 1 },
      { loss: 1 },
      { return: 1 },
      { nested: [{ forward_return: 1 }] },
      { futurePrice: 1 },
      { win: true },
      { deep: { realized_pnl: 1 } },
      { takeProfitHit: true },
    ]) {
      expect(validateObservationSnapshot(snapshot({
        payload: payload as never,
        contentHash: "0".repeat(64),
        evidenceHash: "0".repeat(64),
        idempotencyKey: "invalid",
      })).reason).toBe("FORBIDDEN_ECONOMIC_FIELD");
    }
  });

  it("validates snapshot identity, hashes, timestamps, and append semantics", () => {
    expect(validateObservationSnapshot(snapshot())).toMatchObject({ status: "OBSERVABLE", reason: "NONE" });
    expect(validateObservationSnapshot(snapshot({ signalId: "different-signal" })).reason).toBe("MISSING_IDENTITY");
    expect(validateObservationSnapshot(snapshot({ persistenceOperation: "UPDATE" as never })).reason).toBe("APPEND_ONLY_VIOLATION");
    expect(validateObservationSnapshot(snapshot({ capturedAt: "2026-09-08T14:29:59.999Z" })).reason).toBe("CAPTURE_BEFORE_SIGNAL");
  });

  it("validates generic non-snapshot candidates without creating a producer", () => {
    const generic = candidate({
      eventKind: "INSTRUMENTATION_FAILURE",
      artifactId: null,
      artifactType: null,
      informationAsOf: null,
      contentHash: null,
      evidenceHash: null,
      payload: { errorClass: "TRANSIENT" },
    });
    expect(validateObservationEvidenceCandidate(generic)).toMatchObject({ status: "VALID", reason: "NONE" });
  });

  it("appends a new row and never calls UPDATE", async () => {
    const client = new FakeClient();
    const result = await storeWith(client).appendEvidence(candidate());
    expect(result).toEqual({ status: "APPENDED", evidenceId: "evidence-r22-001" });
    expect(client.rows).toHaveLength(1);
    expect(client.insertCalls).toBe(1);
  });

  it("returns IDEMPOTENT_REPLAY for the same logical key without UPDATE", async () => {
    const client = new FakeClient();
    const store = storeWith(client);
    await store.appendEvidence(candidate());
    const replay = await store.appendEvidence(candidate({ evidenceId: "different-physical-evidence-id" }));
    expect(replay).toEqual({ status: "IDEMPOTENT_REPLAY", evidenceId: "evidence-r22-001" });
    expect(client.rows).toHaveLength(1);
  });

  it("returns EVIDENCE_ID_CONFLICT when the physical id is reused", async () => {
    const client = new FakeClient();
    const store = storeWith(client);
    await store.appendEvidence(candidate());
    const conflict = await store.appendEvidence(candidate({ payload: { grade: "B" } }));
    expect(conflict).toEqual({
      status: "NOT_EVALUABLE",
      evidenceId: "evidence-r22-001",
      reason: "EVIDENCE_ID_CONFLICT",
    });
  });

  it("returns LOGICAL_ID_CONFLICT for a reused artifact identity", async () => {
    const client = new FakeClient();
    const store = storeWith(client);
    await store.appendEvidence(candidate());
    const conflict = await store.appendEvidence(candidate({
      evidenceId: "evidence-r22-002",
      payload: { grade: "B" },
    }));
    expect(conflict).toEqual({
      status: "NOT_EVALUABLE",
      evidenceId: "evidence-r22-002",
      reason: "LOGICAL_ID_CONFLICT",
    });
  });

  it("throws on an unclassified PostgreSQL 23505 without a known conflicting row", async () => {
    const client = new FakeClient();
    client.insertError = { code: "23505" };
    await expect(storeWith(client).appendEvidence(candidate())).rejects.toThrow(/23505/);
    expect(client.rows).toHaveLength(0);
  });

  it("keeps artifact and evidence supersession namespaces separate", async () => {
    const client = new FakeClient();
    const superseding = candidate({
      evidenceId: "evidence-r22-002",
      artifactId: "artifact-r22-002",
      supersedesArtifactId: "artifact-r22-prior",
      supersedesEvidenceId: "evidence-r22-prior",
    });

    expect(validateObservationSnapshot(snapshot({ supersedesArtifactId: "artifact-r22-prior" }))).toMatchObject({
      status: "OBSERVABLE",
      reason: "NONE",
    });
    expect(validateObservationEvidenceCandidate(superseding)).toMatchObject({
      status: "VALID",
      reason: "NONE",
    });

    await expect(storeWith(client).appendEvidence(superseding)).resolves.toEqual({
      status: "APPENDED",
      evidenceId: "evidence-r22-002",
    });
    expect(client.rows[0]).toMatchObject({
      supersedes_artifact_id: "artifact-r22-prior",
      supersedes_evidence_id: "evidence-r22-prior",
    });
  });

  it("rejects artifact and evidence self-supersession independently", () => {
    expect(validateObservationSnapshot(snapshot({
      supersedesArtifactId: "artifact-r22-001",
    })).reason).toBe("APPEND_ONLY_VIOLATION");
    expect(validateObservationEvidenceCandidate(candidate({
      supersedesArtifactId: "artifact-r22-001",
    })).snapshotReason).toBe("APPEND_ONLY_VIOLATION");
    expect(validateObservationEvidenceCandidate(candidate({
      supersedesEvidenceId: "evidence-r22-001",
    })).reason).toBe("APPEND_ONLY_VIOLATION");
  });

  it("throws on an unknown persistence error and never claims APPENDED", async () => {
    const client = new FakeClient();
    client.insertError = { code: "XXUNKNOWN" };
    await expect(storeWith(client).appendEvidence(candidate())).rejects.toThrow("persistence failed");
    expect(client.rows).toHaveLength(0);
  });

  it("proves the migration has the required append-only schema and access boundary", () => {
    const migrationPath = resolve(process.cwd(), "supabase/migrations/20260908000000_r22_observation_evidence.sql");
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table public\.tp_observation_evidence/i);
    expect(sql).toMatch(/evidence_id\s+text\s+primary key/i);
    expect(sql).toMatch(/idempotency_key\s+text\s+not null unique/i);
    expect(sql).toMatch(/supersedes_artifact_id\s+text/i);
    expect(sql).toMatch(/create unique index[\s\S]*event_kind = 'SNAPSHOT'/i);
    expect(sql).toMatch(/create unique index[\s\S]*event_kind = 'NOTIFICATION'/i);
    expect(sql).toMatch(/create unique index[\s\S]*event_kind = 'REVIEW'/i);
    expect(sql).toMatch(/alter table public\.tp_observation_evidence enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.tp_observation_evidence from anon, authenticated/i);
    expect(sql).toMatch(/before update or delete on public\.tp_observation_evidence/i);
    expect(sql).toMatch(/raise exception[\s\S]*append-only/i);
    expect(sql).not.toMatch(/on conflict[\s\S]*do\s+update/i);
    expect(sql).not.toMatch(/update\s+public\.tp_observation_evidence/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.tp_observation_evidence/i);
    expect(OBSERVATION_EVIDENCE_TABLE).toBe("tp_observation_evidence");
    expect(readFileSync(resolve(process.cwd(), "src/lib/observation-evidence/validator.ts"), "utf8"))
      .not.toContain("supersedesArtifactId: candidate.supersedesEvidenceId");
  });

  it("has zero production writer call sites and leaves existing advisory paths untouched", () => {
    const sourceFiles: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) visit(path);
        else if (path.endsWith(".ts") || path.endsWith(".tsx")) sourceFiles.push(path);
      }
    };
    visit(resolve(process.cwd(), "src"));
    const productionSources = sourceFiles.filter((path) => !path.includes("observation-evidence"));
    for (const path of productionSources) {
      expect(readFileSync(path, "utf8")).not.toMatch(/appendEvidence\s*\(/);
    }
    expect(readFileSync(resolve(process.cwd(), "src/lib/signal-advisory/scan.ts"), "utf8")).not.toContain("observation-evidence");
    expect(readFileSync(resolve(process.cwd(), "src/lib/signal-advisory/store.ts"), "utf8")).not.toContain("observation-evidence");
  });

  it("keeps the accepted remediation governance safe and all readiness nodes closed", () => {
    expect(R22_SOURCE_REMEDIATION_GOVERNANCE).toMatchObject({
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      observationInstrumentationImplemented: false,
      observationAuthorized: false,
      observationExecuted: false,
      performanceAuthorized: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      forwardReturnRead: false,
      newMarketDataFetched: false,
      historicalBackfillExecuted: false,
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });
});
