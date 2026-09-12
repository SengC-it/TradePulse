import { describe, expect, it } from "vitest";

import { STRATEGY_VERSION } from "@/lib/config/constants";
import {
  findForbiddenObservationEconomicField,
  validateObservationEvidenceCandidate,
} from "@/lib/observation-evidence";
import {
  buildNotificationObservationCandidate,
  NotificationObservationNotEvaluableError,
} from "@/lib/observation-evidence/notification";
import {
  buildClaimDecisionEvidence,
  buildDeliveredEvidence,
  buildDeliveryAttemptedEvidence,
  buildDeliveryFailedEvidence,
  buildDeliveryRegistryPersistenceFailureEvidence,
  buildNotificationDecisionMetadata,
  type NotificationEvidenceEvent,
} from "@/lib/signal-advisory/notification-evidence";
import type { SignalAdvisory, SignalClaimResult } from "@/lib/signal-advisory/types";
import {
  R22_R8_NOTIFICATION_CAUSAL_INTEGRATION_CONTRACT,
  R22_R8_NOTIFICATION_CAUSAL_INTEGRATION_FINAL_DECISION,
  R22_R8_NOTIFICATION_CAUSAL_INTEGRATION_IMPLEMENTATION_STATUS,
} from "@/lib/research/round-022-r8-notification-causal-integration-protocol";

const SIGNAL_TIME = "2026-08-23T00:00:00.000Z";
const AFTER_SIGNAL = "2026-08-23T00:00:01.000Z";
const LATER_CAPTURE = "2026-08-23T00:00:02.000Z";

function advisory(): SignalAdvisory {
  return {
    signalId: "signal-r8-btc-long",
    symbol: "BTCUSDT",
    direction: "LONG",
    strategyId: "baseline-001",
    strategyVersion: STRATEGY_VERSION,
    signalTime: SIGNAL_TIME,
    signalValidUntil: "2026-08-23T01:00:00.000Z",
    currentReferencePrice: 100,
    suggestedEntryReference: 100,
    stopLoss: 98,
    takeProfit: 104,
    riskReward: 2,
    score: 85,
    grade: "A",
    marketRegime: { btcRegime: "BTC_NEUTRAL", symbolRegime: "LONG_ONLY" },
    dataFreshness: {
      status: "FRESH",
      sourceServerTime: AFTER_SIGNAL,
      candleCloseTime: SIGNAL_TIME,
      ageMs: 1_000,
    },
    recipient: "owner@example.test",
    scanRunKey: "hourly-1h:2026-08-23T00:00:00.000Z",
  };
}

function metadata(decisionType: SignalClaimResult) {
  return buildNotificationDecisionMetadata({
    scanId: "scan-r8-1",
    signalId: advisory().signalId,
    decisionType,
  });
}

function claimEvents(): NotificationEvidenceEvent[] {
  return (["CLAIMED", "RETRY_CLAIMED", "SKIPPED_DUPLICATE", "SKIPPED_EXPIRED"] as const)
    .map((decisionType) => buildClaimDecisionEvidence({
      ...metadata(decisionType),
      signalId: advisory().signalId,
    }));
}

function deliveryEvents(): NotificationEvidenceEvent[] {
  const claimed = metadata("CLAIMED");
  return [
    buildDeliveryAttemptedEvidence(claimed),
    buildDeliveredEvidence(claimed),
    buildDeliveryFailedEvidence(claimed, "SMTP_AUTH_FAILED"),
    buildDeliveryRegistryPersistenceFailureEvidence(claimed),
  ];
}

function candidateFor(event: NotificationEvidenceEvent, observedAt = AFTER_SIGNAL, capturedAt = LATER_CAPTURE) {
  return buildNotificationObservationCandidate({
    advisory: advisory(),
    event,
    observedAt,
    capturedAt,
  });
}

