import { createHash } from "node:crypto";

import { BACKTEST_POLICY } from "../backtest/constants.ts";
import {
  RESEARCH_SYMBOLS,
  STRATEGY_VERSION,
} from "../config/constants.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import {
  M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
  M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R6_ROUND_006_CANDIDATE_IDS,
  M3_R6_ROUND_006_CANDIDATE_REGISTRY,
  M3_R6_ROUND_006_CONTROL_ID,
  M3_R6_ROUND_006_DEFINITIONS,
  M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
  M3_R6_ROUND_006_INHERITED_GATE_SHA256,
  M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_MACHINE_RECORD,
  M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
  M3_R6_ROUND_006_RESEARCH_ROUND_ID,
  M3_R6_ROUND_006_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_VARIANT_REGISTRY,
} from "./selection-gates-round-006.ts";
import {
  M3_R6_PERFORMANCE_LOCK,
  M3_R6_POST_LOCK_INVALIDATION,
  M3_R6_PROTOCOL_VERSION,
  M3_R6_RESEARCH_END_ISO,
  M3_R6_RESEARCH_RANGE,
  M3_R6_RESEARCH_START_ISO,
  R6_DATA_CONTRACT,
  R6_EXECUTION_CONTRACTS,
  R6_FROZEN_FOLD_IDS,
  R6_SYMBOLS,
} from "./m3-r6-round-006-protocol.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R6_ROUND_006_PLAN_SCHEMA_VERSION =
  "m3-r6-round-006-plan-001" as const;
export const M3_R6_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;
export const M3_R6_ROUND_006_STRATEGY_VERSION = STRATEGY_VERSION;
export const M3_R6_ROUND_006_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R6_ROUND_006_CONTROL_REPORT_SCHEMA_VERSION =
  "m3-b-report-004" as const;

