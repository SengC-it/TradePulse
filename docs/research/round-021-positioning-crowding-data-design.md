# Round-021 — Positioning Crowding Data-Acquisition Design

## Scope and frozen source

This artifact is `DATA_ACQUISITION_DESIGN_ONLY`. It freezes the proof
contract for a possible future acquisition preflight. It does not download,
parse, or inspect market-event payloads and it does not authorize preflight,
performance, backtest, or selection.

The only accepted research source is:

- branch: `research/round-015-beta-alpha-decomposition`
- commit: `7710eae9b69218bb157c5448209bcf2595199252`
- accepted hypothesis artifact:
  `docs/research/round-021-positioning-crowding-design.json`

The hypothesis is unchanged:

- mechanism family: `POSITIONING_CROWDING_STATE`
- hypothesis: `R21-TOP-TRADER-POSITION-CONCENTRATION-UNWIND`
- thesis: `CONTRARIAN CROWD-UNWIND`
- inputs: `topTraderAccountLongShortRatio`,
  `topTraderPositionLongShortRatio`, `globalAccountLongShortRatio`
- `P > 0 && P > A && A > G` identifies a long crowd and advises `SHORT`
- `P < 0 && P < A && A < G` identifies a short crowd and advises `LONG`
- otherwise: `NO_SIGNAL`

No OI, funding, taker flow, price, momentum, volatility, liquidation, score,
regime, threshold, or other feature is introduced.

## Source and Tier-1 proof contract

The sole admissible source family is
`BINANCE_VISION_USDM_METRICS_ARCHIVE`. Tardis, Coinglass, CryptoQuant,
Bybit, OKX, third-party mirrors, and self-built historical inference are not
admissible.

The candidate archive field names are frozen as metadata only; they are not an
assertion that Binance Vision archive columns have been mapped:

| R21 primitive | Candidate archive field |
| --- | --- |
| `topTraderAccountLongShortRatio` | `count_toptrader_long_short_ratio` |
| `topTraderPositionLongShortRatio` | `sum_toptrader_long_short_ratio` |
| `globalAccountLongShortRatio` | `count_long_short_ratio` |

The exact archive-field mapping remains **UNPROVEN_FAIL_CLOSED**. A field name is
not a semantic proof. The R21 artifact now separates the following facts:

- `liveSeriesSemanticMappingProven=true`;
- `archiveFieldMappingProven=false`;
- `sourceFieldMappingStatus=ARCHIVE_FIELD_MAPPING_UNPROVEN_FAIL_CLOSED`.

The current official Binance USDⓈ-M market-data documentation is Tier-1 evidence
for the live endpoint and series semantics:

- <https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data>;
- endpoints: `/futures/data/globalLongShortAccountRatio`,
  `/futures/data/topLongShortAccountRatio`, and
  `/futures/data/topLongShortPositionRatio`;
- market: USD-M / USDS-M Futures; example symbol: `BTCUSDT`;
- supported periods: `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `12h`, `1d`;
- timestamp: end time of the period;
- the current REST historical query is limited to the latest 30 days.

The official `binance/binance-futures-connector-python` commit
`d30576a6d8e6edb706c8b013eb11167b58e9c33a` dated `2022-08-29`, file
`binance/um_futures/market.py`, is Tier-1 evidence that the three USD-M
endpoints existed before the target start. It does not prove archive column
mapping, archive/live-series equivalence, historical publication latency, or
archive native cadence. GitHub issues, third-party README files, and field names
remain insufficient for those proofs.

The market contract is USD-M / USDS-M Futures. Coin-M documentation is only an
analogous reference and cannot satisfy the USD-M proof. The current live-series
documentation status is `ENDPOINT_AND_SERIES_SEMANTICS_PROVEN`; the archive
field mapping status remains `UNPROVEN_FAIL_CLOSED`.

## Point-in-time and archive release rules

The target universe is exactly `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, and
`BNBUSDT`, with UTC bounds:

`2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`.

For a future decision time `T`, an observation is usable only when its source
observation time and its publication-available time are both at or before `T`.
The latest complete PIT-valid observation at or before `T` must contain all
three finite, strictly positive primitives for the same symbol, timestamp, and
native cadence. Otherwise the result is `NO_OBSERVATION`.

Forward-fill, backfill, interpolation, nearest-timestamp matching,
cross-file substitution, and carry-forward are forbidden.

The archive-release rules are frozen as metadata:

- daily archive release: next day;
- monthly archive release: first Monday of the month;
- archive release is not proof of contemporaneous metric availability.

Current object existence, current `Last-Modified`, or a current download time
cannot prove historical PIT availability. The PIT status is
`UNPROVEN_FAIL_CLOSED`.

The following evidence is recorded separately:

- historical endpoint existence: proven (`2022-08-29`, before `2023-01-01`);
- period-end timestamp semantics: proven by the live documentation;
- daily archive release semantics: proven as next-day metadata;
- archive/live-series equivalence: not proven;
- a historical publication-latency upper bound: not proven;
- a decision-time availability rule sufficient for
  `publicationAvailableTime <= decisionTime`: not proven.

Archive release metadata cannot prove contemporaneous decision-time availability;
historical endpoint existence, archive/live equivalence, and a defensible
availability-lag contract are separate proof obligations.

