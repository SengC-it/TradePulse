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
import {
  validateRequiredManifestCoverage,
  validateRequiredMarkPriceManifestCoverage,
  type BacktestFallbackManifestRequirement,
} from "./manifests.ts";
import {
  determineFrozenBacktestExit,
  emptyBacktestSignalResult,
  settleBacktestSignal,
  snapshotFromCandidate,
} from "./settlement.ts";
import type { FrozenBacktestExit } from "./settlement.ts";
import { requiresIntrabarFundingResolution } from "./funding.ts";
import { isIntrabarSettlementOnly } from "./ranges.ts";
import {
  deduplicateIntrabarSettlementIdentities,
  intrabarSettlementIdentityKey,
} from "../historical-data/intrabar.ts";
import type {
  BacktestData,
  BacktestEvaluation,
  BacktestReport,
  BacktestRunInput,
  BacktestRunStatus,
  BacktestSignalResult,
  BacktestFundingAudit,
  IntrabarSettlementAudit,
  IntrabarSettlementRequirement,
} from "./types.ts";
import type { HistoricalFundingRecord, HistoricalMarkPriceCandle } from "../historical-data/types.ts";
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
  const markPriceSegments = data.markPriceSegments?.[candidate.symbol];
  return settleBacktestSignal({
    snapshot,
    signalCandle,
    heldCandles,
    funding: data.funding[candidate.symbol] ?? [],
    markPriceCandles,
    markPriceSegments,
    intrabarSettlementWindows: data.intrabarSettlementWindows,
    serverTime: data.serverTime,
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

function emptySymbolCounts(): Record<(typeof BACKTEST_SYMBOL_ORDER)[number], number> {
  return Object.fromEntries(BACKTEST_SYMBOL_ORDER.map((symbol) => [symbol, 0])) as Record<
    (typeof BACKTEST_SYMBOL_ORDER)[number],
    number
  >;
}

function orderedYearCounts(values: Map<string, number>): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries([...values.keys()].sort((left, right) => Number(left) - Number(right)).map((year) => [year, values.get(year)!])),
  );
}

export function buildIntrabarSettlementAudit(
  signalResults: readonly BacktestSignalResult[],
  windows: readonly import("../historical-data/types.ts").HistoricalIntrabarSettlementWindow[] = [],
): IntrabarSettlementAudit {
  const loadedBySymbol = emptySymbolCounts();
  const loadedByYear = new Map<string, number>();
  const loadedKeys = new Set<string>();
  for (const window of windows) {
    const key = intrabarSettlementIdentityKey(window);
    if (loadedKeys.has(key)) continue;
    loadedKeys.add(key);
    loadedBySymbol[window.symbol] += 1;
    const year = String(new Date(window.exitCandleOpenTime).getUTCFullYear());
    loadedByYear.set(year, (loadedByYear.get(year) ?? 0) + 1);
  }

  const resolvedBySymbol = emptySymbolCounts();
  const resolvedByYear = new Map<string, number>();
  const conservativeBySymbol = emptySymbolCounts();
  const conservativeByYear = new Map<string, number>();
  const remainingBySymbol = emptySymbolCounts();
  const remainingByYear = new Map<string, number>();
  let resolved = 0;
  let conservative = 0;
  let remaining = 0;
  for (const result of signalResults) {
    for (const audit of result.fundingOrderAudits ?? []) {
      const year = String(new Date(audit.fundingTime).getUTCFullYear());
      if (audit.resolution === "ONE_MINUTE_RESOLVED") {
        resolved += 1;
        resolvedBySymbol[audit.symbol] += 1;
        resolvedByYear.set(year, (resolvedByYear.get(year) ?? 0) + 1);
      } else if (audit.resolution === "CONSERVATIVE_SAME_MINUTE") {
        conservative += 1;
        conservativeBySymbol[audit.symbol] += 1;
        conservativeByYear.set(year, (conservativeByYear.get(year) ?? 0) + 1);
      }
    }
    if (result.status === "SETTLEMENT_AMBIGUOUS") {
      remaining += 1;
      remainingBySymbol[result.snapshot.symbol] += 1;
      const year = String(new Date(result.snapshot.signalTime).getUTCFullYear());
      remainingByYear.set(year, (remainingByYear.get(year) ?? 0) + 1);
    }
  }
  return Object.freeze({
    intrabarSettlementWindowsLoaded: loadedKeys.size,
    intrabarResolvedFundingOrderCount: resolved,
    conservativeSameMinuteCount: conservative,
    remainingSettlementAmbiguousCount: remaining,
    intrabarSettlementWindowsLoadedBySymbol: Object.freeze(loadedBySymbol),
    intrabarSettlementWindowsLoadedByUtcYear: orderedYearCounts(loadedByYear),
    intrabarResolvedFundingOrderBySymbol: Object.freeze(resolvedBySymbol),
    intrabarResolvedFundingOrderByUtcYear: orderedYearCounts(resolvedByYear),
    conservativeSameMinuteBySymbol: Object.freeze(conservativeBySymbol),
    conservativeSameMinuteByUtcYear: orderedYearCounts(conservativeByYear),
    remainingSettlementAmbiguousBySymbol: Object.freeze(remainingBySymbol),
    remainingSettlementAmbiguousByUtcYear: orderedYearCounts(remainingByYear),
  });
}

