import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  executeR7Authoritative,
  type R7AuditArtifact,
  type R7PerformanceReport,
} from "./m3-r7-round-007-performance.ts";
import {
  classifyResearchEvidenceStatus,
  type R8EvidenceLifecycleInput,
  type R8ResearchEvidenceStatus,
} from "./m3-r8-round-008-evidence.ts";
import {
  M3_R8_PERFORMANCE_LOCK,
  M3_R8_RESEARCH_ROUND_ID,
  R8_CANDIDATE_IDS,
  R8_MODEL_CONTRACT,
  R8_RESULT_AFFECTING_SPEC_DIFF_COUNT,
  R8_SELECTION_GATE_SHA256,
  validateR8ProtocolMachineRecord,
} from "./m3-r8-round-008-protocol.ts";
import { R8_PLAN_SHA256, validateR8Plan } from "./m3-r8-round-008-plan.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R8_REPORT_SCHEMA_VERSION = "m3-r8-round-008-report-001" as const;
export const M3_R8_AUDIT_SCHEMA_VERSION = "m3-r8-round-008-audit-001" as const;
export const M3_R8_SELECTION_SCHEMA_VERSION = "m3-r8-round-008-selection-001" as const;
export const M3_R8_DATASET_FREEZE_SCHEMA_VERSION = "m3-r8-round-008-dataset-freeze-001" as const;
export const M3_R8_INTRABAR_PLAN_VERSION = "m3-r8-round-008-intrabar-plan-001" as const;
export const M3_R8_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R8_ROUND_008_SUMMARY.json",
  "docs/evidence/M3_R8_ROUND_008_AUDIT.json",
  "docs/M3_R8_ROUND_008_RESULTS.md",
  "docs/evidence/M3_R8_ROUND_008_SELECTION.json",
  "docs/M3_R8_ROUND_008_SELECTION.md",
] as const);

type R8DatasetFreeze = Omit<R7PerformanceReport["datasetFreeze"], "schemaVersion" | "source"> & Readonly<{
  schemaVersion: typeof M3_R8_DATASET_FREEZE_SCHEMA_VERSION;
  source: "ACCEPTED_R7_CACHE_REUSED_AFTER_IDENTITY_VALIDATION";
}>;

type R8IntrabarDependencyPlan = Omit<
  R7PerformanceReport["intrabarDependencyPlan"],
  "planVersion" | "researchRoundId" | "candidatePlanSha256" | "declarationHash" | "performanceLock"
> & Readonly<{
  planVersion: typeof M3_R8_INTRABAR_PLAN_VERSION;
  researchRoundId: typeof M3_R8_RESEARCH_ROUND_ID;
  candidatePlanSha256: typeof R8_PLAN_SHA256;
  declarationHash: string;
  performanceLock: typeof M3_R8_PERFORMANCE_LOCK;
}>;

export type R8PerformanceReport = Omit<
  R7PerformanceReport,
  "schemaVersion" | "researchRoundId" | "experimentPlanSha256" | "performanceLock" | "datasetFreeze" | "intrabarDependencyPlan" | "evidenceStatus" | "selection"
> & Readonly<{
  schemaVersion: typeof M3_R8_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R8_RESEARCH_ROUND_ID;
  experimentPlanSha256: typeof R8_PLAN_SHA256;
  performanceLock: typeof M3_R8_PERFORMANCE_LOCK;
  datasetFreeze: R8DatasetFreeze;
  intrabarDependencyPlan: R8IntrabarDependencyPlan;
  evidenceStatus: R8ResearchEvidenceStatus;
  selection: R7PerformanceReport["selection"];
}>;

export type R8AuditArtifact = Omit<R7AuditArtifact, "schemaVersion" | "execution"> & Readonly<{
  schemaVersion: typeof M3_R8_AUDIT_SCHEMA_VERSION;
  execution: Omit<R7AuditArtifact["execution"], "performanceLock"> & Readonly<{ performanceLock: typeof M3_R8_PERFORMANCE_LOCK }>;
}>;

