import { publishR27DevelopmentResult } from "../src/lib/research/round-027-development-runner.ts";

const result = await publishR27DevelopmentResult();
console.log(JSON.stringify({
  researchRoundId: result.researchRoundId,
  developmentEconomicEvaluationExecutionCount: result.r27DevelopmentEconomicEvaluationExecutionCount,
  longChampionId: result.longChampionId,
  shortChampionId: result.shortChampionId,
  developmentClassification: result.developmentClassification,
  nextStage: result.nextStage,
}, null, 2));
