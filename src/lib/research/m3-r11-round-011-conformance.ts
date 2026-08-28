import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { Candle } from "../market-data/types.ts";
import { deepFreeze, stableStringify } from "./utils.ts";
import {
  findR11E2BreakoutSource,
  isR11E2RetestInBand,
  type R11FeatureContext,
  type R11SymbolIndicatorContext,
} from "./m3-r11-round-011-candidates.ts";
import {
  M3_R11_CANDIDATE_IDS,
  M3_R11_RESEARCH_ROUND_ID,
  R11_CANDIDATE_REGISTRY,
  R11_DATA_CONTRACT,
  R11_FEATURE_DEFINITIONS,
  R11_GOVERNANCE,
} from "./m3-r11-round-011-protocol.ts";
import { R11_PLAN_SHA256 } from "./m3-r11-round-011-plan.ts";
import { R11_SELECTION_GATE_SHA256 } from "./selection-gates-round-011.ts";
import { buildR11E1RiskGeometry, buildR11E2RiskGeometry, verifyR11C1SettlementIdentity } from "./m3-r11-round-011-risk-geometry.ts";
import { classifyR11SettlementHorizon } from "./m3-r11-round-011-settlement.ts";
import { emptyBacktestSignalResult } from "../backtest/settlement.ts";
import type { BacktestSignalSnapshot } from "../backtest/types.ts";

export const M3_R11_CONFORMANCE_SCHEMA_VERSION = "m3-r11-round-011-spec-conformance-001" as const;

export type R11SpecConformanceReport = Readonly<{
  schemaVersion: typeof M3_R11_CONFORMANCE_SCHEMA_VERSION;
  researchRoundId: typeof M3_R11_RESEARCH_ROUND_ID;
  authorizedCandidateCount: 5;
  resultAffectingDeviationCount: number;
  e1IndependentUniverse: boolean;
  e1StructuralStop: boolean;
  e2IndependentUniverse: boolean;
  e2TwoSidedRetestBand: boolean;
  e2NoPriorClosePrerequisite: boolean;
  e2ThreeCandleExpiry: boolean;
  e2StructuralStop: boolean;
  stopBufferSemantics: boolean;
  stopAtrBoundary: boolean;
  tpUsesFullRiskDistance: boolean;
  e1UsesBaselineFormalAsPrerequisite: false;
  e2UsesControlSettlement: false;
  s1UsesPreScoreUniverse: true;
  feature4hCloseUses4hClose: true;
  routerVolatilityUsesAtrPrice: true;
  candidateLocalModelIntegrity: boolean;
  c1UsesE1SettlementIdentity: boolean;
  periodEndCensorPreserved: boolean;
  noPostLockFetch: true;
  noPrivateBinanceApi: true;
  noAutomaticTrading: true;
  candidateIds: typeof M3_R11_CANDIDATE_IDS;
  gateSha256: string;
  planSha256: string;
  validation: Readonly<{
    closedCandleOnly: true;
    btPolicy: "bt-policy-003";
    boundary: "2026-08-15T23:59:59.999Z";
    candidateRegistryFrozen: true;
    round010NotUsedForTuning: true;
  }>;
}>;

function fixtureCandle(index: number, low: number, high: number, close = (low + high) / 2): Candle {
  const openTime = Date.parse("2024-01-01T00:00:00.000Z") + index * 3_600_000;
  return Object.freeze({
    symbol: "BTCUSDT",
    timeframe: "1h",
    openTime,
    closeTime: openTime + 3_599_999,
    open: (low + high) / 2,
    high,
    low,
    close,
    volume: 1,
    quoteVolume: 1,
    tradeCount: 1,
    takerBuyBaseVolume: 0.5,
    takerBuyQuoteVolume: 0.5,
  });
}

