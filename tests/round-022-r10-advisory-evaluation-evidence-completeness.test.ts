import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "@/lib/config/constants";
import { materializeHistoricalReviewContext } from "@/lib/historical-review-context/registry";
import {
  evaluateR22AdvisoryEvidenceCompleteness,
  evaluateR22CompleteAdvisoryEvidence,
  resolveR22AdvisoryEvidenceCompleteness,
  type R22EvidenceCompletenessReadStore,
} from "@/lib/advisory-evaluation/evidence-completeness";
import {
  buildAlertIntelligenceSnapshotCandidate,
} from "@/lib/observation-evidence/alert-intelligence";
import { buildHistoricalReviewMetadataSnapshotCandidate } from "@/lib/observation-evidence/historical-review-metadata";
import {
  buildR22ReviewStartedCandidate,
  buildR22ReviewSubmittedCandidate,
  calculateR22ReviewObservationId,
} from "@/lib/observation-evidence/human-review";
import { buildMarketContextSnapshotCandidate } from "@/lib/observation-evidence/market-context";
import { buildNotificationObservationCandidate } from "@/lib/observation-evidence/notification";
import { buildPresentationSnapshotCandidate } from "@/lib/observation-evidence/presentation";
import { buildQualitySnapshotCandidate } from "@/lib/observation-evidence/quality-snapshot";
import { buildRiskAdvisorySnapshotCandidate } from "@/lib/observation-evidence/risk-advisory";
import {
  SupabaseObservationEvidenceStore,
  type ObservationEvidenceClient,
} from "@/lib/observation-evidence/store";
import type { ObservationAdvisoryIdentity, ObservationEvidenceCandidate } from "@/lib/observation-evidence/types";
import { validateObservationEvidenceCandidate } from "@/lib/observation-evidence/validator";
import {
  buildDeliveredEvidence,
  buildDeliveryAttemptedEvidence,
  buildNotificationDecisionMetadata,
  type NotificationEvidenceEvent,
} from "@/lib/signal-advisory/notification-evidence";
import type { Candle, MarketSnapshot } from "@/lib/market-data/types";
import type { SignalAdvisory } from "@/lib/signal-advisory/types";
import {
  R22_R10_EVIDENCE_COMPLETENESS_CONTRACT,
  R22_R10_FINAL_DECISION,
  R22_R10_REQUIRED_SNAPSHOT_ARTIFACT_TYPES,
  R22_R10_STATUS,
} from "@/lib/research/round-022-r10-advisory-evaluation-evidence-completeness-protocol";

const SIGNAL_TIME = "2026-08-23T00:00:00.000Z";
const CAPTURED_AT = "2026-08-23T00:00:06.000Z";
const FOUR_HOUR_MS = 14_400_000;

function advisory(direction: "LONG" | "SHORT" = "LONG"): SignalAdvisory {
  const symbol = "BTCUSDT";
  return {
    signalId: `r10-signal-${direction.toLowerCase()}`,
    symbol,
    direction,
    strategyId: "baseline-001",
    strategyVersion: STRATEGY_VERSION,
    signalTime: SIGNAL_TIME,
    signalValidUntil: "2026-08-23T01:00:00.000Z",
    currentReferencePrice: 100,
    suggestedEntryReference: 100,
    stopLoss: direction === "LONG" ? 98 : 102,
    takeProfit: direction === "LONG" ? 104 : 96,
    riskReward: 2,
    score: 85,
    grade: "A",
    marketRegime: {
      btcRegime: "BTC_NEUTRAL",
      symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
    },
    dataFreshness: {
      status: "FRESH",
      sourceServerTime: "2026-08-23T00:00:05.000Z",
      candleCloseTime: SIGNAL_TIME,
      ageMs: 5_000,
    },
    recipient: "owner@example.test",
    scanRunKey: "r10-scan-1",
  };
}

function identityOf(current: SignalAdvisory): ObservationAdvisoryIdentity {
  return {
    signalId: current.signalId,
    symbol: current.symbol,
    direction: current.direction,
    signalTime: current.signalTime,
    strategyId: current.strategyId,
    strategyVersion: current.strategyVersion,
  };
}

