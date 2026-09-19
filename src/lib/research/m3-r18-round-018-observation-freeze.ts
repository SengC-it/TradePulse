import { createHash } from "node:crypto";
import { createReadStream, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, closeSync, writeFileSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { createInterface } from "node:readline";
import path from "node:path";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { BACKTEST_POLICY } from "../backtest/constants.ts";
import { buildHistoricalIndexes, buildStrategyInputFromIndexes } from "../backtest/windows.ts";
import { parseBinanceKlines } from "../market-data/binance/parser.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import { validateHistoricalCandleSeries } from "../historical-data/validation.ts";
import { evaluateStrategy } from "../strategy/engine.ts";
import type { StrategyEvaluation } from "../strategy/types.ts";
import { ROUND_018_BOUNDARY_END, ROUND_018_OBSERVATION_COUNT, ROUND_018_OBSERVATION_SHA256, ROUND_018_OBSERVATION_SOURCE, ROUND_018_R14_MANIFEST_SOURCE, ROUND_018_RESEARCH_ROUND_ID, ROUND_018_STRUCTURAL_FREEZE_MANIFEST_PATH, ROUND_018_STRUCTURAL_OBSERVATION_SOURCE } from "./m3-r18-round-018-protocol.ts";
import { verifyR18AcceptedProvenance, type R18AcceptedProvenance } from "./m3-r18-round-018-provenance.ts";
import { canonicalR18Identity, classifyR18ReplayEvaluation, indexR18EngineEvaluations, structuralRecordFromReplay, type R18Direction, type R18ObservationMetadata, type R18ReplayDecision, type R18ReplayStatus, type R18StructuralObservationRecord } from "./m3-r18-round-018-replay.ts";
import { stableStringify } from "./utils.ts";

const R18_LABEL_STATUSES = Object.freeze(["EXECUTED", "NO_ENTRY", "DATA_INCOMPLETE", "PERIOD_END_CENSORED"] as const);
const R18_TIMEFRAMES = Object.freeze(["1h", "4h"] as const);
const R18_SCHEMA_VERSION = "m3-r18-round-018-structural-observation-freeze-001" as const;
const R18_CACHE_SCHEMA_VERSION = "m3-r6-round-006-page-cache-001" as const;
const R18_RESEARCH_START_TIME = Date.parse("2023-01-01T00:00:00.000Z");
const R18_RESEARCH_END_TIME = Date.parse(ROUND_018_BOUNDARY_END);

type JsonRange = Readonly<{ start: number; end: number }>;
type R18StructuralCell = {
  control: number;
  candidate: number;
  controlH4Executed: number;
  candidateH4Executed: number;
};
type R18StructuralRegimeCounts = Readonly<Record<string, R18StructuralCell>>;
type R18StructuralSymbolCounts = Readonly<Record<string, R18StructuralRegimeCounts>>;
type R18StructuralFoldCounts = Readonly<Record<string, R18StructuralSymbolCounts>>;

export type R18StructuralCounts = Readonly<{
  observationCount: number;
  statusCounts: Readonly<Record<R18ReplayStatus, number>>;
  formalCount: number;
  controlCount: number;
  candidateCount: number;
  excludedByConsensusCount: number;
  retentionRate: number;
  duplicateCanonicalCount: number;
  invalidMetadataCount: number;
  pointInTimeViolationCount: number;
  provenanceIncompleteCount: number;
  labelStatusCounts: Readonly<Record<"EXECUTED" | "NO_ENTRY" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED" | "MISSING", number>>;
  countsByFoldSymbolRegime: R18StructuralFoldCounts;
  symbolsWithCandidate: readonly ResearchSymbol[];
  regimesWithCandidate: readonly string[];
  foldsWithCandidate: readonly string[];
  replaySourceErrors: readonly string[];
}>;

export type R18ObservationFreezeManifest = Readonly<{
  schemaVersion: typeof R18_SCHEMA_VERSION;
  researchRoundId: typeof ROUND_018_RESEARCH_ROUND_ID;
  acceptedSourceCommit: string;
  observationSource: Readonly<{
    path: typeof ROUND_018_OBSERVATION_SOURCE;
    manifestPath: typeof ROUND_018_R14_MANIFEST_SOURCE;
    observationCount: number;
    bytes: number;
    sha256: string;
    sourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE" | "INVALID_PROVENANCE";
  }>;
  acceptedCandleCache: Readonly<{
    path: string;
    sourceStatus: "ACCEPTED_EXISTING_ROUND006_CANDLE_CACHE" | "MISSING_OR_INVALID";
    pageCount: number;
    timeframes: readonly ["1h", "4h"];
    networkAcquired: false;
  }>;
  compactStructuralObservation: Readonly<{
    path: typeof ROUND_018_STRUCTURAL_OBSERVATION_SOURCE;
    bytes: number;
    sha256: string;
    formalOnly: true;
    economicValuesRead: false;
  }>;
  counts: R18StructuralCounts;
  integrity: Readonly<{
    allPopulationPartitioned: boolean;
    duplicateCanonicalCount: number;
    provenanceIncompleteCount: number;
    pointInTimeViolationCount: number;
    economicFieldsRead: false;
    economicValuesCalculated: false;
    economicValuesInspected: false;
  }>;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  performanceExecuted: false;
  selectionExecuted: false;
  productionUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
  manifestSha256: string;
}>;

type R18CacheIdentity = Readonly<{
  schemaVersion: typeof R18_CACHE_SCHEMA_VERSION;
  provider: "binance-usdm-public";
  endpoint: "/fapi/v1/klines";
  dataType: "candles";
  symbol: ResearchSymbol;
  timeframe: "1h" | "4h";
  startTime: number;
  endTime: number;
  limit: number;
  backtestPolicyVersion: "bt-policy-003";
}>;

type R18CacheEnvelope = Readonly<{
  schemaVersion: typeof R18_CACHE_SCHEMA_VERSION;
  identity: R18CacheIdentity;
  payload: unknown;
  payloadSha256: string;
}>;

export type R18CandleDatasets = Readonly<{
  datasets: Readonly<Record<ResearchSymbol, Readonly<{ candles1h: readonly Candle[]; candles4h: readonly Candle[] }>>>;
  pageCount: number;
}>;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashStable(value: unknown): string {
  return sha256(stableStringify(value));
}

function fsyncFile(filePath: string): void {
  const descriptor = openSync(filePath, "r+");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function skipWhitespace(line: string, index: number): number {
  let cursor = index;
  while (cursor < line.length && /\s/.test(line[cursor]!)) cursor += 1;
  return cursor;
}

function stringEnd(line: string, start: number): number {
  if (line[start] !== '"') return -1;
  let escaped = false;
  for (let index = start + 1; index < line.length; index += 1) {
    const character = line[index]!;
    if (escaped) { escaped = false; continue; }
    if (character === "\\") { escaped = true; continue; }
    if (character === '"') return index + 1;
  }
  return -1;
}

function valueEnd(line: string, start: number): number {
  const first = line[start];
  if (first === '"') return stringEnd(line, start);
  if (first === "{" || first === "[") {
    const opening = first;
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < line.length; index += 1) {
      const character = line[index]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') { inString = true; continue; }
      if (character === opening) depth += 1;
      if (character === closing) {
        depth -= 1;
        if (depth === 0) return index + 1;
      }
    }
    return -1;
  }
  let index = start;
  while (index < line.length && !",}".includes(line[index]!)) index += 1;
  return index;
}

function directPropertyValue(line: string, container: JsonRange, wantedKey: string): JsonRange | null {
  let index = skipWhitespace(line, container.start + 1);
  while (index < container.end - 1) {
    if (line[index] === ",") { index = skipWhitespace(line, index + 1); continue; }
    if (line[index] === "}") break;
    if (line[index] !== '"') return null;
    const keyEnd = stringEnd(line, index);
    if (keyEnd < 0) return null;
    let key: string;
    try { key = JSON.parse(line.slice(index, keyEnd)) as string; } catch { return null; }
    index = skipWhitespace(line, keyEnd);
    if (line[index] !== ":") return null;
    const start = skipWhitespace(line, index + 1);
    const end = valueEnd(line, start);
    if (end < 0) return null;
    if (key === wantedKey) return Object.freeze({ start, end });
    index = end;
  }
  return null;
}

function stringValue(line: string, range: JsonRange | null): string | null {
  if (!range || line[range.start] !== '"') return null;
  try { return JSON.parse(line.slice(range.start, range.end)) as string; } catch { return null; }
}

function numberValue(line: string, range: JsonRange | null): number | null {
  if (!range) return null;
  const raw = line.slice(range.start, range.end);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function metadataFallback(lineNumber: number): R18ObservationMetadata {
  return Object.freeze({
    observationId: `invalid-r18-observation-${lineNumber}`,
    decisionTime: -1,
    symbol: "BTCUSDT",
    direction: "LONG",
    canonicalIdentityValid: false,
    formalSourceStatus: "INCOMPLETE",
    formalSourcePath: "",
    formalSourceSha256: "",
    h4LabelIdentityPresent: false,
    h4LabelStatus: "MISSING",
    labelSourceStatus: "INCOMPLETE",
    labelSourcePath: "",
    labelSourceSha256: "",
    metadataParseValid: false,
  });
}

export function parseR18ObservationMetadataLine(line: string, lineNumber = 1): R18ObservationMetadata {
  const trimmedStart = skipWhitespace(line, 0);
  const root: JsonRange = { start: trimmedStart, end: line.length };
  if (line[trimmedStart] !== "{" || line.length === 0) return metadataFallback(lineNumber);
  const observationId = stringValue(line, directPropertyValue(line, root, "observationId"));
  const decisionTime = numberValue(line, directPropertyValue(line, root, "decisionTime"));
  const symbolValue = stringValue(line, directPropertyValue(line, root, "symbol"));
  const directionValue = stringValue(line, directPropertyValue(line, root, "direction"));
  const labelsRange = directPropertyValue(line, root, "labels");
  const h4Range = labelsRange ? directPropertyValue(line, labelsRange, "4") : null;
  const h4SignalTime = numberValue(line, h4Range ? directPropertyValue(line, h4Range, "signalTime") : null);
  const h4Symbol = stringValue(line, h4Range ? directPropertyValue(line, h4Range, "symbol") : null);
  const h4Direction = stringValue(line, h4Range ? directPropertyValue(line, h4Range, "direction") : null);
  const h4Horizon = numberValue(line, h4Range ? directPropertyValue(line, h4Range, "horizonHours") : null);
  const h4StatusValue = stringValue(line, h4Range ? directPropertyValue(line, h4Range, "status") : null);
  const symbol = (RESEARCH_SYMBOLS as readonly string[]).includes(symbolValue ?? "")
    ? symbolValue as ResearchSymbol
    : "BTCUSDT";
  const direction: R18Direction = directionValue === "SHORT" ? "SHORT" : "LONG";
  const safeDecisionTime = typeof decisionTime === "number" ? decisionTime : -1;
  const canonicalIdentityValid = typeof observationId === "string"
    && Number.isSafeInteger(safeDecisionTime)
    && safeDecisionTime >= R18_RESEARCH_START_TIME
    && safeDecisionTime <= R18_RESEARCH_END_TIME
    && symbolValue === symbol
    && (directionValue === "LONG" || directionValue === "SHORT")
    && observationId === canonicalR18Identity(safeDecisionTime, symbol, direction);
  const h4LabelIdentityPresent = Number.isSafeInteger(h4SignalTime)
    && h4SignalTime === safeDecisionTime
    && h4Symbol === symbol
    && h4Direction === direction
    && h4Horizon === 4
    && R18_LABEL_STATUSES.includes(h4StatusValue as (typeof R18_LABEL_STATUSES)[number]);
  const metadataParseValid = observationId !== null
    && decisionTime !== null
    && symbolValue !== null
    && directionValue !== null
    && h4Range !== null;
  return Object.freeze({
    observationId: observationId ?? `invalid-r18-observation-${lineNumber}`,
    decisionTime: safeDecisionTime,
    symbol,
    direction,
    canonicalIdentityValid,
    formalSourceStatus: canonicalIdentityValid ? "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE" : "INCOMPLETE",
    formalSourcePath: canonicalIdentityValid ? ROUND_018_OBSERVATION_SOURCE : "",
    formalSourceSha256: canonicalIdentityValid ? ROUND_018_OBSERVATION_SHA256 : "",
    h4LabelIdentityPresent,
    h4LabelStatus: h4LabelIdentityPresent ? h4StatusValue as R18ObservationMetadata["h4LabelStatus"] : "MISSING",
    labelSourceStatus: h4LabelIdentityPresent ? "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE" : "INCOMPLETE",
    labelSourcePath: h4LabelIdentityPresent ? ROUND_018_R14_MANIFEST_SOURCE : "",
    labelSourceSha256: h4LabelIdentityPresent ? ROUND_018_OBSERVATION_SHA256 : "",
    metadataParseValid,
  });
}

export async function* streamR18ObservationMetadata(filePath: string): AsyncGenerator<R18ObservationMetadata> {
  const input = createReadStream(path.resolve(filePath), { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber += 1;
      yield parseR18ObservationMetadataLine(line, lineNumber);
    }
  } finally {
    lines.close();
    input.destroy();
  }
}

function readMetadataLines(
  filePath: string,
  onLine: (line: string, lineNumber: number) => void,
): Promise<Readonly<{ lineCount: number; bytes: number; sha256: string }>> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(path.resolve(filePath));
    const decoder = new StringDecoder("utf8");
    const digest = createHash("sha256");
    let buffered = "";
    let lineNumber = 0;
    let bytes = 0;
    const consume = (line: string): void => {
      lineNumber += 1;
      onLine(line.endsWith(String.fromCharCode(13)) ? line.slice(0, -1) : line, lineNumber);
    };
    stream.on("data", (chunk: Buffer) => {
      digest.update(chunk);
      bytes += chunk.byteLength;
      buffered += decoder.write(chunk);
      let separator = buffered.indexOf(String.fromCharCode(10));
      while (separator >= 0) {
        consume(buffered.slice(0, separator));
        buffered = buffered.slice(separator + 1);
        separator = buffered.indexOf(String.fromCharCode(10));
      }
    });
    stream.on("end", () => {
      buffered += decoder.end();
      if (buffered.length > 0) consume(buffered);
      resolve(Object.freeze({ lineCount: lineNumber, bytes, sha256: digest.digest("hex") }));
    });
    stream.on("error", reject);
  });
}

