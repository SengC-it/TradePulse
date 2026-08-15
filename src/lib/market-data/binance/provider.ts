import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../../config/constants.ts";

import {
  MarketDataError,
  toMarketDataErrorDetails,
  type MarketDataErrorDetails,
} from "../errors.ts";
import { BINANCE_MAX_CONCURRENCY, MARKET_TIMEFRAMES, type MarketTimeframe } from "../intervals.ts";
import type {
  DatasetResult,
  MarketSnapshot,
  ServerTime,
  SymbolMetadata,
  SymbolSnapshotResult,
} from "../types.ts";
import type { MarketDataProvider } from "../provider.ts";
import { buildClosedCandleDataset } from "../validation.ts";
import { BinancePublicClient } from "./client.ts";
import { parseBinanceExchangeInfo } from "./schemas.ts";
import { parseBinanceKlines } from "./parser.ts";

const PROVIDER_NAME = "binance-usdm-public";

export type BinanceMarketDataProviderOptions = Readonly<{
  client?: BinancePublicClient;
  now?: () => number;
}>;

type DatasetJob = Readonly<{
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
}>;

function toErrorDetails(error: unknown, input: { symbol?: ResearchSymbol; timeframe?: MarketTimeframe }): MarketDataErrorDetails {
  return toMarketDataErrorDetails(error, {
    code: "INVALID_RESPONSE",
    message: "Binance market data validation failed.",
    retryable: false,
    ...input,
  });
}

function createInvalidDataset(error: MarketDataErrorDetails): DatasetResult {
  return { status: "INVALID", error };
}

function createSymbolSnapshot(
  symbol: ResearchSymbol,
  datasets: Readonly<Record<MarketTimeframe, DatasetResult>>,
): SymbolSnapshotResult {
  const oneHour = datasets["1h"];
  const fourHour = datasets["4h"];

  if (oneHour.status === "VALID" && fourHour.status === "VALID") {
    return {
      symbol,
      status: "VALID",
      datasets: Object.freeze({
        "1h": oneHour.dataset,
        "4h": fourHour.dataset,
      }),
    };
  }

  if (oneHour.status === "INVALID") {
    return {
      symbol,
      status: "INVALID",
      datasets,
      error: oneHour.error,
    };
  }

  if (fourHour.status === "INVALID") {
    return {
      symbol,
      status: "INVALID",
      datasets,
      error: fourHour.error,
    };
  }

  return {
    symbol,
    status: "INVALID",
    datasets,
    error: {
      code: "INVALID_RESPONSE",
      message: "A symbol dataset result was incomplete.",
      symbol,
      retryable: false,
    },
  };
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    }),
  );
}

export class BinanceMarketDataProvider implements MarketDataProvider {
  readonly providerName = PROVIDER_NAME;

  private readonly client: BinancePublicClient;
  private readonly now: () => number;

  constructor(options: BinanceMarketDataProviderOptions = {}) {
    this.client = options.client ?? new BinancePublicClient();
    this.now = options.now ?? Date.now;
  }

  async getServerTime(): Promise<ServerTime> {
    const response = await this.client.getServerTime();
    return {
      serverTime: response.data.serverTime,
      operationStartedAt: response.diagnostics.operationStartedAt,
      attemptStartedAt: response.diagnostics.attemptStartedAt,
      attemptCompletedAt: response.diagnostics.attemptCompletedAt,
      roundTripMs: response.diagnostics.roundTripMs,
      estimatedClockOffsetMs: response.diagnostics.estimatedClockOffsetMs ?? 0,
      ...(response.diagnostics.requestWeight
        ? { requestWeight: response.diagnostics.requestWeight }
        : {}),
    };
  }

  async getSymbolMetadata(symbol: ResearchSymbol): Promise<SymbolMetadata> {
    const response = await this.client.getExchangeInfo();
    const symbols = parseBinanceExchangeInfo(response.data);
    return this.resolveSymbolMetadata(symbol, symbols);
  }

