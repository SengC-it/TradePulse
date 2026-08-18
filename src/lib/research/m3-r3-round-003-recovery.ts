import { createHash } from "node:crypto";

import type { IntrabarBacktestReport, BacktestReport } from "../backtest/types.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import {
  RESEARCH_DIRECTION_ORDER,
  RESEARCH_SYMBOL_ORDER,
  type ResearchDirection,
} from "./constants.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange, selectRecordsForFoldRole, validateResearchRange } from "./folds.ts";
import type { M3HResearchEvidence } from "./m3-h-evidence.ts";
import type { M3R2DecisionSnapshot } from "./m3-r2-decision-snapshot.ts";
import type { NormalizedResearchSignal, ResearchDiagnostics, ResearchRange } from "./types.ts";
import { deepFreeze, requireSafeTimestamp, stableStringify } from "./utils.ts";

export const M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256 =
  "5ecfae3258d2ace774965eba12df25b888b04593b32e1b92a2593c41fdad8b33" as const;
export const M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256 =
  "65a011d813c55f936f89069706730f5de33dfda9f2eba94f0dfb2b914818eec9" as const;
export const M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256 =
  "883001ac34470120cdbc754c2f47437bf13b6f13ce6ffb3e4f7795558a6a2fc7" as const;
export const M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME = 1787031883099 as const;
export const M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT = 7500 as const;
export const M3_R3_ROUND_003_EXPECTED_EXECUTED_COUNT = 7495 as const;
export const M3_R3_ROUND_003_EXPECTED_EXECUTION_SOURCE_SHA =
  "9df170b7f72a95971825e126d4096e1e4f16be5f" as const;
export const M3_R3_ROUND_003_EXPECTED_SOURCE_ROUND = "baseline-002-research-round-002" as const;
export const M3_R3_ROUND_003_EXPECTED_SOURCE_GATE_SHA256 =
  "9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0" as const;
export const M3_R3_ROUND_003_EXPECTED_SOURCE_PLAN_SHA256 =
  "82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511" as const;
export const M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS = "VERIFIED_REUSABLE_INPUT" as const;

export const M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE: ResearchRange = deepFreeze({
  startTime: getResearchFoldRoleRange("F1", "VALIDATION").startTime,
  endTime: getResearchFoldRoleRange("F6", "VALIDATION").endTime,
});

const M3_R3_ROUND_003_SNAPSHOT_SCHEMA = "m3-r2-decision-snapshots-001" as const;
const M3_R3_ROUND_003_CONTROL_SCHEMA = "m3-b-report-004" as const;
const M3_R3_ROUND_003_POLICY = "bt-policy-003" as const;
const M3_R3_ROUND_003_STRATEGY = "baseline-001" as const;
const M3_R3_ROUND_003_ALLOWED_CONTROL_STATUSES = [
  "EXECUTED",
  "PERIOD_END_CENSORED",
  "ENTRY_OUTSIDE_BRACKET",
] as const;
const M3_R3_ROUND_003_FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;
const M3_R3_ROUND_003_SNAPSHOT_NUMERIC_FIELDS = [
  "symbol4hClose",
  "symbol4hEma50",
  "symbol4hEma200",
  "symbol4hAtr",
  "symbol4hEma200FiveBarsAgo",
  "nearestBaselinePullbackTouchAgeBars",
  "current1hQuoteVolume",
  "previous20Closed1hQuoteVolumeMean",
  "current1hClose",
  "previous3BreakoutExtreme",
  "current1hAtr",
  "breakoutMarginAtr",
] as const;

export type M3R3FailureCode =
  | "ROUND_003_INPUT_ARTIFACTS_UNAVAILABLE"
  | "ROUND_003_INPUT_ARTIFACT_HASH_MISMATCH"
  | "ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED"
  | "ROUND_003_CONTROL_PARITY_FAILED";

export class M3R3RecoveryError extends Error {
  public readonly name = "M3R3RecoveryError";
  public readonly code: M3R3FailureCode;

  public constructor(code: M3R3FailureCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}

type IdentityRecord = Pick<NormalizedResearchSignal, "signalTime" | "symbol" | "direction">;

function fail(code: M3R3FailureCode, detail?: string): never {
  throw new M3R3RecoveryError(code, detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseUtf8Json(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `${label} is not valid UTF-8 JSON.`);
  }
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `${label} must be finite.`);
  }
  return value;
}

