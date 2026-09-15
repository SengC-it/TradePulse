import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getResearchFoldRoleRange } from "./folds.ts";
import { isR13TrainingObservationPurgeSafe } from "./m3-r13-round-013-validation.ts";
import {
  R15_ARTIFACT_HASH_METHOD,
  R15_ALPHA_FEATURE_NAMES,
  R15_BETA_FEATURE_NAMES,
  R15_OBSERVATION_DATA_PATH,
  R15_OBSERVATION_FREEZE_PATH,
  R15_PURGE_EMBARGO_HOURS,
  R15_REQUIRED_OUTPUT_PATHS,
  R15_RIDGE_LAMBDA,
  R15_SOURCE_DATASET_SHA256,
  R15_SOURCE_MANIFEST_SHA256,
  R15_SOURCE_OBSERVATION_SHA256,
  R15_SPEC_SHA256,
  R15_FOLD_IDS,
  R15_SYMBOLS,
  M3_R15_ACCEPTED_R14_SOURCE_SHA,
  M3_R15_CANDIDATE_OUTCOME,
  M3_R15_NO_CANDIDATE_OUTCOME,
  M3_R15_PERFORMANCE_LOCK,
  M3_R15_RESEARCH_END_ISO,
  M3_R15_RESEARCH_ROUND_ID,
  r15HashUtf8Bytes,
  type R15Direction,
} from "./m3-r15-round-015-protocol.ts";
import { R15_CONFORMANCE_DOCUMENT, R15_CONFORMANCE_SCHEMA_VERSION, R15_CONFORMANCE_SHA256, validateR15Conformance } from "./m3-r15-round-015-conformance.ts";
import { R15_GATE_SHA256, evaluateR15Gates, type R15GateResult } from "./selection-gates-round-015.ts";
import { R15_PLAN_SHA256, validateR15Plan } from "./m3-r15-round-015-plan.ts";
import { fitR15RidgeModel, predictR15RidgeModel, type R15RidgeModel } from "./m3-r15-round-015-model.ts";
import { streamR15Observations, type R15FrozenObservation, type R15ObservationFreezeManifest } from "./m3-r15-round-015-data.ts";
import { calculateR13Drawdown } from "./r13-drawdown.ts";
import { checkpointExists, finalPerformanceCheckpointPath, foldCheckpointPath, readR15Checkpoint, writeR15CheckpointAtomic, type R15ExecutionLock } from "./m3-r15-round-015-checkpoints.ts";
import { r15Deciles, r15Ranks, r15SelectTopOne, r15Spearman, r15TopBottomRealizedSpread } from "./m3-r15-round-015-behavior.ts";
import { stableStringify } from "./utils.ts";
import type { ResearchFoldId } from "./constants.ts";

export const M3_R15_REPORT_SCHEMA_VERSION = "m3-r15-round-015-report-001" as const;
export const M3_R15_AUDIT_SCHEMA_VERSION = "m3-r15-round-015-audit-001" as const;

export type R15ScoredSelection = Readonly<{
  observationId: string;
  foldId: ResearchFoldId;
  decisionTime: number;
  symbol: (typeof R15_SYMBOLS)[number];
  direction: R15Direction;
  predictedMarketBeta: number;
  predictedRelativeAlpha: number;
  predictedNetAtr: number;
  realizedNetForwardAtr: number;
  realizedCostStressNetAtr: number;
  realizedLatencyStressNetAtr: number;
  feesBps: number;
  fundingBps: number;
  slippageBps: number;
}>;

export type R15BetaPair = Readonly<{ foldId: ResearchFoldId; decisionTime: number; direction: R15Direction; predicted: number; realized: number }>;
export type R15AlphaPair = Readonly<{ foldId: ResearchFoldId; decisionTime: number; direction: R15Direction; symbol: (typeof R15_SYMBOLS)[number]; predicted: number; realized: number }>;
export type R15AlphaTimestampStatistic = Readonly<{ foldId: ResearchFoldId; decisionTime: number; direction: R15Direction; spearman: number | null; topBottomSpread: number | null }>;

export type R15FoldPerformance = Readonly<{
  foldId: ResearchFoldId;
  validationDecisionTimestamps: number;
  noTradeDecisionTimestamps: number;
  selected: readonly R15ScoredSelection[];
  betaPairs: readonly R15BetaPair[];
  alphaPairs: readonly R15AlphaPair[];
  alphaTimestampStatistics: readonly R15AlphaTimestampStatistic[];
}>;

export type R15ModelProvenance = Readonly<{
  foldId: ResearchFoldId;
  status: "FIT";
  betaModelId: "R15-BETA-H4";
  alphaModelId: "R15-ALPHA-H4";
  betaTrainingExamples: number;
  alphaTrainingExamples: number;
  betaModelIdentitySha256: string;
  alphaModelIdentitySha256: string;
  lambda: typeof R15_RIDGE_LAMBDA;
  standardizationScope: "RESEARCH_ONLY";
}>;

export type R15MetricDecile = Readonly<{ decile: number; count: number; mean: number | null }>;

