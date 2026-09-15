# Round-017 pre-performance closure

Round-017 is closed before authoritative performance. The frozen result is:

`ROUND-017 PERFORMANCE INELIGIBLE — DATA COMPLETENESS`

G01 is a hard data-completeness gate. G02–G06 and G14 pass, but G14 does not authorize performance while G01 fails. G07–G13 were not evaluated because authoritative performance was not executed. G15 remains `NOT_EVALUATED / REPORTING_ALIAS`.

## Frozen structural facts

- Raw evaluation rows: 317520
- Exact baseline-001 formal predicate rows: 7500
- Accepted historical formal rows: 7500
- Formal-stream reconciliation: `PASS`
- Globally unique formal advisories: 7500
- Duplicate canonical identities: 0
- `FIRST`: 5570
- `FOLLOW_UP`: 1930
- Control count: 7500
- Candidate count: 5570
- Suppression rate: 0.25733333333333336
- Same-symbol/same-direction gap `< 4h`: 2074
- Same-symbol/same-direction gap `= 4h`: 252
- Opposite-direction same timestamp: 0

## Identity-only settlement audit

| Category | Count |
| --- | ---: |
| `FORMAL_AND_ACCEPTED_LABEL_IDENTITY_COMPLETE` | 5834 |
| `FORMAL_COMPLETE_R14_OBSERVATION_ID_MISSING_BUT_OTHER_ACCEPTED_LABEL_IDENTITY_EXISTS` | 0 |
| `FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY` | 1666 |
| `FORMAL_SOURCE_PROVENANCE_INCOMPLETE` | 0 |
| Other anomaly | 0 |
| Total | 7500 |

The 1666 missing identities all precede the R14 first observation time, `2023-10-30T23:59:59.999Z`. They are valid R17 formal identities excluded by the R14-specific warm-up/feature-availability observation boundary. No exact alternate identity exists in the accepted R15/R16 caches, and no accepted R13 observation cache exists. No fuzzy, nearest-time, network, backfill, or reconstructed label was used.

R14 observations are an R14/R13 observation universe, not the R17 formal-event authority. The R17 authority is the exact baseline-001 formal stream.

The audit reads identity/provenance metadata only. Label values and economic fields are not read, calculated, or emitted by the R17 audit logic.

## Invalidated earlier diagnostic

The earlier 244810-row result is explicitly:

`INVALIDATED — FORMAL_STREAM_IDENTITY_MISMATCH`

It incorrectly treated `.cache/tradepulse/round-014/observations.ndjson` as the R17 formal advisory stream (`controlCount=244810`, `candidateCount=244810`, `FOLLOW_UP=0`). It is not formal G14 evidence.

## Boundary

- `performanceExecutionCount=0`
- No authoritative execution ID, checkpoint, performance output, or selection output
- Production unchanged
- baseline-001 unchanged
- baseline-002 `NOT_FROZEN`
- M3-J `BLOCKED`
- M4 `NOT_STARTED`
- shadow disabled
- scheduler unchanged
- `automaticTrading=false`
