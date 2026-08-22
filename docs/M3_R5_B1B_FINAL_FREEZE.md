# M3-R5-B.1B-F — Round-005 Final Registry, Gate, and Plan Freeze

Status: **FROZEN / PERFORMANCE NOT AUTHORIZED**

## Authoritative H17 qualification

The one and only H17 qualification used for this freeze ran from:

`b59b9e86a8b1070275c157f571901a6165114670`

The authoritative artifacts are preserved byte-for-byte:

- `docs/evidence/M3_R5_H17_DATA_QUALIFICATION.json`
  - SHA-256: `aa0898d6f760e79675eae251f04fbcdc7afd584bfebf567cdd77189210d8b234`
- `docs/M3_R5_H17_DATA_QUALIFICATION.md`
  - SHA-256: `01aa31e0390c51369ffcff45757eb43226b3ef74084964d0fbde1fd741a51950`

The qualification result is `DATA_NOT_AVAILABLE` /
`H17_DATA_QUALIFICATION=DATA_NOT_AVAILABLE`. H17 is excluded mechanically;
the missing and extra noncanonical slot counts are recorded only as neutral
diagnostic facts. No qualification retry, Binance request, funding-rate
distribution inspection, or alternate H17 candidate is permitted in this
stage.

## Final performance registry

CONTROL:

- `R5-CONTROL-BASELINE-001`

Performance candidates, in frozen order:

1. `R5-H15-HTF-TREND`
2. `R5-H16-NEUTRAL-MEAN-REVERSION`
3. `R5-H18-COMPRESSION-EXPANSION`

Excluded:

- `R5-H17-FUNDING-REVERSAL`
  - reason: `H17_DATA_QUALIFICATION_DATA_NOT_AVAILABLE`

H17 does not appear in `candidateIds`, cannot enter Round-005 performance,
and is not replaced by another candidate. No combinations are allowed.

## Frozen Gate and Plan

- inherited Round-004 Gate SHA-256:
  `c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54`
- Round-005 Gate SHA-256:
  `e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5`
- Round-005 Plan SHA-256:
  `ab16a63462825441e00682f2b2bcbe04cb249e469843ce7f9a097017d992b6d1`

Round-004 numeric thresholds and formulas are inherited without weakening.
The three candidates have `requiredRedundancyImprovement=NOT_APPLICABLE`,
leaving exactly 10 applicable conjunctive gates. The frozen selection outcome
for zero eligible candidates is exactly:

`NO BASELINE-002 CANDIDATE — ROUND-005`

The plan freezes `baseline-001`, `bt-policy-003`, the seen-data research range,
F1–F6 aggregate validation, the H15/H16/H18 definitions, complexity tuples,
the 0.01 tie threshold, and the `FIRST_M3_R5_PERFORMANCE_RESULT_GENERATED`
lock. Once performance begins, result-affecting changes require
`ROUND_005_INVALIDATION_REQUIRED`.

The future performance execution source SHA is intentionally not declared in
B.1B-F. It must be the exact post-B.2 merged implementation source later
authorized by a separate decision.

## Milestone boundary

- performance: **NOT AUTHORIZED / NOT GENERATED**
- `baseline-002`: **NOT_FROZEN**
- M3-J: **BLOCKED**
- M4: **NOT_STARTED**

This freeze does not run a backtest, performance command, candidate selection,
or any market-data access.
