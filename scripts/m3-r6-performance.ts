import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  M3_R6_ROUND_006_OUTPUT_PATHS,
  M3_R6_ROUND_006_RESEARCH_RESULTS_PATH,
  M3_R6_ROUND_006_SCHEMA_VERSION,
  assertRound006PerformancePreflight,
  currentRound006ProtocolGitBlobSha,
  executeRound006Authoritative,
  existingRound006OutputArtifacts,
  publishRound006ArtifactsAtomically,
  readRound006GitState,
  round006ArtifactHashes,
  Round006AuthoritativeExecutionError,
} from "../src/lib/research/m3-r6-round-006-performance.ts";
import {
  M3_R6_ROUND_006_CANDIDATE_IDS,
  M3_R6_ROUND_006_CONTROL_ID,
  M3_R6_ROUND_006_MACHINE_RECORD,
  validateM3R6Round006MachineRecord,
} from "../src/lib/research/selection-gates-round-006.ts";
import {
  validateM3R6Round006Plan,
} from "../src/lib/research/m3-r6-round-006-plan.ts";
import {
  M3_R6_PROTOCOL_VERSION,
  M3_R6_RESEARCH_END_ISO,
  R6_SYMBOLS,
} from "../src/lib/research/m3-r6-round-006-protocol.ts";
import { RESEARCH_FOLDS } from "../src/lib/research/folds.ts";

export type Round006AuthoritativeArguments = Readonly<{
  confirmAuthoritativePerformance: boolean;
  sourceSha: string;
  authorizedSourceSha: string;
  round: string;
  gateSha: string;
  planSha: string;
}>;

function argumentValue(argv: readonly string[], name: string): string {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? "" : "";
}

export function parseRound006AuthoritativeArguments(
  argv: readonly string[] = process.argv,
): Round006AuthoritativeArguments {
  return Object.freeze({
    confirmAuthoritativePerformance: argv.includes("--confirm-authoritative-performance"),
    sourceSha: argumentValue(argv, "--source-sha"),
    authorizedSourceSha: argumentValue(argv, "--authorized-source-sha"),
    round: argumentValue(argv, "--round"),
    gateSha: argumentValue(argv, "--gate-sha"),
    planSha: argumentValue(argv, "--plan-sha"),
  });
}

function validatorPass(validator: () => unknown): boolean {
  try {
    validator();
    return true;
  } catch {
    return false;
  }
}

