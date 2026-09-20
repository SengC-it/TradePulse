# Round-030 Target / Source Diagnostic Result

- Result SHA-256: `89b1f04d5345af88a0a55a3eb19135ed0393cea1cfa342828013e440370be874`
- R30 diagnostic execution count: `1`
- Target diagnostic execution count: `1`
- Fit count: `48`
- Overall classification: `NEW_INFORMATION_SOURCE_ESCALATION_REQUIRED`
- Overall next stage: `NEW_INFORMATION_SOURCE_ESCALATION_REQUIRED`

## Directional target results

### LONG — RAW_LINEAR_ALL18

- Selected target: `null`
- Classification: `TARGET_REDESIGN_INSUFFICIENT`
- Next: `ALTERNATIVE_OR_PAID_INFORMATION_SOURCE_REQUIRED`

| Target | T3 AUC median | T3 AUC worst | positive AUC folds | stress rank IC median | positive rank IC folds | improvement vs T0 | eligible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| T0 | 0.5607079528503145 | 0.5439399267455639 | 6 | 0.12485309407675035 | 6 | 0 | false |
| T1 | 0.5639015014026107 | 0.550679070401893 | 6 | 0.12921776284095055 | 6 | 0.003193548552296255 | false |
| T2 | 0.5611016173491465 | 0.5451403915111036 | 6 | 0.1262923705851754 | 6 | 0.000393664498832047 | false |
| T3 | 0.5656435238134828 | 0.5507706307727467 | 6 | 0.1330478745101278 | 6 | 0.004935570963168323 | false |

### SHORT — XS_LINEAR_ALL18

- Selected target: `null`
- Classification: `TARGET_REDESIGN_INSUFFICIENT`
- Next: `ALTERNATIVE_OR_PAID_INFORMATION_SOURCE_REQUIRED`

| Target | T3 AUC median | T3 AUC worst | positive AUC folds | stress rank IC median | positive rank IC folds | improvement vs T0 | eligible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| T0 | 0.5406919258947558 | 0.5361924597600476 | 6 | 0.08656350307847913 | 6 | 0 | false |
| T1 | 0.5430121569276795 | 0.5361677819511597 | 6 | 0.09196074460188086 | 6 | 0.0023202310329236697 | false |
| T2 | 0.541174234407938 | 0.5360682591882602 | 6 | 0.08539796721601112 | 6 | 0.0004823085131822058 | false |
| T3 | 0.5428511857908674 | 0.536401944478545 | 6 | 0.09124592337638823 | 6 | 0.002159259896111654 | false |

## Stage B

- Source preflight execution count: `1`
- Archive files available: `35/35`
- Checksum-valid files: `35/35`
- Exact-schema files: `35/35`
- Source classification: `METRICS_SOURCE_PREFLIGHT_INELIGIBLE`
- Source next stage: `ALTERNATIVE_OR_PAID_INFORMATION_SOURCE_REQUIRED`
- Feature availability rule: `archive create_time + 5 minutes`

## Governance

- Economic evaluation performed: `false`
- Trading economic metrics calculated: `false`
- New market data fetched: `true`
- New market data used for economic evaluation: `false`
- Forward economic values read: `false`
- Forward return read: `false`
- Performance execution count: `0`
- Automatic trading: `false`
- Human decision required: `true`
- Production unchanged: `true`

Final decision: `ROUND-030 TARGET / SOURCE DIAGNOSTIC COMPLETE`
