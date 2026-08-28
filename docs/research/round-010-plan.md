# Round-010 machine-frozen Plan

The R10 Plan binds the five-symbol public market universe, six frozen folds,
`baseline-001`, `bt-policy-003`, the five retained candidate identities, the
corrected E1/E2 risk geometry, model and stream contracts, closed-candle
rules, pre-lock intrabar declaration, dataset freeze, one-lock lifecycle,
evidence integrity, and deterministic mechanical selection.

The canonical Plan SHA is recorded in
`docs/research/round-010-spec-conformance.json`. The Plan intentionally has
`performance.authorization = NOT_AUTHORIZED`,
`performance.status = NOT_GENERATED`, and a null future execution source.
The runtime must supply a final clean-worktree execution source SHA; it is
not predeclared in the Plan.

The sequence is offline conformance, cache identity/integrity validation,
all declared opportunity streams, corrected intrabar dependency discovery,
pre-lock window acquisition/validation, dataset freeze, performance lock,
CONTROL and candidates exactly once, Gate, selection, and destination-local
publication. No market fetch is possible after the lock.

No private Binance API, automatic trading, production change, optimizer,
sweep, Round-009 result tuning, or later milestone is part of this Plan.
