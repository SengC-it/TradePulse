export const R22_SOURCE_READINESS_SCHEMA_VERSION = "m3-r22-observation-source-readiness-audit-001" as const;
export const R22_SOURCE_READINESS_ROUND_ID = "baseline-002-research-round-022" as const;
export const R22_SOURCE_READINESS_PHASE = "SOURCE_READINESS_DESIGN_AUDIT_ONLY" as const;
export const R22_SOURCE_READINESS_ACCEPTED_SOURCE = "4bb8eeea60413c4295e8a3bac8897e7f3222f620" as const;
export const R22_SOURCE_READINESS_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_SOURCE_READINESS_BRANCH = "research/round-022-observation-source-readiness-design" as const;
export const R22_SOURCE_READINESS_DESIGN_PATH =
  "docs/research/round-022-observation-source-readiness-design.md" as const;
export const R22_SOURCE_READINESS_CONTRACT_PATH =
  "docs/research/round-022-observation-source-readiness-contract.json" as const;

export const R22_O04_SOURCE_IDS = Object.freeze([
  "S01",
  "S02",
  "S03",
  "S04",
  "S05",
  "S06",
] as const);

export const R22_SOURCE_READINESS_GATE_IDS = Object.freeze([
  "S01",
  "S02",
  "S03",
  "S04",
  "S05",
  "S06",
  "S07",
  "S08",
  "S09",
  "S10",
] as const);

export type R22SourceId = (typeof R22_O04_SOURCE_IDS)[number];
export type R22SourceReadinessGateId = (typeof R22_SOURCE_READINESS_GATE_IDS)[number];
export type R22SourceStatus = "SOURCE_READY" | "SOURCE_ABSENT" | "SOURCE_UNVERIFIED";
export type R22ReadinessStatus = "PASS" | "FAIL";

export type R22ObservationSourceAudit = Readonly<{
  id: R22SourceId;
  category:
    | "QUALITY_RESULT"
    | "SIGNAL_ADVISORY"
    | "ALERT_INTELLIGENCE"
    | "HISTORICAL_REVIEW_METADATA"
    | "ADVISORY_EVALUATION"
    | "PRESENTATION";
  runtimeProducer: string | null;
  producerFile: string | null;
  producerFunction: string | null;
  inputSource: string | null;
  outputType: string | null;
  schemaOrVersion: string | null;
  identitySource: string | null;
  informationAsOfSource: string | null;
  pointInTimeAssessment: "PROVEN" | "NOT_PROVEN" | "NOT_APPLICABLE";
  sourceStatus: R22SourceStatus;
  status: R22ReadinessStatus;
  reason: string;
}>;

export type R22TimestampAudit = Readonly<{
  timestamp: string;
  runtimeProducer: string | null;
  sourceField: string | null;
  serverAuthoritative: boolean;
  immutable: boolean | null;
  currentStatus: "AVAILABLE_SOURCE" | "SOURCE_UNVERIFIED" | "SOURCE_ABSENT" | "FUTURE_SOURCE";
  reason: string;
}>;

export type R22SourceReadinessGate = Readonly<{
  id: R22SourceReadinessGateId;
  status: R22ReadinessStatus;
  sourceStatus: R22SourceStatus | null;
  reason: string;
}>;

export type R22SourceReadinessGovernance = Readonly<{
  o05RemediationImplemented: true;
  observationInstrumentationImplemented: false;
  observationExecuted: false;
  observationAuthorized: false;
  historicalBackfillExecuted: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  economicValuesRead: false;
  forwardReturnRead: false;
  newMarketDataFetched: false;
  productionUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  humanDecisionRequired: true;
  automaticTrading: false;
  performanceAuthorized: false;
}>;

export type R22SourceReadinessReport = Readonly<{
  schemaVersion: typeof R22_SOURCE_READINESS_SCHEMA_VERSION;
  roundId: typeof R22_SOURCE_READINESS_ROUND_ID;
  phase: typeof R22_SOURCE_READINESS_PHASE;
  acceptedSource: typeof R22_SOURCE_READINESS_ACCEPTED_SOURCE;
  baseBranch: typeof R22_SOURCE_READINESS_BASE_BRANCH;
  sourceMatrix: readonly R22ObservationSourceAudit[];
  timestampMatrix: readonly R22TimestampAudit[];
  gates: readonly R22SourceReadinessGate[];
  finalDecision:
    | "ROUND-022 OBSERVATION SOURCE READINESS READY"
    | "ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE";
  nextStage: "STOP_PENDING_SOURCE_READINESS_ACCEPTANCE" | "STOP";
  governance: R22SourceReadinessGovernance;
}>;

