import { describe, expect, it } from "vitest";
import {
  compareR22AdvisoryEvaluationStability,
  evaluateR22AdvisoryObservation,
  R22_ADVISORY_EVALUATION_GOVERNANCE,
  R22_ADVISORY_EVALUATION_NOISE_METRICS,
  R22_ADVISORY_EVALUATION_QUALITY_METRICS,
  R22_ADVISORY_EVALUATION_REVIEW_METRICS,
  type R22AdvisoryEvaluationObservation,
} from "@/lib/research/advisory-evaluation-protocol";

function validObservation(
  overrides: Partial<R22AdvisoryEvaluationObservation> = {},
): R22AdvisoryEvaluationObservation {
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
      decisionLatencyProxyMs: 1_500,
    },
    ...overrides,
  };
}

describe("Round-022 Advisory Evaluation design protocol", () => {
  it("freezes the four advisory-quality, three noise, and three review metrics", () => {
    expect(R22_ADVISORY_EVALUATION_QUALITY_METRICS).toEqual([
      "signalClarity",
      "explanationCompleteness",
      "riskVisibility",
      "contextCompleteness",
    ]);
    expect(R22_ADVISORY_EVALUATION_NOISE_METRICS).toEqual([
      "unnecessaryAlertRate",
      "ignoreRatio",
      "duplicateAlertRate",
    ]);
    expect(R22_ADVISORY_EVALUATION_REVIEW_METRICS).toEqual([
      "reviewCompleteness",
      "informationSufficiency",
      "decisionLatencyProxyMs",
    ]);
  });

  it("evaluates present-time metadata without economic inputs", () => {
    const result = evaluateR22AdvisoryObservation(validObservation());

    expect(result).toMatchObject({
      status: "OBSERVABLE",
      reason: "NONE",
      direction: "LONG",
      identityKey: "signal-001",
      observedOnly: true,
      humanDecisionRequired: true,
      automaticTrading: false,
    });
    expect(result.metrics).toEqual({
      advisoryQuality: {
        signalClarity: 1,
        explanationCompleteness: 1,
        riskVisibility: 1,
        contextCompleteness: 1,
      },
      noiseReduction: {
        unnecessaryAlertRate: 0,
        ignoreRatio: 0,
        duplicateAlertRate: 0,
      },
      humanReviewEfficiency: {
        reviewCompleteness: 1,
        informationSufficiency: 1,
        decisionLatencyProxyMs: 1_500,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/pnl|profit|loss|forwardReturn|performance|economicOutcome/i);
  });

  it("preserves SHORT direction and measures IGNORE and duplicate dispositions", () => {
    const result = evaluateR22AdvisoryObservation(validObservation({
      signal: { direction: "SHORT", identityKey: "signal-short-001" },
      qualitySnapshot: { available: true, grade: "C" },
      presentation: {
        signalClarity: true,
        explanationCompleteness: false,
        riskVisibility: false,
        contextCompleteness: true,
        unnecessaryAlert: true,
        notificationDisposition: "DUPLICATE_SKIPPED",
      },
      humanReview: {
        reviewComplete: false,
        informationSufficient: false,
        decisionLatencyProxyMs: 0,
      },
    }));

    expect(result.direction).toBe("SHORT");
    expect(result.metrics?.noiseReduction).toEqual({
      unnecessaryAlertRate: 1,
      ignoreRatio: 0,
      duplicateAlertRate: 1,
    });
    expect(result.metrics?.humanReviewEfficiency).toEqual({
      reviewCompleteness: 0,
      informationSufficiency: 0,
      decisionLatencyProxyMs: 0,
    });
  });

  it("treats an IGNORE disposition as observable noise rather than a signal-generation decision", () => {
    const result = evaluateR22AdvisoryObservation(validObservation({
      presentation: {
        signalClarity: true,
        explanationCompleteness: true,
        riskVisibility: true,
        contextCompleteness: true,
        unnecessaryAlert: false,
        notificationDisposition: "IGNORED",
      },
    }));

    expect(result.status).toBe("OBSERVABLE");
    expect(result.metrics?.noiseReduction.ignoreRatio).toBe(1);
  });

  it("does not evaluate NO_SIGNAL as an alert", () => {
    const result = evaluateR22AdvisoryObservation(validObservation({
      signal: { direction: "NO_SIGNAL", identityKey: null },
    }));

    expect(result).toMatchObject({
      status: "NOT_EVALUABLE",
      reason: "NO_SIGNAL_NOT_AN_ALERT",
      direction: "NO_SIGNAL",
      metrics: null,
    });
  });

  it.each([
    ["signal", { signal: null }, "MISSING_SIGNAL"],
    ["quality", { qualitySnapshot: null }, "MISSING_QUALITY_SNAPSHOT"],
    ["context", { marketContext: null }, "MISSING_MARKET_CONTEXT"],
    ["risk", { riskAdvisory: null }, "MISSING_RISK_ADVISORY"],
    ["historical review", { historicalReview: null }, "MISSING_HISTORICAL_REVIEW"],
    ["presentation", { presentation: null }, "MISSING_PRESENTATION_OBSERVATION"],
    ["human review", { humanReview: null }, "MISSING_HUMAN_REVIEW_OBSERVATION"],
  ] as const)("fails closed when %s is missing", (_label, override, reason) => {
    const result = evaluateR22AdvisoryObservation(validObservation(override));

    expect(result).toMatchObject({
      status: "NOT_EVALUABLE",
      reason,
      metrics: null,
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it("does not impute a missing decision-latency proxy", () => {
    const result = evaluateR22AdvisoryObservation(validObservation({
      humanReview: {
        reviewComplete: true,
        informationSufficient: true,
        decisionLatencyProxyMs: null,
      },
    }));

    expect(result.reason).toBe("INVALID_DECISION_LATENCY_PROXY");
    expect(result.metrics).toBeNull();
  });

  it("requires identity-only historical metadata and never outcome data", () => {
    const result = evaluateR22AdvisoryObservation(validObservation({
      historicalReview: { status: "UNAVAILABLE", identityMetadataPresent: false },
    }));

    expect(result.reason).toBe("MISSING_HISTORICAL_REVIEW");
    expect(result.metrics).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/outcome|return|pnl|profit|loss/i);
  });

  it("reports deterministic stability for repeated identical input and detects changed output", () => {
    const first = evaluateR22AdvisoryObservation(validObservation());
    const second = evaluateR22AdvisoryObservation(validObservation());
    const changed = evaluateR22AdvisoryObservation(validObservation({
      presentation: {
        signalClarity: false,
        explanationCompleteness: true,
        riskVisibility: true,
        contextCompleteness: true,
        unnecessaryAlert: false,
        notificationDisposition: "DELIVERED",
      },
    }));

    expect(compareR22AdvisoryEvaluationStability(first, second)).toBe("STABLE");
    expect(compareR22AdvisoryEvaluationStability(first, changed)).toBe("NOT_STABLE");
    expect(compareR22AdvisoryEvaluationStability(first, evaluateR22AdvisoryObservation(validObservation({
      signal: { direction: "NO_SIGNAL", identityKey: null },
    })))).toBe("NOT_EVALUABLE");
  });

  it("freezes design-only governance and does not authorize evaluation execution", () => {
    expect(R22_ADVISORY_EVALUATION_GOVERNANCE).toMatchObject({
      designOnly: true,
      implementationAuthorized: false,
      performanceExecuted: false,
      backtestExecuted: false,
      selectionExecuted: false,
      economicEvaluationExecuted: false,
      economicValuesRead: false,
      forwardReturnRead: false,
      newMarketDataFetched: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      automaticTrading: false,
      humanDecisionRequired: true,
    });
  });
});
