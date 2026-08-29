import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../../config/constants.ts";
import { BinancePublicClient, type BinancePublicClientOptions } from "../../market-data/binance/client.ts";
import { MarketDataError } from "../../market-data/errors.ts";
import { parseBinanceKlines } from "../../market-data/binance/parser.ts";
import { INTERVAL_MS, type MarketTimeframe } from "../../market-data/intervals.ts";
import type { Candle } from "../../market-data/types.ts";
import { HistoricalDataError } from "../errors.ts";
import {
  createCandleManifest,
  createFundingManifest,
  createIntrabarSettlementManifest,
  createMarkPriceManifest,
} from "../manifest.ts";
import { parseBinanceFundingRateHistory } from "./parser.ts";
import { parseBinanceMarkPriceKlines } from "./mark-price.ts";
import { parseBinanceIntrabarKlines } from "./intrabar.ts";
import { isBacktestPolicy, type BacktestPolicyVersion } from "../../backtest/constants.ts";
import { deduplicateIntrabarSettlementIdentities } from "../intrabar.ts";
import type {
  HistoricalCandleDataset,
  HistoricalFundingDataset,
  HistoricalFundingPagination,
  HistoricalFundingRecord,
  HistoricalMarkPriceCandle,
  HistoricalMarkPriceDataset,
  HistoricalMarkPriceSegment,
  HistoricalIntrabarSettlementWindow,
  IntrabarSettlementCandle,
  HistoricalRange,
  HistoricalStudyData,
  HistoricalSymbolDataset,
} from "../types.ts";
import {
  validateFundingRecords,
  validateHistoricalCandleSeries,
  validateIntrabarSettlementWindow,
  validateMarkPriceCandleSeries,
} from "../validation.ts";

export type HistoricalLoaderOptions = Readonly<{
  client?: BinancePublicClient;
  clientOptions?: BinancePublicClientOptions;
  now?: () => number;
  klineLimit?: number;
  fundingLimit?: number;
  markPriceLimit?: number;
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
  policy?: BacktestPolicyVersion;
}>;

export type HistoricalMarkPriceRequest = Readonly<{
  symbol: ResearchSymbol;
  range: HistoricalRange;
  /** Captured once by loadStudyData; standalone loads may omit it. */
  serverTime?: number;
}>;

export type HistoricalIntrabarSettlementRequest = Readonly<{
  symbol: ResearchSymbol;
  exitCandleOpenTime: number;
  settlementOnly: boolean;
  serverTime?: number;
}>;

export type HistoricalIntrabarSettlementRequirement = Readonly<{
  symbol: ResearchSymbol;
  exitCandleOpenTime: number;
  settlementOnly: boolean;
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

function assertMarkPriceRange(request: HistoricalMarkPriceRequest): void {
  if (
    !Number.isInteger(request.range.startTime) ||
    request.range.startTime < 0 ||
    !Number.isInteger(request.range.endTime) ||
    request.range.endTime < request.range.startTime
  ) {
    rangeError("Mark-price Kline range must use an ordered UTC epoch interval.", request.symbol, "1h");
  }
}

function safeUpstreamDiagnostics(error: MarketDataError): Readonly<Record<string, number | string | boolean>> {
  const source = error.diagnostics;
  const diagnostics: Record<string, number | string | boolean> = {
    rootCauseCode: error.code,
    upstreamCode: error.code,
  };
  if (source?.endpoint?.startsWith("/")) diagnostics.endpoint = source.endpoint.split("?", 1)[0]!;
  for (const key of [
    "httpStatus",
    "attempts",
    "operationStartedAt",
    "attemptStartedAt",
    "attemptCompletedAt",
    "roundTripMs",
    "retryAfterMs",
    "maxRetryDelayMs",
  ] as const) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) diagnostics[key] = value;
  }
  return diagnostics;
}

function wrapUpstreamError(error: unknown, symbol: ResearchSymbol, timeframe?: MarketTimeframe): never {
  if (error instanceof HistoricalDataError) throw error;

  const upstreamCode = error instanceof MarketDataError
    ? error.code
    : typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "UNKNOWN";
  const diagnostics = error instanceof MarketDataError
    ? safeUpstreamDiagnostics(error)
    : { rootCauseCode: upstreamCode, upstreamCode };
  throw new HistoricalDataError({
    code: "DATA_INCOMPLETE",
    message: `Binance historical ${timeframe ? "candle" : "funding"} retrieval failed (${upstreamCode}).`,
    symbol,
    ...(timeframe ? { timeframe } : {}),
    diagnostics,
  });
}

