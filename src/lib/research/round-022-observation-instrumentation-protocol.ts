import { createHash } from "node:crypto";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { stableStringify } from "./utils.ts";

export const R22_OBSERVATION_INSTRUMENTATION_SCHEMA_VERSION = "m3-r22-observation-instrumentation-design-002" as const;
export const R22_OBSERVATION_INSTRUMENTATION_ROUND_ID = "baseline-002-research-round-022" as const;
export const R22_OBSERVATION_INSTRUMENTATION_PHASE = "OBSERVATION_INSTRUMENTATION_DESIGN_ONLY" as const;
export const R22_OBSERVATION_INSTRUMENTATION_ACCEPTED_SOURCE = "3df85901f36e1f6feced5ad3b3f4a8329c731250" as const;
export const R22_OBSERVATION_INSTRUMENTATION_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_OBSERVATION_INSTRUMENTATION_BRANCH = "research/round-022-observation-instrumentation-design" as const;
export const R22_OBSERVATION_INSTRUMENTATION_CONTRACT_PATH = "docs/research/round-022-observation-instrumentation-contract.json" as const;
export const R22_OBSERVATION_INSTRUMENTATION_DESIGN_PATH = "docs/research/round-022-observation-instrumentation-design.md" as const;

export const R22_SNAPSHOT_ARTIFACT_TYPES = Object.freeze([
  "QUALITY_SNAPSHOT",
  "MARKET_CONTEXT",
  "RISK_ADVISORY",
  "HISTORICAL_REVIEW_METADATA",
  "ALERT_INTELLIGENCE",
  "PRESENTATION",
] as const);
export type R22SnapshotArtifactType = (typeof R22_SNAPSHOT_ARTIFACT_TYPES)[number];

export const R22_NOTIFICATION_DISPOSITIONS = Object.freeze([
  "DELIVERED",
  "SUPPRESSED",
  "DUPLICATE_SKIPPED",
  "DELIVERY_FAILED",
  "IGNORED",
] as const);
export type R22NotificationDisposition = (typeof R22_NOTIFICATION_DISPOSITIONS)[number];

export const R22_NOTIFICATION_EVIDENCE_SOURCES = Object.freeze([
  "SERVER_DELIVERY_EVENT",
  "SERVER_EXPIRED_SKIP_EVENT",
  "SERVER_DUPLICATE_SKIP_EVENT",
  "SERVER_DELIVERY_FAILURE_EVENT",
  "EXPLICIT_HUMAN_OR_UI",
] as const);
export type R22NotificationEvidenceSource = (typeof R22_NOTIFICATION_EVIDENCE_SOURCES)[number];

export const R22_NOTIFICATION_DELIVERY_FAILURE_EVENT = "NOTIFICATION_DELIVERY_FAILED" as const;
export const R22_NOTIFICATION_FAILURE_CODES = Object.freeze([
  "SMTP_AUTH_FAILED",
  "SMTP_DELIVERY_FAILED",
  "EMAIL_CONFIGURATION_INVALID",
] as const);
export type R22NotificationFailureCode = (typeof R22_NOTIFICATION_FAILURE_CODES)[number];

export const R22_NOTIFICATION_ATTEMPT_SEQUENCE_SOURCE = Object.freeze({
  initialClaim: "tp_signal_advisories.attempt_count=1 in advisoryRow()",
  retryClaim: "public.tp_retry_signal_advisory increments attempt_count under CAS and returns RETRY_CLAIMED",
  duplicateSkip: "claimSignal() returns SKIPPED_DUPLICATE but does not return attempt_count",
  expiredSkip: "claimSignal() returns SKIPPED_EXPIRED but does not return attempt_count",
  currentStatus: "UNRESOLVED_CURRENT_SOURCE",
  designConsequence: "O05_DESIGN_INELIGIBLE_UNTIL_AUTHORITATIVE_ATTEMPT_SEQUENCE_IS_RETURNED",
} as const);

export const R22_OBSERVATION_GATE_DESIGN_STATUSES = Object.freeze([
  "DESIGN_READY",
  "DESIGN_INELIGIBLE",
] as const);
export type R22ObservationGateDesignStatus = (typeof R22_OBSERVATION_GATE_DESIGN_STATUSES)[number];

export const R22_FORBIDDEN_ECONOMIC_FIELD_NAMES = Object.freeze([
  "PnL",
  "profit",
  "loss",
  "return",
  "forwardReturn",
  "futurePrice",
  "futureCandle",
  "win",
  "lossLabel",
  "takeProfitHit",
  "stopLossHit",
  "profitFactor",
  "Sharpe",
  "Calmar",
  "drawdown",
  "expectedReturn",
  "tradeOutcome",
  "economicOutcome",
  "realizedPnL",
  "unrealizedPnL",
] as const);

