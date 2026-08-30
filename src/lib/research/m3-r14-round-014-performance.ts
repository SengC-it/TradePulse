import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import type { ResearchFoldId } from "./constants.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { calculateR13Drawdown } from "./r13-drawdown.ts";
import {
  M3_R13_ACCEPTED_R11_SOURCE_SHA,
  M3_R13_POLICY_VERSION,
  M3_R13_RESEARCH_END_ISO,
  M3_R13_RESEARCH_RANGE,
  R13_FOLD_IDS,
  R13_HORIZON_HOURS,
  R13_SYMBOLS,
  type R13Direction,
  type R13HorizonHours,
} from "./m3-r13-round-013-protocol.ts";
import { R13_PLAN_SHA256, validateR13Plan } from "./m3-r13-round-013-plan.ts";
import { readR13SpecConformance, type R13SpecConformanceReport } from "./m3-r13-round-013-conformance.ts";
import { R13_SELECTION_GATE_SHA256, evaluateR13HorizonGates, selectR13Horizon, type R13HorizonSelectionCandidate } from "./selection-gates-round-013.ts";
import { isR13TrainingObservationPurgeSafe, r13SelectTopOne } from "./m3-r13-round-013-validation.ts";
import { fitR13RidgeModel, predictR13RidgeModel, type R13FitExample, type R13RidgeModel } from "./m3-r13-round-013-model.ts";
import type { R13HorizonMetrics, R13HorizonPerformance, R13Observation, R13ScoredOpportunity, R13ScoredSelection } from "./m3-r13-round-013-performance.ts";
import { R14_OBSERVATION_FREEZE_PATH, R14_OBSERVATION_DATA_RELATIVE_PATH, readR14ObservationFreeze, streamR14Observations, type R14ObservationFreezeManifest } from "./m3-r14-round-014-observations.ts";
import { M3_R14_DATASET_IDENTITY_SHA256, M3_R14_IDENTITY_PATH, M3_R14_MANIFEST_IDENTITY_SHA256, M3_R14_PERFORMANCE_LOCK, M3_R14_REPLAY_OF_RESEARCH_ROUND_ID, M3_R14_RESEARCH_ROUND_ID, M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256, M3_R14_SOURCE_R13_COMMIT, readR14Identity, type R14IdentityDocument } from "./m3-r14-round-014-identity.ts";
import { checkpointExists, horizonCheckpointPath, modelCheckpointPath, readR14Checkpoint, selectionCheckpointPath, writeR14CheckpointAtomic, type R14ExecutionLock } from "./m3-r14-round-014-checkpoints.ts";
import { stableStringify } from "./utils.ts";

export const M3_R14_REPORT_SCHEMA_VERSION = "m3-r14-round-014-report-001" as const;
export const M3_R14_AUDIT_SCHEMA_VERSION = "m3-r14-round-014-audit-001" as const;
export const M3_R14_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R14_ROUND_014_SUMMARY.json",
  "docs/evidence/M3_R14_ROUND_014_AUDIT.json",
  "docs/M3_R14_ROUND_014_RESULTS.md",
  "docs/evidence/M3_R14_ROUND_014_SELECTION.json",
  "docs/evidence/M3_R14_ROUND_014_SELECTION.md",
] as const);

export type R14Selection = Readonly<{
  eligibleDiscoveryHorizons: readonly R13HorizonHours[];
  selectedDiscoveryHorizon: R13HorizonHours | null;
  selectionAlgorithmApplied: boolean;
  finalDecision: "FORWARD EDGE DISCOVERED — ROUND-014" | "NO ROBUST FORWARD EDGE — ROUND-014";
}>;

export type R14PerformanceReport = Readonly<{
  schemaVersion: typeof M3_R14_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R14_RESEARCH_ROUND_ID;
  replayOfResearchRoundId: typeof M3_R14_REPLAY_OF_RESEARCH_ROUND_ID;
  executionId: string;
  executionSourceSha: string;
  acceptedSourceSha: typeof M3_R13_ACCEPTED_R11_SOURCE_SHA;
  replaySourceCommit: typeof M3_R14_SOURCE_R13_COMMIT;
  selectionGateSha256: typeof R13_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof R13_PLAN_SHA256;
  scientificSpecIdentitySha256: typeof M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: typeof M3_R13_POLICY_VERSION;
  dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA";
  researchUniverse: typeof M3_R13_RESEARCH_RANGE;
  researchBoundary: typeof M3_R13_RESEARCH_END_ISO;
  performanceLock: typeof M3_R14_PERFORMANCE_LOCK;
  performanceLockTriggered: true;
  performanceExecutionCount: 1;
  performanceLifecycle: "PERFORMANCE_LOCKED_CRASH_SAFE";
  datasetFreeze: Readonly<Record<string, unknown>>;
  observationFreeze: Readonly<Pick<R14ObservationFreezeManifest, "schemaVersion" | "observationCount" | "observationDataBytes" | "observationDataSha256" | "manifestSha256" | "warmupExcludedObservations" | "integrityExcludedObservations">>;
  conformance: R13SpecConformanceReport;
  identity: R14IdentityDocument;
  observationCounts: Readonly<{ all: number; byHorizon: Readonly<Record<R13HorizonHours, number>>; totalCanonicalDecisionTimestamps: number; warmupExcludedObservations: number; eligibleObservations: number; integrityExcludedObservations: number }>;
  horizons: readonly R13HorizonPerformance[];
  selection: R14Selection;
  control: Readonly<{ id: "R13-CONTROL-ALL-CLOSED-CROSS-SECTIONAL-OPPORTUNITIES"; executionCount: 1; source: "ALL_COMPLETE_CROSS_SECTIONAL_OBSERVATIONS" }>;
  checkpointSummary: Readonly<{ continuationCount: number; completedCheckpointCount: number; recomputedCompletedCheckpoints: number }>;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  privateBinanceApi: false;
  automaticTrading: false;
}>;

