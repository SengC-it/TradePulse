import { RESEARCH_SYMBOLS } from "../config/constants.ts";
import type { StrategyCandidate } from "../strategy/types.ts";
import { evaluateStrategy } from "../strategy/engine.ts";
import { BacktestError } from "./errors.ts";
import {
  BACKTEST_PERIOD_RANGES,
  BACKTEST_POLICY,
  BACKTEST_POLICY_VERSION,
  BACKTEST_SYMBOL_ORDER,
  type BacktestPeriod,
} from "./constants.ts";
import { evaluateBacktestAcceptance } from "./acceptance.ts";
import { calculateBacktestBreakdown, calculateBacktestMetrics } from "./metrics.ts";
import { emptyBacktestSignalResult, settleBacktestSignal, snapshotFromCandidate } from "./settlement.ts";
import type {
  BacktestData,
  BacktestEvaluation,
  BacktestReport,
  BacktestRunInput,
  BacktestRunStatus,
  BacktestSignalResult,
} from "./types.ts";
import { buildStrategyInput, getHeldCandles, findSignalCandle } from "./windows.ts";

type SinglePeriodResult = Readonly<{
  evaluations: readonly BacktestEvaluation[];
  signalResults: readonly BacktestSignalResult[];
  diagnostics: readonly string[];
  status: BacktestRunStatus;
}>;

function signalTimes(data: BacktestData, period: Exclude<BacktestPeriod, "COMBINED">): readonly number[] {
  const range = BACKTEST_PERIOD_RANGES[period];
  const timeline = data.datasets.BTCUSDT?.candles1h.filter(
    (candle) => candle.closeTime >= range.startTime && candle.closeTime <= range.endTime,
  );
  if (!timeline || timeline.length === 0) {
    throw new BacktestError("DATA_INCOMPLETE", `No 1H evaluation points are available for ${period}.`);
  }

  const times: number[] = [];
  for (const candle of timeline) {
    for (const symbol of RESEARCH_SYMBOLS) {
      const hasPoint = data.datasets[symbol]?.candles1h.some((item) => item.closeTime === candle.closeTime);
      if (!hasPoint) {
        throw new BacktestError("DATA_INCOMPLETE", `${symbol} is missing the ${period} evaluation candle at ${candle.closeTime}.`);
      }
    }
    times.push(candle.closeTime);
  }
  return Object.freeze(times);
}

function statusFromResults(
  signalResults: readonly BacktestSignalResult[],
  diagnostics: readonly string[],
  period: Exclude<BacktestPeriod, "COMBINED">,
): BacktestRunStatus {
  if (
    diagnostics.length > 0 ||
    signalResults.some((result) => result.status === "DATA_INCOMPLETE" || result.status === "SETTLEMENT_AMBIGUOUS")
  ) {
    return "INCOMPLETE";
  }
  if (period === "DEV") return "PASS";
  return "PASS";
}

function periodCensoredResult(
  candidate: StrategyCandidate,
  signalTime: number,
): BacktestSignalResult {
  return emptyBacktestSignalResult(
    snapshotFromCandidate(candidate, signalTime),
    "PERIOD_END_CENSORED",
    "Held candle #24 closes after the frozen DEV end.",
  );
}

function incompleteResult(candidate: StrategyCandidate, signalTime: number, diagnostic: string): BacktestSignalResult {
  return emptyBacktestSignalResult(snapshotFromCandidate(candidate, signalTime), "DATA_INCOMPLETE", diagnostic);
}

function candidateResults(
  data: BacktestData,
  candidate: StrategyCandidate,
  signalTime: number,
  period: Exclude<BacktestPeriod, "COMBINED">,
): BacktestSignalResult {
  const snapshot = snapshotFromCandidate(candidate, signalTime);
  const signalCandle = data.datasets[candidate.symbol]?.candles1h
    ? findSignalCandle(data.datasets[candidate.symbol].candles1h, signalTime)
    : null;
  if (!signalCandle) return incompleteResult(candidate, signalTime, "Signal candle is unavailable.");

  const expectedHeld24Close = signalCandle.openTime + BACKTEST_POLICY.heldCandleCount * 60 * 60 * 1000 + 60 * 60 * 1000 - 1;
  const periodEnd = BACKTEST_PERIOD_RANGES[period].endTime;
  if (period === "DEV" && expectedHeld24Close > periodEnd) {
    return periodCensoredResult(candidate, signalTime);
  }

  let heldCandles;
  try {
    heldCandles = getHeldCandles(data.datasets[candidate.symbol].candles1h, signalTime);
  } catch (error) {
    return Object.freeze({
      ...emptyBacktestSignalResult(
        snapshot,
        "DATA_INCOMPLETE",
        error instanceof Error ? error.message : "Required held candles are unavailable.",
      ),
    });
  }
  return settleBacktestSignal({
    snapshot,
    signalCandle,
    heldCandles,
    funding: data.funding[candidate.symbol] ?? [],
    period,
    periodEndTime: periodEnd,
  });
}

