# M3-R12 Round-012 Thesis Deduplication / Follow-up Edge Study

- researchRoundId: baseline-002-research-round-012
- executionSourceSha: 6a3703e19bde603268ce09f366ceae228530ff00
- selectionGateSha256: 0fe5c32de12a5b9306d27f794008514bcff910674fa50a3a8bb187ddfa62b8d0
- experimentPlanSha256: 8fd4818a4032fcad52749d97ff0a0580683bf7b32c2fde1a6541410d6db204ef
- dataClassification: RESEARCH_AVAILABLE_SEEN_DATA
- researchBoundary: 2026-08-15T23:59:59.999Z
- performanceLock: FIRST_M3_R12_PERFORMANCE_RESULT_GENERATED
- performanceExecutionCount: 1
- evidenceStatus: COMPLETE
- integrityErrors: none

## Control and retained-candidate validation

| candidate | formal | executed | net R | expectancy R | PF | max DD | reduction % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| R12-CONTROL-BASELINE-001 | 5415 | 5410 | -443.9821704361374 | -0.08206694462775183 | 0.862601022596 | -470.411660319261 | 0 |
| R12-D1-FIRST-ONLY | 2398 | 2396 | -202.1130644657578 | -0.08435436747318772 | 0.859183485948 | -210.775638316183 | 54.92 |
| R12-D2-FIRST-PLUS-ONE | 3780 | 3777 | -342.01724123951493 | -0.09055261880844981 | 0.84926801586 | -354.755793132799 | 28.693333333333 |

## Cohort diagnostics

| cohort | formal | executed | TP | SL | NO_ENTRY | PERIOD_END_CENSORED | expectancy R | PF | net R | fee R | funding R | median holding h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FIRST | 3381 | 3379 | 771 | 1620 | 0 | 2 | -0.09588832402683559 | 0.842219804222 | -324.00664688667746 | 248.44931760281762 | -9.013636158177848 | 12.999999722222222 |
| FOLLOWUP_1 | 1967 | 1966 | 448 | 971 | 0 | 1 | -0.11348939526213875 | 0.816367558708 | -223.12015108536477 | 146.8228706838052 | -6.224137456870473 | 11.999999722222222 |
| FOLLOWUP_2_PLUS | 2152 | 2150 | 518 | 1037 | 0 | 2 | -0.08872360237734339 | 0.854712627304 | -190.7557451112883 | 155.58192942647935 | -7.2442178951356 | 11.999999722222222 |

## Selection

- finalDecision: NO THESIS-DEDUP CANDIDATE — ROUND-012
- eligibleCandidateIds: none
- selectedCandidateId: null

Selection is eligibility-first and mechanical. Cohort bins and production observations are diagnostic-only.

## Boundaries

- Source stream is exact baseline-001 formal output; only retention changes.
- Candidate settlement is the exact CONTROL settlement identity; no candidate settlement rerun.
- Public historical data only; no private Binance API and no automatic trading.
- Production post-boundary observations are excluded from Gate, training, and selection.
- baseline-002: NOT_FROZEN
- M3-J: BLOCKED
- M4: NOT_STARTED