export type R14ExecutionArtifacts = Readonly<{
  report: R14PerformanceReport;
  summaryJson: string;
  auditJson: string;
  resultsMarkdown: string;
  selectionJson: string;
  selectionMarkdown: string;
}>;

type ModelCheckpointPayload = Readonly<{
  foldId: ResearchFoldId;
  horizonHours: R13HorizonHours;
  model: R13RidgeModel | null;
  provenance: R13HorizonPerformance["modelProvenance"][number];
}>;

type HorizonCheckpointPayload = Readonly<{
  horizonHours: R13HorizonHours;
  performance: R13HorizonPerformance;
}>;

type SelectionCheckpointPayload = Readonly<{
  selection: R14Selection;
  horizonSummaries: readonly Readonly<{ horizonHours: R13HorizonHours; eligibility: "ELIGIBLE" | "INELIGIBLE"; failedGateIds: readonly string[] }>[];
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!;
}

function pearson(left: readonly number[], right: readonly number[]): number | null {
  if (left.length < 2 || left.length !== right.length) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index]! - rightMean), 0);
  const leftDenom = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0));
  const rightDenom = Math.sqrt(right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
  return leftDenom === 0 || rightDenom === 0 ? null : numerator / (leftDenom * rightDenom);
}

function ranks(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index);
  const result = Array<number>(values.length);
  order.forEach((item, index) => { result[item.index] = index + 1; });
  return result;
}

function spearman(left: readonly number[], right: readonly number[]): number | null {
  return left.length < 2 || left.length !== right.length ? null : pearson(ranks(left), ranks(right));
}

function directionOrder(direction: R13Direction): number {
  return direction === "LONG" ? 0 : 1;
}

function foldRole(observation: R13Observation, foldId: ResearchFoldId, role: "RESEARCH" | "VALIDATION"): boolean {
  const range = getResearchFoldRoleRange(foldId, role);
  return observation.decisionTime >= range.startTime && observation.decisionTime <= range.endTime;
}

function modelInputHashes(input: Readonly<{ executionSourceSha: string; observationDatasetSha256: string; horizonHours: number; foldId: string }>): Readonly<Record<string, string>> {
  return Object.freeze({ executionSourceSha: input.executionSourceSha, observationDatasetSha256: input.observationDatasetSha256, scientificSpecIdentitySha256: M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256, horizonHours: String(input.horizonHours), foldId: input.foldId });
}

async function fitFoldModel(input: Readonly<{ observationFile: string; executionDirectory: string; executionSourceSha: string; observationDatasetSha256: string; horizonHours: R13HorizonHours; foldId: ResearchFoldId }>): Promise<Readonly<{ model: R13RidgeModel | null; provenance: R13HorizonPerformance["modelProvenance"][number]; reused: boolean }>> {
  const inputHashes = modelInputHashes(input);
  const checkpointPath = modelCheckpointPath(input.executionDirectory, input.horizonHours, input.foldId);
  if (checkpointExists(checkpointPath)) {
    const checkpoint = readR14Checkpoint<ModelCheckpointPayload>(checkpointPath, inputHashes);
    return Object.freeze({ model: checkpoint.payload.model, provenance: checkpoint.payload.provenance, reused: true });
  }
  const validationRange = getResearchFoldRoleRange(input.foldId, "VALIDATION");
  const examples: R13FitExample[] = [];
  for await (const observation of streamR14Observations(input.observationFile)) {
    if (!foldRole(observation, input.foldId, "RESEARCH") || !isR13TrainingObservationPurgeSafe({ decisionTime: observation.decisionTime, validationStartTime: validationRange.startTime }) || observation.labels[input.horizonHours].status !== "EXECUTED") continue;
    const target = observation.labels[input.horizonHours].netForwardAtr;
    if (target === null || !Number.isFinite(target)) throw new Error(`R14 non-finite training target at ${observation.observationId}.`);
    examples.push({ features: observation.features, targetNetForwardAtr: target });
  }
  let model: R13RidgeModel | null = null;
  let provenance: R13HorizonPerformance["modelProvenance"][number];
  if (examples.length < 19) {
    provenance = Object.freeze({ foldId: input.foldId, status: "INSUFFICIENT_RESEARCH_EXAMPLES", trainingExamples: examples.length, modelIdentitySha256: null, standardizationIdentitySha256: null, lambda: 10, coefficientHash: null });
  } else {
    model = fitR13RidgeModel(examples);
    provenance = Object.freeze({ foldId: input.foldId, status: "FIT", trainingExamples: examples.length, modelIdentitySha256: model.modelIdentitySha256, standardizationIdentitySha256: model.standardization.identitySha256, lambda: 10, coefficientHash: hash(model.coefficients) });
  }
  writeR14CheckpointAtomic<ModelCheckpointPayload>({ filePath: checkpointPath, kind: "MODEL", key: `${input.horizonHours}|${input.foldId}`, inputHashes, payload: Object.freeze({ foldId: input.foldId, horizonHours: input.horizonHours, model, provenance }) });
  return Object.freeze({ model, provenance, reused: false });
}

