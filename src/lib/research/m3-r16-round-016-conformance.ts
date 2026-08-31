import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { getResearchFoldRoleRange } from "./folds.ts";
import { R16_PLAN, R16_PLAN_SHA256 } from "./m3-r16-round-016-plan.ts";
import { R16_CONFORMANCE_PATH, R16_OBSERVATION_DATA_PATH, R16_OBSERVATION_FREEZE_PATH, R16_PLAN_PATH, R16_SPEC_OBJECT, R16_SPEC_SHA256, M3_R16_SOURCE_MANIFEST_SHA256, M3_R16_SOURCE_R14_OBSERVATION_SHA256, M3_R16_SOURCE_R15_OBSERVATION_SHA256, R16_PURGE_EMBARGO_HOURS, R16_BETA_CONTROL_FEATURE_NAMES, R16_BETA_MICRO_FEATURE_NAMES, R16_ALPHA_CONTROL_FEATURE_NAMES, R16_RIDGE_LAMBDA, R16_SYMBOLS, R16_FOLD_IDS, M3_R16_ACCEPTED_R15_SOURCE_SHA } from "./m3-r16-round-016-protocol.ts";
import type { ResearchSymbol } from "../config/constants.ts";
import { hashR16File, locateR16R15ObservationFile, readR16ObservationFreeze } from "./m3-r16-round-016-data.ts";
import { readR16AcquisitionManifest } from "./m3-r16-round-016-archives.ts";
import { stableStringify } from "./utils.ts";

export const R16_CONFORMANCE_SCHEMA_VERSION = "m3-r16-round-016-conformance-001" as const;

export const R16_CONFORMANCE_CHECK_IDS = Object.freeze([
  "sourceR15ObservationShaVerified",
  "microArchiveChecksumsVerified",
  "metricsSchemaVerified",
  "metricsCadenceVerified",
  "markIndexPairingVerified",
  "noInterpolation",
  "noHistoricalRestBackfill",
  "commonMaskAppliedToControlAndMicro",
  "controlMicroObservationIdentityEqual",
  "oiFeatureFormulasVerified",
  "basisFeatureFormulasVerified",
  "takerFeatureFormulasVerified",
  "crossSectionalMedianFeaturesVerified",
  "noSymbolIdentity",
  "researchOnlyStandardization",
  "foldIsolation",
  "purge24h",
  "h4TargetsUnchanged",
  "controlFeatureIdentityMatchesR15",
  "ridgeLambda10",
  "noSweep",
  "noOptimizer",
  "productionSeenDataExcluded",
  "networkDisabledDuringPerformance",
  "privateBinanceApiAbsent",
  "automaticTradingFalse",
] as const);

export type R16ConformanceCheckId = (typeof R16_CONFORMANCE_CHECK_IDS)[number];
export type R16ConformanceCheck = Readonly<{ checkId: R16ConformanceCheckId; passed: boolean; evidence: Readonly<Record<string, unknown>> }>;
export type R16ConformanceDocument = Readonly<{
  schemaVersion: typeof R16_CONFORMANCE_SCHEMA_VERSION;
  researchRoundId: "baseline-002-research-round-016";
  classification: "HISTORICAL_DEVELOPMENT_INFORMATION_STUDY";
  acceptedR15SourceSha: typeof M3_R16_ACCEPTED_R15_SOURCE_SHA;
  researchBoundary: "2026-08-15T23:59:59.999Z";
  sourceManifestSha256: typeof M3_R16_SOURCE_MANIFEST_SHA256;
  sourceR14ObservationSha256: typeof M3_R16_SOURCE_R14_OBSERVATION_SHA256;
  sourceR15ObservationSha256: typeof M3_R16_SOURCE_R15_OBSERVATION_SHA256;
  specSha256: typeof R16_SPEC_SHA256;
  planPath: typeof R16_PLAN_PATH;
  planSha256: typeof R16_PLAN_SHA256;
  observationDataPath: typeof R16_OBSERVATION_DATA_PATH;
  observationFreezePath: typeof R16_OBSERVATION_FREEZE_PATH;
  checks: readonly R16ConformanceCheck[];
  resultAffectingDeviationCount: number;
  resultAffectingDeviations: readonly R16ConformanceCheckId[];
  integrity: "COMPLETE" | "INCOMPLETE";
  artifactHashMethod: "SHA256_EXACT_COMMITTED_UTF8_BYTES";
}>;

