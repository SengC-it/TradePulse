import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BacktestData, IntrabarSettlementRequirement } from "../backtest/types.ts";
import { determineFrozenBacktestExit, snapshotFromCandidate } from "../backtest/settlement.ts";
import { BACKTEST_PERIOD_RANGES } from "../backtest/constants.ts";
import { getHeldCandlesFromIndex, buildHistoricalIndexes } from "../backtest/windows.ts";
import { requiresIntrabarFundingResolution } from "../backtest/funding.ts";
import { isIntrabarSettlementOnly } from "../backtest/ranges.ts";
import type { HistoricalManifest } from "../historical-data/types.ts";
import type { ResearchSymbol } from "../config/constants.ts";
import { M3_R10_CANDIDATE_IDS, M3_R10_CONTROL_ID, M3_R10_PERFORMANCE_LOCK, M3_R10_RESEARCH_ROUND_ID } from "./m3-r10-round-010-protocol.ts";
import { R10_PLAN_SHA256 } from "./m3-r10-round-010-plan.ts";
import { stableStringify } from "./utils.ts";
import type { R10OpportunityIntent } from "./m3-r10-round-010-candidates.ts";

export const M3_R10_INTRABAR_PLAN_VERSION = "m3-r10-round-010-intrabar-plan-001" as const;

export type R10IntrabarPlan = Readonly<{
  planVersion: typeof M3_R10_INTRABAR_PLAN_VERSION;
  researchRoundId: typeof M3_R10_RESEARCH_ROUND_ID;
  sourceSha: string;
  candidatePlanSha256: typeof R10_PLAN_SHA256;
  consumers: readonly string[];
  requirements: readonly IntrabarSettlementRequirement[];
  declarations: readonly Readonly<{
    symbol: ResearchSymbol;
    exitCandleOpenTime: number;
    exitCandleCloseTime: number;
    settlementOnly: boolean;
    identity: string;
  }>[];
  declarationHash: string;
  rawDependencyCount: number;
  uniqueDeclaredWindowCount: number;
  duplicateDependencyCount: number;
  preLockOnly: true;
  postLockFetch: false;
  performanceLock: typeof M3_R10_PERFORMANCE_LOCK;
}>;

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

export function intrabarIdentity(requirement: Pick<IntrabarSettlementRequirement, "symbol" | "exitCandleOpenTime" | "exitCandleCloseTime" | "settlementOnly">): string {
  return `${requirement.symbol}|${requirement.exitCandleOpenTime}|${requirement.exitCandleCloseTime}|${requirement.settlementOnly}`;
}

function periodFor(time: number): "DEV" | "OOS" {
  return time <= BACKTEST_PERIOD_RANGES.DEV.endTime ? "DEV" : "OOS";
}

/** Discovers the union of all frozen consumers without reading any 1m data. */
export function discoverR10IntrabarRequirements(input: Readonly<{ data: BacktestData; intents: readonly R10OpportunityIntent[] }>): readonly IntrabarSettlementRequirement[] {
  const indexes = buildHistoricalIndexes(input.data.datasets);
  const values: IntrabarSettlementRequirement[] = [];
  for (const intent of input.intents) {
    const period = periodFor(intent.decisionTime);
    const dataset = indexes.bySymbol[intent.symbol];
    if (!dataset) continue;
    const expectedHeld24Close = intent.signalCandle.openTime + 25 * 60 * 60 * 1000 - 1;
    if (period === "DEV" && expectedHeld24Close > BACKTEST_PERIOD_RANGES.DEV.endTime) continue;
    let held;
    try {
      held = getHeldCandlesFromIndex(dataset.candles1h, intent.decisionTime);
    } catch {
      continue;
    }
    const snapshot = snapshotFromCandidate(intent.candidate, intent.decisionTime, "bt-policy-003");
    const frozenExit = determineFrozenBacktestExit(snapshot, held);
    if (!requiresIntrabarFundingResolution({
      funding: input.data.funding[intent.symbol] ?? [],
      entryTime: held[0]!.openTime,
      exitReason: frozenExit.exitReason,
      exitCandle: frozenExit.exitCandle,
    })) continue;
    values.push(Object.freeze({
      symbol: intent.symbol,
      exitCandleOpenTime: frozenExit.exitCandle.openTime,
      exitCandleCloseTime: frozenExit.exitCandle.closeTime,
      settlementOnly: isIntrabarSettlementOnly(period, frozenExit.exitCandle),
    }));
  }
  const deduped = new Map<string, IntrabarSettlementRequirement>();
  for (const value of values) {
    const identity = intrabarIdentity(value);
    const prior = deduped.get(identity);
    if (prior && stableStringify(prior) !== stableStringify(value)) throw new Error(`Conflicting R10 intrabar requirement: ${identity}`);
    deduped.set(identity, value);
  }
  return Object.freeze([...deduped.values()].sort((left, right) => intrabarIdentity(left).localeCompare(intrabarIdentity(right))));
}

