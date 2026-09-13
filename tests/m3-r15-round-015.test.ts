import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { R13ForwardLabel } from "../src/lib/research/m3-r13-round-013-labels.ts";
import { R13_FEATURE_NAMES, R13_HORIZON_HOURS, type R13Direction, type R13HorizonHours } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import type { R13Observation } from "../src/lib/research/m3-r13-round-013-performance.ts";
import type { R13FeatureVector } from "../src/lib/research/m3-r13-round-013-features.ts";
import { getResearchFoldRoleRange } from "../src/lib/research/folds.ts";
import { isR13TrainingObservationPurgeSafe } from "../src/lib/research/m3-r13-round-013-validation.ts";
import { deriveR15GroupForTest, isR15TargetDecompositionValid, r15TargetReconstructionTolerance } from "../src/lib/research/m3-r15-round-015-data.ts";
import { fitR15RidgeModel, predictR15RidgeModel } from "../src/lib/research/m3-r15-round-015-model.ts";
import { publishR15ArtifactsAtomically, r15DecilesForTest, r15RanksForTest, r15SpearmanForTest, r15TopBottomRealizedSpreadForTest, selectR15TopOne, type R15ExecutionArtifacts } from "../src/lib/research/m3-r15-round-015-performance.ts";
import { R15_CONFORMANCE_DOCUMENT, runR15ConformanceProbes } from "../src/lib/research/m3-r15-round-015-conformance.ts";
import { R15_ALPHA_FEATURE_NAMES, R15_BETA_FEATURE_NAMES, R15_DIRECTIONS, R15_RIDGE_LAMBDA, R15_SPEC_OBJECT, R15_SYMBOLS, R15_TARGET_THRESHOLD } from "../src/lib/research/m3-r15-round-015-protocol.ts";
import { evaluateR15Gates } from "../src/lib/research/selection-gates-round-015.ts";

const DECISION_TIME = Date.parse("2024-01-01T00:00:00.000Z");
const TARGETS: Record<string, number> = {
  BTCUSDT: 0.1,
  ETHUSDT: 0.3,
  SOLUSDT: 0.5,
  XRPUSDT: 0.7,
  BNBUSDT: 0.9,
};

const RELATIVE_FEATURE_VALUES: Record<string, readonly number[]> = {
  F02_directionAdjustedEma50MinusEma200Atr: [5, 0, 0, 0, 0],
  F04_directionAdjustedReturn1hAtrPriceScale: [1, 2, 4, 3, 5],
  F05_directionAdjustedEma20MinusEma50Atr: [4, 5, 3, 2, 6],
  F07_directionAdjustedReturn4hAtrPriceScale: [2, 3, 5, 4, 6],
  F08_directionAdjustedReturn12hAtrPriceScale: [3, 4, 6, 5, 7],
  F09_directionAdjustedClose1hMinusEma20Atr: [1, 2, 3, 4, 5],
  F10_atr14OverClose1h: [0.1, 0.2, 0.3, 0.4, 0.5],
  F11_rollingAtrPricePercentile30d: [0.6, 0.2, 0.4, 0.8, 1.0],
  F12_logClippedQuoteVolumeOverPast20hMedian: [1, 2, 3, 4, 5],
  F13_directionAdjustedTakerImbalance: [0.7, 0.3, 0.5, 0.9, 1.1],
  F15_directionAdjustedSymbolMinusBtcReturn24h: [0.1, 0.4, 0.9, 0.8, 1.5],
  F16_directionAdjustedSettledFundingBurden: [0.8, 0.4, 0.6, 1.0, 1.2],
  F17_directionAdjustedEma50Breadth: [0.9, 0, 0, 0, 0],
  F18_directionAdjustedMomentumBreadth12h: [1, 0, 0, 0, 0],
};

function label(symbol: R13Observation["symbol"], direction: R13Direction, signalTime: number, horizonHours: R13HorizonHours, netForwardAtr: number, latencyAdjustment: number): R13ForwardLabel {
  const actionableAt = signalTime + 6 * 60 * 60_000 / 60;
  return Object.freeze({
    symbol,
    direction,
    signalTime,
    actionableAt,
    signalValidUntil: signalTime + 60 * 60_000,
    delayMs: actionableAt - signalTime,
    horizonHours,
    status: "EXECUTED",
    entryTime: actionableAt,
    entryPrice: 100,
    entryFill: 100,
    exitTargetTime: actionableAt + horizonHours * 60 * 60_000,
    exitTime: actionableAt + horizonHours * 60 * 60_000,
    exitPrice: 100,
    exitFill: 100,
    grossForwardReturnBps: netForwardAtr * 100,
    grossForwardAtr: netForwardAtr + 0.04,
    feesBps: 2,
    fundingBps: 1,
    slippageBps: 1,
    netForwardReturnBps: netForwardAtr * 100,
    netForwardAtr,
    netForwardAtrCostStress: netForwardAtr - 0.01,
    mfeAtr: netForwardAtr + 0.2,
    maeAtr: -0.1,
    timeToMfeMinutes: 10,
    timeToMaeMinutes: 20,
    fundingEventCount: 1,
    fundingBurdenBps: 1,
    latencyStressAdjustment: latencyAdjustment,
  } as R13ForwardLabel);
}

