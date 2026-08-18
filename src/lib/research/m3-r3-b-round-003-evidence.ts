import type { BacktestSignalResult, IntrabarBacktestReport } from "../backtest/types.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import {
  RESEARCH_FOLD_IDS,
  type ResearchFoldId,
} from "./constants.ts";
import {
  calculateResearchDiagnostics,
} from "./diagnostics.ts";
import {
  getResearchFoldRoleRange,
  selectRecordsForFoldRole,
} from "./folds.ts";
import {
  M3_R2_ROUND_002_CANDIDATE_DEFINITIONS,
  M3_R2_ROUND_002_CONTROL_ID,
} from "./m3-r2-round-002-plan.ts";
import type { M3R2DecisionSnapshot } from "./m3-r2-decision-snapshot.ts";
import {
  selectM3R2CandidateSnapshots,
  m3R2DecisionSnapshotIdentity,
} from "./m3-r2-selectors.ts";
import {
  M3_R3_ROUND_003_CANDIDATE_IDS,
  M3_R3_ROUND_003_PERFORMANCE_LOCK,
  M3_R3_ROUND_003_RESEARCH_ROUND_ID,
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
} from "./selection-gates-round-003.ts";
import {
  M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256,
  M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256,
  M3_R3_ROUND_003_EXPECTED_EXECUTED_COUNT,
  M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256,
  M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT,
  M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME,
  M3_R3_ROUND_003_EXPECTED_SOURCE_GATE_SHA256,
  M3_R3_ROUND_003_EXPECTED_SOURCE_PLAN_SHA256,
  M3_R3_ROUND_003_EXPECTED_EXECUTION_SOURCE_SHA,
  M3_R3_ROUND_003_EXPECTED_SOURCE_ROUND,
  M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS,
  M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE,
  calculateM3R3AggregateDiagnostics,
  M3R3RecoveryError,
  canonicalM3R3IdentityStrings,
  m3R3ExecutedIdentityHash,
  m3R3FormalIdentityHash,
  parseM3R3Round001EvidenceBytes,
  sha256M3R3RawBytes,
  validateM3R3ControlParity,
  verifyM3R3Round002InputArtifacts,
} from "./m3-r3-round-003-recovery.ts";
import {
  M3_R3_ROUND_003_PLAN,
  M3_R3_ROUND_003_PLAN_SHA256,
  validateM3R3Round003Plan,
} from "./m3-r3-round-003-plan.ts";
import type {
  M3HResearchEvidence,
} from "./m3-h-evidence.ts";
import type {
  NormalizedResearchSignal,
  ResearchDiagnostics,
  ResearchRange,
} from "./types.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R3_B_REPORT_SCHEMA_VERSION = "m3-r3-round-003-report-001" as const;
export const M3_R3_B_STRATEGY_VERSION = "baseline-001" as const;
export const M3_R3_B_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R3_B_CONTROL_REPORT_SCHEMA_VERSION = "m3-b-report-004" as const;
export const M3_R3_B_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;
export const M3_R3_B_RECOVERY_MAIN_BASE_SHA = "1399ef6921b2930fb51d49c1b8c29260f1087678" as const;
export const M3_R3_B_REUSE_VERIFICATION_SCHEMA = "m3-r3-a-reuse-verification-001" as const;
export const M3_R3_B_REUSE_VERIFICATION_SOURCE_SHA = "f50ec319573fddd186cd9ebb194da30ec1298501" as const;
export const M3_R3_B_DECISION = "DEFER_TO_M3_R3_C_FROZEN_GATE_APPLICATION" as const;
export const M3_R3_B_PERFORMANCE_LOCK = M3_R3_ROUND_003_PERFORMANCE_LOCK;
export const M3_R3_B_AGGREGATE_RANGE: ResearchRange = M3_R3_ROUND_003_AGGREGATE_VALIDATION_RANGE;

type CandidateId = (typeof M3_R3_ROUND_003_CANDIDATE_IDS)[number];
type CandidateSelectionMap = Readonly<Record<CandidateId, readonly M3R2DecisionSnapshot[]>>;

