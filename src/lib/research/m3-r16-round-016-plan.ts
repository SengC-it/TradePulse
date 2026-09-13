import { createHash } from "node:crypto";

import { R16_ARTIFACT_HASH_METHOD, R16_DEFAULT_CACHE_DIRECTORY, R16_HORIZON_HOURS, R16_OBSERVATION_DATA_PATH, R16_PURGE_EMBARGO_HOURS, R16_RESEARCH_RANGE, R16_SPEC_SHA256, R16_SYMBOLS, M3_R16_RESEARCH_ROUND_ID } from "./m3-r16-round-016-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R16_PLAN_SCHEMA_VERSION = "m3-r16-round-016-plan-001" as const;

export const R16_PLAN = Object.freeze({
  schemaVersion: R16_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R16_RESEARCH_ROUND_ID,
  classification: "HISTORICAL_DEVELOPMENT_INFORMATION_STUDY",
  specSha256: R16_SPEC_SHA256,
  researchRange: R16_RESEARCH_RANGE,
  symbols: R16_SYMBOLS,
  horizonHours: R16_HORIZON_HOURS,
  purgeEmbargoHours: R16_PURGE_EMBARGO_HOURS,
  source: Object.freeze({
    officialBaseUrl: "https://data.binance.vision/data/futures/um",
    families: Object.freeze(["OPEN_INTEREST", "MARK_INDEX_BASIS", "TAKER_FLOW_PERSISTENCE"]),
    archiveOnly: true,
    historicalRestBackfill: "DISABLED",
    sourceDatabase: "DISABLED",
  }),
  acquisition: Object.freeze({
    cacheDirectory: R16_DEFAULT_CACHE_DIRECTORY,
    environmentOverride: "TRADEPULSE_R16_CACHE",
    boundedConcurrency: 8,
    maxAttempts: 5,
    atomicCheckpoint: true,
    resume: true,
    rawOnlyUnderCache: true,
  }),
  materialization: Object.freeze({
    observationDataPath: R16_OBSERVATION_DATA_PATH,
    globalMask: "R16_VALID_DECISION_TIME_MASK",
    controlsAndMicroUseSameObservationIdentity: true,
    noPredictions: true,
    noMetrics: true,
  }),
  performance: Object.freeze({
    models: Object.freeze(["R16-BETA-CONTROL", "R16-BETA-MICRO", "R16-ALPHA-CONTROL", "R16-ALPHA-MICRO"]),
    ridgeLambda: 10,
    standardization: "RESEARCH_ONLY",
    validation: "PREDICT_ONLY_NO_REFIT_NO_THRESHOLD_UPDATE",
    network: "DISABLED_AFTER_LOCK",
    executionCount: 1,
    continuation: "SAME_EXECUTION_ID_ONLY",
  }),
  publication: Object.freeze({ hashMethod: R16_ARTIFACT_HASH_METHOD, summaryLast: true, selectionAfterMetrics: true }),
  governance: Object.freeze({ baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED", forwardShadowEligible: false, automaticTrading: false, productionUnchanged: true }),
});

export const R16_PLAN_CANONICAL_JSON = stableStringify(R16_PLAN);
export const R16_PLAN_SHA256 = createHash("sha256").update(R16_PLAN_CANONICAL_JSON, "utf8").digest("hex");

export function validateR16Plan(plan: typeof R16_PLAN = R16_PLAN): typeof R16_PLAN {
  if (stableStringify(plan) !== R16_PLAN_CANONICAL_JSON) throw new Error("R16 plan canonical identity failed.");
  if (plan.specSha256 !== R16_SPEC_SHA256 || plan.researchRoundId !== M3_R16_RESEARCH_ROUND_ID || plan.performance.executionCount !== 1 || plan.performance.network !== "DISABLED_AFTER_LOCK") throw new Error("R16 plan provenance or performance boundary failed.");
  if (plan.source.archiveOnly !== true || plan.source.historicalRestBackfill !== "DISABLED" || plan.source.sourceDatabase !== "DISABLED") throw new Error("R16 plan source policy failed.");
  return plan;
}
