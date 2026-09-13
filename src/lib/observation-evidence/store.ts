import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";

import {
  OBSERVATION_EVIDENCE_TABLE,
  type ObservationEvidenceAppendResult,
  type ObservationEvidenceCandidate,
  type ObservationJsonValue,
  type ObservationTimestampAuthority,
} from "./types.ts";
import { validateObservationEvidenceCandidate } from "./validator.ts";
import { isCanonicalJsonValue } from "./canonical.ts";

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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isTimestampAuthority(value: unknown): value is ObservationTimestampAuthority {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.capturedAtAuthority === "SERVER_WALL_CLOCK"
    && record.informationAsOfAuthority === "SERVER_SOURCE_CUTOFF"
    && record.userSuppliedCapturedAt === false
    && record.userSuppliedInformationAsOf === false
    && record.backdated === false;
}

function reviewCandidateFromRow(row: Record<string, unknown>): ObservationEvidenceCandidate | null {
  const symbol = RESEARCH_SYMBOLS.includes(row.symbol as ResearchSymbol)
    ? row.symbol as ResearchSymbol
    : null;
  const direction = row.direction === "LONG" || row.direction === "SHORT" ? row.direction : null;
  const eventType = row.event_type === "REVIEW_STARTED" || row.event_type === "REVIEW_SUBMITTED"
    ? row.event_type
    : null;
  const payload = row.payload;
  const timestampAuthority = row.timestamp_authority;
  const evidenceId = stringOrNull(row.evidence_id);
  const schemaVersion = stringOrNull(row.schema_version);
  const signalId = stringOrNull(row.signal_id);
  const signalTime = stringOrNull(row.signal_time);
  const strategyId = stringOrNull(row.strategy_id);
  const strategyVersion = stringOrNull(row.strategy_version);
  const reviewObservationId = stringOrNull(row.review_observation_id);
  const capturedAt = stringOrNull(row.captured_at);
  const sourceRef = stringOrNull(row.source_ref);
  const idempotencyKey = stringOrNull(row.idempotency_key);
  if (row.event_kind !== "REVIEW"
    || symbol === null
    || direction === null
    || eventType === null
    || !evidenceId
    || !schemaVersion
    || !signalId
    || !signalTime
    || !strategyId
    || !strategyVersion
    || !reviewObservationId
    || !capturedAt
    || !sourceRef
    || !idempotencyKey
    || !isCanonicalJsonValue(payload)
    || !isTimestampAuthority(timestampAuthority)) {
    return null;
  }
  return {
    evidenceId,
    eventKind: "REVIEW",
    schemaVersion,
    signalId,
    symbol,
    direction,
    signalTime,
    strategyId,
    strategyVersion,
    artifactId: stringOrNull(row.artifact_id),
    artifactType: null,
    notificationObservationId: null,
    reviewObservationId,
    eventType,
    informationAsOf: stringOrNull(row.information_as_of),
    capturedAt,
    observedAt: stringOrNull(row.observed_at),
    reviewStartedAt: stringOrNull(row.review_started_at),
    reviewSubmittedAt: stringOrNull(row.review_submitted_at),
    sourceRef,
    contentHash: stringOrNull(row.content_hash),
    evidenceHash: stringOrNull(row.evidence_hash),
    idempotencyKey,
    supersedesArtifactId: stringOrNull(row.supersedes_artifact_id),
    supersedesEvidenceId: stringOrNull(row.supersedes_evidence_id),
    payload: payload as ObservationJsonValue,
    timestampAuthority,
    persistenceOperation: "APPEND",
  };
}

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

  async findReviewEvent(input: Readonly<{
    reviewObservationId: string;
    eventType: "REVIEW_STARTED" | "REVIEW_SUBMITTED";
  }>): Promise<ObservationEvidenceCandidate | null> {
    const result = await this.client
      .from(OBSERVATION_EVIDENCE_TABLE)
      .select("evidence_id,event_kind,schema_version,signal_id,symbol,direction,signal_time,strategy_id,strategy_version,artifact_id,review_observation_id,event_type,information_as_of,captured_at,observed_at,review_started_at,review_submitted_at,source_ref,content_hash,evidence_hash,idempotency_key,supersedes_artifact_id,supersedes_evidence_id,payload,timestamp_authority")
      .eq("review_observation_id", input.reviewObservationId)
      .eq("event_type", input.eventType)
      .maybeSingle();
    if (result.error) throw persistenceError("read review event", result.error);
    return result.data ? reviewCandidateFromRow(result.data) : null;
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