export function validateM3R3IdentityRecord(
  record: Readonly<Record<string, unknown>>,
): asserts record is IdentityRecord & Record<string, unknown> {
  if (typeof record.symbol !== "string" || !RESEARCH_SYMBOL_ORDER.includes(record.symbol as typeof RESEARCH_SYMBOL_ORDER[number])) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `Unsupported identity symbol: ${String(record.symbol)}.`);
  }
  if (typeof record.direction !== "string" || !RESEARCH_DIRECTION_ORDER.includes(record.direction as ResearchDirection)) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `Unsupported identity direction: ${String(record.direction)}.`);
  }
  try {
    requireSafeTimestamp(finiteNumber(record.signalTime, "identity signalTime"), "identity signalTime");
  } catch (error) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", error instanceof Error ? error.message : "Invalid identity signalTime.");
  }
}

function symbolIndex(symbol: IdentityRecord["symbol"]): number {
  const index = RESEARCH_SYMBOL_ORDER.indexOf(symbol);
  if (index < 0) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `Unsupported identity symbol: ${symbol}.`);
  return index;
}

function directionIndex(direction: ResearchDirection): number {
  const index = RESEARCH_DIRECTION_ORDER.indexOf(direction);
  if (index < 0) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `Unsupported identity direction: ${direction}.`);
  return index;
}

export function compareM3R3CanonicalIdentities(left: IdentityRecord, right: IdentityRecord): number {
  return left.signalTime - right.signalTime || symbolIndex(left.symbol) - symbolIndex(right.symbol) || directionIndex(left.direction) - directionIndex(right.direction);
}

export function m3R3Identity(record: IdentityRecord): string {
  validateM3R3IdentityRecord(record);
  return `${record.symbol}|${record.direction}|${record.signalTime}`;
}

export function canonicalM3R3IdentityStrings(records: readonly IdentityRecord[]): readonly string[] {
  for (const record of records) validateM3R3IdentityRecord(record);
  const ordered = [...records].sort(compareM3R3CanonicalIdentities);
  const identities = ordered.map(m3R3Identity);
  if (new Set(identities).size !== identities.length) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Duplicate M3-R3 identity.");
  }
  return Object.freeze(identities);
}

export function sha256M3R3RawBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function m3R3IdentityHash(records: readonly IdentityRecord[]): string {
  return sha256M3R3RawBytes(Buffer.from(stableStringify(canonicalM3R3IdentityStrings(records)), "utf8"));
}

export function m3R3FormalIdentityHash(records: readonly NormalizedResearchSignal[]): string {
  return m3R3IdentityHash(records);
}

export function m3R3ExecutedIdentityHash(records: readonly NormalizedResearchSignal[]): string {
  return m3R3IdentityHash(records.filter((record) => record.status === "EXECUTED"));
}

export function filterM3R3AggregateValidationRecords(
  records: readonly NormalizedResearchSignal[],
  range: ResearchRange = M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE,
): readonly NormalizedResearchSignal[] {
  const validatedRange = validateResearchRange(range);
  return Object.freeze(records.filter((record) => record.signalTime >= validatedRange.startTime && record.signalTime <= validatedRange.endTime));
}

export function calculateM3R3AggregateDiagnostics(
  records: readonly NormalizedResearchSignal[],
  range: ResearchRange = M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE,
): ResearchDiagnostics {
  const validatedRange = validateResearchRange(range);
  const validationRecords = filterM3R3AggregateValidationRecords(records, validatedRange);
  return calculateResearchDiagnostics({ records: validationRecords, range: validatedRange });
}

export type M3R3SnapshotArtifact = Readonly<{
  schemaVersion: typeof M3_R3_ROUND_003_SNAPSHOT_SCHEMA;
  researchRoundId: typeof M3_R3_ROUND_003_EXPECTED_SOURCE_ROUND;
  executionSourceSha: typeof M3_R3_ROUND_003_EXPECTED_EXECUTION_SOURCE_SHA;
  selectionGateSha256: typeof M3_R3_ROUND_003_EXPECTED_SOURCE_GATE_SHA256;
  experimentPlanSha256: typeof M3_R3_ROUND_003_EXPECTED_SOURCE_PLAN_SHA256;
  backtestPolicyVersion: typeof M3_R3_ROUND_003_POLICY;
  strategyVersion: typeof M3_R3_ROUND_003_STRATEGY;
  studyServerTime: typeof M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME;
  controlReportSha256: typeof M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256;
  snapshotCount: typeof M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT;
  snapshots: readonly M3R2DecisionSnapshot[];
}>;

