import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildR13ExecutionArtifacts, buildR13ObservationUniverseWithDiagnostics, existingR13OutputArtifacts, evaluateR13Discovery, publishR13ArtifactsAtomically, r13ArtifactSizes } from "../src/lib/research/m3-r13-round-013-performance.ts";
import { readR13SpecConformance } from "../src/lib/research/m3-r13-round-013-conformance.ts";
import { validateR13Plan } from "../src/lib/research/m3-r13-round-013-plan.ts";
import { M3_R13_ACCEPTED_R11_SOURCE_SHA, M3_R13_PERFORMANCE_LOCK, M3_R13_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import { prepareR13Dataset, R13_DEFAULT_CACHE_DIRECTORY } from "../src/lib/research/m3-r13-round-013-data.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

function argument(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function git(args: readonly string[]): string { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function requireCondition(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

requireCondition(process.argv.includes("--confirm-authoritative-performance"), "R13 performance requires --confirm-authoritative-performance.");
const sourceSha = argument("--source-sha");
requireCondition(Boolean(sourceSha) && /^[0-9a-f]{40}$/u.test(sourceSha!), "R13 performance requires a 40-character --source-sha.");
requireCondition(git(["rev-parse", "HEAD"]) === sourceSha, "R13 performance source SHA does not match HEAD.");
requireCondition(git(["status", "--porcelain"]) === "", "R13 performance requires a clean worktree.");
requireCondition(sourceSha !== M3_R13_ACCEPTED_R11_SOURCE_SHA, "R13 performance source must be a frozen execution commit after the accepted R11 source.");
requireCondition(existingR13OutputArtifacts().length === 0, "R13 output artifacts already exist; performance cannot rerun.");
validateR13Plan();
const conformance = readR13SpecConformance();
requireCondition(conformance.resultAffectingDeviationCount === 0 && conformance.postLockMarketFetchPossible === false, "R13 spec conformance did not pass.");

const cacheDirectory = path.resolve(argument("--cache-directory") ?? R13_DEFAULT_CACHE_DIRECTORY);
const freezePath = path.join(process.cwd(), "docs", "research", "round-013-dataset-freeze.json");
requireCondition(existsSync(freezePath), "R13 performance requires the committed dataset freeze.");
const committedFreeze = JSON.parse(readFileSync(freezePath, "utf8")) as Readonly<Record<string, unknown>>;
const prepared = await prepareR13Dataset({ cacheDirectory, fetchMissingOneMinute: false });
requireCondition(stableStringify(prepared.datasetFreeze) === stableStringify(committedFreeze), "R13 performance dataset freeze does not match the committed freeze.");
const lockPath = path.join(cacheDirectory, "r13-performance-lock.json");
requireCondition(!existsSync(lockPath), "R13 performance lock already exists; rerun is forbidden.");
mkdirSync(cacheDirectory, { recursive: true });
writeFileSync(lockPath, stableStringify({ lock: M3_R13_PERFORMANCE_LOCK, researchRoundId: M3_R13_RESEARCH_ROUND_ID, executionSourceSha: sourceSha, datasetIdentitySha256: prepared.datasetFreeze.datasetIdentitySha256 }), "utf8");

const universe = buildR13ObservationUniverseWithDiagnostics({ data: prepared.coarseData, oneMinute: prepared.oneMinuteIndexed });
const report = evaluateR13Discovery(universe.observations, committedFreeze, sourceSha!, conformance, universe);
const artifacts = buildR13ExecutionArtifacts(report);
publishR13ArtifactsAtomically({ artifacts });
console.log(JSON.stringify({ status: "PASS", head: git(["rev-parse", "HEAD"]), researchRoundId: report.researchRoundId, performanceExecutionCount: report.performanceExecutionCount, performanceLockTriggered: report.performanceLockTriggered, evidenceStatus: "COMPLETE", integrityErrors: [], finalDecision: report.selection.finalDecision, selectedDiscoveryHorizon: report.selection.selectedDiscoveryHorizon, outputSizes: r13ArtifactSizes(), datasetFreeze: prepared.datasetFreeze }, null, 2));
