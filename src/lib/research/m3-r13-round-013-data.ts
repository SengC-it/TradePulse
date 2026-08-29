import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { type ResearchSymbol } from "../config/constants.ts";
import { BinancePublicClient, type BinancePublicClientOptions, type BinanceResponse } from "../market-data/binance/client.ts";
import { parseBinanceIntrabarKlines } from "../historical-data/binance/intrabar.ts";
import { createRound006HistoricalLoader, type Round006DataAcquisitionOptions } from "./m3-r6-round-006-data.ts";
import { buildRound006HistoricalLoadRanges, toBacktestData } from "./m3-r6-round-006-performance.ts";
import type { BacktestData } from "../backtest/types.ts";
import type { IntrabarSettlementCandle } from "../historical-data/types.ts";
import { M3_R13_RESEARCH_END_ISO, M3_R13_RESEARCH_START_ISO, M3_R13_RESEARCH_ROUND_ID, R13_SYMBOLS } from "./m3-r13-round-013-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R13_PAGE_CACHE_SCHEMA_VERSION = "m3-r13-round-013-1m-page-cache-001" as const;
export const R13_DEFAULT_CACHE_DIRECTORY = path.join(".cache", "tradepulse", "round-013");
export const R13_ONE_MINUTE_START_TIME = Date.parse(M3_R13_RESEARCH_START_ISO);
export const R13_ONE_MINUTE_END_TIME = Date.parse(M3_R13_RESEARCH_END_ISO);
export const R13_ONE_MINUTE_PAGE_LIMIT = 1_500 as const;

export type R13OneMinutePageIdentity = Readonly<{
  schemaVersion: typeof R13_PAGE_CACHE_SCHEMA_VERSION;
  provider: "binance-usdm-public";
  endpoint: "/fapi/v1/klines";
  dataType: "candles-1m";
  symbol: ResearchSymbol;
  timeframe: "1m";
  startTime: number;
  endTime: number;
  limit: number;
  researchRoundId: typeof M3_R13_RESEARCH_ROUND_ID;
}>;

export type R13OneMinutePageEnvelope = Readonly<{
  schemaVersion: typeof R13_PAGE_CACHE_SCHEMA_VERSION;
  identity: R13OneMinutePageIdentity;
  payload: readonly IntrabarSettlementCandle[];
  payloadSha256: string;
}>;

export type R13OneMinuteManifest = Readonly<{
  schemaVersion: "m3-r13-round-013-1m-manifest-001";
  symbol: ResearchSymbol;
  requestedStartTime: number;
  requestedEndTime: number;
  pageCount: number;
  rowCount: number;
  firstOpenTime: number;
  lastOpenTime: number;
  checksum: string;
  source: "/fapi/v1/klines";
}>;

export type R13PreparedDataset = Readonly<{
  coarseData: BacktestData;
  oneMinute: Readonly<Record<ResearchSymbol, readonly IntrabarSettlementCandle[]>>;
  manifests: readonly R13OneMinuteManifest[];
  datasetFreeze: R13DatasetFreeze;
}>;

export type R13DatasetFreeze = Readonly<{
  schemaVersion: "m3-r13-round-013-dataset-freeze-001";
  dataFreezeCompleted: true;
  datasetIdentitySha256: string;
  manifestIdentitySha256: string;
  symbols: readonly ResearchSymbol[];
  oneMinuteCoverage: Readonly<{ startTime: number; endTime: number; completeSymbols: readonly ResearchSymbol[] }>;
  coarseManifestCount: number;
  oneMinuteManifestCount: number;
  purgeEmbargoHours: 24;
  postLockMarketFetchPossible: false;
  integrityErrors: readonly string[];
}>;

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function cacheIdentity(symbol: ResearchSymbol, startTime: number, endTime: number, limit: number): R13OneMinutePageIdentity {
  return Object.freeze({ schemaVersion: R13_PAGE_CACHE_SCHEMA_VERSION, provider: "binance-usdm-public", endpoint: "/fapi/v1/klines", dataType: "candles-1m", symbol, timeframe: "1m", startTime, endTime, limit, researchRoundId: M3_R13_RESEARCH_ROUND_ID });
}

