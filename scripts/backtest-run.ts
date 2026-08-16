import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import { isBacktestPeriod, type BacktestPeriod } from "../src/lib/backtest/constants.ts";
import { buildHistoricalLoadRanges } from "../src/lib/backtest/ranges.ts";
import { runBacktest } from "../src/lib/backtest/runner.ts";
import { serializeBacktestReport } from "../src/lib/backtest/report.ts";
import type { BacktestData } from "../src/lib/backtest/types.ts";
import type { HistoricalStudyData } from "../src/lib/historical-data/types.ts";

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

export { buildHistoricalLoadRanges as loadRanges } from "../src/lib/backtest/ranges.ts";

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
  return { datasets, funding, manifests: study.manifests, serverTime: study.serverTime };
}

async function main(): Promise<void> {
  const period = periodFromArguments();
  const loader = new BinanceHistoricalDataLoader();
  const study = await loader.loadStudyData(buildHistoricalLoadRanges(period));
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

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
