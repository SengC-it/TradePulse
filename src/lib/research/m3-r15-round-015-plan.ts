import { createHash } from "node:crypto";

import { R15_GATE_SHA256 } from "./selection-gates-round-015.ts";
import { R15_SPEC_OBJECT, R15_SPEC_SHA256 } from "./m3-r15-round-015-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R15_PLAN_SCHEMA_VERSION = "m3-r15-round-015-plan-001" as const;

export const R15_PLAN = Object.freeze({
  schemaVersion: R15_PLAN_SCHEMA_VERSION,
  researchRoundId: R15_SPEC_OBJECT.researchRoundId,
  classification: "HISTORICAL_DEVELOPMENT_STUDY",
  acceptedR14SourceSha: R15_SPEC_OBJECT.acceptedR14SourceSha,
  sourceDatasetSha256: R15_SPEC_OBJECT.sourceDatasetSha256,
  sourceManifestSha256: R15_SPEC_OBJECT.sourceManifestSha256,
  sourceObservationSha256: R15_SPEC_OBJECT.sourceObservationSha256,
  specSha256: R15_SPEC_SHA256,
  gateSha256: R15_GATE_SHA256,
  fixedHorizonHours: 4,
  folds: R15_SPEC_OBJECT.folds,
  purgeEmbargoHours: 24,
  betaModel: R15_SPEC_OBJECT.betaModel,
  alphaModel: R15_SPEC_OBJECT.alphaModel,
  target: R15_SPEC_OBJECT.target,
  selection: R15_SPEC_OBJECT.selection,
  stress: R15_SPEC_OBJECT.stress,
  data: Object.freeze({ sourceReuse: "R14_OBSERVATIONS_READ_ONLY_AFTER_EXACT_SHA_VERIFICATION", networkAcquisition: "DISABLED", productionData: "EXCLUDED" }),
  performance: Object.freeze({ authorization: "REQUIRED_EXPLICITLY", executionCount: 1, postLockNetwork: false, checkpointing: "ATOMIC_CRASH_SAFE" }),
  governance: R15_SPEC_OBJECT.governance,
  artifactHashMethod: R15_SPEC_OBJECT.artifactHashMethod,
});

export const R15_PLAN_CANONICAL_JSON = stableStringify(R15_PLAN);
export const R15_PLAN_SHA256 = createHash("sha256").update(R15_PLAN_CANONICAL_JSON, "utf8").digest("hex");

export function validateR15Plan(plan: typeof R15_PLAN = R15_PLAN): typeof R15_PLAN {
  if (plan.schemaVersion !== R15_PLAN_SCHEMA_VERSION || plan.researchRoundId !== R15_SPEC_OBJECT.researchRoundId || plan.specSha256 !== R15_SPEC_SHA256 || plan.gateSha256 !== R15_GATE_SHA256 || plan.fixedHorizonHours !== 4 || plan.purgeEmbargoHours !== 24 || plan.performance.executionCount !== 1 || plan.performance.postLockNetwork !== false || plan.data.networkAcquisition !== "DISABLED") throw new Error("R15 Plan identity failed.");
  if (stableStringify(plan) !== R15_PLAN_CANONICAL_JSON) throw new Error("R15 Plan canonical identity failed.");
  return plan;
}
