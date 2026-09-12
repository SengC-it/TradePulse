export const R22_R9_ACCEPTED_SOURCE = "b393334ec7203e6eb08565aaad413ef269bd8147" as const;
export const R22_R9_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_R9_BRANCH = "research/round-022-r9-human-review-causal-lifecycle" as const;
export const R22_R9_PHASE = "R9_HUMAN_REVIEW_CAUSAL_LIFECYCLE_IMPLEMENTATION_ONLY" as const;

export const R22_R9_HUMAN_REVIEW_CONTRACT = Object.freeze({
  reviewObservationId: "R22_REVIEW|signalId|m3-r22-observation-instrumentation-design-002",
  eventKind: "REVIEW",
  eventTypes: Object.freeze(["REVIEW_STARTED", "REVIEW_SUBMITTED"]),
  startIdempotency: "REVIEW|reviewObservationId|START",
  submitIdempotency: "REVIEW|reviewObservationId|SUBMIT",
  causalInvariant: "signalTime <= reviewStartedAt <= reviewSubmittedAt",
  capturedAtAuthority: "SERVER_WALL_CLOCK",
  sourceRef: "tp_signal_advisories:<signalId>",
  startPayload: "identity and lifecycle metadata only; no human labels",
  submitLabels: Object.freeze([
    "reviewComplete",
    "informationSufficient",
    "unnecessaryAlert",
  ]),
  labelSource: "EXPLICIT_HUMAN_LABEL",
  decisionLatencyProxy: "reviewSubmittedAt - reviewStartedAt; descriptive only; never upstream",
  evidenceStore: "Existing tp_observation_evidence through SupabaseObservationEvidenceStore",
  migration: "NO_NEW_MIGRATION",
  forbiddenSource: "Legacy settlement review ledgers are not R22 human-review evidence.",
  prohibitedInputs: Object.freeze([
    "future outcome",
    "forward return",
    "trade result",
    "settlement state",
    "market-data acquisition",
  ]),
  humanDecisionRequired: true,
  automaticTrading: false,
} as const);

export const R22_R9_STATUS = Object.freeze({
  r6AcceptanceStatus: "ACCEPTED",
  r7AcceptanceStatus: "ACCEPTED",
  r8AcceptanceStatus: "ACCEPTED",
  r9AcceptanceStatus: "ACCEPTED",
  r9HumanReviewLifecycleImplemented: true,
  introducesCapabilities: Object.freeze([
    "reviewStarted",
    "reviewSubmitted",
    "humanReviewCausality",
  ]),
  closesReadinessNodes: Object.freeze(["S07", "S08", "S09"]),
  s01Status: "SOURCE_READY",
  s02Status: "SOURCE_READY",
  s03Status: "SOURCE_READY",
  s04Status: "SOURCE_READY",
  s04AcceptedReady: true,
  s05Status: "SOURCE_READY",
  s05AcceptedReady: true,
  s06Status: "SOURCE_READY",
  s06AcceptedReady: true,
  s07Status: "SOURCE_READY",
  s07AcceptedReady: true,
  s08Status: "SOURCE_READY",
  s08AcceptedReady: true,
  s09Status: "SOURCE_READY",
  s09AcceptedReady: true,
  s10Status: "FAIL",
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
  r10Started: false,
} as const);

export const R22_R9_FINAL_DECISION = Object.freeze({
  decision: "ROUND-022 R9 ACCEPTANCE CLOSURE — ACCEPTED",
  nextStage: "STOP_PENDING_R9_CLOSURE_ACCEPTANCE",
  performanceAuthorized: false,
  observationAuthorized: false,
  r10Started: false,
} as const);

export function isR22R9ImplementationReady(): boolean {
  return R22_R9_STATUS.r9HumanReviewLifecycleImplemented
    && R22_R9_STATUS.closesReadinessNodes.join(",") === "S07,S08,S09"
    && R22_R9_STATUS.r9AcceptanceStatus === "ACCEPTED"
    && R22_R9_STATUS.s07Status === "SOURCE_READY"
    && R22_R9_STATUS.s08Status === "SOURCE_READY"
    && R22_R9_STATUS.s09Status === "SOURCE_READY"
    && R22_R9_STATUS.s07AcceptedReady === true
    && R22_R9_STATUS.s08AcceptedReady === true
    && R22_R9_STATUS.s09AcceptedReady === true
    && R22_R9_STATUS.s10Status === "FAIL"
    && R22_R9_STATUS.observationAuthorized === false
    && R22_R9_STATUS.observationExecuted === false
    && R22_R9_STATUS.performanceExecutionCount === 0
    && R22_R9_STATUS.automaticTrading === false;
}
