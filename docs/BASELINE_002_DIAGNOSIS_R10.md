# Baseline-002 Round-010 diagnosis

Round-009 is invalidated after its performance lock because its event
candidate risk geometry did not conform to the frozen specification. The
classification is `INVALIDATED_AFTER_PERFORMANCE_LOCK` with reason
`EVENT_RISK_GEOMETRY_SPEC_CONFORMANCE_FAILURE`. Round-009 performance source
was `4f282412be846476a8de583c8d4054e6030b49f3`, and its publication head was
`cfb408d4d37f118befb09409ab2788cc4643d886`. Its evidence remains preserved
byte-for-byte and is diagnostic-only; no Round-009 result is used to tune
Round-010.

Round-010 is a strict replay of the same five-candidate Round-009 research
design. The only result-affecting correction is the event risk geometry:
E1 uses the previous five fully closed 1h structural swing candles, E2 uses
the complete closed breakout-through-reclaim path, both place the 0.2 ATR
buffer beyond that structural extreme, both require inclusive `0.8 <=
stopAtr <= 3.0`, and both calculate TP from two times the full stop distance.
C1 retains the exact settled E1 outcome instead of reconstructing a stop.

The correction is implemented in
`src/lib/research/m3-r10-round-010-risk-geometry.ts` and used by the R10
event candidate path. The machine-readable conformance record and its
runtime helper execute deterministic E1/E2, boundary, TP, and C1 identity
checks before performance can begin. A failed check stops the run before the
performance lock.

## Frozen boundary

- Research round: `baseline-002-research-round-010`
- Authoritative main base: `230c9301b8324446327c1274f4ba05089a4b4f99`
- Seen-data boundary: `2026-08-15T23:59:59.999Z`
- Classification: `RESEARCH_AVAILABLE_SEEN_DATA`
- Symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- Strategy: existing framework-independent `baseline-001`
- Settlement: existing `bt-policy-003`

Until the single authorized Round-010 performance execution completes,
performance remains `NOT_AUTHORIZED` / `NOT_GENERATED`, baseline-002 remains
`NOT_FROZEN`, M3-J remains `BLOCKED`, and M4 remains `NOT_STARTED`.

## Governance

Round-010 permits public Binance historical data only. It does not use
private/account APIs, automatic trading, portfolio execution, optimizer or
sweep logic, or result-driven candidate replacement. Formal decisions use
fully closed candles. Dataset and intrabar dependencies are declared and
validated before the performance lock; no market fetch is allowed after the
lock.
