import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import {
  discoverIntrabarSettlementRequirements,
} from "../backtest/runner.ts";
import type {
  BacktestData,
  IntrabarSettlementRequirement,
} from "../backtest/types.ts";
import type {
  BinanceHistoricalDataLoader,
} from "../historical-data/binance/loader.ts";
import type {
  HistoricalIntrabarSettlementWindow,
  HistoricalManifest,
} from "../historical-data/types.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import {
  M3_R6_ROUND_006_CANDIDATE_IDS,
  M3_R6_RESEARCH_ROUND_ID,
  type R6CandidateId,
} from "./m3-r6-round-006-protocol.ts";
import { M3_R6_ROUND_006_PLAN_SHA256 } from "./m3-r6-round-006-plan.ts";
import { M3_R6_ROUND_006_CONTROL_ID } from "./selection-gates-round-006.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const M3_R6_ROUND_006_INTRABAR_PLAN_VERSION =
  "m3-r6-round-006-intrabar-plan-001" as const;
export const M3_R6_ROUND_006_INTRABAR_DATASET_SCHEMA =
  "m3-r6-round-006-dataset-freeze-001" as const;
export const M3_R6_ROUND_006_INTRABAR_PLAN_FILENAME =
  "round-006-intrabar-plan.json" as const;
export const M3_R6_ROUND_006_INTRABAR_SETTLEMENT_POLICY = "bt-policy-003" as const;
export const M3_R6_ROUND_006_INTRABAR_PARENT_TIMEFRAME = "1h" as const;

export const M3_R6_ROUND_006_INTRABAR_CONSUMERS = Object.freeze([
  M3_R6_ROUND_006_CONTROL_ID,
  ...M3_R6_ROUND_006_CANDIDATE_IDS,
]) as readonly [typeof M3_R6_ROUND_006_CONTROL_ID, ...R6CandidateId[]];

export type Round006IntrabarDeclaration = Readonly<{
  schemaVersion: typeof M3_R6_ROUND_006_INTRABAR_PLAN_VERSION;
  identity: string;
  symbol: ResearchSymbol;
  parentTimeframe: typeof M3_R6_ROUND_006_INTRABAR_PARENT_TIMEFRAME;
  parentCandleOpenTime: number;
  parentCandleCloseTime: number;
  windowStartTime: number;
  windowEndTime: number;
  settlementPolicy: typeof M3_R6_ROUND_006_INTRABAR_SETTLEMENT_POLICY;
  datasetSchema: typeof M3_R6_ROUND_006_INTRABAR_DATASET_SCHEMA;
  settlementOnly: boolean;
}>;

export type Round006IntrabarDependencyPlan = Readonly<{
  planVersion: typeof M3_R6_ROUND_006_INTRABAR_PLAN_VERSION;
  researchRoundId: typeof M3_R6_RESEARCH_ROUND_ID;
  sourceSha: string;
  backtestPolicyVersion: typeof M3_R6_ROUND_006_INTRABAR_SETTLEMENT_POLICY;
  candidatePlanSha256: typeof M3_R6_ROUND_006_PLAN_SHA256;
  candidateDependencyRule: "ALL_FROZEN_CONSUMERS_SHARE_CONTROL_UNION";
  consumers: readonly string[];
  coarseDatasetIdentitySha256: string;
  rawDependencyCount: number;
  uniqueDeclaredWindowCount: number;
  duplicateDependencyCount: number;
  declarations: readonly Round006IntrabarDeclaration[];
  /** Internal typed projection used to call the frozen historical loader. */
  requirements: readonly IntrabarSettlementRequirement[];
  consumerDependencyUnion: readonly Readonly<{
    consumerId: string;
    declarationHash: string;
  }>[];
  declarationHash: string;
}>;

export type Round006IntrabarPlanCoverage = Readonly<{
  declaredWindowCount: number;
  presentWindowCount: number;
  missingDeclaredIdentities: readonly string[];
  undeclaredWindowIdentities: readonly string[];
  duplicateWindowIdentities: readonly string[];
}>;

export class Round006IntrabarPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Round006IntrabarPlanError";
  }
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function declarationIdentity(value: Readonly<{
  symbol: ResearchSymbol;
  parentCandleOpenTime: number;
  parentCandleCloseTime: number;
  windowStartTime: number;
  windowEndTime: number;
  settlementOnly: boolean;
}>): string {
  return [
    M3_R6_ROUND_006_INTRABAR_DATASET_SCHEMA,
    M3_R6_ROUND_006_INTRABAR_SETTLEMENT_POLICY,
    M3_R6_ROUND_006_INTRABAR_PARENT_TIMEFRAME,
    value.symbol,
    value.parentCandleOpenTime,
    value.parentCandleCloseTime,
    value.windowStartTime,
    value.windowEndTime,
    value.settlementOnly,
  ].join("|");
}