function observation(symbol: R13Observation["symbol"], direction: R13Direction, index: number, decisionTime = DECISION_TIME): R13Observation {
  const values = Object.fromEntries(R13_FEATURE_NAMES.map((name) => [name, 0.5])) as Record<string, number>;
  for (const [name, series] of Object.entries(RELATIVE_FEATURE_VALUES)) values[name] = series[index]!;
  const target = TARGETS[symbol]! + (direction === "SHORT" ? 0.1 : 0);
  const labels = Object.fromEntries(R13_HORIZON_HOURS.map((horizon) => [horizon, label(symbol, direction, decisionTime, horizon, target, 0)])) as Record<R13HorizonHours, R13ForwardLabel>;
  const latencyStressLabels = Object.fromEntries(R13_HORIZON_HOURS.map((horizon) => [horizon, label(symbol, direction, decisionTime, horizon, target - 0.02, 0.02)])) as Record<R13HorizonHours, R13ForwardLabel>;
  return Object.freeze({
    observationId: `${decisionTime}|${symbol}|${direction}`,
    decisionTime,
    symbol,
    direction,
    features: Object.freeze(values) as R13FeatureVector,
    atr14_1h: 1,
    labels: Object.freeze(labels),
    latencyStressLabels: Object.freeze(latencyStressLabels),
  });
}

function allObservations(decisionTime = DECISION_TIME): readonly R13Observation[] {
  return R15_DIRECTIONS.flatMap((direction) => R15_SYMBOLS.map((symbol, index) => observation(symbol, direction, index, decisionTime)));
}

function fakeArtifacts(): R15ExecutionArtifacts {
  return {
    report: undefined as never,
    summaryJson: "summary-字节",
    auditJson: "audit-字节",
    resultsMarkdown: "results-字节",
    selectionJson: "selection-json-字节",
    selectionMarkdown: "selection-markdown-字节",
    publicationHashesJson: "publication-hashes-字节",
  };
}

function stagingDirectories(root: string): string[] {
  const docs = path.join(root, "docs");
  return existsSync(docs) ? readdirSync(docs).filter((entry) => entry.startsWith(".m3-r15-round-015-staging-")) : [];
}

