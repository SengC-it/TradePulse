import { createHash } from "node:crypto";

import {
  canonicalJson,
} from "./canonical.ts";
import {
  calculateObservationSnapshotContentHash,
  calculateObservationSnapshotEvidenceHash,
  calculateObservationSnapshotIdempotencyKey,
  R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  R22_OBSERVATION_TIMESTAMP_AUTHORITY,
} from "./snapshot.ts";
import {
  isCanonicalUtcTimestamp,
  validateObservationAdvisoryIdentity,
} from "./validator.ts";
import type {
  ObservationEvidenceCandidate,
  ObservationJsonValue,
} from "./types.ts";
import type { BTCRegime } from "../strategy/types.ts";
import {
  evaluateSignalQuality,
  type SignalQualityInput,
  type SignalQualityRegime,
} from "../signal-quality/evaluator.ts";
import type { SignalAdvisory } from "../signal-advisory/types.ts";

export const R22_R2_QUALITY_SNAPSHOT_IMPLEMENTATION_STATUS = Object.freeze({
  r2QualitySnapshotProducerImplemented: true,
  qualitySnapshotRuntimeCallSiteImplemented: true,
  qualitySnapshotPersistenceAcknowledgementImplemented: true,
  introducesCapabilities: Object.freeze(["qualitySnapshotProducer"]),
  closesReadinessNodes: Object.freeze(["S01"]),
  dependsOn: Object.freeze(["R1"]),
  s01ImplementationStatus: "SOURCE_READY_PENDING_ACCEPTANCE",
  s01AcceptedReady: false,
  s02Status: "FAIL",
  s03Status: "FAIL",
  s04Status: "FAIL",
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
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  humanDecisionRequired: true,
  automaticTrading: false,
} as const);

type QualitySnapshotInput = Readonly<{
  advisory: SignalAdvisory;
  capturedAt: string;
}>;

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function mapMarketRegime(value: BTCRegime): SignalQualityRegime {
  if (value === "BTC_STRONG_BULL") return "BULL";
  if (value === "BTC_NEUTRAL") return "NEUTRAL";
  if (value === "BTC_STRONG_BEAR") return "BEAR";
  return "UNKNOWN";
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
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

function identityComplete(advisory: SignalAdvisory): boolean {
  return validateObservationAdvisoryIdentity(advisoryIdentity(advisory));
}

function strategySnapshotComplete(advisory: SignalAdvisory): boolean {
  return advisory.strategyId === "baseline-001"
    && advisory.strategyVersion.trim().length > 0
    && isCanonicalUtcTimestamp(advisory.signalTime)
    && isCanonicalUtcTimestamp(advisory.signalValidUntil)
    && isCanonicalUtcTimestamp(advisory.dataFreshness.candleCloseTime)
    && isCanonicalUtcTimestamp(advisory.dataFreshness.sourceServerTime)
    && advisory.dataFreshness.candleCloseTime === advisory.signalTime
    && advisory.dataFreshness.status === "FRESH"
    && Number.isFinite(advisory.dataFreshness.ageMs)
    && advisory.dataFreshness.ageMs >= 0
    && finitePositive(advisory.currentReferencePrice)
    && finitePositive(advisory.suggestedEntryReference)
    && finitePositive(advisory.stopLoss)
    && finitePositive(advisory.takeProfit)
    && finitePositive(advisory.riskReward)
    && Number.isFinite(advisory.score)
    && (advisory.grade === "A" || advisory.grade === "B" || advisory.grade === "C");
}

function qualityInput(advisory: SignalAdvisory): SignalQualityInput {
  return {
    direction: advisory.direction,
    referencePrice: advisory.suggestedEntryReference,
    stopLoss: advisory.stopLoss,
    takeProfit: advisory.takeProfit,
    closedCandle: advisory.dataFreshness.candleCloseTime === advisory.signalTime,
    freshData: advisory.dataFreshness.status === "FRESH",
    identityComplete: identityComplete(advisory),
    strategySnapshotComplete: strategySnapshotComplete(advisory),
    marketRegime: mapMarketRegime(advisory.marketRegime.btcRegime),
  };
}

function qualityPayload(advisory: SignalAdvisory): ObservationJsonValue {
  const result = evaluateSignalQuality(qualityInput(advisory));
  return {
    direction: result.direction,
    qualityGrade: result.qualityGrade,
    qualityScore: result.qualityScore,
    qualityStatus: result.qualityStatus,
    contextAlignment: result.marketContext.alignment,
    riskLevel: result.riskLevel,
    explanations: [...result.explanations],
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

function artifactIdFor(advisory: SignalAdvisory): string {
  return `quality-snapshot:${hashCanonical({
    namespace: "R22_QUALITY_SNAPSHOT",
    signalId: advisory.signalId,
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  })}`;
}

export function buildQualitySnapshotCandidate(input: QualitySnapshotInput): ObservationEvidenceCandidate {
  const { advisory, capturedAt } = input;
  const identity = advisoryIdentity(advisory);
  const informationAsOf = advisory.signalTime;
  const sourceRef = `tp_signal_advisories:${advisory.signalId}`;
  const payload = qualityPayload(advisory);
  const artifactId = artifactIdFor(advisory);
  const contentHash = calculateObservationSnapshotContentHash({
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    artifactType: "QUALITY_SNAPSHOT",
    advisoryIdentity: identity,
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
  const evidenceId = `quality-snapshot-evidence:${hashCanonical({
    namespace: "R22_QUALITY_SNAPSHOT_EVIDENCE",
    artifactId,
    evidenceHash,
  })}`;
  const idempotencyKey = calculateObservationSnapshotIdempotencyKey({
    signalId: advisory.signalId,
    artifactType: "QUALITY_SNAPSHOT",
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
    artifactType: "QUALITY_SNAPSHOT",
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
