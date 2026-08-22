# baseline-002 Research Round-005 Protocol Freeze

Status: M3-R5-B.1A PROTOCOL AND H17 DATA-QUALIFICATION TOOLING FREEZE

Research round: `baseline-002-research-round-005`

Authoritative base: `cb004575fb899d62a4d6e4f5424e3b88a43ac4ac`

## Purpose and boundary

Round-005 is a research-design stage for structurally different edge
architectures. M3-R5-A froze the four standalone qualitative hypotheses;
M3-R5-B.1A now freezes their exact provisional formulas, decision-time
contracts, synthetic boundary tests, and H17 data-qualification tooling. It
does not run historical data, run baseline-001, run CONTROL, calculate
performance, or authorize a backtest. The detailed B.1A contract is in
`docs/M3_R5_B1A_PROTOCOL.md`.

The research data boundary remains through
`2026-08-15T23:59:59.999Z`, classified as
`RESEARCH_AVAILABLE_SEEN_DATA`. No newly arrived Aug-16-or-later data may be
inspected in R5-A; that data is reserved for future forward evaluation.

Exactly one provisional variant per hypothesis is frozen in B.1A. The final
Round-005 registry, Gate SHA, and Plan SHA remain deferred to B.1B, after the
conditional H17 qualification boundary is resolved.

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
  after exact semantics are frozen in R5-B.1A.

The exact H15 indicators, strict breakout, stop, take-profit, holding horizon,
and next-open contract are frozen in B.1A; it remains a provisional variant
until B.1B finalizes the registry.

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
variant is frozen provisionally in B.1A; B.1B may include it only if its
qualification boundary is satisfied.

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

**Data gate:** R5-B.1B must first apply the frozen H17 qualification tooling
to prove historical funding availability and
timestamp completeness across the entire frozen research universe. If
complete decision-time funding cannot be reproduced for the required period,
H17 must be marked `DATA_NOT_AVAILABLE` and must not enter performance.
R5-A/B.1A do not fetch ad-hoc replacement historical data. Exactly one H17
variant may enter performance only if the data gate passes.

## H18 — Volatility compression to expansion

- **Hypothesis ID:** `H18_VOLATILITY_COMPRESSION_EXPANSION`
- **Mechanism family:** `VOLATILITY_STATE_ENTRY`
- **Research question:** Can a deterministic transition from volatility
  compression to directional expansion isolate trades with sufficiently
  large gross movement to survive conservative fees and slippage?
- **Conceptual direction:** A new signal source based only on decision-time
  OHLC-derived compression data with deterministic expansion confirmation.
  It is not a recreation of H9 volume confirmation or H10 breakout buffer.

The exact H18 compression, expansion, strict breakout, risk, and holding
contract is frozen in B.1A. No volatility percentile or ATR threshold grid is
introduced.

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

No existing threshold may be weakened. R5-B.1B may propose additional stricter
diagnostics or gates only when they are justified before performance,
machine-readable, frozen before performance, and not derived from candidate
outcomes. R5-A creates no Gate SHA and no Plan SHA.

## M3-R5-B.1A / B.1B contract

Before any historical performance is authorized, B.1A freezes:

1. exact H15-H18 formulas;
2. the exact candidate registry;
3. the one-variant maximum for each hypothesis;
4. complexity tuples;
5. decision-time timestamp semantics;
6. exact entry, stop, take-profit, exit, and holding semantics;
7. historical data and manifest requirements;
8. the H17 funding data-completeness proof;
9. the exact no-future-data contract;
10. the inherited non-weakened Gate requirements without a final Gate record;
11. synthetic boundary tests; and
12. performance-lock and round-invalidation rules.

B.1B remains responsible for the conditional final registry, a machine-
readable non-weakened Gate record and Gate SHA, the canonical Plan record and
Plan SHA, and the final H17 eligibility decision. H17 must not enter
performance unless the complete canonical funding qualification returns
`COMPLETE` / `H17_DATA_QUALIFICATION=PASS`.

No historical performance is authorized until R5-B.1B is independently accepted
and merged. If a semantic incompatibility would silently alter baseline-001,
frozen economics, metrics, or gates, R5-B must stop and surface it for
review.

## Governance state

`baseline-002 = NOT_FROZEN`

`M3-R5-B.1A = PROTOCOL_AND_QUALIFICATION_TOOLING_FROZEN`

`M3-R5-B.1B = DEFERRED_PENDING_H17_QUALIFICATION`

`M3-J = BLOCKED`

`M4 = NOT_STARTED`

No performance command, Binance request, historical loader, evidence
generation, candidate selection, or baseline freeze is authorized by this
B.1A document. `baseline-002` remains not frozen, M3-J remains blocked, and
M4 remains not started.
