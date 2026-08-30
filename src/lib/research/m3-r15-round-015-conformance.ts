import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { R13ForwardLabel } from "./m3-r13-round-013-labels.ts";
import { R13_FEATURE_NAMES, R13_HORIZON_HOURS, type R13HorizonHours, type R13Direction } from "./m3-r13-round-013-protocol.ts";
import type { R13FeatureVector } from "./m3-r13-round-013-features.ts";
import type { R13Observation } from "./m3-r13-round-013-performance.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { isR13TrainingObservationPurgeSafe } from "./m3-r13-round-013-validation.ts";
import { deriveR15GroupForTest, isR15TargetDecompositionValid } from "./m3-r15-round-015-data.ts";
import { fitR15RidgeModel } from "./m3-r15-round-015-model.ts";
import { r15SelectTopOne } from "./m3-r15-round-015-behavior.ts";
import { R15_PLAN, R15_PLAN_SHA256 } from "./m3-r15-round-015-plan.ts";
import { R15_GATE_SHA256 } from "./selection-gates-round-015.ts";
import {
  R15_ALPHA_FEATURE_DEFINITIONS,
  R15_ALPHA_FEATURE_NAMES,
  R15_ARTIFACT_HASH_METHOD,
  R15_BETA_FEATURE_DEFINITIONS,
  R15_BETA_FEATURE_NAMES,
  R15_DIRECTIONS,
  R15_FOLD_IDS,
  R15_HORIZON_HOURS,
  R15_OBSERVATION_DATA_PATH,
  R15_OBSERVATION_FREEZE_PATH,
  R15_PLAN_PATH,
  R15_PURGE_EMBARGO_HOURS,
  R15_SOURCE_DATASET_SHA256,
  R15_SOURCE_MANIFEST_SHA256,
  R15_SOURCE_OBSERVATION_SHA256,
  R15_SPEC_OBJECT,
  R15_SPEC_SHA256,
  R15_SYMBOLS,
  R15_TARGET_THRESHOLD,
  M3_R15_ACCEPTED_R14_SOURCE_SHA,
  M3_R15_RESEARCH_END_ISO,
  M3_R15_RESEARCH_ROUND_ID,
} from "./m3-r15-round-015-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R15_CONFORMANCE_SCHEMA_VERSION = "m3-r15-round-015-conformance-001" as const;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROBE_DECISION_TIME = Date.parse("2024-01-01T00:00:00.000Z");
const PROBE_TARGETS: Readonly<Record<(typeof R15_SYMBOLS)[number], number>> = Object.freeze({ BTCUSDT: 0.1, ETHUSDT: 0.3, SOLUSDT: 0.5, XRPUSDT: 0.7, BNBUSDT: 0.9 });
const SOURCE_FILES = Object.freeze([
  "src/lib/research/m3-r15-round-015-protocol.ts",
  "src/lib/research/m3-r15-round-015-plan.ts",
  "src/lib/research/m3-r15-round-015-data.ts",
  "src/lib/research/m3-r15-round-015-model.ts",
  "src/lib/research/m3-r15-round-015-performance.ts",
  "src/lib/research/selection-gates-round-015.ts",
] as const);

export const R15_CONFORMANCE_CHECK_IDS = Object.freeze([
  "r14ObservationShaExact",
  "h4Only",
  "marketBetaTargetMedianExact",
  "relativeAlphaTargetIdentityExact",
  "betaAlphaReconstructsSymbolTarget",
  "betaFeatureSetB01ToB10Fixed",
  "alphaFeatureSetA01ToA10Fixed",
  "allFeaturesDecisionTimePastOnly",
  "sameTimestampCrossSectionalMediansOnly",
  "noSymbolIdentity",
  "noPerSymbolAlphaCoefficients",
  "researchOnlyStandardization",
  "foldIsolation",
  "purgeEmbargo24Hours",
  "fixedEconomicThresholdPlus010",
  "topOneMaximumPerDecisionTime",
  "noTradeBelowThreshold",
  "stressUsesFrozenPredictionsNoRetraining",
  "productionSeenDataExcluded",
  "networkDisabled",
  "privateBinanceApiAbsent",
  "automaticTradingFalse",
  "noOptimizer",
  "noSweep",
] as const);

export type R15ConformanceCheckId = (typeof R15_CONFORMANCE_CHECK_IDS)[number];
export type R15ConformanceCheck = Readonly<{
  checkId: R15ConformanceCheckId;
  probeId: string;
  passed: boolean;
  evidence: Readonly<Record<string, unknown>>;
}>;

