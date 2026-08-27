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

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import {
  BinancePublicClient,
  type BinancePublicClientOptions,
  type BinanceRequestDiagnostics,
  type BinanceResponse,
} from "../market-data/binance/client.ts";
import { parseBinanceKlines } from "../market-data/binance/parser.ts";
import { INTERVAL_MS, type MarketTimeframe } from "../market-data/intervals.ts";
import { parseBinanceFundingRateHistory } from "../historical-data/binance/parser.ts";
import { parseBinanceIntrabarKlines } from "../historical-data/binance/intrabar.ts";
import { parseBinanceMarkPriceKlines } from "../historical-data/binance/mark-price.ts";
import { HistoricalDataError } from "../historical-data/errors.ts";
import {
  validateFundingRecords,
  validateHistoricalCandleSeries,
  validateIntrabarSettlementWindow,
  validateMarkPriceCandleSeries,
} from "../historical-data/validation.ts";
import { BinanceHistoricalDataLoader } from "../historical-data/binance/loader.ts";
import type { HistoricalRange } from "../historical-data/types.ts";
import { stableStringify } from "./utils.ts";

export const ROUND006_RESEARCH_TIMEOUT_MS = 15_000 as const;
export const ROUND006_RESEARCH_MAX_ATTEMPTS = 5 as const;
export const ROUND006_RESEARCH_MAX_CONCURRENCY = 2 as const;
export const ROUND006_PAGE_CACHE_SCHEMA_VERSION = "m3-r6-round-006-page-cache-001" as const;

type Round006PageType = "candles" | "funding" | "mark-price" | "intrabar-settlement";

type Round006PageCacheIdentity = Readonly<{
  schemaVersion: typeof ROUND006_PAGE_CACHE_SCHEMA_VERSION;
  provider: "binance-usdm-public";
  endpoint: string;
  dataType: Round006PageType;
  symbol: ResearchSymbol;
  timeframe: "1h" | "4h" | "1m" | null;
  startTime: number;
  endTime: number;
  limit: number;
  backtestPolicyVersion: "bt-policy-003";
}>;

type Round006PageCacheEnvelope = Readonly<{
  schemaVersion: typeof ROUND006_PAGE_CACHE_SCHEMA_VERSION;
  identity: Round006PageCacheIdentity;
  payload: unknown;
  payloadSha256: string;
}>;

export class Round006CacheIntegrityError extends Error {
  readonly cachePath: string;

  constructor(message: string, cachePath: string) {
    super(message);
    this.name = "Round006CacheIntegrityError";
    this.cachePath = cachePath;
  }
}

export type Round006CacheConfig = Readonly<{
  schemaVersion: typeof ROUND006_PAGE_CACHE_SCHEMA_VERSION;
  directory: string;
  maxConcurrency: typeof ROUND006_RESEARCH_MAX_CONCURRENCY;
  timeoutMs: typeof ROUND006_RESEARCH_TIMEOUT_MS;
  maxAttempts: typeof ROUND006_RESEARCH_MAX_ATTEMPTS;
}>;

export type Round006DataAcquisitionOptions = Readonly<{
  cacheDirectory?: string;
  clientOptions?: BinancePublicClientOptions;
}>;

export type Round006PreflightReport = Readonly<{
  schemaVersion: "m3-r6-round-006-preflight-001";
  status: "PASS";
  serverTime: number;
  latestClosedCandleOpenTimes: Readonly<{ "1h": number; "4h": number }>;
  symbols: readonly ResearchSymbol[];
  requestCount: number;
  requestFamilies: readonly ["1h", "4h", "funding", "mark-price", "intrabar-settlement"];
  transport: Readonly<{
    timeoutMs: typeof ROUND006_RESEARCH_TIMEOUT_MS;
    maxAttempts: typeof ROUND006_RESEARCH_MAX_ATTEMPTS;
    maxConcurrency: typeof ROUND006_RESEARCH_MAX_CONCURRENCY;
  }>;
}>;

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireNonEmptyPage(page: readonly unknown[], label: string, symbol: ResearchSymbol): void {
  if (page.length === 0) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: `${label} page is empty during Round-006 acquisition.`,
      symbol,
    });
  }
}

function requirePageRange(
  first: number,
  last: number,
  startTime: number,
  endTime: number,
  label: string,
  symbol: ResearchSymbol,
): void {
  if (first < startTime || last > endTime) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: `${label} page exceeded its requested range.`,
      symbol,
      diagnostics: { first, last, startTime, endTime },
    });
  }
}

