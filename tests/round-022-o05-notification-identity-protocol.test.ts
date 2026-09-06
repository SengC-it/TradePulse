import { describe, expect, it } from "vitest";

import {
  R22_O05_ACCEPTED_SOURCE,
  R22_O05_BASE_BRANCH,
  R22_O05_CLAIM_OUTCOMES,
  R22_O05_DELIVERY_MODEL,
  R22_O05_GATES,
  R22_O05_GOVERNANCE,
  R22_O05_IDENTITY_MODEL,
  R22_O05_RPC_SEMANTICS,
  R22_O05_RUNTIME_SOURCES,
  R22_O05_FINAL_DECISION,
  R22_O05_ATTEMPT_SEQUENCE_DESIGN,
  buildR22O05ClaimMetadata,
  buildR22O05TerminalEvent,
  calculateR22O05NotificationDecisionId,
  calculateR22O05TerminalEventId,
  isR22O05DesignReady,
  isR22O05GovernanceSafe,
  validateR22O05ClaimMetadata,
  validateR22O05TerminalEvent,
} from "@/lib/research/round-022-o05-notification-identity-protocol";

const scanId = "scan-001";
const signalId = "signal-001";

describe("Round-022 O05 notification identity remediation design", () => {
  it("binds the design to the accepted research source and target branch", () => {
    expect(R22_O05_ACCEPTED_SOURCE).toBe("6152eb8b3c497e0322c61526743f8b76669f3745");
    expect(R22_O05_BASE_BRANCH).toBe("research/round-015-beta-alpha-decomposition");
  });

  it("audits the real claim, retry, scan, and migration sources", () => {
    expect(R22_O05_RUNTIME_SOURCES.map((source) => source.path)).toEqual([
      "src/lib/signal-advisory/types.ts",
      "src/lib/signal-advisory/store.ts",
      "src/lib/signal-advisory/scan.ts",
      "supabase/migrations/20260823000000_signal_advisory.sql",
    ]);
    const anchors = R22_O05_RUNTIME_SOURCES.flatMap((source) => source.anchors);
    for (const required of [
      "SignalClaimResult",
      "claimSignal(advisory, scanId, now)",
      "attempt_count: 1",
      "tp_retry_signal_advisory",
      "p_scan_id",
      "SKIPPED_DUPLICATE",
      "SKIPPED_EXPIRED",
      "sendSignalEmail",
      "attempt_count = attempt_count + 1",
    ]) {
      expect(anchors).toContain(required);
    }
  });

  it("freezes all four claim outcomes and their actual RPC semantics", () => {
    expect(R22_O05_CLAIM_OUTCOMES).toEqual([
      "CLAIMED",
      "RETRY_CLAIMED",
      "SKIPPED_DUPLICATE",
      "SKIPPED_EXPIRED",
    ]);
    expect(R22_O05_RPC_SEMANTICS.CLAIMED).toMatchObject({ notificationSend: true, attemptSequence: 1 });
    expect(R22_O05_RPC_SEMANTICS.RETRY_CLAIMED).toMatchObject({ notificationSend: true, attemptSequence: 2 });
    expect(R22_O05_RPC_SEMANTICS.SKIPPED_DUPLICATE).toMatchObject({ notificationSend: false, attemptSequence: null });
    expect(R22_O05_RPC_SEMANTICS.SKIPPED_EXPIRED).toMatchObject({ notificationSend: false, attemptSequence: null });
    expect(R22_O05_RPC_SEMANTICS.RETRY_CLAIMED.attemptCountMutation).toMatch(/increments/);
  });

  it("separates delivery attempts from all notification decision events", () => {
    expect(R22_O05_DELIVERY_MODEL.deliveryAttemptDefinition).toMatch(/CLAIMED or RETRY_CLAIMED/);
    expect(R22_O05_DELIVERY_MODEL.decisionEventDefinition).toMatch(/every claim outcome/);
    expect(R22_O05_DELIVERY_MODEL.skipMapping.SKIPPED_DUPLICATE).toBe("DUPLICATE_SKIPPED");
    expect(R22_O05_DELIVERY_MODEL.skipMapping.SKIPPED_EXPIRED).toContain("SUPPRESSED");
    expect(R22_O05_DELIVERY_MODEL.ignored).toContain("INSTRUMENTATION_UNRESOLVED");
  });

  it("creates stable decision identities and distinguishes claim outcomes", () => {
    const claimed = buildR22O05ClaimMetadata({ scanId, signalId, decisionType: "CLAIMED" });
    const claimedReplay = buildR22O05ClaimMetadata({ scanId, signalId, decisionType: "CLAIMED" });
    const retry = buildR22O05ClaimMetadata({ scanId, signalId, decisionType: "RETRY_CLAIMED" });
    const duplicate = buildR22O05ClaimMetadata({ scanId, signalId, decisionType: "SKIPPED_DUPLICATE" });
    const expired = buildR22O05ClaimMetadata({ scanId, signalId, decisionType: "SKIPPED_EXPIRED" });

    expect(claimed.notificationDecisionId).toBe(claimedReplay.notificationDecisionId);
    expect(new Set([
      claimed.notificationDecisionId,
      retry.notificationDecisionId,
      duplicate.notificationDecisionId,
      expired.notificationDecisionId,
    ]).size).toBe(4);
    expect(claimed.attemptSequence).toBe(1);
    expect(retry.attemptSequence).toBe(2);
    expect(duplicate.attemptSequence).toBeNull();
    expect(expired.attemptSequence).toBeNull();
    expect(claimed.channel).toBe("EMAIL");
    expect(R22_O05_IDENTITY_MODEL.doesNotUse).toContain("attemptSequence as an identity input");
  });

  it("separates independent scan runs and rejects fabricated claim metadata", () => {
    const first = calculateR22O05NotificationDecisionId({
      scanId,
      signalId,
      channel: "EMAIL",
      decisionType: "CLAIMED",
    });
    const second = calculateR22O05NotificationDecisionId({
      scanId: "scan-002",
      signalId,
      channel: "EMAIL",
      decisionType: "CLAIMED",
    });
    expect(first).not.toBe(second);
    expect(validateR22O05ClaimMetadata({
      ...buildR22O05ClaimMetadata({ scanId, signalId, decisionType: "CLAIMED" }),
      attemptSequence: 2,
    })).toEqual({ status: "NOT_EVALUABLE", reason: "ATTEMPT_SEQUENCE_MISMATCH" });
    expect(validateR22O05ClaimMetadata({
      ...buildR22O05ClaimMetadata({ scanId, signalId, decisionType: "CLAIMED" }),
      notificationDecisionId: "notification-decision:forged",
    })).toEqual({ status: "NOT_EVALUABLE", reason: "DECISION_ID_MISMATCH" });
  });

  it("validates claim metadata without reconstructing skip attempt sequences", () => {
    for (const decisionType of R22_O05_CLAIM_OUTCOMES) {
      const metadata = buildR22O05ClaimMetadata({ scanId, signalId, decisionType });
      expect(validateR22O05ClaimMetadata(metadata)).toEqual({ status: "VALID", reason: "NONE" });
    }
    expect(R22_O05_ATTEMPT_SEQUENCE_DESIGN.SKIPPED_DUPLICATE.value).toBeNull();
    expect(R22_O05_ATTEMPT_SEQUENCE_DESIGN.SKIPPED_EXPIRED.value).toBeNull();
  });

  it("links delivery success and failure to one terminal identity", () => {
    const decisionId = buildR22O05ClaimMetadata({
      scanId,
      signalId,
      decisionType: "RETRY_CLAIMED",
    }).notificationDecisionId;
    const delivered = buildR22O05TerminalEvent({
      notificationDecisionId: decisionId,
      terminalOutcome: "DELIVERED",
    });
    const failed = buildR22O05TerminalEvent({
      notificationDecisionId: decisionId,
      terminalOutcome: "DELIVERY_FAILED",
      failureCode: "SMTP_DELIVERY_FAILED",
    });
    expect(delivered.terminalEventId).toBe(failed.terminalEventId);
    expect(delivered.notificationDecisionId).toBe(failed.notificationDecisionId);
    expect(validateR22O05TerminalEvent(delivered)).toEqual({ status: "VALID", reason: "NONE" });
    expect(validateR22O05TerminalEvent(failed)).toEqual({ status: "VALID", reason: "NONE" });
    expect(calculateR22O05TerminalEventId(decisionId)).toBe(delivered.terminalEventId);
  });

  it("fails closed for invalid terminal evidence", () => {
    const decisionId = buildR22O05ClaimMetadata({ scanId, signalId, decisionType: "CLAIMED" }).notificationDecisionId;
    const valid = buildR22O05TerminalEvent({
      notificationDecisionId: decisionId,
      terminalOutcome: "DELIVERY_FAILED",
      failureCode: "SMTP_AUTH_FAILED",
    });
    expect(validateR22O05TerminalEvent({ ...valid, terminalEventId: "forged" })).toEqual({
      status: "NOT_EVALUABLE",
      reason: "TERMINAL_ID_MISMATCH",
    });
    expect(() => buildR22O05TerminalEvent({
      notificationDecisionId: decisionId,
      terminalOutcome: "DELIVERY_FAILED",
    })).toThrow(/requires a delivery failure code/);
    expect(() => buildR22O05TerminalEvent({
      notificationDecisionId: decisionId,
      terminalOutcome: "DELIVERED",
      failureCode: "SMTP_AUTH_FAILED",
    })).toThrow(/cannot carry/);
  });

  it("keeps the design gates and governance safe", () => {
    expect(R22_O05_GATES).toHaveLength(7);
    expect(R22_O05_GATES.every((gate) => gate.status === "PASS")).toBe(true);
    expect(R22_O05_FINAL_DECISION).toMatchObject({
      decision: "O05 REMEDIATION DESIGN READY",
      nextStage: "STOP_PENDING_DESIGN_ACCEPTANCE",
      o05RuntimeStatus: "INSTRUMENTATION_REQUIRED",
    });
    expect(isR22O05DesignReady()).toBe(true);
    expect(isR22O05GovernanceSafe()).toBe(true);
    expect(R22_O05_GOVERNANCE.performanceExecutionCount).toBe(0);
    expect(R22_O05_GOVERNANCE.performanceLedgerPresent).toBe(false);
    expect(R22_O05_GOVERNANCE.economicValuesRead).toBe(false);
    expect(R22_O05_GOVERNANCE.newMarketDataFetched).toBe(false);
    expect(R22_O05_GOVERNANCE.automaticTrading).toBe(false);
  });
});
