import { materializeR15ObservationFreeze, verifyR15ObservationFreeze } from "../src/lib/research/m3-r15-round-015-data.ts";
import { R15_OBSERVATION_DATA_PATH, R15_OBSERVATION_FREEZE_PATH, R15_SOURCE_OBSERVATION_SHA256 } from "../src/lib/research/m3-r15-round-015-protocol.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const sourceObservationFile = argument("--source-observation-file");
if (!sourceObservationFile) {
  console.error(JSON.stringify({ status: "PRE_PERFORMANCE_ABORT", stage: "source-observation-argument", error: "--source-observation-file is required; R15 never acquires network data.", performanceLockTriggered: false, network: false }, null, 2));
  process.exit(1);
}

try {
  const manifest = await materializeR15ObservationFreeze({ root: process.cwd(), sourceObservationFile });
  const verified = await verifyR15ObservationFreeze(process.cwd());
  if (verified.manifest.sourceObservationSha256 !== R15_SOURCE_OBSERVATION_SHA256) throw new Error("R15 source observation SHA is not the accepted R14 SHA.");
  console.log(JSON.stringify({ status: "PASS", stage: "observation-freeze", manifestPath: R15_OBSERVATION_FREEZE_PATH, observationDataPath: R15_OBSERVATION_DATA_PATH, sourceObservationSha256: manifest.sourceObservationSha256, observationCount: manifest.observationCount, completeDecisionTimeCount: manifest.completeDecisionTimeCount, excludedIncompleteDecisionTimeCount: manifest.excludedIncompleteDecisionTimeCount, observationDataBytes: manifest.observationDataBytes, observationDataSha256: manifest.observationDataSha256, manifestSha256: manifest.manifestSha256, integrity: manifest.integrity, network: false, performance: false }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "PRE_PERFORMANCE_ABORT", stage: "observation-freeze", error: error instanceof Error ? error.message : String(error), performanceLockTriggered: false, network: false, performance: false }, null, 2));
  process.exit(1);
}
