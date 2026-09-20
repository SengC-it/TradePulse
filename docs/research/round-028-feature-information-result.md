# Round-028 Feature Information / Model Capacity Diagnostic

Status: FEATURE_INFORMATION_DIAGNOSTIC_ONLY

- Base SHA: aef30226d4caa9cc3a579621579170ea8d8f872e
- Accepted source: .cache/tradepulse/round-014/observations.ndjson
- Source SHA256: 5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359
- Feature information diagnostic executions: 1
- Economic evaluation performed: false
- Trading economic metrics calculated: false
- Historical labels read only for diagnostic AUC/Spearman/rank information: true
- Candidate/champion/forward selection: not applicable and not emitted

## LONG

- Classification: CROSS_SECTIONAL_NORMALIZATION_INFORMATION_LOSS
- Recommended next stage: HYBRID_RAW_PLUS_CROSS_SECTIONAL_ARCHITECTURE_REQUIRED
- Features collapsed by cross-sectional normalization: F17_directionAdjustedEma50Breadth, F18_directionAdjustedMomentumBreadth12h
- Stable raw information features: F05_directionAdjustedEma20MinusEma50Atr, F06_directionAdjustedEma20ThreeBarSlopeAtr, F07_directionAdjustedReturn4hAtrPriceScale, F08_directionAdjustedReturn12hAtrPriceScale, F09_directionAdjustedClose1hMinusEma20Atr, F10_atr14OverClose1h, F11_rollingAtrPricePercentile30d, F17_directionAdjustedEma50Breadth, F18_directionAdjustedMomentumBreadth12h

### XS_LINEAR_ALL18

- Primary median AUC: 0.5189369338948737
- Cost-stress median AUC: 0.5287144958881078
- Latency median AUC: 0.51630612540416
- Primary median rank IC: 0.08321692493457143
- Latency median rank IC: 0.07279444535138149
- Absolute information pass: false
- Ranking information pass: true
- Usable information pass: false
- F1-F6 primary AUC: 0.5269370728975472, 0.5129189260138782, 0.5155081569883618, 0.5332084546666318, 0.5167681783444673, 0.52110568944528
- F1-F6 latency AUC: 0.5284540108799479, 0.5132498743504432, 0.5157076980646059, 0.5362686798674547, 0.5139746212831849, 0.516904552743714

### RAW_LINEAR_ALL18

- Primary median AUC: 0.5494306230008195
- Cost-stress median AUC: 0.5616287759953418
- Latency median AUC: 0.5503633370071382
- Primary median rank IC: 0.06107351902416362
- Latency median rank IC: 0.06389095598122656
- Absolute information pass: true
- Ranking information pass: true
- Usable information pass: true
- F1-F6 primary AUC: 0.5522653605815662, 0.562846200729662, 0.5551374828741621, 0.5465958854200729, 0.5279714442838582, 0.5359332100562929
- F1-F6 latency AUC: 0.5552379796788, 0.5634735836669738, 0.5536856464076859, 0.5470410276065906, 0.5302945621915421, 0.533369110590461

### RAW_QUADRATIC_TOP4

- Primary median AUC: 0.5515249039072752
- Cost-stress median AUC: 0.5670626632869916
- Latency median AUC: 0.5512640108071686
- Primary median rank IC: 0.08541400318669735
- Latency median rank IC: 0.07755399036404986
- Absolute information pass: true
- Ranking information pass: true
- Usable information pass: true
- F1-F6 primary AUC: 0.562589035316308, 0.5655024704666267, 0.5615161284776885, 0.5415336793368617, 0.5356026254075519, 0.5290763384668556
- F1-F6 latency AUC: 0.5651613922086167, 0.5651976412084588, 0.5596281850459482, 0.5428998365683889, 0.5382430778992737, 0.5265162572873904

## SHORT

- Classification: INFORMATION_PRESENT_BUT_R27_ARCHITECTURE_MISMATCH
- Recommended next stage: SELECTION_AND_MODEL_ARCHITECTURE_REDESIGN_REQUIRED
- Features collapsed by cross-sectional normalization: F17_directionAdjustedEma50Breadth, F18_directionAdjustedMomentumBreadth12h
- Stable raw information features: F09_directionAdjustedClose1hMinusEma20Atr, F10_atr14OverClose1h, F17_directionAdjustedEma50Breadth

### XS_LINEAR_ALL18

- Primary median AUC: 0.5311829220539798
- Cost-stress median AUC: 0.5411518353407652
- Latency median AUC: 0.5310981206906642
- Primary median rank IC: 0.13349648386464322
- Latency median rank IC: 0.13254010587548487
- Absolute information pass: true
- Ranking information pass: true
- Usable information pass: true
- F1-F6 primary AUC: 0.5307461165044821, 0.5309849867608029, 0.535208389794654, 0.5394458957869388, 0.5260778606914607, 0.5313808573471567
- F1-F6 latency AUC: 0.5302158954153059, 0.5319803459660224, 0.536528278506704, 0.5371699593911717, 0.5265781654789926, 0.5290460838107754

### RAW_LINEAR_ALL18

- Primary median AUC: 0.5265216995220157
- Cost-stress median AUC: 0.5288424203058613
- Latency median AUC: 0.5270609032992706
- Primary median rank IC: 0.061149192683215864
- Latency median rank IC: 0.05980435619427478
- Absolute information pass: false
- Ranking information pass: true
- Usable information pass: false
- F1-F6 primary AUC: 0.5294575536559708, 0.5235858453880604, 0.5192683614803281, 0.5309061993146843, 0.5073179363125104, 0.5331855737521237
- F1-F6 latency AUC: 0.5286764441251937, 0.5254453624733475, 0.5173141570556791, 0.5316566142237977, 0.5110914417709251, 0.5336084086865988

### RAW_QUADRATIC_TOP4

- Primary median AUC: 0.530561446728121
- Cost-stress median AUC: 0.5422012079706446
- Latency median AUC: 0.5331079936679437
- Primary median rank IC: 0.12330163549919962
- Latency median rank IC: 0.11672170559782011
- Absolute information pass: true
- Ranking information pass: true
- Usable information pass: true
- F1-F6 primary AUC: 0.523921583884731, 0.5280318181977243, 0.5286020061904697, 0.5566410125162435, 0.5325208872657723, 0.5784094609986762
- F1-F6 latency AUC: 0.5230330525017644, 0.5299529799160878, 0.5256808814053331, 0.5557582885390134, 0.5362630074197995, 0.57781317513504

## Governance

- newMarketDataFetched=false
- forwardEconomicValuesRead=false
- forwardReturnRead=false
- performanceExecutionCount=0
- candidateExecutableFrozen=false
- forwardCandidateExists=false
- forwardValidationAuthorized=false
- automaticTrading=false
- humanDecisionRequired=true
- Production unchanged
- emailRestorationAuthorized=false

