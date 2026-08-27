import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import type { HistoricalIntrabarSettlementWindow, HistoricalManifest, HistoricalRange, HistoricalStudyData } from "../historical-data/types.ts";
import { HISTORICAL_PROVIDER } from "../historical-data/types.ts";
import { BinanceHistoricalDataLoader } from "../historical-data/binance/loader.ts";
import { discoverIntrabarSettlementRequirements, runBacktest } from "../backtest/runner.ts";
import { validateIntrabarSettlementManifestCoverage } from "../backtest/manifests.ts";
import type { BacktestData, BacktestReport, BacktestSignalResult, IntrabarSettlementRequirement } from "../backtest/types.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange, RESEARCH_FOLDS, selectRecordsForFoldRole } from "./folds.ts";
import type { NormalizedResearchSignal, ResearchRange } from "./types.ts";
import { calculateScoreBucketReport } from "./score-buckets.ts";
import { M3_H_ROUND_001_SCORE_BUCKETS } from "./m3-h-round-001-plan.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R6_PERFORMANCE_LOCK,
  M3_R6_PROTOCOL_VERSION,
  M3_R6_RESEARCH_END_ISO,
  M3_R6_RESEARCH_RANGE,
  M3_R6_RESEARCH_ROUND_ID,
  R6_DATA_CONTRACT,
  R6_FROZEN_FOLD_IDS,
  R6_SYMBOLS,
  type R6CandidateId,
} from "./m3-r6-round-006-protocol.ts";
import { selectRound006CandidateResults } from "./m3-r6-round-006-selectors.ts";
import {
  M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R6_ROUND_006_CANDIDATE_IDS,
  M3_R6_ROUND_006_CONTROL_ID,
  M3_R6_ROUND_006_MACHINE_RECORD,
  M3_R6_ROUND_006_SELECTION_GATE_SHA256,
  validateM3R6Round006MachineRecord,
} from "./selection-gates-round-006.ts";
import {
  M3_R6_DATA_CLASSIFICATION,
  M3_R6_ROUND_006_PLAN,
  M3_R6_ROUND_006_PLAN_SHA256,
  validateM3R6Round006Plan,
} from "./m3-r6-round-006-plan.ts";

export const M3_R6_ROUND_006_SCHEMA_VERSION = "m3-r6-round-006-report-001" as const;
export const M3_R6_ROUND_006_AUDIT_SCHEMA_VERSION = "m3-r6-round-006-audit-001" as const;
export const M3_R6_ROUND_006_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R6_ROUND_006_SUMMARY.json",
  "docs/evidence/M3_R6_ROUND_006_AUDIT.json",
  "docs/M3_R6_ROUND_006_RESULTS.md",
] as const);
export const M3_R6_ROUND_006_RESEARCH_RESULTS_PATH = "docs/research/round-006-results.md" as const;
export const M3_R6_ROUND_006_CONTROL_DISCLAIMER =
  "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION." as const;

export type Round006ExecutionClassification =
  | "PRE_PERFORMANCE_ABORT"
  | "POST_PERFORMANCE_EXECUTION_ABORT"
  | "POST_PERFORMANCE_EVIDENCE_PUBLISH_ABORT"
  | "SUCCESS";
export type Round006PerformanceLifecycle = "PRE_PERFORMANCE" | "PERFORMANCE_LOCKED" | "POST_PERFORMANCE";

export class Round006AuthoritativeExecutionError extends Error {
  readonly classification: Exclude<Round006ExecutionClassification, "SUCCESS">;
  readonly performanceLockTriggered: boolean;
  readonly lifecycle: Round006PerformanceLifecycle;

  constructor(
    classification: Exclude<Round006ExecutionClassification, "SUCCESS">,
    performanceLockTriggered: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "Round006AuthoritativeExecutionError";
    this.classification = classification;
    this.performanceLockTriggered = performanceLockTriggered;
    this.lifecycle = performanceLockTriggered ? "POST_PERFORMANCE" : "PRE_PERFORMANCE";
  }
}

export type Round006HistoricalLoader = Pick<
  BinanceHistoricalDataLoader,
  "loadStudyData" | "loadIntrabarSettlementWindows"
>;

export type Round006LoadRanges = Readonly<{
  candleRange: Readonly<Record<"1h" | "4h", HistoricalRange>>;
  fundingRange: HistoricalRange;
  markPriceRange: HistoricalRange;
  settlementTail: Readonly<{
    candleRange: HistoricalRange;
    fundingRange: HistoricalRange;
    markPriceRange: HistoricalRange;
  }>;
}>;

export type Round006ResearchRecord = Readonly<{
  candidateId: typeof M3_R6_ROUND_006_CONTROL_ID | R6CandidateId;
  signal: NormalizedResearchSignal;
  raw: BacktestSignalResult;
}>;

export type Round006CandidateEvidence = Readonly<{
  candidateId: typeof M3_R6_ROUND_006_CONTROL_ID | R6CandidateId;
  resultStatus: "COMPLETE" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED";
  fullSeenUniverse: Readonly<{
    range: ResearchRange;
    records: readonly NormalizedResearchSignal[];
    diagnostics: ReturnType<typeof calculateResearchDiagnostics>;
  }>;
  folds: readonly Readonly<{
    foldId: keyof typeof RESEARCH_FOLDS;
    research: Readonly<{
      range: ResearchRange;
      records: readonly NormalizedResearchSignal[];
      diagnostics: ReturnType<typeof calculateResearchDiagnostics>;
    }>;
    validation: Readonly<{
      range: ResearchRange;
      records: readonly NormalizedResearchSignal[];
      diagnostics: ReturnType<typeof calculateResearchDiagnostics>;
    }>;
  }>[];
  aggregateValidation: Readonly<{
    segments: readonly ResearchRange[];
    records: readonly NormalizedResearchSignal[];
    diagnostics: ReturnType<typeof calculateResearchDiagnostics>;
  }>;
  signalDensity: Readonly<{
    signalsPerDecisionTimestamp: number;
    maxSimultaneousDirectionalSignals: number;
  }>;
  maxDrawdownR: number | null;
  formalIdentitySha256: string;
  executedIdentitySha256: string;
}>;

type ControlReportSummary = Readonly<{
  schemaVersion: BacktestReport["schemaVersion"];
  status: BacktestReport["status"];
  overallAcceptance: BacktestReport["overallAcceptance"];
  metrics: BacktestReport["metrics"];
  metricsByPeriod: BacktestReport["metricsByPeriod"];
  acceptanceByPeriod: BacktestReport["acceptanceByPeriod"];
  diagnostics: readonly string[];
  intrabarSettlementAudit: Readonly<{
    intrabarSettlementWindowsLoaded: number;
    intrabarResolvedFundingOrderCount: number;
    conservativeSameMinuteCount: number;
    remainingSettlementAmbiguousCount: number;
  }>;
}>;

type ScoreComponentDiagnostics = Readonly<{
  wins: number;
  losses: number;
  breakevens: number;
  executed: number;
  byComponentValue: Readonly<Record<string, Readonly<{
    wins: number;
    losses: number;
    breakevens: number;
    executed: number;
  }>>>;
}>;

