# Round-022 Observation Instrumentation Design

Status: `DESIGN ONLY`

- Accepted source: `3df85901f36e1f6feced5ad3b3f4a8329c731250`
- Base: `research/round-015-beta-alpha-decomposition`
- Branch: `research/round-022-observation-instrumentation-design`
- Production: unchanged

This remediation changes only the four Round-022 design artifacts. It does
not implement instrumentation, add telemetry, add an API, add a migration,
change the UI or notification path, or execute observation, performance,
backtest, selection, economic evaluation, or market-data acquisition.

## Product and research boundary

TradePulse remains signal-advisory only:

- `humanDecisionRequired=true`
- `automaticTrading=false`
- no order, position, leverage, stop-loss execution, or account management
- no performance, backtest, selection, economic evaluation, or new market data

The observation sidecar is prospective, non-economic, append-only evidence. It
cannot feed observations back into signal generation, delivery, Quality, Grade,
Priority, or the human decision boundary.

## Timestamp causality

The existing signal path defines `signalTime` as the closed-candle market-event
time (`candle.closeTime`). It is not a capture or presentation time. The
authoritative causal invariants are:

```text
informationAsOf <= signalTime <= capturedAt
signalTime <= advisoryCreationTime
signalTime <= notification.observedAt
signalTime <= reviewStartedAt <= reviewSubmittedAt
```

`capturedAt` is the truthful server wall-clock timestamp at artifact
construction/persistence. It may be after `signalTime` and must never be
backdated. `informationAsOf` is a server-resolved source cutoff and is never
user supplied. Any inversion is `NOT_EVALUABLE`; timestamps are never silently
corrected.

## Snapshot content and evidence hashes

Each snapshot contains `evidenceId` (the physical row identity), `artifactId`
(the snapshot logical identity), `artifactType`, `schemaVersion`,
`advisoryIdentity`, `informationAsOf`, `capturedAt`, `sourceRef`, `payload`,
`contentHash`, `evidenceHash`, and a deterministic `idempotencyKey`.

`contentHash` identifies the same logical snapshot. Its exact canonical
preimage is:

```text
schemaVersion + artifactType + advisoryIdentity + informationAsOf
  + sourceRef + payload
```

It excludes `capturedAt`, `evidenceId`, `artifactId`, `idempotencyKey`,
`evidenceHash`, and `supersedesArtifactId`. It uses stable canonical JSON,
UTF-8, and SHA-256. `payload` is accepted only when it is canonical JSON:
null, boolean, string, finite number, array, or plain object recursively.
`undefined`, functions, symbols, bigint, Date, Map, Set, class instances,
NaN, Infinity, and -Infinity are `NOT_EVALUABLE`.

`evidenceHash` validates the saved evidence envelope. Its exact canonical
preimage is:

```text
contentHash + capturedAt + timestampAuthority + artifactId
```

Therefore two captures of the same logical snapshot may have the same
`contentHash` and idempotency key but different evidence hashes when their
truthful server capture times differ.

The snapshot idempotency key is:

```text
SHA-256(SNAPSHOT|signalId|artifactType|schemaVersion|informationAsOf|contentHash)
```

If an append succeeded but its acknowledgement was lost, a retry produces the
same key and returns `IDEMPOTENT_REPLAY`; it never appends a second row or
updates the first row. If the first append did not succeed, a retry may use a
new real server `capturedAt`, without backdating.

## Six snapshot artifacts

The six immutable artifact types remain:

1. `QUALITY_SNAPSHOT`
2. `MARKET_CONTEXT`
3. `RISK_ADVISORY`
4. `HISTORICAL_REVIEW_METADATA`
5. `ALERT_INTELLIGENCE`
6. `PRESENTATION`

Only metadata and provenance are allowed. Economic fields and future outcomes
are forbidden.

## Notification provenance and O05

The runtime facts were checked against:

- `src/lib/signal-advisory/scan.ts`
- `src/lib/signal-advisory/store.ts`
- the existing retry procedure

The exact disposition mappings are:

