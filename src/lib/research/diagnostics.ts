import {
  RESEARCH_BTC_REGIME_ORDER,
  RESEARCH_DIRECTION_ORDER,
  RESEARCH_GRADE_ORDER,
  RESEARCH_SIGNAL_STATUSES,
  RESEARCH_SYMBOL_ORDER,
  RESEARCH_SYMBOL_REGIME_ORDER,
  type ResearchSignalStatus,
} from "./constants.ts";
import type {
  NormalizedResearchSignal,
  ResearchDiagnostics,
  ResearchGroupMetrics,
  ResearchRange,
} from "./types.ts";
import { utcCalendarDayCount, validateResearchRange } from "./folds.ts";
import { deepFreeze, requireFiniteNumber, requireSafeTimestamp } from "./utils.ts";

const HOUR_MS = 60 * 60 * 1_000;

export class ResearchDiagnosticsError extends Error {
  public readonly name = "ResearchDiagnosticsError";
}

function fail(message: string): never {
  throw new ResearchDiagnosticsError(message);
}

function requireFiniteOrNull(value: number | null, label: string): void {
  if (value !== null) requireFiniteNumber(value, label);
}

function symbolIndex(symbol: string): number {
  return RESEARCH_SYMBOL_ORDER.indexOf(symbol as (typeof RESEARCH_SYMBOL_ORDER)[number]);
}

function directionIndex(direction: string): number {
  return RESEARCH_DIRECTION_ORDER.indexOf(direction as (typeof RESEARCH_DIRECTION_ORDER)[number]);
}

function canonicalRecordCompare(left: NormalizedResearchSignal, right: NormalizedResearchSignal): number {
  const symbolDifference = symbolIndex(left.symbol) - symbolIndex(right.symbol);
  if (symbolDifference !== 0) return symbolDifference;
  const directionDifference = directionIndex(left.direction) - directionIndex(right.direction);
  if (directionDifference !== 0) return directionDifference;
  return left.signalTime - right.signalTime;
}

function formalIdentity(record: NormalizedResearchSignal): string {
  return `${record.symbol}|${record.direction}|${record.signalTime}`;
}

function utcMonthAndYear(timestamp: number): Readonly<{ month: string; year: string }> {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) fail(`signalTime ${timestamp} is outside the supported UTC date range.`);
  return { month: date.toISOString().slice(0, 7), year: date.toISOString().slice(0, 4) };
}

function validateResearchRecord(record: NormalizedResearchSignal): void {
  requireSafeTimestamp(record.signalTime, "Research signal signalTime");
  if (!RESEARCH_SYMBOL_ORDER.includes(record.symbol)) fail(`Unsupported research symbol: ${record.symbol}.`);
  if (!RESEARCH_DIRECTION_ORDER.includes(record.direction)) fail(`Unsupported research direction: ${record.direction}.`);
  if (!RESEARCH_SIGNAL_STATUSES.includes(record.status as ResearchSignalStatus)) {
    fail(`Unsupported research signal status: ${record.status}.`);
  }
  if (!RESEARCH_BTC_REGIME_ORDER.includes(record.btcRegime)) fail(`Unsupported BTC regime: ${record.btcRegime}.`);
  if (!RESEARCH_SYMBOL_REGIME_ORDER.includes(record.symbolRegime)) {
    fail(`Unsupported symbol regime: ${record.symbolRegime}.`);
  }
  if (record.grade !== null && !RESEARCH_GRADE_ORDER.includes(record.grade)) fail(`Unsupported signal grade: ${record.grade}.`);
  requireFiniteNumber(record.totalScore, "Research signal totalScore");
  for (const [label, value] of [
    ["entryTime", record.entryTime],
    ["exitTime", record.exitTime],
  ] as const) {
    if (value !== null) requireSafeTimestamp(value, `Research signal ${label}`);
  }
  for (const [label, value] of [
    ["grossR", record.grossR],
    ["feeR", record.feeR],
    ["fundingR", record.fundingR],
    ["netR", record.netR],
  ] as const) requireFiniteOrNull(value, `Research signal ${label}`);
  if (record.status === "EXECUTED" && [record.grossR, record.feeR, record.fundingR, record.netR].some((value) => value === null)) {
    fail("Executed research records require finite grossR, feeR, fundingR, and netR.");
  }
}