describe("Round-022 R8 notification causal integration", () => {
  it("builds valid NOTIFICATION candidates for every accepted O05 event type", () => {
    const events = [...claimEvents(), ...deliveryEvents()];
    const candidates = events.map((event) => candidateFor(event));

    expect(candidates).toHaveLength(8);
    expect(new Set(events.slice(0, 4).map((event) => (
      event.metadata.decisionType === "SKIPPED_DUPLICATE"
        ? "SKIPPED_DUPLICATE"
        : event.metadata.decisionType === "SKIPPED_EXPIRED"
          ? "SKIPPED_EXPIRED"
          : event.metadata.decisionType
    )))).toEqual(new Set(["CLAIMED", "RETRY_CLAIMED", "SKIPPED_DUPLICATE", "SKIPPED_EXPIRED"]));
    expect(new Set(events.slice(4).map((event) => event.type))).toEqual(new Set([
      "DELIVERY_ATTEMPTED",
      "DELIVERED",
      "DELIVERY_FAILED",
      "DELIVERY_REGISTRY_PERSISTENCE_FAILED",
    ]));
    expect(new Set(candidates.map((candidate) => (
      candidate.payload as { notification: { eventType: string } }
    ).notification.eventType))).toEqual(new Set([
      "CLAIM_DECISION",
      "DELIVERY_ATTEMPTED",
      "DELIVERED",
      "DELIVERY_FAILED",
      "DELIVERY_REGISTRY_PERSISTENCE_FAILED",
    ]));
    for (const candidate of candidates) {
      expect(candidate.eventKind).toBe("NOTIFICATION");
      expect(candidate.artifactId).toBeNull();
      expect(candidate.artifactType).toBeNull();
      expect(candidate.informationAsOf).toBeNull();
      expect(candidate.observedAt).not.toBeNull();
      expect(validateObservationEvidenceCandidate(candidate)).toMatchObject({ status: "VALID" });
    }
  });

  it("enforces signalTime <= notificationObservedAt and signalTime <= capturedAt", () => {
    const event = buildDeliveryAttemptedEvidence(metadata("CLAIMED"));

    expect(() => candidateFor(event, "2026-08-22T23:59:59.999Z", AFTER_SIGNAL))
      .toThrowError(NotificationObservationNotEvaluableError);
    expect(() => candidateFor(event, AFTER_SIGNAL, "2026-08-22T23:59:59.999Z"))
      .toThrowError(NotificationObservationNotEvaluableError);
    expect(() => candidateFor(event, "2026-08-23T00:00:00.000Z", AFTER_SIGNAL))
      .not.toThrow();
  });

  it("rejects cross-source identity mismatch", () => {
    const mismatched = buildDeliveryAttemptedEvidence(buildNotificationDecisionMetadata({
      scanId: "scan-r8-1",
      signalId: "different-signal",
      decisionType: "CLAIMED",
    }));

    expect(() => candidateFor(mismatched)).toThrowError(NotificationObservationNotEvaluableError);
  });

  it("keeps retry identity independent of truthful observed and captured times", () => {
    const event = buildDeliveryAttemptedEvidence(metadata("CLAIMED"));
    const first = candidateFor(event, AFTER_SIGNAL, LATER_CAPTURE);
    const second = candidateFor(
      event,
      "2026-08-23T00:05:00.000Z",
      "2026-08-23T00:05:01.000Z",
    );

    expect(second.notificationObservationId).toBe(first.notificationObservationId);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.evidenceId).toBe(first.evidenceId);
    expect(second.observedAt).not.toBe(first.observedAt);
    expect(second.capturedAt).not.toBe(first.capturedAt);
  });

  it("separates event namespaces and preserves terminal conflict identity", () => {
    const claimed = metadata("CLAIMED");
    const delivered = candidateFor(buildDeliveredEvidence(claimed));
    const registryFailure = candidateFor(buildDeliveryRegistryPersistenceFailureEvidence(claimed));
    const authFailure = candidateFor(buildDeliveryFailedEvidence(claimed, "SMTP_AUTH_FAILED"));
    const deliveryFailure = candidateFor(buildDeliveryFailedEvidence(claimed, "SMTP_DELIVERY_FAILED"));

    expect(delivered.notificationObservationId).not.toBe(registryFailure.notificationObservationId);
    expect(authFailure.notificationObservationId).toBe(deliveryFailure.notificationObservationId);
    expect(authFailure.idempotencyKey).not.toBe(deliveryFailure.idempotencyKey);
    expect(authFailure.evidenceId).not.toBe(deliveryFailure.evidenceId);
  });

  it("does not change the accepted O05 identity primitives", () => {
    const claimed = metadata("CLAIMED");
    const delivered = buildDeliveredEvidence(claimed);
    const candidate = candidateFor(delivered);

    expect(candidate.payload).toMatchObject({
      notification: {
        notificationDecisionId: claimed.notificationDecisionId,
        attemptSequence: 1,
        attemptSequenceSource: claimed.attemptSequenceSource,
        terminalEventId: delivered.terminalEvent.terminalEventId,
      },
    });
    expect(delivered.terminalEvent.terminalEventId).toBe(
      buildDeliveredEvidence(claimed).terminalEvent.terminalEventId,
    );
    expect(claimed.notificationDecisionId).toBe(
      metadata("CLAIMED").notificationDecisionId,
    );
  });

  it("contains no economic fields and preserves the signal-advisory boundary", () => {
    for (const candidate of [...claimEvents(), ...deliveryEvents()].map((event) => candidateFor(event))) {
      expect(findForbiddenObservationEconomicField(candidate.payload)).toBeNull();
      expect(JSON.stringify(candidate.payload)).not.toMatch(/pnl|profit|forward_return|futureprice|realized_pnl/i);
      expect(candidate.payload).toMatchObject({
        humanDecisionRequired: true,
        automaticTrading: false,
      });
    }
  });

  it("freezes R8 status, governance, and readiness ownership", () => {
    expect(R22_R8_NOTIFICATION_CAUSAL_INTEGRATION_CONTRACT.notificationCausalInvariant)
      .toBe("signalTime <= notificationObservedAt");
    expect(R22_R8_NOTIFICATION_CAUSAL_INTEGRATION_CONTRACT.o05CoveredTypes).toEqual([
      "CLAIMED",
      "RETRY_CLAIMED",
      "SKIPPED_DUPLICATE",
      "SKIPPED_EXPIRED",
      "DELIVERY_ATTEMPTED",
      "DELIVERED",
      "DELIVERY_FAILED",
      "DELIVERY_REGISTRY_PERSISTENCE_FAILED",
    ]);
    expect(R22_R8_NOTIFICATION_CAUSAL_INTEGRATION_IMPLEMENTATION_STATUS).toMatchObject({
      r8NotificationCausalIntegrationImplemented: true,
      closesReadinessNodes: [],
      s01Status: "SOURCE_READY",
      s06Status: "SOURCE_READY",
      s07Status: "FAIL",
      s10Status: "FAIL",
      observationExecuted: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      forwardReturnRead: false,
      newMarketDataFetched: false,
      automaticTrading: false,
      humanDecisionRequired: true,
    });
    expect(R22_R8_NOTIFICATION_CAUSAL_INTEGRATION_FINAL_DECISION).toEqual(expect.objectContaining({
      decision: "ROUND-022 R8 NOTIFICATION CAUSAL INTEGRATION IMPLEMENTATION READY",
      nextStage: "STOP_PENDING_R8_ACCEPTANCE",
    }));
  });
});
