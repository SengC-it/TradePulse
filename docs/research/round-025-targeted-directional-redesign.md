# Round-025 — Targeted Directional Candidate Redesign

Status: `BOUNDED_DEVELOPMENT_ONLY`

Round-025 is a bounded redesign of the known Round-024 LONG catastrophic-fold and SHORT sparsity/instability failures. It is not a broad search. The accepted base is `research/round-015-beta-alpha-decomposition` at `1b1bbb8de0fa38969865b62cee64b015a8b42027`.

## Frozen boundary

- Historical input is the accepted immutable R14 observation freeze, reused as `DEVELOPMENT_ONLY` data only. No new market data is acquired.
- The development window is `2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`.
- Exactly three LONG and three SHORT configurations are evaluated in one complete development execution. No configuration is added after results are seen.
- LONG is anchored to `R24_LONG_TREND_PULLBACK_VOLUME_THRESHOLD_0.10`; SHORT is anchored to `SHORT_TREND_VOLATILITY_FUNDING` and `SHORT_RELATIVE_FLOW_FUNDING`.
- Features are closed-candle, PIT-valid, cross-sectionally z-score normalized per decision time. The selection rule is independent top-one per decision time with deterministic symbol/observation-id tie breaks.
- Both directions use `bt-policy-003`: 4h horizon, 0.0005 fee per side, 0.0005 slippage per side, direction-correct Funding, 7-minute manual latency, causal settlement, ambiguous intrabar outcomes fail closed, and 1.5x total-cost stress.

## Pre-frozen configurations

LONG:

1. `R25_LONG_TREND_PULLBACK_VOLUME_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.10`
2. `R25_LONG_TREND_PULLBACK_VOLUME_NEUTRALIZED_LAMBDA_10_THRESHOLD_0.15`
3. `R25_LONG_TREND_PULLBACK_NO_VOLUME_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.10`

SHORT:

1. `R25_SHORT_TREND_VOLATILITY_FUNDING_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.03`
2. `R25_SHORT_RELATIVE_FLOW_FUNDING_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.03`
3. `R25_SHORT_RELATIVE_FLOW_FUNDING_NEUTRALIZED_LAMBDA_100_THRESHOLD_0.03`

The implementation and machine-readable contract are the source of truth for feature lists, lambda, threshold, fold identity, source identity, and governance.

## Independent family gates

Each family may select at most one champion, and only after every gate passes:

- at least 50 selected alerts and 10 distinct UTC decision dates;
- mean net expectancy > 0 and net PF > 1;
- at least 4 of 6 positive temporal folds and zero catastrophic folds (fold mean <= -0.1 is catastrophic);
- 1.5x cost-stress mean net expectancy > 0;
- 7-minute latency mean net expectancy > 0;
- maximum positive symbol contribution share <= 0.50.

No family is combined with the other family to satisfy a gate. If neither family passes, the result is `NO_DEVELOPMENT_CHAMPION` and the next stage is `DIRECTIONAL_CANDIDATE_REDESIGN_REQUIRED`. If a family passes, the result only requires a separately reviewed pre-outcome executable freeze; it does not authorize forward evaluation.

## Forward and governance boundary

The historical result is never authoritative forward proof. A forward candidate can exist only after a remote pre-outcome executable freeze of the complete feature pipeline, fitted artifact, normalization, threshold, direction, universe, horizon, ranking/tie-break, entry/exit, cost model, latency and settlement rules. No forward outcome is read in this round.

`forwardEconomicValuesRead=false`, `forwardReturnRead=false`, `performanceExecutionCount=0`, `automaticTrading=false`, `humanDecisionRequired=true`, Production is unchanged, `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, and `M4=NOT_STARTED`.
