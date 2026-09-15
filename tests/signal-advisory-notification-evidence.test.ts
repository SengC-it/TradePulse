import { describe, expect, it } from "vitest";

import {
  buildClaimDecisionEvidence,
  buildDeliveredEvidence,
  buildDeliveryFailedEvidence,
  buildNotificationDecisionMetadata,
  buildNotificationTerminalEvent,
  validateNotificationTerminalTransition,
} from "@/lib/signal-advisory/notification-evidence";
import {
  buildR22O05ClaimMetadata,
  buildR22O05TerminalEvent,
  validateR22O05TerminalTransition,
} from "@/lib/research/round-022-o05-notification-identity-protocol";

const identityInput = {
  scanId: "scan-001",
  signalId: "signal-001",
};

describe("Round-022 O05 runtime notification evidence", () => {
  it("keeps runtime decision identity and attempt metadata aligned with the accepted protocol", () => {
    for (const decisionType of [
      "CLAIMED",
      "RETRY_CLAIMED",
      "SKIPPED_DUPLICATE",
      "SKIPPED_EXPIRED",
    ] as const) {
      const runtime = buildNotificationDecisionMetadata({ ...identityInput, decisionType });
      const research = buildR22O05ClaimMetadata({ ...identityInput, decisionType });

      expect(runtime.channel).toBe("EMAIL");
      expect(runtime.notificationDecisionId).toBe(research.notificationDecisionId);
      expect(runtime.attemptSequence).toBe(research.attemptSequence);
    }
  });

  it("maps both skip outcomes to evidence without creating an email attempt", () => {
    const duplicate = buildClaimDecisionEvidence(
      buildNotificationDecisionMetadata({ ...identityInput, decisionType: "SKIPPED_DUPLICATE" }),
    );
    const expired = buildClaimDecisionEvidence(
      buildNotificationDecisionMetadata({ ...identityInput, decisionType: "SKIPPED_EXPIRED" }),
    );

    expect(duplicate).toMatchObject({ type: "CLAIM_DECISION", outcome: "DUPLICATE_SKIPPED" });
    expect(expired).toMatchObject({
      type: "CLAIM_DECISION",
      outcome: "SUPPRESSED",
      suppressionReason: "EXPIRED",
    });
    expect(buildClaimDecisionEvidence(
      buildNotificationDecisionMetadata({ ...identityInput, decisionType: "CLAIMED" }),
    ).type).toBe("CLAIM_DECISION");
  });

  it("uses exact terminal payload equality for replay and rejects changed failure codes", () => {
    const metadata = buildNotificationDecisionMetadata({ ...identityInput, decisionType: "CLAIMED" });
    const authFailure = buildNotificationTerminalEvent({
      notificationDecisionId: metadata.notificationDecisionId,
      terminalOutcome: "DELIVERY_FAILED",
      failureCode: "SMTP_AUTH_FAILED",
    });
    const sameAuthFailure = buildNotificationTerminalEvent({
      notificationDecisionId: metadata.notificationDecisionId,
      terminalOutcome: "DELIVERY_FAILED",
      failureCode: "SMTP_AUTH_FAILED",
    });
    const deliveryFailure = buildNotificationTerminalEvent({
      notificationDecisionId: metadata.notificationDecisionId,
      terminalOutcome: "DELIVERY_FAILED",
      failureCode: "SMTP_DELIVERY_FAILED",
    });

    expect(validateNotificationTerminalTransition(authFailure, sameAuthFailure)).toEqual({
      status: "IDEMPOTENT_REPLAY",
      reason: "IDEMPOTENT_REPLAY",
    });
    expect(validateNotificationTerminalTransition(authFailure, deliveryFailure)).toEqual({
      status: "NOT_EVALUABLE",
      reason: "TERMINAL_CONFLICT",
    });

    const researchAuthFailure = buildR22O05TerminalEvent({
      notificationDecisionId: metadata.notificationDecisionId,
      terminalOutcome: "DELIVERY_FAILED",
      failureCode: "SMTP_AUTH_FAILED",
    });
    const researchDeliveryFailure = buildR22O05TerminalEvent({
      notificationDecisionId: metadata.notificationDecisionId,
      terminalOutcome: "DELIVERY_FAILED",
      failureCode: "SMTP_DELIVERY_FAILED",
    });
    expect(validateR22O05TerminalTransition(researchAuthFailure, researchAuthFailure)).toEqual({
      status: "IDEMPOTENT_REPLAY",
      reason: "IDEMPOTENT_REPLAY",
    });
    expect(validateR22O05TerminalTransition(researchAuthFailure, researchDeliveryFailure)).toEqual({
      status: "NOT_EVALUABLE",
      reason: "TERMINAL_CONFLICT",
    });
  });

  it("keeps delivered and failed terminal payloads mutually conflicting", () => {
    const metadata = buildNotificationDecisionMetadata({ ...identityInput, decisionType: "RETRY_CLAIMED" });
    const delivered = buildDeliveredEvidence(metadata);
    const failed = buildDeliveryFailedEvidence(metadata, "SMTP_DELIVERY_FAILED");

    expect(validateNotificationTerminalTransition(delivered.terminalEvent, failed.terminalEvent)).toEqual({
      status: "NOT_EVALUABLE",
      reason: "TERMINAL_CONFLICT",
    });
  });
});
