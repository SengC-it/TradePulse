import { describe, expect, it } from "vitest";

import {
  M3_R7_CANDIDATE_IDS,
  M3_R7_CONTROL_ID,
  M3_R7_PERFORMANCE_LOCK,
  M3_R7_RESEARCH_END_ISO,
  M3_R7_RESEARCH_RANGE,
  M3_R7_RESEARCH_ROUND_ID,
  R7_CANDIDATE_REGISTRY,
  R7_DATA_CONTRACT,
  R7_EXECUTION_CONTRACT,
  R7_GOVERNANCE,
  R7_MODEL_CONTRACT,
  R7_PROTOCOL_MACHINE_RECORD,
} from "../src/lib/research/m3-r7-round-007-protocol.ts";
import { R7_PLAN, validateR7Plan } from "../src/lib/research/m3-r7-round-007-plan.ts";
import { R7_MACHINE_RECORD, validateR7MachineRecord } from "../src/lib/research/selection-gates-round-007.ts";

const EXPECTED_CANDIDATES = [
  "R7-R1-REGIME-EXPECTANCY-ROUTER",
  "R7-E1-PULLBACK-RECLAIM",
  "R7-E2-BREAKOUT-RETEST",
  "R7-S1-CALIBRATED-SCORE-V2",
  "R7-C1-RECLAIM-CALIBRATED-SCORE-V2",
] as const;

describe("M3-R7 Round-007 protocol freeze", () => {
  it("freezes exactly five candidates and one variant per candidate", () => {
    expect(M3_R7_CANDIDATE_IDS).toEqual(EXPECTED_CANDIDATES);
    expect(R7_CANDIDATE_REGISTRY).toHaveLength(5);
    expect(new Set(R7_CANDIDATE_REGISTRY.map((candidate) => candidate.variantId)).size).toBe(5);
    expect(R7_CANDIDATE_REGISTRY.map((candidate) => candidate.candidateId)).toEqual(EXPECTED_CANDIDATES);
    expect(R7_CANDIDATE_REGISTRY.filter((candidate) => candidate.composition === "PREDECLARED_COMBINATION").map((candidate) => candidate.candidateId)).toEqual([
      "R7-C1-RECLAIM-CALIBRATED-SCORE-V2",
    ]);
  });

  it("freezes the seen-data boundary, public-data policy, and milestone status", () => {
    expect(M3_R7_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-007");
    expect(M3_R7_RESEARCH_END_ISO).toBe("2026-08-15T23:59:59.999Z");
    expect(M3_R7_RESEARCH_RANGE.classification).toBe("RESEARCH_AVAILABLE_SEEN_DATA");
    expect(M3_R7_CONTROL_ID).toBe("R7-CONTROL-BASELINE-001");
    expect(M3_R7_PERFORMANCE_LOCK).toBe("FIRST_M3_R7_PERFORMANCE_RESULT_GENERATED");
    expect(R7_DATA_CONTRACT.provider).toBe("binance-usdm-public");
    expect(R7_EXECUTION_CONTRACT.strategyVersion).toBe("baseline-001");
    expect(R7_EXECUTION_CONTRACT.backtestPolicyVersion).toBe("bt-policy-003");
    expect(R7_EXECUTION_CONTRACT.noProductionExecution).toBe(true);
    expect(R7_GOVERNANCE.noPrivateBinanceApi).toBe(true);
    expect(R7_GOVERNANCE.noAutomaticTrading).toBe(true);
    expect(R7_GOVERNANCE.validationCannotFitOrTune).toBe(true);
    expect(R7_PROTOCOL_MACHINE_RECORD.performanceExecutionSourceSha).toBeNull();
    expect(R7_MACHINE_RECORD.baseline002Status).toBe("NOT_FROZEN");
    expect(R7_MACHINE_RECORD.m3JStatus).toBe("BLOCKED");
    expect(R7_MACHINE_RECORD.m4Status).toBe("NOT_STARTED");
  });

  it("freezes the ten-feature model contract and the fixed ridge rule", () => {
    expect(R7_MODEL_CONTRACT.lambda).toBe(10);
    expect(R7_MODEL_CONTRACT.featureNames).toHaveLength(10);
    expect(R7_MODEL_CONTRACT.fitScope).toBe("EACH_FOLD_RESEARCH_ONLY");
    expect(R7_MODEL_CONTRACT.standardizationScope).toBe("EACH_FOLD_RESEARCH_ONLY");
    expect(R7_MODEL_CONTRACT.validationUse).toContain("NO_REFIT");
    expect(R7_MODEL_CONTRACT.noLambdaSearch).toBe(true);
    expect(R7_MODEL_CONTRACT.noOptimizer).toBe(true);
  });

  it("validates the frozen protocol, Gate, and Plan machine records", () => {
    expect(() => validateR7Plan()).not.toThrow();
    expect(() => validateR7MachineRecord()).not.toThrow();
    expect(R7_PLAN.performance.status).toBe("NOT_GENERATED");
    expect(R7_PLAN.performance.authorization).toBe("NOT_AUTHORIZED");
  });
});
