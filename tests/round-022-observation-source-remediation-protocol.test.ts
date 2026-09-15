import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  R22_FORBIDDEN_RUNTIME_INPUTS,
  R22_SOURCE_REMEDIATION_ACCEPTED_SOURCE,
  R22_SOURCE_REMEDIATION_BASE_BRANCH,
  R22_SOURCE_REMEDIATION_DAG,
  R22_SOURCE_REMEDIATION_DESIGN_PATH,
  R22_SOURCE_REMEDIATION_GATES,
  R22_SOURCE_REMEDIATION_GOVERNANCE,
  R22_SOURCE_REMEDIATION_NODE_IDS,
  R22_SOURCE_REMEDIATION_PHASE,
  R22_SOURCE_REMEDIATION_ROUND_ID,
  R22_SOURCE_REMEDIATION_STAGES,
  R22_SNAPSHOT_HASHING_CONTRACT,
  R22_SNAPSHOT_REQUIRED_FIELDS,
  isR22SourceRemediationDesignOnlyGovernance,
  validateR22CausalTimestamps,
  validateR22ReviewEvent,
  validateR22SnapshotContract,
  validateR22StageOwnership,
  validateR22SourceRemediationDesign,
} from "@/lib/research/round-022-observation-source-remediation-protocol";

type JsonRecord = Record<string, unknown>;

const contractPath = path.join(process.cwd(), "docs/research/round-022-observation-source-remediation-contract.json");
const designPath = path.join(process.cwd(), R22_SOURCE_REMEDIATION_DESIGN_PATH);
const protocolPath = path.join(process.cwd(), "src/lib/research/round-022-observation-source-remediation-protocol.ts");

function loadContract(): JsonRecord {
  return JSON.parse(readFileSync(contractPath, "utf8")) as JsonRecord;
}

function validSnapshot(overrides: Partial<Parameters<typeof validateR22SnapshotContract>[0]> = {}) {
  return {
    evidenceId: "evidence-001",
    artifactId: "artifact-001",
    artifactType: "QUALITY_SNAPSHOT" as const,
    schemaVersion: "m3-r22-quality-001",
    advisoryIdentity: "signal-001",
    signalId: "signal-001",
    signalTime: "2026-08-15T00:00:00.000Z",
    informationAsOf: "2026-08-14T23:59:59.000Z",
    capturedAt: "2026-08-15T00:00:02.000Z",
    sourceRef: "accepted-source-ref",
    payload: { status: "AVAILABLE" },
    contentHash: "a".repeat(64),
    evidenceHash: "b".repeat(64),
    idempotencyKey: "snapshot-key",
    ...overrides,
  };
}

