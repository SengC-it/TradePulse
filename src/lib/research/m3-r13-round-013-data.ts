import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import {
  BinancePublicClient,
  type BinancePublicClientOptions,
  type BinanceResponse,
} from "../market-data/binance/client.ts";
import { BinanceHistoricalDataLoader } from "../historical-data/binance/loader.ts";
import { parseBinanceFundingRateHistory } from "../historical-data/binance/parser.ts";
import { parseBinanceIntrabarKlines } from "../historical-data/binance/intrabar.ts";
import { validateFundingRecords } from "../historical-data/validation.ts";
import type { HistoricalFundingRecord, IntrabarSettlementCandle } from "../historical-data/types.ts";
import { R13OneMinuteIndexedSeries } from "./m3-r13-round-013-index.ts";
import {
  M3_R13_POLICY_VERSION,
  M3_R13_RESEARCH_END_ISO,
  M3_R13_RESEARCH_ROUND_ID,
  M3_R13_RESEARCH_START_ISO,
  R13_SYMBOLS,
} from "./m3-r13-round-013-protocol.ts";
import {
  R13_FEATURE_SPEC_SHA256,
  R13_MODEL_SPEC_SHA256,
  R13_PLAN_SHA256,
} from "./m3-r13-round-013-plan.ts";
import { R13_SPEC_CONFORMANCE_SHA256 } from "./m3-r13-round-013-conformance.ts";
import { R13_SELECTION_GATE_SHA256 } from "./selection-gates-round-013.ts";
import {
  downloadR13VisionFundingArchive,
  downloadR13VisionKlineArchive,
  isR13VisionArchiveUnavailable,
  type R13ArchiveFetchOptions,
  type R13VisionArchiveProvenance,
  type R13VisionArchiveRequest,
} from "./m3-r13-round-013-archives.ts";
import {
  buildRound006HistoricalLoadRanges,
  toBacktestData,
} from "./m3-r6-round-006-performance.ts";
import {
  Round006CachedBinanceClient,
  type Round006DataAcquisitionOptions,
} from "./m3-r6-round-006-data.ts";
import type { BacktestData } from "../backtest/types.ts";
import { stableStringify } from "./utils.ts";

export const R13_PAGE_CACHE_SCHEMA_VERSION = "m3-r13-round-013-1m-page-cache-001" as const;
export const R13_DEFAULT_CACHE_DIRECTORY = path.join(".cache", "tradepulse", "round-013");
export const R13_ONE_MINUTE_START_TIME = Date.parse(M3_R13_RESEARCH_START_ISO);
export const R13_ONE_MINUTE_END_TIME = Date.parse(M3_R13_RESEARCH_END_ISO);
export const R13_ONE_MINUTE_PAGE_LIMIT = 1_500 as const;

// The accepted R6 study includes a 48-hour settlement tail. This captured
// validation time is used only for offline semantic validation of that tail.
export const R13_HISTORICAL_VALIDATION_SERVER_TIME =
  R13_ONE_MINUTE_END_TIME + 48 * 60 * 60_000 + 1;

export const R13_ACQUISITION_SOURCES = Object.freeze([
  "ACCEPTED_EXISTING_CACHE",
  "BINANCE_VISION_ARCHIVE",
  "BINANCE_PUBLIC_REST_FALLBACK",
] as const);
export type R13AcquisitionSource = (typeof R13_ACQUISITION_SOURCES)[number];
const R13_ACCEPTED_CACHE_LABEL = "accepted-round-006-cache" as const;

export type R13CoarseNetworkMode = "READ_ONLY_OFFLINE";
export type R13OneMinuteNetworkMode = "ALL_NETWORK_DISABLED" | "NETWORK_ALLOWED_PRELOCK";
export type R13FundingNetworkMode =
  | "ALL_NETWORK_DISABLED"
  | "NETWORK_ALLOWED_PRELOCK_ONLY_IF_REQUIRED";

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
  source?: R13AcquisitionSource;
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
  source: R13AcquisitionSource | "MIXED";
  sources: readonly R13AcquisitionSource[];
}>;

export type R13AcquisitionManifest = Readonly<{
  schemaVersion: "m3-r13-round-013-acquisition-manifest-001";
  acceptedCoarseCacheDirectory: string;
  acceptedCoarseCacheIdentitySha256: string;
  acceptedCoarseCacheReadOnlyVerified: boolean;
  sources: readonly R13AcquisitionSource[];
  archives: readonly R13VisionArchiveProvenance[];
  bulkArchiveChecksumVerified: boolean;
  fundingSourceSemanticIdentityVerified: boolean;
  archiveRestKlineSemanticIdentityVerified: boolean;
  acquisitionSourcesDeterministic: boolean;
  restFallbackOnlyWhenRequired: boolean;
  visionCanOperateWithoutRest: boolean;
  restFallbackRequests: number;
}>;

export type R13PreparedDataset = Readonly<{
  coarseData: BacktestData;
  oneMinute: Readonly<Record<ResearchSymbol, readonly IntrabarSettlementCandle[]>>;
  oneMinuteIndexed: Readonly<Record<ResearchSymbol, R13OneMinuteIndexedSeries>>;
  manifests: readonly R13OneMinuteManifest[];
  acquisition: R13AcquisitionManifest;
  datasetFreeze: R13DatasetFreeze;
}>;

