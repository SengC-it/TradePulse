import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  claimR16PerformanceExecution,
  deriveR16PerformanceExecutionCount,
  finalPerformanceCheckpointPath,
  foldCheckpointPath,
  markR16FinalCheckpointComplete,
  readR16PerformanceLedger,
  recordR16PerformanceFoldCompleted,
  roundGlobalPerformanceLedgerPath,
  validateR16CompletedCheckpoints,
  validateR16ExecutionLedgerForLock,
  writeR16CheckpointAtomic,
  type R16ExecutionLock,
  type R16PerformanceExecutionLedger,
} from "../src/lib/research/m3-r16-round-016-checkpoints.ts";
import { summarizeR16CompletedCheckpoints } from "../src/lib/research/m3-r16-round-016-performance.ts";
import { R16_FOLD_IDS, R16_PERFORMANCE_LEDGER_PATH } from "../src/lib/research/m3-r16-round-016-protocol.ts";

const EXECUTION_SOURCE_SHA = "84a31f9faf7fae077feed85157f8a891dffeaec9";
const OBSERVATION_DATASET_SHA = "9e73a52ca7f4a02acb20a0d32d807a739a1f6a76db92a2749bdc10aabca43ae2";
const CHECKPOINT_INPUT_HASHES = Object.freeze({ executionSourceSha: EXECUTION_SOURCE_SHA, observationDatasetSha256: OBSERVATION_DATASET_SHA, planSha256: "plan", gateSha256: "gate", conformanceSha256: "conformance" });

function testRoot(): string {
  return mkdtempSync(path.join(process.cwd(), ".r16-governance-test-"));
}

function executionDirectory(root: string, executionId: string): string {
  return path.join(root, ".cache", "tradepulse", "round-016", "executions", executionId);
}

function claim(root: string, executionId: string, directory = executionDirectory(root, executionId)) {
  return claimR16PerformanceExecution({ root, executionId, executionSourceSha: EXECUTION_SOURCE_SHA, observationDatasetSha256: OBSERVATION_DATASET_SHA, executionDirectory: directory });
}

function completeCheckpointState(root: string) {
  const first = claim(root, "r16-test-first");
  let ledger = first.ledger;
  for (const foldId of R16_FOLD_IDS) {
    writeR16CheckpointAtomic({ filePath: foldCheckpointPath(first.executionDirectory, foldId), kind: "FOLD", key: foldId, inputHashes: Object.freeze({ ...CHECKPOINT_INPUT_HASHES, foldId }), payload: Object.freeze({ foldId }) });
    ledger = recordR16PerformanceFoldCompleted({ root, expectedLedger: ledger, foldId });
  }
  writeR16CheckpointAtomic({ filePath: finalPerformanceCheckpointPath(first.executionDirectory), kind: "FINAL_PERFORMANCE", key: first.executionLock.executionId, inputHashes: CHECKPOINT_INPUT_HASHES, payload: Object.freeze({ report: Object.freeze({ marker: "test" }) }) });
  ledger = markR16FinalCheckpointComplete({ root, expectedLedger: ledger });
  return { first, ledger };
}

