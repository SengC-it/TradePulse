import { createHash } from "node:crypto";

import { RESEARCH_SYMBOLS } from "../config/constants.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import {
  M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
  M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R6_ROUND_006_CANDIDATE_IDS,
  M3_R6_ROUND_006_CONTROL_ID,
  M3_R6_ROUND_006_DEFINITIONS,
  M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
  M3_R6_ROUND_006_INHERITED_GATE_SHA256,
  M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_MACHINE_RECORD,
  M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
  M3_R6_ROUND_006_SELECTION_GATES,
  M3_R6_ROUND_006_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_VARIANT_REGISTRY,
  M3_R6_ROUND_006_POLICY_VERSION,
} from "./selection-gates-round-006.ts";
import {
  M3_R6_PERFORMANCE_LOCK,
  M3_R6_POST_LOCK_INVALIDATION,
  M3_R6_PROTOCOL_VERSION,
  M3_R6_RESEARCH_END_ISO,
  M3_R6_RESEARCH_RANGE,
  M3_R6_RESEARCH_ROUND_ID,
  M3_R6_RESEARCH_START_ISO,
  R6_DATA_CONTRACT,
  R6_EXECUTION_CONTRACTS,
  R6_FROZEN_FOLD_IDS,
  R6_SYMBOLS,
} from "./m3-r6-round-006-protocol.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R6_ROUND_006_PLAN_SCHEMA_VERSION = "m3-r6-round-006-plan-002" as const;
export const M3_R6_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;
export const M3_R6_ROUND_006_STRATEGY_VERSION = "baseline-001" as const;
export const M3_R6_ROUND_006_CONTROL_REPORT_SCHEMA_VERSION = "m3-b-report-004" as const;

export const M3_R6_ROUND_006_METRIC_STATUS_CONTRACT = deepFreeze({
  formalPopulation: "ONLY_BASELINE_FORMAL_SIGNAL_RESULTS_ARE_ELIGIBLE_FOR_CANDIDATE_FILTERS;NO_SIGNAL_HAS_NO_RECORD",
  statusSemantics: {
    EXECUTED: "INCLUDED_IN_FORMAL_AND_EXECUTED_METRICS",
    ENTRY_OUTSIDE_BRACKET: "FORMAL_SIGNAL_COUNTED;EXECUTED_METRICS_EXCLUDED",
    PERIOD_END_CENSORED: "FORMAL_SIGNAL_COUNTED;CANDIDATE_SAMPLE_IS_CENSORED_AND_INELIGIBLE_IF_GATE_REQUIRES_COMPLETE",
    DATA_INCOMPLETE: "INCOMPLETE_EVIDENCE;CANDIDATE_INELIGIBLE",
    SETTLEMENT_AMBIGUOUS: "INCOMPLETE_EVIDENCE;CANDIDATE_INELIGIBLE",
  },
  formulas: {
    formalSignals: "COUNT_CANONICAL_FORMAL_RECORDS",
    executedTrades: "COUNT_EXECUTED_RECORDS_WITH_FINITE_NET_R_AND_NON_NULL_ENTRY_AND_EXIT",
    netExpectancyR: "SUM_EXECUTED_NET_R_DIVIDED_BY_EXECUTED_TRADES;NULL_WHEN_ZERO",
    profitFactor: "SUM_POSITIVE_EXECUTED_NET_R_DIVIDED_BY_ABSOLUTE_SUM_NEGATIVE_EXECUTED_NET_R;NO_TRADES_OR_NO_LOSSES_RETAIN_NULL",
    aggregateValidation: "CONCATENATE_NON_OVERLAPPING_FROZEN_VALIDATION_SEGMENTS",
    candidateEconomics: "FILTER_OR_RANK_CONTROL_RESULTS;DO_NOT_RECALCULATE_ENTRY_EXIT_OR_SETTLEMENT",
  },
  numericNormalization: {
    finiteNumbersOnly: true,
    missingValue: "NULL",
    negativeZero: "NORMALIZE_TO_ZERO",
    roundedMetricDecimalPlaces: 12,
  },
  outputOrdering: {
    candidates: "FROZEN_REGISTRY_ORDER",
    folds: "F1,F2,F3,F4,F5,F6",
    records: "signalTime_ASC_THEN_SYMBOL_FROZEN_ORDER_THEN_LONG_BEFORE_SHORT",
    serialization: "stableStringify_UTF8_NO_TRAILING_NEWLINE",
  },
});

