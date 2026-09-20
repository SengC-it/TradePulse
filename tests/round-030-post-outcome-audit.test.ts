import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const resultJsonPath = resolve(process.cwd(), "docs/research/round-030-target-source-result.json");
const resultMarkdownPath = resolve(process.cwd(), "docs/research/round-030-target-source-result.md");
const auditPath = resolve(process.cwd(), "docs/research/round-030-post-outcome-audit.json");

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

type AuditDocument = Readonly<{
  auditType: string;
  parentCommit: string;
  originalResultArtifacts: readonly Readonly<{ path: string; sha256BeforeClosure: string; sha256AfterClosure: string; unchanged: boolean }>[];
  rerunControls: Readonly<Record<string, boolean>>;
  historicalExecution: Readonly<{ targetDiagnosticExecutionCount: number; sourcePreflightExecutionCount: number; economicEvaluationPerformed: boolean; tradingEconomicMetricsCalculated: boolean }>;
  stageA: Readonly<{
    stageATargetDiagnosticAuthoritative: boolean;
    longSelectedTarget: string | null;
    longClassification: string;
    long: Readonly<{ bestTarget: string; t0MedianT3Auc: number; bestMedianT3Auc: number; improvementVsT0: number }>;
    shortSelectedTarget: string | null;
    shortClassification: string;
    short: Readonly<{ bestTarget: string; t0MedianT3Auc: number; bestMedianT3Auc: number; improvementVsT0: number }>;
    frozenThresholds: Readonly<{ minimumMedianT3AucImprovementVsT0: number }>;
    targetRedesignConclusionRobust: boolean;
  }>;
  stageBArchiveEvidence: Readonly<Record<string, boolean | number>>;
  stageBLiveOverlapObservability: Readonly<{ liveOverlapProbeCompleted: boolean; liveOverlapFailureCauseObservable: boolean; fieldMappingComparisonActuallyPerformed: boolean; timestampMappingComparisonActuallyPerformed: boolean; recentOverlapMappings: Readonly<Record<string, unknown>>; fieldAgreementRates: Readonly<Record<string, unknown>>; timestampMappingResolved: boolean; fieldMappingStatus: string; timestampMappingStatus: string }>;
  sourceAdmission: Readonly<{ historicalSourceClassification: string; sourceAdmissionEvidenceAuthoritative: boolean; auditSourceClassification: string; auditNextStage: string }>;
  overall: Readonly<{ historicalOverallClassification: string; auditOverallClassification: string; auditNextStage: string }>;
  cliImportAudit: Readonly<{ cliScriptImportHasExecutionSideEffect: boolean; reportedDiagnosticExecutionCount: number; durableExecutionCounterPresent: boolean; singleExecutionIndependentlyVerifiable: boolean; reportedAbortedSmokeAttempt: boolean; abortedSmokeAttemptIsIndependentlyPersistedExecution: boolean }>;
  governance: Readonly<{ candidateExecutableFrozen: boolean; forwardCandidateExists: boolean; forwardValidationAuthorized: boolean; forwardEconomicValuesRead: boolean; forwardReturnRead: boolean; performanceExecutionCount: number; performanceLedgerPresent: boolean; automaticTrading: boolean; humanDecisionRequired: boolean; productionUnchanged: boolean; emailRestorationAuthorized: boolean; baseline002Status: string; m3JStatus: string; m4Status: string; round020LiquidationClosureReopened: boolean }>;
  closure: Readonly<{ historicalResultPreserved: boolean; newMarketDataAcquiredDuringClosure: boolean; finalDecision: string; nextStage: string }>;
}>;

type ResultDocument = Readonly<{
  targetDiagnosticExecutionCount: number;
  stageA: Readonly<{ directions: Readonly<Record<string, Readonly<{ selectedTarget: string | null; directionClassification: string }>>> }>;
  stageB: Readonly<{ executionCount: number; recentOverlapMappings: Readonly<Record<string, unknown>>; fieldAgreementRates: Readonly<Record<string, unknown>>; timestampMappingResolved: boolean }>;
  economicEvaluationPerformed: boolean;
  tradingEconomicMetricsCalculated: boolean;
  governance: Readonly<{ candidateExecutableFrozen: boolean; forwardCandidateExists: boolean; forwardValidationAuthorized: boolean; forwardEconomicValuesRead: boolean; forwardReturnRead: boolean; performanceExecutionCount: number; automaticTrading: boolean; humanDecisionRequired: boolean; productionUnchanged: boolean; emailRestorationAuthorized: boolean; baseline002Status: string; m3JStatus: string; m4Status: string; round020LiquidationClosureReopened: boolean }>;
}>;

const audit = JSON.parse(readFileSync(auditPath, "utf8")) as AuditDocument;
const result = JSON.parse(readFileSync(resultJsonPath, "utf8")) as ResultDocument;

