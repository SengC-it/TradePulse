import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const resultPath = resolve(process.cwd(), "docs/research/round-029-hybrid-directional-development-result.json");
const resultMarkdownPath = resolve(process.cwd(), "docs/research/round-029-hybrid-directional-development-result.md");
const auditPath = resolve(process.cwd(), "docs/research/round-029-post-outcome-audit.json");
const resultSha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

type ArtifactAudit = Readonly<{ path: string; sha256BeforeClosure: string; sha256AfterClosure: string }>;
type CandidateAuditResult = Readonly<{ gates: Readonly<{ eligibility: string; failureReason: string | null }> }>;
type AuditDocument = Readonly<{
  auditType: string;
  parentCommit: string;
  developmentEconomicEvaluationExecutionCount: number;
  rerunControls: Readonly<Record<string, boolean>>;
  originalResultArtifacts: readonly ArtifactAudit[];
  candidateAudit: Readonly<{ evaluatedCandidateCount: number; ineligibleCandidateCount: number; eligibleCandidateCount: number }>;
  championAudit: Readonly<{ noChampionConclusionRobust: boolean }>;
  rankingAudit: Readonly<{ championRankingProtocolCompliant: boolean; championRankingDeviationObserved: boolean; rankingExecutedOnEligibleSet: boolean; rankingDeviationCouldChangeR29Result: boolean; actualImplementationOrder: readonly string[] }>;
  selectedLabelAudit: Readonly<{ selectedLabelFailureCodeProtocolCompliant: boolean; selectedLabelNotEvaluableObserved: boolean; selectedLabelFailureCodeDeviationCouldChangeR29Result: boolean; expectedSelectedLabelFailureCode: string }>;
  fullSuiteBeforeClosure: Readonly<{ status: string; failureClassification: string; failedFiles: number; failedTests: number; failures: readonly unknown[] }>;
  fullSuiteAfterClosure: Readonly<{ status: string; failedFiles: number; failedTests: number }>;
  classification: string;
  nextStage: string;
  governance: Readonly<{ candidateExecutableFrozen: boolean; forwardCandidateExists: boolean; forwardValidationAuthorized: boolean; performanceExecutionCount: number; automaticTrading: boolean; humanDecisionRequired: boolean; productionUnchanged: boolean; emailRestorationAuthorized: boolean }>;
}>;
type ResultDocument = Readonly<{ candidateResults: readonly CandidateAuditResult[]; longChampionId: string | null; shortChampionId: string | null; r29DevelopmentEconomicEvaluationExecutionCount: number; forwardEconomicValuesRead: boolean; forwardReturnRead: boolean; newPostFreezeForwardDataFetched: boolean; automaticTrading: boolean; humanDecisionRequired: boolean }>;

const audit = JSON.parse(readFileSync(auditPath, "utf8")) as AuditDocument;
const result = JSON.parse(readFileSync(resultPath, "utf8")) as ResultDocument;

