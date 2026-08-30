# Baseline-002 research — Round-013

Round-013 uses the exact five-symbol public Binance universe, frozen
`baseline-001`/`bt-policy-003` economics, the existing F1–F6 walk-forward
folds, and the historical boundary `2026-08-15T23:59:59.999Z`.

Its observation universe is every complete closed 1h timestamp × symbol ×
direction, not the baseline-001 formal stream. The fixed F01–F18 formulas use
only closed data at or before the decision time. The primary six-minute
actionable delay, one-hour validity window, exact 1m entry/exit semantics,
funding settlements, 1.5× cost stress, and seven-minute latency stress are
predeclared. The model is a pooled deterministic ridge regression with
research-only standardization and lambda 10; there is no feature search,
optimizer, or threshold sweep.

The four horizons are evaluated separately with a 24-hour purge/embargo and
conjunctive A–P discovery gates. Missing or malformed historical inputs fail
closed. No post-lock market fetch is permitted. No private Binance API or
automatic trading is part of the study.
