# Round-022 R9 Human Review Causal Lifecycle

Status: `IMPLEMENTATION_ONLY`

Accepted source: `b393334ec7203e6eb08565aaad413ef269bd8147`

R9 adds only the server-side human-review lifecycle:

- `REVIEW_STARTED`
- `REVIEW_SUBMITTED`
- server-owned human-review timestamp causality

R9 is the unique closure owner for S07, S08, and S09. R10 remains the unique owner of S10 and is not implemented here.

## Runtime boundaries

The protected server endpoints are:

- `POST /api/dashboard/human-review/start`
- `POST /api/dashboard/human-review/submit`

The server resolves the authoritative advisory identity from `tp_signal_advisories`. The client supplies only `signalId` for start, and `signalId` plus the three explicit labels for submit. Client timestamps and client-supplied symbol, direction, signal time, strategy identity, or capture time are not accepted.

Both events use the existing R1 `tp_observation_evidence` table and `SupabaseObservationEvidenceStore`; no migration or second evidence table is introduced.

## Identity and replay

`reviewObservationId` is deterministic:

`R22_REVIEW|signalId|m3-r22-observation-instrumentation-design-002`

The append-only event identities are distinct:

- `REVIEW|reviewObservationId|START`
- `REVIEW|reviewObservationId|SUBMIT`

The same retry is an `IDEMPOTENT_REPLAY`. A submit must first load and validate the persisted `REVIEW_STARTED` event for the same review session and advisory identity. No timestamp is fabricated, repaired, overwritten, or backdated.

## Causality and labels

The frozen invariant is:

`signalTime <= reviewStartedAt <= reviewSubmittedAt`

Both review timestamps and `capturedAt` are server wall-clock values. A pre-signal start, submit-before-start, missing start, invalid start, or identity mismatch is `NOT_EVALUABLE`.

`REVIEW_STARTED` contains no human labels. `REVIEW_SUBMITTED` accepts only explicit human values for:

- `reviewComplete`
- `informationSufficient`
- `unnecessaryAlert`

`decisionLatencyProxyMs` is derived only as `reviewSubmittedAt - reviewStartedAt`; it is descriptive human-review metadata, not a trading or performance metric, and never feeds an upstream signal or advisory component.

The legacy settlement/outcome review ledger is not read or used as R22 human-review evidence. No forward outcome, settlement state, PnL, backtest, performance, selection, historical backfill, or new market data is read.

## Frozen status

- R6/R7/R8: `ACCEPTED`
- S01-S06: `SOURCE_READY`
- S07-S09: `SOURCE_READY_PENDING_ACCEPTANCE`, `acceptedReady=false`
- S10: `FAIL`
- `observationAuthorized=false`
- `observationExecuted=false`
- `performanceExecutionCount=0`
- `performanceLedgerPresent=false`
- `economicValuesRead=false`
- `forwardReturnRead=false`
- `newMarketDataFetched=false`
- `historicalBackfillExecuted=false`
- `baseline-002=NOT_FROZEN`
- `M3-J=BLOCKED`
- `M4=NOT_STARTED`
- `humanDecisionRequired=true`
- `automaticTrading=false`
- Production unchanged

Final decision: `ROUND-022 R9 HUMAN REVIEW CAUSAL LIFECYCLE IMPLEMENTATION READY`

Next stage: `STOP_PENDING_R9_ACCEPTANCE`
