import type { BacktestReport } from "./types.ts";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value), null, 2) + "\n";
}

export function serializeBacktestReport(report: BacktestReport): string {
  return stableStringify(report);
}

export const serializeReport = serializeBacktestReport;
