import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import type { IntrabarSettlementCandle } from "../historical-data/types.ts";
import type { BacktestData } from "../backtest/types.ts";
import type { ResearchFoldId } from "./constants.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { stableStringify } from "./utils.ts";
import { buildR13FeatureVector, r13Atr14AtDecision, type R13FeatureVector } from "./m3-r13-round-013-features.ts";
import { computeR13PrimaryAndLatencyStress, type R13ForwardLabel } from "./m3-r13-round-013-labels.ts";
import { fitR13RidgeModel, predictR13RidgeModel, type R13RidgeModel } from "./m3-r13-round-013-model.ts";
import { calculateR13Drawdown } from "./r13-drawdown.ts";
import { R13OneMinuteIndexedSeries, type R13OneMinuteLookup } from "./m3-r13-round-013-index.ts";
import { evaluateR13HorizonGates, selectR13Horizon, R13_SELECTION_GATE_SHA256, type R13HorizonGateEvaluation, type R13HorizonSelection, type R13HorizonSelectionCandidate } from "./selection-gates-round-013.ts";
import { isR13TrainingObservationPurgeSafe, r13SelectTopOne } from "./m3-r13-round-013-validation.ts";
import { R13_PLAN_SHA256, validateR13Plan } from "./m3-r13-round-013-plan.ts";
import { readR13SpecConformance, type R13SpecConformanceReport } from "./m3-r13-round-013-conformance.ts";
import { M3_R13_ACCEPTED_R11_SOURCE_SHA, M3_R13_NO_EDGE_OUTCOME, M3_R13_PERFORMANCE_LOCK, M3_R13_POLICY_VERSION, M3_R13_RESEARCH_END_ISO, M3_R13_RESEARCH_RANGE, M3_R13_RESEARCH_ROUND_ID, R13_FOLD_IDS, R13_HORIZON_HOURS, R13_SYMBOLS, type R13Direction, type R13HorizonHours } from "./m3-r13-round-013-protocol.ts";

export const M3_R13_REPORT_SCHEMA_VERSION = "m3-r13-round-013-report-001" as const;
export const M3_R13_AUDIT_SCHEMA_VERSION = "m3-r13-round-013-audit-001" as const;
export const M3_R13_OUTPUT_PATHS = Object.freeze([
  "docs/evidence/M3_R13_ROUND_013_SUMMARY.json",
  "docs/evidence/M3_R13_ROUND_013_AUDIT.json",
  "docs/M3_R13_ROUND_013_RESULTS.md",
  "docs/evidence/M3_R13_ROUND_013_SELECTION.json",
  "docs/evidence/M3_R13_ROUND_013_SELECTION.md",
] as const);

export type R13Observation = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R13Direction;
  features: R13FeatureVector;
  atr14_1h: number;
  labels: Readonly<Record<R13HorizonHours, R13ForwardLabel>>;
  latencyStressLabels: Readonly<Record<R13HorizonHours, R13ForwardLabel>>;
}>;

export type R13ScoredOpportunity = Readonly<{
  observationId: string;
  foldId: ResearchFoldId;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R13Direction;
  prediction: number;
  label: R13ForwardLabel;
  latencyStressLabel: R13ForwardLabel;
}>;

export type R13ScoredSelection = R13ScoredOpportunity;

export type R13HorizonMetrics = Readonly<{
  horizonHours: R13HorizonHours;
  selectedValidationObservations: number;
  noTradeDecisionTimestamps: number;
  totalValidationDecisionTimestamps: number;
  meanNetForwardAtr: number | null;
  medianNetForwardAtr: number | null;
  meanSelectedSignalsPerMonth: number | null;
  medianSelectedSignalsPerMonth: number | null;
  grossPositiveAtr: number;
  grossNegativeAtrMagnitude: number;
  totalFeesBps: number;
  totalFundingBps: number;
  totalSlippageBps: number;
  atrProfitFactor: number | null;
  cumulativeNetForwardAtr: number;
  maximumDrawdownAtr: number;
  positiveMeanEdgeFolds: number;
  negativeMeanEdgeFolds: number;
  catastrophicFolds: number;
  positiveSpearmanFolds: number;
  pooledSpearman: number | null;
  topBottomDecileSpread: number | null;
  positiveSpreadFolds: number;
  crossSectionalOpportunityCount: number;
  crossSectionalOpportunityTimestamps: number;
  insufficientCrossSectionalTimestamps: number;
  costStressMean: number;
  costStressProfitFactor: number | null;
  latencyStressMean: number;
  maximumPositiveSymbolContributionShare: number | null;
  maximumSinglePositiveObservationContribution: number | null;
  byFoldMeanNetForwardAtr: Readonly<Record<ResearchFoldId, number | null>>;
  bySymbolNetForwardAtr: Readonly<Record<ResearchSymbol, number>>;
  byDirectionNetForwardAtr: Readonly<Record<"LONG" | "SHORT", number>>;
  deciles: readonly Readonly<{ decile: number; count: number; meanRealizedNetForwardAtr: number | null }>[];
}>;

