import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { calculateBacktestMetrics } from "../src/lib/backtest/metrics.ts";
import type {
  BacktestEvaluation,
  BacktestSignalResult,
  BacktestSignalSnapshot,
} from "../src/lib/backtest/types.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../src/lib/config/constants.ts";
import {
  RESEARCH_BACKTEST_POLICY_VERSION,
  RESEARCH_CONTROL_EXPERIMENT_ID,
  RESEARCH_CONTROL_VARIANT_ID,
  RESEARCH_DATA_CLASSIFICATIONS,
  RESEARCH_FOLD_IDS,
  RESEARCH_FOLD_ROLES,
  RESEARCH_HYPOTHESIS_IDS,
  calculateResearchDiagnostics,
  calculateScoreBucketReport,
  createExperimentDefinition,
  createResearchDiagnosticsReport,
  getResearchFold,
  getResearchFoldRoleRange,
  isControlExperiment,
  orderResearchCandidates,
  selectRecordsForFoldRole,
  serializeResearchDiagnosticsReport,
  validateAndCanonicalizeResearchRecords,
  validateExperimentRegistry,
  validateResearchRange,
  validateScoreBucketDefinitions,
  validateSelectionGateSchema,
  attachExperimentOutcome,
  adaptBacktestSignalResult,
  assessScoreMonotonicity,
  assignScoreBucket,
  type ExperimentDefinition,
  type NormalizedResearchSignal,
  type ResearchRange,
  type ScoreBucketDiagnostics,
  type SelectionGateSchema,
} from "../src/lib/research/index.ts";

const HOUR = 60 * 60 * 1_000;
const BASE_TIME = Date.parse("2024-01-01T00:00:00.000Z");

function makeSignal(
  overrides: Partial<NormalizedResearchSignal> = {},
  index = 0,
): NormalizedResearchSignal {
  return Object.freeze({
    signalTime: BASE_TIME + index * HOUR,
    symbol: "BTCUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_NEUTRAL",
    totalScore: 80,
    grade: "B",
    status: "EXECUTED",
    entryTime: BASE_TIME + index * HOUR + HOUR,
    exitTime: BASE_TIME + index * HOUR + 2 * HOUR,
    grossR: 1,
    feeR: 0.1,
    fundingR: 0.05,
    netR: 0.85,
    ...overrides,
  });
}

function nonExecuted(overrides: Partial<NormalizedResearchSignal> = {}): NormalizedResearchSignal {
  return makeSignal({
    status: "ENTRY_OUTSIDE_BRACKET",
    entryTime: null,
    exitTime: null,
    grossR: null,
    feeR: null,
    fundingR: null,
    netR: null,
    ...overrides,
  });
}

function metricRange(records: readonly NormalizedResearchSignal[] = []): ResearchRange {
  return {
    startTime: records.length === 0 ? BASE_TIME : Math.min(...records.map((record) => record.signalTime)),
    endTime: records.length === 0 ? BASE_TIME : Math.max(...records.map((record) => record.signalTime)),
  };
}

function makeDefinition(overrides: Partial<ExperimentDefinition> = {}): ExperimentDefinition {
  return createExperimentDefinition({
    researchRoundId: "round-001",
    experimentId: "H1-variant-a",
    variantId: "variant-a",
    hypothesisId: "H1_SIGNAL_REDUNDANCY",
    exactChange: "No strategy change; diagnostic fixture only",
    rationale: "Synthetic deterministic test",
    parametersTested: [{ name: "window", unit: "hours" }],
    predeclaredParameterValues: { window: [6, 12, 24] },
    ...overrides,
  });
}

type BacktestResultOverrides = Omit<Partial<BacktestSignalResult>, "snapshot"> & {
  snapshot?: Partial<BacktestSignalSnapshot>;
};

function makeBacktestResult(overrides: BacktestResultOverrides = {}): BacktestSignalResult {
  const { snapshot: snapshotOverrides, ...resultOverrides } = overrides;
  const snapshot: BacktestSignalSnapshot = {
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    signalTime: BASE_TIME,
    symbol: "BTCUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_NEUTRAL",
    entryReference: 100,
    stopReference: 95,
    takeProfitReference: 110,
    stopDistance: 5,
    stopAtr: 1,
    breakdown: {
      trendStrength: 40,
      pullbackQuality: 20,
      breakoutStrength: 20,
      volumeScore: 10,
      riskRewardScore: 10,
    },
    totalScore: 90,
    grade: "A",
    ...snapshotOverrides,
  };
  return {
    snapshot,
    status: "EXECUTED",
    entryTime: snapshot.signalTime + HOUR,
    rawEntryPrice: 100,
    entryFill: 100,
    exitTime: snapshot.signalTime + 2 * HOUR,
    rawExitPrice: 110,
    exitFill: 110,
    heldCandleNumber: 2,
    exitReason: "TP",
    fundingCharges: [],
    fundingPnL: 0.05,
    priceR: 0.9,
    feeR: 0.1,
    fundingR: 0.05,
    grossR: 1,
    netR: 0.85,
    ...resultOverrides,
  };
}

function makeEvaluation(formalSignalCount: number): BacktestEvaluation {
  return {
    period: "DEV",
    evaluationTime: BASE_TIME,
    engineResult: {
      strategyVersion: "baseline-001",
      btcRegime: "BTC_NEUTRAL",
      evaluations: [],
      rankedCandidates: [],
    },
    evaluations: [],
    formalSignalCount,
  };
}

