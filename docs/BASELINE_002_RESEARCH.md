# baseline-002 Research Protocol

Status: M3-G specification under review. `baseline-002` is **not defined or
frozen** by this document.

This document freezes the research method that may be used after M3-G. It is a
protocol, not a strategy implementation and not a historical performance run.
No experiment, parameter search, or baseline-001 rerun is authorized by M3-G.

## 1. Scope and non-goals

The purpose of the protocol is to investigate whether a future strategy
version can improve robust **net signal-level edge** after the existing frozen
cost assumptions. It defines the admissible research data, hypotheses,
experiment registry, chronological validation, diagnostics, and freeze gates.

M3-G does not:

- define the rules, thresholds, indicators, score formula, or signal behavior
  of `baseline-002`;
- implement a research runner, optimizer, strategy code, or production code;
- execute a historical performance run or select a candidate;
- modify `baseline-001`, `bt-policy-001`, `bt-policy-002`, or `bt-policy-003`;
- change fees, slippage, funding, settlement, or any other execution economics;
- authorize M4, trading, private Binance APIs, persistence, or deployment.

The future research tooling must continue to use public Binance market data
only and must not request account, trading, wallet, or private API access.

## 2. Immutable baseline-001 reference

The merged baseline-001 evidence remains the control reference. These values
are recorded here for protocol comparison and must not be recomputed,
overwritten, or reinterpreted by M3-G.

| Segment | Formal signals | Executed trades | Net R | Profit factor | Expectancy R |
| --- | ---: | ---: | ---: | ---: | ---: |
| COMBINED | 7500 | 7495 | -737.8825430833317 | 0.838943838026 | -0.09844997239270603 |
| OOS evidence segment | 1196 | 1196 | -34.68066826264698 | 0.950839776896 | -0.02899721426642724 |

The diagnostic observations carried forward as research motivation are:

- signal overlap is high;
- fee drag is substantial;
- Combined gross edge is already negative;
- historical score/grade did not show reliable monotonic economic quality;
- all five approved symbols were negative in the baseline evidence.

These observations motivate hypotheses; they do not authorize threshold
nudging or guarantee that a proposed mechanism will work.

## 3. Data contamination boundary

The interval from `2026-01-01T00:00:00.000Z` through
`2026-08-15T23:59:59.999Z` has already been seen, inspected, and analyzed.
For all baseline-002 research it is permanently classified as:

**RESEARCH-AVAILABLE / SEEN DATA**

It must not be called untouched OOS, pristine OOS, unseen validation, or a true
holdout. Internal chronological validation folds may use this interval, but a
result from it remains historical research validation. The same terminology
applies to every other candle or derived result already inspected before the
future holdout is frozen.

The existing M3-E evidence file and its classification remain immutable. M3-G
does not promote any historical segment to an OOS pass.

## 4. True forward holdout

The protocol freezes this rule before any baseline-002 research:

```text
forwardHoldoutStart =
the first fully closed 1H candle strictly after the final baseline-002
freeze commit/time
```

The exact UTC timestamp cannot be known during M3-G. When baseline-002 is
finally frozen, the freeze record must include the exact timestamp, the source
Git SHA, and the resulting `forwardHoldoutStart` candle open/close times.

No data at or after `forwardHoldoutStart` may be used to design, tune, rank,
select, reject, or modify baseline-002. It may be used only in the separately
authorized forward-validation phase after the freeze. The forward period is
not an input to M3-H experiments, M3-I selection, or M3-J implementation.

## 5. Research objective and principles

The primary objective is robust net signal-level edge after realistic costs.
The primary comparison is not raw win rate, gross return, number of trades, a
single symbol, one month, one regime, or a backtest label.

Every future comparison must report, at minimum:

- net expectancy and profit factor;
- gross edge before costs and fee/funding burden;
- signal redundancy and density;
- stability across chronological folds, symbols, direction, score bucket, and
  BTC/symbol regime;
- concentration and complexity.

Research must preserve the existing five-symbol universe and the shared
framework-independent Strategy Engine boundary. A change to strategy behavior
would require a new reviewed strategy version; it cannot be smuggled into a
research parameter.

## 6. Initial hypothesis registry

The initial registry is limited to these five hypothesis families. A new
family requires a separate documented decision before any experiment in that
family is executed.

### H1 — Signal redundancy

Test whether repeated correlated signals from the same market move are
destroying net edge. Admissible mechanism classes include per-symbol cooldown,
same-direction duplicate suppression, a minimum state change before a repeat,
and deterministic top-N selection per evaluation. The exact mechanism and
values must be registered before testing.

### H2 — Cost-adjusted edge

Test whether a candidate has enough expected movement relative to the frozen
fees, slippage, and stop distance. The eligibility input must be available at
the signal decision time; realized future outcome must never decide eligibility.

