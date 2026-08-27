# M3-R6 Round-006 Profitability Rebuild Results

- researchRoundId: baseline-002-research-round-006
- executionSourceSha: b4aa9f68bacf1fb24a7a69615da1fde250ee9b5b
- selectionGateSha256: a56ebfa2702ded5d9de0996d3d26b4d2251326e5623e3b37c69f7190e752b871
- experimentPlanSha256: 2619723e98e3ffa083a1833454c838993263d0e7066527abaa373d2e373ef7d9
- dataClassification: RESEARCH_AVAILABLE_SEEN_DATA
- researchBoundary: 2026-08-15T23:59:59.999Z
- studyServerTime: 1787801312279
- dataPreflight: PASS; requests=26
- researchCache: E:\Codex\TradePulse\.worktrees\round-006-profitability-rebuild\.cache\tradepulse\round-006; maxConcurrency=2
- dataFreezeCompleted: true
- datasetIdentitySha256: 865ea8043de553b88c7a5faa558091e0ff7d10c1358d04cd14cf5766a6eb9cc0
- manifestIdentitySha256: 053f7c861dd161d9195b1304a52316b118da971926594b369540b5343bf0660b
- intrabarPlanVersion: m3-r6-round-006-intrabar-plan-001
- intrabarDeclarationHash: acecb0323a8068ca5c0c5b61e1ea8ac41c6741ac5ced12ca40dddfb6b2aeb765
- rawDependencyCount: 171
- uniqueDeclaredWindowCount: 171
- duplicateDependencyCount: 0
- performanceLockBoundary: AFTER_DATASET_FREEZE_BEFORE_CONTROL
- performanceLockDatasetIdentitySha256: 865ea8043de553b88c7a5faa558091e0ff7d10c1358d04cd14cf5766a6eb9cc0
- evidenceStatus: COMPLETE
- performanceLockTriggered: true
- performanceLifecycle: PERFORMANCE_LOCKED
- selectionApplied: false
- selectedCandidateId: null
- baseline002Status: NOT_FROZEN
- m3JStatus: BLOCKED
- m4Status: NOT_STARTED

## CONTROL and candidate aggregate validation

| candidate | result status | formal | executed | gross R | net R | expectancy R | PF | overlap rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| R6-CONTROL-BASELINE-001 | PERIOD_END_CENSORED | 5415 | 5410 | -59.00010864377326 | -443.9821704361374 | -0.08206694462775183 | 0.862601022596 | 0.926500461680517 |
| R6-A1-COOLDOWN-12H | PERIOD_END_CENSORED | 2853 | 2851 | -13.645049043019382 | -222.62646923913948 | -0.07808715160965958 | 0.870962466342 | 0.6386260077111812 |
| R6-A2-COOLDOWN-24H | PERIOD_END_CENSORED | 2113 | 2111 | -48.42775611437979 | -199.63387695746889 | -0.09456839268473183 | 0.843555033908 | 0 |
| R6-A3-COOLDOWN-48H | PERIOD_END_CENSORED | 1405 | 1403 | -17.65569464848919 | -119.2463774387004 | -0.08499385419722053 | 0.858154285348 | 0 |
| R6-B1-TOP1-SCORE | PERIOD_END_CENSORED | 3646 | 3641 | -68.06528453769448 | -330.75328599489865 | -0.0908413309516338 | 0.848177315208 | 0.8477783872737247 |
| R6-B2-TOP2-SCORE | PERIOD_END_CENSORED | 4829 | 4824 | -32.598903305154806 | -379.23944408669433 | -0.07861514180901624 | 0.868086313844 | 0.908055498032719 |
| R6-B3-TOP1-RELATIVE-STRENGTH | PERIOD_END_CENSORED | 3646 | 3641 | -46.272919639864824 | -299.1112760596065 | -0.08215085857171285 | 0.86118764934 | 0.8546352166758091 |
| R6-B4-TOP2-RELATIVE-STRENGTH | PERIOD_END_CENSORED | 4829 | 4824 | -51.49084763631784 | -393.35525872399904 | -0.08154130570563828 | 0.863016324757 | 0.9055705114930628 |
| R6-C1-TREND-FRESHNESS | COMPLETE | 2676 | 2676 | 3.6291952699380854 | -187.00872394569402 | -0.06988367860451944 | 0.883349453811 | 0.843796711509716 |
| R6-C2-FRESHNESS-TOP1-SCORE | COMPLETE | 2051 | 2051 | -27.23688846684518 | -174.37343310591507 | -0.085018738715707 | 0.85915413843 | 0.7630424183325207 |
| R6-D1-BREAKOUT-QUALITY | PERIOD_END_CENSORED | 2996 | 2994 | -74.37352002679268 | -273.4143974550091 | -0.09132077403306918 | 0.843576455217 | 0.770694259012016 |
| R6-D2-PULLBACK-BREAKOUT-QUALITY | PERIOD_END_CENSORED | 2165 | 2163 | -50.49880463373421 | -194.18846979394692 | -0.08977737854551407 | 0.843298773419 | 0.6988452655889146 |
| R6-D3-PULLBACK-BREAKOUT-TOP1 | PERIOD_END_CENSORED | 1595 | 1593 | -18.738642517690806 | -126.62419767139968 | -0.07948788303289371 | 0.860554835462 | 0.6144200626959248 |

