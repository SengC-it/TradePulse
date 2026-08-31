import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { once } from "node:events";
import { createInterface } from "node:readline";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import { streamR14Observations } from "./m3-r14-round-014-observations.ts";
import { streamR15Observations, type R15FrozenObservation, type R15ObservationFreezeManifest } from "./m3-r15-round-015-data.ts";
import { R15_BETA_FEATURE_NAMES, R15_ALPHA_FEATURE_NAMES } from "./m3-r15-round-015-protocol.ts";
import {
  M3_R16_SOURCE_R14_OBSERVATION_SHA256,
  M3_R16_SOURCE_R15_OBSERVATION_SHA256,
  M3_R16_RESEARCH_END_ISO,
  R16_ALPHA_CONTROL_FEATURE_NAMES,
  R16_ALPHA_MICRO_FEATURE_NAMES,
  R16_BETA_CONTROL_FEATURE_NAMES,
  R16_BETA_MICRO_FEATURE_NAMES,
  R16_DEFAULT_CACHE_DIRECTORY,
  R16_BASIS_INTERVAL_MS,
  R16_METRICS_INTERVAL_MS,
  R16_OBSERVATION_DATA_PATH,
  R16_OBSERVATION_FREEZE_PATH,
  R16_PURGE_EMBARGO_HOURS,
  R16_SYMBOLS,
  r16DirectionSign,
  type R16AlphaMicroFeatureName,
  type R16BetaMicroFeatureName,
  type R16Direction,
} from "./m3-r16-round-016-protocol.ts";
import { loadR16MicroSeries, type R16BasisRow, type R16MetricRow, type R16MicroSeries } from "./m3-r16-round-016-archives.ts";
import { stableStringify } from "./utils.ts";

export const R16_OBSERVATION_SCHEMA_VERSION = "m3-r16-round-016-observation-001" as const;
export const R16_OBSERVATION_FREEZE_SCHEMA_VERSION = "m3-r16-round-016-observation-freeze-001" as const;

export type R16FeatureRecord<N extends string> = Readonly<Record<N, number>>;
export type R16MicroValue = Readonly<{
  oiChange1h: number;
  oiChange4h: number;
  oiChange12h: number;
  priceOiInteraction: number;
  basisNow: number;
  basisChange1h: number;
  basisChange4h: number;
  taker1h: number;
  taker3h: number;
  takerAcceleration: number;
}>;

export type R16Observation = Readonly<{
  schemaVersion: typeof R16_OBSERVATION_SCHEMA_VERSION;
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R16Direction;
  betaControlFeatures: R16FeatureRecord<(typeof R16_BETA_CONTROL_FEATURE_NAMES)[number]>;
  betaMicroFeatures: R16FeatureRecord<R16BetaMicroFeatureName>;
  alphaControlFeatures: R16FeatureRecord<(typeof R16_ALPHA_CONTROL_FEATURE_NAMES)[number]>;
  alphaMicroFeatures: R16FeatureRecord<R16AlphaMicroFeatureName>;
  marketBetaTarget: number;
  relativeAlphaTarget: number;
  symbolTarget: number;
  label: R15FrozenObservation["label"];
  foldEligibility: Readonly<Record<"F1" | "F2" | "F3" | "F4" | "F5" | "F6", Readonly<{ research: boolean; validation: boolean }>>>;
}>;

export type R16ExcludedDecisionTime = Readonly<{ decisionTime: number; reasons: readonly string[] }>;
export type R16ObservationFreezeManifest = Readonly<{
  schemaVersion: typeof R16_OBSERVATION_FREEZE_SCHEMA_VERSION;
  researchRoundId: "baseline-002-research-round-016";
  sourceR15ObservationSha256: typeof M3_R16_SOURCE_R15_OBSERVATION_SHA256;
  sourceR14ObservationSha256: typeof M3_R16_SOURCE_R14_OBSERVATION_SHA256;
  researchBoundary: typeof M3_R16_RESEARCH_END_ISO;
  microDataSha256: string;
  globalMaskSha256: string;
  observationDataPath: typeof R16_OBSERVATION_DATA_PATH;
  observationDataSha256: string;
  observationDataBytes: number;
  observationCount: number;
  decisionTimeCount: number;
  sourceDecisionTimeCount: number;
  pooledCoverage: number;
  coverageByFold: Readonly<Record<string, Readonly<{ sourceTrainingDecisionTimes: number; eligibleTrainingDecisionTimes: number; trainingCoverage: number; sourceValidationDecisionTimes: number; eligibleValidationDecisionTimes: number; validationCoverage: number }>>>;
  excludedDecisionTimes: readonly R16ExcludedDecisionTime[];
  integrityErrors: readonly string[];
  integrity: "COMPLETE" | "INCOMPLETE";
  frozen: true;
  manifestSha256: string;
}>;

