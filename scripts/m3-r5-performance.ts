import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  M3_R5_ROUND_005_OUTPUT_PATHS,
  executeRound005Authoritative,
  existingRound005OutputArtifacts,
  assertRound005PerformancePreflight,
  readRound005GitState,
} from "../src/lib/research/m3-r5-round-005-performance.ts";
import { M3_R5_ROUND_005_RESEARCH_ROUND_ID, M3_R5_ROUND_005_SELECTION_GATE_SHA256, validateM3R5Round005MachineRecord } from "../src/lib/research/selection-gates-round-005.ts";
import { M3_R5_ROUND_005_PLAN_SHA256, validateM3R5Round005Plan } from "../src/lib/research/m3-r5-round-005-plan.ts";

export { executeRound005Authoritative } from "../src/lib/research/m3-r5-round-005-performance.ts";

export type Round005AuthoritativeArguments = Readonly<{
  confirmAuthoritativePerformance: boolean;
  sourceSha: string;
  round: string;
  gateSha: string;
  planSha: string;
}>;

function argumentValue(argv: readonly string[], name: string): string {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? "" : "";
}

export function parseRound005AuthoritativeArguments(argv: readonly string[] = process.argv): Round005AuthoritativeArguments {
  return Object.freeze({
    confirmAuthoritativePerformance: argv.includes("--confirm-authoritative-performance"),
    sourceSha: argumentValue(argv, "--source-sha"),
    round: argumentValue(argv, "--round"),
    gateSha: argumentValue(argv, "--gate-sha"),
    planSha: argumentValue(argv, "--plan-sha"),
  });
}

export function round005ArtifactStagingPrefix(summaryPath: string): string {
  return path.join(path.dirname(summaryPath), ".tradepulse-m3-r5-");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function publicationFailureWithRollbackErrors(publicationError: unknown, rollbackErrors: readonly unknown[]): Error {
  return new Error(
    `Round-005 artifact publication failed: ${errorMessage(publicationError)}; rollback failed: ${rollbackErrors.map(errorMessage).join("; ")}`,
    { cause: publicationError },
  );
}

/** Publishes AUDIT -> RESULTS -> SUMMARY on the destination filesystem. */
export function publishRound005ArtifactsAtomically(input: Readonly<{
  summaryPath: string;
  auditPath: string;
  resultsPath: string;
  summary: string;
  audit: string;
  results: string;
  rename?: typeof renameSync;
}>): void {
  const destinations = [input.auditPath, input.resultsPath, input.summaryPath];
  if (destinations.some((destination) => existsSync(destination))) {
    throw new Error("Round-005 output already exists; refusing overwrite.");
  }
  const parent = path.dirname(input.summaryPath);
  mkdirSync(parent, { recursive: true });
  const stagingDirectory = mkdtempSync(round005ArtifactStagingPrefix(input.summaryPath));
  const staged = destinations.map((destination) => path.join(stagingDirectory, path.basename(destination)));
  const renameArtifact = input.rename ?? renameSync;
  const published: string[] = [];
  try {
    writeFileSync(staged[0]!, input.audit, "utf8");
    writeFileSync(staged[1]!, input.results, "utf8");
    writeFileSync(staged[2]!, input.summary, "utf8");
    for (let index = 0; index < destinations.length; index += 1) {
      const destination = destinations[index]!;
      if (existsSync(destination)) throw new Error(`Round-005 output appeared during publication; refusing overwrite: ${destination}`);
      renameArtifact(staged[index]!, destination);
      published.push(destination);
    }
  } catch (publicationError) {
    const rollbackErrors: unknown[] = [];
    for (const destination of [...published].reverse()) {
      try {
        rmSync(destination, { force: true });
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
    try {
      rmSync(stagingDirectory, { recursive: true, force: true });
    } catch (error) {
      rollbackErrors.push(error);
    }
    if (rollbackErrors.length > 0) throw publicationFailureWithRollbackErrors(publicationError, rollbackErrors);
    throw publicationError;
  }
  rmSync(stagingDirectory, { recursive: true, force: true });
}

async function main(): Promise<void> {
  const args = parseRound005AuthoritativeArguments();
  if (!args.confirmAuthoritativePerformance) throw new Error("--confirm-authoritative-performance is required; no network access was attempted.");
  const state = readRound005GitState();
  assertRound005PerformancePreflight({
    ...args,
    headSha: state.headSha,
    cleanWorktree: state.cleanWorktree,
    existingOutputArtifacts: existingRound005OutputArtifacts(),
    gateValidatorPass: validateM3R5Round005MachineRecord() !== undefined,
    planValidatorPass: validateM3R5Round005Plan() !== undefined,
  });
  const artifacts = await executeRound005Authoritative({ executionSourceSha: args.sourceSha });
  publishRound005ArtifactsAtomically({
    summaryPath: M3_R5_ROUND_005_OUTPUT_PATHS[0],
    auditPath: M3_R5_ROUND_005_OUTPUT_PATHS[1],
    resultsPath: M3_R5_ROUND_005_OUTPUT_PATHS[2],
    summary: artifacts.summaryJson,
    audit: artifacts.auditJson,
    results: artifacts.resultsMarkdown,
  });
  console.log(`Round-005 report schema: ${artifacts.report.schemaVersion}`);
  console.log(`Round-005 execution source: ${artifacts.report.executionSourceSha}`);
  console.log(`Round-005 performance lock: ${artifacts.report.performanceLock}`);
  console.log(`Round-005 evidence status: ${artifacts.report.evidenceStatus}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();

export { main as runM3R5PerformanceCommand };
export { M3_R5_ROUND_005_RESEARCH_ROUND_ID, M3_R5_ROUND_005_SELECTION_GATE_SHA256, M3_R5_ROUND_005_PLAN_SHA256 };
