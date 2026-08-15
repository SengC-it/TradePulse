# TradePulse Strategy Specification

Status: M0 specification only; no strategy execution code exists yet.
Proposed version: `baseline-001`
All formulas use candles that are fully closed at evaluation time.

## Fixed research universe

Only these Binance USDⓈ-M Futures symbols are in scope:

`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`

Adding a symbol is a Strategy Change and requires human approval plus a new audited version when the behavior changes.

## Timeframes and candle indexing

- 4H candles determine trend regime.
- 1H candles determine candidate signals.
- Let `C_t` be the current fully closed 1H signal candle.
- The prior-five window is `W_t = {C_(t-5), C_(t-4), C_(t-3), C_(t-2), C_(t-1)}`.
- The recent-three breakout window is `B_t = {C_(t-3), C_(t-2), C_(t-1)}`.
- A forming candle is never used for a formal signal, stop, score, or notification.
- All indicator values used for `C_t` are calculated from data ending at `C_t` and are timestamped to that candle.

The exact exchange close-time tolerance and missing-candle policy are an M1 Market Data decision; they must be approved before formal scanning.

## Allowed indicators

Only the following are permitted in `baseline-001`:

- `EMA20`
- `EMA50`
- `EMA200`
- `RSI14`
- `ATR14`
- approved volume-derived calculations

MACD, Bollinger Bands, Stochastic, AI price prediction, machine learning, LLM judgment, news sentiment, grid, martingale, and other unapproved indicators are out of scope.

## 4H symbol market regime

Evaluate each symbol on the most recent fully closed 4H candle.

### `LONG_ONLY`

All three conditions must be true:

```text
Close_4H > EMA200_4H
EMA50_4H > EMA200_4H
EMA200_4H_now > EMA200_4H_5bars_ago
```

### `SHORT_ONLY`

All three conditions must be true:

```text
Close_4H < EMA200_4H
EMA50_4H < EMA200_4H
EMA200_4H_now < EMA200_4H_5bars_ago
```

### `NO_TRADE`

If neither complete set is true, the symbol regime is `NO_TRADE` and no directional candidate is eligible.

## 1H LONG candidate

A LONG candidate requires every condition below:

1. The symbol's 4H regime is `LONG_ONLY`.
2. At least one candle `C_i` in `W_t` satisfies:

   ```text
   Low_i <= EMA20_i OR Low_i <= EMA50_i
   ```

3. The current closed candle breaks above every high in `B_t`:

   ```text
   Close_t > max(High_(t-3), High_(t-2), High_(t-1))
   ```

4. The current closed candle RSI is strictly inside the allowed interval:

   ```text
   50 < RSI14_t < 70
   ```

5. The approved BTC market-regime filter permits a LONG candidate. That filter is currently `OPEN_DECISION` and therefore cannot be treated as silently enabled in production.

## 1H SHORT candidate

A SHORT candidate requires every condition below:

1. The symbol's 4H regime is `SHORT_ONLY`.
2. At least one candle `C_i` in `W_t` satisfies:

   ```text
   High_i >= EMA20_i OR High_i >= EMA50_i
   ```

3. The current closed candle breaks below every low in `B_t`:

   ```text
   Close_t < min(Low_(t-3), Low_(t-2), Low_(t-1))
   ```

4. The current closed candle RSI is strictly inside the mirrored interval:

   ```text
   30 < RSI14_t < 50
   ```

5. The approved BTC market-regime filter permits a SHORT candidate. That filter is currently `OPEN_DECISION` and therefore cannot be treated as silently enabled in production.

The short rules above are the complete mirror of the long pullback, breakout, and RSI rules; there is no implicit “similar” step.

## Reference values and risk

The following formulas are the proposed baseline shape. The candle-window and entry definition decisions below must be approved before a version is made active.

Let `E` be `entry_reference` and `A` be `ATR14_t`.

```text
LONG stop_reference = min(Low_i for C_i in W_t) - 0.2 * A
SHORT stop_reference = max(High_i for C_i in W_t) + 0.2 * A
stop_distance = abs(E - stop_reference)
stop_distance_percent = stop_distance / E * 100
LONG take_profit_reference = E + 2 * stop_distance
SHORT take_profit_reference = E - 2 * stop_distance
risk_reward_ratio = 1:2
```

These are reference values only. They never create, modify, or represent a real order.

## Score and grade

Every candidate has a total score from 0 to 100:

| Component | Maximum |
| --- | ---: |
| Trend Strength | 40 |
| Pullback Quality | 20 |
| Breakout Strength | 20 |
| Volume | 10 |
| Risk / Reward | 10 |
| **Total** | **100** |

Grades are deterministic ranges:

- A: `85–100`, high-priority alert.
- B: `75–84`, normal alert.
- C: `70–74`, low-priority alert.
- Below `70`: no formal alert; retain internal scan statistics.

The sub-score formulas and the approved volume calculation are not yet specified, so no score can be calculated in M0 without inventing a parameter.

## BTC market regime

The system must eventually expose exactly these states:

- `BTC_STRONG_BULL`
- `BTC_NEUTRAL`
- `BTC_STRONG_BEAR`

The current requirements do not define the quantitative thresholds, lookback, timeframe combination, or whether a neutral BTC regime blocks, downgrades, or permits a symbol candidate. This is an `OPEN_DECISION`.

Recommended decision to review: use a separate, deterministic 4H BTC regime rule with explicit EMA slope/position thresholds and a table that maps each BTC state to LONG/SHORT eligibility. Do not implement or freeze that recommendation without approval.

## Signal snapshot and idempotency

Every formal signal must persist at least:

```text
strategy_version
symbol
direction
signal_time
signal_candle_time
entry_reference
stop_reference
take_profit_reference
score
grade
indicators
market_regime
trigger_reason
```

The database uniqueness key is:

```text
(strategy_version, symbol, direction, signal_candle_time)
```

The same tuple cannot produce a second signal or a second email notification.

## Forward tracking

The future tracker observes public market data after a signal is persisted. It can finish in `TP`, `SL`, `TIME_EXIT`, or `INVALIDATED`; it remains `OPEN` until a terminal condition is reached.

The baseline time window is 24 subsequent fully closed 1H candles. If neither TP nor SL has occurred and the result has not reached `+0.5R` by the end of that window, the proposed status is `TIME_EXIT`.

The exact `TIME_EXIT` exit price is an `OPEN_DECISION`. Recommendation: use the close of the 24th subsequent completed candle and record the rule version in the result snapshot. Same-candle TP/SL ordering and the complete invalidation condition are also `OPEN_DECISION`s and must be resolved before M6.

## Open decisions before activation

1. Quantitative BTC regime definitions and gating behavior.
2. Whether `entry_reference` is the signal candle close, next candle open, or another approved reference.
3. Whether the five-candle stop window is exactly `W_t` or includes the current signal candle.
4. Sub-score formulas for all five score components and volume calculation.
5. Exact invalidation condition for each direction.
6. TIME_EXIT price and event ordering when a candle could touch both TP and SL.
7. Data gap tolerance and exchange close-time tolerance.
8. Notification policy for C grade; M0's conservative default is disabled.

No implementation may hide these choices behind a default and call the resulting behavior `baseline-001` active without human confirmation.
