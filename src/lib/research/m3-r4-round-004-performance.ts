import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import {
  calculateAtr14,
  calculateEma20,
  calculateEma50,
  calculateRsi14,
} from "../indicators/index.ts";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { evaluateStrategy } from "../strategy/engine.ts";
import type { StrategyCandidate, StrategyDirection } from "../strategy/types.ts";
import {
  BACKTEST_PERIOD_RANGES,
  BACKTEST_SYMBOL_ORDER,
  type BacktestPeriod,
} from "../backtest/constants.ts";
import {
  buildHistoricalIndexes,
  buildStrategyInputFromIndexes,
  findCandleIndexAtCloseTime,
  getHeldCandlesFromIndex,
  type HistoricalIndexes,
} from "../backtest/windows.ts";
import {
  determineFrozenBacktestExit,
  settleBacktestSignal,
  snapshotFromCandidate,
  type FrozenBacktestExit,
} from "../backtest/settlement.ts";
import {
  discoverIntrabarSettlementRequirement,
  discoverIntrabarSettlementRequirements,
  runBacktest,
} from "../backtest/runner.ts";
import type {
  BacktestData,
  BacktestSignalResult,
  IntrabarSettlementRequirement,
} from "../backtest/types.ts";
import { requiresIntrabarFundingResolution } from "../backtest/funding.ts";
import {
  deduplicateIntrabarSettlementIdentities,
} from "../historical-data/intrabar.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_DEFINITIONS as M3_R4_ROUND_004_DEFINITIONS,
  M3_R4_ROUND_004_INVALIDATING_CATEGORIES,
  M3_R4_ROUND_004_CANDIDATE_IDS,
  M3_R4_ROUND_004_CONTROL_ID,
  M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256 as M3_R4_ROUND_004_SELECTION_GATE_SHA256,
  validateM3R4Round004MachineRecord,
  type M3R4CandidateId,
} from "./selection-gates-round-004.ts";
import {
  M3_R4_ROUND_004_PLAN,
  M3_R4_ROUND_004_PLAN_SHA256,
  validateM3R4Round004Plan,
} from "./m3-r4-round-004-plan.ts";
import {
  M3_R4_ROUND_004_SYMBOL_ORDER,
  computeH14Momentum24hAtSignal,
  evaluateH12Reclaim,
  computeH12RiskGeometry,
  evaluateH14Eligibility,
  rankH14RelativeStrength,
  reuseH14ControlOutcome,
  selectH11QualifiedRetestOrigin,
  type H11QualifiedOriginCandidate,
  type M3R4IndicatorCandle,
} from "./m3-r4-round-004-protocol.ts";
import {
  M3_R4_C_PROTOCOL_BASE_MAIN_SHA,
  M3_R4_C_STANDARD_POLICY,
  Round004HistoricalLoader,
  Round004LoadedStudy,
  appendRound004IntrabarWindows,
  loadRound004IntrabarWindows,
  loadRound004Study,
} from "./m3-r4-round-004-loader.ts";
import {
  buildRound004ExecutionArtifacts,
  normalizeRound004Result,
  type Round004CandidateKey,
  type Round004ExecutionArtifacts,
  type Round004Report,
  type Round004ResearchRecord,
} from "./m3-r4-round-004-evidence.ts";
import {
  planH13Exit,
  settleH13Signal,
  type H13RawResult,
  type H13SettlementInput,
  type H13ExitPlan,
} from "./m3-r4-round-004-settlement.ts";
import type { NormalizedResearchSignal } from "./types.ts";

export const M3_R4_C_EXECUTION_SOURCE_SHA_PLACEHOLDER = "SUPPLIED_AT_APPROVED_EXECUTION" as const;
export const M3_R4_C_RESEARCH_UNIVERSE = Object.freeze({
  startTime: Date.parse("2023-01-01T00:00:00.000Z"),
  endTime: Date.parse("2026-08-15T23:59:59.999Z"),
});
export const M3_R4_C_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R4_ROUND_004_SUMMARY.json",
  "docs/evidence/M3_R4_ROUND_004_AUDIT.json",
  "docs/M3_R4_ROUND_004_RESULTS.md",
] as const);

export type Round004CacheScope = "OFFICIAL_CONTROL" | "H11_ORIGIN_SUPPORT";

export type Round004BaselineCacheEntry = Readonly<{
  candidate: StrategyCandidate;
  signalTime: number;
  evaluationClosedThrough: number;
  period: Exclude<BacktestPeriod, "COMBINED">;
}>;

export type Round004DecisionCandidate = Readonly<{
  candidateId: M3R4CandidateId;
  signalTime: number;
  period: Exclude<BacktestPeriod, "COMBINED">;
  snapshot: import("../backtest/types.ts").BacktestSignalSnapshot;
  signalCandle: import("../market-data/types.ts").Candle;
  heldCandles24: readonly import("../market-data/types.ts").Candle[];
  heldCandles48?: readonly import("../market-data/types.ts").Candle[];
  ema20ByHeldCandle?: readonly (number | null)[];
  rawH13Plan?: H13ExitPlan;
  decisionAudit: Readonly<Record<string, unknown>>;
}>;

