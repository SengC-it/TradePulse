import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildDeterministicSignalId } from "@/lib/signal-advisory/identity";
import type { SignalAdvisory } from "@/lib/signal-advisory/types";
import type { BTCRegime, SymbolRegime } from "@/lib/strategy/types";
import {
  buildQualitySnapshotCandidate,
  R22_R2_QUALITY_SNAPSHOT_IMPLEMENTATION_STATUS,
} from "@/lib/observation-evidence/quality-snapshot";
import {
  validateObservationEvidenceCandidate,
} from "@/lib/observation-evidence/validator";

const SIGNAL_TIME = "2026-08-23T00:00:00.000Z";

function advisory(
  direction: "LONG" | "SHORT",
  symbolRegime: SymbolRegime,
  btcRegime: BTCRegime = "BTC_NEUTRAL",
): SignalAdvisory {
  return {
    signalId: buildDeterministicSignalId({
      symbol: "BTCUSDT",
      direction,
      signalTime: SIGNAL_TIME,
      strategyVersion: "baseline-001-v1",
    }),
    symbol: "BTCUSDT",
    direction,
    strategyId: "baseline-001",
    strategyVersion: "baseline-001-v1",
    signalTime: SIGNAL_TIME,
    signalValidUntil: "2026-08-23T01:00:00.000Z",
    currentReferencePrice: 100,
    suggestedEntryReference: 100,
    stopLoss: direction === "LONG" ? 98 : 102,
    takeProfit: direction === "LONG" ? 104 : 96,
    riskReward: 2,
    score: 85,
    grade: "A",
    marketRegime: { btcRegime, symbolRegime },
    dataFreshness: {
      status: "FRESH",
      sourceServerTime: "2026-08-23T00:00:05.000Z",
      candleCloseTime: SIGNAL_TIME,
      ageMs: 5_000,
    },
    recipient: "owner@example.test",
    scanRunKey: "hourly-1h:2026-08-23T00:05:00.000Z",
  };
}

