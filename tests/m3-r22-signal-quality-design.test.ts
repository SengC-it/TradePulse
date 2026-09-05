import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  R22_CONTEXT_ALIGNMENTS,
  R22_DIRECTION_VALUES,
  R22_DESIGN_GATES,
  R22_DESIGN_GOVERNANCE,
  R22_MARKET_REGIMES,
  R22_QUALITY_GRADES,
  R22_RISK_STATES,
  ROUND_022_ACCEPTED_SOURCE,
  ROUND_022_ACCEPTED_SOURCE_BRANCH,
  ROUND_022_BRANCH,
  ROUND_022_DESIGN_JSON_PATH,
  ROUND_022_DESIGN_MARKDOWN_PATH,
  ROUND_022_PHASE,
  ROUND_022_RESEARCH_ROUND_ID,
  assessR22SignalQuality,
  deriveR22MarketContext,
  deriveR22RiskGeometry,
  isR22DesignOnlyGovernance,
} from "@/lib/research/m3-r22-signal-quality-design-protocol";

type JsonRecord = Record<string, unknown>;

const DESIGN_PATH = path.join(process.cwd(), ROUND_022_DESIGN_JSON_PATH);
const MARKDOWN_PATH = path.join(process.cwd(), ROUND_022_DESIGN_MARKDOWN_PATH);

function loadDesign(): JsonRecord {
  return JSON.parse(readFileSync(DESIGN_PATH, "utf8")) as JsonRecord;
}

function validInput(overrides: Partial<Parameters<typeof assessR22SignalQuality>[0]> = {}) {
  return {
    direction: "LONG" as const,
    referencePrice: 100,
    stopLoss: 95,
    takeProfit: 110,
    closedCandle: true,
    freshData: true,
    identityComplete: true,
    strategySnapshotComplete: true,
    marketRegime: "BULL" as const,
    ...overrides,
  };
}

