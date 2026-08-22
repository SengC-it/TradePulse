import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import {
  M3_R5_C3A_EXPECTED_INPUT_AUDIT_SHA256,
  M3_R5_C3A_EXPECTED_INPUT_RESULTS_SHA256,
  M3_R5_C3A_EXPECTED_INPUT_SUMMARY_SHA256,
  createM3R5C3ASelectionReport,
  publishM3R5C3ASelectionOutputsAtomically,
  renderM3R5C3ASelectionMarkdown,
  serializeM3R5C3ASelectionReport,
  sha256M3R5C3ARawBytes,
} from "../src/lib/research/m3-r5-c3-selection.ts";
import {
  M3_R5_ROUND_005_RESEARCH_ROUND_ID,
  M3_R5_ROUND_005_SELECTION_GATE_SHA256,
  validateM3R5Round005MachineRecord,
} from "../src/lib/research/selection-gates-round-005.ts";
import { M3_R5_ROUND_005_PLAN_SHA256, validateM3R5Round005Plan } from "../src/lib/research/m3-r5-round-005-plan.ts";

export const M3_R5_C3A_SELECTION_INPUT_SUMMARY_PATH = "docs/evidence/M3_R5_ROUND_005_SUMMARY.json";
export const M3_R5_C3A_SELECTION_OUTPUT_JSON_PATH = "docs/evidence/M3_R5_C3_SELECTION.json";
export const M3_R5_C3A_SELECTION_OUTPUT_MARKDOWN_PATH = "docs/M3_R5_C3_SELECTION.md";

export type M3R5C3AAuthorizationArguments = Readonly<{
  sourceSha: string;
  round: string;
  gateSha: string;
  planSha: string;
  inputSummarySha: string;
  inputAuditSha: string;
  inputResultsSha: string;
}>;

function valueAfter(argv: readonly string[], flag: string): string {
  const index = argv.indexOf(flag);
  if (index < 0 || argv[index + 1] === undefined || argv[index + 1]!.startsWith("--")) throw new Error(`missing ${flag}`);
  return argv[index + 1]!;
}

export function parseM3R5C3ASelectionArguments(argv: readonly string[]): M3R5C3AAuthorizationArguments {
  if (!argv.includes("--confirm-authoritative-selection")) throw new Error("missing --confirm-authoritative-selection");
  return Object.freeze({
    sourceSha: valueAfter(argv, "--source-sha"),
    round: valueAfter(argv, "--round"),
    gateSha: valueAfter(argv, "--gate-sha"),
    planSha: valueAfter(argv, "--plan-sha"),
    inputSummarySha: valueAfter(argv, "--input-summary-sha"),
    inputAuditSha: valueAfter(argv, "--input-audit-sha"),
    inputResultsSha: valueAfter(argv, "--input-results-sha"),
  });
}

function fail(message: string): never {
  throw new Error(`M3-R5-C.3 selection refused: ${message}`);
}

export function validateM3R5C3AWorktreeStatus(status: string): void {
  if (status !== "") fail("worktree is not clean.");
}

export function validateM3R5C3AOutputsAbsent(jsonExists: boolean, markdownExists: boolean): void {
  if (jsonExists || markdownExists) fail("selection output already exists.");
}

export function validateM3R5C3ACommittedBlobHash(path: string, actualSha256: string, expectedSha256: string): void {
  if (actualSha256 !== expectedSha256) fail(`${path} committed Git blob SHA-256 mismatch.`);
}

function currentGitSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

export function readM3R5C3ACommittedBlob(path: string): Buffer {
  return execFileSync("git", ["cat-file", "blob", `HEAD:${path}`], { maxBuffer: 64 * 1024 * 1024 });
}

export function validateM3R5C3AAuthoritativeSource(currentSha: string, requestedSha: string): void {
  if (!/^[0-9a-f]{40}$/u.test(requestedSha)) fail("source SHA is not a 40-character lowercase Git SHA.");
  if (currentSha !== requestedSha) fail("source SHA mismatch.");
}

function assertCleanWorktree(): void {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
  validateM3R5C3AWorktreeStatus(status);
}

