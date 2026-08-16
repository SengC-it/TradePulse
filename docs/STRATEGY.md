# TradePulse Strategy Specification

Status: M2-A specification freeze; no Strategy Engine implementation exists yet.
Frozen strategy version: baseline-001

All formulas below use only fully closed candles. This document freezes the
baseline-001 behavior for the future M2 Strategy Engine. It does not add
indicators, runtime code, persistence, Cron, notifications, or trading.

## Fixed research universe

Only these Binance USDⓈ-M Futures symbols are in scope:

BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT

Adding a symbol is a Strategy Change and requires human approval plus a new
audited strategy version.

## Timeframes and candle indexing

- 4H candles determine the symbol regime and BTC regime.
- 1H candles determine candidate signals and 1H risk references.
- C_t is the current fully closed 1H signal candle.
- W_t = {C_(t-5), C_(t-4), C_(t-3), C_(t-2), C_(t-1)} is the prior-five
  window.
- B_t = {C_(t-3), C_(t-2), C_(t-1)} is the prior-three breakout window.
- A forming candle is never used for an indicator, formal candidate, stop,
  score, reference value, or notification.
- The M1 MarketDataProvider supplies normalized, closed-candle inputs and
  owns the approved gap, completeness, ordering, and freshness policy.

## Indicator formulas

Only EMA20, EMA50, EMA200, RSI14, ATR14, and the approved quote-volume
calculation are permitted in baseline-001. MACD, Bollinger Bands, Stochastic,
machine learning, LLM judgment, news sentiment, grid, martingale, and other
unapproved indicators are out of scope.

### EMA20, EMA50, and EMA200

Each EMA uses the standard formula for period p:

    alpha = 2 / (p + 1)
    EMA_t = alpha * value_t + (1 - alpha) * EMA_(t-1)

The first EMA value is seeded with the SMA of the first p fully closed values.
Subsequent values use the recurrence above. No forming candle may be included
in the seed or any subsequent EMA value.

### RSI14

RSI14 uses Wilder RSI:

1. For each closed-candle delta, gain = max(delta, 0) and loss = max(-delta, 0).
2. The initial average gain and average loss are the SMA of the first 14
   deltas.
3. Subsequent averages use Wilder smoothing:

       average = (previous_average * 13 + current_value) / 14

4. If average loss = 0 and average gain > 0, RSI = 100.
5. If average gain = 0 and average loss > 0, RSI = 0.
6. If both averages are 0, RSI = 50.

Only fully closed candles are inputs.

### ATR14

For each closed candle, true range is:

    max(
      high - low,
      abs(high - previousClose),
      abs(low - previousClose)
    )

The first true range may use high - low when there is no previous close. The
initial ATR is the SMA of the first 14 true-range values. Subsequent ATR values
use Wilder smoothing:

    ATR_t = (ATR_(t-1) * 13 + TR_t) / 14

No forming candle may be used.

## Indicator availability and fail-closed policy

Every required indicator and reference value must exist and be finite before a
baseline-001 evaluation can qualify a candidate.

### ATR denominators

Any ATR used as a denominator must satisfy:

    ATR14 > 0

If required ATR14_1H or ATR14_4H is missing, undefined, NaN, infinite, or
less than or equal to 0, the affected strategy evaluation is INELIGIBLE.

The engine must not calculate BTC normalized regime thresholds, normalized
Trend Strength values, breakoutDistance, or stop_atr with an invalid ATR
denominator. It must not substitute Infinity, zero, epsilon, or any other
fallback.

### Volume denominator

The volume denominator is:

    previous20QuoteVolumeMean

It must be finite and greater than 0. If fewer than 20 prior fully closed 1H
candles are available, the mean is missing or non-finite, or the mean is less
than or equal to 0, the candidate is INELIGIBLE.

The engine must not substitute zero, Infinity, epsilon, or any other fallback
for the volume denominator.

### Indicator warm-up

If any indicator required by baseline-001 is unavailable because there is
insufficient fully closed-candle history, the Strategy Engine fails closed:
the candidate is ineligible and there is NO FORMAL SIGNAL.

Indicator functions may represent pre-warm-up EMA, RSI, or ATR values as
unavailable according to the implementation contract. Unavailable values must
never qualify a candidate or produce a score. The engine must not extrapolate,
shorten the period, change the seed, or silently use a fallback indicator.

### BTC dependency

For non-BTC symbols, missing or invalid required BTCUSDT 4H inputs or BTC
regime indicators block the candidate. Invalid BTC regime input must not be
silently treated as BTC_NEUTRAL.

BTC_NEUTRAL is valid only when it has been computed from valid BTC inputs.

