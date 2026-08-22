import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { RESEARCH_FOLDS } from "../src/lib/research/folds.ts";
import {
  M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_SELECTION_GATE_SHA256,
  M3_R5_ROUND_005_SELECTION_GATES,
} from "../src/lib/research/selection-gates-round-005.ts";
import {
  M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY,
  M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES,
  M3_R6_ROUND_006_CANDIDATE_IDS,
  M3_R6_ROUND_006_CANDIDATE_REGISTRY,
  M3_R6_ROUND_006_CONTROL_ID,
  M3_R6_ROUND_006_DEFINITIONS,
  M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
  M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
  M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_MACHINE_RECORD,
  M3_R6_ROUND_006_PERFORMANCE_LOCK,
  M3_R6_ROUND_006_RESEARCH_ROUND_ID,
  M3_R6_ROUND_006_SELECTION_GATE_SHA256,
  M3_R6_ROUND_006_SELECTION_GATES,
  M3_R6_ROUND_006_VARIANT_REGISTRY,
  evaluateM3R6CandidateGates,
  selectM3R6Candidate,
  validateM3R6Round006MachineRecord,
  type M3R6CandidateGateInput,
  type M3R6SelectionCandidate,
} from "../src/lib/research/index.ts";
import {
  M3_R6_DATA_CLASSIFICATION,
  M3_R6_ROUND_006_PLAN,
  M3_R6_ROUND_006_PLAN_CANONICAL_JSON,
  M3_R6_ROUND_006_PLAN_SCHEMA_VERSION,
  M3_R6_ROUND_006_PLAN_SHA256,
  M3_R6_ROUND_006_METRIC_STATUS_CONTRACT,
  validateM3R6PerformanceAuthorization,
  validateM3R6Round006Plan,
} from "../src/lib/research/m3-r6-round-006-plan.ts";
import {
  M3_R6_PROTOCOL_VERSION,
  M3_R6_RESEARCH_END_ISO,
  R6_COMPLEXITY_TUPLES,
} from "../src/lib/research/m3-r6-round-006-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

function passingGateInput(
  overrides: Partial<M3R6CandidateGateInput> = {},
): M3R6CandidateGateInput {
  return {
    candidateId: M3_R6_ROUND_006_CANDIDATE_IDS[0],
    resultStatus: "COMPLETE",
    aggregateImprovement: 0.1,
    improvedValidationFolds: 4,
    catastrophicFolds: 0,
    netExpectancyR: 0.03,
    profitFactor: 1.2,
    profitFactorStatus: "NORMAL",
    topSymbolShareOfPositiveNetR: 0.5,
    largestSingleTradeShareOfPositiveNetR: 0.1,
    feeBurdenRatio: 0.75,
    formalSignals: 300,
    minimumFoldExecutedTrades: 30,
    ...overrides,
  };
}

function selectionCandidate(
  candidateId: M3R6SelectionCandidate["candidateId"],
  overrides: Partial<M3R6SelectionCandidate> = {},
): M3R6SelectionCandidate {
  return {
    candidateId,
    eligible: true,
    improvedValidationFolds: 4,
    aggregateValidationExpectancyR: 0.05,
    complexityTuple: R6_COMPLEXITY_TUPLES[candidateId],
    aggregateValidationProfitFactor: 1.3,
    ...overrides,
  };
}

