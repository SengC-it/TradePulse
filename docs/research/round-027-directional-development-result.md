# Round-027 Directional Target / Model Redesign — Development Result

- Base: `research/round-015-beta-alpha-decomposition` @ `919265491bb85e2cc780acab4c6ebc18a42cfe9a`
- Development window: `2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`
- Data classification: `DEVELOPMENT_ONLY / ALREADY_SEEN`; this historical window is not authoritative forward proof.
- Source: `.cache/tradepulse/round-014/observations.ndjson` (5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359)
- R27 development economic evaluation execution count: `1`
- Protocol SHA-256: `a1f63888e3c9ff0ffd84a4abadf3483fe89e10945737414878fd54f4b5cfb77c`

## Frozen target/model contract

Exactly three LONG and three SHORT configurations were frozen before this one development evaluation. No threshold, lambda, feature, horizon, or combinatorial search was performed.

| Candidate | Direction | Target | Selected | F1 | F2 | F3 | F4 | F5 | F6 | Mean net R | PF | Stress mean | 7m latency mean | Positive folds | Catastrophic folds | Symbol share | Eligibility |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| R27_LONG_POSITIVE_LOGIT_TREND_PULLBACK_VOLUME | LONG | POSITIVE_NET_PROBABILITY | 2096 | 2096 | 0 | 0 | 0 | 0 | 0 | -0.10691601284884633 | 0.7940696080305856 | -0.17697713787285457 | -0.1089992237372058 | 0 | 1 | 0.9366574114764545 | INELIGIBLE |
| R27_LONG_POSITIVE_LOGIT_TREND_PULLBACK_NO_VOLUME | LONG | POSITIVE_NET_PROBABILITY | 2185 | 2185 | 0 | 0 | 0 | 0 | 0 | -0.11758836158754352 | 0.7744930593787953 | -0.1857680874243096 | -0.11726984973118985 | 0 | 1 | 0.9577337142179907 | INELIGIBLE |
| R27_LONG_PAIRWISE_RANK_POSITIVE_GATE_TREND_PULLBACK_VOLUME | LONG | CROSS_SECTIONAL_PAIRWISE_RANKING_PLUS_POSITIVE_NET_PROBABILITY_GATE | 1112 | 1112 | 0 | 0 | 0 | 0 | 0 | -0.10408040073735457 | 0.7989420263912811 | -0.17221268561140787 | -0.10513571642505566 | 0 | 1 | 0.9250368701767918 | INELIGIBLE |
| R27_SHORT_POSITIVE_LOGIT_TREND_VOLATILITY_FUNDING | SHORT | POSITIVE_NET_PROBABILITY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | null | null | null | null | 0 | 0 | null | INELIGIBLE |
| R27_SHORT_POSITIVE_LOGIT_RELATIVE_FLOW_FUNDING | SHORT | POSITIVE_NET_PROBABILITY | 0 | 0 | 0 | 0 | 0 | 0 | 0 | null | null | null | null | 0 | 0 | null | INELIGIBLE |
| R27_SHORT_PAIRWISE_RANK_POSITIVE_GATE_TREND_VOLATILITY_FUNDING | SHORT | CROSS_SECTIONAL_PAIRWISE_RANKING_PLUS_POSITIVE_NET_PROBABILITY_GATE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | null | null | null | null | 0 | 0 | null | INELIGIBLE |

- LONG champion: `null`
- SHORT champion: `null`
- Development classification: `NO_DEVELOPMENT_CHAMPION`

## Economic and selection boundary

- Cost policy: `bt-policy-003`; both directions use the same fee, slippage, actual direction-correct Funding, causal settlement, and 7-minute latency semantics.
- For each fold, research rows were fit after the 24h purge; validation features were scored; frozen alerts were selected; only then were selected validation economic labels read.
- Non-selected validation economic values were not used for selection, threshold choice, feature choice, lambda choice, or refitting.
- Forward economic values/read: `false/false`; no post-freeze or new market data was fetched.

## Governance

- `humanDecisionRequired=true`; `automaticTrading=false`; `Production unchanged`; `emailRestorationAuthorized=false`
- `performanceExecutionCount=0`; `performanceLedgerPresent=false`; `baseline-002=NOT_FROZEN`; `M3-J=BLOCKED`; `M4=NOT_STARTED`

## Final decision

`ROUND-027 DIRECTIONAL DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION / NO FORWARD CANDIDATE`

Next stage: `FEATURE_INFORMATION_OR_MODEL_CAPACITY_REASSESSMENT_REQUIRED`