function sourceText(): string {
  const root = resolve(process.cwd(), "src/lib/research");
  return readdirSync(root)
    // Round-004 performance source is intentionally a later, separate
    // execution boundary and is covered by its own source-freeze suite.
    // Round-005 H17 qualification is an explicit data-qualification boundary,
    // not generic offline diagnostics tooling, and has its own B.1A suite.
    // Round-005 B.2 performance machinery is a future execution boundary,
    // covered by its dedicated offline implementation suite.
    // Round-006 protocol and performance machinery are a separate bounded
    // profitability-rebuild boundary with dedicated offline suites.
    // Round-007 model-level profitability machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-009 spec-conformance replay machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-010 risk-geometry replay machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-013 forward-edge discovery machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-014 crash-safe replay machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-015 beta/alpha decomposition machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-016 derivatives microstructure machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-017 thesis lifecycle machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-018 structural preflight machinery is a separate bounded
    // research boundary with dedicated offline suites.
    // Round-020 liquidation data preflight machinery is a separate metadata-only
    // boundary with a dedicated fail-closed suite.
    // Round-021 positioning-crowding data design is a separate metadata-only
    // boundary with a dedicated fail-closed suite.
    .filter((name) =>
      name.endsWith(".ts") &&
      !name.startsWith("m3-r4-round-004-") &&
      !name.startsWith("m3-r6-round-006-") &&
      !name.startsWith("m3-r7-round-007-") &&
      !name.startsWith("m3-r9-round-009-") &&
      !name.startsWith("m3-r10-round-010-") &&
      !name.startsWith("m3-r11-round-011-") &&
      !name.startsWith("m3-r13-round-013-") &&
      !name.startsWith("m3-r14-round-014-") &&
      !name.startsWith("m3-r15-round-015-") &&
      !name.startsWith("m3-r16-round-016-") &&
      !name.startsWith("m3-r17-round-017-") &&
      !name.startsWith("m3-r18-round-018-") &&
      !name.startsWith("m3-r20-") &&
      !name.startsWith("m3-r21-positioning-crowding-") &&
      name !== "selection-gates-round-013.ts" &&
      name !== "r13-drawdown.ts" &&
      name !== "selection-gates-round-007.ts" &&
      name !== "selection-gates-round-009.ts" &&
      name !== "selection-gates-round-010.ts" &&
      name !== "selection-gates-round-011.ts" &&
      name !== "selection-gates-round-015.ts" &&
      name !== "m3-r5-h17-funding-qualification.ts" &&
      name !== "m3-r5-round-005-performance.ts" &&
      name !== "m3-r5-round-005-settlement.ts",
    )
    .sort()
    .map((name) => readFileSync(resolve(root, name), "utf8"))
    .join("\n");
}

function completeGate(): SelectionGateSchema {
  const minimum = {
    value: 1,
    unit: "R",
    direction: "MINIMUM" as const,
    denominator: "executed trades",
    comparison: "AT_LEAST" as const,
  };
  const maximum = { ...minimum, direction: "MAXIMUM" as const, comparison: "AT_MOST" as const };
  return {
    researchRoundId: "round-001",
    sourceSha: "a7933d3014a7a6c3a2b2e8417e6ed7fc7c8f7585",
    minimumAggregateImprovement: minimum,
    minimumImprovedValidationFolds: minimum,
    catastrophicFoldLimit: maximum,
    minimumNetExpectancy: minimum,
    minimumProfitFactor: minimum,
    maximumSymbolConcentration: maximum,
    maximumSingleTradeConcentration: maximum,
    maximumFeeBurdenRatio: maximum,
    requiredRedundancyImprovement: minimum,
    minimumFormalSignals: minimum,
    minimumExecutedTrades: minimum,
    complexityTieThreshold: maximum,
    simplerCandidateRule: { rule: "prefer simpler", tieBreakOrder: ["parameterCount", "experimentId"] },
  };
}