function runSinglePeriod(
  data: BacktestData,
  period: Exclude<BacktestPeriod, "COMBINED">,
): SinglePeriodResult {
  const evaluations: BacktestEvaluation[] = [];
  const signalResults: BacktestSignalResult[] = [];
  const diagnostics: string[] = [];
  let times: readonly number[];
  try {
    times = signalTimes(data, period);
  } catch (error) {
    return {
      evaluations: Object.freeze([]),
      signalResults: Object.freeze([]),
      diagnostics: Object.freeze([error instanceof Error ? error.message : "Evaluation timeline is incomplete."]),
      status: "INCOMPLETE",
    };
  }

  for (const evaluationTime of times) {
    let input;
    try {
      input = buildStrategyInput(data.datasets, evaluationTime);
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
      signalResults.push(candidateResults(data, candidate, evaluationTime, period));
    }
  }

  const status = statusFromResults(signalResults, diagnostics, period);
  return Object.freeze({
    evaluations: Object.freeze(evaluations),
    signalResults: Object.freeze(signalResults),
    diagnostics: Object.freeze(diagnostics),
    status,
  });
}

function statusFromAcceptance(
  acceptance: ReturnType<typeof evaluateBacktestAcceptance>,
): BacktestRunStatus {
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

export function runBacktest(input: BacktestRunInput): BacktestReport {
  if (input.data.manifests?.some((manifest) => manifest.provider !== "binance-usdm-public")) {
    throw new BacktestError("INVALID_INPUT", "Backtest data must use the approved Binance public provider.");
  }

  const devRun = input.period === "OOS" ? null : runSinglePeriod(input.data, "DEV");
  const oosRun = input.period === "DEV" ? null : runSinglePeriod(input.data, "OOS");
  const runs = [devRun, oosRun].filter((run): run is SinglePeriodResult => run !== null);
  const evaluations = runs.flatMap((run) => run.evaluations);
  const signalResults = runs.flatMap((run) => run.signalResults);
  const diagnostics = runs.flatMap((run) => run.diagnostics);
  const devMetrics = devRun ? calculateBacktestMetrics({ evaluations: devRun.evaluations, signalResults: devRun.signalResults }) : null;
  const oosMetrics = oosRun ? calculateBacktestMetrics({ evaluations: oosRun.evaluations, signalResults: oosRun.signalResults }) : null;
  const combinedMetrics =
    input.period === "COMBINED" ? calculateBacktestMetrics({ evaluations, signalResults }) : null;
  const devAcceptance = devMetrics
    ? evaluateBacktestAcceptance({ period: "DEV", metrics: devMetrics, runStatus: devRun?.status })
    : null;
  const oosAcceptance = oosMetrics
    ? evaluateBacktestAcceptance({ period: "OOS", metrics: oosMetrics, runStatus: oosRun?.status })
    : null;
  const combinedAcceptance = combinedMetrics
    ? evaluateBacktestAcceptance({ period: "COMBINED", metrics: combinedMetrics, runStatus: runs.some((run) => run.status === "INCOMPLETE") ? "INCOMPLETE" : "PASS" })
    : null;
  const metrics = input.period === "DEV" ? devMetrics! : input.period === "OOS" ? oosMetrics! : combinedMetrics!;
  const acceptance = input.period === "DEV" ? devAcceptance! : input.period === "OOS" ? oosAcceptance! : combinedAcceptance!;
  const acceptanceValues = [devAcceptance, oosAcceptance, combinedAcceptance].filter(
    (value): value is NonNullable<typeof value> => value !== null,
  );
  const status =
    acceptanceValues.some((value) => value.status === "INCOMPLETE")
      ? "INCOMPLETE"
      : acceptanceValues.some((value) => value.status === "INSUFFICIENT_SAMPLE")
        ? "INSUFFICIENT_SAMPLE"
        : acceptanceValues.some((value) => value.status === "FAIL")
          ? "FAIL"
          : statusFromAcceptance(acceptance);
  const breakdowns = calculateBacktestBreakdown(signalResults);
  const manifests = [...(input.data.manifests ?? [])].sort((left, right) => {
    const leftKey = `${left.kind}:${left.symbol}:${"timeframe" in left ? left.timeframe : "funding"}`;
    const rightKey = `${right.kind}:${right.symbol}:${"timeframe" in right ? right.timeframe : "funding"}`;
    return leftKey.localeCompare(rightKey);
  });

  return Object.freeze({
    schemaVersion: "m3-b-report-001",
    strategyVersion: "baseline-001",
    backtestPolicyVersion: BACKTEST_POLICY_VERSION,
    period: input.period,
    periods: Object.freeze(BACKTEST_PERIOD_RANGES),
    symbols: Object.freeze([...BACKTEST_SYMBOL_ORDER]),
    timeframes: Object.freeze(["1h", "4h"] as const),
    policy: Object.freeze({
      strategyWindowCandles: BACKTEST_POLICY.strategyWindowCandles,
      warmupCandles1h: BACKTEST_POLICY.warmupCandles1h,
      warmupCandles4h: BACKTEST_POLICY.warmupCandles4h,
      slippageRate: BACKTEST_POLICY.slippageRate,
      feeRate: BACKTEST_POLICY.feeRate,
      takeProfitR: BACKTEST_POLICY.takeProfitR,
      heldCandleCount: BACKTEST_POLICY.heldCandleCount,
    }),
    manifests: Object.freeze(manifests),
    status,
    acceptance,
    metrics,
    metricsByPeriod: Object.freeze({ DEV: devMetrics, OOS: oosMetrics, COMBINED: combinedMetrics }),
    acceptanceByPeriod: Object.freeze({ DEV: devAcceptance, OOS: oosAcceptance, COMBINED: combinedAcceptance }),
    breakdowns,
    evaluations: Object.freeze(evaluations),
    signalResults: Object.freeze(signalResults),
    diagnostics: Object.freeze(diagnostics),
    disclaimer: BACKTEST_POLICY.signalLevelDisclaimer,
  });
}

export const runDeterministicBacktest = runBacktest;
