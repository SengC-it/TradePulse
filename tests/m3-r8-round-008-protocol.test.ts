import { describe, expect, it } from "vitest";

import {
  M3_R8_CONTROL_ID,
  M3_R8_FREEZE_SOURCE_SHA,
  M3_R8_NO_CANDIDATE_OUTCOME,
  M3_R8_PERFORMANCE_LOCK,
  M3_R8_RESEARCH_END_ISO,
  M3_R8_RESEARCH_RANGE,
  M3_R8_RESEARCH_ROUND_ID,
  R8_CANDIDATE_IDS,
  R8_CANDIDATE_REGISTRY,
  R8_DATA_CONTRACT,
  R8_EXECUTION_CONTRACT,
  R8_MODEL_CONTRACT,
  R8_RESULT_AFFECTING_SPEC_DIFF_COUNT,
  R8_SELECTION_DEFINITIONS,
  R8_CANDIDATE_REGISTRY_SHA256,
  R8_FEATURE_SPEC_SHA256,
  R8_MODEL_SPEC_SHA256,
  R8_REGIME_SPEC_SHA256,
  R8_ENTRY_SPEC_SHA256,
  R8_SELECTION_GATE_SHA256,
  validateR8ProtocolMachineRecord,
} from "../src/lib/research/m3-r8-round-008-protocol.ts";
import { R8_PLAN, R8_PLAN_SHA256, validateR8Plan } from "../src/lib/research/m3-r8-round-008-plan.ts";

const EXPECTED_CANDIDATES = [
  "R7-R1-REGIME-EXPECTANCY-ROUTER",
  "R7-E1-PULLBACK-RECLAIM",
  "R7-E2-BREAKOUT-RETEST",
  "R7-S1-CALIBRATED-SCORE-V2",
  "R7-C1-RECLAIM-CALIBRATED-SCORE-V2",
] as const;

describe("M3-R8 strict protocol replay", () => {
  it("freezes R8 provenance without changing the five R7 candidate definitions", () => {
    expect(M3_R8_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-008");
    expect(M3_R8_RESEARCH_END_ISO).toBe("2026-08-15T23:59:59.999Z");
    expect(M3_R8_RESEARCH_RANGE.classification).toBe("RESEARCH_AVAILABLE_SEEN_DATA");
    expect(M3_R8_FREEZE_SOURCE_SHA).toBe("04d75215987c28822a4de9c1be30e41838a1adea");
    expect(M3_R8_CONTROL_ID).toBe("R7-CONTROL-BASELINE-001");
    expect(M3_R8_PERFORMANCE_LOCK).toBe("FIRST_M3_R8_PERFORMANCE_RESULT_GENERATED");
    expect(M3_R8_NO_CANDIDATE_OUTCOME).toBe("NO BASELINE-002 CANDIDATE — ROUND-008");
    expect(R8_CANDIDATE_IDS).toEqual(EXPECTED_CANDIDATES);
    expect(R8_CANDIDATE_REGISTRY).toHaveLength(5);
    expect(new Set(R8_CANDIDATE_REGISTRY.map((candidate) => candidate.variantId)).size).toBe(5);
  });

  it("keeps exact model, data, execution, gate, and result-affecting specifications", () => {
    expect(R8_MODEL_CONTRACT.lambda).toBe(10);
    expect(R8_MODEL_CONTRACT.minimumPredictedNetR).toBe(0.05);
    expect(R8_MODEL_CONTRACT.featureNames).toHaveLength(10);
    expect(R8_MODEL_CONTRACT.fitScope).toBe("EACH_FOLD_RESEARCH_ONLY");
    expect(R8_DATA_CONTRACT.provider).toBe("binance-usdm-public");
    expect(R8_EXECUTION_CONTRACT.strategyVersion).toBe("baseline-001");
    expect(R8_EXECUTION_CONTRACT.backtestPolicyVersion).toBe("bt-policy-003");
    expect(R8_EXECUTION_CONTRACT.noProductionExecution).toBe(true);
    expect(R8_SELECTION_DEFINITIONS.selectionAlgorithm.stages).toEqual([
      "ELIGIBILITY",
      "IMPROVED_VALIDATION_FOLDS",
      "EXPECTANCY_INCLUSIVE_0_01_TIE_BAND",
      "COMPLEXITY",
      "PROFIT_FACTOR",
      "CANDIDATE_ID",
    ]);
    expect(R8_RESULT_AFFECTING_SPEC_DIFF_COUNT).toBe(0);
    for (const hash of [R8_CANDIDATE_REGISTRY_SHA256, R8_FEATURE_SPEC_SHA256, R8_REGIME_SPEC_SHA256, R8_ENTRY_SPEC_SHA256, R8_MODEL_SPEC_SHA256, R8_SELECTION_GATE_SHA256]) expect(hash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("validates the frozen machine record and plan before performance is authorized", () => {
    expect(() => validateR8ProtocolMachineRecord()).not.toThrow();
    expect(() => validateR8Plan()).not.toThrow();
    expect(R8_PLAN.performance.status).toBe("NOT_GENERATED");
    expect(R8_PLAN.performance.authorization).toBe("NOT_AUTHORIZED");
    expect(R8_PLAN.performance.executionSourceSha).toBeNull();
    expect(R8_PLAN.status.baseline002Status).toBe("NOT_FROZEN");
    expect(R8_PLAN.status.m3JStatus).toBe("BLOCKED");
    expect(R8_PLAN.status.m4Status).toBe("NOT_STARTED");
    expect(R8_PLAN_SHA256).toMatch(/^[0-9a-f]{64}$/u);
  });
});
