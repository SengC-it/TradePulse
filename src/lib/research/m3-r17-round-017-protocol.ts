import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { stableStringify } from "./utils.ts";

export const M3_R17_RESEARCH_ROUND_ID = "baseline-002-research-round-017" as const;
export const M3_R17_IMPLEMENTATION_SOURCE_SHA = "6a2283a8d9b016087cbadd08b9e0324c674b5f33" as const;
export const M3_R17_ACCEPTED_DESIGN_SOURCE_SHA = "0f5e24009f3301b8f2fb64d7e01161402a94f0b7" as const;
export const M3_R17_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R17_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const M3_R17_RESEARCH_START = Date.parse(M3_R17_RESEARCH_START_ISO);
export const M3_R17_RESEARCH_END = Date.parse(M3_R17_RESEARCH_END_ISO);
export const M3_R17_ACTIVE_LIFETIME_HOURS = 4 as const;
export const M3_R17_ACTIVE_LIFETIME_MS = M3_R17_ACTIVE_LIFETIME_HOURS * 60 * 60 * 1_000;
export const M3_R17_DESIGN_PATH = "docs/research/round-017-design.json" as const;
export const M3_R17_OBSERVATION_DATA_PATH = ".cache/tradepulse/round-017/observations.ndjson" as const;
export const M3_R17_OBSERVATION_FREEZE_PATH = "docs/research/round-017-observation-freeze.json" as const;
export const M3_R17_SETTLEMENT_AVAILABILITY_PATH = "docs/research/round-017-settlement-availability.json" as const;
export const M3_R17_PREFLIGHT_REPORT_PATH = "docs/research/round-017-preflight.json" as const;
export const M3_R17_PERFORMANCE_LEDGER_PATH = "docs/research/round-017-performance-ledger.json" as const;
export const M3_R17_PERFORMANCE_LOCK = "FIRST_M3_R17_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT = 7_500 as const;

export const R17_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const);
export type R17Symbol = (typeof R17_SYMBOLS)[number];
export const R17_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export type R17Direction = (typeof R17_DIRECTIONS)[number];
export const R17_FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);
export type R17FoldId = (typeof R17_FOLD_IDS)[number];
export const R17_REGIMES = Object.freeze(["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"] as const);
export type R17Regime = (typeof R17_REGIMES)[number];
export type R17Classification = "FIRST" | "FOLLOW_UP";

export type R17Range = Readonly<{ start: string; end: string }>;
export type R17FoldBoundary = Readonly<{ research: R17Range; validation: R17Range }>;

export const R17_FROZEN_FOLD_BOUNDARIES: Readonly<Record<R17FoldId, R17FoldBoundary>> = Object.freeze({
  F1: { research: { start: "2023-01-01T00:00:00.000Z", end: "2023-12-31T23:59:59.999Z" }, validation: { start: "2024-01-01T00:00:00.000Z", end: "2024-06-30T23:59:59.999Z" } },
  F2: { research: { start: "2023-01-01T00:00:00.000Z", end: "2024-06-30T23:59:59.999Z" }, validation: { start: "2024-07-01T00:00:00.000Z", end: "2024-12-31T23:59:59.999Z" } },
  F3: { research: { start: "2023-01-01T00:00:00.000Z", end: "2024-12-31T23:59:59.999Z" }, validation: { start: "2025-01-01T00:00:00.000Z", end: "2025-06-30T23:59:59.999Z" } },
  F4: { research: { start: "2023-01-01T00:00:00.000Z", end: "2025-06-30T23:59:59.999Z" }, validation: { start: "2025-07-01T00:00:00.000Z", end: "2025-12-31T23:59:59.999Z" } },
  F5: { research: { start: "2023-01-01T00:00:00.000Z", end: "2025-12-31T23:59:59.999Z" }, validation: { start: "2026-01-01T00:00:00.000Z", end: "2026-03-31T23:59:59.999Z" } },
  F6: { research: { start: "2023-01-01T00:00:00.000Z", end: "2026-03-31T23:59:59.999Z" }, validation: { start: "2026-04-01T00:00:00.000Z", end: M3_R17_RESEARCH_END_ISO } },
});

export type R17EventTimeIdentity = Readonly<{
  signalId: string;
  symbol: R17Symbol;
  direction: R17Direction;
  signalTime: number;
  strategyVersion: "baseline-001";
  foldId: R17FoldId | null;
  btcRegime: R17Regime;
}>;

