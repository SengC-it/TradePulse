# Round-026 Directional Score Calibration Diagnostic

Status: `SCORE_DIAGNOSTIC_ONLY`

Round-026 diagnoses the score pipeline behind the already observed Round-025 directional development result. It does not create a candidate, select a champion, settle a validation outcome, or authorize forward evaluation.

## Frozen boundary

- Base: `research/round-015-beta-alpha-decomposition@99ecad9cfca8487c17a31fbf2c8878e5c9c71ed1`
- Source: the existing immutable R14 observation dataset at `.cache/tradepulse/round-014/observations.ndjson`
- Source SHA256: `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`
- Source size: `1,893,811,055` bytes and `244,810` observations
- Source window: `2023-01-01` through `2026-08-15`
- Source classification: `SEEN_DEVELOPMENT_DIAGNOSTIC_ONLY`
- Network acquisition: forbidden and false

The diagnostic reuses the exact R25 configurations, R25 ridge model implementation, cross-sectional closed-candle normalization, six frozen folds, 24-hour purge, symbol order, and top-one deterministic tie-break. It performs six candidate-fold fits for each of the six predeclared configurations, for 36 deterministic candidate-fold diagnostics.

The raw source loader reads historical training target values globally for rows that are RESEARCH in at least one expanding-window fold. Consequently, F1-F5 validation periods later become RESEARCH periods of subsequent folds and their historical training targets are read when serving as later-fold research data. The compatibility field `validationEconomicValuesRead=true` records that global source fact; it does NOT mean same-fold validation leakage. For every fold, that fold's validation labels are not used by that fold's model fit or score calculation. Validation scoring rows are still projected to `decisionTime`, `symbol`, `direction`, and `features` only, and no validation outcome influences the diagnostic.

## Diagnostic outputs

For every candidate-fold the result artifact records only pipeline metadata, model identity, model scale, prediction distributions, top-per-decision-time prediction distributions, and frozen-threshold diagnostics. It compares the score-only threshold exceedance count with the accepted R25 selected-alert count; it does not select or settle those alerts.

The four pre-frozen classifications are:

1. `PIPELINE_INTEGRITY_FAILURE`
2. `FIXED_RAW_THRESHOLD_SCALE_DRIFT`
3. `MODEL_POSITIVE_SCORE_COLLAPSE`
4. `SCORE_SCALE_OK_MODEL_EDGE_REDESIGN_REQUIRED`

Classification is deterministic and fail-closed. Pipeline integrity is checked before the score-scale branches. The next design recommendation is a diagnostic consequence, not permission to run economics.

## Governance

`scoreCalibrationDiagnosticExecutionCount=1` is the single permitted Round-026 diagnostic execution. `developmentEconomicEvaluationExecutionCount=1` remains unchanged. `economicEvaluationPerformed=false`, `historicalTrainingTargetValuesRead=true`, `globalHistoricalEconomicLabelsRead=true`, `validationEconomicValuesRead=true` (the compatibility field described above), `sameFoldValidationEconomicValuesUsedForFit=false`, `sameFoldValidationEconomicValuesUsedForScoring=false`, `validationOutcomeInfluencedDiagnostic=false`, `crossFoldExpandingWindowResearchReuse=true`, `forwardEconomicValuesRead=false`, `forwardReturnRead=false`, `performanceExecutionCount=0`, `automaticTrading=false`, `humanDecisionRequired=true`, `productionUnchanged=true`, and `emailRestorationAuthorized=false`.

No Round-025 economics command is called by the Round-026 diagnostic. No new market data is fetched. No forward validation, performance, selection, or production action is authorized.