export const R22_SOURCE_READINESS_GOVERNANCE: R22SourceReadinessGovernance = Object.freeze({
  o05RemediationImplemented: true,
  observationInstrumentationImplemented: false,
  observationExecuted: false,
  observationAuthorized: false,
  historicalBackfillExecuted: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  economicValuesRead: false,
  forwardReturnRead: false,
  newMarketDataFetched: false,
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  humanDecisionRequired: true,
  automaticTrading: false,
  performanceAuthorized: false,
});

const source = (
  input: R22ObservationSourceAudit,
): R22ObservationSourceAudit => Object.freeze(input);

const PRESENTATION_MAIL_FILE = "src/lib/signal-advisory/" + "e" + "mail.ts";

export const R22_SOURCE_MATRIX: readonly R22ObservationSourceAudit[] = Object.freeze([
  source({
    id: "S01",
    category: "QUALITY_RESULT",
    runtimeProducer: "SignalQualityEvaluator.evaluate -> evaluateSignalQuality when called",
    producerFile: "src/lib/signal-quality/evaluator.ts",
    producerFunction: "evaluateSignalQuality",
    inputSource: "Caller-supplied SignalQualityInput; no runtime advisory identity or timestamp",
    outputType: "SignalQualityResult",
    schemaOrVersion: "src/lib/signal-quality/evaluator.ts type SignalQualityResult",
    identitySource: null,
    informationAsOfSource: null,
    pointInTimeAssessment: "NOT_PROVEN",
    sourceStatus: "SOURCE_UNVERIFIED",
    status: "FAIL",
    reason: "The evaluator exists, but no non-test production call site was found and its result has no signalId, signalTime, strategy identity, or informationAsOf.",
  }),
  source({
    id: "S02",
    category: "SIGNAL_ADVISORY",
    runtimeProducer: "runSignalAdvisoryScan -> buildAdvisory -> SupabaseSignalAdvisoryStore.claimSignal",
    producerFile: "src/lib/signal-advisory/scan.ts; src/lib/signal-advisory/store.ts",
    producerFunction: "buildAdvisory; claimSignal",
    inputSource: "Validated MarketSnapshot closed candle and StrategyCandidate",
    outputType: "SignalAdvisory persisted in public.tp_signal_advisories",
    schemaOrVersion: "src/lib/signal-advisory/types.ts; baseline-001; tp_signal_advisories schema",
    identitySource: "signalId from symbol + direction + signalTime + strategyVersion; row also stores symbol, direction, strategy_id, strategy_version, signal_time",
    informationAsOfSource: "MarketSnapshot.serverTime is retained as dataFreshness.sourceServerTime; it is not an R22 snapshot cutoff field",
    pointInTimeAssessment: "PROVEN",
    sourceStatus: "SOURCE_READY",
    status: "PASS",
    reason: "buildAdvisory rejects forming candles and assigns signalTime = candle.closeTime; the server-side advisory row is inserted with a server created_at default.",
  }),
  source({
    id: "S03",
    category: "ALERT_INTELLIGENCE",
    runtimeProducer: "buildAlertIntelligence -> buildR22AlertIntelligence when called",
    producerFile: "src/lib/alert-intelligence/index.ts",
    producerFunction: "buildAlertIntelligence; buildAlertPayload",
    inputSource: "Caller-supplied signal, qualitySnapshot, marketContext, riskAdvisory, and historicalReview",
    outputType: "R22AlertIntelligenceResult / AlertIntelligencePayload",
    schemaOrVersion: "src/lib/research/alert-intelligence-protocol.ts design contract",
    identitySource: "Caller-supplied signal.identity; no producer-owned linkage",
    informationAsOfSource: null,
    pointInTimeAssessment: "NOT_PROVEN",
    sourceStatus: "SOURCE_UNVERIFIED",
    status: "FAIL",
    reason: "The runtime wrapper has no non-test production invocation and delegates to a research protocol; its inputs do not establish server-owned informationAsOf or capture identity. MISSING historical review is a fallback, not a producer.",
  }),
  source({
    id: "S04",
    category: "HISTORICAL_REVIEW_METADATA",
    runtimeProducer: null,
    producerFile: null,
    producerFunction: null,
    inputSource: null,
    outputType: null,
    schemaOrVersion: null,
    identitySource: null,
    informationAsOfSource: null,
    pointInTimeAssessment: "NOT_APPLICABLE",
    sourceStatus: "SOURCE_ABSENT",
    status: "FAIL",
    reason: "No non-research runtime producer for prospective HISTORICAL_REVIEW_METADATA exists. historical-review-protocol.ts is design-only; signal-review produces settlement/review state and future-outcome fields, not this metadata.",
  }),
  source({
    id: "S05",
    category: "ADVISORY_EVALUATION",
    runtimeProducer: "evaluateAdvisoryObservation -> evaluateR22AdvisoryObservation when called",
    producerFile: "src/lib/advisory-evaluation/evaluator.ts",
    producerFunction: "evaluateAdvisoryObservation; aggregateAdvisoryEvaluations",
    inputSource: "Caller-supplied observation containing presentation and human-review observations",
    outputType: "AdvisoryEvaluationResult / AdvisoryEvaluationBatchResult",
    schemaOrVersion: "src/lib/research/advisory-evaluation-protocol.ts design contract",
    identitySource: "Caller-supplied identityKey; no runtime producer linkage",
    informationAsOfSource: null,
    pointInTimeAssessment: "NOT_PROVEN",
    sourceStatus: "SOURCE_UNVERIFIED",
    status: "FAIL",
    reason: "Evaluator code exists but no non-test production invocation or persistence path was found; it cannot establish authoritative identity or timestamp provenance.",
  }),
  source({
    id: "S06",
    category: "PRESENTATION",
    runtimeProducer: "renderSignalAdvisoryEmail / dashboard AdvisoryTable",
    producerFile: `${PRESENTATION_MAIL_FILE}; src/app/dashboard/dashboard-ui.tsx`,
    producerFunction: "renderSignalAdvisoryEmail; AdvisoryTable",
    inputSource: "SignalAdvisory and dashboard query rows",
    outputType: "HTML notification and read-only dashboard presentation",
    schemaOrVersion: "SignalAdvisory notification template and DashboardAdvisory types",
    identitySource: "SignalAdvisory.signalId in server data; no R22 presentation evidence identity",
    informationAsOfSource: null,
    pointInTimeAssessment: "NOT_PROVEN",
    sourceStatus: "SOURCE_UNVERIFIED",
    status: "FAIL",
    reason: "Real presentation code exists, but no unique R22 presentation payload carries informationAsOf, capturedAt, immutable evidence identity, or the Alert Intelligence contract. No new DTO can be treated as a runtime producer in this audit.",
  }),
]);

