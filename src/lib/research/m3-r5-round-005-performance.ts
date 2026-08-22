import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import type { Candle } from "../market-data/types.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type {
  HistoricalIntrabarSettlementWindow,
  HistoricalManifest,
  HistoricalStudyData,
  HistoricalRange,
} from "../historical-data/types.ts";
import { HISTORICAL_PROVIDER } from "../historical-data/types.ts";
import { BinanceHistoricalDataLoader } from "../historical-data/binance/loader.ts";
import { runBacktest, discoverIntrabarSettlementRequirements } from "../backtest/runner.ts";
import { validateIntrabarSettlementManifestCoverage } from "../backtest/manifests.ts";
import type { BacktestData, BacktestReport, BacktestSignalResult, IntrabarSettlementRequirement } from "../backtest/types.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange, RESEARCH_FOLDS, selectRecordsForFoldRole } from "./folds.ts";
import type { NormalizedResearchSignal, ResearchRange } from "./types.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R5_DATA_CLASSIFICATION,
  M3_R5_RESEARCH_RANGE,
  M3_R5_RESEARCH_ROUND_ID,
  evaluateR5H15,
  evaluateR5H16,
  evaluateR5H18,
  type R5CandidateId,
  type R5CandidateSignal,
} from "./m3-r5-round-005-protocol.ts";
import {
  M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_CANDIDATE_IDS,
  M3_R5_ROUND_005_CONTROL_ID,
  M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_MACHINE_RECORD,
  M3_R5_ROUND_005_PERFORMANCE_LOCK,
  M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
  M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
  M3_R5_ROUND_005_SELECTION_GATE_SHA256,
  validateM3R5Round005MachineRecord,
} from "./selection-gates-round-005.ts";
import { M3_R5_ROUND_005_PLAN, M3_R5_ROUND_005_PLAN_SHA256, validateM3R5Round005Plan } from "./m3-r5-round-005-plan.ts";
import { settleR5Candidate, type R5SettlementResult } from "./m3-r5-round-005-settlement.ts";

export const M3_R5_ROUND_005_SCHEMA_VERSION = "m3-r5-round-005-report-001" as const;
export const M3_R5_ROUND_005_AUDIT_SCHEMA_VERSION = "m3-r5-round-005-audit-001" as const;
export const M3_R5_ROUND_005_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R5_ROUND_005_SUMMARY.json",
  "docs/evidence/M3_R5_ROUND_005_AUDIT.json",
  "docs/M3_R5_ROUND_005_RESULTS.md",
] as const);
export const M3_R5_ROUND_005_CONTROL_DISCLAIMER =
  "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION." as const;

export type Round005HistoricalLoader = Pick<
  BinanceHistoricalDataLoader,
  "loadStudyData" | "loadIntrabarSettlementWindows"
>;

export type Round005LoadRanges = Readonly<{
  candleRange: Readonly<Record<"1h" | "4h", HistoricalRange>>;
  fundingRange: HistoricalRange;
  markPriceRange: HistoricalRange;
  settlementTail: Readonly<{
    candleRange: HistoricalRange;
    fundingRange: HistoricalRange;
    markPriceRange: HistoricalRange;
  }>;
}>;

export type Round005ResearchRecord = Readonly<{
  candidateId: typeof M3_R5_ROUND_005_CONTROL_ID | R5CandidateId;
  signal: NormalizedResearchSignal;
  raw: BacktestSignalResult | R5SettlementResult;
}>;

export type Round005CandidateEvidence = Readonly<{
  candidateId: typeof M3_R5_ROUND_005_CONTROL_ID | R5CandidateId;
  fullSeenUniverse: Readonly<{
    range: ResearchRange;
    records: readonly NormalizedResearchSignal[];
    diagnostics: ReturnType<typeof calculateResearchDiagnostics>;
  }>;
  folds: readonly Readonly<{
    foldId: keyof typeof RESEARCH_FOLDS;
    research: Readonly<{ range: ResearchRange; records: readonly NormalizedResearchSignal[]; diagnostics: ReturnType<typeof calculateResearchDiagnostics> }>;
    validation: Readonly<{ range: ResearchRange; records: readonly NormalizedResearchSignal[]; diagnostics: ReturnType<typeof calculateResearchDiagnostics> }>;
  }>[];
  aggregateValidation: Readonly<{
    segments: readonly ResearchRange[];
    records: readonly NormalizedResearchSignal[];
    diagnostics: ReturnType<typeof calculateResearchDiagnostics>;
  }>;
  formalIdentitySha256: string;
  executedIdentitySha256: string;
}>;

