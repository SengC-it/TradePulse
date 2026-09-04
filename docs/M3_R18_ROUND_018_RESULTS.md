# M3-R18 Round-018 Component Consensus Performance

- researchRoundId: baseline-002-research-round-018
- executionId: r18-d328ac05-868b-4647-b5b3-6039e49dbe39
- performanceExecutionSourceSha: 2121d5191dd0758fabbfbc9c8d5ca5b808799d66
- acceptedDesignSourceSha: feec11151b334a14754b1f720972c6e2b198960a
- performanceExecutionCount: 1
- performanceLockTriggered: true
- controlValidationEconomicCount: 5413
- candidateValidationEconomicCount: 3136

## H4 validation

| cohort | count | mean net ATR | PF | cumulative net ATR | maximum DD net ATR |
| --- | ---: | ---: | ---: | ---: | ---: |
| CONTROL | 5413 | -0.2933530534709622 | 0.6069696311042604 | -1587.9200784383183 | -1595.2385784637013 |
| CANDIDATE | 3136 | -0.314778854997281 | 0.614051537951736 | -987.1464892714732 | -991.0360030566866 |
| DELTA MEAN | — | -0.02142580152631879 | — | — | — |

## Fold H4 means

| fold | control mean | candidate mean | candidate >= control | candidate > 0 |
| --- | ---: | ---: | --- | --- |
| F1 | -0.30931529960627246 | -0.3548449299781097 | false | false |
| F2 | -0.2985596391201411 | -0.3154808704880519 | false | false |
| F3 | -0.46438476812784585 | -0.5061704223515835 | false | false |
| F4 | -0.2376529734465162 | -0.2760954858641474 | false | false |
| F5 | -0.049535581169874034 | 0.05606519574236895 | true | true |
| F6 | -0.2651934927230087 | -0.30067445990490754 | false | false |

- positiveIncrementalFolds: 1/6
- positiveAbsoluteCandidateFolds: 1/6

## Stress and reporting-only horizons

- candidate cost-stress mean/PF: -0.46639308349270264 / 0.49065097819143466
- candidate latency-stress mean/PF: -0.3149855178317417 / 0.6133084050425448
- H8 reporting-only candidate/control mean: -0.321279389546576 / -0.2857165698029449
- H12 reporting-only candidate/control mean: -0.3230131362619947 / -0.27366348706357047
- H24 reporting-only candidate/control mean: -0.2605214777260194 / -0.1709741351495932

## G08-G15

- G08_ABSOLUTE_H4_EDGE: FAIL (observed -0.314778854997281; requirement candidate.meanNetForwardAtr > 0)
- G09_H4_PROFIT_FACTOR: FAIL (observed 0.614051537951736; requirement candidate.profitFactor >= 1.10)
- G10_INCREMENTAL_H4_EDGE: FAIL (observed -0.02142580152631879; requirement candidate.meanNetForwardAtr - control.meanNetForwardAtr >= 0.05)
- G11_FOLD_INCREMENTAL_ROBUSTNESS: FAIL (observed 1; requirement candidate mean >= control mean in >= 4/6 validation folds)
- G12_FOLD_ABSOLUTE_ROBUSTNESS: FAIL (observed 1; requirement candidate mean > 0 in >= 4/6 validation folds)
- G13_COST_STRESS: FAIL (observed {"mean":-0.46639308349270264,"profitFactor":0.49065097819143466}; requirement candidate cost-stress mean >= 0 and PF >= 1.05)
- G14_LATENCY_STRESS: FAIL (observed {"mean":-0.3149855178317417,"profitFactor":0.6133084050425448}; requirement candidate latency-stress mean >= 0 and PF >= 1.05)
- G15_DRAWDOWN_NON_DEGRADATION: PASS (observed {"candidateMaximumDrawdownNetAtr":-991.0360030566866,"controlMaximumDrawdownNetAtr":-1595.2385784637013}; requirement candidate maximum drawdown is no worse than control by more than 5% of abs(control maximum drawdown))

- finalDecision: NO ROBUST COMPONENT-CONSENSUS EDGE — ROUND-018
- baseline002Status: NOT_FROZEN
- m3JStatus: BLOCKED
- m4Status: NOT_STARTED
- automaticTrading: false