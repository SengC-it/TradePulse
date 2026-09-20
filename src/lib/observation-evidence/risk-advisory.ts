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

export const R22_R4_RISK_ADVISORY_PRODUCER_IMPLEMENTATION_STATUS = Object.freeze({
  r1FoundationImplemented: true,
  r2QualitySnapshotProducerImplemented: true,
  r3MarketContextProducerImplemented: true,
  r4RiskAdvisoryProducerImplemented: true,
  introducesCapabilities: Object.freeze(["riskAdvisoryProducer"]),
  closesReadinessNodes: Object.freeze(["S03"]),
  dependsOn: Object.freeze(["R1"]),
  s01Status: "SOURCE_READY",
  s01AcceptedReady: true,
  s02Status: "SOURCE_READY",
  s02AcceptedReady: true,
  s03ImplementationStatus: "SOURCE_READY_PENDING_ACCEPTANCE",
  s03AcceptedReady: false,
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
  historicalBackfillExecuted: false,
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  humanDecisionRequired: true,
  automaticTrading: false,
} as const);

type RiskAdvisoryInput = Readonly<{
  advisory: SignalAdvisory;
  capturedAt: string;
}>;

type RiskGeometry = Readonly<{
  entryReference: number;
  stopLoss: number;
  takeProfit: number;
  stopDistance: number;
  rewardDistance: number;
  riskReward: number;
}>;

export class RiskAdvisoryNotEvaluableError extends Error {
  readonly code = "NOT_EVALUABLE" as const;

  constructor(reason: string) {
    super(`RISK_ADVISORY_NOT_EVALUABLE:${reason}`);
    this.name = "RiskAdvisoryNotEvaluableError";
  }
}

function notEvaluable(reason: string): never {
  throw new RiskAdvisoryNotEvaluableError(reason);
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
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

function validateSourceCutoff(advisory: SignalAdvisory): string {
  const freshness = advisory.dataFreshness;
  if (freshness.status !== "FRESH") return notEvaluable("SOURCE_NOT_FRESH");
  if (!isCanonicalUtcTimestamp(advisory.signalTime)
    || !isCanonicalUtcTimestamp(freshness.candleCloseTime)
    || freshness.candleCloseTime !== advisory.signalTime) {
    return notEvaluable("SOURCE_CUTOFF_MISMATCH");
  }
  if (!isCanonicalUtcTimestamp(freshness.sourceServerTime)
    || Date.parse(freshness.sourceServerTime) < Date.parse(advisory.signalTime)) {
    return notEvaluable("SOURCE_SERVER_TIME_INVALID");
  }
  return freshness.candleCloseTime;
}

function validateGeometry(advisory: SignalAdvisory): RiskGeometry {
  const entryReference = advisory.suggestedEntryReference;
  const stopLoss = advisory.stopLoss;
  const takeProfit = advisory.takeProfit;
  const riskReward = advisory.riskReward;
  if (![entryReference, stopLoss, takeProfit, riskReward].every(finitePositive)) {
    return notEvaluable("GEOMETRY_NOT_FINITE_POSITIVE");
  }
  if (advisory.direction === "LONG") {
    if (!(stopLoss < entryReference && entryReference < takeProfit)) {
      return notEvaluable("LONG_GEOMETRY_ORDER_INVALID");
    }
  } else if (advisory.direction === "SHORT") {
    if (!(takeProfit < entryReference && entryReference < stopLoss)) {
      return notEvaluable("SHORT_GEOMETRY_ORDER_INVALID");
    }
  } else {
    return notEvaluable("DIRECTION_INVALID");
  }

  const stopDistance = Math.abs(entryReference - stopLoss);
  const rewardDistance = Math.abs(takeProfit - entryReference);
  if (!finitePositive(stopDistance) || !finitePositive(rewardDistance)) {
    return notEvaluable("GEOMETRY_DISTANCE_INVALID");
  }
  const derivedRiskReward = rewardDistance / stopDistance;
  if (!Number.isFinite(derivedRiskReward) || derivedRiskReward <= 0) {
    return notEvaluable("DERIVED_RISK_REWARD_INVALID");
  }
  if (riskReward !== derivedRiskReward) {
    return notEvaluable("RISK_REWARD_MISMATCH");
  }
  return {
    entryReference,
    stopLoss,
    takeProfit,
    stopDistance,
    rewardDistance,
    riskReward,
  };
}

function validateIdentity(advisory: SignalAdvisory): void {
  if (!validateObservationAdvisoryIdentity(advisoryIdentity(advisory))
    || advisory.strategyId !== "baseline-001"
    || advisory.strategyVersion.trim().length === 0
    || !isCanonicalUtcTimestamp(advisory.signalValidUntil)) {
    notEvaluable("ADVISORY_IDENTITY_INVALID");
  }
}

function sourceRefFor(
  advisory: SignalAdvisory,
  informationAsOf: string,
  geometry: RiskGeometry,
): string {
  return `risk-advisory-source:${hashCanonical({
    namespace: "R22_RISK_ADVISORY_SOURCE",
    signalId: advisory.signalId,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
    signalTime: advisory.signalTime,
    informationAsOf,
    geometry,
  })}`;
}

function artifactIdFor(advisory: SignalAdvisory): string {
  return `risk-advisory:${hashCanonical({
    namespace: "R22_RISK_ADVISORY",
    signalId: advisory.signalId,
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  })}`;
}

function payloadFor(
  advisory: SignalAdvisory,
  informationAsOf: string,
  geometry: RiskGeometry,
): ObservationJsonValue {
  return {
    sourceManifest: {
      sourceType: "SIGNAL_ADVISORY_GEOMETRY",
      advisorySourceRef: `tp_signal_advisories:${advisory.signalId}`,
      signalId: advisory.signalId,
      strategyId: advisory.strategyId,
      strategyVersion: advisory.strategyVersion,
      signalTime: advisory.signalTime,
      candleCloseTime: advisory.dataFreshness.candleCloseTime,
      informationAsOf,
      sourceServerTime: advisory.dataFreshness.sourceServerTime,
      geometry,
    },
    symbol: advisory.symbol,
    direction: advisory.direction,
    geometry,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function buildRiskAdvisorySnapshotCandidate(
  input: RiskAdvisoryInput,
): ObservationEvidenceCandidate {
  const { advisory, capturedAt } = input;
  validateIdentity(advisory);
  const informationAsOf = validateSourceCutoff(advisory);
  const geometry = validateGeometry(advisory);
  if (!isCanonicalUtcTimestamp(capturedAt)
    || Date.parse(capturedAt) < Date.parse(advisory.signalTime)) {
    return notEvaluable("CAPTURE_BEFORE_SIGNAL");
  }

  const identity = advisoryIdentity(advisory);
  const sourceRef = sourceRefFor(advisory, informationAsOf, geometry);
  const payload = payloadFor(advisory, informationAsOf, geometry);
  const artifactId = artifactIdFor(advisory);
  const contentHash = calculateObservationSnapshotContentHash({
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    artifactType: "RISK_ADVISORY",
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
  const evidenceId = `risk-advisory-evidence:${hashCanonical({
    namespace: "R22_RISK_ADVISORY_EVIDENCE",
    artifactId,
    evidenceHash,
  })}`;
  const idempotencyKey = calculateObservationSnapshotIdempotencyKey({
    signalId: advisory.signalId,
    artifactType: "RISK_ADVISORY",
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
    artifactType: "RISK_ADVISORY",
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