  async getClosedCandles(symbol: ResearchSymbol, timeframe: MarketTimeframe) {
    const serverTime = await this.getServerTime();
    const metadata = await this.getSymbolMetadata(symbol);
    const response = await this.client.getKlines(symbol, timeframe);
    const candles = parseBinanceKlines(response.data, metadata.symbol, timeframe);

    return buildClosedCandleDataset({
      symbol,
      timeframe,
      candles,
      serverTime: serverTime.serverTime,
    });
  }

  async getMarketSnapshot(): Promise<MarketSnapshot> {
    const generatedAt = this.now();
    const operationStartedAt = this.now();
    let requestCount = 0;
    const requestWeightHeaders: string[] = [];

    let serverTime: ServerTime;
    try {
      requestCount += 1;
      const response = await this.client.getServerTime();
      serverTime = {
        serverTime: response.data.serverTime,
        operationStartedAt: response.diagnostics.operationStartedAt,
        attemptStartedAt: response.diagnostics.attemptStartedAt,
        attemptCompletedAt: response.diagnostics.attemptCompletedAt,
        roundTripMs: response.diagnostics.roundTripMs,
        estimatedClockOffsetMs: response.diagnostics.estimatedClockOffsetMs ?? 0,
        ...(response.diagnostics.requestWeight
          ? { requestWeight: response.diagnostics.requestWeight }
          : {}),
      };
      if (response.diagnostics.requestWeight) {
        requestWeightHeaders.push(response.diagnostics.requestWeight);
      }
    } catch (error) {
      const details = toErrorDetails(error, {});
      return this.createSystemFailureSnapshot({
        generatedAt,
        operationStartedAt,
        requestCount,
        requestWeightHeaders,
        error: details,
      });
    }

    let metadataBySymbol: ReadonlyMap<ResearchSymbol, SymbolMetadata>;
    const metadataErrors = new Map<ResearchSymbol, MarketDataErrorDetails>();
    try {
      requestCount += 1;
      const response = await this.client.getExchangeInfo();
      const exchangeSymbols = parseBinanceExchangeInfo(response.data);
      const metadata = new Map<ResearchSymbol, SymbolMetadata>();
      for (const symbol of RESEARCH_SYMBOLS) {
        try {
          metadata.set(symbol, this.resolveSymbolMetadata(symbol, exchangeSymbols));
        } catch (error) {
          metadataErrors.set(symbol, toErrorDetails(error, { symbol }));
        }
      }
      metadataBySymbol = metadata;
      if (response.diagnostics.requestWeight) {
        requestWeightHeaders.push(response.diagnostics.requestWeight);
      }
    } catch (error) {
      const details = toErrorDetails(error, {});
      return this.createSystemFailureSnapshot({
        generatedAt,
        operationStartedAt,
        requestCount,
        requestWeightHeaders,
        serverTime,
        error: details,
      });
    }

    const jobs: DatasetJob[] = RESEARCH_SYMBOLS.flatMap((symbol) =>
      MARKET_TIMEFRAMES.map((timeframe) => ({ symbol, timeframe })),
    );
    const results = new Map<string, DatasetResult>();

    await runWithConcurrency(jobs, BINANCE_MAX_CONCURRENCY, async (job) => {
      const metadata = metadataBySymbol.get(job.symbol);
      if (!metadata) {
        const metadataError =
          metadataErrors.get(job.symbol) ??
          toErrorDetails(
            new MarketDataError({
              code: "SYMBOL_UNAVAILABLE",
              message: "Approved symbol metadata is unavailable.",
              symbol: job.symbol,
              timeframe: job.timeframe,
              retryable: false,
            }),
            { symbol: job.symbol, timeframe: job.timeframe },
          );
        results.set(
          `${job.symbol}:${job.timeframe}`,
          createInvalidDataset({ ...metadataError, symbol: job.symbol, timeframe: job.timeframe }),
        );
        return;
      }

      requestCount += 1;
      try {
        const response = await this.client.getKlines(metadata.symbol, job.timeframe);
        const candles = parseBinanceKlines(response.data, metadata.symbol, job.timeframe);
        const dataset = buildClosedCandleDataset({
          symbol: metadata.symbol,
          timeframe: job.timeframe,
          candles,
          serverTime: serverTime.serverTime,
        });
        results.set(`${job.symbol}:${job.timeframe}`, { status: "VALID", dataset });
        if (response.diagnostics.requestWeight) {
          requestWeightHeaders.push(response.diagnostics.requestWeight);
        }
      } catch (error) {
        results.set(
          `${job.symbol}:${job.timeframe}`,
          createInvalidDataset(toErrorDetails(error, { symbol: job.symbol, timeframe: job.timeframe })),
        );
      }
    });

    const symbols = Object.freeze(Object.fromEntries(
      RESEARCH_SYMBOLS.map((symbol) => {
        const datasets = Object.fromEntries(
          MARKET_TIMEFRAMES.map((timeframe) => [
            timeframe,
            results.get(`${symbol}:${timeframe}`) ??
              createInvalidDataset({
                code: "INVALID_RESPONSE",
                message: "Market dataset result was not produced.",
                symbol,
                timeframe,
                retryable: false,
              }),
          ]),
        ) as Readonly<Record<MarketTimeframe, DatasetResult>>;

        return [symbol, createSymbolSnapshot(symbol, datasets)];
      }),
    )) as Readonly<Record<ResearchSymbol, SymbolSnapshotResult>>;

    const validSymbolCount = RESEARCH_SYMBOLS.filter(
      (symbol) => symbols[symbol].status === "VALID",
    ).length;
    const operationCompletedAt = this.now();

    return Object.freeze({
      status: validSymbolCount === RESEARCH_SYMBOLS.length ? "VALID" : validSymbolCount > 0 ? "PARTIAL" : "INVALID",
      provider: this.providerName,
      generatedAt,
      serverTime,
      symbols,
      diagnostics: {
        operationStartedAt,
        operationCompletedAt,
        roundTripMs: Math.max(0, operationCompletedAt - operationStartedAt),
        requestCount,
        requestWeightHeaders: Object.freeze([...requestWeightHeaders]),
      },
    });
  }

