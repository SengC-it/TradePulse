import { describe, expect, it } from "vitest";

import { calculateReviewMetrics } from "@/lib/dashboard/metrics";
import { formatR, maskRecipient, reasonLabel } from "@/lib/dashboard/presenters";
import { mapStrategyEvaluations } from "@/lib/signal-advisory/evaluations";

describe("Dashboard V1 presentation and observability", () => {
  it("maps all evaluation outcomes without changing Strategy Engine meaning", () => {
    const rows = mapStrategyEvaluations({
      scanRunId: "scan-1",
      evaluatedAt: "2026-08-23T00:00:00.000Z",
      evaluations: [
        {
          strategyVersion: "baseline-001",
          symbol: "BTCUSDT",
          direction: "LONG",
          status: "FORMAL_SIGNAL",
          reason: null,
          symbolRegime: "LONG_ONLY",
          btcRegime: "BTC_STRONG_BULL",
          candidate: {
            strategyVersion: "baseline-001",
            symbol: "BTCUSDT",
            direction: "LONG",
            symbolRegime: "LONG_ONLY",
            btcRegime: "BTC_STRONG_BULL",
            entryReference: 100,
            stopReference: 98,
            takeProfitReference: 104,
            stopDistance: 2,
            stopAtr: 1.2,
            breakdown: {
              trendStrength: 40,
              pullbackQuality: 20,
              breakoutStrength: 20,
              volumeScore: 10,
              riskRewardScore: 10,
            },
            totalScore: 90,
            grade: "A",
            formalSignal: true,
          },
        },
        {
          strategyVersion: "baseline-001",
          symbol: "ETHUSDT",
          direction: "SHORT",
          status: "NO_ELIGIBLE_CANDIDATE",
          reason: "PULLBACK_NOT_FOUND",
          symbolRegime: "SHORT_ONLY",
          btcRegime: "BTC_STRONG_BULL",
          candidate: null,
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ scanRunId: "scan-1", status: "FORMAL_SIGNAL", score: 90, grade: "A", formalSignal: true });
    expect(rows[0]?.scoreBreakdown).toMatchObject({ trendStrength: 40 });
    expect(rows[1]).toMatchObject({ status: "NO_ELIGIBLE_CANDIDATE", reasonCode: "PULLBACK_NOT_FOUND", score: null, grade: null, formalSignal: false });
  });

  it("uses safe Chinese reason labels and masks recipients", () => {
    expect(reasonLabel("PULLBACK_NOT_FOUND")).toBe("未出现有效回调");
    expect(reasonLabel("UNKNOWN_INTERNAL_REASON")).toBe("未满足信号条件");
    expect(maskRecipient("sheng.chi@qq.com")).toBe("s***@qq.com");
    expect(maskRecipient("not-an-email")).toBe("—");
  });

  it("does not infer PnL when there are no authoritative resolved results", () => {
    const metrics = calculateReviewMetrics([]);
    expect(metrics.hasValidSample).toBe(false);
    expect(metrics.winRate).toBeNull();
    expect(metrics.cumulativeR).toBeNull();
    expect(formatR(metrics.cumulativeR)).toBe("—");
  });

  it("calculates R metrics only from finite resolved values", () => {
    const metrics = calculateReviewMetrics([{ resultR: 2 }, { resultR: -1 }, { resultR: 0 }, { resultR: null }]);
    expect(metrics).toMatchObject({ hasValidSample: true, reviewedSignals: 3, wins: 1, losses: 1, winRate: 1 / 3, cumulativeR: 1, averageR: 1 / 3, profitFactor: 2, maxDrawdownR: -1 });
  });
});