export type M3R3AReuseVerification = Readonly<{
  schemaVersion: typeof M3_R3_B_REUSE_VERIFICATION_SCHEMA;
  researchRoundId: typeof M3_R3_ROUND_003_RESEARCH_ROUND_ID;
  verificationSourceSha: typeof M3_R3_B_REUSE_VERIFICATION_SOURCE_SHA;
  controlReportSha256: typeof M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256;
  decisionSnapshotArtifactSha256: typeof M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256;
  round001EvidenceSha256: typeof M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256;
  studyServerTime: typeof M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME;
  snapshotCount: typeof M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT;
  artifactReuseStatus: typeof M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS;
  controlValidationStatus: "PASS";
  controlParityStatus: "PASS";
}>;

export type M3R3BFoldEvidence = Readonly<{
  foldId: ResearchFoldId;
  foldRole: "VALIDATION";
  range: ResearchRange;
  diagnostics: ResearchDiagnostics;
}>;

export type M3R3BVariantEvidence = Readonly<{
  candidateId: string;
  complexity: Readonly<{
    newRules: number;
    newTunableThresholds: number;
    modifiedBaselineRules: number;
    mechanismFamiliesUsed: number;
  }>;
  selectedFormalSignals: number;
  executedTrades: number;
  formalIdentitySha256: string;
  executedIdentitySha256: string;
  aggregateValidation: Readonly<{
    range: ResearchRange;
    diagnostics: ResearchDiagnostics;
  }>;
  folds: readonly M3R3BFoldEvidence[];
  aggregateExpectancyDeltaVsControl: number | null;
  foldExpectancyDeltaVsControl: Readonly<Record<ResearchFoldId, number | null>>;
  redundancyApplicability: "NOT_APPLICABLE";
  redundancyRelativeReductionVsControl: null;
}>;

export type M3R3BResearchEvidence = Readonly<{
  schemaVersion: typeof M3_R3_B_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R3_ROUND_003_RESEARCH_ROUND_ID;
  selectionGateSha256: typeof BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R3_ROUND_003_PLAN_SHA256;
  recoveryMainBaseSha: typeof M3_R3_B_RECOVERY_MAIN_BASE_SHA;
  executionSourceSha: string;
  reusedControlReportSha256: typeof M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256;
  reusedDecisionSnapshotArtifactSha256: typeof M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256;
  reusedRound001EvidenceSha256: typeof M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256;
  reuseVerificationSourceSha: typeof M3_R3_B_REUSE_VERIFICATION_SOURCE_SHA;
  studyServerTime: typeof M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME;
  snapshotCount: typeof M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT;
  controlFormalSignals: typeof M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT;
  controlExecutedTrades: typeof M3_R3_ROUND_003_EXPECTED_EXECUTED_COUNT;
  strategyVersion: typeof M3_R3_B_STRATEGY_VERSION;
  backtestPolicyVersion: typeof M3_R3_B_POLICY_VERSION;
  controlReportSchemaVersion: typeof M3_R3_B_CONTROL_REPORT_SCHEMA_VERSION;
  dataClassification: typeof M3_R3_B_DATA_CLASSIFICATION;
  performanceLock: typeof M3_R3_B_PERFORMANCE_LOCK;
  performanceLockTriggered: true;
  evidenceStatus: "COMPLETE";
  decision: typeof M3_R3_B_DECISION;
  control: M3R3BVariantEvidence;
  candidates: readonly M3R3BVariantEvidence[];
}>;

export class M3R3BEvidenceError extends Error {
  public readonly name = "M3R3BEvidenceError";
  public constructor(message: string) {
    super(message);
  }
}

export class M3R3BPerformanceLockError extends M3R3BEvidenceError {
  public readonly performanceLockTriggered = true as const;
  public constructor(message: string) {
    super(message);
  }
}

function fail(message: string): never {
  throw new M3R3BEvidenceError(message);
}

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) fail(`${label} mismatch.`);
}

function expectNonEmptySha(value: string, label: string): void {
  if (!/^[0-9a-f]{40}$/u.test(value)) fail(`${label} must be a 40-character lowercase SHA-1.`);
}

