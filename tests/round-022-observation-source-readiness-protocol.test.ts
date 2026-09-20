import { describe, expect, it } from "vitest";

import {
  R22_FROZEN_SNAPSHOT_ARTIFACT_TYPES,
  R22_O04_SOURCE_IDS,
  R22_SOURCE_MATRIX,
  R22_SOURCE_READINESS_ACCEPTED_SOURCE,
  R22_SOURCE_READINESS_GATES,
  R22_SOURCE_READINESS_GATE_IDS,
  R22_SOURCE_READINESS_GOVERNANCE,
  R22_SUPPORTING_PREREQUISITE_IDS,
  R22_SUPPORTING_PREREQUISITE_MATRIX,
  R22_TIMESTAMP_MATRIX,
  allR22SourceReadinessGatesPass,
  buildR22SourceReadinessReport,
  finalR22SourceReadinessDecision,
} from "@/lib/research/round-022-observation-source-readiness-protocol";

const expectedArtifactTypes = [
  "QUALITY_SNAPSHOT",
  "MARKET_CONTEXT",
  "RISK_ADVISORY",
  "HISTORICAL_REVIEW_METADATA",
  "ALERT_INTELLIGENCE",
  "PRESENTATION",
] as const;

describe("Round-022 observation source readiness audit", () => {
  it("binds the audit to the accepted source", () => {
    expect(R22_SOURCE_READINESS_ACCEPTED_SOURCE).toBe("4bb8eeea60413c4295e8a3bac8897e7f3222f620");
  });

  it("freezes exactly the six Observation snapshot artifact types", () => {
    expect(R22_FROZEN_SNAPSHOT_ARTIFACT_TYPES).toEqual(expectedArtifactTypes);
    expect(R22_SOURCE_MATRIX).toHaveLength(6);
    expect(R22_SOURCE_MATRIX.map((source) => source.id)).toEqual([...R22_O04_SOURCE_IDS]);
    expect(R22_SOURCE_MATRIX.map((source) => source.artifactType)).toEqual([...expectedArtifactTypes]);
    expect(R22_SOURCE_MATRIX.map((source) => source.category)).toEqual([...expectedArtifactTypes]);
  });

  it("does not allow Signal Advisory or Advisory Evaluation to replace a snapshot artifact", () => {
    expect(R22_SOURCE_MATRIX.map((source) => source.artifactType)).not.toContain("SIGNAL_ADVISORY");
    expect(R22_SOURCE_MATRIX.map((source) => source.artifactType)).not.toContain("ADVISORY_EVALUATION");
    expect(R22_SUPPORTING_PREREQUISITE_MATRIX.map((item) => item.id)).toEqual([...R22_SUPPORTING_PREREQUISITE_IDS]);
    expect(R22_SUPPORTING_PREREQUISITE_MATRIX.map((item) => item.prerequisiteType)).toEqual([
      "SIGNAL_ADVISORY",
      "ADVISORY_EVALUATION",
    ]);
    expect(R22_SUPPORTING_PREREQUISITE_MATRIX.find((item) => item.id === "P01")).toMatchObject({
      status: "PASS",
      sourceStatus: "SOURCE_READY",
    });
  });

  it("keeps Quality Snapshot independent and fail-closed", () => {
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S01")).toMatchObject({
      artifactType: "QUALITY_SNAPSHOT",
      sourceStatus: "SOURCE_UNVERIFIED",
      status: "FAIL",
      actualRuntimeCallSite: null,
      pointInTimeAssessment: "NOT_PROVEN",
    });
  });

  it("audits Market Context as an independent gate", () => {
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S02")).toMatchObject({
      artifactType: "MARKET_CONTEXT",
      producerFile: "src/lib/signal-quality/evaluator.ts",
      producerFunction: "deriveMarketContextAdvisory; evaluateSignalQuality",
      sourceStatus: "SOURCE_UNVERIFIED",
      status: "FAIL",
      actualRuntimeCallSite: null,
    });
    expect(R22_SOURCE_READINESS_GATES.find((gate) => gate.id === "S02")).toMatchObject({ status: "FAIL" });
  });

  it("audits Risk Advisory as an independent gate", () => {
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S03")).toMatchObject({
      artifactType: "RISK_ADVISORY",
      producerFile: "src/lib/signal-quality/evaluator.ts",
      producerFunction: "deriveRiskAdvisory; evaluateSignalQuality",
      sourceStatus: "SOURCE_UNVERIFIED",
      status: "FAIL",
      actualRuntimeCallSite: null,
    });
    expect(R22_SOURCE_READINESS_GATES.find((gate) => gate.id === "S03")).toMatchObject({ status: "FAIL" });
  });

  it("does not treat the design-only Historical Review protocol or fallback as S04", () => {
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S04")).toMatchObject({
      artifactType: "HISTORICAL_REVIEW_METADATA",
      sourceStatus: "SOURCE_ABSENT",
      status: "FAIL",
      runtimeProducer: null,
      producerFile: null,
    });
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S04")?.reason).toContain("design-only");
  });

  it("keeps Alert Intelligence separate and unable to bypass missing S04", () => {
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S05")).toMatchObject({
      artifactType: "ALERT_INTELLIGENCE",
      sourceStatus: "SOURCE_UNVERIFIED",
      status: "FAIL",
      actualRuntimeCallSite: null,
    });
    expect(R22_SOURCE_READINESS_GATES.find((gate) => gate.id === "S04")?.status).toBe("FAIL");
    expect(R22_SOURCE_READINESS_GATES.find((gate) => gate.id === "S05")?.status).toBe("FAIL");
  });

  it("requires a real runtime presentation producer with R22 provenance", () => {
    expect(R22_SOURCE_MATRIX.find((source) => source.id === "S06")).toMatchObject({
      artifactType: "PRESENTATION",
      actualRuntimeCallSite: expect.stringContaining("sendSignalEmail"),
      sourceStatus: "SOURCE_UNVERIFIED",
      status: "FAIL",
      informationAsOfSource: null,
    });
  });

  it("audits every required timestamp and keeps future sources unresolved", () => {
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
    expect(R22_TIMESTAMP_MATRIX.filter((entry) => ["informationAsOf", "capturedAt"].includes(entry.timestamp))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currentStatus: "FUTURE_SOURCE", serverAuthoritative: false }),
      ]),
    );
    expect(R22_TIMESTAMP_MATRIX.find((entry) => entry.timestamp === "reviewStartedAt")).toMatchObject({
      currentStatus: "SOURCE_ABSENT",
    });
  });

  it("keeps O05 remediation distinct from durable Observation implementation", () => {
    expect(R22_SOURCE_READINESS_GOVERNANCE).toMatchObject({
      o05RemediationImplemented: true,
      observationInstrumentationImplemented: false,
      observationExecuted: false,
      performanceExecutionCount: 0,
      economicValuesRead: false,
      automaticTrading: false,
    });
  });

  it("requires every S01-S10 gate and excludes P01/P02 from the all-pass predicate", () => {
    expect(R22_SOURCE_READINESS_GATES).toHaveLength(10);
    expect(R22_SOURCE_READINESS_GATES.map((gate) => gate.id)).toEqual([...R22_SOURCE_READINESS_GATE_IDS]);
    expect(allR22SourceReadinessGatesPass(R22_SOURCE_READINESS_GATES)).toBe(false);
    expect(finalR22SourceReadinessDecision(R22_SOURCE_READINESS_GATES)).toBe(
      "ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE",
    );
    const allPass = R22_SOURCE_READINESS_GATE_IDS.map((id) => ({
      id,
      status: "PASS" as const,
      sourceStatus: "SOURCE_READY" as const,
      reason: "synthetic all-pass input",
    }));
    expect(allR22SourceReadinessGatesPass(allPass)).toBe(true);
    const oneFail = allPass.map((gate) => gate.id === "S04"
      ? { ...gate, status: "FAIL" as const, sourceStatus: "SOURCE_ABSENT" as const }
      : gate);
    expect(allR22SourceReadinessGatesPass(oneFail)).toBe(false);
  });

  it("contains no economic result fields and preserves signal-only governance", () => {
    const serialized = JSON.stringify({
      sourceMatrix: R22_SOURCE_MATRIX,
      supportingPrerequisites: R22_SUPPORTING_PREREQUISITE_MATRIX,
      timestampMatrix: R22_TIMESTAMP_MATRIX,
    });
    for (const forbidden of ["PnL", "forwardReturn", "profitFactor", "drawdown", "futurePrice", "tradeOutcome"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(R22_SOURCE_READINESS_GOVERNANCE.humanDecisionRequired).toBe(true);
    expect(R22_SOURCE_READINESS_GOVERNANCE.automaticTrading).toBe(false);
  });

  it("builds the immutable fail-closed report without authorization", () => {
    expect(buildR22SourceReadinessReport()).toMatchObject({
      snapshotArtifactTypes: expectedArtifactTypes,
      supportingPrerequisites: R22_SUPPORTING_PREREQUISITE_MATRIX,
      finalDecision: "ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE",
      nextStage: "STOP",
    });
  });
});
