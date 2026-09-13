import { createHash, randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { R17_FOLD_IDS, M3_R17_PERFORMANCE_LOCK, M3_R17_PERFORMANCE_LEDGER_PATH, M3_R17_RESEARCH_ROUND_ID, type R17FoldId } from "./m3-r17-round-017-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R17_CHECKPOINT_SCHEMA_VERSION = "m3-r17-round-017-checkpoint-001" as const;
export const R17_PERFORMANCE_LEDGER_SCHEMA_VERSION = "m3-r17-round-017-performance-ledger-001" as const;

export type R17CheckpointEnvelope<T> = Readonly<{
  schemaVersion: typeof R17_CHECKPOINT_SCHEMA_VERSION;
  kind: string;
  key: string;
  inputHashes: Readonly<Record<string, string>>;
  payload: T;
  outputSha256: string;
  completionMarker: "COMPLETE";
}>;

export type R17ExecutionLock = Readonly<{
  schemaVersion: "m3-r17-round-017-performance-lock-001";
  lock: typeof M3_R17_PERFORMANCE_LOCK;
  researchRoundId: typeof M3_R17_RESEARCH_ROUND_ID;
  executionId: string;
  executionSourceSha: string;
  observationDatasetSha256: string;
  createdAt: string;
  continuationCount: number;
}>;

export type R17PerformanceExecutionLedger = Readonly<{
  schemaVersion: typeof R17_PERFORMANCE_LEDGER_SCHEMA_VERSION;
  lock: typeof M3_R17_PERFORMANCE_LOCK;
  researchRoundId: typeof M3_R17_RESEARCH_ROUND_ID;
  authoritativeExecutionDirectory: string;
  completedFoldIds: readonly R17FoldId[];
  finalCheckpointComplete: boolean;
  executions: readonly R17ExecutionLock[];
}>;

export type R17PerformanceExecutionClaim = Readonly<{
  ledger: R17PerformanceExecutionLedger;
  executionLock: R17ExecutionLock;
  continuation: boolean;
  ledgerPath: string;
  executionDirectory: string;
}>;

function hash(value: unknown): string { return createHash("sha256").update(stableStringify(value), "utf8").digest("hex"); }

export function writeR17CheckpointAtomic<T>(input: Readonly<{ filePath: string; kind: string; key: string; inputHashes: Readonly<Record<string, string>>; payload: T }>): R17CheckpointEnvelope<T> {
  const target = path.resolve(input.filePath);
  if (existsSync(target)) return readR17Checkpoint<T>(target, input.inputHashes);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r17-checkpoint-staging-"));
  const temporary = path.join(staging, path.basename(target));
  const envelope = Object.freeze({ schemaVersion: R17_CHECKPOINT_SCHEMA_VERSION, kind: input.kind, key: input.key, inputHashes: input.inputHashes, payload: input.payload, outputSha256: hash(input.payload), completionMarker: "COMPLETE" as const }) as R17CheckpointEnvelope<T>;
  try {
    writeFileSync(temporary, stableStringify(envelope), "utf8");
    if (existsSync(target)) throw new Error(`R17 checkpoint appeared during publication: ${target}`);
    renameSync(temporary, target);
    return envelope;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR17Checkpoint<T>(filePath: string, inputHashes?: Readonly<Record<string, string>>): R17CheckpointEnvelope<T> {
  const parsed = JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as R17CheckpointEnvelope<T>;
  if (parsed.schemaVersion !== R17_CHECKPOINT_SCHEMA_VERSION || parsed.completionMarker !== "COMPLETE" || parsed.outputSha256 !== hash(parsed.payload)) throw new Error(`R17 checkpoint is incomplete or corrupt: ${filePath}`);
  if (inputHashes && stableStringify(parsed.inputHashes) !== stableStringify(inputHashes)) throw new Error(`R17 checkpoint input identity mismatch: ${filePath}`);
  return parsed;
}

export function checkpointExists(filePath: string): boolean { return existsSync(path.resolve(filePath)); }
export function newR17ExecutionId(): string { return `r17-${randomUUID()}`; }
export function foldCheckpointPath(directory: string, foldId: R17FoldId): string { return path.join(path.resolve(directory), "folds", `${foldId}.json`); }
export function finalPerformanceCheckpointPath(directory: string): string { return path.join(path.resolve(directory), "performance.json"); }
export function roundGlobalPerformanceLedgerPath(root: string): string { return path.join(path.resolve(root), M3_R17_PERFORMANCE_LEDGER_PATH); }

function repositoryRelativePath(root: string, candidate: string): string {
  const rootPath = path.resolve(root);
  const candidatePath = path.resolve(candidate);
  const relative = path.relative(rootPath, candidatePath).split(path.sep).join("/");
  if (!relative || relative === "." || relative.startsWith("../") || relative.includes("/../") || relative.endsWith("/..") || path.isAbsolute(relative)) throw new Error("R17 authoritative execution directory must be inside the repository root.");
  return relative;
}

function validateStoredExecutionDirectory(value: string): string {
  if (!value || value.includes("\\") || path.isAbsolute(value) || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) throw new Error("R17 performance ledger execution directory must be a normalized repository-relative path.");
  return value;
}

export function resolveR17AuthoritativeExecutionDirectory(root: string, ledger: R17PerformanceExecutionLedger): string {
  return path.resolve(root, validateStoredExecutionDirectory(ledger.authoritativeExecutionDirectory));
}

function validateExecutionLock(lock: R17ExecutionLock): R17ExecutionLock {
  if (lock.schemaVersion !== "m3-r17-round-017-performance-lock-001" || lock.lock !== M3_R17_PERFORMANCE_LOCK || lock.researchRoundId !== M3_R17_RESEARCH_ROUND_ID || !lock.executionId || !lock.executionSourceSha || !lock.observationDatasetSha256 || !Number.isInteger(lock.continuationCount) || lock.continuationCount < 0) throw new Error("R17 performance execution lock is invalid.");
  return lock;
}

function validatePerformanceExecutionLedger(ledger: R17PerformanceExecutionLedger): R17PerformanceExecutionLedger {
  if (ledger.schemaVersion !== R17_PERFORMANCE_LEDGER_SCHEMA_VERSION || ledger.lock !== M3_R17_PERFORMANCE_LOCK || ledger.researchRoundId !== M3_R17_RESEARCH_ROUND_ID || !Array.isArray(ledger.executions) || ledger.executions.length !== 1 || !Array.isArray(ledger.completedFoldIds) || typeof ledger.finalCheckpointComplete !== "boolean") throw new Error("R17 performance ledger must contain exactly one round-global execution and checkpoint state.");
  validateStoredExecutionDirectory(ledger.authoritativeExecutionDirectory);
  const completed = new Set<R17FoldId>();
  for (const foldId of ledger.completedFoldIds) {
    if (!R17_FOLD_IDS.includes(foldId) || completed.has(foldId)) throw new Error("R17 performance ledger contains an invalid or duplicate completed fold.");
    completed.add(foldId);
  }
  if (ledger.finalCheckpointComplete && completed.size !== R17_FOLD_IDS.length) throw new Error("R17 performance ledger cannot mark the final checkpoint complete before every fold is complete.");
  validateExecutionLock(ledger.executions[0]!);
  return ledger;
}

function ledgerEnvelope(ledger: R17PerformanceExecutionLedger): R17CheckpointEnvelope<R17PerformanceExecutionLedger> {
  return Object.freeze({ schemaVersion: R17_CHECKPOINT_SCHEMA_VERSION, kind: "PERFORMANCE_LEDGER", key: M3_R17_RESEARCH_ROUND_ID, inputHashes: {}, payload: ledger, outputSha256: hash(ledger), completionMarker: "COMPLETE" as const });
}

function writePerformanceLedgerExclusive(filePath: string, ledger: R17PerformanceExecutionLedger): void {
  const target = path.resolve(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r17-performance-ledger-staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(ledgerEnvelope(ledger)), "utf8");
    linkSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR17PerformanceLedger(filePath: string): R17PerformanceExecutionLedger {
  const envelope = readR17Checkpoint<R17PerformanceExecutionLedger>(filePath);
  if (envelope.kind !== "PERFORMANCE_LEDGER" || envelope.key !== M3_R17_RESEARCH_ROUND_ID) throw new Error(`R17 performance ledger kind is invalid: ${filePath}`);
  return validatePerformanceExecutionLedger(envelope.payload);
}

export function deriveR17PerformanceExecutionCount(ledger: R17PerformanceExecutionLedger): number {
  return validatePerformanceExecutionLedger(ledger).executions.length;
}

function claimAgainstLedger(input: Readonly<{ root: string; executionId: string; executionSourceSha: string; observationDatasetSha256: string; executionDirectory: string }>, ledger: R17PerformanceExecutionLedger, ledgerPath: string): R17PerformanceExecutionClaim {
  const requestedDirectory = repositoryRelativePath(input.root, input.executionDirectory);
  const existing = ledger.executions[0]!;
  if (existing.executionId !== input.executionId || existing.executionSourceSha !== input.executionSourceSha || existing.observationDatasetSha256 !== input.observationDatasetSha256) throw new Error(`R17 performance is already locked by executionId ${existing.executionId}; only that executionId may continue.`);
  if (ledger.authoritativeExecutionDirectory !== requestedDirectory) throw new Error(`R17 authoritative execution directory does not match the round-global ledger: expected ${ledger.authoritativeExecutionDirectory}.`);
  return Object.freeze({ ledger, executionLock: existing, continuation: true, ledgerPath, executionDirectory: resolveR17AuthoritativeExecutionDirectory(input.root, ledger) });
}

export function claimR17PerformanceExecution(input: Readonly<{ root: string; executionId: string; executionSourceSha: string; observationDatasetSha256: string; executionDirectory: string }>): R17PerformanceExecutionClaim {
  if (!input.executionId || !input.executionSourceSha || !input.observationDatasetSha256) throw new Error("R17 performance execution identity is required.");
  const ledgerPath = roundGlobalPerformanceLedgerPath(input.root);
  if (existsSync(ledgerPath)) return claimAgainstLedger(input, readR17PerformanceLedger(ledgerPath), ledgerPath);
  const executionLock = Object.freeze({ schemaVersion: "m3-r17-round-017-performance-lock-001" as const, lock: M3_R17_PERFORMANCE_LOCK, researchRoundId: M3_R17_RESEARCH_ROUND_ID, executionId: input.executionId, executionSourceSha: input.executionSourceSha, observationDatasetSha256: input.observationDatasetSha256, createdAt: new Date().toISOString(), continuationCount: 0 });
  const ledger = Object.freeze({ schemaVersion: R17_PERFORMANCE_LEDGER_SCHEMA_VERSION, lock: M3_R17_PERFORMANCE_LOCK, researchRoundId: M3_R17_RESEARCH_ROUND_ID, authoritativeExecutionDirectory: repositoryRelativePath(input.root, input.executionDirectory), completedFoldIds: Object.freeze([]), finalCheckpointComplete: false, executions: Object.freeze([executionLock]) });
  try {
    writePerformanceLedgerExclusive(ledgerPath, ledger);
    return Object.freeze({ ledger, executionLock, continuation: false, ledgerPath, executionDirectory: resolveR17AuthoritativeExecutionDirectory(input.root, ledger) });
  } catch (error) {
    if (!existsSync(ledgerPath)) throw error;
    return claimAgainstLedger(input, readR17PerformanceLedger(ledgerPath), ledgerPath);
  }
}

function replacePerformanceLedger(filePath: string, ledger: R17PerformanceExecutionLedger): void {
  const target = path.resolve(filePath);
  const staging = mkdtempSync(path.join(path.dirname(target), ".r17-performance-ledger-update-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(ledgerEnvelope(ledger)), "utf8");
    renameSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function updateR17PerformanceLedger(input: Readonly<{ root: string; expectedLedger: R17PerformanceExecutionLedger; completedFoldIds: readonly R17FoldId[]; finalCheckpointComplete: boolean }>): R17PerformanceExecutionLedger {
  const ledgerPath = roundGlobalPerformanceLedgerPath(input.root);
  const current = readR17PerformanceLedger(ledgerPath);
  if (hash(current) !== hash(input.expectedLedger)) throw new Error("R17 performance ledger changed during checkpoint continuation.");
  const nextCompleted = [...new Set(input.completedFoldIds)];
  if (nextCompleted.some((foldId) => !R17_FOLD_IDS.includes(foldId)) || current.completedFoldIds.some((foldId) => !nextCompleted.includes(foldId))) throw new Error("R17 performance ledger checkpoint state cannot remove or add an invalid fold.");
  if (current.finalCheckpointComplete && !input.finalCheckpointComplete) throw new Error("R17 performance ledger final completion marker cannot be cleared.");
  if (input.finalCheckpointComplete && nextCompleted.length !== R17_FOLD_IDS.length) throw new Error("R17 final checkpoint requires every fold checkpoint to be complete.");
  const next = Object.freeze({ ...current, completedFoldIds: Object.freeze(nextCompleted), finalCheckpointComplete: input.finalCheckpointComplete });
  validatePerformanceExecutionLedger(next);
  replacePerformanceLedger(ledgerPath, next);
  return next;
}

export function recordR17PerformanceFoldCompleted(input: Readonly<{ root: string; expectedLedger: R17PerformanceExecutionLedger; foldId: R17FoldId }>): R17PerformanceExecutionLedger {
  return updateR17PerformanceLedger({ root: input.root, expectedLedger: input.expectedLedger, completedFoldIds: [...input.expectedLedger.completedFoldIds, input.foldId], finalCheckpointComplete: input.expectedLedger.finalCheckpointComplete });
}

export function markR17FinalCheckpointComplete(input: Readonly<{ root: string; expectedLedger: R17PerformanceExecutionLedger }>): R17PerformanceExecutionLedger {
  return updateR17PerformanceLedger({ root: input.root, expectedLedger: input.expectedLedger, completedFoldIds: input.expectedLedger.completedFoldIds, finalCheckpointComplete: true });
}

export function validateR17ExecutionLedgerForLock(ledger: R17PerformanceExecutionLedger, executionLock: R17ExecutionLock, root?: string, executionDirectory?: string): number {
  const count = deriveR17PerformanceExecutionCount(ledger);
  const stored = ledger.executions[0]!;
  if (stored.executionId !== executionLock.executionId || stored.executionSourceSha !== executionLock.executionSourceSha || stored.observationDatasetSha256 !== executionLock.observationDatasetSha256) throw new Error("R17 performance execution does not match the round-global ledger.");
  if ((root === undefined) !== (executionDirectory === undefined)) throw new Error("R17 authoritative execution directory validation requires both root and directory.");
  if (root !== undefined && executionDirectory !== undefined && repositoryRelativePath(root, executionDirectory) !== ledger.authoritativeExecutionDirectory) throw new Error("R17 performance execution directory does not match the round-global ledger.");
  return count;
}

export function validateR17CompletedCheckpoints(input: Readonly<{ root: string; ledger: R17PerformanceExecutionLedger; executionDirectory: string; inputHashes: Readonly<Record<string, string>>; continuation: boolean }>): void {
  validatePerformanceExecutionLedger(input.ledger);
  const authoritativeDirectory = resolveR17AuthoritativeExecutionDirectory(input.root, input.ledger);
  if (path.resolve(input.executionDirectory) !== authoritativeDirectory) throw new Error("R17 performance execution directory does not match the round-global ledger.");
  if (input.continuation && !existsSync(authoritativeDirectory)) throw new Error("R17 authoritative execution checkpoint directory is missing; continuation cannot rebuild it.");
  for (const foldId of input.ledger.completedFoldIds) {
    const checkpoint = foldCheckpointPath(authoritativeDirectory, foldId);
    if (!checkpointExists(checkpoint)) throw new Error(`R17 completed fold checkpoint is missing: ${checkpoint}`);
    const envelope = readR17Checkpoint(checkpoint, Object.freeze({ ...input.inputHashes, foldId }));
    if (envelope.kind !== "FOLD" || envelope.key !== foldId) throw new Error(`R17 completed fold checkpoint identity is invalid: ${checkpoint}`);
  }
  const finalPath = finalPerformanceCheckpointPath(authoritativeDirectory);
  if (input.ledger.finalCheckpointComplete) {
    if (!checkpointExists(finalPath)) throw new Error(`R17 final performance checkpoint is missing: ${finalPath}`);
    const envelope = readR17Checkpoint(finalPath, input.inputHashes);
    if (envelope.kind !== "FINAL_PERFORMANCE" || envelope.key !== input.ledger.executions[0]!.executionId) throw new Error(`R17 final performance checkpoint identity is invalid: ${finalPath}`);
  } else if (checkpointExists(finalPath)) {
    throw new Error(`R17 final performance checkpoint exists without a completed ledger marker: ${finalPath}`);
  }
}

export function summarizeR17CompletedCheckpoints(completed: readonly boolean[]): Readonly<{ reusedCompletedCheckpoints: number; recomputedCompletedCheckpoints: number }> {
  return Object.freeze({ reusedCompletedCheckpoints: completed.filter(Boolean).length, recomputedCompletedCheckpoints: completed.filter((value) => !value).length });
}