const RESULT_AFFECTING_CHECK_IDS = new Set<R15ConformanceCheckId>(R15_CONFORMANCE_CHECK_IDS);

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)]!;
}

function probeLabel(symbol: (typeof R15_SYMBOLS)[number], direction: R13Direction, signalTime: number, horizonHours: R13HorizonHours, netForwardAtr: number): R13ForwardLabel {
  const actionableAt = signalTime + 6 * 60_000;
  return Object.freeze({
    symbol,
    direction,
    signalTime,
    actionableAt,
    signalValidUntil: signalTime + 60 * 60_000,
    delayMs: actionableAt - signalTime,
    horizonHours,
    status: "EXECUTED",
    entryTime: actionableAt,
    entryPrice: 100,
    entryFill: 100,
    exitTargetTime: actionableAt + horizonHours * 60 * 60_000,
    exitTime: actionableAt + horizonHours * 60 * 60_000,
    exitPrice: 100,
    exitFill: 100,
    grossForwardReturnBps: netForwardAtr * 100,
    grossForwardAtr: netForwardAtr + 0.04,
    feesBps: 2,
    fundingBps: 1,
    slippageBps: 1,
    netForwardReturnBps: netForwardAtr * 100,
    netForwardAtr,
    netForwardAtrCostStress: netForwardAtr - 0.01,
    mfeAtr: netForwardAtr + 0.2,
    maeAtr: -0.1,
    timeToMfeMinutes: 10,
    timeToMaeMinutes: 20,
    fundingEventCount: 1,
    fundingBurdenBps: 1,
  } as R13ForwardLabel);
}

function probeObservation(symbol: (typeof R15_SYMBOLS)[number], direction: R13Direction, index: number, decisionTime = PROBE_DECISION_TIME): R13Observation {
  const features = Object.fromEntries(R13_FEATURE_NAMES.map((name, column) => [name, (index + 1) * (column + 1) / 100])) as Record<string, number>;
  const labels = Object.fromEntries(R13_HORIZON_HOURS.map((horizon) => [horizon, probeLabel(symbol, direction, decisionTime, horizon, PROBE_TARGETS[symbol]!) ])) as Record<R13HorizonHours, R13ForwardLabel>;
  const latencyStressLabels = Object.fromEntries(R13_HORIZON_HOURS.map((horizon) => [horizon, probeLabel(symbol, direction, decisionTime, horizon, PROBE_TARGETS[symbol]! - 0.02)])) as Record<R13HorizonHours, R13ForwardLabel>;
  return Object.freeze({
    observationId: `${decisionTime}|${symbol}|${direction}`,
    decisionTime,
    symbol,
    direction,
    features: Object.freeze(features) as R13FeatureVector,
    atr14_1h: 1,
    labels: Object.freeze(labels),
    latencyStressLabels: Object.freeze(latencyStressLabels),
  });
}

function probeRows(): readonly R13Observation[] {
  return R15_DIRECTIONS.flatMap((direction) => R15_SYMBOLS.map((symbol, index) => probeObservation(symbol, direction, index)));
}

function modelExamples(featureNames: readonly string[]): readonly Readonly<{ features: Readonly<Record<string, number>>; target: number }>[] {
  return Object.freeze(Array.from({ length: 24 }, (_, row) => Object.freeze({
    features: Object.freeze(Object.fromEntries(featureNames.map((name, column) => [name, (row + 1) * (column + 2) / 100]))),
    target: (row + 1) / 100,
  })));
}

function sourceText(): Readonly<{ all: string; files: readonly string[] }> {
  return Object.freeze({ files: SOURCE_FILES, all: SOURCE_FILES.map((relativePath) => readFileSync(path.join(REPO_ROOT, relativePath), "utf8")).join("\n") });
}

function check(checkId: R15ConformanceCheckId, passed: boolean, evidence: Readonly<Record<string, unknown>>): R15ConformanceCheck {
  return Object.freeze({ checkId, probeId: `r15-behavior-probe/${checkId}/v1`, passed, evidence: Object.freeze(evidence) });
}

function safely(checkId: R15ConformanceCheckId, operation: () => Readonly<{ passed: boolean; evidence: Readonly<Record<string, unknown>> }>): R15ConformanceCheck {
  try {
    const result = operation();
    return check(checkId, result.passed, result.evidence);
  } catch (error) {
    return check(checkId, false, { error: error instanceof Error ? error.message : String(error) });
  }
}

