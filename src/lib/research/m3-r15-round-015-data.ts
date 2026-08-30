import { createHash } from "node:crypto";
import { closeSync, createReadStream, createWriteStream, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { createInterface } from "node:readline";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import type { R13ForwardLabel } from "./m3-r13-round-013-labels.ts";
import { validateR14Observation } from "./m3-r14-round-014-observations.ts";
import type { R13Observation } from "./m3-r13-round-013-performance.ts";
import {
  R15_ALPHA_FEATURE_NAMES,
  R15_BETA_FEATURE_NAMES,
  R15_DIRECTIONS,
  R15_OBSERVATION_DATA_PATH,
  R15_OBSERVATION_FREEZE_PATH,
  R15_SOURCE_OBSERVATION_SHA256,
  R15_SYMBOLS,
  type R15AlphaFeatureName,
  type R15BetaFeatureName,
  type R15Direction,
} from "./m3-r15-round-015-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R15_OBSERVATION_SCHEMA_VERSION = "m3-r15-round-015-observation-001" as const;
export const R15_OBSERVATION_FREEZE_SCHEMA_VERSION = "m3-r15-round-015-observation-freeze-001" as const;

export type R15FeatureRecord<N extends string> = Readonly<Record<N, number>>;

export type R15FrozenLabel = Readonly<{
  status: "EXECUTED";
  netForwardAtr: number;
  netForwardAtrCostStress: number;
  feesBps: number;
  fundingBps: number;
  slippageBps: number;
  latencyStressNetForwardAtr: number;
  latencyStressNetForwardAtrCostStress: number;
}>;

export type R15FrozenObservation = Readonly<{
  schemaVersion: typeof R15_OBSERVATION_SCHEMA_VERSION;
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R15Direction;
  betaFeatures: R15FeatureRecord<R15BetaFeatureName>;
  alphaFeatures: R15FeatureRecord<R15AlphaFeatureName>;
  marketBetaTarget: number;
  relativeAlphaTarget: number;
  symbolTarget: number;
  label: R15FrozenLabel;
}>;

export type R15ObservationFreezeManifest = Readonly<{
  schemaVersion: typeof R15_OBSERVATION_FREEZE_SCHEMA_VERSION;
  researchRoundId: "baseline-002-research-round-015";
  sourceObservationPath: ".cache/tradepulse/round-014/observations.ndjson";
  sourceDatasetSha256: "cf836dd3344ef4a896c7a9520c65a648c19f2fa25f5f849ea6ab4e9050d32e26";
  sourceManifestSha256: "2ffa7eda3a53edfeaa2e4443812c4380d0a15dd581442eec47e3f8cd82557175";
  sourceObservationSha256: typeof R15_SOURCE_OBSERVATION_SHA256;
  observationDataPath: typeof R15_OBSERVATION_DATA_PATH;
  observationDataSha256: string;
  observationDataBytes: number;
  observationCount: number;
  completeDecisionTimeCount: number;
  excludedIncompleteDecisionTimeCount: number;
  betaTrainingRowCount: number;
  alphaTrainingRowCount: number;
  symbols: readonly ResearchSymbol[];
  directions: readonly R15Direction[];
  horizonHours: 4;
  researchBoundary: "2026-08-15T23:59:59.999Z";
  purgeEmbargoHours: 24;
  noFutureInformationLeakage: true;
  integrityErrors: readonly [];
  integrity: "COMPLETE";
  frozen: true;
  manifestSha256: string;
}>;

export type R15TargetDecomposition = Readonly<{
  marketBetaTarget: number;
  relativeAlphaTarget: number;
  symbolTarget: number;
  originalNetForwardAtr: number;
}>;

export function r15TargetReconstructionTolerance(input: Readonly<Omit<R15TargetDecomposition, "originalNetForwardAtr">>): number {
  return 16 * Number.EPSILON * Math.max(1, Math.abs(input.marketBetaTarget), Math.abs(input.relativeAlphaTarget), Math.abs(input.symbolTarget));
}

export function isR15TargetDecompositionValid(input: R15TargetDecomposition): boolean {
  if (![input.marketBetaTarget, input.relativeAlphaTarget, input.symbolTarget, input.originalNetForwardAtr].every(Number.isFinite)) return false;
  const tolerance = r15TargetReconstructionTolerance(input);
  const reconstructedDifference = input.marketBetaTarget + input.relativeAlphaTarget - input.symbolTarget;
  const frozenLabelDifference = input.symbolTarget - input.originalNetForwardAtr;
  return Math.abs(reconstructedDifference) <= tolerance && Math.abs(frozenLabelDifference) <= tolerance;
}

type SourceGroup = Readonly<{ decisionTime: number; byDirection: Readonly<Record<R15Direction, ReadonlyMap<ResearchSymbol, R13Observation>>> }>;

const SOURCE_TO_BETA = Object.freeze({
  B01_directionAdjustedBtcReturn1hAtrPriceScale: "F04_directionAdjustedReturn1hAtrPriceScale",
  B02_directionAdjustedBtcReturn4hAtrPriceScale: "F07_directionAdjustedReturn4hAtrPriceScale",
  B03_directionAdjustedBtcReturn12hAtrPriceScale: "F08_directionAdjustedReturn12hAtrPriceScale",
  B04_directionAdjustedBtcEma20MinusEma50Atr: "F05_directionAdjustedEma20MinusEma50Atr",
  B05_directionAdjustedBtcEma50MinusEma200Atr: "F02_directionAdjustedEma50MinusEma200Atr",
  B06_btcAtrPercentile30d: "F11_rollingAtrPricePercentile30d",
  B07_directionAdjustedBtcTakerImbalance: "F13_directionAdjustedTakerImbalance",
  B08_directionAdjustedBtcSettledFundingBurden: "F16_directionAdjustedSettledFundingBurden",
  B09_directionAdjustedFiveSymbolEma50Breadth: "F17_directionAdjustedEma50Breadth",
  B10_directionAdjustedFiveSymbolPositive12hBreadth: "F18_directionAdjustedMomentumBreadth12h",
} as const);

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const digest = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(digest.digest("hex")));
  });
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r+");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("R15 median requires at least one value.");
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)]!;
}

