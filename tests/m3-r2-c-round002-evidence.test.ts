import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "../src/lib/config/constants.ts";
import { runBacktest } from "../src/lib/backtest/runner.ts";
import type {
  BacktestData,
  BacktestReport,
  BacktestSignalResult,
  BacktestSignalSnapshot,
} from "../src/lib/backtest/types.ts";
import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import type { Candle } from "../src/lib/market-data/types.ts";
import type {
  StrategyCandidate,
  StrategyEngineResult,
  StrategyEvaluation,
} from "../src/lib/strategy/types.ts";
import {
  BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
  M3_R2_ROUND_002_CANDIDATE_IDS,
  M3_R2_ROUND_002_RESEARCH_ROUND_ID,
  M3_R2_ROUND_002_SOURCE_SHA,
} from "../src/lib/research/selection-gates-round-002.ts";
import {
  M3_R2_ROUND_002_PLAN_SHA256,
  M3_R2_ROUND_002_CONTROL_ID,
  M3_R2_ROUND_002_SELECTOR_SPECS,
} from "../src/lib/research/m3-r2-round-002-plan.ts";
import {
  deriveM3R2CResearchEvidence,
  renderM3R2CResultsMarkdown,
  serializeM3R2CResearchEvidence,
  serializeM3R2DecisionSnapshotArtifact,
  validateM3R2CControlReport,
  validateM3R2CPlanConstants,
  createM3R2DecisionSnapshotArtifact,
  M3_R2_C_DATA_CLASSIFICATION,
  M3_R2_C_DECISION_SNAPSHOT_SCHEMA_VERSION,
  M3_R2_C_MAIN_BASE_SHA,
  M3_R2_C_REPORT_SCHEMA_VERSION,
  type M3R2CDecisionSnapshotArtifact,
  type M3R2CResearchEvidence,
} from "../src/lib/research/m3-r2-c-evidence.ts";
import type { M3R2DecisionSnapshot } from "../src/lib/research/m3-r2-decision-snapshot.ts";
import { m3R2DecisionSnapshotIdentity, selectM3R2CandidateSnapshots } from "../src/lib/research/m3-r2-selectors.ts";
import { getResearchFoldRoleRange } from "../src/lib/research/folds.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const HOUR = INTERVAL_MS["1h"];
const BASE_TIME = Date.parse("2024-01-02T03:59:59.999Z");
const SOURCE_SHA = "a".repeat(40);

type CurrentReport = Extract<BacktestReport, { schemaVersion: "m3-b-report-004" }>;
type DeriveInput = Parameters<typeof deriveM3R2CResearchEvidence>[0];

function emptyData(serverTime: number): BacktestData {
  return {
    datasets: Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, { candles1h: [], candles4h: [] }])) as unknown as BacktestData["datasets"],
    funding: Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"],
    manifests: [],
    serverTime,
  };
}

function emptyReport(serverTime = BASE_TIME + HOUR): CurrentReport {
  const report = runBacktest({ period: "COMBINED", policy: "bt-policy-003", data: emptyData(serverTime) });
  if (report.schemaVersion !== "m3-b-report-004") throw new Error("Synthetic report did not use schema 004.");
  return { ...report, diagnostics: [] } as CurrentReport;
}

function decisionSnapshot(overrides: Partial<M3R2DecisionSnapshot> = {}): M3R2DecisionSnapshot {
  return {
    signalTime: BASE_TIME,
    symbol: "ETHUSDT",
    direction: "LONG",
    btcRegime: "BTC_STRONG_BULL",
    symbol4hClose: 102,
    symbol4hEma50: 100,
    symbol4hEma200: 98,
    symbol4hAtr: 2,
    symbol4hEma200FiveBarsAgo: 97.8,
    nearestBaselinePullbackTouchAgeBars: 1,
    current1hQuoteVolume: 200,
    previous20Closed1hQuoteVolumeMean: 100,
    current1hClose: 105,
    previous3BreakoutExtreme: 100,
    current1hAtr: 2,
    breakoutMarginAtr: 2.5,
    ...overrides,
  };
}

