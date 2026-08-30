import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { featureVectorFromOrderedValues } from "../src/lib/research/m3-r13-round-013-features.ts";
import { fitR13RidgeModel, predictR13RidgeModel } from "../src/lib/research/m3-r13-round-013-model.ts";
import { readR13SpecConformance } from "../src/lib/research/m3-r13-round-013-conformance.ts";
import { R13_PLAN, validateR13Plan } from "../src/lib/research/m3-r13-round-013-plan.ts";
import { R13_FEATURE_NAMES } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import { existingR14OutputArtifacts } from "../src/lib/research/m3-r14-round-014-performance.ts";
import { readR14Identity } from "../src/lib/research/m3-r14-round-014-identity.ts";
import { verifyR14ObservationFreeze } from "../src/lib/research/m3-r14-round-014-observations.ts";

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
if (existingR14OutputArtifacts().length > 0) abort("output-precondition", "Round-014 evidence artifacts already exist.");
try {
  validateR13Plan();
  const conformance = readR13SpecConformance();
  if (conformance.resultAffectingDeviationCount !== 0 || conformance.postLockMarketFetchPossible || conformance.privateBinanceApi || conformance.automaticTrading) throw new Error("R13 conformance or governance boundary failed.");
  readR14Identity();
  const freeze = await verifyR14ObservationFreeze();
  if (freeze.manifest.integrityExcludedObservations !== 0) throw new Error("R14 observation freeze has integrity exclusions.");
  const synthetic = Array.from({ length: R13_FEATURE_NAMES.length + 8 }, (_, row) => ({ features: featureVectorFromOrderedValues(R13_FEATURE_NAMES.map((_, column) => row + column / 100)), targetNetForwardAtr: row / 10 }));
  const model = fitR13RidgeModel(synthetic);
  const prediction = predictR13RidgeModel(model, synthetic[0]!.features);
  if (!Number.isFinite(prediction) || R13_PLAN.performance.status !== "NOT_GENERATED") throw new Error("R14 synthetic model-fit smoke failed.");
  const source = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r14-round-014-observations.ts"), "utf8");
  if (!source.includes("oneMinuteNetworkMode: \"ALL_NETWORK_DISABLED\"") || !source.includes("fundingNetworkMode: \"ALL_NETWORK_DISABLED\"")) throw new Error("R14 preflight network-disabled contract is missing.");
  console.log(JSON.stringify({ status: "PASS", stage: "pre-lock-capacity-validation", observationCount: freeze.manifest.observationCount, observationDataSha256: freeze.manifest.observationDataSha256, syntheticModelFit: true, boundedSequentialScan: true, network: false, performanceLockTriggered: false, performanceExecutionCount: 0 }, null, 2));
} catch (error) {
  abort("pre-lock-capacity-validation", error);
}
