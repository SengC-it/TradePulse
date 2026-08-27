import { describe, expect, it } from "vitest";

import {
  M3_R6_PERFORMANCE_LOCK,
  M3_R6_POST_LOCK_INVALIDATION,
  M3_R6_RESEARCH_END_ISO,
  M3_R6_RESEARCH_RANGE,
  M3_R6_RESEARCH_ROUND_ID,
  R6_CANDIDATE_REGISTRY,
  R6_COMPLEXITY_COUNTING_RUBRIC,
  R6_COMPLEXITY_TUPLES,
  R6_DATA_CONTRACT,
  R6_EXECUTION_CONTRACTS,
  R6_FROZEN_FOLD_IDS,
  R6_FORMULA_DEFINITIONS,
  R6_GATE_INHERITANCE,
  R6_PROTOCOL_MACHINE_RECORD,
  R6_SYMBOLS,
  M3_R6_ROUND_006_CANDIDATE_IDS,
} from "../src/lib/research/m3-r6-round-006-protocol.ts";

const EXPECTED_CANDIDATE_IDS = [
  "R6-A1-COOLDOWN-12H",
  "R6-A2-COOLDOWN-24H",
  "R6-A3-COOLDOWN-48H",
  "R6-B1-TOP1-SCORE",
  "R6-B2-TOP2-SCORE",
  "R6-B3-TOP1-RELATIVE-STRENGTH",
  "R6-B4-TOP2-RELATIVE-STRENGTH",
  "R6-C1-TREND-FRESHNESS",
  "R6-C2-FRESHNESS-TOP1-SCORE",
  "R6-D1-BREAKOUT-QUALITY",
  "R6-D2-PULLBACK-BREAKOUT-QUALITY",
  "R6-D3-PULLBACK-BREAKOUT-TOP1",
] as const;

describe("M3-R6-B.1A Round-006 protocol freeze", () => {
  it("freezes the requested 12-candidate registry with one variant each", () => {
    expect(M3_R6_ROUND_006_CANDIDATE_IDS).toEqual(EXPECTED_CANDIDATE_IDS);
    expect(R6_CANDIDATE_REGISTRY).toHaveLength(EXPECTED_CANDIDATE_IDS.length);
    expect(new Set(R6_CANDIDATE_REGISTRY.map((candidate) => candidate.variantId)).size).toBe(12);
    expect(R6_CANDIDATE_REGISTRY.map((candidate) => candidate.family)).toEqual([
      "A", "A", "A", "B", "B", "B", "B", "C", "C", "D", "D", "D",
    ]);
    expect(R6_CANDIDATE_REGISTRY.every((candidate) => candidate.signalRule.length > 0)).toBe(true);
    expect(R6_CANDIDATE_REGISTRY.every((candidate) => candidate.dataRule.includes("CLOSED"))).toBe(true);
    expect(R6_CANDIDATE_REGISTRY.filter((candidate) => candidate.composition === "PREDECLARED_DUAL_CONFIRMATION").map((candidate) => candidate.candidateId)).toEqual([
      "R6-C2-FRESHNESS-TOP1-SCORE",
      "R6-D3-PULLBACK-BREAKOUT-TOP1",
    ]);
  });

  it("freezes the exact seen-data boundary, universe, folds, and unchanged execution policy", () => {
    expect(M3_R6_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-006");
    expect(M3_R6_RESEARCH_END_ISO).toBe("2026-08-15T23:59:59.999Z");
    expect(M3_R6_RESEARCH_RANGE.classification).toBe("RESEARCH_AVAILABLE_SEEN_DATA");
    expect(R6_SYMBOLS).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
    expect(R6_FROZEN_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(R6_DATA_CONTRACT.decisionTime).toContain("CLOSED_CANDLES_ONLY");
    expect(R6_DATA_CONTRACT.relativeStrengthHorizons).toEqual(["4h", "12h", "24h"]);
    expect(R6_EXECUTION_CONTRACTS.backtestPolicyVersion).toBe("bt-policy-003");
    expect(R6_EXECUTION_CONTRACTS.candidateEconomics).toContain("NO_SETTLEMENT_REWRITE");
  });

  it("freezes the predeclared selector formulas and forbids live-data tuning", () => {
    expect(R6_FORMULA_DEFINITIONS.cooldown).toContain("> cooldownHours");
    expect(R6_FORMULA_DEFINITIONS.scoreTopN).toContain("identical signalTime");
    expect(R6_FORMULA_DEFINITIONS.relativeStrength).toContain("symbolReturn - btcReturn");
    expect(R6_FORMULA_DEFINITIONS.trendFreshness).toContain("EMA20_1h");
    expect(R6_FORMULA_DEFINITIONS.breakoutQuality).toContain("breakoutStrength >= 17");
    expect(R6_FORMULA_DEFINITIONS.closedDataBoundary).toContain("no future candle");
    expect(R6_COMPLEXITY_COUNTING_RUBRIC.baselineModificationCount).toBe(0);
    expect(R6_COMPLEXITY_COUNTING_RUBRIC.candidateSpecificThresholds).toContain("NONE_ADDED");
    expect(R6_PROTOCOL_MACHINE_RECORD.governance.noTuning).toBe(true);
    expect(R6_PROTOCOL_MACHINE_RECORD.governance.noSweep).toBe(true);
    expect(R6_PROTOCOL_MACHINE_RECORD.governance.noOptimizer).toBe(true);
    expect(R6_PROTOCOL_MACHINE_RECORD.governance.performanceExecutionSourceSha).toBeNull();
    expect(M3_R6_PERFORMANCE_LOCK).toBe("FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED");
    expect(M3_R6_POST_LOCK_INVALIDATION).toBe("ROUND_006_INVALIDATION_REQUIRED");
    expect(R6_GATE_INHERITANCE.inheritedRound004GateSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(R6_GATE_INHERITANCE.inheritedRound005GateSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("uses fixed structural complexity tuples rather than a parameter sweep", () => {
    for (const candidate of R6_CANDIDATE_REGISTRY) {
      const tuple = R6_COMPLEXITY_TUPLES[candidate.candidateId];
      expect(tuple.newTunableThresholds).toBe(0);
      expect(tuple.modifiedBaselineRules).toBe(0);
      expect(tuple.mechanismFamiliesUsed).toBe(1);
    }
  });
});
