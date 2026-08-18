import {
  BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID,
  BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256,
} from "./selection-gates-round-001.ts";
import {
  M3_H_ROUND_001_REPORT_SCHEMA_VERSION,
  M3_H_RESEARCH_DATA_CLASSIFICATION,
} from "./m3-h-evidence.ts";
import { M3_H_ROUND_001_EXPERIMENTS } from "./m3-h-round-001-plan.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import type { M3HResearchEvidence, M3HVariantEvidence } from "./m3-h-evidence.ts";
import { stableStringify } from "./utils.ts";

export const M3_I_ROUND_001_SELECTION_SCHEMA_VERSION = "m3-i-round-001-selection-001" as const;
export const M3_I_AUTHORITATIVE_MAIN_SHA = "533f1017676739cdfb3a377f167b5fc42251c525" as const;
export const M3_I_EXPECTED_EXECUTION_SOURCE_SHA = "7b3fa166d01fde79dc95ced182c3c515f904a847" as const;
export const M3_I_EXPECTED_CONTROL_REPORT_SHA256 = "0d620013f85bff28de11fc9ca4765d300d29630a0e0e04f9175e9c6b97715020" as const;
export const M3_I_EXPECTED_EXPERIMENT_PLAN_SHA256 = "2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a" as const;
export const M3_I_EXPECTED_STUDY_SERVER_TIME = 1787016706276 as const;

const CONTROL_ID = "CONTROL_BASELINE_001" as const;
const FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;
const REQUIRED_REDUNDANCY_HYPOTHESES = new Set(["H1_SIGNAL_REDUNDANCY", "H4_SIGNAL_DENSITY"]);

type HardGateId =
  | "minimumAggregateImprovement"
  | "minimumImprovedValidationFolds"
  | "catastrophicFoldLimit"
  | "minimumNetExpectancy"
  | "minimumProfitFactor"
  | "maximumSymbolConcentration"
  | "maximumSingleTradeConcentration"
  | "maximumFeeBurdenRatio"
  | "requiredRedundancyImprovement"
  | "minimumFormalSignals"
  | "minimumExecutedTrades";

const HARD_GATE_IDS = BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.hardGateIdentities as readonly HardGateId[];

export type M3IGateStatus = "PASS" | "FAIL" | "NOT_APPLICABLE";
export type M3IGateApplicability = "REQUIRED" | "NOT_APPLICABLE";
export type M3IEligibility = "ELIGIBLE" | "INELIGIBLE" | "INELIGIBLE_INCOMPLETE_EVIDENCE";
export type M3IFinalDecision =
  | "SELECTED_BASELINE_002_CANDIDATE"
  | "NO BASELINE-002 CANDIDATE"
  | "INCOMPLETE_EVIDENCE";

type GateActualValue = number | null | Readonly<Record<string, number>>;

export type M3IGateResult = Readonly<{
  gateId: HardGateId;
  applicability: M3IGateApplicability;
  actualValue: GateActualValue;
  threshold: number;
  comparison: "AT_LEAST" | "AT_MOST";
  status: M3IGateStatus;
}>;

export type M3ICandidateMetrics = Readonly<{
  aggregateImprovement: number | null;
  improvedValidationFolds: number | null;
  catastrophicFoldCount: number | null;
  expectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: "NORMAL" | "NO_TRADES" | "NO_LOSSES" | null;
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
  redundancyRelativeReduction: number | null;
  formalSignals: number | null;
  minimumFoldExecutedTrades: number | null;
}>;

export type M3ICandidateEvaluation = Readonly<{
  experimentId: string;
  variantId: string;
  hypothesisId: string;
  complexity: Readonly<{
    newRules: number;
    newTunableThresholds: number;
    modifiedBaselineRules: number;
    mechanismFamiliesUsed: number;
  }>;
  metrics: M3ICandidateMetrics;
  gateResults: readonly M3IGateResult[];
  applicableGateCount: number;
  passedApplicableGateCount: number;
  failedGateCount: number;
  failedGateIds: readonly HardGateId[];
  eligibility: M3IEligibility;
}>;

