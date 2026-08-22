import { createHash } from "node:crypto";

import type { SelectionGateSchema } from "./types.ts";
import { validateSelectionGateSchema } from "./gates.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES,
  M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R4_ROUND_004_HARD_GATE_IDENTITIES,
} from "./selection-gates-round-004.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R5_ROUND_005_RESEARCH_ROUND_ID = "baseline-002-research-round-005" as const;
export const M3_R5_ROUND_005_SOURCE_SHA = "b59b9e86a8b1070275c157f571901a6165114670" as const;
export const M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256 =
  "c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54" as const;
export const M3_R5_ROUND_005_PERFORMANCE_LOCK = "FIRST_M3_R5_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME = "NO BASELINE-002 CANDIDATE — ROUND-005" as const;
export const M3_R5_ROUND_005_CONTROL_ID = "R5-CONTROL-BASELINE-001" as const;
export const M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256 =
  "aa0898d6f760e79675eae251f04fbcdc7afd584bfebf567cdd77189210d8b234" as const;
export const M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256 =
  "01aa31e0390c51369ffcff45757eb43226b3ef74084964d0fbde1fd741a51950" as const;

export const M3_R5_ROUND_005_CANDIDATE_IDS = Object.freeze([
  "R5-H15-HTF-TREND",
  "R5-H16-NEUTRAL-MEAN-REVERSION",
  "R5-H18-COMPRESSION-EXPANSION",
] as const);
export type M3R5CandidateId = (typeof M3_R5_ROUND_005_CANDIDATE_IDS)[number];

export const M3_R5_ROUND_005_EXCLUDED_CANDIDATES = Object.freeze([
  Object.freeze({
    candidateId: "R5-H17-FUNDING-REVERSAL",
    status: "DATA_NOT_AVAILABLE",
    performanceEligible: false,
    exclusionReason: "H17_DATA_QUALIFICATION_DATA_NOT_AVAILABLE",
    qualificationSourceSha: M3_R5_ROUND_005_SOURCE_SHA,
    qualificationJsonSha256: M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
    qualificationMarkdownSha256: M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
  }),
] as const);

export const M3_R5_ROUND_005_HARD_GATE_IDENTITIES = Object.freeze([
  ...M3_R4_ROUND_004_HARD_GATE_IDENTITIES,
] as const);
export const M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES = Object.freeze([
  ...M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES,
] as const);
export const M3_R5_ROUND_005_REDUNDANCY_APPLICABILITY = Object.freeze(
  Object.fromEntries(
    M3_R5_ROUND_005_CANDIDATE_IDS.map((candidateId) => [candidateId, "NOT_APPLICABLE"]),
  ) as Record<M3R5CandidateId, "NOT_APPLICABLE">,
);
export const M3_R5_ROUND_005_INVALIDATING_CATEGORIES = Object.freeze([
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
  "FUNDING_SEMANTICS",
  "DECISION_TIME_FIELD_SEMANTICS",
  "CANDIDATE_AVAILABILITY_RULE",
  "H17_QUALIFICATION_STATUS",
] as const);

export const M3_R5_ROUND_005_COMPLEXITY_TUPLES = deepFreeze({
  "R5-H15-HTF-TREND": { newRules: 3, newTunableThresholds: 3, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 },
  "R5-H16-NEUTRAL-MEAN-REVERSION": { newRules: 4, newTunableThresholds: 5, modifiedBaselineRules: 4, mechanismFamiliesUsed: 1 },
  "R5-H18-COMPRESSION-EXPANSION": { newRules: 4, newTunableThresholds: 4, modifiedBaselineRules: 3, mechanismFamiliesUsed: 1 },
} as const satisfies Record<M3R5CandidateId, Readonly<Record<string, number>>>);

export const M3_R5_ROUND_005_SELECTION_GATES: SelectionGateSchema = validateSelectionGateSchema({
  ...BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES,
  researchRoundId: M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  sourceSha: M3_R5_ROUND_005_SOURCE_SHA,
});

