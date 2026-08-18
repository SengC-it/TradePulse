import { createHash } from "node:crypto";

import { getResearchFoldRoleRange } from "./folds.ts";
import {
  M3_R2_ROUND_002_CONTROL_ID,
} from "./m3-r2-round-002-plan.ts";
import {
  BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
  M3_R3_ROUND_003_CANDIDATE_IDS,
  M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME,
  M3_R3_ROUND_003_RESEARCH_ROUND_ID,
  validateM3R3Round003MachineRecord,
} from "./selection-gates-round-003.ts";
import {
  M3_R3_ROUND_003_PLAN,
  M3_R3_ROUND_003_PLAN_SHA256,
  validateM3R3Round003Plan,
} from "./m3-r3-round-003-plan.ts";
import { stableStringify } from "./utils.ts";

export const M3_R3_C_SELECTION_SCHEMA_VERSION = "m3-r3-c-selection-001" as const;
export const M3_R3_C_SOURCE_MAIN_SHA = "4172c77398ee18d9e109396415cc9970fa1800ae" as const;
export const M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256 =
  "6b86ef4ef8bb9bbf8c0047b57d4322fc61f843cad6c9fdd55ab513e00b6d8d69" as const;
export const M3_R3_C_EXPECTED_RECOVERY_MAIN_BASE_SHA =
  "1399ef6921b2930fb51d49c1b8c29260f1087678" as const;
export const M3_R3_C_EXPECTED_EXECUTION_SOURCE_SHA =
  "d2325b195564bfe74654bd64d501a388f8999c87" as const;
export const M3_R3_C_EXPECTED_SCHEMA_VERSION = "m3-r3-round-003-report-001" as const;
export const M3_R3_C_EXPECTED_STRATEGY_VERSION = "baseline-001" as const;
export const M3_R3_C_EXPECTED_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R3_C_EXPECTED_CONTROL_SCHEMA_VERSION = "m3-b-report-004" as const;
export const M3_R3_C_EXPECTED_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;
export const M3_R3_C_EXPECTED_PERFORMANCE_LOCK = "FIRST_M3_R3_B_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R3_C_EXPECTED_DECISION = "DEFER_TO_M3_R3_C_FROZEN_GATE_APPLICATION" as const;
export const M3_R3_C_BASELINE_002_STATUS = "NOT_FROZEN" as const;
export const M3_R3_C_M3_J_STATUS = "BLOCKED" as const;
export const M3_R3_C_M4_STATUS = "NOT_STARTED" as const;

const FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;
const EXPECTED_SNAPSHOT_COUNT = 7_500;
const EPSILON = 1e-12;

type Complexity = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

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

const HARD_GATE_IDS = BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS.hardGateIdentities as readonly HardGateId[];

export type M3R3CGateStatus = "PASS" | "FAIL" | "NOT_APPLICABLE";
export type M3R3CGateApplicability = "REQUIRED" | "NOT_APPLICABLE";
export type M3R3CEligibility = "ELIGIBLE" | "INELIGIBLE";
export type M3R3CFinalDecision =
  | "SELECTED_BASELINE_002_CANDIDATE"
  | typeof M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME
  | "INCOMPLETE_EVIDENCE";

type GateActualValue = number | null | Readonly<Record<string, number>>;