export type R17Observation = Readonly<{
  observationId: string;
  signalId: string;
  symbol: R17Symbol;
  direction: R17Direction;
  signalTime: number;
  strategyVersion: "baseline-001";
  classification: R17Classification;
  anchorSignalId: string;
  anchorSignalTime: number;
  foldId: R17FoldId | null;
  btcRegime: R17Regime;
  controlIncluded: true;
  candidateIncluded: boolean;
}>;

export type R17DesignDocument = Readonly<{
  schemaVersion: string;
  researchRoundId: string;
  phase: string;
  acceptedResearchSource: Readonly<{ sha: string; branch: string; requiredBaseHead: string }>;
  researchBoundary: Readonly<{ start: string; end: string; classification: string; timezone: string }>;
  productBoundary: Readonly<Record<string, unknown>>;
  priorRound016Use: Readonly<{ role: string; round017DesignInput: boolean; automaticFeatureCarryForward: boolean }>;
  activeDesign: Readonly<{
    hypothesisId: string;
    mechanismFamily: string;
    sourceUniverse: string;
    universe: readonly string[];
    directions: readonly string[];
    strategyVersion: string;
    variantCount: number;
    combinations: boolean;
    parameterSweep: boolean;
    optimizer: boolean;
    horizonHours: number;
    candidateModel: Readonly<{ id: string; noNewSignalPredicate: boolean; noR16FeatureUse: boolean }>;
    controlModel: Readonly<{ id: string }>;
    thesisStateMachine: Readonly<{ key: readonly string[]; activeLifetimeHours: number; futureOutcomeDependency: boolean; eventOrder: readonly string[] }>;
  }>;
  protocol: Readonly<{
    backtestPolicyVersion: string;
    folds: readonly string[];
    purgeHours: number;
    embargoHours: number;
    regimeBuckets: readonly string[];
    foldIdentity: Readonly<{
      sourceCommit: string;
      canonicalDefinition: Readonly<{ sourcePath: string; export: string; sourceSha256: string }>;
      inheritedAliases: readonly Readonly<{ sourcePath: string; export: string; definition: string; sourceSha256: string }>[];
      foldIds: readonly string[];
      boundaries: Readonly<Record<string, R17FoldBoundary>>;
    }>;
    regimeIdentity: Readonly<{ sourceCommit: string; sourcePath: string; function: string; sourceSha256: string; labels: readonly string[]; thresholdAdjustment: string }>;
    symbolBreadthRequirement: Readonly<{ allSymbolsRequired: boolean; minimumCandidateObservationsPerSymbol: number }>;
    regimeBreadthRequirement: Readonly<{ allBucketsRequired: boolean; minimumCandidateObservationsPerBucket: number }>;
    gates: Readonly<{ frozenBeforePerformance: boolean; evaluationMode: string; resultsMayNotChangeDefinitions: boolean; definitions: readonly Readonly<{ id: string; hardGate: boolean; role?: string; requirement: string }>[] }>;
    metricDefinitions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    followUpAudit: Readonly<{ fields: Readonly<Record<string, string>>; reportingOnly: boolean; candidateClassificationUnaffected: boolean; newTunableParameters: boolean }>;
  }>;
  authoritativeExecution: Readonly<Record<string, unknown>>;
  evidenceOutputs: Readonly<{ generatedDuringDesign: readonly unknown[] }>;
  status: Readonly<{ performance: string; selection: string; production: string; automaticTrading: boolean }>;
}>;

export function r17HashBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function r17HashCanonical(value: unknown): string {
  return r17HashBytes(Buffer.from(stableStringify(value), "utf8"));
}

