import { createHash } from "node:crypto";

import type { IntrabarBacktestReport, BacktestReport, BacktestSignalResult } from "../backtest/types.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange, selectRecordsForFoldRole } from "./folds.ts";
import {
  M3_H_ROUND_001_EXPERIMENTS,
  M3_H_ROUND_001_PLAN,
  M3_H_ROUND_001_PLAN_SHA256,
  M3_H_ROUND_001_RESEARCH_ROUND_ID,
  M3_H_ROUND_001_SELECTION_GATE_SHA256,
  validateM3HRound001Plan,
  type M3HComplexityTuple,
  type M3HExperimentDefinition,
  type M3HSelectorSpec,
} from "./m3-h-round-001-plan.ts";
import {
  canonicalizeDecisionSnapshots,
  compareDecisionSnapshots,
  decisionSnapshotIdentity,
  selectCandidateDecisionSnapshots,
  type M3HDecisionSnapshot,
} from "./m3-h-selectors.ts";
import { calculateScoreBucketReport } from "./score-buckets.ts";
import type {
  NormalizedResearchSignal,
  ResearchDiagnostics,
  ResearchRange,
  ScoreBucketReport,
} from "./types.ts";
import type { ResearchFoldId } from "./constants.ts";
import { deepFreeze, requireSafeTimestamp, stableStringify } from "./utils.ts";

export const M3_H_ROUND_001_REPORT_SCHEMA_VERSION = "m3-h-round-001-report-001" as const;
export const M3_H_RESEARCH_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;

export type M3HEvidenceStatus = "COMPLETE" | "INCOMPLETE";
export type M3HEvidenceDecision = "DEFER_TO_M3_I_FROZEN_GATE_APPLICATION" | "DEFER_INCOMPLETE_EVIDENCE";

export type M3HDiagnosticsBundle = Readonly<{
  diagnostics: ResearchDiagnostics;
  scoreBuckets: ScoreBucketReport;
}>;

export type M3HFoldEvidence = Readonly<{
  foldId: ResearchFoldId;
  foldRole: "VALIDATION";
  range: ResearchRange;
  diagnostics: ResearchDiagnostics;
  scoreBuckets: ScoreBucketReport;
}>;

export type M3HVariantEvidence = Readonly<{
  experimentId: string;
  variantId: string;
  hypothesisId: string | "CONTROL";
  complexity: M3HComplexityTuple;
  selector: M3HSelectorSpec | null;
  aggregateValidation: M3HDiagnosticsBundle | null;
  folds: readonly M3HFoldEvidence[];
  formalIdentitySha256: string | null;
  executedIdentitySha256: string | null;
  aggregateExpectancyDeltaVsControl: number | null;
  foldExpectancyDeltaVsControl: Readonly<Record<string, number | null>>;
  improvedFoldCountUsingFrozen0_02Definition: number | null;
  catastrophicFoldCountUsingFrozenDefinition: number | null;
  redundancyRelativeReductionVsControl: number | null;
  decision: M3HEvidenceDecision;
  evidenceError?: string;
}>;

export type M3HResearchEvidence = Readonly<{
  schemaVersion: typeof M3_H_ROUND_001_REPORT_SCHEMA_VERSION;
  researchRoundId: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  executionSourceSha: string;
  controlReportSha256: string;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: "bt-policy-003";
  controlReportSchemaVersion: "m3-b-report-004";
  studyServerTime: number;
  dataClassification: typeof M3_H_RESEARCH_DATA_CLASSIFICATION;
  evidenceStatus: M3HEvidenceStatus;
  decision: M3HEvidenceDecision;
  control: M3HVariantEvidence;
  candidates: readonly M3HVariantEvidence[];
}>;