export type M3R3CDiagnostics = Readonly<{
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

export type M3R3CFoldEvidence = Readonly<{
  foldId: string;
  foldRole: string;
  range: Readonly<{ startTime: number; endTime: number }>;
  diagnostics: M3R3CDiagnostics;
}>;

export type M3R3CVariantEvidence = Readonly<{
  candidateId: string;
  complexity: Complexity;
  aggregateValidation: Readonly<{ diagnostics: M3R3CDiagnostics }>;
  folds: readonly M3R3CFoldEvidence[];
  aggregateExpectancyDeltaVsControl?: number | null;
  foldExpectancyDeltaVsControl?: Readonly<Record<string, number | null>>;
  redundancyApplicability: "NOT_APPLICABLE";
  redundancyRelativeReductionVsControl: null;
  formalIdentitySha256: string;
  executedIdentitySha256: string;
}>;

export type M3R3CResearchEvidence = Readonly<{
  schemaVersion: string;
  researchRoundId: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  recoveryMainBaseSha: string;
  executionSourceSha: string;
  strategyVersion: string;
  backtestPolicyVersion: string;
  controlReportSchemaVersion: string;
  dataClassification: string;
  performanceLock: string;
  performanceLockTriggered: boolean;
  evidenceStatus: string;
  decision: string;
  snapshotCount: number;
  controlExecutedTrades: number;
  controlFormalSignals: number;
  control: M3R3CVariantEvidence;
  candidates: readonly M3R3CVariantEvidence[];
}>;

export type M3R3CGateResult = Readonly<{
  gateId: HardGateId;
  applicability: M3R3CGateApplicability;
  actualValue: GateActualValue;
  threshold: number;
  comparison: "AT_LEAST" | "AT_MOST";
  status: M3R3CGateStatus;
}>;

export type M3R3CCandidateMetrics = Readonly<{
  aggregateImprovement: number | null;
  improvedValidationFoldCount: number | null;
  catastrophicFoldCount: number | null;
  expectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: "NORMAL" | "NO_TRADES" | "NO_LOSSES" | null;
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
  redundancyRelativeReductionVsControl: number | null;
  formalSignals: number | null;
  minimumFoldExecutedTrades: number | null;
}>;

export type M3R3CCandidateEvaluation = Readonly<{
  candidateId: string;
  complexity: Complexity;
  metrics: M3R3CCandidateMetrics;
  gateResults: readonly M3R3CGateResult[];
  applicableGateCount: number;
  passedApplicableGateCount: number;
  failedGateCount: number;
  failedGateIds: readonly HardGateId[];
  eligibility: M3R3CEligibility;
}>;

export type M3R3CSelectionEvaluation = Readonly<{
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3R3CCandidateEvaluation[];
  eligibleCandidateIds: readonly string[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: string | null;
  finalDecision: M3R3CFinalDecision;
}>;

export type M3R3CSelectionReport = Readonly<{
  schemaVersion: typeof M3_R3_C_SELECTION_SCHEMA_VERSION;
  researchRoundId: typeof M3_R3_ROUND_003_RESEARCH_ROUND_ID;
  sourceMainSha: typeof M3_R3_C_SOURCE_MAIN_SHA;
  executionSourceSha: string;
  selectionGateSha256: typeof BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R3_ROUND_003_PLAN_SHA256;
  inputEvidencePath: string;
  inputEvidenceSha256: typeof M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256;
  performanceEvidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3R3CCandidateEvaluation[];
  eligibleCandidateIds: readonly string[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: string | null;
  finalDecision: M3R3CFinalDecision;
  baseline002Status: typeof M3_R3_C_BASELINE_002_STATUS;
  m3JStatus: typeof M3_R3_C_M3_J_STATUS;
  m4Status: typeof M3_R3_C_M4_STATUS;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function isSha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function equalWithin(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON;
}

function compareStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareNumbersDescending(left: number, right: number): number {
  return left === right ? 0 : left > right ? -1 : 1;
}

function validateDiagnostics(value: unknown, path: string, errors: string[]): value is M3R3CDiagnostics {
  if (!isRecord(value)) {
    errors.push(`${path} is missing.`);
    return false;
  }
  const requiredKeys = [
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
  for (const key of requiredKeys) if (!(key in value)) errors.push(`${path}.${key} is missing.`);
  for (const key of ["formalSignals", "executedTrades"] as const) {
    if (!isSafeNonNegativeInteger(value[key])) errors.push(`${path}.${key} is invalid.`);
  }
  if (!isFiniteNumber(value.grossR)) errors.push(`${path}.grossR is invalid.`);
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

function validateFold(value: unknown, expectedFoldId: string, path: string, errors: string[]): value is M3R3CFoldEvidence {
  if (!isRecord(value)) {
    errors.push(`${path} is missing.`);
    return false;
  }
  if (value.foldId !== expectedFoldId) errors.push(`${path}.foldId is not ${expectedFoldId}.`);
  if (value.foldRole !== "VALIDATION") errors.push(`${path}.foldRole is not VALIDATION.`);
  const expectedRange = getResearchFoldRoleRange(expectedFoldId as "F1" | "F2" | "F3" | "F4" | "F5" | "F6", "VALIDATION");
  if (!isRecord(value.range) || value.range.startTime !== expectedRange.startTime || value.range.endTime !== expectedRange.endTime) {
    errors.push(`${path}.range is not the frozen validation range.`);
  }
  validateDiagnostics(value.diagnostics, `${path}.diagnostics`, errors);
  return true;
}

function expectedComplexity(candidateId: string): Complexity | undefined {
  const tuples = M3_R3_ROUND_003_PLAN.complexityTuples as Readonly<Record<string, Complexity>>;
  return tuples[candidateId];
}

function validateComplexity(value: unknown, expected: Complexity | undefined, path: string, errors: string[]): value is Complexity {
  if (!isRecord(value) || expected === undefined) {
    errors.push(`${path} is missing or has no frozen tuple.`);
    return false;
  }
  for (const key of ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"] as const) {
    if (!isSafeNonNegativeInteger(value[key]) || value[key] !== expected[key]) errors.push(`${path}.${key} does not match the frozen tuple.`);
  }
  return true;
}

function validateVariant(value: unknown, expectedId: string, label: string, errors: string[]): value is M3R3CVariantEvidence {
  if (!isRecord(value)) {
    errors.push(`${label} is missing.`);
    return false;
  }
  if (value.candidateId !== expectedId) errors.push(`${label}.candidateId mismatch.`);
  const complexityValid = validateComplexity(value.complexity, expectedComplexity(expectedId), `${label}.complexity`, errors);
  let aggregateValid = false;
  if (!isRecord(value.aggregateValidation)) {
    errors.push(`${label}.aggregateValidation is missing.`);
  } else {
    aggregateValid = validateDiagnostics(value.aggregateValidation.diagnostics, `${label}.aggregateValidation.diagnostics`, errors);
  }
  let foldsValid = false;
  if (!Array.isArray(value.folds) || value.folds.length !== FOLD_IDS.length) {
    errors.push(`${label}.folds must contain exactly F1-F6.`);
  } else {
    foldsValid = value.folds.every((fold, index) => validateFold(fold, FOLD_IDS[index], `${label}.folds[${index}]`, errors));
  }
  const redundancyValid = value.redundancyApplicability === "NOT_APPLICABLE" && value.redundancyRelativeReductionVsControl === null;
  if (!redundancyValid) errors.push(`${label} redundancy applicability/provenance is invalid.`);
  const identityValid = isSha256(value.formalIdentitySha256) && isSha256(value.executedIdentitySha256);
  if (!identityValid) errors.push(`${label} identity hash is invalid.`);
  return complexityValid && aggregateValid && foldsValid && redundancyValid && identityValid;
}

function validateConvenienceFields(candidate: M3R3CVariantEvidence, control: M3R3CVariantEvidence, label: string, errors: string[]): void {
  const candidateExpectancy = candidate.aggregateValidation.diagnostics.expectancyR;
  const controlExpectancy = control.aggregateValidation.diagnostics.expectancyR;
  const recomputed = candidateExpectancy === null || controlExpectancy === null ? null : candidateExpectancy - controlExpectancy;
  if (candidate.aggregateExpectancyDeltaVsControl !== undefined) {
    if (candidate.aggregateExpectancyDeltaVsControl === null || recomputed === null || !equalWithin(candidate.aggregateExpectancyDeltaVsControl, recomputed)) {
      errors.push(`${label}.aggregateExpectancyDeltaVsControl does not match recomputed aggregate delta.`);
    }
  }
  if (candidate.foldExpectancyDeltaVsControl !== undefined) {
    if (!isRecord(candidate.foldExpectancyDeltaVsControl)) {
      errors.push(`${label}.foldExpectancyDeltaVsControl is invalid.`);
    } else {
      for (const foldId of FOLD_IDS) {
        const candidateFold = candidate.folds.find((fold) => fold.foldId === foldId)?.diagnostics.expectancyR ?? null;
        const controlFold = control.folds.find((fold) => fold.foldId === foldId)?.diagnostics.expectancyR ?? null;
        const expected = candidateFold === null || controlFold === null ? null : candidateFold - controlFold;
        const actual = candidate.foldExpectancyDeltaVsControl[foldId];
        if (actual === null || !isFiniteNumber(actual) || expected === null || !equalWithin(actual, expected)) {
          errors.push(`${label}.foldExpectancyDeltaVsControl.${foldId} does not match recomputed fold delta.`);
        }
      }
    }
  }
}

function validateIntegrity(evidence: unknown, inputEvidenceSha256: string): {
  status: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  errors: readonly string[];
  evidence?: M3R3CResearchEvidence;
} {
  const errors: string[] = [];
  if (inputEvidenceSha256 !== M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256) errors.push("input evidence SHA-256 mismatch.");
  try {
    validateM3R3Round003MachineRecord();
    validateM3R3Round003Plan();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Round-003 machine record or plan validation failed.");
  }
  if (!isRecord(evidence)) return { status: "INCOMPLETE_EVIDENCE", errors: Object.freeze([...errors, "evidence is not an object."]) };

  const exactStrings: readonly [string, string, string][] = [
    ["schemaVersion", evidence.schemaVersion as string, M3_R3_C_EXPECTED_SCHEMA_VERSION],
    ["researchRoundId", evidence.researchRoundId as string, M3_R3_ROUND_003_RESEARCH_ROUND_ID],
    ["selectionGateSha256", evidence.selectionGateSha256 as string, BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256],
    ["experimentPlanSha256", evidence.experimentPlanSha256 as string, M3_R3_ROUND_003_PLAN_SHA256],
    ["recoveryMainBaseSha", evidence.recoveryMainBaseSha as string, M3_R3_C_EXPECTED_RECOVERY_MAIN_BASE_SHA],
    ["executionSourceSha", evidence.executionSourceSha as string, M3_R3_C_EXPECTED_EXECUTION_SOURCE_SHA],
    ["strategyVersion", evidence.strategyVersion as string, M3_R3_C_EXPECTED_STRATEGY_VERSION],
    ["backtestPolicyVersion", evidence.backtestPolicyVersion as string, M3_R3_C_EXPECTED_POLICY_VERSION],
    ["controlReportSchemaVersion", evidence.controlReportSchemaVersion as string, M3_R3_C_EXPECTED_CONTROL_SCHEMA_VERSION],
    ["dataClassification", evidence.dataClassification as string, M3_R3_C_EXPECTED_DATA_CLASSIFICATION],
    ["performanceLock", evidence.performanceLock as string, M3_R3_C_EXPECTED_PERFORMANCE_LOCK],
    ["decision", evidence.decision as string, M3_R3_C_EXPECTED_DECISION],
  ];
  for (const [field, actual, expected] of exactStrings) if (actual !== expected) errors.push(`${field} mismatch.`);
  if (evidence.evidenceStatus !== "COMPLETE") errors.push("evidenceStatus is not COMPLETE.");
  if (evidence.performanceLockTriggered !== true) errors.push("performanceLockTriggered must be true.");
  if (!isSafeNonNegativeInteger(evidence.snapshotCount) || evidence.snapshotCount !== EXPECTED_SNAPSHOT_COUNT) errors.push("snapshotCount mismatch.");
  if (!isSafeNonNegativeInteger(evidence.controlExecutedTrades)) errors.push("controlExecutedTrades is invalid.");
  if (!isSafeNonNegativeInteger(evidence.controlFormalSignals)) errors.push("controlFormalSignals is invalid.");

  const candidates = evidence.candidates;
  if (!Array.isArray(candidates) || candidates.length !== M3_R3_ROUND_003_CANDIDATE_IDS.length) {
    errors.push("candidate count must be exactly nine.");
  }
  const controlValue = evidence.control;
  let control: M3R3CVariantEvidence | undefined;
  if (validateVariant(controlValue, M3_R2_ROUND_002_CONTROL_ID, "control", errors)) control = controlValue;
  const candidateValues: M3R3CVariantEvidence[] = [];
  if (Array.isArray(candidates) && candidates.length === M3_R3_ROUND_003_CANDIDATE_IDS.length) {
    for (const [index, expectedId] of M3_R3_ROUND_003_CANDIDATE_IDS.entries()) {
      const candidate = candidates[index];
      if (validateVariant(candidate, expectedId, `candidate ${expectedId}`, errors)) candidateValues.push(candidate);
    }
  }
  if (control !== undefined && isSafeNonNegativeInteger(evidence.controlExecutedTrades) && evidence.controlExecutedTrades !== control.aggregateValidation.diagnostics.executedTrades) {
    errors.push("controlExecutedTrades does not match CONTROL aggregate diagnostics.");
  }
  if (control !== undefined && isSafeNonNegativeInteger(evidence.controlFormalSignals) && evidence.controlFormalSignals !== control.aggregateValidation.diagnostics.formalSignals) {
    errors.push("controlFormalSignals does not match CONTROL aggregate diagnostics.");
  }
  if (control !== undefined) for (const candidate of candidateValues) validateConvenienceFields(candidate, control, `candidate ${candidate.candidateId}`, errors);
  const identityHashes = control === undefined
    ? []
    : [control, ...candidateValues].flatMap((variant) => [variant.formalIdentitySha256, variant.executedIdentitySha256]);
  if (identityHashes.length > 0 && new Set(identityHashes).size !== identityHashes.length) errors.push("formal and executed identity hashes must be unique.");
  if (errors.length > 0 || control === undefined || candidateValues.length !== M3_R3_ROUND_003_CANDIDATE_IDS.length) {
    return { status: "INCOMPLETE_EVIDENCE", errors: Object.freeze(errors) };
  }
  return {
    status: "COMPLETE",
    errors: Object.freeze([]),
    evidence: evidence as unknown as M3R3CResearchEvidence,
  };
}

function passesAtLeast(actual: number | null, threshold: number): boolean {
  return actual !== null && isFiniteNumber(actual) && actual >= threshold;
}

function passesAtMost(actual: number | null, threshold: number): boolean {
  return actual !== null && isFiniteNumber(actual) && actual <= threshold;
}

function aggregateImprovement(candidate: M3R3CVariantEvidence, control: M3R3CVariantEvidence): number | null {
  const candidateExpectancy = candidate.aggregateValidation.diagnostics.expectancyR;
  const controlExpectancy = control.aggregateValidation.diagnostics.expectancyR;
  return candidateExpectancy === null || controlExpectancy === null ? null : candidateExpectancy - controlExpectancy;
}

function improvedValidationFoldCount(
  candidate: M3R3CVariantEvidence,
  control: M3R3CVariantEvidence,
  sampleFloor: number,
  deltaFloor: number,
): number {
  return FOLD_IDS.reduce((count, foldId) => {
    const candidateFold = candidate.folds.find((fold) => fold.foldId === foldId)!.diagnostics;
    const controlFold = control.folds.find((fold) => fold.foldId === foldId)!.diagnostics;
    const delta = candidateFold.expectancyR === null || controlFold.expectancyR === null
      ? null
      : candidateFold.expectancyR - controlFold.expectancyR;
    return candidateFold.executedTrades >= sampleFloor && controlFold.executedTrades >= sampleFloor && delta !== null && delta >= deltaFloor
      ? count + 1
      : count;
  }, 0);
}

function catastrophicFoldCount(candidate: M3R3CVariantEvidence, sampleFloor: number): number {
  const catastrophic = BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS.catastrophicFold;
  return candidate.folds.filter((fold) => {
    const diagnostics = fold.diagnostics;
    return (
      (diagnostics.expectancyR !== null && diagnostics.expectancyR <= catastrophic.expectancyRAtMost)
      || (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < catastrophic.normalProfitFactorBelow)
      || diagnostics.profitFactorStatus === "NO_TRADES"
      || diagnostics.executedTrades < sampleFloor
    );
  }).length;
}

function gateResult(
  gateId: HardGateId,
  actualValue: GateActualValue,
  status: M3R3CGateStatus,
  applicability: M3R3CGateApplicability,
): M3R3CGateResult {
  const gate = BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD.selectionGates[gateId];
  return Object.freeze({
    gateId,
    applicability,
    actualValue,
    threshold: gate.value,
    comparison: gate.comparison as "AT_LEAST" | "AT_MOST",
    status,
  });
}

function evaluateCandidate(candidate: M3R3CVariantEvidence, control: M3R3CVariantEvidence): M3R3CCandidateEvaluation {
  const gates = BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD.selectionGates;
  const candidateDiagnostics = candidate.aggregateValidation.diagnostics;
  const aggregateDelta = aggregateImprovement(candidate, control);
  const improved = improvedValidationFoldCount(candidate, control, gates.minimumExecutedTrades.value, BASELINE_002_RESEARCH_ROUND_003_DEFINITIONS.foldImprovementDeltaR);
  const catastrophic = catastrophicFoldCount(candidate, gates.minimumExecutedTrades.value);
  const minimumFoldTrades = Math.min(...candidate.folds.map((fold) => fold.diagnostics.executedTrades));
  const foldTradeActual = Object.freeze(Object.fromEntries(candidate.folds.map((fold) => [fold.foldId, fold.diagnostics.executedTrades]))) as Readonly<Record<string, number>>;
  const sampleGatesPass = passesAtLeast(candidateDiagnostics.formalSignals, gates.minimumFormalSignals.value)
    && passesAtLeast(minimumFoldTrades, gates.minimumExecutedTrades.value);
  const gateResults = [
    gateResult("minimumAggregateImprovement", aggregateDelta, passesAtLeast(aggregateDelta, gates.minimumAggregateImprovement.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("minimumImprovedValidationFolds", improved, passesAtLeast(improved, gates.minimumImprovedValidationFolds.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("catastrophicFoldLimit", catastrophic, passesAtMost(catastrophic, gates.catastrophicFoldLimit.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("minimumNetExpectancy", candidateDiagnostics.expectancyR, passesAtLeast(candidateDiagnostics.expectancyR, gates.minimumNetExpectancy.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult(
      "minimumProfitFactor",
      candidateDiagnostics.profitFactor,
      candidateDiagnostics.profitFactorStatus === "NORMAL"
        ? passesAtLeast(candidateDiagnostics.profitFactor, gates.minimumProfitFactor.value) ? "PASS" : "FAIL"
        : candidateDiagnostics.profitFactorStatus === "NO_LOSSES" && sampleGatesPass ? "PASS" : "FAIL",
      "REQUIRED",
    ),
    gateResult("maximumSymbolConcentration", candidateDiagnostics.topSymbolShareOfPositiveNetR, passesAtMost(candidateDiagnostics.topSymbolShareOfPositiveNetR, gates.maximumSymbolConcentration.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("maximumSingleTradeConcentration", candidateDiagnostics.largestSingleTradeShareOfPositiveNetR, passesAtMost(candidateDiagnostics.largestSingleTradeShareOfPositiveNetR, gates.maximumSingleTradeConcentration.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult(
      "maximumFeeBurdenRatio",
      candidateDiagnostics.feeBurdenRatio,
      candidateDiagnostics.grossR !== 0 && passesAtMost(candidateDiagnostics.feeBurdenRatio, gates.maximumFeeBurdenRatio.value) ? "PASS" : "FAIL",
      "REQUIRED",
    ),
    gateResult("requiredRedundancyImprovement", null, "NOT_APPLICABLE", "NOT_APPLICABLE"),
    gateResult("minimumFormalSignals", candidateDiagnostics.formalSignals, passesAtLeast(candidateDiagnostics.formalSignals, gates.minimumFormalSignals.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("minimumExecutedTrades", foldTradeActual, passesAtLeast(minimumFoldTrades, gates.minimumExecutedTrades.value) ? "PASS" : "FAIL", "REQUIRED"),
  ] as const;
  const failedGateIds = gateResults.filter((gate) => gate.status === "FAIL").map((gate) => gate.gateId);
  const applicableGateCount = gateResults.filter((gate) => gate.applicability === "REQUIRED").length;
  const passedApplicableGateCount = gateResults.filter((gate) => gate.applicability === "REQUIRED" && gate.status === "PASS").length;
  return Object.freeze({
    candidateId: candidate.candidateId,
    complexity: candidate.complexity,
    metrics: Object.freeze({
      aggregateImprovement: aggregateDelta,
      improvedValidationFoldCount: improved,
      catastrophicFoldCount: catastrophic,
      expectancyR: candidateDiagnostics.expectancyR,
      profitFactor: candidateDiagnostics.profitFactor,
      profitFactorStatus: candidateDiagnostics.profitFactorStatus,
      topSymbolShareOfPositiveNetR: candidateDiagnostics.topSymbolShareOfPositiveNetR,
      largestSingleTradeShareOfPositiveNetR: candidateDiagnostics.largestSingleTradeShareOfPositiveNetR,
      feeBurdenRatio: candidateDiagnostics.feeBurdenRatio,
      redundancyRelativeReductionVsControl: null,
      formalSignals: candidateDiagnostics.formalSignals,
      minimumFoldExecutedTrades: minimumFoldTrades,
    }),
    gateResults: Object.freeze([...gateResults]),
    applicableGateCount,
    passedApplicableGateCount,
    failedGateCount: failedGateIds.length,
    failedGateIds: Object.freeze([...failedGateIds]),
    eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE",
  });
}

function compareComplexity(left: M3R3CCandidateEvaluation, right: M3R3CCandidateEvaluation): number {
  const leftTuple = [left.complexity.newRules, left.complexity.newTunableThresholds, left.complexity.modifiedBaselineRules, left.complexity.mechanismFamiliesUsed];
  const rightTuple = [right.complexity.newRules, right.complexity.newTunableThresholds, right.complexity.modifiedBaselineRules, right.complexity.mechanismFamiliesUsed];
  for (let index = 0; index < leftTuple.length; index += 1) {
    if (leftTuple[index] !== rightTuple[index]) return leftTuple[index] < rightTuple[index] ? -1 : 1;
  }
  return 0;
}

function compareEligibleCandidates(left: M3R3CCandidateEvaluation, right: M3R3CCandidateEvaluation, tieThreshold: number): number {
  const improvedDifference = (right.metrics.improvedValidationFoldCount ?? 0) - (left.metrics.improvedValidationFoldCount ?? 0);
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
  return compareStrings(left.candidateId, right.candidateId);
}

function incompleteEvaluation(errors: readonly string[]): M3R3CSelectionEvaluation {
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

export function evaluateM3R3CSelection(evidence: unknown, inputEvidenceSha256: string): M3R3CSelectionEvaluation {
  const integrity = validateIntegrity(evidence, inputEvidenceSha256);
  if (integrity.status !== "COMPLETE" || integrity.evidence === undefined) return incompleteEvaluation(integrity.errors);
  const control = integrity.evidence.control;
  const candidates = integrity.evidence.candidates.map((candidate) => evaluateCandidate(candidate, control));
  const eligible = candidates.filter((candidate) => candidate.eligibility === "ELIGIBLE");
  if (eligible.length === 0) {
    return Object.freeze({
      integrityStatus: "COMPLETE",
      integrityErrors: Object.freeze([]),
      candidates: Object.freeze(candidates),
      eligibleCandidateIds: Object.freeze([]),
      selectionAlgorithmApplied: false,
      selectedCandidateId: null,
      finalDecision: M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME,
    });
  }
  const eligibleCandidateIds = eligible.map((candidate) => candidate.candidateId);
  const sorted = [...eligible].sort((left, right) => compareEligibleCandidates(
    left,
    right,
    BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD.selectionGates.complexityTieThreshold.value,
  ));
  return Object.freeze({
    integrityStatus: "COMPLETE",
    integrityErrors: Object.freeze([]),
    candidates: Object.freeze(candidates),
    eligibleCandidateIds: Object.freeze(eligibleCandidateIds),
    selectionAlgorithmApplied: true,
    selectedCandidateId: sorted[0].candidateId,
    finalDecision: "SELECTED_BASELINE_002_CANDIDATE",
  });
}

export function createM3R3CSelectionReport(input: Readonly<{
  evidence: unknown;
  inputEvidencePath: string;
  inputEvidenceSha256: string;
  executionSourceSha: string;
  sourceMainSha?: string;
}>): M3R3CSelectionReport {
  const evaluation = evaluateM3R3CSelection(input.evidence, input.inputEvidenceSha256);
  const sourceMainSha = input.sourceMainSha ?? M3_R3_C_SOURCE_MAIN_SHA;
  if (sourceMainSha !== M3_R3_C_SOURCE_MAIN_SHA) throw new Error("M3-R3-C source main SHA mismatch.");
  if (!isSha1(input.executionSourceSha)) throw new Error("M3-R3-C execution source SHA is invalid.");
  const performanceEvidenceStatus = isRecord(input.evidence) && input.evidence.evidenceStatus === "COMPLETE" ? "COMPLETE" : "INCOMPLETE";
  return Object.freeze({
    schemaVersion: M3_R3_C_SELECTION_SCHEMA_VERSION,
    researchRoundId: M3_R3_ROUND_003_RESEARCH_ROUND_ID,
    sourceMainSha: M3_R3_C_SOURCE_MAIN_SHA,
    executionSourceSha: input.executionSourceSha,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R3_ROUND_003_PLAN_SHA256,
    inputEvidencePath: input.inputEvidencePath,
    inputEvidenceSha256: M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256,
    performanceEvidenceStatus,
    integrityStatus: evaluation.integrityStatus,
    integrityErrors: evaluation.integrityErrors,
    candidates: evaluation.candidates,
    eligibleCandidateIds: evaluation.eligibleCandidateIds,
    selectionAlgorithmApplied: evaluation.selectionAlgorithmApplied,
    selectedCandidateId: evaluation.selectedCandidateId,
    finalDecision: evaluation.finalDecision,
    baseline002Status: M3_R3_C_BASELINE_002_STATUS,
    m3JStatus: M3_R3_C_M3_J_STATUS,
    m4Status: M3_R3_C_M4_STATUS,
  });
}

export function serializeM3R3CSelectionReport(report: M3R3CSelectionReport): string {
  return `${stableStringify(report)}\n`;
}

export function sha256M3R3CSelectionRawBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function display(value: number | null): string {
  return value === null ? "null" : String(value);
}

function displayProfitFactor(metrics: M3R3CCandidateMetrics): string {
  return metrics.profitFactorStatus === null ? "null" : `${metrics.profitFactorStatus}${metrics.profitFactor === null ? "" : ` (${metrics.profitFactor})`}`;
}

export function renderM3R3CSelectionMarkdown(report: M3R3CSelectionReport, selectionJsonSha256: string): string {
  const lines = [
    "# M3-R3-C Round-003 Frozen Selection Gate Application",
    "",
    `integrityStatus: ${report.integrityStatus}`,
    `finalDecision: ${report.finalDecision}`,
    `researchRoundId: ${report.researchRoundId}`,
    `sourceMainSha: ${report.sourceMainSha}`,
    `executionSourceSha: ${report.executionSourceSha}`,
    `selectionGateSha256: ${report.selectionGateSha256}`,
    `experimentPlanSha256: ${report.experimentPlanSha256}`,
    `inputEvidencePath: ${report.inputEvidencePath}`,
    `inputEvidenceSha256: ${report.inputEvidenceSha256}`,
    `m3R3CSelectionSha256: ${selectionJsonSha256}`,
    `performanceEvidenceStatus: ${report.performanceEvidenceStatus}`,
    `selectionAlgorithmApplied: ${report.selectionAlgorithmApplied}`,
    `selectedCandidateId: ${report.selectedCandidateId ?? "null"}`,
    `eligibleCandidateIds: ${report.eligibleCandidateIds.length === 0 ? "none" : report.eligibleCandidateIds.join(", ")}`,
    `baseline002Status: ${report.baseline002Status}`,
    `m3JStatus: ${report.m3JStatus}`,
    `m4Status: ${report.m4Status}`,
    "",
  ];
  if (report.integrityErrors.length > 0) lines.push("## Integrity errors", "", ...report.integrityErrors.map((error) => `- ${error}`), "");
  lines.push(
    "## Candidate gate matrix",
    "",
    "| candidate | aggregate improvement | improved folds | catastrophic folds | aggregate expectancyR | PF | symbol concentration | single-trade concentration | fee burden | aggregate formal signals | minimum fold executed trades | applicable | passed | failed gates | eligibility |",
    "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  );
  for (const candidate of report.candidates) {
    const metrics = candidate.metrics;
    lines.push(`| ${candidate.candidateId} | ${display(metrics.aggregateImprovement)} | ${display(metrics.improvedValidationFoldCount)} | ${display(metrics.catastrophicFoldCount)} | ${display(metrics.expectancyR)} | ${displayProfitFactor(metrics)} | ${display(metrics.topSymbolShareOfPositiveNetR)} | ${display(metrics.largestSingleTradeShareOfPositiveNetR)} | ${display(metrics.feeBurdenRatio)} | ${display(metrics.formalSignals)} | ${display(metrics.minimumFoldExecutedTrades)} | ${candidate.applicableGateCount} | ${candidate.passedApplicableGateCount} | ${candidate.failedGateIds.length === 0 ? "none" : candidate.failedGateIds.join(", ")} | ${candidate.eligibility} |`);
  }
  lines.push("", "## Gate details", "");
  for (const candidate of report.candidates) {
    lines.push(`### ${candidate.candidateId}`, "", ...candidate.gateResults.map((gate) => `- ${gate.gateId}: ${gate.status} (${gate.applicability}; actual=${JSON.stringify(gate.actualValue)}; threshold=${gate.threshold} ${gate.comparison})`), "");
  }
  lines.push(
    "## Frozen boundary",
    "",
    "- All nine candidates were evaluated and all eleven gate identities were evaluated for every candidate; no early exit was used.",
    "- Aggregate gates use `aggregateValidation.diagnostics`; the executed-sample gate uses F1-F6 validation diagnostics.",
    "- `requiredRedundancyImprovement` is `NOT_APPLICABLE`, is not `PASS`, and is excluded from the eligibility conjunction.",
    "- This is a signal-level backtest, not a portfolio equity simulation.",
    "- All data through 2026-08-15 is research-available seen data, not true forward OOS.",
    "- baseline-002 remains NOT FROZEN.",
    "",
  );
  if (report.finalDecision === M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME) lines.push(M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME, "");
  return `${lines.join("\n")}\n`;
}

export { HARD_GATE_IDS };
