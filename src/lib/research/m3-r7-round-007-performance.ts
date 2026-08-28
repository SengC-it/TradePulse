import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import { BinanceHistoricalDataLoader } from "../historical-data/binance/loader.ts";
import { type BinanceResponse } from "../market-data/binance/client.ts";
import type { BacktestData, BacktestReport, BacktestSignalResult } from "../backtest/types.ts";
import type { NormalizedResearchSignal, ResearchDiagnostics, ResearchRange } from "./types.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { Round006CachedBinanceClient } from "./m3-r6-round-006-data.ts";
import {
  appendRound006IntrabarWindows,
  buildRound006ControlRecords,
  buildRound006HistoricalLoadRanges,
  toBacktestData,
} from "./m3-r6-round-006-performance.ts";
import { buildR7IntrabarPlan, persistR7IntrabarPlan, readR6IntrabarRequirements, r7DatasetIdentity, type R7IntrabarPlan } from "./m3-r7-round-007-intrabar-plan.ts";
import {
  M3_R7_CANDIDATE_IDS,
  M3_R7_CONTROL_ID,
  M3_R7_PERFORMANCE_LOCK,
  M3_R7_POLICY_VERSION,
  M3_R7_RESEARCH_END_ISO,
  M3_R7_RESEARCH_RANGE,
  M3_R7_RESEARCH_ROUND_ID,
  R7_CANDIDATE_REGISTRY,
  R7_COMPLEXITY_TUPLES,
  R7_FROZEN_FOLD_IDS,
  R7_MODEL_CONTRACT,
  R7_SYMBOLS,
} from "./m3-r7-round-007-protocol.ts";
import { R7_PLAN_SHA256, R7_PLAN, validateR7Plan } from "./m3-r7-round-007-plan.ts";
import {
  R7_HARD_GATE_IDENTITIES,
  R7_MACHINE_RECORD,
  R7_SELECTION_GATE_SHA256,
  evaluateR7CandidateGates,
  selectR7Candidate,
  type R7CandidateGateEvaluation,
  type R7SelectionCandidate,
} from "./selection-gates-round-007.ts";
import { buildR7FeatureVector, classifyR7Opportunity, createR7FeatureContext, type R7FeatureContext } from "./m3-r7-round-007-candidates.ts";
import { fitR7RidgeModel, predictR7RidgeModel, type R7FeatureVector, type R7RidgeModel } from "./m3-r7-round-007-model.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R7_REPORT_SCHEMA_VERSION = "m3-r7-round-007-report-001" as const;
export const M3_R7_AUDIT_SCHEMA_VERSION = "m3-r7-round-007-audit-001" as const;
export const M3_R7_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R7_ROUND_007_SUMMARY.json",
  "docs/evidence/M3_R7_ROUND_007_AUDIT.json",
  "docs/M3_R7_ROUND_007_RESULTS.md",
  "docs/evidence/M3_R7_ROUND_007_SELECTION.json",
  "docs/M3_R7_ROUND_007_SELECTION.md",
] as const);
export const M3_R7_ACCEPTED_R6_STUDY_SERVER_TIME = 1787801312279;

type R7Record = Readonly<{
  candidateId: typeof M3_R7_CONTROL_ID | (typeof M3_R7_CANDIDATE_IDS)[number];
  raw: BacktestSignalResult;
  signal: NormalizedResearchSignal;
  feature?: R7FeatureVector;
  prediction?: number;
  routerCell?: string;
}>;

type R7PreparedDataset = Readonly<{
  data: BacktestData;
  intrabarPlan: R7IntrabarPlan;
  datasetFreeze: Readonly<{
    schemaVersion: "m3-r7-round-007-dataset-freeze-001";
    dataFreezeCompleted: true;
    datasetIdentitySha256: string;
    manifestIdentitySha256: string;
    manifestCount: number;
    intrabarRequirementCount: number;
    studyServerTime: number;
    source: "ACCEPTED_ROUND_006_CACHE_REUSED_AFTER_IDENTITY_VALIDATION";
  }>;
}>;

export type R7CandidateEvidence = Readonly<{
  candidateId: (typeof M3_R7_CANDIDATE_IDS)[number] | typeof M3_R7_CONTROL_ID;
  resultStatus: "COMPLETE" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED";
  fullSeenUniverse: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics; formalIdentitySha256: string; executedIdentitySha256: string }>;
  folds: readonly Readonly<{
    foldId: (typeof R7_FROZEN_FOLD_IDS)[number];
    research: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics }>;
    validation: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics }>;
  }>[];
  aggregateValidation: Readonly<{ segments: readonly ResearchRange[]; diagnostics: ResearchDiagnostics }>;
  formalSignals: number;
  executedTrades: number;
  maxDrawdownR: number | null;
}>;

