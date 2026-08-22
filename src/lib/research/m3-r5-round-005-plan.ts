import { createHash } from "node:crypto";

import { RESEARCH_SYMBOLS } from "../config/constants.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import {
  M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_CANDIDATE_IDS,
  M3_R5_ROUND_005_COMPLEXITY_TUPLES,
  M3_R5_ROUND_005_CONTROL_ID,
  M3_R5_ROUND_005_DEFINITIONS,
  M3_R5_ROUND_005_EXCLUDED_CANDIDATES,
  M3_R5_ROUND_005_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_INVALIDATING_CATEGORIES,
  M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME,
  M3_R5_ROUND_005_PERFORMANCE_LOCK,
  M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
  M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
  M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  M3_R5_ROUND_005_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_SOURCE_SHA,
} from "./selection-gates-round-005.ts";
import {
  M3_R5_DATA_CLASSIFICATION,
  M3_R5_RESEARCH_END_ISO,
  M3_R5_RESEARCH_RANGE,
  M3_R5_RESEARCH_START_ISO,
} from "./m3-r5-round-005-protocol.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R5_ROUND_005_PLAN_SCHEMA_VERSION = "m3-r5-round-005-plan-001" as const;
export const M3_R5_ROUND_005_DATA_CLASSIFICATION = M3_R5_DATA_CLASSIFICATION;
export const M3_R5_ROUND_005_STRATEGY_VERSION = "baseline-001" as const;
export const M3_R5_ROUND_005_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R5_ROUND_005_CONTROL_REPORT_SCHEMA_VERSION = "m3-b-report-004" as const;