describe("Round-022 observation source remediation design-only protocol", () => {
  it("binds the exact accepted source, branch, phase, and artifact paths", () => {
    const contract = loadContract();
    expect(contract.researchRoundId).toBe(R22_SOURCE_REMEDIATION_ROUND_ID);
    expect(contract.phase).toBe(R22_SOURCE_REMEDIATION_PHASE);
    expect(contract.branch).toBe("research/round-022-observation-source-remediation-design");
    expect(contract.acceptedResearchSource).toEqual({
      repository: "SengC-it/TradePulse",
      baseBranch: R22_SOURCE_REMEDIATION_BASE_BRANCH,
      requiredBaseHead: R22_SOURCE_REMEDIATION_ACCEPTED_SOURCE,
    });
    expect(contract.snapshotContract).toBeDefined();
  });

  it("keeps the current S01-S10 readiness failures truthful", () => {
    const current = loadContract().currentReadiness as JsonRecord;
    for (const id of ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"]) {
      expect((current[id] as JsonRecord).status).toBe("FAIL");
    }
    expect((loadContract().supportingPrerequisites as JsonRecord).P01).toMatchObject({ status: "SOURCE_READY" });
    expect((loadContract().supportingPrerequisites as JsonRecord).P02).toMatchObject({ status: "FAIL" });
  });

  it("defines every DAG node with explicit producer, PIT, persistence, dependencies, and failure evidence", () => {
    expect(validateR22SourceRemediationDesign()).toEqual([]);
    expect(R22_SOURCE_REMEDIATION_DAG.map((entry) => entry.id)).toEqual(expect.arrayContaining([...R22_SOURCE_REMEDIATION_NODE_IDS]));
    expect(new Set(R22_SOURCE_REMEDIATION_DAG.map((entry) => entry.id)).size).toBe(R22_SOURCE_REMEDIATION_NODE_IDS.length);
    for (const entry of R22_SOURCE_REMEDIATION_DAG) {
      expect(entry.requiredFutureProducer).not.toHaveLength(0);
      expect(entry.authoritativeIdentitySource).not.toHaveLength(0);
      expect(entry.informationAsOfSource).not.toHaveLength(0);
      expect(entry.capturedAtSource).not.toHaveLength(0);
      expect(entry.persistenceRequirement).not.toHaveLength(0);
      expect(entry.appendOnlyOrIdempotencyRequirement).not.toHaveLength(0);
      expect(entry.causalTimestampConstraints.length).toBeGreaterThan(0);
      expect(entry.acceptanceEvidence).not.toHaveLength(0);
      expect(entry.failureMode).not.toHaveLength(0);
    }
  });

  it("freezes independent dependency-ordered future stages", () => {
    const stages = (loadContract().implementationStages as JsonRecord[]).map((stage) => stage.id);
    expect(stages).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]);
    const r6 = (loadContract().implementationStages as JsonRecord[]).find((stage) => stage.id === "R6")!;
    expect(r6.dependsOn).toEqual(["R2", "R3", "R4", "R5"]);
    for (const stage of loadContract().implementationStages as JsonRecord[]) {
      expect(stage.introducesCapabilities).toBeDefined();
      expect(stage.closesReadinessNodes).toBeDefined();
      expect(stage).not.toHaveProperty("covers");
    }
    for (const stage of loadContract().implementationStages as JsonRecord[]) {
      expect(stage.mergeableIndependently).toBe(true);
      expect(String(stage.authorization)).toContain("separate future approval");
    }
  });

  it("separates foundation, integration, and unique readiness closure ownership", () => {
    expect(validateR22StageOwnership()).toEqual([]);
    expect(R22_SOURCE_REMEDIATION_STAGES.find((stage) => stage.id === "R1")?.closesReadinessNodes).toEqual([]);
    expect(R22_SOURCE_REMEDIATION_STAGES.find((stage) => stage.id === "R8")?.closesReadinessNodes).toEqual([]);
    expect(R22_SOURCE_REMEDIATION_STAGES.find((stage) => stage.id === "R9")?.closesReadinessNodes)
      .toEqual(["S07", "S08", "S09"]);
    expect(R22_SOURCE_REMEDIATION_STAGES.find((stage) => stage.id === "R10")?.closesReadinessNodes)
      .toEqual(["S10"]);
    const ownership = loadContract().readinessNodeStageOwnership as JsonRecord;
    expect(ownership.uniqueClosureOwner).toMatchObject({ S07: "R9", S08: "R9", S09: "R9", S10: "R10" });
    expect(ownership.R1FoundationOnly).toEqual(["S07", "S10"]);
    const byId = new Map(R22_SOURCE_REMEDIATION_DAG.map((entry) => [entry.id, entry]));
    expect(byId.get("S07")).toMatchObject({ foundationStage: "R1", integrationStage: "R8", readinessClosureStage: "R9" });
    expect(byId.get("S10")).toMatchObject({ foundationStage: "R1", integrationStage: "R1", readinessClosureStage: "R10" });
    expect((loadContract().implementationStages as JsonRecord[]).flatMap((stage) => stage.closesReadinessNodes as string[]))
      .toEqual(expect.arrayContaining(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"]));
  });

  it("keeps stage dependencies topologically valid and prevents R1 false readiness claims", () => {
    const stageIndex = new Map(R22_SOURCE_REMEDIATION_STAGES.map((stage, index) => [stage.id, index]));
    for (const stage of R22_SOURCE_REMEDIATION_STAGES) {
      for (const dependency of stage.dependsOn) {
        if (dependency === "P01") continue;
        expect(stageIndex.get(dependency)!).toBeLessThan(stageIndex.get(stage.id)!);
      }
    }
    const r1 = R22_SOURCE_REMEDIATION_STAGES.find((stage) => stage.id === "R1")!;
    expect(r1.closesReadinessNodes).not.toContain("S07");
    expect(r1.closesReadinessNodes).not.toContain("S10");
    for (const id of ["S07", "S10"]) {
      expect((loadContract().currentReadiness as JsonRecord)[id]).toMatchObject({ status: "FAIL" });
    }
  });

  it("enforces informationAsOf <= signalTime <= capturedAt", () => {
    expect(validateR22CausalTimestamps({
      informationAsOf: "2026-08-14T23:59:59.000Z",
      signalTime: "2026-08-15T00:00:00.000Z",
      capturedAt: "2026-08-15T00:00:02.000Z",
    })).toMatchObject({ status: "VALID" });
    expect(validateR22CausalTimestamps({
      informationAsOf: "2026-08-15T00:00:01.000Z",
      signalTime: "2026-08-15T00:00:00.000Z",
      capturedAt: "2026-08-15T00:00:02.000Z",
    }).reasons).toContain("INFORMATION_AS_OF_AFTER_SIGNAL");
    expect(validateR22CausalTimestamps({
      informationAsOf: "2026-08-14T23:59:59.000Z",
      signalTime: "2026-08-15T00:00:00.000Z",
      capturedAt: "2026-08-14T23:59:58.000Z",
    }).reasons).toEqual(expect.arrayContaining(["CAPTURE_BEFORE_SIGNAL", "CAPTURE_BEFORE_INFORMATION_AS_OF"]));
  });

  it("enforces advisory, notification, and human-review ordering", () => {
    const base = {
      informationAsOf: "2026-08-14T23:59:59.000Z",
      signalTime: "2026-08-15T00:00:00.000Z",
      capturedAt: "2026-08-15T00:00:05.000Z",
    };
    expect(validateR22CausalTimestamps({ ...base, advisoryCreationTime: "2026-08-15T00:00:01.000Z" }).status).toBe("VALID");
    expect(validateR22CausalTimestamps({ ...base, advisoryCreationTime: "2026-08-14T23:59:59.000Z" }).reasons).toContain("ADVISORY_CREATION_BEFORE_SIGNAL");
    expect(validateR22CausalTimestamps({ ...base, notificationObservedAt: "2026-08-14T23:59:59.000Z" }).reasons).toContain("NOTIFICATION_BEFORE_SIGNAL");
    expect(validateR22CausalTimestamps({ ...base, reviewStartedAt: "2026-08-14T23:59:59.000Z" }).reasons).toContain("REVIEW_BEFORE_SIGNAL");
    expect(validateR22CausalTimestamps({ ...base, reviewStartedAt: "2026-08-15T00:00:01.000Z", reviewSubmittedAt: "2026-08-15T00:00:02.000Z" }).status).toBe("VALID");
  });

  it("validates snapshot identity, hashes, and fail-closed missing provenance", () => {
    expect(validateR22SnapshotContract(validSnapshot()).status).toBe("VALID");
    expect(validateR22SnapshotContract(validSnapshot({ contentHash: "bad" })).status).toBe("NOT_EVALUABLE");
    expect(validateR22SnapshotContract(validSnapshot({ sourceRef: "" })).reasons).toContain("MISSING_sourceRef");
    expect(R22_SNAPSHOT_REQUIRED_FIELDS).toEqual(expect.arrayContaining([
      "evidenceId", "artifactId", "artifactType", "informationAsOf", "capturedAt", "contentHash", "evidenceHash", "idempotencyKey",
    ]));
    expect(R22_SNAPSHOT_HASHING_CONTRACT.capturedAtExcludedFromContentHash).toBe(true);
  });

  it("defines prospective Historical Review without prohibited outcome or backfill inputs", () => {
    const contract = loadContract();
    const historical = contract.historicalReviewProducerDesign as JsonRecord;
    expect(historical.status).toBe("DESIGN_READY_PROSPECTIVE_ONLY");
    expect(historical.runtimeStatus).toBe("CURRENTLY_ABSENT; this design does not make S04 SOURCE_READY");
    expect(historical.pitCutoff).toBe("signalTime; no input after signalTime is permitted");
    expect(historical.missing).toBe("NOT_EVALUABLE; no fabricated or substituted metadata");
    expect(historical.forbidden).toEqual(expect.arrayContaining([
      "future outcome of current signal", "forward return", "realized PnL", "retrospective backfill", "signal-review settlement state",
    ]));
  });

  it("keeps REVIEW_STARTED and REVIEW_SUBMITTED separate and server-authoritative", () => {
    const signalTime = "2026-08-15T00:00:00.000Z";
    expect(validateR22ReviewEvent({
      eventType: "REVIEW_STARTED",
      reviewObservationId: "review-1",
      advisoryIdentity: "signal-1",
      signalTime,
      reviewStartedAt: "2026-08-15T00:00:01.000Z",
      idempotencyKey: "REVIEW|review-1|START",
    }).status).toBe("VALID");
    expect(validateR22ReviewEvent({
      eventType: "REVIEW_SUBMITTED",
      reviewObservationId: "review-1",
      advisoryIdentity: "signal-1",
      signalTime,
      reviewStartedAt: "2026-08-15T00:00:01.000Z",
      reviewSubmittedAt: "2026-08-15T00:00:02.000Z",
      idempotencyKey: "REVIEW|review-1|SUBMIT",
    }).status).toBe("VALID");
    expect(validateR22ReviewEvent({
      eventType: "REVIEW_SUBMITTED",
      reviewObservationId: "review-1",
      advisoryIdentity: "signal-1",
      signalTime,
      reviewStartedAt: "2026-08-15T00:00:02.000Z",
      reviewSubmittedAt: "2026-08-15T00:00:01.000Z",
      idempotencyKey: "REVIEW|review-1|SUBMIT",
    }).reasons).toContain("REVIEW_SUBMITTED_BEFORE_STARTED");
  });

  it("preserves O05 compatibility and does not add runtime/data acquisition behavior", () => {
    const contract = loadContract();
    const o05 = contract.o05Compatibility as JsonRecord;
    expect(o05.status).toBe("PRESERVED");
    expect(o05.notificationDecisionId).toContain("exact decisionType");
    expect(o05.terminalIdentity).toContain("failureCode");
    const source = readFileSync(protocolPath, "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(|createSupabaseAdminClient\s*\(|readFileSync\s*\(/);
    expect(source).not.toMatch(/from\s+["'][^"']*supabase[^"']*["']/i);
    expect(R22_FORBIDDEN_RUNTIME_INPUTS).toEqual(expect.arrayContaining(["PnL", "forwardReturn", "historicalBackfill", "newMarketData"]));
  });

  it("freezes design-only governance and the final decision", () => {
    const contract = loadContract();
    expect(isR22SourceRemediationDesignOnlyGovernance(R22_SOURCE_REMEDIATION_GOVERNANCE)).toBe(true);
    expect(contract.finalDesignDecision).toBe("ROUND-022 SOURCE REMEDIATION DESIGN READY");
    expect(contract.nextStage).toBe("STOP_PENDING_DESIGN_ACCEPTANCE");
    expect(contract.governance).toMatchObject({
      observationInstrumentationImplemented: false,
      observationAuthorized: false,
      observationExecuted: false,
      performanceAuthorized: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      forwardReturnRead: false,
      newMarketDataFetched: false,
      historicalBackfillExecuted: false,
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      humanDecisionRequired: true,
      automaticTrading: false,
    });
    expect(R22_SOURCE_REMEDIATION_GATES.every((gate) => gate.status === "PASS")).toBe(true);
    expect(readFileSync(designPath, "utf8")).toContain("ROUND-022 SOURCE REMEDIATION DESIGN READY");
  });
});
