import type { SelectionGateSchema } from "./types.ts";
import { validateSelectionGateSchema } from "./gates.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID = "baseline-002-research-round-001" as const;
export const BASELINE_002_RESEARCH_ROUND_001_SOURCE_SHA = "2f2c8f442b86bb730745908a6d6bf6a76ac43dd6" as const;

export const BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES: SelectionGateSchema = validateSelectionGateSchema({
  researchRoundId: BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID,
  sourceSha: BASELINE_002_RESEARCH_ROUND_001_SOURCE_SHA,
  minimumAggregateImprovement: {
    value: 0.1,
    unit: "R/executed-trade",
    direction: "MINIMUM",
    comparison: "AT_LEAST",
    denominator: "candidate aggregate validation expectancyR - CONTROL_BASELINE_001 aggregate validation expectancyR",
  },
  minimumImprovedValidationFolds: {
    value: 4,
    unit: "folds",
    direction: "MINIMUM",
    comparison: "AT_LEAST",
    denominator: "6 frozen validation folds F1-F6; improved means candidateFold.expectancyR - controlFold.expectancyR >= 0.02 R/executed-trade; insufficient-sample folds are not improved",
  },
  catastrophicFoldLimit: {
    value: 0,
    unit: "folds",
    direction: "MAXIMUM",
    comparison: "AT_MOST",
    denominator: "6 frozen validation folds; catastrophic if expectancyR <= -0.10, NORMAL PF < 0.80, NO_TRADES, or failed per-fold executed-trade sample",
  },
  minimumNetExpectancy: {
    value: 0.03,
    unit: "R/executed-trade",
    direction: "MINIMUM",
    comparison: "AT_LEAST",
    denominator: "all executed trades in concatenated F1-F6 validation segments after frozen fees, slippage, and funding",
  },
  minimumProfitFactor: {
    value: 1.2,
    unit: "ratio",
    direction: "MINIMUM",
    comparison: "AT_LEAST",
    denominator: "aggregate validation positive netR / abs(aggregate validation negative netR); NO_LOSSES passes only with all sample gates, NO_TRADES fails",
  },
  maximumSymbolConcentration: {
    value: 0.5,
    unit: "fraction",
    direction: "MAXIMUM",
    comparison: "AT_MOST",
    denominator: "topSymbolShareOfPositiveNetR on aggregate validation data; null fails",
  },
  maximumSingleTradeConcentration: {
    value: 0.1,
    unit: "fraction",
    direction: "MAXIMUM",
    comparison: "AT_MOST",
    denominator: "largestSingleTradeShareOfPositiveNetR on aggregate validation data; null fails",
  },
  maximumFeeBurdenRatio: {
    value: 0.75,
    unit: "ratio",
    direction: "MAXIMUM",
    comparison: "AT_MOST",
    denominator: "aggregate validation feeR / abs(aggregate validation grossR); grossR == 0 or null fails",
  },
  requiredRedundancyImprovement: {
    value: 0.3,
    unit: "fractional-relative-reduction",
    direction: "MINIMUM",
    comparison: "AT_LEAST",
    denominator: "(CONTROL overlappingSignalRate - candidate overlappingSignalRate) / CONTROL overlappingSignalRate; mandatory for H1/H4 mechanisms and N/A for pure H2/H3/H5",
  },
  minimumFormalSignals: {
    value: 300,
    unit: "formal-signals",
    direction: "MINIMUM",
    comparison: "AT_LEAST",
    denominator: "aggregate formal signals across all F1-F6 validation segments",
  },
  minimumExecutedTrades: {
    value: 30,
    unit: "executed-trades",
    direction: "MINIMUM",
    comparison: "AT_LEAST",
    denominator: "each individual validation fold F1-F6",
  },
  complexityTieThreshold: {
    value: 0.01,
    unit: "R/executed-trade",
    direction: "MAXIMUM",
    comparison: "AT_MOST",
    denominator: "absolute difference in aggregate validation expectancyR between two eligible candidates",
  },
  simplerCandidateRule: {
    rule: "Prefer more improved validation folds; when tied, prefer higher expectancy only when the difference exceeds complexityTieThreshold; otherwise prefer lexicographically simpler complexity, then higher PF, then experimentId ascending.",
    tieBreakOrder: [
      "improvedValidationFolds",
      "aggregateValidationExpectancyR",
      "complexityTuple",
      "aggregateValidationProfitFactor",
      "experimentId",
    ],
  },
});

