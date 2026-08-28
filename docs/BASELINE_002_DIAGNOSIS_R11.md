# Baseline-002 Round-011 diagnosis

Round-010 is invalidated after its performance lock because its E2 retest
implementation failed the frozen event-predicate conformance boundary. The
classification is `INVALIDATED_AFTER_PERFORMANCE_LOCK` with reason
`E2_RETEST_BAND_SPEC_CONFORMANCE_FAILURE`. Round-010 publication remains
preserved as diagnostic, non-authoritative evidence and is not used to tune
Round-011.

Round-011 is one strict spec-conformance replay of the frozen five-candidate
design. It makes no new strategy family, parameter, Gate, Plan, model,
economic, or settlement change. The only result-affecting event correction is
the E2 predicate: the closed retest uses an inclusive two-sided `0.25 ATR`
band around the breakout level, then requires the same candle to close beyond
that level in the signal direction. There is no prior-close prerequisite.

The event generator also retains opportunities through the exact research
boundary `2026-08-15T23:59:59.999Z`. A signal whose frozen holding horizon
crosses the period end remains a formal event and is classified
`PERIOD_END_CENSORED`; it is excluded from executed expectancy/PF and does not
invalidate otherwise complete evidence.

## Frozen boundary

- Research round: `baseline-002-research-round-011`
- Authoritative main base: `230c9301b8324446327c1274f4ba05089a4b4f99`
- Seen-data boundary: `2026-08-15T23:59:59.999Z`
- Classification: `RESEARCH_AVAILABLE_SEEN_DATA`
- Symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- Strategy: existing framework-independent `baseline-001`
- Settlement/economics: existing `bt-policy-003`

The five retained Round-010 architectures are renamed only for the Round-011
replay identity: R1 router, E1 reclaim, E2 breakout/retest, S1 calibrated
score, and C1 E1-plus-score. All frozen thresholds, features, folds, fees,
slippage, funding, risk geometry, and selection rules remain unchanged.

## Governance

Round-011 permits public Binance historical data only. It forbids private or
account APIs, automatic trading, result-driven candidate replacement,
optimizer/sweep behavior, and post-lock market fetches. Formal decisions use
fully closed candles. The accepted Round-006 cache may be reused only after
identity, checksum, range, schema, and closed-candle validation. The complete
CONTROL must reconcile deterministically with the accepted Round-010
baseline-001/bt-policy-003 aggregate before evidence is accepted.

Until the single authorized Round-011 performance execution completes,
performance remains `NOT_AUTHORIZED` / `NOT_GENERATED`, baseline-002 remains
`NOT_FROZEN`, M3-J remains `BLOCKED`, and M4 remains `NOT_STARTED`.