describe("Round-022 Signal Quality & Risk Advisory design-only protocol", () => {
  it("binds the exact accepted research source and branch", () => {
    const design = loadDesign();
    expect(design.researchRoundId).toBe(ROUND_022_RESEARCH_ROUND_ID);
    expect(design.phase).toBe(ROUND_022_PHASE);
    expect(design.branch).toBe(ROUND_022_BRANCH);
    expect(design.acceptedResearchSource).toEqual({
      branch: ROUND_022_ACCEPTED_SOURCE_BRANCH,
      commit: ROUND_022_ACCEPTED_SOURCE,
      requiredBaseHead: ROUND_022_ACCEPTED_SOURCE,
    });
  });

  it("freezes both directional outputs plus NO_SIGNAL and all quality grades", () => {
    expect(R22_DIRECTION_VALUES).toEqual(["LONG", "SHORT", "NO_SIGNAL"]);
    expect(R22_QUALITY_GRADES).toEqual(["A", "B", "C", "IGNORE"]);
    expect(R22_MARKET_REGIMES).toEqual(["BULL", "NEUTRAL", "BEAR", "UNKNOWN"]);
    expect(R22_CONTEXT_ALIGNMENTS).toContain("SUPPORTIVE");
    expect(R22_RISK_STATES).toEqual(["STANDARD", "CAUTION", "UNAVAILABLE", "NOT_APPLICABLE"]);
  });

  it("assigns grade A to a valid LONG with supportive context and standard geometry", () => {
    const result = assessR22SignalQuality(validInput());
    expect(result).toMatchObject({
      direction: "LONG",
      qualityGrade: "A",
      qualityStatus: "ADVISORY_VALID",
      humanDecisionRequired: true,
      automaticTrading: false,
      marketContext: { alignment: "SUPPORTIVE" },
      riskAdvisory: { state: "STANDARD", valid: true },
    });
  });

  it("assigns grade A to a valid SHORT with bearish supportive context", () => {
    const result = assessR22SignalQuality(validInput({
      direction: "SHORT",
      referencePrice: 100,
      stopLoss: 105,
      takeProfit: 90,
      marketRegime: "BEAR",
    }));
    expect(result.direction).toBe("SHORT");
    expect(result.qualityGrade).toBe("A");
    expect(result.marketContext.alignment).toBe("SUPPORTIVE");
  });

  it("returns IGNORE for NO_SIGNAL without manufacturing risk fields", () => {
    const result = assessR22SignalQuality(validInput({ direction: "NO_SIGNAL" }));
    expect(result.qualityGrade).toBe("IGNORE");
    expect(result.qualityStatus).toBe("IGNORED");
    expect(result.riskAdvisory.state).toBe("NOT_APPLICABLE");
    expect(result.marketContext.alignment).toBe("NOT_APPLICABLE");
  });

  it.each([
    ["open candle", { closedCandle: false }],
    ["stale data", { freshData: false }],
    ["incomplete identity", { identityComplete: false }],
    ["incomplete strategy snapshot", { strategySnapshotComplete: false }],
  ])("returns IGNORE for %s", (_name, override) => {
    const result = assessR22SignalQuality(validInput(override));
    expect(result.qualityGrade).toBe("IGNORE");
    expect(result.qualityStatus).toBe("IGNORED");
  });

  it("applies direction-aware risk ordering for LONG and SHORT", () => {
    expect(deriveR22RiskGeometry(validInput())).toMatchObject({
      valid: true,
      state: "STANDARD",
      riskDistance: 5,
      rewardDistance: 10,
      riskRewardRatio: 2,
    });
    expect(deriveR22RiskGeometry(validInput({
      direction: "SHORT",
      stopLoss: 105,
      takeProfit: 90,
    })).valid).toBe(true);
  });

  it.each([
    ["LONG stop above reference", { stopLoss: 105, takeProfit: 110 }],
    ["SHORT target above reference", { direction: "SHORT" as const, stopLoss: 105, takeProfit: 110 }],
    ["missing price", { referencePrice: null }],
  ])("returns IGNORE for %s", (_name, override) => {
    const result = assessR22SignalQuality(validInput(override));
    expect(result.qualityGrade).toBe("IGNORE");
    expect(result.riskAdvisory.valid).toBe(false);
  });

  it("assigns grade B for neutral context or a valid risk caution", () => {
    expect(assessR22SignalQuality(validInput({ marketRegime: "NEUTRAL" })).qualityGrade).toBe("B");
    expect(assessR22SignalQuality(validInput({ takeProfit: 103 })).qualityGrade).toBe("B");
    expect(assessR22SignalQuality(validInput({ takeProfit: 103 })).riskAdvisory.state).toBe("CAUTION");
  });

  it("assigns grade C for adverse or unavailable context while preserving direction", () => {
    expect(assessR22SignalQuality(validInput({ marketRegime: "BEAR" })).qualityGrade).toBe("C");
    const unknown = assessR22SignalQuality(validInput({ marketRegime: "UNKNOWN" }));
    expect(unknown.qualityGrade).toBe("C");
    expect(unknown.direction).toBe("LONG");
    expect(unknown.marketContext.alignment).toBe("UNAVAILABLE");
  });

  it("maps LONG and SHORT market context without changing their directions", () => {
    expect(deriveR22MarketContext("LONG", "BULL").alignment).toBe("SUPPORTIVE");
    expect(deriveR22MarketContext("SHORT", "BEAR").alignment).toBe("SUPPORTIVE");
    expect(deriveR22MarketContext("LONG", "BEAR").alignment).toBe("ADVERSE");
    expect(deriveR22MarketContext("SHORT", "BULL").alignment).toBe("ADVERSE");
  });

  it("keeps the risk advisory separate from execution and outcome evaluation", () => {
    const design = loadDesign();
    const risk = design.riskAdvisory as JsonRecord;
    expect(risk.noPositionSizing).toBe(true);
    expect(risk.noAutomaticStopOrTarget).toBe(true);
    expect(risk.noOutcomeEvaluation).toBe(true);
    expect(design.scope).toMatchObject({ automaticTrading: false, humanDecisionRequired: true });
  });

  it("freezes identity-only historical review without result linkage", () => {
    const design = loadDesign();
    const review = design.historicalSignalReview as JsonRecord;
    expect(review.status).toBe("IDENTITY_ONLY_DESIGN");
    expect(review.source).toBe("public.tp_signal_advisories");
    expect(review.tpSignalResultsConsumed).toBe(false);
    expect(review.futureOutcomeValuesRead).toBe(false);
    expect(review.performanceMetricsGenerated).toBe(false);
  });

  it("contains all required design sections and no executable research stage", () => {
    const design = loadDesign();
    expect(design).toHaveProperty("signalQualityEngine");
    expect(design).toHaveProperty("longQualityAssessment");
    expect(design).toHaveProperty("shortQualityAssessment");
    expect(design).toHaveProperty("marketContextAdvisory");
    expect(design).toHaveProperty("riskAdvisory");
    expect(design).toHaveProperty("historicalSignalReview");
    expect(design.decision).toMatchObject({
      performanceAuthorized: false,
      backtestAuthorized: false,
      selectionAuthorized: false,
      nextStage: "STOP_PENDING_DESIGN_ACCEPTANCE",
    });
  });

  it("freezes design-only governance and no performance ledger", () => {
    const design = loadDesign();
    expect(isR22DesignOnlyGovernance(R22_DESIGN_GOVERNANCE)).toBe(true);
    expect(design.governance).toMatchObject({
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      performanceExecuted: false,
      backtestExecuted: false,
      selectionExecuted: false,
      parameterOptimizationExecuted: false,
      economicEvaluationExecuted: false,
      newMarketDataFetched: false,
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      automaticTrading: false,
      humanDecisionRequired: true,
    });
  });

  it("freezes exactly seven design gates and all are PASS", () => {
    const design = loadDesign();
    expect(R22_DESIGN_GATES.map((gate) => gate.id)).toEqual([
      "D01_SIGNAL_SCOPE",
      "D02_DIRECTIONAL_ASSESSMENT",
      "D03_QUALITY_GRADING",
      "D04_MARKET_CONTEXT_ADVISORY",
      "D05_RISK_ADVISORY",
      "D06_HISTORICAL_REVIEW_BOUNDARY",
      "D07_DESIGN_ONLY_GOVERNANCE",
    ]);
    expect((design.designGates as JsonRecord[]).every((gate) => gate.status === "PASS")).toBe(true);
  });

  it("documents no automatic trading in the design markdown", () => {
    const markdown = readFileSync(MARKDOWN_PATH, "utf8");
    expect(markdown).toContain("humanDecisionRequired=true");
    expect(markdown).toContain("automaticTrading=false");
    expect(markdown).toContain("No performance, backtest, selection");
  });
});
