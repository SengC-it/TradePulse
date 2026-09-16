import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  R26_ACCEPTED_R25_RESULT_PATH,
  renderR26DiagnosticMarkdown,
  resolveR26Source,
  runR26ScoreCalibrationDiagnostic,
} from "../src/lib/research/round-026-score-calibration-diagnostic.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const root = process.cwd();
const sourcePath = resolveR26Source(root);
const result = await runR26ScoreCalibrationDiagnostic({ root, sourcePath });
const outputDirectory = path.join(root, "docs", "research");
const jsonPath = path.join(outputDirectory, "round-026-score-calibration-result.json");
const markdownPath = path.join(outputDirectory, "round-026-score-calibration-result.md");

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(JSON.parse(stableStringify(result)), null, 2)}\n`, "utf8");
writeFileSync(markdownPath, renderR26DiagnosticMarkdown(result), "utf8");
console.log(JSON.stringify({
  resultJsonPath: path.relative(root, jsonPath),
  resultMarkdownPath: path.relative(root, markdownPath),
  sourcePath,
  acceptedR25ResultPath: R26_ACCEPTED_R25_RESULT_PATH,
  primaryLongClassification: result.primaryLongClassification,
  primaryShortClassification: result.primaryShortClassification,
  recommendedNextDesign: result.recommendedNextDesign,
  diagnosticOnly: result.diagnosticOnly,
  economicEvaluationPerformed: result.economicEvaluationPerformed,
}, null, 2));
