import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BacktestData, IntrabarSettlementRequirement } from "../backtest/types.ts";
import type { HistoricalManifest } from "../historical-data/types.ts";
import type { ResearchSymbol } from "../config/constants.ts";
import { M3_R7_CANDIDATE_IDS, M3_R7_CONTROL_ID, M3_R7_PERFORMANCE_LOCK, M3_R7_RESEARCH_ROUND_ID } from "./m3-r7-round-007-protocol.ts";
import { R7_PLAN_SHA256 } from "./m3-r7-round-007-plan.ts";
import { stableStringify } from "./utils.ts";

export const M3_R7_INTRABAR_PLAN_VERSION = "m3-r7-round-007-intrabar-plan-001" as const;
export type R7IntrabarPlan = Readonly<{
  planVersion: typeof M3_R7_INTRABAR_PLAN_VERSION;
  researchRoundId: typeof M3_R7_RESEARCH_ROUND_ID;
  sourceSha: string;
  candidatePlanSha256: typeof R7_PLAN_SHA256;
  consumers: readonly string[];
  requirements: readonly IntrabarSettlementRequirement[];
  declarations: readonly Readonly<{ symbol: ResearchSymbol; exitCandleOpenTime: number; exitCandleCloseTime: number; settlementOnly: boolean; identity: string }>[];
  declarationHash: string;
  existingR6PlanSha256: string;
  preLockOnly: true;
  postLockFetch: false;
  performanceLock: typeof M3_R7_PERFORMANCE_LOCK;
}>;

function sha256(value: unknown): string { return createHash("sha256").update(stableStringify(value), "utf8").digest("hex"); }
function declarationIdentity(requirement: IntrabarSettlementRequirement): string { return `${requirement.symbol}|${requirement.exitCandleOpenTime}|${requirement.exitCandleCloseTime}|${requirement.settlementOnly}`; }

export function buildR7IntrabarPlan(input: Readonly<{ data: BacktestData; sourceSha: string; requirements: readonly IntrabarSettlementRequirement[]; existingR6PlanSha256: string }>): R7IntrabarPlan {
  const byIdentity = new Map<string, IntrabarSettlementRequirement>();
  for (const requirement of input.requirements) {
    const identity = declarationIdentity(requirement);
    const prior = byIdentity.get(identity);
    if (prior && stableStringify(prior) !== stableStringify(requirement)) throw new Error(`Conflicting R7 intrabar requirement: ${identity}`);
    byIdentity.set(identity, requirement);
  }
  const requirements = [...byIdentity.values()].sort((left, right) => left.symbol.localeCompare(right.symbol) || left.exitCandleOpenTime - right.exitCandleOpenTime);
  const declarations = requirements.map((requirement) => ({ ...requirement, identity: declarationIdentity(requirement) }));
  const declarationHash = sha256({ planVersion: M3_R7_INTRABAR_PLAN_VERSION, researchRoundId: M3_R7_RESEARCH_ROUND_ID, sourceSha: input.sourceSha, candidatePlanSha256: R7_PLAN_SHA256, declarations: declarations.map((declaration) => declaration.identity) });
  return Object.freeze({ planVersion: M3_R7_INTRABAR_PLAN_VERSION, researchRoundId: M3_R7_RESEARCH_ROUND_ID, sourceSha: input.sourceSha, candidatePlanSha256: R7_PLAN_SHA256, consumers: Object.freeze([M3_R7_CONTROL_ID, ...M3_R7_CANDIDATE_IDS]), requirements: Object.freeze(requirements), declarations: Object.freeze(declarations), declarationHash, existingR6PlanSha256: input.existingR6PlanSha256, preLockOnly: true, postLockFetch: false, performanceLock: M3_R7_PERFORMANCE_LOCK });
}

export function persistR7IntrabarPlan(plan: R7IntrabarPlan, filePath: string): void {
  const target = path.resolve(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, stableStringify(plan), "utf8");
}

export function readR6IntrabarRequirements(cacheDirectory: string): Readonly<{ requirements: readonly IntrabarSettlementRequirement[]; planSha256: string }> {
  const filePath = path.join(path.resolve(cacheDirectory), "round-006-intrabar-plan.json");
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { requirements?: readonly IntrabarSettlementRequirement[] };
  if (!Array.isArray(parsed.requirements) || parsed.requirements.length === 0) throw new Error("R7 requires the accepted R6 intrabar declaration to be present in the cache.");
  return Object.freeze({ requirements: Object.freeze([...parsed.requirements]), planSha256: sha256(parsed) });
}

function manifestIdentity(manifest: HistoricalManifest): Readonly<Record<string, unknown>> {
  const copy = { ...manifest } as Record<string, unknown>;
  delete copy.retrievedAt;
  return copy;
}

export function r7DatasetIdentity(input: Readonly<{ data: BacktestData; plan: R7IntrabarPlan; studyServerTime: number }>): string {
  return sha256({ schemaVersion: "m3-r7-round-007-dataset-freeze-001", researchRoundId: M3_R7_RESEARCH_ROUND_ID, studyServerTime: input.studyServerTime, manifests: input.data.manifests.map(manifestIdentity).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))), intrabarDeclarationHash: input.plan.declarationHash, requirements: input.plan.requirements.map((requirement) => declarationIdentity(requirement)), cacheProvenance: input.plan.existingR6PlanSha256 });
}