export type Round006ScoreDiagnostics = Readonly<{
  source: "CONTROL_BASELINE_001";
  oosRange: ResearchRange;
  components: Readonly<Record<
    "trendStrength" | "pullbackQuality" | "breakoutStrength" | "volumeScore" | "riskRewardScore",
    ScoreComponentDiagnostics
  >>;
  oosScoreBuckets: ReturnType<typeof calculateScoreBucketReport>;
  saturation: Readonly<{ status: "DIAGNOSTIC_ONLY"; note: string }>;
}>;

export type Round006LiveDiagnosticObservations = Readonly<{
  source: "USER_SUPPLIED_SEEN_DIAGNOSTIC_DATA";
  classification: "SEEN_DIAGNOSTIC_DATA_ONLY";
  resolved: 16;
  tp: 3;
  sl: 13;
  cumulativeR: -7;
  profitFactor: 0.4615;
  maxDrawdownR: -13;
  bySymbol: Readonly<Record<"SOLUSDT" | "BNBUSDT" | "ETHUSDT" | "XRPUSDT", Readonly<{
    trades: number;
    tp: number;
    sl: number;
    cumulativeR: number;
  }>>>;
  byGrade: Readonly<Record<"A" | "B", Readonly<{
    trades: number;
    tp: number;
    sl: number;
    cumulativeR: number;
  }>>>;
  commonDirection: "LONG";
  commonBtcRegime: "BTC_STRONG_BULL";
  commonSymbolRegime: "LONG_ONLY";
  overlappingActiveThesisCount: 11;
  usedForGatesOrThresholds: false;
}>;

export type Round006Report = Readonly<{
  schemaVersion: typeof M3_R6_ROUND_006_SCHEMA_VERSION;
  researchRoundId: typeof M3_R6_RESEARCH_ROUND_ID;
  executionSourceSha: string;
  selectionGateSha256: typeof M3_R6_ROUND_006_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R6_ROUND_006_PLAN_SHA256;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: "bt-policy-003";
  controlReportSchemaVersion: "m3-b-report-004";
  dataClassification: typeof M3_R6_DATA_CLASSIFICATION;
  researchUniverse: typeof M3_R6_RESEARCH_RANGE;
  studyServerTime: number;
  performanceLock: typeof M3_R6_PERFORMANCE_LOCK;
  performanceLockTriggered: boolean;
  performanceLifecycle: Round006PerformanceLifecycle;
  evidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityErrors: readonly string[];
  controlReport: ControlReportSummary;
  control: Round006CandidateEvidence;
  candidates: readonly Round006CandidateEvidence[];
  candidateRegistry: readonly R6CandidateId[];
  applicableHardGateIdentities: readonly string[];
  scoreDiagnostics: Round006ScoreDiagnostics;
  liveDiagnosticObservations: Round006LiveDiagnosticObservations;
  selectionApplied: false;
  selectedCandidateId: null;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  disclaimer: typeof M3_R6_ROUND_006_CONTROL_DISCLAIMER;
}>;

export type Round006AuditArtifact = Readonly<{
  schemaVersion: typeof M3_R6_ROUND_006_AUDIT_SCHEMA_VERSION;
  decisions: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  outcomes: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}>;

export type Round006ExecutionArtifacts = Readonly<{
  report: Round006Report;
  auditArtifact: Round006AuditArtifact;
  summaryJson: string;
  auditJson: string;
  resultsMarkdown: string;
}>;

export type Round006PerformanceResultListener = (result: BacktestSignalResult) => void;

export type Round006Preflight = Readonly<{
  confirmAuthoritativePerformance: boolean;
  sourceSha: string;
  authorizedSourceSha: string;
  round: string;
  gateSha: string;
  planSha: string;
  headSha: string;
  cleanWorktree: boolean;
  existingOutputArtifacts: readonly string[];
  gateValidatorPass: boolean;
  planValidatorPass: boolean;
  requiredManifestStatus: string;
  protocolVersion: string;
  protocolSourceSha: string;
  protocolGitBlobSha: string;
  candidateIds: readonly string[];
  controlId: string;
  symbols: readonly string[];
  folds: Readonly<Record<string, unknown>>;
  backtestPolicyVersion: string;
  researchEndIso: string;
}>;

function round006BaseEnd(): number {
  return Math.floor(M3_R6_RESEARCH_RANGE.endTime / INTERVAL_MS["1h"]) * INTERVAL_MS["1h"];
}

/** Exact native candle, funding, mark-price, and settlement-tail ranges. */
export function buildRound006HistoricalLoadRanges(): Round006LoadRanges {
  const lookback1h = M3_R6_RESEARCH_RANGE.startTime - 250 * INTERVAL_MS["1h"];
  const lookback4h = M3_R6_RESEARCH_RANGE.startTime - 250 * INTERVAL_MS["4h"];
  const baseEnd = round006BaseEnd();
  const tailEnd = baseEnd + 48 * INTERVAL_MS["1h"];
  const tailFundingEnd = tailEnd + INTERVAL_MS["1h"] - 1;
  return deepFreeze({
    candleRange: {
      "1h": { startTime: lookback1h, endTime: baseEnd },
      "4h": {
        startTime: lookback4h,
        endTime: Math.floor(baseEnd / INTERVAL_MS["4h"]) * INTERVAL_MS["4h"],
      },
    },
    fundingRange: { startTime: lookback4h, endTime: M3_R6_RESEARCH_RANGE.endTime },
    markPriceRange: {
      startTime: lookback4h - INTERVAL_MS["1h"],
      endTime: M3_R6_RESEARCH_RANGE.endTime,
    },
    settlementTail: {
      candleRange: {
        startTime: M3_R6_RESEARCH_RANGE.endTime + 1,
        endTime: tailEnd,
        settlementOnly: true,
      },
      fundingRange: {
        startTime: M3_R6_RESEARCH_RANGE.endTime + 1,
        endTime: tailFundingEnd,
        settlementOnly: true,
      },
      markPriceRange: {
        startTime: M3_R6_RESEARCH_RANGE.endTime + 1,
        endTime: tailFundingEnd,
        settlementOnly: true,
      },
    },
  });
}

export function round006AuthorizedSettlementEndTime(): number {
  return buildRound006HistoricalLoadRanges().settlementTail.candleRange.endTime + INTERVAL_MS["1h"] - 1;
}

function toBacktestData(study: HistoricalStudyData): BacktestData {
  const datasets = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, {
    candles1h: study.datasets[symbol].candles1h.candles,
    candles4h: study.datasets[symbol].candles4h.candles,
  }])) as BacktestData["datasets"];
  const funding = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.funding[symbol].records]),
  ) as BacktestData["funding"];
  const markPrice = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.markPrice[symbol]?.candles]),
  ) as BacktestData["markPrice"];
  const markPriceSegments = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.markPriceSegments[symbol]]),
  ) as BacktestData["markPriceSegments"];
  return Object.freeze({
    datasets,
    funding,
    markPrice,
    markPriceSegments,
    manifests: study.manifests,
    serverTime: study.serverTime,
  });
}

export function appendRound006IntrabarWindows(
  data: BacktestData,
  windows: readonly HistoricalIntrabarSettlementWindow[],
  requirements: readonly IntrabarSettlementRequirement[] = data.intrabarSettlementRequirements ?? [],
): BacktestData {
  return Object.freeze({
    ...data,
    intrabarSettlementWindows: Object.freeze([...windows]),
    intrabarSettlementRequirements: Object.freeze([...requirements]),
    manifests: Object.freeze([...data.manifests, ...windows.map((window) => window.manifest)]),
  });
}