describe("Round-029 post-outcome implementation audit", () => {
  it("keeps both original development result artifacts byte-identical", () => {
    const artifacts = new Map(audit.originalResultArtifacts.map((artifact) => [artifact.path, artifact] as const));
    const artifactAt = (path: string): ArtifactAudit => {
      const artifact = artifacts.get(path);
      if (!artifact) throw new Error(`Missing audit artifact: ${path}`);
      return artifact;
    };
    const resultArtifact = artifactAt("docs/research/round-029-hybrid-directional-development-result.json");
    const markdownArtifact = artifactAt("docs/research/round-029-hybrid-directional-development-result.md");
    expect(resultSha256(resultPath)).toBe(resultArtifact.sha256AfterClosure);
    expect(resultSha256(resultMarkdownPath)).toBe(markdownArtifact.sha256AfterClosure);
    expect(resultArtifact.sha256BeforeClosure).toBe(resultArtifact.sha256AfterClosure);
    expect(markdownArtifact.sha256BeforeClosure).toBe(markdownArtifact.sha256AfterClosure);
  });

  it("freezes audit scope and prohibits every economic rerun or numeric change", () => {
    expect(audit.auditType).toBe("POST_OUTCOME_IMPLEMENTATION_AUDIT");
    expect(audit.parentCommit).toBe("361885a54ed5c3d1c349c75f00bf6867e03ba101");
    expect(audit.developmentEconomicEvaluationExecutionCount).toBe(1);
    expect(Object.values(audit.rerunControls).every((value) => value === false)).toBe(true);
  });

  it("records six observed candidates, all ineligible, with no eligible ranking set", () => {
    expect(result.candidateResults).toHaveLength(6);
    expect(result.candidateResults.every((candidate: CandidateAuditResult) => candidate.gates.eligibility === "INELIGIBLE")).toBe(true);
    expect(result.candidateResults.every((candidate: CandidateAuditResult) => candidate.gates.failureReason === null)).toBe(true);
    expect(audit.candidateAudit.evaluatedCandidateCount).toBe(6);
    expect(audit.candidateAudit.ineligibleCandidateCount).toBe(6);
    expect(audit.candidateAudit.eligibleCandidateCount).toBe(0);
    expect(audit.rankingAudit.rankingExecutedOnEligibleSet).toBe(false);
  });

  it("keeps both directional champions null and the no-champion conclusion robust", () => {
    expect(result.longChampionId).toBeNull();
    expect(result.shortChampionId).toBeNull();
    expect(audit.championAudit.noChampionConclusionRobust).toBe(true);
    expect(audit.classification).toBe("NO_DEVELOPMENT_CHAMPION");
    expect(audit.nextStage).toBe("CURRENT_FEATURE_INFORMATION_NOT_ECONOMICALLY_ACTIONABLE");
  });

  it("documents the omitted latency ranking criterion without changing the result", () => {
    expect(audit.rankingAudit.championRankingProtocolCompliant).toBe(false);
    expect(audit.rankingAudit.championRankingDeviationObserved).toBe(true);
    expect(audit.rankingAudit.rankingDeviationCouldChangeR29Result).toBe(false);
    expect(audit.rankingAudit.actualImplementationOrder).not.toContain("latencyStressMeanNetExpectancy DESC");
  });

  it("documents the selected-label failure-code deviation without changing the result", () => {
    expect(audit.selectedLabelAudit.selectedLabelFailureCodeProtocolCompliant).toBe(false);
    expect(audit.selectedLabelAudit.selectedLabelNotEvaluableObserved).toBe(false);
    expect(audit.selectedLabelAudit.selectedLabelFailureCodeDeviationCouldChangeR29Result).toBe(false);
    expect(audit.selectedLabelAudit.expectedSelectedLabelFailureCode).toBe("SELECTED_LABEL_NOT_EVALUABLE");
  });

  it("records the exact pre-closure full-suite regression set as environmental", () => {
    expect(audit.fullSuiteBeforeClosure.status).toBe("FULL_SUITE_REGRESSIONS_PRESENT_ON_R29_BRANCH");
    expect(audit.fullSuiteBeforeClosure.failureClassification).toBe("D_ENVIRONMENTAL_OR_NONDETERMINISTIC_FAILURE");
    expect(audit.fullSuiteBeforeClosure.failedFiles).toBe(7);
    expect(audit.fullSuiteBeforeClosure.failedTests).toBe(10);
    expect(audit.fullSuiteBeforeClosure.failures).toHaveLength(10);
  });

  it("requires a green post-closure full suite", () => {
    expect(audit.fullSuiteAfterClosure.status).toBe("PASS");
    expect(audit.fullSuiteAfterClosure.failedFiles).toBe(0);
    expect(audit.fullSuiteAfterClosure.failedTests).toBe(0);
  });

  it("keeps forward, performance, production, and email boundaries closed", () => {
    expect(audit.governance.candidateExecutableFrozen).toBe(false);
    expect(audit.governance.forwardCandidateExists).toBe(false);
    expect(audit.governance.forwardValidationAuthorized).toBe(false);
    expect(audit.governance.performanceExecutionCount).toBe(0);
    expect(audit.governance.automaticTrading).toBe(false);
    expect(audit.governance.humanDecisionRequired).toBe(true);
    expect(audit.governance.productionUnchanged).toBe(true);
    expect(audit.governance.emailRestorationAuthorized).toBe(false);
  });

  it("keeps the accepted result's economic and forward-read boundaries unchanged", () => {
    expect(result.r29DevelopmentEconomicEvaluationExecutionCount).toBe(1);
    expect(result.forwardEconomicValuesRead).toBe(false);
    expect(result.forwardReturnRead).toBe(false);
    expect(result.newPostFreezeForwardDataFetched).toBe(false);
    expect(result.automaticTrading).toBe(false);
    expect(result.humanDecisionRequired).toBe(true);
  });
});
