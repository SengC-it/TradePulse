import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableStringify } from "./utils.ts";

export const R16_CHECKPOINT_SCHEMA_VERSION = "m3-r16-round-016-checkpoint-001" as const;

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
export function executionLockPath(directory: string): string { return path.join(path.resolve(directory), "performance-lock.json"); }
export function foldCheckpointPath(directory: string, foldId: string): string { return path.join(path.resolve(directory), "folds", `${foldId}.json`); }
export function finalPerformanceCheckpointPath(directory: string): string { return path.join(path.resolve(directory), "performance.json"); }
export function writeR16LockAtomic(filePath: string, lock: R16ExecutionLock): R16ExecutionLock {
  return writeR16CheckpointAtomic({ filePath, kind: "PERFORMANCE_LOCK", key: lock.executionId, inputHashes: { executionSourceSha: lock.executionSourceSha, observationDatasetSha256: lock.observationDatasetSha256 }, payload: lock }).payload;
}
export function readR16Lock(filePath: string): R16ExecutionLock { return readR16Checkpoint<R16ExecutionLock>(filePath).payload; }
