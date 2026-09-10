import type { DashboardAdvisory } from "./types.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import {
  buildPresentationSnapshotCandidate,
  type PresentationSnapshotCandidateInput,
} from "../observation-evidence/presentation.ts";
import { isCanonicalJsonValue } from "../observation-evidence/canonical.ts";
import type {
  ObservationEvidenceAppendResult,
  ObservationEvidenceCandidate,
  ObservationJsonValue,
  ObservationTimestampAuthority,
} from "../observation-evidence/types.ts";
import type { AdvisoryDirection } from "../signal-advisory/types.ts";

type JsonRecord = { readonly [key: string]: ObservationJsonValue };

export type DashboardPresentationAppender = Readonly<{
  appendEvidence(candidate: ObservationEvidenceCandidate): Promise<ObservationEvidenceAppendResult>;
}>;

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isResearchSymbol(value: unknown): value is ResearchSymbol {
  return typeof value === "string" && RESEARCH_SYMBOLS.includes(value as ResearchSymbol);
}

function isDirection(value: unknown): value is AdvisoryDirection {
  return value === "LONG" || value === "SHORT";
}

function isTimestampAuthority(value: unknown): value is ObservationTimestampAuthority {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.capturedAtAuthority === "SERVER_WALL_CLOCK"
    && record.informationAsOfAuthority === "SERVER_SOURCE_CUTOFF"
    && record.userSuppliedCapturedAt === false
    && record.userSuppliedInformationAsOf === false
    && record.backdated === false;
}

export function observationEvidenceCandidateFromRow(row: Record<string, unknown>): ObservationEvidenceCandidate | null {
  const eventKind = row.event_kind === "SNAPSHOT" ? "SNAPSHOT" : null;
  const artifactType = row.artifact_type === "ALERT_INTELLIGENCE" ? "ALERT_INTELLIGENCE" : null;
  const symbol = isResearchSymbol(row.symbol) ? row.symbol : null;
  const direction = isDirection(row.direction) ? row.direction : null;
  const payload = row.payload;
  const timestampAuthority = row.timestamp_authority;
  if (eventKind === null
    || artifactType === null
    || symbol === null
    || direction === null
    || !isCanonicalJsonValue(payload)
    || !isTimestampAuthority(timestampAuthority)) {
    return null;
  }

  const evidenceId = stringValue(row.evidence_id);
  const schemaVersion = stringValue(row.schema_version);
  const signalId = stringValue(row.signal_id);
  const signalTime = stringValue(row.signal_time);
  const strategyId = stringValue(row.strategy_id);
  const strategyVersion = stringValue(row.strategy_version);
  const capturedAt = stringValue(row.captured_at);
  const sourceRef = stringValue(row.source_ref);
  const idempotencyKey = stringValue(row.idempotency_key);
  if (!evidenceId || !schemaVersion || !signalId || !signalTime || !strategyId
    || !strategyVersion || !capturedAt || !sourceRef || !idempotencyKey) {
    return null;
  }

  return {
    evidenceId,
    eventKind,
    schemaVersion,
    signalId,
    symbol,
    direction,
    signalTime,
    strategyId,
    strategyVersion,
    artifactId: stringValue(row.artifact_id),
    artifactType,
    notificationObservationId: stringValue(row.notification_observation_id),
    reviewObservationId: stringValue(row.review_observation_id),
    eventType: row.event_type === "REVIEW_STARTED" || row.event_type === "REVIEW_SUBMITTED" ? row.event_type : null,
    informationAsOf: stringValue(row.information_as_of),
    capturedAt,
    observedAt: stringValue(row.observed_at),
    reviewStartedAt: stringValue(row.review_started_at),
    reviewSubmittedAt: stringValue(row.review_submitted_at),
    sourceRef,
    contentHash: stringValue(row.content_hash),
    evidenceHash: stringValue(row.evidence_hash),
    idempotencyKey,
    supersedesArtifactId: stringValue(row.supersedes_artifact_id),
    supersedesEvidenceId: stringValue(row.supersedes_evidence_id),
    payload: payload as ObservationJsonValue,
    timestampAuthority,
    persistenceOperation: "APPEND",
  };
}

export function buildDashboardWebPresentationPayload(advisory: DashboardAdvisory): ObservationJsonValue {
  const dataFreshness = advisory.dataFreshness === null
    ? null
    : JSON.parse(JSON.stringify(advisory.dataFreshness)) as ObservationJsonValue;
  return {
    signal: {
      signalId: advisory.signalId,
      symbol: advisory.symbol,
      direction: advisory.direction,
      strategyVersion: advisory.strategyVersion,
      signalTime: advisory.signalTime,
      signalValidUntil: advisory.signalValidUntil,
      score: advisory.score,
      grade: advisory.grade,
      currentReferencePrice: advisory.currentReferencePrice,
      suggestedEntryReference: advisory.suggestedEntryReference,
      stopLoss: advisory.stopLoss,
      takeProfit: advisory.takeProfit,
      riskReward: advisory.riskReward,
      dataFreshness,
    },
    notificationState: {
      deliveryStatus: advisory.deliveryStatus,
      sentAt: advisory.sentAt,
      provenance: "POST_SIGNAL_NOTIFICATION_STATE_NOT_R22_DECISION_TIME",
    },
  } as JsonRecord;
}

function dashboardPresentationIdentity(advisory: DashboardAdvisory): PresentationSnapshotCandidateInput["advisory"] | null {
  if (!isResearchSymbol(advisory.symbol)) return null;
  return {
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: "baseline-001",
    strategyVersion: advisory.strategyVersion,
  };
}

function notEvaluable(): ObservationEvidenceAppendResult {
  return {
    status: "NOT_EVALUABLE",
    evidenceId: "dashboard-presentation-unavailable",
    reason: "INVALID_CANDIDATE",
  };
}

export async function appendDashboardWebPresentationEvidence(input: Readonly<{
  advisory: DashboardAdvisory;
  alertIntelligenceEvidence: ObservationEvidenceCandidate | null;
  appender: DashboardPresentationAppender;
  capturedAt: string;
}>): Promise<ObservationEvidenceAppendResult> {
  if (input.alertIntelligenceEvidence === null) return notEvaluable();
  const advisoryIdentity = dashboardPresentationIdentity(input.advisory);
  if (advisoryIdentity === null) return notEvaluable();

  try {
    const candidate = buildPresentationSnapshotCandidate({
      advisory: advisoryIdentity,
      alertIntelligenceEvidence: input.alertIntelligenceEvidence,
      presentationChannel: "WEB",
      presentationPayload: buildDashboardWebPresentationPayload(input.advisory),
      capturedAt: input.capturedAt,
    });
    return await input.appender.appendEvidence(candidate);
  } catch {
    return notEvaluable();
  }
}