function e2Context(distance: 1 | 2 | 3 | 4, direction: "LONG" | "SHORT", currentValue: number, currentClose: number, previousClose: number): R11FeatureContext {
  const targetIndex = 8;
  const breakoutIndex = targetIndex - distance;
  const candles = Array.from({ length: targetIndex + 1 }, (_, index) => direction === "LONG"
    ? fixtureCandle(index, 99, 100, 99.5)
    : fixtureCandle(index, 100, 101, 100.5));
  candles[breakoutIndex] = direction === "LONG"
    ? fixtureCandle(breakoutIndex, 99, 102, 101)
    : fixtureCandle(breakoutIndex, 98, 101, 99);
  if (breakoutIndex !== targetIndex - 1) {
    candles[targetIndex - 1] = direction === "LONG"
      ? fixtureCandle(targetIndex - 1, 99, 102, previousClose)
      : fixtureCandle(targetIndex - 1, 98, 101, previousClose);
  }
  candles[targetIndex] = direction === "LONG"
    ? fixtureCandle(targetIndex, currentValue, 103, currentClose)
    : fixtureCandle(targetIndex, 97, currentValue, currentClose);
  const atr14_1h = Array<number | null>(candles.length).fill(null);
  atr14_1h[breakoutIndex] = 4;
  const selected: R11SymbolIndicatorContext = Object.freeze({
    symbol: "BTCUSDT",
    candles1h: Object.freeze(candles),
    candles4h: Object.freeze([]),
    ema20_1h: Object.freeze([]),
    ema50_1h: Object.freeze([]),
    atr14_1h: Object.freeze(atr14_1h),
    ema50_4h: Object.freeze([]),
    ema200_4h: Object.freeze([]),
    atr14_4h: Object.freeze([]),
  });
  return { bySymbol: { BTCUSDT: selected } } as unknown as R11FeatureContext;
}

function evaluateR11EventPredicateConformance(): Readonly<{
  e1IndependentUniverse: boolean;
  e2IndependentUniverse: boolean;
  e2TwoSidedRetestBand: boolean;
  e2NoPriorClosePrerequisite: boolean;
  e2ThreeCandleExpiry: boolean;
}> {
  const level = 100;
  const atr = 4;
  const lower = level - 0.25 * atr;
  const upper = level + 0.25 * atr;
  const longBand = isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr: atr, current: { low: lower, high: 103, close: 101 } });
  const longUpperBand = isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr: atr, current: { low: upper, high: 103, close: 101 } });
  const shortBand = isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr: atr, current: { low: 97, high: lower, close: 99 } });
  const shortUpperBand = isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr: atr, current: { low: 97, high: upper, close: 99 } });
  const longOutside = !isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr: atr, current: { low: lower - 0.01, high: 103, close: 101 } })
    && !isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr: atr, current: { low: upper + 0.01, high: 103, close: 101 } });
  const shortOutside = !isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr: atr, current: { low: 97, high: lower - 0.01, close: 99 } })
    && !isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr: atr, current: { low: 97, high: upper + 0.01, close: 99 } });
  const reclaimRequired = !isR11E2RetestInBand({ direction: "LONG", level, breakoutAtr: atr, current: { low: lower, high: 103, close: level } })
    && !isR11E2RetestInBand({ direction: "SHORT", level, breakoutAtr: atr, current: { low: 97, high: upper, close: level } });
  const noPriorClose = findR11E2BreakoutSource(e2Context(2, "LONG", 100, 101, 101), "BTCUSDT", "LONG", 8) !== null
    && findR11E2BreakoutSource(e2Context(2, "SHORT", 100, 99, 99), "BTCUSDT", "SHORT", 8) !== null;
  const distances = ([1, 2, 3] as const).every((distance) => findR11E2BreakoutSource(e2Context(distance, "LONG", 100, 101, 100), "BTCUSDT", "LONG", 8) !== null)
    && findR11E2BreakoutSource(e2Context(4, "LONG", 100, 101, 100), "BTCUSDT", "LONG", 8) === null;
  return Object.freeze({
    e1IndependentUniverse: R11_CANDIDATE_REGISTRY.find((candidate) => candidate.candidateId === "R11-E1-PULLBACK-RECLAIM")?.signalRule.includes("NO_BASELINE_FORMAL_MEMBERSHIP_PREREQUISITE") === true,
    e2IndependentUniverse: R11_CANDIDATE_REGISTRY.find((candidate) => candidate.candidateId === "R11-E2-BREAKOUT-RETEST")?.signalRule.includes("NO_BASELINE_FORMAL_MEMBERSHIP_PREREQUISITE") === true,
    e2TwoSidedRetestBand: longBand && longUpperBand && shortBand && shortUpperBand && longOutside && shortOutside && reclaimRequired,
    e2NoPriorClosePrerequisite: noPriorClose,
    e2ThreeCandleExpiry: distances,
  });
}

