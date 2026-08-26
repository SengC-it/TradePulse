import Link from "next/link";

import { directionLabel, evaluationStatusLabel, formatDateTime, formatNumber, formatPercent, formatR, formatScore, reasonLabel, regimeLabel, reviewStatusLabel } from "@/lib/dashboard/presenters";

export function MetricCard(props: Readonly<{ label: string; value: string; detail?: string; tone?: "neutral" | "positive" | "warning" }>) {
  return (
    <article className={`metric-card metric-card-${props.tone ?? "neutral"}`}>
      <p className="metric-label">{props.label}</p>
      <p className="metric-value">{props.value}</p>
      {props.detail ? <p className="metric-detail">{props.detail}</p> : null}
    </article>
  );
}

export function StatusBadge(props: Readonly<{ children: React.ReactNode; tone?: "success" | "warning" | "danger" | "neutral"; title?: string }>) {
  return <span className={`status-badge status-${props.tone ?? "neutral"}`} title={props.title}>{props.children}</span>;
}

export function EmptyState(props: Readonly<{ title: string; detail?: string }>) {
  return (
    <div className="empty-state">
      <strong>{props.title}</strong>
      {props.detail ? <span>{props.detail}</span> : null}
    </div>
  );
}

export function PageHeader(props: Readonly<{ eyebrow: string; title: string; description: string }>) {
  return (
    <header className="page-header">
      <p className="eyebrow">{props.eyebrow}</p>
      <h1>{props.title}</h1>
      <p className="page-description">{props.description}</p>
    </header>
  );
}

export function DirectionBadge(props: Readonly<{ direction: "LONG" | "SHORT" }>) {
  return <StatusBadge tone={props.direction === "LONG" ? "success" : "warning"}>{directionLabel(props.direction)}</StatusBadge>;
}

export function EvaluationTable(props: Readonly<{ rows: readonly import("@/lib/dashboard/types").DashboardEvaluation[] }>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>检测时间</th>
            <th>币种</th>
            <th>方向</th>
            <th>检测结果</th>
            <th>评分</th>
            <th>等级</th>
            <th>交易方向</th>
            <th>BTC环境</th>
            <th>未通过原因</th>
            <th>参考进场</th>
            <th>止损</th>
            <th>止盈</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.id}>
              <td>{formatDateTime(row.evaluatedAt)}</td>
              <td className="strong-cell">{row.symbol}</td>
              <td><DirectionBadge direction={row.direction} /></td>
              <td><StatusBadge tone={row.status === "FORMAL_SIGNAL" ? "success" : row.status === "INVALID" ? "danger" : "neutral"}>{evaluationStatusLabel(row.status)}</StatusBadge></td>
              <td>{formatScore(row.score)}</td>
              <td>{row.grade ?? "—"}</td>
              <td>{regimeLabel(row.symbolRegime)}</td>
              <td>{regimeLabel(row.btcRegime)}</td>
              <td title={row.reasonCode ?? undefined}>{reasonLabel(row.reasonCode)}</td>
              <td>{formatNumber(row.entryReference, 8)}</td>
              <td>{formatNumber(row.stopReference, 8)}</td>
              <td>{formatNumber(row.takeProfitReference, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdvisoryTable(props: Readonly<{ rows: readonly (import("@/lib/dashboard/types").DashboardAdvisory | import("@/lib/dashboard/types").DashboardReview)[]; review?: boolean }>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>信号时间</th>
            <th>币种</th>
            <th>方向</th>
            <th>等级</th>
            <th>评分</th>
            <th>参考进场</th>
            <th>止损</th>
            <th>止盈</th>
            <th>{props.review ? "复盘状态" : "邮件状态"}</th>
            {props.review ? <><th>入场时间</th><th>退出时间</th><th>退出参考</th><th>最近检查</th><th>结果 R</th><th>复盘说明</th></> : <th>发送时间</th>}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.signalId}>
              <td>{formatDateTime(row.signalTime)}</td>
              <td className="strong-cell">{row.symbol}</td>
              <td><DirectionBadge direction={row.direction} /></td>
              <td><StatusBadge tone={row.grade === "A" ? "success" : "neutral"}>{row.grade} 级</StatusBadge></td>
              <td>{formatScore(row.score)}</td>
              <td>{formatNumber(row.suggestedEntryReference, 8)}</td>
              <td>{formatNumber(row.stopLoss, 8)}</td>
              <td>{formatNumber(row.takeProfit, 8)}</td>
              <td>{props.review && "reviewStatus" in row ? <StatusBadge title={row.reviewReason ?? undefined} tone={row.reviewStatus === "TP" ? "success" : row.reviewStatus === "SL" || row.reviewStatus === "AMBIGUOUS" ? "danger" : "neutral"}>{reviewStatusLabel(row.reviewStatus)}</StatusBadge> : row.deliveryStatus === "SENT" ? <StatusBadge tone="success">已发送</StatusBadge> : row.deliveryStatus === "FAILED" ? <StatusBadge tone="danger">发送失败</StatusBadge> : <StatusBadge tone="warning">待发送</StatusBadge>}</td>
              {props.review && "reviewStatus" in row ? <><td>{formatDateTime(row.entryCandleTime)}</td><td>{formatDateTime(row.exitCandleTime)}</td><td>{formatNumber(row.exitReference, 8)}</td><td>{formatDateTime(row.lastEvaluatedCandleTime)}</td><td>{formatR(row.resultR)}</td><td>{row.reviewReason ?? "—"}</td></> : <td>{formatDateTime(row.sentAt)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination(props: Readonly<{ page: number; pageCount: number; query?: Record<string, string | undefined> }>) {
  if (props.pageCount <= 1) return null;
  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...props.query, page: String(page) })) {
      if (value) params.set(key, value);
    }
    return `?${params.toString()}`;
  };
  return (
    <nav className="pagination" aria-label="分页">
      {props.page > 1 ? <Link href={hrefFor(props.page - 1)}>上一页</Link> : <span className="disabled-link">上一页</span>}
      <span>第 {props.page} / {props.pageCount} 页</span>
      {props.page < props.pageCount ? <Link href={hrefFor(props.page + 1)}>下一页</Link> : <span className="disabled-link">下一页</span>}
    </nav>
  );
}

export function ReviewMetricGrid(props: Readonly<{ metrics: import("@/lib/dashboard/types").ReviewMetrics }>) {
  const metrics = props.metrics;
  if (!metrics.hasValidSample) {
    return <EmptyState title="暂无已结算 TP / SL 复盘样本" detail="策略盈利能力尚未验证，不根据信号数量推算收益。" />;
  }
  return (
    <div className="metric-grid compact-grid">
      <MetricCard label="已复盘信号" value={String(metrics.reviewedSignals)} />
      <MetricCard label="盈利次数" value={String(metrics.wins)} tone="positive" />
      <MetricCard label="亏损次数" value={String(metrics.losses)} tone="warning" />
      <MetricCard label="胜率" value={formatPercent(metrics.winRate)} />
      <MetricCard label="累计 R" value={formatR(metrics.cumulativeR)} tone={metrics.cumulativeR !== null && metrics.cumulativeR >= 0 ? "positive" : "warning"} />
      <MetricCard label="平均 R" value={formatR(metrics.averageR)} />
      <MetricCard label="Profit Factor" value={metrics.profitFactor === Number.POSITIVE_INFINITY ? "∞" : formatNumber(metrics.profitFactor)} />
      <MetricCard label="最大回撤 R" value={formatR(metrics.maxDrawdownR)} tone="warning" />
    </div>
  );
}
