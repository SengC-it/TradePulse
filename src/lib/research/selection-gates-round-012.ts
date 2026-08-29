import { createHash } from "node:crypto";

import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R12_BASE_SOURCE_SHA,
  M3_R12_CANDIDATE_IDS,
  M3_R12_CONTROL_ID,
  M3_R12_NO_CANDIDATE_OUTCOME,
  M3_R12_PERFORMANCE_LOCK,
  M3_R12_PROTOCOL_VERSION,
  M3_R12_RESEARCH_RANGE,
  M3_R12_RESEARCH_ROUND_ID,
  R12_CANDIDATE_REGISTRY,
  R12_COMPLEXITY_TUPLES,
  R12_DATA_CONTRACT,
  R12_EXECUTION_CONTRACT,
  R12_FROZEN_FOLDS,
  R12_GOVERNANCE,
  R12_SYMBOLS,
  R12_THESIS_CONTRACT,
  type R12CandidateId,
} from "./m3-r12-round-012-protocol.ts";

export const R12_HARD_GATE_IDENTITIES = Object.freeze([
  "minimumAggregateExecutedTrades",
  "minimumValidationFoldExecutedTrades",
  "minimumNetExpectancy",
  "minimumProfitFactor",
  "minimumAggregateImprovement",
  "minimumImprovedValidationFolds",
  "minimumPositiveValidationFolds",
  "maximumCatastrophicFolds",
  "minimumDrawdownMagnitudeImprovement",
  "maximumSymbolConcentration",
  "maximumSinglePositiveTradeContribution",
  "evidenceIntegrity",
] as const);
export type R12GateId = (typeof R12_HARD_GATE_IDENTITIES)[number];

export type R12GateDefinition = Readonly<{
  value: number;
  unit: string;
  comparison: "AT_LEAST" | "AT_MOST" | "EQUAL";
  denominator: string;
}>;

export const R12_SELECTION_GATES: Readonly<Record<R12GateId, R12GateDefinition>> = deepFreeze({
  minimumAggregateExecutedTrades: { value: 300, unit: "executed-trades", comparison: "AT_LEAST", denominator: "aggregate validation executed trades" },
  minimumValidationFoldExecutedTrades: { value: 30, unit: "executed-trades/fold", comparison: "AT_LEAST", denominator: "minimum executed trades across six frozen validation folds" },
  minimumNetExpectancy: { value: 0.03, unit: "R/executed-trade", comparison: "AT_LEAST", denominator: "aggregate validation net expectancy" },
  minimumProfitFactor: { value: 1.2, unit: "ratio", comparison: "AT_LEAST", denominator: "aggregate validation positive netR / absolute negative netR" },
  minimumAggregateImprovement: { value: 0.1, unit: "R/executed-trade", comparison: "AT_LEAST", denominator: "candidate aggregate validation expectancyR - CONTROL aggregate validation expectancyR" },
  minimumImprovedValidationFolds: { value: 4, unit: "folds", comparison: "AT_LEAST", denominator: "candidate expectancyR - CONTROL expectancyR >= 0.02 in six validation folds" },
  minimumPositiveValidationFolds: { value: 4, unit: "folds", comparison: "AT_LEAST", denominator: "validation expectancyR > 0 in six validation folds" },
  maximumCatastrophicFolds: { value: 0, unit: "folds", comparison: "AT_MOST", denominator: "existing catastrophic-fold definition: expectancy <= -0.10, NORMAL PF < 0.80, NO_TRADES, or sample < 30" },
  minimumDrawdownMagnitudeImprovement: { value: 0.2, unit: "fraction", comparison: "AT_LEAST", denominator: "(abs(CONTROL maxDD) - abs(candidate maxDD)) / abs(CONTROL maxDD)" },
  maximumSymbolConcentration: { value: 0.5, unit: "fraction", comparison: "AT_MOST", denominator: "top symbol share of positive validation netR" },
  maximumSinglePositiveTradeContribution: { value: 0.1, unit: "fraction", comparison: "AT_MOST", denominator: "largest positive validation trade share" },
  evidenceIntegrity: { value: 1, unit: "boolean", comparison: "EQUAL", denominator: "evidence and dataset integrity COMPLETE" },
});

