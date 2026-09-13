import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync, fsyncSync, openSync, closeSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import type { BTCRegime, StrategyScoreBreakdown } from "../strategy/types.ts";
import type { R13ForwardLabel } from "./m3-r13-round-013-labels.ts";
import type { R13HorizonHours } from "./m3-r13-round-013-protocol.ts";
import type { R13Observation } from "./m3-r13-round-013-performance.ts";
import { calculateR13Drawdown } from "./r13-drawdown.ts";
import { streamR14Observations } from "./m3-r14-round-014-observations.ts";
import { foldForR18DecisionTime, canonicalR18Identity, type R18StructuralObservationRecord } from "./m3-r18-round-018-replay.ts";
import {
  ROUND_018_ACCEPTED_SOURCE,
  ROUND_018_CANDIDATE_RULE_ID,
  ROUND_018_FOLDS,
  ROUND_018_PERFORMANCE_GATES,
  ROUND_018_PRIMARY_HORIZON_HOURS,
  ROUND_018_REGIMES,
  ROUND_018_RESEARCH_ROUND_ID,
  ROUND_018_SCORE_COMPONENTS,
  ROUND_018_UNIVERSE,
  ROUND_018_OBSERVATION_SHA256,
} from "./m3-r18-round-018-protocol.ts";
import {
  deriveR18PerformanceExecutionCount,
  foldR18CheckpointPath,
  finalR18PerformanceCheckpointPath,
  readR18Checkpoint,
  updateR18PerformanceLedger,
  validateR18CompletedCheckpoints,
  validateR18PerformanceLedger,
  writeR18CheckpointAtomic,
  type R18ExecutionRecord,
  type R18PerformanceExecutionLedger,
} from "./m3-r18-round-018-performance-ledger.ts";
import { stableStringify } from "./utils.ts";

export const R18_PERFORMANCE_STAGE_SOURCE = "2121d5191dd0758fabbfbc9c8d5ca5b808799d66" as const;
export const R18_DESIGN_SOURCE = "feec11151b334a14754b1f720972c6e2b198960a" as const;
export const R18_PERFORMANCE_REPORT_SCHEMA_VERSION = "m3-r18-round-018-performance-report-001" as const;
export const R18_PERFORMANCE_AUDIT_SCHEMA_VERSION = "m3-r18-round-018-performance-audit-001" as const;
export const R18_ARTIFACT_HASH_METHOD = "SHA256_UTF8_BYTES" as const;

export const R18_PERFORMANCE_OUTPUT_PATHS = Object.freeze({
  results: "docs/M3_R18_ROUND_018_RESULTS.md",
  summary: "docs/evidence/M3_R18_ROUND_018_SUMMARY.json",
  audit: "docs/evidence/M3_R18_ROUND_018_AUDIT.json",
  selectionJson: "docs/evidence/M3_R18_ROUND_018_SELECTION.json",
  selectionMarkdown: "docs/evidence/M3_R18_ROUND_018_SELECTION.md",
} as const);

const HORIZONS = Object.freeze([4, 8, 12, 24] as const);
type R18Horizon = (typeof HORIZONS)[number];
type R18HorizonKey = `${R18Horizon}`;
export type R18PrimaryMetric = Readonly<{
  horizonHours: R18Horizon;
  count: number;
  meanNetForwardAtr: number | null;
  profitFactor: number | null;
  cumulativeNetForwardAtr: number;
  maximumDrawdownNetAtr: number;
  meanNetForwardAtrCostStress: number | null;
  costStressProfitFactor: number | null;
  latencyStressMeanNetForwardAtr: number | null;
  latencyStressProfitFactor: number | null;
}>;

type R18MetricValue = Readonly<{
  netForwardAtr: number;
  costStress: number;
  latencyStress: number;
}>;

export type R18EconomicMetricRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: "LONG" | "SHORT";
  horizons: Readonly<Record<R18HorizonKey, R18MetricValue | null>>;
}>;

export type R18FoldCheckpointPayload = Readonly<{
  foldId: typeof ROUND_018_FOLDS[number];
  controlRows: readonly R18EconomicMetricRow[];
  candidateRows: readonly R18EconomicMetricRow[];
}>;

export type R18PerformanceObservation = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: "LONG" | "SHORT";
  candidateIncluded: boolean;
  btcRegime: BTCRegime;
  foldId: typeof ROUND_018_FOLDS[number];
  labels: Readonly<Record<R13HorizonHours, R13ForwardLabel>>;
  latencyStressLabels: Readonly<Record<R13HorizonHours, R13ForwardLabel>>;
}>;

export type R18FoldPerformance = Readonly<{
  foldId: typeof ROUND_018_FOLDS[number];
  control: R18PrimaryMetric;
  candidate: R18PrimaryMetric;
  candidateMeanAtLeastControl: boolean;
  candidateMeanPositive: boolean;
}>;

export type R18PerformanceGateResult = Readonly<{
  id: typeof ROUND_018_PERFORMANCE_GATES[number];
  hardGate: true;
  passed: boolean;
  observed: number | boolean | null | Readonly<Record<string, number | boolean | null>>;
  requirement: string;
}>;

export type R18Selection = Readonly<{
  selectionExecuted: true;
  selectionAlgorithmApplied: false;
  eligibleCandidateIds: readonly (typeof ROUND_018_CANDIDATE_RULE_ID)[];
  selectedCandidateId: typeof ROUND_018_CANDIDATE_RULE_ID | null;
  finalDecision: "NO ROBUST COMPONENT-CONSENSUS EDGE — ROUND-018" | "ROUND-018 HISTORICAL COMPONENT-CONSENSUS DEVELOPMENT CANDIDATE";
}>;