function sourceFeature(observation: R13Observation, name: string): number {
  const value = observation.features[name as keyof typeof observation.features];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`R15 source feature ${name} is unavailable.`);
  return value;
}

function requireExecutedLabel(label: R13ForwardLabel, observationId: string): void {
  if (label.status !== "EXECUTED" || label.netForwardAtr === null || !Number.isFinite(label.netForwardAtr) || label.netForwardAtrCostStress === null || !Number.isFinite(label.netForwardAtrCostStress) || label.feesBps === null || !Number.isFinite(label.feesBps) || label.fundingBps === null || !Number.isFinite(label.fundingBps) || label.slippageBps === null || !Number.isFinite(label.slippageBps)) throw new Error(`R15 H4 target is not complete for ${observationId}.`);
}

function frozenLabel(observation: R13Observation): R15FrozenLabel {
  const primary = observation.labels[4];
  const stress = observation.latencyStressLabels[4];
  requireExecutedLabel(primary, observation.observationId);
  requireExecutedLabel(stress, observation.observationId);
  return Object.freeze({ status: "EXECUTED", netForwardAtr: primary.netForwardAtr!, netForwardAtrCostStress: primary.netForwardAtrCostStress!, feesBps: primary.feesBps!, fundingBps: primary.fundingBps!, slippageBps: primary.slippageBps!, latencyStressNetForwardAtr: stress.netForwardAtr!, latencyStressNetForwardAtrCostStress: stress.netForwardAtrCostStress! });
}

function buildBetaFeatures(btc: R13Observation): R15FeatureRecord<R15BetaFeatureName> {
  const values = Object.fromEntries(R15_BETA_FEATURE_NAMES.map((name) => [name, sourceFeature(btc, SOURCE_TO_BETA[name])])) as Record<R15BetaFeatureName, number>;
  return Object.freeze(values);
}

