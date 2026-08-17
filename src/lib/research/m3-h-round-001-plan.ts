import { createHash } from "node:crypto";

import {
  BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID,
  BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256,
} from "./selection-gates-round-001.ts";
import { createExperimentDefinition } from "./registry.ts";
import { validateScoreBucketDefinitions } from "./score-buckets.ts";
import type {
  ExperimentDefinition,
  ExperimentParameter,
  ResearchCandidateIdentity,
  ScalarParameterValue,
  ScoreBucketDefinition,
} from "./types.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_H_ROUND_001_AUTHORITATIVE_SOURCE_SHA = "99e8f86207c0bd22facf66d557e2e6f792ba0b6e" as const;
export const M3_H_ROUND_001_RESEARCH_ROUND_ID = BASELINE_002_RESEARCH_ROUND_001_RESEARCH_ROUND_ID;
export const M3_H_ROUND_001_SELECTION_GATE_SHA256 = BASELINE_002_RESEARCH_ROUND_001_SELECTION_GATE_SHA256;
export const M3_H_ROUND_001_CONTROL_EXPERIMENT_ID = "CONTROL_BASELINE_001" as const;

export type M3HComplexityTuple = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

type DecisionTimeFields = readonly [
  "signalTime",
  "symbol",
  "direction",
  "totalScore",
  "entryReference",
  "stopDistance",
];

export type M3HSelectorSpec =
  | Readonly<{
      kind: "H1_COOLDOWN";
      inputFields: DecisionTimeFields;
      keyFields: readonly ["symbol", "direction"];
      cooldownHours: number;
      stateScope: "FULL_CHRONOLOGICAL_CONTROL_STREAM";
      suppressionBoundary: "0 < delta <= cooldownHours";
      acceptanceBoundary: "delta > cooldownHours";
      stateUpdate: "ONLY_AFTER_ACCEPTED_SIGNAL";
    }>
  | Readonly<{
      kind: "H4_TOP_N";
      inputFields: DecisionTimeFields;
      groupField: "signalTime";
      rankOrder: readonly ["totalScore DESC", "symbol frozen order", "LONG before SHORT"];
      retain: "TOP_N";
      topN: number;
    }>
  | Readonly<{
      kind: "H2_COST_PROXY";
      inputFields: DecisionTimeFields;
      formula: "0.002 * entryReference / stopDistance";
      proxyUnit: "R";
      validInput: "entryReference finite > 0; stopDistance finite > 0; proxy finite";
      invalidInput: "FAIL_CLOSED_CANDIDATE_EVIDENCE";
      retainBoundary: "roundTripFrictionProxyR <= maxFrictionProxyR";
      maxFrictionProxyR: number;
    }>
  | Readonly<{
      kind: "H3_SCORE_THRESHOLD";
      inputFields: DecisionTimeFields;
      condition: "totalScore >= minimumScore";
      equality: "INCLUDED";
      minimumScore: number;
    }>;

export type M3HExperimentDefinition = ExperimentDefinition & Readonly<{
  complexity: M3HComplexityTuple;
  selector: M3HSelectorSpec;
}>;

export type M3HControlIdentity = Readonly<ResearchCandidateIdentity & {
  strategyVersion: "baseline-001";
  complexity: M3HComplexityTuple;
}>;

export const M3_H_ROUND_001_DECISION_SNAPSHOT_FIELDS: DecisionTimeFields = Object.freeze([
  "signalTime",
  "symbol",
  "direction",
  "totalScore",
  "entryReference",
  "stopDistance",
]);

export const M3_H_ROUND_001_FORBIDDEN_SELECTOR_FIELDS = Object.freeze([
  "status",
  "entryTime",
  "exitTime",
  "exitReason",
  "grossR",
  "feeR",
  "fundingR",
  "netR",
  "fundingCharges",
  "heldCandleNumber",
] as const);

const ZERO_COMPLEXITY: M3HComplexityTuple = Object.freeze({
  newRules: 0,
  newTunableThresholds: 0,
  modifiedBaselineRules: 0,
  mechanismFamiliesUsed: 0,
});

const SINGLE_MECHANISM_COMPLEXITY: M3HComplexityTuple = Object.freeze({
  newRules: 1,
  newTunableThresholds: 1,
  modifiedBaselineRules: 0,
  mechanismFamiliesUsed: 1,
});

const SCORE_MECHANISM_COMPLEXITY: M3HComplexityTuple = Object.freeze({
  newRules: 0,
  newTunableThresholds: 1,
  modifiedBaselineRules: 1,
  mechanismFamiliesUsed: 1,
});