export type R13HorizonPerformance = Readonly<{
  horizonHours: R13HorizonHours;
  metrics: R13HorizonMetrics;
  gateEvaluation: R13HorizonGateEvaluation;
  modelProvenance: readonly Readonly<{ foldId: ResearchFoldId; status: "FIT" | "INSUFFICIENT_RESEARCH_EXAMPLES"; trainingExamples: number; modelIdentitySha256: string | null; standardizationIdentitySha256: string | null; lambda: 10; coefficientHash: string | null }>[];
}>;

export type R13PerformanceReport = Readonly<{
  schemaVersion: typeof M3_R13_REPORT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R13_RESEARCH_ROUND_ID;
  executionSourceSha: string;
  acceptedSourceSha: typeof M3_R13_ACCEPTED_R11_SOURCE_SHA;
  selectionGateSha256: string;
  experimentPlanSha256: typeof R13_PLAN_SHA256;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: typeof M3_R13_POLICY_VERSION;
  dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA";
  researchUniverse: typeof M3_R13_RESEARCH_RANGE;
  researchBoundary: typeof M3_R13_RESEARCH_END_ISO;
  performanceLock: typeof M3_R13_PERFORMANCE_LOCK;
  performanceLockTriggered: true;
  performanceExecutionCount: 1;
  performanceLifecycle: "PERFORMANCE_LOCKED";
  datasetFreeze: Readonly<Record<string, unknown>>;
  conformance: R13SpecConformanceReport;
  observationCounts: Readonly<{ all: number; byHorizon: Readonly<Record<R13HorizonHours, number>>; totalCanonicalDecisionTimestamps: number; warmupExcludedObservations: number; eligibleObservations: number; integrityExcludedObservations: number }>;
  horizons: readonly R13HorizonPerformance[];
  selection: R13HorizonSelection;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  privateBinanceApi: false;
  automaticTrading: false;
}>;

export type R13ExecutionArtifacts = Readonly<{ report: R13PerformanceReport; auditJson: string; summaryJson: string; resultsMarkdown: string; selectionJson: string; selectionMarkdown: string }>;

function hash(value: unknown): string { return createHash("sha256").update(stableStringify(value), "utf8").digest("hex"); }
function byteHash(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }

function key(decisionTime: number, symbol: ResearchSymbol, direction: R13Direction): string { return `${decisionTime}|${symbol}|${direction}`; }

function directionOrder(direction: R13Direction): number { return direction === "LONG" ? 0 : 1; }

function orderObservations(observations: readonly R13Observation[]): readonly R13Observation[] { return Object.freeze([...observations].sort((left, right) => left.decisionTime - right.decisionTime || R13_SYMBOLS.indexOf(left.symbol) - R13_SYMBOLS.indexOf(right.symbol) || directionOrder(left.direction) - directionOrder(right.direction))); }

export function buildR13Observation(input: Readonly<{ data: BacktestData; oneMinute: Readonly<Record<ResearchSymbol, R13OneMinuteLookup | readonly IntrabarSettlementCandle[]>>; symbol: ResearchSymbol; direction: R13Direction; signalTime: number }>): R13Observation {
  const dataset = input.data.datasets[input.symbol];
  if (!dataset) throw new Error(`R13 observation dataset missing for ${input.symbol}.`);
  const allSymbolCandles = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, input.data.datasets[symbol]?.candles1h ?? []])) as Readonly<Record<ResearchSymbol, readonly import("../market-data/types.ts").Candle[]>>;
  const features = buildR13FeatureVector({ symbol: input.symbol, direction: input.direction, signalTime: input.signalTime, candles1h: dataset.candles1h, candles4h: dataset.candles4h, allSymbolCandles1h: allSymbolCandles, funding: input.data.funding[input.symbol] ?? [] });
  const atr14_1h = r13Atr14AtDecision(dataset.candles1h, input.signalTime);
  const labels = {} as Record<R13HorizonHours, R13ForwardLabel>;
  const latencyStressLabels = {} as Record<R13HorizonHours, R13ForwardLabel>;
  for (const horizonHours of R13_HORIZON_HOURS) {
    const pair = computeR13PrimaryAndLatencyStress({ symbol: input.symbol, direction: input.direction, signalTime: input.signalTime, horizonHours, atr14_1h, candles1m: input.oneMinute[input.symbol] ?? [], funding: input.data.funding[input.symbol] ?? [], researchEndTime: M3_R13_RESEARCH_RANGE.endTime });
    labels[horizonHours] = pair.primary;
    latencyStressLabels[horizonHours] = pair.latencyStress;
  }
  return Object.freeze({ observationId: key(input.signalTime, input.symbol, input.direction), decisionTime: input.signalTime, symbol: input.symbol, direction: input.direction, features, atr14_1h, labels: Object.freeze(labels), latencyStressLabels: Object.freeze(latencyStressLabels) });
}

export type R13ObservationUniverseReport = Readonly<{
  observations: readonly R13Observation[];
  totalCanonicalDecisionTimestamps: number;
  warmupExcludedObservations: number;
  eligibleObservations: number;
  integrityExcludedObservations: number;
}>;

