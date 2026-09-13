import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  openSync,
} from "node:fs";
import path from "node:path";

import { ROUND_018_FOLDS, ROUND_018_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS, ROUND_018_PERFORMANCE_LEDGER_PATH, ROUND_018_RESEARCH_ROUND_ID } from "./m3-r18-round-018-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R18_PERFORMANCE_LOCK = "ROUND-018-FIRST-RESULT-LOCK" as const;
export const R18_PERFORMANCE_LEDGER_SCHEMA_VERSION = "m3-r18-round-018-performance-ledger-001" as const;
export const R18_PERFORMANCE_CHECKPOINT_SCHEMA_VERSION = "m3-r18-round-018-performance-checkpoint-001" as const;

export type R18PerformanceStatus = "CLAIMED" | "COMPLETE";
export type R18FinalSummaryMarker = "PENDING" | "COMPLETE";

export type R18ExecutionRecord = Readonly<{
  schemaVersion: typeof R18_PERFORMANCE_LEDGER_SCHEMA_VERSION;
  lock: typeof R18_PERFORMANCE_LOCK;
  researchRoundId: typeof ROUND_018_RESEARCH_ROUND_ID;
  executionId: string;
  authoritativeExecutionDirectory: string;
  performanceStageSourceCommit: string;
  implementationCommit: string;
  acceptedDesignSourceCommit: string;
  r14ObservationDataSha256: string;
  compactStructuralSha256: string;
  structuralManifestSha256: string;
  preflightReportSha256: string;
  claimTimestamp: string;
  executionCount: 1;
  status: R18PerformanceStatus;
  completedFoldIds: readonly (typeof ROUND_018_FOLDS[number])[];
  finalSummaryMarker: R18FinalSummaryMarker;
  resultSha256: string | null;
  summarySha256: string | null;
  auditSha256: string | null;
  selectionSha256: string | null;
}>;

export type R18PerformanceExecutionLedger = Readonly<{
  schemaVersion: typeof R18_PERFORMANCE_LEDGER_SCHEMA_VERSION;
  lock: typeof R18_PERFORMANCE_LOCK;
  researchRoundId: typeof ROUND_018_RESEARCH_ROUND_ID;
  maxAuthoritativePerformanceExecutions: 1;
  executionCount: 1;
  executions: readonly [R18ExecutionRecord];
}>;

export type R18CheckpointEnvelope<T> = Readonly<{
  schemaVersion: typeof R18_PERFORMANCE_CHECKPOINT_SCHEMA_VERSION;
  kind: string;
  key: string;
  inputHashes: Readonly<Record<string, string>>;
  payload: T;
  outputSha256: string;
  completionMarker: "COMPLETE";
}>;

export type R18PerformanceExecutionClaim = Readonly<{
  ledger: R18PerformanceExecutionLedger;
  executionLock: R18ExecutionRecord;
  continuation: boolean;
  ledgerPath: string;
  executionDirectory: string;
}>;

export type R18PerformanceOutputHashes = Readonly<{
  resultSha256: string;
  summarySha256: string;
  auditSha256: string;
  selectionSha256: string;
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r+");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function isSafeExecutionId(value: string): boolean {
  return /^r18-[0-9a-f-]{36}$/.test(value);
}

function validateStoredExecutionDirectory(value: string): string {
  if (!value || value.includes("\\") || path.isAbsolute(value)) throw new Error("R18 authoritative execution directory must be repository-relative.");
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) throw new Error("R18 authoritative execution directory must be normalized.");
  return value;
}

function repositoryRelativePath(root: string, candidate: string): string {
  const rootPath = path.resolve(root);
  const candidatePath = path.resolve(candidate);
  const relative = path.relative(rootPath, candidatePath).split(path.sep).join("/");
  if (!relative || relative === "." || relative.startsWith("../") || relative.includes("/../") || relative.endsWith("/..") || path.isAbsolute(relative)) throw new Error("R18 authoritative execution directory must be inside the repository root.");
  return validateStoredExecutionDirectory(relative);
}

function expectedExecutionDirectory(executionId: string): string {
  if (!isSafeExecutionId(executionId)) throw new Error("R18 executionId must be a generated r18 UUID.");
  return `.cache/tradepulse/round-018/executions/${executionId}`;
}

function ledgerPath(root: string): string {
  return path.join(path.resolve(root), ROUND_018_PERFORMANCE_LEDGER_PATH);
}

