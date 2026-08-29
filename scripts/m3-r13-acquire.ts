import path from "node:path";

import { locateAcceptedRound006Cache, prepareR13Dataset, R13_DEFAULT_CACHE_DIRECTORY, R13_ONE_MINUTE_END_TIME, R13_ONE_MINUTE_START_TIME } from "../src/lib/research/m3-r13-round-013-data.ts";
import { R13_SYMBOLS, M3_R13_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r13-round-013-protocol.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function abort(error: unknown): never {
  console.error(JSON.stringify({ status: "PRE_PERFORMANCE_ABORT", stage: "dataset-acquisition", error: error instanceof Error ? error.message : String(error), researchRoundId: M3_R13_RESEARCH_ROUND_ID, network: true, performanceLockTriggered: false, performanceExecutionCount: 0, control: false, selection: false, evidenceGenerated: false }, null, 2));
  process.exit(1);
}

const cacheDirectory = path.resolve(argument("--cache-directory") ?? process.env.TRADEPULSE_R13_CACHE ?? R13_DEFAULT_CACHE_DIRECTORY);
const coarseCacheDirectory = locateAcceptedRound006Cache();
if (!coarseCacheDirectory) abort("accepted Round-006 coarse cache is unavailable; acquisition cannot proceed safely");

try {
  const prepared = await prepareR13Dataset({ cacheDirectory, acceptedCoarseCacheDirectory: coarseCacheDirectory, fetchMissingOneMinute: true });
  const expectedLastOpenTime = Math.floor(R13_ONE_MINUTE_END_TIME / 60_000) * 60_000;
  const manifests = R13_SYMBOLS.map((symbol) => prepared.manifests.find((manifest) => manifest.symbol === symbol));
  if (manifests.some((manifest) => !manifest || manifest.firstOpenTime !== R13_ONE_MINUTE_START_TIME || manifest.lastOpenTime !== expectedLastOpenTime || manifest.rowCount <= 0 || manifest.pageCount <= 0)) throw new Error("R13 acquisition produced incomplete or mismatched 1m manifest coverage.");
  console.log(JSON.stringify({ status: "PASS", stage: "dataset-acquisition", researchRoundId: M3_R13_RESEARCH_ROUND_ID, cacheDirectory, coarseCacheDirectory, symbols: R13_SYMBOLS, manifests: prepared.manifests, acquisition: prepared.acquisition, datasetFreeze: prepared.datasetFreeze, performanceLockTriggered: false, performanceExecutionCount: 0, network: true }, null, 2));
} catch (error) {
  abort(error);
}
