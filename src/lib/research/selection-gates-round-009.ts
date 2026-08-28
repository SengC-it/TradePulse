import { createHash } from "node:crypto";

import type { NumericSelectionGate, SelectionGateSchema } from "./types.ts";
import { validateSelectionGateSchema } from "./gates.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R9_BASE_SOURCE_SHA,
  M3_R9_CANDIDATE_IDS,
  M3_R9_CONTROL_ID,
  M3_R9_NO_CANDIDATE_OUTCOME,
  M3_R9_PERFORMANCE_LOCK,
  M3_R9_PROTOCOL_VERSION,
  M3_R9_RESEARCH_RANGE,
  M3_R9_RESEARCH_ROUND_ID,
  R9_CANDIDATE_REGISTRY,
  R9_CENSOR_SEMANTICS,
  R9_COMPLEXITY_TUPLES,
  R9_DATA_CONTRACT,
  R9_EXECUTION_CONTRACT,
  R9_FEATURE_DEFINITIONS,
  R9_FROZEN_FOLDS,
  R9_MODEL_CONTRACT,
  R9_ROUTER_BUCKETS,
  R9_SYMBOLS,
} from "./m3-r9-round-009-protocol.ts";
import type { R9CandidateId, R9ComplexityTuple } from "./m3-r9-round-009-protocol.ts";

export const R9_HARD_GATE_IDENTITIES = Object.freeze([
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
  "positiveNetValidationFolds",
  "modelIntegrity",
] as const);
export type R9GateId = (typeof R9_HARD_GATE_IDENTITIES)[number];

const R9_SELECTION_GATES_UNVALIDATED: SelectionGateSchema = {
  researchRoundId: M3_R9_RESEARCH_ROUND_ID,
  sourceSha: M3_R9_BASE_SOURCE_SHA,
  minimumAggregateImprovement: { value: 0.1, unit: "R/executed-trade", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "candidate aggregate validation expectancyR - CONTROL aggregate validation expectancyR" },
  minimumImprovedValidationFolds: { value: 4, unit: "folds", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "six frozen validation folds; candidate expectancyR - CONTROL expectancyR >= 0.02 with both fold samples >= 30" },
  catastrophicFoldLimit: { value: 0, unit: "folds", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "six frozen validation folds; expectancyR <= -0.10, NORMAL PF < 0.80, NO_TRADES, or executed sample < 30" },
  minimumNetExpectancy: { value: 0.03, unit: "R/executed-trade", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "concatenated non-overlapping validation segments" },
  minimumProfitFactor: { value: 1.2, unit: "ratio", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "validation positive netR / absolute negative netR; NO_TRADES fails and NO_LOSSES requires sample gates" },
  maximumSymbolConcentration: { value: 0.5, unit: "fraction", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "top symbol share of positive validation netR; null fails" },
  maximumSingleTradeConcentration: { value: 0.1, unit: "fraction", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "largest positive validation trade share; null fails" },
  maximumFeeBurdenRatio: { value: 0.75, unit: "ratio", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "validation feeR / abs(grossR); zero or null grossR fails" },
  requiredRedundancyImprovement: { value: 0, unit: "not-applicable", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "not applicable to the five structurally defined R9 mechanisms" },
  minimumFormalSignals: { value: 300, unit: "formal-signals", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "aggregate validation formal signals" },
  minimumExecutedTrades: { value: 30, unit: "executed-trades", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "minimum executed trades in every validation fold" },
  complexityTieThreshold: { value: 0.01, unit: "R/executed-trade", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "aggregate validation expectancy inclusive tie band" },
  simplerCandidateRule: { rule: "Prefer more improved validation folds; then higher expectancy outside the inclusive scale-aware 0.01 tie band; then lexicographically simpler complexity; then higher PF; then candidateId.", tieBreakOrder: ["improvedValidationFolds", "aggregateValidationExpectancyR", "complexityTuple", "aggregateValidationProfitFactor", "candidateId"] },
};

export const R9_SELECTION_GATES = validateSelectionGateSchema(R9_SELECTION_GATES_UNVALIDATED);
export const R9_SUPPLEMENTAL_GATES = deepFreeze({
  positiveNetValidationFolds: { value: 4, unit: "folds", comparison: "AT_LEAST", rule: "candidate validation expectancyR > 0 in at least four folds" },
  modelIntegrity: { value: 1, unit: "boolean", comparison: "EQUAL", rule: "the applicable six fold model is research-only, finite, and unchanged before validation prediction" },
});

