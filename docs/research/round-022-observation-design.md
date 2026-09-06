# TradePulse Round-022 — Prospective Advisory Observation Design

Phase: **OBSERVATION DESIGN ONLY**

Accepted source: `60b003a80e231ace69e4fc4d4217a7d22724ce1b`

Base: `research/round-015-beta-alpha-decomposition`

Branch: `research/round-022-observation-design`

## Purpose and boundary

This document designs a prospective, non-economic observation protocol for the
completed Signal Quality, Risk Advisory, Historical Review, Alert Intelligence,
and Advisory Evaluation layers. It can answer whether advisory metadata is
stable, complete, understandable, and available for human review. It cannot
answer whether the advisory is profitable.

TradePulse remains advisory-only:

```text
humanDecisionRequired=true
automaticTrading=false
```

No order execution, position sizing, leverage control, automatic stop/target
execution, account management, or automated trading decision is in scope.
This branch does not execute observation, collect live observation data, send
email, change Production, change scheduler/cron, or replay historical market
results.

## Prospective window

The protocol freezes one future `T0`; this design does not set an actual T0.
The only permitted window is:

```text
T0 <= observedAt < T0 + 30 calendar days
```

The window is exactly 30 consecutive calendar days. Historical backfill,
retrospective sampling, result-based extension, early stopping, and changing T0
after observation begins are forbidden. If the fixed window lacks enough valid
observations, the result is `OBSERVATION_INSUFFICIENT_DATA`; the window is not
extended and old records are not added.

## Three mutually distinct cohorts

### Advisory cohort

The unit is one unique directional advisory identity. It contains the identity,
signal time, direction, and decision-time snapshots for quality, market context,
risk, identity-only historical review, alert intelligence, and presentation.
One identity can enter this cohort only once. `LONG` and `SHORT` are reported
separately and may also have a pooled summary.

### Notification cohort

The unit is every actual notification observation. It records `DELIVERED`,
`IGNORED`, `SUPPRESSED`, or `DUPLICATE_SKIPPED`. Duplicate evidence is retained;
deduplication must not delete the second notification observation.

Therefore the advisory-quality denominator is not the notification-noise
denominator.

### Human Review cohort

The unit is one valid human review. It records:

- `reviewStartedAt`;
- `reviewSubmittedAt`;
- `reviewComplete`;
- `informationSufficient`;
- `unnecessaryAlert`.

`decisionLatencyProxyMs` is exactly:

```text
reviewSubmittedAt - reviewStartedAt
```

It is a UX observation proxy, never market-move latency, execution latency, or
profit-opportunity latency. `reviewSubmittedAt` must be greater than or equal
to `reviewStartedAt`; otherwise the review is `NOT_EVALUABLE`.

`unnecessaryAlert` can only be supplied by the human review label. It cannot be
derived from later price movement, PnL, stop/target outcomes, win/loss, or any
other future result.

`NO_SIGNAL` is pipeline metadata only. It is not an alert and is excluded from
all advisory-quality and human-review alert denominators. Its count may be
reported separately as `noSignalCount`.

## Denominator contract

- Advisory: unique valid `ADVISORY` records with `LONG` or `SHORT`.
- Notification: every valid `NOTIFICATION` record, including duplicates.
- Human Review: every valid `HUMAN_REVIEW` record with a human-supplied label.
- Missing or invalid records: `NOT_EVALUABLE`, excluded and never imputed as 0.
- LONG and SHORT are each reported; a pooled summary is allowed only as an
  additional view and must not hide direction-level counts.

## Point-in-time and provenance contract

`signalTime` is the source market event time / closed-candle time. The accepted
repository derives it in `src/lib/signal-advisory/scan.ts` from
`candle.closeTime`. It is not evaluation execution time, alert rendering time,
or notification time.

Every required snapshot must carry a concrete source reference, source hash,
immutable status, an information cutoff, and a truthful capture timestamp. The
two timestamp meanings are intentionally separate:

- `informationAsOf` is the latest effective source-data cutoff used by the
  artifact. For every market/context-dependent snapshot it must satisfy
  `informationAsOf <= signalTime`.
- `capturedAt` is the real wall-clock time when the artifact was computed,
  constructed, or persisted. It must be canonical and immutable, must not be
  backdated, and is allowed to be later than `signalTime`.

For example, a signal at `00:00:00Z` may have quality captured at
`00:00:02Z`, Alert Intelligence captured at `00:00:04Z`, and presentation
captured at `00:00:05Z`, provided each artifact's `informationAsOf` is no later
than the signal time. Presentation and Alert Intelligence are downstream
artifacts; their capture timestamps must not be rewritten to the market event
time.

The validator therefore requires:

```text
informationAsOf <= signalTime
capturedAt is a canonical immutable timestamp
```

It does not require `capturedAt <= signalTime`.

The required snapshots are quality, market context, risk advisory,
identity-only historical review metadata, alert intelligence, and presentation.
Missing or mutable provenance is `NOT_EVALUABLE`. Future metadata recalculation,
later overwrites, nearest matches, and outcome-based relabeling are forbidden.

The accepted repository contains reliable sources for the formal advisory
identity and signal timestamps:

- `src/lib/signal-advisory/identity.ts` derives the deterministic identity;
- `src/lib/signal-advisory/scan.ts` creates the advisory snapshot;
- `public.tp_signal_advisories` persists `signal_id`, direction, and
  `signal_time`.

