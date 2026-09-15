import { materializeR17ObservationFreeze } from "../src/lib/research/m3-r17-round-017-observation-freeze.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const sourceObservationFile = argument("--source-observation-file") ?? process.env.TRADEPULSE_R17_SOURCE_OBSERVATION_FILE;
const round006CacheDirectory = argument("--round006-cache-directory") ?? process.env.TRADEPULSE_R17_ROUND006_CACHE_DIRECTORY;
if (!sourceObservationFile || !round006CacheDirectory) {
  console.error("R17 observation freeze requires --source-observation-file and --round006-cache-directory for accepted historical caches.");
  process.exitCode = 1;
} else {
  try {
    const manifest = await materializeR17ObservationFreeze({ sourceObservationFile, round006CacheDirectory });
    console.log(JSON.stringify({
      researchRoundId: manifest.researchRoundId,
      observationCount: manifest.observationCount,
      observationDataSha256: manifest.observationDataSha256,
      formalStreamIdentitySha256: manifest.formalStream.identitySha256,
      candidateCount: manifest.counts.candidateCount,
      followUpCount: manifest.counts.followUpCount,
      suppressionRate: manifest.counts.controlCount === 0 ? 0 : manifest.counts.suppressedCount / manifest.counts.controlCount,
      sourcePolicy: manifest.sourcePolicy,
      newMarketDataFetched: manifest.newMarketDataFetched,
      settlementIdentityAudit: {
        categoryCounts: manifest.settlementIdentityAudit.categoryCounts,
        partitionTotal: manifest.settlementIdentityAudit.partitionTotal,
        acceptedSettlementLabelIdentityCompleteCount: manifest.settlementIdentityAudit.acceptedSettlementLabelIdentityCompleteCount,
        trueMissingRequiredLabelCount: manifest.settlementIdentityAudit.trueMissingRequiredLabelCount,
        trueMissingFormalProvenanceCount: manifest.settlementIdentityAudit.trueMissingFormalProvenanceCount,
        r14ObservationIdentityMissingCount: manifest.settlementIdentityAudit.r14ObservationIdentityMissingCount,
        r14OnlyIdentityMissingCount: manifest.settlementIdentityAudit.r14OnlyIdentityMissingCount,
        g01DataComplete: manifest.settlementIdentityAudit.g01DataComplete,
        g01Failure: manifest.settlementIdentityAudit.g01Failure,
        labelValuesRead: manifest.settlementIdentityAudit.labelValuesRead,
        economicFieldsRead: manifest.settlementIdentityAudit.economicFieldsRead,
      },
      performanceExecutionCount: manifest.performanceExecutionCount,
      performanceExecuted: manifest.performanceExecuted,
      selectionExecuted: manifest.selectionExecuted,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