export const R9_DEFINITIONS = deepFreeze({
  researchRoundId: M3_R9_RESEARCH_ROUND_ID,
  protocolVersion: M3_R9_PROTOCOL_VERSION,
  hardGateIdentities: R9_HARD_GATE_IDENTITIES,
  selectionGates: R9_SELECTION_GATES,
  supplementalGates: R9_SUPPLEMENTAL_GATES,
  foldImprovementDeltaR: 0.02,
  validationFoldCount: 6,
  catastrophicFold: { expectancyRAtMost: -0.1, normalProfitFactorBelow: 0.8, noTradesIsCatastrophic: true, insufficientFoldSampleIsCatastrophic: true },
  profitFactorStatusSemantics: { NORMAL: "COMPARE_NUMERIC_PF_TO_MINIMUM", NO_LOSSES: "PASS_ONLY_AFTER_SAMPLE_GATES", NO_TRADES: "FAIL", encodeInfinity: false },
  censorSemantics: R9_CENSOR_SEMANTICS,
  featureDefinitions: R9_FEATURE_DEFINITIONS,
  modelContract: R9_MODEL_CONTRACT,
  routerBuckets: R9_ROUTER_BUCKETS,
  candidateRegistry: R9_CANDIDATE_REGISTRY,
  complexityTuples: R9_COMPLEXITY_TUPLES,
  selectionAlgorithm: {
    version: "m3-r9-selection-algorithm-001",
    stages: ["ELIGIBILITY", "IMPROVED_VALIDATION_FOLDS", "EXPECTANCY_INCLUSIVE_0_01_TIE_BAND", "COMPLEXITY", "PROFIT_FACTOR", "CANDIDATE_ID"],
    expectancyTieBandThresholdR: 0.01,
    expectancyTieBandBoundary: "INCLUSIVE",
    expectancyTieBandFloatingComparison: "SCALE_AWARE_NUMBER_EPSILON",
    expectancyTieBandFloatingToleranceFormula: "tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold))",
    expectancyTieBandRule: "difference = maxExpectancy - candidateExpectancy; inside iff difference - threshold <= tolerance",
  },
  noEarlyEligibilityExit: true,
  allApplicableGatesConjunctive: true,
  noCandidateOutcome: M3_R9_NO_CANDIDATE_OUTCOME,
  performanceLock: M3_R9_PERFORMANCE_LOCK,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R9_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r9-selection-gates-001",
  researchRoundId: M3_R9_RESEARCH_ROUND_ID,
  protocolVersion: M3_R9_PROTOCOL_VERSION,
  freezeSourceSha: M3_R9_BASE_SOURCE_SHA,
  performanceExecutionSourceSha: null,
  performanceLock: M3_R9_PERFORMANCE_LOCK,
  controlId: M3_R9_CONTROL_ID,
  universe: M3_R9_RESEARCH_RANGE,
  symbols: R9_SYMBOLS,
  folds: R9_FROZEN_FOLDS,
  candidateIds: M3_R9_CANDIDATE_IDS,
  candidateRegistry: R9_CANDIDATE_REGISTRY,
  complexityTuples: R9_COMPLEXITY_TUPLES,
  selectionGates: R9_SELECTION_GATES,
  definitions: R9_DEFINITIONS,
  dataContract: R9_DATA_CONTRACT,
  executionContract: R9_EXECUTION_CONTRACT,
  governance: { noTuning: true, noSweep: true, noOptimizer: true, noPostResultCandidateReplacement: true, liveObservations: "SEEN_DIAGNOSTIC_DATA_ONLY" },
  baseline002Status: "NOT_FROZEN",
  m3R9Status: "FROZEN_PENDING_ACCEPTANCE",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R9_CANONICAL_JSON = stableStringify(R9_MACHINE_RECORD);
export const R9_SELECTION_GATE_SHA256 = createHash("sha256").update(R9_CANONICAL_JSON, "utf8").digest("hex");

export function validateR9MachineRecord(record: typeof R9_MACHINE_RECORD = R9_MACHINE_RECORD): typeof R9_MACHINE_RECORD {
  if (record.recordVersion !== "m3-r9-selection-gates-001" || record.researchRoundId !== M3_R9_RESEARCH_ROUND_ID || record.protocolVersion !== M3_R9_PROTOCOL_VERSION || record.freezeSourceSha !== M3_R9_BASE_SOURCE_SHA) throw new Error("R9 Gate provenance mismatch.");
  if (record.performanceExecutionSourceSha !== null || record.performanceLock !== M3_R9_PERFORMANCE_LOCK) throw new Error("R9 Gate performance boundary changed.");
  if (stableStringify(record.candidateIds) !== stableStringify(M3_R9_CANDIDATE_IDS) || stableStringify(record.candidateRegistry) !== stableStringify(R9_CANDIDATE_REGISTRY) || stableStringify(record.complexityTuples) !== stableStringify(R9_COMPLEXITY_TUPLES)) throw new Error("R9 candidate registry changed.");
  if (stableStringify(record.selectionGates) !== stableStringify(R9_SELECTION_GATES) || stableStringify(record.definitions) !== stableStringify(R9_DEFINITIONS)) throw new Error("R9 gate definitions changed.");
  if (record.baseline002Status !== "NOT_FROZEN" || record.m3JStatus !== "BLOCKED" || record.m4Status !== "NOT_STARTED") throw new Error("R9 milestone boundary changed.");
  const hash = createHash("sha256").update(stableStringify(record), "utf8").digest("hex");
  if (hash !== R9_SELECTION_GATE_SHA256) throw new Error("R9 Gate canonical SHA mismatch.");
  return record;
}

export type R9CandidateGateInput = Readonly<{
  candidateId: R9CandidateId;
  resultStatus: "COMPLETE" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED";
  validationIncomplete?: boolean;
  aggregateImprovement: number | null;
  improvedValidationFolds: number | null;
  catastrophicFolds: number | null;
  positiveNetValidationFolds: number | null;
  netExpectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: "NORMAL" | "NO_TRADES" | "NO_LOSSES";
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
  formalSignals: number | null;
  minimumFoldExecutedTrades: number | null;
  modelIntegrity?: boolean;
  modelRequired?: boolean;
}>;

export type R9GateResult = Readonly<{ gateId: R9GateId; status: "PASS" | "FAIL" | "INCOMPLETE" | "NOT_APPLICABLE"; applicability: "APPLICABLE" | "NOT_APPLICABLE"; actualValue: number | boolean | null | "NOT_APPLICABLE"; threshold: number }>;
export type R9CandidateGateEvaluation = Readonly<{ candidateId: R9CandidateId; gateResults: readonly R9GateResult[]; applicableGateCount: number; passedApplicableGateCount: number; failedGateIds: readonly string[]; eligibility: "ELIGIBLE" | "INELIGIBLE" | "INCOMPLETE" }>;

function finite(value: number | null): value is number { return typeof value === "number" && Number.isFinite(value); }
function pass(gate: NumericSelectionGate, value: number | null): boolean { return finite(value) && (gate.comparison === "AT_LEAST" ? value >= gate.value : value <= gate.value); }

export function evaluateR9CandidateGates(input: R9CandidateGateInput): R9CandidateGateEvaluation {
  const gates = R9_SELECTION_GATES;
  const samplePass = pass(gates.minimumFormalSignals, input.formalSignals) && pass(gates.minimumExecutedTrades, input.minimumFoldExecutedTrades) && pass(gates.catastrophicFoldLimit, input.catastrophicFolds);
  const incomplete = input.resultStatus === "DATA_INCOMPLETE" || input.validationIncomplete === true;
  const actual: Record<string, number | boolean | null> = {
    minimumAggregateImprovement: input.aggregateImprovement,
    minimumImprovedValidationFolds: input.improvedValidationFolds,
    catastrophicFoldLimit: input.catastrophicFolds,
    minimumNetExpectancy: input.netExpectancyR,
    minimumProfitFactor: input.profitFactorStatus === "NO_LOSSES" && samplePass ? gates.minimumProfitFactor.value : input.profitFactor,
    maximumSymbolConcentration: input.topSymbolShareOfPositiveNetR,
    maximumSingleTradeConcentration: input.largestSingleTradeShareOfPositiveNetR,
    maximumFeeBurdenRatio: input.feeBurdenRatio,
    minimumFormalSignals: input.formalSignals,
    minimumExecutedTrades: input.minimumFoldExecutedTrades,
    positiveNetValidationFolds: input.positiveNetValidationFolds,
    modelIntegrity: input.modelRequired ? input.modelIntegrity === true : true,
  };
  const thresholds: Record<string, number> = {
    minimumAggregateImprovement: gates.minimumAggregateImprovement.value,
    minimumImprovedValidationFolds: gates.minimumImprovedValidationFolds.value,
    catastrophicFoldLimit: gates.catastrophicFoldLimit.value,
    minimumNetExpectancy: gates.minimumNetExpectancy.value,
    minimumProfitFactor: gates.minimumProfitFactor.value,
    maximumSymbolConcentration: gates.maximumSymbolConcentration.value,
    maximumSingleTradeConcentration: gates.maximumSingleTradeConcentration.value,
    maximumFeeBurdenRatio: gates.maximumFeeBurdenRatio.value,
    minimumFormalSignals: gates.minimumFormalSignals.value,
    minimumExecutedTrades: gates.minimumExecutedTrades.value,
    positiveNetValidationFolds: R9_SUPPLEMENTAL_GATES.positiveNetValidationFolds.value,
    modelIntegrity: R9_SUPPLEMENTAL_GATES.modelIntegrity.value,
  };
  const results = R9_HARD_GATE_IDENTITIES.map((gateId) => {
    let status: R9GateResult["status"];
    if (incomplete) status = "INCOMPLETE";
    else if (gateId === "minimumProfitFactor" && input.profitFactorStatus === "NO_TRADES") status = "FAIL";
    else if (gateId === "minimumProfitFactor" && input.profitFactorStatus === "NO_LOSSES") status = samplePass ? "PASS" : "FAIL";
    else if (gateId === "modelIntegrity") status = input.modelRequired && input.modelIntegrity !== true ? "FAIL" : "PASS";
    else status = pass((gates as unknown as Record<string, NumericSelectionGate>)[gateId] ?? { value: thresholds[gateId]!, comparison: "AT_LEAST" } as NumericSelectionGate, actual[gateId] as number | null) ? "PASS" : "FAIL";
    return Object.freeze({ gateId, status, applicability: "APPLICABLE", actualValue: actual[gateId] ?? null, threshold: thresholds[gateId]! });
  });
  const passed = results.filter((result) => result.status === "PASS");
  const failed = results.filter((result) => result.status !== "PASS").map((result) => result.gateId);
  return Object.freeze({ candidateId: input.candidateId, gateResults: Object.freeze(results), applicableGateCount: results.length, passedApplicableGateCount: passed.length, failedGateIds: Object.freeze(failed), eligibility: incomplete ? "INCOMPLETE" : failed.length === 0 ? "ELIGIBLE" : "INELIGIBLE" });
}

export type R9SelectionCandidate = Readonly<{ candidateId: R9CandidateId; eligible: boolean; improvedValidationFolds: number; aggregateValidationExpectancyR: number; complexityTuple: R9ComplexityTuple; aggregateValidationProfitFactor: number | null }>;
export type R9SelectionResult = Readonly<{ selectionAlgorithmApplied: boolean; eligibleCandidateIds: readonly R9CandidateId[]; selectedCandidateId: R9CandidateId | null; finalDecision: string }>;

export function isWithinInclusiveR9ExpectancyTieBand(maxExpectancy: number, candidateExpectancy: number, threshold: number): boolean {
  const difference = maxExpectancy - candidateExpectancy;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold));
  return difference - threshold <= tolerance;
}