function candle(symbol: ResearchSymbol, closeTime: number, index: number): Candle {
  const close = 100 + index;
  return {
    symbol,
    timeframe: "4h",
    openTime: closeTime - FOUR_HOUR_MS + 1,
    closeTime,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 100 + index,
    quoteVolume: 1_000 + index,
    tradeCount: 10 + index,
    takerBuyBaseVolume: 40 + index,
    takerBuyQuoteVolume: 400 + index,
  };
}

function series(symbol: ResearchSymbol): Candle[] {
  const lastCloseTime = Date.parse(SIGNAL_TIME) - 1;
  return Array.from({ length: 3 }, (_, index) =>
    candle(symbol, lastCloseTime - (2 - index) * FOUR_HOUR_MS, index),
  );
}

function snapshot(): MarketSnapshot {
  const serverTime = Date.parse(SIGNAL_TIME) + 3_600_000;
  const symbols = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => {
    const candles4h = series(symbol);
    const candle1h: Candle = {
      ...candle(symbol, Date.parse(SIGNAL_TIME) - 1, 0),
      timeframe: "1h",
      openTime: Date.parse(SIGNAL_TIME) - 3_599_999,
    };
    return [symbol, {
      symbol,
      status: "VALID" as const,
      datasets: {
        "1h": {
          symbol,
          timeframe: "1h" as const,
          serverTime,
          expectedLatestOpenTime: candle1h.openTime,
          candles: [candle1h],
        },
        "4h": {
          symbol,
          timeframe: "4h" as const,
          serverTime,
          expectedLatestOpenTime: candles4h.at(-1)!.openTime,
          candles: candles4h,
        },
      },
    }];
  }));
  return {
    status: "VALID",
    provider: "binance-usdm-public",
    generatedAt: Date.parse(SIGNAL_TIME) + 1_000,
    serverTime: {
      serverTime,
      operationStartedAt: Date.parse(SIGNAL_TIME),
      attemptStartedAt: Date.parse(SIGNAL_TIME),
      attemptCompletedAt: Date.parse(SIGNAL_TIME) + 1_000,
      roundTripMs: 1_000,
      estimatedClockOffsetMs: 0,
    },
    symbols: symbols as unknown as MarketSnapshot["symbols"],
    diagnostics: {
      operationStartedAt: Date.parse(SIGNAL_TIME),
      operationCompletedAt: Date.parse(SIGNAL_TIME) + 1_000,
      roundTripMs: 1_000,
      requestCount: 0,
      requestWeightHeaders: [],
    },
  };
}

function upstream(current: SignalAdvisory): {
  quality: ObservationEvidenceCandidate;
  context: ObservationEvidenceCandidate;
  risk: ObservationEvidenceCandidate;
  historical: ObservationEvidenceCandidate;
  alert: ObservationEvidenceCandidate;
  presentation: ObservationEvidenceCandidate;
} {
  const quality = buildQualitySnapshotCandidate({ advisory: current, capturedAt: CAPTURED_AT });
  const context = buildMarketContextSnapshotCandidate({
    advisory: current,
    snapshot: snapshot(),
    capturedAt: CAPTURED_AT,
  });
  const risk = buildRiskAdvisorySnapshotCandidate({ advisory: current, capturedAt: CAPTURED_AT });
  const prior = materializeHistoricalReviewContext({
    advisory: {
      ...current,
      signalId: `${current.signalId}-prior`,
      signalTime: "2026-08-22T20:00:00.000Z",
      signalValidUntil: "2026-08-22T21:00:00.000Z",
      dataFreshness: {
        ...current.dataFreshness,
        candleCloseTime: "2026-08-22T20:00:00.000Z",
      } as unknown as SignalAdvisory["dataFreshness"],
    },
    sourceIds: [`tp_signal_advisories:${current.signalId}-prior`],
    availableAt: "2026-08-22T23:30:00.000Z",
  });
  const historical = buildHistoricalReviewMetadataSnapshotCandidate({
    advisory: current,
    priorContext: prior,
    capturedAt: CAPTURED_AT,
  });
  const alert = buildAlertIntelligenceSnapshotCandidate({
    advisory: current,
    qualityEvidence: quality,
    marketContextEvidence: context,
    riskAdvisoryEvidence: risk,
    historicalReviewEvidence: historical,
    capturedAt: CAPTURED_AT,
  });
  const presentation = buildPresentationSnapshotCandidate({
    advisory: current,
    alertIntelligenceEvidence: alert,
    presentationChannel: "EMAIL",
    presentationPayload: {
      alertSummary: "Human review required.",
      contextSummary: "Context is available.",
      riskSummary: "Risk advisory is available.",
    },
    capturedAt: CAPTURED_AT,
  });
  return { quality, context, risk, historical, alert, presentation };
}