export const M3_R6_ROUND_006_METRIC_STATUS_CONTRACT = deepFreeze({
  formalPopulation: {
    rule: "ONLY_FORMAL_EVALUATOR_SIGNAL_STATUS_SIGNAL_CREATES_A_RECORD;NO_SIGNAL_CREATES_NO_FORMAL_RECORD",
    identity: "symbol|direction|signalTime",
    noSignalHandling: "NO_SIGNAL_IS_EXCLUDED_FROM_FORMAL_SIGNAL_COUNTS_AND_ALL_CANDIDATE_METRICS",
  },
  statusSemantics: {
    EXECUTED: {
      countsAsFormalSignal: true,
      countsAsExecutedTrade: true,
      candidateIntegrityEffect: "VALID_FINITE_SETTLED_RECORD",
      foldSampleEffect: "INCLUDED_IN_FORMAL_AND_EXECUTED_FOLD_METRICS",
      gateEffect: "EVALUATE_ALL_APPLICABLE_GATES",
    },
    DATA_INCOMPLETE: {
      countsAsFormalSignal: true,
      countsAsExecutedTrade: false,
      candidateIntegrityEffect: "INCOMPLETE_EVIDENCE;CANDIDATE_INELIGIBLE",
      foldSampleEffect: "FORMAL_SIGNAL_COUNTED;EXECUTED_METRICS_EXCLUDED",
      gateEffect: "INCOMPLETE_APPLICABLE_GATES_FAIL",
    },
    ENTRY_UNAVAILABLE: {
      countsAsFormalSignal: true,
      countsAsExecutedTrade: false,
      candidateIntegrityEffect: "NON_EXECUTED;CANDIDATE_INELIGIBLE",
      foldSampleEffect: "FORMAL_SIGNAL_COUNTED;EXECUTED_METRICS_EXCLUDED",
      gateEffect: "APPLICABLE_EXECUTION_GATES_FAIL",
    },
    INVALID_STOP_GEOMETRY: {
      countsAsFormalSignal: true,
      countsAsExecutedTrade: false,
      candidateIntegrityEffect: "FORMAL_SIGNAL_PRESERVED;CANDIDATE_INELIGIBLE",
      foldSampleEffect: "FORMAL_SIGNAL_COUNTED;EXECUTED_METRICS_EXCLUDED",
      gateEffect: "APPLICABLE_EXECUTION_GATES_FAIL",
    },
    PERIOD_END_CENSORED: {
      countsAsFormalSignal: true,
      countsAsExecutedTrade: false,
      candidateIntegrityEffect: "FORMAL_SIGNAL_PRESERVED;CENSORED;CANDIDATE_INELIGIBLE",
      foldSampleEffect: "FORMAL_SIGNAL_COUNTED;EXECUTED_METRICS_EXCLUDED",
      gateEffect: "APPLICABLE_EXECUTION_GATES_FAIL",
    },
  },
  formulas: {
    formalSignals: "COUNT_CANONICAL_FORMAL_RECORDS;NO_SIGNAL_RECORDS_ARE_ABSENT",
    executedTrades: "COUNT_EXECUTED_RECORDS_WITH_FINITE_NET_R_AND_NON_NULL_ENTRY_AND_EXIT",
    netExpectancyR: "SUM_EXECUTED_NET_R_DIVIDED_BY_EXECUTED_TRADES;NULL_WHEN_EXECUTED_TRADES_IS_ZERO",
    profitFactor: {
      normal: "SUM_POSITIVE_EXECUTED_NET_R_DIVIDED_BY_ABSOLUTE_SUM_NEGATIVE_EXECUTED_NET_R",
      noTrades: "NO_TRADES;VALUE_NULL;GATE_FAILS",
      noLosses: "NO_LOSSES;VALUE_NULL;GATE_PASSES_ONLY_AFTER_ALL_SAMPLE_GATES_PASS",
      infinityEncoding: "FORBIDDEN",
    },
    feeBurdenRatio: "SUM_EXECUTED_FEE_R_DIVIDED_BY_ABSOLUTE_SUM_EXECUTED_GROSS_R;NULL_WHEN_NO_TRADES_OR_GROSS_R_IS_ZERO_OR_UNAVAILABLE",
    topSymbolShareOfPositiveNetR: "MAX_SYMBOL_SUM_POSITIVE_EXECUTED_NET_R_DIVIDED_BY_TOTAL_POSITIVE_EXECUTED_NET_R;NULL_WHEN_DENOMINATOR_IS_ZERO",
    largestSingleTradeShareOfPositiveNetR: "MAX_SINGLE_POSITIVE_EXECUTED_NET_R_DIVIDED_BY_TOTAL_POSITIVE_EXECUTED_NET_R;NULL_WHEN_DENOMINATOR_IS_ZERO",
    aggregateImprovementVsControl: "CANDIDATE_AGGREGATE_VALIDATION_EXPECTANCY_R_MINUS_CONTROL_AGGREGATE_VALIDATION_EXPECTANCY_R;NULL_WHEN_EITHER_IS_NULL",
    improvedValidationFolds: "COUNT_FOLDS_WHERE_CANDIDATE_AND_CONTROL_EXECUTED_TRADES_ARE_AT_LEAST_30_AND_EXPECTANCY_DELTA_IS_AT_LEAST_0.02R",
    catastrophicFold: "EXPECTANCY_R_LESS_THAN_OR_EQUAL_TO_NEGATIVE_0.1_OR_NORMAL_PF_LESS_THAN_0.8_OR_NO_TRADES_OR_EXECUTED_TRADES_LESS_THAN_30",
    minimumFoldExecutedTrades: "MINIMUM_EXECUTED_TRADES_ACROSS_F1_THROUGH_F6_VALIDATION_FOLDS",
  },
  numericNormalization: {
    finiteNumbersOnly: true,
    nonFiniteBehavior: "REJECT",
    negativeZero: "NORMALIZE_TO_ZERO",
    roundedMetricDecimalPlaces: 12,
    missingValue: "NULL;NEVER_INFINITY_OR_NAN",
  },
  outputOrdering: {
    candidateIds: "FROZEN_REGISTRY_ORDER_FOR_REGISTRY_FIELDS;CANDIDATE_ID_ASCENDING_FOR_ELIGIBLE_CANDIDATE_IDS",
    folds: "F1,F2,F3,F4,F5,F6",
    formalSignals: "signalTime_ASC_THEN_SYMBOL_FROZEN_ORDER_THEN_DIRECTION_LONG_BEFORE_SHORT",
    symbols: "RESEARCH_SYMBOL_ORDER",
    directions: "RESEARCH_DIRECTION_ORDER",
    serialization: "stableStringify_FROM_src/lib/research/utils.ts;LEXICOGRAPHIC_OBJECT_KEYS;ARRAY_ORDER_PRESERVED;UTF8;NO_TRAILING_NEWLINE",
  },
  implementationIdentity: {
    diagnostics: {
      path: "src/lib/research/diagnostics.ts",
      gitBlobSha: "771ea49b63ea9da4c57169fa176ba0df65f94c98",
    },
    backtestMetrics: {
      path: "src/lib/backtest/metrics.ts",
      gitBlobSha: "fa958b7f255d330020df9ff17e7f56ff3871ae48",
    },
    r5Selection: {
      path: "src/lib/research/m3-r5-c3-selection.ts",
      gitBlobSha: "510b8019734be2dd4e93c1c739a4d2c9ad8abf57",
    },
    stableStringify: {
      path: "src/lib/research/utils.ts",
      gitBlobSha: "6b3e59f5955f6166b7dba12f72d337b688f72bce",
    },
    sourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  },
} as const);

