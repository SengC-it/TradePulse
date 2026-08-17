import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON,
  BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID,
  BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256,
  BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES,
  BASELINE_002_RESEARCH_ROUND_001_SOURCE_SHA,
  validateSelectionGateSchema,
  type SelectionGateSchema,
} from "../src/lib/research/index.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const source = readFileSync("src/lib/research/selection-gates-round-001.ts", "utf8");

describe("M3-G.2 immutable round-001 gate record", () => {
  it("freezes the exact research round and tooling source", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-001");
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.researchRoundId).toBe("baseline-002-research-round-001");
    expect(BASELINE_002_RESEARCH_ROUND_001_SOURCE_SHA).toBe("2f2c8f442b86bb730745908a6d6bf6a76ac43dd6");
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.sourceSha).toBe("2f2c8f442b86bb730745908a6d6bf6a76ac43dd6");
  });

  it("uses the existing schema validator and is deeply immutable", () => {
    const validated = validateSelectionGateSchema(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES);
    expect(validated).toEqual(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.minimumAggregateImprovement)).toBe(true);
    expect(Object.isFrozen(validated.simplerCandidateRule.tieBreakOrder)).toBe(true);
  });

  it("freezes every exact numeric gate value and unit", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES).toMatchObject({
      minimumAggregateImprovement: { value: 0.1, unit: "R/executed-trade" },
      minimumImprovedValidationFolds: { value: 4, unit: "folds" },
      catastrophicFoldLimit: { value: 0, unit: "folds" },
      minimumNetExpectancy: { value: 0.03, unit: "R/executed-trade" },
      minimumProfitFactor: { value: 1.2, unit: "ratio" },
      maximumSymbolConcentration: { value: 0.5, unit: "fraction" },
      maximumSingleTradeConcentration: { value: 0.1, unit: "fraction" },
      requiredRedundancyImprovement: { value: 0.3, unit: "fractional-relative-reduction" },
      minimumFormalSignals: { value: 300, unit: "formal-signals" },
      minimumExecutedTrades: { value: 30, unit: "executed-trades" },
      maximumFeeBurdenRatio: { value: 0.75, unit: "ratio" },
      complexityTieThreshold: { value: 0.01, unit: "R/executed-trade" },
    });
  });

  it("enforces every frozen direction and comparison pair", () => {
    const expected = {
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
    for (const [field, [direction, comparison]] of Object.entries(expected)) {
      expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES[field as keyof typeof expected]).toMatchObject({ direction, comparison });
    }
  });

  it("rejects contradictory minimum profit-factor and maximum concentration gates", () => {
    const minimumPf = {
      ...BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.minimumProfitFactor,
      direction: "MAXIMUM",
      comparison: "AT_MOST",
    } as const;
    const maximumConcentration = {
      ...BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.maximumSymbolConcentration,
      direction: "MINIMUM",
      comparison: "AT_LEAST",
    } as const;
    expect(() => validateSelectionGateSchema({
      ...BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES,
      minimumProfitFactor: minimumPf,
    } as unknown as SelectionGateSchema)).toThrow(/minimumProfitFactor/);
    expect(() => validateSelectionGateSchema({
      ...BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES,
      maximumSymbolConcentration: maximumConcentration,
    } as unknown as SelectionGateSchema)).toThrow(/maximumSymbolConcentration/);
  });

  it("freezes the exact fold-improvement rule", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.foldImprovementDeltaR).toBe(0.02);
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.validationFoldCount).toBe(6);
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.minimumImprovedValidationFolds.denominator).toContain(">= 0.02");
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.minimumImprovedValidationFolds.denominator).toContain("insufficient-sample folds are not improved");
  });

  it("freezes the exact catastrophic-fold definition", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.catastrophicFoldLimit.value).toBe(0);
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.catastrophicFold).toEqual({
      expectancyRAtMost: -0.1,
      normalProfitFactorBelow: 0.8,
      noTradesIsCatastrophic: true,
      insufficientFoldSampleIsCatastrophic: true,
      noLossesIsCatastrophicSolelyBecausePfNull: false,
    });
  });

  it("freezes aggregate expectancy, PF, concentration, and fee-burden semantics", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.minimumNetExpectancy.denominator).toContain("concatenated F1-F6");
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.minimumProfitFactor.denominator).toContain("positive netR / abs");
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.maximumSymbolConcentration.denominator).toContain("topSymbolShareOfPositiveNetR");
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.maximumSingleTradeConcentration.denominator).toContain("largestSingleTradeShareOfPositiveNetR");
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.maximumFeeBurdenRatio.denominator).toContain("feeR / abs");
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.maximumFeeBurdenRatio.denominator).toContain("grossR == 0 or null fails");
  });

  it("freezes redundancy applicability without converting N/A to zero", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.redundancyApplicability).toEqual({
      H1_SIGNAL_REDUNDANCY: "REQUIRED",
      H4_SIGNAL_DENSITY: "REQUIRED",
      H2_COST_ADJUSTED_EDGE: "NOT_APPLICABLE",
      H3_SCORE_CALIBRATION: "NOT_APPLICABLE",
      H5_REGIME_QUALITY: "NOT_APPLICABLE",
      combinationContainingH1OrH4: "REQUIRED",
      notApplicableRepresentation: "NOT_APPLICABLE",
      notApplicableCountsAsPass: false,
    });
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.requiredRedundancyImprovement.value).toBe(0.3);
  });

  it("freezes per-fold and aggregate sample floors", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.minimumFormalSignals).toMatchObject({ value: 300, comparison: "AT_LEAST" });
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.minimumExecutedTrades).toMatchObject({ value: 30, comparison: "AT_LEAST" });
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.minimumExecutedTrades.denominator).toContain("each individual validation fold F1-F6");
  });

  it("freezes the complexity dimensions and deterministic selection order", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.complexityDimensions).toEqual([
      "newRules",
      "newTunableThresholds",
      "modifiedBaselineRules",
      "mechanismFamiliesUsed",
    ]);
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.simplerCandidateRule.tieBreakOrder).toEqual([
      "improvedValidationFolds",
      "aggregateValidationExpectancyR",
      "complexityTuple",
      "aggregateValidationProfitFactor",
      "experimentId",
    ]);
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.selectionAlgorithm.complexityTieThresholdRule).toBe(
      "abs(candidateA.expectancyR - candidateB.expectancyR) <= 0.01",
    );
  });

  it("freezes the no-candidate and seen-data outcomes without a performance result", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.seenDataClassification).toBe("HISTORICAL RESEARCH VALIDATION / SEEN DATA");
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.noCandidateOutcome).toBe("NO BASELINE-002 CANDIDATE");
    expect(JSON.stringify(BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD)).not.toMatch(/OOS_PASS|UNTOUCHED_OOS|PRISTINE_OOS/);
  });

  it("serializes the complete machine record deterministically and reproduces its SHA-256", () => {
    const canonical = stableStringify(BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD);
    const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
    expect(canonical).toBe(BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON);
    expect(hash).toBe(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256);
    expect(BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON.endsWith("\n")).toBe(false);
  });

  it("does not add a historical runner, network dependency, or baseline-002 strategy", () => {
    expect(source).not.toMatch(/Date\.now\(|Math\.random\(|fetch\(|binance|backtest:run|historical loader|StrategyEngine/);
    expect(source).not.toMatch(/DEFAULT_SELECTION_GATES|candidatePerformance|netRResult|profitFactorResult/);
  });

  it("keeps the gate record outside M3-H and M4 boundaries", () => {
    expect(source).not.toMatch(/M3-H result|runHistorical|executeBacktest|optimizer|gridSearch/);
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES.researchRoundId).toBe("baseline-002-research-round-001");
  });
});

