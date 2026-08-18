import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import {
  createM3ISelectionReport,
  evaluateM3ISelection,
  M3_I_AUTHORITATIVE_MAIN_SHA,
  renderM3ISelectionMarkdown,
  serializeM3ISelectionReport,
} from "../src/lib/research/m3-i-selection.ts";
import type { M3HResearchEvidence } from "../src/lib/research/m3-h-evidence.ts";

const INPUT_PATH = "docs/evidence/M3_H_ROUND_001_SUMMARY.json";
const OUTPUT_JSON_PATH = "docs/evidence/M3_I_ROUND_001_SELECTION.json";
const OUTPUT_MARKDOWN_PATH = "docs/M3_I_ROUND_001_SELECTION.md";

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

const inputBytes = readFileSync(INPUT_PATH);
const evidence = JSON.parse(inputBytes.toString("utf8")) as M3HResearchEvidence;
const evaluation = evaluateM3ISelection(evidence);
const report = createM3ISelectionReport({
  evidence,
  evaluation,
  inputEvidencePath: INPUT_PATH,
  inputEvidenceSha256: sha256(inputBytes),
  sourceMainSha: M3_I_AUTHORITATIVE_MAIN_SHA,
});

writeFileSync(OUTPUT_JSON_PATH, serializeM3ISelectionReport(report), "utf8");
writeFileSync(OUTPUT_MARKDOWN_PATH, renderM3ISelectionMarkdown(report), "utf8");

console.log(`M3-I integrityStatus: ${report.integrityStatus}`);
console.log(`M3-I finalDecision: ${report.finalDecision}`);
console.log(`M3-I eligible candidates: ${report.eligibleCandidateIds.length === 0 ? "none" : report.eligibleCandidateIds.join(", ")}`);
console.log(`M3-I input evidence SHA-256: ${report.inputEvidenceSha256}`);
console.log(`M3-I JSON report: ${OUTPUT_JSON_PATH}`);
console.log(`M3-I Markdown report: ${OUTPUT_MARKDOWN_PATH}`);
