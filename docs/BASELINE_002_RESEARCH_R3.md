# baseline-002 Research Round-003 Recovery Protocol

Status: **M3-R3-A UNDER REVIEW / PRE-PERFORMANCE**

This document freezes the offline recovery protocol created after the
Round-002 evidence pipeline was invalidated. It does not report candidate
performance and does not authorize M3-R3-B.

## Frozen provenance

- `researchRoundId`: `baseline-002-research-round-003`
- authoritative source/main commit: `a20803c9cf33aefcb1d376f916eb9fe666f1bf58`
- invalidation merge: `a20803c9cf33aefcb1d376f916eb9fe666f1bf58`
- inherited Round-002 gate SHA:
  `9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0`
- inherited Round-002 plan SHA:
  `82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511`
- Round-003 machine gate SHA:
  `297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2`
- Round-003 plan SHA:
  `d4238bec817425fddd4a1e556277aa58de84c5986da55a9e08b661cc9f621e67`

Round-002 is `INVALIDATED / CLOSED`; `M3-R2-D` is cancelled. Its captured
artifacts are reusable only after the exact SHA and envelope checks below.

## Protocol that remains immutable

Round-003 preserves, without tuning or substitution:

- baseline-001 strategy behavior and `bt-policy-003` economics;
- the 2023-01-01T00:00:00.000Z through 2026-08-15T23:59:59.999Z
  research-available-seen-data universe;
- chronological F1-F6 research/validation folds;
- the baseline-001 CONTROL and the exact nine Round-002 candidates:
  `R2-H6-STRICT-BTC`, `R2-H7-STRONG-SYMBOL`, `R2-H8-RECENT-PULLBACK`,
  `R2-H9-VOLUME-CONFIRM`, `R2-H10-BREAKOUT-010`,
  `R2-C1-BTC-STRONG-SYMBOL`, `R2-C2-STRONG-SYMBOL-RECENT-PULLBACK`,
  `R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT`, and
  `R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT`;
- H6-H10 selector formulas, C1-C4 exact-AND composition, parameters, and
  frozen non-negative-integer complexity tuples;
- all Round-002 gate values, formulas, sample floors, PF semantics,
  concentration/fee rules, redundancy applicability, and tie-break semantics.

All nine candidate redundancy gates remain `NOT_APPLICABLE` because no
candidate declares H1 or H4. `NOT_APPLICABLE` is not a pass.

## Only the following repairs are introduced

### Aggregate validation filtering

The aggregate validation range is the inclusive range from
`F1.validation.startTime` through `F6.validation.endTime`. Before calling the
existing diagnostics function, the recovery path filters records to:

```text
validation.startTime <= record.signalTime <= validation.endTime
```

Only that filtered list is passed to diagnostics. The repair does not change
fold ranges, signal identities, or any performance value.

### Canonical identity ordering

Formal identity hashes include every formal record. Executed identity hashes
include only records with `status = EXECUTED`. Both use the identity
`symbol|direction|signalTime`, serialized as a stable JSON array after sorting
by signal time ascending, frozen symbol order
`BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT`, then `LONG` before `SHORT`.
Duplicate identities, unsupported symbols/directions, and unsafe timestamps
fail closed. No lexical default sort is permitted.

### SHA-verified artifact reuse

The only permitted input artifacts are the existing Round-002 captures:

| Artifact | Required SHA-256 |
| --- | --- |
| CONTROL report | `5ecfae3258d2ace774965eba12df25b888b04593b32e1b92a2593c41fdad8b33` |
| decision snapshots | `65a011d813c55f936f89069706730f5de33dfda9f2eba94f0dfb2b914818eec9` |

The envelope must also match `studyServerTime = 1787031883099`,
`snapshotCount = 7500`, `executionSourceSha =
9df170b7f72a95971825e126d4096e1e4f16be5f`, source round
`baseline-002-research-round-002`, source gate SHA
`9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0`, and
source plan SHA
`82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511`.
Exact matches are labeled
`VERIFIED_REUSABLE_INPUT`; any mismatch is `FAIL_CLOSED`.

The raw captures remain local ignored inputs and are not committed as evidence
or performance results.

### Pre-performance reuse verification

The verifier accepts only `controlReportBytes` and
`decisionSnapshotBytes`. It hashes those exact bytes first, parses both JSON
documents from the verified bytes, and reads the snapshot envelope only from
the parsed snapshot artifact. A separately supplied envelope or CONTROL
object is not part of the API.

The CONTROL contract is frozen to `m3-b-report-004`, `bt-policy-003`,
`baseline-001`, `COMBINED`, `studyServerTime = 1787031883099`, 7,500 formal
results, 7,495 `EXECUTED` results, zero diagnostics, and no
`DATA_INCOMPLETE`/`SETTLEMENT_AMBIGUOUS` result. Economic `FAIL` remains
structurally acceptable.

The immutable Round-001 evidence input is verified by raw SHA-256
`883001ac34470120cdbc754c2f47437bf13b6f13ce6ffb3e4f7795558a6a2fc7`.
`scripts/m3-r3-a-verify-reuse.ts` performs this process offline and reports
`VERIFIED_REUSABLE_INPUT`, `PASS`, and `PASS` only after formal identity,
executed identity, aggregate validation, and each F1-F6 validation diagnostic
matches the Round-001 evidence. The command reads only the two ignored `.tmp`
captures and the committed Round-001 evidence; it does not load market data,
run a backtest, derive candidates, or apply gates.

M3-R3-B requires all three statuses before it can be separately authorized.
The successful verification provenance, when produced, is recorded in
`docs/evidence/M3_R3_A_REUSE_VERIFICATION.json` with no candidate economics
or diagnostics.

## M3-R3-A boundary

M3-R3-A may validate the machine records, verify the raw artifact hashes and
envelope, and test the two corrected offline functions with synthetic
fixtures. It must not call a market-data endpoint, load historical data, run
CONTROL, run a backtest or settlement/funding path, evaluate candidates, or
apply selection gates. It must not import those execution paths.

M3-R3-B is **AUTHORIZED for Commit-A source freeze and one-time offline
derivation**. No candidate diagnostics, performance metrics, candidate
evidence, or `baseline-002` freeze exists yet. M3-J is **BLOCKED** and M4 is
**NOT STARTED**.
