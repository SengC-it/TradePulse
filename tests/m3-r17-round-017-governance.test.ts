import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  claimR17PerformanceExecution,
  deriveR17PerformanceExecutionCount,
  finalPerformanceCheckpointPath,
  foldCheckpointPath,
  markR17FinalCheckpointComplete,
  readR17PerformanceLedger,
  recordR17PerformanceFoldCompleted,
  summarizeR17CompletedCheckpoints,
  validateR17CompletedCheckpoints,
  validateR17ExecutionLedgerForLock,
  writeR17CheckpointAtomic,
  type R17ExecutionLock,
  type R17PerformanceExecutionLedger,
} from "../src/lib/research/m3-r17-round-017-checkpoints.ts";
import { R17_FOLD_IDS, M3_R17_PERFORMANCE_LEDGER_PATH } from "../src/lib/research/m3-r17-round-017-protocol.ts";

const EXECUTION_SOURCE_SHA = "84a31f9faf7fae077feed85157f8a891dffeaec9";
const OBSERVATION_DATASET_SHA = "9e73a52ca7f4a02acb20a0d32d807a739a1f6a76db92a2749bdc10aabca43ae2";
const CHECKPOINT_INPUT_HASHES = Object.freeze({ executionSourceSha: EXECUTION_SOURCE_SHA, observationDatasetSha256: OBSERVATION_DATASET_SHA, planSha256: "plan", gateSha256: "gate", conformanceSha256: "conformance" });

function testRoot(): string { return mkdtempSync(path.join(process.cwd(), ".r17-governance-test-")); }
function executionDirectory(root: string, executionId: string): string { return path.join(root, ".cache", "tradepulse", "round-017", "executions", executionId); }
function claim(root: string, executionId: string, directory = executionDirectory(root, executionId)) { return claimR17PerformanceExecution({ root, executionId, executionSourceSha: EXECUTION_SOURCE_SHA, observationDatasetSha256: OBSERVATION_DATASET_SHA, executionDirectory: directory }); }

function completeCheckpointState(root: string) {
  const first = claim(root, "r17-test-first");
  let ledger = first.ledger;
  for (const foldId of R17_FOLD_IDS) {
    writeR17CheckpointAtomic({ filePath: foldCheckpointPath(first.executionDirectory, foldId), kind: "FOLD", key: foldId, inputHashes: Object.freeze({ ...CHECKPOINT_INPUT_HASHES, foldId }), payload: Object.freeze({ foldId }) });
    ledger = recordR17PerformanceFoldCompleted({ root, expectedLedger: ledger, foldId });
  }
  writeR17CheckpointAtomic({ filePath: finalPerformanceCheckpointPath(first.executionDirectory), kind: "FINAL_PERFORMANCE", key: first.executionLock.executionId, inputHashes: CHECKPOINT_INPUT_HASHES, payload: Object.freeze({ marker: "synthetic-only" }) });
  ledger = markR17FinalCheckpointComplete({ root, expectedLedger: ledger });
  return { first, ledger };
}

