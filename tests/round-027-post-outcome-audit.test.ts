import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type Audit = {
  auditType: string;
  sourceResult: { jsonPath: string; jsonSha256: string; preservedWithoutRegeneration: boolean };
  auditFacts: Record<string, boolean>;
  implementationObservation: {
    pairwiseSelectionGuard: string;
    rowFromObservationEagerlyMaterializes: string[];
  };
  positiveLogitBoundaryFact: { selectionUsesValidationFeaturesOnlyBeforeThreshold: boolean };
  noChampionInvarianceProof: {
    long: { selectedByFold: Record<string, number>; pairwiseEligibilityCouldBecomeChampionAfterBoundaryFix: boolean };
    short: { selectedByFold: Record<string, number>; pairwiseEligibilityCouldBecomeChampionAfterBoundaryFix: boolean };
  };
  conclusion: {
    longChampionId: string | null;
    shortChampionId: string | null;
    developmentClassification: string;
    nextStage: string;
    noChampionConclusionRobust: boolean;
  };
  governance: Record<string, boolean | number | string>;
};

const audit = JSON.parse(readFileSync("docs/research/round-027-post-outcome-audit.json", "utf8")) as Audit;
const historicalResultPath = "docs/research/round-027-directional-development-result.json";
const historicalResultText = readFileSync(historicalResultPath, "utf8");
const historicalResult = JSON.parse(historicalResultText) as Record<string, unknown> & {
  candidateResults: Array<Record<string, unknown>>;
};
const runnerText = readFileSync("src/lib/research/round-027-development-runner.ts", "utf8");

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("Round-027 post-outcome implementation audit", () => {
  it("documents a read-only audit without rerunning or mutating development results", () => {
    expect(audit.auditType).toBe("POST_OUTCOME_IMPLEMENTATION_AUDIT");
    expect(audit.sourceResult.preservedWithoutRegeneration).toBe(true);
    expect(audit.sourceResult.jsonPath).toBe(historicalResultPath);
    expect(sha256(historicalResultText)).toBe(audit.sourceResult.jsonSha256);
    expect(audit.auditFacts.economicRerunPerformed).toBe(false);
    expect(audit.auditFacts.modelRefitPerformed).toBe(false);
    expect(audit.auditFacts.selectionRerunPerformed).toBe(false);
    expect(audit.auditFacts.numericDevelopmentResultsChanged).toBe(false);
    expect(historicalResult.candidateResults).toHaveLength(6);
    expect(historicalResult.r27DevelopmentEconomicEvaluationExecutionCount).toBe(1);
  });

  it("records the pairwise validation-boundary violation and eager status materialization", () => {
    expect(audit.auditFacts.pairwiseValidationPrimaryStatusUsedBeforeSelection).toBe(true);
    expect(audit.auditFacts.globalValidationStatusMaterializedBeforeSelection).toBe(true);
    expect(audit.auditFacts.pairwiseValidationOutcomeInfluencedSelection).toBe(true);
    expect(audit.auditFacts.pairwiseSelectionBoundaryCompliant).toBe(false);
    expect(audit.auditFacts.pairwiseEconomicMetricsAuthoritative).toBe(false);
    expect(audit.implementationObservation.pairwiseSelectionGuard).toBe('peers.some((row) => row.primaryStatus !== "EXECUTED")');
    expect(audit.implementationObservation.rowFromObservationEagerlyMaterializes).toEqual(["primaryStatus", "latencyStatus"]);
    expect(runnerText).toContain('peers.some((row) => row.primaryStatus !== "EXECUTED")');
    expect(runnerText).toContain("primaryStatus: primary.status");
    expect(runnerText).toContain("latencyStatus: latency.status");
  });

  it("keeps positive-logit selection outcome-independent before selection", () => {
    const positiveSelection = runnerText.slice(runnerText.indexOf("function positiveSelection"), runnerText.indexOf("function pairwiseSelection"));
    expect(audit.positiveLogitBoundaryFact.selectionUsesValidationFeaturesOnlyBeforeThreshold).toBe(true);
    expect(audit.auditFacts.positiveLogitValidationOutcomeInfluencedSelection).toBe(false);
    expect(positiveSelection).toContain("top.probability < config.positiveProbabilityThreshold");
    expect(positiveSelection).toContain("selectedEconomicOutcome(top.row)");
    expect(positiveSelection).not.toContain("primaryStatus");
    expect(positiveSelection).not.toContain("latencyStatus");
    expect(positiveSelection).not.toContain("netR");
    expect(positiveSelection).not.toContain("costStressNetR");
    expect(positiveSelection).not.toContain("latencyNetR");
  });

  it("proves the no-champion conclusion is invariant for both directional pairwise candidates", () => {
    expect(audit.noChampionInvarianceProof.long.selectedByFold).toEqual({ F1: 2096, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0 });
    expect(audit.noChampionInvarianceProof.short.selectedByFold).toEqual({ F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0 });
    expect(audit.noChampionInvarianceProof.long.pairwiseEligibilityCouldBecomeChampionAfterBoundaryFix).toBe(false);
    expect(audit.noChampionInvarianceProof.short.pairwiseEligibilityCouldBecomeChampionAfterBoundaryFix).toBe(false);
    expect(audit.conclusion.noChampionConclusionRobust).toBe(true);
    expect(audit.conclusion.longChampionId).toBeNull();
    expect(audit.conclusion.shortChampionId).toBeNull();
    expect(audit.conclusion.developmentClassification).toBe("NO_DEVELOPMENT_CHAMPION");
    expect(audit.conclusion.nextStage).toBe("FEATURE_INFORMATION_OR_MODEL_CAPACITY_REASSESSMENT_REQUIRED");
  });

  it("keeps forward, performance, production, and trading governance closed", () => {
    expect(audit.governance.r27DevelopmentEconomicEvaluationExecutionCount).toBe(1);
    expect(audit.governance.forwardEconomicValuesRead).toBe(false);
    expect(audit.governance.forwardReturnRead).toBe(false);
    expect(audit.governance.performanceExecutionCount).toBe(0);
    expect(audit.governance.automaticTrading).toBe(false);
    expect(audit.governance.humanDecisionRequired).toBe(true);
    expect(audit.governance.productionUnchanged).toBe(true);
    expect(audit.governance.mainUnchanged).toBe(true);
    expect(audit.governance.emailRestorationAuthorized).toBe(false);
  });
});