function exactIdentitySet(
  left: readonly string[],
  right: readonly string[],
  label: string,
): void {
  if (stableStringify(left) !== stableStringify(right)) fail(`${label} mismatch.`);
}

function resultIdentity(result: Pick<BacktestSignalResult, "snapshot">): string {
  return `${result.snapshot.symbol}|${result.snapshot.direction}|${result.snapshot.signalTime}`;
}

function validateReuseVerification(value: unknown): M3R3AReuseVerification {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("R3-A reuse verification is malformed.");
  const record = value as Record<string, unknown>;
  expectEqual(record.schemaVersion, M3_R3_B_REUSE_VERIFICATION_SCHEMA, "R3-A reuse verification schema");
  expectEqual(record.researchRoundId, M3_R3_ROUND_003_RESEARCH_ROUND_ID, "R3-A reuse research round");
  expectEqual(record.verificationSourceSha, M3_R3_B_REUSE_VERIFICATION_SOURCE_SHA, "R3-A verification source SHA");
  expectEqual(record.controlReportSha256, M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256, "R3-A CONTROL SHA");
  expectEqual(record.decisionSnapshotArtifactSha256, M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256, "R3-A snapshot SHA");
  expectEqual(record.round001EvidenceSha256, M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256, "R3-A Round-001 evidence SHA");
  expectEqual(record.studyServerTime, M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME, "R3-A studyServerTime");
  expectEqual(record.snapshotCount, M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT, "R3-A snapshotCount");
  expectEqual(record.artifactReuseStatus, M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS, "R3-A artifact reuse status");
  expectEqual(record.controlValidationStatus, "PASS", "R3-A CONTROL validation status");
  expectEqual(record.controlParityStatus, "PASS", "R3-A CONTROL parity status");
  return record as unknown as M3R3AReuseVerification;
}

export function validateM3R3BPreflight(input: Readonly<{
  executionSourceSha: string;
  recoveryMainBaseSha: string;
  reuseVerification: unknown;
}>): M3R3AReuseVerification {
  expectNonEmptySha(input.executionSourceSha, "executionSourceSha");
  expectEqual(input.recoveryMainBaseSha, M3_R3_B_RECOVERY_MAIN_BASE_SHA, "recovery main base SHA");
  expectEqual(M3_R3_ROUND_003_EXPECTED_EXECUTION_SOURCE_SHA, "9df170b7f72a95971825e126d4096e1e4f16be5f", "R3-A execution source contract");
  expectEqual(M3_R3_ROUND_003_EXPECTED_SOURCE_ROUND, "baseline-002-research-round-002", "R3-A source research round");
  expectEqual(M3_R3_ROUND_003_EXPECTED_SOURCE_GATE_SHA256, "9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0", "R3-A source gate SHA");
  expectEqual(M3_R3_ROUND_003_EXPECTED_SOURCE_PLAN_SHA256, "82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511", "R3-A source plan SHA");
  validateM3R3Round003Plan();
  expectEqual(M3_R3_ROUND_003_PLAN.selectionGateSha256, BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256, "Round-003 selection gate SHA");
  expectEqual(M3_R3_ROUND_003_PLAN_SHA256, "d4238bec817425fddd4a1e556277aa58de84c5986da55a9e08b661cc9f621e67", "Round-003 plan SHA");
  return validateReuseVerification(input.reuseVerification);
}

export function validateM3R3BIdentitySets(input: Readonly<{
  controlResults: readonly BacktestSignalResult[];
  decisionSnapshots: readonly M3R2DecisionSnapshot[];
  expectedSnapshotCount?: number;
}>): Readonly<{ controlIdentityStrings: readonly string[]; snapshotIdentityStrings: readonly string[] }> {
  const controlIdentityStrings = canonicalM3R3IdentityStrings(input.controlResults.map((result) => result.snapshot));
  const snapshotIdentityStrings = canonicalM3R3IdentityStrings(input.decisionSnapshots);
  exactIdentitySet(controlIdentityStrings, snapshotIdentityStrings, "CONTROL/snapshot identity set");
  if (controlIdentityStrings.length !== (input.expectedSnapshotCount ?? M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT)) fail("CONTROL/snapshot identity count mismatch.");
  return deepFreeze({ controlIdentityStrings, snapshotIdentityStrings });
}