function resolvedExecutionDirectory(root: string, ledger: R18PerformanceExecutionLedger): string {
  const record = ledger.executions[0]!;
  const relative = validateStoredExecutionDirectory(record.authoritativeExecutionDirectory);
  if (relative !== expectedExecutionDirectory(record.executionId)) throw new Error("R18 ledger execution directory is not bound to its executionId.");
  return path.resolve(root, relative);
}

function validateFoldIds(foldIds: readonly string[]): readonly (typeof ROUND_018_FOLDS[number])[] {
  const seen = new Set<string>();
  for (const foldId of foldIds) {
    if (!ROUND_018_FOLDS.includes(foldId as typeof ROUND_018_FOLDS[number]) || seen.has(foldId)) throw new Error("R18 ledger contains an invalid or duplicate completed fold.");
    seen.add(foldId);
  }
  return Object.freeze([...foldIds] as (typeof ROUND_018_FOLDS[number])[]);
}

function validateExecutionRecord(record: R18ExecutionRecord): R18ExecutionRecord {
  if (record.schemaVersion !== R18_PERFORMANCE_LEDGER_SCHEMA_VERSION
    || record.lock !== R18_PERFORMANCE_LOCK
    || record.researchRoundId !== ROUND_018_RESEARCH_ROUND_ID
    || !isSafeExecutionId(record.executionId)
    || record.executionCount !== 1
    || !record.performanceStageSourceCommit
    || !record.implementationCommit
    || !record.acceptedDesignSourceCommit
    || !record.r14ObservationDataSha256
    || !record.compactStructuralSha256
    || !record.structuralManifestSha256
    || !record.preflightReportSha256
    || !Number.isFinite(Date.parse(record.claimTimestamp))) throw new Error("R18 execution record is invalid.");
  const directory = validateStoredExecutionDirectory(record.authoritativeExecutionDirectory);
  if (directory !== expectedExecutionDirectory(record.executionId)) throw new Error("R18 execution directory is not the canonical executionId directory.");
  validateFoldIds(record.completedFoldIds);
  if (record.status === "COMPLETE" && (record.completedFoldIds.length !== ROUND_018_FOLDS.length || record.finalSummaryMarker !== "COMPLETE" || !record.resultSha256 || !record.summarySha256 || !record.auditSha256 || !record.selectionSha256)) throw new Error("R18 completed ledger is missing completed folds, summary marker, or output hashes.");
  if (record.status === "CLAIMED" && record.finalSummaryMarker !== "PENDING") throw new Error("R18 claimed ledger cannot have a complete summary marker.");
  return record;
}

export function validateR18PerformanceLedger(ledger: R18PerformanceExecutionLedger): R18PerformanceExecutionLedger {
  if (ledger.schemaVersion !== R18_PERFORMANCE_LEDGER_SCHEMA_VERSION
    || ledger.lock !== R18_PERFORMANCE_LOCK
    || ledger.researchRoundId !== ROUND_018_RESEARCH_ROUND_ID
    || ledger.maxAuthoritativePerformanceExecutions !== ROUND_018_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS
    || ledger.executionCount !== 1
    || !Array.isArray(ledger.executions)
    || ledger.executions.length !== 1) throw new Error("R18 performance ledger must contain exactly one round-global execution.");
  validateExecutionRecord(ledger.executions[0]!);
  return ledger;
}

function ledgerEnvelope(ledger: R18PerformanceExecutionLedger): R18CheckpointEnvelope<R18PerformanceExecutionLedger> {
  return Object.freeze({
    schemaVersion: R18_PERFORMANCE_CHECKPOINT_SCHEMA_VERSION,
    kind: "PERFORMANCE_LEDGER",
    key: ROUND_018_RESEARCH_ROUND_ID,
    inputHashes: Object.freeze({}),
    payload: ledger,
    outputSha256: hash(ledger),
    completionMarker: "COMPLETE" as const,
  });
}