export const R22_SERVER_TIMESTAMP_POLICY = Object.freeze({
  capturedAt: "server wall-clock now at artifact construction/persistence",
  informationAsOf: "server-resolved source cutoff, never supplied by a user",
  canonicalFormat: "UTC ISO-8601 with millisecond precision and Z suffix",
  userSuppliedCapturedAt: false,
  userSuppliedInformationAsOf: false,
  backdatingAllowed: false,
  mutationAllowed: false,
} as const);

export const R22_APPEND_ONLY_POLICY = Object.freeze({
  operation: "APPEND",
  replacement: "A new artifact version uses a new artifactId and may reference supersedesArtifactId.",
  updateAllowed: false,
  deleteAllowed: false,
  overwriteAllowed: false,
  retryRule: "The same idempotency key is an idempotent replay, never an UPDATE.",
} as const);

export const R22_TIMESTAMP_DESIGNS = Object.freeze([
  {
    timestampName: "signalTime",
    producerModule: "src/lib/signal-advisory/scan.ts",
    capturePoint: "buildAdvisory() receives the closed candle closeTime",
    persistenceDestination: "public.tp_signal_advisories.signal_time",
    idempotencyKey: "signalId = symbol|direction|signalTime|strategyVersion hash",
    immutability: "IMMUTABLE",
    serverAuthoritative: true,
    currentCaptureStatus: "AVAILABLE_SOURCE",
    designStatus: "DESIGN_READY",
  },
  {
    timestampName: "advisoryCreationTime",
    producerModule: "src/lib/signal-advisory/store.ts",
    capturePoint: "server-side advisory insert; persisted created_at; never a client timestamp",
    persistenceDestination: "public.tp_signal_advisories.created_at",
    idempotencyKey: "signal_id primary key",
    immutability: "IMMUTABLE",
    serverAuthoritative: true,
    currentCaptureStatus: "AVAILABLE_SOURCE",
    designStatus: "DESIGN_READY",
  },
  {
    timestampName: "informationAsOf",
    producerModule: "future R22 snapshot instrumentation at each existing quality/context/risk/review producer",
    capturePoint: "server resolves the source-data cutoff before constructing the snapshot",
    persistenceDestination: "future append-only tp_observation_evidence.information_as_of",
    idempotencyKey: "SHA-256(SNAPSHOT|signalId|artifactType|schemaVersion|informationAsOf|contentHash)",
    immutability: "IMMUTABLE",
    serverAuthoritative: true,
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    designStatus: "DESIGN_READY",
  },
  {
    timestampName: "capturedAt",
    producerModule: "future R22 snapshot instrumentation at artifact construction/persistence",
    capturePoint: "server wall-clock now immediately before append; not derived from signalTime",
    persistenceDestination: "future append-only tp_observation_evidence.captured_at",
    idempotencyKey: "SHA-256(SNAPSHOT|signalId|artifactType|schemaVersion|informationAsOf|contentHash)",
    immutability: "IMMUTABLE",
    serverAuthoritative: true,
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    designStatus: "DESIGN_READY",
  },
  {
    timestampName: "notification.observedAt",
    producerModule: "future notification observation sidecar around src/lib/signal-advisory/scan.ts delivery/dedup events",
    capturePoint: "server records the delivery, suppression, or duplicate-skip event when it occurs",
    persistenceDestination: "future append-only tp_observation_evidence.observed_at",
    idempotencyKey: "advisoryIdentity|channel|attemptSequence; authoritative source currently unresolved",
    immutability: "IMMUTABLE",
    serverAuthoritative: true,
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    designStatus: "DESIGN_READY",
  },
  {
    timestampName: "reviewStartedAt",
    producerModule: "future human-review instrumentation at the review start action",
    capturePoint: "server records the review-start action; the user cannot submit the timestamp",
    persistenceDestination: "future append-only tp_observation_evidence.review_started_at",
    idempotencyKey: "REVIEW|reviewObservationId|START",
    immutability: "IMMUTABLE",
    serverAuthoritative: true,
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    designStatus: "DESIGN_READY",
  },
  {
    timestampName: "reviewSubmittedAt",
    producerModule: "future human-review instrumentation at the review submit action",
    capturePoint: "server records the submit action; the user submits labels only",
    persistenceDestination: "future append-only tp_observation_evidence.review_submitted_at",
    idempotencyKey: "REVIEW|reviewObservationId|SUBMIT",
    immutability: "IMMUTABLE",
    serverAuthoritative: true,
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    designStatus: "DESIGN_READY",
  },
] as const);

export type R22AdvisoryIdentity = Readonly<{
  signalId: string;
  symbol: ResearchSymbol;
  direction: "LONG" | "SHORT";
  signalTime: string;
  strategyId: string;
  strategyVersion: string;
}>;

