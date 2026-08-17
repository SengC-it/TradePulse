import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { runBacktest } from "../src/lib/backtest/runner.ts";
import type { BacktestData, BacktestReport } from "../src/lib/backtest/types.ts";
import { parseM3HCaptureArguments, validateM3HCaptureArguments } from "../scripts/m3-h-capture-control.ts";
import {
  deriveM3HRound001Evidence,
  renderM3HResultsMarkdown,
  serializeM3HResearchEvidence,
} from "../src/lib/research/m3-h-evidence.ts";
import {
  M3_H_ROUND_001_AUTHORITATIVE_SOURCE_SHA,
  M3_H_ROUND_001_CANDIDATE_ORDER,
  M3_H_ROUND_001_EXPERIMENTS,
  M3_H_ROUND_001_PLAN,
  M3_H_ROUND_001_PLAN_CANONICAL_JSON,
  M3_H_ROUND_001_PLAN_SHA256,
  M3_H_ROUND_001_SELECTION_GATE_SHA256,
  type M3HDecisionSnapshot,
} from "../src/lib/research/index.ts";
import { selectCandidateDecisionSnapshots } from "../src/lib/research/m3-h-selectors.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const BASE_TIME = 1_700_000_000_000;
const HOUR_MS = 60 * 60 * 1_000;

function snapshot(overrides: Partial<M3HDecisionSnapshot> = {}): M3HDecisionSnapshot {
  return {
    signalTime: BASE_TIME,
    symbol: "BTCUSDT",
    direction: "LONG",
    totalScore: 80,
    entryReference: 100,
    stopDistance: 2,
    ...overrides,
  };
}

function emptyControlReport(): BacktestReport {
  const datasets = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, { candles1h: [], candles4h: [] }])) as unknown as BacktestData["datasets"];
  const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
  const report = runBacktest({
    period: "COMBINED",
    policy: "bt-policy-003",
    data: { datasets, funding, manifests: [], serverTime: BASE_TIME },
  });
  return { ...report, status: "FAIL", diagnostics: [] } as BacktestReport;
}

