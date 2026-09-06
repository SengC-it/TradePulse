import { createHash } from "node:crypto";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { stableStringify } from "./utils.ts";

export const R22_OBSERVATION_INSTRUMENTATION_SCHEMA_VERSION = "m3-r22-observation-instrumentation-design-001" as const;
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
  "IGNORED",
] as const);
export type R22NotificationDisposition = (typeof R22_NOTIFICATION_DISPOSITIONS)[number];

export const R22_NOTIFICATION_EVIDENCE_SOURCES = Object.freeze([
  "SERVER_DELIVERY_EVENT",
  "SERVER_SUPPRESSION_EVENT",
  "SERVER_DEDUP_EVENT",
  "EXPLICIT_HUMAN_OR_UI",
] as const);
export type R22NotificationEvidenceSource = (typeof R22_NOTIFICATION_EVIDENCE_SOURCES)[number];

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
    idempotencyKey: "advisoryIdentity|artifactType|schemaVersion|sourceHash",
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
    idempotencyKey: "advisoryIdentity|artifactType|schemaVersion|sourceHash",
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
    idempotencyKey: "advisoryIdentity|channel|attemptSequence",
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
    idempotencyKey: "reviewObservationId",
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
    idempotencyKey: "reviewObservationId",
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
  artifactId: string;
  artifactType: R22SnapshotArtifactType;
  schemaVersion: string;
  advisoryIdentity: R22AdvisoryIdentity;
  informationAsOf: string;
  capturedAt: string;
  sourceRef: string;
  sourceHash: string;
  payload: Readonly<Record<string, unknown>>;
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
    | "SOURCE_HASH_INVALID"
    | "SOURCE_HASH_MISMATCH"
    | "FORBIDDEN_ECONOMIC_FIELD"
    | "APPEND_ONLY_VIOLATION";
  forbiddenField: string | null;
  expectedSourceHash: string | null;
}>;

export type R22NotificationObservation = Readonly<{
  notificationObservationId: string;
  advisoryIdentity: R22AdvisoryIdentity;
  channel: "EMAIL" | "WEB";
  attemptSequence: number;
  observedAt: string;
  disposition: R22NotificationDisposition;
  evidenceSource: R22NotificationEvidenceSource | null;
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
    | "IGNORED_NOT_EXPLICITLY_OBSERVED";
  disposition: R22NotificationDisposition | "INSTRUMENTATION_UNRESOLVED";
}>;

export type R22HumanReviewObservation = Readonly<{
  reviewObservationId: string;
  advisoryIdentity: R22AdvisoryIdentity;
  reviewStartedAt: string;
  reviewSubmittedAt: string;
  reviewComplete: boolean;
  informationSufficient: boolean;
  unnecessaryAlert: boolean;
  labelSource: "EXPLICIT_HUMAN_LABEL";
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
    | "MISSING_HUMAN_LABEL_SOURCE";
}>;

export type R22AppendOnlyWriteValidation = Readonly<{
  status: "APPEND" | "IDEMPOTENT_REPLAY" | "NOT_EVALUABLE";
  reason: "NONE" | "IDEMPOTENCY_REPLAY" | "ARTIFACT_ID_REUSE" | "SUPERSEDES_SELF";
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
    designStatus: "DESIGN_READY",
    currentCaptureStatus: "UNRESOLVED_CURRENT_SOURCE",
    rule: "Delivery, suppression, and duplicate-skip events are independently recorded; IGNORED requires explicit human/UI evidence.",
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
  primaryKey: "evidence_id / artifactId, notificationObservationId, or reviewObservationId",
  advisoryIdentity: "foreign-key-compatible with public.tp_signal_advisories.signal_id when the event is advisory-scoped",
  uniqueConstraints: ["idempotency_key", "artifact_id"],
  serviceBoundary: "server-side service role writer only; no browser or direct authenticated write",
  retention: "retain immutable evidence according to the future approved retention policy; no overwrite/delete in the observation window",
  timestamps: "server UTC timestamptz columns; capturedAt and informationAsOf are immutable",
  schemaVersion: "mandatory on every row",
  hash: "sourceHash is SHA-256 over the frozen canonical preimage",
  rls: "enabled; anon and authenticated direct access denied; service-side writer/read path only",
});

export const R22_IDEMPOTENCY_DESIGN = Object.freeze({
  snapshotRetry: "advisoryIdentity|artifactType|schemaVersion|sourceHash",
  notificationDeliveryRetry: "advisoryIdentity|EMAIL|attemptSequence",
  duplicateSkippedRetry: "advisoryIdentity|channel|attemptSequence",
  pageRefresh: "reviewObservationId issued at review start",
  reviewRetry: "reviewObservationId; same submit is an idempotent replay",
});

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
  decision: "ROUND-022 OBSERVATION INSTRUMENTATION DESIGN READY",
  nextStage: "STOP_PENDING_DESIGN_ACCEPTANCE",
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

