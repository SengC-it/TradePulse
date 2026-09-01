import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getResearchFoldRoleRange } from "./folds.ts";
import { r15Deciles, r15Spearman, r15TopBottomRealizedSpread } from "./m3-r15-round-015-behavior.ts";
import { fitR15RidgeModel, predictR15RidgeModel, type R15RidgeModel } from "./m3-r15-round-015-model.ts";
import type { R16ConformanceDocument } from "./m3-r16-round-016-conformance.ts";
import { R16_PLAN_SHA256, validateR16Plan } from "./m3-r16-round-016-plan.ts";
import { evaluateR16Gates, R16_GATE_SHA256, type R16GateResult } from "./selection-gates-round-016.ts";
import { checkpointExists, finalPerformanceCheckpointPath, foldCheckpointPath, readR16Checkpoint, validateR16ExecutionLedgerForLock, writeR16CheckpointAtomic, type R16ExecutionLock, type R16PerformanceExecutionLedger } from "./m3-r16-round-016-checkpoints.ts";
import { streamR16Observations, type R16Observation, type R16ObservationFreezeManifest } from "./m3-r16-round-016-data.ts";
import {
  M3_R16_GAIN_OUTCOME,
  M3_R16_NO_GAIN_OUTCOME,
  M3_R16_ACCEPTED_R15_SOURCE_SHA,
  M3_R16_SOURCE_DATASET_SHA256,
  M3_R16_PERFORMANCE_LOCK,
  M3_R16_RESEARCH_END_ISO,
  M3_R16_RESEARCH_ROUND_ID,
  R16_ALPHA_CONTROL_FEATURE_NAMES,
  R16_ALPHA_MICRO_FEATURE_NAMES,
  R16_ARTIFACT_HASH_METHOD,
  R16_BETA_CONTROL_FEATURE_NAMES,
  R16_BETA_MICRO_FEATURE_NAMES,
  R16_OBSERVATION_FREEZE_PATH,
  R16_PUBLICATION_HASHES_PATH,
  R16_REQUIRED_OUTPUT_PATHS,
  R16_RIDGE_LAMBDA,
  M3_R16_SOURCE_MANIFEST_SHA256,
  M3_R16_SOURCE_R14_OBSERVATION_SHA256,
  M3_R16_SOURCE_R15_OBSERVATION_SHA256,
  R16_SPEC_SHA256,
  R16_SYMBOLS,
  R16_FOLD_IDS,
  R16_PURGE_EMBARGO_HOURS,
  r16HashUtf8Bytes,
  type R16Direction,
} from "./m3-r16-round-016-protocol.ts";
import { stableStringify } from "./utils.ts";
import type { ResearchFoldId } from "./constants.ts";

export const M3_R16_REPORT_SCHEMA_VERSION = "m3-r16-round-016-report-001" as const;
export const M3_R16_AUDIT_SCHEMA_VERSION = "m3-r16-round-016-audit-001" as const;

type Pair = Readonly<{ foldId: ResearchFoldId; decisionTime: number; direction: R16Direction; predicted: number; realized: number }>;
type AlphaPair = Pair & Readonly<{ symbol: (typeof R16_SYMBOLS)[number] }>;
type TimestampStat = Readonly<{ foldId: ResearchFoldId; decisionTime: number; direction: R16Direction; controlSpearman: number | null; microSpearman: number | null; controlSpread: number | null; microSpread: number | null }>;
type FoldPerformance = Readonly<{ foldId: ResearchFoldId; validationDecisionTimestamps: number; controlBetaPairs: readonly Pair[]; microBetaPairs: readonly Pair[]; controlAlphaPairs: readonly AlphaPair[]; microAlphaPairs: readonly AlphaPair[]; alphaTimestampStatistics: readonly TimestampStat[] }>;
type ModelProvenance = Readonly<{ modelId: string; foldId: ResearchFoldId; status: "FIT"; featureCount: number; trainingExamples: number; modelIdentitySha256: string; lambda: 10; standardizationScope: "RESEARCH_ONLY" }>;

type InformationMetrics = Readonly<{ modelId: string; pooledPearson: number | null; pooledSpearman: number | null; signAccuracy: number | null; positivePearsonFolds: number; perFold: readonly Readonly<{ foldId: ResearchFoldId; pearson: number | null; spearman: number | null; signAccuracy: number | null; predictionDeciles: readonly Readonly<{ decile: number; count: number; mean: number | null }>[] }>[]; predictionDeciles: readonly Readonly<{ decile: number; count: number; mean: number | null }>[] }>;
type AlphaMetrics = Readonly<{ modelId: string; meanTimestampSpearman: number | null; pooledOpportunitySpearman: number | null; positiveSpearmanFolds: number; perFold: readonly Readonly<{ foldId: ResearchFoldId; meanTimestampSpearman: number | null; positiveTimestamps: number; timestampCount: number; topBottomSpread: number | null; positiveSpread: boolean }>[]; topBottomSpread: number | null; positiveSpreadFolds: number }>;