export function discoverIntrabarSettlementRequirement(input: Readonly<{
  period: Exclude<BacktestPeriod, "COMBINED">;
  symbol: (typeof BACKTEST_SYMBOL_ORDER)[number];
  entryTime: number;
  funding: readonly HistoricalFundingRecord[];
  frozenExit: FrozenBacktestExit;
}>): IntrabarSettlementRequirement | null {
  if (
    !requiresIntrabarFundingResolution({
      funding: input.funding,
      entryTime: input.entryTime,
      exitReason: input.frozenExit.exitReason,
      exitCandle: input.frozenExit.exitCandle,
    })
  ) {
    return null;
  }
  return Object.freeze({
    symbol: input.symbol,
    exitCandleOpenTime: input.frozenExit.exitCandle.openTime,
    exitCandleCloseTime: input.frozenExit.exitCandle.closeTime,
    settlementOnly: isIntrabarSettlementOnly(input.period, input.frozenExit.exitCandle),
  });
}

/**
 * Phase A: discover only the 1m windows needed to resolve otherwise executable
 * bt-policy-002 TP/SL funding ambiguities. This function performs no metrics
 * calculation and never fetches data.
 */
export function discoverIntrabarSettlementRequirements(input: Readonly<{
  period: BacktestPeriod;
  data: BacktestData;
}>): readonly IntrabarSettlementRequirement[] {
  let indexes: HistoricalIndexes;
  try {
    indexes = buildHistoricalIndexes(input.data.datasets);
  } catch {
    return Object.freeze([]);
  }
  const periods: readonly Exclude<BacktestPeriod, "COMBINED">[] =
    input.period === "DEV" ? ["DEV"] : input.period === "OOS" ? ["OOS"] : ["DEV", "OOS"];
  const requirements = new Map<string, IntrabarSettlementRequirement>();
  for (const period of periods) {
    const run = runSinglePeriod(input.data, indexes, period, "bt-policy-002");
    for (const result of run.signalResults) {
      if (result.status !== "SETTLEMENT_AMBIGUOUS") continue;
      const dataset = indexes.bySymbol[result.snapshot.symbol];
      const signalIndex = findCandleIndexAtCloseTime(dataset.candles1h, result.snapshot.signalTime);
      if (signalIndex < 0) continue;
      let heldCandles: readonly import("../market-data/types.ts").Candle[];
      try {
        heldCandles = getHeldCandlesFromIndex(dataset.candles1h, result.snapshot.signalTime);
      } catch {
        continue;
      }
      const frozenExit = determineFrozenBacktestExit(result.snapshot, heldCandles);
      const requirement = discoverIntrabarSettlementRequirement({
        period,
        symbol: result.snapshot.symbol,
        entryTime: result.entryTime ?? Number.NaN,
        funding: input.data.funding[result.snapshot.symbol] ?? [],
        frozenExit,
      });
      if (!requirement) continue;
      const key = intrabarSettlementIdentityKey(requirement);
      const existing = requirements.get(key);
      if (existing && existing.settlementOnly !== requirement.settlementOnly) {
        throw new BacktestError(
          "DATA_INCOMPLETE",
          `Conflicting settlementOnly classification for intrabar requirement ${key}.`,
        );
      }
      requirements.set(key, requirement);
    }
  }
  const symbolOrder = new Map(BACKTEST_SYMBOL_ORDER.map((symbol, index) => [symbol, index]));
  return Object.freeze(
    [...requirements.values()].sort(
      (left, right) =>
        (symbolOrder.get(left.symbol) ?? Number.MAX_SAFE_INTEGER) -
          (symbolOrder.get(right.symbol) ?? Number.MAX_SAFE_INTEGER) ||
        left.exitCandleOpenTime - right.exitCandleOpenTime,
    ),
  );
}