export function validateAndCanonicalizeResearchRecords(
  records: readonly NormalizedResearchSignal[],
): readonly NormalizedResearchSignal[] {
  const identities = new Set<string>();
  for (const record of records) {
    validateResearchRecord(record);
    const identity = formalIdentity(record);
    if (identities.has(identity)) fail(`Duplicate formal research identity: ${identity}.`);
    identities.add(identity);
  }
  return Object.freeze([...records].sort(canonicalRecordCompare));
}

function groupMetrics(records: readonly NormalizedResearchSignal[]): ResearchGroupMetrics {
  const executed = records.filter((record) => record.status === "EXECUTED");
  const netValues = executed.map((record) => record.netR!);
  const positive = netValues.filter((value) => value > 0);
  const negative = netValues.filter((value) => value < 0);
  const positiveR = positive.reduce((sum, value) => sum + value, 0);
  const negativeR = Math.abs(negative.reduce((sum, value) => sum + value, 0));
  const netR = netValues.reduce((sum, value) => sum + value, 0);
  const grossR = executed.reduce((sum, record) => sum + record.grossR!, 0);
  const feeR = executed.reduce((sum, record) => sum + record.feeR!, 0);
  const fundingR = executed.reduce((sum, record) => sum + record.fundingR!, 0);
  const expectancyR = executed.length === 0 ? null : netR / executed.length;
  const profitFactorStatus = executed.length === 0 ? "NO_TRADES" : negativeR === 0 ? "NO_LOSSES" : "NORMAL";
  const profitFactor = profitFactorStatus === "NORMAL" ? positiveR / negativeR : null;
  const winRate = executed.length === 0 ? null : positive.length / executed.length;
  return deepFreeze({
    formalSignals: records.length,
    executedTrades: executed.length,
    grossR,
    feeR,
    fundingR,
    netR,
    expectancyR,
    profitFactor,
    profitFactorStatus,
    winRate,
  });
}

function fixedBreakdown<K extends string>(
  records: readonly NormalizedResearchSignal[],
  keys: readonly K[],
  keyOf: (record: NormalizedResearchSignal) => K,
): Readonly<Record<K, ResearchGroupMetrics>> {
  const grouped = Object.fromEntries(keys.map((key) => [key, [] as NormalizedResearchSignal[]])) as Record<K, NormalizedResearchSignal[]>;
  for (const record of records) grouped[keyOf(record)]!.push(record);
  return deepFreeze(Object.fromEntries(keys.map((key) => [key, groupMetrics(grouped[key]!)]))) as Readonly<Record<K, ResearchGroupMetrics>>;
}

function dynamicBreakdown(
  records: readonly NormalizedResearchSignal[],
  keyOf: (record: NormalizedResearchSignal) => string,
): Readonly<Record<string, ResearchGroupMetrics>> {
  const keys = [...new Set(records.map(keyOf))].sort((left, right) => left.localeCompare(right));
  return fixedBreakdown(records, keys, keyOf);
}

function repeatCount(records: readonly NormalizedResearchSignal[], windowMs: number): number {
  return records.filter((current) =>
    records.some((earlier) =>
      earlier !== current &&
      earlier.symbol === current.symbol &&
      earlier.direction === current.direction &&
      0 < current.signalTime - earlier.signalTime &&
      current.signalTime - earlier.signalTime <= windowMs,
    ),
  ).length;
}