export type R16PerformanceReport = Readonly<{
  schemaVersion: typeof M3_R16_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R16_RESEARCH_ROUND_ID;
  classification: "HISTORICAL_DEVELOPMENT_INFORMATION_STUDY";
  executionId: string;
  performanceExecutionSourceSha: string;
  acceptedR15SourceSha: string;
  sourceDatasetSha256: string;
  sourceManifestSha256: string;
  sourceR14ObservationSha256: string;
  sourceR15ObservationSha256: string;
  specSha256: string;
  planSha256: string;
  gateSha256: string;
  conformanceSha256: string;
  researchBoundary: typeof M3_R16_RESEARCH_END_ISO;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: "bt-policy-003";
  horizonHours: 4;
  purgeEmbargoHours: 24;
  performanceLock: typeof M3_R16_PERFORMANCE_LOCK;
  performanceLockTriggered: true;
  performanceExecutionCount: number;
  continuationCount: number;
  reusedCompletedCheckpoints: number;
  recomputedCompletedCheckpoints: number;
  performanceLifecycle: "PERFORMANCE_LOCKED_CRASH_SAFE";
  observationFreeze: Readonly<{ path: typeof R16_OBSERVATION_FREEZE_PATH; manifestSha256: string; observationDataSha256: string; observationCount: number; decisionTimeCount: number; pooledCoverage: number; integrity: "COMPLETE" }>;
  coverageByFold: Readonly<Record<string, unknown>>;
  controlBeta: InformationMetrics;
  microBeta: InformationMetrics & Readonly<{ deltaPooledPearson: number | null; deltaPooledSpearman: number | null; foldPearsonDeltas: readonly Readonly<{ foldId: ResearchFoldId; delta: number | null }>[]; improvedFolds: number }>;
  controlAlpha: AlphaMetrics;
  microAlpha: AlphaMetrics & Readonly<{ deltaMeanTimestampSpearman: number | null; deltaPooledOpportunitySpearman: number | null; deltaTopBottomSpread: number | null; foldMeanTimestampDeltas: readonly Readonly<{ foldId: ResearchFoldId; delta: number | null }>[]; improvedFolds: number }>;
  gates: Readonly<{ eligibility: "ELIGIBLE" | "INELIGIBLE"; gateResults: readonly R16GateResult[]; failedGateIds: readonly string[] }>;
  selection: Readonly<{ finalDecision: typeof M3_R16_GAIN_OUTCOME | typeof M3_R16_NO_GAIN_OUTCOME; selectedInformationModel: "R16-BETA-MICRO + R16-ALPHA-MICRO" | null; round017DesignInput: boolean; selectionAlgorithmApplied: false }>;
  governance: Readonly<{ baseline002Status: "NOT_FROZEN"; m3JStatus: "BLOCKED"; m4Status: "NOT_STARTED"; productionUnchanged: true; baseline001Unchanged: true; forwardShadowEligible: false; privateBinanceApi: false; automaticTrading: false; postLockNetworkFetch: false; liquidationFeatureStatus: "DEFERRED_NOT_INCLUDED_IN_R16" }>;
  artifactHashMethod: typeof R16_ARTIFACT_HASH_METHOD;
}>;

export type R16ExecutionArtifacts = Readonly<{ report: R16PerformanceReport; summaryJson: string; auditJson: string; resultsMarkdown: string; selectionJson: string; selectionMarkdown: string; publicationHashesJson: string }>;
type FinalPayload = Readonly<{ report: R16PerformanceReport }>;
type FoldPayload = Readonly<{ performance: FoldPerformance; provenance: readonly ModelProvenance[] }>;

function hash(value: unknown): string { return createHash("sha256").update(stableStringify(value), "utf8").digest("hex"); }
function mean(values: readonly number[]): number | null { return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length; }
function pearson(left: readonly number[], right: readonly number[]): number | null { if (left.length < 2 || left.length !== right.length) return null; const lm = mean(left)!; const rm = mean(right)!; const numerator = left.reduce((sum, value, index) => sum + (value - lm) * (right[index]! - rm), 0); const ld = Math.sqrt(left.reduce((sum, value) => sum + (value - lm) ** 2, 0)); const rd = Math.sqrt(right.reduce((sum, value) => sum + (value - rm) ** 2, 0)); return ld === 0 || rd === 0 ? null : numerator / (ld * rd); }
function foldRole(time: number, fold: ResearchFoldId, role: "RESEARCH" | "VALIDATION"): boolean { const range = getResearchFoldRoleRange(fold, role); return time >= range.startTime && time <= range.endTime; }
function rowsForTime(rows: readonly R16Observation[], time: number, direction: R16Direction): readonly R16Observation[] { return rows.filter((row) => row.decisionTime === time && row.direction === direction).sort((left, right) => R16_SYMBOLS.indexOf(left.symbol) - R16_SYMBOLS.indexOf(right.symbol)); }

async function collectRows(filePath: string): Promise<readonly R16Observation[]> { const rows: R16Observation[] = []; for await (const row of streamR16Observations(filePath)) rows.push(row); return Object.freeze(rows); }

