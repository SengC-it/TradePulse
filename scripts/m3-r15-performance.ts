import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { R15_CONFORMANCE_DOCUMENT, validateR15Conformance } from "../src/lib/research/m3-r15-round-015-conformance.ts";
import { readR15ObservationFreeze, verifyR15ObservationFreeze } from "../src/lib/research/m3-r15-round-015-data.ts";
import { R15_PLAN, validateR15Plan } from "../src/lib/research/m3-r15-round-015-plan.ts";
import { buildR15ExecutionArtifacts, executeR15Performance, existingR15OutputArtifacts, publishR15ArtifactsAtomically } from "../src/lib/research/m3-r15-round-015-performance.ts";
import { R15_CONFORMANCE_PATH, R15_PLAN_PATH, R15_SPEC_OBJECT, R15_SPEC_PATH, R15_SPEC_SHA256, R15_SOURCE_DATASET_SHA256, R15_SOURCE_MANIFEST_SHA256, R15_SOURCE_OBSERVATION_SHA256, M3_R15_PERFORMANCE_LOCK, M3_R15_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r15-round-015-protocol.ts";
import { newR15ExecutionId, executionLockPath, readR15Lock, writeR15LockAtomic, type R15ExecutionLock } from "../src/lib/research/m3-r15-round-015-checkpoints.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

function argument(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function requiredArgument(name: string): string { const value = argument(name); if (!value) throw new Error(`Missing required argument ${name}.`); return value; }
function git(args: readonly string[]): string { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function abort(status: "PRE_PERFORMANCE_ABORT" | "PERFORMANCE_ABORT_AFTER_LOCK", stage: string, error: unknown): never { const asError = error instanceof Error ? error : new Error(String(error)); console.error(JSON.stringify({ status, stage, error: asError.message, stack: asError.stack ?? null, performanceLockTriggered: status === "PERFORMANCE_ABORT_AFTER_LOCK", control: false, selection: false, evidenceGenerated: false, network: false, privateBinanceApi: false, automaticTrading: false }, null, 2)); process.exit(1); }

const sourceSha = requiredArgument("--source-sha");
if (!process.argv.includes("--confirm-authoritative-performance")) abort("PRE_PERFORMANCE_ABORT", "authorization", new Error("--confirm-authoritative-performance is required."));
if (git(["rev-parse", "HEAD"]) !== sourceSha) abort("PRE_PERFORMANCE_ABORT", "source-verification", new Error(`expected ${sourceSha} but found ${git(["rev-parse", "HEAD"])}.`));
if (git(["status", "--porcelain"]) !== "") abort("PRE_PERFORMANCE_ABORT", "worktree-verification", new Error("R15 performance requires a clean worktree."));
if (existingR15OutputArtifacts().length > 0) abort("PRE_PERFORMANCE_ABORT", "output-precondition", new Error("Round-015 outputs already exist; refusing overwrite."));

let lockPresent = false;
let stage = "pre-lock-validation";
try {
  const spec = JSON.parse(readFileSync(path.join(process.cwd(), R15_SPEC_PATH), "utf8")) as unknown;
  if (stableStringify(spec) !== stableStringify(R15_SPEC_OBJECT) || R15_SPEC_SHA256.length !== 64) throw new Error("R15 spec identity failed.");
  const plan = JSON.parse(readFileSync(path.join(process.cwd(), R15_PLAN_PATH), "utf8")) as typeof R15_PLAN;
  validateR15Plan(plan);
  const conformance = JSON.parse(readFileSync(path.join(process.cwd(), R15_CONFORMANCE_PATH), "utf8")) as typeof R15_CONFORMANCE_DOCUMENT;
  validateR15Conformance(conformance);
  if (conformance.resultAffectingDeviationCount !== 0) throw new Error("R15 result-affecting conformance deviations are present.");
  const freeze = readR15ObservationFreeze(process.cwd());
  const verifiedFreeze = await verifyR15ObservationFreeze(process.cwd());
  if (freeze.sourceDatasetSha256 !== R15_SOURCE_DATASET_SHA256 || freeze.sourceManifestSha256 !== R15_SOURCE_MANIFEST_SHA256 || freeze.sourceObservationSha256 !== R15_SOURCE_OBSERVATION_SHA256 || verifiedFreeze.manifest.integrity !== "COMPLETE") throw new Error("R15 observation freeze identity or integrity failed.");

  const executionId = argument("--execution-id") ?? newR15ExecutionId();
  const executionDirectory = path.resolve(argument("--execution-directory") ?? path.join(process.cwd(), ".cache", "tradepulse", "round-015", "executions", executionId));
  const lockPath = executionLockPath(executionDirectory);
  let lock: R15ExecutionLock;
  if (existsSync(lockPath)) {
    lock = readR15Lock(lockPath);
    lockPresent = true;
    if (lock.executionId !== executionId || lock.executionSourceSha !== sourceSha || lock.researchRoundId !== M3_R15_RESEARCH_ROUND_ID || lock.lock !== M3_R15_PERFORMANCE_LOCK || lock.observationDatasetSha256 !== freeze.observationDataSha256) throw new Error("Existing R15 performance lock identity mismatch.");
  } else {
    lock = { schemaVersion: "m3-r15-round-015-performance-lock-001", lock: M3_R15_PERFORMANCE_LOCK, researchRoundId: M3_R15_RESEARCH_ROUND_ID, executionId, executionSourceSha: sourceSha, observationDatasetSha256: freeze.observationDataSha256, createdAt: new Date().toISOString(), continuationCount: 0 };
    writeR15LockAtomic(lockPath, lock);
    lockPresent = true;
  }

  stage = "post-lock-model-and-performance-execution";
  const execution = await executeR15Performance({ root: process.cwd(), executionDirectory, executionLock: lock, observationFreeze: freeze, onFoldComplete: (foldId) => { stage = `post-lock-after-${foldId}-complete`; } });
  stage = "final-evidence-build";
  const artifacts = buildR15ExecutionArtifacts(execution.report);
  stage = "atomic-evidence-publication";
  publishR15ArtifactsAtomically({ root: process.cwd(), artifacts });
  console.log(JSON.stringify({ status: "READY_FOR_ROUND015_ACCEPTANCE", researchRoundId: M3_R15_RESEARCH_ROUND_ID, executionId, performanceSourceSha: sourceSha, performanceLock: M3_R15_PERFORMANCE_LOCK, performanceExecutionCount: execution.report.performanceExecutionCount, reusedFoldCount: execution.reusedFoldCount, evidenceGenerated: true, evidencePaths: ["docs/evidence/M3_R15_ROUND_015_SUMMARY.json", "docs/evidence/M3_R15_ROUND_015_AUDIT.json", "docs/M3_R15_ROUND_015_RESULTS.md", "docs/evidence/M3_R15_ROUND_015_SELECTION.json", "docs/evidence/M3_R15_ROUND_015_SELECTION.md"], report: execution.report, network: false, privateBinanceApi: false, automaticTrading: false }, null, 2));
} catch (error) {
  abort(lockPresent ? "PERFORMANCE_ABORT_AFTER_LOCK" : "PRE_PERFORMANCE_ABORT", stage, error);
}
