import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  deriveR18PerformanceExecutionCount,
  readR18PerformanceLedger,
} from "@/lib/research/m3-r18-round-018-performance-ledger";

const EXECUTION_ID = "r18-d328ac05-868b-4647-b5b3-6039e49dbe39";
const IMPLEMENTATION_COMMIT = "862c17209f5bf5fe65ef295f07f98f77e9c61254";
const CLAIM_COMMIT = "3cb742d910f5782ea3cdaccd93e922762571c2ac";

type ArtifactRecord = Readonly<{ path: string; sha256: string }>;

type GovernanceErratum = Readonly<{
  executionId: string;
  performanceExecutionCount: number;
  finalDecision: string;
  checkpointCounterTerminology: Readonly<{
    legacyFieldName: string;
    legacyFieldValue: number;
    legacyFieldMeaningForThisExecution: string;
    newlyComputedFoldCheckpoints: number;
    reusedCompletedCheckpoints: number;
    completedCheckpointRecomputations: number;
    completedCheckpointRuleViolated: boolean;
  }>;
  claimCommitDeviation: Readonly<{
    implementationCommit: string;
    claimCommit: string;
    changedFilesObserved: readonly string[];
    executableChangeScope: string;
    claimCommitLedgerOnlyRequirementConformed: boolean;
    claimStageEconomicLogicChanged: boolean;
    claimStageGateLogicChanged: boolean;
    claimStageSelectorChanged: boolean;
    claimStageInputIdentityChanged: boolean;
  }>;
  lockedArtifacts: Readonly<{
    results: ArtifactRecord;
    summary: ArtifactRecord;
    audit: ArtifactRecord;
    selectionJson: ArtifactRecord;
    selectionMarkdown: ArtifactRecord;
    foldCheckpoints: Readonly<Record<string, ArtifactRecord>>;
    finalPerformanceCheckpoint: ArtifactRecord;
  }>;
  ledgerLockedOutputHashes: Readonly<Record<string, string>>;
  governance: Readonly<{
    performanceRerun: boolean;
    newMarketDataFetched: boolean;
    economicResultChanged: boolean;
  }>;
}>;

const ERRATUM_PATH = path.join(process.cwd(), "docs", "evidence", "M3_R18_ROUND_018_GOVERNANCE_ERRATUM.json");

function sha256(relativePath: string): string {
  return createHash("sha256").update(readFileSync(path.join(process.cwd(), relativePath))).digest("hex");
}

function readErratum(): GovernanceErratum {
  return JSON.parse(readFileSync(ERRATUM_PATH, "utf8")) as GovernanceErratum;
}