function isCandleCacheIdentity(value: unknown): value is R18CacheIdentity {
  if (typeof value !== "object" || value === null) return false;
  const identity = value as Record<string, unknown>;
  return identity.schemaVersion === R18_CACHE_SCHEMA_VERSION
    && identity.provider === "binance-usdm-public"
    && identity.endpoint === "/fapi/v1/klines"
    && identity.dataType === "candles"
    && R18_TIMEFRAMES.includes(identity.timeframe as "1h" | "4h")
    && (RESEARCH_SYMBOLS as readonly string[]).includes(identity.symbol as string)
    && Number.isSafeInteger(identity.startTime)
    && Number.isSafeInteger(identity.endTime)
    && Number.isSafeInteger(identity.limit)
    && typeof identity.limit === "number"
    && identity.limit > 0
    && identity.backtestPolicyVersion === "bt-policy-003";
}

function emptyCandleMaps(): Record<ResearchSymbol, Record<"1h" | "4h", Map<number, Candle>>> {
  return Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, { "1h": new Map(), "4h": new Map() }])) as Record<ResearchSymbol, Record<"1h" | "4h", Map<number, Candle>>>;
}

export function loadR18AcceptedCandleCache(cacheDirectory: string): R18CandleDatasets {
  const absolute = path.resolve(cacheDirectory);
  if (!existsSync(absolute)) throw new Error(`Accepted Round-006 candle cache is missing: ${absolute}`);
  const maps = emptyCandleMaps();
  let acceptedPageCount = 0;
  for (const entry of readdirSync(absolute).sort()) {
    if (!entry.endsWith(".json")) continue;
    const cachePath = path.join(absolute, entry);
    let envelope: R18CacheEnvelope;
    try { envelope = JSON.parse(readFileSync(cachePath, "utf8")) as R18CacheEnvelope; } catch { continue; }
    if (!isCandleCacheIdentity(envelope.identity)) continue;
    const identity = envelope.identity;
    if (identity.startTime > R18_RESEARCH_END_TIME || identity.endTime > R18_RESEARCH_END_TIME) continue;
    if (entry !== `${hashStable(identity)}.json` || envelope.schemaVersion !== R18_CACHE_SCHEMA_VERSION || envelope.payloadSha256 !== hashStable(envelope.payload)) {
      throw new Error(`Accepted candle cache identity/checksum failed: ${cachePath}`);
    }
    const page = parseBinanceKlines(envelope.payload, identity.symbol, identity.timeframe);
    validateHistoricalCandleSeries(page, { symbol: identity.symbol, timeframe: identity.timeframe });
    if (page.length === 0 || page[0]!.openTime !== identity.startTime || page.at(-1)!.openTime > identity.endTime) {
      throw new Error(`Accepted candle cache page range failed: ${cachePath}`);
    }
    acceptedPageCount += 1;
    const target = maps[identity.symbol][identity.timeframe];
    for (const candle of page) {
      const previous = target.get(candle.openTime);
      if (previous && stableStringify(previous) !== stableStringify(candle)) throw new Error(`Conflicting candle cache duplicate: ${cachePath}`);
      target.set(candle.openTime, candle);
    }
  }
  const datasets = {} as Record<ResearchSymbol, Readonly<{ candles1h: readonly Candle[]; candles4h: readonly Candle[] }> >;
  for (const symbol of RESEARCH_SYMBOLS) {
    const candles1h = [...maps[symbol]["1h"].values()].sort((left, right) => left.openTime - right.openTime);
    const candles4h = [...maps[symbol]["4h"].values()].sort((left, right) => left.openTime - right.openTime);
    const expectedStart1h = R18_RESEARCH_START_TIME - BACKTEST_POLICY.strategyWindowCandles * INTERVAL_MS["1h"];
    const expectedStart4h = R18_RESEARCH_START_TIME - BACKTEST_POLICY.strategyWindowCandles * INTERVAL_MS["4h"];
    const expectedEnd1h = Math.floor(R18_RESEARCH_END_TIME / INTERVAL_MS["1h"]) * INTERVAL_MS["1h"];
    const expectedEnd4h = Math.floor(R18_RESEARCH_END_TIME / INTERVAL_MS["4h"]) * INTERVAL_MS["4h"];
    datasets[symbol] = Object.freeze({
      candles1h: validateHistoricalCandleSeries(candles1h, { symbol, timeframe: "1h", expectedStartTime: expectedStart1h, expectedEndTime: expectedEnd1h }),
      candles4h: validateHistoricalCandleSeries(candles4h, { symbol, timeframe: "4h", expectedStartTime: expectedStart4h, expectedEndTime: expectedEnd4h }),
    });
  }
  return Object.freeze({ datasets: Object.freeze(datasets), pageCount: acceptedPageCount });
}

