import { getDetectionPage } from "@/lib/dashboard/queries";
import type { DashboardFilters } from "@/lib/dashboard/types";
import { EvaluationTable, EmptyState, PageHeader, Pagination } from "../dashboard-ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DetectionsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const direction = first(params.direction);
  const status = first(params.status);
  const grade = first(params.grade);
  const filters: DashboardFilters = {
    page: Number(first(params.page)) || 1,
    symbol: first(params.symbol),
    direction: direction === "LONG" || direction === "SHORT" ? direction : undefined,
    status: ["FORMAL_SIGNAL", "CANDIDATE_BELOW_THRESHOLD", "NO_ELIGIBLE_CANDIDATE", "INVALID"].includes(status ?? "") ? status as DashboardFilters["status"] : undefined,
    grade: ["A", "B", "C"].includes(grade ?? "") ? grade as DashboardFilters["grade"] : undefined,
    dateFrom: first(params.dateFrom),
    dateTo: first(params.dateTo),
  };
  const page = await getDetectionPage(filters);
  const query = { symbol: filters.symbol, direction: filters.direction, status: filters.status, grade: filters.grade, dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  return (
    <>
      <PageHeader eyebrow="TradePulse / 可观测性" title="信号检测" description="记录策略引擎对五个币种、两个方向的每次检测，不改变信号判断。" />
      <form className="filter-bar" method="get">
        <label>币种<select name="symbol" defaultValue={filters.symbol ?? ""}><option value="">全部币种</option>{["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"].map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}</select></label>
        <label>方向<select name="direction" defaultValue={filters.direction ?? ""}><option value="">全部方向</option><option value="LONG">做多</option><option value="SHORT">做空</option></select></label>
        <label>状态<select name="status" defaultValue={filters.status ?? ""}><option value="">全部状态</option><option value="FORMAL_SIGNAL">正式信号</option><option value="CANDIDATE_BELOW_THRESHOLD">候选未达阈值</option><option value="NO_ELIGIBLE_CANDIDATE">无合格候选</option><option value="INVALID">数据无效</option></select></label>
        <label>等级<select name="grade" defaultValue={filters.grade ?? ""}><option value="">全部等级</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label>
        <label>开始日期<input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ""} /></label>
        <label>结束日期<input type="date" name="dateTo" defaultValue={filters.dateTo ?? ""} /></label>
        <button type="submit">筛选</button>
      </form>
      <section className="panel-card table-card">
        <div className="section-heading"><div><p className="eyebrow">检测记录</p><h2>检测记录</h2></div><span className="section-note">共 {page.total} 条 · 每页 {page.pageSize} 条</span></div>
        {page.rows.length > 0 ? <EvaluationTable rows={page.rows} /> : <EmptyState title="暂无检测记录" detail="请确认迁移已应用，或等待下一次生产扫描。" />}
        <Pagination page={page.page} pageCount={page.pageCount} query={query} />
      </section>
    </>
  );
}