export function readR17Design(root = process.cwd()): R17DesignDocument {
  const filePath = path.join(root, M3_R17_DESIGN_PATH);
  if (!existsSync(filePath)) throw new Error(`R17 design is missing: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8")) as R17DesignDocument;
}

function acceptedSourceBlob(root: string, sourceCommit: string, sourcePath: string): Buffer {
  try {
    return execFileSync("git", ["cat-file", "blob", `${sourceCommit}:${sourcePath}`], { cwd: root });
  } catch (error) {
    throw new Error(`R17 accepted source cannot be read: ${sourceCommit}:${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`R17 frozen identity mismatch: ${label}.`);
}

function validateFrozenDesignValues(design: R17DesignDocument): void {
  assertEqual(design.schemaVersion, "m3-r17-round-017-design-001", "schemaVersion");
  assertEqual(design.researchRoundId, M3_R17_RESEARCH_ROUND_ID, "researchRoundId");
  assertEqual(design.phase, "DESIGN_ONLY", "phase");
  assertEqual(design.acceptedResearchSource.sha, M3_R17_ACCEPTED_DESIGN_SOURCE_SHA, "acceptedResearchSource.sha");
  assertEqual(design.acceptedResearchSource.requiredBaseHead, M3_R17_ACCEPTED_DESIGN_SOURCE_SHA, "acceptedResearchSource.requiredBaseHead");
  assertEqual(design.researchBoundary.start, M3_R17_RESEARCH_START_ISO, "researchBoundary.start");
  assertEqual(design.researchBoundary.end, M3_R17_RESEARCH_END_ISO, "researchBoundary.end");
  assertEqual(design.researchBoundary.classification, "RESEARCH_AVAILABLE_SEEN_DATA", "researchBoundary.classification");
  assertEqual(design.researchBoundary.timezone, "UTC_EPOCH_MILLISECONDS_ONLY", "researchBoundary.timezone");
  assertEqual(design.activeDesign.hypothesisId, "R17-THESIS-LIFECYCLE-FIRST-ADVISORY", "active hypothesis");
  assertEqual(design.activeDesign.mechanismFamily, "THESIS_LIFECYCLE_DEDUPLICATION", "mechanism family");
  assertEqual(design.activeDesign.sourceUniverse, "EXACT_BASELINE_001_FORMAL_SIGNAL_STREAM", "source universe");
  assertEqual(stableStringify(design.activeDesign.universe), stableStringify(R17_SYMBOLS), "universe");
  assertEqual(stableStringify(design.activeDesign.directions), stableStringify(R17_DIRECTIONS), "directions");
  assertEqual(design.activeDesign.strategyVersion, "baseline-001", "strategy version");
  assertEqual(design.activeDesign.variantCount, 1, "variant count");
  assertEqual(design.activeDesign.combinations, false, "combinations");
  assertEqual(design.activeDesign.parameterSweep, false, "parameter sweep");
  assertEqual(design.activeDesign.optimizer, false, "optimizer");
  assertEqual(design.activeDesign.horizonHours, 4, "horizon");
  assertEqual(stableStringify(design.activeDesign.thesisStateMachine.key), stableStringify(["symbol", "direction"]), "state key");
  assertEqual(design.activeDesign.thesisStateMachine.activeLifetimeHours, 4, "active lifetime");
  assertEqual(design.activeDesign.thesisStateMachine.futureOutcomeDependency, false, "future outcome dependency");
  assertEqual(design.activeDesign.thesisStateMachine.eventOrder.join("|"), "signalTime ASC|symbol ASC|direction ASC with LONG before SHORT|signalId ASC", "event order");
  assertEqual(design.activeDesign.candidateModel.noNewSignalPredicate, true, "no new signal predicate");
  assertEqual(design.activeDesign.candidateModel.noR16FeatureUse, true, "no R16 feature use");
  assertEqual(design.protocol.backtestPolicyVersion, "bt-policy-003", "backtest policy");
  assertEqual(stableStringify(design.protocol.folds), stableStringify(R17_FOLD_IDS), "fold ids");
  assertEqual(design.protocol.purgeHours, 24, "purge");
  assertEqual(design.protocol.embargoHours, 24, "embargo");
  assertEqual(design.protocol.foldIdentity.sourceCommit, M3_R17_ACCEPTED_DESIGN_SOURCE_SHA, "fold source commit");
  assertEqual(design.protocol.regimeIdentity.sourceCommit, M3_R17_ACCEPTED_DESIGN_SOURCE_SHA, "regime source commit");
  assertEqual(design.protocol.regimeIdentity.function, "calculateBTCRegime", "regime function");
  assertEqual(design.protocol.regimeIdentity.thresholdAdjustment, "FORBIDDEN_AFTER_FREEZE", "regime threshold adjustment");
  assertEqual(design.authoritativeExecution.performanceExecutionCount, "DERIVE_FROM_ROUND_GLOBAL_LEDGER", "execution count source");
  assertEqual(design.authoritativeExecution.maxAuthoritativeExecutions, 1, "max executions");
  assertEqual(design.authoritativeExecution.performanceLock, "ROUND_GLOBAL_FIRST_RESULT_LOCK", "performance lock");
  assertEqual(design.authoritativeExecution.noPerformanceExecutionInThisTask, true, "performance boundary");
  assertEqual(design.authoritativeExecution.noSelectionExecutionInThisTask, true, "selection boundary");
  assertEqual(design.evidenceOutputs.generatedDuringDesign.length, 0, "design evidence outputs");
  assertEqual(design.status.performance, "NOT_AUTHORIZED / NOT_GENERATED", "performance status");
  assertEqual(design.status.selection, "NOT_EXECUTED", "selection status");
  assertEqual(design.status.production, "UNCHANGED", "production status");
  assertEqual(design.status.automaticTrading, false, "automatic trading status");
}

export function validateR17Design(root = process.cwd(), design = readR17Design(root), repositoryRoot = root): R17DesignDocument {
  validateFrozenDesignValues(design);
  const identity = design.protocol.foldIdentity;
  assertEqual(identity.canonicalDefinition.sourcePath, "src/lib/research/folds.ts", "fold source path");
  assertEqual(identity.canonicalDefinition.export, "RESEARCH_FOLDS", "fold export");
  assertEqual(identity.foldIds.join("|"), R17_FOLD_IDS.join("|"), "fold identity ids");
  assertEqual(stableStringify(identity.boundaries), stableStringify(R17_FROZEN_FOLD_BOUNDARIES), "fold boundaries");
  const canonicalBlob = acceptedSourceBlob(repositoryRoot, identity.sourceCommit, identity.canonicalDefinition.sourcePath);
  assertEqual(r17HashBytes(canonicalBlob), identity.canonicalDefinition.sourceSha256, "fold source SHA");
  if (!canonicalBlob.toString("utf8").includes("export const RESEARCH_FOLDS")) throw new Error("R17 accepted fold source export is missing.");
  const currentFoldPath = path.join(repositoryRoot, identity.canonicalDefinition.sourcePath);
  if (!existsSync(currentFoldPath) || r17HashBytes(Buffer.from(readFileSync(currentFoldPath))) !== identity.canonicalDefinition.sourceSha256) throw new Error("R17 current fold implementation does not match the accepted frozen source.");
  for (const alias of identity.inheritedAliases) {
    const aliasBlob = acceptedSourceBlob(repositoryRoot, M3_R17_ACCEPTED_DESIGN_SOURCE_SHA, alias.sourcePath);
    assertEqual(r17HashBytes(aliasBlob), alias.sourceSha256, `inherited source SHA ${alias.sourcePath}`);
  }
  const regime = design.protocol.regimeIdentity;
  assertEqual(regime.sourcePath, "src/lib/strategy/regimes.ts", "regime source path");
  const regimeBlob = acceptedSourceBlob(repositoryRoot, regime.sourceCommit, regime.sourcePath);
  assertEqual(r17HashBytes(regimeBlob), regime.sourceSha256, "regime source SHA");
  const regimeSource = regimeBlob.toString("utf8");
  if (!regimeSource.includes("export function calculateBTCRegime") || !regimeSource.includes("bullCloseDistance >= 1") || !regimeSource.includes("bullEmaSpread >= 0.5") || !regimeSource.includes("bullEmaSlope >= 0.1") || !regimeSource.includes("bearCloseDistance >= 1") || !regimeSource.includes("bearEmaSpread >= 0.5") || !regimeSource.includes("bearEmaSlope >= 0.1")) throw new Error("R17 accepted regime source definition is incomplete.");
  const currentRegimePath = path.join(repositoryRoot, regime.sourcePath);
  if (!existsSync(currentRegimePath) || r17HashBytes(Buffer.from(readFileSync(currentRegimePath))) !== regime.sourceSha256) throw new Error("R17 current regime implementation does not match the accepted frozen source.");
  if (stableStringify(regime.labels) !== stableStringify(R17_REGIMES)) throw new Error("R17 regime labels are not frozen.");
  if (design.protocol.followUpAudit.reportingOnly !== true || design.protocol.followUpAudit.candidateClassificationUnaffected !== true || design.protocol.followUpAudit.newTunableParameters !== false) throw new Error("R17 follow-up audit boundary is invalid.");
  return design;
}

export function r17ValidationFoldForTime(signalTime: number, design: R17DesignDocument): R17FoldId | null {
  if (!Number.isSafeInteger(signalTime) || signalTime < M3_R17_RESEARCH_START || signalTime > M3_R17_RESEARCH_END) throw new Error("R17 signalTime must be a safe timestamp within the frozen research boundary.");
  for (const foldId of R17_FOLD_IDS) {
    const range = design.protocol.foldIdentity.boundaries[foldId]?.validation;
    if (range === undefined) throw new Error(`R17 validation boundary is missing for ${foldId}.`);
    const start = Date.parse(range.start);
    const end = Date.parse(range.end);
    if (signalTime >= start && signalTime <= end) return foldId;
  }
  return null;
}

export function compareR17Strings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function r17DirectionOrder(direction: R17Direction): number {
  return direction === "LONG" ? 0 : 1;
}

export function r17SymbolOrder(symbol: R17Symbol): number {
  const index = R17_SYMBOLS.indexOf(symbol);
  if (index < 0) throw new Error(`Unknown R17 symbol: ${symbol}.`);
  return index;
}