export type M3ISelectionEvaluation = Readonly<{
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3ICandidateEvaluation[];
  eligibleCandidateIds: readonly string[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: string | null;
  finalDecision: M3IFinalDecision;
}>;

export type M3ISelectionReport = Readonly<{
  schemaVersion: typeof M3_I_ROUND_001_SELECTION_SCHEMA_VERSION;
  researchRoundId: string;
  sourceMainSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  m3hControlReportSha256: string;
  m3hExecutionSourceSha: string;
  m3hStudyServerTime: number;
  inputEvidencePath: string;
  inputEvidenceSha256: string;
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3ICandidateEvaluation[];
  eligibleCandidateIds: readonly string[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: string | null;
  finalDecision: M3IFinalDecision;
}>;

type Diagnostics = Readonly<{
  formalSignals: number;
  executedTrades: number;
  grossR: number;
  expectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: "NORMAL" | "NO_TRADES" | "NO_LOSSES";
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
  overlappingSignalRate: number | null;
}>;

type FoldEvidence = Readonly<{
  foldId: string;
  foldRole: string;
  range: Readonly<{ startTime: number; endTime: number }>;
  diagnostics: Diagnostics;
}>;

type VariantEvidence = M3HVariantEvidence & Readonly<{
  aggregateValidation: Readonly<{ diagnostics: Diagnostics }>;
  folds: readonly FoldEvidence[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function compareStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareNumbersDescending(left: number, right: number): number {
  return left === right ? 0 : left > right ? -1 : 1;
}

function metricDiagnostics(variant: VariantEvidence): Diagnostics {
  return variant.aggregateValidation.diagnostics;
}

function foldDiagnostics(variant: VariantEvidence): readonly FoldEvidence[] {
  return variant.folds;
}

function validateDiagnostics(value: unknown, path: string, errors: string[]): value is Diagnostics {
  if (!isRecord(value)) {
    errors.push(`${path} is missing.`);
    return false;
  }
  const required = [
    "formalSignals",
    "executedTrades",
    "grossR",
    "expectancyR",
    "profitFactor",
    "profitFactorStatus",
    "topSymbolShareOfPositiveNetR",
    "largestSingleTradeShareOfPositiveNetR",
    "feeBurdenRatio",
    "overlappingSignalRate",
  ];
  for (const key of required) {
    if (!(key in value)) errors.push(`${path}.${key} is missing.`);
  }
  for (const key of ["formalSignals", "executedTrades"] as const) {
    const metric = value[key];
    if (typeof metric !== "number" || !Number.isSafeInteger(metric) || metric < 0) errors.push(`${path}.${key} is invalid.`);
  }
  if (!isFiniteNumber(value.grossR)) {
    errors.push(`${path}.grossR is invalid.`);
  }
  for (const key of [
    "expectancyR",
    "profitFactor",
    "topSymbolShareOfPositiveNetR",
    "largestSingleTradeShareOfPositiveNetR",
    "feeBurdenRatio",
    "overlappingSignalRate",
  ] as const) {
    if (value[key] !== null && !isFiniteNumber(value[key])) errors.push(`${path}.${key} is invalid.`);
  }
  if (value.profitFactorStatus !== "NORMAL" && value.profitFactorStatus !== "NO_TRADES" && value.profitFactorStatus !== "NO_LOSSES") {
    errors.push(`${path}.profitFactorStatus is invalid.`);
  } else if (value.profitFactorStatus === "NORMAL" && !isFiniteNumber(value.profitFactor)) {
    errors.push(`${path}.profitFactor must be finite for NORMAL.`);
  } else if (value.profitFactorStatus !== "NORMAL" && value.profitFactor !== null) {
    errors.push(`${path}.profitFactor must be null for non-NORMAL status.`);
  }
  return true;
}

function validateFold(variant: VariantEvidence, fold: unknown, index: number, errors: string[]): fold is FoldEvidence {
  if (!isRecord(fold)) {
    errors.push(`${variant.variantId}.folds[${index}] is missing.`);
    return false;
  }
  const expectedFoldId = FOLD_IDS[index];
  if (fold.foldId !== expectedFoldId) errors.push(`${variant.variantId} fold order is invalid at index ${index}.`);
  if (fold.foldRole !== "VALIDATION") errors.push(`${variant.variantId}.${String(fold.foldId)} is not VALIDATION.`);
  const expectedRange = getResearchFoldRoleRange(expectedFoldId, "VALIDATION");
  if (!isRecord(fold.range) || fold.range.startTime !== expectedRange.startTime || fold.range.endTime !== expectedRange.endTime) {
    errors.push(`${variant.variantId}.${expectedFoldId} range is not the frozen validation range.`);
  }
  validateDiagnostics(fold.diagnostics, `${variant.variantId}.${expectedFoldId}.diagnostics`, errors);
  return true;
}

function validateVariant(variant: unknown, label: string, errors: string[]): variant is VariantEvidence {
  if (!isRecord(variant)) {
    errors.push(`${label} is missing.`);
    return false;
  }
  if (typeof variant.experimentId !== "string" || typeof variant.variantId !== "string" || typeof variant.hypothesisId !== "string") {
    errors.push(`${label} identity is invalid.`);
  }
  if (!isRecord(variant.complexity)) {
    errors.push(`${label}.complexity is missing.`);
  } else {
    for (const key of ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"] as const) {
      const metric = variant.complexity[key];
      if (typeof metric !== "number" || !Number.isSafeInteger(metric) || metric < 0) errors.push(`${label}.complexity.${key} is invalid.`);
    }
  }
  if (!isRecord(variant.aggregateValidation)) {
    errors.push(`${label}.aggregateValidation is missing.`);
  } else {
    validateDiagnostics(variant.aggregateValidation.diagnostics, `${label}.aggregateValidation.diagnostics`, errors);
  }
  if (!Array.isArray(variant.folds) || variant.folds.length !== FOLD_IDS.length) {
    errors.push(`${label}.folds must contain exactly F1-F6.`);
  } else {
    variant.folds.forEach((fold, index) => validateFold(variant as VariantEvidence, fold, index, errors));
  }
  if (typeof variant.formalIdentitySha256 !== "string" || variant.formalIdentitySha256.length === 0) errors.push(`${label}.formalIdentitySha256 is missing.`);
  if (typeof variant.executedIdentitySha256 !== "string" || variant.executedIdentitySha256.length === 0) errors.push(`${label}.executedIdentitySha256 is missing.`);
  return true;
}

function validateIntegrity(evidence: unknown): { status: "COMPLETE" | "INCOMPLETE_EVIDENCE"; errors: readonly string[] } {
  const errors: string[] = [];
  if (!isRecord(evidence)) return { status: "INCOMPLETE_EVIDENCE", errors: ["M3-H evidence is not an object."] };
  if (evidence.schemaVersion !== M3_H_ROUND_001_REPORT_SCHEMA_VERSION) errors.push("schemaVersion mismatch.");
  if (evidence.researchRoundId !== BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID) errors.push("researchRoundId mismatch.");
  if (evidence.evidenceStatus !== "COMPLETE") errors.push("evidenceStatus is not COMPLETE.");
  if (evidence.dataClassification !== M3_H_RESEARCH_DATA_CLASSIFICATION) errors.push("dataClassification mismatch.");
  if (evidence.selectionGateSha256 !== BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256) errors.push("selectionGateSha256 mismatch.");
  if (evidence.experimentPlanSha256 !== M3_I_EXPECTED_EXPERIMENT_PLAN_SHA256) errors.push("experimentPlanSha256 mismatch.");
  if (evidence.executionSourceSha !== M3_I_EXPECTED_EXECUTION_SOURCE_SHA) errors.push("executionSourceSha mismatch.");
  if (evidence.controlReportSha256 !== M3_I_EXPECTED_CONTROL_REPORT_SHA256) errors.push("controlReportSha256 mismatch.");
  if (evidence.strategyVersion !== "baseline-001") errors.push("strategyVersion mismatch.");
  if (evidence.backtestPolicyVersion !== "bt-policy-003") errors.push("backtestPolicyVersion mismatch.");
  if (evidence.controlReportSchemaVersion !== "m3-b-report-004") errors.push("controlReportSchemaVersion mismatch.");
  if (!isSafeTimestamp(evidence.studyServerTime) || evidence.studyServerTime !== M3_I_EXPECTED_STUDY_SERVER_TIME) errors.push("studyServerTime mismatch or invalid.");

  const expectedIds = M3_H_ROUND_001_EXPERIMENTS.map((experiment) => experiment.experimentId);
  const candidates = evidence.candidates;
  if (!Array.isArray(candidates) || candidates.length !== expectedIds.length) {
    errors.push("candidate count must be exactly 13.");
  } else {
    const candidateIds = candidates.map((candidate) => isRecord(candidate) ? candidate.variantId : null);
    if (candidateIds.some((id) => typeof id !== "string") || new Set(candidateIds).size !== expectedIds.length) {
      errors.push("candidate IDs must be unique strings.");
    }
    if (candidateIds.join("|") !== expectedIds.join("|")) errors.push("candidate IDs do not match the frozen 13-candidate order.");
    candidates.forEach((candidate, index) => {
      const expected = M3_H_ROUND_001_EXPERIMENTS[index];
      if (isRecord(candidate)) {
        if (candidate.experimentId !== expected.experimentId || candidate.variantId !== expected.variantId) errors.push(`${expected.experimentId} identity mismatch.`);
        if (candidate.hypothesisId !== expected.hypothesisId) errors.push(`${expected.experimentId} hypothesis mismatch.`);
        if (isRecord(candidate.complexity) && stableStringify(candidate.complexity) !== stableStringify(expected.complexity)) errors.push(`${expected.experimentId} complexity mismatch.`);
      }
      validateVariant(candidate, `candidate ${expected.experimentId}`, errors);
    });
  }

  if (!isRecord(evidence.control) || evidence.control.experimentId !== CONTROL_ID || evidence.control.variantId !== CONTROL_ID || evidence.control.hypothesisId !== "CONTROL") {
    errors.push("CONTROL_BASELINE_001 comparator is missing or has been changed.");
  } else {
    validateVariant(evidence.control, "CONTROL_BASELINE_001", errors);
  }

  const identityHashes = [evidence.control, ...(Array.isArray(candidates) ? candidates : [])]
    .map((variant) => isRecord(variant) ? variant.formalIdentitySha256 : null);
  if (identityHashes.some((hash) => typeof hash !== "string" || hash.length === 0) || new Set(identityHashes).size !== identityHashes.length) {
    errors.push("formal identity hashes must be present and unique.");
  }
  return { status: errors.length === 0 ? "COMPLETE" : "INCOMPLETE_EVIDENCE", errors: Object.freeze(errors) };
}

function requiredRedundancy(hypothesisId: string): boolean {
  return REQUIRED_REDUNDANCY_HYPOTHESES.has(hypothesisId);
}

function improvedFoldCount(candidate: VariantEvidence, control: VariantEvidence, sampleFloor: number, deltaFloor: number): number {
  return FOLD_IDS.reduce((count, foldId, index) => {
    const candidateFold = candidate.folds[index].diagnostics;
    const controlFold = control.folds[index].diagnostics;
    const delta = candidateFold.expectancyR === null || controlFold.expectancyR === null
      ? null
      : candidateFold.expectancyR - controlFold.expectancyR;
    return candidateFold.executedTrades >= sampleFloor && controlFold.executedTrades >= sampleFloor && delta !== null && delta >= deltaFloor
      ? count + 1
      : count;
  }, 0);
}

function catastrophicFoldCount(candidate: VariantEvidence, definitions: typeof BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS, sampleFloor: number): number {
  const catastrophic = definitions.catastrophicFold;
  return candidate.folds.filter((fold) => {
    const diagnostics = fold.diagnostics;
    return (
      (diagnostics.expectancyR !== null && diagnostics.expectancyR <= catastrophic.expectancyRAtMost) ||
      (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < catastrophic.normalProfitFactorBelow) ||
      diagnostics.profitFactorStatus === "NO_TRADES" ||
      diagnostics.executedTrades < sampleFloor
    );
  }).length;
}

function aggregateImprovement(candidate: VariantEvidence, control: VariantEvidence): number | null {
  const candidateExpectancy = candidate.aggregateValidation.diagnostics.expectancyR;
  const controlExpectancy = control.aggregateValidation.diagnostics.expectancyR;
  return candidateExpectancy === null || controlExpectancy === null ? null : candidateExpectancy - controlExpectancy;
}

function redundancyReduction(candidate: VariantEvidence, control: VariantEvidence, required: boolean): number | null {
  if (!required) return null;
  const controlRate = control.aggregateValidation.diagnostics.overlappingSignalRate;
  const candidateRate = candidate.aggregateValidation.diagnostics.overlappingSignalRate;
  return controlRate === null || candidateRate === null || controlRate === 0 ? null : (controlRate - candidateRate) / controlRate;
}

function gateResult(
  gateId: HardGateId,
  actualValue: GateActualValue,
  status: M3IGateStatus,
  applicability: M3IGateApplicability,
  machineRecord: typeof BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD,
): M3IGateResult {
  const gate = machineRecord.selectionGates[gateId];
  if (gate.comparison === "EQUAL") throw new Error(`${gateId} cannot use EQUAL comparison.`);
  return Object.freeze({
    gateId,
    applicability,
    actualValue,
    threshold: gate.value,
    comparison: gate.comparison,
    status,
  });
}

function passesAtLeast(actual: number | null, threshold: number): boolean {
  return actual !== null && isFiniteNumber(actual) && actual >= threshold;
}

function passesAtMost(actual: number | null, threshold: number): boolean {
  return actual !== null && isFiniteNumber(actual) && actual <= threshold;
}

function evaluateCandidate(
  candidate: VariantEvidence,
  control: VariantEvidence,
  machineRecord: typeof BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD,
): M3ICandidateEvaluation {
  const gates = machineRecord.selectionGates;
  const definitions = machineRecord.definitions;
  const candidateDiagnostics = metricDiagnostics(candidate);
  const aggregateDelta = aggregateImprovement(candidate, control);
  const improved = improvedFoldCount(candidate, control, gates.minimumExecutedTrades.value, definitions.foldImprovementDeltaR);
  const catastrophic = catastrophicFoldCount(candidate, definitions, gates.minimumExecutedTrades.value);
  const redundancy = redundancyReduction(candidate, control, requiredRedundancy(candidate.hypothesisId));
  const minimumFoldTrades = Math.min(...foldDiagnostics(candidate).map((fold) => fold.diagnostics.executedTrades));
  const sampleGatesPass = (
    passesAtLeast(candidateDiagnostics.formalSignals, gates.minimumFormalSignals.value) &&
    passesAtLeast(minimumFoldTrades, gates.minimumExecutedTrades.value)
  );
  const foldTradeActual = Object.freeze(Object.fromEntries(
    candidate.folds.map((fold) => [fold.foldId, fold.diagnostics.executedTrades]),
  )) as Readonly<Record<string, number>>;

  const gateResults: M3IGateResult[] = [
    gateResult("minimumAggregateImprovement", aggregateDelta, passesAtLeast(aggregateDelta, gates.minimumAggregateImprovement.value) ? "PASS" : "FAIL", "REQUIRED", machineRecord),
    gateResult("minimumImprovedValidationFolds", improved, passesAtLeast(improved, gates.minimumImprovedValidationFolds.value) ? "PASS" : "FAIL", "REQUIRED", machineRecord),
    gateResult("catastrophicFoldLimit", catastrophic, passesAtMost(catastrophic, gates.catastrophicFoldLimit.value) ? "PASS" : "FAIL", "REQUIRED", machineRecord),
    gateResult("minimumNetExpectancy", candidateDiagnostics.expectancyR, passesAtLeast(candidateDiagnostics.expectancyR, gates.minimumNetExpectancy.value) ? "PASS" : "FAIL", "REQUIRED", machineRecord),
    gateResult(
      "minimumProfitFactor",
      candidateDiagnostics.profitFactor,
      candidateDiagnostics.profitFactorStatus === "NORMAL"
        ? passesAtLeast(candidateDiagnostics.profitFactor, gates.minimumProfitFactor.value) ? "PASS" : "FAIL"
        : candidateDiagnostics.profitFactorStatus === "NO_LOSSES" && sampleGatesPass ? "PASS" : "FAIL",
      "REQUIRED",
      machineRecord,
    ),
    gateResult("maximumSymbolConcentration", candidateDiagnostics.topSymbolShareOfPositiveNetR, passesAtMost(candidateDiagnostics.topSymbolShareOfPositiveNetR, gates.maximumSymbolConcentration.value) ? "PASS" : "FAIL", "REQUIRED", machineRecord),
    gateResult("maximumSingleTradeConcentration", candidateDiagnostics.largestSingleTradeShareOfPositiveNetR, passesAtMost(candidateDiagnostics.largestSingleTradeShareOfPositiveNetR, gates.maximumSingleTradeConcentration.value) ? "PASS" : "FAIL", "REQUIRED", machineRecord),
    gateResult(
      "maximumFeeBurdenRatio",
      candidateDiagnostics.feeBurdenRatio,
      candidateDiagnostics.grossR !== 0 && passesAtMost(candidateDiagnostics.feeBurdenRatio, gates.maximumFeeBurdenRatio.value) ? "PASS" : "FAIL",
      "REQUIRED",
      machineRecord,
    ),
    gateResult(
      "requiredRedundancyImprovement",
      redundancy,
      requiredRedundancy(candidate.hypothesisId)
        ? passesAtLeast(redundancy, gates.requiredRedundancyImprovement.value) ? "PASS" : "FAIL"
        : "NOT_APPLICABLE",
      requiredRedundancy(candidate.hypothesisId) ? "REQUIRED" : "NOT_APPLICABLE",
      machineRecord,
    ),
    gateResult("minimumFormalSignals", candidateDiagnostics.formalSignals, passesAtLeast(candidateDiagnostics.formalSignals, gates.minimumFormalSignals.value) ? "PASS" : "FAIL", "REQUIRED", machineRecord),
    gateResult("minimumExecutedTrades", foldTradeActual, passesAtLeast(gateResultsMinimum(foldTradeActual), gates.minimumExecutedTrades.value) ? "PASS" : "FAIL", "REQUIRED", machineRecord),
  ];
  const applicableGateCount = gateResults.filter((gate) => gate.applicability === "REQUIRED").length;
  const passedApplicableGateCount = gateResults.filter((gate) => gate.applicability === "REQUIRED" && gate.status === "PASS").length;
  const failedGateIds = gateResults.filter((gate) => gate.status === "FAIL").map((gate) => gate.gateId);
  const failedGateCount = failedGateIds.length;
  return Object.freeze({
    experimentId: candidate.experimentId,
    variantId: candidate.variantId,
    hypothesisId: candidate.hypothesisId,
    complexity: candidate.complexity,
    metrics: Object.freeze({
      aggregateImprovement: aggregateDelta,
      improvedValidationFolds: improved,
      catastrophicFoldCount: catastrophic,
      expectancyR: candidateDiagnostics.expectancyR,
      profitFactor: candidateDiagnostics.profitFactor,
      profitFactorStatus: candidateDiagnostics.profitFactorStatus,
      topSymbolShareOfPositiveNetR: candidateDiagnostics.topSymbolShareOfPositiveNetR,
      largestSingleTradeShareOfPositiveNetR: candidateDiagnostics.largestSingleTradeShareOfPositiveNetR,
      feeBurdenRatio: candidateDiagnostics.feeBurdenRatio,
      redundancyRelativeReduction: redundancy,
      formalSignals: candidateDiagnostics.formalSignals,
      minimumFoldExecutedTrades: minimumFoldTrades,
    }),
    gateResults: Object.freeze(gateResults),
    applicableGateCount,
    passedApplicableGateCount,
    failedGateCount,
    failedGateIds: Object.freeze(failedGateIds),
    eligibility: failedGateCount === 0 ? "ELIGIBLE" : "INELIGIBLE",
  });
}

function gateResultsMinimum(values: Readonly<Record<string, number>>): number {
  return Math.min(...Object.values(values));
}

function complexityTuple(candidate: M3ICandidateEvaluation): readonly number[] {
  return [
    candidate.complexity.newRules,
    candidate.complexity.newTunableThresholds,
    candidate.complexity.modifiedBaselineRules,
    candidate.complexity.mechanismFamiliesUsed,
  ];
}

function compareComplexity(left: M3ICandidateEvaluation, right: M3ICandidateEvaluation): number {
  const leftTuple = complexityTuple(left);
  const rightTuple = complexityTuple(right);
  for (let index = 0; index < leftTuple.length; index += 1) {
    if (leftTuple[index] !== rightTuple[index]) return leftTuple[index] < rightTuple[index] ? -1 : 1;
  }
  return 0;
}

function compareEligibleCandidates(left: M3ICandidateEvaluation, right: M3ICandidateEvaluation, tieThreshold: number): number {
  const improvedDifference = (right.metrics.improvedValidationFolds ?? 0) - (left.metrics.improvedValidationFolds ?? 0);
  if (improvedDifference !== 0) return improvedDifference > 0 ? 1 : -1;
  const leftExpectancy = left.metrics.expectancyR;
  const rightExpectancy = right.metrics.expectancyR;
  if (leftExpectancy !== null && rightExpectancy !== null) {
    const expectancyDifference = rightExpectancy - leftExpectancy;
    if (Math.abs(expectancyDifference) > tieThreshold) return expectancyDifference > 0 ? 1 : -1;
  }
  const complexityDifference = compareComplexity(left, right);
  if (complexityDifference !== 0) return complexityDifference;
  const leftPf = left.metrics.profitFactor;
  const rightPf = right.metrics.profitFactor;
  if (leftPf === null && rightPf !== null) return 1;
  if (leftPf !== null && rightPf === null) return -1;
  if (leftPf !== null && rightPf !== null) {
    const pfDifference = compareNumbersDescending(leftPf, rightPf);
    if (pfDifference !== 0) return pfDifference;
  }
  return compareStrings(left.experimentId, right.experimentId);
}

function incompleteEvaluation(errors: readonly string[]): M3ISelectionEvaluation {
  return Object.freeze({
    integrityStatus: "INCOMPLETE_EVIDENCE",
    integrityErrors: Object.freeze([...errors]),
    candidates: Object.freeze([]),
    eligibleCandidateIds: Object.freeze([]),
    selectionAlgorithmApplied: false,
    selectedCandidateId: null,
    finalDecision: "INCOMPLETE_EVIDENCE",
  });
}

export function evaluateM3ISelection(evidence: unknown): M3ISelectionEvaluation {
  const integrity = validateIntegrity(evidence);
  if (integrity.status !== "COMPLETE") return incompleteEvaluation(integrity.errors);
  const typedEvidence = evidence as M3HResearchEvidence;
  const typedControl = typedEvidence.control as VariantEvidence;
  const candidates = typedEvidence.candidates.map((candidate) => evaluateCandidate(candidate as VariantEvidence, typedControl, BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD));
  const eligible = candidates.filter((candidate) => candidate.eligibility === "ELIGIBLE");
  const eligibleCandidateIds = eligible.map((candidate) => candidate.experimentId);
  if (eligible.length === 0) {
    return Object.freeze({
      integrityStatus: "COMPLETE",
      integrityErrors: Object.freeze([]),
      candidates: Object.freeze(candidates),
      eligibleCandidateIds: Object.freeze([]),
      selectionAlgorithmApplied: false,
      selectedCandidateId: null,
      finalDecision: "NO BASELINE-002 CANDIDATE",
    });
  }
  const sorted = [...eligible].sort((left, right) => compareEligibleCandidates(left, right, BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD.selectionGates.complexityTieThreshold.value));
  return Object.freeze({
    integrityStatus: "COMPLETE",
    integrityErrors: Object.freeze([]),
    candidates: Object.freeze(candidates),
    eligibleCandidateIds: Object.freeze(eligibleCandidateIds),
    selectionAlgorithmApplied: true,
    selectedCandidateId: sorted[0].experimentId,
    finalDecision: "SELECTED_BASELINE_002_CANDIDATE",
  });
}

export function createM3ISelectionReport(input: Readonly<{
  evidence: M3HResearchEvidence;
  inputEvidencePath: string;
  inputEvidenceSha256: string;
  evaluation?: M3ISelectionEvaluation;
  sourceMainSha?: string;
}>): M3ISelectionReport {
  const evaluation = input.evaluation ?? evaluateM3ISelection(input.evidence);
  return Object.freeze({
    schemaVersion: M3_I_ROUND_001_SELECTION_SCHEMA_VERSION,
    researchRoundId: input.evidence.researchRoundId,
    sourceMainSha: input.sourceMainSha ?? M3_I_AUTHORITATIVE_MAIN_SHA,
    selectionGateSha256: input.evidence.selectionGateSha256,
    experimentPlanSha256: input.evidence.experimentPlanSha256,
    m3hControlReportSha256: input.evidence.controlReportSha256,
    m3hExecutionSourceSha: input.evidence.executionSourceSha,
    m3hStudyServerTime: input.evidence.studyServerTime,
    inputEvidencePath: input.inputEvidencePath,
    inputEvidenceSha256: input.inputEvidenceSha256,
    integrityStatus: evaluation.integrityStatus,
    integrityErrors: evaluation.integrityErrors,
    candidates: evaluation.candidates,
    eligibleCandidateIds: evaluation.eligibleCandidateIds,
    selectionAlgorithmApplied: evaluation.selectionAlgorithmApplied,
    selectedCandidateId: evaluation.selectedCandidateId,
    finalDecision: evaluation.finalDecision,
  });
}

function display(value: number | null): string {
  return value === null ? "null" : String(value);
}

function displayProfitFactor(metrics: M3ICandidateMetrics): string {
  return metrics.profitFactorStatus === null ? "null" : `${metrics.profitFactorStatus}${metrics.profitFactor === null ? "" : ` (${metrics.profitFactor})`}`;
}

export function renderM3ISelectionMarkdown(report: M3ISelectionReport): string {
  const lines = [
    "# M3-I Round-001 Mechanical Candidate Gate Application",
    "",
    `integrityStatus: ${report.integrityStatus}`,
    `finalDecision: ${report.finalDecision}`,
    `researchRoundId: ${report.researchRoundId}`,
    `sourceMainSha: ${report.sourceMainSha}`,
    `selectionGateSha256: ${report.selectionGateSha256}`,
    `experimentPlanSha256: ${report.experimentPlanSha256}`,
    `m3hControlReportSha256: ${report.m3hControlReportSha256}`,
    `m3hExecutionSourceSha: ${report.m3hExecutionSourceSha}`,
    `m3hStudyServerTime: ${report.m3hStudyServerTime}`,
    `inputEvidenceSha256: ${report.inputEvidenceSha256}`,
    `selectionAlgorithmApplied: ${report.selectionAlgorithmApplied}`,
    `selectedCandidateId: ${report.selectedCandidateId ?? "null"}`,
    `eligibleCandidateIds: ${report.eligibleCandidateIds.length === 0 ? "none" : report.eligibleCandidateIds.join(", ")}`,
    "",
  ];
  if (report.integrityErrors.length > 0) {
    lines.push("## Integrity errors", "", ...report.integrityErrors.map((error) => `- ${error}`), "");
  }
  lines.push(
    "## Candidate gate matrix",
    "",
    "| candidate | aggregate improvement | improved folds | catastrophic folds | expectancy | PF | symbol concentration | single-trade concentration | fee burden | redundancy | formal signals | minimum fold trades | eligibility | failed gates |",
    "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  );
  for (const candidate of report.candidates) {
    const metrics = candidate.metrics;
    lines.push(`| ${candidate.variantId} | ${display(metrics.aggregateImprovement)} | ${display(metrics.improvedValidationFolds)} | ${display(metrics.catastrophicFoldCount)} | ${display(metrics.expectancyR)} | ${displayProfitFactor(metrics)} | ${display(metrics.topSymbolShareOfPositiveNetR)} | ${display(metrics.largestSingleTradeShareOfPositiveNetR)} | ${display(metrics.feeBurdenRatio)} | ${display(metrics.redundancyRelativeReduction)} | ${display(metrics.formalSignals)} | ${display(metrics.minimumFoldExecutedTrades)} | ${candidate.eligibility} | ${candidate.failedGateIds.length === 0 ? "none" : candidate.failedGateIds.join(", ")} |`);
  }
  lines.push("", "## Gate details", "");
  for (const candidate of report.candidates) {
    lines.push(`### ${candidate.variantId}`, "", ...candidate.gateResults.map((gate) => `- ${gate.gateId}: ${gate.status} (${gate.applicability}; actual=${JSON.stringify(gate.actualValue)}; threshold=${gate.threshold} ${gate.comparison})`), "");
  }
  return `${lines.join("\n")}\n`;
}

export function serializeM3ISelectionReport(report: M3ISelectionReport): string {
  return `${stableStringify(report)}\n`;
}

export { HARD_GATE_IDS };
