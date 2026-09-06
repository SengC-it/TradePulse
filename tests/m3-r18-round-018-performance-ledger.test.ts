import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  assertR18SelectionNotExecuted,
  claimR18PerformanceExecution,
  deriveR18PerformanceExecutionCount,
  foldR18CheckpointPath,
  readR18PerformanceLedger,
  updateR18PerformanceLedger,
  validateR18CompletedCheckpoints,
  writeR18CheckpointAtomic,
} from "@/lib/research/m3-r18-round-018-performance-ledger";
import { ROUND_018_FOLDS } from "@/lib/research/m3-r18-round-018-protocol";

const roots: string[] = [];
const input = {
  performanceStageSourceCommit: "2121d5191dd0758fabbfbc9c8d5ca5b808799d66",
  implementationCommit: "implementation-commit",
  acceptedDesignSourceCommit: "feec11151b334a14754b1f720972c6e2b198960a",
  r14ObservationDataSha256: "r14-sha",
  compactStructuralSha256: "compact-sha",
  structuralManifestSha256: "manifest-sha",
  preflightReportSha256: "preflight-sha",
};
const checkpointHashes = Object.freeze({ checkpointInput: "checkpoint-input" });

function root(): string {
  const value = mkdtempSync(path.join(process.cwd(), ".r18-ledger-test-"));
  roots.push(value);
  return value;
}

function claim(value: string, executionId = "r18-00000000-0000-4000-8000-000000000001") {
  return claimR18PerformanceExecution({ root: value, executionId, ...input });
}