export type Round004RequirementDiscovery = Readonly<{
  phase: "PRE_PERFORMANCE";
  requirements: readonly IntrabarSettlementRequirement[];
  diagnostics: readonly string[];
  performanceEconomics: null;
  evidence: null;
}>;

function periodForSignalTime(signalTime: number): Exclude<BacktestPeriod, "COMBINED"> | null {
  if (signalTime >= BACKTEST_PERIOD_RANGES.DEV.startTime && signalTime <= BACKTEST_PERIOD_RANGES.DEV.endTime) return "DEV";
  if (signalTime >= BACKTEST_PERIOD_RANGES.OOS.startTime && signalTime <= BACKTEST_PERIOD_RANGES.OOS.endTime) return "OOS";
  return null;
}

function cacheCompare(left: Round004BaselineCacheEntry, right: Round004BaselineCacheEntry): number {
  return left.signalTime - right.signalTime ||
    BACKTEST_SYMBOL_ORDER.indexOf(left.candidate.symbol) - BACKTEST_SYMBOL_ORDER.indexOf(right.candidate.symbol) ||
    (left.candidate.direction === "LONG" ? 0 : 1) - (right.candidate.direction === "LONG" ? 0 : 1);
}

function uniqueTimes(times: readonly number[]): readonly number[] {
  return Object.freeze([...new Set(times)].sort((left, right) => left - right));
}

export function buildOfficialRound004EvaluationTimes(indexes: HistoricalIndexes): readonly number[] {
  return Object.freeze(indexes.timeline1h.filter((time) => time >= M3_R4_C_RESEARCH_UNIVERSE.startTime && time <= M3_R4_C_RESEARCH_UNIVERSE.endTime));
}