const resultAffecting = new Set<R16ConformanceCheckId>(R16_CONFORMANCE_CHECK_IDS);
function check(checkId: R16ConformanceCheckId, passed: boolean, evidence: Readonly<Record<string, unknown>>): R16ConformanceCheck { return Object.freeze({ checkId, passed, evidence }); }
function sourceText(root: string): string { const files = ["src/lib/research/m3-r16-round-016-protocol.ts", "src/lib/research/m3-r16-round-016-data.ts", "src/lib/research/m3-r16-round-016-archives.ts", "src/lib/research/m3-r16-round-016-performance.ts", "src/lib/research/m3-r16-round-016-plan.ts"]; return files.map((file) => existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), "utf8") : "").join("\n"); }

export async function buildR16Conformance(root = process.cwd()): Promise<R16ConformanceDocument> {
  const freeze = existsSync(path.join(root, R16_OBSERVATION_FREEZE_PATH)) ? readR16ObservationFreeze(root) : null;
  const acquisition = readR16AcquisitionManifest(path.resolve(root, ".cache", "tradepulse", "round-016"));
  const r15Path = (() => { try { return locateR16R15ObservationFile(root); } catch { return null; } })();
  const text = sourceText(root);
  const checks: R16ConformanceCheck[] = [];
  let sourceR15Verified = false;
  if (r15Path) sourceR15Verified = (await hashR16File(r15Path)) === M3_R16_SOURCE_R15_OBSERVATION_SHA256;
  checks.push(check("sourceR15ObservationShaVerified", sourceR15Verified, { pathPresent: r15Path !== null, sha256: sourceR15Verified ? M3_R16_SOURCE_R15_OBSERVATION_SHA256 : null, expectedSha256: M3_R16_SOURCE_R15_OBSERVATION_SHA256 }));
  checks.push(check("microArchiveChecksumsVerified", acquisition?.completed === true && acquisition.officialChecksumsVerified === true, { acquisitionPresent: acquisition !== null, completed: acquisition?.completed ?? false, officialChecksumsVerified: acquisition?.officialChecksumsVerified ?? false }));
  checks.push(check("metricsSchemaVerified", acquisition?.metricsSchemaVerified === true, { value: acquisition?.metricsSchemaVerified ?? false }));
  checks.push(check("metricsCadenceVerified", acquisition?.metricsCadenceVerified === true, { value: acquisition?.metricsCadenceVerified ?? false, cadence: acquisition ? Object.values(acquisition.detectedCadenceBySourcePeriod).filter((value): value is number => value !== null) : [] }));
  checks.push(check("markIndexPairingVerified", acquisition?.markIndexPairingVerified === true, { value: acquisition?.markIndexPairingVerified ?? false }));
  checks.push(check("noInterpolation", R16_SPEC_OBJECT.data.interpolation === false && !/interpolat(?:e|ion)\s*\(/iu.test(text), { declared: R16_SPEC_OBJECT.data.interpolation, executableInterpolationCall: /interpolat(?:e|ion)\s*\(/iu.test(text) }));
  checks.push(check("noHistoricalRestBackfill", R16_SPEC_OBJECT.data.restHistoricalBackfill === false && R16_PLAN.source.historicalRestBackfill === "DISABLED" && R16_PLAN.source.sourceDatabase === "DISABLED", { restHistoricalBackfill: R16_SPEC_OBJECT.data.restHistoricalBackfill, plan: R16_PLAN.source.historicalRestBackfill }));
  checks.push(check("commonMaskAppliedToControlAndMicro", freeze?.globalMaskSha256.length === 64 && freeze.observationDataPath === R16_OBSERVATION_DATA_PATH, { maskSha256: freeze?.globalMaskSha256 ?? null, observationDataPath: freeze?.observationDataPath ?? null }));
  checks.push(check("controlMicroObservationIdentityEqual", freeze?.observationCount !== undefined && freeze.observationCount % (R16_SYMBOLS.length * 2) === 0, { observationCount: freeze?.observationCount ?? null, rowsPerTime: R16_SYMBOLS.length * 2 }));
  checks.push(check("oiFeatureFormulasVerified", R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB01_btcOiChange1h.includes("ln(BTC OI_QTY_t") && R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB03_btcOiChange12h.includes("12h"), { formulas: [R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB01_btcOiChange1h, R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB03_btcOiChange12h] }));
  checks.push(check("basisFeatureFormulasVerified", R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB06_directionAdjustedBtcBasisChange1h.includes("basisNowBps - basis1hAgoBps") && R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB07_directionAdjustedBtcBasisChange4h.includes("basis4hAgoBps"), { formulas: [R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB06_directionAdjustedBtcBasisChange1h, R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB07_directionAdjustedBtcBasisChange4h] }));
  checks.push(check("takerFeatureFormulasVerified", R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB08_directionAdjustedBtcTaker1h.includes("exact prior 1h") && R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB10_directionAdjustedBtcTakerAcceleration.includes("immediatelyPriorTaker1h"), { formulas: [R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB08_directionAdjustedBtcTaker1h, R16_SPEC_OBJECT.beta.microFeatureDefinitions.MB10_directionAdjustedBtcTakerAcceleration] }));
  checks.push(check("crossSectionalMedianFeaturesVerified", R16_SPEC_OBJECT.alpha.microFeatureDefinitions.MA01_oiChange1hMinusMedian.includes("five-symbol median") || R16_SPEC_OBJECT.alpha.microFeatureDefinitions.MA01_oiChange1hMinusMedian.includes("same-time"), { alphaDefinitions: R16_SPEC_OBJECT.alpha.microFeatureDefinitions }));
  checks.push(check("noSymbolIdentity", R16_SPEC_OBJECT.model.noSymbolIdentity === true && !R16_BETA_MICRO_FEATURE_NAMES.some((name) => R16_SYMBOLS.includes(name as ResearchSymbol)), { noSymbolIdentity: R16_SPEC_OBJECT.model.noSymbolIdentity, featureCount: R16_BETA_MICRO_FEATURE_NAMES.length }));
  checks.push(check("researchOnlyStandardization", R16_SPEC_OBJECT.model.standardization === "RESEARCH_ONLY" && R16_PLAN.performance.standardization === "RESEARCH_ONLY", { model: R16_SPEC_OBJECT.model.standardization, plan: R16_PLAN.performance.standardization }));
  checks.push(check("foldIsolation", R16_FOLD_IDS.every((foldId) => getResearchFoldRoleRange(foldId, "RESEARCH").endTime < getResearchFoldRoleRange(foldId, "VALIDATION").startTime), { folds: R16_FOLD_IDS }));
  checks.push(check("purge24h", R16_PURGE_EMBARGO_HOURS === 24 && R16_PLAN.purgeEmbargoHours === 24, { purgeEmbargoHours: R16_PURGE_EMBARGO_HOURS }));
  checks.push(check("h4TargetsUnchanged", R16_SPEC_OBJECT.target.source === "EXACT_R15_H4_TARGETS" && R16_SPEC_OBJECT.horizonHours === 4, { source: R16_SPEC_OBJECT.target.source, horizonHours: R16_SPEC_OBJECT.horizonHours }));
  checks.push(check("controlFeatureIdentityMatchesR15", stableStringify(R16_BETA_CONTROL_FEATURE_NAMES) === stableStringify(R16_SPEC_OBJECT.beta.controlFeatureNames) && stableStringify(R16_ALPHA_CONTROL_FEATURE_NAMES) === stableStringify(R16_SPEC_OBJECT.alpha.controlFeatureNames), { betaCount: R16_BETA_CONTROL_FEATURE_NAMES.length, alphaCount: R16_ALPHA_CONTROL_FEATURE_NAMES.length }));
  checks.push(check("ridgeLambda10", R16_RIDGE_LAMBDA === 10 && R16_PLAN.performance.ridgeLambda === 10, { lambda: R16_RIDGE_LAMBDA }));
  checks.push(check("noSweep", R16_SPEC_OBJECT.model.noSweep === true && R16_PLAN.performance.models.length === 4, { noSweep: R16_SPEC_OBJECT.model.noSweep, modelCount: R16_PLAN.performance.models.length }));
  checks.push(check("noOptimizer", R16_SPEC_OBJECT.model.noOptimizer === true && !/optimizer/iu.test(text.replace(/noOptimizer/gu, "")), { noOptimizer: R16_SPEC_OBJECT.model.noOptimizer }));
  checks.push(check("productionSeenDataExcluded", R16_SPEC_OBJECT.governance.productionDataExcluded === true && R16_SPEC_OBJECT.governance.productionSeenDataClassification === "SEEN_HYPOTHESIS_GENERATING_DIAGNOSTIC_ONLY", { governance: R16_SPEC_OBJECT.governance }));
  checks.push(check("networkDisabledDuringPerformance", R16_SPEC_OBJECT.governance.networkDisabledDuringPerformance === true && R16_PLAN.performance.network === "DISABLED_AFTER_LOCK" && !/fetch\s*\(/iu.test(readFileSync(path.join(root, "src/lib/research/m3-r16-round-016-performance.ts"), "utf8")), { network: R16_PLAN.performance.network }));
  checks.push(check("privateBinanceApiAbsent", R16_SPEC_OBJECT.governance.privateBinanceApi === false && !/apiKey|secretKey|createOrder|cancelOrder/iu.test(text), { privateBinanceApi: R16_SPEC_OBJECT.governance.privateBinanceApi }));
  checks.push(check("automaticTradingFalse", R16_SPEC_OBJECT.governance.automaticTrading === false && R16_SPEC_OBJECT.governance.tradingEnabled === false, { automaticTrading: R16_SPEC_OBJECT.governance.automaticTrading, tradingEnabled: R16_SPEC_OBJECT.governance.tradingEnabled }));
  const deviations = checks.filter((value) => resultAffecting.has(value.checkId) && !value.passed).map((value) => value.checkId);
  return Object.freeze({ schemaVersion: R16_CONFORMANCE_SCHEMA_VERSION, researchRoundId: "baseline-002-research-round-016", classification: "HISTORICAL_DEVELOPMENT_INFORMATION_STUDY", acceptedR15SourceSha: M3_R16_ACCEPTED_R15_SOURCE_SHA, researchBoundary: "2026-08-15T23:59:59.999Z", sourceManifestSha256: M3_R16_SOURCE_MANIFEST_SHA256, sourceR14ObservationSha256: M3_R16_SOURCE_R14_OBSERVATION_SHA256, sourceR15ObservationSha256: M3_R16_SOURCE_R15_OBSERVATION_SHA256, specSha256: R16_SPEC_SHA256, planPath: R16_PLAN_PATH, planSha256: R16_PLAN_SHA256, observationDataPath: R16_OBSERVATION_DATA_PATH, observationFreezePath: R16_OBSERVATION_FREEZE_PATH, checks: Object.freeze(checks), resultAffectingDeviationCount: deviations.length, resultAffectingDeviations: Object.freeze(deviations), integrity: checks.every((value) => value.passed) ? "COMPLETE" : "INCOMPLETE", artifactHashMethod: "SHA256_EXACT_COMMITTED_UTF8_BYTES" });
}

export function validateR16Conformance(document: R16ConformanceDocument): R16ConformanceDocument {
  if (document.schemaVersion !== R16_CONFORMANCE_SCHEMA_VERSION || document.researchRoundId !== "baseline-002-research-round-016" || document.classification !== "HISTORICAL_DEVELOPMENT_INFORMATION_STUDY" || document.specSha256 !== R16_SPEC_SHA256 || document.planSha256 !== R16_PLAN_SHA256 || document.observationDataPath !== R16_OBSERVATION_DATA_PATH || document.integrity !== "COMPLETE") throw new Error("R16 conformance identity or integrity failed.");
  if (stableStringify(document.checks.map((value) => value.checkId)) !== stableStringify(R16_CONFORMANCE_CHECK_IDS)) throw new Error("R16 conformance check identity failed.");
  const deviations = document.checks.filter((value) => !value.passed).map((value) => value.checkId);
  if (document.resultAffectingDeviationCount !== deviations.length || stableStringify(document.resultAffectingDeviations) !== stableStringify(deviations)) throw new Error("R16 conformance deviation accounting failed.");
  return document;
}

export async function readR16Conformance(root = process.cwd()): Promise<R16ConformanceDocument> { const filePath = path.join(root, R16_CONFORMANCE_PATH); if (!existsSync(filePath)) throw new Error(`R16 conformance is missing: ${filePath}`); const document = JSON.parse(readFileSync(filePath, "utf8")) as R16ConformanceDocument; return validateR16Conformance(document); }
