import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { R13_PLAN, R13_PLAN_SHA256, R13_FEATURE_SPEC_SHA256, R13_MODEL_SPEC_SHA256 } from "./m3-r13-round-013-plan.ts";
import { R13_SELECTION_GATE_SHA256 } from "./selection-gates-round-013.ts";
import { R13_SPEC_CONFORMANCE_SHA256 } from "./m3-r13-round-013-conformance.ts";
import {
  M3_R13_ACCEPTED_R11_SOURCE_SHA,
  M3_R13_RESEARCH_END_ISO,
  M3_R13_RESEARCH_ROUND_ID,
  R13_DATA_CONTRACT,
  R13_EXECUTION_ALIGNMENT,
  R13_GOVERNANCE,
  R13_HORIZON_HOURS,
  R13_LABEL_CONTRACT,
  R13_MODEL_CONTRACT,
  R13_SYMBOLS,
} from "./m3-r13-round-013-protocol.ts";
import { stableStringify } from "./utils.ts";

export const M3_R14_RESEARCH_ROUND_ID = "baseline-002-research-round-014" as const;
export const M3_R14_REPLAY_OF_RESEARCH_ROUND_ID = M3_R13_RESEARCH_ROUND_ID;
export const M3_R14_SOURCE_R13_COMMIT = "3235d08da1cadf2f98a7b4974dc183a8e50b919e" as const;
export const M3_R14_DATASET_IDENTITY_SHA256 = "cf836dd3344ef4a896c7a9520c65a648c19f2fa25f5f849ea6ab4e9050d32e26" as const;
export const M3_R14_MANIFEST_IDENTITY_SHA256 = "2ffa7eda3a53edfeaa2e4443812c4380d0a15dd581442eec47e3f8cd82557175" as const;
export const M3_R14_R13_PROTOCOL_VERSION = "m3-r13-round-013-forward-edge-discovery-001" as const;
export const M3_R14_PERFORMANCE_LOCK = "FIRST_M3_R14_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R14_IDENTITY_SCHEMA_VERSION = "m3-r14-r13-scientific-identity-001" as const;

export const M3_R14_IDENTITY_PATH = path.join("docs", "research", "round-014-r13-identity.json");
export const M3_R14_R13_FORENSICS_PATH = path.join("docs", "research", "round-014-r13-forensics.json");

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

/**
 * This projection intentionally contains only R13 result-affecting inputs.
 * Round-014 may change lifecycle and storage, but this object must not.
 */
export function r13ScientificPlanFields(plan: typeof R13_PLAN = R13_PLAN): Readonly<Record<string, unknown>> {
  return {
    acceptedSourceSha: plan.acceptedSourceSha,
    dataClassification: plan.dataClassification,
    researchBoundary: plan.researchBoundary,
    researchUniverse: plan.researchUniverse,
    symbols: plan.symbols,
    directions: plan.directions,
    folds: plan.folds,
    executionAlignment: plan.executionAlignment,
    observationUniverse: plan.observationUniverse,
    control: plan.control,
    featureSpec: plan.featureSpec,
    labelSpec: plan.labelSpec,
    modelSpec: plan.modelSpec,
    horizonHours: plan.horizonHours,
    purgeEmbargo: plan.purgeEmbargo,
    gate: plan.gate,
    selection: plan.selection,
  };
}

export const R13_SCIENTIFIC_PROJECTION = Object.freeze({
  datasetIdentitySha256: M3_R14_DATASET_IDENTITY_SHA256,
  manifestIdentitySha256: M3_R14_MANIFEST_IDENTITY_SHA256,
  featureSpecSha256: R13_FEATURE_SPEC_SHA256,
  modelSpecSha256: R13_MODEL_SPEC_SHA256,
  gateSha256: R13_SELECTION_GATE_SHA256,
  planSha256: R13_PLAN_SHA256,
  conformanceSha256: R13_SPEC_CONFORMANCE_SHA256,
  planScientificFields: r13ScientificPlanFields(),
  protocolScientificFields: {
    researchBoundary: M3_R13_RESEARCH_END_ISO,
    symbols: R13_SYMBOLS,
    executionAlignment: R13_EXECUTION_ALIGNMENT,
    dataContract: R13_DATA_CONTRACT,
    labelContract: R13_LABEL_CONTRACT,
    modelContract: R13_MODEL_CONTRACT,
    horizons: R13_HORIZON_HOURS,
    governance: R13_GOVERNANCE,
  },
} as const);

export const M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256 = hash(R13_SCIENTIFIC_PROJECTION);