## Required diagnostics

- R6-CONTROL-BASELINE-001: maxDrawdownR=-748.353786170991; signalsPerDecisionTimestamp=1.480750246792; maxSimultaneousDirectionalSignals=5
- concentration: symbol=0.209233610342; direction=0.515974145891; regime=0.515974145891
- costs: feeR=366.7162032414934; fundingR=-18.265858550870856; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-A1-COOLDOWN-12H: maxDrawdownR=-404.907205243878; signalsPerDecisionTimestamp=1.305684071381; maxSimultaneousDirectionalSignals=5
- concentration: symbol=0.208552400981; direction=0.501226778829; regime=0.501226778829
- costs: feeR=199.92531886057102; fundingR=-9.056101335549046; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-A2-COOLDOWN-24H: maxDrawdownR=-303.440411431382; signalsPerDecisionTimestamp=1.243289305496; maxSimultaneousDirectionalSignals=5
- concentration: symbol=0.20539517274; direction=0.501183151917; regime=0.501183151917
- costs: feeR=145.19601162226428; fundingR=-6.010109220824989; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-A3-COOLDOWN-48H: maxDrawdownR=-188.696705611615; signalsPerDecisionTimestamp=1.17182756527; maxSimultaneousDirectionalSignals=4
- concentration: symbol=0.20640569395; direction=0.500355871886; regime=0.500355871886
- costs: feeR=97.59157753064173; fundingR=-3.9991052595692884; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-B1-TOP1-SCORE: maxDrawdownR=-489.562354431332; signalsPerDecisionTimestamp=1; maxSimultaneousDirectionalSignals=1
- concentration: symbol=0.209818979704; direction=0.550466264399; regime=0.550466264399
- costs: feeR=250.8059490828448; fundingR=-11.882052374359095; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-B2-TOP2-SCORE: maxDrawdownR=-644.610618282651; signalsPerDecisionTimestamp=1.323790720632; maxSimultaneousDirectionalSignals=2
- concentration: symbol=0.209360115966; direction=0.534272106026; regime=0.534272106026
- costs: feeR=330.14449566488327; fundingR=-16.496045116655136; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-B3-TOP1-RELATIVE-STRENGTH: maxDrawdownR=-433.122190072837; signalsPerDecisionTimestamp=1; maxSimultaneousDirectionalSignals=1
- concentration: symbol=0.239989029073; direction=0.550466264399; regime=0.550466264399
- costs: feeR=240.36783627555693; fundingR=-12.470520144183864; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-B4-TOP2-RELATIVE-STRENGTH: maxDrawdownR=-653.164884781986; signalsPerDecisionTimestamp=1.323790720632; maxSimultaneousDirectionalSignals=2
- concentration: symbol=0.220542555394; direction=0.534272106026; regime=0.534272106026
- costs: feeR=324.8586302555046; fundingR=-17.005780832175525; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-C1-TREND-FRESHNESS: maxDrawdownR=-396.202299689738; signalsPerDecisionTimestamp=1.293351610692; maxSimultaneousDirectionalSignals=5
- concentration: symbol=0.212630792227; direction=0.546337817638; regime=0.546337817638
- costs: feeR=179.89830239076974; fundingR=-10.739616824862015; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-C2-FRESHNESS-TOP1-SCORE: maxDrawdownR=-265.124339790669; signalsPerDecisionTimestamp=1; maxSimultaneousDirectionalSignals=1
- concentration: symbol=0.219405168211; direction=0.579229644076; regime=0.579229644076
- costs: feeR=138.77687066352254; fundingR=-8.359673975547118; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-D1-BREAKOUT-QUALITY: maxDrawdownR=-431.932510126786; signalsPerDecisionTimestamp=1.406559617356; maxSimultaneousDirectionalSignals=5
- concentration: symbol=0.218958611482; direction=0.50567423231; regime=0.50567423231
- costs: feeR=189.98436775782673; fundingR=-9.056509670389348; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-D2-PULLBACK-BREAKOUT-QUALITY: maxDrawdownR=-329.742920346825; signalsPerDecisionTimestamp=1.35704576348; maxSimultaneousDirectionalSignals=5
- concentration: symbol=0.216166281755; direction=0.50623556582; regime=0.50623556582
- costs: feeR=137.30377966800046; fundingR=-6.385885492212041; settlement economics are inherited from bt-policy-003 (including slippage)
- R6-D3-PULLBACK-BREAKOUT-TOP1: maxDrawdownR=-213.338775798975; signalsPerDecisionTimestamp=1; maxSimultaneousDirectionalSignals=1
- concentration: symbol=0.209404388715; direction=0.53605015674; regime=0.53605015674
- costs: feeR=102.78555078809178; fundingR=-5.100004365617315; settlement economics are inherited from bt-policy-003 (including slippage)

