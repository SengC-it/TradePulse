import { createHash } from "node:crypto";

import { RESEARCH_FOLDS } from "./folds.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R7_CANDIDATE_IDS,
  M3_R7_CONTROL_ID,
  M3_R7_FREEZE_SOURCE_SHA,
  M3_R7_NO_CANDIDATE_OUTCOME,
  M3_R7_PERFORMANCE_LOCK,
  M3_R7_POLICY_VERSION,
  M3_R7_PROTOCOL_VERSION,
  M3_R7_RESEARCH_END_ISO,
  M3_R7_RESEARCH_RANGE,
  M3_R7_RESEARCH_ROUND_ID,
  R7_CANDIDATE_REGISTRY,
  R7_DATA_CONTRACT,
  R7_EXECUTION_CONTRACT,
  R7_MODEL_CONTRACT,
  R7_SYMBOLS,
} from "./m3-r7-round-007-protocol.ts";
import { R7_DEFINITIONS, R7_SELECTION_GATE_SHA256 } from "./selection-gates-round-007.ts";

export const M3_R7_PLAN_SCHEMA_VERSION = "m3-r7-round-007-plan-001" as const;
export const R7_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;

export const R7_PLAN = deepFreeze({
  schemaVersion: M3_R7_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R7_RESEARCH_ROUND_ID,
  sourceSha: M3_R7_FREEZE_SOURCE_SHA,
  freezeSourceSha: M3_R7_FREEZE_SOURCE_SHA,
  dataClassification: R7_DATA_CLASSIFICATION,
  researchUniverse: { ...M3_R7_RESEARCH_RANGE, startIso: "2023-01-01T00:00:00.000Z", endIso: M3_R7_RESEARCH_END_ISO },
  symbols: R7_SYMBOLS,
  folds: RESEARCH_FOLDS,
  control: { candidateId: M3_R7_CONTROL_ID, strategyVersion: "baseline-001", backtestPolicyVersion: M3_R7_POLICY_VERSION, runExactlyOnce: true },
  candidateRegistry: R7_CANDIDATE_REGISTRY,
  candidateIds: M3_R7_CANDIDATE_IDS,
  protocol: { version: M3_R7_PROTOCOL_VERSION, closedCandleOnly: true, sourceIdentity: M3_R7_FREEZE_SOURCE_SHA },
  model: R7_MODEL_CONTRACT,
  dataContract: R7_DATA_CONTRACT,
  execution: R7_EXECUTION_CONTRACT,
  gate: { path: "src/lib/research/selection-gates-round-007.ts", sha256: R7_SELECTION_GATE_SHA256, semantics: "ALL_APPLICABLE_GATES_CONJUNCTIVE" },
  selection: { definitions: R7_DEFINITIONS.selectionAlgorithm, zeroEligibleOutcome: M3_R7_NO_CANDIDATE_OUTCOME },
  performance: { status: "NOT_GENERATED", authorization: "NOT_AUTHORIZED", executionSourceSha: null, lock: M3_R7_PERFORMANCE_LOCK },
  acquisition: { coarseData: "REUSE_ONLY_IF_R6_IDENTITY_AND_POLICY_VALIDATE", intrabar: "DECLARE_ALL_BEFORE_DATASET_FREEZE;NO_POST_LOCK_FETCH", cacheSchema: "m3-r6-round-006-page-cache-001" },
  governance: { noPrivateApi: true, noAutomaticTrading: true, noOptimizer: true, noSweep: true, noPostResultCandidateReplacement: true, noNewMarketDataFromLiveSample: true, validationNeverFitsOrTunes: true },
  status: { baseline002Status: "NOT_FROZEN", m3R7Status: "FROZEN_PENDING_ACCEPTANCE", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" },
});

export const R7_PLAN_CANONICAL_JSON = stableStringify(R7_PLAN);
export const R7_PLAN_SHA256 = createHash("sha256").update(R7_PLAN_CANONICAL_JSON, "utf8").digest("hex");

export function validateR7Plan(plan: typeof R7_PLAN = R7_PLAN): typeof R7_PLAN {
  if (plan.schemaVersion !== M3_R7_PLAN_SCHEMA_VERSION || plan.researchRoundId !== M3_R7_RESEARCH_ROUND_ID || plan.sourceSha !== M3_R7_FREEZE_SOURCE_SHA || plan.freezeSourceSha !== M3_R7_FREEZE_SOURCE_SHA) throw new Error("R7 Plan provenance mismatch.");
  if (plan.dataClassification !== R7_DATA_CLASSIFICATION || stableStringify(plan.symbols) !== stableStringify(R7_SYMBOLS) || stableStringify(plan.folds) !== stableStringify(RESEARCH_FOLDS)) throw new Error("R7 Plan universe mismatch.");
  if (stableStringify(plan.candidateIds) !== stableStringify(M3_R7_CANDIDATE_IDS) || stableStringify(plan.candidateRegistry) !== stableStringify(R7_CANDIDATE_REGISTRY)) throw new Error("R7 Plan candidate registry changed.");
  if (plan.control.candidateId !== M3_R7_CONTROL_ID || plan.control.backtestPolicyVersion !== M3_R7_POLICY_VERSION || plan.performance.executionSourceSha !== null || plan.performance.status !== "NOT_GENERATED" || plan.performance.authorization !== "NOT_AUTHORIZED") throw new Error("R7 Plan execution boundary changed.");
  if (plan.status.baseline002Status !== "NOT_FROZEN" || plan.status.m3JStatus !== "BLOCKED" || plan.status.m4Status !== "NOT_STARTED") throw new Error("R7 Plan milestone boundary changed.");
  const hash = createHash("sha256").update(stableStringify(plan), "utf8").digest("hex");
  if (hash !== R7_PLAN_SHA256) throw new Error("R7 Plan canonical SHA mismatch.");
  return plan;
}
