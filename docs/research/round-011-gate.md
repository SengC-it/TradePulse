# Round-011 selection Gate

The canonical Round-011 Gate is emitted by
`src/lib/research/selection-gates-round-011.ts`. It preserves the accepted
Round-010 numeric thresholds and six-fold conjunctive eligibility rules. The
E2 correction is a pre-performance event-predicate conformance requirement,
not a selection filter.

The five candidates are evaluated independently. A failed applicable gate
makes a candidate ineligible, and incomplete evidence fails closed. Selection
is mechanical and eligibility-first. The inclusive expectancy tie band keeps
the frozen scale-aware IEEE-754 allowance:

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

The canonical Gate SHA is
`b4e5cf79a8715706346e48904c83f755fa6e92462b61324e53c2760b1028a4f1`, emitted
by the machine record and recorded in the conformance manifest and generated
evidence. It is not derived from Round-010
candidate outcomes. Zero eligible candidates produce
`NO BASELINE-002 CANDIDATE — ROUND-011` and leave baseline-002
`NOT_FROZEN`.
