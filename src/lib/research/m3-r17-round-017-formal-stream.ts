import { createRound006HistoricalLoader } from "./m3-r6-round-006-data.ts";
import { M3_R6_RESEARCH_RANGE } from "./m3-r6-round-006-protocol.ts";
import { buildHistoricalIndexes, buildStrategyInputFromIndexes, evaluationTimesForPeriod, type HistoricalIndexes } from "../backtest/windows.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { evaluateStrategy } from "../strategy/engine.ts";
import type { StrategyCandidate, StrategyEvaluation } from "../strategy/types.ts";
import {
  M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT,
  R17_DIRECTIONS,
  R17_SYMBOLS,
  type R17Direction,
  type R17EventTimeIdentity,
  type R17Regime,
  type R17Symbol,
} from "./m3-r17-round-017-protocol.ts";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1_000;

export const R17_FORMAL_PREDICATE = "candidate?.formalSignal && candidate.totalScore >= 70" as const;

export type R17FormalStreamAudit = Readonly<{
  duplicateCanonicalIdentityCount: number;
  uniqueSignalTimeCount: number;
  sameSymbolSameDirectionGapLt4hCount: number;
  sameSymbolSameDirectionGapEq4hCount: number;
  oppositeDirectionSameTimestampCount: number;
}>;

export type R17FormalStreamBuild = Readonly<{
  events: readonly R17EventTimeIdentity[];
  evaluationTimelineCount: number;
  evaluationRowCount: number;
  candidateRowCount: number;
  formalCandidateRowCount: number;
  uniqueFormalSignalIdentityCount: number;
  audit: R17FormalStreamAudit;
}>;

export type R17Round006CandleCacheOptions = Readonly<{
  cacheDirectory: string;
}>;

export function isR17BaselineFormalCandidate(
  candidate: StrategyCandidate | null | undefined,
): candidate is StrategyCandidate {
  return candidate?.formalSignal === true && candidate.totalScore >= 70;
}

function canonicalSignalId(evaluationTime: number, candidate: StrategyCandidate): string {
  return `${evaluationTime}|${candidate.symbol}|${candidate.direction}`;
}

function eventFromCandidate(evaluationTime: number, candidate: StrategyCandidate): R17EventTimeIdentity {
  if (candidate.strategyVersion !== "baseline-001") throw new Error("R17 formal stream candidate is not baseline-001.");
  if (!R17_SYMBOLS.includes(candidate.symbol) || !R17_DIRECTIONS.includes(candidate.direction)) throw new Error("R17 formal stream candidate symbol or direction is invalid.");
  return Object.freeze({
    signalId: canonicalSignalId(evaluationTime, candidate),
    symbol: candidate.symbol,
    direction: candidate.direction,
    signalTime: evaluationTime,
    strategyVersion: "baseline-001",
    foldId: null,
    btcRegime: candidate.btcRegime,
  });
}

export function formalEventsFromEvaluations(
  evaluationTime: number,
  evaluations: readonly StrategyEvaluation[],
): readonly R17EventTimeIdentity[] {
  return Object.freeze(evaluations.flatMap((evaluation) => {
    const candidate = evaluation.candidate;
    return isR17BaselineFormalCandidate(candidate) ? [eventFromCandidate(evaluationTime, candidate)] : [];
  }));
}

function eventComparator(left: R17EventTimeIdentity, right: R17EventTimeIdentity): number {
  return left.signalTime - right.signalTime
    || R17_SYMBOLS.indexOf(left.symbol) - R17_SYMBOLS.indexOf(right.symbol)
    || R17_DIRECTIONS.indexOf(left.direction) - R17_DIRECTIONS.indexOf(right.direction)
    || (left.signalId < right.signalId ? -1 : left.signalId > right.signalId ? 1 : 0);
}

export function auditR17FormalStream(events: readonly R17EventTimeIdentity[]): R17FormalStreamAudit {
  const seen = new Set<string>();
  let duplicateCanonicalIdentityCount = 0;
  const byThesis = new Map<string, number[]>();
  const bySymbolTime = new Map<string, Set<R17Direction>>();
  for (const event of events) {
    if (seen.has(event.signalId)) duplicateCanonicalIdentityCount += 1;
    seen.add(event.signalId);
    const thesisKey = `${event.symbol}|${event.direction}`;
    const thesisTimes = byThesis.get(thesisKey) ?? [];
    thesisTimes.push(event.signalTime);
    byThesis.set(thesisKey, thesisTimes);
    const symbolTimeKey = `${event.symbol}|${event.signalTime}`;
    const directions = bySymbolTime.get(symbolTimeKey) ?? new Set<R17Direction>();
    directions.add(event.direction);
    bySymbolTime.set(symbolTimeKey, directions);
  }

  let sameSymbolSameDirectionGapLt4hCount = 0;
  let sameSymbolSameDirectionGapEq4hCount = 0;
  for (const times of byThesis.values()) {
    times.sort((left, right) => left - right);
    for (let index = 1; index < times.length; index += 1) {
      const gap = times[index]! - times[index - 1]!;
      if (gap < FOUR_HOURS_MS) sameSymbolSameDirectionGapLt4hCount += 1;
      if (gap === FOUR_HOURS_MS) sameSymbolSameDirectionGapEq4hCount += 1;
    }
  }

  const oppositeDirectionSameTimestampCount = [...bySymbolTime.values()]
    .filter((directions) => directions.has("LONG") && directions.has("SHORT"))
    .length;
  return Object.freeze({
    duplicateCanonicalIdentityCount,
    uniqueSignalTimeCount: new Set(events.map((event) => event.signalTime)).size,
    sameSymbolSameDirectionGapLt4hCount,
    sameSymbolSameDirectionGapEq4hCount,
    oppositeDirectionSameTimestampCount,
  });
}

