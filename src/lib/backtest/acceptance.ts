import { BACKTEST_POLICY, type BacktestPeriod } from "./constants.ts";
import type { BacktestAcceptance, BacktestMetrics, BacktestRunStatus } from "./types.ts";

export function evaluateBacktestAcceptance(input: Readonly<{
  period: BacktestPeriod;
  metrics: BacktestMetrics;
  runStatus?: BacktestRunStatus;
}>): BacktestAcceptance {
  const incomplete =
    input.runStatus === "INCOMPLETE" ||
    input.metrics.dataIncomplete > 0 ||
    input.metrics.settlementAmbiguous > 0;
  if (input.period === "DEV") {
    if (incomplete) {
      return Object.freeze({
        status: "INCOMPLETE",
        reasons: Object.freeze(["Required historical data or settlement ordering is incomplete."]),
        checks: Object.freeze({}),
      });
    }
    return Object.freeze({
      status: "DESCRIPTIVE",
      reasons: Object.freeze(["DEV is descriptive only; no acceptance gate is applied."]),
      checks: Object.freeze({}),
    });
  }

  const sampleMinimum = input.period === "OOS" ? 30 : 100;
  const profitFactorMinimum = input.period === "OOS" ? 1.1 : 1.25;
  const checks: Record<string, boolean | null> = {
    minimumExecutedTrades: input.metrics.executedTrades >= sampleMinimum,
    positiveNetR: input.metrics.netR > 0,
    positiveExpectancy: input.metrics.expectancyR !== null && input.metrics.expectancyR > 0,
    minimumProfitFactor:
      input.metrics.profitFactor !== null && input.metrics.profitFactor >= profitFactorMinimum,
    topSymbolConcentration:
      input.metrics.topSymbolShareOfPositiveNetR === null
        ? null
        : input.metrics.topSymbolShareOfPositiveNetR <= 0.6,
    largestTradeConcentration:
      input.metrics.largestSingleTradeShareOfPositiveNetR === null
        ? null
        : input.metrics.largestSingleTradeShareOfPositiveNetR <= 0.2,
  };
  const reasons: string[] = [];
  if (incomplete) {
    return Object.freeze({
      status: "INCOMPLETE",
      reasons: Object.freeze(["Required historical data or settlement ordering is incomplete."]),
      checks: Object.freeze(checks),
    });
  }
  if (input.metrics.executedTrades < sampleMinimum) {
    reasons.push(`Executed trade sample is below the frozen minimum of ${sampleMinimum}.`);
  }
  if (input.metrics.executedTrades < sampleMinimum) {
    return Object.freeze({
      status: "INSUFFICIENT_SAMPLE",
      reasons: Object.freeze(reasons),
      checks: Object.freeze(checks),
    });
  }
  if (input.metrics.netR <= 0) reasons.push("Net R is not positive.");
  if (input.metrics.expectancyR === null || input.metrics.expectancyR <= 0) reasons.push("Expectancy R is not positive.");
  if (input.metrics.profitFactor === null || input.metrics.profitFactor < profitFactorMinimum) {
    reasons.push(`Profit factor is below the frozen minimum of ${profitFactorMinimum}.`);
  }
  if (
    input.metrics.topSymbolShareOfPositiveNetR === null ||
    input.metrics.topSymbolShareOfPositiveNetR > 0.6
  ) {
    reasons.push("Top-symbol positive-R concentration exceeds the frozen 60% limit or is unavailable.");
  }
  if (
    input.metrics.largestSingleTradeShareOfPositiveNetR === null ||
    input.metrics.largestSingleTradeShareOfPositiveNetR > 0.2
  ) {
    reasons.push("Largest-trade positive-R concentration exceeds the frozen 20% limit or is unavailable.");
  }
  return Object.freeze({
    status: reasons.length === 0 ? "PASS" : "FAIL",
    reasons: Object.freeze(reasons),
    checks: Object.freeze(checks),
  });
}

export const evaluateAcceptance = evaluateBacktestAcceptance;

export function evaluateOverallBacktestAcceptance(input: Readonly<{
  period: BacktestPeriod;
  acceptanceByPeriod: Readonly<Record<"DEV" | "OOS" | "COMBINED", BacktestAcceptance | null>>;
}>): BacktestAcceptance {
  const selected = input.acceptanceByPeriod[input.period];
  if (input.period === "DEV") {
    return selected ?? Object.freeze({
      status: "INCOMPLETE",
      reasons: Object.freeze(["DEV acceptance is unavailable because the run is incomplete."]),
      checks: Object.freeze({}),
    });
  }
  if (input.period === "OOS") {
    return selected ?? Object.freeze({
      status: "INCOMPLETE",
      reasons: Object.freeze(["OOS acceptance is unavailable because the run is incomplete."]),
      checks: Object.freeze({}),
    });
  }

  const combined = input.acceptanceByPeriod.COMBINED;
  const oos = input.acceptanceByPeriod.OOS;
  const acceptances = [combined, oos].filter((value): value is BacktestAcceptance => value !== null);
  const statuses = acceptances.map((acceptance) => acceptance.status);
  const status = statuses.includes("INCOMPLETE")
    ? "INCOMPLETE"
    : statuses.includes("INSUFFICIENT_SAMPLE")
      ? "INSUFFICIENT_SAMPLE"
      : statuses.includes("FAIL")
        ? "FAIL"
        : statuses.length === 2 && statuses.every((value) => value === "PASS")
          ? "PASS"
          : "INCOMPLETE";
  const reasons = acceptances.flatMap((acceptance) => acceptance.reasons);
  if (status !== "PASS" && acceptances.length < 2) reasons.push("Both COMBINED and OOS acceptance decisions are required.");
  const checks = Object.fromEntries(
    acceptances.flatMap((acceptance, index) =>
      Object.entries(acceptance.checks).map(([key, value]) => [`${index === 0 ? "combined" : "oos"}.${key}`, value]),
    ),
  );
  return Object.freeze({
    status,
    reasons: Object.freeze(reasons),
    checks: Object.freeze(checks),
  });
}

export const evaluateOverallAcceptance = evaluateOverallBacktestAcceptance;

export const acceptancePolicy = Object.freeze({
  combinedMinimumExecutedTrades: 100,
  oosMinimumExecutedTrades: 30,
  combinedMinimumProfitFactor: 1.25,
  oosMinimumProfitFactor: 1.1,
  topSymbolShareMaximum: 0.6,
  largestTradeShareMaximum: 0.2,
  strategyWindowCandles: BACKTEST_POLICY.strategyWindowCandles,
});