export type R8ExecutionArtifacts = Readonly<{
  report: R8PerformanceReport;
  auditArtifact: R8AuditArtifact;
  summaryJson: string;
  auditJson: string;
  resultsMarkdown: string;
  selectionJson: string;
  selectionMarkdown: string;
}>;

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function r8EvidenceLifecycleInput(report: R7PerformanceReport): R8EvidenceLifecycleInput {
  const controlMetrics = report.controlReport.metrics;
  const candidateDataIncomplete = report.candidates.some((candidate) => candidate.resultStatus === "DATA_INCOMPLETE");
  return Object.freeze({
    datasetFreezeCompleted: report.datasetFreeze.dataFreezeCompleted === true,
    integrityErrors: Object.freeze([...report.integrityErrors]),
    requiredDataIncomplete: controlMetrics.dataIncomplete > 0 || candidateDataIncomplete,
    unresolvedSettlementAmbiguity: controlMetrics.settlementAmbiguous > 0,
    requiredValidationDatasetsComplete: !candidateDataIncomplete && report.control.resultStatus !== "DATA_INCOMPLETE",
    controlExecutionCompletedStructurally: report.controlReport.status === "PASS" || report.controlReport.status === "FAIL",
    controlEconomicStatus: report.controlReport.status === "PASS" ? "PASS" : report.controlReport.status === "FAIL" ? "FAIL" : "INCOMPLETE",
  });
}

function r8IntrabarPlan(plan: R7PerformanceReport["intrabarDependencyPlan"]): R8IntrabarDependencyPlan {
  const declarations = plan.declarations.map((declaration) => declaration.identity);
  const declarationHash = sha256({
    planVersion: M3_R8_INTRABAR_PLAN_VERSION,
    researchRoundId: M3_R8_RESEARCH_ROUND_ID,
    sourceSha: plan.sourceSha,
    candidatePlanSha256: R8_PLAN_SHA256,
    declarations,
  });
  return Object.freeze({
    ...plan,
    planVersion: M3_R8_INTRABAR_PLAN_VERSION,
    researchRoundId: M3_R8_RESEARCH_ROUND_ID,
    candidatePlanSha256: R8_PLAN_SHA256,
    declarationHash,
    performanceLock: M3_R8_PERFORMANCE_LOCK,
  });
}

function r8Decision(finalDecision: string): string {
  return finalDecision.replaceAll("ROUND-007", "ROUND-008");
}

function r8Report(r7: R7PerformanceReport): R8PerformanceReport {
  const lifecycle = r8EvidenceLifecycleInput(r7);
  const evidenceStatus = classifyResearchEvidenceStatus(lifecycle);
  const selection = Object.freeze({ ...r7.selection, finalDecision: r8Decision(r7.selection.finalDecision) });
  return deepFreeze({
    ...r7,
    schemaVersion: M3_R8_REPORT_SCHEMA_VERSION,
    researchRoundId: M3_R8_RESEARCH_ROUND_ID,
    experimentPlanSha256: R8_PLAN_SHA256,
    performanceLock: M3_R8_PERFORMANCE_LOCK,
    datasetFreeze: Object.freeze({
      ...r7.datasetFreeze,
      schemaVersion: M3_R8_DATASET_FREEZE_SCHEMA_VERSION,
      source: "ACCEPTED_R7_CACHE_REUSED_AFTER_IDENTITY_VALIDATION",
    }),
    intrabarDependencyPlan: r8IntrabarPlan(r7.intrabarDependencyPlan),
    evidenceStatus,
    integrityErrors: Object.freeze([...r7.integrityErrors]),
    selection,
  }) as R8PerformanceReport;
}

function r8Audit(r7: R7AuditArtifact, executionSourceSha: string): R8AuditArtifact {
  return deepFreeze({
    ...r7,
    schemaVersion: M3_R8_AUDIT_SCHEMA_VERSION,
    execution: Object.freeze({
      ...r7.execution,
      executionSourceSha,
      performanceLock: M3_R8_PERFORMANCE_LOCK,
    }),
  }) as R8AuditArtifact;
}