export type R7ModelEvidence = Readonly<{
  foldId: (typeof R7_FROZEN_FOLD_IDS)[number];
  candidateId: "R7-S1-CALIBRATED-SCORE-V2" | "R7-C1-RECLAIM-CALIBRATED-SCORE-V2";
  status: "FIT" | "INSUFFICIENT_RESEARCH_EXAMPLES";
  trainingExamples: number;
  modelIdentitySha256: string | null;
  standardizationIdentitySha256: string | null;
  coefficients: Readonly<Record<string, number>>;
  predictionDistribution: Readonly<{ count: number; min: number | null; max: number | null; average: number | null }>;
  calibrationByBucket: Readonly<Record<string, Readonly<{ count: number; averageActualNetR: number | null }>>>;
}>;

export type R7PerformanceReport = Readonly<{
  schemaVersion: typeof M3_R7_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R7_RESEARCH_ROUND_ID;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: typeof M3_R7_POLICY_VERSION;
  dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA";
  researchUniverse: typeof M3_R7_RESEARCH_RANGE;
  researchBoundary: typeof M3_R7_RESEARCH_END_ISO;
  studyServerTime: number;
  performanceLock: typeof M3_R7_PERFORMANCE_LOCK;
  performanceLockTriggered: true;
  performanceExecutionCount: 1;
  performanceLifecycle: "PERFORMANCE_LOCKED";
  datasetFreeze: R7PreparedDataset["datasetFreeze"];
  intrabarDependencyPlan: R7IntrabarPlan;
  evidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityErrors: readonly string[];
  control: R7CandidateEvidence;
  controlReport: Readonly<{ status: BacktestReport["status"]; metrics: BacktestReport["metrics"]; metricsByPeriod: BacktestReport["metricsByPeriod"]; diagnostics: readonly string[] }>;
  candidates: readonly R7CandidateEvidence[];
  candidateRegistry: typeof M3_R7_CANDIDATE_IDS;
  gateEvaluations: readonly R7CandidateGateEvaluation[];
  models: readonly R7ModelEvidence[];
  router: Readonly<{ fixedCellCount: 48; eligibleCellsByFold: Readonly<Record<string, readonly string[]>>; validationUsesResearchEligibleCellsOnly: true }>;
  selection: Readonly<{ selectionAlgorithmApplied: boolean; eligibleCandidateIds: readonly (typeof M3_R7_CANDIDATE_IDS)[number][]; selectedCandidateId: (typeof M3_R7_CANDIDATE_IDS)[number] | null; finalDecision: string }>;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  disclaimer: "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.";
}>;

export type R7AuditArtifact = Readonly<{
  schemaVersion: typeof M3_R7_AUDIT_SCHEMA_VERSION;
  execution: Readonly<{ executionSourceSha: string; performanceLock: typeof M3_R7_PERFORMANCE_LOCK; controlRuns: number; candidateSettlementRuns: number; selectionRuns: number; privateApiAccessed: false; automaticTrading: false }>;
  decisions: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  outcomes: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}>;

export type R7ExecutionArtifacts = Readonly<{
  report: R7PerformanceReport;
  auditArtifact: R7AuditArtifact;
  summaryJson: string;
  auditJson: string;
  resultsMarkdown: string;
  selectionJson: string;
  selectionMarkdown: string;
}>;

function sha256(value: unknown): string { return createHash("sha256").update(stableStringify(value), "utf8").digest("hex"); }
function symbolOrder(symbol: string): number { return R7_SYMBOLS.indexOf(symbol as (typeof R7_SYMBOLS)[number]); }
function directionOrder(direction: "LONG" | "SHORT"): number { return direction === "LONG" ? 0 : 1; }
function recordKey(record: Pick<R7Record, "raw">): string { return `${record.raw.snapshot.symbol}|${record.raw.snapshot.direction}|${record.raw.snapshot.signalTime}`; }
function recordSort(left: R7Record, right: R7Record): number { return left.raw.snapshot.signalTime - right.raw.snapshot.signalTime || symbolOrder(left.raw.snapshot.symbol) - symbolOrder(right.raw.snapshot.symbol) || directionOrder(left.raw.snapshot.direction) - directionOrder(right.raw.snapshot.direction); }

function acceptedServerTimeResponse(serverTime: number): BinanceResponse<{ serverTime: number }> {
  return Object.freeze({ data: Object.freeze({ serverTime }), diagnostics: Object.freeze({ endpoint: "/fapi/v1/time", operationStartedAt: 0, attemptStartedAt: 0, attemptCompletedAt: 0, roundTripMs: 0, attempts: 1 }) });
}

class R7CacheClient extends Round006CachedBinanceClient {
  private readonly acceptedServerTime: number;
  constructor(cacheDirectory: string, acceptedServerTime: number) { super({ cacheDirectory }); this.acceptedServerTime = acceptedServerTime; }
  override async getServerTime(): Promise<BinanceResponse<{ serverTime: number }>> { return acceptedServerTimeResponse(this.acceptedServerTime); }
}

