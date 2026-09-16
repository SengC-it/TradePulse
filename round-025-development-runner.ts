import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ResearchFoldId } from "./constants.ts";
import { calculateR13Drawdown } from "./r13-drawdown.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { streamR14Observations, type R14ObservationFreezeManifest } from "./m3-r14-round-014-observations.ts";
import type { R13Observation } from "./m3-r13-round-013-performance.ts";
import { scanR23MetadataOnly } from "./round-023-development-data.ts";
import {
  R25_BASE_BRANCH,
  R25_BASE_SHA,
  R25_BRANCH,
  R25_COST_POLICY,
  R25_COST_POLICY_HASH,
  R25_DEVELOPMENT_DATA_END_ISO,
  R25_DEVELOPMENT_DATA_SOURCE,
  R25_DEVELOPMENT_DATA_START_ISO,
  R25_DEVELOPMENT_GATES,
  R25_FOLD_IDS,
  R25_FOLDS_SOURCE,
  R25_HORIZON_HOURS,
  R25_MANUAL_LATENCY_MINUTES,
  R25_PROTOCOL_SHA256,
  R25_PURGE_EMBARGO_HOURS,
  R25_RESEARCH_ROUND_ID,
  R25_SETTLEMENT_HASH,
  R25_SYMBOLS,
  type R25Direction,
  type R25FoldId,
  type R25Symbol,
} from "./round-025-protocol.ts";
import {
  predictR25Candidate,
  fitR25CandidateModel,
  R25_LONG_CANDIDATE_CONFIGURATIONS,
  R25_SHORT_CANDIDATE_CONFIGURATIONS,
  type R25CandidateConfiguration,
  type R25FitExample,
  type R25ModelArtifact,
} from "./round-025-candidate-model.ts";
import { stableStringify } from "./utils.ts";

const RESULT_JSON_PATH = "docs/research/round-025-directional-development-result.json" as const;
const RESULT_MARKDOWN_PATH = "docs/research/round-025-directional-development-result.md" as const;
const DEVELOPMENT_RESULT_SCHEMA = "m3-r25-targeted-directional-development-result-001" as const;

type NumberOrNull = number | null;

type R25DevelopmentRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: R25Symbol;
  direction: R25Direction;
  features: Readonly<Record<string, number>>;
  primaryStatus: string;
  netR: NumberOrNull;
  costStressNetR: NumberOrNull;
  latencyStatus: string;
  latencyNetR: NumberOrNull;
}>;

type R25Selection = Readonly<{
  family: "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY";
  foldId: R25FoldId;
  observationId: string;
  decisionTime: number;
  symbol: R25Symbol;
  direction: R25Direction;
  prediction: number;
  netR: number;
  costStressNetR: number;
  latencyNetR: number;
}>;

