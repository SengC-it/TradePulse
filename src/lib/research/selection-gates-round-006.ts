import { createHash } from "node:crypto";

import type { NumericSelectionGate, SelectionGateSchema } from "./types.ts";
import { validateSelectionGateSchema } from "./gates.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES,
  M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R4_ROUND_004_HARD_GATE_IDENTITIES,
} from "./selection-gates-round-004.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R6_ROUND_006_CANDIDATE_IDS,
  R6_CANDIDATE_REGISTRY,
  R6_COMPLEXITY_TUPLES,
  R6_FROZEN_FOLD_IDS,
  R6_SYMBOLS,
  R6_FORMULA_DEFINITIONS,
  R6_GATE_INHERITANCE,
  M3_R6_PERFORMANCE_LOCK,
  M3_R6_PROTOCOL_VERSION,
  M3_R6_RESEARCH_ROUND_ID,
  R6_PROTOCOL_SOURCE_SHA,
  type R6CandidateId,
  type R6ComplexityTuple,
} from "./m3-r6-round-006-protocol.ts";

export const M3_R6_ROUND_006_RESEARCH_ROUND_ID = M3_R6_RESEARCH_ROUND_ID;
export const M3_R6_ROUND_006_FREEZE_SOURCE_SHA = R6_PROTOCOL_SOURCE_SHA;
export const M3_R6_ROUND_006_SOURCE_SHA = M3_R6_ROUND_006_FREEZE_SOURCE_SHA;
export const M3_R6_ROUND_006_CONTROL_ID = "R6-CONTROL-BASELINE-001" as const;
export const M3_R6_ROUND_006_PERFORMANCE_LOCK = M3_R6_PERFORMANCE_LOCK;
export const M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME = "NO BASELINE-002 CANDIDATE — ROUND-006" as const;
export const M3_R6_ROUND_006_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256 = R6_GATE_INHERITANCE.inheritedRound004GateSha256;
export const M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256 = R6_GATE_INHERITANCE.inheritedRound005GateSha256;
export const M3_R6_ROUND_006_INHERITED_GATE_SHA256 = M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256;

export { M3_R6_ROUND_006_CANDIDATE_IDS, R6_CANDIDATE_REGISTRY as M3_R6_ROUND_006_VARIANT_REGISTRY };
export type M3R6Round006CandidateId = R6CandidateId;

export const M3_R6_ROUND_006_HARD_GATE_IDENTITIES = Object.freeze([
  ...M3_R4_ROUND_004_HARD_GATE_IDENTITIES,
] as const);
export const M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES = Object.freeze([
  ...M3_R4_ROUND_004_APPLICABLE_HARD_GATE_IDENTITIES,
] as const);

const redundancyCandidateIds = new Set<R6CandidateId>([
  "R6-A1-COOLDOWN-12H",
  "R6-A2-COOLDOWN-24H",
  "R6-A3-COOLDOWN-48H",
  "R6-B1-TOP1-SCORE",
  "R6-B2-TOP2-SCORE",
  "R6-B3-TOP1-RELATIVE-STRENGTH",
  "R6-B4-TOP2-RELATIVE-STRENGTH",
]);

export const M3_R6_ROUND_006_REDUNDANCY_APPLICABILITY = deepFreeze(
  Object.fromEntries(
    M3_R6_ROUND_006_CANDIDATE_IDS.map((candidateId) => [candidateId, redundancyCandidateIds.has(candidateId) ? "REQUIRED" : "NOT_APPLICABLE"]),
  ) as Record<R6CandidateId, "REQUIRED" | "NOT_APPLICABLE">,
);

