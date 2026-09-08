import { describe, expect, it } from "vitest";

import {
  R22_O04_SOURCE_IDS,
  R22_SOURCE_MATRIX,
  R22_SOURCE_READINESS_ACCEPTED_SOURCE,
  R22_SOURCE_READINESS_GATES,
  R22_SOURCE_READINESS_GATE_IDS,
  R22_SOURCE_READINESS_GOVERNANCE,
  R22_TIMESTAMP_MATRIX,
  allR22SourceReadinessGatesPass,
  buildR22SourceReadinessReport,
  finalR22SourceReadinessDecision,
} from "@/lib/research/round-022-observation-source-readiness-protocol";

describe("Round-022 observation source readiness audit", () => {
  it("binds the audit to the accepted source", () => {
    expect(R22_SOURCE_READINESS_ACCEPTED_SOURCE).toBe("4bb8eeea60413c4295e8a3bac8897e7f3222f620");
  });

  it("has exactly six O04 source categories with explicit statuses", () => {
    expect(R22_SOURCE_MATRIX).toHaveLength(6);
    expect(R22_SOURCE_MATRIX.map((source) => source.id)).toEqual([...R22_O04_SOURCE_IDS]);
    for (const source of R22_SOURCE_MATRIX) {
      expect(["SOURCE_READY", "SOURCE_ABSENT", "SOURCE_UNVERIFIED"]).toContain(source.sourceStatus);
      expect(["PASS", "FAIL"]).toContain(source.status);
      expect(source.reason.length).toBeGreaterThan(0);
    }
  });

  it("does not treat design or test files as runtime producers", () => {
    const designOnlyPaths = ["src/lib/research/historical-review-protocol.ts", "tests/"];
    for (const source of R22_SOURCE_MATRIX) {
      expect(designOnlyPaths.some((path) => source.producerFile?.includes(path))).toBe(false);
    }
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S04")).toMatchObject({
      sourceStatus: "SOURCE_ABSENT",
      status: "FAIL",
      runtimeProducer: null,
    });
  });

  it("requires source and PIT evidence for the quality, alert, and evaluation producers", () => {
    for (const id of ["S01", "S03", "S05"] as const) {
      expect(R22_SOURCE_MATRIX.find((source) => source.id === id)).toMatchObject({
        sourceStatus: "SOURCE_UNVERIFIED",
        status: "FAIL",
        pointInTimeAssessment: "NOT_PROVEN",
      });
    }
  });

  it("proves the closed-candle signalTime source without upgrading other sources", () => {
    const signal = R22_SOURCE_MATRIX.find((source) => source.id === "S02");
    expect(signal).toMatchObject({
      sourceStatus: "SOURCE_READY",
      status: "PASS",
      pointInTimeAssessment: "PROVEN",
    });
    expect(signal?.reason).toContain("signalTime = candle.closeTime");
  });

  it("keeps presentation separate from alert-intelligence and historical-review readiness", () => {
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S06")).toMatchObject({
      sourceStatus: "SOURCE_UNVERIFIED",
      status: "FAIL",
    });
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S04")?.reason).toContain("not this metadata");
  });

  it("audits every required timestamp and fails unresolved causal sources", () => {
    expect(R22_TIMESTAMP_MATRIX.map((entry) => entry.timestamp)).toEqual([
      "signalTime",
      "advisoryCreationTime",
      "informationAsOf",
      "capturedAt",
      "notificationObservedAt",
      "reviewStartedAt",
      "reviewSubmittedAt",
    ]);
    expect(R22_TIMESTAMP_MATRIX.find((entry) => entry.timestamp === "signalTime")).toMatchObject({
      serverAuthoritative: true,
      currentStatus: "AVAILABLE_SOURCE",
    });
    expect(R22_TIMESTAMP_MATRIX.find((entry) => entry.timestamp === "informationAsOf")).toMatchObject({
      currentStatus: "FUTURE_SOURCE",
      serverAuthoritative: false,
    });
    expect(R22_TIMESTAMP_MATRIX.find((entry) => entry.timestamp === "reviewStartedAt")).toMatchObject({
      currentStatus: "SOURCE_ABSENT",
    });
  });

  it("keeps O05 remediation distinct from durable observation instrumentation", () => {
    expect(R22_SOURCE_READINESS_GOVERNANCE).toMatchObject({
      o05RemediationImplemented: true,
      observationInstrumentationImplemented: false,
      observationExecuted: false,
      performanceExecutionCount: 0,
      economicValuesRead: false,
      automaticTrading: false,
    });
  });

  it("requires every S01-S10 gate to pass before readiness can pass", () => {
    expect(R22_SOURCE_READINESS_GATES).toHaveLength(10);
    expect(R22_SOURCE_READINESS_GATES.map((gate) => gate.id)).toEqual([...R22_SOURCE_READINESS_GATE_IDS]);
    expect(allR22SourceReadinessGatesPass(R22_SOURCE_READINESS_GATES)).toBe(false);
    expect(finalR22SourceReadinessDecision(R22_SOURCE_READINESS_GATES)).toBe(
      "ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE",
    );
    expect(buildR22SourceReadinessReport()).toMatchObject({
      finalDecision: "ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE",
      nextStage: "STOP",
    });
  });

  it("fails closed when any single gate is changed from PASS to FAIL", () => {
    const allPass = R22_SOURCE_READINESS_GATE_IDS.map((id) => ({
      id,
      status: "PASS" as const,
      sourceStatus: "SOURCE_READY" as const,
      reason: "synthetic all-pass input",
    }));
    expect(allR22SourceReadinessGatesPass(allPass)).toBe(true);
    const oneFail = allPass.map((gate) => gate.id === "S09" ? { ...gate, status: "FAIL" as const } : gate);
    expect(allR22SourceReadinessGatesPass(oneFail)).toBe(false);
    expect(finalR22SourceReadinessDecision(oneFail)).toBe(
      "ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE",
    );
  });

  it("contains no economic result fields and preserves signal-only governance", () => {
    const serialized = JSON.stringify({ sourceMatrix: R22_SOURCE_MATRIX, timestampMatrix: R22_TIMESTAMP_MATRIX });
    for (const forbidden of ["PnL", "forwardReturn", "profitFactor", "drawdown", "futurePrice", "tradeOutcome"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(R22_SOURCE_READINESS_GOVERNANCE.humanDecisionRequired).toBe(true);
    expect(R22_SOURCE_READINESS_GOVERNANCE.automaticTrading).toBe(false);
  });
});