export type R15PerformanceReport = Readonly<{
  schemaVersion: typeof M3_R15_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R15_RESEARCH_ROUND_ID;
  classification: "HISTORICAL_DEVELOPMENT_STUDY";
  h4SelectionBasis: "SEEN_HYPOTHESIS_FROM_R14";
  executionId: string;
  performanceExecutionSourceSha: string;
  acceptedR14SourceSha: typeof M3_R15_ACCEPTED_R14_SOURCE_SHA;
  sourceDatasetSha256: typeof R15_SOURCE_DATASET_SHA256;
  sourceManifestSha256: typeof R15_SOURCE_MANIFEST_SHA256;
  sourceObservationSha256: typeof R15_SOURCE_OBSERVATION_SHA256;
  sourceObservationDataSha256: string;
  specSha256: typeof R15_SPEC_SHA256;
  planSha256: typeof R15_PLAN_SHA256;
  gateSha256: typeof R15_GATE_SHA256;
  conformanceSha256: typeof R15_CONFORMANCE_SHA256;
  researchBoundary: typeof M3_R15_RESEARCH_END_ISO;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: "bt-policy-003";
  horizonHours: 4;
  purgeEmbargoHours: 24;
  performanceLock: typeof M3_R15_PERFORMANCE_LOCK;
  performanceLockTriggered: true;
  performanceExecutionCount: 1;
  performanceLifecycle: "PERFORMANCE_LOCKED_CRASH_SAFE";
  observationFreeze: Readonly<{ path: typeof R15_OBSERVATION_FREEZE_PATH; manifestSha256: string; observationCount: number; observationDataBytes: number; observationDataSha256: string; completeDecisionTimeCount: number; excludedIncompleteDecisionTimeCount: number; integrity: "COMPLETE" }>;
  beta: Readonly<{ modelId: "R15-BETA-H4"; pooledPearson: number | null; pooledSpearman: number | null; signAccuracy: number | null; positiveCorrelationFolds: number; perFold: readonly Readonly<{ foldId: ResearchFoldId; pearson: number | null; spearman: number | null; signAccuracy: number | null; realizedMean: number | null; predictionDeciles: readonly R15MetricDecile[] }>[]; realizedByPredictionDecile: readonly R15MetricDecile[] }>;
  alpha: Readonly<{ modelId: "R15-ALPHA-H4"; pooledSpearman: number | null; meanTimestampSpearman: number | null; positiveCorrelationFolds: number; foldMeans: readonly Readonly<{ foldId: ResearchFoldId; spearman: number | null; positiveTimestamps: number; timestampCount: number; topBottomSpread: number | null; positiveSpread: boolean }>[]; topBottomSpread: number | null; positiveSpreadFolds: number; }>;
  combined: Readonly<{ selectedCount: number; validationDecisionTimestamps: number; noTradeDecisionTimestamps: number; noTradeRate: number; meanSignalsPerMonth: number | null; medianSignalsPerMonth: number | null; longCount: number; shortCount: number; symbolDistribution: Readonly<Record<string, number>>; meanRealizedNetForwardAtr: number | null; medianRealizedNetForwardAtr: number | null; profitFactor: number | null; cumulativeNetAtr: number; maximumDrawdownAtr: number; positiveFolds: number; negativeFolds: number; catastrophicFolds: number; foldMeans: Readonly<Record<ResearchFoldId, number | null>>; feesBps: number; slippageBps: number; fundingBps: number; costStressMean: number | null; costStressProfitFactor: number | null; latencyStressMean: number | null; maximumPositiveSymbolContributionShare: number | null; maximumSinglePositiveObservationContribution: number | null; calibrationErrorByPredictionDecile: readonly R15MetricDecile[]; selectedByFold: Readonly<Record<ResearchFoldId, number>>; }>;
  gates: Readonly<{ eligibility: "ELIGIBLE" | "INELIGIBLE"; gateResults: readonly R15GateResult[]; failedGateIds: readonly string[] }>;
  selection: Readonly<{ finalDecision: typeof M3_R15_CANDIDATE_OUTCOME | typeof M3_R15_NO_CANDIDATE_OUTCOME; candidateStatus: "SHADOW_REQUIRED" | null; forwardShadowEligible: boolean; selectedCandidateId: "R15-BETA-ALPHA-H4" | null; selectionAlgorithmApplied: true }>;
  governance: Readonly<{ baseline002Status: "NOT_FROZEN"; m3JStatus: "BLOCKED"; m4Status: "NOT_STARTED"; privateBinanceApi: false; automaticTrading: false; productionUnchanged: true; baseline001Unchanged: true; postLockNetworkFetch: false }>;
  artifactHashMethod: typeof R15_ARTIFACT_HASH_METHOD;
}>;

export type R15ExecutionArtifacts = Readonly<{ report: R15PerformanceReport; summaryJson: string; auditJson: string; resultsMarkdown: string; selectionJson: string; selectionMarkdown: string; publicationHashesJson: string }>;

type R15FoldCheckpointPayload = Readonly<{ foldId: ResearchFoldId; betaModel: R15RidgeModel; alphaModel: R15RidgeModel; provenance: R15ModelProvenance; performance: R15FoldPerformance }>;
type R15FinalCheckpointPayload = Readonly<{ report: R15PerformanceReport }>;
export type R15SelectionPrediction = Readonly<{ observationId: string; symbol: (typeof R15_SYMBOLS)[number]; direction: R15Direction; predictedNetAtr: number }>;
type R15Prediction = Readonly<R15SelectionPrediction & { observation: R15FrozenObservation; predictedMarketBeta: number; predictedRelativeAlpha: number }>;

function hash(value: unknown): string { return createHash("sha256").update(stableStringify(value), "utf8").digest("hex"); }
function mean(values: readonly number[]): number | null { return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length; }
function median(values: readonly number[]): number | null { if (values.length === 0) return null; const ordered = [...values].sort((left, right) => left - right); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!; }
function pearson(left: readonly number[], right: readonly number[]): number | null { if (left.length < 2 || left.length !== right.length) return null; const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length; const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length; const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index]! - rightMean), 0); const leftDenom = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0)); const rightDenom = Math.sqrt(right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0)); return leftDenom === 0 || rightDenom === 0 ? null : numerator / (leftDenom * rightDenom); }
export const selectR15TopOne = r15SelectTopOne;
export const r15RanksForTest = r15Ranks;
export const r15SpearmanForTest = r15Spearman;
export const r15DecilesForTest = r15Deciles;
export const r15TopBottomRealizedSpreadForTest = r15TopBottomRealizedSpread;
function symbolOrder(symbol: string): number { return R15_SYMBOLS.indexOf(symbol as (typeof R15_SYMBOLS)[number]); }
function foldRole(decisionTime: number, foldId: ResearchFoldId, role: "RESEARCH" | "VALIDATION"): boolean { const range = getResearchFoldRoleRange(foldId, role); return decisionTime >= range.startTime && decisionTime <= range.endTime; }