export type R22TimestampAuthority = Readonly<{
  capturedAtAuthority: "SERVER_WALL_CLOCK";
  informationAsOfAuthority: "SERVER_SOURCE_CUTOFF";
  userSuppliedCapturedAt: false;
  userSuppliedInformationAsOf: false;
  backdated: false;
}>;

export type R22SnapshotArtifact = Readonly<{
  evidenceId: string;
  artifactId: string;
  artifactType: R22SnapshotArtifactType;
  schemaVersion: string;
  advisoryIdentity: R22AdvisoryIdentity;
  informationAsOf: string;
  capturedAt: string;
  sourceRef: string;
  contentHash: string;
  evidenceHash: string;
  payload: unknown;
  idempotencyKey: string;
  supersedesArtifactId: string | null;
  timestampAuthority: R22TimestampAuthority;
  persistenceOperation: "APPEND";
}>;

export type R22SnapshotValidation = Readonly<{
  status: "OBSERVABLE" | "NOT_EVALUABLE";
  artifactId: string;
  reason:
    | "NONE"
    | "MISSING_IDENTITY"
    | "INVALID_ARTIFACT_TYPE"
    | "INVALID_SCHEMA_VERSION"
    | "MISSING_PROVENANCE"
    | "INVALID_TIMESTAMP"
    | "INFORMATION_AFTER_SIGNAL"
    | "CAPTURE_BEFORE_SIGNAL"
    | "CAPTURE_BEFORE_INFORMATION_AS_OF"
    | "TIMESTAMP_AUTHORITY_INVALID"
    | "NON_CANONICAL_PAYLOAD"
    | "CONTENT_HASH_INVALID"
    | "CONTENT_HASH_MISMATCH"
    | "EVIDENCE_HASH_INVALID"
    | "EVIDENCE_HASH_MISMATCH"
    | "IDEMPOTENCY_KEY_MISMATCH"
    | "FORBIDDEN_ECONOMIC_FIELD"
    | "APPEND_ONLY_VIOLATION";
  forbiddenField: string | null;
  expectedContentHash: string | null;
  expectedEvidenceHash: string | null;
  expectedIdempotencyKey: string | null;
}>;

export type R22NotificationObservation = Readonly<{
  evidenceId: string;
  notificationObservationId: string;
  advisoryIdentity: R22AdvisoryIdentity;
  channel: "EMAIL" | "WEB";
  attemptSequence: number;
  observedAt: string;
  disposition: R22NotificationDisposition;
  evidenceSource: R22NotificationEvidenceSource | null;
  suppressionReason: "EXPIRED" | null;
  deliveryFailureCode: R22NotificationFailureCode | null;
  idempotencyKey: string;
}>;

export type R22NotificationValidation = Readonly<{
  status: "OBSERVABLE" | "NOT_EVALUABLE" | "INSTRUMENTATION_UNRESOLVED";
  notificationObservationId: string;
  reason:
    | "NONE"
    | "MISSING_IDENTITY"
    | "INVALID_TIMESTAMP"
    | "NOTIFICATION_BEFORE_SIGNAL"
    | "INVALID_ATTEMPT_SEQUENCE"
    | "MISSING_EVIDENCE_SOURCE"
    | "NOTIFICATION_IDEMPOTENCY_KEY_MISMATCH"
    | "SUPPRESSION_REASON_REQUIRED"
    | "DELIVERY_FAILURE_CODE_REQUIRED"
    | "IGNORED_NOT_EXPLICITLY_OBSERVED";
  disposition: R22NotificationDisposition | "INSTRUMENTATION_UNRESOLVED";
}>;

export type R22HumanReviewObservation = Readonly<{
  evidenceId: string;
  reviewObservationId: string;
  eventType: "REVIEW_STARTED" | "REVIEW_SUBMITTED";
  advisoryIdentity: R22AdvisoryIdentity;
  reviewStartedAt: string;
  reviewSubmittedAt: string | null;
  reviewComplete: boolean | null;
  informationSufficient: boolean | null;
  unnecessaryAlert: boolean | null;
  labelSource: "EXPLICIT_HUMAN_LABEL" | null;
  idempotencyKey: string;
}>;

export type R22HumanReviewValidation = Readonly<{
  status: "OBSERVABLE" | "NOT_EVALUABLE";
  reviewObservationId: string;
  reason:
    | "NONE"
    | "MISSING_IDENTITY"
    | "INVALID_TIMESTAMP"
    | "REVIEW_BEFORE_SIGNAL"
    | "REVIEW_TIMESTAMP_INVERSION"
    | "MISSING_HUMAN_LABEL_SOURCE"
    | "INVALID_EVENT_TYPE"
    | "REVIEW_IDEMPOTENCY_KEY_MISMATCH"
    | "START_FIELDS_MUST_BE_EMPTY"
    | "SUBMIT_FIELDS_REQUIRED";
}>;