function renderResults(report: R8PerformanceReport): string {
  const metric = (value: number | null): string => value === null ? "null" : String(value);
  const evidence = [report.control, ...report.candidates];
  const lines = [
    "# M3-R8 Round-008 Strict Protocol Replay",
    "",
    `- researchRoundId: ${report.researchRoundId}`,
    `- executionSourceSha: ${report.executionSourceSha}`,
    `- selectionGateSha256: ${report.selectionGateSha256}`,
    `- experimentPlanSha256: ${report.experimentPlanSha256}`,
    `- dataClassification: ${report.dataClassification}`,
    `- researchBoundary: ${report.researchBoundary}`,
    `- studyServerTime: ${report.studyServerTime}`,
    `- performanceLock: ${report.performanceLock}`,
    `- performanceExecutionCount: ${report.performanceExecutionCount}`,
    `- evidenceStatus: ${report.evidenceStatus}`,
    `- integrityErrors: ${report.integrityErrors.join(", ") || "none"}`,
    "",
    "Evidence completeness is structural and independent from economic performance. CONTROL or candidate economic FAIL does not make evidence incomplete.",
    "",
    "## Control and candidate aggregate validation",
    "",
    "| candidate | status | formal | executed | net R | expectancy R | PF |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const candidate of evidence) {
    const diagnostics = candidate.aggregateValidation.diagnostics;
    lines.push(`| ${candidate.candidateId} | ${candidate.resultStatus} | ${diagnostics.formalSignals} | ${diagnostics.executedTrades} | ${metric(diagnostics.netR)} | ${metric(diagnostics.expectancyR)} | ${metric(diagnostics.profitFactor)} |`);
  }
  lines.push(
    "",
    "## Frozen validation folds",
    "",
    "| candidate | fold | research formal/executed | validation formal/executed | validation expectancy R | validation PF |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
  );
  for (const candidate of evidence) {
    for (const fold of candidate.folds) {
      lines.push(`| ${candidate.candidateId} | ${fold.foldId} | ${fold.research.diagnostics.formalSignals}/${fold.research.diagnostics.executedTrades} | ${fold.validation.diagnostics.formalSignals}/${fold.validation.diagnostics.executedTrades} | ${metric(fold.validation.diagnostics.expectancyR)} | ${metric(fold.validation.diagnostics.profitFactor)} |`);
    }
  }
  lines.push(
    "",
    "## Model and router",
    "",
    `- Fixed ridge lambda: ${R8_MODEL_CONTRACT.lambda}; features: ${R8_MODEL_CONTRACT.featureNames.length}; fit scope: ${R8_MODEL_CONTRACT.fitScope}.`,
    `- R1 router cells: ${report.router.fixedCellCount}; validation uses research-eligible cells only.`,
    `- Performance result count: ${report.performanceExecutionCount}; CONTROL runs: 1; candidate settlement runs: 0 because candidates are derived filters of the single settled CONTROL stream.`,
    "",
    "## Boundaries",
    "",
    "- Public Binance historical data only; no private API and no automatic trading.",
    "- Closed decision-time candles only; validation never fits, tunes, or changes a model/router.",
    "- PERIOD_END_CENSORED is formal/non-executed and does not invalidate complete evidence; DATA_INCOMPLETE and SETTLEMENT_AMBIGUOUS fail closed.",
    "- Round-007 result values were not used to tune this replay.",
    "- baseline-002: NOT_FROZEN",
    "- M3-J: BLOCKED",
    "- M4: NOT_STARTED",
    "",
  );
  return lines.join("\n");
}

function selectionJson(report: R8PerformanceReport): string {
  return stableStringify({
    schemaVersion: M3_R8_SELECTION_SCHEMA_VERSION,
    researchRoundId: M3_R8_RESEARCH_ROUND_ID,
    performanceExecutionSourceSha: report.executionSourceSha,
    selectionGateSha256: R8_SELECTION_GATE_SHA256,
    experimentPlanSha256: R8_PLAN_SHA256,
    performanceLock: M3_R8_PERFORMANCE_LOCK,
    evidenceStatus: report.evidenceStatus,
    integrityStatus: report.evidenceStatus === "COMPLETE" ? "COMPLETE" : "INCOMPLETE_EVIDENCE",
    integrityErrors: report.integrityErrors,
    candidates: report.gateEvaluations,
    eligibleCandidateIds: report.selection.eligibleCandidateIds,
    selectionAlgorithmApplied: report.selection.selectionAlgorithmApplied,
    selectedCandidateId: report.selection.selectedCandidateId,
    finalDecision: report.selection.finalDecision,
    baseline002Status: report.baseline002Status,
    m3JStatus: report.m3JStatus,
    m4Status: report.m4Status,
  });
}