export type R14IdentityDocument = Readonly<{
  schemaVersion: typeof M3_R14_IDENTITY_SCHEMA_VERSION;
  researchRoundId: typeof M3_R14_RESEARCH_ROUND_ID;
  replayOfResearchRoundId: typeof M3_R14_REPLAY_OF_RESEARCH_ROUND_ID;
  sourceCommit: typeof M3_R14_SOURCE_R13_COMMIT;
  r13: Readonly<{
    researchRoundId: typeof M3_R13_RESEARCH_ROUND_ID;
    protocolVersion: typeof M3_R14_R13_PROTOCOL_VERSION;
    scientificProjection: typeof R13_SCIENTIFIC_PROJECTION;
  }>;
  r14: Readonly<{
    replayScientificProjection: typeof R13_SCIENTIFIC_PROJECTION;
    scientificSpecIdentitySha256: string;
  }>;
  comparison: Readonly<{
    datasetIdentitySha256Equal: true;
    manifestIdentitySha256Equal: true;
    featureSpecSha256Equal: true;
    modelSpecSha256Equal: true;
    gateSha256Equal: true;
    planScientificFieldsEqual: true;
    foldDefinitionsEqual: true;
    horizonDefinitionsEqual: true;
    executionEconomicsEqual: true;
    selectionDefinitionsEqual: true;
  }>;
  scientificDeviationCount: 0;
  scientificDeviations: readonly [];
  allowedRuntimeDifferences: readonly string[];
}>;

export const R14_IDENTITY_DOCUMENT: R14IdentityDocument = Object.freeze({
  schemaVersion: M3_R14_IDENTITY_SCHEMA_VERSION,
  researchRoundId: M3_R14_RESEARCH_ROUND_ID,
  replayOfResearchRoundId: M3_R14_REPLAY_OF_RESEARCH_ROUND_ID,
  sourceCommit: M3_R14_SOURCE_R13_COMMIT,
  r13: {
    researchRoundId: M3_R13_RESEARCH_ROUND_ID,
    protocolVersion: M3_R14_R13_PROTOCOL_VERSION,
    scientificProjection: R13_SCIENTIFIC_PROJECTION,
  },
  r14: {
    replayScientificProjection: R13_SCIENTIFIC_PROJECTION,
    scientificSpecIdentitySha256: M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256,
  },
  comparison: {
    datasetIdentitySha256Equal: true,
    manifestIdentitySha256Equal: true,
    featureSpecSha256Equal: true,
    modelSpecSha256Equal: true,
    gateSha256Equal: true,
    planScientificFieldsEqual: true,
    foldDefinitionsEqual: true,
    horizonDefinitionsEqual: true,
    executionEconomicsEqual: true,
    selectionDefinitionsEqual: true,
  } as const,
  scientificDeviationCount: 0,
  scientificDeviations: [] as const,
  allowedRuntimeDifferences: [
    "PRE_LOCK_OBSERVATION_MATERIALIZATION",
    "LOCAL_STREAMING_OBSERVATION_STORAGE",
    "CRASH_SAFE_ATOMIC_CHECKPOINTS",
    "SAME_EXECUTION_ID_CONTINUATION",
    "DESTINATION_LOCAL_EVIDENCE_PUBLICATION",
  ],
});

export const R14_IDENTITY_CANONICAL_JSON = stableStringify(R14_IDENTITY_DOCUMENT);

export function validateR14Identity(document: R14IdentityDocument = R14_IDENTITY_DOCUMENT): R14IdentityDocument {
  if (document.schemaVersion !== M3_R14_IDENTITY_SCHEMA_VERSION) throw new Error("R14 identity schema mismatch.");
  if (document.sourceCommit !== M3_R14_SOURCE_R13_COMMIT) throw new Error("R14 identity source commit mismatch.");
  if (document.r13.researchRoundId !== M3_R13_RESEARCH_ROUND_ID || document.replayOfResearchRoundId !== M3_R14_REPLAY_OF_RESEARCH_ROUND_ID) throw new Error("R14 replay provenance mismatch.");
  if (document.scientificDeviationCount !== 0 || document.scientificDeviations.length !== 0) throw new Error("R14 scientific identity has deviations.");
  if (stableStringify(document.r13.scientificProjection) !== stableStringify(document.r14.replayScientificProjection)) throw new Error("R14 scientific projection differs from R13.");
  if (document.r14.scientificSpecIdentitySha256 !== M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256) throw new Error("R14 scientific identity hash mismatch.");
  for (const value of Object.values(document.comparison)) if (value !== true) throw new Error("R14 scientific identity comparison failed.");
  return document;
}

export function readR14Identity(filePath = path.join(process.cwd(), M3_R14_IDENTITY_PATH)): R14IdentityDocument {
  if (!existsSync(filePath)) throw new Error(`R14 identity is missing: ${filePath}`);
  const document = JSON.parse(readFileSync(filePath, "utf8")) as R14IdentityDocument;
  return validateR14Identity(document);
}

export { M3_R13_ACCEPTED_R11_SOURCE_SHA, M3_R13_RESEARCH_END_ISO };