function weakDecisionSnapshot(): M3R2DecisionSnapshot {
  return decisionSnapshot({
    signalTime: BASE_TIME + HOUR,
    symbol: "SOLUSDT",
    direction: "SHORT",
    btcRegime: "BTC_NEUTRAL",
    symbol4hClose: 100,
    symbol4hEma50: 101,
    symbol4hEma200: 102,
    symbol4hAtr: 2,
    symbol4hEma200FiveBarsAgo: 102,
    nearestBaselinePullbackTouchAgeBars: 0,
    current1hQuoteVolume: 0,
    previous20Closed1hQuoteVolumeMean: 100,
    current1hClose: 100,
    previous3BreakoutExtreme: 101,
    current1hAtr: 2,
    breakoutMarginAtr: -0.1,
  });
}

function backtestSnapshot(snapshot: M3R2DecisionSnapshot): BacktestSignalSnapshot {
  return {
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    signalTime: snapshot.signalTime,
    symbol: snapshot.symbol,
    direction: snapshot.direction,
    symbolRegime: snapshot.direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
    btcRegime: snapshot.btcRegime,
    entryReference: 100,
    stopReference: 99,
    takeProfitReference: 102,
    stopDistance: 1,
    stopAtr: 1,
    breakdown: {
      trendStrength: 40,
      pullbackQuality: 20,
      breakoutStrength: 20,
      volumeScore: 10,
      riskRewardScore: 10,
    },
    totalScore: 90,
    grade: "A",
  };
}

function resultFor(snapshot: M3R2DecisionSnapshot, status: BacktestSignalResult["status"] = "EXECUTED"): BacktestSignalResult {
  const executed = status === "EXECUTED";
  return {
    snapshot: backtestSnapshot(snapshot),
    status,
    entryTime: executed ? snapshot.signalTime + 1 : null,
    rawEntryPrice: executed ? 100 : null,
    entryFill: executed ? 100 : null,
    exitTime: executed ? snapshot.signalTime + 24 * HOUR : null,
    rawExitPrice: executed ? 101 : null,
    exitFill: executed ? 101 : null,
    heldCandleNumber: executed ? 24 : null,
    exitReason: executed ? "TIME_EXIT" : null,
    fundingCharges: [],
    fundingOrderAudits: [],
    fundingPnL: executed ? 0.1 : 0,
    priceR: executed ? 1 : null,
    feeR: executed ? -0.01 : null,
    fundingR: executed ? 0.1 : null,
    grossR: executed ? 1 : null,
    netR: executed ? 1.09 : null,
  };
}

function controlReportWithResults(serverTime = BASE_TIME + HOUR): CurrentReport {
  const first = decisionSnapshot();
  const second = weakDecisionSnapshot();
  const report = emptyReport(serverTime);
  return {
    ...report,
    signalResults: [resultFor(first), resultFor(second, "ENTRY_OUTSIDE_BRACKET")],
  } as CurrentReport;
}

function snapshotArtifactFor(report: CurrentReport, snapshots: readonly M3R2DecisionSnapshot[] = [decisionSnapshot(), weakDecisionSnapshot()]): M3R2CDecisionSnapshotArtifact {
  return {
    schemaVersion: M3_R2_C_DECISION_SNAPSHOT_SCHEMA_VERSION,
    researchRoundId: M3_R2_ROUND_002_RESEARCH_ROUND_ID,
    executionSourceSha: SOURCE_SHA,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R2_ROUND_002_PLAN_SHA256,
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    studyServerTime: report.studyServerTime,
    controlReportSha256: "control-sha",
    snapshotCount: snapshots.length,
    snapshots,
  };
}

function inputWithRound001(round001Evidence: unknown = {}): DeriveInput {
  const controlReport = controlReportWithResults();
  const decisionSnapshots = snapshotArtifactFor(controlReport);
  return {
    controlReport,
    controlReportSha256: "control-sha",
    decisionSnapshots,
    decisionSnapshotArtifactSha256: "snapshot-sha",
    round001Evidence,
    round001EvidenceSha256: "round001-sha",
    executionSourceSha: SOURCE_SHA,
    selectionGateSha256: BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R2_ROUND_002_PLAN_SHA256,
  };
}