const CONTROL_ERROR = "CONTROL evidence is invalid or incomplete.";

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function sha256RawBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function controlReport(report: BacktestReport): IntrabarBacktestReport {
  if (report.schemaVersion !== "m3-b-report-004") throw new Error("M3-H CONTROL must use m3-b-report-004.");
  if (report.backtestPolicyVersion !== "bt-policy-003") throw new Error("M3-H CONTROL must use bt-policy-003.");
  if (report.strategyVersion !== "baseline-001") throw new Error("M3-H CONTROL must use baseline-001.");
  if (report.period !== "COMBINED") throw new Error("M3-H CONTROL must be a COMBINED report.");
  requireSafeTimestamp(report.studyServerTime, "M3-H studyServerTime");
  if (report.diagnostics.length > 0) throw new Error(`${CONTROL_ERROR} ${report.diagnostics.join(" ")}`);
  if (report.signalResults.some((result) => result.status === "DATA_INCOMPLETE" || result.status === "SETTLEMENT_AMBIGUOUS")) {
    throw new Error(`${CONTROL_ERROR} DATA_INCOMPLETE or SETTLEMENT_AMBIGUOUS result present.`);
  }
  return report;
}

export function validateM3HControlReport(report: BacktestReport): IntrabarBacktestReport {
  return controlReport(report);
}

function decisionSnapshotFromResult(result: BacktestSignalResult): M3HDecisionSnapshot {
  return deepFreeze({
    signalTime: result.snapshot.signalTime,
    symbol: result.snapshot.symbol,
    direction: result.snapshot.direction,
    totalScore: result.snapshot.totalScore,
    entryReference: result.snapshot.entryReference,
    stopDistance: result.snapshot.stopDistance,
  });
}

export function toM3HDecisionSnapshots(results: readonly BacktestSignalResult[]): readonly M3HDecisionSnapshot[] {
  return canonicalizeDecisionSnapshots(results.map(decisionSnapshotFromResult));
}

function identityHash(results: readonly BacktestSignalResult[], executedOnly: boolean): string {
  const snapshots = results
    .filter((result) => !executedOnly || result.status === "EXECUTED")
    .map(decisionSnapshotFromResult)
    .sort(compareDecisionSnapshots);
  return sha256Utf8(stableStringify(snapshots.map(decisionSnapshotIdentity)));
}

function aggregateRange(): ResearchRange {
  return Object.freeze({
    startTime: getResearchFoldRoleRange("F1", "VALIDATION").startTime,
    endTime: getResearchFoldRoleRange("F6", "VALIDATION").endTime,
  });
}

function diagnosticsBundle(records: readonly NormalizedResearchSignal[], range: ResearchRange): M3HDiagnosticsBundle {
  return deepFreeze({
    diagnostics: calculateResearchDiagnostics({ records, range }),
    scoreBuckets: calculateScoreBucketReport({ records, buckets: M3_H_ROUND_001_PLAN.scoreBuckets }),
  });
}

function foldEvidence(records: readonly NormalizedResearchSignal[]): readonly M3HFoldEvidence[] {
  return Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"].map((foldId) => {
      const typedFoldId = foldId as ResearchFoldId;
      const range = getResearchFoldRoleRange(typedFoldId, "VALIDATION");
      const foldRecords = selectRecordsForFoldRole(records, typedFoldId, "VALIDATION");
      const bundle = diagnosticsBundle(foldRecords, range);
      return deepFreeze({ foldId: typedFoldId, foldRole: "VALIDATION" as const, range, ...bundle });
    }));
}

function metricForFold(evidence: M3HVariantEvidence, foldId: ResearchFoldId): M3HFoldEvidence {
  const fold = evidence.folds.find((candidate) => candidate.foldId === foldId);
  if (!fold) throw new Error(`Missing M3-H fold evidence for ${foldId}.`);
  return fold;
}

function candidateImprovedFoldCount(candidate: M3HVariantEvidence, control: M3HVariantEvidence): number {
  let count = 0;
  for (const foldId of ["F1", "F2", "F3", "F4", "F5", "F6"] as const) {
    const candidateFold = metricForFold(candidate, foldId).diagnostics;
    const controlFold = metricForFold(control, foldId).diagnostics;
    const delta = candidateFold.expectancyR === null || controlFold.expectancyR === null
      ? null
      : candidateFold.expectancyR - controlFold.expectancyR;
    if (candidateFold.executedTrades >= 30 && controlFold.executedTrades >= 30 && delta !== null && delta >= 0.02) count += 1;
  }
  return count;
}

