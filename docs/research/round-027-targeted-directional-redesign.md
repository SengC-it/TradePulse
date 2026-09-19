# Round-027 — Directional Target / Model Redesign

## Frozen boundary

Round-027 is a bounded `DEVELOPMENT_ONLY / ALREADY_SEEN` redesign using only the accepted R14 observation freeze:

- Source: `.cache/tradepulse/round-014/observations.ndjson`
- SHA-256: `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`
- 244,810 observations, `2023-01-01` through `2026-08-15`
- no network acquisition, no new historical data, no post-boundary data, and no forward data

Exactly three LONG and three SHORT configurations are frozen before the one complete development evaluation. No grid search, threshold sweep, lambda sweep, combinatorial feature search, or horizon expansion is allowed.

## Shared PIT pipeline

The pipeline uses BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, and BNBUSDT; LONG and SHORT directions; closed 1h decision candles; a 4h horizon; F1-F6; a 24h purge/embargo; and cross-sectional z-score normalization at each direction and decision time. Every direction/time must contain exactly five peers or fail closed. Normalization never uses an outcome.

## Frozen model targets

### Positive-net probability

The target is one for an EXECUTED primary H4 label with `netForwardAtr > 0`, zero for an EXECUTED primary H4 label with `netForwardAtr <= 0`, and excludes non-EXECUTED rows. The deterministic binary logistic model uses L2 lambda 10, an unpenalized intercept, training-set standardization after cross-sectional normalization, at most 100 iterations, tolerance `1e-10`, and a `[-30,+30]` linear-predictor clamp. One class, non-finite data, singular solve, or non-convergence fails the candidate/fold closed; there is no fallback.

### Pairwise ranking with positive gate

Within one direction and decision time, the five symbols create ten unordered pairs and two anti-symmetric directed examples per unequal-net pair. The deterministic L2 logistic pairwise model uses lambda 10 and a fixed zero intercept. Validation `pairwiseScore` is the mean probability of beating each other symbol, with the frozen symbol order and observation-id lexical tie-break. A pairwise alert requires `pairwiseScore >= 0.60` and positive-net probability `>= 0.50`.

## Six frozen configurations

| Direction | Configuration | Feature subset | Selection |
| --- | --- | --- | --- |
| LONG | `R27_LONG_POSITIVE_LOGIT_TREND_PULLBACK_VOLUME` | `LONG_FEATURE_NAMES` | top-one `pPositive >= 0.50` |
| LONG | `R27_LONG_POSITIVE_LOGIT_TREND_PULLBACK_NO_VOLUME` | `R25_LONG_NO_VOLUME_FEATURE_NAMES` | top-one `pPositive >= 0.50` |
| LONG | `R27_LONG_PAIRWISE_RANK_POSITIVE_GATE_TREND_PULLBACK_VOLUME` | `LONG_FEATURE_NAMES` | top-one pairwise `>= 0.60` and `pPositive >= 0.50` |
| SHORT | `R27_SHORT_POSITIVE_LOGIT_TREND_VOLATILITY_FUNDING` | `SHORT_FEATURE_NAMES` | top-one `pPositive >= 0.50` |
| SHORT | `R27_SHORT_POSITIVE_LOGIT_RELATIVE_FLOW_FUNDING` | `SHORT_ALTERNATE_FEATURE_NAMES` | top-one `pPositive >= 0.50` |
| SHORT | `R27_SHORT_PAIRWISE_RANK_POSITIVE_GATE_TREND_VOLATILITY_FUNDING` | `SHORT_FEATURE_NAMES` | top-one pairwise `>= 0.60` and `pPositive >= 0.50` |

The six configurations are the complete search space. If both family champions are null, the round stops with `NO_DEVELOPMENT_CHAMPION`; no additional configurations or threshold rescue are permitted.

## Selection, outcomes, and gates

For each fold the runner fits only purged RESEARCH rows, scores VALIDATION features, selects frozen alerts, then reads economic labels only for selected alerts. Validation economic values cannot influence feature selection, thresholds, lambda, candidate choice, or refitting. An incomplete selected primary, cost-stress, or latency label makes that candidate `INELIGIBLE` with `SELECTED_LABEL_NOT_EVALUABLE`; other candidates continue.

The shared `bt-policy-003` settlement is unchanged: 0.0005 fee and slippage per side, actual direction-correct Binance USD-M Funding, seven-minute manual latency, causal TP/SL or four-hour exit, ambiguous intrabar `NOT_EVALUABLE`, and 1.5x total-cost stress.

Every candidate must satisfy the inherited R25 gates: at least 50 selected alerts, at least 10 UTC dates, mean net greater than zero, PF greater than one, at least four positive folds, zero catastrophic folds where fold mean is at most -0.10, positive 1.5x stress mean, positive seven-minute latency mean, and maximum positive-symbol contribution at most 0.50. The only added gate is at least ten selected alerts in every F1-F6 fold.

LONG and SHORT champions are selected independently from eligible candidates using worst-fold mean net, stress mean, absolute drawdown, then candidate id. A champion, if any, still requires a separately remote-frozen pre-outcome executable artifact before forward validation; this round does not authorize forward validation.

## Governance

`humanDecisionRequired=true`, `automaticTrading=false`, Production and main unchanged, email restoration unauthorized, `forwardEconomicValuesRead=false`, `forwardReturnRead=false`, `performanceExecutionCount=0`, and no performance ledger. `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, and `M4=NOT_STARTED`. No Observation, Performance, Backtest, Selection, economic evaluation beyond the single bounded development run, or new market-data acquisition is permitted.
