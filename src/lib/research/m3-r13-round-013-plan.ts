import { createHash } from "node:crypto";

import { R13_FEATURE_DEFINITIONS, R13_FEATURE_NAMES, R13_FOLDS, R13_HORIZON_HOURS, R13_LABEL_CONTRACT, R13_MODEL_CONTRACT, R13_SYMBOLS, M3_R13_ACCEPTED_R11_SOURCE_SHA, M3_R13_NO_EDGE_OUTCOME, M3_R13_PERFORMANCE_LOCK, M3_R13_RESEARCH_END_ISO, M3_R13_RESEARCH_RANGE, M3_R13_RESEARCH_ROUND_ID, R13_DATA_CONTRACT, R13_EXECUTION_ALIGNMENT, R13_GOVERNANCE, R13_GATE_THRESHOLDS } from "./m3-r13-round-013-protocol.ts";
import { R13_GATE_MACHINE_RECORD, R13_HARD_GATE_IDENTITIES, R13_SELECTION_GATE_SHA256 } from "./selection-gates-round-013.ts";
import { stableStringify } from "./utils.ts";

export const M3_R13_PLAN_SCHEMA_VERSION = "m3-r13-round-013-plan-001" as const;

const featureSpecIdentity = { featureNames: R13_FEATURE_NAMES, definitions: R13_FEATURE_DEFINITIONS, featureSelection: "FIXED_NO_SEARCH" };
const modelSpecIdentity = { ...R13_MODEL_CONTRACT, featureSpecIdentity: stableStringify(featureSpecIdentity) };

export const R13_FEATURE_SPEC_SHA256 = createHash("sha256").update(stableStringify(featureSpecIdentity), "utf8").digest("hex");
export const R13_MODEL_SPEC_SHA256 = createHash("sha256").update(stableStringify(modelSpecIdentity), "utf8").digest("hex");

export const R13_PLAN = Object.freeze({
  schemaVersion: M3_R13_PLAN_SCHEMA_VERSION,
  researchRoundId: M3_R13_RESEARCH_ROUND_ID,
  acceptedSourceSha: M3_R13_ACCEPTED_R11_SOURCE_SHA,
  dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
  researchBoundary: M3_R13_RESEARCH_END_ISO,
  researchUniverse: M3_R13_RESEARCH_RANGE,
  symbols: R13_SYMBOLS,
  directions: ["LONG", "SHORT"] as const,
  folds: R13_FOLDS,
  executionAlignment: R13_EXECUTION_ALIGNMENT,
  observationUniverse: "EVERY_CANONICAL_CLOSED_1H_DECISION_TIME_X_FIVE_SYMBOLS_X_LONG_SHORT",
  control: { id: "R13-CONTROL-ALL-CLOSED-CROSS-SECTIONAL-OPPORTUNITIES", stream: "ALL_COMPLETE_CROSS_SECTIONAL_OBSERVATIONS", runExactlyOnce: true },
  featureSpec: { path: "src/lib/research/m3-r13-round-013-features.ts", sha256: R13_FEATURE_SPEC_SHA256, count: R13_FEATURE_NAMES.length, definitions: R13_FEATURE_DEFINITIONS },
  labelSpec: R13_LABEL_CONTRACT,
  modelSpec: { ...R13_MODEL_CONTRACT, sha256: R13_MODEL_SPEC_SHA256 },
  horizonHours: R13_HORIZON_HOURS,
  purgeEmbargo: { minimumHours: 24, semantics: "NO_TRAINING_LABEL_INTERVAL_OVERLAPS_VALIDATION" },
  gate: { path: "src/lib/research/selection-gates-round-013.ts", sha256: R13_SELECTION_GATE_SHA256, identities: R13_HARD_GATE_IDENTITIES, thresholds: R13_GATE_THRESHOLDS, semantics: R13_GATE_MACHINE_RECORD.semantics },
  selection: { zeroPredictionThreshold: 0, candidates: "FOUR_FIXED_HORIZONS_ONLY", tieRules: ["higher aggregate mean netForwardAtr", "if difference <= 0.02 higher 1.5x cost-stress mean", "lower maximum drawdown magnitude", "higher ATR PF", "shorter horizon", "deterministic horizon ID"], zeroEligibleOutcome: M3_R13_NO_EDGE_OUTCOME },
  acquisition: { provider: R13_DATA_CONTRACT.provider, cache: "LOCAL_RESUMABLE_IDENTITY_CHECKSUM_PAGE_CACHE", rawCacheCommitted: false, postLockMarketFetchPossible: false },
  performance: { status: "NOT_GENERATED", authorization: "NOT_AUTHORIZED", executionSourceSha: null, lock: M3_R13_PERFORMANCE_LOCK },
  governance: R13_GOVERNANCE,
  status: { baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED" },
});

export const R13_PLAN_CANONICAL_JSON = stableStringify(R13_PLAN);
export const R13_PLAN_SHA256 = createHash("sha256").update(R13_PLAN_CANONICAL_JSON, "utf8").digest("hex");

export function validateR13Plan(plan: typeof R13_PLAN = R13_PLAN): typeof R13_PLAN {
  if (plan.schemaVersion !== M3_R13_PLAN_SCHEMA_VERSION || plan.researchRoundId !== M3_R13_RESEARCH_ROUND_ID || plan.acceptedSourceSha !== M3_R13_ACCEPTED_R11_SOURCE_SHA || plan.researchBoundary !== M3_R13_RESEARCH_END_ISO) throw new Error("R13 Plan provenance mismatch.");
  if (stableStringify(plan.symbols) !== stableStringify(R13_SYMBOLS) || stableStringify(plan.folds) !== stableStringify(R13_FOLDS) || stableStringify(plan.horizonHours) !== stableStringify(R13_HORIZON_HOURS)) throw new Error("R13 Plan universe mismatch.");
  if (stableStringify(plan.featureSpec.definitions) !== stableStringify(R13_FEATURE_DEFINITIONS) || plan.featureSpec.count !== 18 || plan.featureSpec.sha256 !== R13_FEATURE_SPEC_SHA256) throw new Error("R13 Plan feature specification mismatch.");
  if (plan.modelSpec.lambda !== 10 || plan.modelSpec.sha256 !== R13_MODEL_SPEC_SHA256 || plan.modelSpec.pooledAcrossSymbols !== true || plan.modelSpec.noSymbolIdentity !== true) throw new Error("R13 Plan model specification mismatch.");
  if (plan.gate.sha256 !== R13_SELECTION_GATE_SHA256 || stableStringify(plan.gate.identities) !== stableStringify(R13_HARD_GATE_IDENTITIES)) throw new Error("R13 Plan gate identity mismatch.");
  if (plan.performance.status !== "NOT_GENERATED" || plan.performance.authorization !== "NOT_AUTHORIZED" || plan.performance.executionSourceSha !== null) throw new Error("R13 Plan performance boundary changed.");
  if (plan.status.baseline002Status !== "NOT_FROZEN" || plan.status.m3JStatus !== "BLOCKED" || plan.status.m4Status !== "NOT_STARTED") throw new Error("R13 Plan milestone boundary changed.");
  const hash = createHash("sha256").update(stableStringify(plan), "utf8").digest("hex");
  if (hash !== R13_PLAN_SHA256) throw new Error("R13 Plan canonical SHA mismatch.");
  return plan;
}