function isCatastrophic(fold: M3HFoldEvidence): boolean {
  const diagnostics = fold.diagnostics;
  return (
    (diagnostics.expectancyR !== null && diagnostics.expectancyR <= -0.1) ||
    (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < 0.8) ||
    diagnostics.profitFactorStatus === "NO_TRADES" ||
    diagnostics.executedTrades < 30
  );
}

function candidateCatastrophicFoldCount(candidate: M3HVariantEvidence): number {
  return candidate.folds.filter(isCatastrophic).length;
}

function aggregateExpectancyDelta(candidate: M3HVariantEvidence, control: M3HVariantEvidence): number | null {
  const candidateExpectancy = candidate.aggregateValidation?.diagnostics.expectancyR;
  const controlExpectancy = control.aggregateValidation?.diagnostics.expectancyR;
  return candidateExpectancy === null || candidateExpectancy === undefined || controlExpectancy === null || controlExpectancy === undefined
    ? null
    : candidateExpectancy - controlExpectancy;
}

function foldExpectancyDeltas(candidate: M3HVariantEvidence, control: M3HVariantEvidence): Readonly<Record<string, number | null>> {
  return Object.freeze(Object.fromEntries((["F1", "F2", "F3", "F4", "F5", "F6"] as const).map((foldId) => {
    const candidateExpectancy = metricForFold(candidate, foldId).diagnostics.expectancyR;
    const controlExpectancy = metricForFold(control, foldId).diagnostics.expectancyR;
    return [foldId, candidateExpectancy === null || controlExpectancy === null ? null : candidateExpectancy - controlExpectancy];
  })));
}

function redundancyRelativeReduction(candidate: M3HVariantEvidence, control: M3HVariantEvidence, applicable: boolean): number | null {
  if (!applicable) return null;
  const controlRate = control.aggregateValidation?.diagnostics.overlappingSignalRate;
  const candidateRate = candidate.aggregateValidation?.diagnostics.overlappingSignalRate;
  return controlRate === null || controlRate === undefined || candidateRate === null || candidateRate === undefined || controlRate === 0
    ? null
    : (controlRate - candidateRate) / controlRate;
}

function baseEvidence(input: Readonly<{
  experimentId: string;
  variantId: string;
  hypothesisId: string | "CONTROL";
  complexity: M3HComplexityTuple;
  selector: M3HSelectorSpec | null;
  results: readonly BacktestSignalResult[];
}>): M3HVariantEvidence {
  const normalized = input.results.map(adaptBacktestSignalResult);
  const validationRange = aggregateRange();
  const validationRecords = normalized.filter(
    (record) => record.signalTime >= validationRange.startTime && record.signalTime <= validationRange.endTime,
  );
  const aggregate = diagnosticsBundle(validationRecords, validationRange);
  return deepFreeze({
    experimentId: input.experimentId,
    variantId: input.variantId,
    hypothesisId: input.hypothesisId,
    complexity: input.complexity,
    selector: input.selector,
    aggregateValidation: aggregate,
    folds: foldEvidence(normalized),
    formalIdentitySha256: identityHash(input.results, false),
    executedIdentitySha256: identityHash(input.results, true),
    aggregateExpectancyDeltaVsControl: null,
    foldExpectancyDeltaVsControl: Object.freeze({ F1: null, F2: null, F3: null, F4: null, F5: null, F6: null }),
    improvedFoldCountUsingFrozen0_02Definition: null,
    catastrophicFoldCountUsingFrozenDefinition: null,
    redundancyRelativeReductionVsControl: null,
    decision: "DEFER_TO_M3_I_FROZEN_GATE_APPLICATION",
  });
}

function incompleteEvidence(definition: M3HExperimentDefinition, error: unknown): M3HVariantEvidence {
  return deepFreeze({
    experimentId: definition.experimentId,
    variantId: definition.variantId,
    hypothesisId: definition.hypothesisId,
    complexity: definition.complexity,
    selector: definition.selector,
    aggregateValidation: null,
    folds: Object.freeze([]),
    formalIdentitySha256: null,
    executedIdentitySha256: null,
    aggregateExpectancyDeltaVsControl: null,
    foldExpectancyDeltaVsControl: Object.freeze({}),
    improvedFoldCountUsingFrozen0_02Definition: null,
    catastrophicFoldCountUsingFrozenDefinition: null,
    redundancyRelativeReductionVsControl: null,
    decision: "DEFER_INCOMPLETE_EVIDENCE",
    evidenceError: error instanceof Error ? error.message : String(error),
  });
}

