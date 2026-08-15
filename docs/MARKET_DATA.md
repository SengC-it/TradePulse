# TradePulse Market Data

Status: M1 implementation

## Boundary

M1 provides validated public market data only. It does not calculate indicators, create signals, write Supabase business data, send notifications, or trade. The five approved symbols remain `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, and `BNBUSDT`. The only supported timeframes are `1h` and `4h`.

## Data source and endpoints

The Binance adapter uses the USDⓈ-M Futures public REST base URL:

```text
https://fapi.binance.com
```

Only these endpoints are called:

| Endpoint | Purpose |
| --- | --- |
| `GET /fapi/v1/time` | Authoritative Binance server time |
| `GET /fapi/v1/exchangeInfo` | Symbol status and contract metadata |
| `GET /fapi/v1/klines` | Public 1h and 4h Kline data |

The adapter does not send API keys or authentication headers. It never calls account, order, position, balance, leverage, margin, or user-stream endpoints. The endpoint definitions are maintained in the [Binance USDⓈ-M REST API reference](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data).

## Module boundaries

```text
MarketDataProvider
        ↓
BinanceMarketDataProvider
        ↓
BinancePublicClient
        ├── /time
        ├── /exchangeInfo
        └── /klines
        ↓
Binance parser → validation → ClosedCandleDataset → MarketSnapshot
```

`MarketDataProvider` is independent of Binance and exposes server time, symbol metadata, closed candles, and a complete market snapshot. The Binance parser is the only place that understands Binance's twelve-field array response. Strategy and future backtest code consume `Candle`, `ClosedCandleDataset`, and `MarketSnapshot`, never raw array indexes.

## Candle model

Each normalized `Candle` contains:

```text
symbol, timeframe, openTime, closeTime,
open, high, low, close, volume, quoteVolume,
tradeCount, takerBuyBaseVolume, takerBuyQuoteVolume
```

Prices and quantities are finite numbers before entering the domain model. Times are UTC epoch milliseconds. The resulting dataset is read-only-oriented and contains exactly the most recent 250 valid closed candles.

## Server time and closed candles

Every snapshot obtains Binance server time from `/fapi/v1/time`. ExchangeInfo's `serverTime`, local machine time, browser time, and Vercel time are not substitutes.

A candle is closed exactly when:

```text
candle.closeTime < binanceServerTime
```

The adapter requests 251 candles, filters forming candles, then requires at least 250 closed candles. The final output is the latest 250. The expected latest open time is deterministic:

```text
floor(serverTime / intervalMs) * intervalMs - intervalMs
```

The latest returned closed candle must equal that open time. Otherwise the dataset is `STALE_DATA`.

The server-time response also records request start/end, round-trip latency, estimated midpoint clock offset, and the optional Binance request-weight header. Clock offset is diagnostic only and never changes candle timestamps or close status.

## Validation and fail-closed policy

Before a dataset becomes valid, the adapter checks:

- approved symbol, `TRADING` status, `PERPETUAL` contract type, and `USDT` quote asset;
- exact 12-field Kline shape and finite numeric conversion;
- positive OHLC values, non-negative volumes and trade count;
- `high >= open`, `high >= close`, `high >= low`, `low <= open`, and `low <= close`;
- valid timestamps with `closeTime > openTime`;
- strict ascending open-time ordering;
- no duplicate `(symbol, timeframe, openTime)` candle;
- exact 1h or 4h interval between adjacent candles;
- at least 250 closed candles;
- freshness against Binance server time.

No gap is filled. No candle is interpolated, forward-filled, backward-filled, selected from a duplicate, or repaired. Any key failure returns an explicit error and no `VALID` dataset.

`MarketSnapshot` reports each approved symbol separately. All valid symbols produce `VALID`; a mix of valid and invalid symbols produces `PARTIAL`; a system-level failure such as unavailable server time produces `INVALID`.

## Error model

`MarketDataError` includes a stable `code`, safe message, optional symbol/timeframe, retryability, and safe diagnostics. Codes are:

```text
SERVER_TIME_UNAVAILABLE  HTTP_TIMEOUT       NETWORK_ERROR
RATE_LIMITED             UPSTREAM_5XX       INVALID_RESPONSE
INVALID_SYMBOL           SYMBOL_UNAVAILABLE INSUFFICIENT_HISTORY
INVALID_TIMESTAMP        INVALID_NUMBER     INVALID_OHLC
OUT_OF_ORDER_CANDLES     DUPLICATE_CANDLE   CANDLE_GAP
STALE_DATA
```

Raw upstream bodies and arbitrary headers are never copied into error messages or logs.

## Timeout, retry, and rate limits

- Every request uses an `AbortController` with a default 5-second timeout.
- At most three total attempts are allowed.
- Only network errors, HTTP 408, HTTP 429, and HTTP 5xx responses are retryable.
- HTTP 429 honors `Retry-After` when it is a valid numeric delay.
- Other retryable failures use bounded exponential backoff with jitter.
- Ordinary 4xx responses and malformed successful responses fail immediately.
- The adapter records optional request-weight headers for diagnostics but does not depend on them for correctness.
- Snapshot Kline requests use a maximum concurrency of four.

## Smoke test

The manual public smoke test is intentionally separate from CI:

```powershell
npm run market:smoke
```

It requests the five approved symbols at both supported timeframes and prints server time, status, closed count, first open time, last open time, last close, and latency. It requires no API key and does not print trading recommendations. CI uses mocked responses and never depends on Binance network availability.

## Known risks

- Binance maintenance, rate limits, WAF behavior, or public schema changes can make a snapshot partial or invalid.
- Binance can return an upstream location-eligibility response such as HTTP 451; M1 reports that as invalid public data and does not bypass the restriction.
- A local clock offset can affect diagnostics, but it cannot affect closed-candle acceptance because Binance server time is authoritative.
- Exact freshness intentionally fails closed when the upstream latest candle is delayed.
- M1 does not persist candles; historical data retention and backtest loading remain M3 work.
