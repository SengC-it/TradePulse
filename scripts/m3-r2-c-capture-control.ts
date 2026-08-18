import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import { loadBacktestDataForRun } from "./backtest-run.ts";
import { runBacktest } from "../src/lib/backtest/runner.ts";
import { serializeBacktestReport } from "../src/lib/backtest/report.ts";
import {
  createM3R2DecisionSnapshotArtifact,
  M3_R2_C_MAIN_BASE_SHA,
  M3_R2_C_PERFORMANCE_LOCK,
  serializeM3R2DecisionSnapshotArtifact,
  sha256M3R2CRawBytes,
  validateM3R2CControlReport,
  validateM3R2CPlanConstants,
} from "../src/lib/research/m3-r2-c-evidence.ts";
import {
  BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
  validateM3R2Round002MachineRecord,
} from "../src/lib/research/selection-gates-round-002.ts";
import {
  M3_R2_ROUND_002_PLAN_SHA256,
  validateM3R2Round002Plan,
} from "../src/lib/research/m3-r2-round-002-plan.ts";

const ROUND_ID = "baseline-002-research-round-002";
const CONTROL_REPORT_DEFAULT = ".tmp/m3-r2-round002-control.json";
const DECISION_SNAPSHOTS_DEFAULT = ".tmp/m3-r2-round002-decision-snapshots.json";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function requiredArgument(name: string): string {
  const value = argument(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function gitOutput(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function assertSourceFreeze(sourceSha: string): void {
  if (gitOutput("branch", "--show-current") !== "agent/m3-r2-c-round002-performance") {
    throw new Error("M3-R2-C CONTROL must run on agent/m3-r2-c-round002-performance.");
  }
  if (gitOutput("rev-parse", "HEAD") !== sourceSha) {
    throw new Error("M3-R2-C execution source SHA does not match the current HEAD.");
  }
  const status = gitOutput("status", "--porcelain", "--untracked-files=all");
  if (status.length > 0) throw new Error(`M3-R2-C source freeze is not clean:\n${status}`);
}

function writeExclusive(filePath: string, content: string): Uint8Array {
  if (existsSync(filePath)) throw new Error(`Refusing to overwrite existing M3-R2-C artifact: ${filePath}`);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
  return readFileSync(filePath);
}

async function main(): Promise<void> {
  const sourceSha = requiredArgument("--source-sha");
  const selectionGateSha = requiredArgument("--selection-gate-sha");
  const experimentPlanSha = requiredArgument("--plan-sha");
  const round = requiredArgument("--round");
  const controlReportPath = path.resolve(argument("--control-report") ?? CONTROL_REPORT_DEFAULT);
  const decisionSnapshotsPath = path.resolve(argument("--decision-snapshots") ?? DECISION_SNAPSHOTS_DEFAULT);

  if (round !== ROUND_ID) throw new Error("M3-R2-C round identifier does not match the frozen round.");
  if (sourceSha !== M3_R2_C_MAIN_BASE_SHA && sourceSha.trim().length === 0) throw new Error("Invalid M3-R2-C source SHA.");
  if (selectionGateSha !== BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256) throw new Error("Selection gate SHA does not match the frozen Round-002 gate.");
  if (experimentPlanSha !== M3_R2_ROUND_002_PLAN_SHA256) throw new Error("Experiment plan SHA does not match the frozen Round-002 plan.");
  validateM3R2Round002Plan();
  validateM3R2Round002MachineRecord();
  validateM3R2CPlanConstants();
  assertSourceFreeze(sourceSha);
  if (existsSync(controlReportPath) || existsSync(decisionSnapshotsPath)) {
    throw new Error("M3-R2-C CONTROL artifacts already exist; refusing a second historical run.");
  }

  const loader = new BinanceHistoricalDataLoader({
    clientOptions: { timeoutMs: 15_000, maxAttempts: 3 },
  });
  const data = await loadBacktestDataForRun(loader, "COMBINED", "bt-policy-003");
  const report = runBacktest({ period: "COMBINED", policy: "bt-policy-003", data });
  const performanceLockTriggered = true;
  const controlReport = validateM3R2CControlReport(report);
  const controlBytes = writeExclusive(controlReportPath, serializeBacktestReport(controlReport));
  const controlReportSha256 = sha256M3R2CRawBytes(controlBytes);
  const decisionSnapshots = createM3R2DecisionSnapshotArtifact({
    controlReport,
    data,
    executionSourceSha: sourceSha,
    selectionGateSha256: selectionGateSha,
    experimentPlanSha256: experimentPlanSha,
    controlReportSha256,
  });
  const decisionBytes = writeExclusive(decisionSnapshotsPath, serializeM3R2DecisionSnapshotArtifact(decisionSnapshots));
  const decisionSnapshotArtifactSha256 = sha256M3R2CRawBytes(decisionBytes);

  console.log(`executionSourceSha: ${sourceSha}`);
  console.log(`selectionGateSha256: ${selectionGateSha}`);
  console.log(`experimentPlanSha256: ${experimentPlanSha}`);
  console.log(`controlReport: ${controlReportPath}`);
  console.log(`controlReportSha256: ${controlReportSha256}`);
  console.log(`decisionSnapshots: ${decisionSnapshotsPath}`);
  console.log(`decisionSnapshotArtifactSha256: ${decisionSnapshotArtifactSha256}`);
  console.log(`studyServerTime: ${controlReport.studyServerTime}`);
  console.log(`snapshotCount: ${decisionSnapshots.snapshotCount}`);
  console.log(`controlStatus: ${controlReport.status}`);
  console.log(`performanceLockTriggered: ${performanceLockTriggered}`);
  console.log(`performanceLock: ${M3_R2_C_PERFORMANCE_LOCK}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