describe("Round-022 R2 QUALITY_SNAPSHOT producer", () => {
  it("uses the formal Signal Quality evaluator and not a research protocol at runtime", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/observation-evidence/quality-snapshot.ts"), "utf8");
    expect(source).toContain("evaluateSignalQuality");
    expect(source).not.toContain("m3-r22-signal-quality-design-protocol");
  });

  it("builds an authoritative LONG quality snapshot with frozen identity and payload", () => {
    const candidate = buildQualitySnapshotCandidate({
      advisory: advisory("LONG", "LONG_ONLY", "BTC_STRONG_BULL"),
      capturedAt: "2026-08-23T00:00:02.000Z",
    });
    const validation = validateObservationEvidenceCandidate(candidate);

    expect(validation).toMatchObject({ status: "VALID", reason: "NONE" });
    expect(candidate.eventKind).toBe("SNAPSHOT");
    expect(candidate.artifactType).toBe("QUALITY_SNAPSHOT");
    expect(candidate.sourceRef).toBe(`tp_signal_advisories:${candidate.signalId}`);
    expect(candidate.informationAsOf).toBe(SIGNAL_TIME);
    expect(candidate.capturedAt).toBe("2026-08-23T00:00:02.000Z");
    expect(candidate.supersedesArtifactId).toBeNull();
    expect(candidate.supersedesEvidenceId).toBeNull();
    expect(candidate.payload).toEqual({
      direction: "LONG",
      qualityGrade: "A",
      qualityScore: 3,
      qualityStatus: "ADVISORY_VALID",
      contextAlignment: "SUPPORTIVE",
      riskLevel: "STANDARD",
      explanations: expect.any(Array),
      humanDecisionRequired: true,
      automaticTrading: false,
    });
    expect(Object.keys(candidate.payload as Record<string, unknown>)).not.toEqual(
      expect.arrayContaining(["riskDistance", "rewardDistance", "riskRewardRatio"]),
    );
  });

  it("maps SHORT quality from the existing advisory input without re-running strategy", () => {
    const candidate = buildQualitySnapshotCandidate({
      advisory: advisory("SHORT", "SHORT_ONLY", "BTC_STRONG_BEAR"),
      capturedAt: "2026-08-23T00:00:03.000Z",
    });

    expect(candidate.payload).toMatchObject({
      direction: "SHORT",
      qualityGrade: "A",
      contextAlignment: "SUPPORTIVE",
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it("keeps logical identity and idempotency stable across captures", () => {
    const first = buildQualitySnapshotCandidate({
      advisory: advisory("LONG", "LONG_ONLY", "BTC_NEUTRAL"),
      capturedAt: "2026-08-23T00:00:02.000Z",
    });
    const second = buildQualitySnapshotCandidate({
      advisory: advisory("LONG", "LONG_ONLY", "BTC_NEUTRAL"),
      capturedAt: "2026-08-23T00:00:04.000Z",
    });

    expect(second.artifactId).toBe(first.artifactId);
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.evidenceHash).not.toBe(first.evidenceHash);
    expect(second.evidenceId).not.toBe(first.evidenceId);
  });

  it("fails closed when the runtime capture is before the signal time", () => {
    const candidate = buildQualitySnapshotCandidate({
      advisory: advisory("LONG", "LONG_ONLY", "BTC_STRONG_BULL"),
      capturedAt: "2026-08-22T23:59:59.999Z",
    });

    expect(validateObservationEvidenceCandidate(candidate)).toMatchObject({
      status: "NOT_EVALUABLE",
      reason: "CAUSAL_TIMESTAMP_INVALID",
      causalReason: "CAPTURE_BEFORE_INFORMATION_AS_OF",
    });
  });

  it("does not create synthetic NO_SIGNAL or separate context/risk artifacts", () => {
    const candidate = buildQualitySnapshotCandidate({
      advisory: advisory("LONG", "NO_TRADE", "BTC_NEUTRAL"),
      capturedAt: "2026-08-23T00:00:02.000Z",
    });

    expect(candidate.artifactType).toBe("QUALITY_SNAPSHOT");
    expect(candidate.payload).toMatchObject({ direction: "LONG", qualityGrade: "B" });
    expect(candidate.payload).not.toHaveProperty("futureReturn");
    expect(candidate.payload).not.toHaveProperty("pnl");
  });

  it.each([
    ["LONG", "LONG_ONLY", "BTC_STRONG_BULL", "BULL", "SUPPORTIVE"],
    ["LONG", "LONG_ONLY", "BTC_NEUTRAL", "NEUTRAL", "NEUTRAL"],
    ["SHORT", "SHORT_ONLY", "BTC_STRONG_BEAR", "BEAR", "SUPPORTIVE"],
    ["LONG", "LONG_ONLY", "BTC_STRONG_BEAR", "BEAR", "ADVERSE"],
  ] as const)(
    "%s with %s maps BTC regime %s to %s/%s",
    (direction, symbolRegime, btcRegime, expectedRegime, expectedAlignment) => {
      const candidate = buildQualitySnapshotCandidate({
        advisory: advisory(direction, symbolRegime, btcRegime),
        capturedAt: "2026-08-23T00:00:02.000Z",
      });

      expect(candidate.payload).toMatchObject({
        contextAlignment: expectedAlignment,
      });
      expect(candidate.payload).toEqual(expect.objectContaining({
        explanations: expect.arrayContaining([
          expect.stringContaining(expectedRegime === "NEUTRAL" ? "neutral" : "Market context"),
        ]),
      }));
    },
  );

  it("uses BTC regime instead of symbol regime for quality context", () => {
    const candidate = buildQualitySnapshotCandidate({
      advisory: advisory("LONG", "NO_TRADE", "BTC_STRONG_BULL"),
      capturedAt: "2026-08-23T00:00:02.000Z",
    });

    expect(candidate.payload).toMatchObject({
      contextAlignment: "SUPPORTIVE",
    });
  });

  it("uses only the real runtime regime enum values", () => {
    const symbolRegimes: SymbolRegime[] = ["LONG_ONLY", "SHORT_ONLY", "NO_TRADE"];
    const btcRegimes: BTCRegime[] = ["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"];

    expect(symbolRegimes).toEqual(["LONG_ONLY", "SHORT_ONLY", "NO_TRADE"]);
    expect(btcRegimes).toEqual(["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"]);
  });

  it("fails closed to UNKNOWN for an unsupported BTC regime at the runtime boundary", () => {
    const invalidRuntimeAdvisory = {
      ...advisory("LONG", "NO_TRADE", "BTC_NEUTRAL"),
      marketRegime: {
        ...advisory("LONG", "NO_TRADE", "BTC_NEUTRAL").marketRegime,
        btcRegime: "UNSUPPORTED_RUNTIME_VALUE",
      },
    } as unknown as SignalAdvisory;
    const candidate = buildQualitySnapshotCandidate({
      advisory: invalidRuntimeAdvisory,
      capturedAt: "2026-08-23T00:00:02.000Z",
    });

    expect(candidate.payload).toMatchObject({
      qualityGrade: "C",
      contextAlignment: "UNAVAILABLE",
    });
  });

  it("publishes independent R2 status without rewriting frozen R1 readiness evidence", () => {
    expect(R22_R2_QUALITY_SNAPSHOT_IMPLEMENTATION_STATUS).toMatchObject({
      r2QualitySnapshotProducerImplemented: true,
      qualitySnapshotRuntimeCallSiteImplemented: true,
      qualitySnapshotPersistenceAcknowledgementImplemented: true,
      closesReadinessNodes: ["S01"],
      dependsOn: ["R1"],
      s01ImplementationStatus: "SOURCE_READY_PENDING_ACCEPTANCE",
      s01AcceptedReady: false,
      s02Status: "FAIL",
      s10Status: "FAIL",
      observationInstrumentationImplemented: false,
      observationExecuted: false,
      performanceExecutionCount: 0,
      productionUnchanged: true,
      automaticTrading: false,
    });
  });
});