async function collectTrainingExamples(filePath: string, foldId: ResearchFoldId): Promise<Readonly<{ beta: readonly { features: Readonly<Record<string, number>>; target: number }[]; alpha: readonly { features: Readonly<Record<string, number>>; target: number }[] }>> {
  const beta = [] as Array<{ features: Readonly<Record<string, number>>; target: number }>;
  const alpha = [] as Array<{ features: Readonly<Record<string, number>>; target: number }>;
  const seenBeta = new Set<string>();
  for await (const observation of streamR15Observations(filePath)) {
    if (!foldRole(observation.decisionTime, foldId, "RESEARCH") || !isR13TrainingObservationPurgeSafe({ decisionTime: observation.decisionTime, validationStartTime: getResearchFoldRoleRange(foldId, "VALIDATION").startTime, maximumLabelHorizonHours: R15_PURGE_EMBARGO_HOURS })) continue;
    const betaKey = `${observation.decisionTime}|${observation.direction}`;
    if (!seenBeta.has(betaKey)) {
      seenBeta.add(betaKey);
      beta.push({ features: observation.betaFeatures, target: observation.marketBetaTarget });
    }
    alpha.push({ features: observation.alphaFeatures, target: observation.relativeAlphaTarget });
  }
  return Object.freeze({ beta: Object.freeze(beta), alpha: Object.freeze(alpha) });
}

async function collectValidationPredictions(filePath: string, foldId: ResearchFoldId, betaModel: R15RidgeModel, alphaModel: R15RidgeModel): Promise<readonly R15Prediction[]> {
  const values: R15Prediction[] = [];
  for await (const observation of streamR15Observations(filePath)) {
    if (!foldRole(observation.decisionTime, foldId, "VALIDATION")) continue;
    const predictedMarketBeta = predictR15RidgeModel(betaModel, observation.betaFeatures);
    const predictedRelativeAlpha = predictR15RidgeModel(alphaModel, observation.alphaFeatures);
    values.push(Object.freeze({ observation, observationId: observation.observationId, symbol: observation.symbol, direction: observation.direction, predictedMarketBeta, predictedRelativeAlpha, predictedNetAtr: predictedMarketBeta + predictedRelativeAlpha }));
  }
  return Object.freeze(values);
}

function processValidation(foldId: ResearchFoldId, predictions: readonly R15Prediction[]): R15FoldPerformance {
  const byTime = new Map<number, R15Prediction[]>();
  for (const value of predictions) (byTime.get(value.observation.decisionTime) ?? (byTime.set(value.observation.decisionTime, []), byTime.get(value.observation.decisionTime)!)).push(value);
  const selected: R15ScoredSelection[] = [];
  const betaPairs: R15BetaPair[] = [];
  const alphaPairs: R15AlphaPair[] = [];
  const alphaTimestampStatistics: R15AlphaTimestampStatistic[] = [];
  let noTradeDecisionTimestamps = 0;
  for (const [decisionTime, timestampRows] of [...byTime.entries()].sort(([left], [right]) => left - right)) {
    for (const direction of ["LONG", "SHORT"] as const) {
      const directionRows = timestampRows.filter((row) => row.observation.direction === direction).sort((left, right) => symbolOrder(left.observation.symbol) - symbolOrder(right.observation.symbol));
      if (directionRows.length !== R15_SYMBOLS.length) throw new Error(`R15 validation cross-section is incomplete at ${decisionTime}/${direction}.`);
      const beta = directionRows[0]!;
      betaPairs.push(Object.freeze({ foldId, decisionTime, direction, predicted: beta.predictedMarketBeta, realized: beta.observation.marketBetaTarget }));
      const alphaOrdered = directionRows.map((row) => Object.freeze({ symbol: row.observation.symbol, predicted: row.predictedRelativeAlpha, realized: row.observation.relativeAlphaTarget }));
      alphaPairs.push(...alphaOrdered.map((row) => Object.freeze({ foldId, decisionTime, direction, symbol: row.symbol, predicted: row.predicted, realized: row.realized })));
      alphaTimestampStatistics.push(Object.freeze({ foldId, decisionTime, direction, spearman: r15Spearman(alphaOrdered.map((row) => row.predicted), alphaOrdered.map((row) => row.realized)), topBottomSpread: r15TopBottomRealizedSpread(alphaOrdered) }));
    }
    const top = selectR15TopOne(timestampRows);
    if (!top) {
      noTradeDecisionTimestamps += 1;
      continue;
    }
    selected.push(Object.freeze({ observationId: top.observation.observationId, foldId, decisionTime, symbol: top.observation.symbol, direction: top.observation.direction, predictedMarketBeta: top.predictedMarketBeta, predictedRelativeAlpha: top.predictedRelativeAlpha, predictedNetAtr: top.predictedNetAtr, realizedNetForwardAtr: top.observation.label.netForwardAtr, realizedCostStressNetAtr: top.observation.label.netForwardAtrCostStress, realizedLatencyStressNetAtr: top.observation.label.latencyStressNetForwardAtr, feesBps: top.observation.label.feesBps, fundingBps: top.observation.label.fundingBps, slippageBps: top.observation.label.slippageBps }));
  }
  return Object.freeze({ foldId, validationDecisionTimestamps: byTime.size, noTradeDecisionTimestamps, selected: Object.freeze(selected), betaPairs: Object.freeze(betaPairs), alphaPairs: Object.freeze(alphaPairs), alphaTimestampStatistics: Object.freeze(alphaTimestampStatistics) });
}

