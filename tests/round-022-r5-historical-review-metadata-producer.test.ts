import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { STRATEGY_VERSION } from "@/lib/config/constants";
import {
  historicalContextId,
  historicalContextPreprocessingHash,
  materializeHistoricalReviewContext,
  validateHistoricalReviewContext,
} from "@/lib/historical-review-context/registry";
import {
  SupabaseHistoricalReviewContextRegistry,
  canonicalizeDatabaseTimestamp,
  type HistoricalReviewContextRegistryClient,
} from "@/lib/historical-review-context/store";
import type { HistoricalReviewContext } from "@/lib/historical-review-context/types";
import {
  R22_HISTORICAL_CONTEXT_APPROVAL_REF,
  R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION,
} from "@/lib/historical-review-context/types";
import {
  buildHistoricalReviewMetadataSnapshotCandidate,
  HistoricalReviewMetadataNotEvaluableError,
  R22_R5_HISTORICAL_REVIEW_METADATA_PRODUCER_IMPLEMENTATION_STATUS,
} from "@/lib/observation-evidence/historical-review-metadata";
import {
  findForbiddenObservationEconomicField,
  validateObservationEvidenceCandidate,
} from "@/lib/observation-evidence/validator";
import { buildDeterministicSignalId } from "@/lib/signal-advisory/identity";
import type { SignalAdvisory } from "@/lib/signal-advisory/types";

const PRIOR_SIGNAL_TIME = "2026-08-22T23:00:00.000Z";
const SIGNAL_TIME = "2026-08-23T00:00:00.000Z";
const CAPTURED_AT = "2026-08-23T00:00:02.000Z";

function advisory(overrides: Partial<SignalAdvisory> = {}): SignalAdvisory {
  const signalTime = overrides.signalTime ?? SIGNAL_TIME;
  const direction = overrides.direction ?? "LONG";
  const signalId = overrides.signalId ?? buildDeterministicSignalId({
    symbol: overrides.symbol ?? "BTCUSDT",
    direction,
    signalTime,
    strategyVersion: STRATEGY_VERSION,
  });
  return {
    signalId,
    symbol: "BTCUSDT",
    direction,
    strategyId: "baseline-001",
    strategyVersion: STRATEGY_VERSION,
    signalTime,
    signalValidUntil: "2026-08-23T01:00:00.000Z",
    currentReferencePrice: 100,
    suggestedEntryReference: 100,
    stopLoss: direction === "LONG" ? 98 : 102,
    takeProfit: direction === "LONG" ? 104 : 96,
    riskReward: 2,
    score: 85,
    grade: "A",
    marketRegime: { btcRegime: "BTC_NEUTRAL", symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY" },
    dataFreshness: {
      status: "FRESH",
      sourceServerTime: "2026-08-23T00:00:05.000Z",
      candleCloseTime: signalTime,
      ageMs: 5_000,
    },
    recipient: "owner@example.test",
    scanRunKey: "hourly-1h:2026-08-23T00:05:00.000Z",
    ...overrides,
  };
}

function priorContext(overrides: Partial<SignalAdvisory> = {}, availableAt = "2026-08-22T23:30:00.000Z") {
  return materializeHistoricalReviewContext({
    advisory: advisory({ signalTime: PRIOR_SIGNAL_TIME, ...overrides }),
    sourceIds: ["tp_signal_advisories:prior-signal"],
    availableAt,
  });
}

function offsetTimestamp(value: string): string {
  return value.replace("Z", "+00:00");
}

function rawRowForContext(
  context: HistoricalReviewContext,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    context_id: context.contextId,
    source_signal_id: context.sourceSignalId,
    symbol: context.symbol,
    timeframe: context.timeframe,
    source_event_time: offsetTimestamp(context.sourceEventTime),
    available_at: offsetTimestamp(context.availableAt),
    feature_snapshot_version: context.featureSnapshotVersion,
    preprocessing_hash: context.preprocessingHash,
    source_ids: [...context.sourceIds],
    feature_snapshot: context.featureSnapshot,
    approval_ref: context.approvalRef,
    created_at: offsetTimestamp(context.availableAt),
    ...overrides,
  };
}

class FakeHistoricalReviewContextRegistryClient implements HistoricalReviewContextRegistryClient {
  rows: Record<string, unknown>[] = [];
  insertCalls: Record<string, unknown>[] = [];
  serverTimestamp = "2026-08-23T00:00:02.000+00:00";

  from() {
    return {
      select: () => this.query(),
      insert: (values: Record<string, unknown>) => ({
        select: () => ({
          maybeSingle: async () => this.insert(values),
        }),
      }),
    };
  }