function scale(observation: R13Observation): number {
  const value = sourceFeature(observation, "F10_atr14OverClose1h");
  if (!(value > 0)) throw new Error(`R15 ATR-price scale is invalid for ${observation.observationId}.`);
  return value;
}

function buildRelativeRawFeatures(observation: R13Observation, btc: R13Observation): Readonly<{ a01: number; a02: number; a03: number; a04: number; a05: number; a06: number; a07: number; a08: number; a09: number; a10: number }> {
  const symbolScale = scale(observation);
  const btcScale = scale(btc);
  const f04 = sourceFeature(observation, "F04_directionAdjustedReturn1hAtrPriceScale");
  const f07 = sourceFeature(observation, "F07_directionAdjustedReturn4hAtrPriceScale");
  const f08 = sourceFeature(observation, "F08_directionAdjustedReturn12hAtrPriceScale");
  const f15 = sourceFeature(observation, "F15_directionAdjustedSymbolMinusBtcReturn24h");
  return {
    a01: f04 - sourceFeature(btc, "F04_directionAdjustedReturn1hAtrPriceScale") * btcScale / symbolScale,
    a02: f07 - sourceFeature(btc, "F07_directionAdjustedReturn4hAtrPriceScale") * btcScale / symbolScale,
    a03: f08 - sourceFeature(btc, "F08_directionAdjustedReturn12hAtrPriceScale") * btcScale / symbolScale,
    a04: f15 / symbolScale,
    a05: sourceFeature(observation, "F09_directionAdjustedClose1hMinusEma20Atr"),
    a06: sourceFeature(observation, "F05_directionAdjustedEma20MinusEma50Atr"),
    a07: sourceFeature(observation, "F11_rollingAtrPricePercentile30d"),
    a08: sourceFeature(observation, "F12_logClippedQuoteVolumeOverPast20hMedian"),
    a09: sourceFeature(observation, "F13_directionAdjustedTakerImbalance"),
    a10: sourceFeature(observation, "F16_directionAdjustedSettledFundingBurden"),
  };
}

function buildAlphaFeatures(observation: R13Observation, btc: R13Observation, directionRows: readonly R13Observation[]): R15FeatureRecord<R15AlphaFeatureName> {
  const raw = buildRelativeRawFeatures(observation, btc);
  const directionBtc = directionRows.find((value) => value.symbol === "BTCUSDT");
  if (!directionBtc) throw new Error("R15 alpha cross-section is missing BTCUSDT.");
  const medians = {
    A05_directionAdjustedEma20ExtensionAtrMinusMedian: median(directionRows.map((row) => buildRelativeRawFeatures(row, directionBtc).a05)),
    A06_directionAdjustedEma20MinusEma50AtrMinusMedian: median(directionRows.map((row) => buildRelativeRawFeatures(row, directionBtc).a06)),
    A07_atrPercentile30dMinusMedian: median(directionRows.map((row) => buildRelativeRawFeatures(row, directionBtc).a07)),
    A08_logVolumeRatioMinusMedian: median(directionRows.map((row) => buildRelativeRawFeatures(row, directionBtc).a08)),
    A09_directionAdjustedTakerImbalanceMinusMedian: median(directionRows.map((row) => buildRelativeRawFeatures(row, directionBtc).a09)),
    A10_directionAdjustedSettledFundingBurdenMinusMedian: median(directionRows.map((row) => buildRelativeRawFeatures(row, directionBtc).a10)),
  };
  const values = {
    A01_directionAdjustedSymbolMinusBtcReturn1hAtrPriceScale: raw.a01,
    A02_directionAdjustedSymbolMinusBtcReturn4hAtrPriceScale: raw.a02,
    A03_directionAdjustedSymbolMinusBtcReturn12hAtrPriceScale: raw.a03,
    A04_directionAdjustedSymbolMinusBtcReturn24hAtrPriceScale: raw.a04,
    A05_directionAdjustedEma20ExtensionAtrMinusMedian: raw.a05 - medians.A05_directionAdjustedEma20ExtensionAtrMinusMedian!,
    A06_directionAdjustedEma20MinusEma50AtrMinusMedian: raw.a06 - medians.A06_directionAdjustedEma20MinusEma50AtrMinusMedian!,
    A07_atrPercentile30dMinusMedian: raw.a07 - medians.A07_atrPercentile30dMinusMedian!,
    A08_logVolumeRatioMinusMedian: raw.a08 - medians.A08_logVolumeRatioMinusMedian!,
    A09_directionAdjustedTakerImbalanceMinusMedian: raw.a09 - medians.A09_directionAdjustedTakerImbalanceMinusMedian!,
    A10_directionAdjustedSettledFundingBurdenMinusMedian: raw.a10 - medians.A10_directionAdjustedSettledFundingBurdenMinusMedian!,
  } as Record<R15AlphaFeatureName, number>;
  return Object.freeze(values);
}

