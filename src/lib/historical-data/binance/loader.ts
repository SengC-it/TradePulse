import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../../config/constants.ts";
import { BinancePublicClient, type BinancePublicClientOptions } from "../../market-data/binance/client.ts";
import { parseBinanceKlines } from "../../market-data/binance/parser.ts";
import { INTERVAL_MS, type MarketTimeframe } from "../../market-data/intervals.ts";
import type { Candle } from "../../market-data/types.ts";
import { HistoricalDataError } from "../errors.ts";
import { createCandleManifest, createFundingManifest } from "../manifest.ts";
import { parseBinanceFundingRateHistory } from "./parser.ts";
import type {
  HistoricalCandleDataset,
  HistoricalFundingDataset,
  HistoricalFundingRecord,
  HistoricalRange,
  HistoricalStudyData,
  HistoricalSymbolDataset,
} from "../types.ts";
import { validateFundingRecords, validateHistoricalCandleSeries } from "../validation.ts";

export type HistoricalLoaderOptions = Readonly<{
  client?: BinancePublicClient;
  clientOptions?: BinancePublicClientOptions;
  now?: () => number;
  klineLimit?: number;
  fundingLimit?: number;
}>;

export type HistoricalCandleRequest = Readonly<{
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
  range: HistoricalRange;
  /** Captured once by loadStudyData; standalone loads may omit it. */
  serverTime?: number;
}>;

export type HistoricalFundingRequest = Readonly<{
  symbol: ResearchSymbol;
  range: HistoricalRange;
}>;

function rangeError(message: string, symbol?: ResearchSymbol, timeframe?: MarketTimeframe): never {
  throw new HistoricalDataError({
    code: "INVALID_RANGE",
    message,
    ...(symbol ? { symbol } : {}),
    ...(timeframe ? { timeframe } : {}),
  });
}

function assertCandleRange(request: HistoricalCandleRequest): void {
  const intervalMs = INTERVAL_MS[request.timeframe];
  if (
    !Number.isInteger(request.range.startTime) ||
    request.range.startTime < 0 ||
    !Number.isInteger(request.range.endTime) ||
    request.range.endTime < request.range.startTime ||
    request.range.startTime % intervalMs !== 0 ||
    request.range.endTime % intervalMs !== 0
  ) {
    rangeError(
      "Historical candle range must use aligned UTC open-time boundaries.",
      request.symbol,
      request.timeframe,
    );
  }
}

function assertFundingRange(request: HistoricalFundingRequest): void {
  if (
    !Number.isInteger(request.range.startTime) ||
    request.range.startTime < 0 ||
    !Number.isInteger(request.range.endTime) ||
    request.range.endTime < request.range.startTime
  ) {
    rangeError("Funding range must use an ordered UTC epoch interval.", request.symbol);
  }
}

function wrapUpstreamError(error: unknown, symbol: ResearchSymbol, timeframe?: MarketTimeframe): never {
  const upstreamCode =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "UNKNOWN";
  throw new HistoricalDataError({
    code: "DATA_INCOMPLETE",
    message: `Binance historical ${timeframe ? "candle" : "funding"} retrieval failed (${upstreamCode}).`,
    symbol,
    ...(timeframe ? { timeframe } : {}),
    diagnostics: { upstreamCode },
  });
}

export class BinanceHistoricalDataLoader {
  private readonly client: BinancePublicClient;
  private readonly now: () => number;
  private readonly klineLimit: number;
  private readonly fundingLimit: number;

  constructor(options: HistoricalLoaderOptions = {}) {
    this.client = options.client ?? new BinancePublicClient(options.clientOptions);
    this.now = options.now ?? Date.now;
    this.klineLimit = options.klineLimit ?? 1_500;
    this.fundingLimit = options.fundingLimit ?? 1_000;
  }

  private async getAuthoritativeServerTime(symbol: ResearchSymbol, timeframe?: MarketTimeframe): Promise<number> {
    try {
      const response = await this.client.getServerTime();
      if (!Number.isInteger(response.data.serverTime) || response.data.serverTime < 0) {
        throw new Error("Binance server time is invalid.");
      }
      return response.data.serverTime;
    } catch (error) {
      wrapUpstreamError(error, symbol, timeframe);
    }
  }

