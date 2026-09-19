import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ResearchFoldId } from "./constants.ts";
import { calculateR13Drawdown } from "./r13-drawdown.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { streamR14Observations } from "./m3-r14-round-014-observations.ts";
import type { R13ForwardLabel, R13LabelStatus } from "./m3-r13-round-013-labels.ts";
import type { R13Observation } from "./m3-r13-round-013-performance.ts";
import { scanR23MetadataOnly } from "./round-023-development-data.ts";
import {
  R29_BASE_BRANCH,
  R29_BASE_SHA,
  R29_BRANCH,
  R29_CALIBRATION_QUANTILE,
  R29_CANDIDATE_CONFIGURATIONS,
  R29_DEVELOPMENT_GATES,
  R29_FEATURE_NAMES,
  R29_FOLD_IDS,
  R29_HORIZON_HOURS,
  R29_LOGISTIC_LAMBDA,
  R29_MANUAL_LATENCY_MINUTES,
  R29_PHASE,
  R29_PROTOCOL_SHA256,
  R29_PURGE_EMBARGO_HOURS,
  R29_RESEARCH_ROUND_ID,
  R29_SOURCE,
  R29_SOURCE_END_ISO,
  R29_SOURCE_PATH,
  R29_SOURCE_START_ISO,
  R29_SYMBOLS,
  type R29CandidateConfiguration,
  type R29CandidateId,
  type R29Direction,
  type R29Family,
  type R29FoldId,
  type R29Symbol,
} from "./round-029-protocol.ts";
import {
  expandR29QuadraticTop4,
  fitR29PositiveLogistic,
  predictR29PositiveProbability,
  type R29LogisticModelArtifact,
} from "./round-029-candidate-model.ts";
import { R25_COST_POLICY, R25_COST_POLICY_HASH, R25_FOLDS_SOURCE, R25_SETTLEMENT_HASH } from "./round-025-protocol.ts";
import { stableStringify } from "./utils.ts";

const RESULT_JSON_PATH = "docs/research/round-029-hybrid-directional-development-result.json" as const;
const RESULT_MARKDOWN_PATH = "docs/research/round-029-hybrid-directional-development-result.md" as const;
const DEVELOPMENT_RESULT_SCHEMA = "m3-r29-hybrid-directional-architecture-development-result-001" as const;
const HOUR_MS = 60 * 60 * 1_000;

type NumberOrNull = number | null;

type R29SourceRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: R29Symbol;
  direction: R29Direction;
  features: readonly number[];
  primaryStatus: R13LabelStatus;
  latencyStatus: R13LabelStatus;
  primary: R13ForwardLabel;
  latency: R13ForwardLabel;
}>;

export type R29ValidationFeatureRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: R29Symbol;
  direction: R29Direction;
  features: readonly number[];
}>;

type R29EconomicOutcome = Readonly<{ netR: number; costStressNetR: number; latencyNetR: number }>;

type R29Selection = Readonly<{
  family: R29Family;
  candidateConfigurationId: R29CandidateId;
  foldId: R29FoldId;
  observationId: string;
  decisionTime: number;
  symbol: R29Symbol;
  direction: R29Direction;
  score: number;
  gateValue: number;
  netR: number;
  costStressNetR: number;
  latencyNetR: number;
}>;

export type R29FoldMetric = Readonly<{
  selectedAlerts: number;
  completeDecisionTimes: number;
  selectedDecisionTimeRate: number | null;
  meanNetExpectancy: NumberOrNull;
  netProfitFactor: NumberOrNull;
  costStressMeanNetExpectancy: NumberOrNull;
  costStressProfitFactor: NumberOrNull;
  latencyStressMeanNetExpectancy: NumberOrNull;
  latencyStressProfitFactor: NumberOrNull;
  cumulativeNetR: number;
  maximumDrawdownR: number;
}>;

export type R29Metrics = Readonly<{
  selectedAlerts: number;
  distinctUtcDecisionDates: number;
  meanNetExpectancy: NumberOrNull;
  netProfitFactor: NumberOrNull;
  cumulativeNetR: number;
  maximumDrawdownR: number;
  maximumLosingStreak: number;
  costStressMeanNetExpectancy: NumberOrNull;
  costStressProfitFactor: NumberOrNull;
  latencyStressMeanNetExpectancy: NumberOrNull;
  latencyStressProfitFactor: NumberOrNull;
  positiveTemporalFolds: number;
  catastrophicFolds: number;
  maximumPositiveSymbolContributionShare: NumberOrNull;
  maximumSelectedDecisionTimeRatePerFold: NumberOrNull;
  byFold: Readonly<Record<R29FoldId, R29FoldMetric>>;
  bySymbol: Readonly<Record<R29Symbol, R29FoldMetric>>;
}>;

export type R29GateResult = Readonly<{ gateId: string; passed: boolean; actualValue: number | null; requirement: string }>;
export type R29GateSummary = Readonly<{ eligibility: "ELIGIBLE" | "INELIGIBLE"; failedGateIds: readonly string[]; failureReason: string | null; results: readonly R29GateResult[] }>;

export type R29ModelProvenance = Readonly<{
  foldId: R29FoldId;
  rawModelIdentitySha256: string | null;
  xsModelIdentitySha256: string | null;
  quadraticModelIdentitySha256: string | null;
  quadraticTop4FeatureIndexes: readonly number[];
  rawTrainingExamples: number;
  xsTrainingExamples: number;
  status: "FIT" | "MODEL_FIT_FAILED";
}>;

