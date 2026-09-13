# TradePulse Round-022 — Historical Signal Review Layer

Phase: **HISTORICAL_SIGNAL_REVIEW_DESIGN_ONLY**
Accepted base: `research/round-015-beta-alpha-decomposition` at
`9358efc5b78a4f57560c44fa8a7315f08cc59092`
Branch: `research/round-022-historical-review-design`

## Purpose

This document freezes a design for reviewing the historical identity and
quality-advisory state of already-generated TradePulse advisories. It is a
metadata and provenance layer only. It does not decide whether a signal was
profitable and does not create a new signal.

TradePulse remains signal-advisory-only:

- `LONG`, `SHORT`, and `NO_SIGNAL` remain the only direction values;
- the review layer never changes the underlying signal direction;
- `humanDecisionRequired=true` and `automaticTrading=false` are mandatory;
- no order, position, leverage, stop/target execution, or fund-management
  behavior is in scope.

## Design-only boundary

This phase performs no data access. A future implementation may read an
approved advisory archive only after a separately accepted implementation
contract. The future source boundary is the exact advisory identity record in
`public.tp_signal_advisories`, not an outcome table and not a market-data
loader.

The design explicitly forbids:

- PnL, profit factor, drawdown, expectancy, R, win/loss, or other economic
  result reads;
- forward-return or future-price reads;
- `tp_signal_results`, backtest artifacts, or performance evidence;
- new market-data acquisition, Binance requests, or cache reconstruction;
- recomputing the Signal Quality Score or changing Signal Engine behavior.

The protocol in
`src/lib/research/historical-review-protocol.ts` is pure metadata validation.
It has no database client, network client, market-data loader, or outcome
calculation.

## Exact advisory identity

Every future review record must be keyed by the complete deterministic tuple,
in this order:

```text
(signalId, symbol, direction, signalTime, strategyId, strategyVersion)
```

Identity matching is exact and case-sensitive. No nearest timestamp, fuzzy
matching, price matching, signal reconstruction, or identity substitution is
allowed. A missing or malformed identity is `IDENTITY_INVALID` and is not
silently dropped.

`NO_SIGNAL` is retained as a valid upstream output but is
`NOT_REVIEWABLE` by the historical advisory review because it has no formal
directional advisory identity to review.

## Review status contract

The design exposes only metadata status:

- `IDENTITY_VERIFIED` — a complete LONG/SHORT identity is structurally valid;
- `QUALITY_SNAPSHOT_AVAILABLE` — the existing quality result is available for
  display, without recalculation;
- `QUALITY_SNAPSHOT_MISSING` — identity is valid but no quality snapshot is
  available;
- `IDENTITY_INVALID` — one or more exact identity fields are invalid;
- `NOT_REVIEWABLE` — the input is `NO_SIGNAL`.

The review layer does not infer a result from a status. It does not produce an
outcome label, an R value, or an economic metric.

## Quality snapshot handling

The layer may reference an immutable output from the existing Signal Quality
Advisory layer:

- `qualityGrade` (`A`, `B`, `C`, `IGNORE`);
- the already-produced non-economic `qualityScore`;
- market-context advisory;
- risk-advisory state;
- explanations.

These are consumed as a snapshot or marked unavailable. The review layer does
not recompute grade or score, introduce new thresholds, read future prices, or
alter the Signal Quality implementation.

## Idempotency and storage boundary

The future implementation must derive a stable review key from the exact
identity tuple and the frozen schema version. A repeated identical identity
must address the same logical review record. The design does not authorize a
new table, migration, write path, scheduler, or production activation.

Any later persistence implementation must preserve the source identity and
must fail closed on duplicate or conflicting identities. It must not join the
review to an outcome identity that has not been explicitly approved.

## Governance gates

The design is accepted only as a design artifact. No preflight, historical
data acquisition, backtest, performance, selection, optimization, economic
evaluation, shadow activation, scheduler activation, or Production change is
authorized by this document.

The required state is:

```text
performanceExecutionCount = 0
performanceLedgerPresent = false
performanceExecuted = false
backtestExecuted = false
selectionExecuted = false
economicValuesRead = false
newMarketDataFetched = false
Production unchanged
baseline-002 = NOT_FROZEN
M3-J = BLOCKED
M4 = NOT_STARTED
automaticTrading = false
```

The next stage is `STOP_PENDING_DESIGN_ACCEPTANCE`.
