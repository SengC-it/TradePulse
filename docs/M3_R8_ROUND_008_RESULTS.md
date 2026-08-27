# M3-R8 Round-008 Strict Protocol Replay

- researchRoundId: baseline-002-research-round-008
- executionSourceSha: e4662257e512ea08fa2ded6b2d6a171079d02fb0
- selectionGateSha256: d17741dbe39f10e26947fdb8e7d759e4537a6c1b07738a1c71437a7f2ec063ca
- experimentPlanSha256: 1c58382b1d09846dc04728e7f46ab4b7a8771bee9a5228d48ddb983fa8b91812
- dataClassification: RESEARCH_AVAILABLE_SEEN_DATA
- researchBoundary: 2026-08-15T23:59:59.999Z
- studyServerTime: 1787801312279
- performanceLock: FIRST_M3_R8_PERFORMANCE_RESULT_GENERATED
- performanceExecutionCount: 1
- evidenceStatus: COMPLETE
- integrityErrors: none

Evidence completeness is structural and independent from economic performance. CONTROL or candidate economic FAIL does not make evidence incomplete.

## Control and candidate aggregate validation

| candidate | status | formal | executed | net R | expectancy R | PF |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| R7-CONTROL-BASELINE-001 | PERIOD_END_CENSORED | 5415 | 5410 | -443.9821704361374 | -0.08206694462775183 | 0.862601022596 |
| R7-R1-REGIME-EXPECTANCY-ROUTER | COMPLETE | 135 | 135 | 12.47463251010778 | 0.09240468526005763 | 1.153748696996 |
| R7-E1-PULLBACK-RECLAIM | COMPLETE | 0 | 0 | 0 | null | null |
| R7-E2-BREAKOUT-RETEST | COMPLETE | 250 | 250 | -26.993330388190145 | -0.10797332155276058 | 0.811069548996 |
| R7-S1-CALIBRATED-SCORE-V2 | COMPLETE | 372 | 372 | 4.584178360174014 | 0.01232306010799466 | 1.023390557668 |
| R7-C1-RECLAIM-CALIBRATED-SCORE-V2 | COMPLETE | 0 | 0 | 0 | null | null |

## Frozen validation folds