type ScoredAtTime = Readonly<{ observation: R13Observation; prediction: number }>;

async function collectValidation(input: Readonly<{ observationFile: string; models: Readonly<Record<ResearchFoldId, R13RidgeModel | null>>; horizon: R13HorizonHours }>): Promise<Readonly<{ selections: readonly R13ScoredSelection[]; opportunities: readonly R13ScoredOpportunity[]; noTrade: number; timestamps: number; insufficientCrossSectionalTimestamps: number }>> {
  const selections: R13ScoredSelection[] = [];
  const opportunities: R13ScoredOpportunity[] = [];
  let noTrade = 0;
  let timestamps = 0;
  let insufficientCrossSectionalTimestamps = 0;

  for (const foldId of R13_FOLD_IDS) {
    let currentTime: number | null = null;
    const current: R13Observation[] = [];
    const model = input.models[foldId];
    const process = (values: readonly R13Observation[], decisionTime: number): void => {
      timestamps += 1;
      if (!model) { noTrade += 1; return; }
      const scored: ScoredAtTime[] = values.map((observation) => ({ observation, prediction: predictR13RidgeModel(model, observation.features) }));
      const usableAtTime = scored.filter((value) => value.observation.labels[input.horizon].status === "EXECUTED" && value.observation.labels[input.horizon].netForwardAtr !== null && Number.isFinite(value.observation.labels[input.horizon].netForwardAtr));
      if (usableAtTime.length < 2) insufficientCrossSectionalTimestamps += 1;
      for (const value of usableAtTime) {
        const label = value.observation.labels[input.horizon];
        opportunities.push(Object.freeze({ observationId: value.observation.observationId, foldId, decisionTime, symbol: value.observation.symbol, direction: value.observation.direction, prediction: value.prediction, label, latencyStressLabel: value.observation.latencyStressLabels[input.horizon] }));
      }
      const top = r13SelectTopOne(scored.map((value) => ({ ...value, symbol: value.observation.symbol, direction: value.observation.direction })));
      if (!top.selected) { noTrade += 1; return; }
      const selected = top.selected;
      const label = selected.observation.labels[input.horizon];
      if (label.status === "EXECUTED") selections.push(Object.freeze({ observationId: selected.observation.observationId, foldId, decisionTime, symbol: selected.observation.symbol, direction: selected.observation.direction, prediction: selected.prediction, label, latencyStressLabel: selected.observation.latencyStressLabels[input.horizon] }));
    };
    for await (const observation of streamR14Observations(input.observationFile)) {
      if (!foldRole(observation, foldId, "VALIDATION")) continue;
      if (currentTime !== null && observation.decisionTime !== currentTime) {
        process(current, currentTime);
        current.length = 0;
      }
      currentTime = observation.decisionTime;
      current.push(observation);
    }
    if (currentTime !== null) process(current, currentTime);
  }
  return Object.freeze({ selections: Object.freeze(selections), opportunities: Object.freeze(opportunities), noTrade, timestamps, insufficientCrossSectionalTimestamps });
}

function gateCountByFold(values: readonly R13ScoredSelection[]): Readonly<Record<ResearchFoldId, number>> {
  return Object.freeze(Object.fromEntries(R13_FOLD_IDS.map((foldId) => [foldId, values.filter((value) => value.foldId === foldId && value.label.netForwardAtr !== null && Number.isFinite(value.label.netForwardAtr)).length])) as Record<ResearchFoldId, number>);
}