## Cadence and horizon

The live endpoint period options are proven, including a minimum supported period
of `5m`. The native cadence of the Binance Vision USD-M metrics archive is not
authoritatively proven in the accepted source.
Therefore the decision cadence and holding horizon are deliberately not frozen
in this stage. The conditional rule is frozen before any forward or economic
value read:

- if authoritative native cadence is at most 60 minutes, freeze decision
  cadence to `1h` and primary holding horizon to `4h`;
- otherwise the design is ineligible;
- no horizon sweep or result-dependent horizon choice is allowed.

Current values are `liveEndpointMinimumSupportedPeriod=5m`,
`archiveNativeCadenceMinutes=null`,
`decisionCadence=null`, `primaryHoldingHorizon=null`, and status
`UNPROVEN_FAIL_CLOSED`.

## Future metadata-only object matrix

Only a future `DATA_ACQUISITION_PREFLIGHT` may inspect official listing or HEAD
metadata. This stage permits neither. The future matrix may contain only:

`symbol`, `utcDate`, `expectedObjectKey`, `objectExists`,
`checksumObjectExists`, `contentLength`, `etag`, and `lastModified`.

ZIP bodies and Range GETs are forbidden in this stage. The expected object key
must be derived deterministically from the official Binance Vision USD-M
metrics object convention; it must not be substituted from another source.

Future acquisition identity must bind source family, symbol, UTC date, object
key, official checksum SHA-256, downloaded SHA-256, content length, ETag,
observed last-modified time, retrieval time, and a manifest SHA-256. Object and
checksum identity must agree.

If a checksum changes, the status is `ARCHIVE_REVISION_DETECTED`; the old and
new identities, checksums, first observed revision time, and official changelog
reference must be retained. Silent overwrite is forbidden.

## Duplicate and coverage contract

The frozen row classifications are:

`PRESENT_UNIQUE`, `MISSING`, `EXACT_DUPLICATE`,
`CONFLICTING_DUPLICATE`, and `INVALID_ROW`.

An exact duplicate has the same symbol, timestamp, and all three R21 primitive
values. A conflicting duplicate is `AMBIGUOUS_SOURCE_VALUE` and fails closed.

Future preflight must satisfy all of the following for every target symbol:

- overall valid decision coverage at least 98%;
- every calendar month at least 90%;
- no contiguous missing window longer than 24 hours;
- `conflictingDuplicateCount = 0`.

One symbol failing any threshold fails the entire round. The known continuity
risk `BINANCE_USDM_METRICS_ARCHIVE_KNOWN_CONTINUITY_RISK` for possible BTC/ETH
missing or duplicate periods in 2023–2025 is retained as
`NON_AUTHORITATIVE_ISSUE_REPORT` risk evidence only. It cannot prove coverage,
authorize an exemption, or authorize payload acquisition.

The REST positioning endpoints are schema/PIT documentation references only;
they are not an archive substitute and may not become a recent-30-day proxy or
historical backfill.

## Frozen design gates

| Gate | Status | Meaning |
| --- | --- | --- |
| A01 accepted source | PASS | Exact accepted source is `7710eae9…` |
| A02 single source family | PASS | Only official Binance Vision USD-M metrics archive |
| A03 official field mapping | FAIL | USD-M live-series semantics are proven, but exact Binance Vision archive-field-to-live-series mapping lacks Tier-1 proof |
| A04 contemporaneous PIT availability | FAIL | Endpoint existence and period-end semantics are proven, but archive/live equivalence and a historical publication-latency bound sufficient for decision-time availability are unproven |
| A05 native cadence and horizon | FAIL | Live endpoint periods are proven, but archive native cadence is unproven, so 1h/4h cannot be frozen |
| A06 coverage and continuity contract | PASS | Identity, duplicate, missingness, and thresholds are frozen |
| A07 reproducibility contract | PASS | Object/checksum/revision/manifest rules are frozen |
| A08 zero economic read | PASS | No forward or economic value is read or calculated |
| A09 governance | PASS | No acquisition or later-stage execution is authorized |

Because A03, A04, and A05 fail, the final decision is fail-closed:

`ROUND-021 DATA ACQUISITION DESIGN INELIGIBLE`

`nextStage=STOP`, `dataAcquisitionAuthorized=false`,
`performanceAuthorized=false`, and `selectionAuthorized=false`.

## Future preflight targets

Only if all design gates later pass may the following metadata/payload checks be
considered: official object matrix, checksum identity, USD-M field mapping,
PIT publication availability, native cadence, row shape and duplicates,
coverage/continuity, and manifest reproducibility. No runner, downloader,
performance ledger, or selection artifact is created by this design.

## Governance

The design records:

```text
newMarketDataFetched=false
marketDataPayloadDownloaded=false
preflightExecuted=false
performanceExecuted=false
selectionExecuted=false
economicValuesRead=false
forwardReturnsRead=false
performanceExecutionCount=0
performanceLedgerPresent=false
Production unchanged
baseline-002=NOT_FROZEN
M3-J=BLOCKED
M4=NOT_STARTED
automaticTrading=false
```

No production, scheduler, shadow, or automatic-trading operation is changed.
