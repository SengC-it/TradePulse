import type { ResearchSymbol } from "../config/constants.ts";
import type { AdvisoryDirection } from "../signal-advisory/types.ts";

export const R22_OBSERVATION_SCHEMA_VERSION = "m3-r22-observation-instrumentation-design-002" as const;
export const OBSERVATION_EVIDENCE_TABLE = "tp_observation_evidence" as const;

export const R22_R1_IMPLEMENTATION_STATUS = Object.freeze({
  r1FoundationImplemented: true,
  sharedEvidenceIdentityImplemented: true,
  snapshotHashingImplemented: true,
  snapshotIdempotencyImplemented: true,
  appendOnlyEvidenceFoundationImplemented: true,
  pitValidatorPrimitivesImplemented: true,
  basicCausalValidatorPrimitivesImplemented: true,
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
} as const);

export const R22_OBSERVATION_ARTIFACT_TYPES = Object.freeze([
  "QUALITY_SNAPSHOT",
  "MARKET_CONTEXT",
  "RISK_ADVISORY",
  "HISTORICAL_REVIEW_METADATA",
  "ALERT_INTELLIGENCE",
  "PRESENTATION",
] as const);
export type ObservationArtifactType = (typeof R22_OBSERVATION_ARTIFACT_TYPES)[number];

export const R22_OBSERVATION_EVENT_KINDS = Object.freeze([
  "SNAPSHOT",
  "NOTIFICATION",
  "REVIEW",
  "INSTRUMENTATION_FAILURE",
] as const);
export type ObservationEventKind = (typeof R22_OBSERVATION_EVENT_KINDS)[number];

export type ObservationJsonValue =
  | null
  | string
  | number
  | boolean
  | readonly ObservationJsonValue[]
  | { readonly [key: string]: ObservationJsonValue };

export type ObservationAdvisoryIdentity = Readonly<{
  signalId: string;
  symbol: ResearchSymbol;
  direction: AdvisoryDirection;
  signalTime: string;
  strategyId: string;
  strategyVersion: string;
}>;

export type ObservationTimestampAuthority = Readonly<{
  capturedAtAuthority: "SERVER_WALL_CLOCK";
  informationAsOfAuthority: "SERVER_SOURCE_CUTOFF";
  userSuppliedCapturedAt: false;
  userSuppliedInformationAsOf: false;
  backdated: false;
}>;

export type ObservationSnapshotArtifact = Readonly<{
  evidenceId: string;
  artifactId: string;
  artifactType: ObservationArtifactType;
  schemaVersion: string;
  advisoryIdentity: ObservationAdvisoryIdentity;
  signalId: string;
  informationAsOf: string;
  capturedAt: string;
  sourceRef: string;
  payload: ObservationJsonValue;
  contentHash: string;
  evidenceHash: string;
  idempotencyKey: string;
  supersedesArtifactId: string | null;
  timestampAuthority: ObservationTimestampAuthority;
  persistenceOperation: "APPEND";
}>;

export type ObservationEvidenceCandidate = Readonly<{
  evidenceId: string;
  eventKind: ObservationEventKind;
  schemaVersion: string;
  signalId: string;
  symbol: ResearchSymbol;
  direction: AdvisoryDirection;
  signalTime: string;
  strategyId: string;
  strategyVersion: string;
  artifactId: string | null;
  artifactType: ObservationArtifactType | null;
  notificationObservationId: string | null;
  reviewObservationId: string | null;
  eventType: "REVIEW_STARTED" | "REVIEW_SUBMITTED" | null;
  informationAsOf: string | null;
  capturedAt: string;
  observedAt: string | null;
  reviewStartedAt: string | null;
  reviewSubmittedAt: string | null;
  sourceRef: string;
  contentHash: string | null;
  evidenceHash: string | null;
  idempotencyKey: string;
  supersedesEvidenceId: string | null;
  payload: ObservationJsonValue;
  timestampAuthority: ObservationTimestampAuthority;
  persistenceOperation: "APPEND";
}>;

export type ObservationCausalTimestampInput = Readonly<{
  signalTime: string;
  informationAsOf: string | null;
  capturedAt: string | null;
  requireSnapshotPIT?: boolean;
  advisoryCreationTime?: string | null;
  notificationObservedAt?: string | null;
  reviewStartedAt?: string | null;
  reviewSubmittedAt?: string | null;
}>;

export type ObservationCausalValidation = Readonly<{
  status: "VALID" | "NOT_EVALUABLE";
  reason:
    | "NONE"
    | "INVALID_TIMESTAMP"
    | "INFORMATION_AFTER_SIGNAL"
    | "CAPTURE_BEFORE_SIGNAL"
    | "CAPTURE_BEFORE_INFORMATION_AS_OF"
    | "ADVISORY_BEFORE_SIGNAL"
    | "NOTIFICATION_BEFORE_SIGNAL"
    | "REVIEW_BEFORE_SIGNAL"
    | "REVIEW_TIMESTAMP_INVERSION"
    | "REVIEW_START_REQUIRED";
}>;

export type ObservationSnapshotValidation = Readonly<{
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

export type ObservationEvidenceValidation = Readonly<{
  status: "VALID" | "NOT_EVALUABLE";
  reason:
    | "NONE"
    | "MISSING_IDENTITY"
    | "INVALID_EVENT_KIND"
    | "INVALID_SCHEMA_VERSION"
    | "MISSING_PROVENANCE"
    | "NON_CANONICAL_PAYLOAD"
    | "FORBIDDEN_ECONOMIC_FIELD"
    | "INVALID_TIMESTAMP"
    | "CAUSAL_TIMESTAMP_INVALID"
    | "TIMESTAMP_AUTHORITY_INVALID"
    | "APPEND_ONLY_VIOLATION"
    | "SNAPSHOT_INVALID";
  forbiddenField: string | null;
  causalReason: ObservationCausalValidation["reason"];
  snapshotReason: ObservationSnapshotValidation["reason"] | null;
}>;

export type ObservationEvidenceAppendResult =
  | Readonly<{ status: "APPENDED"; evidenceId: string }>
  | Readonly<{ status: "IDEMPOTENT_REPLAY"; evidenceId: string }>
  | Readonly<{
      status: "NOT_EVALUABLE";
      evidenceId: string;
      reason: "INVALID_CANDIDATE" | "EVIDENCE_ID_CONFLICT" | "LOGICAL_ID_CONFLICT";
    }>;
