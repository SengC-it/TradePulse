import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { readR13SpecConformance } from "../src/lib/research/m3-r13-round-013-conformance.ts";
import { validateR13Plan } from "../src/lib/research/m3-r13-round-013-plan.ts";
import { buildR13ObservationUniverseWithDiagnostics, existingR13OutputArtifacts } from "../src/lib/research/m3-r13-round-013-performance.ts";
import { locateAcceptedRound006Cache, prepareR13Dataset, R13_DEFAULT_CACHE_DIRECTORY } from "../src/lib/research/m3-r13-round-013-data.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

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

const sourceSha = argument("--source-sha");
if (sourceSha && git(["rev-parse", "HEAD"]) !== sourceSha) abort("source-verification", `expected ${sourceSha} but found ${git(["rev-parse", "HEAD"])}`);
if (existingR13OutputArtifacts().length > 0) abort("output-precondition", "Round-013 output artifacts already exist.");
try { validateR13Plan(); readR13SpecConformance(); } catch (error) { abort("spec-conformance", error); }

const cacheDirectory = path.resolve(argument("--cache-directory") ?? R13_DEFAULT_CACHE_DIRECTORY);
const coarseCacheDirectory = locateAcceptedRound006Cache();
if (!coarseCacheDirectory) abort("dataset-acquisition", "accepted Round-006 coarse cache is unavailable.");
if (!existsSync(cacheDirectory)) abort("dataset-acquisition", `complete R13 1m cache is unavailable: ${cacheDirectory}`);

try {
  const prepared = await prepareR13Dataset({ cacheDirectory, acceptedCoarseCacheDirectory: coarseCacheDirectory, fetchMissingOneMinute: false });
  const universe = buildR13ObservationUniverseWithDiagnostics({ data: prepared.coarseData, oneMinute: prepared.oneMinuteIndexed, retainObservations: false });
  if (universe.integrityExcludedObservations !== 0) throw new Error("R13 preflight found integrity-excluded observations.");
  const freezePath = path.join(process.cwd(), "docs", "research", "round-013-dataset-freeze.json");
  if (existsSync(freezePath)) {
    const existingFreeze = JSON.parse(readFileSync(freezePath, "utf8")) as Readonly<Record<string, unknown>>;
    if (stableStringify(existingFreeze) !== stableStringify(prepared.datasetFreeze)) throw new Error("Existing R13 dataset freeze does not match the validated offline dataset.");
  } else {
    writeFileSync(freezePath, stableStringify(prepared.datasetFreeze), "utf8");
  }
  console.log(JSON.stringify({ status: "PASS", stage: "pre-performance-dataset-validation", datasetFreeze: prepared.datasetFreeze, cacheDirectory, coarseCacheDirectory, observationCounts: universe, performanceLockTriggered: false, performanceExecutionCount: 0, network: false }, null, 2));
} catch (error) {
  abort("dataset-acquisition", error);
}
