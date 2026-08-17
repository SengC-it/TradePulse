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
  /** The raw funding-history markPrice, normalized to null when unusable. */
  directMarkPrice: number | null;
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

export type HistoricalMarkPriceCandle = Readonly<{
  symbol: ResearchSymbol;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}>;

export type HistoricalMarkPriceManifest = Readonly<{
  kind: "mark-price";
  provider: typeof HISTORICAL_PROVIDER;
  source: "/fapi/v1/markPriceKlines";
  symbol: ResearchSymbol;
  timeframe: "1h";
  requestedStartTime: number;
  requestedEndTime: number;
  actualStartTime: number | null;
  actualEndTime: number | null;
  rowCount: number;
  retrievedAt: string;
  sha256: string;
  settlementOnly: boolean;
}>;

export type HistoricalMarkPriceDataset = Readonly<{
  symbol: ResearchSymbol;
  candles: readonly HistoricalMarkPriceCandle[];
  manifest: HistoricalMarkPriceManifest;
  manifests: readonly HistoricalMarkPriceManifest[];
}>;

export type HistoricalMarkPriceSegment = Readonly<{
  segment: "base" | "settlement-tail";
  candles: readonly HistoricalMarkPriceCandle[];
  manifest: HistoricalMarkPriceManifest;
}>;

export type HistoricalManifest =
  | HistoricalCandleManifest
  | HistoricalFundingManifest
  | HistoricalMarkPriceManifest;

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
  markPrice: Readonly<Record<ResearchSymbol, HistoricalMarkPriceDataset | undefined>>;
  markPriceSegments: Readonly<Record<ResearchSymbol, readonly HistoricalMarkPriceSegment[] | undefined>>;
  manifests: readonly HistoricalManifest[];
  serverTime: number;
}>;
