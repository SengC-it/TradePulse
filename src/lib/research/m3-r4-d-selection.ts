import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
  M3_R4_ROUND_004_CANDIDATE_IDS,
  M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME,
  M3_R4_ROUND_004_PERFORMANCE_LOCK,
  M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  validateM3R4Round004MachineRecord,
} from "./selection-gates-round-004.ts";
import {
  M3_R4_ROUND_004_DATA_CLASSIFICATION,
  M3_R4_ROUND_004_PLAN,
  M3_R4_ROUND_004_PLAN_SHA256,
  M3_R4_ROUND_004_POLICY_VERSION,
  M3_R4_ROUND_004_STRATEGY_VERSION,
  validateM3R4Round004Plan,
} from "./m3-r4-round-004-plan.ts";
import { stableStringify } from "./utils.ts";

export const M3_R4_D_SELECTION_SCHEMA_VERSION = "m3-r4-d-selection-001" as const;
export const M3_R4_D_EXPECTED_PERFORMANCE_EXECUTION_SOURCE_SHA = "354401eef24b410ea5ee1c74564a9f76f0538ae9" as const;
export const M3_R4_D_EXPECTED_INPUT_SUMMARY_SHA256 =
  "3d5da8412a972e7b2d313b975244cb0843d7989e7600cd29bc50eac7a9318a53" as const;
export const M3_R4_D_EXPECTED_INPUT_AUDIT_SHA256 =
  "36e8145d0eb0c71c9b10d088023593cb0746f05fc1de0b6b6cdaadaacde7b661" as const;
export const M3_R4_D_EXPECTED_INPUT_RESULTS_SHA256 =
  "1da3a5653d79470dbf0f48bb78ab428e90a17232eb9f3ff29b8ab0341158b104" as const;
export const M3_R4_D_EXPECTED_REPORT_SCHEMA_VERSION = "m3-r4-round-004-report-001" as const;
export const M3_R4_D_EXPECTED_DECISION = "DEFER_TO_M3_R4_D_FROZEN_GATE_APPLICATION" as const;
export const M3_R4_D_BASELINE_002_STATUS = "NOT_FROZEN" as const;
export const M3_R4_D_M3_J_STATUS = "BLOCKED" as const;
export const M3_R4_D_M4_STATUS = "NOT_STARTED" as const;

const FOLD_IDS = ["F1", "F2", "F3", "F4", "F5", "F6"] as const;
const CANDIDATE_ORDER = Object.freeze(["CONTROL", ...M3_R4_ROUND_004_CANDIDATE_IDS] as const);
const VALID_STATUSES = new Set([
  "EXECUTED",
  "PERIOD_END_CENSORED",
  "ENTRY_OUTSIDE_BRACKET",
  "DATA_INCOMPLETE",
  "SETTLEMENT_AMBIGUOUS",
  "NOT_EXECUTED",
]);
const VALID_DIRECTIONS = new Set(["LONG", "SHORT"]);
const VALID_SYMBOL_REGIMES = new Set(["LONG_ONLY", "SHORT_ONLY", "NO_TRADE"]);
const VALID_BTC_REGIMES = new Set(["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"]);
const VALID_GRADES = new Set(["A", "B", "C"]);

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

const M3_R4_D_HARD_GATE_IDS = BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.hardGateIdentities as readonly HardGateId[];
const M3_R4_D_APPLICABLE_GATE_IDS = BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.applicableHardGateIdentities as readonly HardGateId[];

export type M3R4DGateStatus = "PASS" | "FAIL" | "NOT_APPLICABLE";
export type M3R4DGateApplicability = "REQUIRED" | "NOT_APPLICABLE";
export type M3R4DEligibility = "ELIGIBLE" | "INELIGIBLE";
export type M3R4DFinalDecision =
  | "SELECTED_BASELINE_002_CANDIDATE"
  | typeof M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME
  | "INCOMPLETE_EVIDENCE";

type GateActualValue = number | null | Readonly<Record<string, number>>;
type ProfitFactorStatus = "NORMAL" | "NO_TRADES" | "NO_LOSSES";

export type M3R4DDiagnostics = Readonly<{
  formalSignals: number;
  executedTrades: number;
  grossR: number;
  expectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: ProfitFactorStatus;
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
  overlappingSignalRate: number | null;
}>;

export type M3R4DGateResult = Readonly<{
  gateId: HardGateId;
  applicability: M3R4DGateApplicability;
  actualValue: GateActualValue;
  threshold: number;
  comparison: "AT_LEAST" | "AT_MOST";
  status: M3R4DGateStatus;
}>;

