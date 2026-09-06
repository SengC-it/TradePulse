import { acquireR16Archives } from "../src/lib/research/m3-r16-round-016-archives.ts";
import { R16_DEFAULT_CACHE_DIRECTORY } from "../src/lib/research/m3-r16-round-016-protocol.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const cacheDirectory = argument("--cache-directory") ?? process.env.TRADEPULSE_R16_CACHE ?? R16_DEFAULT_CACHE_DIRECTORY;
try {
  const manifest = await acquireR16Archives({ cacheDirectory, concurrency: 8 });
  console.log(JSON.stringify({
    status: manifest.completed && manifest.officialChecksumsVerified ? "PASS" : "PRE_PERFORMANCE_ABORT",
    stage: "micro-data-acquisition",
    cacheDirectory: manifest.cacheDirectory,
    archiveCount: manifest.archiveCount,
    officialChecksumsVerified: manifest.officialChecksumsVerified,
    metricsSchemaVerified: manifest.metricsSchemaVerified,
    metricsCadenceVerified: manifest.metricsCadenceVerified,
    markIndexPairingVerified: manifest.markIndexPairingVerified,
    dataSourceIdentitySha256: manifest.dataSourceIdentitySha256,
    network: true,
    performance: false,
  }, null, 2));
  if (!manifest.completed || !manifest.officialChecksumsVerified) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    status: "PRE_PERFORMANCE_ABORT",
    stage: "micro-data-acquisition",
    error: error instanceof Error ? error.message : String(error),
    performanceLockTriggered: false,
    network: true,
    performance: false,
  }, null, 2));
  process.exitCode = 1;
}