| Runtime fact | Observation event | Evidence source |
| --- | --- | --- |
| `CLAIMED` followed by successful send | `DELIVERED` | `SERVER_DELIVERY_EVENT` |
| `RETRY_CLAIMED` followed by successful send | `DELIVERED` | `SERVER_DELIVERY_EVENT` |
| `SKIPPED_DUPLICATE` | `DUPLICATE_SKIPPED` | `SERVER_DUPLICATE_SKIP_EVENT` |
| `SKIPPED_EXPIRED` | `SUPPRESSED`, reason `EXPIRED` | `SERVER_EXPIRED_SKIP_EVENT` |
| SMTP/configuration failure | `DELIVERY_FAILED` / `NOTIFICATION_DELIVERY_FAILED` | `SERVER_DELIVERY_FAILURE_EVENT` |

Delivery failures retain `SMTP_AUTH_FAILED`, `SMTP_DELIVERY_FAILED`, or
`EMAIL_CONFIGURATION_INVALID`. They are technical evidence, not
`IGNORED`, `SUPPRESSED`, or `DUPLICATE_SKIPPED`, and are excluded from the
normal notification-noise denominator unless a later contract explicitly
authorizes inclusion.

`IGNORED` remains strict: it is observable only from explicit human/UI
evidence. No click absence, reply absence, non-trade, page close, later price,
or economic outcome can imply `IGNORED`; otherwise the status is
`INSTRUMENTATION_UNRESOLVED`.

The authoritative attempt sequence is `tp_signal_advisories.attempt_count`.
The initial advisory row assigns `1`; `tp_retry_signal_advisory` increments it
under compare-and-set for `RETRY_CLAIMED`. However, the current
`claimSignal()` contract returns only the claim status and does not return
`attempt_count` for `SKIPPED_DUPLICATE`, `SKIPPED_EXPIRED`, or a delivery
failure observation. The design therefore cannot prove a complete
`attemptSequence` at every O05 capture point without inventing a read or
assuming a value. O05 is intentionally:

```text
runtimeStatus = INSTRUMENTATION_REQUIRED
designStatus = DESIGN_INELIGIBLE
```

The next implementation must return or atomically expose the authoritative
sequence before O05 can become design-eligible. This PR does not modify that
runtime path.

## Human-review event identity

`reviewObservationId` identifies one review session/group only. Each immutable
row has its own `evidenceId` and `eventType`:

```text
REVIEW_STARTED
REVIEW_SUBMITTED
```

The keys are intentionally distinct:

```text
REVIEW|reviewObservationId|START
REVIEW|reviewObservationId|SUBMIT
```

The start event contains only the server-captured start time. The submit event
contains server-captured start and submit times plus explicit human labels.
Both obey `signalTime <= reviewStartedAt <= reviewSubmittedAt`. A refresh
replays the event-specific key; it cannot collide with the other event. An
abandonment has no fabricated submit event and is `NOT_EVALUABLE`.

## Persistence identity

The future single append-only `tp_observation_evidence` table has exactly one
physical primary key:

```text
PRIMARY KEY (evidence_id)
```

Logical/group identities are separate:

- `artifact_id` unique for snapshot rows
- `notification_observation_id` unique for notification rows
- `(review_observation_id, event_type)` unique for review rows
- `idempotency_key` unique across all rows

These are future PostgreSQL constraints only. No migration is created here.
The table remains service-side only with RLS denying direct anonymous and
authenticated access.

## Gates and governance

Runtime statuses remain unchanged. Design statuses are:

| Gate | Runtime | Design | Reason |
| --- | --- | --- | --- |
| O03 | `INSTRUMENTATION_REQUIRED` | `DESIGN_READY` | causal timestamp rules are frozen |
| O04 | `INSTRUMENTATION_REQUIRED` | `DESIGN_READY` | snapshot identity, hashes, and canonical payload are frozen |
| O05 | `INSTRUMENTATION_REQUIRED` | `DESIGN_INELIGIBLE` | current claim path does not expose authoritative attempt sequence at every event |
| O06 | `INSTRUMENTATION_REQUIRED` | `DESIGN_READY` | independent start/submit event identity is frozen |

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

```text
ROUND-022 OBSERVATION INSTRUMENTATION DESIGN INELIGIBLE
nextStage=STOP
```

No implementation, observation execution, or later research stage is
authorized by this branch.
