import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "@/lib/config/constants";
import { materializeHistoricalReviewContext } from "@/lib/historical-review-context/registry";
import { buildHistoricalReviewMetadataSnapshotCandidate } from "@/lib/observation-evidence/historical-review-metadata";
import {
  AlertIntelligenceNotEvaluableError,
  buildAlertIntelligenceSnapshotCandidate,
  R22_R6_ALERT_INTELLIGENCE_PRODUCER_IMPLEMENTATION_STATUS,
} from "@/lib/observation-evidence/alert-intelligence";
import { buildMarketContextSnapshotCandidate } from "@/lib/observation-evidence/market-context";
import { buildQualitySnapshotCandidate } from "@/lib/observation-evidence/quality-snapshot";
import { buildRiskAdvisorySnapshotCandidate } from "@/lib/observation-evidence/risk-advisory";
import { findForbiddenObservationEconomicField, validateObservationEvidenceCandidate } from "@/lib/observation-evidence/validator";
import { buildDeterministicSignalId } from "@/lib/signal-advisory/identity";
import type { SignalAdvisory } from "@/lib/signal-advisory/types";
import type { Candle, MarketSnapshot } from "@/lib/market-data/types";

const FOUR_HOUR_MS = 14_400_000;
const SIGNAL_TIME = "2026-08-23T00:00:00.000Z";
const CAPTURED_AT = "2026-08-23T00:00:02.000Z";
const PRIOR_SIGNAL_TIME = "2026-08-22T20:00:00.000Z";

