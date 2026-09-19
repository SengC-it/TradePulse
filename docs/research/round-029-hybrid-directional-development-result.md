# Round-029 Hybrid Directional Architecture — Development Result

- Base: `research/round-015-beta-alpha-decomposition` @ `39b0fbec69ba5fc59b5c57d028b654f361ea19ce`
- Development window: `2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`
- Data classification: `DEVELOPMENT_ONLY / ALREADY_SEEN`; this historical window is not authoritative forward proof.
- Source: `.cache/tradepulse/round-014/observations.ndjson` (5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359)
- R29 development economic evaluation execution count: `1`
- Protocol SHA-256: `51252651815a27c25c4f9a3303d159493f208d1a5e15c9bb829f11586c84ce19`

## Candidate results

| Candidate | Direction | Selected | F1 | F2 | F3 | F4 | F5 | F6 | Mean net R | PF | Cost stress | 7m latency | Positive folds | Catastrophic folds | Symbol share | Selected-rate | Eligibility |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| R29_LONG_RAW_LINEAR_GATE_XS_RANK | LONG | 1784 | 391 | 483 | 449 | 255 | 145 | 61 | 0.006864335205065879 | 1.016222575545107 | -0.037074584440703315 | 0.007318758740406901 | 2 | 2 | 0.4468825286390232 | 0.109375 | INELIGIBLE |
| R29_LONG_RAW_QUADRATIC_GATE_XS_RANK | LONG | 1697 | 287 | 509 | 436 | 277 | 131 | 57 | -0.004703068762072957 | 0.9889162108563315 | -0.049719327999501364 | -0.004368406652096812 | 2 | 2 | 0.4231858295125581 | 0.11526268115942029 | INELIGIBLE |
| R29_LONG_RAW_GATE_BLENDED_RANK | LONG | 1742 | 388 | 444 | 446 | 258 | 145 | 61 | 0.01807631980557942 | 1.0437125745007814 | -0.026855149943187995 | 0.019063287105403875 | 2 | 1 | 0.4161875741176435 | 0.10267034990791897 | INELIGIBLE |
| R29_SHORT_XS_TOP_SCORE_Q90 | SHORT | 917 | 389 | 166 | 66 | 124 | 100 | 72 | -0.10606461269843719 | 0.8002920640270352 | -0.17840844099330888 | -0.11109590912496811 | 2 | 2 | 0.6186310763945022 | 0.08905677655677656 | INELIGIBLE |
| R29_SHORT_XS_MARGIN_Q90 | SHORT | 660 | 363 | 128 | 31 | 32 | 25 | 81 | -0.2064637004371408 | 0.6578319689816274 | -0.2821940832844496 | -0.20998223601675747 | 3 | 3 | 0.706515126667982 | 0.0831043956043956 | INELIGIBLE |
| R29_SHORT_XS_RANK_RAW_QUADRATIC_GATE | SHORT | 1366 | 256 | 319 | 367 | 273 | 122 | 29 | -0.14828378588680874 | 0.7326982795275889 | -0.2122017259283377 | -0.1483656564688624 | 1 | 3 | 0.3965917974330634 | 0.08448434622467772 | INELIGIBLE |

- LONG champion: `null`
- SHORT champion: `null`
- Development classification: `NO_DEVELOPMENT_CHAMPION`

## Frozen boundary

- Cost policy: `bt-policy-003`; both directions use the same fee, slippage, direction-correct Funding, causal settlement, and 7-minute latency semantics.
- For each fold, only research labels were used for fitting/calibration; validation features were scored and top-one alerts selected before selected validation economic labels were read.
- No forward economic values were read, no post-freeze data was fetched, and no Production or email behavior was changed.

## Governance

- `humanDecisionRequired=true`; `automaticTrading=false`; `Production unchanged`; `emailRestorationAuthorized=false`
- `performanceExecutionCount=0`; `performanceLedgerPresent=false`; `baseline-002=NOT_FROZEN`; `M3-J=BLOCKED`; `M4=NOT_STARTED`

## Final decision

Final decision: ROUND-029 DEVELOPMENT COMPLETE — NO DEVELOPMENT CHAMPION

Next stage: CURRENT_FEATURE_INFORMATION_NOT_ECONOMICALLY_ACTIONABLE
