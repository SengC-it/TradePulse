# TradePulse M3-R6-B.1A — Round-006 executable protocol freeze

Status: Draft implementation only. Historical performance is not authorized.

Authoritative source: `74ae97f1924cee215161bcfd5eb5ca6fbaaa5093`

Research round: `baseline-002-research-round-006`

## Scope and immutable boundary

This document freezes one executable variant for each of the four surviving
Round-006 hypotheses. It does not create a Gate SHA or Plan SHA, run a
historical loader, access Binance, inspect forward data, or generate a
performance result. The fixed universe is `BTCUSDT`, `ETHUSDT`, `SOLUSDT`,
`XRPUSDT`, and `BNBUSDT`. F1–F6 are inherited unchanged from the existing
research-fold registry.

The seen-data boundary is exactly `2026-08-15T23:59:59.999Z`, classified as
`RESEARCH_AVAILABLE_SEEN_DATA`. Data after that boundary is reserved for
forward evaluation.

Every formal identity is exactly:

```text
symbol|direction|signalTime
```

`signalTime` is the close time of the fully closed decision candle. A signal
may use only fields available at that time. The first legal entry is the first
1H open strictly after `signalTime`; entry and settlement use unchanged
`bt-policy-003` economics: 5 bps adverse slippage per side, 5 bps fee per
side, official funding with the frozen mark-price fallback, conservative
SL-first intrabar ordering, exactly 24 held 1H candles, and TIME_EXIT at the
close of held candle #24. All missing or invalid decision-time inputs fail
closed as `DATA_INCOMPLETE`.

## Candidate registry

| Candidate | Mechanism family | Variants | Complexity tuple `(newRules, newTunableThresholds, modifiedBaselineRules, mechanismFamiliesUsed)` |
| --- | --- | ---: | --- |
| `R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH` | `CROSS_SECTIONAL_RELATIVE_STRENGTH` | 1 | `(6, 0, 0, 1)` |
| `R6-H20-STRUCTURAL-TREND-CONTINUATION` | `STRUCTURAL_TREND_CONTINUATION` | 1 | `(8, 0, 0, 1)` |
| `R6-H21-ECONOMIC-RANGE-IMPULSE` | `ECONOMIC_RANGE_IMPULSE` | 1 | `(5, 2, 0, 1)` |
| `R6-H22-PREDECLARED-REGIME-ROUTING` | `PREDECLARED_REGIME_ROUTING` | 1 | `(7, 0, 0, 1)` |

No combination, route-to-another-candidate, optimizer, grid, sweep, or
post-result variant is allowed. The complexity tuple is frozen before any
performance and cannot be adjusted after it.

## H19 — cross-sectional relative strength

At each 4H UTC block boundary (`current 1H openTime mod 4h == 0`), require one
valid, synchronized, fully closed 1H decision candle for every approved
symbol. For each symbol `s`, compute:

```text
return_s = close_s(t) / close_s(t - 24 closed 1H candles) - 1
```

Rank the five values descending by return and then ascending by symbol. The
first symbol is the long leader; the last symbol is the short laggard. This
tie rule always produces a deterministic distinct pair. Exactly two signals
may be emitted at a timestamp: one long leader and one short laggard. Missing
or unsynchronized symbols are `DATA_INCOMPLETE`.

This is a cross-sectional signal, not baseline-001 Top-N, not BTC alignment,
not a single-symbol filter, and not a combination. Stop is the signal candle
opposite extreme; TP is exactly 2R; maximum holding is 24 held candles.

## H20 — structural trend continuation

Use exactly the latest three fully closed 4H candles for structure and the
latest four fully closed 1H candles for the continuation event. A long trend
requires strictly increasing highs and lows across all three 4H candles. A
short trend requires strictly decreasing highs and lows. For long, the two
middle 1H candles must have non-increasing closes and lows above the oldest
4H structural low. For short, they must have non-decreasing closes and highs
below the oldest 4H structural high. The current 1H candle confirms long by
closing above both retracement highs while bullish, or confirms short by
closing below both retracement lows while bearish.

The stop is the corresponding two-candle retracement extreme; TP is exactly
2R; maximum holding is 24 held candles.