export async function prepareR7Dataset(input: Readonly<{ cacheDirectory: string; acceptedServerTime?: number; executionSourceSha: string }>): Promise<R7PreparedDataset> {
  const serverTime = input.acceptedServerTime ?? M3_R7_ACCEPTED_R6_STUDY_SERVER_TIME;
  const client = new R7CacheClient(input.cacheDirectory, serverTime);
  const loader = new BinanceHistoricalDataLoader({ client });
  const study = await loader.loadStudyData({ ...buildRound006HistoricalLoadRanges(), policy: M3_R7_POLICY_VERSION });
  const coarseData = toBacktestData(study);
  const acceptedR6 = readR6IntrabarRequirements(input.cacheDirectory);
  const intrabarPlan = buildR7IntrabarPlan({ data: coarseData, sourceSha: input.executionSourceSha, requirements: acceptedR6.requirements, existingR6PlanSha256: acceptedR6.planSha256 });
  const planPath = path.join(input.cacheDirectory, "round-007-intrabar-plan.json");
  persistR7IntrabarPlan(intrabarPlan, planPath);
  const windows = await loader.loadIntrabarSettlementWindows(intrabarPlan.requirements, study.serverTime);
  const data = appendRound006IntrabarWindows(coarseData, windows, intrabarPlan.requirements);
  const canonicalManifests = data.manifests.map((manifest) => { const copy = { ...manifest } as Record<string, unknown>; delete copy.retrievedAt; return copy; }).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  const manifestIdentitySha256 = sha256(canonicalManifests);
  const datasetIdentitySha256 = r7DatasetIdentity({ data, plan: intrabarPlan, studyServerTime: study.serverTime });
  return Object.freeze({ data, intrabarPlan, datasetFreeze: Object.freeze({ schemaVersion: "m3-r7-round-007-dataset-freeze-001", dataFreezeCompleted: true, datasetIdentitySha256, manifestIdentitySha256, manifestCount: data.manifests.length, intrabarRequirementCount: intrabarPlan.requirements.length, studyServerTime: study.serverTime, source: "ACCEPTED_ROUND_006_CACHE_REUSED_AFTER_IDENTITY_VALIDATION" }) });
}

function withR7Identity(candidateId: R7Record["candidateId"], result: BacktestSignalResult, context?: R7FeatureContext): R7Record {
  const signal = { ...adaptBacktestSignalResult(result), researchRoundId: M3_R7_RESEARCH_ROUND_ID, experimentId: candidateId, variantId: candidateId === M3_R7_CONTROL_ID ? M3_R7_CONTROL_ID : R7_CANDIDATE_REGISTRY.find((item) => item.candidateId === candidateId)?.variantId };
  const feature = context ? (() => { try { return buildR7FeatureVector(context, result); } catch { return undefined; } })() : undefined;
  return Object.freeze({ candidateId, raw: result, signal: Object.freeze(signal), ...(feature ? { feature } : {}) });
}

function uniqueRecords(records: readonly R7Record[]): readonly R7Record[] {
  const seen = new Set<string>();
  return Object.freeze(records.filter((record) => { const key = recordKey(record); if (seen.has(key)) return false; seen.add(key); return true; }).sort(recordSort));
}

function inRange(signalTime: number, range: ResearchRange): boolean { return signalTime >= range.startTime && signalTime <= range.endTime; }
function recordsForRole(records: readonly R7Record[], foldId: (typeof R7_FROZEN_FOLD_IDS)[number], role: "RESEARCH" | "VALIDATION"): readonly R7Record[] { const range = getResearchFoldRoleRange(foldId, role); return Object.freeze(records.filter((record) => inRange(record.raw.snapshot.signalTime, range))); }

function maxDrawdown(records: readonly R7Record[]): number | null {
  const executed = records.filter((record) => record.raw.status === "EXECUTED" && record.raw.netR !== null).sort(recordSort);
  if (executed.length === 0) return null;
  let cumulative = 0; let peak = 0; let drawdown = 0;
  for (const record of executed) { cumulative += record.raw.netR!; peak = Math.max(peak, cumulative); drawdown = Math.min(drawdown, cumulative - peak); }
  return Number(drawdown.toFixed(12));
}

