# baseline-002 Research Round-006 Hypothesis Freeze

Status: M3-R6-A DIAGNOSIS AND HYPOTHESIS FREEZE

Authoritative base: 44d203a06e1171c2fe4baa779360bb0dde16e454

Research round: baseline-002-research-round-006

## Purpose and boundary

This is a qualitative, pre-performance research-design record. It freezes no
executable formula, threshold, Gate SHA, Plan SHA, performance result, or
baseline-002 promotion decision.

The registry below is limited to four standalone mechanism families, one
qualitative variant per family, with no combinations. No candidate values are
derived from Round-005 outcomes. No Binance request, historical loader,
performance command, selection command, or forward-data access was performed.

The seen-data boundary remains:

2026-08-15T23:59:59.999Z

Classification:

RESEARCH_AVAILABLE_SEEN_DATA

Data after this boundary is reserved for future forward evaluation.

## Frozen Round-006 qualitative registry

| Hypothesis ID | Mechanism family | Qualitative variant |
| --- | --- | --- |
| R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH | CROSS_SECTIONAL_RELATIVE_STRENGTH | Synchronized leader/laggard relative-strength signal |
| R6-H20-STRUCTURAL-TREND-CONTINUATION | STRUCTURAL_TREND_CONTINUATION | Independent trend, controlled retracement, structural continuation signal |
| R6-H21-ECONOMIC-VOLATILITY-EXPANSION | ECONOMIC_VOLATILITY_EXPANSION | Event-driven compression-to-expansion architecture with predeclared move-to-cost economics |
| R6-H22-PREDECLARED-REGIME-ROUTING | PREDECLARED_REGIME_ROUTING | Deterministic decision-time regime routing frozen before performance |

These are hypotheses, not executable candidates. R6-B may reject a hypothesis
for data or semantic reasons, but may not select a hypothesis after observing
its performance.

## R6-H19 — Cross-sectional relative strength

- Mechanism family: CROSS_SECTIONAL_RELATIVE_STRENGTH.
- Economic thesis: relative leadership and lagging behavior across the
  approved universe may provide a cross-sectional edge that is not present in
  a single-symbol baseline signal.
- Structural difference: this is an independently generated cross-sectional
  signal, not a baseline-001 filter, score adjustment, BTC alignment filter,
  Top-N reuse, or combination of retired mechanisms.
- Required data: synchronized fully closed OHLC data for the approved five
  symbols and the decision-time symbol universe. No new market data is
  requested by R6-A.
- Decision-time availability: the relative-strength state must be computed
  only from observations closed at or before the decision timestamp; ranking,
  ties, and eligibility must be frozen before performance.
- Leakage risks: cross-symbol time misalignment, using a future leader/laggard
  rank, survivorship changes, and using outcome or later-period ranks.
- Expected turnover behavior: research inference is lower or more episodic
  turnover than independent per-symbol signals because the mechanism acts on
  relative leadership, but cadence must be measured only after R6-B freezes
  it.
- Expected gross-edge-per-trade mechanism: capture persistence or rotation
  from relative leadership rather than adding filters to baseline-001.
- Falsification criteria: R6-B must predeclare that the mechanism is rejected
  if synchronized ranks are not reproducible at decision time, if its signal
  identity collapses into a retired filter, or if its frozen economic
  diagnostics do not survive the non-weakened Gate.
- Current committed data sufficiency: the committed five-symbol historical
  OHLC evidence is sufficient to design and test data availability and
  timestamp semantics; it is not a performance authorization.
- R6-B must freeze: universe membership, synchronization/tie rules, rank
  cadence, signal identity, entry/exit semantics, data manifests,
  no-future-data tests, falsification rules, and Gate/Plan records.

## R6-H20 — Structural trend continuation

- Mechanism family: STRUCTURAL_TREND_CONTINUATION.
- Economic thesis: an established trend followed by a controlled retracement
  and structural continuation may seek larger directional movement per trade
  with a predeclared lower-density entry architecture.
- Structural difference: this must be an independent trend-to-retracement-to-
  continuation signal. It must not recreate or tune the retired H8 pullback
  filter, alter H15 lookbacks, or reuse baseline-001 conditions as a wrapper.
- Required data: fully closed 1H and 4H OHLC history and any indicators
  explicitly frozen by R6-B. No additional market data is authorized here.
- Decision-time availability: trend state, retracement state, and
  continuation confirmation must use only closed candles available at the
  signal decision time.
- Leakage risks: identifying a retracement from later candles, confirming
  continuation with the entry candle's future range, changing the structural
  definition after observing results, or borrowing H8/H15 parameters.
- Expected turnover behavior: research inference is lower-frequency and more
  selective than a dense baseline filter, but the exact cadence is deferred
  to R6-B.
- Expected gross-edge-per-trade mechanism: participate in continuation after
  structural reset rather than in an unqualified trend or a tuned pullback
  filter.
