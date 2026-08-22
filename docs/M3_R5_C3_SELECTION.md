# M3-R5-C.3 Round-005 Frozen Selection Gate Application

integrityStatus: COMPLETE
finalDecision: NO BASELINE-002 CANDIDATE — ROUND-005
researchRoundId: baseline-002-research-round-005
gateApplicationSourceSha: a9aedd06203cce8736fb58ff44dd8edfcce61325
performanceExecutionSourceSha: 7e1652c30d3bc092f3161b9b36b7b11debebf161
selectionGateSha256: e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5
experimentPlanSha256: ab16a63462825441e00682f2b2bcbe04cb249e469843ce7f9a097017d992b6d1
inputSummarySha256: af3f14665fcbc4d050ad432d973d7999c4627132449e1eae82faa86ac78f1860
inputAuditSha256: 9c970b37cad81979862fbd278c3b655d1cd3e653123aa0b0a657d1ee57efdcbf
inputResultsSha256: ee6374f08493e73fc505fbd0d374a4f1d53addceb13ddbfe67cfc67ebb8a9ce0
m3R5C3ASelectionSha256: 480ea600468a8f2f39d9b2b2def6727cd45a58431f40fb7f660c257145fe170a
performanceLock: FIRST_M3_R5_PERFORMANCE_RESULT_GENERATED
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
| R5-H15-HTF-TREND | 0.09511918957093035 | 4 | 1 | 0.013052244943178533 | NORMAL (1.026761107524) | 0.211078493563 | 0.003137200629 | 0.6249240901422288 | 1902 | 187 | 10 | 6 | minimumAggregateImprovement, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor | INELIGIBLE |
| R5-H16-NEUTRAL-MEAN-REVERSION | -0.21592840552322357 | 0 | 6 | -0.2979953501509754 | NORMAL (0.541415107745) | 0.23067067171 | 0.00289258179 | 0.36568038369943906 | 3899 | 405 | 10 | 5 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor | INELIGIBLE |
| R5-H18-COMPRESSION-EXPANSION | 0.14329629488241583 | 0 | 6 | 0.06122935025466399 | NORMAL (1.092285092188) | 0.309407811257 | 0.059756579778 | 0.600691586920193 | 68 | 4 | 10 | 5 | minimumImprovedValidationFolds, catastrophicFoldLimit, minimumProfitFactor, minimumFormalSignals, minimumExecutedTrades | INELIGIBLE |

## Gate details

### R5-H15-HTF-TREND

- minimumAggregateImprovement: FAIL (REQUIRED; actual=0.09511918957093035; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: PASS (REQUIRED; actual=4; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=1; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=0.013052244943178533; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=1.026761107524; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.211078493563; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.003137200629; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: PASS (REQUIRED; actual=0.6249240901422288; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=1902; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":317,"F2":389,"F3":366,"F4":395,"F5":187,"F6":248}; threshold=30 AT_LEAST)

### R5-H16-NEUTRAL-MEAN-REVERSION

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.21592840552322357; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=0; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=6; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.2979953501509754; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.541415107745; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.23067067171; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.00289258179; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: PASS (REQUIRED; actual=0.36568038369943906; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=3899; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":711,"F2":755,"F3":736,"F4":726,"F5":405,"F6":566}; threshold=30 AT_LEAST)

### R5-H18-COMPRESSION-EXPANSION

- minimumAggregateImprovement: PASS (REQUIRED; actual=0.14329629488241583; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=0; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=6; threshold=0 AT_MOST)
- minimumNetExpectancy: PASS (REQUIRED; actual=0.06122935025466399; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=1.092285092188; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.309407811257; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.059756579778; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: PASS (REQUIRED; actual=0.600691586920193; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: FAIL (REQUIRED; actual=68; threshold=300 AT_LEAST)
- minimumExecutedTrades: FAIL (REQUIRED; actual={"F1":7,"F2":15,"F3":4,"F4":15,"F5":13,"F6":14}; threshold=30 AT_LEAST)

## Frozen boundary

- All 10 applicable gates and the NOT_APPLICABLE redundancy identity are evaluated for every candidate; no early exit is used.
- Aggregate gates use aggregate F1-F6 validation diagnostics; minimumExecutedTrades uses every individual validation fold.
- H17 is excluded from the performance candidate registry because its qualification is DATA_NOT_AVAILABLE.
- The selector uses only the frozen Round-005 Gate, Plan, and committed performance evidence; baseline-002 remains NOT_FROZEN pending a separately authorized freeze stage.

