import { materializeR18ObservationFreeze } from "../src/lib/research/m3-r18-round-018-observation-freeze.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

try {
  const manifest = await materializeR18ObservationFreeze({
    sourceObservationFile: argument("--source-observation-file") ?? process.env.TRADEPULSE_R18_SOURCE_OBSERVATION_FILE,
    acceptedRound006CacheDirectory: argument("--round006-cache-directory") ?? process.env.TRADEPULSE_R18_ROUND006_CACHE_DIRECTORY,
  });
  console.log(JSON.stringify({
    researchRoundId: manifest.researchRoundId,
    acceptedSourceCommit: manifest.acceptedSourceCommit,
    observationCount: manifest.observationSource.observationCount,
    formalCount: manifest.counts.formalCount,
    candidateCount: manifest.counts.candidateCount,
    excludedByConsensusCount: manifest.counts.excludedByConsensusCount,
    statusCounts: manifest.counts.statusCounts,
    compactStructuralObservation: manifest.compactStructuralObservation,
    integrity: manifest.integrity,
    performanceExecutionCount: manifest.performanceExecutionCount,
    performanceExecuted: manifest.performanceExecuted,
    selectionExecuted: manifest.selectionExecuted,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
