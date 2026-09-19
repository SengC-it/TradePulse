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
  R27_BASE_BRANCH,
  R27_BASE_SHA,
  R27_BRANCH,
  R27_CANDIDATE_CONFIGURATIONS,
  R27_COST_POLICY,
  R27_COST_POLICY_HASH,
  R27_DEVELOPMENT_DATA_END_ISO,
  R27_DEVELOPMENT_DATA_SOURCE,
  R27_DEVELOPMENT_DATA_START_ISO,
  R27_DEVELOPMENT_GATES,
  R27_FOLD_IDS,
  R27_FOLDS_SOURCE,
  R27_HORIZON_HOURS,
  R27_LOGISTIC_LAMBDA,
  R27_MANUAL_LATENCY_MINUTES,
  R27_PAIRWISE_SCORE_THRESHOLD,
  R27_PHASE,
  R27_PROTOCOL_SHA256,
  R27_PURGE_EMBARGO_HOURS,
  R27_RESEARCH_ROUND_ID,
  R27_SETTLEMENT_HASH,
  R27_SYMBOLS,
  R27_POSITIVE_PROBABILITY_THRESHOLD,
  type R27CandidateConfiguration,
  type R27Direction,
  type R27Family,
  type R27FoldId,
  type R27Symbol,
  type R27TargetType,
} from "./round-027-protocol.ts";
import {
  fitR27PairwiseLogistic,
  fitR27PositiveLogistic,
  predictR27PairwiseProbability,
  predictR27PositiveProbability,
  type R27LogisticModelArtifact,
} from "./round-027-candidate-model.ts";
import { stableStringify } from "./utils.ts";

const RESULT_JSON_PATH = "docs/research/round-027-directional-development-result.json" as const;
const RESULT_MARKDOWN_PATH = "docs/research/round-027-directional-development-result.md" as const;
const DEVELOPMENT_RESULT_SCHEMA = "m3-r27-directional-target-model-redesign-development-result-001" as const;
const HOUR_MS = 60 * 60 * 1_000;

type NumberOrNull = number | null;

type R27SourceRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: R27Symbol;
  direction: R27Direction;
  sourceObservation: R13Observation;
  primaryStatus: R13LabelStatus;
  latencyStatus: R13LabelStatus;
}>;

type R27NormalizedRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: R27Symbol;
  direction: R27Direction;
  features: readonly number[];
  primaryStatus: R13LabelStatus;
  latencyStatus: R13LabelStatus;
  sourceObservation: R13Observation;
}>;

type R27EconomicOutcome = Readonly<{
  netR: number;
  costStressNetR: number;
  latencyNetR: number;
}>;

type R27Selection = Readonly<{
  family: R27Family;
  candidateConfigurationId: string;
  foldId: R27FoldId;
  observationId: string;
  decisionTime: number;
  symbol: R27Symbol;
  direction: R27Direction;
  positiveProbability: number;
  pairwiseScore: number | null;
  netR: number;
  costStressNetR: number;
  latencyNetR: number;
}>;

export type R27FoldMetric = Readonly<{
  selectedAlerts: number;
  meanNetExpectancy: NumberOrNull;
  netProfitFactor: NumberOrNull;
  costStressMeanNetExpectancy: NumberOrNull;
  costStressProfitFactor: NumberOrNull;
  latencyStressMeanNetExpectancy: NumberOrNull;
  latencyStressProfitFactor: NumberOrNull;
  cumulativeNetR: number;
  maximumDrawdownR: number;
}>;

export type R27Metrics = Readonly<{
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
  byFold: Readonly<Record<R27FoldId, R27FoldMetric>>;
  bySymbol: Readonly<Record<R27Symbol, R27FoldMetric>>;
}>;

export type R27GateResult = Readonly<{
  gateId: string;
  passed: boolean;
  actualValue: number | null;
  requirement: string;
}>;

export type R27GateSummary = Readonly<{
  eligibility: "ELIGIBLE" | "INELIGIBLE";
  failedGateIds: readonly string[];
  failureReason: string | null;
  results: readonly R27GateResult[];
}>;

export type R27ModelProvenance = Readonly<{
  foldId: R27FoldId;
  positiveModelIdentitySha256: string | null;
  pairwiseModelIdentitySha256: string | null;
  positiveModelType: string | null;
  positiveTrainingExamples: number;
  positiveExamples: number;
  negativeExamples: number;
  trainingPositiveRate: number | null;
  pairwiseTrainingDecisionTimes: number;
  pairwiseTrainingPairs: number;
  status: "FIT" | "MODEL_FIT_FAILED";
}>;

export type R27CandidateResult = Readonly<{
  candidateConfigurationId: string;
  family: R27Family;
  direction: R27Direction;
  targetType: R27TargetType;
  featureSubsetId: string;
  featureNames: readonly string[];
  lambda: typeof R27_LOGISTIC_LAMBDA;
  positiveProbabilityThreshold: typeof R27_POSITIVE_PROBABILITY_THRESHOLD;
  pairwiseScoreThreshold: typeof R27_PAIRWISE_SCORE_THRESHOLD | null;
  horizonHours: 4;
  normalization: "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME";
  regimeGate: null;
  selectionPolicy: R27CandidateConfiguration["selectionPolicy"];
  evaluated: true;
  selectedAlerts: number;
  selectedAlertsByFold: Readonly<Record<R27FoldId, number>>;
  metrics: R27Metrics;
  gates: R27GateSummary;
  modelProvenance: readonly R27ModelProvenance[];
}>;