export type M3R4DCandidateMetrics = Readonly<{
  aggregateImprovement: number | null;
  improvedValidationFoldCount: number | null;
  catastrophicFoldCount: number | null;
  expectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: ProfitFactorStatus | null;
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  feeBurdenRatio: number | null;
  redundancyRelativeReductionVsControl: number | null;
  formalSignals: number | null;
  minimumFoldExecutedTrades: number | null;
}>;

export type M3R4DCandidateEvaluation = Readonly<{
  candidateId: string;
  complexity: Readonly<Record<string, number>>;
  metrics: M3R4DCandidateMetrics;
  gateResults: readonly M3R4DGateResult[];
  applicableGateCount: number;
  passedApplicableGateCount: number;
  failedGateCount: number;
  failedGateIds: readonly HardGateId[];
  eligibility: M3R4DEligibility;
}>;

export type M3R4DSelectionEvaluation = Readonly<{
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3R4DCandidateEvaluation[];
  eligibleCandidateIds: readonly string[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: string | null;
  finalDecision: M3R4DFinalDecision;
}>;

export type M3R4DInputHashes = Readonly<{
  summary: string;
  audit: string;
  results: string;
}>;

export type M3R4DSelectionReport = Readonly<{
  schemaVersion: typeof M3_R4_D_SELECTION_SCHEMA_VERSION;
  researchRoundId: typeof M3_R4_ROUND_004_RESEARCH_ROUND_ID;
  gateApplicationSourceSha: string;
  performanceExecutionSourceSha: string;
  selectionGateSha256: typeof BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R4_ROUND_004_PLAN_SHA256;
  inputSummaryPath: string;
  inputSummarySha256: string;
  inputAuditPath: string;
  inputAuditSha256: string;
  inputResultsPath: string;
  inputResultsSha256: string;
  performanceLock: typeof M3_R4_ROUND_004_PERFORMANCE_LOCK;
  performanceEvidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3R4DCandidateEvaluation[];
  eligibleCandidateIds: readonly string[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: string | null;
  finalDecision: M3R4DFinalDecision;
  baseline002Status: typeof M3_R4_D_BASELINE_002_STATUS;
  m3JStatus: typeof M3_R4_D_M3_J_STATUS;
  m4Status: typeof M3_R4_D_M4_STATUS;
}>;

export type M3R4DSelectionOutputPayloads = Readonly<{
  jsonPath: string;
  markdownPath: string;
  jsonBytes: Uint8Array;
  markdownBytes: Uint8Array;
}>;

export type M3R4DSelectionPublicationOptions = Readonly<{
  renameFile?: (source: string, destination: string) => void;
  onStagingDirectory?: (path: string) => void;
}>;

export type M3R4DIdentitySignal = Readonly<{
  signalTime: number;
  symbol: ResearchSymbol;
  direction: "LONG" | "SHORT";
  status: string;
}>;

type SummarySignal = M3R4DIdentitySignal & Readonly<{
  symbolRegime: string;
  btcRegime: string;
  totalScore: number;
  grade: string | null;
  status: string;
  entryTime: number | null;
  exitTime: number | null;
  grossR: number | null;
  feeR: number | null;
  fundingR: number | null;
  netR: number | null;
}>;

type SummaryFold = Readonly<{
  foldId: string;
  validation: Readonly<{
    range: Readonly<{ startTime: number; endTime: number }>;
    records: readonly SummarySignal[];
    diagnostics: M3R4DDiagnostics & Readonly<{ range: Readonly<{ startTime: number; endTime: number }> }>;
  }>;
}>;

type SummaryCandidate = Readonly<{
  candidateId: string;
  fullSeenUniverse: Readonly<{
    range: Readonly<{ startTime: number; endTime: number }>;
    records: readonly SummarySignal[];
    diagnostics: M3R4DDiagnostics & Readonly<{ range: Readonly<{ startTime: number; endTime: number }> }>;
  }>;
  folds: readonly SummaryFold[];
  aggregateValidation: Readonly<{
    segments: readonly Readonly<{ startTime: number; endTime: number }>[];
    records: readonly SummarySignal[];
    diagnostics: M3R4DDiagnostics & Readonly<{ range: Readonly<{ startTime: number; endTime: number }> }>;
  }>;
  formalIdentitySha256: string;
  executedIdentitySha256: string;
}>;

type ValidSummary = Readonly<{
  schemaVersion: string;
  researchRoundId: string;
  protocolBaseMainSha: string;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  strategyVersion: string;
  backtestPolicyVersion: string;
  dataClassification: string;
  researchUniverse: Readonly<{ startTime: number; endTime: number }>;
  performanceLock: string;
  performanceLockTriggered: boolean;
  evidenceStatus: string;
  integrityErrors: readonly unknown[];
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

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function isSha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function isFiniteOrNull(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function compareStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function symbolIndex(symbol: ResearchSymbol): number {
  return RESEARCH_SYMBOLS.indexOf(symbol);
}

function directionIndex(direction: "LONG" | "SHORT"): number {
  return direction === "LONG" ? 0 : 1;
}

function compareSignals(left: M3R4DIdentitySignal, right: M3R4DIdentitySignal): number {
  return left.signalTime - right.signalTime
    || symbolIndex(left.symbol) - symbolIndex(right.symbol)
    || directionIndex(left.direction) - directionIndex(right.direction);
}

function signalIdentity(candidateId: string, signal: M3R4DIdentitySignal): string {
  return `${candidateId}|${signal.symbol}|${signal.direction}|${signal.signalTime}`;
}

export function hashM3R4DIdentityRecords(candidateId: string, records: readonly M3R4DIdentitySignal[], executedOnly = false): string {
  const identities = [...records]
    .filter((signal) => !executedOnly || signal.status === "EXECUTED")
    .sort(compareSignals)
    .map((signal) => signalIdentity(candidateId, signal));
  return createHash("sha256").update(stableStringify(identities), "utf8").digest("hex");
}

const identityHash = hashM3R4DIdentityRecords;

function expectedResearchUniverse(): Readonly<{ startTime: number; endTime: number }> {
  return M3_R4_ROUND_004_PLAN.researchUniverse;
}

function expectedAggregateRange(): Readonly<{ startTime: number; endTime: number }> {
  return {
    startTime: getResearchFoldRoleRange("F1", "VALIDATION").startTime,
    endTime: getResearchFoldRoleRange("F6", "VALIDATION").endTime,
  };
}

function sameRange(value: unknown, expected: Readonly<{ startTime: number; endTime: number }>): boolean {
  return isRecord(value) && value.startTime === expected.startTime && value.endTime === expected.endTime;
}

function validateDiagnostics(value: unknown, path: string, expectedRange: Readonly<{ startTime: number; endTime: number }>, errors: string[]): value is M3R4DDiagnostics & Readonly<{ range: Readonly<{ startTime: number; endTime: number }> }> {
  if (!isRecord(value)) {
    errors.push(`${path} is missing.`);
    return false;
  }
  if (!sameRange(value.range, expectedRange)) errors.push(`${path}.range is not the frozen range.`);
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

function validateSignal(value: unknown, path: string, universe: Readonly<{ startTime: number; endTime: number }>, errors: string[]): value is SummarySignal {
  if (!isRecord(value)) {
    errors.push(`${path} is missing.`);
    return false;
  }
  if (typeof value.signalTime !== "number" || !Number.isSafeInteger(value.signalTime) || value.signalTime < universe.startTime || value.signalTime > universe.endTime) errors.push(`${path}.signalTime is invalid.`);
  if (typeof value.symbol !== "string" || !RESEARCH_SYMBOLS.includes(value.symbol as ResearchSymbol)) errors.push(`${path}.symbol is invalid.`);
  if (typeof value.direction !== "string" || !VALID_DIRECTIONS.has(value.direction)) errors.push(`${path}.direction is invalid.`);
  if (typeof value.symbolRegime !== "string" || !VALID_SYMBOL_REGIMES.has(value.symbolRegime)) errors.push(`${path}.symbolRegime is invalid.`);
  if (typeof value.btcRegime !== "string" || !VALID_BTC_REGIMES.has(value.btcRegime)) errors.push(`${path}.btcRegime is invalid.`);
  if (!isFiniteNumber(value.totalScore)) errors.push(`${path}.totalScore is invalid.`);
  if (value.grade !== null && (typeof value.grade !== "string" || !VALID_GRADES.has(value.grade))) errors.push(`${path}.grade is invalid.`);
  if (typeof value.status !== "string" || !VALID_STATUSES.has(value.status)) errors.push(`${path}.status is invalid.`);
  for (const key of ["entryTime", "exitTime", "grossR", "feeR", "fundingR", "netR"] as const) {
    if (!isFiniteOrNull(value[key])) errors.push(`${path}.${key} is invalid.`);
  }
  return true;
}

function validateRecordSet(value: unknown, path: string, universe: Readonly<{ startTime: number; endTime: number }>, errors: string[]): value is readonly SummarySignal[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return false;
  }
  const identities = new Set<string>();
  let valid = true;
  for (const [index, signal] of value.entries()) {
    valid = validateSignal(signal, `${path}[${index}]`, universe, errors) && valid;
    if (isRecord(signal)) {
      const symbol = signal.symbol;
      const direction = signal.direction;
      const signalTime = signal.signalTime;
      if (typeof symbol !== "string" || typeof direction !== "string" || !Number.isSafeInteger(signalTime)) continue;
      const identity = `${symbol}|${direction}|${signalTime}`;
      if (identities.has(identity)) errors.push(`${path} contains duplicate identity ${identity}.`);
      identities.add(identity);
    }
  }
  return valid;
}

function sameIdentitySet(left: readonly SummarySignal[], right: readonly SummarySignal[], candidateId: string): boolean {
  const a = new Set(left.map((signal) => signalIdentity(candidateId, signal)));
  const b = new Set(right.map((signal) => signalIdentity(candidateId, signal)));
  return a.size === b.size && [...a].every((identity) => b.has(identity));
}

function expectedRecordsForRange(records: readonly SummarySignal[], range: Readonly<{ startTime: number; endTime: number }>): readonly SummarySignal[] {
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
  let fullValid = false;
  let fullRecords: readonly SummarySignal[] = [];
  if (!isRecord(full)) {
    errors.push(`${path}.fullSeenUniverse is missing.`);
  } else {
    if (!sameRange(full.range, universe)) errors.push(`${path}.fullSeenUniverse.range mismatch.`);
    fullValid = validateRecordSet(full.records, `${path}.fullSeenUniverse.records`, universe, errors);
    if (fullValid) fullRecords = full.records as readonly SummarySignal[];
    validateDiagnostics(full.diagnostics, `${path}.fullSeenUniverse.diagnostics`, universe, errors);
  }
  const folds = value.folds;
  let foldsValid = false;
  if (!Array.isArray(folds) || folds.length !== FOLD_IDS.length) {
    errors.push(`${path}.folds must contain exactly F1-F6.`);
  } else {
    foldsValid = true;
    for (const [index, fold] of folds.entries()) {
      const foldPath = `${path}.folds[${index}]`;
      const expectedFoldId = FOLD_IDS[index]!;
      if (!isRecord(fold)) {
        errors.push(`${foldPath} is missing.`);
        foldsValid = false;
        continue;
      }
      if (fold.foldId !== expectedFoldId) errors.push(`${foldPath}.foldId mismatch.`);
      const expectedRange = getResearchFoldRoleRange(expectedFoldId, "VALIDATION");
      const validation = fold.validation;
      if (!isRecord(validation)) {
        errors.push(`${foldPath}.validation is missing.`);
        foldsValid = false;
        continue;
      }
      if (!sameRange(validation.range, expectedRange)) errors.push(`${foldPath}.validation.range mismatch.`);
      const validRecords = validateRecordSet(validation.records, `${foldPath}.validation.records`, universe, errors);
      validateDiagnostics(validation.diagnostics, `${foldPath}.validation.diagnostics`, expectedRange, errors);
      if (validRecords && fullValid && !sameIdentitySet(validation.records as readonly SummarySignal[], expectedRecordsForRange(fullRecords, expectedRange), expectedId)) {
        errors.push(`${foldPath}.validation.records do not match the frozen fold range.`);
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
    aggregateValid = validateRecordSet(aggregate.records, `${path}.aggregateValidation.records`, universe, errors);
    validateDiagnostics(aggregate.diagnostics, `${path}.aggregateValidation.diagnostics`, expectedAggregateRange(), errors);
    if (aggregateValid && fullValid) {
      const expected = fullRecords.filter((signal) => expectedSegments.some((range) => signal.signalTime >= range.startTime && signal.signalTime <= range.endTime));
      if (!sameIdentitySet(aggregate.records as readonly SummarySignal[], expected, expectedId)) errors.push(`${path}.aggregateValidation.records do not match F1-F6 validation construction.`);
    }
  }
  if (!isSha256(value.formalIdentitySha256) || !isSha256(value.executedIdentitySha256)) {
    errors.push(`${path} identity hash is invalid.`);
  } else if (fullValid) {
    if (value.formalIdentitySha256 !== identityHash(expectedId, fullRecords)) errors.push(`${path}.formalIdentitySha256 provenance mismatch.`);
    if (value.executedIdentitySha256 !== identityHash(expectedId, fullRecords, true)) errors.push(`${path}.executedIdentitySha256 provenance mismatch.`);
  }
  return fullValid && foldsValid && aggregateValid;
}

function validateSummary(evidence: unknown, inputHashes: M3R4DInputHashes): { status: "COMPLETE" | "INCOMPLETE_EVIDENCE"; errors: readonly string[]; evidence?: ValidSummary } {
  const errors: string[] = [];
  if (inputHashes.summary !== M3_R4_D_EXPECTED_INPUT_SUMMARY_SHA256) errors.push("input summary SHA-256 mismatch.");
  if (inputHashes.audit !== M3_R4_D_EXPECTED_INPUT_AUDIT_SHA256) errors.push("input audit SHA-256 mismatch.");
  if (inputHashes.results !== M3_R4_D_EXPECTED_INPUT_RESULTS_SHA256) errors.push("input results SHA-256 mismatch.");
  try {
    validateM3R4Round004MachineRecord();
    validateM3R4Round004Plan();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Round-004 Gate or Plan validation failed.");
  }
  if (!isRecord(evidence)) return { status: "INCOMPLETE_EVIDENCE", errors: Object.freeze([...errors, "summary is not an object."]) };
  const exactStrings: readonly [string, unknown, string][] = [
    ["schemaVersion", evidence.schemaVersion, M3_R4_D_EXPECTED_REPORT_SCHEMA_VERSION],
    ["researchRoundId", evidence.researchRoundId, M3_R4_ROUND_004_RESEARCH_ROUND_ID],
    ["selectionGateSha256", evidence.selectionGateSha256, BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256],
    ["experimentPlanSha256", evidence.experimentPlanSha256, M3_R4_ROUND_004_PLAN_SHA256],
    ["executionSourceSha", evidence.executionSourceSha, M3_R4_D_EXPECTED_PERFORMANCE_EXECUTION_SOURCE_SHA],
    ["strategyVersion", evidence.strategyVersion, M3_R4_ROUND_004_STRATEGY_VERSION],
    ["backtestPolicyVersion", evidence.backtestPolicyVersion, M3_R4_ROUND_004_POLICY_VERSION],
    ["dataClassification", evidence.dataClassification, M3_R4_ROUND_004_DATA_CLASSIFICATION],
    ["performanceLock", evidence.performanceLock, M3_R4_ROUND_004_PERFORMANCE_LOCK],
    ["decision", evidence.decision, M3_R4_D_EXPECTED_DECISION],
  ];
  for (const [field, actual, expected] of exactStrings) if (actual !== expected) errors.push(`${field} mismatch.`);
  if (!isSha1(evidence.protocolBaseMainSha)) errors.push("protocolBaseMainSha is invalid.");
  if (evidence.performanceLockTriggered !== true) errors.push("performanceLockTriggered must be true.");
  if (evidence.evidenceStatus !== "COMPLETE") errors.push("evidenceStatus is not COMPLETE.");
  if (!Array.isArray(evidence.integrityErrors) || evidence.integrityErrors.length !== 0) errors.push("integrityErrors must be empty.");
  if (!isRecord(evidence.researchUniverse) || !sameRange(evidence.researchUniverse, expectedResearchUniverse())) errors.push("researchUniverse mismatch.");
  if (!isSha256(evidence.auditArtifactSha256)) errors.push("auditArtifactSha256 is invalid.");

  const controlValue = evidence.control;
  let controlValid = false;
  if (validateCandidate(controlValue, "CONTROL", "control", errors)) controlValid = true;
  const candidateValues = evidence.candidates;
  const candidateValid: SummaryCandidate[] = [];
  if (!Array.isArray(candidateValues) || candidateValues.length !== M3_R4_ROUND_004_CANDIDATE_IDS.length) {
    errors.push("candidate count must be exactly four.");
  } else {
    for (const [index, expectedId] of M3_R4_ROUND_004_CANDIDATE_IDS.entries()) {
      const candidate = candidateValues[index];
      if (validateCandidate(candidate, expectedId, `candidate ${expectedId}`, errors)) candidateValid.push(candidate);
    }
  }
  if (errors.length > 0 || !controlValid || candidateValid.length !== M3_R4_ROUND_004_CANDIDATE_IDS.length) {
    return { status: "INCOMPLETE_EVIDENCE", errors: Object.freeze(errors) };
  }
  return {
    status: "COMPLETE",
    errors: Object.freeze([]),
    evidence: { ...evidence, control: controlValue, candidates: candidateValid } as unknown as ValidSummary,
  };
}

function normalizeInputHashes(input: M3R4DInputHashes | string): M3R4DInputHashes {
  return typeof input === "string"
    ? { summary: input, audit: M3_R4_D_EXPECTED_INPUT_AUDIT_SHA256, results: M3_R4_D_EXPECTED_INPUT_RESULTS_SHA256 }
    : input;
}

function passesAtLeast(actual: number | null, threshold: number): boolean {
  return actual !== null && isFiniteNumber(actual) && actual >= threshold;
}

function passesAtMost(actual: number | null, threshold: number): boolean {
  return actual !== null && isFiniteNumber(actual) && actual <= threshold;
}

function aggregateImprovement(candidate: SummaryCandidate, control: SummaryCandidate): number | null {
  const candidateExpectancy = candidate.aggregateValidation.diagnostics.expectancyR;
  const controlExpectancy = control.aggregateValidation.diagnostics.expectancyR;
  return candidateExpectancy === null || controlExpectancy === null ? null : candidateExpectancy - controlExpectancy;
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
  const catastrophic = BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS.catastrophicFold;
  return candidate.folds.filter((fold) => {
    const diagnostics = fold.validation.diagnostics;
    return (diagnostics.expectancyR !== null && diagnostics.expectancyR <= catastrophic.expectancyRAtMost)
      || (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < catastrophic.normalProfitFactorBelow)
      || diagnostics.profitFactorStatus === "NO_TRADES"
      || diagnostics.executedTrades < sampleFloor;
  }).length;
}

function gateResult(gateId: HardGateId, actualValue: GateActualValue, status: M3R4DGateStatus, applicability: M3R4DGateApplicability): M3R4DGateResult {
  const gate = BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD.selectionGates[gateId];
  return Object.freeze({ gateId, applicability, actualValue, threshold: gate.value, comparison: gate.comparison as "AT_LEAST" | "AT_MOST", status });
}

function evaluateCandidate(candidate: SummaryCandidate, control: SummaryCandidate): M3R4DCandidateEvaluation {
  const gates = BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD.selectionGates;
  const definitions = BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS;
  const candidateDiagnostics = candidate.aggregateValidation.diagnostics;
  const aggregateDelta = aggregateImprovement(candidate, control);
  const improved = improvedValidationFoldCount(candidate, control, gates.minimumExecutedTrades.value, definitions.foldImprovementDeltaR);
  const catastrophic = catastrophicFoldCount(candidate, gates.minimumExecutedTrades.value);
  const minimumFoldTrades = Math.min(...candidate.folds.map((fold) => fold.validation.diagnostics.executedTrades));
  const foldTradeActual = Object.freeze(Object.fromEntries(candidate.folds.map((fold) => [fold.foldId, fold.validation.diagnostics.executedTrades]))) as Readonly<Record<string, number>>;
  const sampleGatesPass = passesAtLeast(candidateDiagnostics.formalSignals, gates.minimumFormalSignals.value) && passesAtLeast(minimumFoldTrades, gates.minimumExecutedTrades.value);
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
    gateResult("maximumFeeBurdenRatio", candidateDiagnostics.feeBurdenRatio, candidateDiagnostics.grossR !== 0 && passesAtMost(candidateDiagnostics.feeBurdenRatio, gates.maximumFeeBurdenRatio.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("requiredRedundancyImprovement", null, "NOT_APPLICABLE", "NOT_APPLICABLE"),
    gateResult("minimumFormalSignals", candidateDiagnostics.formalSignals, passesAtLeast(candidateDiagnostics.formalSignals, gates.minimumFormalSignals.value) ? "PASS" : "FAIL", "REQUIRED"),
    gateResult("minimumExecutedTrades", foldTradeActual, passesAtLeast(minimumFoldTrades, gates.minimumExecutedTrades.value) ? "PASS" : "FAIL", "REQUIRED"),
  ] as const;
  const failedGateIds = gateResults.filter((gate) => gate.status === "FAIL").map((gate) => gate.gateId);
  const complexity = (M3_R4_ROUND_004_PLAN.complexityTuples as Readonly<Record<string, Readonly<Record<string, number>>>>)[candidate.candidateId]!;
  return Object.freeze({
    candidateId: candidate.candidateId,
    complexity,
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
    applicableGateCount: gateResults.filter((gate) => gate.applicability === "REQUIRED").length,
    passedApplicableGateCount: gateResults.filter((gate) => gate.applicability === "REQUIRED" && gate.status === "PASS").length,
    failedGateCount: failedGateIds.length,
    failedGateIds: Object.freeze([...failedGateIds]),
    eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE",
  });
}

function compareComplexity(left: M3R4DCandidateEvaluation, right: M3R4DCandidateEvaluation): number {
  for (const dimension of ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"] as const) {
    if (left.complexity[dimension] !== right.complexity[dimension]) return left.complexity[dimension] < right.complexity[dimension] ? -1 : 1;
  }
  return 0;
}

function compareEligibleCandidates(left: M3R4DCandidateEvaluation, right: M3R4DCandidateEvaluation, tieThreshold: number): number {
  if (left.metrics.improvedValidationFoldCount !== right.metrics.improvedValidationFoldCount) return right.metrics.improvedValidationFoldCount! - left.metrics.improvedValidationFoldCount!;
  const expectancyDifference = right.metrics.expectancyR! - left.metrics.expectancyR!;
  const tieComparisonTolerance = Number.EPSILON * Math.max(1, Math.abs(expectancyDifference), Math.abs(tieThreshold));
  if (Math.abs(expectancyDifference) - tieThreshold > tieComparisonTolerance) return expectancyDifference > 0 ? 1 : -1;
  const complexityDifference = compareComplexity(left, right);
  if (complexityDifference !== 0) return complexityDifference;
  const leftPf = left.metrics.profitFactor;
  const rightPf = right.metrics.profitFactor;
  if (leftPf === null && rightPf !== null) return 1;
  if (leftPf !== null && rightPf === null) return -1;
  if (leftPf !== null && rightPf !== null && leftPf !== rightPf) return rightPf > leftPf ? 1 : -1;
  return compareStrings(left.candidateId, right.candidateId);
}

function incompleteEvaluation(errors: readonly string[]): M3R4DSelectionEvaluation {
  return Object.freeze({ integrityStatus: "INCOMPLETE_EVIDENCE", integrityErrors: Object.freeze([...errors]), candidates: Object.freeze([]), eligibleCandidateIds: Object.freeze([]), selectionAlgorithmApplied: false, selectedCandidateId: null, finalDecision: "INCOMPLETE_EVIDENCE" });
}

export function evaluateM3R4DSelection(evidence: unknown, input: M3R4DInputHashes | string): M3R4DSelectionEvaluation {
  const integrity = validateSummary(evidence, normalizeInputHashes(input));
  if (integrity.status !== "COMPLETE" || integrity.evidence === undefined) return incompleteEvaluation(integrity.errors);
  const candidates = integrity.evidence.candidates.map((candidate) => evaluateCandidate(candidate, integrity.evidence!.control));
  const eligible = candidates.filter((candidate) => candidate.eligibility === "ELIGIBLE");
  if (eligible.length === 0) return Object.freeze({ integrityStatus: "COMPLETE", integrityErrors: Object.freeze([]), candidates: Object.freeze(candidates), eligibleCandidateIds: Object.freeze([]), selectionAlgorithmApplied: false, selectedCandidateId: null, finalDecision: M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME });
  const eligibleCandidateIds = eligible.map((candidate) => candidate.candidateId);
  const sorted = [...eligible].sort((left, right) => compareEligibleCandidates(left, right, BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD.selectionGates.complexityTieThreshold.value));
  return Object.freeze({ integrityStatus: "COMPLETE", integrityErrors: Object.freeze([]), candidates: Object.freeze(candidates), eligibleCandidateIds: Object.freeze(eligibleCandidateIds), selectionAlgorithmApplied: true, selectedCandidateId: sorted[0]!.candidateId, finalDecision: "SELECTED_BASELINE_002_CANDIDATE" });
}

export function createM3R4DSelectionReport(input: Readonly<{
  evidence: unknown;
  inputSummaryPath: string;
  inputHashes: M3R4DInputHashes;
  gateApplicationSourceSha: string;
}>): M3R4DSelectionReport {
  const evaluation = evaluateM3R4DSelection(input.evidence, input.inputHashes);
  const gateSourceErrors = isSha1(input.gateApplicationSourceSha)
    ? []
    : ["gateApplicationSourceSha must be a 40-character lowercase Git SHA."];
  const effectiveEvaluation = gateSourceErrors.length === 0
    ? evaluation
    : incompleteEvaluation([...evaluation.integrityErrors, ...gateSourceErrors]);
  const performanceExecutionSourceSha = isRecord(input.evidence) && typeof input.evidence.executionSourceSha === "string" ? input.evidence.executionSourceSha : "";
  const performanceEvidenceStatus = isRecord(input.evidence) && input.evidence.evidenceStatus === "COMPLETE" ? "COMPLETE" : "INCOMPLETE";
  return Object.freeze({
    schemaVersion: M3_R4_D_SELECTION_SCHEMA_VERSION,
    researchRoundId: M3_R4_ROUND_004_RESEARCH_ROUND_ID,
    gateApplicationSourceSha: input.gateApplicationSourceSha,
    performanceExecutionSourceSha,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R4_ROUND_004_PLAN_SHA256,
    inputSummaryPath: input.inputSummaryPath,
    inputSummarySha256: input.inputHashes.summary,
    inputAuditPath: "docs/evidence/M3_R4_ROUND_004_AUDIT.json",
    inputAuditSha256: input.inputHashes.audit,
    inputResultsPath: "docs/M3_R4_ROUND_004_RESULTS.md",
    inputResultsSha256: input.inputHashes.results,
    performanceLock: M3_R4_ROUND_004_PERFORMANCE_LOCK,
    performanceEvidenceStatus,
    integrityStatus: effectiveEvaluation.integrityStatus,
    integrityErrors: effectiveEvaluation.integrityErrors,
    candidates: effectiveEvaluation.candidates,
    eligibleCandidateIds: effectiveEvaluation.eligibleCandidateIds,
    selectionAlgorithmApplied: effectiveEvaluation.selectionAlgorithmApplied,
    selectedCandidateId: effectiveEvaluation.selectedCandidateId,
    finalDecision: effectiveEvaluation.finalDecision,
    baseline002Status: M3_R4_D_BASELINE_002_STATUS,
    m3JStatus: M3_R4_D_M3_J_STATUS,
    m4Status: M3_R4_D_M4_STATUS,
  });
}

export function serializeM3R4DSelectionReport(report: M3R4DSelectionReport): string {
  return `${stableStringify(report)}\n`;
}

export function sha256M3R4DSelectionRawBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function publishM3R4DSelectionOutputsAtomically(
  payloads: M3R4DSelectionOutputPayloads,
  options: M3R4DSelectionPublicationOptions = {},
): void {
  const jsonPath = resolve(payloads.jsonPath);
  const markdownPath = resolve(payloads.markdownPath);
  if (existsSync(jsonPath) || existsSync(markdownPath)) throw new Error("M3-R4-D selection output already exists.");

  const stagingDirectory = mkdtempSync(join(dirname(jsonPath), ".m3-r4-d-selection-"));
  const stagedMarkdownPath = join(stagingDirectory, "M3_R4_D_SELECTION.md");
  const stagedJsonPath = join(stagingDirectory, "M3_R4_D_SELECTION.json");
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
      const rollbackMessage = `rollback errors: ${rollbackErrors.join("; ")}`;
      if (error instanceof Error) {
        error.message = `${error.message}; ${rollbackMessage}`;
        throw error;
      }
      throw new Error(`${String(error)}; ${rollbackMessage}`);
    }
    throw error;
  }
}

function display(value: number | null): string {
  return value === null ? "null" : String(value);
}

export function renderM3R4DSelectionMarkdown(report: M3R4DSelectionReport, selectionJsonSha256: string): string {
  const lines = [
    "# M3-R4-D Round-004 Frozen Gate Application",
    "",
    `integrityStatus: ${report.integrityStatus}`,
    `finalDecision: ${report.finalDecision}`,
    `researchRoundId: ${report.researchRoundId}`,
    `gateApplicationSourceSha: ${report.gateApplicationSourceSha}`,
    `performanceExecutionSourceSha: ${report.performanceExecutionSourceSha}`,
    `selectionGateSha256: ${report.selectionGateSha256}`,
    `experimentPlanSha256: ${report.experimentPlanSha256}`,
    `inputSummaryPath: ${report.inputSummaryPath}`,
    `inputSummarySha256: ${report.inputSummarySha256}`,
    `inputAuditSha256: ${report.inputAuditSha256}`,
    `inputResultsSha256: ${report.inputResultsSha256}`,
    `m3R4DSelectionSha256: ${selectionJsonSha256}`,
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
  lines.push("## Candidate gate matrix", "", "| candidate | aggregate improvement | improved folds | catastrophic folds | expectancy | PF | symbol concentration | single-trade concentration | fee burden | formal signals | minimum fold executed trades | applicable | passed | failed gates | eligibility |", "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |");
  for (const candidate of report.candidates) {
    const metrics = candidate.metrics;
    lines.push(`| ${candidate.candidateId} | ${display(metrics.aggregateImprovement)} | ${display(metrics.improvedValidationFoldCount)} | ${display(metrics.catastrophicFoldCount)} | ${display(metrics.expectancyR)} | ${metrics.profitFactorStatus ?? "null"}${metrics.profitFactor === null ? "" : ` (${metrics.profitFactor})`} | ${display(metrics.topSymbolShareOfPositiveNetR)} | ${display(metrics.largestSingleTradeShareOfPositiveNetR)} | ${display(metrics.feeBurdenRatio)} | ${display(metrics.formalSignals)} | ${display(metrics.minimumFoldExecutedTrades)} | ${candidate.applicableGateCount} | ${candidate.passedApplicableGateCount} | ${candidate.failedGateIds.length === 0 ? "none" : candidate.failedGateIds.join(", ")} | ${candidate.eligibility} |`);
  }
  lines.push("", "## Gate details", "");
  for (const candidate of report.candidates) lines.push(`### ${candidate.candidateId}`, "", ...candidate.gateResults.map((gate) => `- ${gate.gateId}: ${gate.status} (${gate.applicability}; actual=${JSON.stringify(gate.actualValue)}; threshold=${gate.threshold} ${gate.comparison})`), "");
  lines.push("## Frozen boundary", "", "- All four candidates were evaluated and all eleven gate identities were evaluated for every candidate; no early exit was used.", "- Aggregate gates use aggregate F1-F6 validation diagnostics; minimumExecutedTrades uses every individual validation fold.", "- requiredRedundancyImprovement is NOT_APPLICABLE and is excluded from the eligibility conjunction.", "- Complexity tuples are copied from the frozen Round-004 Plan and are not inferred from evidence.", "- baseline-002 remains NOT_FROZEN.", "");
  return `${lines.join("\n")}\n`;
}

export { CANDIDATE_ORDER, M3_R4_D_APPLICABLE_GATE_IDS, M3_R4_D_HARD_GATE_IDS };
