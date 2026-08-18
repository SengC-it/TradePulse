# baseline-002 Round-003 Selection Gates

Status: **M3-R3-A UNDER REVIEW / PRE-PERFORMANCE**

Round-003 uses the Round-002 gate contract without changing its values or
semantics. The machine record is
`BASELINE_002_RESEARCH_ROUND_003_MACHINE_RECORD` and its canonical SHA-256 is:

```text
297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2
```

The Round-003 plan SHA-256 is:

```text
d4238bec817425fddd4a1e556277aa58de84c5986da55a9e08b661cc9f621e67
```

The inherited Round-002 gate and plan SHAs are, respectively,
`9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0` and
`82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511`.

Candidate gates remain unchanged. Before any future M3-R3-B authorization,
the exact SHA-verified raw-artifact reuse status, CONTROL validation status,
and offline CONTROL parity status must all pass according to the canonical
Round-003 plan; this precondition does not apply a candidate gate or generate
performance.

## Frozen gate values

The conjunction is unchanged:

| Gate | Requirement |
| --- | --- |
| Aggregate improvement | at least `0.10 R` |
| Improved validation folds | at least `4` |
| Catastrophic folds | at most `0` |
| Net expectancy | at least `0.03 R` |
| Profit factor | at least `1.20` |
| Symbol concentration | at most `0.50` |
| Largest single-trade concentration | at most `0.10` |
| Fee burden ratio | at most `0.75` |
| Required redundancy improvement | at least `0.30` when applicable; N/A otherwise |
| Formal signals | at least `300` |
| Executed trades | at least `30` in each fold |
| Complexity tie threshold | `0.01 R` |

The exact inherited PF status rules, fold-improvement definition,
catastrophic-fold definition, concentration denominator, fee-burden handling,
and five-step tie-break remain the Round-002 contract. A structural mismatch
fails the round and requires a new research-round decision; there is no
in-round gate-change escape hatch.

## Candidate registry and selectors

The registry remains exactly the nine Round-002 candidates:

```text
R2-H6-STRICT-BTC
R2-H7-STRONG-SYMBOL
R2-H8-RECENT-PULLBACK
R2-H9-VOLUME-CONFIRM
R2-H10-BREAKOUT-010
R2-C1-BTC-STRONG-SYMBOL
R2-C2-STRONG-SYMBOL-RECENT-PULLBACK
R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT
R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT
```

H7 remains the ATR-normalized strong-symbol selector; H9 uses the current
closed 1H `quoteVolume` against the preceding 20 closed candles; C1-C4 are
the exact declared AND combinations. Their parameters and complexity tuples
are inherited byte-for-byte from Round-002. No candidate may be added,
removed, renamed, or changed based on observed outcomes.

All nine redundancy gates are `NOT_APPLICABLE` because the registry contains
no H1 or H4 mechanism. This status is excluded from the passing conjunction;
it is not converted to `PASS`.

## No performance authorization

This record is a pre-performance freeze. It does not contain candidate
diagnostics or a selection result. M3-R3-B is the separately authorized step
for any future candidate derivation and is currently **NOT STARTED / NOT
AUTHORIZED**. `baseline-002` is **NOT FROZEN**, M3-J is **BLOCKED**, and M4 is
**NOT STARTED**.
