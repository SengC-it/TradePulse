import Link from "next/link";
import { redirect } from "next/navigation";

import { dashboardAccessDecision, getDashboardAccess } from "@/lib/dashboard/access";
import { signOut } from "@/app/login/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const navigation = [
  ["总览", "/dashboard"],
  ["信号检测", "/dashboard/detections"],
  ["信号发送", "/dashboard/signals"],
  ["信号复盘", "/dashboard/reviews"],
  ["策略表现", "/dashboard/performance"],
] as const;

function AccessDenied() {
  return (
    <main className="access-required">
      <div className="access-panel">
        <p className="eyebrow">TradePulse / 权限</p>
        <h1>账号未获得 TradePulse Dashboard 权限</h1>
        <p>当前账号已经登录，但尚未被加入启用的 tp_authorized_users。</p>
        <p className="muted">系统不会在权限批准前读取生产数据。</p>
        <form action={signOut}>
          <button className="secondary-button" type="submit">退出登录</button>
        </form>
      </div>
    </main>
  );
}
export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getDashboardAccess();
  const decision = dashboardAccessDecision(access);
  if (decision === "LOGIN") {
    redirect("/login?next=%2Fdashboard");
  }
  if (decision === "DENIED") {
    return <AccessDenied />;
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
        <form className="sidebar-logout" action={signOut}>
          <button type="submit">退出登录</button>
        </form>
      </aside>
      <main className="dashboard-main">
        <div className="mobile-brand"><span className="brand-mark">TP</span><strong>TradePulse</strong></div>
        {children}
      </main>
    </div>
  );
}
