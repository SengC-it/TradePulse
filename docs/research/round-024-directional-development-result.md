# Round-024 Directional Candidate Families — Development Result

- Base: `research/round-015-beta-alpha-decomposition` @ `494d41f0d08f6a4931fa887f47af1c514aab1351`
- Development window: `2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`
- Data classification: `DEVELOPMENT_ONLY`; no authoritative forward proof.
- Source: `E:\Codex\TradePulse\.worktrees\round-014-r13-execution-replay\.cache\tradepulse\round-014\observations.ndjson` (5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359)
- Development economic evaluation execution count: `1`
- Protocol SHA-256: `c3d29e280bbf14fd5073cc2a636ff0d7f5c6dadf7fca24b2d0da50352736bce5`

## Independent family contract

LONG and SHORT have separate feature subsets, model artifacts, thresholds, and independent top-one-per-decision-time selection. They are never represented as one model with a direction sign flip.

| Family | Candidate | Selected | Mean net R | Net PF | 1.5x stress mean R | 7m latency mean R | Positive folds | Catastrophic folds | Eligibility |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| LONG-CANDIDATE-FAMILY | R24_LONG_TREND_PULLBACK_VOLUME_THRESHOLD_0.05 | 2299 | 0.040668597832891014 | 1.1045098373804412 | 0.0034627188347580032 | 0.04139911574343238 | 3 | 1 | INELIGIBLE |
| LONG-CANDIDATE-FAMILY | R24_LONG_TREND_PULLBACK_VOLUME_THRESHOLD_0.10 | 1606 | 0.11093958894000247 | 1.311511582553087 | 0.0786152694362229 | 0.1121605011633462 | 4 | 1 | INELIGIBLE |
| LONG-CANDIDATE-FAMILY | R24_LONG_SLOPE_VOLATILITY_FLOW_THRESHOLD_0.05 | 1072 | -0.03119345318317386 | 0.9298791234334007 | -0.09813689334069724 | -0.029729053239482012 | 3 | 1 | INELIGIBLE |
| LONG-CANDIDATE-FAMILY | R24_LONG_SLOPE_VOLATILITY_FLOW_THRESHOLD_0.10 | 234 | -0.015213291256570966 | 0.9648936896826044 | -0.08238844204658664 | -0.0025736227701728897 | 3 | 0 | INELIGIBLE |
| SHORT-CANDIDATE-FAMILY | R24_SHORT_TREND_VOLATILITY_FUNDING_THRESHOLD_0.05 | 120 | 0.1394299272801249 | 1.4634992487940068 | 0.0822445392789898 | 0.14420363491790164 | 1 | 0 | INELIGIBLE |
| SHORT-CANDIDATE-FAMILY | R24_SHORT_TREND_VOLATILITY_FUNDING_THRESHOLD_0.10 | 58 | 0.14713418994664093 | 1.5462375927188265 | 0.09358494239375008 | 0.15345549651537746 | 1 | 0 | INELIGIBLE |
| SHORT-CANDIDATE-FAMILY | R24_SHORT_RELATIVE_FLOW_FUNDING_THRESHOLD_0.05 | 49 | -0.042222936199999006 | 0.9292477438051038 | -0.08075349907291987 | -0.006824432112404358 | 1 | 1 | INELIGIBLE |
| SHORT-CANDIDATE-FAMILY | R24_SHORT_RELATIVE_FLOW_FUNDING_THRESHOLD_0.10 | 29 | 0.18250461814663888 | 1.3433749333708869 | 0.14385658942095572 | 0.1839422868833361 | 2 | 0 | INELIGIBLE |

- LONG champion: `null`
- SHORT champion: `null`
- Development classification: `NO_DEVELOPMENT_CHAMPION`

## Economic boundary

- Cost policy: `bt-policy-003`; fees, slippage, direction-correct Funding, settlement, and 7-minute manual latency are shared by both families.
- Historical label values were read only from the accepted existing R14 observation freeze for development evaluation.
- Forward economic values/read: `false/false`.
- New historical or post-freeze market data fetched: `false/false`.
- Regime breakdown: `UNAVAILABLE_IN_ACCEPTED_R14_OBSERVATION_SCHEMA`; no regime gate or proxy was introduced.

## Governance

- `humanDecisionRequired=true`
- `automaticTrading=false`
- `Production unchanged`
- `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, `M4=NOT_STARTED`

## Final decision

`ROUND-024 DEVELOPMENT COMPLETE — PRE-OUTCOME FREEZE REQUIRED`

Next stage: `PRE_OUTCOME_EXECUTABLE_FREEZE`
