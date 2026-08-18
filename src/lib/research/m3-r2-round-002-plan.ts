import { createHash } from "node:crypto";

import {
  M3_R2_ROUND_002_CANDIDATE_IDS,
  M3_R2_ROUND_002_INVALIDATING_CATEGORIES,
  M3_R2_ROUND_002_MECHANISM_IDS,
  M3_R2_ROUND_002_NO_CANDIDATE_OUTCOME,
  M3_R2_ROUND_002_PERFORMANCE_LOCK,
  M3_R2_ROUND_002_RESEARCH_ROUND_ID,
  M3_R2_ROUND_002_SOURCE_SHA,
  BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
} from "./selection-gates-round-002.ts";
import { BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS } from "./selection-gates-round-001.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R2_ROUND_002_PLAN_SCHEMA_VERSION = "m3-r2-round-002-plan-001" as const;
export const M3_R2_ROUND_002_CONTROL_ID = "R2-CONTROL-BASELINE-001" as const;
export const M3_R2_ROUND_002_CANDIDATE_COUNT = 9 as const;
export const M3_R2_ROUND_002_RESULT_IDENTITY_COUNT = 10 as const;
export const M3_R2_ROUND_002_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;

export const M3_R2_ROUND_002_RESULT_IDENTITY_ORDER = Object.freeze([
  M3_R2_ROUND_002_CONTROL_ID,
  ...M3_R2_ROUND_002_CANDIDATE_IDS,
] as const);

export const M3_R2_ROUND_002_DECISION_SNAPSHOT_FIELDS = Object.freeze([
  "signalTime",
  "symbol",
  "direction",
  "btcRegime",
  "symbol4hClose",
  "symbol4hEma50",
  "symbol4hEma200",
  "symbol4hAtr",
  "symbol4hEma200FiveBarsAgo",
  "nearestBaselinePullbackTouchAgeBars",
  "current1hQuoteVolume",
  "previous20Closed1hQuoteVolumeMean",
  "current1hClose",
  "previous3BreakoutExtreme",
  "current1hAtr",
  "breakoutMarginAtr",
] as const);

export const M3_R2_ROUND_002_FORBIDDEN_SELECTOR_FIELDS = Object.freeze([
  "status",
  "entryTime",
  "exitTime",
  "exitReason",
  "grossR",
  "feeR",
  "fundingR",
  "netR",
  "fundingCharges",
  "heldCandleNumber",
  "futureCandles",
  "futureFunding",
  "realizedSettlementResult",
] as const);

export type M3R2ComplexityTuple = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

