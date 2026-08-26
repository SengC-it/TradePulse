import { getReviews } from "@/lib/dashboard/queries";
import { AdvisoryTable, EmptyState, PageHeader } from "../dashboard-ui";

export default async function ReviewsPage() {
  const rows = await getReviews();
  return (
    <>
      <PageHeader eyebrow="TradePulse / 复盘" title="信号复盘" description="仅基于已发送的正式提醒与独立复盘账本展示状态，不从当前价格推算结果。" />
      <section className="panel-card table-card">
        <div className="section-heading"><div><p className="eyebrow">复盘队列</p><h2>已发送信号</h2></div><span className="section-note">状态来自 TradePulse 独立复盘账本</span></div>
        <p className="section-note">只有 TP / SL 会进入表现统计；待首次复盘、待入场、观察中、未入场失效和结果不确定均不推算 R。</p>
        {rows.length > 0 ? <AdvisoryTable rows={rows} review /> : <EmptyState title="暂无已发送信号" detail="发送后的正式提醒会在这里进入复盘队列。" />}
      </section>
      <div className="safety-note"><strong>复盘边界</strong><span>复盘只读取 tp_advisory_reviews，不使用 legacy tp_signal_results，也不把未验证结果换算为 USDT 盈亏。</span></div>
    </>
  );
}
