import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";

import { BinanceReviewMarketDataProvider } from "./market-data.ts";
import { createSignalReviewStore } from "./store.ts";
import {
  REVIEW_ONE_MINUTE_MS,
  type ReviewAdvisory,
  type ReviewState,
  type SignalReviewRunDependencies,
  type SignalReviewRunResult,
} from "./types.ts";
import { evaluateReview } from "./engine.ts";

const REVIEW_LEASE_MS = 10 * 60 * 1000;

function localDateKey(value: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildDailyReviewRunKey(value: number, timeZone = "Asia/Shanghai"): string {
  return `daily-review:${localDateKey(value, timeZone)}`;
}

function isoAt(value: number): string {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw new Error("Signal review timestamp is invalid.");
  }
  return result.toISOString();
}

function parsedTimestamp(value: string, field: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) {
    throw new Error("Signal review " + field + " is invalid.");
  }
  return result;
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) {
      return code;
    }
  }
  return "REVIEW_RUNTIME_FAILURE";
}

function stateChanged(before: ReviewState, after: ReviewState): boolean {
  return (
    before.status !== after.status ||
    before.entryCandleTime !== after.entryCandleTime ||
    before.exitCandleTime !== after.exitCandleTime ||
    before.exitReference !== after.exitReference ||
    before.resultR !== after.resultR ||
    before.lastEvaluatedCandleTime !== after.lastEvaluatedCandleTime ||
    before.reason !== after.reason
  );
}

type ReviewRange = Readonly<{ startTime: number; endTime: number }>;

function reviewRange(
  advisory: ReviewAdvisory,
  state: ReviewState,
  serverTime: number,
): ReviewRange | null {
  const validUntil = parsedTimestamp(advisory.signalValidUntil, "signalValidUntil");
  const sentAt = parsedTimestamp(advisory.sentAt, "sentAt");
  const trackingStart = Math.ceil(sentAt / REVIEW_ONE_MINUTE_MS) * REVIEW_ONE_MINUTE_MS;

  if (state.status === "WAITING_ENTRY") {
    const startTime = state.lastEvaluatedCandleTime
      ? parsedTimestamp(state.lastEvaluatedCandleTime, "lastEvaluatedCandleTime") + REVIEW_ONE_MINUTE_MS
      : trackingStart;
    const endTime = Math.min(validUntil, serverTime - 1);
    return endTime >= startTime ? { startTime, endTime } : null;
  }

  if (state.status === "OPEN") {
    if (!state.entryCandleTime) {
      throw new Error("Signal review OPEN state has no entry candle.");
    }
    const entryTime = parsedTimestamp(state.entryCandleTime, "entryCandleTime");
    const startTime = state.lastEvaluatedCandleTime
      ? parsedTimestamp(state.lastEvaluatedCandleTime, "lastEvaluatedCandleTime") + REVIEW_ONE_MINUTE_MS
      : entryTime + REVIEW_ONE_MINUTE_MS;
    const endTime = serverTime - 1;
    return endTime >= startTime ? { startTime, endTime } : null;
  }

  return null;
}

function combineRanges(
  ranges: ReadonlyMap<ResearchSymbol, ReviewRange>,
): ReadonlyMap<ResearchSymbol, ReviewRange> {
  const combined = new Map<ResearchSymbol, ReviewRange>();
  for (const [symbol, range] of ranges) {
    const existing = combined.get(symbol);
    combined.set(symbol, existing
      ? {
          startTime: Math.min(existing.startTime, range.startTime),
          endTime: Math.max(existing.endTime, range.endTime),
        }
      : range);
  }
  return combined;
}

