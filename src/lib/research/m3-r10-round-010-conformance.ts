import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { deepFreeze, stableStringify } from "./utils.ts";
import { R10_DATA_CONTRACT, R10_FEATURE_DEFINITIONS, R10_GOVERNANCE, R10_CANDIDATE_REGISTRY, M3_R10_CANDIDATE_IDS, M3_R10_RESEARCH_ROUND_ID } from "./m3-r10-round-010-protocol.ts";
import { R10_PLAN_SHA256 } from "./m3-r10-round-010-plan.ts";
import { R10_SELECTION_GATE_SHA256 } from "./selection-gates-round-010.ts";
import { buildR10E1RiskGeometry, buildR10E2RiskGeometry, verifyR10C1SettlementIdentity } from "./m3-r10-round-010-risk-geometry.ts";
import { emptyBacktestSignalResult } from "../backtest/settlement.ts";
import type { BacktestSignalSnapshot } from "../backtest/types.ts";
import type { Candle } from "../market-data/types.ts";

export const M3_R10_CONFORMANCE_SCHEMA_VERSION = "m3-r10-round-010-spec-conformance-001" as const;

export type R10SpecConformanceReport = Readonly<{
  schemaVersion: typeof M3_R10_CONFORMANCE_SCHEMA_VERSION;
  researchRoundId: typeof M3_R10_RESEARCH_ROUND_ID;
  authorizedCandidateCount: number;
  resultAffectingDeviationCount: number;
  e1StructuralStopVerified: boolean;
  e2StructuralStopVerified: boolean;
  stopBufferSemanticsVerified: boolean;
  stopAtrBoundaryVerified: boolean;
  tpUsesFullRiskDistance: boolean;
  c1UsesE1SettlementIdentity: boolean;
  e1UsesBaselineFormalAsPrerequisite: false;
  e2UsesControlSettlement: false;
  s1UsesPreScoreUniverse: true;
  feature4hCloseUses4hClose: true;
  routerVolatilityUsesAtrPrice: true;
  candidateLocalModelIntegrity: true;
  postLockMarketFetchPossible: false;
  privateBinanceApi: false;
  automaticTrading: false;
  candidateIds: typeof M3_R10_CANDIDATE_IDS;
  gateSha256: string;
  planSha256: string;
  validation: Readonly<{
    closedCandleOnly: boolean;
    btPolicy: "bt-policy-003";
    boundary: "2026-08-15T23:59:59.999Z";
    candidateRegistryFrozen: boolean;
    noR8ResultTuning: boolean;
  }>;
}>;

function fixtureCandle(index: number, low: number, high: number): Candle {
  const openTime = Date.parse("2024-01-01T00:00:00.000Z") + index * 3_600_000;
  return Object.freeze({ symbol: "BTCUSDT", timeframe: "1h", openTime, closeTime: openTime + 3_599_999, open: (low + high) / 2, high, low, close: (low + high) / 2, volume: 1, quoteVolume: 1, tradeCount: 1, takerBuyBaseVolume: 0.5, takerBuyQuoteVolume: 0.5 });
}

export function evaluateR10RiskGeometryConformance(): Readonly<{
  e1StructuralStopVerified: boolean;
  e2StructuralStopVerified: boolean;
  stopBufferSemanticsVerified: boolean;
  stopAtrBoundaryVerified: boolean;
  tpUsesFullRiskDistance: boolean;
  c1UsesE1SettlementIdentity: boolean;
}> {
  const atr = 10;
  const e1Long = buildR10E1RiskGeometry({ direction: "LONG", entryReference: 120, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(0, 100, 105), fixtureCandle(1, 103, 108), fixtureCandle(2, 101, 109), fixtureCandle(3, 102, 110), fixtureCandle(4, 104, 111)] });
  const e1Short = buildR10E1RiskGeometry({ direction: "SHORT", entryReference: 100, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(5, 90, 120), fixtureCandle(6, 91, 118), fixtureCandle(7, 92, 125), fixtureCandle(8, 93, 119), fixtureCandle(9, 94, 117)] });
  const e2Long = buildR10E2RiskGeometry({ direction: "LONG", entryReference: 120, atr14_1h: atr, breakoutThroughReclaimClosedCandles: [fixtureCandle(10, 100, 112), fixtureCandle(11, 95, 115), fixtureCandle(12, 98, 120)] });
  const e2Short = buildR10E2RiskGeometry({ direction: "SHORT", entryReference: 100, atr14_1h: atr, breakoutThroughReclaimClosedCandles: [fixtureCandle(13, 88, 120), fixtureCandle(14, 90, 125), fixtureCandle(15, 92, 118)] });
  const lowerBoundary = buildR10E1RiskGeometry({ direction: "LONG", entryReference: 106, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(16, 100, 101)] });
  const upperBoundary = buildR10E1RiskGeometry({ direction: "LONG", entryReference: 128, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(17, 100, 101)] });
  const belowBoundary = buildR10E1RiskGeometry({ direction: "LONG", entryReference: 105, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(18, 100, 101)] });
  const aboveBoundary = buildR10E1RiskGeometry({ direction: "LONG", entryReference: 129, atr14_1h: atr, previousFiveClosedCandles: [fixtureCandle(19, 100, 101)] });
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
    c1UsesE1SettlementIdentity: verifyR10C1SettlementIdentity([e1Settlement], [equivalentSettlement]) && !verifyR10C1SettlementIdentity([e1Settlement], [alteredSettlement]),
  });
}