export function r13OneMinuteCachePath(cacheDirectory: string, identity: R13OneMinutePageIdentity): string {
  return path.join(path.resolve(cacheDirectory), `${sha256(identity)}.json`);
}

function validateOneMinutePage(page: readonly IntrabarSettlementCandle[], identity: R13OneMinutePageIdentity): void {
  if (page.length === 0 || page[0]!.openTime !== identity.startTime) throw new Error(`R13 1m page does not begin at its cursor for ${identity.symbol}.`);
  for (let index = 0; index < page.length; index += 1) {
    const candle = page[index]!;
    if (candle.symbol !== identity.symbol || candle.timeframe !== "1m" || candle.openTime < identity.startTime || candle.openTime > identity.endTime || candle.closeTime !== candle.openTime + 59_999) throw new Error(`R13 1m page contains an invalid range row for ${identity.symbol}.`);
    if (index > 0 && candle.openTime !== page[index - 1]!.openTime + 60_000) throw new Error(`R13 1m page contains a gap or duplicate for ${identity.symbol}.`);
  }
}

function readPage(cacheDirectory: string, identity: R13OneMinutePageIdentity): readonly IntrabarSettlementCandle[] | null {
  const filePath = r13OneMinuteCachePath(cacheDirectory, identity);
  if (!existsSync(filePath)) return null;
  const envelope = JSON.parse(readFileSync(filePath, "utf8")) as R13OneMinutePageEnvelope;
  if (envelope.schemaVersion !== R13_PAGE_CACHE_SCHEMA_VERSION || stableStringify(envelope.identity) !== stableStringify(identity) || envelope.payloadSha256 !== sha256(envelope.payload)) throw new Error(`R13 1m cache identity/checksum mismatch: ${filePath}`);
  const page = envelope.payload;
  validateOneMinutePage(page, identity);
  return page;
}

function writePage(cacheDirectory: string, identity: R13OneMinutePageIdentity, payload: readonly IntrabarSettlementCandle[]): void {
  mkdirSync(path.resolve(cacheDirectory), { recursive: true });
  const target = r13OneMinuteCachePath(cacheDirectory, identity);
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, stableStringify({ schemaVersion: R13_PAGE_CACHE_SCHEMA_VERSION, identity, payload, payloadSha256: sha256(payload) }), "utf8");
  renameSync(temporary, target);
}

function cachedDiagnostics(endpoint: string): { endpoint: string; operationStartedAt: number; attemptStartedAt: number; attemptCompletedAt: number; roundTripMs: number; attempts: number } {
  return { endpoint, operationStartedAt: 0, attemptStartedAt: 0, attemptCompletedAt: 0, roundTripMs: 0, attempts: 1 };
}

export class R13OneMinuteCachedClient extends BinancePublicClient {
  readonly cacheDirectory: string;
  readonly allowNetworkAcquisition: boolean;

  constructor(options: Readonly<{ cacheDirectory: string; clientOptions?: BinancePublicClientOptions; allowNetworkAcquisition?: boolean }> ) {
    super(options.clientOptions);
    this.cacheDirectory = options.cacheDirectory;
    this.allowNetworkAcquisition = options.allowNetworkAcquisition ?? true;
  }

  override async getOneMinuteKlinesRange(symbol: ResearchSymbol, startTime: number, endTime: number, limit: number = R13_ONE_MINUTE_PAGE_LIMIT): Promise<BinanceResponse<unknown>> {
    const identity = cacheIdentity(symbol, startTime, endTime, limit);
    const cached = readPage(this.cacheDirectory, identity);
    if (cached) return { data: cached, diagnostics: cachedDiagnostics(identity.endpoint) };
    if (!this.allowNetworkAcquisition) throw new Error(`R13 acquisition is missing a cached 1m page for ${symbol} at ${startTime}.`);
    const response = await super.getOneMinuteKlinesRange(symbol, startTime, endTime, limit);
    const parsed = parseBinanceIntrabarKlines(response.data, symbol);
    validateOneMinutePage(parsed, identity);
    writePage(this.cacheDirectory, identity, parsed);
    return response;
  }
}

