# Round-023 Historical Source Acquisition Amendment

Status: `PRE_OUTCOME_SOURCE_ACQUISITION_AUTHORIZED`

This amendment is a data-source-only change to the frozen A0 Round-023
development protocol. It exists because the required existing R15 cache was
not available. It does not change candidate configurations, model families,
feature subsets, lambda, thresholds, symbols, directions, folds,
purge/embargo, costs, latency, settlement, gates, or selection.

Parent protocol SHA-256:
`27a157934982dfef8966550d1326465448f3f7adc03b662dbf4879ff3e11d08a`

Parent commit:
`3646432a3edb204852cf1f09fa08b69d021dffd8`

Reason: `REQUIRED_EXISTING_R15_CACHE_NOT_AVAILABLE`

Amendment scope: `DATA_SOURCE_ONLY`

The prior policy `EXISTING_HISTORICAL_CACHE_ONLY_NO_NETWORK` is superseded
only for this pre-outcome source remediation by
`PUBLIC_HISTORICAL_SOURCE_ACQUISITION_ALLOWED`.

## Frozen data boundary

Only event times from
`2023-01-01T00:00:00.000Z` through
`2026-08-15T23:59:59.999Z`, inclusive, may enter the historical development
dataset. Any row after the boundary must be rejected or trimmed before an
artifact is constructed and counted in the acquisition audit. Current prices,
post-freeze funding, post-freeze candles, and forward data are excluded.

## Permitted source

The permitted provider is the public Binance Vision archive. Public historical
data may be acquired only for the existing five-symbol universe:

`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`.

The acquisition is limited to the minimum data required by the already frozen
R13 feature and `bt-policy-003` settlement contracts: 1h OHLCV/quote volume,
1m execution-resolution candles, taker buy/sell information only when a
frozen feature requires it, the BTC reference series required by frozen
relative features, USD-M funding events, and mark-price information required
for funding settlement. Existing repository Binance acquisition and
normalization code is preferred.

No private Binance API, account data, or new data semantics are permitted.

## Freeze-before-fetch gate

The amendment must first be committed with message
`Authorize Round-023 historical source acquisition`, with parent
`3646432a3edb204852cf1f09fa08b69d021dffd8`, pushed, and verified at the
remote branch. Until that remote freeze is verified:

- no network request is allowed;
- no market-data payload may be read;
- no economic value may be read;
- no dataset may be constructed.

## Dataset freeze before economics

After acquisition, an immutable manifest must record the dataset identity,
public source types/endpoints, symbols, data types, frozen start/end, every
row count, earliest/latest included timestamps, raw and normalized hashes,
normalization and acquisition code identities, and acquisition time. The
dataset must pass completeness, primary-identity uniqueness, chronological,
funding chronology, and point-in-time checks. A missing required input fails
closed; interpolation, nearest matching, and future-value substitution are
forbidden.

The dataset and its deterministic loader/integrity tests must be committed and
pushed as a separate `Freeze Round-023 historical development dataset`
commit. That remote dataset freeze must be verified before any economic
development evaluation.

## Governance

This amendment does not authorize performance, forward evaluation, selection,
or Production changes. Until a later separately permitted evaluation:

- `newHistoricalDevelopmentDataFetched=false`
- `newPostFreezeForwardDataFetched=false`
- `forwardEconomicValuesRead=false`
- `forwardReturnRead=false`
- `forwardPerformanceExecutionCount=0`
- `developmentEconomicEvaluationExecutionCount=0`
- `performanceExecutionCount=0`
- `performanceLedgerPresent=false`
- `automaticTrading=false`
- `humanDecisionRequired=true`
- Production and main unchanged
- `emailRestorationAuthorized=false`
- `baseline-002=NOT_FROZEN`
- `M3-J=BLOCKED`
- `M4=NOT_STARTED`

No candidate result, ranking, model, expectancy, PF, drawdown, win rate, or
other economic result is part of this amendment.