async function executeFold(input: Readonly<{ observationFile: string; executionDirectory: string; executionSourceSha: string; observationDatasetSha256: string; foldId: ResearchFoldId }>): Promise<Readonly<{ betaModel: R15RidgeModel; alphaModel: R15RidgeModel; provenance: R15ModelProvenance; performance: R15FoldPerformance; reused: boolean }>> {
  const inputHashes = Object.freeze({ executionSourceSha: input.executionSourceSha, observationDatasetSha256: input.observationDatasetSha256, foldId: input.foldId, planSha256: R15_PLAN_SHA256, horizonHours: "4" });
  const checkpointPath = foldCheckpointPath(input.executionDirectory, input.foldId);
  if (checkpointExists(checkpointPath)) {
    const checkpoint = readR15Checkpoint<R15FoldCheckpointPayload>(checkpointPath, inputHashes);
    return Object.freeze({ ...checkpoint.payload, reused: true });
  }
  const examples = await collectTrainingExamples(input.observationFile, input.foldId);
  const betaModel = fitR15RidgeModel("R15-BETA-H4", R15_BETA_FEATURE_NAMES, examples.beta);
  const alphaModel = fitR15RidgeModel("R15-ALPHA-H4", R15_ALPHA_FEATURE_NAMES, examples.alpha);
  const provenance: R15ModelProvenance = Object.freeze({ foldId: input.foldId, status: "FIT", betaModelId: "R15-BETA-H4", alphaModelId: "R15-ALPHA-H4", betaTrainingExamples: examples.beta.length, alphaTrainingExamples: examples.alpha.length, betaModelIdentitySha256: betaModel.modelIdentitySha256, alphaModelIdentitySha256: alphaModel.modelIdentitySha256, lambda: R15_RIDGE_LAMBDA, standardizationScope: "RESEARCH_ONLY" });
  const predictions = await collectValidationPredictions(input.observationFile, input.foldId, betaModel, alphaModel);
  const performance = processValidation(input.foldId, predictions);
  writeR15CheckpointAtomic<R15FoldCheckpointPayload>({ filePath: checkpointPath, kind: "FOLD", key: input.foldId, inputHashes, payload: Object.freeze({ foldId: input.foldId, betaModel, alphaModel, provenance, performance }) });
  return Object.freeze({ betaModel, alphaModel, provenance, performance, reused: false });
}

function foldMean(selected: readonly R15ScoredSelection[], foldId: ResearchFoldId): number | null { return mean(selected.filter((value) => value.foldId === foldId).map((value) => value.realizedNetForwardAtr)); }
function positiveContributionShare(selected: readonly R15ScoredSelection[]): Readonly<{ symbol: number | null; single: number | null }> {
  const positive = selected.map((value) => value.realizedNetForwardAtr).filter((value) => value > 0);
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return Object.freeze({ symbol: null, single: null });
  const bySymbol = Object.fromEntries(R15_SYMBOLS.map((symbol) => [symbol, selected.filter((value) => value.symbol === symbol && value.realizedNetForwardAtr > 0).reduce((sum, value) => sum + value.realizedNetForwardAtr, 0)]));
  return Object.freeze({ symbol: Math.max(...Object.values(bySymbol)) / total, single: Math.max(...positive) / total });
}

function buildBetaDiagnostics(folds: readonly R15FoldPerformance[]): R15PerformanceReport["beta"] {
  const perFold = folds.map((fold) => {
    const predicted = fold.betaPairs.map((pair) => pair.predicted);
    const realized = fold.betaPairs.map((pair) => pair.realized);
    const signs = predicted.length === 0 ? null : predicted.filter((value, index) => Math.sign(value) === Math.sign(realized[index]!)).length / predicted.length;
    return Object.freeze({ foldId: fold.foldId, pearson: pearson(predicted, realized), spearman: r15Spearman(predicted, realized), signAccuracy: signs, realizedMean: mean(realized), predictionDeciles: r15Deciles(realized, predicted) });
  });
  const pairs = folds.flatMap((fold) => fold.betaPairs);
  const predicted = pairs.map((pair) => pair.predicted);
  const realized = pairs.map((pair) => pair.realized);
  return Object.freeze({ modelId: "R15-BETA-H4", pooledPearson: pearson(predicted, realized), pooledSpearman: r15Spearman(predicted, realized), signAccuracy: predicted.length === 0 ? null : predicted.filter((value, index) => Math.sign(value) === Math.sign(realized[index]!)).length / predicted.length, positiveCorrelationFolds: perFold.filter((fold) => fold.pearson !== null && fold.pearson > 0).length, perFold: Object.freeze(perFold), realizedByPredictionDecile: r15Deciles(realized, predicted) });
}

