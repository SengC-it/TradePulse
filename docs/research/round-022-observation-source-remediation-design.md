# Round-022 Observation Source Readiness Remediation Design

Status: `DESIGN ONLY`  
Accepted source: `f2d563467a2249bd7cbcb9ae8b9995ccdf1ae036`  
Base: `research/round-015-beta-alpha-decomposition`  
Branch: `research/round-022-observation-source-remediation-design`

This document designs a minimum prospective remediation architecture. It does not make any currently missing source ready, does not implement runtime remediation, and does not authorize Observation.

## Current source audit

The accepted source was inspected directly, including the signal-advisory, signal-quality, alert-intelligence, advisory-evaluation, historical-review, Round-022 observation protocols, cron route, dashboard consumers, and Supabase migrations.

| Node | Current authoritative finding | Current status |
| --- | --- | --- |
| P01 Signal Advisory | `src/app/api/cron/signal-advisory/route.ts` calls `runSignalAdvisoryScan`; `scan.ts` builds closed-candle `signalTime`; `identity.ts` builds deterministic `signalId`; `store.ts` persists the advisory. | `SOURCE_READY` prerequisite only |
| S01 Quality Snapshot | `evaluateSignalQuality` exists, but no non-test production call site owns advisory identity or `informationAsOf`. | `FAIL` |
| S02 Market Context | Context helpers consume caller-supplied regime data and have no producer-owned PIT evidence. | `FAIL` |
| S03 Risk Advisory | Risk helpers exist, but no authoritative prospective producer and persisted PIT source exist. | `FAIL` |
| S04 Historical Review Metadata | `historical-review-protocol.ts` is design-only. The signal-review ledger is settlement/review state and is not prospective Historical Review metadata. | `FAIL` |
| S05 Alert Intelligence | `buildAlertIntelligence` is a caller-supplied wrapper; there is no non-test production invocation or durable complete-input linkage. | `FAIL` |
| S06 Presentation | Email and dashboard render call sites exist, but formatting is not evidence capture with R22 identity/PIT provenance. | `FAIL` |
| P02 Advisory Evaluation | Evaluator helpers exist without a non-test runtime producer/persistence boundary; it cannot substitute for S01-S06. | `FAIL` |
| S07-S10 | Causal validation, review events, and a shared append-only identity/PIT writer are not authoritative runtime sources today. | `FAIL` |

The existing O05 notification evidence sidecar is accepted and is preserved. This PR does not redesign `notificationDecisionId`, `terminalEventId`, terminal payloads, delivery truth, or same-scan retry semantics.

## Frozen source contract

Every future S01-S06 artifact is a server-produced immutable snapshot with:

```text
evidenceId
artifactId
artifactType
schemaVersion
advisoryIdentity
signalId
informationAsOf
capturedAt
sourceRef
payload
contentHash
evidenceHash
idempotencyKey
```

Identity is derived from the existing advisory identity and `signalId`; it is never a random or wall-clock identity. Hashing reuses the existing stable JSON serialization semantics: `contentHash` excludes `capturedAt` and `artifactId`, while `evidenceHash` includes the truthful server capture time and artifact identity. The snapshot idempotency key is:

```text
SHA-256(SNAPSHOT|signalId|artifactType|schemaVersion|informationAsOf|contentHash)
```

The future service-side append-only evidence store uses `evidence_id` as its physical primary key, `artifact_id` as the logical snapshot key, and rejects conflicts. It never updates, overwrites, last-writes-wins, fuzzy-matches, nearest-matches, backfills, or silently repairs an invalid record.

The causal contract is fixed:

```text
informationAsOf <= signalTime <= capturedAt
signalTime <= advisoryCreationTime
signalTime <= notificationObservedAt
signalTime <= reviewStartedAt <= reviewSubmittedAt
```

`signalTime` is the closed-candle market-event time from the advisory. `informationAsOf` is a producer-owned source cutoff, not local capture time. `capturedAt` is truthful server wall-clock UTC and may be after `signalTime`; it is never backdated. Any inversion is `NOT_EVALUABLE`.

## Remediation dependency DAG

Each node has an explicit producer, call boundary, identity, PIT source, persistence rule, causal rule, dependencies, consumers, acceptance evidence, and failure mode in the machine-readable contract.

```text
P01
├── S01 QUALITY_SNAPSHOT ─┐
├── S02 MARKET_CONTEXT ───┤
├── S03 RISK_ADVISORY ────┤
└── S04 HISTORICAL_REVIEW ┘
                 │
                 └── S05 ALERT_INTELLIGENCE
                              │
                              └── S06 PRESENTATION

P01 ── S07 causal validator ── S08 REVIEW_STARTED ── S09 REVIEW_SUBMITTED
  \______________________________________________________________/
                               │
                               └── P02 ADVISORY_EVALUATION

S10 shared identity/PIT/append-only writer spans every future producer.
```

Important boundaries:

- S05 is not complete while any S01-S04 input lacks an authoritative prospective producer.
- S04 must use a new prospective, identity-only source. `historical-review-protocol.ts` is not runtime metadata, and signal-review settlement state cannot qualify it.
- S06 presentation formatting is not evidence capture. The exact email/web payload must be captured before rendering/response.
- P02 is downstream-only and cannot replace upstream source evidence.
- O05 is consumed additively; its accepted notification and terminal contracts stay unchanged.

