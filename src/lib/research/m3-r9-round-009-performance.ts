import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BinanceHistoricalDataLoader } from "../historical-data/binance/loader.ts";
import { HistoricalDataError } from "../historical-data/errors.ts";
import { validateIntrabarSettlementWindow } from "../historical-data/validation.ts";
import type { HistoricalIntrabarSettlementWindow } from "../historical-data/types.ts";
import type { BinanceResponse } from "../market-data/binance/client.ts";
import type { BacktestData, BacktestReport, BacktestSignalResult } from "../backtest/types.ts";
import { BACKTEST_PERIOD_RANGES } from "../backtest/constants.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import { emptyBacktestSignalResult, settleBacktestSignal, snapshotFromCandidate } from "../backtest/settlement.ts";
import { getHeldCandlesFromIndex, buildHistoricalIndexes } from "../backtest/windows.ts";
import { appendRound006IntrabarWindows, buildRound006ControlRecords, buildRound006HistoricalLoadRanges, toBacktestData, validateRound006EvidenceIntegrity } from "./m3-r6-round-006-performance.ts";
import { Round006CachedBinanceClient } from "./m3-r6-round-006-data.ts";
import type { ResearchDiagnostics, ResearchRange, NormalizedResearchSignal } from "./types.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import type { ResearchFoldId } from "./constants.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R9_BASE_SOURCE_SHA,
  M3_R9_CANDIDATE_IDS,
  M3_R9_CONTROL_ID,
  M3_R9_PERFORMANCE_LOCK,
  M3_R9_RESEARCH_END_ISO,
  M3_R9_RESEARCH_RANGE,
  M3_R9_RESEARCH_ROUND_ID,
  M3_R9_POLICY_VERSION,
  R9_CANDIDATE_REGISTRY,
  R9_COMPLEXITY_TUPLES,
  R9_FROZEN_FOLD_IDS,
  R9_GOVERNANCE,
  R9_MODEL_CONTRACT,
  R9_SYMBOLS,
  type R9CandidateId,
} from "./m3-r9-round-009-protocol.ts";
import { buildR9FeatureVector, classifyR9Router, createR9FeatureContext, generateR9BaselineIntents, generateR9EventIntents, r9PeriodFor, type R9FeatureContext, type R9OpportunityIntent } from "./m3-r9-round-009-candidates.ts";
import { fitR9RidgeModel, predictR9RidgeModel, type R9FeatureVector, type R9RidgeModel } from "./m3-r9-round-009-model.ts";
import { buildR9IntrabarPlan, persistR9IntrabarPlan, r9DatasetIdentity, type R9IntrabarPlan } from "./m3-r9-round-009-intrabar-plan.ts";
import { R9_PLAN_SHA256, validateR9Plan } from "./m3-r9-round-009-plan.ts";
import { R9_SELECTION_GATE_SHA256, evaluateR9CandidateGates, selectR9Candidate, type R9CandidateGateEvaluation, type R9SelectionCandidate } from "./selection-gates-round-009.ts";
import { readR9SpecConformance } from "./m3-r9-round-009-conformance.ts";

export const M3_R9_REPORT_SCHEMA_VERSION = "m3-r9-round-009-report-001" as const;
export const M3_R9_AUDIT_SCHEMA_VERSION = "m3-r9-round-009-audit-001" as const;
export const M3_R9_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R9_ROUND_009_SUMMARY.json",
  "docs/evidence/M3_R9_ROUND_009_AUDIT.json",
  "docs/M3_R9_ROUND_009_RESULTS.md",
  "docs/evidence/M3_R9_ROUND_009_SELECTION.json",
  "docs/evidence/M3_R9_ROUND_009_SELECTION.md",
] as const);
export const M3_R9_ACCEPTED_R6_STUDY_SERVER_TIME = 1787801312279;

type R9RecordCandidateId = typeof M3_R9_CONTROL_ID | R9CandidateId | "R9-PRE-SCORE";

export type R9Record = Readonly<{
  candidateId: R9RecordCandidateId;
  stream: "BASELINE_FORMAL_STREAM" | "BASELINE_PRE_SCORE_ELIGIBLE_STREAM" | "NEW_ENTRY_EVENT_STREAM";
  raw: BacktestSignalResult;
  signal: NormalizedResearchSignal;
  feature?: R9FeatureVector;
  prediction?: number;
  routerCell?: string;
}>;

export type R9PreparedDataset = Readonly<{
  data: BacktestData;
  baselineIntents: readonly R9OpportunityIntent[];
  eventIntents: readonly R9OpportunityIntent[];
  allIntents: readonly R9OpportunityIntent[];
  intrabarPlan: R9IntrabarPlan;
  datasetFreeze: Readonly<{
    schemaVersion: "m3-r9-round-009-dataset-freeze-001";
    dataFreezeCompleted: true;
    datasetIdentitySha256: string;
    manifestIdentitySha256: string;
    manifestCount: number;
    intrabarRequirementCount: number;
    studyServerTime: number;
    source: "ACCEPTED_ROUND_006_CACHE_REUSED_AFTER_IDENTITY_VALIDATION";
  }>;
}>;

export type R9CandidateEvidence = Readonly<{
  candidateId: R9CandidateId | typeof M3_R9_CONTROL_ID;
  resultStatus: "COMPLETE" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED";
  fullSeenUniverse: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics; formalIdentitySha256: string; executedIdentitySha256: string }>;
  folds: readonly Readonly<{
    foldId: ResearchFoldId;
    research: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics }>;
    validation: Readonly<{ range: ResearchRange; diagnostics: ResearchDiagnostics }>;
  }>[];
  aggregateValidation: Readonly<{ segments: readonly ResearchRange[]; diagnostics: ResearchDiagnostics }>;
  formalSignals: number;
  executedTrades: number;
  maxDrawdownR: number | null;
}>;

