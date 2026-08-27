import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  M3_R6_ROUND_006_DEFINITIONS,
  M3_R6_ROUND_006_MACHINE_RECORD,
  M3_R6_ROUND_006_SELECTION_GATES,
  M3_R6_ROUND_006_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_CANDIDATE_IDS,
  type M3R6CandidateGateEvaluation,
  type M3R6CandidateGateInput,
  type M3R6SelectionCandidate,
  selectM3R6Candidate,
  evaluateM3R6CandidateGates,
} from "./selection-gates-round-006.ts";
import {
  M3_R6_ROUND_006_PLAN_SHA256,
} from "./m3-r6-round-006-plan.ts";
import {
  M3_R6_RESEARCH_ROUND_ID,
  type R6CandidateId,
} from "./m3-r6-round-006-protocol.ts";
import type { ResearchDiagnostics } from "./types.ts";
import type { Round006CandidateEvidence, Round006Report } from "./m3-r6-round-006-performance.ts";
import { stableStringify } from "./utils.ts";

export const M3_R6_ROUND_006_SELECTION_SCHEMA_VERSION = "m3-r6-round-006-selection-001" as const;
export const M3_R6_ROUND_006_SELECTION_OUTPUT_JSON_PATH = "docs/evidence/M3_R6_ROUND_006_SELECTION.json" as const;
export const M3_R6_ROUND_006_SELECTION_OUTPUT_MARKDOWN_PATH = "docs/research/round-006-selection.md" as const;
export const M3_R6_ROUND_006_SELECTION_INPUT_SUMMARY_PATH = "docs/evidence/M3_R6_ROUND_006_SUMMARY.json" as const;
export const M3_R6_ROUND_006_SELECTION_INPUT_AUDIT_PATH = "docs/evidence/M3_R6_ROUND_006_AUDIT.json" as const;
export const M3_R6_ROUND_006_SELECTION_INPUT_RESULTS_PATH = "docs/M3_R6_ROUND_006_RESULTS.md" as const;

