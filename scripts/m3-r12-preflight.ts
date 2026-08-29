import { execFileSync } from "node:child_process";
import path from "node:path";

import { readR12SpecConformance } from "../src/lib/research/m3-r12-round-012-conformance.ts";
import { prepareR12Dataset } from "../src/lib/research/m3-r12-round-012-performance.ts";
import { validateR12Plan } from "../src/lib/research/m3-r12-round-012-plan.ts";
import { validateR12MachineRecord } from "../src/lib/research/selection-gates-round-012.ts";
import { M3_R12_BASE_SOURCE_SHA, M3_R12_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r12-round-012-protocol.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const sourceSha = argument("--source-sha") ?? git(["rev-parse", "HEAD"]);
const cacheDirectory = path.resolve(argument("--cache-directory") ?? path.join(process.cwd(), ".cache", "tradepulse", "round-006"));
const serverTimeValue = Number(argument("--study-server-time") ?? 1787801312279);
if (!/^[0-9a-f]{40}$/u.test(sourceSha) || sourceSha === M3_R12_BASE_SOURCE_SHA) throw new Error("R12 preflight requires a final execution source SHA distinct from the accepted R11 base.");
if (!Number.isSafeInteger(serverTimeValue) || serverTimeValue <= 0) throw new Error("R12 preflight requires a positive safe --study-server-time.");
if (git(["rev-parse", "HEAD"]) !== sourceSha) throw new Error(`R12 preflight source SHA mismatch: expected ${sourceSha}.`);
validateR12MachineRecord();
validateR12Plan();
const conformance = readR12SpecConformance();
const prepared = await prepareR12Dataset({ cacheDirectory, executionSourceSha: sourceSha, acceptedServerTime: serverTimeValue });
console.log(JSON.stringify({
  status: "PASS_PRE_PERFORMANCE",
  researchRoundId: M3_R12_RESEARCH_ROUND_ID,
  sourceSha,
  conformance: {
    resultAffectingDeviationCount: conformance.resultAffectingDeviationCount,
    thesisStateMachineVerified: conformance.thesisStateMachineVerified,
    noOutcomeLookahead: conformance.noOutcomeLookahead,
    candidateSettlementIdentityVerified: conformance.candidateSettlementIdentityVerified,
    productionSeenDataExcluded: conformance.productionSeenDataExcluded,
  },
  datasetFreeze: prepared.datasetFreeze,
  postLockFetch: false,
  performanceLockTriggered: false,
  performance: false,
  cacheDirectory,
}, null, 2));
