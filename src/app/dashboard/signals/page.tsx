import { getSignalAdvisories } from "@/lib/dashboard/queries";
import { AdvisoryTable, EmptyState, PageHeader } from "../dashboard-ui";

export default async function SignalsPage() {
  const rows = await getSignalAdvisories();
  return (
    <>
      <PageHeader eyebrow="TradePulse / 发送" title="信号发送" description="以 tp_signal_advisories 为生产事实源，查看提醒发送状态与信号参数。" />
      <section className="panel-card table-card">
        <div className="section-heading"><div><p className="eyebrow">提醒登记</p><h2>发送记录</h2></div><span className="section-note">最多显示最近 100 条</span></div>
        {rows.length > 0 ? <AdvisoryTable rows={rows} /> : <EmptyState title="暂无信号发送记录" detail="NO_SIGNAL 不会发送邮件，也不会创建虚假 advisory。" />}
      </section>
      <div className="safety-note"><strong>隐私保护</strong><span>页面不会显示 SMTP 配置、完整收件邮箱、email message id、CRON_SECRET 或异常堆栈。</span></div>
    </>
  );
}
