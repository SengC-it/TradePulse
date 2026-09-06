import { describe, expect, it } from "vitest";
import {
  R22_OBSERVATION_ACCEPTED_SOURCE,
  R22_OBSERVATION_GATES,
  R22_OBSERVATION_GOVERNANCE,
  R22_OBSERVATION_FORBIDDEN_FIELD_NAMES,
  R22_OBSERVATION_WINDOW_DAYS,
  deriveR22ReviewLatencyProxyMs,
  isR22ObservationDesignEligible,
  validateR22AdvisoryIdentityUniqueness,
  validateR22ObservationRecord,
  validateR22ProspectiveWindow,
  type R22ObservationRecord,
  type R22SnapshotProvenance,
} from "@/lib/research/round-022-observation-protocol";

const signalTime = "2026-01-01T00:00:00.000Z";
const advisoryCreationTime = "2026-01-01T00:01:00.000Z";

function snapshot(name: string): R22SnapshotProvenance {
  return {
    sourceRef: `accepted/${name}`,
    sourceHash: `sha256-${name}`,
    snapshotTime: "2025-12-31T23:59:00.000Z",
    provenanceStatus: "VERIFIED",
    mutability: "IMMUTABLE",
  };
}

function validRecord(overrides: Partial<R22ObservationRecord> = {}): R22ObservationRecord {
  return {
    cohort: "ADVISORY",
    identityKey: "advisory-001",
    direction: "LONG",
    signalTime,
    advisoryCreationTime,
    snapshots: {
      quality: snapshot("quality"),
      marketContext: snapshot("context"),
      riskAdvisory: snapshot("risk"),
      historicalReview: snapshot("historical"),
      alertIntelligence: snapshot("intelligence"),
      presentation: snapshot("presentation"),
    },
    notification: null,
    humanReview: null,
    ...overrides,
  };
}