export const M3_R6_ROUND_006_INVALIDATING_CATEGORIES = Object.freeze([
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

export const M3_R6_ROUND_006_SELECTION_GATES: SelectionGateSchema = validateSelectionGateSchema({
  ...BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATES,
  researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
  sourceSha: M3_R6_ROUND_006_SOURCE_SHA,
});

export const M3_R6_ROUND_006_DEFINITIONS = deepFreeze({
  researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
  protocolVersion: M3_R6_PROTOCOL_VERSION,
  hardGateIdentities: M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
  applicableHardGateIdentities: M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
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
    candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
    values: M3_R6_ROUND_006_REDUNDANCY_APPLICABILITY,
    requiredGate: "REQUIRED_FOR_REDUNDANCY_AND_CROSS_SECTIONAL_CANDIDATES;NOT_APPLICABLE_FOR_TREND_OR_BREAKOUT_ONLY_CANDIDATES",
    notApplicableCountsAsPass: false,
  },
  formulas: R6_FORMULA_DEFINITIONS,
  candidateRegistry: R6_CANDIDATE_REGISTRY,
  complexityTuples: R6_COMPLEXITY_TUPLES,
  selectionAlgorithm: {
    version: "m3-r6-selection-algorithm-001",
    orderedCriteria: [
      { criterion: "improvedValidationFolds", direction: "DESCENDING" },
      { criterion: "aggregateValidationExpectancyR", direction: "DESCENDING_IF_DIFFERENCE_OUTSIDE_INCLUSIVE_0_01_TIE_BAND" },
      { criterion: "complexityTuple", direction: "LEXICOGRAPHIC_ASCENDING" },
      { criterion: "aggregateValidationProfitFactor", direction: "DESCENDING_NULL_LAST" },
      { criterion: "candidateId", direction: "LEXICOGRAPHIC_ASCENDING" },
    ],
    stages: ["ELIGIBILITY", "IMPROVED_VALIDATION_FOLDS", "EXPECTANCY_TIE_BAND", "COMPLEXITY", "PROFIT_FACTOR", "CANDIDATE_ID"],
    expectancyTieBandThresholdR: 0.01,
    expectancyTieBandBoundary: "INCLUSIVE",
    expectancyTieBandFloatingComparison: "SCALE_AWARE_NUMBER_EPSILON",
    expectancyTieBandFloatingToleranceFormula: "tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold))",
    expectancyTieBandRule: "difference = maxExpectancy - candidateExpectancy; inside iff difference - threshold <= tolerance",
    complexityTieThresholdR: 0.01,
    nullProfitFactorOrder: "NULL_LAST",
    eligibleCandidateIdsOrder: "LEXICOGRAPHIC_ASCENDING",
  },
  noEarlyEligibilityExit: true,
  allApplicableGatesConjunctive: true,
  noCandidateOutcome: M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
  performanceLock: M3_R6_ROUND_006_PERFORMANCE_LOCK,
  roundImmutability: {
    becomesImmutableAt: M3_R6_ROUND_006_PERFORMANCE_LOCK,
    invalidatingChanges: M3_R6_ROUND_006_INVALIDATING_CATEGORIES,
    actionOnChange: "ROUND_006_INVALIDATION_REQUIRED",
    postLockAction: "ROUND_006_INVALIDATION_REQUIRED",
    postLockMeaning: "STOP; DO NOT PATCH OR RERUN THE SAME ROUND; INVALIDATION IS REQUIRED.",
    priorResultsClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
});

export const M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY = deepFreeze({
  protocolVersion: M3_R6_PROTOCOL_VERSION,
  sourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  path: "src/lib/research/m3-r6-round-006-protocol.ts",
  identityRule: "ROUND_FREEZE_SOURCE_IS_AUTHORITATIVE_MAIN_SHA_AT_ROUND_START;WORKING_IMPLEMENTATION_IS_BOUND_BY_PROTOCOL_VERSION_AND_GIT_HEAD_AT_PERFORMANCE_PREFLIGHT",
});

export const M3_R6_ROUND_006_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r6-selection-gates-002",
  researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
  protocolVersion: M3_R6_PROTOCOL_VERSION,
  freezeSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  inheritedRound004SelectionGateSha256: M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256,
  inheritedRound005SelectionGateSha256: M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256,
  performanceExecutionSourceSha: null,
  performanceLock: M3_R6_ROUND_006_PERFORMANCE_LOCK,
  controlId: M3_R6_ROUND_006_CONTROL_ID,
  symbolUniverse: R6_SYMBOLS,
  foldIds: R6_FROZEN_FOLD_IDS,
  candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
  variantRegistry: R6_CANDIDATE_REGISTRY,
  complexityTuples: R6_COMPLEXITY_TUPLES,
  selectionGates: M3_R6_ROUND_006_SELECTION_GATES,
  definitions: M3_R6_ROUND_006_DEFINITIONS,
  b1aProtocolSourceIdentity: M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
  baseline002Status: "NOT_FROZEN",
  m3R6Status: "FROZEN_PENDING_ACCEPTANCE",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const M3_R6_ROUND_006_CANONICAL_JSON = stableStringify(M3_R6_ROUND_006_MACHINE_RECORD);

// Replaced after the machine record is final; the value is never used as a tuning input.
export const M3_R6_ROUND_006_SELECTION_GATE_SHA256 =
  "a56ebfa2702ded5d9de0996d3d26b4d2251326e5623e3b37c69f7190e752b871" as const;

export function validateM3R6Round006MachineRecord(
  record: typeof M3_R6_ROUND_006_MACHINE_RECORD = M3_R6_ROUND_006_MACHINE_RECORD,
): typeof M3_R6_ROUND_006_MACHINE_RECORD {
  if (record.recordVersion !== "m3-r6-selection-gates-002") throw new Error("M3-R6 Gate record version mismatch.");
  if (record.researchRoundId !== M3_R6_ROUND_006_RESEARCH_ROUND_ID || record.protocolVersion !== M3_R6_PROTOCOL_VERSION) throw new Error("M3-R6 Gate provenance mismatch.");
  if (record.freezeSourceSha !== M3_R6_ROUND_006_FREEZE_SOURCE_SHA || record.performanceExecutionSourceSha !== null) throw new Error("M3-R6 Gate freeze or execution-source contract changed.");
  if (stableStringify(record.symbolUniverse) !== stableStringify(R6_SYMBOLS) || stableStringify(record.foldIds) !== stableStringify(R6_FROZEN_FOLD_IDS)) throw new Error("M3-R6 Gate universe changed.");
  if (stableStringify(record.candidateIds) !== stableStringify(M3_R6_ROUND_006_CANDIDATE_IDS)) throw new Error("M3-R6 candidate registry changed.");
  if (stableStringify(record.variantRegistry) !== stableStringify(R6_CANDIDATE_REGISTRY)) throw new Error("M3-R6 variant registry changed.");
  if (stableStringify(record.complexityTuples) !== stableStringify(R6_COMPLEXITY_TUPLES)) throw new Error("M3-R6 complexity tuples changed.");
  if (stableStringify(record.selectionGates) !== stableStringify(M3_R6_ROUND_006_SELECTION_GATES)) throw new Error("M3-R6 gate values changed.");
  if (stableStringify(record.definitions) !== stableStringify(M3_R6_ROUND_006_DEFINITIONS)) throw new Error("M3-R6 gate definitions changed.");
  if (stableStringify(record.b1aProtocolSourceIdentity) !== stableStringify(M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY)) throw new Error("M3-R6 protocol identity changed.");
  if (record.baseline002Status !== "NOT_FROZEN" || record.m3JStatus !== "BLOCKED" || record.m4Status !== "NOT_STARTED") throw new Error("M3-R6 milestone boundary changed.");
  const hash = createHash("sha256").update(stableStringify(record), "utf8").digest("hex");
  if (hash !== M3_R6_ROUND_006_SELECTION_GATE_SHA256) throw new Error("M3-R6 Gate canonical SHA mismatch.");
  return record;
}

export type M3R6CandidateResultStatus = "COMPLETE" | "DATA_INCOMPLETE" | "ENTRY_UNAVAILABLE" | "PERIOD_END_CENSORED";

export type M3R6CandidateGateInput = Readonly<{
  candidateId: R6CandidateId;
  resultStatus: M3R6CandidateResultStatus;
  aggregateImprovement: number | null;
  improvedValidationFolds: number | null;
  catastrophicFolds: number | null;
  netExpectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: "NORMAL" | "NO_TRADES" | "NO_LOSSES";
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
  formalSignals: number | null;
  minimumFoldExecutedTrades: number | null;
  redundancyImprovement: number | null;
}>;

export type M3R6GateResult = Readonly<{
  gateId: (typeof M3_R6_ROUND_006_HARD_GATE_IDENTITIES)[number];
  status: "PASS" | "FAIL" | "INCOMPLETE" | "NOT_APPLICABLE";
  applicability: "APPLICABLE" | "NOT_APPLICABLE";
  actualValue: number | null | "NOT_APPLICABLE";
  threshold: number;
}>;

export type M3R6CandidateGateEvaluation = Readonly<{
  candidateId: R6CandidateId;
  gateResults: readonly M3R6GateResult[];
  applicableGateCount: number;
  passedApplicableGateCount: number;
  failedGateIds: readonly string[];
  eligibility: "ELIGIBLE" | "INELIGIBLE" | "INCOMPLETE";
}>;

function finite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function passesNumericGate(gate: NumericSelectionGate, value: number | null): boolean {
  if (!finite(value)) return false;
  return gate.comparison === "AT_LEAST" ? value >= gate.value : value <= gate.value;
}

export function evaluateM3R6CandidateGates(input: M3R6CandidateGateInput): M3R6CandidateGateEvaluation {
  const gates = M3_R6_ROUND_006_SELECTION_GATES;
  const sampleGatesPass = passesNumericGate(gates.minimumFormalSignals, input.formalSignals)
    && passesNumericGate(gates.minimumExecutedTrades, input.minimumFoldExecutedTrades)
    && passesNumericGate(gates.catastrophicFoldLimit, input.catastrophicFolds);
  const actualValues: Record<string, number | null | "NOT_APPLICABLE"> = {
    minimumAggregateImprovement: input.aggregateImprovement,
    minimumImprovedValidationFolds: input.improvedValidationFolds,
    catastrophicFoldLimit: input.catastrophicFolds,
    minimumNetExpectancy: input.netExpectancyR,
    minimumProfitFactor: input.profitFactorStatus === "NO_LOSSES" && sampleGatesPass ? gates.minimumProfitFactor.value : input.profitFactor,
    maximumSymbolConcentration: input.topSymbolShareOfPositiveNetR,
    maximumSingleTradeConcentration: input.largestSingleTradeShareOfPositiveNetR,
    maximumFeeBurdenRatio: input.feeBurdenRatio,
    requiredRedundancyImprovement: M3_R6_ROUND_006_REDUNDANCY_APPLICABILITY[input.candidateId] === "REQUIRED" ? input.redundancyImprovement : "NOT_APPLICABLE",
    minimumFormalSignals: input.formalSignals,
    minimumExecutedTrades: input.minimumFoldExecutedTrades,
  };
  const gateResults = M3_R6_ROUND_006_HARD_GATE_IDENTITIES.map((gateId) => {
    const isApplicable = M3_R6_ROUND_006_REDUNDANCY_APPLICABILITY[input.candidateId] === "REQUIRED" || gateId !== "requiredRedundancyImprovement";
    if (!isApplicable) return Object.freeze({ gateId, status: "NOT_APPLICABLE", applicability: "NOT_APPLICABLE", actualValue: "NOT_APPLICABLE", threshold: gates[gateId].value } as const);
    const actualValue = actualValues[gateId] ?? null;
    let status: M3R6GateResult["status"];
    if (input.resultStatus === "DATA_INCOMPLETE") status = "INCOMPLETE";
    else if (input.resultStatus !== "COMPLETE") status = "FAIL";
    else if (gateId === "minimumProfitFactor" && input.profitFactorStatus === "NO_TRADES") status = "FAIL";
    else if (gateId === "minimumProfitFactor" && input.profitFactorStatus === "NO_LOSSES") status = sampleGatesPass ? "PASS" : "FAIL";
    else status = passesNumericGate(gates[gateId], actualValue as number | null) ? "PASS" : "FAIL";
    return Object.freeze({ gateId, status, applicability: "APPLICABLE", actualValue, threshold: gates[gateId].value } as const);
  });
  const applicable = gateResults.filter((result) => result.applicability === "APPLICABLE");
  const passed = applicable.filter((result) => result.status === "PASS");
  const failedGateIds = applicable.filter((result) => result.status !== "PASS").map((result) => result.gateId);
  return Object.freeze({
    candidateId: input.candidateId,
    gateResults: Object.freeze(gateResults),
    applicableGateCount: applicable.length,
    passedApplicableGateCount: passed.length,
    failedGateIds: Object.freeze(failedGateIds),
    eligibility: input.resultStatus === "DATA_INCOMPLETE" ? "INCOMPLETE" : failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE",
  });
}

export type M3R6SelectionCandidate = Readonly<{
  candidateId: R6CandidateId;
  eligible: boolean;
  improvedValidationFolds: number;
  aggregateValidationExpectancyR: number;
  complexityTuple: R6ComplexityTuple;
  aggregateValidationProfitFactor: number | null;
}>;

export type M3R6SelectionResult = Readonly<{
  selectionAlgorithmApplied: boolean;
  eligibleCandidateIds: readonly R6CandidateId[];
  selectedCandidateId: R6CandidateId | null;
  finalDecision: string;
}>;

function compareComplexity(left: R6ComplexityTuple, right: R6ComplexityTuple): number {
  for (const dimension of ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"] as const) {
    if (left[dimension] !== right[dimension]) return left[dimension] - right[dimension];
  }
  return 0;
}

export function isWithinInclusiveExpectancyTieBand(maxExpectancy: number, candidateExpectancy: number, threshold: number): boolean {
  const difference = maxExpectancy - candidateExpectancy;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold));
  return difference - threshold <= tolerance;
}