function metricForHorizon(input: Readonly<{ selected: Awaited<ReturnType<typeof collectValidation>>; models: Readonly<Record<ResearchFoldId, R13RidgeModel | null>>; provenance: R13HorizonPerformance["modelProvenance"]; horizon: R13HorizonHours; evidenceIntegrity: boolean }>): R13HorizonPerformance {
  const selected = input.selected;
  const opportunities = selected.opportunities;
  const usableSelections = selected.selections.filter((selection) => selection.label.netForwardAtr !== null && Number.isFinite(selection.label.netForwardAtr));
  const values = usableSelections.map((selection) => selection.label.netForwardAtr!);
  const positive = values.filter((value) => value > 0);
  const negative = values.filter((value) => value < 0);
  const stressValues = usableSelections.map((selection) => selection.latencyStressLabel.netForwardAtr).filter((value): value is number => value !== null && Number.isFinite(value));
  const byFoldMean = Object.fromEntries(R13_FOLD_IDS.map((foldId) => [foldId, mean(usableSelections.filter((selection) => selection.foldId === foldId).map((selection) => selection.label.netForwardAtr!))])) as Record<ResearchFoldId, number | null>;
  const positiveMeanEdgeFolds = Object.values(byFoldMean).filter((value): value is number => value !== null && value > 0).length;
  const negativeMeanEdgeFolds = Object.values(byFoldMean).filter((value): value is number => value !== null && value < 0).length;
  const catastrophicFolds = Object.values(byFoldMean).filter((value): value is number => value !== null && value <= -0.10).length;
  const byDecisionTime = new Map<string, R13ScoredOpportunity[]>();
  for (const opportunity of opportunities) {
    const group = byDecisionTime.get(`${opportunity.foldId}|${opportunity.decisionTime}`) ?? [];
    group.push(opportunity);
    byDecisionTime.set(`${opportunity.foldId}|${opportunity.decisionTime}`, group);
  }
  const timestampSpearman = [...byDecisionTime.values()].map((group) => spearman(group.map((value) => value.prediction), group.map((value) => value.label.netForwardAtr!))).filter((value): value is number => value !== null);
  const foldSpearman = R13_FOLD_IDS.map((foldId) => mean([...byDecisionTime.entries()].filter(([key]) => key.startsWith(`${foldId}|`)).map(([, group]) => spearman(group.map((value) => value.prediction), group.map((value) => value.label.netForwardAtr!))).filter((value): value is number => value !== null)));
  const positiveSpearmanFolds = foldSpearman.filter((value) => value !== null && value > 0).length;
  const pooledSpearman = mean(timestampSpearman);
  const decileRows: Array<R13ScoredOpportunity & { decile: number }> = [];
  for (const foldId of R13_FOLD_IDS) {
    const fold = opportunities.filter((opportunity) => opportunity.foldId === foldId).sort((left, right) => left.prediction - right.prediction || left.decisionTime - right.decisionTime || left.symbol.localeCompare(right.symbol) || directionOrder(left.direction) - directionOrder(right.direction));
    for (const [index, opportunity] of fold.entries()) decileRows.push({ ...opportunity, decile: Math.floor(index * 10 / Math.max(1, fold.length)) });
  }
  const deciles = Object.freeze(Array.from({ length: 10 }, (_, decile) => {
    const group = decileRows.filter((value) => value.decile === decile);
    return Object.freeze({ decile, count: group.length, meanRealizedNetForwardAtr: mean(group.map((selection) => selection.label.netForwardAtr!)) });
  }));
  const spread = deciles[9]!.meanRealizedNetForwardAtr !== null && deciles[0]!.meanRealizedNetForwardAtr !== null ? deciles[9]!.meanRealizedNetForwardAtr - deciles[0]!.meanRealizedNetForwardAtr : null;
  const positiveSpreadFolds = R13_FOLD_IDS.filter((foldId) => {
    const fold = decileRows.filter((value) => value.foldId === foldId);
    const bottom = mean(fold.filter((value) => value.decile === 0).map((value) => value.label.netForwardAtr!));
    const top = mean(fold.filter((value) => value.decile === 9).map((value) => value.label.netForwardAtr!));
    return bottom !== null && top !== null && top - bottom > 0;
  }).length;
  const drawdown = calculateR13Drawdown(usableSelections.map((selection) => ({ decisionTime: selection.decisionTime, symbol: selection.symbol, direction: selection.direction, netForwardAtr: selection.label.netForwardAtr! })));
  const positiveSelections = usableSelections.filter((selection) => selection.label.netForwardAtr! > 0);
  const totalPositive = positive.reduce((sum, value) => sum + value, 0);
  const symbolContributions = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, positiveSelections.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.label.netForwardAtr!, 0)])) as Record<ResearchSymbol, number>;
  const maxSymbolShare = totalPositive > 0 ? Math.max(...R13_SYMBOLS.map((symbol) => symbolContributions[symbol])) / totalPositive : null;
  const maxSingleShare = totalPositive > 0 ? Math.max(...positive) / totalPositive : null;
  const netBySymbol = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, usableSelections.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.label.netForwardAtr!, 0)])) as Record<ResearchSymbol, number>;
  const netByDirection = { LONG: usableSelections.filter((selection) => selection.direction === "LONG").reduce((sum, selection) => sum + selection.label.netForwardAtr!, 0), SHORT: usableSelections.filter((selection) => selection.direction === "SHORT").reduce((sum, selection) => sum + selection.label.netForwardAtr!, 0) } as const;
  const costStressValues = usableSelections.map((selection) => selection.label.netForwardAtrCostStress).filter((value): value is number => value !== null && Number.isFinite(value));
  const costPositive = costStressValues.filter((value) => value > 0);
  const costNegative = costStressValues.filter((value) => value < 0);
  const monthCounts = new Map<string, number>();
  for (const selection of usableSelections) {
    const date = new Date(selection.decisionTime);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  const monthlyCounts = [...monthCounts.values()];
  const grossPositiveAtr = positiveSelections.reduce((sum, selection) => sum + (selection.label.grossForwardAtr ?? 0), 0);
  const grossNegativeAtrMagnitude = Math.abs(usableSelections.filter((selection) => (selection.label.grossForwardAtr ?? 0) < 0).reduce((sum, selection) => sum + (selection.label.grossForwardAtr ?? 0), 0));
  const metrics: R13HorizonMetrics = Object.freeze({
    horizonHours: input.horizon,
    selectedValidationObservations: values.length,
    noTradeDecisionTimestamps: selected.noTrade,
    totalValidationDecisionTimestamps: selected.timestamps,
    meanNetForwardAtr: mean(values),
    medianNetForwardAtr: median(values),
    meanSelectedSignalsPerMonth: mean(monthlyCounts),
    medianSelectedSignalsPerMonth: median(monthlyCounts),
    grossPositiveAtr,
    grossNegativeAtrMagnitude,
    totalFeesBps: usableSelections.reduce((sum, selection) => sum + (selection.label.feesBps ?? 0), 0),
    totalFundingBps: usableSelections.reduce((sum, selection) => sum + (selection.label.fundingBps ?? 0), 0),
    totalSlippageBps: usableSelections.reduce((sum, selection) => sum + (selection.label.slippageBps ?? 0), 0),
    atrProfitFactor: negative.length ? positive.reduce((sum, value) => sum + value, 0) / Math.abs(negative.reduce((sum, value) => sum + value, 0)) : null,
    cumulativeNetForwardAtr: values.reduce((sum, value) => sum + value, 0),
    maximumDrawdownAtr: drawdown.maximumDrawdownAtr,
    positiveMeanEdgeFolds,
    negativeMeanEdgeFolds,
    catastrophicFolds,
    positiveSpearmanFolds,
    pooledSpearman,
    topBottomDecileSpread: spread,
    positiveSpreadFolds,
    crossSectionalOpportunityCount: opportunities.length,
    crossSectionalOpportunityTimestamps: opportunities.length === 0 ? 0 : new Set(opportunities.map((value) => `${value.foldId}|${value.decisionTime}`)).size,
    insufficientCrossSectionalTimestamps: selected.insufficientCrossSectionalTimestamps,
    costStressMean: mean(costStressValues) ?? 0,
    costStressProfitFactor: costNegative.length ? costPositive.reduce((sum, value) => sum + value, 0) / Math.abs(costNegative.reduce((sum, value) => sum + value, 0)) : null,
    latencyStressMean: mean(stressValues) ?? 0,
    maximumPositiveSymbolContributionShare: maxSymbolShare,
    maximumSinglePositiveObservationContribution: maxSingleShare,
    byFoldMeanNetForwardAtr: Object.freeze(byFoldMean),
    bySymbolNetForwardAtr: Object.freeze(netBySymbol),
    byDirectionNetForwardAtr: Object.freeze(netByDirection),
    deciles,
  });
  const gateEvaluation = evaluateR13HorizonGates({ horizonHours: input.horizon, selectedValidationObservationsAggregate: metrics.selectedValidationObservations, selectedValidationObservationsByFold: gateCountByFold(usableSelections), meanNetForwardAtr: metrics.meanNetForwardAtr ?? Number.NEGATIVE_INFINITY, atrProfitFactor: metrics.atrProfitFactor, positiveMeanEdgeFolds, catastrophicFolds, positiveSpearmanFolds, pooledSpearman, topBottomDecileSpread: spread, positiveSpreadFolds, costStressMean: metrics.costStressMean, costStressProfitFactor: metrics.costStressProfitFactor, latencyStressMean: metrics.latencyStressMean, maximumPositiveSymbolContributionShare: maxSymbolShare, maximumSinglePositiveObservationContribution: maxSingleShare, evidenceIntegrity: input.evidenceIntegrity, modelProvenance: input.provenance.every((value) => value.status === "FIT") });
  return Object.freeze({ horizonHours: input.horizon, metrics, gateEvaluation, modelProvenance: input.provenance });
}

