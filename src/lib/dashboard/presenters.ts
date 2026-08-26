import type { DashboardEvaluationStatus, DashboardReviewStatus } from "./types.ts";

const REASON_LABELS: Readonly<Record<string, string>> = {
  INSUFFICIENT_HISTORY: "历史数据不足",
  INDICATOR_UNAVAILABLE: "指标数据不足",
  INVALID_CANDLE_SERIES: "K线数据异常",
  FUTURE_DATA: "检测到未来数据",
  TIME_ALIGNMENT_INVALID: "时间对齐异常",
  INVALID_ATR: "波动指标异常",
  INVALID_VOLUME_BASELINE: "成交量基准异常",
  INVALID_BTC_INPUT: "BTC大盘数据不足",
  SYMBOL_REGIME_NO_TRADE: "当前趋势不适合交易",
  SYMBOL_DIRECTION_MISMATCH: "当前趋势方向不符合",
  BTC_DIRECTION_BLOCKED: "BTC大盘方向限制",
  PULLBACK_NOT_FOUND: "未出现有效回调",
  BREAKOUT_NOT_CONFIRMED: "尚未确认突破",
  RSI_OUT_OF_RANGE: "市场强弱指标不符合",
  STOP_ATR_OUT_OF_RANGE: "止损距离不符合要求",
  SCORE_UNAVAILABLE: "暂无法计算评分",
};

export const reasonLabel = (reasonCode: string | null): string =>
  reasonCode ? REASON_LABELS[reasonCode] ?? "未满足信号条件" : "—";

export const evaluationStatusLabel = (status: DashboardEvaluationStatus): string => {
  switch (status) {
    case "FORMAL_SIGNAL":
      return "正式信号";
    case "CANDIDATE_BELOW_THRESHOLD":
      return "候选未达阈值";
    case "NO_ELIGIBLE_CANDIDATE":
      return "无合格候选";
    case "INVALID":
      return "数据无效";
  }
};

export const reviewStatusLabel = (status: DashboardReviewStatus): string => {
  switch (status) {
    case "NO_REVIEW":
      return "待首次复盘";
    case "WAITING_ENTRY":
      return "待入场";
    case "OPEN":
      return "观察中";
    case "TP":
      return "止盈";
    case "SL":
      return "止损";
    case "NO_ENTRY":
      return "未入场失效";
    case "AMBIGUOUS":
      return "结果不确定";
  }
};

const REGIME_LABELS: Readonly<Record<string, string>> = {
  LONG_ONLY: "只做多",
  SHORT_ONLY: "只做空",
  NO_TRADE: "不交易",
  BTC_STRONG_BULL: "BTC 强势上涨",
  BTC_NEUTRAL: "BTC 中性",
  BTC_STRONG_BEAR: "BTC 强势下跌",
};

export const regimeLabel = (regime: string | null | undefined): string =>
  regime ? REGIME_LABELS[regime] ?? regime : "—";

export const deliveryStatusLabel = (status: "PENDING" | "SENT" | "FAILED"): string => {
  switch (status) {
    case "PENDING":
      return "待发送";
    case "SENT":
      return "已发送";
    case "FAILED":
      return "发送失败";
  }
};

export const directionLabel = (direction: "LONG" | "SHORT"): string =>
  direction === "LONG" ? "做多" : "做空";

export function maskRecipient(recipient: string | null | undefined): string {
  if (!recipient || !recipient.includes("@")) {
    return "—";
  }
  const [local, domain] = recipient.split("@", 2);
  return `${local.slice(0, 1)}***@${domain}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: process.env.APP_TIMEZONE ?? "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replaceAll("/", "-");
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits,
    useGrouping: true,
  }).format(value);
}

export function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${formatNumber(value)} 分`;
}

export function formatR(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}
