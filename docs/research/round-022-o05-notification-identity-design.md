# Round-022 O05 Notification Identity Remediation

Status: `DESIGN ONLY`

This artifact is the bounded remediation design for O05. It audits the existing
signal-advisory claim, retry, duplicate, expiry, and delivery paths and freezes
an identity contract for future observation instrumentation. It does not change
runtime behavior, SQL, the scheduler, email delivery, the API, the UI, or
Production.

## Accepted source and scope

- Accepted source: `6152eb8b3c497e0322c61526743f8b76669f3745`
- Base: `research/round-015-beta-alpha-decomposition`
- Branch: `research/round-022-o05-notification-identity-design`
- Scope: O05 notification evidence identity only
- Runtime status: `INSTRUMENTATION_REQUIRED`
- Design status: `DESIGN_READY`

The only deliverables in this change are this design, its machine-readable
contract, a pure protocol module, and protocol tests. The protocol module is
not imported by the signal-advisory runtime and does not execute a claim,
retry, email, database operation, market-data request, observation, or review.

## Runtime audit

The audit is bound to the following authoritative source files and anchors:

| Source | Frozen fact |
| --- | --- |
| `src/lib/signal-advisory/types.ts` | `SignalClaimResult` is `CLAIMED`, `RETRY_CLAIMED`, `SKIPPED_DUPLICATE`, or `SKIPPED_EXPIRED`; `claimSignal` receives `advisory`, `scanId`, and `now`. |
| `src/lib/signal-advisory/store.ts` | A successful advisory insert sets `attempt_count=1`; a conflict calls `tp_retry_signal_advisory` with `p_signal_id`, `p_scan_id`, and `p_now`. |
| `src/lib/signal-advisory/scan.ts` | The stable `begin.scanId` is passed to `claimSignal`; only `CLAIMED` and `RETRY_CLAIMED` enter `sendSignalEmail`; both skip outcomes do not send. |
| `supabase/migrations/20260823000000_signal_advisory.sql` | The retry RPC is a compare-and-set: only a non-expired `FAILED` row with `attempt_count < 2` is retried, and the update increments the count. |

### Current claim/RPC semantics

| Outcome | Database transition | Email attempt | Delivery attempt sequence |
| --- | --- | --- | --- |
| `CLAIMED` | Insert `PENDING`, set `scan_run_id`, `last_attempt_at`, and `attempt_count=1`. | Yes | `1`, from the insert row. |
| `RETRY_CLAIMED` | CAS changes `FAILED` to `PENDING`, increments `attempt_count`, replaces `scan_run_id`, updates `last_attempt_at`, and clears terminal delivery fields. | Yes | `2` under the frozen retry limit; the current RPC returns only the outcome string, so future metadata must expose the post-CAS value. |
| `SKIPPED_DUPLICATE` | No row mutation. | No | `null`; a skip has no delivery attempt. |
| `SKIPPED_EXPIRED` | No row mutation when `p_now >= signal_valid_until`. | No | `null`; a skip has no delivery attempt. |

`attempt_count` is therefore an authoritative delivery-attempt counter, not a
notification-decision identity. The existing RPC does not return an attempt
sequence for skip outcomes, and it does not return the post-CAS count for a
retry. The design does not guess or reconstruct those values for identity.

## Delivery attempt versus notification decision

A **delivery attempt** exists only after `CLAIMED` or `RETRY_CLAIMED` and at the
boundary immediately before `sendSignalEmail()`. It has a start event
`DELIVERY_ATTEMPTED` and exactly one terminal event, either `DELIVERED` or
`DELIVERY_FAILED`. Both terminal events reference the same attempt decision.

A **notification decision event** exists for every claim outcome, including
`SKIPPED_DUPLICATE` and `SKIPPED_EXPIRED`. A skipped decision has no email
attempt, but it still has an authoritative server claim outcome that must be
observable. The mappings are frozen as follows:

- `SKIPPED_DUPLICATE` → `DUPLICATE_SKIPPED`
- `SKIPPED_EXPIRED` → `SUPPRESSED` with `suppressionReason=EXPIRED`
- delivery failure → separate technical terminal evidence, not normal noise
- `IGNORED` → `INSTRUMENTATION_UNRESOLVED` unless explicit human/UI evidence exists

## Chosen identity: decision-event based

The single chosen identity is:

```text
notificationDecisionId =
  "notification-decision:" + SHA-256(
    stableJson({
      namespace: "R22_O05_NOTIFICATION_DECISION",
      scanId,
      signalId,
      channel: "EMAIL",
      decisionType: exact SignalClaimResult
    })
  )
```

The identity uses no wall-clock time, random UUID, email message ID, or
`attemptSequence`. It is deterministic and append-only:

- a different `scanId` separates independent scan runs;
- `CLAIMED` and `RETRY_CLAIMED` remain distinct even for the same signal and
  scan run;
- `SKIPPED_DUPLICATE` and `SKIPPED_EXPIRED` remain distinct;
- replaying the same logical claim reproduces the same ID and is an idempotent
  replay.

An attempt terminal ID is derived from the decision only:

```text
notificationTerminalId =
  "notification-terminal:" + SHA-256(
    stableJson({
      namespace: "R22_O05_NOTIFICATION_TERMINAL",
      notificationDecisionId
    })
  )
```

This makes delivery success and failure refer to the same logical attempt and
prevents one attempt from acquiring two terminal identities. The proposed
`attemptSequence` is retained as diagnostic metadata only: `1` for
`CLAIMED`, `2` for `RETRY_CLAIMED`, and `null` for skips.

## Proposed future metadata envelope

The future implementation may expose an additive metadata envelope containing:

- the exact `SignalClaimResult` outcome;
- the authoritative `scanId` and `signalId`;
- `channel=EMAIL`;
- the deterministic `notificationDecisionId`;
- `attemptSequence` and its source.

This task does not change `SignalClaimResult`, `claimSignal`, the RPC, or the
scan loop. No future implementation may change retry limits, duplicate/expiry
semantics, send decisions, or signal generation merely to produce evidence.

## N01-N07 remediation gates

| Gate | Status | Frozen rule |
| --- | --- | --- |
| N01 | `PASS` | All four runtime claim outcomes are enumerated. |
| N02 | `PASS` | Insert, retry CAS, and non-mutating skip `attempt_count` semantics are explicit. |
| N03 | `PASS` | Delivery start and terminal evidence share one delivery decision identity. |
| N04 | `PASS` | Every claim outcome has deterministic identity from authoritative scan and claim fields. |
| N05 | `PASS` | Same logical replay is idempotent without time or randomness. |
| N06 | `PASS` | Distinct runs, outcomes, and terminal events have non-colliding frozen preimages. |
| N07 | `PASS` | The proposed envelope is additive and behavior-preserving. |

Therefore:

```text
O05 runtimeStatus=INSTRUMENTATION_REQUIRED
O05 designStatus=DESIGN_READY
```

`DESIGN_READY` authorizes no runtime instrumentation. The next stage remains
blocked pending separate design acceptance.

## Governance and boundaries

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
observationAuthorized=false
performanceAuthorized=false
```

No PnL, forward return, performance, backtest, selection, or other economic
value is read, calculated, or used by this design. No market-event payload is
acquired. No private exchange API or trading capability is introduced.

## Final decision

```text
O05 REMEDIATION DESIGN READY
nextStage=STOP_PENDING_DESIGN_ACCEPTANCE
```

Stop at this design boundary. Do not enter O05 implementation,
instrumentation implementation, observation execution, performance, backtest,
selection, or Production.
