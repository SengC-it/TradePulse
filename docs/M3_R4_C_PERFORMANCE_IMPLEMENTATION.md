# M3-R4-C — Round-004 Performance Implementation Source Freeze

Status: **UNDER REVIEW / PERFORMANCE SOURCE FREEZE**

Round-004 performance is **NOT EXECUTED** and remains **NOT AUTHORIZED** by
this milestone. `baseline-002` remains **NOT FROZEN**, M3-J is **BLOCKED / NOT
STARTED**, and M4 is **NOT STARTED**.

## Frozen provenance

- authoritative source base: `fd42381d903f9b60ec98e7b297578de95dc8160b`
- research round: `baseline-002-research-round-004`
- Gate SHA:
  `c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54`
- Plan SHA:
  `f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981`
- performance lock: `FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED`

The implementation preserves `baseline-001`, `bt-policy-003`, the frozen
five-symbol universe, the existing 24-held-candle settlement policy, and the
frozen H11-H14 decision definitions. It adds no optimizer, threshold search,
candidate combination, trading path, private Binance API, or alternate data
source.

## Source layout

- `m3-r4-round-004-loader.ts` loads the unchanged standard 24-held study and
  an H13-only `SETTLEMENT_ONLY` extension for held candles #25–#48. The
  extension uses the same study server time and is never decision data.
- `m3-r4-round-004-settlement.ts` contains the H13 research-only raw result
  type and 48-held Phase-B settlement. It keeps the original stop distance as
  the R denominator and preserves raw `TREND_EXIT`.
- `m3-r4-round-004-performance.ts` builds the official baseline cache, H11,
  H12, H13, and H14 populations, discovers intrabar requirements, verifies
  same-run CONTROL identity parity, and creates the Round-004 report.
- `m3-r4-round-004-evidence.ts` canonicalizes signal identities, separates
  decision and outcome audit records, computes F1–F6 diagnostics from the
  exact validation union, and serializes schema
  `m3-r4-round-004-report-001` without applying gates or selection.

The command entry point is `scripts/m3-r4-performance.ts`. It is deliberately
guarded and must be invoked with all of:

```text
npm run research:m3r4:performance -- \
  --confirm-authoritative-run \
  --source-sha <exact-approved-execution-source-sha> \
  --round baseline-002-research-round-004 \
  --gate-sha c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54 \
  --plan-sha f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981
```

Before any loader or network object is used, the command requires the exact
HEAD/source SHA, a clean worktree, successful Gate and Plan validators, the
exact round and SHA values, and no existing evidence outputs. Missing or
invalid arguments fail closed. Evidence publishing is an overwrite-rejecting
atomic operation. This source-freeze milestone does not invoke the command.

## Execution architecture for a later authorization

1. **Phase A — decision and requirement discovery.** Load the standard study,
   build the baseline cache and outcome-blind candidate populations, discover
   the union of CONTROL/H11/H12/H13 intrabar requirements, and reject
   conflicting identities. No net R, PF, performance metrics, or evidence
   status is computed in this phase.
2. **Phase B — one final settlement pass.** Load each canonical 1m window once
   with the same authoritative server time, append windows only to settlement
   data, run the existing CONTROL, verify same-run identity parity, settle H11
   and H12 with the standard policy, settle H13 with 48 held candles, and
   reuse the matching CONTROL outcome for H14. H13's extension remains
   `SETTLEMENT_ONLY` and never reaches Strategy Engine decision inputs.
3. **Evidence serialization.** Emit the Round-004 report and separate audit
   artifact only after a separately authorized run. The report's decision is
   `DEFER_TO_M3_R4_D_FROZEN_GATE_APPLICATION`; no gate result, selected
   candidate, or baseline-002 freeze is emitted here.

All tests are synthetic/offline. The dedicated M3-R4-C suite contains 262
tests and does not call Binance, the historical loader, CONTROL, or the
performance command.

## C.3 pre-performance H11 warm-up remediation

Authoritative Round-004 execution attempt #6 aborted before performance while
building the H11 origin support cache with `DATA_INCOMPLETE`: the standard
historical candle range did not contain a complete 250-candle Strategy Engine
window at the earliest support time, four 1H hours before the frozen research
start. No CONTROL run, performance result, or evidence artifact was
generated, and the performance lock remains `NOT_TRIGGERED`.

The C.3 remediation extends only the Round-004 decision candle request starts
for 1H and 4H by the exact four-hour H11 support offset. It leaves the frozen
official evaluation timeline, research universe, settlement tail, H11
semantics, H12/H13/H14 definitions, Gate and Plan content, economics, and
candidate definitions unchanged. This is a historical decision warm-up fix
only; it does not claim performance success or authorize another execution.