function committedBlob(path: string): Buffer {
  return readM3R5C3ACommittedBlob(path);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertExpectedBlob(path: string, bytes: Uint8Array, expected: string): void {
  validateM3R5C3ACommittedBlobHash(path, sha256(bytes), expected);
}

export function assertM3R5C3AAuthorization(args: M3R5C3AAuthorizationArguments): void {
  assertCleanWorktree();
  validateM3R5C3AAuthoritativeSource(currentGitSha(), args.sourceSha);
  if (args.round !== M3_R5_ROUND_005_RESEARCH_ROUND_ID) fail("research round mismatch.");
  if (args.gateSha !== M3_R5_ROUND_005_SELECTION_GATE_SHA256) fail("Gate SHA mismatch.");
  if (args.planSha !== M3_R5_ROUND_005_PLAN_SHA256) fail("Plan SHA mismatch.");
  if (args.inputSummarySha !== M3_R5_C3A_EXPECTED_INPUT_SUMMARY_SHA256) fail("summary SHA mismatch.");
  if (args.inputAuditSha !== M3_R5_C3A_EXPECTED_INPUT_AUDIT_SHA256) fail("audit SHA mismatch.");
  if (args.inputResultsSha !== M3_R5_C3A_EXPECTED_INPUT_RESULTS_SHA256) fail("results SHA mismatch.");
  validateM3R5C3AOutputsAbsent(existsSync(M3_R5_C3A_SELECTION_OUTPUT_JSON_PATH), existsSync(M3_R5_C3A_SELECTION_OUTPUT_MARKDOWN_PATH));

  validateM3R5Round005MachineRecord();
  validateM3R5Round005Plan();
  assertExpectedBlob(M3_R5_C3A_SELECTION_INPUT_SUMMARY_PATH, committedBlob(M3_R5_C3A_SELECTION_INPUT_SUMMARY_PATH), M3_R5_C3A_EXPECTED_INPUT_SUMMARY_SHA256);
  assertExpectedBlob("docs/evidence/M3_R5_ROUND_005_AUDIT.json", committedBlob("docs/evidence/M3_R5_ROUND_005_AUDIT.json"), M3_R5_C3A_EXPECTED_INPUT_AUDIT_SHA256);
  assertExpectedBlob("docs/M3_R5_ROUND_005_RESULTS.md", committedBlob("docs/M3_R5_ROUND_005_RESULTS.md"), M3_R5_C3A_EXPECTED_INPUT_RESULTS_SHA256);
}

export function runM3R5C3AAuthoritativeSelection(args: M3R5C3AAuthorizationArguments): void {
  assertM3R5C3AAuthorization(args);
  const inputHashes = {
    summary: args.inputSummarySha,
    audit: args.inputAuditSha,
    results: args.inputResultsSha,
  } as const;
  const evidence = JSON.parse(committedBlob(M3_R5_C3A_SELECTION_INPUT_SUMMARY_PATH).toString("utf8")) as unknown;
  const report = createM3R5C3ASelectionReport({
    evidence,
    inputSummaryPath: M3_R5_C3A_SELECTION_INPUT_SUMMARY_PATH,
    inputHashes,
    gateApplicationSourceSha: args.sourceSha,
  });
  if (report.integrityStatus !== "COMPLETE") fail(`input evidence is ${report.integrityStatus}.`);
  const jsonBytes = Buffer.from(serializeM3R5C3ASelectionReport(report), "utf8");
  const markdownBytes = Buffer.from(renderM3R5C3ASelectionMarkdown(report, sha256M3R5C3ARawBytes(jsonBytes)), "utf8");
  publishM3R5C3ASelectionOutputsAtomically({
    jsonPath: M3_R5_C3A_SELECTION_OUTPUT_JSON_PATH,
    markdownPath: M3_R5_C3A_SELECTION_OUTPUT_MARKDOWN_PATH,
    jsonBytes,
    markdownBytes,
  });
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    researchRoundId: report.researchRoundId,
    gateApplicationSourceSha: report.gateApplicationSourceSha,
    performanceExecutionSourceSha: report.performanceExecutionSourceSha,
    integrityStatus: report.integrityStatus,
    eligibleCandidateIds: report.eligibleCandidateIds,
    selectedCandidateId: report.selectedCandidateId,
    finalDecision: report.finalDecision,
    baseline002Status: report.baseline002Status,
    m3JStatus: report.m3JStatus,
    m4Status: report.m4Status,
  }, null, 2));
}

if (process.argv[1]?.endsWith("m3-r5-c3-select.ts")) {
  try {
    runM3R5C3AAuthoritativeSelection(parseM3R5C3ASelectionArguments(process.argv.slice(2)));
  } catch (error) {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.message : error);
  }
}