### H3 — Score calibration

Test whether existing component scores correlate with subsequent net R. A
registered experiment may recalibrate, reweight, remove a non-informative
component, or replace a hard grade role with deterministic ranking, but no
direction or weight is assumed in advance. A non-predictive score must not be
rescued by raising thresholds after seeing outcomes.

### H4 — Signal density

Test whether reducing low-marginal-quality signals improves net edge. Candidate
mechanisms include top-1/top-N selection across symbols, a higher predeclared
evidence requirement, duplicate suppression, and cooldown. Trade count alone
is not an objective; density, overlap, cost, and net edge must be reported
together.

### H5 — Regime quality

Test whether performance differs materially by BTC regime, symbol regime, or
direction. A regime mechanism is admissible only when its evidence persists
across multiple chronological folds and is not explained by one isolated
segment.

## 7. Experiment registry and immutability

Every future experiment must be registered before execution with an immutable
record containing exactly these fields:

| Field | Requirement |
| --- | --- |
| `experimentId` | Unique, deterministic identifier; never reused or edited |
| `hypothesisId` | One of the registered H1–H5 families |
| `exactChange` | Precise rule/mechanism change from the control |
| `rationale` | Falsifiable reason for testing the change |
| `parametersTested` | Named parameters and units |
| `predeclaredParameterValues` | Complete finite list, recorded before execution |
| `result` | Filled only after the run, with reports and breakdowns |
| `decision` | Retain, reject, or defer with an evidence-based reason |

The registry entry, parameter list, control definition, fold boundaries, and
cost assumptions become append-only once the experiment starts. Results may
not cause an identifier or hypothesis to be rewritten. A failed or neutral
experiment remains part of the audit trail.

## 8. Controlled parameter search

Research uses small, discrete, hypothesis-driven grids. For every scalar
parameter, predeclare no more than five economically meaningful values. Avoid
simultaneous multi-dimensional combinatorial sweeps; test one mechanism at a
time wherever practical.

The following are prohibited:

- thousands of threshold combinations;
- genetic, Bayesian, random, or brute-force search;
- an automatic optimizer maximizing net R or any other historical metric;
- repeated threshold nudging after results are observed;
- changing the hypothesis, fold boundaries, cost model, or metric definition
  to obtain a preferred result.

## 9. Ablation-first sequence

The first comparison set must contain the unchanged `baseline-001` CONTROL and
single-mechanism variants. The minimum conceptual sequence is:

| Variant | Change |
| --- | --- |
| CONTROL | `baseline-001` unchanged |
| R1 | cooldown only |
| R2 | top-N only |
| R3 | cost filter only |
| R4 | score calibration only |

Only a mechanism with robust individual evidence may be proposed for a later
combination. Combinations must identify which registered mechanisms they use;
they may not be introduced as an unexplained bundle.

## 10. Chronological research folds

The following UTC boundaries are frozen before M3-H. They are calendar-based,
not selected from observed performance. Each validation interval is immediately
after its research interval, and research intervals expand chronologically.
All rows are **research validation**, including the interval beginning in
2026; none is a pristine OOS or true holdout.

| Fold | Research/calibration interval | Validation interval |
| --- | --- | --- |
| F1 | `2023-01-01T00:00:00.000Z` – `2023-12-31T23:59:59.999Z` | `2024-01-01T00:00:00.000Z` – `2024-06-30T23:59:59.999Z` |
| F2 | `2023-01-01T00:00:00.000Z` – `2024-06-30T23:59:59.999Z` | `2024-07-01T00:00:00.000Z` – `2024-12-31T23:59:59.999Z` |
| F3 | `2023-01-01T00:00:00.000Z` – `2024-12-31T23:59:59.999Z` | `2025-01-01T00:00:00.000Z` – `2025-06-30T23:59:59.999Z` |
| F4 | `2023-01-01T00:00:00.000Z` – `2025-06-30T23:59:59.999Z` | `2025-07-01T00:00:00.000Z` – `2025-12-31T23:59:59.999Z` |
| F5 | `2023-01-01T00:00:00.000Z` – `2025-12-31T23:59:59.999Z` | `2026-01-01T00:00:00.000Z` – `2026-03-31T23:59:59.999Z` |
| F6 | `2023-01-01T00:00:00.000Z` – `2026-03-31T23:59:59.999Z` | `2026-04-01T00:00:00.000Z` – `2026-08-15T23:59:59.999Z` |

For every fold, indicator warm-up and StrategyInput candles must be strictly
at or before the evaluation timestamp. There is no random shuffle. Any
settlement-only data needed by the already frozen `bt-policy-003` is loaded
under that policy only; it cannot become a strategy input or leak a later
outcome into an earlier fold. Missing required data remains fail-closed under
the existing policy.

