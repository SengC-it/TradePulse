import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  R22_ALERT_INTELLIGENCE_ACCEPTED_SOURCE,
  R22_ALERT_INTELLIGENCE_BASE_BRANCH,
  R22_ALERT_INTELLIGENCE_BRANCH,
  R22_ALERT_INTELLIGENCE_CONTRACT_PATH,
  R22_ALERT_INTELLIGENCE_DESIGN_PATH,
  R22_ALERT_INTELLIGENCE_GOVERNANCE,
  R22_ALERT_INTELLIGENCE_PHASE,
  R22_ALERT_INTELLIGENCE_ROUND_ID,
  buildR22AlertIntelligence,
  isR22AlertIntelligenceDesignOnlyGovernance,
  type R22AlertIntelligenceInput,
} from "@/lib/research/alert-intelligence-protocol";

type JsonRecord = Record<string, unknown>;

const contractPath = path.join(process.cwd(), R22_ALERT_INTELLIGENCE_CONTRACT_PATH);
const designPath = path.join(process.cwd(), R22_ALERT_INTELLIGENCE_DESIGN_PATH);
const protocolPath = path.join(process.cwd(), "src/lib/research/alert-intelligence-protocol.ts");

function loadContract(): JsonRecord {
  return JSON.parse(readFileSync(contractPath, "utf8")) as JsonRecord;
}

function validInput(overrides: Partial<R22AlertIntelligenceInput> = {}): R22AlertIntelligenceInput {
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
      triggerExplanation: "Existing formal advisory predicate matched.",
    },
    quality: {
      status: "AVAILABLE",
      grade: "A",
      score: 3,
      explanations: ["Existing quality snapshot."],
    },
    marketContext: {
      status: "AVAILABLE",
      regime: "BULL",
      alignment: "SUPPORTIVE",
      explanation: "Existing market context is directionally supportive.",
    },
    riskAdvisory: {
      status: "AVAILABLE",
      level: "STANDARD",
      explanation: "Existing risk advisory is standard.",
    },
    historicalReview: {
      status: "AVAILABLE",
      reviewStatus: "IDENTITY_ONLY",
      contextSummary: "Identity-only historical review metadata is available.",
    },
    ...overrides,
  };
}