function symbolOrder(symbol: ResearchSymbol): number {
  return RESEARCH_SYMBOLS.indexOf(symbol);
}

function directionOrder(direction: "LONG" | "SHORT"): number {
  return direction === "LONG" ? 0 : 1;
}

function candidateOrder(candidateId: string): number {
  if (candidateId === M3_R6_ROUND_006_CONTROL_ID) return -1;
  return M3_R6_ROUND_006_CANDIDATE_IDS.indexOf(candidateId as R6CandidateId);
}

function recordSort(left: Round006ResearchRecord, right: Round006ResearchRecord): number {
  return left.signal.signalTime - right.signal.signalTime
    || symbolOrder(left.signal.symbol) - symbolOrder(right.signal.symbol)
    || directionOrder(left.signal.direction) - directionOrder(right.signal.direction)
    || candidateOrder(left.candidateId) - candidateOrder(right.candidateId);
}

function recordIdentity(record: Round006ResearchRecord): string {
  return `${record.candidateId}|${record.signal.symbol}|${record.signal.direction}|${record.signal.signalTime}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function controlRecord(result: BacktestSignalResult): Round006ResearchRecord {
  return Object.freeze({
    candidateId: M3_R6_ROUND_006_CONTROL_ID,
    signal: adaptBacktestSignalResult(result),
    raw: result,
  });
}

export type Round006FormalSignal = Readonly<{
  candidateId: R6CandidateId;
  result: BacktestSignalResult;
}>;

/** Selects a candidate's formal result stream from the already-run CONTROL stream. */
export function enumerateRound006FormalSignals(input: Readonly<{
  candidateId: R6CandidateId;
  controlResults: readonly BacktestSignalResult[];
  data: BacktestData;
}>): readonly Round006FormalSignal[] {
  return Object.freeze(selectRound006CandidateResults({
    candidateId: input.candidateId,
    controlResults: input.controlResults,
    data: input.data,
  }).map((result) => Object.freeze({ candidateId: input.candidateId, result })));
}

export function buildRound006CandidateRecords(input: Readonly<{
  data: BacktestData;
  candidateId: R6CandidateId;
  controlResults: readonly BacktestSignalResult[];
}>): readonly Round006ResearchRecord[] {
  return Object.freeze(enumerateRound006FormalSignals({
    data: input.data,
    candidateId: input.candidateId,
    controlResults: input.controlResults,
  }).map((formal) => Object.freeze({
    candidateId: formal.candidateId,
    signal: adaptBacktestSignalResult(formal.result),
    raw: formal.result,
  })).sort(recordSort));
}

/** Runs the exact baseline-001 CONTROL with the frozen bt-policy-003 path. */
export function buildRound006ControlRecords(
  data: BacktestData,
  onPerformanceResultGenerated?: Round006PerformanceResultListener,
): Readonly<{ report: BacktestReport; records: readonly Round006ResearchRecord[] }> {
  const report = runBacktest({
    period: "COMBINED",
    policy: "bt-policy-003",
    data,
    onPerformanceResultGenerated,
  });
  return Object.freeze({
    report,
    records: Object.freeze(report.signalResults.map(controlRecord)),
  });
}

function deduplicateRequirements(
  requirements: readonly IntrabarSettlementRequirement[],
): readonly IntrabarSettlementRequirement[] {
  const values = new Map<string, IntrabarSettlementRequirement>();
  for (const requirement of requirements) {
    const key = `${requirement.symbol}|${requirement.exitCandleOpenTime}`;
    const existing = values.get(key);
    if (existing && existing.settlementOnly !== requirement.settlementOnly) {
      throw new Error(`Conflicting Round-006 settlementOnly requirement: ${key}`);
    }
    values.set(key, requirement);
  }
  return Object.freeze([...values.values()].sort(
    (left, right) => symbolOrder(left.symbol) - symbolOrder(right.symbol)
      || left.exitCandleOpenTime - right.exitCandleOpenTime,
  ));
}

/** Phase-A discovery uses the existing policy-002 ambiguity discovery path. */
export function discoverRound006IntrabarRequirements(
  input: Readonly<{ data: BacktestData }>,
): readonly IntrabarSettlementRequirement[] {
  return deduplicateRequirements(discoverIntrabarSettlementRequirements({
    period: "COMBINED",
    data: input.data,
  }));
}

function candidateResultStatus(
  records: readonly Round006ResearchRecord[],
): Round006CandidateEvidence["resultStatus"] {
  if (records.some((record) => record.raw.status === "DATA_INCOMPLETE" || record.raw.status === "SETTLEMENT_AMBIGUOUS")) {
    return "DATA_INCOMPLETE";
  }
  if (records.some((record) => record.raw.status === "PERIOD_END_CENSORED")) return "PERIOD_END_CENSORED";
  return "COMPLETE";
}

function signalDensity(records: readonly NormalizedResearchSignal[]): Round006CandidateEvidence["signalDensity"] {
  const counts = new Map<number, number>();
  for (const record of records) counts.set(record.signalTime, (counts.get(record.signalTime) ?? 0) + 1);
  const maximum = Math.max(...counts.values(), 0);
  const mean = counts.size === 0 ? 0 : records.length / counts.size;
  return Object.freeze({
    signalsPerDecisionTimestamp: Number(mean.toFixed(12)),
    maxSimultaneousDirectionalSignals: maximum,
  });
}

function maxDrawdown(records: readonly NormalizedResearchSignal[]): number | null {
  const executed = records
    .filter((record) => record.status === "EXECUTED" && record.netR !== null)
    .sort((left, right) => left.signalTime - right.signalTime || symbolOrder(left.symbol));
  if (executed.length === 0) return null;
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;
  for (const record of executed) {
    cumulative += record.netR!;
    peak = Math.max(peak, cumulative);
    drawdown = Math.min(drawdown, cumulative - peak);
  }
  return Number(drawdown.toFixed(12));
}

function candidateEvidence(
  candidateId: Round006ResearchRecord["candidateId"],
  records: readonly Round006ResearchRecord[],
): Round006CandidateEvidence {
  const signals = records
    .filter((record) => record.candidateId === candidateId)
    .map((record) => record.signal)
    .sort((left, right) => left.signalTime - right.signalTime
      || symbolOrder(left.symbol) - symbolOrder(right.symbol)
      || directionOrder(left.direction) - directionOrder(right.direction));
  const folds = R6_FROZEN_FOLD_IDS.map((foldId) => {
    const researchRange = getResearchFoldRoleRange(foldId, "RESEARCH");
    const validationRange = getResearchFoldRoleRange(foldId, "VALIDATION");
    const researchRecords = selectRecordsForFoldRole(signals, foldId, "RESEARCH");
    const validationRecords = selectRecordsForFoldRole(signals, foldId, "VALIDATION");
    return Object.freeze({
      foldId,
      research: Object.freeze({
        range: researchRange,
        records: researchRecords,
        diagnostics: calculateResearchDiagnostics({ records: researchRecords, range: researchRange }),
      }),
      validation: Object.freeze({
        range: validationRange,
        records: validationRecords,
        diagnostics: calculateResearchDiagnostics({ records: validationRecords, range: validationRange }),
      }),
    });
  });
  const segments = folds.map((fold) => fold.validation.range);
  const aggregateRecords = signals.filter((signal) => segments.some((range) =>
    signal.signalTime >= range.startTime && signal.signalTime <= range.endTime));
  const aggregateRange = Object.freeze({
    startTime: segments[0]!.startTime,
    endTime: segments.at(-1)!.endTime,
  });
  const identityValues = signals.map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`);
  const executedIdentityValues = signals
    .filter((signal) => signal.status === "EXECUTED")
    .map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`);
  return Object.freeze({
    candidateId,
    resultStatus: candidateResultStatus(records.filter((record) => record.candidateId === candidateId)),
    fullSeenUniverse: Object.freeze({
      range: M3_R6_RESEARCH_RANGE,
      records: Object.freeze(signals),
      diagnostics: calculateResearchDiagnostics({ records: signals, range: M3_R6_RESEARCH_RANGE }),
    }),
    folds: Object.freeze(folds),
    aggregateValidation: Object.freeze({
      segments: Object.freeze(segments),
      records: Object.freeze(aggregateRecords),
      diagnostics: calculateResearchDiagnostics({ records: aggregateRecords, range: aggregateRange }),
    }),
    signalDensity: signalDensity(signals),
    maxDrawdownR: maxDrawdown(signals),
    formalIdentitySha256: sha256(identityValues),
    executedIdentitySha256: sha256(executedIdentityValues),
  });
}

function validateProvidedManifest(manifest: HistoricalManifest, errors: string[]): void {
  const manifestSymbol = String(manifest.symbol);
  if (manifest.provider !== HISTORICAL_PROVIDER) errors.push(`INVALID_MANIFEST_PROVIDER:${manifest.symbol}`);
  if (!/^[a-f0-9]{64}$/u.test(manifest.sha256)) errors.push(`INVALID_MANIFEST_SHA256:${manifest.symbol}`);
  if (!RESEARCH_SYMBOLS.includes(manifest.symbol)) errors.push(`INVALID_MANIFEST_SYMBOL:${String(manifest.symbol)}`);
  if (manifest.kind === "candles" && (
    manifest.source !== "/fapi/v1/klines" || (manifest.timeframe !== "1h" && manifest.timeframe !== "4h")
  )) errors.push(`INVALID_CANDLE_MANIFEST:${manifest.symbol}`);
  if (manifest.kind === "funding" && (
    manifest.source !== "/fapi/v1/fundingRate" || manifest.markPriceField !== "markPrice"
  )) errors.push(`INVALID_FUNDING_MANIFEST:${manifest.symbol}`);
  if (manifest.kind === "mark-price") {
    if (manifest.source !== "/fapi/v1/markPriceKlines" || manifest.timeframe !== "1h") {
      errors.push(`INVALID_MARK_PRICE_MANIFEST:${manifestSymbol}`);
    }
  }
  if (manifest.kind === "intrabar-settlement" && (
    manifest.source !== "/fapi/v1/klines" || manifest.timeframe !== "1m" || manifest.rowCount !== 60
  )) errors.push(`INVALID_INTRABAR_MANIFEST:${manifestSymbol}`);
}

function requireExactManifest(
  manifests: readonly HistoricalManifest[],
  predicate: (manifest: HistoricalManifest) => boolean,
  label: string,
  errors: string[],
): void {
  if (!manifests.some(predicate)) errors.push(`MISSING_OR_MISMATCHED_MANIFEST:${label}`);
}

function fallbackManifestRequirements(
  records: readonly Round006ResearchRecord[],
  errors: string[],
): readonly Readonly<{ symbol: ResearchSymbol; segment: "base" | "settlement-tail" }>[] {
  const requirements = new Map<string, Readonly<{ symbol: ResearchSymbol; segment: "base" | "settlement-tail" }>>();
  for (const record of records) {
    const raw = record.raw;
    for (const item of [...raw.fundingCharges, ...(raw.fundingOrderAudits ?? [])]) {
      if (item.markPriceSource !== "MARK_PRICE_KLINE_PRE_EVENT_CLOSE") continue;
      if (item.markPriceManifestSegment !== "base" && item.markPriceManifestSegment !== "settlement-tail") {
        errors.push(`FALLBACK_MARK_PRICE_MANIFEST_SEGMENT_MISSING:${record.signal.symbol}`);
        continue;
      }
      requirements.set(`${record.signal.symbol}|${item.markPriceManifestSegment}`, {
        symbol: record.signal.symbol,
        segment: item.markPriceManifestSegment,
      });
    }
  }
  return Object.freeze([...requirements.values()]);
}

function validateRequiredRound006ManifestCoverage(
  data: BacktestData,
  records: readonly Round006ResearchRecord[],
  errors: string[],
): void {
  const ranges = buildRound006HistoricalLoadRanges();
  const manifests = data.manifests ?? [];
  const candle = (
    symbol: ResearchSymbol,
    timeframe: "1h" | "4h",
    range: HistoricalRange,
    settlementOnly: boolean,
  ) => (manifest: HistoricalManifest): boolean => manifest.kind === "candles"
    && manifest.provider === HISTORICAL_PROVIDER
    && manifest.source === "/fapi/v1/klines"
    && manifest.symbol === symbol
    && manifest.timeframe === timeframe
    && manifest.requestedStartTime === range.startTime
    && manifest.requestedEndTime === range.endTime
    && manifest.settlementOnly === settlementOnly;
  const funding = (
    symbol: ResearchSymbol,
    range: HistoricalRange,
    settlementOnly: boolean,
  ) => (manifest: HistoricalManifest): boolean => manifest.kind === "funding"
    && manifest.provider === HISTORICAL_PROVIDER
    && manifest.source === "/fapi/v1/fundingRate"
    && manifest.symbol === symbol
    && manifest.requestedStartTime === range.startTime
    && manifest.requestedEndTime === range.endTime
    && manifest.settlementOnly === settlementOnly
    && manifest.markPriceField === "markPrice";
  for (const symbol of RESEARCH_SYMBOLS) {
    requireExactManifest(manifests, candle(symbol, "1h", ranges.candleRange["1h"], false), `base-candles-1h:${symbol}`, errors);
    requireExactManifest(manifests, candle(symbol, "4h", ranges.candleRange["4h"], false), `base-candles-4h:${symbol}`, errors);
    requireExactManifest(manifests, funding(symbol, ranges.fundingRange, false), `base-funding:${symbol}`, errors);
    requireExactManifest(
      manifests,
      candle(symbol, "1h", ranges.settlementTail.candleRange, true),
      `settlement-tail-candles-1h:${symbol}`,
      errors,
    );
    requireExactManifest(
      manifests,
      funding(symbol, ranges.settlementTail.fundingRange, true),
      `settlement-tail-funding:${symbol}`,
      errors,
    );
  }
  for (const requirement of fallbackManifestRequirements(records, errors)) {
    const range = requirement.segment === "base"
      ? ranges.markPriceRange
      : ranges.settlementTail.markPriceRange;
    requireExactManifest(manifests, (manifest): boolean => manifest.kind === "mark-price"
      && manifest.provider === HISTORICAL_PROVIDER
      && manifest.source === "/fapi/v1/markPriceKlines"
      && manifest.symbol === requirement.symbol
      && manifest.timeframe === "1h"
      && manifest.requestedStartTime === range.startTime
      && manifest.requestedEndTime === range.endTime
      && manifest.settlementOnly === (requirement.segment === "settlement-tail"),
    `mark-price-${requirement.segment}:${requirement.symbol}`, errors);
  }
  errors.push(...validateIntrabarSettlementManifestCoverage(
    manifests,
    data.intrabarSettlementRequirements ?? [],
  ).diagnostics);
}

function validateRound006Integrity(input: Readonly<{
  data: BacktestData;
  records: readonly Round006ResearchRecord[];
  executionSourceSha: string;
  incompleteEvaluationReasons: readonly string[];
}>): readonly string[] {
  const errors: string[] = [];
  if (!/^[0-9a-f]{40}$/u.test(input.executionSourceSha)) errors.push("INVALID_EXECUTION_SOURCE_SHA");
  if (!Number.isSafeInteger(input.data.serverTime)) errors.push("INVALID_STUDY_SERVER_TIME");
  for (const manifest of input.data.manifests ?? []) validateProvidedManifest(manifest, errors);
  const seen = new Set<string>();
  for (const record of input.records) {
    const key = recordIdentity(record);
    if (seen.has(key)) errors.push(`DUPLICATE_IDENTITY:${key}`);
    seen.add(key);
    if (record.signal.signalTime < M3_R6_RESEARCH_RANGE.startTime
      || record.signal.signalTime > M3_R6_RESEARCH_RANGE.endTime) {
      errors.push(`SIGNAL_OUTSIDE_RESEARCH_RANGE:${key}`);
    }
    if (record.raw.status === "DATA_INCOMPLETE" || record.raw.status === "SETTLEMENT_AMBIGUOUS") {
      errors.push(`NON_COMPLETE_SETTLEMENT:${key}:${record.raw.status}`);
    }
    if (record.candidateId !== M3_R6_ROUND_006_CONTROL_ID
      && !M3_R6_ROUND_006_CANDIDATE_IDS.includes(record.candidateId as R6CandidateId)) {
      errors.push(`UNKNOWN_CANDIDATE_ID:${record.candidateId}`);
    }
  }
  if (input.incompleteEvaluationReasons.length > 0) {
    errors.push(...input.incompleteEvaluationReasons.map((reason) => `EVALUATION_DATA_INCOMPLETE:${reason}`));
  }
  validateRequiredRound006ManifestCoverage(input.data, input.records, errors);
  return Object.freeze([...new Set(errors)]);
}

export function validateRound006EvidenceIntegrity(input: Readonly<{
  data: BacktestData;
  records: readonly Round006ResearchRecord[];
  executionSourceSha: string;
  incompleteEvaluationReasons?: readonly string[];
}>): Readonly<{ passed: boolean; errors: readonly string[] }> {
  const errors = validateRound006Integrity({
    ...input,
    incompleteEvaluationReasons: input.incompleteEvaluationReasons ?? [],
  });
  return Object.freeze({ passed: errors.length === 0, errors });
}

function buildScoreDiagnostics(controlRecords: readonly Round006ResearchRecord[]): Round006ScoreDiagnostics {
  const oosRange = getResearchFoldRoleRange("F6", "VALIDATION");
  const results = controlRecords
    .map((record) => record.raw)
    .filter((result) => result.snapshot.signalTime >= oosRange.startTime
      && result.snapshot.signalTime <= oosRange.endTime);
  const names = [
    "trendStrength",
    "pullbackQuality",
    "breakoutStrength",
    "volumeScore",
    "riskRewardScore",
  ] as const;
  const components = Object.fromEntries(names.map((name) => {
    const byValue = new Map<string, {
      wins: number;
      losses: number;
      breakevens: number;
      executed: number;
    }>();
    let wins = 0;
    let losses = 0;
    let breakevens = 0;
    let executed = 0;
    for (const result of results) {
      if (result.status !== "EXECUTED" || result.netR === null) continue;
      executed += 1;
      if (result.netR > 0) wins += 1;
      else if (result.netR < 0) losses += 1;
      else breakevens += 1;
      const key = String(result.snapshot.breakdown[name]);
      const group = byValue.get(key) ?? { wins: 0, losses: 0, breakevens: 0, executed: 0 };
      group.executed += 1;
      if (result.netR > 0) group.wins += 1;
      else if (result.netR < 0) group.losses += 1;
      else group.breakevens += 1;
      byValue.set(key, group);
    }
    const orderedByValue = Object.fromEntries([...byValue.entries()]
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([key, value]) => [key, Object.freeze(value)]));
    return [name, Object.freeze({
      wins,
      losses,
      breakevens,
      executed,
      byComponentValue: Object.freeze(orderedByValue),
    })];
  })) as unknown as Round006ScoreDiagnostics["components"];
  const oosRecords = controlRecords
    .map((record) => record.signal)
    .filter((record) => record.signalTime >= oosRange.startTime && record.signalTime <= oosRange.endTime);
  return Object.freeze({
    source: "CONTROL_BASELINE_001",
    oosRange,
    components,
    oosScoreBuckets: calculateScoreBucketReport({ records: oosRecords, buckets: M3_H_ROUND_001_SCORE_BUCKETS }),
    saturation: Object.freeze({
      status: "DIAGNOSTIC_ONLY",
      note: "These baseline score diagnostics are descriptive only; Round-006 does not reweight, tune, sweep, or gate on score components.",
    }),
  });
}

const LIVE_DIAGNOSTIC_OBSERVATIONS: Round006LiveDiagnosticObservations = Object.freeze({
  source: "USER_SUPPLIED_SEEN_DIAGNOSTIC_DATA",
  classification: "SEEN_DIAGNOSTIC_DATA_ONLY",
  resolved: 16,
  tp: 3,
  sl: 13,
  cumulativeR: -7,
  profitFactor: 0.4615,
  maxDrawdownR: -13,
  bySymbol: Object.freeze({
    SOLUSDT: Object.freeze({ trades: 4, tp: 3, sl: 1, cumulativeR: 5 }),
    BNBUSDT: Object.freeze({ trades: 3, tp: 0, sl: 3, cumulativeR: -3 }),
    ETHUSDT: Object.freeze({ trades: 4, tp: 0, sl: 4, cumulativeR: -4 }),
    XRPUSDT: Object.freeze({ trades: 5, tp: 0, sl: 5, cumulativeR: -5 }),
  }),
  byGrade: Object.freeze({
    A: Object.freeze({ trades: 13, tp: 3, sl: 10, cumulativeR: -4 }),
    B: Object.freeze({ trades: 3, tp: 0, sl: 3, cumulativeR: -3 }),
  }),
  commonDirection: "LONG",
  commonBtcRegime: "BTC_STRONG_BULL",
  commonSymbolRegime: "LONG_ONLY",
  overlappingActiveThesisCount: 11,
  usedForGatesOrThresholds: false,
});

function controlReportSummary(report: BacktestReport): ControlReportSummary {
  const reportWithAudit = report as BacktestReport & Partial<{
    intrabarSettlementWindowsLoaded: number;
    intrabarResolvedFundingOrderCount: number;
    conservativeSameMinuteCount: number;
    remainingSettlementAmbiguousCount: number;
  }>;
  return Object.freeze({
    schemaVersion: report.schemaVersion,
    status: report.status,
    overallAcceptance: report.overallAcceptance,
    metrics: report.metrics,
    metricsByPeriod: report.metricsByPeriod,
    acceptanceByPeriod: report.acceptanceByPeriod,
    diagnostics: report.diagnostics,
    intrabarSettlementAudit: Object.freeze({
      intrabarSettlementWindowsLoaded: reportWithAudit.intrabarSettlementWindowsLoaded ?? 0,
      intrabarResolvedFundingOrderCount: reportWithAudit.intrabarResolvedFundingOrderCount ?? 0,
      conservativeSameMinuteCount: reportWithAudit.conservativeSameMinuteCount ?? 0,
      remainingSettlementAmbiguousCount: reportWithAudit.remainingSettlementAmbiguousCount ?? 0,
    }),
  });
}

function buildAuditArtifact(records: readonly Round006ResearchRecord[]): Round006AuditArtifact {
  const decisions: Record<string, Readonly<Record<string, unknown>>[]> = {};
  const outcomes: Record<string, Readonly<Record<string, unknown>>[]> = {};
  for (const record of [...records].sort(recordSort)) {
    decisions[record.candidateId] ??= [];
    decisions[record.candidateId]!.push({
      signalTime: record.signal.signalTime,
      symbol: record.signal.symbol,
      direction: record.signal.direction,
      status: record.raw.status,
    });
    if (record.raw.status !== "EXECUTED") continue;
    outcomes[record.candidateId] ??= [];
    outcomes[record.candidateId]!.push({
      signalTime: record.signal.signalTime,
      symbol: record.signal.symbol,
      direction: record.signal.direction,
      entryTime: record.signal.entryTime,
      exitTime: record.signal.exitTime,
      exitReason: record.raw.exitReason,
      grossR: record.signal.grossR,
      feeR: record.signal.feeR,
      fundingR: record.signal.fundingR,
      netR: record.signal.netR,
    });
  }
  return deepFreeze({
    schemaVersion: M3_R6_ROUND_006_AUDIT_SCHEMA_VERSION,
    decisions,
    outcomes,
  });
}

export function buildRound006PerformanceReport(input: Readonly<{
  data: BacktestData;
  executionSourceSha: string;
  controlReport: BacktestReport;
  controlRecords: readonly Round006ResearchRecord[];
  candidateRecords: readonly Round006ResearchRecord[];
  incompleteEvaluationReasons?: readonly string[];
  performanceLockTriggered?: boolean;
}>): Round006Report {
  validateM3R6Round006MachineRecord();
  validateM3R6Round006Plan();
  const records = Object.freeze([...input.controlRecords, ...input.candidateRecords].sort(recordSort));
  const integrityErrors = validateRound006Integrity({
    data: input.data,
    records,
    executionSourceSha: input.executionSourceSha,
    incompleteEvaluationReasons: input.incompleteEvaluationReasons ?? [],
  });
  const control = candidateEvidence(M3_R6_ROUND_006_CONTROL_ID, records);
  const candidates = M3_R6_ROUND_006_CANDIDATE_IDS.map((candidateId) => candidateEvidence(candidateId, records));
  const performanceLockTriggered = input.performanceLockTriggered === true;
  return deepFreeze({
    schemaVersion: M3_R6_ROUND_006_SCHEMA_VERSION,
    researchRoundId: M3_R6_RESEARCH_ROUND_ID,
    executionSourceSha: input.executionSourceSha,
    selectionGateSha256: M3_R6_ROUND_006_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R6_ROUND_006_PLAN_SHA256,
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    controlReportSchemaVersion: "m3-b-report-004",
    dataClassification: M3_R6_DATA_CLASSIFICATION,
    researchUniverse: M3_R6_RESEARCH_RANGE,
    studyServerTime: input.data.serverTime ?? 0,
    performanceLock: M3_R6_PERFORMANCE_LOCK,
    performanceLockTriggered,
    performanceLifecycle: performanceLockTriggered ? "PERFORMANCE_LOCKED" : "PRE_PERFORMANCE",
    evidenceStatus: integrityErrors.length === 0 && input.controlReport.overallAcceptance.status !== "INCOMPLETE"
      ? "COMPLETE"
      : "INCOMPLETE",
    integrityErrors,
    controlReport: controlReportSummary(input.controlReport),
    control,
    candidates,
    candidateRegistry: M3_R6_ROUND_006_CANDIDATE_IDS,
    applicableHardGateIdentities: M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
    scoreDiagnostics: buildScoreDiagnostics(input.controlRecords),
    liveDiagnosticObservations: LIVE_DIAGNOSTIC_OBSERVATIONS,
    selectionApplied: false,
    selectedCandidateId: null,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    disclaimer: M3_R6_ROUND_006_CONTROL_DISCLAIMER,
  });
}

function formatMetric(value: number | null): string {
  return value === null ? "null" : String(value);
}

function renderDiagnosticsTable(candidate: Round006CandidateEvidence): readonly string[] {
  const diagnostics = candidate.aggregateValidation.diagnostics;
  return [
    `| ${candidate.candidateId} | ${candidate.resultStatus} | ${diagnostics.formalSignals} | ${diagnostics.executedTrades} | ${formatMetric(diagnostics.grossR)} | ${formatMetric(diagnostics.netR)} | ${formatMetric(diagnostics.expectancyR)} | ${formatMetric(diagnostics.profitFactor)} | ${formatMetric(diagnostics.overlappingSignalRate)} |`,
  ];
}

function renderCandidateDiagnostics(candidate: Round006CandidateEvidence): readonly string[] {
  const diagnostics = candidate.aggregateValidation.diagnostics;
  const symbolCounts = Object.values(diagnostics.bySymbol).map((group) => group.formalSignals);
  const directionCounts = Object.values(diagnostics.byDirection).map((group) => group.formalSignals);
  const regimeCounts = Object.values(diagnostics.bySymbolRegime).map((group) => group.formalSignals);
  const total = diagnostics.formalSignals;
  const share = (values: readonly number[]): string => total === 0
    ? "null"
    : String(Number((Math.max(...values, 0) / total).toFixed(12)));
  return [
    `- ${candidate.candidateId}: maxDrawdownR=${formatMetric(candidate.maxDrawdownR)}; signalsPerDecisionTimestamp=${candidate.signalDensity.signalsPerDecisionTimestamp}; maxSimultaneousDirectionalSignals=${candidate.signalDensity.maxSimultaneousDirectionalSignals}`,
    `- concentration: symbol=${share(symbolCounts)}; direction=${share(directionCounts)}; regime=${share(regimeCounts)}`,
    `- costs: feeR=${formatMetric(diagnostics.feeR)}; fundingR=${formatMetric(diagnostics.fundingR)}; settlement economics are inherited from bt-policy-003 (including slippage)`,
  ];
}

export function renderRound006ResultsMarkdown(report: Round006Report): string {
  const lines = [
    "# M3-R6 Round-006 Profitability Rebuild Results",
    "",
    `- researchRoundId: ${report.researchRoundId}`,
    `- executionSourceSha: ${report.executionSourceSha}`,
    `- selectionGateSha256: ${report.selectionGateSha256}`,
    `- experimentPlanSha256: ${report.experimentPlanSha256}`,
    `- dataClassification: ${report.dataClassification}`,
    `- researchBoundary: ${M3_R6_RESEARCH_END_ISO}`,
    `- studyServerTime: ${report.studyServerTime}`,
    `- evidenceStatus: ${report.evidenceStatus}`,
    `- performanceLockTriggered: ${report.performanceLockTriggered}`,
    `- performanceLifecycle: ${report.performanceLifecycle}`,
    "- selectionApplied: false",
    "- selectedCandidateId: null",
    "- baseline002Status: NOT_FROZEN",
    "- m3JStatus: BLOCKED",
    "- m4Status: NOT_STARTED",
    "",
    "## CONTROL and candidate aggregate validation",
    "",
    "| candidate | result status | formal | executed | gross R | net R | expectancy R | PF | overlap rate |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...renderDiagnosticsTable(report.control),
    ...report.candidates.flatMap(renderDiagnosticsTable),
    "",
    "## Required diagnostics",
    "",
    ...[report.control, ...report.candidates].flatMap(renderCandidateDiagnostics),
    "",
    "## Frozen validation folds",
    "",
  ];
  for (const candidate of [report.control, ...report.candidates]) {
    lines.push(`### ${candidate.candidateId}`);
    lines.push(
      "",
      "| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |",
      "| --- | ---: | ---: | ---: | ---: | ---: |",
    );
    for (const fold of candidate.folds) {
      const diagnostics = fold.validation.diagnostics;
      lines.push(`| ${fold.foldId} | ${diagnostics.formalSignals} | ${diagnostics.executedTrades} | ${formatMetric(diagnostics.netR)} | ${formatMetric(diagnostics.expectancyR)} | ${formatMetric(diagnostics.profitFactor)} |`);
    }
    lines.push("");
  }
  lines.push(
    "## Score diagnostics",
    "",
    "Score component wins/losses and OOS buckets are descriptive diagnostics only. They do not tune, reweight, sweep, or gate Round-006.",
    "",
    `- OOS score bucket monotonicity: ${report.scoreDiagnostics.oosScoreBuckets.monotonicity}`,
    `- score bucket unassigned count: ${report.scoreDiagnostics.oosScoreBuckets.unassignedScoreCount}`,
    "",
    "## Live diagnostic comparison",
    "",
    "The following is frozen as seen diagnostic data only and is excluded from Gate, Plan, threshold, and candidate decisions:",
    "",
    `- resolved: ${report.liveDiagnosticObservations.resolved}; TP: ${report.liveDiagnosticObservations.tp}; SL: ${report.liveDiagnosticObservations.sl}; cumulative R: ${report.liveDiagnosticObservations.cumulativeR}; PF: ${report.liveDiagnosticObservations.profitFactor}; max DD R: ${report.liveDiagnosticObservations.maxDrawdownR}`,
    `- overlapping active same-symbol/same-direction thesis count: ${report.liveDiagnosticObservations.overlappingActiveThesisCount}`,
    "",
    "## Integrity and boundary",
    "",
    `- integrityErrors: ${report.integrityErrors.length === 0 ? "0" : report.integrityErrors.join("; ")}`,
    "- CONTROL is baseline-001 with bt-policy-003 fees, slippage, funding, and intrabar settlement.",
    "- Gate-by-gate evaluation and candidate selection are deferred to the separate mechanical selection command.",
    "- No Round-006 selection is applied by the performance command.",
    "- No baseline-002 freeze, M3-J start, or M4 start occurs in this batch.",
    "",
  );
  return lines.join("\n");
}