afterEach(() => {
  for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe("Round-018 round-global performance ledger", () => {
  it("creates one global lock and derives count from its execution record", () => {
    const value = root();
    const first = claim(value);
    expect(deriveR18PerformanceExecutionCount(first.ledger)).toBe(1);
    expect(readR18PerformanceLedger(first.ledgerPath).executions).toHaveLength(1);
    expect(first.executionDirectory).toContain(first.executionLock.executionId);
  });

  it("rejects a second executionId even when the first output directory is absent", () => {
    const value = root();
    claim(value);
    expect(() => claim(value, "r18-00000000-0000-4000-8000-000000000002")).toThrow(/already locked/);
  });

  it("rejects an alternate execution directory for the original executionId", () => {
    const value = root();
    claim(value);
    expect(() => claimR18PerformanceExecution({ root: value, executionId: "r18-00000000-0000-4000-8000-000000000001", executionDirectory: path.join(value, ".cache", "alternate"), ...input })).toThrow(/fixed/);
  });

  it("uses the original ledger directory for continuation", () => {
    const value = root();
    const first = claim(value);
    const next = claim(value);
    expect(next.continuation).toBe(true);
    expect(next.executionDirectory).toBe(first.executionDirectory);
  });

  it("fails continuation when the authoritative checkpoint root is deleted", () => {
    const value = root();
    const first = claim(value);
    rmSync(first.executionDirectory, { recursive: true, force: true });
    expect(() => validateR18CompletedCheckpoints({ root: value, ledger: first.ledger, executionDirectory: first.executionDirectory, inputHashes: checkpointHashes, continuation: true })).toThrow(/checkpoint directory is missing/);
  });

  it("records a completed fold and refuses continuation when its checkpoint is missing", () => {
    const value = root();
    const first = claim(value);
    const checkpoint = writeR18CheckpointAtomic({ filePath: foldR18CheckpointPath(first.executionDirectory, "F1"), kind: "FOLD", key: "F1", inputHashes: { ...checkpointHashes, foldId: "F1" }, payload: { foldId: "F1", rows: 10 } });
    expect(checkpoint.reused).toBe(false);
    const ledger = updateR18PerformanceLedger({ root: value, expectedLedger: first.ledger, completedFoldIds: ["F1"], status: "CLAIMED", finalSummaryMarker: "PENDING" });
    unlinkSync(foldR18CheckpointPath(first.executionDirectory, "F1"));
    expect(() => validateR18CompletedCheckpoints({ root: value, ledger, executionDirectory: first.executionDirectory, inputHashes: checkpointHashes, continuation: true })).toThrow(/completed fold checkpoint is missing/);
  });

  it("aborts on a completed checkpoint hash or identity mismatch", () => {
    const value = root();
    const first = claim(value);
    const checkpointPath = foldR18CheckpointPath(first.executionDirectory, "F1");
    writeR18CheckpointAtomic({ filePath: checkpointPath, kind: "FOLD", key: "F1", inputHashes: { ...checkpointHashes, foldId: "F1" }, payload: { foldId: "F1", rows: 10 } });
    const ledger = updateR18PerformanceLedger({ root: value, expectedLedger: first.ledger, completedFoldIds: ["F1"], status: "CLAIMED", finalSummaryMarker: "PENDING" });
    writeFileSync(checkpointPath, "corrupt", "utf8");
    expect(() => validateR18CompletedCheckpoints({ root: value, ledger, executionDirectory: first.executionDirectory, inputHashes: checkpointHashes, continuation: true })).toThrow(/corrupt/);
  });

  it("reuses an existing complete checkpoint instead of rewriting it", () => {
    const value = root();
    const first = claim(value);
    const filePath = foldR18CheckpointPath(first.executionDirectory, "F1");
    const initial = writeR18CheckpointAtomic({ filePath, kind: "FOLD", key: "F1", inputHashes: { ...checkpointHashes, foldId: "F1" }, payload: { foldId: "F1", rows: 10 } });
    const before = readFileSync(filePath);
    const reused = writeR18CheckpointAtomic({ filePath, kind: "FOLD", key: "F1", inputHashes: { ...checkpointHashes, foldId: "F1" }, payload: { foldId: "F1", rows: 999 } });
    expect(initial.reused).toBe(false);
    expect(reused.reused).toBe(true);
    expect(readFileSync(filePath)).toEqual(before);
  });

  it("rejects a second execution when evidence outputs are deleted", () => {
    const value = root();
    const first = claim(value);
    const complete = updateR18PerformanceLedger({ root: value, expectedLedger: first.ledger, completedFoldIds: [...ROUND_018_FOLDS], status: "COMPLETE", finalSummaryMarker: "COMPLETE", outputs: { resultSha256: "r", summarySha256: "s", auditSha256: "a", selectionSha256: "q" } });
    expect(() => claim(value, "r18-00000000-0000-4000-8000-000000000002")).toThrow(/already locked/);
    expect(deriveR18PerformanceExecutionCount(complete)).toBe(1);
  });

  it("does not permit a forged execution count or multiple executions", () => {
    const value = root();
    const first = claim(value);
    expect(() => deriveR18PerformanceExecutionCount({ ...first.ledger, executionCount: 2 } as never)).toThrow(/exactly one/);
    expect(() => deriveR18PerformanceExecutionCount({ ...first.ledger, executions: [first.executionLock, first.executionLock] } as never)).toThrow(/exactly one/);
  });

  it("allows selection before finalization and blocks it after the final marker", () => {
    const value = root();
    const first = claim(value);
    expect(() => assertR18SelectionNotExecuted(first.ledger)).not.toThrow();
    const complete = updateR18PerformanceLedger({ root: value, expectedLedger: first.ledger, completedFoldIds: [...ROUND_018_FOLDS], status: "COMPLETE", finalSummaryMarker: "COMPLETE", outputs: { resultSha256: "r", summarySha256: "s", auditSha256: "a", selectionSha256: "q" } });
    expect(() => assertR18SelectionNotExecuted(complete)).toThrow(/cannot be rerun/);
  });

  it("keeps a failed or claimed ledger at one execution regardless of checkpoint state", () => {
    const value = root();
    const first = claim(value);
    const claimed = updateR18PerformanceLedger({ root: value, expectedLedger: first.ledger, completedFoldIds: [], status: "CLAIMED", finalSummaryMarker: "PENDING" });
    expect(deriveR18PerformanceExecutionCount(claimed)).toBe(1);
    expect(readdirSync(value).length).toBeGreaterThan(0);
  });
});
