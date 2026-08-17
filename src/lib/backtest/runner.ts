import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { StrategyCandidate } from "../strategy/types.ts";
import { evaluateStrategy } from "../strategy/engine.ts";
import { BacktestError } from "./errors.ts";
import {
  BACKTEST_PERIOD_RANGES,
  BACKTEST_POLICY,
  BACKTEST_POLICY_VERSION,
  BACKTEST_SYMBOL_ORDER,
  isBacktestPolicy,
  type BacktestPolicyVersion,
  type BacktestPeriod,
} from "./constants.ts";
import {
  evaluateBacktestAcceptance,
  evaluateOverallBacktestAcceptance,
} from "./acceptance.ts";
import { calculateBacktestBreakdown, calculateBacktestMetrics } from "./metrics.ts";
import { validateRequiredManifestCoverage } from "./manifests.ts";
import { emptyBacktestSignalResult, settleBacktestSignal, snapshotFromCandidate } from "./settlement.ts";
import type {
  BacktestData,
  BacktestEvaluation,
  BacktestReport,
  BacktestRunInput,
  BacktestRunStatus,
  BacktestSignalResult,
  BacktestFundingAudit,
} from "./types.ts";
import type { HistoricalMarkPriceCandle } from "../historical-data/types.ts";
import {
  buildHistoricalIndexes,
  buildStrategyInputFromIndexes,
  evaluationTimesForPeriod,
  findCandleIndexAtCloseTime,
  getHeldCandlesFromIndex,
  type HistoricalIndexes,
} from "./windows.ts";

type SinglePeriodResult = Readonly<{
  evaluations: readonly BacktestEvaluation[];
  signalResults: readonly BacktestSignalResult[];
  diagnostics: readonly string[];
  status: BacktestRunStatus;
}>;

function statusFromResults(
  signalResults: readonly BacktestSignalResult[],
  diagnostics: readonly string[],
): BacktestRunStatus {
  if (
    diagnostics.length > 0 ||
    signalResults.some((result) => result.status === "DATA_INCOMPLETE" || result.status === "SETTLEMENT_AMBIGUOUS")
  ) {
    return "INCOMPLETE";
  }
  return "PASS";
}

function periodCensoredResult(
  candidate: StrategyCandidate,
  signalTime: number,
  policy: BacktestPolicyVersion,
): BacktestSignalResult {
  return emptyBacktestSignalResult(
    snapshotFromCandidate(candidate, signalTime, policy),
    "PERIOD_END_CENSORED",
    "Held candle #24 closes after the frozen DEV end.",
  );
}

function incompleteResult(
  candidate: StrategyCandidate,
  signalTime: number,
  diagnostic: string,
  policy: BacktestPolicyVersion,
): BacktestSignalResult {
  return emptyBacktestSignalResult(snapshotFromCandidate(candidate, signalTime, policy), "DATA_INCOMPLETE", diagnostic);
}

function candidateResults(
  data: BacktestData,
  indexes: HistoricalIndexes,
  candidate: StrategyCandidate,
  signalTime: number,
  period: Exclude<BacktestPeriod, "COMBINED">,
  policy: BacktestPolicyVersion,
): BacktestSignalResult {
  const snapshot = snapshotFromCandidate(candidate, signalTime, policy);
  const indexedDataset = indexes.bySymbol[candidate.symbol];
  const signalIndex = findCandleIndexAtCloseTime(indexedDataset.candles1h, signalTime);
  const signalCandle = signalIndex < 0 ? undefined : indexedDataset.candles1h.candles[signalIndex];
  if (!signalCandle) return incompleteResult(candidate, signalTime, "Signal candle is unavailable.", policy);

  const expectedHeld24Close =
    signalCandle.openTime + (BACKTEST_POLICY.heldCandleCount + 1) * INTERVAL_MS["1h"] - 1;
  const periodEnd = BACKTEST_PERIOD_RANGES[period].endTime;
  if (period === "DEV" && expectedHeld24Close > periodEnd) {
    return periodCensoredResult(candidate, signalTime, policy);
  }

  let heldCandles;
  try {
    heldCandles = getHeldCandlesFromIndex(indexedDataset.candles1h, signalTime);
  } catch (error) {
    return incompleteResult(
      candidate,
      signalTime,
      error instanceof Error ? error.message : "Required held candles are unavailable.",
      policy,
    );
  }
  const markPriceCandles: readonly HistoricalMarkPriceCandle[] | undefined = data.markPrice?.[candidate.symbol];
  return settleBacktestSignal({
    snapshot,
    signalCandle,
    heldCandles,
    funding: data.funding[candidate.symbol] ?? [],
    markPriceCandles,
    policy,
    period,
    periodEndTime: periodEnd,
  });
}

