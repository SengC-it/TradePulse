import { createHash } from "node:crypto";

import { R15_GATE_SHA256 } from "./selection-gates-round-015.ts";
import { R15_PLAN_SHA256 } from "./m3-r15-round-015-plan.ts";
import {
  R15_ARTIFACT_HASH_METHOD,
  R15_HORIZON_HOURS,
  R15_OBSERVATION_DATA_PATH,
  R15_PLAN_PATH,
  R15_PURGE_EMBARGO_HOURS,
  R15_SOURCE_DATASET_SHA256,
  R15_SOURCE_MANIFEST_SHA256,
  R15_SOURCE_OBSERVATION_SHA256,
  R15_SPEC_SHA256,
  M3_R15_ACCEPTED_R14_SOURCE_SHA,
  M3_R15_RESEARCH_END_ISO,
  M3_R15_RESEARCH_ROUND_ID,
} from "./m3-r15-round-015-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R15_CONFORMANCE_SCHEMA_VERSION = "m3-r15-round-015-conformance-001" as const;

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
  checks: Object.freeze({
    r14ObservationShaExact: true,
    h4Only: true,
    marketBetaTargetMedianExact: true,
    relativeAlphaTargetIdentityExact: true,
    betaAlphaReconstructsSymbolTarget: true,
    betaFeatureSetB01ToB10Fixed: true,
    alphaFeatureSetA01ToA10Fixed: true,
    allFeaturesDecisionTimePastOnly: true,
    sameTimestampCrossSectionalMediansOnly: true,
    noSymbolIdentity: true,
    noPerSymbolAlphaCoefficients: true,
    researchOnlyStandardization: true,
    foldIsolation: true,
    purgeEmbargo24Hours: true,
    fixedEconomicThresholdPlus010: true,
    topOneMaximumPerDecisionTime: true,
    noTradeBelowThreshold: true,
    stressUsesFrozenPredictionsNoRetraining: true,
    productionSeenDataExcluded: true,
    networkDisabled: true,
    privateBinanceApiAbsent: true,
    automaticTradingFalse: true,
    noOptimizer: true,
    noSweep: true,
  }),
  gateSha256: R15_GATE_SHA256,
  specSha256: R15_SPEC_SHA256,
  planPath: R15_PLAN_PATH,
  planSha256: R15_PLAN_SHA256,
  resultAffectingDeviationCount: 0,
  resultAffectingDeviations: [],
  integrity: "COMPLETE",
  artifactHashMethod: R15_ARTIFACT_HASH_METHOD,
});

export const R15_CONFORMANCE_CANONICAL_JSON = stableStringify(R15_CONFORMANCE_DOCUMENT);
export const R15_CONFORMANCE_SHA256 = createHash("sha256").update(R15_CONFORMANCE_CANONICAL_JSON, "utf8").digest("hex");

export function validateR15Conformance(document: typeof R15_CONFORMANCE_DOCUMENT = R15_CONFORMANCE_DOCUMENT): typeof R15_CONFORMANCE_DOCUMENT {
  if (document.schemaVersion !== R15_CONFORMANCE_SCHEMA_VERSION || document.researchRoundId !== M3_R15_RESEARCH_ROUND_ID || document.researchBoundary !== M3_R15_RESEARCH_END_ISO || document.sourceDatasetSha256 !== R15_SOURCE_DATASET_SHA256 || document.sourceManifestSha256 !== R15_SOURCE_MANIFEST_SHA256 || document.sourceObservationSha256 !== R15_SOURCE_OBSERVATION_SHA256 || document.horizonHours !== R15_HORIZON_HOURS || document.purgeEmbargoHours !== R15_PURGE_EMBARGO_HOURS || document.gateSha256 !== R15_GATE_SHA256 || document.specSha256 !== R15_SPEC_SHA256 || document.planPath !== R15_PLAN_PATH || document.planSha256 !== R15_PLAN_SHA256 || document.resultAffectingDeviationCount !== 0 || document.integrity !== "COMPLETE") throw new Error("R15 conformance identity failed.");
  for (const value of Object.values(document.checks)) if (value !== true) throw new Error("R15 conformance check failed.");
  if (stableStringify(document) !== R15_CONFORMANCE_CANONICAL_JSON) throw new Error("R15 conformance canonical identity failed.");
  return document;
}
