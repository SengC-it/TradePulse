import {
  R22_OBSERVATION_ARTIFACT_TYPES,
  R22_OBSERVATION_SCHEMA_VERSION,
} from "../observation-evidence/types.ts";

export const R22_R10_ACCEPTED_SOURCE = "9afcfdc7c0b59d6637dc5b7719b6a76530c9d373" as const;
export const R22_R10_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_R10_BRANCH = "research/round-022-r10-advisory-evaluation-evidence-completeness" as const;
export const R22_R10_PHASE =
  "R10_ADVISORY_EVALUATION_EVIDENCE_COMPLETENESS_IMPLEMENTATION_ONLY" as const;
export const R22_R10_SCHEMA_VERSION = "m3-r22-r10-advisory-evaluation-evidence-completeness-001" as const;

export const R22_R10_REQUIRED_SNAPSHOT_ARTIFACT_TYPES = Object.freeze([
  "QUALITY_SNAPSHOT",
  "MARKET_CONTEXT",
  "RISK_ADVISORY",
  "HISTORICAL_REVIEW_METADATA",
  "ALERT_INTELLIGENCE",
  "PRESENTATION",
] as const satisfies readonly (typeof R22_OBSERVATION_ARTIFACT_TYPES[number])[]);

export const R22_R10_REQUIRED_EVIDENCE_SOURCES = Object.freeze([
  "P01_SIGNAL_IDENTITY",
  "S01_QUALITY_SNAPSHOT",
  "S02_MARKET_CONTEXT",
  "S03_RISK_ADVISORY",
  "S04_HISTORICAL_REVIEW_METADATA",
  "S05_ALERT_INTELLIGENCE",
  "S06_PRESENTATION",
  "R8_NOTIFICATION_CAUSAL_EVIDENCE",
  "S07_TIMESTAMP_CAUSALITY",
  "S08_REVIEW_STARTED",
  "S09_REVIEW_SUBMITTED",
] as const);

export const R22_R10_FORBIDDEN_EVALUATION_INPUTS = Object.freeze([
  "pnl",
  "profit",
  "loss",
  "return",
  "forwardReturn",
  "futurePrice",
  "realizedPnL",
  "performance",
  "winLoss",
  "drawdown",
] as const);

export const R22_R10_P02_SOURCE_MAPPING = Object.freeze({
  signalIdentity: "P01_SIGNAL_IDENTITY",
  qualitySnapshot: "S01_QUALITY_SNAPSHOT",
  marketContext: "S02_MARKET_CONTEXT",
  riskAdvisory: "S03_RISK_ADVISORY",
  historicalReviewMetadata: "S04_HISTORICAL_REVIEW_METADATA",
  alertIntelligence: "S05_ALERT_INTELLIGENCE",
  presentation: "S06_PRESENTATION",
  notificationDisposition: "R8_NOTIFICATION_CAUSAL_EVIDENCE",
  unnecessaryAlert: "S09_REVIEW_SUBMITTED_EXPLICIT_LABEL",
  humanReview: "S08_REVIEW_STARTED_AND_S09_REVIEW_SUBMITTED",
} as const);