function buildFallbackManifestRequirements(
  signalResults: readonly BacktestSignalResult[],
): Readonly<{
  requirements: readonly BacktestFallbackManifestRequirement[];
  diagnostics: readonly string[];
}> {
  const requirements = new Map<string, BacktestFallbackManifestRequirement>();
  const diagnostics: string[] = [];
  for (const result of signalResults) {
    if (result.status !== "EXECUTED") continue;
    for (const charge of result.fundingCharges) {
      if (charge.markPriceSource !== "MARK_PRICE_KLINE_PRE_EVENT_CLOSE") continue;
      const segment = charge.markPriceManifestSegment;
      if (!segment) {
        diagnostics.push(
          `Fallback mark-price provenance is missing for ${result.snapshot.symbol} at ${charge.fundingTime}.`,
        );
        continue;
      }
      const requirement = { symbol: result.snapshot.symbol, segment } as const;
      requirements.set(`${segment}:${result.snapshot.symbol}`, requirement);
    }
    for (const audit of result.fundingOrderAudits ?? []) {
      if (audit.markPriceSource !== "MARK_PRICE_KLINE_PRE_EVENT_CLOSE") continue;
      if (!audit.markPriceManifestSegment) {
        diagnostics.push(
          `Fallback mark-price provenance is missing for ${result.snapshot.symbol} at ${audit.fundingTime}.`,
        );
        continue;
      }
      const requirement = { symbol: result.snapshot.symbol, segment: audit.markPriceManifestSegment } as const;
      requirements.set(`${requirement.segment}:${requirement.symbol}`, requirement);
    }
  }
  return Object.freeze({
    requirements: Object.freeze([...requirements.values()]),
    diagnostics: Object.freeze(diagnostics),
  });
}

