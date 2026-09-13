import { createHash } from "node:crypto";

import type { Candle, ClosedCandleDataset, MarketSnapshot } from "../market-data/types.ts";
import type { SignalAdvisory } from "../signal-advisory/types.ts";
import type { BTCRegime, SymbolRegime } from "../strategy/types.ts";
import { canonicalJson } from "./canonical.ts";
import {
  calculateObservationSnapshotContentHash,
  calculateObservationSnapshotEvidenceHash,
  calculateObservationSnapshotIdempotencyKey,
  R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  R22_OBSERVATION_TIMESTAMP_AUTHORITY,
} from "./snapshot.ts";
import type { ObservationEvidenceCandidate, ObservationJsonValue } from "./types.ts";
import { isCanonicalUtcTimestamp, validateObservationAdvisoryIdentity } from "./validator.ts";

export const R22_R3_MARKET_CONTEXT_IMPLEMENTATION_STATUS = Object.freeze({
  r1FoundationImplemented: true,
  r2QualitySnapshotProducerImplemented: true,
  r3MarketContextProducerImplemented: true,
  introducesCapabilities: Object.freeze(["marketContextProducer"]),
  closesReadinessNodes: Object.freeze(["S02"]),
  dependsOn: Object.freeze(["R1"]),
  s01Status: "SOURCE_READY",
  s01AcceptedReady: true,
  s02ImplementationStatus: "SOURCE_READY_PENDING_ACCEPTANCE",
  s02AcceptedReady: false,
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
  historicalBackfillExecuted: false,
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  humanDecisionRequired: true,
  automaticTrading: false,
} as const);

type MarketContextInput = Readonly<{
  advisory: SignalAdvisory;
  snapshot: MarketSnapshot;
  capturedAt: string;
}>;

type SourceSeriesManifest = Readonly<{
  symbol: SignalAdvisory["symbol"];
  timeframe: "4h";
  candleCount: number;
  firstOpenTime: number;
  firstCloseTime: number;
  lastOpenTime: number;
  lastCloseTime: number;
  orderedSeriesHash: string;
}>;

type MarketContextSourceManifest = Readonly<{
  provider: string;
  strategyVersion: string;
  symbol: SourceSeriesManifest;
  btc: SourceSeriesManifest;
}>;

export class MarketContextNotEvaluableError extends Error {
  readonly code = "NOT_EVALUABLE" as const;

  constructor(reason: string) {
    super(`MARKET_CONTEXT_NOT_EVALUABLE:${reason}`);
    this.name = "MarketContextNotEvaluableError";
  }
}

