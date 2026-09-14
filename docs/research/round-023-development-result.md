# Round-023 Development Result

Classification: `HISTORICAL_DEVELOPMENT_RESULT_NON_AUTHORITATIVE`

The one permitted Round-023 candidate-development economic evaluation was
observed after the immutable dataset freeze. All four historical configurations
and their results are preserved, but this result is not authoritative
preregistered proof because `economicRunnerFrozenBeforeOutcomeRead=false`.
The dataset, candidate families, thresholds, folds, cost model, and most gates
were frozen before outcome read; the complete executable evaluator and
selection semantics were not independently frozen before outcome read. This is
historical development evidence only; it is not the later independent
forward/OOS phase.

## Frozen execution

- Branch: `research/round-023-forward-net-expectancy-validation`
- Base: `research/round-015-beta-alpha-decomposition` @ `6924783d26e377a543bfc0d438a2bf6e6c40ba8a`
- Protocol SHA-256: `4cf4ca109ce720155c65a31a0570854e9bbc3ae0150ea6b77e96e4c539a1b803`
- Development execution ID: `r23-development-4cf4ca109ce72015`
- Development economic evaluation execution count: `1`
- Candidate configurations defined/evaluated: `4/4`
- Historical results observed: `true`
- Historical window now seen: `true`
- Rerun of the same window forbidden: `true`
- Historical-window reuse for authoritative evaluation: `false`
- Economic runner frozen before outcome read: `false`

## Candidate outcomes

| Candidate | Selected alerts | Mean net R | Net PF | Cost-stress mean R | Cost-stress PF | 7-minute latency mean R | 7-minute latency PF | Positive folds | Max drawdown R | Eligibility |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| R23_RIDGE_R13_ALL_EXISTING_FEATURES_THRESHOLD_0.05 | 2370 | -0.0964743202769956 | 0.7937227280691866 | -0.14492170462574794 | 0.7071264883228993 | -0.0957560819759816 | 0.7959015886594664 | 0 | -250.8901549284351 | INELIGIBLE |
| R23_RIDGE_R13_ALL_EXISTING_FEATURES_THRESHOLD_0.10 | 1585 | -0.035123049287018406 | 0.9190568928562055 | -0.077883423533116 | 0.8295632891818023 | -0.03280812931572318 | 0.9244900060672316 | 2 | -97.51184572315789 | INELIGIBLE |
| R23_RIDGE_R13_TREND_CONTEXT_SUBSET_THRESHOLD_0.05 | 1239 | -0.017349564588412136 | 0.957259500570848 | -0.048714517205888846 | 0.8846956457651155 | -0.016044351771110826 | 0.9608061237450429 | 3 | -114.83566158931244 | INELIGIBLE |
| R23_RIDGE_R13_TREND_CONTEXT_SUBSET_THRESHOLD_0.10 | 772 | -0.009771032670228014 | 0.9754573953140632 | -0.03676481177846848 | 0.9107248516707187 | -0.005877564836617925 | 0.9852433704352954 | 1 | -61.895862086923515 | INELIGIBLE |

Eligible candidates: `[]`
Selected candidate: `null`
Candidate operational disposition: `DO_NOT_ADVANCE_TO_FORWARD`

All four observed candidates had mean net R below zero, net PF below one,
negative cost-stress mean net R, and negative seven-minute latency mean net R.
The disposition means there is not enough basis to spend forward-validation
observations on these candidates; it does not claim that profitability is
scientifically impossible.

The historical numeric results above are unchanged from the observed result.

## Source and economic boundary

- Development data source: `../round-014-r13-execution-replay/.cache/tradepulse/round-014/observations.ndjson`
- Dataset manifest: `docs/research/round-023-development-data-manifest.json`
- Dataset identity: `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`
- Historical development economic values read: `true`
- Forward economic values/read: `false/false`
- Performance executed/ledger present: `false/false`
- New market data fetched: `false`

## Methodology issue

```json
{
  "economicRunnerFrozenBeforeOutcomeRead": false,
  "datasetFrozenBeforeOutcomeRead": true,
  "candidateFamiliesFrozenBeforeOutcomeRead": true,
  "thresholdsFrozenBeforeOutcomeRead": true,
  "foldsFrozenBeforeOutcomeRead": true,
  "costModelFrozenBeforeOutcomeRead": true,
  "gatesMostlyFrozenBeforeOutcomeRead": true,
  "executableSelectionSemanticsFullyFrozenBeforeOutcomeRead": false
}
```

The issue is specifically that the top-one-per-decision-time selection rule,
the catastrophic-fold implementation threshold, and the full executable
economic evaluator were not frozen by an independent remote commit before the
outcome read.

## Governance

- Production unchanged: `true`
- Main unchanged: `true`
- automaticTrading: `false`
- humanDecisionRequired: `true`
- baseline-002: `NOT_FROZEN`
- M3-J: `BLOCKED`
- M4: `NOT_STARTED`

## Final decision

`ROUND-023 HISTORICAL DEVELOPMENT RESULT — NOT AUTHORITATIVE`

Next stage: `DESIGN_NEW_CANDIDATE_WITH_PRE_OUTCOME_EXECUTABLE_FREEZE`