describe("M3-G.2 machine-readable semantic contract", () => {
  it("SHA-covers the all-applicable hard-gate conjunction", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.eligibilityPolicy).toEqual({
      mode: "ALL_APPLICABLE_GATES_MUST_PASS",
      notApplicableHandling: "EXCLUDED_FROM_CONJUNCTION_NOT_COUNTED_AS_PASS",
      performanceGateFailure: "INELIGIBLE",
      integrityFailure: "INELIGIBLE_INCOMPLETE_EVIDENCE",
    });
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.hardGateIdentities).toEqual([
      "minimumAggregateImprovement",
      "minimumImprovedValidationFolds",
      "catastrophicFoldLimit",
      "minimumNetExpectancy",
      "minimumProfitFactor",
      "maximumSymbolConcentration",
      "maximumSingleTradeConcentration",
      "maximumFeeBurdenRatio",
      "requiredRedundancyImprovement",
      "minimumFormalSignals",
      "minimumExecutedTrades",
    ]);
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.hardGateIdentities).not.toContain("complexityTieThreshold");
    expect(BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON).toContain("ALL_APPLICABLE_GATES_MUST_PASS");
  });

  it("does not represent N/A redundancy as a passing gate", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.redundancyApplicability.notApplicableRepresentation).toBe("NOT_APPLICABLE");
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.redundancyApplicability.notApplicableCountsAsPass).toBe(false);
  });

  it("requires redundancy for a combination containing H1 or H4", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.redundancyApplicability.combinationContainingH1OrH4).toBe("REQUIRED");
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.redundancyApplicability.H1_SIGNAL_REDUNDANCY).toBe("REQUIRED");
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.redundancyApplicability.H4_SIGNAL_DENSITY).toBe("REQUIRED");
  });

  it("keeps pure H2, H3, and H5 mechanisms not applicable", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.redundancyApplicability).toMatchObject({
      H2_COST_ADJUSTED_EDGE: "NOT_APPLICABLE",
      H3_SCORE_CALIBRATION: "NOT_APPLICABLE",
      H5_REGIME_QUALITY: "NOT_APPLICABLE",
    });
  });

  it("does not make NO_LOSSES catastrophic only because PF is null", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.catastrophicFold.noLossesIsCatastrophicSolelyBecausePfNull).toBe(false);
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.profitFactorStatusSemantics.NO_LOSSES).toBe(
      "PF_GATE_PASSES_ONLY_IF_ALL_SAMPLE_GATES_PASS",
    );
  });

  it("freezes NO_TRADES PF status as a failure", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.profitFactorStatusSemantics.NO_TRADES).toBe("FAIL");
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.profitFactorStatusSemantics.encodeInfinity).toBe(false);
  });

  it("freezes aggregate validation as F1-F6 validation concatenation", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.aggregateValidationDefinition).toEqual({
      foldIds: ["F1", "F2", "F3", "F4", "F5", "F6"],
      role: "VALIDATION",
      construction: "CONCATENATE_NON_OVERLAPPING_FROZEN_VALIDATION_SEGMENTS",
      timeBasis: "signalTime",
      forbiddenInterpretations: [
        "AVERAGE_OF_FOLD_METRICS",
        "RESEARCH_PLUS_VALIDATION",
        "RANDOM_POOLED_PERIOD",
        "ALTERNATE_PERIOD",
      ],
    });
  });

  it("requires every complexity dimension to be a non-negative integer", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.complexityDimensionDomain).toEqual({
      type: "NON_NEGATIVE_INTEGER",
      dimensions: [
        "newRules",
        "newTunableThresholds",
        "modifiedBaselineRules",
        "mechanismFamiliesUsed",
      ],
    });
  });

  it("makes the round immutable at the first M3-H performance result", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.roundImmutability.becomesImmutableAt).toBe(
      "FIRST_M3_H_PERFORMANCE_RESULT_GENERATED",
    );
  });

  it("freezes every semantic change that invalidates round-001", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.roundImmutability.invalidatingChanges).toEqual([
      "GATE_VALUE",
      "GATE_FORMULA",
      "FOLD_IMPROVEMENT_DEFINITION",
      "CATASTROPHIC_FOLD_DEFINITION",
      "APPLICABILITY_RULE",
      "SAMPLE_FLOOR",
      "SELECTION_TIE_RULE",
      "AGGREGATE_VALIDATION_DEFINITION",
    ]);
  });

  it("requires a new research round after invalidation", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.roundImmutability.actionOnChange).toBe(
      "INVALIDATE_ROUND_AND_REQUIRE_NEW_RESEARCH_ROUND",
    );
  });

  it("classifies prior invalidated-round results as SEEN_DATA", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.roundImmutability.priorResultsClassification).toBe("SEEN_DATA");
  });

  it("does not weaken gates after a failed candidate round", () => {
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.failedRoundCandidatePolicy).toBe("DO_NOT_WEAKEN_GATES");
    expect(BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.noCandidateOutcome).toBe("NO BASELINE-002 CANDIDATE");
  });

  it("keeps canonical serialization byte-stable", () => {
    expect(stableStringify(BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD)).toBe(
      BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON,
    );
    expect(BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON.endsWith("\n")).toBe(false);
  });

  it("matches the recomputed SHA-256 to the canonical bytes exactly", () => {
    const hash = createHash("sha256")
      .update(BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON, "utf8")
      .digest("hex");
    expect(hash).toBe(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256);
    expect(BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256).not.toBe(
      "a27e830e14cdaa6a7cf86cc8bc59ea60f40d6a5ab8f560c5dc57ac250eaf0b21",
    );
  });
});