async function executeHorizon(input: Readonly<{ observationFile: string; executionDirectory: string; executionSourceSha: string; observationDatasetSha256: string; horizon: R13HorizonHours; evidenceIntegrity: boolean }>): Promise<Readonly<{ performance: R13HorizonPerformance; reused: boolean }>> {
  const horizonHashes = Object.freeze({ executionSourceSha: input.executionSourceSha, observationDatasetSha256: input.observationDatasetSha256, scientificSpecIdentitySha256: M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256, horizonHours: String(input.horizon) });
  const checkpointPath = horizonCheckpointPath(input.executionDirectory, input.horizon);
  if (checkpointExists(checkpointPath)) {
    const checkpoint = readR14Checkpoint<HorizonCheckpointPayload>(checkpointPath, horizonHashes);
    return Object.freeze({ performance: checkpoint.payload.performance, reused: true });
  }
  const models = {} as Record<ResearchFoldId, R13RidgeModel | null>;
  const provenance: Array<R13HorizonPerformance["modelProvenance"][number]> = [];
  for (const foldId of R13_FOLD_IDS) {
    const result = await fitFoldModel({ observationFile: input.observationFile, executionDirectory: input.executionDirectory, executionSourceSha: input.executionSourceSha, observationDatasetSha256: input.observationDatasetSha256, horizonHours: input.horizon, foldId });
    models[foldId] = result.model;
    provenance.push(result.provenance);
  }
  const selected = await collectValidation({ observationFile: input.observationFile, models, horizon: input.horizon });
  const performance = metricForHorizon({ selected, models, provenance: Object.freeze(provenance), horizon: input.horizon, evidenceIntegrity: input.evidenceIntegrity });
  writeR14CheckpointAtomic<HorizonCheckpointPayload>({ filePath: checkpointPath, kind: "HORIZON", key: String(input.horizon), inputHashes: horizonHashes, payload: Object.freeze({ horizonHours: input.horizon, performance }) });
  return Object.freeze({ performance, reused: false });
}