export async function runDailySignalReview(input: Readonly<{
  dependencies: SignalReviewRunDependencies;
  scheduledFor?: Date | string;
}>): Promise<SignalReviewRunResult> {
  const dependencies = input.dependencies;
  const now = dependencies.now ?? Date.now;
  const nowMs = now();
  if (!Number.isFinite(nowMs)) {
    throw new Error("Signal review clock is invalid.");
  }

  const timeZone = dependencies.timeZone ?? "Asia/Shanghai";
  const scheduledDate = new Date(input.scheduledFor ?? nowMs);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("scheduledFor must be a valid date");
  }

  const runKey = buildDailyReviewRunKey(nowMs, timeZone);
  const nowIso = isoAt(nowMs);
  const claim = await dependencies.store.claimDailyReviewRun({
    runKey,
    scheduledFor: scheduledDate.toISOString(),
    now: nowIso,
    leaseExpiresAt: isoAt(nowMs + REVIEW_LEASE_MS),
  });

  if (claim.action !== "RUN") {
    return {
      ok: true,
      outcome: "SKIPPED",
      runKey,
      considered: 0,
      created: 0,
      updated: 0,
      resolved: 0,
      errors: [],
    };
  }

  const errors: string[] = [];
  let considered = 0;
  let created = 0;
  let updated = 0;
  let resolved = 0;

  try {
    const advisories = await dependencies.store.loadSentAdvisories();
    considered = advisories.length;
    created = await dependencies.store.ensureReviewRows(advisories);
    const advisoriesById = new Map(advisories.map((advisory) => [advisory.signalId, advisory]));
    const activeReviews = await dependencies.store.loadActiveReviews();
    const serverTime = activeReviews.length > 0
      ? await dependencies.marketData.getServerTime()
      : nowMs;
    const requestedRanges = new Map<ResearchSymbol, ReviewRange>();

    for (const state of activeReviews) {
      const advisory = advisoriesById.get(state.signalId);
      if (!advisory) {
        errors.push("ADVISORY_NOT_FOUND");
        continue;
      }
      const range = reviewRange(advisory, state, serverTime);
      if (range) {
        if (!(RESEARCH_SYMBOLS as readonly string[]).includes(advisory.symbol)) {
          errors.push("REVIEW_SYMBOL_NOT_APPROVED");
          continue;
        }
        const current = requestedRanges.get(advisory.symbol);
        requestedRanges.set(advisory.symbol, current
          ? {
              startTime: Math.min(current.startTime, range.startTime),
              endTime: Math.max(current.endTime, range.endTime),
            }
          : range);
      }
    }

    const ranges = combineRanges(requestedRanges);
    const candlesBySymbol = new Map<ResearchSymbol, Awaited<ReturnType<SignalReviewRunDependencies["marketData"]["getClosedCandles"]>>>();
    for (const [symbol, range] of ranges) {
      try {
        candlesBySymbol.set(
          symbol,
          await dependencies.marketData.getClosedCandles(symbol, range.startTime, range.endTime, serverTime),
        );
      } catch (error) {
        errors.push(errorCode(error));
      }
    }

    for (const state of activeReviews) {
      const advisory = advisoriesById.get(state.signalId);
      if (!advisory) {
        continue;
      }
      const candles = candlesBySymbol.get(advisory.symbol) ?? [];
      try {
        const next = evaluateReview({ advisory, state, candles, now: serverTime });
        if (stateChanged(state, next)) {
          await dependencies.store.saveReviewState(next, isoAt(serverTime));
          updated += 1;
          if (next.status !== "WAITING_ENTRY" && next.status !== "OPEN") {
            resolved += 1;
          }
        }
      } catch (error) {
        errors.push(errorCode(error));
      }
    }

    const status = errors.length > 0 ? "PARTIAL" : "SUCCEEDED";
    await dependencies.store.completeDailyReviewRun({
      runId: claim.runId,
      status,
      advisoriesConsidered: considered,
      reviewsCreated: created,
      reviewsUpdated: updated,
      reviewsResolved: resolved,
      ...(errors.length > 0 ? { errorCode: errors[0] } : {}),
      completedAt: isoAt(nowMs),
    });

    return {
      ok: errors.length === 0,
      outcome: status,
      runKey,
      considered,
      created,
      updated,
      resolved,
      errors,
    };
  } catch (error) {
    const code = errorCode(error);
    try {
      await dependencies.store.completeDailyReviewRun({
        runId: claim.runId,
        status: "FAILED",
        advisoriesConsidered: considered,
        reviewsCreated: created,
        reviewsUpdated: updated,
        reviewsResolved: resolved,
        errorCode: code,
        completedAt: isoAt(nowMs),
      });
    } catch {
      // Preserve the original bounded failure; the run remains observable by its lease.
    }
    return {
      ok: false,
      outcome: "FAILED",
      runKey,
      considered,
      created,
      updated,
      resolved,
      errors: [code],
    };
  }
}

export function createDefaultSignalReviewRunDependencies(): SignalReviewRunDependencies {
  return {
    store: createSignalReviewStore(),
    marketData: new BinanceReviewMarketDataProvider(),
    timeZone: "Asia/Shanghai",
  };
}
