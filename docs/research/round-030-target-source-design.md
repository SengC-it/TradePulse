# Round-030 Stress-Aligned Target / New Information Source Admission

Status: `TARGET_AND_SOURCE_DIAGNOSTIC_ONLY`

Round-030 inherits the Round-029 conclusion that no LONG or SHORT development champion exists and that the current feature information is not economically actionable. It does not rerun, tune, rank, select, settle, or otherwise alter Round-029.

## Commit boundary

Commit A freezes this protocol, all target and source rules, the runner command, and the tests before any Stage-A diagnostic result is read. Stage A then runs once. Stage B is selected mechanically from the frozen Stage-A result and, when triggered, runs once. Commit B contains only the resulting JSON and Markdown evidence.

## Stage A: stress-aligned target diagnostic

Stage A reuses only the accepted R14 observation freeze at `.cache/tradepulse/round-014/observations.ndjson` (SHA-256 `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`, 244,810 observations, 2023-01-01 through 2026-08-15). It is `DEVELOPMENT_ONLY / ALREADY_SEEN`; no network or new market data is used.

The four frozen binary targets are:

| Target | Definition | Role |
| --- | --- | --- |
| T0 | `labels[4].status === EXECUTED` and `labels[4].netForwardAtr > 0` | baseline only |
| T1 | `labels[4].status === EXECUTED` and `labels[4].netForwardAtrCostStress > 0` | redesign candidate |
| T2 | `latencyStressLabels[4].status === EXECUTED` and `latencyStressLabels[4].netForwardAtr > 0` | redesign candidate |
| T3 | `latencyStressLabels[4].status === EXECUTED` and `latencyStressLabels[4].netForwardAtrCostStress > 0` | redesign candidate; final stress target |

All four models are evaluated against T3. The continuous `stressAlignedNetR` is exactly `latencyStressLabels[4].netForwardAtrCostStress` and is used only for tie-aware Spearman/rank IC. No PnL, profit factor, drawdown, selected alerts, candidate selection, or forward result is produced.

LONG uses fixed `RAW_LINEAR_ALL18`; SHORT uses fixed `XS_LINEAR_ALL18`. Both use binary logistic regression with L2 lambda 10, an unpenalized intercept, 100 iterations, tolerance `1e-10`, and predictor clamp `[-30,+30]`. There are exactly `2 × 4 × 6 = 48` fits. F1–F6 retain the frozen 24-hour purge/embargo. Fitting uses research rows only; validation rows expose exactly `{observationId, decisionTime, symbol, direction, features}`. Scoring occurs before a diagnostic outcome is joined by `observationId`.

T1/T2/T3 are eligible only when every frozen target-information gate passes: median T3 AUC ≥ 0.53; T3 AUC > 0.50 in at least 4/6 folds; worst-fold T3 AUC ≥ 0.48; median stress-aligned rank IC ≥ 0.05; positive rank IC in at least 4/6 folds; and median T3 AUC improvement over T0 ≥ 0.01. At most one eligible target is selected per direction, ordered by worst AUC, median AUC, median rank IC, then lexical target ID. T0 is never selected.

## Stage B: source admission preflight

Stage B is executed exactly once only if LONG or SHORT has no selected target. It probes only the public `BINANCE_VISION_USDM_METRICS` family: seven fixed dates × five fixed symbols, the corresponding public Vision archive ZIP and `.CHECKSUM`, and the five public USD-M futures endpoints for the 2026-09-18 overlap. No private API, paid vendor, economic label, forward return, backtest, or performance execution is allowed.

The archive schema, five field mappings, SHA-256 identity, timestamp hypotheses (`EXACT`, `ARCHIVE_MINUS_5M`, `ARCHIVE_PLUS_5M`), ≥99% unique dominant mapping, exact-schema requirement, ≥99% 5-minute cadence, zero conflicting duplicates, and 35/35 coverage requirement are frozen in Commit A. Historical feature availability is conservatively `archive create_time + 5 minutes`; a Vision archive is never a prospective source. If admitted, the next step is only development-data acquisition. If any source gate fails, the source is ineligible or requires an alternative/paid source.

R20 liquidation closure remains closed. No Round-030 result can authorize a candidate, forward validation, Production, or automatic trading.

## Governance

`economicEvaluationPerformed=false`, `tradingEconomicMetricsCalculated=false`, `candidateExecutableFrozen=false`, `forwardCandidateExists=false`, `forwardValidationAuthorized=false`, `forwardEconomicValuesRead=false`, `forwardReturnRead=false`, `performanceExecutionCount=0`, `automaticTrading=false`, `humanDecisionRequired=true`, Production unchanged, email restoration unauthorized, baseline-002 `NOT_FROZEN`, M3-J `BLOCKED`, and M4 `NOT_STARTED`.

