# Round-022 Observation Instrumentation Design

Status: `DESIGN ONLY`

- Accepted source: `3df85901f36e1f6feced5ad3b3f4a8329c731250`
- Base: `research/round-015-beta-alpha-decomposition`
- Branch: `research/round-022-observation-instrumentation-design`
- Production: unchanged

This document designs, but does not implement, a future append-only observation
sidecar for the existing signal-advisory product. It does not execute
observation, add telemetry, add an API, change the UI, add a migration, or
change email, scheduler, signal generation, Quality, Grade, Priority, or the
human decision boundary.

## Product and research boundary

TradePulse remains signal advisory only:

- `humanDecisionRequired=true`
- `automaticTrading=false`
- no order, position, leverage, stop-loss execution, or account management
- no performance, backtest, selection, economic evaluation, or new market data

The observation is prospective and non-economic. A future accepted
implementation may observe completeness, provenance, stability,
understandability, notification disposition, and human-review usability. It may
not feed observations back into signal generation or presentation priority.

## Timestamp causality

The existing signal path defines `signalTime` as the closed-candle market event
time (`candle.closeTime`) in `src/lib/signal-advisory/scan.ts`. It is not a
capture time. The design freezes these causal invariants:

```text
informationAsOf <= signalTime <= capturedAt
signalTime <= advisoryCreationTime
signalTime <= notification.observedAt
signalTime <= reviewStartedAt <= reviewSubmittedAt
```

`capturedAt` is the real server wall-clock time at artifact construction or
append. It may be after `signalTime` and must never be backdated or derived from
`signalTime`. `informationAsOf` is the server-resolved source cutoff and cannot
be supplied by a user. All timestamps are canonical UTC ISO-8601 values.

The repository currently has reliable source timestamps for signal time and
advisory persistence (`src/lib/signal-advisory/scan.ts` and
`src/lib/signal-advisory/store.ts`). It does not currently persist the R22
snapshot capture, notification-observation, or human-review timestamps. Those
current capture statuses are therefore explicitly `UNRESOLVED_CURRENT_SOURCE`;
the future capture points and fail-closed rules are nevertheless fully
specified. No current absence is silently treated as evidence.

## Snapshot provenance

Each of the following is a separate immutable artifact:

- Quality Snapshot
- Market Context
- Risk Advisory
- Historical Review metadata
- Alert Intelligence
- Presentation

Every artifact contains `artifactType`, `schemaVersion`, `advisoryIdentity`,
`informationAsOf`, `capturedAt`, `sourceRef`, `sourceHash`, and a metadata-only
`payload`. It also carries an `artifactId`, `idempotencyKey`, optional
`supersedesArtifactId`, server timestamp-authority proof, and an `APPEND`
operation marker.

The hash contract uses the existing `stableStringify` helper in
`src/lib/research/utils.ts`: recursively sorted object keys, preserved array
order, UTF-8 encoding, and SHA-256. The preimage includes the schema version,
artifact type, advisory identity, information cutoff, capture time, source
reference, timestamp-authority proof, and canonical metadata payload. The hash
itself is excluded to avoid a circular preimage. Reordering object keys cannot
change the hash; changing identity, provenance, timestamp, schema, or payload
must change it.

Snapshots are append-only. A correction or new schema version appends a new
artifact and may point to the prior artifact with `supersedesArtifactId`; it
never updates, overwrites, or deletes the prior row. A retry with the same
idempotency key is an idempotent replay, not a replacement. A missing,
malformed, hash-mismatched, mutable, or causally invalid artifact is
`NOT_EVALUABLE`.

## Notification provenance

Notification identity is separate from advisory identity. A future observation
must retain `notificationObservationId`, advisory identity, channel,
`attemptSequence`, server `observedAt`, and disposition. The objective
dispositions are `DELIVERED`, `SUPPRESSED`, and `DUPLICATE_SKIPPED`; duplicate
skips remain evidence and are never deleted by deduplication.

