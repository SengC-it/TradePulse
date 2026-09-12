import { createHash } from "node:crypto";

import type { SignalAdvisory } from "../signal-advisory/types.ts";
import { canonicalJson, isCanonicalJsonValue } from "./canonical.ts";
import {
  calculateObservationSnapshotContentHash,
  calculateObservationSnapshotEvidenceHash,
  calculateObservationSnapshotIdempotencyKey,
  R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  R22_OBSERVATION_TIMESTAMP_AUTHORITY,
} from "./snapshot.ts";
import type { ObservationEvidenceCandidate, ObservationJsonValue } from "./types.ts";
import { validateObservationEvidenceCandidate } from "./validator.ts";

export const R22_R7_PRESENTATION_EVIDENCE_BOUNDARY_IMPLEMENTATION_STATUS = Object.freeze({
  r1FoundationImplemented: true,
  r2QualitySnapshotProducerImplemented: true,
  r3MarketContextProducerImplemented: true,
  r4RiskAdvisoryProducerImplemented: true,
  r5HistoricalReviewMetadataProducerImplemented: true,
  r6AlertIntelligenceProducerImplemented: true,
  r6AcceptanceStatus: "ACCEPTED",
  r7AcceptanceStatus: "ACCEPTED",
  r7PresentationEvidenceBoundaryImplemented: true,
  closesReadinessNodes: Object.freeze(["S06"]),
  s01Status: "SOURCE_READY",
  s02Status: "SOURCE_READY",
  s03Status: "SOURCE_READY",
  s04Status: "SOURCE_READY",
  s04AcceptedReady: true,
  s05Status: "SOURCE_READY",
  s05AcceptedReady: true,
  s06Status: "SOURCE_READY",
  s06AcceptedReady: true,
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

type JsonRecord = { readonly [key: string]: ObservationJsonValue };

export type PresentationSnapshotCandidateInput = Readonly<{
  advisory: Pick<SignalAdvisory, "signalId" | "symbol" | "direction" | "signalTime" | "strategyId" | "strategyVersion">;
  alertIntelligenceEvidence: ObservationEvidenceCandidate;
  presentationChannel: "EMAIL" | "WEB";
  presentationPayload: ObservationJsonValue;
  capturedAt: string;
}>;

export class PresentationNotEvaluableError extends Error {
  readonly code = "NOT_EVALUABLE" as const;

  constructor(reason: string) {
    super(`PRESENTATION_NOT_EVALUABLE:${reason}`);
    this.name = "PresentationNotEvaluableError";
  }
}

function notEvaluable(reason: string): never {
  throw new PresentationNotEvaluableError(reason);
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function isRecord(value: ObservationJsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAlertIntelligenceEvidence(
  candidate: ObservationEvidenceCandidate,
  advisory: PresentationSnapshotCandidateInput["advisory"],
): JsonRecord {
  const validation = validateObservationEvidenceCandidate(candidate);
  if (validation.status !== "VALID") return notEvaluable("UPSTREAM_EVIDENCE_INVALID");
  if (candidate.artifactType !== "ALERT_INTELLIGENCE"
    || candidate.artifactId === null
    || candidate.informationAsOf === null
    || candidate.contentHash === null
    || candidate.evidenceHash === null
    || candidate.idempotencyKey.trim().length === 0) {
    return notEvaluable("UPSTREAM_EVIDENCE_INCOMPLETE");
  }
  if (candidate.signalId !== advisory.signalId
    || candidate.symbol !== advisory.symbol
    || candidate.direction !== advisory.direction
    || candidate.signalTime !== advisory.signalTime
    || candidate.strategyId !== advisory.strategyId
    || candidate.strategyVersion !== advisory.strategyVersion) {
    return notEvaluable("UPSTREAM_IDENTITY_MISMATCH");
  }
  const signalTime = Date.parse(advisory.signalTime);
  const informationAsOf = Date.parse(candidate.informationAsOf);
  if (!Number.isFinite(signalTime) || !Number.isFinite(informationAsOf) || informationAsOf > signalTime) {
    return notEvaluable("UPSTREAM_PIT_INVALID");
  }
  if (!isRecord(candidate.payload)
    || !isRecord(candidate.payload.alertIntelligence)
    || candidate.payload.humanDecisionRequired !== true
    || candidate.payload.automaticTrading !== false) {
    return notEvaluable("UPSTREAM_PAYLOAD_INVALID");
  }
  return candidate.payload;
}

function advisoryIdentity(advisory: PresentationSnapshotCandidateInput["advisory"]) {
  return {
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
  } as const;
}

export function buildPresentationSnapshotCandidate(
  input: PresentationSnapshotCandidateInput,
): ObservationEvidenceCandidate {
  const {
    advisory,
    alertIntelligenceEvidence,
    presentationChannel,
    presentationPayload,
    capturedAt,
  } = input;
  const alertIntelligencePayload = validateAlertIntelligenceEvidence(alertIntelligenceEvidence, advisory);
  const upstreamArtifactId = alertIntelligenceEvidence.artifactId;
  const informationAsOf = alertIntelligenceEvidence.informationAsOf;
  const upstreamContentHash = alertIntelligenceEvidence.contentHash;
  if (upstreamArtifactId === null || informationAsOf === null || upstreamContentHash === null) {
    return notEvaluable("UPSTREAM_EVIDENCE_INCOMPLETE");
  }
  const signalTime = Date.parse(advisory.signalTime);
  const capturedAtTime = Date.parse(capturedAt);
  if (!Number.isFinite(capturedAtTime) || capturedAtTime < signalTime) {
    return notEvaluable("CAPTURE_BEFORE_SIGNAL");
  }
  if (!isCanonicalJsonValue(presentationPayload)) {
    return notEvaluable("PRESENTATION_PAYLOAD_INVALID");
  }

  const sourceRef = `presentation-source:${hashCanonical({
    namespace: "R22_PRESENTATION_SOURCE",
    alertIntelligenceArtifactId: alertIntelligenceEvidence.artifactId,
    alertIntelligenceContentHash: upstreamContentHash,
    alertIntelligenceIdempotencyKey: alertIntelligenceEvidence.idempotencyKey,
  })}`;
  const payload: ObservationJsonValue = {
    presentation: {
      channel: presentationChannel,
      payload: presentationPayload,
    },
    alertIntelligence: alertIntelligencePayload.alertIntelligence,
    alertIntelligenceEvidence: {
      artifactId: alertIntelligenceEvidence.artifactId,
      contentHash: alertIntelligenceEvidence.contentHash,
      idempotencyKey: alertIntelligenceEvidence.idempotencyKey,
    },
    humanDecisionRequired: true,
    automaticTrading: false,
  };
  const artifactId = `presentation:${hashCanonical({
    namespace: "R22_PRESENTATION",
    signalId: advisory.signalId,
    presentationChannel,
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  })}`;
  const contentHash = calculateObservationSnapshotContentHash({
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    artifactType: "PRESENTATION",
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
  const evidenceId = `presentation-evidence:${hashCanonical({
    namespace: "R22_PRESENTATION_EVIDENCE",
    artifactId,
    evidenceHash,
  })}`;
  const idempotencyKey = calculateObservationSnapshotIdempotencyKey({
    signalId: advisory.signalId,
    artifactType: "PRESENTATION",
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
    artifactType: "PRESENTATION",
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