function selectR14Horizons(horizons: readonly R13HorizonPerformance[]): R14Selection {
  const candidates: R13HorizonSelectionCandidate[] = horizons.map((result) => ({ horizonHours: result.horizonHours, eligible: result.gateEvaluation.eligibility === "ELIGIBLE", meanNetForwardAtr: result.metrics.meanNetForwardAtr ?? Number.NEGATIVE_INFINITY, costStressMean: result.metrics.costStressMean, maximumDrawdownAtr: result.metrics.maximumDrawdownAtr, atrProfitFactor: result.metrics.atrProfitFactor ?? Number.NEGATIVE_INFINITY }));
  const selected = selectR13Horizon(candidates);
  return Object.freeze({ eligibleDiscoveryHorizons: selected.eligibleDiscoveryHorizons, selectedDiscoveryHorizon: selected.selectedDiscoveryHorizon, selectionAlgorithmApplied: selected.selectionAlgorithmApplied, finalDecision: selected.selectedDiscoveryHorizon === null ? "NO ROBUST FORWARD EDGE — ROUND-014" : "FORWARD EDGE DISCOVERED — ROUND-014" });
}

export async function executeR14Performance(input: Readonly<{ root?: string; executionDirectory: string; executionLock: R14ExecutionLock; observationFreeze?: R14ObservationFreezeManifest; datasetFreeze: Readonly<Record<string, unknown>>; conformance?: R13SpecConformanceReport; identity?: R14IdentityDocument; onHorizonComplete?: (horizon: R13HorizonHours) => void }>): Promise<Readonly<{ report: R14PerformanceReport; reusedHorizonCount: number; recomputedCompletedCheckpoints: number }>> {
  const root = path.resolve(input.root ?? process.cwd());
  validateR13Plan();
  const conformance = input.conformance ?? readR13SpecConformance();
  const identity = input.identity ?? readR14Identity(path.join(root, M3_R14_IDENTITY_PATH));
  const observationFreeze = input.observationFreeze ?? readR14ObservationFreeze(root);
  const observationFile = path.resolve(root, observationFreeze.observationDataPath);
  const horizons: R13HorizonPerformance[] = [];
  let reusedHorizonCount = 0;
  for (const horizon of R13_HORIZON_HOURS) {
    const result = await executeHorizon({ observationFile, executionDirectory: input.executionDirectory, executionSourceSha: input.executionLock.executionSourceSha, observationDatasetSha256: observationFreeze.observationDataSha256, horizon, evidenceIntegrity: observationFreeze.integrityExcludedObservations === 0 });
    if (result.reused) reusedHorizonCount += 1;
    horizons.push(result.performance);
    input.onHorizonComplete?.(horizon);
  }
  const selectionHashes = Object.freeze({ executionSourceSha: input.executionLock.executionSourceSha, observationDatasetSha256: observationFreeze.observationDataSha256, scientificSpecIdentitySha256: M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256, horizonsSha256: hash(horizons) });
  const selectionPath = selectionCheckpointPath(input.executionDirectory);
  let selection: R14Selection;
  if (checkpointExists(selectionPath)) {
    const checkpoint = readR14Checkpoint<SelectionCheckpointPayload>(selectionPath, selectionHashes);
    selection = checkpoint.payload.selection;
  } else {
    selection = selectR14Horizons(horizons);
    writeR14CheckpointAtomic<SelectionCheckpointPayload>({ filePath: selectionPath, kind: "SELECTION", key: input.executionLock.executionId, inputHashes: selectionHashes, payload: Object.freeze({ selection, horizonSummaries: horizons.map((result) => Object.freeze({ horizonHours: result.horizonHours, eligibility: result.gateEvaluation.eligibility, failedGateIds: result.gateEvaluation.failedGateIds })) }) });
  }
  const observationCounts = Object.freeze({ all: observationFreeze.observationCount, byHorizon: Object.freeze(Object.fromEntries(R13_HORIZON_HOURS.map((horizon) => [horizon, observationFreeze.labelStatusCountsByHorizon[String(horizon) as "4" | "8" | "12" | "24"].EXECUTED])) as Record<R13HorizonHours, number>), totalCanonicalDecisionTimestamps: observationFreeze.observationCount / 10, warmupExcludedObservations: observationFreeze.warmupExcludedObservations, eligibleObservations: observationFreeze.observationCount, integrityExcludedObservations: observationFreeze.integrityExcludedObservations });
  const report: R14PerformanceReport = Object.freeze({
    schemaVersion: M3_R14_REPORT_SCHEMA_VERSION,
    researchRoundId: M3_R14_RESEARCH_ROUND_ID,
    replayOfResearchRoundId: M3_R14_REPLAY_OF_RESEARCH_ROUND_ID,
    executionId: input.executionLock.executionId,
    executionSourceSha: input.executionLock.executionSourceSha,
    acceptedSourceSha: M3_R13_ACCEPTED_R11_SOURCE_SHA,
    replaySourceCommit: M3_R14_SOURCE_R13_COMMIT,
    selectionGateSha256: R13_SELECTION_GATE_SHA256,
    experimentPlanSha256: R13_PLAN_SHA256,
    scientificSpecIdentitySha256: M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256,
    strategyVersion: "baseline-001",
    backtestPolicyVersion: M3_R13_POLICY_VERSION,
    dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
    researchUniverse: M3_R13_RESEARCH_RANGE,
    researchBoundary: M3_R13_RESEARCH_END_ISO,
    performanceLock: M3_R14_PERFORMANCE_LOCK,
    performanceLockTriggered: true,
    performanceExecutionCount: 1,
    performanceLifecycle: "PERFORMANCE_LOCKED_CRASH_SAFE",
    datasetFreeze: input.datasetFreeze,
    observationFreeze: Object.freeze({ schemaVersion: observationFreeze.schemaVersion, observationCount: observationFreeze.observationCount, observationDataBytes: observationFreeze.observationDataBytes, observationDataSha256: observationFreeze.observationDataSha256, manifestSha256: observationFreeze.manifestSha256, warmupExcludedObservations: observationFreeze.warmupExcludedObservations, integrityExcludedObservations: observationFreeze.integrityExcludedObservations }),
    conformance,
    identity,
    observationCounts,
    horizons: Object.freeze(horizons),
    selection,
    control: Object.freeze({ id: "R13-CONTROL-ALL-CLOSED-CROSS-SECTIONAL-OPPORTUNITIES", executionCount: 1, source: "ALL_COMPLETE_CROSS_SECTIONAL_OBSERVATIONS" }),
    checkpointSummary: Object.freeze({ continuationCount: input.executionLock.continuationCount, completedCheckpointCount: R13_FOLD_IDS.length * R13_HORIZON_HOURS.length + R13_HORIZON_HOURS.length + 1, recomputedCompletedCheckpoints: 0 }),
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    privateBinanceApi: false,
    automaticTrading: false,
  });
  return Object.freeze({ report, reusedHorizonCount, recomputedCompletedCheckpoints: 0 });
}