function notEvaluable(reason: string): never {
  throw new MarketContextNotEvaluableError(reason);
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function validSymbolRegime(value: unknown): value is SymbolRegime {
  return value === "LONG_ONLY" || value === "SHORT_ONLY" || value === "NO_TRADE";
}

function validBtcRegime(value: unknown): value is BTCRegime {
  return value === "BTC_STRONG_BULL"
    || value === "BTC_NEUTRAL"
    || value === "BTC_STRONG_BEAR";
}

function validCandle(candle: Candle, symbol: SignalAdvisory["symbol"]): boolean {
  return candle.symbol === symbol
    && candle.timeframe === "4h"
    && finite(candle.openTime)
    && finite(candle.closeTime)
    && finite(candle.open)
    && finite(candle.high)
    && finite(candle.low)
    && finite(candle.close)
    && finite(candle.volume)
    && finite(candle.quoteVolume)
    && finite(candle.tradeCount)
    && finite(candle.takerBuyBaseVolume)
    && finite(candle.takerBuyQuoteVolume)
    && candle.closeTime > candle.openTime;
}

function orderedSeriesHash(
  provider: string,
  symbol: SignalAdvisory["symbol"],
  candles: readonly Candle[],
): string {
  return hashCanonical({
    namespace: "R22_MARKET_CONTEXT_SOURCE_SERIES",
    provider,
    symbol,
    timeframe: "4h",
    candles: candles.map((candle) => ({
      openTime: candle.openTime,
      closeTime: candle.closeTime,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      quoteVolume: candle.quoteVolume,
      tradeCount: candle.tradeCount,
      takerBuyBaseVolume: candle.takerBuyBaseVolume,
      takerBuyQuoteVolume: candle.takerBuyQuoteVolume,
    })),
  });
}

function sourceDataset(
  snapshot: MarketSnapshot,
  symbol: SignalAdvisory["symbol"],
  signalTimeMs: number,
): ClosedCandleDataset {
  if (snapshot.status !== "VALID" || !snapshot.serverTime || !snapshot.provider.trim()) {
    return notEvaluable("SNAPSHOT_NOT_VALID");
  }

  const symbolSnapshot = snapshot.symbols[symbol];
  const dataset = symbolSnapshot?.status === "VALID" ? symbolSnapshot.datasets["4h"] : null;
  if (!dataset || dataset.symbol !== symbol || dataset.timeframe !== "4h") {
    return notEvaluable("SOURCE_DATASET_MISSING");
  }
  if (dataset.serverTime !== snapshot.serverTime.serverTime
    || dataset.expectedLatestOpenTime !== dataset.candles.at(-1)?.openTime
    || dataset.candles.length === 0) {
    return notEvaluable("SOURCE_DECISION_TIME_MISMATCH");
  }

  for (let index = 0; index < dataset.candles.length; index += 1) {
    const candle = dataset.candles[index];
    if (!candle || !validCandle(candle, symbol) || candle.closeTime > signalTimeMs) {
      return notEvaluable("SOURCE_CANDLE_INVALID");
    }
    const previous = dataset.candles[index - 1];
    if (previous && (candle.openTime <= previous.openTime || candle.closeTime <= previous.closeTime)) {
      return notEvaluable("SOURCE_SERIES_NOT_STRICTLY_CHRONOLOGICAL");
    }
  }
  return dataset;
}

function manifestFor(
  provider: string,
  symbol: SignalAdvisory["symbol"],
  dataset: ClosedCandleDataset,
): SourceSeriesManifest {
  const first = dataset.candles[0];
  const last = dataset.candles.at(-1);
  if (!first || !last) return notEvaluable("SOURCE_CANDLE_SERIES_EMPTY");
  return Object.freeze({
    symbol,
    timeframe: "4h",
    candleCount: dataset.candles.length,
    firstOpenTime: first.openTime,
    firstCloseTime: first.closeTime,
    lastOpenTime: last.openTime,
    lastCloseTime: last.closeTime,
    orderedSeriesHash: orderedSeriesHash(provider, symbol, dataset.candles),
  });
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

function artifactIdFor(advisory: SignalAdvisory): string {
  return `market-context:${hashCanonical({
    namespace: "R22_MARKET_CONTEXT",
    signalId: advisory.signalId,
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
  })}`;
}

export function buildMarketContextSnapshotCandidate(
  input: MarketContextInput,
): ObservationEvidenceCandidate {
  const { advisory, snapshot, capturedAt } = input;
  if (!validateObservationAdvisoryIdentity(advisoryIdentity(advisory))) {
    return notEvaluable("ADVISORY_IDENTITY_INVALID");
  }
  if (!isCanonicalUtcTimestamp(capturedAt)) {
    return notEvaluable("CAPTURE_TIMESTAMP_INVALID");
  }
  if (!validSymbolRegime(advisory.marketRegime.symbolRegime)
    || !validBtcRegime(advisory.marketRegime.btcRegime)) {
    return notEvaluable("REGIME_ENUM_INVALID");
  }

  const signalTimeMs = Date.parse(advisory.signalTime);
  const symbolDataset = sourceDataset(snapshot, advisory.symbol, signalTimeMs);
  const btcDataset = sourceDataset(snapshot, "BTCUSDT", signalTimeMs);
  const symbolManifest = manifestFor(snapshot.provider, advisory.symbol, symbolDataset);
  const btcManifest = manifestFor(snapshot.provider, "BTCUSDT", btcDataset);
  const informationAsOf = new Date(
    Math.max(symbolManifest.lastCloseTime, btcManifest.lastCloseTime),
  ).toISOString();
  if (Date.parse(informationAsOf) > signalTimeMs || Date.parse(capturedAt) < signalTimeMs) {
    return notEvaluable("PIT_OR_CAPTURE_INVALID");
  }

  const sourceManifest: MarketContextSourceManifest = Object.freeze({
    provider: snapshot.provider,
    strategyVersion: advisory.strategyVersion,
    symbol: symbolManifest,
    btc: btcManifest,
  });
  const sourceRef = `market-context-source:${hashCanonical({
    namespace: "R22_MARKET_CONTEXT_SOURCE",
    signalId: advisory.signalId,
    symbolSeriesHash: symbolManifest.orderedSeriesHash,
    btcSeriesHash: btcManifest.orderedSeriesHash,
  })}`;
  const payload: ObservationJsonValue = {
    symbol: advisory.symbol,
    direction: advisory.direction,
    symbolRegime: advisory.marketRegime.symbolRegime,
    btcRegime: advisory.marketRegime.btcRegime,
    sourceManifest,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
  const identity = advisoryIdentity(advisory);
  const artifactId = artifactIdFor(advisory);
  const contentHash = calculateObservationSnapshotContentHash({
    schemaVersion: R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION,
    artifactType: "MARKET_CONTEXT",
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
  const evidenceId = `market-context-evidence:${hashCanonical({
    namespace: "R22_MARKET_CONTEXT_EVIDENCE",
    artifactId,
    evidenceHash,
  })}`;
  const idempotencyKey = calculateObservationSnapshotIdempotencyKey({
    signalId: advisory.signalId,
    artifactType: "MARKET_CONTEXT",
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
    artifactType: "MARKET_CONTEXT",
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
