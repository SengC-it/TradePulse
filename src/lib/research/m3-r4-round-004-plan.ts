import { createHash } from "node:crypto";

import { RESEARCH_FOLDS } from "./folds.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS,
  BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
  M3_R4_ROUND_004_CANDIDATE_IDS,
  M3_R4_ROUND_004_CONTROL_ID,
  M3_R4_ROUND_004_INHERITED_SELECTION_GATE_SHA256,
  M3_R4_ROUND_004_MECHANISM_IDS,
  M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME,
  M3_R4_ROUND_004_PERFORMANCE_LOCK,
  M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  M3_R4_ROUND_004_SOURCE_SHA,
} from "./selection-gates-round-004.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R4_ROUND_004_PLAN_SCHEMA_VERSION = "m3-r4-round-004-plan-001" as const;
export const M3_R4_ROUND_004_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;
export const M3_R4_ROUND_004_STRATEGY_VERSION = "baseline-001" as const;
export const M3_R4_ROUND_004_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R4_ROUND_004_CONTROL_REPORT_SCHEMA_VERSION = "m3-b-report-004" as const;
export const M3_R4_ROUND_004_R4A_DIAGNOSIS_RAW_SHA256 =
  "7f01d5bf3e38246910af6a0df90e2f68f6b1bf40cadb0a36fcfd6095ba180318" as const;
export const M3_R4_ROUND_004_R4A_PROTOCOL_RAW_SHA256 =
  "6b36aa7ef4ec273182f4ff2a9873f95f69f1409ec4474055610dddfbf350e746" as const;

export type M3R4ComplexityTuple = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

