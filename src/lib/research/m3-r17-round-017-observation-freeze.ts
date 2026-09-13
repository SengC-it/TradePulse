import { createReadStream, createWriteStream, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, closeSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createInterface } from "node:readline";
import path from "node:path";

import {
  M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT,
  M3_R17_ACCEPTED_DESIGN_SOURCE_SHA,
  M3_R17_DESIGN_PATH,
  M3_R17_IMPLEMENTATION_SOURCE_SHA,
  M3_R17_OBSERVATION_DATA_PATH,
  M3_R17_OBSERVATION_FREEZE_PATH,
  M3_R17_RESEARCH_END_ISO,
  M3_R17_RESEARCH_ROUND_ID,
  M3_R17_RESEARCH_START_ISO,
  R17_DIRECTIONS,
  R17_FROZEN_FOLD_BOUNDARIES,
  R17_FOLD_IDS,
  R17_REGIMES,
  R17_SYMBOLS,
  r17HashBytes,
  r17HashCanonical,
  r17ValidationFoldForTime,
  validateR17Design,
  type R17EventTimeIdentity,
  type R17FoldId,
  type R17Observation,
  type R17Regime,
  type R17DesignDocument,
  type R17Symbol,
} from "./m3-r17-round-017-protocol.ts";
import { classifyR17Events, r17ObservationCanonicalLine, validateR17Observation } from "./m3-r17-round-017-classifier.ts";
import {
  assertGlobalUniqueR17FormalAdvisories,
  assertR17ClassifierGapInvariant,
  auditR17FormalStream,
  buildR17FormalStreamFromRound006Cache,
  reconcileR17FormalStreamCount,
  type R17FormalStreamAudit,
} from "./m3-r17-round-017-formal-stream.ts";
import {
  auditR17SettlementIdentityMatrix,
  scanR17SettlementIdentitySource,
  type R17SettlementIdentityAuditSummary,
  type R17SettlementIdentitySource,
} from "./m3-r17-round-017-settlement-audit.ts";
import { stableStringify } from "./utils.ts";

export const R17_OBSERVATION_FREEZE_SCHEMA_VERSION = "m3-r17-round-017-observation-freeze-001" as const;
export const R17_SETTLEMENT_AVAILABILITY_SCHEMA_VERSION = "m3-r17-round-017-settlement-availability-001" as const;

export type R17SettlementAvailability = Readonly<{
  schemaVersion: typeof R17_SETTLEMENT_AVAILABILITY_SCHEMA_VERSION;
  sourcePolicy: "IDENTITY_ONLY_ACCEPTED_HISTORICAL_CACHE";
  labelValuesRead: false;
  sourceRecordCount: number;
  matchedIdentityCount: number;
  unmatchedIdentityCount: number;
  duplicateIdentityCount: number;
  completeness: "COMPLETE" | "DATA_NOT_AVAILABLE";
}>;

export type R17StructuralAudit = Readonly<R17FormalStreamAudit & {
  foldAssignmentBeforeCount: number;
  foldAssignmentAfterCount: number;
}>;

