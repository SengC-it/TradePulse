import { createHash } from "node:crypto";

import type { NumericSelectionGate, SelectionGateSchema } from "./types.ts";
import {
  M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_DEFINITIONS,
  M3_R5_ROUND_005_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_SELECTION_GATES,
} from "./selection-gates-round-005.ts";
import {
  M3_R6_PROTOCOL_VERSION,
  R6_COMPLEXITY_TUPLES,
  R6_FROZEN_FOLD_IDS,
  R6_H22_ROUTE_MAP,
  R6_SYMBOLS,
  type R6ComplexityTuple,
} from "./m3-r6-round-006-protocol.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R6_ROUND_006_RESEARCH_ROUND_ID = "baseline-002-research-round-006" as const;
export const M3_R6_ROUND_006_FREEZE_SOURCE_SHA =
  "b8e03e34360ceaaf515882226940eba99bf89b1c" as const;
export const M3_R6_ROUND_006_SOURCE_SHA = M3_R6_ROUND_006_FREEZE_SOURCE_SHA;
export const M3_R6_ROUND_006_CONTROL_ID = "R6-CONTROL-BASELINE-001" as const;
export const M3_R6_ROUND_006_PERFORMANCE_LOCK =
  "FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R6_ROUND_006_POST_LOCK_INVALIDATION =
  "ROUND_006_INVALIDATION_REQUIRED" as const;
export const M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME =
  "NO ROUND-006 CANDIDATE" as const;
export const M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256 =
  M3_R5_ROUND_005_SELECTION_GATE_SHA256;
export const M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256 =
  M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256;
export const M3_R6_ROUND_006_INHERITED_GATE_SHA256 =
  M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256;

export const M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY = deepFreeze({
  sourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  protocolPath: "src/lib/research/m3-r6-round-006-protocol.ts",
  protocolGitBlobSha: "11190e1c857071756cd26c744ac726650b64a01c",
  documentationPath: "docs/M3_R6_B1A_PROTOCOL.md",
  documentationGitBlobSha: "ff15bae2cf393e70a7ecd07f4acd5e819e97876c",
  testPath: "tests/m3-r6-b1a-protocol.test.ts",
  testGitBlobSha: "870d4eda92f1ba07d44e48d6d268e5e87acda7a5",
} as const);

export const M3_R6_ROUND_006_CANDIDATE_IDS = Object.freeze([
  "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
  "R6-H20-STRUCTURAL-TREND-CONTINUATION",
  "R6-H21-ECONOMIC-RANGE-IMPULSE",
  "R6-H22-PREDECLARED-REGIME-ROUTING",
] as const);

export const M3_R6_ROUND_006_VARIANT_REGISTRY = Object.freeze([
  Object.freeze({
    candidateId: "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
    variantId: "R6-H19-V1",
    mechanismFamily: "CROSS_SECTIONAL_RELATIVE_STRENGTH",
  }),
  Object.freeze({
    candidateId: "R6-H20-STRUCTURAL-TREND-CONTINUATION",
    variantId: "R6-H20-V1",
    mechanismFamily: "STRUCTURAL_TREND_CONTINUATION",
  }),
  Object.freeze({
    candidateId: "R6-H21-ECONOMIC-RANGE-IMPULSE",
    variantId: "R6-H21-V1",
    mechanismFamily: "ECONOMIC_RANGE_IMPULSE",
  }),
  Object.freeze({
    candidateId: "R6-H22-PREDECLARED-REGIME-ROUTING",
    variantId: "R6-H22-V1",
    mechanismFamily: "PREDECLARED_REGIME_ROUTING",
  }),
] as const);

export type M3R6Round006CandidateId = (typeof M3_R6_ROUND_006_CANDIDATE_IDS)[number];

export const M3_R6_ROUND_006_COMPLEXITY_TUPLES: Readonly<
  Record<M3R6Round006CandidateId, R6ComplexityTuple>
> = deepFreeze({
  ...R6_COMPLEXITY_TUPLES,
});