  async loadCandles(request: HistoricalCandleRequest): Promise<HistoricalCandleDataset> {
    assertCandleRange(request);
    const serverTime = request.serverTime ?? (await this.getAuthoritativeServerTime(request.symbol, request.timeframe));
    const intervalMs = INTERVAL_MS[request.timeframe];
    const candles: Candle[] = [];
    let cursor = request.range.startTime;

    while (cursor <= request.range.endTime) {
      let payload: unknown;
      try {
        payload = (
          await this.client.getKlinesRange(
            request.symbol,
            request.timeframe,
            cursor,
            request.range.endTime,
            this.klineLimit,
          )
        ).data;
      } catch (error) {
        wrapUpstreamError(error, request.symbol, request.timeframe);
      }

      const page = parseBinanceKlines(payload, request.symbol, request.timeframe);
      validateHistoricalCandleSeries(page, {
        symbol: request.symbol,
        timeframe: request.timeframe,
        serverTime,
      });
      const first = page[0];
      const last = page[page.length - 1];
      if (!first || !last) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Binance returned an empty historical candle page.",
          symbol: request.symbol,
          timeframe: request.timeframe,
        });
      }
      if (first.openTime !== cursor) {
        throw new HistoricalDataError({
          code: first.openTime < cursor ? "DUPLICATE_CANDLE" : "CANDLE_GAP",
          message: "Historical Kline pagination did not continue at the next expected candle.",
          symbol: request.symbol,
          timeframe: request.timeframe,
          diagnostics: { cursor, firstOpenTime: first.openTime },
        });
      }
      if (last.openTime > request.range.endTime) {
        throw new HistoricalDataError({
          code: "INVALID_HISTORICAL_DATA",
          message: "Historical Kline page exceeded the requested end boundary.",
          symbol: request.symbol,
          timeframe: request.timeframe,
        });
      }

      candles.push(...page);
      const nextCursor = last.openTime + intervalMs;
      if (nextCursor <= cursor) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Historical Kline pagination made no forward progress.",
          symbol: request.symbol,
          timeframe: request.timeframe,
        });
      }
      cursor = nextCursor;
    }

    const normalized = validateHistoricalCandleSeries(candles, {
      symbol: request.symbol,
      timeframe: request.timeframe,
      expectedStartTime: request.range.startTime,
      expectedEndTime: request.range.endTime,
      serverTime,
    });
    const retrievedAt = this.now();
    return Object.freeze({
      symbol: request.symbol,
      timeframe: request.timeframe,
      candles: normalized,
      manifest: createCandleManifest({
        symbol: request.symbol,
        timeframe: request.timeframe,
        range: request.range,
        candles: normalized,
        retrievedAt,
      }),
    });
  }

  async loadFunding(request: HistoricalFundingRequest): Promise<HistoricalFundingDataset> {
    assertFundingRange(request);
    const records: HistoricalFundingRecord[] = [];
    let cursor = request.range.startTime;

    while (cursor <= request.range.endTime) {
      let payload: unknown;
      try {
        payload = (
          await this.client.getFundingRateHistory(
            request.symbol,
            cursor,
            request.range.endTime,
            this.fundingLimit,
          )
        ).data;
      } catch (error) {
        wrapUpstreamError(error, request.symbol);
      }

      const page = parseBinanceFundingRateHistory(payload, request.symbol);
      if (page.length === 0) break;
      validateFundingRecords(page, {
        symbol: request.symbol,
        startTime: request.range.startTime,
        endTime: request.range.endTime,
      });
      const last = page[page.length - 1];
      if (!last) break;
      const previous = records[records.length - 1];
      if (previous && page[0]!.fundingTime <= previous.fundingTime) {
        throw new HistoricalDataError({
          code: "INVALID_FUNDING",
          message: "Funding pagination repeated an already accepted funding time.",
          symbol: request.symbol,
        });
      }
      records.push(...page);
      const nextCursor = last.fundingTime + 1;
      if (nextCursor <= cursor) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Funding pagination made no forward progress.",
          symbol: request.symbol,
        });
      }
      cursor = nextCursor;
      if (page.length < this.fundingLimit) break;
    }

    const normalized = validateFundingRecords(records, {
      symbol: request.symbol,
      startTime: request.range.startTime,
      endTime: request.range.endTime,
    });
    const retrievedAt = this.now();
    return Object.freeze({
      symbol: request.symbol,
      records: normalized,
      manifest: createFundingManifest({
        symbol: request.symbol,
        range: request.range,
        records: normalized,
        retrievedAt,
      }),
    });
  }

  async loadStudyData(input: Readonly<{
    candleRange: HistoricalRange | Readonly<Record<MarketTimeframe, HistoricalRange>>;
    fundingRange: HistoricalRange;
    settlementTail?: Readonly<{
      candleRange: HistoricalRange;
      fundingRange: HistoricalRange;
    }>;
  }>): Promise<HistoricalStudyData> {
    const firstSymbol = RESEARCH_SYMBOLS[0] ?? "BTCUSDT";
    const serverTime = await this.getAuthoritativeServerTime(firstSymbol);
    const datasets = {} as Record<ResearchSymbol, HistoricalSymbolDataset>;
    const funding = {} as Record<ResearchSymbol, HistoricalFundingDataset>;
    const manifests = [] as HistoricalStudyData["manifests"][number][];
    for (const symbol of RESEARCH_SYMBOLS) {
      const oneHourRange = "1h" in input.candleRange ? input.candleRange["1h"] : input.candleRange;
      const fourHourRange = "4h" in input.candleRange ? input.candleRange["4h"] : input.candleRange;
      const [baseCandles1h, candles4h, baseFundingDataset] = await Promise.all([
        this.loadCandles({ symbol, timeframe: "1h", range: oneHourRange, serverTime }),
        this.loadCandles({ symbol, timeframe: "4h", range: fourHourRange, serverTime }),
        this.loadFunding({ symbol, range: input.fundingRange }),
      ]);
      let candles1h = baseCandles1h;
      let fundingDataset = baseFundingDataset;
      if (input.settlementTail) {
        const [tailCandles, tailFunding] = await Promise.all([
          this.loadCandles({
            symbol,
            timeframe: "1h",
            range: { ...input.settlementTail.candleRange, settlementOnly: true },
            serverTime,
          }),
          this.loadFunding({
            symbol,
            range: { ...input.settlementTail.fundingRange, settlementOnly: true },
          }),
        ]);
        if (tailCandles.candles[0]?.openTime !== baseCandles1h.candles.at(-1)!.openTime + INTERVAL_MS["1h"]) {
          throw new HistoricalDataError({
            code: "DATA_INCOMPLETE",
            message: "Settlement-only candle tail does not begin at the next required 1H candle.",
            symbol,
            timeframe: "1h",
          });
        }
        const combinedCandles = validateHistoricalCandleSeries(
          [...baseCandles1h.candles, ...tailCandles.candles],
          {
            symbol,
            timeframe: "1h",
            expectedStartTime: baseCandles1h.candles[0]!.openTime,
            expectedEndTime: tailCandles.candles.at(-1)!.openTime,
            serverTime,
          },
        );
        const combinedFunding = validateFundingRecords(
          [...baseFundingDataset.records, ...tailFunding.records],
          { symbol },
        );
        candles1h = Object.freeze({ ...baseCandles1h, candles: combinedCandles });
        fundingDataset = Object.freeze({ ...baseFundingDataset, records: combinedFunding });
        manifests.push(tailCandles.manifest, tailFunding.manifest);
      }
      datasets[symbol] = Object.freeze({ candles1h, candles4h });
      funding[symbol] = fundingDataset;
      manifests.push(candles1h.manifest, candles4h.manifest, fundingDataset.manifest);
    }
    return Object.freeze({
      datasets: Object.freeze(datasets),
      funding: Object.freeze(funding),
      manifests: Object.freeze(manifests),
      serverTime,
    });
  }
}

export const BinanceHistoricalLoader = BinanceHistoricalDataLoader;

export async function loadHistoricalCandles(
  request: HistoricalCandleRequest,
  options: HistoricalLoaderOptions = {},
): Promise<HistoricalCandleDataset> {
  return new BinanceHistoricalDataLoader(options).loadCandles(request);
}

export async function loadHistoricalFunding(
  request: HistoricalFundingRequest,
  options: HistoricalLoaderOptions = {},
): Promise<HistoricalFundingDataset> {
  return new BinanceHistoricalDataLoader(options).loadFunding(request);
}

export const loadHistoricalKlines = loadHistoricalCandles;
export const loadFundingRateHistory = loadHistoricalFunding;