function buildAlphaDiagnostics(folds: readonly R15FoldPerformance[]): R15PerformanceReport["alpha"] {
  const statistics = folds.flatMap((fold) => fold.alphaTimestampStatistics);
  const perFold = folds.map((fold) => {
    const own = fold.alphaTimestampStatistics;
    const correlations = own.map((value) => value.spearman).filter((value): value is number => value !== null);
    const spreads = own.map((value) => value.topBottomSpread).filter((value): value is number => value !== null);
    return Object.freeze({ foldId: fold.foldId, spearman: mean(correlations), positiveTimestamps: correlations.filter((value) => value > 0).length, timestampCount: correlations.length, topBottomSpread: mean(spreads), positiveSpread: (mean(spreads) ?? Number.NEGATIVE_INFINITY) > 0 });
  });
  const pairs = folds.flatMap((fold) => fold.alphaPairs);
  return Object.freeze({ modelId: "R15-ALPHA-H4", pooledSpearman: r15Spearman(pairs.map((pair) => pair.predicted), pairs.map((pair) => pair.realized)), meanTimestampSpearman: mean(statistics.map((value) => value.spearman).filter((value): value is number => value !== null)), positiveCorrelationFolds: perFold.filter((fold) => fold.spearman !== null && fold.spearman > 0).length, foldMeans: Object.freeze(perFold), topBottomSpread: mean(statistics.map((value) => value.topBottomSpread).filter((value): value is number => value !== null)), positiveSpreadFolds: perFold.filter((fold) => fold.positiveSpread).length });
}

function buildCombinedMetrics(folds: readonly R15FoldPerformance[]): R15PerformanceReport["combined"] {
  const selected = folds.flatMap((fold) => fold.selected);
  const totalTimestamps = folds.reduce((sum, fold) => sum + fold.validationDecisionTimestamps, 0);
  const noTrade = folds.reduce((sum, fold) => sum + fold.noTradeDecisionTimestamps, 0);
  const values = selected.map((value) => value.realizedNetForwardAtr);
  const positive = values.filter((value) => value > 0);
  const negative = values.filter((value) => value < 0);
  const monthCounts = new Map<string, number>();
  for (const value of selected) { const date = new Date(value.decisionTime); const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1); }
  const contributions = positiveContributionShare(selected);
  const costValues = selected.map((value) => value.realizedCostStressNetAtr);
  const costPositive = costValues.filter((value) => value > 0);
  const costNegative = costValues.filter((value) => value < 0);
  const selectedByFold = Object.fromEntries(R15_FOLD_IDS.map((foldId) => [foldId, selected.filter((value) => value.foldId === foldId).length])) as Record<ResearchFoldId, number>;
  const foldMeans = Object.fromEntries(R15_FOLD_IDS.map((foldId) => [foldId, foldMean(selected, foldId)])) as Record<ResearchFoldId, number | null>;
  const drawdown = calculateR13Drawdown(selected.map((value) => ({ decisionTime: value.decisionTime, symbol: value.symbol, direction: value.direction, netForwardAtr: value.realizedNetForwardAtr })));
  const calibration = selected.map((value) => value.predictedNetAtr - value.realizedNetForwardAtr);
  const predictionValues = selected.map((value) => value.predictedNetAtr);
  return Object.freeze({ selectedCount: selected.length, validationDecisionTimestamps: totalTimestamps, noTradeDecisionTimestamps: noTrade, noTradeRate: totalTimestamps === 0 ? 0 : noTrade / totalTimestamps, meanSignalsPerMonth: mean([...monthCounts.values()]), medianSignalsPerMonth: median([...monthCounts.values()]), longCount: selected.filter((value) => value.direction === "LONG").length, shortCount: selected.filter((value) => value.direction === "SHORT").length, symbolDistribution: Object.freeze(Object.fromEntries(R15_SYMBOLS.map((symbol) => [symbol, selected.filter((value) => value.symbol === symbol).length]))), meanRealizedNetForwardAtr: mean(values), medianRealizedNetForwardAtr: median(values), profitFactor: negative.length === 0 ? null : positive.reduce((sum, value) => sum + value, 0) / Math.abs(negative.reduce((sum, value) => sum + value, 0)), cumulativeNetAtr: drawdown.cumulativeNetForwardAtr, maximumDrawdownAtr: drawdown.maximumDrawdownAtr, positiveFolds: Object.values(foldMeans).filter((value): value is number => value !== null && value > 0).length, negativeFolds: Object.values(foldMeans).filter((value): value is number => value !== null && value < 0).length, catastrophicFolds: Object.values(foldMeans).filter((value): value is number => value !== null && value <= -0.10).length, foldMeans: Object.freeze(foldMeans), feesBps: selected.reduce((sum, value) => sum + value.feesBps, 0), slippageBps: selected.reduce((sum, value) => sum + value.slippageBps, 0), fundingBps: selected.reduce((sum, value) => sum + value.fundingBps, 0), costStressMean: mean(costValues), costStressProfitFactor: costNegative.length === 0 ? null : costPositive.reduce((sum, value) => sum + value, 0) / Math.abs(costNegative.reduce((sum, value) => sum + value, 0)), latencyStressMean: mean(selected.map((value) => value.realizedLatencyStressNetAtr)), maximumPositiveSymbolContributionShare: contributions.symbol, maximumSinglePositiveObservationContribution: contributions.single, calibrationErrorByPredictionDecile: r15Deciles(calibration, predictionValues), selectedByFold: Object.freeze(selectedByFold) });
}

