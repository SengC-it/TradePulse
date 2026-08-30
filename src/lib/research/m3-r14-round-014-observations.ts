import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, closeSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { createInterface } from "node:readline";
import path from "node:path";

import type { BacktestData } from "../backtest/types.ts";
import type { ResearchSymbol } from "../config/constants.ts";
import { buildR13Observation, type R13Observation } from "./m3-r13-round-013-performance.ts";
import { locateAcceptedRound006Cache, prepareR13Dataset, R13_DEFAULT_CACHE_DIRECTORY } from "./m3-r13-round-013-data.ts";
import { R13OneMinuteIndexedSeries } from "./m3-r13-round-013-index.ts";
import { R13_PLAN, R13_FEATURE_SPEC_SHA256, R13_MODEL_SPEC_SHA256, R13_PLAN_SHA256 } from "./m3-r13-round-013-plan.ts";
import { R13_SELECTION_GATE_SHA256 } from "./selection-gates-round-013.ts";
import { R13_FEATURE_NAMES, R13_HORIZON_HOURS, R13_SYMBOLS, M3_R13_RESEARCH_END_ISO, M3_R13_RESEARCH_ROUND_ID, type R13Direction } from "./m3-r13-round-013-protocol.ts";
import type { R13ForwardLabel, R13LabelStatus } from "./m3-r13-round-013-labels.ts";
import { M3_R14_DATASET_IDENTITY_SHA256, M3_R14_IDENTITY_PATH, M3_R14_MANIFEST_IDENTITY_SHA256, M3_R14_RESEARCH_ROUND_ID, M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256, readR14Identity } from "./m3-r14-round-014-identity.ts";
import { stableStringify } from "./utils.ts";

export const R14_OBSERVATION_FREEZE_SCHEMA_VERSION = "m3-r14-round-014-observation-freeze-001" as const;
export const R14_OBSERVATION_DATA_RELATIVE_PATH = ".cache/tradepulse/round-014/observations.ndjson" as const;
export const R14_OBSERVATION_FREEZE_PATH = path.join("docs", "research", "round-014-observation-freeze.json");

const OBSERVATION_KEYS = Object.freeze(["observationId", "decisionTime", "symbol", "direction", "features", "atr14_1h", "labels", "latencyStressLabels"] as const);
const LABEL_STATUSES: readonly R13LabelStatus[] = ["EXECUTED", "NO_ENTRY", "DATA_INCOMPLETE", "PERIOD_END_CENSORED"];

export type R14ObservationFreezeManifest = Readonly<{
  schemaVersion: typeof R14_OBSERVATION_FREEZE_SCHEMA_VERSION;
  researchRoundId: typeof M3_R14_RESEARCH_ROUND_ID;
  replayOfResearchRoundId: typeof M3_R13_RESEARCH_ROUND_ID;
  sourceDatasetSha256: typeof M3_R14_DATASET_IDENTITY_SHA256;
  sourceManifestIdentitySha256: string;
  scientificSpecIdentitySha256: typeof M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256;
  featureSpecSha256: string;
  modelSpecSha256: string;
  gateSha256: string;
  planSha256: string;
  researchBoundary: typeof M3_R13_RESEARCH_END_ISO;
  observationDataPath: typeof R14_OBSERVATION_DATA_RELATIVE_PATH;
  observationCount: number;
  warmupExcludedObservations: number;
  integrityExcludedObservations: 0;
  perSymbolCounts: Readonly<Record<ResearchSymbol, number>>;
  directionCounts: Readonly<Record<"LONG" | "SHORT", number>>;
  labelStatusCountsByHorizon: Readonly<Record<"4" | "8" | "12" | "24", Readonly<Record<R13LabelStatus, number>>>>;
  observationDataBytes: number;
  observationDataSha256: string;
  noFutureInformationLeakage: true;
  frozen: true;
  manifestSha256: string;
}>;

export type R14ObservationScan = Readonly<{
  observationCount: number;
  perSymbolCounts: Readonly<Record<ResearchSymbol, number>>;
  directionCounts: Readonly<Record<"LONG" | "SHORT", number>>;
  labelStatusCountsByHorizon: Readonly<Record<"4" | "8" | "12" | "24", Readonly<Record<R13LabelStatus, number>>>>;
  observationDataBytes: number;
  observationDataSha256: string;
  firstObservationId: string | null;
  lastObservationId: string | null;
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r+");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function directionOrder(direction: R13Direction): number {
  return direction === "LONG" ? 0 : 1;
}