describe("Round-022 Alert Intelligence design-only protocol", () => {
  it("binds the accepted source, branch, and design-only phase", () => {
    const contract = loadContract();
    expect(contract.researchRoundId).toBe(R22_ALERT_INTELLIGENCE_ROUND_ID);
    expect(contract.phase).toBe(R22_ALERT_INTELLIGENCE_PHASE);
    expect(contract.branch).toBe(R22_ALERT_INTELLIGENCE_BRANCH);
    expect(contract.acceptedResearchSource).toEqual({
      branch: R22_ALERT_INTELLIGENCE_BASE_BRANCH,
      commit: R22_ALERT_INTELLIGENCE_ACCEPTED_SOURCE,
      requiredBaseHead: R22_ALERT_INTELLIGENCE_ACCEPTED_SOURCE,
    });
  });

  it("presents complete LONG and SHORT snapshots without changing direction", () => {
    const long = buildR22AlertIntelligence(validInput());
    const short = buildR22AlertIntelligence(validInput({
      signal: {
        ...validInput().signal,
        direction: "SHORT",
        identity: { ...validInput().signal.identity!, direction: "SHORT" },
      },
      marketContext: {
        status: "AVAILABLE",
        regime: "BEAR",
        alignment: "SUPPORTIVE",
        explanation: "Existing market context is directionally supportive.",
      },
    }));

    expect(long).toMatchObject({
      direction: "LONG",
      qualityGrade: "A",
      qualityScore: 3,
      priority: "P1",
      notificationImportance: "HIGH",
      attentionRank: 1,
      confidence: "HIGH",
      humanDecisionRequired: true,
      automaticTrading: false,
    });
    expect(short.direction).toBe("SHORT");
    expect(short.qualityGrade).toBe("A");
    expect(short.priority).toBe("P1");
  });

  it("suppresses NO_SIGNAL and incomplete identity fail-closed", () => {
    const noSignal = buildR22AlertIntelligence(validInput({
      signal: { direction: "NO_SIGNAL", identity: null, triggerExplanation: null },
    }));
    const incomplete = buildR22AlertIntelligence(validInput({
      signal: { ...validInput().signal, identity: null },
    }));

    for (const result of [noSignal, incomplete]) {
      expect(result).toMatchObject({
        presentationStatus: "SUPPRESSED",
        qualityGrade: "IGNORE",
        priority: "IGNORE",
        notificationImportance: "DO_NOT_NOTIFY",
        attentionRank: null,
        confidence: "UNAVAILABLE",
        humanDecisionRequired: true,
        automaticTrading: false,
      });
    }
  });

  it("degrades credibility when quality, context, or risk metadata is missing", () => {
    const result = buildR22AlertIntelligence(validInput({
      quality: { status: "MISSING", grade: null, score: null, explanations: [] },
      marketContext: { status: "MISSING", regime: null, alignment: null, explanation: null },
      riskAdvisory: { status: "MISSING", level: null, explanation: null },
    }));

    expect(result).toMatchObject({
      presentationStatus: "DEGRADED",
      qualityGrade: "IGNORE",
      qualityScore: null,
      priority: "P3",
      notificationImportance: "LOW",
      attentionRank: 3,
      confidence: "LOW",
    });
    expect(result.humanReviewNotes).toEqual(expect.arrayContaining([
      "QUALITY_SNAPSHOT_MISSING",
      "MARKET_CONTEXT_MISSING",
      "RISK_ADVISORY_MISSING",
    ]));
  });

  it("uses deterministic attention priority without future or economic inputs", () => {
    const input = validInput({
      quality: { status: "AVAILABLE", grade: "B", score: 2, explanations: [] },
      marketContext: {
        status: "AVAILABLE",
        regime: "NEUTRAL",
        alignment: "NEUTRAL",
        explanation: "Context is neutral.",
      },
      riskAdvisory: { status: "AVAILABLE", level: "CAUTION", explanation: "Review risk geometry." },
    });
    expect(buildR22AlertIntelligence(input)).toEqual(buildR22AlertIntelligence(input));
    expect(buildR22AlertIntelligence(input)).toMatchObject({
      priority: "P2",
      notificationImportance: "NORMAL",
      attentionRank: 2,
      confidence: "MEDIUM",
    });
  });

  it("answers trigger, environment, risk, and historical explanation questions", () => {
    const result = buildR22AlertIntelligence(validInput());

    expect(result.explanation).toEqual({
      whyTriggered: "Existing formal advisory predicate matched.",
      currentEnvironment: "Existing market context is directionally supportive.",
      risk: "Existing risk advisory is standard.",
      historicalReference: "Identity-only historical review metadata is available.",
    });
    expect(result.riskExplanation).toBe(result.explanation.risk);
    expect(result.historicalContext).toBe(result.explanation.historicalReference);
  });

  it("discloses missing historical metadata without inferring an outcome", () => {
    const result = buildR22AlertIntelligence(validInput({
      historicalReview: { status: "MISSING", reviewStatus: null, contextSummary: null },
    }));

    expect(result.historicalContext).toContain("unavailable");
    expect(result.humanReviewNotes).toContain("HISTORICAL_REVIEW_METADATA_MISSING");
    expect(result.priority).toBe("P1");
  });

  it("keeps email and web as presentation consumers only", () => {
    const contract = loadContract();
    const presentation = contract.emailWebPresentation as JsonRecord;
    expect(presentation).toMatchObject({
      status: "DATA_SHAPE_ONLY",
      productionUiChanged: false,
      smtpChanged: false,
      routeChanged: false,
      schedulerChanged: false,
      executionControlsAllowed: false,
    });
    expect(contract.scope).toMatchObject({ humanDecisionRequired: true, automaticTrading: false });
  });

  it("has no data, outcome, or execution access path", () => {
    const source = readFileSync(protocolPath, "utf8");
    expect(source).not.toMatch(/fetch\s*\(|supabase|tp_signal_results|forwardReturn|pnl/i);
    expect(source).not.toMatch(/placeOrder|executeOrder|positionSize|leverage|closePosition/i);
    const forbidden = loadContract().forbiddenOperations as string[];
    expect(forbidden).toEqual(expect.arrayContaining([
      "PERFORMANCE",
      "BACKTEST",
      "SELECTION",
      "ECONOMIC_EVALUATION",
      "NEW_MARKET_DATA_ACQUISITION",
      "AUTOMATIC_TRADING",
    ]));
  });

  it("freezes design-only governance and no performance ledger", () => {
    const contract = loadContract();
    expect(isR22AlertIntelligenceDesignOnlyGovernance(R22_ALERT_INTELLIGENCE_GOVERNANCE)).toBe(true);
    expect(contract.governance).toMatchObject({
      designOnly: true,
      implementationAuthorized: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      performanceExecuted: false,
      backtestExecuted: false,
      selectionExecuted: false,
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

  it("documents the design-only stop boundary", () => {
    const markdown = readFileSync(designPath, "utf8");
    expect(markdown).toContain("Alert Intelligence Contract");
    expect(markdown).toContain("Priority");
    expect(markdown).toContain("humanDecisionRequired=true");
    expect(markdown).toContain("automaticTrading=false");
    expect(markdown).toContain("STOP_PENDING_DESIGN_ACCEPTANCE");
  });
});
