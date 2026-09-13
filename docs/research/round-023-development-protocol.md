# Round-023 Candidate Development Protocol

Status: `A1_DEVELOPMENT_DATASET_FREEZE`

Round-023 is a finite historical candidate-development study. The source
acquisition amendment and the immutable development dataset freeze are
complete. This protocol authorizes only the one frozen historical development
evaluation described below; it does not authorize the later independent
forward/OOS phase, email restoration, Production changes, or automated
trading.

## R15 disposition

The original R15-forward proposal remains permanently rejected for this round.
R15's final decision was `NO BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015`,
with no selected candidate and no committed immutable final model artifact.
The R15 commits `f46e06083894f99eaf84bec818bf19b564c8603a` and
`c3986653f8b7ef26bb0e58b545fa3426386605e4` are provenance only; neither is a
Round-023 forward anchor. No R15 coefficients are recovered, approximated,
averaged, or reused.

## Source acquisition amendment

The source-policy amendment is `R23-SOURCE-ACQUISITION-001`, committed as
`adfe7ae2453815748cbd331784376a63695dc45d`, with parent
`3646432a3edb204852cf1f09fa08b69d021dffd8`. Its scope is `DATA_SOURCE_ONLY`.
It supersedes the unavailable-cache-only policy with
`PUBLIC_HISTORICAL_SOURCE_ACQUISITION_ALLOWED` for the fixed window
`2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`.

No network request was needed. The dataset freeze reuses the exact accepted
R14 observation identity:

- Observation path: `.cache/tradepulse/round-014/observations.ndjson`
- Observation SHA-256: `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`
- Observation bytes: `1893811055`
- R14 freeze manifest: `docs/research/round-014-observation-freeze.json`
- R14 freeze manifest file SHA-256: `79c8e56560cd6e1ed2de1772071bd0d92ecd2fac4b4ae065cf65f11f583b3e18`
- R14 freeze manifest identity: `7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6`
- Provider lineage: `ACCEPTED_BINANCE_VISION_PUBLIC_ARCHIVE_LINEAGE`

The immutable R23 manifest is
`docs/research/round-023-development-data-manifest.json`, with SHA-256
`365c6d0aadb009f9671e02fa486acc8229255ab56ab7987500dcfbed25ea830a`.
It records 244,810 observations, 48,962 per symbol, 122,405 per direction,
zero duplicate identities, zero post-boundary rows, and complete required
symbol coverage. The R23 normalized path is metadata/provenance only; the
evaluation loader accepts only a source whose bytes and SHA-256 match the
accepted R14 identity.

## Finite search space

The search is frozen before development metrics. It contains two interpretable
ridge families, two thresholds, and four total configurations. Both families
use only existing R13 feature definitions. There are no new indicators, no
optimizer, no random shuffle, and no post-result tuning:

1. `R23_RIDGE_R13_ALL_EXISTING_FEATURES` with thresholds `0.05` and `0.10`.
2. `R23_RIDGE_R13_TREND_CONTEXT_SUBSET` with thresholds `0.05` and `0.10`.

The universe is the existing five symbols, both `LONG` and `SHORT`, with a
closed 1h decision candle and a 4h horizon. Validation uses the existing
`RESEARCH_FOLDS` F1–F6, earlier-data-only training, predict-only validation,
and a 24-hour purge/embargo.

## Frozen economics and gates

The cost identity is `bt-policy-003`: 0.05% fee per side, 0.05% slippage per
side, actual funding events with the correct LONG/SHORT sign, and the net
formula `gross - fees - slippage - funding`. The primary manual latency is
seven minutes. Same-candle TP/SL ambiguity uses causal 1m resolution when
available and otherwise becomes `NOT_EVALUABLE`; optimistic TP selection is
forbidden.

A candidate must have at least 50 settled alerts and 10 distinct UTC decision
dates, aggregate mean net expectancy above zero, net PF at least 1.10, at
least four of six positive temporal folds, no catastrophic fold, positive 1.5x
cost-stress expectancy with PF at least 1.05, positive seven-minute latency
expectancy with PF at least 1.05, and the frozen concentration limits. Missing
data or unresolved ambiguity cannot produce a positive claim.

All four configurations must be evaluated. If none passes every hard gate,
the frozen classification is `NO_FORWARD_CANDIDATE`. If more than one passes,
the frozen lexicographic rule is: pass all hard gates, highest worst-fold net
expectancy, highest cost-stress expectancy, lowest maximum drawdown, simpler
model, then lexical configuration ID. No result may modify these rules.

## Development boundary

The one development evaluation is distinct from formal Performance:

- `developmentEconomicEvaluationExecutionCount=1`
- `performanceExecutionCount=0`
- `performanceLedgerPresent=false`
- `forwardEconomicValuesRead=false`
- `forwardReturnRead=false`
- `newMarketDataFetched=false`
- `automaticTrading=false`
- `humanDecisionRequired=true`
- Production and `main` unchanged
- `baseline-002=NOT_FROZEN`
- `M3-J=BLOCKED`
- `M4=NOT_STARTED`

After the evaluation is published, rerunning the same development window is
forbidden. No threshold, feature subset, fold, cost assumption, latency,
settlement, gate, or selection change is permitted. The independent forward
phase, if ever separately authorized, starts only after a remote immutable
final model freeze; this round has no such model because all four development
configurations failed the frozen gates.