function parseM3R3DecisionSnapshot(value: unknown, index: number): M3R2DecisionSnapshot {
  if (!isRecord(value)) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `Snapshot ${index} is not an object.`);
  validateM3R3IdentityRecord(value);
  if (typeof value.btcRegime !== "string" || !["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"].includes(value.btcRegime)) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `Snapshot ${index} BTC regime is invalid.`);
  }
  for (const field of M3_R3_ROUND_003_SNAPSHOT_NUMERIC_FIELDS) finiteNumber(value[field], `Snapshot ${index} ${field}`);
  const pullbackAge = finiteNumber(value.nearestBaselinePullbackTouchAgeBars, `Snapshot ${index} pullback age`);
  if (!Number.isInteger(pullbackAge) || pullbackAge < 1) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `Snapshot ${index} pullback age is invalid.`);
  }
  if (
    finiteNumber(value.symbol4hAtr, `Snapshot ${index} symbol4hAtr`) <= 0
    || finiteNumber(value.current1hAtr, `Snapshot ${index} current1hAtr`) <= 0
    || finiteNumber(value.previous20Closed1hQuoteVolumeMean, `Snapshot ${index} previous20Closed1hQuoteVolumeMean`) <= 0
  ) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `Snapshot ${index} denominator is invalid.`);
  }
  return value as unknown as M3R2DecisionSnapshot;
}

export function parseM3R3Round002SnapshotArtifact(value: unknown): M3R3SnapshotArtifact {
  if (!isRecord(value)) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Round-002 snapshot artifact is not an object.");
  if (value.schemaVersion !== M3_R3_ROUND_003_SNAPSHOT_SCHEMA) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot schema mismatch.");
  if (value.researchRoundId !== M3_R3_ROUND_003_EXPECTED_SOURCE_ROUND) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot research round mismatch.");
  if (value.executionSourceSha !== M3_R3_ROUND_003_EXPECTED_EXECUTION_SOURCE_SHA) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot execution source mismatch.");
  if (value.selectionGateSha256 !== M3_R3_ROUND_003_EXPECTED_SOURCE_GATE_SHA256) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot gate SHA mismatch.");
  if (value.experimentPlanSha256 !== M3_R3_ROUND_003_EXPECTED_SOURCE_PLAN_SHA256) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot plan SHA mismatch.");
  if (value.backtestPolicyVersion !== M3_R3_ROUND_003_POLICY || value.strategyVersion !== M3_R3_ROUND_003_STRATEGY) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot strategy/policy mismatch.");
  }
  if (value.studyServerTime !== M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot studyServerTime mismatch.");
  if (value.controlReportSha256 !== M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot CONTROL SHA mismatch.");
  if (value.snapshotCount !== M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT || !Array.isArray(value.snapshots) || value.snapshots.length !== value.snapshotCount) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Snapshot count mismatch.");
  }
  const snapshots = value.snapshots.map((snapshot, index) => parseM3R3DecisionSnapshot(snapshot, index));
  canonicalM3R3IdentityStrings(snapshots);
  return deepFreeze({
    schemaVersion: M3_R3_ROUND_003_SNAPSHOT_SCHEMA,
    researchRoundId: M3_R3_ROUND_003_EXPECTED_SOURCE_ROUND,
    executionSourceSha: M3_R3_ROUND_003_EXPECTED_EXECUTION_SOURCE_SHA,
    selectionGateSha256: M3_R3_ROUND_003_EXPECTED_SOURCE_GATE_SHA256,
    experimentPlanSha256: M3_R3_ROUND_003_EXPECTED_SOURCE_PLAN_SHA256,
    backtestPolicyVersion: M3_R3_ROUND_003_POLICY,
    strategyVersion: M3_R3_ROUND_003_STRATEGY,
    studyServerTime: M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME,
    controlReportSha256: M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256,
    snapshotCount: M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT,
    snapshots,
  });
}