export function validateM3R3BCandidateSelections(input: Readonly<{
  controlResults: readonly BacktestSignalResult[];
  decisionSnapshots: readonly M3R2DecisionSnapshot[];
  candidateSelections: CandidateSelectionMap;
  expectedSnapshotCount?: number;
}>): CandidateSelectionMap {
  const { controlIdentityStrings } = validateM3R3BIdentitySets(input);
  const controlIdentitySet = new Set(controlIdentityStrings);
  for (const candidateId of M3_R3_ROUND_003_CANDIDATE_IDS) {
    const selected = input.candidateSelections[candidateId];
    if (!selected) fail(`Candidate selection is missing: ${candidateId}.`);
    const selectedIdentityStrings = canonicalM3R3IdentityStrings(selected);
    if (selectedIdentityStrings.length === 0 || selectedIdentityStrings.length >= controlIdentityStrings.length) {
      fail(`Candidate ${candidateId} is not a strict non-empty subset.`);
    }
    for (const identity of selectedIdentityStrings) {
      if (!controlIdentitySet.has(identity)) fail(`Candidate ${candidateId} contains a non-CONTROL identity: ${identity}.`);
    }
    for (const snapshot of selected) {
      if (!input.decisionSnapshots.includes(snapshot)) fail(`Candidate ${candidateId} contains a foreign snapshot reference.`);
    }
  }
  return input.candidateSelections;
}

function controlResultMap(results: readonly BacktestSignalResult[]): ReadonlyMap<string, BacktestSignalResult> {
  const map = new Map<string, BacktestSignalResult>();
  for (const result of results) {
    const identity = resultIdentity(result);
    if (map.has(identity)) fail(`Duplicate CONTROL formal identity: ${identity}.`);
    map.set(identity, result);
  }
  return map;
}

function foldEvidence(records: readonly NormalizedResearchSignal[]): readonly M3R3BFoldEvidence[] {
  return Object.freeze(RESEARCH_FOLD_IDS.map((foldId) => {
    const range = getResearchFoldRoleRange(foldId, "VALIDATION");
    const foldRecords = selectRecordsForFoldRole(records, foldId, "VALIDATION");
    return deepFreeze({
      foldId,
      foldRole: "VALIDATION" as const,
      range,
      diagnostics: calculateResearchDiagnostics({ records: foldRecords, range }),
    });
  }));
}

function foldDelta(
  candidate: readonly M3R3BFoldEvidence[],
  control: readonly M3R3BFoldEvidence[],
): Readonly<Record<ResearchFoldId, number | null>> {
  return Object.freeze(Object.fromEntries(RESEARCH_FOLD_IDS.map((foldId) => {
    const candidateValue = candidate.find((fold) => fold.foldId === foldId)?.diagnostics.expectancyR;
    const controlValue = control.find((fold) => fold.foldId === foldId)?.diagnostics.expectancyR;
    return [foldId, candidateValue === null || candidateValue === undefined || controlValue === null || controlValue === undefined
      ? null
      : candidateValue - controlValue];
  })) as Record<ResearchFoldId, number | null>);
}

function buildVariant(
  candidateId: string,
  complexity: M3R3BVariantEvidence["complexity"],
  results: readonly BacktestSignalResult[],
  control: M3R3BVariantEvidence | null,
): M3R3BVariantEvidence {
  const records = results.map(adaptBacktestSignalResult);
  const aggregateValidation = deepFreeze({
    range: M3_R3_B_AGGREGATE_RANGE,
    diagnostics: calculateM3R3AggregateDiagnostics(records, M3_R3_B_AGGREGATE_RANGE),
  });
  const folds = foldEvidence(records);
  const aggregateExpectancyDeltaVsControl = control === null || aggregateValidation.diagnostics.expectancyR === null || control.aggregateValidation.diagnostics.expectancyR === null
    ? null
    : aggregateValidation.diagnostics.expectancyR - control.aggregateValidation.diagnostics.expectancyR;
  return deepFreeze({
    candidateId,
    complexity,
    selectedFormalSignals: results.length,
    executedTrades: results.filter((result) => result.status === "EXECUTED").length,
    formalIdentitySha256: m3R3FormalIdentityHash(records),
    executedIdentitySha256: m3R3ExecutedIdentityHash(records),
    aggregateValidation,
    folds,
    aggregateExpectancyDeltaVsControl,
    foldExpectancyDeltaVsControl: control === null ? Object.freeze(Object.fromEntries(RESEARCH_FOLD_IDS.map((foldId) => [foldId, null])) as Record<ResearchFoldId, number | null>) : foldDelta(folds, control.folds),
    redundancyApplicability: "NOT_APPLICABLE" as const,
    redundancyRelativeReductionVsControl: null,
  });
}