export type R27DevelopmentResult = Readonly<{
  schemaVersion: typeof DEVELOPMENT_RESULT_SCHEMA;
  researchRoundId: typeof R27_RESEARCH_ROUND_ID;
  protocolPhase: typeof R27_PHASE;
  resultPhase: "HISTORICAL_DEVELOPMENT_ONLY";
  branch: typeof R27_BRANCH;
  base: Readonly<{ branch: typeof R27_BASE_BRANCH; sha: typeof R27_BASE_SHA }>;
  protocolSha256: string;
  developmentWindow: Readonly<{ start: typeof R27_DEVELOPMENT_DATA_START_ISO; end: typeof R27_DEVELOPMENT_DATA_END_ISO; classification: "DEVELOPMENT_ONLY / ALREADY_SEEN" }>;
  developmentDataSource: Readonly<Record<string, unknown>>;
  r27DevelopmentEconomicEvaluationExecutionCount: 1;
  candidateConfigurationsDefined: 6;
  candidateConfigurationsEvaluated: 6;
  candidateResults: readonly R27CandidateResult[];
  longChampionId: string | null;
  shortChampionId: string | null;
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
  finalDecision: "ROUND-027 DIRECTIONAL DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION / NO FORWARD CANDIDATE" | "ROUND-027 DEVELOPMENT COMPLETE — PRE-OUTCOME EXECUTABLE FREEZE REQUIRED";
  nextStage: "FEATURE_INFORMATION_OR_MODEL_CAPACITY_REASSESSMENT_REQUIRED" | "PRE_OUTCOME_EXECUTABLE_FREEZE_REQUIRED";
}>;

type FoldEvaluation = Readonly<{
  foldId: R27FoldId;
  selections: readonly R27Selection[];
  positiveModel: R27LogisticModelArtifact | null;
  pairwiseModel: R27LogisticModelArtifact | null;
  positiveTrainingExamples: number;
  positiveExamples: number;
  negativeExamples: number;
  pairwiseTrainingDecisionTimes: number;
  pairwiseTrainingPairs: number;
  failureReason: string | null;
}>;

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function symbolOrder(symbol: R27Symbol): number {
  return R27_SYMBOLS.indexOf(symbol);
}

function directionOrder(direction: R27Direction): number {
  return direction === "LONG" ? 0 : 1;
}

