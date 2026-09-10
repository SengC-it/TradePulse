import { createHash } from "node:crypto";

import type { SignalAdvisory } from "../signal-advisory/types.ts";
import { canonicalJson } from "./canonical.ts";
import {
  calculateObservationSnapshotContentHash,
  calculateObservationSnapshotEvidenceHash,
  calculateObservationSnapshotIdempotencyKey,
  R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  R22_OBSERVATION_TIMESTAMP_AUTHORITY,
} from "./snapshot.ts";
import type { ObservationEvidenceCandidate, ObservationJsonValue } from "./types.ts";
import {
  isCanonicalUtcTimestamp,
  validateObservationAdvisoryIdentity,
} from "./validator.ts";
import {
  validateHistoricalReviewContext,
} from "../historical-review-context/registry.ts";
import {
  R22_HISTORICAL_CONTEXT_APPROVAL_REF,
  R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION,
  type HistoricalReviewContext,
} from "../historical-review-context/types.ts";

export const R22_R5_HISTORICAL_REVIEW_METADATA_PRODUCER_IMPLEMENTATION_STATUS = Object.freeze({
  r1FoundationImplemented: true,
  r2QualitySnapshotProducerImplemented: true,
  r3MarketContextProducerImplemented: true,
  r4RiskAdvisoryProducerImplemented: true,
  r5HistoricalReviewMetadataProducerImplemented: true,
  introducesCapabilities: Object.freeze(["prospectiveHistoricalReviewMetadataProducer"]),
  closesReadinessNodes: Object.freeze(["S04"]),
  dependsOn: Object.freeze(["R1"]),
  r5AcceptanceStatus: "ACCEPTED",
  s01Status: "SOURCE_READY",
  s01AcceptedReady: true,
  s02Status: "SOURCE_READY",
  s02AcceptedReady: true,
  s03Status: "SOURCE_READY",
  s03AcceptedReady: true,
  s04ImplementationStatus: "SOURCE_READY",
  s04AcceptedReady: true,
  s05Status: "FAIL",
  s06Status: "FAIL",
  s07Status: "FAIL",
  s08Status: "FAIL",
  s09Status: "FAIL",
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
} as const);

type HistoricalReviewMetadataInput = Readonly<{
  advisory: SignalAdvisory;
  priorContext: HistoricalReviewContext;
  capturedAt: string;
}>;

export class HistoricalReviewMetadataNotEvaluableError extends Error {
  readonly code = "NOT_EVALUABLE" as const;

  constructor(reason: string) {
    super(`HISTORICAL_REVIEW_METADATA_NOT_EVALUABLE:${reason}`);
    this.name = "HistoricalReviewMetadataNotEvaluableError";
  }
}

