import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { readR18ObservationFreezeManifest } from "../src/lib/research/m3-r18-round-018-observation-freeze.ts";
import { verifyR18AcceptedProvenance } from "../src/lib/research/m3-r18-round-018-provenance.ts";
import {
  buildR18ExecutionArtifacts,
  executeR18Performance,
  existingR18OutputArtifacts,
  loadR18StructuralIndex,
  publishR18ArtifactsAtomically,
  R18_PERFORMANCE_OUTPUT_PATHS,
  R18_PERFORMANCE_STAGE_SOURCE,
  R18_DESIGN_SOURCE,
} from "../src/lib/research/m3-r18-round-018-performance.ts";
import {
  claimR18PerformanceExecution,
  deriveR18PerformanceExecutionCount,
  newR18ExecutionId,
  readR18PerformanceLedger,
  roundGlobalR18PerformanceLedgerPath,
  updateR18PerformanceLedger,
} from "../src/lib/research/m3-r18-round-018-performance-ledger.ts";
import {
  ROUND_018_FOLDS,
  ROUND_018_OBSERVATION_COUNT,
  ROUND_018_OBSERVATION_SOURCE,
  ROUND_018_OBSERVATION_SHA256,
  ROUND_018_PREFLIGHT_JSON_PATH,
  ROUND_018_STRUCTURAL_OBSERVATION_SOURCE,
  ROUND_018_RESEARCH_ROUND_ID,
} from "../src/lib/research/m3-r18-round-018-protocol.ts";

const EXPECTED_COMPACT_SHA256 = "3b601770ed56b528f3c35153e7f82f82e16851b33dbfb1ce297fe9c4dca975aa";
const EXPECTED_STRUCTURAL_MANIFEST_SHA256 = "7a7bacbc0b5a6a3a7db1c204e8352733f2a8111db3f405da4c06d3ad84e5553f";
const EXPECTED_PREFLIGHT_SHA256 = "8dc73256160d15e43d6603b1c492ac95f44ef9e752454edc9540d13b0d2bf888";
const EXPECTED_R14_BYTES = 1_893_811_055;
const FORBIDDEN_EXECUTION_DIRECTORY_FLAG = "--execution-directory";

type StaticIdentity = Readonly<{
  design: Record<string, unknown>;
  manifestSha256: string;
  preflightSha256: string;
  compactSha256: string;
  r14ObservationSha256: string;
}>;

