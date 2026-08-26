import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

import { DAILY_REVIEW_VERSION, type ReviewAdvisory, type ReviewState, type SignalReviewStore } from "./types.ts";

type SupabaseLikeClient = ReturnType<typeof createSupabaseAdminClient>;

const REVIEW_STATE_SELECT =
  "signal_id,review_version,status,entry_candle_time,exit_candle_time,exit_reference,result_r,last_evaluated_candle_time,reason";

function persistenceError(operation: string, error: { code?: string | null }): Error {
  return new Error(
    "Signal review persistence failed during " +
      operation +
      (error.code ? " (" + error.code + ")." : "."),
  );
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Signal review row has an invalid " + field + ".");
  }
  return value;
}

function numberValue(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error("Signal review row has an invalid " + field + ".");
  }
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function reviewAdvisory(row: Record<string, unknown>): ReviewAdvisory {
  const symbol = requiredString(row.symbol, "symbol");
  if (!(RESEARCH_SYMBOLS as readonly string[]).includes(symbol)) {
    throw new Error("Signal review row has an unapproved symbol.");
  }
  const direction = row.direction === "SHORT" ? "SHORT" : row.direction === "LONG" ? "LONG" : null;
  if (!direction) {
    throw new Error("Signal review row has an invalid direction.");
  }
  return {
    signalId: requiredString(row.signal_id, "signal_id"),
    symbol: symbol as ResearchSymbol,
    direction,
    strategyVersion: requiredString(row.strategy_version, "strategy_version"),
    signalTime: requiredString(row.signal_time, "signal_time"),
    signalValidUntil: requiredString(row.signal_valid_until, "signal_valid_until"),
    sentAt: requiredString(row.sent_at, "sent_at"),
    suggestedEntryReference: numberValue(row.suggested_entry_reference, "suggested_entry_reference"),
    stopLoss: numberValue(row.stop_loss, "stop_loss"),
    takeProfit: numberValue(row.take_profit, "take_profit"),
  };
}

const REVIEW_STATUSES = ["WAITING_ENTRY", "OPEN"] as const;

function reviewState(row: Record<string, unknown>): ReviewState {
  const status = row.status;
  if (
    status !== "WAITING_ENTRY" &&
    status !== "OPEN" &&
    status !== "TP" &&
    status !== "SL" &&
    status !== "NO_ENTRY" &&
    status !== "AMBIGUOUS"
  ) {
    throw new Error("Signal review row has an invalid status.");
  }
  return {
    signalId: requiredString(row.signal_id, "signal_id"),
    reviewVersion: requiredString(row.review_version, "review_version"),
    status,
    entryCandleTime: row.entry_candle_time ? String(row.entry_candle_time) : null,
    exitCandleTime: row.exit_candle_time ? String(row.exit_candle_time) : null,
    exitReference: optionalNumber(row.exit_reference),
    resultR: optionalNumber(row.result_r),
    lastEvaluatedCandleTime: row.last_evaluated_candle_time
      ? String(row.last_evaluated_candle_time)
      : null,
    reason: row.reason ? String(row.reason) : null,
  };
}

export class SupabaseSignalReviewStore implements SignalReviewStore {
  constructor(private readonly client: SupabaseLikeClient) {}

  async claimDailyReviewRun(input: {
    runKey: string;
    scheduledFor: string;
    now: string;
    leaseExpiresAt: string;
  }) {
    const result = await this.client.rpc("tp_claim_review_run", {
      p_run_key: input.runKey,
      p_scheduled_for: input.scheduledFor,
      p_now: input.now,
      p_lease_expires_at: input.leaseExpiresAt,
    });
    if (result.error) {
      throw persistenceError("claimDailyReviewRun", result.error);
    }
    const claim = Array.isArray(result.data) ? result.data[0] : result.data;
    if (
      !claim ||
      (claim.action !== "RUN" &&
        claim.action !== "SKIP_COMPLETED" &&
        claim.action !== "SKIP_IN_PROGRESS") ||
      typeof claim.runId !== "string"
    ) {
      throw persistenceError("claimDailyReviewRun", { code: "INVALID_CLAIM_RESULT" });
    }
    return { action: claim.action, runId: claim.runId } as const;
  }

  async completeDailyReviewRun(input: {
    runId: string;
    status: "SUCCEEDED" | "PARTIAL" | "FAILED";
    advisoriesConsidered: number;
    reviewsCreated: number;
    reviewsUpdated: number;
    reviewsResolved: number;
    errorCode?: string;
    completedAt: string;
  }): Promise<void> {
    const result = await this.client
      .from("tp_review_runs")
      .update({
        status: input.status,
        completed_at: input.completedAt,
        lease_expires_at: null,
        advisories_considered: input.advisoriesConsidered,
        reviews_created: input.reviewsCreated,
        reviews_updated: input.reviewsUpdated,
        reviews_resolved: input.reviewsResolved,
        error_code: input.errorCode ?? null,
      })
      .eq("id", input.runId);
    if (result.error) {
      throw persistenceError("completeDailyReviewRun", result.error);
    }
  }

  async loadSentAdvisories(): Promise<readonly ReviewAdvisory[]> {
    const result = await this.client
      .from("tp_signal_advisories")
      .select(
        "signal_id,symbol,direction,strategy_version,signal_time,signal_valid_until,sent_at,suggested_entry_reference,stop_loss,take_profit",
      )
      .eq("delivery_status", "SENT")
      .not("sent_at", "is", null)
      .order("signal_time", { ascending: true });
    if (result.error) {
      throw persistenceError("loadSentAdvisories", result.error);
    }
    return Object.freeze((result.data ?? []).map((row: Record<string, unknown>) => reviewAdvisory(row)));
  }

  async ensureReviewRows(advisories: readonly ReviewAdvisory[]): Promise<number> {
    if (advisories.length === 0) {
      return 0;
    }
    const result = await this.client
      .from("tp_advisory_reviews")
      .upsert(
        advisories.map((advisory) => ({
          signal_id: advisory.signalId,
          review_version: DAILY_REVIEW_VERSION,
          status: "WAITING_ENTRY",
        })),
        { onConflict: "signal_id", ignoreDuplicates: true },
      )
      .select("signal_id");
    if (result.error) {
      throw persistenceError("ensureReviewRows", result.error);
    }
    return Array.isArray(result.data) ? result.data.length : 0;
  }

  async loadActiveReviews(): Promise<readonly ReviewState[]> {
    const result = await this.client
      .from("tp_advisory_reviews")
      .select(REVIEW_STATE_SELECT)
      .in("status", [...REVIEW_STATUSES])
      .order("updated_at", { ascending: true });
    if (result.error) {
      throw persistenceError("loadActiveReviews", result.error);
    }
    return Object.freeze((result.data ?? []).map((row: Record<string, unknown>) => reviewState(row)));
  }

  async saveReviewState(state: ReviewState, updatedAt: string): Promise<void> {
    const result = await this.client
      .from("tp_advisory_reviews")
      .update({
        status: state.status,
        entry_candle_time: state.entryCandleTime,
        exit_candle_time: state.exitCandleTime,
        exit_reference: state.exitReference,
        result_r: state.resultR,
        last_evaluated_candle_time: state.lastEvaluatedCandleTime,
        reason: state.reason,
        updated_at: updatedAt,
      })
      .eq("signal_id", state.signalId)
      .eq("review_version", state.reviewVersion);
    if (result.error) {
      throw persistenceError("saveReviewState", result.error);
    }
  }
}

export function createSignalReviewStore(): SignalReviewStore {
  return new SupabaseSignalReviewStore(createSupabaseAdminClient());
}