export type R22AppendOnlyWriteValidation = Readonly<{
  status: "APPEND" | "IDEMPOTENT_REPLAY" | "NOT_EVALUABLE";
  reason: "NONE" | "IDEMPOTENCY_REPLAY" | "EVIDENCE_ID_REUSE" | "SUPERSEDES_SELF" | "MISSING_EVIDENCE_ID";
}>;

export type R22InstrumentationGate = Readonly<{
  id: "O03" | "O04" | "O05" | "O06";
  runtimeStatus: "INSTRUMENTATION_REQUIRED";
  designStatus: R22ObservationGateDesignStatus;
  currentCaptureStatus: "AVAILABLE_SOURCE" | "UNRESOLVED_CURRENT_SOURCE";
  rule: string;
}>;

export const R22_INSTRUMENTATION_GATES: readonly R22InstrumentationGate[] = Object.freeze([
  {
    id: "O03",
    runtimeStatus: "INSTRUMENTATION_REQUIRED",
    designStatus: "DESIGN_READY",
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    rule: "All server-side signal, advisory, notification, and review timestamps use causal UTC capture points.",
  },
  {
    id: "O04",
    runtimeStatus: "INSTRUMENTATION_REQUIRED",
    designStatus: "DESIGN_READY",
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    rule: "Six required snapshots use immutable identity, source, hash, informationAsOf, capturedAt, and append-only provenance.",
  },
  {
    id: "O05",
    runtimeStatus: "INSTRUMENTATION_REQUIRED",
    designStatus: "DESIGN_INELIGIBLE",
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    rule: "Runtime disposition mappings are known, but claimSignal() does not return authoritative attempt_count for skip/failure evidence; O05 is ineligible until the sequence is returned at the capture point.",
  },
  {
    id: "O06",
    runtimeStatus: "INSTRUMENTATION_REQUIRED",
    designStatus: "DESIGN_READY",
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    rule: "Review start/submit timestamps are server-captured and review labels are explicit user inputs only.",
  },
]);

export const R22_PERSISTENCE_DESIGN = Object.freeze({
  table: "future tp_observation_evidence; no migration in this design-only task",
  model: "one discriminated append-only evidence table with typed event columns and metadata-only payload",
  primaryKey: "evidence_id",
  logicalIdentifiers: {
    snapshot: "artifact_id; unique where event_kind=SNAPSHOT",
    notification: "notification_observation_id; unique where event_kind=NOTIFICATION",
    review: "(review_observation_id,event_type); unique where event_kind=REVIEW",
  },
  advisoryIdentity: "foreign-key-compatible with public.tp_signal_advisories.signal_id when the event is advisory-scoped",
  uniqueConstraints: [
    "idempotency_key",
    "artifact_id WHERE event_kind=SNAPSHOT",
    "notification_observation_id WHERE event_kind=NOTIFICATION",
    "(review_observation_id,event_type) WHERE event_kind=REVIEW",
  ],
  serviceBoundary: "server-side service role writer only; no browser or direct authenticated write",
  retention: "retain immutable evidence according to the future approved retention policy; no overwrite/delete in the observation window",
  timestamps: "server UTC timestamptz columns; capturedAt and informationAsOf are immutable",
  schemaVersion: "mandatory on every row",
  hash: "contentHash is the stable logical snapshot hash; evidenceHash covers the saved evidence identity and capture timestamp",
  rls: "enabled; anon and authenticated direct access denied; service-side writer/read path only",
});

export const R22_IDEMPOTENCY_DESIGN = Object.freeze({
  snapshotContentHash: "SHA-256(stableJson(schemaVersion,artifactType,advisoryIdentity,informationAsOf,sourceRef,payload))",
  snapshotEvidenceHash: "SHA-256(stableJson(contentHash,capturedAt,timestampAuthority,artifactId))",
  snapshotRetry: "SHA-256(SNAPSHOT|signalId|artifactType|schemaVersion|informationAsOf|contentHash)",
  notificationDeliveryRetry: "advisoryIdentity|EMAIL|attemptSequence",
  duplicateSkippedRetry: "advisoryIdentity|channel|attemptSequence",
  pageRefresh: "reviewObservationId is the session/group identity; each event has its own evidenceId",
  reviewStartRetry: "REVIEW|reviewObservationId|START",
  reviewSubmitRetry: "REVIEW|reviewObservationId|SUBMIT",
});