function emptyStatusCounts(): Record<R13LabelStatus, number> {
  return Object.fromEntries(LABEL_STATUSES.map((status) => [status, 0])) as Record<R13LabelStatus, number>;
}

function emptyLabelCounts(): Record<"4" | "8" | "12" | "24", Record<R13LabelStatus, number>> {
  return Object.fromEntries(R13_HORIZON_HOURS.map((horizon) => [String(horizon), emptyStatusCounts()])) as Record<"4" | "8" | "12" | "24", Record<R13LabelStatus, number>>;
}

function validateLabel(label: R13ForwardLabel, observation: R13Observation, horizon: number): void {
  if (label.symbol !== observation.symbol || label.direction !== observation.direction || label.signalTime !== observation.decisionTime || label.horizonHours !== horizon || !LABEL_STATUSES.includes(label.status)) throw new Error(`R14 observation label identity mismatch for ${observation.observationId}.`);
  if (!Number.isSafeInteger(label.actionableAt) || label.actionableAt < observation.decisionTime || label.signalValidUntil !== observation.decisionTime + 60 * 60_000) throw new Error(`R14 observation label timing mismatch for ${observation.observationId}.`);
  if (label.status === "EXECUTED" && (label.netForwardAtr === null || !Number.isFinite(label.netForwardAtr))) throw new Error(`R14 executed label is non-finite for ${observation.observationId}.`);
}

export function validateR14Observation(value: unknown): R13Observation {
  if (typeof value !== "object" || value === null) throw new Error("R14 observation must be an object.");
  const observation = value as R13Observation;
  if (stableStringify(Object.keys(observation).sort()) !== stableStringify([...OBSERVATION_KEYS].sort())) throw new Error("R14 observation contains fields outside the frozen observation schema.");
  if (!Number.isSafeInteger(observation.decisionTime) || observation.decisionTime < 0 || observation.decisionTime > Date.parse(M3_R13_RESEARCH_END_ISO)) throw new Error("R14 observation decisionTime is invalid.");
  if (!R13_SYMBOLS.includes(observation.symbol) || !["LONG", "SHORT"].includes(observation.direction)) throw new Error("R14 observation symbol or direction is invalid.");
  if (observation.observationId !== `${observation.decisionTime}|${observation.symbol}|${observation.direction}`) throw new Error("R14 observation identity is not deterministic.");
  if (!Number.isFinite(observation.atr14_1h) || observation.atr14_1h <= 0) throw new Error(`R14 observation ATR is invalid for ${observation.observationId}.`);
  if (stableStringify(Object.keys(observation.features).sort()) !== stableStringify([...(awaitableFeatureNames())].sort())) throw new Error(`R14 observation feature identity mismatch for ${observation.observationId}.`);
  for (const value of Object.values(observation.features)) if (!Number.isFinite(value)) throw new Error(`R14 observation feature is non-finite for ${observation.observationId}.`);
  for (const horizon of R13_HORIZON_HOURS) {
    const label = observation.labels[horizon];
    const stress = observation.latencyStressLabels[horizon];
    if (!label || !stress) throw new Error(`R14 observation is missing H${horizon} labels.`);
    validateLabel(label, observation, horizon);
    validateLabel(stress, observation, horizon);
    if (stress.status === "EXECUTED" && (stress.netForwardAtr === null || !Number.isFinite(stress.netForwardAtr))) throw new Error(`R14 stress label is non-finite for ${observation.observationId}.`);
  }
  return observation;
}

// Kept as a function to make the schema check above independent of object key
// insertion order while avoiding a second copy of the frozen feature list.
function awaitableFeatureNames(): readonly string[] {
  // The import is static at module evaluation time; this helper only gives the
  // validation code a narrow, readable name for the fixed list.
  return R13_FEATURE_NAMES;
}

