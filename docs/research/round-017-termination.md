# Round-017 termination

## Decision

`ROUND-017 PERFORMANCE INELIGIBLE — DATA COMPLETENESS`

Round-017 is terminated at the pre-performance boundary. G01 failed because 1666 of 7500 exact baseline-001 formal advisories have no protocol-permitted accepted settlement-label identity. This is a data/provenance termination, not a strategy or economic result.

The 1666 records are earlier than the R14 first observation time, `2023-10-30T23:59:59.999Z`, and were excluded by the R14-specific warm-up/feature-availability observation boundary. R15/R16 contain no exact alternate identity for them; no accepted R13 observation cache exists.

The prior 244810-row preflight was invalidated as `INVALIDATED — FORMAL_STREAM_IDENTITY_MISMATCH` because it treated the R14 observation universe as the R17 formal stream. The corrected chain is:

`historical evaluation timeline → baseline-001 engine → formal predicate → 7500 unique formal advisories → FIRST/FOLLOW_UP classifier → fold/regime annotations → identity-only label audit`

No label values or economic fields were read or calculated by this audit. No new market data was acquired.

## Execution boundary

- `performanceExecutionCount=0`
- `performanceLockTriggered=false`
- No authoritative execution ID or checkpoint
- No performance output or selection output
- `baseline-002=NOT_FROZEN`
- `M3-J=BLOCKED`
- `M4=NOT_STARTED`
- `productionUnchanged=true`
- `automaticTrading=false`