export function round006IntrabarDeclarationIdentity(
  declaration: Pick<Round006IntrabarDeclaration, "symbol" | "parentCandleOpenTime" | "parentCandleCloseTime" | "windowStartTime" | "windowEndTime" | "settlementOnly">,
): string {
  return declarationIdentity(declaration);
}

function requirementIdentity(requirement: IntrabarSettlementRequirement): string {
  return declarationIdentity({
    symbol: requirement.symbol,
    parentCandleOpenTime: requirement.exitCandleOpenTime,
    parentCandleCloseTime: requirement.exitCandleCloseTime,
    windowStartTime: requirement.exitCandleOpenTime,
    windowEndTime: requirement.exitCandleCloseTime,
    settlementOnly: requirement.settlementOnly,
  });
}

function declarationFromRequirement(
  requirement: IntrabarSettlementRequirement,
): Round006IntrabarDeclaration {
  const expectedClose = requirement.exitCandleOpenTime + INTERVAL_MS["1h"] - 1;
  if (
    !Number.isSafeInteger(requirement.exitCandleOpenTime)
    || !Number.isSafeInteger(requirement.exitCandleCloseTime)
    || requirement.exitCandleOpenTime < 0
    || requirement.exitCandleCloseTime !== expectedClose
  ) {
    throw new Round006IntrabarPlanError(
      `Invalid Round-006 intrabar dependency boundary for ${requirement.symbol} at ${requirement.exitCandleOpenTime}.`,
    );
  }
  const identity = requirementIdentity(requirement);
  return Object.freeze({
    schemaVersion: M3_R6_ROUND_006_INTRABAR_PLAN_VERSION,
    identity,
    symbol: requirement.symbol,
    parentTimeframe: M3_R6_ROUND_006_INTRABAR_PARENT_TIMEFRAME,
    parentCandleOpenTime: requirement.exitCandleOpenTime,
    parentCandleCloseTime: requirement.exitCandleCloseTime,
    windowStartTime: requirement.exitCandleOpenTime,
    windowEndTime: requirement.exitCandleCloseTime,
    settlementPolicy: M3_R6_ROUND_006_INTRABAR_SETTLEMENT_POLICY,
    datasetSchema: M3_R6_ROUND_006_INTRABAR_DATASET_SCHEMA,
    settlementOnly: requirement.settlementOnly,
  });
}

function declarationToRequirement(
  declaration: Round006IntrabarDeclaration,
): IntrabarSettlementRequirement {
  return Object.freeze({
    symbol: declaration.symbol,
    exitCandleOpenTime: declaration.parentCandleOpenTime,
    exitCandleCloseTime: declaration.parentCandleCloseTime,
    settlementOnly: declaration.settlementOnly,
  });
}

function canonicalCoarseManifestIdentities(
  manifests: readonly HistoricalManifest[] | undefined,
): readonly Readonly<Record<string, unknown>>[] {
  return Object.freeze((manifests ?? [])
    .filter((manifest) => manifest.kind !== "intrabar-settlement")
    .map((manifest) => {
      const identity = { ...manifest } as Record<string, unknown>;
      delete identity.retrievedAt;
      return identity;
    })
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))));
}

function symbolSort(left: ResearchSymbol, right: ResearchSymbol): number {
  return left.localeCompare(right);
}

function canonicalRequirements(
  rawRequirements: readonly IntrabarSettlementRequirement[],
): Readonly<{
  requirements: readonly IntrabarSettlementRequirement[];
  declarations: readonly Round006IntrabarDeclaration[];
  duplicateDependencyCount: number;
}> {
  const byParentIdentity = new Map<string, Round006IntrabarDeclaration>();
  for (const requirement of rawRequirements) {
    const declaration = declarationFromRequirement(requirement);
    const parentKey = `${declaration.symbol}|${declaration.parentCandleOpenTime}`;
    const existing = byParentIdentity.get(parentKey);
    if (existing && existing.identity !== declaration.identity) {
      throw new Round006IntrabarPlanError(
        `Conflicting Round-006 intrabar declaration for ${parentKey}.`,
      );
    }
    byParentIdentity.set(parentKey, declaration);
  }
  const declarations = [...byParentIdentity.values()].sort(
    (left, right) => symbolSort(left.symbol, right.symbol)
      || left.windowStartTime - right.windowStartTime
      || left.windowEndTime - right.windowEndTime
      || left.identity.localeCompare(right.identity),
  );
  const requirements = declarations.map(declarationToRequirement);
  return Object.freeze({
    requirements: Object.freeze(requirements),
    declarations: Object.freeze(declarations),
    duplicateDependencyCount: rawRequirements.length - declarations.length,
  });
}