function candleIdentity(
  symbol: ResearchSymbol,
  timeframe: "1h" | "4h",
  startTime: number,
  endTime: number,
  limit: number,
): Round006PageCacheIdentity {
  return Object.freeze({
    schemaVersion: ROUND006_PAGE_CACHE_SCHEMA_VERSION,
    provider: "binance-usdm-public",
    endpoint: "/fapi/v1/klines",
    dataType: "candles",
    symbol,
    timeframe,
    startTime,
    endTime,
    limit,
    backtestPolicyVersion: "bt-policy-003",
  });
}

function fundingIdentity(
  symbol: ResearchSymbol,
  startTime: number,
  endTime: number,
  limit: number,
): Round006PageCacheIdentity {
  return Object.freeze({
    schemaVersion: ROUND006_PAGE_CACHE_SCHEMA_VERSION,
    provider: "binance-usdm-public",
    endpoint: "/fapi/v1/fundingRate",
    dataType: "funding",
    symbol,
    timeframe: null,
    startTime,
    endTime,
    limit,
    backtestPolicyVersion: "bt-policy-003",
  });
}

function markPriceIdentity(
  symbol: ResearchSymbol,
  startTime: number,
  endTime: number,
  limit: number,
): Round006PageCacheIdentity {
  return Object.freeze({
    schemaVersion: ROUND006_PAGE_CACHE_SCHEMA_VERSION,
    provider: "binance-usdm-public",
    endpoint: "/fapi/v1/markPriceKlines",
    dataType: "mark-price",
    symbol,
    timeframe: "1h",
    startTime,
    endTime,
    limit,
    backtestPolicyVersion: "bt-policy-003",
  });
}

function intrabarIdentity(
  symbol: ResearchSymbol,
  startTime: number,
  endTime: number,
  limit: number,
): Round006PageCacheIdentity {
  return Object.freeze({
    schemaVersion: ROUND006_PAGE_CACHE_SCHEMA_VERSION,
    provider: "binance-usdm-public",
    endpoint: "/fapi/v1/klines",
    dataType: "intrabar-settlement",
    symbol,
    timeframe: "1m",
    startTime,
    endTime,
    limit,
    backtestPolicyVersion: "bt-policy-003",
  });
}

export function round006PageCachePath(cacheDirectory: string, identity: Round006PageCacheIdentity): string {
  return path.join(path.resolve(cacheDirectory), `${sha256(identity)}.json`);
}

function cachedDiagnostics(endpoint: string): BinanceRequestDiagnostics {
  return Object.freeze({
    endpoint,
    operationStartedAt: 0,
    attemptStartedAt: 0,
    attemptCompletedAt: 0,
    roundTripMs: 0,
    attempts: 1,
  });
}

type PageValidator = (payload: unknown, identity: Round006PageCacheIdentity) => void;

function validatePage(
  payload: unknown,
  identity: Round006PageCacheIdentity,
  allowEmptyFundingPage: boolean,
): void {
  if (identity.dataType === "candles") {
    const timeframe = identity.timeframe as "1h" | "4h";
    const page = parseBinanceKlines(payload, identity.symbol, timeframe);
    validateHistoricalCandleSeries(page, { symbol: identity.symbol, timeframe });
    requireNonEmptyPage(page, "Candle", identity.symbol);
    const first = page[0]!.openTime;
    const last = page.at(-1)!.openTime;
    requirePageRange(first, last, identity.startTime, identity.endTime, "Candle", identity.symbol);
    if (first !== identity.startTime) {
      throw new HistoricalDataError({
        code: "DATA_INCOMPLETE",
        message: "Cached candle page does not begin at its request cursor.",
        symbol: identity.symbol,
        timeframe,
        diagnostics: { expectedStartTime: identity.startTime, actualStartTime: first },
      });
    }
    return;
  }

  if (identity.dataType === "funding") {
    const page = parseBinanceFundingRateHistory(payload, identity.symbol);
    validateFundingRecords(page, {
      symbol: identity.symbol,
      startTime: identity.startTime,
      endTime: identity.endTime,
      policy: "bt-policy-003",
    });
    if (!allowEmptyFundingPage) requireNonEmptyPage(page, "Funding", identity.symbol);
    return;
  }

  if (identity.dataType === "mark-price") {
    const page = parseBinanceMarkPriceKlines(payload, identity.symbol);
    validateMarkPriceCandleSeries(page, {
      symbol: identity.symbol,
      serverTime: Number.MAX_SAFE_INTEGER,
      expectedStartTime: identity.startTime,
      expectedEndTime: identity.endTime,
    });
    requireNonEmptyPage(page, "Mark-price", identity.symbol);
    return;
  }

  const page = parseBinanceIntrabarKlines(payload, identity.symbol);
  validateIntrabarSettlementWindow(page, {
    symbol: identity.symbol,
    exitCandleOpenTime: identity.startTime,
    exitCandleCloseTime: identity.endTime,
    serverTime: Number.MAX_SAFE_INTEGER,
  });
}

