import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { diagnosticResultHash, executeR30TargetSourceDiagnostic } from "../src/lib/research/round-030-target-source-diagnostic.ts";

const root = process.cwd();
const outputDirectory = path.join(root, "docs", "research");
mkdirSync(outputDirectory, { recursive: true });
const execution = await executeR30TargetSourceDiagnostic(root);
writeFileSync(path.join(outputDirectory, "round-030-target-source-result.json"), `${JSON.stringify({ ...execution, resultSha256: diagnosticResultHash(execution) }, null, 2)}\n`, "utf8");
const lines = [
  "# Round-030 Target / Source Diagnostic Result",
  "",
  `- Result SHA-256: \`${diagnosticResultHash(execution)}\``,
  `- R30 diagnostic execution count: \`${execution.r30DiagnosticExecutionCount}\``,
  `- Target diagnostic execution count: \`${execution.targetDiagnosticExecutionCount}\``,
  `- Fit count: \`${execution.fitCount}\``,
  `- Overall classification: \`${execution.overallClassification}\``,
  `- Overall next stage: \`${execution.overallNextStage}\``,
  "",
  "## Directional target results",
  "",
];
for (const direction of ["LONG", "SHORT"] as const) {
  const item = execution.stageA.directions[direction];
  lines.push(`### ${direction} — ${item.architecture}`, "", `- Selected target: \`${item.selectedTarget ?? "null"}\``, `- Classification: \`${item.directionClassification}\``, `- Next: \`${item.directionNextStage}\``, "", "| Target | T3 AUC median | T3 AUC worst | positive AUC folds | stress rank IC median | positive rank IC folds | improvement vs T0 | eligible |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |", ...item.targets.map((target) => `| ${target.trainingTarget} | ${target.medianT3Auc ?? "null"} | ${target.worstFoldT3Auc ?? "null"} | ${target.positiveT3AucFolds} | ${target.medianStressAlignedRankIc ?? "null"} | ${target.positiveStressAlignedRankIcFolds} | ${target.medianT3AucImprovementVsT0} | ${target.eligible} |`), "");
}
if (execution.stageB.executionCount === 0) lines.push("## Stage B", "", "- Source preflight execution count: `0`", "- Reason: both directions passed target redesign admission.", "");
else lines.push("## Stage B", "", `- Source preflight execution count: \`${execution.stageB.executionCount}\``, `- Archive files available: \`${execution.stageB.archiveFilesAvailable}/35\``, `- Checksum-valid files: \`${execution.stageB.checksumValidFiles}/35\``, `- Exact-schema files: \`${execution.stageB.schemaValidFiles}/35\``, `- Source classification: \`${execution.stageB.sourceClassification}\``, `- Source next stage: \`${execution.stageB.sourceNextStage}\``, "- Feature availability rule: `archive create_time + 5 minutes`", "");
lines.push("## Governance", "", `- Economic evaluation performed: \`${execution.economicEvaluationPerformed}\``, `- Trading economic metrics calculated: \`${execution.tradingEconomicMetricsCalculated}\``, `- New market data fetched: \`${execution.governance.newMarketDataFetched}\``, `- New market data used for economic evaluation: \`${execution.governance.newMarketDataUsedForEconomicEvaluation}\``, `- Forward economic values read: \`${execution.governance.forwardEconomicValuesRead}\``, `- Forward return read: \`${execution.governance.forwardReturnRead}\``, `- Performance execution count: \`${execution.governance.performanceExecutionCount}\``, `- Automatic trading: \`${execution.governance.automaticTrading}\``, `- Human decision required: \`${execution.governance.humanDecisionRequired}\``, `- Production unchanged: \`${execution.governance.productionUnchanged}\``, "", `Final decision: \`${execution.finalDecision}\``);
writeFileSync(path.join(outputDirectory, "round-030-target-source-result.md"), `${lines.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ resultSha256: diagnosticResultHash(execution), r30DiagnosticExecutionCount: execution.r30DiagnosticExecutionCount, targetDiagnosticExecutionCount: execution.targetDiagnosticExecutionCount, sourcePreflightExecutionCount: execution.stageB.executionCount, overallClassification: execution.overallClassification, overallNextStage: execution.overallNextStage }, null, 2));

