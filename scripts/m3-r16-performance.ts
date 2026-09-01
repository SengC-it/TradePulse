import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { readR16Conformance, validateR16Conformance } from "../src/lib/research/m3-r16-round-016-conformance.ts";
import { readR16ObservationFreeze, verifyR16ObservationFreeze } from "../src/lib/research/m3-r16-round-016-data.ts";
import { R16_PLAN, validateR16Plan } from "../src/lib/research/m3-r16-round-016-plan.ts";
import { buildR16ExecutionArtifacts, executeR16Performance, existingR16OutputArtifacts, publishR16ArtifactsAtomically } from "../src/lib/research/m3-r16-round-016-performance.ts";
import { R16_PLAN_PATH, R16_SPEC_OBJECT, R16_SPEC_PATH, R16_SPEC_SHA256, M3_R16_SOURCE_R14_OBSERVATION_SHA256, M3_R16_SOURCE_R15_OBSERVATION_SHA256, M3_R16_PERFORMANCE_LOCK, M3_R16_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r16-round-016-protocol.ts";
import { claimR16PerformanceExecution, newR16ExecutionId, roundGlobalPerformanceLedgerPath } from "../src/lib/research/m3-r16-round-016-checkpoints.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

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

function abort(status: "PRE_PERFORMANCE_ABORT" | "PERFORMANCE_ABORT_AFTER_LOCK", stage: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ status, stage, error: message, performanceLockTriggered: status === "PERFORMANCE_ABORT_AFTER_LOCK", control: false, selection: false, evidenceGenerated: false, network: false, privateBinanceApi: false, automaticTrading: false }, null, 2));
  process.exit(1);
}

const sourceSha = requiredArgument("--source-sha");
if (!process.argv.includes("--confirm-authoritative-performance")) abort("PRE_PERFORMANCE_ABORT", "authorization", new Error("--confirm-authoritative-performance is required."));
if (git(["rev-parse", "HEAD"]) !== sourceSha) abort("PRE_PERFORMANCE_ABORT", "source-verification", new Error(`expected ${sourceSha} but found ${git(["rev-parse", "HEAD"])}.`));
if (git(["status", "--porcelain"]) !== "") abort("PRE_PERFORMANCE_ABORT", "worktree-verification", new Error("R16 performance requires a clean worktree."));
if (existingR16OutputArtifacts().length > 0) abort("PRE_PERFORMANCE_ABORT", "output-precondition", new Error("Round-016 evidence outputs already exist; refusing overwrite."));

let lockPresent = false;
let stage = "pre-lock-validation";
try {
  const spec = JSON.parse(readFileSync(path.join(process.cwd(), R16_SPEC_PATH), "utf8")) as unknown;
  if (stableStringify(spec) !== stableStringify(R16_SPEC_OBJECT) || R16_SPEC_SHA256.length !== 64) throw new Error("R16 spec identity failed.");
  const plan = JSON.parse(readFileSync(path.join(process.cwd(), R16_PLAN_PATH), "utf8")) as typeof R16_PLAN;
  validateR16Plan(plan);
  const conformance = await readR16Conformance(process.cwd());
  validateR16Conformance(conformance);
  if (conformance.resultAffectingDeviationCount !== 0 || conformance.integrity !== "COMPLETE") throw new Error("R16 result-affecting conformance deviations are present.");
  const freeze = readR16ObservationFreeze(process.cwd());
  const verifiedFreeze = await verifyR16ObservationFreeze(process.cwd());
  if (freeze.sourceR14ObservationSha256 !== M3_R16_SOURCE_R14_OBSERVATION_SHA256 || freeze.sourceR15ObservationSha256 !== M3_R16_SOURCE_R15_OBSERVATION_SHA256 || verifiedFreeze.manifest.integrity !== "COMPLETE" || verifiedFreeze.manifest.integrityErrors.length !== 0) throw new Error("R16 observation freeze identity or integrity failed.");
  if (freeze.pooledCoverage < 0.9 || Object.values(freeze.coverageByFold).some((value) => value.trainingCoverage < 0.85 || value.validationCoverage < 0.85)) throw new Error("R16 observation coverage gate failed.");

  const executionId = argument("--execution-id") ?? newR16ExecutionId();
  const executionDirectory = path.resolve(argument("--execution-directory") ?? path.join(process.cwd(), ".cache", "tradepulse", "round-016", "executions", executionId));
  const ledgerPath = roundGlobalPerformanceLedgerPath(process.cwd());
  lockPresent = existsSync(ledgerPath);
  const claim = claimR16PerformanceExecution({ root: process.cwd(), executionId, executionSourceSha: sourceSha, observationDatasetSha256: freeze.observationDataSha256 });
  lockPresent = true;

  stage = "post-lock-model-and-performance-execution";
  const execution = await executeR16Performance({ root: process.cwd(), executionDirectory, executionLock: claim.executionLock, executionLedger: claim.ledger, observationFreeze: freeze, conformance });
  stage = "final-evidence-build";
  const artifacts = buildR16ExecutionArtifacts(execution.report);
  stage = "atomic-evidence-publication";
  publishR16ArtifactsAtomically({ root: process.cwd(), artifacts });
  console.log(JSON.stringify({ status: "READY_FOR_ROUND016_ACCEPTANCE", researchRoundId: M3_R16_RESEARCH_ROUND_ID, executionId, performanceExecutionSourceSha: sourceSha, performanceLock: M3_R16_PERFORMANCE_LOCK, performanceExecutionCount: execution.report.performanceExecutionCount, continuationCount: execution.report.continuationCount, reusedCompletedCheckpoints: execution.reusedCompletedCheckpoints, recomputedCompletedCheckpoints: execution.recomputedCompletedCheckpoints, evidenceGenerated: true, report: execution.report, network: false, privateBinanceApi: false, automaticTrading: false }, null, 2));
} catch (error) {
  abort(lockPresent ? "PERFORMANCE_ABORT_AFTER_LOCK" : "PRE_PERFORMANCE_ABORT", stage, error);
}