| candidate | fold | research formal/executed | validation formal/executed | validation expectancy R | validation PF |
| --- | --- | ---: | ---: | ---: | ---: |
| R7-CONTROL-BASELINE-001 | F1 | 2085/2085 | 1073/1073 | -0.11193947551070413 | 0.813824697453 |
| R7-CONTROL-BASELINE-001 | F2 | 3158/3158 | 1013/1013 | -0.03953300103614131 | 0.931271182173 |
| R7-CONTROL-BASELINE-001 | F3 | 4171/4171 | 1031/1031 | -0.1996301585156245 | 0.681011455364 |
| R7-CONTROL-BASELINE-001 | F4 | 5202/5202 | 1102/1097 | -0.039493912006640756 | 0.933634339588 |
| R7-CONTROL-BASELINE-001 | F5 | 6304/6299 | 481/481 | 0.10409274467522975 | 1.197749826175 |
| R7-CONTROL-BASELINE-001 | F6 | 6785/6780 | 715/715 | -0.11853045937263298 | 0.812613655576 |
| R7-R1-REGIME-EXPECTANCY-ROUTER | F1 | 0/0 | 0/0 | null | null |
| R7-R1-REGIME-EXPECTANCY-ROUTER | F2 | 0/0 | 0/0 | null | null |
| R7-R1-REGIME-EXPECTANCY-ROUTER | F3 | 0/0 | 0/0 | null | null |
| R7-R1-REGIME-EXPECTANCY-ROUTER | F4 | 0/0 | 0/0 | null | null |
| R7-R1-REGIME-EXPECTANCY-ROUTER | F5 | 0/0 | 0/0 | null | null |
| R7-R1-REGIME-EXPECTANCY-ROUTER | F6 | 0/0 | 135/135 | 0.09240468526005763 | 1.153748696996 |
| R7-E1-PULLBACK-RECLAIM | F1 | 0/0 | 0/0 | null | null |
| R7-E1-PULLBACK-RECLAIM | F2 | 0/0 | 0/0 | null | null |
| R7-E1-PULLBACK-RECLAIM | F3 | 0/0 | 0/0 | null | null |
| R7-E1-PULLBACK-RECLAIM | F4 | 0/0 | 0/0 | null | null |
| R7-E1-PULLBACK-RECLAIM | F5 | 0/0 | 0/0 | null | null |
| R7-E1-PULLBACK-RECLAIM | F6 | 0/0 | 0/0 | null | null |
| R7-E2-BREAKOUT-RETEST | F1 | 84/84 | 45/45 | 0.06056446303678558 | 1.122086265569 |
| R7-E2-BREAKOUT-RETEST | F2 | 129/129 | 65/65 | -0.3787989130947431 | 0.408332362092 |
| R7-E2-BREAKOUT-RETEST | F3 | 194/194 | 37/37 | -0.13482236371720288 | 0.743605171739 |
| R7-E2-BREAKOUT-RETEST | F4 | 231/231 | 47/47 | -0.06310773603762876 | 0.896659826893 |
| R7-E2-BREAKOUT-RETEST | F5 | 278/278 | 30/30 | 0.17996054318253346 | 1.317484136723 |
| R7-E2-BREAKOUT-RETEST | F6 | 308/308 | 26/26 | -0.0977356583791593 | 0.815505113153 |
| R7-S1-CALIBRATED-SCORE-V2 | F1 | 0/0 | 129/129 | -0.14649962359957894 | 0.751678771045 |
| R7-S1-CALIBRATED-SCORE-V2 | F2 | 129/129 | 106/106 | 0.028054963543516553 | 1.056822717366 |
| R7-S1-CALIBRATED-SCORE-V2 | F3 | 235/235 | 50/50 | -0.07650011662280169 | 0.865583793729 |
| R7-S1-CALIBRATED-SCORE-V2 | F4 | 285/285 | 22/22 | -0.45085962158363696 | 0.420720776807 |
| R7-S1-CALIBRATED-SCORE-V2 | F5 | 307/307 | 19/19 | 1.2299194266512194 | 8.104876751662 |
| R7-S1-CALIBRATED-SCORE-V2 | F6 | 326/326 | 46/46 | 0.2366141754024756 | 1.582800899305 |
| R7-C1-RECLAIM-CALIBRATED-SCORE-V2 | F1 | 0/0 | 0/0 | null | null |
| R7-C1-RECLAIM-CALIBRATED-SCORE-V2 | F2 | 0/0 | 0/0 | null | null |
| R7-C1-RECLAIM-CALIBRATED-SCORE-V2 | F3 | 0/0 | 0/0 | null | null |
| R7-C1-RECLAIM-CALIBRATED-SCORE-V2 | F4 | 0/0 | 0/0 | null | null |
| R7-C1-RECLAIM-CALIBRATED-SCORE-V2 | F5 | 0/0 | 0/0 | null | null |
| R7-C1-RECLAIM-CALIBRATED-SCORE-V2 | F6 | 0/0 | 0/0 | null | null |

## Model and router

- Fixed ridge lambda: 10; features: 10; fit scope: EACH_FOLD_RESEARCH_ONLY.
- R1 router cells: 48; validation uses research-eligible cells only.
- Performance result count: 1; CONTROL runs: 1; candidate settlement runs: 0 because candidates are derived filters of the single settled CONTROL stream.

## Boundaries

- Public Binance historical data only; no private API and no automatic trading.
- Closed decision-time candles only; validation never fits, tunes, or changes a model/router.
- PERIOD_END_CENSORED is formal/non-executed and does not invalidate complete evidence; DATA_INCOMPLETE and SETTLEMENT_AMBIGUOUS fail closed.
- Round-007 result values were not used to tune this replay.
- baseline-002: NOT_FROZEN
- M3-J: BLOCKED
- M4: NOT_STARTED
