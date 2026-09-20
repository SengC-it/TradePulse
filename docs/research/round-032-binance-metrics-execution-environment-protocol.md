# Round-032 Binance Metrics Execution-Environment Reprobe

Round-032 is an execution-environment and archive-parser reprobe only. It does not fit models, read settlement outcomes, calculate PnL, run forward validation, or change Production.

The exact base is `research/round-015-beta-alpha-decomposition` at `96f14392b02ea492a1b2c6f20b47334a3bf3234a`. The R31 result remains unchanged and its conclusion remains `SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY` with `r31ReprobeExecutionCount=1`.

## Frozen archive contract

The fixed overlap is 2026-09-18 UTC for BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, and BNBUSDT. The parser accepts only epoch milliseconds, epoch seconds, UTC datetime strings (`YYYY-MM-DD HH:mm:ss[.SSS]` interpreted explicitly as UTC), and ISO timestamps with `Z` or `+00:00`. Every archive records format counts.

Checksum validity is independent of header schema, timestamp parsing, and duplicate validation:

`checksumValid = publishedChecksum != null && publishedChecksum === localSha256`

Archive readiness requires transport, checksum, exact schema, timestamp parsing, and zero conflicting duplicates for all five symbols.

## Frozen transport contract

Before formal mapping, the runner probes `https://fapi.binance.com/fapi/v1/time` with Node fetch and a 10-second timeout. It records recursive nested-cause diagnostics. CURL is attempted only after Node failure, with `--connect-timeout 10 --max-time 15 --retry 0`. Proxy variables are recorded as presence and scheme only; credentials and complete proxy URLs never enter an artifact.

Node success selects `NODE_FETCH`; otherwise CURL success selects `CURL`; if both fail, formal mapping is not executed. If selected, all 25 symbol/endpoint requests use that same transport, exactly once each, with the R31 mapping, timestamp, and numeric thresholds unchanged.

## Evidence and governance

`round-032-execution-receipt.json` is created as `STARTED` before any network request and completed exactly once with the result hash. An existing receipt or result fails closed. Current mapping evidence never certifies historical coverage: `historicalRegimeMappingEstablished=false` and `fullHistoricalCoverageCertified=false`.

`economicOutcomeFilesRead=false`, `economicEvaluationPerformed=false`, `modelFitCount=0`, `candidateCount=0`, `championCount=0`, `selectedAlertCount=0`, `forwardEconomicValuesRead=false`, `forwardReturnRead=false`, `performanceExecutionCount=0`, `automaticTrading=false`, and `humanDecisionRequired=true` remain frozen.