export const BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS = deepFreeze({
  researchRoundId: BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID,
  eligibilityPolicy: {
    mode: "ALL_APPLICABLE_GATES_MUST_PASS",
    notApplicableHandling: "EXCLUDED_FROM_CONJUNCTION_NOT_COUNTED_AS_PASS",
    performanceGateFailure: "INELIGIBLE",
    integrityFailure: "INELIGIBLE_INCOMPLETE_EVIDENCE",
  },
  hardGateIdentities: [
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
  ],
  foldImprovementDeltaR: 0.02,
  validationFoldCount: 6,
  catastrophicFold: {
    expectancyRAtMost: -0.1,
    normalProfitFactorBelow: 0.8,
    noTradesIsCatastrophic: true,
    insufficientFoldSampleIsCatastrophic: true,
    noLossesIsCatastrophicSolelyBecausePfNull: false,
  },
  profitFactorStatusSemantics: {
    NORMAL: "COMPARE_NUMERIC_PF_TO_MINIMUM_PROFIT_FACTOR",
    NO_LOSSES: "PF_GATE_PASSES_ONLY_IF_ALL_SAMPLE_GATES_PASS",
    NO_TRADES: "FAIL",
    encodeInfinity: false,
  },
  redundancyApplicability: {
    H1_SIGNAL_REDUNDANCY: "REQUIRED",
    H4_SIGNAL_DENSITY: "REQUIRED",
    H2_COST_ADJUSTED_EDGE: "NOT_APPLICABLE",
    H3_SCORE_CALIBRATION: "NOT_APPLICABLE",
    H5_REGIME_QUALITY: "NOT_APPLICABLE",
    combinationContainingH1OrH4: "REQUIRED",
    notApplicableRepresentation: "NOT_APPLICABLE",
    notApplicableCountsAsPass: false,
  },
  aggregateValidationDefinition: {
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
  },
  complexityDimensions: [
    "newRules",
    "newTunableThresholds",
    "modifiedBaselineRules",
    "mechanismFamiliesUsed",
  ],
  complexityDimensionDomain: {
    type: "NON_NEGATIVE_INTEGER",
    dimensions: [
      "newRules",
      "newTunableThresholds",
      "modifiedBaselineRules",
      "mechanismFamiliesUsed",
    ],
  },
  selectionAlgorithm: {
    orderedCriteria: [
      { criterion: "improvedValidationFolds", direction: "DESCENDING" },
      { criterion: "aggregateValidationExpectancyR", direction: "DESCENDING_IF_DIFFERENCE_GT_COMPLEXITY_TIE_THRESHOLD" },
      { criterion: "complexityTuple", direction: "LEXICOGRAPHIC_ASCENDING" },
      { criterion: "aggregateValidationProfitFactor", direction: "DESCENDING" },
      { criterion: "experimentId", direction: "LEXICOGRAPHIC_ASCENDING" },
    ],
    complexityTieThresholdRule: "abs(candidateA.expectancyR - candidateB.expectancyR) <= 0.01",
  },
  dataIntegrityRequirements: [
    "bt-policy-003",
    "m3-b-report-004-compatible study clock provenance",
    "valid studyServerTime",
    "exact F1-F6 fold ranges",
    "RESEARCH_AVAILABLE_SEEN_DATA classification",
    "no cross-fold records",
    "no duplicate formal identities",
    "no DATA_INCOMPLETE",
    "no SETTLEMENT_AMBIGUOUS",
    "deterministic serialization",
  ],
  seenDataClassification: "HISTORICAL RESEARCH VALIDATION / SEEN DATA",
  noCandidateOutcome: "NO BASELINE-002 CANDIDATE",
  failedRoundCandidatePolicy: "DO_NOT_WEAKEN_GATES",
  roundImmutability: {
    becomesImmutableAt: "FIRST_M3_H_PERFORMANCE_RESULT_GENERATED",
    invalidatingChanges: [
      "GATE_VALUE",
      "GATE_FORMULA",
      "FOLD_IMPROVEMENT_DEFINITION",
      "CATASTROPHIC_FOLD_DEFINITION",
      "APPLICABILITY_RULE",
      "SAMPLE_FLOOR",
      "SELECTION_TIE_RULE",
      "AGGREGATE_VALIDATION_DEFINITION",
    ],
    actionOnChange: "INVALIDATE_ROUND_AND_REQUIRE_NEW_RESEARCH_ROUND",
    priorResultsClassification: "SEEN_DATA",
  },
});

export const BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD = deepFreeze({
  selectionGates: BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES,
  definitions: BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS,
});

export const BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON = stableStringify(
  BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD,
);

export const BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256 = "11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd" as const;
