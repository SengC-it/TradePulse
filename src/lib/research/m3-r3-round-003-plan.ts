import { createHash } from "node:crypto";

import {
  BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD,
  BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
  M3_R3_ROUND_003_CANDIDATE_IDS,
  M3_R3_ROUND_003_INHERITED_PLAN_SHA256,
  M3_R3_ROUND_003_INHERITED_SELECTION_GATE_SHA256,
  M3_R3_ROUND_003_INVALIDATION_MERGE_SHA,
  M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME,
  M3_R3_ROUND_003_PERFORMANCE_LOCK,
  M3_R3_ROUND_003_RESEARCH_ROUND_ID,
  M3_R3_ROUND_003_SOURCE_SHA,
} from "./selection-gates-round-003.ts";
import {
  M3_R2_ROUND_002_CANDIDATE_DEFINITIONS,
  M3_R2_ROUND_002_COMPLEXITY_TUPLES,
  M3_R2_ROUND_002_SELECTOR_SPECS,
} from "./m3-r2-round-002-plan.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import {
  M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS,
  M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256,
} from "./m3-r3-round-003-recovery.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R3_ROUND_003_PLAN_SCHEMA_VERSION = "m3-r3-round-003-plan-001" as const;
export const M3_R3_ROUND_003_DATA_CLASSIFICATION = "RESEARCH_AVAILABLE_SEEN_DATA" as const;
export const M3_R3_ROUND_003_SELECTOR_SPECS_SHA256 = createHash("sha256")
  .update(stableStringify(M3_R2_ROUND_002_SELECTOR_SPECS), "utf8")
  .digest("hex");

export const M3_R3_ROUND_003_PLAN = deepFreeze({
  schemaVersion: M3_R3_ROUND_003_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R3_ROUND_003_RESEARCH_ROUND_ID,
  sourceSha: M3_R3_ROUND_003_SOURCE_SHA,
  invalidationMergeSha: M3_R3_ROUND_003_INVALIDATION_MERGE_SHA,
  dataClassification: M3_R3_ROUND_003_DATA_CLASSIFICATION,
  researchUniverse: {
    startTime: Date.parse("2023-01-01T00:00:00.000Z"),
    endTime: Date.parse("2026-08-15T23:59:59.999Z"),
    rule: "RESEARCH_AVAILABLE_SEEN_DATA",
  },
  inheritedRound002PlanSha256: M3_R3_ROUND_003_INHERITED_PLAN_SHA256,
  inheritedRound002SelectionGateSha256: M3_R3_ROUND_003_INHERITED_SELECTION_GATE_SHA256,
  inheritedSelectorSpecsSha256: M3_R3_ROUND_003_SELECTOR_SPECS_SHA256,
  selectionGateSha256: BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256,
  performanceStatus: "NOT_GENERATED",
  performanceLock: M3_R3_ROUND_003_PERFORMANCE_LOCK,
  performanceAuthorization: "M3-R3-B",
  candidateCount: M3_R3_ROUND_003_CANDIDATE_IDS.length,
  candidateIds: M3_R3_ROUND_003_CANDIDATE_IDS,
  candidateDefinitions: M3_R2_ROUND_002_CANDIDATE_DEFINITIONS,
  complexityTuples: M3_R2_ROUND_002_COMPLEXITY_TUPLES,
  selectorSpecs: M3_R2_ROUND_002_SELECTOR_SPECS,
  folds: RESEARCH_FOLDS,
  gateSemantics: BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD.selectionGates,
  artifactRawBinding: "PARSE_ENVELOPE_FROM_SHA_VERIFIED_RAW_BYTES",
  controlValidation: "schema004 + policy003 + baseline001 + COMBINED + studyServerTime + 7500 formal + 7495 executed + zero diagnostics + no DATA_INCOMPLETE/SETTLEMENT_AMBIGUOUS",
  round001EvidenceSha256: M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256,
  controlParity: {
    formalIdentity: "formal identity SHA",
    executedIdentity: "executed identity SHA",
    aggregateValidation: "aggregate F1-F6 diagnostics",
    folds: "F1-F6 diagnostics",
  },
  m3R3BRequiredStatuses: {
    artifactReuseStatus: M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS,
    controlValidationStatus: "PASS",
    controlParityStatus: "PASS",
  },
  repairs: {
    aggregateValidation: {
      validationRange: "F1.validation.startTime through F6.validation.endTime",
      filter: "record.signalTime >= validationRange.startTime && record.signalTime <= validationRange.endTime",
      diagnosticsInput: "filtered validationRecords only",
    },
    identityHash: {
      sortOrder: ["signalTime ascending", "frozen symbol order", "LONG before SHORT"],
      identity: "symbol|direction|signalTime",
      formal: "all formal records",
      executed: "status === EXECUTED only",
    },
    artifactReuse: {
      controlReportSha256: "5ecfae3258d2ace774965eba12df25b888b04593b32e1b92a2593c41fdad8b33",
      decisionSnapshotArtifactSha256: "65a011d813c55f936f89069706730f5de33dfda9f2eba94f0dfb2b914818eec9",
      studyServerTime: 1787031883099,
      snapshotCount: 7500,
      statusOnExactMatch: "VERIFIED_REUSABLE_INPUT",
      mismatchAction: "FAIL_CLOSED",
    },
  },
  noCandidateOutcome: M3_R3_ROUND_003_NO_CANDIDATE_OUTCOME,
});