export type R9ModelEvidence = Readonly<{
  foldId: ResearchFoldId;
  candidateId: "R9-S1-CALIBRATED-SCORE-V2" | "R9-C1-RECLAIM-CALIBRATED-SCORE-V2";
  sourceStream: "BASELINE_PRE_SCORE_ELIGIBLE_STREAM" | "NEW_ENTRY_EVENT_STREAM";
  status: "FIT" | "INSUFFICIENT_RESEARCH_EXAMPLES";
  trainingExamples: number;
  modelIdentitySha256: string | null;
  standardizationIdentitySha256: string | null;
  coefficients: Readonly<Record<string, number>>;
  predictionDistribution: Readonly<{ count: number; min: number | null; max: number | null; average: number | null }>;
}>;

export type R9PerformanceReport = Readonly<{
  schemaVersion: typeof M3_R9_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R9_RESEARCH_ROUND_ID;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: typeof M3_R9_POLICY_VERSION;
  dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA";
  researchUniverse: typeof M3_R9_RESEARCH_RANGE;
  researchBoundary: typeof M3_R9_RESEARCH_END_ISO;
  studyServerTime: number;
  performanceLock: typeof M3_R9_PERFORMANCE_LOCK;
  performanceLockTriggered: true;
  performanceExecutionCount: 1;
  performanceLifecycle: "PERFORMANCE_LOCKED";
  datasetFreeze: R9PreparedDataset["datasetFreeze"];
  intrabarDependencyPlan: R9IntrabarPlan;
  evidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityErrors: readonly string[];
  control: R9CandidateEvidence;
  controlReport: Readonly<{ status: BacktestReport["status"]; metrics: BacktestReport["metrics"]; metricsByPeriod: BacktestReport["metricsByPeriod"]; diagnostics: readonly string[] }>;
  candidates: readonly R9CandidateEvidence[];
  candidateRegistry: typeof M3_R9_CANDIDATE_IDS;
  gateEvaluations: readonly R9CandidateGateEvaluation[];
  models: readonly R9ModelEvidence[];
  modelIntegrity: Readonly<{ s1: boolean; c1: boolean }>;
  router: Readonly<{ fixedCellCount: 48; eligibleCellsByFold: Readonly<Record<string, readonly string[]>>; validationUsesResearchEligibleCellsOnly: true }>;
  streamCounts: Readonly<Record<string, number>>;
  selection: Readonly<{ selectionAlgorithmApplied: boolean; eligibleCandidateIds: readonly R9CandidateId[]; selectedCandidateId: R9CandidateId | null; finalDecision: string }>;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  disclaimer: "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.";
}>;

export type R9AuditArtifact = Readonly<{
  schemaVersion: typeof M3_R9_AUDIT_SCHEMA_VERSION;
  execution: Readonly<{ executionSourceSha: string; performanceLock: typeof M3_R9_PERFORMANCE_LOCK; controlRuns: 1; candidateSettlementRuns: number; selectionRuns: 1; privateApiAccessed: false; automaticTrading: false }>;
  decisions: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  outcomes: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}>;

export type R9ExecutionArtifacts = Readonly<{
  report: R9PerformanceReport;
  auditArtifact: R9AuditArtifact;
  summaryJson: string;
  auditJson: string;
  resultsMarkdown: string;
  selectionJson: string;
  selectionMarkdown: string;
}>;

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function symbolOrder(symbol: string): number {
  return R9_SYMBOLS.indexOf(symbol as (typeof R9_SYMBOLS)[number]);
}

function directionOrder(direction: "LONG" | "SHORT"): number {
  return direction === "LONG" ? 0 : 1;
}

function recordKey(record: Pick<R9Record, "candidateId" | "raw">): string {
  return `${record.candidateId}|${record.raw.snapshot.symbol}|${record.raw.snapshot.direction}|${record.raw.snapshot.signalTime}`;
}

function recordSort(left: R9Record, right: R9Record): number {
  return left.raw.snapshot.signalTime - right.raw.snapshot.signalTime
    || symbolOrder(left.raw.snapshot.symbol) - symbolOrder(right.raw.snapshot.symbol)
    || directionOrder(left.raw.snapshot.direction) - directionOrder(right.raw.snapshot.direction)
    || left.candidateId.localeCompare(right.candidateId);
}