function evidenceFor(candidateId: R7CandidateEvidence["candidateId"], rawRecords: readonly R7Record[]): R7CandidateEvidence {
  const records = uniqueRecords(rawRecords.filter((record) => record.candidateId === candidateId));
  const signals = records.map((record) => record.signal);
  const identity = signals.map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`);
  const executedIdentity = signals.filter((signal) => signal.status === "EXECUTED").map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`);
  const folds = R7_FROZEN_FOLD_IDS.map((foldId) => {
    const researchRange = getResearchFoldRoleRange(foldId, "RESEARCH");
    const validationRange = getResearchFoldRoleRange(foldId, "VALIDATION");
    const research = signals.filter((signal) => inRange(signal.signalTime, researchRange));
    const validation = signals.filter((signal) => inRange(signal.signalTime, validationRange));
    return Object.freeze({ foldId, research: Object.freeze({ range: researchRange, diagnostics: calculateResearchDiagnostics({ records: research, range: researchRange }) }), validation: Object.freeze({ range: validationRange, diagnostics: calculateResearchDiagnostics({ records: validation, range: validationRange }) }) });
  });
  const segments = folds.map((fold) => fold.validation.range);
  const aggregateSignals = signals.filter((signal) => segments.some((range) => inRange(signal.signalTime, range)));
  const aggregateRange = Object.freeze({ startTime: segments[0]!.startTime, endTime: segments.at(-1)!.endTime });
  const validationIncomplete = aggregateSignals.some((signal) => signal.status === "DATA_INCOMPLETE" || signal.status === "SETTLEMENT_AMBIGUOUS");
  const anyCensored = signals.some((signal) => signal.status === "PERIOD_END_CENSORED");
  return Object.freeze({ candidateId, resultStatus: validationIncomplete ? "DATA_INCOMPLETE" : anyCensored ? "PERIOD_END_CENSORED" : "COMPLETE", fullSeenUniverse: Object.freeze({ range: M3_R7_RESEARCH_RANGE, diagnostics: calculateResearchDiagnostics({ records: signals, range: M3_R7_RESEARCH_RANGE }), formalIdentitySha256: sha256(identity), executedIdentitySha256: sha256(executedIdentity) }), folds: Object.freeze(folds), aggregateValidation: Object.freeze({ segments: Object.freeze(segments), diagnostics: calculateResearchDiagnostics({ records: aggregateSignals, range: aggregateRange }) }), formalSignals: aggregateSignals.length, executedTrades: aggregateSignals.filter((signal) => signal.status === "EXECUTED").length, maxDrawdownR: maxDrawdown(records) });
}

function modelExamples(records: readonly R7Record[]): readonly { features: R7FeatureVector; netR: number }[] { return records.filter((record): record is R7Record & { feature: R7FeatureVector } => record.feature !== undefined && record.raw.status === "EXECUTED" && record.raw.netR !== null && Number.isFinite(record.raw.netR)).map((record) => ({ features: record.feature, netR: record.raw.netR! })); }

function calibration(model: R7RidgeModel | null, records: readonly R7Record[]): Readonly<{ predictionDistribution: R7ModelEvidence["predictionDistribution"]; calibrationByBucket: R7ModelEvidence["calibrationByBucket"] }> {
  if (!model) return Object.freeze({ predictionDistribution: Object.freeze({ count: 0, min: null, max: null, average: null }), calibrationByBucket: Object.freeze({}) });
  const values = records.filter((record): record is R7Record & { feature: R7FeatureVector } => record.feature !== undefined).map((record) => ({ prediction: predictR7RidgeModel(model, record.feature), actual: record.raw.netR }));
  const buckets = Object.fromEntries(["LT_NEGATIVE_0_10", "NEGATIVE_0_10_TO_0", "ZERO_TO_0_05", "0_05_TO_0_10", "GTE_0_10"].map((id) => { const selected = values.filter(({ prediction }) => id === "LT_NEGATIVE_0_10" ? prediction < -0.1 : id === "NEGATIVE_0_10_TO_0" ? prediction >= -0.1 && prediction < 0 : id === "ZERO_TO_0_05" ? prediction >= 0 && prediction < 0.05 : id === "0_05_TO_0_10" ? prediction >= 0.05 && prediction < 0.1 : prediction >= 0.1); const actual = selected.map((value) => value.actual).filter((value): value is number => value !== null && Number.isFinite(value)); return [id, Object.freeze({ count: selected.length, averageActualNetR: actual.length ? actual.reduce((sum, value) => sum + value, 0) / actual.length : null })]; })) as Record<string, Readonly<{ count: number; averageActualNetR: number | null }> >;
  return Object.freeze({ predictionDistribution: Object.freeze({ count: values.length, min: values.length ? Math.min(...values.map((value) => value.prediction)) : null, max: values.length ? Math.max(...values.map((value) => value.prediction)) : null, average: values.length ? values.reduce((sum, value) => sum + value.prediction, 0) / values.length : null }), calibrationByBucket: Object.freeze(buckets) });
}

function buildModels(controlRecords: readonly R7Record[], e1Records: readonly R7Record[]): Readonly<{ models: readonly R7ModelEvidence[]; modelMap: Readonly<Record<string, R7RidgeModel | null>> }> {
  const models: R7ModelEvidence[] = [];
  const modelMap: Record<string, R7RidgeModel | null> = {};
  for (const candidateId of ["R7-S1-CALIBRATED-SCORE-V2", "R7-C1-RECLAIM-CALIBRATED-SCORE-V2"] as const) {
    const source = candidateId === "R7-S1-CALIBRATED-SCORE-V2" ? controlRecords : e1Records;
    for (const foldId of R7_FROZEN_FOLD_IDS) {
      const researchRecords = recordsForRole(source, foldId, "RESEARCH");
      const examples = modelExamples(researchRecords);
      let model: R7RidgeModel | null = null;
      try { model = fitR7RidgeModel(examples); } catch { model = null; }
      modelMap[`${candidateId}|${foldId}`] = model;
      const diagnostics = calibration(model, researchRecords);
      models.push(Object.freeze({ foldId, candidateId, status: model ? "FIT" : "INSUFFICIENT_RESEARCH_EXAMPLES", trainingExamples: examples.length, modelIdentitySha256: model?.modelIdentitySha256 ?? null, standardizationIdentitySha256: model?.standardization.identitySha256 ?? null, coefficients: Object.freeze(model?.coefficients ?? {}), ...diagnostics }));
    }
  }
  return Object.freeze({ models: Object.freeze(models), modelMap: Object.freeze(modelMap) });
}

