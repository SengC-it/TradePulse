import { describe, expect, it } from "vitest";

import { R13_FEATURE_NAMES } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import {
  R29_BASE_BRANCH,
  R29_BASE_SHA,
  R29_CALIBRATION_QUANTILE,
  R29_CANDIDATE_CONFIGURATIONS,
  R29_DEVELOPMENT_GATES,
  R29_DIRECTIONS,
  R29_FEATURE_NAMES,
  R29_FOLD_IDS,
  R29_GOVERNANCE,
  R29_MODEL_PRIMITIVES,
  R29_PHASE,
  R29_PROTOCOL_OBJECT,
  R29_SOURCE,
} from "../src/lib/research/round-029-protocol.ts";
import {
  buildR29CrossSectionalFeatureRows,
  calculateR29CalibrationQuantile,
  evaluateR29DevelopmentGates,
  selectR29Champion,
  type R29Metrics,
  type R29ValidationFeatureRow,
} from "../src/lib/research/round-029-development-runner.ts";
import { expandR29QuadraticTop4 } from "../src/lib/research/round-029-candidate-model.ts";

function rawRow(id: string, symbol: "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "XRPUSDT" | "BNBUSDT", direction: "LONG" | "SHORT", values: readonly number[]): Readonly<{ observationId: string; decisionTime: number; symbol: typeof symbol; direction: typeof direction; features: readonly number[]; primaryStatus: "EXECUTED"; latencyStatus: "EXECUTED"; primary: never; latency: never }> {
  return Object.freeze({ observationId: id, decisionTime: 1_700_000_000_000, symbol, direction, features: Object.freeze([...values]), primaryStatus: "EXECUTED", latencyStatus: "EXECUTED", primary: undefined as never, latency: undefined as never });
}

function emptyMetric(): R29Metrics["byFold"]["F1"] {
  return Object.freeze({ selectedAlerts: 10, completeDecisionTimes: 100, selectedDecisionTimeRate: 0.1, meanNetExpectancy: 0.01, netProfitFactor: 1.1, costStressMeanNetExpectancy: 0.01, costStressProfitFactor: 1.1, latencyStressMeanNetExpectancy: 0.01, latencyStressProfitFactor: 1.1, cumulativeNetR: 1, maximumDrawdownR: 0, });
}

