import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import {
  M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_CANDIDATE_IDS,
  M3_R5_ROUND_005_COMPLEXITY_TUPLES,
  M3_R5_ROUND_005_CONTROL_ID,
  M3_R5_ROUND_005_DEFINITIONS,
  M3_R5_ROUND_005_EXCLUDED_CANDIDATES,
  M3_R5_ROUND_005_HARD_GATE_IDENTITIES,
  M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME,
  M3_R5_ROUND_005_PERFORMANCE_LOCK,
  M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  M3_R5_ROUND_005_SELECTION_GATES,
  M3_R5_ROUND_005_SELECTION_GATE_SHA256,
} from "./selection-gates-round-005.ts";
import {
  M3_R5_ROUND_005_PLAN,
  M3_R5_ROUND_005_PLAN_SHA256,
  M3_R5_ROUND_005_CONTROL_REPORT_SCHEMA_VERSION,
  M3_R5_ROUND_005_DATA_CLASSIFICATION,
  validateM3R5Round005Plan,
} from "./m3-r5-round-005-plan.ts";
import { validateM3R5Round005MachineRecord } from "./selection-gates-round-005.ts";
import { stableStringify } from "./utils.ts";

export const M3_R5_C3A_SELECTION_SCHEMA_VERSION = "m3-r5-c3-selection-001" as const;
export const M3_R5_C3A_EXPECTED_PERFORMANCE_EXECUTION_SOURCE_SHA =
  "7e1652c30d3bc092f3161b9b36b7b11debebf161" as const;
export const M3_R5_C3A_EXPECTED_INPUT_SUMMARY_SHA256 =
  "af3f14665fcbc4d050ad432d973d7999c4627132449e1eae82faa86ac78f1860" as const;
export const M3_R5_C3A_EXPECTED_INPUT_AUDIT_SHA256 =
  "9c970b37cad81979862fbd278c3b655d1cd3e653123aa0b0a657d1ee57efdcbf" as const;
export const M3_R5_C3A_EXPECTED_INPUT_RESULTS_SHA256 =
  "ee6374f08493e73fc505fbd0d374a4f1d53addceb13ddbfe67cfc67ebb8a9ce0" as const;
export const M3_R5_C3A_BASELINE_002_STATUS = "NOT_FROZEN" as const;
export const M3_R5_C3A_M3_J_STATUS = "BLOCKED" as const;
export const M3_R5_C3A_M4_STATUS = "NOT_STARTED" as const;

const FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;
const VALID_STATUSES = new Set([
  "EXECUTED",
  "PERIOD_END_CENSORED",
  "ENTRY_OUTSIDE_BRACKET",
  "DATA_INCOMPLETE",
  "SETTLEMENT_AMBIGUOUS",
  "NOT_EXECUTED",
]);
const VALID_DIRECTIONS = new Set(["LONG", "SHORT"]);

export type M3R5C3AGateId = (typeof M3_R5_ROUND_005_HARD_GATE_IDENTITIES)[number];
export type M3R5C3AGateStatus = "PASS" | "FAIL" | "NOT_APPLICABLE";
export type M3R5C3AGateApplicability = "REQUIRED" | "NOT_APPLICABLE";
export type M3R5C3AEligibility = "ELIGIBLE" | "INELIGIBLE";
export type M3R5C3AFinalDecision =
  | "SELECTED_BASELINE_002_CANDIDATE"
  | typeof M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME
  | "INCOMPLETE_EVIDENCE";

type GateActualValue = number | null | Readonly<Record<string, number>>;
type ProfitFactorStatus = "NORMAL" | "NO_TRADES" | "NO_LOSSES";
type Range = Readonly<{ startTime: number; endTime: number }>;

export type M3R5C3ADiagnostics = Readonly<{
  range: Range;
  formalSignals: number;
  executedTrades: number;
  grossR: number | null;
  expectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: ProfitFactorStatus;
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
}>;

export type M3R5C3ASignal = Readonly<{
  signalTime: number;
  symbol: ResearchSymbol;
  direction: "LONG" | "SHORT";
  status: string;
}>;

export type M3R5C3AGateResult = Readonly<{
  gateId: M3R5C3AGateId;
  applicability: M3R5C3AGateApplicability;
  actualValue: GateActualValue;
  threshold: number;
  comparison: "AT_LEAST" | "AT_MOST";
  status: M3R5C3AGateStatus;
}>;

export type M3R5C3ACandidateMetrics = Readonly<{
  aggregateImprovement: number | null;
  improvedValidationFoldCount: number;
  catastrophicFoldCount: number;
  expectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: ProfitFactorStatus | null;
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
  formalSignals: number | null;
  minimumFoldExecutedTrades: number | null;
}>;

export type M3R5C3ACandidateEvaluation = Readonly<{
  candidateId: string;
  complexity: Readonly<Record<string, number>>;
  metrics: M3R5C3ACandidateMetrics;
  gateResults: readonly M3R5C3AGateResult[];
  applicableGateCount: number;
  passedApplicableGateCount: number;
  failedGateCount: number;
  failedGateIds: readonly M3R5C3AGateId[];
  eligibility: M3R5C3AEligibility;
}>;

