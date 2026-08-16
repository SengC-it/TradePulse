import {
  BACKTEST_BTC_REGIME_ORDER,
  BACKTEST_DIRECTION_ORDER,
  BACKTEST_GRADE_ORDER,
  BACKTEST_SYMBOL_ORDER,
} from "./constants.ts";
import type {
  BacktestBreakdown,
  BacktestEvaluation,
  BacktestMetrics,
  BacktestSignalResult,
} from "./types.ts";

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function byNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function roundedMetric(value: number): number {
  return byNumber(Number(value.toFixed(12)));
}

function symbolIndex(symbol: string): number {
  const index = BACKTEST_SYMBOL_ORDER.indexOf(symbol as (typeof BACKTEST_SYMBOL_ORDER)[number]);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function orderedExecutedTrades(results: readonly BacktestSignalResult[]): readonly BacktestSignalResult[] {
  return results
    .filter((result) => result.status === "EXECUTED" && result.netR !== null && result.entryTime !== null && result.exitTime !== null)
    .sort((left, right) => {
      const timeDifference = left.snapshot.signalTime - right.snapshot.signalTime;
      if (timeDifference !== 0) return timeDifference;
      const symbolDifference = symbolIndex(left.snapshot.symbol) - symbolIndex(right.snapshot.symbol);
      if (symbolDifference !== 0) return symbolDifference;
      return BACKTEST_DIRECTION_ORDER.indexOf(left.snapshot.direction) - BACKTEST_DIRECTION_ORDER.indexOf(right.snapshot.direction);
    });
}

type GroupValue = { formalSignals: number; executedTrades: number; netR: number };

function groupValue(): GroupValue {
  return { formalSignals: 0, executedTrades: 0, netR: 0 };
}

function breakdown(
  results: readonly BacktestSignalResult[],
): BacktestBreakdown {
  const bySymbol = Object.fromEntries(BACKTEST_SYMBOL_ORDER.map((symbol) => [symbol, groupValue()])) as Record<string, GroupValue>;
  const byDirection = Object.fromEntries(BACKTEST_DIRECTION_ORDER.map((direction) => [direction, groupValue()])) as Record<string, GroupValue>;
  const byGrade = Object.fromEntries(BACKTEST_GRADE_ORDER.map((grade) => [grade, groupValue()])) as Record<string, GroupValue>;
  const byBtcRegime = Object.fromEntries(BACKTEST_BTC_REGIME_ORDER.map((regime) => [regime, groupValue()])) as Record<string, GroupValue>;
  const byUtcSignalMonth: Record<string, GroupValue> = {};

  for (const result of results) {
    const groups = [
      bySymbol[result.snapshot.symbol],
      byDirection[result.snapshot.direction],
      result.snapshot.grade ? byGrade[result.snapshot.grade] : undefined,
      byBtcRegime[result.snapshot.btcRegime],
    ];
    const month = new Date(result.snapshot.signalTime).toISOString().slice(0, 7);
    byUtcSignalMonth[month] ??= groupValue();
    groups.push(byUtcSignalMonth[month]);
    for (const group of groups) {
      if (!group) continue;
      group.formalSignals += 1;
      if (result.status === "EXECUTED" && result.netR !== null) {
        group.executedTrades += 1;
        group.netR += result.netR;
      }
    }
  }

  const freezeGroups = (groups: Record<string, GroupValue>): Readonly<Record<string, Readonly<GroupValue>>> =>
    Object.freeze(
      Object.fromEntries(
        Object.entries(groups).map(([key, value]) => [
          key,
          Object.freeze({ formalSignals: value.formalSignals, executedTrades: value.executedTrades, netR: byNumber(value.netR) }),
        ]),
      ),
    );

  return Object.freeze({
    bySymbol: freezeGroups(bySymbol) as BacktestBreakdown["bySymbol"],
    byDirection: freezeGroups(byDirection) as BacktestBreakdown["byDirection"],
    byGrade: freezeGroups(byGrade) as BacktestBreakdown["byGrade"],
    byBtcRegime: freezeGroups(byBtcRegime) as BacktestBreakdown["byBtcRegime"],
    byUtcSignalMonth: freezeGroups(byUtcSignalMonth),
  });
}

export function calculateBacktestMetrics(input: Readonly<{
  evaluations: readonly BacktestEvaluation[];
  signalResults: readonly BacktestSignalResult[];
}>): BacktestMetrics {
  const results = input.signalResults;
  const executed = orderedExecutedTrades(results);
  const netValues = executed.map((trade) => trade.netR!);
  const positive = netValues.filter((value) => value > 0);
  const negative = netValues.filter((value) => value < 0);
  const positiveR = positive.reduce((sum, value) => sum + value, 0);
  const negativeR = Math.abs(negative.reduce((sum, value) => sum + value, 0));
  const formalSignals = input.evaluations.reduce((sum, evaluation) => sum + evaluation.formalSignalCount, 0);
  const periodEndCensored = results.filter((result) => result.status === "PERIOD_END_CENSORED").length;
  const eligibleExecutionSignals = Math.max(0, formalSignals - periodEndCensored);
  const overlapFlags = executed.map((trade, index) =>
    executed.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      return trade.entryTime! <= other.exitTime! && other.entryTime! <= trade.exitTime!;
    }),
  );
  const overlapCount = overlapFlags.filter(Boolean).length;

  const symbolPositive = new Map<string, number>();
  for (const trade of executed) {
    symbolPositive.set(trade.snapshot.symbol, (symbolPositive.get(trade.snapshot.symbol) ?? 0) + Math.max(trade.netR!, 0));
  }
  const topSymbolPositive = Math.max(0, ...symbolPositive.values());
  const largestSinglePositive = Math.max(0, ...positive);

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of executed) {
    equity += trade.netR!;
    peak = Math.max(peak, equity, 0);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  const metrics: BacktestMetrics = {
    totalEvaluations: input.evaluations.length,
    totalFormalSignals: formalSignals,
    executedTrades: executed.length,
    entryOutsideBracket: results.filter((result) => result.status === "ENTRY_OUTSIDE_BRACKET").length,
    periodEndCensored,
    settlementAmbiguous: results.filter((result) => result.status === "SETTLEMENT_AMBIGUOUS").length,
    dataIncomplete: results.filter((result) => result.status === "DATA_INCOMPLETE").length,
    eligibleExecutionSignals,
    executionFillRate: eligibleExecutionSignals === 0 ? null : executed.length / eligibleExecutionSignals,
    tpCount: executed.filter((trade) => trade.exitReason === "TP").length,
    slCount: executed.filter((trade) => trade.exitReason === "SL").length,
    timeExitCount: executed.filter((trade) => trade.exitReason === "TIME_EXIT").length,
    grossR: byNumber(executed.reduce((sum, trade) => sum + (trade.grossR ?? 0), 0)),
    netR: byNumber(netValues.reduce((sum, value) => sum + value, 0)),
    wins: positive.length,
    losses: negative.length,
    breakevens: netValues.filter((value) => value === 0).length,
    winRate: executed.length === 0 ? null : positive.length / executed.length,
    lossRate: executed.length === 0 ? null : negative.length / executed.length,
    breakevenRate: executed.length === 0 ? null : netValues.filter((value) => value === 0).length / executed.length,
    profitFactor: executed.length === 0 || negativeR === 0 ? null : roundedMetric(positiveR / negativeR),
    profitFactorStatus: executed.length === 0 ? "NO_TRADES" : negativeR === 0 ? "NO_LOSSES" : "NORMAL",
    expectancyR: average(netValues),
    medianR: median(netValues),
    averageWinR: average(positive),
    averageLossR: average(negative),
    bestTradeR: netValues.length === 0 ? null : Math.max(...netValues),
    worstTradeR: netValues.length === 0 ? null : Math.min(...netValues),
    cumulativeFeeR: byNumber(executed.reduce((sum, trade) => sum + (trade.feeR ?? 0), 0)),
    cumulativeFundingR: byNumber(executed.reduce((sum, trade) => sum + (trade.fundingR ?? 0), 0)),
    signalSequenceMaxDrawdownR: executed.length === 0 ? null : byNumber(maxDrawdown),
    overlappingTradeCount: overlapCount,
    overlappingSignalRate: executed.length === 0 ? null : overlapCount / executed.length,
    totalPositiveNetR: byNumber(positiveR),
    topSymbolShareOfPositiveNetR: positiveR === 0 ? null : roundedMetric(topSymbolPositive / positiveR),
    largestSingleTradeShareOfPositiveNetR: positiveR === 0 ? null : roundedMetric(largestSinglePositive / positiveR),
    concentrationStatus: executed.length === 0 ? "NO_TRADES" : positiveR === 0 ? "NO_POSITIVE_R" : "NORMAL",
  };

  return Object.freeze(metrics);
}

export function calculateBacktestBreakdown(signalResults: readonly BacktestSignalResult[]): BacktestBreakdown {
  return breakdown(signalResults);
}