describe("Round-016 round-global performance governance", () => {
  it("creates one global lock, freezes its checkpoint root, and derives count from the ledger", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r16-test-first");
      expect(first.continuation).toBe(false);
      expect(first.ledgerPath).toBe(path.join(root, R16_PERFORMANCE_LEDGER_PATH));
      expect(first.ledgerPath).not.toContain(`${path.sep}executions${path.sep}`);
      expect(first.ledger.authoritativeExecutionDirectory).toBe(".cache/tradepulse/round-016/executions/r16-test-first");
      expect(first.executionDirectory).toBe(executionDirectory(root, "r16-test-first"));
      expect(existsSync(first.ledgerPath)).toBe(true);
      expect(first.ledger.executions).toHaveLength(1);
      expect(deriveR16PerformanceExecutionCount(first.ledger)).toBe(1);
      expect(readR16PerformanceLedger(first.ledgerPath)).toEqual(first.ledger);
      expect(readdirSync(path.dirname(first.ledgerPath)).filter((entry) => entry.startsWith(".r16-performance-ledger-staging-")).length).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects the original executionId with a different execution directory", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r16-test-first");
      expect(() => claim(root, first.executionLock.executionId, path.join(root, "alternate-execution"))).toThrow(/directory does not match the round-global ledger/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects every new executionId after the global lock, including after evidence deletion", () => {
    const root = testRoot();
    try {
      claim(root, "r16-test-first");
      const evidence = path.join(root, "docs", "evidence", "M3_R16_ROUND_016_SUMMARY.json");
      mkdirSync(path.dirname(evidence), { recursive: true });
      writeFileSync(evidence, "authoritative-evidence", "utf8");
      rmSync(evidence);
      expect(existsSync(evidence)).toBe(false);
      expect(() => claim(root, "r16-test-second")).toThrow(/already locked by executionId r16-test-first/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows crash continuation only for the original executionId and fixed directory", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r16-test-first");
      const continuation = claim(root, "r16-test-first");
      expect(continuation.continuation).toBe(true);
      expect(continuation.executionLock).toEqual(first.executionLock);
      expect(continuation.executionDirectory).toBe(first.executionDirectory);
      expect(() => claim(root, "r16-test-other")).toThrow(/only that executionId may continue/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when the authoritative checkpoint directory is deleted instead of rebuilding", () => {
    const root = testRoot();
    try {
      const { first, ledger } = completeCheckpointState(root);
      rmSync(first.executionDirectory, { recursive: true, force: true });
      expect(() => validateR16CompletedCheckpoints({ root, ledger, executionDirectory: first.executionDirectory, inputHashes: CHECKPOINT_INPUT_HASHES, continuation: true })).toThrow(/checkpoint directory is missing/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a completed fold checkpoint is missing or corrupt", () => {
    const root = testRoot();
    try {
      const { first, ledger } = completeCheckpointState(root);
      rmSync(foldCheckpointPath(first.executionDirectory, "F3"));
      expect(() => validateR16CompletedCheckpoints({ root, ledger, executionDirectory: first.executionDirectory, inputHashes: CHECKPOINT_INPUT_HASHES, continuation: true })).toThrow(/completed fold checkpoint is missing/u);

      writeFileSync(foldCheckpointPath(first.executionDirectory, "F3"), "{}", "utf8");
      expect(() => validateR16CompletedCheckpoints({ root, ledger, executionDirectory: first.executionDirectory, inputHashes: CHECKPOINT_INPUT_HASHES, continuation: true })).toThrow(/incomplete or corrupt/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts continuation with every existing checkpoint and final marker", () => {
    const root = testRoot();
    try {
      const { first, ledger } = completeCheckpointState(root);
      expect(() => validateR16CompletedCheckpoints({ root, ledger, executionDirectory: first.executionDirectory, inputHashes: CHECKPOINT_INPUT_HASHES, continuation: true })).not.toThrow();
      expect(ledger.completedFoldIds).toEqual([...R16_FOLD_IDS]);
      expect(ledger.finalCheckpointComplete).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("counts reused completed folds separately from recomputed folds", () => {
    expect(summarizeR16CompletedCheckpoints([true, false, true, false, true, true])).toEqual({ reusedCompletedCheckpoints: 4, recomputedCompletedCheckpoints: 2 });
    expect(summarizeR16CompletedCheckpoints([true, true, true, true, true, true])).toEqual({ reusedCompletedCheckpoints: 6, recomputedCompletedCheckpoints: 0 });
  });

  it("rejects forged multi-execution ledgers and mismatched execution locks before execution", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r16-test-first");
      const forged = { ...first.ledger, executions: [first.executionLock, { ...first.executionLock, executionId: "r16-forged-second" }] } as unknown as R16PerformanceExecutionLedger;
      expect(() => deriveR16PerformanceExecutionCount(forged)).toThrow(/exactly one round-global execution/u);
      const mismatched = { ...first.executionLock, executionId: "r16-forged-second" } as R16ExecutionLock;
      expect(() => validateR16ExecutionLedgerForLock(first.ledger, mismatched)).toThrow(/does not match the round-global ledger/u);

      const performance = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r16-round-016-performance.ts"), "utf8");
      const script = readFileSync(path.join(process.cwd(), "scripts", "m3-r16-performance.ts"), "utf8");
      expect(performance).toContain("validateR16CompletedCheckpoints");
      expect(performance.indexOf("validateR16CompletedCheckpoints({")).toBeLessThan(performance.indexOf("const rows = await collectRows"));
      expect(performance).toContain("recordR16PerformanceFoldCompleted");
      expect(performance).not.toContain("performanceExecutionCount: 1");
      expect(script).toContain("does not accept --execution-directory");
      expect(script).not.toContain('argument("--execution-directory")');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains the single existing authoritative Round-016 execution and completed checkpoint identity", () => {
    const ledger = readR16PerformanceLedger(roundGlobalPerformanceLedgerPath(process.cwd()));
    expect(ledger.executions).toHaveLength(1);
    expect(ledger.executions[0]?.executionId).toBe("r16-b43de916-8b7e-4d5f-95e6-b4899da9060e");
    expect(ledger.authoritativeExecutionDirectory).toBe(".cache/tradepulse/round-016/executions/r16-b43de916-8b7e-4d5f-95e6-b4899da9060e");
    expect(ledger.completedFoldIds).toEqual([...R16_FOLD_IDS]);
    expect(ledger.finalCheckpointComplete).toBe(true);
    expect(deriveR16PerformanceExecutionCount(ledger)).toBe(1);
  });
});