export type R29CandidateResult = Readonly<{
  candidateConfigurationId: R29CandidateId;
  family: R29Family;
  direction: R29Direction;
  architectureType: R29CandidateConfiguration["architectureType"];
  rankArchitecture: R29CandidateConfiguration["rankArchitecture"];
  calibrationStatistic: R29CandidateConfiguration["calibrationStatistic"];
  calibrationQuantile: typeof R29_CALIBRATION_QUANTILE;
  horizonHours: typeof R29_HORIZON_HOURS;
  normalization: "RAW_PIT" | "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME" | "RAW_PLUS_CROSS_SECTIONAL_BLENDED";
  selectionPolicy: R29CandidateConfiguration["selectionPolicy"];
  evaluated: true;
  selectedAlerts: number;
  selectedAlertsByFold: Readonly<Record<R29FoldId, number>>;
  metrics: R29Metrics;
  gates: R29GateSummary;
  modelProvenance: readonly R29ModelProvenance[];
}>;

export type R29DevelopmentResult = Readonly<{
  schemaVersion: typeof DEVELOPMENT_RESULT_SCHEMA;
  researchRoundId: typeof R29_RESEARCH_ROUND_ID;
  protocolPhase: typeof R29_PHASE;
  resultPhase: "HISTORICAL_DEVELOPMENT_ONLY";
  branch: typeof R29_BRANCH;
  base: Readonly<{ branch: typeof R29_BASE_BRANCH; sha: typeof R29_BASE_SHA }>;
  protocolSha256: string;
  developmentWindow: Readonly<{ start: typeof R29_SOURCE_START_ISO; end: typeof R29_SOURCE_END_ISO; classification: "DEVELOPMENT_ONLY / ALREADY_SEEN" }>;
  developmentDataSource: Readonly<Record<string, unknown>>;
  r29DevelopmentEconomicEvaluationExecutionCount: 1;
  candidateConfigurationsDefined: 6;
  candidateConfigurationsEvaluated: 6;
  candidateResults: readonly R29CandidateResult[];
  longChampionId: R29CandidateId | null;
  shortChampionId: R29CandidateId | null;
  developmentSelectionExecuted: true;
  developmentClassification: "NO_DEVELOPMENT_CHAMPION" | "DEVELOPMENT_CHAMPION_REQUIRES_PRE_OUTCOME_EXECUTABLE_FREEZE";
  historicalResultsObserved: true;
  historicalWindowNowSeen: true;
  historicalWindowReuseForAuthoritativeEvaluation: false;
  economicRunnerFrozenBeforeOutcomeRead: true;
  globalHistoricalEconomicLabelsRead: true;
  forwardEconomicValuesRead: false;
  forwardReturnRead: false;
  economicValuesCalculated: true;
  economicValuesInspected: true;
  newHistoricalDevelopmentDataFetched: false;
  newPostFreezeForwardDataFetched: false;
  candidateExecutableFrozen: false;
  forwardCandidateExists: false;
  forwardValidationAuthorized: false;
  executableFreezeSHA: null;
  forwardStart: null;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  automaticTrading: false;
  humanDecisionRequired: true;
  productionUnchanged: true;
  mainUnchanged: true;
  emailRestorationAuthorized: false;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  finalDecision: "ROUND-029 DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION" | "ROUND-029 DEVELOPMENT COMPLETE — PRE-OUTCOME EXECUTABLE FREEZE REQUIRED";
  nextStage: "CURRENT_FEATURE_INFORMATION_NOT_ECONOMICALLY_ACTIONABLE" | "PRE_OUTCOME_EXECUTABLE_FREEZE_REQUIRED";
}>;

type FoldContext = Readonly<{
  foldId: R29FoldId;
  research: readonly R29ValidationFeatureRow[];
  validation: readonly R29ValidationFeatureRow[];
  sourceById: ReadonlyMap<string, R29SourceRow>;
  researchRows: readonly R29SourceRow[];
  validationRows: readonly R29SourceRow[];
  rawFeatureById: ReadonlyMap<string, R29ValidationFeatureRow>;
}>;

type FoldModels = Readonly<{
  raw: R29LogisticModelArtifact;
  xs: R29LogisticModelArtifact;
  quadratic: R29LogisticModelArtifact;
  top4: readonly number[];
}>;

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function symbolOrder(symbol: R29Symbol): number { return R29_SYMBOLS.indexOf(symbol); }

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function profitFactor(values: readonly number[]): number | null {
  const positive = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negative = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return negative === 0 ? null : positive / negative;
}

function compareSelection(left: R29Selection, right: R29Selection): number {
  return left.decisionTime - right.decisionTime || symbolOrder(left.symbol) - symbolOrder(right.symbol) || left.observationId.localeCompare(right.observationId);
}