function defineVariant(input: Readonly<{
  experimentId: string;
  variantId: string;
  hypothesisId: "H1_SIGNAL_REDUNDANCY" | "H2_COST_ADJUSTED_EDGE" | "H3_SCORE_CALIBRATION" | "H4_SIGNAL_DENSITY";
  exactChange: string;
  rationale: string;
  parameter: ExperimentParameter;
  value: ScalarParameterValue;
  selector: M3HSelectorSpec;
  complexity: M3HComplexityTuple;
}>): M3HExperimentDefinition {
  const definition = createExperimentDefinition({
    researchRoundId: M3_H_ROUND_001_RESEARCH_ROUND_ID,
    experimentId: input.experimentId,
    variantId: input.variantId,
    hypothesisId: input.hypothesisId,
    exactChange: input.exactChange,
    rationale: input.rationale,
    parametersTested: [input.parameter],
    predeclaredParameterValues: { [input.parameter.name]: [input.value] },
  });
  return deepFreeze({
    ...definition,
    complexity: input.complexity,
    selector: input.selector,
  });
}

function cooldownVariant(experimentId: string, cooldownHours: number): M3HExperimentDefinition {
  return defineVariant({
    experimentId,
    variantId: experimentId,
    hypothesisId: "H1_SIGNAL_REDUNDANCY",
    exactChange: "Suppress a later same-symbol same-direction signal within the frozen cooldown boundary.",
    rationale: "Test signal redundancy reduction without changing any retained trade settlement economics.",
    parameter: { name: "cooldownHours", unit: "hours" },
    value: cooldownHours,
    selector: {
      kind: "H1_COOLDOWN",
      inputFields: M3_H_ROUND_001_DECISION_SNAPSHOT_FIELDS,
      keyFields: ["symbol", "direction"],
      cooldownHours,
      stateScope: "FULL_CHRONOLOGICAL_CONTROL_STREAM",
      suppressionBoundary: "0 < delta <= cooldownHours",
      acceptanceBoundary: "delta > cooldownHours",
      stateUpdate: "ONLY_AFTER_ACCEPTED_SIGNAL",
    },
    complexity: SINGLE_MECHANISM_COMPLEXITY,
  });
}

function topNVariant(experimentId: string, topN: number): M3HExperimentDefinition {
  return defineVariant({
    experimentId,
    variantId: experimentId,
    hypothesisId: "H4_SIGNAL_DENSITY",
    exactChange: "Retain only the top N control signals at each identical signalTime.",
    rationale: "Test signal density reduction using frozen score and symbol/direction ordering.",
    parameter: { name: "topN", unit: "signals-per-signalTime" },
    value: topN,
    selector: {
      kind: "H4_TOP_N",
      inputFields: M3_H_ROUND_001_DECISION_SNAPSHOT_FIELDS,
      groupField: "signalTime",
      rankOrder: ["totalScore DESC", "symbol frozen order", "LONG before SHORT"],
      retain: "TOP_N",
      topN,
    },
    complexity: SINGLE_MECHANISM_COMPLEXITY,
  });
}

function costVariant(experimentId: string, maxFrictionProxyR: number): M3HExperimentDefinition {
  return defineVariant({
    experimentId,
    variantId: experimentId,
    hypothesisId: "H2_COST_ADJUSTED_EDGE",
    exactChange: "Retain signals whose decision-time round-trip friction proxy is at most the predeclared threshold.",
    rationale: "Test a signal-time cost proxy without using any realized outcome or settlement field.",
    parameter: { name: "maxFrictionProxyR", unit: "R" },
    value: maxFrictionProxyR,
    selector: {
      kind: "H2_COST_PROXY",
      inputFields: M3_H_ROUND_001_DECISION_SNAPSHOT_FIELDS,
      formula: "0.002 * entryReference / stopDistance",
      proxyUnit: "R",
      validInput: "entryReference finite > 0; stopDistance finite > 0; proxy finite",
      invalidInput: "FAIL_CLOSED_CANDIDATE_EVIDENCE",
      retainBoundary: "roundTripFrictionProxyR <= maxFrictionProxyR",
      maxFrictionProxyR,
    },
    complexity: SINGLE_MECHANISM_COMPLEXITY,
  });
}

function scoreVariant(experimentId: string, minimumScore: number): M3HExperimentDefinition {
  return defineVariant({
    experimentId,
    variantId: experimentId,
    hypothesisId: "H3_SCORE_CALIBRATION",
    exactChange: "Retain signals at or above one existing frozen score-grade boundary.",
    rationale: "Test existing totalScore grade boundaries without reweighting score components or inventing thresholds.",
    parameter: { name: "minimumScore", unit: "score-points" },
    value: minimumScore,
    selector: {
      kind: "H3_SCORE_THRESHOLD",
      inputFields: M3_H_ROUND_001_DECISION_SNAPSHOT_FIELDS,
      condition: "totalScore >= minimumScore",
      equality: "INCLUDED",
      minimumScore,
    },
    complexity: SCORE_MECHANISM_COMPLEXITY,
  });
}

