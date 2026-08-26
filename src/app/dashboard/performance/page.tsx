import { getBacktestSummary, getOverview } from "@/lib/dashboard/queries";
import { formatDateTime } from "@/lib/dashboard/presenters";
import { EmptyState, MetricCard, PageHeader, ReviewMetricGrid } from "../dashboard-ui";

export default async function PerformancePage() {
  const [overview, backtest] = await Promise.all([getOverview(), getBacktestSummary()]);
  const hasReviewSample = overview.reviewMetrics.hasValidSample;
  return (
    <>
      <PageHeader eyebrow="TradePulse / 表现" title="策略表现" description={hasReviewSample ? "基于已结算正式信号的理论 R 表现。" : "暂无已结算 TP / SL 复盘样本。"} />
      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">生产复盘</p><h2>正式信号表现</h2></div></div>
        <ReviewMetricGrid metrics={overview.reviewMetrics} />
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">研究数据</p><h2>研究 / 回测表现</h2></div></div>
        {backtest.runCount > 0 ? <div className="metric-grid compact-grid"><MetricCard label="回测运行次数" value={String(backtest.runCount)} /><MetricCard label="回测信号数" value={String(backtest.signalCount)} /><MetricCard label="最近运行状态" value={backtest.latestRun?.status ?? "—"} /><MetricCard label="最近完成时间" value={formatDateTime(backtest.latestRun?.completedAt)} /></div> : <EmptyState title="Round-006 尚未生成正式验证结果" detail="performance = NOT_AUTHORIZED / NOT_GENERATED。" />}
      </section>
      <div className="safety-note"><strong>数据边界</strong><span>页面不假定本金、杠杆、仓位，也不把 R 转换为 USDT 盈亏。任何正式策略盈利能力结论必须来自独立验收的 authoritative 结果。</span></div>
    </>
  );
}