export function buildRound006IntrabarDependencyPlan(input: Readonly<{
  data: BacktestData;
  sourceSha: string;
  rawRequirements: readonly IntrabarSettlementRequirement[];
}>): Round006IntrabarDependencyPlan {
  const canonical = canonicalRequirements(input.rawRequirements);
  const coarseDatasetIdentitySha256 = sha256({
    schemaVersion: M3_R6_ROUND_006_INTRABAR_DATASET_SCHEMA,
    researchRoundId: M3_R6_RESEARCH_ROUND_ID,
    manifests: canonicalCoarseManifestIdentities(input.data.manifests),
  });
  const declarationIdentities = canonical.declarations.map((declaration) => declaration.identity);
  const declarationHash = sha256({
    planVersion: M3_R6_ROUND_006_INTRABAR_PLAN_VERSION,
    researchRoundId: M3_R6_RESEARCH_ROUND_ID,
    sourceSha: input.sourceSha,
    backtestPolicyVersion: M3_R6_ROUND_006_INTRABAR_SETTLEMENT_POLICY,
    candidatePlanSha256: M3_R6_ROUND_006_PLAN_SHA256,
    candidateDependencyRule: "ALL_FROZEN_CONSUMERS_SHARE_CONTROL_UNION",
    consumers: M3_R6_ROUND_006_INTRABAR_CONSUMERS,
    coarseDatasetIdentitySha256,
    declarations: declarationIdentities,
  });
  return deepFreeze({
    planVersion: M3_R6_ROUND_006_INTRABAR_PLAN_VERSION,
    researchRoundId: M3_R6_RESEARCH_ROUND_ID,
    sourceSha: input.sourceSha,
    backtestPolicyVersion: M3_R6_ROUND_006_INTRABAR_SETTLEMENT_POLICY,
    candidatePlanSha256: M3_R6_ROUND_006_PLAN_SHA256,
    candidateDependencyRule: "ALL_FROZEN_CONSUMERS_SHARE_CONTROL_UNION",
    consumers: M3_R6_ROUND_006_INTRABAR_CONSUMERS,
    coarseDatasetIdentitySha256,
    rawDependencyCount: input.rawRequirements.length,
    uniqueDeclaredWindowCount: canonical.declarations.length,
    duplicateDependencyCount: canonical.duplicateDependencyCount,
    declarations: canonical.declarations,
    requirements: canonical.requirements,
    consumerDependencyUnion: Object.freeze(M3_R6_ROUND_006_INTRABAR_CONSUMERS.map((consumerId) => ({
      consumerId,
      declarationHash,
    }))),
    declarationHash,
  });
}

/**
 * Phase C: discover the complete CONTROL dependency stream before any 1m
 * payload is requested. Every frozen Round-006 candidate is a filter/rank of
 * that already-settled stream, so its settlement dependency union is exactly
 * the CONTROL union and is recorded explicitly in the plan.
 */
export function planRound006IntrabarDependencies(input: Readonly<{
  data: BacktestData;
  sourceSha: string;
}>): Round006IntrabarDependencyPlan {
  const rawRequirements = [
    ...discoverIntrabarSettlementRequirements({ period: "DEV", data: input.data }),
    ...discoverIntrabarSettlementRequirements({ period: "OOS", data: input.data }),
  ];
  return buildRound006IntrabarDependencyPlan({
    data: input.data,
    sourceSha: input.sourceSha,
    rawRequirements,
  });
}

export function round006IntrabarPlanPath(cacheDirectory: string): string {
  return path.join(path.resolve(cacheDirectory), M3_R6_ROUND_006_INTRABAR_PLAN_FILENAME);
}

/**
 * Writes the declaration before acquisition. Staging is deliberately under
 * the cache directory so the declaration and any page cache share a
 * destination filesystem; no os.tmpdir() path is consulted.
 */
