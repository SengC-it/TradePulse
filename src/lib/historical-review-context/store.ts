import { createSupabaseAdminClient } from "../supabase/admin.ts";
import {
  historicalContextPublicationFor,
  historicalReviewContextDraftFor,
  validateHistoricalReviewContext,
} from "./registry.ts";
import {
  HISTORICAL_REVIEW_CONTEXT_REGISTRY_TABLE,
  type HistoricalReviewContext,
  type HistoricalReviewContextLookup,
  type HistoricalReviewContextPublication,
  type HistoricalReviewContextPublishResult,
  type HistoricalReviewContextRegistry,
} from "./types.ts";

type SupabaseError = Readonly<{ code?: string | null; message?: string | null }>;
type QueryResult<T> = PromiseLike<Readonly<{ data: T | null; error: SupabaseError | null }>>;

type RegistryFilter = Readonly<{
  eq(column: string, value: unknown): RegistryFilter;
  neq(column: string, value: unknown): RegistryFilter;
  lte(column: string, value: unknown): RegistryFilter;
  order(column: string, options: Readonly<{ ascending: boolean }>): RegistryFilter;
  limit(value: number): QueryResult<readonly Record<string, unknown>[]>;
  maybeSingle(): QueryResult<Record<string, unknown>>;
}>;

type RegistryInsert = Readonly<{
  select(columns?: string): Readonly<{ maybeSingle(): QueryResult<Record<string, unknown>> }>;
}>;

export type HistoricalReviewContextRegistryClient = Readonly<{
  from(table: string): Readonly<{
    insert(values: Record<string, unknown>): RegistryInsert;
    select(columns?: string): RegistryFilter;
  }>;
}>;

export function canonicalizeDatabaseTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function persistenceError(operation: string, error: SupabaseError): Error {
  return new Error(`Historical review context registry failed during ${operation}${error.code ? ` (${error.code})` : ""}.`);
}

function rowFromContextPublication(input: HistoricalReviewContextPublication): Record<string, unknown> {
  const context = historicalReviewContextDraftFor({
    advisory: input.advisory,
    sourceIds: input.sourceIds,
  });
  return {
    context_id: context.contextId,
    source_signal_id: context.sourceSignalId,
    symbol: context.symbol,
    timeframe: context.timeframe,
    source_event_time: context.sourceEventTime,
    feature_snapshot_version: context.featureSnapshotVersion,
    preprocessing_hash: context.preprocessingHash,
    source_ids: context.sourceIds,
    feature_snapshot: context.featureSnapshot,
    approval_ref: context.approvalRef,
  };
}

function contextFromRow(row: Record<string, unknown>): HistoricalReviewContext | null {
  const sourceEventTime = canonicalizeDatabaseTimestamp(row.source_event_time);
  const availableAt = canonicalizeDatabaseTimestamp(row.available_at);
  if (typeof row.context_id !== "string"
    || typeof row.source_signal_id !== "string"
    || typeof row.symbol !== "string"
    || typeof row.timeframe !== "string"
    || sourceEventTime === null
    || availableAt === null
    || typeof row.feature_snapshot_version !== "string"
    || typeof row.preprocessing_hash !== "string"
    || !Array.isArray(row.source_ids)
    || typeof row.feature_snapshot !== "object"
    || row.feature_snapshot === null
    || typeof row.approval_ref !== "string") {
    return null;
  }
  const context = {
    contextId: row.context_id,
    sourceSignalId: row.source_signal_id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    sourceEventTime,
    availableAt,
    featureSnapshotVersion: row.feature_snapshot_version,
    preprocessingHash: row.preprocessing_hash,
    sourceIds: row.source_ids,
    featureSnapshot: row.feature_snapshot,
    approvalRef: row.approval_ref,
  } as HistoricalReviewContext;
  return validateHistoricalReviewContext(context) ? context : null;
}

function samePublishedIdentity(
  context: HistoricalReviewContext,
  input: HistoricalReviewContextPublication,
): boolean {
  const expected = historicalReviewContextDraftFor({
    advisory: input.advisory,
    sourceIds: input.sourceIds,
  });
  return expected.contextId === context.contextId
    && expected.sourceSignalId === context.sourceSignalId
    && expected.sourceIds.join("\u0000") === context.sourceIds.join("\u0000")
    && expected.featureSnapshotVersion === context.featureSnapshotVersion
    && expected.preprocessingHash === context.preprocessingHash;
}

export class SupabaseHistoricalReviewContextRegistry implements HistoricalReviewContextRegistry {
  private readonly client: HistoricalReviewContextRegistryClient;

  constructor(client: HistoricalReviewContextRegistryClient) {
    this.client = client;
  }

  async findPriorContext(input: Readonly<{
    currentSignalId: string;
    symbol: HistoricalReviewContext["symbol"];
    signalTime: string;
  }>): Promise<HistoricalReviewContextLookup> {
    const result = await this.client
      .from(HISTORICAL_REVIEW_CONTEXT_REGISTRY_TABLE)
      .select("*")
      .eq("symbol", input.symbol)
      .eq("timeframe", "1h")
      .neq("source_signal_id", input.currentSignalId)
      .lte("available_at", input.signalTime)
      .order("available_at", { ascending: false })
      .limit(2);
    if (result.error) throw persistenceError("lookup", result.error);
    const rows = result.data ?? [];
    if (rows.length === 0) return { status: "MISSING", reason: "NO_APPROVED_PRIOR_CONTEXT" };
    const first = contextFromRow(rows[0]);
    if (!first) return { status: "NOT_EVALUABLE", reason: "INVALID_CONTEXT_RECORD" };
    if (rows[1]) {
      const second = contextFromRow(rows[1]);
      if (!second) return { status: "NOT_EVALUABLE", reason: "INVALID_CONTEXT_RECORD" };
      if (second.availableAt === first.availableAt) {
        return { status: "NOT_EVALUABLE", reason: "AMBIGUOUS_MAX_AVAILABLE_CONTEXT" };
      }
    }
    return { status: "FOUND", context: first };
  }

  async publishContext(
    input: HistoricalReviewContextPublication,
  ): Promise<HistoricalReviewContextPublishResult> {
    const inserted = await this.client
      .from(HISTORICAL_REVIEW_CONTEXT_REGISTRY_TABLE)
      .insert(rowFromContextPublication(input))
      .select("*")
      .maybeSingle();
    if (!inserted.error) {
      const context = inserted.data ? contextFromRow(inserted.data) : null;
      if (!context) throw new Error("Historical review context registry returned an invalid inserted row.");
      return { status: "APPENDED", context };
    }
    if (inserted.error.code !== "23505") {
      throw persistenceError("publish", inserted.error);
    }

    const existing = await this.client
      .from(HISTORICAL_REVIEW_CONTEXT_REGISTRY_TABLE)
      .select("*")
      .eq("source_signal_id", input.advisory.signalId)
      .maybeSingle();
    if (existing.error) throw persistenceError("read publish conflict", existing.error);
    const context = existing.data ? contextFromRow(existing.data) : null;
    if (!context || !samePublishedIdentity(context, input)) {
      throw new Error("Historical review context publish conflict did not match the known identity.");
    }
    return { status: "IDEMPOTENT_REPLAY", context };
  }
}

export function createHistoricalReviewContextRegistry(): SupabaseHistoricalReviewContextRegistry {
  return new SupabaseHistoricalReviewContextRegistry(
    createSupabaseAdminClient() as unknown as HistoricalReviewContextRegistryClient,
  );
}

export { historicalContextPublicationFor };
