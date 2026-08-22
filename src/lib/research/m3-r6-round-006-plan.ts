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
    complexityTieThresholdR:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.complexityTieThresholdR,
    zeroEligibleOutcome: M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
    oneEligibleOutcome: "SELECT_ONLY_ELIGIBLE_CANDIDATE",
    multipleEligibleOutcome: "APPLY_PREDECLARED_TIE_BREAK_HIERARCHY",
    nullProfitFactorOrder:
      M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.nullProfitFactorOrder,
    deterministicCandidateOrder: "candidateId_ASCENDING_FINAL_TIE_BREAK",
  },
  authorization: {
    freezeSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
    b1aProtocolSourceIdentity: M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
    performanceExecutionSourceSha: null,
    performanceExecutionSourceRule:
      "SUPPLY_ONLY_AT_AUTHORIZED_RUNTIME;MUST_EQUAL_POST_B1B_MERGED_MAIN_SHA",
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
  "86dc1b341c7f34fed8f80dc54b54741b19576bbc5d898b2a0e95884b19184fa6" as const;

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
  if (input.executionSourceSha === M3_R6_ROUND_006_FREEZE_SOURCE_SHA) {
    errors.push("executionSourceSha must be the later post-B.1B merged main SHA.");
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
