import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  M3_R8_FREEZE_SOURCE_SHA,
  M3_R8_PERFORMANCE_LOCK,
  M3_R8_REPLAY_SOURCE_SHA,
  M3_R8_RESEARCH_END_ISO,
  M3_R8_RESEARCH_ROUND_ID,
  R8_CANDIDATE_IDS,
  R8_RESULT_AFFECTING_SPEC_DIFF_COUNT,
  R8_SELECTION_GATE_SHA256,
  validateR8ProtocolMachineRecord,
} from "../src/lib/research/m3-r8-round-008-protocol.ts";
import { R8_PLAN_SHA256, validateR8Plan } from "../src/lib/research/m3-r8-round-008-plan.ts";
import { runR8SyntheticLifecycleContract } from "../src/lib/research/m3-r8-round-008-evidence.ts";
import {
  M3_R8_OUTPUT_PATHS,
  executeR8Authoritative,
  existingR8OutputArtifacts,
  r8OutputPaths,
  sha256R8Bytes,
  validateR8AuthoritativeReport,
} from "../src/lib/research/m3-r8-round-008-performance.ts";
import { publishR8ArtifactsAtomically } from "../src/lib/research/m3-r8-round-008-publication.ts";

type ParsedArgs = Readonly<{ confirm: boolean; sourceSha: string; cacheDirectory: string; acceptedServerTime?: number }>;

function argumentValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const sourceSha = argumentValue(argv, "--source-sha");
  if (!sourceSha) throw new Error("--source-sha is required.");
  const studyServerTime = argumentValue(argv, "--study-server-time");
  return Object.freeze({
    confirm: argv.includes("--confirm-authoritative-performance"),
    sourceSha,
    cacheDirectory: path.resolve(argumentValue(argv, "--cache-directory") ?? path.join(process.cwd(), ".cache", "tradepulse", "round-006")),
    ...(studyServerTime === undefined ? {} : { acceptedServerTime: Number(studyServerTime) }),
  });
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function assertR7InvalidationRecord(root: string): void {
  const filePath = path.join(root, "docs", "research", "round-007-invalidation.json");
  if (!existsSync(filePath)) throw new Error("Round-007 invalidation provenance is missing.");
  const record = JSON.parse(readFileSync(filePath, "utf8")) as {
    roundId?: string;
    executionSourceSha?: string;
    performanceLockTriggered?: boolean;
    classification?: string;
    artifactStatus?: string;
    artifacts?: readonly { path: string; sizeBytes: number; sha256: string; status: string }[];
  };
  if (record.roundId !== "baseline-002-research-round-007" || record.executionSourceSha !== M3_R8_REPLAY_SOURCE_SHA || record.performanceLockTriggered !== true || record.classification !== "INVALIDATED_AFTER_PERFORMANCE_LOCK" || record.artifactStatus !== "INVALIDATED_NON_AUTHORITATIVE") throw new Error("Round-007 invalidation provenance is not authoritative.");
  const expected = [
    ["docs/evidence/M3_R7_ROUND_007_SUMMARY.json", 719092, "535f574cbefc9c825b365b81a94c33c7e27b606bdb094d3fdc4dfc75147b25be"],
    ["docs/evidence/M3_R7_ROUND_007_AUDIT.json", 2488307, "899746bce47c188c1b14e872d1d9dbae4d787d18360aae0fdf3e34be47ffdece"],
    ["docs/M3_R7_ROUND_007_RESULTS.md", 5127, "6d10da2ca7d07dcb64dc84bb942427f8fb89d164ed69a6868757855a020c84c8"],
    ["docs/evidence/M3_R7_ROUND_007_SELECTION.json", 9916, "6ea30db1dfca97075d58302564a7549764b9858170858e9f199c781be5a72c4b"],
    ["docs/M3_R7_ROUND_007_SELECTION.md", 2067, "b7dcd3d19d89e3944a055e8c7cabdde0674c6c0dba8c1a356dc233c8d7fc65b0"],
  ] as const;
  if (!record.artifacts || record.artifacts.length !== expected.length) throw new Error("Round-007 invalidation artifact count changed.");
  for (const [index, item] of expected.entries()) {
    const actual = record.artifacts[index];
    if (!actual || actual.path !== item[0] || actual.sizeBytes !== item[1] || actual.sha256 !== item[2] || actual.status !== "INVALIDATED_NON_AUTHORITATIVE") throw new Error(`Round-007 invalidation artifact mismatch at index ${index}.`);
  }
}