export const M3_H_ROUND_001_EXPERIMENTS: readonly M3HExperimentDefinition[] = Object.freeze([
  cooldownVariant("R1-H1-CD-06H", 6),
  cooldownVariant("R1-H1-CD-12H", 12),
  cooldownVariant("R1-H1-CD-24H", 24),
  topNVariant("R2-H4-TOPN-1", 1),
  topNVariant("R2-H4-TOPN-2", 2),
  topNVariant("R2-H4-TOPN-3", 3),
  costVariant("R3-H2-COST-010", 0.1),
  costVariant("R3-H2-COST-015", 0.15),
  costVariant("R3-H2-COST-020", 0.2),
  costVariant("R3-H2-COST-025", 0.25),
  scoreVariant("R4-H3-SCORE-075", 75),
  scoreVariant("R4-H3-SCORE-080", 80),
  scoreVariant("R4-H3-SCORE-085", 85),
]);

export const M3_H_ROUND_001_CONTROL: M3HControlIdentity = deepFreeze({
  experimentId: M3_H_ROUND_001_CONTROL_EXPERIMENT_ID,
  variantId: M3_H_ROUND_001_CONTROL_EXPERIMENT_ID,
  strategyVersion: "baseline-001",
  complexity: ZERO_COMPLEXITY,
});

export const M3_H_ROUND_001_SCORE_BUCKETS: readonly ScoreBucketDefinition[] = validateScoreBucketDefinitions([
  { id: "S70_75", minInclusive: 70, maxExclusive: 75 },
  { id: "S75_80", minInclusive: 75, maxExclusive: 80 },
  { id: "S80_85", minInclusive: 80, maxExclusive: 85 },
  { id: "S85_PLUS", minInclusive: 85, maxExclusive: null },
]);

export const M3_H_ROUND_001_CANDIDATE_ORDER = Object.freeze([
  M3_H_ROUND_001_CONTROL_EXPERIMENT_ID,
  ...M3_H_ROUND_001_EXPERIMENTS.map((experiment) => experiment.experimentId),
] as const);

export const M3_H_ROUND_001_PLAN = deepFreeze({
  researchRoundId: M3_H_ROUND_001_RESEARCH_ROUND_ID,
  sourceSha: M3_H_ROUND_001_AUTHORITATIVE_SOURCE_SHA,
  selectionGateSha256: M3_H_ROUND_001_SELECTION_GATE_SHA256,
  control: M3_H_ROUND_001_CONTROL,
  experiments: M3_H_ROUND_001_EXPERIMENTS,
  candidateOrdering: M3_H_ROUND_001_CANDIDATE_ORDER,
  decisionSnapshotFields: M3_H_ROUND_001_DECISION_SNAPSHOT_FIELDS,
  forbiddenSelectorFields: M3_H_ROUND_001_FORBIDDEN_SELECTOR_FIELDS,
  scoreBuckets: M3_H_ROUND_001_SCORE_BUCKETS,
  h5Status: "DIAGNOSTIC_ONLY",
  combinations: "NO_COMBINATIONS",
  candidateCount: 13,
  resultIdentityCount: 14,
  evidenceDecision: "DEFER_TO_M3_I_FROZEN_GATE_APPLICATION",
  dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
});

export const M3_H_ROUND_001_PLAN_CANONICAL_JSON = stableStringify(M3_H_ROUND_001_PLAN);
export const M3_H_ROUND_001_PLAN_SHA256 = "2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a" as const;

export function validateM3HRound001Plan(plan: typeof M3_H_ROUND_001_PLAN = M3_H_ROUND_001_PLAN): typeof M3_H_ROUND_001_PLAN {
  if (plan.researchRoundId !== M3_H_ROUND_001_RESEARCH_ROUND_ID) throw new Error("M3-H plan research round mismatch.");
  if (plan.selectionGateSha256 !== M3_H_ROUND_001_SELECTION_GATE_SHA256) throw new Error("M3-H plan selection gate hash mismatch.");
  if (plan.experiments.length !== 13) throw new Error("M3-H round-001 must contain exactly 13 candidates.");
  if (plan.resultIdentityCount !== 14) throw new Error("M3-H round-001 must contain exactly 14 result identities.");
  if (new Set(plan.candidateOrdering).size !== 14) throw new Error("M3-H candidate ordering contains duplicate identities.");
  const planHash = createHash("sha256").update(stableStringify(plan), "utf8").digest("hex");
  if (planHash !== M3_H_ROUND_001_PLAN_SHA256) throw new Error("M3-H experiment plan canonical SHA mismatch.");
  return plan;
}
