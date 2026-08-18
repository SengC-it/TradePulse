import { createHash } from "node:crypto";

import type {
  BacktestData,
  BacktestReport,
  BacktestSignalResult,
  IntrabarBacktestReport,
} from "../backtest/types.ts";
import { BACKTEST_DIRECTION_ORDER, BACKTEST_SYMBOL_ORDER } from "../backtest/constants.ts";
import {
  M3_R2_ROUND_002_CANDIDATE_DEFINITIONS,
  M3_R2_ROUND_002_CONTROL_ID,
  M3_R2_ROUND_002_PLAN_SHA256,
  M3_R2_ROUND_002_SELECTOR_SPECS,
  validateM3R2Round002Plan,
  type M3R2CandidateDefinition,
} from "./m3-r2-round-002-plan.ts";
import {
  BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
  M3_R2_ROUND_002_INHERITED_SELECTION_GATE_SHA256,
  M3_R2_ROUND_002_CANDIDATE_IDS,
  M3_R2_ROUND_002_RESEARCH_ROUND_ID,
  M3_R2_ROUND_002_SOURCE_SHA,
  M3_R2_ROUND_002_REDUNDANCY_APPLICABILITY,
  validateM3R2Round002MachineRecord,
  type M3R2CandidateId,
} from "./selection-gates-round-002.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange, selectRecordsForFoldRole } from "./folds.ts";
import { extractM3R2DecisionSnapshot, type M3R2DecisionSnapshot } from "./m3-r2-decision-snapshot.ts";
import { m3R2DecisionSnapshotIdentity, selectM3R2CandidateSnapshots } from "./m3-r2-selectors.ts";
import { buildHistoricalIndexes, buildStrategyInputFromIndexes } from "../backtest/windows.ts";
import type { ResearchDiagnostics, ResearchRange } from "./types.ts";
import type { ResearchFoldId } from "./constants.ts";
import { deepFreeze, requireSafeTimestamp, stableStringify } from "./utils.ts";
import type { StrategyCandidate } from "../strategy/types.ts";

export const M3_R2_C_REPORT_SCHEMA_VERSION = "m3-r2-round-002-report-001" as const;
export const M3_R2_C_DECISION_SNAPSHOT_SCHEMA_VERSION = "m3-r2-decision-snapshots-001" as const;
export const M3_R2_C_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;
export const M3_R2_C_MAIN_BASE_SHA = "ce50fde82fdbed7c27668647915a2ea5b4c16f79" as const;
export const M3_R2_C_CONTROL_REPORT_SCHEMA_VERSION = "m3-b-report-004" as const;
export const M3_R2_C_BACKTEST_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R2_C_STRATEGY_VERSION = "baseline-001" as const;
export const M3_R2_C_PERFORMANCE_LOCK = "FIRST_M3_R2_C_PERFORMANCE_RESULT_GENERATED" as const;

export type M3R2CEvidenceStatus = "COMPLETE" | "INCOMPLETE";
export type M3R2CDecision = "DEFER_TO_M3_R2_D_FROZEN_GATE_APPLICATION" | "DEFER_INCOMPLETE_EVIDENCE";
export type M3R2CControlParityStatus = "PASS" | "CONTROL_DRIFT_REVIEW_REQUIRED";

export type M3R2CDecisionSnapshotArtifact = Readonly<{
  schemaVersion: typeof M3_R2_C_DECISION_SNAPSHOT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R2_ROUND_002_RESEARCH_ROUND_ID;
  executionSourceSha: string;
  selectionGateSha256: typeof BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R2_ROUND_002_PLAN_SHA256;
  strategyVersion: typeof M3_R2_C_STRATEGY_VERSION;
  backtestPolicyVersion: typeof M3_R2_C_BACKTEST_POLICY_VERSION;
  studyServerTime: number;
  controlReportSha256: string;
  snapshotCount: number;
  snapshots: readonly M3R2DecisionSnapshot[];
}>;

export type M3R2CFoldEvidence = Readonly<{
  foldId: ResearchFoldId;
  foldRole: "VALIDATION";
  range: ResearchRange;
  diagnostics: ResearchDiagnostics;
}>;

