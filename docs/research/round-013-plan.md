# Round-013 machine-frozen Plan

Round-013 is the `FORWARD_EDGE_DISCOVERY` replay for
`baseline-002-research-round-013`. It starts from accepted Round-011 source
`8c38c3eb9a97e9f92654fc4f211c5a8aad96c225`, keeps the frozen historical
boundary `2026-08-15T23:59:59.999Z`, and uses the five-symbol public Binance
universe with the existing F1–F6 purged walk-forward folds.

The observation universe is independent of baseline-001 formal signals:
each complete closed 1h decision timestamp contributes one LONG and one SHORT
opportunity for each approved symbol. The primary advisory execution delay is
fixed at six minutes with canonical UTC 1m normalization. The execution mode is
`ACTIONABLE_MARKET_REFERENCE`: entry uses the first complete 1m open at or
after `signalTime + 6 minutes` and before the one-hour advisory validity
window ends; the seven-minute delay is diagnostic stress only. Forward exits
use the first complete 1m open at `entryTime + H`. A historical NO_ENTRY after
the boundary is a production diagnostic and must not be presented as baseline
historical execution semantics.

F01–F18, research-only standardization, pooled ridge regression with lambda 10,
four fixed horizons, cost/funding treatment, MFE/MAE labels, 24-hour purge,
the A–P conjunctive discovery gates, and the deterministic selection rules are
machine-recorded in the Round-013 source modules and JSON records. No feature
search, optimizer, threshold sweep, symbol identity, or post-boundary
Production data is permitted.

The lifecycle is offline conformance, validated resumable public-data
acquisition (the only R13 command permitted to fetch public data), dataset
freeze, one performance lock, one evaluation, and
publication from frozen artifacts. If required 1m data cannot be recovered
with valid identity, range, chronology, and checksums before the lock, the
workflow stops as `PRE_PERFORMANCE_ABORT`; no synthetic data is allowed.

Performance reads the committed dataset freeze with network acquisition
disabled; missing cache pages abort before the lock. Cross-sectional ranking
diagnostics use every usable symbol-direction opportunity at each validation
timestamp, and deterministic deciles are formed from all usable validation
opportunities within each fold. Performance is `NOT_AUTHORIZED` / `NOT_GENERATED` until the authorized runtime
supplies a clean post-freeze execution SHA. Baseline-002 remains
`NOT_FROZEN`, M3-J remains `BLOCKED`, and M4 remains `NOT_STARTED`.