export type Round006SelectionReport = Readonly<{
  schemaVersion: typeof M3_R6_ROUND_006_SELECTION_SCHEMA_VERSION;
  researchRoundId: typeof M3_R6_RESEARCH_ROUND_ID;
  gateApplicationSourceSha: string;
  performanceExecutionSourceSha: string;
  selectionGateSha256: typeof M3_R6_ROUND_006_SELECTION_GATE_SHA256;
  experimentPlanSha256: typeof M3_R6_ROUND_006_PLAN_SHA256;
  inputSummaryPath: string;
  inputSummarySha256: string;
  inputAuditPath: string;
  inputAuditSha256: string;
  inputResultsPath: string;
  inputResultsSha256: string;
  performanceLock: "FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED";
  performanceEvidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE";
  integrityErrors: readonly string[];
  candidates: readonly M3R6CandidateGateEvaluation[];
  eligibleCandidateIds: readonly R6CandidateId[];
  selectionAlgorithmApplied: boolean;
  selectedCandidateId: R6CandidateId | null;
  finalDecision: string;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha(value: string): boolean {
  return /^[0-9a-f]{40}$/u.test(value);
}

function rawSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function diagnosticsOf(candidate: Round006CandidateEvidence): ResearchDiagnostics {
  return candidate.aggregateValidation.diagnostics;
}

function improvedValidationFolds(candidate: Round006CandidateEvidence, control: Round006CandidateEvidence): number {
  const minimumTrades = M3_R6_ROUND_006_SELECTION_GATES.minimumExecutedTrades.value;
  const delta = M3_R6_ROUND_006_DEFINITIONS.foldImprovementDeltaR;
  return candidate.folds.reduce((count, fold, index) => {
    const controlFold = control.folds[index];
    if (!controlFold) return count;
    const candidateDiagnostics = fold.validation.diagnostics;
    const controlDiagnostics = controlFold.validation.diagnostics;
    return candidateDiagnostics.executedTrades >= minimumTrades
      && controlDiagnostics.executedTrades >= minimumTrades
      && candidateDiagnostics.expectancyR !== null
      && controlDiagnostics.expectancyR !== null
      && candidateDiagnostics.expectancyR - controlDiagnostics.expectancyR >= delta
      ? count + 1
      : count;
  }, 0);
}

function catastrophicFolds(candidate: Round006CandidateEvidence): number {
  const definition = M3_R6_ROUND_006_DEFINITIONS.catastrophicFold;
  const minimumTrades = M3_R6_ROUND_006_SELECTION_GATES.minimumExecutedTrades.value;
  return candidate.folds.filter((fold) => {
    const diagnostics = fold.validation.diagnostics;
    return (diagnostics.expectancyR !== null && diagnostics.expectancyR <= definition.expectancyRAtMost)
      || (diagnostics.profitFactorStatus === "NORMAL" && diagnostics.profitFactor !== null && diagnostics.profitFactor < definition.normalProfitFactorBelow)
      || diagnostics.profitFactorStatus === "NO_TRADES"
      || diagnostics.executedTrades < minimumTrades;
  }).length;
}

function gateInput(candidate: Round006CandidateEvidence, control: Round006CandidateEvidence): M3R6CandidateGateInput {
  const candidateDiagnostics = diagnosticsOf(candidate);
  const controlDiagnostics = diagnosticsOf(control);
  const aggregateImprovement = candidateDiagnostics.expectancyR === null || controlDiagnostics.expectancyR === null
    ? null
    : candidateDiagnostics.expectancyR - controlDiagnostics.expectancyR;
  const redundancyImprovement = candidateDiagnostics.overlappingSignalRate === null
    || controlDiagnostics.overlappingSignalRate === null
    ? null
    : controlDiagnostics.overlappingSignalRate === 0
      ? (candidateDiagnostics.overlappingSignalRate === 0 ? 0 : null)
      : (controlDiagnostics.overlappingSignalRate - candidateDiagnostics.overlappingSignalRate)
        / controlDiagnostics.overlappingSignalRate;
  return Object.freeze({
    candidateId: candidate.candidateId as R6CandidateId,
    resultStatus: candidate.resultStatus,
    aggregateImprovement,
    improvedValidationFolds: improvedValidationFolds(candidate, control),
    catastrophicFolds: catastrophicFolds(candidate),
    netExpectancyR: candidateDiagnostics.expectancyR,
    profitFactor: candidateDiagnostics.profitFactor,
    profitFactorStatus: candidateDiagnostics.profitFactorStatus,
    topSymbolShareOfPositiveNetR: candidateDiagnostics.topSymbolShareOfPositiveNetR,
    largestSingleTradeShareOfPositiveNetR: candidateDiagnostics.largestSingleTradeShareOfPositiveNetR,
    feeBurdenRatio: candidateDiagnostics.feeBurdenRatio,
    formalSignals: candidateDiagnostics.formalSignals,
    minimumFoldExecutedTrades: Math.min(...candidate.folds.map((fold) => fold.validation.diagnostics.executedTrades)),
    redundancyImprovement,
  });
}

function invalidReport(errors: readonly string[]): Readonly<{ integrityStatus: "INCOMPLETE_EVIDENCE"; integrityErrors: readonly string[] }> {
  return Object.freeze({ integrityStatus: "INCOMPLETE_EVIDENCE" as const, integrityErrors: Object.freeze([...new Set(errors)]) });
}

export function validateRound006PerformanceSummary(evidence: unknown): Readonly<{ report?: Round006Report; integrityStatus: "COMPLETE" | "INCOMPLETE_EVIDENCE"; integrityErrors: readonly string[] }> {
  const errors: string[] = [];
  if (!isRecord(evidence)) return invalidReport(["SUMMARY_NOT_OBJECT"]);
  if (evidence.researchRoundId !== M3_R6_RESEARCH_ROUND_ID) errors.push("SUMMARY_RESEARCH_ROUND_MISMATCH");
  if (evidence.evidenceStatus !== "COMPLETE") errors.push("SUMMARY_EVIDENCE_NOT_COMPLETE");
  if (evidence.performanceLockTriggered !== true) errors.push("SUMMARY_PERFORMANCE_LOCK_NOT_TRIGGERED");
  if (evidence.selectionApplied !== false || evidence.selectedCandidateId !== null) errors.push("SUMMARY_SELECTION_ALREADY_APPLIED");
  if (evidence.baseline002Status !== "NOT_FROZEN" || evidence.m3JStatus !== "BLOCKED" || evidence.m4Status !== "NOT_STARTED") errors.push("SUMMARY_MILESTONE_BOUNDARY_CHANGED");
  if (!Array.isArray(evidence.candidates) || evidence.candidates.length !== M3_R6_ROUND_006_CANDIDATE_IDS.length) errors.push("SUMMARY_CANDIDATE_REGISTRY_MISMATCH");
  return errors.length > 0
    ? invalidReport(errors)
    : Object.freeze({ integrityStatus: "COMPLETE" as const, integrityErrors: Object.freeze([]), report: evidence as unknown as Round006Report });
}

export function createRound006SelectionReport(input: Readonly<{
  evidence: unknown;
  gateApplicationSourceSha: string;
  inputSummarySha256: string;
  inputAuditSha256: string;
  inputResultsSha256: string;
}>): Round006SelectionReport {
  const sourceErrors = isSha(input.gateApplicationSourceSha) ? [] : ["INVALID_GATE_APPLICATION_SOURCE_SHA"];
  const validation = validateRound006PerformanceSummary(input.evidence);
  if (validation.integrityStatus !== "COMPLETE" || !validation.report) {
    return Object.freeze({
      schemaVersion: M3_R6_ROUND_006_SELECTION_SCHEMA_VERSION,
      researchRoundId: M3_R6_RESEARCH_ROUND_ID,
      gateApplicationSourceSha: input.gateApplicationSourceSha,
      performanceExecutionSourceSha: isRecord(input.evidence) && typeof input.evidence.executionSourceSha === "string" ? input.evidence.executionSourceSha : "",
      selectionGateSha256: M3_R6_ROUND_006_SELECTION_GATE_SHA256,
      experimentPlanSha256: M3_R6_ROUND_006_PLAN_SHA256,
      inputSummaryPath: M3_R6_ROUND_006_SELECTION_INPUT_SUMMARY_PATH,
      inputSummarySha256: input.inputSummarySha256,
      inputAuditPath: M3_R6_ROUND_006_SELECTION_INPUT_AUDIT_PATH,
      inputAuditSha256: input.inputAuditSha256,
      inputResultsPath: M3_R6_ROUND_006_SELECTION_INPUT_RESULTS_PATH,
      inputResultsSha256: input.inputResultsSha256,
      performanceLock: "FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED",
      performanceEvidenceStatus: "INCOMPLETE",
      integrityStatus: "INCOMPLETE_EVIDENCE",
      integrityErrors: Object.freeze([...validation.integrityErrors, ...sourceErrors]),
      candidates: Object.freeze([]),
      eligibleCandidateIds: Object.freeze([]),
      selectionAlgorithmApplied: false,
      selectedCandidateId: null,
      finalDecision: "INCOMPLETE_EVIDENCE",
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
    });
  }
  const report = validation.report;
  const control = report.control;
  const candidates = report.candidates.map((candidate) => evaluateM3R6CandidateGates(gateInput(candidate, control)));
  const selectionCandidates: M3R6SelectionCandidate[] = candidates.map((evaluation) => {
    const candidate = report.candidates.find((item) => item.candidateId === evaluation.candidateId)!;
    const diagnostics = diagnosticsOf(candidate);
    return Object.freeze({
      candidateId: evaluation.candidateId,
      eligible: evaluation.eligibility === "ELIGIBLE",
      improvedValidationFolds: (evaluation.gateResults.find((gate) => gate.gateId === "minimumImprovedValidationFolds")?.actualValue as number | null) ?? 0,
      aggregateValidationExpectancyR: diagnostics.expectancyR ?? Number.NEGATIVE_INFINITY,
      complexityTuple: M3_R6_ROUND_006_MACHINE_RECORD.complexityTuples[evaluation.candidateId],
      aggregateValidationProfitFactor: diagnostics.profitFactor,
    });
  });
  const selection = selectM3R6Candidate(selectionCandidates);
  return Object.freeze({
    schemaVersion: M3_R6_ROUND_006_SELECTION_SCHEMA_VERSION,
    researchRoundId: M3_R6_RESEARCH_ROUND_ID,
    gateApplicationSourceSha: input.gateApplicationSourceSha,
    performanceExecutionSourceSha: report.executionSourceSha,
    selectionGateSha256: M3_R6_ROUND_006_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R6_ROUND_006_PLAN_SHA256,
    inputSummaryPath: M3_R6_ROUND_006_SELECTION_INPUT_SUMMARY_PATH,
    inputSummarySha256: input.inputSummarySha256,
    inputAuditPath: M3_R6_ROUND_006_SELECTION_INPUT_AUDIT_PATH,
    inputAuditSha256: input.inputAuditSha256,
    inputResultsPath: M3_R6_ROUND_006_SELECTION_INPUT_RESULTS_PATH,
    inputResultsSha256: input.inputResultsSha256,
    performanceLock: "FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED",
    performanceEvidenceStatus: report.evidenceStatus,
    integrityStatus: sourceErrors.length === 0 ? "COMPLETE" : "INCOMPLETE_EVIDENCE",
    integrityErrors: Object.freeze(sourceErrors),
    candidates: Object.freeze(candidates),
    eligibleCandidateIds: selection.eligibleCandidateIds,
    selectionAlgorithmApplied: sourceErrors.length === 0 && selection.selectionAlgorithmApplied,
    selectedCandidateId: sourceErrors.length === 0 ? selection.selectedCandidateId : null,
    finalDecision: sourceErrors.length === 0 ? selection.finalDecision : "INCOMPLETE_EVIDENCE",
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
  });
}

export function serializeRound006SelectionReport(report: Round006SelectionReport): string {
  return stableStringify(report);
}

export function renderRound006SelectionMarkdown(report: Round006SelectionReport): string {
  const lines = [
    "# M3-R6 Round-006 Selection",
    "",
    `- researchRoundId: ${report.researchRoundId}`,
    `- gateApplicationSourceSha: ${report.gateApplicationSourceSha}`,
    `- performanceExecutionSourceSha: ${report.performanceExecutionSourceSha}`,
    `- selectionGateSha256: ${report.selectionGateSha256}`,
    `- experimentPlanSha256: ${report.experimentPlanSha256}`,
    `- performanceEvidenceStatus: ${report.performanceEvidenceStatus}`,
    `- integrityStatus: ${report.integrityStatus}`,
    `- finalDecision: ${report.finalDecision}`,
    `- eligibleCandidateIds: ${report.eligibleCandidateIds.join(", ") || "none"}`,
    `- selectedCandidateId: ${report.selectedCandidateId ?? "null"}`,
    "",
    "| candidate | eligibility | passed gates | applicable gates | failed gates |",
    "| --- | --- | ---: | ---: | --- |",
  ];
  for (const candidate of report.candidates) lines.push(`| ${candidate.candidateId} | ${candidate.eligibility} | ${candidate.passedApplicableGateCount} | ${candidate.applicableGateCount} | ${candidate.failedGateIds.join(", ") || "none"} |`);
  lines.push("", "The selector applies eligibility first, then the frozen Round-006 deterministic stage order. No candidate is selected when no candidate passes every applicable gate.", "", "baseline-002: NOT_FROZEN", "M3-J: BLOCKED", "M4: NOT_STARTED", "");
  return lines.join("\n");
}

function rollbackPublication(publicationError: unknown, published: readonly string[], stagingDirectory: string): never {
  const rollbackErrors: unknown[] = [];
  for (const destination of [...published].reverse()) {
    try { unlinkSync(destination); } catch (error) { rollbackErrors.push(error); }
  }
  try { rmSync(stagingDirectory, { recursive: true, force: true }); } catch (error) { rollbackErrors.push(error); }
  if (rollbackErrors.length > 0) throw new Error(`Round-006 selection publication failed: ${publicationError instanceof Error ? publicationError.message : String(publicationError)}; rollback failed: ${rollbackErrors.map((error) => error instanceof Error ? error.message : String(error)).join("; ")}`, { cause: publicationError });
  throw publicationError;
}

/** Publishes Markdown first and JSON last, with destination-local staging and rollback. */
export function publishRound006SelectionOutputsAtomically(input: Readonly<{
  jsonPath: string;
  markdownPath: string;
  jsonBytes: Uint8Array;
  markdownBytes: Uint8Array;
  rename?: typeof renameSync;
}>): void {
  if (existsSync(input.jsonPath) || existsSync(input.markdownPath)) throw new Error("Round-006 selection output already exists; refusing overwrite.");
  mkdirSync(path.dirname(input.jsonPath), { recursive: true });
  mkdirSync(path.dirname(input.markdownPath), { recursive: true });
  const stagingDirectory = mkdtempSync(path.join(path.dirname(input.jsonPath), ".tradepulse-m3-r6-selection-"));
  const stagedMarkdown = path.join(stagingDirectory, path.basename(input.markdownPath));
  const stagedJson = path.join(stagingDirectory, path.basename(input.jsonPath));
  const renameArtifact = input.rename ?? renameSync;
  const published: string[] = [];
  try {
    writeFileSync(stagedMarkdown, input.markdownBytes);
    writeFileSync(stagedJson, input.jsonBytes);
    if (existsSync(input.jsonPath) || existsSync(input.markdownPath)) throw new Error("Round-006 selection output appeared during publication; refusing overwrite.");
    renameArtifact(stagedMarkdown, input.markdownPath);
    published.push(input.markdownPath);
    if (existsSync(input.jsonPath)) throw new Error("Round-006 selection JSON appeared during publication; refusing overwrite.");
    renameArtifact(stagedJson, input.jsonPath);
    published.push(input.jsonPath);
    rmSync(stagingDirectory, { recursive: true, force: true });
  } catch (error) {
    rollbackPublication(error, published, stagingDirectory);
  }
}

export function sha256Round006SelectionBytes(bytes: Uint8Array): string {
  return rawSha256(bytes);
}