function runSinglePeriod(
  data: BacktestData,
  indexes: HistoricalIndexes,
  period: Exclude<BacktestPeriod, "COMBINED">,
  policy: BacktestPolicyVersion,
): SinglePeriodResult {
  const evaluations: BacktestEvaluation[] = [];
  const signalResults: BacktestSignalResult[] = [];
  const diagnostics: string[] = [];
  let times: readonly number[];
  try {
    times = evaluationTimesForPeriod(indexes, period);
  } catch (error) {
    return {
      evaluations: Object.freeze([]),
      signalResults: Object.freeze([]),
      diagnostics: Object.freeze([error instanceof Error ? error.message : "Evaluation timeline is incomplete."]),
      status: "INCOMPLETE",
    };
  }

  // The indexes were fully validated once before either DEV or OOS starts.
  // Each evaluation performs binary lookup and a fixed-size slice only.
  for (const evaluationTime of times) {
    let input;
    try {
      input = buildStrategyInputFromIndexes(indexes, evaluationTime);
    } catch (error) {
      diagnostics.push(error instanceof Error ? error.message : `Strategy window is incomplete at ${evaluationTime}.`);
      break;
    }
    const engineResult = evaluateStrategy(input);
    const formalCandidates = engineResult.evaluations.flatMap((evaluation) => {
      const candidate = evaluation.candidate;
      return candidate?.formalSignal && candidate.totalScore >= 70 ? [candidate] : [];
    });
    evaluations.push(
      Object.freeze({
        period,
        evaluationTime,
        engineResult,
        evaluations: engineResult.evaluations,
        formalSignalCount: formalCandidates.length,
      }),
    );
    for (const candidate of formalCandidates) {
      signalResults.push(candidateResults(data, indexes, candidate, evaluationTime, period, policy));
    }
  }

  const status = statusFromResults(signalResults, diagnostics);
  return Object.freeze({
    evaluations: Object.freeze(evaluations),
    signalResults: Object.freeze(signalResults),
    diagnostics: Object.freeze(diagnostics),
    status,
  });
}

function incompletePeriodResult(diagnostics: readonly string[]): SinglePeriodResult {
  return Object.freeze({
    evaluations: Object.freeze([]),
    signalResults: Object.freeze([]),
    diagnostics: Object.freeze([...diagnostics]),
    status: "INCOMPLETE",
  });
}

function statusFromAcceptance(acceptance: ReturnType<typeof evaluateBacktestAcceptance>): BacktestRunStatus {
  switch (acceptance.status) {
    case "INCOMPLETE":
      return "INCOMPLETE";
    case "INSUFFICIENT_SAMPLE":
      return "INSUFFICIENT_SAMPLE";
    case "FAIL":
      return "FAIL";
    case "PASS":
    case "DESCRIPTIVE":
      return "PASS";
  }
}

function sortManifests(data: BacktestData): BacktestData["manifests"] {
  return Object.freeze([...(data.manifests ?? [])].sort((left, right) => {
    const leftKey = `${left.kind}:${left.symbol}:${"timeframe" in left ? left.timeframe : "funding"}:${left.settlementOnly}:${left.requestedStartTime}`;
    const rightKey = `${right.kind}:${right.symbol}:${"timeframe" in right ? right.timeframe : "funding"}:${right.settlementOnly}:${right.requestedStartTime}`;
    return leftKey.localeCompare(rightKey);
  }));
}

