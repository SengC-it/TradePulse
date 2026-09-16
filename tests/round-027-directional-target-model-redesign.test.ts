import { describe, expect, it } from "vitest";

import {
  R27_CANDIDATE_CONFIGURATIONS,
  R27_DEVELOPMENT_GATES,
  R27_DEVELOPMENT_DATA_SOURCE,
  R27_FOLD_IDS,
  R27_LOGISTIC_LAMBDA,
  R27_LOGISTIC_MAX_ITERATIONS,
  R27_LOGISTIC_TOLERANCE,
  R27_PAIRWISE_SCORE_THRESHOLD,
  R27_POSITIVE_PROBABILITY_THRESHOLD,
  R27_PROTOCOL_OBJECT,
  R27_PROTOCOL_SHA256,
  R27_SYMBOLS,
  type R27Symbol,
} from "../src/lib/research/round-027-protocol.ts";
import {
  fitR27PairwiseLogistic,
  fitR27PositiveLogistic,
  predictR27PairwiseProbability,
  predictR27PositiveProbability,
} from "../src/lib/research/round-027-candidate-model.ts";
import { validateR27PeerGroup } from "../src/lib/research/round-027-development-runner.ts";

const FEATURE_NAMES = ["F01", "F05"] as const;

describe("Round-027 frozen directional target/model redesign", () => {
  it("freezes exactly three LONG and three SHORT configurations", () => {
    expect(R27_CANDIDATE_CONFIGURATIONS).toHaveLength(6);
    expect(R27_CANDIDATE_CONFIGURATIONS.filter((config) => config.direction === "LONG")).toHaveLength(3);
    expect(R27_CANDIDATE_CONFIGURATIONS.filter((config) => config.direction === "SHORT")).toHaveLength(3);
    expect(new Set(R27_CANDIDATE_CONFIGURATIONS.map((config) => config.candidateConfigurationId)).size).toBe(6);
    expect(R27_CANDIDATE_CONFIGURATIONS.map((config) => config.candidateConfigurationId)).toEqual([
      "R27_LONG_POSITIVE_LOGIT_TREND_PULLBACK_VOLUME",
      "R27_LONG_POSITIVE_LOGIT_TREND_PULLBACK_NO_VOLUME",
      "R27_LONG_PAIRWISE_RANK_POSITIVE_GATE_TREND_PULLBACK_VOLUME",
      "R27_SHORT_POSITIVE_LOGIT_TREND_VOLATILITY_FUNDING",
      "R27_SHORT_POSITIVE_LOGIT_RELATIVE_FLOW_FUNDING",
      "R27_SHORT_PAIRWISE_RANK_POSITIVE_GATE_TREND_VOLATILITY_FUNDING",
    ]);
    expect(R27_CANDIDATE_CONFIGURATIONS.every((config) => config.horizonHours === 4 && config.lambda === 10 && config.regimeGate === null)).toBe(true);
  });

  it("freezes the only allowed target types and semantic thresholds", () => {
    expect(new Set(R27_CANDIDATE_CONFIGURATIONS.map((config) => config.targetType))).toEqual(new Set([
      "POSITIVE_NET_PROBABILITY",
      "CROSS_SECTIONAL_PAIRWISE_RANKING_PLUS_POSITIVE_NET_PROBABILITY_GATE",
    ]));
    expect(R27_CANDIDATE_CONFIGURATIONS.every((config) => config.positiveProbabilityThreshold === R27_POSITIVE_PROBABILITY_THRESHOLD)).toBe(true);
    expect(R27_CANDIDATE_CONFIGURATIONS.filter((config) => config.pairwiseScoreThreshold !== null).every((config) => config.pairwiseScoreThreshold === R27_PAIRWISE_SCORE_THRESHOLD)).toBe(true);
    expect(R27_PROTOCOL_OBJECT.searchSpace).toMatchObject({ noThresholdSweep: true, noLambdaSweep: true, noFeatureCombinatorialSearch: true, noHorizonExpansion: true, completeEvaluationExecutionCount: 1 });
  });

  it("freezes the accepted R14 source identity and no-acquisition boundary", () => {
    expect(R27_DEVELOPMENT_DATA_SOURCE).toMatchObject({
      canonicalObservationPath: ".cache/tradepulse/round-014/observations.ndjson",
      observationDataSha256: "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359",
      observationCount: 244810,
      networkAcquired: false,
      newHistoricalDevelopmentDataFetched: false,
      postBoundaryDataFetched: false,
      developmentOnly: true,
    });
  });

  it("implements deterministic L2 positive-net logistic with bounded probabilities", () => {
    const examples = [
      { features: [-2, -1], target: 0 as const },
      { features: [-1, -0.5], target: 0 as const },
      { features: [1, 0.5], target: 1 as const },
      { features: [2, 1], target: 1 as const },
    ];
    const first = fitR27PositiveLogistic(examples, FEATURE_NAMES);
    const second = fitR27PositiveLogistic(examples, FEATURE_NAMES);
    expect(first).toEqual(second);
    expect(first.modelType).toBe("R27_BINARY_LOGISTIC_L2");
    expect(first.lambda).toBe(R27_LOGISTIC_LAMBDA);
    expect(first.interceptPolicy).toBe("UNPENALIZED");
    expect(first.converged).toBe(true);
    expect(first.iterations).toBeLessThanOrEqual(R27_LOGISTIC_MAX_ITERATIONS);
    expect(first.trainingExamples).toBe(4);
    expect(first.positiveExamples).toBe(2);
    expect(first.negativeExamples).toBe(2);
    expect(first.trainingPositiveRate).toBe(0.5);
    expect(first.modelIdentitySha256).toHaveLength(64);
    expect(predictR27PositiveProbability(first, [-2, -1])).toBeGreaterThanOrEqual(0);
    expect(predictR27PositiveProbability(first, [2, 1])).toBeLessThanOrEqual(1);
    expect(R27_LOGISTIC_TOLERANCE).toBe(1e-10);
  });

  it("fails closed for one target class and non-finite model input", () => {
    expect(() => fitR27PositiveLogistic([
      { features: [0, 0], target: 1 },
      { features: [1, 1], target: 1 },
    ], FEATURE_NAMES)).toThrow(/both target classes/);
    expect(() => fitR27PositiveLogistic([
      { features: [Number.NaN, 0], target: 0 },
      { features: [1, 1], target: 1 },
    ], FEATURE_NAMES)).toThrow(/must be finite/);
  });

  it("implements fixed-zero-intercept pairwise anti-symmetry", () => {
    const examples = [
      { features: [2, 0], target: 1 as const },
      { features: [-2, 0], target: 0 as const },
      { features: [1, 1], target: 1 as const },
      { features: [-1, -1], target: 0 as const },
    ];
    const model = fitR27PairwiseLogistic(examples, FEATURE_NAMES);
    const forward = predictR27PairwiseProbability(model, [2, 0]);
    const reverse = predictR27PairwiseProbability(model, [-2, 0]);
    expect(model.modelType).toBe("R27_PAIRWISE_BINARY_LOGISTIC_L2");
    expect(model.intercept).toBe(0);
    expect(model.interceptPolicy).toBe("FIXED_ZERO");
    expect(forward).toBeGreaterThanOrEqual(0);
    expect(reverse).toBeGreaterThanOrEqual(0);
    expect(forward + reverse).toBeCloseTo(1, 10);
  });

  it("requires exactly the five frozen peers for every direction/time", () => {
    const complete = R27_SYMBOLS.map((symbol) => ({ direction: "LONG" as const, decisionTime: 100, symbol }));
    expect(validateR27PeerGroup(complete, "LONG", 100)).toBe(true);
    expect(() => validateR27PeerGroup(complete.slice(0, 4), "LONG", 100)).toThrow(/exactly five/);
    expect(() => validateR27PeerGroup([...complete.slice(0, 4), { direction: "LONG" as const, decisionTime: 100, symbol: "BTCUSDT" as R27Symbol }], "LONG", 100)).toThrow(/exactly five/);
  });

  it("freezes validation order and the additional per-fold floor", () => {
    expect(R27_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(R27_DEVELOPMENT_GATES.minimumSelectedAlertsPerFold).toBe(10);
    expect(R27_DEVELOPMENT_GATES.catastrophicFoldThreshold).toBe(-0.1);
    expect(R27_PROTOCOL_OBJECT.validationOrder).toEqual([
      "FIT_RESEARCH_ONLY",
      "SCORE_VALIDATION_FEATURES",
      "SELECT_FROZEN_ALERTS",
      "READ_SELECTED_VALIDATION_ECONOMIC_LABELS",
      "COMPUTE_DEVELOPMENT_METRICS",
    ]);
  });

  it("freezes non-forward governance and protocol identity", () => {
    expect(R27_PROTOCOL_OBJECT.governance).toMatchObject({
      humanDecisionRequired: true,
      automaticTrading: false,
      forwardEconomicValuesRead: false,
      forwardReturnRead: false,
      forwardValidationAuthorized: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      productionUnchanged: true,
      emailRestorationAuthorized: false,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
    });
    expect(R27_PROTOCOL_SHA256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not add an R27 runtime trading or forward loader surface", () => {
    expect(R27_PROTOCOL_OBJECT.governance.automaticTrading).toBe(false);
    expect(R27_PROTOCOL_OBJECT.governance.forwardValidationAuthorized).toBe(false);
    expect(R27_PROTOCOL_OBJECT.searchSpace.maximumTotalConfigurations).toBe(6);
    expect((R27_PROTOCOL_OBJECT as Record<string, unknown>).forwardLoader).toBeUndefined();
  });
});
