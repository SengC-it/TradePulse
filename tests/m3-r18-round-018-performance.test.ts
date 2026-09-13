import { describe, expect, it } from "vitest";

import {
  buildR18EconomicMetricRow,
  buildR18Selection,
  evaluateR18PerformanceGates,
  summarizeR18MetricRows,
  type R18EconomicMetricRow,
  type R18FoldPerformance,
  type R18PrimaryMetric,
} from "@/lib/research/m3-r18-round-018-performance";
import type { R13Observation } from "@/lib/research/m3-r13-round-013-performance";

const HORIZON_KEYS = ["4", "8", "12", "24"] as const;

function metric(overrides: Partial<R18PrimaryMetric> = {}): R18PrimaryMetric {
  return {
    horizonHours: 4,
    count: 10,
    meanNetForwardAtr: 0.1,
    profitFactor: 1.2,
    cumulativeNetForwardAtr: 1,
    maximumDrawdownNetAtr: -1,
    meanNetForwardAtrCostStress: 0.1,
    costStressProfitFactor: 1.2,
    latencyStressMeanNetForwardAtr: 0.1,
    latencyStressProfitFactor: 1.2,
    ...overrides,
  };
}

function folds(candidateMeans: readonly number[], controlMean = 0): readonly R18FoldPerformance[] {
  return candidateMeans.map((candidateMean, index) => ({
    foldId: `F${index + 1}` as `F${1 | 2 | 3 | 4 | 5 | 6}`,
    control: metric({ meanNetForwardAtr: controlMean }),
    candidate: metric({ meanNetForwardAtr: candidateMean }),
    candidateMeanAtLeastControl: candidateMean >= controlMean,
    candidateMeanPositive: candidateMean > 0,
  }));
}

function row(value: number | null, extras: Partial<{ costStress: number; latencyStress: number }> = {}): R18EconomicMetricRow {
  const horizonValue = value === null ? null : { netForwardAtr: value, costStress: extras.costStress ?? value, latencyStress: extras.latencyStress ?? value };
  return {
    observationId: `${Math.abs(value ?? 0)}|BTCUSDT|LONG`,
    decisionTime: 1_700_000_000_000 + Math.abs(value ?? 0) * 1_000,
    symbol: "BTCUSDT",
    direction: "LONG",
    horizons: Object.fromEntries(HORIZON_KEYS.map((key) => [key, horizonValue])) as R18EconomicMetricRow["horizons"],
  };
}

function observationWithStatuses(status4: "EXECUTED" | "NO_ENTRY" | "PERIOD_END_CENSORED" | "DATA_INCOMPLETE"): R13Observation {
  const label = (status: typeof status4) => ({ status, netForwardAtr: status === "EXECUTED" ? 1 : null, netForwardAtrCostStress: status === "EXECUTED" ? 1 : null });
  return {
    labels: Object.fromEntries(HORIZON_KEYS.map((key) => [Number(key), { ...label(status4), horizonHours: Number(key) }])) as R13Observation["labels"],
    latencyStressLabels: Object.fromEntries(HORIZON_KEYS.map((key) => [Number(key), { ...label(status4), horizonHours: Number(key) }])) as R13Observation["latencyStressLabels"],
  } as unknown as R13Observation;
}

