# Round-006 Profitability Rebuild Plan

This is one bounded historical research batch. It does not authorize
production changes, baseline-002 freezing, M3-J, or M4.

## Frozen boundary

- Research round: `baseline-002-research-round-006`
- Freeze source: `009b0c2aa11d7f8b387c130f8172ec60e9efa333`
- Seen-data boundary: `2026-08-15T23:59:59.999Z`
- Classification: `RESEARCH_AVAILABLE_SEEN_DATA`
- Universe: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- Policy: `bt-policy-003` (unchanged)
- Folds: the frozen F1–F6 research/validation registry
- Gate SHA-256: `a56ebfa2702ded5d9de0996d3d26b4d2251326e5623e3b37c69f7190e752b871`
- Plan SHA-256: `2619723e98e3ffa083a1833454c838993263d0e7066527abaa373d2e373ef7d9`

The machine-readable registry contains exactly one variant for each of these
12 predeclared candidates:

- A: `R6-A1-COOLDOWN-12H`, `R6-A2-COOLDOWN-24H`, `R6-A3-COOLDOWN-48H`
- B: `R6-B1-TOP1-SCORE`, `R6-B2-TOP2-SCORE`,
  `R6-B3-TOP1-RELATIVE-STRENGTH`, `R6-B4-TOP2-RELATIVE-STRENGTH`
- C: `R6-C1-TREND-FRESHNESS`, `R6-C2-FRESHNESS-TOP1-SCORE`
- D: `R6-D1-BREAKOUT-QUALITY`, `R6-D2-PULLBACK-BREAKOUT-QUALITY`,
  `R6-D3-PULLBACK-BREAKOUT-TOP1`

Only C2 and D3 are predeclared dual confirmations. No other combinations,
optimizer, sweep, score reweighting, tuning, or post-result replacement is
permitted.

## Candidate rules

- A retains the first chronological baseline formal signal and suppresses a
  later same-symbol/same-direction signal unless elapsed time is strictly
  greater than 12h, 24h, or 48h.
- B retains TOP-1 or TOP-2 per identical decision timestamp, using existing
  totalScore or direction-adjusted closed-data relative strength. Relative
  strength uses 4h, 12h, and 24h prior closed horizons and deterministic rank.
- C requires closed 1h EMA20 versus EMA50 and the predeclared three-candle
  EMA20 slope, with C2 applying the predeclared score TOP-1 after freshness.
- D maps the existing closed-data breakout scoring tier to `>=0.25 ATR` and
  uses inclusive pullback quality `>=18`; D3 applies its predeclared TOP-1.

All candidate economics are derived from the single `bt-policy-003` CONTROL
settlement stream. No candidate changes entry, stop, take-profit, funding,
fees, slippage, time exit, or same-candle settlement semantics.

## Gate and selection

The CONTROL runs first. The inherited numeric gates require, among other
conditions, aggregate expectancy improvement `>= +0.10R`, improvement in at
least 4/6 validation folds, zero catastrophic folds, aggregate net expectancy
`>= +0.03R/trade`, PF `>=1.20`, no concentration violations, minimum aggregate
formal sample 300, minimum 30 executed trades in every validation fold, and
30% overlap reduction for candidates where the redundancy gate is applicable.
No gate is weakened if the sample is incomplete.

Selection applies all applicable gates conjunctively, then orders by improved
fold count, aggregate expectancy, the inclusive 0.01 expectancy tie band,
complexity tuple, PF with null last, and candidate ID. The floating comparison
is deterministic:

```text
difference = maxExpectancy - candidateExpectancy
tolerance = Number.EPSILON * Math.max(
  1, Math.abs(maxExpectancy), Math.abs(candidateExpectancy), Math.abs(threshold)
)
inside iff difference - threshold <= tolerance
```

## Execution and output boundary

Before network access, the performance command verifies the frozen protocol,
Gate, Plan, clean HEAD, exact manifests, absent outputs, and source identity.
It then captures one server time, loads only public Binance USD-M historical
data and required 1-minute settlement windows, runs CONTROL once, derives all
12 candidate streams from CONTROL, and publishes the performance artifacts.
The separate selection command consumes those raw artifacts and never reruns
performance.

Outputs are created only by the authorized execution:

- `docs/evidence/M3_R6_ROUND_006_SUMMARY.json`
- `docs/evidence/M3_R6_ROUND_006_AUDIT.json`
- `docs/M3_R6_ROUND_006_RESULTS.md`
- `docs/research/round-006-results.md`
- `docs/research/round-006-selection.md`

The supplied live M6 observations are retained as
`SEEN_DIAGNOSTIC_DATA_ONLY`; they are excluded from gates, thresholds,
candidate definitions, and selection.

Performance becomes immutable at the first generated result. The batch leaves
`baseline-002` `NOT_FROZEN`, M3-J `BLOCKED`, and M4 `NOT_STARTED`, and does not
change production code, production data, email configuration, Cloudflare
schedules, or private Binance capability.