export type R17ObservationFreezeManifest = Readonly<{
  schemaVersion: typeof R17_OBSERVATION_FREEZE_SCHEMA_VERSION;
  researchRoundId: typeof M3_R17_RESEARCH_ROUND_ID;
  sourceCommit: typeof M3_R17_IMPLEMENTATION_SOURCE_SHA;
  acceptedDesignSourceSha: typeof M3_R17_ACCEPTED_DESIGN_SOURCE_SHA;
  designPath: typeof M3_R17_DESIGN_PATH;
  designSha256: string;
  researchBoundary: Readonly<{ start: typeof M3_R17_RESEARCH_START_ISO; end: typeof M3_R17_RESEARCH_END_ISO; classification: "RESEARCH_AVAILABLE_SEEN_DATA"; timezone: "UTC_EPOCH_MILLISECONDS_ONLY" }>;
  sourceObservationPath: string;
  sourceObservationSchema: string;
  sourceObservationDataBytes: number;
  sourceObservationDataSha256: string;
  sourcePolicy: "ACCEPTED_EXISTING_HISTORICAL_CACHE_READ_ONLY";
  newMarketDataFetched: false;
  productionDataIncluded: false;
  formalStream: Readonly<{
    source: "EXACT_BASELINE_001_FORMAL_SIGNAL_STREAM";
    sourcePath: "ROUND006_FROZEN_1H_4H_CANDLE_CACHE_WITH_BASELINE_001_ENGINE";
    evaluationTimelineCount: number;
    evaluationRowCount: number;
    candidateRowCount: number;
    formalCandidateRowCount: number;
    observationCount: number;
    uniqueFormalSignalIdentityCount: number;
    identitySha256: string;
  }>;
  observationDataPath: typeof M3_R17_OBSERVATION_DATA_PATH;
  observationCount: number;
  observationDataBytes: number;
  observationDataSha256: string;
  observationIdentitySha256: string;
  classifierImplementationPath: "src/lib/research/m3-r17-round-017-classifier.ts";
  classifierImplementationSha256: string;
  foldIdentity: Readonly<{ sourceCommit: typeof M3_R17_ACCEPTED_DESIGN_SOURCE_SHA; sourcePath: "src/lib/research/folds.ts"; export: "RESEARCH_FOLDS"; sourceSha256: string; boundaries: typeof R17_FROZEN_FOLD_BOUNDARIES }>;
  regimeIdentity: Readonly<{ sourceCommit: typeof M3_R17_ACCEPTED_DESIGN_SOURCE_SHA; sourcePath: "src/lib/strategy/regimes.ts"; function: "calculateBTCRegime"; sourceSha256: string; labels: typeof R17_REGIMES }>;
  symbols: typeof R17_SYMBOLS;
  directions: typeof R17_DIRECTIONS;
  counts: Readonly<{ controlCount: number; candidateCount: number; firstCount: number; followUpCount: number; suppressedCount: number; candidateByFold: Readonly<Record<R17FoldId, number>>; candidateBySymbol: Readonly<Record<R17Symbol, number>>; candidateByRegime: Readonly<Record<R17Regime, number>> }>;
  structuralAudit: R17StructuralAudit;
  minSignalTime: number | null;
  maxSignalTime: number | null;
  settlementAvailability: R17SettlementAvailability;
  settlementIdentityAudit: R17SettlementIdentityAuditSummary;
  classifier: Readonly<{ stateKey: readonly ["symbol", "direction"]; activeLifetimeHours: 4; futureOutcomeDependency: false; eventOrder: readonly ["signalTime ASC", "symbol ASC", "direction ASC with LONG before SHORT", "signalId ASC"] }>;
  performanceExecutionCount: 0;
  performanceLockTriggered: false;
  performanceExecuted: false;
  selectionExecuted: false;
  createdAt: string;
  manifestSha256: string;
}>;

async function hashFile(filePath: string): Promise<Readonly<{ bytes: number; sha256: string }>> {
  const digest = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk);
    bytes += Buffer.byteLength(chunk);
  }
  return Object.freeze({ bytes, sha256: digest.digest("hex") });
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r+");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

async function writeObservationData(filePath: string, observations: readonly R17Observation[]): Promise<Readonly<{ bytes: number; sha256: string }>> {
  const output = createWriteStream(filePath, { encoding: "utf8" });
  const digest = createHash("sha256");
  let bytes = 0;
  try {
    for (const observation of observations) {
      const line = r17ObservationCanonicalLine(observation);
      const encoded = Buffer.from(line, "utf8");
      digest.update(encoded);
      bytes += encoded.byteLength;
      if (!output.write(line, "utf8")) await once(output, "drain");
    }
    await new Promise<void>((resolve, reject) => { output.once("finish", resolve); output.once("error", reject); output.end(); });
    fsyncFile(filePath);
  } catch (error) {
    output.destroy();
    throw error;
  }
  return Object.freeze({ bytes, sha256: digest.digest("hex") });
}

function emptyFoldCounts(): Record<R17FoldId, number> { return Object.fromEntries(R17_FOLD_IDS.map((foldId) => [foldId, 0])) as Record<R17FoldId, number>; }
function emptySymbolCounts(): Record<R17Symbol, number> { return Object.fromEntries(R17_SYMBOLS.map((symbol) => [symbol, 0])) as Record<R17Symbol, number>; }
function emptyRegimeCounts(): Record<R17Regime, number> { return Object.fromEntries(R17_REGIMES.map((regime) => [regime, 0])) as Record<R17Regime, number>; }