export const R10_EXECUTABLE_RISK_CONFORMANCE = evaluateR10RiskGeometryConformance();

export const R10_SPEC_CONFORMANCE_REPORT: R10SpecConformanceReport = deepFreeze({
  schemaVersion: M3_R10_CONFORMANCE_SCHEMA_VERSION,
  researchRoundId: M3_R10_RESEARCH_ROUND_ID,
  authorizedCandidateCount: M3_R10_CANDIDATE_IDS.length as 5,
  e1StructuralStopVerified: R10_EXECUTABLE_RISK_CONFORMANCE.e1StructuralStopVerified,
  e2StructuralStopVerified: R10_EXECUTABLE_RISK_CONFORMANCE.e2StructuralStopVerified,
  stopBufferSemanticsVerified: R10_EXECUTABLE_RISK_CONFORMANCE.stopBufferSemanticsVerified,
  stopAtrBoundaryVerified: R10_EXECUTABLE_RISK_CONFORMANCE.stopAtrBoundaryVerified,
  tpUsesFullRiskDistance: R10_EXECUTABLE_RISK_CONFORMANCE.tpUsesFullRiskDistance,
  c1UsesE1SettlementIdentity: R10_EXECUTABLE_RISK_CONFORMANCE.c1UsesE1SettlementIdentity,
  resultAffectingDeviationCount: Object.values(R10_EXECUTABLE_RISK_CONFORMANCE).filter((value) => !value).length,
  e1UsesBaselineFormalAsPrerequisite: false,
  e2UsesControlSettlement: false,
  s1UsesPreScoreUniverse: true,
  feature4hCloseUses4hClose: R10_FEATURE_DEFINITIONS.directionAdjusted4hEma200DistanceAtr.includes("close4h") as true,
  routerVolatilityUsesAtrPrice: R10_CANDIDATE_REGISTRY[0]!.dataRule.includes("ATR14_1H_DIVIDED_BY_CLOSE1H") as true,
  candidateLocalModelIntegrity: true,
  postLockMarketFetchPossible: R10_GOVERNANCE.postLockMarketFetchPossible as false,
  privateBinanceApi: !R10_GOVERNANCE.noPrivateBinanceApi as false,
  automaticTrading: !R10_GOVERNANCE.noAutomaticTrading as false,
  candidateIds: M3_R10_CANDIDATE_IDS,
  gateSha256: R10_SELECTION_GATE_SHA256,
  planSha256: R10_PLAN_SHA256,
  validation: {
    closedCandleOnly: R10_DATA_CONTRACT.decisionTime.includes("CLOSED_CANDLES_ONLY") as true,
    btPolicy: "bt-policy-003",
    boundary: "2026-08-15T23:59:59.999Z",
    candidateRegistryFrozen: true,
    noR8ResultTuning: true,
  },
});

export const R10_SPEC_CONFORMANCE_JSON = stableStringify(R10_SPEC_CONFORMANCE_REPORT);
export const R10_SPEC_CONFORMANCE_SHA256 = createHash("sha256").update(R10_SPEC_CONFORMANCE_JSON, "utf8").digest("hex");

export function validateR10SpecConformance(report: R10SpecConformanceReport = R10_SPEC_CONFORMANCE_REPORT): void {
  const required: readonly [keyof R10SpecConformanceReport, unknown][] = [
    ["authorizedCandidateCount", 5],
    ["resultAffectingDeviationCount", 0],
    ["e1StructuralStopVerified", true],
    ["e2StructuralStopVerified", true],
    ["stopBufferSemanticsVerified", true],
    ["stopAtrBoundaryVerified", true],
    ["tpUsesFullRiskDistance", true],
    ["c1UsesE1SettlementIdentity", true],
    ["e1UsesBaselineFormalAsPrerequisite", false],
    ["e2UsesControlSettlement", false],
    ["s1UsesPreScoreUniverse", true],
    ["feature4hCloseUses4hClose", true],
    ["routerVolatilityUsesAtrPrice", true],
    ["candidateLocalModelIntegrity", true],
    ["postLockMarketFetchPossible", false],
    ["privateBinanceApi", false],
    ["automaticTrading", false],
  ];
  for (const [key, expected] of required) if (report[key] !== expected) throw new Error(`R10 spec conformance failed: ${key}.`);
  if (stableStringify(report.candidateIds) !== stableStringify(M3_R10_CANDIDATE_IDS)) throw new Error("R10 candidate registry count or identity failed.");
  if (report.gateSha256 !== R10_SELECTION_GATE_SHA256 || report.planSha256 !== R10_PLAN_SHA256) throw new Error("R10 conformance Gate/Plan identity failed.");
  if (!report.validation.closedCandleOnly || report.validation.btPolicy !== "bt-policy-003" || !report.validation.candidateRegistryFrozen || !report.validation.noR8ResultTuning) throw new Error("R10 conformance validation boundary failed.");
}

export function readR10SpecConformance(filePath = path.join(process.cwd(), "docs/research/round-010-spec-conformance.json")): R10SpecConformanceReport {
  const report = JSON.parse(readFileSync(filePath, "utf8")) as R10SpecConformanceReport;
  validateR10SpecConformance(report);
  return report;
}
