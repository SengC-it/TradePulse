import { describe, expect, it } from "vitest";

import { STRATEGY_VERSION } from "@/lib/config/constants";
import {
  buildR22AlertIntelligence,
  type R22AlertIntelligenceResult,
} from "@/lib/research/alert-intelligence-protocol";
import {
  AlertIntelligenceNotEvaluableError,
  buildAlertIntelligenceSnapshotCandidate,
} from "@/lib/observation-evidence/alert-intelligence";
import {
  buildPresentationSnapshotCandidate,
  PresentationNotEvaluableError,
  R22_R7_PRESENTATION_EVIDENCE_BOUNDARY_IMPLEMENTATION_STATUS,
} from "@/lib/observation-evidence/presentation";
import { findForbiddenObservationEconomicField, validateObservationEvidenceCandidate } from "@/lib/observation-evidence/validator";
import {
  calculateObservationSnapshotContentHash,
  calculateObservationSnapshotEvidenceHash,
  calculateObservationSnapshotIdempotencyKey,
  R22_OBSERVATION_TIMESTAMP_AUTHORITY,
} from "@/lib/observation-evidence/snapshot";
import type { ObservationEvidenceCandidate, ObservationJsonValue } from "@/lib/observation-evidence/types";
import { buildSignalAdvisoryEmailPayload } from "@/lib/signal-advisory/email";
import { buildDeterministicSignalId } from "@/lib/signal-advisory/identity";
import type { SignalAdvisory } from "@/lib/signal-advisory/types";
import {
  appendDashboardWebPresentationEvidence,
  buildDashboardWebPresentationPayload,
} from "@/lib/dashboard/presentation";
import type { DashboardAdvisory } from "@/lib/dashboard/types";

const SIGNAL_TIME = "2026-08-23T00:00:00.000Z";
const CAPTURED_AT = "2026-08-23T00:00:02.000Z";

function advisory(direction: "LONG" | "SHORT" = "LONG"): SignalAdvisory {
  return {
    signalId: buildDeterministicSignalId({
      symbol: "BTCUSDT",
      direction,
      signalTime: SIGNAL_TIME,
      strategyVersion: STRATEGY_VERSION,
    }),
    symbol: "BTCUSDT",
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
    scanRunKey: "hourly-1h:2026-08-23T00:05:00.000Z",
  };
}

function r6Candidate(current: SignalAdvisory, capturedAt = CAPTURED_AT) {
  return buildAlertIntelligenceSnapshotCandidate({
    advisory: current,
    qualityEvidence: null,
    marketContextEvidence: null,
    riskAdvisoryEvidence: null,
    historicalReviewEvidence: null,
    capturedAt,
  });
}

function presentation(current: SignalAdvisory, capturedAt = CAPTURED_AT) {
  const alertIntelligenceEvidence = r6Candidate(current, capturedAt);
  const renderedEmail = buildSignalAdvisoryEmailPayload(current);
  return {
    alertIntelligenceEvidence,
    renderedEmail,
    candidate: buildPresentationSnapshotCandidate({
      advisory: current,
      alertIntelligenceEvidence,
      presentationChannel: "EMAIL",
      presentationPayload: renderedEmail,
      capturedAt,
    }),
  };
}

function dashboardAdvisory(current: SignalAdvisory): DashboardAdvisory {
  return {
    signalId: current.signalId,
    symbol: current.symbol,
    direction: current.direction,
    strategyVersion: current.strategyVersion,
    signalTime: current.signalTime,
    signalValidUntil: current.signalValidUntil,
    score: current.score,
    grade: current.grade,
    currentReferencePrice: current.currentReferencePrice,
    suggestedEntryReference: current.suggestedEntryReference,
    stopLoss: current.stopLoss,
    takeProfit: current.takeProfit,
    riskReward: current.riskReward,
    deliveryStatus: "SENT",
    sentAt: "2026-08-23T00:00:05.000Z",
    dataFreshness: current.dataFreshness,
  };
}