function candidateEvidence(
  definition: M3HExperimentDefinition,
  controlResultsByIdentity: ReadonlyMap<string, BacktestSignalResult>,
  controlSnapshots: readonly M3HDecisionSnapshot[],
  control: M3HVariantEvidence,
): M3HVariantEvidence {
  const selectedSnapshots = selectCandidateDecisionSnapshots(controlSnapshots, definition.selector);
  const selectedResults = selectedSnapshots.map((snapshot) => {
    const result = controlResultsByIdentity.get(decisionSnapshotIdentity(snapshot));
    if (!result) throw new Error(`M3-H selector identity is absent from CONTROL: ${decisionSnapshotIdentity(snapshot)}.`);
    return result;
  });
  const candidate = baseEvidence({
    experimentId: definition.experimentId,
    variantId: definition.variantId,
    hypothesisId: definition.hypothesisId,
    complexity: definition.complexity,
    selector: definition.selector,
    results: selectedResults,
  });
  return deepFreeze({
    ...candidate,
    aggregateExpectancyDeltaVsControl: aggregateExpectancyDelta(candidate, control),
    foldExpectancyDeltaVsControl: foldExpectancyDeltas(candidate, control),
    improvedFoldCountUsingFrozen0_02Definition: candidateImprovedFoldCount(candidate, control),
    catastrophicFoldCountUsingFrozenDefinition: candidateCatastrophicFoldCount(candidate),
    redundancyRelativeReductionVsControl: redundancyRelativeReduction(
      candidate,
      control,
      definition.hypothesisId === "H1_SIGNAL_REDUNDANCY" || definition.hypothesisId === "H4_SIGNAL_DENSITY",
    ),
  });
}

export function deriveM3HRound001Evidence(input: Readonly<{
  controlReport: BacktestReport;
  controlReportSha256: string;
  executionSourceSha: string;
}>): M3HResearchEvidence {
  validateM3HRound001Plan();
  const report = controlReport(input.controlReport);
  if (input.controlReportSha256.trim().length === 0) throw new Error("controlReportSha256 must be non-empty.");
  if (input.executionSourceSha.trim().length === 0) throw new Error("executionSourceSha must be non-empty.");
  const controlResultsByIdentity = new Map<string, BacktestSignalResult>();
  for (const result of report.signalResults) {
    const identity = `${result.snapshot.symbol}|${result.snapshot.direction}|${result.snapshot.signalTime}`;
    if (controlResultsByIdentity.has(identity)) throw new Error(`Duplicate CONTROL formal identity: ${identity}.`);
    controlResultsByIdentity.set(identity, result);
  }
  const control = baseEvidence({
    experimentId: M3_H_ROUND_001_PLAN.control.experimentId,
    variantId: M3_H_ROUND_001_PLAN.control.variantId,
    hypothesisId: "CONTROL",
    complexity: M3_H_ROUND_001_PLAN.control.complexity,
    selector: null,
    results: report.signalResults,
  });
  const controlSnapshots = toM3HDecisionSnapshots(report.signalResults);
  const candidates = M3_H_ROUND_001_EXPERIMENTS.map((definition) => {
    try {
      return candidateEvidence(definition, controlResultsByIdentity, controlSnapshots, control);
    } catch (error) {
      return incompleteEvidence(definition, error);
    }
  });
  const evidenceStatus: M3HEvidenceStatus = candidates.some((candidate) => candidate.decision === "DEFER_INCOMPLETE_EVIDENCE")
    ? "INCOMPLETE"
    : "COMPLETE";
  const decision: M3HEvidenceDecision = evidenceStatus === "COMPLETE"
    ? "DEFER_TO_M3_I_FROZEN_GATE_APPLICATION"
    : "DEFER_INCOMPLETE_EVIDENCE";
  return deepFreeze({
    schemaVersion: M3_H_ROUND_001_REPORT_SCHEMA_VERSION,
    researchRoundId: M3_H_ROUND_001_RESEARCH_ROUND_ID,
    selectionGateSha256: M3_H_ROUND_001_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_H_ROUND_001_PLAN_SHA256,
    executionSourceSha: input.executionSourceSha,
    controlReportSha256: input.controlReportSha256,
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    controlReportSchemaVersion: "m3-b-report-004",
    studyServerTime: report.studyServerTime,
    dataClassification: M3_H_RESEARCH_DATA_CLASSIFICATION,
    evidenceStatus,
    decision,
    control,
    candidates: Object.freeze(candidates),
  });
}

