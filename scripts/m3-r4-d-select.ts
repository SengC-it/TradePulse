import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  M3_R4_D_EXPECTED_INPUT_AUDIT_SHA256,
  M3_R4_D_EXPECTED_INPUT_RESULTS_SHA256,
  M3_R4_D_EXPECTED_INPUT_SUMMARY_SHA256,
  M3_R4_D_GATE_APPLICATION_SOURCE_SHA,
  createM3R4DSelectionReport,
  renderM3R4DSelectionMarkdown,
  serializeM3R4DSelectionReport,
  sha256M3R4DSelectionRawBytes,
} from "../src/lib/research/m3-r4-d-selection.ts";
import {
  BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256,
  M3_R4_ROUND_004_RESEARCH_ROUND_ID,
  validateM3R4Round004MachineRecord,
} from "../src/lib/research/selection-gates-round-004.ts";
import { M3_R4_ROUND_004_PLAN_SHA256, validateM3R4Round004Plan } from "../src/lib/research/m3-r4-round-004-plan.ts";

export const M3_R4_D_SELECTION_INPUT_PATH = "docs/evidence/M3_R4_ROUND_004_SUMMARY.json";
export const M3_R4_D_SELECTION_OUTPUT_JSON_PATH = "docs/evidence/M3_R4_D_SELECTION.json";
export const M3_R4_D_SELECTION_OUTPUT_MARKDOWN_PATH = "docs/M3_R4_D_SELECTION.md";

export type M3R4DAuthorizationArguments = Readonly<{
  sourceSha: string;
  round: string;
  gateSha: string;
  planSha: string;
  inputSummarySha: string;
}>;

function valueAfter(argv: readonly string[], flag: string): string {
  const index = argv.indexOf(flag);
  if (index < 0 || argv[index + 1] === undefined || argv[index + 1]!.startsWith("--")) throw new Error(`missing ${flag}`);
  return argv[index + 1]!;
}

export function parseM3R4DSelectionArguments(argv: readonly string[]): M3R4DAuthorizationArguments {
  if (!argv.includes("--confirm-authoritative-selection")) throw new Error("missing --confirm-authoritative-selection");
  return Object.freeze({
    sourceSha: valueAfter(argv, "--source-sha"),
    round: valueAfter(argv, "--round"),
    gateSha: valueAfter(argv, "--gate-sha"),
    planSha: valueAfter(argv, "--plan-sha"),
    inputSummarySha: valueAfter(argv, "--input-summary-sha"),
  });
}

function fail(message: string): never {
  throw new Error(`M3-R4-D selection refused: ${message}`);
}

function currentGitSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function assertCleanWorktree(): void {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
  if (status !== "") fail("worktree is not clean.");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertExpectedHash(path: string, bytes: Uint8Array, expected: string): void {
  if (sha256(bytes) !== expected) fail(`${path} SHA-256 mismatch.`);
}

function assertAuthorization(args: M3R4DAuthorizationArguments): void {
  assertCleanWorktree();
  if (currentGitSha() !== args.sourceSha || args.sourceSha !== M3_R4_D_GATE_APPLICATION_SOURCE_SHA) fail("source SHA mismatch.");
  if (args.round !== M3_R4_ROUND_004_RESEARCH_ROUND_ID) fail("research round mismatch.");
  if (args.gateSha !== BASELINE_002_RESEARCH_ROUND_004_SELECTION_GATE_SHA256) fail("Gate SHA mismatch.");
  if (args.planSha !== M3_R4_ROUND_004_PLAN_SHA256) fail("Plan SHA mismatch.");
  if (args.inputSummarySha !== M3_R4_D_EXPECTED_INPUT_SUMMARY_SHA256) fail("summary SHA mismatch.");
  if (existsSync(M3_R4_D_SELECTION_OUTPUT_JSON_PATH) || existsSync(M3_R4_D_SELECTION_OUTPUT_MARKDOWN_PATH)) fail("selection output already exists.");
  validateM3R4Round004MachineRecord();
  validateM3R4Round004Plan();
  assertExpectedHash(M3_R4_D_SELECTION_INPUT_PATH, readFileSync(M3_R4_D_SELECTION_INPUT_PATH), M3_R4_D_EXPECTED_INPUT_SUMMARY_SHA256);
  assertExpectedHash("docs/evidence/M3_R4_ROUND_004_AUDIT.json", readFileSync("docs/evidence/M3_R4_ROUND_004_AUDIT.json"), M3_R4_D_EXPECTED_INPUT_AUDIT_SHA256);
  assertExpectedHash("docs/M3_R4_ROUND_004_RESULTS.md", readFileSync("docs/M3_R4_ROUND_004_RESULTS.md"), M3_R4_D_EXPECTED_INPUT_RESULTS_SHA256);
}

export function runM3R4DAuthoritativeSelection(args: M3R4DAuthorizationArguments): void {
  assertAuthorization(args);
  const inputHashes = {
    summary: args.inputSummarySha,
    audit: M3_R4_D_EXPECTED_INPUT_AUDIT_SHA256,
    results: M3_R4_D_EXPECTED_INPUT_RESULTS_SHA256,
  } as const;
  const evidence = JSON.parse(readFileSync(M3_R4_D_SELECTION_INPUT_PATH, "utf8")) as unknown;
  const report = createM3R4DSelectionReport({ evidence, inputSummaryPath: M3_R4_D_SELECTION_INPUT_PATH, inputHashes });
  if (report.integrityStatus !== "COMPLETE") fail(`input evidence is ${report.integrityStatus}.`);
  const jsonBytes = Buffer.from(serializeM3R4DSelectionReport(report), "utf8");
  const selectionJsonSha256 = sha256M3R4DSelectionRawBytes(jsonBytes);
  writeFileSync(M3_R4_D_SELECTION_OUTPUT_JSON_PATH, jsonBytes, { flag: "wx" });
  writeFileSync(M3_R4_D_SELECTION_OUTPUT_MARKDOWN_PATH, renderM3R4DSelectionMarkdown(report, selectionJsonSha256), { flag: "wx", encoding: "utf8" });
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    researchRoundId: report.researchRoundId,
    performanceExecutionSourceSha: report.performanceExecutionSourceSha,
    inputSummarySha256: report.inputSummarySha256,
    selectionJsonSha256,
    integrityStatus: report.integrityStatus,
    eligibleCandidateIds: report.eligibleCandidateIds,
    selectedCandidateId: report.selectedCandidateId,
    finalDecision: report.finalDecision,
    baseline002Status: report.baseline002Status,
    m3JStatus: report.m3JStatus,
    m4Status: report.m4Status,
  }, null, 2));
}

if (process.argv[1]?.endsWith("m3-r4-d-select.ts")) {
  try {
    runM3R4DAuthoritativeSelection(parseM3R4DSelectionArguments(process.argv.slice(2)));
  } catch (error) {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.message : error);
  }
}
