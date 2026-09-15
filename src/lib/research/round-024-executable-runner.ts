import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ResearchFoldId } from "./constants.ts";
import { calculateR13Drawdown } from "./r13-drawdown.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import {
  LONG_CANDIDATE_CONFIGURATIONS,
  fitLongCandidateModel,
  predictLongCandidate,
  type LongCandidateConfiguration,
  type LongFitExample,
  type LongModelArtifact,
} from "./round-024-long-candidate.ts";
import {
  SHORT_CANDIDATE_CONFIGURATIONS,
  fitShortCandidateModel,
  predictShortCandidate,
  type ShortCandidateConfiguration,
  type ShortFitExample,
  type ShortModelArtifact,
} from "./round-024-short-candidate.ts";
import {
  R24_BASE_BRANCH,
  R24_BASE_SHA,
  R24_BRANCH,
  R24_COST_POLICY,
  R24_COST_POLICY_HASH,
  R24_DEVELOPMENT_DATA_END_ISO,
  R24_DEVELOPMENT_DATA_SOURCE,
  R24_DEVELOPMENT_DATA_START_ISO,
  R24_DEVELOPMENT_GATES,
  R24_FOLD_IDS,
  R24_FOLDS_SOURCE,
  R24_GOVERNANCE,
  R24_HORIZON_HOURS,
  R24_MANUAL_LATENCY_MINUTES,
  R24_PHASE,
  R24_PROTOCOL_SHA256,
  R24_PURGE_EMBARGO_HOURS,
  R24_RESEARCH_ROUND_ID,
  R24_SETTLEMENT_HASH,
  R24_SYMBOLS,
  type R24Direction,
  type R24FoldId,
  type R24Symbol,
} from "./round-024-protocol.ts";
import { streamR14Observations, type R14ObservationFreezeManifest } from "./m3-r14-round-014-observations.ts";
import { scanR23MetadataOnly } from "./round-023-development-data.ts";
import type { R13Observation } from "./m3-r13-round-013-performance.ts";
import { stableStringify } from "./utils.ts";

const RESULT_JSON_PATH = "docs/research/round-024-directional-development-result.json" as const;
const RESULT_MARKDOWN_PATH = "docs/research/round-024-directional-development-result.md" as const;
const FREEZE_JSON_PATH = "docs/research/round-024-forward-freeze.json" as const;
const FREEZE_MARKDOWN_PATH = "docs/research/round-024-forward-freeze.md" as const;
const DEVELOPMENT_RESULT_SCHEMA = "m3-r24-directional-development-result-001" as const;
const FREEZE_SCHEMA = "m3-r24-pre-outcome-executable-freeze-001" as const;

type NumberOrNull = number | null;

type R24DevelopmentRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: R24Symbol;
  direction: R24Direction;
  features: Readonly<Record<string, number>>;
  primaryStatus: string;
  netR: NumberOrNull;
  costStressNetR: NumberOrNull;
  latencyStatus: string;
  latencyNetR: NumberOrNull;
}>;

type R24Selection = Readonly<{
  family: "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY";
  foldId: R24FoldId;
  observationId: string;
  decisionTime: number;
  symbol: R24Symbol;
  direction: R24Direction;
  prediction: number;
  netR: number;
  costStressNetR: number;
  latencyNetR: number;
}>;

