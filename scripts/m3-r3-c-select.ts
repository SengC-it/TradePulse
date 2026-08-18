import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import {
  M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256,
  M3_R3_C_SOURCE_MAIN_SHA,
  createM3R3CSelectionReport,
  renderM3R3CSelectionMarkdown,
  serializeM3R3CSelectionReport,
  sha256M3R3CSelectionRawBytes,
} from "../src/lib/research/m3-r3-c-selection.ts";

const inputPath = "docs/evidence/M3_R3_ROUND_003_SUMMARY.json";
const outputJsonPath = "docs/evidence/M3_R3_C_SELECTION.json";
const outputMarkdownPath = "docs/M3_R3_C_SELECTION.md";

function fail(message: string): never {
  console.error(`M3-R3-C SELECTION FAILED: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function currentGitSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function assertCleanWorktree(): void {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
  if (status !== "") fail("worktree is not clean.");
}

try {
  assertCleanWorktree();
  const executionSourceSha = currentGitSha();
  if (!/^[0-9a-f]{40}$/u.test(executionSourceSha)) fail("current HEAD is not a valid Git SHA.");
  if (executionSourceSha === M3_R3_C_SOURCE_MAIN_SHA) fail("current HEAD is the main base, not Commit A.");
  if (existsSync(outputJsonPath) || existsSync(outputMarkdownPath)) fail("selection output already exists; refusing a second authoritative run.");

  const evidenceBytes = readFileSync(inputPath);
  const inputEvidenceSha256 = createHash("sha256").update(evidenceBytes).digest("hex");
  if (inputEvidenceSha256 !== M3_R3_C_EXPECTED_INPUT_EVIDENCE_SHA256) fail("input evidence SHA-256 mismatch.");
  const evidence = JSON.parse(evidenceBytes.toString("utf8")) as unknown;
  const report = createM3R3CSelectionReport({
    evidence,
    inputEvidencePath: inputPath,
    inputEvidenceSha256,
    executionSourceSha,
    sourceMainSha: M3_R3_C_SOURCE_MAIN_SHA,
  });
  const jsonBytes = Buffer.from(serializeM3R3CSelectionReport(report), "utf8");
  const selectionJsonSha256 = sha256M3R3CSelectionRawBytes(jsonBytes);
  writeFileSync(outputJsonPath, jsonBytes);
  writeFileSync(outputMarkdownPath, renderM3R3CSelectionMarkdown(report, selectionJsonSha256), "utf8");
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    executionSourceSha,
    inputEvidenceSha256,
    selectionJsonSha256,
    integrityStatus: report.integrityStatus,
    eligibleCandidateIds: report.eligibleCandidateIds,
    selectedCandidateId: report.selectedCandidateId,
    finalDecision: report.finalDecision,
    baseline002Status: report.baseline002Status,
    m3JStatus: report.m3JStatus,
    m4Status: report.m4Status,
  }, null, 2));
} catch (error) {
  if (process.exitCode !== 1) {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.message : error);
  }
}
