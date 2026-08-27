import type { BacktestData, BacktestSignalResult } from "../backtest/types.ts";
import { calculateEma20, calculateEma50 } from "../indicators/ema.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import {
  M3_R6_ROUND_006_CANDIDATE_IDS,
  R6_HORIZON_HOURS,
  type R6CandidateId,
  type R6Direction,
} from "./m3-r6-round-006-protocol.ts";

export class R6SelectorError extends Error {
  public readonly name = "R6SelectorError";
}

function symbolIndex(symbol: ResearchSymbol): number {
  return RESEARCH_SYMBOLS.indexOf(symbol);
}

function directionIndex(direction: R6Direction): number {
  return direction === "LONG" ? 0 : 1;
}

export function round006ResultIdentity(result: Pick<BacktestSignalResult, "snapshot">): string {
  return `${result.snapshot.symbol}|${result.snapshot.direction}|${result.snapshot.signalTime}`;
}

export function compareRound006Results(left: BacktestSignalResult, right: BacktestSignalResult): number {
  return left.snapshot.signalTime - right.snapshot.signalTime
    || symbolIndex(left.snapshot.symbol) - symbolIndex(right.snapshot.symbol)
    || directionIndex(left.snapshot.direction) - directionIndex(right.snapshot.direction);
}

export function canonicalizeRound006Results(
  results: readonly BacktestSignalResult[],
): readonly BacktestSignalResult[] {
  const identities = new Set<string>();
  for (const result of results) {
    const identity = round006ResultIdentity(result);
    if (identities.has(identity)) throw new R6SelectorError(`Duplicate baseline formal identity: ${identity}.`);
    identities.add(identity);
  }
  return Object.freeze([...results].sort(compareRound006Results));
}

function groupedBySignalTime(results: readonly BacktestSignalResult[]): readonly BacktestSignalResult[][] {
  const groups = new Map<number, BacktestSignalResult[]>();
  for (const result of results) {
    const group = groups.get(result.snapshot.signalTime) ?? [];
    group.push(result);
    groups.set(result.snapshot.signalTime, group);
  }
  return Object.freeze([...groups.values()]);
}

function selectTopNByScore(results: readonly BacktestSignalResult[], topN: number): readonly BacktestSignalResult[] {
  const selected = groupedBySignalTime(results).flatMap((group) => [...group]
    .sort((left, right) => right.snapshot.totalScore - left.snapshot.totalScore || compareRound006Results(left, right))
    .slice(0, topN));
  return Object.freeze(selected.sort(compareRound006Results));
}

export function selectRound006Cooldown(
  results: readonly BacktestSignalResult[],
  cooldownHours: number,
): readonly BacktestSignalResult[] {
  if (!Number.isSafeInteger(cooldownHours) || cooldownHours <= 0) {
    throw new R6SelectorError("Cooldown must be a positive safe integer number of hours.");
  }
  const lastAccepted = new Map<string, number>();
  const retained: BacktestSignalResult[] = [];
  for (const result of canonicalizeRound006Results(results)) {
    const key = `${result.snapshot.symbol}|${result.snapshot.direction}`;
    const previous = lastAccepted.get(key);
    if (previous === undefined || result.snapshot.signalTime - previous > cooldownHours * INTERVAL_MS["1h"]) {
      retained.push(result);
      lastAccepted.set(key, result.snapshot.signalTime);
    }
  }
  return Object.freeze(retained);
}

export function selectRound006TopNByScore(
  results: readonly BacktestSignalResult[],
  topN: number,
): readonly BacktestSignalResult[] {
  if (!Number.isSafeInteger(topN) || topN <= 0) throw new R6SelectorError("TOP-N must be a positive safe integer.");
  return selectTopNByScore(canonicalizeRound006Results(results), topN);
}

function closedCandleIndex(candles: readonly Candle[], signalTime: number): number {
  return candles.findIndex((candle) => candle.closeTime === signalTime);
}