function validateCachedPage(payload: unknown, identity: Round006PageCacheIdentity): void {
  validatePage(payload, identity, false);
}

function validateNetworkPage(payload: unknown, identity: Round006PageCacheIdentity): void {
  validatePage(payload, identity, true);
}

function isCacheablePage(payload: unknown, identity: Round006PageCacheIdentity): boolean {
  return identity.dataType !== "funding" || (Array.isArray(payload) && payload.length > 0);
}

export class Round006CachedBinanceClient extends BinancePublicClient {
  readonly cacheDirectory: string;
  private activeRequests = 0;
  private readonly waitingRequests: Array<() => void> = [];
  private readonly inFlight = new Map<string, Promise<BinanceResponse<unknown>>>();

  constructor(options: Round006DataAcquisitionOptions = {}) {
    super({
      ...options.clientOptions,
      timeoutMs: options.clientOptions?.timeoutMs ?? ROUND006_RESEARCH_TIMEOUT_MS,
      maxAttempts: options.clientOptions?.maxAttempts ?? ROUND006_RESEARCH_MAX_ATTEMPTS,
    });
    this.cacheDirectory = path.resolve(
      options.cacheDirectory ?? path.join(process.cwd(), ".cache", "tradepulse", "round-006"),
    );
  }

  get cacheConfig(): Round006CacheConfig {
    return Object.freeze({
      schemaVersion: ROUND006_PAGE_CACHE_SCHEMA_VERSION,
      directory: this.cacheDirectory,
      maxConcurrency: ROUND006_RESEARCH_MAX_CONCURRENCY,
      timeoutMs: ROUND006_RESEARCH_TIMEOUT_MS,
      maxAttempts: ROUND006_RESEARCH_MAX_ATTEMPTS,
    });
  }