function trainingExamples(rows: readonly R16Observation[], foldId: ResearchFoldId): Readonly<{ betaControl: { features: Readonly<Record<string, number>>; target: number }[]; betaMicro: { features: Readonly<Record<string, number>>; target: number }[]; alphaControl: { features: Readonly<Record<string, number>>; target: number }[]; alphaMicro: { features: Readonly<Record<string, number>>; target: number }[] }> {
  const betaControl: { features: Readonly<Record<string, number>>; target: number }[] = [];
  const betaMicro: { features: Readonly<Record<string, number>>; target: number }[] = [];
  const alphaControl: { features: Readonly<Record<string, number>>; target: number }[] = [];
  const alphaMicro: { features: Readonly<Record<string, number>>; target: number }[] = [];
  const seen = new Set<string>();
  const validationStart = getResearchFoldRoleRange(foldId, "VALIDATION").startTime;
  for (const row of rows) {
    if (!foldRole(row.decisionTime, foldId, "RESEARCH") || !(row.decisionTime + R16_PURGE_EMBARGO_HOURS * 60 * 60_000 < validationStart)) continue;
    alphaControl.push({ features: row.alphaControlFeatures, target: row.relativeAlphaTarget });
    alphaMicro.push({ features: row.alphaMicroFeatures, target: row.relativeAlphaTarget });
    if (row.symbol === "BTCUSDT" && !seen.has(`${row.decisionTime}|${row.direction}`)) { seen.add(`${row.decisionTime}|${row.direction}`); betaControl.push({ features: row.betaControlFeatures, target: row.marketBetaTarget }); betaMicro.push({ features: row.betaMicroFeatures, target: row.marketBetaTarget }); }
  }
  return Object.freeze({ betaControl, betaMicro, alphaControl, alphaMicro });
}

function validatePredictions(rows: readonly R16Observation[], foldId: ResearchFoldId, betaControl: R15RidgeModel, betaMicro: R15RidgeModel, alphaControl: R15RidgeModel, alphaMicro: R15RidgeModel): FoldPerformance {
  const times = [...new Set(rows.filter((row) => foldRole(row.decisionTime, foldId, "VALIDATION")).map((row) => row.decisionTime))].sort((left, right) => left - right);
  const controlBetaPairs: Pair[] = [];
  const microBetaPairs: Pair[] = [];
  const controlAlphaPairs: AlphaPair[] = [];
  const microAlphaPairs: AlphaPair[] = [];
  const alphaTimestampStatistics: TimestampStat[] = [];
  for (const decisionTime of times) for (const direction of ["LONG", "SHORT"] as const) {
    const section = rowsForTime(rows, decisionTime, direction);
    if (section.length !== R16_SYMBOLS.length) throw new Error(`R16 common-mask validation section is incomplete at ${decisionTime}/${direction}.`);
    const btc = section.find((row) => row.symbol === "BTCUSDT")!;
    const controlBetaPrediction = predictR15RidgeModel(betaControl, btc.betaControlFeatures);
    const microBetaPrediction = predictR15RidgeModel(betaMicro, btc.betaMicroFeatures);
    controlBetaPairs.push(Object.freeze({ foldId, decisionTime, direction, predicted: controlBetaPrediction, realized: btc.marketBetaTarget }));
    microBetaPairs.push(Object.freeze({ foldId, decisionTime, direction, predicted: microBetaPrediction, realized: btc.marketBetaTarget }));
    const controlAlpha = section.map((row) => ({ symbol: row.symbol, predicted: predictR15RidgeModel(alphaControl, row.alphaControlFeatures), realized: row.relativeAlphaTarget }));
    const microAlpha = section.map((row) => ({ symbol: row.symbol, predicted: predictR15RidgeModel(alphaMicro, row.alphaMicroFeatures), realized: row.relativeAlphaTarget }));
    controlAlphaPairs.push(...controlAlpha.map((value) => Object.freeze({ foldId, decisionTime, direction, symbol: value.symbol, predicted: value.predicted, realized: value.realized })));
    microAlphaPairs.push(...microAlpha.map((value) => Object.freeze({ foldId, decisionTime, direction, symbol: value.symbol, predicted: value.predicted, realized: value.realized })));
    alphaTimestampStatistics.push(Object.freeze({ foldId, decisionTime, direction, controlSpearman: r15Spearman(controlAlpha.map((value) => value.predicted), controlAlpha.map((value) => value.realized)), microSpearman: r15Spearman(microAlpha.map((value) => value.predicted), microAlpha.map((value) => value.realized)), controlSpread: r15TopBottomRealizedSpread(controlAlpha), microSpread: r15TopBottomRealizedSpread(microAlpha) }));
  }
  return Object.freeze({ foldId, validationDecisionTimestamps: times.length, controlBetaPairs: Object.freeze(controlBetaPairs), microBetaPairs: Object.freeze(microBetaPairs), controlAlphaPairs: Object.freeze(controlAlphaPairs), microAlphaPairs: Object.freeze(microAlphaPairs), alphaTimestampStatistics: Object.freeze(alphaTimestampStatistics) });
}

function informationMetrics(modelId: string, folds: readonly FoldPerformance[], type: "control" | "micro"): InformationMetrics {
  const pairFor = (fold: FoldPerformance): readonly Pair[] => type === "control" ? fold.controlBetaPairs : fold.microBetaPairs;
  const perFold = folds.map((fold) => { const pairs = pairFor(fold); const predicted = pairs.map((value) => value.predicted); const realized = pairs.map((value) => value.realized); return Object.freeze({ foldId: fold.foldId, pearson: pearson(predicted, realized), spearman: r15Spearman(predicted, realized), signAccuracy: predicted.length === 0 ? null : predicted.filter((value, index) => Math.sign(value) === Math.sign(realized[index]!)).length / predicted.length, predictionDeciles: r15Deciles(realized, predicted) }); });
  const pairs = folds.flatMap(pairFor); const predicted = pairs.map((value) => value.predicted); const realized = pairs.map((value) => value.realized);
  return Object.freeze({ modelId, pooledPearson: pearson(predicted, realized), pooledSpearman: r15Spearman(predicted, realized), signAccuracy: predicted.length === 0 ? null : predicted.filter((value, index) => Math.sign(value) === Math.sign(realized[index]!)).length / predicted.length, positivePearsonFolds: perFold.filter((value) => value.pearson !== null && value.pearson > 0).length, perFold: Object.freeze(perFold), predictionDeciles: r15Deciles(realized, predicted) });
}