function filteredModelRecords(candidateId: "R7-S1-CALIBRATED-SCORE-V2" | "R7-C1-RECLAIM-CALIBRATED-SCORE-V2", source: readonly R7Record[], modelMap: Readonly<Record<string, R7RidgeModel | null>>): readonly R7Record[] {
  const accepted: R7Record[] = [];
  for (const foldId of R7_FROZEN_FOLD_IDS) {
    const model = modelMap[`${candidateId}|${foldId}`];
    if (!model) continue;
    for (const record of recordsForRole(source, foldId, "VALIDATION")) {
      if (!record.feature) continue;
      const prediction = predictR7RidgeModel(model, record.feature);
      if (prediction >= R7_MODEL_CONTRACT.minimumPredictedNetR) accepted.push(Object.freeze({ ...record, candidateId, prediction }));
    }
  }
  return uniqueRecords(accepted);
}

function routerFilteredRecords(controlRecords: readonly R7Record[], context: R7FeatureContext): Readonly<{ records: readonly R7Record[]; eligibleCellsByFold: Readonly<Record<string, readonly string[]>> }> {
  const eligibleCellsByFold: Record<string, readonly string[]> = {};
  const accepted: R7Record[] = [];
  for (const foldId of R7_FROZEN_FOLD_IDS) {
    const research = recordsForRole(controlRecords, foldId, "RESEARCH");
    const byCell = new Map<string, R7Record[]>();
    for (const record of research) { const cell = classifyR7Opportunity(context, record.raw).routerCell; const list = byCell.get(cell) ?? []; list.push(record); byCell.set(cell, list); }
    const cells = [...byCell.entries()].filter(([, records]) => { const executed = records.filter((record) => record.raw.status === "EXECUTED" && record.raw.netR !== null); const expectancy = executed.length ? executed.reduce((sum, record) => sum + record.raw.netR!, 0) / executed.length : null; return executed.length >= 100 && expectancy !== null && expectancy >= 0.05; }).map(([cell]) => cell).sort();
    eligibleCellsByFold[foldId] = Object.freeze(cells);
    for (const record of recordsForRole(controlRecords, foldId, "VALIDATION")) { const cell = classifyR7Opportunity(context, record.raw).routerCell; if (cells.includes(cell)) accepted.push(Object.freeze({ ...record, candidateId: "R7-R1-REGIME-EXPECTANCY-ROUTER", routerCell: cell })); }
  }
  return Object.freeze({ records: uniqueRecords(accepted), eligibleCellsByFold: Object.freeze(eligibleCellsByFold) });
}

function gateInput(candidate: R7CandidateEvidence, control: R7CandidateEvidence, modelRequired: boolean, modelIntegrity: boolean): Parameters<typeof evaluateR7CandidateGates>[0] {
  const candidateDiagnostics = candidate.aggregateValidation.diagnostics;
  const controlDiagnostics = control.aggregateValidation.diagnostics;
  const aggregateImprovement = candidateDiagnostics.expectancyR === null || controlDiagnostics.expectancyR === null ? null : candidateDiagnostics.expectancyR - controlDiagnostics.expectancyR;
  const improvedValidationFolds = candidate.folds.reduce((count, fold, index) => { const controlFold = control.folds[index]!.validation.diagnostics; const value = fold.validation.diagnostics; return value.executedTrades >= 30 && controlFold.executedTrades >= 30 && value.expectancyR !== null && controlFold.expectancyR !== null && value.expectancyR - controlFold.expectancyR >= 0.02 ? count + 1 : count; }, 0);
  const catastrophicFolds = candidate.folds.filter((fold) => { const diagnostics = fold.validation.diagnostics; return (diagnostics.expectancyR !== null && diagnostics.expectancyR <= -0.1) || (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < 0.8) || diagnostics.profitFactorStatus === "NO_TRADES" || diagnostics.executedTrades < 30; }).length;
  const positiveNetValidationFolds = candidate.folds.filter((fold) => fold.validation.diagnostics.expectancyR !== null && fold.validation.diagnostics.expectancyR > 0).length;
  return { candidateId: candidate.candidateId as (typeof M3_R7_CANDIDATE_IDS)[number], resultStatus: candidate.resultStatus, aggregateImprovement, improvedValidationFolds, catastrophicFolds, positiveNetValidationFolds, netExpectancyR: candidateDiagnostics.expectancyR, profitFactor: candidateDiagnostics.profitFactor, profitFactorStatus: candidateDiagnostics.profitFactorStatus, topSymbolShareOfPositiveNetR: candidateDiagnostics.topSymbolShareOfPositiveNetR, largestSingleTradeShareOfPositiveNetR: candidateDiagnostics.largestSingleTradeShareOfPositiveNetR, feeBurdenRatio: candidateDiagnostics.feeBurdenRatio, formalSignals: candidateDiagnostics.formalSignals, minimumFoldExecutedTrades: Math.min(...candidate.folds.map((fold) => fold.validation.diagnostics.executedTrades)), modelRequired, modelIntegrity };
}

