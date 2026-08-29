import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { readR12SpecConformance } from "../src/lib/research/m3-r12-round-012-conformance.ts";
import { executeR12Authoritative, existingR12OutputArtifacts, publishR12ArtifactsAtomically, r12ArtifactSizes, R12AuthoritativeExecutionError } from "../src/lib/research/m3-r12-round-012-performance.ts";
import { R12_PLAN_SHA256, validateR12Plan } from "../src/lib/research/m3-r12-round-012-plan.ts";
import { R12_SELECTION_GATE_SHA256, validateR12MachineRecord } from "../src/lib/research/selection-gates-round-012.ts";
import { M3_R12_BASE_SOURCE_SHA, M3_R12_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r12-round-012-protocol.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message: string): never {
  throw new Error(message);
}

const sourceSha = argument("--source-sha");
const round = argument("--round");
const gateSha = argument("--gate-sha");
const planSha = argument("--plan-sha");
const cacheDirectory = path.resolve(argument("--cache-directory") ?? path.join(process.cwd(), ".cache", "tradepulse", "round-006"));
const acceptedServerTime = argument("--study-server-time");
if (!process.argv.includes("--confirm-authoritative-run")) fail("R12 authoritative performance requires --confirm-authoritative-run.");
if (!sourceSha || !/^[0-9a-f]{40}$/u.test(sourceSha)) fail("R12 authoritative performance requires a 40-character --source-sha.");
if (round !== M3_R12_RESEARCH_ROUND_ID) fail(`R12 round mismatch: expected ${M3_R12_RESEARCH_ROUND_ID}.`);
if (gateSha !== R12_SELECTION_GATE_SHA256) fail("R12 Gate SHA mismatch.");
if (planSha !== R12_PLAN_SHA256) fail("R12 Plan SHA mismatch.");
if (git(["rev-parse", "HEAD"]) !== sourceSha) fail(`R12 source SHA mismatch: expected ${sourceSha}.`);
if (git(["status", "--porcelain"]) !== "") fail("R12 authoritative performance requires a clean worktree.");
if (sourceSha === M3_R12_BASE_SOURCE_SHA) fail("R12 execution source must be the final frozen execution commit, not the accepted R11 base source.");
if (!existsSync(cacheDirectory)) fail(`R12 acquisition cache is missing: ${cacheDirectory}`);
const existing = existingR12OutputArtifacts();
if (existing.length > 0) fail(`R12 output artifacts already exist: ${existing.join(", ")}`);

validateR12MachineRecord();
validateR12Plan();
readR12SpecConformance();
const artifacts = await executeR12Authoritative({ cacheDirectory, executionSourceSha: sourceSha, ...(acceptedServerTime ? { acceptedServerTime: Number(acceptedServerTime) } : {}) });
try {
  publishR12ArtifactsAtomically({ artifacts });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new R12AuthoritativeExecutionError("POST_PERFORMANCE_EVIDENCE_PUBLISH_ABORT", `R12 evidence publication failed: ${message}`, { cause: error });
}
console.log(JSON.stringify({
  status: "PASS",
  head: git(["rev-parse", "HEAD"]),
  researchRoundId: artifacts.report.researchRoundId,
  performanceExecutionCount: artifacts.report.performanceExecutionCount,
  performanceLockTriggered: artifacts.report.performanceLockTriggered,
  evidenceStatus: artifacts.report.evidenceStatus,
  integrityErrors: artifacts.report.integrityErrors,
  eligibleCandidateIds: artifacts.report.selection.eligibleCandidateIds,
  selectedCandidateId: artifacts.report.selection.selectedCandidateId,
  finalDecision: artifacts.report.selection.finalDecision,
  outputSizes: r12ArtifactSizes(),
  cacheDirectory,
}, null, 2));