export type M3R5C3ASelectionEvaluation = Readonly<{
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3R5C3ACandidateEvaluation[];
  eligibleCandidateIds: readonly string[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: string | null;
  finalDecision: M3R5C3AFinalDecision;
}>;

export type M3R5C3AInputHashes = Readonly<{
  summary: string;
  audit: string;
  results: string;
}>;

export type M3R5C3ASelectionReport = Readonly<{
  schemaVersion: typeof M3_R5_C3A_SELECTION_SCHEMA_VERSION;
  researchRoundId: typeof M3_R5_ROUND_005_RESEARCH_ROUND_ID;
  gateApplicationSourceSha: string;
  performanceExecutionSourceSha: string;
  selectionGateSha256: typeof M3_R5_ROUND_005_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R5_ROUND_005_PLAN_SHA256;
  inputSummaryPath: string;
  inputSummarySha256: string;
  inputAuditPath: string;
  inputAuditSha256: string;
  inputResultsPath: string;
  inputResultsSha256: string;
  performanceLock: typeof M3_R5_ROUND_005_PERFORMANCE_LOCK;
  performanceEvidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3R5C3ACandidateEvaluation[];
  eligibleCandidateIds: readonly string[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: string | null;
  finalDecision: M3R5C3AFinalDecision;
  baseline002Status: typeof M3_R5_C3A_BASELINE_002_STATUS;
  m3JStatus: typeof M3_R5_C3A_M3_J_STATUS;
  m4Status: typeof M3_R5_C3A_M4_STATUS;
}>;

export type M3R5C3ASelectionOutputPayloads = Readonly<{
  jsonPath: string;
  markdownPath: string;
  jsonBytes: Uint8Array;
  markdownBytes: Uint8Array;
}>;

export type M3R5C3APublicationOptions = Readonly<{
  renameFile?: (source: string, destination: string) => void;
  onStagingDirectory?: (path: string) => void;
}>;

type SummaryFold = Readonly<{
  foldId: string;
  validation: Readonly<{
    range: Range;
    records: readonly M3R5C3ASignal[];
    diagnostics: M3R5C3ADiagnostics;
  }>;
}>;

type SummaryCandidate = Readonly<{
  candidateId: string;
  fullSeenUniverse: Readonly<{ range: Range; records: readonly M3R5C3ASignal[]; diagnostics: M3R5C3ADiagnostics }>;
  folds: readonly SummaryFold[];
  aggregateValidation: Readonly<{
    segments: readonly Range[];
    records: readonly M3R5C3ASignal[];
    diagnostics: M3R5C3ADiagnostics;
  }>;
  formalIdentitySha256: string;
  executedIdentitySha256: string;
}>;

type SummaryEvidence = Readonly<{
  schemaVersion: string;
  researchRoundId: string;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  strategyVersion: string;
  backtestPolicyVersion: string;
  controlReportSchemaVersion: string;
  dataClassification: string;
  researchUniverse: Range;
  performanceLock: string;
  performanceLockTriggered: boolean;
  performanceLifecycle?: string;
  evidenceStatus: string;
  integrityErrors: readonly unknown[];
  selectionApplied: boolean;
  selectedCandidateId: string | null;
  candidateRegistry: readonly string[];
  excludedCandidates: unknown;
  control: SummaryCandidate;
  candidates: readonly SummaryCandidate[];
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

function isFiniteOrNull(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function isSha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function sameRange(value: unknown, expected: Range): boolean {
  return isRecord(value) && value.startTime === expected.startTime && value.endTime === expected.endTime;
}

function expectedResearchUniverse(): Range {
  return M3_R5_ROUND_005_PLAN.researchUniverse;
}

function expectedAggregateRange(): Range {
  return {
    startTime: getResearchFoldRoleRange("F1", "VALIDATION").startTime,
    endTime: getResearchFoldRoleRange("F6", "VALIDATION").endTime,
  };
}

function compareSignals(left: M3R5C3ASignal, right: M3R5C3ASignal): number {
  return left.signalTime - right.signalTime
    || RESEARCH_SYMBOLS.indexOf(left.symbol) - RESEARCH_SYMBOLS.indexOf(right.symbol)
    || (left.direction === right.direction ? 0 : left.direction === "LONG" ? -1 : 1);
}

function identity(signal: M3R5C3ASignal): string {
  return `${signal.symbol}|${signal.direction}|${signal.signalTime}`;
}

export function hashM3R5C3AIdentityRecords(records: readonly M3R5C3ASignal[], executedOnly = false): string {
  const identities = records
    .filter((signal) => !executedOnly || signal.status === "EXECUTED")
    .map(identity);
  return createHash("sha256").update(stableStringify(identities), "utf8").digest("hex");
}

function validateSignal(value: unknown, path: string, universe: Range, errors: string[]): value is M3R5C3ASignal {
  if (!isRecord(value)) {
    errors.push(`${path} is missing.`);
    return false;
  }
  const signalTime = value.signalTime;
  if (typeof signalTime !== "number" || !Number.isSafeInteger(signalTime) || signalTime < universe.startTime || signalTime > universe.endTime) errors.push(`${path}.signalTime is invalid.`);
  if (typeof value.symbol !== "string" || !RESEARCH_SYMBOLS.includes(value.symbol as ResearchSymbol)) errors.push(`${path}.symbol is invalid.`);
  if (typeof value.direction !== "string" || !VALID_DIRECTIONS.has(value.direction)) errors.push(`${path}.direction is invalid.`);
  if (typeof value.status !== "string" || !VALID_STATUSES.has(value.status)) errors.push(`${path}.status is invalid.`);
  return true;
}

function validateRecordSet(value: unknown, path: string, universe: Range, errors: string[]): value is readonly M3R5C3ASignal[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return false;
  }
  const identities = new Set<string>();
  let valid = true;
  for (const [index, signal] of value.entries()) {
    valid = validateSignal(signal, `${path}[${index}]`, universe, errors) && valid;
    if (isRecord(signal) && typeof signal.symbol === "string" && typeof signal.direction === "string" && Number.isSafeInteger(signal.signalTime)) {
      const key = `${signal.symbol}|${signal.direction}|${signal.signalTime}`;
      if (identities.has(key)) errors.push(`${path} contains duplicate identity ${key}.`);
      identities.add(key);
    }
  }
  return valid;
}

function validateDiagnostics(value: unknown, path: string, expectedRange: Range, errors: string[]): value is M3R5C3ADiagnostics {
  if (!isRecord(value)) {
    errors.push(`${path} is missing.`);
    return false;
  }
  if (!sameRange(value.range, expectedRange)) errors.push(`${path}.range is not frozen.`);
  for (const key of ["formalSignals", "executedTrades"] as const) {
    if (!isSafeNonNegativeInteger(value[key])) errors.push(`${path}.${key} is invalid.`);
  }
  for (const key of [
    "grossR",
    "expectancyR",
    "profitFactor",
    "topSymbolShareOfPositiveNetR",
    "largestSingleTradeShareOfPositiveNetR",
    "feeBurdenRatio",
  ] as const) {
    if (!isFiniteOrNull(value[key])) errors.push(`${path}.${key} is invalid.`);
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

function sameIdentitySet(left: readonly M3R5C3ASignal[], right: readonly M3R5C3ASignal[]): boolean {
  const a = new Set(left.map(identity));
  const b = new Set(right.map(identity));
  return a.size === b.size && [...a].every((item) => b.has(item));
}

function expectedRecordsForRange(records: readonly M3R5C3ASignal[], range: Range): readonly M3R5C3ASignal[] {
  return records.filter((signal) => signal.signalTime >= range.startTime && signal.signalTime <= range.endTime).sort(compareSignals);
}

function validateCandidate(value: unknown, expectedId: string, path: string, errors: string[]): value is SummaryCandidate {
  if (!isRecord(value)) {
    errors.push(`${path} is missing.`);
    return false;
  }
  if (value.candidateId !== expectedId) errors.push(`${path}.candidateId mismatch.`);
  const universe = expectedResearchUniverse();
  const full = value.fullSeenUniverse;
  let fullRecords: readonly M3R5C3ASignal[] = [];
  let fullValid = false;
  if (!isRecord(full)) {
    errors.push(`${path}.fullSeenUniverse is missing.`);
  } else {
    if (!sameRange(full.range, universe)) errors.push(`${path}.fullSeenUniverse.range mismatch.`);
    fullValid = validateRecordSet(full.records, `${path}.fullSeenUniverse.records`, universe, errors);
    if (fullValid) fullRecords = full.records as readonly M3R5C3ASignal[];
    validateDiagnostics(full.diagnostics, `${path}.fullSeenUniverse.diagnostics`, universe, errors);
  }

  let foldsValid = Array.isArray(value.folds) && value.folds.length === FOLD_IDS.length;
  if (!foldsValid) errors.push(`${path}.folds must contain exactly F1-F6.`);
  if (foldsValid) {
    for (const [index, fold] of (value.folds as unknown[]).entries()) {
      const foldPath = `${path}.folds[${index}]`;
      const expectedFoldId = FOLD_IDS[index]!;
      if (!isRecord(fold)) {
        errors.push(`${foldPath} is missing.`);
        foldsValid = false;
        continue;
      }
      if (fold.foldId !== expectedFoldId) errors.push(`${foldPath}.foldId mismatch.`);
      const validation = fold.validation;
      const expectedRange = getResearchFoldRoleRange(expectedFoldId, "VALIDATION");
      if (!isRecord(validation)) {
        errors.push(`${foldPath}.validation is missing.`);
        foldsValid = false;
        continue;
      }
      if (!sameRange(validation.range, expectedRange)) errors.push(`${foldPath}.validation.range mismatch.`);
      const recordsValid = validateRecordSet(validation.records, `${foldPath}.validation.records`, universe, errors);
      validateDiagnostics(validation.diagnostics, `${foldPath}.validation.diagnostics`, expectedRange, errors);
      if (recordsValid && fullValid && !sameIdentitySet(validation.records as readonly M3R5C3ASignal[], expectedRecordsForRange(fullRecords, expectedRange))) {
        errors.push(`${foldPath}.validation.records do not match the frozen range.`);
      }
    }
  }

  const aggregate = value.aggregateValidation;
  let aggregateValid = false;
  if (!isRecord(aggregate)) {
    errors.push(`${path}.aggregateValidation is missing.`);
  } else {
    const expectedSegments = FOLD_IDS.map((foldId) => getResearchFoldRoleRange(foldId, "VALIDATION"));
    if (stableStringify(aggregate.segments) !== stableStringify(expectedSegments)) errors.push(`${path}.aggregateValidation.segments mismatch.`);
    aggregateValid = validateRecordSet(aggregate.records, `${path}.aggregateValidation.records`, expectedResearchUniverse(), errors);
    validateDiagnostics(aggregate.diagnostics, `${path}.aggregateValidation.diagnostics`, expectedAggregateRange(), errors);
    if (aggregateValid && fullValid && foldsValid) {
      const expected = (value.folds as SummaryFold[]).flatMap((fold) => fold.validation.records);
      if (!sameIdentitySet(aggregate.records as readonly M3R5C3ASignal[], expected)) errors.push(`${path}.aggregateValidation.records do not match F1-F6.`);
    }
  }
  if (!isSha256(value.formalIdentitySha256)) errors.push(`${path}.formalIdentitySha256 is invalid.`);
  if (!isSha256(value.executedIdentitySha256)) errors.push(`${path}.executedIdentitySha256 is invalid.`);
  if (fullValid && isSha256(value.formalIdentitySha256) && value.formalIdentitySha256 !== hashM3R5C3AIdentityRecords(fullRecords)) errors.push(`${path}.formalIdentitySha256 mismatch.`);
  if (fullValid && isSha256(value.executedIdentitySha256) && value.executedIdentitySha256 !== hashM3R5C3AIdentityRecords(fullRecords, true)) errors.push(`${path}.executedIdentitySha256 mismatch.`);
  return true;
}

function validateSummary(evidence: unknown, inputHashes: M3R5C3AInputHashes): { status: "COMPLETE" | "INCOMPLETE_EVIDENCE"; errors: readonly string[]; evidence?: SummaryEvidence } {
  const errors: string[] = [];
  if (inputHashes.summary !== M3_R5_C3A_EXPECTED_INPUT_SUMMARY_SHA256) errors.push("input summary SHA-256 mismatch.");
  if (inputHashes.audit !== M3_R5_C3A_EXPECTED_INPUT_AUDIT_SHA256) errors.push("input audit SHA-256 mismatch.");
  if (inputHashes.results !== M3_R5_C3A_EXPECTED_INPUT_RESULTS_SHA256) errors.push("input results SHA-256 mismatch.");
  try {
    validateM3R5Round005MachineRecord();
    validateM3R5Round005Plan();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Round-005 Gate or Plan validation failed.");
  }
  if (!isRecord(evidence)) return { status: "INCOMPLETE_EVIDENCE", errors: ["summary is not an object."] };
  if (evidence.schemaVersion !== "m3-r5-round-005-report-001") errors.push("schemaVersion mismatch.");
  if (evidence.researchRoundId !== M3_R5_ROUND_005_RESEARCH_ROUND_ID) errors.push("researchRoundId mismatch.");
  if (evidence.executionSourceSha !== M3_R5_C3A_EXPECTED_PERFORMANCE_EXECUTION_SOURCE_SHA) errors.push("performance execution source mismatch.");
  if (evidence.selectionGateSha256 !== M3_R5_ROUND_005_SELECTION_GATE_SHA256) errors.push("selection Gate SHA mismatch.");
  if (evidence.experimentPlanSha256 !== M3_R5_ROUND_005_PLAN_SHA256) errors.push("experiment Plan SHA mismatch.");
  if (evidence.strategyVersion !== "baseline-001" || evidence.backtestPolicyVersion !== "bt-policy-003") errors.push("strategy or backtest policy mismatch.");
  if (evidence.controlReportSchemaVersion !== M3_R5_ROUND_005_CONTROL_REPORT_SCHEMA_VERSION) errors.push("control report schema mismatch.");
  if (evidence.dataClassification !== M3_R5_ROUND_005_DATA_CLASSIFICATION) errors.push("data classification mismatch.");
  if (evidence.performanceLock !== M3_R5_ROUND_005_PERFORMANCE_LOCK || evidence.performanceLockTriggered !== true) errors.push("performance lock is not triggered.");
  if (evidence.performanceLifecycle !== undefined && evidence.performanceLifecycle !== "PERFORMANCE_LOCKED") errors.push("performance lifecycle is invalid.");
  if (evidence.evidenceStatus !== "COMPLETE") errors.push("evidenceStatus is not COMPLETE.");
  if (!Array.isArray(evidence.integrityErrors) || evidence.integrityErrors.length !== 0) errors.push("integrityErrors is not empty.");
  if (evidence.selectionApplied !== false || evidence.selectedCandidateId !== null) errors.push("selection has already been applied.");
  if (stableStringify(evidence.candidateRegistry) !== stableStringify(M3_R5_ROUND_005_CANDIDATE_IDS)) errors.push("candidate registry mismatch.");
  if (stableStringify(evidence.excludedCandidates) !== stableStringify(M3_R5_ROUND_005_EXCLUDED_CANDIDATES)) errors.push("excluded-candidate registry mismatch.");
  if (!sameRange(evidence.researchUniverse, expectedResearchUniverse())) errors.push("research universe mismatch.");
  if (!isRecord(evidence.control)) errors.push("CONTROL is missing.");
  if (!Array.isArray(evidence.candidates) || evidence.candidates.length !== M3_R5_ROUND_005_CANDIDATE_IDS.length) errors.push("candidate list is incomplete.");
  if (isRecord(evidence.control)) validateCandidate(evidence.control, M3_R5_ROUND_005_CONTROL_ID, "control", errors);
  if (Array.isArray(evidence.candidates)) {
    for (const [index, candidateId] of M3_R5_ROUND_005_CANDIDATE_IDS.entries()) validateCandidate(evidence.candidates[index], candidateId, `candidates[${index}]`, errors);
  }
  if (!isSha256(inputHashes.summary) || !isSha256(inputHashes.audit) || !isSha256(inputHashes.results)) errors.push("input evidence hashes are invalid.");
  return errors.length === 0
    ? { status: "COMPLETE", errors: Object.freeze([]), evidence: evidence as SummaryEvidence }
    : { status: "INCOMPLETE_EVIDENCE", errors: Object.freeze([...errors]) };
}

function passesAtLeast(actual: number | null, threshold: number): boolean {
  return actual !== null && isFiniteNumber(actual) && actual >= threshold;
}

function passesAtMost(actual: number | null, threshold: number): boolean {
  return actual !== null && isFiniteNumber(actual) && actual <= threshold;
}

function aggregateImprovement(candidate: SummaryCandidate, control: SummaryCandidate): number | null {
  const candidateValue = candidate.aggregateValidation.diagnostics.expectancyR;
  const controlValue = control.aggregateValidation.diagnostics.expectancyR;
  return candidateValue === null || controlValue === null ? null : candidateValue - controlValue;
}

function improvedValidationFoldCount(candidate: SummaryCandidate, control: SummaryCandidate, sampleFloor: number, deltaFloor: number): number {
  return FOLD_IDS.reduce((count, foldId) => {
    const candidateFold = candidate.folds.find((fold) => fold.foldId === foldId)!.validation.diagnostics;
    const controlFold = control.folds.find((fold) => fold.foldId === foldId)!.validation.diagnostics;
    const delta = candidateFold.expectancyR === null || controlFold.expectancyR === null ? null : candidateFold.expectancyR - controlFold.expectancyR;
    return candidateFold.executedTrades >= sampleFloor && controlFold.executedTrades >= sampleFloor && delta !== null && delta >= deltaFloor ? count + 1 : count;
  }, 0);
}

function catastrophicFoldCount(candidate: SummaryCandidate, sampleFloor: number): number {
  const definition = M3_R5_ROUND_005_DEFINITIONS.catastrophicFold;
  return candidate.folds.filter((fold) => {
    const diagnostics = fold.validation.diagnostics;
    return (diagnostics.expectancyR !== null && diagnostics.expectancyR <= definition.expectancyRAtMost)
      || (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < definition.normalProfitFactorBelow)
      || diagnostics.profitFactorStatus === "NO_TRADES"
      || diagnostics.executedTrades < sampleFloor;
  }).length;
}

function gateResult(gateId: M3R5C3AGateId, actualValue: GateActualValue, status: M3R5C3AGateStatus, applicability: M3R5C3AGateApplicability): M3R5C3AGateResult {
  const gate = M3_R5_PLAN_GATES[gateId];
  return Object.freeze({ gateId, applicability, actualValue, threshold: gate.value, comparison: gate.comparison as "AT_LEAST" | "AT_MOST", status });
}

const M3_R5_PLAN_GATES = M3_R5_ROUND_005_SELECTION_GATES;

function evaluateCandidate(candidate: SummaryCandidate, control: SummaryCandidate): M3R5C3ACandidateEvaluation {
  const candidateDiagnostics = candidate.aggregateValidation.diagnostics;
  const aggregateDelta = aggregateImprovement(candidate, control);
  const improved = improvedValidationFoldCount(candidate, control, M3_R5_PLAN_GATES.minimumExecutedTrades.value, M3_R5_ROUND_005_DEFINITIONS.foldImprovementDeltaR);
  const catastrophic = catastrophicFoldCount(candidate, M3_R5_PLAN_GATES.minimumExecutedTrades.value);
  const minimumFoldTrades = Math.min(...candidate.folds.map((fold) => fold.validation.diagnostics.executedTrades));
  const foldTradeActual = Object.freeze(Object.fromEntries(candidate.folds.map((fold) => [fold.foldId, fold.validation.diagnostics.executedTrades]))) as Readonly<Record<string, number>>;
  const sampleGatesPass = passesAtLeast(candidateDiagnostics.formalSignals, M3_R5_PLAN_GATES.minimumFormalSignals.value)
    && passesAtLeast(minimumFoldTrades, M3_R5_PLAN_GATES.minimumExecutedTrades.value);
  const gateResults: M3R5C3AGateResult[] = [
    gateResult("minimumAggregateImprovement", aggregateDelta, passesAtLeast(aggregateDelta, M3_R5_PLAN_GATES.minimumAggregateImprovement.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("minimumImprovedValidationFolds", improved, passesAtLeast(improved, M3_R5_PLAN_GATES.minimumImprovedValidationFolds.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("catastrophicFoldLimit", catastrophic, passesAtMost(catastrophic, M3_R5_PLAN_GATES.catastrophicFoldLimit.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("minimumNetExpectancy", candidateDiagnostics.expectancyR, passesAtLeast(candidateDiagnostics.expectancyR, M3_R5_PLAN_GATES.minimumNetExpectancy.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult(
      "minimumProfitFactor",
      candidateDiagnostics.profitFactor,
      candidateDiagnostics.profitFactorStatus === "NORMAL"
        ? passesAtLeast(candidateDiagnostics.profitFactor, M3_R5_PLAN_GATES.minimumProfitFactor.value) ? "PASS" : "FAIL"
        : candidateDiagnostics.profitFactorStatus === "NO_LOSSES" && sampleGatesPass ? "PASS" : "FAIL",
      "REQUIRED",
    ),
    gateResult("maximumSymbolConcentration", candidateDiagnostics.topSymbolShareOfPositiveNetR, passesAtMost(candidateDiagnostics.topSymbolShareOfPositiveNetR, M3_R5_PLAN_GATES.maximumSymbolConcentration.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("maximumSingleTradeConcentration", candidateDiagnostics.largestSingleTradeShareOfPositiveNetR, passesAtMost(candidateDiagnostics.largestSingleTradeShareOfPositiveNetR, M3_R5_PLAN_GATES.maximumSingleTradeConcentration.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("maximumFeeBurdenRatio", candidateDiagnostics.feeBurdenRatio, candidateDiagnostics.grossR !== null && candidateDiagnostics.grossR !== 0 && passesAtMost(candidateDiagnostics.feeBurdenRatio, M3_R5_PLAN_GATES.maximumFeeBurdenRatio.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("requiredRedundancyImprovement", null, "NOT_APPLICABLE", "NOT_APPLICABLE"),
    gateResult("minimumFormalSignals", candidateDiagnostics.formalSignals, passesAtLeast(candidateDiagnostics.formalSignals, M3_R5_PLAN_GATES.minimumFormalSignals.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("minimumExecutedTrades", foldTradeActual, passesAtLeast(minimumFoldTrades, M3_R5_PLAN_GATES.minimumExecutedTrades.value) ? "PASS" : "FAIL", "REQUIRED"),
  ];
  const failedGateIds = gateResults.filter((gate) => gate.status === "FAIL").map((gate) => gate.gateId);
  return Object.freeze({
    candidateId: candidate.candidateId,
    complexity: M3_R5_ROUND_005_COMPLEXITY_TUPLES[candidate.candidateId as keyof typeof M3_R5_ROUND_005_COMPLEXITY_TUPLES],
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
      formalSignals: candidateDiagnostics.formalSignals,
      minimumFoldExecutedTrades: minimumFoldTrades,
    }),
    gateResults: Object.freeze(gateResults),
    applicableGateCount: gateResults.filter((gate) => gate.applicability === "REQUIRED").length,
    passedApplicableGateCount: gateResults.filter((gate) => gate.applicability === "REQUIRED" && gate.status === "PASS").length,
    failedGateCount: failedGateIds.length,
    failedGateIds: Object.freeze(failedGateIds),
    eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE",
  });
}

function compareStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareComplexity(left: M3R5C3ACandidateEvaluation, right: M3R5C3ACandidateEvaluation): number {
  for (const dimension of ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"] as const) {
    if (left.complexity[dimension] !== right.complexity[dimension]) return left.complexity[dimension]! < right.complexity[dimension]! ? -1 : 1;
  }
  return 0;
}

function exceedsComplexityTieThreshold(left: number, right: number, threshold: number): boolean {
  const precision = 1_000_000_000_000;
  return Math.round(Math.abs(left - right) * precision) / precision > threshold;
}

function compareEligibleCandidates(left: M3R5C3ACandidateEvaluation, right: M3R5C3ACandidateEvaluation, tieThreshold: number): number {
  if (left.metrics.improvedValidationFoldCount !== right.metrics.improvedValidationFoldCount) return right.metrics.improvedValidationFoldCount - left.metrics.improvedValidationFoldCount;
  const leftExpectancy = left.metrics.expectancyR;
  const rightExpectancy = right.metrics.expectancyR;
  if (leftExpectancy !== null && rightExpectancy !== null && exceedsComplexityTieThreshold(leftExpectancy, rightExpectancy, tieThreshold)) return rightExpectancy > leftExpectancy ? 1 : -1;
  const complexity = compareComplexity(left, right);
  if (complexity !== 0) return complexity;
  if (left.metrics.profitFactor === null && right.metrics.profitFactor !== null) return 1;
  if (left.metrics.profitFactor !== null && right.metrics.profitFactor === null) return -1;
  if (left.metrics.profitFactor !== null && right.metrics.profitFactor !== null && left.metrics.profitFactor !== right.metrics.profitFactor) return right.metrics.profitFactor > left.metrics.profitFactor ? 1 : -1;
  return compareStrings(left.candidateId, right.candidateId);
}

function incompleteEvaluation(errors: readonly string[]): M3R5C3ASelectionEvaluation {
  return Object.freeze({ integrityStatus: "INCOMPLETE_EVIDENCE", integrityErrors: Object.freeze([...errors]), candidates: Object.freeze([]), eligibleCandidateIds: Object.freeze([]), selectionAlgorithmApplied: false, selectedCandidateId: null, finalDecision: "INCOMPLETE_EVIDENCE" });
}

export function evaluateM3R5C3ASelection(evidence: unknown, input: M3R5C3AInputHashes | string): M3R5C3ASelectionEvaluation {
  const inputHashes = typeof input === "string"
    ? { summary: input, audit: M3_R5_C3A_EXPECTED_INPUT_AUDIT_SHA256, results: M3_R5_C3A_EXPECTED_INPUT_RESULTS_SHA256 }
    : input;
  const integrity = validateSummary(evidence, inputHashes);
  if (integrity.status !== "COMPLETE" || integrity.evidence === undefined) return incompleteEvaluation(integrity.errors);
  const candidates = integrity.evidence.candidates.map((candidate) => evaluateCandidate(candidate, integrity.evidence!.control));
  const eligible = candidates.filter((candidate) => candidate.eligibility === "ELIGIBLE");
  if (eligible.length === 0) return Object.freeze({ integrityStatus: "COMPLETE", integrityErrors: Object.freeze([]), candidates: Object.freeze(candidates), eligibleCandidateIds: Object.freeze([]), selectionAlgorithmApplied: false, selectedCandidateId: null, finalDecision: M3_R5_ROUND_005_NO_CANDIDATE_OUTCOME });
  const sorted = [...eligible].sort((left, right) => compareEligibleCandidates(left, right, M3_R5_PLAN_GATES.complexityTieThreshold.value));
  return Object.freeze({ integrityStatus: "COMPLETE", integrityErrors: Object.freeze([]), candidates: Object.freeze(candidates), eligibleCandidateIds: Object.freeze(eligible.map((candidate) => candidate.candidateId)), selectionAlgorithmApplied: true, selectedCandidateId: sorted[0]!.candidateId, finalDecision: "SELECTED_BASELINE_002_CANDIDATE" });
}

export function createM3R5C3ASelectionReport(input: Readonly<{
  evidence: unknown;
  inputSummaryPath: string;
  inputHashes: M3R5C3AInputHashes;
  gateApplicationSourceSha: string;
}>): M3R5C3ASelectionReport {
  const evaluation = evaluateM3R5C3ASelection(input.evidence, input.inputHashes);
  const sourceError = isSha1(input.gateApplicationSourceSha) ? [] : ["gateApplicationSourceSha must be a 40-character lowercase Git SHA."];
  const effective = sourceError.length === 0 ? evaluation : incompleteEvaluation([...evaluation.integrityErrors, ...sourceError]);
  const performanceExecutionSourceSha = isRecord(input.evidence) && typeof input.evidence.executionSourceSha === "string" ? input.evidence.executionSourceSha : "";
  const performanceEvidenceStatus = isRecord(input.evidence) && input.evidence.evidenceStatus === "COMPLETE" ? "COMPLETE" : "INCOMPLETE";
  return Object.freeze({
    schemaVersion: M3_R5_C3A_SELECTION_SCHEMA_VERSION,
    researchRoundId: M3_R5_ROUND_005_RESEARCH_ROUND_ID,
    gateApplicationSourceSha: input.gateApplicationSourceSha,
    performanceExecutionSourceSha,
    selectionGateSha256: M3_R5_ROUND_005_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R5_ROUND_005_PLAN_SHA256,
    inputSummaryPath: input.inputSummaryPath,
    inputSummarySha256: input.inputHashes.summary,
    inputAuditPath: "docs/evidence/M3_R5_ROUND_005_AUDIT.json",
    inputAuditSha256: input.inputHashes.audit,
    inputResultsPath: "docs/M3_R5_ROUND_005_RESULTS.md",
    inputResultsSha256: input.inputHashes.results,
    performanceLock: M3_R5_ROUND_005_PERFORMANCE_LOCK,
    performanceEvidenceStatus,
    integrityStatus: effective.integrityStatus,
    integrityErrors: effective.integrityErrors,
    candidates: effective.candidates,
    eligibleCandidateIds: effective.eligibleCandidateIds,
    selectionAlgorithmApplied: effective.selectionAlgorithmApplied,
    selectedCandidateId: effective.selectedCandidateId,
    finalDecision: effective.finalDecision,
    baseline002Status: M3_R5_C3A_BASELINE_002_STATUS,
    m3JStatus: M3_R5_C3A_M3_J_STATUS,
    m4Status: M3_R5_C3A_M4_STATUS,
  });
}

export function serializeM3R5C3ASelectionReport(report: M3R5C3ASelectionReport): string {
  return `${stableStringify(report)}\n`;
}

export function sha256M3R5C3ARawBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function publishM3R5C3ASelectionOutputsAtomically(
  payloads: M3R5C3ASelectionOutputPayloads,
  options: M3R5C3APublicationOptions = {},
): void {
  const jsonPath = resolve(payloads.jsonPath);
  const markdownPath = resolve(payloads.markdownPath);
  if (existsSync(jsonPath) || existsSync(markdownPath)) throw new Error("M3-R5-C.3 selection output already exists.");
  const stagingDirectory = mkdtempSync(join(dirname(jsonPath), ".m3-r5-c3-selection-"));
  const stagedMarkdownPath = join(stagingDirectory, "M3_R5_C3_SELECTION.md");
  const stagedJsonPath = join(stagingDirectory, "M3_R5_C3_SELECTION.json");
  const publishedPaths: string[] = [];
  const rename = options.renameFile ?? renameSync;
  try {
    options.onStagingDirectory?.(stagingDirectory);
    writeFileSync(stagedMarkdownPath, Buffer.from(payloads.markdownBytes));
    writeFileSync(stagedJsonPath, Buffer.from(payloads.jsonBytes));
    rename(stagedMarkdownPath, markdownPath);
    publishedPaths.push(markdownPath);
    rename(stagedJsonPath, jsonPath);
    publishedPaths.push(jsonPath);
    rmSync(stagingDirectory, { recursive: true, force: true });
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const destination of [...publishedPaths].reverse()) {
      try {
        unlinkSync(destination);
      } catch (rollbackError) {
        rollbackErrors.push(`remove ${destination}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
    }
    try {
      rmSync(stagingDirectory, { recursive: true, force: true });
    } catch (rollbackError) {
      rollbackErrors.push(`remove staging ${stagingDirectory}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
    if (rollbackErrors.length > 0) {
      const message = `rollback errors: ${rollbackErrors.join("; ")}`;
      if (error instanceof Error) {
        error.message = `${error.message}; ${message}`;
        throw error;
      }
      throw new Error(`${String(error)}; ${message}`);
    }
    throw error;
  }
}

function display(value: number | null): string {
  return value === null ? "null" : String(value);
}

export function renderM3R5C3ASelectionMarkdown(report: M3R5C3ASelectionReport, selectionJsonSha256: string): string {
  const lines = [
    "# M3-R5-C.3 Round-005 Frozen Selection Gate Application",
    "",
    `integrityStatus: ${report.integrityStatus}`,
    `finalDecision: ${report.finalDecision}`,
    `researchRoundId: ${report.researchRoundId}`,
    `gateApplicationSourceSha: ${report.gateApplicationSourceSha}`,
    `performanceExecutionSourceSha: ${report.performanceExecutionSourceSha}`,
    `selectionGateSha256: ${report.selectionGateSha256}`,
    `experimentPlanSha256: ${report.experimentPlanSha256}`,
    `inputSummarySha256: ${report.inputSummarySha256}`,
    `inputAuditSha256: ${report.inputAuditSha256}`,
    `inputResultsSha256: ${report.inputResultsSha256}`,
    `m3R5C3ASelectionSha256: ${selectionJsonSha256}`,
    `performanceLock: ${report.performanceLock}`,
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
  lines.push("## Candidate gate matrix", "", "| candidate | aggregate improvement | improved folds | catastrophic folds | expectancy | PF | symbol concentration | single-trade concentration | fee burden | formal signals | minimum fold executed trades | applicable | passed | failed gates | eligibility |", "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |", ...report.candidates.map((candidate) => {
    const metrics = candidate.metrics;
    return `| ${candidate.candidateId} | ${display(metrics.aggregateImprovement)} | ${metrics.improvedValidationFoldCount} | ${metrics.catastrophicFoldCount} | ${display(metrics.expectancyR)} | ${metrics.profitFactorStatus ?? "null"}${metrics.profitFactor === null ? "" : ` (${metrics.profitFactor})`} | ${display(metrics.topSymbolShareOfPositiveNetR)} | ${display(metrics.largestSingleTradeShareOfPositiveNetR)} | ${display(metrics.feeBurdenRatio)} | ${display(metrics.formalSignals)} | ${display(metrics.minimumFoldExecutedTrades)} | ${candidate.applicableGateCount} | ${candidate.passedApplicableGateCount} | ${candidate.failedGateIds.length === 0 ? "none" : candidate.failedGateIds.join(", ")} | ${candidate.eligibility} |`;
  }), "", "## Gate details", "");
  for (const candidate of report.candidates) lines.push(`### ${candidate.candidateId}`, "", ...candidate.gateResults.map((gate) => `- ${gate.gateId}: ${gate.status} (${gate.applicability}; actual=${JSON.stringify(gate.actualValue)}; threshold=${gate.threshold} ${gate.comparison})`), "");
  lines.push("## Frozen boundary", "", "- All 10 applicable gates and the NOT_APPLICABLE redundancy identity are evaluated for every candidate; no early exit is used.", "- Aggregate gates use aggregate F1-F6 validation diagnostics; minimumExecutedTrades uses every individual validation fold.", "- H17 is excluded from the performance candidate registry because its qualification is DATA_NOT_AVAILABLE.", "- This C.3A implementation does not apply selection to real Round-005 evidence.", "- baseline-002 remains NOT_FROZEN.", "");
  return `${lines.join("\n")}\n`;
}

export { FOLD_IDS, M3_R5_ROUND_005_APPLICABLE_HARD_GATE_IDENTITIES, M3_R5_ROUND_005_HARD_GATE_IDENTITIES };
