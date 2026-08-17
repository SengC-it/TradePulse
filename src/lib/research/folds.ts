import { RESEARCH_FOLD_IDS, RESEARCH_FOLD_ROLES, type ResearchFoldId, type ResearchFoldRole } from "./constants.ts";
import type { NormalizedResearchSignal, ResearchFold, ResearchRange } from "./types.ts";
import { deepFreeze, requireFiniteNumber, requireSafeTimestamp } from "./utils.ts";

const DAY_MS = 24 * 60 * 60 * 1_000;

function utc(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isSafeInteger(timestamp)) throw new Error(`Invalid frozen UTC boundary: ${value}`);
  return timestamp;
}

function range(start: string, end: string): ResearchRange {
  return Object.freeze({ startTime: utc(start), endTime: utc(end) });
}

export const RESEARCH_FOLDS: Readonly<Record<ResearchFoldId, ResearchFold>> = deepFreeze({
  F1: {
    foldId: "F1",
    research: range("2023-01-01T00:00:00.000Z", "2023-12-31T23:59:59.999Z"),
    validation: range("2024-01-01T00:00:00.000Z", "2024-06-30T23:59:59.999Z"),
  },
  F2: {
    foldId: "F2",
    research: range("2023-01-01T00:00:00.000Z", "2024-06-30T23:59:59.999Z"),
    validation: range("2024-07-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z"),
  },
  F3: {
    foldId: "F3",
    research: range("2023-01-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z"),
    validation: range("2025-01-01T00:00:00.000Z", "2025-06-30T23:59:59.999Z"),
  },
  F4: {
    foldId: "F4",
    research: range("2023-01-01T00:00:00.000Z", "2025-06-30T23:59:59.999Z"),
    validation: range("2025-07-01T00:00:00.000Z", "2025-12-31T23:59:59.999Z"),
  },
  F5: {
    foldId: "F5",
    research: range("2023-01-01T00:00:00.000Z", "2025-12-31T23:59:59.999Z"),
    validation: range("2026-01-01T00:00:00.000Z", "2026-03-31T23:59:59.999Z"),
  },
  F6: {
    foldId: "F6",
    research: range("2023-01-01T00:00:00.000Z", "2026-03-31T23:59:59.999Z"),
    validation: range("2026-04-01T00:00:00.000Z", "2026-08-15T23:59:59.999Z"),
  },
});

export function getResearchFold(foldId: ResearchFoldId): ResearchFold {
  const fold = RESEARCH_FOLDS[foldId];
  if (!fold) throw new Error(`Unknown research fold: ${String(foldId)}.`);
  return fold;
}

export function validateResearchRange(input: ResearchRange): ResearchRange {
  requireSafeTimestamp(input.startTime, "Research range startTime");
  requireSafeTimestamp(input.endTime, "Research range endTime");
  if (input.endTime < input.startTime) throw new Error("Research range endTime must not precede startTime.");
  return Object.freeze({ startTime: input.startTime, endTime: input.endTime });
}

export function utcCalendarDayCount(input: ResearchRange): number {
  const rangeValue = validateResearchRange(input);
  const startDate = new Date(rangeValue.startTime);
  const endDate = new Date(rangeValue.endTime);
  const startUtcDay = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const endUtcDay = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const days = (endUtcDay - startUtcDay) / DAY_MS + 1;
  requireFiniteNumber(days, "UTC calendar-day count");
  if (!Number.isInteger(days) || days <= 0) throw new Error("UTC calendar-day count is invalid.");
  return days;
}

export function isSignalTimeInFoldRange(
  signalTime: number,
  foldId: ResearchFoldId,
  role: ResearchFoldRole,
): boolean {
  requireSafeTimestamp(signalTime, "signalTime");
  if (!RESEARCH_FOLD_IDS.includes(foldId)) throw new Error(`Unknown research fold: ${String(foldId)}.`);
  if (!RESEARCH_FOLD_ROLES.includes(role)) throw new Error(`Unknown research fold role: ${String(role)}.`);
  const selectedRange = getResearchFold(foldId)[role === "RESEARCH" ? "research" : "validation"];
  return signalTime >= selectedRange.startTime && signalTime <= selectedRange.endTime;
}

export function selectRecordsForFoldRole<T extends Pick<NormalizedResearchSignal, "signalTime">>(
  records: readonly T[],
  foldId: ResearchFoldId,
  role: ResearchFoldRole,
): readonly T[] {
  return Object.freeze(records.filter((record) => isSignalTimeInFoldRange(record.signalTime, foldId, role)));
}