function sha256Bytes(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk as Buffer);
  return digest.digest("hex");
}

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function requireValue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function verifyStaticIdentities(root: string): Promise<StaticIdentity> {
  const designPath = path.join(root, "docs", "research", "round-018-design.json");
  const design = JSON.parse(readFileSync(designPath, "utf8")) as Record<string, unknown>;
  const accepted = design.acceptedResearchSource as Record<string, unknown>;
  requireValue(accepted.commit === R18_DESIGN_SOURCE, "R18 design accepted source mismatch.");
  requireValue(git(root, ["rev-parse", `${R18_PERFORMANCE_STAGE_SOURCE}^{commit}`]) === R18_PERFORMANCE_STAGE_SOURCE, "R18 performance-stage source commit is unavailable.");
  requireValue(git(root, ["merge-base", "--is-ancestor", R18_PERFORMANCE_STAGE_SOURCE, "HEAD"]) === "", "R18 performance branch is not descended from the accepted performance-stage source.");

  const manifest = readR18ObservationFreezeManifest(root);
  const compactPath = path.join(root, ROUND_018_STRUCTURAL_OBSERVATION_SOURCE);
  const compactSha256 = sha256Bytes(readFileSync(compactPath));
  requireValue(manifest.manifestSha256 === EXPECTED_STRUCTURAL_MANIFEST_SHA256, "R18 structural freeze manifest self-hash mismatch.");
  requireValue(manifest.compactStructuralObservation.sha256 === EXPECTED_COMPACT_SHA256 && compactSha256 === EXPECTED_COMPACT_SHA256, "R18 compact structural observation SHA mismatch.");
  requireValue(manifest.counts.observationCount === ROUND_018_OBSERVATION_COUNT && manifest.counts.controlCount === 5_834 && manifest.counts.candidateCount === 3_359, "R18 structural counts do not match the accepted freeze.");
  requireValue(manifest.counts.provenanceIncompleteCount === 0 && manifest.counts.duplicateCanonicalCount === 0, "R18 structural integrity counts are not complete.");

  const preflightPath = path.join(root, ROUND_018_PREFLIGHT_JSON_PATH);
  const preflightBytes = readFileSync(preflightPath);
  const preflight = JSON.parse(preflightBytes.toString("utf8")) as Record<string, unknown>;
  const preflightCounts = preflight.counts as Record<string, unknown>;
  const preflightIntegrity = preflight.integrity as Record<string, unknown>;
  requireValue(preflight.reportSha256 === EXPECTED_PREFLIGHT_SHA256, "R18 preflight report SHA mismatch.");
  requireValue(preflight.finalClassification === "ROUND-018 PREFLIGHT PASS — PERFORMANCE NOT AUTHORIZED", "R18 preflight is not an accepted PASS.");
  requireValue(preflightCounts.r14NativeObservationCount === 244_810 && preflightCounts.r14NativeFormalControlCount === 5_834 && preflightCounts.candidateCount === 3_359 && preflightCounts.validationCandidateH4ExecutedCount === 3_136, "R18 preflight structural counts do not match the accepted report.");
  requireValue(preflightIntegrity.economicFieldsRead === false && preflightIntegrity.economicValuesCalculated === false && preflightIntegrity.economicValuesInspected === false, "R18 preflight economic-read boundary is not intact.");
  requireValue(preflight.performanceExecutionCount === 0 && preflight.performanceLedgerPresent === false && preflight.selectionExecuted === false, "R18 preflight execution status is not design-only.");

  const dataPath = path.resolve(root, "..", "round-014-r13-execution-replay", ROUND_018_OBSERVATION_SOURCE);
  requireValue(statSync(dataPath).size === EXPECTED_R14_BYTES, "R14 observation source byte size mismatch.");
  const r14ObservationSha256 = await sha256File(dataPath);
  requireValue(r14ObservationSha256 === ROUND_018_OBSERVATION_SHA256, "R14 observation source SHA mismatch.");

  const provenance = verifyR18AcceptedProvenance(root, design as never);
  requireValue(provenance.acceptedSourceProvenanceValid, "R18 accepted source provenance is invalid.");
  return Object.freeze({ design, manifestSha256: EXPECTED_STRUCTURAL_MANIFEST_SHA256, preflightSha256: EXPECTED_PREFLIGHT_SHA256, compactSha256: EXPECTED_COMPACT_SHA256, r14ObservationSha256 });
}

function assertPreparationState(root: string): void {
  requireValue(git(root, ["branch", "--show-current"]) === "research/round-018-performance", "R18 performance branch is incorrect.");
  requireValue(existingR18OutputArtifacts(root).length === 0, "R18 performance output already exists before preparation.");
  requireValue(!existsSync(roundGlobalR18PerformanceLedgerPath(root)), "R18 performance ledger already exists before preparation.");
}

async function prepare(root: string): Promise<void> {
  assertPreparationState(root);
  await verifyStaticIdentities(root);
  console.log(JSON.stringify({ mode: "PREPARE", researchRoundId: ROUND_018_RESEARCH_ROUND_ID, performanceExecutionCount: 0, performanceLedgerPresent: false, economicFieldsRead: false, performanceExecuted: false, selectionExecuted: false }));
}

async function claim(root: string): Promise<void> {
  assertPreparationState(root);
  const staticIdentity = await verifyStaticIdentities(root);
  const implementationCommit = git(root, ["rev-parse", "HEAD"]);
  const executionId = newR18ExecutionId();
  const result = claimR18PerformanceExecution({
    root,
    executionId,
    performanceStageSourceCommit: R18_PERFORMANCE_STAGE_SOURCE,
    implementationCommit,
    acceptedDesignSourceCommit: R18_DESIGN_SOURCE,
    r14ObservationDataSha256: staticIdentity.r14ObservationSha256,
    compactStructuralSha256: staticIdentity.compactSha256,
    structuralManifestSha256: staticIdentity.manifestSha256,
    preflightReportSha256: staticIdentity.preflightSha256,
  });
  console.log(JSON.stringify({ mode: "CLAIM", executionId: result.executionLock.executionId, executionDirectory: result.executionDirectory, executionCount: deriveR18PerformanceExecutionCount(result.ledger), continuation: result.continuation }));
}

