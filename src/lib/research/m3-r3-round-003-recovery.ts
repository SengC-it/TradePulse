import { createHash } from "node:crypto";

import {
  RESEARCH_DIRECTION_ORDER,
  RESEARCH_SYMBOL_ORDER,
  type ResearchDirection,
} from "./constants.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange, validateResearchRange } from "./folds.ts";
import type { NormalizedResearchSignal, ResearchDiagnostics, ResearchRange } from "./types.ts";
import { deepFreeze, requireSafeTimestamp, stableStringify } from "./utils.ts";

export const M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256 =
  "5ecfae3258d2ace774965eba12df25b888b04593b32e1b92a2593c41fdad8b33" as const;
export const M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256 =
  "65a011d813c55f936f89069706730f5de33dfda9f2eba94f0dfb2b914818eec9" as const;
export const M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME = 1787031883099 as const;
export const M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT = 7500 as const;
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

export class M3R3RecoveryError extends Error {
  public readonly name = "M3R3RecoveryError";
}

type IdentityRecord = Pick<NormalizedResearchSignal, "signalTime" | "symbol" | "direction">;

function fail(message: string): never {
  throw new M3R3RecoveryError(message);
}

function symbolIndex(symbol: IdentityRecord["symbol"]): number {
  const index = RESEARCH_SYMBOL_ORDER.indexOf(symbol);
  if (index < 0) fail(`Unsupported identity symbol: ${symbol}.`);
  return index;
}

function directionIndex(direction: ResearchDirection): number {
  const index = RESEARCH_DIRECTION_ORDER.indexOf(direction);
  if (index < 0) fail(`Unsupported identity direction: ${direction}.`);
  return index;
}

export function compareM3R3CanonicalIdentities(left: IdentityRecord, right: IdentityRecord): number {
  return left.signalTime - right.signalTime || symbolIndex(left.symbol) - symbolIndex(right.symbol) || directionIndex(left.direction) - directionIndex(right.direction);
}

export function m3R3Identity(record: IdentityRecord): string {
  requireSafeTimestamp(record.signalTime, "M3-R3 identity signalTime");
  return `${record.symbol}|${record.direction}|${record.signalTime}`;
}

export function canonicalM3R3IdentityStrings(records: readonly IdentityRecord[]): readonly string[] {
  const ordered = [...records].sort(compareM3R3CanonicalIdentities);
  const identities = ordered.map(m3R3Identity);
  if (new Set(identities).size !== identities.length) fail("Duplicate M3-R3 identity.");
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

export type M3R3Round002SnapshotEnvelope = Readonly<{
  researchRoundId: string;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  studyServerTime: number;
  controlReportSha256: string;
  snapshotCount: number;
}>;

export type M3R3VerifiedArtifactReuse = Readonly<{
  artifactReuseStatus: typeof M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS;
  controlReportSha256: string;
  decisionSnapshotArtifactSha256: string;
  studyServerTime: number;
  snapshotCount: number;
}>;

export function verifyM3R3Round002InputArtifacts(input: Readonly<{
  controlReportBytes: Uint8Array;
  decisionSnapshotBytes: Uint8Array;
  snapshotEnvelope: M3R3Round002SnapshotEnvelope;
}>): M3R3VerifiedArtifactReuse {
  const controlReportSha256 = sha256M3R3RawBytes(input.controlReportBytes);
  const decisionSnapshotArtifactSha256 = sha256M3R3RawBytes(input.decisionSnapshotBytes);
  if (controlReportSha256 !== M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256) {
    fail("Round-003 CONTROL artifact SHA-256 mismatch.");
  }
  if (decisionSnapshotArtifactSha256 !== M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256) {
    fail("Round-003 decision snapshot artifact SHA-256 mismatch.");
  }
  const envelope = input.snapshotEnvelope;
  if (
    envelope.researchRoundId !== M3_R3_ROUND_003_EXPECTED_SOURCE_ROUND ||
    envelope.executionSourceSha !== M3_R3_ROUND_003_EXPECTED_EXECUTION_SOURCE_SHA ||
    envelope.selectionGateSha256 !== M3_R3_ROUND_003_EXPECTED_SOURCE_GATE_SHA256 ||
    envelope.experimentPlanSha256 !== M3_R3_ROUND_003_EXPECTED_SOURCE_PLAN_SHA256 ||
    envelope.studyServerTime !== M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME ||
    envelope.controlReportSha256 !== M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256 ||
    envelope.snapshotCount !== M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT
  ) {
    fail("Round-003 reused snapshot envelope mismatch.");
  }
  return Object.freeze({
    artifactReuseStatus: M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS,
    controlReportSha256,
    decisionSnapshotArtifactSha256,
    studyServerTime: envelope.studyServerTime,
    snapshotCount: envelope.snapshotCount,
  });
}
