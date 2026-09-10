import { createHash } from "node:crypto";

import {
  buildR22AlertIntelligence,
  type R22AlertHistoricalReviewMetadata,
  type R22AlertIdentity,
  type R22AlertMarketContextSnapshot,
  type R22AlertQualitySnapshot,
  type R22AlertRiskSnapshot,
  type R22AlertSignalSnapshot,
} from "../research/alert-intelligence-protocol.ts";
import type { SignalAdvisory } from "../signal-advisory/types.ts";
import { canonicalJson } from "./canonical.ts";
import {
  calculateObservationSnapshotContentHash,
  calculateObservationSnapshotEvidenceHash,
  calculateObservationSnapshotIdempotencyKey,
  R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  R22_OBSERVATION_TIMESTAMP_AUTHORITY,
} from "./snapshot.ts";
import type {
  ObservationEvidenceCandidate,
  ObservationJsonValue,
} from "./types.ts";
import {
  validateObservationEvidenceCandidate,
} from "./validator.ts";

export const R22_R6_ALERT_INTELLIGENCE_PRODUCER_IMPLEMENTATION_STATUS = Object.freeze({
  r1FoundationImplemented: true,
  r2QualitySnapshotProducerImplemented: true,
  r3MarketContextProducerImplemented: true,
  r4RiskAdvisoryProducerImplemented: true,
  r5HistoricalReviewMetadataProducerImplemented: true,
  r6AlertIntelligenceProducerImplemented: true,
  r6AcceptanceStatus: "ACCEPTED",
  introducesCapabilities: Object.freeze(["alertIntelligenceProducer"]),
  closesReadinessNodes: Object.freeze(["S05"]),
  dependsOn: Object.freeze(["R2", "R3", "R4", "R5"]),
  s01Status: "SOURCE_READY",
  s02Status: "SOURCE_READY",
  s03Status: "SOURCE_READY",
  s04Status: "SOURCE_READY",
  s04AcceptedReady: true,
  s05ImplementationStatus: "SOURCE_READY",
  s05AcceptedReady: true,
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

type JsonRecord = { readonly [key: string]: ObservationJsonValue };

export type AlertIntelligenceSnapshotCandidateInput = Readonly<{
  advisory: SignalAdvisory;
  qualityEvidence: ObservationEvidenceCandidate | null;
  marketContextEvidence: ObservationEvidenceCandidate | null;
  riskAdvisoryEvidence: ObservationEvidenceCandidate | null;
  historicalReviewEvidence: ObservationEvidenceCandidate | null;
  capturedAt: string;
}>;

type LogicalInputManifest = Readonly<{
  artifactType: ObservationEvidenceCandidate["artifactType"];
  artifactId: string;
  schemaVersion: string;
  informationAsOf: string;
  contentHash: string;
  idempotencyKey: string;
}>;

export class AlertIntelligenceNotEvaluableError extends Error {
  readonly code = "NOT_EVALUABLE" as const;

  constructor(reason: string) {
    super(`ALERT_INTELLIGENCE_NOT_EVALUABLE:${reason}`);
    this.name = "AlertIntelligenceNotEvaluableError";
  }
}

function notEvaluable(reason: string): never {
  throw new AlertIntelligenceNotEvaluableError(reason);
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function isRecord(value: ObservationJsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function finiteField(record: JsonRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function identityFor(advisory: SignalAdvisory): R22AlertIdentity {
  return {
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
  };
}

function validateCandidate(
  candidate: ObservationEvidenceCandidate,
  expectedArtifactType: NonNullable<ObservationEvidenceCandidate["artifactType"]>,
  advisory: SignalAdvisory,
): ObservationEvidenceCandidate {
  const validation = validateObservationEvidenceCandidate(candidate);
  if (validation.status !== "VALID") return notEvaluable("UPSTREAM_EVIDENCE_INVALID");
  if (candidate.artifactType !== expectedArtifactType
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
  return candidate;
}

function missingQuality(): R22AlertQualitySnapshot {
  return {
    status: "MISSING",
    grade: null,
    score: null,
    explanations: [],
  };
}

function missingMarketContext(): R22AlertMarketContextSnapshot {
  return {
    status: "MISSING",
    regime: null,
    alignment: null,
    explanation: null,
  };
}

function missingRiskAdvisory(): R22AlertRiskSnapshot {
  return {
    status: "MISSING",
    level: null,
    explanation: null,
  };
}

function missingHistoricalReview(): R22AlertHistoricalReviewMetadata {
  return {
    status: "MISSING",
    reviewStatus: "UNAVAILABLE",
    contextSummary: null,
  };
}

function requirePayload(candidate: ObservationEvidenceCandidate): JsonRecord {
  if (!isRecord(candidate.payload)) return notEvaluable("UPSTREAM_PAYLOAD_INVALID");
  return candidate.payload;
}

function qualityAdapter(
  candidate: ObservationEvidenceCandidate,
  advisory: SignalAdvisory,
): R22AlertQualitySnapshot {
  const payload = requirePayload(candidate);
  const grade = stringField(payload, "qualityGrade");
  const score = finiteField(payload, "qualityScore");
  const status = stringField(payload, "qualityStatus");
  const explanations = payload.explanations;
  const riskLevel = stringField(payload, "riskLevel");
  const contextAlignment = stringField(payload, "contextAlignment");
  if (payload.direction !== advisory.direction
    || status !== "ADVISORY_VALID"
    || (grade !== "A" && grade !== "B" && grade !== "C")
    || score === null
    || !Array.isArray(explanations)
    || !explanations.every((value) => typeof value === "string" && value.trim().length > 0)
    || riskLevel === null
    || contextAlignment === null
    || payload.humanDecisionRequired !== true
    || payload.automaticTrading !== false) {
    return notEvaluable("UPSTREAM_QUALITY_INVALID");
  }
  return {
    status: "AVAILABLE",
    grade,
    score,
    explanations: explanations as readonly string[],
  };
}

function marketAdapter(
  candidate: ObservationEvidenceCandidate,
  qualityCandidate: ObservationEvidenceCandidate | null,
  advisory: SignalAdvisory,
): R22AlertMarketContextSnapshot {
  const payload = requirePayload(candidate);
  const qualityPayload = qualityCandidate ? requirePayload(qualityCandidate) : null;
  if (payload.symbol !== advisory.symbol
    || payload.direction !== advisory.direction
    || payload.symbolRegime !== advisory.marketRegime.symbolRegime
    || payload.btcRegime !== advisory.marketRegime.btcRegime
    || (payload.symbolRegime !== "LONG_ONLY"
      && payload.symbolRegime !== "SHORT_ONLY"
      && payload.symbolRegime !== "NO_TRADE")) {
    return notEvaluable("UPSTREAM_MARKET_CONTEXT_INVALID");
  }
  const btcRegime = payload.btcRegime;
  const regime = btcRegime === "BTC_STRONG_BULL"
    ? "BULL"
    : btcRegime === "BTC_NEUTRAL"
      ? "NEUTRAL"
      : btcRegime === "BTC_STRONG_BEAR"
        ? "BEAR"
        : null;
  const alignment = qualityPayload
    ? stringField(qualityPayload, "contextAlignment")
    : "UNAVAILABLE";
  const explanations = qualityPayload?.explanations;
  const explanation = Array.isArray(explanations) && typeof explanations[0] === "string"
    ? explanations[0]
    : "Market context alignment is unavailable because the quality snapshot is missing.";
  if (!regime || !alignment || !explanation) return notEvaluable("UPSTREAM_MARKET_CONTEXT_INVALID");
  if (!["SUPPORTIVE", "NEUTRAL", "ADVERSE", "UNAVAILABLE", "NOT_APPLICABLE"].includes(alignment)) {
    return notEvaluable("UPSTREAM_MARKET_CONTEXT_INVALID");
  }
  return {
    status: "AVAILABLE",
    regime,
    alignment: alignment as R22AlertMarketContextSnapshot["alignment"],
    explanation,
  };
}

function riskAdapter(
  qualityCandidate: ObservationEvidenceCandidate | null,
  candidate: ObservationEvidenceCandidate,
  advisory: SignalAdvisory,
): R22AlertRiskSnapshot {
  const qualityPayloadValue = qualityCandidate ? requirePayload(qualityCandidate) : null;
  const payload = requirePayload(candidate);
  const riskLevel = qualityPayloadValue
    ? stringField(qualityPayloadValue, "riskLevel")
    : "UNAVAILABLE";
  const geometry = payload.geometry;
  if (!riskLevel
    || !["STANDARD", "CAUTION", "UNAVAILABLE", "NOT_APPLICABLE"].includes(riskLevel)
    || !isRecord(geometry)
    || payload.symbol !== advisory.symbol
    || payload.direction !== advisory.direction) {
    return notEvaluable("UPSTREAM_RISK_ADVISORY_INVALID");
  }
  const entryReference = finiteField(geometry, "entryReference");
  const stopLoss = finiteField(geometry, "stopLoss");
  const takeProfit = finiteField(geometry, "takeProfit");
  const stopDistance = finiteField(geometry, "stopDistance");
  const rewardDistance = finiteField(geometry, "rewardDistance");
  const riskReward = finiteField(geometry, "riskReward");
  if (entryReference === null || stopLoss === null || takeProfit === null
    || stopDistance === null || rewardDistance === null || riskReward === null
    || entryReference !== advisory.suggestedEntryReference
    || stopLoss !== advisory.stopLoss
    || takeProfit !== advisory.takeProfit
    || riskReward !== advisory.riskReward
    || stopDistance <= 0
    || rewardDistance <= 0
    || riskReward <= 0) {
    return notEvaluable("UPSTREAM_RISK_ADVISORY_INVALID");
  }
  const explanation = qualityCandidate
    ? `Risk geometry is available for manual review: stop distance ${stopDistance}, reward distance ${rewardDistance}.`
    : "Risk level is unavailable because the quality snapshot is missing; geometry remains available for manual review.";
  return {
    status: "AVAILABLE",
    level: riskLevel as R22AlertRiskSnapshot["level"],
    explanation,
  };
}

function historicalAdapter(candidate: ObservationEvidenceCandidate): R22AlertHistoricalReviewMetadata {
  const payload = requirePayload(candidate);
  const priorContext = payload.priorContext;
  if (!isRecord(priorContext)
    || stringField(priorContext, "contextId") === null
    || stringField(priorContext, "sourceSignalId") === null
    || stringField(priorContext, "availableAt") === null) {
    return notEvaluable("UPSTREAM_HISTORICAL_REVIEW_INVALID");
  }
  return {
    status: "AVAILABLE",
    reviewStatus: "IDENTITY_ONLY",
    contextSummary: "Historical identity context is available; no outcome is inferred.",
  };
}

function logicalManifest(candidate: ObservationEvidenceCandidate): LogicalInputManifest {
  return {
    artifactType: candidate.artifactType,
    artifactId: candidate.artifactId!,
    schemaVersion: candidate.schemaVersion,
    informationAsOf: candidate.informationAsOf!,
    contentHash: candidate.contentHash!,
    idempotencyKey: candidate.idempotencyKey,
  };
}

export function buildAlertIntelligenceSnapshotCandidate(
  input: AlertIntelligenceSnapshotCandidateInput,
): ObservationEvidenceCandidate {
  const { advisory, capturedAt } = input;
  const qualityEvidence = input.qualityEvidence
    ? validateCandidate(input.qualityEvidence, "QUALITY_SNAPSHOT", advisory)
    : null;
  const marketContextEvidence = input.marketContextEvidence
    ? validateCandidate(input.marketContextEvidence, "MARKET_CONTEXT", advisory)
    : null;
  const riskAdvisoryEvidence = input.riskAdvisoryEvidence
    ? validateCandidate(input.riskAdvisoryEvidence, "RISK_ADVISORY", advisory)
    : null;
  const historicalReviewEvidence = input.historicalReviewEvidence
    ? validateCandidate(input.historicalReviewEvidence, "HISTORICAL_REVIEW_METADATA", advisory)
    : null;
  const signalTime = Date.parse(advisory.signalTime);
  const capturedAtTime = Date.parse(capturedAt);
  if (!Number.isFinite(capturedAtTime) || capturedAtTime < signalTime) {
    return notEvaluable("CAPTURE_BEFORE_SIGNAL");
  }

  const quality = qualityEvidence ? qualityAdapter(qualityEvidence, advisory) : missingQuality();
  const marketContext = marketContextEvidence
    ? marketAdapter(marketContextEvidence, qualityEvidence, advisory)
    : missingMarketContext();
  const riskAdvisory = riskAdvisoryEvidence
    ? riskAdapter(qualityEvidence, riskAdvisoryEvidence, advisory)
    : missingRiskAdvisory();
  const historicalReview = historicalReviewEvidence
    ? historicalAdapter(historicalReviewEvidence)
    : missingHistoricalReview();
  const inputs = [qualityEvidence, marketContextEvidence, riskAdvisoryEvidence, historicalReviewEvidence]
    .filter((candidate): candidate is ObservationEvidenceCandidate => candidate !== null);
  const inputManifest = inputs.map(logicalManifest);
  const informationAsOf = inputs.length === 0
    ? advisory.signalTime
    : new Date(Math.max(...inputs.map((candidate) => Date.parse(candidate.informationAsOf!)))).toISOString();
  if (Date.parse(informationAsOf) > signalTime) return notEvaluable("UPSTREAM_PIT_INVALID");

  const signal: R22AlertSignalSnapshot = {
    direction: advisory.direction,
    identity: identityFor(advisory),
    triggerExplanation: null,
  };
  const alertIntelligence = buildR22AlertIntelligence({
    signal,
    quality,
    marketContext,
    riskAdvisory,
    historicalReview,
  });
  if (alertIntelligence.priority === "IGNORE"
    || alertIntelligence.presentationStatus === "SUPPRESSED"
    || alertIntelligence.notificationImportance === "DO_NOT_NOTIFY") {
    return notEvaluable("ALERT_INTELLIGENCE_RESULT_INCONSISTENT");
  }
  const sourceRef = `alert-intelligence-source:${hashCanonical({
    namespace: "R22_ALERT_INTELLIGENCE_SOURCE",
    inputs: inputManifest,
  })}`;
  const payload: ObservationJsonValue = {
    signal,
    alertIntelligence,
    sourceAdapters: {
      quality,
      marketContext,
      riskAdvisory,
      historicalReview,
    },
    inputManifest,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
  const identity = {
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
  } as const;
  const artifactId = `alert-intelligence:${hashCanonical({
    namespace: "R22_ALERT_INTELLIGENCE",
    signalId: advisory.signalId,
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  })}`;
  const contentHash = calculateObservationSnapshotContentHash({
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    artifactType: "ALERT_INTELLIGENCE",
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
  const evidenceId = `alert-intelligence-evidence:${hashCanonical({
    namespace: "R22_ALERT_INTELLIGENCE_EVIDENCE",
    artifactId,
    evidenceHash,
  })}`;
  const idempotencyKey = calculateObservationSnapshotIdempotencyKey({
    signalId: advisory.signalId,
    artifactType: "ALERT_INTELLIGENCE",
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
    artifactType: "ALERT_INTELLIGENCE",
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
