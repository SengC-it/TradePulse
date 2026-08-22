# M3-R5-B.2 Round-005 implementation

This document describes the future execution machinery only. It is not a
Round-005 performance result and it does not authorize a performance run.

## Frozen boundary

- Research round: `baseline-002-research-round-005`
- Strategy: `baseline-001`
- Settlement policy: `bt-policy-003`
- CONTROL: `R5-CONTROL-BASELINE-001`
- Performance candidates: `R5-H15-HTF-TREND`, `R5-H16-NEUTRAL-MEAN-REVERSION`, and `R5-H18-COMPRESSION-EXPANSION`
- H17 remains excluded as `DATA_NOT_AVAILABLE` with its B.1B qualification hashes.
- Gate SHA and Plan SHA are loaded and validated from the frozen B.1B records.

## Execution architecture

Round-005 uses native historical `1h` and `4h` datasets. H15 evaluates native
4H candles, H16 evaluates native 1H candles with the latest legal closed native
4H context, and H18 evaluates native 1H candles. No 4H series is resampled
from 1H data. Formal signal identity is `symbol|direction|signalTime`; the
candidate ID is retained in evidence so identities remain auditable across
candidate populations.

Formal signals are generated before entry and settlement, using an explicit
decision timeline that ends at `2026-08-15T23:59:59.999Z`. Settlement-only tail
candles can never create a formal signal. The first native 1H open strictly
after `signalTime` is used for entry. H15 uses a 2 ATR stop, 3R target, and 48
held candles; H16 uses a 1.5 ATR stop, fixed decision-time EMA20 target, and 12
held candles; H18 uses a 1.5 ATR stop, 3R target, and 24 held candles.
Same-candle stop/target events are SL-first. Settlement may continue through
the authorized 48-hour settlement tail and is censored only at the authorized
settlement end, not at the decision cutoff. Settlement, fees, funding,
slippage, and intrabar order all reuse the existing `bt-policy-003` semantics.

The phase-A discovery pass enumerates formal signals and plans only entry/risk/
exit geometry plus the 1m windows required for otherwise executable TP/SL
funding ambiguities. It does not call settlement, calculate funding, fees, R
values, diagnostics, or evidence. The final offline settlement pass consumes
those windows and preserves `DATA_INCOMPLETE` or `SETTLEMENT_AMBIGUOUS` when
reconciliation cannot be proven.

## Evidence and CLI guards

The future CLI is `npm run research:m3r5:performance` and requires
`--confirm-authoritative-performance`, `--source-sha`, `--round`,
`--gate-sha`, and `--plan-sha`. It verifies the clean worktree, exact runtime
source SHA, frozen Gate/Plan hashes, the raw SHA-256 bytes of both H17
qualification artifacts, registry, and absence of all three reserved output
paths before any loader/network call. The execution source SHA is supplied at
runtime and is not predeclared in the frozen Plan.

The execution lifecycle is explicit: `PRE_PERFORMANCE` before the first real
result, `PERFORMANCE_LOCKED` exactly once when CONTROL performance is first
generated, and `POST_PERFORMANCE` for any later execution or publication abort.
Failures are classified as `PRE_PERFORMANCE_ABORT`,
`POST_PERFORMANCE_EXECUTION_ABORT`, or `POST_PERFORMANCE_EVIDENCE_PUBLISH_ABORT`.
No automatic rerun is permitted after the lock.

The report contains full seen-data evidence and F1–F6 research/validation
diagnostics for CONTROL and each eligible candidate. It performs no gate
application and no candidate selection. `selectionApplied` is always false,
`selectedCandidateId` is null, baseline-002 remains `NOT_FROZEN`, M3-J remains
`BLOCKED`, and M4 remains `NOT_STARTED`.

Publication stages on the destination filesystem and publishes `AUDIT`, then
`RESULTS`, then `SUMMARY`. SUMMARY is the final commit marker. A failed
publication rolls back every file created by that invocation, preserves any
pre-existing outputs by rejecting before staging, and surfaces the original
error together with any rollback error.

## Verification boundary

All B.2 tests use synthetic fixtures or offline publication tests. No Binance
request, historical loader, H17 qualification, Round-005 performance command,
performance artifact, gate application, candidate selection, or baseline-002
freeze was executed while implementing this milestone.
