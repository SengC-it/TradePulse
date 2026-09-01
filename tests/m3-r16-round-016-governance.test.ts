import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  claimR16PerformanceExecution,
  deriveR16PerformanceExecutionCount,
  readR16PerformanceLedger,
  roundGlobalPerformanceLedgerPath,
  validateR16ExecutionLedgerForLock,
  type R16ExecutionLock,
  type R16PerformanceExecutionLedger,
} from "../src/lib/research/m3-r16-round-016-checkpoints.ts";
import { summarizeR16CompletedCheckpoints } from "../src/lib/research/m3-r16-round-016-performance.ts";
import { R16_PERFORMANCE_LEDGER_PATH } from "../src/lib/research/m3-r16-round-016-protocol.ts";

const EXECUTION_SOURCE_SHA = "84a31f9faf7fae077feed85157f8a891dffeaec9";
const OBSERVATION_DATASET_SHA = "9e73a52ca7f4a02acb20a0d32d807a739a1f6a76db92a2749bdc10aabca43ae2";

function testRoot(): string {
  return mkdtempSync(path.join(process.cwd(), ".r16-governance-test-"));
}

function claim(root: string, executionId: string) {
  return claimR16PerformanceExecution({ root, executionId, executionSourceSha: EXECUTION_SOURCE_SHA, observationDatasetSha256: OBSERVATION_DATASET_SHA });
}

describe("Round-016 round-global performance governance", () => {
  it("creates one round-global lock and derives the execution count from its ledger", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r16-test-first");
      expect(first.continuation).toBe(false);
      expect(first.ledgerPath).toBe(path.join(root, R16_PERFORMANCE_LEDGER_PATH));
      expect(first.ledgerPath).not.toContain(`${path.sep}executions${path.sep}`);
      expect(existsSync(first.ledgerPath)).toBe(true);
      expect(first.ledger.executions).toHaveLength(1);
      expect(deriveR16PerformanceExecutionCount(first.ledger)).toBe(1);
      expect(readR16PerformanceLedger(first.ledgerPath)).toEqual(first.ledger);
      expect(readdirSync(path.dirname(first.ledgerPath)).filter((entry) => entry.startsWith(".r16-performance-ledger-staging-")).length).toBe(0);
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

  it("allows crash continuation only for the original executionId", () => {
    const root = testRoot();
    try {
      const first = claim(root, "r16-test-first");
      const continuation = claim(root, "r16-test-first");
      expect(continuation.continuation).toBe(true);
      expect(continuation.executionLock).toEqual(first.executionLock);
      expect(() => claim(root, "r16-test-other")).toThrow(/only that executionId may continue/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("counts reused completed folds separately from recomputed completed folds", () => {
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
      expect(performance).toContain("validateR16ExecutionLedgerForLock");
      expect(performance).not.toContain("performanceExecutionCount: 1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains the single existing authoritative Round-016 execution in the committed ledger", () => {
    const ledger = readR16PerformanceLedger(roundGlobalPerformanceLedgerPath(process.cwd()));
    expect(ledger.executions).toHaveLength(1);
    expect(ledger.executions[0]?.executionId).toBe("r16-b43de916-8b7e-4d5f-95e6-b4899da9060e");
    expect(deriveR16PerformanceExecutionCount(ledger)).toBe(1);
  });
});