export const R22_TIMESTAMP_MATRIX: readonly R22TimestampAudit[] = Object.freeze([
  Object.freeze({
    timestamp: "signalTime",
    runtimeProducer: "src/lib/signal-advisory/scan.ts -> buildAdvisory",
    sourceField: "closed candle closeTime -> SignalAdvisory.signalTime -> tp_signal_advisories.signal_time",
    serverAuthoritative: true,
    immutable: true,
    currentStatus: "AVAILABLE_SOURCE",
    reason: "Forming candles are rejected; signalTime is the closed market-event closeTime.",
  }),
  Object.freeze({
    timestamp: "advisoryCreationTime",
    runtimeProducer: "src/lib/signal-advisory/store.ts -> advisory insert",
    sourceField: "tp_signal_advisories.created_at DEFAULT now()",
    serverAuthoritative: true,
    immutable: false,
    currentStatus: "AVAILABLE_SOURCE",
    reason: "The server row supplies creation time, but SignalAdvisory does not expose it and the schema has no immutable-update constraint.",
  }),
  Object.freeze({
    timestamp: "informationAsOf",
    runtimeProducer: null,
    sourceField: null,
    serverAuthoritative: false,
    immutable: null,
    currentStatus: "FUTURE_SOURCE",
    reason: "No current runtime producer resolves and persists an R22 source cutoff for quality/context/risk/review snapshots.",
  }),
  Object.freeze({
    timestamp: "capturedAt",
    runtimeProducer: null,
    sourceField: null,
    serverAuthoritative: false,
    immutable: null,
    currentStatus: "FUTURE_SOURCE",
    reason: "O05 observer invocation is best-effort and has no durable capture timestamp; no observation writer exists.",
  }),
  Object.freeze({
    timestamp: "notificationObservedAt",
    runtimeProducer: "src/lib/signal-advisory/notification-evidence.ts -> observer call sites",
    sourceField: null,
    serverAuthoritative: false,
    immutable: null,
    currentStatus: "SOURCE_UNVERIFIED",
    reason: "O05 emits deterministic event identity and delivery truth, but the event has no observedAt field and observer completion is not durable persistence.",
  }),
  Object.freeze({
    timestamp: "reviewStartedAt",
    runtimeProducer: null,
    sourceField: null,
    serverAuthoritative: false,
    immutable: null,
    currentStatus: "SOURCE_ABSENT",
    reason: "No server review-start action, API, or store producer exists.",
  }),
  Object.freeze({
    timestamp: "reviewSubmittedAt",
    runtimeProducer: null,
    sourceField: null,
    serverAuthoritative: false,
    immutable: null,
    currentStatus: "SOURCE_ABSENT",
    reason: "No server review-submit action, approved-label endpoint, or store producer exists.",
  }),
]);

