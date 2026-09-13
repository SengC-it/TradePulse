# Round-020 liquidation data acquisition design

Status: `DATA_ACQUISITION_DESIGN_ONLY`

Accepted research source: `65a1a133c356264c58a38584e38d214d33577ba4`

Base branch: `research/round-015-beta-alpha-decomposition`

This document freezes a metadata-level feasibility design for the
`FORCED_DELEVERAGING_LIQUIDATION_STATE` information family. It does not create
a candidate, fetch market data, create observations, run a preflight, execute
performance, or run selection.

## Research boundary

- Venue: Binance USD-M futures.
- Symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`.
- Historical target: `2023-01-01T00:00:00.000Z` through
  `2026-08-15T23:59:59.999Z`.
- Product boundary: signal advisory only; no private Binance API and no
  automatic trading.
- This stage is metadata-only. `networkAcquired=false` and `acquisitionBytes=0`.

The question is falsifiable: a source is admissible only if its historical
coverage, event identity, completeness status, point-in-time timestamp
semantics, and five-symbol target coverage can be proven before acquisition.
No trading result, forward return, P/L, or other economic value is read or
calculated here.

## Minimum event contract

The future acquisition must preserve source, venue, market type, symbol,
`eventTime`, `publicationTime` when distinct, `liquidationSide`,
`executionSide`, price, quantity, notional, source event sequence or unique
identity, contract type, and raw provenance.

`liquidationSide` is the position side forced out. `executionSide` is the
aggressor/order side. They are separate fields: the implementation must not
infer liquidation side from execution side unless the source contract
explicitly defines that mapping.

The point-in-time rule is:

```text
eventTime <= decisionTime
AND (publicationTime IS NULL OR publicationTime <= decisionTime)
```

Unknown publication delay, undocumented replay behavior, or unverifiable
historical ordering is `REJECTED_POINT_IN_TIME_PROVENANCE`. A sampled or
aggregated source must retain its source status and must not be relabeled as a
complete total event stream.

The preferred identity is an exchange/source-provided immutable ID. The exact
fallback identity is:

```text
venue|symbol|eventTime|liquidationSide|price|quantity|sourceSequence
```

Only exact identity matching is allowed. No fuzzy match, nearest timestamp,
price reverse-match, or inferred sequence is allowed. Same-timestamp records,
partial updates, retransmissions, and aggregate records remain governed by
the source identity contract.

## Official and vendor source review

The review used documentation only. It did not request market events or
download any archive.

| Source | Metadata conclusion | Frozen classification |
| --- | --- | --- |
| [Binance liquidation-order stream](https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Liquidation-Order-Streams) | Live stream with snapshot/sampling semantics; not a historical replay archive. | `LIVE_ONLY_NOT_HISTORICAL` |
| [Binance force-order REST documentation](https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/rest-api/Users-Force-Orders) | Official endpoint identity is not a proven immutable public archive for the 2023–2026 target. | `INSUFFICIENT_PROVENANCE` |
| [Binance public-data repository](https://github.com/binance/binance-public-data) and [Vision catalog](https://data.binance.vision/) | Existing documented archive families do not establish a liquidation-event file identity for this design. | `INSUFFICIENT_PROVENANCE` |
| [OKX liquidation channel](https://www.okx.com/docs-v5/en/#websocket-api-public-channel-liquidation-orders) and [change log](https://www.okx.com/docs-v5/log_en/) | Historical liquidation REST retrieval was discontinued; the remaining stream is live and is a different venue. | `LIVE_ONLY_NOT_HISTORICAL` |
| [Bybit all-liquidation stream](https://bybit-exchange.github.io/docs/v5/websocket/public/all-liquidation) | Live snapshot stream, not a historical Binance USD-M archive. | `LIVE_ONLY_NOT_HISTORICAL` |
| [Deribit public trade history](https://docs.deribit.com/api-reference/market-data/public-get_last_trades_by_instrument_and_time) | Historical trade flags are a different venue/instrument universe and do not prove target coverage or liquidation completeness. | `INSUFFICIENT_SYMBOL_BREADTH` |
| [Coinbase public trade documentation](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-trades) | Reviewed public market-trade contract does not provide the target liquidation-event identity. | `INSUFFICIENT_SYMBOL_BREADTH` |
| [Tardis data FAQ](https://docs.tardis.dev/faq/data), [CSV data types](https://docs.tardis.dev/downloadable-csv-files/data-types), [downloadable files](https://docs.tardis.dev/downloadable-csv-files) | Vendor documents downloadable Binance USDT Futures liquidation data and exchange/local timestamps. Binance force-order snapshot limits mean this is an observed/sampled stream, not a total event census; exact target coverage and provenance still require probes. | `QUALIFIED_PARTIAL_TARGET_COVERAGE` |
| [Amberdata futures liquidations](https://docs.amberdata.io/http/market/futures-liquidations) and [information endpoint](https://docs.amberdata.io/http/market/futures-liquidations-information) | Event-level fields are promising, but exact Binance USD-M range, identity, publication semantics, completeness, revisions, and license must be probed. | `UNKNOWN_REQUIRES_METADATA_PROBE` |
| [Kaiko token-level liquidation volumes](https://docs.kaiko.com/rest-api/analytics-solutions/kaiko-derivatives-risk-indicators/token-level-liquidation-volumes) | Interval/token-level aggregation is not an event identity and its documented historical start does not cover the frozen 2023 boundary. | `QUALIFIED_PARTIAL_TARGET_COVERAGE` |
| [CoinDesk historical liquidation messages](https://developers.coindesk.com/documentation/data-api/futures_v2_historical_liquidation_messages) | Event/received timestamps and source sequence are promising, but target range, symbols, statuses, completeness, revisions, and license require probes. | `UNKNOWN_REQUIRES_METADATA_PROBE` |

Official exchange streams remain useful for schema cross-checks, but none is
accepted as the frozen historical source. Vendor sources are not treated as
authoritative until their exact raw/derived status, revisions, licensing, and
target coverage are recorded.

## Deterministic source ranking

The ranking is acquisition-quality ranking only. It contains no trading
returns, P/L, forward labels, or performance fields.

Ten dimensions are scored as integers from 0 through 5:

`officialProvenance`, `pointInTimeIntegrity`, `historicalCoverage`,
`symbolBreadth`, `completenessTransparency`,
`immutableArchiveAvailability`, `reproducibility`, `schemaQuality`,
`licensingStability`, and `acquisitionFeasibility`.

All weights are one. The generated score is:

```text
round(sum(dimensionScores[i] * dimensionWeights[i]) / 10, 3)
```

Ties use lexical `sourceId` ascending after descending score. The machine
readable JSON is generated from the pure functions in
`src/lib/research/m3-r20-liquidation-data-design-protocol.ts`; the displayed
scores are not manually entered recommendation scores.

| Rank | Source | Score | Classification | Recommendation eligible |
| ---: | --- | ---: | --- | --- |
| 1 | `TARDIS_BINANCE_USDT_FUTURES_LIQUIDATIONS` | 4.200 | `QUALIFIED_PARTIAL_TARGET_COVERAGE` | yes, conditional |
| 2 | `AMBERDATA_FUTURES_LIQUIDATIONS` | 3.600 | `UNKNOWN_REQUIRES_METADATA_PROBE` | no until probes |
| 3 | `DERIBIT_PUBLIC_LIQUIDATION_FLAG_TRADES` | 3.600 | `INSUFFICIENT_SYMBOL_BREADTH` | no |
| 4 | `KAIKO_TOKEN_LIQUIDATION_VOLUMES` | 3.600 | `QUALIFIED_PARTIAL_TARGET_COVERAGE` | no; aggregate/non-target boundary |
| 5 | `BINANCE_VISION_PUBLIC_ARCHIVE` | 3.500 | `INSUFFICIENT_PROVENANCE` | no |
| 6 | `COINDESK_FUTURES_LIQUIDATION_MESSAGES` | 3.500 | `UNKNOWN_REQUIRES_METADATA_PROBE` | no until probes |
| 7 | `BINANCE_USDM_FORCE_ORDER_WEBSOCKET` | 3.200 | `LIVE_ONLY_NOT_HISTORICAL` | no |
| 8 | `OKX_PUBLIC_LIQUIDATION_STREAM` | 3.200 | `LIVE_ONLY_NOT_HISTORICAL` | no |
| 9 | `BYBIT_ALL_LIQUIDATION_STREAM` | 3.100 | `LIVE_ONLY_NOT_HISTORICAL` | no |
| 10 | `BINANCE_USDM_FORCE_ORDERS_REST` | 2.900 | `INSUFFICIENT_PROVENANCE` | no |
| 11 | `COINBASE_DERIVATIVES_PUBLIC_MARKET_DATA` | 2.200 | `INSUFFICIENT_SYMBOL_BREADTH` | no |

## Decision

`ROUND-020 LIQUIDATION DATA SOURCE CONDITIONALLY QUALIFIED`

The single recommended source is
`TARDIS_BINANCE_USDT_FUTURES_LIQUIDATIONS`. This is a conditional metadata
recommendation, not permission to acquire data. Before any future acquisition,
the following must pass for all five symbols and every target day:

1. exact file/day coverage and immutable file hashes;
2. raw versus normalized fields and exchange/local timestamp coverage;
3. snapshot sampling, missing-window, reconnect, and gap semantics;
4. exact event identity, duplicate, partial-update, and side mapping rules;
5. publication-time and point-in-time replay semantics;
6. revision/correction/deletion policy;
7. license and reproducibility entitlement.

If any required probe fails, the next result is
`ROUND-020 DATA ACQUISITION INELIGIBLE`; no complete-subset rescue,
time-boundary change, synthetic backfill, or fuzzy join is permitted. If all
probes pass, the next explicitly authorized stage is
`DATA_ACQUISITION_PREFLIGHT` and it must first write an immutable manifest.

## Future manifest and governance

The future manifest must contain acquisition ID, source URL, acquisition time,
target range/symbols/venue/market, files, bytes, per-file SHA-256, aggregate
hash, event counts, first/last event time, duplicates, malformed records, gap
assessment, coverage classification, and documentation snapshot. At this
stage `networkAcquired=false`, `bytes=0`, and no manifest or raw events exist.

Current frozen governance:

- `performanceExecutionCount=0`;
- performance ledger absent;
- preflight and performance unauthorized;
- candidate not created;
- performance, backtest, and selection not executed;
- economic values unread, uncalculated, and uninspected;
- no new market data fetched;
- Production unchanged;
- `baseline-002=NOT_FROZEN`;
- `M3-J=BLOCKED`;
- `M4=NOT_STARTED`;
- `automaticTrading=false`.

The required future evidence paths are schema references only. This commit
does not create preflight, result, summary, audit, selection, performance
ledger, candidate, observation, or raw-download artifacts.