function matchingInput(): DeriveInput {
  const first = deriveM3R2CResearchEvidence(inputWithRound001());
  return { ...inputWithRound001({ control: first.control }) };
}

function historicalCandle(symbol: ResearchSymbol, timeframe: "1h" | "4h", index: number, signalTime = BASE_TIME): Candle {
  const interval = INTERVAL_MS[timeframe];
  const closeTime = signalTime - (249 - index) * interval;
  const trend = timeframe === "4h" ? 200 + index : 100 + index * 0.1;
  const bump = timeframe === "1h" && index === 249 ? 2 : 0;
  const open = trend + bump;
  const close = trend + bump + 0.1;
  return {
    symbol,
    timeframe,
    openTime: closeTime - interval + 1,
    closeTime,
    open,
    high: Math.max(open, close) + 0.2,
    low: timeframe === "1h" && index === 248 ? trend - 5 : Math.min(open, close) - 0.2,
    close,
    volume: 10,
    quoteVolume: timeframe === "1h" && index === 249 ? 200 : 100,
    tradeCount: 10,
    takerBuyBaseVolume: 5,
    takerBuyQuoteVolume: 50,
  };
}

function historicalData(serverTime = BASE_TIME + HOUR): BacktestData {
  return {
    datasets: Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, {
      candles1h: Array.from({ length: 250 }, (_, index) => historicalCandle(symbol, "1h", index)),
      candles4h: Array.from({ length: 250 }, (_, index) => historicalCandle(symbol, "4h", index)),
    }])) as unknown as BacktestData["datasets"],
    funding: Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"],
    manifests: [],
    serverTime,
  };
}

function candidate(): StrategyCandidate {
  return {
    strategyVersion: STRATEGY_VERSION,
    symbol: "ETHUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_STRONG_BULL",
    entryReference: 100,
    stopReference: 99,
    takeProfitReference: 102,
    stopDistance: 1,
    stopAtr: 1,
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
  };
}

