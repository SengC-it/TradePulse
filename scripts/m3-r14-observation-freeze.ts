import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { materializeR14ObservationFreeze, R14_OBSERVATION_FREEZE_PATH } from "../src/lib/research/m3-r14-round-014-observations.ts";
import { M3_R14_IDENTITY_PATH, M3_R14_SOURCE_R13_COMMIT, readR14Identity } from "../src/lib/research/m3-r14-round-014-identity.ts";
import { locateAcceptedRound006Cache, R13_DEFAULT_CACHE_DIRECTORY } from "../src/lib/research/m3-r13-round-013-data.ts";
import { M3_R14_OUTPUT_PATHS } from "../src/lib/research/m3-r14-round-014-performance.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function abort(stage: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ status: "PRE_PERFORMANCE_ABORT", stage, error: message, performanceLockTriggered: false, performanceExecutionCount: 0, control: false, selection: false, evidenceGenerated: false }, null, 2));
  process.exit(1);
}

if (git(["rev-parse", "HEAD"]) !== M3_R14_SOURCE_R13_COMMIT) abort("source-verification", `expected ${M3_R14_SOURCE_R13_COMMIT} but found ${git(["rev-parse", "HEAD"])}`);
if (M3_R14_OUTPUT_PATHS.some((relative) => existsSync(path.join(process.cwd(), relative)))) abort("output-precondition", "Round-014 evidence artifacts already exist.");
try {
  readR14Identity(path.join(process.cwd(), M3_R14_IDENTITY_PATH));
  const manifest = await materializeR14ObservationFreeze({ root: process.cwd(), cacheDirectory: argument("--cache-directory") ?? path.join(process.cwd(), R13_DEFAULT_CACHE_DIRECTORY), acceptedCoarseCacheDirectory: argument("--accepted-coarse-cache-directory") ?? locateAcceptedRound006Cache(process.cwd()) ?? undefined });
  console.log(JSON.stringify({ status: "PASS", stage: "observation-freeze", manifestPath: R14_OBSERVATION_FREEZE_PATH, observationCount: manifest.observationCount, observationDataBytes: manifest.observationDataBytes, observationDataSha256: manifest.observationDataSha256, manifestSha256: manifest.manifestSha256, integrityExcludedObservations: manifest.integrityExcludedObservations, network: false, performance: false }, null, 2));
} catch (error) {
  abort("observation-freeze", error);
}