function complexityCompare(left: R9ComplexityTuple, right: R9ComplexityTuple): number {
  for (const key of ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"] as const) if (left[key] !== right[key]) return left[key] - right[key];
  return 0;
}

export function selectR9Candidate(candidates: readonly R9SelectionCandidate[]): R9SelectionResult {
  const eligible = candidates.filter((candidate) => candidate.eligible);
  if (eligible.length === 0) return Object.freeze({ selectionAlgorithmApplied: false, eligibleCandidateIds: Object.freeze([]), selectedCandidateId: null, finalDecision: M3_R9_NO_CANDIDATE_OUTCOME });
  const maxFolds = Math.max(...eligible.map((candidate) => candidate.improvedValidationFolds));
  const foldCohort = eligible.filter((candidate) => candidate.improvedValidationFolds === maxFolds);
  const maxExpectancy = Math.max(...foldCohort.map((candidate) => candidate.aggregateValidationExpectancyR));
  const expectancyCohort = foldCohort.filter((candidate) => isWithinInclusiveR9ExpectancyTieBand(maxExpectancy, candidate.aggregateValidationExpectancyR, R9_SELECTION_GATES.complexityTieThreshold.value));
  const ordered = [...expectancyCohort].sort((left, right) => complexityCompare(left.complexityTuple, right.complexityTuple) || ((left.aggregateValidationProfitFactor === null ? Number.POSITIVE_INFINITY : -left.aggregateValidationProfitFactor) - (right.aggregateValidationProfitFactor === null ? Number.POSITIVE_INFINITY : -right.aggregateValidationProfitFactor)) || left.candidateId.localeCompare(right.candidateId));
  return Object.freeze({ selectionAlgorithmApplied: true, eligibleCandidateIds: Object.freeze(eligible.map((candidate) => candidate.candidateId).sort()), selectedCandidateId: ordered[0]!.candidateId, finalDecision: "SELECTED_BASELINE_002_CANDIDATE" });
}

export const BASELINE_002_RESEARCH_ROUND_009_SELECTION_GATES = R9_SELECTION_GATES;
