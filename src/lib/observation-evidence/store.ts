import { createSupabaseAdminClient } from "../supabase/admin.ts";

import {
  OBSERVATION_EVIDENCE_TABLE,
  type ObservationEvidenceAppendResult,
  type ObservationEvidenceCandidate,
} from "./types.ts";
import { validateObservationEvidenceCandidate } from "./validator.ts";

type SupabaseError = Readonly<{ code?: string | null; message?: string | null }>;
type QueryResult<T> = Promise<Readonly<{ data: T | null; error: SupabaseError | null }>>;

type ObservationEvidenceFilter = Readonly<{
  eq(column: string, value: unknown): ObservationEvidenceFilter;
  maybeSingle(): QueryResult<Record<string, unknown>>;
}>;

type ObservationEvidenceQuery = Readonly<{
  insert(values: Record<string, unknown>): QueryResult<null>;
  select(columns?: string): ObservationEvidenceFilter;
}>;

export type ObservationEvidenceClient = Readonly<{
  from(table: string): ObservationEvidenceQuery;
}>;

function persistenceError(operation: string, error: SupabaseError): Error {
  return new Error(`Observation evidence persistence failed during ${operation}${error.code ? ` (${error.code})` : ""}.`);
}

function rowFromCandidate(candidate: ObservationEvidenceCandidate): Record<string, unknown> {
  return {
    evidence_id: candidate.evidenceId,
    event_kind: candidate.eventKind,
    schema_version: candidate.schemaVersion,
    signal_id: candidate.signalId,
    symbol: candidate.symbol,
    direction: candidate.direction,
    signal_time: candidate.signalTime,
    strategy_id: candidate.strategyId,
    strategy_version: candidate.strategyVersion,
    artifact_id: candidate.artifactId,
    artifact_type: candidate.artifactType,
    notification_observation_id: candidate.notificationObservationId,
    review_observation_id: candidate.reviewObservationId,
    event_type: candidate.eventType,
    information_as_of: candidate.informationAsOf,
    captured_at: candidate.capturedAt,
    observed_at: candidate.observedAt,
    review_started_at: candidate.reviewStartedAt,
    review_submitted_at: candidate.reviewSubmittedAt,
    source_ref: candidate.sourceRef,
    content_hash: candidate.contentHash,
    evidence_hash: candidate.evidenceHash,
    idempotency_key: candidate.idempotencyKey,
    supersedes_artifact_id: candidate.supersedesArtifactId,
    supersedes_evidence_id: candidate.supersedesEvidenceId,
    payload: candidate.payload,
    timestamp_authority: candidate.timestampAuthority,
  };
}

export class SupabaseObservationEvidenceStore {
  private readonly client: ObservationEvidenceClient;

  constructor(client: ObservationEvidenceClient) {
    this.client = client;
  }

  async appendEvidence(candidate: ObservationEvidenceCandidate): Promise<ObservationEvidenceAppendResult> {
    const validation = validateObservationEvidenceCandidate(candidate);
    if (validation.status !== "VALID") {
      return { status: "NOT_EVALUABLE", evidenceId: candidate.evidenceId, reason: "INVALID_CANDIDATE" };
    }

    const inserted = await this.client.from(OBSERVATION_EVIDENCE_TABLE).insert(rowFromCandidate(candidate));
    if (!inserted.error) {
      return { status: "APPENDED", evidenceId: candidate.evidenceId };
    }
    if (inserted.error.code !== "23505") {
      throw persistenceError("append", inserted.error);
    }

    const existingByIdempotency = await this.readBy("idempotency_key", candidate.idempotencyKey);
    if (existingByIdempotency) {
      return { status: "IDEMPOTENT_REPLAY", evidenceId: existingByIdempotency.evidence_id as string };
    }

    const existingByEvidence = await this.readBy("evidence_id", candidate.evidenceId);
    if (existingByEvidence) {
      return {
        status: "NOT_EVALUABLE",
        evidenceId: candidate.evidenceId,
        reason: "EVIDENCE_ID_CONFLICT",
      };
    }

    const logicalConflict = await this.readLogicalConflict(candidate);
    if (logicalConflict) {
      return {
        status: "NOT_EVALUABLE",
        evidenceId: candidate.evidenceId,
        reason: "LOGICAL_ID_CONFLICT",
      };
    }

    throw persistenceError("classify unique constraint conflict", inserted.error);
  }

  private async readBy(column: string, value: string): Promise<Record<string, unknown> | null> {
    const result = await this.client
      .from(OBSERVATION_EVIDENCE_TABLE)
      .select("evidence_id,idempotency_key")
      .eq(column, value)
      .maybeSingle();
    if (result.error) throw persistenceError(`read ${column}`, result.error);
    return result.data;
  }

  private async readLogicalConflict(candidate: ObservationEvidenceCandidate): Promise<Record<string, unknown> | null> {
    if (candidate.eventKind === "SNAPSHOT" && candidate.artifactId !== null) {
      return this.readBy("artifact_id", candidate.artifactId);
    }
    if (candidate.eventKind === "NOTIFICATION" && candidate.notificationObservationId !== null) {
      return this.readBy("notification_observation_id", candidate.notificationObservationId);
    }
    if (candidate.eventKind === "REVIEW"
      && candidate.reviewObservationId !== null
      && candidate.eventType !== null) {
      const result = await this.client
        .from(OBSERVATION_EVIDENCE_TABLE)
        .select("evidence_id,idempotency_key")
        .eq("review_observation_id", candidate.reviewObservationId)
        .eq("event_type", candidate.eventType)
        .maybeSingle();
      if (result.error) throw persistenceError("read review logical identity", result.error);
      return result.data;
    }
    return null;
  }
}

export function createObservationEvidenceStore(): SupabaseObservationEvidenceStore {
  return new SupabaseObservationEvidenceStore(
    createSupabaseAdminClient() as unknown as ObservationEvidenceClient,
  );
}
