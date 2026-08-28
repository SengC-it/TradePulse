import { createHash } from "node:crypto";

import { RESEARCH_FOLDS } from "./folds.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R10_BASE_SOURCE_SHA,
  M3_R10_CANDIDATE_IDS,
  M3_R10_CONTROL_ID,
  M3_R10_NO_CANDIDATE_OUTCOME,
  M3_R10_PERFORMANCE_LOCK,
  M3_R10_POLICY_VERSION,
  M3_R10_PROTOCOL_VERSION,
  M3_R10_RESEARCH_END_ISO,
  M3_R10_RESEARCH_RANGE,
  M3_R10_RESEARCH_ROUND_ID,
  R10_CANDIDATE_REGISTRY,
  R10_DATA_CONTRACT,
  R10_EXECUTION_CONTRACT,
  R10_MODEL_CONTRACT,
  R10_RISK_GEOMETRY_CONTRACT,
  R10_SYMBOLS,
} from "./m3-r10-round-010-protocol.ts";
import { R10_MACHINE_RECORD, R10_SELECTION_GATE_SHA256, validateR10MachineRecord } from "./selection-gates-round-010.ts";

export const M3_R10_PLAN_SCHEMA_VERSION = "m3-r10-round-010-plan-001" as const;
export const R10_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;

