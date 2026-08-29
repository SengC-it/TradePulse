import { createHash } from "node:crypto";

import { RESEARCH_FOLDS } from "./folds.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R12_BASE_SOURCE_SHA,
  M3_R12_CANDIDATE_IDS,
  M3_R12_CONTROL_ID,
  M3_R12_NO_CANDIDATE_OUTCOME,
  M3_R12_PERFORMANCE_LOCK,
  M3_R12_POLICY_VERSION,
  M3_R12_PROTOCOL_VERSION,
  M3_R12_RESEARCH_END_ISO,
  M3_R12_RESEARCH_RANGE,
  M3_R12_RESEARCH_ROUND_ID,
  R12_CANDIDATE_REGISTRY,
  R12_DATA_CONTRACT,
  R12_EXECUTION_CONTRACT,
  R12_GOVERNANCE,
  R12_THESIS_CONTRACT,
  R12_SYMBOLS,
} from "./m3-r12-round-012-protocol.ts";
import { R12_DEFINITIONS, R12_SELECTION_GATE_SHA256, validateR12MachineRecord } from "./selection-gates-round-012.ts";

export const M3_R12_PLAN_SCHEMA_VERSION = "m3-r12-round-012-plan-001" as const;
export const R12_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;

export const R12_PLAN = deepFreeze({
  schemaVersion: M3_R12_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R12_RESEARCH_ROUND_ID,
  sourceSha: M3_R12_BASE_SOURCE_SHA,
  freezeSourceSha: M3_R12_BASE_SOURCE_SHA,
  dataClassification: R12_DATA_CLASSIFICATION,
  researchUniverse: { ...M3_R12_RESEARCH_RANGE, startIso: "2023-01-01T00:00:00.000Z", endIso: M3_R12_RESEARCH_END_ISO },
  symbols: R12_SYMBOLS,
  folds: RESEARCH_FOLDS,
  control: { candidateId: M3_R12_CONTROL_ID, strategyVersion: "baseline-001", backtestPolicyVersion: M3_R12_POLICY_VERSION, runExactlyOnce: true, stream: "BASELINE_FORMAL_STREAM" },
  sourceUniverse: { id: "BASELINE_FORMAL_STREAM", source: "exact baseline-001 formal signal stream", changes: "retain-or-suppress-only; entry stop TP score grade regime settlement fees slippage funding unchanged" },
  thesisStateMachine: R12_THESIS_CONTRACT,
  candidateRegistry: R12_CANDIDATE_REGISTRY,
  candidateIds: M3_R12_CANDIDATE_IDS,
  protocol: { version: M3_R12_PROTOCOL_VERSION, closedCandleOnly: true, sourceIdentity: M3_R12_BASE_SOURCE_SHA },
  dataContract: R12_DATA_CONTRACT,
  execution: R12_EXECUTION_CONTRACT,
  settlement: { source: "EXACT_CONTROL_SETTLEMENT_RESULT_PER_RETAINED_SIGNAL", candidateSettlementRerun: false, identityFields: ["entryTime", "exitTime", "status", "grossR", "feeR", "fundingR", "netR"] },
  gate: { path: "src/lib/research/selection-gates-round-012.ts", sha256: R12_SELECTION_GATE_SHA256, semantics: "ALL_APPLICABLE_GATES_CONJUNCTIVE" },
  selection: { definitions: R12_DEFINITIONS.selectionAlgorithm, zeroEligibleOutcome: M3_R12_NO_CANDIDATE_OUTCOME },
  performance: { status: "NOT_GENERATED", authorization: "NOT_AUTHORIZED", executionSourceSha: null, lock: M3_R12_PERFORMANCE_LOCK },
  acquisition: { coarseData: "REUSE_ACCEPTED_COMPLETE_ROUND_006_CONTROL_CACHE_WHERE_IDENTITY_MATCHES", intrabar: "NO_NEW_CANDIDATE_SETTLEMENT_DEPENDENCIES;NO_POST_LOCK_FETCH", cacheSchema: "m3-r6-round-006-page-cache-001" },
  conformance: { checks: "A_N", resultAffectingDeviationCount: 0, thesisStateMachineVerified: true, noOutcomeLookahead: true, candidateSettlementIdentityVerified: true, productionSeenDataExcluded: true },
  governance: R12_GOVERNANCE,
  status: { baseline002Status: "NOT_FROZEN", m3R12Status: "FROZEN_PENDING_ACCEPTANCE", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" },
});

export const R12_PLAN_CANONICAL_JSON = stableStringify(R12_PLAN);
export const R12_PLAN_SHA256 = createHash("sha256").update(R12_PLAN_CANONICAL_JSON, "utf8").digest("hex");

export function validateR12Plan(plan: typeof R12_PLAN = R12_PLAN): typeof R12_PLAN {
  if (plan.schemaVersion !== M3_R12_PLAN_SCHEMA_VERSION || plan.researchRoundId !== M3_R12_RESEARCH_ROUND_ID || plan.sourceSha !== M3_R12_BASE_SOURCE_SHA || plan.freezeSourceSha !== M3_R12_BASE_SOURCE_SHA) throw new Error("R12 Plan provenance mismatch.");
  if (plan.dataClassification !== R12_DATA_CLASSIFICATION || stableStringify(plan.symbols) !== stableStringify(R12_SYMBOLS) || stableStringify(plan.folds) !== stableStringify(RESEARCH_FOLDS)) throw new Error("R12 Plan universe mismatch.");
  if (stableStringify(plan.candidateIds) !== stableStringify(M3_R12_CANDIDATE_IDS) || stableStringify(plan.candidateRegistry) !== stableStringify(R12_CANDIDATE_REGISTRY)) throw new Error("R12 Plan candidate registry changed.");
  if (stableStringify(plan.thesisStateMachine) !== stableStringify(R12_THESIS_CONTRACT) || stableStringify(plan.execution) !== stableStringify(R12_EXECUTION_CONTRACT)) throw new Error("R12 Plan semantic contract changed.");
  if (plan.control.candidateId !== M3_R12_CONTROL_ID || plan.control.backtestPolicyVersion !== M3_R12_POLICY_VERSION || plan.performance.executionSourceSha !== null || plan.performance.status !== "NOT_GENERATED" || plan.performance.authorization !== "NOT_AUTHORIZED") throw new Error("R12 Plan execution boundary changed.");
  if (plan.status.baseline002Status !== "NOT_FROZEN" || plan.status.m3JStatus !== "BLOCKED" || plan.status.m4Status !== "NOT_STARTED") throw new Error("R12 milestone boundary changed.");
  if (plan.gate.sha256 !== R12_SELECTION_GATE_SHA256) throw new Error("R12 Plan Gate identity changed.");
  validateR12MachineRecord();
  const hash = createHash("sha256").update(stableStringify(plan), "utf8").digest("hex");
  if (hash !== R12_PLAN_SHA256) throw new Error("R12 Plan canonical SHA mismatch.");
  return plan;
}