type R24FoldMetric = Readonly<{
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

type R24Metrics = Readonly<{
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
  maximumSinglePositiveObservationContribution: NumberOrNull;
  byFold: Readonly<Record<R24FoldId, R24FoldMetric>>;
  bySymbol: Readonly<Record<R24Symbol, R24FoldMetric>>;
  byRegime: Readonly<{ status: "UNAVAILABLE_IN_ACCEPTED_R14_OBSERVATION_SCHEMA"; values: Readonly<Record<string, never>> }>;
}>;

type GateSummary = Readonly<{
  eligibility: "ELIGIBLE" | "INELIGIBLE";
  failedGateIds: readonly string[];
  results: readonly Readonly<{ gateId: string; passed: boolean; actualValue: number | null; requirement: string }>[];
}>;

type R24CandidateResult = Readonly<{
  candidateConfigurationId: string;
  family: "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY";
  direction: R24Direction;
  featureSubsetId: string;
  featureNames: readonly string[];
  threshold: number;
  horizonHours: 4;
  regimeGate: null;
  selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME";
  evaluated: true;
  selectedAlerts: number;
  metrics: R24Metrics;
  gates: GateSummary;
  modelProvenance: readonly Readonly<{ foldId: R24FoldId; trainingExamples: number; modelIdentitySha256: string }>[];
}>;

export type R24DevelopmentResult = Readonly<{
  schemaVersion: typeof DEVELOPMENT_RESULT_SCHEMA;
  researchRoundId: typeof R24_RESEARCH_ROUND_ID;
  protocolPhase: typeof R24_PHASE;
  resultPhase: "HISTORICAL_DEVELOPMENT_ONLY";
  branch: typeof R24_BRANCH;
  base: Readonly<{ branch: typeof R24_BASE_BRANCH; sha: typeof R24_BASE_SHA }>;
  protocolSha256: string;
  developmentWindow: Readonly<{ start: typeof R24_DEVELOPMENT_DATA_START_ISO; end: typeof R24_DEVELOPMENT_DATA_END_ISO; classification: "DEVELOPMENT_ONLY" }>;
  developmentDataSource: Readonly<Record<string, unknown>>;
  developmentEconomicEvaluationExecutionCount: 1;
  candidateConfigurationsDefined: 8;
  candidateConfigurationsEvaluated: 8;
  candidateResults: readonly R24CandidateResult[];
  longChampionId: string | null;
  shortChampionId: string | null;
  longChampionModel: LongModelArtifact | null;
  shortChampionModel: ShortModelArtifact | null;
  developmentSelectionExecuted: true;
  classification: "BOTH_HAVE_DEVELOPMENT_CHAMPION" | "LONG_ONLY_DEVELOPMENT_CHAMPION" | "SHORT_ONLY_DEVELOPMENT_CHAMPION" | "NO_DEVELOPMENT_CHAMPION" | "INVALID_DEVELOPMENT_DATA";
  historicalResultsObserved: true;
  historicalWindowNowSeen: true;
  historicalWindowReuseForAuthoritativeEvaluation: false;
  economicRunnerFrozenBeforeOutcomeRead: true;
  forwardEconomicValuesRead: false;
  forwardReturnRead: false;
  economicValuesCalculated: true;
  economicValuesInspected: true;
  newHistoricalDevelopmentDataFetched: false;
  newPostFreezeForwardDataFetched: false;
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
  finalDecision: "ROUND-024 DEVELOPMENT COMPLETE — PRE-OUTCOME FREEZE REQUIRED";
  nextStage: "PRE_OUTCOME_EXECUTABLE_FREEZE";
}>;

export type R24ForwardFreeze = Readonly<{
  schemaVersion: typeof FREEZE_SCHEMA;
  researchRoundId: typeof R24_RESEARCH_ROUND_ID;
  phase: "PRE_OUTCOME_EXECUTABLE_FREEZE";
  base: Readonly<{ branch: typeof R24_BASE_BRANCH; sha: typeof R24_BASE_SHA }>;
  sourceResult: typeof RESULT_JSON_PATH;
  longChampionId: string | null;
  shortChampionId: string | null;
  longChampionHash: string | null;
  shortChampionHash: string | null;
  featurePipelineHashes: Readonly<{ long: string | null; short: string | null }>;
  modelArtifactHashes: Readonly<{ long: string | null; short: string | null }>;
  runnerHash: string;
  costPolicyHash: string;
  settlementHash: typeof R24_SETTLEMENT_HASH;
  freezeTimestamp: string;
  freezeCommitSHA: string;
  candidateExecutableFrozen: boolean;
  forwardRule: "signalTime > freezeTimestamp";
  sameSymbolOppositeDirectionConflict: "INDEPENDENT_FAMILY_OUTPUTS_RETAINED_AND_FLAGGED";
  crossSymbolRanking: "NO_CROSS_FAMILY_RANKING";
  maxAlertsPerDecisionTime: Readonly<{ long: 1; short: 1 }>;
  tieBreak: "prediction_desc_then_symbol_order_then_observation_id_lexical";
  regimeRules: "NO_REGIME_GATE; ACCEPTED_R14_SCHEMA_HAS_NO_REGIME_IDENTITY";
  modelArtifacts: Readonly<{ long: LongModelArtifact | null; short: ShortModelArtifact | null }>;
  governance: Readonly<Record<string, unknown>>;
}>;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function directionOrder(direction: R24Direction): number {
  return direction === "LONG" ? 0 : 1;
}

function symbolOrder(symbol: R24Symbol): number {
  return R24_SYMBOLS.indexOf(symbol);
}

function compareSelections(left: R24Selection, right: R24Selection): number {
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

function maximumLosingStreak(selections: readonly R24Selection[]): number {
  let current = 0;
  let maximum = 0;
  for (const selection of [...selections].sort(compareSelections)) {
    current = selection.netR < 0 ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function metricFor(selections: readonly R24Selection[]): R24FoldMetric {
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

function metricSummary(selections: readonly R24Selection[]): R24Metrics {
  const ordered = [...selections].sort(compareSelections);
  const overall = metricFor(ordered);
  const byFold = Object.fromEntries(R24_FOLD_IDS.map((foldId) => [foldId, metricFor(ordered.filter((selection) => selection.foldId === foldId))])) as Record<R24FoldId, R24FoldMetric>;
  const bySymbol = Object.fromEntries(R24_SYMBOLS.map((symbol) => [symbol, metricFor(ordered.filter((selection) => selection.symbol === symbol))])) as Record<R24Symbol, R24FoldMetric>;
  const positive = ordered.filter((selection) => selection.netR > 0);
  const totalPositive = positive.reduce((sum, selection) => sum + selection.netR, 0);
  const positiveBySymbol = R24_SYMBOLS.map((symbol) => positive.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.netR, 0));
  const maximumPositiveSymbolContributionShare = totalPositive > 0 ? Math.max(...positiveBySymbol) / totalPositive : null;
  const maximumSinglePositiveObservationContribution = totalPositive > 0 ? Math.max(...positive.map((selection) => selection.netR)) / totalPositive : null;
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
    catastrophicFolds: Object.values(byFold).filter((value) => value.meanNetExpectancy !== null && value.meanNetExpectancy <= R24_DEVELOPMENT_GATES.catastrophicFoldThreshold).length,
    maximumPositiveSymbolContributionShare,
    maximumSinglePositiveObservationContribution,
    byFold: Object.freeze(byFold),
    bySymbol: Object.freeze(bySymbol),
    byRegime: Object.freeze({ status: "UNAVAILABLE_IN_ACCEPTED_R14_OBSERVATION_SCHEMA", values: Object.freeze({}) }),
  });
}

function evaluateGates(metrics: R24Metrics): GateSummary {
  const results = [
    { gateId: "minimumSelectedAlerts", passed: metrics.selectedAlerts >= R24_DEVELOPMENT_GATES.minimumSelectedAlerts, actualValue: metrics.selectedAlerts, requirement: `>= ${R24_DEVELOPMENT_GATES.minimumSelectedAlerts}` },
    { gateId: "minimumDistinctUtcDecisionDates", passed: metrics.distinctUtcDecisionDates >= R24_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates, actualValue: metrics.distinctUtcDecisionDates, requirement: `>= ${R24_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates}` },
    { gateId: "minimumMeanNetExpectancy", passed: metrics.meanNetExpectancy !== null && metrics.meanNetExpectancy > R24_DEVELOPMENT_GATES.minimumMeanNetExpectancy, actualValue: metrics.meanNetExpectancy, requirement: `> ${R24_DEVELOPMENT_GATES.minimumMeanNetExpectancy}` },
    { gateId: "minimumNetProfitFactor", passed: metrics.netProfitFactor !== null && metrics.netProfitFactor > R24_DEVELOPMENT_GATES.minimumNetProfitFactor, actualValue: metrics.netProfitFactor, requirement: `> ${R24_DEVELOPMENT_GATES.minimumNetProfitFactor}` },
    { gateId: "minimumPositiveTemporalFolds", passed: metrics.positiveTemporalFolds >= R24_DEVELOPMENT_GATES.minimumPositiveTemporalFolds, actualValue: metrics.positiveTemporalFolds, requirement: `>= ${R24_DEVELOPMENT_GATES.minimumPositiveTemporalFolds}` },
    { gateId: "maximumCatastrophicFolds", passed: metrics.catastrophicFolds <= R24_DEVELOPMENT_GATES.maximumCatastrophicFolds, actualValue: metrics.catastrophicFolds, requirement: `<= ${R24_DEVELOPMENT_GATES.maximumCatastrophicFolds}` },
    { gateId: "minimumCostStressMeanNetExpectancy", passed: metrics.costStressMeanNetExpectancy !== null && metrics.costStressMeanNetExpectancy > R24_DEVELOPMENT_GATES.minimumCostStressMeanNetExpectancy, actualValue: metrics.costStressMeanNetExpectancy, requirement: `> ${R24_DEVELOPMENT_GATES.minimumCostStressMeanNetExpectancy}` },
    { gateId: "minimumLatencyMeanNetExpectancy", passed: metrics.latencyStressMeanNetExpectancy !== null && metrics.latencyStressMeanNetExpectancy > R24_DEVELOPMENT_GATES.minimumLatencyMeanNetExpectancy, actualValue: metrics.latencyStressMeanNetExpectancy, requirement: `> ${R24_DEVELOPMENT_GATES.minimumLatencyMeanNetExpectancy}` },
    { gateId: "maximumPositiveSymbolContributionShare", passed: metrics.maximumPositiveSymbolContributionShare !== null && metrics.maximumPositiveSymbolContributionShare <= R24_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare, actualValue: metrics.maximumPositiveSymbolContributionShare, requirement: `<= ${R24_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare}` },
    { gateId: "maximumSinglePositiveObservationContribution", passed: metrics.maximumSinglePositiveObservationContribution !== null && metrics.maximumSinglePositiveObservationContribution <= R24_DEVELOPMENT_GATES.maximumSinglePositiveObservationContribution, actualValue: metrics.maximumSinglePositiveObservationContribution, requirement: `<= ${R24_DEVELOPMENT_GATES.maximumSinglePositiveObservationContribution}` },
  ] as const;
  return Object.freeze({ eligibility: results.every((result) => result.passed) ? "ELIGIBLE" : "INELIGIBLE", failedGateIds: Object.freeze(results.filter((result) => !result.passed).map((result) => result.gateId)), results: Object.freeze(results) });
}

function rowFromObservation(observation: R13Observation): R24DevelopmentRow {
  const primary = observation.labels[R24_HORIZON_HOURS];
  const latency = observation.latencyStressLabels[R24_HORIZON_HOURS];
  return Object.freeze({
    observationId: observation.observationId,
    decisionTime: observation.decisionTime,
    symbol: observation.symbol as R24Symbol,
    direction: observation.direction as R24Direction,
    features: observation.features,
    primaryStatus: primary.status,
    netR: finiteOrNull(primary.netForwardAtr),
    costStressNetR: finiteOrNull(primary.netForwardAtrCostStress),
    latencyStatus: latency.status,
    latencyNetR: finiteOrNull(latency.netForwardAtr),
  });
}

function sourceCandidates(root: string): readonly string[] {
  return [
    process.env.TRADEPULSE_R24_SOURCE_OBSERVATION_FILE,
    path.join(root, R24_DEVELOPMENT_DATA_SOURCE.observationPath),
    path.resolve(root, "..", "round-014-r13-execution-replay", R24_DEVELOPMENT_DATA_SOURCE.observationPath),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
}

export function resolveR24DevelopmentSource(root = process.cwd()): string {
  const source = sourceCandidates(path.resolve(root)).find((candidate) => existsSync(candidate));
  if (!source) throw new Error("R24 development source is unavailable; no network acquisition is permitted.");
  return path.resolve(source);
}

async function assertSourceIdentity(sourcePath: string): Promise<Readonly<Record<string, unknown>>> {
  const scan = await scanR23MetadataOnly(sourcePath);
  if (scan.observationDataBytes !== R24_DEVELOPMENT_DATA_SOURCE.observationDataBytes || scan.observationDataSha256 !== R24_DEVELOPMENT_DATA_SOURCE.observationDataSha256 || scan.observationCount !== 244_810 || scan.directionCounts.LONG !== 122_405 || scan.directionCounts.SHORT !== 122_405 || scan.postBoundaryRows !== 0 || scan.beforeWindowRows !== 0 || scan.duplicateObservationIds !== 0 || !scan.chronologyValid || !scan.requiredSymbolsComplete) throw new Error("R24 source does not match the accepted immutable R14 observation identity.");
  return Object.freeze({ ...R24_DEVELOPMENT_DATA_SOURCE, sourcePath, observationCount: scan.observationCount, directionCounts: scan.directionCounts, metadataOnlyEconomicValuesRead: scan.economicValuesRead });
}

async function loadRows(sourcePath: string): Promise<readonly R24DevelopmentRow[]> {
  const rows: R24DevelopmentRow[] = [];
  for await (const observation of streamR14Observations(sourcePath)) rows.push(rowFromObservation(observation));
  if (rows.length !== 244_810) throw new Error("R24 source row count does not match the accepted observation identity.");
  return Object.freeze(rows);
}

function inFoldRole(row: R24DevelopmentRow, foldId: R24FoldId, role: "RESEARCH" | "VALIDATION"): boolean {
  const range = getResearchFoldRoleRange(foldId as ResearchFoldId, role);
  return row.decisionTime >= range.startTime && row.decisionTime <= range.endTime;
}

function comparePrediction(left: Readonly<{ row: R24DevelopmentRow; prediction: number }>, right: Readonly<{ row: R24DevelopmentRow; prediction: number }>): number {
  return right.prediction - left.prediction
    || symbolOrder(left.row.symbol) - symbolOrder(right.row.symbol)
    || left.row.observationId.localeCompare(right.row.observationId);
}

function selectLongFold(config: LongCandidateConfiguration, rows: readonly R24DevelopmentRow[], foldId: R24FoldId): Readonly<{ foldId: R24FoldId; trainingExamples: number; modelIdentitySha256: string; selected: readonly R24Selection[] }> {
  const validationStart = getResearchFoldRoleRange(foldId as ResearchFoldId, "VALIDATION").startTime;
  const trainingRows = rows.filter((row) => row.direction === "LONG" && inFoldRole(row, foldId, "RESEARCH") && row.decisionTime < validationStart - R24_PURGE_EMBARGO_HOURS * 60 * 60 * 1_000 && row.primaryStatus === "EXECUTED" && row.netR !== null);
  const model = fitLongCandidateModel(trainingRows.map((row): LongFitExample => ({ features: row.features, targetNetR: row.netR! })), config.featureSubsetId);
  const validationRows = rows.filter((row) => row.direction === "LONG" && inFoldRole(row, foldId, "VALIDATION"));
  const byDecisionTime = new Map<number, R24DevelopmentRow[]>();
  for (const row of validationRows) byDecisionTime.set(row.decisionTime, [...(byDecisionTime.get(row.decisionTime) ?? []), row]);
  const selected: R24Selection[] = [];
  for (const [decisionTime, atTime] of [...byDecisionTime.entries()].sort(([left], [right]) => left - right)) {
    const ranked = atTime.map((row) => ({ row, prediction: predictLongCandidate(model, row.features) })).sort(comparePrediction);
    const top = ranked[0];
    if (!top || top.prediction < config.threshold) continue;
    if (top.row.primaryStatus !== "EXECUTED" || top.row.netR === null || top.row.costStressNetR === null || top.row.latencyStatus !== "EXECUTED" || top.row.latencyNetR === null) throw new Error(`R24 LONG ${config.candidateConfigurationId} selected an incomplete economic label at ${decisionTime}.`);
    selected.push(Object.freeze({ family: "LONG-CANDIDATE-FAMILY", foldId, observationId: top.row.observationId, decisionTime, symbol: top.row.symbol, direction: "LONG", prediction: top.prediction, netR: top.row.netR, costStressNetR: top.row.costStressNetR, latencyNetR: top.row.latencyNetR }));
  }
  return Object.freeze({ foldId, trainingExamples: trainingRows.length, modelIdentitySha256: model.modelIdentitySha256, selected: Object.freeze(selected) });
}

function selectShortFold(config: ShortCandidateConfiguration, rows: readonly R24DevelopmentRow[], foldId: R24FoldId): Readonly<{ foldId: R24FoldId; trainingExamples: number; modelIdentitySha256: string; selected: readonly R24Selection[] }> {
  const validationStart = getResearchFoldRoleRange(foldId as ResearchFoldId, "VALIDATION").startTime;
  const trainingRows = rows.filter((row) => row.direction === "SHORT" && inFoldRole(row, foldId, "RESEARCH") && row.decisionTime < validationStart - R24_PURGE_EMBARGO_HOURS * 60 * 60 * 1_000 && row.primaryStatus === "EXECUTED" && row.netR !== null);
  const model = fitShortCandidateModel(trainingRows.map((row): ShortFitExample => ({ features: row.features, targetNetR: row.netR! })), config.featureSubsetId);
  const validationRows = rows.filter((row) => row.direction === "SHORT" && inFoldRole(row, foldId, "VALIDATION"));
  const byDecisionTime = new Map<number, R24DevelopmentRow[]>();
  for (const row of validationRows) byDecisionTime.set(row.decisionTime, [...(byDecisionTime.get(row.decisionTime) ?? []), row]);
  const selected: R24Selection[] = [];
  for (const [decisionTime, atTime] of [...byDecisionTime.entries()].sort(([left], [right]) => left - right)) {
    const ranked = atTime.map((row) => ({ row, prediction: predictShortCandidate(model, row.features) })).sort(comparePrediction);
    const top = ranked[0];
    if (!top || top.prediction < config.threshold) continue;
    if (top.row.primaryStatus !== "EXECUTED" || top.row.netR === null || top.row.costStressNetR === null || top.row.latencyStatus !== "EXECUTED" || top.row.latencyNetR === null) throw new Error(`R24 SHORT ${config.candidateConfigurationId} selected an incomplete economic label at ${decisionTime}.`);
    selected.push(Object.freeze({ family: "SHORT-CANDIDATE-FAMILY", foldId, observationId: top.row.observationId, decisionTime, symbol: top.row.symbol, direction: "SHORT", prediction: top.prediction, netR: top.row.netR, costStressNetR: top.row.costStressNetR, latencyNetR: top.row.latencyNetR }));
  }
  return Object.freeze({ foldId, trainingExamples: trainingRows.length, modelIdentitySha256: model.modelIdentitySha256, selected: Object.freeze(selected) });
}

function candidateResult(config: LongCandidateConfiguration | ShortCandidateConfiguration, folds: readonly Readonly<{ foldId: R24FoldId; trainingExamples: number; modelIdentitySha256: string; selected: readonly R24Selection[] }>[]): R24CandidateResult {
  const selections = folds.flatMap((fold) => fold.selected);
  return Object.freeze({
    candidateConfigurationId: config.candidateConfigurationId,
    family: config.family,
    direction: config.direction,
    featureSubsetId: config.featureSubsetId,
    featureNames: config.featureNames,
    threshold: config.threshold,
    horizonHours: 4,
    regimeGate: null,
    selectionPolicy: config.selectionPolicy,
    evaluated: true,
    selectedAlerts: selections.length,
    metrics: metricSummary(selections),
    gates: evaluateGates(metricSummary(selections)),
    modelProvenance: Object.freeze(folds.map((fold) => Object.freeze({ foldId: fold.foldId, trainingExamples: fold.trainingExamples, modelIdentitySha256: fold.modelIdentitySha256 }))),
  });
}

function compareEligibleCandidates(left: R24CandidateResult, right: R24CandidateResult): number {
  const leftWorst = Math.min(...R24_FOLD_IDS.map((foldId) => left.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  const rightWorst = Math.min(...R24_FOLD_IDS.map((foldId) => right.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  return rightWorst - leftWorst
    || (right.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY) - (left.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY)
    || Math.abs(left.metrics.maximumDrawdownR) - Math.abs(right.metrics.maximumDrawdownR)
    || left.featureNames.length - right.featureNames.length
    || left.candidateConfigurationId.localeCompare(right.candidateConfigurationId);
}

function selectChampion(results: readonly R24CandidateResult[], family: "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY"): R24CandidateResult | null {
  return [...results.filter((result) => result.family === family && result.gates.eligibility === "ELIGIBLE")].sort(compareEligibleCandidates)[0] ?? null;
}

function allFitRows(rows: readonly R24DevelopmentRow[], direction: R24Direction): readonly R24DevelopmentRow[] {
  return rows.filter((row) => row.direction === direction && row.primaryStatus === "EXECUTED" && row.netR !== null);
}

function resultMarkdown(result: R24DevelopmentResult): string {
  const lines = [
    "# Round-024 Directional Candidate Families — Development Result",
    "",
    `- Base: \`${result.base.branch}\` @ \`${result.base.sha}\``,
    `- Development window: \`${result.developmentWindow.start}\` through \`${result.developmentWindow.end}\``,
    "- Data classification: `DEVELOPMENT_ONLY`; no authoritative forward proof.",
    `- Source: \`${String(result.developmentDataSource.sourcePath)}\` (${result.developmentDataSource.observationDataSha256})`,
    `- Development economic evaluation execution count: \`${result.developmentEconomicEvaluationExecutionCount}\``,
    `- Protocol SHA-256: \`${result.protocolSha256}\``,
    "",
    "## Independent family contract",
    "",
    "LONG and SHORT have separate feature subsets, model artifacts, thresholds, and independent top-one-per-decision-time selection. They are never represented as one model with a direction sign flip.",
    "",
    "| Family | Candidate | Selected | Mean net R | Net PF | 1.5x stress mean R | 7m latency mean R | Positive folds | Catastrophic folds | Eligibility |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const candidate of result.candidateResults) lines.push(`| ${candidate.family} | ${candidate.candidateConfigurationId} | ${candidate.metrics.selectedAlerts} | ${candidate.metrics.meanNetExpectancy ?? "null"} | ${candidate.metrics.netProfitFactor ?? "null"} | ${candidate.metrics.costStressMeanNetExpectancy ?? "null"} | ${candidate.metrics.latencyStressMeanNetExpectancy ?? "null"} | ${candidate.metrics.positiveTemporalFolds} | ${candidate.metrics.catastrophicFolds} | ${candidate.gates.eligibility} |`);
  lines.push(
    "",
    `- LONG champion: \`${result.longChampionId ?? "null"}\``,
    `- SHORT champion: \`${result.shortChampionId ?? "null"}\``,
    `- Development classification: \`${result.classification}\``,
    "",
    "## Economic boundary",
    "",
    `- Cost policy: \`${R24_COST_POLICY.policyVersion}\`; fees, slippage, direction-correct Funding, settlement, and ${R24_MANUAL_LATENCY_MINUTES}-minute manual latency are shared by both families.`,
    "- Historical label values were read only from the accepted existing R14 observation freeze for development evaluation.",
    "- Forward economic values/read: `false/false`.",
    "- New historical or post-freeze market data fetched: `false/false`.",
    "- Regime breakdown: `UNAVAILABLE_IN_ACCEPTED_R14_OBSERVATION_SCHEMA`; no regime gate or proxy was introduced.",
    "",
    "## Governance",
    "",
    "- `humanDecisionRequired=true`",
    "- `automaticTrading=false`",
    "- `Production unchanged`",
    "- `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, `M4=NOT_STARTED`",
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

export async function runR24Development(input: Readonly<{ root?: string }> = {}): Promise<R24DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const sourcePath = resolveR24DevelopmentSource(root);
  const sourceIdentity = await assertSourceIdentity(sourcePath);
  const rows = await loadRows(sourcePath);
  const candidateResults: R24CandidateResult[] = [];
  for (const config of LONG_CANDIDATE_CONFIGURATIONS) candidateResults.push(candidateResult(config, R24_FOLD_IDS.map((foldId) => selectLongFold(config, rows, foldId))));
  for (const config of SHORT_CANDIDATE_CONFIGURATIONS) candidateResults.push(candidateResult(config, R24_FOLD_IDS.map((foldId) => selectShortFold(config, rows, foldId))));
  const longChampion = selectChampion(candidateResults, "LONG-CANDIDATE-FAMILY");
  const shortChampion = selectChampion(candidateResults, "SHORT-CANDIDATE-FAMILY");
  const longModel = longChampion ? fitLongCandidateModel(allFitRows(rows, "LONG").map((row): LongFitExample => ({ features: row.features, targetNetR: row.netR! })), longChampion.featureSubsetId as "LONG_TREND_PULLBACK_VOLUME" | "LONG_SLOPE_VOLATILITY_FLOW") : null;
  const shortModel = shortChampion ? fitShortCandidateModel(allFitRows(rows, "SHORT").map((row): ShortFitExample => ({ features: row.features, targetNetR: row.netR! })), shortChampion.featureSubsetId as "SHORT_TREND_VOLATILITY_FUNDING" | "SHORT_RELATIVE_FLOW_FUNDING") : null;
  const classification = longChampion && shortChampion ? "BOTH_HAVE_DEVELOPMENT_CHAMPION" : longChampion ? "LONG_ONLY_DEVELOPMENT_CHAMPION" : shortChampion ? "SHORT_ONLY_DEVELOPMENT_CHAMPION" : "NO_DEVELOPMENT_CHAMPION";
  return Object.freeze({
    schemaVersion: DEVELOPMENT_RESULT_SCHEMA,
    researchRoundId: R24_RESEARCH_ROUND_ID,
    protocolPhase: R24_PHASE,
    resultPhase: "HISTORICAL_DEVELOPMENT_ONLY",
    branch: R24_BRANCH,
    base: { branch: R24_BASE_BRANCH, sha: R24_BASE_SHA },
    protocolSha256: R24_PROTOCOL_SHA256,
    developmentWindow: { start: R24_DEVELOPMENT_DATA_START_ISO, end: R24_DEVELOPMENT_DATA_END_ISO, classification: "DEVELOPMENT_ONLY" as const },
    developmentDataSource: sourceIdentity,
    developmentEconomicEvaluationExecutionCount: 1,
    candidateConfigurationsDefined: 8,
    candidateConfigurationsEvaluated: 8 as const,
    candidateResults: Object.freeze(candidateResults),
    longChampionId: longChampion?.candidateConfigurationId ?? null,
    shortChampionId: shortChampion?.candidateConfigurationId ?? null,
    longChampionModel: longModel,
    shortChampionModel: shortModel,
    developmentSelectionExecuted: true,
    classification,
    historicalResultsObserved: true,
    historicalWindowNowSeen: true,
    historicalWindowReuseForAuthoritativeEvaluation: false,
    economicRunnerFrozenBeforeOutcomeRead: true,
    forwardEconomicValuesRead: false,
    forwardReturnRead: false,
    economicValuesCalculated: true,
    economicValuesInspected: true,
    newHistoricalDevelopmentDataFetched: false,
    newPostFreezeForwardDataFetched: false,
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
    finalDecision: "ROUND-024 DEVELOPMENT COMPLETE — PRE-OUTCOME FREEZE REQUIRED",
    nextStage: "PRE_OUTCOME_EXECUTABLE_FREEZE",
  });
}

export async function publishR24DevelopmentResult(input: Readonly<{ root?: string }> = {}): Promise<R24DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const result = await runR24Development({ root });
  writeTextAtomically(path.join(root, RESULT_JSON_PATH), stableStringify(result));
  writeTextAtomically(path.join(root, RESULT_MARKDOWN_PATH), resultMarkdown(result));
  return result;
}

function fileSha256(root: string, relativePath: string): string {
  return sha256(readFileSync(path.join(root, relativePath)));
}

function featurePipelineHash(model: LongModelArtifact | ShortModelArtifact | null): string | null {
  return model ? sha256(stableStringify({ featureNames: model.featureNames, modelType: model.modelType, family: model.family })) : null;
}

export function buildR24ForwardFreeze(input: Readonly<{ root?: string; result: R24DevelopmentResult; freezeTimestamp: string; freezeCommitSHA: string }>): R24ForwardFreeze {
  const root = path.resolve(input.root ?? process.cwd());
  if (!input.freezeCommitSHA || !/^[0-9a-f]{40}$/.test(input.freezeCommitSHA)) throw new Error("R24 freezeCommitSHA must be a verified commit SHA.");
  if (!Number.isFinite(Date.parse(input.freezeTimestamp))) throw new Error("R24 freezeTimestamp must be an ISO timestamp.");
  const longModel = input.result.longChampionModel;
  const shortModel = input.result.shortChampionModel;
  return Object.freeze({
    schemaVersion: FREEZE_SCHEMA,
    researchRoundId: R24_RESEARCH_ROUND_ID,
    phase: "PRE_OUTCOME_EXECUTABLE_FREEZE",
    base: { branch: R24_BASE_BRANCH, sha: R24_BASE_SHA },
    sourceResult: RESULT_JSON_PATH,
    longChampionId: input.result.longChampionId,
    shortChampionId: input.result.shortChampionId,
    longChampionHash: longModel?.modelIdentitySha256 ?? null,
    shortChampionHash: shortModel?.modelIdentitySha256 ?? null,
    featurePipelineHashes: { long: featurePipelineHash(longModel), short: featurePipelineHash(shortModel) },
    modelArtifactHashes: { long: longModel?.modelIdentitySha256 ?? null, short: shortModel?.modelIdentitySha256 ?? null },
    runnerHash: fileSha256(root, "src/lib/research/round-024-executable-runner.ts"),
    costPolicyHash: R24_COST_POLICY_HASH,
    settlementHash: R24_SETTLEMENT_HASH,
    freezeTimestamp: input.freezeTimestamp,
    freezeCommitSHA: input.freezeCommitSHA,
    candidateExecutableFrozen: Boolean(longModel || shortModel),
    forwardRule: "signalTime > freezeTimestamp",
    sameSymbolOppositeDirectionConflict: "INDEPENDENT_FAMILY_OUTPUTS_RETAINED_AND_FLAGGED",
    crossSymbolRanking: "NO_CROSS_FAMILY_RANKING",
    maxAlertsPerDecisionTime: { long: 1 as const, short: 1 as const },
    tieBreak: "prediction_desc_then_symbol_order_then_observation_id_lexical",
    regimeRules: "NO_REGIME_GATE; ACCEPTED_R14_SCHEMA_HAS_NO_REGIME_IDENTITY",
    modelArtifacts: { long: longModel, short: shortModel },
    governance: { ...R24_GOVERNANCE, performanceExecutionCount: 0, performanceLedgerPresent: false, candidateExecutableFrozen: Boolean(longModel || shortModel) },
  });
}

export function freezeMarkdown(freeze: R24ForwardFreeze): string {
  return [
    "# Round-024 Pre-Outcome Executable Freeze",
    "",
    "This artifact freezes the executable directional family contract before any unseen/forward outcome is read.",
    "",
    `- Freeze commit: \`${freeze.freezeCommitSHA}\``,
    `- Freeze timestamp: \`${freeze.freezeTimestamp}\``,
    `- Forward rule: \`${freeze.forwardRule}\``,
    `- Candidate executable frozen: \`${freeze.candidateExecutableFrozen}\``,
    `- LONG champion: \`${freeze.longChampionId ?? "null"}\` / \`${freeze.longChampionHash ?? "null"}\``,
    `- SHORT champion: \`${freeze.shortChampionId ?? "null"}\` / \`${freeze.shortChampionHash ?? "null"}\``,
    `- Runner hash: \`${freeze.runnerHash}\``,
    `- Cost policy hash: \`${freeze.costPolicyHash}\``,
    `- Settlement hash: \`${freeze.settlementHash}\``,
    "",
    "## Frozen execution semantics",
    "",
    "- LONG and SHORT use independent pipelines, model artifacts, thresholds, and family-local top-one selection.",
    "- Same-symbol opposite-direction outputs are retained independently and flagged; there is no cross-family ranking.",
    "- Fees, slippage, Funding, settlement, intrabar ambiguity handling, and seven-minute manual latency are shared by policy.",
    "- The accepted R14 schema contains no authoritative regime identity, so no regime gate or proxy is used.",
    "- No 2026-08-16-to-freeze data is included in authoritative prospective evidence.",
    "",
    "## Governance",
    "",
    "`forwardEconomicValuesRead=false`  ",
    "`forwardReturnRead=false`  ",
    "`performanceExecutionCount=0`  ",
    "`automaticTrading=false`  ",
    "`Production unchanged`  ",
    "`emailRestorationAuthorized=false`",
    "",
  ].join("\n");
}

export function publishR24ForwardFreeze(input: Readonly<{ root?: string; result: R24DevelopmentResult; freezeTimestamp: string; freezeCommitSHA: string }>): R24ForwardFreeze {
  const root = path.resolve(input.root ?? process.cwd());
  const freeze = buildR24ForwardFreeze(input);
  writeTextAtomically(path.join(root, FREEZE_JSON_PATH), stableStringify(freeze));
  writeTextAtomically(path.join(root, FREEZE_MARKDOWN_PATH), freezeMarkdown(freeze));
  return freeze;
}

export function readR24ObservationFreezeManifest(root = process.cwd()): R14ObservationFreezeManifest {
  const manifestPath = path.join(path.resolve(root), "docs/research/round-014-observation-freeze.json");
  if (!existsSync(manifestPath)) throw new Error("Accepted R14 observation freeze manifest is missing.");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as R14ObservationFreezeManifest;
}

export const R24_RUNNER_IDENTITIES = Object.freeze({
  resultJsonPath: RESULT_JSON_PATH,
  freezeJsonPath: FREEZE_JSON_PATH,
  protocolSha256: R24_PROTOCOL_SHA256,
  costPolicyHash: R24_COST_POLICY_HASH,
  settlementHash: R24_SETTLEMENT_HASH,
  folds: R24_FOLDS_SOURCE,
  source: R24_DEVELOPMENT_DATA_SOURCE,
  noStubMarker: true,
});
