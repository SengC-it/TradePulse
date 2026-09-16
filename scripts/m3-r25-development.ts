import { publishR25DevelopmentResult } from "../src/lib/research/round-025-development-runner.ts";

const result = await publishR25DevelopmentResult({ root: process.cwd() });

console.log(JSON.stringify({
  round: result.researchRoundId,
  candidateConfigurationsDefined: result.candidateConfigurationsDefined,
  candidateConfigurationsEvaluated: result.candidateConfigurationsEvaluated,
  longChampionId: result.longChampionId,
  shortChampionId: result.shortChampionId,
  developmentEconomicEvaluationExecutionCount: result.developmentEconomicEvaluationExecutionCount,
  finalDecision: result.finalDecision,
  nextStage: result.nextStage,
}, null, 2));
