import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BacktestData, BacktestReport, BacktestSignalResult } from "../backtest/types.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange, selectRecordsForFoldRole } from "./folds.ts";
import type { ResearchFoldId } from "./constants.ts";
import type { ResearchDiagnostics, ResearchRange } from "./types.ts";
import { buildR11FeatureVector, createR11FeatureContext } from "./m3-r11-round-011-candidates.ts";
import type { R11FeatureContext } from "./m3-r11-round-011-candidates.ts";
import { buildRound006ControlRecords } from "./m3-r6-round-006-performance.ts";
import { prepareR11Dataset } from "./m3-r11-round-011-performance.ts";
import type { R11IntrabarPlan } from "./m3-r11-round-011-intrabar-plan.ts";
import {
  M3_R12_BASE_SOURCE_SHA,
  M3_R12_CANDIDATE_IDS,
  M3_R12_CONTROL_ID,
  M3_R12_PERFORMANCE_LOCK,
  M3_R12_POLICY_VERSION,
  M3_R12_RESEARCH_END_ISO,
  M3_R12_RESEARCH_RANGE,
  M3_R12_RESEARCH_ROUND_ID,
  R12_FROZEN_FOLD_IDS,
  R12_GOVERNANCE,
  type R12CandidateId,
  type R12Cohort,
} from "./m3-r12-round-012-protocol.ts";
import { R12_PLAN, R12_PLAN_SHA256, validateR12Plan } from "./m3-r12-round-012-plan.ts";
import { R12_SELECTION_GATE_SHA256, evaluateR12CandidateGates, selectR12Candidate, type R12CandidateGateEvaluation, type R12SelectionResult } from "./selection-gates-round-012.ts";
import { readR12SpecConformance, type R12SpecConformanceReport } from "./m3-r12-round-012-conformance.ts";
import { assertR12CandidateSettlementIdentity, classifyR12FormalSignals, retainR12Candidate, type R12ClassifiedRecord, type R12FormalInput } from "./m3-r12-round-012-thesis.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R12_REPORT_SCHEMA_VERSION = "m3-r12-round-012-report-001" as const;
export const M3_R12_AUDIT_SCHEMA_VERSION = "m3-r12-round-012-audit-001" as const;
export const M3_R12_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R12_ROUND_012_SUMMARY.json",
  "docs/evidence/M3_R12_ROUND_012_AUDIT.json",
  "docs/M3_R12_ROUND_012_RESULTS.md",
  "docs/evidence/M3_R12_ROUND_012_SELECTION.json",
  "docs/evidence/M3_R12_ROUND_012_SELECTION.md",
] as const);

export type R12PreparedDataset = Readonly<{
  data: BacktestData;
  intrabarPlan: R11IntrabarPlan;
  datasetFreeze: Readonly<{
    schemaVersion: "m3-r12-round-012-dataset-freeze-001";
    dataFreezeCompleted: true;
    datasetIdentitySha256: string;
    manifestIdentitySha256: string;
    manifestCount: number;
    intrabarRequirementCount: number;
    studyServerTime: number;
    source: "ACCEPTED_ROUND_006_CACHE_REUSED_AFTER_R11_IDENTITY_VALIDATION";
  }>;
}>;

export type R12Record = R12ClassifiedRecord & Readonly<{ distanceFeatureAvailable: boolean }>;

export type R12VolumeMetrics = Readonly<{
  totalFormalSignals: number;
  monthlySignalCounts: Readonly<Record<string, number>>;
  meanSignalsPerMonth: number;
  medianSignalsPerMonth: number;
  minimumSignalsPerMonth: number;
  maximumSignalsPerMonth: number;
  signalReductionPercent: number;
  executedTrades: number;
  netRPer100FormalAdvisories: number | null;
  netRPer100ExecutedTrades: number | null;
}>;

export type R12CohortDiagnostics = Readonly<{
  cohort: R12Cohort;
  formalCount: number;
  executedCount: number;
  tp: number;
  sl: number;
  noEntry: number;
  periodEndCensored: number;
  diagnostics: ResearchDiagnostics;
  maxDrawdownR: number | null;
  medianHoldingTimeHours: number | null;
}>;

export type R12CandidateEvidence = Readonly<{
  candidateId: R12CandidateId | typeof M3_R12_CONTROL_ID;
  resultStatus: "COMPLETE" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED";
  fullSeenUniverse: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics; formalIdentitySha256: string; executedIdentitySha256: string }>;
  folds: readonly Readonly<{
    foldId: ResearchFoldId;
    research: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics }>;
    validation: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics }>;
  }>[];
  aggregateValidation: Readonly<{ segments: readonly ResearchRange[]; diagnostics: ResearchDiagnostics; maxDrawdownR: number | null }>;
  formalSignals: number;
  executedTrades: number;
  maxDrawdownR: number | null;
  volume: R12VolumeMetrics;
}>;

