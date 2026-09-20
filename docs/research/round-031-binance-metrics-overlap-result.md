# Round-031 Binance Metrics Live Overlap Reprobe Result

## Execution identity

- Protocol commit: `90b89c9fb02942be1606520f3aa41ac94df057b9`
- Run ID: `r31-5aa3b17989071a44187bdaf0`
- Fixed UTC date: `2026-09-18`
- Window: `1789689600000..1789775999999`
- Symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- Durable receipt: `COMPLETED`
- `r31ReprobeExecutionCount=1`

## Request result

The formal invocation attempted exactly 25 live logical requests, once each.
All 25 failed with the recorded error class `NETWORK` and message `fetch
failed`; no retry was performed. The JSON artifact contains the complete
request-level evidence, including URL, timing, HTTP fields, payload fields,
error fields, and bounded previews.

Because live reachability failed before mapping could be evaluated, the
authoritative classification is:

```text
SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY
LIVE_ENDPOINT_EXECUTION_ENVIRONMENT_REPROBE_REQUIRED
```

This is not a mapping-incompatible or paid-source conclusion.

## Archive result

All five fixed-date ZIP requests returned HTTP 200 and all five checksum
requests returned HTTP 200. The recorded published SHA-256 values match the
recorded local ZIP SHA-256 values for all five symbols. The parser observed a
non-integer `create_time` representation in each archive, so the frozen exact
schema validation did not admit the archive rows; no mapping conclusion was
derived from those rows.

```text
archiveFilesAvailable=5
checksumValidFiles=5
schemaValidFiles=0
archiveSampleQualityAccepted=false
```

## Field mapping

No field was admitted because live reachability failed and archive rows were
not admitted by the exact parser:

```text
OPEN_INTEREST       REJECTED
TOP_TRADER_ACCOUNT  REJECTED
TOP_TRADER_POSITION REJECTED
GLOBAL_LONG_SHORT   REJECTED
TAKER_RATIO         REJECTED
admittedFieldCount=0
```

The three allowed timestamp mappings, precision-aware tolerance, duplicate
semantics, and endpoint-independent admission rules remain frozen in Commit A.
They were not relaxed or changed after the observed failure.

## Boundary and governance

```text
currentRegimeMappingEstablished=false
historicalRegimeMappingEstablished=false
fullHistoricalCoverageCertified=false
economicEvaluationPerformed=false
tradingEconomicMetricsCalculated=false
modelFitCount=0
candidateCount=0
championCount=0
selectedAlertCount=0
forwardEconomicValuesRead=false
forwardReturnRead=false
performanceExecutionCount=0
automaticTrading=false
humanDecisionRequired=true
Production unchanged
emailRestorationAuthorized=false
baseline-002=NOT_FROZEN
M3-J=BLOCKED
M4=NOT_STARTED
```

R30 remains unchanged: LONG and SHORT have no selected target and remain
`TARGET_REDESIGN_INSUFFICIENT`; `targetRedesignConclusionRobust=true`.
Round-031 did not fit, predict, rank, settle, evaluate economics, read
forward data, or start prospective capture.
