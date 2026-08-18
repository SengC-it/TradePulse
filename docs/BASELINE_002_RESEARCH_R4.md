# baseline-002 Research Round-004 Protocol Freeze

Status: M3-R4-A UNDER REVIEW / DIAGNOSIS AND HYPOTHESIS FREEZE

Authoritative base: `main` at
`0f994ddde6d3303eb34560cdc1c8babbae5115a5`

`researchRoundId = baseline-002-research-round-004`

## Purpose

Round-004 tests structural strategy changes rather than additional
baseline-001 filters. This document freezes four qualitative, standalone
hypotheses for review. It does not implement or test them.

The first future Round-004 performance stage must contain exactly one frozen
baseline-001 CONTROL and exactly one predeclared variant for each of H11,
H12, H13, and H14. No parameter or candidate may be selected after outcomes
are observed.

## Data and holdout boundary

All research design remains bounded by
`2026-08-15T23:59:59.999Z`, classified as
`RESEARCH_AVAILABLE_SEEN_DATA`. This is not true forward OOS. True forward
holdout remains reserved until a final baseline-002 is frozen.

M3-R4-A does not access new historical data, inspect later market data, call
Binance, run the historical loader, run baseline-001, run a backtest, derive
candidate performance, or recalculate settlement/funding.

## H11 — Breakout retest entry

- Hypothesis ID: `H11_BREAKOUT_RETEST_ENTRY`
- Mechanism family: `ENTRY_TIMING_REDESIGN`
- Research question: Does entering only after a breakout has been retested
  and reconfirmed reduce breakout adverse selection and improve pre-cost
  expectancy versus baseline-001's immediate next-open entry?
- Conceptual change: baseline-001's `breakout signal → next 1H open entry`
  becomes `breakout signal → later closed 1H retest/reclaim confirmation →
  entry after confirmation`.
- Exactly one H11 variant is allowed in the first study.

H11 is not a breakout buffer, volume filter, stronger regime filter, or score
filter. M3-R4-B must freeze the exact retest level, confirmation candle,
entry timestamp, stop reference, ATR reference, TP/R construction, and expiry
when no retest occurs. R4-A intentionally does not freeze those formulas.

## H12 — Pullback reclaim entry

- Hypothesis ID: `H12_PULLBACK_RECLAIM_ENTRY`
- Mechanism family: `ENTRY_PATTERN_REDESIGN`
- Research question: Does a confirmed trend-pullback recovery provide better
  entry price or R geometry than the existing three-bar breakout entry?
- Conceptual change: baseline-001's historical EMA touch plus three-bar
  breakout becomes `trend pullback → current reclaim confirmation → entry`.
- Exactly one H12 variant is allowed in the first study.

H12 replaces the breakout entry trigger; it is not an additional filter on
that trigger. It may reuse existing frozen indicators such as EMA20, EMA50,
EMA200, RSI14, and ATR14, but R4-A adds no indicator. M3-R4-B must freeze the
exact reclaim boundary and risk construction before performance.

## H13 — Adaptive trend exit

- Hypothesis ID: `H13_ADAPTIVE_TREND_EXIT`
- Mechanism family: `EXIT_ARCHITECTURE_REDESIGN`
- Research question: Does the fixed baseline 2R take-profit / 24-hour
  settlement architecture suppress positive trend tails or retain weak trades
  too long?
- Conceptual change: preserve the baseline-001 signal family for isolation,
  but replace fixed profit-taking with one deterministic trend-following exit
  architecture; the hard protective stop remains conservative.
- Exactly one H13 variant is allowed in the first study.

An existing trend indicator such as EMA20 is only a candidate direction, not
an R4-A formula. M3-R4-B must freeze whether fixed 2R TP is removed,
close-cross versus intrabar behavior, exit execution time, hard-stop
precedence, same-candle ordering, maximum holding horizon, and R accounting.
There is no trailing-stop grid.

## H14 — Cross-asset relative-strength context

- Hypothesis ID: `H14_RELATIVE_STRENGTH_CONTEXT`
- Mechanism family: `CROSS_ASSET_CONTEXT`
- Research question: Can decision-time relative momentum distinguish stronger
  long opportunities and weaker short opportunities better than absolute score
  or BTC-regime filters?
- Conceptual change: for non-BTC assets, compare symbol momentum with BTC
  and/or the frozen five-symbol universe; longs represent relative leaders
  and shorts represent relative laggards.
- Exactly one H14 variant is allowed in the first study.

H14 is market-relative price momentum, not the old totalScore Top-N rule.
M3-R4-B must freeze the lookback horizon, return formula, BTC treatment,
ranking/comparison rule, tie behavior, and missing-data behavior. There is no
6h/12h/24h sweep.

## Standalone and no-combination rule

The first Round-004 performance stage is exactly one CONTROL plus one variant
for each of H11-H14. It must not test H11+H12, H11+H13, H11+H14, H12+H13,
H12+H14, H13+H14, or any larger combination. Each structural mechanism must
show standalone evidence before interactions are considered in a separately
authorized round.

There is no threshold grid, parameter sweep, optimizer, random search, or
post-outcome parameter choice. H1-H10 and C1-C4 are not reused as Round-004
candidate mechanisms.

## Gate non-weakening rule

Round-004 gates must be no weaker than Round-003 for aggregate improvement,
improved validation folds, catastrophic folds, net expectancy, profit factor,
concentration, sample floors, and fee burden. A semantic incompatibility with
an existing metric must stop M3-R4-B for review; it may not silently remove or
weaken a gate.

M3-R4-A does not create a machine-readable gate record, a new Gate SHA, or a
new Plan SHA. The exact machine record belongs to M3-R4-B.

## M3-R4-B contract

Before any historical performance, M3-R4-B must specify and freeze:

1. exact H11-H14 formulas and one variant each;
2. complexity tuples and candidate registry identities;
3. decision-time fields and no-future-data rules;
4. exact historical data and manifest requirements;
5. entry, stop, TP/R, exit, same-candle, and maximum-horizon semantics;
6. non-weakened gate semantics and a canonical machine Gate record;
7. a canonical Plan record and its SHA;
8. synthetic tests for all of the above.

Only after M3-R4-B is reviewed and merged may Round-004 historical
performance be authorized.

## Stop-before-performance principle

If the machine protocol cannot represent an H11-H14 semantic without
silently changing baseline-001, frozen economics, metrics, or gates, M3-R4-B
must stop and surface the incompatibility for review. It must not implement a
partial fallback, rerun an earlier round, tune a threshold, or generate
performance evidence.

Neutral-regime mean reversion, new indicators, order-book signals, open
interest, liquidations, funding-rate alpha, machine learning,
news/sentiment, and portfolio optimization are deferred. They are not R4-A
hypotheses.

`baseline-002 = NOT FROZEN`; `M3-R4-B = NOT AUTHORIZED`; `M3-J = BLOCKED`;
`M4 = NOT STARTED`.
