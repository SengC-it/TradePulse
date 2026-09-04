# TradePulse Round-020 — Research-Space Reset

Status: `RESEARCH_SPACE_RESET_ONLY`

Accepted research source: `research/round-015-beta-alpha-decomposition` at
`c3409d38cf6f102d4213ecd6718ccc846702b9ab`.

This document maps the post-R19 research space. It is not a strategy design,
preflight, backtest, performance run, or selection run. No new market data was
acquired and no forward economic value was read, calculated, or inspected.

## Product and boundary

TradePulse remains signal-advisory only. Private Binance APIs, automatic
trading, production changes, shadow activation, and scheduler activation remain
forbidden. The historical boundary is
`2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`, with UTC epoch
arithmetic.

Round-019 remains closed as:

`ROUND-019 CLOSED — NO ADMISSIBLE NOVEL HYPOTHESIS`

The accepted R13-R19 material was reviewed at mechanism-family level. The
reset records status and provenance only; it does not reopen a round or use a
historical economic result to rank a new family.

## R13-R19 mechanism ledger

The machine-readable ledger contains every required family. Its statuses mean:

- `NEGATIVE_ECONOMIC_EVIDENCE`: the accepted round already closed the family;
  no numeric result is re-read here.
- `DATA_INELIGIBLE`: the round could not provide an eligible economic study.
- `DESIGN_REJECTED`: the family was rejected before execution.
- `FORBIDDEN_RETEST`: a retest would be tuning or repackaging an accepted
  mechanism.
- `PROVENANCE_ONLY`: retained to identify the accepted source, not as a new
  signal family.

The closed space includes R13 trend, EMA state, short/medium return and
momentum, volatility/ATR, volume, taker imbalance, symbol-vs-BTC relative
movement, funding, cross-symbol breadth, and ridge feature combination. It
also includes the R14 exact replay; R15 beta/alpha and market-relative
structure; R16 open interest, mark/index basis, and taker-flow persistence; R17
thesis lifecycle, first/follow-up, deduplication/persistence, and the rejected
calendar/session direction; R18 component consensus, 5/5, 4/5, 3/5, score and
grade thresholds, component reweighting, and compression/expansion
repackaging; and R19 prior-candle counter-move, state transition,
market-relative confirmation, calendar/session, and range expansion.

R19's prior-candle counter-move remains a mechanism-level R13 momentum overlap,
not a new family merely because its formula could be written differently.

## Accepted data-surface inventory

All existing surfaces are bound in `round-020-space-reset.json` by an exact
manifest path, accepted source commit, file SHA-256, data SHA-256 where a
frozen data identity exists, symbol set, coverage, and point-in-time statement.
There is no `existing cache somewhere` reference.

The accepted R14 native observation stream is the primary five-symbol,
LONG/SHORT, closed-candle baseline surface. The R15 observation stream and R16
derivatives archive are frozen, concrete, and already consumed by their
respective rounds. R17 is retained as an incomplete identity observation
surface, and R18 is retained as a compact structural-only observation surface.
R19 is design metadata only. These surfaces are not new R20 information and
are not reopened.

The reset found no accepted frozen source identity for:

- forced-deleveraging or liquidation state;
- participant positioning/crowding ratios;
- cross-exchange fragmentation;
- options-implied state;
- on-chain capital flow; or
- external event/information-shock state.

Each absent surface is explicitly `NOT_PRESENT_NEW_DATA_REQUIRED`, has no
repository or manifest path, and records `networkAcquired=false`. No search,
download, backfill, substitution, nearest-time match, or fuzzy match was
performed.

## Research-space assessment

The seven new-data families are assessed structurally, not by returns, PF, PnL,
drawdown, or any other forward economic number:

| Family | Admissibility | Structural assessment |
| --- | --- | --- |
| `FORCED_DELEVERAGING_LIQUIDATION_STATE` | `ADMISSIBLE_NEW_DATA_REQUIRED` | Forced flow is a distinct state; it needs an immutable event archive, event-time identity, and breadth proof. |
| `POSITIONING_CROWDING_STATE` | `ADMISSIBLE_NEW_DATA_REQUIRED` | Participant positioning is distinct from aggregate open interest, but snapshot/revision semantics must be frozen. |
| `SPOT_PERPETUAL_LEAD_LAG_DISLOCATION` | `REJECTED_PRIOR_MECHANISM_OVERLAP` | It is a market-relative/basis family already represented by R15/R16 boundaries. |
| `CROSS_EXCHANGE_FRAGMENTATION` | `ADMISSIBLE_NEW_DATA_REQUIRED` | Venue fragmentation is structurally new but requires synchronized multi-venue provenance. |
| `OPTIONS_IMPLIED_STATE` | `ADMISSIBLE_NEW_DATA_REQUIRED` | An options surface could add independent information, subject to quote, maturity, and breadth qualification. |
| `ON_CHAIN_CAPITAL_FLOW` | `REJECTED_POINT_IN_TIME_RISK` | Timestamp, attribution, and revision identity are not established. |
| `EXTERNAL_EVENT_INFORMATION_SHOCK` | `REJECTED_POINT_IN_TIME_RISK` | A revision-safe pre-event calendar is not established; hindsight labeling is forbidden. |

The full decision-time fields, leakage risks, expected breadth, cost
sensitivity, falsifiable thesis, and acquisition complexity for each family are
frozen in the JSON artifact. None is a candidate rule and none authorizes
execution.

## Decision

Within the accepted frozen R13-R19 information space,
`CURRENT_FROZEN_INFORMATION_SPACE EXHAUSTED` is `true`. This means existing
accepted price, strategy, derivatives, lifecycle, and score-component surfaces
are consumed or rejected; it does not mean future external data sources are
exhausted.

The highest-ranked structurally independent direction is:

`recommendedNextFamily=FORCED_DELEVERAGING_LIQUIDATION_STATE`

Its data status is `NOT_PRESENT_NEW_DATA_REQUIRED`, so the only next stage is
`DATA_ACQUISITION_DESIGN`. Round-020 does not download data, create a candidate
rule, freeze a formal gate, or execute performance. Exactly one family is
recommended; no competing direction is authorized.

Ranking uses only eight predeclared structural dimensions, each on a 0–5
ordinal scale: mechanism novelty, economic plausibility, point-in-time
integrity, expected breadth, data provenance quality, implementation
feasibility, expected information independence, and cost-robustness
plausibility. The ranking explicitly sets
`usesForwardEconomicValues=false` and `usesHistoricalEconomicResults=false`.

## Governance state

```text
performance                 NOT_AUTHORIZED / NOT_GENERATED
performanceExecutionCount   0
performanceLedgerPresent    false
preflightAuthorized         false
preflightExecuted           false
performanceExecuted         false
selectionExecuted           false
economicValuesRead          false
economicValuesCalculated    false
economicValuesInspected     false
newMarketDataFetched        false
Production                  UNCHANGED
baseline-001                UNCHANGED
baseline-002                NOT_FROZEN
M3-J                        BLOCKED
M4                          NOT_STARTED
automaticTrading            false
```

No Round-020 performance ledger, preflight, results, audit, summary, or
selection artifact is created. The protocol implementation is pure and has no
filesystem, database, network, market-data, or execution dependency.