export function buildRound006ExecutionArtifacts(input: Readonly<{
  report: Round006Report;
  records: readonly Round006ResearchRecord[];
}>): Round006ExecutionArtifacts {
  const auditArtifact = buildAuditArtifact(input.records);
  const summaryJson = stableStringify(input.report);
  const auditJson = stableStringify(auditArtifact);
  const resultsMarkdown = renderRound006ResultsMarkdown(input.report);
  return Object.freeze({ report: input.report, auditArtifact, summaryJson, auditJson, resultsMarkdown });
}

function currentProtocolSourceSha(): string {
  return M3_R6_ROUND_006_MACHINE_RECORD.b1aProtocolSourceIdentity.sourceSha;
}

export function assertRound006PerformancePreflight(input: Round006Preflight): void {
  if (!input.confirmAuthoritativePerformance) {
    throw new Error("--confirm-authoritative-performance is required before any network access.");
  }
  if (!/^[0-9a-f]{40}$/u.test(input.sourceSha) || input.sourceSha !== input.headSha) {
    throw new Error("Round-006 execution source SHA must exactly match HEAD.");
  }
  if (input.sourceSha !== input.authorizedSourceSha) {
    throw new Error("Round-006 execution source SHA must equal the separately authorized source SHA.");
  }
  if (input.sourceSha === M3_R6_ROUND_006_MACHINE_RECORD.freezeSourceSha) {
    throw new Error("Round-006 execution source must be separate from the B.1B freeze source.");
  }
  if (input.round !== M3_R6_RESEARCH_ROUND_ID) throw new Error("Round-006 researchRoundId mismatch.");
  if (input.gateSha !== M3_R6_ROUND_006_SELECTION_GATE_SHA256) throw new Error("Round-006 Gate SHA mismatch.");
  if (input.planSha !== M3_R6_ROUND_006_PLAN_SHA256) throw new Error("Round-006 Plan SHA mismatch.");
  if (!input.cleanWorktree) throw new Error("Round-006 authoritative execution requires a clean git worktree.");
  if (input.existingOutputArtifacts.length > 0) {
    throw new Error("Round-006 authoritative output already exists; refusing overwrite.");
  }
  if (input.requiredManifestStatus !== "PASS_BEFORE_NETWORK") {
    throw new Error("Round-006 required manifest preflight did not pass.");
  }
  if (input.gateValidatorPass !== true || input.planValidatorPass !== true) {
    throw new Error("Round-006 frozen validator failed.");
  }
  if (input.protocolVersion !== M3_R6_PROTOCOL_VERSION || input.protocolSourceSha !== currentProtocolSourceSha()) {
    throw new Error("Round-006 protocol identity mismatch.");
  }
  if (!/^[0-9a-f]{40}$/u.test(input.protocolGitBlobSha)
    || input.protocolGitBlobSha !== currentRound006ProtocolGitBlobSha()) {
    throw new Error("Round-006 protocol Git blob mismatch.");
  }
  if (input.researchEndIso !== M3_R6_RESEARCH_END_ISO) throw new Error("Round-006 research boundary mismatch.");
  if (stableStringify(input.candidateIds) !== stableStringify(M3_R6_ROUND_006_CANDIDATE_IDS)) {
    throw new Error("Round-006 candidate registry mismatch.");
  }
  if (input.controlId !== M3_R6_ROUND_006_CONTROL_ID
    || stableStringify(input.symbols) !== stableStringify(R6_SYMBOLS)
    || stableStringify(input.folds) !== stableStringify(RESEARCH_FOLDS)) {
    throw new Error("Round-006 universe or CONTROL identity mismatch.");
  }
  if (input.backtestPolicyVersion !== "bt-policy-003") throw new Error("Round-006 backtest policy mismatch.");
}