export class BinanceHistoricalDataLoader {
  private readonly client: BinancePublicClient;
  private readonly now: () => number;
  private readonly klineLimit: number;
  private readonly fundingLimit: number;
  private readonly markPriceLimit: number;

  constructor(options: HistoricalLoaderOptions = {}) {
    this.client = options.client ?? new BinancePublicClient(options.clientOptions);
    this.now = options.now ?? Date.now;
    this.klineLimit = options.klineLimit ?? 1_500;
    this.fundingLimit = options.fundingLimit ?? 1_000;
    this.markPriceLimit = options.markPriceLimit ?? 1_500;
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
    const policy = request.policy ?? "bt-policy-001";
    if (!isBacktestPolicy(policy)) {
      rangeError("Historical funding load requires a supported backtest policy.", request.symbol);
    }
    const records: HistoricalFundingRecord[] = [];
    let cursor = request.range.startTime;
    let pageCount = 0;
    let paginationComplete = false;
    let terminationReason: HistoricalFundingPagination["terminationReason"] = "END_TIME_REACHED";

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
      pageCount += 1;
      if (page.length === 0) {
        terminationReason = "EMPTY_PAGE";
        break;
      }
      validateFundingRecords(page, {
        symbol: request.symbol,
        startTime: request.range.startTime,
        endTime: request.range.endTime,
        policy,
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
      if (page.length < this.fundingLimit) {
        terminationReason = "SHORT_PAGE";
        break;
      }
    }

    const normalized = validateFundingRecords(records, {
      symbol: request.symbol,
      startTime: request.range.startTime,
      endTime: request.range.endTime,
      policy,
    });
    paginationComplete = true;
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
      pagination: Object.freeze({
        pageCount,
        paginationComplete,
        terminationReason,
        requestedStartTime: request.range.startTime,
        requestedEndTime: request.range.endTime,
        firstReturnedFundingTime: normalized[0]?.fundingTime ?? null,
        lastReturnedFundingTime: normalized[normalized.length - 1]?.fundingTime ?? null,
        finalCursor: cursor,
      }),
    });
  }

  async loadMarkPriceKlines(request: HistoricalMarkPriceRequest): Promise<HistoricalMarkPriceDataset> {
    assertMarkPriceRange(request);
    const serverTime = request.serverTime ?? (await this.getAuthoritativeServerTime(request.symbol, "1h"));
    const interval = INTERVAL_MS["1h"];
    const expectedStartTime = Math.ceil(request.range.startTime / interval) * interval;
    const expectedEndTime = Math.floor(request.range.endTime / interval) * interval;
    const candles: HistoricalMarkPriceCandle[] = [];
    let cursor = expectedStartTime;

    while (cursor <= expectedEndTime) {
      const remainingCandleCount = Math.floor((expectedEndTime - cursor) / interval) + 1;
      const pageLimit = Math.min(this.markPriceLimit, remainingCandleCount);
      const pageExpectedEnd = cursor + (pageLimit - 1) * interval;
      let payload: unknown;
      try {
        payload = (
          await this.client.getMarkPriceKlinesRange(
            request.symbol,
            cursor,
            pageExpectedEnd,
            pageLimit,
          )
        ).data;
      } catch (error) {
        wrapUpstreamError(error, request.symbol, "1h");
      }

      const page = parseBinanceMarkPriceKlines(payload, request.symbol);
      const first = page[0];
      const last = page[page.length - 1];
      if (!first || !last) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Binance returned an empty historical mark-price Kline page.",
          symbol: request.symbol,
          diagnostics: { cursor, pageExpectedEnd, pageLimit, receivedCount: page.length },
        });
      }
      if (first.openTime !== cursor) {
        throw new HistoricalDataError({
          code: first.openTime < cursor ? "DUPLICATE_CANDLE" : "CANDLE_GAP",
          message: "Historical mark-price Kline pagination did not continue at the next expected candle.",
          symbol: request.symbol,
          diagnostics: { cursor, firstOpenTime: first.openTime, pageExpectedEnd, pageLimit },
        });
      }
      validateMarkPriceCandleSeries(page, {
        symbol: request.symbol,
        serverTime,
        expectedStartTime: cursor,
        expectedEndTime: pageExpectedEnd,
      });
      if (page.length !== pageLimit || last.openTime !== pageExpectedEnd) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Historical mark-price Kline page did not match its exact requested window.",
          symbol: request.symbol,
          diagnostics: {
            cursor,
            pageExpectedEnd,
            pageLimit,
            receivedCount: page.length,
            actualLastOpenTime: last.openTime,
          },
        });
      }
      if (last.openTime > expectedEndTime) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Historical mark-price Kline page exceeded the requested end boundary.",
          symbol: request.symbol,
        });
      }

      candles.push(...page);
      const nextCursor = pageExpectedEnd + interval;
      if (nextCursor <= cursor) {
        throw new HistoricalDataError({
          code: "DATA_INCOMPLETE",
          message: "Historical mark-price Kline pagination made no forward progress.",
          symbol: request.symbol,
        });
      }
      cursor = nextCursor;
    }

    const normalized = validateMarkPriceCandleSeries(candles, {
      symbol: request.symbol,
      serverTime,
      expectedStartTime,
      expectedEndTime,
    });
    const retrievedAt = this.now();
    const manifest = createMarkPriceManifest({
      symbol: request.symbol,
      range: request.range,
      candles: normalized,
      retrievedAt,
    });
    return Object.freeze({
      symbol: request.symbol,
      candles: normalized,
      manifest,
      manifests: Object.freeze([manifest]),
    });
  }

  async loadMarkPrice(request: HistoricalMarkPriceRequest): Promise<HistoricalMarkPriceDataset> {
    return this.loadMarkPriceKlines(request);
  }

  async loadIntrabarSettlementWindow(
    request: HistoricalIntrabarSettlementRequest,
  ): Promise<HistoricalIntrabarSettlementWindow> {
    const exitCandleCloseTime = request.exitCandleOpenTime + INTERVAL_MS["1h"] - 1;
    const serverTime =
      request.serverTime ?? (await this.getAuthoritativeServerTime(request.symbol, "1h"));
    let payload: unknown;
    try {
      payload = (
        await this.client.getIntrabarKlinesRange(
          request.symbol,
          request.exitCandleOpenTime,
          exitCandleCloseTime,
          60,
        )
      ).data;
    } catch (error) {
      wrapUpstreamError(error, request.symbol, "1h");
    }
    const parsed = parseBinanceIntrabarKlines(payload, request.symbol);
    const candles: readonly IntrabarSettlementCandle[] = validateIntrabarSettlementWindow(parsed, {
      symbol: request.symbol,
      exitCandleOpenTime: request.exitCandleOpenTime,
      exitCandleCloseTime,
      serverTime,
    });
    const range: HistoricalRange = {
      startTime: request.exitCandleOpenTime,
      endTime: exitCandleCloseTime,
      settlementOnly: request.settlementOnly,
    };
    const manifest = createIntrabarSettlementManifest({
      symbol: request.symbol,
      exitCandleOpenTime: request.exitCandleOpenTime,
      range,
      candles,
      retrievedAt: this.now(),
    });
    return Object.freeze({
      symbol: request.symbol,
      exitCandleOpenTime: request.exitCandleOpenTime,
      settlementOnly: request.settlementOnly,
      candles,
      manifest,
    });
  }

  async loadIntrabarSettlementWindows(
    requirements: readonly HistoricalIntrabarSettlementRequirement[],
    serverTime: number,
  ): Promise<readonly HistoricalIntrabarSettlementWindow[]> {
    const symbolOrder = new Map(RESEARCH_SYMBOLS.map((symbol, index) => [symbol, index]));
    const identity = deduplicateIntrabarSettlementIdentities(requirements);
    if (identity.conflictingKeys.length > 0) {
      throw new HistoricalDataError({
        code: "DATA_INCOMPLETE",
        message: `Conflicting settlementOnly classification for intrabar requirement ${identity.conflictingKeys[0]}.`,
      });
    }
    const ordered = [...identity.unique].sort(
      (left, right) =>
        (symbolOrder.get(left.symbol) ?? Number.MAX_SAFE_INTEGER) -
          (symbolOrder.get(right.symbol) ?? Number.MAX_SAFE_INTEGER) ||
        left.exitCandleOpenTime - right.exitCandleOpenTime,
    );
    const windows: HistoricalIntrabarSettlementWindow[] = [];
    for (const requirement of ordered) {
      windows.push(
        await this.loadIntrabarSettlementWindow({
          ...requirement,
          serverTime,
        }),
      );
    }
    return Object.freeze(windows);
  }

  async loadStudyData(input: Readonly<{
    candleRange: HistoricalRange | Readonly<Record<MarketTimeframe, HistoricalRange>>;
    fundingRange: HistoricalRange;
    markPriceRange?: HistoricalRange;
    policy?: BacktestPolicyVersion;
    /** Allows an already-frozen offline study to reuse its captured validation time. */
    serverTime?: number;
    settlementTail?: Readonly<{
      candleRange: HistoricalRange;
      fundingRange: HistoricalRange;
      markPriceRange?: HistoricalRange;
    }>;
  }>): Promise<HistoricalStudyData> {
    const policy = input.policy ?? "bt-policy-001";
    if (!isBacktestPolicy(policy)) {
      throw new HistoricalDataError({
        code: "INVALID_RANGE",
        message: "Historical study requires a supported backtest policy.",
      });
    }
    const firstSymbol = RESEARCH_SYMBOLS[0] ?? "BTCUSDT";
    const serverTime = input.serverTime ?? (await this.getAuthoritativeServerTime(firstSymbol));
    const datasets = {} as Record<ResearchSymbol, HistoricalSymbolDataset>;
    const funding = {} as Record<ResearchSymbol, HistoricalFundingDataset>;
    const markPrice = {} as Record<ResearchSymbol, HistoricalMarkPriceDataset | undefined>;
    const markPriceSegments = {} as Record<ResearchSymbol, readonly HistoricalMarkPriceSegment[] | undefined>;
    const manifests = [] as HistoricalStudyData["manifests"][number][];
    for (const symbol of RESEARCH_SYMBOLS) {
      const oneHourRange = "1h" in input.candleRange ? input.candleRange["1h"] : input.candleRange;
      const fourHourRange = "4h" in input.candleRange ? input.candleRange["4h"] : input.candleRange;
      const [baseCandles1h, candles4h, baseFundingDataset] = await Promise.all([
        this.loadCandles({ symbol, timeframe: "1h", range: oneHourRange, serverTime }),
        this.loadCandles({ symbol, timeframe: "4h", range: fourHourRange, serverTime }),
        this.loadFunding({ symbol, range: input.fundingRange, policy }),
      ]);
      let candles1h = baseCandles1h;
      let fundingDataset = baseFundingDataset;
      let markPriceDataset: HistoricalMarkPriceDataset | undefined;
      let markPriceSegmentsForSymbol: readonly HistoricalMarkPriceSegment[] | undefined;
      const baseNeedsFallback = baseFundingDataset.records.some(
        (record) =>
          !(typeof record.directMarkPrice === "number" && Number.isFinite(record.directMarkPrice) && record.directMarkPrice > 0),
      );
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
            policy,
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
          { symbol, policy },
        );
        candles1h = Object.freeze({ ...baseCandles1h, candles: combinedCandles });
        fundingDataset = Object.freeze({ ...baseFundingDataset, records: combinedFunding });
        manifests.push(tailCandles.manifest, tailFunding.manifest);

        const tailNeedsFallback = tailFunding.records.some(
          (record) =>
            !(typeof record.directMarkPrice === "number" && Number.isFinite(record.directMarkPrice) && record.directMarkPrice > 0),
        );
        if ((policy === "bt-policy-002" || policy === "bt-policy-003") && (baseNeedsFallback || tailNeedsFallback)) {
          const baseMarkRange = input.markPriceRange ?? {
            startTime: input.fundingRange.startTime - INTERVAL_MS["1h"],
            endTime: input.fundingRange.endTime,
          };
          const tailMarkRange = input.settlementTail.markPriceRange ?? {
            startTime: input.settlementTail.fundingRange.startTime,
            endTime: input.settlementTail.fundingRange.endTime,
            settlementOnly: true,
          };
          const [baseMark, tailMark] = await Promise.all([
            baseNeedsFallback || tailNeedsFallback
              ? this.loadMarkPriceKlines({ symbol, range: baseMarkRange, serverTime })
              : Promise.resolve(undefined),
            tailNeedsFallback
              ? this.loadMarkPriceKlines({
                  symbol,
                  range: { ...tailMarkRange, settlementOnly: true },
                  serverTime,
                })
              : Promise.resolve(undefined),
          ]);
          if (baseMark || tailMark) {
            const markCandles = [...(baseMark?.candles ?? []), ...(tailMark?.candles ?? [])];
            if (markCandles.length === 0) {
              throw new HistoricalDataError({
                code: "DATA_INCOMPLETE",
                message: "Required mark-price Kline fallback data is missing.",
                symbol,
              });
            }
            markPriceDataset = Object.freeze({
              symbol,
              candles: Object.freeze(markCandles),
              manifest: baseMark?.manifest ?? tailMark!.manifest,
              manifests: Object.freeze([
                ...(baseMark?.manifests ?? []),
                ...(tailMark?.manifests ?? []),
              ]),
            });
            const segments: HistoricalMarkPriceSegment[] = [];
            if (baseMark) {
              segments.push(
                Object.freeze({ segment: "base", candles: baseMark.candles, manifest: baseMark.manifest }),
              );
            }
            if (tailMark) {
              segments.push(
                Object.freeze({
                  segment: "settlement-tail",
                  candles: tailMark.candles,
                  manifest: tailMark.manifest,
                }),
              );
            }
            markPriceSegmentsForSymbol = Object.freeze(segments);
            manifests.push(...markPriceDataset.manifests);
          }
        }
      } else if ((policy === "bt-policy-002" || policy === "bt-policy-003") && baseNeedsFallback) {
        const markRange = input.markPriceRange ?? {
          startTime: input.fundingRange.startTime - INTERVAL_MS["1h"],
          endTime: input.fundingRange.endTime,
        };
        markPriceDataset = await this.loadMarkPriceKlines({ symbol, range: markRange, serverTime });
        markPriceSegmentsForSymbol = Object.freeze([
          Object.freeze({ segment: "base", candles: markPriceDataset.candles, manifest: markPriceDataset.manifest }),
        ]);
        manifests.push(...markPriceDataset.manifests);
      }
      datasets[symbol] = Object.freeze({ candles1h, candles4h });
      funding[symbol] = fundingDataset;
      markPrice[symbol] = markPriceDataset;
      markPriceSegments[symbol] = markPriceSegmentsForSymbol;
      manifests.push(candles1h.manifest, candles4h.manifest, fundingDataset.manifest);
    }
    return Object.freeze({
      datasets: Object.freeze(datasets),
      funding: Object.freeze(funding),
      markPrice: Object.freeze(markPrice),
      markPriceSegments: Object.freeze(markPriceSegments),
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

export async function loadHistoricalMarkPrice(
  request: HistoricalMarkPriceRequest,
  options: HistoricalLoaderOptions = {},
): Promise<HistoricalMarkPriceDataset> {
  return new BinanceHistoricalDataLoader(options).loadMarkPriceKlines(request);
}

export async function loadHistoricalIntrabarSettlement(
  request: HistoricalIntrabarSettlementRequest,
  options: HistoricalLoaderOptions = {},
): Promise<HistoricalIntrabarSettlementWindow> {
  return new BinanceHistoricalDataLoader(options).loadIntrabarSettlementWindow(request);
}

export async function loadHistoricalIntrabarSettlementWindows(
  requirements: readonly HistoricalIntrabarSettlementRequirement[],
  serverTime: number,
  options: HistoricalLoaderOptions = {},
): Promise<readonly HistoricalIntrabarSettlementWindow[]> {
  return new BinanceHistoricalDataLoader(options).loadIntrabarSettlementWindows(requirements, serverTime);
}

export const loadHistoricalKlines = loadHistoricalCandles;
export const loadFundingRateHistory = loadHistoricalFunding;
export const loadMarkPriceKlines = loadHistoricalMarkPrice;
