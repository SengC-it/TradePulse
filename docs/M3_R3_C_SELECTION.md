# M3-R3-C Round-003 Frozen Selection Gate Application

integrityStatus: COMPLETE
finalDecision: NO BASELINE-002 CANDIDATE — ROUND-003
researchRoundId: baseline-002-research-round-003
sourceMainSha: 4172c77398ee18d9e109396415cc9970fa1800ae
executionSourceSha: ce807f2ca451de09c3461038e38768ff759ec80c
selectionGateSha256: 297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2
experimentPlanSha256: d4238bec817425fddd4a1e556277aa58de84c5986da55a9e08b661cc9f621e67
inputEvidencePath: docs/evidence/M3_R3_ROUND_003_SUMMARY.json
inputEvidenceSha256: 6b86ef4ef8bb9bbf8c0047b57d4322fc61f843cad6c9fdd55ab513e00b6d8d69
m3R3CSelectionSha256: 8efb765df782218b47962fa1e0328b3bb998a7fb9473206963a67a58822f32dd
performanceEvidenceStatus: COMPLETE
selectionAlgorithmApplied: false
selectedCandidateId: null
eligibleCandidateIds: none
baseline002Status: NOT_FROZEN
m3JStatus: BLOCKED
m4Status: NOT_STARTED

## Candidate gate matrix

| candidate | aggregate improvement | improved folds | catastrophic folds | aggregate expectancyR | PF | symbol concentration | single-trade concentration | fee burden | aggregate formal signals | minimum fold executed trades | applicable | passed | failed gates | eligibility |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| R2-H6-STRICT-BTC | 0.006891445442789357 | 1 | 1 | -0.07517549918496247 | NORMAL (0.874796607954) | 0.288958961377 | 0.001066974306 | 80.04390185803739 | 3510 | 312 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R2-H7-STRONG-SYMBOL | -0.03290045689820846 | 0 | 4 | -0.11496740152596029 | NORMAL (0.812846417282) | 0.214690321543 | 0.00107492715 | 1.443525320980119 | 3680 | 300 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R2-H8-RECENT-PULLBACK | -0.002859922074517504 | 0 | 3 | -0.08492686670226933 | NORMAL (0.858214189088) | 0.215293761777 | 0.000789760322 | 5.2694522099423855 | 4865 | 434 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R2-H9-VOLUME-CONFIRM | -0.0032254264113741327 | 1 | 3 | -0.08529237103912596 | NORMAL (0.854516744169) | 0.216940816188 | 0.001251708935 | 3.6848546490865366 | 3138 | 297 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R2-H10-BREAKOUT-010 | 0.001998510640172063 | 2 | 3 | -0.08006843398757976 | NORMAL (0.864551825224) | 0.216138642843 | 0.000883646063 | 6.202789086540426 | 4374 | 403 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R2-C1-BTC-STRONG-SYMBOL | 0.008891748042141392 | 2 | 1 | -0.07317519658561043 | NORMAL (0.878152099188) | 0.243956965563 | 0.001356869448 | 37.621107262969886 | 2749 | 253 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R2-C2-STRONG-SYMBOL-RECENT-PULLBACK | -0.0382855561691194 | 1 | 3 | -0.12035250079687122 | NORMAL (0.804930279418) | 0.215821436811 | 0.001233077982 | 1.3440723436530209 | 3226 | 264 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT | -0.04298673753237384 | 1 | 4 | -0.12505368216012566 | NORMAL (0.792327574973) | 0.246223636621 | 0.002347004818 | 1.0108117617294197 | 1757 | 156 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |
| R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT | -0.006799693034876375 | 2 | 3 | -0.0888666376626282 | NORMAL (0.848497371961) | 0.262571811317 | 0.003017871456 | 2.649633327248964 | 1306 | 132 | 10 | 4 | minimumAggregateImprovement, minimumImprovedValidationFolds, catastrophicFoldLimit, minimumNetExpectancy, minimumProfitFactor, maximumFeeBurdenRatio | INELIGIBLE |

## Gate details

### R2-H6-STRICT-BTC