  private resolveSymbolMetadata(
    symbol: ResearchSymbol,
    exchangeSymbols: readonly {
      symbol: string;
      status: string;
      contractType: string;
      baseAsset: string;
      quoteAsset: string;
      marginAsset?: string;
    }[],
  ): SymbolMetadata {
    const metadata = exchangeSymbols.find((candidate) => candidate.symbol === symbol);
    if (
      !metadata ||
      metadata.status !== "TRADING" ||
      metadata.contractType !== "PERPETUAL" ||
      metadata.quoteAsset !== "USDT"
    ) {
      throw new MarketDataError({
        code: "SYMBOL_UNAVAILABLE",
        message: "Approved symbol is missing, inactive, non-perpetual, or has an unexpected quote asset.",
        symbol,
        retryable: false,
      });
    }

    return {
      ...metadata,
      symbol,
    };
  }

  private createSystemFailureSnapshot(input: {
    generatedAt: number;
    operationStartedAt: number;
    requestCount: number;
    requestWeightHeaders: readonly string[];
    serverTime?: ServerTime;
    error: MarketDataErrorDetails;
  }): MarketSnapshot {
    const symbols = Object.freeze(Object.fromEntries(
      RESEARCH_SYMBOLS.map((symbol) => {
        const datasets = Object.fromEntries(
          MARKET_TIMEFRAMES.map((timeframe) => [timeframe, createInvalidDataset({ ...input.error, symbol, timeframe })]),
        ) as Readonly<Record<MarketTimeframe, DatasetResult>>;
        return [symbol, createSymbolSnapshot(symbol, datasets)];
      }),
    )) as Readonly<Record<ResearchSymbol, SymbolSnapshotResult>>;
    const operationCompletedAt = this.now();

    return Object.freeze({
      status: "INVALID",
      provider: this.providerName,
      generatedAt: input.generatedAt,
      ...(input.serverTime ? { serverTime: input.serverTime } : {}),
      symbols,
      diagnostics: {
        operationStartedAt: input.operationStartedAt,
        operationCompletedAt,
        roundTripMs: Math.max(0, operationCompletedAt - input.operationStartedAt),
        requestCount: input.requestCount,
        requestWeightHeaders: Object.freeze([...input.requestWeightHeaders]),
      },
      error: input.error,
    });
  }
}
