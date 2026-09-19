import { describe, expect, it } from "vitest";

import { R13_FEATURE_NAMES } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import {
  R28_BASE_BRANCH,
  R28_BASE_SHA,
  R28_CLASSIFICATION_RULES,
  R28_DIRECTIONS,
  R28_FOLD_IDS,
  R28_FEATURE_NAMES,
  R28_GOVERNANCE,
  R28_PROBE_IDS,
  R28_PROTOCOL_OBJECT,
  R28_REPRESENTATIONS,
  R28_SOURCE_BYTES,
  R28_SOURCE_MANIFEST_SHA256,
  R28_SOURCE_OBSERVATION_COUNT,
  R28_SOURCE_SHA256,
  R28_TARGET_IDS,
} from "../src/lib/research/round-028-protocol.ts";
import {
  calculateR28TieAwareAuc,
  calculateR28TieAwareSpearman,
  expandR28QuadraticTop4Features,
  orientR28TrainingFeature,
  scoreR28ValidationFeatures,
  selectR28RawQuadraticTop4,
  type R28DiagnosticOutcomeProjection,
  type R28ValidationFeatureRow,
} from "../src/lib/research/round-028-feature-information-diagnostic.ts";

function featureRow(id: string, featureValues: readonly number[]): R28ValidationFeatureRow {
  return Object.freeze({ observationId: id, decisionTime: 1_700_000_000_000, symbol: "BTCUSDT", direction: "LONG", features: Object.freeze([...featureValues]) });
}

function outcome(id: string, primaryContinuous: number, primaryPositive: 0 | 1): R28DiagnosticOutcomeProjection {
  return Object.freeze({ observationId: id, primaryContinuous, primaryPositive, costStressPositive: primaryPositive, latencyPositive: primaryPositive });
}

