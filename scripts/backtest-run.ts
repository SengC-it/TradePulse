import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import {
  isBacktestPeriod,
  parseBacktestPolicyArgument,
  type BacktestPeriod,
  type BacktestPolicyVersion,
} from "../src/lib/backtest/constants.ts";
import { buildHistoricalLoadRanges } from "../src/lib/backtest/ranges.ts";
import { runBacktest } from "../src/lib/backtest/runner.ts";
import { discoverIntrabarSettlementRequirements } from "../src/lib/backtest/runner.ts";
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

function policyFromArguments(): BacktestPolicyVersion {
  return parseBacktestPolicyArgument(process.argv);
}

export { buildHistoricalLoadRanges as loadRanges } from "../src/lib/backtest/ranges.ts";

export function toBacktestData(study: HistoricalStudyData): BacktestData {
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
  const markPrice = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.markPrice[symbol]?.candles]),
  ) as BacktestData["markPrice"];
  const markPriceSegments = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.markPriceSegments[symbol]]),
  ) as BacktestData["markPriceSegments"];
  return {
    datasets,
    funding,
    markPrice,
    markPriceSegments,
    ...(study.intrabarSettlementWindows ? { intrabarSettlementWindows: study.intrabarSettlementWindows } : {}),
    manifests: study.manifests,
    serverTime: study.serverTime,
  };
}

type BacktestStudyLoader = Pick<BinanceHistoricalDataLoader, "loadStudyData" | "loadIntrabarSettlementWindows">;

export async function loadBacktestDataForRun(
  loader: BacktestStudyLoader,
  period: BacktestPeriod,
  policy: BacktestPolicyVersion,
): Promise<BacktestData> {
  const study = await loader.loadStudyData({ ...buildHistoricalLoadRanges(period), policy });
  let data = toBacktestData(study);
  if (policy === "bt-policy-003") {
    const requirements = discoverIntrabarSettlementRequirements({ period, data });
    const windows = await loader.loadIntrabarSettlementWindows(requirements, study.serverTime);
    data = {
      ...data,
      intrabarSettlementRequirements: requirements,
      intrabarSettlementWindows: windows,
      manifests: Object.freeze([...data.manifests, ...windows.map((window) => window.manifest)]),
    };
  }
  return data;
}

async function main(): Promise<void> {
  const period = periodFromArguments();
  const policy = policyFromArguments();
  const loader = new BinanceHistoricalDataLoader();
  const data = await loadBacktestDataForRun(loader, period, policy);
  const report = runBacktest({ period, policy, data });
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
