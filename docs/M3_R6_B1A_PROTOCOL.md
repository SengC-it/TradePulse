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
may use only fields available at that time. The required entry is the immediate
next canonical 1H candle: its `openTime` must equal `signalTime + 1ms`.
Missing immediate entry returns `ENTRY_UNAVAILABLE`; a malformed immediate
entry returns `DATA_INCOMPLETE`; a later candle is never used as a substitute.
Entry and settlement use unchanged `bt-policy-003` economics: 5 bps adverse
slippage per side, 5 bps fee per side, official funding with the frozen
mark-price fallback, conservative SL-first intrabar ordering, exactly 24 held
1H candles, and TIME_EXIT at the close of held candle #24. All missing or
invalid decision-time inputs fail closed as `DATA_INCOMPLETE`.

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

### Complexity counting rubric

The machine-readable rubric version is
`m3-r6-b1a-complexity-rubric-001`. Tuple dimensions are counted in this
order: `newRules`, `newTunableThresholds`, `modifiedBaselineRules`,
`mechanismFamiliesUsed`.

- `newRules` counts each named candidate-specific signal predicate,
  ordering/cadence rule, route rule, or candidate-specific stop reference
  exactly once. Shared data validation and `bt-policy-003` execution are not
  counted.
- `newTunableThresholds` counts only candidate-specific numeric comparison
  constants declared as research-adjustable thresholds.
- `modifiedBaselineRules` counts baseline-001 predicate or threshold changes.
- `mechanismFamiliesUsed` counts distinct mechanism-family identifiers.

Lookback lengths, bar-count windows, and cadence values are fixed structural
values, not tunable thresholds. Inherited stop/TP/holding values are common
policy and are not counted. Categorical tie/fallback rules are rules, not
numeric thresholds. Candidate-specific cost multiples, comparison values,
and close-location thresholds are tunable thresholds.

Under this rubric, H19 has six named rules and zero tunable thresholds; H20
has eight named rules and zero tunable thresholds; H21 has five named rules
and two tunable thresholds (`8` times round-trip cost and `0.75` close
location); H22 has seven named rules and zero tunable thresholds. Each has
zero modified baseline rules and one mechanism family, yielding exactly the
tuples in the registry. The rubric and candidate rule lists are part of the
machine-readable protocol record and cannot be reinterpreted after the
`FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED` lock.

## H19 — cross-sectional relative strength

At each UTC 4H block, use the first fully closed 1H candle whose `openTime`
belongs to that block (`current 1H openTime mod 4h == 0`). Select exactly the
latest 25 closed 1H candles by `openTime` for each approved symbol, then
validate that required window. Require one valid, synchronized, fully closed
1H decision candle for every approved symbol. For each symbol `s`, compute:

```text
return_s = close_s(t) / close_s(t - 24 closed 1H candles) - 1
```

The leader is `argmax(return_s, tie=symbol_ASC)`. The laggard is
`argmin(return_s, tie=symbol_DESC)`. Thus the lexicographically smallest
symbol wins a tied maximum and the lexicographically largest symbol wins a
tied minimum. Exactly two signals may be emitted at a timestamp: one long
leader and one short laggard. Missing or unsynchronized symbols are
`DATA_INCOMPLETE`.

This is a cross-sectional signal, not baseline-001 Top-N, not BTC alignment,
not a single-symbol filter, and not a combination. Stop is the signal candle
opposite extreme; TP is exactly 2R; maximum holding is 24 held candles.

## H20 — structural trend continuation

Select exactly the latest three fully closed 4H candles by `openTime` for
structure and exactly the latest four fully closed 1H candles by `openTime` for
the continuation event. The latest
structural 4H candle must be fully closed before the first 1H event candle
begins:

```text
latestStructural4h.closeTime < h20EventWindowFirst1h.openTime
```

A long trend
requires strictly increasing highs and lows across all three 4H candles. A
short trend requires strictly decreasing highs and lows. For long, the two
middle 1H candles must have non-increasing closes and lows above the oldest
4H structural low. For short, they must have non-decreasing closes and highs
below the oldest 4H structural high. The current 1H candle confirms long by
closing above both retracement highs while bullish, or confirms short by
closing below both retracement lows while bearish.

If the structural/event non-overlap invariant fails, H20 returns the frozen
non-signal status `NO_SIGNAL` with reason `H20_STRUCTURAL_EVENT_OVERLAP`. The
stop is the corresponding two-candle retracement extreme; TP is exactly 2R;
maximum holding is 24 held candles.

This is materially different from retired H8: it does not use EMA20/EMA50
touches, a t-1/t-2 pullback filter, baseline-001 predicates, or an H8 buffer.
It is also different from R5-H15: it does not use EMA20/EMA50, a 20-candle
breakout window, or a higher-timeframe breakout. If this predicate collapses
to H8 or H15 under semantic review, H20 must be marked `PROTOCOL_REJECTED`
and no replacement is permitted in this B.1A stage.

## H21 — economic range impulse

H21 has exactly one unified event, not a “range OR impulse” choice. Select
exactly the current closed 1H decision candle and compute:

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
Select exactly the latest two closed 1H candles and latest three closed 4H
candles by `openTime`. Classify the three 4H candles:

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
For 1H candles, `closeTime = openTime + 1h - 1ms` and `openTime` is aligned to
the UTC hour. For 4H candles, `closeTime = openTime + 4h - 1ms` and `openTime`
is aligned to the UTC 4H grid. Every declared field is validated: prices are
finite and positive, volume-like fields are finite and non-negative,
`tradeCount` is a finite non-negative integer, and OHLC relationships are
valid. Required windows are strictly contiguous, with no duplicate or
irregular timestamps. H19 additionally requires identical 25-candle
open/close timestamp windows for all five symbols. Each evaluator selects its
exact latest required window by `openTime` before validation; older candles
outside that window are ignored and cannot change the result. The required
input is limited to the approved 1H/4H closed-candle datasets and existing
settlement data; no new market data is fetched in B.1A.

The evaluator first selects the exact candidate-required window from candles
closed by `signalTime`, ordered by `openTime`; it then requires canonical
timestamps, contiguous windows, synchronized H19 windows, and valid declared
fields, and fails closed when that window is absent or invalid. Older prefix
records outside the required window do not affect the result. It never reads
the future entry candle, held candles, exit candle, future funding, or outcome
data while forming a signal. The entry resolver is a separate operation and
requires the immediate next canonical 1H open exactly at `signalTime + 1ms`.

## Entry, stop, and target geometry

After the first legal 1H open, `bt-policy-003` applies adverse slippage to
produce `actualEntryFill`:

```text
LONG:  actualEntryFill = rawEntryPrice * (1 + slippageRate)
SHORT: actualEntryFill = rawEntryPrice * (1 - slippageRate)
```

The stop reference is never moved or clamped. It must remain protective after
the actual fill:

```text
LONG:  stopReferencePrice < actualEntryFill
SHORT: stopReferencePrice > actualEntryFill
```

If equality or a gap violates this invariant, the formal signal remains
available for audit but execution is not performed and returns
`INVALID_STOP_GEOMETRY` with reason `STOP_NOT_PROTECTIVE_AFTER_SLIPPAGE`.
There is no stop rescue and no zero/negative-R trade. For valid geometry:

```text
LONG:  R = actualEntryFill - stopReferencePrice
       TP = actualEntryFill + 2 * R
SHORT: R = stopReferencePrice - actualEntryFill
       TP = actualEntryFill - 2 * R
```

`R` must be strictly positive. Invalid numeric input fails closed as
`DATA_INCOMPLETE`.

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