export function assertGlobalUniqueR17FormalAdvisories(events: readonly R17EventTimeIdentity[]): void {
  const audit = auditR17FormalStream(events);
  if (audit.duplicateCanonicalIdentityCount > 0) throw new Error(`R17 formal stream contains duplicate canonical advisory identities: ${audit.duplicateCanonicalIdentityCount}.`);
}

export function reconcileR17FormalStreamCount(
  actualCount: number,
  expectedCount = M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT,
): void {
  if (actualCount !== expectedCount) throw new Error(`FORMAL_STREAM_RECONCILIATION_FAILED: expected ${expectedCount} accepted baseline-001 formal advisories, observed ${actualCount}.`);
}

export function assertR17ClassifierGapInvariant(
  audit: R17FormalStreamAudit,
  followUpCount: number,
): void {
  if (audit.sameSymbolSameDirectionGapLt4hCount > 0 && followUpCount === 0) throw new Error("R17 classifier invariant failed: sub-four-hour same-direction gaps produced no FOLLOW_UP observations.");
}

export function buildR17FormalStreamFromIndexes(
  indexes: HistoricalIndexes,
  evaluationTimes?: readonly number[],
): R17FormalStreamBuild {
  const times = evaluationTimes ?? [...new Set([...evaluationTimesForPeriod(indexes, "DEV"), ...evaluationTimesForPeriod(indexes, "OOS")])].sort((left, right) => left - right);
  const events: R17EventTimeIdentity[] = [];
  let evaluationRowCount = 0;
  let candidateRowCount = 0;
  let formalCandidateRowCount = 0;

  for (const evaluationTime of times) {
    const result = evaluateStrategy(buildStrategyInputFromIndexes(indexes, evaluationTime));
    evaluationRowCount += result.evaluations.length;
    candidateRowCount += result.evaluations.filter((evaluation) => evaluation.candidate !== null).length;
    const formalEvents = formalEventsFromEvaluations(evaluationTime, result.evaluations);
    formalCandidateRowCount += formalEvents.length;
    events.push(...formalEvents);
  }

  const ordered = Object.freeze([...events].sort(eventComparator));
  assertGlobalUniqueR17FormalAdvisories(ordered);
  const audit = auditR17FormalStream(ordered);
  reconcileR17FormalStreamCount(ordered.length);
  return Object.freeze({
    events: ordered,
    evaluationTimelineCount: times.length,
    evaluationRowCount,
    candidateRowCount,
    formalCandidateRowCount,
    uniqueFormalSignalIdentityCount: new Set(ordered.map((event) => event.signalId)).size,
    audit,
  });
}

function round006CandleRanges(): Readonly<{
  "1h": Readonly<{ startTime: number; endTime: number }>;
  "4h": Readonly<{ startTime: number; endTime: number }>;
}> {
  const baseEnd = Math.floor(M3_R6_RESEARCH_RANGE.endTime / INTERVAL_MS["1h"]) * INTERVAL_MS["1h"];
  return Object.freeze({
    "1h": Object.freeze({ startTime: M3_R6_RESEARCH_RANGE.startTime - 250 * INTERVAL_MS["1h"], endTime: baseEnd }),
    "4h": Object.freeze({ startTime: M3_R6_RESEARCH_RANGE.startTime - 250 * INTERVAL_MS["4h"], endTime: Math.floor(baseEnd / INTERVAL_MS["4h"]) * INTERVAL_MS["4h"] }),
  });
}

export async function buildR17FormalStreamFromRound006Cache(
  options: R17Round006CandleCacheOptions,
): Promise<R17FormalStreamBuild> {
  const acquisition = createRound006HistoricalLoader({ cacheDirectory: options.cacheDirectory, allowNetworkAcquisition: false });
  const ranges = round006CandleRanges();
  const datasets = Object.fromEntries(await Promise.all(RESEARCH_SYMBOLS.map(async (symbol) => {
    const [oneHour, fourHour] = await Promise.all([
      acquisition.loader.loadCandles({ symbol, timeframe: "1h", range: ranges["1h"], serverTime: M3_R6_RESEARCH_RANGE.endTime + 1 }),
      acquisition.loader.loadCandles({ symbol, timeframe: "4h", range: ranges["4h"], serverTime: M3_R6_RESEARCH_RANGE.endTime + 1 }),
    ]);
    return [symbol, { candles1h: oneHour.candles, candles4h: fourHour.candles }];
  }))) as Record<ResearchSymbol, Readonly<{ candles1h: readonly import("../market-data/types.ts").Candle[]; candles4h: readonly import("../market-data/types.ts").Candle[] }>>;
  return buildR17FormalStreamFromIndexes(buildHistoricalIndexes(datasets));
}

export type { R17Regime, R17Symbol };
