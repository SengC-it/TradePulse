import { createHash } from "node:crypto";

import type { SelectionGateSchema } from "./types.ts";
import { validateSelectionGateSchema } from "./gates.ts";
import {
  BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256,
} from "./selection-gates-round-001.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R2_ROUND_002_RESEARCH_ROUND_ID = "baseline-002-research-round-002" as const;
export const M3_R2_ROUND_002_SOURCE_SHA = "26d18ef314594f0e79583da617a0d8c17e812be9" as const;
export const M3_R2_ROUND_002_INHERITED_SELECTION_GATE_SHA256 = BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256;
export const M3_R2_ROUND_002_PERFORMANCE_LOCK = "FIRST_M3_R2_C_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R2_ROUND_002_NO_CANDIDATE_OUTCOME = "NO BASELINE-002 CANDIDATE — ROUND-002" as const;

export const M3_R2_ROUND_002_CANDIDATE_IDS = Object.freeze([
  "R2-H6-STRICT-BTC",
  "R2-H7-STRONG-SYMBOL",
  "R2-H8-RECENT-PULLBACK",
  "R2-H9-VOLUME-CONFIRM",
  "R2-H10-BREAKOUT-010",
  "R2-C1-BTC-STRONG-SYMBOL",
  "R2-C2-STRONG-SYMBOL-RECENT-PULLBACK",
  "R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT",
  "R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT",
] as const);

export type M3R2CandidateId = (typeof M3_R2_ROUND_002_CANDIDATE_IDS)[number];

export const M3_R2_ROUND_002_MECHANISM_IDS = Object.freeze([
  "H6_STRICT_BTC_ALIGNMENT",
  "H7_STRONG_SYMBOL_REGIME",
  "H8_RECENT_PULLBACK",
  "H9_VOLUME_CONFIRMATION",
  "H10_BREAKOUT_BUFFER",
] as const);

export type M3R2MechanismId = (typeof M3_R2_ROUND_002_MECHANISM_IDS)[number];

export const M3_R2_ROUND_002_REDUNDANCY_APPLICABILITY = Object.fromEntries(
  M3_R2_ROUND_002_CANDIDATE_IDS.map((candidateId) => [candidateId, "NOT_APPLICABLE"]),
) as Readonly<Record<M3R2CandidateId, "NOT_APPLICABLE">>;

export const M3_R2_ROUND_002_INVALIDATING_CATEGORIES = Object.freeze([
  "GATE_VALUE",
  "GATE_FORMULA",
  "FOLD_IMPROVEMENT_DEFINITION",
  "CATASTROPHIC_FOLD_DEFINITION",
  "APPLICABILITY_RULE",
  "SAMPLE_FLOOR",
  "SELECTION_TIE_RULE",
  "AGGREGATE_VALIDATION_DEFINITION",
  "CANDIDATE_DEFINITION",
  "FEATURE_FORMULA",
  "SELECTOR_FORMULA",
  "COMPLEXITY_TUPLE",
  "COST_ASSUMPTION",
] as const);

export const BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES: SelectionGateSchema = validateSelectionGateSchema({
  ...BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD.selectionGates,
  researchRoundId: M3_R2_ROUND_002_RESEARCH_ROUND_ID,
  sourceSha: M3_R2_ROUND_002_SOURCE_SHA,
});

export const BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS = deepFreeze({
  ...BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS,
  researchRoundId: M3_R2_ROUND_002_RESEARCH_ROUND_ID,
  noCandidateOutcome: M3_R2_ROUND_002_NO_CANDIDATE_OUTCOME,
  performanceLock: M3_R2_ROUND_002_PERFORMANCE_LOCK,
  round002CandidateRedundancyApplicability: M3_R2_ROUND_002_REDUNDANCY_APPLICABILITY,
  round002MechanismIds: M3_R2_ROUND_002_MECHANISM_IDS,
  roundImmutability: {
    ...BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.roundImmutability,
    becomesImmutableAt: M3_R2_ROUND_002_PERFORMANCE_LOCK,
    invalidatingChanges: M3_R2_ROUND_002_INVALIDATING_CATEGORIES,
    actionOnChange: "STOP_AND_REQUIRE_NEW_RESEARCH_ROUND_DECISION",
    priorResultsClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
});

export const BASELINE_002_RESEARCH_ROUND_002_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r2-selection-gates-001",
  researchRoundId: M3_R2_ROUND_002_RESEARCH_ROUND_ID,
  sourceSha: M3_R2_ROUND_002_SOURCE_SHA,
  inheritedSelectionGateSha256: M3_R2_ROUND_002_INHERITED_SELECTION_GATE_SHA256,
  performanceLock: M3_R2_ROUND_002_PERFORMANCE_LOCK,
  selectionGates: BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATES,
  definitions: BASELINE_002_RESEARCH_ROUND_002_DEFINITIONS,
});

export const BASELINE_002_RESEARCH_ROUND_002_CANONICAL_JSON = stableStringify(
  BASELINE_002_RESEARCH_ROUND_002_MACHINE_RECORD,
);

// This is replaced with the SHA of the final canonical record before commit.
export const BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256 = "9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0" as const;

export function validateM3R2Round002MachineRecord(
  record: typeof BASELINE_002_RESEARCH_ROUND_002_MACHINE_RECORD = BASELINE_002_RESEARCH_ROUND_002_MACHINE_RECORD,
): typeof BASELINE_002_RESEARCH_ROUND_002_MACHINE_RECORD {
  if (record.researchRoundId !== M3_R2_ROUND_002_RESEARCH_ROUND_ID) {
    throw new Error("M3-R2-B gate research round mismatch.");
  }
  if (record.sourceSha !== M3_R2_ROUND_002_SOURCE_SHA) {
    throw new Error("M3-R2-B gate source SHA mismatch.");
  }
  if (record.selectionGates.researchRoundId !== M3_R2_ROUND_002_RESEARCH_ROUND_ID) {
    throw new Error("M3-R2-B selection gate research round mismatch.");
  }
  if (record.selectionGates.sourceSha !== M3_R2_ROUND_002_SOURCE_SHA) {
    throw new Error("M3-R2-B selection gate source SHA mismatch.");
  }
  if (record.definitions.noCandidateOutcome !== M3_R2_ROUND_002_NO_CANDIDATE_OUTCOME) {
    throw new Error("M3-R2-B no-candidate outcome mismatch.");
  }
  if (record.definitions.performanceLock !== M3_R2_ROUND_002_PERFORMANCE_LOCK) {
    throw new Error("M3-R2-B performance lock mismatch.");
  }
  if (createHash("sha256").update(stableStringify(record), "utf8").digest("hex") !== BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256) {
    throw new Error("M3-R2-B gate canonical SHA mismatch.");
  }
  return record;
}