export function buildFundingAudit(signalResults: readonly BacktestSignalResult[]): BacktestFundingAudit {
  const bySymbol = Object.fromEntries(BACKTEST_SYMBOL_ORDER.map((symbol) => [symbol, 0])) as Record<
    (typeof BACKTEST_SYMBOL_ORDER)[number],
    number
  >;
  const byUtcYear = new Map<string, number>();
  let fundingEventsTotal = 0;
  let fundingEventsDirectMarkPrice = 0;
  let fundingEventsFallbackMarkPrice = 0;

  for (const result of signalResults) {
    if (result.status !== "EXECUTED") continue;
    for (const charge of result.fundingCharges) {
      fundingEventsTotal += 1;
      if (charge.markPriceSource !== "MARK_PRICE_KLINE_PRE_EVENT_CLOSE") {
        fundingEventsDirectMarkPrice += 1;
        continue;
      }
      fundingEventsFallbackMarkPrice += 1;
      bySymbol[result.snapshot.symbol] = (bySymbol[result.snapshot.symbol] ?? 0) + 1;
      const year = String(new Date(charge.fundingTime).getUTCFullYear());
      byUtcYear.set(year, (byUtcYear.get(year) ?? 0) + 1);
    }
  }

  const sortedYears = [...byUtcYear.keys()].sort((left, right) => Number(left) - Number(right));
  const orderedByUtcYear = Object.fromEntries(sortedYears.map((year) => [year, byUtcYear.get(year)!]));
  return Object.freeze({
    fundingEventsTotal,
    fundingEventsDirectMarkPrice,
    fundingEventsFallbackMarkPrice,
    fundingFallbackRate:
      fundingEventsTotal === 0 ? null : fundingEventsFallbackMarkPrice / fundingEventsTotal,
    fundingFallbackBySymbol: Object.freeze(bySymbol),
    fundingFallbackByUtcYear: Object.freeze(orderedByUtcYear),
  });
}

