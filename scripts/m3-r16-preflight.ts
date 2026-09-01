import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { readR16Conformance, validateR16Conformance } from "../src/lib/research/m3-r16-round-016-conformance.ts";
import { hashR16File, locateR16R14ObservationFile, locateR16R15ObservationFile, verifyR16ObservationFreeze } from "../src/lib/research/m3-r16-round-016-data.ts";
import { readR16AcquisitionManifest } from "../src/lib/research/m3-r16-round-016-archives.ts";
import { R16_PLAN, R16_PLAN_SHA256, validateR16Plan } from "../src/lib/research/m3-r16-round-016-plan.ts";
import { existingR16OutputArtifacts } from "../src/lib/research/m3-r16-round-016-performance.ts";
import { M3_R16_ACCEPTED_R15_SOURCE_SHA, R16_DEFAULT_CACHE_DIRECTORY, R16_PLAN_PATH, R16_SPEC_OBJECT, R16_SPEC_PATH, R16_SPEC_SHA256, M3_R16_SOURCE_DATASET_SHA256, M3_R16_SOURCE_MANIFEST_SHA256, M3_R16_SOURCE_R14_OBSERVATION_SHA256, M3_R16_SOURCE_R15_OBSERVATION_SHA256 } from "../src/lib/research/m3-r16-round-016-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function abort(stage: string, error: unknown): never {
  console.error(JSON.stringify({
    status: "PRE_PERFORMANCE_ABORT",
    stage,
    error: error instanceof Error ? error.message : String(error),
    performanceLockTriggered: false,
    network: false,
    performance: false,
  }, null, 2));
  process.exit(1);
}

const sourceSha = argument("--source-sha");
if (!sourceSha) abort("source-argument", "--source-sha is required.");
try {
  const head = git(["rev-parse", "HEAD"]);
  if (head !== sourceSha) abort("source-verification", `expected ${sourceSha} but found ${head}.`);
  if (git(["status", "--porcelain"]) !== "") abort("worktree-verification", "R16 preflight requires a clean worktree.");
  if (existingR16OutputArtifacts().length > 0) abort("output-precondition", "Round-016 evidence outputs already exist; refusing overwrite.");

  const specPath = path.join(process.cwd(), R16_SPEC_PATH);
  if (!existsSync(specPath) || stableStringify(JSON.parse(readFileSync(specPath, "utf8"))) !== stableStringify(R16_SPEC_OBJECT) || R16_SPEC_SHA256.length !== 64) abort("spec-validation", "R16 specification identity failed.");
  const plan = JSON.parse(readFileSync(path.join(process.cwd(), R16_PLAN_PATH), "utf8")) as typeof R16_PLAN;
  validateR16Plan(plan);
  if (R16_PLAN_SHA256.length !== 64) abort("plan-validation", "R16 plan hash is invalid.");

  let sourceR15: string;
  try { sourceR15 = locateR16R15ObservationFile(process.cwd()); } catch (error) { abort("accepted-r15-observation-source", error); }
  if (await hashR16File(sourceR15!) !== M3_R16_SOURCE_R15_OBSERVATION_SHA256) abort("accepted-r15-observation-source", `R16_SOURCE_R15_OBSERVATION_SHA_MISMATCH: expected ${M3_R16_SOURCE_R15_OBSERVATION_SHA256}.`);
  try { locateR16R14ObservationFile(process.cwd()); } catch (error) { abort("accepted-r14-observation-source", error); }

  const conformance = await readR16Conformance(process.cwd());
  validateR16Conformance(conformance);
  if (conformance.resultAffectingDeviationCount !== 0 || conformance.integrity !== "COMPLETE") abort("conformance-validation", "R16 result-affecting conformance deviations are present.");

  const acquisition = readR16AcquisitionManifest(path.resolve(process.cwd(), process.env.TRADEPULSE_R16_CACHE ?? R16_DEFAULT_CACHE_DIRECTORY));
  if (!acquisition?.completed || !acquisition.officialChecksumsVerified || !acquisition.metricsSchemaVerified || !acquisition.metricsCadenceVerified || !acquisition.markIndexPairingVerified) abort("micro-data-acquisition", "R16 official microstructure archive acquisition is missing or incomplete.");
  const freeze = await verifyR16ObservationFreeze(process.cwd());
  if (freeze.manifest.sourceR15ObservationSha256 !== M3_R16_SOURCE_R15_OBSERVATION_SHA256 || freeze.manifest.sourceR14ObservationSha256 !== M3_R16_SOURCE_R14_OBSERVATION_SHA256 || freeze.manifest.researchBoundary !== "2026-08-15T23:59:59.999Z" || freeze.manifest.integrity !== "COMPLETE" || freeze.manifest.integrityErrors.length !== 0 || freeze.manifest.pooledCoverage < 0.9) abort("observation-freeze-validation", "R16 observation freeze provenance, integrity, or pooled coverage failed.");
  const foldCoverage = Object.values(freeze.manifest.coverageByFold);
  if (foldCoverage.some((value) => value.trainingCoverage < 0.85 || value.validationCoverage < 0.85)) abort("coverage-gate", "R16 training or validation common-mask coverage is below 85%.");
  console.log(JSON.stringify({ status: "PASS", stage: "pre-performance", sourceSha, acceptedR15SourceSha: M3_R16_ACCEPTED_R15_SOURCE_SHA, sourceDatasetSha256: M3_R16_SOURCE_DATASET_SHA256, sourceManifestSha256: M3_R16_SOURCE_MANIFEST_SHA256, sourceR14ObservationSha256: M3_R16_SOURCE_R14_OBSERVATION_SHA256, sourceR15ObservationSha256: M3_R16_SOURCE_R15_OBSERVATION_SHA256, specSha256: R16_SPEC_SHA256, planSha256: R16_PLAN_SHA256, observationSha256: freeze.sha256, observationCount: freeze.count, pooledCoverage: freeze.manifest.pooledCoverage, network: false, performance: false, performanceLockTriggered: false }, null, 2));
} catch (error) {
  abort("pre-performance-validation", error);
}