export function buildR10IntrabarPlan(input: Readonly<{ data: BacktestData; intents: readonly R10OpportunityIntent[]; sourceSha: string }>): R10IntrabarPlan {
  const raw = discoverR10IntrabarRequirements({ data: input.data, intents: input.intents });
  const unique = new Map<string, IntrabarSettlementRequirement>();
  for (const requirement of raw) {
    const identity = intrabarIdentity(requirement);
    const existing = unique.get(identity);
    if (existing && stableStringify(existing) !== stableStringify(requirement)) throw new Error(`Conflicting R10 intrabar requirement: ${identity}`);
    unique.set(identity, requirement);
  }
  const requirements = [...unique.values()].sort((left, right) => intrabarIdentity(left).localeCompare(intrabarIdentity(right)));
  const declarations = requirements.map((requirement) => Object.freeze({ ...requirement, identity: intrabarIdentity(requirement) }));
  const declarationHash = sha256({ planVersion: M3_R10_INTRABAR_PLAN_VERSION, researchRoundId: M3_R10_RESEARCH_ROUND_ID, sourceSha: input.sourceSha, candidatePlanSha256: R10_PLAN_SHA256, declarations: declarations.map((declaration) => declaration.identity) });
  return Object.freeze({
    planVersion: M3_R10_INTRABAR_PLAN_VERSION,
    researchRoundId: M3_R10_RESEARCH_ROUND_ID,
    sourceSha: input.sourceSha,
    candidatePlanSha256: R10_PLAN_SHA256,
    consumers: Object.freeze([M3_R10_CONTROL_ID, ...M3_R10_CANDIDATE_IDS]),
    requirements: Object.freeze(requirements),
    declarations: Object.freeze(declarations),
    declarationHash,
    rawDependencyCount: raw.length,
    uniqueDeclaredWindowCount: requirements.length,
    duplicateDependencyCount: raw.length - requirements.length,
    preLockOnly: true,
    postLockFetch: false,
    performanceLock: M3_R10_PERFORMANCE_LOCK,
  });
}

export function persistR10IntrabarPlan(plan: R10IntrabarPlan, filePath: string): void {
  const target = path.resolve(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, stableStringify(plan), "utf8");
}

function manifestIdentity(manifest: HistoricalManifest): Readonly<Record<string, unknown>> {
  const copy = { ...manifest } as Record<string, unknown>;
  delete copy.retrievedAt;
  return copy;
}

export function r10DatasetIdentity(input: Readonly<{ data: BacktestData; plan: R10IntrabarPlan; studyServerTime: number }>): string {
  return sha256({
    schemaVersion: "m3-r10-round-010-dataset-freeze-001",
    researchRoundId: M3_R10_RESEARCH_ROUND_ID,
    studyServerTime: input.studyServerTime,
    manifests: input.data.manifests.map(manifestIdentity).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))),
    intrabarDeclarationHash: input.plan.declarationHash,
    requirements: input.plan.requirements.map(intrabarIdentity),
    cacheProvenance: "ROUND_006_CACHE_IDENTITY_VALIDATED",
  });
}

export function readR10IntrabarPlan(filePath: string): R10IntrabarPlan {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as R10IntrabarPlan;
}