describe("M3-R6-B.1B final registry, Gate, and Plan freeze", () => {
  it("freezes the exact four candidates and one variant each", () => {
    expect(M3_R6_ROUND_006_CANDIDATE_IDS).toEqual([
      "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
      "R6-H20-STRUCTURAL-TREND-CONTINUATION",
      "R6-H21-ECONOMIC-RANGE-IMPULSE",
      "R6-H22-PREDECLARED-REGIME-ROUTING",
    ]);
    expect(M3_R6_ROUND_006_VARIANT_REGISTRY).toEqual([
      {
        candidateId: "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
        variantId: "R6-H19-V1",
        mechanismFamily: "CROSS_SECTIONAL_RELATIVE_STRENGTH",
      },
      {
        candidateId: "R6-H20-STRUCTURAL-TREND-CONTINUATION",
        variantId: "R6-H20-V1",
        mechanismFamily: "STRUCTURAL_TREND_CONTINUATION",
      },
      {
        candidateId: "R6-H21-ECONOMIC-RANGE-IMPULSE",
        variantId: "R6-H21-V1",
        mechanismFamily: "ECONOMIC_RANGE_IMPULSE",
      },
      {
        candidateId: "R6-H22-PREDECLARED-REGIME-ROUTING",
        variantId: "R6-H22-V1",
        mechanismFamily: "PREDECLARED_REGIME_ROUTING",
      },
    ]);
    expect(M3_R6_ROUND_006_CANDIDATE_REGISTRY).toHaveLength(4);
    expect(M3_R6_ROUND_006_CANDIDATE_REGISTRY.every((candidate) => candidate.variantCount === 1)).toBe(true);
  });

  it("preserves the accepted B.1A protocol identity and complexity tuples", () => {
    expect(M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY).toEqual({
      sourceSha: "b8e03e34360ceaaf515882226940eba99bf89b1c",
      protocolPath: "src/lib/research/m3-r6-round-006-protocol.ts",
      protocolGitBlobSha: "11190e1c857071756cd26c744ac726650b64a01c",
      documentationPath: "docs/M3_R6_B1A_PROTOCOL.md",
      documentationGitBlobSha: "ff15bae2cf393e70a7ecd07f4acd5e819e97876c",
      testPath: "tests/m3-r6-b1a-protocol.test.ts",
      testGitBlobSha: "870d4eda92f1ba07d44e48d6d268e5e87acda7a5",
    });
    expect(M3_R6_ROUND_006_MACHINE_RECORD.complexityTuples).toEqual({
      "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH": { newRules: 6, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
      "R6-H20-STRUCTURAL-TREND-CONTINUATION": { newRules: 8, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
      "R6-H21-ECONOMIC-RANGE-IMPULSE": { newRules: 5, newTunableThresholds: 2, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
      "R6-H22-PREDECLARED-REGIME-ROUTING": { newRules: 7, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
    });
  });

  it("inherits every Round-005 numeric Gate value and comparison direction", () => {
    const gateNames = [
      ...M3_R6_ROUND_006_HARD_GATE_IDENTITIES,
      "complexityTieThreshold",
    ] as const;
    for (const gateName of gateNames) {
      expect(M3_R6_ROUND_006_SELECTION_GATES[gateName]).toEqual(
        M3_R5_ROUND_005_SELECTION_GATES[gateName],
      );
    }
    expect(M3_R6_ROUND_006_SELECTION_GATES.researchRoundId).toBe(M3_R6_ROUND_006_RESEARCH_ROUND_ID);
    expect(M3_R6_ROUND_006_SELECTION_GATES.sourceSha).toBe(M3_R6_ROUND_006_FREEZE_SOURCE_SHA);
    expect(M3_R6_ROUND_006_APPLICABLE_HARD_GATE_IDENTITIES).toHaveLength(10);
    expect(M3_R6_ROUND_006_HARD_GATE_IDENTITIES).toHaveLength(11);
    expect(M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256).toBe(
      M3_R5_ROUND_005_SELECTION_GATE_SHA256,
    );
    expect(M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256).toBe(
      M3_R5_ROUND_005_INHERITED_SELECTION_GATE_SHA256,
    );
    expect(M3_R6_ROUND_006_INHERITED_ROUND_005_SELECTION_GATE_SHA256).not.toBe(
      M3_R6_ROUND_006_INHERITED_ROUND_004_SELECTION_GATE_SHA256,
    );
  });

  it("freezes conjunctive eligibility and reports every registered Gate", () => {
    const evaluation = evaluateM3R6CandidateGates(passingGateInput());
    expect(evaluation.gateResults).toHaveLength(11);
    expect(evaluation.applicableGateCount).toBe(10);
    expect(evaluation.passedApplicableGateCount).toBe(10);
    expect(evaluation.failedGateIds).toEqual([]);
    expect(evaluation.eligibility).toBe("ELIGIBLE");
    expect(evaluation.gateResults.find((result) => result.gateId === "requiredRedundancyImprovement")).toMatchObject({
      status: "NOT_APPLICABLE",
      applicability: "NOT_APPLICABLE",
      actualValue: "NOT_APPLICABLE",
    });
  });

  it("handles incomplete and non-executed statuses fail-closed", () => {
    const statuses = [
      "DATA_INCOMPLETE",
      "ENTRY_UNAVAILABLE",
      "INVALID_STOP_GEOMETRY",
      "PERIOD_END_CENSORED",
      "NO_SIGNAL",
    ] as const;
    for (const resultStatus of statuses) {
      const evaluation = evaluateM3R6CandidateGates(
        passingGateInput({ resultStatus, aggregateImprovement: null, netExpectancyR: null }),
      );
      expect(evaluation.gateResults).toHaveLength(11);
      expect(evaluation.eligibility).not.toBe("ELIGIBLE");
      expect(evaluation.passedApplicableGateCount).toBe(0);
    }
    expect(M3_R6_ROUND_006_DEFINITIONS.resultStatusHandling.zeroTradeFold.gateOutcome).toBe(
      "CATASTROPHIC_AND_SAMPLE_GATES_FAIL",
    );
    expect(M3_R6_ROUND_006_DEFINITIONS.resultStatusHandling.insufficientSampleFold.gateOutcome).toBe(
      "CATASTROPHIC_AND_SAMPLE_GATES_FAIL",
    );
  });

  it("fails zero-trade and insufficient-sample metrics through the frozen Gates", () => {
    const zeroTrades = evaluateM3R6CandidateGates(
      passingGateInput({
        formalSignals: 0,
        minimumFoldExecutedTrades: 0,
        catastrophicFolds: 1,
        profitFactor: null,
        profitFactorStatus: "NO_TRADES",
      }),
    );
    expect(zeroTrades.eligibility).toBe("INELIGIBLE");
    expect(zeroTrades.failedGateIds).toEqual(expect.arrayContaining([
      "catastrophicFoldLimit",
      "minimumFormalSignals",
      "minimumExecutedTrades",
      "minimumProfitFactor",
    ]));
    const insufficient = evaluateM3R6CandidateGates(
      passingGateInput({ minimumFoldExecutedTrades: 29, catastrophicFolds: 1 }),
    );
    expect(insufficient.eligibility).toBe("INELIGIBLE");
    expect(insufficient.failedGateIds).toEqual(expect.arrayContaining([
      "catastrophicFoldLimit",
      "minimumExecutedTrades",
    ]));
  });

  it("selects zero, one, and multiple eligible candidates deterministically", () => {
    expect(selectM3R6Candidate([])).toEqual({
      selectionAlgorithmApplied: false,
      eligibleCandidateIds: [],
      selectedCandidateId: null,
      finalDecision: "NO ROUND-006 CANDIDATE",
    });
    const one = selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[2]);
    expect(selectM3R6Candidate([one])).toMatchObject({
      selectionAlgorithmApplied: true,
      selectedCandidateId: "R6-H21-ECONOMIC-RANGE-IMPULSE",
    });
    const multiple = [
      selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[1], {
        aggregateValidationExpectancyR: 0.050,
      }),
      selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[0], {
        aggregateValidationExpectancyR: 0.054,
      }),
      selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[3], {
        improvedValidationFolds: 5,
      }),
    ];
    const forward = selectM3R6Candidate(multiple);
    const reversed = selectM3R6Candidate([...multiple].reverse());
    expect(forward).toEqual(reversed);
    expect(forward.selectedCandidateId).toBe("R6-H22-PREDECLARED-REGIME-ROUTING");
    expect(forward.eligibleCandidateIds).toEqual([
      "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
      "R6-H20-STRUCTURAL-TREND-CONTINUATION",
      "R6-H22-PREDECLARED-REGIME-ROUTING",
    ]);
  });

  it("uses complexity only inside the predeclared expectancy tie band", () => {
    const h19 = selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[0], {
      aggregateValidationExpectancyR: 0.050,
    });
    const h20 = selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[1], {
      aggregateValidationExpectancyR: 0.055,
    });
    expect(selectM3R6Candidate([h20, h19]).selectedCandidateId).toBe(
      "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
    );
    const materiallyBetter = selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[1], {
      aggregateValidationExpectancyR: 0.061,
    });
    expect(selectM3R6Candidate([materiallyBetter, h19]).selectedCandidateId).toBe(
      "R6-H20-STRUCTURAL-TREND-CONTINUATION",
    );
    const exactBoundaryH19 = selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[0], {
      aggregateValidationExpectancyR: 0.050,
    });
    const exactBoundaryH20 = selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[1], {
      aggregateValidationExpectancyR: 0.060,
    });
    expect(selectM3R6Candidate([exactBoundaryH20, exactBoundaryH19]).selectedCandidateId).toBe(
      "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
    );
  });

  it("selects the same candidate for every permutation of the frozen four-candidate cohort", () => {
    const candidates = [
      selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[0], {
        aggregateValidationExpectancyR: 0.046,
      }),
      selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[1], {
        aggregateValidationExpectancyR: 0.045,
      }),
      selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[2], {
        aggregateValidationExpectancyR: 0.040,
      }),
      selectionCandidate(M3_R6_ROUND_006_CANDIDATE_IDS[3], {
        aggregateValidationExpectancyR: 0.052,
      }),
    ];
    const permutations: M3R6SelectionCandidate[][] = [];
    const visit = (remaining: M3R6SelectionCandidate[], prefix: M3R6SelectionCandidate[]) => {
      if (remaining.length === 0) {
        permutations.push(prefix);
        return;
      }
      remaining.forEach((candidate, index) => {
        visit(
          [...remaining.slice(0, index), ...remaining.slice(index + 1)],
          [...prefix, candidate],
        );
      });
    };
    visit(candidates, []);
    expect(permutations).toHaveLength(24);
    const results = permutations.map((permutation) => selectM3R6Candidate(permutation));
    expect(new Set(results.map((result) => result.selectedCandidateId))).toEqual(
      new Set(["R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH"]),
    );
    expect(new Set(results.map((result) => JSON.stringify(result.eligibleCandidateIds)))).toEqual(
      new Set([
        JSON.stringify([
          "R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH",
          "R6-H20-STRUCTURAL-TREND-CONTINUATION",
          "R6-H21-ECONOMIC-RANGE-IMPULSE",
          "R6-H22-PREDECLARED-REGIME-ROUTING",
        ]),
      ]),
    );
  });

  it("reproduces the canonical Gate and Plan hashes", () => {
    const gateHash = createHash("sha256")
      .update(stableStringify(M3_R6_ROUND_006_MACHINE_RECORD), "utf8")
      .digest("hex");
    expect(gateHash).toBe(M3_R6_ROUND_006_SELECTION_GATE_SHA256);
    expect(validateM3R6Round006MachineRecord()).toBe(M3_R6_ROUND_006_MACHINE_RECORD);
    expect(validateM3R6Round006Plan()).toBe(M3_R6_ROUND_006_PLAN);
    const planHash = createHash("sha256")
      .update(M3_R6_ROUND_006_PLAN_CANONICAL_JSON, "utf8")
      .digest("hex");
    expect(planHash).toBe(M3_R6_ROUND_006_PLAN_SHA256);
    expect(M3_R6_ROUND_006_PLAN_SCHEMA_VERSION).toBe("m3-r6-round-006-plan-001");
    expect(M3_R6_ROUND_006_PLAN_SHA256).toBe("0e9521e373764c8e9389326f84d25172693b3e3a0894e9829183bb0c7a96a591");
  });

  it("freezes metric status, formulas, normalization, and output ordering", () => {
    expect(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT.formalPopulation).toMatchObject({
      identity: "symbol|direction|signalTime",
      noSignalHandling: expect.stringContaining("NO_SIGNAL"),
    });
    for (const status of [
      "EXECUTED",
      "DATA_INCOMPLETE",
      "ENTRY_UNAVAILABLE",
      "INVALID_STOP_GEOMETRY",
      "PERIOD_END_CENSORED",
    ] as const) {
      expect(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT.statusSemantics[status]).toMatchObject({
        countsAsFormalSignal: true,
        countsAsExecutedTrade: status === "EXECUTED",
      });
    }
    expect(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT.formulas.profitFactor.infinityEncoding).toBe(
      "FORBIDDEN",
    );
    expect(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT.numericNormalization).toMatchObject({
      finiteNumbersOnly: true,
      negativeZero: "NORMALIZE_TO_ZERO",
      roundedMetricDecimalPlaces: 12,
      missingValue: "NULL;NEVER_INFINITY_OR_NAN",
    });
    expect(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT.outputOrdering).toMatchObject({
      folds: "F1,F2,F3,F4,F5,F6",
      candidateIds: expect.stringContaining("CANDIDATE_ID_ASCENDING"),
      serialization: expect.stringContaining("stableStringify"),
    });
    expect(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT.implementationIdentity.diagnostics).toEqual({
      path: "src/lib/research/diagnostics.ts",
      gitBlobSha: "771ea49b63ea9da4c57169fa176ba0df65f94c98",
    });
    expect(M3_R6_ROUND_006_PLAN.metricsContract).toBe(M3_R6_ROUND_006_METRIC_STATUS_CONTRACT);
  });

  it("rejects Gate and Plan mutation through canonical hash validation", () => {
    const alteredGate = JSON.parse(JSON.stringify(M3_R6_ROUND_006_MACHINE_RECORD)) as {
      auditOnlyField?: string;
    };
    alteredGate.auditOnlyField = "mutation";
    expect(() => validateM3R6Round006MachineRecord(alteredGate as never)).toThrow(
      /Gate canonical SHA mismatch/,
    );
    const alteredPlan = JSON.parse(JSON.stringify(M3_R6_ROUND_006_PLAN)) as {
      performance: { authorization: string };
    };
    alteredPlan.performance.authorization = "AUTHORIZED";
    expect(() => validateM3R6Round006Plan(alteredPlan as never)).toThrow(
      /performance is unexpectedly authorized/,
    );
  });

  it("refuses every provenance mismatch before future performance", () => {
    const valid = {
      executionSourceSha: "c".repeat(40),
      authorizedExecutionSourceSha: "c".repeat(40),
      headSha: "c".repeat(40),
      cleanWorktree: true,
      existingAuthoritativeOutputArtifacts: [],
      requiredManifestStatus: "PASS_BEFORE_NETWORK",
      protocolVersion: M3_R6_PROTOCOL_VERSION,
      protocolSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
      protocolGitBlobSha: M3_R6_B1A_PROTOCOL_SOURCE_IDENTITY.protocolGitBlobSha,
      researchRoundId: M3_R6_ROUND_006_RESEARCH_ROUND_ID,
      selectionGateSha256: M3_R6_ROUND_006_SELECTION_GATE_SHA256,
      planSha256: M3_R6_ROUND_006_PLAN_SHA256,
      candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
      controlId: M3_R6_ROUND_006_CONTROL_ID,
      symbols: RESEARCH_SYMBOLS,
      folds: RESEARCH_FOLDS as unknown as Readonly<Record<string, unknown>>,
      backtestPolicyVersion: "bt-policy-003",
      researchEndIso: M3_R6_RESEARCH_END_ISO,
    };
    expect(() => validateM3R6PerformanceAuthorization(valid)).not.toThrow();
    const mismatches: Array<[string, object]> = [
      ["protocol", { protocolVersion: "wrong" }],
      ["gate", { selectionGateSha256: "0".repeat(64) }],
      ["plan", { planSha256: "0".repeat(64) }],
      ["universe", { symbols: ["BTCUSDT"] }],
      ["folds", { folds: {} }],
      ["policy", { backtestPolicyVersion: "bt-policy-001" }],
    ];
    for (const [label, change] of mismatches) {
      expect(() => validateM3R6PerformanceAuthorization({ ...valid, ...change }), label).toThrow();
    }
    expect(() => validateM3R6PerformanceAuthorization({
      ...valid,
      executionSourceSha: M3_R6_ROUND_006_FREEZE_SOURCE_SHA,
    })).toThrow(/separately authorized/);
    expect(() => validateM3R6PerformanceAuthorization({
      ...valid,
      authorizedExecutionSourceSha: "d".repeat(40),
    })).toThrow(/must be identical/);
    expect(() => validateM3R6PerformanceAuthorization({
      ...valid,
      headSha: "d".repeat(40),
    })).toThrow(/must be identical/);
    expect(() => validateM3R6PerformanceAuthorization({
      ...valid,
      cleanWorktree: false,
    })).toThrow(/cleanWorktree/);
    expect(() => validateM3R6PerformanceAuthorization({
      ...valid,
      existingAuthoritativeOutputArtifacts: ["docs/evidence/M3_R6_ROUND_006_SUMMARY.json"],
    })).toThrow(/artifacts must be absent/);
    expect(() => validateM3R6PerformanceAuthorization({
      ...valid,
      requiredManifestStatus: "FAIL",
    })).toThrow(/manifests must pass/);
  });

  it("keeps the future execution source unset and the milestone closed", () => {
    expect(M3_R6_ROUND_006_PLAN.performance).toMatchObject({
      status: "NOT_GENERATED",
      authorization: "NOT_AUTHORIZED",
      executionSourceSha: null,
      lock: M3_R6_ROUND_006_PERFORMANCE_LOCK,
    });
    expect(M3_R6_ROUND_006_PLAN.authorization.performanceExecutionSourceSha).toBeNull();
    expect(M3_R6_ROUND_006_PLAN.researchUniverse.endIso).toBe(M3_R6_RESEARCH_END_ISO);
    expect(M3_R6_ROUND_006_PLAN.dataClassification).toBe(M3_R6_DATA_CLASSIFICATION);
    expect(M3_R6_ROUND_006_PLAN.status).toEqual({
      baseline002Status: "NOT_FROZEN",
      m3R6B1BStatus: "FROZEN_PENDING_ACCEPTANCE",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
    });
  });

  it("contains no network, historical, performance, or selection execution path", () => {
    const gateSource = readFileSync("src/lib/research/selection-gates-round-006.ts", "utf8");
    const planSource = readFileSync("src/lib/research/m3-r6-round-006-plan.ts", "utf8");
    expect(gateSource + "\n" + planSource).not.toMatch(/fetch\s*\(|axios|Binance|historical loader|research:m3r6:performance/);
  });
});