- Falsification criteria: reject if the frozen predicate is materially the
  retired H8 architecture, if decision-time structure cannot be reproduced,
  or if the non-weakened Gate rejects the frozen candidate.
- Current committed data sufficiency: committed closed-candle evidence is
  sufficient to define the data contract and synthetic boundary tests; exact
  executable semantics are not frozen by R6-A.
- R6-B must freeze: structural state definitions, candle timing, one variant,
  risk and settlement semantics, manifests, no-future-data tests,
  falsification rules, and Gate/Plan records.

## R6-H21 — Economic volatility expansion

- Mechanism family: ECONOMIC_VOLATILITY_EXPANSION.
- Economic thesis: a predeclared transition from a compressed state to a
  directional expansion may target sufficiently large gross movement to
  survive the existing conservative fee, slippage, and settlement economics.
- Structural difference: this is a new volatility architecture with
  predeclared move-to-cost economics. It must not tune, relax, or sweep H18
  thresholds and must not copy H18's candidate identity.
- Required data: fully closed OHLC-derived volatility state and directional
  expansion data from the approved universe, with existing frozen economics
  retained. No new market data is authorized in R6-A.
- Decision-time availability: compression and expansion state must be
  computable using only closed decision-time candles; all move-to-cost
  requirements must be frozen before performance.
- Leakage risks: selecting a volatility threshold from H18 outcomes,
  calculating compression with future bars, using post-entry movement to
  define the signal, or changing the cost model to rescue a result.
- Expected turnover behavior: research inference is event-driven and
  potentially low-frequency, with trades concentrated around state
  transitions rather than continuous trend filtering.
- Expected gross-edge-per-trade mechanism: seek larger movement per qualified
  event so fixed costs consume a smaller predeclared share of gross edge.
- Falsification criteria: reject if the state transition is not reproducible
  at decision time, is only an H18 threshold variant, or cannot meet the
  predeclared economic and non-weakened Gate requirements.
- Current committed data sufficiency: committed OHLC and settlement evidence
  is sufficient to define an offline data contract; R6-A does not claim that
  the exact executable feature or performance sample is sufficient.
- R6-B must freeze: volatility-state semantics, expansion confirmation,
  move-to-cost rule, one variant, data manifests, no-future-data tests,
  falsification rules, and Gate/Plan records.

## R6-H22 — Predeclared regime routing

- Mechanism family: PREDECLARED_REGIME_ROUTING.
- Economic thesis: a deterministic market-regime classifier may route one
  predeclared specialization to the condition where its economic thesis is
  valid, avoiding post-result strategy selection.
- Structural difference: routing is one standalone architecture whose regime
  classifier and route set are frozen before performance. It is not a
  combination of R6-H19, R6-H20, and R6-H21, and it must not become a
  baseline-001 filter or post-result selector.
- Required data: decision-time closed market and symbol-state inputs already
  represented by the committed research universe, plus any route-specific
  inputs explicitly frozen in R6-B.
- Decision-time availability: regime classification and the selected
  specialization must be deterministic from information available at the
  decision timestamp; the route cannot be changed after a result is observed.
- Leakage risks: using future regime labels, choosing route definitions from
  fold outcomes, allowing route-specific thresholds to drift, or treating
  the best observed route as a new candidate.
- Expected turnover behavior: research inference is conditional and may
  reduce activity in regimes without a valid edge, but the route cadence and
  inactivity semantics must be frozen before performance.
- Expected gross-edge-per-trade mechanism: concentrate a predeclared
  specialization in the regime where its thesis should produce larger
  risk-adjusted movement, without changing the route after measurement.
- Falsification criteria: reject if route identity depends on future data,
  post-result selection, an unbounded number of specializations, or weakened
  gates.
- Current committed data sufficiency: committed regime and candle evidence is
  sufficient to specify an offline decision-time contract; it does not
  authorize performance or prove that any route has an edge.
- R6-B must freeze: regime labels, route map, one-variant complexity bound,
  tie and fallback behavior, data manifests, no-future-data tests,
  falsification rules, and Gate/Plan records.

## Common anti-snooping and governance contract

- At most four hypotheses are registered above.
- There is exactly one qualitative variant per hypothesis.
- No combinations are allowed.
- No parameter grid, threshold sweep, optimizer, random search, or
  post-result candidate selection is allowed.
- No value may be derived from Round-005 candidate outcomes.
- The seen-data boundary remains
  2026-08-15T23:59:59.999Z.
- H17 remains excluded unless a separately authorized complete qualification
  makes it DATA_AVAILABLE; R6-A does not qualify H17.
- R6-A creates no final Round-006 Gate SHA or Plan SHA.
- Historical performance remains unauthorized until R6-B is independently
  accepted and merged.

## Governance state

baseline-002 = NOT_FROZEN

M3-R6-A = DIAGNOSIS_AND_HYPOTHESIS_FREEZE

M3-R6-B = NOT_STARTED / PENDING_ACCEPTANCE

M3-J = BLOCKED

M4 = NOT_STARTED