type MutableStructuralCounts = {
  observationCount: number;
  statusCounts: Record<R18ReplayStatus, number>;
  formalCount: number;
  controlCount: number;
  candidateCount: number;
  duplicateCanonicalCount: number;
  invalidMetadataCount: number;
  pointInTimeViolationCount: number;
  provenanceIncompleteCount: number;
  labelStatusCounts: Record<"EXECUTED" | "NO_ENTRY" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED" | "MISSING", number>;
  counts: Map<string, Map<string, Map<string, R18StructuralCell>>>;
  symbolsWithCandidate: Set<ResearchSymbol>;
  regimesWithCandidate: Set<string>;
  foldsWithCandidate: Set<string>;
  replaySourceErrors: string[];
  canonicalIds: Set<string>;
};

function mutableCounts(): MutableStructuralCounts {
  return {
    observationCount: 0,
    statusCounts: { NO_BASELINE_CANDIDATE: 0, BASELINE_CANDIDATE_NON_FORMAL: 0, BASELINE_FORMAL: 0, PROVENANCE_INCOMPLETE: 0 },
    formalCount: 0,
    controlCount: 0,
    candidateCount: 0,
    duplicateCanonicalCount: 0,
    invalidMetadataCount: 0,
    pointInTimeViolationCount: 0,
    provenanceIncompleteCount: 0,
    labelStatusCounts: { EXECUTED: 0, NO_ENTRY: 0, DATA_INCOMPLETE: 0, PERIOD_END_CENSORED: 0, MISSING: 0 },
    counts: new Map(),
    symbolsWithCandidate: new Set(),
    regimesWithCandidate: new Set(),
    foldsWithCandidate: new Set(),
    replaySourceErrors: [],
    canonicalIds: new Set(),
  };
}