  private query() {
    const filters: Array<{ kind: "eq" | "neq" | "lte"; column: string; value: unknown }> = [];
    let order: { column: string; ascending: boolean } | null = null;
    const query = {
      eq: (column: string, value: unknown) => {
        filters.push({ kind: "eq", column, value });
        return query;
      },
      neq: (column: string, value: unknown) => {
        filters.push({ kind: "neq", column, value });
        return query;
      },
      lte: (column: string, value: unknown) => {
        filters.push({ kind: "lte", column, value });
        return query;
      },
      order: (column: string, options: { ascending: boolean }) => {
        order = { column, ascending: options.ascending };
        return query;
      },
      limit: async (count: number) => ({ data: this.filteredRows(filters, order).slice(0, count), error: null }),
      maybeSingle: async () => ({ data: this.filteredRows(filters, order)[0] ?? null, error: null }),
    };
    return query;
  }

  private filteredRows(
    filters: readonly { kind: "eq" | "neq" | "lte"; column: string; value: unknown }[],
    order: { column: string; ascending: boolean } | null,
  ): Record<string, unknown>[] {
    const rows = this.rows.filter((row) => filters.every((filter) => {
      const actual = row[filter.column];
      if (filter.kind === "eq") return actual === filter.value;
      if (filter.kind === "neq") return actual !== filter.value;
      return typeof actual === "string"
        && typeof filter.value === "string"
        && Date.parse(actual) <= Date.parse(filter.value);
    }));
    if (order) {
      rows.sort((left, right) => {
        const comparison = Date.parse(String(left[order!.column])) - Date.parse(String(right[order!.column]));
        return order!.ascending ? comparison : -comparison;
      });
    }
    return rows;
  }

  private async insert(values: Record<string, unknown>) {
    this.insertCalls.push({ ...values });
    const existing = this.rows.find((row) => row.source_signal_id === values.source_signal_id);
    if (existing) {
      return { data: null, error: { code: "23505", message: "duplicate key" } };
    }
    const row = {
      ...values,
      available_at: this.serverTimestamp,
      created_at: this.serverTimestamp,
    };
    this.rows.push(row);
    return { data: row, error: null };
  }
}

