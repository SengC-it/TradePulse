import { createHash } from "node:crypto";

import type { SignalAdvisory } from "../signal-advisory/types.ts";
import { RESEARCH_SYMBOLS } from "../config/constants.ts";
import { canonicalJson } from "../observation-evidence/canonical.ts";
import {
  findForbiddenObservationEconomicField,
  isCanonicalUtcTimestamp,
} from "../observation-evidence/validator.ts";
import {
  HISTORICAL_REVIEW_CONTEXT_REGISTRY_TABLE,
  R22_HISTORICAL_CONTEXT_APPROVAL_REF,
  R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION,
  type HistoricalIdentityFeatureSnapshot,
  type HistoricalReviewContext,
  type HistoricalReviewContextDraft,
  type HistoricalReviewContextPublication,
} from "./types.ts";

export { HISTORICAL_REVIEW_CONTEXT_REGISTRY_TABLE };

const HISTORICAL_IDENTITY_FEATURE_FIELDS = [
  "signalId",
  "symbol",
  "direction",
  "signalTime",
  "strategyId",
  "strategyVersion",
] as const;

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function featureSnapshotFor(advisory: SignalAdvisory): HistoricalIdentityFeatureSnapshot {
  return Object.freeze({
    signalId: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    signalTime: advisory.signalTime,
    strategyId: advisory.strategyId,
    strategyVersion: advisory.strategyVersion,
  });
}

export function historicalContextPreprocessingHash(): string {
  return hashCanonical({
    namespace: "R22_HISTORICAL_IDENTITY_PREPROCESSOR",
    featureSnapshotVersion: R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION,
    fields: HISTORICAL_IDENTITY_FEATURE_FIELDS,
  });
}

export function historicalContextId(input: Readonly<{
  sourceSignalId: string;
  featureSnapshotVersion: string;
  preprocessingHash: string;
}>): string {
  return `historical-context:${hashCanonical({
    namespace: "R22_HISTORICAL_CONTEXT",
    sourceSignalId: input.sourceSignalId,
    featureSnapshotVersion: input.featureSnapshotVersion,
    preprocessingHash: input.preprocessingHash,
  })}`;
}

export function historicalReviewContextDraftFor(input: Readonly<{
  advisory: SignalAdvisory;
  sourceIds: readonly string[];
}>): HistoricalReviewContextDraft {
  const featureSnapshot = featureSnapshotFor(input.advisory);
  const preprocessingHash = historicalContextPreprocessingHash();
  return Object.freeze({
    contextId: historicalContextId({
      sourceSignalId: input.advisory.signalId,
      featureSnapshotVersion: R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION,
      preprocessingHash,
    }),
    sourceSignalId: input.advisory.signalId,
    symbol: input.advisory.symbol,
    timeframe: "1h",
    sourceEventTime: input.advisory.signalTime,
    featureSnapshotVersion: R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION,
    preprocessingHash,
    sourceIds: [...input.sourceIds],
    featureSnapshot,
    approvalRef: R22_HISTORICAL_CONTEXT_APPROVAL_REF,
  });
}

export function materializeHistoricalReviewContext(input: Readonly<{
  advisory: SignalAdvisory;
  sourceIds: readonly string[];
  availableAt: string;
}>): HistoricalReviewContext {
  return Object.freeze({
    ...historicalReviewContextDraftFor(input),
    availableAt: input.availableAt,
  });
}

export function historicalContextPublicationFor(
  advisory: SignalAdvisory,
): HistoricalReviewContextPublication {
  return Object.freeze({
    advisory,
    sourceIds: [`tp_signal_advisories:${advisory.signalId}`],
  });
}

export function validateHistoricalReviewContext(
  context: HistoricalReviewContext,
): boolean {
  if (context.timeframe !== "1h"
    || context.featureSnapshotVersion !== R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION
    || context.approvalRef !== R22_HISTORICAL_CONTEXT_APPROVAL_REF
    || !isCanonicalUtcTimestamp(context.sourceEventTime)
    || !isCanonicalUtcTimestamp(context.availableAt)
    || Date.parse(context.sourceEventTime) > Date.parse(context.availableAt)
    || context.sourceIds.length === 0
    || context.sourceIds.some((sourceId) => typeof sourceId !== "string" || sourceId.trim().length === 0)) {
    return false;
  }
  const feature = context.featureSnapshot;
  if (typeof feature !== "object"
    || feature === null
    || Object.keys(feature).sort().join("\u0000")
      !== [...HISTORICAL_IDENTITY_FEATURE_FIELDS].sort().join("\u0000")
    || findForbiddenObservationEconomicField(feature) !== null
    || !RESEARCH_SYMBOLS.includes(context.symbol)
    || (feature.direction !== "LONG" && feature.direction !== "SHORT")
    || feature.signalId !== context.sourceSignalId
    || feature.symbol !== context.symbol
    || feature.signalTime !== context.sourceEventTime
    || !isCanonicalUtcTimestamp(feature.signalTime)
    || feature.strategyId.trim().length === 0
    || feature.strategyVersion.trim().length === 0) {
    return false;
  }
  const preprocessingHash = historicalContextPreprocessingHash();
  return context.preprocessingHash === preprocessingHash
    && context.contextId === historicalContextId({
      sourceSignalId: context.sourceSignalId,
      featureSnapshotVersion: context.featureSnapshotVersion,
      preprocessingHash,
    });
}
