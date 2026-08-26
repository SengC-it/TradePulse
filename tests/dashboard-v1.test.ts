import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { dashboardAccessDecision, isSafeLoginNext } from "@/lib/dashboard/access";
import { calculateReviewMetrics, countPendingReviews } from "@/lib/dashboard/metrics";
import { evaluationStatusLabel, formatR, maskRecipient, reasonLabel, regimeLabel, reviewStatusLabel } from "@/lib/dashboard/presenters";
import { mapStrategyEvaluations } from "@/lib/signal-advisory/evaluations";
import { config as proxyConfig } from "@/proxy";

describe("Dashboard V1 presentation and observability", () => {
  it("maps all evaluation outcomes without changing Strategy Engine meaning", () => {
    const rows = mapStrategyEvaluations({
      scanRunId: "scan-1",
      evaluatedAt: "2026-08-23T00:00:00.000Z",
      evaluations: [
        {
          strategyVersion: "baseline-001",
          symbol: "BTCUSDT",
          direction: "LONG",
          status: "FORMAL_SIGNAL",
          reason: null,
          symbolRegime: "LONG_ONLY",
          btcRegime: "BTC_STRONG_BULL",
          candidate: {
            strategyVersion: "baseline-001",
            symbol: "BTCUSDT",
            direction: "LONG",
            symbolRegime: "LONG_ONLY",
            btcRegime: "BTC_STRONG_BULL",
            entryReference: 100,
            stopReference: 98,
            takeProfitReference: 104,
            stopDistance: 2,
            stopAtr: 1.2,
            breakdown: {
              trendStrength: 40,
              pullbackQuality: 20,
              breakoutStrength: 20,
              volumeScore: 10,
              riskRewardScore: 10,
            },
            totalScore: 90,
            grade: "A",
            formalSignal: true,
          },
        },
        {
          strategyVersion: "baseline-001",
          symbol: "ETHUSDT",
          direction: "SHORT",
          status: "NO_ELIGIBLE_CANDIDATE",
          reason: "PULLBACK_NOT_FOUND",
          symbolRegime: "SHORT_ONLY",
          btcRegime: "BTC_STRONG_BULL",
          candidate: null,
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ scanRunId: "scan-1", status: "FORMAL_SIGNAL", score: 90, grade: "A", formalSignal: true });
    expect(rows[0]?.scoreBreakdown).toMatchObject({ trendStrength: 40 });
    expect(rows[1]).toMatchObject({ status: "NO_ELIGIBLE_CANDIDATE", reasonCode: "PULLBACK_NOT_FOUND", score: null, grade: null, formalSignal: false });
  });

  it("uses safe Chinese reason labels and masks recipients", () => {
    expect(reasonLabel("PULLBACK_NOT_FOUND")).toBe("未出现有效回调");
    expect(reasonLabel("UNKNOWN_INTERNAL_REASON")).toBe("未满足信号条件");
    expect(maskRecipient("sheng.chi@qq.com")).toBe("s***@qq.com");
    expect(maskRecipient("not-an-email")).toBe("—");
  });

  it("maps authentication states to the login, denied, and dashboard boundaries", () => {
    expect(dashboardAccessDecision({ authenticated: false, authorized: false })).toBe("LOGIN");
    expect(dashboardAccessDecision({ authenticated: true, authorized: false })).toBe("DENIED");
    expect(dashboardAccessDecision({ authenticated: true, authorized: true })).toBe("AUTHORIZED");
    expect(isSafeLoginNext("/dashboard")).toBe(true);
    expect(isSafeLoginNext("/dashboard/detections")).toBe(true);
    expect(isSafeLoginNext("//external.example")).toBe(false);
    expect(isSafeLoginNext("/\\evil.com")).toBe(false);
    expect(isSafeLoginNext("/settings")).toBe(false);
    expect(isSafeLoginNext("/")).toBe(false);
  });

  it("refreshes sessions through the page-only Supabase proxy", () => {
    const matcherPattern = proxyConfig.matcher[0];
    const matcher = new RegExp(`^${matcherPattern}$`);
    const proxySource = readFileSync("src/proxy.ts", "utf8");
    const helperSource = readFileSync("src/lib/supabase/proxy.ts", "utf8");

    expect(proxySource).toContain("export async function proxy");
    expect(matcher.test("/dashboard")).toBe(true);
    expect(matcher.test("/api/cron/signal-advisory")).toBe(false);
    expect(matcher.test("/api/health")).toBe(false);
    expect(matcher.test("/api/diagnostics/market-smoke")).toBe(false);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    expect(helperSource).toContain("createServerClient");
    expect(helperSource).toContain("supabase.auth.getClaims()");
    expect(helperSource).not.toContain("getSession()");
    expect(helperSource).toContain("request.cookies.set");
    expect(helperSource).toContain("supabaseResponse.cookies.set");
  });

  it("keeps the login flow closed to public signup and keeps logout available", () => {
    const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
    const loginActions = readFileSync("src/app/login/actions.ts", "utf8");
    const layout = readFileSync("src/app/dashboard/layout.tsx", "utf8");
    const queries = readFileSync("src/lib/dashboard/queries.ts", "utf8");
    expect(loginPage).toContain("当前不开放公开注册");
    expect(loginPage).not.toContain("signUp");
    expect(loginActions).toContain("signOut");
    expect(layout).toContain("账号未获得 TradePulse Dashboard 权限");
    expect(layout).toContain("redirect(\"/login?next=%2Fdashboard\")");
    expect(layout).toContain("退出登录");
    expect(queries.indexOf("await hasDashboardAccess()")).toBeLessThan(queries.indexOf("createSupabaseAdminClient());"));
  });

  it("uses the explicit Chinese status and market-regime labels", () => {
    expect(evaluationStatusLabel("FORMAL_SIGNAL")).toBe("正式信号");
    expect(evaluationStatusLabel("CANDIDATE_BELOW_THRESHOLD")).toBe("候选未达阈值");
    expect(evaluationStatusLabel("NO_ELIGIBLE_CANDIDATE")).toBe("无合格候选");
    expect(evaluationStatusLabel("INVALID")).toBe("数据无效");
    expect(regimeLabel("LONG_ONLY")).toBe("只做多");
    expect(regimeLabel("SHORT_ONLY")).toBe("只做空");
    expect(regimeLabel("NO_TRADE")).toBe("不交易");
    expect(regimeLabel("BTC_STRONG_BULL")).toBe("BTC 强势上涨");
    expect(regimeLabel("BTC_NEUTRAL")).toBe("BTC 中性");
    expect(regimeLabel("BTC_STRONG_BEAR")).toBe("BTC 强势下跌");
    expect(reviewStatusLabel("NO_REVIEW")).toBe("待首次复盘");
    expect(reviewStatusLabel("WAITING_ENTRY")).toBe("待入场");
    expect(reviewStatusLabel("OPEN")).toBe("观察中");
    expect(reviewStatusLabel("TP")).toBe("止盈");
    expect(reviewStatusLabel("SL")).toBe("止损");
    expect(reviewStatusLabel("NO_ENTRY")).toBe("未入场失效");
    expect(reviewStatusLabel("AMBIGUOUS")).toBe("结果不确定");
  });

  it("keeps production advisory performance independent from tp_signal_results", () => {
    const queries = readFileSync("src/lib/dashboard/queries.ts", "utf8");
    const performancePage = readFileSync("src/app/dashboard/performance/page.tsx", "utf8");
    const dashboardUi = readFileSync("src/app/dashboard/dashboard-ui.tsx", "utf8");
    expect(queries).not.toContain("tp_signal_results");
    expect(queries).toContain("reviewMetrics: calculateReviewMetrics([])");
    expect(queries).toContain('.filter((advisory) => advisory.deliveryStatus === "SENT")');
    expect(performancePage).not.toContain("tp_signal_results");
    expect(dashboardUi).toContain("暂无已结算 TP / SL 复盘样本");
    expect(dashboardUi).toContain("策略盈利能力尚未验证");
  });

  it("counts only missing or active review states as pending", () => {
    expect(countPendingReviews(
      ["waiting", "open", "tp", "sl", "no-entry", "ambiguous", "missing"],
      [
        { signalId: "waiting", status: "WAITING_ENTRY" },
        { signalId: "open", status: "OPEN" },
        { signalId: "tp", status: "TP" },
        { signalId: "sl", status: "SL" },
        { signalId: "no-entry", status: "NO_ENTRY" },
        { signalId: "ambiguous", status: "AMBIGUOUS" },
      ],
    )).toBe(3);
  });

  it("does not infer PnL when there are no authoritative resolved results", () => {
    const metrics = calculateReviewMetrics([]);
    expect(metrics.hasValidSample).toBe(false);
    expect(metrics.winRate).toBeNull();
    expect(metrics.cumulativeR).toBeNull();
    expect(formatR(metrics.cumulativeR)).toBe("—");
  });

  it("calculates R metrics only from finite resolved values", () => {
    const metrics = calculateReviewMetrics([{ resultR: 2 }, { resultR: -1 }, { resultR: 0 }, { resultR: null }]);
    expect(metrics).toMatchObject({ hasValidSample: true, reviewedSignals: 3, wins: 1, losses: 1, winRate: 1 / 3, cumulativeR: 1, averageR: 1 / 3, profitFactor: 2, maxDrawdownR: -1 });
  });

  it("orders resolved R metrics by exit candle time for drawdown", () => {
    const metrics = calculateReviewMetrics([
      { resultR: 2, exitCandleTime: "2026-08-26T02:00:00.000Z" },
      { resultR: -1, exitCandleTime: "2026-08-26T01:00:00.000Z" },
    ]);
    expect(metrics.cumulativeR).toBe(1);
    expect(metrics.maxDrawdownR).toBe(-1);
  });
});