export const R10_PLAN = deepFreeze({
  schemaVersion: M3_R10_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R10_RESEARCH_ROUND_ID,
  sourceSha: M3_R10_BASE_SOURCE_SHA,
  freezeSourceSha: M3_R10_BASE_SOURCE_SHA,
  dataClassification: R10_DATA_CLASSIFICATION,
  researchUniverse: { ...M3_R10_RESEARCH_RANGE, startIso: "2023-01-01T00:00:00.000Z", endIso: M3_R10_RESEARCH_END_ISO },
  symbols: R10_SYMBOLS,
  folds: RESEARCH_FOLDS,
  control: { candidateId: M3_R10_CONTROL_ID, strategyVersion: "baseline-001", backtestPolicyVersion: M3_R10_POLICY_VERSION, runExactlyOnce: true, stream: "BASELINE_FORMAL_STREAM" },
  opportunityStreams: {
    baselineFormal: { id: "BASELINE_FORMAL_STREAM", source: "exact baseline-001 formal output", consumers: [M3_R10_CONTROL_ID, "R10-R1-REGIME-EXPECTANCY-ROUTER"] },
    baselinePreScoreEligible: { id: "BASELINE_PRE_SCORE_ELIGIBLE_STREAM", source: "baseline geometry/pre-score eligibility without total score >= 70 filter", consumers: ["R10-S1-CALIBRATED-SCORE-V2"] },
    newEntryEvent: { id: "NEW_ENTRY_EVENT_STREAM", source: "direct closed-candle E1/E2 event generation", consumers: ["R10-E1-PULLBACK-RECLAIM", "R10-E2-BREAKOUT-RETEST", "R10-C1-RECLAIM-CALIBRATED-SCORE-V2"] },
  },
  candidateRegistry: R10_CANDIDATE_REGISTRY,
  candidateIds: M3_R10_CANDIDATE_IDS,
  protocol: { version: M3_R10_PROTOCOL_VERSION, closedCandleOnly: true, sourceIdentity: M3_R10_BASE_SOURCE_SHA },
  model: R10_MODEL_CONTRACT,
  dataContract: R10_DATA_CONTRACT,
  execution: R10_EXECUTION_CONTRACT,
  riskGeometry: R10_RISK_GEOMETRY_CONTRACT,
  settlement: {
    policy: "bt-policy-003",
    control: "BASELINE_FORMAL_STREAM_USES_EXISTING_BASELINE_SETTLEMENT",
    event: "E1_E2_C1_EACH_USE_OWN_NEXT_CANONICAL_1H_ENTRY_AND_CANDIDATE_LOCAL_SETTLEMENT",
    intrabar: "UNION_OF_CONTROL_PRE_SCORE_E1_E2_DEPENDENCIES_DECLARED_BEFORE_FREEZE",
  },
  gate: { path: "src/lib/research/selection-gates-round-010.ts", sha256: R10_SELECTION_GATE_SHA256, semantics: "ALL_APPLICABLE_GATES_CONJUNCTIVE" },
  selection: { definitions: R10_MACHINE_RECORD.definitions.selectionAlgorithm, zeroEligibleOutcome: M3_R10_NO_CANDIDATE_OUTCOME },
  performance: { status: "NOT_GENERATED", authorization: "NOT_AUTHORIZED", executionSourceSha: null, lock: M3_R10_PERFORMANCE_LOCK },
  acquisition: { coarseData: "REUSE_ONLY_IF_ROUND_006_CACHE_IDENTITY_AND_POLICY_VALIDATE", intrabar: "DECLARE_UNION_OF_ALL_FROZEN_CONSUMERS_BEFORE_DATASET_FREEZE;NO_POST_LOCK_FETCH", cacheSchema: "m3-r6-round-006-page-cache-001" },
  governance: { noPrivateApi: true, noAutomaticTrading: true, noOptimizer: true, noSweep: true, noPostResultCandidateReplacement: true, validationNeverFitsOrTunes: true, round008NotUsedForTuning: true },
  status: { baseline002Status: "NOT_FROZEN", m3R10Status: "FROZEN_PENDING_ACCEPTANCE", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" },
});

export const R10_PLAN_CANONICAL_JSON = stableStringify(R10_PLAN);
export const R10_PLAN_SHA256 = createHash("sha256").update(R10_PLAN_CANONICAL_JSON, "utf8").digest("hex");

export function validateR10Plan(plan: typeof R10_PLAN = R10_PLAN): typeof R10_PLAN {
  if (plan.schemaVersion !== M3_R10_PLAN_SCHEMA_VERSION || plan.researchRoundId !== M3_R10_RESEARCH_ROUND_ID || plan.sourceSha !== M3_R10_BASE_SOURCE_SHA || plan.freezeSourceSha !== M3_R10_BASE_SOURCE_SHA) throw new Error("R10 Plan provenance mismatch.");
  if (plan.dataClassification !== R10_DATA_CLASSIFICATION || stableStringify(plan.symbols) !== stableStringify(R10_SYMBOLS) || stableStringify(plan.folds) !== stableStringify(RESEARCH_FOLDS)) throw new Error("R10 Plan universe mismatch.");
  if (stableStringify(plan.candidateIds) !== stableStringify(M3_R10_CANDIDATE_IDS) || stableStringify(plan.candidateRegistry) !== stableStringify(R10_CANDIDATE_REGISTRY)) throw new Error("R10 Plan candidate registry changed.");
  if (stableStringify(plan.riskGeometry) !== stableStringify(R10_RISK_GEOMETRY_CONTRACT)) throw new Error("R10 Plan risk geometry changed.");
  if (plan.control.candidateId !== M3_R10_CONTROL_ID || plan.control.backtestPolicyVersion !== M3_R10_POLICY_VERSION || plan.performance.executionSourceSha !== null || plan.performance.status !== "NOT_GENERATED" || plan.performance.authorization !== "NOT_AUTHORIZED") throw new Error("R10 Plan execution boundary changed.");
  if (plan.status.baseline002Status !== "NOT_FROZEN" || plan.status.m3JStatus !== "BLOCKED" || plan.status.m4Status !== "NOT_STARTED") throw new Error("R10 milestone boundary changed.");
  validateR10MachineRecord();
  const hash = createHash("sha256").update(stableStringify(plan), "utf8").digest("hex");
  if (hash !== R10_PLAN_SHA256) throw new Error("R10 Plan canonical SHA mismatch.");
  return plan;
}
