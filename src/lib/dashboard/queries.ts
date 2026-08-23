// Server-only module. Do not import this file from a Client Component.
import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "../config/constants.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { hasDashboardAccess } from "./access.ts";
import { calculateReviewMetrics } from "./metrics.ts";
import type {
  DashboardAdvisory,
  DashboardBacktestSummary,
  DashboardEvaluation,
  DashboardFilters,
  DashboardOverview,
  DashboardPage,
  DashboardReview,
} from "./types.ts";

type DashboardClient = ReturnType<typeof createSupabaseAdminClient>;

const PAGE_SIZE = 20;
const ADVISORY_LIMIT = 100;

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toEvaluation(row: Record<string, unknown>): DashboardEvaluation {
  return {
    id: String(row.id ?? ""),
    evaluatedAt: String(row.evaluated_at ?? ""),
    symbol: String(row.symbol ?? ""),
    direction: row.direction === "SHORT" ? "SHORT" : "LONG",
    status: (row.status ?? "INVALID") as DashboardEvaluation["status"],
    reasonCode: stringValue(row.reason_code),
    symbolRegime: stringValue(row.symbol_regime),
    btcRegime: stringValue(row.btc_regime),
    score: finiteNumber(row.score),
    grade: row.grade === "A" || row.grade === "B" || row.grade === "C" ? row.grade : null,
    formalSignal: row.formal_signal === true,
    entryReference: finiteNumber(row.entry_reference),
    stopReference: finiteNumber(row.stop_reference),
    takeProfitReference: finiteNumber(row.take_profit_reference),
    scoreBreakdown: asObject(row.score_breakdown),
  };
}

function toAdvisory(row: Record<string, unknown>): DashboardAdvisory {
  return {
    signalId: String(row.signal_id ?? ""),
    symbol: String(row.symbol ?? ""),
    direction: row.direction === "SHORT" ? "SHORT" : "LONG",
    strategyVersion: String(row.strategy_version ?? STRATEGY_VERSION),
    signalTime: String(row.signal_time ?? ""),
    signalValidUntil: String(row.signal_valid_until ?? ""),
    score: finiteNumber(row.score) ?? 0,
    grade: row.grade === "A" || row.grade === "B" || row.grade === "C" ? row.grade : "C",
    currentReferencePrice: finiteNumber(row.current_reference_price) ?? 0,
    suggestedEntryReference: finiteNumber(row.suggested_entry_reference) ?? 0,
    stopLoss: finiteNumber(row.stop_loss) ?? 0,
    takeProfit: finiteNumber(row.take_profit) ?? 0,
    riskReward: finiteNumber(row.risk_reward) ?? 0,
    deliveryStatus: row.delivery_status === "SENT" || row.delivery_status === "FAILED" ? row.delivery_status : "PENDING",
    sentAt: stringValue(row.sent_at),
    dataFreshness: asObject(row.data_freshness),
  };
}

function localDayBounds(now = new Date()): Readonly<{ start: string; end: string }> {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE ?? "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const start = new Date(`${localDate}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function dateFilter(value: string | undefined, endOfDay = false): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return endOfDay
    ? new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString()
    : date.toISOString();
}

async function withDashboardClient<T>(fallback: T, query: (client: DashboardClient) => Promise<T>): Promise<T> {
  if (!(await hasDashboardAccess())) {
    return fallback;
  }
  try {
    return await query(createSupabaseAdminClient());
  } catch {
    return fallback;
  }
}

function emptyPage<T>(page = 1): DashboardPage<T> {
  return { rows: [], page, pageSize: PAGE_SIZE, total: 0, pageCount: 0 };
}

export async function getDetectionPage(filters: DashboardFilters = {}): Promise<DashboardPage<DashboardEvaluation>> {
  const page = Number.isSafeInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  return withDashboardClient(emptyPage<DashboardEvaluation>(page), async (client) => {
    let query = client
      .from("tp_signal_evaluations")
      .select(
        "id,evaluated_at,symbol,direction,status,reason_code,symbol_regime,btc_regime,score,grade,formal_signal,entry_reference,stop_reference,take_profit_reference,score_breakdown",
        { count: "exact" },
      )
      .order("evaluated_at", { ascending: false });

    if (filters.symbol && RESEARCH_SYMBOLS.includes(filters.symbol as ResearchSymbol)) {
      query = query.eq("symbol", filters.symbol);
    }
    if (filters.direction) {
      query = query.eq("direction", filters.direction);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.grade) {
      query = query.eq("grade", filters.grade);
    }
    const dateFrom = dateFilter(filters.dateFrom);
    const dateTo = dateFilter(filters.dateTo, true);
    if (dateFrom) query = query.gte("evaluated_at", dateFrom);
    if (dateTo) query = query.lt("evaluated_at", dateTo);

    const result = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const total = result.count ?? 0;
    return {
      rows: (result.data ?? []).map((row) => toEvaluation(row as Record<string, unknown>)),
      page,
      pageSize: PAGE_SIZE,
      total,
      pageCount: Math.ceil(total / PAGE_SIZE),
    };
  });
}

const advisorySelect = "signal_id,symbol,direction,strategy_version,signal_time,signal_valid_until,score,grade,current_reference_price,suggested_entry_reference,stop_loss,take_profit,risk_reward,delivery_status,sent_at,data_freshness";