function candidateDefinition(candidateId: CandidateId): (typeof M3_R2_ROUND_002_CANDIDATE_DEFINITIONS)[number] {
  const definition = M3_R2_ROUND_002_CANDIDATE_DEFINITIONS.find((candidate) => candidate.candidateId === candidateId);
  if (!definition) fail(`Frozen candidate definition is missing: ${candidateId}.`);
  return definition;
}

export function deriveM3R3BFromVerifiedArtifacts(input: Readonly<{
  controlReport: IntrabarBacktestReport;
  decisionSnapshots: readonly M3R2DecisionSnapshot[];
  round001Evidence: M3HResearchEvidence;
  controlReportSha256: string;
  decisionSnapshotArtifactSha256: string;
  round001EvidenceSha256: string;
  reuseVerification: M3R3AReuseVerification;
  executionSourceSha: string;
  recoveryMainBaseSha: string;
}>): M3R3BResearchEvidence {
  validateM3R3BPreflight({
    executionSourceSha: input.executionSourceSha,
    recoveryMainBaseSha: input.recoveryMainBaseSha,
    reuseVerification: input.reuseVerification,
  });
  expectEqual(input.controlReportSha256, M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256, "CONTROL artifact SHA");
  expectEqual(input.decisionSnapshotArtifactSha256, M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256, "snapshot artifact SHA");
  expectEqual(input.round001EvidenceSha256, M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256, "Round-001 evidence SHA");
  expectEqual(input.controlReport.studyServerTime, M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME, "CONTROL studyServerTime");
  expectEqual(input.decisionSnapshots.length, M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT, "snapshot count");
  expectEqual(input.controlReport.signalResults.length, M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT, "CONTROL formal count");
  expectEqual(input.controlReport.signalResults.filter((result) => result.status === "EXECUTED").length, M3_R3_ROUND_003_EXPECTED_EXECUTED_COUNT, "CONTROL executed count");
  validateM3R3ControlParity({ controlReport: input.controlReport, round001Evidence: input.round001Evidence });
  const identitySets = validateM3R3BIdentitySets({ controlResults: input.controlReport.signalResults, decisionSnapshots: input.decisionSnapshots });
  const selections = Object.fromEntries(M3_R3_ROUND_003_CANDIDATE_IDS.map((candidateId) => [
    candidateId,
    selectM3R2CandidateSnapshots(candidateId, input.decisionSnapshots),
  ])) as CandidateSelectionMap;
  validateM3R3BCandidateSelections({
    controlResults: input.controlReport.signalResults,
    decisionSnapshots: input.decisionSnapshots,
    candidateSelections: selections,
  });
  const resultsByIdentity = controlResultMap(input.controlReport.signalResults);
  const controlDefinition = M3_R2_ROUND_002_CANDIDATE_DEFINITIONS.find((candidate) => candidate.candidateId === M3_R2_ROUND_002_CONTROL_ID);
  if (!controlDefinition) fail("Frozen CONTROL definition is missing.");
  const control = buildVariant(M3_R2_ROUND_002_CONTROL_ID, controlDefinition.complexity, input.controlReport.signalResults, null);
  let performanceLockTriggered = false;
  const candidates = M3_R3_ROUND_003_CANDIDATE_IDS.map((candidateId) => {
    try {
      const selectedResults = selections[candidateId].map((snapshot) => {
        const result = resultsByIdentity.get(m3R2DecisionSnapshotIdentity(snapshot));
        if (!result) fail(`Candidate ${candidateId} identity is absent from CONTROL.`);
        return result;
      });
      const variant = buildVariant(candidateId, candidateDefinition(candidateId).complexity, selectedResults, control);
      performanceLockTriggered = true;
      return variant;
    } catch (error) {
      if (performanceLockTriggered) throw new M3R3BPerformanceLockError(`Round-003 invalid after performance lock: ${error instanceof Error ? error.message : String(error)}.`);
      throw error;
    }
  });
  if (!performanceLockTriggered) throw new M3R3BPerformanceLockError("No candidate performance result generated.");
  if (identitySets.controlIdentityStrings.length !== input.controlReport.signalResults.length) fail("CONTROL identity cardinality drift.");
  return deepFreeze({
    schemaVersion: M3_R3_B_REPORT_SCHEMA_VERSION,
    researchRoundId: M3_R3_ROUND_003_RESEARCH_ROUND_ID,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R3_ROUND_003_PLAN_SHA256,
    recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA,
    executionSourceSha: input.executionSourceSha,
    reusedControlReportSha256: input.controlReportSha256 as typeof M3_R3_ROUND_003_EXPECTED_CONTROL_REPORT_SHA256,
    reusedDecisionSnapshotArtifactSha256: input.decisionSnapshotArtifactSha256 as typeof M3_R3_ROUND_003_EXPECTED_DECISION_SNAPSHOT_SHA256,
    reusedRound001EvidenceSha256: input.round001EvidenceSha256 as typeof M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256,
    reuseVerificationSourceSha: M3_R3_B_REUSE_VERIFICATION_SOURCE_SHA,
    studyServerTime: input.controlReport.studyServerTime as typeof M3_R3_ROUND_003_EXPECTED_STUDY_SERVER_TIME,
    snapshotCount: M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT,
    controlFormalSignals: M3_R3_ROUND_003_EXPECTED_SNAPSHOT_COUNT,
    controlExecutedTrades: M3_R3_ROUND_003_EXPECTED_EXECUTED_COUNT,
    strategyVersion: M3_R3_B_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R3_B_POLICY_VERSION,
    controlReportSchemaVersion: M3_R3_B_CONTROL_REPORT_SCHEMA_VERSION,
    dataClassification: M3_R3_B_DATA_CLASSIFICATION,
    performanceLock: M3_R3_B_PERFORMANCE_LOCK,
    performanceLockTriggered,
    evidenceStatus: "COMPLETE" as const,
    decision: M3_R3_B_DECISION,
    control,
    candidates: Object.freeze(candidates),
  });
}