export const R22_NOTIFICATION_RUNTIME_MAPPING = Object.freeze({
  CLAIMED: {
    event: "DELIVERED_OR_DELIVERY_FAILED",
    source: "src/lib/signal-advisory/scan.ts sendSignalEmail() result/catch",
    attemptSequence: "tp_signal_advisories.attempt_count=1 from advisoryRow()",
  },
  RETRY_CLAIMED: {
    event: "DELIVERED_OR_DELIVERY_FAILED",
    source: "src/lib/signal-advisory/scan.ts sendSignalEmail() result/catch after tp_retry_signal_advisory()",
    attemptSequence: "tp_retry_signal_advisory() CAS increments tp_signal_advisories.attempt_count",
  },
  SKIPPED_DUPLICATE: {
    event: "DUPLICATE_SKIPPED",
    source: "claimSignal() exact claim result SKIPPED_DUPLICATE",
    attemptSequence: "not returned by current claimSignal()",
  },
  SKIPPED_EXPIRED: {
    event: "SUPPRESSED",
    suppressionReason: "EXPIRED",
    source: "claimSignal() exact claim result SKIPPED_EXPIRED",
    attemptSequence: "not returned by current claimSignal()",
  },
  deliveryFailure: {
    event: R22_NOTIFICATION_DELIVERY_FAILURE_EVENT,
    codes: R22_NOTIFICATION_FAILURE_CODES,
    countedAsNormalNoise: false,
  },
  ignored: "INSTRUMENTATION_UNRESOLVED unless explicit human/UI evidence exists",
  designStatus: "O05_DESIGN_INELIGIBLE",
} as const);

export const R22_FAILURE_ISOLATION = Object.freeze({
  architecture: "sidecar append-only observation writer",
  instrumentationFailureRecord: "INSTRUMENTATION_FAILURE with server error class and affected evidence identity only",
  upstreamImpact: "must not change signal generation, delivery, scheduler, cron, Quality, Grade, Priority, or human decision output",
  missingEvidence: "future observation is NOT_EVALUABLE; never fabricated, imputed, or backfilled",
});

export type R22ObservationInstrumentationGovernance = Readonly<{
  designOnly: true;
  observationExecuted: false;
  historicalBackfillExecuted: false;
  instrumentationImplemented: false;
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
}>;

export const R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE: R22ObservationInstrumentationGovernance = Object.freeze({
  designOnly: true,
  observationExecuted: false,
  historicalBackfillExecuted: false,
  instrumentationImplemented: false,
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
});

export const R22_OBSERVATION_INSTRUMENTATION_FINAL_DECISION = Object.freeze({
  decision: "ROUND-022 OBSERVATION INSTRUMENTATION DESIGN INELIGIBLE",
  nextStage: "STOP",
  performanceAuthorized: false,
  observationAuthorized: false,
});

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function canonicalIsoTimestamp(value: string): boolean {
  if (!nonEmpty(value) || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function timestampAtOrBefore(left: string, right: string): boolean {
  return Date.parse(left) <= Date.parse(right);
}

function identityValid(identity: R22AdvisoryIdentity): boolean {
  return nonEmpty(identity.signalId)
    && (RESEARCH_SYMBOLS as readonly string[]).includes(identity.symbol)
    && (identity.direction === "LONG" || identity.direction === "SHORT")
    && canonicalIsoTimestamp(identity.signalTime)
    && nonEmpty(identity.strategyId)
    && nonEmpty(identity.strategyVersion);
}

function normalizedFieldName(value: string): string {
  return value.replace(/[_.-]/g, "").toLowerCase();
}

const forbiddenFieldNames = new Set(
  R22_FORBIDDEN_ECONOMIC_FIELD_NAMES.map(normalizedFieldName),
);

function findForbiddenField(value: unknown, path = "payload"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenField(value[index], `${path}[${index}]`);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenFieldNames.has(normalizedFieldName(key))) return `${path}.${key}`;
    const found = findForbiddenField(child, `${path}.${key}`);
    if (found !== null) return found;
  }
  return null;
}

type R22SnapshotContentHashPreimage = Readonly<Pick<
  R22SnapshotArtifact,
  "artifactType" | "schemaVersion" | "advisoryIdentity" | "informationAsOf" | "sourceRef" | "payload"
>>;

type R22SnapshotEvidenceHashPreimage = Readonly<Pick<
  R22SnapshotArtifact,
  "contentHash" | "capturedAt" | "timestampAuthority" | "artifactId"
>>;

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function calculateR22SnapshotContentHash(input: R22SnapshotContentHashPreimage): string {
  return sha256Utf8(stableStringify({
    schemaVersion: input.schemaVersion,
    artifactType: input.artifactType,
    advisoryIdentity: input.advisoryIdentity,
    informationAsOf: input.informationAsOf,
    sourceRef: input.sourceRef,
    payload: input.payload,
  }));
}

export function calculateR22SnapshotEvidenceHash(input: R22SnapshotEvidenceHashPreimage): string {
  return sha256Utf8(stableStringify({
    contentHash: input.contentHash,
    capturedAt: input.capturedAt,
    timestampAuthority: input.timestampAuthority,
    artifactId: input.artifactId,
  }));
}

