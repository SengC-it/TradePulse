# Round-029 — Hybrid Directional Architecture Development

## Scope

Round-029 is a bounded `DEVELOPMENT_ONLY` redesign of the directional model architecture. It reuses the immutable, already-seen R14 observation freeze and does not authorize forward validation, Production, email restoration, or automatic trading.

The exact base is `research/round-015-beta-alpha-decomposition` at `39b0fbec69ba5fc59b5c57d028b654f361ea19ce`. The accepted source is `.cache/tradepulse/round-014/observations.ndjson`, identified by SHA-256 `5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359`, 1,893,811,055 bytes, and 244,810 observations. No network acquisition is permitted.

## Frozen architecture

Exactly six configurations are defined and evaluated once: three LONG and three SHORT. The raw representation uses all 18 PIT features with binary logistic L2 regularization (`lambda=10`). The cross-sectional representation uses per-decision-time z-scores over the five frozen symbols. The quadratic representation uses exactly four features selected by research-only primary-positive AUC, four squares, and six pairwise interactions.

LONG configurations rank by cross-sectional score and use a research-only Q90 gate from raw linear probability, raw quadratic probability, or a 50/50 raw-plus-cross-sectional score. SHORT configurations use cross-sectional top-score Q90, cross-sectional top-versus-second margin Q90, or a cross-sectional rank with a raw-quadratic Q90 gate. No absolute `p >= 0.50` gate is used for SHORT.

Selection is top-one per complete decision time. Ties are resolved by score descending, frozen symbol order, then observation ID lexical order. Research rows are used for model fitting and calibration; validation rows are represented as feature-only records until frozen alert IDs have been selected. Economic labels are read only for selected validation IDs.

## Frozen development gates

Each candidate requires at least 50 selected alerts, at least 10 per fold, at least 10 distinct UTC dates, mean net expectancy > 0, net PF > 1, at least four of six positive temporal folds, zero catastrophic folds (fold mean <= -0.10), positive 1.5x cost-stress mean, positive seven-minute latency mean, maximum positive symbol contribution <= 0.50, and selected decision-time rate <= 0.25 in every fold.

Each direction selects at most one champion only after all gates pass. Both champions may be null. A null champion produces `NO_DEVELOPMENT_CHAMPION`; it never creates a forward freeze.

## Economic and governance boundary

This stage permits exactly one historical development economic evaluation over the accepted R14 freeze. It does not read forward economics, does not create a performance ledger, does not execute Production or email behavior, and does not enable automatic trading. If a champion exists, a separately authorized pre-outcome executable freeze is required before any prospective data can be considered.

The R29 implementation is excluded from the generic M3-G1 research-tooling aggregation because it has a dedicated protocol and result contract.
