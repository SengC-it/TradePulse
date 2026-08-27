# Baseline-002 Round-007 Plan

The authoritative plan is the machine record in `src/lib/research/m3-r7-round-007-plan.ts`. Its identity is computed from stable UTF-8 serialization and binds:

- research round `baseline-002-research-round-007`;
- the five-symbol universe `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`;
- six frozen walk-forward folds F1-F6;
- `baseline-001` and `bt-policy-003`;
- public Binance candles, funding, mark price, and declared one-minute settlement windows;
- the Round-007 registry, feature definitions, fixed ridge lambda 10, gates, and mechanical selector.

The accepted Round-006 page cache is reused only after its page identities, checksums, requested ranges, schema, and policy validate. Intrabar requirements are declared before dataset freeze. After the performance lock no network or historical-data acquisition is reachable.

The authoritative run executes exactly one CONTROL backtest. The five candidate streams are deterministic filters/model predictions over that single settled CONTROL opportunity stream, so candidate derivation does not create a second settlement path or a second performance run.

Performance remains research-only. No evidence is written until the data freeze and lock preconditions pass. A post-lock failure is terminal for this round and must not be repaired or rerun.