function rekeyAlertIntelligence(
  candidate: ObservationEvidenceCandidate,
  alertIntelligence: R22AlertIntelligenceResult,
): ObservationEvidenceCandidate {
  const payload = {
    ...(candidate.payload as Record<string, ObservationJsonValue>),
    alertIntelligence,
  } as ObservationJsonValue;
  const advisoryIdentity = {
    signalId: candidate.signalId,
    symbol: candidate.symbol,
    direction: candidate.direction,
    signalTime: candidate.signalTime,
    strategyId: candidate.strategyId,
    strategyVersion: candidate.strategyVersion,
  } as const;
  const contentHash = calculateObservationSnapshotContentHash({
    schemaVersion: candidate.schemaVersion,
    artifactType: candidate.artifactType!,
    advisoryIdentity,
    informationAsOf: candidate.informationAsOf!,
    sourceRef: candidate.sourceRef,
    payload,
  });
  const evidenceHash = calculateObservationSnapshotEvidenceHash({
    contentHash,
    capturedAt: candidate.capturedAt,
    timestampAuthority: R22_OBSERVATION_TIMESTAMP_AUTHORITY,
    artifactId: candidate.artifactId!,
  });
  return {
    ...candidate,
    payload,
    contentHash,
    evidenceHash,
    idempotencyKey: calculateObservationSnapshotIdempotencyKey({
      signalId: candidate.signalId,
      artifactType: candidate.artifactType!,
      schemaVersion: candidate.schemaVersion,
      informationAsOf: candidate.informationAsOf!,
      contentHash,
    }),
  };
}

function classifiedR6(current: SignalAdvisory, priority: "P1" | "P2") {
  const result = buildR22AlertIntelligence({
    signal: {
      direction: current.direction,
      identity: {
        signalId: current.signalId,
        symbol: current.symbol,
        direction: current.direction,
        signalTime: current.signalTime,
        strategyId: current.strategyId,
        strategyVersion: current.strategyVersion,
      },
      triggerExplanation: null,
    },
    quality: { status: "AVAILABLE", grade: "A", score: 85, explanations: ["quality"] },
    marketContext: {
      status: "AVAILABLE",
      regime: "NEUTRAL",
      alignment: priority === "P1" ? "SUPPORTIVE" : "NEUTRAL",
      explanation: "context",
    },
    riskAdvisory: {
      status: "AVAILABLE",
      level: priority === "P1" ? "STANDARD" : "CAUTION",
      explanation: "risk",
    },
    historicalReview: { status: "MISSING", reviewStatus: "UNAVAILABLE", contextSummary: null },
  });
  return result;
}

