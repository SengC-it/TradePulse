# Round-022 Observation Source Readiness

Status: DESIGN / SOURCE READINESS AUDIT ONLY

Accepted research source: `4bb8eeea60413c4295e8a3bac8897e7f3222f620`

Base branch: `research/round-015-beta-alpha-decomposition`

This remediation aligns the audit with the frozen Observation
Instrumentation Contract. The six S-series entries are snapshot artifacts,
not every upstream or downstream object in the advisory system.

## Frozen snapshot artifact types

The S-series is exactly:

```text
S01 QUALITY_SNAPSHOT
S02 MARKET_CONTEXT
S03 RISK_ADVISORY
S04 HISTORICAL_REVIEW_METADATA
S05 ALERT_INTELLIGENCE
S06 PRESENTATION
```

`SIGNAL_ADVISORY` and `ADVISORY_EVALUATION` are not substitutes for any of
these six artifacts.

## Corrected source matrix

| ID / artifact | Runtime producer and call site | Identity and PIT source | Status | Finding |
| --- | --- | --- | --- | --- |
| S01 `QUALITY_SNAPSHOT` | `src/lib/signal-quality/evaluator.ts`; `evaluateSignalQuality`; no non-test production call site | Caller-supplied input; no authoritative advisory identity or `informationAsOf` | `SOURCE_UNVERIFIED / FAIL` | Existing evaluator result is not an authoritative R22 snapshot. |
| S02 `MARKET_CONTEXT` | `src/lib/signal-quality/evaluator.ts`; `deriveMarketContextAdvisory` inside `evaluateSignalQuality`; no non-test production call site | Caller-supplied `marketRegime`; no server-owned identity, cutoff, or PIT boundary | `SOURCE_UNVERIFIED / FAIL` | Helper/DTO and Strategy regime fields do not prove a prospective producer. |
| S03 `RISK_ADVISORY` | `src/lib/signal-quality/evaluator.ts`; `deriveRiskAdvisory` inside `evaluateSignalQuality`; no non-test production call site | Caller-supplied stop/target/reference fields; no authoritative identity or `informationAsOf` | `SOURCE_UNVERIFIED / FAIL` | Risk geometry fields are not a frozen runtime Risk Advisory artifact. |
| S04 `HISTORICAL_REVIEW_METADATA` | No non-research runtime producer | None | `SOURCE_ABSENT / FAIL` | `historical-review-protocol.ts` remains `HISTORICAL_SIGNAL_REVIEW_DESIGN_ONLY`; `signal-review` is settlement/review state, not this metadata. |
| S05 `ALERT_INTELLIGENCE` | `src/lib/alert-intelligence/index.ts`; `buildAlertIntelligence`/`buildAlertPayload`; no non-test production call site | Caller-supplied signal identity; no producer-owned linkage or `informationAsOf` | `SOURCE_UNVERIFIED / FAIL` | The wrapper and fallback do not establish a runtime producer. Missing S04 cannot be bypassed. |
| S06 `PRESENTATION` | `src/lib/signal-advisory/email.ts` and `dashboard-ui.tsx`; notification send and `AdvisoryTable` call sites exist | Signal advisory identity exists, but no R22 evidence identity, cutoff, or capture provenance | `SOURCE_UNVERIFIED / FAIL` | Static formatting/presentation paths do not produce the required R22 evidence artifact. |

The audit does not fabricate, reconstruct, backfill, infer, fuzzy-match, or
use future outcomes, forward returns, or realized results to fill any source.

## Supporting prerequisites

These are retained as supporting evidence only:

| ID | Type | Status | Finding |
| --- | --- | --- | --- |
| P01 | `SIGNAL_ADVISORY` | `SOURCE_READY / PASS` | `signal-advisory/route.ts -> runSignalAdvisoryScan -> buildAdvisory -> claimSignal` provides the base signal identity and closed-candle `signalTime`; it cannot make S01-S06 pass. |
| P02 | `ADVISORY_EVALUATION` | `SOURCE_UNVERIFIED / FAIL` | Evaluator/protocol DTO exists, but no non-test runtime call site or persistence source was found; it cannot substitute for an S-series snapshot. |

P01/P02 are never included in the S01-S10 all-pass predicate.

## O03 timestamp matrix

| Timestamp | Current source | Status |
| --- | --- | --- |
| `signalTime` | Closed candle `closeTime` in `scan.ts -> buildAdvisory` and advisory `signal_time` | `AVAILABLE_SOURCE`; server authoritative |
| `advisoryCreationTime` | Advisory row `created_at DEFAULT now()` | `AVAILABLE_SOURCE`; server authoritative but not schema-immutable |
| `informationAsOf` | No current producer | `FUTURE_SOURCE` |
| `capturedAt` | No durable Observation writer | `FUTURE_SOURCE` |
| `notificationObservedAt` | O05 event hook has no `observedAt` and no durable completion | `SOURCE_UNVERIFIED` |
| `reviewStartedAt` | No server producer | `SOURCE_ABSENT` |
| `reviewSubmittedAt` | No server producer | `SOURCE_ABSENT` |

Required future causal rules:

```text
informationAsOf <= signalTime <= capturedAt
signalTime <= advisoryCreationTime
signalTime <= notificationObservedAt
signalTime <= reviewStartedAt <= reviewSubmittedAt
```

Future instrumentation timestamps are not current ready sources.

## O05 and Human Review

O05 remains:

```text
o05RemediationImplemented=true
observationInstrumentationImplemented=false
observer=BEST_EFFORT_RUNTIME_SIDECAR
observer invocation != durable Observation persistence
```

S08 `REVIEW_STARTED` and S09 `REVIEW_SUBMITTED` remain independent gates.
Neither has a real server-authoritative producer, so both are
`SOURCE_ABSENT / FAIL`.

## Gates and final decision

```text
S01 FAIL
S02 FAIL
S03 FAIL
S04 FAIL
S05 FAIL
S06 FAIL
S07 FAIL  (timestamp causality)
S08 FAIL  (REVIEW_STARTED absent)
S09 FAIL  (REVIEW_SUBMITTED absent)
S10 FAIL  (identity / provenance / PIT safety)
```

All S01-S10 must pass before readiness can pass. Current result:

```text
ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE
nextStage=STOP
```

## Scope and governance

Only the design/audit artifacts in this PR are changed. No runtime
remediation, Observation Instrumentation, Observation execution, 30-day
Observation, Performance, Backtest, Selection, or Production work is
authorized.

```text
observationInstrumentationImplemented=false
observationExecuted=false
observationAuthorized=false
historicalBackfillExecuted=false
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
performanceAuthorized=false
```
