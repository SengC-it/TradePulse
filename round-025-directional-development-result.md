# Round-025 Targeted Directional Candidate Redesign — Development Result

- Base: `research/round-015-beta-alpha-decomposition` @ `1b1bbb8de0fa38969865b62cee64b015a8b42027`
- Development window: `2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`
- Data classification: `DEVELOPMENT_ONLY`; the seen historical window is not authoritative forward proof.
- Source: `.cache/tradepulse/round-014/observations.ndjson` (5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359)
- Development economic evaluation execution count: `1`
- Protocol SHA-256: `20996bc70c5af58fc6d0607d56da4766a245aec820508e1b5f40a77a050f0193`

## Bounded search contract

Exactly three pre-frozen LONG configurations and three pre-frozen SHORT configurations were evaluated once. Cross-sectional z-score normalization is computed only from closed-candle rows at the same decision time; no outcome is used by the normalization.

| Family | Candidate | Selected | Mean net R | Net PF | 1.5x stress mean R | 7m latency mean R | Positive folds | Catastrophic folds | Symbol share | Eligibility |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| LONG-CANDIDATE-FAMILY | R25_LONG_TREND_PULLBACK_VOLUME_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.10 | 378 | -0.11284470693686184 | 0.7808283752454309 | -0.17691026559387718 | -0.10834102266047892 | 0 | 1 | 0.789527135323927 | INELIGIBLE |
| LONG-CANDIDATE-FAMILY | R25_LONG_TREND_PULLBACK_VOLUME_NEUTRALIZED_LAMBDA_10_THRESHOLD_0.15 | 35 | 0.10841037456834339 | 1.2955918652238787 | 0.04667156164707232 | 0.11843417766220105 | 1 | 0 | 0.6771225916306701 | INELIGIBLE |
| LONG-CANDIDATE-FAMILY | R25_LONG_TREND_PULLBACK_NO_VOLUME_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.10 | 377 | -0.04049282843482487 | 0.9163474649697552 | -0.10419639408829157 | -0.04393024104206171 | 0 | 0 | 0.816303608533381 | INELIGIBLE |
| SHORT-CANDIDATE-FAMILY | R25_SHORT_TREND_VOLATILITY_FUNDING_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.03 | 0 | null | null | null | null | 0 | 0 | null | INELIGIBLE |
| SHORT-CANDIDATE-FAMILY | R25_SHORT_RELATIVE_FLOW_FUNDING_NEUTRALIZED_LAMBDA_30_THRESHOLD_0.03 | 0 | null | null | null | null | 0 | 0 | null | INELIGIBLE |
| SHORT-CANDIDATE-FAMILY | R25_SHORT_RELATIVE_FLOW_FUNDING_NEUTRALIZED_LAMBDA_100_THRESHOLD_0.03 | 0 | null | null | null | null | 0 | 0 | null | INELIGIBLE |

- LONG champion: `null`
- SHORT champion: `null`
- Development classification: `NO_DEVELOPMENT_CHAMPION`

## Economic boundary

- Cost policy: `bt-policy-003`; fees, slippage, direction-correct Funding, causal settlement, and 7-minute manual latency are shared by both families.
- Historical label values were read only from the accepted existing R14 observation freeze for this one development evaluation.
- Forward economic values/read: `false/false`.
- No new historical or post-freeze market data was fetched.
- No executable freeze or forward validation was authorized by this development result.

## Governance

- `humanDecisionRequired=true`
- `automaticTrading=false`
- `Production unchanged`
- `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, `M4=NOT_STARTED`

## Final decision

`ROUND-025 DIRECTIONAL DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION / NO FORWARD CANDIDATE`

Next stage: `DIRECTIONAL_CANDIDATE_REDESIGN_REQUIRED`
