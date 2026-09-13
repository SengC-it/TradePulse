import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { R15_CONFORMANCE_DOCUMENT, validateR15Conformance } from "../src/lib/research/m3-r15-round-015-conformance.ts";
import { verifyR15ObservationFreeze } from "../src/lib/research/m3-r15-round-015-data.ts";
import { R15_PLAN, R15_PLAN_SHA256, validateR15Plan } from "../src/lib/research/m3-r15-round-015-plan.ts";
import { existingR15OutputArtifacts } from "../src/lib/research/m3-r15-round-015-performance.ts";
import { R15_CONFORMANCE_PATH, R15_PLAN_PATH, R15_SPEC_OBJECT, R15_SPEC_PATH, R15_SOURCE_DATASET_SHA256, R15_SOURCE_MANIFEST_SHA256, R15_SOURCE_OBSERVATION_SHA256, R15_SPEC_SHA256 } from "../src/lib/research/m3-r15-round-015-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

function argument(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function git(args: readonly string[]): string { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function abort(stage: string, error: unknown): never { console.error(JSON.stringify({ status: "PRE_PERFORMANCE_ABORT", stage, error: error instanceof Error ? error.message : String(error), performanceLockTriggered: false, network: false, performance: false }, null, 2)); process.exit(1); }

const sourceSha = argument("--source-sha");
if (!sourceSha) abort("source-argument", "--source-sha is required.");
if (git(["rev-parse", "HEAD"]) !== sourceSha) abort("source-verification", `expected ${sourceSha} but found ${git(["rev-parse", "HEAD"])}.`);
if (git(["status", "--porcelain"]) !== "") abort("worktree-verification", "R15 preflight requires a clean worktree.");
if (existingR15OutputArtifacts().length > 0) abort("output-precondition", "Round-015 outputs already exist; refusing overwrite.");
try {
  const spec = JSON.parse(readFileSync(path.join(process.cwd(), R15_SPEC_PATH), "utf8")) as unknown;
  if (stableStringify(spec) !== stableStringify(R15_SPEC_OBJECT) || R15_SPEC_SHA256.length !== 64) throw new Error("R15 spec identity failed.");
  const plan = JSON.parse(readFileSync(path.join(process.cwd(), R15_PLAN_PATH), "utf8")) as typeof R15_PLAN;
  validateR15Plan(plan);
  const conformance = JSON.parse(readFileSync(path.join(process.cwd(), R15_CONFORMANCE_PATH), "utf8")) as typeof R15_CONFORMANCE_DOCUMENT;
  validateR15Conformance(conformance);
  const freeze = await verifyR15ObservationFreeze(process.cwd());
  if (freeze.manifest.sourceDatasetSha256 !== R15_SOURCE_DATASET_SHA256 || freeze.manifest.sourceManifestSha256 !== R15_SOURCE_MANIFEST_SHA256 || freeze.manifest.sourceObservationSha256 !== R15_SOURCE_OBSERVATION_SHA256 || freeze.manifest.integrityErrors.length !== 0 || freeze.manifest.integrity !== "COMPLETE") throw new Error("R15 frozen observation provenance or integrity failed.");
  console.log(JSON.stringify({ status: "PASS", stage: "pre-performance", sourceSha, specSha256: R15_SPEC_SHA256, planSha256: R15_PLAN_SHA256, observationSha256: freeze.manifest.observationDataSha256, observationCount: freeze.manifest.observationCount, completeDecisionTimeCount: freeze.manifest.completeDecisionTimeCount, network: false, performance: false, performanceLockTriggered: false }, null, 2));
} catch (error) { abort("pre-performance-validation", error); }
