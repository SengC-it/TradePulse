import { describe, expect, it } from "vitest";
import {
  aggregateAdvisoryEvaluations,
  compareAdvisoryEvaluationStability,
  evaluateAdvisoryObservation,
  type AdvisoryEvaluationObservation,
} from "@/lib/advisory-evaluation";

function validObservation(
  overrides: Partial<AdvisoryEvaluationObservation> = {},
): AdvisoryEvaluationObservation {
  return {
    signal: { direction: "LONG", identityKey: "signal-001" },
    qualitySnapshot: { available: true, grade: "A" },
    marketContext: { available: true },
    riskAdvisory: { available: true },
    historicalReview: { status: "IDENTITY_ONLY", identityMetadataPresent: true },
    presentation: {
      signalClarity: true,
      explanationCompleteness: true,
      riskVisibility: true,
      contextCompleteness: true,
      unnecessaryAlert: false,
      notificationDisposition: "DELIVERED",
    },
    humanReview: {
      reviewComplete: true,
      informationSufficient: true,
      decisionLatencyProxyMs: 1_000,
    },
    ...overrides,
  };
}

describe("Round-022 Advisory Evaluation implementation", () => {
  it("evaluates a valid LONG advisory using only present-time metadata", () => {
    const result = evaluateAdvisoryObservation(validObservation());

    expect(result).toMatchObject({
      status: "OBSERVABLE",
      direction: "LONG",
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it("evaluates a valid SHORT advisory without changing direction", () => {
    const result = evaluateAdvisoryObservation(validObservation({
      signal: { direction: "SHORT", identityKey: "signal-short-001" },
    }));

    expect(result).toMatchObject({ status: "OBSERVABLE", direction: "SHORT" });
  });

  it("returns the required NO_SIGNAL fail-closed state", () => {
    const result = evaluateAdvisoryObservation(validObservation({
      signal: { direction: "NO_SIGNAL", identityKey: null },
    }));

    expect(result).toMatchObject({
      status: "NOT_EVALUABLE",
      reason: "NO_SIGNAL_NOT_AN_ALERT",
      metrics: null,
    });
  });

  it.each([
    ["identity", { signal: { direction: "LONG", identityKey: null } }, "MISSING_SIGNAL"],
    ["quality", { qualitySnapshot: null }, "MISSING_QUALITY_SNAPSHOT"],
    ["context", { marketContext: null }, "MISSING_MARKET_CONTEXT"],
    ["risk", { riskAdvisory: null }, "MISSING_RISK_ADVISORY"],
    ["historical review", { historicalReview: null }, "MISSING_HISTORICAL_REVIEW"],
    ["presentation", { presentation: null }, "MISSING_PRESENTATION_OBSERVATION"],
    ["human review", { humanReview: null }, "MISSING_HUMAN_REVIEW_OBSERVATION"],
  ] as const)("fails closed for missing %s", (_label, override, reason) => {
    const result = evaluateAdvisoryObservation(validObservation(override));

    expect(result).toMatchObject({ status: "NOT_EVALUABLE", reason, metrics: null });
  });

  it("fails closed for a missing or invalid latency proxy", () => {
    for (const decisionLatencyProxyMs of [null, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = evaluateAdvisoryObservation(validObservation({
        humanReview: { reviewComplete: true, informationSufficient: true, decisionLatencyProxyMs },
      }));
      expect(result).toMatchObject({
        status: "NOT_EVALUABLE",
        reason: "INVALID_DECISION_LATENCY_PROXY",
        metrics: null,
      });
    }
  });

  it("maps quality, explanation, risk, context, noise, and review observations deterministically", () => {
    const result = evaluateAdvisoryObservation(validObservation({
      presentation: {
        signalClarity: false,
        explanationCompleteness: true,
        riskVisibility: false,
        contextCompleteness: true,
        unnecessaryAlert: true,
        notificationDisposition: "DUPLICATE_SKIPPED",
      },
      humanReview: { reviewComplete: false, informationSufficient: true, decisionLatencyProxyMs: 2_000 },
    }));

    expect(result.metrics).toEqual({
      advisoryQuality: {
        signalClarity: 0,
        explanationCompleteness: 1,
        riskVisibility: 0,
        contextCompleteness: 1,
      },
      noiseReduction: {
        unnecessaryAlertRate: 1,
        ignoreRatio: 0,
        duplicateAlertRate: 1,
      },
      humanReviewEfficiency: {
        reviewCompleteness: 0,
        informationSufficiency: 1,
        decisionLatencyProxyMs: 2_000,
      },
    });
  });

  it("aggregates only evaluable observations and excludes fail-closed records from the denominator", () => {
    const batch = aggregateAdvisoryEvaluations([
      validObservation(),
      validObservation({
        signal: { direction: "SHORT", identityKey: "signal-short-001" },
        presentation: {
          signalClarity: false,
          explanationCompleteness: false,
          riskVisibility: false,
          contextCompleteness: false,
          unnecessaryAlert: true,
          notificationDisposition: "IGNORED",
        },
        humanReview: { reviewComplete: false, informationSufficient: false, decisionLatencyProxyMs: 3_000 },
      }),
      validObservation({ qualitySnapshot: null }),
    ]);

    expect(batch).toMatchObject({
      status: "OBSERVABLE",
      evaluableCount: 2,
      notEvaluableCount: 1,
      notEvaluableReasons: ["MISSING_QUALITY_SNAPSHOT"],
    });
    expect(batch.metrics).toEqual({
      advisoryQuality: {
        signalClarity: 0.5,
        explanationCompleteness: 0.5,
        riskVisibility: 0.5,
        contextCompleteness: 0.5,
      },
      noiseReduction: {
        unnecessaryAlertRate: 0.5,
        ignoreRatio: 0.5,
        duplicateAlertRate: 0,
      },
      humanReviewEfficiency: {
        reviewCompleteness: 0.5,
        informationSufficiency: 0.5,
        decisionLatencyProxyMs: 2_000,
      },
    });
    expect(JSON.stringify(batch)).not.toMatch(/NaN|Infinity/);
  });

  it("returns NOT_EVALUABLE for an empty or all-invalid batch", () => {
    const empty = aggregateAdvisoryEvaluations([]);
    const invalid = aggregateAdvisoryEvaluations([validObservation({ signal: null })]);

    expect(empty).toMatchObject({ status: "NOT_EVALUABLE", evaluableCount: 0, metrics: null });
    expect(invalid).toMatchObject({
      status: "NOT_EVALUABLE",
      evaluableCount: 0,
      notEvaluableCount: 1,
      metrics: null,
    });
    expect(JSON.stringify(empty)).not.toMatch(/NaN|Infinity/);
    expect(JSON.stringify(invalid)).not.toMatch(/NaN|Infinity/);
  });

  it("returns the deterministic stability statuses", () => {
    const first = evaluateAdvisoryObservation(validObservation());
    const same = evaluateAdvisoryObservation(validObservation());
    const changed = evaluateAdvisoryObservation(validObservation({
      presentation: {
        signalClarity: false,
        explanationCompleteness: true,
        riskVisibility: true,
        contextCompleteness: true,
        unnecessaryAlert: false,
        notificationDisposition: "DELIVERED",
      },
    }));
    const failed = evaluateAdvisoryObservation(validObservation({ signal: null }));

    expect(compareAdvisoryEvaluationStability(first, same)).toBe("STABLE");
    expect(compareAdvisoryEvaluationStability(first, changed)).toBe("NOT_STABLE");
    expect(compareAdvisoryEvaluationStability(first, failed)).toBe("NOT_EVALUABLE");
  });

  it("keeps evaluation terminal and free of trading or economic output fields", () => {
    const output = JSON.stringify(aggregateAdvisoryEvaluations([validObservation()]));

    expect(output).not.toMatch(/pnl|forwardReturn|profit|expectedReturn|winRate|tradeAction|positionSize|leverage|order/i);
    expect(output).toContain('"humanDecisionRequired":true');
    expect(output).toContain('"automaticTrading":false');
  });

  it("does not imply upstream feedback or a combined advisory score", () => {
    const output = JSON.stringify(aggregateAdvisoryEvaluations([validObservation()]));

    expect(output).not.toContain("AdvisoryScore");
    expect(output).not.toMatch(/signalGeneration|qualityGrade|signalRanking|suppressNewAlert/i);
  });
});