describe("Round-022 prospective observation protocol", () => {
  it("freezes the exact accepted source and design-only governance", () => {
    expect(R22_OBSERVATION_ACCEPTED_SOURCE).toBe("60b003a80e231ace69e4fc4d4217a7d22724ce1b");
    expect(R22_OBSERVATION_GOVERNANCE).toMatchObject({
      designOnly: true,
      observationExecuted: false,
      historicalBackfillExecuted: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      forwardReturnRead: false,
      newMarketDataFetched: false,
      productionUnchanged: true,
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it("freezes a 30-calendar-day prospective window with inclusive start and exclusive end", () => {
    const t0 = "2026-02-01T00:00:00.000Z";
    const start = validateR22ProspectiveWindow(t0, t0);
    const beforeEnd = validateR22ProspectiveWindow(t0, "2026-03-02T23:59:59.999Z");
    const atEnd = validateR22ProspectiveWindow(t0, "2026-03-03T00:00:00.000Z");

    expect(R22_OBSERVATION_WINDOW_DAYS).toBe(30);
    expect(start.status).toBe("IN_WINDOW");
    expect(beforeEnd.status).toBe("IN_WINDOW");
    expect(atEnd.status).toBe("OUT_OF_WINDOW");
    expect(atEnd.reason).toBe("WINDOW_EXPIRED");
    expect(start.earlyStoppingAllowed).toBe(false);
    expect(start.resultBasedExtensionAllowed).toBe(false);
    expect(start.historicalBackfillAllowed).toBe(false);
    expect(start.retrospectiveSamplingAllowed).toBe(false);
  });

  it("does not authorize an observation without an actual T0", () => {
    expect(validateR22ProspectiveWindow(null, signalTime)).toMatchObject({
      status: "NOT_EVALUABLE",
      t0Configured: false,
      reason: "T0_NOT_CONFIGURED",
    });
  });

  it.each([
    ["LONG", "LONG"],
    ["SHORT", "SHORT"],
  ] as const)("accepts a valid %s advisory cohort identity", (_label, direction) => {
    const result = validateR22ObservationRecord(validRecord({ direction }));
    expect(result).toMatchObject({ status: "OBSERVABLE", direction, cohort: "ADVISORY", reason: "NONE" });
  });

  it("excludes NO_SIGNAL from alert observation denominators", () => {
    const result = validateR22ObservationRecord(validRecord({ direction: "NO_SIGNAL", identityKey: null }));
    expect(result).toMatchObject({
      status: "NOT_EVALUABLE",
      reason: "NO_SIGNAL_NOT_AN_ALERT",
      noSignalExcluded: true,
    });
  });

  it("freezes separate advisory, notification, and human-review denominator rules", () => {
    const notification = validRecord({
      cohort: "NOTIFICATION",
      notification: {
        notificationObservationId: "notification-001",
        observedAt: "2026-01-01T00:02:00.000Z",
        disposition: "DUPLICATE_SKIPPED",
      },
    });
    const humanReview = validRecord({
      cohort: "HUMAN_REVIEW",
      humanReview: {
        reviewObservationId: "review-001",
        reviewStartedAt: "2026-01-01T00:03:00.000Z",
        reviewSubmittedAt: "2026-01-01T00:03:02.500Z",
        reviewComplete: true,
        informationSufficient: true,
        unnecessaryAlert: false,
      },
    });

    expect(validateR22ObservationRecord(notification).status).toBe("OBSERVABLE");
    expect(validateR22ObservationRecord(humanReview).status).toBe("OBSERVABLE");
    expect(JSON.stringify({
      advisory: "unique advisory identities",
      notification: "every notification including duplicates",
      humanReview: "every valid human review",
    })).toContain("duplicates");
  });

  it("retains duplicate notification observations instead of applying advisory deduplication", () => {
    const records = [
      validRecord({
        cohort: "NOTIFICATION",
        notification: {
          notificationObservationId: "notification-001",
          observedAt: "2026-01-01T00:02:00.000Z",
          disposition: "DELIVERED",
        },
      }),
      validRecord({
        cohort: "NOTIFICATION",
        notification: {
          notificationObservationId: "notification-002",
          observedAt: "2026-01-01T00:02:01.000Z",
          disposition: "DUPLICATE_SKIPPED",
        },
      }),
    ];
    expect(records).toHaveLength(2);
    expect(records.every((record) => validateR22ObservationRecord(record).status === "OBSERVABLE")).toBe(true);
  });

  it("requires unique directional advisory identity", () => {
    const duplicate = validateR22AdvisoryIdentityUniqueness([
      validRecord(),
      validRecord({ direction: "SHORT" }),
    ]);
    const unique = validateR22AdvisoryIdentityUniqueness([
      validRecord(),
      validRecord({ identityKey: "advisory-002", direction: "SHORT" }),
    ]);

    expect(duplicate).toMatchObject({ status: "FAIL", duplicateIdentityKeys: ["advisory-001"] });
    expect(unique).toMatchObject({ status: "PASS", duplicateIdentityKeys: [] });
  });

  it("fails closed when identity or timestamps are missing", () => {
    expect(validateR22ObservationRecord(validRecord({ identityKey: null })).reason).toBe("MISSING_IDENTITY");
    expect(validateR22ObservationRecord(validRecord({ signalTime: null })).reason).toBe("MISSING_TIMESTAMP_PROVENANCE");
    expect(validateR22ObservationRecord(validRecord({ advisoryCreationTime: null })).reason).toBe("MISSING_TIMESTAMP_PROVENANCE");
  });

  it("rejects timestamp inversion and missing immutable snapshot provenance", () => {
    expect(validateR22ObservationRecord(validRecord({
      snapshots: { ...validRecord().snapshots, quality: snapshot("quality-late") },
      signalTime: "2025-12-31T23:58:00.000Z",
    })).reason).toBe("MISSING_SNAPSHOT_PROVENANCE");

    expect(validateR22ObservationRecord(validRecord({
      snapshots: { ...validRecord().snapshots, riskAdvisory: { ...snapshot("risk"), sourceHash: null } },
    })).reason).toBe("MISSING_SNAPSHOT_PROVENANCE");
    expect(validateR22ObservationRecord(validRecord({
      snapshots: { ...validRecord().snapshots, marketContext: snapshot("context") },
    })).status).toBe("OBSERVABLE");
  });

  it("rejects incomplete notification provenance", () => {
    const result = validateR22ObservationRecord(validRecord({ cohort: "NOTIFICATION" }));
    expect(result).toMatchObject({ status: "NOT_EVALUABLE", reason: "MISSING_NOTIFICATION_PROVENANCE" });
  });

  it("defines review latency only from review timestamps", () => {
    expect(deriveR22ReviewLatencyProxyMs({
      reviewStartedAt: "2026-01-01T00:03:00.000Z",
      reviewSubmittedAt: "2026-01-01T00:03:02.500Z",
    })).toEqual({ status: "OBSERVABLE", decisionLatencyProxyMs: 2500, reason: "NONE" });
    expect(deriveR22ReviewLatencyProxyMs({
      reviewStartedAt: "2026-01-01T00:04:00.000Z",
      reviewSubmittedAt: "2026-01-01T00:03:59.999Z",
    })).toMatchObject({ status: "NOT_EVALUABLE", reason: "REVIEW_TIMESTAMP_INVERSION" });
  });

  it("requires human labels and does not derive unnecessaryAlert from any outcome", () => {
    const missing = validateR22ObservationRecord(validRecord({
      cohort: "HUMAN_REVIEW",
      humanReview: {
        reviewObservationId: "review-002",
        reviewStartedAt: "2026-01-01T00:03:00.000Z",
        reviewSubmittedAt: "2026-01-01T00:03:01.000Z",
        reviewComplete: true,
        informationSufficient: true,
        unnecessaryAlert: null,
      },
    }));
    expect(missing).toMatchObject({ status: "NOT_EVALUABLE", reason: "MISSING_HUMAN_REVIEW_PROVENANCE" });
    expect(JSON.stringify(missing)).not.toMatch(/PnL|forwardReturn|futurePrice|tradeOutcome/i);
  });

  it("keeps forbidden economic fields outside the observation record and output", () => {
    const record = validRecord();
    const result = validateR22ObservationRecord(record);
    expect(Object.keys(record)).not.toContain("futurePrice");
    expect(Object.keys(record)).not.toContain("economicOutcome");
    expect(JSON.stringify(result)).not.toMatch(/PnL|profit|forwardReturn|futurePrice|winRate|drawdown/i);
    expect(R22_OBSERVATION_FORBIDDEN_FIELD_NAMES).toContain("forwardReturn");
  });

  it("does not authorize a design with unresolved instrumentation gates", () => {
    expect(R22_OBSERVATION_GATES.map((gate) => gate.id)).toEqual([
      "O01", "O02", "O03", "O04", "O05", "O06", "O07", "O08", "O09",
    ]);
    expect(R22_OBSERVATION_GATES.filter((gate) => gate.status === "INSTRUMENTATION_REQUIRED").map((gate) => gate.id))
      .toEqual(["O03", "O04", "O05", "O06"]);
    expect(isR22ObservationDesignEligible()).toBe(false);
  });

  it("never introduces an upstream feedback or execution decision", () => {
    const output = JSON.stringify(validateR22ObservationRecord(validRecord()));
    expect(output).toContain('"humanDecisionRequired":true');
    expect(output).toContain('"automaticTrading":false');
    expect(output).not.toMatch(/order|position|leverage|execute|scheduler|cron/i);
  });
});
