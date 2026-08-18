# M3-H Round-001 Stage-A / Stage-B Audit

Status: UNDER REVIEW / RESULTS GENERATED; `baseline-002` NOT FROZEN.

## CONTROL attempt history

| Attempt | Source | Status | Failure / execution configuration | serverTime | controlReportSha256 |
| --- | --- | --- | --- | --- | --- |
| #1 | `5513dddee8857fb54d09856af4bf7519437d011b` | `ABORTED_BEFORE_PERFORMANCE` | `HTTP_TIMEOUT` | `null` | `null` |
| #2 | `5513dddee8857fb54d09856af4bf7519437d011b` | `ABORTED_BEFORE_PERFORMANCE` | `HTTP_TIMEOUT` | `null` | `null` |
| #3 | `7b3fa166d01fde79dc95ced182c3c515f904a847` | `ABORTED_BEFORE_PERFORMANCE` | `NETWORK_ERROR` | `null` | `null` |
| #4 | `7b3fa166d01fde79dc95ced182c3c515f904a847` | `COMPLETE` | temporary `NODE_USE_ENV_PROXY=1` execution environment | `1787016706276` | `0d620013f85bff28de11fc9ca4765d300d29630a0e0e04f9175e9c6b97715020` |

Attempts #1–#3 produced no historical performance output. Attempt #4 is the
single successful CONTROL capture and generated the first complete
`m3-b-report-004` performance result. The temporary environment setting was
used only for that process; no proxy credential or persistent environment
change was recorded.

## Frozen execution boundary

The successful CONTROL used `baseline-001`, `bt-policy-003`, `COMBINED`, and
`m3-b-report-004` from execution source
`7b3fa166d01fde79dc95ced182c3c515f904a847`. Its study server time was obtained
by the existing Binance public client from `/fapi/v1/time`.

All 13 candidates were derived offline from the single raw CONTROL report.
There were no candidate backtest reruns, Strategy Engine reruns, settlement
reruns, combinations, optimizer, threshold changes, or M3-I gate application.
The evidence decision remains
`DEFER_TO_M3_I_FROZEN_GATE_APPLICATION`; `baseline-002` is not frozen.

## M3-H execution-only HTTP profile

The capture script uses the existing `BinanceHistoricalDataLoader` and official
`https://fapi.binance.com` public endpoints. Only the M3-H capture client
profile uses `timeoutMs = 15000` and `maxAttempts = 3`. Global market-data
defaults remain `BINANCE_HTTP_TIMEOUT_MS = 5000` and
`BINANCE_MAX_ATTEMPTS = 3`. The existing `BinancePublicClient` remains the sole
owner of retries. No fallback clock, cached time, alternate host, provider, or
nested retry was introduced.