function hasResearchHorizonOverlap(left: NormalizedResearchSignal, right: NormalizedResearchSignal): boolean {
  if (left.symbol !== right.symbol || left.direction !== right.direction) return false;
  const leftStart = left.signalTime + 1;
  const leftEnd = leftStart + 24 * HOUR_MS - 1;
  const rightStart = right.signalTime + 1;
  const rightEnd = rightStart + 24 * HOUR_MS - 1;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function overlapCount(records: readonly NormalizedResearchSignal[]): number {
  return records.filter((record, index) =>
    records.some((other, otherIndex) => otherIndex !== index && hasResearchHorizonOverlap(record, other)),
  ).length;
}

function assertFiniteDiagnosticNumbers(value: unknown, path = "diagnostics"): void {
  if (typeof value === "number") {
    requireFiniteNumber(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertFiniteDiagnosticNumbers(child, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object" && value !== null) {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
      assertFiniteDiagnosticNumbers(child, `${path}.${key}`),
    );
  }
}

export function calculateResearchDiagnostics(input: Readonly<{
  records: readonly NormalizedResearchSignal[];
  range: ResearchRange;
}>): ResearchDiagnostics {
  const range = validateResearchRange(input.range);
  const records = validateAndCanonicalizeResearchRecords(input.records);
  const overall = groupMetrics(records);
  const days = utcCalendarDayCount(range);
  const positiveBySymbol = new Map<string, number>();
  for (const record of records) {
    if (record.status === "EXECUTED" && record.netR! > 0) {
      positiveBySymbol.set(record.symbol, (positiveBySymbol.get(record.symbol) ?? 0) + record.netR!);
    }
  }
  const totalPositiveNetR = [...positiveBySymbol.values()].reduce((sum, value) => sum + value, 0);
  const topSymbolPositive = Math.max(0, ...positiveBySymbol.values());
  const positiveTrades = records.filter((record) => record.status === "EXECUTED" && record.netR! > 0).map((record) => record.netR!);
  const largestSinglePositive = Math.max(0, ...positiveTrades);
  const signalsPerSymbol = Object.fromEntries(
    RESEARCH_SYMBOL_ORDER.map((symbol) => [symbol, records.filter((record) => record.symbol === symbol).length]),
  ) as Record<(typeof RESEARCH_SYMBOL_ORDER)[number], number>;
  const uniqueSignalHoursBySymbol = Object.fromEntries(
    RESEARCH_SYMBOL_ORDER.map((symbol) => [symbol, new Set(records.filter((record) => record.symbol === symbol).map((record) => record.signalTime)).size]),
  ) as Record<(typeof RESEARCH_SYMBOL_ORDER)[number], number>;
  const byGradeKey = (record: NormalizedResearchSignal): string => record.grade ?? "UNGRADED";
  const byMonthKey = (record: NormalizedResearchSignal): string => utcMonthAndYear(record.signalTime).month;
  const byYearKey = (record: NormalizedResearchSignal): string => utcMonthAndYear(record.signalTime).year;
  const result: ResearchDiagnostics = {
    range,
    utcCalendarDays: days,
    formalSignals: records.length,
    executedTrades: overall.executedTrades,
    signalsPerDay: records.length / days,
    signalsPerSymbol: signalsPerSymbol,
    uniqueSignalHours: new Set(records.map((record) => record.signalTime)).size,
    uniqueSignalHoursBySymbol,
    repeatSignalsWithin6h: repeatCount(records, 6 * HOUR_MS),
    repeatSignalsWithin12h: repeatCount(records, 12 * HOUR_MS),
    repeatSignalsWithin24h: repeatCount(records, 24 * HOUR_MS),
    overlappingSignalCount: overlapCount(records),
    overlappingSignalRate: records.length === 0 ? null : overlapCount(records) / records.length,
    grossR: overall.grossR,
    feeR: overall.feeR,
    fundingR: overall.fundingR,
    netR: overall.netR,
    netRPerExecutedSignal: overall.executedTrades === 0 ? null : overall.netR / overall.executedTrades,
    profitFactor: overall.profitFactor,
    profitFactorStatus: overall.profitFactorStatus,
    expectancyR: overall.expectancyR,
    winRate: overall.winRate,
    feeBurdenRatio: overall.executedTrades > 0 && overall.grossR !== 0 ? overall.feeR / Math.abs(overall.grossR) : null,
    totalPositiveNetR,
    topSymbolShareOfPositiveNetR: totalPositiveNetR === 0 ? null : topSymbolPositive / totalPositiveNetR,
    largestSingleTradeShareOfPositiveNetR: totalPositiveNetR === 0 ? null : largestSinglePositive / totalPositiveNetR,
    bySymbol: fixedBreakdown(records, RESEARCH_SYMBOL_ORDER, (record) => record.symbol),
    byDirection: fixedBreakdown(records, RESEARCH_DIRECTION_ORDER, (record) => record.direction),
    byGrade: fixedBreakdown(records, RESEARCH_GRADE_ORDER, byGradeKey),
    byBtcRegime: fixedBreakdown(records, RESEARCH_BTC_REGIME_ORDER, (record) => record.btcRegime),
    bySymbolRegime: fixedBreakdown(records, RESEARCH_SYMBOL_REGIME_ORDER, (record) => record.symbolRegime),
    byUtcSignalMonth: dynamicBreakdown(records, byMonthKey),
    byUtcSignalYear: dynamicBreakdown(records, byYearKey),
  };
  assertFiniteDiagnosticNumbers(result);
  return deepFreeze(result);
}

export const calculateResearchMetrics = calculateResearchDiagnostics;