function notificationCandidates(current: SignalAdvisory): ObservationEvidenceCandidate[] {
  const metadata = buildNotificationDecisionMetadata({
    scanId: "r10-scan-1",
    signalId: current.signalId,
    decisionType: "CLAIMED",
  });
  const events: NotificationEvidenceEvent[] = [
    buildDeliveryAttemptedEvidence(metadata),
    buildDeliveredEvidence(metadata),
  ];
  return events.map((event) => buildNotificationObservationCandidate({
    advisory: current,
    event,
    observedAt: "2026-08-23T00:00:04.000Z",
    capturedAt: CAPTURED_AT,
  }));
}

function reviewCandidates(current: SignalAdvisory): ObservationEvidenceCandidate[] {
  const reviewObservationId = calculateR22ReviewObservationId(current.signalId);
  const identity = identityOf(current);
  return [
    buildR22ReviewStartedCandidate({
      advisory: identity,
      reviewStartedAt: "2026-08-23T00:00:07.000Z",
      capturedAt: "2026-08-23T00:00:08.000Z",
    }),
    buildR22ReviewSubmittedCandidate({
      advisory: identity,
      reviewObservationId,
      reviewStartedAt: "2026-08-23T00:00:07.000Z",
      reviewSubmittedAt: "2026-08-23T00:00:09.000Z",
      capturedAt: "2026-08-23T00:00:09.000Z",
      labels: {
        reviewComplete: true,
        informationSufficient: true,
        unnecessaryAlert: false,
      },
    }),
  ];
}

