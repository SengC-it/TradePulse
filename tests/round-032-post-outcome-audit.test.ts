import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const PARENT_SHA = "d17f0643bb04c1e9a7625fe890fd3be5e57e2b89";
const AUDIT_PATH = "docs/research/round-032-post-outcome-audit.json";
const RECEIPT_PATH = "docs/research/round-032-execution-receipt.json";
const RESULT_PATH = "docs/research/round-032-binance-metrics-environment-result.json";

type FrozenArtifact = {
  path: string;
  sha256BeforeClosure: string;
  sha256AfterClosure: string;
  changed: boolean;
  numericChanged: boolean;
};

type Audit = {
  originalR32Artifacts: FrozenArtifact[];
  networkReprobePerformedDuringClosure: boolean;
  networkRequestsDuringClosure: number;
  mappingDiscriminatorAudit: {
    timestampMappingSelectionBasis: string;
    regularFiveMinuteGridBoundaryBias: boolean;
    timestampMatchCountAloneCanIdentifySemanticOffset: boolean;
    timestampMappingDiscriminatorProtocolRobust: boolean;
    successfulFieldNumericMismatchObserved: boolean;
    mappingSemanticIncompatibilityAuthoritative: boolean;
  };
  auditNextStage: string;
  fullSuiteAudit: {
    beforeClosure: {
      failingFiles: number;
      failingTests: number;
      failureCategoryCounts: Record<string, number>;
    };
    afterClosureValidation: {
      failingFiles: number;
      failingTests: number;
      passingFiles: number;
      passingTests: number;
    };
  };
};

type FrozenResult = {
  r32ExecutionCount: number;
  formalMappingExecutionCount: number;
  archiveOverlapReady: boolean;
  archiveFilesAvailable: number;
  checksumValidFiles: number;
  schemaValidFiles: number;
  timestampParserValidFiles: number;
  liveLogicalRequests: number;
  liveSuccessfulRequests: number;
  liveFailedRequests: number;
  sourceClassification: string;
  requestEvidence: Array<{
    ok: boolean;
    symbol: string;
    endpointOrArchivePath: string;
    errorClass: string;
  }>;
  governance: {
    economicOutcomeFilesRead: boolean;
    economicEvaluationPerformed: boolean;
    tradingEconomicMetricsCalculated: boolean;
    modelFitCount: number;
    candidateCount: number;
    championCount: number;
    selectedAlertCount: number;
    forwardEconomicValuesRead: boolean;
    forwardReturnRead: boolean;
    performanceExecutionCount: number;
    automaticTrading: boolean;
    humanDecisionRequired: boolean;
    productionUnchanged: boolean;
  };
};

type FrozenReceipt = {
  status: string;
  r32ExecutionCount: number;
};

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function frozenArtifactBytes(path: string): Buffer {
  return execFileSync("git", ["show", `${PARENT_SHA}:${path}`]);
}

function readFrozenJson<T>(path: string): T {
  return JSON.parse(frozenArtifactBytes(path).toString("utf8")) as T;
}