describe("Round-029 frozen hybrid directional architecture", () => {
  it("freezes the exact base, source identity, directions, folds, and eighteen features", () => {
    expect(R29_BASE_BRANCH).toBe("research/round-015-beta-alpha-decomposition");
    expect(R29_BASE_SHA).toBe("39b0fbec69ba5fc59b5c57d028b654f361ea19ce");
    expect(R29_FEATURE_NAMES).toEqual(R13_FEATURE_NAMES);
    expect(R29_FEATURE_NAMES).toHaveLength(18);
    expect(R29_DIRECTIONS).toEqual(["LONG", "SHORT"]);
    expect(R29_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(R29_SOURCE.networkAcquired).toBe(false);
    expect(R29_SOURCE.classification).toBe("DEVELOPMENT_ONLY / ALREADY_SEEN");
  });

  it("freezes exactly three LONG and three SHORT candidates without an absolute short probability gate", () => {
    expect(R29_CANDIDATE_CONFIGURATIONS).toHaveLength(6);
    expect(R29_CANDIDATE_CONFIGURATIONS.filter((candidate) => candidate.direction === "LONG")).toHaveLength(3);
    expect(R29_CANDIDATE_CONFIGURATIONS.filter((candidate) => candidate.direction === "SHORT")).toHaveLength(3);
    expect(R29_CANDIDATE_CONFIGURATIONS.every((candidate) => candidate.probabilityGate === "Q90")).toBe(true);
    expect(R29_CANDIDATE_CONFIGURATIONS.filter((candidate) => candidate.direction === "SHORT").every((candidate) => candidate.calibrationStatistic !== "RAW_PROBABILITY")).toBe(true);
    expect(R29_CANDIDATE_CONFIGURATIONS.find((candidate) => candidate.candidateConfigurationId === "R29_LONG_RAW_GATE_BLENDED_RANK")?.rankWeights).toEqual({ raw: 0.5, xs: 0.5 });
  });

  it("freezes the raw, cross-sectional, and fourteen-term quadratic primitives", () => {
    expect(R29_MODEL_PRIMITIVES.RAW_LINEAR_ALL18.featureCount).toBe(18);
    expect(R29_MODEL_PRIMITIVES.XS_LINEAR_ALL18.representation).toContain("CROSS_SECTIONAL");
    expect(R29_MODEL_PRIMITIVES.RAW_QUADRATIC_TOP4.expandedTermCount).toBe(14);
    expect(expandR29QuadraticTop4([1, 2, 3, 4], [0, 1, 2, 3])).toEqual([1, 2, 3, 4, 1, 4, 9, 16, 2, 3, 4, 6, 8, 12]);
  });

  it("keeps validation rows feature-only and uses deterministic Q90 interpolation", () => {
    const rows = [
      rawRow("a", "BTCUSDT", "LONG", Array(18).fill(1)),
      rawRow("b", "ETHUSDT", "LONG", Array(18).fill(2)),
      rawRow("c", "SOLUSDT", "LONG", Array(18).fill(3)),
      rawRow("d", "XRPUSDT", "LONG", Array(18).fill(4)),
      rawRow("e", "BNBUSDT", "LONG", Array(18).fill(5)),
    ];
    const featureRows = buildR29CrossSectionalFeatureRows(rows, "LONG");
    expect(Object.keys(featureRows[0]!)).toEqual(["observationId", "decisionTime", "symbol", "direction", "features"]);
    expect(calculateR29CalibrationQuantile([0, 1, 2, 3, 4])).toBe(3.6);
    expect(R29_CALIBRATION_QUANTILE).toBe(0.9);
  });

  it("freezes all development gates including the selected-rate gate", () => {
    expect(R29_DEVELOPMENT_GATES.maximumSelectedDecisionTimeRatePerFold).toBe(0.25);
    const byFold = Object.fromEntries(R29_FOLD_IDS.map((foldId) => [foldId, emptyMetric()])) as R29Metrics["byFold"];
    const bySymbol = Object.fromEntries(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"].map((symbol) => [symbol, emptyMetric()])) as R29Metrics["bySymbol"];
    const metrics: R29Metrics = Object.freeze({ selectedAlerts: 60, distinctUtcDecisionDates: 20, meanNetExpectancy: 0.01, netProfitFactor: 1.1, cumulativeNetR: 1, maximumDrawdownR: 0, maximumLosingStreak: 1, costStressMeanNetExpectancy: 0.01, costStressProfitFactor: 1.1, latencyStressMeanNetExpectancy: 0.01, latencyStressProfitFactor: 1.1, positiveTemporalFolds: 6, catastrophicFolds: 0, maximumPositiveSymbolContributionShare: 0.2, maximumSelectedDecisionTimeRatePerFold: 0.1, byFold, bySymbol });
    expect(evaluateR29DevelopmentGates(metrics).eligibility).toBe("ELIGIBLE");
  });

  it("selects champions only from fully eligible candidates and preserves family separation", () => {
    expect(selectR29Champion([], "LONG-CANDIDATE-FAMILY")).toBeNull();
    expect(selectR29Champion([], "SHORT-CANDIDATE-FAMILY")).toBeNull();
  });

  it("freezes development-only governance and does not expose forward or trading authority", () => {
    expect(R29_PHASE).toBe("HYBRID_DIRECTIONAL_ARCHITECTURE_DEVELOPMENT_ONLY");
    expect(R29_PROTOCOL_OBJECT.searchSpace.exactlyOneEconomicEvaluation).toBe(true);
    expect(R29_GOVERNANCE.forwardEconomicValuesRead).toBe(false);
    expect(R29_GOVERNANCE.forwardValidationAuthorized).toBe(false);
    expect(R29_GOVERNANCE.performanceExecutionCount).toBe(0);
    expect(R29_GOVERNANCE.automaticTrading).toBe(false);
    expect(R29_GOVERNANCE.humanDecisionRequired).toBe(true);
  });

  it("does not add R29 to the generic M3-G1 aggregation and does not expose a performance command", async () => {
    const script = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../scripts/m3-r29-development.ts", import.meta.url), "utf8"));
    expect(script).not.toContain("performance");
    expect(script).not.toContain("backtest");
    expect(script).toContain("publishR29DevelopmentResult");
  });
});