export type Round005AuditArtifact = Readonly<{
  schemaVersion: typeof M3_R5_ROUND_005_AUDIT_SCHEMA_VERSION;
  decisions: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  outcomes: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}>;

export type Round005Report = Readonly<{
  schemaVersion: typeof M3_R5_ROUND_005_SCHEMA_VERSION;
  researchRoundId: typeof M3_R5_RESEARCH_ROUND_ID;
  executionSourceSha: string;
  selectionGateSha256: typeof M3_R5_ROUND_005_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R5_ROUND_005_PLAN_SHA256;
  inheritedRound004SelectionGateSha256: typeof M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: "bt-policy-003";
  controlReportSchemaVersion: "m3-b-report-004";
  dataClassification: typeof M3_R5_DATA_CLASSIFICATION;
  researchUniverse: typeof M3_R5_RESEARCH_RANGE;
  studyServerTime: number;
  performanceLock: typeof M3_R5_ROUND_005_PERFORMANCE_LOCK;
  performanceLockTriggered: boolean;
  evidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityErrors: readonly string[];
  control: Round005CandidateEvidence;
  candidates: readonly Round005CandidateEvidence[];
  candidateRegistry: readonly R5CandidateId[];
  excludedCandidates: typeof M3_R5_ROUND_005_MACHINE_RECORD.excludedCandidates;
  applicableHardGateIdentities: readonly string[];
  h17Qualification: Readonly<{ status: "DATA_NOT_AVAILABLE"; performanceEligible: false; jsonSha256: string; markdownSha256: string }>;
  selectionApplied: false;
  selectedCandidateId: null;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  disclaimer: typeof M3_R5_ROUND_005_CONTROL_DISCLAIMER;
}>;

export type Round005ExecutionArtifacts = Readonly<{
  report: Round005Report;
  auditArtifact: Round005AuditArtifact;
  summaryJson: string;
  auditJson: string;
  resultsMarkdown: string;
}>;

export type Round005Preflight = Readonly<{
  confirmAuthoritativePerformance: boolean;
  sourceSha: string;
  round: string;
  gateSha: string;
  planSha: string;
  headSha: string;
  cleanWorktree: boolean;
  existingOutputArtifacts: readonly string[];
  gateValidatorPass: boolean;
  planValidatorPass: boolean;
}>;

function round005BaseEnd(): number {
  return Math.floor(M3_R5_RESEARCH_RANGE.endTime / INTERVAL_MS["1h"]) * INTERVAL_MS["1h"];
}

/** Exact native 1H/4H source ranges for future Round-005 execution. */
export function buildRound005HistoricalLoadRanges(): Round005LoadRanges {
  const lookback1h = M3_R5_RESEARCH_RANGE.startTime - 250 * INTERVAL_MS["1h"];
  const lookback4h = M3_R5_RESEARCH_RANGE.startTime - 250 * INTERVAL_MS["4h"];
  const baseEnd = round005BaseEnd();
  const tailEnd = baseEnd + 48 * INTERVAL_MS["1h"];
  const tailFundingEnd = tailEnd + INTERVAL_MS["1h"] - 1;
  return deepFreeze({
    candleRange: {
      "1h": { startTime: lookback1h, endTime: baseEnd },
      "4h": { startTime: lookback4h, endTime: Math.floor(baseEnd / INTERVAL_MS["4h"]) * INTERVAL_MS["4h"] },
    },
    fundingRange: { startTime: lookback4h, endTime: M3_R5_RESEARCH_RANGE.endTime },
    markPriceRange: { startTime: lookback4h - INTERVAL_MS["1h"], endTime: M3_R5_RESEARCH_RANGE.endTime },
    settlementTail: {
      candleRange: { startTime: M3_R5_RESEARCH_RANGE.endTime + 1, endTime: tailEnd, settlementOnly: true },
      fundingRange: { startTime: M3_R5_RESEARCH_RANGE.endTime + 1, endTime: tailFundingEnd, settlementOnly: true },
      markPriceRange: { startTime: M3_R5_RESEARCH_RANGE.endTime + 1, endTime: tailFundingEnd, settlementOnly: true },
    },
  });
}

function toBacktestData(study: HistoricalStudyData): BacktestData {
  const datasets = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, {
    candles1h: study.datasets[symbol].candles1h.candles,
    candles4h: study.datasets[symbol].candles4h.candles,
  }])) as BacktestData["datasets"];
  const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, study.funding[symbol].records])) as BacktestData["funding"];
  const markPrice = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, study.markPrice[symbol]?.candles])) as BacktestData["markPrice"];
  const markPriceSegments = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, study.markPriceSegments[symbol]])) as BacktestData["markPriceSegments"];
  return Object.freeze({
    datasets,
    funding,
    markPrice,
    markPriceSegments,
    manifests: study.manifests,
    serverTime: study.serverTime,
  });
}

