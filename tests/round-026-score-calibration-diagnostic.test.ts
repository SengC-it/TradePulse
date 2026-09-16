import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  diagnoseR26CandidateFold,
  resolveR26Source,
  type R26DiagnosticRow,
} from "../src/lib/research/round-026-score-calibration-diagnostic.ts";
import {
  buildR26ScoreDistribution,
  buildR26ThresholdDiagnostics,
  classifyR26Direction,
  R26_FORBIDDEN_VALIDATION_FIELDS,
  R26_ALLOWED_VALIDATION_FIELDS,
  R26_GOVERNANCE,
  type R26CandidateDiagnostics,
  type R26FoldDiagnostics,
} from "../src/lib/research/round-026-score-calibration-protocol.ts";
import {
  R25_FOLD_IDS,
  R25_SYMBOLS,
} from "../src/lib/research/round-025-protocol.ts";
import {
  R25_LONG_CANDIDATE_CONFIGURATIONS as LONG_CONFIGURATIONS,
  R25_SHORT_CANDIDATE_CONFIGURATIONS as SHORT_CONFIGURATIONS,
} from "../src/lib/research/round-025-candidate-model.ts";
import {
  R26_BASE_SHA,
  R26_BRANCH,
  R26_PHASE,
  R26_SOURCE,
  R26_ALLOWED_VALIDATION_FIELDS as PROTOCOL_ALLOWED_VALIDATION_FIELDS,
  R26_FORBIDDEN_VALIDATION_FIELDS as PROTOCOL_FORBIDDEN_VALIDATION_FIELDS,
} from "../src/lib/research/round-026-score-calibration-protocol.ts";

const configurations = [...LONG_CONFIGURATIONS, ...SHORT_CONFIGURATIONS];
const featureNames = [...new Set(configurations.flatMap((configuration) => configuration.featureNames))];

function row(
  decisionTime: number,
  index: number,
  direction: "LONG" | "SHORT",
  symbol: (typeof R25_SYMBOLS)[number],
  target: number | null,
): R26DiagnosticRow {
  return Object.freeze({
    observationId: `synthetic-${direction}-${decisionTime}-${symbol}`,
    decisionTime,
    symbol,
    direction,
    features: Object.freeze(Object.fromEntries(featureNames.map((name, featureIndex) => [name, (index + 1) * (featureIndex + 2) + decisionTime / 86_400_000]))),
    researchTargetNetR: target,
  });
}

function syntheticRows(config: (typeof configurations)[number]): { trainingRows: R26DiagnosticRow[]; validationRows: R26DiagnosticRow[] } {
  const trainingRows: R26DiagnosticRow[] = [];
  for (let timeIndex = 0; timeIndex < 4; timeIndex += 1) {
    for (const [symbolIndex, symbol] of R25_SYMBOLS.entries()) {
      trainingRows.push(row(1_700_000_000_000 + timeIndex * 3_600_000, timeIndex * 5 + symbolIndex, config.direction, symbol, timeIndex + symbolIndex / 10));
    }
  }
  const validationRows = R25_SYMBOLS.map((symbol, symbolIndex) => row(1_800_000_000_000, symbolIndex, config.direction, symbol, null));
  return { trainingRows, validationRows };
}

function syntheticFold(overrides: Partial<R26FoldDiagnostics> = {}): R26FoldDiagnostics {
  return {
    foldId: "F1",
    predictionDistribution: buildR26ScoreDistribution([0.1, 0.2]),
    topPredictionDistribution: buildR26ScoreDistribution([0.2]),
    thresholdDiagnostics: buildR26ThresholdDiagnostics(0.1, [0.2]),
    modelScale: { intercept: 0, coefficientL1Norm: 1, coefficientL2Norm: 1, maximumAbsCoefficient: 1 },
    pipeline: {
      trainingExamples: 10,
      expectedTrainingExamples: 10,
      modelIdentitySha256: "same",
      expectedModelIdentitySha256: "same",
      modelIdentityMatched: true,
      validationDecisionTimeCount: 1,
      validationRowCount: 5,
      peerCountMin: 5,
      peerCountMax: 5,
      peerCountsValid: true,
      nonFinitePredictionCount: 0,
    },
    ...overrides,
  };
}