export const R12_DEFINITIONS = deepFreeze({
  researchRoundId: M3_R12_RESEARCH_ROUND_ID,
  protocolVersion: M3_R12_PROTOCOL_VERSION,
  hardGateIdentities: R12_HARD_GATE_IDENTITIES,
  selectionGates: R12_SELECTION_GATES,
  foldImprovementDeltaR: 0.02,
  validationFoldCount: 6,
  catastrophicFold: { expectancyRAtMost: -0.1, normalProfitFactorBelow: 0.8, noTradesIsCatastrophic: true, insufficientFoldSampleIsCatastrophic: true },
  noBestAvailablePromotion: true,
  cohortBinsAreDescriptiveOnly: true,
  thesis: R12_THESIS_CONTRACT,
  candidateRegistry: R12_CANDIDATE_REGISTRY,
  complexityTuples: R12_COMPLEXITY_TUPLES,
  selectionAlgorithm: {
    version: "m3-r12-selection-algorithm-001",
    stages: ["ELIGIBILITY", "AGGREGATE_EXPECTANCY", "INCLUSIVE_0_01_TIE_BAND", "LOWER_DD_MAGNITUDE", "PROFIT_FACTOR", "FEWER_FORMAL_SIGNALS", "CANDIDATE_ID"],
    expectancyTieBandThresholdR: 0.01,
    expectancyTieBandBoundary: "INCLUSIVE",
    expectancyTieBandFloatingComparison: "SCALE_AWARE_NUMBER_EPSILON",
    expectancyTieBandFloatingToleranceFormula: "tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold))",
    expectancyTieBandRule: "difference = maxExpectancy - candidateExpectancy; inside iff difference - threshold <= tolerance",
  },
  noEarlyEligibilityExit: true,
  allApplicableGatesConjunctive: true,
  noCandidateOutcome: M3_R12_NO_CANDIDATE_OUTCOME,
  performanceLock: M3_R12_PERFORMANCE_LOCK,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R12_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r12-selection-gates-001",
  researchRoundId: M3_R12_RESEARCH_ROUND_ID,
  protocolVersion: M3_R12_PROTOCOL_VERSION,
  freezeSourceSha: M3_R12_BASE_SOURCE_SHA,
  performanceExecutionSourceSha: null,
  performanceLock: M3_R12_PERFORMANCE_LOCK,
  controlId: M3_R12_CONTROL_ID,
  universe: M3_R12_RESEARCH_RANGE,
  symbols: R12_SYMBOLS,
  folds: R12_FROZEN_FOLDS,
  candidateIds: M3_R12_CANDIDATE_IDS,
  candidateRegistry: R12_CANDIDATE_REGISTRY,
  complexityTuples: R12_COMPLEXITY_TUPLES,
  selectionGates: R12_SELECTION_GATES,
  definitions: R12_DEFINITIONS,
  dataContract: R12_DATA_CONTRACT,
  executionContract: R12_EXECUTION_CONTRACT,
  governance: R12_GOVERNANCE,
  baseline002Status: "NOT_FROZEN",
  m3R12Status: "FROZEN_PENDING_ACCEPTANCE",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R12_CANONICAL_JSON = stableStringify(R12_MACHINE_RECORD);
export const R12_SELECTION_GATE_SHA256 = createHash("sha256").update(R12_CANONICAL_JSON, "utf8").digest("hex");

export function validateR12MachineRecord(record: typeof R12_MACHINE_RECORD = R12_MACHINE_RECORD): typeof R12_MACHINE_RECORD {
  if (record.recordVersion !== "m3-r12-selection-gates-001" || record.researchRoundId !== M3_R12_RESEARCH_ROUND_ID || record.protocolVersion !== M3_R12_PROTOCOL_VERSION || record.freezeSourceSha !== M3_R12_BASE_SOURCE_SHA) throw new Error("R12 Gate provenance mismatch.");
  if (record.performanceExecutionSourceSha !== null || record.performanceLock !== M3_R12_PERFORMANCE_LOCK) throw new Error("R12 Gate performance boundary changed.");
  if (stableStringify(record.candidateIds) !== stableStringify(M3_R12_CANDIDATE_IDS) || stableStringify(record.candidateRegistry) !== stableStringify(R12_CANDIDATE_REGISTRY)) throw new Error("R12 candidate registry changed.");
  if (stableStringify(record.selectionGates) !== stableStringify(R12_SELECTION_GATES) || stableStringify(record.definitions) !== stableStringify(R12_DEFINITIONS)) throw new Error("R12 gate definitions changed.");
  if (record.baseline002Status !== "NOT_FROZEN" || record.m3JStatus !== "BLOCKED" || record.m4Status !== "NOT_STARTED") throw new Error("R12 milestone boundary changed.");
  const hash = createHash("sha256").update(stableStringify(record), "utf8").digest("hex");
  if (hash !== R12_SELECTION_GATE_SHA256) throw new Error("R12 Gate canonical SHA mismatch.");
  return record;
}

export type R12CandidateGateInput = Readonly<{
  candidateId: R12CandidateId;
  resultStatus: "COMPLETE" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED";
  aggregateExecutedTrades: number | null;
  minimumValidationFoldExecutedTrades: number | null;
  netExpectancyR: number | null;
  profitFactor: number | null;
  aggregateImprovement: number | null;
  improvedValidationFolds: number | null;
  positiveValidationFolds: number | null;
  catastrophicFolds: number | null;
  drawdownMagnitudeImprovement: number | null;
  topSymbolShareOfPositiveNetR: number | null;
  largestSinglePositiveTradeShare: number | null;
  evidenceComplete: boolean;
}>;

export type R12GateResult = Readonly<{
  gateId: R12GateId;
  status: "PASS" | "FAIL" | "INCOMPLETE";
  actualValue: number | boolean | null;
  threshold: number;
}>;

export type R12CandidateGateEvaluation = Readonly<{
  candidateId: R12CandidateId;
  gateResults: readonly R12GateResult[];
  applicableGateCount: number;
  passedApplicableGateCount: number;
  failedGateIds: readonly string[];
  eligibility: "ELIGIBLE" | "INELIGIBLE" | "INCOMPLETE";
}>;

function passes(gate: R12GateDefinition, actual: number | boolean | null): boolean {
  if (gate.comparison === "EQUAL") return actual === true;
  if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
  return gate.comparison === "AT_LEAST" ? actual >= gate.value : actual <= gate.value;
}

export function evaluateR12CandidateGates(input: R12CandidateGateInput): R12CandidateGateEvaluation {
  const actual: Record<R12GateId, number | boolean | null> = {
    minimumAggregateExecutedTrades: input.aggregateExecutedTrades,
    minimumValidationFoldExecutedTrades: input.minimumValidationFoldExecutedTrades,
    minimumNetExpectancy: input.netExpectancyR,
    minimumProfitFactor: input.profitFactor,
    minimumAggregateImprovement: input.aggregateImprovement,
    minimumImprovedValidationFolds: input.improvedValidationFolds,
    minimumPositiveValidationFolds: input.positiveValidationFolds,
    maximumCatastrophicFolds: input.catastrophicFolds,
    minimumDrawdownMagnitudeImprovement: input.drawdownMagnitudeImprovement,
    maximumSymbolConcentration: input.topSymbolShareOfPositiveNetR,
    maximumSinglePositiveTradeContribution: input.largestSinglePositiveTradeShare,
    evidenceIntegrity: input.evidenceComplete,
  };
  const incomplete = input.resultStatus === "DATA_INCOMPLETE" || !input.evidenceComplete;
  const results = R12_HARD_GATE_IDENTITIES.map((gateId) => Object.freeze({
    gateId,
    status: incomplete ? "INCOMPLETE" : passes(R12_SELECTION_GATES[gateId], actual[gateId]) ? "PASS" : "FAIL",
    actualValue: actual[gateId],
    threshold: R12_SELECTION_GATES[gateId].value,
  } as R12GateResult));
  const passed = results.filter((result) => result.status === "PASS");
  const failed = results.filter((result) => result.status !== "PASS").map((result) => result.gateId);
  return Object.freeze({
    candidateId: input.candidateId,
    gateResults: Object.freeze(results),
    applicableGateCount: results.length,
    passedApplicableGateCount: passed.length,
    failedGateIds: Object.freeze(failed),
    eligibility: incomplete ? "INCOMPLETE" : failed.length === 0 ? "ELIGIBLE" : "INELIGIBLE",
  });
}

export function isWithinInclusiveR12ExpectancyTieBand(maxExpectancy: number, candidateExpectancy: number, threshold = 0.01): boolean {
  const difference = maxExpectancy - candidateExpectancy;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold));
  return difference - threshold <= tolerance;
}

