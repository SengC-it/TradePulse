import { createHash } from "node:crypto";

import type { NumericSelectionGate, SelectionGateSchema } from "./types.ts";
import { validateSelectionGateSchema } from "./gates.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R10_BASE_SOURCE_SHA,
  M3_R10_CANDIDATE_IDS,
  M3_R10_CONTROL_ID,
  M3_R10_NO_CANDIDATE_OUTCOME,
  M3_R10_PERFORMANCE_LOCK,
  M3_R10_PROTOCOL_VERSION,
  M3_R10_RESEARCH_RANGE,
  M3_R10_RESEARCH_ROUND_ID,
  R10_CANDIDATE_REGISTRY,
  R10_CENSOR_SEMANTICS,
  R10_COMPLEXITY_TUPLES,
  R10_DATA_CONTRACT,
  R10_EXECUTION_CONTRACT,
  R10_FEATURE_DEFINITIONS,
  R10_FROZEN_FOLDS,
  R10_MODEL_CONTRACT,
  R10_ROUTER_BUCKETS,
  R10_RISK_GEOMETRY_CONTRACT,
  R10_SYMBOLS,
} from "./m3-r10-round-010-protocol.ts";
import type { R10CandidateId, R10ComplexityTuple } from "./m3-r10-round-010-protocol.ts";