export function calculateR22SnapshotIdempotencyKey(input: Readonly<{
  signalId: string;
  artifactType: R22SnapshotArtifactType;
  schemaVersion: string;
  informationAsOf: string;
  contentHash: string;
}>): string {
  return sha256Utf8([
    "SNAPSHOT",
    input.signalId,
    input.artifactType,
    input.schemaVersion,
    input.informationAsOf,
    input.contentHash,
  ].join("|"));
}

export function calculateR22NotificationIdempotencyKey(input: Readonly<{
  signalId: string;
  channel: R22NotificationObservation["channel"];
  attemptSequence: number;
}>): string {
  return ["NOTIFICATION", input.signalId, input.channel, String(input.attemptSequence)].join("|");
}

export function calculateR22HumanReviewIdempotencyKey(
  reviewObservationId: string,
  eventType: R22HumanReviewObservation["eventType"],
): string {
  return ["REVIEW", reviewObservationId, eventType === "REVIEW_STARTED" ? "START" : "SUBMIT"].join("|");
}

function isCanonicalJsonValue(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.every(isCanonicalJsonValue);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value as Record<string, unknown>).every(isCanonicalJsonValue);
}

export function validateR22SnapshotArtifact(
  artifact: R22SnapshotArtifact,
): R22SnapshotValidation {
  const fail = (
    reason: R22SnapshotValidation["reason"],
    expectedContentHash: string | null = null,
    forbiddenField: string | null = null,
    expectedEvidenceHash: string | null = null,
    expectedIdempotencyKey: string | null = null,
  ): R22SnapshotValidation => ({
    status: "NOT_EVALUABLE",
    artifactId: artifact.artifactId,
    reason,
    forbiddenField,
    expectedContentHash,
    expectedEvidenceHash,
    expectedIdempotencyKey,
  });

  if (!nonEmpty(artifact.evidenceId) || !nonEmpty(artifact.artifactId) || !identityValid(artifact.advisoryIdentity)) {
    return fail("MISSING_IDENTITY");
  }
  if (!R22_SNAPSHOT_ARTIFACT_TYPES.includes(artifact.artifactType)) {
    return fail("INVALID_ARTIFACT_TYPE");
  }
  if (artifact.schemaVersion !== R22_OBSERVATION_INSTRUMENTATION_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA_VERSION");
  }
  if (!nonEmpty(artifact.sourceRef) || !nonEmpty(artifact.idempotencyKey)) {
    return fail("MISSING_PROVENANCE");
  }
  if (!isCanonicalJsonValue(artifact.payload)) return fail("NON_CANONICAL_PAYLOAD");
  if (!canonicalIsoTimestamp(artifact.advisoryIdentity.signalTime)
    || !canonicalIsoTimestamp(artifact.informationAsOf)
    || !canonicalIsoTimestamp(artifact.capturedAt)) {
    return fail("INVALID_TIMESTAMP");
  }
  if (!timestampAtOrBefore(artifact.informationAsOf, artifact.advisoryIdentity.signalTime)) {
    return fail("INFORMATION_AFTER_SIGNAL");
  }
  if (!timestampAtOrBefore(artifact.informationAsOf, artifact.capturedAt)) {
    return fail("CAPTURE_BEFORE_INFORMATION_AS_OF");
  }
  if (!timestampAtOrBefore(artifact.advisoryIdentity.signalTime, artifact.capturedAt)) {
    return fail("CAPTURE_BEFORE_SIGNAL");
  }
  if (artifact.timestampAuthority.capturedAtAuthority !== "SERVER_WALL_CLOCK"
    || artifact.timestampAuthority.informationAsOfAuthority !== "SERVER_SOURCE_CUTOFF"
    || artifact.timestampAuthority.userSuppliedCapturedAt !== false
    || artifact.timestampAuthority.userSuppliedInformationAsOf !== false
    || artifact.timestampAuthority.backdated !== false) {
    return fail("TIMESTAMP_AUTHORITY_INVALID");
  }
  const forbiddenField = findForbiddenField(artifact.payload);
  if (forbiddenField !== null) return fail("FORBIDDEN_ECONOMIC_FIELD", null, forbiddenField);
  if (!/^[a-f0-9]{64}$/i.test(artifact.contentHash)) return fail("CONTENT_HASH_INVALID");
  const expectedContentHash = calculateR22SnapshotContentHash(artifact);
  if (expectedContentHash !== artifact.contentHash.toLowerCase()) {
    return fail("CONTENT_HASH_MISMATCH", expectedContentHash);
  }
  if (!/^[a-f0-9]{64}$/i.test(artifact.evidenceHash)) return fail("EVIDENCE_HASH_INVALID", expectedContentHash);
  const expectedEvidenceHash = calculateR22SnapshotEvidenceHash(artifact);
  if (expectedEvidenceHash !== artifact.evidenceHash.toLowerCase()) {
    return fail("EVIDENCE_HASH_MISMATCH", expectedContentHash, null, expectedEvidenceHash);
  }
  const expectedIdempotencyKey = calculateR22SnapshotIdempotencyKey({
    signalId: artifact.advisoryIdentity.signalId,
    artifactType: artifact.artifactType,
    schemaVersion: artifact.schemaVersion,
    informationAsOf: artifact.informationAsOf,
    contentHash: artifact.contentHash,
  });
  if (expectedIdempotencyKey !== artifact.idempotencyKey) {
    return fail("IDEMPOTENCY_KEY_MISMATCH", expectedContentHash, null, expectedEvidenceHash, expectedIdempotencyKey);
  }
  if (artifact.persistenceOperation !== "APPEND"
    || (artifact.supersedesArtifactId !== null && artifact.supersedesArtifactId === artifact.artifactId)) {
    return fail("APPEND_ONLY_VIOLATION");
  }
  return {
    status: "OBSERVABLE",
    artifactId: artifact.artifactId,
    reason: "NONE",
    forbiddenField: null,
    expectedContentHash,
    expectedEvidenceHash,
    expectedIdempotencyKey,
  };
}

