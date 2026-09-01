import { createHash, randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { M3_R16_PERFORMANCE_LOCK, M3_R16_RESEARCH_ROUND_ID, R16_PERFORMANCE_LEDGER_PATH } from "./m3-r16-round-016-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R16_CHECKPOINT_SCHEMA_VERSION = "m3-r16-round-016-checkpoint-001" as const;
export const R16_PERFORMANCE_LEDGER_SCHEMA_VERSION = "m3-r16-round-016-performance-ledger-001" as const;

export type R16CheckpointEnvelope<T> = Readonly<{
  schemaVersion: typeof R16_CHECKPOINT_SCHEMA_VERSION;
  kind: string;
  key: string;
  inputHashes: Readonly<Record<string, string>>;
  payload: T;
  outputSha256: string;
  completionMarker: "COMPLETE";
}>;

export type R16ExecutionLock = Readonly<{
  schemaVersion: "m3-r16-round-016-performance-lock-001";
  lock: "FIRST_M3_R16_PERFORMANCE_RESULT_GENERATED";
  researchRoundId: "baseline-002-research-round-016";
  executionId: string;
  executionSourceSha: string;
  observationDatasetSha256: string;
  createdAt: string;
  continuationCount: number;
}>;

export type R16PerformanceExecutionLedger = Readonly<{
  schemaVersion: typeof R16_PERFORMANCE_LEDGER_SCHEMA_VERSION;
  lock: typeof M3_R16_PERFORMANCE_LOCK;
  researchRoundId: typeof M3_R16_RESEARCH_ROUND_ID;
  executions: readonly R16ExecutionLock[];
}>;

export type R16PerformanceExecutionClaim = Readonly<{
  ledger: R16PerformanceExecutionLedger;
  executionLock: R16ExecutionLock;
  continuation: boolean;
  ledgerPath: string;
}>;

function hash(value: unknown): string { return createHash("sha256").update(stableStringify(value), "utf8").digest("hex"); }

export function writeR16CheckpointAtomic<T>(input: Readonly<{ filePath: string; kind: string; key: string; inputHashes: Readonly<Record<string, string>>; payload: T }>): R16CheckpointEnvelope<T> {
  const target = path.resolve(input.filePath);
  if (existsSync(target)) return readR16Checkpoint<T>(target, input.inputHashes);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r16-checkpoint-staging-"));
  const temporary = path.join(staging, path.basename(target));
  const envelope = Object.freeze({ schemaVersion: R16_CHECKPOINT_SCHEMA_VERSION, kind: input.kind, key: input.key, inputHashes: input.inputHashes, payload: input.payload, outputSha256: hash(input.payload), completionMarker: "COMPLETE" as const }) as R16CheckpointEnvelope<T>;
  try {
    writeFileSync(temporary, stableStringify(envelope), "utf8");
    if (existsSync(target)) throw new Error(`R16 checkpoint appeared during publication: ${target}`);
    renameSync(temporary, target);
    return envelope;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR16Checkpoint<T>(filePath: string, inputHashes?: Readonly<Record<string, string>>): R16CheckpointEnvelope<T> {
  const parsed = JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as R16CheckpointEnvelope<T>;
  if (parsed.schemaVersion !== R16_CHECKPOINT_SCHEMA_VERSION || parsed.completionMarker !== "COMPLETE" || parsed.outputSha256 !== hash(parsed.payload)) throw new Error(`R16 checkpoint is incomplete or corrupt: ${filePath}`);
  if (inputHashes && stableStringify(parsed.inputHashes) !== stableStringify(inputHashes)) throw new Error(`R16 checkpoint input identity mismatch: ${filePath}`);
  return parsed;
}

export function checkpointExists(filePath: string): boolean { return existsSync(path.resolve(filePath)); }
export function newR16ExecutionId(): string { return `r16-${randomUUID()}`; }
export function foldCheckpointPath(directory: string, foldId: string): string { return path.join(path.resolve(directory), "folds", `${foldId}.json`); }
export function finalPerformanceCheckpointPath(directory: string): string { return path.join(path.resolve(directory), "performance.json"); }

export function roundGlobalPerformanceLedgerPath(root: string): string { return path.join(path.resolve(root), R16_PERFORMANCE_LEDGER_PATH); }

function validateExecutionLock(lock: R16ExecutionLock): R16ExecutionLock {
  if (lock.schemaVersion !== "m3-r16-round-016-performance-lock-001" || lock.lock !== M3_R16_PERFORMANCE_LOCK || lock.researchRoundId !== M3_R16_RESEARCH_ROUND_ID || !lock.executionId || !lock.executionSourceSha || !lock.observationDatasetSha256 || !Number.isInteger(lock.continuationCount) || lock.continuationCount < 0) throw new Error("R16 performance execution lock is invalid.");
  return lock;
}

function validatePerformanceExecutionLedger(ledger: R16PerformanceExecutionLedger): R16PerformanceExecutionLedger {
  if (ledger.schemaVersion !== R16_PERFORMANCE_LEDGER_SCHEMA_VERSION || ledger.lock !== M3_R16_PERFORMANCE_LOCK || ledger.researchRoundId !== M3_R16_RESEARCH_ROUND_ID || !Array.isArray(ledger.executions) || ledger.executions.length !== 1) throw new Error("R16 performance ledger must contain exactly one round-global execution.");
  validateExecutionLock(ledger.executions[0]!);
  return ledger;
}

function ledgerEnvelope(ledger: R16PerformanceExecutionLedger): R16CheckpointEnvelope<R16PerformanceExecutionLedger> {
  return Object.freeze({ schemaVersion: R16_CHECKPOINT_SCHEMA_VERSION, kind: "PERFORMANCE_LEDGER", key: M3_R16_RESEARCH_ROUND_ID, inputHashes: {}, payload: ledger, outputSha256: hash(ledger), completionMarker: "COMPLETE" as const });
}

function writePerformanceLedgerExclusive(filePath: string, ledger: R16PerformanceExecutionLedger): void {
  const target = path.resolve(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r16-performance-ledger-staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(ledgerEnvelope(ledger)), "utf8");
    linkSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR16PerformanceLedger(filePath: string): R16PerformanceExecutionLedger {
  const envelope = readR16Checkpoint<R16PerformanceExecutionLedger>(filePath);
  if (envelope.kind !== "PERFORMANCE_LEDGER" || envelope.key !== M3_R16_RESEARCH_ROUND_ID) throw new Error(`R16 performance ledger kind is invalid: ${filePath}`);
  return validatePerformanceExecutionLedger(envelope.payload);
}

export function deriveR16PerformanceExecutionCount(ledger: R16PerformanceExecutionLedger): number {
  return validatePerformanceExecutionLedger(ledger).executions.length;
}

export function claimR16PerformanceExecution(input: Readonly<{ root: string; executionId: string; executionSourceSha: string; observationDatasetSha256: string }>): R16PerformanceExecutionClaim {
  if (!input.executionId || !input.executionSourceSha || !input.observationDatasetSha256) throw new Error("R16 performance execution identity is required.");
  const ledgerPath = roundGlobalPerformanceLedgerPath(input.root);
  if (existsSync(ledgerPath)) {
    const ledger = readR16PerformanceLedger(ledgerPath);
    const existing = ledger.executions[0]!;
    if (existing.executionId !== input.executionId || existing.executionSourceSha !== input.executionSourceSha || existing.observationDatasetSha256 !== input.observationDatasetSha256) throw new Error(`R16 performance is already locked by executionId ${existing.executionId}; only that executionId may continue.`);
    return Object.freeze({ ledger, executionLock: existing, continuation: true, ledgerPath });
  }

  const executionLock = Object.freeze({ schemaVersion: "m3-r16-round-016-performance-lock-001" as const, lock: M3_R16_PERFORMANCE_LOCK, researchRoundId: M3_R16_RESEARCH_ROUND_ID, executionId: input.executionId, executionSourceSha: input.executionSourceSha, observationDatasetSha256: input.observationDatasetSha256, createdAt: new Date().toISOString(), continuationCount: 0 });
  const ledger = Object.freeze({ schemaVersion: R16_PERFORMANCE_LEDGER_SCHEMA_VERSION, lock: M3_R16_PERFORMANCE_LOCK, researchRoundId: M3_R16_RESEARCH_ROUND_ID, executions: Object.freeze([executionLock]) });
  try {
    writePerformanceLedgerExclusive(ledgerPath, ledger);
    return Object.freeze({ ledger, executionLock, continuation: false, ledgerPath });
  } catch (error) {
    if (!existsSync(ledgerPath)) throw error;
    const existingLedger = readR16PerformanceLedger(ledgerPath);
    const existing = existingLedger.executions[0]!;
    if (existing.executionId !== input.executionId || existing.executionSourceSha !== input.executionSourceSha || existing.observationDatasetSha256 !== input.observationDatasetSha256) throw new Error(`R16 performance is already locked by executionId ${existing.executionId}; only that executionId may continue.`);
    return Object.freeze({ ledger: existingLedger, executionLock: existing, continuation: true, ledgerPath });
  }
}

export function validateR16ExecutionLedgerForLock(ledger: R16PerformanceExecutionLedger, executionLock: R16ExecutionLock): number {
  const count = deriveR16PerformanceExecutionCount(ledger);
  const stored = ledger.executions[0]!;
  if (stored.executionId !== executionLock.executionId || stored.executionSourceSha !== executionLock.executionSourceSha || stored.observationDatasetSha256 !== executionLock.observationDatasetSha256) throw new Error("R16 performance execution does not match the round-global ledger.");
  return count;
}