function selectionMarkdown(report: R8PerformanceReport): string {
  const lines = [
    "# M3-R8 Round-008 Selection",
    "",
    `- researchRoundId: ${report.researchRoundId}`,
    `- selectionGateSha256: ${report.selectionGateSha256}`,
    `- experimentPlanSha256: ${report.experimentPlanSha256}`,
    `- finalDecision: ${report.selection.finalDecision}`,
    `- eligibleCandidateIds: ${report.selection.eligibleCandidateIds.join(", ") || "none"}`,
    `- selectedCandidateId: ${report.selection.selectedCandidateId ?? "null"}`,
    "",
    "| candidate | eligibility | passed | applicable | failed |",
    "| --- | --- | ---: | ---: | --- |",
  ];
  for (const evaluation of report.gateEvaluations) lines.push(`| ${evaluation.candidateId} | ${evaluation.eligibility} | ${evaluation.passedApplicableGateCount} | ${evaluation.applicableGateCount} | ${evaluation.failedGateIds.join(", ") || "none"} |`);
  lines.push(
    "",
    "Selection is mechanical and eligibility-first. Economic failure makes a candidate INELIGIBLE; it does not make structurally complete evidence incomplete.",
    "",
    "baseline-002: NOT_FROZEN",
    "M3-J: BLOCKED",
    "M4: NOT_STARTED",
    "",
  );
  return lines.join("\n");
}

export function executeR8Authoritative(input: Readonly<{ cacheDirectory: string; executionSourceSha: string; acceptedServerTime?: number }>): Promise<R8ExecutionArtifacts> {
  return (async () => {
    validateR8ProtocolMachineRecord();
    validateR8Plan();
    const r7 = await executeR7Authoritative(input);
    const report = r8Report(r7.report);
    const auditArtifact = r8Audit(r7.auditArtifact, input.executionSourceSha);
    return Object.freeze({
      report,
      auditArtifact,
      summaryJson: stableStringify(report),
      auditJson: stableStringify(auditArtifact),
      resultsMarkdown: renderResults(report),
      selectionJson: selectionJson(report),
      selectionMarkdown: selectionMarkdown(report),
    });
  })();
}

export function validateR8AuthoritativeReport(report: R8PerformanceReport): void {
  if (report.schemaVersion !== M3_R8_REPORT_SCHEMA_VERSION || report.researchRoundId !== M3_R8_RESEARCH_ROUND_ID) throw new Error("R8 report identity is invalid.");
  if (report.performanceExecutionCount !== 1 || report.performanceLockTriggered !== true || report.performanceLock !== M3_R8_PERFORMANCE_LOCK) throw new Error("R8 report lifecycle is invalid.");
  if (report.candidateRegistry.length !== R8_CANDIDATE_IDS.length || report.candidates.length !== R8_CANDIDATE_IDS.length) throw new Error("R8 candidate count is invalid.");
  if (report.evidenceStatus !== "COMPLETE" || report.integrityErrors.length > 0) throw new Error("R8 evidence is not structurally complete.");
  if (report.controlReport.status !== "PASS" && report.controlReport.status !== "FAIL") throw new Error("R8 CONTROL execution is not structurally complete.");
  if (report.selection.selectedCandidateId !== null && !R8_CANDIDATE_IDS.includes(report.selection.selectedCandidateId)) throw new Error("R8 selection identity is invalid.");
}

export function r8OutputPaths(root = process.cwd()): readonly string[] {
  return M3_R8_OUTPUT_PATHS.map((relative) => path.join(root, relative));
}

export function existingR8OutputArtifacts(root = process.cwd()): readonly string[] {
  return Object.freeze(r8OutputPaths(root).filter((filePath) => existsSync(filePath)));
}

export function sha256R8Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export { R8_PLAN_SHA256, R8_RESULT_AFFECTING_SPEC_DIFF_COUNT };