export function validateR22AppendOnlyWrite(input: Readonly<{
  record: Readonly<{
    evidenceId: string;
    idempotencyKey: string;
    supersedesEvidenceId: string | null;
    persistenceOperation: "APPEND";
  }>;
  existingEvidenceIds: ReadonlySet<string>;
  existingIdempotencyKeys: ReadonlySet<string>;
}>): R22AppendOnlyWriteValidation {
  if (!nonEmpty(input.record.evidenceId)) {
    return { status: "NOT_EVALUABLE", reason: "MISSING_EVIDENCE_ID" };
  }
  if (input.record.supersedesEvidenceId === input.record.evidenceId) {
    return { status: "NOT_EVALUABLE", reason: "SUPERSEDES_SELF" };
  }
  if (input.existingIdempotencyKeys.has(input.record.idempotencyKey)) {
    return { status: "IDEMPOTENT_REPLAY", reason: "IDEMPOTENCY_REPLAY" };
  }
  if (input.existingEvidenceIds.has(input.record.evidenceId)) {
    return { status: "NOT_EVALUABLE", reason: "EVIDENCE_ID_REUSE" };
  }
  return { status: "APPEND", reason: "NONE" };
}

export function validateR22NotificationObservation(
  observation: R22NotificationObservation,
): R22NotificationValidation {
  const base = {
    notificationObservationId: observation.notificationObservationId,
    disposition: observation.disposition,
  } as const;
  if (!nonEmpty(observation.evidenceId) || !nonEmpty(observation.notificationObservationId) || !identityValid(observation.advisoryIdentity)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "MISSING_IDENTITY" };
  }
  if (!canonicalIsoTimestamp(observation.advisoryIdentity.signalTime)
    || !canonicalIsoTimestamp(observation.observedAt)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "INVALID_TIMESTAMP" };
  }
  if (!timestampAtOrBefore(observation.advisoryIdentity.signalTime, observation.observedAt)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "NOTIFICATION_BEFORE_SIGNAL" };
  }
  if (!Number.isSafeInteger(observation.attemptSequence) || observation.attemptSequence < 1) {
    return { ...base, status: "NOT_EVALUABLE", reason: "INVALID_ATTEMPT_SEQUENCE" };
  }
  if (!nonEmpty(observation.idempotencyKey)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "MISSING_EVIDENCE_SOURCE" };
  }
  const expectedIdempotencyKey = calculateR22NotificationIdempotencyKey({
    signalId: observation.advisoryIdentity.signalId,
    channel: observation.channel,
    attemptSequence: observation.attemptSequence,
  });
  if (observation.idempotencyKey !== expectedIdempotencyKey) {
    return { ...base, status: "NOT_EVALUABLE", reason: "NOTIFICATION_IDEMPOTENCY_KEY_MISMATCH" };
  }
  const expectedEvidence: Record<R22NotificationDisposition, R22NotificationEvidenceSource> = {
    DELIVERED: "SERVER_DELIVERY_EVENT",
    SUPPRESSED: "SERVER_EXPIRED_SKIP_EVENT",
    DUPLICATE_SKIPPED: "SERVER_DUPLICATE_SKIP_EVENT",
    DELIVERY_FAILED: "SERVER_DELIVERY_FAILURE_EVENT",
    IGNORED: "EXPLICIT_HUMAN_OR_UI",
  };
  if (observation.disposition === "SUPPRESSED" && observation.suppressionReason !== "EXPIRED") {
    return { ...base, status: "NOT_EVALUABLE", reason: "SUPPRESSION_REASON_REQUIRED" };
  }
  if (observation.disposition === "DELIVERY_FAILED"
    && (observation.deliveryFailureCode === null
      || !R22_NOTIFICATION_FAILURE_CODES.includes(observation.deliveryFailureCode))) {
    return { ...base, status: "NOT_EVALUABLE", reason: "DELIVERY_FAILURE_CODE_REQUIRED" };
  }
  if (observation.evidenceSource !== expectedEvidence[observation.disposition]) {
    if (observation.disposition === "IGNORED") {
      return {
        ...base,
        status: "INSTRUMENTATION_UNRESOLVED",
        reason: "IGNORED_NOT_EXPLICITLY_OBSERVED",
        disposition: "INSTRUMENTATION_UNRESOLVED",
      };
    }
    return { ...base, status: "NOT_EVALUABLE", reason: "MISSING_EVIDENCE_SOURCE" };
  }
  return { ...base, status: "OBSERVABLE", reason: "NONE" };
}