## Deterministic future implementation order

These are separate future stages, each independently mergeable and separately authorized. This PR authorizes none of them. Stage ownership uses two distinct concepts: `introducesCapabilities` records foundation or integration capability introduction, while `closesReadinessNodes` records the one stage that may finally close a readiness node. The old ambiguous `covers` meaning is not used.

| Stage | Introduces capabilities | Closes readiness nodes | Depends on |
| --- | --- | --- | --- |
| R1 | Shared identity, snapshot hashing/idempotency, append-only writer, PIT and causal primitives | None | P01 |
| R2 | Prospective `QUALITY_SNAPSHOT` producer | S01 | R1 |
| R3 | Prospective `MARKET_CONTEXT` producer | S02 | R1 |
| R4 | Prospective `RISK_ADVISORY` producer | S03 | R1 |
| R5 | Prospective identity-only `HISTORICAL_REVIEW_METADATA` producer | S04 | R1 |
| R6 | `ALERT_INTELLIGENCE` producer with complete-input gate | S05 | R2, R3, R4, R5 |
| R7 | Presentation payload evidence boundary | S06 | R6 |
| R8 | Notification `observedAt` and cross-source causal integration, preserving O05 | None | R1 |
| R9 | Server-side `REVIEW_STARTED`, `REVIEW_SUBMITTED`, and human-review timestamp causality | S07, S08, S09 | R1-R8 |
| R10 | Downstream Advisory Evaluation and evidence-completeness closure | S10 | R2-R9 |

### Frozen stage ownership

Every readiness node S01-S10 has exactly one `readinessClosureStage`; a foundation stage may introduce shared capabilities without closing readiness. The frozen mapping is:

| Readiness node | Foundation stage | Integration stage | Readiness closure stage |
| --- | --- | --- | --- |
| S01 | R1 | R2 | R2 |
| S02 | R1 | R3 | R3 |
| S03 | R1 | R4 | R4 |
| S04 | R1 | R5 | R5 |
| S05 | R1 | R6 | R6 |
| S06 | R1 | R7 | R7 |
| S07 | R1 | R8 | R9 |
| S08 | R1 | R9 | R9 |
| S09 | R1 | R9 | R9 |
| S10 | R1 | R1 | R10 |

R1 introduces the S07/S10 foundation but closes neither. R8 integrates notification causality but does not claim readiness. R9 is the selected S07 closure owner because it depends on R1-R8 and therefore includes the notification and human-review causal requirements. R10 is the unique S10 closure owner after all source producers and review lifecycle stages are complete.

No single future PR is authorized to implement all stages.

## Historical Review producer

S04 has no current runtime producer. The future producer is valid only as a prospective identity-only metadata producer:

- Input: current P01 advisory identity, exact prior identity/context references whose source event time is at or before `signalTime`, and an approved source manifest.
- PIT cutoff: `signalTime`; no input after it is permitted.
- Output: `HISTORICAL_REVIEW_METADATA` snapshot with exact references, `sourceRef`, `informationAsOf`, hashes, and identity-only context.
- Missing input: `NOT_EVALUABLE`.
- Forbidden: current-signal future outcome, forward return, realized PnL, retrospective backfill, settlement state, fuzzy matching, nearest-timestamp matching, or an inferred substitute.

The design is ready, but S04 remains currently `FAIL` until a separately approved runtime producer and evidence writer exist.

## Human Review lifecycle

Human review uses two separate server-authoritative append-only events:

```text
REVIEW_STARTED  -> REVIEW|reviewObservationId|START
REVIEW_SUBMITTED -> REVIEW|reviewObservationId|SUBMIT
```

Both link to the advisory identity. The server supplies `reviewStartedAt` and `reviewSubmittedAt`; client timestamps are not authoritative. The frozen order is `signalTime <= reviewStartedAt <= reviewSubmittedAt`. Abandonment does not create a fabricated submission; missing submission is `NOT_EVALUABLE`.

## Design gates

`R01` through `R12` all PASS for this design because the source mapping, DAG, future producers, identity/PIT model, historical-review restrictions, review lifecycle, O05 compatibility, independent stage order, unique readiness closure ownership, isolation, and governance are explicit. R10 specifically requires independently gated, topologically valid implementation stages with exactly one closure owner for every readiness node. This does not convert the current S01-S10 statuses to `SOURCE_READY`.

## Scope and governance

This PR contains design artifacts only. It has no runtime writer, migration, API change, notification change, scheduler change, dashboard/UI change, market-data acquisition, backfill, Performance, Backtest, Selection, or economic evaluation.

```text
ROUND-022 SOURCE REMEDIATION DESIGN READY
nextStage=STOP_PENDING_DESIGN_ACCEPTANCE

observationInstrumentationImplemented=false
observationAuthorized=false
observationExecuted=false
performanceAuthorized=false
performanceExecutionCount=0
performanceLedgerPresent=false
economicValuesRead=false
forwardReturnRead=false
newMarketDataFetched=false
historicalBackfillExecuted=false
Production unchanged
baseline-002=NOT_FROZEN
M3-J=BLOCKED
M4=NOT_STARTED
humanDecisionRequired=true
automaticTrading=false
```