export function appendRound005IntrabarWindows(
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

function candidateOrder(candidateId: string): number {
  return candidateId === M3_R5_ROUND_005_CONTROL_ID ? -1 : M3_R5_ROUND_005_CANDIDATE_IDS.findIndex((candidate) => candidate === candidateId);
}

function symbolOrder(symbol: ResearchSymbol): number {
  return RESEARCH_SYMBOLS.indexOf(symbol);
}

function directionOrder(direction: "LONG" | "SHORT"): number {
  return direction === "LONG" ? 0 : 1;
}

function recordSort(left: Round005ResearchRecord, right: Round005ResearchRecord): number {
  return left.signal.signalTime - right.signal.signalTime ||
    symbolOrder(left.signal.symbol) - symbolOrder(right.signal.symbol) ||
    directionOrder(left.signal.direction) - directionOrder(right.signal.direction) ||
    candidateOrder(left.candidateId) - candidateOrder(right.candidateId);
}

function identity(record: Round005ResearchRecord): string {
  return `${record.candidateId}|${record.signal.symbol}|${record.signal.direction}|${record.signal.signalTime}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function normalizeR5Result(result: R5SettlementResult): NormalizedResearchSignal {
  const status: NormalizedResearchSignal["status"] = result.status;
  return deepFreeze({
    signalTime: result.signal.signalTime,
    symbol: result.signal.symbol,
    direction: result.signal.direction,
    symbolRegime: "NO_TRADE",
    btcRegime: "BTC_NEUTRAL",
    totalScore: 0,
    grade: null,
    status,
    entryTime: result.entryTime,
    exitTime: result.exitTime,
    grossR: result.grossR,
    feeR: result.feeR,
    fundingR: result.fundingR,
    netR: result.netR,
    researchRoundId: M3_R5_RESEARCH_ROUND_ID,
  });
}

function controlRecord(result: BacktestSignalResult): Round005ResearchRecord {
  return Object.freeze({ candidateId: M3_R5_ROUND_005_CONTROL_ID, signal: adaptBacktestSignalResult(result), raw: result });
}

function candidateSignalAt(
  candidateId: R5CandidateId,
  symbol: ResearchSymbol,
  candles1h: readonly Candle[],
  candles4h: readonly Candle[],
  currentIndex: number,
  serverTime?: number,
): R5CandidateSignal | null {
  const result = candidateId === "R5-H15-HTF-TREND"
    ? evaluateR5H15({ symbol, candles1h, candles4h, currentIndex, serverTime })
    : candidateId === "R5-H16-NEUTRAL-MEAN-REVERSION"
      ? evaluateR5H16({ symbol, candles1h, candles4h, currentIndex, serverTime })
      : evaluateR5H18({ symbol, candles1h, currentIndex, serverTime });
  return result.status === "SIGNAL" ? result.signal : null;
}

/**
 * Builds formal candidate records from native candle timelines. The function
 * uses no loader and deliberately has no metrics, gate, or selection side effect.
 */
export function buildRound005CandidateRecords(input: Readonly<{
  data: BacktestData;
  candidateId: R5CandidateId;
  intrabarSettlementWindows?: readonly HistoricalIntrabarSettlementWindow[];
}>): readonly Round005ResearchRecord[] {
  const records: Round005ResearchRecord[] = [];
  for (const symbol of RESEARCH_SYMBOLS) {
    const dataset = input.data.datasets[symbol];
    const timeline = input.candidateId === "R5-H15-HTF-TREND" ? dataset.candles4h : dataset.candles1h;
    for (let currentIndex = 0; currentIndex < timeline.length; currentIndex += 1) {
      const signal = candidateSignalAt(input.candidateId, symbol, dataset.candles1h, dataset.candles4h, currentIndex, input.data.serverTime);
      if (!signal || signal.signalTime < M3_R5_RESEARCH_RANGE.startTime || signal.signalTime > M3_R5_RESEARCH_RANGE.endTime) continue;
      const result = settleR5Candidate({
        signal,
        candles1h: dataset.candles1h,
        funding: input.data.funding[symbol] ?? [],
        markPriceCandles: input.data.markPrice?.[symbol],
        markPriceSegments: input.data.markPriceSegments?.[symbol],
        intrabarSettlementWindows: input.intrabarSettlementWindows ?? input.data.intrabarSettlementWindows,
        serverTime: input.data.serverTime,
        periodEndTime: M3_R5_RESEARCH_RANGE.endTime,
      });
      records.push(Object.freeze({ candidateId: input.candidateId, signal: normalizeR5Result(result), raw: result }));
    }
  }
  const seen = new Set<string>();
  for (const record of records) {
    const key = identity(record);
    if (seen.has(key)) throw new Error(`Duplicate Round-005 candidate identity: ${key}`);
    seen.add(key);
  }
  return Object.freeze(records.sort(recordSort));
}

export function buildRound005ControlRecords(data: BacktestData): Readonly<{ report: BacktestReport; records: readonly Round005ResearchRecord[] }> {
  const report = runBacktest({ period: "COMBINED", policy: "bt-policy-003", data });
  return Object.freeze({ report, records: Object.freeze(report.signalResults.map(controlRecord)) });
}

function deduplicateRequirements(requirements: readonly IntrabarSettlementRequirement[]): readonly IntrabarSettlementRequirement[] {
  const values = new Map<string, IntrabarSettlementRequirement>();
  for (const requirement of requirements) {
    const key = `${requirement.symbol}|${requirement.exitCandleOpenTime}`;
    const existing = values.get(key);
    if (existing && existing.settlementOnly !== requirement.settlementOnly) {
      throw new Error(`Conflicting Round-005 settlementOnly requirement: ${key}`);
    }
    values.set(key, requirement);
  }
  return Object.freeze([...values.values()].sort((left, right) => symbolOrder(left.symbol) - symbolOrder(right.symbol) || left.exitCandleOpenTime - right.exitCandleOpenTime));
}

/** Phase-A discovery: only determine which 1m windows a future run would need. */
export function discoverRound005IntrabarRequirements(input: Readonly<{ data: BacktestData }>): readonly IntrabarSettlementRequirement[] {
  const requirements: IntrabarSettlementRequirement[] = [
    ...discoverIntrabarSettlementRequirements({ period: "COMBINED", data: input.data }),
  ];
  for (const candidateId of M3_R5_ROUND_005_CANDIDATE_IDS) {
    const records = buildRound005CandidateRecords({ data: input.data, candidateId });
    for (const record of records) {
      const result = record.raw as R5SettlementResult;
      if (result.status !== "SETTLEMENT_AMBIGUOUS" || result.settlementAmbiguousExitCandleOpenTime === undefined) continue;
      const exitCandleOpenTime = result.settlementAmbiguousExitCandleOpenTime;
      requirements.push({
        symbol: result.signal.symbol,
        exitCandleOpenTime,
        exitCandleCloseTime: exitCandleOpenTime + INTERVAL_MS["1h"] - 1,
        settlementOnly: exitCandleOpenTime > M3_R5_RESEARCH_RANGE.endTime && exitCandleOpenTime + INTERVAL_MS["1h"] - 1 > M3_R5_RESEARCH_RANGE.endTime,
      });
    }
  }
  return deduplicateRequirements(requirements);
}

function candidateEvidence(candidateId: Round005ResearchRecord["candidateId"], records: readonly Round005ResearchRecord[]): Round005CandidateEvidence {
  const signals = records.filter((record) => record.candidateId === candidateId).map((record) => record.signal).sort((left, right) => left.signalTime - right.signalTime || symbolOrder(left.symbol) - symbolOrder(right.symbol) || directionOrder(left.direction) - directionOrder(right.direction));
  const foldIds = Object.keys(RESEARCH_FOLDS) as (keyof typeof RESEARCH_FOLDS)[];
  const folds = foldIds.map((foldId) => Object.freeze({
    foldId,
    research: Object.freeze({ range: getResearchFoldRoleRange(foldId, "RESEARCH"), records: selectRecordsForFoldRole(signals, foldId, "RESEARCH"), diagnostics: calculateResearchDiagnostics({ records: selectRecordsForFoldRole(signals, foldId, "RESEARCH"), range: getResearchFoldRoleRange(foldId, "RESEARCH") }) }),
    validation: Object.freeze({ range: getResearchFoldRoleRange(foldId, "VALIDATION"), records: selectRecordsForFoldRole(signals, foldId, "VALIDATION"), diagnostics: calculateResearchDiagnostics({ records: selectRecordsForFoldRole(signals, foldId, "VALIDATION"), range: getResearchFoldRoleRange(foldId, "VALIDATION") }) }),
  }));
  const segments = foldIds.map((foldId) => getResearchFoldRoleRange(foldId, "VALIDATION"));
  const aggregateRecords = signals.filter((signal) => segments.some((range) => signal.signalTime >= range.startTime && signal.signalTime <= range.endTime));
  const aggregateRange = Object.freeze({ startTime: segments[0]!.startTime, endTime: segments.at(-1)!.endTime });
  return Object.freeze({
    candidateId,
    fullSeenUniverse: Object.freeze({ range: M3_R5_RESEARCH_RANGE, records: Object.freeze(signals), diagnostics: calculateResearchDiagnostics({ records: signals, range: M3_R5_RESEARCH_RANGE }) }),
    folds: Object.freeze(folds),
    aggregateValidation: Object.freeze({ segments: Object.freeze(segments), records: Object.freeze(aggregateRecords), diagnostics: calculateResearchDiagnostics({ records: aggregateRecords, range: aggregateRange }) }),
    formalIdentitySha256: sha256(signals.map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`)),
    executedIdentitySha256: sha256(signals.filter((signal) => signal.status === "EXECUTED").map((signal) => `${signal.symbol}|${signal.direction}|${signal.signalTime}`)),
  });
}