describe("Round-022 R7 PRESENTATION evidence boundary", () => {
  it.each(["LONG", "SHORT"] as const)("builds a valid %s presentation candidate", (direction) => {
    const current = advisory(direction);
    const result = presentation(current);

    expect(result.candidate.artifactType).toBe("PRESENTATION");
    expect(validateObservationEvidenceCandidate(result.candidate)).toMatchObject({
      status: "VALID",
      reason: "NONE",
    });
    expect(result.candidate.payload).toMatchObject({
      presentation: { channel: "EMAIL", payload: result.renderedEmail },
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it("preserves the complete R6 alert-intelligence payload without recomputing its priority", () => {
    const current = advisory();
    const result = presentation(current);
    const r6Payload = result.alertIntelligenceEvidence.payload as Record<string, unknown>;
    const r7Payload = result.candidate.payload as Record<string, unknown>;

    expect(r7Payload.alertIntelligence).toEqual(r6Payload.alertIntelligence);
    expect(JSON.stringify(result.candidate.payload)).not.toMatch(
      /profit|loss|return|pnl|forward|futureprice|realized/i,
    );
  });

  it.each(["P1", "P2"] as const)("preserves an upstream %s classification", (priority) => {
    const current = advisory();
    const base = r6Candidate(current);
    const upstream = rekeyAlertIntelligence(base, classifiedR6(current, priority));
    const renderedEmail = buildSignalAdvisoryEmailPayload(current);
    const result = buildPresentationSnapshotCandidate({
      advisory: current,
      alertIntelligenceEvidence: upstream,
      presentationChannel: "EMAIL",
      presentationPayload: renderedEmail,
      capturedAt: CAPTURED_AT,
    });

    expect((result.payload as Record<string, unknown>).alertIntelligence).toEqual(
      (upstream.payload as Record<string, unknown>).alertIntelligence,
    );
  });

  it("keeps legal missing historical context and degraded P3 context from R6", () => {
    const result = presentation(advisory());
    const alertIntelligence = (result.candidate.payload as Record<string, unknown>).alertIntelligence;
    expect(alertIntelligence).toMatchObject({
      priority: "P3",
      presentationStatus: "DEGRADED",
      historicalContext: "Historical review context is unavailable; no outcome is inferred.",
    });
  });

  it("rejects an absent, malformed, mismatched, or future R6 artifact", () => {
    const current = advisory();
    const renderedEmail = buildSignalAdvisoryEmailPayload(current);
    const valid = r6Candidate(current);
    const cases = [
      { ...valid, artifactType: "QUALITY_SNAPSHOT" as const },
      { ...valid, payload: null },
      { ...valid, signalId: "different-signal" },
      { ...valid, informationAsOf: "2026-08-23T00:00:00.001Z" },
    ];

    for (const invalid of cases) {
      expect(() => buildPresentationSnapshotCandidate({
        advisory: current,
        alertIntelligenceEvidence: invalid,
        presentationChannel: "EMAIL",
        presentationPayload: renderedEmail,
        capturedAt: CAPTURED_AT,
      })).toThrow(PresentationNotEvaluableError);
    }
    expect(() => buildPresentationSnapshotCandidate({
      advisory: current,
      alertIntelligenceEvidence: valid,
      presentationChannel: "EMAIL",
      presentationPayload: renderedEmail,
      capturedAt: "2026-08-22T23:59:59.999Z",
    })).toThrow("CAPTURE_BEFORE_SIGNAL");
    expect(AlertIntelligenceNotEvaluableError).toBeDefined();
  });

  it("uses the exact renderer payload as the immutable presentation boundary", () => {
    const current = advisory();
    const result = presentation(current);
    const payload = result.candidate.payload as {
      presentation: { payload: unknown };
    };

    expect(payload.presentation.payload).toEqual(buildSignalAdvisoryEmailPayload(current));
    expect(findForbiddenObservationEconomicField(result.candidate.payload)).toBeNull();
  });

  it("captures the exact WEB payload before dashboard serialization", () => {
    const current = advisory();
    const dashboard = dashboardAdvisory(current);
    const webPayload = buildDashboardWebPresentationPayload(dashboard);
    const result = buildPresentationSnapshotCandidate({
      advisory: current,
      alertIntelligenceEvidence: r6Candidate(current),
      presentationChannel: "WEB",
      presentationPayload: webPayload,
      capturedAt: CAPTURED_AT,
    });

    expect(result.payload).toMatchObject({ presentation: { channel: "WEB", payload: webPayload } });
    expect(dashboard.deliveryStatus).toBe("SENT");
    expect(dashboard.sentAt).toBe("2026-08-23T00:00:05.000Z");
    expect(webPayload).not.toHaveProperty("notificationState");
    expect((webPayload as Record<string, unknown>).signal).not.toHaveProperty("dataFreshness");
    expect(JSON.stringify(webPayload)).not.toContain("deliveryStatus");
    expect(JSON.stringify(webPayload)).not.toContain("sentAt");
    expect(JSON.stringify(webPayload)).not.toContain("POST_SIGNAL_NOTIFICATION_STATE_NOT_R22_DECISION_TIME");
    expect(JSON.stringify(webPayload)).not.toContain("observedAt");
    expect(JSON.stringify(webPayload)).not.toContain("attemptSequence");
    expect(JSON.stringify(webPayload)).not.toContain("DELIVERED");
    expect(JSON.stringify(webPayload)).not.toContain("RETRY");
    expect((webPayload as Record<string, unknown>).signal).toMatchObject({ signalTime: SIGNAL_TIME });
    expect(Date.parse(SIGNAL_TIME)).toBeLessThanOrEqual(Date.parse(CAPTURED_AT));
  });

  it("keeps post-signal dashboard state out of the R7 evidence content", () => {
    const current = advisory();
    const dashboard = dashboardAdvisory(current);
    const webPayload = buildDashboardWebPresentationPayload(dashboard) as Record<string, unknown>;

    expect(dashboard.dataFreshness?.sourceServerTime).toBe("2026-08-23T00:00:05.000Z");
    expect(dashboard.dataFreshness?.ageMs).toBe(5_000);
    expect(webPayload).toEqual({
      signal: expect.objectContaining({
        signalId: current.signalId,
        signalTime: SIGNAL_TIME,
      }),
    });
    expect(webPayload).not.toHaveProperty("deliveryStatus");
    expect(webPayload).not.toHaveProperty("sentAt");
    expect(webPayload).not.toHaveProperty("dataFreshness");
  });

  it("uses distinct, retry-idempotent EMAIL and WEB logical identities", () => {
    const current = advisory();
    const alertIntelligenceEvidence = r6Candidate(current);
    const email = buildPresentationSnapshotCandidate({
      advisory: current,
      alertIntelligenceEvidence,
      presentationChannel: "EMAIL",
      presentationPayload: buildSignalAdvisoryEmailPayload(current),
      capturedAt: CAPTURED_AT,
    });
    const web = buildPresentationSnapshotCandidate({
      advisory: current,
      alertIntelligenceEvidence,
      presentationChannel: "WEB",
      presentationPayload: buildDashboardWebPresentationPayload(dashboardAdvisory(current)),
      capturedAt: CAPTURED_AT,
    });
    const webRetry = buildPresentationSnapshotCandidate({
      advisory: current,
      alertIntelligenceEvidence,
      presentationChannel: "WEB",
      presentationPayload: buildDashboardWebPresentationPayload(dashboardAdvisory(current)),
      capturedAt: "2026-08-23T00:00:03.000Z",
    });

    expect(web.artifactId).not.toBe(email.artifactId);
    expect(web.idempotencyKey).not.toBe(email.idempotencyKey);
    expect(webRetry.contentHash).toBe(web.contentHash);
    expect(webRetry.idempotencyKey).toBe(web.idempotencyKey);
    expect(webRetry.evidenceHash).not.toBe(web.evidenceHash);
  });

  it("never reports APPENDED when the R6 artifact is absent", async () => {
    let appendCalls = 0;
    const result = await appendDashboardWebPresentationEvidence({
      advisory: dashboardAdvisory(advisory()),
      alertIntelligenceEvidence: null,
      appender: {
        appendEvidence: async () => {
          appendCalls += 1;
          return { status: "APPENDED", evidenceId: "unexpected" };
        },
      },
      capturedAt: CAPTURED_AT,
    });

    expect(result.status).toBe("NOT_EVALUABLE");
    expect(appendCalls).toBe(0);
  });

  it("keeps logical identity stable across truthful physical capture times", () => {
    const current = advisory();
    const first = presentation(current, "2026-08-23T00:00:02.000Z").candidate;
    const second = presentation(current, "2026-08-23T00:00:03.000Z").candidate;

    expect(second.contentHash).toBe(first.contentHash);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.evidenceHash).not.toBe(first.evidenceHash);
    expect(second.evidenceId).not.toBe(first.evidenceId);
  });

  it("freezes R7 readiness and governance without authorizing observation or economics", () => {
    expect(R22_R7_PRESENTATION_EVIDENCE_BOUNDARY_IMPLEMENTATION_STATUS).toMatchObject({
      r7PresentationEvidenceBoundaryImplemented: true,
      closesReadinessNodes: ["S06"],
      s06Status: "SOURCE_READY_PENDING_ACCEPTANCE",
      s06AcceptedReady: false,
      s07Status: "FAIL",
      s10Status: "FAIL",
      observationExecuted: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      newMarketDataFetched: false,
      automaticTrading: false,
      productionUnchanged: true,
    });
  });
});
