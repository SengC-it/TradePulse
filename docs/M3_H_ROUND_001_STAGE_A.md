# M3-H Round-001 Stage-A Audit

Status: pre-run remediation; no historical performance result has been generated.

## Aborted CONTROL attempts

Both attempts stopped before performance because the historical loader could not obtain the authoritative Binance server time:

| Attempt | Status | Failure | serverTime | controlReportSha256 |
| --- | --- | --- | --- | --- |
| #1 | `ABORTED_BEFORE_PERFORMANCE` | `HTTP_TIMEOUT` | `null` | `null` |
| #2 | `ABORTED_BEFORE_PERFORMANCE` | `HTTP_TIMEOUT` | `null` | `null` |

No complete `m3-b-report-004` CONTROL report, candidate evidence, or historical performance result was produced. Round-001 remains uncontaminated and has not reached `FIRST_M3_H_PERFORMANCE_RESULT_GENERATED`.

## M3-H execution-only HTTP profile

The capture script uses the existing `BinanceHistoricalDataLoader` and official `https://fapi.binance.com` public endpoints. Only the M3-H capture client profile is extended to:

- `timeoutMs = 15000`
- `maxAttempts = 3`

The global market-data defaults remain `BINANCE_HTTP_TIMEOUT_MS = 5000` and `BINANCE_MAX_ATTEMPTS = 3`. The existing `BinancePublicClient` remains the sole owner of retries, and the authoritative study clock still comes from `/fapi/v1/time` through `getServerTime()`.

This changes only how long M3-H waits for the same official response. It does not change requested ranges, provider, endpoint semantics, strategy, policy, settlement, economics, metrics, selectors, folds, gates, or candidate definitions. No fallback, cached clock, local clock, alternate host, proxy bypass, or nested retry is introduced.