function inputHashes(record: Readonly<{ performanceStageSourceCommit: string; acceptedDesignSourceCommit: string; r14ObservationDataSha256: string; compactStructuralSha256: string; structuralManifestSha256: string; preflightReportSha256: string }>): Readonly<Record<string, string>> {
  return Object.freeze({ performanceStageSourceCommit: record.performanceStageSourceCommit, acceptedDesignSourceCommit: record.acceptedDesignSourceCommit, r14ObservationDataSha256: record.r14ObservationDataSha256, compactStructuralSha256: record.compactStructuralSha256, structuralManifestSha256: record.structuralManifestSha256, preflightReportSha256: record.preflightReportSha256 });
}

async function execute(root: string): Promise<void> {
  const ledgerPath = roundGlobalR18PerformanceLedgerPath(root);
  const ledger = readR18PerformanceLedger(ledgerPath);
  const record = ledger.executions[0]!;
  requireValue(git(root, ["rev-parse", "HEAD"]) === record.implementationCommit, "R18 execution must run from the claimed implementation commit.");
  requireValue(record.performanceStageSourceCommit === R18_PERFORMANCE_STAGE_SOURCE && record.acceptedDesignSourceCommit === R18_DESIGN_SOURCE, "R18 ledger source identity mismatch.");
  const staticIdentity = await verifyStaticIdentities(root);
  requireValue(record.r14ObservationDataSha256 === staticIdentity.r14ObservationSha256 && record.compactStructuralSha256 === staticIdentity.compactSha256 && record.structuralManifestSha256 === staticIdentity.manifestSha256 && record.preflightReportSha256 === staticIdentity.preflightSha256, "R18 ledger input identity does not match the accepted evidence.");
  const structuralIndex = await loadR18StructuralIndex(path.join(root, ROUND_018_STRUCTURAL_OBSERVATION_SOURCE));
  requireValue(structuralIndex.size === 5_834, "R18 structural index count mismatch.");
  const execution = await executeR18Performance({ root, executionDirectory: path.join(root, record.authoritativeExecutionDirectory), executionLock: record, executionLedger: ledger, continuation: record.status !== "CLAIMED" || record.completedFoldIds.length > 0, structuralIndex, observationFile: path.resolve(root, "..", "round-014-r13-execution-replay", ROUND_018_OBSERVATION_SOURCE), inputHashes: inputHashes(record) });
  const artifacts = buildR18ExecutionArtifacts(execution.report);
  if (record.status === "COMPLETE" || execution.ledger.executions[0]!.finalSummaryMarker === "COMPLETE") {
    requireValue(existingR18OutputArtifacts(root).length === Object.keys(R18_PERFORMANCE_OUTPUT_PATHS).length, "R18 completed ledger does not have all published outputs.");
    console.log(JSON.stringify({ mode: "EXECUTE_CONTINUATION", executionId: record.executionId, executionCount: deriveR18PerformanceExecutionCount(execution.ledger), reusedCompletedCheckpoints: execution.reusedCompletedCheckpoints, recomputedCompletedCheckpoints: execution.recomputedCompletedCheckpoints, finalDecision: execution.report.selection.finalDecision }));
    return;
  }
  publishR18ArtifactsAtomically({ root, artifacts });
  const outputLedger = updateR18PerformanceLedger({ root, expectedLedger: execution.ledger, completedFoldIds: ROUND_018_FOLDS, status: "COMPLETE", finalSummaryMarker: "COMPLETE", outputs: artifacts.hashes });
  console.log(JSON.stringify({ mode: "EXECUTE", executionId: record.executionId, executionCount: deriveR18PerformanceExecutionCount(outputLedger), reusedCompletedCheckpoints: execution.reusedCompletedCheckpoints, recomputedCompletedCheckpoints: execution.recomputedCompletedCheckpoints, finalDecision: execution.report.selection.finalDecision, controlValidationEconomicCount: execution.report.controlValidationEconomicCount, candidateValidationEconomicCount: execution.report.candidateValidationEconomicCount }));
}

async function main(): Promise<void> {
  const root = process.cwd();
  const args = process.argv.slice(2);
  if (args.includes(FORBIDDEN_EXECUTION_DIRECTORY_FLAG)) throw new Error("R18 authoritative execution does not accept --execution-directory; the ledger-bound directory is mandatory.");
  const mode = args[0] ?? "--prepare";
  if (mode === "--prepare") await prepare(root);
  else if (mode === "--claim") await claim(root);
  else if (mode === "--execute") await execute(root);
  else throw new Error(`Unknown R18 performance mode: ${mode}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