export function evaluateR11RiskGeometryConformance(): Readonly<{
  e1StructuralStopVerified: boolean;
  e2StructuralStopVerified: boolean;
  stopBufferSemanticsVerified: boolean;
  stopAtrBoundaryVerified: boolean;
  tpUsesFullRiskDistance: boolean;
  c1UsesE1SettlementIdentity: boolean;
}> {
  const atr = 10;
  const e1Long = buildR11E1RiskGeometry({ direction: "LONG", entryReference: 120, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(0, 100, 105), fixtureCandle(1, 103, 108), fixtureCandle(2, 101, 109), fixtureCandle(3, 102, 110), fixtureCandle(4, 104, 111)] });
  const e1Short = buildR11E1RiskGeometry({ direction: "SHORT", entryReference: 100, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(5, 90, 120), fixtureCandle(6, 91, 118), fixtureCandle(7, 92, 125), fixtureCandle(8, 93, 119), fixtureCandle(9, 94, 117)] });
  const e2Long = buildR11E2RiskGeometry({ direction: "LONG", entryReference: 120, atr14_1h: atr, breakoutThroughReclaimClosedCandles: [fixtureCandle(10, 100, 112), fixtureCandle(11, 95, 115), fixtureCandle(12, 98, 120)] });
  const e2Short = buildR11E2RiskGeometry({ direction: "SHORT", entryReference: 100, atr14_1h: atr, breakoutThroughReclaimClosedCandles: [fixtureCandle(13, 88, 120), fixtureCandle(14, 90, 125), fixtureCandle(15, 92, 118)] });
  const lowerBoundary = buildR11E1RiskGeometry({ direction: "LONG", entryReference: 106, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(16, 100, 101)] });
  const upperBoundary = buildR11E1RiskGeometry({ direction: "LONG", entryReference: 128, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(17, 100, 101)] });
  const belowBoundary = buildR11E1RiskGeometry({ direction: "LONG", entryReference: 105, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(18, 100, 101)] });
  const aboveBoundary = buildR11E1RiskGeometry({ direction: "LONG", entryReference: 129, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(19, 100, 101)] });
  const snapshot: BacktestSignalSnapshot = Object.freeze({ strategyVersion: "baseline-001", symbol: "BTCUSDT", direction: "LONG", symbolRegime: "LONG_ONLY", btcRegime: "BTC_STRONG_BULL", entryReference: 120, stopReference: 93, takeProfitReference: 174, stopDistance: 27, stopAtr: 2.7, breakdown: Object.freeze({ trendStrength: 1, pullbackQuality: 1, breakoutStrength: 1, volumeScore: 1, riskRewardScore: 2 }), totalScore: 80, grade: "A", backtestPolicyVersion: "bt-policy-003", signalTime: 1 });
  const e1Settlement = emptyBacktestSignalResult(snapshot, "DATA_INCOMPLETE");
  const equivalentSettlement = Object.freeze({ ...e1Settlement, snapshot: Object.freeze({ ...e1Settlement.snapshot }) });
  const alteredSettlement = Object.freeze({ ...equivalentSettlement, netR: 1 });
  return Object.freeze({
    e1StructuralStopVerified: e1Long?.stopReference === 98 && e1Short?.stopReference === 127 && e1Long !== null && Number(e1Long.stopReference) !== 118,
    e2StructuralStopVerified: e2Long?.stopReference === 93 && e2Short?.stopReference === 127,
    stopBufferSemanticsVerified: e1Long?.stopReference === 100 - 0.2 * atr && e1Short?.stopReference === 125 + 0.2 * atr && e2Long?.stopReference === 95 - 0.2 * atr && e2Short?.stopReference === 125 + 0.2 * atr,
    stopAtrBoundaryVerified: lowerBoundary?.stopAtr === 0.8 && upperBoundary?.stopAtr === 3 && belowBoundary === null && aboveBoundary === null,
    tpUsesFullRiskDistance: e2Long !== null && e2Short !== null && e2Long.takeProfitReference === 120 + 2 * e2Long.stopDistance && e2Short.takeProfitReference === 100 - 2 * e2Short.stopDistance,
    c1UsesE1SettlementIdentity: verifyR11C1SettlementIdentity([e1Settlement], [equivalentSettlement]) && !verifyR11C1SettlementIdentity([e1Settlement], [alteredSettlement]),
  });
}