## Frozen validation folds

### R6-CONTROL-BASELINE-001

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 1073 | 1073 | -120.11105722298554 | -0.11193947551070413 | 0.813824697453 |
| F2 | 1013 | 1013 | -40.04693004961115 | -0.03953300103614131 | 0.931271182173 |
| F3 | 1031 | 1031 | -205.81869342960886 | -0.1996301585156245 | 0.681011455364 |
| F4 | 1102 | 1097 | -43.324821471284906 | -0.039493912006640756 | 0.933634339588 |
| F5 | 481 | 481 | 50.068610188785506 | 0.10409274467522975 | 1.197749826175 |
| F6 | 715 | 715 | -84.74927845143259 | -0.11853045937263298 | 0.812613655576 |

### R6-A1-COOLDOWN-12H

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 547 | 547 | -50.684252257672554 | -0.09265859644912716 | 0.847343857416 |
| F2 | 554 | 554 | -36.89608894369496 | -0.06659943852652521 | 0.888735313982 |
| F3 | 531 | 531 | -98.60891013781696 | -0.18570416221811104 | 0.706404455416 |
| F4 | 559 | 557 | -20.533939506753068 | -0.03686524148429635 | 0.938302515809 |
| F5 | 272 | 272 | 25.922186523880622 | 0.0953021563377964 | 1.180697934585 |
| F6 | 390 | 390 | -41.82546491708223 | -0.10724478183867238 | 0.832378607975 |

### R6-A2-COOLDOWN-24H

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 396 | 396 | -30.29366082466837 | -0.07649914349663729 | 0.870601035076 |
| F2 | 408 | 408 | -28.716739690746056 | -0.07038416590869132 | 0.882209246366 |
| F3 | 402 | 402 | -71.46225978036375 | -0.17776681537403918 | 0.7143364154 |
| F4 | 425 | 423 | -36.92657525417041 | -0.08729686821316882 | 0.855880628627 |
| F5 | 187 | 187 | 10.23913068983191 | 0.054754709571293636 | 1.103054366783 |
| F6 | 295 | 295 | -42.47377209735219 | -0.14397888846560064 | 0.779263535667 |

