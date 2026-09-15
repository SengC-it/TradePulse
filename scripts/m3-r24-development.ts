import { publishR24DevelopmentResult, publishR24ForwardFreeze } from "../src/lib/research/round-024-executable-runner.ts";

const freezeCommitSHA = process.env.R24_FREEZE_COMMIT_SHA;
const freezeTimestamp = process.env.R24_FREEZE_TIMESTAMP;
if (!freezeCommitSHA || !freezeTimestamp) throw new Error("R24 development script requires verified R24_FREEZE_COMMIT_SHA and R24_FREEZE_TIMESTAMP.");

const result = await publishR24DevelopmentResult();
const freeze = publishR24ForwardFreeze({ result, freezeCommitSHA, freezeTimestamp });
console.log(JSON.stringify({
  branch: result.branch,
  base: result.base,
  developmentEconomicEvaluationExecutionCount: result.developmentEconomicEvaluationExecutionCount,
  longChampionId: result.longChampionId,
  shortChampionId: result.shortChampionId,
  classification: result.classification,
  candidateExecutableFrozen: freeze.candidateExecutableFrozen,
  freezeCommitSHA: freeze.freezeCommitSHA,
  freezeTimestamp: freeze.freezeTimestamp,
  forwardEconomicValuesRead: result.forwardEconomicValuesRead,
  forwardReturnRead: result.forwardReturnRead,
  newPostFreezeForwardDataFetched: result.newPostFreezeForwardDataFetched,
}, null, 2));
