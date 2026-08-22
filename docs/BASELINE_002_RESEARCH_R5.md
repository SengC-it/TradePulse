# baseline-002 Research Round-005 Protocol Freeze

Status: M3-R5-A DIAGNOSIS AND HYPOTHESIS FREEZE

Research round: `baseline-002-research-round-005`

Authoritative base: `0cba8fc75fc65b5a53ee760bf15af9a0e0594033`

## Purpose and boundary

Round-005 is a research-design stage for structurally different edge
architectures. This document freezes exactly four standalone qualitative
hypotheses. It does not implement H15-H18, define executable formulas, run
historical data, run baseline-001, run CONTROL, calculate performance, or
authorize a backtest.

The research data boundary remains through
`2026-08-15T23:59:59.999Z`, classified as
`RESEARCH_AVAILABLE_SEEN_DATA`. No newly arrived Aug-16-or-later data may be
inspected in R5-A; that data is reserved for future forward evaluation.

Exactly one variant per hypothesis may be frozen in R5-B. R5-A does not
freeze indicators, thresholds, stops, take-profit rules, holding horizons,
entry timing, or settlement formulas.

## H15 — HTF low-frequency trend architecture

- **Hypothesis ID:** `H15_HTF_LOW_FREQUENCY_TREND`
- **Mechanism family:** `SIGNAL_TIMEFRAME_REDESIGN`
- **Research question:** Can an independently generated higher-timeframe
  trend signal materially increase gross edge per trade and reduce
  turnover/cost burden compared with baseline-001's 1H signal architecture?
- **Conceptual direction:** Signal formation occurs on a higher timeframe,
  preferably 4H. This is a new signal source, not a 4H filter applied to
  baseline-001. Trade cadence should be structurally lower than baseline-001.
  Entry and outcome settlement may still use lower-timeframe execution data
  after exact semantics are frozen in R5-B.

Exactly one H15 variant may be frozen in R5-B. R5-A does not freeze its exact
indicators, thresholds, stop, take-profit, holding horizon, or entry timing.

## H16 — Neutral-regime mean reversion

- **Hypothesis ID:** `H16_NEUTRAL_REGIME_MEAN_REVERSION`
- **Mechanism family:** `EDGE_FAMILY_REDESIGN`
- **Research question:** Can a deterministic mean-reversion architecture in
  non-trending or neutral market conditions provide an independent positive
  edge where the trend/breakout family has failed?
- **Conceptual direction:** A new entry family that does not require a
  baseline-001 formal signal and reverts toward a predeclared
  decision-time value/trend anchor after a deterministic neutral regime is
  defined.

H16 must not become another baseline filter, RSI threshold sweep,
EMA-distance grid, Bollinger grid, or parameter optimization. Exactly one H16
variant may be frozen in R5-B.

## H17 — Funding crowding reversal

- **Hypothesis ID:** `H17_FUNDING_CROWDING_REVERSAL`
- **Mechanism family:** `DERIVATIVES_POSITIONING_ALPHA`
- **Research question:** Does decision-time perpetual funding contain useful
  crowding information such that sufficiently one-sided positioning predicts
  a deterministic contrarian opportunity?
- **Conceptual direction:** Funding is an alpha/input, not merely a
  settlement cost. Only funding observations published and knowable at
  decision time may be used. Future funding leakage and external
  sentiment/news data are prohibited.

**Data gate:** R5-B must first prove historical funding availability and
timestamp completeness across the entire frozen research universe. If
complete decision-time funding cannot be reproduced for the required period,
H17 must be marked `DATA_NOT_AVAILABLE` and must not enter performance.
R5-A does not fetch ad-hoc replacement historical data. Exactly one H17
variant may be frozen only if the data gate passes.

## H18 — Volatility compression to expansion

- **Hypothesis ID:** `H18_VOLATILITY_COMPRESSION_EXPANSION`
- **Mechanism family:** `VOLATILITY_STATE_ENTRY`
- **Research question:** Can a deterministic transition from volatility
  compression to directional expansion isolate trades with sufficiently
  large gross movement to survive conservative fees and slippage?
- **Conceptual direction:** A new signal source based only on decision-time
  OHLC-derived compression data with deterministic expansion confirmation.
  It is not a recreation of H9 volume confirmation or H10 breakout buffer.

Exactly one H18 variant may be frozen in R5-B. R5-A does not define a
volatility percentile or ATR threshold grid.

## Standalone and anti-snooping rule

The first Round-005 performance stage, if later authorized, may contain:

- the frozen CONTROL;
- one H15 candidate;
- one H16 candidate;
- one H17 candidate only if its data-completeness gate passes; and
- one H18 candidate.

No combinations are permitted. In particular, the stage must not test H15+H16,
H15+H17, H15+H18, H16+H17, H16+H18, H17+H18, or any larger combination.

There is no optimizer, random search, parameter grid, threshold sweep, or
post-result parameter selection. A candidate identity and its one variant
must be predeclared before any performance observation.

## Gate policy

Round-005 gates must be no weaker than Round-004. At minimum, preserve the
semantics of:

- `minimumAggregateImprovement`;
- `minimumImprovedValidationFolds`;
- `catastrophicFoldLimit`;
- `minimumNetExpectancy`;
- `minimumProfitFactor`;
- `maximumSymbolConcentration`;
- `maximumSingleTradeConcentration`;
- `maximumFeeBurdenRatio`;
- `minimumFormalSignals`; and
- `minimumExecutedTrades`.

No existing threshold may be weakened. R5-B may propose additional stricter
diagnostics or gates only when they are justified before performance,
machine-readable, frozen before performance, and not derived from candidate
outcomes. R5-A creates no Gate SHA and no Plan SHA.

## M3-R5-B contract

Before any historical performance is authorized, R5-B is responsible for
freezing:

1. exact H15-H18 formulas;
2. the exact candidate registry;
3. the one-variant maximum for each hypothesis;
4. complexity tuples;
5. decision-time timestamp semantics;
6. exact entry, stop, take-profit, exit, and holding semantics;
7. historical data and manifest requirements;
8. the H17 funding data-completeness proof;
9. the exact no-future-data contract;
10. a non-weakened machine-readable Gate record;
11. the canonical Gate SHA;
12. the canonical Plan record and Plan SHA;
13. synthetic boundary tests; and
14. performance-lock and round-invalidation rules.

No historical performance is authorized until R5-B is independently accepted
and merged. If a semantic incompatibility would silently alter baseline-001,
frozen economics, metrics, or gates, R5-B must stop and surface it for
review.

## Governance state

`baseline-002 = NOT_FROZEN`

`M3-R5-B = NOT_AUTHORIZED`

`M3-J = BLOCKED`

`M4 = NOT_STARTED`

No performance command, Binance request, historical loader, evidence
generation, candidate selection, or baseline freeze is authorized by this
R5-A document.