describe("Round-015 conformance and decomposition", () => {
  it("freezes H4-only beta/alpha decomposition with exact reconstruction", () => {
    const derived = deriveR15GroupForTest({ decisionTime: DECISION_TIME, rows: allObservations() });
    expect(derived).toHaveLength(10);
    const long = derived.slice(0, 5);
    const short = derived.slice(5);
    expect(long.map((row) => row.symbolTarget)).toEqual([0.1, 0.3, 0.5, 0.7, 0.9]);
    short.forEach((row, index) => expect(row.symbolTarget).toBeCloseTo([0.2, 0.4, 0.6, 0.8, 1.0][index]!, 12));
    expect(long.every((row) => row.marketBetaTarget === 0.5)).toBe(true);
    expect(short.every((row) => row.marketBetaTarget === 0.6)).toBe(true);
    for (const row of derived) expect(row.marketBetaTarget + row.relativeAlphaTarget).toBeCloseTo(row.symbolTarget, 12);
  });

  it("accepts scale-aware target reconstruction and rejects incorrect or mismatched targets", () => {
    expect(r15TargetReconstructionTolerance({ marketBetaTarget: 0.3, relativeAlphaTarget: 0.6, symbolTarget: 0.9 })).toBe(16 * Number.EPSILON);
    expect(isR15TargetDecompositionValid({ marketBetaTarget: 0.3, relativeAlphaTarget: 0.6, symbolTarget: 0.9, originalNetForwardAtr: 0.9 })).toBe(true);
    expect(isR15TargetDecompositionValid({ marketBetaTarget: 1, relativeAlphaTarget: 4 * Number.EPSILON, symbolTarget: 1, originalNetForwardAtr: 1 })).toBe(true);
    expect(isR15TargetDecompositionValid({ marketBetaTarget: 0.7, relativeAlphaTarget: 0.289, symbolTarget: 1, originalNetForwardAtr: 1 })).toBe(false);
    expect(isR15TargetDecompositionValid({ marketBetaTarget: 0.2, relativeAlphaTarget: 0.3, symbolTarget: 0.5, originalNetForwardAtr: 0.5001 })).toBe(false);
    expect(isR15TargetDecompositionValid({ marketBetaTarget: 1_000_000_000_000.125, relativeAlphaTarget: -1_000_000_000_000, symbolTarget: 0.125, originalNetForwardAtr: 0.125 })).toBe(true);
    expect(isR15TargetDecompositionValid({ marketBetaTarget: 1e-12, relativeAlphaTarget: 2e-12, symbolTarget: 3e-12, originalNetForwardAtr: 3e-12 })).toBe(true);
    expect(isR15TargetDecompositionValid({ marketBetaTarget: -0.8, relativeAlphaTarget: 0.3, symbolTarget: -0.5, originalNetForwardAtr: -0.5 })).toBe(true);
  });

  it("records executable conformance probes with computed deviations", () => {
    const probes = runR15ConformanceProbes();
    expect(probes.checks).toHaveLength(24);
    expect(probes.checks.every((value) => value.passed && value.probeId.startsWith("r15-behavior-probe/") && typeof value.evidence === "object")).toBe(true);
    expect(probes.resultAffectingDeviationCount).toBe(probes.checks.filter((value) => !value.passed).length);
    expect(probes.integrity).toBe("COMPLETE");
    expect(R15_CONFORMANCE_DOCUMENT.resultAffectingDeviationCount).toBe(0);
  });

  it("applies the fixed B01-B10 mappings and same-time A01-A10 medians", () => {
    const long = deriveR15GroupForTest({ decisionTime: DECISION_TIME, rows: allObservations() }).slice(0, 5);
    const btc = long[0]!;
    const eth = long[1]!;
    expect(btc.betaFeatures).toMatchObject({
      B01_directionAdjustedBtcReturn1hAtrPriceScale: 1,
      B02_directionAdjustedBtcReturn4hAtrPriceScale: 2,
      B03_directionAdjustedBtcReturn12hAtrPriceScale: 3,
      B04_directionAdjustedBtcEma20MinusEma50Atr: 4,
      B05_directionAdjustedBtcEma50MinusEma200Atr: 5,
      B06_btcAtrPercentile30d: 0.6,
      B07_directionAdjustedBtcTakerImbalance: 0.7,
      B08_directionAdjustedBtcSettledFundingBurden: 0.8,
      B09_directionAdjustedFiveSymbolEma50Breadth: 0.9,
      B10_directionAdjustedFiveSymbolPositive12hBreadth: 1,
    });
    expect(eth.alphaFeatures.A01_directionAdjustedSymbolMinusBtcReturn1hAtrPriceScale).toBeCloseTo(1.5, 12);
    expect(eth.alphaFeatures.A02_directionAdjustedSymbolMinusBtcReturn4hAtrPriceScale).toBeCloseTo(2, 12);
    expect(eth.alphaFeatures.A03_directionAdjustedSymbolMinusBtcReturn12hAtrPriceScale).toBeCloseTo(2.5, 12);
    expect(eth.alphaFeatures.A04_directionAdjustedSymbolMinusBtcReturn24hAtrPriceScale).toBeCloseTo(2, 12);
    expect(eth.alphaFeatures.A05_directionAdjustedEma20ExtensionAtrMinusMedian).toBeCloseTo(-1, 12);
    expect(eth.alphaFeatures.A06_directionAdjustedEma20MinusEma50AtrMinusMedian).toBeCloseTo(1, 12);
    expect(eth.alphaFeatures.A07_atrPercentile30dMinusMedian).toBeCloseTo(-0.4, 12);
    expect(eth.alphaFeatures.A08_logVolumeRatioMinusMedian).toBeCloseTo(-1, 12);
    expect(eth.alphaFeatures.A09_directionAdjustedTakerImbalanceMinusMedian).toBeCloseTo(-0.4, 12);
    expect(eth.alphaFeatures.A10_directionAdjustedSettledFundingBurdenMinusMedian).toBeCloseTo(-0.4, 12);
    expect(R15_ALPHA_FEATURE_NAMES).toHaveLength(10);
    expect(R15_BETA_FEATURE_NAMES).toHaveLength(10);
  });

  it("keeps the models pooled, fixed-lambda, and research-standardized", () => {
    const examples = Array.from({ length: 24 }, (_, row) => ({
      features: Object.fromEntries(R15_BETA_FEATURE_NAMES.map((name, column) => [name, (row + 1) * (column + 1) / 100])),
      target: row / 100,
    }));
    const model = fitR15RidgeModel("R15-BETA-H4", R15_BETA_FEATURE_NAMES, examples);
    expect(model.lambda).toBe(R15_RIDGE_LAMBDA);
    expect(model.standardization.identitySha256).toHaveLength(64);
    expect(model.modelIdentitySha256).toHaveLength(64);
    expect(Number.isFinite(predictR15RidgeModel(model, examples[0]!.features))).toBe(true);
    expect(R15_SPEC_OBJECT.betaModel.noSymbolIdentity).toBe(true);
    expect(R15_SPEC_OBJECT.alphaModel.noSymbolIdentity).toBe(true);
    expect(R15_SPEC_OBJECT.alphaModel.noPerSymbolCoefficients).toBe(true);
    expect(R15_SPEC_OBJECT.training.standardization).toBe("RESEARCH_ONLY");
  });

  it("enforces the 24-hour purge boundary and excludes future information", () => {
    const validationStart = getResearchFoldRoleRange("F1", "VALIDATION").startTime;
    expect(isR13TrainingObservationPurgeSafe({ decisionTime: validationStart - 24 * 60 * 60_000 - 7 * 60_000, validationStartTime: validationStart, maximumLabelHorizonHours: 24 })).toBe(true);
    expect(isR13TrainingObservationPurgeSafe({ decisionTime: validationStart - 24 * 60 * 60_000 - 6 * 60_000, validationStartTime: validationStart, maximumLabelHorizonHours: 24 })).toBe(false);
    expect(R15_SPEC_OBJECT.training.purgeEmbargoHours).toBe(24);
    expect(R15_SPEC_OBJECT.researchUniverse.classification).toBe("RESEARCH_AVAILABLE_SEEN_DATA");
    expect(R15_SPEC_OBJECT.governance.productionEligibleDirectly).toBe(false);
  });
});