function maximumLosingStreak(selections: readonly R29Selection[]): number {
  let current = 0;
  let maximum = 0;
  for (const selection of [...selections].sort(compareSelection)) {
    current = selection.netR < 0 ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function metricFor(selections: readonly R29Selection[], completeDecisionTimes: number): R29FoldMetric {
  const ordered = [...selections].sort(compareSelection);
  const net = ordered.map((selection) => selection.netR);
  const cost = ordered.map((selection) => selection.costStressNetR);
  const latency = ordered.map((selection) => selection.latencyNetR);
  const drawdown = calculateR13Drawdown(ordered.map((selection) => ({ decisionTime: selection.decisionTime, symbol: selection.symbol, direction: selection.direction, netForwardAtr: selection.netR })));
  return Object.freeze({
    selectedAlerts: ordered.length,
    completeDecisionTimes,
    selectedDecisionTimeRate: completeDecisionTimes === 0 ? null : ordered.length / completeDecisionTimes,
    meanNetExpectancy: mean(net),
    netProfitFactor: profitFactor(net),
    costStressMeanNetExpectancy: mean(cost),
    costStressProfitFactor: profitFactor(cost),
    latencyStressMeanNetExpectancy: mean(latency),
    latencyStressProfitFactor: profitFactor(latency),
    cumulativeNetR: drawdown.cumulativeNetForwardAtr,
    maximumDrawdownR: drawdown.maximumDrawdownAtr,
  });
}

function metricSummary(selections: readonly R29Selection[], completeByFold: Readonly<Record<R29FoldId, number>>): R29Metrics {
  const ordered = [...selections].sort(compareSelection);
  const overall = metricFor(ordered, Object.values(completeByFold).reduce((sum, value) => sum + value, 0));
  const byFold = Object.fromEntries(R29_FOLD_IDS.map((foldId) => [foldId, metricFor(ordered.filter((selection) => selection.foldId === foldId), completeByFold[foldId]!)])) as Record<R29FoldId, R29FoldMetric>;
  const bySymbol = Object.fromEntries(R29_SYMBOLS.map((symbol) => [symbol, metricFor(ordered.filter((selection) => selection.symbol === symbol), 0)])) as Record<R29Symbol, R29FoldMetric>;
  const positive = ordered.filter((selection) => selection.netR > 0);
  const positiveBySymbol = R29_SYMBOLS.map((symbol) => positive.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.netR, 0));
  const positiveTotal = positiveBySymbol.reduce((sum, value) => sum + value, 0);
  const rates = Object.values(byFold).map((metric) => metric.selectedDecisionTimeRate).filter((value): value is number => value !== null);
  return Object.freeze({
    ...overall,
    distinctUtcDecisionDates: new Set(ordered.map((selection) => new Date(selection.decisionTime).toISOString().slice(0, 10))).size,
    maximumLosingStreak: maximumLosingStreak(ordered),
    positiveTemporalFolds: Object.values(byFold).filter((value) => value.meanNetExpectancy !== null && value.meanNetExpectancy > 0).length,
    catastrophicFolds: Object.values(byFold).filter((value) => value.meanNetExpectancy !== null && value.meanNetExpectancy <= R29_DEVELOPMENT_GATES.catastrophicFoldThreshold).length,
    maximumPositiveSymbolContributionShare: positiveTotal === 0 ? null : Math.max(...positiveBySymbol) / positiveTotal,
    maximumSelectedDecisionTimeRatePerFold: rates.length === 0 ? null : Math.max(...rates),
    byFold: Object.freeze(byFold),
    bySymbol: Object.freeze(bySymbol),
  });
}

export function evaluateR29DevelopmentGates(metrics: R29Metrics, failureReason: string | null = null): R29GateSummary {
  const minimumPerFold = Math.min(...R29_FOLD_IDS.map((foldId) => metrics.byFold[foldId].selectedAlerts));
  const results: R29GateResult[] = [
    { gateId: "minimumSelectedAlerts", passed: metrics.selectedAlerts >= R29_DEVELOPMENT_GATES.minimumSelectedAlerts, actualValue: metrics.selectedAlerts, requirement: `>= ${R29_DEVELOPMENT_GATES.minimumSelectedAlerts}` },
    { gateId: "minimumSelectedAlertsPerFold", passed: minimumPerFold >= R29_DEVELOPMENT_GATES.minimumSelectedAlertsPerFold, actualValue: minimumPerFold, requirement: `every F1-F6 >= ${R29_DEVELOPMENT_GATES.minimumSelectedAlertsPerFold}` },
    { gateId: "minimumDistinctUtcDecisionDates", passed: metrics.distinctUtcDecisionDates >= R29_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates, actualValue: metrics.distinctUtcDecisionDates, requirement: `>= ${R29_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates}` },
    { gateId: "minimumMeanNetExpectancy", passed: metrics.meanNetExpectancy !== null && metrics.meanNetExpectancy > R29_DEVELOPMENT_GATES.minimumMeanNetExpectancy, actualValue: metrics.meanNetExpectancy, requirement: `> ${R29_DEVELOPMENT_GATES.minimumMeanNetExpectancy}` },
    { gateId: "minimumNetProfitFactor", passed: metrics.netProfitFactor !== null && metrics.netProfitFactor > R29_DEVELOPMENT_GATES.minimumNetProfitFactor, actualValue: metrics.netProfitFactor, requirement: `> ${R29_DEVELOPMENT_GATES.minimumNetProfitFactor}` },
    { gateId: "minimumPositiveTemporalFolds", passed: metrics.positiveTemporalFolds >= R29_DEVELOPMENT_GATES.minimumPositiveTemporalFolds, actualValue: metrics.positiveTemporalFolds, requirement: `>= ${R29_DEVELOPMENT_GATES.minimumPositiveTemporalFolds}` },
    { gateId: "maximumCatastrophicFolds", passed: metrics.catastrophicFolds <= R29_DEVELOPMENT_GATES.maximumCatastrophicFolds, actualValue: metrics.catastrophicFolds, requirement: `<= ${R29_DEVELOPMENT_GATES.maximumCatastrophicFolds}` },
    { gateId: "minimumCostStressMeanNetExpectancy", passed: metrics.costStressMeanNetExpectancy !== null && metrics.costStressMeanNetExpectancy > R29_DEVELOPMENT_GATES.minimumCostStressMeanNetExpectancy, actualValue: metrics.costStressMeanNetExpectancy, requirement: `> ${R29_DEVELOPMENT_GATES.minimumCostStressMeanNetExpectancy}` },
    { gateId: "minimumLatencyMeanNetExpectancy", passed: metrics.latencyStressMeanNetExpectancy !== null && metrics.latencyStressMeanNetExpectancy > R29_DEVELOPMENT_GATES.minimumLatencyMeanNetExpectancy, actualValue: metrics.latencyStressMeanNetExpectancy, requirement: `> ${R29_DEVELOPMENT_GATES.minimumLatencyMeanNetExpectancy}` },
    { gateId: "maximumPositiveSymbolContributionShare", passed: metrics.maximumPositiveSymbolContributionShare !== null && metrics.maximumPositiveSymbolContributionShare <= R29_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare, actualValue: metrics.maximumPositiveSymbolContributionShare, requirement: `<= ${R29_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare}` },
    { gateId: "maximumSelectedDecisionTimeRatePerFold", passed: metrics.maximumSelectedDecisionTimeRatePerFold !== null && metrics.maximumSelectedDecisionTimeRatePerFold <= R29_DEVELOPMENT_GATES.maximumSelectedDecisionTimeRatePerFold, actualValue: metrics.maximumSelectedDecisionTimeRatePerFold, requirement: `<= ${R29_DEVELOPMENT_GATES.maximumSelectedDecisionTimeRatePerFold}` },
  ];
  const failedGateIds = results.filter((result) => !result.passed).map((result) => result.gateId);
  if (failureReason) failedGateIds.push(failureReason);
  return Object.freeze({ eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE", failedGateIds: Object.freeze(failedGateIds), failureReason, results: Object.freeze(results) });
}

function rowFromObservation(observation: R13Observation): R29SourceRow {
  const primary = observation.labels[R29_HORIZON_HOURS];
  const latency = observation.latencyStressLabels[R29_HORIZON_HOURS];
  const features = Object.freeze(R29_FEATURE_NAMES.map((name) => observation.features[name]));
  return Object.freeze({ observationId: observation.observationId, decisionTime: observation.decisionTime, symbol: observation.symbol as R29Symbol, direction: observation.direction as R29Direction, features, primaryStatus: primary.status, latencyStatus: latency.status, primary, latency });
}

function sourceCandidates(root: string): readonly string[] {
  return [path.join(root, R29_SOURCE_PATH), path.resolve(root, "..", "round-014-r13-execution-replay", R29_SOURCE_PATH)];
}

export function resolveR29DevelopmentSource(root = process.cwd()): string {
  const source = sourceCandidates(path.resolve(root)).find((candidate) => existsSync(candidate));
  if (!source) throw new Error("R29 accepted R14 observation source is unavailable; network acquisition is forbidden.");
  return path.resolve(source);
}

async function assertSourceIdentity(sourcePath: string): Promise<Readonly<Record<string, unknown>>> {
  const scan = await scanR23MetadataOnly(sourcePath);
  if (scan.observationDataBytes !== R29_SOURCE.bytes || scan.observationDataSha256 !== R29_SOURCE.sha256 || scan.observationCount !== R29_SOURCE.observationCount || scan.directionCounts.LONG !== 122_405 || scan.directionCounts.SHORT !== 122_405 || scan.postBoundaryRows !== 0 || scan.beforeWindowRows !== 0 || scan.duplicateObservationIds !== 0 || !scan.chronologyValid || !scan.requiredSymbolsComplete || scan.economicValuesRead !== false) throw new Error("R29 source does not match the accepted immutable R14 observation identity.");
  return Object.freeze({ ...R29_SOURCE, sourcePath: R29_SOURCE.canonicalPath, resolvedSourcePath: sourcePath, metadataOnlyEconomicValuesRead: scan.economicValuesRead });
}

async function loadRows(sourcePath: string): Promise<readonly R29SourceRow[]> {
  const rows: R29SourceRow[] = [];
  for await (const observation of streamR14Observations(sourcePath)) rows.push(rowFromObservation(observation));
  if (rows.length !== R29_SOURCE.observationCount) throw new Error("R29 source row count does not match the accepted observation identity.");
  return Object.freeze(rows);
}

function groupedByTime(rows: readonly R29ValidationFeatureRow[]): readonly (readonly R29ValidationFeatureRow[])[] {
  const grouped = new Map<number, R29ValidationFeatureRow[]>();
  for (const row of rows) grouped.set(row.decisionTime, [...(grouped.get(row.decisionTime) ?? []), row]);
  return Object.freeze([...grouped.entries()].sort(([left], [right]) => left - right).map(([, peers]) => Object.freeze(peers)));
}

function assertCompletePeers(rows: readonly R29ValidationFeatureRow[], direction: R29Direction, decisionTime: number): void {
  const peers = rows.filter((row) => row.direction === direction && row.decisionTime === decisionTime);
  const symbols = new Set(peers.map((row) => row.symbol));
  if (peers.length !== R29_SYMBOLS.length || symbols.size !== R29_SYMBOLS.length || !R29_SYMBOLS.every((symbol) => symbols.has(symbol))) throw new Error(`R29 requires exactly five ${direction} peers at ${decisionTime}.`);
}

export function buildR29CrossSectionalFeatureRows(rows: readonly R29SourceRow[], direction: R29Direction): readonly R29ValidationFeatureRow[] {
  const selected = rows.filter((row) => row.direction === direction).map((row) => Object.freeze({ observationId: row.observationId, decisionTime: row.decisionTime, symbol: row.symbol, direction: row.direction, features: row.features }));
  const normalized: R29ValidationFeatureRow[] = [];
  for (const peers of groupedByTime(selected)) {
    const decisionTime = peers[0]?.decisionTime;
    if (decisionTime === undefined) continue;
    assertCompletePeers(selected, direction, decisionTime);
    const normalizedPeers = peers.map((peer) => {
      const features = peer.features.map((value, index) => {
        const peerValues = peers.map((candidate) => candidate.features[index]!);
        const average = peerValues.reduce((sum, item) => sum + item, 0) / peerValues.length;
        const variance = peerValues.reduce((sum, item) => sum + (item - average) ** 2, 0) / peerValues.length;
        return (value - average) / (Math.sqrt(variance) || 1);
      });
      return Object.freeze({ ...peer, features: Object.freeze(features) });
    });
    normalized.push(...normalizedPeers);
  }
  return Object.freeze(normalized);
}

function inFoldRole(row: Readonly<{ decisionTime: number }>, foldId: R29FoldId, role: "RESEARCH" | "VALIDATION"): boolean {
  const range = getResearchFoldRoleRange(foldId as ResearchFoldId, role);
  return row.decisionTime >= range.startTime && row.decisionTime <= range.endTime;
}

function outcome(row: R29SourceRow): R29EconomicOutcome | null {
  if (row.primaryStatus !== "EXECUTED" || row.latencyStatus !== "EXECUTED") return null;
  const netR = finiteOrNull(row.primary.netForwardAtr);
  const costStressNetR = finiteOrNull(row.primary.netForwardAtrCostStress);
  const latencyNetR = finiteOrNull(row.latency.netForwardAtr);
  return netR === null || costStressNetR === null || latencyNetR === null ? null : Object.freeze({ netR, costStressNetR, latencyNetR });
}

function trainingExamples(rows: readonly R29SourceRow[], featureRows: ReadonlyMap<string, R29ValidationFeatureRow>): Readonly<{ examples: readonly Readonly<{ features: readonly number[]; target: 0 | 1 }>[]; positive: number }> {
  const examples: Readonly<{ features: readonly number[]; target: 0 | 1 }>[] = [];
  for (const row of rows) {
    const featureRow = featureRows.get(row.observationId);
    const rowOutcome = outcome(row);
    if (!featureRow || row.primaryStatus !== "EXECUTED" || rowOutcome === null) continue;
    examples.push(Object.freeze({ features: featureRow.features, target: rowOutcome.netR > 0 ? 1 : 0 }));
  }
  return Object.freeze({ examples: Object.freeze(examples), positive: examples.filter((example) => example.target === 1).length });
}

export function calculateR29CalibrationQuantile(values: readonly number[], quantile = R29_CALIBRATION_QUANTILE): number {
  if (values.length === 0 || quantile < 0 || quantile > 1) throw new Error("R29 calibration quantile requires non-empty values and a valid quantile.");
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function rawTop4Indexes(rows: readonly R29SourceRow[], featureRows: ReadonlyMap<string, R29ValidationFeatureRow>): readonly number[] {
  const research = rows.filter((row) => row.primaryStatus === "EXECUTED" && outcome(row) !== null).map((row) => ({ row, feature: featureRows.get(row.observationId) })).filter((item): item is { row: R29SourceRow; feature: R29ValidationFeatureRow } => item.feature !== undefined);
  const scores = Array.from({ length: 18 }, (_, index) => {
    const values = research.map((item) => item.feature.features[index]!);
    const labels = research.map((item) => outcome(item.row)!.netR > 0 ? 1 : 0);
    const positives = values.filter((_, item) => labels[item] === 1);
    const negatives = values.filter((_, item) => labels[item] === 0);
    let concordant = 0;
    let tied = 0;
    for (const positive of positives) for (const negative of negatives) {
      if (positive > negative) concordant += 1;
      else if (positive === negative) tied += 1;
    }
    const auc = positives.length === 0 || negatives.length === 0 ? 0.5 : (concordant + tied * 0.5) / (positives.length * negatives.length);
    return { index, distance: Math.abs(auc - 0.5) };
  });
  return Object.freeze(scores.sort((left, right) => right.distance - left.distance || left.index - right.index).slice(0, 4).map((score) => score.index));
}

function scoreRaw(model: R29LogisticModelArtifact, row: R29ValidationFeatureRow): number { return predictR29PositiveProbability(model, row.features); }
function scoreQuadratic(model: R29LogisticModelArtifact, row: R29ValidationFeatureRow, top4: readonly number[]): number { return predictR29PositiveProbability(model, expandR29QuadraticTop4(row.features, top4)); }

type Scored = Readonly<{ row: R29ValidationFeatureRow; score: number; gateValue: number; rankValue: number }>;

function sortScored(left: Scored, right: Scored): number {
  return right.rankValue - left.rankValue || symbolOrder(left.row.symbol) - symbolOrder(right.row.symbol) || left.row.observationId.localeCompare(right.row.observationId);
}

function scoreForConfig(config: R29CandidateConfiguration, row: R29ValidationFeatureRow, models: FoldModels, rawFeatureById: ReadonlyMap<string, R29ValidationFeatureRow>): Scored {
  const rawRow = rawFeatureById.get(row.observationId) ?? row;
  const raw = scoreRaw(models.raw, rawRow);
  const xs = scoreRaw(models.xs, row);
  const quadratic = scoreQuadratic(models.quadratic, rawRow, models.top4);
  if (config.candidateConfigurationId === "R29_LONG_RAW_QUADRATIC_GATE_XS_RANK" || config.candidateConfigurationId === "R29_SHORT_XS_RANK_RAW_QUADRATIC_GATE") return Object.freeze({ row, score: xs, gateValue: quadratic, rankValue: xs });
  if (config.candidateConfigurationId === "R29_LONG_RAW_GATE_BLENDED_RANK") return Object.freeze({ row, score: 0.5 * raw + 0.5 * xs, gateValue: raw, rankValue: 0.5 * raw + 0.5 * xs });
  return Object.freeze({ row, score: config.candidateConfigurationId === "R29_SHORT_XS_MARGIN_Q90" ? xs : (config.candidateConfigurationId.startsWith("R29_SHORT_XS") ? xs : raw), gateValue: config.candidateConfigurationId === "R29_SHORT_XS_MARGIN_Q90" ? xs : (config.candidateConfigurationId.startsWith("R29_SHORT_XS") ? xs : raw), rankValue: xs });
}

function buildSelections(config: R29CandidateConfiguration, context: FoldContext, models: FoldModels): readonly R29Selection[] {
  const calibrationValues: number[] = [];
  for (const peers of groupedByTime(context.research)) {
    const ranked = peers.map((row) => scoreForConfig(config, row, models, context.rawFeatureById)).sort(sortScored);
    if (ranked.length === 0) continue;
    if (config.calibrationStatistic === "XS_MARGIN") calibrationValues.push(ranked[0]!.rankValue - (ranked[1]?.rankValue ?? ranked[0]!.rankValue));
    else calibrationValues.push(ranked[0]!.gateValue);
  }
  const threshold = calculateR29CalibrationQuantile(calibrationValues);
  const selections: R29Selection[] = [];
  for (const peers of groupedByTime(context.validation)) {
    const ranked = peers.map((row) => scoreForConfig(config, row, models, context.rawFeatureById)).sort(sortScored);
    const top = ranked[0];
    if (!top) continue;
    const gate = config.calibrationStatistic === "XS_MARGIN" ? top.rankValue - (ranked[1]?.rankValue ?? top.rankValue) : top.gateValue;
    if (gate < threshold) continue;
    const source = context.sourceById.get(top.row.observationId);
    const economic = source ? outcome(source) : null;
    if (economic === null) throw new Error(`R29 selected validation observation is not economically evaluable: ${top.row.observationId}`);
    selections.push(Object.freeze({ family: config.family, candidateConfigurationId: config.candidateConfigurationId, foldId: context.foldId, observationId: top.row.observationId, decisionTime: top.row.decisionTime, symbol: top.row.symbol, direction: top.row.direction, score: top.score, gateValue: gate, ...economic }));
  }
  return Object.freeze(selections);
}

function fitFoldModels(context: FoldContext): Readonly<{ models: FoldModels; rawTrainingExamples: number; xsTrainingExamples: number }> {
  const rawMap = context.rawFeatureById;
  const xsMap = new Map(context.research.map((row) => [row.observationId, row]));
  const rawTraining = trainingExamples(context.researchRows, rawMap);
  const xsTraining = trainingExamples(context.researchRows, xsMap);
  const top4 = rawTop4Indexes(context.researchRows, rawMap);
  const quadraticExamples = rawTraining.examples.map((example) => Object.freeze({ features: expandR29QuadraticTop4(example.features, top4), target: example.target }));
  return Object.freeze({ models: Object.freeze({ raw: fitR29PositiveLogistic(rawTraining.examples, R29_FEATURE_NAMES), xs: fitR29PositiveLogistic(xsTraining.examples, R29_FEATURE_NAMES), quadratic: fitR29PositiveLogistic(quadraticExamples, Array.from({ length: 14 }, (_, index) => `quadratic_${index}`)), top4 }), rawTrainingExamples: rawTraining.examples.length, xsTrainingExamples: xsTraining.examples.length });
}

function buildFoldContexts(rows: readonly R29SourceRow[]): readonly FoldContext[] {
  const contexts: FoldContext[] = [];
  for (const foldId of R29_FOLD_IDS) {
    const byDirection = (direction: R29Direction): FoldContext => {
      const directionResearchRows = rows.filter((row) => row.direction === direction && inFoldRole(row, foldId, "RESEARCH") && row.decisionTime < getResearchFoldRoleRange(foldId as ResearchFoldId, "VALIDATION").startTime - R29_PURGE_EMBARGO_HOURS * HOUR_MS);
      const directionValidationRows = rows.filter((row) => row.direction === direction && inFoldRole(row, foldId, "VALIDATION"));
      const researchFeatureRows = buildR29CrossSectionalFeatureRows(directionResearchRows, direction);
      const validationFeatureRows = buildR29CrossSectionalFeatureRows(directionValidationRows, direction);
      const sourceById = new Map([...directionResearchRows, ...directionValidationRows].map((row) => [row.observationId, row]));
      const rawFeatureById = new Map([...directionResearchRows, ...directionValidationRows].map((row) => [row.observationId, Object.freeze({ observationId: row.observationId, decisionTime: row.decisionTime, symbol: row.symbol, direction: row.direction, features: row.features })]));
      return Object.freeze({ foldId, research: researchFeatureRows, validation: validationFeatureRows, sourceById, researchRows: directionResearchRows, validationRows: directionValidationRows, rawFeatureById });
    };
    contexts.push(byDirection("LONG"), byDirection("SHORT"));
  }
  return Object.freeze(contexts);
}

function completeDecisionTimes(context: FoldContext): number {
  return groupedByTime(context.validation).length;
}

function modelProvenance(foldId: R29FoldId, models: FoldModels, rawTrainingExamples: number, xsTrainingExamples: number): R29ModelProvenance {
  return Object.freeze({ foldId, rawModelIdentitySha256: models.raw.modelIdentitySha256, xsModelIdentitySha256: models.xs.modelIdentitySha256, quadraticModelIdentitySha256: models.quadratic.modelIdentitySha256, quadraticTop4FeatureIndexes: models.top4, rawTrainingExamples, xsTrainingExamples, status: "FIT" as const });
}

function candidateResult(config: R29CandidateConfiguration, contexts: readonly FoldContext[]): R29CandidateResult {
  const selections: R29Selection[] = [];
  const completeByFold = Object.fromEntries(R29_FOLD_IDS.map((foldId) => [foldId, 0])) as Record<R29FoldId, number>;
  const provenance: R29ModelProvenance[] = [];
  let failureReason: string | null = null;
  for (const foldId of R29_FOLD_IDS) {
    const context = contexts.find((candidate) => candidate.foldId === foldId && candidate.researchRows[0]?.direction === config.direction);
    if (!context) { failureReason = "MISSING_FOLD_CONTEXT"; continue; }
    completeByFold[foldId] = completeDecisionTimes(context);
    try {
      const fitted = fitFoldModels(context);
      provenance.push(modelProvenance(foldId, fitted.models, fitted.rawTrainingExamples, fitted.xsTrainingExamples));
      selections.push(...buildSelections(config, context, fitted.models));
    } catch (error) {
      failureReason = `MODEL_FIT_FAILED:${error instanceof Error ? error.message : String(error)}`;
    }
  }
  const metrics = metricSummary(selections, completeByFold);
  const selectedAlertsByFold = Object.fromEntries(R29_FOLD_IDS.map((foldId) => [foldId, metrics.byFold[foldId].selectedAlerts])) as Record<R29FoldId, number>;
  const normalization = config.rankArchitecture === "BLENDED_RAW_XS" ? "RAW_PLUS_CROSS_SECTIONAL_BLENDED" : config.architectureType === "RAW_LINEAR_ALL18" || config.architectureType === "RAW_QUADRATIC_TOP4" ? "RAW_PIT" : "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME";
  return Object.freeze({ candidateConfigurationId: config.candidateConfigurationId, family: config.family, direction: config.direction, architectureType: config.architectureType, rankArchitecture: config.rankArchitecture, calibrationStatistic: config.calibrationStatistic, calibrationQuantile: R29_CALIBRATION_QUANTILE, horizonHours: R29_HORIZON_HOURS, normalization, selectionPolicy: config.selectionPolicy, evaluated: true, selectedAlerts: selections.length, selectedAlertsByFold: Object.freeze(selectedAlertsByFold), metrics, gates: evaluateR29DevelopmentGates(metrics, failureReason), modelProvenance: Object.freeze(provenance) });
}

function compareEligible(left: R29CandidateResult, right: R29CandidateResult): number {
  const leftWorst = Math.min(...R29_FOLD_IDS.map((foldId) => left.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  const rightWorst = Math.min(...R29_FOLD_IDS.map((foldId) => right.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  return rightWorst - leftWorst || (right.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY) - (left.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY) || Math.abs(left.metrics.maximumDrawdownR) - Math.abs(right.metrics.maximumDrawdownR) || left.candidateConfigurationId.localeCompare(right.candidateConfigurationId);
}

export function selectR29Champion(results: readonly R29CandidateResult[], family: R29Family): R29CandidateResult | null {
  return [...results.filter((result) => result.family === family && result.gates.eligibility === "ELIGIBLE")].sort(compareEligible)[0] ?? null;
}

function resultMarkdown(result: R29DevelopmentResult): string {
  const lines = [
    "# Round-029 Hybrid Directional Architecture — Development Result",
    "",
    `- Base: \`${result.base.branch}\` @ \`${result.base.sha}\``,
    `- Development window: \`${result.developmentWindow.start}\` through \`${result.developmentWindow.end}\``,
    "- Data classification: `DEVELOPMENT_ONLY / ALREADY_SEEN`; this historical window is not authoritative forward proof.",
    `- Source: \`${String(result.developmentDataSource.sourcePath)}\` (${String(result.developmentDataSource.sha256)})`,
    `- R29 development economic evaluation execution count: \`${result.r29DevelopmentEconomicEvaluationExecutionCount}\``,
    `- Protocol SHA-256: \`${result.protocolSha256}\``,
    "",
    "## Candidate results",
    "",
    "| Candidate | Direction | Selected | F1 | F2 | F3 | F4 | F5 | F6 | Mean net R | PF | Cost stress | 7m latency | Positive folds | Catastrophic folds | Symbol share | Selected-rate | Eligibility |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const candidate of result.candidateResults) lines.push(`| ${candidate.candidateConfigurationId} | ${candidate.direction} | ${candidate.selectedAlerts} | ${candidate.selectedAlertsByFold.F1} | ${candidate.selectedAlertsByFold.F2} | ${candidate.selectedAlertsByFold.F3} | ${candidate.selectedAlertsByFold.F4} | ${candidate.selectedAlertsByFold.F5} | ${candidate.selectedAlertsByFold.F6} | ${candidate.metrics.meanNetExpectancy ?? "null"} | ${candidate.metrics.netProfitFactor ?? "null"} | ${candidate.metrics.costStressMeanNetExpectancy ?? "null"} | ${candidate.metrics.latencyStressMeanNetExpectancy ?? "null"} | ${candidate.metrics.positiveTemporalFolds} | ${candidate.metrics.catastrophicFolds} | ${candidate.metrics.maximumPositiveSymbolContributionShare ?? "null"} | ${candidate.metrics.maximumSelectedDecisionTimeRatePerFold ?? "null"} | ${candidate.gates.eligibility} |`);
  lines.push(
    "",
    `- LONG champion: \`${result.longChampionId ?? "null"}\``,
    `- SHORT champion: \`${result.shortChampionId ?? "null"}\``,
    `- Development classification: \`${result.developmentClassification}\``,
    "",
    "## Frozen boundary",
    "",
    `- Cost policy: \`${R25_COST_POLICY.policyVersion}\`; both directions use the same fee, slippage, direction-correct Funding, causal settlement, and ${R29_MANUAL_LATENCY_MINUTES}-minute latency semantics.`,
    "- For each fold, only research labels were used for fitting/calibration; validation features were scored and top-one alerts selected before selected validation economic labels were read.",
    "- No forward economic values were read, no post-freeze data was fetched, and no Production or email behavior was changed.",
    "",
    "## Governance",
    "",
    '- `humanDecisionRequired=true`; `automaticTrading=false`; `Production unchanged`; `emailRestorationAuthorized=false`',
    '- `performanceExecutionCount=0`; `performanceLedgerPresent=false`; `baseline-002=NOT_FROZEN`; `M3-J=BLOCKED`; `M4=NOT_STARTED`',
    "",
    "## Final decision",
    "",
    "Final decision: " + result.finalDecision,
    "",
    "Next stage: " + result.nextStage,
    "",
  );
  return lines.join("\n");
}

function writeTextAtomically(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  writeFileSync(temporary, content, "utf8");
  renameSync(temporary, filePath);
}

export async function runR29Development(input: Readonly<{ root?: string }> = {}): Promise<R29DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const sourcePath = resolveR29DevelopmentSource(root);
  const sourceIdentity = await assertSourceIdentity(sourcePath);
  const rows = await loadRows(sourcePath);
  if (R29_CANDIDATE_CONFIGURATIONS.length !== 6 || R29_CANDIDATE_CONFIGURATIONS.filter((config) => config.direction === "LONG").length !== 3 || R29_CANDIDATE_CONFIGURATIONS.filter((config) => config.direction === "SHORT").length !== 3) throw new Error("R29 bounded search must contain exactly three LONG and three SHORT configurations.");
  const contexts = buildFoldContexts(rows);
  const candidateResults = R29_CANDIDATE_CONFIGURATIONS.map((config) => candidateResult(config, contexts));
  const longChampion = selectR29Champion(candidateResults, "LONG-CANDIDATE-FAMILY");
  const shortChampion = selectR29Champion(candidateResults, "SHORT-CANDIDATE-FAMILY");
  const hasChampion = Boolean(longChampion || shortChampion);
  return Object.freeze({
    schemaVersion: DEVELOPMENT_RESULT_SCHEMA,
    researchRoundId: R29_RESEARCH_ROUND_ID,
    protocolPhase: R29_PHASE,
    resultPhase: "HISTORICAL_DEVELOPMENT_ONLY",
    branch: R29_BRANCH,
    base: { branch: R29_BASE_BRANCH, sha: R29_BASE_SHA },
    protocolSha256: R29_PROTOCOL_SHA256,
    developmentWindow: { start: R29_SOURCE_START_ISO, end: R29_SOURCE_END_ISO, classification: "DEVELOPMENT_ONLY / ALREADY_SEEN" as const },
    developmentDataSource: sourceIdentity,
    r29DevelopmentEconomicEvaluationExecutionCount: 1,
    candidateConfigurationsDefined: 6,
    candidateConfigurationsEvaluated: 6,
    candidateResults: Object.freeze(candidateResults),
    longChampionId: longChampion?.candidateConfigurationId ?? null,
    shortChampionId: shortChampion?.candidateConfigurationId ?? null,
    developmentSelectionExecuted: true,
    developmentClassification: hasChampion ? "DEVELOPMENT_CHAMPION_REQUIRES_PRE_OUTCOME_EXECUTABLE_FREEZE" : "NO_DEVELOPMENT_CHAMPION",
    historicalResultsObserved: true,
    historicalWindowNowSeen: true,
    historicalWindowReuseForAuthoritativeEvaluation: false,
    economicRunnerFrozenBeforeOutcomeRead: true,
    globalHistoricalEconomicLabelsRead: true,
    forwardEconomicValuesRead: false,
    forwardReturnRead: false,
    economicValuesCalculated: true,
    economicValuesInspected: true,
    newHistoricalDevelopmentDataFetched: false,
    newPostFreezeForwardDataFetched: false,
    candidateExecutableFrozen: false,
    forwardCandidateExists: false,
    forwardValidationAuthorized: false,
    executableFreezeSHA: null,
    forwardStart: null,
    performanceExecutionCount: 0,
    performanceLedgerPresent: false,
    automaticTrading: false,
    humanDecisionRequired: true,
    productionUnchanged: true,
    mainUnchanged: true,
    emailRestorationAuthorized: false,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    finalDecision: hasChampion ? "ROUND-029 DEVELOPMENT COMPLETE — PRE-OUTCOME EXECUTABLE FREEZE REQUIRED" : "ROUND-029 DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION",
    nextStage: hasChampion ? "PRE_OUTCOME_EXECUTABLE_FREEZE_REQUIRED" : "CURRENT_FEATURE_INFORMATION_NOT_ECONOMICALLY_ACTIONABLE",
  });
}

export async function publishR29DevelopmentResult(input: Readonly<{ root?: string }> = {}): Promise<R29DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const result = await runR29Development({ root });
  writeTextAtomically(path.join(root, RESULT_JSON_PATH), stableStringify(result));
  writeTextAtomically(path.join(root, RESULT_MARKDOWN_PATH), resultMarkdown(result));
  return result;
}

export const R29_RUNNER_IDENTITIES = Object.freeze({
  resultJsonPath: RESULT_JSON_PATH,
  protocolSha256: R29_PROTOCOL_SHA256,
  costPolicyHash: R25_COST_POLICY_HASH,
  settlementHash: R25_SETTLEMENT_HASH,
  folds: R25_FOLDS_SOURCE,
  source: R29_SOURCE,
  noNetworkAcquisition: true,
  noForwardLoader: true,
  developmentOnly: true,
  economicRunnerFrozenBeforeOutcomeRead: true,
});
