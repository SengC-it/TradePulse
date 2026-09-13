# Round-023 Candidate Development Protocol

Status: `A0_DEVELOPMENT_PROTOCOL_FREEZE`

Round-023 is a finite historical development study. It does not authorize
the independent forward/OOS result, email restoration, Production changes,
or automated trading.

## R15 disposition

The original R15-forward proposal is permanently rejected for this round.
R15's final decision was `NO BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015`,
with no selected candidate and no committed immutable final model artifact.
Its runtime requires fit/refit. The R15 commits
`f46e06083894f99eaf84bec818bf19b564c8603a` and
`c3986653f8b7ef26bb0e58b545fa3426386605e4` are provenance only; neither is a
Round-023 forward anchor. No R15 coefficients are recovered, averaged,
approximated, or reused.

## Finite search space

The search is frozen before development metrics. It contains two
interpretable ridge families, two thresholds, and four total configurations.
Both families use only existing R13 feature definitions. There are no new
indicators, no optimizer, no random shuffle, and no post-result tuning.

The universe is the existing five symbols, both `LONG` and `SHORT`, with a
closed 1h decision candle and a 4h horizon. Validation uses the existing
`RESEARCH_FOLDS` F1-F6, earlier-data-only training, predict-only validation,
and a 24-hour purge/embargo.

The fold identity is frozen to `src/lib/research/folds.ts` (`RESEARCH_FOLDS`,
also exposed by the R13 `R13_FOLDS` contract):

| Fold | Research range | Validation range |
| --- | --- | --- |
| F1 | 2023-01-01 through 2023-12-31 | 2024-01-01 through 2024-06-30 |
| F2 | 2023-01-01 through 2024-06-30 | 2024-07-01 through 2024-12-31 |
| F3 | 2023-01-01 through 2024-12-31 | 2025-01-01 through 2025-06-30 |
| F4 | 2023-01-01 through 2025-06-30 | 2025-07-01 through 2025-12-31 |
| F5 | 2023-01-01 through 2025-12-31 | 2026-01-01 through 2026-03-31 |
| F6 | 2023-01-01 through 2026-03-31 | 2026-04-01 through 2026-08-15 |

## Historical data boundary

Development may use only the existing historical cache identity from
`docs/research/round-015-observation-freeze.json` and
`.cache/tradepulse/round-015/observations.ndjson`, bounded by
`2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`.
The expected manifest SHA-256 is
`214b263282be58908b631f4c4f63c85daab0a1ffee5b6ef24cb4a3c79af7d1bc`; the
expected observation-data SHA-256 is
`6f16065a7c1a763a2da35f2f60afc5c2b2a95cf44da5586abcfa760fdc7a1574`.
At A0 this data file is not materialized in the R23 worktree, so the runner
is fail-closed and will not read economic values or acquire data.

## Frozen economics and decision gates

The cost identity is `bt-policy-003`: 0.05% fee per side, 0.05% slippage
per side, actual funding events with the correct LONG/SHORT sign, and the
net formula `gross - fees - slippage - funding`. The primary manual latency
is seven minutes. Same-candle TP/SL ambiguity uses causal 1m resolution when
available and otherwise becomes `NOT_EVALUABLE`; optimistic TP selection is
forbidden.

A candidate must have at least 50 settled alerts and 10 distinct UTC decision
dates, aggregate mean net expectancy above zero, net PF at least 1.10, at
least four of six positive temporal folds, no catastrophic fold, positive
1.5x cost-stress expectancy with PF at least 1.05, positive seven-minute
latency expectancy with PF at least 1.05, and the frozen concentration
limits. Missing data or unresolved ambiguity cannot produce a positive
claim.

If no configuration passes every hard gate, the only result is
`NO_FORWARD_CANDIDATE`; thresholds and windows must not be changed.
If more than one passes, use the frozen lexicographic rule in the JSON:
hard-gate pass, worst-fold net expectancy, stress expectancy, drawdown,
simplicity, then lexical configuration ID.

The later independent forward phase, if ever separately authorized, must
start at the first fully closed eligible decision candle strictly after the
remote publication time of the immutable final candidate freeze. That
forward phase is not executed by A0 or by this development protocol.

## Governance

`performanceExecutionCount=0`, `performanceLedgerPresent=false`,
`forwardEconomicValuesRead=false`, `newMarketDataFetched=false`,
`automaticTrading=false`, `humanDecisionRequired=true`, Production and main
unchanged, `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, and `M4=NOT_STARTED`.