type PriceReturnMap = ReadonlyMap<string, number>;

function hash(value: unknown): string { return createHash("sha256").update(stableStringify(value), "utf8").digest("hex"); }
export async function hashR16File(filePath: string): Promise<string> { return new Promise((resolve, reject) => { const digest = createHash("sha256"); const stream = createReadStream(path.resolve(filePath)); stream.on("data", (chunk) => digest.update(chunk)); stream.on("error", reject); stream.on("end", () => resolve(digest.digest("hex"))); }); }
function sameKeys(value: object, expected: readonly string[]): boolean { return stableStringify(Object.keys(value).sort()) === stableStringify([...expected].sort()); }
function median(values: readonly number[]): number { if (values.length === 0) throw new Error("R16 median requires values."); const ordered = [...values].sort((left, right) => left - right); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!; }
function finite(value: number, label: string): number { if (!Number.isFinite(value)) throw new Error(`R16 ${label} is non-finite.`); return value; }

export function locateR16R15ObservationFile(root = process.cwd()): string {
  const candidates = [process.env.TRADEPULSE_R15_OBSERVATION_FILE, path.join(root, ".cache", "tradepulse", "round-015", "observations.ndjson"), path.resolve(root, "..", "round-015-beta-alpha-decomposition", ".cache", "tradepulse", "round-015", "observations.ndjson")].filter((value): value is string => typeof value === "string" && value.length > 0);
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) throw new Error("R16_SOURCE_R15_OBSERVATION_MISSING: accepted Round-015 observation bytes are unavailable.");
  return path.resolve(file);
}

export function locateR16R14ObservationFile(root = process.cwd()): string {
  const candidates = [process.env.TRADEPULSE_R14_OBSERVATION_FILE, path.join(root, ".cache", "tradepulse", "round-014", "observations.ndjson"), path.resolve(root, "..", "round-014-r13-execution-replay", ".cache", "tradepulse", "round-014", "observations.ndjson")].filter((value): value is string => typeof value === "string" && value.length > 0);
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) throw new Error("R16_SOURCE_R14_OBSERVATION_MISSING: accepted Round-014 observation bytes are unavailable.");
  return path.resolve(file);
}

