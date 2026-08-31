import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readR16AcquisitionManifest } from "../src/lib/research/m3-r16-round-016-archives.ts";
import { readR16ObservationFreeze } from "../src/lib/research/m3-r16-round-016-data.ts";
import { M3_R16_RESEARCH_ROUND_ID, R16_MICRO_DATA_FREEZE_PATH } from "../src/lib/research/m3-r16-round-016-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const root = path.resolve(process.cwd());
const cacheDirectory = path.resolve(process.env.TRADEPULSE_R16_CACHE ?? path.join(root, ".cache", "tradepulse", "round-016"));
const acquisition = readR16AcquisitionManifest(cacheDirectory);
if (!acquisition?.completed || !acquisition.officialChecksumsVerified || !acquisition.metricsSchemaVerified || !acquisition.metricsCadenceVerified || !acquisition.markIndexPairingVerified) throw new Error("R16 micro-data acquisition is incomplete.");
const observation = readR16ObservationFreeze(root);
const document = {
  schemaVersion: "m3-r16-round-016-micro-data-freeze-001",
  researchRoundId: M3_R16_RESEARCH_ROUND_ID,
  source: "BINANCE_VISION_ARCHIVE",
  officialBaseUrl: "https://data.binance.vision/data/futures/um",
  archiveOnly: true,
  symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"],
  archiveCount: acquisition.archiveCount,
  archives: acquisition.archiveProvenance.map((value) => ({
    sourceUrl: value.sourceUrl,
    checksumUrl: value.checksumUrl,
    archiveFileName: value.archiveFileName,
    archiveSha256: value.archiveSha256,
    officialChecksumContent: value.officialChecksumContent,
    officialChecksumSha256: value.officialChecksumSha256,
    symbol: value.symbol,
    dataType: value.dataType,
    frequency: value.frequency,
    period: value.period,
    interval: value.interval,
    csvFileName: value.csvFileName,
    rowCount: value.rowCount,
    firstTimestamp: value.firstTimestamp,
    lastTimestamp: value.lastTimestamp,
    detectedCadenceMs: value.detectedCadenceMs,
    duplicatesIdentical: value.duplicatesIdentical,
    duplicatesConflicting: value.duplicatesConflicting,
    missingIntervals: value.missingIntervals,
  })),
  officialChecksumsVerified: acquisition.officialChecksumsVerified,
  metricsSchemaVerified: acquisition.metricsSchemaVerified,
  metricsCadenceVerified: acquisition.metricsCadenceVerified,
  markIndexPairingVerified: acquisition.markIndexPairingVerified,
  detectedCadenceBySourcePeriod: acquisition.detectedCadenceBySourcePeriod,
  coverage: {
    pooled: observation.pooledCoverage,
    byFold: observation.coverageByFold,
  },
  globalMask: {
    name: "R16_VALID_DECISION_TIME_MASK",
    sha256: observation.globalMaskSha256,
    excludedDecisionTimes: observation.excludedDecisionTimes,
  },
  microDataSha256: observation.microDataSha256,
  dataSourceIdentitySha256: acquisition.dataSourceIdentitySha256,
  researchBoundary: observation.researchBoundary,
  artifactHashMethod: "SHA256_EXACT_COMMITTED_UTF8_BYTES",
};
const target = path.join(root, R16_MICRO_DATA_FREEZE_PATH);
const content = `${stableStringify(document)}\n`;
if (existsSync(target)) {
  if (readFileSync(target, "utf8") !== content) throw new Error("R16 micro-data freeze already exists with different bytes.");
  console.log(JSON.stringify({ status: "EXISTS", path: R16_MICRO_DATA_FREEZE_PATH, archiveCount: acquisition.archiveCount }, null, 2));
} else {
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r16-micro-data-freeze-staging-"));
  try {
    const temporary = path.join(staging, path.basename(target));
    writeFileSync(temporary, content, "utf8");
    if (existsSync(target)) throw new Error("R16 micro-data freeze appeared during publication.");
    renameSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ status: "WRITTEN", path: R16_MICRO_DATA_FREEZE_PATH, archiveCount: acquisition.archiveCount }, null, 2));
}