export const M3_R6_ROUND_006_PLAN = deepFreeze({
  schemaVersion: M3_R6_ROUND_006_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
  sourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  freezeSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  dataClassification: M3_R6_DATA_CLASSIFICATION,
  researchUniverse: {
    startTime: M3_R6_RESEARCH_RANGE.startTime,
    endTime: M3_R6_RESEARCH_RANGE.endTime,
    startIso: M3_R6_RESEARCH_START_ISO,
    endIso: M3_R6_RESEARCH_END_ISO,
    rule: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
  symbols: Object.freeze([...RESEARCH_SYMBOLS]),
  folds: RESEARCH_FOLDS,
  control: {
    candidateId: M3_R6_ROUND_006_CONTROL_ID,
    strategyVersion: M3_R6_ROUND_006_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R6_ROUND_006_POLICY_VERSION,
    reportSchemaVersion: M3_R6_ROUND_006_CONTROL_REPORT_SCHEMA_VERSION,
    formalSignalPopulation: M3_R6_ROUND_006_CONTROL_ID,
    aggregateValidation:
      "CONCATENATE_NON_OVERLAPPING_FROZEN_VALIDATION_SEGMENTS_BY_SIGNAL_TIME",
  },
  candidateRegistry: M3_R6_ROUND_006_CANDIDATE_REGISTRY,
  candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
  variantRegistry: M3_R6_ROUND_006_VARIANT_REGISTRY,
  protocol: {
    version: M3_R6_PROTOCOL_VERSION,
    sourceIdentity: M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
    researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
    requiredWindows: {
      h19: "EXACT_LATEST_25_CLOSED_1H_PER_SYMBOL_SYNCHRONIZED",
      h20: "EXACT_LATEST_4_CLOSED_1H_EVENT_AND_3_CLOSED_4H_STRUCTURAL",
      h21: "EXACT_CURRENT_CLOSED_1H_DECISION_CANDLE",
      h22: "EXACT_LATEST_2_CLOSED_1H_AND_3_CLOSED_4H",
    },
    nextOpen:
      "IMMEDIATE_NEXT_CANONICAL_1H_REQUIRED;MISSING_ENTRY_UNAVAILABLE;MALFORMED_DATA_INCOMPLETE;LATER_CANDLES_NEVER_USED",
    complexityTuples: M3_R6_ROUND_006_MACHINE_RECORD.complexityTuples,
  },
  gate: {
    path: "src/lib/research/selection-gates-round-006.ts",
    recordVersion: M3_R6_ROUND_006_MACHINE_RECORD.recordVersion,
    sha256: M3_R6_ROUND_006_SELECTION_GATE_SHA256,
    inheritedRound005GateSha256: M3_R6_ROUND_006_INHERITED_GATE_SHA256,
    inheritedRound004GateSha256:
      M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256,
    numericSemantics:
      "INHERIT_ACCEPTED_ROUND_005_VALUES_DIRECTIONS_AND_FORMULAS_WITHOUT_WEAKENING",
    hardGateIdentities: M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
    applicableHardGateIdentities:
      M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
  },
  dataContract: R6_DATA_CONTRACT,
  execution: {
    strategyVersion: M3_R6_ROUND_006_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R6_ROUND_006_POLICY_VERSION,
    feeRate: BACKTEST_POLICY.feeRate,
    slippageRate: BACKTEST_POLICY.slippageRate,
    funding:
      "OFFICIAL_FUNDING_RATE_HISTORY_WITH_MARK_PRICE_KLINE_PRE_EVENT_CLOSE_FALLBACK",
    markPriceFallback: "MARK_PRICE_KLINE_PRE_EVENT_CLOSE",
    settlement: "SL_FIRST_INTRABAR_ORDERING",
    heldCandleCount: 24,
    timeExit: "CLOSE_OF_HELD_CANDLE_24",
    takeProfit: "EXACTLY_2R",
    entry: "IMMEDIATE_NEXT_CANONICAL_1H_REQUIRED",
    invalidStopGeometry:
      "INVALID_STOP_GEOMETRY;FORMAL_SIGNAL_PRESERVED_NON_EXECUTED",
    commonContract: R6_EXECUTION_CONTRACTS.common,
  },
  selection: {
    algorithmVersion: M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.version,
    eligibilityFirst: true,
    allApplicableGatesConjunctive: true,
    noEarlyEligibilityExit: true,
    orderedCriteria:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.orderedCriteria,
    stages: M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.stages,
    expectancyTieBandThresholdR:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandThresholdR,
    expectancyTieBandBoundary:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandBoundary,
    expectancyTieBandFloatingComparison:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandFloatingComparison,
    expectancyTieBandFloatingToleranceFormula:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandFloatingToleranceFormula,
    expectancyTieBandRule:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.expectancyTieBandRule,
    complexityTieThresholdR:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.complexityTieThresholdR,
    zeroEligibleOutcome: M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
    oneEligibleOutcome: "SELECT_ONLY_ELIGIBLE_CANDIDATE",
    multipleEligibleOutcome: "APPLY_PREDECLARED_TIE_BREAK_HIERARCHY",
    nullProfitFactorOrder:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.nullProfitFactorOrder,
    eligibleCandidateIdsOrder:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.eligibleCandidateIdsOrder,
    deterministicCandidateOrder: "candidateId_ASCENDING_FINAL_TIE_BREAK",
  },
  metricsContract: M3_R6_ROUND_006_METRIC_STATUS_CONTRACT,
  authorization: {
    freezeSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
    b1aProtocolSourceIdentity: M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
    performanceExecutionSourceSha: null,
    performanceExecutionSourceRule:
      "SUPPLY_ONLY_AT_AUTHORIZED_RUNTIME;SEPARATELY_AUTHORIZED_EXECUTION_SOURCE_AFTER_PERFORMANCE_TOOLING_ACCEPTANCE",
    authorizedExecutionSourceRule:
      "executionSourceSha_EQUALS_authorizedExecutionSourceSha_EQUALS_git_HEAD;cleanWorktree_TRUE;required_manifests_PASS;authoritative_outputs_ABSENT_BEFORE_NETWORK",
    requiredGateSha256: M3_R6_ROUND_006_SELECTION_GATE_SHA256,
    requiredPlanSha256: "SELF_CANONICAL_HASH_VERIFIED_AT_RUNTIME",
    requiredProtocolVersion: M3_R6_PROTOCOL_VERSION,
    requiredResearchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
    requiredCandidateRegistry: M3_R6_ROUND_006_CANDIDATE_IDS,
    requiredControlId: M3_R6_ROUND_006_CONTROL_ID,
    requiredSymbols: R6_SYMBOLS,
    requiredFolds: R6_FROZEN_FOLD_IDS,
    requiredPolicy: M3_R6_ROUND_006_POLICY_VERSION,
    requiredResearchEndIso: M3_R6_RESEARCH_END_ISO,
    requiredOutputArtifactsAbsent: [
      "docs/evidence/M3_R6_ROUND_006_SUMMARY.json",
      "docs/evidence/M3_R6_ROUND_006_AUDIT.json",
      "docs/M3_R6_ROUND_006_RESULTS.md",
    ],
    requiredManifestStatus: "PASS_BEFORE_NETWORK",
  },
  performance: {
    status: "NOT_GENERATED",
    authorization: "NOT_AUTHORIZED",
    executionSourceSha: null,
    lock: M3_R6_PERFORMANCE_LOCK,
    postLockAction: M3_R6_POST_LOCK_INVALIDATION,
    immutableAfterFirstResult: true,
  },
  governance: {
    noCombinations: true,
    noTuning: true,
    noOptimizer: true,
    noRandomSearch: true,
    noThresholdSweep: true,
    noPostResultCandidateReplacement: true,
    noFutureDataAfter: M3_R6_RESEARCH_END_ISO,
    oneAuthoritativePerformanceExecutionOnlyLater: true,
    noPerformanceInB1B: true,
  },
  status: {
    baseline002Status: "NOT_FROZEN",
    m3R6B1BStatus: "FROZEN_PENDING_ACCEPTANCE",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
  },
} as const);

export const M3_R6_ROUND_006_PLAN_CANONICAL_JSON = stableStringify(
  M3_R6_ROUND_006_PLAN,
);

export const M3_R6_ROUND_006_PLAN_SHA256 =
  "195ba66a3b6bf920a1d3418a26e72037c817c1a713b888c1179047b85f9fc005" as const;

export function validateM3R6Round006Plan(
  plan: typeof M3_R6_ROUND_006_PLAN = M3_R6_ROUND_006_PLAN,
): typeof M3_R6_ROUND_006_PLAN {
  if (plan.schemaVersion !== M3_R6_ROUND_006_PLAN_SCHEMA_VERSION) {
    throw new Error("M3-R6-B.1B Plan schema mismatch.");
  }
  if (
    plan.researchRoundId !== M3_R6_ROUND_006_RESEARCH_ROUND_ID ||
    plan.sourceSha !== M3_R6_ROUND_006_FREEZE_SOURCE_SHA ||
    plan.freezeSourceSha !== M3_R6_ROUND_006_FREEZE_SOURCE_SHA
  ) {
    throw new Error("M3-R6-B.1B Plan freeze provenance mismatch.");
  }
  if (
    plan.performance.executionSourceSha !== null ||
    plan.authorization.performanceExecutionSourceSha !== null
  ) {
    throw new Error("M3-R6-B.1B Plan predeclares a performance execution SHA.");
  }
  if (plan.dataClassification !== M3_R6_DATA_CLASSIFICATION) {
    throw new Error("M3-R6-B.1B Plan data classification changed.");
  }
  if (
    stableStringify(plan.symbols) !== stableStringify(RESEARCH_SYMBOLS) ||
    stableStringify(plan.folds) !== stableStringify(RESEARCH_FOLDS)
  ) {
    throw new Error("M3-R6-B.1B Plan universe or fold registry changed.");
  }
  if (
    stableStringify(plan.candidateIds) !==
    stableStringify(M3_R6_ROUND_006_CANDIDATE_IDS)
  ) {
    throw new Error("M3-R6-B.1B Plan candidate registry changed.");
  }
  if (
    stableStringify(plan.variantRegistry) !==
    stableStringify(M3_R6_ROUND_006_VARIANT_REGISTRY)
  ) {
    throw new Error("M3-R6-B.1B Plan variant registry changed.");
  }
  if (plan.control.candidateId !== M3_R6_ROUND_006_CONTROL_ID) {
    throw new Error("M3-R6-B.1B Plan CONTROL identity changed.");
  }
  if (plan.control.backtestPolicyVersion !== M3_R6_ROUND_006_POLICY_VERSION) {
    throw new Error("M3-R6-B.1B Plan policy changed.");
  }
  if (plan.gate.sha256 !== M3_R6_ROUND_006_SELECTION_GATE_SHA256) {
    throw new Error("M3-R6-B.1B Plan Gate SHA mismatch.");
  }
  if (
    plan.gate.inheritedRound005GateSha256 !== M3_R6_ROUND_006_INHERITED_GATE_SHA256 ||
    plan.gate.inheritedRound004GateSha256 !==
      M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256
  ) {
    throw new Error("M3-R6-B.1B inherited Gate provenance mismatch.");
  }
  if (
    plan.authorization.requiredPlanSha256 !==
    "SELF_CANONICAL_HASH_VERIFIED_AT_RUNTIME"
  ) {
    throw new Error("M3-R6-B.1B Plan self-hash binding changed.");
  }
  if (
    plan.performance.status !== "NOT_GENERATED" ||
    plan.performance.authorization !== "NOT_AUTHORIZED"
  ) {
    throw new Error("M3-R6-B.1B performance is unexpectedly authorized.");
  }
  if (
    plan.metricsContract !== M3_R6_ROUND_006_METRIC_STATUS_CONTRACT ||
    stableStringify(plan.metricsContract) !==
      stableStringify(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT)
  ) {
    throw new Error("M3-R6-B.1B metric/status contract changed.");
  }
  if (
    plan.status.baseline002Status !== "NOT_FROZEN" ||
    plan.status.m3JStatus !== "BLOCKED" ||
    plan.status.m4Status !== "NOT_STARTED"
  ) {
    throw new Error("M3-R6-B.1B milestone boundary changed.");
  }
  const hash = createHash("sha256")
    .update(stableStringify(plan), "utf8")
    .digest("hex");
  if (hash !== M3_R6_ROUND_006_PLAN_SHA256) {
    throw new Error("M3-R6-B.1B Plan canonical SHA mismatch.");
  }
  return plan;
}

export type M3R6PerformanceAuthorizationInput = Readonly<{
  executionSourceSha: string;
  authorizedExecutionSourceSha: string;
  headSha: string;
  cleanWorktree: boolean;
  existingAuthoritativeOutputArtifacts: readonly string[];
  requiredManifestStatus: string;
  protocolVersion: string;
  protocolSourceSha: string;
  protocolGitBlobSha: string;
  researchRoundId: string;
  selectionGateSha256: string;
  planSha256: string;
  candidateIds: readonly string[];
  controlId: string;
  symbols: readonly string[];
  folds: Readonly<Record<string, unknown>>;
  backtestPolicyVersion: string;
  researchEndIso: string;
}>;

function isGitSha(value: string): boolean {
  return /^[0-9a-f]{40}$/.test(value);
}

export function validateM3R6PerformanceAuthorization(
  input: M3R6PerformanceAuthorizationInput,
): void {
  const errors: string[] = [];
  if (!isGitSha(input.executionSourceSha)) {
    errors.push("executionSourceSha must be a 40-character lowercase Git SHA.");
  }
  if (!isGitSha(input.authorizedExecutionSourceSha)) {
    errors.push("authorizedExecutionSourceSha must be a 40-character lowercase Git SHA.");
  }
  if (!isGitSha(input.headSha)) {
    errors.push("headSha must be a 40-character lowercase Git SHA.");
  }
  if (
    input.executionSourceSha !== input.authorizedExecutionSourceSha ||
    input.authorizedExecutionSourceSha !== input.headSha
  ) {
    errors.push(
      "executionSourceSha, authorizedExecutionSourceSha, and git HEAD must be identical.",
    );
  }
  if (input.executionSourceSha === M3_R6_ROUND_006_FREEZE_SOURCE_SHA) {
    errors.push(
      "executionSourceSha must be separately authorized after performance tooling acceptance.",
    );
  }
  if (input.cleanWorktree !== true) {
    errors.push("cleanWorktree must be true before network access.");
  }
  if (input.existingAuthoritativeOutputArtifacts.length !== 0) {
    errors.push("authoritative output artifacts must be absent before network access.");
  }
  if (input.requiredManifestStatus !== "PASS_BEFORE_NETWORK") {
    errors.push("required manifests must pass before network access.");
  }
  if (input.protocolVersion !== M3_R6_PROTOCOL_VERSION) {
    errors.push("B.1A protocol version mismatch.");
  }
  if (input.protocolSourceSha !== M3_R6_ROUND_006_FREEZE_SOURCE_SHA) {
    errors.push("B.1A protocol source SHA mismatch.");
  }
  if (input.protocolGitBlobSha !== M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY.protocolGitBlobSha) {
    errors.push("B.1A protocol Git blob mismatch.");
  }
  if (input.researchRoundId !== M3_R6_ROUND_006_RESEARCH_ROUND_ID) {
    errors.push("Research round mismatch.");
  }
  if (input.selectionGateSha256 !== M3_R6_ROUND_006_SELECTION_GATE_SHA256) {
    errors.push("Round-006 Gate SHA mismatch.");
  }
  if (input.planSha256 !== M3_R6_ROUND_006_PLAN_SHA256) {
    errors.push("Round-006 Plan SHA mismatch.");
  }
  if (
    stableStringify(input.candidateIds) !==
    stableStringify(M3_R6_ROUND_006_CANDIDATE_IDS)
  ) {
    errors.push("Candidate registry mismatch.");
  }
  if (input.controlId !== M3_R6_ROUND_006_CONTROL_ID) {
    errors.push("CONTROL identity mismatch.");
  }
  if (stableStringify(input.symbols) !== stableStringify(RESEARCH_SYMBOLS)) {
    errors.push("Symbol universe mismatch.");
  }
  if (stableStringify(input.folds) !== stableStringify(RESEARCH_FOLDS)) {
    errors.push("Fold registry mismatch.");
  }
  if (input.backtestPolicyVersion !== M3_R6_ROUND_006_POLICY_VERSION) {
    errors.push("Backtest policy mismatch.");
  }
  if (input.researchEndIso !== M3_R6_RESEARCH_END_ISO) {
    errors.push("Research boundary mismatch.");
  }
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export const BASELINE_002_RESEARCH_ROUND_006_PLAN = M3_R6_ROUND_006_PLAN;
export const BASELINE_002_RESEARCH_ROUND_006_PLAN_CANONICAL_JSON =
  M3_R6_ROUND_006_PLAN_CANONICAL_JSON;
export const BASELINE_002_RESEARCH_ROUND_006_PLAN_SHA256 =
  M3_R6_ROUND_006_PLAN_SHA256;