function displayNumber(value: number | null): string {
  return value === null ? "null" : String(value);
}

function bestCandidate(candidates: readonly M3HVariantEvidence[], selector: (candidate: M3HVariantEvidence) => number | null, descending: boolean): string {
  const available = candidates.filter((candidate) => selector(candidate) !== null);
  if (available.length === 0) return "NONE";
  const sorted = [...available].sort((left, right) => {
    const leftValue = selector(left)!;
    const rightValue = selector(right)!;
    return (descending ? rightValue - leftValue : leftValue - rightValue) || left.experimentId.localeCompare(right.experimentId);
  });
  return sorted[0]!.variantId;
}

export function serializeM3HResearchEvidence(report: M3HResearchEvidence): string {
  return `${stableStringify(report)}\n`;
}

export function renderM3HResultsMarkdown(report: M3HResearchEvidence): string {
  const rows = [report.control, ...report.candidates].map((variant) => {
    const diagnostics = variant.aggregateValidation?.diagnostics;
    return `| ${variant.variantId} | ${diagnostics?.formalSignals ?? "null"} | ${diagnostics?.executedTrades ?? "null"} | ${displayNumber(diagnostics?.netR ?? null)} | ${displayNumber(diagnostics?.expectancyR ?? null)} | ${displayNumber(diagnostics?.profitFactor ?? null)} | ${displayNumber(diagnostics?.feeBurdenRatio ?? null)} | ${displayNumber(diagnostics?.overlappingSignalRate ?? null)} | ${displayNumber(variant.aggregateExpectancyDeltaVsControl)} | ${variant.improvedFoldCountUsingFrozen0_02Definition ?? "null"} | ${variant.catastrophicFoldCountUsingFrozenDefinition ?? "null"} |`;
  }).join("\n");
  return [
    "# M3-H Round-001 Research Evidence",
    "",
    `evidenceStatus: ${report.evidenceStatus}`,
    `decision: ${report.decision}`,
    `researchRoundId: ${report.researchRoundId}`,
    `selectionGateSha256: ${report.selectionGateSha256}`,
    `experimentPlanSha256: ${report.experimentPlanSha256}`,
    `executionSourceSha: ${report.executionSourceSha}`,
    `controlReportSha256: ${report.controlReportSha256}`,
    `studyServerTime: ${report.studyServerTime}`,
    "dataClassification: RESEARCH_AVAILABLE_SEEN_DATA / HISTORICAL RESEARCH VALIDATION",
    "",
    "This evidence is descriptive only. M3-H does not apply selection gates or freeze baseline-002.",
    "",
    "## CONTROL and candidate diagnostics",
    "",
    "| variantId | formalSignals | executedTrades | netR | expectancyR | profitFactor | feeBurdenRatio | overlappingSignalRate | aggregateExpectancyDeltaVsControl | improvedFoldCount | catastrophicFoldCount |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    rows,
    "",
    `Highest aggregate expectancy (descriptive): ${bestCandidate(report.candidates, (candidate) => candidate.aggregateValidation?.diagnostics.expectancyR ?? null, true)}`,
    `Highest PF (descriptive): ${bestCandidate(report.candidates, (candidate) => candidate.aggregateValidation?.diagnostics.profitFactor ?? null, true)}`,
    `Lowest redundancy rate (descriptive): ${bestCandidate(report.candidates, (candidate) => candidate.redundancyRelativeReductionVsControl, false)}`,
    "",
    "No candidate is labeled PASS, ELIGIBLE, WINNER, BEST, or baseline-002.",
    "",
  ].join("\n");
}
