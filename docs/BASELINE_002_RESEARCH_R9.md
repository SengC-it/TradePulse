# Baseline-002 Round-009 research protocol

Round-009 (`baseline-002-research-round-009`) is one strict
spec-conformance replay. It evaluates exactly five one-variant candidates
plus the CONTROL stream over the frozen seen-data boundary
`2026-08-15T23:59:59.999Z`.

## Registry

1. `R9-R1-REGIME-EXPECTANCY-ROUTER` — fixed fold-local regime-cell routing
   from the baseline formal stream. Research-eligible cells are frozen before
   validation and validation cannot update them.
2. `R9-E1-PULLBACK-RECLAIM` — a direct closed-candle EMA20/EMA50 interaction
   followed by a closed reclaim under the declared trend context. It does not
   require membership in baseline formal signals.
3. `R9-E2-BREAKOUT-RETEST` — a direct closed-candle breakout followed by a
   closed retest/reclaim in a subsequent candle. It does not enter on the
   breakout candle and does not use CONTROL settlement.
4. `R9-S1-CALIBRATED-SCORE-V2` — the fixed ten-feature ridge model applied to
   the declared baseline pre-score opportunity stream.
5. `R9-C1-RECLAIM-CALIBRATED-SCORE-V2` — the same fixed model contract fitted
   on E1 research outcomes and applied to E1 validation opportunities.

Exactly one qualitative variant is used for each candidate. No combinations,
parameter sweep, optimizer, threshold search, or post-result replacement is
allowed. CONTROL is `R9-CONTROL-BASELINE-001`, uses `baseline-001` and
`bt-policy-003`, and executes exactly once after the dataset is frozen.

## Data and settlement

All decision-time features use fully closed public-market candles. The
existing five-symbol universe, six frozen research/validation folds, and
`bt-policy-003` settlement/economics are retained. The next canonical hourly
open is used only by settlement. Intrabar requirements are discovered from
the union of CONTROL, pre-score, E1, and E2 consumers before the dataset
freeze; all required windows are validated before the performance lock, with
no post-lock market fetch.

The R9 plan reuses the accepted Round-006 cache only after validating its
provenance and integrity. The cache is acquisition input, not a source for
result-driven tuning. A missing, malformed, undeclared, duplicate, or
incomplete data dependency fails closed.

## Model and evaluation

The model is deterministic fixed ridge arithmetic with ten frozen features,
lambda `10`, fold-local research-only standardization, and no validation
refit. The fixed feature identity includes
`direction * (close4h - EMA200_4h) / ATR14_4h`; router volatility is
`ATR14_1H / CLOSE1H`. Candidate-local streams and settlement are kept
separate as declared in the machine conformance record.

The frozen selection Gate is conjunctive and eligibility-first. It retains the
Round-006-style minimum improvement, fold, sample, expectancy, PF,
concentration, fee, and model-integrity requirements without weakening. The
inclusive expectancy tie band is scale-aware IEEE-754 compensation only:

```text
difference = maxExpectancy - candidateExpectancy
tolerance = Number.EPSILON * Math.max(
  1,
  Math.abs(maxExpectancy),
  Math.abs(candidateExpectancy),
  Math.abs(threshold),
)
inside iff difference - threshold <= tolerance
```

The exact Gate and Plan hashes are in
`docs/research/round-009-spec-conformance.json` and are generated from the
machine records, not from result values.

## Lifecycle and limits

The execution sequence is preflight, cache-backed acquisition/identity
validation, pre-lock intrabar dependency declaration, dataset freeze, one
performance lock, one CONTROL run, candidate evaluation, mechanical gate and
selection, then evidence publication. Performance is executed at most once;
failure after the lock is terminal and is never rerun. Evidence is complete
only when structural integrity is complete, independently of economic
PASS/FAIL.

`baseline-002` remains `NOT_FROZEN`, M3-J remains `BLOCKED`, M4 remains
`NOT_STARTED`, and TradePulse remains advisory-only with automatic trading
disabled.