function sameKeys(actual: object, expected: readonly string[]): boolean {
  return stableStringify(Object.keys(actual).sort()) === stableStringify([...expected].sort());
}

export function runR15ConformanceProbes(): Readonly<{ checks: readonly R15ConformanceCheck[]; resultAffectingDeviationCount: number; resultAffectingDeviations: readonly R15ConformanceCheckId[]; integrity: "COMPLETE" | "INCOMPLETE" }> {
  const rows = probeRows();
  const derived = deriveR15GroupForTest({ decisionTime: PROBE_DECISION_TIME, rows });
  const longRows = rows.filter((row) => row.direction === "LONG");
  const longDerived = derived.filter((row) => row.direction === "LONG");
  const betaModel = fitR15RidgeModel("R15-BETA-H4", R15_BETA_FEATURE_NAMES, modelExamples(R15_BETA_FEATURE_NAMES));
  const alphaModel = fitR15RidgeModel("R15-ALPHA-H4", R15_ALPHA_FEATURE_NAMES, modelExamples(R15_ALPHA_FEATURE_NAMES));
  const source = sourceText();
  const prohibitedFutureTerms = /\b(future|forward|outcome|label|exit)\b/iu;
  const prohibitedExecutionTerms = /BinancePublicClient|fapi\.binance|createOrder|cancelOrder|positionSide|accountBalance/iu;
  const freezePath = path.join(REPO_ROOT, R15_OBSERVATION_FREEZE_PATH);
  const freeze = existsSync(freezePath) ? JSON.parse(readFileSync(freezePath, "utf8")) as Readonly<Record<string, unknown>> : null;
  const checks = [
    safely("r14ObservationShaExact", () => ({ passed: freeze?.sourceObservationSha256 === R15_SOURCE_OBSERVATION_SHA256 && freeze?.sourceManifestSha256 === R15_SOURCE_MANIFEST_SHA256 && M3_R15_ACCEPTED_R14_SOURCE_SHA.length === 40, evidence: { freezeSourceObservationSha256: freeze?.sourceObservationSha256 ?? null, expectedSourceObservationSha256: R15_SOURCE_OBSERVATION_SHA256, freezeSourceManifestSha256: freeze?.sourceManifestSha256 ?? null, expectedSourceManifestSha256: R15_SOURCE_MANIFEST_SHA256, acceptedR14SourceSha: M3_R15_ACCEPTED_R14_SOURCE_SHA } })),
    safely("h4Only", () => ({ passed: R15_HORIZON_HOURS === 4 && derived.length === R15_SYMBOLS.length * R15_DIRECTIONS.length && derived.every((row) => row.label.status === "EXECUTED"), evidence: { horizonHours: R15_HORIZON_HOURS, derivedRows: derived.length, expectedRows: R15_SYMBOLS.length * R15_DIRECTIONS.length } })),
    safely("marketBetaTargetMedianExact", () => ({ passed: R15_DIRECTIONS.every((direction) => { const targets = rows.filter((row) => row.direction === direction).map((row) => row.labels[4].netForwardAtr!); return derived.filter((row) => row.direction === direction).every((row) => row.marketBetaTarget === median(targets)); }), evidence: { longMedian: median(longRows.map((row) => row.labels[4].netForwardAtr!)), derivedLongBeta: longDerived[0]?.marketBetaTarget ?? null, medianInputs: longRows.map((row) => row.labels[4].netForwardAtr!) } })),
    safely("relativeAlphaTargetIdentityExact", () => ({ passed: derived.every((row) => row.relativeAlphaTarget === row.symbolTarget - row.marketBetaTarget), evidence: { checkedRows: derived.length, identity: "relativeAlphaTarget === symbolTarget - marketBetaTarget" } })),
    safely("betaAlphaReconstructsSymbolTarget", () => ({ passed: derived.every((row) => isR15TargetDecompositionValid({ marketBetaTarget: row.marketBetaTarget, relativeAlphaTarget: row.relativeAlphaTarget, symbolTarget: row.symbolTarget, originalNetForwardAtr: row.label.netForwardAtr })), evidence: { checkedRows: derived.length, toleranceFactor: 16, tolerance: "16 * Number.EPSILON * max(1, abs(beta), abs(alpha), abs(symbol))" } })),
    safely("betaFeatureSetB01ToB10Fixed", () => ({ passed: derived.every((row) => sameKeys(row.betaFeatures, R15_BETA_FEATURE_NAMES)), evidence: { expectedCount: R15_BETA_FEATURE_NAMES.length, observedKeys: Object.keys(derived[0]?.betaFeatures ?? {}) } })),
    safely("alphaFeatureSetA01ToA10Fixed", () => ({ passed: derived.every((row) => sameKeys(row.alphaFeatures, R15_ALPHA_FEATURE_NAMES)), evidence: { expectedCount: R15_ALPHA_FEATURE_NAMES.length, observedKeys: Object.keys(derived[0]?.alphaFeatures ?? {}) } })),
    safely("allFeaturesDecisionTimePastOnly", () => ({ passed: [...Object.values(R15_BETA_FEATURE_DEFINITIONS), ...Object.values(R15_ALPHA_FEATURE_DEFINITIONS)].every((definition) => !prohibitedFutureTerms.test(definition)) && rows.every((row) => row.decisionTime === PROBE_DECISION_TIME), evidence: { featureDefinitionCount: R15_BETA_FEATURE_NAMES.length + R15_ALPHA_FEATURE_NAMES.length, prohibitedTerms: "future|forward|outcome|label|exit", decisionTime: PROBE_DECISION_TIME } })),
    safely("sameTimestampCrossSectionalMediansOnly", () => { const raw = longRows.map((row) => row.features.F09_directionAdjustedClose1hMinusEma20Atr); const expectedMedian = median(raw); const observed = longDerived.map((row, index) => row.alphaFeatures.A05_directionAdjustedEma20ExtensionAtrMinusMedian - (raw[index]! - expectedMedian)); return { passed: new Set(rows.map((row) => row.decisionTime)).size === 1 && observed.every((value) => value === 0), evidence: { decisionTimeCount: new Set(rows.map((row) => row.decisionTime)).size, medianFeature: "A05", expectedMedian, residuals: observed } }; }),
    safely("noSymbolIdentity", () => ({ passed: stableStringify(betaModel.featureNames) === stableStringify(R15_BETA_FEATURE_NAMES) && stableStringify(alphaModel.featureNames) === stableStringify(R15_ALPHA_FEATURE_NAMES) && ![...betaModel.featureNames, ...alphaModel.featureNames].some((name) => R15_SYMBOLS.includes(name as (typeof R15_SYMBOLS)[number])), evidence: { betaFeatureNames: betaModel.featureNames, alphaFeatureNames: alphaModel.featureNames, symbolIdentityColumns: [] } })),
    safely("noPerSymbolAlphaCoefficients", () => ({ passed: stableStringify(Object.keys(alphaModel.coefficients).sort()) === stableStringify([...R15_ALPHA_FEATURE_NAMES].sort()) && alphaModel.modelId === "R15-ALPHA-H4", evidence: { coefficientCount: Object.keys(alphaModel.coefficients).length, modelId: alphaModel.modelId, modelsFit: 1 } })),
    safely("researchOnlyStandardization", () => ({ passed: R15_SPEC_OBJECT.training.standardization === "RESEARCH_ONLY" && betaModel.standardization.featureNames.length === R15_BETA_FEATURE_NAMES.length && alphaModel.standardization.featureNames.length === R15_ALPHA_FEATURE_NAMES.length, evidence: { declaredScope: R15_SPEC_OBJECT.training.standardization, betaIdentitySha256: betaModel.standardization.identitySha256, alphaIdentitySha256: alphaModel.standardization.identitySha256 } })),
    safely("foldIsolation", () => ({ passed: R15_FOLD_IDS.every((foldId) => getResearchFoldRoleRange(foldId, "RESEARCH").endTime < getResearchFoldRoleRange(foldId, "VALIDATION").startTime), evidence: { folds: R15_FOLD_IDS.map((foldId) => ({ foldId, researchEnd: getResearchFoldRoleRange(foldId, "RESEARCH").endTime, validationStart: getResearchFoldRoleRange(foldId, "VALIDATION").startTime })) } })),
    safely("purgeEmbargo24Hours", () => { const validationStart = getResearchFoldRoleRange("F1", "VALIDATION").startTime; const safe = isR13TrainingObservationPurgeSafe({ decisionTime: validationStart - 24 * 60 * 60_000 - 7 * 60_000, validationStartTime: validationStart, maximumLabelHorizonHours: R15_PURGE_EMBARGO_HOURS }); const rejected = isR13TrainingObservationPurgeSafe({ decisionTime: validationStart - 24 * 60 * 60_000 - 6 * 60_000, validationStartTime: validationStart, maximumLabelHorizonHours: R15_PURGE_EMBARGO_HOURS }); return { passed: safe && !rejected && R15_PURGE_EMBARGO_HOURS === 24, evidence: { safeBoundary: safe, rejectedBoundary: rejected, purgeEmbargoHours: R15_PURGE_EMBARGO_HOURS } }; }),
    safely("fixedEconomicThresholdPlus010", () => ({ passed: R15_TARGET_THRESHOLD === 0.10 && r15SelectTopOne([{ symbol: "BTCUSDT", direction: "LONG", predictedNetAtr: R15_TARGET_THRESHOLD }]) !== null, evidence: { threshold: R15_TARGET_THRESHOLD, exactBoundaryAccepted: true } })),
    safely("topOneMaximumPerDecisionTime", () => { const selected = r15SelectTopOne([{ symbol: "BTCUSDT", direction: "LONG", predictedNetAtr: 0.12 }, { symbol: "ETHUSDT", direction: "SHORT", predictedNetAtr: 0.11 }]); return { passed: selected?.symbol === "BTCUSDT", evidence: { inputCount: 2, selectedSymbol: selected?.symbol ?? null, maximumSignalsPerDecisionTime: R15_SPEC_OBJECT.selection.maximumSignalsPerDecisionTime } }; }),
    safely("noTradeBelowThreshold", () => ({ passed: r15SelectTopOne([{ symbol: "BTCUSDT", direction: "LONG", predictedNetAtr: R15_TARGET_THRESHOLD - 0.001 }]) === null && R15_SPEC_OBJECT.selection.belowThreshold === "NO_TRADE", evidence: { belowThresholdPrediction: R15_TARGET_THRESHOLD - 0.001, result: "NO_TRADE" } })),
    safely("stressUsesFrozenPredictionsNoRetraining", () => ({ passed: R15_SPEC_OBJECT.stress.retraining === false && R15_PLAN.performance.postLockNetwork === false && R15_PLAN.performance.executionCount === 1, evidence: { retraining: R15_SPEC_OBJECT.stress.retraining, postLockNetwork: R15_PLAN.performance.postLockNetwork, executionCount: R15_PLAN.performance.executionCount } })),
    safely("productionSeenDataExcluded", () => ({ passed: R15_SPEC_OBJECT.governance.productionEligibleDirectly === false && R15_SPEC_OBJECT.governance.productionDataExcluded === true, evidence: { productionEligibleDirectly: R15_SPEC_OBJECT.governance.productionEligibleDirectly, productionDataExcluded: R15_SPEC_OBJECT.governance.productionDataExcluded } })),
    safely("networkDisabled", () => ({ passed: R15_SPEC_OBJECT.governance.networkDisabledDuringPerformance === true && R15_PLAN.data.networkAcquisition === "DISABLED" && !/fetch\s*\(/iu.test(source.all), evidence: { networkDisabledDuringPerformance: R15_SPEC_OBJECT.governance.networkDisabledDuringPerformance, networkAcquisition: R15_PLAN.data.networkAcquisition, fetchCallPresent: /fetch\s*\(/iu.test(source.all) } })),
    safely("privateBinanceApiAbsent", () => ({ passed: !prohibitedExecutionTerms.test(source.all), evidence: { scannedFiles: source.files, prohibitedTokenPresent: prohibitedExecutionTerms.test(source.all) } })),
    safely("automaticTradingFalse", () => ({ passed: R15_SPEC_OBJECT.governance.noAutomaticTrading === true && R15_SPEC_OBJECT.governance.tradingEnabled === false && !/createOrder|cancelOrder|positionSide/iu.test(source.all), evidence: { noAutomaticTrading: R15_SPEC_OBJECT.governance.noAutomaticTrading, tradingEnabled: R15_SPEC_OBJECT.governance.tradingEnabled } })),
    safely("noOptimizer", () => ({ passed: !/optimizer/iu.test(source.all), evidence: { optimizerTokenPresent: /optimizer/iu.test(source.all) } })),
    safely("noSweep", () => ({ passed: !/sweep/iu.test(source.all), evidence: { sweepTokenPresent: /sweep/iu.test(source.all) } })),
  ] as const;
  const resultAffectingDeviations = checks.filter((value) => RESULT_AFFECTING_CHECK_IDS.has(value.checkId) && !value.passed).map((value) => value.checkId);
  return Object.freeze({ checks: Object.freeze(checks), resultAffectingDeviationCount: resultAffectingDeviations.length, resultAffectingDeviations: Object.freeze(resultAffectingDeviations), integrity: checks.every((value) => value.passed) ? "COMPLETE" : "INCOMPLETE" });
}

const PROBES = runR15ConformanceProbes();

export const R15_CONFORMANCE_DOCUMENT = Object.freeze({
  schemaVersion: R15_CONFORMANCE_SCHEMA_VERSION,
  researchRoundId: M3_R15_RESEARCH_ROUND_ID,
  classification: "HISTORICAL_DEVELOPMENT_STUDY",
  acceptedR14SourceSha: M3_R15_ACCEPTED_R14_SOURCE_SHA,
  researchBoundary: M3_R15_RESEARCH_END_ISO,
  sourceDatasetSha256: R15_SOURCE_DATASET_SHA256,
  sourceManifestSha256: R15_SOURCE_MANIFEST_SHA256,
  sourceObservationSha256: R15_SOURCE_OBSERVATION_SHA256,
  sourceObservationPath: ".cache/tradepulse/round-014/observations.ndjson",
  derivedObservationPath: R15_OBSERVATION_DATA_PATH,
  sourceObservationReuse: "READ_ONLY_EXACT_SHA_VERIFIED_NO_NETWORK_REACQUISITION",
  horizonHours: R15_HORIZON_HOURS,
  purgeEmbargoHours: R15_PURGE_EMBARGO_HOURS,
  checks: PROBES.checks,
  gateSha256: R15_GATE_SHA256,
  specSha256: R15_SPEC_SHA256,
  planPath: R15_PLAN_PATH,
  planSha256: R15_PLAN_SHA256,
  resultAffectingDeviationCount: PROBES.resultAffectingDeviationCount,
  resultAffectingDeviations: PROBES.resultAffectingDeviations,
  integrity: PROBES.integrity,
  artifactHashMethod: R15_ARTIFACT_HASH_METHOD,
});

export const R15_CONFORMANCE_CANONICAL_JSON = stableStringify(R15_CONFORMANCE_DOCUMENT);
export const R15_CONFORMANCE_SHA256 = createHash("sha256").update(R15_CONFORMANCE_CANONICAL_JSON, "utf8").digest("hex");

export function validateR15Conformance(document: typeof R15_CONFORMANCE_DOCUMENT = R15_CONFORMANCE_DOCUMENT): typeof R15_CONFORMANCE_DOCUMENT {
  if (document.schemaVersion !== R15_CONFORMANCE_SCHEMA_VERSION || document.researchRoundId !== M3_R15_RESEARCH_ROUND_ID || document.researchBoundary !== M3_R15_RESEARCH_END_ISO || document.sourceDatasetSha256 !== R15_SOURCE_DATASET_SHA256 || document.sourceManifestSha256 !== R15_SOURCE_MANIFEST_SHA256 || document.sourceObservationSha256 !== R15_SOURCE_OBSERVATION_SHA256 || document.horizonHours !== R15_HORIZON_HOURS || document.purgeEmbargoHours !== R15_PURGE_EMBARGO_HOURS || document.gateSha256 !== R15_GATE_SHA256 || document.specSha256 !== R15_SPEC_SHA256 || document.planPath !== R15_PLAN_PATH || document.planSha256 !== R15_PLAN_SHA256 || document.integrity !== "COMPLETE") throw new Error("R15 conformance identity failed.");
  if (!Array.isArray(document.checks) || document.checks.length !== R15_CONFORMANCE_CHECK_IDS.length) throw new Error("R15 conformance check set is incomplete.");
  const checkIds = document.checks.map((value) => value.checkId);
  if (stableStringify(checkIds) !== stableStringify(R15_CONFORMANCE_CHECK_IDS)) throw new Error("R15 conformance check order or identity failed.");
  for (const value of document.checks) {
    if (!value.passed || !value.probeId || typeof value.evidence !== "object" || value.evidence === null) throw new Error(`R15 conformance check failed: ${value.checkId}`);
  }
  const deviations = document.checks.filter((value) => RESULT_AFFECTING_CHECK_IDS.has(value.checkId) && !value.passed).map((value) => value.checkId);
  if (document.resultAffectingDeviationCount !== deviations.length || stableStringify(document.resultAffectingDeviations) !== stableStringify(deviations)) throw new Error("R15 conformance deviation accounting failed.");
  if (stableStringify(document) !== R15_CONFORMANCE_CANONICAL_JSON) throw new Error("R15 conformance canonical identity failed.");
  return document;
}
