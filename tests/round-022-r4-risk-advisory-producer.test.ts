import { describe, expect, it } from "vitest";

import {
  buildRiskAdvisorySnapshotCandidate,
  RiskAdvisoryNotEvaluableError,
  R22_R4_RISK_ADVISORY_PRODUCER_IMPLEMENTATION_STATUS,
} from "@/lib/observation-evidence/risk-advisory";
import {
  findForbiddenObservationEconomicField,
  validateObservationEvidenceCandidate,
} from "@/lib/observation-evidence/validator";
import type { SignalAdvisory } from "@/lib/signal-advisory/types";
import { buildDeterministicSignalId } from "@/lib/signal-advisory/identity";

const SIGNAL_TIME = "2026-08-23T00:00:00.000Z";
const CAPTURED_AT = "2026-08-23T00:00:02.000Z";

function advisory(overrides: Partial<SignalAdvisory> = {}): SignalAdvisory {
  const direction = overrides.direction ?? "LONG";
  const signalId = overrides.signalId ?? buildDeterministicSignalId({
    symbol: "BTCUSDT",
    direction,
    signalTime: SIGNAL_TIME,
    strategyVersion: "baseline-001-test",
  });
  return {
    signalId,
    symbol: "BTCUSDT",
    direction,
    strategyId: "baseline-001",
    strategyVersion: "baseline-001-test",
    signalTime: SIGNAL_TIME,
    signalValidUntil: "2026-08-23T01:00:00.000Z",
    currentReferencePrice: 100,
    suggestedEntryReference: 100,
    stopLoss: direction === "LONG" ? 98 : 102,
    takeProfit: direction === "LONG" ? 104 : 96,
    riskReward: 2,
    score: 85,
    grade: "A",
    marketRegime: {
      btcRegime: "BTC_NEUTRAL",
      symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
    },
    dataFreshness: {
      status: "FRESH",
      sourceServerTime: "2026-08-23T00:00:05.000Z",
      candleCloseTime: SIGNAL_TIME,
      ageMs: 5_000,
    },
    recipient: "owner@example.test",
    scanRunKey: "hourly-1h:2026-08-23T00:05:00.000Z",
    ...overrides,
  };
}

function build(overrides: Partial<SignalAdvisory> = {}, capturedAt = CAPTURED_AT) {
  return buildRiskAdvisorySnapshotCandidate({ advisory: advisory(overrides), capturedAt });
}