export const M3_R6_ROUND_006_PLAN = deepFreeze({
  schemaVersion: M3_R6_ROUND_006_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R6_RESEARCH_ROUND_ID,
  sourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  freezeSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  dataClassification: M3_R6_DATA_CLASSIFICATION,
  researchUniverse: {
    startTime: M3_R6_RESEARCH_RANGE.startTime,
    endTime: M3_R6_RESEARCH_RANGE.endTime,
    startIso: M3_R6_RESEARCH_START_ISO,
    endIso: M3_R6_RESEARCH_END_ISO,
    classification: M3_R6_DATA_CLASSIFICATION,
  },
  symbols: Object.freeze([...RESEARCH_SYMBOLS]),
  folds: RESEARCH_FOLDS,
  control: {
    candidateId: M3_R6_ROUND_006_CONTROL_ID,
    strategyVersion: M3_R6_ROUND_006_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R6_ROUND_006_POLICY_VERSION,
    reportSchemaVersion: M3_R6_ROUND_006_CONTROL_REPORT_SCHEMA_VERSION,
    order: "EXACT_BASELINE_001_FIRST;CANDIDATES_ARE_DERIVED_FROM_THE_CONTROL_FORMAL_STREAM",
  },
  candidateRegistry: M3_R6_ROUND_006_VARIANT_REGISTRY,
  candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
  protocol: {
    version: M3_R6_PROTOCOL_VERSION,
    sourceIdentity: M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
    candidateFamilies: ["A_REDUNDANCY", "B_CROSS_SECTIONAL", "C_TREND_FRESHNESS", "D_BREAKOUT_QUALITY"],
    candidateComposition: "A1_A2_A3_B1_B2_B3_B4_C1_C2_D1_D2_ARE_SINGLE_MECHANISM;D3_IS_THE_ONLY_PREDECLARED_DUAL_CONFIRMATION_WITHIN_D",
    formulas: "SEE_R6_PROTOCOL_MACHINE_RECORD_AND_FROZEN_CANDIDATE_REGISTRY",
    dataBoundary: "DECISION_TIME_FEATURES_USE_CLOSED_CANDLES_ONLY;NO_FUTURE_PRICES",
    requiredTimeframes: R6_DATA_CONTRACT.timeframes,
    requiredRelativeStrengthHorizons: R6_DATA_CONTRACT.relativeStrengthHorizons,
    complexityTuples: M3_R6_ROUND_006_MACHINE_RECORD.complexityTuples,
  },
  gate: {
    path: "src/lib/research/selection-gates-round-006.ts",
    recordVersion: M3_R6_ROUND_006_MACHINE_RECORD.recordVersion,
    sha256: M3_R6_ROUND_006_SELECTION_GATE_SHA256,
    inheritedRound005GateSha256: M3_R6_ROUND_006_INHERITED_GATE_SHA256,
    inheritedRound004GateSha256: M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256,
    numericSemantics: "INHERIT_EXISTING_HARD_GATE_VALUES_AND_FORMULAS_WITHOUT_WEAKENING",
    hardGateIdentities: M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
    applicableHardGateIdentities: M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
    selectionGates: M3_R6_ROUND_006_SELECTION_GATES,
  },
  dataContract: R6_DATA_CONTRACT,
  execution: R6_EXECUTION_CONTRACTS,
  selection: {
    algorithmVersion: M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.version,
    eligibilityFirst: true,
    allApplicableGatesConjunctive: true,
    noEarlyEligibilityExit: true,
    orderedCriteria: M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.orderedCriteria,
    stages: M3_R6_ROUND_006_DEFINITIONS.selectionAlgorithm.stages,
    expectancyTieBandThresholdR: 0.01,
    expectancyTieBandBoundary: "INCLUSIVE",
    expectancyTieBandFloatingComparison: "SCALE_AWARE_NUMBER_EPSILON",
    expectancyTieBandFloatingToleranceFormula: "tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold))",
    expectancyTieBandRule: "difference = maxExpectancy - candidateExpectancy; inside iff difference - threshold <= tolerance",
    complexityTieThresholdR: 0.01,
    zeroEligibleOutcome: M3_R6_ROUND_006_NO_CANDIDATE_OUTCOME,
    deterministicCandidateOrder: "candidateId_ASCENDING_FINAL_TIE_BREAK",
  },
  metricStatusContract: M3_R6_ROUND_006_METRIC_STATUS_CONTRACT,
  authorization: {
    freezeSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
    performanceExecutionSourceSha: null,
    performanceExecutionSourceRule: "SUPPLY_ONLY_AT_AUTHORIZED_RUNTIME;NEVER_PREDECLARE_IN_FREEZE",
    authorizedExecutionSourceRule: "executionSourceSha_EQUALS_authorizedExecutionSourceSha_EQUALS_git_HEAD;clean_worktree_TRUE;outputs_absent_before_network;manifests_pass",
    requiredGateSha256: M3_R6_ROUND_006_SELECTION_GATE_SHA256,
    requiredPlanSha256: "SELF_CANONICAL_HASH_VERIFIED_AT_RUNTIME",
    requiredProtocolVersion: M3_R6_PROTOCOL_VERSION,
    requiredResearchRoundId: M3_R6_RESEARCH_ROUND_ID,
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
    noTuning: true,
    noOptimizer: true,
    noRandomSearch: true,
    noThresholdSweep: true,
    noBruteForceCombinations: true,
    noPostResultCandidateReplacement: true,
    noNewMarketDataFromLiveSample: true,
    liveObservations: "SEEN_DIAGNOSTIC_DATA_ONLY;NOT_GATE_EVIDENCE;NOT_THRESHOLD_INPUT",
    noPerformanceInFreeze: true,
  },
  liveDiagnosticObservations: {
    classification: "SEEN_DIAGNOSTIC_DATA_ONLY",
    resolved: 16,
    tp: 3,
    sl: 13,
    cumulativeR: -7,
    profitFactor: 0.4615,
    maxDrawdownR: -13,
    bySymbol: { SOLUSDT: { trades: 4, tp: 3, sl: 1, cumulativeR: 5 }, BNBUSDT: { trades: 3, tp: 0, sl: 3, cumulativeR: -3 }, ETHUSDT: { trades: 4, tp: 0, sl: 4, cumulativeR: -4 }, XRPUSDT: { trades: 5, tp: 0, sl: 5, cumulativeR: -5 } },
    byGrade: { A: { trades: 13, tp: 3, sl: 10, cumulativeR: -4 }, B: { trades: 3, tp: 0, sl: 3, cumulativeR: -3 } },
    commonDirection: "LONG",
    commonBtcRegime: "BTC_STRONG_BULL",
    commonSymbolRegime: "LONG_ONLY",
    overlappingActiveThesisCount: 11,
    usedForGatesOrThresholds: false,
  },
  status: {
    baseline002Status: "NOT_FROZEN",
    m3R6Status: "FROZEN_PENDING_ACCEPTANCE",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
  },
});