function buildGroup(group: SourceGroup): readonly R15FrozenObservation[] {
  const output: R15FrozenObservation[] = [];
  for (const direction of R15_DIRECTIONS) {
    const rows = group.byDirection[direction];
    if (rows.size !== R15_SYMBOLS.length || R15_SYMBOLS.some((symbol) => !rows.has(symbol))) continue;
    const ordered = R15_SYMBOLS.map((symbol) => rows.get(symbol)!);
    if (ordered.some((row) => row.labels[4].status !== "EXECUTED" || row.latencyStressLabels[4].status !== "EXECUTED")) continue;
    const targets = ordered.map((row) => row.labels[4].netForwardAtr);
    if (targets.some((value) => value === null || !Number.isFinite(value))) continue;
    const beta = median(targets as number[]);
    const btc = ordered.find((row) => row.symbol === "BTCUSDT")!;
    const betaFeatures = buildBetaFeatures(btc);
    const alphaFeatures = ordered.map((row) => buildAlphaFeatures(row, btc, ordered));
    for (let index = 0; index < ordered.length; index += 1) {
      const row = ordered[index]!;
      const symbolTarget = targets[index]!;
      const frozen: R15FrozenObservation = Object.freeze({ schemaVersion: R15_OBSERVATION_SCHEMA_VERSION, observationId: row.observationId, decisionTime: row.decisionTime, symbol: row.symbol, direction: row.direction, betaFeatures, alphaFeatures: alphaFeatures[index]!, marketBetaTarget: beta, relativeAlphaTarget: symbolTarget - beta, symbolTarget, label: frozenLabel(row) });
      output.push(frozen);
    }
  }
  return output;
}

function validateR15Observation(value: unknown): R15FrozenObservation {
  if (typeof value !== "object" || value === null) throw new Error("R15 frozen observation must be an object.");
  const observation = value as R15FrozenObservation;
  if (stableStringify(Object.keys(observation).sort()) !== stableStringify(["schemaVersion", "observationId", "decisionTime", "symbol", "direction", "betaFeatures", "alphaFeatures", "marketBetaTarget", "relativeAlphaTarget", "symbolTarget", "label"].sort())) throw new Error("R15 frozen observation schema mismatch.");
  if (observation.schemaVersion !== R15_OBSERVATION_SCHEMA_VERSION || observation.observationId !== `${observation.decisionTime}|${observation.symbol}|${observation.direction}` || !Number.isSafeInteger(observation.decisionTime) || !R15_SYMBOLS.includes(observation.symbol) || !R15_DIRECTIONS.includes(observation.direction)) throw new Error(`R15 frozen observation identity is invalid: ${observation.observationId}`);
  for (const name of R15_BETA_FEATURE_NAMES) if (!Number.isFinite(observation.betaFeatures[name])) throw new Error(`R15 beta feature is invalid: ${observation.observationId}`);
  for (const name of R15_ALPHA_FEATURE_NAMES) if (!Number.isFinite(observation.alphaFeatures[name])) throw new Error(`R15 alpha feature is invalid: ${observation.observationId}`);
  for (const value of [observation.marketBetaTarget, observation.relativeAlphaTarget, observation.symbolTarget, observation.label.netForwardAtr, observation.label.netForwardAtrCostStress, observation.label.feesBps, observation.label.fundingBps, observation.label.slippageBps, observation.label.latencyStressNetForwardAtr, observation.label.latencyStressNetForwardAtrCostStress]) if (!Number.isFinite(value)) throw new Error(`R15 frozen value is invalid: ${observation.observationId}`);
  if (observation.label.status !== "EXECUTED" || !isR15TargetDecompositionValid({ marketBetaTarget: observation.marketBetaTarget, relativeAlphaTarget: observation.relativeAlphaTarget, symbolTarget: observation.symbolTarget, originalNetForwardAtr: observation.label.netForwardAtr })) throw new Error(`R15 target reconstruction failed: ${observation.observationId}`);
  return observation;
}