function validClose(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function returnAtHorizon(
  candles: readonly Candle[],
  signalTime: number,
  horizonHours: number,
): number | null {
  const currentIndex = closedCandleIndex(candles, signalTime);
  const priorIndex = currentIndex - horizonHours;
  if (currentIndex < 0 || priorIndex < 0) return null;
  const current = candles[currentIndex];
  const prior = candles[priorIndex];
  if (!current || !prior || current.openTime - prior.openTime !== horizonHours * INTERVAL_MS["1h"]) return null;
  if (!validClose(current.close) || !validClose(prior.close)) return null;
  const value = current.close / prior.close - 1;
  return Number.isFinite(value) ? value : null;
}

export function directionAdjustedRelativeStrength(
  result: Pick<BacktestSignalResult, "snapshot">,
  data: BacktestData,
): number | null {
  const signalTime = result.snapshot.signalTime;
  const symbol = result.snapshot.symbol;
  const symbolCandles = data.datasets[symbol]?.candles1h ?? [];
  const btcCandles = data.datasets.BTCUSDT?.candles1h ?? [];
  const components: number[] = [];
  for (const horizonHours of R6_HORIZON_HOURS) {
    const symbolReturn = returnAtHorizon(symbolCandles, signalTime, horizonHours);
    const btcReturn = returnAtHorizon(btcCandles, signalTime, horizonHours);
    if (symbolReturn === null || btcReturn === null) return null;
    components.push(result.snapshot.direction === "LONG"
      ? symbolReturn - btcReturn
      : btcReturn - symbolReturn);
  }
  if (components.length !== R6_HORIZON_HOURS.length) return null;
  const combined = components.reduce((sum, value) => sum + value, 0) / components.length;
  return Number.isFinite(combined) ? combined : null;
}

export function selectRound006TopNByRelativeStrength(
  results: readonly BacktestSignalResult[],
  data: BacktestData,
  topN: number,
): readonly BacktestSignalResult[] {
  if (!Number.isSafeInteger(topN) || topN <= 0) throw new R6SelectorError("Relative-strength TOP-N must be positive.");
  const selected = groupedBySignalTime(canonicalizeRound006Results(results)).flatMap((group) => {
    const ranked = group
      .map((result) => ({ result, score: directionAdjustedRelativeStrength(result, data) }))
      .filter((item): item is { result: BacktestSignalResult; score: number } => item.score !== null)
      .sort((left, right) => right.score - left.score
        || right.result.snapshot.totalScore - left.result.snapshot.totalScore
        || compareRound006Results(left.result, right.result));
    return ranked.slice(0, topN).map((item) => item.result);
  });
  return Object.freeze(selected.sort(compareRound006Results));
}

function emaAt(values: readonly (number | null)[], index: number): number | null {
  const value = values[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function passesRound006TrendFreshness(
  result: Pick<BacktestSignalResult, "snapshot">,
  data: BacktestData,
): boolean {
  const candles = data.datasets[result.snapshot.symbol]?.candles1h ?? [];
  const index = closedCandleIndex(candles, result.snapshot.signalTime);
  if (index < 3) return false;
  // Slice through the decision candle so no indicator value can depend on a future candle.
  const closes = candles.slice(0, index + 1).map((candle) => candle.close);
  const fast = calculateEma20(closes);
  const slow = calculateEma50(closes);
  const currentFast = emaAt(fast, index);
  const currentSlow = emaAt(slow, index);
  const priorFast = emaAt(fast, index - 3);
  if (currentFast === null || currentSlow === null || priorFast === null) return false;
  const slope = currentFast - priorFast;
  return result.snapshot.direction === "LONG"
    ? currentFast > currentSlow && slope > 0
    : currentFast < currentSlow && slope < 0;
}

export function passesRound006BreakoutQuality(
  result: Pick<BacktestSignalResult, "snapshot">,
  requirePullback: boolean,
): boolean {
  // breakoutStrength 17 is the existing frozen scoring tier for breakoutDistance >= 0.25 ATR.
  return result.snapshot.breakdown.breakoutStrength >= 17
    && (!requirePullback || result.snapshot.breakdown.pullbackQuality >= 18);
}

function filterTrendFreshness(results: readonly BacktestSignalResult[], data: BacktestData): readonly BacktestSignalResult[] {
  return Object.freeze(results.filter((result) => passesRound006TrendFreshness(result, data)));
}

function filterBreakoutQuality(results: readonly BacktestSignalResult[], requirePullback: boolean): readonly BacktestSignalResult[] {
  return Object.freeze(results.filter((result) => passesRound006BreakoutQuality(result, requirePullback)));
}

function candidateParameters(candidateId: R6CandidateId): { cooldownHours?: number; topN?: number } {
  if (candidateId === "R6-A1-COOLDOWN-12H") return { cooldownHours: 12 };
  if (candidateId === "R6-A2-COOLDOWN-24H") return { cooldownHours: 24 };
  if (candidateId === "R6-A3-COOLDOWN-48H") return { cooldownHours: 48 };
  if (candidateId === "R6-B1-TOP1-SCORE") return { topN: 1 };
  if (candidateId === "R6-B2-TOP2-SCORE") return { topN: 2 };
  if (candidateId === "R6-B3-TOP1-RELATIVE-STRENGTH") return { topN: 1 };
  if (candidateId === "R6-B4-TOP2-RELATIVE-STRENGTH") return { topN: 2 };
  if (candidateId === "R6-C2-FRESHNESS-TOP1-SCORE") return { topN: 1 };
  if (candidateId === "R6-D3-PULLBACK-BREAKOUT-TOP1") return { topN: 1 };
  return {};
}

/**
 * Applies one frozen Round-006 filter/rank to the already-settled CONTROL
 * formal results. Candidate economics therefore remain exactly bt-policy-003.
 */
export function selectRound006CandidateResults(input: Readonly<{
  candidateId: R6CandidateId;
  controlResults: readonly BacktestSignalResult[];
  data: BacktestData;
}>): readonly BacktestSignalResult[] {
  if (!M3_R6_ROUND_006_CANDIDATE_IDS.includes(input.candidateId)) {
    throw new R6SelectorError(`Unknown Round-006 candidate: ${input.candidateId}.`);
  }
  const results = canonicalizeRound006Results(input.controlResults);
  const parameters = candidateParameters(input.candidateId);
  switch (input.candidateId) {
    case "R6-A1-COOLDOWN-12H":
    case "R6-A2-COOLDOWN-24H":
    case "R6-A3-COOLDOWN-48H":
      return selectRound006Cooldown(results, parameters.cooldownHours!);
    case "R6-B1-TOP1-SCORE":
    case "R6-B2-TOP2-SCORE":
      return selectRound006TopNByScore(results, parameters.topN!);
    case "R6-B3-TOP1-RELATIVE-STRENGTH":
    case "R6-B4-TOP2-RELATIVE-STRENGTH":
      return selectRound006TopNByRelativeStrength(results, input.data, parameters.topN!);
    case "R6-C1-TREND-FRESHNESS":
      return filterTrendFreshness(results, input.data);
    case "R6-C2-FRESHNESS-TOP1-SCORE":
      return selectRound006TopNByScore(filterTrendFreshness(results, input.data), 1);
    case "R6-D1-BREAKOUT-QUALITY":
      return filterBreakoutQuality(results, false);
    case "R6-D2-PULLBACK-BREAKOUT-QUALITY":
      return filterBreakoutQuality(results, true);
    case "R6-D3-PULLBACK-BREAKOUT-TOP1":
      return selectRound006TopNByScore(filterBreakoutQuality(results, true), 1);
  }
}