export const M3_R6_ROUND_006_PLAN_CANONICAL_JSON = stableStringify(M3_R6_ROUND_006_PLAN);

// Replaced after the plan record is final; never use this value to change a gate.
export const M3_R6_ROUND_006_PLAN_SHA256 =
  "2619723e98e3ffa083a1833454c838993263d0e7066527abaa373d2e373ef7d9" as const;

export function validateM3R6Round006Plan(
  plan: typeof M3_R6_ROUND_006_PLAN = M3_R6_ROUND_006_PLAN,
): typeof M3_R6_ROUND_006_PLAN {
  if (plan.schemaVersion !== M3_R6_ROUND_006_PLAN_SCHEMA_VERSION) throw new Error("M3-R6 Plan schema mismatch.");
  if (plan.researchRoundId !== M3_R6_RESEARCH_ROUND_ID || plan.sourceSha !== M3_R6_ROUND_006_FREEZE_SOURCE_SHA || plan.freezeSourceSha !== M3_R6_ROUND_006_FREEZE_SOURCE_SHA) throw new Error("M3-R6 Plan provenance mismatch.");
  if (plan.dataClassification !== M3_R6_DATA_CLASSIFICATION) throw new Error("M3-R6 Plan data classification changed.");
  if (stableStringify(plan.symbols) !== stableStringify(RESEARCH_SYMBOLS) || stableStringify(plan.folds) !== stableStringify(RESEARCH_FOLDS)) throw new Error("M3-R6 Plan universe or fold registry changed.");
  if (stableStringify(plan.candidateIds) !== stableStringify(M3_R6_ROUND_006_CANDIDATE_IDS) || stableStringify(plan.candidateRegistry) !== stableStringify(M3_R6_ROUND_006_VARIANT_REGISTRY)) throw new Error("M3-R6 Plan candidate registry changed.");
  if (plan.control.candidateId !== M3_R6_ROUND_006_CONTROL_ID || plan.control.backtestPolicyVersion !== M3_R6_ROUND_006_POLICY_VERSION) throw new Error("M3-R6 Plan CONTROL or policy changed.");
  if (plan.gate.sha256 !== M3_R6_ROUND_006_SELECTION_GATE_SHA256 || plan.gate.inheritedRound005GateSha256 !== M3_R6_ROUND_006_INHERITED_GATE_SHA256 || plan.gate.inheritedRound004GateSha256 !== M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256) throw new Error("M3-R6 Plan Gate provenance changed.");
  if (plan.authorization.performanceExecutionSourceSha !== null || plan.performance.executionSourceSha !== null || plan.authorization.requiredPlanSha256 !== "SELF_CANONICAL_HASH_VERIFIED_AT_RUNTIME") throw new Error("M3-R6 Plan predeclares a performance source or self-hash incorrectly.");
  if (plan.performance.status !== "NOT_GENERATED" || plan.performance.authorization !== "NOT_AUTHORIZED") throw new Error("M3-R6 Plan performance boundary changed.");
  if (plan.status.baseline002Status !== "NOT_FROZEN" || plan.status.m3JStatus !== "BLOCKED" || plan.status.m4Status !== "NOT_STARTED") throw new Error("M3-R6 Plan milestone boundary changed.");
  const hash = createHash("sha256").update(stableStringify(plan), "utf8").digest("hex");
  if (hash !== M3_R6_ROUND_006_PLAN_SHA256) throw new Error("M3-R6 Plan canonical SHA mismatch.");
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

export function validateM3R6PerformanceAuthorization(input: M3R6PerformanceAuthorizationInput): void {
  const errors: string[] = [];
  const sha = (value: string): boolean => /^[0-9a-f]{40}$/.test(value);
  if (!sha(input.executionSourceSha) || !sha(input.authorizedExecutionSourceSha) || !sha(input.headSha)) errors.push("execution source and HEAD values must be Git SHAs");
  if (input.executionSourceSha !== input.authorizedExecutionSourceSha || input.authorizedExecutionSourceSha !== input.headSha) errors.push("execution source, authorized source, and HEAD must match");
  if (!input.cleanWorktree) errors.push("worktree must be clean");
  if (input.existingAuthoritativeOutputArtifacts.length !== 0) errors.push("authoritative outputs must be absent");
  if (input.requiredManifestStatus !== "PASS_BEFORE_NETWORK") errors.push("required manifests must pass");
  if (input.protocolVersion !== M3_R6_PROTOCOL_VERSION || input.protocolSourceSha !== M3_R6_ROUND_006_FREEZE_SOURCE_SHA || !/^[0-9a-f]{40}$/.test(input.protocolGitBlobSha)) errors.push("protocol provenance mismatch");
  if (input.researchRoundId !== M3_R6_RESEARCH_ROUND_ID || input.selectionGateSha256 !== M3_R6_ROUND_006_SELECTION_GATE_SHA256 || input.planSha256 !== M3_R6_ROUND_006_PLAN_SHA256) errors.push("Round-006 identity mismatch");
  if (stableStringify(input.candidateIds) !== stableStringify(M3_R6_ROUND_006_CANDIDATE_IDS) || input.controlId !== M3_R6_ROUND_006_CONTROL_ID || stableStringify(input.symbols) !== stableStringify(RESEARCH_SYMBOLS) || stableStringify(input.folds) !== stableStringify(RESEARCH_FOLDS) || input.backtestPolicyVersion !== M3_R6_ROUND_006_POLICY_VERSION || input.researchEndIso !== M3_R6_RESEARCH_END_ISO) errors.push("Round-006 universe or policy mismatch");
  if (errors.length > 0) throw new Error(errors.join("; "));
}

export const BASELINE_002_RESEARCH_ROUND_006_PLAN = M3_R6_ROUND_006_PLAN;
export const BASELINE_002_RESEARCH_ROUND_006_PLAN_CANONICAL_JSON = M3_R6_ROUND_006_PLAN_CANONICAL_JSON;
export const BASELINE_002_RESEARCH_ROUND_006_PLAN_SHA256 = M3_R6_ROUND_006_PLAN_SHA256;
