import { describe, expect, it } from "vitest";

import {
  R30_BASE_BRANCH,
  R30_BASE_SHA,
  R30_DIRECTIONS,
  R30_FOLD_IDS,
  R30_GOVERNANCE,
  R30_MODEL_ARCHITECTURES,
  R30_REDESIGN_TARGET_IDS,
  R30_SOURCE_PROBE_DATES,
  R30_SOURCE_PROBE_ENDPOINTS,
  R30_SOURCE_PROBE_SYMBOLS,
  R30_SOURCE_SHA256,
  R30_TARGET_DEFINITIONS,
  R30_TARGET_IDS,
  R30_THRESHOLDS,
  assertR30ProtocolRuntime,
} from "../src/lib/research/round-030-protocol.ts";
import {
  calculateR30TieAwareAuc,
  calculateR30TieAwareSpearman,
  classifyR30Direction,
  isR30TargetEligible,
  joinR30DiagnosticOutcome,
  selectR30Target,
  shouldRunR30SourcePreflight,
  timestampMappingForDelta,
  type R30DiagnosticOutcome,
  type R30ScoredValidationRow,
  type R30ValidationFeatureRow,
} from "../src/lib/research/round-030-target-source-diagnostic.ts";

describe("Round-030 frozen protocol", () => {
  it("freezes the exact base and accepted R14 identity", () => {
    expect(R30_BASE_BRANCH).toBe("research/round-015-beta-alpha-decomposition");
    expect(R30_BASE_SHA).toBe("bea7f4bba421e9dcec1a17b8b952cf183fbe35dc");
    expect(R30_SOURCE_SHA256).toBe("5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359");
    expect(assertR30ProtocolRuntime()).toBe(true);
  });

  it("freezes four exact target definitions and T3 stress alignment", () => {
    expect(R30_TARGET_IDS).toEqual(["T0", "T1", "T2", "T3"]);
    expect(R30_TARGET_DEFINITIONS.T0.source).toBe("labels[4]");
    expect(R30_TARGET_DEFINITIONS.T1.definition).toContain("netForwardAtrCostStress");
    expect(R30_TARGET_DEFINITIONS.T2.source).toBe("latencyStressLabels[4]");
    expect(R30_TARGET_DEFINITIONS.T3.source).toBe("latencyStressLabels[4]");
    expect(R30_TARGET_DEFINITIONS.T3.definition).toContain("netForwardAtrCostStress");
  });

  it("freezes independent architectures and 48-fit cardinality", () => {
    expect(R30_MODEL_ARCHITECTURES).toEqual({ LONG: "RAW_LINEAR_ALL18", SHORT: "XS_LINEAR_ALL18" });
    expect(R30_DIRECTIONS).toHaveLength(2);
    expect(R30_FOLD_IDS).toHaveLength(6);
    expect(R30_TARGET_IDS).toHaveLength(4);
    expect(R30_DIRECTIONS.length * R30_FOLD_IDS.length * R30_TARGET_IDS.length).toBe(48);
  });

  it("uses all frozen target-information gates", () => {
    const passing = { medianT3Auc: 0.53, worstFoldT3Auc: 0.48, positiveT3AucFolds: 4, medianStressAlignedRankIc: 0.05, positiveStressAlignedRankIcFolds: 4, medianT3AucImprovementVsT0: 0.01 };
    expect(isR30TargetEligible(passing)).toBe(true);
    expect(isR30TargetEligible({ ...passing, medianT3Auc: 0.529999 })).toBe(false);
    expect(isR30TargetEligible({ ...passing, worstFoldT3Auc: 0.479999 })).toBe(false);
    expect(isR30TargetEligible({ ...passing, positiveT3AucFolds: 3 })).toBe(false);
    expect(isR30TargetEligible({ ...passing, medianStressAlignedRankIc: 0.049999 })).toBe(false);
    expect(isR30TargetEligible({ ...passing, positiveStressAlignedRankIcFolds: 3 })).toBe(false);
    expect(isR30TargetEligible({ ...passing, medianT3AucImprovementVsT0: 0.009999 })).toBe(false);
    expect(R30_REDESIGN_TARGET_IDS).toEqual(["T1", "T2", "T3"]);
    expect(R30_THRESHOLDS.minimumMedianT3Auc).toBe(0.53);
  });

  it("selects at most one target with the frozen deterministic tie-break", () => {
    const base = { worstFoldT3Auc: 0.5, medianT3Auc: 0.55, positiveT3AucFolds: 4, medianStressAlignedRankIc: 0.06, positiveStressAlignedRankIcFolds: 4, medianT3AucImprovementVsT0: 0.02 };
    const aggregates = [
      { direction: "LONG", trainingTarget: "T1", ...base, eligible: true },
      { direction: "LONG", trainingTarget: "T2", ...base, eligible: true },
      { direction: "LONG", trainingTarget: "T3", ...base, medianStressAlignedRankIc: 0.07, eligible: true },
    ] as const;
    expect(selectR30Target(aggregates)).toBe("T3");
    expect(selectR30Target(aggregates.map((item) => ({ ...item, eligible: false })))).toBeNull();
  });

  it("classifies promising and insufficient directions without economic selection", () => {
    expect(classifyR30Direction("LONG", "T1")).toEqual({ direction: "LONG", selectedTarget: "T1", directionClassification: "TARGET_REDESIGN_PROMISING", directionNextStage: "STRESS_ALIGNED_TARGET_DEVELOPMENT_REQUIRED" });
    expect(classifyR30Direction("SHORT", null)).toEqual({ direction: "SHORT", selectedTarget: null, directionClassification: "TARGET_REDESIGN_INSUFFICIENT", directionNextStage: "NEW_INFORMATION_SOURCE_REQUIRED" });
    expect(shouldRunR30SourcePreflight("T1", "T3")).toBe(false);
    expect(shouldRunR30SourcePreflight("T1", null)).toBe(true);
    expect(shouldRunR30SourcePreflight(null, null)).toBe(true);
  });
});