function validateProvidedManifest(manifest: HistoricalManifest, errors: string[]): void {
  if (manifest.provider !== "binance-usdm-public") errors.push(`INVALID_MANIFEST_PROVIDER:${manifest.symbol}`);
  if (!/^[a-f0-9]{64}$/u.test(manifest.sha256)) errors.push(`INVALID_MANIFEST_SHA256:${manifest.symbol}`);
  if (!RESEARCH_SYMBOLS.includes(manifest.symbol)) errors.push(`INVALID_MANIFEST_SYMBOL:${String(manifest.symbol)}`);
  if (manifest.kind === "candles") {
    const candle = manifest as unknown as { source: string; timeframe: string; symbol: string };
    if (candle.source !== "/fapi/v1/klines") errors.push(`INVALID_CANDLE_MANIFEST_SOURCE:${candle.symbol}`);
    if (candle.timeframe !== "1h" && candle.timeframe !== "4h") errors.push(`INVALID_CANDLE_MANIFEST_TIMEFRAME:${candle.symbol}`);
  }
  if (manifest.kind === "funding") {
    const funding = manifest as unknown as { source: string; markPriceField: string; symbol: string };
    if (funding.source !== "/fapi/v1/fundingRate") errors.push(`INVALID_FUNDING_MANIFEST_SOURCE:${funding.symbol}`);
    if (funding.markPriceField !== "markPrice") errors.push(`INVALID_FUNDING_MARK_PRICE_FIELD:${funding.symbol}`);
  }
  if (manifest.kind === "mark-price") {
    const mark = manifest as unknown as { source: string; timeframe: string; symbol: string };
    if (mark.source !== "/fapi/v1/markPriceKlines" || mark.timeframe !== "1h") errors.push(`INVALID_MARK_PRICE_MANIFEST:${mark.symbol}`);
  }
}