function incrementStructuralCount(
  counts: MutableStructuralCounts,
  decision: R18ReplayDecision,
): void {
  counts.observationCount += 1;
  counts.statusCounts[decision.status] += 1;
  if (decision.status === "PROVENANCE_INCOMPLETE") counts.provenanceIncompleteCount += 1;
  const labelStatus = decision.h4LabelStatus;
  counts.labelStatusCounts[labelStatus] += 1;
  if (decision.status !== "BASELINE_FORMAL") return;
  counts.formalCount += 1;
  counts.controlCount += 1;
  if (decision.candidateRulePassed) counts.candidateCount += 1;
  const fold = decision.foldId ?? "OUTSIDE_VALIDATION";
  const regime = decision.btcRegime ?? "UNKNOWN";
  const bySymbol = counts.counts.get(fold) ?? new Map<string, Map<string, R18StructuralCell>>();
  const byRegime = bySymbol.get(decision.symbol) ?? new Map<string, R18StructuralCell>();
  const current = byRegime.get(regime) ?? { control: 0, candidate: 0, controlH4Executed: 0, candidateH4Executed: 0 };
  current.control += 1;
  if (labelStatus === "EXECUTED") current.controlH4Executed += 1;
  if (decision.candidateRulePassed) {
    current.candidate += 1;
    if (labelStatus === "EXECUTED") current.candidateH4Executed += 1;
    counts.symbolsWithCandidate.add(decision.symbol);
    counts.regimesWithCandidate.add(regime);
    counts.foldsWithCandidate.add(fold);
  }
  byRegime.set(regime, current);
  bySymbol.set(decision.symbol, byRegime);
  counts.counts.set(fold, bySymbol);
}

