import { getReviews } from "@/lib/dashboard/queries";
import { AdvisoryTable, EmptyState, PageHeader } from "../dashboard-ui";

export default async function ReviewsPage() {
  const rows = await getReviews();
  return (
    <>
      <PageHeader eyebrow="TradePulse / 复盘" title="信号复盘" description="当前仅展示已发送的正式提醒，不根据当前价格猜测盈利或亏损。" />
      <section className="panel-card table-card">
        <div className="section-heading"><div><p className="eyebrow">待复盘队列</p><h2>待复盘信号</h2></div><span className="section-note">退出规则与同K线 TP/SL 顺序仍待正式规范</span></div>
        <p className="section-note">自动信号复盘规则尚未启用，当前不会推算交易结果；已发送信号均计入待复盘。</p>
        {rows.length > 0 ? <AdvisoryTable rows={rows} review /> : <EmptyState title="暂无待复盘信号" detail="自动信号复盘规则尚未启用，结果 R 保持为空。" />}
      </section>
      <div className="safety-note"><strong>复盘边界</strong><span>本版本不自动评估退出、不写入假的 tp_signal_results，也不把未验证结果换算为 USDT 盈亏。</span></div>
    </>
  );
}
