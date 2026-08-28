import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { executeR9Authoritative, existingR9OutputArtifacts, publishR9ArtifactsAtomically, r9ArtifactSizes } from "../src/lib/research/m3-r9-round-009-performance.ts";
import { readR9SpecConformance } from "../src/lib/research/m3-r9-round-009-conformance.ts";
import { validateR9Plan } from "../src/lib/research/m3-r9-round-009-plan.ts";
import { validateR9MachineRecord } from "../src/lib/research/selection-gates-round-009.ts";
import { M3_R9_BASE_SOURCE_SHA } from "../src/lib/research/m3-r9-round-009-protocol.ts";

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
if (!process.argv.includes("--confirm-authoritative-performance")) fail("R9 authoritative performance requires --confirm-authoritative-performance.");
if (!sourceSha || !/^[0-9a-f]{40}$/u.test(sourceSha)) fail("R9 authoritative performance requires a 40-character --source-sha.");
if (git(["rev-parse", "HEAD"]) !== sourceSha) fail(`R9 source SHA mismatch: expected ${sourceSha}.`);
if (git(["status", "--porcelain"]) !== "") fail("R9 authoritative performance requires a clean worktree.");
if (sourceSha === M3_R9_BASE_SOURCE_SHA) fail("R9 execution source must be the final frozen execution commit, not the base source identity.");
if (!existsSync(cacheDirectory)) fail(`R9 acquisition cache is missing: ${cacheDirectory}`);
const existing = existingR9OutputArtifacts();
if (existing.length > 0) fail(`R9 output artifacts already exist: ${existing.join(", ")}`);

validateR9MachineRecord();
validateR9Plan();
readR9SpecConformance();

const artifacts = await executeR9Authoritative({ cacheDirectory, executionSourceSha: sourceSha, ...(acceptedServerTime ? { acceptedServerTime: Number(acceptedServerTime) } : {}) });
publishR9ArtifactsAtomically({ artifacts });
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
  outputSizes: r9ArtifactSizes(),
  cacheDirectory,
}, null, 2));