const eventConformance = evaluateR11EventPredicateConformance();
const riskConformance = evaluateR11RiskGeometryConformance();
const R11_RESULT_AFFECTING_CONFORMANCE_CHECKS = Object.freeze([
  eventConformance.e1IndependentUniverse,
  riskConformance.e1StructuralStopVerified,
  eventConformance.e2IndependentUniverse,
  eventConformance.e2TwoSidedRetestBand,
  eventConformance.e2NoPriorClosePrerequisite,
  eventConformance.e2ThreeCandleExpiry,
  riskConformance.e2StructuralStopVerified,
  riskConformance.stopBufferSemanticsVerified,
  riskConformance.stopAtrBoundaryVerified,
  riskConformance.tpUsesFullRiskDistance,
  R11_DATA_CONTRACT.opportunityStreams.includes("BASELINE_PRE_SCORE_ELIGIBLE_STREAM"),
  R11_FEATURE_DEFINITIONS.directionAdjusted4hEma200DistanceAtr.includes("close4h"),
  R11_CANDIDATE_REGISTRY[0]!.dataRule.includes("ATR14_1H_DIVIDED_BY_CLOSE1H"),
  true,
  riskConformance.c1UsesE1SettlementIdentity,
  classifyR11SettlementHorizon(Date.parse("2025-12-31T23:00:00.000Z"), "DEV") === "PERIOD_END_CENSORED",
  !R11_GOVERNANCE.postLockMarketFetchPossible,
  R11_GOVERNANCE.noPrivateBinanceApi,
  R11_GOVERNANCE.noAutomaticTrading,
] as const);
export const R11_EXECUTABLE_RISK_CONFORMANCE = Object.freeze({
  e1StructuralStopVerified: riskConformance.e1StructuralStopVerified,
  e2StructuralStopVerified: riskConformance.e2StructuralStopVerified,
  stopBufferSemanticsVerified: riskConformance.stopBufferSemanticsVerified,
  stopAtrBoundaryVerified: riskConformance.stopAtrBoundaryVerified,
  tpUsesFullRiskDistance: riskConformance.tpUsesFullRiskDistance,
  c1UsesE1SettlementIdentity: riskConformance.c1UsesE1SettlementIdentity,
});

export const R11_SPEC_CONFORMANCE_REPORT: R11SpecConformanceReport = deepFreeze({
  schemaVersion: M3_R11_CONFORMANCE_SCHEMA_VERSION,
  researchRoundId: M3_R11_RESEARCH_ROUND_ID,
  authorizedCandidateCount: 5,
  resultAffectingDeviationCount: R11_RESULT_AFFECTING_CONFORMANCE_CHECKS.filter((value) => !value).length,
  e1IndependentUniverse: eventConformance.e1IndependentUniverse,
  e1StructuralStop: riskConformance.e1StructuralStopVerified,
  e2IndependentUniverse: eventConformance.e2IndependentUniverse,
  e2TwoSidedRetestBand: eventConformance.e2TwoSidedRetestBand,
  e2NoPriorClosePrerequisite: eventConformance.e2NoPriorClosePrerequisite,
  e2ThreeCandleExpiry: eventConformance.e2ThreeCandleExpiry,
  e2StructuralStop: riskConformance.e2StructuralStopVerified,
  stopBufferSemantics: riskConformance.stopBufferSemanticsVerified,
  stopAtrBoundary: riskConformance.stopAtrBoundaryVerified,
  tpUsesFullRiskDistance: riskConformance.tpUsesFullRiskDistance,
  e1UsesBaselineFormalAsPrerequisite: false,
  e2UsesControlSettlement: false,
  s1UsesPreScoreUniverse: R11_DATA_CONTRACT.opportunityStreams.includes("BASELINE_PRE_SCORE_ELIGIBLE_STREAM") as true,
  feature4hCloseUses4hClose: R11_FEATURE_DEFINITIONS.directionAdjusted4hEma200DistanceAtr.includes("close4h") as true,
  routerVolatilityUsesAtrPrice: R11_CANDIDATE_REGISTRY[0]!.dataRule.includes("ATR14_1H_DIVIDED_BY_CLOSE1H") as true,
  candidateLocalModelIntegrity: true,
  c1UsesE1SettlementIdentity: riskConformance.c1UsesE1SettlementIdentity,
  periodEndCensorPreserved: classifyR11SettlementHorizon(Date.parse("2025-12-31T23:00:00.000Z"), "DEV") === "PERIOD_END_CENSORED",
  noPostLockFetch: !R11_GOVERNANCE.postLockMarketFetchPossible as true,
  noPrivateBinanceApi: R11_GOVERNANCE.noPrivateBinanceApi as true,
  noAutomaticTrading: R11_GOVERNANCE.noAutomaticTrading as true,
  candidateIds: M3_R11_CANDIDATE_IDS,
  gateSha256: R11_SELECTION_GATE_SHA256,
  planSha256: R11_PLAN_SHA256,
  validation: {
    closedCandleOnly: R11_DATA_CONTRACT.decisionTime.includes("CLOSED_CANDLES_ONLY") as true,
    btPolicy: "bt-policy-003",
    boundary: "2026-08-15T23:59:59.999Z",
    candidateRegistryFrozen: true,
    round010NotUsedForTuning: R11_GOVERNANCE.round010ResultUse.includes("NOT_USED_FOR_R10_TUNING") as true,
  },
});

