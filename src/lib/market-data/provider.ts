import type { ResearchSymbol } from "../config/constants.ts";

import type { MarketTimeframe } from "./intervals.ts";
import type { MarketSnapshot, ServerTime, SymbolMetadata, ClosedCandleDataset } from "./types.ts";

export interface MarketDataProvider {
  readonly providerName: string;
  getServerTime(): Promise<ServerTime>;
  getSymbolMetadata(symbol: ResearchSymbol): Promise<SymbolMetadata>;
  getClosedCandles(symbol: ResearchSymbol, timeframe: MarketTimeframe): Promise<ClosedCandleDataset>;
  getMarketSnapshot(): Promise<MarketSnapshot>;
}