export const M3_R5_ROUND_005_DEFINITIONS = deepFreeze({
  researchRoundId: M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  eligibilityPolicy: {
    mode: "ALL_APPLICABLE_GATES_MUST_PASS",
    notApplicableHandling: "EXCLUDED_FROM_CONJUNCTION_NOT_COUNTED_AS_PASS",
    performanceGateFailure: "INELIGIBLE",
    integrityFailure: "INELIGIBLE_INCOMPLETE_EVIDENCE",
  },
  hardGateIdentities: M3_R5_ROUND_005_HARD_GATE_IDENTITIES,
  applicableHardGateIdentities: M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
  foldImprovementDeltaR: 0.02,
  validationFoldCount: 6,
  catastrophicFold: {
    expectancyRAtMost: -0.1,
    normalProfitFactorBelow: 0.8,
    noTradesIsCatastrophic: true,
    insufficientFoldSampleIsCatastrophic: true,
    noLossesIsCatastrophicSolelyBecausePfNull: false,
  },
  profitFactorStatusSemantics: {
    NORMAL: "COMPARE_NUMERIC_PF_TO_MINIMUM_PROFIT_FACTOR",
    NO_LOSSES: "PF_GATE_PASSES_ONLY_IF_ALL_SAMPLE_GATES_PASS",
    NO_TRADES: "FAIL",
    encodeInfinity: false,
  },
  redundancyApplicability: {
    candidateIds: M3_R5_ROUND_005_CANDIDATE_IDS,
    values: M3_R5_ROUND_005_REDUNDANCY_APPLICABILITY,
    notApplicableCountsAsPass: false,
  },
  aggregateValidationDefinition: {
    foldIds: ["F1", "F2", "F3", "F4", "F5", "F6"],
    role: "VALIDATION",
    construction: "CONCATENATE_NON_OVERLAPPING_FROZEN_VALIDATION_SEGMENTS",
    timeBasis: "signalTime",
    forbiddenInterpretations: ["AVERAGE_OF_FOLD_METRICS", "RESEARCH_PLUS_VALIDATION", "RANDOM_POOLED_PERIOD", "ALTERNATE_PERIOD"],
  },
  complexityDimensions: ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"],
  complexityTuples: M3_R5_ROUND_005_COMPLEXITY_TUPLES,
  selectionAlgorithm: {
    orderedCriteria: [
      { criterion: "improvedValidationFolds", direction: "DESCENDING" },
      { criterion: "aggregateValidationExpectancyR", direction: "DESCENDING_IF_DIFFERENCE_GT_COMPLEXITY_TIE_THRESHOLD" },
      { criterion: "complexityTuple", direction: "LEXICOGRAPHIC_ASCENDING" },
      { criterion: "aggregateValidationProfitFactor", direction: "DESCENDING" },
      { criterion: "candidateId", direction: "LEXICOGRAPHIC_ASCENDING" },
    ],
    complexityTieThresholdR: 0.01,
    noCandidateOutcome: M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME,
  },
  noEarlyEligibilityExit: true,
  allApplicableGatesConjunctive: true,
  noCandidateOutcome: M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME,
  performanceLock: M3_R5_ROUND_005_PERFORMANCE_LOCK,
  roundImmutability: {
    becomesImmutableAt: M3_R5_ROUND_005_PERFORMANCE_LOCK,
    invalidatingChanges: M3_R5_ROUND_005_INVALIDATING_CATEGORIES,
    actionOnChange: "ROUND_005_INVALIDATION_REQUIRED",
    postLockAction: "ROUND_005_INVALIDATION_REQUIRED",
    postLockMeaning: "STOP; DO NOT PATCH OR RERUN THE SAME ROUND; INVALIDATION IS REQUIRED.",
    priorResultsClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
  h17Qualification: {
    status: "DATA_NOT_AVAILABLE",
    performanceEligible: false,
    exclusionReason: "H17_DATA_QUALIFICATION_DATA_NOT_AVAILABLE",
    sourceSha: M3_R5_ROUND_005_SOURCE_SHA,
    qualificationJsonSha256: M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
    qualificationMarkdownSha256: M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
  },
});

export const M3_R5_ROUND_005_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r5-selection-gates-001",
  researchRoundId: M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  sourceSha: M3_R5_ROUND_005_SOURCE_SHA,
  inheritedRound004SelectionGateSha256: M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
  performanceLock: M3_R5_ROUND_005_PERFORMANCE_LOCK,
  controlId: M3_R5_ROUND_005_CONTROL_ID,
  candidateIds: M3_R5_ROUND_005_CANDIDATE_IDS,
  excludedCandidates: M3_R5_ROUND_005_EXCLUDED_CANDIDATES,
  selectionGates: M3_R5_ROUND_005_SELECTION_GATES,
  definitions: M3_R5_ROUND_005_DEFINITIONS,
  qualificationProvenance: {
    sourceSha: M3_R5_ROUND_005_SOURCE_SHA,
    qualificationJsonSha256: M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
    qualificationMarkdownSha256: M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
    qualificationStatus: "DATA_NOT_AVAILABLE",
    h17DataQualification: "DATA_NOT_AVAILABLE",
    h17ExcludedFromCandidateIds: true,
  },
});