function requireExactManifest(
  manifests: readonly HistoricalManifest[],
  predicate: (manifest: HistoricalManifest) => boolean,
  label: string,
  errors: string[],
): void {
  if (!manifests.some(predicate)) errors.push(`MISSING_OR_MISMATCHED_MANIFEST:${label}`);
}

type R5FallbackSegment = "base" | "settlement-tail";

function fallbackManifestRequirements(records: readonly Round005ResearchRecord[], errors: string[]): readonly Readonly<{ symbol: ResearchSymbol; segment: R5FallbackSegment }>[] {
  const requirements = new Map<string, Readonly<{ symbol: ResearchSymbol; segment: R5FallbackSegment }>>();
  for (const record of records) {
    const raw = record.raw as unknown as Readonly<{
      fundingCharges?: readonly Readonly<{ markPriceSource?: string; markPriceManifestSegment?: string }>[];
      fundingOrderAudits?: readonly Readonly<{ markPriceSource?: string; markPriceManifestSegment?: string }>[];
    }>;
    for (const item of [...(raw.fundingCharges ?? []), ...(raw.fundingOrderAudits ?? [])]) {
      if (item.markPriceSource !== "MARK_PRICE_KLINE_PRE_EVENT_CLOSE") continue;
      if (item.markPriceManifestSegment !== "base" && item.markPriceManifestSegment !== "settlement-tail") {
        errors.push(`FALLBACK_MARK_PRICE_MANIFEST_SEGMENT_MISSING:${record.signal.symbol}`);
        continue;
      }
      const requirement = { symbol: record.signal.symbol, segment: item.markPriceManifestSegment } as const;
      requirements.set(`${requirement.symbol}|${requirement.segment}`, requirement);
    }
  }
  return Object.freeze([...requirements.values()]);
}