This policy preserves the project principle: No Data > Bad Signal.

## 4H symbol market regime

Evaluate each symbol using the most recent fully closed 4H candle.

### LONG_ONLY

All three conditions must be true:

    Close > EMA200
    EMA50 > EMA200
    EMA200_now > EMA200_5bars_ago

### SHORT_ONLY

All three conditions must be true:

    Close < EMA200
    EMA50 < EMA200
    EMA200_now < EMA200_5bars_ago

### NO_TRADE

If neither complete set is true, the symbol regime is NO_TRADE and no
directional candidate is eligible.

## BTC regime

The BTC regime uses BTCUSDT 4H only and is an eligibility gate. It does not
add to or subtract from a candidate score.

### BTC_STRONG_BULL

All conditions must be true:

    Close > EMA50 > EMA200
    (Close - EMA200) / ATR14 >= 1.0
    (EMA50 - EMA200) / ATR14 >= 0.5
    (EMA200_now - EMA200_5bars_ago) / ATR14 >= 0.10

### BTC_STRONG_BEAR

The exact directional mirror must be true:

    Close < EMA50 < EMA200
    (EMA200 - Close) / ATR14 >= 1.0
    (EMA200 - EMA50) / ATR14 >= 0.5
    (EMA200_5bars_ago - EMA200_now) / ATR14 >= 0.10

Otherwise the BTC regime is BTC_NEUTRAL.

For ETHUSDT, SOLUSDT, XRPUSDT, and BNBUSDT:

| BTC regime | LONG | SHORT |
| --- | --- | --- |
| BTC_STRONG_BULL | Permitted according to symbol rules | Blocked |
| BTC_STRONG_BEAR | Blocked | Permitted according to symbol rules |
| BTC_NEUTRAL | Permitted according to symbol rules | Permitted according to symbol rules |

BTCUSDT does not apply BTC cross-symbol gating to itself. BTCUSDT uses its own
4H symbol regime and candidate rules.

## 1H candidate rules

### LONG candidate

Every condition below is required:

1. The symbol 4H regime is LONG_ONLY.
2. At least one candle in W_t touches EMA20 or EMA50 using a LOW touch:
   Low_i <= EMA20_i or Low_i <= EMA50_i.
3. The current closed candle closes above all prior-three highs:
   Close_t > max(High_(t-3), High_(t-2), High_(t-1)).
4. The current closed candle has strict RSI14 bounds:
   50 < RSI14_t < 70.
5. The BTC gate permits LONG, except that BTCUSDT does not apply a
   cross-symbol BTC gate to itself.

### SHORT candidate

The exact directional mirror is required:

1. The symbol 4H regime is SHORT_ONLY.
2. At least one candle in W_t touches EMA20 or EMA50 using a HIGH touch:
   High_i >= EMA20_i or High_i >= EMA50_i.
3. The current closed candle closes below all prior-three lows:
   Close_t < min(Low_(t-3), Low_(t-2), Low_(t-1)).
4. The current closed candle has strict RSI14 bounds:
   30 < RSI14_t < 50.
5. The BTC gate permits SHORT, except that BTCUSDT does not apply a
   cross-symbol BTC gate to itself.

A non-positive breakout distance is not a candidate.

## Entry, stop, and take-profit references

These values are research references only. They are never execution prices,
orders, or promises of profit.

    entry_reference = Close_t

The stop window is exactly W_t and never includes the current breakout candle.
ATR14_1H means the ATR14 value for the current closed 1H signal candle.

For LONG:

    stop_reference = min(prior-five lows) - 0.2 * ATR14_1H

For SHORT:

    stop_reference = max(prior-five highs) + 0.2 * ATR14_1H

For both directions:

    stop_distance = abs(entry_reference - stop_reference)
    stop_atr = stop_distance / ATR14_1H

A candidate is ineligible when stop_atr < 0.8 or stop_atr > 3.0. The inclusive
risk range is 0.8 <= stop_atr <= 3.0.

For LONG:

    take_profit_reference = entry_reference + 2 * stop_distance

For SHORT:

    take_profit_reference = entry_reference - 2 * stop_distance

Risk/reward is fixed at exactly 2.0R.

## Score = 100

Every eligible candidate has five components:

| Component | Maximum |
| --- | ---: |
| Trend Strength | 40 |
| Pullback Quality | 20 |
| Breakout Strength | 20 |
| Volume | 10 |
| Risk Structure / RR | 10 |
| Total | 100 |

The total is the sum of the five component values. A component threshold uses
the highest applicable score in its section.

### Trend Strength / 40

