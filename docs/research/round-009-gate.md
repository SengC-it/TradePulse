# Round-009 selection Gate

The R9 Gate is the machine record emitted by
`src/lib/research/selection-gates-round-009.ts`. It is frozen before data
acquisition and has no result-derived thresholds. All applicable hard and
supplemental gates are conjunctive; a failed gate makes a candidate
ineligible, while structural evidence incompleteness remains a separate
fail-closed status.

The Gate SHA-256 is recorded in
`docs/research/round-009-spec-conformance.json` and in the generated evidence.
The frozen requirements include aggregate improvement `>= 0.10R`, at least
four improved validation folds, zero catastrophic folds, aggregate validation
expectancy `>= 0.03R`, PF `>= 1.20`, symbol concentration `<= 0.50`, single
trade concentration `<= 0.10`, fee burden `<= 0.75`, minimum formal/executed
sample floors, positive validation folds, and applicable model integrity.

The expectancy tie band is inclusive at `0.01R`. Its only floating-point
allowance is the scale-aware `Number.EPSILON` formula frozen in the machine
record and implemented by `isWithinInclusiveR9ExpectancyTieBand`. It is not
an economic threshold change.

Selection never tunes or replaces a candidate. Zero eligible candidates
produce `NO BASELINE-002 CANDIDATE — ROUND-009` and leave `baseline-002`
`NOT_FROZEN`.