function selectionMarkdown(report: R7PerformanceReport): string {
  const lines = ["# M3-R7 Round-007 Selection", "", `- researchRoundId: ${report.researchRoundId}`, `- selectionGateSha256: ${report.selectionGateSha256}`, `- experimentPlanSha256: ${report.experimentPlanSha256}`, `- finalDecision: ${report.selection.finalDecision}`, `- eligibleCandidateIds: ${report.selection.eligibleCandidateIds.join(", ") || "none"}`, `- selectedCandidateId: ${report.selection.selectedCandidateId ?? "null"}`, "", "| candidate | eligibility | passed | applicable | failed |", "| --- | --- | ---: | ---: | --- |"];
  for (const evaluation of report.gateEvaluations) lines.push(`| ${evaluation.candidateId} | ${evaluation.eligibility} | ${evaluation.passedApplicableGateCount} | ${evaluation.applicableGateCount} | ${evaluation.failedGateIds.join(", ") || "none"} |`);
  lines.push("", "Selection is mechanical and eligibility-first. No eligible candidate leaves baseline-002 NOT_FROZEN.", "", "baseline-002: NOT_FROZEN", "M3-J: BLOCKED", "M4: NOT_STARTED", "");
  return lines.join("\n");
}

function renderResults(report: R7PerformanceReport): string {
  const metric = (value: number | null): string => value === null ? "null" : String(value);
  const lines = ["# M3-R7 Round-007 Model-Level Profitability Rebuild", "", `- researchRoundId: ${report.researchRoundId}`, `- executionSourceSha: ${report.executionSourceSha}`, `- selectionGateSha256: ${report.selectionGateSha256}`, `- experimentPlanSha256: ${report.experimentPlanSha256}`, `- dataClassification: ${report.dataClassification}`, `- researchBoundary: ${report.researchBoundary}`, `- studyServerTime: ${report.studyServerTime}`, `- performanceLock: ${report.performanceLock}`, `- performanceExecutionCount: ${report.performanceExecutionCount}`, `- evidenceStatus: ${report.evidenceStatus}`, `- integrityErrors: ${report.integrityErrors.join(", ") || "none"}`, "", "## Control and candidate aggregate validation", "", "| candidate | status | formal | executed | net R | expectancy R | PF |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |"];
  const evidence = [report.control, ...report.candidates];
  for (const candidate of evidence) { const diagnostics = candidate.aggregateValidation.diagnostics; lines.push(`| ${candidate.candidateId} | ${candidate.resultStatus} | ${diagnostics.formalSignals} | ${diagnostics.executedTrades} | ${metric(diagnostics.netR)} | ${metric(diagnostics.expectancyR)} | ${metric(diagnostics.profitFactor)} |`); }
  lines.push("", "## Frozen validation folds", "", "| candidate | fold | research formal/executed | validation formal/executed | validation expectancy R | validation PF |", "| --- | --- | ---: | ---: | ---: | ---: |");
  for (const candidate of evidence) for (const fold of candidate.folds) lines.push(`| ${candidate.candidateId} | ${fold.foldId} | ${fold.research.diagnostics.formalSignals}/${fold.research.diagnostics.executedTrades} | ${fold.validation.diagnostics.formalSignals}/${fold.validation.diagnostics.executedTrades} | ${metric(fold.validation.diagnostics.expectancyR)} | ${metric(fold.validation.diagnostics.profitFactor)} |`);
  lines.push("", "## Model and router", "", `- Fixed ridge lambda: ${R7_MODEL_CONTRACT.lambda}; features: ${R7_MODEL_CONTRACT.featureNames.length}; fit scope: ${R7_MODEL_CONTRACT.fitScope}.`, `- R1 router cells: ${report.router.fixedCellCount}; validation uses research-eligible cells only.`, `- Performance result count: ${report.performanceExecutionCount}; CONTROL runs: 1; candidate settlement runs: 0 because candidates are derived filters of the single settled CONTROL stream.`, "", "## Boundaries", "", "- Public Binance historical data only; no private API and no automatic trading.", "- Closed decision-time candles only; validation never fits, tunes, or changes a model/router.", "- PERIOD_END_CENSORED is formal/non-executed and does not invalidate a complete validation segment; DATA_INCOMPLETE fails closed.", "- baseline-002: NOT_FROZEN", "- M3-J: BLOCKED", "- M4: NOT_STARTED", "");
  return lines.join("\n");
}