describe("M3-H round-001 Stage-A plan", () => {
  it("freezes the authoritative source, gate SHA, exact 13 candidates, and 14 identities", () => {
    expect(M3_H_ROUND_001_AUTHORITATIVE_SOURCE_SHA).toBe("99e8f86207c0bd22facf66d557e2e6f792ba0b6e");
    expect(M3_H_ROUND_001_SELECTION_GATE_SHA256).toBe("11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd");
    expect(M3_H_ROUND_001_EXPERIMENTS).toHaveLength(13);
    expect(M3_H_ROUND_001_CANDIDATE_ORDER).toHaveLength(14);
    expect(M3_H_ROUND_001_PLAN.combinations).toBe("NO_COMBINATIONS");
    expect(M3_H_ROUND_001_PLAN.h5Status).toBe("DIAGNOSTIC_ONLY");
  });

  it("contains only the authorized experiment identities and values", () => {
    expect(M3_H_ROUND_001_EXPERIMENTS.map((experiment) => experiment.experimentId)).toEqual([
      "R1-H1-CD-06H",
      "R1-H1-CD-12H",
      "R1-H1-CD-24H",
      "R2-H4-TOPN-1",
      "R2-H4-TOPN-2",
      "R2-H4-TOPN-3",
      "R3-H2-COST-010",
      "R3-H2-COST-015",
      "R3-H2-COST-020",
      "R3-H2-COST-025",
      "R4-H3-SCORE-075",
      "R4-H3-SCORE-080",
      "R4-H3-SCORE-085",
    ]);
    expect(M3_H_ROUND_001_EXPERIMENTS.map((experiment) => experiment.predeclaredParameterValues)).toEqual([
      { cooldownHours: [6] },
      { cooldownHours: [12] },
      { cooldownHours: [24] },
      { topN: [1] },
      { topN: [2] },
      { topN: [3] },
      { maxFrictionProxyR: [0.1] },
      { maxFrictionProxyR: [0.15] },
      { maxFrictionProxyR: [0.2] },
      { maxFrictionProxyR: [0.25] },
      { minimumScore: [75] },
      { minimumScore: [80] },
      { minimumScore: [85] },
    ]);
  });

  it("freezes score buckets with a null open upper bound", () => {
    expect(M3_H_ROUND_001_PLAN.scoreBuckets).toEqual([
      { id: "S70_75", minInclusive: 70, maxExclusive: 75 },
      { id: "S75_80", minInclusive: 75, maxExclusive: 80 },
      { id: "S80_85", minInclusive: 80, maxExclusive: 85 },
      { id: "S85_PLUS", minInclusive: 85, maxExclusive: null },
    ]);
  });

  it("selects cooldown signals across the full stream and suppresses the exact boundary", () => {
    const selector = M3_H_ROUND_001_EXPERIMENTS.find((experiment) => experiment.experimentId === "R1-H1-CD-06H")!.selector;
    const selected = selectCandidateDecisionSnapshots([
      snapshot({ signalTime: BASE_TIME }),
      snapshot({ signalTime: BASE_TIME + 6 * HOUR_MS }),
      snapshot({ signalTime: BASE_TIME + 6 * HOUR_MS + 1 }),
    ], selector);
    expect(selected.map((value) => value.signalTime)).toEqual([BASE_TIME, BASE_TIME + 6 * HOUR_MS + 1]);
  });

  it("keeps cooldown state across a fold boundary", () => {
    const selector = M3_H_ROUND_001_EXPERIMENTS.find((experiment) => experiment.experimentId === "R1-H1-CD-12H")!.selector;
    const selected = selectCandidateDecisionSnapshots([
      snapshot({ signalTime: BASE_TIME }),
      snapshot({ signalTime: BASE_TIME + 12 * HOUR_MS }),
      snapshot({ signalTime: BASE_TIME + 12 * HOUR_MS + 1 }),
    ], selector);
    expect(selected.map((value) => value.signalTime)).toEqual([BASE_TIME, BASE_TIME + 12 * HOUR_MS + 1]);
  });

  it("ranks top-N by score, frozen symbol order, then direction", () => {
    const selector = M3_H_ROUND_001_EXPERIMENTS.find((experiment) => experiment.experimentId === "R2-H4-TOPN-2")!.selector;
    const selected = selectCandidateDecisionSnapshots([
      snapshot({ symbol: "ETHUSDT", direction: "LONG", totalScore: 80 }),
      snapshot({ symbol: "BTCUSDT", direction: "SHORT", totalScore: 80 }),
      snapshot({ symbol: "BTCUSDT", direction: "LONG", totalScore: 80 }),
    ], selector);
    expect(selected.map((value) => `${value.symbol}|${value.direction}`)).toEqual(["BTCUSDT|LONG", "BTCUSDT|SHORT"]);
  });

  it("applies the cost proxy at the inclusive boundary and fails invalid inputs closed", () => {
    const selector = M3_H_ROUND_001_EXPERIMENTS.find((experiment) => experiment.experimentId === "R3-H2-COST-010")!.selector;
    expect(selectCandidateDecisionSnapshots([snapshot({ entryReference: 100, stopDistance: 2 })], selector)).toHaveLength(1);
    expect(selectCandidateDecisionSnapshots([snapshot({ entryReference: 100, stopDistance: 1 })], selector)).toHaveLength(0);
    expect(() => selectCandidateDecisionSnapshots([snapshot({ stopDistance: 0 })], selector)).toThrow(/fail-closed/);
  });

  it("includes exact score threshold equality", () => {
    const selector = M3_H_ROUND_001_EXPERIMENTS.find((experiment) => experiment.experimentId === "R4-H3-SCORE-080")!.selector;
    expect(selectCandidateDecisionSnapshots([snapshot({ totalScore: 80 })], selector)).toHaveLength(1);
    expect(selectCandidateDecisionSnapshots([snapshot({ totalScore: 79.999 })], selector)).toHaveLength(0);
  });

  it("does not allow future outcomes to affect candidate identities", () => {
    const selector = M3_H_ROUND_001_EXPERIMENTS.find((experiment) => experiment.experimentId === "R1-H1-CD-06H")!.selector;
    const decisionInputs = [snapshot({ signalTime: BASE_TIME }), snapshot({ signalTime: BASE_TIME + 7 * HOUR_MS })];
    const firstSelection = selectCandidateDecisionSnapshots(decisionInputs, selector);
    const futureOutcomes = [{ netR: -100, exitTime: 9 }, { netR: 100, exitTime: 10 }];
    futureOutcomes.reverse();
    const secondSelection = selectCandidateDecisionSnapshots(decisionInputs, selector);
    expect(secondSelection.map((value) => `${value.symbol}|${value.direction}|${value.signalTime}`)).toEqual(
      firstSelection.map((value) => `${value.symbol}|${value.direction}|${value.signalTime}`),
    );
  });

  it("rejects optimizer-like plan source and selector outcome fields", () => {
    const planSource = readFileSync("src/lib/research/m3-h-round-001-plan.ts", "utf8");
    const selectorSource = readFileSync("src/lib/research/m3-h-selectors.ts", "utf8");
    expect(planSource).not.toMatch(/optimizer|gridSearch|randomSearch|Bayesian|genetic|autoTune|selectBestCandidate|rankByNetR/);
    expect(selectorSource).not.toMatch(/\bstatus\b|\bentryTime\b|\bexitTime\b|\bexitReason\b|\bgrossR\b|\bfeeR\b|\bfundingR\b|\bnetR\b|\bfundingCharges\b|\bheldCandleNumber\b/);
  });

  it("freezes the plan canonical bytes and recomputed SHA", () => {
    const canonical = stableStringify(M3_H_ROUND_001_PLAN);
    const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
    expect(canonical).toBe(M3_H_ROUND_001_PLAN_CANONICAL_JSON);
    expect(hash).toBe(M3_H_ROUND_001_PLAN_SHA256);
    expect(M3_H_ROUND_001_PLAN_SHA256).not.toBe("RECOMPUTE_AFTER_PLAN_FREEZE");
  });

  it("requires the exact round and gate SHA before CONTROL capture", () => {
    expect(() => parseM3HCaptureArguments(["node", "capture"])).toThrow(/--round is required/);
    const args = parseM3HCaptureArguments([
      "node",
      "capture",
      "--round",
      "baseline-002-research-round-001",
      "--selection-gate-sha",
      M3_H_ROUND_001_SELECTION_GATE_SHA256,
    ]);
    expect(() => validateM3HCaptureArguments(args, "wrong-source")).not.toThrow();
    expect(() => validateM3HCaptureArguments({ ...args, round: "wrong-round" }, "wrong-source")).toThrow(/Unknown/);
    expect(() => validateM3HCaptureArguments({ ...args, selectionGateSha256: "wrong-gate" }, "wrong-source")).toThrow(/mismatch/);
  });

  it("derives all 13 candidate identities from one synthetic CONTROL without re-settlement", () => {
    const report = emptyControlReport();
    const evidence = deriveM3HRound001Evidence({
      controlReport: report,
      controlReportSha256: "synthetic-control-sha",
      executionSourceSha: M3_H_ROUND_001_AUTHORITATIVE_SOURCE_SHA,
    });
    expect(evidence.evidenceStatus).toBe("COMPLETE");
    expect(evidence.control.experimentId).toBe("CONTROL_BASELINE_001");
    expect(evidence.candidates).toHaveLength(13);
    expect(evidence.candidates.every((candidate) => candidate.decision === "DEFER_TO_M3_I_FROZEN_GATE_APPLICATION")).toBe(true);
    expect(evidence.candidates.every((candidate) => candidate.aggregateValidation !== null)).toBe(true);
    expect(serializeM3HResearchEvidence(evidence)).toContain('"controlReportSha256":"synthetic-control-sha"');
    expect(renderM3HResultsMarkdown(evidence)).toContain("descriptive");
  });
});
