import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BacktestReport } from "../src/lib/backtest/types.ts";
import {
  deriveM3R2CResearchEvidence,
  M3_R2_C_MAIN_BASE_SHA,
  renderM3R2CResultsMarkdown,
  serializeM3R2CResearchEvidence,
  sha256M3R2CRawBytes,
  validateM3R2CPlanConstants,
  type M3R2CDecisionSnapshotArtifact,
} from "../src/lib/research/m3-r2-c-evidence.ts";
import {
  BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256,
  M3_R2_ROUND_002_SOURCE_SHA,
  validateM3R2Round002MachineRecord,
} from "../src/lib/research/selection-gates-round-002.ts";
import {
  M3_R2_ROUND_002_PLAN_SHA256,
  validateM3R2Round002Plan,
} from "../src/lib/research/m3-r2-round-002-plan.ts";

const ROUND_ID = "baseline-002-research-round-002";
const CONTROL_REPORT_DEFAULT = ".tmp/m3-r2-round002-control.json";
const DECISION_SNAPSHOTS_DEFAULT = ".tmp/m3-r2-round002-decision-snapshots.json";
const ROUND001_EVIDENCE_DEFAULT = "docs/evidence/M3_H_ROUND_001_SUMMARY.json";
const EVIDENCE_JSON_DEFAULT = "docs/evidence/M3_R2_ROUND_002_SUMMARY.json";
const EVIDENCE_MARKDOWN_DEFAULT = "docs/M3_R2_ROUND_002_RESULTS.md";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function requiredArgument(name: string): string {
  const value = argument(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function gitOutput(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function readBytes(filePath: string): Uint8Array {
  if (!existsSync(filePath)) throw new Error(`Required M3-R2-C artifact is missing: ${filePath}`);
  return readFileSync(filePath);
}

function writeExclusive(filePath: string, content: string): Uint8Array {
  if (existsSync(filePath)) throw new Error(`Refusing to overwrite existing M3-R2-C evidence: ${filePath}`);
  writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
  return readFileSync(filePath);
}

async function main(): Promise<void> {
  const sourceSha = requiredArgument("--source-sha");
  const selectionGateSha = requiredArgument("--selection-gate-sha");
  const experimentPlanSha = requiredArgument("--plan-sha");
  const round = requiredArgument("--round");
  const controlReportPath = path.resolve(argument("--control-report") ?? CONTROL_REPORT_DEFAULT);
  const decisionSnapshotsPath = path.resolve(argument("--decision-snapshots") ?? DECISION_SNAPSHOTS_DEFAULT);
  const round001EvidencePath = path.resolve(argument("--round001-evidence") ?? ROUND001_EVIDENCE_DEFAULT);
  const evidenceJsonPath = path.resolve(argument("--evidence-json") ?? EVIDENCE_JSON_DEFAULT);
  const evidenceMarkdownPath = path.resolve(argument("--evidence-markdown") ?? EVIDENCE_MARKDOWN_DEFAULT);

  if (round !== ROUND_ID) throw new Error("M3-R2-C round identifier does not match the frozen round.");
  if (sourceSha.trim().length === 0) throw new Error("M3-R2-C source SHA must be non-empty.");
  if (selectionGateSha !== BASELINE_002_RESEARCH_ROUND_002_SELECTION_GATE_SHA256) throw new Error("Selection gate SHA does not match the frozen Round-002 gate.");
  if (experimentPlanSha !== M3_R2_ROUND_002_PLAN_SHA256) throw new Error("Experiment plan SHA does not match the frozen Round-002 plan.");
  if (gitOutput("rev-parse", "HEAD") !== sourceSha) throw new Error("Evidence derivation must run from the frozen Commit A source SHA.");
  validateM3R2Round002Plan();
  validateM3R2Round002MachineRecord();
  validateM3R2CPlanConstants();

  const controlBytes = readBytes(controlReportPath);
  const decisionBytes = readBytes(decisionSnapshotsPath);
  const round001Bytes = readBytes(round001EvidencePath);
  const controlReportSha256 = sha256M3R2CRawBytes(controlBytes);
  const decisionSnapshotArtifactSha256 = sha256M3R2CRawBytes(decisionBytes);
  const round001EvidenceSha256 = sha256M3R2CRawBytes(round001Bytes);
  const controlReport = JSON.parse(new TextDecoder().decode(controlBytes)) as BacktestReport;
  const decisionSnapshots = JSON.parse(new TextDecoder().decode(decisionBytes)) as M3R2CDecisionSnapshotArtifact;
  const round001Evidence = JSON.parse(new TextDecoder().decode(round001Bytes)) as unknown;
  const evidence = deriveM3R2CResearchEvidence({
    controlReport,
    controlReportSha256,
    decisionSnapshots,
    decisionSnapshotArtifactSha256,
    round001Evidence,
    round001EvidenceSha256,
    executionSourceSha: sourceSha,
    selectionGateSha256: selectionGateSha,
    experimentPlanSha256: experimentPlanSha,
  });
  const evidenceBytes = writeExclusive(evidenceJsonPath, serializeM3R2CResearchEvidence(evidence));
  const markdownBytes = writeExclusive(evidenceMarkdownPath, renderM3R2CResultsMarkdown(evidence));

  console.log(`executionSourceSha: ${sourceSha}`);
  console.log(`m3R2BMainBaseSha: ${M3_R2_C_MAIN_BASE_SHA}`);
  console.log(`selectionGateSha256: ${selectionGateSha}`);
  console.log(`experimentPlanSha256: ${experimentPlanSha}`);
  console.log(`protocolSourceSha: ${M3_R2_ROUND_002_SOURCE_SHA}`);
  console.log(`round001EvidenceSha256: ${round001EvidenceSha256}`);
  console.log(`controlReportSha256: ${controlReportSha256}`);
  console.log(`decisionSnapshotArtifactSha256: ${decisionSnapshotArtifactSha256}`);
  console.log(`round002EvidenceSha256: ${sha256M3R2CRawBytes(evidenceBytes)}`);
  console.log(`round002MarkdownSha256: ${sha256M3R2CRawBytes(markdownBytes)}`);
  console.log(`studyServerTime: ${evidence.studyServerTime}`);
  console.log(`snapshotCount: ${evidence.snapshotCount}`);
  console.log(`controlParityStatus: ${evidence.controlParityStatus}`);
  console.log(`evidenceStatus: ${evidence.evidenceStatus}`);
  console.log(`decision: ${evidence.decision}`);
  console.log(`controlAggregate: ${JSON.stringify(evidence.control.aggregateValidation?.diagnostics ?? null)}`);
  for (const candidate of evidence.candidates) {
    console.log(`${candidate.candidateId} aggregate: ${JSON.stringify(candidate.aggregateValidation?.diagnostics ?? null)}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
