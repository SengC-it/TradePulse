import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type JsonObject = Record<string, unknown>;

function readJson(filePath: string): JsonObject {
  return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as JsonObject;
}

describe("Round-017 pre-performance termination closure", () => {
  it("records the corrected formal-stream and identity-only facts", () => {
    const preflight = readJson("docs/research/round-017-preflight.json");
    const provenance = preflight.provenance as JsonObject;
    const classifier = preflight.classifier as JsonObject;
    const identity = preflight.identityCompleteness as JsonObject;
    const gates = preflight.gates as JsonObject;

    expect(preflight.phase).toBe("PRE_PERFORMANCE_TERMINATED");
    expect(preflight.finalDecision).toBe("ROUND-017 PERFORMANCE INELIGIBLE — DATA COMPLETENESS");
    expect(provenance).toMatchObject({ rawEvaluationCount: 317520, formalPredicateCount: 7500, acceptedHistoricalFormalCount: 7500, formalStreamReconciliation: "PASS", globalUniqueFormalAdvisoryCount: 7500, duplicateCanonicalCount: 0 });
    expect(classifier).toMatchObject({ FIRST: 5570, FOLLOW_UP: 1930, controlCount: 7500, candidateCount: 5570, suppressionRate: 0.25733333333333336 });
    expect(identity).toMatchObject({ FORMAL_AND_ACCEPTED_LABEL_IDENTITY_COMPLETE: 5834, FORMAL_COMPLETE_R14_OBSERVATION_ID_MISSING_BUT_OTHER_ACCEPTED_LABEL_IDENTITY_EXISTS: 0, FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY: 1666, FORMAL_SOURCE_PROVENANCE_INCOMPLETE: 0, OTHER: 0, total: 7500, labelValuesRead: false, economicFieldsRead: false });
    expect(gates).toMatchObject({ G01_DATA_COMPLETE: "FAIL", G02_POINT_IN_TIME: "PASS", G03_CANDIDATE_AGGREGATE_MINIMUM: "PASS", G04_CANDIDATE_FOLD_MINIMUM: "PASS", G05_SYMBOL_BREADTH: "PASS", G06_REGIME_BREADTH: "PASS", G14_EMAIL_VOLUME_REDUCTION: "PASS", G15: "NOT_EVALUATED / REPORTING_ALIAS" });
  });

  it("keeps termination fail-closed without performance or selection outputs", () => {
    const preflight = readJson("docs/research/round-017-preflight.json");
    const termination = readJson("docs/research/round-017-termination.json");
    const performance = preflight.performance as JsonObject;

    expect(performance).toMatchObject({ performanceExecutionCount: 0, performanceLockTriggered: false, performanceEligible: false, performanceExecuted: false, authoritativeExecutionId: null, checkpointRoot: null, selectionExecuted: false, economicMetricsCalculated: false, economicMetricsInspected: false, newMarketDataFetched: false });
    expect(termination).toMatchObject({ phase: "PRE_PERFORMANCE_TERMINATED", finalDecision: "ROUND-017 PERFORMANCE INELIGIBLE — DATA COMPLETENESS", performanceExecutionCount: 0, performanceLockTriggered: false, authoritativePerformanceExecuted: false, selectionExecuted: false, economicMetricsCalculated: false, economicMetricsInspected: false, noNewMarketData: true });

    for (const forbidden of [
      "docs/M3_R17_ROUND_017_RESULTS.md",
      "docs/research/round-017-performance-ledger.json",
      "docs/research/round-017-selection.json",
      ".cache/tradepulse/round-017/performance",
    ]) expect(existsSync(path.join(process.cwd(), forbidden))).toBe(false);
  });

  it("preserves the product and milestone boundary", () => {
    const termination = readJson("docs/research/round-017-termination.json");
    expect(termination).toMatchObject({ productionUnchanged: true, baseline001Unchanged: true, baseline002: "NOT_FROZEN", m3J: "BLOCKED", m4: "NOT_STARTED", shadowEnabled: false, schedulerUnchanged: true, automaticTrading: false });
  });
});