This is materially different from retired H8: it does not use EMA20/EMA50
touches, a t-1/t-2 pullback filter, baseline-001 predicates, or an H8 buffer.
It is also different from R5-H15: it does not use EMA20/EMA50, a 20-candle
breakout window, or a higher-timeframe breakout. If this predicate collapses
to H8 or H15 under semantic review, H20 must be marked `PROTOCOL_REJECTED`
and no replacement is permitted in this B.1A stage.

## H21 — economic range impulse

H21 has exactly one unified event, not a “range OR impulse” choice. For the
fully closed decision 1H candle, compute:

```text
rangeFraction = (high - low) / open
roundTripCostRate = 2 * feeRate + 2 * slippageRate
minimumRangeFraction = 8 * roundTripCostRate
```

With unchanged `bt-policy-003`, `roundTripCostRate` is 0.002 and the frozen
minimum is 0.016. The direction is LONG when `close > open`, SHORT when
`close < open`, and equal open/close is no signal. The same candle must also
place its close in the directional 75% of its range: `(close-low)/range >=
0.75` for long or `(high-close)/range >= 0.75` for short. These conditions are
one conjunction and one signal identity.

H21 does not use prior compression, compression-to-expansion, H18 predicates,
H18 breakout predicates, H18-derived thresholds, or H18 plus an economic
filter. Move-to-cost is frozen before performance as part of the event thesis,
not an after-the-fact rescue filter. Stop is the signal candle opposite
extreme; TP is exactly 2R; maximum holding is 24 held candles.

## H22 — predeclared regime routing

H22 is one standalone architecture and never routes among H19, H20, or H21.
Classify the latest three fully closed 4H candles:

- `UP_REGIME`: all three closes are strictly greater than their opens;
- `DOWN_REGIME`: all three closes are strictly less than their opens;
- `BALANCED`: complete data exists but the two strict rules do not hold;
- `INACTIVE`: required data is missing, which is surfaced as `DATA_INCOMPLETE`.

The only route is an internal directional-continuation specialization:
`UP_REGIME` permits a long current 1H close above the prior 1H high and above
its open; `DOWN_REGIME` permits the mirrored short event. `BALANCED` is an
explicit no-trade route. No route value names or invokes another Round-006
hypothesis. Equal open/close and mixed directions resolve to BALANCED, never
to a different candidate. Stop is the signal candle opposite extreme; TP is
exactly 2R; maximum holding is 24 held candles.

If a future implementation cannot retain this as one predeclared internal
route map without becoming a meta-selector, H22 must be
`PROTOCOL_REJECTED`; no replacement hypothesis may be invented in B.1A.

## Data, future-data, and economics contract

Every required candle has the existing `Candle` fields: symbol, timeframe,
openTime, closeTime, open, high, low, close, volume, quoteVolume, tradeCount,
takerBuyBaseVolume, and takerBuyQuoteVolume. Timestamps are UTC milliseconds.
The required input is limited to the approved 1H/4H closed-candle datasets and
existing settlement data; no new market data is fetched in B.1A.

The evaluator first limits its view to candles with `closeTime <= signalTime`,
requires chronological order and valid OHLC relationships, and fails closed
when a required window is absent or invalid. It never reads the future entry
candle, held candles, exit candle, future funding, or outcome data while
forming a signal. The entry resolver is a separate operation and only finds
the first legal 1H open strictly after the already-formed signal.

## Gate inheritance and performance lock

Future B.1B Gates must be no weaker than the accepted Round-005 Gate and must
preserve these gate identities: `minimumAggregateImprovement`,
`minimumImprovedValidationFolds`, `catastrophicFoldLimit`,
`minimumNetExpectancy`, `minimumProfitFactor`, `maximumSymbolConcentration`,
`maximumSingleTradeConcentration`, `maximumFeeBurdenRatio`,
`minimumFormalSignals`, and `minimumExecutedTrades`. B.1A creates no numeric
Gate record and no Gate SHA; it also creates no Plan SHA.

The future lock is exactly:

```text
FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED
```

Before the lock, a result-affecting protocol change requires a newly reviewed
protocol/Gate/Plan. After the lock, changes to formulas, thresholds, route
map, timing, entry, stop, TP, exit, holding, economics, folds, or sample
requirements require `ROUND_006_INVALIDATION_REQUIRED`; there is no same-round
patch-and-rerun.

## Governance

`baseline-002 = NOT_FROZEN`  
`M3-R6-B.1B = NOT_STARTED / PENDING_ACCEPTANCE`  
`M3-J = BLOCKED`  
`M4 = NOT_STARTED`