function preflight(input: ParsedArgs): void {
  if (!input.confirm) throw new Error("--confirm-authoritative-performance is required before the single R8 execution.");
  const head = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain"]);
  if (head !== input.sourceSha) throw new Error(`R8 source SHA does not match HEAD: ${head}`);
  if (status.length > 0) throw new Error("R8 authoritative execution requires a clean worktree.");
  if (input.sourceSha === M3_R8_FREEZE_SOURCE_SHA) throw new Error("R8 execution source must include the replay implementation.");
  if (existingR8OutputArtifacts().length > 0) throw new Error(`R8 authoritative outputs already exist: ${existingR8OutputArtifacts().join(", ")}`);
  assertR7InvalidationRecord(process.cwd());
  validateR8ProtocolMachineRecord();
  validateR8Plan();
  if (R8_RESULT_AFFECTING_SPEC_DIFF_COUNT !== 0 || M3_R8_RESEARCH_ROUND_ID !== "baseline-002-research-round-008" || M3_R8_RESEARCH_END_ISO !== "2026-08-15T23:59:59.999Z" || !R8_SELECTION_GATE_SHA256 || !R8_PLAN_SHA256 || R8_CANDIDATE_IDS.length !== 5) throw new Error("R8 frozen identity preflight failed.");
  const synthetic = runR8SyntheticLifecycleContract();
  if (!synthetic.passed) throw new Error("R8 synthetic lifecycle contract failed before performance lock.");
  if (!existsSync(input.cacheDirectory)) throw new Error(`R8 accepted cache is missing: ${input.cacheDirectory}`);
}

function publishArtifacts(artifacts: Awaited<ReturnType<typeof executeR8Authoritative>>): void {
  publishR8ArtifactsAtomically({
    summary: artifacts.summaryJson,
    audit: artifacts.auditJson,
    results: artifacts.resultsMarkdown,
    selectionJson: artifacts.selectionJson,
    selectionMarkdown: artifacts.selectionMarkdown,
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  preflight(args);
  const artifacts = await executeR8Authoritative({ cacheDirectory: args.cacheDirectory, executionSourceSha: args.sourceSha, acceptedServerTime: args.acceptedServerTime });
  validateR8AuthoritativeReport(artifacts.report);
  publishArtifacts(artifacts);
  const outputSizes = r8OutputPaths().map((filePath) => ({ filePath, bytes: statSync(filePath).size, sha256: sha256R8Bytes(readFileSync(filePath)) }));
  if (outputSizes.some(({ bytes }) => bytes >= 100 * 1024 * 1024)) throw new Error(`R8 evidence exceeds normal Git size policy: ${JSON.stringify(outputSizes)}`);
  console.log(JSON.stringify({
    head: git(["rev-parse", "HEAD"]),
    researchRoundId: M3_R8_RESEARCH_ROUND_ID,
    selectionGateSha256: R8_SELECTION_GATE_SHA256,
    experimentPlanSha256: R8_PLAN_SHA256,
    performanceExecutionCount: artifacts.report.performanceExecutionCount,
    performanceLock: M3_R8_PERFORMANCE_LOCK,
    performanceLockTriggered: artifacts.report.performanceLockTriggered,
    evidenceStatus: artifacts.report.evidenceStatus,
    integrityErrors: artifacts.report.integrityErrors,
    controlReportStatus: artifacts.report.controlReport.status,
    selection: artifacts.report.selection,
    outputSizes,
    outputs: M3_R8_OUTPUT_PATHS,
  }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