describe("Round-017 round-global future performance governance", () => {
  it("creates one global lock, freezes its checkpoint root, and derives count from the ledger", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r17-test-first");
      expect(first.continuation).toBe(false);
      expect(first.ledgerPath).toBe(path.join(root, M3_R17_PERFORMANCE_LEDGER_PATH));
      expect(first.ledgerPath).not.toContain(`${path.sep}executions${path.sep}`);
      expect(first.ledger.authoritativeExecutionDirectory).toBe(".cache/tradepulse/round-017/executions/r17-test-first");
      expect(first.executionDirectory).toBe(executionDirectory(root, "r17-test-first"));
      expect(first.ledger.executions).toHaveLength(1);
      expect(deriveR17PerformanceExecutionCount(first.ledger)).toBe(1);
      expect(readR17PerformanceLedger(first.ledgerPath)).toEqual(first.ledger);
      expect(readdirSync(path.dirname(first.ledgerPath)).filter((entry) => entry.startsWith(".r17-performance-ledger-staging-")).length).toBe(0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("rejects the original executionId with a different execution directory", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r17-test-first");
      expect(() => claim(root, first.executionLock.executionId, path.join(root, "alternate-execution"))).toThrow(/directory does not match the round-global ledger/u);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("rejects every new executionId after the global lock even after outputs are deleted", () => {
    const root = testRoot();
    try {
      claim(root, "r17-test-first");
      const evidence = path.join(root, "docs", "evidence", "M3_R17_ROUND_017_SUMMARY.json");
      mkdirSync(path.dirname(evidence), { recursive: true });
      writeFileSync(evidence, "synthetic-only", { encoding: "utf8", flag: "w" });
      rmSync(evidence);
      expect(existsSync(evidence)).toBe(false);
      expect(() => claim(root, "r17-test-second")).toThrow(/already locked by executionId r17-test-first/u);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("allows crash continuation only for the original executionId and fixed directory", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r17-test-first");
      const continuation = claim(root, "r17-test-first");
      expect(continuation.continuation).toBe(true);
      expect(continuation.executionLock).toEqual(first.executionLock);
      expect(continuation.executionDirectory).toBe(first.executionDirectory);
      expect(() => claim(root, "r17-test-other")).toThrow(/only that executionId may continue/u);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("fails closed when the authoritative checkpoint directory is deleted", () => {
    const root = testRoot();
    try {
      const { first, ledger } = completeCheckpointState(root);
      rmSync(first.executionDirectory, { recursive: true, force: true });
      expect(() => validateR17CompletedCheckpoints({ root, ledger, executionDirectory: first.executionDirectory, inputHashes: CHECKPOINT_INPUT_HASHES, continuation: true })).toThrow(/checkpoint directory is missing/u);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("fails closed when a completed fold checkpoint is missing or corrupt", () => {
    const root = testRoot();
    try {
      const { first, ledger } = completeCheckpointState(root);
      rmSync(foldCheckpointPath(first.executionDirectory, "F3"));
      expect(() => validateR17CompletedCheckpoints({ root, ledger, executionDirectory: first.executionDirectory, inputHashes: CHECKPOINT_INPUT_HASHES, continuation: true })).toThrow(/completed fold checkpoint is missing/u);
      writeFileSync(foldCheckpointPath(first.executionDirectory, "F3"), "{}", "utf8");
      expect(() => validateR17CompletedCheckpoints({ root, ledger, executionDirectory: first.executionDirectory, inputHashes: CHECKPOINT_INPUT_HASHES, continuation: true })).toThrow(/incomplete or corrupt/u);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("accepts continuation with every existing checkpoint and final marker", () => {
    const root = testRoot();
    try {
      const { first, ledger } = completeCheckpointState(root);
      expect(() => validateR17CompletedCheckpoints({ root, ledger, executionDirectory: first.executionDirectory, inputHashes: CHECKPOINT_INPUT_HASHES, continuation: true })).not.toThrow();
      expect(ledger.completedFoldIds).toEqual([...R17_FOLD_IDS]);
      expect(ledger.finalCheckpointComplete).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("counts reused completed folds separately from recomputed folds", () => {
    expect(summarizeR17CompletedCheckpoints([true, false, true, false, true, true])).toEqual({ reusedCompletedCheckpoints: 4, recomputedCompletedCheckpoints: 2 });
    expect(summarizeR17CompletedCheckpoints([true, true, true, true, true, true])).toEqual({ reusedCompletedCheckpoints: 6, recomputedCompletedCheckpoints: 0 });
  });

  it("rejects forged multi-execution ledgers and mismatched locks before execution", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r17-test-first");
      const forged = { ...first.ledger, executions: [first.executionLock, { ...first.executionLock, executionId: "r17-forged-second" }] } as unknown as R17PerformanceExecutionLedger;
      expect(() => deriveR17PerformanceExecutionCount(forged)).toThrow(/exactly one round-global execution/u);
      const mismatched = { ...first.executionLock, executionId: "r17-forged-second" } as R17ExecutionLock;
      expect(() => validateR17ExecutionLedgerForLock(first.ledger, mismatched)).toThrow(/does not match the round-global ledger/u);
      expect(readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r17-round-017-checkpoints.ts"), "utf8")).not.toContain("performanceExecutionCount: 1");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("does not create an R17 ledger or checkpoint through the design-only runtime smoke", () => {
    expect(existsSync(path.join(process.cwd(), "docs", "research", "round-017-performance-ledger.json"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "scripts", "m3-r17-performance.ts"))).toBe(false);
  });
});