export async function getSignalAdvisories(): Promise<readonly DashboardAdvisory[]> {
  return withDashboardClient<readonly DashboardAdvisory[]>([], async (client) => {
    const result = await client
      .from("tp_signal_advisories")
      .select(advisorySelect)
      .order("signal_time", { ascending: false })
      .limit(ADVISORY_LIMIT);
    if (result.error) throw result.error;
    return (result.data ?? []).map((row) => toAdvisory(row as Record<string, unknown>));
  });
}

export async function getReviews(): Promise<readonly DashboardReview[]> {
  const advisories = await getSignalAdvisories();
  return advisories
    .filter((advisory) => advisory.deliveryStatus === "SENT")
    .map((advisory) => ({ ...advisory, reviewStatus: "待复盘", resultR: null }));
}

export async function getOverview(): Promise<DashboardOverview> {
  const fallback: DashboardOverview = {
    systemStatus: "暂无数据",
    currentStrategy: process.env.STRATEGY_VERSION ?? STRATEGY_VERSION,
    latestScanTime: null,
    dataStatus: "暂无数据",
    todayScans: 0,
    todayEvaluations: 0,
    todayFormalSignals: 0,
    todaySentEmails: 0,
    pendingReviews: 0,
    reviewMetrics: calculateReviewMetrics([]),
    latestEvent: null,
    backtestRunCount: 0,
    backtestSignalCount: 0,
  };

  return withDashboardClient(fallback, async (client) => {
    const day = localDayBounds();
    const [scans, evaluations, formalSignals, sentEmails, pendingReviews, latestRun, latestEvent, backtestRuns, backtestSignals] = await Promise.all([
      client.from("tp_scan_runs").select("id", { count: "exact", head: true }).gte("scheduled_for", day.start).lt("scheduled_for", day.end),
      client.from("tp_signal_evaluations").select("id", { count: "exact", head: true }).gte("evaluated_at", day.start).lt("evaluated_at", day.end),
      client.from("tp_signal_evaluations").select("id", { count: "exact", head: true }).eq("status", "FORMAL_SIGNAL").gte("evaluated_at", day.start).lt("evaluated_at", day.end),
      client.from("tp_signal_advisories").select("signal_id", { count: "exact", head: true }).eq("delivery_status", "SENT").gte("sent_at", day.start).lt("sent_at", day.end),
      client.from("tp_signal_advisories").select("signal_id", { count: "exact", head: true }).eq("delivery_status", "SENT"),
      client.from("tp_scan_runs").select("status,completed_at,started_at").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      client.from("tp_system_events").select("event_time,level,status,error_code").order("event_time", { ascending: false }).limit(1).maybeSingle(),
      client.from("tp_backtest_runs").select("id", { count: "exact", head: true }),
      client.from("tp_backtest_signals").select("id", { count: "exact", head: true }),
    ]);

    const queryError = [scans, evaluations, formalSignals, sentEmails, pendingReviews, latestRun, latestEvent, backtestRuns, backtestSignals].find((result) => result.error);
    if (queryError?.error) throw queryError.error;

    const status = latestRun.data?.status as string | undefined;
    const dataStatus: DashboardOverview["dataStatus"] =
      !latestRun.data ? "暂无数据" : status === "SUCCEEDED" ? "正常" : status === "PARTIAL" ? "部分完成" : status === "FAILED" ? "失败" : "部分完成";
    const systemStatus: DashboardOverview["systemStatus"] =
      !latestRun.data ? "暂无数据" : status === "FAILED" || status === "PARTIAL" ? "需关注" : "正常";

    return {
      ...fallback,
      systemStatus,
      latestScanTime: stringValue(latestRun.data?.completed_at) ?? stringValue(latestRun.data?.started_at),
      dataStatus,
      todayScans: scans.count ?? 0,
      todayEvaluations: evaluations.count ?? 0,
      todayFormalSignals: formalSignals.count ?? 0,
      todaySentEmails: sentEmails.count ?? 0,
      pendingReviews: pendingReviews.count ?? 0,
      reviewMetrics: calculateReviewMetrics([]),
      latestEvent: latestEvent.data
        ? {
            eventTime: String(latestEvent.data.event_time ?? ""),
            level: String(latestEvent.data.level ?? ""),
            status: String(latestEvent.data.status ?? ""),
            errorCode: stringValue(latestEvent.data.error_code),
          }
        : null,
      backtestRunCount: backtestRuns.count ?? 0,
      backtestSignalCount: backtestSignals.count ?? 0,
    };
  });
}

export async function getBacktestSummary(): Promise<DashboardBacktestSummary> {
  return withDashboardClient<DashboardBacktestSummary>({ runCount: 0, signalCount: 0, latestRun: null }, async (client) => {
    const [runs, signals, latest] = await Promise.all([
      client.from("tp_backtest_runs").select("id", { count: "exact", head: true }),
      client.from("tp_backtest_signals").select("id", { count: "exact", head: true }),
      client.from("tp_backtest_runs").select("status,completed_at").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const queryError = [runs, signals, latest].find((result) => result.error);
    if (queryError?.error) throw queryError.error;
    return {
      runCount: runs.count ?? 0,
      signalCount: signals.count ?? 0,
      latestRun: latest.data
        ? { status: String(latest.data.status ?? ""), completedAt: stringValue(latest.data.completed_at) }
        : null,
    };
  });
}
