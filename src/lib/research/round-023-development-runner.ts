import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import { calculateR13Drawdown } from "./r13-drawdown.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { isR13TrainingObservationPurgeSafe } from "./m3-r13-round-013-validation.ts";
import { fitR13RidgeModel, predictR13RidgeModel, type R13RidgeModel } from "./m3-r13-round-013-model.ts";
import { type R13FeatureVector } from "./m3-r13-round-013-features.ts";
import { type R13Direction, type R13HorizonHours } from "./m3-r13-round-013-protocol.ts";
import { fitR15RidgeModel, predictR15RidgeModel, type R15RidgeModel } from "./m3-r15-round-015-model.ts";
import { readR14ObservationFreeze, streamR14Observations, type R14ObservationFreezeManifest } from "./m3-r14-round-014-observations.ts";
import {
  R23_ACCEPTED_R13_DATASET_FREEZE_BLOB_SHA,
  R23_ACCEPTED_R13_DATASET_FREEZE_COMMIT,
  R23_ACCEPTED_R13_DATASET_IDENTITY_SHA256,
  R23_ACCEPTED_R13_FEATURE_IMPLEMENTATION_BLOB_SHA,
  R23_ACCEPTED_R13_FEATURE_PROTOCOL_BLOB_SHA,
  R23_ACCEPTED_R14_FREEZE_COMMIT,
  R23_ACCEPTED_R14_FREEZE_MANIFEST_BLOB_SHA,
  R23_ACCEPTED_R14_FREEZE_MANIFEST_FILE_SHA256,
  R23_ACCEPTED_R14_FREEZE_MANIFEST_PATH,
  R23_ACCEPTED_R14_FREEZE_MANIFEST_SHA256,
  R23_ACCEPTED_R14_OBSERVATION_BYTES,
  R23_ACCEPTED_R14_OBSERVATION_PATH,
  R23_ACCEPTED_R14_OBSERVATION_SHA256,
  locateR23DevelopmentDataSource,
  scanR23MetadataOnly,
  type R23DevelopmentDataManifest,
} from "./round-023-development-data.ts";
import type { ResearchFoldId } from "./constants.ts";
import {
  R23_BASE_BRANCH,
  R23_BASE_SHA,
  R23_BRANCH,
  R23_CANDIDATE_CONFIGURATIONS,
  R23_DEVELOPMENT_DATA_MANIFEST_PATH,
  R23_DEVELOPMENT_DATA_MANIFEST_SHA256,
  R23_DEVELOPMENT_DATA_PATH,
  R23_DEVELOPMENT_DATA_SHA256,
  R23_DEVELOPMENT_DATA_SOURCE_STATUS,
  R23_DEVELOPMENT_GATES,
  R23_FOLD_IDS,
  R23_HORIZON_HOURS,
  R23_NO_FORWARD_CANDIDATE,
  R23_PROTOCOL_OBJECT,
  R23_PROTOCOL_SHA256,
  R23_SYMBOLS,
  R23_SOURCE_ACQUISITION_AMENDMENT_COMMIT,
  R23_SOURCE_ACQUISITION_AMENDMENT_ID,
  R23_SOURCE_ACQUISITION_AMENDMENT_PARENT,
  R23_SOURCE_ACQUISITION_AMENDMENT_PATH,
  R23_SOURCE_ACQUISITION_AMENDMENT_SHA256,
  type R23CandidateConfiguration,
} from "./round-023-development-protocol.ts";
import { stableStringify } from "./utils.ts";

const RESULT_JSON_PATH = "docs/research/round-023-development-result.json" as const;
const RESULT_MARKDOWN_PATH = "docs/research/round-023-development-result.md" as const;
const DEVELOPMENT_RESULT_SCHEMA = "m3-r23-development-result-001" as const;
const DEVELOPMENT_RESULT_PHASE = "B_HISTORICAL_DEVELOPMENT_EVALUATION_RESULT" as const;
const DEVELOPMENT_HORIZON: R13HorizonHours = R23_HORIZON_HOURS;

type NumberOrNull = number | null;

type DevelopmentRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R13Direction;
  features: Readonly<Record<string, number>>;
  primaryStatus: string;
  primaryNetR: NumberOrNull;
  primaryCostStressNetR: NumberOrNull;
  latencyStatus: string;
  latencyNetR: NumberOrNull;
}>;

type DevelopmentSelection = Readonly<{
  foldId: ResearchFoldId;
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R13Direction;
  prediction: number;
  netR: number;
  costStressNetR: number;
  latencyNetR: number;
}>;

type CandidateModel =
  | Readonly<{ kind: "R13_ALL"; model: R13RidgeModel }>
  | Readonly<{ kind: "R15_SUBSET"; model: R15RidgeModel }>;

type FoldEvaluation = Readonly<{
  foldId: ResearchFoldId;
  trainingExamples: number;
  modelIdentitySha256: string;
  selected: readonly DevelopmentSelection[];
}>;

type FoldMetric = Readonly<{
  selectedAlerts: number;
  meanNetExpectancy: number | null;
  netProfitFactor: number | null;
  costStressMeanNetExpectancy: number | null;
  costStressProfitFactor: number | null;
  latencyStressMeanNetExpectancy: number | null;
  latencyStressProfitFactor: number | null;
  maximumDrawdownR: number;
}>;