export function readRound006GitState(): Readonly<{ headSha: string; cleanWorktree: boolean }> {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  return Object.freeze({ headSha, cleanWorktree: status.length === 0 });
}

export function currentRound006ProtocolGitBlobSha(): string {
  return execFileSync("git", ["hash-object", "src/lib/research/m3-r6-round-006-protocol.ts"], {
    encoding: "utf8",
  }).trim();
}

export function existingRound006OutputArtifacts(): readonly string[] {
  return Object.freeze(M3_R6_ROUND_006_OUTPUT_PATHS.filter((outputPath) => existsSync(outputPath)));
}

export function round006ArtifactStagingPrefix(summaryPath: string): string {
  return path.join(path.dirname(summaryPath), ".tradepulse-m3-r6-");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function publicationFailureWithRollbackErrors(
  publicationError: unknown,
  rollbackErrors: readonly unknown[],
): Error {
  return new Error(
    `Round-006 artifact publication failed: ${errorMessage(publicationError)}; rollback failed: ${rollbackErrors.map(errorMessage).join("; ")}`,
    { cause: publicationError },
  );
}

/** Publishes optional research notes, then AUDIT -> RESULTS -> SUMMARY on the destination filesystem. */
export function publishRound006ArtifactsAtomically(input: Readonly<{
  summaryPath: string;
  auditPath: string;
  resultsPath: string;
  summary: string;
  audit: string;
  results: string;
  researchResultsPath?: string;
  researchResults?: string;
  rename?: typeof renameSync;
}>): void {
  const destinations = [input.auditPath, input.resultsPath, input.summaryPath];
  const allDestinations = input.researchResultsPath
    ? [...destinations, input.researchResultsPath]
    : destinations;
  if (allDestinations.some((destination) => existsSync(destination))) {
    throw new Error("Round-006 output already exists; refusing overwrite.");
  }

  mkdirSync(path.dirname(input.summaryPath), { recursive: true });
  mkdirSync(path.dirname(input.resultsPath), { recursive: true });
  if (input.researchResultsPath) mkdirSync(path.dirname(input.researchResultsPath), { recursive: true });

  const stagingDirectory = mkdtempSync(round006ArtifactStagingPrefix(input.summaryPath));
  const stagedAudit = path.join(stagingDirectory, path.basename(input.auditPath));
  const stagedResults = path.join(stagingDirectory, path.basename(input.resultsPath));
  const stagedSummary = path.join(stagingDirectory, path.basename(input.summaryPath));
  const stagedResearch = input.researchResultsPath
    ? path.join(stagingDirectory, path.basename(input.researchResultsPath))
    : null;
  const renameArtifact = input.rename ?? renameSync;
  const published: string[] = [];
  try {
    writeFileSync(stagedAudit, input.audit, "utf8");
    writeFileSync(stagedResults, input.results, "utf8");
    writeFileSync(stagedSummary, input.summary, "utf8");
    if (stagedResearch && input.researchResults !== undefined) {
      writeFileSync(stagedResearch, input.researchResults, "utf8");
    }
    if (allDestinations.some((destination) => existsSync(destination))) {
      throw new Error("Round-006 output appeared during publication; refusing overwrite.");
    }

    if (input.researchResultsPath) {
      if (!stagedResearch || input.researchResults === undefined) {
        throw new Error("Round-006 research results are missing from publication staging.");
      }
      renameArtifact(stagedResearch, input.researchResultsPath);
      published.push(input.researchResultsPath);
    }
    if (existsSync(input.auditPath)) throw new Error(`Round-006 output appeared during publication: ${input.auditPath}`);
    renameArtifact(stagedAudit, input.auditPath);
    published.push(input.auditPath);
    if (existsSync(input.resultsPath)) throw new Error(`Round-006 output appeared during publication: ${input.resultsPath}`);
    renameArtifact(stagedResults, input.resultsPath);
    published.push(input.resultsPath);
    if (existsSync(input.summaryPath)) throw new Error(`Round-006 output appeared during publication: ${input.summaryPath}`);
    renameArtifact(stagedSummary, input.summaryPath);
    published.push(input.summaryPath);
  } catch (publicationError) {
    const rollbackErrors: unknown[] = [];
    for (const destination of [...published].reverse()) {
      try {
        unlinkSync(destination);
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
    try {
      rmSync(stagingDirectory, { recursive: true, force: true });
    } catch (error) {
      rollbackErrors.push(error);
    }
    if (rollbackErrors.length > 0) throw publicationFailureWithRollbackErrors(publicationError, rollbackErrors);
    throw publicationError;
  }
  rmSync(stagingDirectory, { recursive: true, force: true });
}

function publicationHash(bytes: string): string {
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

export function round006ArtifactHashes(
  artifacts: Round006ExecutionArtifacts,
): Readonly<{ summary: string; audit: string; results: string }> {
  return Object.freeze({
    summary: publicationHash(artifacts.summaryJson),
    audit: publicationHash(artifacts.auditJson),
    results: publicationHash(artifacts.resultsMarkdown),
  });
}

export async function executeRound006Authoritative(input: Readonly<{
  loader?: Round006HistoricalLoader;
  executionSourceSha: string;
}>): Promise<Round006ExecutionArtifacts> {
  let performanceLockTriggered = false;
  const onPerformanceResultGenerated: Round006PerformanceResultListener = () => {
    performanceLockTriggered = true;
  };
  try {
    const loader = input.loader ?? new BinanceHistoricalDataLoader();
    const ranges = buildRound006HistoricalLoadRanges();
    const study = await loader.loadStudyData({ ...ranges, policy: "bt-policy-003" });
    const initialData = toBacktestData(study);
    const requirements = discoverRound006IntrabarRequirements({ data: initialData });
    const windows = await loader.loadIntrabarSettlementWindows(requirements, study.serverTime);
    const data = appendRound006IntrabarWindows(initialData, windows, requirements);
    const control = buildRound006ControlRecords(data, onPerformanceResultGenerated);
    const candidateRecords: Round006ResearchRecord[] = [];
    for (const candidateId of M3_R6_ROUND_006_CANDIDATE_IDS) {
      candidateRecords.push(...buildRound006CandidateRecords({
        data,
        candidateId,
        controlResults: control.report.signalResults,
      }));
    }
    const report = buildRound006PerformanceReport({
      data,
      executionSourceSha: input.executionSourceSha,
      controlReport: control.report,
      controlRecords: control.records,
      candidateRecords,
      performanceLockTriggered,
    });
    return buildRound006ExecutionArtifacts({
      report,
      records: [...control.records, ...candidateRecords],
    });
  } catch (error) {
    if (error instanceof Round006AuthoritativeExecutionError) throw error;
    throw new Round006AuthoritativeExecutionError(
      performanceLockTriggered ? "POST_PERFORMANCE_EXECUTION_ABORT" : "PRE_PERFORMANCE_ABORT",
      performanceLockTriggered,
      errorMessage(error),
      { cause: error },
    );
  }
}

export { M3_R6_ROUND_006_PLAN, R6_DATA_CONTRACT };