type R22SnapshotHashPreimage = Readonly<Pick<
  R22SnapshotArtifact,
  "artifactType" | "schemaVersion" | "advisoryIdentity" | "informationAsOf" | "capturedAt" | "sourceRef" | "payload" | "timestampAuthority"
>>;

export function calculateR22SnapshotSourceHash(input: R22SnapshotHashPreimage): string {
  return createHash("sha256")
    .update(stableStringify({
      schemaVersion: input.schemaVersion,
      artifactType: input.artifactType,
      advisoryIdentity: input.advisoryIdentity,
      informationAsOf: input.informationAsOf,
      capturedAt: input.capturedAt,
      sourceRef: input.sourceRef,
      timestampAuthority: input.timestampAuthority,
      payload: input.payload,
    }), "utf8")
    .digest("hex");
}

export function validateR22SnapshotArtifact(
  artifact: R22SnapshotArtifact,
): R22SnapshotValidation {
  const fail = (
    reason: R22SnapshotValidation["reason"],
    expectedSourceHash: string | null = null,
    forbiddenField: string | null = null,
  ): R22SnapshotValidation => ({
    status: "NOT_EVALUABLE",
    artifactId: artifact.artifactId,
    reason,
    forbiddenField,
    expectedSourceHash,
  });

  if (!nonEmpty(artifact.artifactId) || !identityValid(artifact.advisoryIdentity)) {
    return fail("MISSING_IDENTITY");
  }
  if (!R22_SNAPSHOT_ARTIFACT_TYPES.includes(artifact.artifactType)) {
    return fail("INVALID_ARTIFACT_TYPE");
  }
  if (artifact.schemaVersion !== R22_OBSERVATION_INSTRUMENTATION_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA_VERSION");
  }
  if (!nonEmpty(artifact.sourceRef) || !nonEmpty(artifact.idempotencyKey) || !artifact.payload) {
    return fail("MISSING_PROVENANCE");
  }
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
  if (!/^[a-f0-9]{64}$/i.test(artifact.sourceHash)) return fail("SOURCE_HASH_INVALID");
  const expectedSourceHash = calculateR22SnapshotSourceHash(artifact);
  if (expectedSourceHash !== artifact.sourceHash.toLowerCase()) {
    return fail("SOURCE_HASH_MISMATCH", expectedSourceHash);
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
    expectedSourceHash,
  };
}

export function validateR22AppendOnlyWrite(input: Readonly<{
  artifact: Pick<R22SnapshotArtifact, "artifactId" | "idempotencyKey" | "supersedesArtifactId" | "persistenceOperation">;
  existingArtifactIds: ReadonlySet<string>;
  existingIdempotencyKeys: ReadonlySet<string>;
}>): R22AppendOnlyWriteValidation {
  if (input.artifact.persistenceOperation !== "APPEND") {
    return { status: "NOT_EVALUABLE", reason: "ARTIFACT_ID_REUSE" };
  }
  if (input.artifact.supersedesArtifactId === input.artifact.artifactId) {
    return { status: "NOT_EVALUABLE", reason: "SUPERSEDES_SELF" };
  }
  if (input.existingIdempotencyKeys.has(input.artifact.idempotencyKey)) {
    return { status: "IDEMPOTENT_REPLAY", reason: "IDEMPOTENCY_REPLAY" };
  }
  if (input.existingArtifactIds.has(input.artifact.artifactId)) {
    return { status: "NOT_EVALUABLE", reason: "ARTIFACT_ID_REUSE" };
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
  if (!nonEmpty(observation.notificationObservationId) || !identityValid(observation.advisoryIdentity)) {
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
  const expectedEvidence: Record<R22NotificationDisposition, R22NotificationEvidenceSource> = {
    DELIVERED: "SERVER_DELIVERY_EVENT",
    SUPPRESSED: "SERVER_SUPPRESSION_EVENT",
    DUPLICATE_SKIPPED: "SERVER_DEDUP_EVENT",
    IGNORED: "EXPLICIT_HUMAN_OR_UI",
  };
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
  if (!nonEmpty(observation.reviewObservationId) || !identityValid(observation.advisoryIdentity)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "MISSING_IDENTITY" };
  }
  if (!canonicalIsoTimestamp(observation.advisoryIdentity.signalTime)
    || !canonicalIsoTimestamp(observation.reviewStartedAt)
    || !canonicalIsoTimestamp(observation.reviewSubmittedAt)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "INVALID_TIMESTAMP" };
  }
  if (!timestampAtOrBefore(observation.advisoryIdentity.signalTime, observation.reviewStartedAt)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "REVIEW_BEFORE_SIGNAL" };
  }
  if (!timestampAtOrBefore(observation.reviewStartedAt, observation.reviewSubmittedAt)) {
    return { ...base, status: "NOT_EVALUABLE", reason: "REVIEW_TIMESTAMP_INVERSION" };
  }
  if (observation.labelSource !== "EXPLICIT_HUMAN_LABEL") {
    return { ...base, status: "NOT_EVALUABLE", reason: "MISSING_HUMAN_LABEL_SOURCE" };
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