async function* readSourceObservations(filePath: string): AsyncGenerator<R13Observation> {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!line) throw new Error(`R15 source observation line ${lineNumber} is empty.`);
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch (error) { throw new Error(`R15 source observation line ${lineNumber} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
      yield validateR14Observation(parsed);
    }
  } finally {
    lines.close();
    input.destroy();
  }
}

async function writeObservationStream(filePath: string, observations: AsyncIterable<R15FrozenObservation>): Promise<Readonly<{ bytes: number; sha256: string; count: number }>> {
  const stream = createWriteStream(filePath, { encoding: "utf8" });
  const digest = createHash("sha256");
  let bytes = 0;
  let count = 0;
  try {
    for await (const observation of observations) {
      const line = `${stableStringify(observation)}\n`;
      const encoded = Buffer.from(line, "utf8");
      digest.update(encoded);
      bytes += encoded.byteLength;
      count += 1;
      if (!stream.write(line, "utf8")) await once(stream, "drain");
    }
    await new Promise<void>((resolve, reject) => { stream.once("finish", resolve); stream.once("error", reject); stream.end(); });
    fsyncFile(filePath);
  } catch (error) {
    stream.destroy();
    throw error;
  }
  return Object.freeze({ bytes, sha256: digest.digest("hex"), count });
}

function manifestWithoutHash(manifest: R15ObservationFreezeManifest): Readonly<Record<string, unknown>> {
  return { ...manifest, manifestSha256: null };
}

function writeManifestAtomic(root: string, manifest: R15ObservationFreezeManifest): void {
  const target = path.join(root, R15_OBSERVATION_FREEZE_PATH);
  mkdirSync(path.dirname(target), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(target), ".r15-observation-freeze-staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(manifest), "utf8");
    fsyncFile(temporary);
    if (existsSync(target)) throw new Error(`R15 observation freeze manifest appeared during publication: ${target}`);
    renameSync(temporary, target);
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function validateR15FrozenObservation(value: unknown): R15FrozenObservation {
  return validateR15Observation(value);
}

export function deriveR15GroupForTest(input: Readonly<{ decisionTime: number; rows: readonly R13Observation[] }>): readonly R15FrozenObservation[] {
  const byDirection = { LONG: new Map<ResearchSymbol, R13Observation>(), SHORT: new Map<ResearchSymbol, R13Observation>() } as Record<R15Direction, Map<ResearchSymbol, R13Observation>>;
  for (const row of input.rows) byDirection[row.direction].set(row.symbol, row);
  return buildGroup({ decisionTime: input.decisionTime, byDirection });
}

export async function* streamR15Observations(filePath: string): AsyncGenerator<R15FrozenObservation> {
  const input = createReadStream(path.resolve(filePath), { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) yield validateR15Observation(JSON.parse(line));
  } finally {
    lines.close();
    input.destroy();
  }
}

export async function scanR15ObservationFile(filePath: string): Promise<Readonly<{ count: number; bytes: number; sha256: string; decisionTimeCount: number; firstObservationId: string | null; lastObservationId: string | null }>> {
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute)) throw new Error(`R15 observation data is missing: ${absolute}`);
  let count = 0;
  let firstObservationId: string | null = null;
  let lastObservationId: string | null = null;
  let previous: R15FrozenObservation | null = null;
  const times = new Set<number>();
  for await (const observation of streamR15Observations(absolute)) {
    if (previous && (observation.decisionTime < previous.decisionTime || (observation.decisionTime === previous.decisionTime && (observation.direction < previous.direction || (observation.direction === previous.direction && R15_SYMBOLS.indexOf(observation.symbol) <= R15_SYMBOLS.indexOf(previous.symbol)))))) throw new Error("R15 observation order is not deterministic.");
    if (previous && previous.observationId === observation.observationId) throw new Error("R15 observation identity is duplicated.");
    previous = observation;
    firstObservationId ??= observation.observationId;
    lastObservationId = observation.observationId;
    times.add(observation.decisionTime);
    count += 1;
  }
  return Object.freeze({ count, bytes: statSync(absolute).size, sha256: await hashFile(absolute), decisionTimeCount: times.size, firstObservationId, lastObservationId });
}

export function readR15ObservationFreeze(root = process.cwd()): R15ObservationFreezeManifest {
  const filePath = path.join(root, R15_OBSERVATION_FREEZE_PATH);
  if (!existsSync(filePath)) throw new Error(`R15 observation freeze manifest is missing: ${filePath}`);
  const manifest = JSON.parse(readFileSync(filePath, "utf8")) as R15ObservationFreezeManifest;
  if (manifest.schemaVersion !== R15_OBSERVATION_FREEZE_SCHEMA_VERSION || manifest.sourceDatasetSha256 !== "cf836dd3344ef4a896c7a9520c65a648c19f2fa25f5f849ea6ab4e9050d32e26" || manifest.sourceManifestSha256 !== "2ffa7eda3a53edfeaa2e4443812c4380d0a15dd581442eec47e3f8cd82557175" || manifest.sourceObservationSha256 !== R15_SOURCE_OBSERVATION_SHA256 || manifest.integrity !== "COMPLETE" || manifest.frozen !== true || manifest.noFutureInformationLeakage !== true || manifest.horizonHours !== 4 || manifest.purgeEmbargoHours !== 24 || manifest.integrityErrors.length !== 0 || manifest.manifestSha256 !== hashValue(manifestWithoutHash(manifest))) throw new Error("R15 observation freeze manifest integrity failed.");
  return manifest;
}

export async function verifyR15ObservationFreeze(root = process.cwd()): Promise<Readonly<{ manifest: R15ObservationFreezeManifest; scan: Awaited<ReturnType<typeof scanR15ObservationFile>> }>> {
  const manifest = readR15ObservationFreeze(root);
  const scan = await scanR15ObservationFile(path.join(root, manifest.observationDataPath));
  if (scan.count !== manifest.observationCount || scan.bytes !== manifest.observationDataBytes || scan.sha256 !== manifest.observationDataSha256 || scan.decisionTimeCount !== manifest.completeDecisionTimeCount) throw new Error("R15 observation freeze data does not match its manifest.");
  return Object.freeze({ manifest, scan });
}

export async function materializeR15ObservationFreeze(input: Readonly<{ root?: string; sourceObservationFile: string }>): Promise<R15ObservationFreezeManifest> {
  const root = path.resolve(input.root ?? process.cwd());
  const sourceFile = path.resolve(input.sourceObservationFile);
  if (!existsSync(sourceFile)) throw new Error(`R15 source R14 observation file is missing: ${sourceFile}`);
  const sourceSha = await hashFile(sourceFile);
  if (sourceSha !== R15_SOURCE_OBSERVATION_SHA256) throw new Error(`R15 source observation SHA mismatch: ${sourceSha}`);
  const targetData = path.join(root, R15_OBSERVATION_DATA_PATH);
  const targetManifest = path.join(root, R15_OBSERVATION_FREEZE_PATH);
  if (existsSync(targetData) || existsSync(targetManifest)) return (await verifyR15ObservationFreeze(root)).manifest;
  mkdirSync(path.dirname(targetData), { recursive: true });
  const staging = mkdtempSync(path.join(path.dirname(targetData), ".r15-observation-staging-"));
  const temporaryData = path.join(staging, "observations.ndjson");
  let currentTime: number | null = null;
  const groups = { LONG: new Map<ResearchSymbol, R13Observation>(), SHORT: new Map<ResearchSymbol, R13Observation>() } as Record<R15Direction, Map<ResearchSymbol, R13Observation>>;
  let completeDecisionTimeCount = 0;
  let excludedIncompleteDecisionTimeCount = 0;
  let previousDecisionTime = Number.NEGATIVE_INFINITY;
  async function* derived(): AsyncGenerator<R15FrozenObservation> {
    async function* flush(): AsyncGenerator<R15FrozenObservation> {
      if (currentTime === null) return;
      const built = buildGroup({ decisionTime: currentTime, byDirection: groups });
      const complete = built.length === R15_SYMBOLS.length * R15_DIRECTIONS.length;
      if (complete) completeDecisionTimeCount += 1;
      else excludedIncompleteDecisionTimeCount += 1;
      if (complete) for (const row of built) yield row;
    }
    for await (const source of readSourceObservations(sourceFile)) {
      if (source.decisionTime < previousDecisionTime) throw new Error("R15 source observations are not chronological.");
      if (currentTime !== null && source.decisionTime !== currentTime) {
        yield* flush();
        groups.LONG.clear();
        groups.SHORT.clear();
      }
      currentTime = source.decisionTime;
      previousDecisionTime = source.decisionTime;
      groups[source.direction].set(source.symbol, source);
    }
    yield* flush();
  }
  let publishedData = false;
  try {
    const written = await writeObservationStream(temporaryData, derived());
    const manifestBase: Omit<R15ObservationFreezeManifest, "manifestSha256"> = {
      schemaVersion: R15_OBSERVATION_FREEZE_SCHEMA_VERSION,
      researchRoundId: "baseline-002-research-round-015",
      sourceObservationPath: ".cache/tradepulse/round-014/observations.ndjson",
      sourceDatasetSha256: "cf836dd3344ef4a896c7a9520c65a648c19f2fa25f5f849ea6ab4e9050d32e26",
      sourceManifestSha256: "2ffa7eda3a53edfeaa2e4443812c4380d0a15dd581442eec47e3f8cd82557175",
      sourceObservationSha256: R15_SOURCE_OBSERVATION_SHA256,
      observationDataPath: R15_OBSERVATION_DATA_PATH,
      observationDataSha256: written.sha256,
      observationDataBytes: written.bytes,
      observationCount: written.count,
      completeDecisionTimeCount,
      excludedIncompleteDecisionTimeCount,
      betaTrainingRowCount: completeDecisionTimeCount * R15_DIRECTIONS.length,
      alphaTrainingRowCount: written.count,
      symbols: R15_SYMBOLS,
      directions: R15_DIRECTIONS,
      horizonHours: 4,
      researchBoundary: "2026-08-15T23:59:59.999Z",
      purgeEmbargoHours: 24,
      noFutureInformationLeakage: true,
      integrityErrors: [],
      integrity: "COMPLETE",
      frozen: true,
    };
    const manifest = Object.freeze({ ...manifestBase, manifestSha256: hashValue({ ...manifestBase, manifestSha256: null }) }) as R15ObservationFreezeManifest;
    renameSync(temporaryData, targetData);
    publishedData = true;
    writeManifestAtomic(root, manifest);
    return manifest;
  } catch (error) {
    const cleanupErrors: string[] = [];
    if (publishedData && existsSync(targetData)) {
      try { unlinkSync(targetData); } catch (rollbackError) { cleanupErrors.push(`observation rollback: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); }
    }
    if (existsSync(staging)) {
      try { rmSync(staging, { recursive: true, force: true }); } catch (cleanupError) { cleanupErrors.push(`staging cleanup: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`); }
    }
    if (cleanupErrors.length > 0 && error instanceof Error) error.message = `${error.message}; ${cleanupErrors.join("; ")}`;
    throw error;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}
