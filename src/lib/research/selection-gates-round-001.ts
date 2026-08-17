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
  foldImprovementDeltaR: 0.02,
  validationFoldCount: 6,
  catastrophicFold: {
    expectancyRAtMost: -0.1,
    normalProfitFactorBelow: 0.8,
    noTradesIsCatastrophic: true,
    insufficientFoldSampleIsCatastrophic: true,
  },
  redundancyApplicability: {
    H1_SIGNAL_REDUNDANCY: "REQUIRED",
    H4_SIGNAL_DENSITY: "REQUIRED",
    H2_COST_ADJUSTED_EDGE: "NOT_APPLICABLE_FOR_PURE_SINGLE_MECHANISM",
    H3_SCORE_CALIBRATION: "NOT_APPLICABLE_FOR_PURE_SINGLE_MECHANISM",
    H5_REGIME_QUALITY: "NOT_APPLICABLE_FOR_PURE_SINGLE_MECHANISM",
  },
  complexityDimensions: [
    "newRules",
    "newTunableThresholds",
    "modifiedBaselineRules",
    "mechanismFamiliesUsed",
  ],
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
});

export const BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD = deepFreeze({
  selectionGates: BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATES,
  definitions: BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS,
});

export const BASELINE_002_RESEARCH_ROUND_001_CANONICAL_JSON = stableStringify(
  BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD,
);

export const BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256 = "a27e830e14cdaa6a7cf86cc8bc59ea60f40d6a5ab8f560c5dc57ac250eaf0b21" as const;