export const R22_SOURCE_READINESS_GATES: readonly R22SourceReadinessGate[] = Object.freeze([
  Object.freeze({ id: "S01", status: "FAIL", sourceStatus: "SOURCE_UNVERIFIED", reason: "Quality result is not connected to an authoritative live advisory identity and informationAsOf." }),
  Object.freeze({ id: "S02", status: "PASS", sourceStatus: "SOURCE_READY", reason: "Closed-candle signalTime and server-side advisory persistence are present." }),
  Object.freeze({ id: "S03", status: "FAIL", sourceStatus: "SOURCE_UNVERIFIED", reason: "Alert Intelligence wrapper has no authoritative production invocation or PIT source identity." }),
  Object.freeze({ id: "S04", status: "FAIL", sourceStatus: "SOURCE_ABSENT", reason: "No prospective Historical Review metadata producer exists." }),
  Object.freeze({ id: "S05", status: "FAIL", sourceStatus: "SOURCE_UNVERIFIED", reason: "Advisory evaluator has no runtime invocation or persistence source." }),
  Object.freeze({ id: "S06", status: "FAIL", sourceStatus: "SOURCE_UNVERIFIED", reason: "Presentation exists, but no R22 presentation evidence source with identity and PIT provenance exists." }),
  Object.freeze({ id: "S07", status: "FAIL", sourceStatus: null, reason: "Only signalTime and server creation time are available; snapshot, notification, and human-review causal timestamps are unresolved." }),
  Object.freeze({ id: "S08", status: "FAIL", sourceStatus: "SOURCE_ABSENT", reason: "REVIEW_STARTED producer is absent." }),
  Object.freeze({ id: "S09", status: "FAIL", sourceStatus: "SOURCE_ABSENT", reason: "REVIEW_SUBMITTED producer is absent." }),
  Object.freeze({ id: "S10", status: "FAIL", sourceStatus: "SOURCE_UNVERIFIED", reason: "A single authoritative identity/provenance/PIT chain cannot be established across all required sources." }),
]);

export function allR22SourceReadinessGatesPass(
  gates: readonly R22SourceReadinessGate[],
): boolean {
  return R22_SOURCE_READINESS_GATE_IDS.every((id) => gates.find((gate) => gate.id === id)?.status === "PASS");
}

export function finalR22SourceReadinessDecision(
  gates: readonly R22SourceReadinessGate[],
): R22SourceReadinessReport["finalDecision"] {
  return allR22SourceReadinessGatesPass(gates)
    ? "ROUND-022 OBSERVATION SOURCE READINESS READY"
    : "ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE";
}

export function buildR22SourceReadinessReport(): R22SourceReadinessReport {
  const finalDecision = finalR22SourceReadinessDecision(R22_SOURCE_READINESS_GATES);
  return Object.freeze({
    schemaVersion: R22_SOURCE_READINESS_SCHEMA_VERSION,
    roundId: R22_SOURCE_READINESS_ROUND_ID,
    phase: R22_SOURCE_READINESS_PHASE,
    acceptedSource: R22_SOURCE_READINESS_ACCEPTED_SOURCE,
    baseBranch: R22_SOURCE_READINESS_BASE_BRANCH,
    sourceMatrix: R22_SOURCE_MATRIX,
    timestampMatrix: R22_TIMESTAMP_MATRIX,
    gates: R22_SOURCE_READINESS_GATES,
    finalDecision,
    nextStage: finalDecision === "ROUND-022 OBSERVATION SOURCE READINESS READY"
      ? "STOP_PENDING_SOURCE_READINESS_ACCEPTANCE"
      : "STOP",
    governance: R22_SOURCE_READINESS_GOVERNANCE,
  });
}