function compareSelections(left: R27Selection, right: R27Selection): number {
  return left.decisionTime - right.decisionTime
    || symbolOrder(left.symbol) - symbolOrder(right.symbol)
    || directionOrder(left.direction) - directionOrder(right.direction)
    || left.observationId.localeCompare(right.observationId);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function profitFactor(values: readonly number[]): number | null {
  const positive = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negative = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return negative === 0 ? null : positive / negative;
}

function maximumLosingStreak(selections: readonly R27Selection[]): number {
  let current = 0;
  let maximum = 0;
  for (const selection of [...selections].sort(compareSelections)) {
    current = selection.netR < 0 ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function metricFor(selections: readonly R27Selection[]): R27FoldMetric {
  const ordered = [...selections].sort(compareSelections);
  const net = ordered.map((selection) => selection.netR);
  const cost = ordered.map((selection) => selection.costStressNetR);
  const latency = ordered.map((selection) => selection.latencyNetR);
  const drawdown = calculateR13Drawdown(ordered.map((selection) => ({ decisionTime: selection.decisionTime, symbol: selection.symbol, direction: selection.direction, netForwardAtr: selection.netR })));
  return Object.freeze({
    selectedAlerts: ordered.length,
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

function metricSummary(selections: readonly R27Selection[]): R27Metrics {
  const ordered = [...selections].sort(compareSelections);
  const overall = metricFor(ordered);
  const byFold = Object.fromEntries(R27_FOLD_IDS.map((foldId) => [foldId, metricFor(ordered.filter((selection) => selection.foldId === foldId))])) as Record<R27FoldId, R27FoldMetric>;
  const bySymbol = Object.fromEntries(R27_SYMBOLS.map((symbol) => [symbol, metricFor(ordered.filter((selection) => selection.symbol === symbol))])) as Record<R27Symbol, R27FoldMetric>;
  const positive = ordered.filter((selection) => selection.netR > 0);
  const totalPositive = positive.reduce((sum, selection) => sum + selection.netR, 0);
  const positiveBySymbol = R27_SYMBOLS.map((symbol) => positive.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.netR, 0));
  return Object.freeze({
    selectedAlerts: overall.selectedAlerts,
    distinctUtcDecisionDates: new Set(ordered.map((selection) => new Date(selection.decisionTime).toISOString().slice(0, 10))).size,
    meanNetExpectancy: overall.meanNetExpectancy,
    netProfitFactor: overall.netProfitFactor,
    cumulativeNetR: overall.cumulativeNetR,
    maximumDrawdownR: overall.maximumDrawdownR,
    maximumLosingStreak: maximumLosingStreak(ordered),
    costStressMeanNetExpectancy: overall.costStressMeanNetExpectancy,
    costStressProfitFactor: overall.costStressProfitFactor,
    latencyStressMeanNetExpectancy: overall.latencyStressMeanNetExpectancy,
    latencyStressProfitFactor: overall.latencyStressProfitFactor,
    positiveTemporalFolds: Object.values(byFold).filter((value) => value.meanNetExpectancy !== null && value.meanNetExpectancy > 0).length,
    catastrophicFolds: Object.values(byFold).filter((value) => value.meanNetExpectancy !== null && value.meanNetExpectancy <= R27_DEVELOPMENT_GATES.catastrophicFoldThreshold).length,
    maximumPositiveSymbolContributionShare: totalPositive > 0 ? Math.max(...positiveBySymbol) / totalPositive : null,
    byFold: Object.freeze(byFold),
    bySymbol: Object.freeze(bySymbol),
  });
}

export function evaluateR27DevelopmentGates(metrics: R27Metrics, failureReason: string | null = null): R27GateSummary {
  const foldCounts = R27_FOLD_IDS.map((foldId) => metrics.byFold[foldId].selectedAlerts);
  const minimumPerFold = foldCounts.length === 0 ? null : Math.min(...foldCounts);
  const results: R27GateResult[] = [
    { gateId: "minimumSelectedAlerts", passed: metrics.selectedAlerts >= R27_DEVELOPMENT_GATES.minimumSelectedAlerts, actualValue: metrics.selectedAlerts, requirement: `>= ${R27_DEVELOPMENT_GATES.minimumSelectedAlerts}` },
    { gateId: "minimumSelectedAlertsPerFold", passed: minimumPerFold !== null && minimumPerFold >= R27_DEVELOPMENT_GATES.minimumSelectedAlertsPerFold, actualValue: minimumPerFold, requirement: `every F1-F6 >= ${R27_DEVELOPMENT_GATES.minimumSelectedAlertsPerFold}` },
    { gateId: "minimumDistinctUtcDecisionDates", passed: metrics.distinctUtcDecisionDates >= R27_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates, actualValue: metrics.distinctUtcDecisionDates, requirement: `>= ${R27_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates}` },
    { gateId: "minimumMeanNetExpectancy", passed: metrics.meanNetExpectancy !== null && metrics.meanNetExpectancy > R27_DEVELOPMENT_GATES.minimumMeanNetExpectancy, actualValue: metrics.meanNetExpectancy, requirement: `> ${R27_DEVELOPMENT_GATES.minimumMeanNetExpectancy}` },
    { gateId: "minimumNetProfitFactor", passed: metrics.netProfitFactor !== null && metrics.netProfitFactor > R27_DEVELOPMENT_GATES.minimumNetProfitFactor, actualValue: metrics.netProfitFactor, requirement: `> ${R27_DEVELOPMENT_GATES.minimumNetProfitFactor}` },
    { gateId: "minimumPositiveTemporalFolds", passed: metrics.positiveTemporalFolds >= R27_DEVELOPMENT_GATES.minimumPositiveTemporalFolds, actualValue: metrics.positiveTemporalFolds, requirement: `>= ${R27_DEVELOPMENT_GATES.minimumPositiveTemporalFolds}` },
    { gateId: "maximumCatastrophicFolds", passed: metrics.catastrophicFolds <= R27_DEVELOPMENT_GATES.maximumCatastrophicFolds, actualValue: metrics.catastrophicFolds, requirement: `<= ${R27_DEVELOPMENT_GATES.maximumCatastrophicFolds}` },
    { gateId: "minimumCostStressMeanNetExpectancy", passed: metrics.costStressMeanNetExpectancy !== null && metrics.costStressMeanNetExpectancy > R27_DEVELOPMENT_GATES.minimumCostStressMeanNetExpectancy, actualValue: metrics.costStressMeanNetExpectancy, requirement: `> ${R27_DEVELOPMENT_GATES.minimumCostStressMeanNetExpectancy}` },
    { gateId: "minimumLatencyMeanNetExpectancy", passed: metrics.latencyStressMeanNetExpectancy !== null && metrics.latencyStressMeanNetExpectancy > R27_DEVELOPMENT_GATES.minimumLatencyMeanNetExpectancy, actualValue: metrics.latencyStressMeanNetExpectancy, requirement: `> ${R27_DEVELOPMENT_GATES.minimumLatencyMeanNetExpectancy}` },
    { gateId: "maximumPositiveSymbolContributionShare", passed: metrics.maximumPositiveSymbolContributionShare !== null && metrics.maximumPositiveSymbolContributionShare <= R27_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare, actualValue: metrics.maximumPositiveSymbolContributionShare, requirement: `<= ${R27_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare}` },
  ];
  const failedGateIds = results.filter((result) => !result.passed).map((result) => result.gateId);
  if (failureReason) failedGateIds.push(failureReason);
  return Object.freeze({
    eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE",
    failedGateIds: Object.freeze(failedGateIds),
    failureReason,
    results: Object.freeze(results),
  });
}

function rowFromObservation(observation: R13Observation): R27SourceRow {
  const primary = observation.labels[R27_HORIZON_HOURS];
  const latency = observation.latencyStressLabels[R27_HORIZON_HOURS];
  return Object.freeze({
    observationId: observation.observationId,
    decisionTime: observation.decisionTime,
    symbol: observation.symbol as R27Symbol,
    direction: observation.direction as R27Direction,
    sourceObservation: observation,
    primaryStatus: primary.status,
    latencyStatus: latency.status,
  });
}

function sourceCandidates(root: string): readonly string[] {
  return [
    path.join(root, R27_DEVELOPMENT_DATA_SOURCE.canonicalObservationPath),
    path.resolve(root, "..", "round-014-r13-execution-replay", R27_DEVELOPMENT_DATA_SOURCE.canonicalObservationPath),
  ];
}

export function resolveR27DevelopmentSource(root = process.cwd()): string {
  const source = sourceCandidates(path.resolve(root)).find((candidate) => existsSync(candidate));
  if (!source) throw new Error("R27 accepted R14 observation source is unavailable; network acquisition is forbidden.");
  return path.resolve(source);
}

async function assertSourceIdentity(sourcePath: string): Promise<Readonly<Record<string, unknown>>> {
  const scan = await scanR23MetadataOnly(sourcePath);
  if (
    scan.observationDataBytes !== R27_DEVELOPMENT_DATA_SOURCE.observationDataBytes
    || scan.observationDataSha256 !== R27_DEVELOPMENT_DATA_SOURCE.observationDataSha256
    || scan.observationCount !== R27_DEVELOPMENT_DATA_SOURCE.observationCount
    || scan.directionCounts.LONG !== 122_405
    || scan.directionCounts.SHORT !== 122_405
    || scan.postBoundaryRows !== 0
    || scan.beforeWindowRows !== 0
    || scan.duplicateObservationIds !== 0
    || !scan.chronologyValid
    || !scan.requiredSymbolsComplete
    || scan.economicValuesRead !== false
  ) throw new Error("R27 source does not match the accepted immutable R14 observation identity.");
  return Object.freeze({
    ...R27_DEVELOPMENT_DATA_SOURCE,
    sourcePath: R27_DEVELOPMENT_DATA_SOURCE.canonicalObservationPath,
    resolvedSourcePath: sourcePath,
    metadataOnlyEconomicValuesRead: scan.economicValuesRead,
  });
}

async function loadRows(sourcePath: string): Promise<readonly R27SourceRow[]> {
  const rows: R27SourceRow[] = [];
  for await (const observation of streamR14Observations(sourcePath)) rows.push(rowFromObservation(observation));
  if (rows.length !== R27_DEVELOPMENT_DATA_SOURCE.observationCount) throw new Error("R27 source row count does not match the accepted observation identity.");
  return Object.freeze(rows);
}

type R27PeerIdentity = Readonly<{ direction: R27Direction; decisionTime: number; symbol: R27Symbol }>;

function assertExactlyFivePeers(rows: readonly R27PeerIdentity[], direction: R27Direction, decisionTime: number): void {
  const peers = rows.filter((row) => row.direction === direction && row.decisionTime === decisionTime);
  const symbols = new Set(peers.map((row) => row.symbol));
  if (peers.length !== R27_SYMBOLS.length || symbols.size !== R27_SYMBOLS.length || !R27_SYMBOLS.every((symbol) => symbols.has(symbol))) throw new Error(`R27 requires exactly five ${direction} peers at ${decisionTime}.`);
}

export function validateR27PeerGroup(rows: readonly Readonly<{ direction: R27Direction; decisionTime: number; symbol: R27Symbol }>[], direction: R27Direction, decisionTime: number): true {
  assertExactlyFivePeers(rows, direction, decisionTime);
  return true;
}

function normalizedRows(rows: readonly R27SourceRow[], direction: R27Direction, featureNames: readonly string[]): readonly R27NormalizedRow[] {
  const selected = rows.filter((row) => row.direction === direction);
  const grouped = new Map<number, R27SourceRow[]>();
  for (const row of selected) grouped.set(row.decisionTime, [...(grouped.get(row.decisionTime) ?? []), row]);
  const normalized: R27NormalizedRow[] = [];
  for (const [decisionTime, peers] of grouped) {
    assertExactlyFivePeers(peers, direction, decisionTime);
    for (const peer of peers) {
      const features = featureNames.map((name) => {
        const sourceFeatures = peer.sourceObservation.features as Readonly<Record<string, number>>;
        const value = sourceFeatures[name];
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`R27 feature ${name} is non-finite at ${peer.observationId}.`);
        const values = peers.map((candidate) => (candidate.sourceObservation.features as Readonly<Record<string, number>>)[name]);
        if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) throw new Error(`R27 peer feature ${name} is non-finite at ${decisionTime}.`);
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
        const deviation = Math.sqrt(variance) || 1;
        return (value - average) / deviation;
      });
      normalized.push(Object.freeze({ observationId: peer.observationId, decisionTime, symbol: peer.symbol, direction, features: Object.freeze(features), primaryStatus: peer.primaryStatus, latencyStatus: peer.latencyStatus, sourceObservation: peer.sourceObservation }));
    }
  }
  return Object.freeze(normalized);
}

function inFoldRole(row: Readonly<{ decisionTime: number }>, foldId: R27FoldId, role: "RESEARCH" | "VALIDATION"): boolean {
  const range = getResearchFoldRoleRange(foldId as ResearchFoldId, role);
  return row.decisionTime >= range.startTime && row.decisionTime <= range.endTime;
}

function groupedByDecisionTime(rows: readonly R27NormalizedRow[]): readonly (readonly R27NormalizedRow[])[] {
  const grouped = new Map<number, R27NormalizedRow[]>();
  for (const row of rows) grouped.set(row.decisionTime, [...(grouped.get(row.decisionTime) ?? []), row]);
  return Object.freeze([...grouped.entries()].sort(([left], [right]) => left - right).map(([, peers]) => Object.freeze(peers)));
}

function primaryNetR(row: R27NormalizedRow): number | null {
  return finiteOrNull(row.sourceObservation.labels[R27_HORIZON_HOURS].netForwardAtr);
}

function selectedEconomicOutcome(row: R27NormalizedRow): R27EconomicOutcome | null {
  const primary: R13ForwardLabel = row.sourceObservation.labels[R27_HORIZON_HOURS];
  const latency: R13ForwardLabel = row.sourceObservation.latencyStressLabels[R27_HORIZON_HOURS];
  if (primary.status !== "EXECUTED" || latency.status !== "EXECUTED") return null;
  const netR = finiteOrNull(primary.netForwardAtr);
  const costStressNetR = finiteOrNull(primary.netForwardAtrCostStress);
  const latencyNetR = finiteOrNull(latency.netForwardAtr);
  return netR === null || costStressNetR === null || latencyNetR === null ? null : Object.freeze({ netR, costStressNetR, latencyNetR });
}

function positiveTrainingExamples(rows: readonly R27NormalizedRow[]): Readonly<{ examples: readonly Readonly<{ features: readonly number[]; target: 0 | 1 }>[]; positiveExamples: number; negativeExamples: number }> {
  const examples: Readonly<{ features: readonly number[]; target: 0 | 1 }>[] = [];
  for (const row of rows) {
    if (row.primaryStatus !== "EXECUTED") continue;
    const netR = primaryNetR(row);
    if (netR === null) continue;
    examples.push(Object.freeze({ features: row.features, target: netR > 0 ? 1 : 0 }));
  }
  const positiveExamples = examples.filter((example) => example.target === 1).length;
  return Object.freeze({ examples: Object.freeze(examples), positiveExamples, negativeExamples: examples.length - positiveExamples });
}

function pairwiseTrainingExamples(rows: readonly R27NormalizedRow[]): Readonly<{ examples: readonly Readonly<{ features: readonly number[]; target: 0 | 1 }>[]; decisionTimes: number; pairs: number }> {
  const examples: Readonly<{ features: readonly number[]; target: 0 | 1 }>[] = [];
  let completeDecisionTimes = 0;
  let unequalPairs = 0;
  for (const peers of groupedByDecisionTime(rows)) {
    if (peers.length !== R27_SYMBOLS.length || peers.some((row) => row.primaryStatus !== "EXECUTED")) continue;
    const outcomes = peers.map((row) => primaryNetR(row));
    if (outcomes.some((value) => value === null)) continue;
    completeDecisionTimes += 1;
    for (let left = 0; left < peers.length; left += 1) {
      for (let right = left + 1; right < peers.length; right += 1) {
        const leftNet = outcomes[left]!;
        const rightNet = outcomes[right]!;
        if (leftNet === rightNet) continue;
        unequalPairs += 1;
        const target: 0 | 1 = leftNet > rightNet ? 1 : 0;
        const difference = peers[left]!.features.map((value, index) => value - peers[right]!.features[index]!);
        examples.push(Object.freeze({ features: Object.freeze(difference), target }));
        examples.push(Object.freeze({ features: Object.freeze(difference.map((value) => -value)), target: target === 1 ? 0 : 1 }));
      }
    }
  }
  return Object.freeze({ examples: Object.freeze(examples), decisionTimes: completeDecisionTimes, pairs: unequalPairs });
}

type ModelCache = Map<string, R27LogisticModelArtifact>;

function cacheKey(foldId: R27FoldId, direction: R27Direction, featureSubsetId: string, target: "POSITIVE" | "PAIRWISE"): string {
  return `${foldId}|${direction}|${featureSubsetId}|${target}`;
}

function scorePositiveRows(model: R27LogisticModelArtifact, rows: readonly R27NormalizedRow[]): readonly Readonly<{ row: R27NormalizedRow; probability: number }>[] {
  return Object.freeze(rows.map((row) => Object.freeze({ row, probability: predictR27PositiveProbability(model, row.features) })));
}

function comparePositive(left: Readonly<{ row: R27NormalizedRow; probability: number }>, right: Readonly<{ row: R27NormalizedRow; probability: number }>): number {
  return right.probability - left.probability || symbolOrder(left.row.symbol) - symbolOrder(right.row.symbol) || left.row.observationId.localeCompare(right.row.observationId);
}

function positiveSelection(
  config: R27CandidateConfiguration,
  foldId: R27FoldId,
  model: R27LogisticModelArtifact,
  validationRows: readonly R27NormalizedRow[],
): Readonly<{ selections: readonly R27Selection[]; failureReason: string | null }> {
  const selections: R27Selection[] = [];
  for (const peers of groupedByDecisionTime(validationRows)) {
    const ranked = [...scorePositiveRows(model, peers)].sort(comparePositive);
    const top = ranked[0];
    if (!top || top.probability < config.positiveProbabilityThreshold) continue;
    const outcome = selectedEconomicOutcome(top.row);
    if (outcome === null) return Object.freeze({ selections: Object.freeze(selections), failureReason: "SELECTED_LABEL_NOT_EVALUABLE" });
    selections.push(Object.freeze({ family: config.family, candidateConfigurationId: config.candidateConfigurationId, foldId, observationId: top.row.observationId, decisionTime: top.row.decisionTime, symbol: top.row.symbol, direction: top.row.direction, positiveProbability: top.probability, pairwiseScore: null, ...outcome }));
  }
  return Object.freeze({ selections: Object.freeze(selections), failureReason: null });
}

function pairwiseSelection(
  config: R27CandidateConfiguration,
  foldId: R27FoldId,
  pairwiseModel: R27LogisticModelArtifact,
  positiveModel: R27LogisticModelArtifact,
  validationRows: readonly R27NormalizedRow[],
): Readonly<{ selections: readonly R27Selection[]; failureReason: string | null }> {
  const selections: R27Selection[] = [];
  for (const peers of groupedByDecisionTime(validationRows)) {
    if (peers.length !== R27_SYMBOLS.length || peers.some((row) => row.primaryStatus !== "EXECUTED")) continue;
    const scored = peers.map((row) => {
      const probabilities = peers.filter((other) => other !== row).map((other) => predictR27PairwiseProbability(pairwiseModel, row.features.map((value, index) => value - other.features[index]!)));
      return Object.freeze({ row, pairwiseScore: probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length, positiveProbability: predictR27PositiveProbability(positiveModel, row.features) });
    }).sort((left, right) => right.pairwiseScore - left.pairwiseScore || symbolOrder(left.row.symbol) - symbolOrder(right.row.symbol) || left.row.observationId.localeCompare(right.row.observationId));
    const top = scored[0];
    if (!top || top.pairwiseScore < (config.pairwiseScoreThreshold ?? R27_PAIRWISE_SCORE_THRESHOLD) || top.positiveProbability < config.positiveProbabilityThreshold) continue;
    const outcome = selectedEconomicOutcome(top.row);
    if (outcome === null) return Object.freeze({ selections: Object.freeze(selections), failureReason: "SELECTED_LABEL_NOT_EVALUABLE" });
    selections.push(Object.freeze({ family: config.family, candidateConfigurationId: config.candidateConfigurationId, foldId, observationId: top.row.observationId, decisionTime: top.row.decisionTime, symbol: top.row.symbol, direction: top.row.direction, positiveProbability: top.positiveProbability, pairwiseScore: top.pairwiseScore, ...outcome }));
  }
  return Object.freeze({ selections: Object.freeze(selections), failureReason: null });
}

function selectFold(
  config: R27CandidateConfiguration,
  normalized: readonly R27NormalizedRow[],
  foldId: R27FoldId,
  modelCache: ModelCache,
): FoldEvaluation {
  const validationStart = getResearchFoldRoleRange(foldId as ResearchFoldId, "VALIDATION").startTime;
  const trainingRows = normalized.filter((row) => inFoldRole(row, foldId, "RESEARCH") && row.decisionTime < validationStart - R27_PURGE_EMBARGO_HOURS * HOUR_MS);
  const validationRows = normalized.filter((row) => inFoldRole(row, foldId, "VALIDATION"));
  const positiveTraining = positiveTrainingExamples(trainingRows);
  const positiveKey = cacheKey(foldId, config.direction, config.featureSubsetId, "POSITIVE");
  let positiveModel = modelCache.get(positiveKey) ?? null;
  try {
    if (!positiveModel) {
      positiveModel = fitR27PositiveLogistic(positiveTraining.examples, config.featureNames);
      modelCache.set(positiveKey, positiveModel);
    }
    if (config.targetType === "POSITIVE_NET_PROBABILITY") {
      const selection = positiveSelection(config, foldId, positiveModel, validationRows);
      return Object.freeze({ foldId, selections: selection.selections, positiveModel, pairwiseModel: null, positiveTrainingExamples: positiveTraining.examples.length, positiveExamples: positiveTraining.positiveExamples, negativeExamples: positiveTraining.negativeExamples, pairwiseTrainingDecisionTimes: 0, pairwiseTrainingPairs: 0, failureReason: selection.failureReason });
    }
    const pairwiseTraining = pairwiseTrainingExamples(trainingRows);
    const pairwiseKey = cacheKey(foldId, config.direction, config.featureSubsetId, "PAIRWISE");
    let pairwiseModel = modelCache.get(pairwiseKey) ?? null;
    if (!pairwiseModel) {
      pairwiseModel = fitR27PairwiseLogistic(pairwiseTraining.examples, config.featureNames);
      modelCache.set(pairwiseKey, pairwiseModel);
    }
    const selection = pairwiseSelection(config, foldId, pairwiseModel, positiveModel, validationRows);
    return Object.freeze({ foldId, selections: selection.selections, positiveModel, pairwiseModel, positiveTrainingExamples: positiveTraining.examples.length, positiveExamples: positiveTraining.positiveExamples, negativeExamples: positiveTraining.negativeExamples, pairwiseTrainingDecisionTimes: pairwiseTraining.decisionTimes, pairwiseTrainingPairs: pairwiseTraining.pairs, failureReason: selection.failureReason });
  } catch (error) {
    return Object.freeze({ foldId, selections: Object.freeze([]), positiveModel: null, pairwiseModel: null, positiveTrainingExamples: positiveTraining.examples.length, positiveExamples: positiveTraining.positiveExamples, negativeExamples: positiveTraining.negativeExamples, pairwiseTrainingDecisionTimes: 0, pairwiseTrainingPairs: 0, failureReason: `MODEL_FIT_FAILED:${error instanceof Error ? error.message : String(error)}` });
  }
}

function candidateResult(config: R27CandidateConfiguration, folds: readonly FoldEvaluation[]): R27CandidateResult {
  const selections = folds.flatMap((fold) => fold.selections);
  const metrics = metricSummary(selections);
  const failureReason = folds.find((fold) => fold.failureReason)?.failureReason ?? null;
  const selectedAlertsByFold = Object.fromEntries(R27_FOLD_IDS.map((foldId) => [foldId, metrics.byFold[foldId].selectedAlerts])) as Record<R27FoldId, number>;
  return Object.freeze({
    candidateConfigurationId: config.candidateConfigurationId,
    family: config.family,
    direction: config.direction,
    targetType: config.targetType,
    featureSubsetId: config.featureSubsetId,
    featureNames: config.featureNames,
    lambda: config.lambda,
    positiveProbabilityThreshold: config.positiveProbabilityThreshold,
    pairwiseScoreThreshold: config.pairwiseScoreThreshold,
    horizonHours: 4,
    normalization: config.normalization,
    regimeGate: null,
    selectionPolicy: config.selectionPolicy,
    evaluated: true,
    selectedAlerts: selections.length,
    selectedAlertsByFold: Object.freeze(selectedAlertsByFold),
    metrics,
    gates: evaluateR27DevelopmentGates(metrics, failureReason),
    modelProvenance: Object.freeze(folds.map((fold) => Object.freeze({
      foldId: fold.foldId,
      positiveModelIdentitySha256: fold.positiveModel?.modelIdentitySha256 ?? null,
      pairwiseModelIdentitySha256: fold.pairwiseModel?.modelIdentitySha256 ?? null,
      positiveModelType: fold.positiveModel?.modelType ?? null,
      positiveTrainingExamples: fold.positiveTrainingExamples,
      positiveExamples: fold.positiveExamples,
      negativeExamples: fold.negativeExamples,
      trainingPositiveRate: fold.positiveModel?.trainingPositiveRate ?? null,
      pairwiseTrainingDecisionTimes: fold.pairwiseTrainingDecisionTimes,
      pairwiseTrainingPairs: fold.pairwiseTrainingPairs,
      status: fold.failureReason?.startsWith("MODEL_FIT_FAILED") ? "MODEL_FIT_FAILED" as const : "FIT" as const,
    }))),
  });
}

function compareEligibleCandidates(left: R27CandidateResult, right: R27CandidateResult): number {
  const leftWorst = Math.min(...R27_FOLD_IDS.map((foldId) => left.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  const rightWorst = Math.min(...R27_FOLD_IDS.map((foldId) => right.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  return rightWorst - leftWorst
    || (right.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY) - (left.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY)
    || Math.abs(left.metrics.maximumDrawdownR) - Math.abs(right.metrics.maximumDrawdownR)
    || left.candidateConfigurationId.localeCompare(right.candidateConfigurationId);
}

function selectChampion(results: readonly R27CandidateResult[], family: R27Family): R27CandidateResult | null {
  return [...results.filter((result) => result.family === family && result.gates.eligibility === "ELIGIBLE")].sort(compareEligibleCandidates)[0] ?? null;
}

function resultMarkdown(result: R27DevelopmentResult): string {
  const lines = [
    "# Round-027 Directional Target / Model Redesign — Development Result",
    "",
    `- Base: \`${result.base.branch}\` @ \`${result.base.sha}\``,
    `- Development window: \`${result.developmentWindow.start}\` through \`${result.developmentWindow.end}\``,
    "- Data classification: `DEVELOPMENT_ONLY / ALREADY_SEEN`; this historical window is not authoritative forward proof.",
    `- Source: \`${String(result.developmentDataSource.sourcePath)}\` (${String(result.developmentDataSource.observationDataSha256)})`,
    `- R27 development economic evaluation execution count: \`${result.r27DevelopmentEconomicEvaluationExecutionCount}\``,
    `- Protocol SHA-256: \`${result.protocolSha256}\``,
    "",
    "## Frozen target/model contract",
    "",
    "Exactly three LONG and three SHORT configurations were frozen before this one development evaluation. No threshold, lambda, feature, horizon, or combinatorial search was performed.",
    "",
    "| Candidate | Direction | Target | Selected | F1 | F2 | F3 | F4 | F5 | F6 | Mean net R | PF | Stress mean | 7m latency mean | Positive folds | Catastrophic folds | Symbol share | Eligibility |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const candidate of result.candidateResults) lines.push(`| ${candidate.candidateConfigurationId} | ${candidate.direction} | ${candidate.targetType} | ${candidate.selectedAlerts} | ${candidate.selectedAlertsByFold.F1} | ${candidate.selectedAlertsByFold.F2} | ${candidate.selectedAlertsByFold.F3} | ${candidate.selectedAlertsByFold.F4} | ${candidate.selectedAlertsByFold.F5} | ${candidate.selectedAlertsByFold.F6} | ${candidate.metrics.meanNetExpectancy ?? "null"} | ${candidate.metrics.netProfitFactor ?? "null"} | ${candidate.metrics.costStressMeanNetExpectancy ?? "null"} | ${candidate.metrics.latencyStressMeanNetExpectancy ?? "null"} | ${candidate.metrics.positiveTemporalFolds} | ${candidate.metrics.catastrophicFolds} | ${candidate.metrics.maximumPositiveSymbolContributionShare ?? "null"} | ${candidate.gates.eligibility} |`);
  lines.push(
    "",
    `- LONG champion: \`${result.longChampionId ?? "null"}\``,
    `- SHORT champion: \`${result.shortChampionId ?? "null"}\``,
    `- Development classification: \`${result.developmentClassification}\``,
    "",
    "## Economic and selection boundary",
    "",
    `- Cost policy: \`${R27_COST_POLICY.policyVersion}\`; both directions use the same fee, slippage, actual direction-correct Funding, causal settlement, and ${R27_MANUAL_LATENCY_MINUTES}-minute latency semantics.`,
    "- For each fold, research rows were fit after the 24h purge; validation features were scored; frozen alerts were selected; only then were selected validation economic labels read.",
    "- Non-selected validation economic values were not used for selection, threshold choice, feature choice, lambda choice, or refitting.",
    "- Forward economic values/read: `false/false`; no post-freeze or new market data was fetched.",
    "",
    "## Governance",
    "",
    "- `humanDecisionRequired=true`; `automaticTrading=false`; `Production unchanged`; `emailRestorationAuthorized=false`",
    "- `performanceExecutionCount=0`; `performanceLedgerPresent=false`; `baseline-002=NOT_FROZEN`; `M3-J=BLOCKED`; `M4=NOT_STARTED`",
    "",
    "## Final decision",
    "",
    `\`${result.finalDecision}\``,
    "",
    `Next stage: \`${result.nextStage}\``,
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

export async function runR27Development(input: Readonly<{ root?: string }> = {}): Promise<R27DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const sourcePath = resolveR27DevelopmentSource(root);
  const sourceIdentity = await assertSourceIdentity(sourcePath);
  const rows = await loadRows(sourcePath);
  if (R27_CANDIDATE_CONFIGURATIONS.length !== 6 || R27_CANDIDATE_CONFIGURATIONS.filter((config) => config.direction === "LONG").length !== 3 || R27_CANDIDATE_CONFIGURATIONS.filter((config) => config.direction === "SHORT").length !== 3) throw new Error("R27 bounded search must contain exactly three LONG and three SHORT configurations.");
  const normalizedCache = new Map<string, readonly R27NormalizedRow[]>();
  const modelCache: ModelCache = new Map();
  const candidateResults: R27CandidateResult[] = [];
  for (const config of R27_CANDIDATE_CONFIGURATIONS) {
    const normalizedKey = `${config.direction}|${config.featureSubsetId}`;
    const normalized = normalizedCache.get(normalizedKey) ?? normalizedRows(rows, config.direction, config.featureNames);
    normalizedCache.set(normalizedKey, normalized);
    const folds = R27_FOLD_IDS.map((foldId) => selectFold(config, normalized, foldId, modelCache));
    candidateResults.push(candidateResult(config, folds));
  }
  const longChampion = selectChampion(candidateResults, "LONG-CANDIDATE-FAMILY");
  const shortChampion = selectChampion(candidateResults, "SHORT-CANDIDATE-FAMILY");
  const hasChampion = Boolean(longChampion || shortChampion);
  return Object.freeze({
    schemaVersion: DEVELOPMENT_RESULT_SCHEMA,
    researchRoundId: R27_RESEARCH_ROUND_ID,
    protocolPhase: R27_PHASE,
    resultPhase: "HISTORICAL_DEVELOPMENT_ONLY",
    branch: R27_BRANCH,
    base: { branch: R27_BASE_BRANCH, sha: R27_BASE_SHA },
    protocolSha256: R27_PROTOCOL_SHA256,
    developmentWindow: { start: R27_DEVELOPMENT_DATA_START_ISO, end: R27_DEVELOPMENT_DATA_END_ISO, classification: "DEVELOPMENT_ONLY / ALREADY_SEEN" as const },
    developmentDataSource: sourceIdentity,
    r27DevelopmentEconomicEvaluationExecutionCount: 1,
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
    finalDecision: hasChampion ? "ROUND-027 DEVELOPMENT COMPLETE — PRE-OUTCOME EXECUTABLE FREEZE REQUIRED" : "ROUND-027 DIRECTIONAL DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION / NO FORWARD CANDIDATE",
    nextStage: hasChampion ? "PRE_OUTCOME_EXECUTABLE_FREEZE_REQUIRED" : "FEATURE_INFORMATION_OR_MODEL_CAPACITY_REASSESSMENT_REQUIRED",
  });
}

export async function publishR27DevelopmentResult(input: Readonly<{ root?: string }> = {}): Promise<R27DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const result = await runR27Development({ root });
  writeTextAtomically(path.join(root, RESULT_JSON_PATH), stableStringify(result));
  writeTextAtomically(path.join(root, RESULT_MARKDOWN_PATH), resultMarkdown(result));
  return result;
}

export const R27_RUNNER_IDENTITIES = Object.freeze({
  resultJsonPath: RESULT_JSON_PATH,
  protocolSha256: R27_PROTOCOL_SHA256,
  costPolicyHash: R27_COST_POLICY_HASH,
  settlementHash: R27_SETTLEMENT_HASH,
  folds: R27_FOLDS_SOURCE,
  source: R27_DEVELOPMENT_DATA_SOURCE,
  noNetworkAcquisition: true,
  noForwardLoader: true,
  developmentOnly: true,
  economicRunnerFrozenBeforeOutcomeRead: true,
});