function validateR13CoarseSeries(data: BacktestData): void {
  for (const symbol of R13_SYMBOLS) {
    const dataset = data.datasets[symbol];
    if (!dataset) throw new Error(`R13 observation dataset missing for ${symbol}.`);
    for (const timeframe of ["1h", "4h"] as const) {
      const candles = timeframe === "1h" ? dataset.candles1h : dataset.candles4h;
      const interval = timeframe === "1h" ? 60 * 60_000 : 4 * 60 * 60_000;
      for (let index = 0; index < candles.length; index += 1) {
        const candle = candles[index]!;
        if (candle.symbol !== symbol || candle.timeframe !== timeframe || !Number.isSafeInteger(candle.openTime) || candle.closeTime !== candle.openTime + interval - 1 || !Number.isFinite(candle.open) || !Number.isFinite(candle.high) || !Number.isFinite(candle.low) || !Number.isFinite(candle.close) || candle.open <= 0 || candle.high < candle.low) throw new Error(`R13 coarse ${timeframe} history is malformed for ${symbol}.`);
        if (index > 0 && candle.openTime !== candles[index - 1]!.openTime + interval) throw new Error(`R13 coarse ${timeframe} history has a gap or duplicate for ${symbol}.`);
      }
    }
  }
  const referenceTimes = (data.datasets.BTCUSDT?.candles1h ?? []).filter((candle) => candle.closeTime <= M3_R13_RESEARCH_RANGE.endTime).map((candle) => candle.closeTime);
  for (const symbol of R13_SYMBOLS) {
    const times = (data.datasets[symbol]?.candles1h ?? []).filter((candle) => candle.closeTime <= M3_R13_RESEARCH_RANGE.endTime).map((candle) => candle.closeTime);
    if (stableStringify(times) !== stableStringify(referenceTimes)) throw new Error(`R13 cross-symbol decision timeline mismatch for ${symbol}.`);
  }
}