function buildReport(input: Readonly<{ executionId: string; executionSourceSha: string; freeze: R15ObservationFreezeManifest; folds: readonly R15FoldPerformance[]; provenance: readonly R15ModelProvenance[] }>): R15PerformanceReport {
  const beta = buildBetaDiagnostics(input.folds);
  const alpha = buildAlphaDiagnostics(input.folds);
  const combined = buildCombinedMetrics(input.folds);
  const gates = evaluateR15Gates({ selectedCount: combined.selectedCount, selectedByFold: combined.selectedByFold, meanNetForwardAtr: combined.meanRealizedNetForwardAtr, profitFactor: combined.profitFactor, positiveFolds: combined.positiveFolds, catastrophicFolds: combined.catastrophicFolds, betaPooledPearson: beta.pooledPearson, betaPositiveCorrelationFolds: beta.positiveCorrelationFolds, alphaPositiveCorrelationFolds: alpha.positiveCorrelationFolds, alphaPooledSpearman: alpha.pooledSpearman, alphaTopBottomSpread: alpha.topBottomSpread, alphaPositiveSpreadFolds: alpha.positiveSpreadFolds, costStressMean: combined.costStressMean, costStressProfitFactor: combined.costStressProfitFactor, latencyStressMean: combined.latencyStressMean, maximumPositiveSymbolContributionShare: combined.maximumPositiveSymbolContributionShare, maximumSinglePositiveObservationContribution: combined.maximumSinglePositiveObservationContribution, evidenceIntegrity: input.freeze.integrity === "COMPLETE" && input.freeze.integrityErrors.length === 0, modelProvenanceComplete: input.provenance.length === R15_FOLD_IDS.length && input.provenance.every((value) => value.status === "FIT") });
  const eligible = gates.eligibility === "ELIGIBLE";
  return Object.freeze({ schemaVersion: M3_R15_REPORT_SCHEMA_VERSION, researchRoundId: M3_R15_RESEARCH_ROUND_ID, classification: "HISTORICAL_DEVELOPMENT_STUDY", h4SelectionBasis: "SEEN_HYPOTHESIS_FROM_R14", executionId: input.executionId, performanceExecutionSourceSha: input.executionSourceSha, acceptedR14SourceSha: M3_R15_ACCEPTED_R14_SOURCE_SHA, sourceDatasetSha256: R15_SOURCE_DATASET_SHA256, sourceManifestSha256: R15_SOURCE_MANIFEST_SHA256, sourceObservationSha256: R15_SOURCE_OBSERVATION_SHA256, sourceObservationDataSha256: input.freeze.observationDataSha256, specSha256: R15_SPEC_SHA256, planSha256: R15_PLAN_SHA256, gateSha256: R15_GATE_SHA256, conformanceSha256: R15_CONFORMANCE_SHA256, researchBoundary: M3_R15_RESEARCH_END_ISO, strategyVersion: "baseline-001", backtestPolicyVersion: "bt-policy-003", horizonHours: 4, purgeEmbargoHours: 24, performanceLock: M3_R15_PERFORMANCE_LOCK, performanceLockTriggered: true, performanceExecutionCount: 1, performanceLifecycle: "PERFORMANCE_LOCKED_CRASH_SAFE", observationFreeze: Object.freeze({ path: R15_OBSERVATION_FREEZE_PATH, manifestSha256: hash(input.freeze), observationCount: input.freeze.observationCount, observationDataBytes: input.freeze.observationDataBytes, observationDataSha256: input.freeze.observationDataSha256, completeDecisionTimeCount: input.freeze.completeDecisionTimeCount, excludedIncompleteDecisionTimeCount: input.freeze.excludedIncompleteDecisionTimeCount, integrity: input.freeze.integrity }), beta, alpha, combined, gates, selection: Object.freeze({ finalDecision: eligible ? M3_R15_CANDIDATE_OUTCOME : M3_R15_NO_CANDIDATE_OUTCOME, candidateStatus: eligible ? "SHADOW_REQUIRED" : null, forwardShadowEligible: eligible, selectedCandidateId: eligible ? "R15-BETA-ALPHA-H4" : null, selectionAlgorithmApplied: true }), governance: Object.freeze({ baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED", privateBinanceApi: false, automaticTrading: false, productionUnchanged: true, baseline001Unchanged: true, postLockNetworkFetch: false }), artifactHashMethod: R15_ARTIFACT_HASH_METHOD });
}

function renderResults(report: R15PerformanceReport): string {
  const lines = ["# M3-R15 Round-015 Beta × Alpha Decomposition", "", `- researchRoundId: ${report.researchRoundId}`, `- classification: ${report.classification}`, `- h4SelectionBasis: ${report.h4SelectionBasis}`, `- executionId: ${report.executionId}`, `- performanceExecutionSourceSha: ${report.performanceExecutionSourceSha}`, `- performanceLock: ${report.performanceLock}`, `- performanceExecutionCount: ${report.performanceExecutionCount}`, `- artifactHashMethod: ${report.artifactHashMethod}`, "", "## Beta", "", `- pooledPearson: ${report.beta.pooledPearson}`, `- pooledSpearman: ${report.beta.pooledSpearman}`, `- signAccuracy: ${report.beta.signAccuracy}`, `- positiveCorrelationFolds: ${report.beta.positiveCorrelationFolds}/6`, "", "## Alpha", "", `- pooledSpearman: ${report.alpha.pooledSpearman}`, `- meanTimestampSpearman: ${report.alpha.meanTimestampSpearman}`, `- positiveCorrelationFolds: ${report.alpha.positiveCorrelationFolds}/6`, `- topBottomSpread: ${report.alpha.topBottomSpread}`, `- positiveSpreadFolds: ${report.alpha.positiveSpreadFolds}/6`, "", "## Combined", "", "| metric | value |", "| --- | ---: |", `| selected | ${report.combined.selectedCount} |`, `| validation timestamps | ${report.combined.validationDecisionTimestamps} |`, `| NO_TRADE rate | ${report.combined.noTradeRate} |`, `| mean signals/month | ${report.combined.meanSignalsPerMonth} |`, `| median signals/month | ${report.combined.medianSignalsPerMonth} |`, `| LONG / SHORT | ${report.combined.longCount} / ${report.combined.shortCount} |`, `| mean net ATR | ${report.combined.meanRealizedNetForwardAtr} |`, `| median net ATR | ${report.combined.medianRealizedNetForwardAtr} |`, `| PF | ${report.combined.profitFactor} |`, `| cumulative net ATR | ${report.combined.cumulativeNetAtr} |`, `| max DD ATR | ${report.combined.maximumDrawdownAtr} |`, `| cost stress mean / PF | ${report.combined.costStressMean} / ${report.combined.costStressProfitFactor} |`, `| latency stress mean | ${report.combined.latencyStressMean} |`, "", "## Gates", "", ...report.gates.gateResults.map((gate) => `- ${gate.gateId}: ${gate.passed ? "PASS" : "FAIL"} (observed ${JSON.stringify(gate.observed)}; requirement ${gate.requirement})`), "", `- finalDecision: ${report.selection.finalDecision}`, `- candidateStatus: ${report.selection.candidateStatus ?? "null"}`, `- forwardShadowEligible: ${report.selection.forwardShadowEligible}`, `- baseline002Status: ${report.governance.baseline002Status}`, `- m3JStatus: ${report.governance.m3JStatus}`, `- m4Status: ${report.governance.m4Status}`, `- privateBinanceApi: ${report.governance.privateBinanceApi}`, `- automaticTrading: ${report.governance.automaticTrading}`];
  return lines.join("\n");
}

function selectionMarkdown(report: R15PerformanceReport): string {
  return ["# M3-R15 Round-015 Selection", "", `- finalDecision: ${report.selection.finalDecision}`, `- selectedCandidateId: ${report.selection.selectedCandidateId ?? "null"}`, `- candidateStatus: ${report.selection.candidateStatus ?? "null"}`, `- forwardShadowEligible: ${report.selection.forwardShadowEligible}`, `- selectionAlgorithmApplied: ${report.selection.selectionAlgorithmApplied}`, `- evidenceStatus: COMPLETE`, `- artifactHashMethod: ${report.artifactHashMethod}`].join("\n");
}

export function buildR15ExecutionArtifacts(report: R15PerformanceReport): R15ExecutionArtifacts {
  const selectionJson = stableStringify({ schemaVersion: "m3-r15-round-015-selection-001", researchRoundId: report.researchRoundId, classification: report.classification, h4SelectionBasis: report.h4SelectionBasis, executionId: report.executionId, performanceExecutionSourceSha: report.performanceExecutionSourceSha, gateSha256: report.gateSha256, planSha256: report.planSha256, performanceLock: report.performanceLock, evidenceStatus: "COMPLETE", gateEligibility: report.gates.eligibility, failedGateIds: report.gates.failedGateIds, selectedCandidateId: report.selection.selectedCandidateId, finalDecision: report.selection.finalDecision, candidateStatus: report.selection.candidateStatus, forwardShadowEligible: report.selection.forwardShadowEligible, baseline002Status: report.governance.baseline002Status, m3JStatus: report.governance.m3JStatus, m4Status: report.governance.m4Status, artifactHashMethod: report.artifactHashMethod });
  const resultsMarkdown = renderResults(report);
  const selectionMarkdownText = selectionMarkdown(report);
  const summaryJson = stableStringify({ ...report, evidenceStatus: "COMPLETE" });
  const auditJson = stableStringify({ schemaVersion: M3_R15_AUDIT_SCHEMA_VERSION, researchRoundId: report.researchRoundId, classification: report.classification, execution: { executionId: report.executionId, performanceExecutionSourceSha: report.performanceExecutionSourceSha, performanceLock: report.performanceLock, performanceExecutionCount: report.performanceExecutionCount, checkpointLifecycle: report.performanceLifecycle, control: "R15_BETA_ALPHA_DECOMPOSITION_ONLY", postLockNetworkFetch: report.governance.postLockNetworkFetch }, data: { sourceDatasetSha256: report.sourceDatasetSha256, sourceManifestSha256: report.sourceManifestSha256, sourceObservationSha256: report.sourceObservationSha256, derivedObservationSha256: report.sourceObservationDataSha256, observationFreezePath: report.observationFreeze.path, observationFreezeManifestSha256: report.observationFreeze.manifestSha256, integrity: report.observationFreeze.integrity }, models: { beta: report.beta.modelId, alpha: report.alpha.modelId, provenance: "COMPLETE_RESEARCH_ONLY_STANDARDIZATION" }, gates: report.gates, selection: report.selection, exactUtf8ByteArtifactHashes: { summary: r15HashUtf8Bytes(summaryJson), results: r15HashUtf8Bytes(resultsMarkdown), selectionJson: r15HashUtf8Bytes(selectionJson), selectionMarkdown: r15HashUtf8Bytes(selectionMarkdownText) }, hashMethod: R15_ARTIFACT_HASH_METHOD, governance: report.governance });
  const finalPublicationHashes = stableStringify({ hashMethod: R15_ARTIFACT_HASH_METHOD, artifacts: { summary: { path: R15_REQUIRED_OUTPUT_PATHS[0], exactUtf8ByteSha256: r15HashUtf8Bytes(summaryJson) }, audit: { path: R15_REQUIRED_OUTPUT_PATHS[1], exactUtf8ByteSha256: r15HashUtf8Bytes(auditJson) }, results: { path: R15_REQUIRED_OUTPUT_PATHS[2], exactUtf8ByteSha256: r15HashUtf8Bytes(resultsMarkdown) }, selectionJson: { path: R15_REQUIRED_OUTPUT_PATHS[3], exactUtf8ByteSha256: r15HashUtf8Bytes(selectionJson) }, selectionMarkdown: { path: R15_REQUIRED_OUTPUT_PATHS[4], exactUtf8ByteSha256: r15HashUtf8Bytes(selectionMarkdownText) } } });
  return Object.freeze({ report, summaryJson, auditJson, resultsMarkdown, selectionJson, selectionMarkdown: selectionMarkdownText, publicationHashesJson: finalPublicationHashes });
}

export function r15OutputPaths(root = process.cwd()): readonly string[] { return Object.freeze([...R15_REQUIRED_OUTPUT_PATHS.map((relative) => path.join(root, relative)), path.join(root, "docs/research/round-015-publication-hashes.json")]); }
export function existingR15OutputArtifacts(root = process.cwd()): readonly string[] { return Object.freeze(r15OutputPaths(root).filter((filePath) => existsSync(filePath))); }

export function publishR15ArtifactsAtomically(input: Readonly<{ artifacts: R15ExecutionArtifacts; root?: string; beforePublish?: (target: string, index: number) => void }>): void {
  const root = path.resolve(input.root ?? process.cwd());
  const targets = new Map<string, string>([
    [path.join(root, R15_REQUIRED_OUTPUT_PATHS[0]), input.artifacts.summaryJson],
    [path.join(root, R15_REQUIRED_OUTPUT_PATHS[1]), input.artifacts.auditJson],
    [path.join(root, R15_REQUIRED_OUTPUT_PATHS[2]), input.artifacts.resultsMarkdown],
    [path.join(root, R15_REQUIRED_OUTPUT_PATHS[3]), input.artifacts.selectionJson],
    [path.join(root, R15_REQUIRED_OUTPUT_PATHS[4]), input.artifacts.selectionMarkdown],
    [path.join(root, "docs/research/round-015-publication-hashes.json"), input.artifacts.publicationHashesJson],
  ]);
  if ([...targets.keys()].some((target) => existsSync(target))) throw new Error("R15 output already exists; refusing overwrite.");
  mkdirSync(path.join(root, "docs"), { recursive: true });
  const publication = [
    path.join(root, R15_REQUIRED_OUTPUT_PATHS[1]),
    path.join(root, R15_REQUIRED_OUTPUT_PATHS[2]),
    path.join(root, R15_REQUIRED_OUTPUT_PATHS[3]),
    path.join(root, R15_REQUIRED_OUTPUT_PATHS[4]),
    path.join(root, "docs/research/round-015-publication-hashes.json"),
    path.join(root, R15_REQUIRED_OUTPUT_PATHS[0]),
  ];
  const staging = mkdtempSync(path.join(root, "docs", ".m3-r15-round-015-staging-"));
  const published: string[] = [];
  try {
    for (const target of publication) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(path.join(staging, path.basename(target)), targets.get(target)!, "utf8");
    }
    for (const [index, target] of publication.entries()) {
      input.beforePublish?.(target, index);
      if (existsSync(target)) throw new Error(`R15 output appeared during publication: ${target}`);
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

export async function executeR15Performance(input: Readonly<{ root?: string; executionDirectory: string; executionLock: R15ExecutionLock; observationFreeze: R15ObservationFreezeManifest; onFoldComplete?: (foldId: ResearchFoldId) => void }>): Promise<Readonly<{ report: R15PerformanceReport; reusedFoldCount: number }>> {
  const root = path.resolve(input.root ?? process.cwd());
  validateR15Plan();
  validateR15Conformance();
  const observationFile = path.resolve(root, input.observationFreeze.observationDataPath);
  const finalPath = finalPerformanceCheckpointPath(input.executionDirectory);
  const finalHashes = Object.freeze({ executionSourceSha: input.executionLock.executionSourceSha, observationDatasetSha256: input.observationFreeze.observationDataSha256, planSha256: R15_PLAN_SHA256, gateSha256: R15_GATE_SHA256, conformanceSha256: R15_CONFORMANCE_SHA256, horizonHours: "4" });
  if (checkpointExists(finalPath)) return Object.freeze({ report: readR15Checkpoint<R15FinalCheckpointPayload>(finalPath, finalHashes).payload.report, reusedFoldCount: R15_FOLD_IDS.length });
  const folds: R15FoldPerformance[] = [];
  const provenance: R15ModelProvenance[] = [];
  let reusedFoldCount = 0;
  for (const foldId of R15_FOLD_IDS) {
    const result = await executeFold({ observationFile, executionDirectory: input.executionDirectory, executionSourceSha: input.executionLock.executionSourceSha, observationDatasetSha256: input.observationFreeze.observationDataSha256, foldId });
    if (result.reused) reusedFoldCount += 1;
    folds.push(result.performance);
    provenance.push(result.provenance);
    input.onFoldComplete?.(foldId);
  }
  const report = buildReport({ executionId: input.executionLock.executionId, executionSourceSha: input.executionLock.executionSourceSha, freeze: input.observationFreeze, folds, provenance });
  writeR15CheckpointAtomic<R15FinalCheckpointPayload>({ filePath: finalPath, kind: "FINAL_PERFORMANCE", key: input.executionLock.executionId, inputHashes: finalHashes, payload: Object.freeze({ report }) });
  return Object.freeze({ report, reusedFoldCount });
}

export function r15ConformanceSummary(): Readonly<Record<string, unknown>> {
  return Object.freeze({ schemaVersion: R15_CONFORMANCE_SCHEMA_VERSION, gateSha256: R15_GATE_SHA256, planSha256: R15_PLAN_SHA256, specSha256: R15_SPEC_SHA256, observationDataPath: R15_OBSERVATION_DATA_PATH, sourceObservationSha256: R15_SOURCE_OBSERVATION_SHA256, checks: R15_CONFORMANCE_DOCUMENT.checks, resultAffectingDeviationCount: 0, network: false, privateBinanceApi: false, automaticTrading: false });
}
