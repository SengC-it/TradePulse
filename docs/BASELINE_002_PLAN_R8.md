# Baseline-002 Round-008 plan

The Round-008 plan is frozen as an exact replay of Round-007's result-affecting
design. Only provenance, schema, and the evidence-completeness lifecycle
classification carry the R8 identity.

## Frozen execution

- CONTROL: `R7-CONTROL-BASELINE-001`, `baseline-001`, `bt-policy-003`, exactly once.
- Candidates: `R7-R1-REGIME-EXPECTANCY-ROUTER`, `R7-E1-PULLBACK-RECLAIM`,
  `R7-E2-BREAKOUT-RETEST`, `R7-S1-CALIBRATED-SCORE-V2`, and
  `R7-C1-RECLAIM-CALIBRATED-SCORE-V2`.
- Six frozen research/validation folds and the same five-symbol universe are
  retained.
- Closed decision-time candles, next-1h-open theoretical entry, and existing
  `bt-policy-003` settlement/economics are unchanged.
- The exact inherited Round-007 Gate record is used; all applicable gates are
  conjunctive and selection remains eligibility-first and mechanical.
- Inherited Gate SHA-256: `d17741dbe39f10e26947fdb8e7d759e4537a6c1b07738a1c71437a7f2ec063ca`.
- Canonical R8 Plan SHA-256: `1c58382b1d09846dc04728e7f46ab4b7a8771bee9a5228d48ddb983fa8b91812`.
- Validation is research-only for the fixed ten-feature ridge model with
  lambda `10` and predicted net-R threshold `+0.05R`.

Intrabar requirements are declared before the dataset freeze and no fetch is
allowed after the performance lock. Validated Round-006/Round-007 cache data
may be reused without redownloading identical content.

## Lifecycle correction

Evidence completeness is structural: dataset freeze, integrity, required data,
settlement, validation datasets, and structural CONTROL execution are checked
independently from economic PASS/FAIL. A losing CONTROL or an all-ineligible
candidate set can therefore produce COMPLETE evidence and a mechanical
`NO BASELINE-002 CANDIDATE — ROUND-008` result. `DATA_INCOMPLETE`, unresolved
`SETTLEMENT_AMBIGUOUS`, and integrity failures remain fail-closed.
