import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  M3_R3_B_RECOVERY_MAIN_BASE_SHA,
  M3_R3_B_PERFORMANCE_LOCK,
  deriveM3R3BRound003Evidence,
  renderM3R3BRound003Results,
  serializeM3R3BRound003Evidence,
  sha256M3R3RawBytes,
} from "../src/lib/research/m3-r3-b-round-003-evidence.ts";
import { M3_R3_ROUND_003_CANDIDATE_IDS } from "../src/lib/research/selection-gates-round-003.ts";

const controlPath = ".tmp/m3-r2-round002-control.json";
const snapshotPath = ".tmp/m3-r2-round002-decision-snapshots.json";
const round001EvidencePath = "docs/evidence/M3_H_ROUND_001_SUMMARY.json";
const reuseVerificationPath = "docs/evidence/M3_R3_A_REUSE_VERIFICATION.json";
const outputJsonPath = "docs/evidence/M3_R3_ROUND_003_SUMMARY.json";
const outputMarkdownPath = "docs/M3_R3_ROUND_003_RESULTS.md";

function printFailure(status: string, detail?: string): never {
  console.error(JSON.stringify(detail ? { status, detail } : { status }));
  process.exitCode = 1;
  throw new Error(status);
}

function gitOutput(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

if (!existsSync(controlPath) || !existsSync(snapshotPath) || !existsSync(round001EvidencePath) || !existsSync(reuseVerificationPath)) {
  printFailure("ROUND_003_INPUT_ARTIFACTS_UNAVAILABLE");
}

const executionSourceSha = gitOutput("rev-parse", "HEAD");
if (gitOutput("status", "--porcelain", "--untracked-files=all").length !== 0) {
  printFailure("ROUND_003_WORKTREE_NOT_CLEAN");
}
try {
  execFileSync("git", ["merge-base", "--is-ancestor", M3_R3_B_RECOVERY_MAIN_BASE_SHA, executionSourceSha]);
} catch {
  printFailure("ROUND_003_RECOVERY_MAIN_BASE_MISMATCH");
}

try {
  const controlReportBytes = readFileSync(controlPath);
  const decisionSnapshotBytes = readFileSync(snapshotPath);
  const round001EvidenceBytes = readFileSync(round001EvidencePath);
  const reuseVerification = JSON.parse(readFileSync(reuseVerificationPath, "utf8")) as unknown;
  const evidence = deriveM3R3BRound003Evidence({
    controlReportBytes,
    decisionSnapshotBytes,
    round001EvidenceBytes,
    reuseVerification,
    executionSourceSha,
    recoveryMainBaseSha: M3_R3_B_RECOVERY_MAIN_BASE_SHA,
  });
  if (evidence.performanceLock !== M3_R3_B_PERFORMANCE_LOCK || !evidence.performanceLockTriggered) {
    printFailure("ROUND_003_PERFORMANCE_LOCK_NOT_TRIGGERED");
  }
  const serialized = Buffer.from(serializeM3R3BRound003Evidence(evidence), "utf8");
  writeFileSync(outputJsonPath, serialized);
  writeFileSync(outputMarkdownPath, renderM3R3BRound003Results(evidence), "utf8");
  console.log(JSON.stringify({
    status: evidence.evidenceStatus,
    decision: evidence.decision,
    executionSourceSha,
    performanceLock: evidence.performanceLock,
    performanceLockTriggered: evidence.performanceLockTriggered,
    candidateCount: M3_R3_ROUND_003_CANDIDATE_IDS.length,
    candidateIds: M3_R3_ROUND_003_CANDIDATE_IDS,
    outputJsonPath,
    outputMarkdownPath,
    round003EvidenceSha256: sha256M3R3RawBytes(serialized),
  }));
} catch (error) {
  if (error instanceof Error && error.message === "ROUND_003_PERFORMANCE_LOCK_NOT_TRIGGERED") throw error;
  const status = error instanceof Error && error.name === "M3R3RecoveryError"
    ? error.message.split(":", 1)[0]
    : error instanceof Error && error.name === "M3R3BEvidenceError"
      ? error.message.split(":", 1)[0]
      : "ROUND_003_DERIVATION_FAILED";
  printFailure(status);
}