export function buildR13ObservationUniverseWithDiagnostics(input: Readonly<{ data: BacktestData; oneMinute: Readonly<Record<ResearchSymbol, R13OneMinuteLookup | readonly IntrabarSettlementCandle[]>>; retainObservations?: boolean }>): R13ObservationUniverseReport {
  const retainObservations = input.retainObservations ?? true;
  validateR13CoarseSeries(input.data);
  const indexedOneMinute = Object.fromEntries(R13_SYMBOLS.map((symbol) => {
    const source = input.oneMinute[symbol];
    if (!source) throw new Error(`R13 1m history missing for ${symbol}.`);
    return [symbol, source instanceof R13OneMinuteIndexedSeries ? source : new R13OneMinuteIndexedSeries(source as readonly IntrabarSettlementCandle[])];
  })) as unknown as Readonly<Record<ResearchSymbol, R13OneMinuteLookup>>;
  const indexedInput = { ...input, oneMinute: indexedOneMinute };
  const times = [...new Set((input.data.datasets.BTCUSDT?.candles1h ?? []).filter((candle) => candle.closeTime <= M3_R13_RESEARCH_RANGE.endTime).map((candle) => candle.closeTime))].sort((left, right) => left - right);
  const values: R13Observation[] = [];
  const seenObservationIds = new Set<string>();
  let eligibleObservations = 0;
  let warmupExcludedObservations = 0;
  let warmedUp = false;
  for (const signalTime of times) {
    const atTime: R13Observation[] = [];
    const failures: string[] = [];
    for (const symbol of R13_SYMBOLS) for (const direction of ["LONG", "SHORT"] as const) {
      try { atTime.push(buildR13Observation({ ...indexedInput, symbol, direction, signalTime })); }
      catch (error) { failures.push(`${symbol}/${direction}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (failures.length > 0) {
      if (warmedUp) throw new Error(`R13 observation integrity failure after warmup at ${signalTime}: ${failures.join("; ")}`);
      warmupExcludedObservations += failures.length;
      continue;
    }
    warmedUp = true;
    for (const observation of atTime) {
      if (seenObservationIds.has(observation.observationId)) throw new Error("R13 observation universe contains duplicate observation identities.");
      seenObservationIds.add(observation.observationId);
    }
    eligibleObservations += atTime.length;
    if (retainObservations) values.push(...atTime);
  }
  const observations = retainObservations ? orderObservations(values) : Object.freeze([] as R13Observation[]);
  return Object.freeze({ observations, totalCanonicalDecisionTimestamps: times.length, warmupExcludedObservations, eligibleObservations, integrityExcludedObservations: 0 });
}

export function buildR13ObservationUniverse(input: Readonly<{ data: BacktestData; oneMinute: Readonly<Record<ResearchSymbol, R13OneMinuteLookup | readonly IntrabarSettlementCandle[]>> }>): readonly R13Observation[] {
  return buildR13ObservationUniverseWithDiagnostics(input).observations;
}

function foldRole(observation: R13Observation, foldId: ResearchFoldId, role: "RESEARCH" | "VALIDATION"): boolean { const range = getResearchFoldRoleRange(foldId, role); return observation.decisionTime >= range.startTime && observation.decisionTime <= range.endTime; }

function mean(values: readonly number[]): number | null { return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length; }
function median(values: readonly number[]): number | null { if (values.length === 0) return null; const ordered = [...values].sort((left, right) => left - right); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!; }

function pearson(left: readonly number[], right: readonly number[]): number | null { if (left.length < 2 || left.length !== right.length) return null; const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length; const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length; const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index]! - rightMean), 0); const leftDenom = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0)); const rightDenom = Math.sqrt(right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0)); return leftDenom === 0 || rightDenom === 0 ? null : numerator / (leftDenom * rightDenom); }
function ranks(values: readonly number[]): number[] { const order = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index); const result = Array<number>(values.length); order.forEach((item, index) => { result[item.index] = index + 1; }); return result; }
function spearman(left: readonly number[], right: readonly number[]): number | null { if (left.length < 2 || left.length !== right.length) return null; return pearson(ranks(left), ranks(right)); }

function selectedForValidation(observations: readonly R13Observation[], models: Readonly<Record<ResearchFoldId, R13RidgeModel | null>>, horizon: R13HorizonHours): Readonly<{ selections: readonly R13ScoredSelection[]; opportunities: readonly R13ScoredOpportunity[]; noTrade: number; timestamps: number; insufficientCrossSectionalTimestamps: number }> {
  const selections: R13ScoredSelection[] = [];
  const opportunities: R13ScoredOpportunity[] = [];
  let noTrade = 0;
  let timestamps = 0;
  let insufficientCrossSectionalTimestamps = 0;
  for (const foldId of R13_FOLD_IDS) {
    const validation = observations.filter((observation) => foldRole(observation, foldId, "VALIDATION"));
    const byTime = new Map<number, R13Observation[]>();
    for (const observation of validation) { const bucket = byTime.get(observation.decisionTime) ?? []; bucket.push(observation); byTime.set(observation.decisionTime, bucket); }
    const model = models[foldId];
    for (const [decisionTime, values] of [...byTime.entries()].sort(([left], [right]) => left - right)) {
      timestamps += 1;
      if (!model) { noTrade += 1; continue; }
      const scored = values.map((observation) => ({ observation, prediction: predictR13RidgeModel(model, observation.features) }));
      const usableAtTime = scored.filter((value) => value.observation.labels[horizon].status === "EXECUTED" && value.observation.labels[horizon].netForwardAtr !== null && Number.isFinite(value.observation.labels[horizon].netForwardAtr));
      if (usableAtTime.length < 2) insufficientCrossSectionalTimestamps += 1;
      for (const value of usableAtTime) {
        const label = value.observation.labels[horizon];
        opportunities.push(Object.freeze({ observationId: value.observation.observationId, foldId, decisionTime, symbol: value.observation.symbol, direction: value.observation.direction, prediction: value.prediction, label, latencyStressLabel: value.observation.latencyStressLabels[horizon] }));
      }
      const top = r13SelectTopOne(scored.map((value) => ({ ...value, symbol: value.observation.symbol, direction: value.observation.direction })));
      if (!top.selected) { noTrade += 1; continue; }
      const selected = top.selected;
      const label = selected.observation.labels[horizon];
      const stress = selected.observation.latencyStressLabels[horizon];
      if (label.status === "EXECUTED") selections.push(Object.freeze({ observationId: selected.observation.observationId, foldId, decisionTime, symbol: selected.observation.symbol, direction: selected.observation.direction, prediction: selected.prediction, label, latencyStressLabel: stress }));
    }
  }
  return Object.freeze({ selections: Object.freeze(selections), opportunities: Object.freeze(opportunities), noTrade, timestamps, insufficientCrossSectionalTimestamps });
}

function gateCountByFold(values: readonly R13ScoredSelection[], mapper: (value: R13ScoredSelection) => number | null): Readonly<Record<ResearchFoldId, number>> { return Object.freeze(Object.fromEntries(R13_FOLD_IDS.map((foldId) => [foldId, values.filter((value) => value.foldId === foldId && mapper(value) !== null).length])) as Record<ResearchFoldId, number>); }

function metricForHorizon(observations: readonly R13Observation[], models: Readonly<Record<ResearchFoldId, R13RidgeModel | null>>, provenance: R13HorizonPerformance["modelProvenance"], horizon: R13HorizonHours, evidenceIntegrity: boolean): R13HorizonPerformance {
  const selected = selectedForValidation(observations, models, horizon);
  const opportunities = selected.opportunities;
  const usableSelections = selected.selections.filter((selection) => selection.label.netForwardAtr !== null && Number.isFinite(selection.label.netForwardAtr));
  const values = usableSelections.map((selection) => selection.label.netForwardAtr!);
  const positive = values.filter((value) => value > 0);
  const negative = values.filter((value) => value < 0);
  const stressValues = usableSelections.map((selection) => selection.latencyStressLabel.netForwardAtr).filter((value): value is number => value !== null && Number.isFinite(value));
  const byFoldMean = Object.fromEntries(R13_FOLD_IDS.map((foldId) => [foldId, mean(usableSelections.filter((selection) => selection.foldId === foldId).map((selection) => selection.label.netForwardAtr!))])) as Record<ResearchFoldId, number | null>;
  const positiveMeanEdgeFolds = Object.values(byFoldMean).filter((value): value is number => value !== null && value > 0).length;
  const negativeMeanEdgeFolds = Object.values(byFoldMean).filter((value): value is number => value !== null && value < 0).length;
  const catastrophicFolds = Object.values(byFoldMean).filter((value): value is number => value !== null && value <= -0.10).length;
  const byDecisionTime = new Map<string, R13ScoredOpportunity[]>();
  for (const opportunity of opportunities) { const group = byDecisionTime.get(`${opportunity.foldId}|${opportunity.decisionTime}`) ?? []; group.push(opportunity); byDecisionTime.set(`${opportunity.foldId}|${opportunity.decisionTime}`, group); }
  const timestampSpearman = [...byDecisionTime.values()].map((group) => spearman(group.map((value) => value.prediction), group.map((value) => value.label.netForwardAtr!))).filter((value): value is number => value !== null);
  const foldSpearman = R13_FOLD_IDS.map((foldId) => mean([...byDecisionTime.entries()].filter(([key]) => key.startsWith(`${foldId}|`)).map(([, group]) => spearman(group.map((value) => value.prediction), group.map((value) => value.label.netForwardAtr!))).filter((value): value is number => value !== null)));
  const positiveSpearmanFolds = foldSpearman.filter((value) => value !== null && value > 0).length;
  const pooledSpearman = mean(timestampSpearman);
  const decileRows: Array<R13ScoredOpportunity & { decile: number }> = [];
  for (const foldId of R13_FOLD_IDS) {
    const fold = opportunities.filter((opportunity) => opportunity.foldId === foldId).sort((left, right) => left.prediction - right.prediction || left.decisionTime - right.decisionTime || left.symbol.localeCompare(right.symbol) || directionOrder(left.direction) - directionOrder(right.direction));
    for (const [index, opportunity] of fold.entries()) decileRows.push({ ...opportunity, decile: Math.floor(index * 10 / Math.max(1, fold.length)) });
  }
  const deciles = Object.freeze(Array.from({ length: 10 }, (_, decile) => { const group = decileRows.filter((value) => value.decile === decile); return Object.freeze({ decile, count: group.length, meanRealizedNetForwardAtr: mean(group.map((selection) => selection.label.netForwardAtr!)) }); }));
  const spread = deciles[9]!.meanRealizedNetForwardAtr !== null && deciles[0]!.meanRealizedNetForwardAtr !== null ? deciles[9]!.meanRealizedNetForwardAtr - deciles[0]!.meanRealizedNetForwardAtr : null;
  const positiveSpreadFolds = R13_FOLD_IDS.filter((foldId) => { const fold = decileRows.filter((value) => value.foldId === foldId); const bottom = mean(fold.filter((value) => value.decile === 0).map((value) => value.label.netForwardAtr!)); const top = mean(fold.filter((value) => value.decile === 9).map((value) => value.label.netForwardAtr!)); return bottom !== null && top !== null && top - bottom > 0; }).length;
  const drawdown = calculateR13Drawdown(usableSelections.map((selection) => ({ decisionTime: selection.decisionTime, symbol: selection.symbol, direction: selection.direction, netForwardAtr: selection.label.netForwardAtr! })));
  const positiveSelections = usableSelections.filter((selection) => selection.label.netForwardAtr! > 0);
  const totalPositive = positive.reduce((sum, value) => sum + value, 0);
  const symbolContributions = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, positiveSelections.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.label.netForwardAtr!, 0)])) as Record<ResearchSymbol, number>;
  const maxSymbolShare = totalPositive > 0 ? Math.max(...R13_SYMBOLS.map((symbol) => symbolContributions[symbol])) / totalPositive : null;
  const maxSingleShare = totalPositive > 0 ? Math.max(...positive) / totalPositive : null;
  const netBySymbol = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, usableSelections.filter((selection) => selection.symbol === symbol).reduce((sum, selection) => sum + selection.label.netForwardAtr!, 0)])) as Record<ResearchSymbol, number>;
  const netByDirection = { LONG: usableSelections.filter((selection) => selection.direction === "LONG").reduce((sum, selection) => sum + selection.label.netForwardAtr!, 0), SHORT: usableSelections.filter((selection) => selection.direction === "SHORT").reduce((sum, selection) => sum + selection.label.netForwardAtr!, 0) } as const;
  const costStressValues = usableSelections.map((selection) => selection.label.netForwardAtrCostStress).filter((value): value is number => value !== null && Number.isFinite(value));
  const costPositive = costStressValues.filter((value) => value > 0);
  const costNegative = costStressValues.filter((value) => value < 0);
  const monthCounts = new Map<string, number>();
  for (const selection of usableSelections) { const date = new Date(selection.decisionTime); const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1); }
  const monthlyCounts = [...monthCounts.values()];
  const grossPositiveAtr = positiveSelections.reduce((sum, selection) => sum + (selection.label.grossForwardAtr ?? 0), 0);
  const grossNegativeAtrMagnitude = Math.abs(usableSelections.filter((selection) => (selection.label.grossForwardAtr ?? 0) < 0).reduce((sum, selection) => sum + (selection.label.grossForwardAtr ?? 0), 0));
  const metrics: R13HorizonMetrics = Object.freeze({ horizonHours: horizon, selectedValidationObservations: values.length, noTradeDecisionTimestamps: selected.noTrade, totalValidationDecisionTimestamps: selected.timestamps, meanNetForwardAtr: mean(values), medianNetForwardAtr: median(values), meanSelectedSignalsPerMonth: mean(monthlyCounts), medianSelectedSignalsPerMonth: median(monthlyCounts), grossPositiveAtr, grossNegativeAtrMagnitude, totalFeesBps: usableSelections.reduce((sum, selection) => sum + (selection.label.feesBps ?? 0), 0), totalFundingBps: usableSelections.reduce((sum, selection) => sum + (selection.label.fundingBps ?? 0), 0), totalSlippageBps: usableSelections.reduce((sum, selection) => sum + (selection.label.slippageBps ?? 0), 0), atrProfitFactor: negative.length ? positive.reduce((sum, value) => sum + value, 0) / Math.abs(negative.reduce((sum, value) => sum + value, 0)) : null, cumulativeNetForwardAtr: values.reduce((sum, value) => sum + value, 0), maximumDrawdownAtr: drawdown.maximumDrawdownAtr, positiveMeanEdgeFolds, negativeMeanEdgeFolds, catastrophicFolds, positiveSpearmanFolds, pooledSpearman, topBottomDecileSpread: spread, positiveSpreadFolds, crossSectionalOpportunityCount: opportunities.length, crossSectionalOpportunityTimestamps: opportunities.length === 0 ? 0 : new Set(opportunities.map((value) => `${value.foldId}|${value.decisionTime}`)).size, insufficientCrossSectionalTimestamps: selected.insufficientCrossSectionalTimestamps, costStressMean: mean(costStressValues) ?? 0, costStressProfitFactor: costNegative.length ? costPositive.reduce((sum, value) => sum + value, 0) / Math.abs(costNegative.reduce((sum, value) => sum + value, 0)) : null, latencyStressMean: mean(stressValues) ?? 0, maximumPositiveSymbolContributionShare: maxSymbolShare, maximumSinglePositiveObservationContribution: maxSingleShare, byFoldMeanNetForwardAtr: Object.freeze(byFoldMean), bySymbolNetForwardAtr: Object.freeze(netBySymbol), byDirectionNetForwardAtr: Object.freeze(netByDirection), deciles });
  const gateEvaluation = evaluateR13HorizonGates({ horizonHours: horizon, selectedValidationObservationsAggregate: metrics.selectedValidationObservations, selectedValidationObservationsByFold: gateCountByFold(usableSelections, (value) => value.label.netForwardAtr), meanNetForwardAtr: metrics.meanNetForwardAtr ?? Number.NEGATIVE_INFINITY, atrProfitFactor: metrics.atrProfitFactor, positiveMeanEdgeFolds, catastrophicFolds, positiveSpearmanFolds, pooledSpearman, topBottomDecileSpread: spread, positiveSpreadFolds, costStressMean: metrics.costStressMean, costStressProfitFactor: metrics.costStressProfitFactor, latencyStressMean: metrics.latencyStressMean, maximumPositiveSymbolContributionShare: maxSymbolShare, maximumSinglePositiveObservationContribution: maxSingleShare, evidenceIntegrity, modelProvenance: provenance.every((value) => value.status === "FIT") });
  return Object.freeze({ horizonHours: horizon, metrics, gateEvaluation, modelProvenance: provenance });
}

function fitModels(observations: readonly R13Observation[], horizon: R13HorizonHours): Readonly<{ models: Readonly<Record<ResearchFoldId, R13RidgeModel | null>>; provenance: R13HorizonPerformance["modelProvenance"] }> {
  const models = {} as Record<ResearchFoldId, R13RidgeModel | null>; const provenance: Array<R13HorizonPerformance["modelProvenance"][number]> = [];
  for (const foldId of R13_FOLD_IDS) {
    const validationRange = getResearchFoldRoleRange(foldId, "VALIDATION");
    const examples = observations.filter((observation) => foldRole(observation, foldId, "RESEARCH") && isR13TrainingObservationPurgeSafe({ decisionTime: observation.decisionTime, validationStartTime: validationRange.startTime }) && observation.labels[horizon].status === "EXECUTED").map((observation) => ({ features: observation.features, targetNetForwardAtr: observation.labels[horizon].netForwardAtr! }));
    if (examples.length < 19) { models[foldId] = null; provenance.push(Object.freeze({ foldId, status: "INSUFFICIENT_RESEARCH_EXAMPLES", trainingExamples: examples.length, modelIdentitySha256: null, standardizationIdentitySha256: null, lambda: 10, coefficientHash: null })); continue; }
    const model = fitR13RidgeModel(examples); models[foldId] = model; provenance.push(Object.freeze({ foldId, status: "FIT", trainingExamples: examples.length, modelIdentitySha256: model.modelIdentitySha256, standardizationIdentitySha256: model.standardization.identitySha256, lambda: 10, coefficientHash: hash(model.coefficients) }));
  }
  return Object.freeze({ models: Object.freeze(models), provenance: Object.freeze(provenance) });
}

export function evaluateR13Discovery(observations: readonly R13Observation[], datasetFreeze: Readonly<Record<string, unknown>>, executionSourceSha: string, conformance: R13SpecConformanceReport, universeDiagnostics?: Pick<R13ObservationUniverseReport, "totalCanonicalDecisionTimestamps" | "warmupExcludedObservations" | "eligibleObservations" | "integrityExcludedObservations">): R13PerformanceReport {
  const horizonResults: R13HorizonPerformance[] = [];
  const diagnostics = universeDiagnostics ?? { totalCanonicalDecisionTimestamps: new Set(observations.map((observation) => observation.decisionTime)).size, warmupExcludedObservations: 0, eligibleObservations: observations.length, integrityExcludedObservations: 0 };
  for (const horizon of R13_HORIZON_HOURS) { const fitted = fitModels(observations, horizon); horizonResults.push(metricForHorizon(observations, fitted.models, fitted.provenance, horizon, diagnostics.integrityExcludedObservations === 0)); }
  const candidates: R13HorizonSelectionCandidate[] = horizonResults.map((result) => ({ horizonHours: result.horizonHours, eligible: result.gateEvaluation.eligibility === "ELIGIBLE", meanNetForwardAtr: result.metrics.meanNetForwardAtr ?? Number.NEGATIVE_INFINITY, costStressMean: result.metrics.costStressMean, maximumDrawdownAtr: result.metrics.maximumDrawdownAtr, atrProfitFactor: result.metrics.atrProfitFactor ?? Number.NEGATIVE_INFINITY }));
  const selection = selectR13Horizon(candidates);
  return Object.freeze({ schemaVersion: M3_R13_REPORT_SCHEMA_VERSION, researchRoundId: M3_R13_RESEARCH_ROUND_ID, executionSourceSha, acceptedSourceSha: M3_R13_ACCEPTED_R11_SOURCE_SHA, selectionGateSha256: R13_SELECTION_GATE_SHA256, experimentPlanSha256: R13_PLAN_SHA256, strategyVersion: "baseline-001", backtestPolicyVersion: M3_R13_POLICY_VERSION, dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA", researchUniverse: M3_R13_RESEARCH_RANGE, researchBoundary: M3_R13_RESEARCH_END_ISO, performanceLock: M3_R13_PERFORMANCE_LOCK, performanceLockTriggered: true, performanceExecutionCount: 1, performanceLifecycle: "PERFORMANCE_LOCKED", datasetFreeze, conformance, observationCounts: { all: observations.length, byHorizon: Object.freeze(Object.fromEntries(R13_HORIZON_HOURS.map((horizon) => [horizon, observations.filter((observation) => observation.labels[horizon].status === "EXECUTED").length])) as Record<R13HorizonHours, number>), ...diagnostics }, horizons: Object.freeze(horizonResults), selection, baseline002Status: "NOT_FROZEN", m3JStatus: "BLOCKED", m4Status: "NOT_STARTED", privateBinanceApi: false, automaticTrading: false });
}

function renderResults(report: R13PerformanceReport): string { const lines = [`# M3-R13 Round-013 Forward Edge Discovery`, ``, `- researchRoundId: ${report.researchRoundId}`, `- executionSourceSha: ${report.executionSourceSha}`, `- dataClassification: ${report.dataClassification}`, `- researchBoundary: ${report.researchBoundary}`, `- primary execution delay: 6 minutes`, `- latency stress: 7 minutes`, `- performanceLock: ${report.performanceLock}`, `- performanceExecutionCount: ${report.performanceExecutionCount}`, ``, `| horizon | selected | mean net ATR | PF | max DD ATR | gates |`, `| --- | ---: | ---: | ---: | ---: | --- |`]; for (const result of report.horizons) lines.push(`| H${result.horizonHours} | ${result.metrics.selectedValidationObservations} | ${result.metrics.meanNetForwardAtr ?? "null"} | ${result.metrics.atrProfitFactor ?? "null"} | ${result.metrics.maximumDrawdownAtr} | ${result.gateEvaluation.eligibility} |`); lines.push(``, `- finalDecision: ${report.selection.finalDecision}`, `- selectedDiscoveryHorizon: ${report.selection.selectedDiscoveryHorizon ?? "null"}`, `- baseline002Status: ${report.baseline002Status}`, `- m3JStatus: ${report.m3JStatus}`, `- m4Status: ${report.m4Status}`, `- privateBinanceApi: ${report.privateBinanceApi}`, `- automaticTrading: ${report.automaticTrading}`); return lines.join("\n"); }
function selectionMarkdown(report: R13PerformanceReport): string { return [`# Round-013 Selection`, ``, `- eligibleDiscoveryHorizons: ${report.selection.eligibleDiscoveryHorizons.join(", ") || "none"}`, `- selectedDiscoveryHorizon: ${report.selection.selectedDiscoveryHorizon ?? "null"}`, `- finalDecision: ${report.selection.finalDecision}`, `- selectionAlgorithmApplied: ${report.selection.selectionAlgorithmApplied}`, `- result is only a ROUND-014_DESIGN_INPUT; it is not a Production strategy.`].join("\n"); }

export function buildR13ExecutionArtifacts(report: R13PerformanceReport): R13ExecutionArtifacts {
  const summaryJson = stableStringify(report);
  const resultsMarkdown = renderResults(report);
  const selection = { schemaVersion: "m3-r13-round-013-selection-001", researchRoundId: report.researchRoundId, executionSourceSha: report.executionSourceSha, selectionGateSha256: report.selectionGateSha256, experimentPlanSha256: report.experimentPlanSha256, performanceLock: report.performanceLock, evidenceStatus: "COMPLETE", eligibleDiscoveryHorizons: report.selection.eligibleDiscoveryHorizons, selectedDiscoveryHorizon: report.selection.selectedDiscoveryHorizon, selectionAlgorithmApplied: report.selection.selectionAlgorithmApplied, finalDecision: report.selection.finalDecision, baseline002Status: report.baseline002Status, m3JStatus: report.m3JStatus, m4Status: report.m4Status };
  const selectionJson = stableStringify(selection);
  const selectionMarkdownText = selectionMarkdown(report);
  const audit = { schemaVersion: M3_R13_AUDIT_SCHEMA_VERSION, execution: { executionSourceSha: report.executionSourceSha, performanceLock: report.performanceLock, controlRuns: 1, horizonModelRuns: report.horizons.length * R13_FOLD_IDS.length, selectionRuns: 1, privateBinanceApi: false, automaticTrading: false }, observations: report.observationCounts, horizons: report.horizons.map((result) => ({ horizonHours: result.horizonHours, gateResults: result.gateEvaluation.gateResults, modelProvenance: result.modelProvenance })), exactUtf8ArtifactSha256: { summary: byteHash(summaryJson), results: byteHash(resultsMarkdown), selectionJson: byteHash(selectionJson), selectionMarkdown: byteHash(selectionMarkdownText) } };
  return Object.freeze({ report, auditJson: stableStringify(audit), summaryJson, resultsMarkdown, selectionJson, selectionMarkdown: selectionMarkdownText });
}

export function r13OutputPaths(root = process.cwd()): readonly string[] { return M3_R13_OUTPUT_PATHS.map((relative) => path.join(root, relative)); }
export function existingR13OutputArtifacts(root = process.cwd()): readonly string[] { return Object.freeze(r13OutputPaths(root).filter((filePath) => existsSync(filePath))); }

export function publishR13ArtifactsAtomically(input: Readonly<{ artifacts: R13ExecutionArtifacts; root?: string }>): void {
  const root = path.resolve(input.root ?? process.cwd());
  const outputPaths = r13OutputPaths(root);
  if (outputPaths.some((target) => existsSync(target))) throw new Error("R13 output already exists; refusing overwrite.");
  const byName = new Map(outputPaths.map((target, index) => [path.basename(target), [target, [input.artifacts.summaryJson, input.artifacts.auditJson, input.artifacts.resultsMarkdown, input.artifacts.selectionJson, input.artifacts.selectionMarkdown][index]!] as const]));
  const publication = ["M3_R13_ROUND_013_AUDIT.json", "M3_R13_ROUND_013_RESULTS.md", "M3_R13_ROUND_013_SELECTION.json", "M3_R13_ROUND_013_SELECTION.md", "M3_R13_ROUND_013_SUMMARY.json"].map((name) => byName.get(name)!);
  const stagingParent = path.dirname(outputPaths[0]!);
  mkdirSync(stagingParent, { recursive: true });
  const staging = mkdtempSync(path.join(stagingParent, ".m3-r13-round-013-staging-"));
  const published: string[] = [];
  try {
    for (const [target, payload] of publication) writeFileSync(path.join(staging, path.basename(target)), payload, "utf8");
    for (const [target] of publication) {
      if (existsSync(target)) throw new Error(`R13 output appeared during publication: ${target}`);
      renameSync(path.join(staging, path.basename(target)), target);
      published.push(target);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const target of [...published].reverse()) try { unlinkSync(target); } catch (rollbackError) { rollbackErrors.push(`${target}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); }
    try { rmSync(staging, { recursive: true, force: true }); } catch (cleanupError) { rollbackErrors.push(`staging: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`); }
    const primary = error instanceof Error ? error : new Error(String(error));
    if (rollbackErrors.length) primary.message = `${primary.message}; rollback failures: ${rollbackErrors.join("; ")}`;
    throw primary;
  }
  rmSync(staging, { recursive: true, force: true });
}

export function r13ArtifactSizes(root = process.cwd()): readonly Readonly<{ filePath: string; bytes: number }>[] { return Object.freeze(r13OutputPaths(root).map((filePath) => Object.freeze({ filePath, bytes: statSync(filePath).size }))); }

export { validateR13Plan, readR13SpecConformance, M3_R13_ACCEPTED_R11_SOURCE_SHA, M3_R13_NO_EDGE_OUTCOME };
