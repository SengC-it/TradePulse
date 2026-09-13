import { describe, expect, it } from "vitest";

import { evaluateR17Preflight, R17_ALLOWED_PREFLIGHT_GATES, type R17PreflightFacts } from "../src/lib/research/m3-r17-round-017-preflight.ts";
import { R17_FOLD_IDS, R17_REGIMES, R17_SYMBOLS } from "../src/lib/research/m3-r17-round-017-protocol.ts";
import type { R17ObservationScan } from "../src/lib/research/m3-r17-round-017-observation-freeze.ts";

function recordCounts<T extends readonly string[]>(values: T, amount: number): Record<T[number], number> {
  return Object.fromEntries(values.map((value) => [value, amount])) as Record<T[number], number>;
}

function scan(overrides: Partial<R17ObservationScan> = {}): R17ObservationScan {
  return Object.freeze({
    observationCount: 1_000,
    observationDataBytes: 10,
    observationDataSha256: "a".repeat(64),
    controlCount: 1_000,
    candidateCount: 600,
    firstCount: 600,
    followUpCount: 400,
    suppressedCount: 400,
    candidateByFold: Object.freeze(recordCounts(R17_FOLD_IDS, 100)),
    candidateBySymbol: Object.freeze(recordCounts(R17_SYMBOLS, 120)),
    candidateByRegime: Object.freeze(recordCounts(R17_REGIMES, 200)),
    minSignalTime: Date.parse("2023-01-01T00:00:00.000Z"),
    maxSignalTime: Date.parse("2026-08-15T23:59:59.999Z"),
    structuralAudit: Object.freeze({ duplicateCanonicalIdentityCount: 0, uniqueSignalTimeCount: 1000, sameSymbolSameDirectionGapLt4hCount: 1, sameSymbolSameDirectionGapEq4hCount: 1, oppositeDirectionSameTimestampCount: 0 }),
    ...overrides,
  });
}

function facts(overrides: Partial<R17PreflightFacts> = {}): R17PreflightFacts {
  return Object.freeze({ scan: scan(), integrityComplete: true, integrityErrors: 0, settlementIdentityComplete: true, pointInTimeComplete: true, formalStreamReconciled: true, classifierInvariantPass: true, structuralAudit: { duplicateCanonicalIdentityCount: 0, uniqueSignalTimeCount: 1000, sameSymbolSameDirectionGapLt4hCount: 1, sameSymbolSameDirectionGapEq4hCount: 1, oppositeDirectionSameTimestampCount: 0, foldAssignmentBeforeCount: 1000, foldAssignmentAfterCount: 1000 }, provenance: { rawSourceRowCount: 244810, evaluationRowCount: 317520, candidateRowCount: 8116, formalCandidateRowCount: 7500, uniqueFormalSignalIdentityCount: 7500 }, ...overrides });
}

describe("Round-017 safe preflight", () => {
  it("evaluates only the permitted non-economic gates", () => {
    const report = evaluateR17Preflight(facts());
    expect(report.status).toBe("PASS");
    expect(report.gates.map((value) => value.id)).toEqual([...R17_ALLOWED_PREFLIGHT_GATES]);
    expect(report.gates.every((value) => value.passed)).toBe(true);
    expect(report.stats).toMatchObject({ controlCount: 1_000, candidateCount: 600, firstCount: 600, followUpCount: 400, suppressedCount: 400, suppressionRate: 0.4 });
    expect(report.provenance).toMatchObject({ acceptedHistoricalFormalCount: 7_500, formalStreamReconciliation: "PASS" });
    expect(report.structuralAudit.sameSymbolSameDirectionGapLt4hCount).toBe(1);
    expect(report).not.toHaveProperty("meanNetR");
    expect(report).not.toHaveProperty("profitFactor");
    expect(report.performanceExecutionCount).toBe(0);
    expect(report.performanceLockTriggered).toBe(false);
    expect(report.performanceExecuted).toBe(false);
    expect(report.selectionExecuted).toBe(false);
    expect(report.networkAccessed).toBe(false);
  });

  it("fails closed when bounded identity/settlement integrity is incomplete", () => {
    const report = evaluateR17Preflight(facts({ integrityComplete: false, integrityErrors: 1, settlementIdentityComplete: false }));
    expect(report.status).toBe("ROUND-017 PERFORMANCE INELIGIBLE AT PREFLIGHT");
    expect(report.gates.find((value) => value.id === "G01_DATA_COMPLETE")?.passed).toBe(false);
    expect(report.performanceExecuted).toBe(false);
  });

  it("fails closed for insufficient candidate aggregate, folds, symbols, or regimes", () => {
    const report = evaluateR17Preflight(facts({ scan: scan({ candidateCount: 400, candidateByFold: Object.freeze(recordCounts(R17_FOLD_IDS, 40)), candidateBySymbol: Object.freeze(recordCounts(R17_SYMBOLS, 10)), candidateByRegime: Object.freeze(recordCounts(R17_REGIMES, 40)) }) }));
    expect(report.status).toBe("ROUND-017 PERFORMANCE INELIGIBLE AT PREFLIGHT");
    expect(report.gates.filter((value) => ["G03_CANDIDATE_AGGREGATE_MINIMUM", "G04_CANDIDATE_FOLD_MINIMUM", "G05_SYMBOL_BREADTH", "G06_REGIME_BREADTH"].includes(value.id)).every((value) => !value.passed)).toBe(true);
  });

  it("requires at least twenty percent suppression and lower candidate volume", () => {
    const lowRate = evaluateR17Preflight(facts({ scan: scan({ candidateCount: 900, followUpCount: 100, suppressedCount: 100 }) }));
    expect(lowRate.gates.find((value) => value.id === "G14_EMAIL_VOLUME_REDUCTION")?.passed).toBe(false);
    const noReduction = evaluateR17Preflight(facts({ scan: scan({ candidateCount: 1_000, followUpCount: 400, suppressedCount: 400 }) }));
    expect(noReduction.gates.find((value) => value.id === "G14_EMAIL_VOLUME_REDUCTION")?.passed).toBe(false);
  });

  it("never creates or claims the performance ledger during preflight", () => {
    const report = evaluateR17Preflight(facts({ pointInTimeComplete: false }));
    expect(report.gates.find((value) => value.id === "G02_POINT_IN_TIME")?.passed).toBe(false);
    expect(report.performanceExecutionCount).toBe(0);
    expect(report.performanceLockTriggered).toBe(false);
  });

  it("fails the point-in-time gate when the classifier invariant fails", () => {
    const report = evaluateR17Preflight(facts({ classifierInvariantPass: false }));
    expect(report.gates.find((value) => value.id === "G02_POINT_IN_TIME")?.passed).toBe(false);
    expect(report.performanceExecutionCount).toBe(0);
  });

  it("fails closed when formal stream reconciliation fails", () => {
    const report = evaluateR17Preflight(facts({ formalStreamReconciled: false }));
    expect(report.gates.find((value) => value.id === "G01_DATA_COMPLETE")?.passed).toBe(false);
    expect(report.performanceExecutionCount).toBe(0);
  });
});