export type R18PerformanceReport = Readonly<{
  schemaVersion: typeof R18_PERFORMANCE_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof ROUND_018_RESEARCH_ROUND_ID;
  classification: "HISTORICAL_DEVELOPMENT_PERFORMANCE";
  executionId: string;
  performanceExecutionSourceSha: typeof R18_PERFORMANCE_STAGE_SOURCE;
  acceptedDesignSourceSha: typeof R18_DESIGN_SOURCE;
  performanceLock: "ROUND-018-FIRST-RESULT-LOCK";
  performanceLockTriggered: true;
  performanceExecutionCount: number;
  continuation: boolean;
  reusedCompletedCheckpoints: number;
  recomputedCompletedCheckpoints: number;
  observationDataSha256: string;
  compactStructuralSha256: string;
  structuralManifestSha256: string;
  preflightReportSha256: string;
  controlValidationEconomicCount: number;
  candidateValidationEconomicCount: number;
  controlH4: R18PrimaryMetric;
  candidateH4: R18PrimaryMetric;
  deltaMeanNetForwardAtr: number | null;
  folds: readonly R18FoldPerformance[];
  positiveIncrementalFolds: number;
  positiveAbsoluteCandidateFolds: number;
  secondaryHorizons: Readonly<Record<"H8" | "H12" | "H24", Readonly<{ control: R18PrimaryMetric; candidate: R18PrimaryMetric }>>>;
  gates: readonly R18PerformanceGateResult[];
  selection: R18Selection;
  governance: Readonly<{
    economicFieldsRead: true;
    economicValuesCalculated: true;
    economicValuesInspected: true;
    newMarketDataFetched: false;
    productionUnchanged: true;
    baseline002Status: "NOT_FROZEN";
    m3JStatus: "BLOCKED";
    m4Status: "NOT_STARTED";
    automaticTrading: false;
  }>;
}>;

export type R18ExecutionArtifacts = Readonly<{
  report: R18PerformanceReport;
  resultsMarkdown: string;
  summaryJson: string;
  auditJson: string;
  selectionJson: string;
  selectionMarkdown: string;
  hashes: Readonly<{
    resultSha256: string;
    summarySha256: string;
    auditSha256: string;
    selectionSha256: string;
  }>;
}>;