export type R13DatasetFreeze = Readonly<{
  schemaVersion: "m3-r13-round-013-dataset-freeze-001";
  dataFreezeCompleted: true;
  researchRoundId: typeof M3_R13_RESEARCH_ROUND_ID;
  researchBoundary: typeof M3_R13_RESEARCH_END_ISO;
  coarsePolicyVersion: typeof M3_R13_POLICY_VERSION;
  featureSpecSha256: string;
  modelSpecSha256: string;
  gateSha256: string;
  planSha256: string;
  conformanceSha256: string;
  datasetIdentitySha256: string;
  manifestIdentitySha256: string;
  symbols: readonly ResearchSymbol[];
  oneMinuteCoverage: Readonly<{
    startTime: number;
    endTime: number;
    completeSymbols: readonly ResearchSymbol[];
  }>;
  coarseManifestCount: number;
  oneMinuteManifestCount: number;
  acquisition: R13AcquisitionManifest;
  purgeEmbargoHours: 24;
  postLockMarketFetchPossible: false;
  integrityErrors: readonly string[];
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function byteHash(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function cacheIdentity(
  symbol: ResearchSymbol,
  startTime: number,
  endTime: number,
  limit: number,
): R13OneMinutePageIdentity {
  return Object.freeze({
    schemaVersion: R13_PAGE_CACHE_SCHEMA_VERSION,
    provider: "binance-usdm-public",
    endpoint: "/fapi/v1/klines",
    dataType: "candles-1m",
    symbol,
    timeframe: "1m",
    startTime,
    endTime,
    limit,
    researchRoundId: M3_R13_RESEARCH_ROUND_ID,
  });
}

export function r13OneMinuteCachePath(
  cacheDirectory: string,
  identity: R13OneMinutePageIdentity,
): string {
  return path.join(path.resolve(cacheDirectory), `${hash(identity)}.json`);
}

function isAcquisitionSource(value: unknown): value is R13AcquisitionSource {
  return (R13_ACQUISITION_SOURCES as readonly unknown[]).includes(value);
}

function orderSources(sources: readonly R13AcquisitionSource[]): readonly R13AcquisitionSource[] {
  return Object.freeze(
    R13_ACQUISITION_SOURCES.filter((source) => sources.includes(source)),
  );
}

function validateOneMinutePage(
  page: readonly IntrabarSettlementCandle[],
  identity: R13OneMinutePageIdentity,
): void {
  if (page.length === 0 || page[0]!.openTime !== identity.startTime) {
    throw new Error(`R13 1m page does not begin at its cursor for ${identity.symbol}.`);
  }
  for (let index = 0; index < page.length; index += 1) {
    const candle = page[index]!;
    if (
      candle.symbol !== identity.symbol
      || candle.timeframe !== "1m"
      || !Number.isSafeInteger(candle.openTime)
      || candle.openTime < identity.startTime
      || candle.openTime > identity.endTime
      || candle.closeTime !== candle.openTime + 59_999
    ) {
      throw new Error(`R13 1m page contains an invalid range row for ${identity.symbol}.`);
    }
    if (index > 0 && candle.openTime !== page[index - 1]!.openTime + 60_000) {
      throw new Error(`R13 1m page contains a gap or duplicate for ${identity.symbol}.`);
    }
  }
}

export function validateR13OneMinuteSeries(
  candles: readonly IntrabarSettlementCandle[],
  symbol: ResearchSymbol,
): void {
  const lastOpenTime = Math.floor(R13_ONE_MINUTE_END_TIME / 60_000) * 60_000;
  if (
    candles.length === 0
    || candles[0]!.openTime !== R13_ONE_MINUTE_START_TIME
    || candles.at(-1)!.openTime !== lastOpenTime
  ) {
    throw new Error(`R13 1m series has incomplete coverage for ${symbol}.`);
  }
  const expectedRows = Math.floor((lastOpenTime - R13_ONE_MINUTE_START_TIME) / 60_000) + 1;
  if (candles.length !== expectedRows) {
    throw new Error(`R13 1m series row count is incomplete for ${symbol}.`);
  }
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    if (
      candle.symbol !== symbol
      || candle.timeframe !== "1m"
      || candle.closeTime !== candle.openTime + 59_999
      || (index > 0 && candle.openTime !== candles[index - 1]!.openTime + 60_000)
    ) {
      throw new Error(`R13 1m series contains a chronology or semantic error for ${symbol}.`);
    }
  }
}

type R13CachedPage = Readonly<{
  payload: readonly IntrabarSettlementCandle[];
  source: R13AcquisitionSource;
}>;

function readPage(
  cacheDirectory: string,
  identity: R13OneMinutePageIdentity,
): R13CachedPage | null {
  const filePath = r13OneMinuteCachePath(cacheDirectory, identity);
  if (!existsSync(filePath)) return null;
  const envelope = JSON.parse(readFileSync(filePath, "utf8")) as R13OneMinutePageEnvelope;
  if (
    envelope.schemaVersion !== R13_PAGE_CACHE_SCHEMA_VERSION
    || stableStringify(envelope.identity) !== stableStringify(identity)
    || envelope.payloadSha256 !== hash(envelope.payload)
  ) {
    throw new Error(`R13 1m cache identity/checksum mismatch: ${filePath}`);
  }
  validateOneMinutePage(envelope.payload, identity);
  return Object.freeze({
    payload: envelope.payload,
    source: isAcquisitionSource(envelope.source)
      ? envelope.source
      : "BINANCE_PUBLIC_REST_FALLBACK",
  });
}

function writePage(
  cacheDirectory: string,
  identity: R13OneMinutePageIdentity,
  payload: readonly IntrabarSettlementCandle[],
  source: R13AcquisitionSource,
): void {
  mkdirSync(path.resolve(cacheDirectory), { recursive: true });
  const target = r13OneMinuteCachePath(cacheDirectory, identity);
  const staging = mkdtempSync(path.join(path.resolve(cacheDirectory), ".r13-page-staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    validateOneMinutePage(payload, identity);
    writeFileSync(
      temporary,
      stableStringify({
        schemaVersion: R13_PAGE_CACHE_SCHEMA_VERSION,
        identity,
        payload,
        payloadSha256: hash(payload),
        source,
      } satisfies R13OneMinutePageEnvelope),
      "utf8",
    );
    if (existsSync(target)) {
      try {
        readPage(cacheDirectory, identity);
        return;
      } catch {
        unlinkSync(target);
      }
    }
    renameSync(temporary, target);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function cachedDiagnostics(endpoint: string): {
  endpoint: string;
  operationStartedAt: number;
  attemptStartedAt: number;
  attemptCompletedAt: number;
  roundTripMs: number;
  attempts: number;
} {
  return {
    endpoint,
    operationStartedAt: 0,
    attemptStartedAt: 0,
    attemptCompletedAt: 0,
    roundTripMs: 0,
    attempts: 1,
  };
}

export class R13OneMinuteCachedClient extends BinancePublicClient {
  readonly cacheDirectory: string;
  readonly allowNetworkAcquisition: boolean;
  networkFallbackRequests = 0;

  constructor(
    options: Readonly<{
      cacheDirectory: string;
      clientOptions?: BinancePublicClientOptions;
      allowNetworkAcquisition?: boolean;
    }>,
  ) {
    super(options.clientOptions);
    this.cacheDirectory = path.resolve(options.cacheDirectory);
    this.allowNetworkAcquisition = options.allowNetworkAcquisition ?? true;
  }

  getCachedPageSource(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
    limit: number = R13_ONE_MINUTE_PAGE_LIMIT,
  ): R13AcquisitionSource | null {
    return readPage(this.cacheDirectory, cacheIdentity(symbol, startTime, endTime, limit))?.source ?? null;
  }

  override async getOneMinuteKlinesRange(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
    limit: number = R13_ONE_MINUTE_PAGE_LIMIT,
  ): Promise<BinanceResponse<unknown>> {
    const identity = cacheIdentity(symbol, startTime, endTime, limit);
    const cached = readPage(this.cacheDirectory, identity);
    if (cached) return { data: cached.payload, diagnostics: cachedDiagnostics(identity.endpoint) };
    if (!this.allowNetworkAcquisition) {
      throw new Error(`R13 acquisition is missing a cached 1m page for ${symbol} at ${startTime}.`);
    }
    this.networkFallbackRequests += 1;
    const response = await super.getOneMinuteKlinesRange(symbol, startTime, endTime, limit);
    const parsed = parseBinanceIntrabarKlines(response.data, symbol);
    validateOneMinutePage(parsed, identity);
    writePage(this.cacheDirectory, identity, parsed, "BINANCE_PUBLIC_REST_FALLBACK");
    return { data: parsed, diagnostics: response.diagnostics };
  }
}

export async function loadR13OneMinuteRange(
  input: Readonly<{
    client: R13OneMinuteCachedClient;
    symbol: ResearchSymbol;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }>,
): Promise<Readonly<{ candles: readonly IntrabarSettlementCandle[]; manifest: R13OneMinuteManifest }>> {
  const startTime = input.startTime ?? R13_ONE_MINUTE_START_TIME;
  const endTime = input.endTime ?? R13_ONE_MINUTE_END_TIME;
  const limit = input.limit ?? R13_ONE_MINUTE_PAGE_LIMIT;
  if (startTime % 60_000 !== 0 || endTime < startTime) {
    throw new Error("R13 1m range must be aligned and ordered.");
  }
  const candles: IntrabarSettlementCandle[] = [];
  const sources: R13AcquisitionSource[] = [];
  let cursor = startTime;
  let pageCount = 0;
  const lastOpenTime = Math.floor(endTime / 60_000) * 60_000;
  while (cursor <= lastOpenTime) {
    const pageLastOpen = Math.min(lastOpenTime, cursor + (limit - 1) * 60_000);
    const pageEnd = pageLastOpen + 59_999;
    const identity = cacheIdentity(input.symbol, cursor, pageEnd, limit);
    const page = (await input.client.getOneMinuteKlinesRange(
      input.symbol,
      cursor,
      pageEnd,
      limit,
    )).data as readonly IntrabarSettlementCandle[];
    validateOneMinutePage(page, identity);
    if (page.at(-1)!.openTime !== pageLastOpen) {
      throw new Error(`R13 1m page is incomplete at ${cursor} for ${input.symbol}.`);
    }
    candles.push(...page);
    const source = input.client.getCachedPageSource(input.symbol, cursor, pageEnd, limit);
    sources.push(source ?? "BINANCE_PUBLIC_REST_FALLBACK");
    pageCount += 1;
    cursor = pageLastOpen + 60_000;
  }
  const orderedSources = orderSources(sources);
  const manifest = Object.freeze({
    schemaVersion: "m3-r13-round-013-1m-manifest-001" as const,
    symbol: input.symbol,
    requestedStartTime: startTime,
    requestedEndTime: endTime,
    pageCount,
    rowCount: candles.length,
    firstOpenTime: candles[0]!.openTime,
    lastOpenTime: candles.at(-1)!.openTime,
    checksum: hash(candles),
    source: orderedSources.length === 1 ? orderedSources[0]! : "MIXED" as const,
    sources: orderedSources,
  });
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

function hashTreeFiles(root: string, current: string, values: Array<Readonly<{ path: string; size: number; sha256: string }>>): void {
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      hashTreeFiles(root, absolute, values);
    } else if (entry.isFile()) {
      const bytes = readFileSync(absolute);
      values.push(Object.freeze({
        path: path.relative(root, absolute).replaceAll(path.sep, "/"),
        size: bytes.byteLength,
        sha256: byteHash(bytes),
      }));
    }
  }
}

export function r13CacheTreeIdentity(directory: string): string {
  const root = path.resolve(directory);
  if (!existsSync(root)) return hash({ missing: true, root: path.basename(root) });
  const values: Array<Readonly<{ path: string; size: number; sha256: string }>> = [];
  hashTreeFiles(root, root, values);
  return hash(values);
}

function monthPeriod(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function buildR13VisionKlineArchiveRequests(
  symbol: ResearchSymbol,
): readonly R13VisionArchiveRequest[] {
  const requests: R13VisionArchiveRequest[] = [];
  for (let year = 2023; year <= 2026; year += 1) {
    const lastMonth = year === 2026 ? 6 : 11;
    for (let month = 0; month <= lastMonth; month += 1) {
      requests.push({ kind: "1m", frequency: "monthly", symbol, period: monthPeriod(year, month) });
    }
  }
  for (let day = 1; day <= 15; day += 1) {
    requests.push({
      kind: "1m",
      frequency: "daily",
      symbol,
      period: `2026-08-${String(day).padStart(2, "0")}`,
    });
  }
  return Object.freeze(requests);
}

export function buildR13VisionFundingArchiveRequests(
  symbol: ResearchSymbol,
  startTime: number,
  endTime: number,
): readonly R13VisionArchiveRequest[] {
  const requests: R13VisionArchiveRequest[] = [];
  const start = new Date(startTime);
  const end = new Date(endTime);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    requests.push({ kind: "funding", frequency: "monthly", symbol, period: monthPeriod(year, month) });
    month += 1;
    if (month === 12) {
      year += 1;
      month = 0;
    }
  }
  return Object.freeze(requests);
}

const R13_FUNDING_PAGE_SCHEMA_VERSION = "m3-r13-round-013-funding-page-cache-001" as const;

type R13FundingPageIdentity = Readonly<{
  schemaVersion: typeof R13_FUNDING_PAGE_SCHEMA_VERSION;
  symbol: ResearchSymbol;
  startTime: number;
  endTime: number;
  limit: number;
}>;

type R13FundingPageEnvelope = Readonly<{
  schemaVersion: typeof R13_FUNDING_PAGE_SCHEMA_VERSION;
  identity: R13FundingPageIdentity;
  payload: unknown;
  payloadSha256: string;
  source: "BINANCE_PUBLIC_REST_FALLBACK";
}>;

function fundingPageIdentity(
  symbol: ResearchSymbol,
  startTime: number,
  endTime: number,
  limit: number,
): R13FundingPageIdentity {
  return Object.freeze({ schemaVersion: R13_FUNDING_PAGE_SCHEMA_VERSION, symbol, startTime, endTime, limit });
}

function fundingPagePath(
  cacheDirectory: string,
  identity: R13FundingPageIdentity,
): string {
  return path.join(path.resolve(cacheDirectory), "r13", "funding", `${hash(identity)}.json`);
}

function readR13FundingRestPage(
  cacheDirectory: string,
  identity: R13FundingPageIdentity,
): BinanceResponse<unknown> | undefined {
  const filePath = fundingPagePath(cacheDirectory, identity);
  if (!existsSync(filePath)) return undefined;
  const envelope = JSON.parse(readFileSync(filePath, "utf8")) as R13FundingPageEnvelope;
  if (
    envelope.schemaVersion !== R13_FUNDING_PAGE_SCHEMA_VERSION
    || stableStringify(envelope.identity) !== stableStringify(identity)
    || envelope.payloadSha256 !== hash(envelope.payload)
    || envelope.source !== "BINANCE_PUBLIC_REST_FALLBACK"
  ) throw new Error(`R13 funding cache identity/checksum mismatch: ${filePath}`);
  return { data: envelope.payload, diagnostics: cachedDiagnostics("/fapi/v1/fundingRate") };
}

function writeR13FundingRestPage(
  cacheDirectory: string,
  identity: R13FundingPageIdentity,
  payload: unknown,
): void {
  const directory = path.dirname(fundingPagePath(cacheDirectory, identity));
  mkdirSync(directory, { recursive: true });
  const target = fundingPagePath(cacheDirectory, identity);
  const staging = mkdtempSync(path.join(directory, ".staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(
      temporary,
      stableStringify({
        schemaVersion: R13_FUNDING_PAGE_SCHEMA_VERSION,
        identity,
        payload,
        payloadSha256: hash(payload),
        source: "BINANCE_PUBLIC_REST_FALLBACK",
      } satisfies R13FundingPageEnvelope),
      "utf8",
    );
    if (!existsSync(target)) renameSync(temporary, target);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function fundingRawRows(records: readonly HistoricalFundingRecord[]): readonly unknown[] {
  return records.map((record) => ({
    symbol: record.symbol,
    fundingTime: record.fundingTime,
    fundingRate: record.fundingRate,
    markPrice: record.directMarkPrice,
  }));
}

function fundingRangeCovered(
  records: readonly HistoricalFundingRecord[],
  startTime: number,
  endTime: number,
): boolean {
  if (records.length === 0) return false;
  const first = records[0]!.fundingTime;
  const last = records.at(-1)!.fundingTime;
  const expectedLast = Math.floor(endTime / (8 * 60 * 60_000)) * (8 * 60 * 60_000);
  return first <= startTime + 8 * 60 * 60_000 && last >= expectedLast;
}

export class R13FundingSourceClient extends Round006CachedBinanceClient {
  readonly r13CacheDirectory: string;
  readonly fundingNetworkMode: R13FundingNetworkMode;
  readonly archiveOptions: R13ArchiveFetchOptions;
  readonly archives: R13VisionArchiveProvenance[] = [];
  restFallbackRequests = 0;
  private fundingSemanticValidationCount = 0;
  private readonly restFallbackReasonCodes: string[] = [];
  private readonly publicClient: BinancePublicClient;
  private readonly visionPromises = new Map<string, Promise<readonly HistoricalFundingRecord[]>>();
  private restServerTimeVerified = false;

  constructor(input: Readonly<{
    acceptedCoarseCacheDirectory: string;
    r13CacheDirectory: string;
    clientOptions?: BinancePublicClientOptions;
    fundingNetworkMode: R13FundingNetworkMode;
    archiveOptions?: R13ArchiveFetchOptions;
  }>) {
    const options: Round006DataAcquisitionOptions = {
      cacheDirectory: input.acceptedCoarseCacheDirectory,
      clientOptions: input.clientOptions,
      allowNetworkAcquisition: false,
    };
    super(options);
    this.r13CacheDirectory = path.resolve(input.r13CacheDirectory);
    this.fundingNetworkMode = input.fundingNetworkMode;
    this.archiveOptions = input.archiveOptions ?? {};
    this.publicClient = new BinancePublicClient(input.clientOptions);
  }

  private async loadVisionFunding(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
  ): Promise<readonly HistoricalFundingRecord[]> {
    const key = `${symbol}|${startTime}|${endTime}`;
    const existing = this.visionPromises.get(key);
    if (existing) return existing;
    const promise = (async () => {
      const values: HistoricalFundingRecord[] = [];
      for (const request of buildR13VisionFundingArchiveRequests(symbol, startTime, endTime)) {
        try {
          const result = await downloadR13VisionFundingArchive({
            request: request as R13VisionArchiveRequest & { kind: "funding" },
            cacheDirectory: this.r13CacheDirectory,
            options: this.archiveOptions,
          });
          values.push(...result.records);
          if (!this.archives.some((archive) => archive.archiveFileName === result.provenance.archiveFileName)) {
            this.archives.push(result.provenance);
          }
        } catch (error) {
          if (!isR13VisionArchiveUnavailable(error)) throw error;
          // An unavailable Vision month is handled by the bounded REST fallback.
        }
      }
      const byTime = new Map<number, HistoricalFundingRecord>();
      for (const record of values) {
        if (record.fundingTime >= startTime && record.fundingTime <= endTime) {
          byTime.set(record.fundingTime, record);
        }
      }
      return Object.freeze([...byTime.values()].sort((left, right) => left.fundingTime - right.fundingTime));
    })();
    this.visionPromises.set(key, promise);
    return promise;
  }

  private async ensureRestServerTime(): Promise<void> {
    if (this.restServerTimeVerified) return;
    await this.publicClient.getServerTime();
    this.restServerTimeVerified = true;
  }

  get fundingSourceSemanticIdentityVerified(): boolean {
    return this.fundingSemanticValidationCount > 0;
  }

  get restFallbackOnlyWhenRequired(): boolean {
    return this.restFallbackReasonCodes.length === this.restFallbackRequests;
  }

  private validateFundingResponse(
    response: BinanceResponse<unknown>,
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
  ): BinanceResponse<unknown> {
    const records = parseBinanceFundingRateHistory(response.data, symbol);
    validateFundingRecords(records, { symbol, startTime, endTime, policy: M3_R13_POLICY_VERSION });
    this.fundingSemanticValidationCount += 1;
    return response;
  }

  override async getFundingRateHistory(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
    limit = 1_000,
  ): Promise<BinanceResponse<unknown>> {
    const identity = fundingPageIdentity(symbol, startTime, endTime, limit);
    const r13Cached = readR13FundingRestPage(this.r13CacheDirectory, identity);
    if (r13Cached) return this.validateFundingResponse(r13Cached, symbol, startTime, endTime);

    let acceptedError: unknown;
    try {
      return this.validateFundingResponse(
        await super.getFundingRateHistory(symbol, startTime, endTime, limit),
        symbol,
        startTime,
        endTime,
      );
    } catch (error) {
      acceptedError = error;
    }
    if (this.fundingNetworkMode === "ALL_NETWORK_DISABLED") {
      throw acceptedError instanceof Error
        ? acceptedError
        : new Error(`R13 offline funding cache is incomplete for ${symbol}.`);
    }

    const vision = await this.loadVisionFunding(symbol, startTime, endTime);
    const visionPage = vision.slice(0, limit);
    if (visionPage.length > 0 && (visionPage.length === limit || fundingRangeCovered(vision, startTime, endTime))) {
      validateFundingRecords(visionPage, { symbol, startTime, endTime, policy: M3_R13_POLICY_VERSION });
      return this.validateFundingResponse(
        { data: fundingRawRows(visionPage), diagnostics: cachedDiagnostics("/fapi/v1/fundingRate") },
        symbol,
        startTime,
        endTime,
      );
    }

    await this.ensureRestServerTime();
    this.restFallbackRequests += 1;
    this.restFallbackReasonCodes.push("ACCEPTED_CACHE_AND_VISION_COVERAGE_INCOMPLETE");
    const response = await this.publicClient.getFundingRateHistory(symbol, startTime, endTime, limit);
    const records = parseBinanceFundingRateHistory(response.data, symbol);
    if (records.length === 0) {
      throw new Error(`R13 funding REST fallback returned no data for ${symbol} at ${startTime}.`);
    }
    validateFundingRecords(records, { symbol, startTime, endTime, policy: M3_R13_POLICY_VERSION });
    this.fundingSemanticValidationCount += 1;
    writeR13FundingRestPage(this.r13CacheDirectory, identity, response.data);
    return response;
  }
}

async function loadR13CoarseStudy(input: Readonly<{
  acceptedCoarseCacheDirectory: string;
  r13CacheDirectory: string;
  clientOptions?: BinancePublicClientOptions;
  fundingNetworkMode: R13FundingNetworkMode;
  archiveOptions?: R13ArchiveFetchOptions;
}>): Promise<Readonly<{ coarseData: BacktestData; fundingClient: R13FundingSourceClient }>> {
  const fundingClient = new R13FundingSourceClient(input);
  const loader = new BinanceHistoricalDataLoader({ client: fundingClient });
  const study = await loader.loadStudyData({
    ...buildRound006HistoricalLoadRanges(),
    policy: M3_R13_POLICY_VERSION,
    serverTime: R13_HISTORICAL_VALIDATION_SERVER_TIME,
  });
  return Object.freeze({ coarseData: toBacktestData(study), fundingClient });
}

async function acquireOneMinuteArchives(
  cacheDirectory: string,
  missingSymbols: readonly ResearchSymbol[],
  archiveOptions: R13ArchiveFetchOptions,
): Promise<readonly R13VisionArchiveProvenance[]> {
  const provenance: R13VisionArchiveProvenance[] = [];
  const lastOpenTime = Math.floor(R13_ONE_MINUTE_END_TIME / 60_000) * 60_000;
  for (const symbol of missingSymbols) {
    let expectedOpenTime = R13_ONE_MINUTE_START_TIME;
    const buffer: IntrabarSettlementCandle[] = [];
    for (const request of buildR13VisionKlineArchiveRequests(symbol)) {
      const result = await downloadR13VisionKlineArchive({
        request: request as R13VisionArchiveRequest & { kind: "1m" },
        cacheDirectory,
        options: archiveOptions,
      });
      provenance.push(result.provenance);
      for (const candle of result.records) {
        if (candle.openTime < R13_ONE_MINUTE_START_TIME || candle.openTime > lastOpenTime) continue;
        if (candle.openTime !== expectedOpenTime) {
          throw new Error(`R13 1m archive gap for ${symbol}: expected ${expectedOpenTime}, received ${candle.openTime}.`);
        }
        buffer.push(candle);
        expectedOpenTime += 60_000;
        while (buffer.length >= R13_ONE_MINUTE_PAGE_LIMIT) {
          const page = buffer.splice(0, R13_ONE_MINUTE_PAGE_LIMIT);
          const identity = cacheIdentity(
            symbol,
            page[0]!.openTime,
            page.at(-1)!.openTime + 59_999,
            R13_ONE_MINUTE_PAGE_LIMIT,
          );
          writePage(cacheDirectory, identity, page, "BINANCE_VISION_ARCHIVE");
        }
      }
    }
    if (expectedOpenTime !== lastOpenTime + 60_000) {
      throw new Error(`R13 1m archive coverage is incomplete for ${symbol} at ${expectedOpenTime}.`);
    }
    if (buffer.length > 0) {
      const identity = cacheIdentity(
        symbol,
        buffer[0]!.openTime,
        buffer.at(-1)!.openTime + 59_999,
        R13_ONE_MINUTE_PAGE_LIMIT,
      );
      writePage(cacheDirectory, identity, buffer, "BINANCE_VISION_ARCHIVE");
    }
  }
  return Object.freeze(provenance);
}

function acquisitionManifestPath(cacheDirectory: string): string {
  return path.join(path.resolve(cacheDirectory), "r13", "acquisition-manifest.json");
}

export function readR13AcquisitionManifest(cacheDirectory: string): R13AcquisitionManifest | null {
  const filePath = acquisitionManifestPath(cacheDirectory);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as R13AcquisitionManifest;
}

function writeR13AcquisitionManifest(
  cacheDirectory: string,
  manifest: R13AcquisitionManifest,
): void {
  const directory = path.dirname(acquisitionManifestPath(cacheDirectory));
  mkdirSync(directory, { recursive: true });
  const target = acquisitionManifestPath(cacheDirectory);
  const staging = mkdtempSync(path.join(directory, ".manifest-staging-"));
  const temporary = path.join(staging, path.basename(target));
  try {
    writeFileSync(temporary, stableStringify(manifest), "utf8");
    renameSync(temporary, target);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function buildAcquisitionManifest(input: Readonly<{
  acceptedCoarseCacheDirectory: string;
  acceptedCoarseCacheIdentitySha256: string;
  acceptedCoarseCacheReadOnlyVerified: boolean;
  manifests: readonly R13OneMinuteManifest[];
  archives: readonly R13VisionArchiveProvenance[];
  previousManifest?: R13AcquisitionManifest | null;
  fundingClient: R13FundingSourceClient;
}>): R13AcquisitionManifest {
  const sourceValues: R13AcquisitionSource[] = [
    "ACCEPTED_EXISTING_CACHE",
    ...(input.previousManifest?.sources ?? []),
  ];
  for (const manifest of input.manifests) sourceValues.push(...manifest.sources);
  if (input.archives.length > 0) sourceValues.push("BINANCE_VISION_ARCHIVE");
  if (input.fundingClient.archives.length > 0) sourceValues.push("BINANCE_VISION_ARCHIVE");
  if (input.fundingClient.restFallbackRequests > 0) sourceValues.push("BINANCE_PUBLIC_REST_FALLBACK");
  const sources = orderSources(sourceValues);
  const archiveByIdentity = new Map<string, R13VisionArchiveProvenance>();
  for (const archive of [ ...(input.previousManifest?.archives ?? []), ...input.archives, ...input.fundingClient.archives ]) {
    archiveByIdentity.set(`${archive.dataType}|${archive.symbol}|${archive.archiveFileName}|${archive.archiveSha256}`, archive);
  }
  const archives = Object.freeze(
    [...archiveByIdentity.values()]
      .sort((left, right) => left.archiveFileName.localeCompare(right.archiveFileName)),
  );
  return Object.freeze({
    schemaVersion: "m3-r13-round-013-acquisition-manifest-001",
    acceptedCoarseCacheDirectory: R13_ACCEPTED_CACHE_LABEL,
    acceptedCoarseCacheIdentitySha256: input.acceptedCoarseCacheIdentitySha256,
    acceptedCoarseCacheReadOnlyVerified: input.acceptedCoarseCacheReadOnlyVerified,
    sources,
    archives,
    bulkArchiveChecksumVerified: archives.every((archive) =>
      archive.archiveSha256.length === 64
      && archive.officialChecksumSha256.length === 64
      && archive.officialChecksumContent.length > 0),
    fundingSourceSemanticIdentityVerified: input.fundingClient.fundingSourceSemanticIdentityVerified,
    archiveRestKlineSemanticIdentityVerified: input.manifests.length === R13_SYMBOLS.length
      && input.manifests.every((manifest) => manifest.sources.length > 0),
    acquisitionSourcesDeterministic: stableStringify(sources) === stableStringify(orderSources(sources)),
    restFallbackOnlyWhenRequired: input.fundingClient.restFallbackOnlyWhenRequired,
    visionCanOperateWithoutRest: input.fundingClient.restFallbackRequests === 0,
    restFallbackRequests: input.fundingClient.restFallbackRequests,
  });
}

async function completeR13OneMinuteCache(input: Readonly<{
  cacheDirectory: string;
  clientOptions?: BinancePublicClientOptions;
  oneMinuteNetworkMode: R13OneMinuteNetworkMode;
  archiveOptions?: R13ArchiveFetchOptions;
}>): Promise<Readonly<{
  oneMinute: Readonly<Record<ResearchSymbol, readonly IntrabarSettlementCandle[]>>;
  oneMinuteIndexed: Readonly<Record<ResearchSymbol, R13OneMinuteIndexedSeries>>;
  manifests: readonly R13OneMinuteManifest[];
  archives: readonly R13VisionArchiveProvenance[];
}>> {
  const offlineClient = new R13OneMinuteCachedClient({
    cacheDirectory: input.cacheDirectory,
    clientOptions: input.clientOptions,
    allowNetworkAcquisition: false,
  });
  const missing: ResearchSymbol[] = [];
  for (const symbol of R13_SYMBOLS) {
    try {
      await loadR13OneMinuteRange({ client: offlineClient, symbol });
    } catch {
      missing.push(symbol);
    }
  }
  let archives: readonly R13VisionArchiveProvenance[] = [];
  if (missing.length > 0 && input.oneMinuteNetworkMode === "NETWORK_ALLOWED_PRELOCK") {
    try {
      archives = await acquireOneMinuteArchives(input.cacheDirectory, missing, input.archiveOptions ?? {});
    } catch (error) {
      if (!isR13VisionArchiveUnavailable(error)) throw error;
      // A missing or unavailable Vision archive is handled by REST below.
    }
  }
  const client = new R13OneMinuteCachedClient({
    cacheDirectory: input.cacheDirectory,
    clientOptions: input.clientOptions,
    allowNetworkAcquisition: input.oneMinuteNetworkMode === "NETWORK_ALLOWED_PRELOCK",
  });
  const oneMinute = {} as Record<ResearchSymbol, readonly IntrabarSettlementCandle[]>;
  const oneMinuteIndexed = {} as Record<ResearchSymbol, R13OneMinuteIndexedSeries>;
  const manifests: R13OneMinuteManifest[] = [];
  for (const symbol of R13_SYMBOLS) {
    const loaded = await loadR13OneMinuteRange({ client, symbol });
    oneMinute[symbol] = loaded.candles;
    oneMinuteIndexed[symbol] = new R13OneMinuteIndexedSeries(loaded.candles);
    manifests.push(loaded.manifest);
  }
  return Object.freeze({
    oneMinute: Object.freeze(oneMinute),
    oneMinuteIndexed: Object.freeze(oneMinuteIndexed),
    manifests: Object.freeze(manifests),
    archives,
  });
}

export function r13DatasetIdentity(input: Readonly<{
  coarseData: BacktestData;
  oneMinuteManifests: readonly R13OneMinuteManifest[];
  acquisition: R13AcquisitionManifest;
  serverTime: number;
}>): string {
  const manifests = [...input.coarseData.manifests, ...input.oneMinuteManifests]
    .map((manifest) => {
      const copy = { ...manifest } as Record<string, unknown>;
      delete copy.retrievedAt;
      return copy;
    })
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  return hash({
    schemaVersion: "m3-r13-round-013-dataset-freeze-001",
    researchRoundId: M3_R13_RESEARCH_ROUND_ID,
    serverTime: input.serverTime,
    manifests,
    acquisition: input.acquisition,
    purgeEmbargoHours: 24,
    oneMinuteRange: { startTime: R13_ONE_MINUTE_START_TIME, endTime: R13_ONE_MINUTE_END_TIME },
  });
}

export function freezeR13Dataset(input: Readonly<{
  coarseData: BacktestData;
  oneMinute: Readonly<Record<ResearchSymbol, readonly IntrabarSettlementCandle[]>>;
  manifests: readonly R13OneMinuteManifest[];
  acquisition: R13AcquisitionManifest;
  serverTime: number;
}>): R13DatasetFreeze {
  const errors: string[] = [];
  for (const symbol of R13_SYMBOLS) {
    try {
      validateR13OneMinuteSeries(input.oneMinute[symbol] ?? [], symbol);
    } catch (error) {
      errors.push(`INVALID_1M_COVERAGE:${symbol}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (input.manifests.length !== R13_SYMBOLS.length) errors.push("MISSING_1M_MANIFEST");
  if (!input.acquisition.acceptedCoarseCacheReadOnlyVerified) errors.push("ACCEPTED_CACHE_MUTATED");
  if (errors.length > 0) throw new Error(`R13 dataset freeze failed: ${[...new Set(errors)].join("; ")}`);
  const datasetIdentitySha256 = r13DatasetIdentity({
    coarseData: input.coarseData,
    oneMinuteManifests: input.manifests,
    acquisition: input.acquisition,
    serverTime: input.serverTime,
  });
  return Object.freeze({
    schemaVersion: "m3-r13-round-013-dataset-freeze-001",
    dataFreezeCompleted: true,
    researchRoundId: M3_R13_RESEARCH_ROUND_ID,
    researchBoundary: M3_R13_RESEARCH_END_ISO,
    coarsePolicyVersion: M3_R13_POLICY_VERSION,
    featureSpecSha256: R13_FEATURE_SPEC_SHA256,
    modelSpecSha256: R13_MODEL_SPEC_SHA256,
    gateSha256: R13_SELECTION_GATE_SHA256,
    planSha256: R13_PLAN_SHA256,
    conformanceSha256: R13_SPEC_CONFORMANCE_SHA256,
    datasetIdentitySha256,
    manifestIdentitySha256: hash({ manifests: input.manifests, acquisition: input.acquisition }),
    symbols: R13_SYMBOLS,
    oneMinuteCoverage: {
      startTime: R13_ONE_MINUTE_START_TIME,
      endTime: R13_ONE_MINUTE_END_TIME,
      completeSymbols: R13_SYMBOLS,
    },
    coarseManifestCount: input.coarseData.manifests.length,
    oneMinuteManifestCount: input.manifests.length,
    acquisition: input.acquisition,
    purgeEmbargoHours: 24,
    postLockMarketFetchPossible: false,
    integrityErrors: Object.freeze([]),
  });
}

export async function prepareR13Dataset(input: Readonly<{
  cacheDirectory: string;
  acceptedCoarseCacheDirectory?: string;
  clientOptions?: BinancePublicClientOptions;
  fetchMissingOneMinute?: boolean;
  coarseNetworkMode?: R13CoarseNetworkMode;
  oneMinuteNetworkMode?: R13OneMinuteNetworkMode;
  fundingNetworkMode?: R13FundingNetworkMode;
  archiveFetchOptions?: R13ArchiveFetchOptions;
}>): Promise<R13PreparedDataset> {
  const coarseCacheDirectory = input.acceptedCoarseCacheDirectory ?? locateAcceptedRound006Cache();
  if (!coarseCacheDirectory) {
    throw new Error("R13 acquisition cannot start: accepted Round-006 coarse cache is unavailable.");
  }
  if (input.coarseNetworkMode && input.coarseNetworkMode !== "READ_ONLY_OFFLINE") {
    throw new Error("R13 coarse data must use READ_ONLY_OFFLINE mode.");
  }
  const networkAllowed = input.fetchMissingOneMinute === true;
  const oneMinuteNetworkMode = input.oneMinuteNetworkMode
    ?? (networkAllowed ? "NETWORK_ALLOWED_PRELOCK" : "ALL_NETWORK_DISABLED");
  const fundingNetworkMode = input.fundingNetworkMode
    ?? (networkAllowed ? "NETWORK_ALLOWED_PRELOCK_ONLY_IF_REQUIRED" : "ALL_NETWORK_DISABLED");
  const acceptedBefore = r13CacheTreeIdentity(coarseCacheDirectory);
  const coarse = await loadR13CoarseStudy({
    acceptedCoarseCacheDirectory: coarseCacheDirectory,
    r13CacheDirectory: input.cacheDirectory,
    clientOptions: input.clientOptions,
    fundingNetworkMode,
    archiveOptions: input.archiveFetchOptions,
  });
  const acceptedAfter = r13CacheTreeIdentity(coarseCacheDirectory);
  const acceptedReadOnly = acceptedBefore === acceptedAfter;
  if (!acceptedReadOnly) throw new Error("R13 acquisition detected mutation of the accepted Round-006 cache.");

  const oneMinute = await completeR13OneMinuteCache({
    cacheDirectory: input.cacheDirectory,
    clientOptions: input.clientOptions,
    oneMinuteNetworkMode,
    archiveOptions: input.archiveFetchOptions,
  });
  const previousManifest = readR13AcquisitionManifest(input.cacheDirectory);
  const acquisition = buildAcquisitionManifest({
    acceptedCoarseCacheDirectory: coarseCacheDirectory,
    acceptedCoarseCacheIdentitySha256: acceptedAfter,
    acceptedCoarseCacheReadOnlyVerified: acceptedReadOnly,
    manifests: oneMinute.manifests,
    archives: oneMinute.archives,
    previousManifest,
    fundingClient: coarse.fundingClient,
  });
  if (oneMinuteNetworkMode === "NETWORK_ALLOWED_PRELOCK" || previousManifest) {
    writeR13AcquisitionManifest(input.cacheDirectory, acquisition);
  }
  const datasetFreeze = freezeR13Dataset({
    coarseData: coarse.coarseData,
    oneMinute: oneMinute.oneMinute,
    manifests: oneMinute.manifests,
    acquisition,
    serverTime: R13_HISTORICAL_VALIDATION_SERVER_TIME,
  });
  return Object.freeze({
    coarseData: coarse.coarseData,
    oneMinute: oneMinute.oneMinute,
    oneMinuteIndexed: oneMinute.oneMinuteIndexed,
    manifests: oneMinute.manifests,
    acquisition,
    datasetFreeze,
  });
}