For LONG:

    closeDistance = (Close4H - EMA200_4H) / ATR14_4H
    emaSpread = (EMA50_4H - EMA200_4H) / ATR14_4H
    emaSlope = (EMA200_now - EMA200_5bars_ago) / ATR14_4H

For SHORT, use the exact mirrored positive distances:

    closeDistance = (EMA200_4H - Close4H) / ATR14_4H
    emaSpread = (EMA200_4H - EMA50_4H) / ATR14_4H
    emaSlope = (EMA200_5bars_ago - EMA200_now) / ATR14_4H

Close distance, worth 15 points:

| Normalized distance | Score |
| --- | ---: |
| >= 1.5 ATR | 15 |
| >= 1.0 ATR | 12 |
| >= 0.5 ATR | 8 |
| > 0 | 4 |

EMA50/EMA200 spread, worth 15 points:

| Normalized spread | Score |
| --- | ---: |
| >= 0.75 ATR | 15 |
| >= 0.50 ATR | 12 |
| >= 0.25 ATR | 8 |
| > 0 | 4 |

EMA200 five-bar slope, worth 10 points:

| Normalized slope | Score |
| --- | ---: |
| >= 0.20 ATR | 10 |
| >= 0.10 ATR | 8 |
| >= 0.05 ATR | 5 |
| > 0 | 2 |

### Pullback Quality / 20

Evaluate W_t. Use LOW touches for LONG and HIGH touches for SHORT. A touch is
the candidate-direction touch defined in the candidate rules.

Depth is the highest applicable value:

- EMA20 touched: 10 points.
- EMA50 touched: 15 points.

Add a recency bonus based on the most recent qualifying touch:

- t-1 or t-2: +5.
- t-3: +3.
- t-4 or t-5: +1.

The maximum is 20 points.

### Breakout Strength / 20

For LONG:

    breakoutDistance = (Close_t - max(previous 3 highs)) / ATR14_1H

For SHORT:

    breakoutDistance = (min(previous 3 lows) - Close_t) / ATR14_1H

The score is:

| Breakout distance | Score |
| --- | ---: |
| 0 < distance < 0.10 ATR | 10 |
| >= 0.10 ATR | 14 |
| >= 0.25 ATR | 17 |
| >= 0.50 ATR | 20 |

A distance <= 0 is not a candidate.

### Volume / 10

Use 1H quoteVolume:

    volumeRatio =
      current signal candle quoteVolume
      / mean(previous 20 fully closed candle quoteVolume)

The current signal candle is excluded from the 20-candle mean.

| volumeRatio | Score |
| --- | ---: |
| < 1.00 | 0 |
| >= 1.00 | 4 |
| >= 1.20 | 7 |
| >= 1.50 | 10 |

### Risk Structure / RR / 10

The risk guard is applied before this score:

    0.8 <= stop_atr <= 3.0

| stop_atr | Score |
| --- | ---: |
| 1.0 <= stop_atr <= 2.0 | 10 |
| 0.8 <= stop_atr < 1.0, or 2.0 < stop_atr <= 2.5 | 7 |
| 2.5 < stop_atr <= 3.0 | 4 |

Risk/reward remains fixed at 2R.

## Grade and formal-signal eligibility

Grades are deterministic:

- A: 85–100.
- B: 75–84.
- C: 70–74.
- Below 70: NO FORMAL SIGNAL.

A below-70 candidate may remain visible in internal candidate statistics in a
later milestone. Notification delivery is deferred to M5.

## Deterministic ranking

Eligible candidates are ranked by:

1. Total score descending.
2. Fixed research-universe order:
   BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT.

There is no random ordering, LLM judgment, or AI ranking.

## M2 Strategy Engine boundary

The future M2 Strategy Engine:

- is pure and framework-independent;
- receives normalized MarketDataProvider candles;
- uses exactly baseline-001;
- never imports Binance URLs or the Binance client;
- performs no database writes;
- performs no email sending;
- performs no HTTP requests;
- performs no trading;
- is shared later by realtime scanning and backtesting.

Every formal signal must preserve an immutable strategy snapshot and
strategy_version = baseline-001. A future behavior change requires a reviewed
Strategy Change and a new strategy version.

## Decisions deferred to M6

The following are explicitly marked DEFERRED_TO_M6 and must not be invented
during M2:

- TIME_EXIT execution/reference price;
- same-candle TP/SL ordering;
- forward-tracking invalidation event ordering.

These deferred decisions do not block M2 Strategy Engine implementation. The
M1 MarketDataProvider has already resolved the market-data gap, completeness,
ordering, and freshness policy.

## Scope stop

M2-A freezes this specification only. It does not implement indicators, the
Strategy Engine, database changes, Cron, notifications, dashboards, backtests,
or any trading capability.