function buildAudit(records: readonly R7Record[], report: R7PerformanceReport): R7AuditArtifact {
  const decisions: Record<string, Readonly<Record<string, unknown>>[]> = {};
  const outcomes: Record<string, Readonly<Record<string, unknown>>[]> = {};
  for (const record of records) {
    const item = Object.freeze({ symbol: record.raw.snapshot.symbol, direction: record.raw.snapshot.direction, signalTime: record.raw.snapshot.signalTime, status: record.raw.status, routerCell: record.routerCell ?? null, prediction: record.prediction ?? null });
    (decisions[record.candidateId] ??= []).push(item);
    if (record.raw.status === "EXECUTED") (outcomes[record.candidateId] ??= []).push(Object.freeze({ symbol: record.raw.snapshot.symbol, direction: record.raw.snapshot.direction, signalTime: record.raw.snapshot.signalTime, entryTime: record.raw.entryTime, exitTime: record.raw.exitTime, grossR: record.raw.grossR, netR: record.raw.netR }));
  }
  return Object.freeze({ schemaVersion: M3_R7_AUDIT_SCHEMA_VERSION, execution: Object.freeze({ executionSourceSha: report.executionSourceSha, performanceLock: M3_R7_PERFORMANCE_LOCK, controlRuns: 1, candidateSettlementRuns: 0, selectionRuns: 1, privateApiAccessed: false, automaticTrading: false }), decisions: Object.freeze(decisions), outcomes: Object.freeze(outcomes) });
}