describe("Round-032 post-outcome audit", () => {
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8")) as Audit;
  const result = readFrozenJson<FrozenResult>(RESULT_PATH);
  const receipt = readFrozenJson<FrozenReceipt>(RECEIPT_PATH);

  it("keeps the original R32 artifacts byte-identical", () => {
    for (const artifact of audit.originalR32Artifacts) {
      const bytes = frozenArtifactBytes(artifact.path);
      expect(sha256(bytes)).toBe(artifact.sha256BeforeClosure);
      expect(artifact.sha256AfterClosure).toBe(artifact.sha256BeforeClosure);
      expect(artifact.changed).toBe(false);
      expect(artifact.numericChanged).toBe(false);
    }
    expect(audit.networkReprobePerformedDuringClosure).toBe(false);
    expect(audit.networkRequestsDuringClosure).toBe(0);
  });

  it("preserves the single execution receipt and mapping counts", () => {
    expect(receipt.status).toBe("COMPLETED");
    expect(receipt.r32ExecutionCount).toBe(1);
    expect(result.r32ExecutionCount).toBe(1);
    expect(result.formalMappingExecutionCount).toBe(1);
  });

  it("preserves archive, live failure, and historical classification evidence", () => {
    expect(result.archiveOverlapReady).toBe(true);
    expect(result.archiveFilesAvailable).toBe(5);
    expect(result.checksumValidFiles).toBe(5);
    expect(result.schemaValidFiles).toBe(5);
    expect(result.timestampParserValidFiles).toBe(5);
    expect(result.liveLogicalRequests).toBe(25);
    expect(result.liveSuccessfulRequests).toBe(24);
    expect(result.liveFailedRequests).toBe(1);
    expect(result.sourceClassification).toBe("SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY");
    expect(result.requestEvidence.filter((request) => !request.ok)).toEqual([
      expect.objectContaining({
        symbol: "XRPUSDT",
        endpointOrArchivePath: "openInterestHist",
        errorClass: "NETWORK",
      }),
    ]);
  });

  it("records the count-first discriminator as non-robust without rewriting it", () => {
    expect(audit.mappingDiscriminatorAudit.timestampMappingSelectionBasis).toBe("MAXIMUM_MATCHED_TIMESTAMP_ROWS");
    expect(audit.mappingDiscriminatorAudit.regularFiveMinuteGridBoundaryBias).toBe(true);
    expect(audit.mappingDiscriminatorAudit.timestampMatchCountAloneCanIdentifySemanticOffset).toBe(false);
    expect(audit.mappingDiscriminatorAudit.timestampMappingDiscriminatorProtocolRobust).toBe(false);
    expect(audit.mappingDiscriminatorAudit.successfulFieldNumericMismatchObserved).toBe(true);
    expect(audit.mappingDiscriminatorAudit.mappingSemanticIncompatibilityAuthoritative).toBe(false);
    expect(audit.auditNextStage).toBe("LIVE_TRANSPORT_STABILITY_AND_TIMESTAMP_ALIGNMENT_REPROBE_REQUIRED");
  });

  it("keeps the audit outside economics, forward validation, and Production", () => {
    expect(result.governance.economicOutcomeFilesRead).toBe(false);
    expect(result.governance.economicEvaluationPerformed).toBe(false);
    expect(result.governance.tradingEconomicMetricsCalculated).toBe(false);
    expect(result.governance.modelFitCount).toBe(0);
    expect(result.governance.candidateCount).toBe(0);
    expect(result.governance.championCount).toBe(0);
    expect(result.governance.selectedAlertCount).toBe(0);
    expect(result.governance.forwardEconomicValuesRead).toBe(false);
    expect(result.governance.forwardReturnRead).toBe(false);
    expect(result.governance.performanceExecutionCount).toBe(0);
    expect(result.governance.automaticTrading).toBe(false);
    expect(result.governance.humanDecisionRequired).toBe(true);
    expect(result.governance.productionUnchanged).toBe(true);
  });

  it("records a clean validation resolution for every pre-closure failure", () => {
    const failures = audit.fullSuiteAudit.beforeClosure;
    expect(failures.failingFiles).toBe(9);
    expect(failures.failingTests).toBe(12);
    expect(failures.failureCategoryCounts).toEqual({
      A_CHECKOUT_LINE_ENDING_OR_BYTE_IDENTITY_ENVIRONMENT: 12,
      B_MISSING_HISTORICAL_GIT_OBJECT_OR_ALTERNATE: 0,
      C_R32_ADDITIVE_RESEARCH_BOUNDARY_NOT_ISOLATED: 0,
      D_ACTUAL_R32_BEHAVIOR_REGRESSION: 0,
      E_OTHER_ENVIRONMENTAL_NONDETERMINISM: 0,
    });
    expect(audit.fullSuiteAudit.afterClosureValidation).toMatchObject({
      failingFiles: 0,
      failingTests: 0,
      passingFiles: 124,
      passingTests: 2254,
    });
  });
});