function notEvaluable(reason: string): never {
  throw new HistoricalReviewMetadataNotEvaluableError(reason);
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function advisoryIdentity(advisory: SignalAdvisory) {
  return {
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
  } as const;
}

function validatePriorContext(
  advisory: SignalAdvisory,
  priorContext: HistoricalReviewContext,
): void {
  if (!validateHistoricalReviewContext(priorContext)) {
    return notEvaluable("PRIOR_CONTEXT_IDENTITY_INVALID");
  }
  if (priorContext.sourceSignalId === advisory.signalId) {
    return notEvaluable("CURRENT_CONTEXT_SELF_REFERENCE");
  }
  if (priorContext.symbol !== advisory.symbol || priorContext.timeframe !== "1h") {
    return notEvaluable("PRIOR_CONTEXT_SYMBOL_OR_TIMEFRAME_MISMATCH");
  }
  if (Date.parse(priorContext.availableAt) > Date.parse(advisory.signalTime)) {
    return notEvaluable("PRIOR_CONTEXT_NOT_AVAILABLE_AT_SIGNAL_TIME");
  }
  if (Date.parse(priorContext.sourceEventTime) > Date.parse(priorContext.availableAt)) {
    return notEvaluable("PRIOR_CONTEXT_EVENT_AFTER_AVAILABILITY");
  }
  if (priorContext.featureSnapshotVersion !== R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION
    || priorContext.approvalRef !== R22_HISTORICAL_CONTEXT_APPROVAL_REF) {
    return notEvaluable("PRIOR_CONTEXT_PROTOCOL_MISMATCH");
  }
}

function priorContextPayload(context: HistoricalReviewContext): ObservationJsonValue {
  return {
    contextId: context.contextId,
    sourceSignalId: context.sourceSignalId,
    symbol: context.symbol,
    timeframe: context.timeframe,
    sourceEventTime: context.sourceEventTime,
    availableAt: context.availableAt,
    featureSnapshotVersion: context.featureSnapshotVersion,
    preprocessingHash: context.preprocessingHash,
    sourceIds: [...context.sourceIds],
    featureSnapshot: context.featureSnapshot,
    approvalRef: context.approvalRef,
  };
}

function artifactIdFor(advisory: SignalAdvisory): string {
  return `historical-review-metadata:${hashCanonical({
    namespace: "R22_HISTORICAL_REVIEW_METADATA",
    signalId: advisory.signalId,
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  })}`;
}

export function buildHistoricalReviewMetadataSnapshotCandidate(
  input: HistoricalReviewMetadataInput,
): ObservationEvidenceCandidate {
  const { advisory, priorContext, capturedAt } = input;
  if (!validateObservationAdvisoryIdentity(advisoryIdentity(advisory))) {
    return notEvaluable("ADVISORY_IDENTITY_INVALID");
  }
  if (!isCanonicalUtcTimestamp(capturedAt) || Date.parse(capturedAt) < Date.parse(advisory.signalTime)) {
    return notEvaluable("CAPTURE_BEFORE_SIGNAL");
  }
  validatePriorContext(advisory, priorContext);

  const informationAsOf = advisory.signalTime;
  const priorPayload = priorContextPayload(priorContext);
  const sourceRef = `historical-review-source:${hashCanonical({
    namespace: "R22_HISTORICAL_REVIEW_SOURCE",
    currentSignalId: advisory.signalId,
    priorContextId: priorContext.contextId,
    priorSourceSignalId: priorContext.sourceSignalId,
    priorAvailableAt: priorContext.availableAt,
    featureSnapshotVersion: priorContext.featureSnapshotVersion,
    preprocessingHash: priorContext.preprocessingHash,
    sourceIds: [...priorContext.sourceIds],
    approvalRef: priorContext.approvalRef,
  })}`;
  const payload: ObservationJsonValue = {
    currentIdentity: advisoryIdentity(advisory),
    priorContext: priorPayload,
    informationAsOf,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
  const artifactId = artifactIdFor(advisory);
  const contentHash = calculateObservationSnapshotContentHash({
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    artifactType: "HISTORICAL_REVIEW_METADATA",
    advisoryIdentity: advisoryIdentity(advisory),
    informationAsOf,
    sourceRef,
    payload,
  });
  const evidenceHash = calculateObservationSnapshotEvidenceHash({
    contentHash,
    capturedAt,
    timestampAuthority: R22_OBSERVATION_TIMESTAMP_AUTHORITY,
    artifactId,
  });
  const evidenceId = `historical-review-evidence:${hashCanonical({
    namespace: "R22_HISTORICAL_REVIEW_EVIDENCE",
    artifactId,
    evidenceHash,
  })}`;
  const idempotencyKey = calculateObservationSnapshotIdempotencyKey({
    signalId: advisory.signalId,
    artifactType: "HISTORICAL_REVIEW_METADATA",
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    informationAsOf,
    contentHash,
  });

  return Object.freeze({
    evidenceId,
    eventKind: "SNAPSHOT",
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
    artifactId,
    artifactType: "HISTORICAL_REVIEW_METADATA",
    notificationObservationId: null,
    reviewObservationId: null,
    eventType: null,
    informationAsOf,
    capturedAt,
    observedAt: null,
    reviewStartedAt: null,
    reviewSubmittedAt: null,
    sourceRef,
    contentHash,
    evidenceHash,
    idempotencyKey,
    supersedesArtifactId: null,
    supersedesEvidenceId: null,
    payload,
    timestampAuthority: R22_OBSERVATION_TIMESTAMP_AUTHORITY,
    persistenceOperation: "APPEND",
  });
}