export const M3_R3_ROUND_003_PLAN_CANONICAL_JSON = stableStringify(M3_R3_ROUND_003_PLAN);

export const M3_R3_ROUND_003_PLAN_SHA256 =
  "d4238bec817425fddd4a1e556277aa58de84c5986da55a9e08b661cc9f621e67" as const;

export function validateM3R3Round003Plan(
  plan: typeof M3_R3_ROUND_003_PLAN = M3_R3_ROUND_003_PLAN,
): typeof M3_R3_ROUND_003_PLAN {
  if (plan.schemaVersion !== M3_R3_ROUND_003_PLAN_SCHEMA_VERSION) throw new Error("M3-R3-A plan schema mismatch.");
  if (plan.researchRoundId !== M3_R3_ROUND_003_RESEARCH_ROUND_ID) throw new Error("M3-R3-A plan research round mismatch.");
  if (plan.sourceSha !== M3_R3_ROUND_003_SOURCE_SHA || plan.invalidationMergeSha !== M3_R3_ROUND_003_INVALIDATION_MERGE_SHA) {
    throw new Error("M3-R3-A plan provenance mismatch.");
  }
  if (plan.performanceStatus !== "NOT_GENERATED" || plan.performanceAuthorization !== "M3-R3-B") {
    throw new Error("M3-R3-A plan must remain pre-performance.");
  }
  if (plan.candidateCount !== 9 || stableStringify(plan.candidateIds) !== stableStringify(M3_R3_ROUND_003_CANDIDATE_IDS)) {
    throw new Error("M3-R3-A candidate registry changed.");
  }
  if (stableStringify(plan.selectorSpecs) !== stableStringify(M3_R2_ROUND_002_SELECTOR_SPECS)) {
    throw new Error("M3-R3-A selector specifications changed.");
  }
  if (plan.selectionGateSha256 !== BASELINE_002_RESEARCH_ROUND_003_SELECTION_GATE_SHA256) {
    throw new Error("M3-R3-A plan must reference the finalized Round-003 gate SHA.");
  }
  if (plan.artifactRawBinding !== "PARSE_ENVELOPE_FROM_SHA_VERIFIED_RAW_BYTES") {
    throw new Error("M3-R3-A raw artifact binding mismatch.");
  }
  if (plan.controlValidation !== "schema004 + policy003 + baseline001 + COMBINED + studyServerTime + 7500 formal + 7495 executed + zero diagnostics + no DATA_INCOMPLETE/SETTLEMENT_AMBIGUOUS") {
    throw new Error("M3-R3-A CONTROL validation precondition mismatch.");
  }
  if (plan.round001EvidenceSha256 !== M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256) {
    throw new Error("M3-R3-A Round-001 evidence SHA mismatch.");
  }
  if (stableStringify(plan.controlParity) !== stableStringify({
    formalIdentity: "formal identity SHA",
    executedIdentity: "executed identity SHA",
    aggregateValidation: "aggregate F1-F6 diagnostics",
    folds: "F1-F6 diagnostics",
  })) {
    throw new Error("M3-R3-A CONTROL parity precondition mismatch.");
  }
  if (stableStringify(plan.m3R3BRequiredStatuses) !== stableStringify({
    artifactReuseStatus: M3_R3_ROUND_003_ARTIFACT_REUSE_STATUS,
    controlValidationStatus: "PASS",
    controlParityStatus: "PASS",
  })) {
    throw new Error("M3-R3-B reuse verification statuses are not all required.");
  }
  if (createHash("sha256").update(stableStringify(plan), "utf8").digest("hex") !== M3_R3_ROUND_003_PLAN_SHA256) {
    throw new Error("M3-R3-A plan canonical SHA mismatch.");
  }
  return plan;
}