describe("Round-022 R4 RISK_ADVISORY producer", () => {
  it.each(["LONG", "SHORT"] as const)("builds a valid %s advisory from formal signal geometry", (direction) => {
    const candidate = build({ direction });

    expect(validateObservationEvidenceCandidate(candidate)).toMatchObject({ status: "VALID", reason: "NONE" });
    expect(candidate.artifactType).toBe("RISK_ADVISORY");
    expect(candidate.informationAsOf).toBe(SIGNAL_TIME);
    expect(candidate.payload).toMatchObject({
      symbol: "BTCUSDT",
      direction,
      geometry: {
        entryReference: 100,
        stopLoss: direction === "LONG" ? 98 : 102,
        takeProfit: direction === "LONG" ? 104 : 96,
        stopDistance: 2,
        rewardDistance: 4,
        riskReward: 2,
      },
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it.each([
    ["LONG invalid stop", { direction: "LONG", stopLoss: 101, takeProfit: 104 }],
    ["LONG invalid target", { direction: "LONG", stopLoss: 98, takeProfit: 99 }],
    ["SHORT invalid stop", { direction: "SHORT", stopLoss: 99, takeProfit: 96 }],
    ["SHORT invalid target", { direction: "SHORT", stopLoss: 102, takeProfit: 101 }],
  ] as const)("rejects invalid %s geometry ordering", (_label, overrides) => {
    expect(() => build(overrides)).toThrow(RiskAdvisoryNotEvaluableError);
  });

  it.each(["suggestedEntryReference", "stopLoss", "takeProfit", "riskReward"] as const)(
    "rejects non-finite, zero, and negative %s",
    (field) => {
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
        expect(() => build({ [field]: value } as Partial<SignalAdvisory>)).toThrow(RiskAdvisoryNotEvaluableError);
      }
    },
  );

  it("rejects zero stop/reward distance and a risk-reward mismatch", () => {
    expect(() => build({ stopLoss: 100 })).toThrow(RiskAdvisoryNotEvaluableError);
    expect(() => build({ takeProfit: 100 })).toThrow(RiskAdvisoryNotEvaluableError);
    expect(() => build({ riskReward: 3 })).toThrow("RISK_REWARD_MISMATCH");
  });

  it.each([
    ["candle close mismatch", { dataFreshness: { status: "FRESH", sourceServerTime: "2026-08-23T00:00:05.000Z", candleCloseTime: "2026-08-22T23:59:59.999Z", ageMs: 5_000 } }],
    ["source server before signal", { dataFreshness: { status: "FRESH", sourceServerTime: "2026-08-22T23:59:59.999Z", candleCloseTime: SIGNAL_TIME, ageMs: 5_000 } }],
  ] as const)("rejects %s", (_label, overrides) => {
    expect(() => build(overrides as Partial<SignalAdvisory>)).toThrow(RiskAdvisoryNotEvaluableError);
  });

  it("rejects capture before signal and non-fresh source data", () => {
    expect(() => build({}, "2026-08-22T23:59:59.999Z")).toThrow("CAPTURE_BEFORE_SIGNAL");
    expect(() => build({ dataFreshness: { status: "FRESH", sourceServerTime: "2026-08-23T00:00:05.000Z", candleCloseTime: "2026-08-23T00:00:01.000Z", ageMs: 5_000 } } as Partial<SignalAdvisory>))
      .toThrow(RiskAdvisoryNotEvaluableError);
  });

  it("uses independent logical identity and evidence identity for captures", () => {
    const first = build({}, "2026-08-23T00:00:02.000Z");
    const second = build({}, "2026-08-23T00:00:04.000Z");

    expect(second.artifactId).toBe(first.artifactId);
    expect(second.sourceRef).toBe(first.sourceRef);
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.evidenceHash).not.toBe(first.evidenceHash);
    expect(second.evidenceId).not.toBe(first.evidenceId);
  });

  it.each([
    ["stop loss", { stopLoss: 97, takeProfit: 104, riskReward: 4 / 3 }],
    ["take profit", { stopLoss: 98, takeProfit: 105, riskReward: 2.5 }],
  ] as const)("binds %s changes into source and snapshot identity", (_label, overrides) => {
    const first = build();
    const second = build(overrides);

    expect(second.artifactId).toBe(first.artifactId);
    expect(second.sourceRef).not.toBe(first.sourceRef);
    expect(second.contentHash).not.toBe(first.contentHash);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it("emits only RISK_ADVISORY evidence and no economic or trading controls", () => {
    const candidate = build();
    expect(candidate.artifactType).toBe("RISK_ADVISORY");
    expect(findForbiddenObservationEconomicField(candidate.payload)).toBeNull();
    expect(JSON.stringify(candidate.payload)).not.toMatch(/"(?:pnl|profit|losslabel|forward_return|futurePrice|drawdown|leverage|positionSize|capitalAtRisk|accountBalance)"/i);
    expect(R22_R4_RISK_ADVISORY_PRODUCER_IMPLEMENTATION_STATUS).toMatchObject({
      r1FoundationImplemented: true,
      r2QualitySnapshotProducerImplemented: true,
      r3MarketContextProducerImplemented: true,
      r4RiskAdvisoryProducerImplemented: true,
      closesReadinessNodes: ["S03"],
      s01Status: "SOURCE_READY",
      s02Status: "SOURCE_READY",
      s03ImplementationStatus: "SOURCE_READY_PENDING_ACCEPTANCE",
      s03AcceptedReady: false,
      s04Status: "FAIL",
      s10Status: "FAIL",
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      newMarketDataFetched: false,
      automaticTrading: false,
    });
  });
});
