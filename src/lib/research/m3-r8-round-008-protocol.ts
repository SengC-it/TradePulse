import { createHash } from "node:crypto";

import { deepFreeze, stableStringify } from "./utils.ts";
import {
  M3_R7_CANDIDATE_IDS,
  M3_R7_CONTROL_ID,
  M3_R7_RESEARCH_END_ISO,
  M3_R7_RESEARCH_RANGE,
  M3_R7_RESEARCH_ROUND_ID,
  R7_CANDIDATE_REGISTRY,
  R7_CENSOR_SEMANTICS,
  R7_COMPLEXITY_TUPLES,
  R7_DATA_CONTRACT,
  R7_EXECUTION_CONTRACT,
  R7_FEATURE_DEFINITIONS,
  R7_FROZEN_FOLDS,
  R7_MODEL_CONTRACT,
  R7_ROUTER_BUCKETS,
  R7_SYMBOLS,
} from "./m3-r7-round-007-protocol.ts";
import { R7_DEFINITIONS, R7_MACHINE_RECORD, R7_SELECTION_GATE_SHA256 } from "./selection-gates-round-007.ts";

export const M3_R8_RESEARCH_ROUND_ID = "baseline-002-research-round-008" as const;
export const M3_R8_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R8_RESEARCH_END_ISO = M3_R7_RESEARCH_END_ISO;
export const M3_R8_RESEARCH_RANGE = Object.freeze({
  ...M3_R7_RESEARCH_RANGE,
  classification: "RESEARCH_AVAILABLE_SEEN_DATA",
} as const);
export const M3_R8_PROTOCOL_VERSION = "m3-r8-round-008-strict-protocol-replay-001" as const;
export const M3_R8_PERFORMANCE_LOCK = "FIRST_M3_R8_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R8_REPLAY_SOURCE_SHA = "04d75215987c28822a4de9c1be30e41838a1adea" as const;
export const M3_R8_FREEZE_SOURCE_SHA = M3_R8_REPLAY_SOURCE_SHA;
export const M3_R8_CONTROL_ID = M3_R7_CONTROL_ID;
export const M3_R8_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R8_NO_CANDIDATE_OUTCOME = "NO BASELINE-002 CANDIDATE — ROUND-008" as const;

export const R8_CANDIDATE_IDS = M3_R7_CANDIDATE_IDS;
export const R8_CANDIDATE_REGISTRY = R7_CANDIDATE_REGISTRY;
export const R8_SYMBOLS = R7_SYMBOLS;
export const R8_FROZEN_FOLDS = R7_FROZEN_FOLDS;
export const R8_COMPLEXITY_TUPLES = R7_COMPLEXITY_TUPLES;
export const R8_FEATURE_DEFINITIONS = R7_FEATURE_DEFINITIONS;
export const R8_ROUTER_BUCKETS = R7_ROUTER_BUCKETS;
export const R8_DATA_CONTRACT = R7_DATA_CONTRACT;
export const R8_EXECUTION_CONTRACT = R7_EXECUTION_CONTRACT;
export const R8_MODEL_CONTRACT = R7_MODEL_CONTRACT;
export const R8_CENSOR_SEMANTICS = R7_CENSOR_SEMANTICS;
export const R8_SELECTION_DEFINITIONS = R7_DEFINITIONS;
export const R8_SELECTION_GATE_SHA256 = R7_SELECTION_GATE_SHA256;

const RESULT_AFFECTING_SPEC_KEYS = Object.freeze([
  "universe",
  "symbols",
  "folds",
  "candidateIds",
  "candidateRegistry",
  "complexityTuples",
  "selectionGates",
  "definitions",
  "features",
  "routerBuckets",
  "dataContract",
  "executionContract",
  "modelContract",
  "censorSemantics",
] as const);

function canonicalHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function resultAffectingProjection(record: typeof R7_MACHINE_RECORD): Readonly<Record<string, unknown>> {
  return Object.freeze({
    universe: record.universe,
    symbols: record.symbols,
    folds: record.folds,
    candidateIds: record.candidateIds,
    candidateRegistry: record.candidateRegistry,
    complexityTuples: record.complexityTuples,
    selectionGates: record.selectionGates,
    definitions: record.definitions,
    features: record.definitions.featureDefinitions,
    routerBuckets: record.definitions.routerBuckets,
    dataContract: record.dataContract,
    executionContract: record.executionContract,
    modelContract: record.definitions.modelContract,
    censorSemantics: record.definitions.censorSemantics,
  });
}

export const R7_RESULT_AFFECTING_SPEC = resultAffectingProjection(R7_MACHINE_RECORD);
export const R8_RESULT_AFFECTING_SPEC = deepFreeze({ ...R7_RESULT_AFFECTING_SPEC });