function uniqueRecords(records: readonly R9Record[]): readonly R9Record[] {
  const seen = new Set<string>();
  return Object.freeze(records.filter((record) => {
    const key = recordKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort(recordSort));
}

function acceptedServerTimeResponse(serverTime: number): BinanceResponse<{ serverTime: number }> {
  return Object.freeze({
    data: Object.freeze({ serverTime }),
    diagnostics: Object.freeze({ endpoint: "/fapi/v1/time", operationStartedAt: 0, attemptStartedAt: 0, attemptCompletedAt: 0, roundTripMs: 0, attempts: 1 }),
  });
}

class R9CacheClient extends Round006CachedBinanceClient {
  private readonly acceptedServerTime: number;

  constructor(cacheDirectory: string, acceptedServerTime: number) {
    super({ cacheDirectory });
    this.acceptedServerTime = acceptedServerTime;
  }

  override async getServerTime(): Promise<BinanceResponse<{ serverTime: number }>> {
    return acceptedServerTimeResponse(this.acceptedServerTime);
  }
}

function freezeValidationMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function manifestIdentity(manifest: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const copy = { ...manifest };
  delete copy.retrievedAt;
  return copy;
}

function windowIdentity(window: HistoricalIntrabarSettlementWindow): string {
  return `${window.symbol}|${window.exitCandleOpenTime}|${window.exitCandleOpenTime + INTERVAL_MS["1h"] - 1}|${window.settlementOnly}`;
}

function freezeR9Dataset(input: Readonly<{ data: BacktestData; plan: R9IntrabarPlan; windows: readonly HistoricalIntrabarSettlementWindow[]; executionSourceSha: string }>): void {
  const errors: string[] = [];
  if (input.data.intrabarSettlementDeclarationHash !== input.plan.declarationHash) errors.push("INTRABAR_DECLARATION_HASH_NOT_ATTACHED_BEFORE_FREEZE");
  const expected = new Set(input.plan.requirements.map((requirement) => `${requirement.symbol}|${requirement.exitCandleOpenTime}|${requirement.exitCandleCloseTime}|${requirement.settlementOnly}`));
  const seen = new Set<string>();
  for (const window of input.windows) {
    const identity = windowIdentity(window);
    if (seen.has(identity)) errors.push(`DUPLICATE_INTRABAR_WINDOW:${identity}`);
    seen.add(identity);
    if (!expected.has(identity)) errors.push(`UNDECLARED_INTRABAR_WINDOW:${identity}`);
  }
  for (const requirement of input.plan.requirements) {
    const identity = `${requirement.symbol}|${requirement.exitCandleOpenTime}|${requirement.exitCandleCloseTime}|${requirement.settlementOnly}`;
    if (!seen.has(identity)) errors.push(`MISSING_INTRABAR_WINDOW:${identity}`);
    const window = input.windows.find((value) => windowIdentity(value) === identity);
    if (!window) continue;
    try {
      validateIntrabarSettlementWindow(window.candles, {
        symbol: requirement.symbol,
        exitCandleOpenTime: requirement.exitCandleOpenTime,
        exitCandleCloseTime: requirement.exitCandleCloseTime,
        serverTime: input.data.serverTime!,
      });
    } catch (error) {
      errors.push(`INVALID_INTRABAR_WINDOW:${identity}:${freezeValidationMessage(error)}`);
    }
  }
  const integrity = validateRound006EvidenceIntegrity({ data: input.data, records: [], executionSourceSha: input.executionSourceSha });
  errors.push(...integrity.errors);
  if (errors.length > 0) {
    throw new HistoricalDataError({ code: "DATA_INCOMPLETE", message: `Round-009 dataset freeze failed: ${[...new Set(errors)].join("; ")}`, diagnostics: { errorCount: new Set(errors).size } });
  }
}

export async function prepareR9Dataset(input: Readonly<{ cacheDirectory: string; acceptedServerTime?: number; executionSourceSha: string }>): Promise<R9PreparedDataset> {
  const studyServerTime = input.acceptedServerTime ?? M3_R9_ACCEPTED_R6_STUDY_SERVER_TIME;
  const client = new R9CacheClient(input.cacheDirectory, studyServerTime);
  const loader = new BinanceHistoricalDataLoader({ client });
  const study = await loader.loadStudyData({ ...buildRound006HistoricalLoadRanges(), policy: M3_R9_POLICY_VERSION });
  const coarseData = toBacktestData(study);
  const context = createR9FeatureContext(coarseData);
  const baselineIntents = Object.freeze(generateR9BaselineIntents(coarseData));
  const eventIntents = Object.freeze(generateR9EventIntents(coarseData, context));
  const allIntents = Object.freeze([...baselineIntents, ...eventIntents]);
  const intrabarPlan = buildR9IntrabarPlan({ data: coarseData, intents: allIntents, sourceSha: input.executionSourceSha });
  persistR9IntrabarPlan(intrabarPlan, path.join(input.cacheDirectory, "round-009-intrabar-plan.json"));
  const windows = await loader.loadIntrabarSettlementWindows(intrabarPlan.requirements, study.serverTime);
  const appended = appendRound006IntrabarWindows(coarseData, windows, intrabarPlan.requirements);
  const data: BacktestData = Object.freeze({ ...appended, intrabarSettlementDeclarationHash: intrabarPlan.declarationHash });
  freezeR9Dataset({ data, plan: intrabarPlan, windows, executionSourceSha: input.executionSourceSha });
  const canonicalManifests = data.manifests.map((manifest) => manifestIdentity(manifest as unknown as Readonly<Record<string, unknown>>)).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  const manifestIdentitySha256 = sha256(canonicalManifests);
  const datasetIdentitySha256 = r9DatasetIdentity({ data, plan: intrabarPlan, studyServerTime: study.serverTime });
  return Object.freeze({
    data,
    baselineIntents,
    eventIntents,
    allIntents,
    intrabarPlan,
    datasetFreeze: Object.freeze({
      schemaVersion: "m3-r9-round-009-dataset-freeze-001",
      dataFreezeCompleted: true,
      datasetIdentitySha256,
      manifestIdentitySha256,
      manifestCount: data.manifests.length,
      intrabarRequirementCount: intrabarPlan.requirements.length,
      studyServerTime: study.serverTime,
      source: "ACCEPTED_ROUND_006_CACHE_REUSED_AFTER_IDENTITY_VALIDATION",
    }),
  });
}

function withR9Identity(candidateId: R9RecordCandidateId, stream: R9Record["stream"], result: BacktestSignalResult, context?: R9FeatureContext): R9Record {
  const variantId = candidateId === M3_R9_CONTROL_ID || candidateId === "R9-PRE-SCORE"
    ? candidateId
    : R9_CANDIDATE_REGISTRY.find((item) => item.candidateId === candidateId)?.variantId;
  const signal: NormalizedResearchSignal = deepFreeze({
    ...adaptBacktestSignalResult(result),
    researchRoundId: M3_R9_RESEARCH_ROUND_ID,
    experimentId: candidateId,
    variantId,
  });
  const feature = context ? (() => {
    try {
      return buildR9FeatureVector(context, result);
    } catch {
      return undefined;
    }
  })() : undefined;
  return Object.freeze({ candidateId, stream, raw: result, signal, ...(feature ? { feature } : {}) });
}

function settleIntent(data: BacktestData, indexes: ReturnType<typeof buildHistoricalIndexes>, intent: R9OpportunityIntent): BacktestSignalResult {
  const snapshot = snapshotFromCandidate(intent.candidate, intent.decisionTime, M3_R9_POLICY_VERSION);
  const dataset = indexes.bySymbol[intent.symbol];
  if (!dataset) return emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", `Missing dataset for ${intent.symbol}.`);
  try {
    const period = r9PeriodFor(intent.decisionTime);
    const heldCandles = getHeldCandlesFromIndex(dataset.candles1h, intent.decisionTime);
    return settleBacktestSignal({
      snapshot,
      signalCandle: intent.signalCandle,
      heldCandles,
      funding: data.funding[intent.symbol] ?? [],
      markPriceCandles: data.markPrice?.[intent.symbol],
      markPriceSegments: data.markPriceSegments?.[intent.symbol],
      intrabarSettlementWindows: data.intrabarSettlementWindows,
      serverTime: data.serverTime,
      policy: M3_R9_POLICY_VERSION,
      period,
      periodEndTime: BACKTEST_PERIOD_RANGES[period].endTime,
    });
  } catch (error) {
    return emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE", freezeValidationMessage(error));
  }
}

function settleIntents(data: BacktestData, indexes: ReturnType<typeof buildHistoricalIndexes>, intents: readonly R9OpportunityIntent[], context: R9FeatureContext): readonly R9Record[] {
  return uniqueRecords(intents.map((intent) => withR9Identity(intent.candidateId, intent.stream, settleIntent(data, indexes, intent), context)));
}

function recordsForRole(records: readonly R9Record[], foldId: ResearchFoldId, role: "RESEARCH" | "VALIDATION"): readonly R9Record[] {
  const range = getResearchFoldRoleRange(foldId, role);
  return Object.freeze(records.filter((record) => record.raw.snapshot.signalTime >= range.startTime && record.raw.snapshot.signalTime <= range.endTime));
}

function maxDrawdown(records: readonly R9Record[]): number | null {
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

function evidenceFor(candidateId: R9CandidateEvidence["candidateId"], rawRecords: readonly R9Record[]): R9CandidateEvidence {
  const records = uniqueRecords(rawRecords.filter((record) => record.candidateId === candidateId));
  const signals = records.map((record) => record.signal);
  const identity = signals.map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`);
  const executedIdentity = signals.filter((signal) => signal.status === "EXECUTED").map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`);
  const folds = R9_FROZEN_FOLD_IDS.map((foldId) => {
    const researchRange = getResearchFoldRoleRange(foldId, "RESEARCH");
    const validationRange = getResearchFoldRoleRange(foldId, "VALIDATION");
    const research = signals.filter((signal) => signal.signalTime >= researchRange.startTime && signal.signalTime <= researchRange.endTime);
    const validation = signals.filter((signal) => signal.signalTime >= validationRange.startTime && signal.signalTime <= validationRange.endTime);
    return Object.freeze({
      foldId,
      research: Object.freeze({ range: researchRange, diagnostics: calculateResearchDiagnostics({ records: research, range: researchRange }) }),
      validation: Object.freeze({ range: validationRange, diagnostics: calculateResearchDiagnostics({ records: validation, range: validationRange }) }),
    });
  });
  const segments = folds.map((fold) => fold.validation.range);
  const aggregateSignals = signals.filter((signal) => segments.some((range) => signal.signalTime >= range.startTime && signal.signalTime <= range.endTime));
  const aggregateRange = Object.freeze({ startTime: segments[0]!.startTime, endTime: segments.at(-1)!.endTime });
  const resultStatus = signals.some((signal) => signal.status === "DATA_INCOMPLETE" || signal.status === "SETTLEMENT_AMBIGUOUS")
    ? "DATA_INCOMPLETE"
    : signals.some((signal) => signal.status === "PERIOD_END_CENSORED") ? "PERIOD_END_CENSORED" : "COMPLETE";
  return Object.freeze({
    candidateId,
    resultStatus,
    fullSeenUniverse: Object.freeze({ range: M3_R9_RESEARCH_RANGE, diagnostics: calculateResearchDiagnostics({ records: signals, range: M3_R9_RESEARCH_RANGE }), formalIdentitySha256: sha256(identity), executedIdentitySha256: sha256(executedIdentity) }),
    folds: Object.freeze(folds),
    aggregateValidation: Object.freeze({ segments: Object.freeze(segments), diagnostics: calculateResearchDiagnostics({ records: aggregateSignals, range: aggregateRange }) }),
    formalSignals: aggregateSignals.length,
    executedTrades: aggregateSignals.filter((signal) => signal.status === "EXECUTED").length,
    maxDrawdownR: maxDrawdown(records),
  });
}

function modelExamples(records: readonly R9Record[]): readonly { features: R9FeatureVector; netR: number }[] {
  return records.filter((record): record is R9Record & { feature: R9FeatureVector } => record.feature !== undefined && record.raw.status === "EXECUTED" && record.raw.netR !== null && Number.isFinite(record.raw.netR)).map((record) => ({ features: record.feature, netR: record.raw.netR! }));
}

function calibration(model: R9RidgeModel | null, records: readonly R9Record[]): Readonly<{ predictionDistribution: R9ModelEvidence["predictionDistribution"] }> {
  if (!model) return Object.freeze({ predictionDistribution: Object.freeze({ count: 0, min: null, max: null, average: null }) });
  const values = records.filter((record): record is R9Record & { feature: R9FeatureVector } => record.feature !== undefined).map((record) => predictR9RidgeModel(model, record.feature));
  return Object.freeze({ predictionDistribution: Object.freeze({ count: values.length, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null }) });
}

function buildModels(preScoreRecords: readonly R9Record[], e1Records: readonly R9Record[]): Readonly<{ models: readonly R9ModelEvidence[]; modelMap: Readonly<Record<string, R9RidgeModel | null>>; integrity: Readonly<{ s1: boolean; c1: boolean }> }> {
  const models: R9ModelEvidence[] = [];
  const modelMap: Record<string, R9RidgeModel | null> = {};
  for (const candidateId of ["R9-S1-CALIBRATED-SCORE-V2", "R9-C1-RECLAIM-CALIBRATED-SCORE-V2"] as const) {
    const source = candidateId === "R9-S1-CALIBRATED-SCORE-V2" ? preScoreRecords : e1Records;
    const sourceStream = candidateId === "R9-S1-CALIBRATED-SCORE-V2" ? "BASELINE_PRE_SCORE_ELIGIBLE_STREAM" : "NEW_ENTRY_EVENT_STREAM";
    for (const foldId of R9_FROZEN_FOLD_IDS) {
      const examples = modelExamples(recordsForRole(source, foldId, "RESEARCH"));
      let model: R9RidgeModel | null = null;
      try {
        model = fitR9RidgeModel(examples);
      } catch {
        model = null;
      }
      modelMap[`${candidateId}|${foldId}`] = model;
      models.push(Object.freeze({ foldId, candidateId, sourceStream, status: model ? "FIT" : "INSUFFICIENT_RESEARCH_EXAMPLES", trainingExamples: examples.length, modelIdentitySha256: model?.modelIdentitySha256 ?? null, standardizationIdentitySha256: model?.standardization.identitySha256 ?? null, coefficients: Object.freeze(model?.coefficients ?? {}), ...calibration(model, recordsForRole(source, foldId, "RESEARCH")) }));
    }
  }
  return Object.freeze({ models: Object.freeze(models), modelMap: Object.freeze(modelMap), integrity: Object.freeze({ s1: models.filter((model) => model.candidateId === "R9-S1-CALIBRATED-SCORE-V2").every((model) => model.status === "FIT"), c1: models.filter((model) => model.candidateId === "R9-C1-RECLAIM-CALIBRATED-SCORE-V2").every((model) => model.status === "FIT") }) });
}

function filteredModelRecords(candidateId: "R9-S1-CALIBRATED-SCORE-V2" | "R9-C1-RECLAIM-CALIBRATED-SCORE-V2", source: readonly R9Record[], modelMap: Readonly<Record<string, R9RidgeModel | null>>, context: R9FeatureContext): readonly R9Record[] {
  const accepted: R9Record[] = [];
  for (const foldId of R9_FROZEN_FOLD_IDS) {
    const model = modelMap[`${candidateId}|${foldId}`];
    if (!model) continue;
    for (const record of recordsForRole(source, foldId, "VALIDATION")) {
      if (!record.feature) continue;
      const prediction = predictR9RidgeModel(model, record.feature);
      if (prediction >= R9_MODEL_CONTRACT.minimumPredictedNetR) accepted.push(Object.freeze({ ...withR9Identity(candidateId, candidateId === "R9-S1-CALIBRATED-SCORE-V2" ? "BASELINE_PRE_SCORE_ELIGIBLE_STREAM" : "NEW_ENTRY_EVENT_STREAM", record.raw, context), prediction }));
    }
  }
  return uniqueRecords(accepted);
}

function routerFilteredRecords(controlRecords: readonly R9Record[], context: R9FeatureContext): Readonly<{ records: readonly R9Record[]; eligibleCellsByFold: Readonly<Record<string, readonly string[]>> }> {
  const eligibleCellsByFold: Record<string, readonly string[]> = {};
  const accepted: R9Record[] = [];
  for (const foldId of R9_FROZEN_FOLD_IDS) {
    const research = recordsForRole(controlRecords, foldId, "RESEARCH");
    const byCell = new Map<string, R9Record[]>();
    for (const record of research) {
      const cell = (() => { try { return classifyR9Router(context, record.raw).routerCell; } catch { return "INVALID"; } })();
      const list = byCell.get(cell) ?? [];
      list.push(record);
      byCell.set(cell, list);
    }
    const cells = [...byCell.entries()].filter(([, records]) => {
      const executed = records.filter((record) => record.raw.status === "EXECUTED" && record.raw.netR !== null);
      const expectancy = executed.length ? executed.reduce((sum, record) => sum + record.raw.netR!, 0) / executed.length : null;
      return executed.length >= 100 && expectancy !== null && expectancy >= 0.05;
    }).map(([cell]) => cell).sort();
    eligibleCellsByFold[foldId] = Object.freeze(cells);
    for (const record of recordsForRole(controlRecords, foldId, "VALIDATION")) {
      const cell = (() => { try { return classifyR9Router(context, record.raw).routerCell; } catch { return "INVALID"; } })();
      if (cells.includes(cell)) accepted.push(Object.freeze({ ...record, candidateId: "R9-R1-REGIME-EXPECTANCY-ROUTER", stream: "BASELINE_FORMAL_STREAM", routerCell: cell }));
    }
  }
  return Object.freeze({ records: uniqueRecords(accepted), eligibleCellsByFold: Object.freeze(eligibleCellsByFold) });
}

function gateInput(candidate: R9CandidateEvidence, control: R9CandidateEvidence, modelRequired: boolean, modelIntegrity: boolean): Parameters<typeof evaluateR9CandidateGates>[0] {
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
  const positiveNetValidationFolds = candidate.folds.filter((fold) => fold.validation.diagnostics.expectancyR !== null && fold.validation.diagnostics.expectancyR > 0).length;
  return {
    candidateId: candidate.candidateId as R9CandidateId,
    resultStatus: candidate.resultStatus,
    aggregateImprovement,
    improvedValidationFolds,
    catastrophicFolds,
    positiveNetValidationFolds,
    netExpectancyR: candidateDiagnostics.expectancyR,
    profitFactor: candidateDiagnostics.profitFactor,
    profitFactorStatus: candidateDiagnostics.profitFactorStatus,
    topSymbolShareOfPositiveNetR: candidateDiagnostics.topSymbolShareOfPositiveNetR,
    largestSingleTradeShareOfPositiveNetR: candidateDiagnostics.largestSingleTradeShareOfPositiveNetR,
    feeBurdenRatio: candidateDiagnostics.feeBurdenRatio,
    formalSignals: candidateDiagnostics.formalSignals,
    minimumFoldExecutedTrades: Math.min(...candidate.folds.map((fold) => fold.validation.diagnostics.executedTrades)),
    modelRequired,
    modelIntegrity,
  };
}

function selectionMarkdown(report: R9PerformanceReport): string {
  const lines = ["# M3-R9 Round-009 Selection", "", `- researchRoundId: ${report.researchRoundId}`, `- executionSourceSha: ${report.executionSourceSha}`, `- selectionGateSha256: ${report.selectionGateSha256}`, `- experimentPlanSha256: ${report.experimentPlanSha256}`, `- finalDecision: ${report.selection.finalDecision}`, `- eligibleCandidateIds: ${report.selection.eligibleCandidateIds.join(", ") || "none"}`, `- selectedCandidateId: ${report.selection.selectedCandidateId ?? "null"}`, "", "| candidate | eligibility | passed | applicable | failed |", "| --- | --- | ---: | ---: | --- |"];
  for (const evaluation of report.gateEvaluations) lines.push(`| ${evaluation.candidateId} | ${evaluation.eligibility} | ${evaluation.passedApplicableGateCount} | ${evaluation.applicableGateCount} | ${evaluation.failedGateIds.join(", ") || "none"} |`);
  lines.push("", "Selection is mechanical and eligibility-first. No eligible candidate leaves baseline-002 NOT_FROZEN.", "", "baseline-002: NOT_FROZEN", "M3-J: BLOCKED", "M4: NOT_STARTED", "");
  return lines.join("\n");
}

function renderResults(report: R9PerformanceReport): string {
  const metric = (value: number | null): string => value === null ? "null" : String(value);
  const lines = ["# M3-R9 Round-009 Spec-Conformance Replay", "", `- researchRoundId: ${report.researchRoundId}`, `- executionSourceSha: ${report.executionSourceSha}`, `- selectionGateSha256: ${report.selectionGateSha256}`, `- experimentPlanSha256: ${report.experimentPlanSha256}`, `- dataClassification: ${report.dataClassification}`, `- researchBoundary: ${report.researchBoundary}`, `- studyServerTime: ${report.studyServerTime}`, `- performanceLock: ${report.performanceLock}`, `- performanceExecutionCount: ${report.performanceExecutionCount}`, `- evidenceStatus: ${report.evidenceStatus}`, `- integrityErrors: ${report.integrityErrors.join(", ") || "none"}`, "", "## Control and candidate aggregate validation", "", "| candidate | status | formal | executed | net R | expectancy R | PF |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |"];
  for (const candidate of [report.control, ...report.candidates]) {
    const diagnostics = candidate.aggregateValidation.diagnostics;
    lines.push(`| ${candidate.candidateId} | ${candidate.resultStatus} | ${diagnostics.formalSignals} | ${diagnostics.executedTrades} | ${metric(diagnostics.netR)} | ${metric(diagnostics.expectancyR)} | ${metric(diagnostics.profitFactor)} |`);
  }
  lines.push("", "## Frozen validation folds", "", "| candidate | fold | research formal/executed | validation formal/executed | validation expectancy R | validation PF |", "| --- | --- | ---: | ---: | ---: | ---: |");
  for (const candidate of [report.control, ...report.candidates]) for (const fold of candidate.folds) lines.push(`| ${candidate.candidateId} | ${fold.foldId} | ${fold.research.diagnostics.formalSignals}/${fold.research.diagnostics.executedTrades} | ${fold.validation.diagnostics.formalSignals}/${fold.validation.diagnostics.executedTrades} | ${metric(fold.validation.diagnostics.expectancyR)} | ${metric(fold.validation.diagnostics.profitFactor)} |`);
  lines.push("", "## Frozen streams", "", ...Object.entries(report.streamCounts).map(([stream, count]) => `- ${stream}: ${count}`), "", `- Fixed ridge lambda: ${R9_MODEL_CONTRACT.lambda}; features: ${R9_MODEL_CONTRACT.featureNames.length}; model integrity S1=${report.modelIntegrity.s1}, C1=${report.modelIntegrity.c1}.`, "- E1/E2/C1 use candidate-local settlement; R1 uses the baseline formal stream.", "- Intrabar dependencies were declared before dataset freeze; post-lock market fetch is disabled.", "", "## Boundaries", "", "- Public Binance historical data only; no private API and no automatic trading.", "- Closed decision-time candles only; validation never fits, tunes, or changes a model.", "- baseline-002: NOT_FROZEN", "- M3-J: BLOCKED", "- M4: NOT_STARTED", "");
  return lines.join("\n");
}

function buildAudit(records: readonly R9Record[], report: R9PerformanceReport, candidateSettlementRuns: number): R9AuditArtifact {
  const decisions: Record<string, Readonly<Record<string, unknown>>[]> = {};
  const outcomes: Record<string, Readonly<Record<string, unknown>>[]> = {};
  for (const record of records) {
    const item = Object.freeze({ symbol: record.raw.snapshot.symbol, direction: record.raw.snapshot.direction, signalTime: record.raw.snapshot.signalTime, stream: record.stream, status: record.raw.status, routerCell: record.routerCell ?? null, prediction: record.prediction ?? null });
    (decisions[record.candidateId] ??= []).push(item);
    if (record.raw.status === "EXECUTED") (outcomes[record.candidateId] ??= []).push(Object.freeze({ symbol: record.raw.snapshot.symbol, direction: record.raw.snapshot.direction, signalTime: record.raw.snapshot.signalTime, entryTime: record.raw.entryTime, exitTime: record.raw.exitTime, grossR: record.raw.grossR, netR: record.raw.netR }));
  }
  return Object.freeze({ schemaVersion: M3_R9_AUDIT_SCHEMA_VERSION, execution: Object.freeze({ executionSourceSha: report.executionSourceSha, performanceLock: M3_R9_PERFORMANCE_LOCK, controlRuns: 1, candidateSettlementRuns, selectionRuns: 1, privateApiAccessed: false, automaticTrading: false }), decisions: Object.freeze(decisions), outcomes: Object.freeze(outcomes) });
}

export function executeR9Authoritative(input: Readonly<{ cacheDirectory: string; executionSourceSha: string; acceptedServerTime?: number }>): Promise<R9ExecutionArtifacts> {
  return (async () => {
    readR9SpecConformance();
    validateR9Plan();
    if (!/^[0-9a-f]{40}$/u.test(input.executionSourceSha)) throw new Error("R9 execution source SHA is required.");
    const prepared = await prepareR9Dataset(input);
    const context = createR9FeatureContext(prepared.data);
    const indexes = buildHistoricalIndexes(prepared.data.datasets);
    let generated = 0;
    const controlRun = buildRound006ControlRecords(prepared.data, () => { generated += 1; });
    if (generated === 0) throw new Error("R9 CONTROL generated no signal-level performance results.");
    const controlRecords = uniqueRecords(controlRun.records.map((record) => withR9Identity(M3_R9_CONTROL_ID, "BASELINE_FORMAL_STREAM", record.raw, context)));
    const preScoreIntents = prepared.baselineIntents.filter((intent) => intent.candidateId === "R9-PRE-SCORE");
    const preScoreRecords = settleIntents(prepared.data, indexes, preScoreIntents, context);
    const e1Records = settleIntents(prepared.data, indexes, prepared.eventIntents.filter((intent) => intent.candidateId === "R9-E1-PULLBACK-RECLAIM"), context);
    const e2Records = settleIntents(prepared.data, indexes, prepared.eventIntents.filter((intent) => intent.candidateId === "R9-E2-BREAKOUT-RETEST"), context);
    const router = routerFilteredRecords(controlRecords, context);
    const modelBundle = buildModels(preScoreRecords, e1Records);
    const s1Records = filteredModelRecords("R9-S1-CALIBRATED-SCORE-V2", preScoreRecords, modelBundle.modelMap, context);
    const c1Records = filteredModelRecords("R9-C1-RECLAIM-CALIBRATED-SCORE-V2", e1Records, modelBundle.modelMap, context);
    const allRecords = Object.freeze([...controlRecords, ...preScoreRecords, ...e1Records, ...e2Records, ...router.records, ...s1Records, ...c1Records].sort(recordSort));
    const controlEvidence = evidenceFor(M3_R9_CONTROL_ID, controlRecords);
    const candidateEvidence = Object.freeze([
      evidenceFor("R9-R1-REGIME-EXPECTANCY-ROUTER", router.records),
      evidenceFor("R9-E1-PULLBACK-RECLAIM", e1Records),
      evidenceFor("R9-E2-BREAKOUT-RETEST", e2Records),
      evidenceFor("R9-S1-CALIBRATED-SCORE-V2", s1Records),
      evidenceFor("R9-C1-RECLAIM-CALIBRATED-SCORE-V2", c1Records),
    ]);
    const candidateModelRequired = new Set<R9CandidateId>(["R9-S1-CALIBRATED-SCORE-V2", "R9-C1-RECLAIM-CALIBRATED-SCORE-V2"]);
    const gateEvaluations = Object.freeze(candidateEvidence.map((candidate) => evaluateR9CandidateGates(gateInput(candidate, controlEvidence, candidateModelRequired.has(candidate.candidateId as R9CandidateId), candidate.candidateId === "R9-S1-CALIBRATED-SCORE-V2" ? modelBundle.integrity.s1 : candidate.candidateId === "R9-C1-RECLAIM-CALIBRATED-SCORE-V2" ? modelBundle.integrity.c1 : true))));
    const selectionCandidates: R9SelectionCandidate[] = candidateEvidence.map((candidate, index) => {
      const evaluation = gateEvaluations[index]!;
      return Object.freeze({ candidateId: candidate.candidateId as R9CandidateId, eligible: evaluation.eligibility === "ELIGIBLE", improvedValidationFolds: Number(evaluation.gateResults.find((gate) => gate.gateId === "minimumImprovedValidationFolds")?.actualValue ?? 0), aggregateValidationExpectancyR: candidate.aggregateValidation.diagnostics.expectancyR ?? Number.NEGATIVE_INFINITY, complexityTuple: R9_COMPLEXITY_TUPLES[candidate.candidateId as R9CandidateId], aggregateValidationProfitFactor: candidate.aggregateValidation.diagnostics.profitFactor });
    });
    const selection = selectR9Candidate(selectionCandidates);
    const integrityErrors = controlRun.report.status === "PASS" && ![controlEvidence, ...candidateEvidence].some((candidate) => candidate.resultStatus === "DATA_INCOMPLETE") ? [] : [...controlRun.report.diagnostics, ...[controlEvidence, ...candidateEvidence].filter((candidate) => candidate.resultStatus === "DATA_INCOMPLETE").map((candidate) => `${candidate.candidateId}:DATA_INCOMPLETE`)];
    const report: R9PerformanceReport = deepFreeze({
      schemaVersion: M3_R9_REPORT_SCHEMA_VERSION,
      researchRoundId: M3_R9_RESEARCH_ROUND_ID,
      executionSourceSha: input.executionSourceSha,
      selectionGateSha256: R9_SELECTION_GATE_SHA256,
      experimentPlanSha256: R9_PLAN_SHA256,
      strategyVersion: "baseline-001",
      backtestPolicyVersion: M3_R9_POLICY_VERSION,
      dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
      researchUniverse: M3_R9_RESEARCH_RANGE,
      researchBoundary: M3_R9_RESEARCH_END_ISO,
      studyServerTime: prepared.data.serverTime!,
      performanceLock: M3_R9_PERFORMANCE_LOCK,
      performanceLockTriggered: true,
      performanceExecutionCount: 1,
      performanceLifecycle: "PERFORMANCE_LOCKED",
      datasetFreeze: prepared.datasetFreeze,
      intrabarDependencyPlan: prepared.intrabarPlan,
      evidenceStatus: integrityErrors.length === 0 ? "COMPLETE" : "INCOMPLETE",
      integrityErrors: Object.freeze(integrityErrors),
      control: controlEvidence,
      controlReport: Object.freeze({ status: controlRun.report.status, metrics: controlRun.report.metrics, metricsByPeriod: controlRun.report.metricsByPeriod, diagnostics: controlRun.report.diagnostics }),
      candidates: candidateEvidence,
      candidateRegistry: M3_R9_CANDIDATE_IDS,
      gateEvaluations,
      models: modelBundle.models,
      modelIntegrity: modelBundle.integrity,
      router: Object.freeze({ fixedCellCount: 48, eligibleCellsByFold: router.eligibleCellsByFold, validationUsesResearchEligibleCellsOnly: true }),
      streamCounts: Object.freeze({ BASELINE_FORMAL_STREAM: controlRecords.length, BASELINE_PRE_SCORE_ELIGIBLE_STREAM: preScoreRecords.length, NEW_ENTRY_EVENT_STREAM: e1Records.length + e2Records.length }),
      selection: Object.freeze(selection),
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      disclaimer: "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.",
    });
    const auditArtifact = buildAudit(allRecords, report, preScoreRecords.length + e1Records.length + e2Records.length);
    const selectionReport = Object.freeze({ schemaVersion: "m3-r9-round-009-selection-001", researchRoundId: M3_R9_RESEARCH_ROUND_ID, performanceExecutionSourceSha: input.executionSourceSha, selectionGateSha256: R9_SELECTION_GATE_SHA256, experimentPlanSha256: R9_PLAN_SHA256, performanceLock: M3_R9_PERFORMANCE_LOCK, evidenceStatus: report.evidenceStatus, integrityStatus: report.evidenceStatus === "COMPLETE" ? "COMPLETE" : "INCOMPLETE_EVIDENCE", integrityErrors: report.integrityErrors, candidates: report.gateEvaluations, eligibleCandidateIds: report.selection.eligibleCandidateIds, selectionAlgorithmApplied: report.selection.selectionAlgorithmApplied, selectedCandidateId: report.selection.selectedCandidateId, finalDecision: report.selection.finalDecision, baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" });
    return Object.freeze({ report, auditArtifact, summaryJson: stableStringify(report), auditJson: stableStringify(auditArtifact), resultsMarkdown: renderResults(report), selectionJson: stableStringify(selectionReport), selectionMarkdown: selectionMarkdown(report) });
  })();
}

export function validateR9AuthoritativeReport(report: R9PerformanceReport): void {
  if (report.researchRoundId !== M3_R9_RESEARCH_ROUND_ID || report.performanceExecutionCount !== 1 || report.performanceLockTriggered !== true || report.selection.selectedCandidateId !== null && !M3_R9_CANDIDATE_IDS.includes(report.selection.selectedCandidateId)) throw new Error("R9 report lifecycle or selection identity is invalid.");
  if (report.candidateRegistry.length !== 5) throw new Error("R9 report candidate registry is incomplete.");
}

export function r9OutputPaths(root = process.cwd()): readonly string[] {
  return M3_R9_OUTPUT_PATHS.map((relative) => path.join(root, relative));
}

export function existingR9OutputArtifacts(root = process.cwd()): readonly string[] {
  return Object.freeze(r9OutputPaths(root).filter((filePath) => existsSync(filePath)));
}

export function sha256R9Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function publishR9ArtifactsAtomically(input: Readonly<{ artifacts: R9ExecutionArtifacts; root?: string }>): void {
  const root = path.resolve(input.root ?? process.cwd());
  const targets = r9OutputPaths(root);
  const payloads = [input.artifacts.auditJson, input.artifacts.resultsMarkdown, input.artifacts.selectionMarkdown, input.artifacts.selectionJson, input.artifacts.summaryJson];
  const existing = targets.filter((target) => existsSync(target));
  if (existing.length > 0) throw new Error(`R9 output already exists: ${existing.join(", ")}`);
  const stagingDirectory = path.join(path.dirname(targets[0]!), `.m3-r9-round-009-staging-${process.pid}-${Date.now()}`);
  mkdirSync(stagingDirectory, { recursive: true });
  const published: string[] = [];
  try {
    for (let index = 0; index < targets.length; index += 1) {
      const stagingPath = path.join(stagingDirectory, path.basename(targets[index]!));
      mkdirSync(path.dirname(targets[index]!), { recursive: true });
      writeFileSync(stagingPath, payloads[index]!, "utf8");
    }
    for (let index = 0; index < targets.length; index += 1) {
      renameSync(path.join(stagingDirectory, path.basename(targets[index]!)), targets[index]!);
      published.push(targets[index]!);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const target of [...published].reverse()) {
      try {
        unlinkSync(target);
      } catch (rollbackError) {
        rollbackErrors.push(`${target}: ${freezeValidationMessage(rollbackError)}`);
      }
    }
    try {
      rmSync(stagingDirectory, { recursive: true, force: true });
    } catch (cleanupError) {
      rollbackErrors.push(`staging: ${freezeValidationMessage(cleanupError)}`);
    }
    if (rollbackErrors.length > 0 && error instanceof Error) error.message = `${error.message}; R9 rollback failures: ${rollbackErrors.join("; ")}`;
    throw error;
  }
  rmSync(stagingDirectory, { recursive: true, force: true });
}

export function r9ArtifactSizes(root = process.cwd()): readonly Readonly<{ filePath: string; bytes: number }>[] {
  return Object.freeze(r9OutputPaths(root).map((filePath) => Object.freeze({ filePath, bytes: statSync(filePath).size })));
}

export function readR9Summary(root = process.cwd()): R9PerformanceReport {
  return JSON.parse(readFileSync(r9OutputPaths(root)[0]!, "utf8")) as R9PerformanceReport;
}

export { R9_GOVERNANCE, M3_R9_BASE_SOURCE_SHA };