export const M3_R2_ROUND_002_COMPLEXITY_TUPLES = deepFreeze({
  [M3_R2_ROUND_002_CONTROL_ID]: { newRules: 0, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 0 },
  "R2-H6-STRICT-BTC": { newRules: 0, newTunableThresholds: 0, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
  "R2-H7-STRONG-SYMBOL": { newRules: 0, newTunableThresholds: 3, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
  "R2-H8-RECENT-PULLBACK": { newRules: 0, newTunableThresholds: 1, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
  "R2-H9-VOLUME-CONFIRM": { newRules: 1, newTunableThresholds: 2, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R2-H10-BREAKOUT-010": { newRules: 0, newTunableThresholds: 1, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
  "R2-C1-BTC-STRONG-SYMBOL": { newRules: 0, newTunableThresholds: 3, modifiedBaselineRules: 2, mechanismFamiliesUsed: 2 },
  "R2-C2-STRONG-SYMBOL-RECENT-PULLBACK": { newRules: 0, newTunableThresholds: 4, modifiedBaselineRules: 2, mechanismFamiliesUsed: 2 },
  "R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT": { newRules: 1, newTunableThresholds: 6, modifiedBaselineRules: 2, mechanismFamiliesUsed: 3 },
  "R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT": { newRules: 1, newTunableThresholds: 6, modifiedBaselineRules: 3, mechanismFamiliesUsed: 4 },
} as const);

export type M3R2ParameterValue = Readonly<{
  name: string;
  unit: string;
  values: readonly number[];
}>;

export const M3_R2_ROUND_002_PARAMETER_DEFINITIONS = deepFreeze({
  closeDistanceAtrMin: { name: "closeDistanceAtrMin", unit: "ATR multiples", values: [1.0] },
  emaSpreadAtrMin: { name: "emaSpreadAtrMin", unit: "ATR multiples", values: [0.5] },
  ema200SlopeAtrMin: { name: "ema200SlopeAtrMin", unit: "ATR multiples", values: [0.1] },
  maxTouchAgeBars: { name: "maxTouchAgeBars", unit: "closed 1H bars", values: [2] },
  volumeLookbackBars: { name: "volumeLookbackBars", unit: "closed 1H bars", values: [20] },
  minCurrentToMeanRatio: { name: "minCurrentToMeanRatio", unit: "quote-volume ratio", values: [1.0] },
  breakoutBufferAtr: { name: "breakoutBufferAtr", unit: "ATR multiples", values: [0.1] },
});

export type M3R2SelectorKind =
  | "CONTROL_BASELINE_001"
  | "H6_STRICT_BTC_ALIGNMENT"
  | "H7_STRONG_SYMBOL_REGIME"
  | "H8_RECENT_PULLBACK"
  | "H9_VOLUME_CONFIRMATION"
  | "H10_BREAKOUT_BUFFER"
  | "COMBINATION";

export type M3R2CandidateDefinition = Readonly<{
  candidateId: string;
  role: "CONTROL" | "SINGLE_MECHANISM" | "COMBINATION";
  mechanismIds: readonly string[];
  inheritedFromCandidateIds: readonly string[];
  parametersTested: readonly M3R2ParameterValue[];
  selectorKind: M3R2SelectorKind;
  complexity: M3R2ComplexityTuple;
}>;

const parameter = (name: keyof typeof M3_R2_ROUND_002_PARAMETER_DEFINITIONS): M3R2ParameterValue =>
  M3_R2_ROUND_002_PARAMETER_DEFINITIONS[name];

export const M3_R2_ROUND_002_CANDIDATE_DEFINITIONS = deepFreeze([
  {
    candidateId: M3_R2_ROUND_002_CONTROL_ID,
    role: "CONTROL",
    mechanismIds: [],
    inheritedFromCandidateIds: [],
    parametersTested: [],
    selectorKind: "CONTROL_BASELINE_001",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES[M3_R2_ROUND_002_CONTROL_ID],
  },
  {
    candidateId: "R2-H6-STRICT-BTC",
    role: "SINGLE_MECHANISM",
    mechanismIds: ["H6_STRICT_BTC_ALIGNMENT"],
    inheritedFromCandidateIds: [],
    parametersTested: [],
    selectorKind: "H6_STRICT_BTC_ALIGNMENT",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-H6-STRICT-BTC"],
  },
  {
    candidateId: "R2-H7-STRONG-SYMBOL",
    role: "SINGLE_MECHANISM",
    mechanismIds: ["H7_STRONG_SYMBOL_REGIME"],
    inheritedFromCandidateIds: [],
    parametersTested: [parameter("closeDistanceAtrMin"), parameter("emaSpreadAtrMin"), parameter("ema200SlopeAtrMin")],
    selectorKind: "H7_STRONG_SYMBOL_REGIME",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-H7-STRONG-SYMBOL"],
  },
  {
    candidateId: "R2-H8-RECENT-PULLBACK",
    role: "SINGLE_MECHANISM",
    mechanismIds: ["H8_RECENT_PULLBACK"],
    inheritedFromCandidateIds: [],
    parametersTested: [parameter("maxTouchAgeBars")],
    selectorKind: "H8_RECENT_PULLBACK",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-H8-RECENT-PULLBACK"],
  },
  {
    candidateId: "R2-H9-VOLUME-CONFIRM",
    role: "SINGLE_MECHANISM",
    mechanismIds: ["H9_VOLUME_CONFIRMATION"],
    inheritedFromCandidateIds: [],
    parametersTested: [parameter("volumeLookbackBars"), parameter("minCurrentToMeanRatio")],
    selectorKind: "H9_VOLUME_CONFIRMATION",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-H9-VOLUME-CONFIRM"],
  },
  {
    candidateId: "R2-H10-BREAKOUT-010",
    role: "SINGLE_MECHANISM",
    mechanismIds: ["H10_BREAKOUT_BUFFER"],
    inheritedFromCandidateIds: [],
    parametersTested: [parameter("breakoutBufferAtr")],
    selectorKind: "H10_BREAKOUT_BUFFER",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-H10-BREAKOUT-010"],
  },
  {
    candidateId: "R2-C1-BTC-STRONG-SYMBOL",
    role: "COMBINATION",
    mechanismIds: ["H6_STRICT_BTC_ALIGNMENT", "H7_STRONG_SYMBOL_REGIME"],
    inheritedFromCandidateIds: ["R2-H6-STRICT-BTC", "R2-H7-STRONG-SYMBOL"],
    parametersTested: [parameter("closeDistanceAtrMin"), parameter("emaSpreadAtrMin"), parameter("ema200SlopeAtrMin")],
    selectorKind: "COMBINATION",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-C1-BTC-STRONG-SYMBOL"],
  },
  {
    candidateId: "R2-C2-STRONG-SYMBOL-RECENT-PULLBACK",
    role: "COMBINATION",
    mechanismIds: ["H7_STRONG_SYMBOL_REGIME", "H8_RECENT_PULLBACK"],
    inheritedFromCandidateIds: ["R2-H7-STRONG-SYMBOL", "R2-H8-RECENT-PULLBACK"],
    parametersTested: [parameter("closeDistanceAtrMin"), parameter("emaSpreadAtrMin"), parameter("ema200SlopeAtrMin"), parameter("maxTouchAgeBars")],
    selectorKind: "COMBINATION",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-C2-STRONG-SYMBOL-RECENT-PULLBACK"],
  },
  {
    candidateId: "R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT",
    role: "COMBINATION",
    mechanismIds: ["H7_STRONG_SYMBOL_REGIME", "H9_VOLUME_CONFIRMATION", "H10_BREAKOUT_BUFFER"],
    inheritedFromCandidateIds: ["R2-H7-STRONG-SYMBOL", "R2-H9-VOLUME-CONFIRM", "R2-H10-BREAKOUT-010"],
    parametersTested: [parameter("closeDistanceAtrMin"), parameter("emaSpreadAtrMin"), parameter("ema200SlopeAtrMin"), parameter("volumeLookbackBars"), parameter("minCurrentToMeanRatio"), parameter("breakoutBufferAtr")],
    selectorKind: "COMBINATION",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT"],
  },
  {
    candidateId: "R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT",
    role: "COMBINATION",
    mechanismIds: ["H6_STRICT_BTC_ALIGNMENT", "H7_STRONG_SYMBOL_REGIME", "H9_VOLUME_CONFIRMATION", "H10_BREAKOUT_BUFFER"],
    inheritedFromCandidateIds: ["R2-H6-STRICT-BTC", "R2-H7-STRONG-SYMBOL", "R2-H9-VOLUME-CONFIRM", "R2-H10-BREAKOUT-010"],
    parametersTested: [parameter("closeDistanceAtrMin"), parameter("emaSpreadAtrMin"), parameter("ema200SlopeAtrMin"), parameter("volumeLookbackBars"), parameter("minCurrentToMeanRatio"), parameter("breakoutBufferAtr")],
    selectorKind: "COMBINATION",
    complexity: M3_R2_ROUND_002_COMPLEXITY_TUPLES["R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT"],
  },
] as const);

export const M3_R2_ROUND_002_PLAN = deepFreeze({
  schemaVersion: M3_R2_ROUND_002_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R2_ROUND_002_RESEARCH_ROUND_ID,
  sourceSha: M3_R2_ROUND_002_SOURCE_SHA,
  dataClassification: M3_R2_ROUND_002_DATA_CLASSIFICATION,
  researchUniverse: {
    startTime: Date.parse("2023-01-01T00:00:00.000Z"),
    endTime: Date.parse("2026-08-15T23:59:59.999Z"),
    rule: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
  inheritedSelectionGateSha256: "11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd",
  selectionGateSha256: BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
  performanceStatus: "NOT_GENERATED",
  performanceLock: M3_R2_ROUND_002_PERFORMANCE_LOCK,
  candidateCount: M3_R2_ROUND_002_CANDIDATE_COUNT,
  resultIdentityCount: M3_R2_ROUND_002_RESULT_IDENTITY_COUNT,
  candidateOrdering: M3_R2_ROUND_002_RESULT_IDENTITY_ORDER,
  controlId: M3_R2_ROUND_002_CONTROL_ID,
  candidateIds: M3_R2_ROUND_002_CANDIDATE_IDS,
  mechanismIds: M3_R2_ROUND_002_MECHANISM_IDS,
  candidates: M3_R2_ROUND_002_CANDIDATE_DEFINITIONS,
  complexityDimensions: BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.complexityDimensions,
  complexityDimensionDomain: BASELINE_002_RESEARCH_ROUND_001_DEFINITIONS.complexityDimensionDomain,
  decisionSnapshotFields: M3_R2_ROUND_002_DECISION_SNAPSHOT_FIELDS,
  forbiddenSelectorFields: M3_R2_ROUND_002_FORBIDDEN_SELECTOR_FIELDS,
  selectorPolicy: {
    input: "M3R2DecisionSnapshot only",
    output: "strict subset of original snapshot references",
    duplicateIdentity: "symbol|direction|signalTime is rejected",
    ordering: "signalTime ascending, frozen symbol order, LONG before SHORT",
    combination: "exact AND of named component selectors; no OR, weights, scores, fallback, or state",
  },
  noCandidateOutcome: M3_R2_ROUND_002_NO_CANDIDATE_OUTCOME,
  invalidatingCategories: M3_R2_ROUND_002_INVALIDATING_CATEGORIES,
} as const);

export const M3_R2_ROUND_002_PLAN_CANONICAL_JSON = stableStringify(M3_R2_ROUND_002_PLAN);

// Replaced with the SHA of the final canonical plan before commit.
export const M3_R2_ROUND_002_PLAN_SHA256 = "3438882d019a5fc99875214e7a6a56892c83aa8e8b47d45fd5443045e097fd21" as const;

export function validateM3R2Round002Plan(
  plan: typeof M3_R2_ROUND_002_PLAN = M3_R2_ROUND_002_PLAN,
): typeof M3_R2_ROUND_002_PLAN {
  if (plan.schemaVersion !== M3_R2_ROUND_002_PLAN_SCHEMA_VERSION) throw new Error("M3-R2-B plan schema mismatch.");
  if (plan.researchRoundId !== M3_R2_ROUND_002_RESEARCH_ROUND_ID) throw new Error("M3-R2-B plan research round mismatch.");
  if (plan.sourceSha !== M3_R2_ROUND_002_SOURCE_SHA) throw new Error("M3-R2-B plan source SHA mismatch.");
  if (plan.performanceStatus !== "NOT_GENERATED") throw new Error("M3-R2-B plan must be pre-performance.");
  if (plan.candidateCount !== M3_R2_ROUND_002_CANDIDATE_COUNT || plan.resultIdentityCount !== M3_R2_ROUND_002_RESULT_IDENTITY_COUNT) {
    throw new Error("M3-R2-B plan candidate counts are frozen.");
  }
  if (stableStringify(plan.candidateOrdering) !== stableStringify(M3_R2_ROUND_002_RESULT_IDENTITY_ORDER)) {
    throw new Error("M3-R2-B plan candidate ordering changed.");
  }
  if (stableStringify(plan.candidateIds) !== stableStringify(M3_R2_ROUND_002_CANDIDATE_IDS)) {
    throw new Error("M3-R2-B plan candidate registry changed.");
  }
  if (createHash("sha256").update(stableStringify(plan), "utf8").digest("hex") !== M3_R2_ROUND_002_PLAN_SHA256) {
    throw new Error("M3-R2-B plan canonical SHA mismatch.");
  }
  return plan;
}
