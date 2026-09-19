# Round-028 Feature Information / Model Capacity Diagnostic

Status: `FEATURE_INFORMATION_DIAGNOSTIC_ONLY`

Round-028 evaluates whether the already frozen R14 feature information is visible across the six expanding-window folds, whether cross-sectional normalization removes information, and whether the bounded probe family exposes a capacity limitation. It is not candidate development, economic strategy evaluation, forward validation, or trading authorization.

## Frozen boundary

- Base: `research/round-015-beta-alpha-decomposition @ aef30226d4caa9cc3a579621579170ea8d8f872e`
- Source: `.cache/tradepulse/round-014/observations.ndjson`
- Source SHA256: `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`
- Source manifest SHA256: `7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6`
- Source size/count: `1,893,811,055` bytes / `244,810` observations
- Window: `2023-01-01` through `2026-08-15`
- Classification: `DEVELOPMENT_ONLY / ALREADY_SEEN`
- Features: the exact frozen `R13_FEATURE_NAMES` list (18 fields), with no additions or removals
- Folds: F1-F6 with 24-hour purge/embargo; LONG and SHORT are independent

## Diagnostic contract

Research rows fit the primary positive label only. Validation scores are computed from feature-only rows and are joined to the independent outcome projection by `observationId` only after scoring. No validation outcome is used for fitting, orientation, top-four selection, scoring, or threshold tuning.

The three fixed probes are `XS_LINEAR_ALL18`, `RAW_LINEAR_ALL18`, and `RAW_QUADRATIC_TOP4`. The first two use 18 terms; the last uses four raw terms, four squares, and six pairwise interactions (14 terms). All use deterministic L2 logistic parameters `lambda=10`, unpenalized intercept, maximum 100 iterations, and tolerance `1e-10`.

Feature metrics use tie-aware midrank AUC and Spearman calculations for primary, 1.5x-cost-stress, and 7-minute-latency diagnostic targets. Cross-sectional collapse is reported from the frozen `<=0.05` non-zero decision-time rate. The five direction classifications are applied in their frozen priority order and are diagnostic classifications only.

## Governance

`featureInformationDiagnosticExecutionCount=1` is the only permitted diagnostic execution. `economicEvaluationPerformed=false`, `tradingEconomicMetricsCalculated=false`, `newMarketDataFetched=false`, `forwardEconomicValuesRead=false`, `forwardReturnRead=false`, `performanceExecutionCount=0`, `candidateExecutableFrozen=false`, `forwardCandidateExists=false`, `forwardValidationAuthorized=false`, `automaticTrading=false`, and `humanDecisionRequired=true`. Production is unchanged; `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, and `M4=NOT_STARTED`.

The result must not emit a candidate, champion, trading signal, expected trading profit, or forward-validation conclusion.