function validateRequiredRound005ManifestCoverage(
  data: BacktestData,
  records: readonly Round005ResearchRecord[],
  errors: string[],
): void {
  const ranges = buildRound005HistoricalLoadRanges();
  const manifests = data.manifests ?? [];
  const candle = (symbol: ResearchSymbol, timeframe: "1h" | "4h", range: HistoricalRange, settlementOnly: boolean) =>
    (manifest: HistoricalManifest): boolean =>
      manifest.kind === "candles" &&
      manifest.provider === HISTORICAL_PROVIDER &&
      manifest.source === "/fapi/v1/klines" &&
      manifest.symbol === symbol &&
      manifest.timeframe === timeframe &&
      manifest.requestedStartTime === range.startTime &&
      manifest.requestedEndTime === range.endTime &&
      manifest.settlementOnly === settlementOnly &&
      /^[a-f0-9]{64}$/u.test(manifest.sha256);
  const funding = (symbol: ResearchSymbol, range: HistoricalRange, settlementOnly: boolean) =>
    (manifest: HistoricalManifest): boolean =>
      manifest.kind === "funding" &&
      manifest.provider === HISTORICAL_PROVIDER &&
      manifest.source === "/fapi/v1/fundingRate" &&
      manifest.symbol === symbol &&
      manifest.requestedStartTime === range.startTime &&
      manifest.requestedEndTime === range.endTime &&
      manifest.settlementOnly === settlementOnly &&
      manifest.markPriceField === "markPrice" &&
      /^[a-f0-9]{64}$/u.test(manifest.sha256);
  for (const symbol of RESEARCH_SYMBOLS) {
    requireExactManifest(manifests, candle(symbol, "1h", ranges.candleRange["1h"], false), `base-candles-1h:${symbol}`, errors);
    requireExactManifest(manifests, candle(symbol, "4h", ranges.candleRange["4h"], false), `base-candles-4h:${symbol}`, errors);
    requireExactManifest(manifests, funding(symbol, ranges.fundingRange, false), `base-funding:${symbol}`, errors);
    requireExactManifest(manifests, candle(symbol, "1h", ranges.settlementTail.candleRange, true), `settlement-tail-candles-1h:${symbol}`, errors);
    requireExactManifest(manifests, funding(symbol, ranges.settlementTail.fundingRange, true), `settlement-tail-funding:${symbol}`, errors);
  }
  for (const requirement of fallbackManifestRequirements(records, errors)) {
    const range = requirement.segment === "base" ? ranges.markPriceRange : ranges.settlementTail.markPriceRange;
    requireExactManifest(
      manifests,
      (manifest): boolean =>
        manifest.kind === "mark-price" &&
        manifest.provider === HISTORICAL_PROVIDER &&
        manifest.source === "/fapi/v1/markPriceKlines" &&
        manifest.symbol === requirement.symbol &&
        manifest.timeframe === "1h" &&
        manifest.requestedStartTime === range.startTime &&
        manifest.requestedEndTime === range.endTime &&
        manifest.settlementOnly === (requirement.segment === "settlement-tail") &&
        /^[a-f0-9]{64}$/u.test(manifest.sha256),
      `mark-price-${requirement.segment}:${requirement.symbol}`,
      errors,
    );
  }
  const intrabarRequirements = [...(data.intrabarSettlementRequirements ?? [])];
  for (const record of records) {
    const raw = record.raw as unknown as Readonly<{ status?: string; settlementAmbiguousExitCandleOpenTime?: number }>;
    if (raw.status !== "SETTLEMENT_AMBIGUOUS") continue;
    const exitOpen = raw.settlementAmbiguousExitCandleOpenTime;
    if (typeof exitOpen !== "number" || !Number.isSafeInteger(exitOpen)) {
      errors.push(`SETTLEMENT_AMBIGUOUS_EXIT_PROVENANCE_MISSING:${record.signal.symbol}`);
      continue;
    }
    intrabarRequirements.push({
      symbol: record.signal.symbol,
      exitCandleOpenTime: exitOpen,
      exitCandleCloseTime: exitOpen + INTERVAL_MS["1h"] - 1,
      settlementOnly: exitOpen > M3_R5_RESEARCH_RANGE.endTime,
    });
  }
  errors.push(...validateIntrabarSettlementManifestCoverage(manifests, intrabarRequirements).diagnostics);
}