export const M3_R5_ROUND_005_PLAN = deepFreeze({
  schemaVersion: M3_R5_ROUND_005_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  sourceSha: M3_R5_ROUND_005_SOURCE_SHA,
  dataClassification: M3_R5_ROUND_005_DATA_CLASSIFICATION,
  researchUniverse: {
    startTime: M3_R5_RESEARCH_RANGE.startTime,
    endTime: M3_R5_RESEARCH_RANGE.endTime,
    startIso: M3_R5_RESEARCH_START_ISO,
    endIso: M3_R5_RESEARCH_END_ISO,
    rule: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
  symbols: Object.freeze([...RESEARCH_SYMBOLS]),
  folds: RESEARCH_FOLDS,
  control: {
    candidateId: M3_R5_ROUND_005_CONTROL_ID,
    strategyVersion: M3_R5_ROUND_005_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R5_ROUND_005_POLICY_VERSION,
    reportSchemaVersion: M3_R5_ROUND_005_CONTROL_REPORT_SCHEMA_VERSION,
    formalSignalPopulation: "R5-CONTROL-BASELINE-001",
    aggregateValidation: "F1-F6",
  },
  performanceCandidates: M3_R5_ROUND_005_CANDIDATE_IDS,
  candidateIds: M3_R5_ROUND_005_CANDIDATE_IDS,
  excludedCandidates: M3_R5_ROUND_005_EXCLUDED_CANDIDATES,
  h17: {
    status: "DATA_NOT_AVAILABLE",
    performanceEligible: false,
    exclusionReason: "H17_DATA_QUALIFICATION_DATA_NOT_AVAILABLE",
    qualificationSourceSha: M3_R5_ROUND_005_SOURCE_SHA,
    qualificationJsonSha256: M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
    qualificationMarkdownSha256: M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
  },
  qualificationProvenance: {
    sourceSha: M3_R5_ROUND_005_SOURCE_SHA,
    jsonPath: "docs/evidence/M3_R5_H17_DATA_QUALIFICATION.json",
    jsonSha256: M3_R5_ROUND_005_QUALIFICATION_JSON_SHA256,
    markdownPath: "docs/M3_R5_H17_DATA_QUALIFICATION.md",
    markdownSha256: M3_R5_ROUND_005_QUALIFICATION_MARKDOWN_SHA256,
    qualificationStatus: "DATA_NOT_AVAILABLE",
    h17DataQualification: "DATA_NOT_AVAILABLE",
  },
  inheritedRound004: {
    selectionGateSha256: M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
    semantics: "INHERIT_ALL_ROUND_004_HARD_GATE_VALUES_AND_FORMULAS_WITHOUT_WEAKENING",
    hardGateIdentities: M3_R5_ROUND_005_HARD_GATE_IDENTITIES,
    applicableHardGateIdentities: M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
  },
  selectionGateSha256: M3_R5_ROUND_005_SELECTION_GATE_SHA256,
  protocolReferences: {
    h15: {
      definition: "4H EMA20/EMA50 and ATR14 Wilder; strict prior-20 breakout using fully closed data",
      execution: "2 ATR stop; exactly 3R TP; 48 held 1H candles; bt-policy-003 fill/settlement",
    },
    h16: {
      definition: "neutral abs(EMA20_4H - EMA50_4H) / ATR14_4H <= 0.50; 1H EMA20/ATR14/RSI14 Wilder; 1.50 ATR deviation; RSI <= 30 or >= 70",
      execution: "fixed decision-time EMA20 target; actual bt-policy-003 entry-fill geometry; 1.50 ATR stop; 12 held candles",
    },
    h18: {
      definition: "six prior compression candles with TR <= 0.75 ATR; current expansion TR >= 1.50 previous ATR; strict prior-12 breakout",
      execution: "1.50 ATR stop; exactly 3R TP; 24 held candles; bt-policy-003 fill/settlement",
    },
  },
  complexityTuples: M3_R5_ROUND_005_COMPLEXITY_TUPLES,
  aggregateValidation: {
    foldIds: ["F1", "F2", "F3", "F4", "F5", "F6"],
    role: "VALIDATION",
    construction: "CONCATENATE_NON_OVERLAPPING_FROZEN_VALIDATION_SEGMENTS_BY_SIGNAL_TIME",
  },
  selection: {
    applicableHardGateCount: 10,
    allApplicableGatesConjunctive: true,
    noEarlyEligibilityExit: true,
    noCandidateOutcome: M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME,
    ordering: [
      "more improved validation folds",
      "higher aggregate validation expectancy only when difference > 0.01 R/trade",
      "lexicographically simpler frozen complexity tuple",
      "higher aggregate profit factor",
      "candidateId ascending",
    ],
    complexityTieThresholdR: 0.01,
  },
  governance: {
    noCombinations: true,
    noTuning: true,
    noOptimizer: true,
    noRandomSearch: true,
    noThresholdSweep: true,
    noPostResultCandidateReplacement: true,
    noFutureDataAfter: M3_R5_RESEARCH_END_ISO,
    oneAuthoritativePerformanceExecutionOnlyLater: true,
  },
  performance: {
    status: "NOT_GENERATED",
    authorization: "NOT_AUTHORIZED",
    lock: M3_R5_ROUND_005_PERFORMANCE_LOCK,
    invalidatingCategories: M3_R5_ROUND_005_INVALIDATING_CATEGORIES,
    postLockAction: "ROUND_005_INVALIDATION_REQUIRED",
  },
  status: {
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
  },
  definitions: M3_R5_ROUND_005_DEFINITIONS,
});

export const M3_R5_ROUND_005_PLAN_CANONICAL_JSON = stableStringify(M3_R5_ROUND_005_PLAN);

// Filled from the SHA-256 of M3_R5_ROUND_005_PLAN_CANONICAL_JSON after the plan is frozen.
export const M3_R5_ROUND_005_PLAN_SHA256 =
  "ab16a63462825441e00682f2b2bcbe04cb249e469843ce7f9a097017d992b6d1" as const;

export function validateM3R5Round005Plan(
  plan: typeof M3_R5_ROUND_005_PLAN = M3_R5_ROUND_005_PLAN,
): typeof M3_R5_ROUND_005_PLAN {
  if (plan.schemaVersion !== M3_R5_ROUND_005_PLAN_SCHEMA_VERSION) throw new Error("M3-R5-B.1B Plan schema mismatch.");
  if (plan.researchRoundId !== M3_R5_ROUND_005_RESEARCH_ROUND_ID || plan.sourceSha !== M3_R5_ROUND_005_SOURCE_SHA) {
    throw new Error("M3-R5-B.1B Plan provenance mismatch.");
  }
  if (plan.dataClassification !== M3_R5_ROUND_005_DATA_CLASSIFICATION) throw new Error("M3-R5-B.1B data classification changed.");
  if (stableStringify(plan.candidateIds) !== stableStringify(M3_R5_ROUND_005_CANDIDATE_IDS)) {
    throw new Error("M3-R5-B.1B Plan candidate registry changed.");
  }
  if (plan.candidateIds.includes("R5-H17-FUNDING-REVERSAL" as never)) throw new Error("M3-R5-B.1B H17 entered performance candidates.");
  if (stableStringify(plan.excludedCandidates) !== stableStringify(M3_R5_ROUND_005_EXCLUDED_CANDIDATES)) {
    throw new Error("M3-R5-B.1B Plan exclusion provenance changed.");
  }
  if (plan.h17.status !== "DATA_NOT_AVAILABLE" || plan.h17.performanceEligible !== false) {
    throw new Error("M3-R5-B.1B H17 availability status changed.");
  }
  if (plan.selectionGateSha256 !== M3_R5_ROUND_005_SELECTION_GATE_SHA256) throw new Error("M3-R5-B.1B Plan Gate SHA mismatch.");
  if (plan.inheritedRound004.selectionGateSha256 !== M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256) {
    throw new Error("M3-R5-B.1B inherited Round-004 Gate SHA mismatch.");
  }
  if (stableStringify(plan.folds) !== stableStringify(RESEARCH_FOLDS)) throw new Error("M3-R5-B.1B fold registry changed.");
  if (plan.control.backtestPolicyVersion !== M3_R5_ROUND_005_POLICY_VERSION) throw new Error("M3-R5-B.1B policy changed.");
  if (plan.performance.status !== "NOT_GENERATED" || plan.performance.authorization !== "NOT_AUTHORIZED") {
    throw new Error("M3-R5-B.1B performance is unexpectedly authorized or generated.");
  }
  if (plan.status.baseline002Status !== "NOT_FROZEN" || plan.status.m3JStatus !== "BLOCKED" || plan.status.m4Status !== "NOT_STARTED") {
    throw new Error("M3-R5-B.1B milestone status boundary changed.");
  }
  if (createHash("sha256").update(stableStringify(plan), "utf8").digest("hex") !== M3_R5_ROUND_005_PLAN_SHA256) {
    throw new Error("M3-R5-B.1B Plan canonical SHA mismatch.");
  }
  return plan;
}

export const BASELINE_002_RESEARCH_ROUND_005_PLAN = M3_R5_ROUND_005_PLAN;
export const BASELINE_002_RESEARCH_ROUND_005_PLAN_CANONICAL_JSON = M3_R5_ROUND_005_PLAN_CANONICAL_JSON;
export const BASELINE_002_RESEARCH_ROUND_005_PLAN_SHA256 = M3_R5_ROUND_005_PLAN_SHA256;