export const M3_R6_ROUND_006_CANDIDATE_REGISTRY = deepFreeze(
  M3_R6_ROUND_006_VARIANT_REGISTRY.map((variant) => ({
    ...variant,
    variantCount: 1,
    complexity:
      M3_R6_ROUND_006_COMPLEXITY_TUPLES[
        variant.candidateId as M3R6Round006CandidateId
      ],
  })),
);

export const M3_R6_ROUND_006_HARD_GATE_IDENTITIES = Object.freeze([
  ...M3_R5_ROUND_005_HARD_GATE_IDENTITIES,
] as const);

export const M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES = Object.freeze([
  ...M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
] as const);

export const M3_R6_ROUND_006_REDUNDANCY_APPLICABILITY = deepFreeze(
  Object.fromEntries(
    M3_R6_ROUND_006_CANDIDATE_IDS.map((candidateId) => [candidateId, "NOT_APPLICABLE"]),
  ) as Record<M3R6Round006CandidateId, "NOT_APPLICABLE">,
);

export const M3_R6_ROUND_006_INVALIDATING_CATEGORIES = Object.freeze([
  ...M3_R5_ROUND_005_DEFINITIONS.roundImmutability.invalidatingChanges,
  "PROTOCOL_SOURCE_IDENTITY",
  "RESEARCH_UNIVERSE",
  "RESEARCH_FOLD_REGISTRY",
  "PERFORMANCE_SOURCE_BINDING",
  "CONTROL_IDENTITY",
] as const);

export const M3_R6_ROUND_006_SELECTION_GATES: SelectionGateSchema =
  deepFreeze({
    ...M3_R5_ROUND_005_SELECTION_GATES,
    researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
    sourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  });

export type M3R6CandidateResultStatus =
  | "COMPLETE"
  | "DATA_INCOMPLETE"
  | "ENTRY_UNAVAILABLE"
  | "INVALID_STOP_GEOMETRY"
  | "PERIOD_END_CENSORED"
  | "NO_SIGNAL";

export const M3_R6_ROUND_006_RESULT_STATUS_HANDLING = deepFreeze({
  DATA_INCOMPLETE: {
    classification: "INCOMPLETE_EVIDENCE",
    gateOutcome: "INELIGIBLE",
    metricFallback: "NULL;APPLICABLE_GATES_FAIL",
  },
  ENTRY_UNAVAILABLE: {
    classification: "NON_EXECUTED",
    gateOutcome: "INELIGIBLE",
    metricFallback: "NON_EXECUTED;APPLICABLE_EXECUTION_GATES_FAIL",
  },
  INVALID_STOP_GEOMETRY: {
    classification: "NON_EXECUTED",
    gateOutcome: "INELIGIBLE",
    metricFallback: "NON_EXECUTED;APPLICABLE_EXECUTION_GATES_FAIL",
  },
  PERIOD_END_CENSORED: {
    classification: "NON_EXECUTED_CENSORED",
    gateOutcome: "INELIGIBLE",
    metricFallback: "CENSORED;APPLICABLE_EXECUTION_GATES_FAIL",
  },
  NO_SIGNAL: {
    classification: "NOT_A_FORMAL_SIGNAL",
    gateOutcome: "EXCLUDED_FROM_CANDIDATE_METRICS",
    metricFallback: "NOT_A_FORMAL_SIGNAL",
  },
  COMPLETE: {
    classification: "COMPLETE",
    gateOutcome: "EVALUATE_ALL_APPLICABLE_GATES",
    metricFallback: "NONE",
  },
  zeroTradeFold: {
    classification: "COMPLETE_WITH_ZERO_TRADES",
    gateOutcome: "CATASTROPHIC_AND_SAMPLE_GATES_FAIL",
    metricFallback: "ZERO_TRADES_IS_CATASTROPHIC",
  },
  insufficientSampleFold: {
    classification: "COMPLETE_WITH_INSUFFICIENT_SAMPLE",
    gateOutcome: "CATASTROPHIC_AND_SAMPLE_GATES_FAIL",
    metricFallback: "INSUFFICIENT_SAMPLE_IS_CATASTROPHIC",
  },
} as const);