function validateRound005Integrity(input: Readonly<{ data: BacktestData; records: readonly Round005ResearchRecord[]; executionSourceSha: string }>): readonly string[] {
  const errors: string[] = [];
  if (!/^[0-9a-f]{40}$/u.test(input.executionSourceSha)) errors.push("INVALID_EXECUTION_SOURCE_SHA");
  if (!Number.isSafeInteger(input.data.serverTime)) errors.push("INVALID_STUDY_SERVER_TIME");
  for (const manifest of input.data.manifests ?? []) validateProvidedManifest(manifest, errors);
  const seen = new Set<string>();
  for (const record of input.records) {
    const key = identity(record);
    if (seen.has(key)) errors.push(`DUPLICATE_IDENTITY:${key}`);
    seen.add(key);
    if (record.candidateId === "R5-H17-FUNDING-REVERSAL") errors.push("H17_MUST_NOT_APPEAR_IN_PERFORMANCE_EVIDENCE");
    if (record.signal.signalTime < M3_R5_RESEARCH_RANGE.startTime || record.signal.signalTime > M3_R5_RESEARCH_RANGE.endTime) errors.push(`SIGNAL_OUTSIDE_RESEARCH_RANGE:${key}`);
  }
  if (input.records.some((record) => record.candidateId !== M3_R5_ROUND_005_CONTROL_ID && !M3_R5_ROUND_005_CANDIDATE_IDS.some((candidate) => candidate === record.candidateId))) errors.push("UNKNOWN_CANDIDATE_ID");
  validateRequiredRound005ManifestCoverage(input.data, input.records, errors);
  return Object.freeze([...new Set(errors)]);
}

export function validateRound005EvidenceIntegrity(input: Readonly<{ data: BacktestData; records: readonly Round005ResearchRecord[]; executionSourceSha: string }>): Readonly<{ passed: boolean; errors: readonly string[] }> {
  const errors = validateRound005Integrity(input);
  return Object.freeze({ passed: errors.length === 0, errors });
}

export function buildRound005AuditArtifact(records: readonly Round005ResearchRecord[]): Round005AuditArtifact {
  const decisions: Record<string, Readonly<Record<string, unknown>>[]> = {};
  const outcomes: Record<string, Readonly<Record<string, unknown>>[]> = {};
  for (const record of [...records].sort(recordSort)) {
    decisions[record.candidateId] ??= [];
    decisions[record.candidateId]!.push({ signalTime: record.signal.signalTime, symbol: record.signal.symbol, direction: record.signal.direction, status: record.raw instanceof Object && "status" in record.raw ? record.raw.status : record.signal.status });
    if (record.raw.status === "EXECUTED") {
      outcomes[record.candidateId] ??= [];
      outcomes[record.candidateId]!.push({ signalTime: record.signal.signalTime, symbol: record.signal.symbol, direction: record.signal.direction, entryTime: record.signal.entryTime, exitTime: record.signal.exitTime, grossR: record.signal.grossR, feeR: record.signal.feeR, fundingR: record.signal.fundingR, netR: record.signal.netR });
    }
  }
  return deepFreeze({ schemaVersion: M3_R5_ROUND_005_AUDIT_SCHEMA_VERSION, decisions, outcomes });
}

export function buildRound005PerformanceReport(input: Readonly<{
  data: BacktestData;
  executionSourceSha: string;
  controlReport: BacktestReport;
  controlRecords: readonly Round005ResearchRecord[];
  candidateRecords: readonly Round005ResearchRecord[];
  performanceLockTriggered?: boolean;
}>): Round005Report {
  validateM3R5Round005MachineRecord();
  validateM3R5Round005Plan();
  const records = Object.freeze([...input.controlRecords, ...input.candidateRecords].sort(recordSort));
  const integrityErrors = validateRound005Integrity({ data: input.data, records, executionSourceSha: input.executionSourceSha });
  const control = candidateEvidence(M3_R5_ROUND_005_CONTROL_ID, records);
  const candidates = M3_R5_ROUND_005_CANDIDATE_IDS.map((candidateId) => candidateEvidence(candidateId, records));
  return deepFreeze({
    schemaVersion: M3_R5_ROUND_005_SCHEMA_VERSION,
    researchRoundId: M3_R5_RESEARCH_ROUND_ID,
    executionSourceSha: input.executionSourceSha,
    selectionGateSha256: M3_R5_ROUND_005_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R5_ROUND_005_PLAN_SHA256,
    inheritedRound004SelectionGateSha256: M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    controlReportSchemaVersion: "m3-b-report-004",
    dataClassification: M3_R5_DATA_CLASSIFICATION,
    researchUniverse: M3_R5_RESEARCH_RANGE,
    studyServerTime: input.data.serverTime ?? 0,
    performanceLock: M3_R5_ROUND_005_PERFORMANCE_LOCK,
    performanceLockTriggered: input.performanceLockTriggered === true,
    evidenceStatus: integrityErrors.length === 0 && input.controlReport.overallAcceptance.status !== "INCOMPLETE" ? "COMPLETE" : "INCOMPLETE",
    integrityErrors,
    control,
    candidates,
    candidateRegistry: M3_R5_ROUND_005_CANDIDATE_IDS,
    excludedCandidates: M3_R5_ROUND_005_MACHINE_RECORD.excludedCandidates,
    applicableHardGateIdentities: M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
    h17Qualification: { status: "DATA_NOT_AVAILABLE", performanceEligible: false, jsonSha256: M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256, markdownSha256: M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256 },
    selectionApplied: false,
    selectedCandidateId: null,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    disclaimer: M3_R5_ROUND_005_CONTROL_DISCLAIMER,
  });
}