describe("M3-G.1 frozen folds and normalized research records", () => {
  it("defines the exact F1-F6 UTC ranges", () => {
    expect(RESEARCH_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(RESEARCH_FOLD_ROLES).toEqual(["RESEARCH", "VALIDATION"]);
    expect(getResearchFold("F1")).toEqual({
      foldId: "F1",
      research: { startTime: Date.parse("2023-01-01T00:00:00.000Z"), endTime: Date.parse("2023-12-31T23:59:59.999Z") },
      validation: { startTime: Date.parse("2024-01-01T00:00:00.000Z"), endTime: Date.parse("2024-06-30T23:59:59.999Z") },
    });
    expect(getResearchFold("F6")).toEqual({
      foldId: "F6",
      research: { startTime: Date.parse("2023-01-01T00:00:00.000Z"), endTime: Date.parse("2026-03-31T23:59:59.999Z") },
      validation: { startTime: Date.parse("2026-04-01T00:00:00.000Z"), endTime: Date.parse("2026-08-15T23:59:59.999Z") },
    });
  });

  it("freezes the exact F2 research and validation ranges", () => {
    expect(getResearchFold("F2")).toEqual({
      foldId: "F2",
      research: { startTime: Date.parse("2023-01-01T00:00:00.000Z"), endTime: Date.parse("2024-06-30T23:59:59.999Z") },
      validation: { startTime: Date.parse("2024-07-01T00:00:00.000Z"), endTime: Date.parse("2024-12-31T23:59:59.999Z") },
    });
  });

  it("freezes the exact F3 research and validation ranges", () => {
    expect(getResearchFold("F3")).toEqual({
      foldId: "F3",
      research: { startTime: Date.parse("2023-01-01T00:00:00.000Z"), endTime: Date.parse("2024-12-31T23:59:59.999Z") },
      validation: { startTime: Date.parse("2025-01-01T00:00:00.000Z"), endTime: Date.parse("2025-06-30T23:59:59.999Z") },
    });
  });

  it("freezes the exact F4 research and validation ranges", () => {
    expect(getResearchFold("F4")).toEqual({
      foldId: "F4",
      research: { startTime: Date.parse("2023-01-01T00:00:00.000Z"), endTime: Date.parse("2025-06-30T23:59:59.999Z") },
      validation: { startTime: Date.parse("2025-07-01T00:00:00.000Z"), endTime: Date.parse("2025-12-31T23:59:59.999Z") },
    });
  });

  it("freezes the exact F5 research and validation ranges", () => {
    expect(getResearchFold("F5")).toEqual({
      foldId: "F5",
      research: { startTime: Date.parse("2023-01-01T00:00:00.000Z"), endTime: Date.parse("2025-12-31T23:59:59.999Z") },
      validation: { startTime: Date.parse("2026-01-01T00:00:00.000Z"), endTime: Date.parse("2026-03-31T23:59:59.999Z") },
    });
  });

  it("includes exact fold start and end boundaries", () => {
    const fold = getResearchFold("F2");
    expect(selectRecordsForFoldRole([
      makeSignal({ signalTime: fold.research.startTime }),
      makeSignal({ signalTime: fold.research.endTime }, 1),
      makeSignal({ signalTime: fold.research.endTime + 1 }, 2),
    ], "F2", "RESEARCH")).toHaveLength(2);
  });

  it("includes exact validation start and end boundaries", () => {
    const fold = getResearchFold("F3");
    expect(selectRecordsForFoldRole([
      makeSignal({ signalTime: fold.validation.startTime }),
      makeSignal({ signalTime: fold.validation.endTime }, 1),
      makeSignal({ signalTime: fold.validation.endTime + 1 }, 2),
    ], "F3", "VALIDATION")).toHaveLength(2);
  });

  it("keeps intentionally overlapping research ranges", () => {
    expect(getResearchFold("F1").research.endTime).toBeGreaterThan(getResearchFold("F2").research.startTime);
    expect(getResearchFold("F5").research.endTime).toBeGreaterThan(getResearchFold("F6").research.startTime);
  });

  it("uses deterministic chronological calendar ranges", () => {
    for (const foldId of RESEARCH_FOLD_IDS) {
      const fold = getResearchFold(foldId);
      expect(fold.research.startTime).toBeLessThanOrEqual(fold.research.endTime);
      expect(fold.validation.startTime).toBeLessThanOrEqual(fold.validation.endTime);
    }
  });

  it("does not shuffle fold selections", () => {
    const records = [makeSignal({ signalTime: BASE_TIME + 2 * HOUR }), makeSignal({ signalTime: BASE_TIME })];
    expect(selectRecordsForFoldRole(records, "F2", "RESEARCH")).toEqual(records);
  });

  it("rejects an invalid research range", () => {
    expect(() => validateResearchRange({ startTime: 2, endTime: 1 })).toThrow();
  });

  it("fails closed on duplicate formal identity", () => {
    const duplicate = [makeSignal(), makeSignal()];
    expect(() => validateAndCanonicalizeResearchRecords(duplicate)).toThrow(/Duplicate formal research identity/);
  });

  it("adapts a BacktestSignalResult without requiring a strategy version", () => {
    const source = makeBacktestResult();
    const adapted = adaptBacktestSignalResult(source);
    expect(adapted).toMatchObject({ signalTime: BASE_TIME, netR: 0.85, status: "EXECUTED" });
    expect(adapted).not.toHaveProperty("strategyVersion");
    expect(Object.isFrozen(adapted)).toBe(true);
  });
});

describe("M3-G.1 signal density and redundancy diagnostics", () => {
  it("uses an inclusive UTC calendar-day denominator", () => {
    const start = Date.parse("2024-01-01T23:00:00.000Z");
    const end = Date.parse("2024-01-03T00:00:00.000Z");
    const diagnostics = calculateResearchDiagnostics({
      records: [makeSignal({ signalTime: start })],
      range: { startTime: start, endTime: end },
    });
    expect(diagnostics.utcCalendarDays).toBe(3);
    expect(diagnostics.signalsPerDay).toBe(1 / 3);
  });

  it("never returns an invalid denominator", () => {
    expect(() => calculateResearchDiagnostics({ records: [], range: { startTime: 2, endTime: 1 } })).toThrow();
    const empty = calculateResearchDiagnostics({ records: [], range: { startTime: BASE_TIME, endTime: BASE_TIME } });
    expect(Number.isFinite(empty.signalsPerDay)).toBe(true);
    expect(JSON.stringify(empty)).not.toMatch(/NaN|Infinity/);
  });

  it("returns fixed five-symbol signal counts in fixed order", () => {
    const diagnostics = calculateResearchDiagnostics({
      records: RESEARCH_SYMBOLS.map((symbol, index) => makeSignal({ symbol, signalTime: BASE_TIME + index * HOUR }, index)),
      range: metricRange(RESEARCH_SYMBOLS.map((symbol, index) => makeSignal({ symbol, signalTime: BASE_TIME + index * HOUR }, index))),
    });
    expect(Object.keys(diagnostics.signalsPerSymbol)).toEqual([...RESEARCH_SYMBOLS]);
    expect(Object.values(diagnostics.signalsPerSymbol)).toEqual([1, 1, 1, 1, 1]);
  });

  it("counts overall and per-symbol unique signal hours", () => {
    const diagnostics = calculateResearchDiagnostics({
      records: [
        makeSignal({ signalTime: BASE_TIME, symbol: "BTCUSDT" }),
        makeSignal({ signalTime: BASE_TIME, symbol: "ETHUSDT" }),
        makeSignal({ signalTime: BASE_TIME + HOUR, symbol: "BTCUSDT" }, 1),
      ],
      range: metricRange([
        makeSignal({ signalTime: BASE_TIME, symbol: "BTCUSDT" }),
        makeSignal({ signalTime: BASE_TIME, symbol: "ETHUSDT" }),
        makeSignal({ signalTime: BASE_TIME + HOUR, symbol: "BTCUSDT" }, 1),
      ]),
    });
    expect(diagnostics.uniqueSignalHours).toBe(2);
    expect(diagnostics.uniqueSignalHoursBySymbol).toMatchObject({ BTCUSDT: 2, ETHUSDT: 1 });
  });

  it("includes exact 6h, 12h, and 24h repeat boundaries", () => {
    const records = [
      makeSignal({ signalTime: BASE_TIME }),
      makeSignal({ signalTime: BASE_TIME + 6 * HOUR }, 6),
      makeSignal({ signalTime: BASE_TIME + 12 * HOUR }, 12),
      makeSignal({ signalTime: BASE_TIME + 24 * HOUR }, 24),
    ];
    const diagnostics = calculateResearchDiagnostics({ records, range: metricRange(records) });
    expect(diagnostics.repeatSignalsWithin6h).toBe(2);
    expect(diagnostics.repeatSignalsWithin12h).toBe(3);
    expect(diagnostics.repeatSignalsWithin24h).toBe(3);
  });

  it("counts an exact 12h repeat boundary", () => {
    const records = [makeSignal(), makeSignal({ signalTime: BASE_TIME + 12 * HOUR }, 12)];
    expect(calculateResearchDiagnostics({ records, range: metricRange(records) }).repeatSignalsWithin12h).toBe(1);
  });

  it("counts an exact 24h repeat boundary", () => {
    const records = [makeSignal(), makeSignal({ signalTime: BASE_TIME + 24 * HOUR }, 24)];
    expect(calculateResearchDiagnostics({ records, range: metricRange(records) }).repeatSignalsWithin24h).toBe(1);
  });

  it("excludes a repeat just beyond 6h", () => {
    const records = [makeSignal(), makeSignal({ signalTime: BASE_TIME + 6 * HOUR + 1 }, 7)];
    expect(calculateResearchDiagnostics({ records, range: metricRange(records) }).repeatSignalsWithin6h).toBe(0);
  });

  it("counts a repeated identity once rather than counting pairs", () => {
    const records = [
      makeSignal(),
      makeSignal({ signalTime: BASE_TIME + HOUR }, 1),
      makeSignal({ signalTime: BASE_TIME + 2 * HOUR }, 2),
    ];
    expect(calculateResearchDiagnostics({ records, range: metricRange(records) }).repeatSignalsWithin24h).toBe(2);
  });

  it("does not treat a simultaneous signal as an earlier repeat", () => {
    const records = [
      makeSignal({ symbol: "BTCUSDT", signalTime: BASE_TIME }),
      makeSignal({ symbol: "ETHUSDT", signalTime: BASE_TIME }, 1),
    ];
    expect(calculateResearchDiagnostics({ records, range: metricRange(records) }).repeatSignalsWithin24h).toBe(0);
  });

  it("overlaps only same-symbol same-direction research horizons", () => {
    const records = [
      makeSignal({ signalTime: BASE_TIME }),
      makeSignal({ signalTime: BASE_TIME + 2 * HOUR }, 2),
      makeSignal({ signalTime: BASE_TIME + HOUR, direction: "SHORT" }, 1),
      makeSignal({ signalTime: BASE_TIME + HOUR, symbol: "ETHUSDT" }, 3),
    ];
    const diagnostics = calculateResearchDiagnostics({ records, range: metricRange(records) });
    expect(diagnostics.overlappingSignalCount).toBe(2);
  });

  it("does not overlap opposite directions", () => {
    const records = [makeSignal(), makeSignal({ direction: "SHORT", signalTime: BASE_TIME + HOUR }, 1)];
    expect(calculateResearchDiagnostics({ records, range: metricRange(records) }).overlappingSignalCount).toBe(0);
  });

  it("does not overlap different symbols", () => {
    const records = [makeSignal(), makeSignal({ symbol: "ETHUSDT", signalTime: BASE_TIME + HOUR }, 1)];
    expect(calculateResearchDiagnostics({ records, range: metricRange(records) }).overlappingSignalCount).toBe(0);
  });

  it("uses a closed-interval horizon boundary and not early exitTime", () => {
    const records = [
      makeSignal({ signalTime: BASE_TIME, exitTime: BASE_TIME + HOUR }),
      makeSignal({ signalTime: BASE_TIME + 24 * HOUR - 1 }, 24),
    ];
    const diagnostics = calculateResearchDiagnostics({ records, range: metricRange(records) });
    expect(diagnostics.overlappingSignalCount).toBe(2);
    expect(diagnostics.overlappingSignalRate).toBe(1);
  });

  it("does not overlap at a horizon gap or when there is no signal", () => {
    const records = [makeSignal(), makeSignal({ signalTime: BASE_TIME + 24 * HOUR }, 24)];
    expect(calculateResearchDiagnostics({ records, range: metricRange(records) }).overlappingSignalCount).toBe(0);
    const empty = calculateResearchDiagnostics({ records: [], range: { startTime: BASE_TIME, endTime: BASE_TIME } });
    expect(empty.overlappingSignalRate).toBeNull();
  });
});

describe("M3-G.1 cost, concentration, and breakdown diagnostics", () => {
  it("computes gross, fee, funding, net, and per-executed-signal values", () => {
    const records = [
      makeSignal({ grossR: 2, feeR: 0.2, fundingR: 0.1, netR: 1.7 }),
      makeSignal({ signalTime: BASE_TIME + HOUR, grossR: -1, feeR: 0.1, fundingR: -0.1, netR: -1.2 }, 1),
    ];
    const diagnostics = calculateResearchDiagnostics({ records, range: metricRange(records) });
    expect(diagnostics).toMatchObject({
      executedTrades: 2,
      grossR: 1,
      fundingR: 0,
      netR: 0.5,
      netRPerExecutedSignal: 0.25,
    });
    expect(diagnostics.feeR).toBeCloseTo(0.3);
    expect(diagnostics.feeBurdenRatio).toBeCloseTo(0.3);
  });

  it("computes normal profit factor", () => {
    const diagnostics = calculateResearchDiagnostics({
      records: [makeSignal({ netR: 2 }), makeSignal({ signalTime: BASE_TIME + HOUR, netR: -1 }, 1)],
      range: metricRange([makeSignal({ netR: 2 }), makeSignal({ signalTime: BASE_TIME + HOUR, netR: -1 }, 1)]),
    });
    expect(diagnostics.profitFactor).toBe(2);
    expect(diagnostics.profitFactorStatus).toBe("NORMAL");
  });

  it("reports NO_LOSSES and NO_TRADES without Infinity", () => {
    const noLoss = calculateResearchDiagnostics({ records: [makeSignal({ netR: 1 })], range: metricRange() });
    const noTrades = calculateResearchDiagnostics({ records: [nonExecuted()], range: metricRange() });
    expect(noLoss).toMatchObject({ profitFactor: null, profitFactorStatus: "NO_LOSSES" });
    expect(noTrades).toMatchObject({ profitFactor: null, profitFactorStatus: "NO_TRADES", expectancyR: null });
    expect(JSON.stringify(noLoss)).not.toMatch(/NaN|Infinity/);
  });

  it("returns a null fee burden when grossR is zero", () => {
    const diagnostics = calculateResearchDiagnostics({ records: [makeSignal({ grossR: 0, netR: -0.1 })], range: metricRange() });
    expect(diagnostics.feeBurdenRatio).toBeNull();
  });

  it("rejects NaN and Infinity and never serializes them", () => {
    expect(() => calculateResearchDiagnostics({ records: [makeSignal({ netR: Number.NaN })], range: metricRange() })).toThrow();
    expect(() => calculateResearchDiagnostics({ records: [makeSignal({ grossR: Number.POSITIVE_INFINITY })], range: metricRange() })).toThrow();
  });

  it("computes positive-only concentration", () => {
    const diagnostics = calculateResearchDiagnostics({
      records: [
        makeSignal({ symbol: "BTCUSDT", netR: 2 }),
        makeSignal({ symbol: "ETHUSDT", signalTime: BASE_TIME + HOUR, netR: 1 }, 1),
        makeSignal({ symbol: "SOLUSDT", signalTime: BASE_TIME + 2 * HOUR, netR: -10 }, 2),
      ],
      range: metricRange([
        makeSignal({ symbol: "BTCUSDT", netR: 2 }),
        makeSignal({ symbol: "ETHUSDT", signalTime: BASE_TIME + HOUR, netR: 1 }, 1),
        makeSignal({ symbol: "SOLUSDT", signalTime: BASE_TIME + 2 * HOUR, netR: -10 }, 2),
      ]),
    });
    expect(diagnostics).toMatchObject({
      totalPositiveNetR: 3,
      topSymbolShareOfPositiveNetR: 0.666666666667,
      largestSingleTradeShareOfPositiveNetR: 0.666666666667,
    });
  });

  it("returns null concentration shares when there is no positive net R", () => {
    const diagnostics = calculateResearchDiagnostics({ records: [makeSignal({ netR: -1 })], range: metricRange() });
    expect(diagnostics.totalPositiveNetR).toBe(0);
    expect(diagnostics.topSymbolShareOfPositiveNetR).toBeNull();
    expect(diagnostics.largestSingleTradeShareOfPositiveNetR).toBeNull();
  });

  it("provides fixed symbol and direction breakdowns", () => {
    const records = [
      makeSignal({ symbol: "ETHUSDT", direction: "SHORT", signalTime: BASE_TIME + HOUR }, 1),
    ];
    const diagnostics = calculateResearchDiagnostics({ records, range: metricRange(records) });
    expect(Object.keys(diagnostics.bySymbol)).toEqual([...RESEARCH_SYMBOLS]);
    expect(diagnostics.bySymbol.ETHUSDT.formalSignals).toBe(1);
    expect(diagnostics.byDirection.SHORT.executedTrades).toBe(1);
  });

  it("provides grade, BTC regime, and symbol regime breakdowns", () => {
    const record = makeSignal({ grade: null, btcRegime: "BTC_STRONG_BEAR", symbolRegime: "SHORT_ONLY" });
    const diagnostics = calculateResearchDiagnostics({ records: [record], range: metricRange() });
    expect(diagnostics.byGrade.UNGRADED.formalSignals).toBe(1);
    expect(diagnostics.byBtcRegime.BTC_STRONG_BEAR.formalSignals).toBe(1);
    expect(diagnostics.bySymbolRegime.SHORT_ONLY.formalSignals).toBe(1);
  });

  it("provides UTC month and year breakdowns from signalTime", () => {
    const time = Date.parse("2025-07-15T12:00:00.000Z");
    const diagnostics = calculateResearchDiagnostics({ records: [makeSignal({ signalTime: time })], range: { startTime: time, endTime: time } });
    expect(diagnostics.byUtcSignalMonth["2025-07"]?.formalSignals).toBe(1);
    expect(diagnostics.byUtcSignalYear["2025"]?.formalSignals).toBe(1);
  });
});

describe("M3-G.1 generic score buckets", () => {
  const buckets = [
    { id: "LOW", minInclusive: 0, maxExclusive: 70 },
    { id: "HIGH", minInclusive: 70, maxExclusive: null },
  ] as const;

  it("orders and calculates supplied score buckets deterministically", () => {
    const records = [makeSignal({ totalScore: 80 }), makeSignal({ signalTime: BASE_TIME + HOUR, totalScore: 60 }, 1)];
    const report = calculateScoreBucketReport({ records, buckets: [...buckets].reverse() });
    expect(report.buckets.map((bucket) => bucket.bucket.id)).toEqual(["LOW", "HIGH"]);
    expect(report.buckets.map((bucket) => bucket.formalSignals)).toEqual([1, 1]);
  });

  it("rejects overlapping score ranges and duplicate bucket IDs", () => {
    expect(() => validateScoreBucketDefinitions([
      { id: "A", minInclusive: 0, maxExclusive: 10 },
      { id: "B", minInclusive: 9, maxExclusive: 20 },
    ])).toThrow(/Overlapping/);
    expect(() => validateScoreBucketDefinitions([
      { id: "A", minInclusive: 0, maxExclusive: 10 },
      { id: "A", minInclusive: 10, maxExclusive: null },
    ])).toThrow(/Duplicate/);
  });

  it("requires an open-ended score bucket to be last", () => {
    expect(() => validateScoreBucketDefinitions([
      { id: "OPEN", minInclusive: 0, maxExclusive: null },
      { id: "LATER", minInclusive: 10, maxExclusive: 20 },
    ])).toThrow(/open-ended/);
  });

  it("makes unassigned score behavior explicit", () => {
    expect(assignScoreBucket(100, [{ id: "LOW", minInclusive: 0, maxExclusive: 70 }])).toBe("UNASSIGNED");
    const report = calculateScoreBucketReport({ records: [makeSignal({ totalScore: 100 })], buckets: [{ id: "LOW", minInclusive: 0, maxExclusive: 70 }] });
    expect(report.unassignedScoreCount).toBe(1);
  });

  it("classifies increasing, decreasing, mixed, and insufficient expectancy", () => {
    const bucket = (expectancyR: number | null): ScoreBucketDiagnostics => ({
      bucket: { id: String(expectancyR), minInclusive: 0, maxExclusive: null },
      formalSignals: expectancyR === null ? 0 : 1,
      executedTrades: expectancyR === null ? 0 : 1,
      grossR: 0,
      feeR: 0,
      fundingR: 0,
      netR: expectancyR ?? 0,
      expectancyR,
      profitFactor: null,
      profitFactorStatus: expectancyR === null ? "NO_TRADES" : "NO_LOSSES",
      winRate: expectancyR === null ? null : 1,
      feeBurdenRatio: null,
    });
    expect(assessScoreMonotonicity([bucket(1), bucket(2)])).toBe("NON_DECREASING");
    expect(assessScoreMonotonicity([bucket(2), bucket(1)])).toBe("NON_INCREASING");
    expect(assessScoreMonotonicity([bucket(1), bucket(3), bucket(2)])).toBe("MIXED");
    expect(assessScoreMonotonicity([bucket(null), bucket(1)])).toBe("INSUFFICIENT_DATA");
  });
});

describe("M3-G.1 immutable experiment registry and candidate ordering", () => {
  it("exposes only the frozen H1-H5 hypothesis registry and control", () => {
    expect(RESEARCH_HYPOTHESIS_IDS).toEqual([
      "H1_SIGNAL_REDUNDANCY",
      "H2_COST_ADJUSTED_EDGE",
      "H3_SCORE_CALIBRATION",
      "H4_SIGNAL_DENSITY",
      "H5_REGIME_QUALITY",
    ]);
    expect(isControlExperiment({ experimentId: RESEARCH_CONTROL_EXPERIMENT_ID })).toBe(true);
    expect(RESEARCH_CONTROL_VARIANT_ID).toBe("CONTROL_BASELINE_001");
  });

  it("rejects duplicate experiment IDs and normalizes an immutable registry", () => {
    const registry = validateExperimentRegistry([makeDefinition()]);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry[0])).toBe(true);
    expect(() => validateExperimentRegistry([makeDefinition(), makeDefinition({ variantId: "variant-b" })])).toThrow(/Duplicate experimentId/);
  });

  it("rejects more than five scalar candidates and duplicate candidates", () => {
    expect(() => makeDefinition({ predeclaredParameterValues: { window: [1, 2, 3, 4, 5, 6] } })).toThrow(/five/);
    expect(() => makeDefinition({ predeclaredParameterValues: { window: [1, 1] } })).toThrow(/duplicate/);
  });

  it("requires named parameters with units and unique names", () => {
    expect(() => makeDefinition({ parametersTested: [{ name: "window", unit: "" }] })).toThrow(/unit/);
    expect(() => makeDefinition({
      parametersTested: [{ name: "window", unit: "hours" }, { name: "window", unit: "bars" }],
      predeclaredParameterValues: { window: [1] },
    })).toThrow(/duplicate/);
  });

  it("requires parameter value keys and candidate counts to match declarations", () => {
    expect(() => makeDefinition({ predeclaredParameterValues: { other: [1] } })).toThrow(/not declared/);
    expect(() => makeDefinition({ predeclaredParameterValues: {} })).toThrow(/exactly one entry/);
    expect(() => makeDefinition({ predeclaredParameterValues: { window: [] } })).toThrow(/at least one/);
    expect(makeDefinition({ predeclaredParameterValues: { window: [12] } }).predeclaredParameterValues).toEqual({ window: [12] });
  });

  it("allows an explicitly non-tunable definition only when both parameter collections are empty", () => {
    const definition = makeDefinition({ parametersTested: [], predeclaredParameterValues: {} });
    expect(definition.parametersTested).toEqual([]);
    expect(definition.predeclaredParameterValues).toEqual({});
  });

  it("does not expand a Cartesian parameter grid", () => {
    const definition = makeDefinition({
      parametersTested: [{ name: "a", unit: "count" }, { name: "b", unit: "label" }],
      predeclaredParameterValues: { a: [1, 2], b: ["x", "y"] },
    });
    expect(definition.predeclaredParameterValues).toEqual({ a: [1, 2], b: ["x", "y"] });
    expect(Object.keys(definition.predeclaredParameterValues)).toHaveLength(2);
  });

  it("attaches a synthetic outcome without mutating the definition", () => {
    const definition = makeDefinition();
    const before = JSON.stringify(definition);
    const outcome = attachExperimentOutcome(definition, { classification: "SYNTHETIC_FIXTURE" }, "REVIEW");
    expect(JSON.stringify(definition)).toBe(before);
    expect(outcome.definition).toEqual(definition);
    expect(Object.isFrozen(outcome)).toBe(true);
  });

  it("orders control first and then only deterministic identity fields", () => {
    const candidates: Array<{
      experimentId: string;
      variantId: string;
      parameterValues: Record<string, number>;
      netR: number;
    }> = [
      { experimentId: "Z", variantId: "a", parameterValues: { threshold: 1 }, netR: -100 },
      { experimentId: RESEARCH_CONTROL_EXPERIMENT_ID, variantId: RESEARCH_CONTROL_VARIANT_ID, parameterValues: {}, netR: -1 },
      { experimentId: "A", variantId: "z", parameterValues: { threshold: 2 }, netR: 100 },
    ];
    const ordered = orderResearchCandidates(candidates);
    expect(ordered.map((candidate) => candidate.experimentId)).toEqual([RESEARCH_CONTROL_EXPERIMENT_ID, "A", "Z"]);
  });

  it("does not change candidate ordering when only performance values change", () => {
    const candidates: Array<{
      experimentId: string;
      variantId: string;
      parameterValues: Record<string, number>;
      netR: number;
    }> = [
      { experimentId: "B", variantId: "b", parameterValues: {}, netR: 100 },
      { experimentId: "A", variantId: "a", parameterValues: {}, netR: -100 },
    ];
    const changed = candidates.map((candidate) => ({ ...candidate, netR: -candidate.netR }));
    expect(orderResearchCandidates(candidates).map((candidate) => candidate.experimentId)).toEqual(
      orderResearchCandidates(changed).map((candidate) => candidate.experimentId),
    );
  });
});

