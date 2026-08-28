import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { executeR10Authoritative, existingR10OutputArtifacts, publishR10ArtifactsAtomically, r10ArtifactSizes } from "../src/lib/research/m3-r10-round-010-performance.ts";
import { readR10SpecConformance } from "../src/lib/research/m3-r10-round-010-conformance.ts";
import { validateR10Plan } from "../src/lib/research/m3-r10-round-010-plan.ts";
import { validateR10MachineRecord } from "../src/lib/research/selection-gates-round-010.ts";
import { M3_R10_BASE_SOURCE_SHA } from "../src/lib/research/m3-r10-round-010-protocol.ts";

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
const cacheDirectory = path.resolve(argument("--cache-directory") ?? path.join(process.cwd(), ".cache", "tradepulse", "round-006"));
const acceptedServerTime = argument("--study-server-time");
if (!process.argv.includes("--confirm-authoritative-performance")) fail("R10 authoritative performance requires --confirm-authoritative-performance.");
if (!sourceSha || !/^[0-9a-f]{40}$/u.test(sourceSha)) fail("R10 authoritative performance requires a 40-character --source-sha.");
if (git(["rev-parse", "HEAD"]) !== sourceSha) fail(`R10 source SHA mismatch: expected ${sourceSha}.`);
if (git(["status", "--porcelain"]) !== "") fail("R10 authoritative performance requires a clean worktree.");
if (sourceSha === M3_R10_BASE_SOURCE_SHA) fail("R10 execution source must be the final frozen execution commit, not the base source identity.");
if (!existsSync(cacheDirectory)) fail(`R10 acquisition cache is missing: ${cacheDirectory}`);
const existing = existingR10OutputArtifacts();
if (existing.length > 0) fail(`R10 output artifacts already exist: ${existing.join(", ")}`);

validateR10MachineRecord();
validateR10Plan();
readR10SpecConformance();

const artifacts = await executeR10Authoritative({ cacheDirectory, executionSourceSha: sourceSha, ...(acceptedServerTime ? { acceptedServerTime: Number(acceptedServerTime) } : {}) });
publishR10ArtifactsAtomically({ artifacts });
console.log(JSON.stringify({
  status: "PASS",
  head: git(["rev-parse", "HEAD"]),
  researchRoundId: artifacts.report.researchRoundId,
  performanceExecutionCount: artifacts.report.performanceExecutionCount,
  performanceLockTriggered: artifacts.report.performanceLockTriggered,
  evidenceStatus: artifacts.report.evidenceStatus,
  integrityErrors: artifacts.report.integrityErrors,
  finalDecision: artifacts.report.selection.finalDecision,
  selectedCandidateId: artifacts.report.selection.selectedCandidateId,
  outputSizes: r10ArtifactSizes(),
  cacheDirectory,
}, null, 2));