export function buildRound005ExecutionArtifacts(input: Readonly<{
  report: Round005Report;
  records: readonly Round005ResearchRecord[];
}>): Round005ExecutionArtifacts {
  const auditArtifact = buildRound005AuditArtifact(input.records);
  const summaryJson = stableStringify(input.report);
  const auditJson = stableStringify(auditArtifact);
  const resultsMarkdown = [
    "# M3-R5 Round-005 Performance Results",
    "",
    `- researchRoundId: ${input.report.researchRoundId}`,
    `- executionSourceSha: ${input.report.executionSourceSha}`,
    `- evidenceStatus: ${input.report.evidenceStatus}`,
    `- performanceLockTriggered: ${input.report.performanceLockTriggered}`,
    "- selectionApplied: false",
    "- selectedCandidateId: null",
    "",
    "This artifact is produced only by the explicitly authorized future performance command. No Round-005 performance was run during B.2 implementation.",
    "",
  ].join("\n");
  return Object.freeze({ report: input.report, auditArtifact, summaryJson, auditJson, resultsMarkdown });
}

export function assertRound005PerformancePreflight(input: Round005Preflight): void {
  if (!input.confirmAuthoritativePerformance) throw new Error("--confirm-authoritative-performance is required before any network access.");
  if (!/^[0-9a-f]{40}$/u.test(input.sourceSha) || input.sourceSha !== input.headSha) throw new Error("Round-005 execution source SHA must exactly match HEAD.");
  if (input.round !== M3_R5_RESEARCH_ROUND_ID) throw new Error("Round-005 researchRoundId mismatch.");
  if (input.gateSha !== M3_R5_ROUND_005_SELECTION_GATE_SHA256) throw new Error("Round-005 Gate SHA mismatch.");
  if (input.planSha !== M3_R5_ROUND_005_PLAN_SHA256) throw new Error("Round-005 Plan SHA mismatch.");
  if (!input.cleanWorktree) throw new Error("Round-005 authoritative execution requires a clean git worktree.");
  if (input.existingOutputArtifacts.length > 0) throw new Error("Round-005 authoritative output already exists; refusing overwrite.");
  if (input.gateValidatorPass !== true || input.planValidatorPass !== true) throw new Error("Round-005 frozen validator failed.");
}

export function readRound005GitState(): Readonly<{ headSha: string; cleanWorktree: boolean }> {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  return Object.freeze({ headSha, cleanWorktree: status.length === 0 });
}

export function existingRound005OutputArtifacts(): readonly string[] {
  return Object.freeze(M3_R5_ROUND_005_OUTPUT_PATHS.filter((outputPath) => existsSync(outputPath)));
}

export async function executeRound005Authoritative(input: Readonly<{ loader?: Round005HistoricalLoader; executionSourceSha: string }>): Promise<Round005ExecutionArtifacts> {
  const loader = input.loader ?? new BinanceHistoricalDataLoader();
  const ranges = buildRound005HistoricalLoadRanges();
  const study = await loader.loadStudyData({ ...ranges, policy: "bt-policy-003" });
  const initialData = toBacktestData(study);
  const requirements = discoverRound005IntrabarRequirements({ data: initialData });
  const windows = await loader.loadIntrabarSettlementWindows(requirements, study.serverTime);
  const data = appendRound005IntrabarWindows(initialData, windows, requirements);
  const control = buildRound005ControlRecords(data);
  const candidateRecords = M3_R5_ROUND_005_CANDIDATE_IDS.flatMap((candidateId) => buildRound005CandidateRecords({ data, candidateId }));
  const report = buildRound005PerformanceReport({ data, executionSourceSha: input.executionSourceSha, controlReport: control.report, controlRecords: control.records, candidateRecords, performanceLockTriggered: true });
  return buildRound005ExecutionArtifacts({ report, records: [...control.records, ...candidateRecords] });
}

export { M3_R5_ROUND_005_PLAN };
