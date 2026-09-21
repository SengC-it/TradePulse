# Round-033 Live Transport + Timestamp Semantic Alignment

Status: `SOURCE_SEMANTIC_ALIGNMENT_REPROBE_ONLY`

Round-033 is a source-semantic reprobe. It does not rerun Round-032, read economic outcomes, fit models, rank candidates, settle trades, execute Performance, or authorize forward validation.

## Frozen identity

- Base branch: `research/round-015-beta-alpha-decomposition`
- Base SHA: `dac13c5a0863f60e0bcfc932ef5db7dab7eff282`
- Branch: `research/round-033-live-transport-timestamp-alignment`
- Window: `2026-09-18 00:00:00.000Z` through `2026-09-18 23:59:59.999Z`
- Symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- Endpoints: `openInterestHist`, `topLongShortAccountRatio`, `topLongShortPositionRatio`, `globalLongShortAccountRatio`, `takerlongshortRatio`
- Request parameters: `period=5m`, `limit=500`

The R32 archive identities are frozen and must match the exact five SHA-256 values in the companion JSON. Any mismatch is `ARCHIVE_VERSION_DRIFT_DETECTED` with next stage `ARCHIVE_REVISION_AUDIT_REQUIRED`; semantic comparison stops.

## Transport and evidence

All 25 live logical requests and the 5 archive ZIP plus 5 checksum requests use `curl` only. Each request has at most two attempts. The exact curl contract is `--silent --show-error --fail-with-body --connect-timeout 10 --max-time 20 --retry 0`. Only exit codes `6, 7, 28, 35, 52, 55, 56` receive one retry after two seconds. HTTP non-2xx, non-JSON, non-array, schema, and conflicting-duplicate failures are not retried. There is no third attempt.

Each request records both attempt slots, curl exit, HTTP status, response bytes, SHA-256, and error classification. Successful archive ZIPs are persisted under `docs/research/round-033-evidence/archive/`; successful live response bodies only are persisted under `docs/research/round-033-evidence/live/`. The manifest records path, source URL, received time, bytes, SHA-256, attempt number, and HTTP status. The receipt is written as `STARTED` before any network request and becomes `COMPLETED` only once, with `r33ExecutionCount=1`. A second invocation fails closed.

## Timestamp alignment

The common interior is the exact archive interval `00:05:00` through `23:50:00` UTC, 286 rows. Every field, symbol, and offset uses the same 286-row denominator. Only these offsets are allowed:

- `EXACT = 0`
- `ARCHIVE_MINUS_5M = -300000`
- `ARCHIVE_PLUS_5M = +300000`

For each of the 75 field/symbol/offset evaluations, the protocol records matched rows, timestamp coverage, numeric-agreement rows and rate, mean/median/maximum absolute error, and mean/maximum relative error. Numeric tolerance is `0.5 * 10^(-liveDecimalPlaces) + 1e-12`; pass requires timestamp coverage at least `0.99` and full-support numeric agreement at least `0.995`.

Per symbol, exactly one passing offset is `UNIQUE_SEMANTIC_OFFSET`; zero is `NO_SEMANTIC_OFFSET_MATCH`; two or more is `TIMESTAMP_SEMANTICS_AMBIGUOUS`. There is no count-first, MAE tie-break, or exact-offset preference. Field admission requires all five symbols to have a unique, identical selected offset. A request failure yields `FIELD_REACHABILITY_INCOMPLETE` and does not invalidate other fields.

Overall classifications are deterministic: five admitted fields establish current-regime mapping; one to four are partial; zero with incomplete reachability is `SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY`; zero with ambiguity is `BINANCE_METRICS_TIMESTAMP_SEMANTICS_AMBIGUOUS`; otherwise the current mapping is incompatible. Historical mapping and full historical coverage always remain false.

PIT availability is `archiveCreateTime + 5 minutes`, and `pitPolicyFinalizationPendingHistoricalRegimeAudit=true`.

## Scope exclusions and governance

`M3-G1` is explicitly excluded from Round-033. Economic outcome files, forward returns, candidate metrics, model fits, settlement, Performance, and Production are out of scope. `candidateExecutableFrozen=false`, `forwardCandidateExists=false`, `forwardValidationAuthorized=false`, `performanceExecutionCount=0`, `automaticTrading=false`, `humanDecisionRequired=true`, `Production unchanged`, `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, and `M4=NOT_STARTED` remain frozen.
