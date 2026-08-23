import type { AdvisoryDirection, DeliveryStatus } from "../signal-advisory/types.ts";

export type DashboardEvaluationStatus =
  | "FORMAL_SIGNAL"
  | "CANDIDATE_BELOW_THRESHOLD"
  | "NO_ELIGIBLE_CANDIDATE"
  | "INVALID";

export type DashboardEvaluation = Readonly<{
  id: string;
  evaluatedAt: string;
  symbol: string;
  direction: AdvisoryDirection;
  status: DashboardEvaluationStatus;
  reasonCode: string | null;
  symbolRegime: string | null;
  btcRegime: string | null;
  score: number | null;
  grade: "A" | "B" | "C" | null;
  formalSignal: boolean;
  entryReference: number | null;
  stopReference: number | null;
  takeProfitReference: number | null;
  scoreBreakdown: Record<string, unknown> | null;
}>;

export type DashboardAdvisory = Readonly<{
  signalId: string;
  symbol: string;
  direction: AdvisoryDirection;
  strategyVersion: string;
  signalTime: string;
  signalValidUntil: string;
  score: number;
  grade: "A" | "B" | "C";
  currentReferencePrice: number;
  suggestedEntryReference: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  deliveryStatus: DeliveryStatus;
  sentAt: string | null;
  dataFreshness: Record<string, unknown> | null;
}>;

export type DashboardReview = DashboardAdvisory &
  Readonly<{
    reviewStatus: "待复盘";
    resultR: number | null;
  }>;

export type DashboardPage<T> = Readonly<{
  rows: readonly T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}>;

export type DashboardFilters = Readonly<{
  page?: number;
  symbol?: string;
  direction?: AdvisoryDirection;
  status?: DashboardEvaluationStatus;
  grade?: "A" | "B" | "C";
  dateFrom?: string;
  dateTo?: string;
}>;

export type ReviewMetrics = Readonly<{
  hasValidSample: boolean;
  reviewedSignals: number;
  wins: number;
  losses: number;
  winRate: number | null;
  cumulativeR: number | null;
  averageR: number | null;
  profitFactor: number | null;
  maxDrawdownR: number | null;
}>;

export type DashboardBacktestSummary = Readonly<{
  runCount: number;
  signalCount: number;
  latestRun: Readonly<{
    status: string;
    completedAt: string | null;
  }> | null;
}>;

export type DashboardOverview = Readonly<{
  systemStatus: "正常" | "需关注" | "暂无数据";
  currentStrategy: string;
  latestScanTime: string | null;
  dataStatus: "正常" | "部分完成" | "失败" | "暂无数据";
  todayScans: number;
  todayEvaluations: number;
  todayFormalSignals: number;
  todaySentEmails: number;
  pendingReviews: number;
  reviewMetrics: ReviewMetrics;
  latestEvent: Readonly<{
    eventTime: string;
    level: string;
    status: string;
    errorCode: string | null;
  }> | null;
  backtestRunCount: number;
  backtestSignalCount: number;
}>;
