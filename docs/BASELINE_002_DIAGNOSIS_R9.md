# Baseline-002 Round-009 diagnosis

Round-009 is a bounded spec-conformance replay after Round-008 was invalidated
for a publication/reporting-path defect. The replay is designed to test the
frozen architecture and evidence lifecycle with explicit machine-readable
conformance checks. It is not a Round-008 result repair, parameter search, or
result-driven candidate replacement.

## Frozen boundary

- Research round: `baseline-002-research-round-009`
- Authoritative base source: `230c9301b8324446327c1274f4ba05089a4b4f99`
- Seen-data boundary: `2026-08-15T23:59:59.999Z`
- Classification: `RESEARCH_AVAILABLE_SEEN_DATA`
- Symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- Strategy: existing framework-independent `baseline-001`
- Settlement: existing `bt-policy-003`

The Round-007 result remains invalidated and Round-008 remains
`INVALIDATED_NON_AUTHORITATIVE`. Round-008 values are not used to tune R9.
The accepted Round-006 cache may be reused only after identity, checksum,
range, schema, and closed-candle validation.

## Structural conformance corrections

The R9 machine record freezes zero result-affecting deviations and explicitly
checks these boundaries:

- E1 is a direct closed-candle EMA20/EMA50 pullback interaction and reclaim;
  it has no baseline-formal membership prerequisite.
- E2 is a direct closed-candle breakout/retest event and is not a CONTROL
  settlement transform.
- S1 consumes the declared baseline pre-score opportunity stream.
- C1 consumes its declared E1 opportunity stream and has candidate-local
  settlement.
- The fixed feature identity uses the 4-hour close and the router volatility
  identity uses `ATR14_1H / CLOSE1H`.
- Intrabar requirements are the union of all frozen consumers, are declared
  before dataset freeze, and cannot be fetched after the performance lock.
- The only model contract is the fixed ten-feature ridge arithmetic with
  lambda `10`; validation does not fit, tune, or update it.

The complete machine record is
`docs/research/round-009-spec-conformance.json`. Runtime preflight, the
runtime-import smoke, and the authoritative runner parse and validate that
UTF-8 record before continuing.

## Governance

R9 permits public Binance historical data only. It does not use private or
account APIs, automatic trading, portfolio execution, optimizer/sweep logic,
or post-result candidate replacement. Formal decisions use fully closed
candles. Performance remains `NOT_AUTHORIZED` / `NOT_GENERATED` until the
separate runtime preflight and one explicit authoritative execution.

Until that execution completes, `baseline-002` is `NOT_FROZEN`, M3-J is
`BLOCKED`, and M4 is `NOT_STARTED`.