export const M3_R6_ROUND_006_DEFINITIONS = deepFreeze({
  researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
  freezeSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  protocolSourceIdentity: M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
  eligibilityPolicy: {
    mode: "ALL_APPLICABLE_GATES_MUST_PASS",
    notApplicableHandling: "EXCLUDED_FROM_CONJUNCTION_NOT_COUNTED_AS_PASS",
    performanceGateFailure: "INELIGIBLE",
    integrityFailure: "INELIGIBLE_INCOMPLETE_EVIDENCE",
  },
  hardGateIdentities: M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
  applicableHardGateIdentities: M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
  gateEvaluationOrder: M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
  gateValuesInheritedFrom: "ACCEPTED_ROUND_005_GATE_WITHOUT_WEAKENING",
  foldImprovementDeltaR: M3_R5_ROUND_005_DEFINITIONS.foldImprovementDeltaR,
  validationFoldCount: M3_R5_ROUND_005_DEFINITIONS.validationFoldCount,
  catastrophicFold: M3_R5_ROUND_005_DEFINITIONS.catastrophicFold,
  profitFactorStatusSemantics: M3_R5_ROUND_005_DEFINITIONS.profitFactorStatusSemantics,
  redundancyApplicability: {
    candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
    values: M3_R6_ROUND_006_REDUNDANCY_APPLICABILITY,
    notApplicableCountsAsPass: false,
  },
  resultStatusHandling: M3_R6_ROUND_006_RESULT_STATUS_HANDLING,
  aggregateValidationDefinition: {
    foldIds: ["F1", "F2", "F3", "F4", "F5", "F6"],
    role: "VALIDATION",
    construction: "CONCATENATE_NON_OVERLAPPING_FROZEN_VALIDATION_SEGMENTS_BY_SIGNAL_TIME",
    timeBasis: "signalTime",
    forbiddenInterpretations: [
      "AVERAGE_OF_FOLD_METRICS",
      "RESEARCH_PLUS_VALIDATION",
      "RANDOM_POOLED_PERIOD",
      "ALTERNATE_PERIOD",
    ],
  },
  complexityDimensions: [
    "newRules",
    "newTunableThresholds",
    "modifiedBaselineRules",
    "mechanismFamiliesUsed",
  ],
  complexityTuples: M3_R6_ROUND_006_COMPLEXITY_TUPLES,
  selectionAlgorithm: {
    version: "m3-r6-selection-algorithm-001",
    eligibilityFirst: true,
    zeroEligible: M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
    oneEligible: "SELECT_ONLY_ELIGIBLE_CANDIDATE",
    multipleEligible: "APPLY_PREDECLARED_TIE_BREAK_HIERARCHY",
    stages: [
      "ELIGIBILITY_FILTER",
      "MAX_IMPROVED_VALIDATION_FOLDS",
      "MAX_EXPECTANCY_TIE_BAND_FILTER",
      "COMPLEXITY_TUPLE_LEXICOGRAPHIC_ASCENDING",
      "PROFIT_FACTOR_DESCENDING_NULL_AFTER_FINITE",
      "CANDIDATE_ID_LEXICOGRAPHIC_ASCENDING",
    ],
    orderedCriteria: [
      { criterion: "improvedValidationFolds", direction: "DESCENDING" },
      {
        criterion: "aggregateValidationExpectancyR",
        direction: "MAXIMUM_THEN_KEEP_WITHIN_0.01_INCLUSIVE_TIE_BAND",
      },
      { criterion: "complexityTuple", direction: "LEXICOGRAPHIC_ASCENDING" },
      { criterion: "aggregateValidationProfitFactor", direction: "DESCENDING" },
      { criterion: "candidateId", direction: "LEXICOGRAPHIC_ASCENDING" },
    ],
    complexityTieThresholdR: 0.01,
    expectancyTieBandThresholdR: 0.01,
    expectancyTieBandBoundary: "INCLUSIVE",
    expectancyTieBandFloatingComparison: "SCALE_AWARE_NUMBER_EPSILON",
    expectancyTieBandFloatingToleranceFormula:
      "difference - threshold <= Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold))",
    expectancyTieBandRule:
      "KEEP_WHEN_MAX_EXPECTANCY_MINUS_CANDIDATE_EXPECTANCY_IS_LESS_THAN_OR_EQUAL_TO_0.01",
    eligibleCandidateIdsOrder: "CANDIDATE_ID_ASCENDING",
    nullProfitFactorOrder: "NULL_AFTER_FINITE_VALUES",
  },
  h22RouteMap: R6_H22_ROUTE_MAP,
  performanceLock: M3_R6_ROUND_006_PERFORMANCE_LOCK,
  roundImmutability: {
    becomesImmutableAt: M3_R6_ROUND_006_PERFORMANCE_LOCK,
    invalidatingChanges: M3_R6_ROUND_006_INVALIDATING_CATEGORIES,
    actionOnChange: M3_R6_ROUND_006_POST_LOCK_INVALIDATION,
    postLockAction: M3_R6_ROUND_006_POST_LOCK_INVALIDATION,
    postLockMeaning: "STOP; DO NOT PATCH OR RERUN THE SAME ROUND; INVALIDATION IS REQUIRED.",
    priorResultsClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
  noEarlyEligibilityExit: true,
  allApplicableGatesConjunctive: true,
  noCandidateOutcome: M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
} as const);

export const M3_R6_ROUND_006_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r6-selection-gates-001",
  researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
  freezeSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  performanceExecutionSourceSha: null,
  performanceExecutionSourceRule:
    "SUPPLY_ONLY_AT_AUTHORIZED_RUNTIME; SEPARATELY_AUTHORIZED_EXECUTION_SOURCE_AFTER_PERFORMANCE_TOOLING_ACCEPTANCE; NEVER_PREDECLARE_IN_B1B",
  inheritedRound005SelectionGateSha256:
    M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256,
  inheritedRound004SelectionGateSha256:
    M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256,
  performanceLock: M3_R6_ROUND_006_PERFORMANCE_LOCK,
  controlId: M3_R6_ROUND_006_CONTROL_ID,
  symbolUniverse: R6_SYMBOLS,
  foldIds: R6_FROZEN_FOLD_IDS,
  candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
  variantRegistry: M3_R6_ROUND_006_VARIANT_REGISTRY,
  candidateRegistry: M3_R6_ROUND_006_CANDIDATE_REGISTRY,
  complexityTuples: M3_R6_ROUND_006_COMPLEXITY_TUPLES,
  selectionGates: M3_R6_ROUND_006_SELECTION_GATES,
  definitions: M3_R6_ROUND_006_DEFINITIONS,
  b1aProtocolVersion: M3_R6_PROTOCOL_VERSION,
  b1aProtocolSourceIdentity: M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
  baseline002Status: "NOT_FROZEN",
  m3R6B1BStatus: "FROZEN_PENDING_ACCEPTANCE",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const M3_R6_ROUND_006_CANONICAL_JSON = stableStringify(
  M3_R6_ROUND_006_MACHINE_RECORD,
);

export const M3_R6_ROUND_006_SELECTION_GATE_SHA256 =
  "404e532d1594d708995de2f6b7573f386ea9270ff5386d5591948e002a4ef1fd" as const;

export function validateM3R6Round006MachineRecord(
  record: typeof M3_R6_ROUND_006_MACHINE_RECORD = M3_R6_ROUND_006_MACHINE_RECORD,
): typeof M3_R6_ROUND_006_MACHINE_RECORD {
  if (record.recordVersion !== "m3-r6-selection-gates-001") {
    throw new Error("M3-R6-B.1B Gate record version mismatch.");
  }
  if (
    record.researchRoundId !== M3_R6_ROUND_006_RESEARCH_ROUND_ID ||
    record.freezeSourceSha !== M3_R6_ROUND_006_FREEZE_SOURCE_SHA
  ) {
    throw new Error("M3-R6-B.1B Gate freeze provenance mismatch.");
  }
  if (record.performanceExecutionSourceSha !== null) {
    throw new Error("M3-R6-B.1B must not predeclare a performance execution SHA.");
  }
  if (
    record.inheritedRound005SelectionGateSha256 !==
    M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256
  ) {
    throw new Error("M3-R6-B.1B accepted Round-005 Gate SHA mismatch.");
  }
  if (
    record.inheritedRound004SelectionGateSha256 !==
    M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256
  ) {
    throw new Error("M3-R6-B.1B inherited Round-004 Gate SHA mismatch.");
  }
  if (record.controlId !== M3_R6_ROUND_006_CONTROL_ID) {
    throw new Error("M3-R6-B.1B CONTROL identity mismatch.");
  }
  if (stableStringify(record.symbolUniverse) !== stableStringify(R6_SYMBOLS)) {
    throw new Error("M3-R6-B.1B symbol universe mismatch.");
  }
  if (stableStringify(record.foldIds) !== stableStringify(R6_FROZEN_FOLD_IDS)) {
    throw new Error("M3-R6-B.1B fold registry mismatch.");
  }
  if (
    stableStringify(record.candidateIds) !==
    stableStringify(M3_R6_ROUND_006_CANDIDATE_IDS)
  ) {
    throw new Error("M3-R6-B.1B candidate registry mismatch.");
  }
  if (
    stableStringify(record.variantRegistry) !==
    stableStringify(M3_R6_ROUND_006_VARIANT_REGISTRY)
  ) {
    throw new Error("M3-R6-B.1B variant registry mismatch.");
  }
  if (
    stableStringify(record.selectionGates) !==
    stableStringify(M3_R6_ROUND_006_SELECTION_GATES)
  ) {
    throw new Error("M3-R6-B.1B Gate values or semantics changed.");
  }
  if (
    stableStringify(record.definitions) !==
    stableStringify(M3_R6_ROUND_006_DEFINITIONS)
  ) {
    throw new Error("M3-R6-B.1B Gate definitions changed.");
  }
  if (
    stableStringify(record.b1aProtocolSourceIdentity) !==
    stableStringify(M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY)
  ) {
    throw new Error("M3-R6-B.1B B.1A protocol source identity changed.");
  }
  const hash = createHash("sha256")
    .update(stableStringify(record), "utf8")
    .digest("hex");
  if (hash !== M3_R6_ROUND_006_SELECTION_GATE_SHA256) {
    throw new Error("M3-R6-B.1B Gate canonical SHA mismatch.");
  }
  return record;
}

export type M3R6CandidateGateInput = Readonly<{
  candidateId: M3R6Round006CandidateId;
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
}>;

export type M3R6GateResult = Readonly<{
  gateId: (typeof M3_R6_ROUND_006_HARD_GATE_IDENTITIES)[number];
  status: "PASS" | "FAIL" | "INCOMPLETE" | "NOT_APPLICABLE";
  applicability: "APPLICABLE" | "NOT_APPLICABLE";
  actualValue: number | null | "NOT_APPLICABLE";
  threshold: number;
}>;

export type M3R6CandidateGateEvaluation = Readonly<{
  candidateId: M3R6Round006CandidateId;
  gateResults: readonly M3R6GateResult[];
  applicableGateCount: number;
  passedApplicableGateCount: number;
  failedGateIds: readonly string[];
  eligibility: "ELIGIBLE" | "INELIGIBLE" | "INCOMPLETE";
}>;

function finite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function passesNumericGate(
  gate: NumericSelectionGate,
  value: number | null,
): boolean {
  if (!finite(value)) return false;
  return gate.comparison === "AT_LEAST"
    ? value >= gate.value
    : value <= gate.value;
}

export function evaluateM3R6CandidateGates(
  input: M3R6CandidateGateInput,
): M3R6CandidateGateEvaluation {
  const gates = M3_R6_ROUND_006_SELECTION_GATES;
  const sampleGatesPass =
    passesNumericGate(gates.minimumFormalSignals, input.formalSignals) &&
    passesNumericGate(
      gates.minimumExecutedTrades,
      input.minimumFoldExecutedTrades,
    ) &&
    passesNumericGate(gates.catastrophicFoldLimit, input.catastrophicFolds);
  const actualValues: Readonly<
    Record<
      string,
      number | null | "NOT_APPLICABLE"
    >
  > = {
    minimumAggregateImprovement: input.aggregateImprovement,
    minimumImprovedValidationFolds: input.improvedValidationFolds,
    catastrophicFoldLimit: input.catastrophicFolds,
    minimumNetExpectancy: input.netExpectancyR,
    minimumProfitFactor:
      input.profitFactorStatus === "NO_LOSSES" && sampleGatesPass
        ? gates.minimumProfitFactor.value
        : input.profitFactor,
    maximumSymbolConcentration: input.topSymbolShareOfPositiveNetR,
    maximumSingleTradeConcentration: input.largestSingleTradeShareOfPositiveNetR,
    maximumFeeBurdenRatio: input.feeBurdenRatio,
    requiredRedundancyImprovement: "NOT_APPLICABLE",
    minimumFormalSignals: input.formalSignals,
    minimumExecutedTrades: input.minimumFoldExecutedTrades,
  };
  const gateResults = M3_R6_ROUND_006_HARD_GATE_IDENTITIES.map((gateId) => {
    if (gateId === "requiredRedundancyImprovement") {
      return Object.freeze({
        gateId,
        status: "NOT_APPLICABLE",
        applicability: "NOT_APPLICABLE",
        actualValue: "NOT_APPLICABLE",
        threshold: gates[gateId].value,
      } as const);
    }
    const actualValue = actualValues[gateId] ?? null;
    const status =
      input.resultStatus === "DATA_INCOMPLETE"
        ? "INCOMPLETE"
        : input.resultStatus !== "COMPLETE"
          ? "FAIL"
          : gateId === "minimumProfitFactor" &&
              input.profitFactorStatus === "NO_TRADES"
            ? "FAIL"
            : gateId === "minimumProfitFactor" &&
                input.profitFactorStatus === "NO_LOSSES"
              ? sampleGatesPass
                ? "PASS"
                : "FAIL"
              : passesNumericGate(gates[gateId], actualValue as number | null)
                ? "PASS"
                : "FAIL";
    return Object.freeze({
      gateId,
      status,
      applicability: "APPLICABLE",
      actualValue,
      threshold: gates[gateId].value,
    } as const);
  });
  const applicable = gateResults.filter(
    (result) => result.applicability === "APPLICABLE",
  );
  const passed = applicable.filter((result) => result.status === "PASS");
  const failedGateIds = applicable
    .filter((result) => result.status !== "PASS")
    .map((result) => result.gateId);
  return Object.freeze({
    candidateId: input.candidateId,
    gateResults: Object.freeze(gateResults),
    applicableGateCount: applicable.length,
    passedApplicableGateCount: passed.length,
    failedGateIds: Object.freeze(failedGateIds),
    eligibility:
      input.resultStatus === "DATA_INCOMPLETE"
        ? "INCOMPLETE"
        : failedGateIds.length === 0
          ? "ELIGIBLE"
          : "INELIGIBLE",
  });
}

export type M3R6SelectionCandidate = Readonly<{
  candidateId: M3R6Round006CandidateId;
  eligible: boolean;
  improvedValidationFolds: number;
  aggregateValidationExpectancyR: number;
  complexityTuple: R6ComplexityTuple;
  aggregateValidationProfitFactor: number | null;
}>;

export type M3R6SelectionResult = Readonly<{
  selectionAlgorithmApplied: boolean;
  eligibleCandidateIds: readonly M3R6Round006CandidateId[];
  selectedCandidateId: M3R6Round006CandidateId | null;
  finalDecision: string;
}>;

function compareComplexity(
  left: R6ComplexityTuple,
  right: R6ComplexityTuple,
): number {
  for (const dimension of [
    "newRules",
    "newTunableThresholds",
    "modifiedBaselineRules",
    "mechanismFamiliesUsed",
  ] as const) {
    if (left[dimension] !== right[dimension]) {
      return left[dimension] - right[dimension];
    }
  }
  return 0;
}

function compareFinalSelectionOrder(
  left: M3R6SelectionCandidate,
  right: M3R6SelectionCandidate,
): number {
  const complexityOrder = compareComplexity(
    left.complexityTuple,
    right.complexityTuple,
  );
  if (complexityOrder !== 0) return complexityOrder;
  const leftPf = left.aggregateValidationProfitFactor;
  const rightPf = right.aggregateValidationProfitFactor;
  if (leftPf !== rightPf) {
    if (leftPf === null) return 1;
    if (rightPf === null) return -1;
    return rightPf - leftPf;
  }
  if (left.candidateId < right.candidateId) return -1;
  if (left.candidateId > right.candidateId) return 1;
  return 0;
}

function isWithinInclusiveExpectancyTieBand(
  maxExpectancy: number,
  candidateExpectancy: number,
  threshold: number,
): boolean {
  const difference = maxExpectancy - candidateExpectancy;
  const tolerance =
    Number.EPSILON *
    Math.max(
      1,
      Math.abs(maxExpectancy),
      Math.abs(candidateExpectancy),
      Math.abs(threshold),
    );
  return difference - threshold <= tolerance;
}

function selectEligibleCandidatesByFrozenStages(
  eligible: readonly M3R6SelectionCandidate[],
): readonly M3R6SelectionCandidate[] {
  const maxImprovedValidationFolds = Math.max(
    ...eligible.map((candidate) => candidate.improvedValidationFolds),
  );
  const foldCohort = eligible.filter(
    (candidate) => candidate.improvedValidationFolds === maxImprovedValidationFolds,
  );
  const maxExpectancy = Math.max(
    ...foldCohort.map((candidate) => candidate.aggregateValidationExpectancyR),
  );
  const expectancyCohort = foldCohort.filter(
    (candidate) =>
      isWithinInclusiveExpectancyTieBand(
        maxExpectancy,
        candidate.aggregateValidationExpectancyR,
        M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandThresholdR,
      ),
  );
  return [...expectancyCohort].sort(compareFinalSelectionOrder);
}

export function selectM3R6Candidate(
  candidates: readonly M3R6SelectionCandidate[],
): M3R6SelectionResult {
  const eligible = candidates.filter((candidate) => candidate.eligible);
  if (eligible.length === 0) {
    return Object.freeze({
      selectionAlgorithmApplied: false,
      eligibleCandidateIds: Object.freeze([]),
      selectedCandidateId: null,
      finalDecision: M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
    });
  }
  const ordered = selectEligibleCandidatesByFrozenStages(eligible);
  return Object.freeze({
    selectionAlgorithmApplied: true,
    eligibleCandidateIds: Object.freeze(
      [...eligible]
        .map((candidate) => candidate.candidateId)
        .sort(),
    ),
    selectedCandidateId: ordered[0]!.candidateId,
    finalDecision: "SELECTED_ROUND_006_CANDIDATE",
  });
}

export const BASELINE_002_RESEARCH_ROUND_006_SELECTION_GATES =
  M3_R6_ROUND_006_SELECTION_GATES;
export const BASELINE_002_RESEARCH_ROUND_006_DEFINITIONS =
  M3_R6_ROUND_006_DEFINITIONS;
export const BASELINE_002_RESEARCH_ROUND_006_MACHINE_RECORD =
  M3_R6_ROUND_006_MACHINE_RECORD;
export const BASELINE_002_RESEARCH_ROUND_006_CANONICAL_JSON =
  M3_R6_ROUND_006_CANONICAL_JSON;
export const BASELINE_002_RESEARCH_ROUND_006_SELECTION_GATE_SHA256 =
  M3_R6_ROUND_006_SELECTION_GATE_SHA256;
