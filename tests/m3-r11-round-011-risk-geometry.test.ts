import { describe, expect, it } from "vitest";

import type { Candle } from "../src/lib/market-data/types.ts";
import { buildR10E1RiskGeometry, buildR10E2RiskGeometry } from "../src/lib/research/m3-r10-round-010-risk-geometry.ts";
import { buildR11E1RiskGeometry, buildR11E2RiskGeometry } from "../src/lib/research/m3-r11-round-011-risk-geometry.ts";
import { evaluateR11RiskGeometryConformance, R11_EXECUTABLE_RISK_CONFORMANCE } from "../src/lib/research/m3-r11-round-011-conformance.ts";
import { R11_CANDIDATE_REGISTRY, R11_RISK_GEOMETRY_CONTRACT } from "../src/lib/research/m3-r11-round-011-protocol.ts";

function candle(index: number, low: number, high: number): Candle {
  const openTime = Date.parse("2024-01-01T00:00:00.000Z") + index * 3_600_000;
  return { symbol: "BTCUSDT", timeframe: "1h", openTime, closeTime: openTime + 3_599_999, open: (low + high) / 2, high, low, close: (low + high) / 2, volume: 1, quoteVolume: 1, tradeCount: 1, takerBuyBaseVolume: 0.5, takerBuyQuoteVolume: 0.5 };
}

describe("M3-R11 Round-011 risk geometry conformance", () => {
  it("uses the previous-five structural swing for mirrored E1 stops", () => {
    const long = buildR11E1RiskGeometry({ direction: "LONG", entryReference: 120, atr14_1h: 10, previousFiveClosedCandles: [candle(0, 100, 105), candle(1, 103, 108), candle(2, 101, 109), candle(3, 102, 110), candle(4, 104, 111)] });
    const short = buildR11E1RiskGeometry({ direction: "SHORT", entryReference: 100, atr14_1h: 10, previousFiveClosedCandles: [candle(5, 90, 120), candle(6, 91, 118), candle(7, 92, 125), candle(8, 93, 119), candle(9, 94, 117)] });
    expect(long?.stopReference).toBe(98);
    expect(short?.stopReference).toBe(127);
    expect(long?.stopReference).not.toBe(120 - 0.2 * 10);
    expect(long?.stopAtr).not.toBe(0.2);
  });

  it("matches the accepted Round-010 risk geometry for identical intents", () => {
    const e1Input = { direction: "LONG" as const, entryReference: 120, atr14_1h: 10, previousFiveClosedCandles: [candle(0, 100, 105), candle(1, 103, 108), candle(2, 101, 109), candle(3, 102, 110), candle(4, 104, 111)] };
    const e2Input = { direction: "SHORT" as const, entryReference: 100, atr14_1h: 10, breakoutThroughReclaimClosedCandles: [candle(5, 88, 120), candle(6, 90, 125), candle(7, 92, 118)] };
    expect(buildR11E1RiskGeometry(e1Input)).toEqual(buildR10E1RiskGeometry(e1Input));
    expect(buildR11E2RiskGeometry(e2Input)).toEqual(buildR10E2RiskGeometry(e2Input));
  });

  it("uses the full breakout-through-reclaim structural extreme for mirrored E2 stops", () => {
    const long = buildR11E2RiskGeometry({ direction: "LONG", entryReference: 120, atr14_1h: 10, breakoutThroughReclaimClosedCandles: [candle(0, 100, 112), candle(1, 95, 115), candle(2, 98, 120)] });
    const short = buildR11E2RiskGeometry({ direction: "SHORT", entryReference: 100, atr14_1h: 10, breakoutThroughReclaimClosedCandles: [candle(3, 88, 120), candle(4, 90, 125), candle(5, 92, 118)] });
    expect(long?.stopReference).toBe(93);
    expect(short?.stopReference).toBe(127);
    expect(long?.stopReference).not.toBe(120 - 0.2 * 10);
    expect(short?.stopReference).not.toBe(100 + 0.2 * 10);
  });

  it("accepts inclusive 0.8 and 3.0 stopAtr and rejects both outside values", () => {
    const input = (entryReference: number) => buildR11E1RiskGeometry({ direction: "LONG", entryReference, atr14_1h: 10, previousFiveClosedCandles: [candle(0, 100, 101)] });
    expect(input(106)?.stopAtr).toBe(0.8);
    expect(input(128)?.stopAtr).toBe(3);
    expect(input(105)).toBeNull();
    expect(input(129)).toBeNull();
  });

  it("sets TP at exactly two times the full stop distance", () => {
    const long = buildR11E2RiskGeometry({ direction: "LONG", entryReference: 120, atr14_1h: 10, breakoutThroughReclaimClosedCandles: [candle(0, 95, 112)] });
    const short = buildR11E2RiskGeometry({ direction: "SHORT", entryReference: 100, atr14_1h: 10, breakoutThroughReclaimClosedCandles: [candle(1, 88, 125)] });
    expect(long?.takeProfitReference).toBe(120 + 2 * long!.stopDistance);
    expect(short?.takeProfitReference).toBe(100 - 2 * short!.stopDistance);
  });

  it("executes the deterministic risk and C1 settlement identity checks", () => {
    expect(evaluateR11RiskGeometryConformance()).toEqual(R11_EXECUTABLE_RISK_CONFORMANCE);
    expect(R11_EXECUTABLE_RISK_CONFORMANCE).toEqual({ e1StructuralStopVerified: true, e2StructuralStopVerified: true, stopBufferSemanticsVerified: true, stopAtrBoundaryVerified: true, tpUsesFullRiskDistance: true, c1UsesE1SettlementIdentity: true });
  });

  it("freezes the corrected geometry in the candidate registry and machine contract", () => {
    expect(R11_RISK_GEOMETRY_CONTRACT.stopBufferAtr).toBe(0.2);
    expect(R11_RISK_GEOMETRY_CONTRACT.minimumStopAtr).toBe(0.8);
    expect(R11_RISK_GEOMETRY_CONTRACT.maximumStopAtr).toBe(3);
    expect(R11_RISK_GEOMETRY_CONTRACT.stopAtrBoundary).toBe("INCLUSIVE");
    expect(R11_CANDIDATE_REGISTRY.find((candidate) => candidate.candidateId === "R11-E1-PULLBACK-RECLAIM")?.dataRule).toContain("PREVIOUS_FIVE_CLOSED_SWING_EXTREME");
    expect(R11_CANDIDATE_REGISTRY.find((candidate) => candidate.candidateId === "R11-E2-BREAKOUT-RETEST")?.dataRule).toContain("BREAKOUT_THROUGH_RECLAIM_STRUCTURAL_EXTREME");
  });
});
