import { createHash } from "node:crypto";

import type { SelectionGateSchema } from "./types.ts";
import { validateSelectionGateSchema } from "./gates.ts";
import {
  BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATES,
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
} from "./selection-gates-round-003.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R4_ROUND_004_RESEARCH_ROUND_ID = "baseline-002-research-round-004" as const;
export const M3_R4_ROUND_004_SOURCE_SHA = "1bab6066cd4e9933c3d50ab29a38e9ad0792e5c8" as const;
export const M3_R4_ROUND_004_INHERITED_SELECTION_GATE_SHA256 =
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256;
export const M3_R4_ROUND_004_PERFORMANCE_LOCK = "FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME = "NO BASELINE-002 CANDIDATE — ROUND-004" as const;

export const M3_R4_ROUND_004_CONTROL_ID = "R4-CONTROL-BASELINE-001" as const;

export const M3_R4_ROUND_004_CANDIDATE_IDS = Object.freeze([
  "R4-H11-BREAKOUT-RETEST",
  "R4-H12-PULLBACK-RECLAIM",
  "R4-H13-ADAPTIVE-TREND-EXIT",
  "R4-H14-RELATIVE-STRENGTH",
] as const);
export type M3R4CandidateId = (typeof M3_R4_ROUND_004_CANDIDATE_IDS)[number];

export const M3_R4_ROUND_004_MECHANISM_IDS = Object.freeze([
  "H11_BREAKOUT_RETEST_ENTRY",
  "H12_PULLBACK_RECLAIM_ENTRY",
  "H13_ADAPTIVE_TREND_EXIT",
  "H14_RELATIVE_STRENGTH_CONTEXT",
] as const);
export type M3R4MechanismId = (typeof M3_R4_ROUND_004_MECHANISM_IDS)[number];

export const M3_R4_ROUND_004_REDUNDANCY_APPLICABILITY = Object.freeze(
  Object.fromEntries(
    M3_R4_ROUND_004_CANDIDATE_IDS.map((candidateId) => [candidateId, "NOT_APPLICABLE"]),
  ) as Record<M3R4CandidateId, "NOT_APPLICABLE">,
);

export const M3_R4_ROUND_004_HARD_GATE_IDENTITIES = Object.freeze([
  "minimumAggregateImprovement",
  "minimumImprovedValidationFolds",
  "catastrophicFoldLimit",
  "minimumNetExpectancy",
  "minimumProfitFactor",
  "maximumSymbolConcentration",
  "maximumSingleTradeConcentration",
  "maximumFeeBurdenRatio",
  "requiredRedundancyImprovement",
  "minimumFormalSignals",
  "minimumExecutedTrades",
] as const);

export const M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES = Object.freeze([
  "minimumAggregateImprovement",
  "minimumImprovedValidationFolds",
  "catastrophicFoldLimit",
  "minimumNetExpectancy",
  "minimumProfitFactor",
  "maximumSymbolConcentration",
  "maximumSingleTradeConcentration",
  "maximumFeeBurdenRatio",
  "minimumFormalSignals",
  "minimumExecutedTrades",
] as const);

export const M3_R4_ROUND_004_INVALIDATING_CATEGORIES = Object.freeze([
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
  "FORMAL_SIGNAL_FORMULA",
  "ENTRY_FORMULA",
  "STOP_FORMULA",
  "TP_FORMULA",
  "EXIT_FORMULA",
  "HOLDING_HORIZON",
  "RELATIVE_STRENGTH_FORMULA",
  "RANKING_RULE",
  "FUNDING_SEMANTICS",
  "DECISION_TIME_FIELD_SEMANTICS",
] as const);

export const BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES: SelectionGateSchema = validateSelectionGateSchema({
  ...BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATES,
  researchRoundId: M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  sourceSha: M3_R4_ROUND_004_SOURCE_SHA,
});

const inheritedDefinitions: Record<string, unknown> = {
  ...BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS,
};
delete inheritedDefinitions.round002CandidateRedundancyApplicability;
delete inheritedDefinitions.round002MechanismIds;

type Round004Definitions = Omit<
  typeof BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS,
  "researchRoundId" | "hardGateIdentities" | "noCandidateOutcome" | "performanceLock" |
  "round002CandidateRedundancyApplicability" | "round002MechanismIds"
> & Readonly<{
  researchRoundId: typeof M3_R4_ROUND_004_RESEARCH_ROUND_ID;
  hardGateIdentities: readonly string[];
  applicableHardGateIdentities: readonly string[];
  noCandidateOutcome: typeof M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME;
  performanceLock: typeof M3_R4_ROUND_004_PERFORMANCE_LOCK;
  redundancyApplicability: typeof M3_R4_ROUND_004_REDUNDANCY_APPLICABILITY;
  round004MechanismIds: typeof M3_R4_ROUND_004_MECHANISM_IDS;
  invalidatingCategories: typeof M3_R4_ROUND_004_INVALIDATING_CATEGORIES;
}>;

