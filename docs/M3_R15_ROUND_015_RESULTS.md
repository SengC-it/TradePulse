# M3-R15 Round-015 Beta × Alpha Decomposition

- researchRoundId: baseline-002-research-round-015
- classification: HISTORICAL_DEVELOPMENT_STUDY
- h4SelectionBasis: SEEN_HYPOTHESIS_FROM_R14
- executionId: r15-feb161ec-9e6d-46d9-a278-a9ccba1d1906
- performanceExecutionSourceSha: cdc1cb3b5443f7f1dbed4af70d061771cf3853c7
- performanceLock: FIRST_M3_R15_PERFORMANCE_RESULT_GENERATED
- performanceExecutionCount: 1
- artifactHashMethod: SHA256_EXACT_COMMITTED_UTF8_BYTES

## Beta

- pooledPearson: 0.06450005351049345
- pooledSpearman: 0.08443454057337485
- signAccuracy: 0.6134989341801887
- positiveCorrelationFolds: 6/6

## Alpha

- pooledSpearman: 0.031413190212612865
- meanTimestampSpearman: 0.023398007569495907
- positiveCorrelationFolds: 5/6
- topBottomSpread: 0.090089325777275
- positiveSpreadFolds: 5/6

## Combined

| metric | value |
| --- | ---: |
| selected | 488 |
| validation timestamps | 22987 |
| NO_TRADE rate | 0.9787706094749206 |
| mean signals/month | 27.11111111111111 |
| median signals/month | 11 |
| LONG / SHORT | 194 / 294 |
| mean net ATR | -0.13477565587312162 |
| median net ATR | -0.17982293137637329 |
| PF | 0.722668437831905 |
| cumulative net ATR | -65.77052006608335 |
| max DD ATR | -71.99492948598194 |
| cost stress mean / PF | -0.212246707912189 / 0.601511731580027 |
| latency stress mean | -0.13390640528283465 |

## Gates

- G1_SELECTED_AGGREGATE_MINIMUM: FAIL (observed 488; requirement >= 500)
- G2_SELECTED_EVERY_FOLD_MINIMUM: FAIL (observed {"F1":374,"F2":104,"F3":5,"F4":4,"F5":0,"F6":1}; requirement every fold >= 50)
- G3_MEAN_REALIZED_NET_FORWARD_ATR: FAIL (observed -0.13477565587312162; requirement >= 0.1)
- G4_ATR_PROFIT_FACTOR: FAIL (observed 0.722668437831905; requirement >= 1.3)
- G5_POSITIVE_REALIZED_EDGE_FOLDS: FAIL (observed 1; requirement >= 5/6)
- G6_CATASTROPHIC_FOLDS: FAIL (observed 4; requirement <= 0)
- G7_BETA_POOLED_CORRELATION: PASS (observed 0.06450005351049345; requirement > 0)
- G8_BETA_POSITIVE_CORRELATION_FOLDS: PASS (observed 6; requirement >= 5/6)
- G9_ALPHA_POSITIVE_CORRELATION_FOLDS: PASS (observed 5; requirement >= 5/6)
- G10_ALPHA_POOLED_SPEARMAN: PASS (observed 0.031413190212612865; requirement >= 0.03)
- G11_ALPHA_TOP_BOTTOM_SPREAD: FAIL (observed 0.090089325777275; requirement >= 0.15)
- G12_ALPHA_POSITIVE_SPREAD_FOLDS: PASS (observed 5; requirement >= 5/6)
- G13_COST_STRESS: FAIL (observed {"mean":-0.212246707912189,"profitFactor":0.601511731580027}; requirement mean > 0 and PF > 1.05)
- G14_LATENCY_STRESS: FAIL (observed -0.13390640528283465; requirement > 0)
- G15_POSITIVE_SYMBOL_CONTRIBUTION: PASS (observed 0.3242786330079375; requirement <= 0.5)
- G16_SINGLE_POSITIVE_OBSERVATION_CONTRIBUTION: PASS (observed 0.044661241209265984; requirement <= 0.05)
- G17_EVIDENCE_INTEGRITY: PASS (observed true; requirement COMPLETE)
- G18_MODEL_PROVENANCE: PASS (observed true; requirement COMPLETE)

- finalDecision: NO BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015
- candidateStatus: null
- forwardShadowEligible: false
- baseline002Status: NOT_FROZEN
- m3JStatus: BLOCKED
- m4Status: NOT_STARTED
- privateBinanceApi: false
- automaticTrading: false