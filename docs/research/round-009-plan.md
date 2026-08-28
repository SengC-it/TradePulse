# Round-009 machine-frozen Plan

The R9 Plan is `R9_PLAN` in
`src/lib/research/m3-r9-round-009-plan.ts`. It binds the five-symbol public
market universe, six frozen folds, `baseline-001`, `bt-policy-003`, the five
standalone candidate identities, model and stream contracts, closed-candle
rules, pre-lock intrabar declaration, evidence lifecycle, and deterministic
mechanical selection.

The canonical Plan SHA-256 is recorded in
`docs/research/round-009-spec-conformance.json`. The Plan intentionally has
`performance.authorization = NOT_AUTHORIZED`,
`performance.status = NOT_GENERATED`, and a null future execution source.
The authoritative runtime must supply a final clean-worktree source SHA;
that SHA is not predeclared in the Plan.

The runtime sequence is: validate conformance and Plan/Gate records, acquire
and validate the accepted cache-backed study, generate all declared
opportunity streams, discover and persist the union intrabar plan, load and
validate every required window, freeze the dataset, then trigger the one
performance lock. No market fetch is possible after that lock. CONTROL and
all five candidates run once, followed by integrity validation, mechanical
selection, and destination-local atomic publication.

No private Binance API, automatic trading, production change, baseline-001
change, Round-008 tuning, optimizer, sweep, or later milestone is part of the
Plan.
