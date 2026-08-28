# Baseline-002 Round-010 research protocol

Round-010 (`baseline-002-research-round-010`) is one strict risk-geometry
spec-conformance replay. It retains the Round-009 five-candidate registry,
the five-symbol universe, six frozen folds, seen-data boundary
`2026-08-15T23:59:59.999Z`, `baseline-001`, `bt-policy-003`, all existing
features, thresholds, fees, slippage, funding, and Gate/selection semantics.
It does not tune, sweep, optimize, or use Round-009 outcomes.

## Registry

1. `R10-R1-REGIME-EXPECTANCY-ROUTER` — fixed fold-local regime-cell routing
   from the baseline formal stream.
2. `R10-E1-PULLBACK-RECLAIM` — direct closed-candle EMA20/EMA50 interaction
   and reclaim with the corrected previous-five structural stop.
3. `R10-E2-BREAKOUT-RETEST` — direct closed-candle breakout followed by a
   closed retest/reclaim with the corrected breakout-through-reclaim stop.
4. `R10-S1-CALIBRATED-SCORE-V2` — the fixed ten-feature ridge model with
   lambda `10` and minimum predicted net R `0.05` on the declared pre-score
   stream.
5. `R10-C1-RECLAIM-CALIBRATED-SCORE-V2` — the same fixed model contract on
   the E1 stream, retaining the exact E1 settlement identity.

Exactly one qualitative variant is used for each candidate. No combinations
beyond the predeclared C1 composition are introduced.

## Risk geometry

The decision reference is known only after the closed decision candle. The
next canonical 1h open remains the theoretical execution entry under
`bt-policy-003`; it is never used to decide whether a signal exists.

- E1 LONG stop: minimum LOW of the previous five fully closed 1h candles
  before the decision, minus `0.2 * ATR14_1h(decision)`.
- E1 SHORT stop: maximum HIGH of those five candles plus the same buffer.
- E2 LONG stop: minimum LOW from breakout through reclaim, inclusive, minus
  the buffer.
- E2 SHORT stop: maximum HIGH from breakout through reclaim, inclusive, plus
  the buffer.
- Both require inclusive `0.8 <= stopDistance / ATR14_1h <= 3.0`.
- TP is exactly `2 * full stopDistance` from the decision-time entry
  reference. The `0.2 ATR` value is only the structural buffer.
- C1 filters E1 records and uses the exact E1 settlement outcome; it does not
  reconstruct stop or TP.

These rules are encoded in `R10_RISK_GEOMETRY_CONTRACT`, included in the
machine Gate/Plan records, and checked by executable deterministic
conformance helpers before the performance lock.

## Data, lifecycle, and boundaries

The accepted Round-006 cache may be reused only after identity, checksum,
range, schema, and closed-candle validation. Round-010 recomputes the union
of CONTROL, pre-score, E1, and E2 intrabar dependencies from the corrected
intents before dataset freeze. Missing or malformed data fails closed; no
post-lock fetch is permitted.

The lifecycle is offline conformance, preflight, cache-backed acquisition,
dependency declaration, validation, dataset freeze, one performance lock,
one CONTROL run, one run of each candidate, mechanical Gate/selection, and
evidence publication. `baseline-002` remains `NOT_FROZEN`, M3-J remains
`BLOCKED`, M4 remains `NOT_STARTED`, and TradePulse remains advisory-only.
