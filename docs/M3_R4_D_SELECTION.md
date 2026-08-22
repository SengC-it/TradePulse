# M3-R4-D Round-004 Frozen Gate Application

integrityStatus: COMPLETE
finalDecision: NO BASELINE-002 CANDIDATE — ROUND-004
researchRoundId: baseline-002-research-round-004
gateApplicationSourceSha: 90b1643e8521411edaf57ab96961cb2113c90ef6
performanceExecutionSourceSha: 354401eef24b410ea5ee1c74564a9f76f0538ae9
selectionGateSha256: c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54
experimentPlanSha256: f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981
inputSummaryPath: docs/evidence/M3_R4_ROUND_004_SUMMARY.json
inputSummarySha256: 3d5da8412a972e7b2d313b975244cb0843d7989e7600cd29bc50eac7a9318a53
inputAuditSha256: 36e8145d0eb0c71c9b10d088023593cb0746f05fc1de0b6b6cdaadaacde7b661
inputResultsSha256: 1da3a5653d79470dbf0f48bb78ab428e90a17232eb9f3ff29b8ab0341158b104
m3R4DSelectionSha256: f08a3343a3316cb2f80a833c313abed18970b1fbc844dd44fe6adb3e94d19c69
performanceLock: FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED
performanceEvidenceStatus: COMPLETE
selectionAlgorithmApplied: false
selectedCandidateId: null
eligibleCandidateIds: none
baseline002Status: NOT_FROZEN
m3JStatus: BLOCKED
m4Status: NOT_STARTED

## Candidate gate matrix

| candidate | aggregate improvement | improved folds | catastrophic folds | expectancy | PF | symbol concentration | single-trade concentration | fee burden | formal signals | minimum fold executed trades | applicable | passed | failed gates | eligibility |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| R4-H11-BREAKOUT-RETEST | -0.023153480910849802 | 1 | 2 | -0.10522042553860163 | NORMAL (0.827026799315) | 0.220140564055 | 0.000947162081 | 2.286552563613184 | 4124 | 357 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R4-H12-PULLBACK-RECLAIM | -0.026204223052836567 | 2 | 3 | -0.10827116768058839 | NORMAL (0.831714321749) | 0.216012671945 | 0.001112071843 | 3.622776667319258 | 3300 | 304 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R4-H13-ADAPTIVE-TREND-EXIT | 0.041562952636154234 | 4 | 2 | -0.04050399199159759 | NORMAL (0.908866818336) | 0.240398734398 | 0.008366213652 | 2.2020042037731153 | 5415 | 481 | 10 | 5 | minimumAggregateImprovement, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R4-H14-RELATIVE-STRENGTH | 0.0128837971846191 | 4 | 1 | -0.06918314744313273 | NORMAL (0.882077307568) | 0.221320471936 | 0.001538610599 | 27.656392438627265 | 2482 | 211 | 10 | 5 | minimumAggregateImprovement, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |

## Gate details

### R4-H11-BREAKOUT-RETEST

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.023153480910849802; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=1; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=2; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.10522042553860163; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.827026799315; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.220140564055; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.000947162081; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=2.286552563613184; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=4124; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":860,"F2":774,"F3":772,"F4":820,"F5":357,"F6":540}; threshold=30 AT_LEAST)

### R4-H12-PULLBACK-RECLAIM

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.026204223052836567; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=2; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=3; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.10827116768058839; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.831714321749; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.216012671945; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.001112071843; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=3.622776667319258; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=3300; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":646,"F2":607,"F3":619,"F4":635,"F5":304,"F6":486}; threshold=30 AT_LEAST)

### R4-H13-ADAPTIVE-TREND-EXIT

- minimumAggregateImprovement: FAIL (REQUIRED; actual=0.041562952636154234; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: PASS (REQUIRED; actual=4; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=2; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.04050399199159759; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.908866818336; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.240398734398; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.008366213652; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=2.2020042037731153; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=5415; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":1073,"F2":1013,"F3":1031,"F4":1095,"F5":481,"F6":715}; threshold=30 AT_LEAST)

### R4-H14-RELATIVE-STRENGTH

- minimumAggregateImprovement: FAIL (REQUIRED; actual=0.0128837971846191; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: PASS (REQUIRED; actual=4; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=1; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.06918314744313273; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.882077307568; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.221320471936; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.001538610599; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=27.656392438627265; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=2482; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":520,"F2":461,"F3":463,"F4":491,"F5":211,"F6":332}; threshold=30 AT_LEAST)

## Frozen boundary

- All four candidates were evaluated and all eleven gate identities were evaluated for every candidate; no early exit was used.
- Aggregate gates use aggregate F1-F6 validation diagnostics; minimumExecutedTrades uses every individual validation fold.
- requiredRedundancyImprovement is NOT_APPLICABLE and is excluded from the eligibility conjunction.
- Complexity tuples are copied from the frozen Round-004 Plan and are not inferred from evidence.
- baseline-002 remains NOT_FROZEN.

