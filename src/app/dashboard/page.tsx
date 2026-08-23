import { getOverview } from "@/lib/dashboard/queries";
import { formatDateTime } from "@/lib/dashboard/presenters";
import { EmptyState, MetricCard, PageHeader, ReviewMetricGrid, StatusBadge } from "./dashboard-ui";

export default async function DashboardPage() {
  const overview = await getOverview();
  const statusTone = overview.systemStatus === "正常" ? "success" : overview.systemStatus === "需关注" ? "warning" : "neutral";
  return (
    <>
      <PageHeader eyebrow="TradePulse / Dashboard" title="总览" description="以已闭合K线为基础，查看信号检测、发送与复盘状态。" />

      <section className="status-strip" aria-label="系统状态">
        <div><span className="section-kicker">系统状态</span><StatusBadge tone={statusTone}>{overview.systemStatus}</StatusBadge></div>
        <div><span className="section-kicker">当前策略</span><strong>{overview.currentStrategy}</strong></div>
        <div><span className="section-kicker">最近扫描时间</span><strong>{formatDateTime(overview.latestScanTime)}</strong></div>
        <div><span className="section-kicker">数据状态</span><strong>{overview.dataStatus}</strong></div>
      </section>

      <section className="dashboard-section" aria-labelledby="today-title">
        <div className="section-heading"><div><p className="eyebrow">今日运行</p><h2 id="today-title">扫描与信号</h2></div><span className="section-note">时间显示：Asia/Shanghai</span></div>
        <div className="metric-grid">
          <MetricCard label="今日扫描次数" value={String(overview.todayScans)} />
          <MetricCard label="今日检测次数" value={String(overview.todayEvaluations)} />
          <MetricCard label="今日正式信号" value={String(overview.todayFormalSignals)} tone={overview.todayFormalSignals > 0 ? "positive" : "neutral"} />
          <MetricCard label="今日发送邮件" value={String(overview.todaySentEmails)} tone={overview.todaySentEmails > 0 ? "positive" : "neutral"} />
          <MetricCard label="待复盘信号" value={String(overview.pendingReviews)} tone={overview.pendingReviews > 0 ? "warning" : "neutral"} />
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="performance-title">
        <div className="section-heading"><div><p className="eyebrow">只读统计</p><h2 id="performance-title">策略表现</h2></div><span className="section-note">只展示 authoritative resolved result</span></div>
        <ReviewMetricGrid metrics={overview.reviewMetrics} />
      </section>

      <section className="dashboard-two-column">
        <article className="panel-card">
          <div className="section-heading"><div><p className="eyebrow">运行状态</p><h2>最近系统事件</h2></div></div>
          {overview.latestEvent ? <dl className="detail-list"><div><dt>时间</dt><dd>{formatDateTime(overview.latestEvent.eventTime)}</dd></div><div><dt>级别</dt><dd>{overview.latestEvent.level}</dd></div><div><dt>状态</dt><dd>{overview.latestEvent.status}</dd></div><div><dt>错误代码</dt><dd>{overview.latestEvent.errorCode ?? "—"}</dd></div></dl> : <EmptyState title="暂无系统事件" detail="扫描完成后，这里会显示最近运行记录。" />}
        </article>
        <article className="panel-card">
          <div className="section-heading"><div><p className="eyebrow">研究数据</p><h2>研究 / 回测表现</h2></div></div>
          {overview.backtestRunCount > 0 ? <dl className="detail-list"><div><dt>回测运行次数</dt><dd>{overview.backtestRunCount}</dd></div><div><dt>回测信号数</dt><dd>{overview.backtestSignalCount}</dd></div></dl> : <EmptyState title="Round-006 尚未生成正式验证结果" detail="研究结果不会由 Dashboard 推算或虚构。" />}
        </article>
      </section>

      <div className="safety-note"><strong>人工决策模式</strong><span>TradePulse 只发送信号提醒，系统不会自动下单、自动加杠杆或管理仓位。策略结果尚未验证时，不显示误导性的收益率。</span></div>
    </>
  );
}