export function buildBaselineFormalCache(input: Readonly<{
  indexes: HistoricalIndexes;
  evaluationTimes?: readonly number[];
  scope?: Round004CacheScope;
}>): readonly Round004BaselineCacheEntry[] {
  const scope = input.scope ?? "OFFICIAL_CONTROL";
  const officialTimes = input.evaluationTimes ?? buildOfficialRound004EvaluationTimes(input.indexes);
  const supportTimes = scope === "H11_ORIGIN_SUPPORT"
    ? uniqueTimes([...officialTimes, ...officialTimes.flatMap((time) => [time - 3_600_000, time - 2 * 3_600_000, time - 3 * 3_600_000, time - 4 * 3_600_000])])
    : uniqueTimes(officialTimes);
  const entries: Round004BaselineCacheEntry[] = [];
  const seen = new Set<string>();
  for (const evaluationTime of supportTimes) {
    if (evaluationTime < 0) continue;
    const period = periodForSignalTime(evaluationTime);
    if (scope === "OFFICIAL_CONTROL" && period === null) continue;
    let inputData;
    try {
      inputData = buildStrategyInputFromIndexes(input.indexes, evaluationTime);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : `Baseline cache data is incomplete at ${evaluationTime}.`);
    }
    const engineResult = evaluateStrategy(inputData);
    for (const evaluation of engineResult.evaluations) {
      const candidate = evaluation.candidate;
      if (!candidate?.formalSignal || !Number.isFinite(candidate.totalScore) || candidate.totalScore < 70) continue;
      const resolvedPeriod = period ?? "DEV";
      if (evaluationTime > M3_R4_C_RESEARCH_UNIVERSE.endTime) throw new Error("A baseline formal signal crossed the frozen research cutoff.");
      const key = `${candidate.symbol}|${candidate.direction}|${evaluationTime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(Object.freeze({ candidate, signalTime: evaluationTime, evaluationClosedThrough: evaluationTime, period: resolvedPeriod }));
    }
  }
  return Object.freeze(entries.sort(cacheCompare));
}

export function buildH11OriginSupportCache(
  indexes: HistoricalIndexes,
  officialTimes = buildOfficialRound004EvaluationTimes(indexes),
): readonly Round004BaselineCacheEntry[] {
  return buildBaselineFormalCache({ indexes, evaluationTimes: officialTimes, scope: "H11_ORIGIN_SUPPORT" });
}

function candleAtCloseTime(indexes: HistoricalIndexes, symbol: ResearchSymbol, closeTime: number): import("../market-data/types.ts").Candle | null {
  const series = indexes.bySymbol[symbol].candles1h;
  const index = findCandleIndexAtCloseTime(series, closeTime);
  return index < 0 ? null : series.candles[index] ?? null;
}

function strategyCandleWithAtr(
  indexes: HistoricalIndexes,
  symbol: ResearchSymbol,
  signalTime: number,
): M3R4IndicatorCandle | null {
  const strategyInput = buildStrategyInputFromIndexes(indexes, signalTime);
  const dataset = strategyInput.datasets[symbol];
  const candle = candleAtCloseTime(indexes, symbol, signalTime);
  if (!dataset || !candle) return null;
  const atr = calculateAtr14(dataset.candles1h).at(-1) ?? null;
  return Object.freeze({
    openTime: candle.openTime,
    closeTime: candle.closeTime,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    atr14: typeof atr === "number" ? atr : undefined,
  });
}

function h11OriginCandidate(
  entry: Round004BaselineCacheEntry,
  currentCandle: M3R4IndicatorCandle,
  indexes: HistoricalIndexes,
): H11QualifiedOriginCandidate | null {
  const series = indexes.bySymbol[entry.candidate.symbol].candles1h;
  const originIndex = findCandleIndexAtCloseTime(series, entry.signalTime);
  const currentIndex = findCandleIndexAtCloseTime(series, currentCandle.closeTime);
  if (originIndex < 3 || currentIndex <= originIndex) return null;
  const candlesBeforeOrigin = series.candles.slice(originIndex - 3, originIndex);
  const candlesFromFirstAfterOrigin = series.candles.slice(originIndex + 1, currentIndex + 1);
  return Object.freeze({
    signalTime: entry.signalTime,
    evaluationClosedThrough: entry.evaluationClosedThrough,
    symbol: entry.candidate.symbol,
    direction: entry.candidate.direction,
    formalSignal: entry.candidate.formalSignal,
    totalScore: entry.candidate.totalScore,
    grade: entry.candidate.grade,
    originStopReference: entry.candidate.stopReference,
    candlesBeforeOrigin,
    candlesFromFirstAfterOrigin,
  });
}

export function evaluateH11Decision(input: Readonly<{
  indexes: HistoricalIndexes;
  currentTime: number;
  symbol: ResearchSymbol;
  direction: StrategyDirection;
  originCache: readonly Round004BaselineCacheEntry[];
}>): Round004DecisionCandidate | null {
  const period = periodForSignalTime(input.currentTime);
  if (!period) return null;
  const currentCandle = strategyCandleWithAtr(input.indexes, input.symbol, input.currentTime);
  const rawSignalCandle = candleAtCloseTime(input.indexes, input.symbol, input.currentTime);
  if (!currentCandle || !rawSignalCandle) throw new Error(`H11 current candle is incomplete at ${input.currentTime}.`);
  const origins = input.originCache
    .filter((entry) => entry.candidate.symbol === input.symbol && entry.candidate.direction === input.direction)
    .map((entry) => h11OriginCandidate(entry, currentCandle, input.indexes))
    .filter((entry): entry is H11QualifiedOriginCandidate => entry !== null);
  const selection = selectH11QualifiedRetestOrigin({ currentCandle, symbol: input.symbol, direction: input.direction, origins });
  if (selection.reason === "FUTURE_DATA_REJECTED") throw new Error("H11 origin support contains future decision data.");
  if (!selection.origin || !selection.riskGeometry) return null;
  const originEntry = input.originCache.find((entry) => entry.signalTime === selection.origin!.signalTime && entry.candidate.symbol === input.symbol && entry.candidate.direction === input.direction);
  if (!originEntry) throw new Error("H11 origin cache provenance is missing.");
  const snapshot = Object.freeze({
    ...originEntry.candidate,
    backtestPolicyVersion: M3_R4_C_STANDARD_POLICY,
    signalTime: input.currentTime,
    entryReference: selection.riskGeometry.entryReference,
    stopReference: selection.riskGeometry.stopReference,
    stopDistance: selection.riskGeometry.stopDistance,
    stopAtr: selection.riskGeometry.stopAtr,
    takeProfitReference: selection.riskGeometry.takeProfitReference,
  });
  return Object.freeze({
    candidateId: "R4-H11-BREAKOUT-RETEST",
    signalTime: input.currentTime,
    period,
    snapshot,
    signalCandle: rawSignalCandle,
    heldCandles24: getHeldCandlesFromIndex(input.indexes.bySymbol[input.symbol].candles1h, input.currentTime),
    decisionAudit: Object.freeze({
      signalTime: input.currentTime,
      originSignalTime: selection.origin.signalTime,
      originAgeBars: selection.originAgeBars,
      symbol: input.symbol,
      direction: input.direction,
      originTotalScore: selection.origin.totalScore,
      originGrade: selection.origin.grade,
      breakoutLevel: selection.breakoutLevel,
      originStopReference: selection.origin.originStopReference,
      currentOpen: currentCandle.open,
      currentHigh: currentCandle.high,
      currentLow: currentCandle.low,
      currentClose: currentCandle.close,
      currentAtr14: currentCandle.atr14 ?? null,
      stopDistance: selection.riskGeometry.stopDistance,
      stopAtr: selection.riskGeometry.stopAtr,
      takeProfitReference: selection.riskGeometry.takeProfitReference,
      originInvalidatedByStop: selection.retest?.originInvalidatedByStop ?? false,
    }),
  });
}

function indicatorsAtCurrent(
  input: ReturnType<typeof buildStrategyInputFromIndexes>,
  symbol: ResearchSymbol,
): Readonly<{ previous: M3R4IndicatorCandle; current: M3R4IndicatorCandle; priorFive: readonly { high: number; low: number }[] }> | null {
  const dataset = input.datasets[symbol];
  if (!dataset || dataset.candles1h.length < 6) return null;
  const closes = dataset.candles1h.map((candle) => candle.close);
  const ema20 = calculateEma20(closes);
  const ema50 = calculateEma50(closes);
  const rsi14 = calculateRsi14(closes);
  const atr14 = calculateAtr14(dataset.candles1h);
  const currentIndex = dataset.candles1h.length - 1;
  const previousIndex = currentIndex - 1;
  const current = dataset.candles1h[currentIndex]!;
  const previous = dataset.candles1h[previousIndex]!;
  const priorFive = dataset.candles1h.slice(currentIndex - 5, currentIndex).map((candle) => ({ high: candle.high, low: candle.low }));
  return Object.freeze({
    previous: Object.freeze({ ...previous, ema20: ema20[previousIndex] ?? undefined, ema50: ema50[previousIndex] ?? undefined }),
    current: Object.freeze({ ...current, ema20: ema20[currentIndex] ?? undefined, rsi14: rsi14[currentIndex] ?? undefined, atr14: atr14[currentIndex] ?? undefined }),
    priorFive: Object.freeze(priorFive),
  });
}

export function evaluateH12Decision(input: Readonly<{
  indexes: HistoricalIndexes;
  currentTime: number;
  symbol: ResearchSymbol;
  direction: StrategyDirection;
}>): Round004DecisionCandidate | null {
  const period = periodForSignalTime(input.currentTime);
  if (!period) return null;
  const strategyInput = buildStrategyInputFromIndexes(input.indexes, input.currentTime);
  const dataset = strategyInput.datasets[input.symbol];
  const indicators = indicatorsAtCurrent(strategyInput, input.symbol);
  const signalCandle = candleAtCloseTime(input.indexes, input.symbol, input.currentTime);
  if (!dataset || !indicators || !signalCandle) throw new Error(`H12 decision data is incomplete at ${input.currentTime}.`);
  const engine = evaluateStrategy(strategyInput);
  const evaluation = engine.evaluations.find((candidate) => candidate.symbol === input.symbol && candidate.direction === input.direction);
  const symbolRegime = evaluation?.symbolRegime ?? null;
  const btcRegime = engine.btcRegime;
  if (!symbolRegime || !btcRegime) throw new Error(`H12 baseline context is incomplete at ${input.currentTime}.`);
  const reclaim = evaluateH12Reclaim({
    signalTime: input.currentTime,
    symbol: input.symbol,
    direction: input.direction,
    symbolRegime,
    btcRegime,
    previous: indicators.previous,
    current: indicators.current,
  });
  if (reclaim.reason === "FAIL_CLOSED_DATA_INCOMPLETE") throw new Error(`H12 indicator data is incomplete at ${input.currentTime}.`);
  if (!reclaim.eligible) return null;
  const risk = computeH12RiskGeometry({ direction: input.direction, currentClose: indicators.current.close, currentAtr14: indicators.current.atr14 ?? Number.NaN, priorFiveCandles: indicators.priorFive });
  if (!risk?.eligible) return null;
  const zeroBreakdown = Object.freeze({ trendStrength: 0, pullbackQuality: 0, breakoutStrength: 0, volumeScore: 0, riskRewardScore: 0 });
  const snapshot = Object.freeze({
    strategyVersion: "baseline-001" as const,
    backtestPolicyVersion: M3_R4_C_STANDARD_POLICY,
    signalTime: input.currentTime,
    symbol: input.symbol,
    direction: input.direction,
    symbolRegime,
    btcRegime,
    entryReference: risk.entryReference,
    stopReference: risk.stopReference,
    takeProfitReference: risk.takeProfitReference,
    stopDistance: risk.stopDistance,
    stopAtr: risk.stopAtr,
    breakdown: zeroBreakdown,
    totalScore: 0,
    grade: null,
  });
  return Object.freeze({
    candidateId: "R4-H12-PULLBACK-RECLAIM",
    signalTime: input.currentTime,
    period,
    snapshot,
    signalCandle,
    heldCandles24: getHeldCandlesFromIndex(input.indexes.bySymbol[input.symbol].candles1h, input.currentTime),
    decisionAudit: Object.freeze({
      signalTime: input.currentTime,
      symbol: input.symbol,
      direction: input.direction,
      symbolRegime,
      btcRegime,
      previousOHLC: Object.freeze({ open: indicators.previous.open, high: indicators.previous.high, low: indicators.previous.low, close: indicators.previous.close }),
      previousEMA20: indicators.previous.ema20 ?? null,
      previousEMA50: indicators.previous.ema50 ?? null,
      currentOHLC: Object.freeze({ open: indicators.current.open, high: indicators.current.high, low: indicators.current.low, close: indicators.current.close }),
      currentEMA20: indicators.current.ema20 ?? null,
      currentRSI14: indicators.current.rsi14 ?? null,
      currentATR14: indicators.current.atr14 ?? null,
      priorFiveStopExtreme: input.direction === "LONG" ? Math.min(...indicators.priorFive.map((candle) => candle.low)) : Math.max(...indicators.priorFive.map((candle) => candle.high)),
      stopReference: risk.stopReference,
      stopDistance: risk.stopDistance,
      stopAtr: risk.stopAtr,
      takeProfitReference: risk.takeProfitReference,
      scoreEligibility: "NOT_APPLICABLE",
    }),
  });
}

export function evaluateH14Decision(input: Readonly<{
  indexes: HistoricalIndexes;
  currentTime: number;
  baseline: Round004BaselineCacheEntry;
  controlResults: readonly BacktestSignalResult[];
}>): Readonly<{ candidate: Round004DecisionCandidate | null; status: "PASS" | "NO_SIGNAL" | "DATA_INCOMPLETE"; reused: BacktestSignalResult | null }> {
  const currentBySymbol = Object.fromEntries(M3_R4_ROUND_004_SYMBOL_ORDER.map((symbol) => {
    const candle = candleAtCloseTime(input.indexes, symbol, input.currentTime);
    const historical = candle ? candleAtCloseTime(input.indexes, symbol, input.currentTime - 24 * 3_600_000) : null;
    return [symbol, candle && historical ? computeH14Momentum24hAtSignal({ signalTime: input.currentTime, currentCandle: candle, historicalCandle: historical }) : { status: "FAIL_CLOSED_DATA_INCOMPLETE", momentum24h: null }];
  })) as Record<ResearchSymbol, { status: "VALID" | "FAIL_CLOSED_DATA_INCOMPLETE"; momentum24h: number | null }>;
  if (Object.values(currentBySymbol).some((result) => result.status !== "VALID" || result.momentum24h === null)) return { candidate: null, status: "DATA_INCOMPLETE", reused: null };
  const ranking = rankH14RelativeStrength(Object.fromEntries(M3_R4_ROUND_004_SYMBOL_ORDER.map((symbol) => [symbol, currentBySymbol[symbol]!.momentum24h!])));
  if (ranking.status !== "VALID") return { candidate: null, status: "DATA_INCOMPLETE", reused: null };
  const rank = ranking.rankBySymbol[input.baseline.candidate.symbol];
  if (!evaluateH14Eligibility({ direction: input.baseline.candidate.direction, rank })) return { candidate: null, status: "NO_SIGNAL", reused: null };
  const reused = reuseH14ControlOutcome({ symbol: input.baseline.candidate.symbol, direction: input.baseline.candidate.direction, signalTime: input.currentTime, controlResults: input.controlResults.map((result) => ({ ...result.snapshot, result })) });
  if (reused.status !== "REUSED" || !reused.outcome || !("result" in reused.outcome)) return { candidate: null, status: "DATA_INCOMPLETE", reused: null };
  const result = reused.outcome.result as BacktestSignalResult;
  const signalCandle = candleAtCloseTime(input.indexes, input.baseline.candidate.symbol, input.currentTime);
  if (!signalCandle) return { candidate: null, status: "DATA_INCOMPLETE", reused: null };
  return {
    candidate: Object.freeze({
      candidateId: "R4-H14-RELATIVE-STRENGTH",
      signalTime: input.currentTime,
      period: input.baseline.period,
      snapshot: result.snapshot,
      signalCandle,
      heldCandles24: [],
      decisionAudit: Object.freeze({
        signalTime: input.currentTime,
        symbol: input.baseline.candidate.symbol,
        direction: input.baseline.candidate.direction,
        fiveSymbolMomentum24hMap: Object.freeze(Object.fromEntries(M3_R4_ROUND_004_SYMBOL_ORDER.map((symbol) => [symbol, currentBySymbol[symbol]!.momentum24h]))),
        rankMap: ranking.rankBySymbol,
        candidateRank: rank,
        controlOutcomeIdentity: `${input.baseline.candidate.symbol}|${input.baseline.candidate.direction}|${input.currentTime}`,
      }),
    }),
    status: "PASS",
    reused: result,
  };
}

function standardSettlementRequirement(candidate: Round004DecisionCandidate, data: BacktestData): IntrabarSettlementRequirement | null {
  const frozenExit: FrozenBacktestExit = determineFrozenBacktestExit(candidate.snapshot, candidate.heldCandles24);
  return discoverIntrabarSettlementRequirement({
    period: candidate.period,
    symbol: candidate.snapshot.symbol,
    entryTime: candidate.heldCandles24[0]!.openTime,
    funding: data.funding[candidate.snapshot.symbol] ?? [],
    frozenExit,
  });
}

function getHeldCandles48(
  indexes: HistoricalIndexes,
  symbol: ResearchSymbol,
  signalTime: number,
): readonly import("../market-data/types.ts").Candle[] {
  const series = indexes.bySymbol[symbol].candles1h;
  const signalIndex = findCandleIndexAtCloseTime(series, signalTime);
  if (signalIndex < 0) throw new Error(`The H13 signal candle is unavailable at ${signalTime}.`);
  const held = series.candles.slice(signalIndex + 1, signalIndex + 49);
  if (held.length !== 48) throw new Error(`Exactly 48 held candles are required at ${signalTime}.`);
  return Object.freeze([...held]);
}

export function discoverRound004IntrabarRequirements(input: Readonly<{
  controlData: BacktestData;
  standardCandidates: readonly Round004DecisionCandidate[];
  h13Candidates: readonly Round004DecisionCandidate[];
  controlRequirements?: readonly IntrabarSettlementRequirement[];
}>): Round004RequirementDiscovery {
  const requirements: IntrabarSettlementRequirement[] = [...(input.controlRequirements ?? discoverIntrabarSettlementRequirements({ period: "COMBINED", data: input.controlData }))];
  const diagnostics: string[] = [];
  for (const candidate of input.standardCandidates) {
    const requirement = standardSettlementRequirement(candidate, input.controlData);
    if (requirement) requirements.push(requirement);
  }
  for (const candidate of input.h13Candidates) {
    const plan = candidate.rawH13Plan;
    if (!plan || plan.exitReason !== "SL") continue;
    if (requiresIntrabarFundingResolution({ funding: input.controlData.funding[candidate.snapshot.symbol] ?? [], entryTime: candidate.heldCandles24[0]!.openTime, exitReason: "SL", exitCandle: plan.exitCandle })) {
      requirements.push({ symbol: candidate.snapshot.symbol, exitCandleOpenTime: plan.exitCandle.openTime, exitCandleCloseTime: plan.exitCandle.closeTime, settlementOnly: candidate.period === "OOS" && plan.exitCandle.openTime > BACKTEST_PERIOD_RANGES.OOS.endTime });
    }
  }
  const deduplicated = deduplicateIntrabarSettlementIdentities(requirements);
  if (deduplicated.conflictingKeys.length > 0) diagnostics.push(...deduplicated.conflictingKeys.map((key) => `DATA_INTEGRITY_CONFLICT:${key}`));
  return Object.freeze({ phase: "PRE_PERFORMANCE", requirements: deduplicated.unique, diagnostics: Object.freeze(diagnostics), performanceEconomics: null, evidence: null });
}

function settleStandardCandidate(candidate: Round004DecisionCandidate, data: BacktestData): BacktestSignalResult {
  return settleBacktestSignal({
    snapshot: candidate.snapshot,
    signalCandle: candidate.signalCandle,
    heldCandles: candidate.heldCandles24,
    funding: data.funding[candidate.snapshot.symbol] ?? [],
    markPriceCandles: data.markPrice?.[candidate.snapshot.symbol],
    markPriceSegments: data.markPriceSegments?.[candidate.snapshot.symbol],
    intrabarSettlementWindows: data.intrabarSettlementWindows,
    serverTime: data.serverTime,
    policy: M3_R4_C_STANDARD_POLICY,
    period: candidate.period,
    periodEndTime: BACKTEST_PERIOD_RANGES[candidate.period].endTime,
  });
}

function buildH13DecisionCandidate(
  baseline: Round004BaselineCacheEntry,
  decisionIndexes: HistoricalIndexes,
  settlementIndexes: HistoricalIndexes,
): Round004DecisionCandidate | null {
  const signalCandle = candleAtCloseTime(decisionIndexes, baseline.candidate.symbol, baseline.signalTime);
  if (!signalCandle) throw new Error(`H13 baseline signal candle is missing at ${baseline.signalTime}.`);
  const heldCandles48 = getHeldCandles48(settlementIndexes, baseline.candidate.symbol, baseline.signalTime);
  const ema20ByHeldCandle = heldCandles48.map((candle) => {
    const series = settlementIndexes.bySymbol[baseline.candidate.symbol].candles1h;
    const index = findCandleIndexAtCloseTime(series, candle.closeTime);
    if (index < 0) return null;
    return calculateEma20(series.candles.slice(0, index + 1).map((item) => item.close)).at(-1) ?? null;
  });
  const plan = planH13Exit({ direction: baseline.candidate.direction, heldCandles: heldCandles48, ema20ByHeldCandle, stopReference: baseline.candidate.stopReference });
  const snapshot = snapshotFromCandidate(baseline.candidate, baseline.signalTime, M3_R4_C_STANDARD_POLICY);
  return Object.freeze({
    candidateId: "R4-H13-ADAPTIVE-TREND-EXIT",
    signalTime: baseline.signalTime,
    period: baseline.period,
    snapshot,
    signalCandle,
    heldCandles24: heldCandles48.slice(0, 24),
    heldCandles48,
    ema20ByHeldCandle,
    ...(plan ? { rawH13Plan: plan } : {}),
    decisionAudit: Object.freeze({ baselineCandidateSnapshot: snapshot }),
  });
}

function toH13Input(candidate: Round004DecisionCandidate, data: BacktestData): H13SettlementInput {
  if (!candidate.heldCandles48 || !candidate.ema20ByHeldCandle) throw new Error("H13 settlement input is incomplete.");
  return {
    snapshot: candidate.snapshot,
    signalCandle: candidate.signalCandle,
    heldCandles: candidate.heldCandles48,
    ema20ByHeldCandle: candidate.ema20ByHeldCandle,
    funding: data.funding[candidate.snapshot.symbol] ?? [],
    markPriceCandles: data.markPrice?.[candidate.snapshot.symbol],
    markPriceSegments: data.markPriceSegments?.[candidate.snapshot.symbol],
    intrabarSettlementWindows: data.intrabarSettlementWindows,
    serverTime: data.serverTime,
    period: candidate.period,
    periodEndTime: BACKTEST_PERIOD_RANGES[candidate.period].endTime,
  };
}

function rawResultRecord(candidateId: Round004CandidateKey, result: BacktestSignalResult | H13RawResult, decisionAudit?: Readonly<Record<string, unknown>>, outcomeAudit?: Readonly<Record<string, unknown>>): Round004ResearchRecord {
  return normalizeRound004Result(candidateId, result, { decision: decisionAudit, outcome: outcomeAudit });
}

export function verifyRound004ControlParity(
  officialCache: readonly Round004BaselineCacheEntry[],
  controlResults: readonly BacktestSignalResult[],
): void {
  const expected = new Set(officialCache.map((entry) => `${entry.candidate.symbol}|${entry.candidate.direction}|${entry.signalTime}`));
  const actual = new Set(controlResults.filter((result) => result.snapshot.totalScore >= 70).map((result) => `${result.snapshot.symbol}|${result.snapshot.direction}|${result.snapshot.signalTime}`));
  if (expected.size !== actual.size || [...expected].some((identity) => !actual.has(identity))) throw new Error("ROUND_004_CONTROL_PARITY_REVIEW_REQUIRED");
}

export async function executeRound004AuthoritativeDetailed(input: Readonly<{
  loader?: Round004HistoricalLoader;
  executionSourceSha: string;
}>): Promise<Round004ExecutionArtifacts> {
  validateM3R4Round004MachineRecord();
  validateM3R4Round004Plan();
  const study: Round004LoadedStudy = await loadRound004Study(input.loader);
  const decisionIndexes = buildHistoricalIndexes(study.standardData.datasets);
  const settlementIndexes = buildHistoricalIndexes(study.combinedData.datasets);
  const officialTimes = buildOfficialRound004EvaluationTimes(decisionIndexes);
  const officialCache = buildBaselineFormalCache({ indexes: decisionIndexes, evaluationTimes: officialTimes });
  const originCache = buildH11OriginSupportCache(decisionIndexes, officialTimes);
  const controlRequirements = discoverIntrabarSettlementRequirements({ period: "COMBINED", data: study.standardData });
  const h11Candidates: Round004DecisionCandidate[] = [];
  const h12Candidates: Round004DecisionCandidate[] = [];
  for (const time of officialTimes) {
    for (const symbol of RESEARCH_SYMBOLS) {
      for (const direction of ["LONG", "SHORT"] as const) {
        const h11 = evaluateH11Decision({ indexes: decisionIndexes, currentTime: time, symbol, direction, originCache });
        if (h11) h11Candidates.push(h11);
        const h12 = evaluateH12Decision({ indexes: decisionIndexes, currentTime: time, symbol, direction });
        if (h12) h12Candidates.push(h12);
      }
    }
  }
  const h13Candidates = officialCache.map((entry) => buildH13DecisionCandidate(entry, decisionIndexes, settlementIndexes)).filter((candidate): candidate is Round004DecisionCandidate => candidate !== null);
  const requirementDiscovery = discoverRound004IntrabarRequirements({ controlData: study.standardData, standardCandidates: [...h11Candidates, ...h12Candidates], h13Candidates, controlRequirements });
  if (requirementDiscovery.diagnostics.length > 0) throw new Error(requirementDiscovery.diagnostics.join("; "));
  const windows = await loadRound004IntrabarWindows(input.loader ?? new (await import("../historical-data/binance/loader.ts")).BinanceHistoricalDataLoader(), requirementDiscovery.requirements, study.standard.serverTime);
  const finalStudy = appendRound004IntrabarWindows(study, windows);
  const controlReport = runBacktest({ period: "COMBINED", policy: M3_R4_C_STANDARD_POLICY, data: finalStudy.combinedData });
  verifyRound004ControlParity(officialCache, controlReport.signalResults);
  const controlRecords = controlReport.signalResults.map((result) => rawResultRecord("CONTROL", result));
  const records: Round004ResearchRecord[] = [...controlRecords];
  for (const candidate of h11Candidates) records.push(rawResultRecord(candidate.candidateId, settleStandardCandidate(candidate, finalStudy.combinedData), candidate.decisionAudit));
  for (const candidate of h12Candidates) records.push(rawResultRecord(candidate.candidateId, settleStandardCandidate(candidate, finalStudy.combinedData), candidate.decisionAudit));
  for (const candidate of h13Candidates) {
    const result = settleH13Signal(toH13Input(candidate, finalStudy.combinedData));
    records.push(rawResultRecord(candidate.candidateId, result, candidate.decisionAudit, result.settlementAudit));
  }
  const controlOutcomeResults = controlReport.signalResults;
  for (const baseline of officialCache) {
    const h14 = evaluateH14Decision({ indexes: decisionIndexes, currentTime: baseline.signalTime, baseline, controlResults: controlOutcomeResults });
    if (h14.candidate && h14.reused) records.push(rawResultRecord(h14.candidate.candidateId, h14.reused, h14.candidate.decisionAudit));
  }
  return buildRound004ExecutionArtifacts({
    protocolBaseMainSha: M3_R4_C_PROTOCOL_BASE_MAIN_SHA,
    executionSourceSha: input.executionSourceSha,
    selectionGateSha256: M3_R4_ROUND_004_SELECTION_GATE_SHA256,
    experimentPlanSha256: M3_R4_ROUND_004_PLAN_SHA256,
    studyServerTime: study.standard.serverTime,
    researchUniverse: M3_R4_C_RESEARCH_UNIVERSE,
    records,
  });
}

export async function executeRound004Authoritative(input: Readonly<{
  loader?: Round004HistoricalLoader;
  executionSourceSha: string;
}>): Promise<Round004Report> {
  return (await executeRound004AuthoritativeDetailed(input)).report;
}

export type Round004ExecutionPreflight = Readonly<{
  confirmAuthoritativeRun: boolean;
  sourceSha: string;
  round: string;
  gateSha: string;
  planSha: string;
  headSha: string;
  cleanWorktree: boolean;
  existingOutputArtifacts: readonly string[];
  gateValidatorPass: boolean;
  planValidatorPass: boolean;
}>;

export function assertRound004ExecutionPreflight(input: Round004ExecutionPreflight): void {
  if (!input.confirmAuthoritativeRun) throw new Error("--confirm-authoritative-run is required before any network access.");
  if (!/^[0-9a-f]{40}$/u.test(input.sourceSha) || input.sourceSha !== input.headSha) throw new Error("Round-004 execution source SHA must exactly match HEAD.");
  if (input.round !== M3_R4_ROUND_004_RESEARCH_ROUND_ID) throw new Error("Round-004 researchRoundId mismatch.");
  if (input.gateSha !== M3_R4_ROUND_004_SELECTION_GATE_SHA256) throw new Error("Round-004 Gate SHA mismatch.");
  if (input.planSha !== M3_R4_ROUND_004_PLAN_SHA256) throw new Error("Round-004 Plan SHA mismatch.");
  if (!input.cleanWorktree) throw new Error("Round-004 authoritative execution requires a clean git worktree.");
  if ((input.existingOutputArtifacts ?? []).length > 0) throw new Error("Round-004 authoritative output already exists; refusing overwrite.");
  if (input.gateValidatorPass !== true || input.planValidatorPass !== true) throw new Error("Round-004 frozen validator failed.");
}

export function readRound004GitState(): Readonly<{ headSha: string; cleanWorktree: boolean }> {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  return Object.freeze({ headSha, cleanWorktree: status.length === 0 });
}

export function existingRound004OutputArtifacts(): readonly string[] {
  return Object.freeze(M3_R4_C_OUTPUT_PATHS.filter((path) => existsSync(path)));
}

export function assertRound004FrozenArchitecture(): void {
  if (M3_R4_ROUND_004_DEFINITIONS.performanceLock !== "FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED" || M3_R4_ROUND_004_INVALIDATING_CATEGORIES.length !== 23) {
    throw new Error("Round-004 frozen machine protocol is inconsistent.");
  }
  if (M3_R4_ROUND_004_CANDIDATE_IDS.length !== 4 || M3_R4_ROUND_004_CONTROL_ID !== "R4-CONTROL-BASELINE-001") throw new Error("Round-004 candidate registry is inconsistent.");
  if (M3_R4_ROUND_004_PLAN.status.baseline002 !== "NOT_FROZEN" || M3_R4_ROUND_004_PLAN.status.m4 !== "NOT_STARTED") throw new Error("Round-004 status boundary is inconsistent.");
}

export function h13UsesSettlementOnlyExtension(candidate: Round004DecisionCandidate): boolean {
  return candidate.candidateId === "R4-H13-ADAPTIVE-TREND-EXIT" && Boolean(candidate.heldCandles48);
}

export function candidateRecordIdentity(record: Round004ResearchRecord): string {
  const signal: NormalizedResearchSignal = record.signal;
  return `${signal.symbol}|${signal.direction}|${signal.signalTime}`;
}

export { M3_R4_C_PROTOCOL_BASE_MAIN_SHA as protocolBaseMainSha };