function writeLedgerExclusive(filePath: string, ledger: R18PerformanceExecutionLedger): void {
  const target = path.resolve(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r18-performance-ledger-staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(ledgerEnvelope(ledger)), "utf8");
    fsyncFile(temporary);
    linkSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

function replaceLedger(filePath: string, ledger: R18PerformanceExecutionLedger): void {
  const target = path.resolve(filePath);
  const staging = mkdtempSync(path.join(path.dirname(target), ".r18-performance-ledger-update-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(ledgerEnvelope(ledger)), "utf8");
    fsyncFile(temporary);
    renameSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR18PerformanceLedger(filePath: string): R18PerformanceExecutionLedger {
  const parsed = JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as R18CheckpointEnvelope<R18PerformanceExecutionLedger>;
  if (parsed.schemaVersion !== R18_PERFORMANCE_CHECKPOINT_SCHEMA_VERSION
    || parsed.kind !== "PERFORMANCE_LEDGER"
    || parsed.key !== ROUND_018_RESEARCH_ROUND_ID
    || parsed.completionMarker !== "COMPLETE"
    || parsed.outputSha256 !== hash(parsed.payload)) throw new Error(`R18 performance ledger is corrupt: ${filePath}`);
  return validateR18PerformanceLedger(parsed.payload);
}

export function roundGlobalR18PerformanceLedgerPath(root: string): string {
  return ledgerPath(root);
}

export function deriveR18PerformanceExecutionCount(ledger: R18PerformanceExecutionLedger): number {
  return validateR18PerformanceLedger(ledger).executions.length;
}

export function assertR18SelectionNotExecuted(ledger: R18PerformanceExecutionLedger): void {
  const record = validateR18PerformanceLedger(ledger).executions[0]!;
  if (record.selectionSha256 !== null || record.finalSummaryMarker === "COMPLETE") throw new Error("R18 selection is already complete and cannot be rerun.");
}

export function newR18ExecutionId(): string {
  return `r18-${randomUUID()}`;
}

function requestedDirectory(root: string, executionId: string, executionDirectory?: string): string {
  const canonical = expectedExecutionDirectory(executionId);
  if (executionDirectory === undefined) return canonical;
  const requested = repositoryRelativePath(root, executionDirectory);
  if (requested !== canonical) throw new Error(`R18 authoritative execution directory is fixed to ${canonical}.`);
  return requested;
}

function claimExisting(input: Readonly<{ root: string; executionId: string; performanceStageSourceCommit: string; implementationCommit: string; acceptedDesignSourceCommit: string; r14ObservationDataSha256: string; compactStructuralSha256: string; structuralManifestSha256: string; preflightReportSha256: string; executionDirectory?: string }>, ledger: R18PerformanceExecutionLedger, pathValue: string): R18PerformanceExecutionClaim {
  const record = ledger.executions[0]!;
  if (record.executionId !== input.executionId
    || record.performanceStageSourceCommit !== input.performanceStageSourceCommit
    || record.implementationCommit !== input.implementationCommit
    || record.acceptedDesignSourceCommit !== input.acceptedDesignSourceCommit
    || record.r14ObservationDataSha256 !== input.r14ObservationDataSha256
    || record.compactStructuralSha256 !== input.compactStructuralSha256
    || record.structuralManifestSha256 !== input.structuralManifestSha256
    || record.preflightReportSha256 !== input.preflightReportSha256) throw new Error(`R18 performance is already locked by executionId ${record.executionId}; only that exact execution may continue.`);
  requestedDirectory(input.root, input.executionId, input.executionDirectory);
  return Object.freeze({ ledger, executionLock: record, continuation: true, ledgerPath: pathValue, executionDirectory: resolvedExecutionDirectory(input.root, ledger) });
}

export function claimR18PerformanceExecution(input: Readonly<{ root: string; executionId: string; performanceStageSourceCommit: string; implementationCommit: string; acceptedDesignSourceCommit: string; r14ObservationDataSha256: string; compactStructuralSha256: string; structuralManifestSha256: string; preflightReportSha256: string; executionDirectory?: string }>): R18PerformanceExecutionClaim {
  const root = path.resolve(input.root);
  if (!isSafeExecutionId(input.executionId)) throw new Error("R18 executionId must be a generated r18 UUID.");
  const pathValue = ledgerPath(root);
  if (existsSync(pathValue)) return claimExisting(input, readR18PerformanceLedger(pathValue), pathValue);
  const relativeDirectory = requestedDirectory(root, input.executionId, input.executionDirectory);
  const absoluteDirectory = path.resolve(root, relativeDirectory);
  if (existsSync(absoluteDirectory) && readdirSync(absoluteDirectory).length > 0) throw new Error("R18 authoritative execution directory already contains data before the first claim.");
  const executionLock = Object.freeze({
    schemaVersion: R18_PERFORMANCE_LEDGER_SCHEMA_VERSION,
    lock: R18_PERFORMANCE_LOCK,
    researchRoundId: ROUND_018_RESEARCH_ROUND_ID,
    executionId: input.executionId,
    authoritativeExecutionDirectory: relativeDirectory,
    performanceStageSourceCommit: input.performanceStageSourceCommit,
    implementationCommit: input.implementationCommit,
    acceptedDesignSourceCommit: input.acceptedDesignSourceCommit,
    r14ObservationDataSha256: input.r14ObservationDataSha256,
    compactStructuralSha256: input.compactStructuralSha256,
    structuralManifestSha256: input.structuralManifestSha256,
    preflightReportSha256: input.preflightReportSha256,
    claimTimestamp: new Date().toISOString(),
    executionCount: 1 as const,
    status: "CLAIMED" as const,
    completedFoldIds: Object.freeze([]),
    finalSummaryMarker: "PENDING" as const,
    resultSha256: null,
    summarySha256: null,
    auditSha256: null,
    selectionSha256: null,
  });
  const ledger = Object.freeze({
    schemaVersion: R18_PERFORMANCE_LEDGER_SCHEMA_VERSION,
    lock: R18_PERFORMANCE_LOCK,
    researchRoundId: ROUND_018_RESEARCH_ROUND_ID,
    maxAuthoritativePerformanceExecutions: 1 as const,
    executionCount: 1 as const,
    executions: Object.freeze([executionLock]) as readonly [R18ExecutionRecord],
  });
  validateR18PerformanceLedger(ledger);
  try {
    writeLedgerExclusive(pathValue, ledger);
    return Object.freeze({ ledger, executionLock, continuation: false, ledgerPath: pathValue, executionDirectory: absoluteDirectory });
  } catch (error) {
    if (!existsSync(pathValue)) throw error;
    return claimExisting(input, readR18PerformanceLedger(pathValue), pathValue);
  }
}

function checkpointHash<T>(payload: T): string {
  return hash(payload);
}

export function foldR18CheckpointPath(executionDirectory: string, foldId: typeof ROUND_018_FOLDS[number]): string {
  return path.join(path.resolve(executionDirectory), "folds", `${foldId}.json`);
}

export function finalR18PerformanceCheckpointPath(executionDirectory: string): string {
  return path.join(path.resolve(executionDirectory), "performance.json");
}

export function readR18Checkpoint<T>(filePath: string, inputHashes?: Readonly<Record<string, string>>): R18CheckpointEnvelope<T> {
  const parsed = JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as R18CheckpointEnvelope<T>;
  if (parsed.schemaVersion !== R18_PERFORMANCE_CHECKPOINT_SCHEMA_VERSION
    || parsed.completionMarker !== "COMPLETE"
    || parsed.outputSha256 !== checkpointHash(parsed.payload)) throw new Error(`R18 checkpoint is incomplete or corrupt: ${filePath}`);
  if (inputHashes && stableStringify(parsed.inputHashes) !== stableStringify(inputHashes)) throw new Error(`R18 checkpoint input identity mismatch: ${filePath}`);
  return parsed;
}

export function writeR18CheckpointAtomic<T>(input: Readonly<{ filePath: string; kind: string; key: string; inputHashes: Readonly<Record<string, string>>; payload: T }>): Readonly<{ envelope: R18CheckpointEnvelope<T>; reused: boolean }> {
  const target = path.resolve(input.filePath);
  if (existsSync(target)) return Object.freeze({ envelope: readR18Checkpoint<T>(target, input.inputHashes), reused: true });
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r18-checkpoint-staging-"));
  const temporary = path.join(staging, path.basename(target));
  const envelope = Object.freeze({ schemaVersion: R18_PERFORMANCE_CHECKPOINT_SCHEMA_VERSION, kind: input.kind, key: input.key, inputHashes: Object.freeze({ ...input.inputHashes }), payload: input.payload, outputSha256: checkpointHash(input.payload), completionMarker: "COMPLETE" as const });
  try {
    writeFileSync(temporary, stableStringify(envelope), "utf8");
    fsyncFile(temporary);
    if (existsSync(target)) return Object.freeze({ envelope: readR18Checkpoint<T>(target, input.inputHashes), reused: true });
    renameSync(temporary, target);
    return Object.freeze({ envelope, reused: false });
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function validateR18CompletedCheckpoints(input: Readonly<{ root: string; ledger: R18PerformanceExecutionLedger; executionDirectory: string; inputHashes: Readonly<Record<string, string>>; continuation: boolean }>): void {
  validateR18PerformanceLedger(input.ledger);
  const expectedDirectory = resolvedExecutionDirectory(input.root, input.ledger);
  if (path.resolve(input.executionDirectory) !== expectedDirectory) throw new Error("R18 execution directory does not match the round-global ledger.");
  if (input.continuation && !existsSync(expectedDirectory)) throw new Error("R18 authoritative checkpoint directory is missing; continuation cannot rebuild it.");
  for (const foldId of input.ledger.executions[0]!.completedFoldIds) {
    const checkpoint = foldR18CheckpointPath(expectedDirectory, foldId);
    if (!existsSync(checkpoint)) throw new Error(`R18 completed fold checkpoint is missing: ${checkpoint}`);
    const envelope = readR18Checkpoint(checkpoint, Object.freeze({ ...input.inputHashes, foldId }));
    if (envelope.kind !== "FOLD" || envelope.key !== foldId) throw new Error(`R18 completed fold checkpoint identity is invalid: ${checkpoint}`);
  }
  const finalPath = finalR18PerformanceCheckpointPath(expectedDirectory);
  if (input.ledger.executions[0]!.finalSummaryMarker === "COMPLETE") {
    if (!existsSync(finalPath)) throw new Error(`R18 final performance checkpoint is missing: ${finalPath}`);
    const envelope = readR18Checkpoint(finalPath, input.inputHashes);
    if (envelope.kind !== "FINAL_PERFORMANCE" || envelope.key !== input.ledger.executions[0]!.executionId) throw new Error(`R18 final performance checkpoint identity is invalid: ${finalPath}`);
  }
}

export function updateR18PerformanceLedger(input: Readonly<{ root: string; expectedLedger: R18PerformanceExecutionLedger; completedFoldIds: readonly (typeof ROUND_018_FOLDS[number])[]; status?: R18PerformanceStatus; finalSummaryMarker?: R18FinalSummaryMarker; outputs?: R18PerformanceOutputHashes }>): R18PerformanceExecutionLedger {
  const current = readR18PerformanceLedger(ledgerPath(input.root));
  if (hash(current) !== hash(input.expectedLedger)) throw new Error("R18 performance ledger changed during execution.");
  const currentRecord = current.executions[0]!;
  const nextCompleted = validateFoldIds(input.completedFoldIds);
  if (currentRecord.completedFoldIds.some((foldId) => !nextCompleted.includes(foldId))) throw new Error("R18 ledger cannot remove a completed fold.");
  const status = input.status ?? currentRecord.status;
  const marker = input.finalSummaryMarker ?? currentRecord.finalSummaryMarker;
  if (currentRecord.status === "COMPLETE" && status !== "COMPLETE") throw new Error("R18 completed ledger cannot regress.");
  if (currentRecord.finalSummaryMarker === "COMPLETE" && marker !== "COMPLETE") throw new Error("R18 final summary marker cannot regress.");
  if (status === "COMPLETE" && (nextCompleted.length !== ROUND_018_FOLDS.length || marker !== "COMPLETE" || !input.outputs)) throw new Error("R18 completion requires all folds, the final summary marker, and output hashes.");
  if (marker === "COMPLETE" && status !== "COMPLETE") throw new Error("R18 final summary marker requires a complete ledger.");
  const nextRecord = Object.freeze({ ...currentRecord, status, completedFoldIds: nextCompleted, finalSummaryMarker: marker, ...(input.outputs ? { resultSha256: input.outputs.resultSha256, summarySha256: input.outputs.summarySha256, auditSha256: input.outputs.auditSha256, selectionSha256: input.outputs.selectionSha256 } : {}) });
  const next = Object.freeze({ ...current, executions: Object.freeze([nextRecord]) as readonly [R18ExecutionRecord] });
  validateR18PerformanceLedger(next);
  replaceLedger(ledgerPath(input.root), next);
  return next;
}

export function removeR18PublishedFileForRollback(filePath: string): void {
  unlinkSync(filePath);
}