describe("Round-028 frozen diagnostic protocol", () => {
  it("freezes the exact base, accepted source, eighteen features, folds, and directions", () => {
    expect(R28_BASE_BRANCH).toBe("research/round-015-beta-alpha-decomposition");
    expect(R28_BASE_SHA).toBe("aef30226d4caa9cc3a579621579170ea8d8f872e");
    expect(R28_SOURCE_SHA256).toBe("5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359");
    expect(R28_SOURCE_MANIFEST_SHA256).toBe("7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6");
    expect(R28_SOURCE_BYTES).toBe(1_893_811_055);
    expect(R28_SOURCE_OBSERVATION_COUNT).toBe(244_810);
    expect(R28_FEATURE_NAMES).toEqual(R13_FEATURE_NAMES);
    expect(R28_FEATURE_NAMES).toHaveLength(18);
    expect(R28_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(R28_DIRECTIONS).toEqual(["LONG", "SHORT"]);
  });

  it("freezes both representations, all three probes, and all three diagnostic targets", () => {
    expect(R28_REPRESENTATIONS).toEqual(["RAW_PIT", "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME"]);
    expect(R28_PROBE_IDS).toEqual(["XS_LINEAR_ALL18", "RAW_LINEAR_ALL18", "RAW_QUADRATIC_TOP4"]);
    expect(R28_TARGET_IDS).toEqual(["PRIMARY_POSITIVE", "COST_STRESS_POSITIVE", "LATENCY_POSITIVE"]);
    expect(R28_PROTOCOL_OBJECT.probes.rawQuadraticTop4.totalTerms).toBe(14);
    expect(R28_PROTOCOL_OBJECT.probes.rawQuadraticTop4.originalTerms + R28_PROTOCOL_OBJECT.probes.rawQuadraticTop4.squareTerms + R28_PROTOCOL_OBJECT.probes.rawQuadraticTop4.interactionTerms).toBe(14);
  });

  it("uses tie-aware midranks for AUC and Spearman", () => {
    expect(calculateR28TieAwareAuc([0.5, 0.5, 0.1, 0.1], [1, 1, 0, 0])).toBe(1);
    expect(calculateR28TieAwareAuc([0.5, 0.5, 0.5, 0.5], [1, 0, 1, 0])).toBe(0.5);
    expect(calculateR28TieAwareSpearman([1, 1, 2, 3], [1, 2, 2, 4])).toBeCloseTo(0.8333333333, 8);
  });

  it("freezes training-only orientation and top-four selection", () => {
    const rows = [featureRow("a", [1, 0, 0, 0, 0, 0]), featureRow("b", [2, 0, 0, 0, 0, 0]), featureRow("c", [3, 0, 0, 0, 0, 0]), featureRow("d", [4, 0, 0, 0, 0, 0])];
    const outcomes = new Map(rows.map((row, index) => [row.observationId, outcome(row.observationId, index + 1, index < 2 ? 0 : 1)]));
    expect(orientR28TrainingFeature(rows, outcomes, 0)).toBe(1);
    expect(selectR28RawQuadraticTop4(rows, outcomes)).toHaveLength(4);
  });

  it("expands exactly four originals, four squares, and six interactions", () => {
    expect(expandR28QuadraticTop4Features([1, 2, 3, 4], [0, 1, 2, 3])).toEqual([1, 2, 3, 4, 1, 4, 9, 16, 2, 3, 4, 6, 8, 12]);
  });

  it("keeps the validation score boundary feature-only", () => {
    const rows = [featureRow("a", [1]), featureRow("b", [2])];
    const model = { means: [0], deviations: [1], intercept: 0, coefficients: [1], trainingPositiveRate: 0.5, terms: 1 } as Parameters<typeof scoreR28ValidationFeatures>[0];
    const scored = scoreR28ValidationFeatures(model, rows, (row) => row.features);
    expect(Object.keys(scored[0]!)).toEqual(["observationId", "decisionTime", "symbol", "direction", "features", "score"]);
    expect(Object.keys(rows[0]!)).toEqual(["observationId", "decisionTime", "symbol", "direction", "features"]);
    expect(scoreR28ValidationFeatures.toString()).not.toContain("labels");
    expect(scoreR28ValidationFeatures.toString()).not.toContain("status");
  });

  it("freezes all classification branches and diagnostic-only governance", () => {
    expect(Object.keys(R28_CLASSIFICATION_RULES)).toEqual(["A", "B", "C", "D", "E"]);
    expect(R28_CLASSIFICATION_RULES.A.next).toBe("HYBRID_RAW_PLUS_CROSS_SECTIONAL_ARCHITECTURE_REQUIRED");
    expect(R28_CLASSIFICATION_RULES.E.next).toBe("NEW_INFORMATION_SOURCE_REQUIRED");
    expect(R28_GOVERNANCE.economicEvaluationPerformed).toBe(false);
    expect(R28_GOVERNANCE.tradingEconomicMetricsCalculated).toBe(false);
    expect(R28_GOVERNANCE.sameFoldValidationOutcomeUsedForFit).toBe(false);
    expect(R28_GOVERNANCE.sameFoldValidationOutcomeUsedForScoring).toBe(false);
    expect(R28_GOVERNANCE.crossFoldExpandingWindowResearchReuse).toBe(true);
    expect(R28_GOVERNANCE.candidateExecutableFrozen).toBe(false);
    expect(R28_GOVERNANCE.forwardCandidateExists).toBe(false);
    expect(R28_GOVERNANCE.forwardValidationAuthorized).toBe(false);
    expect(R28_GOVERNANCE.automaticTrading).toBe(false);
    expect(R28_GOVERNANCE.humanDecisionRequired).toBe(true);
  });

  it("does not expose a production or forward-evaluation command", async () => {
    const script = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../scripts/m3-r28-feature-information-diagnostic.ts", import.meta.url), "utf8"));
    expect(script).not.toContain("performance");
    expect(script).not.toContain("backtest");
    expect(script).not.toContain("forwardStart");
  });
});