function alphaMetrics(modelId: string, folds: readonly FoldPerformance[], type: "control" | "micro"): AlphaMetrics {
  const statistics = folds.flatMap((fold) => fold.alphaTimestampStatistics);
  const perFold = folds.map((fold) => { const values = fold.alphaTimestampStatistics.map((value) => type === "control" ? value.controlSpearman : value.microSpearman).filter((value): value is number => value !== null); const spreads = fold.alphaTimestampStatistics.map((value) => type === "control" ? value.controlSpread : value.microSpread).filter((value): value is number => value !== null); return Object.freeze({ foldId: fold.foldId, meanTimestampSpearman: mean(values), positiveTimestamps: values.filter((value) => value > 0).length, timestampCount: values.length, topBottomSpread: mean(spreads), positiveSpread: (mean(spreads) ?? Number.NEGATIVE_INFINITY) > 0 }); });
  const pairs = folds.flatMap((fold) => type === "control" ? fold.controlAlphaPairs : fold.microAlphaPairs);
  return Object.freeze({ modelId, meanTimestampSpearman: mean(statistics.map((value) => type === "control" ? value.controlSpearman : value.microSpearman).filter((value): value is number => value !== null)), pooledOpportunitySpearman: r15Spearman(pairs.map((value) => value.predicted), pairs.map((value) => value.realized)), positiveSpearmanFolds: perFold.filter((value) => value.meanTimestampSpearman !== null && value.meanTimestampSpearman > 0).length, perFold: Object.freeze(perFold), topBottomSpread: mean(statistics.map((value) => type === "control" ? value.controlSpread : value.microSpread).filter((value): value is number => value !== null)), positiveSpreadFolds: perFold.filter((value) => value.positiveSpread).length });
}

async function executeFold(input: Readonly<{ rows: readonly R16Observation[]; foldId: ResearchFoldId; executionDirectory: string; inputHashes: Readonly<Record<string, string>> }>): Promise<Readonly<{ performance: FoldPerformance; provenance: readonly ModelProvenance[]; reused: boolean }>> {
  const checkpoint = foldCheckpointPath(input.executionDirectory, input.foldId);
  if (checkpointExists(checkpoint)) { const value = readR16Checkpoint<FoldPayload>(checkpoint, input.inputHashes).payload; return Object.freeze({ performance: value.performance, provenance: value.provenance, reused: true }); }
  const examples = trainingExamples(input.rows, input.foldId);
  const models = [fitR15RidgeModel("R16-BETA-CONTROL", R16_BETA_CONTROL_FEATURE_NAMES, examples.betaControl), fitR15RidgeModel("R16-BETA-MICRO", R16_BETA_MICRO_FEATURE_NAMES, examples.betaMicro), fitR15RidgeModel("R16-ALPHA-CONTROL", R16_ALPHA_CONTROL_FEATURE_NAMES, examples.alphaControl), fitR15RidgeModel("R16-ALPHA-MICRO", R16_ALPHA_MICRO_FEATURE_NAMES, examples.alphaMicro)] as const;
  const provenance = Object.freeze(models.map((model) => Object.freeze({ modelId: model.modelId, foldId: input.foldId, status: "FIT" as const, featureCount: model.featureNames.length, trainingExamples: model.trainingExamples, modelIdentitySha256: model.modelIdentitySha256, lambda: R16_RIDGE_LAMBDA, standardizationScope: "RESEARCH_ONLY" as const })));
  const performance = validatePredictions(input.rows, input.foldId, ...models);
  writeR16CheckpointAtomic({ filePath: checkpoint, kind: "FOLD", key: input.foldId, inputHashes: input.inputHashes, payload: Object.freeze({ performance, provenance }) });
  return Object.freeze({ performance, provenance, reused: false });
}

function coverageValues(freeze: R16ObservationFreezeManifest): Readonly<{ pooled: number; validation: readonly number[]; training: readonly number[] }> { return Object.freeze({ pooled: freeze.pooledCoverage, validation: Object.values(freeze.coverageByFold).map((value) => value.validationCoverage), training: Object.values(freeze.coverageByFold).map((value) => value.trainingCoverage) }); }

