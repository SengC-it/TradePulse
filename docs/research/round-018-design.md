# Round-018 DESIGN-ONLY — Baseline-001 Score Component Evidence Breadth

Round-018 is a historical development design, not a production promotion. The accepted research source is the exact merge commit `feec11151b334a14754b1f720972c6e2b198960a` on `research/round-015-beta-alpha-decomposition`. The research boundary ends at `2026-08-15T23:59:59.999Z`; `dataClassification` is `RESEARCH_AVAILABLE_SEEN_DATA` and `freshOosClaim` is false.

## Product and prior-round boundary

TradePulse remains signal-advisory-only. There is no private Binance API, automatic trading, production change, scheduler/shadow activation, baseline-002 freeze, M3-J activation, or M4 start.

R13/R14 feature families, R15 beta/alpha models, and R16 derivatives microstructure fields are prior evidence only. R18 does not reweight, threshold-scan, optimize, replace, or repackage them. R16 is `NEGATIVE_EVIDENCE_ONLY`; `OPEN_INTEREST`, `MARK_INDEX_BASIS`, and `TAKER_FLOW_PERSISTENCE` are not R18 inputs. R17 is `PERFORMANCE INELIGIBLE — DATA COMPLETENESS` and supplies no R18 selector, candidate subset, or economic evidence.

## One active research question

Only one hypothesis is active:

`R18-ALL-COMPONENT-CONSENSUS` (`BASELINE_001_SCORE_COMPONENT_EVIDENCE_BREADTH`)

Within the exact frozen R14 native observation universe, does requiring every existing baseline-001 score component to contribute positively improve H4 economics and robustness versus all R14-native baseline-001 formal controls?

The candidate retains an R14-native formal CONTROL observation only when all five existing components are strictly positive:

```text
trendStrength > 0
pullbackQuality > 0
breakoutStrength > 0
volumeScore > 0
riskRewardScore > 0
```

`>0` is a structural topology condition: it means that the existing component family contributed positive evidence. It is not a tuned numeric trading threshold. There is exactly one variant, no combinations, no component-count alternative, no score-point scan, no grade filter, no reweighting, no optimizer, and no machine-learning model. If the rule changes zero events or lacks required breadth, R18 terminates fail-closed; it must not be relaxed to 4/5.

`R18-CROSS-SYMBOL-FORMAL-CONSENSUS` is `REJECTED_DEFERRED` because it overlaps prior breadth work. `R18-HIGH-GRADE-ONLY` is `REJECTED_THRESHOLD_TUNING` because it is direct total-score/grade tuning.

## Frozen source, population, and estimand

The R18 estimand population is `R14_NATIVE_HISTORICAL_OBSERVATION_UNIVERSE`: all `244810` observations in the exact accepted R14 native freeze. The population is bound before any replay or formal filtering. Its control identity is `R14_NATIVE_BASELINE_001_FORMAL_CONTROL`.

Within that exact frozen R14 native observation universe, CONTROL retains every observation whose exact accepted-source baseline-001 replay deterministically satisfies the exact formal predicate:

```ts
candidate?.formalSignal && candidate.totalScore >= 70
```