describe("Round-018 frozen H4 performance gates", () => {
  it("applies the strict G08 zero boundary", () => {
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: metric({ meanNetForwardAtr: 0 }), folds: folds([1, 1, 1, 1, 1, 1]) })[0]!.passed).toBe(false);
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: metric({ meanNetForwardAtr: Number.MIN_VALUE }), folds: folds([1, 1, 1, 1, 1, 1]) })[0]!.passed).toBe(true);
  });

  it("accepts G09 profit factor exactly at 1.10", () => {
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: metric({ profitFactor: 1.10 }), folds: folds([1, 1, 1, 1, 1, 1]) })[1]!.passed).toBe(true);
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: metric({ profitFactor: 1.099999999 }), folds: folds([1, 1, 1, 1, 1, 1]) })[1]!.passed).toBe(false);
  });

  it("accepts G10 incremental edge exactly at 0.05 ATR", () => {
    expect(evaluateR18PerformanceGates({ control: metric({ meanNetForwardAtr: 0.1 }), candidate: metric({ meanNetForwardAtr: 0.15000000000000002 }), folds: folds([1, 1, 1, 1, 1, 1], 0.1) })[2]!.passed).toBe(true);
    expect(evaluateR18PerformanceGates({ control: metric({ meanNetForwardAtr: 0.1 }), candidate: metric({ meanNetForwardAtr: 0.1499 }), folds: folds([1, 1, 1, 1, 1, 1], 0.1) })[2]!.passed).toBe(false);
  });

  it("requires four of six incremental folds for G11", () => {
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: metric(), folds: folds([1, 1, 1, 0, 0, 0], 0.1) })[3]!.passed).toBe(false);
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: metric(), folds: folds([1, 1, 1, 1, 0, 0], 0.1) })[3]!.passed).toBe(true);
  });

  it("requires four of six positive folds for G12", () => {
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: metric(), folds: folds([1, 1, 1, -1, -1, -1]) })[4]!.passed).toBe(false);
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: metric(), folds: folds([1, 1, 1, 1, -1, -1]) })[4]!.passed).toBe(true);
  });

  it("uses inclusive G13 cost-stress mean and PF boundaries", () => {
    const gates = evaluateR18PerformanceGates({ control: metric(), candidate: metric({ meanNetForwardAtrCostStress: 0, costStressProfitFactor: 1.05 }), folds: folds([1, 1, 1, 1, 1, 1]) });
    expect(gates[5]!.passed).toBe(true);
  });

  it("uses inclusive G14 latency-stress mean and PF boundaries", () => {
    const gates = evaluateR18PerformanceGates({ control: metric(), candidate: metric({ latencyStressMeanNetForwardAtr: 0, latencyStressProfitFactor: 1.05 }), folds: folds([1, 1, 1, 1, 1, 1]) });
    expect(gates[6]!.passed).toBe(true);
  });

  it("uses the exact G15 five-percent drawdown boundary", () => {
    expect(evaluateR18PerformanceGates({ control: metric({ maximumDrawdownNetAtr: -1 }), candidate: metric({ maximumDrawdownNetAtr: -1.05 }), folds: folds([1, 1, 1, 1, 1, 1]) })[7]!.passed).toBe(true);
    expect(evaluateR18PerformanceGates({ control: metric({ maximumDrawdownNetAtr: -1 }), candidate: metric({ maximumDrawdownNetAtr: -1.0500001 }), folds: folds([1, 1, 1, 1, 1, 1]) })[7]!.passed).toBe(false);
  });

  it("does not let H8/H12/H24 reporting values rescue a failed H4 gate", () => {
    const h4 = summarizeR18MetricRows([row(-1)], 4);
    const h8 = summarizeR18MetricRows([row(1)], 8);
    expect(h8.meanNetForwardAtr).toBe(1);
    expect(evaluateR18PerformanceGates({ control: metric(), candidate: h4, folds: folds([-1, -1, -1, -1, -1, -1]) })[0]!.passed).toBe(false);
  });

  it("uses only the six supplied validation folds, never outside-validation rows", () => {
    const validation = folds([1, 1, 1, 1, 1, 1]);
    const gates = evaluateR18PerformanceGates({ control: metric(), candidate: metric({ meanNetForwardAtr: 1 }), folds: validation });
    expect(gates[3]!.observed).toBe(6);
    expect(validation).toHaveLength(6);
  });

  it("does not treat NO_ENTRY or PERIOD_END_CENSORED as zero P/L", () => {
    expect(summarizeR18MetricRows([row(null)], 4).count).toBe(0);
    expect(summarizeR18MetricRows([row(null)], 4).cumulativeNetForwardAtr).toBe(0);
    expect(summarizeR18MetricRows([row(1)], 4).count).toBe(1);
  });

  it("fails closed on DATA_INCOMPLETE instead of producing an economic zero", () => {
    expect(() => buildR18EconomicMetricRow(observationWithStatuses("DATA_INCOMPLETE"))).toThrow(/DATA_INCOMPLETE/);
  });

  it("requires the frozen eight-gate conjunction for the final classification", () => {
    const noEdge = buildR18Selection(evaluateR18PerformanceGates({ control: metric(), candidate: metric({ meanNetForwardAtr: -1 }), folds: folds([-1, -1, -1, -1, -1, -1]) }));
    expect(noEdge.selectionExecuted).toBe(true);
    expect(noEdge.selectedCandidateId).toBeNull();
    expect(noEdge.finalDecision).toBe("NO ROBUST COMPONENT-CONSENSUS EDGE — ROUND-018");
  });
});
