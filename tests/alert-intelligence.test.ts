import { describe, expect, it } from "vitest";
import {
  buildAlertExplanation,
  buildAlertIntelligence,
  buildAlertPayload,
  buildAlertPriority,
  type AlertIntelligenceInput,
} from "@/lib/alert-intelligence";

function validInput(overrides: Partial<AlertIntelligenceInput> = {}): AlertIntelligenceInput {
  return {
    signal: {
      direction: "LONG",
      identity: {
        signalId: "signal-001",
        symbol: "BTCUSDT",
        direction: "LONG",
        signalTime: "2026-08-15T00:00:00.000Z",
        strategyId: "baseline-001",
        strategyVersion: "baseline-001",
      },
      triggerExplanation: "Formal signal predicate matched.",
    },
    qualitySnapshot: {
      status: "AVAILABLE",
      grade: "A",
      score: 3,
      explanations: ["Quality snapshot is complete."],
    },
    marketContext: {
      status: "AVAILABLE",
      regime: "BULL",
      alignment: "SUPPORTIVE",
      explanation: "Current context is directionally supportive.",
    },
    riskAdvisory: {
      status: "AVAILABLE",
      level: "STANDARD",
      explanation: "Risk geometry is standard.",
    },
    historicalReview: {
      status: "AVAILABLE",
      reviewStatus: "IDENTITY_ONLY",
      contextSummary: "Identity-only historical context is available.",
    },
    ...overrides,
  };
}

describe("Alert Intelligence implementation", () => {
  it("builds a high-priority LONG alert payload", () => {
    const payload = buildAlertPayload(validInput());

    expect(payload).toMatchObject({
      signal: { direction: "LONG" },
      alertIntelligence: {
        direction: "LONG",
        qualityGrade: "A",
        qualityScore: 3,
        priority: "P1",
        notificationImportance: "HIGH",
        attentionRank: 1,
        confidence: "HIGH",
        humanDecisionRequired: true,
        automaticTrading: false,
      },
    });
  });

  it("builds a direction-preserving SHORT alert", () => {
    const input = validInput({
      signal: {
        direction: "SHORT",
        identity: {
          signalId: "signal-short-001",
          symbol: "ETHUSDT",
          direction: "SHORT",
          signalTime: "2026-08-15T01:00:00.000Z",
          strategyId: "baseline-001",
          strategyVersion: "baseline-001",
        },
        triggerExplanation: "Formal short signal predicate matched.",
      },
      marketContext: {
        status: "AVAILABLE",
        regime: "BEAR",
        alignment: "SUPPORTIVE",
        explanation: "Current context is directionally supportive.",
      },
    });
    const result = buildAlertIntelligence(input);

    expect(result.direction).toBe("SHORT");
    expect(result.qualityGrade).toBe("A");
    expect(result.automaticTrading).toBe(false);
  });

  it("fails closed for a missing signal as NO_SIGNAL", () => {
    const result = buildAlertIntelligence(validInput({ signal: null }));

    expect(result).toMatchObject({
      presentationStatus: "SUPPRESSED",
      direction: "NO_SIGNAL",
      qualityGrade: "IGNORE",
      priority: "IGNORE",
      notificationImportance: "DO_NOT_NOTIFY",
      attentionRank: null,
      confidence: "UNAVAILABLE",
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it("degrades priority when the quality snapshot is missing", () => {
    const priority = buildAlertPriority(validInput({ qualitySnapshot: null }));
    const result = buildAlertIntelligence(validInput({ qualitySnapshot: null }));

    expect(priority).toEqual({
      priority: "P3",
      notificationImportance: "LOW",
      attentionRank: 3,
      confidence: "LOW",
    });
    expect(result.qualityGrade).toBe("IGNORE");
    expect(result.humanReviewNotes).toContain("QUALITY_SNAPSHOT_MISSING");
  });

  it("degrades priority when risk advisory is missing", () => {
    const result = buildAlertIntelligence(validInput({ riskAdvisory: null }));

    expect(result.priority).toBe("P3");
    expect(result.presentationStatus).toBe("DEGRADED");
    expect(result.humanReviewNotes).toContain("RISK_ADVISORY_MISSING");
  });

  it("degrades credibility when historical metadata is missing without inferring an outcome", () => {
    const result = buildAlertIntelligence(validInput({ historicalReview: null }));

    expect(result.priority).toBe("P1");
    expect(result.historicalContext).toContain("unavailable");
    expect(result.humanReviewNotes).toContain("HISTORICAL_REVIEW_METADATA_MISSING");
    expect(result.historicalContext).not.toMatch(/PnL|forward return|profit|loss|R\b/i);
  });

  it("builds all four explanation fields from existing snapshots", () => {
    const explanation = buildAlertExplanation(validInput());

    expect(explanation).toEqual({
      whyTriggered: "Formal signal predicate matched.",
      currentEnvironment: "Current context is directionally supportive.",
      risk: "Risk geometry is standard.",
      historicalReference: "Identity-only historical context is available.",
    });
  });

  it("keeps priority as attention ordering rather than performance ordering", () => {
    const result = buildAlertIntelligence(validInput({
      qualitySnapshot: { status: "AVAILABLE", grade: "C", score: 1, explanations: [] },
      marketContext: {
        status: "AVAILABLE",
        regime: "BEAR",
        alignment: "ADVERSE",
        explanation: "Current context is adverse.",
      },
      riskAdvisory: {
        status: "AVAILABLE",
        level: "CAUTION",
        explanation: "Risk requires caution.",
      },
    }));

    expect(result.priority).toBe("P2");
    expect(result.attentionRank).toBe(2);
    expect(result).not.toHaveProperty("pnl");
    expect(result).not.toHaveProperty("forwardReturn");
    expect(result).not.toHaveProperty("performance");
  });

  it("does not expose execution, sizing, leverage, or account behavior", () => {
    const result = buildAlertIntelligence(validInput());
    const forbiddenKeys = [
      "placeOrder",
      "executeOrder",
      "positionSize",
      "leverage",
      "accountBalance",
      "closePosition",
    ];

    for (const key of forbiddenKeys) expect(result).not.toHaveProperty(key);
    expect(result.humanDecisionRequired).toBe(true);
    expect(result.automaticTrading).toBe(false);
  });

  it("only enhances the alert payload and keeps the source signal unchanged", () => {
    const input = validInput();
    const payload = buildAlertPayload(input);

    expect(payload.signal).toBe(input.signal);
    expect(payload.alertIntelligence.direction).toBe(input.signal?.direction);
    expect(payload).toHaveProperty("alertIntelligence.alertSummary");
  });
});