export type R22R10Status = Readonly<{
  phase: typeof R22_R10_PHASE;
  schemaVersion: typeof R22_R10_SCHEMA_VERSION;
  acceptedSource: typeof R22_R10_ACCEPTED_SOURCE;
  r10AcceptanceStatus: "ACCEPTED";
  r10AdvisoryEvaluationEvidenceCompletenessImplemented: true;
  introducesCapabilities: readonly ["advisoryEvaluationEvidenceCompleteness"];
  closesReadinessNodes: readonly ["S10"];
  s01Status: "SOURCE_READY";
  s02Status: "SOURCE_READY";
  s03Status: "SOURCE_READY";
  s04Status: "SOURCE_READY";
  s05Status: "SOURCE_READY";
  s06Status: "SOURCE_READY";
  s07Status: "SOURCE_READY";
  s08Status: "SOURCE_READY";
  s09Status: "SOURCE_READY";
  s10ImplementationStatus: "SOURCE_READY";
  s10AcceptedReady: true;
  observationInstrumentationImplemented: false;
  observationAuthorized: false;
  observationExecuted: false;
  performanceAuthorized: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  economicValuesRead: false;
  forwardReturnRead: false;
  newMarketDataFetched: false;
  historicalBackfillExecuted: false;
  productionUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

export const R22_R10_STATUS: R22R10Status = Object.freeze({
  phase: R22_R10_PHASE,
  schemaVersion: R22_R10_SCHEMA_VERSION,
  acceptedSource: R22_R10_ACCEPTED_SOURCE,
  r10AcceptanceStatus: "ACCEPTED",
  r10AdvisoryEvaluationEvidenceCompletenessImplemented: true,
  introducesCapabilities: Object.freeze(["advisoryEvaluationEvidenceCompleteness"] as const),
  closesReadinessNodes: Object.freeze(["S10"] as const),
  s01Status: "SOURCE_READY",
  s02Status: "SOURCE_READY",
  s03Status: "SOURCE_READY",
  s04Status: "SOURCE_READY",
  s05Status: "SOURCE_READY",
  s06Status: "SOURCE_READY",
  s07Status: "SOURCE_READY",
  s08Status: "SOURCE_READY",
  s09Status: "SOURCE_READY",
  s10ImplementationStatus: "SOURCE_READY",
  s10AcceptedReady: true,
  observationInstrumentationImplemented: false,
  observationAuthorized: false,
  observationExecuted: false,
  performanceAuthorized: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  economicValuesRead: false,
  forwardReturnRead: false,
  newMarketDataFetched: false,
  historicalBackfillExecuted: false,
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  humanDecisionRequired: true,
  automaticTrading: false,
});

export const R22_R10_FINAL_DECISION = Object.freeze({
  decision: "ROUND-022 R10 ACCEPTANCE CLOSURE — ACCEPTED",
  nextStage: "STOP_PENDING_R10_CLOSURE_ACCEPTANCE",
} as const);

export const R22_R10_EVIDENCE_COMPLETENESS_CONTRACT = Object.freeze({
  schemaVersion: R22_R10_SCHEMA_VERSION,
  observationEvidenceSchemaVersion: R22_OBSERVATION_SCHEMA_VERSION,
  readOnly: true,
  requiredSnapshotArtifactTypes: R22_R10_REQUIRED_SNAPSHOT_ARTIFACT_TYPES,
  requiredEvidenceSources: R22_R10_REQUIRED_EVIDENCE_SOURCES,
  validation: Object.freeze([
    "P01 identity must match every returned evidence row exactly",
    "R1 candidate validators verify canonical payload, sourceRef, hashes, idempotency, PIT, causality, and append-only identity",
    "S01-S06 must each have exactly one valid snapshot artifact",
    "R8 notification evidence must contain an authoritative claim or terminal disposition and no logical conflict",
    "S08 REVIEW_STARTED and S09 REVIEW_SUBMITTED must each be present exactly once",
    "Any missing, mismatched, duplicate, corrupt, or forbidden field is NOT_EVALUABLE",
    "No UPDATE, repair, backdate, fuzzy match, nearest timestamp match, or reconstruction is allowed",
  ]),
  p02SourceMapping: R22_R10_P02_SOURCE_MAPPING,
  forbiddenEvaluationInputs: R22_R10_FORBIDDEN_EVALUATION_INPUTS,
  governance: Object.freeze({
    performanceExecutionCount: 0,
    performanceLedgerPresent: false,
    economicValuesRead: false,
    forwardReturnRead: false,
    newMarketDataFetched: false,
    automaticTrading: false,
    humanDecisionRequired: true,
    productionUnchanged: true,
  }),
});