export function persistRound006IntrabarDependencyPlan(
  plan: Round006IntrabarDependencyPlan,
  cacheDirectory: string,
): string {
  const directory = path.resolve(cacheDirectory);
  mkdirSync(directory, { recursive: true });
  const target = round006IntrabarPlanPath(directory);
  if (existsSync(target)) {
    let existing: unknown;
    try {
      existing = JSON.parse(readFileSync(target, "utf8"));
    } catch {
      throw new Round006IntrabarPlanError("Existing Round-006 intrabar plan is not valid UTF-8 JSON.");
    }
    if (stableStringify(existing) !== stableStringify(plan)) {
      throw new Round006IntrabarPlanError("Existing Round-006 intrabar plan identity does not match the new declaration.");
    }
    return target;
  }

  const stagingDirectory = mkdtempSync(path.join(directory, ".m3-r6-intrabar-plan-"));
  const staged = path.join(stagingDirectory, M3_R6_ROUND_006_INTRABAR_PLAN_FILENAME);
  try {
    writeFileSync(staged, stableStringify(plan), "utf8");
    renameSync(staged, target);
    return target;
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true });
  }
}

export function assertRound006IntrabarRequirementsDeclared(
  requirements: readonly IntrabarSettlementRequirement[],
  plan: Round006IntrabarDependencyPlan,
): void {
  const declared = new Set(plan.declarations.map((declaration) => declaration.identity));
  const requested = requirements.map(requirementIdentity);
  if (requested.length !== declared.size) {
    throw new Round006IntrabarPlanError(
      `Round-006 intrabar acquisition must request exactly ${declared.size} declared windows; received ${requested.length}.`,
    );
  }
  for (const identity of requested) {
    if (!declared.has(identity)) {
      throw new Round006IntrabarPlanError(`UNDECLARED_INTRABAR_WINDOW:${identity}`);
    }
  }
}

/**
 * Restricts the performance acquisition path to the frozen declaration set.
 * The wrapped loader cannot be called with an undeclared or partial set.
 */
export function createRound006DeclaredIntrabarLoader(
  loader: Pick<BinanceHistoricalDataLoader, "loadIntrabarSettlementWindows">,
  plan: Round006IntrabarDependencyPlan,
): Pick<BinanceHistoricalDataLoader, "loadIntrabarSettlementWindows"> {
  return Object.freeze({
    loadIntrabarSettlementWindows: async (
      requirements: readonly IntrabarSettlementRequirement[],
      serverTime: number,
    ): Promise<readonly HistoricalIntrabarSettlementWindow[]> => {
      assertRound006IntrabarRequirementsDeclared(requirements, plan);
      return loader.loadIntrabarSettlementWindows(plan.requirements, serverTime);
    },
  });
}

function windowIdentity(window: HistoricalIntrabarSettlementWindow): string {
  return declarationIdentity({
    symbol: window.symbol,
    parentCandleOpenTime: window.exitCandleOpenTime,
    parentCandleCloseTime: window.exitCandleOpenTime + INTERVAL_MS["1h"] - 1,
    windowStartTime: window.exitCandleOpenTime,
    windowEndTime: window.exitCandleOpenTime + INTERVAL_MS["1h"] - 1,
    settlementOnly: window.settlementOnly,
  });
}

export function validateRound006IntrabarPlanCoverage(
  plan: Round006IntrabarDependencyPlan,
  windows: readonly HistoricalIntrabarSettlementWindow[],
): Round006IntrabarPlanCoverage {
  const declared = new Set(plan.declarations.map((declaration) => declaration.identity));
  const present = new Set<string>();
  const duplicateWindowIdentities = new Set<string>();
  const undeclaredWindowIdentities = new Set<string>();
  for (const window of windows) {
    const identity = windowIdentity(window);
    if (present.has(identity)) duplicateWindowIdentities.add(identity);
    present.add(identity);
    if (!declared.has(identity)) undeclaredWindowIdentities.add(identity);
  }
  const missingDeclaredIdentities = [...declared].filter((identity) => !present.has(identity));
  return Object.freeze({
    declaredWindowCount: declared.size,
    presentWindowCount: present.size,
    missingDeclaredIdentities: Object.freeze(missingDeclaredIdentities.sort()),
    undeclaredWindowIdentities: Object.freeze([...undeclaredWindowIdentities].sort()),
    duplicateWindowIdentities: Object.freeze([...duplicateWindowIdentities].sort()),
  });
}
