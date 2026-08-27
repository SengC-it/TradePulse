import { createHash } from "node:crypto";

import { RESEARCH_FOLDS } from "./folds.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R7_RESEARCH_ROUND_ID,
} from "./m3-r7-round-007-protocol.ts";
import {
  M3_R8_CONTROL_ID,
  M3_R8_FREEZE_SOURCE_SHA,
  M3_R8_NO_CANDIDATE_OUTCOME,
  M3_R8_PERFORMANCE_LOCK,
  M3_R8_PROTOCOL_VERSION,
  M3_R8_RESEARCH_END_ISO,
  M3_R8_RESEARCH_RANGE,
  M3_R8_RESEARCH_ROUND_ID,
  R8_CANDIDATE_IDS,
  R8_CANDIDATE_REGISTRY,
  R8_DATA_CONTRACT,
  R8_EXECUTION_CONTRACT,
  R8_MODEL_CONTRACT,
  R8_RESULT_AFFECTING_SPEC_DIFF_COUNT,
  R8_SELECTION_DEFINITIONS,
  R8_SELECTION_GATE_SHA256,
  R8_SYMBOLS,
  validateR8ProtocolMachineRecord,
} from "./m3-r8-round-008-protocol.ts";

export const M3_R8_PLAN_SCHEMA_VERSION = "m3-r8-round-008-plan-001" as const;
export const R8_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;

export const R8_PLAN = deepFreeze({
  schemaVersion: M3_R8_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R8_RESEARCH_ROUND_ID,
  replayOfResearchRoundId: M3_R7_RESEARCH_ROUND_ID,
  sourceSha: M3_R8_FREEZE_SOURCE_SHA,
  freezeSourceSha: M3_R8_FREEZE_SOURCE_SHA,
  dataClassification: R8_DATA_CLASSIFICATION,
  researchUniverse: { ...M3_R8_RESEARCH_RANGE, startIso: "2023-01-01T00:00:00.000Z", endIso: M3_R8_RESEARCH_END_ISO },
  symbols: R8_SYMBOLS,
  folds: RESEARCH_FOLDS,
  control: { candidateId: M3_R8_CONTROL_ID, strategyVersion: "baseline-001", backtestPolicyVersion: "bt-policy-003", runExactlyOnce: true },
  candidateRegistry: R8_CANDIDATE_REGISTRY,
  candidateIds: R8_CANDIDATE_IDS,
  protocol: { version: M3_R8_PROTOCOL_VERSION, closedCandleOnly: true, sourceIdentity: M3_R8_FREEZE_SOURCE_SHA, resultAffectingSpecDiffCount: R8_RESULT_AFFECTING_SPEC_DIFF_COUNT },
  model: R8_MODEL_CONTRACT,
  dataContract: R8_DATA_CONTRACT,
  execution: R8_EXECUTION_CONTRACT,
  gate: { path: "src/lib/research/selection-gates-round-007.ts", sha256: R8_SELECTION_GATE_SHA256, semantics: "EXACT_ROUND_007_REPLAY;ALL_APPLICABLE_GATES_CONJUNCTIVE" },
  selection: { definitions: R8_SELECTION_DEFINITIONS.selectionAlgorithm, zeroEligibleOutcome: M3_R8_NO_CANDIDATE_OUTCOME },
  performance: { status: "NOT_GENERATED", authorization: "NOT_AUTHORIZED", executionSourceSha: null, lock: M3_R8_PERFORMANCE_LOCK },
  acquisition: { coarseData: "REUSE_ONLY_IF_R7_R6_IDENTITY_CHECKSUM_RANGE_AND_POLICY_VALIDATE", intrabar: "DECLARE_ALL_BEFORE_DATASET_FREEZE;NO_POST_LOCK_FETCH", cacheSchema: "m3-r6-round-006-page-cache-001" },
  governance: { noPrivateApi: true, noAutomaticTrading: true, noOptimizer: true, noSweep: true, noPostResultCandidateReplacement: true, noResultAffectingSpecChanges: true, round007ResultsUsedForRound008Tuning: false, validationNeverFitsOrTunes: true },
  status: { baseline002Status: "NOT_FROZEN", m3R8Status: "FROZEN_PENDING_ACCEPTANCE", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" },
});

export const R8_PLAN_CANONICAL_JSON = stableStringify(R8_PLAN);
export const R8_PLAN_SHA256 = createHash("sha256").update(R8_PLAN_CANONICAL_JSON, "utf8").digest("hex");

export function validateR8Plan(plan: typeof R8_PLAN = R8_PLAN): typeof R8_PLAN {
  validateR8ProtocolMachineRecord();
  if (plan.schemaVersion !== M3_R8_PLAN_SCHEMA_VERSION || plan.researchRoundId !== M3_R8_RESEARCH_ROUND_ID || plan.replayOfResearchRoundId !== M3_R7_RESEARCH_ROUND_ID || plan.sourceSha !== M3_R8_FREEZE_SOURCE_SHA || plan.freezeSourceSha !== M3_R8_FREEZE_SOURCE_SHA) throw new Error("R8 Plan provenance mismatch.");
  if (plan.dataClassification !== R8_DATA_CLASSIFICATION || stableStringify(plan.symbols) !== stableStringify(R8_SYMBOLS) || stableStringify(plan.folds) !== stableStringify(RESEARCH_FOLDS)) throw new Error("R8 Plan universe mismatch.");
  if (stableStringify(plan.candidateIds) !== stableStringify(R8_CANDIDATE_IDS) || stableStringify(plan.candidateRegistry) !== stableStringify(R8_CANDIDATE_REGISTRY)) throw new Error("R8 Plan candidate registry changed.");
  if (plan.control.candidateId !== M3_R8_CONTROL_ID || plan.control.backtestPolicyVersion !== "bt-policy-003" || plan.performance.executionSourceSha !== null || plan.performance.status !== "NOT_GENERATED" || plan.performance.authorization !== "NOT_AUTHORIZED") throw new Error("R8 Plan execution boundary changed.");
  if (plan.protocol.resultAffectingSpecDiffCount !== 0 || plan.governance.round007ResultsUsedForRound008Tuning !== false) throw new Error("R8 Plan replay boundary changed.");
  if (plan.status.baseline002Status !== "NOT_FROZEN" || plan.status.m3JStatus !== "BLOCKED" || plan.status.m4Status !== "NOT_STARTED") throw new Error("R8 milestone boundary changed.");
  const hash = createHash("sha256").update(stableStringify(plan), "utf8").digest("hex");
  if (hash !== R8_PLAN_SHA256) throw new Error("R8 Plan canonical SHA mismatch.");
  return plan;
}