describe("Round-030 post-outcome source-admission audit", () => {
  it("keeps both original result artifacts byte-identical", () => {
    const artifacts = new Map(audit.originalResultArtifacts.map((artifact) => [artifact.path, artifact] as const));
    const jsonArtifact = artifacts.get("docs/research/round-030-target-source-result.json");
    const markdownArtifact = artifacts.get("docs/research/round-030-target-source-result.md");
    expect(jsonArtifact).toBeDefined();
    expect(markdownArtifact).toBeDefined();
    expect(sha256(resultJsonPath)).toBe(jsonArtifact!.sha256AfterClosure);
    expect(sha256(resultMarkdownPath)).toBe(markdownArtifact!.sha256AfterClosure);
    expect(jsonArtifact!.sha256BeforeClosure).toBe(jsonArtifact!.sha256AfterClosure);
    expect(markdownArtifact!.sha256BeforeClosure).toBe(markdownArtifact!.sha256AfterClosure);
    expect(jsonArtifact!.unchanged).toBe(true);
    expect(markdownArtifact!.unchanged).toBe(true);
  });

  it("freezes audit-only scope and historical execution counts", () => {
    expect(audit.auditType).toBe("POST_OUTCOME_AUDIT_ONLY");
    expect(audit.parentCommit).toBe("208ca9d9db77d11dfb88a1f49fe9a31ef4d89ab4");
    expect(audit.historicalExecution.targetDiagnosticExecutionCount).toBe(1);
    expect(audit.historicalExecution.sourcePreflightExecutionCount).toBe(1);
    expect(audit.historicalExecution.economicEvaluationPerformed).toBe(false);
    expect(audit.historicalExecution.tradingEconomicMetricsCalculated).toBe(false);
    expect(Object.values(audit.rerunControls).every((value) => value === false)).toBe(true);
    expect(audit.closure.historicalResultPreserved).toBe(true);
    expect(audit.closure.newMarketDataAcquiredDuringClosure).toBe(false);
  });

  it("preserves the authoritative Stage A conclusions and improvements", () => {
    expect(audit.stageA.stageATargetDiagnosticAuthoritative).toBe(true);
    expect(audit.stageA.longSelectedTarget).toBeNull();
    expect(audit.stageA.longClassification).toBe("TARGET_REDESIGN_INSUFFICIENT");
    expect(audit.stageA.long.bestTarget).toBe("T3");
    expect(audit.stageA.long.t0MedianT3Auc).toBe(0.5607079528503145);
    expect(audit.stageA.long.bestMedianT3Auc).toBe(0.5656435238134828);
    expect(audit.stageA.long.improvementVsT0).toBe(0.004935570963168323);
    expect(audit.stageA.shortSelectedTarget).toBeNull();
    expect(audit.stageA.shortClassification).toBe("TARGET_REDESIGN_INSUFFICIENT");
    expect(audit.stageA.short.bestTarget).toBe("T1");
    expect(audit.stageA.short.t0MedianT3Auc).toBe(0.5406919258947558);
    expect(audit.stageA.short.bestMedianT3Auc).toBe(0.5430121569276795);
    expect(audit.stageA.short.improvementVsT0).toBe(0.0023202310329236697);
    expect(audit.stageA.long.improvementVsT0).toBeLessThan(audit.stageA.frozenThresholds.minimumMedianT3AucImprovementVsT0);
    expect(audit.stageA.short.improvementVsT0).toBeLessThan(audit.stageA.frozenThresholds.minimumMedianT3AucImprovementVsT0);
    expect(audit.stageA.targetRedesignConclusionRobust).toBe(true);
    expect(result.stageA.directions.LONG.selectedTarget).toBeNull();
    expect(result.stageA.directions.SHORT.selectedTarget).toBeNull();
  });

  it("retains all 35 archive sample-quality observations without converting them to admission", () => {
    expect(audit.stageBArchiveEvidence.archiveFilesRequested).toBe(35);
    expect(audit.stageBArchiveEvidence.archiveFilesAvailable).toBe(35);
    expect(audit.stageBArchiveEvidence.checksumValidFiles).toBe(35);
    expect(audit.stageBArchiveEvidence.schemaValidFiles).toBe(35);
    expect(audit.stageBArchiveEvidence.sampleCoverageComplete).toBe(true);
    expect(audit.stageBArchiveEvidence.checksumsComplete).toBe(true);
    expect(audit.stageBArchiveEvidence.schemaComplete).toBe(true);
    expect(audit.stageBArchiveEvidence.cadenceComplete).toBe(true);
    expect(audit.stageBArchiveEvidence.conflictingDuplicateCount).toBe(0);
    expect(audit.stageBArchiveEvidence.archiveSampleQualityAccepted).toBe(true);
    expect(audit.stageBArchiveEvidence.metricsSourceAdmissionAccepted).toBe(false);
  });

  it("records that live-overlap comparison evidence was not produced", () => {
    expect(audit.stageBLiveOverlapObservability.liveOverlapProbeCompleted).toBe(false);
    expect(audit.stageBLiveOverlapObservability.liveOverlapFailureCauseObservable).toBe(false);
    expect(audit.stageBLiveOverlapObservability.fieldMappingComparisonActuallyPerformed).toBe(false);
    expect(audit.stageBLiveOverlapObservability.timestampMappingComparisonActuallyPerformed).toBe(false);
    expect(audit.stageBLiveOverlapObservability.recentOverlapMappings).toEqual({});
    expect(audit.stageBLiveOverlapObservability.fieldAgreementRates).toEqual({});
    expect(audit.stageBLiveOverlapObservability.timestampMappingResolved).toBe(false);
    expect(audit.stageBLiveOverlapObservability.fieldMappingStatus).toBe("FIELD_MAPPING_NOT_ESTABLISHED");
    expect(audit.stageBLiveOverlapObservability.timestampMappingStatus).toBe("TIMESTAMP_MAPPING_NOT_ESTABLISHED");
    expect(result.stageB.recentOverlapMappings).toEqual({});
    expect(result.stageB.fieldAgreementRates).toEqual({});
    expect(result.stageB.timestampMappingResolved).toBe(false);
  });

  it("keeps source admission inconclusive rather than claiming incompatibility or paid-source necessity", () => {
    expect(audit.sourceAdmission.historicalSourceClassification).toBe("METRICS_SOURCE_PREFLIGHT_INELIGIBLE");
    expect(audit.sourceAdmission.sourceAdmissionEvidenceAuthoritative).toBe(false);
    expect(audit.sourceAdmission.auditSourceClassification).toBe("SOURCE_PREFLIGHT_INCONCLUSIVE_DUE_TO_UNOBSERVABLE_LIVE_PROBE_FAILURE");
    expect(audit.sourceAdmission.auditNextStage).toBe("BINANCE_METRICS_LIVE_OVERLAP_REPROBE_REQUIRED");
    expect(audit.overall.historicalOverallClassification).toBe("NEW_INFORMATION_SOURCE_ESCALATION_REQUIRED");
    expect(audit.overall.auditOverallClassification).toBe("TARGET_REDESIGN_INSUFFICIENT_AND_SOURCE_PREFLIGHT_INCONCLUSIVE");
    expect(audit.overall.auditNextStage).toBe("BINANCE_METRICS_LIVE_OVERLAP_REPROBE_REQUIRED");
  });

  it("audits the CLI import side effect without claiming a second diagnostic execution", () => {
    expect(audit.cliImportAudit.cliScriptImportHasExecutionSideEffect).toBe(true);
    expect(audit.cliImportAudit.reportedDiagnosticExecutionCount).toBe(1);
    expect(audit.cliImportAudit.durableExecutionCounterPresent).toBe(false);
    expect(audit.cliImportAudit.singleExecutionIndependentlyVerifiable).toBe(false);
    expect(audit.cliImportAudit.reportedAbortedSmokeAttempt).toBe(true);
    expect(audit.cliImportAudit.abortedSmokeAttemptIsIndependentlyPersistedExecution).toBe(false);
  });

  it("keeps economics, forward validation, production, and trading boundaries closed", () => {
    expect(audit.governance.candidateExecutableFrozen).toBe(false);
    expect(audit.governance.forwardCandidateExists).toBe(false);
    expect(audit.governance.forwardValidationAuthorized).toBe(false);
    expect(audit.governance.forwardEconomicValuesRead).toBe(false);
    expect(audit.governance.forwardReturnRead).toBe(false);
    expect(audit.governance.performanceExecutionCount).toBe(0);
    expect(audit.governance.performanceLedgerPresent).toBe(false);
    expect(audit.governance.automaticTrading).toBe(false);
    expect(audit.governance.humanDecisionRequired).toBe(true);
    expect(audit.governance.productionUnchanged).toBe(true);
    expect(audit.governance.emailRestorationAuthorized).toBe(false);
    expect(audit.governance.baseline002Status).toBe("NOT_FROZEN");
    expect(audit.governance.m3JStatus).toBe("BLOCKED");
    expect(audit.governance.m4Status).toBe("NOT_STARTED");
    expect(audit.governance.round020LiquidationClosureReopened).toBe(false);
    expect(result.economicEvaluationPerformed).toBe(false);
    expect(result.tradingEconomicMetricsCalculated).toBe(false);
    expect(result.governance.performanceExecutionCount).toBe(0);
    expect(result.governance.automaticTrading).toBe(false);
  });

  it("freezes the audit decision and next stage", () => {
    expect(audit.closure.finalDecision).toBe("ROUND-030 POST-OUTCOME SOURCE-ADMISSION AUDIT COMPLETE");
    expect(audit.closure.nextStage).toBe("STOP_PENDING_INDEPENDENT_ROUND_030_FINAL_ACCEPTANCE");
  });
});