`IGNORED` is not inferred from a click, a non-trade, no reply, abandonment, or
any future/economic result. It is observable only with explicit human/UI
evidence. Without that evidence the disposition is
`INSTRUMENTATION_UNRESOLVED`, not an invented ignored count.

The current delivery registry in `src/lib/signal-advisory/store.ts` does not
persist this complete per-notification vocabulary, so O05 remains
`INSTRUMENTATION_REQUIRED` at runtime.

## Human review and UX design

The future review observation contains `reviewObservationId`, advisory
identity, server-captured `reviewStartedAt` and `reviewSubmittedAt`,
`reviewComplete`, `informationSufficient`, and explicit user-supplied
`unnecessaryAlert`. The latter is never inferred from a market outcome.

The start action creates a server review id and appends a start event. Submit
appends a submit event; page refresh retries the same idempotency key. An
abandoned review has no fabricated submit event and is `NOT_EVALUABLE`.
Multiple explicit reviews are separate immutable observations linked to the
same advisory. No name, email body, IP, device, location, free text, or
portfolio data is collected.

The existing `tp_advisory_reviews` / signal-review store is an economic review
surface with entry/exit/result fields. It is not reused for R22 human-review
observations. This design adds no migration.

## Minimal persistence design

The future implementation should use one discriminated append-only
`tp_observation_evidence` table, service-side only, rather than modifying the
existing advisory delivery row or reusing the economic review table. The row
model has an evidence primary key, advisory identity reference, evidence kind,
artifact/schema fields, server timestamps, source/hash fields, notification
fields, review fields, supersession link, unique idempotency key, and a
metadata-only payload. RLS must deny anon/authenticated direct access and
permit only the server-side writer/read path. This is a design choice, not a
database migration in this PR.

## Idempotency and failure isolation

- snapshot retry: `advisoryIdentity|artifactType|schemaVersion|sourceHash`
- email delivery retry: `advisoryIdentity|EMAIL|attemptSequence`
- duplicate skip retry: `advisoryIdentity|channel|attemptSequence`
- page refresh: server-issued `reviewObservationId`
- review retry: `reviewObservationId`

Instrumentation is a sidecar. If its writer fails, it records a safe
`INSTRUMENTATION_FAILURE` classification where possible and does not alter the
signal engine, email delivery, scheduler, cron, Quality, Grade, Priority, or
human decision output. Future missing evidence is `NOT_EVALUABLE`; it is never
fabricated, imputed, or backfilled.

The schema rejects forbidden economic fields, including PnL, profit/loss,
return, forward return, future price/candle, win/loss labels, take-profit or
stop-loss hits, Profit Factor, Sharpe, Calmar, drawdown, expected return, and
trade outcome. No economic value is read, calculated, or inspected here.

## Gate and governance status

O03–O06 remain runtime `INSTRUMENTATION_REQUIRED`; this design does not claim
that instrumentation already exists. Their design status is `DESIGN_READY`:

| Gate | Runtime status | Design status | Meaning |
| --- | --- | --- | --- |
| O03 | `INSTRUMENTATION_REQUIRED` | `DESIGN_READY` | causal server timestamp capture points are specified |
| O04 | `INSTRUMENTATION_REQUIRED` | `DESIGN_READY` | six immutable snapshot provenance records are specified |
| O05 | `INSTRUMENTATION_REQUIRED` | `DESIGN_READY` | disposition evidence and explicit-ignored rule are specified |
| O06 | `INSTRUMENTATION_REQUIRED` | `DESIGN_READY` | server review timestamps and human labels are specified |

O01, O02, O07, O08, and O09 remain as previously frozen by the R22
Observation Design. No gate is upgraded by this design artifact.

```text
observationExecuted=false
historicalBackfillExecuted=false
instrumentationImplemented=false
performanceExecutionCount=0
performanceLedgerPresent=false
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

`ROUND-022 OBSERVATION INSTRUMENTATION DESIGN READY`

`nextStage=STOP_PENDING_DESIGN_ACCEPTANCE`

The next stage is not authorized by this branch. Implementation requires a
separate approved task, followed by runtime gate revalidation before any
observation starts.