  private async withNetworkPermit<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= ROUND006_RESEARCH_MAX_CONCURRENCY) {
      await new Promise<void>((resolve) => this.waitingRequests.push(resolve));
    }
    this.activeRequests += 1;
    try {
      return await operation();
    } finally {
      this.activeRequests -= 1;
      this.waitingRequests.shift()?.();
    }
  }

  private readCache(
    identity: Round006PageCacheIdentity,
    validate: PageValidator,
  ): BinanceResponse<unknown> | undefined {
    const cachePath = round006PageCachePath(this.cacheDirectory, identity);
    if (!existsSync(cachePath)) return undefined;
    let envelope: unknown;
    try {
      envelope = JSON.parse(readFileSync(cachePath, "utf8"));
    } catch {
      throw new Round006CacheIntegrityError("Round-006 page cache is not valid UTF-8 JSON.", cachePath);
    }
    if (!isRecord(envelope)
      || envelope.schemaVersion !== ROUND006_PAGE_CACHE_SCHEMA_VERSION
      || !isRecord(envelope.identity)
      || stableStringify(envelope.identity) !== stableStringify(identity)
      || typeof envelope.payloadSha256 !== "string"
      || envelope.payloadSha256 !== sha256(envelope.payload)) {
      throw new Round006CacheIntegrityError("Round-006 page cache identity or checksum mismatch.", cachePath);
    }
    try {
      validate(envelope.payload, identity);
    } catch (error) {
      throw new Round006CacheIntegrityError(
        `Round-006 page cache failed semantic validation: ${error instanceof Error ? error.message : "invalid page"}`,
        cachePath,
      );
    }
    return Object.freeze({
      data: envelope.payload,
      diagnostics: cachedDiagnostics(identity.endpoint),
    });
  }

  private writeCache(identity: Round006PageCacheIdentity, payload: unknown): void {
    mkdirSync(this.cacheDirectory, { recursive: true });
    const cachePath = round006PageCachePath(this.cacheDirectory, identity);
    const stagingDirectory = mkdtempSync(path.join(this.cacheDirectory, ".page-staging-"));
    const stagedPath = path.join(stagingDirectory, path.basename(cachePath));
    const envelope: Round006PageCacheEnvelope = Object.freeze({
      schemaVersion: ROUND006_PAGE_CACHE_SCHEMA_VERSION,
      identity,
      payload,
      payloadSha256: sha256(payload),
    });
    try {
      writeFileSync(stagedPath, stableStringify(envelope), "utf8");
      if (!existsSync(cachePath)) renameSync(stagedPath, cachePath);
    } finally {
      rmSync(stagingDirectory, { recursive: true, force: true });
    }
  }

  private async getCachedOrFetch(
    identity: Round006PageCacheIdentity,
    validate: PageValidator,
    fetchPage: () => Promise<BinanceResponse<unknown>>,
  ): Promise<BinanceResponse<unknown>> {
    const cached = this.readCache(identity, validateCachedPage);
    if (cached) return cached;
    const cachePath = round006PageCachePath(this.cacheDirectory, identity);
    const current = this.inFlight.get(cachePath);
    if (current) return current;
    const request = (async () => {
      const afterWait = this.readCache(identity, validateCachedPage);
      if (afterWait) return afterWait;
      const response = await this.withNetworkPermit(fetchPage);
      validate(response.data, identity);
      if (isCacheablePage(response.data, identity)) this.writeCache(identity, response.data);
      return response;
    })();
    this.inFlight.set(cachePath, request);
    try {
      return await request;
    } finally {
      if (this.inFlight.get(cachePath) === request) this.inFlight.delete(cachePath);
    }
  }

  override async getKlinesRange(
    symbol: ResearchSymbol,
    timeframe: MarketTimeframe,
    startTime: number,
    endTime: number,
    limit = 1_500,
  ): Promise<BinanceResponse<unknown>> {
    const identity = candleIdentity(symbol, timeframe as "1h" | "4h", startTime, endTime, limit);
    return this.getCachedOrFetch(identity, validateNetworkPage, () => super.getKlinesRange(
      symbol,
      timeframe,
      startTime,
      endTime,
      limit,
    ));
  }

  override async getFundingRateHistory(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
    limit = 1_000,
  ): Promise<BinanceResponse<unknown>> {
    const identity = fundingIdentity(symbol, startTime, endTime, limit);
    return this.getCachedOrFetch(identity, validateNetworkPage, () => super.getFundingRateHistory(
      symbol,
      startTime,
      endTime,
      limit,
    ));
  }

  override async getMarkPriceKlinesRange(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
    limit = 1_500,
  ): Promise<BinanceResponse<unknown>> {
    const identity = markPriceIdentity(symbol, startTime, endTime, limit);
    return this.getCachedOrFetch(identity, validateNetworkPage, () => super.getMarkPriceKlinesRange(
      symbol,
      startTime,
      endTime,
      limit,
    ));
  }

  override async getIntrabarKlinesRange(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
    limit = 60,
  ): Promise<BinanceResponse<unknown>> {
    const identity = intrabarIdentity(symbol, startTime, endTime, limit);
    return this.getCachedOrFetch(identity, validateNetworkPage, () => super.getIntrabarKlinesRange(
      symbol,
      startTime,
      endTime,
      limit,
    ));
  }
}

export type Round006DataAcquisition = Readonly<{
  client: Round006CachedBinanceClient;
  loader: BinanceHistoricalDataLoader;
  cache: Round006CacheConfig;
}>;

export function createRound006HistoricalLoader(
  options: Round006DataAcquisitionOptions = {},
): Round006DataAcquisition {
  const client = new Round006CachedBinanceClient(options);
  return Object.freeze({
    client,
    loader: new BinanceHistoricalDataLoader({ client }),
    cache: client.cacheConfig,
  });
}

function latestClosedOpenTime(serverTime: number, timeframe: "1h" | "4h"): number {
  const interval = INTERVAL_MS[timeframe];
  return Math.floor((serverTime - 1) / interval) * interval;
}

function validatePreflightCandle(
  response: BinanceResponse<unknown>,
  symbol: ResearchSymbol,
  timeframe: "1h" | "4h",
  openTime: number,
  serverTime: number,
): void {
  const candles = parseBinanceKlines(response.data, symbol, timeframe);
  validateHistoricalCandleSeries(candles, {
    symbol,
    timeframe,
    expectedStartTime: openTime,
    expectedEndTime: openTime,
    serverTime,
  });
}

