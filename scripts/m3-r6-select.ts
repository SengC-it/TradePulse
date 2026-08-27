import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  M3_R6_ROUND_006_SELECTION_INPUT_AUDIT_PATH,
  M3_R6_ROUND_006_SELECTION_INPUT_RESULTS_PATH,
  M3_R6_ROUND_006_SELECTION_INPUT_SUMMARY_PATH,
  M3_R6_ROUND_006_SELECTION_OUTPUT_JSON_PATH,
  M3_R6_ROUND_006_SELECTION_OUTPUT_MARKDOWN_PATH,
  createRound006SelectionReport,
  publishRound006SelectionOutputsAtomically,
  renderRound006SelectionMarkdown,
  serializeRound006SelectionReport,
} from "../src/lib/research/m3-r6-round-006-selection.ts";
import {
  M3_R6_ROUND_006_CANDIDATE_IDS,
  M3_R6_ROUND_006_SELECTION_GATE_SHA256,
  validateM3R6Round006MachineRecord,
} from "../src/lib/research/selection-gates-round-006.ts";
import {
  M3_R6_ROUND_006_PLAN_SHA256,
  validateM3R6Round006Plan,
} from "../src/lib/research/m3-r6-round-006-plan.ts";
import { M3_R6_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r6-round-006-protocol.ts";

export type Round006SelectionArguments = Readonly<{
  confirmAuthoritativeSelection: boolean;
  gateApplicationSourceSha: string;
  summarySha256: string;
  auditSha256: string;
  resultsSha256: string;
}>;

function argumentValue(argv: readonly string[], name: string): string {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? "" : "";
}

export function parseRound006SelectionArguments(
  argv: readonly string[] = process.argv,
): Round006SelectionArguments {
  return Object.freeze({
    confirmAuthoritativeSelection: argv.includes("--confirm-authoritative-selection"),
    gateApplicationSourceSha: argumentValue(argv, "--gate-application-source-sha") || argumentValue(argv, "--source-sha"),
    summarySha256: argumentValue(argv, "--summary-sha256"),
    auditSha256: argumentValue(argv, "--audit-sha256"),
    resultsSha256: argumentValue(argv, "--results-sha256"),
  });
}

function rawSha256(pathname: string): string {
  return createHash("sha256").update(readFileSync(pathname)).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectedPerformanceStatus(): readonly string[] {
  return [
    `?? ${M3_R6_ROUND_006_SELECTION_INPUT_SUMMARY_PATH}`,
    `?? ${M3_R6_ROUND_006_SELECTION_INPUT_AUDIT_PATH}`,
    `?? ${M3_R6_ROUND_006_SELECTION_INPUT_RESULTS_PATH}`,
    "?? docs/research/round-006-results.md",
  ];
}

function assertOnlyPerformanceArtifactsAreUncommitted(): void {
  const lines = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
    .split(/\r?\n/u)
    .filter(Boolean);
  const expected = expectedPerformanceStatus();
  assertCondition(
    lines.length === expected.length && lines.every((line) => expected.includes(line)),
    "Round-006 selection requires exactly the four untracked performance artifacts and no source changes.",
  );
}

async function main(): Promise<void> {
  try {
    const args = parseRound006SelectionArguments();
    assertCondition(args.confirmAuthoritativeSelection, "--confirm-authoritative-selection is required.");
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    assertCondition(/^[0-9a-f]{40}$/u.test(headSha), "Round-006 gate application source SHA is not a Git SHA.");
    assertCondition(args.gateApplicationSourceSha === headSha, "Round-006 gate application source SHA must exactly match HEAD.");
    assertOnlyPerformanceArtifactsAreUncommitted();
    assertCondition(!existsSync(M3_R6_ROUND_006_SELECTION_OUTPUT_JSON_PATH), "Round-006 selection JSON already exists; refusing overwrite.");
    assertCondition(!existsSync(M3_R6_ROUND_006_SELECTION_OUTPUT_MARKDOWN_PATH), "Round-006 selection Markdown already exists; refusing overwrite.");
    validateM3R6Round006MachineRecord();
    validateM3R6Round006Plan();

    const summaryBytes = readFileSync(M3_R6_ROUND_006_SELECTION_INPUT_SUMMARY_PATH);
    const summarySha256 = rawSha256(M3_R6_ROUND_006_SELECTION_INPUT_SUMMARY_PATH);
    const auditSha256 = rawSha256(M3_R6_ROUND_006_SELECTION_INPUT_AUDIT_PATH);
    const resultsSha256 = rawSha256(M3_R6_ROUND_006_SELECTION_INPUT_RESULTS_PATH);
    assertCondition(summarySha256 === args.summarySha256, "Round-006 Summary SHA-256 does not match the authorized input.");
    assertCondition(auditSha256 === args.auditSha256, "Round-006 Audit SHA-256 does not match the authorized input.");
    assertCondition(resultsSha256 === args.resultsSha256, "Round-006 Results SHA-256 does not match the authorized input.");

    const evidence: unknown = JSON.parse(summaryBytes.toString("utf8"));
    assertCondition(
      typeof evidence === "object" && evidence !== null && "executionSourceSha" in evidence && evidence.executionSourceSha === headSha,
      "Round-006 performance evidence source SHA must equal the gate application HEAD.",
    );
    const selection = createRound006SelectionReport({
      evidence,
      gateApplicationSourceSha: headSha,
      inputSummarySha256: summarySha256,
      inputAuditSha256: auditSha256,
      inputResultsSha256: resultsSha256,
    });
    assertCondition(selection.researchRoundId === M3_R6_RESEARCH_ROUND_ID, "Round-006 selection research round mismatch.");
    assertCondition(selection.performanceEvidenceStatus === "COMPLETE", "Round-006 performance evidence is not complete.");
    assertCondition(selection.integrityStatus === "COMPLETE" && selection.integrityErrors.length === 0, "Round-006 selection input integrity failed.");
    assertCondition(selection.selectionGateSha256 === M3_R6_ROUND_006_SELECTION_GATE_SHA256, "Round-006 selection Gate identity is invalid.");
    assertCondition(selection.experimentPlanSha256 === M3_R6_ROUND_006_PLAN_SHA256, "Round-006 selection Plan identity is invalid.");
    assertCondition(selection.candidates.length === M3_R6_ROUND_006_CANDIDATE_IDS.length, "Round-006 selection candidate registry length mismatch.");
    assertCondition(selection.baseline002Status === "NOT_FROZEN" && selection.m3JStatus === "BLOCKED" && selection.m4Status === "NOT_STARTED", "Round-006 milestone boundary changed.");

    const jsonBytes = Buffer.from(serializeRound006SelectionReport(selection), "utf8");
    const markdownBytes = Buffer.from(renderRound006SelectionMarkdown(selection), "utf8");
    publishRound006SelectionOutputsAtomically({
      jsonPath: M3_R6_ROUND_006_SELECTION_OUTPUT_JSON_PATH,
      markdownPath: M3_R6_ROUND_006_SELECTION_OUTPUT_MARKDOWN_PATH,
      jsonBytes,
      markdownBytes,
    });
    console.log(JSON.stringify({
      classification: "SUCCESS",
      researchRoundId: selection.researchRoundId,
      gateApplicationSourceSha: selection.gateApplicationSourceSha,
      performanceExecutionSourceSha: selection.performanceExecutionSourceSha,
      inputArtifacts: {
        summary: { path: M3_R6_ROUND_006_SELECTION_INPUT_SUMMARY_PATH, sha256: summarySha256 },
        audit: { path: M3_R6_ROUND_006_SELECTION_INPUT_AUDIT_PATH, sha256: auditSha256 },
        results: { path: M3_R6_ROUND_006_SELECTION_INPUT_RESULTS_PATH, sha256: resultsSha256 },
      },
      performanceEvidenceStatus: selection.performanceEvidenceStatus,
      integrityStatus: selection.integrityStatus,
      integrityErrors: selection.integrityErrors,
      candidateIds: selection.candidates.map((candidate) => ({ candidateId: candidate.candidateId, eligibility: candidate.eligibility, failedGateIds: candidate.failedGateIds })),
      eligibleCandidateIds: selection.eligibleCandidateIds,
      selectionAlgorithmApplied: selection.selectionAlgorithmApplied,
      selectedCandidateId: selection.selectedCandidateId,
      finalDecision: selection.finalDecision,
      outputs: {
        json: { path: M3_R6_ROUND_006_SELECTION_OUTPUT_JSON_PATH, sha256: rawSha256(M3_R6_ROUND_006_SELECTION_OUTPUT_JSON_PATH) },
        markdown: { path: M3_R6_ROUND_006_SELECTION_OUTPUT_MARKDOWN_PATH, sha256: rawSha256(M3_R6_ROUND_006_SELECTION_OUTPUT_MARKDOWN_PATH) },
      },
    }));
  } catch (error) {
    console.error(JSON.stringify({ classification: "SELECTION_ABORT", error: errorMessage(error) }));
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();

export { main as runM3R6SelectionCommand };