export type R12SelectionCandidate = Readonly<{
  candidateId: R12CandidateId;
  eligible: boolean;
  aggregateValidationExpectancyR: number;
  maxDrawdownR: number | null;
  aggregateValidationProfitFactor: number | null;
  formalSignals: number;
}>;

export type R12SelectionResult = Readonly<{
  selectionAlgorithmApplied: boolean;
  eligibleCandidateIds: readonly R12CandidateId[];
  selectedCandidateId: R12CandidateId | null;
  finalDecision: string;
}>;

export function selectR12Candidate(candidates: readonly R12SelectionCandidate[]): R12SelectionResult {
  const eligible = candidates.filter((candidate) => candidate.eligible).sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  if (eligible.length === 0) return Object.freeze({ selectionAlgorithmApplied: false, eligibleCandidateIds: Object.freeze([]), selectedCandidateId: null, finalDecision: M3_R12_NO_CANDIDATE_OUTCOME });
  const maxExpectancy = Math.max(...eligible.map((candidate) => candidate.aggregateValidationExpectancyR));
  const tied = eligible.filter((candidate) => isWithinInclusiveR12ExpectancyTieBand(maxExpectancy, candidate.aggregateValidationExpectancyR));
  const ordered = [...(tied.length > 0 ? tied : eligible)].sort((left, right) => {
    const expectancy = right.aggregateValidationExpectancyR - left.aggregateValidationExpectancyR;
    if (expectancy !== 0 && !isWithinInclusiveR12ExpectancyTieBand(Math.max(left.aggregateValidationExpectancyR, right.aggregateValidationExpectancyR), Math.min(left.aggregateValidationExpectancyR, right.aggregateValidationExpectancyR))) return expectancy;
    const dd = Math.abs(left.maxDrawdownR ?? Number.POSITIVE_INFINITY) - Math.abs(right.maxDrawdownR ?? Number.POSITIVE_INFINITY);
    return dd || (right.aggregateValidationProfitFactor ?? Number.NEGATIVE_INFINITY) - (left.aggregateValidationProfitFactor ?? Number.NEGATIVE_INFINITY) || left.formalSignals - right.formalSignals || left.candidateId.localeCompare(right.candidateId);
  });
  return Object.freeze({ selectionAlgorithmApplied: true, eligibleCandidateIds: Object.freeze(eligible.map((candidate) => candidate.candidateId)), selectedCandidateId: ordered[0]!.candidateId, finalDecision: "SELECTED_BASELINE_002_CANDIDATE" });
}