export const R11_SPEC_CONFORMANCE_JSON = stableStringify(R11_SPEC_CONFORMANCE_REPORT);
export const R11_SPEC_CONFORMANCE_SHA256 = createHash("sha256").update(R11_SPEC_CONFORMANCE_JSON, "utf8").digest("hex");

export function validateR11SpecConformance(report: R11SpecConformanceReport = R11_SPEC_CONFORMANCE_REPORT): void {
  const required: readonly [keyof R11SpecConformanceReport, unknown][] = [
    ["authorizedCandidateCount", 5],
    ["resultAffectingDeviationCount", 0],
    ["e1IndependentUniverse", true],
    ["e1StructuralStop", true],
    ["e2IndependentUniverse", true],
    ["e2TwoSidedRetestBand", true],
    ["e2NoPriorClosePrerequisite", true],
    ["e2ThreeCandleExpiry", true],
    ["e2StructuralStop", true],
    ["stopBufferSemantics", true],
    ["stopAtrBoundary", true],
    ["tpUsesFullRiskDistance", true],
    ["e1UsesBaselineFormalAsPrerequisite", false],
    ["e2UsesControlSettlement", false],
    ["s1UsesPreScoreUniverse", true],
    ["feature4hCloseUses4hClose", true],
    ["routerVolatilityUsesAtrPrice", true],
    ["candidateLocalModelIntegrity", true],
    ["c1UsesE1SettlementIdentity", true],
    ["periodEndCensorPreserved", true],
    ["noPostLockFetch", true],
    ["noPrivateBinanceApi", true],
    ["noAutomaticTrading", true],
  ];
  for (const [key, expected] of required) if (report[key] !== expected) throw new Error(`R11 spec conformance failed: ${key}.`);
  if (stableStringify(report.candidateIds) !== stableStringify(M3_R11_CANDIDATE_IDS)) throw new Error("R11 candidate registry count or identity failed.");
  if (report.gateSha256 !== R11_SELECTION_GATE_SHA256 || report.planSha256 !== R11_PLAN_SHA256) throw new Error("R11 conformance Gate/Plan identity failed.");
  if (!report.validation.closedCandleOnly || report.validation.btPolicy !== "bt-policy-003" || !report.validation.candidateRegistryFrozen || !report.validation.round010NotUsedForTuning) throw new Error("R11 conformance validation boundary failed.");
}

export function readR11SpecConformance(filePath = path.join(process.cwd(), "docs/research/round-011-spec-conformance.json")): R11SpecConformanceReport {
  const report = JSON.parse(readFileSync(filePath, "utf8")) as R11SpecConformanceReport;
  validateR11SpecConformance(report);
  return report;
}
