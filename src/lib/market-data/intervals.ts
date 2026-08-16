export const MARKET_TIMEFRAMES = ["1h", "4h"] as const;

export type MarketTimeframe = (typeof MARKET_TIMEFRAMES)[number];

export const INTERVAL_MS: Readonly<Record<MarketTimeframe, number>> = {
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
};

export const REQUIRED_CLOSED_CANDLES = 250;
export const REQUESTED_CANDLE_LIMIT = REQUIRED_CLOSED_CANDLES + 1;
export const BINANCE_HTTP_TIMEOUT_MS = 5_000;
export const BINANCE_MAX_ATTEMPTS = 3;
export const BINANCE_MAX_RETRY_DELAY_MS = 5_000;
export const BINANCE_MAX_CONCURRENCY = 4;

export function isMarketTimeframe(value: unknown): value is MarketTimeframe {
  return MARKET_TIMEFRAMES.includes(value as MarketTimeframe);
}