function renderResults(report: R14PerformanceReport): string {
  const lines = [
    "# M3-R14 Round-014 R13 Exact Execution Replay",
    "",
    `- researchRoundId: ${report.researchRoundId}`,
    `- replayOfResearchRoundId: ${report.replayOfResearchRoundId}`,
    `- executionId: ${report.executionId}`,
    `- executionSourceSha: ${report.executionSourceSha}`,
    `- R13 result status: INVALIDATED / PERFORMANCE_ABORT_AFTER_LOCK`,
    `- scientificDeviationCount: ${report.identity.scientificDeviationCount}`,
    `- performanceLock: ${report.performanceLock}`,
    `- performanceExecutionCount: ${report.performanceExecutionCount}`,
    "",
    "| horizon | selected | no-trade rate | mean net ATR | median net ATR | ATR PF | cumulative net ATR | max DD ATR | gates |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const result of report.horizons) {
    const noTradeRate = result.metrics.totalValidationDecisionTimestamps === 0 ? null : result.metrics.noTradeDecisionTimestamps / result.metrics.totalValidationDecisionTimestamps;
    lines.push(`| H${result.horizonHours} | ${result.metrics.selectedValidationObservations} | ${noTradeRate ?? "null"} | ${result.metrics.meanNetForwardAtr ?? "null"} | ${result.metrics.medianNetForwardAtr ?? "null"} | ${result.metrics.atrProfitFactor ?? "null"} | ${result.metrics.cumulativeNetForwardAtr} | ${result.metrics.maximumDrawdownAtr} | ${result.gateEvaluation.eligibility} |`);
  }
  lines.push("", `- finalDecision: ${report.selection.finalDecision}`, `- selectedDiscoveryHorizon: ${report.selection.selectedDiscoveryHorizon ?? "null"}`, `- baseline002Status: ${report.baseline002Status}`, `- m3JStatus: ${report.m3JStatus}`, `- m4Status: ${report.m4Status}`, `- privateBinanceApi: ${report.privateBinanceApi}`, `- automaticTrading: ${report.automaticTrading}`);
  return lines.join("\n");
}

function selectionMarkdown(report: R14PerformanceReport): string {
  return [
    "# M3-R14 Round-014 Selection",
    "",
    `- eligibleDiscoveryHorizons: ${report.selection.eligibleDiscoveryHorizons.join(", ") || "none"}`,
    `- selectedDiscoveryHorizon: ${report.selection.selectedDiscoveryHorizon ?? "null"}`,
    `- finalDecision: ${report.selection.finalDecision}`,
    `- selectionAlgorithmApplied: ${report.selection.selectionAlgorithmApplied}`,
    "- selection is a mechanical replay result only; it is not a Production strategy.",
  ].join("\n");
}

