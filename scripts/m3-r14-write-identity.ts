import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  R14_IDENTITY_CANONICAL_JSON,
  M3_R14_IDENTITY_PATH,
  M3_R14_R13_FORENSICS_PATH,
  M3_R14_SOURCE_R13_COMMIT,
  M3_R14_DATASET_IDENTITY_SHA256,
  M3_R14_MANIFEST_IDENTITY_SHA256,
  readR14Identity,
} from "../src/lib/research/m3-r14-round-014-identity.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const root = process.cwd();
const identityPath = path.join(root, M3_R14_IDENTITY_PATH);
const forensicsPath = path.join(root, M3_R14_R13_FORENSICS_PATH);

function writeOnce(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  if (existsSync(filePath)) {
    if (readFileSync(filePath, "utf8") !== value) throw new Error(`R14 identity artifact already exists with different bytes: ${filePath}`);
    return;
  }
  writeFileSync(filePath, value, { encoding: "utf8", flag: "wx" });
}

const forensics = {
  schemaVersion: "m3-r14-r13-forensics-001",
  researchRoundId: "baseline-002-research-round-014",
  replayOfResearchRoundId: "baseline-002-research-round-013",
  r13: {
    performanceLockPath: ".cache/tradepulse/round-013/r13-performance-lock.json",
    executionSourceSha: M3_R14_SOURCE_R13_COMMIT,
    datasetIdentitySha256: M3_R14_DATASET_IDENTITY_SHA256,
    manifestIdentitySha256: M3_R14_MANIFEST_IDENTITY_SHA256,
    lockPreserved: true,
  },
  failure: {
    classification: "PERFORMANCE_ABORT_AFTER_LOCK",
    stage: "fitModels -> fitR13RidgeModel",
    errorType: "RangeError",
    errorMessage: "Maximum call stack size exceeded",
    anyHorizonCompleted: false,
    performanceArtifactsExist: false,
    temporaryStagingArtifactsExist: false,
    failureCause: "R13 model fitting used spread Math.min/Math.max over a large target array; R14 replaces only that runtime operation with sequential reduction.",
    partialMetricsReused: false,
  },
};

writeOnce(identityPath, `${R14_IDENTITY_CANONICAL_JSON}\n`);
writeOnce(forensicsPath, `${stableStringify(forensics)}\n`);
readR14Identity(identityPath);
console.log(JSON.stringify({ status: "PASS", identityPath: M3_R14_IDENTITY_PATH, forensicsPath: M3_R14_R13_FORENSICS_PATH, scientificDeviationCount: 0, performance: false, network: false }, null, 2));