function counts(observations: readonly R17Observation[]): R17ObservationFreezeManifest["counts"] {
  const fold = emptyFoldCounts();
  const symbol = emptySymbolCounts();
  const regime = emptyRegimeCounts();
  let firstCount = 0;
  let followUpCount = 0;
  for (const observation of observations) {
    if (observation.classification === "FIRST") firstCount += 1;
    else followUpCount += 1;
    if (!observation.candidateIncluded) continue;
    if (observation.foldId !== null) fold[observation.foldId] += 1;
    symbol[observation.symbol] += 1;
    regime[observation.btcRegime] += 1;
  }
  return Object.freeze({ controlCount: observations.length, candidateCount: firstCount, firstCount, followUpCount, suppressedCount: followUpCount, candidateByFold: Object.freeze(fold), candidateBySymbol: Object.freeze(symbol), candidateByRegime: Object.freeze(regime) });
}

function manifestWithoutHash(manifest: R17ObservationFreezeManifest): Readonly<Record<string, unknown>> {
  return { ...manifest, manifestSha256: null };
}

function writeManifestAtomic(root: string, manifest: R17ObservationFreezeManifest): void {
  const target = path.join(root, M3_R17_OBSERVATION_FREEZE_PATH);
  if (existsSync(target)) throw new Error(`R17 observation freeze manifest already exists: ${target}`);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r17-manifest-staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(manifest), "utf8");
    fsyncFile(temporary);
    renameSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR17ObservationFreeze(root = process.cwd()): R17ObservationFreezeManifest {
  const filePath = path.join(root, M3_R17_OBSERVATION_FREEZE_PATH);
  if (!existsSync(filePath)) throw new Error(`R17 observation freeze manifest is missing: ${filePath}`);
  const manifest = JSON.parse(readFileSync(filePath, "utf8")) as R17ObservationFreezeManifest;
  if (manifest.schemaVersion !== R17_OBSERVATION_FREEZE_SCHEMA_VERSION || manifest.researchRoundId !== M3_R17_RESEARCH_ROUND_ID || manifest.sourceCommit !== M3_R17_IMPLEMENTATION_SOURCE_SHA || manifest.acceptedDesignSourceSha !== M3_R17_ACCEPTED_DESIGN_SOURCE_SHA || manifest.observationDataPath !== M3_R17_OBSERVATION_DATA_PATH || manifest.observationCount < 0 || manifest.manifestSha256 !== r17HashCanonical(manifestWithoutHash(manifest))) throw new Error("R17 observation freeze manifest identity or checksum is invalid.");
  if (manifest.formalStream.source !== "EXACT_BASELINE_001_FORMAL_SIGNAL_STREAM" || manifest.formalStream.sourcePath !== "ROUND006_FROZEN_1H_4H_CANDLE_CACHE_WITH_BASELINE_001_ENGINE" || manifest.formalStream.observationCount !== M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT || manifest.formalStream.formalCandidateRowCount !== M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT || manifest.formalStream.uniqueFormalSignalIdentityCount !== M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT || manifest.structuralAudit.duplicateCanonicalIdentityCount !== 0) throw new Error("R17 formal stream provenance or global identity is invalid.");
  reconcileR17FormalStreamCount(manifest.formalStream.observationCount, M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT);
  const identityAudit = manifest.settlementIdentityAudit;
  if (identityAudit.schemaVersion !== "m3-r17-round-017-settlement-identity-audit-001" || identityAudit.formalCount !== manifest.formalStream.observationCount || identityAudit.partitionTotal !== identityAudit.formalCount || identityAudit.labelValuesRead !== false || identityAudit.economicFieldsRead !== false || Object.values(identityAudit.categoryCounts).reduce((sum, count) => sum + count, 0) !== identityAudit.formalCount || identityAudit.matrixSha256.length !== 64) throw new Error("R17 settlement identity audit partition or metadata-only boundary is invalid.");
  return manifest;
}

export function annotateR17EventsWithFold(
  events: readonly R17EventTimeIdentity[],
  design: R17DesignDocument,
): readonly R17EventTimeIdentity[] {
  return Object.freeze(events.map((event) => Object.freeze({ ...event, foldId: r17ValidationFoldForTime(event.signalTime, design) })));
}