### R6-A3-COOLDOWN-48H

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 263 | 263 | -16.407920505413024 | -0.06238753043883279 | 0.892359338146 |
| F2 | 276 | 276 | -15.34105401035577 | -0.05558352902302815 | 0.904669920069 |
| F3 | 267 | 267 | -31.631805598553022 | -0.11847118201705252 | 0.799995773451 |
| F4 | 278 | 276 | -37.99303959941413 | -0.13765594057758743 | 0.787932533107 |
| F5 | 128 | 128 | 6.507198787182388 | 0.05083749052486241 | 1.094716951337 |
| F6 | 193 | 193 | -24.37975651214668 | -0.12631998192822114 | 0.799022637682 |

### R6-B1-TOP1-SCORE

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 765 | 765 | -75.00674634757976 | -0.09804803444128074 | 0.835362227381 |
| F2 | 713 | 713 | -28.9451882208228 | -0.0405963369156 | 0.928478328224 |
| F3 | 684 | 684 | -152.16506393021388 | -0.22246354375762262 | 0.649940306497 |
| F4 | 740 | 735 | -32.10986723766172 | -0.04368689420090029 | 0.926517018049 |
| F5 | 271 | 271 | 25.05782529946412 | 0.09246429999802258 | 1.17640342299 |
| F6 | 473 | 473 | -67.58424555808429 | -0.14288424008051648 | 0.778089622525 |

### R6-B2-TOP2-SCORE

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 984 | 984 | -99.26736478660462 | -0.10088146827906973 | 0.831816469728 |
| F2 | 925 | 925 | -24.935386140885665 | -0.026957174206362882 | 0.952809437377 |
| F3 | 918 | 918 | -189.02066425675596 | -0.20590486302478864 | 0.672017565409 |
| F4 | 972 | 967 | -34.67596409239188 | -0.03585932170878167 | 0.939424469502 |
| F5 | 391 | 391 | 49.05677392767469 | 0.12546489495568974 | 1.241679016124 |
| F6 | 639 | 639 | -80.39683873773 | -0.12581664904183099 | 0.80126235395 |

### R6-B3-TOP1-RELATIVE-STRENGTH

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 765 | 765 | -62.56068424277493 | -0.0817786722127777 | 0.859610833696 |
| F2 | 713 | 713 | -25.361794272811096 | -0.03557053895204922 | 0.937408765867 |
| F3 | 684 | 684 | -142.82643882720066 | -0.20881058308070272 | 0.666774008135 |
| F4 | 740 | 735 | -25.501966133469598 | -0.03469655256254367 | 0.941116330527 |
| F5 | 271 | 271 | 20.560457459664637 | 0.07586884671462965 | 1.145032915914 |
| F6 | 473 | 473 | -63.4208500430143 | -0.13408213539749322 | 0.788946144721 |

### R6-B4-TOP2-RELATIVE-STRENGTH

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 984 | 984 | -101.86994733129758 | -0.10352636923912356 | 0.82693047695 |
| F2 | 925 | 925 | -31.64039507101651 | -0.034205832509207036 | 0.940525374292 |
| F3 | 918 | 918 | -197.61475102066683 | -0.21526661331227323 | 0.656795932374 |
| F4 | 972 | 967 | -30.805339491038655 | -0.03185660753985383 | 0.946161802945 |
| F5 | 391 | 391 | 43.83565546204906 | 0.11211165079807944 | 1.219586954983 |
| F6 | 639 | 639 | -75.26048127202813 | -0.11777853094214105 | 0.813405883632 |

### R6-C1-TREND-FRESHNESS

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 594 | 594 | -98.43716759806311 | -0.1657191373704766 | 0.735779195782 |
| F2 | 491 | 491 | -21.31680023645499 | -0.043415071764674115 | 0.923552334287 |
| F3 | 498 | 498 | -110.35726709976113 | -0.22160093795132757 | 0.667096787923 |
| F4 | 523 | 523 | 44.56487214090349 | 0.08521008057534128 | 1.154482870103 |
| F5 | 229 | 229 | 27.419397007717894 | 0.1197353581123052 | 1.228777259285 |
| F6 | 341 | 341 | -28.88175816003594 | -0.0846972380059705 | 0.863717711795 |

