# M3-R16 Round-016 Derivatives Microstructure Information Gain

- researchRoundId: baseline-002-research-round-016
- classification: HISTORICAL_DEVELOPMENT_INFORMATION_STUDY
- executionId: r16-b43de916-8b7e-4d5f-95e6-b4899da9060e
- performanceExecutionSourceSha: 84a31f9faf7fae077feed85157f8a891dffeaec9
- performanceExecutionCount: 1
- performanceLock: FIRST_M3_R16_PERFORMANCE_RESULT_GENERATED

## Control beta

- pooledPearson: 0.066014505864532
- pooledSpearman: 0.08686210282195353
- foldPearson: [["F1",0.08340592996118466],["F2",0.04567468865733429],["F3",0.06629465968167897],["F4",0.05334703420169228],["F5",0.07748731639985365],["F6",0.07613063966158504]]
- signAccuracy: 0.6136173767752715

## Micro beta

- pooledPearson: 0.04905593789544725
- pooledSpearman: 0.07033450250198028
- deltaPooledPearson: -0.01695856796908475
- improvedFolds: 0/6

## Control alpha

- meanTimestampSpearman: 0.02289715516862349
- pooledOpportunitySpearman: 0.0313368027090042
- topBottomSpread: 0.08723622099287304

## Micro alpha

- meanTimestampSpearman: 0.02122411291386362
- pooledOpportunitySpearman: 0.027316918863440023
- deltaMeanTimestampSpearman: -0.001673042254759869
- topBottomSpread: 0.07451779734589553
- improvedFolds: 0/6

## Gates

- D1: PASS (observed {"pooledCoverage":0.988437653211309,"validationFoldCoverages":[0.9926739926739927,0.9664855072463768,0.9949355432780848,0.9979619565217391,1,0.9899482180932074],"trainingFoldCoverages":[0.9738079247817327,0.9878777531159296,0.978681981894286,0.9835123486351508,0.9868649188251983,0.9882036521492946]}; requirement pooled >=90%; every validation fold >=85%; every training fold >=85%)
- D2: FAIL (observed 0.04905593789544725; requirement MICRO pooled Beta Pearson >= +0.08)
- D3: FAIL (observed -0.01695856796908475; requirement MICRO - CONTROL pooled Beta Pearson >= +0.02)
- D4: PASS (observed 6; requirement MICRO Beta Pearson >0 in >=5/6 folds)
- D5: FAIL (observed 0; requirement MICRO Pearson - CONTROL Pearson >= +0.01 in >=4/6 folds)
- D6: PASS (observed [0.06042884526169655,0.01172695015513473,0.05633217685079002,0.051959141120866296,0.08275162275963499,0.07897010652212637]; requirement no MICRO fold Pearson <= -0.02)
- D7: FAIL (observed 0.02122411291386362; requirement MICRO mean timestamp Spearman >= +0.05)
- D8: FAIL (observed -0.001673042254759869; requirement MICRO - CONTROL mean timestamp Spearman >= +0.015)
- D9: FAIL (observed 4; requirement MICRO mean timestamp Spearman >0 in >=5/6 folds)
- D10: FAIL (observed 0; requirement MICRO - CONTROL fold mean timestamp Spearman >= +0.01 in >=4/6 folds)
- D11: FAIL (observed 0.07451779734589553; requirement MICRO top-bottom realized relativeAlpha spread >= +0.15 ATR)
- D12: FAIL (observed -0.012718423646977506; requirement MICRO spread - CONTROL spread >= +0.04 ATR)
- D13: FAIL (observed 4; requirement MICRO spread >0 in >=5/6 folds)
- D14: PASS (observed [0.042077952029520416,0.03357544517338345,0.022466450717260562,-0.013331064216019987,-0.011527777777777767,0.04415384615384615]; requirement no MICRO fold mean timestamp Spearman <= -0.02)
- D15: PASS (observed true; requirement evidence COMPLETE)
- D16: PASS (observed true; requirement model provenance COMPLETE)

- finalDecision: NO ROBUST MICROSTRUCTURE INFORMATION GAIN — ROUND-016
- selectedInformationModel: null
- round017DesignInput: false
- baseline002Status: NOT_FROZEN
- forwardShadowEligible: false
- privateBinanceApi: false
- automaticTrading: false