function validateControlSignalResultShape(value: unknown, index: number): void {
  if (!isRecord(value) || !isRecord(value.snapshot)) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `CONTROL result ${index} is malformed.`);
  validateM3R3IdentityRecord(value.snapshot);
  if (typeof value.status !== "string" || !(M3_R3_ROUND_003_ALLOWED_CONTROL_STATUSES as readonly string[]).includes(value.status)) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", `CONTROL result ${index} status is invalid.`);
  }
}

export function validateM3R3ControlReportContract(value: unknown): IntrabarBacktestReport {
  if (!isRecord(value)) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL report is not an object.");
  if (value.schemaVersion !== M3_R3_ROUND_003_CONTROL_SCHEMA) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL schema mismatch.");
  if (value.backtestPolicyVersion !== M3_R3_ROUND_003_POLICY) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL policy mismatch.");
  if (value.strategyVersion !== M3_R3_ROUND_003_STRATEGY) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL strategy mismatch.");
  if (value.period !== "COMBINED") fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL period mismatch.");
  if (value.studyServerTime !== M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL studyServerTime mismatch.");
  if (!Array.isArray(value.signalResults) || value.signalResults.length !== M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL formal signal count mismatch.");
  }
  if (!Array.isArray(value.diagnostics) || value.diagnostics.length !== 0) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL diagnostics are not empty.");
  value.signalResults.forEach(validateControlSignalResultShape);
  const executedCount = value.signalResults.filter((result) => isRecord(result) && result.status === "EXECUTED").length;
  if (executedCount !== M3_R3_ROUND_003_EXPECTED_EXECUTED_COUNT) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL executed count mismatch.");
  if (value.signalResults.some((result) => isRecord(result) && (result.status === "DATA_INCOMPLETE" || result.status === "SETTLEMENT_AMBIGUOUS"))) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "CONTROL contains an incomplete or ambiguous result.");
  }
  return value as unknown as IntrabarBacktestReport;
}

export function parseM3R3ControlReportBytes(bytes: Uint8Array): IntrabarBacktestReport {
  return validateM3R3ControlReportContract(parseUtf8Json(bytes, "CONTROL report"));
}

function validateRound001EvidenceShape(value: unknown): M3HResearchEvidence {
  if (!isRecord(value) || !isRecord(value.control)) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Round-001 evidence is malformed.");
  if (value.schemaVersion !== "m3-h-round-001-report-001" || value.controlReportSchemaVersion !== M3_R3_ROUND_003_CONTROL_SCHEMA) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Round-001 evidence schema mismatch.");
  }
  if (
    value.researchRoundId !== "baseline-002-research-round-001"
    || value.selectionGateSha256 !== "11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd"
    || value.experimentPlanSha256 !== "2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a"
    || value.executionSourceSha !== "7b3fa166d01fde79dc95ced182c3c515f904a847"
    || value.controlReportSha256 !== "0d620013f85bff28de11fc9ca4765d300d29630a0e0e04f9175e9c6b97715020"
    || value.studyServerTime !== 1787016706276
    || value.dataClassification !== "RESEARCH_AVAILABLE_SEEN_DATA"
  ) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Round-001 evidence provenance mismatch.");
  }
  if (value.strategyVersion !== M3_R3_ROUND_003_STRATEGY || value.backtestPolicyVersion !== M3_R3_ROUND_003_POLICY || value.evidenceStatus !== "COMPLETE") {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Round-001 evidence contract mismatch.");
  }
  if (!isRecord(value.control.aggregateValidation) || !isRecord(value.control.aggregateValidation.diagnostics) || !Array.isArray(value.control.folds) || value.control.folds.length !== 6) {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Round-001 CONTROL diagnostics are incomplete.");
  }
  if (typeof value.control.formalIdentitySha256 !== "string" || typeof value.control.executedIdentitySha256 !== "string") {
    fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Round-001 CONTROL identity hashes are missing.");
  }
  for (const fold of value.control.folds) {
    if (!isRecord(fold) || !isRecord(fold.diagnostics)) fail("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED", "Round-001 fold diagnostics are malformed.");
  }
  return value as unknown as M3HResearchEvidence;
}

