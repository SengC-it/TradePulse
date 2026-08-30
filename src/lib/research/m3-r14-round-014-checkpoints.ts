import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableStringify } from "./utils.ts";

export const R14_CHECKPOINT_SCHEMA_VERSION = "m3-r14-round-014-checkpoint-001" as const;
export const R14_COMPLETION_MARKER = "COMPLETE" as const;

export type R14CheckpointEnvelope<T> = Readonly<{
  schemaVersion: typeof R14_CHECKPOINT_SCHEMA_VERSION;
  kind: string;
  key: string;
  inputHashes: Readonly<Record<string, string>>;
  payload: T;
  outputSha256: string;
  completionMarker: typeof R14_COMPLETION_MARKER;
}>;

export type R14ExecutionLock = Readonly<{
  schemaVersion: "m3-r14-round-014-performance-lock-001";
  lock: "FIRST_M3_R14_PERFORMANCE_RESULT_GENERATED";
  roundId: "baseline-002-research-round-014";
  executionId: string;
  executionSourceSha: string;
  datasetIdentitySha256: string;
  manifestIdentitySha256: string;
  observationDatasetSha256: string;
  scientificSpecIdentitySha256: string;
  scientificSpecIdentity: Readonly<Record<string, unknown>>;
  createdAt: string;
  continuationCount: number;
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r+");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

/**
 * Writes a completed checkpoint using a staging directory on the same
 * filesystem as the destination. A checkpoint is either absent or complete;
 * callers never observe a partially written JSON file.
 */
export function writeR14CheckpointAtomic<T>(input: Readonly<{
  filePath: string;
  kind: string;
  key: string;
  inputHashes: Readonly<Record<string, string>>;
  payload: T;
  beforeCommit?: () => void;
}>): R14CheckpointEnvelope<T> {
  const target = path.resolve(input.filePath);
  if (existsSync(target)) return readR14Checkpoint<T>(target, input.inputHashes);
  const directory = path.dirname(target);
  mkdirSync(directory, { recursive: true });
  const staging = mkdtempSync(path.join(directory, ".r14-checkpoint-staging-"));
  const temporary = path.join(staging, path.basename(target));
  const envelope = Object.freeze({
    schemaVersion: R14_CHECKPOINT_SCHEMA_VERSION,
    kind: input.kind,
    key: input.key,
    inputHashes: input.inputHashes,
    payload: input.payload,
    outputSha256: hash(input.payload),
    completionMarker: R14_COMPLETION_MARKER,
  }) as R14CheckpointEnvelope<T>;
  try {
    writeFileSync(temporary, stableStringify(envelope), "utf8");
    fsyncFile(temporary);
    input.beforeCommit?.();
    if (existsSync(target)) throw new Error(`R14 checkpoint appeared during publication: ${target}`);
    renameSync(temporary, target);
    return envelope;
  } catch (error) {
    try { rmSync(staging, { recursive: true, force: true }); } catch { /* preserve the original checkpoint error */ }
    throw error;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR14Checkpoint<T>(filePath: string, inputHashes?: Readonly<Record<string, string>>): R14CheckpointEnvelope<T> {
  const parsed = JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as R14CheckpointEnvelope<T>;
  if (parsed.schemaVersion !== R14_CHECKPOINT_SCHEMA_VERSION || parsed.completionMarker !== R14_COMPLETION_MARKER || parsed.outputSha256 !== hash(parsed.payload)) throw new Error(`R14 checkpoint is incomplete or corrupt: ${filePath}`);
  if (inputHashes && stableStringify(parsed.inputHashes) !== stableStringify(inputHashes)) throw new Error(`R14 checkpoint input identity mismatch: ${filePath}`);
  return parsed;
}

export function checkpointExists(filePath: string): boolean {
  return existsSync(path.resolve(filePath));
}

export function newR14ExecutionId(): string {
  return `r14-${randomUUID()}`;
}

export function writeR14LockAtomic(filePath: string, lock: R14ExecutionLock): R14ExecutionLock {
  return writeR14CheckpointAtomic({ filePath, kind: "PERFORMANCE_LOCK", key: lock.executionId, inputHashes: { executionSourceSha: lock.executionSourceSha, datasetIdentitySha256: lock.datasetIdentitySha256, observationDatasetSha256: lock.observationDatasetSha256, scientificSpecIdentitySha256: lock.scientificSpecIdentitySha256 }, payload: lock }).payload;
}

export function readR14Lock(filePath: string): R14ExecutionLock {
  return readR14Checkpoint<R14ExecutionLock>(filePath).payload;
}

export function executionLockPath(executionDirectory: string): string {
  return path.join(path.resolve(executionDirectory), "performance-lock.json");
}

export function modelCheckpointPath(executionDirectory: string, horizonHours: number, foldId: string): string {
  return path.join(path.resolve(executionDirectory), "models", `H${horizonHours}`, `${foldId}.json`);
}

export function horizonCheckpointPath(executionDirectory: string, horizonHours: number): string {
  return path.join(path.resolve(executionDirectory), "horizons", `H${horizonHours}.json`);
}

export function selectionCheckpointPath(executionDirectory: string): string {
  return path.join(path.resolve(executionDirectory), "selection", "selection.json");
}

export { hash as r14CheckpointHash };
