import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { readR13SpecConformance } from "../src/lib/research/m3-r13-round-013-conformance.ts";
import { validateR13Plan } from "../src/lib/research/m3-r13-round-013-plan.ts";
import { M3_R13_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import {
  buildR14ExecutionArtifacts,
  executeR14Performance,
  existingR14OutputArtifacts,
  publishR14ArtifactsAtomically,
} from "../src/lib/research/m3-r14-round-014-performance.ts";
import {
  M3_R14_DATASET_IDENTITY_SHA256,
  M3_R14_IDENTITY_PATH,
  M3_R14_MANIFEST_IDENTITY_SHA256,
  M3_R14_PERFORMANCE_LOCK,
  M3_R14_RESEARCH_ROUND_ID,
  M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256,
  readR14Identity,
} from "../src/lib/research/m3-r14-round-014-identity.ts";
import {
  executionLockPath,
  newR14ExecutionId,
  readR14Lock,
  writeR14LockAtomic,
  type R14ExecutionLock,
} from "../src/lib/research/m3-r14-round-014-checkpoints.ts";
import { readR14ObservationFreeze, verifyR14ObservationFreeze } from "../src/lib/research/m3-r14-round-014-observations.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArgument(name: string): string {
  const value = argument(name);
  if (!value) throw new Error(`Missing required argument ${name}.`);
  return value;
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function reportAbort(stage: string, error: unknown): never {
  const asError = error instanceof Error ? error : new Error(String(error));
  console.error(JSON.stringify({ status: "PERFORMANCE_ABORT_AFTER_LOCK", stage, error: asError.message, stack: asError.stack ?? null, performanceLockTriggered: true, control: false, selection: false, evidenceGenerated: false, network: false }, null, 2));
  process.exit(1);
}

const sourceSha = requiredArgument("--source-sha");
if (process.argv.includes("--confirm-authoritative-performance") === false) reportAbort("authorization", new Error("--confirm-authoritative-performance is required."));
if (git(["rev-parse", "HEAD"]) !== sourceSha) reportAbort("source-verification", new Error(`expected ${sourceSha} but found ${git(["rev-parse", "HEAD"])}.`));
if (git(["status", "--porcelain"]) !== "") reportAbort("worktree-verification", new Error("R14 performance requires a clean worktree."));
if (existingR14OutputArtifacts().length > 0) reportAbort("output-precondition", new Error("Round-014 evidence artifacts already exist; refusing to overwrite."));

let lockCreated = false;
let stage = "pre-lock-validation";
try {
  validateR13Plan();
  const conformance = readR13SpecConformance();
  if (conformance.resultAffectingDeviationCount !== 0 || conformance.postLockMarketFetchPossible || conformance.privateBinanceApi || conformance.automaticTrading) throw new Error("R13 scientific or governance conformance failed.");
  const identity = readR14Identity(path.join(process.cwd(), M3_R14_IDENTITY_PATH));
  const freeze = readR14ObservationFreeze();
  if (freeze.sourceDatasetSha256 !== M3_R14_DATASET_IDENTITY_SHA256 || freeze.sourceManifestIdentitySha256 !== M3_R14_MANIFEST_IDENTITY_SHA256 || freeze.scientificSpecIdentitySha256 !== M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256) throw new Error("R14 observation freeze identity mismatch.");
  const verifiedFreeze = await verifyR14ObservationFreeze();
  const datasetFreeze = JSON.parse(readFileSync(path.join(process.cwd(), "docs", "research", "round-013-dataset-freeze.json"), "utf8")) as Readonly<Record<string, unknown>>;
  if (datasetFreeze.researchRoundId !== M3_R13_RESEARCH_ROUND_ID || datasetFreeze.datasetIdentitySha256 !== M3_R14_DATASET_IDENTITY_SHA256 || datasetFreeze.manifestIdentitySha256 !== M3_R14_MANIFEST_IDENTITY_SHA256 || datasetFreeze.postLockMarketFetchPossible !== false || (datasetFreeze.integrityErrors as readonly unknown[]).length !== 0) throw new Error("R13 committed dataset freeze is not the accepted complete freeze.");
  if (verifiedFreeze.manifest.integrityExcludedObservations !== 0) throw new Error("R14 observation freeze integrity is incomplete.");

  const requestedExecutionId = argument("--execution-id");
  const executionId = requestedExecutionId ?? newR14ExecutionId();
  const executionDirectory = path.resolve(argument("--execution-directory") ?? path.join(process.cwd(), ".cache", "tradepulse", "round-014", "executions", executionId));
  const lockPath = executionLockPath(executionDirectory);
  let lock: R14ExecutionLock;
  if (existsSync(lockPath)) {
    lock = readR14Lock(lockPath);
    if (lock.executionId !== executionId || lock.executionSourceSha !== sourceSha || lock.roundId !== M3_R14_RESEARCH_ROUND_ID || lock.lock !== M3_R14_PERFORMANCE_LOCK) throw new Error("Existing R14 performance lock identity mismatch.");
  } else {
    lock = {
      schemaVersion: "m3-r14-round-014-performance-lock-001",
      lock: M3_R14_PERFORMANCE_LOCK,
      roundId: M3_R14_RESEARCH_ROUND_ID,
      executionId,
      executionSourceSha: sourceSha,
      datasetIdentitySha256: M3_R14_DATASET_IDENTITY_SHA256,
      manifestIdentitySha256: M3_R14_MANIFEST_IDENTITY_SHA256,
      observationDatasetSha256: freeze.observationDataSha256,
      scientificSpecIdentitySha256: M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256,
      scientificSpecIdentity: identity.r14.replayScientificProjection,
      createdAt: new Date().toISOString(),
      continuationCount: 0,
    };
    writeR14LockAtomic(lockPath, lock);
    lockCreated = true;
  }

  stage = "post-lock-model-and-horizon-execution";
  const execution = await executeR14Performance({ root: process.cwd(), executionDirectory, executionLock: lock, observationFreeze: freeze, datasetFreeze, conformance, identity, onHorizonComplete: (horizon) => { stage = `post-lock-after-H${horizon}-complete`; } });
  stage = "final-evidence-build";
  const artifacts = buildR14ExecutionArtifacts(execution.report);
  stage = "atomic-evidence-publication";
  publishR14ArtifactsAtomically({ root: process.cwd(), artifacts });
  console.log(JSON.stringify({ status: "READY_FOR_ROUND014_ACCEPTANCE", researchRoundId: M3_R14_RESEARCH_ROUND_ID, executionId, performanceSourceSha: sourceSha, performanceLock: M3_R14_PERFORMANCE_LOCK, continuationCount: execution.report.checkpointSummary.continuationCount, completedCheckpointCount: execution.report.checkpointSummary.completedCheckpointCount, recomputedCompletedCheckpoints: execution.recomputedCompletedCheckpoints, evidenceGenerated: true, evidencePaths: ["docs/evidence/M3_R14_ROUND_014_SUMMARY.json", "docs/evidence/M3_R14_ROUND_014_AUDIT.json", "docs/M3_R14_ROUND_014_RESULTS.md", "docs/evidence/M3_R14_ROUND_014_SELECTION.json", "docs/evidence/M3_R14_ROUND_014_SELECTION.md"], report: execution.report, network: false, privateBinanceApi: false, automaticTrading: false }, null, 2));
} catch (error) {
  if (lockCreated || stage.startsWith("post-lock") || stage === "final-evidence-build" || stage === "atomic-evidence-publication") reportAbort(stage, error);
  reportAbort(stage, error);
}