function sha256Utf8(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function profitFactor(values: readonly number[]): number | null {
  const positive = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negative = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return negative === 0 ? null : positive / negative;
}

function metricValue(row: R18EconomicMetricRow, horizon: R18Horizon): R18MetricValue | null {
  return row.horizons[String(horizon) as R18HorizonKey];
}

function metricFromRows(rows: readonly R18EconomicMetricRow[], horizon: R18Horizon): R18PrimaryMetric {
  const values = rows.map((row) => metricValue(row, horizon)).filter((value): value is R18MetricValue => value !== null);
  const primaryValues = values.map((value) => value.netForwardAtr);
  const costValues = values.map((value) => value.costStress);
  const latencyValues = values.map((value) => value.latencyStress);
  const drawdownRows: Array<{ decisionTime: number; symbol: string; direction: "LONG" | "SHORT"; netForwardAtr: number }> = [];
  for (const row of rows) {
    const value = metricValue(row, horizon);
    if (value) drawdownRows.push({ decisionTime: row.decisionTime, symbol: row.symbol, direction: row.direction, netForwardAtr: value.netForwardAtr });
  }
  const drawdown = calculateR13Drawdown(drawdownRows);
  return Object.freeze({
    horizonHours: horizon,
    count: primaryValues.length,
    meanNetForwardAtr: mean(primaryValues),
    profitFactor: profitFactor(primaryValues),
    cumulativeNetForwardAtr: primaryValues.reduce((sum, value) => sum + value, 0),
    maximumDrawdownNetAtr: drawdown.maximumDrawdownAtr,
    meanNetForwardAtrCostStress: mean(costValues),
    costStressProfitFactor: profitFactor(costValues),
    latencyStressMeanNetForwardAtr: mean(latencyValues),
    latencyStressProfitFactor: profitFactor(latencyValues),
  });
}

export function summarizeR18MetricRows(rows: readonly R18EconomicMetricRow[], horizon: R18Horizon): R18PrimaryMetric {
  return metricFromRows(rows, horizon);
}

function foldPerformance(payload: R18FoldCheckpointPayload): R18FoldPerformance {
  const control = metricFromRows(payload.controlRows, ROUND_018_PRIMARY_HORIZON_HOURS);
  const candidate = metricFromRows(payload.candidateRows, ROUND_018_PRIMARY_HORIZON_HOURS);
  return Object.freeze({
    foldId: payload.foldId,
    control,
    candidate,
    candidateMeanAtLeastControl: candidate.meanNetForwardAtr !== null && control.meanNetForwardAtr !== null && candidate.meanNetForwardAtr >= control.meanNetForwardAtr,
    candidateMeanPositive: candidate.meanNetForwardAtr !== null && candidate.meanNetForwardAtr > 0,
  });
}

function exactG15Pass(candidate: R18PrimaryMetric, control: R18PrimaryMetric): boolean {
  return candidate.maximumDrawdownNetAtr >= control.maximumDrawdownNetAtr - (0.05 * Math.abs(control.maximumDrawdownNetAtr));
}

export function evaluateR18PerformanceGates(input: Readonly<{ control: R18PrimaryMetric; candidate: R18PrimaryMetric; folds: readonly R18FoldPerformance[] }>): readonly R18PerformanceGateResult[] {
  const delta = input.candidate.meanNetForwardAtr === null || input.control.meanNetForwardAtr === null
    ? null
    : input.candidate.meanNetForwardAtr - input.control.meanNetForwardAtr;
  const positiveIncrementalFolds = input.folds.filter((fold) => fold.candidateMeanAtLeastControl).length;
  const positiveAbsoluteFolds = input.folds.filter((fold) => fold.candidateMeanPositive).length;
  const gates: R18PerformanceGateResult[] = [
    { id: "G08_ABSOLUTE_H4_EDGE", hardGate: true, passed: input.candidate.meanNetForwardAtr !== null && input.candidate.meanNetForwardAtr > 0, observed: input.candidate.meanNetForwardAtr, requirement: "candidate.meanNetForwardAtr > 0" },
    { id: "G09_H4_PROFIT_FACTOR", hardGate: true, passed: input.candidate.profitFactor !== null && input.candidate.profitFactor >= 1.10, observed: input.candidate.profitFactor, requirement: "candidate.profitFactor >= 1.10" },
    { id: "G10_INCREMENTAL_H4_EDGE", hardGate: true, passed: delta !== null && delta >= 0.05, observed: delta, requirement: "candidate.meanNetForwardAtr - control.meanNetForwardAtr >= 0.05" },
    { id: "G11_FOLD_INCREMENTAL_ROBUSTNESS", hardGate: true, passed: positiveIncrementalFolds >= 4, observed: positiveIncrementalFolds, requirement: "candidate mean >= control mean in >= 4/6 validation folds" },
    { id: "G12_FOLD_ABSOLUTE_ROBUSTNESS", hardGate: true, passed: positiveAbsoluteFolds >= 4, observed: positiveAbsoluteFolds, requirement: "candidate mean > 0 in >= 4/6 validation folds" },
    { id: "G13_COST_STRESS", hardGate: true, passed: input.candidate.meanNetForwardAtrCostStress !== null && input.candidate.meanNetForwardAtrCostStress >= 0 && input.candidate.costStressProfitFactor !== null && input.candidate.costStressProfitFactor >= 1.05, observed: Object.freeze({ mean: input.candidate.meanNetForwardAtrCostStress, profitFactor: input.candidate.costStressProfitFactor }), requirement: "candidate cost-stress mean >= 0 and PF >= 1.05" },
    { id: "G14_LATENCY_STRESS", hardGate: true, passed: input.candidate.latencyStressMeanNetForwardAtr !== null && input.candidate.latencyStressMeanNetForwardAtr >= 0 && input.candidate.latencyStressProfitFactor !== null && input.candidate.latencyStressProfitFactor >= 1.05, observed: Object.freeze({ mean: input.candidate.latencyStressMeanNetForwardAtr, profitFactor: input.candidate.latencyStressProfitFactor }), requirement: "candidate latency-stress mean >= 0 and PF >= 1.05" },
    { id: "G15_DRAWDOWN_NON_DEGRADATION", hardGate: true, passed: exactG15Pass(input.candidate, input.control), observed: Object.freeze({ candidateMaximumDrawdownNetAtr: input.candidate.maximumDrawdownNetAtr, controlMaximumDrawdownNetAtr: input.control.maximumDrawdownNetAtr }), requirement: "candidate maximum drawdown is no worse than control by more than 5% of abs(control maximum drawdown)" },
  ];
  return Object.freeze(gates);
}

export function buildR18Selection(gates: readonly R18PerformanceGateResult[]): R18Selection {
  const eligible = gates.length === 8 && gates.every((gate) => gate.passed);
  return Object.freeze({
    selectionExecuted: true,
    selectionAlgorithmApplied: false,
    eligibleCandidateIds: eligible ? Object.freeze([ROUND_018_CANDIDATE_RULE_ID]) : Object.freeze([]),
    selectedCandidateId: eligible ? ROUND_018_CANDIDATE_RULE_ID : null,
    finalDecision: eligible ? "ROUND-018 HISTORICAL COMPONENT-CONSENSUS DEVELOPMENT CANDIDATE" : "NO ROBUST COMPONENT-CONSENSUS EDGE — ROUND-018",
  });
}

export function isR18StructuralRecordForPerformance(record: unknown): record is R18StructuralObservationRecord {
  if (typeof record !== "object" || record === null) return false;
  const value = record as Partial<R18StructuralObservationRecord>;
  const decisionTime = value.decisionTime;
  const symbol = value.symbol;
  const direction = value.direction;
  if (typeof decisionTime !== "number" || typeof symbol !== "string" || typeof direction !== "string") return false;
  if (value.schemaVersion !== "m3-r18-round-018-structural-observation-001"
    || value.replayStatus !== "BASELINE_FORMAL"
    || value.controlIncluded !== true
    || !ROUND_018_UNIVERSE.includes(symbol as typeof ROUND_018_UNIVERSE[number])
    || !["LONG", "SHORT"].includes(direction ?? "")
    || typeof value.observationId !== "string"
    || !Number.isSafeInteger(decisionTime)
    || decisionTime < Date.parse("2023-01-01T00:00:00.000Z")
    || decisionTime > Date.parse("2026-08-15T23:59:59.999Z")
    || value.observationId !== canonicalR18Identity(decisionTime, symbol as ResearchSymbol, direction as "LONG" | "SHORT")
    || value.formalSource?.acceptedSourceCommit !== ROUND_018_ACCEPTED_SOURCE
    || value.formalSource.sourcePath !== "src/lib/strategy/engine.ts"
    || value.labelSource?.sourceStatus !== "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE"
    || value.labelSource.sourcePath !== "docs/research/round-014-observation-freeze.json"
    || value.labelSource.sourceSha256 !== ROUND_018_OBSERVATION_SHA256
    || !ROUND_018_REGIMES.includes(value.btcRegime as typeof ROUND_018_REGIMES[number])
    || !ROUND_018_SCORE_COMPONENTS.every((component) => typeof value.scoreBreakdown?.[component] === "number" && Number.isFinite(value.scoreBreakdown[component]))
    || value.candidateIncluded !== ROUND_018_SCORE_COMPONENTS.every((component) => (value.scoreBreakdown as StrategyScoreBreakdown)[component] > 0)
    || value.candidateRuleId !== ROUND_018_CANDIDATE_RULE_ID) return false;
  if (value.foldId !== foldForR18DecisionTime(decisionTime)) return false;
  return ["EXECUTED", "NO_ENTRY", "DATA_INCOMPLETE", "PERIOD_END_CENSORED"].includes(value.h4LabelStatus ?? "");
}

export async function loadR18StructuralIndex(filePath: string): Promise<ReadonlyMap<string, R18StructuralObservationRecord>> {
  const index = new Map<string, R18StructuralObservationRecord>();
  const input = createReadStream(path.resolve(filePath), { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (line.length === 0) throw new Error(`R18 structural line ${lineNumber} is empty.`);
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch (error) { throw new Error(`R18 structural line ${lineNumber} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
      if (!isR18StructuralRecordForPerformance(parsed)) throw new Error(`R18 structural record ${lineNumber} failed exact identity validation.`);
      const record = parsed as R18StructuralObservationRecord;
      if (index.has(record.observationId)) throw new Error(`R18 structural duplicate identity: ${record.observationId}`);
      index.set(record.observationId, record);
    }
  } finally {
    lines.close();
    input.destroy();
  }
  return index;
}

function requireFinite(value: number | null, label: string): number {
  if (value === null || !Number.isFinite(value)) throw new Error(`R18 ${label} is missing or non-finite for an EXECUTED label.`);
  return value;
}

function metricRowFromObservation(observation: R13Observation): R18EconomicMetricRow {
  const horizons = {} as Record<R18HorizonKey, R18MetricValue | null>;
  for (const horizon of HORIZONS) {
    const label = observation.labels[horizon];
    const latency = observation.latencyStressLabels[horizon];
    if (label.status === "DATA_INCOMPLETE" || latency.status === "DATA_INCOMPLETE") throw new Error(`R18 DATA_INCOMPLETE label encountered for ${observation.observationId} H${horizon}.`);
    if (label.status !== "EXECUTED") {
      horizons[String(horizon) as R18HorizonKey] = null;
      continue;
    }
    if (latency.status !== "EXECUTED") throw new Error(`R18 latency stress label status mismatch for ${observation.observationId} H${horizon}.`);
    horizons[String(horizon) as R18HorizonKey] = Object.freeze({
      netForwardAtr: requireFinite(label.netForwardAtr, `H${horizon} netForwardAtr`),
      costStress: requireFinite(label.netForwardAtrCostStress, `H${horizon} netForwardAtrCostStress`),
      latencyStress: requireFinite(latency.netForwardAtr, `H${horizon} latencyStressNetForwardAtr`),
    });
  }
  return Object.freeze({ observationId: observation.observationId, decisionTime: observation.decisionTime, symbol: observation.symbol, direction: observation.direction, horizons: Object.freeze(horizons) });
}

export function buildR18EconomicMetricRow(observation: R13Observation): R18EconomicMetricRow {
  return metricRowFromObservation(observation);
}

function validateJoinedIdentity(structural: R18StructuralObservationRecord, observation: R13Observation): void {
  if (observation.observationId !== structural.observationId
    || observation.decisionTime !== structural.decisionTime
    || observation.symbol !== structural.symbol
    || observation.direction !== structural.direction
    || observation.labels[ROUND_018_PRIMARY_HORIZON_HOURS].status !== structural.h4LabelStatus) throw new Error(`R18 exact economic join identity mismatch for ${structural.observationId}.`);
}

export async function collectR18FoldRows(input: Readonly<{ structuralIndex: ReadonlyMap<string, R18StructuralObservationRecord>; observationFile: string; foldIds: readonly (typeof ROUND_018_FOLDS[number])[] }>): Promise<ReadonlyMap<typeof ROUND_018_FOLDS[number], readonly R18PerformanceObservation[]>> {
  const wanted = new Set(input.foldIds);
  const rows = new Map<typeof ROUND_018_FOLDS[number], R18PerformanceObservation[]>();
  for (const foldId of input.foldIds) rows.set(foldId, []);
  const matched = new Set<string>();
  for await (const observation of streamR14Observations(path.resolve(input.observationFile))) {
    const structural = input.structuralIndex.get(observation.observationId);
    if (!structural) continue;
    if (matched.has(observation.observationId)) throw new Error(`R18 duplicate economic join identity: ${observation.observationId}`);
    matched.add(observation.observationId);
    validateJoinedIdentity(structural, observation);
    if (structural.foldId === null || !wanted.has(structural.foldId)) continue;
    rows.get(structural.foldId)!.push(Object.freeze({
      observationId: observation.observationId,
      decisionTime: observation.decisionTime,
      symbol: observation.symbol,
      direction: observation.direction,
      candidateIncluded: structural.candidateIncluded,
      btcRegime: structural.btcRegime,
      foldId: structural.foldId,
      labels: observation.labels,
      latencyStressLabels: observation.latencyStressLabels,
    }));
  }
  if (matched.size !== input.structuralIndex.size) throw new Error(`R18 exact economic join is incomplete: matched ${matched.size} of ${input.structuralIndex.size} structural identities.`);
  return new Map([...rows.entries()].map(([foldId, values]) => [foldId, Object.freeze(values)] as const));
}

function checkpointPayloadFromRows(foldId: typeof ROUND_018_FOLDS[number], observations: readonly R18PerformanceObservation[]): R18FoldCheckpointPayload {
  const controlRows = observations.map((observation) => metricRowFromObservation(observation as unknown as R13Observation));
  const candidateRows = observations.filter((observation) => observation.candidateIncluded).map((observation) => metricRowFromObservation(observation as unknown as R13Observation));
  return Object.freeze({ foldId, controlRows: Object.freeze(controlRows), candidateRows: Object.freeze(candidateRows) });
}

function validateMetricRows(rows: readonly R18EconomicMetricRow[], name: string): void {
  const identities = new Set<string>();
  for (const row of rows) {
    if (identities.has(row.observationId)) throw new Error(`R18 ${name} checkpoint contains a duplicate identity.`);
    identities.add(row.observationId);
    for (const horizon of HORIZONS) {
      const value = metricValue(row, horizon);
      if (value && (!Number.isFinite(value.netForwardAtr) || !Number.isFinite(value.costStress) || !Number.isFinite(value.latencyStress))) throw new Error(`R18 ${name} checkpoint contains a non-finite economic value.`);
    }
  }
}

function validateFoldPayload(payload: R18FoldCheckpointPayload, foldId: typeof ROUND_018_FOLDS[number]): R18FoldCheckpointPayload {
  if (payload.foldId !== foldId) throw new Error(`R18 fold checkpoint payload identity mismatch for ${foldId}.`);
  validateMetricRows(payload.controlRows, "control");
  validateMetricRows(payload.candidateRows, "candidate");
  const control = new Set(payload.controlRows.map((row) => row.observationId));
  if (payload.candidateRows.some((row) => !control.has(row.observationId))) throw new Error(`R18 candidate checkpoint is not a subset of control for ${foldId}.`);
  return payload;
}

function readFoldCheckpoint(executionDirectory: string, foldId: typeof ROUND_018_FOLDS[number], inputHashes: Readonly<Record<string, string>>): R18FoldCheckpointPayload {
  const envelope = readR18Checkpoint<R18FoldCheckpointPayload>(foldR18CheckpointPath(executionDirectory, foldId), Object.freeze({ ...inputHashes, foldId }));
  if (envelope.kind !== "FOLD" || envelope.key !== foldId) throw new Error(`R18 fold checkpoint identity is invalid for ${foldId}.`);
  return validateFoldPayload(envelope.payload, foldId);
}

function existingDirectoryHasData(directory: string): boolean {
  return existsSync(directory) && readdirSync(directory).length > 0;
}

function buildReport(input: Readonly<{ executionId: string; ledger: R18PerformanceExecutionLedger; continuation: boolean; reusedCompletedCheckpoints: number; recomputedCompletedCheckpoints: number; payloads: readonly R18FoldCheckpointPayload[]; inputHashes: Readonly<Record<string, string>> }>): R18PerformanceReport {
  const controlRows = input.payloads.flatMap((payload) => payload.controlRows);
  const candidateRows = input.payloads.flatMap((payload) => payload.candidateRows);
  const controlH4 = metricFromRows(controlRows, 4);
  const candidateH4 = metricFromRows(candidateRows, 4);
  const folds = Object.freeze(input.payloads.map(foldPerformance));
  const gates = evaluateR18PerformanceGates({ control: controlH4, candidate: candidateH4, folds });
  const selection = buildR18Selection(gates);
  const secondaryHorizons = Object.freeze({
    H8: Object.freeze({ control: metricFromRows(controlRows, 8), candidate: metricFromRows(candidateRows, 8) }),
    H12: Object.freeze({ control: metricFromRows(controlRows, 12), candidate: metricFromRows(candidateRows, 12) }),
    H24: Object.freeze({ control: metricFromRows(controlRows, 24), candidate: metricFromRows(candidateRows, 24) }),
  });
  return Object.freeze({
    schemaVersion: R18_PERFORMANCE_REPORT_SCHEMA_VERSION,
    researchRoundId: ROUND_018_RESEARCH_ROUND_ID,
    classification: "HISTORICAL_DEVELOPMENT_PERFORMANCE",
    executionId: input.executionId,
    performanceExecutionSourceSha: R18_PERFORMANCE_STAGE_SOURCE,
    acceptedDesignSourceSha: R18_DESIGN_SOURCE,
    performanceLock: "ROUND-018-FIRST-RESULT-LOCK",
    performanceLockTriggered: true,
    performanceExecutionCount: deriveR18PerformanceExecutionCount(input.ledger),
    continuation: input.continuation,
    reusedCompletedCheckpoints: input.reusedCompletedCheckpoints,
    recomputedCompletedCheckpoints: input.recomputedCompletedCheckpoints,
    observationDataSha256: input.inputHashes.r14ObservationDataSha256!,
    compactStructuralSha256: input.inputHashes.compactStructuralSha256!,
    structuralManifestSha256: input.inputHashes.structuralManifestSha256!,
    preflightReportSha256: input.inputHashes.preflightReportSha256!,
    controlValidationEconomicCount: controlH4.count,
    candidateValidationEconomicCount: candidateH4.count,
    controlH4,
    candidateH4,
    deltaMeanNetForwardAtr: candidateH4.meanNetForwardAtr === null || controlH4.meanNetForwardAtr === null ? null : candidateH4.meanNetForwardAtr - controlH4.meanNetForwardAtr,
    folds,
    positiveIncrementalFolds: folds.filter((fold) => fold.candidateMeanAtLeastControl).length,
    positiveAbsoluteCandidateFolds: folds.filter((fold) => fold.candidateMeanPositive).length,
    secondaryHorizons,
    gates,
    selection,
    governance: Object.freeze({ economicFieldsRead: true, economicValuesCalculated: true, economicValuesInspected: true, newMarketDataFetched: false, productionUnchanged: true, baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED", automaticTrading: false }),
  });
}

export async function executeR18Performance(input: Readonly<{ root: string; executionDirectory: string; executionLock: R18ExecutionRecord; executionLedger: R18PerformanceExecutionLedger; continuation: boolean; structuralIndex: ReadonlyMap<string, R18StructuralObservationRecord>; observationFile: string; inputHashes: Readonly<Record<string, string>> }>): Promise<Readonly<{ report: R18PerformanceReport; ledger: R18PerformanceExecutionLedger; reusedCompletedCheckpoints: number; recomputedCompletedCheckpoints: number }>> {
  const root = path.resolve(input.root);
  validateR18PerformanceLedger(input.executionLedger);
  if (input.executionLedger.executions[0]!.executionId !== input.executionLock.executionId) throw new Error("R18 execution lock does not match the round-global ledger.");
  validateR18CompletedCheckpoints({ root, ledger: input.executionLedger, executionDirectory: input.executionDirectory, inputHashes: input.inputHashes, continuation: input.continuation });
  if (!input.continuation && existingDirectoryHasData(input.executionDirectory)) throw new Error("R18 initial authoritative execution directory is not empty.");

  let ledger = input.executionLedger;
  const payloads = new Map<typeof ROUND_018_FOLDS[number], R18FoldCheckpointPayload>();
  let reusedCompletedCheckpoints = 0;
  let recomputedCompletedCheckpoints = 0;
  for (const foldId of ROUND_018_FOLDS) {
    const checkpoint = foldR18CheckpointPath(input.executionDirectory, foldId);
    if (!existsSync(checkpoint)) continue;
    const payload = readFoldCheckpoint(input.executionDirectory, foldId, input.inputHashes);
    if (ledger.executions[0]!.completedFoldIds.includes(foldId)) {
      reusedCompletedCheckpoints += 1;
      payloads.set(foldId, payload);
    } else {
      if (!input.continuation) throw new Error(`R18 unclaimed fold checkpoint exists before initial execution: ${foldId}`);
      reusedCompletedCheckpoints += 1;
      payloads.set(foldId, payload);
      ledger = updateR18PerformanceLedger({ root, expectedLedger: ledger, completedFoldIds: [...ledger.executions[0]!.completedFoldIds, foldId], status: "CLAIMED", finalSummaryMarker: "PENDING" });
    }
  }

  const finalPath = finalR18PerformanceCheckpointPath(input.executionDirectory);
  if (ledger.executions[0]!.finalSummaryMarker === "COMPLETE") {
    const envelope = readR18Checkpoint<{ report: R18PerformanceReport }>(finalPath, input.inputHashes);
    if (envelope.kind !== "FINAL_PERFORMANCE" || envelope.key !== input.executionLock.executionId) throw new Error("R18 final performance checkpoint identity is invalid.");
    return Object.freeze({ report: envelope.payload.report, ledger, reusedCompletedCheckpoints: ROUND_018_FOLDS.length, recomputedCompletedCheckpoints: 0 });
  }
  if (existsSync(finalPath)) {
    if (ledger.executions[0]!.completedFoldIds.length !== ROUND_018_FOLDS.length) throw new Error("R18 final checkpoint exists before every fold is complete.");
    const envelope = readR18Checkpoint<{ report: R18PerformanceReport }>(finalPath, input.inputHashes);
    if (envelope.kind !== "FINAL_PERFORMANCE" || envelope.key !== input.executionLock.executionId) throw new Error("R18 final performance checkpoint identity is invalid.");
    return Object.freeze({ report: envelope.payload.report, ledger, reusedCompletedCheckpoints: ROUND_018_FOLDS.length, recomputedCompletedCheckpoints: envelope.payload.report.recomputedCompletedCheckpoints });
  }

  const missingFolds = ROUND_018_FOLDS.filter((foldId) => !payloads.has(foldId));
  if (missingFolds.length > 0) {
    const joined = await collectR18FoldRows({ structuralIndex: input.structuralIndex, observationFile: input.observationFile, foldIds: missingFolds });
    for (const foldId of missingFolds) {
      const observations = joined.get(foldId) ?? [];
      if (observations.length === 0) throw new Error(`R18 exact economic join produced no rows for ${foldId}.`);
      const payload = checkpointPayloadFromRows(foldId, observations);
      const written = writeR18CheckpointAtomic({ filePath: foldR18CheckpointPath(input.executionDirectory, foldId), kind: "FOLD", key: foldId, inputHashes: Object.freeze({ ...input.inputHashes, foldId }), payload });
      const finalPayload = validateFoldPayload(written.envelope.payload, foldId);
      payloads.set(foldId, finalPayload);
      if (written.reused) reusedCompletedCheckpoints += 1;
      else recomputedCompletedCheckpoints += 1;
      if (!ledger.executions[0]!.completedFoldIds.includes(foldId)) ledger = updateR18PerformanceLedger({ root, expectedLedger: ledger, completedFoldIds: [...ledger.executions[0]!.completedFoldIds, foldId], status: "CLAIMED", finalSummaryMarker: "PENDING" });
    }
  }

  const orderedPayloads = ROUND_018_FOLDS.map((foldId) => payloads.get(foldId)).filter((payload): payload is R18FoldCheckpointPayload => payload !== undefined);
  if (orderedPayloads.length !== ROUND_018_FOLDS.length) throw new Error("R18 performance did not produce all fold checkpoints.");
  const report = buildReport({ executionId: input.executionLock.executionId, ledger, continuation: input.continuation, reusedCompletedCheckpoints, recomputedCompletedCheckpoints, payloads: orderedPayloads, inputHashes: input.inputHashes });
  writeR18CheckpointAtomic({ filePath: finalPath, kind: "FINAL_PERFORMANCE", key: input.executionLock.executionId, inputHashes: input.inputHashes, payload: Object.freeze({ report }) });
  return Object.freeze({ report, ledger, reusedCompletedCheckpoints, recomputedCompletedCheckpoints });
}

export function buildR18ExecutionArtifacts(report: R18PerformanceReport): R18ExecutionArtifacts {
  const selectionJson = stableStringify({ schemaVersion: "m3-r18-round-018-selection-001", researchRoundId: report.researchRoundId, executionId: report.executionId, performanceExecutionSourceSha: report.performanceExecutionSourceSha, acceptedDesignSourceSha: report.acceptedDesignSourceSha, performanceLock: report.performanceLock, performanceExecutionCount: report.performanceExecutionCount, gates: report.gates, selection: report.selection, governance: report.governance, artifactHashMethod: R18_ARTIFACT_HASH_METHOD });
  const selectionMarkdown = ["# M3-R18 Round-018 Selection", "", `- executionId: ${report.executionId}`, `- finalDecision: ${report.selection.finalDecision}`, `- eligibleCandidateIds: ${JSON.stringify(report.selection.eligibleCandidateIds)}`, `- selectedCandidateId: ${report.selection.selectedCandidateId ?? "null"}`, `- selectionExecuted: ${report.selection.selectionExecuted}`, `- performanceExecutionCount: ${report.performanceExecutionCount}`, `- artifactHashMethod: ${R18_ARTIFACT_HASH_METHOD}`].join("\n");
  const resultsLines = [
    "# M3-R18 Round-018 Component Consensus Performance",
    "",
    `- researchRoundId: ${report.researchRoundId}`,
    `- executionId: ${report.executionId}`,
    `- performanceExecutionSourceSha: ${report.performanceExecutionSourceSha}`,
    `- acceptedDesignSourceSha: ${report.acceptedDesignSourceSha}`,
    `- performanceExecutionCount: ${report.performanceExecutionCount}`,
    `- performanceLockTriggered: ${report.performanceLockTriggered}`,
    `- controlValidationEconomicCount: ${report.controlValidationEconomicCount}`,
    `- candidateValidationEconomicCount: ${report.candidateValidationEconomicCount}`,
    "",
    "## H4 validation",
    "",
    "| cohort | count | mean net ATR | PF | cumulative net ATR | maximum DD net ATR |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| CONTROL | ${report.controlH4.count} | ${report.controlH4.meanNetForwardAtr ?? "null"} | ${report.controlH4.profitFactor ?? "null"} | ${report.controlH4.cumulativeNetForwardAtr} | ${report.controlH4.maximumDrawdownNetAtr} |`,
    `| CANDIDATE | ${report.candidateH4.count} | ${report.candidateH4.meanNetForwardAtr ?? "null"} | ${report.candidateH4.profitFactor ?? "null"} | ${report.candidateH4.cumulativeNetForwardAtr} | ${report.candidateH4.maximumDrawdownNetAtr} |`,
    `| DELTA MEAN | — | ${report.deltaMeanNetForwardAtr ?? "null"} | — | — | — |`,
    "",
    "## Fold H4 means",
    "",
    "| fold | control mean | candidate mean | candidate >= control | candidate > 0 |",
    "| --- | ---: | ---: | --- | --- |",
    ...report.folds.map((fold) => `| ${fold.foldId} | ${fold.control.meanNetForwardAtr ?? "null"} | ${fold.candidate.meanNetForwardAtr ?? "null"} | ${fold.candidateMeanAtLeastControl} | ${fold.candidateMeanPositive} |`),
    "",
    `- positiveIncrementalFolds: ${report.positiveIncrementalFolds}/6`,
    `- positiveAbsoluteCandidateFolds: ${report.positiveAbsoluteCandidateFolds}/6`,
    "",
    "## Stress and reporting-only horizons",
    "",
    `- candidate cost-stress mean/PF: ${report.candidateH4.meanNetForwardAtrCostStress ?? "null"} / ${report.candidateH4.costStressProfitFactor ?? "null"}`,
    `- candidate latency-stress mean/PF: ${report.candidateH4.latencyStressMeanNetForwardAtr ?? "null"} / ${report.candidateH4.latencyStressProfitFactor ?? "null"}`,
    ...(["H8", "H12", "H24"] as const).map((horizon) => `- ${horizon} reporting-only candidate/control mean: ${report.secondaryHorizons[horizon].candidate.meanNetForwardAtr ?? "null"} / ${report.secondaryHorizons[horizon].control.meanNetForwardAtr ?? "null"}`),
    "",
    "## G08-G15",
    "",
    ...report.gates.map((gate) => `- ${gate.id}: ${gate.passed ? "PASS" : "FAIL"} (observed ${JSON.stringify(gate.observed)}; requirement ${gate.requirement})`),
    "",
    `- finalDecision: ${report.selection.finalDecision}`,
    `- baseline002Status: ${report.governance.baseline002Status}`,
    `- m3JStatus: ${report.governance.m3JStatus}`,
    `- m4Status: ${report.governance.m4Status}`,
    `- automaticTrading: ${report.governance.automaticTrading}`,
  ];
  const resultsMarkdown = resultsLines.join("\n");
  const summaryJson = stableStringify({ ...report, evidenceStatus: "COMPLETE", artifactHashMethod: R18_ARTIFACT_HASH_METHOD });
  const auditJson = stableStringify({
    schemaVersion: R18_PERFORMANCE_AUDIT_SCHEMA_VERSION,
    researchRoundId: report.researchRoundId,
    execution: { executionId: report.executionId, performanceExecutionSourceSha: report.performanceExecutionSourceSha, performanceLock: report.performanceLock, performanceExecutionCount: report.performanceExecutionCount, performanceLockTriggered: report.performanceLockTriggered, continuation: report.continuation, reusedCompletedCheckpoints: report.reusedCompletedCheckpoints, recomputedCompletedCheckpoints: report.recomputedCompletedCheckpoints },
    inputs: { observationDataSha256: report.observationDataSha256, compactStructuralSha256: report.compactStructuralSha256, structuralManifestSha256: report.structuralManifestSha256, preflightReportSha256: report.preflightReportSha256 },
    gates: report.gates,
    selection: report.selection,
    governance: report.governance,
    exactUtf8ArtifactSha256: { results: sha256Utf8(resultsMarkdown), summary: sha256Utf8(summaryJson), selectionJson: sha256Utf8(selectionJson), selectionMarkdown: sha256Utf8(selectionMarkdown) },
    hashMethod: R18_ARTIFACT_HASH_METHOD,
  });
  return Object.freeze({ report, resultsMarkdown, summaryJson, auditJson, selectionJson, selectionMarkdown, hashes: Object.freeze({ resultSha256: sha256Utf8(resultsMarkdown), summarySha256: sha256Utf8(summaryJson), auditSha256: sha256Utf8(auditJson), selectionSha256: sha256Utf8(selectionJson) }) });
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r+");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

export function existingR18OutputArtifacts(root = process.cwd()): readonly string[] {
  return Object.values(R18_PERFORMANCE_OUTPUT_PATHS).filter((relative) => existsSync(path.join(root, relative)));
}

export function publishR18ArtifactsAtomically(input: Readonly<{ artifacts: R18ExecutionArtifacts; root?: string; beforePublish?: (target: string, index: number) => void; onStagingCreated?: (directory: string) => void }>): void {
  const root = path.resolve(input.root ?? process.cwd());
  const targets = new Map<string, string>([
    [R18_PERFORMANCE_OUTPUT_PATHS.results, input.artifacts.resultsMarkdown],
    [R18_PERFORMANCE_OUTPUT_PATHS.audit, input.artifacts.auditJson],
    [R18_PERFORMANCE_OUTPUT_PATHS.selectionJson, input.artifacts.selectionJson],
    [R18_PERFORMANCE_OUTPUT_PATHS.selectionMarkdown, input.artifacts.selectionMarkdown],
    [R18_PERFORMANCE_OUTPUT_PATHS.summary, input.artifacts.summaryJson],
  ].map(([relative, value]) => [path.join(root, relative), value]));
  if ([...targets.keys()].some((target) => existsSync(target))) throw new Error("R18 output already exists; refusing overwrite.");
  const staging = mkdtempSync(path.join(root, "docs", ".m3-r18-round-018-staging-"));
  const publication = [...targets.keys()];
  const staged = new Map<string, string>();
  const published: string[] = [];
  let publicationError: unknown;
  const rollbackErrors: string[] = [];
  let cleanupError: unknown;
  try {
    input.onStagingCreated?.(staging);
    for (const target of publication) {
      const temporary = path.join(staging, `${publication.indexOf(target)}-${path.basename(target)}`);
      writeFileSync(temporary, Buffer.from(targets.get(target)!, "utf8"));
      fsyncFile(temporary);
      staged.set(target, temporary);
    }
    for (const [index, target] of publication.entries()) {
      input.beforePublish?.(target, index);
      if (existsSync(target)) throw new Error(`R18 output appeared during publication: ${target}`);
      mkdirSync(path.dirname(target), { recursive: true });
      renameSync(staged.get(target)!, target);
      published.push(target);
    }
  } catch (error) {
    publicationError = error;
    for (const target of [...published].reverse()) {
      try { unlinkSync(target); } catch (rollbackError) { rollbackErrors.push(`${target}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); }
    }
  } finally {
    if (existsSync(staging)) {
      try { rmSync(staging, { recursive: true, force: true }); } catch (error) { cleanupError = error; }
    }
  }
  if (publicationError !== undefined) {
    const primary = publicationError instanceof Error ? publicationError.message : String(publicationError);
    const details = [...(rollbackErrors.length > 0 ? [`rollback failed: ${rollbackErrors.join(" | ")}`] : []), ...(cleanupError !== undefined ? [`staging cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`] : [])];
    throw new Error([primary, ...details].join("; "));
  }
  if (cleanupError !== undefined) throw new Error(`R18 staging cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
}