export function compareR8ResultAffectingSpecs(
  left: Readonly<Record<string, unknown>> = R7_RESULT_AFFECTING_SPEC,
  right: Readonly<Record<string, unknown>> = R8_RESULT_AFFECTING_SPEC,
): number {
  return RESULT_AFFECTING_SPEC_KEYS.filter((key) => stableStringify(left[key]) !== stableStringify(right[key])).length;
}

export const R8_RESULT_AFFECTING_SPEC_DIFF_COUNT = compareR8ResultAffectingSpecs();
export const R8_MODEL_SPEC_SHA256 = canonicalHash(R8_MODEL_CONTRACT);
export const R8_CANDIDATE_REGISTRY_SHA256 = canonicalHash(R8_CANDIDATE_REGISTRY);
export const R8_FEATURE_SPEC_SHA256 = canonicalHash(R8_FEATURE_DEFINITIONS);
export const R8_REGIME_SPEC_SHA256 = canonicalHash(R8_ROUTER_BUCKETS);
export const R8_ENTRY_SPEC_SHA256 = canonicalHash(R8_EXECUTION_CONTRACT);

export const R8_PROTOCOL_MACHINE_RECORD = deepFreeze({
  recordVersion: "m3-r8-protocol-replay-001",
  researchRoundId: M3_R8_RESEARCH_ROUND_ID,
  replayOfResearchRoundId: M3_R7_RESEARCH_ROUND_ID,
  replaySourceSha: M3_R8_REPLAY_SOURCE_SHA,
  freezeSourceSha: M3_R8_FREEZE_SOURCE_SHA,
  resultAffectingSpecDiffCount: R8_RESULT_AFFECTING_SPEC_DIFF_COUNT,
  specificationHashes: {
    candidateRegistrySha256: R8_CANDIDATE_REGISTRY_SHA256,
    featureSpecificationSha256: R8_FEATURE_SPEC_SHA256,
    regimeSpecificationSha256: R8_REGIME_SPEC_SHA256,
    entrySpecificationSha256: R8_ENTRY_SPEC_SHA256,
    modelSpecificationSha256: R8_MODEL_SPEC_SHA256,
    selectionGateSha256: R8_SELECTION_GATE_SHA256,
  },
  candidateIds: R8_CANDIDATE_IDS,
  candidateRegistry: R8_CANDIDATE_REGISTRY,
  universe: R8_RESULT_AFFECTING_SPEC.universe,
  symbols: R8_SYMBOLS,
  folds: R8_FROZEN_FOLDS,
  modelContract: R8_MODEL_CONTRACT,
  dataContract: R8_DATA_CONTRACT,
  executionContract: R8_EXECUTION_CONTRACT,
  censorSemantics: R8_CENSOR_SEMANTICS,
  gate: { inheritedRound: M3_R7_RESEARCH_ROUND_ID, sha256: R8_SELECTION_GATE_SHA256, resultAffectingDiffCount: 0 },
  governance: {
    noResultAffectingDefinitionChanges: true,
    round007ResultsUsedForRound008Tuning: false,
    noPrivateBinanceApi: true,
    noAutomaticTrading: true,
    noPostLockFetch: true,
  },
  performanceExecutionSourceSha: null,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export function validateR8ProtocolMachineRecord(record = R8_PROTOCOL_MACHINE_RECORD): typeof R8_PROTOCOL_MACHINE_RECORD {
  if (record.researchRoundId !== M3_R8_RESEARCH_ROUND_ID || record.replayOfResearchRoundId !== M3_R7_RESEARCH_ROUND_ID) throw new Error("R8 protocol replay identity mismatch.");
  if (record.replaySourceSha !== M3_R8_REPLAY_SOURCE_SHA || record.freezeSourceSha !== M3_R8_FREEZE_SOURCE_SHA) throw new Error("R8 replay source mismatch.");
  if (record.resultAffectingSpecDiffCount !== 0 || compareR8ResultAffectingSpecs() !== 0) throw new Error("R8 result-affecting specification drift detected.");
  if (stableStringify(record.candidateIds) !== stableStringify(R8_CANDIDATE_IDS) || stableStringify(record.candidateRegistry) !== stableStringify(R8_CANDIDATE_REGISTRY)) throw new Error("R8 candidate registry drift detected.");
  if (record.governance.round007ResultsUsedForRound008Tuning !== false || record.performanceExecutionSourceSha !== null) throw new Error("R8 result/tuning boundary changed.");
  if (record.baseline002Status !== "NOT_FROZEN" || record.m3JStatus !== "BLOCKED" || record.m4Status !== "NOT_STARTED") throw new Error("R8 milestone boundary changed.");
  return record;
}