function advisory(overrides: Partial<SignalAdvisory> = {}): SignalAdvisory {
  const signalTime = overrides.signalTime ?? SIGNAL_TIME;
  const direction = overrides.direction ?? "LONG";
  const symbol = overrides.symbol ?? "BTCUSDT";
  return {
    signalId: buildDeterministicSignalId({ symbol, direction, signalTime, strategyVersion: STRATEGY_VERSION }),
    symbol,
    direction,
    strategyId: "baseline-001",
    strategyVersion: STRATEGY_VERSION,
    signalTime,
    signalValidUntil: new Date(Date.parse(signalTime) + 3_600_000).toISOString(),
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

function makeCandle(symbol: ResearchSymbol, closeTime: number, index: number): Candle {
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
    makeCandle(symbol, lastCloseTime - (2 - index) * FOUR_HOUR_MS, index),
  );
}

function snapshot(): MarketSnapshot {
  const serverTime = Date.parse(SIGNAL_TIME) + 3_600_000;
  const symbols = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => {
    const candles4h = series(symbol);
    const candle1h: Candle = {
      ...makeCandle(symbol, Date.parse(SIGNAL_TIME) - 1, 0),
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

function priorContext(current: SignalAdvisory) {
  return materializeHistoricalReviewContext({
    advisory: advisory({
      symbol: current.symbol,
      direction: current.direction,
      signalTime: PRIOR_SIGNAL_TIME,
    }),
    sourceIds: [`tp_signal_advisories:${current.signalId}`],
    availableAt: "2026-08-22T23:30:00.000Z",
  });
}

function candidates(current = advisory(), capturedAt = CAPTURED_AT) {
  const qualityEvidence = buildQualitySnapshotCandidate({ advisory: current, capturedAt });
  const marketContextEvidence = buildMarketContextSnapshotCandidate({
    advisory: current,
    snapshot: snapshot(),
    capturedAt,
  });
  const riskAdvisoryEvidence = buildRiskAdvisorySnapshotCandidate({ advisory: current, capturedAt });
  const historicalReviewEvidence = buildHistoricalReviewMetadataSnapshotCandidate({
    advisory: current,
    priorContext: priorContext(current),
    capturedAt,
  });
  return { qualityEvidence, marketContextEvidence, riskAdvisoryEvidence, historicalReviewEvidence };
}

function build(overrides: Partial<SignalAdvisory> = {}, capturedAt = CAPTURED_AT) {
  const current = advisory(overrides);
  return {
    current,
    ...candidates(current, capturedAt),
    candidate: buildAlertIntelligenceSnapshotCandidate({
      advisory: current,
      ...candidates(current, capturedAt),
      capturedAt,
    }),
  };
}

describe("Round-022 R6 ALERT_INTELLIGENCE producer", () => {
  it("builds a valid LONG and SHORT snapshot from the four persisted candidates", () => {
    for (const direction of ["LONG", "SHORT"] as const) {
      const { candidate } = build({ direction });
      expect(candidate.artifactType).toBe("ALERT_INTELLIGENCE");
      expect(validateObservationEvidenceCandidate(candidate)).toMatchObject({ status: "VALID", reason: "NONE" });
      expect(findForbiddenObservationEconomicField(candidate.payload)).toBeNull();
      expect(candidate.payload).toMatchObject({
        humanDecisionRequired: true,
        automaticTrading: false,
        alertIntelligence: { direction, priority: expect.stringMatching(/^P[12]$/) },
      });
    }
  });

  it.each([
    ["quality", "qualityEvidence"],
    ["market context", "marketContextEvidence"],
    ["risk advisory", "riskAdvisoryEvidence"],
    ["historical review", "historicalReviewEvidence"],
  ] as const)("builds a degraded P3 presentation when %s evidence is legitimately missing", (_label, key) => {
    const prepared = build();
    const candidate = buildAlertIntelligenceSnapshotCandidate({
      advisory: prepared.current,
      qualityEvidence: key === "qualityEvidence" ? null : prepared.qualityEvidence,
      marketContextEvidence: key === "marketContextEvidence" ? null : prepared.marketContextEvidence,
      riskAdvisoryEvidence: key === "riskAdvisoryEvidence" ? null : prepared.riskAdvisoryEvidence,
      historicalReviewEvidence: key === "historicalReviewEvidence" ? null : prepared.historicalReviewEvidence,
      capturedAt: CAPTURED_AT,
    });
    expect(candidate.payload).toMatchObject({
      alertIntelligence: {
        presentationStatus: key === "historicalReviewEvidence" ? "PRESENTABLE" : "DEGRADED",
        priority: key === "historicalReviewEvidence" ? "P2" : "P3",
        notificationImportance: key === "historicalReviewEvidence" ? "NORMAL" : "LOW",
      },
    });
    if (key === "historicalReviewEvidence") {
      expect(candidate.payload).toMatchObject({
        alertIntelligence: {
          historicalContext: "Historical review context is unavailable; no outcome is inferred.",
          humanReviewNotes: ["HISTORICAL_REVIEW_METADATA_MISSING"],
        },
        sourceAdapters: {
          historicalReview: {
            status: "MISSING",
            reviewStatus: "UNAVAILABLE",
            contextSummary: null,
          },
        },
      });
      expect(JSON.stringify(candidate.payload)).not.toMatch(/pnl|profit|forward_return|realized/i);
    }
  });

  it.each([
    ["signalId", { signalId: "different-signal" }],
    ["symbol", { symbol: "ETHUSDT" as const }],
    ["direction", { direction: "SHORT" as const }],
    ["signalTime", { signalTime: "2026-08-23T01:00:00.000Z" }],
  ] as const)("rejects exact upstream identity mismatch for %s", (_label, override) => {
    const prepared = build();
    const mismatchBase = advisory(override);
    const mismatch = !("signalTime" in override)
      ? mismatchBase
      : advisory({
          ...override,
          dataFreshness: {
            ...mismatchBase.dataFreshness,
            sourceServerTime: "2026-08-23T02:00:01.000Z",
            candleCloseTime: mismatchBase.signalTime,
          },
        });
    const mismatchCandidates = candidates(mismatch, "2026-08-23T02:00:02.000Z");
    expect(() => buildAlertIntelligenceSnapshotCandidate({
      advisory: prepared.current,
      qualityEvidence: mismatchCandidates.qualityEvidence,
      marketContextEvidence: prepared.marketContextEvidence,
      riskAdvisoryEvidence: prepared.riskAdvisoryEvidence,
      historicalReviewEvidence: prepared.historicalReviewEvidence,
      capturedAt: "2026-08-23T02:00:02.000Z",
    })).toThrow("UPSTREAM_IDENTITY_MISMATCH");
  });

  it("uses the maximum upstream informationAsOf and rejects a future cutoff", () => {
    const prepared = build();
    const future = { ...prepared.marketContextEvidence, informationAsOf: "2026-08-23T00:00:00.001Z" };
    expect(() => buildAlertIntelligenceSnapshotCandidate({
      advisory: prepared.current,
      qualityEvidence: prepared.qualityEvidence,
      marketContextEvidence: future,
      riskAdvisoryEvidence: prepared.riskAdvisoryEvidence,
      historicalReviewEvidence: prepared.historicalReviewEvidence,
      capturedAt: CAPTURED_AT,
    })).toThrow("UPSTREAM_EVIDENCE_INVALID");
  });

  it("rejects an existing upstream candidate with an invalid artifact type", () => {
    const prepared = build();
    const invalid = {
      ...prepared.marketContextEvidence,
      artifactType: "QUALITY_SNAPSHOT" as const,
    };
    expect(() => buildAlertIntelligenceSnapshotCandidate({
      advisory: prepared.current,
      qualityEvidence: prepared.qualityEvidence,
      marketContextEvidence: invalid,
      riskAdvisoryEvidence: prepared.riskAdvisoryEvidence,
      historicalReviewEvidence: prepared.historicalReviewEvidence,
      capturedAt: CAPTURED_AT,
    })).toThrow("UPSTREAM_EVIDENCE_INVALID");
  });

  it("keeps logical linkage stable when only physical capture time changes", () => {
    const first = build({}, "2026-08-23T00:00:02.000Z").candidate;
    const second = build({}, "2026-08-23T00:00:03.000Z").candidate;
    expect(second.sourceRef).toBe(first.sourceRef);
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.evidenceHash).not.toBe(first.evidenceHash);
    expect(second.evidenceId).not.toBe(first.evidenceId);
  });

  it("changes logical linkage when an upstream logical payload changes", () => {
    const first = build().candidate;
    const second = build({ stopLoss: 97, riskReward: 4 / 3 }).candidate;
    expect(second.sourceRef).not.toBe(first.sourceRef);
    expect(second.contentHash).not.toBe(first.contentHash);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it("maps BTC regime from persisted market context and uses a null trigger explanation", () => {
    const candidate = build({ marketRegime: { btcRegime: "BTC_STRONG_BULL", symbolRegime: "SHORT_ONLY" } }).candidate;
    expect(candidate.payload).toMatchObject({
      signal: { triggerExplanation: null },
      alertIntelligence: {
        direction: "LONG",
        explanation: { whyTriggered: "Trigger explanation is unavailable; manual review is required." },
        humanDecisionRequired: true,
        automaticTrading: false,
      },
    });
    expect(JSON.stringify(candidate.payload)).toContain('"regime":"BULL"');
    expect(JSON.stringify(candidate.payload)).not.toMatch(/pnl|profit|forward_return|futurePrice|realized|positionSize|leverage|order/i);
  });

  it("freezes R6 readiness and governance without authorizing observation or economics", () => {
    expect(R22_R6_ALERT_INTELLIGENCE_PRODUCER_IMPLEMENTATION_STATUS).toMatchObject({
      r6AlertIntelligenceProducerImplemented: true,
      r6AcceptanceStatus: "ACCEPTED",
      closesReadinessNodes: ["S05"],
      dependsOn: ["R2", "R3", "R4", "R5"],
      s01Status: "SOURCE_READY",
      s02Status: "SOURCE_READY",
      s03Status: "SOURCE_READY",
      s04Status: "SOURCE_READY",
      s04AcceptedReady: true,
      s05ImplementationStatus: "SOURCE_READY",
      s05AcceptedReady: true,
      s06Status: "FAIL",
      s10Status: "FAIL",
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      observationExecuted: false,
      economicValuesRead: false,
      newMarketDataFetched: false,
      automaticTrading: false,
    });
  });

  it("does not expose caller-controlled priority or notification fields in the builder input", () => {
    const candidate = build().candidate;
    const manifest = (candidate.payload as Record<string, unknown>).inputManifest;
    expect(manifest).toHaveLength(4);
    expect(JSON.stringify(candidate.payload)).not.toContain("evidenceId");
    expect(JSON.stringify(candidate.payload)).not.toContain("evidenceHash");
    expect(JSON.stringify(candidate.payload)).not.toContain("capturedAt");
  });

  it("uses the R1 logical identity fields rather than physical evidence identity", () => {
    const candidate = build().candidate;
    const manifest = (candidate.payload as Record<string, unknown>).inputManifest as Array<Record<string, unknown>>;
    for (const input of manifest) {
      expect(Object.keys(input).sort()).toEqual([
        "artifactId",
        "artifactType",
        "contentHash",
        "idempotencyKey",
        "informationAsOf",
        "schemaVersion",
      ]);
      expect(input.artifactId).toBeTruthy();
      expect(input.contentHash).toBeTruthy();
      expect(input.idempotencyKey).toBeTruthy();
    }
  });

  it("fails closed for capture before the signal", () => {
    const prepared = build();
    const input = {
      advisory: prepared.current,
      ...prepared,
      capturedAt: "2026-08-22T23:59:59.999Z",
    };
    expect(() => buildAlertIntelligenceSnapshotCandidate(input)).toThrow(
      AlertIntelligenceNotEvaluableError,
    );
    expect(() => buildAlertIntelligenceSnapshotCandidate(input)).toThrow("CAPTURE_BEFORE_SIGNAL");
  });
});