function serializableCounts(counts: MutableStructuralCounts): R18StructuralCounts {
  const byFold: Record<string, Record<string, Record<string, R18StructuralCell>>> = {};
  for (const [fold, bySymbol] of counts.counts) {
    byFold[fold] = {};
    for (const [symbol, byRegime] of bySymbol) {
      byFold[fold]![symbol] = {};
      for (const [regime, values] of byRegime) byFold[fold]![symbol]![regime] = { ...values };
    }
  }
  return Object.freeze({
    observationCount: counts.observationCount,
    statusCounts: Object.freeze({ ...counts.statusCounts }),
    formalCount: counts.formalCount,
    controlCount: counts.controlCount,
    candidateCount: counts.candidateCount,
    excludedByConsensusCount: counts.controlCount - counts.candidateCount,
    retentionRate: counts.controlCount === 0 ? 0 : counts.candidateCount / counts.controlCount,
    duplicateCanonicalCount: counts.duplicateCanonicalCount,
    invalidMetadataCount: counts.invalidMetadataCount,
    pointInTimeViolationCount: counts.pointInTimeViolationCount,
    provenanceIncompleteCount: counts.provenanceIncompleteCount,
    labelStatusCounts: Object.freeze({ ...counts.labelStatusCounts }),
    countsByFoldSymbolRegime: Object.freeze(byFold),
    symbolsWithCandidate: Object.freeze([...counts.symbolsWithCandidate].sort((left, right) => RESEARCH_SYMBOLS.indexOf(left) - RESEARCH_SYMBOLS.indexOf(right))),
    regimesWithCandidate: Object.freeze([...counts.regimesWithCandidate].sort()),
    foldsWithCandidate: Object.freeze([...counts.foldsWithCandidate].sort()),
    replaySourceErrors: Object.freeze([...counts.replaySourceErrors]),
  });
}