export function buildR14ExecutionArtifacts(report: R14PerformanceReport): R14ExecutionArtifacts {
  const selectionJson = stableStringify({ schemaVersion: "m3-r14-round-014-selection-001", researchRoundId: report.researchRoundId, replayOfResearchRoundId: report.replayOfResearchRoundId, executionId: report.executionId, executionSourceSha: report.executionSourceSha, selectionGateSha256: report.selectionGateSha256, experimentPlanSha256: report.experimentPlanSha256, scientificSpecIdentitySha256: report.scientificSpecIdentitySha256, performanceLock: report.performanceLock, evidenceStatus: "COMPLETE", eligibleDiscoveryHorizons: report.selection.eligibleDiscoveryHorizons, selectedDiscoveryHorizon: report.selection.selectedDiscoveryHorizon, selectionAlgorithmApplied: report.selection.selectionAlgorithmApplied, finalDecision: report.selection.finalDecision, baseline002Status: report.baseline002Status, m3JStatus: report.m3JStatus, m4Status: report.m4Status });
  const resultsMarkdown = renderResults(report);
  const selectionMarkdownText = selectionMarkdown(report);
  const summaryJson = stableStringify({ ...report, evidenceStatus: "COMPLETE" });
  const auditJson = stableStringify({
    schemaVersion: M3_R14_AUDIT_SCHEMA_VERSION,
    replay: { researchRoundId: report.researchRoundId, replayOfResearchRoundId: report.replayOfResearchRoundId, r13Result: "INVALIDATED / PERFORMANCE_ABORT_AFTER_LOCK", r13PerformanceResultsReused: false, r13DatasetReusedExactly: true, scientificDeviationCount: report.identity.scientificDeviationCount },
    execution: { executionId: report.executionId, executionSourceSha: report.executionSourceSha, performanceLock: report.performanceLock, performanceExecutionCount: report.performanceExecutionCount, continuationCount: report.checkpointSummary.continuationCount, completedCheckpointCount: report.checkpointSummary.completedCheckpointCount, recomputedCompletedCheckpoints: report.checkpointSummary.recomputedCompletedCheckpoints, controlRuns: report.control.executionCount, horizonModelRuns: report.horizons.length * R13_FOLD_IDS.length, selectionRuns: 1, privateBinanceApi: false, automaticTrading: false },
    dataset: { datasetIdentitySha256: report.observationFreeze.observationDataSha256, sourceDatasetSha256: M3_R14_DATASET_IDENTITY_SHA256, sourceManifestIdentitySha256: M3_R14_MANIFEST_IDENTITY_SHA256, observationFreezeManifestSha256: report.observationFreeze.manifestSha256, observationFreezePath: R14_OBSERVATION_FREEZE_PATH, observationDataPath: R14_OBSERVATION_DATA_RELATIVE_PATH },
    horizons: report.horizons.map((result) => ({ horizonHours: result.horizonHours, gateResults: result.gateEvaluation.gateResults, failedGateIds: result.gateEvaluation.failedGateIds, modelProvenance: result.modelProvenance })),
    exactUtf8ArtifactSha256: { summary: hash(summaryJson), results: hash(resultsMarkdown), selectionJson: hash(selectionJson), selectionMarkdown: hash(selectionMarkdownText) },
  });
  return Object.freeze({ report, summaryJson, auditJson, resultsMarkdown, selectionJson, selectionMarkdown: selectionMarkdownText });
}

export function r14OutputPaths(root = process.cwd()): readonly string[] {
  return M3_R14_OUTPUT_PATHS.map((relative) => path.join(root, relative));
}

export function existingR14OutputArtifacts(root = process.cwd()): readonly string[] {
  return Object.freeze(r14OutputPaths(root).filter((filePath) => existsSync(filePath)));
}

/** Publish only fully formed artifacts. SUMMARY is the final commit marker. */
export function publishR14ArtifactsAtomically(input: Readonly<{ artifacts: R14ExecutionArtifacts; root?: string; beforePublish?: (target: string, index: number) => void }>): void {
  const root = path.resolve(input.root ?? process.cwd());
  const outputPaths = r14OutputPaths(root);
  if (outputPaths.some((target) => existsSync(target))) throw new Error("R14 output already exists; refusing overwrite.");
  const byName = new Map(outputPaths.map((target, index) => [path.basename(target), [target, [input.artifacts.summaryJson, input.artifacts.auditJson, input.artifacts.resultsMarkdown, input.artifacts.selectionJson, input.artifacts.selectionMarkdown][index]!] as const]));
  const publication = ["M3_R14_ROUND_014_AUDIT.json", "M3_R14_ROUND_014_RESULTS.md", "M3_R14_ROUND_014_SELECTION.json", "M3_R14_ROUND_014_SELECTION.md", "M3_R14_ROUND_014_SUMMARY.json"].map((name) => byName.get(name)!);
  const stagingParent = path.join(root, "docs");
  mkdirSync(stagingParent, { recursive: true });
  for (const [target] of publication) mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(stagingParent, ".m3-r14-round-014-staging-"));
  const published: string[] = [];
  try {
    for (const [target, payload] of publication) writeFileSync(path.join(staging, path.basename(target)), payload, "utf8");
    for (const [index, [target]] of publication.entries()) {
      input.beforePublish?.(target, index);
      if (existsSync(target)) throw new Error(`R14 output appeared during publication: ${target}`);
      renameSync(path.join(staging, path.basename(target)), target);
      published.push(target);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const target of [...published].reverse()) {
      try { unlinkSync(target); } catch (rollbackError) { rollbackErrors.push(`${target}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); }
    }
    try { rmSync(staging, { recursive: true, force: true }); } catch (cleanupError) { rollbackErrors.push(`staging: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`); }
    const primary = error instanceof Error ? error : new Error(String(error));
    if (rollbackErrors.length > 0) primary.message = `${primary.message}; rollback failures: ${rollbackErrors.join("; ")}`;
    throw primary;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function r14ArtifactSizes(root = process.cwd()): readonly Readonly<{ filePath: string; bytes: number }>[] {
  return Object.freeze(r14OutputPaths(root).map((filePath) => Object.freeze({ filePath, bytes: statSync(filePath).size })));
}