type R25FoldMetric = Readonly<{
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

type R25Metrics = Readonly<{
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
  byFold: Readonly<Record<R25FoldId, R25FoldMetric>>;
  bySymbol: Readonly<Record<R25Symbol, R25FoldMetric>>;
  byRegime: Readonly<{ status: "UNAVAILABLE_IN_ACCEPTED_R14_OBSERVATION_SCHEMA"; values: Readonly<Record<string, never>> }>;
}>;

type GateSummary = Readonly<{
  eligibility: "ELIGIBLE" | "INELIGIBLE";
  failedGateIds: readonly string[];
  results: readonly Readonly<{ gateId: string; passed: boolean; actualValue: number | null; requirement: string }>[];
}>;

export type R25CandidateResult = Readonly<{
  candidateConfigurationId: string;
  family: "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY";
  direction: R25Direction;
  featureSubsetId: string;
  featureNames: readonly string[];
  lambda: number;
  threshold: number;
  horizonHours: 4;
  normalization: string;
  regimeGate: null;
  selectionPolicy: "INDEPENDENT_TOP_ONE_PER_DECISION_TIME";
  evaluated: true;
  selectedAlerts: number;
  metrics: R25Metrics;
  gates: GateSummary;
  modelProvenance: readonly Readonly<{ foldId: R25FoldId; trainingExamples: number; modelIdentitySha256: string }>[];
}>;

export type R25DevelopmentResult = Readonly<{
  schemaVersion: typeof DEVELOPMENT_RESULT_SCHEMA;
  researchRoundId: typeof R25_RESEARCH_ROUND_ID;
  protocolPhase: "BOUNDED_DEVELOPMENT_ONLY";
  resultPhase: "HISTORICAL_DEVELOPMENT_ONLY";
  branch: typeof R25_BRANCH;
  base: Readonly<{ branch: typeof R25_BASE_BRANCH; sha: typeof R25_BASE_SHA }>;
  protocolSha256: string;
  developmentWindow: Readonly<{ start: typeof R25_DEVELOPMENT_DATA_START_ISO; end: typeof R25_DEVELOPMENT_DATA_END_ISO; classification: "DEVELOPMENT_ONLY" }>;
  developmentDataSource: Readonly<Record<string, unknown>>;
  developmentEconomicEvaluationExecutionCount: 1;
  candidateConfigurationsDefined: 6;
  candidateConfigurationsEvaluated: 6;
  candidateResults: readonly R25CandidateResult[];
  longChampionId: string | null;
  shortChampionId: string | null;
  longChampionModel: R25ModelArtifact | null;
  shortChampionModel: R25ModelArtifact | null;
  developmentSelectionExecuted: true;
  developmentClassification: "NO_DEVELOPMENT_CHAMPION" | "DEVELOPMENT_CHAMPION_REQUIRES_PRE_OUTCOME_EXECUTABLE_FREEZE";
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
  finalDecision: "ROUND-025 DIRECTIONAL DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION / NO FORWARD CANDIDATE" | "ROUND-025 DEVELOPMENT COMPLETE — PRE-OUTCOME EXECUTABLE FREEZE REQUIRED";
  nextStage: "DIRECTIONAL_CANDIDATE_REDESIGN_REQUIRED" | "PRE_OUTCOME_EXECUTABLE_FREEZE_REQUIRED";
}>;

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function directionOrder(direction: R25Direction): number {
  return direction === "LONG" ? 0 : 1;
}

function symbolOrder(symbol: R25Symbol): number {
  return R25_SYMBOLS.indexOf(symbol);
}

function compareSelections(left: R25Selection, right: R25Selection): number {
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

function maximumLosingStreak(selections: readonly R25Selection[]): number {
  let current = 0;
  let maximum = 0;
  for (const selection of [...selections].sort(compareSelections)) {
    current = selection.netR < 0 ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function metricFor(selections: readonly R25Selection[]): R25FoldMetric {
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

function metricSummary(selections: readonly R25Selection[]): R25Metrics {
  const ordered = [...selections].sort(compareSelections);
  const overall = metricFor(ordered);
  const byFold = Object.fromEntries(R25_FOLD_IDS.map((foldId) => [foldId, metricFor(ordered.filter((selection) => selection.foldId === foldId))])) as Record<R25FoldId, R25FoldMetric>;
  const bySymbol = Object.fromEntries(R25_SYMBOLS.map((symbol) => [symbol, metricFor(ordered.filter((selection) => selection.symbol === symbol))])) as Record<R25Symbol, R25FoldMetric>;
  const positive = ordered.filter((selection) => selection.netR > 0);
  const totalPositive = positive.reduce((sum, selection) => sum + selection.netR, 0);
  const positiveBySymbol = R25_SYMBOLS.map((symbol) => positive.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.netR, 0));
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
    catastrophicFolds: Object.values(byFold).filter((value) => value.meanNetExpectancy !== null && value.meanNetExpectancy <= R25_DEVELOPMENT_GATES.catastrophicFoldThreshold).length,
    maximumPositiveSymbolContributionShare: totalPositive > 0 ? Math.max(...positiveBySymbol) / totalPositive : null,
    maximumSinglePositiveObservationContribution: totalPositive > 0 ? Math.max(...positive.map((selection) => selection.netR)) / totalPositive : null,
    byFold: Object.freeze(byFold),
    bySymbol: Object.freeze(bySymbol),
    byRegime: Object.freeze({ status: "UNAVAILABLE_IN_ACCEPTED_R14_OBSERVATION_SCHEMA", values: Object.freeze({}) }),
  });
}

function evaluateGates(metrics: R25Metrics): GateSummary {
  const results = [
    { gateId: "minimumSelectedAlerts", passed: metrics.selectedAlerts >= R25_DEVELOPMENT_GATES.minimumSelectedAlerts, actualValue: metrics.selectedAlerts, requirement: `>= ${R25_DEVELOPMENT_GATES.minimumSelectedAlerts}` },
    { gateId: "minimumDistinctUtcDecisionDates", passed: metrics.distinctUtcDecisionDates >= R25_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates, actualValue: metrics.distinctUtcDecisionDates, requirement: `>= ${R25_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates}` },
    { gateId: "minimumMeanNetExpectancy", passed: metrics.meanNetExpectancy !== null && metrics.meanNetExpectancy > R25_DEVELOPMENT_GATES.minimumMeanNetExpectancy, actualValue: metrics.meanNetExpectancy, requirement: `> ${R25_DEVELOPMENT_GATES.minimumMeanNetExpectancy}` },
    { gateId: "minimumNetProfitFactor", passed: metrics.netProfitFactor !== null && metrics.netProfitFactor > R25_DEVELOPMENT_GATES.minimumNetProfitFactor, actualValue: metrics.netProfitFactor, requirement: `> ${R25_DEVELOPMENT_GATES.minimumNetProfitFactor}` },
    { gateId: "minimumPositiveTemporalFolds", passed: metrics.positiveTemporalFolds >= R25_DEVELOPMENT_GATES.minimumPositiveTemporalFolds, actualValue: metrics.positiveTemporalFolds, requirement: `>= ${R25_DEVELOPMENT_GATES.minimumPositiveTemporalFolds}` },
    { gateId: "maximumCatastrophicFolds", passed: metrics.catastrophicFolds <= R25_DEVELOPMENT_GATES.maximumCatastrophicFolds, actualValue: metrics.catastrophicFolds, requirement: `<= ${R25_DEVELOPMENT_GATES.maximumCatastrophicFolds}` },
    { gateId: "minimumCostStressMeanNetExpectancy", passed: metrics.costStressMeanNetExpectancy !== null && metrics.costStressMeanNetExpectancy > R25_DEVELOPMENT_GATES.minimumCostStressMeanNetExpectancy, actualValue: metrics.costStressMeanNetExpectancy, requirement: `> ${R25_DEVELOPMENT_GATES.minimumCostStressMeanNetExpectancy}` },
    { gateId: "minimumLatencyMeanNetExpectancy", passed: metrics.latencyStressMeanNetExpectancy !== null && metrics.latencyStressMeanNetExpectancy > R25_DEVELOPMENT_GATES.minimumLatencyMeanNetExpectancy, actualValue: metrics.latencyStressMeanNetExpectancy, requirement: `> ${R25_DEVELOPMENT_GATES.minimumLatencyMeanNetExpectancy}` },
    { gateId: "maximumPositiveSymbolContributionShare", passed: metrics.maximumPositiveSymbolContributionShare !== null && metrics.maximumPositiveSymbolContributionShare <= R25_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare, actualValue: metrics.maximumPositiveSymbolContributionShare, requirement: `<= ${R25_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare}` },
  ] as const;
  return Object.freeze({ eligibility: results.every((result) => result.passed) ? "ELIGIBLE" : "INELIGIBLE", failedGateIds: Object.freeze(results.filter((result) => !result.passed).map((result) => result.gateId)), results: Object.freeze(results) });
}

function rowFromObservation(observation: R13Observation): R25DevelopmentRow {
  const primary = observation.labels[R25_HORIZON_HOURS];
  const latency = observation.latencyStressLabels[R25_HORIZON_HOURS];
  return Object.freeze({
    observationId: observation.observationId,
    decisionTime: observation.decisionTime,
    symbol: observation.symbol as R25Symbol,
    direction: observation.direction as R25Direction,
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
    process.env.TRADEPULSE_R25_SOURCE_OBSERVATION_FILE,
    path.join(root, R25_DEVELOPMENT_DATA_SOURCE.canonicalObservationPath),
    path.resolve(root, "..", "round-014-r13-execution-replay", R25_DEVELOPMENT_DATA_SOURCE.canonicalObservationPath),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
}

export function resolveR25DevelopmentSource(root = process.cwd()): string {
  const source = sourceCandidates(path.resolve(root)).find((candidate) => existsSync(candidate));
  if (!source) throw new Error("R25 development source is unavailable; network acquisition is forbidden.");
  return path.resolve(source);
}

async function assertSourceIdentity(sourcePath: string): Promise<Readonly<Record<string, unknown>>> {
  const scan = await scanR23MetadataOnly(sourcePath);
  if (scan.observationDataBytes !== R25_DEVELOPMENT_DATA_SOURCE.observationDataBytes || scan.observationDataSha256 !== R25_DEVELOPMENT_DATA_SOURCE.observationDataSha256 || scan.observationCount !== R25_DEVELOPMENT_DATA_SOURCE.observationCount || scan.directionCounts.LONG !== 122_405 || scan.directionCounts.SHORT !== 122_405 || scan.postBoundaryRows !== 0 || scan.beforeWindowRows !== 0 || scan.duplicateObservationIds !== 0 || !scan.chronologyValid || !scan.requiredSymbolsComplete) throw new Error("R25 source does not match the accepted immutable R14 observation identity.");
  return Object.freeze({ ...R25_DEVELOPMENT_DATA_SOURCE, sourcePath: R25_DEVELOPMENT_DATA_SOURCE.canonicalObservationPath, metadataOnlyEconomicValuesRead: scan.economicValuesRead });
}

async function loadRows(sourcePath: string): Promise<readonly R25DevelopmentRow[]> {
  const rows: R25DevelopmentRow[] = [];
  for await (const observation of streamR14Observations(sourcePath)) rows.push(rowFromObservation(observation));
  if (rows.length !== R25_DEVELOPMENT_DATA_SOURCE.observationCount) throw new Error("R25 source row count does not match the accepted observation identity.");
  return Object.freeze(rows);
}

function inFoldRole(row: R25DevelopmentRow, foldId: R25FoldId, role: "RESEARCH" | "VALIDATION"): boolean {
  const range = getResearchFoldRoleRange(foldId as ResearchFoldId, role);
  return row.decisionTime >= range.startTime && row.decisionTime <= range.endTime;
}

function crossSectionalNormalize(rows: readonly R25DevelopmentRow[]): readonly R25DevelopmentRow[] {
  const grouped = new Map<number, R25DevelopmentRow[]>();
  for (const row of rows) grouped.set(row.decisionTime, [...(grouped.get(row.decisionTime) ?? []), row]);
  const normalized: R25DevelopmentRow[] = [];
  for (const row of rows) {
    const peers = grouped.get(row.decisionTime) ?? [row];
    const featureNames = Object.keys(row.features);
    const features = Object.fromEntries(featureNames.map((name) => {
      const values = peers.map((peer) => peer.features[name]!);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
      const deviation = Math.sqrt(variance) || 1;
      return [name, (row.features[name]! - average) / deviation];
    }));
    normalized.push(Object.freeze({ ...row, features: Object.freeze(features) }));
  }
  return Object.freeze(normalized);
}

function normalizedRows(rows: readonly R25DevelopmentRow[], config: R25CandidateConfiguration): readonly R25DevelopmentRow[] {
  if (config.normalization !== "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME") throw new Error("R25 normalization is not frozen.");
  return crossSectionalNormalize(rows);
}

function comparePrediction(left: Readonly<{ row: R25DevelopmentRow; prediction: number }>, right: Readonly<{ row: R25DevelopmentRow; prediction: number }>): number {
  return right.prediction - left.prediction
    || symbolOrder(left.row.symbol) - symbolOrder(right.row.symbol)
    || left.row.observationId.localeCompare(right.row.observationId);
}

function selectFold(config: R25CandidateConfiguration, rows: readonly R25DevelopmentRow[], foldId: R25FoldId): Readonly<{ foldId: R25FoldId; trainingExamples: number; modelIdentitySha256: string; selected: readonly R25Selection[] }> {
  const validationStart = getResearchFoldRoleRange(foldId as ResearchFoldId, "VALIDATION").startTime;
  const trainingRows = rows.filter((row) => row.direction === config.direction && inFoldRole(row, foldId, "RESEARCH") && row.decisionTime < validationStart - R25_PURGE_EMBARGO_HOURS * 60 * 60 * 1_000 && row.primaryStatus === "EXECUTED" && row.netR !== null);
  const trainingNormalized = normalizedRows(trainingRows, config);
  const model = fitR25CandidateModel(trainingNormalized.map((row): R25FitExample => ({ features: row.features, targetNetR: row.netR! })), config);
  const validationRows = normalizedRows(rows.filter((row) => row.direction === config.direction && inFoldRole(row, foldId, "VALIDATION")), config);
  const byDecisionTime = new Map<number, R25DevelopmentRow[]>();
  for (const row of validationRows) byDecisionTime.set(row.decisionTime, [...(byDecisionTime.get(row.decisionTime) ?? []), row]);
  const selected: R25Selection[] = [];
  for (const [decisionTime, atTime] of [...byDecisionTime.entries()].sort(([left], [right]) => left - right)) {
    const ranked = atTime.map((row) => ({ row, prediction: predictR25Candidate(model, row.features) })).sort(comparePrediction);
    const top = ranked[0];
    if (!top || top.prediction < config.threshold) continue;
    if (top.row.primaryStatus !== "EXECUTED" || top.row.netR === null || top.row.costStressNetR === null || top.row.latencyStatus !== "EXECUTED" || top.row.latencyNetR === null) throw new Error(`R25 ${config.direction} ${config.candidateConfigurationId} selected an incomplete economic label at ${decisionTime}.`);
    selected.push(Object.freeze({ family: config.family, foldId, observationId: top.row.observationId, decisionTime, symbol: top.row.symbol, direction: config.direction, prediction: top.prediction, netR: top.row.netR, costStressNetR: top.row.costStressNetR, latencyNetR: top.row.latencyNetR }));
  }
  return Object.freeze({ foldId, trainingExamples: trainingRows.length, modelIdentitySha256: model.modelIdentitySha256, selected: Object.freeze(selected) });
}

function candidateResult(config: R25CandidateConfiguration, folds: readonly Readonly<{ foldId: R25FoldId; trainingExamples: number; modelIdentitySha256: string; selected: readonly R25Selection[] }>[]): R25CandidateResult {
  const selections = folds.flatMap((fold) => fold.selected);
  const metrics = metricSummary(selections);
  return Object.freeze({
    candidateConfigurationId: config.candidateConfigurationId,
    family: config.family,
    direction: config.direction,
    featureSubsetId: config.featureSubsetId,
    featureNames: config.featureNames,
    lambda: config.lambda,
    threshold: config.threshold,
    horizonHours: 4,
    normalization: config.normalization,
    regimeGate: null,
    selectionPolicy: config.selectionPolicy,
    evaluated: true,
    selectedAlerts: selections.length,
    metrics,
    gates: evaluateGates(metrics),
    modelProvenance: Object.freeze(folds.map((fold) => Object.freeze({ foldId: fold.foldId, trainingExamples: fold.trainingExamples, modelIdentitySha256: fold.modelIdentitySha256 }))),
  });
}

function compareEligibleCandidates(left: R25CandidateResult, right: R25CandidateResult): number {
  const leftWorst = Math.min(...R25_FOLD_IDS.map((foldId) => left.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  const rightWorst = Math.min(...R25_FOLD_IDS.map((foldId) => right.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  return rightWorst - leftWorst
    || (right.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY) - (left.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY)
    || Math.abs(left.metrics.maximumDrawdownR) - Math.abs(right.metrics.maximumDrawdownR)
    || left.candidateConfigurationId.localeCompare(right.candidateConfigurationId);
}

function selectChampion(results: readonly R25CandidateResult[], family: "LONG-CANDIDATE-FAMILY" | "SHORT-CANDIDATE-FAMILY"): R25CandidateResult | null {
  return [...results.filter((result) => result.family === family && result.gates.eligibility === "ELIGIBLE")].sort(compareEligibleCandidates)[0] ?? null;
}

function resultMarkdown(result: R25DevelopmentResult): string {
  const lines = [
    "# Round-025 Targeted Directional Candidate Redesign — Development Result",
    "",
    `- Base: \`${result.base.branch}\` @ \`${result.base.sha}\``,
    `- Development window: \`${result.developmentWindow.start}\` through \`${result.developmentWindow.end}\``,
    "- Data classification: `DEVELOPMENT_ONLY`; the seen historical window is not authoritative forward proof.",
    `- Source: \`${String(result.developmentDataSource.sourcePath)}\` (${result.developmentDataSource.observationDataSha256})`,
    `- Development economic evaluation execution count: \`${result.developmentEconomicEvaluationExecutionCount}\``,
    `- Protocol SHA-256: \`${result.protocolSha256}\``,
    "",
    "## Bounded search contract",
    "",
    "Exactly three pre-frozen LONG configurations and three pre-frozen SHORT configurations were evaluated once. Cross-sectional z-score normalization is computed only from closed-candle rows at the same decision time; no outcome is used by the normalization.",
    "",
    "| Family | Candidate | Selected | Mean net R | Net PF | 1.5x stress mean R | 7m latency mean R | Positive folds | Catastrophic folds | Symbol share | Eligibility |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const candidate of result.candidateResults) lines.push(`| ${candidate.family} | ${candidate.candidateConfigurationId} | ${candidate.metrics.selectedAlerts} | ${candidate.metrics.meanNetExpectancy ?? "null"} | ${candidate.metrics.netProfitFactor ?? "null"} | ${candidate.metrics.costStressMeanNetExpectancy ?? "null"} | ${candidate.metrics.latencyStressMeanNetExpectancy ?? "null"} | ${candidate.metrics.positiveTemporalFolds} | ${candidate.metrics.catastrophicFolds} | ${candidate.metrics.maximumPositiveSymbolContributionShare ?? "null"} | ${candidate.gates.eligibility} |`);
  lines.push(
    "",
    `- LONG champion: \`${result.longChampionId ?? "null"}\``,
    `- SHORT champion: \`${result.shortChampionId ?? "null"}\``,
    `- Development classification: \`${result.developmentClassification}\``,
    "",
    "## Economic boundary",
    "",
    `- Cost policy: \`${R25_COST_POLICY.policyVersion}\`; fees, slippage, direction-correct Funding, causal settlement, and ${R25_MANUAL_LATENCY_MINUTES}-minute manual latency are shared by both families.`,
    "- Historical label values were read only from the accepted existing R14 observation freeze for this one development evaluation.",
    "- Forward economic values/read: `false/false`.",
    "- No new historical or post-freeze market data was fetched.",
    "- No executable freeze or forward validation was authorized by this development result.",
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

export function readR25ObservationFreezeManifest(root = process.cwd()): R14ObservationFreezeManifest {
  const filePath = path.join(path.resolve(root), "docs/research/round-014-observation-freeze.json");
  if (!existsSync(filePath)) throw new Error(`R14 observation freeze manifest is missing: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8")) as R14ObservationFreezeManifest;
}

export async function runR25Development(input: Readonly<{ root?: string }> = {}): Promise<R25DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const sourcePath = resolveR25DevelopmentSource(root);
  const sourceIdentity = await assertSourceIdentity(sourcePath);
  const rows = await loadRows(sourcePath);
  const configurations = [...R25_LONG_CANDIDATE_CONFIGURATIONS, ...R25_SHORT_CANDIDATE_CONFIGURATIONS];
  if (configurations.length !== 6) throw new Error("R25 bounded search must contain exactly six configurations.");
  const candidateResults: R25CandidateResult[] = [];
  for (const config of configurations) candidateResults.push(candidateResult(config, R25_FOLD_IDS.map((foldId) => selectFold(config, rows, foldId))));
  const longChampion = selectChampion(candidateResults, "LONG-CANDIDATE-FAMILY");
  const shortChampion = selectChampion(candidateResults, "SHORT-CANDIDATE-FAMILY");
  const hasChampion = Boolean(longChampion || shortChampion);
  return Object.freeze({
    schemaVersion: DEVELOPMENT_RESULT_SCHEMA,
    researchRoundId: R25_RESEARCH_ROUND_ID,
    protocolPhase: "BOUNDED_DEVELOPMENT_ONLY",
    resultPhase: "HISTORICAL_DEVELOPMENT_ONLY",
    branch: R25_BRANCH,
    base: { branch: R25_BASE_BRANCH, sha: R25_BASE_SHA },
    protocolSha256: R25_PROTOCOL_SHA256,
    developmentWindow: { start: R25_DEVELOPMENT_DATA_START_ISO, end: R25_DEVELOPMENT_DATA_END_ISO, classification: "DEVELOPMENT_ONLY" as const },
    developmentDataSource: sourceIdentity,
    developmentEconomicEvaluationExecutionCount: 1,
    candidateConfigurationsDefined: 6,
    candidateConfigurationsEvaluated: 6,
    candidateResults: Object.freeze(candidateResults),
    longChampionId: longChampion?.candidateConfigurationId ?? null,
    shortChampionId: shortChampion?.candidateConfigurationId ?? null,
    longChampionModel: null,
    shortChampionModel: null,
    developmentSelectionExecuted: true,
    developmentClassification: hasChampion ? "DEVELOPMENT_CHAMPION_REQUIRES_PRE_OUTCOME_EXECUTABLE_FREEZE" : "NO_DEVELOPMENT_CHAMPION",
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
    finalDecision: hasChampion ? "ROUND-025 DEVELOPMENT COMPLETE — PRE-OUTCOME EXECUTABLE FREEZE REQUIRED" : "ROUND-025 DIRECTIONAL DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION / NO FORWARD CANDIDATE",
    nextStage: hasChampion ? "PRE_OUTCOME_EXECUTABLE_FREEZE_REQUIRED" : "DIRECTIONAL_CANDIDATE_REDESIGN_REQUIRED",
  });
}

export async function publishR25DevelopmentResult(input: Readonly<{ root?: string }> = {}): Promise<R25DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const result = await runR25Development({ root });
  writeTextAtomically(path.join(root, RESULT_JSON_PATH), stableStringify(result));
  writeTextAtomically(path.join(root, RESULT_MARKDOWN_PATH), resultMarkdown(result));
  return result;
}

export const R25_RUNNER_IDENTITIES = Object.freeze({
  resultJsonPath: RESULT_JSON_PATH,
  protocolSha256: R25_PROTOCOL_SHA256,
  costPolicyHash: R25_COST_POLICY_HASH,
  settlementHash: R25_SETTLEMENT_HASH,
  folds: R25_FOLDS_SOURCE,
  source: R25_DEVELOPMENT_DATA_SOURCE,
  noNetworkAcquisition: true,
  noForwardLoader: true,
});
