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

  it("uses deterministic preprocessing and context identities independent of availableAt", () => {
    const first = priorContext({}, "2026-08-22T23:30:00.000Z");
    const second = priorContext({}, "2026-08-22T23:45:00.000Z");

    expect(first.preprocessingHash).toBe(second.preprocessingHash);
    expect(first.contextId).toBe(second.contextId);
    expect(first.contextId).toBe(historicalContextId({
      sourceSignalId: first.sourceSignalId,
      featureSnapshotVersion: first.featureSnapshotVersion,
      preprocessingHash: historicalContextPreprocessingHash(first.featureSnapshot),
    }));
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
      s01Status: "SOURCE_READY",
      s02Status: "SOURCE_READY",
      s03Status: "SOURCE_READY",
      s04ImplementationStatus: "SOURCE_READY_PENDING_ACCEPTANCE",
      s04AcceptedReady: false,
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
    expect(migration).toContain("grant select, insert on table public.tp_historical_review_context_registry to service_role");
    expect(migration).not.toMatch(/on conflict[^\n]*do update|update public\.tp_historical_review_context_registry|delete from public\.tp_historical_review_context_registry/i);
  });
});