export async function verifyR16R15ObservationSource(root = process.cwd()): Promise<Readonly<{ path: string; sha256: string; manifest: R15ObservationFreezeManifest | null }>> {
  const file = locateR16R15ObservationFile(root);
  const digest = await hashR16File(file);
  if (digest !== M3_R16_SOURCE_R15_OBSERVATION_SHA256) throw new Error(`R16_SOURCE_R15_OBSERVATION_SHA_MISMATCH: expected ${M3_R16_SOURCE_R15_OBSERVATION_SHA256}, found ${digest}.`);
  const manifestPath = path.join(root, "docs", "research", "round-015-observation-freeze.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) as R15ObservationFreezeManifest : null;
  return Object.freeze({ path: file, sha256: digest, manifest });
}

async function loadR16PriceReturns(root: string): Promise<PriceReturnMap> {
  const file = locateR16R14ObservationFile(root);
  const digest = await hashR16File(file);
  if (digest !== M3_R16_SOURCE_R14_OBSERVATION_SHA256) throw new Error(`R16_SOURCE_R14_OBSERVATION_SHA_MISMATCH: expected ${M3_R16_SOURCE_R14_OBSERVATION_SHA256}, found ${digest}.`);
  const result = new Map<string, number>();
  for await (const observation of streamR14Observations(file)) {
    const direction = observation.direction === "LONG" ? 1 : -1;
    const adjustedReturn = observation.features.F07_directionAdjustedReturn4hAtrPriceScale;
    const scale = observation.features.F10_atr14OverClose1h;
    result.set(`${observation.decisionTime}|${observation.symbol}|${observation.direction}`, finite(adjustedReturn * scale / direction, "R14 symbol return4h"));
  }
  return result;
}

function latestAtOrBefore(rows: readonly R16MetricRow[], target: number): R16MetricRow | null {
  let low = 0;
  let high = rows.length - 1;
  let found: R16MetricRow | null = null;
  while (low <= high) { const middle = Math.floor((low + high) / 2); const row = rows[middle]!; if (row.timestamp <= target) { found = row; low = middle + 1; } else high = middle - 1; }
  return found;
}
function requireRecentMetric(rows: readonly R16MetricRow[], target: number, label: string): R16MetricRow {
  const row = latestAtOrBefore(rows, target);
  if (!row || target - row.timestamp > R16_METRICS_INTERVAL_MS) throw new Error(`R16 missing canonical ${label} metrics sample.`);
  if (!(row.sumOpenInterest > 0) || !(row.sumOpenInterestValue > 0) || !(row.sumTakerLongShortVolRatio > 0)) throw new Error(`R16 invalid ${label} metrics values.`);
  if (row.timestamp % R16_METRICS_INTERVAL_MS !== 0) throw new Error(`R16 non-canonical ${label} metrics timestamp.`);
  return row;
}
function exactBasis(rows: readonly R16BasisRow[], openTime: number, decisionTime: number, label: string): R16BasisRow {
  const row = rows.find((value) => value.openTime === openTime);
  if (!row || row.closeTime !== openTime + R16_BASIS_INTERVAL_MS - 1 || row.closeTime >= decisionTime) throw new Error(`R16 missing canonical ${label} basis pair.`);
  return row;
}
function windowTaker(rows: readonly R16MetricRow[], startExclusive: number, endInclusive: number, expectedCount: number, label: string): number {
  const values = rows.filter((row) => row.timestamp > startExclusive && row.timestamp <= endInclusive).map((row) => Math.log(row.sumTakerLongShortVolRatio));
  if (values.length !== expectedCount || values.some((value) => !Number.isFinite(value))) throw new Error(`R16 incomplete canonical ${label} taker window.`);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function deriveR16MicroValue(input: Readonly<{ series: R16MicroSeries; symbol: ResearchSymbol; direction: R16Direction; decisionTime: number; return4h: number }>): R16MicroValue {
  const rows = input.series.metrics[input.symbol];
  const now = requireRecentMetric(rows, input.decisionTime, "current");
  const one = requireRecentMetric(rows, input.decisionTime - 60 * 60_000, "1h lookback");
  const four = requireRecentMetric(rows, input.decisionTime - 4 * 60 * 60_000, "4h lookback");
  const twelve = requireRecentMetric(rows, input.decisionTime - 12 * 60 * 60_000, "12h lookback");
  const basisRows = input.series.basis[input.symbol];
  const basisTime = Math.floor((input.decisionTime - R16_BASIS_INTERVAL_MS) / R16_BASIS_INTERVAL_MS) * R16_BASIS_INTERVAL_MS;
  const basisNow = exactBasis(basisRows, basisTime, input.decisionTime, "current");
  const basis1 = exactBasis(basisRows, basisTime - 60 * 60_000, input.decisionTime, "1h lookback");
  const basis4 = exactBasis(basisRows, basisTime - 4 * 60 * 60_000, input.decisionTime, "4h lookback");
  const sign = r16DirectionSign(input.direction);
  const taker1h = windowTaker(rows, input.decisionTime - 60 * 60_000, input.decisionTime, 12, "1h");
  const taker3h = windowTaker(rows, input.decisionTime - 3 * 60 * 60_000, input.decisionTime, 36, "3h");
  const immediatelyPrior = windowTaker(rows, input.decisionTime - 2 * 60 * 60_000, input.decisionTime - 60 * 60_000, 12, "immediately prior 1h");
  const basisNowBps = 10_000 * (basisNow.markClose - basisNow.indexClose) / basisNow.indexClose;
  const basisChange1hBps = basisNowBps - basis1.basisBps;
  const basisChange4hBps = basisNowBps - basis4.basisBps;
  return Object.freeze({ oiChange1h: finite(Math.log(now.sumOpenInterest / one.sumOpenInterest), "OI1"), oiChange4h: finite(Math.log(now.sumOpenInterest / four.sumOpenInterest), "OI4"), oiChange12h: finite(Math.log(now.sumOpenInterest / twelve.sumOpenInterest), "OI12"), priceOiInteraction: finite(sign * input.return4h * Math.log(now.sumOpenInterest / four.sumOpenInterest), "priceOiInteraction"), basisNow: finite(sign * basisNowBps, "basisNow"), basisChange1h: finite(sign * basisChange1hBps, "basisChange1h"), basisChange4h: finite(sign * basisChange4hBps, "basisChange4h"), taker1h: finite(sign * taker1h, "taker1h"), taker3h: finite(sign * taker3h, "taker3h"), takerAcceleration: finite(sign * (taker1h - immediatelyPrior), "takerAcceleration") });
}

function betaMicro(control: R16FeatureRecord<string>, micro: R16MicroValue): R16FeatureRecord<R16BetaMicroFeatureName> {
  return Object.freeze({ ...control, MB01_btcOiChange1h: micro.oiChange1h, MB02_btcOiChange4h: micro.oiChange4h, MB03_btcOiChange12h: micro.oiChange12h, MB04_directionAdjustedBtcPriceOiInteraction: micro.priceOiInteraction, MB05_directionAdjustedBtcBasisNowBps: micro.basisNow * 1, MB06_directionAdjustedBtcBasisChange1h: micro.basisChange1h, MB07_directionAdjustedBtcBasisChange4h: micro.basisChange4h, MB08_directionAdjustedBtcTaker1h: micro.taker1h, MB09_directionAdjustedBtcTaker3h: micro.taker3h, MB10_directionAdjustedBtcTakerAcceleration: micro.takerAcceleration }) as R16FeatureRecord<R16BetaMicroFeatureName>;
}
function alphaMicro(control: R16FeatureRecord<string>, raw: R16MicroValue, medianValues: R16MicroValue): R16FeatureRecord<R16AlphaMicroFeatureName> {
  return Object.freeze({ ...control, MA01_oiChange1hMinusMedian: raw.oiChange1h - medianValues.oiChange1h, MA02_oiChange4hMinusMedian: raw.oiChange4h - medianValues.oiChange4h, MA03_oiChange12hMinusMedian: raw.oiChange12h - medianValues.oiChange12h, MA04_directionAdjustedPriceOiInteractionMinusMedian: raw.priceOiInteraction - medianValues.priceOiInteraction, MA05_directionAdjustedBasisNowMinusMedian: raw.basisNow - medianValues.basisNow, MA06_directionAdjustedBasisChange1hMinusMedian: raw.basisChange1h - medianValues.basisChange1h, MA07_directionAdjustedBasisChange4hMinusMedian: raw.basisChange4h - medianValues.basisChange4h, MA08_directionAdjustedTaker1hMinusMedian: raw.taker1h - medianValues.taker1h, MA09_directionAdjustedTaker3hMinusMedian: raw.taker3h - medianValues.taker3h, MA10_directionAdjustedTakerAccelerationMinusMedian: raw.takerAcceleration - medianValues.takerAcceleration }) as R16FeatureRecord<R16AlphaMicroFeatureName>;
}

function foldEligibility(decisionTime: number): R16Observation["foldEligibility"] {
  return Object.freeze(Object.fromEntries(["F1", "F2", "F3", "F4", "F5", "F6"].map((foldId) => [foldId, { research: decisionTime >= getResearchFoldRoleRange(foldId as never, "RESEARCH").startTime && decisionTime <= getResearchFoldRoleRange(foldId as never, "RESEARCH").endTime, validation: decisionTime >= getResearchFoldRoleRange(foldId as never, "VALIDATION").startTime && decisionTime <= getResearchFoldRoleRange(foldId as never, "VALIDATION").endTime }]))) as R16Observation["foldEligibility"];
}

export function validateR16Observation(value: unknown): R16Observation {
  if (typeof value !== "object" || value === null) throw new Error("R16 observation must be an object.");
  const row = value as R16Observation;
  if (row.schemaVersion !== R16_OBSERVATION_SCHEMA_VERSION || row.observationId !== `${row.decisionTime}|${row.symbol}|${row.direction}` || !R16_SYMBOLS.includes(row.symbol) || !["LONG", "SHORT"].includes(row.direction) || !Number.isSafeInteger(row.decisionTime)) throw new Error(`R16 observation identity is invalid: ${row.observationId}`);
  if (!sameKeys(row.betaControlFeatures, R16_BETA_CONTROL_FEATURE_NAMES) || !sameKeys(row.betaMicroFeatures, R16_BETA_MICRO_FEATURE_NAMES) || !sameKeys(row.alphaControlFeatures, R16_ALPHA_CONTROL_FEATURE_NAMES) || !sameKeys(row.alphaMicroFeatures, R16_ALPHA_MICRO_FEATURE_NAMES)) throw new Error(`R16 observation feature identity is invalid: ${row.observationId}`);
  for (const features of [row.betaControlFeatures, row.betaMicroFeatures, row.alphaControlFeatures, row.alphaMicroFeatures]) for (const value of Object.values(features)) if (!Number.isFinite(value)) throw new Error(`R16 observation feature is non-finite: ${row.observationId}`);
  if (![row.marketBetaTarget, row.relativeAlphaTarget, row.symbolTarget, row.label.netForwardAtr].every(Number.isFinite)) throw new Error(`R16 observation target is non-finite: ${row.observationId}`);
  return row;
}

function microHash(series: R16MicroSeries): string { return hash({ acquisition: series.acquisition, counts: Object.fromEntries(R16_SYMBOLS.map((symbol) => [symbol, { metrics: series.metrics[symbol].length, basis: series.basis[symbol].length }])) }); }

function manifestWithoutHash(value: R16ObservationFreezeManifest): Readonly<Record<string, unknown>> { return { ...value, manifestSha256: null }; }

export async function materializeR16ObservationFreeze(input: Readonly<{ root?: string; cacheDirectory?: string; sourceR15ObservationFile?: string }>): Promise<R16ObservationFreezeManifest> {
  const root = path.resolve(input.root ?? process.cwd());
  const cacheDirectory = path.resolve(input.cacheDirectory ?? process.env.TRADEPULSE_R16_CACHE ?? R16_DEFAULT_CACHE_DIRECTORY);
  const targetData = path.resolve(root, R16_OBSERVATION_DATA_PATH);
  const manifestPath = path.resolve(root, R16_OBSERVATION_FREEZE_PATH);
  if (existsSync(targetData) || existsSync(manifestPath)) { if (!existsSync(targetData) || !existsSync(manifestPath)) throw new Error("R16 observation freeze is partially present; refusing overwrite."); return readR16ObservationFreeze(root); }
  const sourceR15 = input.sourceR15ObservationFile ? path.resolve(input.sourceR15ObservationFile) : locateR16R15ObservationFile(root);
  const sourceR15Sha = await hashR16File(sourceR15);
  if (sourceR15Sha !== M3_R16_SOURCE_R15_OBSERVATION_SHA256) throw new Error(`R16_SOURCE_R15_OBSERVATION_SHA_MISMATCH: expected ${M3_R16_SOURCE_R15_OBSERVATION_SHA256}, found ${sourceR15Sha}.`);
  const priceReturns = await loadR16PriceReturns(root);
  const series = loadR16MicroSeries(cacheDirectory);
  const staging = mkdtempSync(path.join(path.dirname(targetData), ".r16-observation-staging-"));
  mkdirSync(path.dirname(targetData), { recursive: true });
  const temporaryData = path.join(staging, path.basename(targetData));
  const stream = createWriteStream(temporaryData, { encoding: "utf8" });
  const digest = createHash("sha256");
  const excluded: R16ExcludedDecisionTime[] = [];
  const errors: string[] = [];
  const sourceTimes = new Set<number>();
  const eligibleTimes = new Set<number>();
  const foldCounts = Object.fromEntries(["F1", "F2", "F3", "F4", "F5", "F6"].map((foldId) => [foldId, { source: new Set<number>(), eligible: new Set<number>() }])) as Record<string, { source: Set<number>; eligible: Set<number> }>;
  let count = 0;
  let currentTime: number | null = null;
  let group: R15FrozenObservation[] = [];
  const flush = async (): Promise<void> => {
    if (currentTime === null) return;
    const decisionTime = currentTime;
    const inAnyFold = Object.keys(foldCounts).some((foldId) => {
      const roleResearch = getResearchFoldRoleRange(foldId as never, "RESEARCH");
      const roleValidation = getResearchFoldRoleRange(foldId as never, "VALIDATION");
      return (decisionTime >= roleResearch.startTime && decisionTime <= roleResearch.endTime) || (decisionTime >= roleValidation.startTime && decisionTime <= roleValidation.endTime);
    });
    if (inAnyFold) sourceTimes.add(currentTime);
    for (const foldId of Object.keys(foldCounts)) { const roleResearch = currentTime >= getResearchFoldRoleRange(foldId as never, "RESEARCH").startTime && currentTime <= getResearchFoldRoleRange(foldId as never, "RESEARCH").endTime; const roleValidation = currentTime >= getResearchFoldRoleRange(foldId as never, "VALIDATION").startTime && currentTime <= getResearchFoldRoleRange(foldId as never, "VALIDATION").endTime; if (roleResearch || roleValidation) foldCounts[foldId]!.source.add(currentTime); }
    const groupReason: string[] = [];
    if (group.length !== R16_SYMBOLS.length * 2) groupReason.push("R15_GROUP_NOT_TEN_ROWS");
    const byKey = new Map(group.map((row) => [`${row.symbol}|${row.direction}`, row]));
    for (const symbol of R16_SYMBOLS) for (const direction of ["LONG", "SHORT"] as const) if (!byKey.has(`${symbol}|${direction}`)) groupReason.push(`R15_MISSING_${symbol}_${direction}`);
    const built: R16Observation[] = [];
    if (groupReason.length === 0) {
      for (const direction of ["LONG", "SHORT"] as const) {
        const rows = R16_SYMBOLS.map((symbol) => byKey.get(`${symbol}|${direction}`)!);
        const raw = new Map<ResearchSymbol, R16MicroValue>();
        try {
          const betaReturn = priceReturns.get(`${currentTime}|BTCUSDT|${direction}`);
          if (betaReturn === undefined) throw new Error("R16 missing BTC closed 4h return.");
          for (const row of rows) { const rowReturn = priceReturns.get(`${currentTime}|${row.symbol}|${direction}`); if (rowReturn === undefined) throw new Error(`R16 missing ${row.symbol} closed 4h return.`); raw.set(row.symbol, deriveR16MicroValue({ series, symbol: row.symbol, direction, decisionTime: currentTime, return4h: rowReturn })); }
          const medians: R16MicroValue = Object.freeze({ oiChange1h: median([...raw.values()].map((value) => value.oiChange1h)), oiChange4h: median([...raw.values()].map((value) => value.oiChange4h)), oiChange12h: median([...raw.values()].map((value) => value.oiChange12h)), priceOiInteraction: median([...raw.values()].map((value) => value.priceOiInteraction)), basisNow: median([...raw.values()].map((value) => value.basisNow)), basisChange1h: median([...raw.values()].map((value) => value.basisChange1h)), basisChange4h: median([...raw.values()].map((value) => value.basisChange4h)), taker1h: median([...raw.values()].map((value) => value.taker1h)), taker3h: median([...raw.values()].map((value) => value.taker3h)), takerAcceleration: median([...raw.values()].map((value) => value.takerAcceleration)) });
          for (const row of rows) { const micro = raw.get(row.symbol)!; const observation: R16Observation = Object.freeze({ schemaVersion: R16_OBSERVATION_SCHEMA_VERSION, observationId: row.observationId, decisionTime: row.decisionTime, symbol: row.symbol, direction: row.direction, betaControlFeatures: row.betaFeatures, betaMicroFeatures: betaMicro(row.betaFeatures, raw.get("BTCUSDT")!), alphaControlFeatures: row.alphaFeatures, alphaMicroFeatures: alphaMicro(row.alphaFeatures, micro, medians), marketBetaTarget: row.marketBetaTarget, relativeAlphaTarget: row.relativeAlphaTarget, symbolTarget: row.symbolTarget, label: row.label, foldEligibility: foldEligibility(row.decisionTime) }); validateR16Observation(observation); built.push(observation); }
        } catch (error) { groupReason.push(`${direction}:${error instanceof Error ? error.message : String(error)}`); }
      }
    }
    if (groupReason.length > 0) { excluded.push(Object.freeze({ decisionTime: currentTime, reasons: Object.freeze([...new Set(groupReason)]) })); }
    else { if (inAnyFold) eligibleTimes.add(currentTime); for (const foldId of Object.keys(foldCounts)) { const rangeResearch = getResearchFoldRoleRange(foldId as never, "RESEARCH"); const rangeValidation = getResearchFoldRoleRange(foldId as never, "VALIDATION"); if ((currentTime >= rangeResearch.startTime && currentTime <= rangeResearch.endTime) || (currentTime >= rangeValidation.startTime && currentTime <= rangeValidation.endTime)) foldCounts[foldId]!.eligible.add(currentTime); } for (const observation of built.sort((left, right) => R16_SYMBOLS.indexOf(left.symbol) - R16_SYMBOLS.indexOf(right.symbol) || (left.direction === "LONG" ? -1 : 1))) { const line = `${stableStringify(observation)}\n`; const bytes = Buffer.from(line, "utf8"); digest.update(bytes); count += 1; if (!stream.write(line, "utf8")) await once(stream, "drain"); } }
    group = [];
  };
  try {
    for await (const row of streamR15Observations(sourceR15)) { if (currentTime !== row.decisionTime) { await flush(); currentTime = row.decisionTime; } group.push(row); }
    await flush();
    await new Promise<void>((resolve, reject) => { stream.once("finish", resolve); stream.once("error", reject); stream.end(); });
    const coverageByFold = Object.fromEntries(Object.entries(foldCounts).map(([foldId, values]) => { const researchRange = getResearchFoldRoleRange(foldId as never, "RESEARCH"); const validationRange = getResearchFoldRoleRange(foldId as never, "VALIDATION"); const sourceTrainingDecisionTimes = [...values.source].filter((time) => time >= researchRange.startTime && time <= researchRange.endTime).length; const eligibleTrainingDecisionTimes = [...values.eligible].filter((time) => time >= researchRange.startTime && time <= researchRange.endTime).length; const sourceValidationDecisionTimes = [...values.source].filter((time) => time >= validationRange.startTime && time <= validationRange.endTime).length; const eligibleValidationDecisionTimes = [...values.eligible].filter((time) => time >= validationRange.startTime && time <= validationRange.endTime).length; return [foldId, { sourceTrainingDecisionTimes, eligibleTrainingDecisionTimes, trainingCoverage: sourceTrainingDecisionTimes === 0 ? 0 : eligibleTrainingDecisionTimes / sourceTrainingDecisionTimes, sourceValidationDecisionTimes, eligibleValidationDecisionTimes, validationCoverage: sourceValidationDecisionTimes === 0 ? 0 : eligibleValidationDecisionTimes / sourceValidationDecisionTimes }]; })) as R16ObservationFreezeManifest["coverageByFold"];
    const maskPayload = { eligibleDecisionTimes: [...eligibleTimes].sort((left, right) => left - right), excludedDecisionTimes: excluded };
    const base: Omit<R16ObservationFreezeManifest, "manifestSha256"> = { schemaVersion: R16_OBSERVATION_FREEZE_SCHEMA_VERSION, researchRoundId: "baseline-002-research-round-016", sourceR15ObservationSha256: M3_R16_SOURCE_R15_OBSERVATION_SHA256, sourceR14ObservationSha256: M3_R16_SOURCE_R14_OBSERVATION_SHA256, researchBoundary: M3_R16_RESEARCH_END_ISO, microDataSha256: microHash(series), globalMaskSha256: hash(maskPayload), observationDataPath: R16_OBSERVATION_DATA_PATH, observationDataSha256: digest.digest("hex"), observationDataBytes: statSync(temporaryData).size, observationCount: count, decisionTimeCount: eligibleTimes.size, sourceDecisionTimeCount: sourceTimes.size, pooledCoverage: sourceTimes.size === 0 ? 0 : eligibleTimes.size / sourceTimes.size, coverageByFold, excludedDecisionTimes: Object.freeze(excluded), integrityErrors: Object.freeze(errors), integrity: errors.length === 0 ? "COMPLETE" : "INCOMPLETE", frozen: true };
    if (base.integrity !== "COMPLETE") throw new Error(`R16 observation freeze has integrity errors: ${errors.join("; ")}`);
    const manifest = Object.freeze({ ...base, manifestSha256: hash(manifestWithoutHash({ ...base, manifestSha256: "" } as R16ObservationFreezeManifest)) }) as R16ObservationFreezeManifest;
    renameSync(temporaryData, targetData);
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    const manifestTemporary = path.join(staging, path.basename(manifestPath));
    const manifestPayload = stableStringify(manifest);
    const manifestStream = createWriteStream(manifestTemporary, { encoding: "utf8" });
    manifestStream.end(manifestPayload);
    await once(manifestStream, "finish");
    renameSync(manifestTemporary, manifestPath);
    return manifest;
  } catch (error) { stream.destroy(); if (existsSync(targetData)) rmSync(targetData, { force: true }); throw error; }
  finally { if (existsSync(staging)) rmSync(staging, { recursive: true, force: true }); }
}

export async function* streamR16Observations(filePath: string): AsyncGenerator<R16Observation> { const input = createReadStream(path.resolve(filePath), { encoding: "utf8" }); const lines = createInterface({ input, crlfDelay: Infinity }); try { for await (const line of lines) yield validateR16Observation(JSON.parse(line)); } finally { lines.close(); input.destroy(); } }

export function readR16ObservationFreeze(root = process.cwd()): R16ObservationFreezeManifest { const filePath = path.join(root, R16_OBSERVATION_FREEZE_PATH); if (!existsSync(filePath)) throw new Error(`R16 observation freeze is missing: ${filePath}`); const manifest = JSON.parse(readFileSync(filePath, "utf8")) as R16ObservationFreezeManifest; if (manifest.schemaVersion !== R16_OBSERVATION_FREEZE_SCHEMA_VERSION || manifest.integrity !== "COMPLETE" || manifest.integrityErrors.length !== 0 || manifest.sourceR15ObservationSha256 !== M3_R16_SOURCE_R15_OBSERVATION_SHA256 || manifest.sourceR14ObservationSha256 !== M3_R16_SOURCE_R14_OBSERVATION_SHA256 || manifest.researchRoundId !== "baseline-002-research-round-016" || manifest.researchBoundary !== M3_R16_RESEARCH_END_ISO || manifest.observationDataPath !== R16_OBSERVATION_DATA_PATH) throw new Error("R16 observation freeze provenance failed."); return manifest; }

export async function verifyR16ObservationFreeze(root = process.cwd()): Promise<Readonly<{ manifest: R16ObservationFreezeManifest; count: number; sha256: string }>> { const manifest = readR16ObservationFreeze(root); const file = path.resolve(root, manifest.observationDataPath); const sha256 = await hashR16File(file); let count = 0; for await (const observation of streamR16Observations(file)) { if (observation.observationId) count += 1; } if (sha256 !== manifest.observationDataSha256 || count !== manifest.observationCount || statSync(file).size !== manifest.observationDataBytes) throw new Error("R16 observation freeze bytes do not match manifest."); return Object.freeze({ manifest, count, sha256 }); }

export function r16FeatureSetIdentity(): Readonly<Record<string, unknown>> { return Object.freeze({ betaControl: R16_BETA_CONTROL_FEATURE_NAMES, betaMicro: R16_BETA_MICRO_FEATURE_NAMES, alphaControl: R16_ALPHA_CONTROL_FEATURE_NAMES, alphaMicro: R16_ALPHA_MICRO_FEATURE_NAMES, r15Beta: R15_BETA_FEATURE_NAMES, r15Alpha: R15_ALPHA_FEATURE_NAMES }); }
export function r16PurgeSafe(decisionTime: number, validationStartTime: number): boolean { return decisionTime + R16_PURGE_EMBARGO_HOURS * 60 * 60_000 < validationStartTime; }