- minimumAggregateImprovement: FAIL (REQUIRED; actual=0.006891445442789357; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=1; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=1; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.07517549918496247; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.874796607954; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.288958961377; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.001066974306; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=80.04390185803739; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=3510; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":733,"F2":716,"F3":623,"F4":680,"F5":312,"F6":446}; threshold=30 AT_LEAST)

### R2-H7-STRONG-SYMBOL

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.03290045689820846; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=0; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=4; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.11496740152596029; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.812846417282; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.214690321543; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.00107492715; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=1.443525320980119; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=3680; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":729,"F2":701,"F3":706,"F4":762,"F5":300,"F6":478}; threshold=30 AT_LEAST)

### R2-H8-RECENT-PULLBACK

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.002859922074517504; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=0; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=3; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.08492686670226933; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.858214189088; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.215293761777; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.000789760322; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=5.2694522099423855; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=4865; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":965,"F2":914,"F3":930,"F4":981,"F5":434,"F6":636}; threshold=30 AT_LEAST)

### R2-H9-VOLUME-CONFIRM

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.0032254264113741327; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=1; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=3; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.08529237103912596; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.854516744169; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.216940816188; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.001251708935; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=3.6848546490865366; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=3138; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":591,"F2":579,"F3":607,"F4":613,"F5":297,"F6":448}; threshold=30 AT_LEAST)

### R2-H10-BREAKOUT-010

- minimumAggregateImprovement: FAIL (REQUIRED; actual=0.001998510640172063; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=2; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=3; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.08006843398757976; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.864551825224; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.216138642843; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.000883646063; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=6.202789086540426; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=4374; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":844,"F2":818,"F3":826,"F4":896,"F5":403,"F6":582}; threshold=30 AT_LEAST)

### R2-C1-BTC-STRONG-SYMBOL

- minimumAggregateImprovement: FAIL (REQUIRED; actual=0.008891748042141392; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=2; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=1; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.07317519658561043; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.878152099188; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.243956965563; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.001356869448; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=37.621107262969886; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=2749; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":563,"F2":550,"F3":483,"F4":560,"F5":253,"F6":340}; threshold=30 AT_LEAST)

### R2-C2-STRONG-SYMBOL-RECENT-PULLBACK

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.0382855561691194; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=1; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=3; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.12035250079687122; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.804930279418; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.215821436811; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.001233077982; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=1.3440723436530209; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=3226; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":635,"F2":620,"F3":617,"F4":666,"F5":264,"F6":420}; threshold=30 AT_LEAST)

### R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.04298673753237384; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=1; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=4; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.12505368216012566; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.792327574973; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.246223636621; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.002347004818; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=1.0108117617294197; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=1757; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":322,"F2":342,"F3":345,"F4":342,"F5":156,"F6":248}; threshold=30 AT_LEAST)

### R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT

- minimumAggregateImprovement: FAIL (REQUIRED; actual=-0.006799693034876375; threshold=0.1 AT_LEAST)
- minimumImprovedValidationFolds: FAIL (REQUIRED; actual=2; threshold=4 AT_LEAST)
- catastrophicFoldLimit: FAIL (REQUIRED; actual=3; threshold=0 AT_MOST)
- minimumNetExpectancy: FAIL (REQUIRED; actual=-0.0888666376626282; threshold=0.03 AT_LEAST)
- minimumProfitFactor: FAIL (REQUIRED; actual=0.848497371961; threshold=1.2 AT_LEAST)
- maximumSymbolConcentration: PASS (REQUIRED; actual=0.262571811317; threshold=0.5 AT_MOST)
- maximumSingleTradeConcentration: PASS (REQUIRED; actual=0.003017871456; threshold=0.1 AT_MOST)
- maximumFeeBurdenRatio: FAIL (REQUIRED; actual=2.649633327248964; threshold=0.75 AT_MOST)
- requiredRedundancyImprovement: NOT_APPLICABLE (NOT_APPLICABLE; actual=null; threshold=0.3 AT_LEAST)
- minimumFormalSignals: PASS (REQUIRED; actual=1306; threshold=300 AT_LEAST)
- minimumExecutedTrades: PASS (REQUIRED; actual={"F1":244,"F2":274,"F3":234,"F4":250,"F5":132,"F6":172}; threshold=30 AT_LEAST)

## Frozen boundary

- All nine candidates were evaluated and all eleven gate identities were evaluated for every candidate; no early exit was used.
- Aggregate gates use `aggregateValidation.diagnostics`; the executed-sample gate uses F1-F6 validation diagnostics.
- `requiredRedundancyImprovement` is `NOT_APPLICABLE`, is not `PASS`, and is excluded from the eligibility conjunction.
- This is a signal-level backtest, not a portfolio equity simulation.
- All data through 2026-08-15 is research-available seen data, not true forward OOS.
- baseline-002 remains NOT FROZEN.

NO BASELINE-002 CANDIDATE — ROUND-003
