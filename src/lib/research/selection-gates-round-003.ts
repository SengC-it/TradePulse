import { createHash } from "node:crypto";

import type { SelectionGateSchema } from "./types.ts";
import { validateSelectionGateSchema } from "./gates.ts";
import {
  BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES,
  M3_R2_ROUND_002_CANDIDATE_IDS,
  M3_R2_ROUND_002_MECHANISM_IDS,
  M3_R2_ROUND_002_INVALIDATING_CATEGORIES,
} from "./selection-gates-round-002.ts";
import { stableStringify, deepFreeze } from "./utils.ts";

export const M3_R3_ROUND_003_RESEARCH_ROUND_ID = "baseline-002-research-round-003" as const;
export const M3_R3_ROUND_003_SOURCE_SHA = "a20803c9cf33aefcb1d376f916eb9fe666f1bf58" as const;
export const M3_R3_ROUND_003_INVALIDATION_MERGE_SHA = M3_R3_ROUND_003_SOURCE_SHA;
export const M3_R3_ROUND_003_INHERITED_SELECTION_GATE_SHA256 =
  "9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0" as const;
export const M3_R3_ROUND_003_INHERITED_PLAN_SHA256 =
  "82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511" as const;
export const M3_R3_ROUND_003_PERFORMANCE_LOCK = "FIRST_M3_R3_B_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME = "NO BASELINE-002 CANDIDATE — ROUND-003" as const;

export const M3_R3_ROUND_003_CANDIDATE_IDS = M3_R2_ROUND_002_CANDIDATE_IDS;
export type M3R3CandidateId = (typeof M3_R3_ROUND_003_CANDIDATE_IDS)[number];
export const M3_R3_ROUND_003_MECHANISM_IDS = M3_R2_ROUND_002_MECHANISM_IDS;

export const M3_R3_ROUND_003_INVALIDATING_CATEGORIES = M3_R2_ROUND_002_INVALIDATING_CATEGORIES;

export const BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATES: SelectionGateSchema = validateSelectionGateSchema({
  ...BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES,
  researchRoundId: M3_R3_ROUND_003_RESEARCH_ROUND_ID,
  sourceSha: M3_R3_ROUND_003_SOURCE_SHA,
});

export const BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS = deepFreeze({
  ...BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS,
  researchRoundId: M3_R3_ROUND_003_RESEARCH_ROUND_ID,
  noCandidateOutcome: M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME,
  performanceLock: M3_R3_ROUND_003_PERFORMANCE_LOCK,
  roundImmutability: {
    ...BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS.roundImmutability,
    becomesImmutableAt: M3_R3_ROUND_003_PERFORMANCE_LOCK,
  },
});

export const BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r3-selection-gates-001",
  researchRoundId: M3_R3_ROUND_003_RESEARCH_ROUND_ID,
  sourceSha: M3_R3_ROUND_003_SOURCE_SHA,
  invalidationMergeSha: M3_R3_ROUND_003_INVALIDATION_MERGE_SHA,
  inheritedSelectionGateSha256: M3_R3_ROUND_003_INHERITED_SELECTION_GATE_SHA256,
  inheritedPlanSha256: M3_R3_ROUND_003_INHERITED_PLAN_SHA256,
  performanceLock: M3_R3_ROUND_003_PERFORMANCE_LOCK,
  selectionGates: BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATES,
  definitions: BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS,
  repairs: {
    aggregateValidation: "FILTER_RECORDS_TO_F1_THROUGH_F6_VALIDATION_RANGE_BEFORE_DIAGNOSTICS",
    identityHash: "SIGNAL_TIME_THEN_FROZEN_SYMBOL_THEN_DIRECTION",
    artifactReuse: "SHA256_VERIFIED_ROUND_002_CONTROL_AND_SNAPSHOTS_ONLY",
  },
});

export const BASELINE_002_RESEARCH_ROUND_003_CANONICAL_JSON = stableStringify(
  BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD,
);

export const BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256 =
  "297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2" as const;

export function validateM3R3Round003MachineRecord(
  record: typeof BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD = BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD,
): typeof BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD {
  if (record.researchRoundId !== M3_R3_ROUND_003_RESEARCH_ROUND_ID) {
    throw new Error("M3-R3-A gate research round mismatch.");
  }
  if (record.sourceSha !== M3_R3_ROUND_003_SOURCE_SHA || record.invalidationMergeSha !== M3_R3_ROUND_003_INVALIDATION_MERGE_SHA) {
    throw new Error("M3-R3-A gate provenance mismatch.");
  }
  if (record.inheritedSelectionGateSha256 !== M3_R3_ROUND_003_INHERITED_SELECTION_GATE_SHA256) {
    throw new Error("M3-R3-A inherited gate SHA mismatch.");
  }
  if (record.inheritedPlanSha256 !== M3_R3_ROUND_003_INHERITED_PLAN_SHA256) {
    throw new Error("M3-R3-A inherited plan SHA mismatch.");
  }
  if (record.selectionGates.researchRoundId !== M3_R3_ROUND_003_RESEARCH_ROUND_ID) {
    throw new Error("M3-R3-A selection gate research round mismatch.");
  }
  if (record.selectionGates.sourceSha !== M3_R3_ROUND_003_SOURCE_SHA) {
    throw new Error("M3-R3-A selection gate source SHA mismatch.");
  }
  if (record.definitions.noCandidateOutcome !== M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME) {
    throw new Error("M3-R3-A no-candidate outcome mismatch.");
  }
  if (record.definitions.performanceLock !== M3_R3_ROUND_003_PERFORMANCE_LOCK) {
    throw new Error("M3-R3-A performance lock mismatch.");
  }
  if (createHash("sha256").update(stableStringify(record), "utf8").digest("hex") !== BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256) {
    throw new Error("M3-R3-A gate canonical SHA mismatch.");
  }
  return record;
}
