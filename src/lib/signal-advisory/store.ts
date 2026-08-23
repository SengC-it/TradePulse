import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { STRATEGY_VERSION } from "../config/constants.ts";
import type {
  AdvisoryHealth,
  ScanRunBeginResult,
  ScanRunCompletion,
  SignalAdvisory,
  SignalAdvisoryStore,
  SystemEventInput,
} from "./types.ts";

const SCAN_LEASE_MS = 10 * 60 * 1000;

type SupabaseLikeClient = ReturnType<typeof createSupabaseAdminClient>;

function persistenceError(operation: string, error: { code?: string | null }): Error {
  return new Error(`Signal advisory persistence failed during ${operation}${error.code ? ` (${error.code})` : ""}.`);
}

function advisoryRow(advisory: SignalAdvisory, scanId: string) {
  return {
    signal_id: advisory.signalId,
    symbol: advisory.symbol,
    direction: advisory.direction,
    strategy_id: advisory.strategyId,
    strategy_version: advisory.strategyVersion,
    signal_time: advisory.signalTime,
    signal_valid_until: advisory.signalValidUntil,
    current_reference_price: advisory.currentReferencePrice,
    suggested_entry_reference: advisory.suggestedEntryReference,
    stop_loss: advisory.stopLoss,
    take_profit: advisory.takeProfit,
    risk_reward: advisory.riskReward,
    score: advisory.score,
    grade: advisory.grade,
    market_regime: advisory.marketRegime,
    data_freshness: advisory.dataFreshness,
    recipient: advisory.recipient,
    scan_run_id: scanId,
    delivery_status: "PENDING",
  };
}

export class SupabaseSignalAdvisoryStore implements SignalAdvisoryStore {
  constructor(private readonly client: SupabaseLikeClient) {}

  async beginScanRun(input: {
    runKey: string;
    scheduledFor: string;
    now: string;
  }): Promise<ScanRunBeginResult> {
    const nowMs = new Date(input.now).getTime();
    const leaseExpiresAt = new Date(nowMs + SCAN_LEASE_MS).toISOString();
    const inserted = await this.client
      .from("scan_runs")
      .insert({
        run_key: input.runKey,
        scheduled_for: input.scheduledFor,
        started_at: input.now,
        last_attempt_at: input.now,
        lease_expires_at: leaseExpiresAt,
        attempt_count: 1,
        status: "RUNNING",
      })
      .select("id")
      .maybeSingle();

    if (!inserted.error && inserted.data?.id) {
      return { action: "RUN", scanId: inserted.data.id };
    }

    if (inserted.error?.code !== "23505") {
      throw persistenceError("beginScanRun", inserted.error ?? { code: "NO_SCAN_ID" });
    }

    const existing = await this.client
      .from("scan_runs")
      .select("id,status,lease_expires_at,attempt_count")
      .eq("run_key", input.runKey)
      .maybeSingle();

    if (existing.error || !existing.data?.id) {
      throw persistenceError("readScanRun", existing.error ?? { code: "SCAN_RUN_NOT_FOUND" });
    }

    const existingLease = existing.data.lease_expires_at
      ? new Date(existing.data.lease_expires_at).getTime()
      : 0;
    if (existing.data.status === "SUCCEEDED") {
      return { action: "SKIP_COMPLETED", scanId: existing.data.id };
    }
    if (existing.data.status === "RUNNING" && existingLease > nowMs) {
      return { action: "SKIP_IN_PROGRESS", scanId: existing.data.id };
    }

    const retry = await this.client
      .from("scan_runs")
      .update({
        status: "RUNNING",
        started_at: input.now,
        last_attempt_at: input.now,
        lease_expires_at: leaseExpiresAt,
        attempt_count: (existing.data.attempt_count ?? 0) + 1,
        completed_at: null,
        error_code: null,
        error_message: null,
      })
      .eq("id", existing.data.id)
      .neq("status", "SUCCEEDED");

    if (retry.error) {
      throw persistenceError("retryScanRun", retry.error);
    }

    return { action: "RUN", scanId: existing.data.id };
  }

  async completeScanRun(input: ScanRunCompletion): Promise<void> {
    const result = await this.client
      .from("scan_runs")
      .update({
        status: input.status,
        symbols_requested: input.symbolsRequested,
        symbols_completed: input.symbolsCompleted,
        signals_generated: input.signalsGenerated,
        signals_sent: input.signalsSent,
        signals_skipped: input.signalsSkipped,
        completed_at: input.completedAt,
        lease_expires_at: null,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
      })
      .eq("id", input.scanId);

    if (result.error) {
      throw persistenceError("completeScanRun", result.error);
    }
  }

  async claimSignal(advisory: SignalAdvisory, scanId: string): Promise<"CLAIMED" | "SKIPPED_DUPLICATE"> {
    const result = await this.client.from("signal_advisories").insert(advisoryRow(advisory, scanId));
    if (!result.error) {
      return "CLAIMED";
    }
    if (result.error.code === "23505") {
      return "SKIPPED_DUPLICATE";
    }
    throw persistenceError("claimSignal", result.error);
  }

  async markSignalSent(input: {
    signalId: string;
    sentAt: string;
    emailMessageId: string;
  }): Promise<void> {
    const result = await this.client
      .from("signal_advisories")
      .update({
        delivery_status: "SENT",
        sent_at: input.sentAt,
        email_message_id: input.emailMessageId,
        failure_reason: null,
      })
      .eq("signal_id", input.signalId);

    if (result.error) {
      throw persistenceError("markSignalSent", result.error);
    }
  }

  async markSignalFailed(input: {
    signalId: string;
    failedAt: string;
    failureReason: string;
  }): Promise<void> {
    const result = await this.client
      .from("signal_advisories")
      .update({
        delivery_status: "FAILED",
        failure_reason: input.failureReason,
        last_failure_at: input.failedAt,
      })
      .eq("signal_id", input.signalId);

    if (result.error) {
      throw persistenceError("markSignalFailed", result.error);
    }
  }

  async recordSystemEvent(input: SystemEventInput): Promise<void> {
    const result = await this.client.from("system_events").insert({
      level: input.level,
      operation: input.operation,
      status: input.status,
      error_code: input.errorCode ?? null,
      scan_id: input.scanId ?? null,
      symbol: input.symbol ?? null,
      message: input.message ?? null,
      metadata: input.metadata ?? {},
    });

    if (result.error) {
      throw persistenceError("recordSystemEvent", result.error);
    }
  }

  async getHealth(): Promise<AdvisoryHealth> {
    const [scan, sent, error] = await Promise.all([
      this.client
        .from("scan_runs")
        .select("completed_at")
        .eq("status", "SUCCEEDED")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("signal_advisories")
        .select("sent_at")
        .eq("delivery_status", "SENT")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("system_events")
        .select("message,error_code")
        .eq("level", "ERROR")
        .order("event_time", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (scan.error || sent.error || error.error) {
      throw persistenceError("getHealth", scan.error ?? sent.error ?? error.error!);
    }

    return {
      lastSuccessfulScan: scan.data?.completed_at ?? null,
      lastEmailSent: sent.data?.sent_at ?? null,
      lastError: error.data?.message ?? error.data?.error_code ?? null,
      strategyVersion: STRATEGY_VERSION,
    };
  }
}

export function createSignalAdvisoryStore(): SignalAdvisoryStore {
  return new SupabaseSignalAdvisoryStore(createSupabaseAdminClient());
}