export function runBacktest(input: BacktestRunInput): BacktestReport {
  const policy = input.policy ?? BACKTEST_POLICY_VERSION;
  if (!isBacktestPolicy(policy)) {
    throw new BacktestError("INVALID_VERSION", `Unsupported backtest policy: ${String(policy)}.`);
  }
  const intrabarRequirements =
    policy === "bt-policy-003"
      ? input.data.intrabarSettlementRequirements ??
        (input.data.intrabarSettlementWindows ?? []).map((window) => ({
          symbol: window.symbol,
          exitCandleOpenTime: window.exitCandleOpenTime,
          exitCandleCloseTime: window.exitCandleOpenTime + INTERVAL_MS["1h"] - 1,
          settlementOnly: window.settlementOnly,
        }))
      : [];
  const requirementIdentity =
    policy === "bt-policy-003"
      ? deduplicateIntrabarSettlementIdentities(intrabarRequirements)
      : { unique: Object.freeze([]), duplicateKeys: Object.freeze([]), conflictingKeys: Object.freeze([]) };
  const windowIdentity =
    policy === "bt-policy-003"
      ? deduplicateIntrabarSettlementIdentities(input.data.intrabarSettlementWindows ?? [])
      : { unique: Object.freeze([]), duplicateKeys: Object.freeze([]), conflictingKeys: Object.freeze([]) };
  const normalizedIntrabarRequirements = requirementIdentity.unique;
  const intrabarWindowDiagnostics: string[] = [];
  for (const key of requirementIdentity.conflictingKeys) {
    intrabarWindowDiagnostics.push(`Conflicting settlementOnly classification for intrabar requirement ${key}.`);
  }
  for (const key of windowIdentity.conflictingKeys) {
    intrabarWindowDiagnostics.push(`Conflicting settlementOnly classification for intrabar window ${key}.`);
  }
  for (const key of windowIdentity.duplicateKeys) {
    intrabarWindowDiagnostics.push(`Duplicate intrabar settlement window for ${key}.`);
  }
  if (policy === "bt-policy-003") {
    const windows = input.data.intrabarSettlementWindows ?? [];
    for (const requirement of normalizedIntrabarRequirements) {
      const present = windows.some(
        (window) =>
          window.symbol === requirement.symbol &&
          window.exitCandleOpenTime === requirement.exitCandleOpenTime &&
          window.settlementOnly === requirement.settlementOnly,
      );
      if (!present) {
        intrabarWindowDiagnostics.push(
          `Required intrabar settlement window is missing for ${requirement.symbol} at ${requirement.exitCandleOpenTime}.`,
        );
      }
    }
  }
  const manifestCoverageBase = validateRequiredManifestCoverage(
    input.data.manifests,
    input.period,
    [],
    normalizedIntrabarRequirements,
  );
  const manifestCoverage = Object.freeze({
    valid: manifestCoverageBase.valid && intrabarWindowDiagnostics.length === 0,
    diagnostics: Object.freeze([...manifestCoverageBase.diagnostics, ...intrabarWindowDiagnostics]),
  });
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
  let devRun = input.period === "OOS" ? null : runFor("DEV");
  let oosRun = input.period === "DEV" ? null : runFor("OOS");
  const initialRuns = [devRun, oosRun].filter((run): run is SinglePeriodResult => run !== null);
  const initialSignalResults = initialRuns.flatMap((run) => run.signalResults);
  const fallbackRequirements =
    policy === "bt-policy-002" || policy === "bt-policy-003"
      ? buildFallbackManifestRequirements(initialSignalResults)
      : { requirements: [], diagnostics: [] };
  const fallbackManifestCoverage = (() => {
    if (policy !== "bt-policy-002" && policy !== "bt-policy-003") {
      return Object.freeze({ valid: true, diagnostics: Object.freeze([] as string[]) });
    }
    const manifestCoverage = validateRequiredMarkPriceManifestCoverage(
      input.data.manifests,
      input.period,
      fallbackRequirements.requirements,
    );
    const diagnostics = Object.freeze([...fallbackRequirements.diagnostics, ...manifestCoverage.diagnostics]);
    return Object.freeze({ valid: diagnostics.length === 0, diagnostics });
  })();

  if (!fallbackManifestCoverage.valid && input.period !== "COMBINED") {
    const targetRun = input.period === "DEV" ? devRun : oosRun;
    const incompleteRun = targetRun
      ? Object.freeze({
          ...targetRun,
          diagnostics: Object.freeze([...targetRun.diagnostics, ...fallbackManifestCoverage.diagnostics]),
          status: "INCOMPLETE" as const,
        })
      : null;
    if (input.period === "DEV") devRun = incompleteRun;
    else oosRun = incompleteRun;
  }

  const runs = [devRun, oosRun].filter((run): run is SinglePeriodResult => run !== null);
  const evaluations = runs.flatMap((run) => run.evaluations);
  const signalResults = runs.flatMap((run) => run.signalResults);
  const diagnostics = [
    ...runs.flatMap((run) => run.diagnostics),
    ...(input.period === "COMBINED" ? fallbackManifestCoverage.diagnostics : []),
  ];
  const devMetrics = devRun ? calculateBacktestMetrics({ evaluations: devRun.evaluations, signalResults: devRun.signalResults }) : null;
  const oosMetrics = oosRun ? calculateBacktestMetrics({ evaluations: oosRun.evaluations, signalResults: oosRun.signalResults }) : null;
  const combinedMetrics = input.period === "COMBINED" ? calculateBacktestMetrics({ evaluations, signalResults }) : null;
  const intrabarAudit = policy === "bt-policy-003"
    ? buildIntrabarSettlementAudit(signalResults, input.data.intrabarSettlementWindows)
    : undefined;
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
        runStatus:
          runs.some((run) => run.status === "INCOMPLETE") ||
          !fallbackManifestCoverage.valid ||
          (intrabarAudit?.remainingSettlementAmbiguousCount ?? 0) > 0
            ? "INCOMPLETE"
            : "PASS",
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

  if (policy === "bt-policy-003") {
    return Object.freeze({
      ...reportCore,
      schemaVersion: "m3-b-report-003" as const,
      backtestPolicyVersion: "bt-policy-003" as const,
      ...buildFundingAudit(signalResults),
      ...intrabarAudit!,
    });
  }

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