function findEvaluation(
  evaluations: ReadonlyMap<string, StrategyEvaluation>,
  metadata: R18ObservationMetadata,
): StrategyEvaluation | null {
  return evaluations.get(`${metadata.symbol}|${metadata.direction}`) ?? null;
}

function resolveAcceptedR14Path(root: string, input?: string): string {
  const candidates = [
    input,
    path.join(root, ROUND_018_OBSERVATION_SOURCE),
    path.resolve(root, "..", "round-014-r13-execution-replay", ROUND_018_OBSERVATION_SOURCE),
  ].filter((candidate): candidate is string => typeof candidate === "string");
  const candidate = candidates.find((value) => existsSync(value));
  if (!candidate) throw new Error("Accepted R14 observation cache is not available; refusing to acquire new data.");
  return path.resolve(candidate);
}

function resolveAcceptedR6CachePath(root: string, input?: string): string {
  const candidates = [
    input,
    path.join(root, ".cache", "tradepulse", "round-006"),
    path.resolve(root, "..", "round-006-profitability-rebuild", ".cache", "tradepulse", "round-006"),
  ].filter((candidate): candidate is string => typeof candidate === "string");
  const candidate = candidates.find((value) => existsSync(value));
  if (!candidate) throw new Error("Accepted Round-006 candle cache is not available; refusing to acquire new data.");
  return path.resolve(candidate);
}

function processReplayGroup(
  group: readonly R18ObservationMetadata[],
  indexes: ReturnType<typeof buildHistoricalIndexes>,
  provenance: R18AcceptedProvenance,
  counts: MutableStructuralCounts,
  formalRecords: R18StructuralObservationRecord[],
): void {
  if (group.length === 0) return;
  let evaluations: ReadonlyMap<string, StrategyEvaluation> = new Map();
  try {
    const input = buildStrategyInputFromIndexes(indexes, group[0]!.decisionTime);
    evaluations = indexR18EngineEvaluations(evaluateStrategy(input));
  } catch (error) {
    counts.replaySourceErrors.push(error instanceof Error ? error.message : String(error));
  }
  for (const metadata of group) {
    if (!metadata.metadataParseValid) counts.invalidMetadataCount += 1;
    if (metadata.decisionTime > R18_RESEARCH_END_TIME) counts.pointInTimeViolationCount += 1;
    const canonical = metadata.canonicalIdentityValid
      ? canonicalR18Identity(metadata.decisionTime, metadata.symbol, metadata.direction)
      : metadata.observationId;
    const duplicate = counts.canonicalIds.has(canonical);
    counts.canonicalIds.add(canonical);
    if (duplicate) counts.duplicateCanonicalCount += 1;
    const decision = classifyR18ReplayEvaluation(metadata, findEvaluation(evaluations, metadata), {
      acceptedSourceProvenanceValid: provenance.acceptedSourceProvenanceValid,
      acceptedSourceEngineSha256: provenance.engineSourceSha256,
      r14ObservationDataSha256: provenance.r14ObservationDataSha256,
    });
    const effectiveDecision = duplicate
      ? Object.freeze({ ...decision, status: "PROVENANCE_INCOMPLETE" as const, formalPredicatePassed: false, candidateRulePassed: false, anomalyCode: "DUPLICATE_CANONICAL_IDENTITY" })
      : decision;
    incrementStructuralCount(counts, effectiveDecision);
    if (effectiveDecision.status === "BASELINE_FORMAL") formalRecords.push(structuralRecordFromReplay(effectiveDecision));
  }
}