export type R12PerformanceReport = Readonly<{
  schemaVersion: typeof M3_R12_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R12_RESEARCH_ROUND_ID;
  executionSourceSha: string;
  performanceExecutionSourceSha: string;
  selectionGateSha256: typeof R12_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof R12_PLAN_SHA256;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: typeof M3_R12_POLICY_VERSION;
  dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA";
  researchUniverse: typeof M3_R12_RESEARCH_RANGE;
  researchBoundary: typeof M3_R12_RESEARCH_END_ISO;
  studyServerTime: number;
  performanceLock: typeof M3_R12_PERFORMANCE_LOCK;
  performanceLockTriggered: true;
  performanceExecutionCount: 1;
  performanceLifecycle: "PERFORMANCE_LOCKED";
  datasetFreeze: R12PreparedDataset["datasetFreeze"];
  intrabarDependencyPlan: R11IntrabarPlan;
  evidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityErrors: readonly string[];
  control: R12CandidateEvidence;
  controlReport: Readonly<{ status: BacktestReport["status"]; metrics: BacktestReport["metrics"]; metricsByPeriod: BacktestReport["metricsByPeriod"]; diagnostics: readonly string[] }>;
  candidates: readonly R12CandidateEvidence[];
  candidateRegistry: typeof M3_R12_CANDIDATE_IDS;
  cohortDiagnostics: readonly R12CohortDiagnostics[];
  volumeComparison: Readonly<{ control: R12VolumeMetrics; candidates: readonly R12VolumeMetrics[] }>;
  gateEvaluations: readonly R12CandidateGateEvaluation[];
  selection: R12SelectionResult;
  productionSeenDiagnostic: Readonly<{ status: "SEEN_HYPOTHESIS_GENERATING_DIAGNOSTIC_ONLY"; source: "PRODUCTION_EXCLUDED_FROM_GATE"; executed: false }>;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  disclaimer: "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.";
  conformance: R12SpecConformanceReport;
}>;

export type R12AuditArtifact = Readonly<{
  schemaVersion: typeof M3_R12_AUDIT_SCHEMA_VERSION;
  execution: Readonly<{ executionSourceSha: string; performanceLock: typeof M3_R12_PERFORMANCE_LOCK; controlRuns: 1; candidateSettlementRuns: 0; selectionRuns: 1; cohortDiagnostics: true; privateApiAccessed: false; automaticTrading: false }>;
  decisions: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  outcomes: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}>;

export type R12ExecutionArtifacts = Readonly<{
  report: R12PerformanceReport;
  auditArtifact: R12AuditArtifact;
  summaryJson: string;
  auditJson: string;
  resultsMarkdown: string;
  selectionJson: string;
  selectionMarkdown: string;
}>;

export class R12AuthoritativeExecutionError extends Error {
  readonly classification: "PRE_PERFORMANCE_ABORT" | "POST_PERFORMANCE_EXECUTION_ABORT" | "POST_PERFORMANCE_EVIDENCE_PUBLISH_ABORT";
  readonly performanceLockTriggered: boolean;