function compareFinalSelectionOrder(left: M3R6SelectionCandidate, right: M3R6SelectionCandidate): number {
  const complexity = compareComplexity(left.complexityTuple, right.complexityTuple);
  if (complexity !== 0) return complexity;
  const leftPf = left.aggregateValidationProfitFactor;
  const rightPf = right.aggregateValidationProfitFactor;
  if (leftPf !== rightPf) {
    if (leftPf === null) return 1;
    if (rightPf === null) return -1;
    return rightPf - leftPf;
  }
  return left.candidateId.localeCompare(right.candidateId);
}

function selectEligibleCandidatesByFrozenStages(eligible: readonly M3R6SelectionCandidate[]): readonly M3R6SelectionCandidate[] {
  const maxFolds = Math.max(...eligible.map((candidate) => candidate.improvedValidationFolds));
  const foldCohort = eligible.filter((candidate) => candidate.improvedValidationFolds === maxFolds);
  const maxExpectancy = Math.max(...foldCohort.map((candidate) => candidate.aggregateValidationExpectancyR));
  const expectancyCohort = foldCohort.filter((candidate) => isWithinInclusiveExpectancyTieBand(maxExpectancy, candidate.aggregateValidationExpectancyR, M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandThresholdR));
  return [...expectancyCohort].sort(compareFinalSelectionOrder);
}