export async function materializeR18ObservationFreeze(input: Readonly<{
  root?: string;
  sourceObservationFile?: string;
  acceptedRound006CacheDirectory?: string;
}> = {}): Promise<R18ObservationFreezeManifest> {
  const root = path.resolve(input.root ?? process.cwd());
  const compactPath = path.join(root, ROUND_018_STRUCTURAL_OBSERVATION_SOURCE);
  const manifestPath = path.join(root, ROUND_018_STRUCTURAL_FREEZE_MANIFEST_PATH);
  if (existsSync(compactPath) || existsSync(manifestPath)) {
    if (!existsSync(compactPath) || !existsSync(manifestPath)) throw new Error("R18 structural freeze is partially present; refusing to overwrite it.");
    return readR18ObservationFreezeManifest(root);
  }
  const performanceOutputs = [
    "docs/M3_R18_ROUND_018_RESULTS.md",
    "docs/evidence/M3_R18_ROUND_018_SUMMARY.json",
    "docs/evidence/M3_R18_ROUND_018_AUDIT.json",
    "docs/evidence/M3_R18_ROUND_018_SELECTION.json",
    "docs/evidence/M3_R18_ROUND_018_SELECTION.md",
    "docs/research/round-018-performance-ledger.json",
  ];
  if (performanceOutputs.some((filePath) => existsSync(path.join(root, filePath)))) throw new Error("R18 performance or selection output exists; refusing to continue.");
  const design = JSON.parse(readFileSync(path.join(root, "docs/research/round-018-design.json"), "utf8")) as Parameters<typeof verifyR18AcceptedProvenance>[1];
  const provenance = verifyR18AcceptedProvenance(root, design);
  const sourceFile = resolveAcceptedR14Path(root, input.sourceObservationFile);
  const candleCache = resolveAcceptedR6CachePath(root, input.acceptedRound006CacheDirectory);
  const candleData = loadR18AcceptedCandleCache(candleCache);
  const indexes = buildHistoricalIndexes(candleData.datasets);
  const counts = mutableCounts();
  const formalRecords: R18StructuralObservationRecord[] = [];
  let currentTime: number | null = null;
  let group: R18ObservationMetadata[] = [];
  const sourceScan = await readMetadataLines(sourceFile, (line, lineNumber) => {
    const metadata = parseR18ObservationMetadataLine(line, lineNumber);
    if (currentTime !== null && metadata.decisionTime !== currentTime) {
      processReplayGroup(group, indexes, provenance, counts, formalRecords);
      group = [];
    }
    currentTime = metadata.decisionTime;
    group.push(metadata);
  });
  processReplayGroup(group, indexes, provenance, counts, formalRecords);
  if (sourceScan.lineCount !== ROUND_018_OBSERVATION_COUNT || sourceScan.bytes !== 1_893_811_055 || sourceScan.sha256 !== ROUND_018_OBSERVATION_SHA256 || sourceScan.sha256 !== provenance.r14ObservationDataSha256) {
    throw new Error(`R14 observation source identity mismatch: ${sourceScan.lineCount}/${sourceScan.bytes}/${sourceScan.sha256}`);
  }
  if (counts.observationCount !== ROUND_018_OBSERVATION_COUNT) throw new Error("R18 replay did not partition the complete R14 population.");
  const structuralCounts = serializableCounts(counts);
  const baseManifest = {
    schemaVersion: R18_SCHEMA_VERSION,
    researchRoundId: ROUND_018_RESEARCH_ROUND_ID,
    acceptedSourceCommit: provenance.acceptedSourceCommit,
    observationSource: {
      path: ROUND_018_OBSERVATION_SOURCE,
      manifestPath: ROUND_018_R14_MANIFEST_SOURCE,
      observationCount: sourceScan.lineCount,
      bytes: sourceScan.bytes,
      sha256: sourceScan.sha256,
      sourceStatus: provenance.acceptedSourceProvenanceValid ? "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE" : "INVALID_PROVENANCE",
    },
    acceptedCandleCache: {
      path: candleCache,
      sourceStatus: "ACCEPTED_EXISTING_ROUND006_CANDLE_CACHE",
      pageCount: candleData.pageCount,
      timeframes: ["1h", "4h"] as const,
      networkAcquired: false as const,
    },
    compactStructuralObservation: {
      path: ROUND_018_STRUCTURAL_OBSERVATION_SOURCE,
      bytes: 0,
      sha256: "",
      formalOnly: true as const,
      economicValuesRead: false as const,
    },
    counts: structuralCounts,
    integrity: {
      allPopulationPartitioned: structuralCounts.observationCount === ROUND_018_OBSERVATION_COUNT,
      duplicateCanonicalCount: structuralCounts.duplicateCanonicalCount,
      provenanceIncompleteCount: structuralCounts.provenanceIncompleteCount,
      pointInTimeViolationCount: structuralCounts.pointInTimeViolationCount,
      economicFieldsRead: false as const,
      economicValuesCalculated: false as const,
      economicValuesInspected: false as const,
    },
    performanceExecutionCount: 0 as const,
    performanceLedgerPresent: false as const,
    performanceExecuted: false as const,
    selectionExecuted: false as const,
    productionUnchanged: true as const,
    baseline002Status: "NOT_FROZEN" as const,
    m3JStatus: "BLOCKED" as const,
    m4Status: "NOT_STARTED" as const,
    automaticTrading: false as const,
  };
  const dataLines = formalRecords
    .sort((left, right) => left.decisionTime - right.decisionTime || RESEARCH_SYMBOLS.indexOf(left.symbol) - RESEARCH_SYMBOLS.indexOf(right.symbol) || (left.direction === "LONG" ? -1 : 1))
    .map((record) => `${stableStringify(record)}\n`)
    .join("");
  const compactBytes = Buffer.byteLength(dataLines, "utf8");
  const manifest = {
    ...baseManifest,
    compactStructuralObservation: {
      ...baseManifest.compactStructuralObservation,
      bytes: compactBytes,
      sha256: sha256(dataLines),
    },
  };
  const manifestWithHash = {
    ...manifest,
    manifestSha256: hashStable({ ...manifest, manifestSha256: null }),
  } as R18ObservationFreezeManifest;
  publishR18StructuralArtifactsAtomically(root, dataLines, manifestWithHash);
  return manifestWithHash;
}