  constructor(classification: R12AuthoritativeExecutionError["classification"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "R12AuthoritativeExecutionError";
    this.classification = classification;
    this.performanceLockTriggered = classification !== "PRE_PERFORMANCE_ABORT";
  }
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function recordSort(left: Pick<R12ClassifiedRecord, "raw">, right: Pick<R12ClassifiedRecord, "raw">): number {
  return left.raw.snapshot.signalTime - right.raw.snapshot.signalTime || left.raw.snapshot.symbol.localeCompare(right.raw.snapshot.symbol) || left.raw.snapshot.direction.localeCompare(right.raw.snapshot.direction);
}

function maxDrawdown(records: readonly R12ClassifiedRecord[]): number | null {
  const executed = records.filter((record) => record.raw.status === "EXECUTED" && record.raw.netR !== null).sort(recordSort);
  if (executed.length === 0) return null;
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;
  for (const record of executed) {
    cumulative += record.raw.netR!;
    peak = Math.max(peak, cumulative);
    drawdown = Math.min(drawdown, cumulative - peak);
  }
  return Number(drawdown.toFixed(12));
}

function monthKeys(range: ResearchRange): readonly string[] {
  const start = new Date(range.startTime);
  const end = new Date(range.endTime);
  const values: string[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();
  while (year < endYear || year === endYear && month <= endMonth) {
    values.push(`${year.toString().padStart(4, "0")}-${(month + 1).toString().padStart(2, "0")}`);
    month += 1;
    if (month === 12) { month = 0; year += 1; }
  }
  return Object.freeze(values);
}

function volumeMetrics(records: readonly R12ClassifiedRecord[], controlFormalSignals: number): R12VolumeMetrics {
  const monthly = Object.fromEntries(monthKeys(M3_R12_RESEARCH_RANGE).map((key) => [key, 0])) as Record<string, number>;
  for (const record of records) {
    const date = new Date(record.raw.snapshot.signalTime);
    const key = `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}`;
    monthly[key] = (monthly[key] ?? 0) + 1;
  }
  const counts = Object.values(monthly);
  const sorted = [...counts].sort((left, right) => left - right);
  const executed = records.filter((record) => record.raw.status === "EXECUTED" && record.raw.netR !== null);
  const netR = executed.reduce((sum, record) => sum + record.raw.netR!, 0);
  const mean = counts.reduce((sum, value) => sum + value, 0) / counts.length;
  const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2 : sorted[Math.floor(sorted.length / 2)]!;
  return Object.freeze({
    totalFormalSignals: records.length,
    monthlySignalCounts: Object.freeze(monthly),
    meanSignalsPerMonth: Number(mean.toFixed(12)),
    medianSignalsPerMonth: median,
    minimumSignalsPerMonth: sorted[0] ?? 0,
    maximumSignalsPerMonth: sorted.at(-1) ?? 0,
    signalReductionPercent: controlFormalSignals === 0 ? 0 : Number(((1 - records.length / controlFormalSignals) * 100).toFixed(12)),
    executedTrades: executed.length,
    netRPer100FormalAdvisories: records.length === 0 ? null : Number((netR / records.length * 100).toFixed(12)),
    netRPer100ExecutedTrades: executed.length === 0 ? null : Number((netR / executed.length * 100).toFixed(12)),
  });
}

function candidateResultStatus(records: readonly R12ClassifiedRecord[]): R12CandidateEvidence["resultStatus"] {
  if (records.some((record) => record.raw.status === "DATA_INCOMPLETE" || record.raw.status === "SETTLEMENT_AMBIGUOUS")) return "DATA_INCOMPLETE";
  if (records.some((record) => record.raw.status === "PERIOD_END_CENSORED")) return "PERIOD_END_CENSORED";
  return "COMPLETE";
}

function evidenceFor(candidateId: R12CandidateEvidence["candidateId"], rawRecords: readonly R12ClassifiedRecord[], controlFormalSignals: number): R12CandidateEvidence {
  const records = [...rawRecords].sort(recordSort);
  const signals = records.map((record) => record.signal);
  const identity = signals.map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`);
  const executedIdentity = signals.filter((signal) => signal.status === "EXECUTED").map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`);
  const folds = R12_FROZEN_FOLD_IDS.map((foldId) => {
    const researchRange = getResearchFoldRoleRange(foldId, "RESEARCH");
    const validationRange = getResearchFoldRoleRange(foldId, "VALIDATION");
    const research = selectRecordsForFoldRole(signals, foldId, "RESEARCH");
    const validation = selectRecordsForFoldRole(signals, foldId, "VALIDATION");
    return Object.freeze({
      foldId,
      research: Object.freeze({ range: researchRange, diagnostics: calculateResearchDiagnostics({ records: research, range: researchRange }) }),
      validation: Object.freeze({ range: validationRange, diagnostics: calculateResearchDiagnostics({ records: validation, range: validationRange }) }),
    });
  });
  const segments = folds.map((fold) => fold.validation.range);
  const aggregateRange = Object.freeze({ startTime: segments[0]!.startTime, endTime: segments.at(-1)!.endTime });
  const aggregate = signals.filter((signal) => segments.some((range) => signal.signalTime >= range.startTime && signal.signalTime <= range.endTime));
  return Object.freeze({
    candidateId,
    resultStatus: candidateResultStatus(records),
    fullSeenUniverse: Object.freeze({ range: M3_R12_RESEARCH_RANGE, diagnostics: calculateResearchDiagnostics({ records: signals, range: M3_R12_RESEARCH_RANGE }), formalIdentitySha256: sha256(identity), executedIdentitySha256: sha256(executedIdentity) }),
    folds: Object.freeze(folds),
    aggregateValidation: Object.freeze({ segments: Object.freeze(segments), diagnostics: calculateResearchDiagnostics({ records: aggregate, range: aggregateRange }), maxDrawdownR: maxDrawdown(records.filter((record) => segments.some((range) => record.raw.snapshot.signalTime >= range.startTime && record.raw.snapshot.signalTime <= range.endTime))) }),
    formalSignals: aggregate.length,
    executedTrades: aggregate.filter((signal) => signal.status === "EXECUTED").length,
    maxDrawdownR: maxDrawdown(records),
    volume: volumeMetrics(records, controlFormalSignals),
  });
}

function cohortDiagnostics(records: readonly R12ClassifiedRecord[]): readonly R12CohortDiagnostics[] {
  return Object.freeze(([
    "FIRST",
    "FOLLOWUP_1",
    "FOLLOWUP_2_PLUS",
  ] as const).map((cohort) => {
    const selected = records.filter((record) => record.cohort === cohort);
    const executed = selected.filter((record) => record.raw.status === "EXECUTED" && record.raw.entryTime !== null && record.raw.exitTime !== null);
    const holding = executed.map((record) => (record.raw.exitTime! - record.raw.entryTime!) / (60 * 60 * 1_000)).sort((left, right) => left - right);
    const date = (status: BacktestSignalResult["status"]) => selected.filter((record) => record.raw.status === status).length;
    return Object.freeze({
      cohort,
      formalCount: selected.length,
      executedCount: date("EXECUTED"),
      tp: selected.filter((record) => record.raw.exitReason === "TP").length,
      sl: selected.filter((record) => record.raw.exitReason === "SL").length,
      noEntry: date("ENTRY_OUTSIDE_BRACKET"),
      periodEndCensored: date("PERIOD_END_CENSORED"),
      diagnostics: calculateResearchDiagnostics({ records: selected.map((record) => record.signal), range: M3_R12_RESEARCH_RANGE }),
      maxDrawdownR: maxDrawdown(selected),
      medianHoldingTimeHours: holding.length === 0 ? null : holding.length % 2 === 0 ? (holding[holding.length / 2 - 1]! + holding[holding.length / 2]!) / 2 : holding[Math.floor(holding.length / 2)]!,
    });
  }));
}

function gateInput(candidate: R12CandidateEvidence, control: R12CandidateEvidence): Parameters<typeof evaluateR12CandidateGates>[0] {
  const candidateDiagnostics = candidate.aggregateValidation.diagnostics;
  const controlDiagnostics = control.aggregateValidation.diagnostics;
  const aggregateImprovement = candidateDiagnostics.expectancyR === null || controlDiagnostics.expectancyR === null ? null : candidateDiagnostics.expectancyR - controlDiagnostics.expectancyR;
  const improvedValidationFolds = candidate.folds.reduce((count, fold, index) => {
    const controlFold = control.folds[index]!.validation.diagnostics;
    const value = fold.validation.diagnostics;
    return value.executedTrades >= 30 && controlFold.executedTrades >= 30 && value.expectancyR !== null && controlFold.expectancyR !== null && value.expectancyR - controlFold.expectancyR >= 0.02 ? count + 1 : count;
  }, 0);
  const catastrophicFolds = candidate.folds.filter((fold) => {
    const diagnostics = fold.validation.diagnostics;
    return (diagnostics.expectancyR !== null && diagnostics.expectancyR <= -0.1) || (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < 0.8) || diagnostics.profitFactorStatus === "NO_TRADES" || diagnostics.executedTrades < 30;
  }).length;
  const positiveValidationFolds = candidate.folds.filter((fold) => fold.validation.diagnostics.expectancyR !== null && fold.validation.diagnostics.expectancyR > 0).length;
  const controlDd = control.aggregateValidation.maxDrawdownR;
  const candidateDd = candidate.aggregateValidation.maxDrawdownR;
  const drawdownMagnitudeImprovement = controlDd !== null && candidateDd !== null && Math.abs(controlDd) > 0 ? (Math.abs(controlDd) - Math.abs(candidateDd)) / Math.abs(controlDd) : null;
  return {
    candidateId: candidate.candidateId as R12CandidateId,
    resultStatus: candidate.resultStatus,
    aggregateExecutedTrades: candidateDiagnostics.executedTrades,
    minimumValidationFoldExecutedTrades: Math.min(...candidate.folds.map((fold) => fold.validation.diagnostics.executedTrades)),
    netExpectancyR: candidateDiagnostics.expectancyR,
    profitFactor: candidateDiagnostics.profitFactor,
    aggregateImprovement,
    improvedValidationFolds,
    positiveValidationFolds,
    catastrophicFolds,
    drawdownMagnitudeImprovement,
    topSymbolShareOfPositiveNetR: candidateDiagnostics.topSymbolShareOfPositiveNetR,
    largestSinglePositiveTradeShare: candidateDiagnostics.largestSingleTradeShareOfPositiveNetR,
    evidenceComplete: candidate.resultStatus !== "DATA_INCOMPLETE",
  };
}

function buildAudit(records: readonly R12Record[], report: R12PerformanceReport): R12AuditArtifact {
  const decisions: Record<string, Readonly<Record<string, unknown>>[]> = {};
  const outcomes: Record<string, Readonly<Record<string, unknown>>[]> = {};
  const streams: readonly Readonly<{ id: string; records: readonly R12ClassifiedRecord[] }>[] = [
    { id: M3_R12_CONTROL_ID, records },
    ...M3_R12_CANDIDATE_IDS.map((candidateId) => ({ id: candidateId, records: retainR12Candidate(records, candidateId) })),
  ];
  for (const stream of streams) {
    decisions[stream.id] = stream.records.map((record) => Object.freeze({ symbol: record.raw.snapshot.symbol, direction: record.raw.snapshot.direction, signalTime: record.raw.snapshot.signalTime, signalId: record.signalId, thesisId: record.thesisId, thesisOrdinal: record.thesisOrdinal, cohort: record.cohort, anchorSignalId: record.anchorSignalId, timeSinceFirstHours: record.timeSinceFirstHours, directionAdjustedPriceExtensionFromFirstAtr: record.directionAdjustedPriceExtensionFromFirstAtr, distanceFromEma20Atr: record.distanceFromEma20Atr, scoreDeltaFromFirst: record.scoreDeltaFromFirst, status: record.raw.status }));
    outcomes[stream.id] = stream.records.filter((record) => record.raw.status === "EXECUTED").map((record) => Object.freeze({ symbol: record.raw.snapshot.symbol, direction: record.raw.snapshot.direction, signalTime: record.raw.snapshot.signalTime, signalId: record.signalId, entryTime: record.raw.entryTime, exitTime: record.raw.exitTime, status: record.raw.status, grossR: record.raw.grossR, feeR: record.raw.feeR, fundingR: record.raw.fundingR, netR: record.raw.netR }));
  }
  return Object.freeze({ schemaVersion: M3_R12_AUDIT_SCHEMA_VERSION, execution: Object.freeze({ executionSourceSha: report.executionSourceSha, performanceLock: M3_R12_PERFORMANCE_LOCK, controlRuns: 1, candidateSettlementRuns: 0, selectionRuns: 1, cohortDiagnostics: true, privateApiAccessed: false, automaticTrading: false }), decisions: Object.freeze(decisions), outcomes: Object.freeze(outcomes) });
}

function metric(value: number | null): string { return value === null ? "null" : String(value); }

function renderResults(report: R12PerformanceReport): string {
  const lines = ["# M3-R12 Round-012 Thesis Deduplication / Follow-up Edge Study", "", `- researchRoundId: ${report.researchRoundId}`, `- executionSourceSha: ${report.executionSourceSha}`, `- selectionGateSha256: ${report.selectionGateSha256}`, `- experimentPlanSha256: ${report.experimentPlanSha256}`, `- dataClassification: ${report.dataClassification}`, `- researchBoundary: ${report.researchBoundary}`, `- performanceLock: ${report.performanceLock}`, `- performanceExecutionCount: ${report.performanceExecutionCount}`, `- evidenceStatus: ${report.evidenceStatus}`, `- integrityErrors: ${report.integrityErrors.join(", ") || "none"}`, "", "## Control and retained-candidate validation", "", "| candidate | formal | executed | net R | expectancy R | PF | max DD | reduction % |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"];
  for (const candidate of [report.control, ...report.candidates]) lines.push(`| ${candidate.candidateId} | ${candidate.aggregateValidation.diagnostics.formalSignals} | ${candidate.aggregateValidation.diagnostics.executedTrades} | ${metric(candidate.aggregateValidation.diagnostics.netR)} | ${metric(candidate.aggregateValidation.diagnostics.expectancyR)} | ${metric(candidate.aggregateValidation.diagnostics.profitFactor)} | ${metric(candidate.aggregateValidation.maxDrawdownR)} | ${candidate.volume.signalReductionPercent} |`);
  lines.push("", "## Cohort diagnostics", "", "| cohort | formal | executed | TP | SL | NO_ENTRY | PERIOD_END_CENSORED | expectancy R | PF | net R | fee R | funding R | median holding h |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const cohort of report.cohortDiagnostics) lines.push(`| ${cohort.cohort} | ${cohort.formalCount} | ${cohort.executedCount} | ${cohort.tp} | ${cohort.sl} | ${cohort.noEntry} | ${cohort.periodEndCensored} | ${metric(cohort.diagnostics.expectancyR)} | ${metric(cohort.diagnostics.profitFactor)} | ${cohort.diagnostics.netR} | ${cohort.diagnostics.feeR} | ${cohort.diagnostics.fundingR} | ${metric(cohort.medianHoldingTimeHours)} |`);
  lines.push("", "## Selection", "", `- finalDecision: ${report.selection.finalDecision}`, `- eligibleCandidateIds: ${report.selection.eligibleCandidateIds.join(", ") || "none"}`, `- selectedCandidateId: ${report.selection.selectedCandidateId ?? "null"}`, "", "Selection is eligibility-first and mechanical. Cohort bins and production observations are diagnostic-only.", "", "## Boundaries", "", "- Source stream is exact baseline-001 formal output; only retention changes.", "- Candidate settlement is the exact CONTROL settlement identity; no candidate settlement rerun.", "- Public historical data only; no private Binance API and no automatic trading.", "- Production post-boundary observations are excluded from Gate, training, and selection.", "- baseline-002: NOT_FROZEN", "- M3-J: BLOCKED", "- M4: NOT_STARTED", "");
  return lines.join("\n");
}

function selectionMarkdown(report: R12PerformanceReport): string {
  const lines = ["# M3-R12 Round-012 Selection", "", `- researchRoundId: ${report.researchRoundId}`, `- executionSourceSha: ${report.executionSourceSha}`, `- selectionGateSha256: ${report.selectionGateSha256}`, `- experimentPlanSha256: ${report.experimentPlanSha256}`, `- finalDecision: ${report.selection.finalDecision}`, `- eligibleCandidateIds: ${report.selection.eligibleCandidateIds.join(", ") || "none"}`, `- selectedCandidateId: ${report.selection.selectedCandidateId ?? "null"}`, "", "| candidate | eligibility | passed | applicable | failed |", "| --- | --- | ---: | ---: | --- |"];
  for (const evaluation of report.gateEvaluations) lines.push(`| ${evaluation.candidateId} | ${evaluation.eligibility} | ${evaluation.passedApplicableGateCount} | ${evaluation.applicableGateCount} | ${evaluation.failedGateIds.join(", ") || "none"} |`);
  lines.push("", "No eligible candidate leaves baseline-002 NOT_FROZEN.", "", "baseline-002: NOT_FROZEN", "M3-J: BLOCKED", "M4: NOT_STARTED", "");
  return lines.join("\n");
}

export async function prepareR12Dataset(input: Readonly<{ cacheDirectory: string; executionSourceSha: string; acceptedServerTime?: number }>): Promise<R12PreparedDataset> {
  const prepared = await prepareR11Dataset(input);
  return Object.freeze({
    data: prepared.data,
    intrabarPlan: prepared.intrabarPlan,
    datasetFreeze: Object.freeze({
      schemaVersion: "m3-r12-round-012-dataset-freeze-001",
      dataFreezeCompleted: true,
      datasetIdentitySha256: prepared.datasetFreeze.datasetIdentitySha256,
      manifestIdentitySha256: prepared.datasetFreeze.manifestIdentitySha256,
      manifestCount: prepared.datasetFreeze.manifestCount,
      intrabarRequirementCount: prepared.datasetFreeze.intrabarRequirementCount,
      studyServerTime: prepared.datasetFreeze.studyServerTime,
      source: "ACCEPTED_ROUND_006_CACHE_REUSED_AFTER_R11_IDENTITY_VALIDATION",
    }),
  });
}

function withR12Identity(raw: BacktestSignalResult, context: R11FeatureContext): R12FormalInput {
  let distanceFromEma20Atr: number | null = null;
  try {
    distanceFromEma20Atr = buildR11FeatureVector(context, raw).priceExtensionFrom1hEma20Atr;
  } catch {
    distanceFromEma20Atr = null;
  }
  return Object.freeze({
    raw,
    signal: deepFreeze({ ...adaptBacktestSignalResult(raw), researchRoundId: M3_R12_RESEARCH_ROUND_ID, experimentId: M3_R12_CONTROL_ID, variantId: M3_R12_CONTROL_ID }),
    feature: Object.freeze({ distanceFromEma20Atr }),
  });
}

function classifyControl(rawRecords: readonly BacktestSignalResult[], context: R11FeatureContext): readonly R12Record[] {
  const inputs = rawRecords.map((raw) => withR12Identity(raw, context));
  const classified = classifyR12FormalSignals(inputs);
  const featureById = new Map(inputs.map((input) => [`${input.raw.snapshot.symbol}|${input.raw.snapshot.direction}|${input.raw.snapshot.signalTime}`, input.feature?.distanceFromEma20Atr ?? null]));
  return Object.freeze(classified.map((record) => Object.freeze({ ...record, distanceFeatureAvailable: featureById.get(record.signalId) !== null })));
}

function selectionCandidateEvidence(candidate: R12CandidateEvidence): Parameters<typeof selectR12Candidate>[0][number] {
  return {
    candidateId: candidate.candidateId as R12CandidateId,
    eligible: false,
    aggregateValidationExpectancyR: candidate.aggregateValidation.diagnostics.expectancyR ?? Number.NEGATIVE_INFINITY,
    maxDrawdownR: candidate.aggregateValidation.maxDrawdownR,
    aggregateValidationProfitFactor: candidate.aggregateValidation.diagnostics.profitFactor,
    formalSignals: candidate.aggregateValidation.diagnostics.formalSignals,
  };
}

export async function executeR12Authoritative(input: Readonly<{ cacheDirectory: string; executionSourceSha: string; acceptedServerTime?: number }>): Promise<R12ExecutionArtifacts> {
  validateR12Plan();
  const conformance = readR12SpecConformance();
  if (!/^[0-9a-f]{40}$/u.test(input.executionSourceSha) || input.executionSourceSha === M3_R12_BASE_SOURCE_SHA) throw new R12AuthoritativeExecutionError("PRE_PERFORMANCE_ABORT", "R12 execution source SHA must be a final commit SHA distinct from the accepted R11 base.");
  let prepared: R12PreparedDataset;
  try {
    prepared = await prepareR12Dataset(input);
  } catch (error) {
    throw new R12AuthoritativeExecutionError("PRE_PERFORMANCE_ABORT", `R12 dataset preparation failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  let performanceLockTriggered = false;
  try {
    const context = createR11FeatureContext(prepared.data);
    let controlRuns = 0;
    performanceLockTriggered = true;
    controlRuns += 1;
    const controlRun = buildRound006ControlRecords(prepared.data);
    if (controlRuns !== 1 || controlRun.records.length === 0) throw new Error("R12 CONTROL did not execute exactly once with signal results.");
    const classifiedControl = classifyControl(controlRun.records.map((record) => record.raw), context);
    const controlEvidence = evidenceFor(M3_R12_CONTROL_ID, classifiedControl, classifiedControl.length);
    const candidateRecords = Object.freeze(M3_R12_CANDIDATE_IDS.map((candidateId) => Object.freeze({ candidateId, records: retainR12Candidate(classifiedControl, candidateId) })));
    for (const candidate of candidateRecords) if (!assertR12CandidateSettlementIdentity(classifiedControl, candidate.records)) throw new Error(`R12 candidate settlement identity failed: ${candidate.candidateId}`);
    const candidates = Object.freeze(candidateRecords.map((candidate) => evidenceFor(candidate.candidateId, candidate.records, classifiedControl.length)));
    const gateEvaluations = Object.freeze(candidates.map((candidate) => evaluateR12CandidateGates(gateInput(candidate, controlEvidence))));
    const selection = selectR12Candidate(candidates.map((candidate, index) => ({ ...selectionCandidateEvidence(candidate), eligible: gateEvaluations[index]!.eligibility === "ELIGIBLE" })));
    const integrityErrors: string[] = [];
    if (!conformance.thesisStateMachineVerified || conformance.resultAffectingDeviationCount !== 0 || !conformance.candidateSettlementIdentityVerified || !conformance.productionSeenDataExcluded) integrityErrors.push("R12_SPEC_CONFORMANCE_FAILED");
    const report: R12PerformanceReport = deepFreeze({
      schemaVersion: M3_R12_REPORT_SCHEMA_VERSION,
      researchRoundId: M3_R12_RESEARCH_ROUND_ID,
      executionSourceSha: input.executionSourceSha,
      performanceExecutionSourceSha: input.executionSourceSha,
      selectionGateSha256: R12_SELECTION_GATE_SHA256,
      experimentPlanSha256: R12_PLAN_SHA256,
      strategyVersion: "baseline-001",
      backtestPolicyVersion: M3_R12_POLICY_VERSION,
      dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
      researchUniverse: M3_R12_RESEARCH_RANGE,
      researchBoundary: M3_R12_RESEARCH_END_ISO,
      studyServerTime: prepared.datasetFreeze.studyServerTime,
      performanceLock: M3_R12_PERFORMANCE_LOCK,
      performanceLockTriggered: true,
      performanceExecutionCount: 1,
      performanceLifecycle: "PERFORMANCE_LOCKED",
      datasetFreeze: prepared.datasetFreeze,
      intrabarDependencyPlan: prepared.intrabarPlan,
      evidenceStatus: integrityErrors.length === 0 ? "COMPLETE" : "INCOMPLETE",
      integrityErrors: Object.freeze(integrityErrors),
      control: controlEvidence,
      controlReport: Object.freeze({ status: controlRun.report.status, metrics: controlRun.report.metrics, metricsByPeriod: controlRun.report.metricsByPeriod, diagnostics: controlRun.report.diagnostics }),
      candidates,
      candidateRegistry: M3_R12_CANDIDATE_IDS,
      cohortDiagnostics: cohortDiagnostics(classifiedControl),
      volumeComparison: Object.freeze({ control: controlEvidence.volume, candidates: Object.freeze(candidates.map((candidate) => candidate.volume)) }),
      gateEvaluations,
      selection,
      productionSeenDiagnostic: Object.freeze({ status: "SEEN_HYPOTHESIS_GENERATING_DIAGNOSTIC_ONLY", source: "PRODUCTION_EXCLUDED_FROM_GATE", executed: false }),
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      disclaimer: "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.",
      conformance,
    });
    const auditArtifact = buildAudit(classifiedControl, report);
    const selectionReport = Object.freeze({ schemaVersion: "m3-r12-round-012-selection-001", researchRoundId: M3_R12_RESEARCH_ROUND_ID, performanceExecutionSourceSha: input.executionSourceSha, selectionGateSha256: R12_SELECTION_GATE_SHA256, experimentPlanSha256: R12_PLAN_SHA256, performanceLock: M3_R12_PERFORMANCE_LOCK, evidenceStatus: report.evidenceStatus, integrityStatus: report.evidenceStatus === "COMPLETE" ? "COMPLETE" : "INCOMPLETE_EVIDENCE", integrityErrors: report.integrityErrors, candidates: report.gateEvaluations, eligibleCandidateIds: report.selection.eligibleCandidateIds, selectionAlgorithmApplied: report.selection.selectionAlgorithmApplied, selectedCandidateId: report.selection.selectedCandidateId, finalDecision: report.selection.finalDecision, baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" });
    return Object.freeze({ report, auditArtifact, summaryJson: stableStringify(report), auditJson: stableStringify(auditArtifact), resultsMarkdown: renderResults(report), selectionJson: stableStringify(selectionReport), selectionMarkdown: selectionMarkdown(report) });
  } catch (error) {
    if (error instanceof R12AuthoritativeExecutionError) throw error;
    throw new R12AuthoritativeExecutionError(performanceLockTriggered ? "POST_PERFORMANCE_EXECUTION_ABORT" : "PRE_PERFORMANCE_ABORT", `R12 authoritative execution failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

export function r12OutputPaths(root = process.cwd()): readonly string[] {
  return M3_R12_OUTPUT_PATHS.map((relative) => path.join(root, relative));
}

export function existingR12OutputArtifacts(root = process.cwd()): readonly string[] {
  return Object.freeze(r12OutputPaths(root).filter((filePath) => existsSync(filePath)));
}

export function r12ArtifactSizes(root = process.cwd()): readonly Readonly<{ filePath: string; bytes: number }>[] {
  return Object.freeze(r12OutputPaths(root).map((filePath) => Object.freeze({ filePath, bytes: statSync(filePath).size })));
}

export function publishR12ArtifactsAtomically(input: Readonly<{ artifacts: R12ExecutionArtifacts; root?: string; rename?: typeof renameSync; onStagingDirectory?: (directory: string) => void }>): void {
  const root = path.resolve(input.root ?? process.cwd());
  const targets = r12OutputPaths(root);
  const payloadByTarget = new Map<string, string>([
    [targets[0]!, input.artifacts.summaryJson],
    [targets[1]!, input.artifacts.auditJson],
    [targets[2]!, input.artifacts.resultsMarkdown],
    [targets[3]!, input.artifacts.selectionJson],
    [targets[4]!, input.artifacts.selectionMarkdown],
  ]);
  const existing = targets.filter((target) => existsSync(target));
  if (existing.length > 0) throw new Error(`R12 output already exists: ${existing.join(", ")}`);
  const stagingDirectory = path.join(path.dirname(targets[0]!), `.m3-r12-round-012-staging-${process.pid}-${Date.now()}`);
  mkdirSync(stagingDirectory, { recursive: true });
  input.onStagingDirectory?.(stagingDirectory);
  const renameArtifact = input.rename ?? renameSync;
  const publicationOrder = [targets[1]!, targets[2]!, targets[3]!, targets[4]!, targets[0]!];
  const published: string[] = [];
  try {
    for (const target of targets) writeFileSync(path.join(stagingDirectory, path.basename(target)), payloadByTarget.get(target)!, "utf8");
    for (const target of publicationOrder) {
      renameArtifact(path.join(stagingDirectory, path.basename(target)), target);
      published.push(target);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const target of [...published].reverse()) {
      try { unlinkSync(target); } catch (rollbackError) { rollbackErrors.push(`${target}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); }
    }
    try { rmSync(stagingDirectory, { recursive: true, force: true }); } catch (cleanupError) { rollbackErrors.push(`staging: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`); }
    if (rollbackErrors.length > 0 && error instanceof Error) error.message = `${error.message}; R12 rollback failures: ${rollbackErrors.join("; ")}`;
    throw error;
  }
  rmSync(stagingDirectory, { recursive: true, force: true });
}

export function readR12Summary(root = process.cwd()): R12PerformanceReport {
  return JSON.parse(readFileSync(r12OutputPaths(root)[0]!, "utf8")) as R12PerformanceReport;
}

export { R12_PLAN, R12_GOVERNANCE };