function annotateR17ObservationsWithFold(
  observations: readonly R17Observation[],
  design: R17DesignDocument,
): readonly R17Observation[] {
  return Object.freeze(observations.map((observation) => Object.freeze({ ...observation, foldId: r17ValidationFoldForTime(observation.signalTime, design) })));
}

type R17HistoricalIdentitySourceDescriptor = Readonly<{
  sourceKind: "R13_OBSERVATION_CACHE" | "R14_OBSERVATION_CACHE" | "R15_OBSERVATION_CACHE" | "R16_OBSERVATION_CACHE";
  repositoryRoot: string;
  manifestPath: string;
  sourcePath: string;
  identityKey: "observationId" | "signalId";
  labelKeys: readonly string[];
  r14Provenance: boolean;
}>;

function metadataString(raw: string, key: string): string | null {
  const match = raw.match(new RegExp(`\"${key}\"\\s*:\\s*\"([^\"\\\\]*(?:\\\\.[^\"\\\\]*)*)\"`));
  return match?.[1] ?? null;
}

function metadataBoolean(raw: string, key: string): boolean | null {
  const match = raw.match(new RegExp(`\"${key}\"\\s*:\\s*(true|false)`));
  return match?.[1] === undefined ? null : match[1] === "true";
}

function metadataNumber(raw: string, key: string): number | null {
  const match = raw.match(new RegExp(`\"${key}\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (match?.[1] === undefined) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function acceptedHistoricalManifest(
  descriptor: R17HistoricalIdentitySourceDescriptor,
): Readonly<{ sourceStatus: "ACCEPTED_EXISTING_HISTORICAL_CACHE" | "INVALID_PROVENANCE"; expectedSha256?: string }> {
  if (!existsSync(descriptor.manifestPath)) return Object.freeze({ sourceStatus: "INVALID_PROVENANCE" as const });
  let raw: string;
  try {
    raw = readFileSync(descriptor.manifestPath, "utf8");
  } catch {
    return Object.freeze({ sourceStatus: "INVALID_PROVENANCE" as const });
  }
  const observationDataPath = metadataString(raw, "observationDataPath");
  const observationDataSha256 = metadataString(raw, "observationDataSha256");
  const frozen = metadataBoolean(raw, "frozen");
  const noFutureInformationLeakage = metadataBoolean(raw, "noFutureInformationLeakage");
  const integrity = metadataString(raw, "integrity");
  const integrityExcludedObservations = metadataNumber(raw, "integrityExcludedObservations");
  const hashValid = observationDataSha256 !== null && /^[0-9a-f]{64}$/u.test(observationDataSha256);
  const pathValid = observationDataPath === descriptor.sourcePath;
  const commonValid = frozen === true && pathValid && hashValid && noFutureInformationLeakage !== false;
  const sourceValid = descriptor.r14Provenance
    ? commonValid && noFutureInformationLeakage === true && integrityExcludedObservations === 0
    : commonValid && integrity === "COMPLETE";
  return Object.freeze(sourceValid
    ? { sourceStatus: "ACCEPTED_EXISTING_HISTORICAL_CACHE" as const, expectedSha256: observationDataSha256! }
    : { sourceStatus: "INVALID_PROVENANCE" as const });
}

async function scanAcceptedHistoricalIdentitySources(root: string): Promise<readonly R17SettlementIdentitySource[]> {
  const r13Root = path.resolve(root, "..", "round-013-forward-edge-discovery");
  const r14Root = path.resolve(root, "..", "round-014-r13-execution-replay");
  const r15Root = path.resolve(root, "..", "round-015-beta-alpha-decomposition");
  const r16Root = path.resolve(root, "..", "round-016-microstructure-information-gain");
  const descriptors: readonly R17HistoricalIdentitySourceDescriptor[] = [
    {
      sourceKind: "R13_OBSERVATION_CACHE",
      repositoryRoot: r13Root,
      manifestPath: path.join(r13Root, "docs/research/round-013-observation-freeze.json"),
      sourcePath: ".cache/tradepulse/round-013/observations.ndjson",
      identityKey: "observationId",
      labelKeys: ["label"],
      r14Provenance: false,
    },
    {
      sourceKind: "R14_OBSERVATION_CACHE",
      repositoryRoot: r14Root,
      manifestPath: path.join(r14Root, "docs/research/round-014-observation-freeze.json"),
      sourcePath: ".cache/tradepulse/round-014/observations.ndjson",
      identityKey: "observationId",
      labelKeys: ["labels", "latencyStressLabels"],
      r14Provenance: true,
    },
    {
      sourceKind: "R15_OBSERVATION_CACHE",
      repositoryRoot: r15Root,
      manifestPath: path.join(r15Root, "docs/research/round-015-observation-freeze.json"),
      sourcePath: ".cache/tradepulse/round-015/observations.ndjson",
      identityKey: "observationId",
      labelKeys: ["label"],
      r14Provenance: false,
    },
    {
      sourceKind: "R16_OBSERVATION_CACHE",
      repositoryRoot: r16Root,
      manifestPath: path.join(r16Root, "docs/research/round-016-observation-freeze.json"),
      sourcePath: ".cache/tradepulse/round-016/observations.ndjson",
      identityKey: "observationId",
      labelKeys: ["label"],
      r14Provenance: false,
    },
  ];
  const scans: R17SettlementIdentitySource[] = [];
  for (const descriptor of descriptors) {
    const filePath = path.join(descriptor.repositoryRoot, descriptor.sourcePath);
    const provenance = acceptedHistoricalManifest(descriptor);
    scans.push(await scanR17SettlementIdentitySource({
      sourceKind: descriptor.sourceKind,
      sourcePath: descriptor.sourcePath,
      filePath,
      identityKey: descriptor.identityKey,
      labelKeys: descriptor.labelKeys,
      sourceStatus: existsSync(filePath) ? provenance.sourceStatus : "MISSING_SOURCE",
      matchMode: "EXACT_CANONICAL_IDENTITY",
      networkAcquired: false,
      reconstructed: false,
      expectedSha256: provenance.expectedSha256,
    }));
  }
  return Object.freeze(scans);
}

export async function materializeR17ObservationFreeze(input: Readonly<{
  root?: string;
  sourceObservationFile: string;
  round006CacheDirectory: string;
  createdAt?: string;
  repositoryRoot?: string;
}>): Promise<R17ObservationFreezeManifest> {
  const root = path.resolve(input.root ?? process.cwd());
  const repositoryRoot = path.resolve(input.repositoryRoot ?? process.cwd());
  const design = validateR17Design(root, undefined, repositoryRoot);
  const targetData = path.join(root, M3_R17_OBSERVATION_DATA_PATH);
  const targetManifest = path.join(root, M3_R17_OBSERVATION_FREEZE_PATH);
  if (existsSync(targetData) || existsSync(targetManifest)) throw new Error("R17 observation freeze is already present or partial; refusing to overwrite it.");
  const sourcePath = path.resolve(input.sourceObservationFile);
  if (!existsSync(sourcePath)) throw new Error(`R17 accepted historical observation cache is missing: ${sourcePath}`);
  const formalStream = await buildR17FormalStreamFromRound006Cache({ cacheDirectory: path.resolve(input.round006CacheDirectory) });
  reconcileR17FormalStreamCount(formalStream.events.length, M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT);
  assertGlobalUniqueR17FormalAdvisories(formalStream.events);
  const formalStreamIdentitySha256 = r17HashCanonical(formalStream.events);
  const formalIdentities = formalStream.events.map((event) => Object.freeze({
    canonicalIdentity: event.signalId,
    formalSourceStatus: "ACCEPTED_BASELINE_001_FORMAL_STREAM" as const,
    formalSourcePath: "ROUND006_FROZEN_1H_4H_CANDLE_CACHE_WITH_BASELINE_001_ENGINE",
    formalSourceSha256: formalStreamIdentitySha256,
  }));
  const settlementSources = await scanAcceptedHistoricalIdentitySources(root);
  const settlementIdentityAudit = auditR17SettlementIdentityMatrix({ formalIdentities, settlementSources });
  const source = settlementSources.find((value) => value.sourceKind === "R14_OBSERVATION_CACHE");
  if (source === undefined) throw new Error("R17 R14 identity source is missing from the bounded audit.");
  const sourceBytes = await hashFile(sourcePath);
  const classifiedObservations = classifyR17Events(formalStream.events);
  const annotatedEvents = annotateR17EventsWithFold(formalStream.events, design);
  const observations = annotateR17ObservationsWithFold(classifiedObservations, design);
  const observationCounts = counts(observations);
  assertR17ClassifierGapInvariant(formalStream.audit, observationCounts.followUpCount);
  const targetDirectory = path.dirname(targetData);
  mkdirSync(targetDirectory, { recursive: true });
  const staging = mkdtempSync(path.join(targetDirectory, ".r17-observation-staging-"));
  const temporaryData = path.join(staging, "observations.ndjson");
  let publishedData = false;
  try {
    const written = await writeObservationData(temporaryData, observations);
    renameSync(temporaryData, targetData);
    publishedData = true;
    const observationIdentitySha256 = r17HashCanonical(observations);
    const manifestBase = {
      schemaVersion: R17_OBSERVATION_FREEZE_SCHEMA_VERSION,
      researchRoundId: M3_R17_RESEARCH_ROUND_ID,
      sourceCommit: M3_R17_IMPLEMENTATION_SOURCE_SHA,
      acceptedDesignSourceSha: M3_R17_ACCEPTED_DESIGN_SOURCE_SHA,
      designPath: M3_R17_DESIGN_PATH,
      designSha256: r17HashBytes(Buffer.from(readFileSync(path.join(root, M3_R17_DESIGN_PATH)))),
      researchBoundary: { start: M3_R17_RESEARCH_START_ISO, end: M3_R17_RESEARCH_END_ISO, classification: "RESEARCH_AVAILABLE_SEEN_DATA" as const, timezone: "UTC_EPOCH_MILLISECONDS_ONLY" as const },
      sourceObservationPath: ".cache/tradepulse/round-014/observations.ndjson",
      sourceObservationSchema: "m3-r14-round-014-observation-freeze-001",
      sourceObservationDataBytes: sourceBytes.bytes,
      sourceObservationDataSha256: sourceBytes.sha256,
      sourcePolicy: "ACCEPTED_EXISTING_HISTORICAL_CACHE_READ_ONLY" as const,
      newMarketDataFetched: false as const,
      productionDataIncluded: false as const,
      formalStream: {
        source: "EXACT_BASELINE_001_FORMAL_SIGNAL_STREAM" as const,
        sourcePath: "ROUND006_FROZEN_1H_4H_CANDLE_CACHE_WITH_BASELINE_001_ENGINE" as const,
        evaluationTimelineCount: formalStream.evaluationTimelineCount,
        evaluationRowCount: formalStream.evaluationRowCount,
        candidateRowCount: formalStream.candidateRowCount,
        formalCandidateRowCount: formalStream.formalCandidateRowCount,
        observationCount: formalStream.events.length,
        uniqueFormalSignalIdentityCount: formalStream.uniqueFormalSignalIdentityCount,
        identitySha256: formalStreamIdentitySha256,
      },
      observationDataPath: M3_R17_OBSERVATION_DATA_PATH,
      observationCount: observations.length,
      observationDataBytes: written.bytes,
      observationDataSha256: written.sha256,
      observationIdentitySha256,
      classifierImplementationPath: "src/lib/research/m3-r17-round-017-classifier.ts" as const,
      classifierImplementationSha256: (await hashFile(path.join(repositoryRoot, "src/lib/research/m3-r17-round-017-classifier.ts"))).sha256,
      foldIdentity: { sourceCommit: M3_R17_ACCEPTED_DESIGN_SOURCE_SHA, sourcePath: "src/lib/research/folds.ts" as const, export: "RESEARCH_FOLDS" as const, sourceSha256: design.protocol.foldIdentity.canonicalDefinition.sourceSha256, boundaries: R17_FROZEN_FOLD_BOUNDARIES },
      regimeIdentity: { sourceCommit: M3_R17_ACCEPTED_DESIGN_SOURCE_SHA, sourcePath: "src/lib/strategy/regimes.ts" as const, function: "calculateBTCRegime" as const, sourceSha256: design.protocol.regimeIdentity.sourceSha256, labels: R17_REGIMES },
      symbols: R17_SYMBOLS,
      directions: R17_DIRECTIONS,
      counts: observationCounts,
      minSignalTime: observations.length === 0 ? null : observations[0]!.signalTime,
      maxSignalTime: observations.length === 0 ? null : observations[observations.length - 1]!.signalTime,
      structuralAudit: { ...formalStream.audit, foldAssignmentBeforeCount: formalStream.events.length, foldAssignmentAfterCount: annotatedEvents.length },
      settlementAvailability: { schemaVersion: R17_SETTLEMENT_AVAILABILITY_SCHEMA_VERSION, sourcePolicy: "IDENTITY_ONLY_ACCEPTED_HISTORICAL_CACHE", labelValuesRead: false as const, sourceRecordCount: source.sourceRecordCount, matchedIdentityCount: formalIdentities.filter((formal) => source.identityIds.has(formal.canonicalIdentity)).length, unmatchedIdentityCount: formalIdentities.filter((formal) => !source.identityIds.has(formal.canonicalIdentity)).length, duplicateIdentityCount: source.duplicateIdentityCount, completeness: formalIdentities.every((formal) => source.identityIds.has(formal.canonicalIdentity)) && source.duplicateIdentityCount === 0 ? "COMPLETE" as const : "DATA_NOT_AVAILABLE" as const },
      settlementIdentityAudit: settlementIdentityAudit.summary,
      classifier: { stateKey: ["symbol", "direction"] as const, activeLifetimeHours: 4 as const, futureOutcomeDependency: false as const, eventOrder: ["signalTime ASC", "symbol ASC", "direction ASC with LONG before SHORT", "signalId ASC"] as const },
      performanceExecutionCount: 0 as const,
      performanceLockTriggered: false as const,
      performanceExecuted: false as const,
      selectionExecuted: false as const,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    const manifest = Object.freeze({ ...manifestBase, manifestSha256: r17HashCanonical({ ...manifestBase, manifestSha256: null }) }) as R17ObservationFreezeManifest;
    writeManifestAtomic(root, manifest);
    return manifest;
  } catch (error) {
    if (publishedData && existsSync(targetData)) rmSync(targetData, { force: true });
    throw error;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export type R17ObservationScan = Readonly<{ observationCount: number; observationDataBytes: number; observationDataSha256: string; controlCount: number; candidateCount: number; firstCount: number; followUpCount: number; suppressedCount: number; candidateByFold: Readonly<Record<R17FoldId, number>>; candidateBySymbol: Readonly<Record<R17Symbol, number>>; candidateByRegime: Readonly<Record<R17Regime, number>>; minSignalTime: number | null; maxSignalTime: number | null; structuralAudit: R17FormalStreamAudit }>;

export async function scanR17ObservationData(filePath: string): Promise<R17ObservationScan> {
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute)) throw new Error(`R17 observation data is missing: ${absolute}`);
  const input = createReadStream(absolute, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  const digest = createHash("sha256");
  const seen = new Set<string>();
  const seenSignalIds = new Set<string>();
  const auditEvents: R17EventTimeIdentity[] = [];
  const fold = emptyFoldCounts();
  const symbol = emptySymbolCounts();
  const regime = emptyRegimeCounts();
  let observationCount = 0;
  let controlCount = 0;
  let candidateCount = 0;
  let firstCount = 0;
  let followUpCount = 0;
  let minSignalTime: number | null = null;
  let maxSignalTime: number | null = null;
  let previous: R17Observation | null = null;
  try {
    for await (const line of lines) {
      if (line.length === 0) throw new Error(`R17 observation line ${observationCount + 1} is empty.`);
      const encoded = Buffer.from(`${line}\n`, "utf8");
      digest.update(encoded);
      const observation = validateR17Observation(JSON.parse(line));
      if (seen.has(observation.observationId)) throw new Error(`R17 observation duplicate: ${observation.observationId}.`);
      if (seenSignalIds.has(observation.signalId)) throw new Error(`R17 formal stream duplicate signalId: ${observation.signalId}.`);
      if (previous && (observation.signalTime < previous.signalTime || (observation.signalTime === previous.signalTime && (r17SymbolOrderForScan(observation.symbol) < r17SymbolOrderForScan(previous.symbol) || (observation.symbol === previous.symbol && (observation.direction === "LONG" ? 0 : 1) < (previous.direction === "LONG" ? 0 : 1)))))) throw new Error("R17 observation ordering is not deterministic.");
      if (r17ObservationCanonicalLine(observation) !== `${line}\n`) throw new Error(`R17 observation is not canonical UTF-8 JSON at line ${observationCount + 1}.`);
      seen.add(observation.observationId);
      seenSignalIds.add(observation.signalId);
      auditEvents.push(Object.freeze({ signalId: observation.signalId, symbol: observation.symbol, direction: observation.direction, signalTime: observation.signalTime, strategyVersion: observation.strategyVersion, foldId: null, btcRegime: observation.btcRegime }));
      previous = observation;
      observationCount += 1;
      controlCount += 1;
      if (observation.classification === "FIRST") { firstCount += 1; candidateCount += 1; } else followUpCount += 1;
      if (observation.candidateIncluded) { if (observation.foldId !== null) fold[observation.foldId] += 1; symbol[observation.symbol] += 1; regime[observation.btcRegime] += 1; }
      minSignalTime = minSignalTime === null ? observation.signalTime : Math.min(minSignalTime, observation.signalTime);
      maxSignalTime = maxSignalTime === null ? observation.signalTime : Math.max(maxSignalTime, observation.signalTime);
    }
  } finally {
    lines.close();
    input.destroy();
  }
  const stat = statSync(absolute);
  if (stat.size !== 0 && observationCount === 0) throw new Error("R17 observation data is empty.");
  const structuralAudit = auditR17FormalStream(auditEvents);
  return Object.freeze({ observationCount, observationDataBytes: stat.size, observationDataSha256: digest.digest("hex"), controlCount, candidateCount, firstCount, followUpCount, suppressedCount: followUpCount, candidateByFold: Object.freeze(fold), candidateBySymbol: Object.freeze(symbol), candidateByRegime: Object.freeze(regime), minSignalTime, maxSignalTime, structuralAudit });
}

function r17SymbolOrderForScan(symbol: R17Symbol): number { return R17_SYMBOLS.indexOf(symbol); }

export async function verifyR17ObservationFreeze(root = process.cwd()): Promise<Readonly<{ manifest: R17ObservationFreezeManifest; scan: R17ObservationScan }>> {
  const manifest = readR17ObservationFreeze(root);
  const scan = await scanR17ObservationData(path.join(root, manifest.observationDataPath));
  const expectedStructuralAudit = { duplicateCanonicalIdentityCount: manifest.structuralAudit.duplicateCanonicalIdentityCount, uniqueSignalTimeCount: manifest.structuralAudit.uniqueSignalTimeCount, sameSymbolSameDirectionGapLt4hCount: manifest.structuralAudit.sameSymbolSameDirectionGapLt4hCount, sameSymbolSameDirectionGapEq4hCount: manifest.structuralAudit.sameSymbolSameDirectionGapEq4hCount, oppositeDirectionSameTimestampCount: manifest.structuralAudit.oppositeDirectionSameTimestampCount };
  if (scan.observationCount !== manifest.observationCount || scan.observationDataBytes !== manifest.observationDataBytes || scan.observationDataSha256 !== manifest.observationDataSha256 || scan.controlCount !== manifest.counts.controlCount || scan.candidateCount !== manifest.counts.candidateCount || scan.firstCount !== manifest.counts.firstCount || scan.followUpCount !== manifest.counts.followUpCount || scan.suppressedCount !== manifest.counts.suppressedCount || stableStringify(scan.candidateByFold) !== stableStringify(manifest.counts.candidateByFold) || stableStringify(scan.candidateBySymbol) !== stableStringify(manifest.counts.candidateBySymbol) || stableStringify(scan.candidateByRegime) !== stableStringify(manifest.counts.candidateByRegime) || stableStringify(scan.structuralAudit) !== stableStringify(expectedStructuralAudit) || scan.minSignalTime !== manifest.minSignalTime || scan.maxSignalTime !== manifest.maxSignalTime) throw new Error("R17 observation freeze data does not match its committed manifest.");
  return Object.freeze({ manifest, scan });
}

export { hashFile as hashR17File };
