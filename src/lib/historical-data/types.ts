import type { ResearchSymbol } from "../config/constants.ts";
import type { MarketTimeframe } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";

export const HISTORICAL_PROVIDER = "binance-usdm-public" as const;

export type HistoricalRange = Readonly<{
  startTime: number;
  endTime: number;
  settlementOnly?: boolean;
}>;

export type HistoricalCandleManifest = Readonly<{
  kind: "candles";
  provider: typeof HISTORICAL_PROVIDER;
  source: "/fapi/v1/klines";
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
  requestedStartTime: number;
  requestedEndTime: number;
  actualStartTime: number | null;
  actualEndTime: number | null;
  rowCount: number;
  retrievedAt: string;
  sha256: string;
  settlementOnly: boolean;
}>;

export type HistoricalFundingRecord = Readonly<{
  symbol: ResearchSymbol;
  fundingTime: number;
  fundingRate: number;
  markPrice: number;
}>;

export type HistoricalFundingManifest = Readonly<{
  kind: "funding";
  provider: typeof HISTORICAL_PROVIDER;
  source: "/fapi/v1/fundingRate";
  symbol: ResearchSymbol;
  requestedStartTime: number;
  requestedEndTime: number;
  actualStartTime: number | null;
  actualEndTime: number | null;
  rowCount: number;
  retrievedAt: string;
  sha256: string;
  settlementOnly: boolean;
  markPriceField: "markPrice";
}>;

export type HistoricalManifest = HistoricalCandleManifest | HistoricalFundingManifest;

export type HistoricalCandleDataset = Readonly<{
  symbol: ResearchSymbol;
  timeframe: MarketTimeframe;
  candles: readonly Candle[];
  manifest: HistoricalCandleManifest;
}>;

export type HistoricalFundingDataset = Readonly<{
  symbol: ResearchSymbol;
  records: readonly HistoricalFundingRecord[];
  manifest: HistoricalFundingManifest;
}>;

export type HistoricalSymbolDataset = Readonly<{
  candles1h: HistoricalCandleDataset;
  candles4h: HistoricalCandleDataset;
}>;

export type HistoricalStudyData = Readonly<{
  datasets: Readonly<Record<ResearchSymbol, HistoricalSymbolDataset>>;
  funding: Readonly<Record<ResearchSymbol, HistoricalFundingDataset>>;
  manifests: readonly HistoricalManifest[];
  serverTime: number;
}>;