The current repository does not persist the required immutable R22 capture
identity for quality/context/risk/intelligence/presentation, all notification
dispositions, or human-review timestamps and labels. These are explicitly
`INSTRUMENTATION_REQUIRED`; this design does not implement them and does not
pretend that existing fields are equivalent.

## Repository provenance inventory

| Field | Source module / persistence | `capturedAt` semantics | Mutability | Requirement | Status |
| --- | --- | --- | --- | --- | --- |
| `identityKey` | `src/lib/signal-advisory/identity.ts`; `tp_signal_advisories.signal_id` | signal/advisory persistence | immutable | required | available source |
| `signalTime` | `src/lib/signal-advisory/scan.ts`; `tp_signal_advisories.signal_time` | `candle.closeTime` persisted as market-event time | immutable | required | available source |
| `direction` | `src/lib/signal-advisory/types.ts`; `tp_signal_advisories.direction` | advisory persistence | immutable | required | available source |
| quality snapshot | `src/lib/signal-quality/evaluator.ts` | `informationAsOf`/`capturedAt` not persisted; capture may be after `signalTime` | immutable required | required | instrumentation required |
| market context | `src/lib/signal-quality/evaluator.ts` | `informationAsOf`/`capturedAt` not persisted; capture may be after `signalTime` | immutable required | required | instrumentation required |
| risk advisory | `src/lib/signal-quality/evaluator.ts` | `informationAsOf`/`capturedAt` not persisted; capture may be after `signalTime` | immutable required | required | instrumentation required |
| historical review metadata | `src/lib/research/historical-review-protocol.ts` | identity-only `informationAsOf`/`capturedAt` not persisted as R22 snapshot | immutable required | required | instrumentation required |
| alert intelligence | `src/lib/alert-intelligence/index.ts` | downstream `capturedAt` not persisted with provenance; capture may be after `signalTime` | immutable required | required | instrumentation required |
| presentation | future email/web observation source | downstream `capturedAt` not persisted; capture may be after `signalTime` | immutable required | required | instrumentation required |
| notification disposition | `src/lib/signal-advisory/store.ts`; delivery registry | per-notification record incomplete | immutable required | required | instrumentation required |
| human review metadata | no current R22 persistence source | review start/submission not persisted | immutable required | required | instrumentation required |
| decision latency proxy | future human-review instrumentation | review submission | immutable required | required | instrumentation required |

No database migration, telemetry writer, collector, API route, production UI,
or scheduler job is part of this phase. The next phase cannot begin until the
instrumentation-required fields have an independently accepted design and the
eligibility gates pass.

## Eligibility gates

| Gate | Status | Frozen rule |
| --- | --- | --- |
| O01 | PASS | Exact accepted source SHA matches the frozen source. |
| O02 | PASS | Directional advisory has one stable identity key. |
| O03 | INSTRUMENTATION_REQUIRED | Signal, advisory, notification, and review timestamps are provable. |
| O04 | INSTRUMENTATION_REQUIRED | Required decision-time snapshots have immutable provenance. |
| O05 | INSTRUMENTATION_REQUIRED | All notification dispositions, including duplicates, are retained. |
| O06 | INSTRUMENTATION_REQUIRED | Human review timestamps and labels are human-supplied and persisted. |
| O07 | PASS | Observation schema is isolated from economic outcomes. |
| O08 | PASS | Advisory, notification, and human-review denominators are separate. |
| O09 | PASS | The window is fixed at 30 prospective calendar days. |

Hard invariants are zero future/economic fields, zero automatic-trading fields,
zero unstable same-input outputs, zero timestamp inversion, zero denominator
contamination, and zero retrospective backfill. UX metrics remain descriptive;
this phase does not invent a `score >= X` success threshold and makes no causal
improvement claim.

Because O03-O06 still require explicit instrumentation, observation is not
authorized. This is a fail-closed design conclusion, not a request to lower the
gates or to fill missing records from history.

## Forbidden information and upstream feedback

The observation contract cannot read or carry PnL, profit/loss, returns,
forward-return or future-price/candle values, stop/target outcomes, win/loss
labels, performance ratios, drawdown, Sharpe/Calmar, expected returns, economic
outcomes, or trade outcomes. Historical review remains identity-only.

Observation output is terminal/read-only evidence. It cannot influence Signal
Engine, signal direction, Quality Score, Quality Grade, Market Context, Risk
Advisory, Historical Review, Alert Intelligence priority, notification delivery,
scheduler, cron, strategy parameters, selection, or trading decisions.

## Governance

```text
performanceExecutionCount=0
performanceLedgerPresent=false
observationExecuted=false
historicalBackfillExecuted=false
economicValuesRead=false
forwardReturnRead=false
newMarketDataFetched=false
Production unchanged
baseline-002=NOT_FROZEN
M3-J=BLOCKED
M4=NOT_STARTED
humanDecisionRequired=true
automaticTrading=false
```

Final design decision:

```text
ROUND-022 OBSERVATION DESIGN INELIGIBLE
nextStage=STOP
```

The blocker is missing immutable prospective provenance/instrumentation, not a
permission to collect data or run observation. No Observation Implementation,
instrumentation, Performance, Backtest, Selection, or Production activation is
authorized by this branch.
