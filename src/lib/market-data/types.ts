import type { ResearchSymbol } from "../config/constants.ts";

import type { MarketDataErrorDetails } from "./errors.ts";
import type { MarketTimeframe } from "./intervals.ts";

export type Candle = Readonly<{
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  tradeCount: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
}>;

export type ServerTime = Readonly<{
  serverTime: number;
  operationStartedAt: number;
  attemptStartedAt: number;
  attemptCompletedAt: number;
  roundTripMs: number;
  estimatedClockOffsetMs: number;
  requestWeight?: string;
}>;

export type SymbolMetadata = Readonly<{
  symbol: ResearchSymbol;
  status: string;
  contractType: string;
  baseAsset: string;
  quoteAsset: string;
  marginAsset?: string;
}>;

export type ClosedCandleDataset = Readonly<{
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
  serverTime: number;
  expectedLatestOpenTime: number;
  candles: readonly Candle[];
}>;

export type DatasetResult =
  | Readonly<{
      status: "VALID";
      dataset: ClosedCandleDataset;
    }>
  | Readonly<{
      status: "INVALID";
      error: MarketDataErrorDetails;
    }>;

export type SymbolSnapshotResult =
  | Readonly<{
      symbol: ResearchSymbol;
      status: "VALID";
      datasets: Readonly<Record<MarketTimeframe, ClosedCandleDataset>>;
    }>
  | Readonly<{
      symbol: ResearchSymbol;
      status: "INVALID";
      datasets: Readonly<Record<MarketTimeframe, DatasetResult>>;
      error: MarketDataErrorDetails;
    }>;

export type MarketSnapshotStatus = "VALID" | "PARTIAL" | "INVALID";

export type MarketSnapshot = Readonly<{
  status: MarketSnapshotStatus;
  provider: string;
  generatedAt: number;
  serverTime?: ServerTime;
  symbols: Readonly<Record<ResearchSymbol, SymbolSnapshotResult>>;
  diagnostics: Readonly<{
    operationStartedAt: number;
    operationCompletedAt: number;
    roundTripMs: number;
    requestCount: number;
    requestWeightHeaders: readonly string[];
  }>;
  error?: MarketDataErrorDetails;
}>;