describe("Round-030 scoring boundary and diagnostics", () => {
  it("calculates tie-aware AUC and rank IC", () => {
    expect(calculateR30TieAwareAuc([0.1, 0.2, 0.3, 0.4], [0, 0, 1, 1])).toBe(1);
    expect(calculateR30TieAwareAuc([0.1, 0.1, 0.2, 0.2], [0, 1, 0, 1])).toBe(0.5);
    expect(calculateR30TieAwareSpearman([1, 1, 2, 3], [1, 2, 2, 3])).toBeGreaterThan(0.7);
  });

  it("keeps validation rows feature-only and joins T3 outcome only after scoring", () => {
    const row: R30ValidationFeatureRow = { observationId: "o-1", decisionTime: 1, symbol: "BTCUSDT", direction: "LONG", features: [1, 2] };
    const scored: R30ScoredValidationRow = { ...row, score: 0.75 };
    const outcome: R30DiagnosticOutcome = { observationId: "o-1", t3Target: 1, stressAlignedNetR: 0.2 };
    expect(Object.keys(row).sort()).toEqual(["decisionTime", "direction", "features", "observationId", "symbol"]);
    expect(joinR30DiagnosticOutcome([scored], new Map([[outcome.observationId, outcome]]))).toEqual([{ ...scored, t3Target: 1, stressAlignedNetR: 0.2 }]);
  });

  it("allows null outcome joins without treating them as positive", () => {
    const scored: R30ScoredValidationRow = { observationId: "o-2", decisionTime: 1, symbol: "ETHUSDT", direction: "SHORT", features: [1], score: 0.5 };
    expect(joinR30DiagnosticOutcome([scored], new Map())).toEqual([{ ...scored, t3Target: null, stressAlignedNetR: null }]);
  });
});

describe("Round-030 source admission contract", () => {
  it("freezes seven dates, five symbols, and five public endpoints", () => {
    expect(R30_SOURCE_PROBE_DATES).toEqual(["2023-01-03", "2024-01-15", "2025-01-15", "2026-06-24", "2026-06-26", "2026-08-15", "2026-09-18"]);
    expect(R30_SOURCE_PROBE_SYMBOLS).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
    expect(R30_SOURCE_PROBE_ENDPOINTS).toEqual(["openInterestHist", "topLongShortAccountRatio", "topLongShortPositionRatio", "globalLongShortAccountRatio", "takerlongshortRatio"]);
    expect(R30_SOURCE_PROBE_DATES.length * R30_SOURCE_PROBE_SYMBOLS.length).toBe(35);
  });

  it("permits only exact, archive-minus-five, or archive-plus-five-minute mappings", () => {
    expect(timestampMappingForDelta(0)).toBe("EXACT");
    expect(timestampMappingForDelta(-300000)).toBe("ARCHIVE_MINUS_5M");
    expect(timestampMappingForDelta(300000)).toBe("ARCHIVE_PLUS_5M");
    expect(timestampMappingForDelta(60000)).toBeNull();
  });

  it("keeps economics, forward, Production, and automatic trading closed", () => {
    expect(R30_GOVERNANCE.automaticTrading).toBe(false);
    expect(R30_GOVERNANCE.humanDecisionRequired).toBe(true);
    expect(R30_GOVERNANCE.performanceExecutionCount).toBe(0);
    expect(R30_GOVERNANCE.productionUnchanged).toBe(true);
  });
});