export function runBacktest(input: BacktestRunInput): BacktestReport {
  const policy = input.policy ?? BACKTEST_POLICY_VERSION;
  if (!isBacktestPolicy(policy)) {
    throw new BacktestError("INVALID_VERSION", `Unsupported backtest policy: ${String(policy)}.`);
  }
  const manifestCoverage = validateRequiredManifestCoverage(input.data.manifests, input.period);
  let indexes: HistoricalIndexes | undefined;
  let preparationDiagnostics: readonly string[] = manifestCoverage.diagnostics;
  if (manifestCoverage.valid) {
    try {
      indexes = buildHistoricalIndexes(input.data.datasets);
    } catch (error) {
      preparationDiagnostics = Object.freeze([
        error instanceof Error ? error.message : "Historical indexes could not be built.",
      ]);
    }
  }

  const runFor = (period: Exclude<BacktestPeriod, "COMBINED">): SinglePeriodResult =>
    indexes ? runSinglePeriod(input.data, indexes, period, policy) : incompletePeriodResult(preparationDiagnostics);
  const devRun = input.period === "OOS" ? null : runFor("DEV");
  const oosRun = input.period === "DEV" ? null : runFor("OOS");
  const runs = [devRun, oosRun].filter((run): run is SinglePeriodResult => run !== null);
  const evaluations = runs.flatMap((run) => run.evaluations);
  const signalResults = runs.flatMap((run) => run.signalResults);
  const diagnostics = runs.flatMap((run) => run.diagnostics);
  const devMetrics = devRun ? calculateBacktestMetrics({ evaluations: devRun.evaluations, signalResults: devRun.signalResults }) : null;
  const oosMetrics = oosRun ? calculateBacktestMetrics({ evaluations: oosRun.evaluations, signalResults: oosRun.signalResults }) : null;
  const combinedMetrics = input.period === "COMBINED" ? calculateBacktestMetrics({ evaluations, signalResults }) : null;
  const devAcceptance = devMetrics
    ? evaluateBacktestAcceptance({ period: "DEV", metrics: devMetrics, runStatus: devRun?.status })
    : null;
  const oosAcceptance = oosMetrics
    ? evaluateBacktestAcceptance({ period: "OOS", metrics: oosMetrics, runStatus: oosRun?.status })
    : null;
  const combinedAcceptance = combinedMetrics
    ? evaluateBacktestAcceptance({
        period: "COMBINED",
        metrics: combinedMetrics,
        runStatus: runs.some((run) => run.status === "INCOMPLETE") ? "INCOMPLETE" : "PASS",
      })
    : null;
  const acceptanceByPeriod = Object.freeze({ DEV: devAcceptance, OOS: oosAcceptance, COMBINED: combinedAcceptance });
  const overallAcceptance = evaluateOverallBacktestAcceptance({ period: input.period, acceptanceByPeriod });
  const selectedPeriodAcceptance = acceptanceByPeriod[input.period];
  if (!selectedPeriodAcceptance) {
    throw new BacktestError("DATA_INCOMPLETE", `Acceptance is unavailable for selected period ${input.period}.`);
  }
  const metrics = input.period === "DEV" ? devMetrics : input.period === "OOS" ? oosMetrics : combinedMetrics;
  if (!metrics) {
    throw new BacktestError("DATA_INCOMPLETE", `Metrics are unavailable for selected period ${input.period}.`);
  }
  const breakdowns = calculateBacktestBreakdown(signalResults);

  const reportCore = {
    strategyVersion: "baseline-001",
    period: input.period,
    periods: Object.freeze(BACKTEST_PERIOD_RANGES),
    symbols: Object.freeze([...BACKTEST_SYMBOL_ORDER]),
    timeframes: Object.freeze(["1h", "4h"] as const),
    policy: Object.freeze({
      strategyWindowCandles: BACKTEST_POLICY.strategyWindowCandles,
      indicatorWarmupMinimum1h: BACKTEST_POLICY.indicatorWarmupMinimum1h,
      indicatorWarmupMinimum4h: BACKTEST_POLICY.indicatorWarmupMinimum4h,
      historicalLookback1h: BACKTEST_POLICY.historicalLookback1h,
      historicalLookback4h: BACKTEST_POLICY.historicalLookback4h,
      warmupCandles1h: BACKTEST_POLICY.warmupCandles1h,
      warmupCandles4h: BACKTEST_POLICY.warmupCandles4h,
      slippageRate: BACKTEST_POLICY.slippageRate,
      feeRate: BACKTEST_POLICY.feeRate,
      takeProfitR: BACKTEST_POLICY.takeProfitR,
      heldCandleCount: BACKTEST_POLICY.heldCandleCount,
    }),
    manifests: sortManifests(input.data),
    status: statusFromAcceptance(overallAcceptance),
    acceptance: selectedPeriodAcceptance,
    selectedPeriodAcceptance,
    overallAcceptance,
    metrics,
    metricsByPeriod: Object.freeze({ DEV: devMetrics, OOS: oosMetrics, COMBINED: combinedMetrics }),
    acceptanceByPeriod,
    breakdowns,
    evaluations: Object.freeze(evaluations),
    signalResults: Object.freeze(signalResults),
    diagnostics: Object.freeze(diagnostics),
    disclaimer: BACKTEST_POLICY.signalLevelDisclaimer,
  } as const;

  if (policy === "bt-policy-002") {
    return Object.freeze({
      ...reportCore,
      schemaVersion: "m3-b-report-002" as const,
      backtestPolicyVersion: "bt-policy-002" as const,
      ...buildFundingAudit(signalResults),
    });
  }

  return Object.freeze({
    ...reportCore,
    schemaVersion: "m3-b-report-001" as const,
    backtestPolicyVersion: "bt-policy-001" as const,
  });
}

export const runDeterministicBacktest = runBacktest;