export const M3_R4_ROUND_004_COMPLEXITY_TUPLES = deepFreeze({
  "R4-H11-BREAKOUT-RETEST": { newRules: 3, newTunableThresholds: 1, modifiedBaselineRules: 2, mechanismFamiliesUsed: 1 },
  "R4-H12-PULLBACK-RECLAIM": { newRules: 3, newTunableThresholds: 0, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
  "R4-H13-ADAPTIVE-TREND-EXIT": { newRules: 2, newTunableThresholds: 1, modifiedBaselineRules: 2, mechanismFamiliesUsed: 1 },
  "R4-H14-RELATIVE-STRENGTH": { newRules: 1, newTunableThresholds: 2, modifiedBaselineRules: 1, mechanismFamiliesUsed: 1 },
} as const satisfies Record<(typeof M3_R4_ROUND_004_CANDIDATE_IDS)[number], M3R4ComplexityTuple>);

export const M3_R4_ROUND_004_CANDIDATE_DEFINITIONS = deepFreeze([
  {
    candidateId: "R4-H11-BREAKOUT-RETEST",
    hypothesisId: "H11_BREAKOUT_RETEST_ENTRY",
    mechanismFamily: "ENTRY_TIMING_REDESIGN",
    complexity: M3_R4_ROUND_004_COMPLEXITY_TUPLES["R4-H11-BREAKOUT-RETEST"],
    signalTime: "retest confirmation candle close; originSignalTime is audit-only",
    originSelection: {
      searchAgesBars: [1, 2, 3, 4],
      searchOrder: "NEWEST_ORIGIN_FIRST",
      selectionRule: "FIRST ORIGIN IN AGE 1→4 ORDER THAT PASSES THE COMPLETE ORIGIN+INVALIDATION+RETEST+RISK PIPELINE.",
      baselineReconstruction: "EXACT_BASELINE_001_USING_DATA_CLOSED_BY_ORIGIN_TIME",
      eligibility: "formalSignal === true AND totalScore >= 70 AND same symbol/direction",
      noOriginAfterAge4: true,
    },
    postOriginSequence: {
      required: "COMPLETE_CHRONOLOGICAL_CLOSED_1H_SEQUENCE_FROM_FIRST_AFTER_ORIGIN_THROUGH_CURRENT_INCLUSIVE",
      noGaps: true,
      mustEndAtCurrentCandle: true,
      stopCheck: "EVERY_POST_ORIGIN_CANDLE_INCLUSIVE_OF_CURRENT",
    },
    breakout: {
      long: "max high of the three fully closed 1H candles before origin",
      short: "min low of the three fully closed 1H candles before origin",
    },
    invalidation: {
      long: "any low <= originStopReference from first candle after origin through confirmation",
      short: "any high >= originStopReference from first candle after origin through confirmation",
    },
    confirmation: {
      long: "current.low <= breakoutLevel AND current.close > breakoutLevel",
      short: "current.high >= breakoutLevel AND current.close < breakoutLevel",
      strictCloseReclaim: true,
      forbiddenAdditions: ["ATR_TOLERANCE", "VOLUME_FILTER", "CURRENT_SCORE", "CURRENT_RSI", "NEW_REGIME_FILTER"],
    },
    riskGeometry: "entryReference = current.close; current ATR14 > 0; stopAtr inclusive [0.8, 3.0]; TP = exactly 2R",
    auditFields: [
      "signalTime", "originSignalTime", "originAgeBars", "symbol", "direction", "originTotalScore", "originGrade",
      "breakoutLevel", "originStopReference", "currentOpen", "currentHigh", "currentLow", "currentClose",
      "currentAtr14", "stopDistance", "stopAtr", "takeProfitReference", "originInvalidatedByStop",
    ],
    settlement: "next 1H open with existing bt-policy-003 adverse slippage, bracket, 2R/SL/24/SL-first/funding/fee semantics",
  },
  {
    candidateId: "R4-H12-PULLBACK-RECLAIM",
    hypothesisId: "H12_PULLBACK_RECLAIM_ENTRY",
    mechanismFamily: "ENTRY_PATTERN_REDESIGN",
    complexity: M3_R4_ROUND_004_COMPLEXITY_TUPLES["R4-H12-PULLBACK-RECLAIM"],
    signalTime: "reclaim confirmation candle close",
    preservedBaselineContext: ["4H regime", "direction", "BTC blocking", "RSI strict ranges"],
    removedRequirements: ["three-bar breakout", "score >= 70", "volume", "H6-H10"],
    pullback: {
      previousCandle: "p = t - 1",
      long: "(p.low <= EMA20[p] OR p.low <= EMA50[p]) AND p.close <= EMA20[p]",
      short: "(p.high >= EMA20[p] OR p.high >= EMA50[p]) AND p.close >= EMA20[p]",
    },
    reclaim: {
      long: "current.close > EMA20[current] AND current.close > p.high",
      short: "current.close < EMA20[current] AND current.close < p.low",
      strict: true,
    },
    riskGeometry: "prior-five stop extreme +/- 0.2 ATR14 current; ATR14 > 0; stopAtr inclusive [0.8, 3.0]; TP = exactly 2R",
    auditFields: [
      "signalTime", "symbol", "direction", "symbolRegime", "btcRegime", "previousOHLC", "previousEMA20", "previousEMA50",
      "currentOHLC", "currentEMA20", "currentRSI14", "currentATR14", "priorFiveStopExtreme", "stopReference",
      "stopDistance", "stopAtr", "takeProfitReference",
    ],
    timestampContract: "current.closeTime === signalTime AND previous.closeTime === current.closeTime - 1H; neither candle may be future data",
    settlement: "next 1H open with existing bt-policy-003 adverse slippage, bracket, 2R/SL/24/SL-first/funding/fee semantics",
  },
  {
    candidateId: "R4-H13-ADAPTIVE-TREND-EXIT",
    hypothesisId: "H13_ADAPTIVE_TREND_EXIT",
    mechanismFamily: "EXIT_ARCHITECTURE_REDESIGN",
    overlayVersion: "r4-h13-exit-001",
    complexity: M3_R4_ROUND_004_COMPLEXITY_TUPLES["R4-H13-ADAPTIVE-TREND-EXIT"],
    population: "EXACT_BASELINE_001_FORMAL_CONTROL_POPULATION",
    inheritedEntry: "same signalTime/symbol/direction/entry/stop/distance/stopAtr/score/grade/next-open/slippage",
    exit: {
      fixedTakeProfit: "baseline TP is audit-only and never triggers",
      protectiveStop: "mandatory; invalid fill is ENTRY_OUTSIDE_PROTECTIVE_STOP",
      maxHeldClosedCandles: 48,
      heldOneTo47: "SL first; otherwise close below EMA20 for LONG or above EMA20 for SHORT schedules next-candle-open TREND_EXIT",
      held48: "SL first; otherwise TIME_EXIT at raw held-48 close; no EMA next-open trigger after held-48",
      order: ["SL", "EMA_CLOSE_TRIGGER", "CONTINUE"],
      noSweep: true,
      trendExitSettlement: "trigger held candle n schedules exit on held candle n+1 OPEN; rawExitPrice = held[n+1].open; held-48 cannot schedule another trend exit",
      stopDistanceRDenominator: "ORIGINAL_BASELINE_STOP_DISTANCE",
    },
    funding: "exact bt-policy-003 rate/mark fallback/sign/audit and clock-exit boundary semantics",
    auditFields: [
      "baselineCandidateSnapshot", "exitReason", "trendTriggerHeldCandleNumber", "heldCandleNumber", "trendTriggerClose",
      "trendTriggerEma20", "rawExitPrice", "exitFill", "exitTime",
    ],
    btPolicy003GlobalHeldCandleCount: 24,
  },
  {
    candidateId: "R4-H14-RELATIVE-STRENGTH",
    hypothesisId: "H14_RELATIVE_STRENGTH_CONTEXT",
    mechanismFamily: "CROSS_ASSET_CONTEXT",
    complexity: M3_R4_ROUND_004_COMPLEXITY_TUPLES["R4-H14-RELATIVE-STRENGTH"],
    population: "EXACT_BASELINE_001_FORMAL_SIGNAL",
    preservedBaselineBehavior: "entry/stop/TP/settlement/economics unchanged; only context eligibility changes",
    momentum: {
      formula: "close(symbol,t) / close(symbol,t-24 closed 1H bars) - 1",
      intervals: 24,
      symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"],
      ranking: "all five descending; ties use BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT",
      longEligibility: "rank <= 2",
      shortEligibility: "rank >= 4",
      rank3: "BLOCKED",
      missingData: "FAIL_CLOSED_DATA_INCOMPLETE",
      timestampContract: "current.closeTime === signalTime AND historical.closeTime === current.closeTime - 24H; both candles must be decision-time legal",
    },
    outcomeReuse: "reuse same-run CONTROL BacktestSignalResult by exact symbol|direction|signalTime identity; missing is DATA_INCOMPLETE",
    auditFields: ["signalTime", "symbol", "direction", "fiveSymbolMomentum24hMap", "rankMap", "candidateRank"],
  },
] as const);

export const M3_R4_ROUND_004_PLAN = deepFreeze({
  schemaVersion: M3_R4_ROUND_004_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  sourceSha: M3_R4_ROUND_004_SOURCE_SHA,
  dataClassification: M3_R4_ROUND_004_DATA_CLASSIFICATION,
  researchUniverse: {
    startTime: Date.parse("2023-01-01T00:00:00.000Z"),
    endTime: Date.parse("2026-08-15T23:59:59.999Z"),
    rule: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
  r4AProvenance: {
    diagnosisPath: "docs/BASELINE_002_DIAGNOSIS_R4.md",
    diagnosisRawSha256: M3_R4_ROUND_004_R4A_DIAGNOSIS_RAW_SHA256,
    protocolPath: "docs/BASELINE_002_RESEARCH_R4.md",
    protocolRawSha256: M3_R4_ROUND_004_R4A_PROTOCOL_RAW_SHA256,
  },
  inheritedRound003SelectionGateSha256: M3_R4_ROUND_004_INHERITED_SELECTION_GATE_SHA256,
  selectionGateSha256: BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
  performanceStatus: "NOT_GENERATED",
  performanceAuthorization: "NONE_IN_M3_R4_B",
  performanceLock: M3_R4_ROUND_004_PERFORMANCE_LOCK,
  control: {
    candidateId: M3_R4_ROUND_004_CONTROL_ID,
    strategyVersion: M3_R4_ROUND_004_STRATEGY_VERSION,
    backtestPolicyVersion: M3_R4_ROUND_004_POLICY_VERSION,
    reportSchemaVersion: M3_R4_ROUND_004_CONTROL_REPORT_SCHEMA_VERSION,
    formalSignalPredicate: "candidate.formalSignal === true AND candidate.totalScore >= 70",
    signalCandle: "current fully closed 1H signal candle",
    entry: "next 1H open",
    settlement: "existing bt-policy-003 stop/2R TP/24 held/fee/slippage/funding/SL-first semantics",
  },
  candidateCount: 4,
  candidateIds: M3_R4_ROUND_004_CANDIDATE_IDS,
  mechanismIds: M3_R4_ROUND_004_MECHANISM_IDS,
  candidateDefinitions: M3_R4_ROUND_004_CANDIDATE_DEFINITIONS,
  complexityDimensions: ["newRules", "newTunableThresholds", "modifiedBaselineRules", "mechanismFamiliesUsed"],
  complexityTuples: M3_R4_ROUND_004_COMPLEXITY_TUPLES,
  audit: {
    identity: "symbol|direction|signalTime",
    identityOrdering: ["signalTime ascending", "frozen symbol order", "LONG before SHORT"],
    symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"],
    decisionTimeOnly: true,
    noFutureOutcomeFieldsInH11H12H14: true,
    h12TimestampContract: "current.closeTime === signalTime; previous.closeTime === current.closeTime - 1H",
    h14TimestampContract: "current.closeTime === signalTime; historical.closeTime === current.closeTime - 24H",
  },
  dataRequirements: {
    signalTimeframe: "1h",
    trendTimeframe: "4h",
    indicators: ["EMA20", "EMA50", "EMA200", "RSI14_WILDER", "ATR14"],
    h11OriginHistory: "enough closed history for origin ages 1..4",
    h13History: "up to 48 held closed 1H candles plus bt-policy-003 funding/mark/intrabar data",
  },
  folds: RESEARCH_FOLDS,
  aggregateValidation: {
    foldIds: ["F1", "F2", "F3", "F4", "F5", "F6"],
    role: "VALIDATION",
    construction: "CONCATENATE_NON_OVERLAPPING_VALIDATION_SEGMENTS_BY_SIGNAL_TIME",
    diagnostics: "F1-F6 VALIDATION",
  },
  gateSemantics: BASELINE_002_RESEARCH_ROUND_004_MACHINE_RECORD.selectionGates,
  selectionGateDefinitions: BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS,
  noFutureData: {
    decisionCandleRequirement: "candidate formation may use only candles with closeTime <= signalTime",
    forbiddenInDecisionPredicate: [
      "next-open candle",
      "held candles",
      "future funding",
      "future EMA",
      "returns",
      "regime derived after signalTime",
      "H12 previous candle other than exact t-1",
      "H14 historical candle other than exact t-24",
    ],
    settlementSeparate: true,
  },
  noCombinations: true,
  noTuning: true,
  noCandidateOutcome: M3_R4_ROUND_004_NO_CANDIDATE_OUTCOME,
  status: {
    round004Performance: "NOT_AUTHORIZED",
    baseline002: "NOT_FROZEN",
    m3J: "BLOCKED",
    m4: "NOT_STARTED",
  },
});

export const M3_R4_ROUND_004_PLAN_CANONICAL_JSON = stableStringify(M3_R4_ROUND_004_PLAN);

// This value is the SHA-256 of M3_R4_ROUND_004_PLAN_CANONICAL_JSON.
export const M3_R4_ROUND_004_PLAN_SHA256 =
  "f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981" as const;

export function validateM3R4Round004Plan(
  plan: typeof M3_R4_ROUND_004_PLAN = M3_R4_ROUND_004_PLAN,
): typeof M3_R4_ROUND_004_PLAN {
  if (plan.schemaVersion !== M3_R4_ROUND_004_PLAN_SCHEMA_VERSION) throw new Error("M3-R4-B plan schema mismatch.");
  if (plan.researchRoundId !== M3_R4_ROUND_004_RESEARCH_ROUND_ID || plan.sourceSha !== M3_R4_ROUND_004_SOURCE_SHA) {
    throw new Error("M3-R4-B plan provenance mismatch.");
  }
  if (plan.performanceStatus !== "NOT_GENERATED" || plan.performanceAuthorization !== "NONE_IN_M3_R4_B") {
    throw new Error("M3-R4-B plan must remain pre-performance.");
  }
  if (plan.candidateCount !== 4 || stableStringify(plan.candidateIds) !== stableStringify(M3_R4_ROUND_004_CANDIDATE_IDS)) {
    throw new Error("M3-R4-B candidate registry changed.");
  }
  if (stableStringify(plan.mechanismIds) !== stableStringify(M3_R4_ROUND_004_MECHANISM_IDS)) {
    throw new Error("M3-R4-B mechanism registry changed.");
  }
  if (plan.control.candidateId !== M3_R4_ROUND_004_CONTROL_ID) throw new Error("M3-R4-B CONTROL identity changed.");
  if (plan.control.strategyVersion !== M3_R4_ROUND_004_STRATEGY_VERSION) throw new Error("M3-R4-B strategy version changed.");
  if (plan.control.backtestPolicyVersion !== M3_R4_ROUND_004_POLICY_VERSION) throw new Error("M3-R4-B policy version changed.");
  if (plan.selectionGateSha256 !== BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256) {
    throw new Error("M3-R4-B plan gate SHA mismatch.");
  }
  if (plan.r4AProvenance.diagnosisRawSha256 !== M3_R4_ROUND_004_R4A_DIAGNOSIS_RAW_SHA256 || plan.r4AProvenance.protocolRawSha256 !== M3_R4_ROUND_004_R4A_PROTOCOL_RAW_SHA256) {
    throw new Error("M3-R4-B R4-A provenance mismatch.");
  }
  if (!plan.noCombinations || !plan.noTuning || !plan.noFutureData.settlementSeparate) {
    throw new Error("M3-R4-B plan governance boundary changed.");
  }
  if (createHash("sha256").update(stableStringify(plan), "utf8").digest("hex") !== M3_R4_ROUND_004_PLAN_SHA256) {
    throw new Error("M3-R4-B plan canonical SHA mismatch.");
  }
  return plan;
}
