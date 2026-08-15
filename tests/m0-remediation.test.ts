import { describe, expect, it } from "vitest";

import {
  areScoresConsistent,
  calculateScoreTotal,
} from "@/lib/scoring/score-consistency";
import {
  buildHourlyScanRunKey,
  decideScanRunAction,
} from "@/lib/scanning/run-idempotency";

describe("M0 score consistency", () => {
  const breakdown = {
    trendStrength: 40,
    pullbackQuality: 20,
    breakoutStrength: 20,
    volumeScore: 10,
    riskRewardScore: 10,
  };

  it("calculates total_score from the five stored components", () => {
    expect(calculateScoreTotal(breakdown)).toBe(100);
    expect(
      calculateScoreTotal({
        trendStrength: 0.1,
        pullbackQuality: 0.2,
        breakoutStrength: 0,
        volumeScore: 0,
        riskRewardScore: 0,
      }),
    ).toBe(0.3);
  });

  it("rejects a silent difference between signals.score and total_score", () => {
    expect(
      areScoresConsistent({ signalScore: 100, totalScore: 100, breakdown }),
    ).toBe(true);
    expect(
      areScoresConsistent({ signalScore: 99, totalScore: 100, breakdown }),
    ).toBe(false);
    expect(
      areScoresConsistent({ signalScore: 100, totalScore: 99, breakdown }),
    ).toBe(false);
  });
});

describe("M0 scan run idempotency", () => {
  it("maps the same scheduled hour to one stable run key", () => {
    expect(buildHourlyScanRunKey("2026-08-16T10:05:23+08:00")).toBe(
      "hourly-1h:2026-08-16T02:00:00.000Z",
    );
    expect(buildHourlyScanRunKey("2026-08-16T10:59:59Z")).toBe(
      "hourly-1h:2026-08-16T10:00:00.000Z",
    );
  });

  it("creates once, skips duplicate work, and retries the same row safely", () => {
    const now = "2026-08-16T10:10:00Z";

    expect(decideScanRunAction({ existing: null, now })).toBe("CREATE");
    expect(
      decideScanRunAction({
        existing: { status: "SUCCEEDED", leaseExpiresAt: null },
        now,
      }),
    ).toBe("SKIP_COMPLETED");
    expect(
      decideScanRunAction({
        existing: {
          status: "RUNNING",
          leaseExpiresAt: "2026-08-16T10:20:00Z",
        },
        now,
      }),
    ).toBe("SKIP_IN_PROGRESS");
    expect(
      decideScanRunAction({
        existing: {
          status: "RUNNING",
          leaseExpiresAt: "2026-08-16T10:05:00Z",
        },
        now,
      }),
    ).toBe("RETRY_EXISTING");
  });
});