function syntheticCandidate(
  direction: "LONG" | "SHORT",
  folds: readonly R26FoldDiagnostics[],
  selectedAlertCountReproduced = true,
): R26CandidateDiagnostics {
  return {
    candidateConfigurationId: `synthetic-${direction}`,
    family: direction === "LONG" ? "LONG-CANDIDATE-FAMILY" : "SHORT-CANDIDATE-FAMILY",
    direction,
    threshold: 0.1,
    folds,
    thresholdExceedancesByFold: Object.fromEntries(folds.map((fold) => [fold.foldId, fold.thresholdDiagnostics.thresholdExceedanceCount])) as Record<"F1" | "F2" | "F3" | "F4" | "F5" | "F6", number>,
    shareOfExceedancesInLargestFold: 1,
    foldsWithZeroThresholdExceedances: 0,
    foldsThresholdAboveP99: 0,
    foldsThresholdAboveMax: 0,
    modelScaleDriftByFold: [],
    reproducedR25SelectedAlertCount: 1,
    acceptedR25SelectedAlertCount: 1,
    selectedAlertCountReproduced,
  };
}

describe("Round-026 score calibration diagnostic contract", () => {
  it("freezes the accepted base, immutable source, and diagnostic-only phase", () => {
    expect(R26_BASE_SHA).toBe("99ecad9cfca8487c17a31fbf2c8878e5c9c71ed1");
    expect(R26_BRANCH).toBe("research/round-026-directional-score-calibration-diagnostic");
    expect(R26_PHASE).toBe("SCORE_DIAGNOSTIC_ONLY");
    expect(R26_SOURCE).toMatchObject({
      observationDataSha256: "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359",
      observationDataBytes: 1_893_811_055,
      observationCount: 244_810,
      networkAcquired: false,
      classification: "SEEN_DEVELOPMENT_DIAGNOSTIC_ONLY",
    });
  });

  it("freezes exactly six configurations and six folds for 36 diagnostics", () => {
    expect(LONG_CONFIGURATIONS).toHaveLength(3);
    expect(SHORT_CONFIGURATIONS).toHaveLength(3);
    expect(configurations).toHaveLength(6);
    expect(R25_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(configurations.length * R25_FOLD_IDS.length).toBe(36);
  });

  it("keeps the validation projection allowlist separate from forbidden economic fields", () => {
    expect(R26_ALLOWED_VALIDATION_FIELDS).toEqual(["decisionTime", "symbol", "direction", "features"]);
    expect(PROTOCOL_ALLOWED_VALIDATION_FIELDS).toEqual(R26_ALLOWED_VALIDATION_FIELDS);
    expect(R26_FORBIDDEN_VALIDATION_FIELDS).toContain("labels");
    expect(R26_FORBIDDEN_VALIDATION_FIELDS).toContain("netForwardAtr");
    expect(R26_FORBIDDEN_VALIDATION_FIELDS).toContain("forwardReturn");
    expect(PROTOCOL_FORBIDDEN_VALIDATION_FIELDS).toEqual(R26_FORBIDDEN_VALIDATION_FIELDS);
  });

  it("reproduces a deterministic candidate-fold model identity without reading validation outcomes", () => {
    const config = LONG_CONFIGURATIONS[0]!;
    const rows = syntheticRows(config);
    const first = diagnoseR26CandidateFold({
      config,
      foldId: "F1",
      trainingRows: rows.trainingRows,
      validationRows: rows.validationRows,
      expectedTrainingExamples: rows.trainingRows.length,
      expectedModelIdentitySha256: "",
    });
    const second = diagnoseR26CandidateFold({
      config,
      foldId: "F1",
      trainingRows: rows.trainingRows,
      validationRows: rows.validationRows,
      expectedTrainingExamples: rows.trainingRows.length,
      expectedModelIdentitySha256: first.pipeline.modelIdentitySha256,
    });
    expect(first.pipeline.modelIdentityMatched).toBe(false);
    expect(second.pipeline.modelIdentityMatched).toBe(true);
    expect(second).toEqual({ ...first, pipeline: { ...first.pipeline, expectedModelIdentitySha256: first.pipeline.modelIdentitySha256, modelIdentityMatched: true } });
    expect(second.pipeline.validationRowCount).toBe(5);
    expect(second.pipeline.peerCountMin).toBe(5);
    expect(second.pipeline.peerCountMax).toBe(5);
    expect(second.pipeline.nonFinitePredictionCount).toBe(0);
  });

  it("calculates deterministic score distributions and frozen threshold diagnostics", () => {
    const distribution = buildR26ScoreDistribution([1, 2, 3, 4]);
    expect(distribution).toMatchObject({ count: 4, min: 1, p50: 2.5, p75: 3.25, max: 4 });
    expect(distribution.p90).toBeCloseTo(3.7, 12);
    expect(distribution.p95).toBeCloseTo(3.85, 12);
    expect(distribution.p99).toBeCloseTo(3.97, 12);
    expect(buildR26ThresholdDiagnostics(0.05, [0.01, 0.05, 0.1])).toMatchObject({
      topScoreGreaterThanZeroCount: 3,
      topScoreGreaterThanZeroRate: 1,
      thresholdExceedanceCount: 2,
      thresholdExceedanceRate: 2 / 3,
      thresholdAboveTopP99: false,
      thresholdAboveTopMax: false,
      topP95ToThresholdRatio: 1.9,
      topP99ToThresholdRatio: 1.98,
      topMaxToThresholdRatio: 2,
    });
  });

  it("classifies pipeline mismatch before score-scale branches", () => {
    const bad = syntheticCandidate("LONG", Array.from({ length: 6 }, (_, index) => syntheticFold({ foldId: `F${index + 1}` as "F1" })), false);
    expect(classifyR26Direction([bad])).toBe("PIPELINE_INTEGRITY_FAILURE");
  });

  it("classifies positive-score collapse, threshold drift, and normal-scale redesign", () => {
    const collapseFolds = Array.from({ length: 6 }, (_, index) => syntheticFold({ foldId: `F${index + 1}` as "F1", topPredictionDistribution: buildR26ScoreDistribution(index < 4 ? [-0.2] : [0.2]) }));
    expect(classifyR26Direction([syntheticCandidate("LONG", collapseFolds)])).toBe("MODEL_POSITIVE_SCORE_COLLAPSE");

    const driftFolds = Array.from({ length: 6 }, (_, index) => syntheticFold({
      foldId: `F${index + 1}` as "F1",
      thresholdDiagnostics: buildR26ThresholdDiagnostics(0.1, index < 4 ? [0.01] : [0.2]),
      topPredictionDistribution: buildR26ScoreDistribution(index < 4 ? [0.01] : [0.2]),
    }));
    expect(classifyR26Direction([syntheticCandidate("LONG", driftFolds)])).toBe("FIXED_RAW_THRESHOLD_SCALE_DRIFT");

    const normalFolds = Array.from({ length: 6 }, (_, index) => syntheticFold({ foldId: `F${index + 1}` as "F1", thresholdDiagnostics: buildR26ThresholdDiagnostics(0.1, [0.2 + index / 100]) }));
    expect(classifyR26Direction([syntheticCandidate("LONG", normalFolds)])).toBe("SCORE_SCALE_OK_MODEL_EDGE_REDESIGN_REQUIRED");
  });

  it("fails closed when the accepted source is not locally available", () => {
    expect(() => resolveR26Source(path.join("__r26-no-network-source__", "root"))).toThrow("network acquisition is forbidden");
  });

  it("does not authorize selection, forward validation, performance, or production", () => {
    expect(R26_GOVERNANCE).toMatchObject({
      diagnosticOnly: true,
      economicEvaluationPerformed: false,
      validationEconomicValuesRead: true,
      historicalTrainingTargetValuesRead: true,
      globalHistoricalEconomicLabelsRead: true,
      sameFoldValidationEconomicValuesUsedForFit: false,
      sameFoldValidationEconomicValuesUsedForScoring: false,
      validationOutcomeInfluencedDiagnostic: false,
      crossFoldExpandingWindowResearchReuse: true,
      scoreCalibrationDiagnosticExecutionCount: 1,
      developmentEconomicEvaluationExecutionCount: 1,
      forwardEconomicValuesRead: false,
      forwardReturnRead: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      automaticTrading: false,
      humanDecisionRequired: true,
      productionUnchanged: true,
      emailRestorationAuthorized: false,
    });
    expect(readFileSync(path.resolve("src/lib/research/round-026-score-calibration-diagnostic.ts"), "utf8")).not.toContain("fetch(");
  });
});
