# Round-010 selection Gate

The canonical Round-010 Gate is emitted by
`src/lib/research/selection-gates-round-010.ts`. It preserves the Round-009
economic and statistical thresholds and the six-fold conjunctive eligibility
rules. It adds no result-derived threshold. The corrected risk geometry is
part of the frozen protocol/Plan and is validated before performance; it is
not a selection filter.

The five candidates are evaluated independently. A failed applicable gate
makes a candidate ineligible, and incomplete evidence fails closed. Selection
is mechanical and eligibility-first. The inclusive expectancy tie band keeps
the existing scale-aware IEEE-754 allowance:

```text
difference = maxExpectancy - candidateExpectancy
tolerance = Number.EPSILON * Math.max(
  1,
  Math.abs(maxExpectancy),
  Math.abs(candidateExpectancy),
  Math.abs(threshold),
)
inside iff difference - threshold <= tolerance
```

The canonical Gate SHA is recorded in
`docs/research/round-010-spec-conformance.json` and in generated evidence.
The Plan SHA is recorded alongside it. Both are derived from the frozen
machine records before performance; neither is derived from results.

Zero eligible candidates produce `NO BASELINE-002 CANDIDATE — ROUND-010` and
leave `baseline-002` `NOT_FROZEN`.