type MetricSummary = Readonly<{
  selectedAlerts: number;
  distinctUtcDecisionDates: number;
  meanNetExpectancy: number | null;
  netProfitFactor: number | null;
  cumulativeNetR: number;
  maximumDrawdownR: number;
  costStressMeanNetExpectancy: number | null;
  costStressProfitFactor: number | null;
  latencyStressMeanNetExpectancy: number | null;
  latencyStressProfitFactor: number | null;
  positiveTemporalFolds: number;
  catastrophicFolds: number;
  maximumLosingStreak: number;
  maximumPositiveSymbolContributionShare: number | null;
  maximumSinglePositiveObservationContribution: number | null;
  byFold: Readonly<Record<ResearchFoldId, FoldMetric>>;
}>;

type GateSummary = Readonly<{
  results: readonly Readonly<{
    gateId: string;
    passed: boolean;
    actualValue: number | null;
    requirement: string;
  }>[];
  failedGateIds: readonly string[];
  eligibility: "ELIGIBLE" | "INELIGIBLE";
}>;

export type R23DevelopmentResult = Readonly<{
  schemaVersion: typeof DEVELOPMENT_RESULT_SCHEMA;
  researchRoundId: "baseline-002-research-round-023";
  protocolPhase: "A1_DEVELOPMENT_DATASET_FREEZE";
  resultPhase: typeof DEVELOPMENT_RESULT_PHASE;
  branch: typeof R23_BRANCH;
  base: Readonly<{ branch: typeof R23_BASE_BRANCH; sha: typeof R23_BASE_SHA }>;
  protocolSha256: string;
  sourceAcquisitionAmendment: Readonly<{
    path: typeof R23_SOURCE_ACQUISITION_AMENDMENT_PATH;
    amendmentId: typeof R23_SOURCE_ACQUISITION_AMENDMENT_ID;
    commit: typeof R23_SOURCE_ACQUISITION_AMENDMENT_COMMIT;
    parent: typeof R23_SOURCE_ACQUISITION_AMENDMENT_PARENT;
    sha256: typeof R23_SOURCE_ACQUISITION_AMENDMENT_SHA256;
  }>;
  developmentExecutionId: string;
  developmentExecutionCount: 1;
  classification: typeof R23_NO_FORWARD_CANDIDATE;
  studyClassification: "HISTORICAL_CANDIDATE_DEVELOPMENT";
  candidateConfigurationsDefined: 4;
  candidateConfigurationsEvaluated: 4;
  candidateResults: readonly Readonly<Record<string, unknown>>[];
  eligibleCandidates: readonly string[];
  selectedCandidateId: string | null;
  selectionExecuted: boolean;
  developmentEconomicEvaluationExecutionCount: 1;
  outcome: "ALL_FOUR_FIXED_CANDIDATE_CONFIGURATIONS_EVALUATED";
  sourceCheck: Readonly<Record<string, unknown>>;
  sourceAudit: Readonly<Record<string, unknown>>;
  economicReadBoundary: Readonly<Record<string, unknown>>;
  forwardValidation: Readonly<Record<string, unknown>>;
  modelFreeze: Readonly<Record<string, unknown>>;
  selection: Readonly<Record<string, unknown>>;
  governance: Readonly<Record<string, unknown>>;
  historicalDevelopmentEconomicValuesRead: true;
  forwardEconomicValuesRead: false;
  forwardReturnRead: false;
  economicValuesCalculated: true;
  economicValuesInspected: true;
  newMarketDataFetched: false;
  newHistoricalDevelopmentDataFetched: false;
  newPostFreezeForwardDataFetched: false;
  performanceExecuted: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  automaticTrading: false;
  humanDecisionRequired: true;
  productionUnchanged: true;
  mainUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  finalDecision: "ROUND-023 NO FORWARD CANDIDATE";
  nextStage: "STOP";
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function fileSha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function profitFactor(values: readonly number[]): number | null {
  const positive = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negative = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return negative === 0 ? null : positive / negative;
}

function directionOrder(direction: R13Direction): number {
  return direction === "LONG" ? 0 : 1;
}

function compareSelections(left: DevelopmentSelection, right: DevelopmentSelection): number {
  return left.decisionTime - right.decisionTime
    || R23_SYMBOLS.indexOf(left.symbol) - R23_SYMBOLS.indexOf(right.symbol)
    || directionOrder(left.direction) - directionOrder(right.direction)
    || left.observationId.localeCompare(right.observationId);
}

function countDistinctUtcDates(selections: readonly DevelopmentSelection[]): number {
  return new Set(selections.map((selection) => new Date(selection.decisionTime).toISOString().slice(0, 10))).size;
}

function maximumLosingStreak(selections: readonly DevelopmentSelection[]): number {
  let current = 0;
  let maximum = 0;
  for (const selection of [...selections].sort(compareSelections)) {
    current = selection.netR < 0 ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function foldMetric(selections: readonly DevelopmentSelection[]): FoldMetric {
  const net = selections.map((selection) => selection.netR);
  const cost = selections.map((selection) => selection.costStressNetR);
  const latency = selections.map((selection) => selection.latencyNetR);
  return Object.freeze({
    selectedAlerts: selections.length,
    meanNetExpectancy: mean(net),
    netProfitFactor: profitFactor(net),
    costStressMeanNetExpectancy: mean(cost),
    costStressProfitFactor: profitFactor(cost),
    latencyStressMeanNetExpectancy: mean(latency),
    latencyStressProfitFactor: profitFactor(latency),
    maximumDrawdownR: calculateR13Drawdown(selections.map((selection) => ({ decisionTime: selection.decisionTime, symbol: selection.symbol, direction: selection.direction, netForwardAtr: selection.netR }))).maximumDrawdownAtr,
  });
}

function metricSummary(selections: readonly DevelopmentSelection[]): MetricSummary {
  const ordered = [...selections].sort(compareSelections);
  const net = ordered.map((selection) => selection.netR);
  const cost = ordered.map((selection) => selection.costStressNetR);
  const latency = ordered.map((selection) => selection.latencyNetR);
  const byFold = Object.fromEntries(R23_FOLD_IDS.map((foldId) => [foldId, foldMetric(ordered.filter((selection) => selection.foldId === foldId))])) as Record<ResearchFoldId, FoldMetric>;
  const positive = ordered.filter((selection) => selection.netR > 0);
  const totalPositive = positive.reduce((sum, selection) => sum + selection.netR, 0);
  const symbolPositive = Object.fromEntries(R23_SYMBOLS.map((symbol) => [symbol, positive.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.netR, 0)])) as Record<ResearchSymbol, number>;
  const maximumPositiveSymbolContributionShare = totalPositive > 0 ? Math.max(...R23_SYMBOLS.map((symbol) => symbolPositive[symbol])) / totalPositive : null;
  const maximumSinglePositiveObservationContribution = totalPositive > 0 ? Math.max(...positive.map((selection) => selection.netR)) / totalPositive : null;
  const drawdown = calculateR13Drawdown(ordered.map((selection) => ({ decisionTime: selection.decisionTime, symbol: selection.symbol, direction: selection.direction, netForwardAtr: selection.netR })));
  return Object.freeze({
    selectedAlerts: ordered.length,
    distinctUtcDecisionDates: countDistinctUtcDates(ordered),
    meanNetExpectancy: mean(net),
    netProfitFactor: profitFactor(net),
    cumulativeNetR: drawdown.cumulativeNetForwardAtr,
    maximumDrawdownR: drawdown.maximumDrawdownAtr,
    costStressMeanNetExpectancy: mean(cost),
    costStressProfitFactor: profitFactor(cost),
    latencyStressMeanNetExpectancy: mean(latency),
    latencyStressProfitFactor: profitFactor(latency),
    positiveTemporalFolds: Object.values(byFold).filter((value) => value.meanNetExpectancy !== null && value.meanNetExpectancy > 0).length,
    catastrophicFolds: Object.values(byFold).filter((value) => value.meanNetExpectancy !== null && value.meanNetExpectancy <= -0.10).length,
    maximumLosingStreak: maximumLosingStreak(ordered),
    maximumPositiveSymbolContributionShare,
    maximumSinglePositiveObservationContribution,
    byFold: Object.freeze(byFold),
  });
}

function evaluateGates(metrics: MetricSummary): GateSummary {
  const results = [
    { gateId: "minimumSettledAlerts", passed: metrics.selectedAlerts >= R23_DEVELOPMENT_GATES.minimumSettledAlerts, actualValue: metrics.selectedAlerts, requirement: `>= ${R23_DEVELOPMENT_GATES.minimumSettledAlerts}` },
    { gateId: "minimumDistinctUtcDecisionDates", passed: metrics.distinctUtcDecisionDates >= R23_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates, actualValue: metrics.distinctUtcDecisionDates, requirement: `>= ${R23_DEVELOPMENT_GATES.minimumDistinctUtcDecisionDates}` },
    { gateId: "minimumAggregateMeanNetExpectancy", passed: metrics.meanNetExpectancy !== null && metrics.meanNetExpectancy > R23_DEVELOPMENT_GATES.minimumAggregateMeanNetExpectancy, actualValue: metrics.meanNetExpectancy, requirement: `> ${R23_DEVELOPMENT_GATES.minimumAggregateMeanNetExpectancy}` },
    { gateId: "minimumAggregateNetProfitFactor", passed: metrics.netProfitFactor !== null && metrics.netProfitFactor >= R23_DEVELOPMENT_GATES.minimumAggregateNetProfitFactor, actualValue: metrics.netProfitFactor, requirement: `>= ${R23_DEVELOPMENT_GATES.minimumAggregateNetProfitFactor}` },
    { gateId: "minimumPositiveTemporalFolds", passed: metrics.positiveTemporalFolds >= R23_DEVELOPMENT_GATES.minimumPositiveTemporalFolds, actualValue: metrics.positiveTemporalFolds, requirement: `>= ${R23_DEVELOPMENT_GATES.minimumPositiveTemporalFolds}` },
    { gateId: "maximumCatastrophicFolds", passed: metrics.catastrophicFolds <= R23_DEVELOPMENT_GATES.maximumCatastrophicFolds, actualValue: metrics.catastrophicFolds, requirement: `<= ${R23_DEVELOPMENT_GATES.maximumCatastrophicFolds}` },
    { gateId: "costStress", passed: metrics.costStressMeanNetExpectancy !== null && metrics.costStressMeanNetExpectancy > R23_DEVELOPMENT_GATES.costStress.minimumMeanNetExpectancy && metrics.costStressProfitFactor !== null && metrics.costStressProfitFactor >= R23_DEVELOPMENT_GATES.costStress.minimumProfitFactor, actualValue: metrics.costStressProfitFactor, requirement: `mean > ${R23_DEVELOPMENT_GATES.costStress.minimumMeanNetExpectancy} and PF >= ${R23_DEVELOPMENT_GATES.costStress.minimumProfitFactor}` },
    { gateId: "manualLatencyPrimary", passed: metrics.latencyStressMeanNetExpectancy !== null && metrics.latencyStressMeanNetExpectancy > R23_DEVELOPMENT_GATES.manualLatencyPrimary.minimumMeanNetExpectancy && metrics.latencyStressProfitFactor !== null && metrics.latencyStressProfitFactor >= R23_DEVELOPMENT_GATES.manualLatencyPrimary.minimumProfitFactor, actualValue: metrics.latencyStressProfitFactor, requirement: `mean > ${R23_DEVELOPMENT_GATES.manualLatencyPrimary.minimumMeanNetExpectancy} and PF >= ${R23_DEVELOPMENT_GATES.manualLatencyPrimary.minimumProfitFactor}` },
    { gateId: "maximumPositiveSymbolContributionShare", passed: metrics.maximumPositiveSymbolContributionShare !== null && metrics.maximumPositiveSymbolContributionShare <= R23_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare, actualValue: metrics.maximumPositiveSymbolContributionShare, requirement: `<= ${R23_DEVELOPMENT_GATES.maximumPositiveSymbolContributionShare}` },
    { gateId: "maximumSinglePositiveObservationContribution", passed: metrics.maximumSinglePositiveObservationContribution !== null && metrics.maximumSinglePositiveObservationContribution <= R23_DEVELOPMENT_GATES.maximumSinglePositiveObservationContribution, actualValue: metrics.maximumSinglePositiveObservationContribution, requirement: `<= ${R23_DEVELOPMENT_GATES.maximumSinglePositiveObservationContribution}` },
  ] as const;
  const failedGateIds = results.filter((result) => !result.passed).map((result) => result.gateId);
  return Object.freeze({ results: Object.freeze(results), failedGateIds: Object.freeze(failedGateIds), eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE" });
}

function subsetFeatures(row: DevelopmentRow, featureNames: readonly string[]): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries(featureNames.map((name) => [name, row.features[name]])));
}

function fitCandidateModel(config: R23CandidateConfiguration, examples: readonly DevelopmentRow[]): CandidateModel {
  if (config.featureSubsetId === "R13_ALL_EXISTING_FEATURES") {
    return Object.freeze({ kind: "R13_ALL", model: fitR13RidgeModel(examples.map((row) => ({ features: row.features as R13FeatureVector, targetNetForwardAtr: row.primaryNetR! }))) });
  }
  return Object.freeze({ kind: "R15_SUBSET", model: fitR15RidgeModel(config.candidateConfigurationId, config.featureNames, examples.map((row) => ({ features: subsetFeatures(row, config.featureNames), target: row.primaryNetR! }))) });
}

function predictCandidate(model: CandidateModel, row: DevelopmentRow): number {
  if (model.kind === "R13_ALL") return predictR13RidgeModel(model.model, row.features as R13FeatureVector);
  return predictR15RidgeModel(model.model, subsetFeatures(row, model.model.featureNames));
}

function modelIdentity(model: CandidateModel): Readonly<{ trainingExamples: number; modelIdentitySha256: string }> {
  return Object.freeze({ trainingExamples: model.model.trainingExamples, modelIdentitySha256: model.model.modelIdentitySha256 });
}

function foldRows(rows: readonly DevelopmentRow[], foldId: ResearchFoldId, role: "RESEARCH" | "VALIDATION"): readonly DevelopmentRow[] {
  const range = getResearchFoldRoleRange(foldId, role);
  return rows.filter((row) => row.decisionTime >= range.startTime && row.decisionTime <= range.endTime);
}

function evaluateFold(config: R23CandidateConfiguration, rows: readonly DevelopmentRow[], foldId: ResearchFoldId): FoldEvaluation {
  const validationRange = getResearchFoldRoleRange(foldId, "VALIDATION");
  const researchRows = foldRows(rows, foldId, "RESEARCH").filter((row) => row.primaryStatus === "EXECUTED" && row.primaryNetR !== null && isR13TrainingObservationPurgeSafe({ decisionTime: row.decisionTime, validationStartTime: validationRange.startTime }));
  if (researchRows.length <= config.featureNames.length) throw new Error(`R23 ${config.candidateConfigurationId} has insufficient purged training observations in ${foldId}.`);
  const model = fitCandidateModel(config, researchRows);
  const validationRows = foldRows(rows, foldId, "VALIDATION");
  const byDecisionTime = new Map<number, DevelopmentRow[]>();
  for (const row of validationRows) byDecisionTime.set(row.decisionTime, [...(byDecisionTime.get(row.decisionTime) ?? []), row]);
  const selected: DevelopmentSelection[] = [];
  for (const [decisionTime, atTime] of [...byDecisionTime.entries()].sort(([left], [right]) => left - right)) {
    const top = atTime
      .map((row) => ({ row, prediction: predictCandidate(model, row) }))
      .sort((left, right) => right.prediction - left.prediction || R23_SYMBOLS.indexOf(left.row.symbol) - R23_SYMBOLS.indexOf(right.row.symbol) || directionOrder(left.row.direction) - directionOrder(right.row.direction) || left.row.observationId.localeCompare(right.row.observationId))[0];
    if (!top || top.prediction < config.threshold) continue;
    if (top.row.primaryStatus !== "EXECUTED") continue;
    if (top.row.primaryNetR === null || top.row.primaryCostStressNetR === null || top.row.latencyStatus !== "EXECUTED" || top.row.latencyNetR === null) throw new Error(`R23 ${config.candidateConfigurationId} selected an incomplete economic label at ${decisionTime}.`);
    selected.push(Object.freeze({ foldId, observationId: top.row.observationId, decisionTime, symbol: top.row.symbol, direction: top.row.direction, prediction: top.prediction, netR: top.row.primaryNetR, costStressNetR: top.row.primaryCostStressNetR, latencyNetR: top.row.latencyNetR }));
  }
  const identity = modelIdentity(model);
  return Object.freeze({ foldId, trainingExamples: identity.trainingExamples, modelIdentitySha256: identity.modelIdentitySha256, selected: Object.freeze(selected) });
}

function compareEligibleCandidates(left: Readonly<{ candidateConfigurationId: string; metrics: MetricSummary }>, right: Readonly<{ candidateConfigurationId: string; metrics: MetricSummary }>): number {
  const leftWorst = Math.min(...R23_FOLD_IDS.map((foldId) => left.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  const rightWorst = Math.min(...R23_FOLD_IDS.map((foldId) => right.metrics.byFold[foldId].meanNetExpectancy ?? Number.NEGATIVE_INFINITY));
  return rightWorst - leftWorst
    || (right.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY) - (left.metrics.costStressMeanNetExpectancy ?? Number.NEGATIVE_INFINITY)
    || Math.abs(left.metrics.maximumDrawdownR) - Math.abs(right.metrics.maximumDrawdownR)
    || left.candidateConfigurationId.localeCompare(right.candidateConfigurationId);
}

async function assertManifestIdentity(root: string, sourcePath: string): Promise<Readonly<{ manifest: R23DevelopmentDataManifest; scan: Awaited<ReturnType<typeof scanR23MetadataOnly>>; r14Manifest: R14ObservationFreezeManifest }>> {
  const manifestPath = path.join(root, R23_DEVELOPMENT_DATA_MANIFEST_PATH);
  if (!existsSync(manifestPath)) throw new Error(`R23 development manifest is missing: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as R23DevelopmentDataManifest;
  if (manifest.manifestSha256 !== R23_DEVELOPMENT_DATA_MANIFEST_SHA256 || hash({ ...manifest, manifestSha256: null }) !== manifest.manifestSha256) throw new Error("R23 development manifest checksum does not match the frozen identity.");
  if (manifest.sourceStatus !== R23_DEVELOPMENT_DATA_SOURCE_STATUS || manifest.normalizedObservationSha256 !== R23_DEVELOPMENT_DATA_SHA256 || manifest.normalizedObservationBytes !== R23_ACCEPTED_R14_OBSERVATION_BYTES || manifest.acceptedSource.observationDataSha256 !== R23_ACCEPTED_R14_OBSERVATION_SHA256 || manifest.acceptedSource.observationDataBytes !== R23_ACCEPTED_R14_OBSERVATION_BYTES || manifest.acceptedSource.freezeManifestSha256 !== R23_ACCEPTED_R14_FREEZE_MANIFEST_SHA256 || manifest.rawDataset.datasetIdentitySha256 !== R23_ACCEPTED_R13_DATASET_IDENTITY_SHA256 || manifest.rawDataset.datasetFreezeCommit !== R23_ACCEPTED_R13_DATASET_FREEZE_COMMIT || manifest.rawDataset.datasetFreezeBlobSha !== R23_ACCEPTED_R13_DATASET_FREEZE_BLOB_SHA || manifest.featureSource.protocolBlobSha !== R23_ACCEPTED_R13_FEATURE_PROTOCOL_BLOB_SHA || manifest.featureSource.implementationBlobSha !== R23_ACCEPTED_R13_FEATURE_IMPLEMENTATION_BLOB_SHA) throw new Error("R23 development manifest accepted-source identity mismatch.");
  const freezeManifestPath = path.join(root, R23_ACCEPTED_R14_FREEZE_MANIFEST_PATH);
  const r14Manifest = readR14ObservationFreeze(root);
  if (fileSha256(freezeManifestPath) !== R23_ACCEPTED_R14_FREEZE_MANIFEST_FILE_SHA256 || r14Manifest.manifestSha256 !== R23_ACCEPTED_R14_FREEZE_MANIFEST_SHA256) throw new Error("R23 accepted R14 freeze manifest identity mismatch.");
  const scan = await scanR23MetadataOnly(sourcePath);
  if (scan.observationDataSha256 !== R23_ACCEPTED_R14_OBSERVATION_SHA256 || scan.observationDataBytes !== R23_ACCEPTED_R14_OBSERVATION_BYTES || scan.observationCount !== manifest.counts.observations || stableStringify(scan.perSymbolCounts) !== stableStringify(manifest.counts.perSymbol) || stableStringify(scan.directionCounts) !== stableStringify(manifest.counts.perDirection) || scan.postBoundaryRows !== 0 || scan.duplicateObservationIds !== 0 || !scan.chronologyValid || !scan.requiredSymbolsComplete) throw new Error("R23 development source metadata does not match the frozen dataset manifest.");
  return Object.freeze({ manifest, scan, r14Manifest });
}

async function loadDevelopmentRows(filePath: string): Promise<readonly DevelopmentRow[]> {
  const rows: DevelopmentRow[] = [];
  for await (const observation of streamR14Observations(filePath)) {
    const primary = observation.labels[DEVELOPMENT_HORIZON];
    const latency = observation.latencyStressLabels[DEVELOPMENT_HORIZON];
    rows.push(Object.freeze({ observationId: observation.observationId, decisionTime: observation.decisionTime, symbol: observation.symbol, direction: observation.direction, features: observation.features, primaryStatus: primary.status, primaryNetR: finiteOrNull(primary.netForwardAtr), primaryCostStressNetR: finiteOrNull(primary.netForwardAtrCostStress), latencyStatus: latency.status, latencyNetR: finiteOrNull(latency.netForwardAtr) }));
  }
  if (rows.length === 0) throw new Error("R23 development source contains no observations.");
  return Object.freeze(rows);
}

function ensureNotAlreadyEvaluated(root: string): void {
  const resultPath = path.join(root, RESULT_JSON_PATH);
  if (!existsSync(resultPath)) return;
  const existing = JSON.parse(readFileSync(resultPath, "utf8")) as Readonly<Record<string, unknown>>;
  if (existing.developmentEconomicEvaluationExecutionCount === 1 || existing.candidateConfigurationsEvaluated === 4) throw new Error("R23 development economic evaluation is already published; rerun is forbidden.");
}

function relativePath(root: string, filePath: string): string {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function candidateResult(config: R23CandidateConfiguration, folds: readonly FoldEvaluation[]): Readonly<Record<string, unknown>> {
  const selected = folds.flatMap((fold) => fold.selected);
  const metrics = metricSummary(selected);
  const gates = evaluateGates(metrics);
  return Object.freeze({
    candidateConfigurationId: config.candidateConfigurationId,
    modelFamilyId: config.modelFamilyId,
    model: config.model,
    lambda: config.lambda,
    featureSubsetId: config.featureSubsetId,
    featureCount: config.featureNames.length,
    threshold: config.threshold,
    evaluated: true,
    selectedAlerts: metrics.selectedAlerts,
    metrics,
    gates,
    modelProvenance: Object.freeze(folds.map((fold) => Object.freeze({ foldId: fold.foldId, status: "FIT", trainingExamples: fold.trainingExamples, modelIdentitySha256: fold.modelIdentitySha256 }))),
  });
}

function resultMarkdown(result: R23DevelopmentResult): string {
  const lines = [
    "# Round-023 Development Result",
    "",
    `Status: \`${result.classification}\``,
    "",
    "The one permitted Round-023 candidate-development economic evaluation was executed only after the remote immutable dataset freeze. All four frozen configurations were evaluated with the existing R13 features, R23 frozen folds, 24-hour purge/embargo, seven-minute latency, and bt-policy-003 economics. This is historical development evidence only; it is not the later independent forward/OOS phase.",
    "",
    "## Frozen execution",
    "",
    `- Branch: \`${result.branch}\``,
    `- Base: \`${result.base.branch}\` @ \`${result.base.sha}\``,
    `- Protocol SHA-256: \`${result.protocolSha256}\``,
    `- Development execution ID: \`${result.developmentExecutionId}\``,
    `- Development economic evaluation execution count: \`${result.developmentEconomicEvaluationExecutionCount}\``,
    `- Candidate configurations defined/evaluated: \`${result.candidateConfigurationsDefined}/${result.candidateConfigurationsEvaluated}\``,
    "",
    "## Candidate outcomes",
    "",
    "| Candidate | Selected alerts | Mean net R | Net PF | Cost-stress mean R | Cost-stress PF | 7-minute latency mean R | 7-minute latency PF | Positive folds | Max drawdown R | Eligibility |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const raw of result.candidateResults) {
    const candidate = raw as Readonly<Record<string, unknown>>;
    const metrics = candidate.metrics as MetricSummary;
    const gates = candidate.gates as GateSummary;
    lines.push(`| ${String(candidate.candidateConfigurationId)} | ${metrics.selectedAlerts} | ${metrics.meanNetExpectancy ?? "null"} | ${metrics.netProfitFactor ?? "null"} | ${metrics.costStressMeanNetExpectancy ?? "null"} | ${metrics.costStressProfitFactor ?? "null"} | ${metrics.latencyStressMeanNetExpectancy ?? "null"} | ${metrics.latencyStressProfitFactor ?? "null"} | ${metrics.positiveTemporalFolds} | ${metrics.maximumDrawdownR} | ${gates.eligibility} |`);
  }
  lines.push(
    "",
    `Eligible candidates: \`${stableStringify(result.eligibleCandidates)}\``,
    `Selected candidate: \`${result.selectedCandidateId ?? "null"}\``,
    `Classification: \`${result.classification}\``,
    "",
    "## Source and economic boundary",
    "",
    `- Development data source: \`${String(result.sourceCheck.sourcePath)}\``,
    `- Dataset manifest: \`${R23_DEVELOPMENT_DATA_MANIFEST_PATH}\``,
    `- Dataset identity: \`${R23_DEVELOPMENT_DATA_SHA256}\``,
    `- Historical development economic values read: \`${result.historicalDevelopmentEconomicValuesRead}\``,
    `- Forward economic values/read: \`${result.forwardEconomicValuesRead}/${result.forwardReturnRead}\``,
    `- Performance executed/ledger present: \`${result.performanceExecuted}/${result.performanceLedgerPresent}\``,
    `- New market data fetched: \`${result.newMarketDataFetched}\``,
    "",
    "## Governance",
    "",
    `- Production unchanged: \`${result.productionUnchanged}\``,
    `- Main unchanged: \`${result.mainUnchanged}\``,
    `- automaticTrading: \`${result.automaticTrading}\``,
    `- humanDecisionRequired: \`${result.humanDecisionRequired}\``,
    `- baseline-002: \`${result.baseline002Status}\``,
    `- M3-J: \`${result.m3JStatus}\``,
    `- M4: \`${result.m4Status}\``,
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

export async function runR23HistoricalDevelopment(input: Readonly<{ root?: string }> = {}): Promise<R23DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  ensureNotAlreadyEvaluated(root);
  const sourcePath = locateR23DevelopmentDataSource(root);
  if (!sourcePath) throw new Error("R23 development source is unavailable after the source-acquisition amendment; no economic evaluation may be fabricated.");
  const identity = await assertManifestIdentity(root, sourcePath);
  const rows = await loadDevelopmentRows(sourcePath);
  if (rows.length !== identity.manifest.counts.observations) throw new Error("R23 full observation load count does not match the metadata freeze.");
  const resultCandidates: Readonly<Record<string, unknown>>[] = [];
  for (const config of R23_CANDIDATE_CONFIGURATIONS) {
    const folds = R23_FOLD_IDS.map((foldId) => evaluateFold(config, rows, foldId));
    resultCandidates.push(candidateResult(config, folds));
  }
  const eligible = resultCandidates.filter((candidate) => (candidate.gates as GateSummary).eligibility === "ELIGIBLE");
  const orderedEligible = [...eligible].sort((left, right) => compareEligibleCandidates({ candidateConfigurationId: String(left.candidateConfigurationId), metrics: left.metrics as MetricSummary }, { candidateConfigurationId: String(right.candidateConfigurationId), metrics: right.metrics as MetricSummary }));
  const selectedCandidateId = orderedEligible.length > 0 ? String(orderedEligible[0]!.candidateConfigurationId) : null;
  if (selectedCandidateId !== null) throw new Error("R23 eligible development candidates require the separately frozen final-model artifact path; refusing to publish without that artifact.");
  const sourceRelativePath = relativePath(root, sourcePath);
  const sourceAudit = Object.freeze({ requiredPath: R23_DEVELOPMENT_DATA_PATH, sourcePath: sourceRelativePath, validPreExistingSourceFound: true, repositoryPathExists: existsSync(sourcePath), reachableAcceptedArtifactWithRequiredPath: true, compatibleExistingCacheFound: true, auditScope: "ACCEPTED_R14_IMMUTABLE_OBSERVATION_FREEZE_AFTER_REMOTE_DATASET_FREEZE", pitCompatible: true, economicPayloadRead: true, identityOnlyMetadataVerifiedBeforePayloadRead: true, economicPayloadReadAfterDatasetFreeze: true, finalStopDisposition: null, reason: "The source is the exact accepted R14 observation freeze identity recorded by the immutable R23 development manifest." });
  return Object.freeze({
    schemaVersion: DEVELOPMENT_RESULT_SCHEMA,
    researchRoundId: "baseline-002-research-round-023",
    protocolPhase: "A1_DEVELOPMENT_DATASET_FREEZE",
    resultPhase: DEVELOPMENT_RESULT_PHASE,
    branch: R23_BRANCH,
    base: { branch: R23_BASE_BRANCH, sha: R23_BASE_SHA },
    protocolSha256: R23_PROTOCOL_SHA256,
    sourceAcquisitionAmendment: { path: R23_SOURCE_ACQUISITION_AMENDMENT_PATH, amendmentId: R23_SOURCE_ACQUISITION_AMENDMENT_ID, commit: R23_SOURCE_ACQUISITION_AMENDMENT_COMMIT, parent: R23_SOURCE_ACQUISITION_AMENDMENT_PARENT, sha256: R23_SOURCE_ACQUISITION_AMENDMENT_SHA256 },
    developmentExecutionId: `r23-development-${R23_PROTOCOL_SHA256.slice(0, 16)}`,
    developmentExecutionCount: 1,
    classification: R23_NO_FORWARD_CANDIDATE,
    studyClassification: "HISTORICAL_CANDIDATE_DEVELOPMENT",
    candidateConfigurationsDefined: 4,
    candidateConfigurationsEvaluated: 4,
    candidateResults: Object.freeze(resultCandidates),
    eligibleCandidates: Object.freeze([]),
    selectedCandidateId,
    selectionExecuted: false,
    developmentEconomicEvaluationExecutionCount: 1,
    outcome: "ALL_FOUR_FIXED_CANDIDATE_CONFIGURATIONS_EVALUATED",
    sourceCheck: { manifestPath: R23_DEVELOPMENT_DATA_MANIFEST_PATH, observationDataPath: R23_DEVELOPMENT_DATA_PATH, sourceStatus: identity.manifest.sourceStatus, sourcePath: sourceRelativePath, provider: identity.manifest.provider, acceptedSource: identity.manifest.acceptedSource, networkAcquired: false, newMarketDataFetched: false, newHistoricalDevelopmentDataFetched: false, postBoundaryRows: identity.scan.postBoundaryRows, observationDataBytes: identity.scan.observationDataBytes, observationDataSha256: identity.scan.observationDataSha256, noFutureInformationLeakage: true, pitCompatible: true },
    sourceAudit,
    economicReadBoundary: { historicalDevelopmentEconomicValuesRead: true, forwardEconomicValuesRead: false, forwardReturnRead: false, economicValuesCalculated: true, economicValuesInspected: true, performanceExecuted: false, performanceExecutionCount: 0, performanceLedgerPresent: false, developmentEconomicEvaluationExecutionCount: 1 },
    forwardValidation: { authorized: false, executed: false, independentOosValidationExecuted: false },
    modelFreeze: { finalModelArtifactCommitted: false, forwardContractCommitted: false, selectedCandidateId: null, reason: "No candidate passed all frozen development gates; no forward model artifact is applicable." },
    selection: { selectionExecuted: false, eligibleCandidates: [], reason: "All four candidates were evaluated and none passed every frozen hard gate." },
    governance: { phase: "B_HISTORICAL_DEVELOPMENT_EVALUATED", historicalDevelopmentEconomicValuesRead: true, forwardEconomicValuesRead: false, forwardReturnRead: false, newMarketDataFetched: false, newHistoricalDevelopmentDataFetched: false, newPostFreezeForwardDataFetched: false, forwardPerformanceExecutionCount: 0, performanceAuthorized: false, performanceExecutionCount: 0, performanceLedgerPresent: false, observationExecuted: false, historicalBackfillExecuted: false, automaticTrading: false, humanDecisionRequired: true, productionUnchanged: true, mainUnchanged: true, baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED", emailRestorationAuthorized: false },
    historicalDevelopmentEconomicValuesRead: true,
    forwardEconomicValuesRead: false,
    forwardReturnRead: false,
    economicValuesCalculated: true,
    economicValuesInspected: true,
    newMarketDataFetched: false,
    newHistoricalDevelopmentDataFetched: false,
    newPostFreezeForwardDataFetched: false,
    performanceExecuted: false,
    performanceExecutionCount: 0,
    performanceLedgerPresent: false,
    automaticTrading: false,
    humanDecisionRequired: true,
    productionUnchanged: true,
    mainUnchanged: true,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    finalDecision: "ROUND-023 NO FORWARD CANDIDATE",
    nextStage: "STOP",
  });
}

export async function publishR23DevelopmentResult(input: Readonly<{ root?: string }> = {}): Promise<R23DevelopmentResult> {
  const root = path.resolve(input.root ?? process.cwd());
  const result = await runR23HistoricalDevelopment({ root });
  writeTextAtomically(path.join(root, RESULT_JSON_PATH), stableStringify(result));
  writeTextAtomically(path.join(root, RESULT_MARKDOWN_PATH), resultMarkdown(result));
  return result;
}

export function validateR23ProtocolIdentity(): void {
  if (R23_PROTOCOL_OBJECT.base.sha !== "6924783d26e377a543bfc0d438a2bf6e6c40ba8a") throw new Error("R23 base identity drift.");
  if (R23_PROTOCOL_OBJECT.developmentData.manifestSha256 !== R23_DEVELOPMENT_DATA_MANIFEST_SHA256) throw new Error("R23 development manifest identity drift.");
  if (R23_PROTOCOL_OBJECT.developmentData.observationDataSha256 !== R23_DEVELOPMENT_DATA_SHA256 || R23_PROTOCOL_OBJECT.developmentData.sourcePolicy !== "PUBLIC_HISTORICAL_SOURCE_ACQUISITION_ALLOWED") throw new Error("R23 source policy or data identity drift.");
}

export const R23_RUNNER_IDENTITIES = Object.freeze({
  r14ObservationPath: R23_ACCEPTED_R14_OBSERVATION_PATH,
  r14ObservationSha256: R23_ACCEPTED_R14_OBSERVATION_SHA256,
  r14ObservationBytes: R23_ACCEPTED_R14_OBSERVATION_BYTES,
  r14FreezeManifestPath: R23_ACCEPTED_R14_FREEZE_MANIFEST_PATH,
  r14FreezeManifestSha256: R23_ACCEPTED_R14_FREEZE_MANIFEST_SHA256,
  r14FreezeCommit: R23_ACCEPTED_R14_FREEZE_COMMIT,
  r14FreezeManifestBlobSha: R23_ACCEPTED_R14_FREEZE_MANIFEST_BLOB_SHA,
  r13DatasetIdentitySha256: R23_ACCEPTED_R13_DATASET_IDENTITY_SHA256,
  sourceAcquisitionAmendment: R23_SOURCE_ACQUISITION_AMENDMENT_ID,
});