export type M3R2CDiagnosticsBundle = Readonly<{
  diagnostics: ResearchDiagnostics;
}>;

export type M3R2CVariantEvidence = Readonly<{
  candidateId: string;
  role: "CONTROL" | "CANDIDATE";
  mechanismIds: readonly string[];
  selectorKind: M3R2CandidateDefinition["selectorKind"];
  parametersTested: M3R2CandidateDefinition["parametersTested"];
  complexity: M3R2CandidateDefinition["complexity"];
  aggregateValidation: M3R2CDiagnosticsBundle | null;
  folds: readonly M3R2CFoldEvidence[];
  formalIdentitySha256: string | null;
  executedIdentitySha256: string | null;
  selectedSnapshotCount: number | null;
  aggregateExpectancyDeltaVsControl: number | null;
  foldExpectancyDeltaVsControl: Readonly<Record<ResearchFoldId, number | null>>;
  improvedFoldCountUsingFrozen0_02Definition: number | null;
  catastrophicFoldCountUsingFrozenDefinition: number | null;
  requiredRedundancyImprovement: "NOT_APPLICABLE";
  redundancyApplicability: "NOT_APPLICABLE";
  redundancyRelativeReductionVsControl: null;
  decision: M3R2CDecision;
  evidenceError?: string;
}>;

export type M3R2CResearchEvidence = Readonly<{
  schemaVersion: typeof M3_R2_C_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R2_ROUND_002_RESEARCH_ROUND_ID;
  selectionGateSha256: typeof BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R2_ROUND_002_PLAN_SHA256;
  protocolSourceSha: typeof M3_R2_ROUND_002_SOURCE_SHA;
  m3R2BMainBaseSha: typeof M3_R2_C_MAIN_BASE_SHA;
  executionSourceSha: string;
  round001EvidenceSha256: string;
  controlReportSha256: string;
  decisionSnapshotArtifactSha256: string;
  strategyVersion: typeof M3_R2_C_STRATEGY_VERSION;
  backtestPolicyVersion: typeof M3_R2_C_BACKTEST_POLICY_VERSION;
  controlReportSchemaVersion: typeof M3_R2_C_CONTROL_REPORT_SCHEMA_VERSION;
  studyServerTime: number;
  dataClassification: typeof M3_R2_C_DATA_CLASSIFICATION;
  performanceLockTriggered: true;
  evidenceStatus: M3R2CEvidenceStatus;
  controlParityStatus: M3R2CControlParityStatus;
  controlParityDiagnostics: readonly string[];
  decision: M3R2CDecision;
  snapshotCount: number;
  control: M3R2CVariantEvidence;
  candidates: readonly M3R2CVariantEvidence[];
}>;

const FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);
const EMPTY_FOLD_DELTAS = Object.freeze({ F1: null, F2: null, F3: null, F4: null, F5: null, F6: null });

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function sha256M3R2CRawBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function symbolIndex(symbol: string): number {
  const index = BACKTEST_SYMBOL_ORDER.indexOf(symbol as (typeof BACKTEST_SYMBOL_ORDER)[number]);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function directionIndex(direction: string): number {
  const index = BACKTEST_DIRECTION_ORDER.indexOf(direction as (typeof BACKTEST_DIRECTION_ORDER)[number]);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function compareIdentity(left: Readonly<{ signalTime: number; symbol: string; direction: string }>, right: Readonly<{ signalTime: number; symbol: string; direction: string }>): number {
  return left.signalTime - right.signalTime || symbolIndex(left.symbol) - symbolIndex(right.symbol) || directionIndex(left.direction) - directionIndex(right.direction);
}

export function m3R2CResultIdentity(result: Pick<BacktestSignalResult, "snapshot">): string {
  return `${result.snapshot.symbol}|${result.snapshot.direction}|${result.snapshot.signalTime}`;
}

function identityHash(results: readonly BacktestSignalResult[], executedOnly: boolean): string {
  const identities = results
    .filter((result) => !executedOnly || result.status === "EXECUTED")
    .map(m3R2CResultIdentity)
    .sort();
  return sha256Utf8(stableStringify(identities));
}

function aggregateRange(): ResearchRange {
  return Object.freeze({
    startTime: getResearchFoldRoleRange("F1", "VALIDATION").startTime,
    endTime: getResearchFoldRoleRange("F6", "VALIDATION").endTime,
  });
}

function foldEvidence(records: readonly ReturnType<typeof adaptBacktestSignalResult>[]): readonly M3R2CFoldEvidence[] {
  return Object.freeze(FOLD_IDS.map((foldId) => {
    const range = getResearchFoldRoleRange(foldId, "VALIDATION");
    const selected = selectRecordsForFoldRole(records, foldId, "VALIDATION");
    return deepFreeze({
      foldId,
      foldRole: "VALIDATION" as const,
      range,
      diagnostics: calculateResearchDiagnostics({ records: selected, range }),
    });
  }));
}

function candidateDefinition(candidateId: string): M3R2CandidateDefinition {
  const definition = M3_R2_ROUND_002_CANDIDATE_DEFINITIONS.find((candidate) => candidate.candidateId === candidateId);
  if (!definition) throw new Error(`Unknown Round-002 candidate definition: ${candidateId}.`);
  return definition;
}

function baseVariant(input: Readonly<{
  definition: M3R2CandidateDefinition;
  results: readonly BacktestSignalResult[];
  decision?: M3R2CDecision;
}>): M3R2CVariantEvidence {
  const records = input.results.map(adaptBacktestSignalResult);
  const aggregateValidation = {
    diagnostics: calculateResearchDiagnostics({ records, range: aggregateRange() }),
  } as const;
  return deepFreeze({
    candidateId: input.definition.candidateId,
    role: input.definition.role === "CONTROL" ? "CONTROL" as const : "CANDIDATE" as const,
    mechanismIds: input.definition.mechanismIds,
    selectorKind: input.definition.selectorKind,
    parametersTested: input.definition.parametersTested,
    complexity: input.definition.complexity,
    aggregateValidation,
    folds: foldEvidence(records),
    formalIdentitySha256: identityHash(input.results, false),
    executedIdentitySha256: identityHash(input.results, true),
    selectedSnapshotCount: input.results.length,
    aggregateExpectancyDeltaVsControl: null,
    foldExpectancyDeltaVsControl: EMPTY_FOLD_DELTAS,
    improvedFoldCountUsingFrozen0_02Definition: null,
    catastrophicFoldCountUsingFrozenDefinition: null,
    requiredRedundancyImprovement: "NOT_APPLICABLE" as const,
    redundancyApplicability: "NOT_APPLICABLE" as const,
    redundancyRelativeReductionVsControl: null,
    decision: input.decision ?? "DEFER_TO_M3_R2_D_FROZEN_GATE_APPLICATION",
  });
}

function incompleteVariant(definition: M3R2CandidateDefinition, error: unknown): M3R2CVariantEvidence {
  return deepFreeze({
    candidateId: definition.candidateId,
    role: definition.role === "CONTROL" ? "CONTROL" as const : "CANDIDATE" as const,
    mechanismIds: definition.mechanismIds,
    selectorKind: definition.selectorKind,
    parametersTested: definition.parametersTested,
    complexity: definition.complexity,
    aggregateValidation: null,
    folds: Object.freeze([]),
    formalIdentitySha256: null,
    executedIdentitySha256: null,
    selectedSnapshotCount: null,
    aggregateExpectancyDeltaVsControl: null,
    foldExpectancyDeltaVsControl: EMPTY_FOLD_DELTAS,
    improvedFoldCountUsingFrozen0_02Definition: null,
    catastrophicFoldCountUsingFrozenDefinition: null,
    requiredRedundancyImprovement: "NOT_APPLICABLE" as const,
    redundancyApplicability: "NOT_APPLICABLE" as const,
    redundancyRelativeReductionVsControl: null,
    decision: "DEFER_INCOMPLETE_EVIDENCE" as const,
    evidenceError: error instanceof Error ? error.message : String(error),
  });
}

function candidateExpectancyDelta(candidate: M3R2CVariantEvidence, control: M3R2CVariantEvidence): number | null {
  const candidateValue = candidate.aggregateValidation?.diagnostics.expectancyR;
  const controlValue = control.aggregateValidation?.diagnostics.expectancyR;
  return candidateValue === null || candidateValue === undefined || controlValue === null || controlValue === undefined
    ? null
    : candidateValue - controlValue;
}

function foldExpectancyDeltas(candidate: M3R2CVariantEvidence, control: M3R2CVariantEvidence): Readonly<Record<ResearchFoldId, number | null>> {
  return Object.freeze(Object.fromEntries(FOLD_IDS.map((foldId) => {
    const candidateValue = candidate.folds.find((fold) => fold.foldId === foldId)?.diagnostics.expectancyR ?? null;
    const controlValue = control.folds.find((fold) => fold.foldId === foldId)?.diagnostics.expectancyR ?? null;
    return [foldId, candidateValue === null || controlValue === null ? null : candidateValue - controlValue];
  })) as Record<ResearchFoldId, number | null>);
}

function improvedFoldCount(candidate: M3R2CVariantEvidence, control: M3R2CVariantEvidence): number {
  return FOLD_IDS.filter((foldId) => {
    const candidateFold = candidate.folds.find((fold) => fold.foldId === foldId)?.diagnostics;
    const controlFold = control.folds.find((fold) => fold.foldId === foldId)?.diagnostics;
    if (!candidateFold || !controlFold || candidateFold.executedTrades < 30 || controlFold.executedTrades < 30) return false;
    return candidateFold.expectancyR !== null && controlFold.expectancyR !== null && candidateFold.expectancyR - controlFold.expectancyR >= 0.02;
  }).length;
}

function catastrophicFoldCount(candidate: M3R2CVariantEvidence): number {
  return candidate.folds.filter((fold) => {
    const diagnostics = fold.diagnostics;
    return (
      (diagnostics.expectancyR !== null && diagnostics.expectancyR <= -0.1) ||
      (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < 0.8) ||
      diagnostics.profitFactorStatus === "NO_TRADES" ||
      diagnostics.executedTrades < 30
    );
  }).length;
}

function controlCandidate(report: IntrabarBacktestReport, result: BacktestSignalResult): StrategyCandidate {
  const evaluations = report.evaluations.filter((evaluation) => evaluation.evaluationTime === result.snapshot.signalTime);
  if (evaluations.length !== 1) throw new Error(`Expected one CONTROL evaluation for ${m3R2CResultIdentity(result)}.`);
  const candidates = evaluations[0]!.engineResult.evaluations
    .map((evaluation) => evaluation.candidate)
    .filter((candidate): candidate is StrategyCandidate =>
      candidate !== null && candidate.formalSignal && candidate.totalScore >= 70 &&
      candidate.symbol === result.snapshot.symbol && candidate.direction === result.snapshot.direction,
    );
  if (candidates.length !== 1) throw new Error(`Expected one formal engine candidate for ${m3R2CResultIdentity(result)}.`);
  return candidates[0]!;
}

function canonicalSnapshots(snapshots: readonly M3R2DecisionSnapshot[]): readonly M3R2DecisionSnapshot[] {
  const identities = new Set<string>();
  for (const snapshot of snapshots) {
    const identity = m3R2DecisionSnapshotIdentity(snapshot);
    if (identities.has(identity)) throw new Error(`Duplicate M3-R2 decision snapshot identity: ${identity}.`);
    identities.add(identity);
  }
  return Object.freeze([...snapshots].sort(compareIdentity));
}

function validateSnapshotParity(report: IntrabarBacktestReport, snapshots: readonly M3R2DecisionSnapshot[]): void {
  const resultIdentities = new Set(report.signalResults.map(m3R2CResultIdentity));
  const snapshotIdentities = new Set(snapshots.map(m3R2DecisionSnapshotIdentity));
  if (snapshots.length !== report.signalResults.length) throw new Error("M3-R2 snapshot count does not equal CONTROL signal-result count.");
  if (snapshotIdentities.size !== snapshots.length) throw new Error("M3-R2 snapshot identity set contains duplicates.");
  if (resultIdentities.size !== report.signalResults.length) throw new Error("CONTROL signal-result identity set contains duplicates.");
  if (resultIdentities.size !== snapshotIdentities.size || [...resultIdentities].some((identity) => !snapshotIdentities.has(identity))) {
    throw new Error("M3-R2 snapshot identity set does not equal the CONTROL identity set.");
  }
}

function validateCommonProvenance(input: Readonly<{
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
}>): void {
  validateM3R2Round002Plan();
  validateM3R2Round002MachineRecord();
  if (input.selectionGateSha256 !== BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256) throw new Error("Round-002 selection gate SHA mismatch.");
  if (input.experimentPlanSha256 !== M3_R2_ROUND_002_PLAN_SHA256) throw new Error("Round-002 experiment plan SHA mismatch.");
  if (input.executionSourceSha.trim().length === 0) throw new Error("M3-R2-C execution source SHA must be non-empty.");
}

export function validateM3R2CControlReport(report: BacktestReport): IntrabarBacktestReport {
  if (report.schemaVersion !== M3_R2_C_CONTROL_REPORT_SCHEMA_VERSION) throw new Error("M3-R2-C CONTROL must use m3-b-report-004.");
  if (report.backtestPolicyVersion !== M3_R2_C_BACKTEST_POLICY_VERSION) throw new Error("M3-R2-C CONTROL must use bt-policy-003.");
  if (report.strategyVersion !== M3_R2_C_STRATEGY_VERSION) throw new Error("M3-R2-C CONTROL must use baseline-001.");
  if (report.period !== "COMBINED") throw new Error("M3-R2-C CONTROL must be a COMBINED report.");
  requireSafeTimestamp(report.studyServerTime, "M3-R2-C studyServerTime");
  if (report.diagnostics.length !== 0) throw new Error(`M3-R2-C CONTROL diagnostics are not empty: ${report.diagnostics.join(" ")}`);
  if (report.signalResults.some((result) => result.status === "DATA_INCOMPLETE" || result.status === "SETTLEMENT_AMBIGUOUS")) {
    throw new Error("M3-R2-C CONTROL contains DATA_INCOMPLETE or SETTLEMENT_AMBIGUOUS.");
  }
  return report;
}

export function createM3R2DecisionSnapshotArtifact(input: Readonly<{
  controlReport: BacktestReport;
  data: BacktestData;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  controlReportSha256: string;
}>): M3R2CDecisionSnapshotArtifact {
  validateCommonProvenance(input);
  const report = validateM3R2CControlReport(input.controlReport);
  if (input.data.serverTime !== report.studyServerTime) throw new Error("BacktestData.serverTime does not equal CONTROL studyServerTime.");
  const indexes = buildHistoricalIndexes(input.data.datasets);
  const snapshots = report.signalResults.map((result) => {
    const candidate = controlCandidate(report, result);
    const strategyInput = buildStrategyInputFromIndexes(indexes, result.snapshot.signalTime);
    const dataset = strategyInput.datasets[result.snapshot.symbol];
    if (!dataset) throw new Error(`StrategyDataset is unavailable for ${result.snapshot.symbol}.`);
    return extractM3R2DecisionSnapshot({ signalTime: result.snapshot.signalTime, baselineCandidate: candidate, dataset });
  });
  const canonical = canonicalSnapshots(snapshots);
  validateSnapshotParity(report, canonical);
  return deepFreeze({
    schemaVersion: M3_R2_C_DECISION_SNAPSHOT_SCHEMA_VERSION,
    researchRoundId: M3_R2_ROUND_002_RESEARCH_ROUND_ID,
    executionSourceSha: input.executionSourceSha,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R2_ROUND_002_PLAN_SHA256,
    strategyVersion: M3_R2_C_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R2_C_BACKTEST_POLICY_VERSION,
    studyServerTime: report.studyServerTime,
    controlReportSha256: input.controlReportSha256,
    snapshotCount: canonical.length,
    snapshots: canonical,
  });
}

export function serializeM3R2DecisionSnapshotArtifact(artifact: M3R2CDecisionSnapshotArtifact): string {
  return `${stableStringify(artifact)}\n`;
}

function objectValue(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function stableComparable(value: unknown): string {
  return stableStringify(value === undefined ? null : value);
}

function controlParityDiagnostics(
  current: M3R2CVariantEvidence,
  round001Evidence: unknown,
): readonly string[] {
  const diagnostics: string[] = [];
  const previousControl = objectValue(round001Evidence, "control");
  const previousAggregate = objectValue(objectValue(previousControl, "aggregateValidation"), "diagnostics");
  const previousFolds = objectValue(previousControl, "folds");
  if (objectValue(previousControl, "formalIdentitySha256") !== current.formalIdentitySha256) diagnostics.push("formalIdentitySha256 drift");
  if (objectValue(previousControl, "executedIdentitySha256") !== current.executedIdentitySha256) diagnostics.push("executedIdentitySha256 drift");
  if (stableComparable(previousAggregate) !== stableComparable(current.aggregateValidation?.diagnostics)) diagnostics.push("aggregate CONTROL diagnostics drift");
  for (const foldId of FOLD_IDS) {
    const previousFold = Array.isArray(previousFolds)
      ? previousFolds.find((fold) => objectValue(fold, "foldId") === foldId)
      : undefined;
    const previousDiagnostics = objectValue(previousFold, "diagnostics");
    const currentDiagnostics = current.folds.find((fold) => fold.foldId === foldId)?.diagnostics;
    if (stableComparable(previousDiagnostics) !== stableComparable(currentDiagnostics)) diagnostics.push(`${foldId} CONTROL diagnostics drift`);
  }
  return Object.freeze(diagnostics);
}

function candidateVariant(
  definition: M3R2CandidateDefinition,
  controlResultsByIdentity: ReadonlyMap<string, BacktestSignalResult>,
  snapshots: readonly M3R2DecisionSnapshot[],
  control: M3R2CVariantEvidence,
): M3R2CVariantEvidence {
  const selectedSnapshots = selectM3R2CandidateSnapshots(definition.candidateId as M3R2CandidateId, snapshots);
  if (selectedSnapshots.length >= snapshots.length) throw new Error(`${definition.candidateId} is not a strict subset of CONTROL snapshots.`);
  const selectedResults = selectedSnapshots.map((snapshot) => {
    const result = controlResultsByIdentity.get(m3R2DecisionSnapshotIdentity(snapshot));
    if (!result) throw new Error(`Selected identity is absent from CONTROL: ${m3R2DecisionSnapshotIdentity(snapshot)}.`);
    return result;
  });
  const candidate = baseVariant({ definition, results: selectedResults });
  return deepFreeze({
    ...candidate,
    aggregateExpectancyDeltaVsControl: candidateExpectancyDelta(candidate, control),
    foldExpectancyDeltaVsControl: foldExpectancyDeltas(candidate, control),
    improvedFoldCountUsingFrozen0_02Definition: improvedFoldCount(candidate, control),
    catastrophicFoldCountUsingFrozenDefinition: catastrophicFoldCount(candidate),
  });
}

export function deriveM3R2CResearchEvidence(input: Readonly<{
  controlReport: BacktestReport;
  controlReportSha256: string;
  decisionSnapshots: M3R2CDecisionSnapshotArtifact;
  decisionSnapshotArtifactSha256: string;
  round001Evidence: unknown;
  round001EvidenceSha256: string;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
}>): M3R2CResearchEvidence {
  validateCommonProvenance(input);
  const report = validateM3R2CControlReport(input.controlReport);
  if (input.controlReportSha256 !== input.decisionSnapshots.controlReportSha256) throw new Error("Decision snapshot artifact CONTROL SHA mismatch.");
  if (input.decisionSnapshots.executionSourceSha !== input.executionSourceSha) throw new Error("Decision snapshot execution source SHA mismatch.");
  if (input.decisionSnapshots.selectionGateSha256 !== BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256) throw new Error("Decision snapshot gate SHA mismatch.");
  if (input.decisionSnapshots.experimentPlanSha256 !== M3_R2_ROUND_002_PLAN_SHA256) throw new Error("Decision snapshot plan SHA mismatch.");
  if (input.decisionSnapshots.studyServerTime !== report.studyServerTime) throw new Error("Decision snapshot studyServerTime mismatch.");
  if (input.decisionSnapshots.snapshotCount !== input.decisionSnapshots.snapshots.length) throw new Error("Decision snapshot count does not equal the serialized snapshot array length.");
  validateSnapshotParity(report, input.decisionSnapshots.snapshots);
  const controlResultsByIdentity = new Map<string, BacktestSignalResult>();
  for (const result of report.signalResults) {
    const identity = m3R2CResultIdentity(result);
    if (controlResultsByIdentity.has(identity)) throw new Error(`Duplicate CONTROL formal identity: ${identity}.`);
    controlResultsByIdentity.set(identity, result);
  }
  const controlDefinition = candidateDefinition(M3_R2_ROUND_002_CONTROL_ID);
  const control = baseVariant({ definition: controlDefinition, results: report.signalResults });
  const parityDiagnostics = controlParityDiagnostics(control, input.round001Evidence);
  const controlParityStatus: M3R2CControlParityStatus = parityDiagnostics.length === 0 ? "PASS" : "CONTROL_DRIFT_REVIEW_REQUIRED";
  const candidates = M3_R2_ROUND_002_CANDIDATE_IDS.map((candidateId) => {
    const definition = candidateDefinition(candidateId);
    if (controlParityStatus !== "PASS") return incompleteVariant(definition, "CONTROL parity failed; candidate derivation was not attempted.");
    try {
      return candidateVariant(definition, controlResultsByIdentity, input.decisionSnapshots.snapshots, control);
    } catch (error) {
      return incompleteVariant(definition, error);
    }
  });
  const evidenceStatus: M3R2CEvidenceStatus = controlParityStatus !== "PASS" || candidates.some((candidate) => candidate.aggregateValidation === null)
    ? "INCOMPLETE"
    : "COMPLETE";
  return deepFreeze({
    schemaVersion: M3_R2_C_REPORT_SCHEMA_VERSION,
    researchRoundId: M3_R2_ROUND_002_RESEARCH_ROUND_ID,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R2_ROUND_002_PLAN_SHA256,
    protocolSourceSha: M3_R2_ROUND_002_SOURCE_SHA,
    m3R2BMainBaseSha: M3_R2_C_MAIN_BASE_SHA,
    executionSourceSha: input.executionSourceSha,
    round001EvidenceSha256: input.round001EvidenceSha256,
    controlReportSha256: input.controlReportSha256,
    decisionSnapshotArtifactSha256: input.decisionSnapshotArtifactSha256,
    strategyVersion: M3_R2_C_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R2_C_BACKTEST_POLICY_VERSION,
    controlReportSchemaVersion: M3_R2_C_CONTROL_REPORT_SCHEMA_VERSION,
    studyServerTime: report.studyServerTime,
    dataClassification: M3_R2_C_DATA_CLASSIFICATION,
    performanceLockTriggered: true,
    evidenceStatus,
    controlParityStatus,
    controlParityDiagnostics: parityDiagnostics,
    decision: evidenceStatus === "COMPLETE" ? "DEFER_TO_M3_R2_D_FROZEN_GATE_APPLICATION" : "DEFER_INCOMPLETE_EVIDENCE",
    snapshotCount: input.decisionSnapshots.snapshotCount,
    control,
    candidates: Object.freeze(candidates),
  });
}

export function serializeM3R2CResearchEvidence(report: M3R2CResearchEvidence): string {
  return `${stableStringify(report)}\n`;
}

function metric(value: number | null | undefined): string {
  return value === null || value === undefined ? "null" : String(value);
}

function diagnosticRow(variant: M3R2CVariantEvidence): string {
  const diagnostics = variant.aggregateValidation?.diagnostics;
  return `| ${variant.candidateId} | ${diagnostics?.formalSignals ?? "null"} | ${diagnostics?.executedTrades ?? "null"} | ${metric(diagnostics?.netR)} | ${metric(diagnostics?.expectancyR)} | ${metric(diagnostics?.profitFactor)} | ${diagnostics?.profitFactorStatus ?? "null"} | ${metric(diagnostics?.feeBurdenRatio)} | ${metric(diagnostics?.topSymbolShareOfPositiveNetR)} | ${metric(diagnostics?.largestSingleTradeShareOfPositiveNetR)} |`;
}

function foldMarkdown(variant: M3R2CVariantEvidence): string[] {
  const lines = [
    `### ${variant.candidateId} F1-F6 validation diagnostics`,
    "",
    "| Fold | Executed trades | Expectancy R | PF | PF status |",
    "| --- | ---: | ---: | ---: | --- |",
  ];
  for (const foldId of FOLD_IDS) {
    const diagnostics = variant.folds.find((fold) => fold.foldId === foldId)?.diagnostics;
    lines.push(`| ${foldId} | ${diagnostics?.executedTrades ?? "null"} | ${metric(diagnostics?.expectancyR)} | ${metric(diagnostics?.profitFactor)} | ${diagnostics?.profitFactorStatus ?? "null"} |`);
  }
  return lines;
}

export function renderM3R2CResultsMarkdown(report: M3R2CResearchEvidence): string {
  const variants = [report.control, ...report.candidates];
  const lines = [
    "# M3-R2-C Round-002 Authoritative Research Evidence",
    "",
    `evidenceStatus: ${report.evidenceStatus}`,
    `decision: ${report.decision}`,
    `researchRoundId: ${report.researchRoundId}`,
    `selectionGateSha256: ${report.selectionGateSha256}`,
    `experimentPlanSha256: ${report.experimentPlanSha256}`,
    `protocolSourceSha: ${report.protocolSourceSha}`,
    `m3R2BMainBaseSha: ${report.m3R2BMainBaseSha}`,
    `executionSourceSha: ${report.executionSourceSha}`,
    `round001EvidenceSha256: ${report.round001EvidenceSha256}`,
    `controlReportSha256: ${report.controlReportSha256}`,
    `decisionSnapshotArtifactSha256: ${report.decisionSnapshotArtifactSha256}`,
    `studyServerTime: ${report.studyServerTime}`,
    `snapshotCount: ${report.snapshotCount}`,
    `controlParityStatus: ${report.controlParityStatus}`,
    `performanceLockTriggered: ${report.performanceLockTriggered}`,
    `dataClassification: ${report.dataClassification}`,
    "",
    "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.",
    "",
    "ALL DATA THROUGH 2026-08-15 IS RESEARCH-AVAILABLE SEEN DATA, NOT TRUE FORWARD OOS.",
    "",
    "Round-002 candidates are listed in the frozen registry order. No selection, ranking, recommendation, or baseline-002 freeze is performed in M3-R2-C.",
    "",
    "## CONTROL and candidate aggregate diagnostics",
    "",
    "| Candidate | Formal signals | Executed trades | Net R | Expectancy R | PF | PF status | Fee burden ratio | Top-symbol concentration | Largest-trade concentration |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |",
    ...variants.map(diagnosticRow),
    "",
    `CONTROL parity diagnostics: ${report.controlParityDiagnostics.length === 0 ? "none" : report.controlParityDiagnostics.join("; ")}`,
    "",
  ];
  for (const variant of variants) lines.push(...foldMarkdown(variant), "");
  lines.push(
    "No M3-R2-D gate application has occurred. The final decision is deferred to the separately authorized mechanical gate stage.",
    "",
  );
  return lines.join("\n");
}

export function validateM3R2CPlanConstants(): void {
  if (M3_R2_ROUND_002_SELECTOR_SPECS.H7.LONG.closeDistanceNumerator !== "symbol4hClose - symbol4hEma200") {
    throw new Error("M3-R2-C requires the frozen EMA200-based H7 selector specification.");
  }
  if (M3_R2_ROUND_002_INHERITED_SELECTION_GATE_SHA256 !== "11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd") {
    throw new Error("Round-001 gate SHA changed.");
  }
  if (Object.values(M3_R2_ROUND_002_REDUNDANCY_APPLICABILITY).some((value) => value !== "NOT_APPLICABLE")) {
    throw new Error("Round-002 redundancy applicability changed.");
  }
}