export const M3_R5_ROUND_005_CANONICAL_JSON = stableStringify(M3_R5_ROUND_005_MACHINE_RECORD);

// Filled from the SHA-256 of M3_R5_ROUND_005_CANONICAL_JSON after the record is frozen.
export const M3_R5_ROUND_005_SELECTION_GATE_SHA256 =
  "e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5" as const;

export function validateM3R5Round005MachineRecord(
  record: typeof M3_R5_ROUND_005_MACHINE_RECORD = M3_R5_ROUND_005_MACHINE_RECORD,
): typeof M3_R5_ROUND_005_MACHINE_RECORD {
  if (record.recordVersion !== "m3-r5-selection-gates-001") throw new Error("M3-R5-B.1B gate record version mismatch.");
  if (record.researchRoundId !== M3_R5_ROUND_005_RESEARCH_ROUND_ID || record.sourceSha !== M3_R5_ROUND_005_SOURCE_SHA) {
    throw new Error("M3-R5-B.1B gate provenance mismatch.");
  }
  if (record.inheritedRound004SelectionGateSha256 !== M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256) {
    throw new Error("M3-R5-B.1B inherited Round-004 Gate SHA mismatch.");
  }
  if (record.performanceLock !== M3_R5_ROUND_005_PERFORMANCE_LOCK || record.controlId !== M3_R5_ROUND_005_CONTROL_ID) {
    throw new Error("M3-R5-B.1B lock or CONTROL identity mismatch.");
  }
  if (stableStringify(record.candidateIds) !== stableStringify(M3_R5_ROUND_005_CANDIDATE_IDS)) {
    throw new Error("M3-R5-B.1B candidate registry mismatch.");
  }
  if (record.candidateIds.includes("R5-H17-FUNDING-REVERSAL" as never)) {
    throw new Error("M3-R5-B.1B H17 must not enter the performance candidate registry.");
  }
  if (stableStringify(record.excludedCandidates) !== stableStringify(M3_R5_ROUND_005_EXCLUDED_CANDIDATES)) {
    throw new Error("M3-R5-B.1B excluded-candidate provenance mismatch.");
  }
  if (stableStringify(record.selectionGates) !== stableStringify(M3_R5_ROUND_005_SELECTION_GATES)) {
    throw new Error("M3-R5-B.1B gate thresholds or semantics changed.");
  }
  if (stableStringify(record.definitions) !== stableStringify(M3_R5_ROUND_005_DEFINITIONS)) {
    throw new Error("M3-R5-B.1B gate definitions changed.");
  }
  if (stableStringify(record.qualificationProvenance) !== stableStringify(M3_R5_ROUND_005_MACHINE_RECORD.qualificationProvenance)) {
    throw new Error("M3-R5-B.1B qualification provenance changed.");
  }
  if (createHash("sha256").update(stableStringify(record), "utf8").digest("hex") !== M3_R5_ROUND_005_SELECTION_GATE_SHA256) {
    throw new Error("M3-R5-B.1B Gate canonical SHA mismatch.");
  }
  return record;
}

export const BASELINE_002_RESEARCH_ROUND_005_SELECTION_GATES = M3_R5_ROUND_005_SELECTION_GATES;
export const BASELINE_002_RESEARCH_ROUND_005_DEFINITIONS = M3_R5_ROUND_005_DEFINITIONS;
export const BASELINE_002_RESEARCH_ROUND_005_MACHINE_RECORD = M3_R5_ROUND_005_MACHINE_RECORD;
export const BASELINE_002_RESEARCH_ROUND_005_CANONICAL_JSON = M3_R5_ROUND_005_CANONICAL_JSON;
export const BASELINE_002_RESEARCH_ROUND_005_SELECTION_GATE_SHA256 = M3_R5_ROUND_005_SELECTION_GATE_SHA256;