function artifactFixture(): { report: CurrentReport; data: BacktestData; candidate: StrategyCandidate } {
  const data = historicalData();
  const baselineCandidate = candidate();
  const report = emptyReport(data.serverTime);
  const signal = backtestSnapshot(decisionSnapshot());
  const result: BacktestSignalResult = {
    ...resultFor(decisionSnapshot()),
    snapshot: signal,
  };
  const evaluation: StrategyEvaluation = {
    strategyVersion: STRATEGY_VERSION,
    symbol: "ETHUSDT",
    direction: "LONG",
    status: "FORMAL_SIGNAL",
    reason: null,
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_STRONG_BULL",
    candidate: baselineCandidate,
  };
  const engineResult: StrategyEngineResult = {
    strategyVersion: STRATEGY_VERSION,
    btcRegime: "BTC_STRONG_BULL",
    evaluations: [evaluation],
    rankedCandidates: [baselineCandidate],
  };
  return {
    data,
    candidate: baselineCandidate,
    report: {
      ...report,
      evaluations: [{ period: "DEV", evaluationTime: BASE_TIME, engineResult, evaluations: [evaluation], formalSignalCount: 1 }],
      signalResults: [result],
    } as CurrentReport,
  };
}

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("M3-R2-C Round-002 evidence (75 dedicated tests)", () => {
  it("01 freezes the research round identity", () => expect(M3_R2_ROUND_002_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-002"));
  it("02 freezes the Round-002 gate SHA", () => expect(BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256).toBe("9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0"));
  it("03 freezes the Round-002 plan SHA", () => expect(M3_R2_ROUND_002_PLAN_SHA256).toBe("82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511"));
  it("04 freezes the protocol source SHA", () => expect(M3_R2_ROUND_002_SOURCE_SHA).toBe("26d18ef314594f0e79583da617a0d8c17e812be9"));
  it("05 freezes the M3-R2-B main base SHA", () => expect(M3_R2_C_MAIN_BASE_SHA).toBe("ce50fde82fdbed7c27668647915a2ea5b4c16f79"));
  it("06 preserves the frozen selector constants", () => expect(() => validateM3R2CPlanConstants()).not.toThrow());
  it("07 keeps the control registry separate from the nine candidates", () => expect(M3_R2_ROUND_002_CONTROL_ID).not.toBe(M3_R2_ROUND_002_CANDIDATE_IDS[0]));

  it("08 requires schema m3-b-report-004", () => expect(() => validateM3R2CControlReport({ ...emptyReport(), schemaVersion: "m3-b-report-003" } as BacktestReport)).toThrow());
  it("09 requires bt-policy-003", () => expect(() => validateM3R2CControlReport({ ...emptyReport(), backtestPolicyVersion: "bt-policy-002" } as unknown as BacktestReport)).toThrow());
  it("10 requires baseline-001", () => expect(() => validateM3R2CControlReport({ ...emptyReport(), strategyVersion: "other" } as unknown as BacktestReport)).toThrow());
  it("11 requires COMBINED", () => expect(() => validateM3R2CControlReport({ ...emptyReport(), period: "DEV" } as BacktestReport)).toThrow());
  it("12 requires a safe study clock", () => expect(() => validateM3R2CControlReport({ ...emptyReport(), studyServerTime: Number.NaN } as BacktestReport)).toThrow());
  it("13 rejects report diagnostics", () => expect(() => validateM3R2CControlReport({ ...emptyReport(), diagnostics: ["DATA_INCOMPLETE"] } as BacktestReport)).toThrow());
  it("14 rejects DATA_INCOMPLETE signal results", () => expect(() => validateM3R2CControlReport({ ...controlReportWithResults(), signalResults: [resultFor(decisionSnapshot(), "DATA_INCOMPLETE")] } as BacktestReport)).toThrow());
  it("15 rejects SETTLEMENT_AMBIGUOUS signal results", () => expect(() => validateM3R2CControlReport({ ...controlReportWithResults(), signalResults: [resultFor(decisionSnapshot(), "SETTLEMENT_AMBIGUOUS")] } as BacktestReport)).toThrow());
  it("16 allows economic FAIL as research evidence", () => expect(() => validateM3R2CControlReport({ ...emptyReport(), status: "FAIL" } as BacktestReport)).not.toThrow());

  it("17 captures the report evaluation candidate", () => {
    const fixture = artifactFixture();
    const artifact = createM3R2DecisionSnapshotArtifact({
      controlReport: fixture.report,
      data: fixture.data,
      executionSourceSha: SOURCE_SHA,
      selectionGateSha256: BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
      experimentPlanSha256: M3_R2_ROUND_002_PLAN_SHA256,
      controlReportSha256: "control-sha",
    });
    expect(artifact.snapshots[0]?.symbol).toBe("ETHUSDT");
  });
  it("18 does not call evaluateStrategy in the capture module", () => expect(source("scripts/m3-r2-c-capture-control.ts")).not.toMatch(/evaluateStrategy\s*\(/));
  it("19 uses buildHistoricalIndexes for as-of reconstruction", () => expect(source("src/lib/research/m3-r2-c-evidence.ts")).toContain("buildHistoricalIndexes"));
  it("20 uses the frozen decision snapshot extractor", () => expect(source("src/lib/research/m3-r2-c-evidence.ts")).toContain("extractM3R2DecisionSnapshot"));
  it("21 requires exact snapshot count parity", () => expect(() => deriveM3R2CResearchEvidence({ ...matchingInput(), decisionSnapshots: { ...matchingInput().decisionSnapshots, snapshotCount: 1 } })).toThrow());
  it("22 rejects a missing snapshot", () => expect(() => deriveM3R2CResearchEvidence({ ...matchingInput(), decisionSnapshots: { ...matchingInput().decisionSnapshots, snapshots: [], snapshotCount: 0 } })).toThrow());
  it("23 rejects an extra snapshot", () => expect(() => deriveM3R2CResearchEvidence({ ...matchingInput(), decisionSnapshots: { ...matchingInput().decisionSnapshots, snapshots: [decisionSnapshot(), weakDecisionSnapshot(), decisionSnapshot({ signalTime: BASE_TIME + 2 * HOUR })], snapshotCount: 3 } })).toThrow());
  it("24 rejects duplicate snapshot identity", () => expect(() => deriveM3R2CResearchEvidence({ ...matchingInput(), decisionSnapshots: { ...matchingInput().decisionSnapshots, snapshots: [decisionSnapshot(), decisionSnapshot()], snapshotCount: 2 } })).toThrow());
  it("25 orders snapshot identity by time, symbol, then direction", () => {
    const snapshots = [decisionSnapshot({ signalTime: BASE_TIME + HOUR, symbol: "BTCUSDT" }), decisionSnapshot()];
    const selected = selectM3R2CandidateSnapshots("R2-H6-STRICT-BTC", snapshots);
    expect(selected.map(m3R2DecisionSnapshotIdentity)).toEqual([m3R2DecisionSnapshotIdentity(decisionSnapshot()), m3R2DecisionSnapshotIdentity({ ...snapshots[0]!, signalTime: BASE_TIME + HOUR, symbol: "BTCUSDT" })]);
  });
  it("26 serializes the snapshot envelope deterministically", () => {
    const input = matchingInput();
    expect(serializeM3R2DecisionSnapshotArtifact(input.decisionSnapshots)).toBe(serializeM3R2DecisionSnapshotArtifact(input.decisionSnapshots));
  });
  it("27 produces deterministic snapshot bytes for the same artifact", () => {
    const input = matchingInput();
    expect(stableStringify(input.decisionSnapshots)).toBe(stableStringify(JSON.parse(serializeM3R2DecisionSnapshotArtifact(input.decisionSnapshots))));
  });

  it("28 passes identical Round-001 CONTROL parity", () => expect(matchingInput() && deriveM3R2CResearchEvidence(matchingInput()).controlParityStatus).toBe("PASS"));
  it("29 detects formal identity drift", () => {
    const first = deriveM3R2CResearchEvidence(inputWithRound001());
    const input = inputWithRound001({ control: { ...first.control, formalIdentitySha256: "drift" } });
    expect(deriveM3R2CResearchEvidence(input).controlParityStatus).toBe("CONTROL_DRIFT_REVIEW_REQUIRED");
  });
  it("30 detects executed identity drift", () => {
    const first = deriveM3R2CResearchEvidence(inputWithRound001());
    const input = inputWithRound001({ control: { ...first.control, executedIdentitySha256: "drift" } });
    expect(deriveM3R2CResearchEvidence(input).controlParityStatus).toBe("CONTROL_DRIFT_REVIEW_REQUIRED");
  });
  it("31 detects aggregate diagnostic drift", () => {
    const first = deriveM3R2CResearchEvidence(inputWithRound001());
    const input = inputWithRound001({ control: { ...first.control, aggregateValidation: { diagnostics: { ...first.control.aggregateValidation!.diagnostics, netR: 999 } } } });
    expect(deriveM3R2CResearchEvidence(input).controlParityStatus).toBe("CONTROL_DRIFT_REVIEW_REQUIRED");
  });
  it("32 detects individual fold diagnostic drift", () => {
    const first = deriveM3R2CResearchEvidence(inputWithRound001());
    const folds = first.control.folds.map((fold, index) => index === 0 ? { ...fold, diagnostics: { ...fold.diagnostics, netR: 999 } } : fold);
    const input = inputWithRound001({ control: { ...first.control, folds } });
    expect(deriveM3R2CResearchEvidence(input).controlParityStatus).toBe("CONTROL_DRIFT_REVIEW_REQUIRED");
  });
  it("33 does not compare studyServerTime for parity", () => {
    const input = matchingInput();
    const changedReport = controlReportWithResults(BASE_TIME + 2 * HOUR);
    const changedSnapshots = { ...input.decisionSnapshots, studyServerTime: changedReport.studyServerTime };
    expect(deriveM3R2CResearchEvidence({ ...input, controlReport: changedReport, decisionSnapshots: changedSnapshots }).controlParityStatus).toBe("PASS");
  });
  it("34 does not compare the Round-001 raw report SHA for parity", () => {
    const input = matchingInput();
    expect(deriveM3R2CResearchEvidence({ ...input, round001EvidenceSha256: "another-raw-sha" }).controlParityStatus).toBe("PASS");
  });

  it("35 derives exactly nine candidates", () => expect(deriveM3R2CResearchEvidence(matchingInput()).candidates).toHaveLength(9));
  it("36 preserves frozen candidate order", () => expect(deriveM3R2CResearchEvidence(matchingInput()).candidates.map((candidate) => candidate.candidateId)).toEqual(M3_R2_ROUND_002_CANDIDATE_IDS));
  it("37 keeps every candidate a strict snapshot subset", () => {
    const evidence = deriveM3R2CResearchEvidence(matchingInput());
    expect(evidence.candidates.every((candidate) => (candidate.selectedSnapshotCount ?? 99) < evidence.snapshotCount)).toBe(true);
  });
  it("38 rejects a selected identity absent from CONTROL", () => {
    const input = matchingInput();
    const absent = decisionSnapshot({ symbol: "BTCUSDT", signalTime: BASE_TIME + 5 * HOUR });
    expect(() => deriveM3R2CResearchEvidence({ ...input, decisionSnapshots: { ...input.decisionSnapshots, snapshots: [absent, weakDecisionSnapshot()] } })).toThrow();
  });
  it("39 inherits CONTROL outcomes into candidate diagnostics", () => {
    const evidence = deriveM3R2CResearchEvidence(matchingInput());
    expect(evidence.candidates[0]?.aggregateValidation?.diagnostics.netR).toBe(1.09);
  });
  it("40 does not construct a second BacktestSignalResult", () => expect(source("src/lib/research/m3-r2-c-evidence.ts")).toContain("controlResultsByIdentity.get"));
  it("41 does not import settlement recalculation", () => expect(source("src/lib/research/m3-r2-c-evidence.ts")).not.toContain("settleBacktestSignal"));
  it("42 does not import funding recalculation", () => expect(source("src/lib/research/m3-r2-c-evidence.ts")).not.toContain("resolveFundingCharges"));
  it("43 does not run candidate backtests", () => expect(source("src/lib/research/m3-r2-c-evidence.ts")).not.toMatch(/runBacktest\s*\(/));

  it("44 maps H6-H10 to the frozen selector registry", () => expect(M3_R2_ROUND_002_CANDIDATE_IDS).toHaveLength(9));
  it("45 keeps H7 EMA200-based", () => expect(M3_R2_ROUND_002_SELECTOR_SPECS.H7.LONG.closeDistanceNumerator).toBe("symbol4hClose - symbol4hEma200"));
  it("46 keeps H9 quote-volume based", () => expect(M3_R2_ROUND_002_SELECTOR_SPECS.H9.numerator).toBe("current1hQuoteVolume"));
  it("47 applies C1 as H6 AND H7", () => expect(selectM3R2CandidateSnapshots("R2-C1-BTC-STRONG-SYMBOL", [decisionSnapshot(), weakDecisionSnapshot()])).toHaveLength(1));
  it("48 applies C2 as H7 AND H8", () => expect(selectM3R2CandidateSnapshots("R2-C2-STRONG-SYMBOL-RECENT-PULLBACK", [decisionSnapshot(), weakDecisionSnapshot()])).toHaveLength(1));
  it("49 applies C3 as H7 AND H9 AND H10", () => expect(selectM3R2CandidateSnapshots("R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT", [decisionSnapshot(), weakDecisionSnapshot()])).toHaveLength(1));
  it("50 applies C4 as H6 AND H7 AND H9 AND H10", () => expect(selectM3R2CandidateSnapshots("R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT", [decisionSnapshot(), weakDecisionSnapshot()])).toHaveLength(1));

  it("51 emits aggregate diagnostics from the existing calculator", () => expect(deriveM3R2CResearchEvidence(matchingInput()).control.aggregateValidation?.diagnostics.formalSignals).toBe(2));
  it("52 emits the exact six validation fold ranges", () => expect(deriveM3R2CResearchEvidence(matchingInput()).control.folds.map((fold) => fold.range)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"].map((foldId) => getResearchFoldRoleRange(foldId as "F1" | "F2" | "F3" | "F4" | "F5" | "F6", "VALIDATION"))));
  it("53 derives deterministic candidate diagnostics", () => expect(serializeM3R2CResearchEvidence(deriveM3R2CResearchEvidence(matchingInput()))).toBe(serializeM3R2CResearchEvidence(deriveM3R2CResearchEvidence(matchingInput()))));
  it("54 derives expectancy delta against CONTROL", () => {
    const evidence = deriveM3R2CResearchEvidence(matchingInput());
    expect(evidence.candidates[0]?.aggregateExpectancyDeltaVsControl).toBe(0);
  });
  it("55 keeps the frozen +0.02 improved-fold definition", () => expect(evidenceGateText()).toContain("0.02"));
  it("56 keeps the frozen catastrophic-fold definition", () => expect(evidenceGateText()).toContain("executedTrades < 30"));
  it("57 records redundancy as N/A for all nine candidates", () => {
    const evidence = deriveM3R2CResearchEvidence(matchingInput());
    expect(evidence.candidates.every((candidate) => candidate.redundancyApplicability === "NOT_APPLICABLE" && candidate.redundancyRelativeReductionVsControl === null)).toBe(true);
  });

  it("58 uses the dedicated Round-002 evidence schema", () => expect(deriveM3R2CResearchEvidence(matchingInput()).schemaVersion).toBe(M3_R2_C_REPORT_SCHEMA_VERSION));
  it("59 records seen-data classification", () => expect(deriveM3R2CResearchEvidence(matchingInput()).dataClassification).toBe(M3_R2_C_DATA_CLASSIFICATION));
  it("60 COMPLETE defers to M3-R2-D gate application", () => expect(deriveM3R2CResearchEvidence(matchingInput()).decision).toBe("DEFER_TO_M3_R2_D_FROZEN_GATE_APPLICATION"));
  it("61 INCOMPLETE defers incomplete evidence", () => {
    const first = deriveM3R2CResearchEvidence(inputWithRound001());
    const evidence = deriveM3R2CResearchEvidence(inputWithRound001({ control: { ...first.control, formalIdentitySha256: "drift" } }));
    expect(evidence.decision).toBe("DEFER_INCOMPLETE_EVIDENCE");
  });
  it("62 does not apply an eligibility field", () => expect("eligibility" in deriveM3R2CResearchEvidence(matchingInput())).toBe(false));
  it("63 does not apply a selection field", () => expect("selectedCandidate" in deriveM3R2CResearchEvidence(matchingInput())).toBe(false));
  it("64 does not freeze baseline-002", () => expect(renderM3R2CResultsMarkdown(deriveM3R2CResearchEvidence(matchingInput()))).toContain("No selection, ranking, recommendation, or baseline-002 freeze"));
  it("65 serializes the evidence canonically", () => {
    const evidence = deriveM3R2CResearchEvidence(matchingInput());
    expect(serializeM3R2CResearchEvidence(evidence)).toBe(serializeM3R2CResearchEvidence(JSON.parse(serializeM3R2CResearchEvidence(evidence)) as M3R2CResearchEvidence));
  });

  it("66 offline derive imports no Binance client", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toMatch(/Binance/i));
  it("67 offline derive imports no historical loader", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toMatch(/historical-data|HistoricalDataLoader/i));
  it("68 offline derive imports no runBacktest", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toMatch(/runBacktest/));
  it("69 candidate derivation imports no settlement engine", () => expect(source("src/lib/research/m3-r2-c-evidence.ts")).not.toMatch(/from ["'].*backtest[\\/]settlement/));
  it("70 has no optimizer", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toMatch(/optimizer|optimize/i));
  it("71 has no grid search", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toMatch(/grid\s*search/i));
  it("72 does not use Date.now for provenance", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toContain("Date.now"));
  it("73 does not use Math.random", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toContain("Math.random"));
  it("74 does not implement M3-R2-D", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toMatch(/from .*m3-r2-d/i));
  it("75 does not implement M3-J or M4", () => expect(source("scripts/m3-r2-c-derive-evidence.ts")).not.toMatch(/m3-j|m4/i));
});

function evidenceGateText(): string {
  return `${stableStringify(M3_R2_ROUND_002_SELECTOR_SPECS)}${source("src/lib/research/m3-r2-c-evidence.ts")}`;
}
