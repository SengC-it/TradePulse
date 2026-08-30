import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableStringify } from "./utils.ts";

export const R15_CHECKPOINT_SCHEMA_VERSION = "m3-r15-round-015-checkpoint-001" as const;

export type R15CheckpointEnvelope<T> = Readonly<{
  schemaVersion: typeof R15_CHECKPOINT_SCHEMA_VERSION;
  kind: string;
  key: string;
  inputHashes: Readonly<Record<string, string>>;
  payload: T;
  outputSha256: string;
  completionMarker: "COMPLETE";
}>;

export type R15ExecutionLock = Readonly<{
  schemaVersion: "m3-r15-round-015-performance-lock-001";
  lock: "FIRST_M3_R15_PERFORMANCE_RESULT_GENERATED";
  researchRoundId: "baseline-002-research-round-015";
  executionId: string;
  executionSourceSha: string;
  observationDatasetSha256: string;
  createdAt: string;
  continuationCount: number;
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r+");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

export function writeR15CheckpointAtomic<T>(input: Readonly<{ filePath: string; kind: string; key: string; inputHashes: Readonly<Record<string, string>>; payload: T; beforeCommit?: () => void }>): R15CheckpointEnvelope<T> {
  const target = path.resolve(input.filePath);
  if (existsSync(target)) return readR15Checkpoint<T>(target, input.inputHashes);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r15-checkpoint-staging-"));
  const temporary = path.join(staging, path.basename(target));
  const envelope = Object.freeze({ schemaVersion: R15_CHECKPOINT_SCHEMA_VERSION, kind: input.kind, key: input.key, inputHashes: input.inputHashes, payload: input.payload, outputSha256: hash(input.payload), completionMarker: "COMPLETE" as const }) as R15CheckpointEnvelope<T>;
  try {
    writeFileSync(temporary, stableStringify(envelope), "utf8");
    fsyncFile(temporary);
    input.beforeCommit?.();
    if (existsSync(target)) throw new Error(`R15 checkpoint appeared during publication: ${target}`);
    renameSync(temporary, target);
    return envelope;
  } catch (error) {
    try { rmSync(staging, { recursive: true, force: true }); } catch { /* preserve the primary checkpoint error */ }
    throw error;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR15Checkpoint<T>(filePath: string, inputHashes?: Readonly<Record<string, string>>): R15CheckpointEnvelope<T> {
  const parsed = JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as R15CheckpointEnvelope<T>;
  if (parsed.schemaVersion !== R15_CHECKPOINT_SCHEMA_VERSION || parsed.completionMarker !== "COMPLETE" || parsed.outputSha256 !== hash(parsed.payload)) throw new Error(`R15 checkpoint is incomplete or corrupt: ${filePath}`);
  if (inputHashes && stableStringify(parsed.inputHashes) !== stableStringify(inputHashes)) throw new Error(`R15 checkpoint input identity mismatch: ${filePath}`);
  return parsed;
}

export function checkpointExists(filePath: string): boolean { return existsSync(path.resolve(filePath)); }

export function newR15ExecutionId(): string { return `r15-${randomUUID()}`; }

export function executionLockPath(executionDirectory: string): string { return path.join(path.resolve(executionDirectory), "performance-lock.json"); }
export function foldCheckpointPath(executionDirectory: string, foldId: string): string { return path.join(path.resolve(executionDirectory), "folds", `${foldId}.json`); }
export function finalPerformanceCheckpointPath(executionDirectory: string): string { return path.join(path.resolve(executionDirectory), "performance.json"); }

export function writeR15LockAtomic(filePath: string, lock: R15ExecutionLock): R15ExecutionLock { return writeR15CheckpointAtomic({ filePath, kind: "PERFORMANCE_LOCK", key: lock.executionId, inputHashes: { executionSourceSha: lock.executionSourceSha, observationDatasetSha256: lock.observationDatasetSha256 }, payload: lock }).payload; }
export function readR15Lock(filePath: string): R15ExecutionLock { return readR15Checkpoint<R15ExecutionLock>(filePath).payload; }

export { hash as r15CheckpointHash };
