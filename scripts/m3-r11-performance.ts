import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { executeR11Authoritative, existingR11OutputArtifacts, publishR11ArtifactsAtomically, r11ArtifactSizes } from "../src/lib/research/m3-r11-round-011-performance.ts";
import { readR11SpecConformance } from "../src/lib/research/m3-r11-round-011-conformance.ts";
import { validateR11Plan } from "../src/lib/research/m3-r11-round-011-plan.ts";
import { validateR11MachineRecord } from "../src/lib/research/selection-gates-round-011.ts";
import { M3_R11_BASE_SOURCE_SHA } from "../src/lib/research/m3-r11-round-011-protocol.ts";

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
if (!process.argv.includes("--confirm-authoritative-performance")) fail("R11 authoritative performance requires --confirm-authoritative-performance.");
if (!sourceSha || !/^[0-9a-f]{40}$/u.test(sourceSha)) fail("R11 authoritative performance requires a 40-character --source-sha.");
if (git(["rev-parse", "HEAD"]) !== sourceSha) fail(`R11 source SHA mismatch: expected ${sourceSha}.`);
if (git(["status", "--porcelain"]) !== "") fail("R11 authoritative performance requires a clean worktree.");
if (sourceSha === M3_R11_BASE_SOURCE_SHA) fail("R11 execution source must be the final frozen execution commit, not the base source identity.");
if (!existsSync(cacheDirectory)) fail(`R11 acquisition cache is missing: ${cacheDirectory}`);
const existing = existingR11OutputArtifacts();
if (existing.length > 0) fail(`R11 output artifacts already exist: ${existing.join(", ")}`);

validateR11MachineRecord();
validateR11Plan();
readR11SpecConformance();

const artifacts = await executeR11Authoritative({ cacheDirectory, executionSourceSha: sourceSha, ...(acceptedServerTime ? { acceptedServerTime: Number(acceptedServerTime) } : {}) });
publishR11ArtifactsAtomically({ artifacts });
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
  outputSizes: r11ArtifactSizes(),
  cacheDirectory,
}, null, 2));