describe("Round-015 fixed selection and gates", () => {
  it("selects exactly one TOP1 at the inclusive +0.10 threshold and returns NO_TRADE below it", () => {
    const selected = selectR15TopOne([
      { observationId: "eth", symbol: "ETHUSDT", direction: "SHORT", predictedNetAtr: 0.1 },
      { observationId: "btc", symbol: "BTCUSDT", direction: "LONG", predictedNetAtr: 0.1 },
      { observationId: "sol", symbol: "SOLUSDT", direction: "LONG", predictedNetAtr: 0.0999 },
    ]);
    expect(selected?.observationId).toBe("btc");
    expect(selectR15TopOne([{ observationId: "below", symbol: "BTCUSDT", direction: "LONG", predictedNetAtr: R15_TARGET_THRESHOLD - 0.0001 }])).toBeNull();
    expect(R15_SPEC_OBJECT.selection.maximumSignalsPerDecisionTime).toBe(1);
    expect(R15_SPEC_OBJECT.selection.belowThreshold).toBe("NO_TRADE");
  });

  it("keeps all eighteen gates conjunctive", () => {
    const input = {
      selectedCount: 500,
      selectedByFold: { F1: 50, F2: 50, F3: 50, F4: 50, F5: 50, F6: 50 },
      meanNetForwardAtr: 0.1,
      profitFactor: 1.3,
      positiveFolds: 5,
      catastrophicFolds: 0,
      betaPooledPearson: 0.01,
      betaPositiveCorrelationFolds: 5,
      alphaPositiveCorrelationFolds: 5,
      alphaPooledSpearman: 0.03,
      alphaTopBottomSpread: 0.15,
      alphaPositiveSpreadFolds: 5,
      costStressMean: 0.01,
      costStressProfitFactor: 1.06,
      latencyStressMean: 0.01,
      maximumPositiveSymbolContributionShare: 0.5,
      maximumSinglePositiveObservationContribution: 0.05,
      evidenceIntegrity: true,
      modelProvenanceComplete: true,
    } as const;
    expect(evaluateR15Gates(input).eligibility).toBe("ELIGIBLE");
    expect(evaluateR15Gates({ ...input, alphaPooledSpearman: null }).eligibility).toBe("INELIGIBLE");
  });

  it("uses average ranks for ties and keeps beta, combined, and alpha ordering semantics", () => {
    expect(r15RanksForTest([1, 2, 2, 4])).toEqual([1, 2.5, 2.5, 4]);
    expect(r15SpearmanForTest([1, 2, 2, 4], [1, 2, 2, 4])).toBeCloseTo(1, 12);

    const predicted = [0.4, 0.1, 0.3, 0.2, 0.9, 0.5, 0.8, 0.6, 0.7, 0];
    const betaRealized = predicted.map((value) => value * 2);
    const betaDeciles = r15DecilesForTest(betaRealized, predicted);
    expect(betaDeciles.every((value) => value.count === 1)).toBe(true);
    expect(betaDeciles[0]?.mean).toBe(0);
    expect(betaDeciles[9]?.mean).toBe(1.8);

    const realizedNet = predicted.map((_value, index) => index / 10);
    const predictionReport = predicted.map((value, index) => value - realizedNet[index]!);
    const combinedDeciles = r15DecilesForTest(predictionReport, predicted);
    expect(combinedDeciles[0]?.mean).toBe(predictionReport[9]);
    expect(combinedDeciles[9]?.mean).toBe(predictionReport[4]);

    const alphaRows = predicted.map((value, index) => ({ symbol: R15_SYMBOLS[index]!, predicted: value, realized: index }));
    expect(r15TopBottomRealizedSpreadForTest(alphaRows)).toBe(alphaRows[4]!.realized - alphaRows[9]!.realized);
  });
});