function buildReport(input: Readonly<{ executionId: string; sourceSha: string; freeze: R16ObservationFreezeManifest; conformance: R16ConformanceDocument; folds: readonly FoldPerformance[]; provenance: readonly ModelProvenance[]; performanceExecutionCount: number; continuationCount: number; reusedCompletedCheckpoints: number; recomputedCompletedCheckpoints: number }>): R16PerformanceReport {
  const controlBeta = informationMetrics("R16-BETA-CONTROL", input.folds, "control");
  const microBase = informationMetrics("R16-BETA-MICRO", input.folds, "micro");
  const controlAlpha = alphaMetrics("R16-ALPHA-CONTROL", input.folds, "control");
  const microBaseAlpha = alphaMetrics("R16-ALPHA-MICRO", input.folds, "micro");
  const foldPearsonDeltas = input.folds.map((fold) => Object.freeze({ foldId: fold.foldId, delta: (informationMetrics("control", [fold], "micro").pooledPearson ?? Number.NaN) - (informationMetrics("control", [fold], "control").pooledPearson ?? Number.NaN) })).map((value) => Object.freeze({ foldId: value.foldId, delta: Number.isFinite(value.delta) ? value.delta : null }));
  const foldAlphaDeltas = input.folds.map((fold) => { const control = alphaMetrics("control", [fold], "control").meanTimestampSpearman; const micro = alphaMetrics("micro", [fold], "micro").meanTimestampSpearman; return Object.freeze({ foldId: fold.foldId, delta: control !== null && micro !== null ? micro - control : null }); });
  const betaDelta = microBase.pooledPearson !== null && controlBeta.pooledPearson !== null ? microBase.pooledPearson - controlBeta.pooledPearson : null;
  const betaSpearmanDelta = microBase.pooledSpearman !== null && controlBeta.pooledSpearman !== null ? microBase.pooledSpearman - controlBeta.pooledSpearman : null;
  const alphaDelta = microBaseAlpha.meanTimestampSpearman !== null && controlAlpha.meanTimestampSpearman !== null ? microBaseAlpha.meanTimestampSpearman - controlAlpha.meanTimestampSpearman : null;
  const alphaPooledDelta = microBaseAlpha.pooledOpportunitySpearman !== null && controlAlpha.pooledOpportunitySpearman !== null ? microBaseAlpha.pooledOpportunitySpearman - controlAlpha.pooledOpportunitySpearman : null;
  const alphaSpreadDelta = microBaseAlpha.topBottomSpread !== null && controlAlpha.topBottomSpread !== null ? microBaseAlpha.topBottomSpread - controlAlpha.topBottomSpread : null;
  const coverage = coverageValues(input.freeze);
  const gates = evaluateR16Gates({ pooledCoverage: coverage.pooled, validationFoldCoverages: coverage.validation, trainingFoldCoverages: coverage.training, microBetaPooledPearson: microBase.pooledPearson, deltaBetaPooledPearson: betaDelta, microBetaPositivePearsonFolds: microBase.positivePearsonFolds, betaImprovementFolds: foldPearsonDeltas.filter((value) => value.delta !== null && value.delta >= 0.01).length, microBetaFoldPearsons: microBase.perFold.map((value) => value.pearson), microAlphaMeanTimestampSpearman: microBaseAlpha.meanTimestampSpearman, deltaAlphaMeanTimestampSpearman: alphaDelta, microAlphaPositiveSpearmanFolds: microBaseAlpha.positiveSpearmanFolds, alphaImprovementFolds: foldAlphaDeltas.filter((value) => value.delta !== null && value.delta >= 0.01).length, microAlphaFoldSpearmans: microBaseAlpha.perFold.map((value) => value.meanTimestampSpearman), microAlphaTopBottomSpread: microBaseAlpha.topBottomSpread, deltaAlphaTopBottomSpread: alphaSpreadDelta, microAlphaPositiveSpreadFolds: microBaseAlpha.positiveSpreadFolds, evidenceComplete: input.freeze.integrity === "COMPLETE" && input.freeze.integrityErrors.length === 0, provenanceComplete: input.provenance.length === R16_FOLD_IDS.length * 4 && input.provenance.every((value) => value.status === "FIT") });
  const eligible = gates.eligibility === "ELIGIBLE";
  return Object.freeze({ schemaVersion: M3_R16_REPORT_SCHEMA_VERSION, researchRoundId: M3_R16_RESEARCH_ROUND_ID, classification: "HISTORICAL_DEVELOPMENT_INFORMATION_STUDY", executionId: input.executionId, performanceExecutionSourceSha: input.sourceSha, acceptedR15SourceSha: M3_R16_ACCEPTED_R15_SOURCE_SHA, sourceDatasetSha256: M3_R16_SOURCE_DATASET_SHA256, sourceManifestSha256: M3_R16_SOURCE_MANIFEST_SHA256, sourceR14ObservationSha256: M3_R16_SOURCE_R14_OBSERVATION_SHA256, sourceR15ObservationSha256: M3_R16_SOURCE_R15_OBSERVATION_SHA256, specSha256: R16_SPEC_SHA256, planSha256: R16_PLAN_SHA256, gateSha256: R16_GATE_SHA256, conformanceSha256: hash(input.conformance), researchBoundary: M3_R16_RESEARCH_END_ISO, strategyVersion: "baseline-001", backtestPolicyVersion: "bt-policy-003", horizonHours: 4, purgeEmbargoHours: 24, performanceLock: M3_R16_PERFORMANCE_LOCK, performanceLockTriggered: true, performanceExecutionCount: input.performanceExecutionCount, continuationCount: input.continuationCount, reusedCompletedCheckpoints: input.reusedCompletedCheckpoints, recomputedCompletedCheckpoints: input.recomputedCompletedCheckpoints, performanceLifecycle: "PERFORMANCE_LOCKED_CRASH_SAFE", observationFreeze: Object.freeze({ path: R16_OBSERVATION_FREEZE_PATH, manifestSha256: hash(input.freeze), observationDataSha256: input.freeze.observationDataSha256, observationCount: input.freeze.observationCount, decisionTimeCount: input.freeze.decisionTimeCount, pooledCoverage: input.freeze.pooledCoverage, integrity: "COMPLETE" }), coverageByFold: input.freeze.coverageByFold, controlBeta, microBeta: Object.freeze({ ...microBase, deltaPooledPearson: betaDelta, deltaPooledSpearman: betaSpearmanDelta, foldPearsonDeltas, improvedFolds: foldPearsonDeltas.filter((value) => value.delta !== null && value.delta >= 0.01).length }), controlAlpha, microAlpha: Object.freeze({ ...microBaseAlpha, deltaMeanTimestampSpearman: alphaDelta, deltaPooledOpportunitySpearman: alphaPooledDelta, deltaTopBottomSpread: alphaSpreadDelta, foldMeanTimestampDeltas: foldAlphaDeltas, improvedFolds: foldAlphaDeltas.filter((value) => value.delta !== null && value.delta >= 0.01).length }), gates, selection: Object.freeze({ finalDecision: eligible ? M3_R16_GAIN_OUTCOME : M3_R16_NO_GAIN_OUTCOME, selectedInformationModel: eligible ? "R16-BETA-MICRO + R16-ALPHA-MICRO" : null, round017DesignInput: eligible, selectionAlgorithmApplied: false }), governance: Object.freeze({ baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED", productionUnchanged: true, baseline001Unchanged: true, forwardShadowEligible: false, privateBinanceApi: false, automaticTrading: false, postLockNetworkFetch: false, liquidationFeatureStatus: "DEFERRED_NOT_INCLUDED_IN_R16" }), artifactHashMethod: R16_ARTIFACT_HASH_METHOD });
}

function renderResults(report: R16PerformanceReport): string { const lines = [`# M3-R16 Round-016 Derivatives Microstructure Information Gain`, ``, `- researchRoundId: ${report.researchRoundId}`, `- classification: ${report.classification}`, `- executionId: ${report.executionId}`, `- performanceExecutionSourceSha: ${report.performanceExecutionSourceSha}`, `- performanceExecutionCount: ${report.performanceExecutionCount}`, `- performanceLock: ${report.performanceLock}`, ``, `## Control beta`, ``, `- pooledPearson: ${report.controlBeta.pooledPearson}`, `- pooledSpearman: ${report.controlBeta.pooledSpearman}`, `- foldPearson: ${JSON.stringify(report.controlBeta.perFold.map((value) => [value.foldId, value.pearson]))}`, `- signAccuracy: ${report.controlBeta.signAccuracy}`, ``, `## Micro beta`, ``, `- pooledPearson: ${report.microBeta.pooledPearson}`, `- pooledSpearman: ${report.microBeta.pooledSpearman}`, `- deltaPooledPearson: ${report.microBeta.deltaPooledPearson}`, `- improvedFolds: ${report.microBeta.improvedFolds}/6`, ``, `## Control alpha`, ``, `- meanTimestampSpearman: ${report.controlAlpha.meanTimestampSpearman}`, `- pooledOpportunitySpearman: ${report.controlAlpha.pooledOpportunitySpearman}`, `- topBottomSpread: ${report.controlAlpha.topBottomSpread}`, ``, `## Micro alpha`, ``, `- meanTimestampSpearman: ${report.microAlpha.meanTimestampSpearman}`, `- pooledOpportunitySpearman: ${report.microAlpha.pooledOpportunitySpearman}`, `- deltaMeanTimestampSpearman: ${report.microAlpha.deltaMeanTimestampSpearman}`, `- topBottomSpread: ${report.microAlpha.topBottomSpread}`, `- improvedFolds: ${report.microAlpha.improvedFolds}/6`, ``, `## Gates`, ``, ...report.gates.gateResults.map((value) => `- ${value.gateId}: ${value.passed ? "PASS" : "FAIL"} (observed ${JSON.stringify(value.observed)}; requirement ${value.requirement})`), ``, `- finalDecision: ${report.selection.finalDecision}`, `- selectedInformationModel: ${report.selection.selectedInformationModel ?? "null"}`, `- round017DesignInput: ${report.selection.round017DesignInput}`, `- baseline002Status: ${report.governance.baseline002Status}`, `- forwardShadowEligible: ${report.governance.forwardShadowEligible}`, `- privateBinanceApi: ${report.governance.privateBinanceApi}`, `- automaticTrading: ${report.governance.automaticTrading}`]; return lines.join("\n"); }
function selectionMarkdown(report: R16PerformanceReport): string { return [`# M3-R16 Round-016 Selection`, ``, `- finalDecision: ${report.selection.finalDecision}`, `- selectedInformationModel: ${report.selection.selectedInformationModel ?? "null"}`, `- round017DesignInput: ${report.selection.round017DesignInput}`, `- selectionAlgorithmApplied: ${report.selection.selectionAlgorithmApplied}`, `- evidenceStatus: COMPLETE`, `- artifactHashMethod: ${report.artifactHashMethod}`].join("\n"); }

export function buildR16ExecutionArtifacts(report: R16PerformanceReport): R16ExecutionArtifacts { const selectionJson = stableStringify({ schemaVersion: "m3-r16-round-016-selection-001", researchRoundId: report.researchRoundId, executionId: report.executionId, performanceExecutionSourceSha: report.performanceExecutionSourceSha, gateSha256: report.gateSha256, planSha256: report.planSha256, evidenceStatus: "COMPLETE", gates: report.gates, selection: report.selection, governance: report.governance, artifactHashMethod: report.artifactHashMethod }); const resultsMarkdown = renderResults(report); const selectionMarkdownText = selectionMarkdown(report); const summaryJson = stableStringify({ ...report, evidenceStatus: "COMPLETE" }); const summarySha = r16HashUtf8Bytes(summaryJson); const resultsSha = r16HashUtf8Bytes(resultsMarkdown); const selectionJsonSha = r16HashUtf8Bytes(selectionJson); const selectionMarkdownSha = r16HashUtf8Bytes(selectionMarkdownText); const auditJson = stableStringify({ schemaVersion: M3_R16_AUDIT_SCHEMA_VERSION, researchRoundId: report.researchRoundId, classification: report.classification, execution: { executionId: report.executionId, performanceExecutionSourceSha: report.performanceExecutionSourceSha, performanceLock: report.performanceLock, performanceExecutionCount: report.performanceExecutionCount, continuationCount: report.continuationCount, postLockNetworkFetch: report.governance.postLockNetworkFetch }, data: { sourceDatasetSha256: report.sourceDatasetSha256, sourceManifestSha256: report.sourceManifestSha256, sourceR14ObservationSha256: report.sourceR14ObservationSha256, sourceR15ObservationSha256: report.sourceR15ObservationSha256, observationFreeze: report.observationFreeze, coverageByFold: report.coverageByFold }, models: { modelCount: 4, provenance: "COMPLETE_RESEARCH_ONLY_STANDARDIZATION" }, gates: report.gates, selection: report.selection, exactUtf8ByteArtifactHashes: { summary: summarySha, results: resultsSha, selectionJson: selectionJsonSha, selectionMarkdown: selectionMarkdownSha }, hashMethod: R16_ARTIFACT_HASH_METHOD, governance: report.governance }); const publicationHashesJson = stableStringify({ hashMethod: R16_ARTIFACT_HASH_METHOD, artifacts: { summary: { path: R16_REQUIRED_OUTPUT_PATHS[6], exactUtf8ByteSha256: summarySha }, audit: { path: R16_REQUIRED_OUTPUT_PATHS[7], exactUtf8ByteSha256: r16HashUtf8Bytes(auditJson) }, results: { path: R16_REQUIRED_OUTPUT_PATHS[8], exactUtf8ByteSha256: resultsSha }, selectionJson: { path: R16_REQUIRED_OUTPUT_PATHS[9], exactUtf8ByteSha256: selectionJsonSha }, selectionMarkdown: { path: R16_REQUIRED_OUTPUT_PATHS[10], exactUtf8ByteSha256: selectionMarkdownSha } } }); return Object.freeze({ report, summaryJson, auditJson, resultsMarkdown, selectionJson, selectionMarkdown: selectionMarkdownText, publicationHashesJson }); }

export function existingR16OutputArtifacts(root = process.cwd()): readonly string[] { return Object.freeze(R16_REQUIRED_OUTPUT_PATHS.slice(6).filter((value) => existsSync(path.join(root, value)))); }

export function publishR16ArtifactsAtomically(input: Readonly<{ artifacts: R16ExecutionArtifacts; root?: string; beforePublish?: (target: string, index: number) => void; onStagingCreated?: (stagingDirectory: string) => void }>): void {
  const root = path.resolve(input.root ?? process.cwd());
  const targets = new Map<string, string>([
    [R16_REQUIRED_OUTPUT_PATHS[6], input.artifacts.summaryJson],
    [R16_REQUIRED_OUTPUT_PATHS[7], input.artifacts.auditJson],
    [R16_REQUIRED_OUTPUT_PATHS[8], input.artifacts.resultsMarkdown],
    [R16_REQUIRED_OUTPUT_PATHS[9], input.artifacts.selectionJson],
    [R16_REQUIRED_OUTPUT_PATHS[10], input.artifacts.selectionMarkdown],
    [R16_PUBLICATION_HASHES_PATH, input.artifacts.publicationHashesJson],
  ].map(([relative, value]) => [path.join(root, relative), value]));
  if ([...targets.keys()].some((target) => existsSync(target))) throw new Error("R16 output already exists; refusing overwrite.");

  const staging = mkdtempSync(path.join(root, "docs", ".m3-r16-round-016-staging-"));
  const publication = [
    path.join(root, R16_REQUIRED_OUTPUT_PATHS[7]),
    path.join(root, R16_REQUIRED_OUTPUT_PATHS[8]),
    path.join(root, R16_REQUIRED_OUTPUT_PATHS[9]),
    path.join(root, R16_REQUIRED_OUTPUT_PATHS[10]),
    path.join(root, R16_PUBLICATION_HASHES_PATH),
    path.join(root, R16_REQUIRED_OUTPUT_PATHS[6]),
  ];
  const staged = new Map<string, string>();
  const published: string[] = [];
  let publicationFailed = false;
  let publicationError: unknown;
  const rollbackErrors: string[] = [];
  let cleanupError: unknown;

  try {
    input.onStagingCreated?.(staging);
    for (const [index, target] of publication.entries()) {
      const temporary = path.join(staging, `${index}-${path.basename(target)}`);
      writeFileSync(temporary, Buffer.from(targets.get(target)!, "utf8"));
      staged.set(target, temporary);
    }
    for (const [index, target] of publication.entries()) {
      input.beforePublish?.(target, index);
      if (existsSync(target)) throw new Error(`R16 output appeared during publication: ${target}`);
      mkdirSync(path.dirname(target), { recursive: true });
      renameSync(staged.get(target)!, target);
      published.push(target);
    }
  } catch (error) {
    publicationFailed = true;
    publicationError = error;
    for (const target of [...published].reverse()) {
      try {
        unlinkSync(target);
      } catch (rollbackError) {
        rollbackErrors.push(`${target}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
    }
  } finally {
    if (existsSync(staging)) {
      try {
        rmSync(staging, { recursive: true, force: true });
      } catch (error) {
        cleanupError = error;
      }
    }
  }

  if (publicationFailed) {
    const primary = publicationError instanceof Error ? publicationError.message : String(publicationError);
    const details = [...(rollbackErrors.length > 0 ? [`rollback failed: ${rollbackErrors.join(" | ")}`] : []), ...(cleanupError !== undefined ? [`staging cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`] : [])];
    throw new Error([primary, ...details].join("; "));
  }
  if (cleanupError !== undefined) throw new Error(`R16 staging cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
}

export function summarizeR16CompletedCheckpoints(reused: readonly boolean[]): Readonly<{ reusedCompletedCheckpoints: number; recomputedCompletedCheckpoints: number }> { return Object.freeze({ reusedCompletedCheckpoints: reused.filter(Boolean).length, recomputedCompletedCheckpoints: reused.filter((value) => !value).length }); }

export async function executeR16Performance(input: Readonly<{ root?: string; executionDirectory: string; executionLock: R16ExecutionLock; executionLedger: R16PerformanceExecutionLedger; observationFreeze: R16ObservationFreezeManifest; conformance: R16ConformanceDocument }>): Promise<Readonly<{ report: R16PerformanceReport; reusedCompletedCheckpoints: number; recomputedCompletedCheckpoints: number }>> { const root = path.resolve(input.root ?? process.cwd()); validateR16Plan(); const performanceExecutionCount = validateR16ExecutionLedgerForLock(input.executionLedger, input.executionLock); if (input.conformance.resultAffectingDeviationCount !== 0 || input.conformance.integrity !== "COMPLETE") throw new Error("R16 conformance is not complete."); const observationFile = path.resolve(root, input.observationFreeze.observationDataPath); const rows = await collectRows(observationFile); const finalPath = finalPerformanceCheckpointPath(input.executionDirectory); const hashes = Object.freeze({ executionSourceSha: input.executionLock.executionSourceSha, observationDatasetSha256: input.observationFreeze.observationDataSha256, planSha256: R16_PLAN_SHA256, gateSha256: R16_GATE_SHA256, conformanceSha256: hash(input.conformance) }); if (checkpointExists(finalPath)) { const storedReport = readR16Checkpoint<FinalPayload>(finalPath, hashes).payload.report; return Object.freeze({ report: Object.freeze({ ...storedReport, performanceExecutionCount }), reusedCompletedCheckpoints: R16_FOLD_IDS.length, recomputedCompletedCheckpoints: 0 }); } const folds: FoldPerformance[] = []; const provenance: ModelProvenance[] = []; const checkpointReuse: boolean[] = []; for (const foldId of R16_FOLD_IDS) { const result = await executeFold({ rows, foldId, executionDirectory: input.executionDirectory, inputHashes: Object.freeze({ ...hashes, foldId }) }); folds.push(result.performance); provenance.push(...result.provenance); checkpointReuse.push(result.reused); } const checkpointSummary = summarizeR16CompletedCheckpoints(checkpointReuse); const report = buildReport({ executionId: input.executionLock.executionId, sourceSha: input.executionLock.executionSourceSha, freeze: input.observationFreeze, conformance: input.conformance, folds, provenance, performanceExecutionCount, continuationCount: input.executionLock.continuationCount, reusedCompletedCheckpoints: checkpointSummary.reusedCompletedCheckpoints, recomputedCompletedCheckpoints: checkpointSummary.recomputedCompletedCheckpoints }); writeR16CheckpointAtomic({ filePath: finalPath, kind: "FINAL_PERFORMANCE", key: input.executionLock.executionId, inputHashes: hashes, payload: Object.freeze({ report }) }); return Object.freeze({ report, ...checkpointSummary }); }

export function r16PerformanceSummary(report: R16PerformanceReport): Readonly<Record<string, unknown>> { return Object.freeze({ executionId: report.executionId, performanceExecutionSourceSha: report.performanceExecutionSourceSha, performanceLockTriggered: report.performanceLockTriggered, performanceExecutionCount: report.performanceExecutionCount, controlBetaPooledPearson: report.controlBeta.pooledPearson, microBetaPooledPearson: report.microBeta.pooledPearson, controlAlphaMeanTimestampSpearman: report.controlAlpha.meanTimestampSpearman, microAlphaMeanTimestampSpearman: report.microAlpha.meanTimestampSpearman, finalDecision: report.selection.finalDecision }); }
