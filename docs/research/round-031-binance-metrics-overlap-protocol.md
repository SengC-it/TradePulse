# Round-031 Binance Metrics Live Overlap Reprobe

This artifact freezes a source-admission reprobe only. It does not fit models,
read economic outcomes, select candidates, validate forward returns, or start
prospective capture.

The fixed overlap is UTC `2026-09-18`, across exactly BTCUSDT, ETHUSDT,
SOLUSDT, XRPUSDT, and BNBUSDT. Five Binance Vision USD-M metrics archives and
five checksum files are requested, together with exactly 25 public live probes
(five symbols by five endpoints). Each logical request is attempted once and
every success or failure is retained as request-level evidence.

Archive fields and live mappings are frozen in the companion JSON. Live rows
are filtered client-side to the inclusive UTC window before duplicate handling
and comparison. Exact duplicate timestamps are deduplicated; conflicting
duplicates fail the symbol/endpoint. Timestamp mappings are evaluated
independently per endpoint and symbol using only `EXACT`, `ARCHIVE_MINUS_5M`,
and `ARCHIVE_PLUS_5M`. A unique mapping must cover at least 99% of archive
rows. Numeric agreement uses the live raw numeric precision:
`0.5 * 10^(-liveDecimalPlaces) + 1e-12`; relative error is recorded but has no
fixed `1e-8` gate.

Any live reachability, HTTP, JSON, array, or schema failure takes precedence
over mapping classification and yields
`SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY`. With 25 successful
live requests, field admission is independent: five admitted fields establish
the current-regime mapping, one to four establish a partial mapping, and zero
is incompatible. None of these outcomes certifies historical regime coverage;
`historicalRegimeMappingEstablished=false` and
`fullHistoricalCoverageCertified=false` remain frozen.

The runner creates a durable STARTED receipt before the first request and
updates that same receipt to COMPLETED with the result hash. An existing
receipt or result fails closed. The library and CLI are import-safe; network
and file activity occur only when the direct CLI entry point runs.

Governance remains closed: economics, forward validation, performance,
Production changes, email restoration, and automatic trading are all out of
scope.