export function parseM3R3Round001EvidenceBytes(bytes: Uint8Array): M3HResearchEvidence {
  if (sha256M3R3RawBytes(bytes) !== M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256) {
    fail("ROUND_003_INPUT_ARTIFACT_HASH_MISMATCH", "Round-001 evidence SHA-256 mismatch.");
  }
  return validateRound001EvidenceShape(parseUtf8Json(bytes, "Round-001 evidence"));
}

export type M3R3VerifiedArtifactReuse = Readonly<{
  artifactReuseStatus: typeof M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS;
  controlReportSha256: string;
  decisionSnapshotArtifactSha256: string;
  studyServerTime: number;
  snapshotCount: number;
  controlReport: IntrabarBacktestReport;
  decisionSnapshots: readonly M3R2DecisionSnapshot[];
}>;

export function verifyM3R3Round002InputArtifacts(input: Readonly<{
  controlReportBytes: Uint8Array;
  decisionSnapshotBytes: Uint8Array;
}>): M3R3VerifiedArtifactReuse {
  const controlReportSha256 = sha256M3R3RawBytes(input.controlReportBytes);
  const decisionSnapshotArtifactSha256 = sha256M3R3RawBytes(input.decisionSnapshotBytes);
  if (controlReportSha256 !== M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256) {
    fail("ROUND_003_INPUT_ARTIFACT_HASH_MISMATCH", "Round-002 CONTROL artifact SHA-256 mismatch.");
  }
  if (decisionSnapshotArtifactSha256 !== M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256) {
    fail("ROUND_003_INPUT_ARTIFACT_HASH_MISMATCH", "Round-002 decision snapshot artifact SHA-256 mismatch.");
  }
  const controlReport = parseM3R3ControlReportBytes(input.controlReportBytes);
  const snapshotArtifact = parseM3R3Round002SnapshotArtifact(parseUtf8Json(input.decisionSnapshotBytes, "Round-002 decision snapshots"));
  return Object.freeze({
    artifactReuseStatus: M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS,
    controlReportSha256,
    decisionSnapshotArtifactSha256,
    studyServerTime: snapshotArtifact.studyServerTime,
    snapshotCount: snapshotArtifact.snapshotCount,
    controlReport,
    decisionSnapshots: snapshotArtifact.snapshots,
  });
}

export type M3R3ControlParityResult = Readonly<{ controlParityStatus: "PASS" }>;

function parityFailure(detail: string): never {
  throw new M3R3RecoveryError("ROUND_003_CONTROL_PARITY_FAILED", detail);
}

function exactEqual(left: unknown, right: unknown, label: string): void {
  if (stableStringify(left) !== stableStringify(right)) parityFailure(`${label} drift.`);
}

export function validateM3R3ControlParity(input: Readonly<{
  controlReport: BacktestReport;
  round001Evidence: M3HResearchEvidence;
}>): M3R3ControlParityResult {
  try {
    const report = validateM3R3ControlReportContract(input.controlReport);
    const records = report.signalResults.map(adaptBacktestSignalResult);
    exactEqual(m3R3FormalIdentityHash(records), input.round001Evidence.control.formalIdentitySha256, "formal identity SHA");
    exactEqual(m3R3ExecutedIdentityHash(records), input.round001Evidence.control.executedIdentitySha256, "executed identity SHA");
    exactEqual(
      calculateM3R3AggregateDiagnostics(records),
      input.round001Evidence.control.aggregateValidation?.diagnostics,
      "aggregate validation diagnostics",
    );
    for (const foldId of M3_R3_ROUND_003_FOLD_IDS) {
      const range = getResearchFoldRoleRange(foldId, "VALIDATION");
      const foldRecords = selectRecordsForFoldRole(records, foldId, "VALIDATION");
      const expectedFold = input.round001Evidence.control.folds.find((fold) => fold.foldId === foldId);
      if (!expectedFold) parityFailure(`${foldId} evidence is missing.`);
      exactEqual(calculateResearchDiagnostics({ records: foldRecords, range }), expectedFold.diagnostics, `${foldId} diagnostics`);
    }
    return Object.freeze({ controlParityStatus: "PASS" });
  } catch (error) {
    if (error instanceof M3R3RecoveryError && error.code === "ROUND_003_CONTROL_PARITY_FAILED") throw error;
    parityFailure(error instanceof Error ? error.message : "CONTROL parity failed.");
  }
}