function evidenceSet(current = advisory()): {
  identity: ObservationAdvisoryIdentity;
  candidates: ObservationEvidenceCandidate[];
} {
  const built = upstream(current);
  return {
    identity: identityOf(current),
    candidates: [
      built.quality,
      built.context,
      built.risk,
      built.historical,
      built.alert,
      built.presentation,
      ...notificationCandidates(current),
      ...reviewCandidates(current),
    ],
  };
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

class InMemoryEvidenceReadStore implements R22EvidenceCompletenessReadStore {
  constructor(private readonly candidates: readonly ObservationEvidenceCandidate[]) {}

  async findEvidenceBySignalId(signalId: string): Promise<readonly ObservationEvidenceCandidate[]> {
    return this.candidates.filter((candidate) => candidate.signalId === signalId);
  }
}

class MetadataProjectionClient implements ObservationEvidenceClient {
  constructor(private readonly rows: readonly Record<string, unknown>[] = []) {}

  selectColumns: string | undefined;
  insertCalls = 0;

  from(table: string) {
    void table;
    const filter: {
      eq(column: string, value: unknown): typeof filter;
      maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: null }>;
      then<TResult1 = { data: readonly Record<string, unknown>[]; error: null }, TResult2 = never>(
        onfulfilled?: ((value: { data: readonly Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2>;
    } = {
      eq: () => filter,
      maybeSingle: async () => ({ data: null, error: null }),
      then: (onfulfilled, onrejected) => Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected),
    };
    return {
      insert: async () => {
        this.insertCalls += 1;
        return { data: null, error: null };
      },
      select: (columns?: string) => {
        this.selectColumns = columns;
        return filter;
      },
    };
  }
}

describe("Round-022 R10 evidence completeness and advisory evaluation", () => {
  it("accepts a complete P01 plus S01-S09 evidence chain and produces P02 metrics", () => {
    const prepared = evidenceSet();
    const resolved = evaluateR22AdvisoryEvidenceCompleteness(prepared.identity, prepared.candidates);
    expect(resolved).toMatchObject({ status: "OBSERVABLE", reason: "NONE", readOnly: true });
    expect(resolved.evidence).not.toBeNull();
    expect(evaluateR22CompleteAdvisoryEvidence(resolved)).toMatchObject({
      status: "OBSERVABLE",
      reason: "NONE",
      direction: "LONG",
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it("resolves through a read-only store without changing evidence", async () => {
    const prepared = evidenceSet(advisory("SHORT"));
    const before = JSON.stringify(prepared.candidates);
    const store = new InMemoryEvidenceReadStore(prepared.candidates);
    const resolved = await resolveR22AdvisoryEvidenceCompleteness({
      identity: prepared.identity,
      evidenceStore: store,
    });
    expect(resolved.status).toBe("OBSERVABLE");
    expect(JSON.stringify(prepared.candidates)).toBe(before);
    expect(evaluateR22CompleteAdvisoryEvidence(resolved)).toMatchObject({
      status: "OBSERVABLE",
      direction: "SHORT",
    });
  });

  it("uses a metadata-only projection and never writes while resolving store evidence", async () => {
    const client = new MetadataProjectionClient();
    const store = new SupabaseObservationEvidenceStore(client);
    await expect(store.findEvidenceBySignalId("r10-signal-long")).resolves.toEqual([]);
    expect(client.insertCalls).toBe(0);
    expect(client.selectColumns).toContain("evidence_id");
    expect(client.selectColumns).toContain("payload");
    expect(client.selectColumns).not.toMatch(/pnl|profit|loss|forward|future|drawdown/i);
  });

  it("hydrates the complete read projection so R10 can resolve snapshots, notifications, and reviews", async () => {
    const prepared = evidenceSet();
    const client = new MetadataProjectionClient(prepared.candidates.map(rowFromCandidate));
    const store = new SupabaseObservationEvidenceStore(client);

    const hydrated = await store.findEvidenceBySignalId(prepared.identity.signalId);
    expect(hydrated).toHaveLength(prepared.candidates.length);
    expect(new Set(hydrated.map((candidate) => candidate.eventKind))).toEqual(
      new Set(["SNAPSHOT", "NOTIFICATION", "REVIEW"]),
    );
    expect(hydrated.filter((candidate) => candidate.eventKind === "SNAPSHOT")).toHaveLength(6);
    expect(hydrated.filter((candidate) => candidate.eventKind === "NOTIFICATION")).toHaveLength(2);
    expect(hydrated.filter((candidate) => candidate.eventKind === "REVIEW")).toHaveLength(2);

    const resolved = await resolveR22AdvisoryEvidenceCompleteness({
      identity: prepared.identity,
      evidenceStore: store,
    });
    expect(resolved).toMatchObject({ status: "OBSERVABLE", reason: "NONE" });
    expect(evaluateR22CompleteAdvisoryEvidence(resolved)).toMatchObject({
      status: "OBSERVABLE",
      direction: "LONG",
    });
  });

  it.each([
    ["SNAPSHOT missing artifactId", (row: Record<string, unknown>) => row.event_kind === "SNAPSHOT", (row: Record<string, unknown>) => ({ ...row, artifact_id: null })],
    ["NOTIFICATION missing notificationObservationId", (row: Record<string, unknown>) => row.event_kind === "NOTIFICATION", (row: Record<string, unknown>) => ({ ...row, notification_observation_id: null })],
    ["REVIEW missing reviewObservationId", (row: Record<string, unknown>) => row.event_kind === "REVIEW", (row: Record<string, unknown>) => ({ ...row, review_observation_id: null })],
    ["REVIEW missing eventType", (row: Record<string, unknown>) => row.event_kind === "REVIEW" && row.event_type === "REVIEW_STARTED", (row: Record<string, unknown>) => ({ ...row, event_type: null })],
    ["invalid eventKind", (row: Record<string, unknown>) => row.event_kind === "SNAPSHOT", (row: Record<string, unknown>) => ({ ...row, event_kind: "UNSUPPORTED" })],
    ["invalid timestampAuthority", (row: Record<string, unknown>) => row.event_kind === "SNAPSHOT", (row: Record<string, unknown>) => ({ ...row, timestamp_authority: {} })],
  ] as const)("drops malformed %s rows without repair or cross-kind coercion", async (_label, selectTarget, mutate) => {
    const prepared = evidenceSet();
    const rows = prepared.candidates.map(rowFromCandidate);
    const target = rows.find(selectTarget)!;
    const targetEvidenceId = target.evidence_id;
    const client = new MetadataProjectionClient(rows.map((row) => row === target ? mutate(row) : row));
    const store = new SupabaseObservationEvidenceStore(client);

    const hydrated = await store.findEvidenceBySignalId(prepared.identity.signalId);
    expect(hydrated).toHaveLength(rows.length - 1);
    expect(hydrated.some((candidate) => candidate.evidenceId === targetEvidenceId)).toBe(false);
  });

  it.each([
    ["QUALITY_SNAPSHOT", "quality"],
    ["MARKET_CONTEXT", "context"],
    ["RISK_ADVISORY", "risk"],
    ["HISTORICAL_REVIEW_METADATA", "historical"],
    ["ALERT_INTELLIGENCE", "alert"],
    ["PRESENTATION", "presentation"],
  ] as const)("fails closed when S01-S06 %s is missing", (_artifactType, key) => {
    const prepared = evidenceSet();
    const built = upstream(advisory());
    const omitted = built[key].evidenceId;
    const result = evaluateR22AdvisoryEvidenceCompleteness(
      prepared.identity,
      prepared.candidates.filter((candidate) => candidate.evidenceId !== omitted),
    );
    expect(result).toMatchObject({ status: "NOT_EVALUABLE", reason: "MISSING_EVIDENCE" });
  });

  it("fails closed when R8 notification causal evidence is missing", () => {
    const prepared = evidenceSet();
    const result = evaluateR22AdvisoryEvidenceCompleteness(
      prepared.identity,
      prepared.candidates.filter((candidate) => candidate.eventKind !== "NOTIFICATION"),
    );
    expect(result).toMatchObject({ status: "NOT_EVALUABLE", reason: "NOTIFICATION_IDENTITY_INVALID" });
  });

  it("fails closed when either persisted human-review event is missing", () => {
    const prepared = evidenceSet();
    for (const eventType of ["REVIEW_STARTED", "REVIEW_SUBMITTED"] as const) {
      const result = evaluateR22AdvisoryEvidenceCompleteness(
        prepared.identity,
        prepared.candidates.filter((candidate) => candidate.eventType !== eventType),
      );
      expect(result).toMatchObject({ status: "NOT_EVALUABLE", reason: "MISSING_EVIDENCE" });
    }
  });

  it.each([
    ["cross-source signal identity", (candidate: ObservationEvidenceCandidate) => ({ ...candidate, signalId: "other-signal" })],
    ["corrupt snapshot hash", (candidate: ObservationEvidenceCandidate) => ({ ...candidate, contentHash: "0".repeat(64) })],
    ["future PIT", (candidate: ObservationEvidenceCandidate) => ({ ...candidate, informationAsOf: "2026-08-23T00:00:00.001Z" })],
    ["notification causal timestamp", (candidate: ObservationEvidenceCandidate) => ({ ...candidate, observedAt: "2026-08-22T23:59:59.999Z" })],
    ["review causal timestamp", (candidate: ObservationEvidenceCandidate) => ({ ...candidate, reviewStartedAt: "2026-08-22T23:59:59.999Z" })],
    ["forbidden economic field", (candidate: ObservationEvidenceCandidate) => ({
      ...candidate,
      payload: { ...(candidate.payload as Record<string, unknown>), profit: 10 },
    })],
  ] as const)("rejects %s without repair or reconstruction", (_label, mutate) => {
    const prepared = evidenceSet();
    const target = prepared.candidates[0]!;
    const mutated = mutate(target) as ObservationEvidenceCandidate;
    const result = evaluateR22AdvisoryEvidenceCompleteness(
      prepared.identity,
      prepared.candidates.map((candidate) => candidate.evidenceId === target.evidenceId ? mutated : candidate),
    );
    expect(result.status).toBe("NOT_EVALUABLE");
  });

  it("detects duplicate logical evidence and conflicting notification terminal payloads", () => {
    const prepared = evidenceSet();
    const duplicate = evaluateR22AdvisoryEvidenceCompleteness(
      prepared.identity,
      [...prepared.candidates, prepared.candidates[0]!],
    );
    expect(duplicate).toMatchObject({ status: "NOT_EVALUABLE", reason: "DUPLICATE_LOGICAL_IDENTITY" });

    const delivered = prepared.candidates.find((candidate) => (
      candidate.eventKind === "NOTIFICATION"
      && (candidate.payload as Record<string, Record<string, unknown>>).notification?.eventType === "DELIVERED"
    ))!;
    const conflicting = {
      ...delivered,
      evidenceId: `${delivered.evidenceId}-conflict`,
      notificationObservationId: `${delivered.notificationObservationId}-conflict`,
      idempotencyKey: `${delivered.idempotencyKey}-conflict`,
      payload: {
        ...(delivered.payload as Record<string, unknown>),
        notification: {
          ...((delivered.payload as Record<string, Record<string, unknown>>).notification),
          terminalOutcome: "DELIVERY_FAILED",
          failureCode: "SMTP_AUTH_FAILED",
        },
      },
    } as ObservationEvidenceCandidate;
    const conflict = evaluateR22AdvisoryEvidenceCompleteness(
      prepared.identity,
      [...prepared.candidates, conflicting],
    );
    expect(conflict).toMatchObject({ status: "NOT_EVALUABLE", reason: "NOTIFICATION_IDENTITY_INVALID" });
  });

  it("uses R9 unnecessaryAlert and R8 disposition, never presentation fields", () => {
    const current = advisory();
    const prepared = evidenceSet(current);
    const presentation = prepared.candidates.find((candidate) => candidate.artifactType === "PRESENTATION")!;
    const alert = prepared.candidates.find((candidate) => candidate.artifactType === "ALERT_INTELLIGENCE")!;
    const poisonedPresentation = buildPresentationSnapshotCandidate({
      advisory: current,
      alertIntelligenceEvidence: alert,
      presentationChannel: "EMAIL",
      presentationPayload: {
        unnecessaryAlert: true,
        notificationDisposition: "IGNORED",
      },
      capturedAt: CAPTURED_AT,
    });
    const result = evaluateR22AdvisoryEvidenceCompleteness(
      prepared.identity,
      prepared.candidates.map((candidate) => candidate.evidenceId === presentation.evidenceId ? poisonedPresentation : candidate),
    );
    expect(result.status).toBe("OBSERVABLE");
    expect(evaluateR22CompleteAdvisoryEvidence(result)).toMatchObject({
      status: "OBSERVABLE",
      metrics: { noiseReduction: { unnecessaryAlertRate: 0, ignoreRatio: 0, duplicateAlertRate: 0 } },
    });

    const evaluation = evaluateR22CompleteAdvisoryEvidence(evaluateR22AdvisoryEvidenceCompleteness(
      prepared.identity,
      prepared.candidates,
    ));
    expect(evaluation).toMatchObject({
      status: "OBSERVABLE",
      metrics: { noiseReduction: { unnecessaryAlertRate: 0, ignoreRatio: 0, duplicateAlertRate: 0 } },
    });
  });

  it("keeps evaluation output advisory-only and contains no economic result fields", () => {
    const prepared = evidenceSet();
    const result = evaluateR22CompleteAdvisoryEvidence(
      evaluateR22AdvisoryEvidenceCompleteness(prepared.identity, prepared.candidates),
    );
    expect(JSON.stringify(result)).not.toMatch(/pnl|profit|loss|forwardReturn|futurePrice|realized|drawdown|performance/i);
    expect(result).toMatchObject({ observedOnly: true, humanDecisionRequired: true, automaticTrading: false });
  });

  it("freezes R10 S10 ownership, governance, and final implementation boundary", () => {
    expect(R22_R10_REQUIRED_SNAPSHOT_ARTIFACT_TYPES).toHaveLength(6);
    expect(R22_R10_STATUS).toMatchObject({
      r10AcceptanceStatus: "ACCEPTED",
      r10AdvisoryEvaluationEvidenceCompletenessImplemented: true,
      introducesCapabilities: ["advisoryEvaluationEvidenceCompleteness"],
      closesReadinessNodes: ["S10"],
      s01Status: "SOURCE_READY",
      s09Status: "SOURCE_READY",
      s10ImplementationStatus: "SOURCE_READY",
      s10AcceptedReady: true,
      observationAuthorized: false,
      observationExecuted: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      automaticTrading: false,
      productionUnchanged: true,
    });
    expect(R22_R10_FINAL_DECISION).toEqual({
      decision: "ROUND-022 R10 ACCEPTANCE CLOSURE — ACCEPTED",
      nextStage: "STOP_PENDING_R10_CLOSURE_ACCEPTANCE",
    });
    expect(R22_R10_EVIDENCE_COMPLETENESS_CONTRACT.readOnly).toBe(true);
  });

  it("contains no write, network acquisition, performance, or selection path", () => {
    const source = readFileSync("src/lib/advisory-evaluation/evidence-completeness.ts", "utf8");
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(|fetch\(|backtest|performance|selection/i);
    for (const candidate of evidenceSet().candidates) {
      expect(validateObservationEvidenceCandidate(candidate).status).toBe("VALID");
    }
  });
});
