import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BacktestReport } from "../src/lib/backtest/types.ts";
import {
  deriveM3HRound001Evidence,
  renderM3HResultsMarkdown,
  serializeM3HResearchEvidence,
  sha256RawBytes,
  validateM3HControlReport,
} from "../src/lib/research/m3-h-evidence.ts";
import {
  M3_H_ROUND_001_PLAN_SHA256,
  M3_H_ROUND_001_RESEARCH_ROUND_ID,
  M3_H_ROUND_001_SELECTION_GATE_SHA256,
  validateM3HRound001Plan,
} from "../src/lib/research/m3-h-round-001-plan.ts";

type DeriveArguments = Readonly<{
  round: string;
  selectionGateSha256: string;
  sourceSha: string;
  controlReportPath: string;
  evidenceJsonPath: string;
  evidenceMarkdownPath: string;
}>;

function argument(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseM3HDeriveArguments(argv: readonly string[]): DeriveArguments {
  const round = argument(argv, "--round");
  const selectionGateSha256 = argument(argv, "--selection-gate-sha");
  const sourceSha = argument(argv, "--source-sha");
  if (!round) throw new Error("--round is required.");
  if (!selectionGateSha256) throw new Error("--selection-gate-sha is required.");
  if (!sourceSha) throw new Error("--source-sha is required for offline evidence derivation.");
  return {
    round,
    selectionGateSha256,
    sourceSha,
    controlReportPath: argument(argv, "--control-report") ?? path.resolve(process.cwd(), ".tmp", "m3-h-round001-control.json"),
    evidenceJsonPath: argument(argv, "--evidence-json") ?? path.resolve(process.cwd(), "docs", "evidence", "M3_H_ROUND_001_SUMMARY.json"),
    evidenceMarkdownPath: argument(argv, "--evidence-markdown") ?? path.resolve(process.cwd(), "docs", "M3_H_ROUND_001_RESULTS.md"),
  };
}

function currentSourceSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
}

export function validateM3HDeriveArguments(input: DeriveArguments, currentSha: string): void {
  if (input.round !== M3_H_ROUND_001_RESEARCH_ROUND_ID) throw new Error("Unknown M3-H research round.");
  if (input.selectionGateSha256 !== M3_H_ROUND_001_SELECTION_GATE_SHA256) throw new Error("M3-H selection gate SHA mismatch.");
  if (String(M3_H_ROUND_001_PLAN_SHA256) === "RECOMPUTE_AFTER_PLAN_FREEZE") throw new Error("M3-H experiment plan SHA is not frozen.");
  validateM3HRound001Plan();
  if (input.sourceSha !== currentSha) throw new Error("M3-H evidence source SHA does not match current HEAD.");
}

async function main(): Promise<void> {
  const args = parseM3HDeriveArguments(process.argv);
  validateM3HDeriveArguments(args, currentSourceSha());
  const rawBytes = readFileSync(args.controlReportPath);
  const controlReportSha256 = sha256RawBytes(rawBytes);
  const report = JSON.parse(rawBytes.toString("utf8")) as BacktestReport;
  validateM3HControlReport(report);
  const evidence = deriveM3HRound001Evidence({
    controlReport: report,
    controlReportSha256,
    executionSourceSha: args.sourceSha,
  });
  mkdirSync(path.dirname(args.evidenceJsonPath), { recursive: true });
  mkdirSync(path.dirname(args.evidenceMarkdownPath), { recursive: true });
  writeFileSync(args.evidenceJsonPath, serializeM3HResearchEvidence(evidence), "utf8");
  writeFileSync(args.evidenceMarkdownPath, renderM3HResultsMarkdown(evidence), "utf8");
  console.log(`M3-H evidence status: ${evidence.evidenceStatus}`);
  console.log(`CONTROL report SHA-256: ${controlReportSha256}`);
  console.log(`studyServerTime: ${evidence.studyServerTime}`);
  console.log(`Evidence JSON: ${args.evidenceJsonPath}`);
  console.log(`Evidence Markdown: ${args.evidenceMarkdownPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
