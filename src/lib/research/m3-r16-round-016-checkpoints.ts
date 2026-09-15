import { createHash, randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { M3_R16_PERFORMANCE_LOCK, M3_R16_RESEARCH_ROUND_ID, R16_FOLD_IDS, R16_PERFORMANCE_LEDGER_PATH } from "./m3-r16-round-016-protocol.ts";
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
  authoritativeExecutionDirectory: string;
  completedFoldIds: readonly (typeof R16_FOLD_IDS[number])[];
  finalCheckpointComplete: boolean;
  executions: readonly R16ExecutionLock[];
}>;

export type R16PerformanceExecutionClaim = Readonly<{
  ledger: R16PerformanceExecutionLedger;
  executionLock: R16ExecutionLock;
  continuation: boolean;
  ledgerPath: string;
  executionDirectory: string;
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

function repositoryRelativePath(root: string, candidate: string): string {
  const rootPath = path.resolve(root);
  const candidatePath = path.resolve(candidate);
  const relative = path.relative(rootPath, candidatePath).split(path.sep).join("/");
  if (!relative || relative === "." || relative.startsWith("../") || relative.includes("/../") || relative.endsWith("/..") || path.isAbsolute(relative)) throw new Error("R16 authoritative execution directory must be inside the repository root.");
  return relative;
}

function validateStoredExecutionDirectory(value: string): string {
  if (!value || value.includes("\\") || path.isAbsolute(value) || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) throw new Error("R16 performance ledger execution directory must be a normalized repository-relative path.");
  return value;
}

export function resolveR16AuthoritativeExecutionDirectory(root: string, ledger: R16PerformanceExecutionLedger): string {
  const relative = validateStoredExecutionDirectory(ledger.authoritativeExecutionDirectory);
  return path.resolve(root, relative);
}

function validateExecutionLock(lock: R16ExecutionLock): R16ExecutionLock {
  if (lock.schemaVersion !== "m3-r16-round-016-performance-lock-001" || lock.lock !== M3_R16_PERFORMANCE_LOCK || lock.researchRoundId !== M3_R16_RESEARCH_ROUND_ID || !lock.executionId || !lock.executionSourceSha || !lock.observationDatasetSha256 || !Number.isInteger(lock.continuationCount) || lock.continuationCount < 0) throw new Error("R16 performance execution lock is invalid.");
  return lock;
}

function validatePerformanceExecutionLedger(ledger: R16PerformanceExecutionLedger): R16PerformanceExecutionLedger {
  if (ledger.schemaVersion !== R16_PERFORMANCE_LEDGER_SCHEMA_VERSION || ledger.lock !== M3_R16_PERFORMANCE_LOCK || ledger.researchRoundId !== M3_R16_RESEARCH_ROUND_ID || !Array.isArray(ledger.executions) || ledger.executions.length !== 1 || !Array.isArray(ledger.completedFoldIds) || typeof ledger.finalCheckpointComplete !== "boolean") throw new Error("R16 performance ledger must contain exactly one round-global execution and checkpoint state.");
  validateStoredExecutionDirectory(ledger.authoritativeExecutionDirectory);
  const completed = new Set<string>();
  for (const foldId of ledger.completedFoldIds) {
    if (!R16_FOLD_IDS.includes(foldId) || completed.has(foldId)) throw new Error("R16 performance ledger contains an invalid or duplicate completed fold.");
    completed.add(foldId);
  }
  if (ledger.finalCheckpointComplete && completed.size !== R16_FOLD_IDS.length) throw new Error("R16 performance ledger cannot mark the final checkpoint complete before every fold is complete.");
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

function claimAgainstLedger(input: Readonly<{ root: string; executionId: string; executionSourceSha: string; observationDatasetSha256: string; executionDirectory: string }>, ledger: R16PerformanceExecutionLedger, ledgerPath: string): R16PerformanceExecutionClaim {
  const requestedDirectory = repositoryRelativePath(input.root, input.executionDirectory);
  const existing = ledger.executions[0]!;
  if (existing.executionId !== input.executionId || existing.executionSourceSha !== input.executionSourceSha || existing.observationDatasetSha256 !== input.observationDatasetSha256) throw new Error(`R16 performance is already locked by executionId ${existing.executionId}; only that executionId may continue.`);
  if (ledger.authoritativeExecutionDirectory !== requestedDirectory) throw new Error(`R16 authoritative execution directory does not match the round-global ledger: expected ${ledger.authoritativeExecutionDirectory}.`);
  return Object.freeze({ ledger, executionLock: existing, continuation: true, ledgerPath, executionDirectory: resolveR16AuthoritativeExecutionDirectory(input.root, ledger) });
}

export function claimR16PerformanceExecution(input: Readonly<{ root: string; executionId: string; executionSourceSha: string; observationDatasetSha256: string; executionDirectory: string }>): R16PerformanceExecutionClaim {
  if (!input.executionId || !input.executionSourceSha || !input.observationDatasetSha256) throw new Error("R16 performance execution identity is required.");
  const ledgerPath = roundGlobalPerformanceLedgerPath(input.root);
  if (existsSync(ledgerPath)) {
    const ledger = readR16PerformanceLedger(ledgerPath);
    return claimAgainstLedger(input, ledger, ledgerPath);
  }

  const executionLock = Object.freeze({ schemaVersion: "m3-r16-round-016-performance-lock-001" as const, lock: M3_R16_PERFORMANCE_LOCK, researchRoundId: M3_R16_RESEARCH_ROUND_ID, executionId: input.executionId, executionSourceSha: input.executionSourceSha, observationDatasetSha256: input.observationDatasetSha256, createdAt: new Date().toISOString(), continuationCount: 0 });
  const ledger = Object.freeze({ schemaVersion: R16_PERFORMANCE_LEDGER_SCHEMA_VERSION, lock: M3_R16_PERFORMANCE_LOCK, researchRoundId: M3_R16_RESEARCH_ROUND_ID, authoritativeExecutionDirectory: repositoryRelativePath(input.root, input.executionDirectory), completedFoldIds: Object.freeze([]), finalCheckpointComplete: false, executions: Object.freeze([executionLock]) });
  try {
    writePerformanceLedgerExclusive(ledgerPath, ledger);
    return Object.freeze({ ledger, executionLock, continuation: false, ledgerPath, executionDirectory: resolveR16AuthoritativeExecutionDirectory(input.root, ledger) });
  } catch (error) {
    if (!existsSync(ledgerPath)) throw error;
    const existingLedger = readR16PerformanceLedger(ledgerPath);
    return claimAgainstLedger(input, existingLedger, ledgerPath);
  }
}

function replacePerformanceLedger(filePath: string, ledger: R16PerformanceExecutionLedger): void {
  const target = path.resolve(filePath);
  const staging = mkdtempSync(path.join(path.dirname(target), ".r16-performance-ledger-update-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(ledgerEnvelope(ledger)), "utf8");
    renameSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function updateR16PerformanceLedger(input: Readonly<{ root: string; expectedLedger: R16PerformanceExecutionLedger; completedFoldIds: readonly (typeof R16_FOLD_IDS[number])[]; finalCheckpointComplete: boolean }>): R16PerformanceExecutionLedger {
  const ledgerPath = roundGlobalPerformanceLedgerPath(input.root);
  const current = readR16PerformanceLedger(ledgerPath);
  if (hash(current) !== hash(input.expectedLedger)) throw new Error("R16 performance ledger changed during checkpoint continuation.");
  const nextCompleted = [...new Set(input.completedFoldIds)];
  if (nextCompleted.some((foldId) => !R16_FOLD_IDS.includes(foldId)) || current.completedFoldIds.some((foldId) => !nextCompleted.includes(foldId))) throw new Error("R16 performance ledger checkpoint state cannot remove or add an invalid fold.");
  if (current.finalCheckpointComplete && !input.finalCheckpointComplete) throw new Error("R16 performance ledger final completion marker cannot be cleared.");
  if (input.finalCheckpointComplete && nextCompleted.length !== R16_FOLD_IDS.length) throw new Error("R16 final checkpoint requires every fold checkpoint to be complete.");
  const next = Object.freeze({ ...current, completedFoldIds: Object.freeze(nextCompleted), finalCheckpointComplete: input.finalCheckpointComplete });
  validatePerformanceExecutionLedger(next);
  replacePerformanceLedger(ledgerPath, next);
  return next;
}

export function recordR16PerformanceFoldCompleted(input: Readonly<{ root: string; expectedLedger: R16PerformanceExecutionLedger; foldId: typeof R16_FOLD_IDS[number] }>): R16PerformanceExecutionLedger {
  return updateR16PerformanceLedger({ root: input.root, expectedLedger: input.expectedLedger, completedFoldIds: [...input.expectedLedger.completedFoldIds, input.foldId], finalCheckpointComplete: input.expectedLedger.finalCheckpointComplete });
}

export function markR16FinalCheckpointComplete(input: Readonly<{ root: string; expectedLedger: R16PerformanceExecutionLedger }>): R16PerformanceExecutionLedger {
  return updateR16PerformanceLedger({ root: input.root, expectedLedger: input.expectedLedger, completedFoldIds: input.expectedLedger.completedFoldIds, finalCheckpointComplete: true });
}

export function validateR16ExecutionLedgerForLock(ledger: R16PerformanceExecutionLedger, executionLock: R16ExecutionLock, root?: string, executionDirectory?: string): number {
  const count = deriveR16PerformanceExecutionCount(ledger);
  const stored = ledger.executions[0]!;
  if (stored.executionId !== executionLock.executionId || stored.executionSourceSha !== executionLock.executionSourceSha || stored.observationDatasetSha256 !== executionLock.observationDatasetSha256) throw new Error("R16 performance execution does not match the round-global ledger.");
  if ((root === undefined) !== (executionDirectory === undefined)) throw new Error("R16 authoritative execution directory validation requires both root and directory.");
  if (root !== undefined && executionDirectory !== undefined && repositoryRelativePath(root, executionDirectory) !== ledger.authoritativeExecutionDirectory) throw new Error("R16 performance execution directory does not match the round-global ledger.");
  return count;
}

export function validateR16CompletedCheckpoints(input: Readonly<{ root: string; ledger: R16PerformanceExecutionLedger; executionDirectory: string; inputHashes: Readonly<Record<string, string>>; continuation: boolean }>): void {
  validatePerformanceExecutionLedger(input.ledger);
  const authoritativeDirectory = resolveR16AuthoritativeExecutionDirectory(input.root, input.ledger);
  if (path.resolve(input.executionDirectory) !== authoritativeDirectory) throw new Error("R16 performance execution directory does not match the round-global ledger.");
  if (input.continuation && !existsSync(authoritativeDirectory)) throw new Error("R16 authoritative execution checkpoint directory is missing; continuation cannot rebuild it.");
  for (const foldId of input.ledger.completedFoldIds) {
    const checkpoint = foldCheckpointPath(authoritativeDirectory, foldId);
    if (!checkpointExists(checkpoint)) throw new Error(`R16 completed fold checkpoint is missing: ${checkpoint}`);
    const envelope = readR16Checkpoint(checkpoint, Object.freeze({ ...input.inputHashes, foldId }));
    if (envelope.kind !== "FOLD" || envelope.key !== foldId) throw new Error(`R16 completed fold checkpoint identity is invalid: ${checkpoint}`);
  }
  const finalPath = finalPerformanceCheckpointPath(authoritativeDirectory);
  if (input.ledger.finalCheckpointComplete) {
    if (!checkpointExists(finalPath)) throw new Error(`R16 final performance checkpoint is missing: ${finalPath}`);
    const envelope = readR16Checkpoint(finalPath, input.inputHashes);
    if (envelope.kind !== "FINAL_PERFORMANCE" || envelope.key !== input.ledger.executions[0]!.executionId) throw new Error(`R16 final performance checkpoint identity is invalid: ${finalPath}`);
  } else if (checkpointExists(finalPath)) {
    throw new Error(`R16 final performance checkpoint exists without a completed ledger marker: ${finalPath}`);
  }
}