export const R10_HARD_GATE_IDENTITIES = Object.freeze([
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
export type R10GateId = (typeof R10_HARD_GATE_IDENTITIES)[number];

const R10_SELECTION_GATES_UNVALIDATED: SelectionGateSchema = {
  researchRoundId: M3_R10_RESEARCH_ROUND_ID,
  sourceSha: M3_R10_BASE_SOURCE_SHA,
  minimumAggregateImprovement: { value: 0.1, unit: "R/executed-trade", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "candidate aggregate validation expectancyR - CONTROL aggregate validation expectancyR" },
  minimumImprovedValidationFolds: { value: 4, unit: "folds", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "six frozen validation folds; candidate expectancyR - CONTROL expectancyR >= 0.02 with both fold samples >= 30" },
  catastrophicFoldLimit: { value: 0, unit: "folds", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "six frozen validation folds; expectancyR <= -0.10, NORMAL PF < 0.80, NO_TRADES, or executed sample < 30" },
  minimumNetExpectancy: { value: 0.03, unit: "R/executed-trade", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "concatenated non-overlapping validation segments" },
  minimumProfitFactor: { value: 1.2, unit: "ratio", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "validation positive netR / absolute negative netR; NO_TRADES fails and NO_LOSSES requires sample gates" },
  maximumSymbolConcentration: { value: 0.5, unit: "fraction", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "top symbol share of positive validation netR; null fails" },
  maximumSingleTradeConcentration: { value: 0.1, unit: "fraction", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "largest positive validation trade share; null fails" },
  maximumFeeBurdenRatio: { value: 0.75, unit: "ratio", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "validation feeR / abs(grossR); zero or null grossR fails" },
  requiredRedundancyImprovement: { value: 0, unit: "not-applicable", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "not applicable to the five structurally defined R10 mechanisms" },
  minimumFormalSignals: { value: 300, unit: "formal-signals", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "aggregate validation formal signals" },
  minimumExecutedTrades: { value: 30, unit: "executed-trades", direction: "MINIMUM", comparison: "AT_LEAST", denominator: "minimum executed trades in every validation fold" },
  complexityTieThreshold: { value: 0.01, unit: "R/executed-trade", direction: "MAXIMUM", comparison: "AT_MOST", denominator: "aggregate validation expectancy inclusive tie band" },
  simplerCandidateRule: { rule: "Prefer more improved validation folds; then higher expectancy outside the inclusive scale-aware 0.01 tie band; then lexicographically simpler complexity; then higher PF; then candidateId.", tieBreakOrder: ["improvedValidationFolds", "aggregateValidationExpectancyR", "complexityTuple", "aggregateValidationProfitFactor", "candidateId"] },
};

export const R10_SELECTION_GATES = validateSelectionGateSchema(R10_SELECTION_GATES_UNVALIDATED);
export const R10_SUPPLEMENTAL_GATES = deepFreeze({
  positiveNetValidationFolds: { value: 4, unit: "folds", comparison: "AT_LEAST", rule: "candidate validation expectancyR > 0 in at least four folds" },
  modelIntegrity: { value: 1, unit: "boolean", comparison: "EQUAL", rule: "the applicable six fold model is research-only, finite, and unchanged before validation prediction" },
});

export const R10_DEFINITIONS = deepFreeze({
  researchRoundId: M3_R10_RESEARCH_ROUND_ID,
  protocolVersion: M3_R10_PROTOCOL_VERSION,
  hardGateIdentities: R10_HARD_GATE_IDENTITIES,
  selectionGates: R10_SELECTION_GATES,
  supplementalGates: R10_SUPPLEMENTAL_GATES,
  foldImprovementDeltaR: 0.02,
  validationFoldCount: 6,
  catastrophicFold: { expectancyRAtMost: -0.1, normalProfitFactorBelow: 0.8, noTradesIsCatastrophic: true, insufficientFoldSampleIsCatastrophic: true },
  profitFactorStatusSemantics: { NORMAL: "COMPARE_NUMERIC_PF_TO_MINIMUM", NO_LOSSES: "PASS_ONLY_AFTER_SAMPLE_GATES", NO_TRADES: "FAIL", encodeInfinity: false },
  censorSemantics: R10_CENSOR_SEMANTICS,
  featureDefinitions: R10_FEATURE_DEFINITIONS,
  modelContract: R10_MODEL_CONTRACT,
  routerBuckets: R10_ROUTER_BUCKETS,
  candidateRegistry: R10_CANDIDATE_REGISTRY,
  complexityTuples: R10_COMPLEXITY_TUPLES,
  selectionAlgorithm: {
    version: "m3-r10-selection-algorithm-001",
    stages: ["ELIGIBILITY", "IMPROVED_VALIDATION_FOLDS", "EXPECTANCY_INCLUSIVE_0_01_TIE_BAND", "COMPLEXITY", "PROFIT_FACTOR", "CANDIDATE_ID"],
    expectancyTieBandThresholdR: 0.01,
    expectancyTieBandBoundary: "INCLUSIVE",
    expectancyTieBandFloatingComparison: "SCALE_AWARE_NUMBER_EPSILON",
    expectancyTieBandFloatingToleranceFormula: "tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold))",
    expectancyTieBandRule: "difference = maxExpectancy - candidateExpectancy; inside iff difference - threshold <= tolerance",
  },
  noEarlyEligibilityExit: true,
  allApplicableGatesConjunctive: true,
  noCandidateOutcome: M3_R10_NO_CANDIDATE_OUTCOME,
  performanceLock: M3_R10_PERFORMANCE_LOCK,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R10_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r10-selection-gates-001",
  researchRoundId: M3_R10_RESEARCH_ROUND_ID,
  protocolVersion: M3_R10_PROTOCOL_VERSION,
  freezeSourceSha: M3_R10_BASE_SOURCE_SHA,
  performanceExecutionSourceSha: null,
  performanceLock: M3_R10_PERFORMANCE_LOCK,
  controlId: M3_R10_CONTROL_ID,
  universe: M3_R10_RESEARCH_RANGE,
  symbols: R10_SYMBOLS,
  folds: R10_FROZEN_FOLDS,
  candidateIds: M3_R10_CANDIDATE_IDS,
  candidateRegistry: R10_CANDIDATE_REGISTRY,
  complexityTuples: R10_COMPLEXITY_TUPLES,
  selectionGates: R10_SELECTION_GATES,
  definitions: R10_DEFINITIONS,
  dataContract: R10_DATA_CONTRACT,
  executionContract: R10_EXECUTION_CONTRACT,
  riskGeometry: R10_RISK_GEOMETRY_CONTRACT,
  governance: { noTuning: true, noSweep: true, noOptimizer: true, noPostResultCandidateReplacement: true, liveObservations: "SEEN_DIAGNOSTIC_DATA_ONLY" },
  baseline002Status: "NOT_FROZEN",
  m3R10Status: "FROZEN_PENDING_ACCEPTANCE",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R10_CANONICAL_JSON = stableStringify(R10_MACHINE_RECORD);
export const R10_SELECTION_GATE_SHA256 = createHash("sha256").update(R10_CANONICAL_JSON, "utf8").digest("hex");

export function validateR10MachineRecord(record: typeof R10_MACHINE_RECORD = R10_MACHINE_RECORD): typeof R10_MACHINE_RECORD {
  if (record.recordVersion !== "m3-r10-selection-gates-001" || record.researchRoundId !== M3_R10_RESEARCH_ROUND_ID || record.protocolVersion !== M3_R10_PROTOCOL_VERSION || record.freezeSourceSha !== M3_R10_BASE_SOURCE_SHA) throw new Error("R10 Gate provenance mismatch.");
  if (record.performanceExecutionSourceSha !== null || record.performanceLock !== M3_R10_PERFORMANCE_LOCK) throw new Error("R10 Gate performance boundary changed.");
  if (stableStringify(record.candidateIds) !== stableStringify(M3_R10_CANDIDATE_IDS) || stableStringify(record.candidateRegistry) !== stableStringify(R10_CANDIDATE_REGISTRY) || stableStringify(record.complexityTuples) !== stableStringify(R10_COMPLEXITY_TUPLES)) throw new Error("R10 candidate registry changed.");
  if (stableStringify(record.selectionGates) !== stableStringify(R10_SELECTION_GATES) || stableStringify(record.definitions) !== stableStringify(R10_DEFINITIONS)) throw new Error("R10 gate definitions changed.");
  if (record.baseline002Status !== "NOT_FROZEN" || record.m3JStatus !== "BLOCKED" || record.m4Status !== "NOT_STARTED") throw new Error("R10 milestone boundary changed.");
  const hash = createHash("sha256").update(stableStringify(record), "utf8").digest("hex");
  if (hash !== R10_SELECTION_GATE_SHA256) throw new Error("R10 Gate canonical SHA mismatch.");
  return record;
}

export type R10CandidateGateInput = Readonly<{
  candidateId: R10CandidateId;
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

export type R10GateResult = Readonly<{ gateId: R10GateId; status: "PASS" | "FAIL" | "INCOMPLETE" | "NOT_APPLICABLE"; applicability: "APPLICABLE" | "NOT_APPLICABLE"; actualValue: number | boolean | null | "NOT_APPLICABLE"; threshold: number }>;
export type R10CandidateGateEvaluation = Readonly<{ candidateId: R10CandidateId; gateResults: readonly R10GateResult[]; applicableGateCount: number; passedApplicableGateCount: number; failedGateIds: readonly string[]; eligibility: "ELIGIBLE" | "INELIGIBLE" | "INCOMPLETE" }>;

function finite(value: number | null): value is number { return typeof value === "number" && Number.isFinite(value); }
function pass(gate: NumericSelectionGate, value: number | null): boolean { return finite(value) && (gate.comparison === "AT_LEAST" ? value >= gate.value : value <= gate.value); }

export function evaluateR10CandidateGates(input: R10CandidateGateInput): R10CandidateGateEvaluation {
  const gates = R10_SELECTION_GATES;
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
    positiveNetValidationFolds: R10_SUPPLEMENTAL_GATES.positiveNetValidationFolds.value,
    modelIntegrity: R10_SUPPLEMENTAL_GATES.modelIntegrity.value,
  };
  const results = R10_HARD_GATE_IDENTITIES.map((gateId) => {
    let status: R10GateResult["status"];
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

export type R10SelectionCandidate = Readonly<{ candidateId: R10CandidateId; eligible: boolean; improvedValidationFolds: number; aggregateValidationExpectancyR: number; complexityTuple: R10ComplexityTuple; aggregateValidationProfitFactor: number | null }>;
export type R10SelectionResult = Readonly<{ selectionAlgorithmApplied: boolean; eligibleCandidateIds: readonly R10CandidateId[]; selectedCandidateId: R10CandidateId | null; finalDecision: string }>;

export function isWithinInclusiveR10ExpectancyTieBand(maxExpectancy: number, candidateExpectancy: number, threshold: number): boolean {
  const difference = maxExpectancy - candidateExpectancy;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold));
  return difference - threshold <= tolerance;
}

function complexityCompare(left: R10ComplexityTuple, right: R10ComplexityTuple): number {
  for (const key of ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"] as const) if (left[key] !== right[key]) return left[key] - right[key];
  return 0;
}

export function selectR10Candidate(candidates: readonly R10SelectionCandidate[]): R10SelectionResult {
  const eligible = candidates.filter((candidate) => candidate.eligible);
  if (eligible.length === 0) return Object.freeze({ selectionAlgorithmApplied: false, eligibleCandidateIds: Object.freeze([]), selectedCandidateId: null, finalDecision: M3_R10_NO_CANDIDATE_OUTCOME });
  const maxFolds = Math.max(...eligible.map((candidate) => candidate.improvedValidationFolds));
  const foldCohort = eligible.filter((candidate) => candidate.improvedValidationFolds === maxFolds);
  const maxExpectancy = Math.max(...foldCohort.map((candidate) => candidate.aggregateValidationExpectancyR));
  const expectancyCohort = foldCohort.filter((candidate) => isWithinInclusiveR10ExpectancyTieBand(maxExpectancy, candidate.aggregateValidationExpectancyR, R10_SELECTION_GATES.complexityTieThreshold.value));
  const ordered = [...expectancyCohort].sort((left, right) => complexityCompare(left.complexityTuple, right.complexityTuple) || ((left.aggregateValidationProfitFactor === null ? Number.POSITIVE_INFINITY : -left.aggregateValidationProfitFactor) - (right.aggregateValidationProfitFactor === null ? Number.POSITIVE_INFINITY : -right.aggregateValidationProfitFactor)) || left.candidateId.localeCompare(right.candidateId));
  return Object.freeze({ selectionAlgorithmApplied: true, eligibleCandidateIds: Object.freeze(eligible.map((candidate) => candidate.candidateId).sort()), selectedCandidateId: ordered[0]!.candidateId, finalDecision: "SELECTED_BASELINE_002_CANDIDATE" });
}

export const BASELINE_002_RESEARCH_ROUND_010_SELECTION_GATES = R10_SELECTION_GATES;