export async function loadR13OneMinuteRange(input: Readonly<{ client: R13OneMinuteCachedClient; symbol: ResearchSymbol; startTime?: number; endTime?: number; limit?: number }>): Promise<Readonly<{ candles: readonly IntrabarSettlementCandle[]; manifest: R13OneMinuteManifest }>> {
  const startTime = input.startTime ?? R13_ONE_MINUTE_START_TIME;
  const endTime = input.endTime ?? R13_ONE_MINUTE_END_TIME;
  const limit = input.limit ?? R13_ONE_MINUTE_PAGE_LIMIT;
  if (startTime % 60_000 !== 0 || endTime < startTime) throw new Error("R13 1m range must be aligned and ordered.");
  const candles: IntrabarSettlementCandle[] = [];
  let cursor = startTime;
  let pageCount = 0;
  const lastOpenTime = Math.floor(endTime / 60_000) * 60_000;
  while (cursor <= lastOpenTime) {
    const pageLastOpen = Math.min(lastOpenTime, cursor + (limit - 1) * 60_000);
    const pageEnd = pageLastOpen + 59_999;
    const page = (await input.client.getOneMinuteKlinesRange(input.symbol, cursor, pageEnd, limit)).data as readonly IntrabarSettlementCandle[];
    validateOneMinutePage(page, cacheIdentity(input.symbol, cursor, pageEnd, limit));
    if (page.at(-1)!.openTime !== pageLastOpen) throw new Error(`R13 1m page is incomplete at ${cursor} for ${input.symbol}.`);
    candles.push(...page);
    pageCount += 1;
    cursor = pageLastOpen + 60_000;
  }
  const manifest = Object.freeze({ schemaVersion: "m3-r13-round-013-1m-manifest-001" as const, symbol: input.symbol, requestedStartTime: startTime, requestedEndTime: endTime, pageCount, rowCount: candles.length, firstOpenTime: candles[0]!.openTime, lastOpenTime: candles.at(-1)!.openTime, checksum: sha256(candles), source: "/fapi/v1/klines" as const });
  return Object.freeze({ candles: Object.freeze(candles), manifest });
}