describe("M3-G.1 provenance, serialization, and gate schema", () => {
  it("requires a positive safe studyServerTime and frozen provenance values", () => {
    const range = getResearchFoldRoleRange("F1", "RESEARCH");
    const diagnostics = calculateResearchDiagnostics({ records: [], range });
    const input = {
      researchRoundId: "round-001",
      experimentId: RESEARCH_CONTROL_EXPERIMENT_ID,
      variantId: RESEARCH_CONTROL_VARIANT_ID,
      foldId: "F1" as const,
      foldRole: "RESEARCH" as const,
      range,
      dataClassification: RESEARCH_DATA_CLASSIFICATIONS[1],
      backtestPolicyVersion: RESEARCH_BACKTEST_POLICY_VERSION,
      studyServerTime: BASE_TIME,
      diagnostics,
    };
    expect(createResearchDiagnosticsReport(input).schemaVersion).toBe("m3-g-research-diagnostics-001");
    expect(() => createResearchDiagnosticsReport({ ...input, studyServerTime: 0 })).toThrow();
    expect(() => createResearchDiagnosticsReport({ ...input, studyServerTime: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  });

  it("rejects a report range or diagnostics range that is not the frozen fold-role range", () => {
    const range = getResearchFoldRoleRange("F1", "RESEARCH");
    const diagnostics = calculateResearchDiagnostics({ records: [], range });
    const input = {
      researchRoundId: "round-001",
      experimentId: RESEARCH_CONTROL_EXPERIMENT_ID,
      variantId: RESEARCH_CONTROL_VARIANT_ID,
      foldId: "F1" as const,
      foldRole: "RESEARCH" as const,
      range,
      dataClassification: "SYNTHETIC_FIXTURE" as const,
      backtestPolicyVersion: RESEARCH_BACKTEST_POLICY_VERSION,
      studyServerTime: BASE_TIME,
      diagnostics,
    };
    expect(() => createResearchDiagnosticsReport({
      ...input,
      range: { ...range, startTime: range.startTime + 1 },
    })).toThrow(/frozen fold-role range/);
    expect(() => createResearchDiagnosticsReport({
      ...input,
      diagnostics: { ...diagnostics, range: { ...range, endTime: range.endTime - 1 } },
    })).toThrow(/diagnostics range/);
  });

  it("serializes reports byte-stably and canonicalizes irrelevant input order", () => {
    const records = [makeSignal({ signalTime: BASE_TIME + HOUR }, 1), makeSignal()];
    const frozenRange = getResearchFoldRoleRange("F2", "RESEARCH");
    const diagnosticsA = calculateResearchDiagnostics({ records, range: frozenRange });
    const diagnosticsB = calculateResearchDiagnostics({ records: [...records].reverse(), range: frozenRange });
    const base = {
      researchRoundId: "round-001",
      experimentId: RESEARCH_CONTROL_EXPERIMENT_ID,
      variantId: RESEARCH_CONTROL_VARIANT_ID,
      foldId: "F2" as const,
      foldRole: "RESEARCH" as const,
      range: frozenRange,
      dataClassification: "SYNTHETIC_FIXTURE" as const,
      backtestPolicyVersion: RESEARCH_BACKTEST_POLICY_VERSION,
      studyServerTime: BASE_TIME,
    };
    const first = serializeResearchDiagnosticsReport(createResearchDiagnosticsReport({ ...base, diagnostics: diagnosticsA }));
    const second = serializeResearchDiagnosticsReport(createResearchDiagnosticsReport({ ...base, diagnostics: diagnosticsB }));
    expect(first).toBe(second);
    expect(first).toBe(serializeResearchDiagnosticsReport(createResearchDiagnosticsReport({ ...base, diagnostics: diagnosticsA })));
  });

  it("accepts a synthetic complete gate schema without defining production values", () => {
    const validated = validateSelectionGateSchema(completeGate());
    expect(validated.sourceSha).toBe("a7933d3014a7a6c3a2b2e8417e6ed7fc7c8f7585");
    expect(Object.isFrozen(validated)).toBe(true);
    expect(sourceText()).not.toMatch(/DEFAULT_SELECTION_GATES/);
  });

  it("rejects an invalid gate comparison direction", () => {
    const gate = completeGate();
    expect(() => validateSelectionGateSchema({
      ...gate,
      minimumFormalSignals: {
        ...gate.minimumFormalSignals,
        direction: "INVALID",
      } as unknown as SelectionGateSchema["minimumFormalSignals"],
    })).toThrow(/direction/);
  });

  it("enforces the frozen direction and comparison semantics for every gate", () => {
    const semantics = {
      minimumAggregateImprovement: ["MINIMUM", "AT_LEAST"],
      minimumImprovedValidationFolds: ["MINIMUM", "AT_LEAST"],
      catastrophicFoldLimit: ["MAXIMUM", "AT_MOST"],
      minimumNetExpectancy: ["MINIMUM", "AT_LEAST"],
      minimumProfitFactor: ["MINIMUM", "AT_LEAST"],
      maximumSymbolConcentration: ["MAXIMUM", "AT_MOST"],
      maximumSingleTradeConcentration: ["MAXIMUM", "AT_MOST"],
      maximumFeeBurdenRatio: ["MAXIMUM", "AT_MOST"],
      requiredRedundancyImprovement: ["MINIMUM", "AT_LEAST"],
      minimumFormalSignals: ["MINIMUM", "AT_LEAST"],
      minimumExecutedTrades: ["MINIMUM", "AT_LEAST"],
      complexityTieThreshold: ["MAXIMUM", "AT_MOST"],
    } as const;
    for (const [field, [direction, comparison]] of Object.entries(semantics)) {
      const gate = completeGate();
      const wrongDirection = direction === "MINIMUM" ? "MAXIMUM" : "MINIMUM";
      expect(() => validateSelectionGateSchema({
        ...gate,
        [field]: { ...gate[field as keyof typeof semantics], direction: wrongDirection },
      } as unknown as SelectionGateSchema)).toThrow(/direction/);
      const wrongComparison = comparison === "AT_LEAST" ? "AT_MOST" : "AT_LEAST";
      expect(() => validateSelectionGateSchema({
        ...gate,
        [field]: { ...gate[field as keyof typeof semantics], comparison: wrongComparison },
      } as unknown as SelectionGateSchema)).toThrow(/comparison/);
    }
  });

  it("rejects duplicate simpler-candidate tie-break fields", () => {
    const gate = completeGate();
    expect(() => validateSelectionGateSchema({
      ...gate,
      simplerCandidateRule: { ...gate.simplerCandidateRule, tieBreakOrder: ["parameterCount", "parameterCount"] },
    })).toThrow(/duplicate/);
  });
});

describe("M3-G.1 control reproducibility and source boundary", () => {
  it("matches existing backtest economics for a synthetic baseline-001 control", () => {
    const result = makeBacktestResult();
    const existing = calculateBacktestMetrics({
      evaluations: [makeEvaluation(1)],
      signalResults: [result],
    });
    const research = calculateResearchDiagnostics({
      records: [adaptBacktestSignalResult(result)],
      range: { startTime: BASE_TIME, endTime: BASE_TIME },
    });
    expect(research).toMatchObject({
      executedTrades: existing.executedTrades,
      grossR: existing.grossR,
      netR: existing.netR,
      profitFactor: existing.profitFactor,
      profitFactorStatus: existing.profitFactorStatus,
      expectancyR: existing.expectancyR,
      winRate: existing.winRate,
      feeR: existing.cumulativeFeeR,
      fundingR: existing.cumulativeFundingR,
      totalPositiveNetR: existing.totalPositiveNetR,
      topSymbolShareOfPositiveNetR: existing.topSymbolShareOfPositiveNetR,
      largestSingleTradeShareOfPositiveNetR: existing.largestSingleTradeShareOfPositiveNetR,
    });
  });

  it("matches backtest economics for interleaved multi-symbol LONG/SHORT trades and is input-order invariant", () => {
    const results = [
      makeBacktestResult({
        snapshot: { signalTime: BASE_TIME + 2 * HOUR, symbol: "SOLUSDT", direction: "SHORT" },
        grossR: 0.4,
        feeR: 0.04,
        fundingR: -0.02,
        netR: 0.333333333333,
      }),
      makeBacktestResult({
        snapshot: { signalTime: BASE_TIME + HOUR, symbol: "BTCUSDT", direction: "LONG" },
        grossR: 0.8,
        feeR: 0.08,
        fundingR: 0.02,
        netR: 0.7,
      }),
      makeBacktestResult({
        snapshot: { signalTime: BASE_TIME, symbol: "ETHUSDT", direction: "LONG" },
        grossR: 1.2,
        feeR: 0.1,
        fundingR: 0.0,
        netR: 1.1,
      }),
      makeBacktestResult({
        snapshot: { signalTime: BASE_TIME + HOUR, symbol: "XRPUSDT", direction: "SHORT" },
        grossR: -0.2,
        feeR: 0.03,
        fundingR: -0.01,
        netR: -0.2,
      }),
      makeBacktestResult({
        snapshot: { signalTime: BASE_TIME, symbol: "BTCUSDT", direction: "SHORT" },
        grossR: -0.4,
        feeR: 0.05,
        fundingR: -0.02,
        netR: -0.4,
      }),
    ];
    const existing = calculateBacktestMetrics({
      evaluations: [makeEvaluation(results.length)],
      signalResults: results,
    });
    const records = results.map(adaptBacktestSignalResult);
    const research = calculateResearchDiagnostics({ records, range: metricRange(records) });
    const common = (metrics: typeof existing) => ({
      grossR: metrics.grossR,
      netR: metrics.netR,
      feeR: metrics.cumulativeFeeR,
      fundingR: metrics.cumulativeFundingR,
      profitFactor: metrics.profitFactor,
      profitFactorStatus: metrics.profitFactorStatus,
      expectancyR: metrics.expectancyR,
      winRate: metrics.winRate,
      totalPositiveNetR: metrics.totalPositiveNetR,
      topSymbolShareOfPositiveNetR: metrics.topSymbolShareOfPositiveNetR,
      largestSingleTradeShareOfPositiveNetR: metrics.largestSingleTradeShareOfPositiveNetR,
    });
    expect({
      grossR: research.grossR,
      netR: research.netR,
      feeR: research.feeR,
      fundingR: research.fundingR,
      profitFactor: research.profitFactor,
      profitFactorStatus: research.profitFactorStatus,
      expectancyR: research.expectancyR,
      winRate: research.winRate,
      totalPositiveNetR: research.totalPositiveNetR,
      topSymbolShareOfPositiveNetR: research.topSymbolShareOfPositiveNetR,
      largestSingleTradeShareOfPositiveNetR: research.largestSingleTradeShareOfPositiveNetR,
    }).toEqual(common(existing));
    expect(existing.profitFactor).not.toBe(Math.floor(existing.profitFactor!));
    expect(existing.topSymbolShareOfPositiveNetR).not.toBe(Math.floor(existing.topSymbolShareOfPositiveNetR!));
    const permutedResearch = calculateResearchDiagnostics({
      records: [...records].reverse(),
      range: metricRange(records),
    });
    expect({
      grossR: permutedResearch.grossR,
      netR: permutedResearch.netR,
      feeR: permutedResearch.feeR,
      fundingR: permutedResearch.fundingR,
      profitFactor: permutedResearch.profitFactor,
      profitFactorStatus: permutedResearch.profitFactorStatus,
      expectancyR: permutedResearch.expectancyR,
      winRate: permutedResearch.winRate,
      totalPositiveNetR: permutedResearch.totalPositiveNetR,
      topSymbolShareOfPositiveNetR: permutedResearch.topSymbolShareOfPositiveNetR,
      largestSingleTradeShareOfPositiveNetR: permutedResearch.largestSingleTradeShareOfPositiveNetR,
    }).toEqual(common(existing));
  });

  it("does not mutate BacktestSignalResult inputs", () => {
    const result = makeBacktestResult();
    const before = JSON.stringify(result);
    adaptBacktestSignalResult(result);
    expect(JSON.stringify(result)).toBe(before);
  });

  it("does not produce baseline-002 strategy versions", () => {
    const adapted = adaptBacktestSignalResult(makeBacktestResult());
    expect(JSON.stringify(adapted)).not.toContain("baseline-002");
    expect(sourceText()).not.toMatch(/strategyVersion\s*[:=]\s*["']baseline-002["']/);
  });

  it("contains no candidate selector or optimizer API", () => {
    expect(sourceText()).not.toMatch(/selectBestCandidate|optimizeCandidate|rankByNetR|rankByProfitFactor|argmaxPerformance|autoTune|gridSearch/);
  });

  it("contains no network, history loader, infrastructure, or private API dependency", () => {
    expect(sourceText()).not.toMatch(/fetch\(|binance|historical-data|market-data\/binance|supabase|database|email|trading/);
  });

  it("contains no account, order, or withdrawal capability", () => {
    expect(sourceText()).not.toMatch(/placeOrder|cancelOrder|withdrawal|createOrder|accountBalance|real_orders|real_positions/);
  });

  it("contains no wall-clock randomness or mutable runtime environment dependency", () => {
    expect(sourceText()).not.toMatch(/Date\.now\(|Math\.random\(|process\.env|readFileSync|readdirSync/);
  });

  it("uses only the two allowed data classifications", () => {
    expect(RESEARCH_DATA_CLASSIFICATIONS).toEqual(["RESEARCH_AVAILABLE_SEEN_DATA", "SYNTHETIC_FIXTURE"]);
    expect(sourceText()).not.toMatch(/OOS_PASS|UNTOUCHED_OOS|PRISTINE_OOS/);
  });
});

describe("M3-G.1 boundary regression and unsupported research scope", () => {
  it("requires every research record signalTime to be inside the requested inclusive range", () => {
    const range = { startTime: BASE_TIME, endTime: BASE_TIME + HOUR };
    expect(() => calculateResearchDiagnostics({
      records: [makeSignal({ signalTime: BASE_TIME - 1 })],
      range,
    })).toThrow(/outside the requested inclusive range/);
    expect(() => calculateResearchDiagnostics({
      records: [makeSignal({ signalTime: BASE_TIME + 2 * HOUR })],
      range,
    })).toThrow(/outside the requested inclusive range/);
    expect(calculateResearchDiagnostics({
      records: [makeSignal({ signalTime: BASE_TIME }), makeSignal({ signalTime: BASE_TIME + HOUR }, 1)],
      range,
    }).formalSignals).toBe(2);
  });

  it("keeps the approved five-symbol universe unchanged", () => {
    const symbols: ResearchSymbol[] = [...RESEARCH_SYMBOLS];
    expect(symbols).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
  });

  it("keeps the research horizon independent of realized early exits", () => {
    const early = makeSignal({ exitTime: BASE_TIME + HOUR });
    const late = makeSignal({ signalTime: BASE_TIME + 12 * HOUR, exitTime: BASE_TIME + 13 * HOUR }, 12);
    const earlyDiagnostics = calculateResearchDiagnostics({ records: [early, late], range: metricRange([early, late]) });
    const noExitDiagnostics = calculateResearchDiagnostics({
      records: [nonExecuted(), nonExecuted({ signalTime: BASE_TIME + 12 * HOUR })],
      range: metricRange([early, late]),
    });
    expect(earlyDiagnostics.overlappingSignalCount).toBe(noExitDiagnostics.overlappingSignalCount);
  });

  it("keeps fold membership based on signalTime rather than entry or exit time", () => {
    const validationStart = getResearchFold("F1").validation.startTime;
    const record = makeSignal({ signalTime: validationStart - 1, entryTime: validationStart, exitTime: validationStart + HOUR });
    expect(selectRecordsForFoldRole([record], "F1", "VALIDATION")).toHaveLength(0);
  });

  it("keeps duplicate identity validation fail-closed after canonical ordering", () => {
    const records = [
      makeSignal({ symbol: "ETHUSDT", signalTime: BASE_TIME + HOUR }),
      makeSignal({ symbol: "BTCUSDT", signalTime: BASE_TIME }),
      makeSignal({ symbol: "ETHUSDT", signalTime: BASE_TIME + HOUR }, 1),
    ];
    expect(() => validateAndCanonicalizeResearchRecords(records)).toThrow();
  });

  it("freezes canonical diagnostic outputs", () => {
    const result = calculateResearchDiagnostics({ records: [makeSignal()], range: metricRange() });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.signalsPerSymbol)).toBe(true);
    expect(Object.isFrozen(result.bySymbol.BTCUSDT)).toBe(true);
  });

  it("does not expose a research-run CLI or production candidate command", () => {
    expect(sourceText()).not.toMatch(/npm run|backtest:run|historical run|candidate result/);
  });
});
