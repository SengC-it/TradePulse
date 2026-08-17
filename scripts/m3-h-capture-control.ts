import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { runBacktest } from "../src/lib/backtest/runner.ts";
import { serializeBacktestReport } from "../src/lib/backtest/report.ts";
import type { BacktestReport } from "../src/lib/backtest/types.ts";
import {
  M3_H_ROUND_001_PLAN_SHA256,
  M3_H_ROUND_001_RESEARCH_ROUND_ID,
  M3_H_ROUND_001_SELECTION_GATE_SHA256,
  validateM3HRound001Plan,
} from "../src/lib/research/m3-h-round-001-plan.ts";
import { validateM3HControlReport } from "../src/lib/research/m3-h-evidence.ts";
import { loadBacktestDataForRun } from "./backtest-run.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";

type CaptureArguments = Readonly<{
  round: string;
  selectionGateSha256: string;
  sourceSha?: string;
  outputPath: string;
}>;

function argument(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseM3HCaptureArguments(argv: readonly string[]): CaptureArguments {
  const round = argument(argv, "--round");
  const selectionGateSha256 = argument(argv, "--selection-gate-sha");
  if (!round) throw new Error("--round is required.");
  if (!selectionGateSha256) throw new Error("--selection-gate-sha is required.");
  return {
    round,
    selectionGateSha256,
    sourceSha: argument(argv, "--source-sha"),
    outputPath: argument(argv, "--output") ?? path.resolve(process.cwd(), ".tmp", "m3-h-round001-control.json"),
  };
}

function gitOutput(args: readonly string[]): string {
  return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();
}

export function requireCleanM3HWorktree(): string {
  const status = gitOutput(["status", "--porcelain", "--untracked-files=all"]);
  if (status.length > 0) throw new Error("M3-H CONTROL capture requires a clean git worktree.");
  return gitOutput(["rev-parse", "HEAD"]);
}

export function validateM3HCaptureArguments(input: CaptureArguments, sourceSha: string): void {
  if (input.round !== M3_H_ROUND_001_RESEARCH_ROUND_ID) throw new Error("Unknown M3-H research round.");
  if (input.selectionGateSha256 !== M3_H_ROUND_001_SELECTION_GATE_SHA256) throw new Error("M3-H selection gate SHA mismatch.");
  if (String(M3_H_ROUND_001_PLAN_SHA256) === "RECOMPUTE_AFTER_PLAN_FREEZE") throw new Error("M3-H experiment plan SHA is not frozen.");
  validateM3HRound001Plan();
  if (input.sourceSha !== undefined && input.sourceSha !== sourceSha) throw new Error("M3-H execution source SHA mismatch.");
}

export async function captureM3HControlReport(input: Readonly<{
  args: CaptureArguments;
  loader: BinanceHistoricalDataLoader;
  sourceSha: string;
}>): Promise<Readonly<{ report: BacktestReport; controlReportSha256: string; studyServerTime: number }>> {
  validateM3HCaptureArguments(input.args, input.sourceSha);
  const data = await loadBacktestDataForRun(input.loader, "COMBINED", "bt-policy-003");
  const report = runBacktest({ period: "COMBINED", policy: "bt-policy-003", data });
  const validated = validateM3HControlReport(report);
  const serialized = serializeBacktestReport(validated);
  mkdirSync(path.dirname(input.args.outputPath), { recursive: true });
  writeFileSync(input.args.outputPath, serialized, "utf8");
  const exactBytes = readFileSync(input.args.outputPath);
  const controlReportSha256 = createHash("sha256").update(exactBytes).digest("hex");
  return { report: validated, controlReportSha256, studyServerTime: validated.studyServerTime };
}

async function main(): Promise<void> {
  const args = parseM3HCaptureArguments(process.argv);
  const sourceSha = requireCleanM3HWorktree();
  validateM3HCaptureArguments(args, sourceSha);
  const result = await captureM3HControlReport({
    args,
    loader: new BinanceHistoricalDataLoader(),
    sourceSha,
  });
  console.log(`M3-H source SHA: ${sourceSha}`);
  console.log(`M3-H plan SHA: ${M3_H_ROUND_001_PLAN_SHA256}`);
  console.log(`CONTROL report: ${args.outputPath}`);
  console.log(`CONTROL report SHA-256: ${result.controlReportSha256}`);
  console.log(`studyServerTime: ${result.studyServerTime}`);
  console.log(`CONTROL status: ${result.report.status}`);
  console.log(`CONTROL formal signals: ${result.report.metrics.totalFormalSignals}`);
  console.log(`CONTROL executed trades: ${result.report.metrics.executedTrades}`);
  console.log(`symbols: ${RESEARCH_SYMBOLS.join(",")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