function validatePreflightFunding(
  response: BinanceResponse<unknown>,
  symbol: ResearchSymbol,
  range: HistoricalRange,
): void {
  const records = parseBinanceFundingRateHistory(response.data, symbol);
  validateFundingRecords(records, {
    symbol,
    startTime: range.startTime,
    endTime: range.endTime,
    policy: "bt-policy-003",
  });
  requireNonEmptyPage(records, "Funding preflight", symbol);
}

function validatePreflightMarkPrice(
  response: BinanceResponse<unknown>,
  symbol: ResearchSymbol,
  openTime: number,
  serverTime: number,
): void {
  const candles = parseBinanceMarkPriceKlines(response.data, symbol);
  validateMarkPriceCandleSeries(candles, {
    symbol,
    serverTime,
    expectedStartTime: openTime,
    expectedEndTime: openTime,
  });
}

function validatePreflightIntrabar(
  response: BinanceResponse<unknown>,
  symbol: ResearchSymbol,
  openTime: number,
  serverTime: number,
): void {
  const closeTime = openTime + INTERVAL_MS["1h"] - 1;
  const candles = parseBinanceIntrabarKlines(response.data, symbol);
  validateIntrabarSettlementWindow(candles, {
    symbol,
    exitCandleOpenTime: openTime,
    exitCandleCloseTime: closeTime,
    serverTime,
  });
}

export async function runRound006PublicDataPreflight(
  client: Pick<BinancePublicClient, "getServerTime" | "getKlinesRange" | "getFundingRateHistory" | "getMarkPriceKlinesRange" | "getIntrabarKlinesRange">,
): Promise<Round006PreflightReport> {
  const serverTimeResponse = await client.getServerTime();
  const serverTime = serverTimeResponse.data.serverTime;
  if (!Number.isSafeInteger(serverTime) || serverTime <= 0) {
    throw new HistoricalDataError({
      code: "DATA_INCOMPLETE",
      message: "Round-006 public preflight received an invalid server time.",
    });
  }
  const latest1h = latestClosedOpenTime(serverTime, "1h");
  const latest4h = latestClosedOpenTime(serverTime, "4h");
  const fundingRange = { startTime: serverTime - 24 * INTERVAL_MS["1h"], endTime: serverTime - 1 };
  if (fundingRange.startTime < 0) {
    throw new HistoricalDataError({ code: "DATA_INCOMPLETE", message: "Round-006 preflight funding range is invalid." });
  }
  let requestCount = 1;
  for (const symbol of RESEARCH_SYMBOLS) {
    const oneHour = await client.getKlinesRange(symbol, "1h", latest1h, latest1h, 1);
    validatePreflightCandle(oneHour, symbol, "1h", latest1h, serverTime);
    requestCount += 1;
    const fourHour = await client.getKlinesRange(symbol, "4h", latest4h, latest4h, 1);
    validatePreflightCandle(fourHour, symbol, "4h", latest4h, serverTime);
    requestCount += 1;
    const funding = await client.getFundingRateHistory(symbol, fundingRange.startTime, fundingRange.endTime, 100);
    validatePreflightFunding(funding, symbol, fundingRange);
    requestCount += 1;
    const markPrice = await client.getMarkPriceKlinesRange(symbol, latest1h, latest1h, 1);
    validatePreflightMarkPrice(markPrice, symbol, latest1h, serverTime);
    requestCount += 1;
    const intrabar = await client.getIntrabarKlinesRange(
      symbol,
      latest1h,
      latest1h + INTERVAL_MS["1h"] - 1,
      60,
    );
    validatePreflightIntrabar(intrabar, symbol, latest1h, serverTime);
    requestCount += 1;
  }
  return Object.freeze({
    schemaVersion: "m3-r6-round-006-preflight-001",
    status: "PASS",
    serverTime,
    latestClosedCandleOpenTimes: Object.freeze({ "1h": latest1h, "4h": latest4h }),
    symbols: Object.freeze([...RESEARCH_SYMBOLS]),
    requestCount,
    requestFamilies: Object.freeze(["1h", "4h", "funding", "mark-price", "intrabar-settlement"] as const),
    transport: Object.freeze({
      timeoutMs: ROUND006_RESEARCH_TIMEOUT_MS,
      maxAttempts: ROUND006_RESEARCH_MAX_ATTEMPTS,
      maxConcurrency: ROUND006_RESEARCH_MAX_CONCURRENCY,
    }),
  });
}