The five-symbol universe is `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, and `BNBUSDT`; both `LONG` and `SHORT` are included. Grade C remains 70. The scoring, evaluation, total-score, formal-predicate, fold, and regime files are bound to raw SHA-256 values and Git blob identities from the accepted source commit. Validation checks use `git show`/`git cat-file` against that commit rather than trusting working-tree copies.

The formal filter is applied after R14-native population binding. R18 must never construct its population as `global formal stream → inner join R14 → silently retain matched rows`. The global 7,500-event formal stream is not the R18 universe, and the R17 5,834 subset and 1,666 missing-event count are prior evidence only—not selector inputs, expected R18 counts, or a reason to delete, truncate, or reconstruct observations.

The score component maximums are fixed at trendStrength 40, pullbackQuality 20, breakoutStrength 20, volume 10, and riskReward 10. R13/R14 F01–F18 research features are not substitutes for these exact baseline-001 score components.

The canonical R18 observation universe is the pre-existing native R14 freeze, not R17:

- Path: `.cache/tradepulse/round-014/observations.ndjson`
- Accepted count: `244810`
- Accepted SHA-256: `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`
- Manifest: `docs/research/round-014-observation-freeze.json`

R18 does not create or scan this data during DESIGN. It does not choose a custom start date, import the R17 7,500-event stream, truncate for the R17 1,666 missing identities, backfill from the network, fuzzy-match, nearest-match, or reconstruct a new dataset. R17's 1,666 missing events are not fixed, reconstructed, backfilled, or used for date selection; they are outside the R18 frozen R14-native estimand. A future R18 pass cannot be extrapolated to the complete historical baseline-001 formal-advisory stream.

## Future score replay contract

Only a future, separately authorized preflight may perform the following deterministic transformation, starting from the R14-native identities:

```text
R14 native frozen observation identity
→ exact accepted-source baseline-001 decision-time replay
→ deterministic replay status
→ exact formal predicate
→ R14-native formal CONTROL
→ all-five-components > 0 candidate
→ fold/regime annotation
→ later economic evaluation
```

The permitted deterministic replay statuses are `NO_BASELINE_CANDIDATE`, `BASELINE_CANDIDATE_NON_FORMAL`, `BASELINE_FORMAL`, and `PROVENANCE_INCOMPLETE`. A `BASELINE_FORMAL` row requires exact canonical identity, a complete finite five-component breakdown, and exact accepted-source provenance. If an R14-native identity cannot be assigned a deterministic status, it is `PROVENANCE_INCOMPLETE` and G01 fails closed as `ROUND-018 PERFORMANCE INELIGIBLE — SCORE PROVENANCE`; it must not be relabeled `NO_BASELINE_CANDIDATE`. The replay is decision-time-only and label-independent. No replay or data scan was performed by this DESIGN task.

## Frozen protocol

- Primary target: `R14_NATIVE_H4_NET_FORWARD_ATR`
- Primary horizon: H4
- Primary field: `labels[4].netForwardAtr`
- Cost stress: `labels[4].netForwardAtrCostStress`
- Latency stress: `latencyStressLabels[4].netForwardAtr`
- Policy: `bt-policy-003`
- Folds: exact `src/lib/research/folds.ts::RESEARCH_FOLDS`, F1–F6
- Validation: `PURGED_WALK_FORWARD_FIXED_SELECTOR`
- Purge: 24 hours
- Embargo: 24 hours
- Training: not required
- Fold boundary redefinition: forbidden
- Regimes: exact `src/lib/strategy/regimes.ts::calculateBTCRegime`
- Regime labels: `BTC_STRONG_BULL`, `BTC_NEUTRAL`, `BTC_STRONG_BEAR`
- Regime use: reporting/breadth stratification only; thresholds cannot change after freeze

Only `EXECUTED` labels are economically eligible. `NO_ENTRY` and `PERIOD_END_CENSORED` are not economically evaluated; `DATA_INCOMPLETE` is an integrity failure. DESIGN/PRELIGHT may inspect identity/source/status metadata only, never net ATR, returns, P/L, PF, MFE/MAE, fees, funding, slippage, latency value, or cost-stress value.

## Structural and performance gates

Structural gates G01–G07 are frozen before preflight and fail closed:

- G01: exact R14 manifest/hash and accepted replay/source hashes; every R14-native identity receives a deterministic replay status or explicit `PROVENANCE_INCOMPLETE`; every R14-native formal CONTROL row has a complete finite score breakdown and accepted-source provenance; no duplicates, global-formal-to-R14 inner join, fuzzy/nearest join, or synthetic scores; no relevant `DATA_INCOMPLETE`; and no unresolved integrity anomaly.
- G02: decision-time-only classification with no future/outcome dependency.
- G03: candidate economically eligible H4 count `>= 500`.
- G04: candidate H4 `EXECUTED` count `>= 50` in every validation fold F1–F6.
- G05: candidate count `>= 20` for every symbol.
- G06: candidate count `>= 50` in every frozen BTC regime bucket.
- G07: `0 < candidateCount < controlCount`; equality is `ROUND-018 PERFORMANCE INELIGIBLE AT PREFLIGHT — NON-DISCRIMINATIVE SELECTOR`.

Performance gates G08–G15 are frozen now but are not evaluated during DESIGN/PRELIGHT:

- G08: `candidate.meanNetForwardAtr > 0`.
- G09: `candidate.profitFactor >= 1.10`.
- G10: candidate minus CONTROL mean H4 net ATR `>= 0.05`.
- G11: candidate mean is at least CONTROL mean in at least 4/6 validation folds.
- G12: candidate mean H4 net ATR is positive in at least 4/6 validation folds.
- G13: cost-stress mean `>= 0` and cost-stress PF `>= 1.05`.
- G14: latency-stress mean `>= 0` and latency-stress PF `>= 1.05`.
- G15: candidate drawdown is not worse than CONTROL by more than 5% of `abs(CONTROL maximumDrawdownNetAtr)`.

H8/H12/H24 are reporting-only robustness diagnostics and cannot select or rescue an H4 result. A future result cannot change any gate definition.

## One-shot governance and design status

The future authoritative performance limit is one execution, derived only from a round-global ledger at `docs/research/round-018-performance-ledger.json`. That ledger, an execution ID, checkpoints, observation output, performance evidence, and selection output must remain absent during DESIGN. The future execution directory is destination-local and bound to the first ledger execution ID. Alternate directories, second execution IDs, recomputation of completed folds, rebuilding missing/corrupt completed checkpoints, and selection reruns are forbidden. The final summary marker is written last.

Current status is explicitly:

- `performance = NOT_AUTHORIZED / NOT_GENERATED`
- `performanceExecutionCount = 0`
- `performance ledger = ABSENT`
- `selection = NOT_EXECUTED`
- economic values calculated/viewed = `false`
- new market data fetched = `false`
- Production unchanged; baseline-001 unchanged
- baseline-002 = `NOT_FROZEN`
- M3-J = `BLOCKED`
- M4 = `NOT_STARTED`
- `automaticTrading = false`

The machine-readable source of truth is `docs/research/round-018-design.json`; `src/lib/research/m3-r18-round-018-protocol.ts` exposes the same frozen identifiers and design-only status contract. This task does not authorize R18 preflight, observation freeze, performance, selection, or any economic calculation.
