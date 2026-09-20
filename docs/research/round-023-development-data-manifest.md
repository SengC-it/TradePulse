# Round-023 historical development dataset freeze

This manifest records the dataset identity permitted by the R23 source-acquisition amendment. The exact accepted R14 observation freeze is reused because it already contains the frozen R13 feature vectors and bt-policy-003 H4 settlement and seven-minute latency-stress labels. No new market-data request or download was made.

## Frozen identity

- dataset: `r23-r14-r13-h4-5b0e62f93526052d`
- source status: `ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED`
- policy: `PUBLIC_HISTORICAL_SOURCE_ACQUISITION_ALLOWED`
- observation rows: `244810`
- symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- directions: `LONG`, `SHORT`
- decision window: `2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`
- raw and normalized observation SHA-256: `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`
- raw and normalized bytes: `1893811055`
- manifest SHA-256: `365c6d0aadb009f9671e02fa486acc8229255ab56ab7987500dcfbed25ea830a`

The metadata-only identity scan verified five complete symbols, balanced bilateral direction coverage, deterministic observation identity/order, zero duplicate identities, zero pre-window rows, and zero post-boundary rows. It inspected only identity, timing, symbol/direction, and label status metadata; economic label values were not read.

The accepted source lineage is bound to `docs/research/round-014-observation-freeze.json`, its exact file and internal manifest hashes, the accepted R14 freeze commit, and the accepted R13 dataset-freeze identities. The normalized R23 path is a local hardlink to the accepted source and is not a substitute dataset.

## Integrity and governance

- `integrity=COMPLETE`
- `noFutureInformationLeakage=true`
- `decisionTimeBounded=true`
- `fundingChronologyValidatedByAcceptedR14Freeze=true`
- `settlementUsesAcceptedBtPolicy003=true`
- `networkAcquired=false`
- `newHistoricalDevelopmentDataFetched=false`
- `performanceExecutionCount=0`
- `performanceLedgerPresent=false`
- `automaticTrading=false`
- `humanDecisionRequired=true`
- `Production unchanged`
- `baseline-002=NOT_FROZEN`
- `M3-J=BLOCKED`
- `M4=NOT_STARTED`

Economic development evaluation is authorized only after this freeze commit is present and remotely verified. This manifest does not contain candidate outcomes, ranking, selection, or a forward model artifact.
