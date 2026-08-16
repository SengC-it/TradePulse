import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import { BACKTEST_PERIOD_RANGES, BACKTEST_POLICY, isBacktestPeriod, type BacktestPeriod } from "../src/lib/backtest/constants.ts";
import { runBacktest } from "../src/lib/backtest/runner.ts";
import { serializeBacktestReport } from "../src/lib/backtest/report.ts";
import type { BacktestData } from "../src/lib/backtest/types.ts";
import type { HistoricalStudyData } from "../src/lib/historical-data/types.ts";
import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function periodFromArguments(): BacktestPeriod {
  const value = argument("--period") ?? "COMBINED";
  if (!isBacktestPeriod(value)) {
    throw new Error("--period must be DEV, OOS, or COMBINED.");
  }
  return value;
}

function floorToInterval(value: number, interval: number): number {
  return Math.floor(value / interval) * interval;
}

function loadRanges(period: BacktestPeriod): Readonly<{
  candleRange: Readonly<Record<"1h" | "4h", { startTime: number; endTime: number; settlementOnly?: boolean }>>;
  fundingRange: { startTime: number; endTime: number; settlementOnly?: boolean };
  settlementTail?: {
    candleRange: { startTime: number; endTime: number; settlementOnly?: boolean };
    fundingRange: { startTime: number; endTime: number; settlementOnly?: boolean };
  };
}> {
  const startPeriod = period === "OOS" ? BACKTEST_PERIOD_RANGES.OOS : BACKTEST_PERIOD_RANGES.DEV;
  const endPeriod = period === "DEV" ? BACKTEST_PERIOD_RANGES.DEV : BACKTEST_PERIOD_RANGES.OOS;
  const warmupStart = startPeriod.startTime - BACKTEST_POLICY.warmupCandles4h * INTERVAL_MS["4h"];
  const baseEnd1h = floorToInterval(endPeriod.endTime, INTERVAL_MS["1h"]);
  const baseEnd4h = floorToInterval(endPeriod.endTime, INTERVAL_MS["4h"]);
  const tailStart = baseEnd1h + INTERVAL_MS["1h"];
  const tailEnd = baseEnd1h + BACKTEST_POLICY.heldCandleCount * INTERVAL_MS["1h"];
  return {
    candleRange: {
      "1h": { startTime: warmupStart, endTime: baseEnd1h },
      "4h": { startTime: floorToInterval(warmupStart, INTERVAL_MS["4h"]), endTime: baseEnd4h },
    },
    fundingRange: { startTime: warmupStart, endTime: baseEnd1h },
    ...(period !== "DEV"
      ? {
          settlementTail: {
            candleRange: { startTime: tailStart, endTime: tailEnd },
            fundingRange: { startTime: tailStart, endTime: tailEnd + INTERVAL_MS["1h"] - 1 },
          },
        }
      : {}),
  };
}

function toBacktestData(study: HistoricalStudyData): BacktestData {
  const datasets = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [
      symbol,
      {
        candles1h: study.datasets[symbol].candles1h.candles,
        candles4h: study.datasets[symbol].candles4h.candles,
      },
    ]),
  ) as BacktestData["datasets"];
  const funding = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.funding[symbol].records]),
  ) as BacktestData["funding"];
  return { datasets, funding, manifests: study.manifests };
}

async function main(): Promise<void> {
  const period = periodFromArguments();
  const loader = new BinanceHistoricalDataLoader();
  const study = await loader.loadStudyData(loadRanges(period));
  const report = runBacktest({ period, data: toBacktestData(study) });
  const outputDirectory = path.resolve(process.cwd(), ".tmp", "backtest");
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `${period.toLowerCase()}-report.json`);
  writeFileSync(outputPath, serializeBacktestReport(report), "utf8");
  console.log(`Backtest report: ${outputPath}`);
  console.log(`Status: ${report.status}`);
  console.log(`Evaluations: ${report.metrics.totalEvaluations}`);
  console.log(`Formal signals: ${report.metrics.totalFormalSignals}`);
  console.log(`Executed trades: ${report.metrics.executedTrades}`);
}

await main();