describe("Round-022 R5 historical review metadata producer", () => {
  it("publishes a concrete identity-only context contract", () => {
    const context = priorContext();

    expect(validateHistoricalReviewContext(context)).toBe(true);
    expect(context.timeframe).toBe("1h");
    expect(context.featureSnapshotVersion).toBe(R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION);
    expect(context.approvalRef).toBe(R22_HISTORICAL_CONTEXT_APPROVAL_REF);
    expect(context.sourceIds).toEqual(["tp_signal_advisories:prior-signal"]);
    expect(context.featureSnapshot).toEqual({
      signalId: context.sourceSignalId,
      symbol: "BTCUSDT",
      direction: "LONG",
      signalTime: PRIOR_SIGNAL_TIME,
      strategyId: "baseline-001",
      strategyVersion: STRATEGY_VERSION,
    });
    expect(JSON.stringify(context)).not.toMatch(
      /pnl|profit|loss|forward_return|futurePrice|futureCandle|win|settlement|reviewResult|positionSize|leverage/i,
    );
  });

  it("uses a frozen preprocessing hash while keeping distinct signal context identities", () => {
    const first = priorContext({ signalTime: "2026-08-22T22:00:00.000Z" });
    const second = priorContext({ direction: "SHORT", signalTime: "2026-08-22T22:00:00.000Z" });

    expect(first.preprocessingHash).toBe(second.preprocessingHash);
    expect(first.contextId).not.toBe(second.contextId);
    expect(first.contextId).toBe(historicalContextId({
      sourceSignalId: first.sourceSignalId,
      featureSnapshotVersion: first.featureSnapshotVersion,
      preprocessingHash: historicalContextPreprocessingHash(),
    }));
  });

  it("normalizes database timestamps at the registry boundary", async () => {
    expect(canonicalizeDatabaseTimestamp("2026-09-09T12:43:25.123+00:00")).toBe("2026-09-09T12:43:25.123Z");
    expect(canonicalizeDatabaseTimestamp("2026-09-09T20:43:25.123+08:00")).toBe("2026-09-09T12:43:25.123Z");
    expect(canonicalizeDatabaseTimestamp("not-a-timestamp")).toBeNull();

    const client = new FakeHistoricalReviewContextRegistryClient();
    const context = priorContext();
    client.rows = [rawRowForContext(context, {
      available_at: "2026-08-23T07:30:00.000+08:00",
    })];
    const result = await new SupabaseHistoricalReviewContextRegistry(client).findPriorContext({
      currentSignalId: advisory().signalId,
      symbol: "BTCUSDT",
      signalTime: SIGNAL_TIME,
    });

    expect(result.status).toBe("FOUND");
    if (result.status === "FOUND") {
      expect(result.context.sourceEventTime).toBe(PRIOR_SIGNAL_TIME);
      expect(result.context.availableAt).toBe("2026-08-22T23:30:00.000Z");
      expect(Date.parse(result.context.sourceEventTime)).toBeLessThanOrEqual(Date.parse(result.context.availableAt));
    }
  });

  it("uses the real Supabase registry contract for lookup eligibility and deterministic selection", async () => {
    const current = advisory();
    const client = new FakeHistoricalReviewContextRegistryClient();
    const registry = new SupabaseHistoricalReviewContextRegistry(client);
    const missing = await registry.findPriorContext({
      currentSignalId: current.signalId,
      symbol: current.symbol,
      signalTime: current.signalTime,
    });
    expect(missing).toEqual({ status: "MISSING", reason: "NO_APPROVED_PRIOR_CONTEXT" });

    client.rows = [
      rawRowForContext(priorContext({}, "2026-08-22T23:10:00.000Z")),
      rawRowForContext(priorContext({ direction: "SHORT" }, "2026-08-22T23:20:00.000Z")),
      rawRowForContext(priorContext({ signalTime: SIGNAL_TIME, signalId: current.signalId }, "2026-08-22T23:30:00.000Z")),
      rawRowForContext(priorContext({}, "2026-08-23T00:00:01.000Z")),
      rawRowForContext(priorContext({ symbol: "ETHUSDT" }, "2026-08-22T23:40:00.000Z"), { symbol: "ETHUSDT" }),
      rawRowForContext(priorContext({}, "2026-08-22T23:50:00.000Z"), { timeframe: "4h" }),
    ];
    const selected = await registry.findPriorContext({
      currentSignalId: current.signalId,
      symbol: "BTCUSDT",
      signalTime: SIGNAL_TIME,
    });
    expect(selected.status).toBe("FOUND");
    if (selected.status === "FOUND") {
      expect(selected.context.availableAt).toBe("2026-08-22T23:20:00.000Z");
    }
  });

  it("rejects invalid rows and exact maximum availability ties", async () => {
    const current = advisory();
    const invalidClient = new FakeHistoricalReviewContextRegistryClient();
    invalidClient.rows = [rawRowForContext(priorContext(), { approval_ref: "UNAPPROVED" })];
    const invalid = await new SupabaseHistoricalReviewContextRegistry(invalidClient).findPriorContext({
      currentSignalId: current.signalId,
      symbol: "BTCUSDT",
      signalTime: SIGNAL_TIME,
    });
    expect(invalid).toEqual({ status: "NOT_EVALUABLE", reason: "INVALID_CONTEXT_RECORD" });

    const tieClient = new FakeHistoricalReviewContextRegistryClient();
    tieClient.rows = [
      rawRowForContext(priorContext({}, "2026-08-22T23:30:00.000Z")),
      rawRowForContext(priorContext({ direction: "SHORT" }, "2026-08-22T23:30:00.000Z")),
    ];
    const tie = await new SupabaseHistoricalReviewContextRegistry(tieClient).findPriorContext({
      currentSignalId: current.signalId,
      symbol: "BTCUSDT",
      signalTime: SIGNAL_TIME,
    });
    expect(tie).toEqual({ status: "NOT_EVALUABLE", reason: "AMBIGUOUS_MAX_AVAILABLE_CONTEXT" });
  });

  it("requires the exact identity-only feature snapshot schema", async () => {
    const context = priorContext();
    const cleanClient = new FakeHistoricalReviewContextRegistryClient();
    cleanClient.rows = [rawRowForContext(context)];
    const clean = await new SupabaseHistoricalReviewContextRegistry(cleanClient).findPriorContext({
      currentSignalId: advisory().signalId,
      symbol: "BTCUSDT",
      signalTime: SIGNAL_TIME,
    });
    expect(clean.status).toBe("FOUND");

    const invalidFeatures = [
      { ...context.featureSnapshot, debug: "x" },
      { ...context.featureSnapshot, profit: 123 },
      { ...context.featureSnapshot, metadata: { forwardReturn: 0.12 } },
      { ...context.featureSnapshot, strategyId: "" },
      { ...context.featureSnapshot, direction: "SIDE" },
    ];
    for (const featureSnapshot of invalidFeatures) {
      const client = new FakeHistoricalReviewContextRegistryClient();
      client.rows = [rawRowForContext(context, { feature_snapshot: featureSnapshot })];
      const result = await new SupabaseHistoricalReviewContextRegistry(client).findPriorContext({
        currentSignalId: advisory().signalId,
        symbol: "BTCUSDT",
        signalTime: SIGNAL_TIME,
      });
      expect(result).toEqual({ status: "NOT_EVALUABLE", reason: "INVALID_CONTEXT_RECORD" });
    }
  });

  it("publishes, replays, and fails closed on a conflicting logical identity", async () => {
    const input = { advisory: advisory(), sourceIds: [`tp_signal_advisories:${advisory().signalId}`] };
    const client = new FakeHistoricalReviewContextRegistryClient();
    const registry = new SupabaseHistoricalReviewContextRegistry(client);
    const appended = await registry.publishContext(input);
    const replay = await registry.publishContext(input);

    expect(appended.status).toBe("APPENDED");
    expect(replay.status).toBe("IDEMPOTENT_REPLAY");
    expect(client.insertCalls).toHaveLength(2);
    expect(client.insertCalls[0]).not.toHaveProperty("available_at");
    expect(client.insertCalls[0]).not.toHaveProperty("created_at");

    const conflictClient = new FakeHistoricalReviewContextRegistryClient();
    conflictClient.rows = [rawRowForContext(materializeHistoricalReviewContext({
      advisory: input.advisory,
      sourceIds: ["different-source"],
      availableAt: "2026-08-23T00:00:02.000Z",
    }))];
    const conflictRegistry = new SupabaseHistoricalReviewContextRegistry(conflictClient);
    await expect(conflictRegistry.publishContext(input)).rejects.toThrow(/CONTEXT_ID_CONFLICT/);
    expect(conflictClient.rows).toHaveLength(1);
  });

  it.each([
    ["featureSnapshot strategyId", (context: HistoricalReviewContext) => ({
      ...context.featureSnapshot,
      strategyId: "other-strategy",
    })],
    ["sourceEventTime and feature signalTime", (context: HistoricalReviewContext) => ({
      ...context.featureSnapshot,
      signalTime: "2026-08-22T22:00:00.000Z",
    })],
    ["symbol", (context: HistoricalReviewContext) => ({
      ...context.featureSnapshot,
      symbol: "ETHUSDT",
    })],
  ] as const)("rejects %s when the existing logical draft differs", async (_label, featureSnapshotFor) => {
    const input = { advisory: advisory(), sourceIds: [`tp_signal_advisories:${advisory().signalId}`] };
    const context = materializeHistoricalReviewContext({
      advisory: input.advisory,
      sourceIds: input.sourceIds,
      availableAt: "2026-08-23T00:00:02.000Z",
    });
    const featureSnapshot = featureSnapshotFor(context);
    const client = new FakeHistoricalReviewContextRegistryClient();
    client.rows = [rawRowForContext(context, {
      symbol: featureSnapshot.symbol,
      source_event_time: offsetTimestamp(featureSnapshot.signalTime),
      feature_snapshot: featureSnapshot,
    })];
    const registry = new SupabaseHistoricalReviewContextRegistry(client);

    await expect(registry.publishContext(input)).rejects.toThrow(/CONTEXT_ID_CONFLICT/);
    expect(client.rows).toHaveLength(1);
  });

  it("builds a valid historical metadata snapshot from the exact prior context", () => {
    const candidate = buildHistoricalReviewMetadataSnapshotCandidate({
      advisory: advisory(),
      priorContext: priorContext(),
      capturedAt: CAPTURED_AT,
    });

    expect(candidate.artifactType).toBe("HISTORICAL_REVIEW_METADATA");
    expect(candidate.informationAsOf).toBe(SIGNAL_TIME);
    expect(validateObservationEvidenceCandidate(candidate)).toMatchObject({ status: "VALID", reason: "NONE" });
    expect(findForbiddenObservationEconomicField(candidate.payload)).toBeNull();
    expect(candidate.payload).toMatchObject({
      humanDecisionRequired: true,
      automaticTrading: false,
      priorContext: {
        sourceEventTime: PRIOR_SIGNAL_TIME,
        availableAt: "2026-08-22T23:30:00.000Z",
      },
    });
    expect(JSON.stringify(candidate.payload)).not.toMatch(
      /pnl|profit|loss|forward_return|futurePrice|futureCandle|win|settlement|reviewResult|positionSize|leverage/i,
    );
  });

  it.each([
    ["current self reference", priorContext(
      { signalTime: SIGNAL_TIME, signalId: advisory().signalId },
      "2026-08-23T00:00:00.000Z",
    ), "CURRENT_CONTEXT_SELF_REFERENCE"],
    ["future availableAt", priorContext({}, "2026-08-23T00:00:01.000Z"), "PRIOR_CONTEXT_NOT_AVAILABLE_AT_SIGNAL_TIME"],
    ["wrong symbol", priorContext({ symbol: "ETHUSDT" }), "PRIOR_CONTEXT_SYMBOL_OR_TIMEFRAME_MISMATCH"],
  ] as const)("rejects %s", (_label, context, reason) => {
    expect(() => buildHistoricalReviewMetadataSnapshotCandidate({
      advisory: advisory(),
      priorContext: context,
      capturedAt: CAPTURED_AT,
    })).toThrow(`${reason}`);
    expect(() => buildHistoricalReviewMetadataSnapshotCandidate({
      advisory: advisory(),
      priorContext: context,
      capturedAt: CAPTURED_AT,
    })).toThrow(HistoricalReviewMetadataNotEvaluableError);
  });

  it("rejects capture before the current signal and never backdates it", () => {
    expect(() => buildHistoricalReviewMetadataSnapshotCandidate({
      advisory: advisory(),
      priorContext: priorContext(),
      capturedAt: "2026-08-22T23:59:59.999Z",
    })).toThrow("CAPTURE_BEFORE_SIGNAL");
  });

  it("keeps R5 governance identity-only and closes only S04", () => {
    expect(R22_R5_HISTORICAL_REVIEW_METADATA_PRODUCER_IMPLEMENTATION_STATUS).toMatchObject({
      r5HistoricalReviewMetadataProducerImplemented: true,
      introducesCapabilities: ["prospectiveHistoricalReviewMetadataProducer"],
      closesReadinessNodes: ["S04"],
      r5AcceptanceStatus: "ACCEPTED",
      s01Status: "SOURCE_READY",
      s02Status: "SOURCE_READY",
      s03Status: "SOURCE_READY",
      s04ImplementationStatus: "SOURCE_READY",
      s04AcceptedReady: true,
      s05Status: "FAIL",
      s10Status: "FAIL",
      observationExecuted: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      forwardReturnRead: false,
      newMarketDataFetched: false,
      automaticTrading: false,
    });
  });

  it("keeps the design-only historical protocol out of runtime R5 code", () => {
    const scanSource = readFileSync("src/lib/signal-advisory/scan.ts", "utf8");
    const producerSource = readFileSync("src/lib/observation-evidence/historical-review-metadata.ts", "utf8");
    const registrySource = readFileSync("src/lib/historical-review-context/store.ts", "utf8");
    expect(`${scanSource}\n${producerSource}\n${registrySource}`).not.toContain("historical-review-protocol");
    expect(`${scanSource}\n${producerSource}\n${registrySource}`).not.toMatch(/tp_signal_reviews|forward_return|realized_pnl|settlement_state/);
  });

  it("freezes append-only registry database constraints and server-owned availability", () => {
    const migration = readFileSync(
      "supabase/migrations/20260909000000_r22_historical_review_context_registry.sql",
      "utf8",
    );
    expect(migration).toContain("context_id text primary key");
    expect(migration).toContain("source_signal_id text not null unique");
    expect(migration).toContain("available_at timestamptz not null default now()");
    expect(migration).not.toMatch(/available_at[^\n]*input|caller|parameter/i);
    expect(migration).toContain("before update or delete");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke insert on table public.tp_historical_review_context_registry from service_role");
    expect(migration).toContain("grant select on table public.tp_historical_review_context_registry to service_role");
    expect(migration).toContain("grant insert (");
    expect(migration).not.toContain("grant select, insert on table public.tp_historical_review_context_registry to service_role");
    const insertGrant = migration.match(/grant insert \(([\s\S]*?)\) on table public\.tp_historical_review_context_registry to service_role/i)?.[1] ?? "";
    expect(insertGrant).not.toContain("available_at");
    expect(insertGrant).not.toContain("created_at");
    expect(migration).toContain("tp_historical_review_context_server_timestamp_authority");
    expect(migration).toContain("before insert on public.tp_historical_review_context_registry");
    expect(migration).toContain("new.available_at := server_timestamp");
    expect(migration).toContain("new.created_at := server_timestamp");
    expect(migration).not.toMatch(/on conflict[^\n]*do update|update public\.tp_historical_review_context_registry|delete from public\.tp_historical_review_context_registry/i);
  });
});