export function validateR22HumanReviewObservation(
  observation: R22HumanReviewObservation,
): R22HumanReviewValidation {
  const base = { reviewObservationId: observation.reviewObservationId } as const;
  if (!nonEmpty(observation.evidenceId) || !nonEmpty(observation.reviewObservationId) || !identityValid(observation.advisoryIdentity)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "MISSING_IDENTITY" };
  }
  if (observation.eventType !== "REVIEW_STARTED" && observation.eventType !== "REVIEW_SUBMITTED") {
    return { ...base, status: "NOT_EVALUABLE", reason: "INVALID_EVENT_TYPE" };
  }
  if (!canonicalIsoTimestamp(observation.advisoryIdentity.signalTime)
    || !canonicalIsoTimestamp(observation.reviewStartedAt)
    || (observation.reviewSubmittedAt !== null && !canonicalIsoTimestamp(observation.reviewSubmittedAt))) {
    return { ...base, status: "NOT_EVALUABLE", reason: "INVALID_TIMESTAMP" };
  }
  if (!timestampAtOrBefore(observation.advisoryIdentity.signalTime, observation.reviewStartedAt)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "REVIEW_BEFORE_SIGNAL" };
  }
  if (observation.reviewSubmittedAt !== null
    && !timestampAtOrBefore(observation.reviewStartedAt, observation.reviewSubmittedAt)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "REVIEW_TIMESTAMP_INVERSION" };
  }
  const expectedIdempotencyKey = calculateR22HumanReviewIdempotencyKey(
    observation.reviewObservationId,
    observation.eventType,
  );
  if (observation.idempotencyKey !== expectedIdempotencyKey) {
    return { ...base, status: "NOT_EVALUABLE", reason: "REVIEW_IDEMPOTENCY_KEY_MISMATCH" };
  }
  if (observation.eventType === "REVIEW_STARTED") {
    if (observation.reviewSubmittedAt !== null
      || observation.reviewComplete !== null
      || observation.informationSufficient !== null
      || observation.unnecessaryAlert !== null
      || observation.labelSource !== null) {
      return { ...base, status: "NOT_EVALUABLE", reason: "START_FIELDS_MUST_BE_EMPTY" };
    }
  } else if (observation.reviewSubmittedAt === null
    || typeof observation.reviewComplete !== "boolean"
    || typeof observation.informationSufficient !== "boolean"
    || typeof observation.unnecessaryAlert !== "boolean"
    || observation.labelSource !== "EXPLICIT_HUMAN_LABEL") {
    return { ...base, status: "NOT_EVALUABLE", reason: "SUBMIT_FIELDS_REQUIRED" };
  }
  return { ...base, status: "OBSERVABLE", reason: "NONE" };
}

export function isR22ObservationInstrumentationDesignReady(): boolean {
  return R22_INSTRUMENTATION_GATES.every((gate) => gate.designStatus === "DESIGN_READY")
    && R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE.observationExecuted === false
    && R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE.instrumentationImplemented === false
    && R22_OBSERVATION_INSTRUMENTATION_GOVERNANCE.performanceExecutionCount === 0;
}

export function isR22ObservationInstrumentationGovernanceSafe(
  status: R22ObservationInstrumentationGovernance,
): boolean {
  return status.designOnly
    && status.observationExecuted === false
    && status.historicalBackfillExecuted === false
    && status.instrumentationImplemented === false
    && status.performanceExecutionCount === 0
    && status.performanceLedgerPresent === false
    && status.economicValuesRead === false
    && status.forwardReturnRead === false
    && status.newMarketDataFetched === false
    && status.productionUnchanged
    && status.baseline002Status === "NOT_FROZEN"
    && status.m3JStatus === "BLOCKED"
    && status.m4Status === "NOT_STARTED"
    && status.humanDecisionRequired
    && !status.automaticTrading;
}