export function selectM3R6Candidate(candidates: readonly M3R6SelectionCandidate[]): M3R6SelectionResult {
  const eligible = candidates.filter((candidate) => candidate.eligible);
  if (eligible.length === 0) return Object.freeze({ selectionAlgorithmApplied: false, eligibleCandidateIds: Object.freeze([]), selectedCandidateId: null, finalDecision: M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME });
  const ordered = selectEligibleCandidatesByFrozenStages(eligible);
  return Object.freeze({
    selectionAlgorithmApplied: true,
    eligibleCandidateIds: Object.freeze([...eligible].map((candidate) => candidate.candidateId).sort((left, right) => left.localeCompare(right))),
    selectedCandidateId: ordered[0]!.candidateId,
    finalDecision: "SELECTED_BASELINE_002_CANDIDATE",
  });
}

export const BASELINE_002_RESEARCH_ROUND_006_SELECTION_GATES = M3_R6_ROUND_006_SELECTION_GATES;
export const BASELINE_002_RESEARCH_ROUND_006_DEFINITIONS = M3_R6_ROUND_006_DEFINITIONS;
export const BASELINE_002_RESEARCH_ROUND_006_MACHINE_RECORD = M3_R6_ROUND_006_MACHINE_RECORD;
export const BASELINE_002_RESEARCH_ROUND_006_CANONICAL_JSON = M3_R6_ROUND_006_CANONICAL_JSON;
export const BASELINE_002_RESEARCH_ROUND_006_SELECTION_GATE_SHA256 = M3_R6_ROUND_006_SELECTION_GATE_SHA256;
