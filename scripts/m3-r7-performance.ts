import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  M3_R7_CANDIDATE_IDS,
  M3_R7_CONTROL_ID,
  M3_R7_FREEZE_SOURCE_SHA,
  M3_R7_POLICY_VERSION,
  M3_R7_RESEARCH_END_ISO,
  M3_R7_RESEARCH_ROUND_ID,
} from "../src/lib/research/m3-r7-round-007-protocol.ts";
import { R7_PLAN_SHA256, validateR7Plan } from "../src/lib/research/m3-r7-round-007-plan.ts";
import { R7_MACHINE_RECORD, R7_SELECTION_GATE_SHA256, validateR7MachineRecord } from "../src/lib/research/selection-gates-round-007.ts";
import {
  executeR7Authoritative,
  existingR7OutputArtifacts,
  r7OutputPaths,
} from "../src/lib/research/m3-r7-round-007-performance.ts";

type ParsedArgs = Readonly<{ confirm: boolean; sourceSha: string; cacheDirectory: string; acceptedServerTime?: number }>;

function argumentValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const sourceSha = argumentValue(argv, "--source-sha");
  if (!sourceSha) throw new Error("--source-sha is required.");
  return Object.freeze({ confirm: argv.includes("--confirm-authoritative-performance"), sourceSha, cacheDirectory: path.resolve(argumentValue(argv, "--cache-directory") ?? path.join(process.cwd(), ".cache", "tradepulse", "round-006")), ...(argumentValue(argv, "--study-server-time") ? { acceptedServerTime: Number(argumentValue(argv, "--study-server-time")) } : {}) });
}

function git(args: readonly string[]): string { return execFileSync("git", args, { encoding: "utf8" }).trim(); }

function preflight(input: ParsedArgs): void {
  if (!input.confirm) throw new Error("--confirm-authoritative-performance is required before any data access.");
  const head = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain"]);
  if (head !== input.sourceSha) throw new Error(`R7 source SHA does not match HEAD: ${head}`);
  if (status.length > 0) throw new Error("R7 authoritative execution requires a clean worktree.");
  if (input.sourceSha === M3_R7_FREEZE_SOURCE_SHA) throw new Error("R7 execution source must be the post-freeze implementation SHA.");
  const existing = existingR7OutputArtifacts();
  if (existing.length > 0) throw new Error(`R7 authoritative outputs already exist: ${existing.join(", ")}`);
  validateR7MachineRecord();
  validateR7Plan();
  if (M3_R7_RESEARCH_ROUND_ID !== "baseline-002-research-round-007" || M3_R7_RESEARCH_END_ISO !== "2026-08-15T23:59:59.999Z" || M3_R7_POLICY_VERSION !== "bt-policy-003" || M3_R7_CONTROL_ID !== "R7-CONTROL-BASELINE-001" || M3_R7_CANDIDATE_IDS.length !== 5 || !R7_SELECTION_GATE_SHA256 || !R7_PLAN_SHA256 || !R7_MACHINE_RECORD) throw new Error("R7 frozen identity preflight failed.");
  if (!existsSync(input.cacheDirectory)) throw new Error(`R7 accepted cache is missing: ${input.cacheDirectory}`);
}

function publishFile(stagingDirectory: string, target: string, bytes: Uint8Array): void {
  const staged = path.join(stagingDirectory, path.basename(target));
  writeFileSync(staged, bytes);
}

function publishArtifacts(artifacts: Awaited<ReturnType<typeof executeR7Authoritative>>): void {
  const root = process.cwd();
  const targets = Object.freeze([
    path.join(root, "docs/evidence/M3_R7_ROUND_007_AUDIT.json"),
    path.join(root, "docs/M3_R7_ROUND_007_RESULTS.md"),
    path.join(root, "docs/M3_R7_ROUND_007_SELECTION.md"),
    path.join(root, "docs/evidence/M3_R7_ROUND_007_SELECTION.json"),
    path.join(root, "docs/evidence/M3_R7_ROUND_007_SUMMARY.json"),
  ]);
  if (targets.some((target) => existsSync(target))) throw new Error("R7 output appeared before publication.");
  mkdirSync(path.dirname(targets[0]!), { recursive: true });
  mkdirSync(path.dirname(targets[1]!), { recursive: true });
  const stagingDirectory = mkdtempSync(path.join(path.dirname(targets[0]!), ".tradepulse-m3-r7-"));
  const payloads = [artifacts.auditJson, artifacts.resultsMarkdown, artifacts.selectionMarkdown, artifacts.selectionJson, artifacts.summaryJson];
  const published: string[] = [];
  try {
    payloads.forEach((payload, index) => publishFile(stagingDirectory, targets[index]!, new TextEncoder().encode(payload)));
    for (const target of targets) {
      if (existsSync(target)) throw new Error(`R7 output appeared during publication: ${target}`);
      renameSync(path.join(stagingDirectory, path.basename(target)), target);
      published.push(target);
    }
    rmSync(stagingDirectory, { recursive: true, force: true });
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const target of [...published].reverse()) { try { unlinkSync(target); } catch (rollbackError) { rollbackErrors.push(rollbackError); } }
    try { rmSync(stagingDirectory, { recursive: true, force: true }); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    if (rollbackErrors.length > 0) throw new Error(`R7 publication failed: ${error instanceof Error ? error.message : String(error)}; rollback failed: ${rollbackErrors.map(String).join("; ")}`, { cause: error });
    throw error;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  preflight(args);
  const artifacts = await executeR7Authoritative({ cacheDirectory: args.cacheDirectory, executionSourceSha: args.sourceSha, acceptedServerTime: args.acceptedServerTime });
  publishArtifacts(artifacts);
  const sizes = r7OutputPaths().map((filePath) => ({ filePath, bytes: statSync(filePath).size }));
  if (sizes.some(({ bytes }) => bytes >= 100 * 1024 * 1024)) throw new Error(`R7 evidence exceeds normal Git size policy: ${JSON.stringify(sizes)}`);
  const summary = JSON.parse(readFileSync(path.join(process.cwd(), "docs/evidence/M3_R7_ROUND_007_SUMMARY.json"), "utf8")) as { performanceExecutionCount: number; performanceLockTriggered: boolean; evidenceStatus: string };
  console.log(JSON.stringify({ head: git(["rev-parse", "HEAD"]), selectionGateSha256: R7_SELECTION_GATE_SHA256, experimentPlanSha256: R7_PLAN_SHA256, performanceExecutionCount: summary.performanceExecutionCount, performanceLockTriggered: summary.performanceLockTriggered, evidenceStatus: summary.evidenceStatus, outputSizes: sizes, outputs: r7OutputPaths() }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