export function deriveM3R3BRound003Evidence(input: Readonly<{
  controlReportBytes: Uint8Array;
  decisionSnapshotBytes: Uint8Array;
  round001EvidenceBytes: Uint8Array;
  reuseVerification: unknown;
  executionSourceSha: string;
  recoveryMainBaseSha: string;
}>): M3R3BResearchEvidence {
  try {
    const verified = verifyM3R3Round002InputArtifacts({
      controlReportBytes: input.controlReportBytes,
      decisionSnapshotBytes: input.decisionSnapshotBytes,
    });
    const round001EvidenceSha256 = sha256M3R3RawBytes(input.round001EvidenceBytes);
    const round001Evidence = parseM3R3Round001EvidenceBytes(input.round001EvidenceBytes);
    return deriveM3R3BFromVerifiedArtifacts({
      controlReport: verified.controlReport,
      decisionSnapshots: verified.decisionSnapshots,
      round001Evidence,
      controlReportSha256: verified.controlReportSha256,
      decisionSnapshotArtifactSha256: verified.decisionSnapshotArtifactSha256,
      round001EvidenceSha256,
      reuseVerification: validateReuseVerification(input.reuseVerification),
      executionSourceSha: input.executionSourceSha,
      recoveryMainBaseSha: input.recoveryMainBaseSha,
    });
  } catch (error) {
    if (error instanceof M3R3RecoveryError || error instanceof M3R3BEvidenceError) throw error;
    throw new M3R3BEvidenceError(error instanceof Error ? error.message : String(error));
  }
}