export function executeR7Authoritative(input: Readonly<{ cacheDirectory: string; executionSourceSha: string; acceptedServerTime?: number }>): Promise<R7ExecutionArtifacts> {
  return (async () => {
    validateR7Plan();
    if (input.executionSourceSha.length !== 40) throw new Error("R7 execution source SHA is required.");
    const prepared = await prepareR7Dataset(input);
    const context = createR7FeatureContext(prepared.data);
    let generated = 0;
    const controlRun = buildRound006ControlRecords(prepared.data, () => { generated += 1; });
    if (generated === 0) throw new Error("R7 CONTROL generated no signal-level performance results.");
    const controlRecords = controlRun.records.map((record) => withR7Identity(M3_R7_CONTROL_ID, record.raw, context));
    const classified = controlRecords.map((record) => Object.freeze({ record, classification: (() => { try { return classifyR7Opportunity(context, record.raw); } catch { return Object.freeze({ e1PullbackReclaim: false, e2BreakoutRetest: false, routerCell: "INVALID" }); } })() }));
    const e1Records = uniqueRecords(classified.filter((item) => item.classification.e1PullbackReclaim).map((item) => withR7Identity("R7-E1-PULLBACK-RECLAIM", item.record.raw, context)));
    const e2Records = uniqueRecords(classified.filter((item) => item.classification.e2BreakoutRetest).map((item) => withR7Identity("R7-E2-BREAKOUT-RETEST", item.record.raw, context)));
    const router = routerFilteredRecords(controlRecords, context);
    const modelBundle = buildModels(controlRecords, e1Records);
    const s1Records = filteredModelRecords("R7-S1-CALIBRATED-SCORE-V2", controlRecords, modelBundle.modelMap);
    const c1Records = filteredModelRecords("R7-C1-RECLAIM-CALIBRATED-SCORE-V2", e1Records, modelBundle.modelMap);
    const allRecords = Object.freeze([...controlRecords, ...e1Records, ...e2Records, ...router.records, ...s1Records, ...c1Records].sort(recordSort));
    const controlEvidence = evidenceFor(M3_R7_CONTROL_ID, controlRecords);
    const candidateEvidence = Object.freeze([
      evidenceFor("R7-R1-REGIME-EXPECTANCY-ROUTER", router.records),
      evidenceFor("R7-E1-PULLBACK-RECLAIM", e1Records),
      evidenceFor("R7-E2-BREAKOUT-RETEST", e2Records),
      evidenceFor("R7-S1-CALIBRATED-SCORE-V2", s1Records),
      evidenceFor("R7-C1-RECLAIM-CALIBRATED-SCORE-V2", c1Records),
    ]);
    const modelIntegrity = modelBundle.models.filter((model) => model.candidateId === "R7-S1-CALIBRATED-SCORE-V2").every((model) => model.status === "FIT") && modelBundle.models.filter((model) => model.candidateId === "R7-C1-RECLAIM-CALIBRATED-SCORE-V2").every((model) => model.status === "FIT");
    const gateEvaluations = Object.freeze(candidateEvidence.map((candidate) => evaluateR7CandidateGates(gateInput(candidate, controlEvidence, candidate.candidateId === "R7-S1-CALIBRATED-SCORE-V2" || candidate.candidateId === "R7-C1-RECLAIM-CALIBRATED-SCORE-V2", modelIntegrity))));
    const selectionCandidates: R7SelectionCandidate[] = candidateEvidence.map((candidate, index) => { const evaluation = gateEvaluations[index]!; return Object.freeze({ candidateId: candidate.candidateId as (typeof M3_R7_CANDIDATE_IDS)[number], eligible: evaluation.eligibility === "ELIGIBLE", improvedValidationFolds: Number(evaluation.gateResults.find((gate) => gate.gateId === "minimumImprovedValidationFolds")?.actualValue ?? 0), aggregateValidationExpectancyR: candidate.aggregateValidation.diagnostics.expectancyR ?? Number.NEGATIVE_INFINITY, complexityTuple: R7_COMPLEXITY_TUPLES[candidate.candidateId as (typeof M3_R7_CANDIDATE_IDS)[number]], aggregateValidationProfitFactor: candidate.aggregateValidation.diagnostics.profitFactor }); });
    const selection = selectR7Candidate(selectionCandidates);
    const report: R7PerformanceReport = deepFreeze({ schemaVersion: M3_R7_REPORT_SCHEMA_VERSION, researchRoundId: M3_R7_RESEARCH_ROUND_ID, executionSourceSha: input.executionSourceSha, selectionGateSha256: R7_SELECTION_GATE_SHA256, experimentPlanSha256: R7_PLAN_SHA256, strategyVersion: "baseline-001", backtestPolicyVersion: M3_R7_POLICY_VERSION, dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA", researchUniverse: M3_R7_RESEARCH_RANGE, researchBoundary: M3_R7_RESEARCH_END_ISO, studyServerTime: prepared.data.serverTime!, performanceLock: M3_R7_PERFORMANCE_LOCK, performanceLockTriggered: true, performanceExecutionCount: 1, performanceLifecycle: "PERFORMANCE_LOCKED", datasetFreeze: prepared.datasetFreeze, intrabarDependencyPlan: prepared.intrabarPlan, evidenceStatus: controlRun.report.status === "PASS" && controlEvidence.resultStatus !== "DATA_INCOMPLETE" ? "COMPLETE" : "INCOMPLETE", integrityErrors: Object.freeze(controlRun.report.status === "PASS" ? [] : [...controlRun.report.diagnostics]), control: controlEvidence, controlReport: Object.freeze({ status: controlRun.report.status, metrics: controlRun.report.metrics, metricsByPeriod: controlRun.report.metricsByPeriod, diagnostics: controlRun.report.diagnostics }), candidates: candidateEvidence, candidateRegistry: M3_R7_CANDIDATE_IDS, gateEvaluations, models: modelBundle.models, router: Object.freeze({ fixedCellCount: 48, eligibleCellsByFold: router.eligibleCellsByFold, validationUsesResearchEligibleCellsOnly: true }), selection: Object.freeze(selection), baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED", disclaimer: "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION." });
    const auditArtifact = buildAudit(allRecords, report);
    const selectionReport = Object.freeze({ schemaVersion: "m3-r7-round-007-selection-001", researchRoundId: M3_R7_RESEARCH_ROUND_ID, performanceExecutionSourceSha: input.executionSourceSha, selectionGateSha256: R7_SELECTION_GATE_SHA256, experimentPlanSha256: R7_PLAN_SHA256, performanceLock: M3_R7_PERFORMANCE_LOCK, evidenceStatus: report.evidenceStatus, integrityStatus: report.evidenceStatus === "COMPLETE" ? "COMPLETE" : "INCOMPLETE_EVIDENCE", integrityErrors: report.integrityErrors, candidates: report.gateEvaluations, eligibleCandidateIds: report.selection.eligibleCandidateIds, selectionAlgorithmApplied: report.selection.selectionAlgorithmApplied, selectedCandidateId: report.selection.selectedCandidateId, finalDecision: report.selection.finalDecision, baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" });
    return Object.freeze({ report, auditArtifact, summaryJson: stableStringify(report), auditJson: stableStringify(auditArtifact), resultsMarkdown: renderResults(report), selectionJson: stableStringify(selectionReport), selectionMarkdown: selectionMarkdown(report) });
  })();
}

export function validateR7AuthoritativeReport(report: R7PerformanceReport): void {
  if (report.researchRoundId !== M3_R7_RESEARCH_ROUND_ID || report.performanceExecutionCount !== 1 || report.performanceLockTriggered !== true || report.selection.selectedCandidateId !== null && !M3_R7_CANDIDATE_IDS.includes(report.selection.selectedCandidateId)) throw new Error("R7 report lifecycle or selection identity is invalid.");
  if (report.candidateRegistry.length !== 5 || report.integrityErrors.length > 0) throw new Error("R7 report integrity is incomplete.");
}

export function r7OutputPaths(root = process.cwd()): readonly string[] { return M3_R7_OUTPUT_PATHS.map((relative) => path.join(root, relative)); }
export function existingR7OutputArtifacts(root = process.cwd()): readonly string[] { return Object.freeze(r7OutputPaths(root).filter((filePath) => existsSync(filePath))); }
export function sha256R7Bytes(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
export { R7_PLAN, R7_MACHINE_RECORD, R7_HARD_GATE_IDENTITIES };