export function locateAcceptedRound006Cache(cwd = process.cwd()): string | null {
  const candidates = [
    process.env.TRADEPULSE_ROUND006_CACHE,
    path.join(cwd, ".cache", "tradepulse", "round-006"),
    ...[
      "round-006-profitability-rebuild",
      "round-007-model-rebuild",
      "round-008-protocol-replay",
      "round-009-spec-conformance-replay",
      "round-010-risk-geometry-replay",
      "round-011-event-predicate-replay",
    ].map((worktree) => path.resolve(cwd, "..", worktree, ".cache", "tradepulse", "round-006")),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function r13DatasetIdentity(input: Readonly<{ coarseData: BacktestData; oneMinuteManifests: readonly R13OneMinuteManifest[]; serverTime: number }>): string {
  const manifests = [...input.coarseData.manifests, ...input.oneMinuteManifests].map((manifest) => { const copy = { ...manifest } as Record<string, unknown>; delete copy.retrievedAt; return copy; }).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  return sha256({ schemaVersion: "m3-r13-round-013-dataset-freeze-001", researchRoundId: M3_R13_RESEARCH_ROUND_ID, serverTime: input.serverTime, manifests, purgeEmbargoHours: 24, oneMinuteRange: { startTime: R13_ONE_MINUTE_START_TIME, endTime: R13_ONE_MINUTE_END_TIME } });
}

export function freezeR13Dataset(input: Readonly<{ coarseData: BacktestData; oneMinute: Readonly<Record<ResearchSymbol, readonly IntrabarSettlementCandle[]>>; manifests: readonly R13OneMinuteManifest[]; serverTime: number }>): R13DatasetFreeze {
  const errors: string[] = [];
  for (const symbol of R13_SYMBOLS) {
    const candles = input.oneMinute[symbol] ?? [];
    if (candles.length === 0 || candles[0]!.openTime !== R13_ONE_MINUTE_START_TIME || candles.at(-1)!.openTime !== Math.floor(R13_ONE_MINUTE_END_TIME / 60_000) * 60_000) errors.push(`INCOMPLETE_1M_COVERAGE:${symbol}`);
    try { validateOneMinutePage(candles, cacheIdentity(symbol, R13_ONE_MINUTE_START_TIME, R13_ONE_MINUTE_END_TIME, candles.length)); } catch (error) { errors.push(`INVALID_1M_COVERAGE:${symbol}:${error instanceof Error ? error.message : String(error)}`); }
  }
  if (input.manifests.length !== R13_SYMBOLS.length) errors.push("MISSING_1M_MANIFEST");
  if (errors.length > 0) throw new Error(`R13 dataset freeze failed: ${[...new Set(errors)].join("; ")}`);
  const datasetIdentitySha256 = r13DatasetIdentity({ coarseData: input.coarseData, oneMinuteManifests: input.manifests, serverTime: input.serverTime });
  return Object.freeze({ schemaVersion: "m3-r13-round-013-dataset-freeze-001", dataFreezeCompleted: true, datasetIdentitySha256, manifestIdentitySha256: sha256(input.manifests), symbols: R13_SYMBOLS, oneMinuteCoverage: { startTime: R13_ONE_MINUTE_START_TIME, endTime: R13_ONE_MINUTE_END_TIME, completeSymbols: R13_SYMBOLS }, coarseManifestCount: input.coarseData.manifests.length, oneMinuteManifestCount: input.manifests.length, purgeEmbargoHours: 24, postLockMarketFetchPossible: false, integrityErrors: Object.freeze([]) });
}

export async function prepareR13Dataset(input: Readonly<{ cacheDirectory: string; acceptedCoarseCacheDirectory?: string; clientOptions?: BinancePublicClientOptions; fetchMissingOneMinute?: boolean }>): Promise<R13PreparedDataset> {
  const coarseCacheDirectory = input.acceptedCoarseCacheDirectory ?? locateAcceptedRound006Cache();
  if (!coarseCacheDirectory) throw new Error("R13 acquisition cannot start: accepted Round-006 coarse cache is unavailable.");
  const coarseAcquisition: Round006DataAcquisitionOptions = { cacheDirectory: coarseCacheDirectory, clientOptions: input.clientOptions };
  const coarseLoader = createRound006HistoricalLoader(coarseAcquisition).loader;
  const study = await coarseLoader.loadStudyData({ ...buildRound006HistoricalLoadRanges(), policy: "bt-policy-003" });
  const coarseData = toBacktestData(study);
  const oneMinuteClient = new R13OneMinuteCachedClient({ cacheDirectory: input.cacheDirectory, clientOptions: input.clientOptions, allowNetworkAcquisition: input.fetchMissingOneMinute !== false });
  const oneMinute = {} as Record<ResearchSymbol, readonly IntrabarSettlementCandle[]>;
  const manifests: R13OneMinuteManifest[] = [];
  for (const symbol of R13_SYMBOLS) {
    if (input.fetchMissingOneMinute === false && !existsSync(path.resolve(input.cacheDirectory))) throw new Error(`R13 acquisition cache is missing for ${symbol}.`);
    const loaded = await loadR13OneMinuteRange({ client: oneMinuteClient, symbol });
    oneMinute[symbol] = loaded.candles;
    manifests.push(loaded.manifest);
  }
  const datasetFreeze = freezeR13Dataset({ coarseData, oneMinute, manifests, serverTime: study.serverTime });
  return Object.freeze({ coarseData, oneMinute: Object.freeze(oneMinute), manifests: Object.freeze(manifests), datasetFreeze });
}