export const BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS: Round004Definitions = deepFreeze({
  ...inheritedDefinitions,
  researchRoundId: M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  hardGateIdentities: M3_R4_ROUND_004_HARD_GATE_IDENTITIES,
  applicableHardGateIdentities: M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES,
  noCandidateOutcome: M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME,
  performanceLock: M3_R4_ROUND_004_PERFORMANCE_LOCK,
  redundancyApplicability: M3_R4_ROUND_004_REDUNDANCY_APPLICABILITY,
  round004MechanismIds: M3_R4_ROUND_004_MECHANISM_IDS,
  invalidatingCategories: M3_R4_ROUND_004_INVALIDATING_CATEGORIES,
  roundImmutability: {
    ...(BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS.roundImmutability as Record<string, unknown>),
    becomesImmutableAt: M3_R4_ROUND_004_PERFORMANCE_LOCK,
    invalidatingChanges: M3_R4_ROUND_004_INVALIDATING_CATEGORIES,
    actionOnChange: "ROUND_004_INVALIDATION_REQUIRED",
    postLockAction: "ROUND_004_INVALIDATION_REQUIRED",
    postLockMeaning: "STOP; DO NOT PATCH OR RERUN THE SAME ROUND; INVALIDATION IS REQUIRED.",
    priorResultsClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
}) as unknown as Round004Definitions;

export const BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r4-selection-gates-001",
  researchRoundId: M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  sourceSha: M3_R4_ROUND_004_SOURCE_SHA,
  inheritedSelectionGateSha256: M3_R4_ROUND_004_INHERITED_SELECTION_GATE_SHA256,
  performanceLock: M3_R4_ROUND_004_PERFORMANCE_LOCK,
  controlId: M3_R4_ROUND_004_CONTROL_ID,
  candidateIds: M3_R4_ROUND_004_CANDIDATE_IDS,
  mechanismIds: M3_R4_ROUND_004_MECHANISM_IDS,
  selectionGates: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES,
  definitions: BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS,
});

export const BASELINE_002_RESEARCH_ROUND_004_CANONICAL_JSON = stableStringify(
  BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD,
);

// This value is the SHA-256 of BASELINE_002_RESEARCH_ROUND_004_CANONICAL_JSON.
export const BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256 =
  "c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54" as const;

export function validateM3R4Round004MachineRecord(
  record: typeof BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD = BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD,
): typeof BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD {
  if (record.recordVersion !== "m3-r4-selection-gates-001") {
    throw new Error("M3-R4-B gate record version mismatch.");
  }
  if (record.researchRoundId !== M3_R4_ROUND_004_RESEARCH_ROUND_ID || record.sourceSha !== M3_R4_ROUND_004_SOURCE_SHA) {
    throw new Error("M3-R4-B gate provenance mismatch.");
  }
  if (record.inheritedSelectionGateSha256 !== M3_R4_ROUND_004_INHERITED_SELECTION_GATE_SHA256) {
    throw new Error("M3-R4-B inherited gate SHA mismatch.");
  }
  if (record.performanceLock !== M3_R4_ROUND_004_PERFORMANCE_LOCK) {
    throw new Error("M3-R4-B performance lock mismatch.");
  }
  if (record.controlId !== M3_R4_ROUND_004_CONTROL_ID) {
    throw new Error("M3-R4-B CONTROL identity mismatch.");
  }
  if (stableStringify(record.candidateIds) !== stableStringify(M3_R4_ROUND_004_CANDIDATE_IDS)) {
    throw new Error("M3-R4-B candidate registry mismatch.");
  }
  if (stableStringify(record.mechanismIds) !== stableStringify(M3_R4_ROUND_004_MECHANISM_IDS)) {
    throw new Error("M3-R4-B mechanism registry mismatch.");
  }
  if (stableStringify(record.definitions.hardGateIdentities) !== stableStringify(M3_R4_ROUND_004_HARD_GATE_IDENTITIES)) {
    throw new Error("M3-R4-B hard gate identity registry mismatch.");
  }
  if (stableStringify(record.definitions.applicableHardGateIdentities) !== stableStringify(M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES)) {
    throw new Error("M3-R4-B applicable hard gate registry mismatch.");
  }
  if (Object.values(record.definitions.redundancyApplicability).some((value) => value !== "NOT_APPLICABLE")) {
    throw new Error("M3-R4-B redundancy applicability must be NOT_APPLICABLE for every candidate.");
  }
  if (stableStringify(record.definitions.invalidatingCategories) !== stableStringify(M3_R4_ROUND_004_INVALIDATING_CATEGORIES)) {
    throw new Error("M3-R4-B invalidating category registry mismatch.");
  }
  const roundImmutability = record.definitions.roundImmutability as Record<string, unknown>;
  if (stableStringify(roundImmutability.invalidatingChanges) !== stableStringify(M3_R4_ROUND_004_INVALIDATING_CATEGORIES)) {
    throw new Error("M3-R4-B round invalidation categories mismatch.");
  }
  if (roundImmutability.actionOnChange !== "ROUND_004_INVALIDATION_REQUIRED" || roundImmutability.postLockAction !== "ROUND_004_INVALIDATION_REQUIRED") {
    throw new Error("M3-R4-B post-lock action mismatch.");
  }
  if (record.selectionGates.researchRoundId !== M3_R4_ROUND_004_RESEARCH_ROUND_ID) {
    throw new Error("M3-R4-B selection gate research round mismatch.");
  }
  if (record.selectionGates.sourceSha !== M3_R4_ROUND_004_SOURCE_SHA) {
    throw new Error("M3-R4-B selection gate source SHA mismatch.");
  }
  if (record.definitions.noCandidateOutcome !== M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME) {
    throw new Error("M3-R4-B no-candidate outcome mismatch.");
  }
  if (record.definitions.performanceLock !== M3_R4_ROUND_004_PERFORMANCE_LOCK) {
    throw new Error("M3-R4-B definitions performance lock mismatch.");
  }
  if (
    createHash("sha256").update(stableStringify(record), "utf8").digest("hex") !==
    BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256
  ) {
    throw new Error("M3-R4-B gate canonical SHA mismatch.");
  }
  return record;
}