function gitDiffNames(base: string, head: string): string[] {
  return execFileSync("git", ["diff", "--name-only", "--no-renames", base, head], { cwd: process.cwd(), encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
}

function gitDiffForPath(base: string, head: string, filePath: string): string {
  return execFileSync("git", ["diff", "--no-ext-diff", "--unified=0", base, head, "--", filePath], { cwd: process.cwd(), encoding: "utf8" });
}

describe("Round-018 performance governance erratum", () => {
  it("records the initial-fold terminology without changing the locked audit", () => {
    const erratum = readErratum();
    const audit = JSON.parse(readFileSync(path.join(process.cwd(), "docs", "evidence", "M3_R18_ROUND_018_AUDIT.json"), "utf8")) as {
      execution: { executionId: string; performanceExecutionCount: number; recomputedCompletedCheckpoints: number; };
    };
    expect(audit.execution).toMatchObject({ executionId: EXECUTION_ID, performanceExecutionCount: 1, recomputedCompletedCheckpoints: 6 });
    expect(erratum.checkpointCounterTerminology).toEqual({
      legacyFieldName: "recomputedCompletedCheckpoints",
      legacyFieldValue: 6,
      legacyFieldMeaningForThisExecution: "newlyComputedFoldCheckpoints",
      newlyComputedFoldCheckpoints: 6,
      reusedCompletedCheckpoints: 0,
      completedCheckpointRecomputations: 0,
      completedCheckpointRuleViolated: false,
    });
  });

  it("keeps the single complete ledger and final result immutable", () => {
    const erratum = readErratum();
    const ledger = readR18PerformanceLedger(path.join(process.cwd(), "docs", "research", "round-018-performance-ledger.json"));
    const record = ledger.executions[0]!;
    expect(record.executionId).toBe(EXECUTION_ID);
    expect(record.status).toBe("COMPLETE");
    expect(record.completedFoldIds).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(deriveR18PerformanceExecutionCount(ledger)).toBe(1);
    expect(erratum.executionId).toBe(EXECUTION_ID);
    expect(erratum.performanceExecutionCount).toBe(1);
    expect(erratum.finalDecision).toBe("NO ROBUST COMPONENT-CONSENSUS EDGE — ROUND-018");
    expect(erratum.governance).toEqual({ performanceRerun: false, newMarketDataFetched: false, economicResultChanged: false });
  });

  it("verifies every locked economic artifact and checkpoint byte hash", () => {
    const erratum = readErratum();
    const artifacts = [
      erratum.lockedArtifacts.results,
      erratum.lockedArtifacts.summary,
      erratum.lockedArtifacts.audit,
      erratum.lockedArtifacts.selectionJson,
      erratum.lockedArtifacts.selectionMarkdown,
      ...Object.values(erratum.lockedArtifacts.foldCheckpoints),
      erratum.lockedArtifacts.finalPerformanceCheckpoint,
    ];
    for (const artifact of artifacts) expect(sha256(artifact.path)).toBe(artifact.sha256);
    expect(erratum.ledgerLockedOutputHashes).toEqual({
      resultSha256: erratum.lockedArtifacts.results.sha256,
      summarySha256: erratum.lockedArtifacts.summary.sha256,
      auditSha256: erratum.lockedArtifacts.audit.sha256,
      selectionSha256: erratum.lockedArtifacts.selectionJson.sha256,
    });
  });

  it("automatically verifies the exact historical claim-stage diff whitelist", () => {
    const erratum = readErratum();
    expect(gitDiffNames(IMPLEMENTATION_COMMIT, CLAIM_COMMIT)).toEqual([
      "docs/research/round-018-performance-ledger.json",
      "scripts/m3-r18-performance.ts",
    ]);
    expect(erratum.claimCommitDeviation).toMatchObject({
      implementationCommit: IMPLEMENTATION_COMMIT,
      claimCommit: CLAIM_COMMIT,
      changedFilesObserved: [
        "docs/research/round-018-performance-ledger.json",
        "scripts/m3-r18-performance.ts",
      ],
      executableChangeScope: "verifyExecutionCheckout() and its invocation only",
      claimCommitLedgerOnlyRequirementConformed: false,
      claimStageEconomicLogicChanged: false,
      claimStageGateLogicChanged: false,
      claimStageSelectorChanged: false,
      claimStageInputIdentityChanged: false,
    });
    expect(gitDiffForPath(IMPLEMENTATION_COMMIT, CLAIM_COMMIT, "src/lib/research/m3-r18-round-018-performance.ts")).toBe("");
    expect(gitDiffForPath(IMPLEMENTATION_COMMIT, CLAIM_COMMIT, "src/lib/research/m3-r18-round-018-performance-ledger.ts")).toBe("");
    const checkoutGuardDiff = gitDiffForPath(IMPLEMENTATION_COMMIT, CLAIM_COMMIT, "scripts/m3-r18-performance.ts");
    expect(checkoutGuardDiff).toContain("verifyExecutionCheckout");
    expect(checkoutGuardDiff).toContain("ROUND_018_PERFORMANCE_LEDGER_PATH");
  });

  it("records that continuation, execution, and market-data acquisition were not repeated", () => {
    const erratum = readErratum();
    expect(erratum.checkpointCounterTerminology.completedCheckpointRecomputations).toBe(0);
    expect(erratum.checkpointCounterTerminology.reusedCompletedCheckpoints).toBe(0);
    expect(erratum.governance.performanceRerun).toBe(false);
    expect(erratum.governance.newMarketDataFetched).toBe(false);
  });
});
