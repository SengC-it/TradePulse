import { existsSync, mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import {
  M3_R4_C_OUTPUT_PATHS,
  M3_R4_C_RESEARCH_UNIVERSE,
  assertRound004ExecutionPreflight,
  existingRound004OutputArtifacts,
  executeRound004AuthoritativeDetailed,
  protocolBaseMainSha,
  readRound004GitState,
} from "../src/lib/research/m3-r4-round-004-performance.ts";
import {
  validateM3R4Round004MachineRecord,
} from "../src/lib/research/selection-gates-round-004.ts";
import { M3_R4_ROUND_004_PLAN, validateM3R4Round004Plan } from "../src/lib/research/m3-r4-round-004-plan.ts";

export type Round004AuthoritativeArguments = Readonly<{
  confirmAuthoritativeRun: boolean;
  sourceSha: string;
  round: string;
  gateSha: string;
  planSha: string;
}>;

function argumentValue(argv: readonly string[], name: string): string {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? "" : "";
}

export function parseRound004AuthoritativeArguments(argv: readonly string[] = process.argv): Round004AuthoritativeArguments {
  return Object.freeze({
    confirmAuthoritativeRun: argv.includes("--confirm-authoritative-run"),
    sourceSha: argumentValue(argv, "--source-sha"),
    round: argumentValue(argv, "--round"),
    gateSha: argumentValue(argv, "--gate-sha"),
    planSha: argumentValue(argv, "--plan-sha"),
  });
}

export function publishRound004ArtifactsAtomically(input: Readonly<{
  summaryPath: string;
  auditPath: string;
  resultsPath: string;
  summary: string;
  audit: string;
  results: string;
}>): void {
  const destinations = [input.auditPath, input.resultsPath, input.summaryPath];
  if (destinations.some((destination) => existsSync(destination))) {
    throw new Error("Round-004 output already exists; refusing overwrite.");
  }
  const parent = path.dirname(input.summaryPath);
  mkdirSync(parent, { recursive: true });
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "tradepulse-m3-r4-"));
  const temporaryPaths = destinations.map((destination) => path.join(temporaryDirectory, path.basename(destination)));
  try {
    writeFileSync(temporaryPaths[0]!, input.audit, "utf8");
    writeFileSync(temporaryPaths[1]!, input.results, "utf8");
    writeFileSync(temporaryPaths[2]!, input.summary, "utf8");
    for (let index = 0; index < destinations.length; index += 1) renameSync(temporaryPaths[index]!, destinations[index]!);
  } catch (error) {
    throw error;
  }
}

async function main(): Promise<void> {
  const args = parseRound004AuthoritativeArguments();
  if (!args.confirmAuthoritativeRun) {
    throw new Error("--confirm-authoritative-run is required; no network access was attempted.");
  }
  const gitState = readRound004GitState();
  const outputArtifacts = existingRound004OutputArtifacts();
  assertRound004ExecutionPreflight({
    ...args,
    headSha: gitState.headSha,
    cleanWorktree: gitState.cleanWorktree,
    existingOutputArtifacts: outputArtifacts,
    gateValidatorPass: validateM3R4Round004MachineRecord() !== undefined,
    planValidatorPass: validateM3R4Round004Plan() === M3_R4_ROUND_004_PLAN,
  });
  const artifacts = await executeRound004AuthoritativeDetailed({
    loader: new BinanceHistoricalDataLoader(),
    executionSourceSha: args.sourceSha,
  });
  publishRound004ArtifactsAtomically({
    summaryPath: M3_R4_C_OUTPUT_PATHS[0],
    auditPath: M3_R4_C_OUTPUT_PATHS[1],
    resultsPath: M3_R4_C_OUTPUT_PATHS[2],
    summary: artifacts.summaryJson,
    audit: artifacts.auditJson,
    results: artifacts.resultsMarkdown,
  });
  console.log(`Round-004 report schema: ${artifacts.report.schemaVersion}`);
  console.log(`Round-004 execution source: ${artifacts.report.executionSourceSha}`);
  console.log(`Research universe: ${M3_R4_C_RESEARCH_UNIVERSE.startTime}..${M3_R4_C_RESEARCH_UNIVERSE.endTime}`);
  console.log(`Protocol base: ${protocolBaseMainSha}`);
  console.log(`Performance lock: ${artifacts.report.performanceLock}`);
  console.log(`Report bytes: ${artifacts.summaryJson.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}

export { main as runM3R4PerformanceCommand };