describe("Round-015 atomic publication", () => {
  it("rolls back after AUDIT publication and leaves no output or staging directory", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r15-publication-test-"));
    try {
      expect(() => publishR15ArtifactsAtomically({ root, artifacts: fakeArtifacts(), beforePublish: (_target, index) => { if (index === 1) throw new Error("fail before RESULTS"); } })).toThrow("fail before RESULTS");
      expect(existsSync(path.join(root, "docs", "evidence", "M3_R15_ROUND_015_AUDIT.json"))).toBe(false);
      expect(existsSync(path.join(root, "docs", "M3_R15_ROUND_015_RESULTS.md"))).toBe(false);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back all prior outputs before SUMMARY publication", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r15-publication-test-"));
    try {
      expect(() => publishR15ArtifactsAtomically({ root, artifacts: fakeArtifacts(), beforePublish: (_target, index) => { if (index === 5) throw new Error("fail before SUMMARY"); } })).toThrow("fail before SUMMARY");
      expect(readdirSync(path.join(root, "docs", "evidence"), { withFileTypes: true }).filter((entry) => entry.name.includes("M3_R15_ROUND_015")).length).toBe(0);
      expect(existsSync(path.join(root, "docs", "research", "round-015-publication-hashes.json"))).toBe(false);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes exact bytes with SUMMARY last and removes staging", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r15-publication-test-"));
    const order: string[] = [];
    try {
      publishR15ArtifactsAtomically({ root, artifacts: fakeArtifacts(), beforePublish: (target) => { order.push(path.basename(target)); } });
      expect(order).toEqual([
        "M3_R15_ROUND_015_AUDIT.json",
        "M3_R15_ROUND_015_RESULTS.md",
        "M3_R15_ROUND_015_SELECTION.json",
        "M3_R15_ROUND_015_SELECTION.md",
        "round-015-publication-hashes.json",
        "M3_R15_ROUND_015_SUMMARY.json",
      ]);
      expect(readFileSync(path.join(root, "docs", "evidence", "M3_R15_ROUND_015_AUDIT.json"), "utf8")).toBe("audit-字节");
      expect(readFileSync(path.join(root, "docs", "M3_R15_ROUND_015_RESULTS.md"), "utf8")).toBe("results-字节");
      expect(readFileSync(path.join(root, "docs", "evidence", "M3_R15_ROUND_015_SUMMARY.json"), "utf8")).toBe("summary-字节");
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects pre-existing output before staging and preserves it byte-for-byte", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r15-publication-test-"));
    const existing = path.join(root, "docs", "evidence", "M3_R15_ROUND_015_SUMMARY.json");
    try {
      mkdirSync(path.dirname(existing), { recursive: true });
      writeFileSync(existing, "pre-existing-authoritative-bytes", "utf8");
      expect(() => publishR15ArtifactsAtomically({ root, artifacts: fakeArtifacts() })).toThrow(/already exists/u);
      expect(readFileSync(existing, "utf8")).toBe("pre-existing-authoritative-bytes");
      expect(existsSync(path.join(root, "docs", "M3_R15_ROUND_015_RESULTS.md"))).toBe(false);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps publication offline and does not depend on a market-data client", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r15-round-015-performance.ts"), "utf8");
    expect(source).not.toContain("BinancePublicClient");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("os.tmpdir");
  });
});
