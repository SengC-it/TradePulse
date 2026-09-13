import { describe, expect, it } from "vitest";
import {
  assessLongQuality,
  assessShortQuality,
  deriveMarketContextAdvisory,
  evaluateSignalQuality,
  SIGNAL_QUALITY_SCORE_BY_GRADE,
  SignalQualityEvaluator,
  signalQualityEvaluator,
  type SignalQualityInput,
} from "@/lib/signal-quality";

function validInput(overrides: Partial<SignalQualityInput> = {}): SignalQualityInput {
  return {
    direction: "LONG",
    referencePrice: 100,
    stopLoss: 95,
    takeProfit: 110,
    closedCandle: true,
    freshData: true,
    identityComplete: true,
    strategySnapshotComplete: true,
    marketRegime: "BULL",
    ...overrides,
  };
}

describe("Signal Quality & Risk Advisory implementation", () => {
  it("evaluates a valid LONG as A without crossing the human-decision boundary", () => {
    const result = evaluateSignalQuality(validInput());

    expect(result).toMatchObject({
      direction: "LONG",
      qualityGrade: "A",
      qualityScore: 3,
      qualityStatus: "ADVISORY_VALID",
      riskLevel: "STANDARD",
      humanDecisionRequired: true,
      automaticTrading: false,
    });
    expect(result.marketContext.alignment).toBe("SUPPORTIVE");
    expect(result.riskAdvisory.riskRewardRatio).toBe(2);
  });

  it("evaluates a valid SHORT as A with bearish context", () => {
    const result = evaluateSignalQuality(validInput({
      direction: "SHORT",
      stopLoss: 105,
      takeProfit: 90,
      marketRegime: "BEAR",
    }));

    expect(result.direction).toBe("SHORT");
    expect(result.qualityGrade).toBe("A");
    expect(result.marketContext.alignment).toBe("SUPPORTIVE");
    expect(result.riskLevel).toBe("STANDARD");
  });

  it("returns NO_SIGNAL as IGNORE with no applicable risk", () => {
    const result = evaluateSignalQuality(validInput({ direction: "NO_SIGNAL" }));

    expect(result).toMatchObject({
      direction: "NO_SIGNAL",
      qualityGrade: "IGNORE",
      qualityScore: 0,
      qualityStatus: "IGNORED",
      riskLevel: "NOT_APPLICABLE",
      humanDecisionRequired: true,
      automaticTrading: false,
    });
    expect(result.explanations).toContain("NO_SIGNAL");
  });

  it.each([
    ["open candle", { closedCandle: false }, "CANDLE_NOT_CLOSED"],
    ["stale data", { freshData: false }, "DATA_STALE"],
    ["incomplete identity", { identityComplete: false }, "SIGNAL_IDENTITY_INCOMPLETE"],
    ["incomplete strategy snapshot", { strategySnapshotComplete: false }, "STRATEGY_SNAPSHOT_INCOMPLETE"],
  ])("fails closed for %s", (_name, override, reason) => {
    const result = evaluateSignalQuality(validInput(override));

    expect(result.qualityGrade).toBe("IGNORE");
    expect(result.qualityScore).toBe(SIGNAL_QUALITY_SCORE_BY_GRADE.IGNORE);
    expect(result.explanations).toContain(reason);
    expect(result.automaticTrading).toBe(false);
  });

  it("fails closed for invalid LONG and SHORT geometry", () => {
    const long = evaluateSignalQuality(validInput({ stopLoss: 105 }));
    const short = evaluateSignalQuality(validInput({
      direction: "SHORT",
      stopLoss: 95,
      takeProfit: 90,
      marketRegime: "BEAR",
    }));

    expect(long.qualityGrade).toBe("IGNORE");
    expect(long.explanations).toContain("DIRECTIONAL_RISK_ORDER_INVALID");
    expect(short.qualityGrade).toBe("IGNORE");
    expect(short.explanations).toContain("DIRECTIONAL_RISK_ORDER_INVALID");
  });

  it("reports a risk flag and grade B for reward below risk", () => {
    const result = evaluateSignalQuality(validInput({ takeProfit: 103 }));

    expect(result.qualityGrade).toBe("B");
    expect(result.qualityScore).toBe(2);
    expect(result.riskLevel).toBe("CAUTION");
    expect(result.explanations).toContain("REWARD_BELOW_RISK");
  });

  it("reports adverse and unavailable context without changing direction", () => {
    const adverse = evaluateSignalQuality(validInput({ marketRegime: "BEAR" }));
    const unavailable = evaluateSignalQuality(validInput({ marketRegime: "UNKNOWN" }));

    expect(adverse).toMatchObject({ direction: "LONG", qualityGrade: "C", qualityScore: 1 });
    expect(adverse.marketContext.alignment).toBe("ADVERSE");
    expect(unavailable).toMatchObject({ direction: "LONG", qualityGrade: "C", qualityScore: 1 });
    expect(unavailable.marketContext.alignment).toBe("UNAVAILABLE");
  });

  it("keeps directional assessment and market context as separate pure steps", () => {
    expect(assessLongQuality({ referencePrice: 100, stopLoss: 95, takeProfit: 110 })).toEqual({
      direction: "LONG",
      valid: true,
      explanations: [],
    });
    expect(assessShortQuality({ referencePrice: 100, stopLoss: 105, takeProfit: 90 })).toEqual({
      direction: "SHORT",
      valid: true,
      explanations: [],
    });
    expect(deriveMarketContextAdvisory("LONG", "BULL").alignment).toBe("SUPPORTIVE");
    expect(deriveMarketContextAdvisory("SHORT", "BULL").alignment).toBe("ADVERSE");
  });

  it("normalizes malformed numeric inputs to unavailable risk", () => {
    for (const override of [
      { referencePrice: null },
      { stopLoss: Number.NaN },
      { takeProfit: Number.POSITIVE_INFINITY },
      { stopLoss: 0 },
    ]) {
      const result = evaluateSignalQuality(validInput(override));
      expect(result.qualityGrade).toBe("IGNORE");
      expect(result.riskLevel).toBe("UNAVAILABLE");
      expect(result.explanations).toContain("RISK_GEOMETRY_UNAVAILABLE");
    }
  });

  it("exposes the class evaluator and keeps it deterministic", () => {
    const evaluator = new SignalQualityEvaluator();
    const input = validInput({ marketRegime: "NEUTRAL" });

    expect(evaluator.evaluate(input)).toEqual(signalQualityEvaluator.evaluate(input));
    expect(evaluator.evaluate(input)).toEqual(evaluator.evaluate(input));
  });

  it("does not expose execution, sizing, or automatic stop behavior", () => {
    const result = evaluateSignalQuality(validInput());
    const forbiddenKeys = ["placeOrder", "executeOrder", "positionSize", "leverage", "closePosition"];

    for (const key of forbiddenKeys) {
      expect(result).not.toHaveProperty(key);
    }
    expect(result.humanDecisionRequired).toBe(true);
    expect(result.automaticTrading).toBe(false);
  });

  it("keeps quality scores as a non-economic ordinal mapping", () => {
    expect(SIGNAL_QUALITY_SCORE_BY_GRADE).toEqual({ A: 3, B: 2, C: 1, IGNORE: 0 });
  });

  it("returns neutral context as a valid middle-grade advisory", () => {
    const result = evaluateSignalQuality(validInput({ marketRegime: "NEUTRAL" }));

    expect(result).toMatchObject({
      qualityGrade: "B",
      qualityScore: 2,
      qualityStatus: "ADVISORY_VALID",
    });
    expect(result.marketContext.alignment).toBe("NEUTRAL");
  });
});
