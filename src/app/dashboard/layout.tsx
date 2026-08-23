import Link from "next/link";

import { hasDashboardAccess } from "@/lib/dashboard/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const navigation = [
  ["总览", "/dashboard"],
  ["信号检测", "/dashboard/detections"],
  ["信号发送", "/dashboard/signals"],
  ["信号复盘", "/dashboard/reviews"],
  ["策略表现", "/dashboard/performance"],
] as const;

function AccessRequired() {
  return (
    <main className="access-required">
      <div className="access-panel">
        <p className="eyebrow">TradePulse / Dashboard</p>
        <h1>需要授权访问</h1>
        <p>这是生产信号监控后台，仅限已授权的 TradePulse 用户访问。</p>
        <p className="muted">请先完成 Supabase 登录并加入 tp_authorized_users。系统不会在未授权时读取生产数据。</p>
        <Link className="text-link" href="/">返回首页</Link>
      </div>
    </main>
  );
}
export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await hasDashboardAccess())) {
    return <AccessRequired />;
  }

  return (
    <div className="dashboard-app">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">TP</span>
          <span><strong>TradePulse</strong><small>信号监控中心</small></span>
        </Link>
        <nav className="main-nav" aria-label="主导航">
          {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="sidebar-note">
          <strong>人工决策模式</strong>
          <span>系统只发送信号提醒，不会自动下单。</span>
        </div>
      </aside>
      <main className="dashboard-main">
        <div className="mobile-brand"><span className="brand-mark">TP</span><strong>TradePulse</strong></div>
        {children}
      </main>
    </div>
  );
}
