# Baseline-002 Round-011 research protocol

Round-011 (`baseline-002-research-round-011`) is a strict replay of the
accepted Round-010 design after correcting only the E2 event predicate and
period-end event retention. Round-010 is invalidated and diagnostic-only; no
Round-010 candidate outcome is used for tuning.

## Registry

1. `R11-R1-REGIME-EXPECTANCY-ROUTER` — fixed fold-local regime-cell routing
   from the baseline formal stream.
2. `R11-E1-PULLBACK-RECLAIM` — direct closed-candle EMA20/EMA50 interaction
   and reclaim from its own event stream.
3. `R11-E2-BREAKOUT-RETEST` — direct closed-candle breakout followed within
   three closed candles by the corrected two-sided retest/reclaim event.
4. `R11-S1-CALIBRATED-SCORE-V2` — the fixed ten-feature ridge model with
   lambda `10` and minimum predicted net R `0.05` on the pre-score stream.
5. `R11-C1-RECLAIM-CALIBRATED-SCORE-V2` — the same fixed model contract on
   the E1 stream, retaining the exact E1 settlement identity.

Exactly one qualitative variant is used for each candidate. No tuning, sweep,
optimizer, or result-derived candidate replacement is permitted.

## E2 event predicate

For a LONG event, with `level` and the breakout-candle `ATR14_1H`:

```text
lower = level - 0.25 * breakoutAtr
upper = level + 0.25 * breakoutAtr
retest = current.low >= lower AND current.low <= upper
reclaim = current.close > level
```

SHORT mirrors the band using `current.high` and requires
`current.close < level`. Both band boundaries are inclusive. The current
closed candle may be the reclaim candle, and the preceding candle's close is
not an input to the E2 predicate. Breakout distance is exactly one, two, or
three closed candles; distance four is expired.

## Period-end semantics

E1/E2 opportunities are generated through the exact frozen boundary
`2026-08-15T23:59:59.999Z`; no `candles.length - 24` truncation is used. If
the 24-candle holding horizon crosses a frozen period end, settlement returns
`PERIOD_END_CENSORED` with formal=true semantics, no executed trade, and null
executed metrics. This status is excluded from expectancy/PF and does not turn
complete evidence into `DATA_INCOMPLETE`.

## Risk, data, and lifecycle

The accepted risk geometry is unchanged: E1 uses the previous five closed
candles, E2 uses the breakout-through-reclaim path, both add/subtract `0.2
ATR`, accept inclusive `0.8 <= stopAtr <= 3.0`, and set TP at `2R` of the full
stop distance. C1 uses the exact E1 settlement outcome.

The validated public cache is reused only after provenance and integrity
checks. CONTROL, pre-score, E1, and corrected E2 dependencies are unioned and
declared before dataset freeze. No market fetch occurs after the performance
lock. CONTROL and all five candidates execute exactly once after the lock;
Gate, mechanical selection, and evidence publication follow without manual
edits.

`baseline-002` remains `NOT_FROZEN`, M3-J remains `BLOCKED`, M4 remains
`NOT_STARTED`, and TradePulse remains advisory-only.
