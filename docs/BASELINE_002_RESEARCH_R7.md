# Baseline-002 Round-007 Research Diagnosis

Round-007 is one bounded model-level profitability rebuild. It is research-only and uses the seen-data boundary `2026-08-15T23:59:59.999Z` with classification `RESEARCH_AVAILABLE_SEEN_DATA`. M6 observations are diagnostics only: they are not training data, thresholds, candidates, gates, or selection inputs.

The product boundary remains advisory-only. The batch uses public Binance market data, closed decision-time candles, the existing `baseline-001` Strategy Engine and `bt-policy-003` settlement economics. It never uses private/account APIs, places orders, changes leverage or sizing, or changes production behavior.

## Frozen registry

Exactly five candidates are evaluated, with one variant each:

1. `R7-R1-REGIME-EXPECTANCY-ROUTER` — fixed regime-cell routing learned from each fold's research segment. A cell is available only when its research sample and expectancy floors pass; validation cannot update the cell.
2. `R7-E1-PULLBACK-RECLAIM` — a closed-candle EMA20/EMA50 pullback interaction followed by a closed reclaim, with fixed extension and no existing three-candle breakout.
3. `R7-E2-BREAKOUT-RETEST` — a closed breakout followed by a closed retest/reclaim in the next three candles; it does not enter on the breakout candle.
4. `R7-S1-CALIBRATED-SCORE-V2` — a fixed ten-feature, ridge model fitted per fold on the CONTROL research stream and used only to filter validation predictions.
5. `R7-C1-RECLAIM-CALIBRATED-SCORE-V2` — the same fixed model contract fitted on E1 research outcomes and applied to E1 validation opportunities.

No sweep, optimizer, whitelist, parameter replacement, brute-force combination, or post-result candidate replacement is permitted. C1 is the only declared combination.

## Non-negotiable boundaries

- All signal features use data closed at decision time. The next one-hour open is used only by the inherited settlement policy.
- `PERIOD_END_CENSORED` is formal/non-executed and is excluded from executed metrics. It does not invalidate a complete validation segment. `DATA_INCOMPLETE` fails closed.
- H17 is not requalified, Round-006 is not rerun, and baseline-002 remains `NOT_FROZEN` until a separate human decision.
- M3-J remains `BLOCKED`; M4 remains `NOT_STARTED`.