export function serializeM3R3BRound003Evidence(evidence: M3R3BResearchEvidence): string {
  return `${stableStringify(evidence)}\n`;
}

export { sha256M3R3RawBytes };

function renderDiagnostics(label: string, diagnostics: ResearchDiagnostics): string {
  return [
    `### ${label}`,
    "",
    "```json",
    stableStringify(diagnostics),
    "```",
    "",
  ].join("\n");
}

export function renderM3R3BRound003Results(evidence: M3R3BResearchEvidence): string {
  const variants = [evidence.control, ...evidence.candidates];
  const summaryRows = variants.map((variant) => {
    const diagnostics = variant.aggregateValidation.diagnostics;
    return `| ${variant.candidateId} | ${variant.selectedFormalSignals} | ${variant.executedTrades} | ${diagnostics.netR} | ${diagnostics.expectancyR ?? "null"} | ${variant.aggregateExpectancyDeltaVsControl ?? "null"} |`;
  }).join("\n");
  const details = variants.map((variant) => [
    `## ${variant.candidateId}`,
    "",
    `selectedFormalSignals: ${variant.selectedFormalSignals}`,
    `executedTrades: ${variant.executedTrades}`,
    `formalIdentitySha256: ${variant.formalIdentitySha256}`,
    `executedIdentitySha256: ${variant.executedIdentitySha256}`,
    `aggregateExpectancyDeltaVsControl: ${variant.aggregateExpectancyDeltaVsControl ?? "null"}`,
    `foldExpectancyDeltaVsControl: ${stableStringify(variant.foldExpectancyDeltaVsControl)}`,
    "",
    renderDiagnostics("Aggregate validation diagnostics", variant.aggregateValidation.diagnostics),
    ...variant.folds.map((fold) => renderDiagnostics(`${fold.foldId} validation diagnostics`, fold.diagnostics)),
  ].join("\n")).join("\n");
  return [
    "# M3-R3-B Round-003 Offline Candidate Performance Evidence",
    "",
    `evidenceStatus: ${evidence.evidenceStatus}`,
    `decision: ${evidence.decision}`,
    `researchRoundId: ${evidence.researchRoundId}`,
    `selectionGateSha256: ${evidence.selectionGateSha256}`,
    `experimentPlanSha256: ${evidence.experimentPlanSha256}`,
    `recoveryMainBaseSha: ${evidence.recoveryMainBaseSha}`,
    `executionSourceSha: ${evidence.executionSourceSha}`,
    `reusedControlReportSha256: ${evidence.reusedControlReportSha256}`,
    `reusedDecisionSnapshotArtifactSha256: ${evidence.reusedDecisionSnapshotArtifactSha256}`,
    `reusedRound001EvidenceSha256: ${evidence.reusedRound001EvidenceSha256}`,
    `reuseVerificationSourceSha: ${evidence.reuseVerificationSourceSha}`,
    `studyServerTime: ${evidence.studyServerTime}`,
    `snapshotCount: ${evidence.snapshotCount}`,
    `strategyVersion: ${evidence.strategyVersion}`,
    `backtestPolicyVersion: ${evidence.backtestPolicyVersion}`,
    `controlReportSchemaVersion: ${evidence.controlReportSchemaVersion}`,
    `dataClassification: ${evidence.dataClassification}`,
    `performanceLock: ${evidence.performanceLock}`,
    `performanceLockTriggered: ${evidence.performanceLockTriggered}`,
    "",
    "This is offline descriptive evidence only. Candidate gate application is deferred to M3-R3-C; baseline-002 is not frozen.",
    "",
    "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.",
    "ALL DATA THROUGH 2026-08-15 IS RESEARCH-AVAILABLE SEEN DATA, NOT TRUE FORWARD OOS.",
    "",
    "## Aggregate validation summary",
    "",
    "| candidateId | selectedFormalSignals | executedTrades | netR | expectancyR | aggregateExpectancyDeltaVsControl |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    summaryRows,
    "",
    details,
    "",
  ].join("\n");
}