export function publishR18StructuralArtifactsAtomically(
  root: string,
  data: string,
  manifest: R18ObservationFreezeManifest,
): void {
  const dataTarget = path.join(root, ROUND_018_STRUCTURAL_OBSERVATION_SOURCE);
  const manifestTarget = path.join(root, ROUND_018_STRUCTURAL_FREEZE_MANIFEST_PATH);
  const dataParent = path.dirname(dataTarget);
  mkdirSync(dataParent, { recursive: true });
  mkdirSync(path.dirname(manifestTarget), { recursive: true });
  if (existsSync(dataTarget) || existsSync(manifestTarget)) throw new Error("R18 structural output already exists; refusing to overwrite it.");
  const staging = mkdtempSync(path.join(dataParent, ".r18-structural-staging-"));
  const stagedData = path.join(staging, "observations.ndjson");
  const stagedManifest = path.join(staging, "round-018-observation-freeze.json");
  let dataPublished = false;
  try {
    writeFileSync(stagedData, data, "utf8");
    fsyncFile(stagedData);
    if (existsSync(dataTarget)) throw new Error("R18 structural data appeared before publication.");
    renameSync(stagedData, dataTarget);
    dataPublished = true;
    writeFileSync(stagedManifest, stableStringify(manifest), "utf8");
    fsyncFile(stagedManifest);
    if (existsSync(manifestTarget)) throw new Error("R18 structural manifest appeared before publication.");
    renameSync(stagedManifest, manifestTarget);
  } catch (error) {
    if (dataPublished && !existsSync(manifestTarget)) rmSync(dataTarget, { force: true });
    throw error;
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function readR18ObservationFreezeManifest(root = process.cwd()): R18ObservationFreezeManifest {
  const manifestPath = path.join(path.resolve(root), ROUND_018_STRUCTURAL_FREEZE_MANIFEST_PATH);
  if (!existsSync(manifestPath)) throw new Error(`R18 structural freeze manifest is missing: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as R18ObservationFreezeManifest;
  if (manifest.schemaVersion !== R18_SCHEMA_VERSION || manifest.researchRoundId !== ROUND_018_RESEARCH_ROUND_ID) throw new Error("R18 structural freeze manifest identity mismatch.");
  if (manifest.manifestSha256 !== hashStable({ ...manifest, manifestSha256: null })) throw new Error("R18 structural freeze manifest checksum mismatch.");
  const dataPath = path.join(path.resolve(root), manifest.compactStructuralObservation.path);
  if (!existsSync(dataPath)) throw new Error("R18 compact structural observation is missing.");
  const data = readFileSync(dataPath);
  if (data.byteLength !== manifest.compactStructuralObservation.bytes || sha256(data) !== manifest.compactStructuralObservation.sha256) throw new Error("R18 compact structural observation checksum mismatch.");
  return manifest;
}

export function verifyR18StructuralRecord(record: unknown): record is R18StructuralObservationRecord {
  if (typeof record !== "object" || record === null) return false;
  const value = record as Record<string, unknown>;
  return value.schemaVersion === "m3-r18-round-018-structural-observation-001"
    && value.replayStatus === "BASELINE_FORMAL"
    && value.controlIncluded === true
    && typeof value.totalScore === "number"
    && Number.isFinite(value.totalScore)
    && typeof value.scoreBreakdown === "object"
    && value.scoreBreakdown !== null;
}
