import { materializeR16ObservationFreeze, verifyR16ObservationFreeze } from "../src/lib/research/m3-r16-round-016-data.ts";
import { R16_DEFAULT_CACHE_DIRECTORY, R16_OBSERVATION_DATA_PATH, R16_OBSERVATION_FREEZE_PATH } from "../src/lib/research/m3-r16-round-016-protocol.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const manifest = await materializeR16ObservationFreeze({
    root: process.cwd(),
    cacheDirectory: argument("--cache-directory") ?? process.env.TRADEPULSE_R16_CACHE ?? R16_DEFAULT_CACHE_DIRECTORY,
    sourceR15ObservationFile: argument("--source-r15-observation-file"),
  });
  const verified = await verifyR16ObservationFreeze(process.cwd());
  console.log(JSON.stringify({
    status: "PASS",
    stage: "observation-freeze",
    observationDataPath: R16_OBSERVATION_DATA_PATH,
    observationFreezePath: R16_OBSERVATION_FREEZE_PATH,
    observationDataSha256: verified.sha256,
    observationCount: verified.count,
    decisionTimeCount: manifest.decisionTimeCount,
    pooledCoverage: manifest.pooledCoverage,
    coverageByFold: manifest.coverageByFold,
    excludedDecisionTimes: manifest.excludedDecisionTimes.length,
    integrity: manifest.integrity,
    network: false,
    performance: false,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: "PRE_PERFORMANCE_ABORT",
    stage: "observation-freeze",
    error: error instanceof Error ? error.message : String(error),
    performanceLockTriggered: false,
    network: false,
    performance: false,
  }, null, 2));
  process.exitCode = 1;
}