The tooling must serialize the fold ID and exact UTC boundaries so a report
cannot silently use a different partition.

## 11. Robustness and reporting gates

A candidate is not selected merely because it has the highest aggregate net R.
The future preselection report must include aggregate and per-fold results,
plus breakdowns by symbol, direction, score/grade bucket, BTC regime, symbol
regime, and UTC month/year.

The candidate review must address all of these gates:

1. aggregate historical research improvement versus the unchanged control;
2. improvement in a majority of chronological validation folds;
3. no catastrophic dependence on one fold;
4. acceptable cost efficiency under the frozen economics;
5. materially lower redundancy when a redundancy mechanism is claimed;
6. no extreme single-symbol or single-trade concentration;
7. no evidence that the result is caused by one month, direction, or regime;
8. no unresolved data-integrity, provenance, or reproducibility failure.

Exact numeric pass thresholds for the final baseline-002 selection must be
written before final candidate selection in M3-I. They may not be retrofitted
after comparing results. A candidate that fails a gate is rejected or deferred,
not relabeled as a pass.

## 12. Frozen cost accounting

Research comparability keeps the existing economics unchanged:

- 5 bps adverse entry slippage;
- 5 bps adverse exit slippage;
- 5 bps entry fee;
- 5 bps exit fee;
- funding and settlement under `bt-policy-003`;
- the same signal-level settlement methodology.

Reports must expose `grossR`, `feeR`, `fundingR`, `netR`, and net R per executed
signal. `feeR / abs(grossR)` may be reported only when the denominator is
mathematically valid. No fee, slippage, funding, or settlement assumption may
be reduced to improve a research result.

## 13. Signal-density and redundancy metrics

The future tooling must compute the following diagnostics with deterministic
definitions frozen before implementation:

- `formalSignals`: count of formal signal identities
  `(symbol, direction, signalCandleTime)`;
- `executedTrades`: count of those identities with a valid hypothetical fill;
- `signalsPerDay`: `formalSignals` divided by the UTC calendar-day count covered
  by the segment, with a zero-day segment invalid rather than substituted;
- `signalsPerSymbol`: formal signal count grouped by the approved symbol;
- `overlappingSignalRate`: fraction of formal identities whose held interval
  intersects at least one other formal identity for the same symbol and
  direction, using the frozen 24-held-candle interval;
- `uniqueSignalHours`: count of distinct UTC 1H signal-candle timestamps across
  formal identities, reported overall and by symbol;
- `repeatSignalsWithin6h`, `repeatSignalsWithin12h`, and
  `repeatSignalsWithin24h`: counts of formal identities having an earlier
  identity with the same symbol and direction and a strictly positive time
  difference no greater than the named window.

Rates must include their numerator and denominator. Empty or invalid domains
are reported as unavailable, never as zero or Infinity. These diagnostics
measure redundancy and density; minimizing the number of trades is not itself
success.

## 14. Score calibration metrics

Score research must predeclare deterministic, non-overlapping score buckets.
For each bucket and each fold, report at least:

- signal count and executed-trade count;
- gross R, net R, expectancy R, and profit factor;
- win rate and cost/funding burden;
- symbol, direction, regime, and UTC month/year breakdowns.

The report must include a monotonicity diagnostic over the ordered buckets.
An apparent ordering such as `A > B > C` is not accepted as a rule unless it
persists across the required folds and breakdowns. If the score is
non-predictive, a future candidate may simplify or remove its formal grade
role, but cannot merely raise a threshold after inspecting results.

## 15. Complexity penalty

When two candidates have similar robustness, prefer the simpler candidate.
Every candidate record must count:

- new rules;
- new tunable thresholds;
- modified baseline rules;
- registered mechanism families used.

Marginal historical improvement does not justify additional complexity. Any
change to a frozen baseline rule requires a new reviewed strategy version; it
cannot be hidden under `baseline-002` research metadata.

## 16. Freeze-gate sequence

The milestones are intentionally separate:

```text
M3-G   research protocol specification freeze (this document)
  ->
M3-G.1 research tooling and diagnostic implementation
  ->
M3-H   execute only predeclared historical research experiments
  ->
M3-I   freeze one baseline-002 specification
  ->
M3-J   implement baseline-002
  ->
forward validation using data strictly after baseline-002 freeze
```

M3-G does not freeze `baseline-002`, and no M3-G.1 tooling or M3-H experiment
is included in this change. M4 remains separate and unauthorized.

## 17. Terminology and limits of inference

No report using data through `2026-08-15` may claim `OOS PASS`. Use
`historical research validation`, `walk-forward research validation`, or
`seen-data validation` instead. The future forward period is the only genuine
holdout under this protocol.

Historical research cannot guarantee future profitability. The purpose of
baseline-002 research is to test for robust evidence of signal edge under
frozen costs, not to promise profit.
