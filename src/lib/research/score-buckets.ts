import type { NormalizedResearchSignal, ScoreBucketDefinition, ScoreBucketDiagnostics, ScoreBucketReport, ScoreMonotonicityStatus } from "./types.ts";
import { calculateResearchDiagnostics, validateAndCanonicalizeResearchRecords } from "./diagnostics.ts";
import { deepFreeze, requireFiniteNumber } from "./utils.ts";

export function validateScoreBucketDefinitions(
  definitions: readonly ScoreBucketDefinition[],
): readonly ScoreBucketDefinition[] {
  const ids = new Set<string>();
  const ordered = [...definitions].map((definition) => {
    if (definition.id.trim().length === 0) throw new Error("Score bucket ID must be non-empty.");
    if (ids.has(definition.id)) throw new Error(`Duplicate score bucket ID: ${definition.id}.`);
    ids.add(definition.id);
    requireFiniteNumber(definition.minInclusive, `Score bucket ${definition.id} minInclusive`);
    if (definition.maxExclusive !== null) {
      requireFiniteNumber(definition.maxExclusive, `Score bucket ${definition.id} maxExclusive`);
      if (definition.maxExclusive <= definition.minInclusive) {
        throw new Error(`Score bucket ${definition.id} must have maxExclusive greater than minInclusive.`);
      }
    }
    return Object.freeze({
      id: definition.id,
      minInclusive: definition.minInclusive,
      maxExclusive: definition.maxExclusive,
    });
  }).sort((left, right) => left.minInclusive - right.minInclusive || left.id.localeCompare(right.id));
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index]!;
    if (current.maxExclusive === null && index !== ordered.length - 1) {
      throw new Error("An open-ended score bucket must be the final ordered bucket.");
    }
    const previous = ordered[index - 1];
    if (previous?.maxExclusive !== null && previous !== undefined && current.minInclusive < previous.maxExclusive) {
      throw new Error(`Overlapping score buckets: ${previous.id} and ${current.id}.`);
    }
  }
  return Object.freeze(ordered);
}

export function assignScoreBucket(
  score: number,
  definitions: readonly ScoreBucketDefinition[],
): string | "UNASSIGNED" {
  requireFiniteNumber(score, "Score bucket score");
  const ordered = validateScoreBucketDefinitions(definitions);
  return ordered.find((bucket) => score >= bucket.minInclusive && (bucket.maxExclusive === null || score < bucket.maxExclusive))?.id ?? "UNASSIGNED";
}

function bucketMetrics(records: readonly NormalizedResearchSignal[], bucket: ScoreBucketDefinition): ScoreBucketDiagnostics {
  const diagnostics = calculateResearchDiagnostics({ records, range: {
    startTime: Math.min(...records.map((record) => record.signalTime), 0),
    endTime: Math.max(...records.map((record) => record.signalTime), 0),
  } });
  return deepFreeze({
    bucket,
    formalSignals: diagnostics.formalSignals,
    executedTrades: diagnostics.executedTrades,
    grossR: diagnostics.grossR,
    feeR: diagnostics.feeR,
    fundingR: diagnostics.fundingR,
    netR: diagnostics.netR,
    expectancyR: diagnostics.expectancyR,
    profitFactor: diagnostics.profitFactor,
    profitFactorStatus: diagnostics.profitFactorStatus,
    winRate: diagnostics.winRate,
    feeBurdenRatio: diagnostics.feeBurdenRatio,
  });
}

export function assessScoreMonotonicity(buckets: readonly ScoreBucketDiagnostics[]): ScoreMonotonicityStatus {
  const values = buckets.map((bucket) => bucket.expectancyR).filter((value): value is number => value !== null);
  if (values.length < 2) return "INSUFFICIENT_DATA";
  const nonDecreasing = values.every((value, index) => index === 0 || value >= values[index - 1]!);
  const nonIncreasing = values.every((value, index) => index === 0 || value <= values[index - 1]!);
  if (nonDecreasing) return "NON_DECREASING";
  if (nonIncreasing) return "NON_INCREASING";
  return "MIXED";
}

export function calculateScoreBucketReport(input: Readonly<{
  records: readonly NormalizedResearchSignal[];
  buckets: readonly ScoreBucketDefinition[];
}>): ScoreBucketReport {
  const records = validateAndCanonicalizeResearchRecords(input.records);
  const buckets = validateScoreBucketDefinitions(input.buckets);
  const grouped = new Map<string, NormalizedResearchSignal[]>();
  let unassignedScoreCount = 0;
  for (const record of records) {
    const bucketId = assignScoreBucket(record.totalScore, buckets);
    if (bucketId === "UNASSIGNED") {
      unassignedScoreCount += 1;
      continue;
    }
    const group = grouped.get(bucketId) ?? [];
    group.push(record);
    grouped.set(bucketId, group);
  }
  const bucketDiagnostics = buckets.map((bucket) => bucketMetrics(grouped.get(bucket.id) ?? [], bucket));
  return deepFreeze({
    buckets: Object.freeze(bucketDiagnostics),
    unassignedScoreCount,
    monotonicity: assessScoreMonotonicity(bucketDiagnostics),
  });
}