async function* readObservationLines(filePath: string): AsyncGenerator<R13Observation> {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (line.length === 0) throw new Error(`R14 observation line ${lineNumber} is empty.`);
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch (error) { throw new Error(`R14 observation line ${lineNumber} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
      yield validateR14Observation(parsed);
    }
  } finally {
    lines.close();
    input.destroy();
  }
}

export async function* streamR14Observations(filePath: string): AsyncGenerator<R13Observation> {
  yield* readObservationLines(path.resolve(filePath));
}

export async function scanR14ObservationFile(filePath: string): Promise<R14ObservationScan> {
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute)) throw new Error(`R14 observation data is missing: ${absolute}`);
  const stat = statSync(absolute);
  const perSymbol = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, 0])) as Record<ResearchSymbol, number>;
  const directionCounts = { LONG: 0, SHORT: 0 } as Record<"LONG" | "SHORT", number>;
  const labels = emptyLabelCounts();
  const seen = new Set<string>();
  let count = 0;
  let firstObservationId: string | null = null;
  let lastObservationId: string | null = null;
  let previous: R13Observation | null = null;
  for await (const observation of streamR14Observations(absolute)) {
    if (seen.has(observation.observationId)) throw new Error(`R14 observation duplicate: ${observation.observationId}`);
    if (previous && (observation.decisionTime < previous.decisionTime || (observation.decisionTime === previous.decisionTime && (R13_SYMBOLS.indexOf(observation.symbol) < R13_SYMBOLS.indexOf(previous.symbol) || (observation.symbol === previous.symbol && directionOrder(observation.direction) < directionOrder(previous.direction)))))) throw new Error("R14 observation ordering is not deterministic.");
    seen.add(observation.observationId);
    previous = observation;
    firstObservationId ??= observation.observationId;
    lastObservationId = observation.observationId;
    count += 1;
    perSymbol[observation.symbol] += 1;
    directionCounts[observation.direction] += 1;
    for (const horizon of R13_HORIZON_HOURS) labels[String(horizon) as "4" | "8" | "12" | "24"][observation.labels[horizon].status] += 1;
  }
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(absolute)) digest.update(chunk);
  return Object.freeze({ observationCount: count, perSymbolCounts: Object.freeze(perSymbol), directionCounts: Object.freeze(directionCounts), labelStatusCountsByHorizon: Object.freeze(Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, Object.freeze(value)])) as R14ObservationScan["labelStatusCountsByHorizon"]), observationDataBytes: stat.size, observationDataSha256: digest.digest("hex"), firstObservationId, lastObservationId });
}

function manifestWithoutHash(manifest: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { ...manifest, manifestSha256: null };
}

function validateManifestShape(manifest: R14ObservationFreezeManifest): void {
  if (manifest.schemaVersion !== R14_OBSERVATION_FREEZE_SCHEMA_VERSION || manifest.researchRoundId !== M3_R14_RESEARCH_ROUND_ID || manifest.replayOfResearchRoundId !== M3_R13_RESEARCH_ROUND_ID || manifest.sourceDatasetSha256 !== M3_R14_DATASET_IDENTITY_SHA256 || manifest.scientificSpecIdentitySha256 !== M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256 || manifest.researchBoundary !== M3_R13_RESEARCH_END_ISO || manifest.observationDataPath !== R14_OBSERVATION_DATA_RELATIVE_PATH || manifest.integrityExcludedObservations !== 0 || manifest.noFutureInformationLeakage !== true || manifest.frozen !== true) throw new Error("R14 observation freeze provenance or integrity boundary failed.");
  if (manifest.sourceManifestIdentitySha256 !== M3_R14_MANIFEST_IDENTITY_SHA256 || manifest.featureSpecSha256 !== R13_FEATURE_SPEC_SHA256 || manifest.modelSpecSha256 !== R13_MODEL_SPEC_SHA256 || manifest.gateSha256 !== R13_SELECTION_GATE_SHA256 || manifest.planSha256 !== R13_PLAN_SHA256 || R13_PLAN.researchBoundary !== manifest.researchBoundary) throw new Error("R14 observation freeze scientific identity mismatch.");
  if (manifest.manifestSha256 !== hash(manifestWithoutHash(manifest as unknown as Readonly<Record<string, unknown>>))) throw new Error("R14 observation freeze manifest checksum mismatch.");
}

export function readR14ObservationFreeze(root = process.cwd()): R14ObservationFreezeManifest {
  const filePath = path.join(root, R14_OBSERVATION_FREEZE_PATH);
  if (!existsSync(filePath)) throw new Error(`R14 observation freeze manifest is missing: ${filePath}`);
  const manifest = JSON.parse(readFileSync(filePath, "utf8")) as R14ObservationFreezeManifest;
  validateManifestShape(manifest);
  return manifest;
}

export async function verifyR14ObservationFreeze(root = process.cwd()): Promise<Readonly<{ manifest: R14ObservationFreezeManifest; scan: R14ObservationScan }>> {
  const manifest = readR14ObservationFreeze(root);
  const scan = await scanR14ObservationFile(path.resolve(root, manifest.observationDataPath));
  if (scan.observationCount !== manifest.observationCount || scan.observationDataBytes !== manifest.observationDataBytes || scan.observationDataSha256 !== manifest.observationDataSha256 || stableStringify(scan.perSymbolCounts) !== stableStringify(manifest.perSymbolCounts) || stableStringify(scan.directionCounts) !== stableStringify(manifest.directionCounts) || stableStringify(scan.labelStatusCountsByHorizon) !== stableStringify(manifest.labelStatusCountsByHorizon)) throw new Error("R14 observation freeze data does not match its committed manifest.");
  return Object.freeze({ manifest, scan });
}

async function writeObservationStream(filePath: string, observations: AsyncIterable<R13Observation>): Promise<Readonly<{ bytes: number; sha256: string }>> {
  const stream = createWriteStream(filePath, { encoding: "utf8" });
  const digest = createHash("sha256");
  let bytes = 0;
  try {
    for await (const observation of observations) {
      const line = `${stableStringify(observation)}\n`;
      const encoded = Buffer.from(line, "utf8");
      digest.update(encoded);
      bytes += encoded.byteLength;
      if (!stream.write(line, "utf8")) await once(stream, "drain");
    }
    await new Promise<void>((resolve, reject) => { stream.once("finish", resolve); stream.once("error", reject); stream.end(); });
    fsyncFile(filePath);
  } catch (error) {
    stream.destroy();
    throw error;
  }
  return Object.freeze({ bytes, sha256: digest.digest("hex") });
}

function writeManifestAtomic(root: string, manifest: R14ObservationFreezeManifest): void {
  const target = path.join(root, R14_OBSERVATION_FREEZE_PATH);
  if (existsSync(target)) throw new Error(`R14 observation freeze manifest already exists: ${target}`);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r14-manifest-staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(manifest), "utf8");
    fsyncFile(temporary);
    renameSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export async function materializeR14ObservationFreeze(input: Readonly<{
  root?: string;
  cacheDirectory?: string;
  acceptedCoarseCacheDirectory?: string;
}> = {}): Promise<R14ObservationFreezeManifest> {
  const root = path.resolve(input.root ?? process.cwd());
  readR14Identity(path.join(root, M3_R14_IDENTITY_PATH));
  const targetData = path.resolve(root, R14_OBSERVATION_DATA_RELATIVE_PATH);
  const manifestPath = path.join(root, R14_OBSERVATION_FREEZE_PATH);
  if (existsSync(manifestPath) || existsSync(targetData)) {
    if (!existsSync(manifestPath) || !existsSync(targetData)) throw new Error("R14 observation freeze is partially present; refusing to overwrite it.");
    return readR14ObservationFreeze(root);
  }
  const cacheDirectory = path.resolve(input.cacheDirectory ?? R13_DEFAULT_CACHE_DIRECTORY);
  const acceptedCoarseCacheDirectory = input.acceptedCoarseCacheDirectory ?? locateAcceptedRound006Cache(root);
  if (!acceptedCoarseCacheDirectory) throw new Error("R14 cannot locate the accepted Round-006 coarse cache.");
  const committedDatasetFreeze = JSON.parse(readFileSync(path.join(root, "docs", "research", "round-013-dataset-freeze.json"), "utf8")) as Readonly<Record<string, unknown>>;
  const prepared = await prepareR13Dataset({ cacheDirectory, acceptedCoarseCacheDirectory, fetchMissingOneMinute: false, oneMinuteNetworkMode: "ALL_NETWORK_DISABLED", fundingNetworkMode: "ALL_NETWORK_DISABLED" });
  if (stableStringify(prepared.datasetFreeze) !== stableStringify(committedDatasetFreeze)) throw new Error("R14 source dataset does not match the committed R13 dataset freeze.");
  if (prepared.datasetFreeze.datasetIdentitySha256 !== M3_R14_DATASET_IDENTITY_SHA256 || prepared.datasetFreeze.manifestIdentitySha256 !== committedDatasetFreeze.manifestIdentitySha256) throw new Error("R14 source dataset identity mismatch.");
  const dataDirectory = path.dirname(targetData);
  mkdirSync(dataDirectory, { recursive: true });
  const staging = mkdtempSync(path.join(dataDirectory, ".r14-observation-staging-"));
  const temporaryData = path.join(staging, "observations.ndjson");
  const perSymbol = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, 0])) as Record<ResearchSymbol, number>;
  const directionCounts = { LONG: 0, SHORT: 0 } as Record<"LONG" | "SHORT", number>;
  const labelCounts = emptyLabelCounts();
  const seen = new Set<string>();
  let warmupExcludedObservations = 0;
  let eligibleObservations = 0;
  let warmedUp = false;
  const times = [...new Set((prepared.coarseData.datasets.BTCUSDT?.candles1h ?? []).filter((candle) => candle.closeTime <= Date.parse(M3_R13_RESEARCH_END_ISO)).map((candle) => candle.closeTime))].sort((left, right) => left - right);
  const indexedInput = { data: prepared.coarseData, oneMinute: prepared.oneMinuteIndexed } as Readonly<{ data: BacktestData; oneMinute: Readonly<Record<ResearchSymbol, R13OneMinuteIndexedSeries>> }>;
  async function* observations(): AsyncGenerator<R13Observation> {
    for (const signalTime of times) {
      const atTime: R13Observation[] = [];
      const failures: string[] = [];
      for (const symbol of R13_SYMBOLS) for (const direction of ["LONG", "SHORT"] as const) {
        try { atTime.push(buildR13Observation({ ...indexedInput, symbol, direction, signalTime })); }
        catch (error) { failures.push(`${symbol}/${direction}: ${error instanceof Error ? error.message : String(error)}`); }
      }
      if (failures.length > 0) {
        if (warmedUp) throw new Error(`R14 observation integrity failure after warmup at ${signalTime}: ${failures.join("; ")}`);
        warmupExcludedObservations += failures.length;
        continue;
      }
      warmedUp = true;
      eligibleObservations += atTime.length;
      for (const observation of atTime) {
        validateR14Observation(observation);
        if (seen.has(observation.observationId)) throw new Error(`R14 observation duplicate during materialization: ${observation.observationId}`);
        seen.add(observation.observationId);
        perSymbol[observation.symbol] += 1;
        directionCounts[observation.direction] += 1;
        for (const horizon of R13_HORIZON_HOURS) labelCounts[String(horizon) as "4" | "8" | "12" | "24"][observation.labels[horizon].status] += 1;
        yield observation;
      }
    }
  }
  try {
    const written = await writeObservationStream(temporaryData, observations());
    if (eligibleObservations !== seen.size) throw new Error("R14 observation count accounting mismatch.");
    fsyncFile(temporaryData);
    renameSync(temporaryData, targetData);
    const baseManifest = {
      schemaVersion: R14_OBSERVATION_FREEZE_SCHEMA_VERSION,
      researchRoundId: M3_R14_RESEARCH_ROUND_ID,
      replayOfResearchRoundId: M3_R13_RESEARCH_ROUND_ID,
      sourceDatasetSha256: M3_R14_DATASET_IDENTITY_SHA256,
      sourceManifestIdentitySha256: String(committedDatasetFreeze.manifestIdentitySha256),
      scientificSpecIdentitySha256: M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256,
      featureSpecSha256: String(committedDatasetFreeze.featureSpecSha256),
      modelSpecSha256: String(committedDatasetFreeze.modelSpecSha256),
      gateSha256: String(committedDatasetFreeze.gateSha256),
      planSha256: String(committedDatasetFreeze.planSha256),
      researchBoundary: M3_R13_RESEARCH_END_ISO,
      observationDataPath: R14_OBSERVATION_DATA_RELATIVE_PATH,
      observationCount: eligibleObservations,
      warmupExcludedObservations,
      integrityExcludedObservations: 0 as const,
      perSymbolCounts: Object.freeze(perSymbol),
      directionCounts: Object.freeze(directionCounts),
      labelStatusCountsByHorizon: Object.freeze(Object.fromEntries(Object.entries(labelCounts).map(([key, value]) => [key, Object.freeze(value)]))),
      observationDataBytes: written.bytes,
      observationDataSha256: written.sha256,
      noFutureInformationLeakage: true as const,
      frozen: true as const,
    };
    const manifest = Object.freeze({ ...baseManifest, manifestSha256: hash(manifestWithoutHash({ ...baseManifest, manifestSha256: null })) }) as R14ObservationFreezeManifest;
    writeManifestAtomic(root, manifest);
    return manifest;
  } catch (error) {
    if (existsSync(targetData)) rmSync(targetData, { force: true });
    throw error;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export { hash as r14ObservationHash };