### R6-C2-FRESHNESS-TOP1-SCORE

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 480 | 480 | -65.94624711994747 | -0.1373880148332239 | 0.775315376804 |
| F2 | 398 | 398 | -18.75016822343378 | -0.047110975435763265 | 0.916466385317 |
| F3 | 378 | 378 | -87.83039383359704 | -0.23235553924232022 | 0.653367412122 |
| F4 | 391 | 391 | 13.082690873421367 | 0.03345956745120554 | 1.05865351066 |
| F5 | 154 | 154 | 12.894518113098405 | 0.08373063709804159 | 1.150677279486 |
| F6 | 250 | 250 | -27.823832915456578 | -0.11129533166182631 | 0.82397414184 |

### R6-D1-BREAKOUT-QUALITY

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 580 | 580 | -59.78364156569717 | -0.10307524407878822 | 0.821053790283 |
| F2 | 575 | 575 | -33.90036494823655 | -0.05895715643171574 | 0.89562999709 |
| F3 | 566 | 566 | -142.64969964564906 | -0.25203127145874393 | 0.602907244897 |
| F4 | 605 | 603 | -42.91971309444241 | -0.07117697030587464 | 0.879947130636 |
| F5 | 274 | 274 | 39.22756954229613 | 0.14316631219816106 | 1.286271618219 |
| F6 | 396 | 396 | -33.38854774327952 | -0.0843145145032311 | 0.858067779769 |

### R6-D2-PULLBACK-BREAKOUT-QUALITY

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 421 | 421 | -17.384549012697487 | -0.041293465588355074 | 0.922967150247 |
| F2 | 404 | 404 | -15.070990375659777 | -0.03730443162292024 | 0.932024516926 |
| F3 | 410 | 410 | -117.78930140163004 | -0.287290979028366 | 0.547628422275 |
| F4 | 434 | 432 | -49.77048118205538 | -0.11520944718068374 | 0.809618966295 |
| F5 | 196 | 196 | 21.779421986080266 | 0.11111949992898094 | 1.215761138753 |
| F6 | 300 | 300 | -15.95256980798433 | -0.0531752326932811 | 0.905655564003 |

### R6-D3-PULLBACK-BREAKOUT-TOP1

| fold | validation formal | validation executed | validation net R | validation expectancy R | PF |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 | 337 | 337 | -20.091369986618382 | -0.05961830856563318 | 0.892045423557 |
| F2 | 304 | 304 | -8.967769356639169 | -0.02949924130473411 | 0.945683056525 |
| F3 | 304 | 304 | -83.33321152299123 | -0.27412240632562906 | 0.569471374945 |
| F4 | 315 | 313 | -16.96381546703931 | -0.054197493504917926 | 0.906374017367 |
| F5 | 120 | 120 | 22.888788572287957 | 0.1907399047690663 | 1.410634399523 |
| F6 | 215 | 215 | -20.156819910399655 | -0.0937526507460449 | 0.840480639028 |

## Score diagnostics

Score component wins/losses and OOS buckets are descriptive diagnostics only. They do not tune, reweight, sweep, or gate Round-006.

- OOS score bucket monotonicity: MIXED
- score bucket unassigned count: 0

## Live diagnostic comparison

The following is frozen as seen diagnostic data only and is excluded from Gate, Plan, threshold, and candidate decisions:

- resolved: 16; TP: 3; SL: 13; cumulative R: -7; PF: 0.4615; max DD R: -13
- overlapping active same-symbol/same-direction thesis count: 11

## Integrity and boundary

- integrityErrors: 0
- CONTROL is baseline-001 with bt-policy-003 fees, slippage, funding, and intrabar settlement.
- Gate-by-gate evaluation and candidate selection are deferred to the separate mechanical selection command.
- No Round-006 selection is applied by the performance command.
- No baseline-002 freeze, M3-J start, or M4 start occurs in this batch.