function rawSha256(pathname: string): string {
  return createHash("sha256").update(readFileSync(pathname)).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultCounts(report: Readonly<{
  control: { resultStatus: string; fullSeenUniverse: { diagnostics: { formalSignals: number; executedTrades: number; netR: number } } };
  candidates: readonly { candidateId: string; resultStatus: string; fullSeenUniverse: { diagnostics: { formalSignals: number; executedTrades: number; netR: number } } }[];
}>): readonly string[] {
  return [
    `CONTROL formal=${report.control.fullSeenUniverse.diagnostics.formalSignals} executed=${report.control.fullSeenUniverse.diagnostics.executedTrades} netR=${report.control.fullSeenUniverse.diagnostics.netR}`,
    ...report.candidates.map((candidate) => `${candidate.candidateId} status=${candidate.resultStatus} formal=${candidate.fullSeenUniverse.diagnostics.formalSignals} executed=${candidate.fullSeenUniverse.diagnostics.executedTrades} netR=${candidate.fullSeenUniverse.diagnostics.netR}`),
  ];
}

async function main(): Promise<void> {
  let performanceLockTriggered = false;
  try {
    const args = parseRound006AuthoritativeArguments();
    const state = readRound006GitState();
    const existing = [
      ...existingRound006OutputArtifacts(),
      ...(existsSync(M3_R6_ROUND_006_RESEARCH_RESULTS_PATH) ? [M3_R6_ROUND_006_RESEARCH_RESULTS_PATH] : []),
    ];
    assertRound006PerformancePreflight({
      ...args,
      headSha: state.headSha,
      cleanWorktree: state.cleanWorktree,
      existingOutputArtifacts: existing,
      gateValidatorPass: validatorPass(validateM3R6Round006MachineRecord),
      planValidatorPass: validatorPass(validateM3R6Round006Plan),
      requiredManifestStatus: "PASS_BEFORE_NETWORK",
      protocolVersion: M3_R6_PROTOCOL_VERSION,
      protocolSourceSha: M3_R6_ROUND_006_MACHINE_RECORD.b1aProtocolSourceIdentity.sourceSha,
      protocolGitBlobSha: currentRound006ProtocolGitBlobSha(),
      candidateIds: M3_R6_ROUND_006_CANDIDATE_IDS,
      controlId: M3_R6_ROUND_006_CONTROL_ID,
      symbols: R6_SYMBOLS,
      folds: RESEARCH_FOLDS,
      backtestPolicyVersion: "bt-policy-003",
      researchEndIso: M3_R6_RESEARCH_END_ISO,
    });

    const artifacts = await executeRound006Authoritative({ executionSourceSha: args.sourceSha });
    performanceLockTriggered = artifacts.report.performanceLockTriggered;
    try {
      publishRound006ArtifactsAtomically({
        summaryPath: M3_R6_ROUND_006_OUTPUT_PATHS[0],
        auditPath: M3_R6_ROUND_006_OUTPUT_PATHS[1],
        resultsPath: M3_R6_ROUND_006_OUTPUT_PATHS[2],
        summary: artifacts.summaryJson,
        audit: artifacts.auditJson,
        results: artifacts.resultsMarkdown,
        researchResultsPath: M3_R6_ROUND_006_RESEARCH_RESULTS_PATH,
        researchResults: artifacts.resultsMarkdown,
      });
    } catch (error) {
      throw new Round006AuthoritativeExecutionError(
        "POST_PERFORMANCE_EVIDENCE_PUBLISH_ABORT",
        performanceLockTriggered,
        errorMessage(error),
        { cause: error },
      );
    }

    const hashes = round006ArtifactHashes(artifacts);
    const rawHashes = {
      summary: rawSha256(M3_R6_ROUND_006_OUTPUT_PATHS[0]),
      audit: rawSha256(M3_R6_ROUND_006_OUTPUT_PATHS[1]),
      results: rawSha256(M3_R6_ROUND_006_OUTPUT_PATHS[2]),
    };
    console.log(JSON.stringify({
      classification: "SUCCESS",
      schemaVersion: M3_R6_ROUND_006_SCHEMA_VERSION,
      executionSourceSha: artifacts.report.executionSourceSha,
      researchRoundId: artifacts.report.researchRoundId,
      performanceLock: artifacts.report.performanceLock,
      performanceLockTriggered: artifacts.report.performanceLockTriggered,
      evidenceStatus: artifacts.report.evidenceStatus,
      integrityErrors: artifacts.report.integrityErrors,
      controlAndCandidateCounts: resultCounts(artifacts.report),
      artifacts: {
        summary: { path: M3_R6_ROUND_006_OUTPUT_PATHS[0], sha256: rawHashes.summary },
        audit: { path: M3_R6_ROUND_006_OUTPUT_PATHS[1], sha256: rawHashes.audit },
        results: { path: M3_R6_ROUND_006_OUTPUT_PATHS[2], sha256: rawHashes.results },
        researchResults: { path: M3_R6_ROUND_006_RESEARCH_RESULTS_PATH, sha256: rawSha256(M3_R6_ROUND_006_RESEARCH_RESULTS_PATH) },
      },
      inMemoryArtifactHashes: hashes,
    }));
  } catch (error) {
    const classified = error instanceof Round006AuthoritativeExecutionError
      ? error
      : new Round006AuthoritativeExecutionError(
          performanceLockTriggered ? "POST_PERFORMANCE_EXECUTION_ABORT" : "PRE_PERFORMANCE_ABORT",
          performanceLockTriggered,
          errorMessage(error),
          { cause: error },
        );
    console.error(JSON.stringify({
      classification: classified.classification,
      performanceLockTriggered: classified.performanceLockTriggered,
      lifecycle: classified.lifecycle,
      error: classified.message,
    }));
    throw classified;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();

export { main as runM3R6PerformanceCommand };
