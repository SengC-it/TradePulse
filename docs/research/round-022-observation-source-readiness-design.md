# Round-022 Observation Source Readiness

Status: DESIGN / SOURCE AUDIT ONLY

Accepted research source: `4bb8eeea60413c4295e8a3bac8897e7f3222f620`

Base branch: `research/round-015-beta-alpha-decomposition`

This artifact audits the real runtime producers needed by the Round-022
observation contract. Research protocols, fixtures, mocks, synthetic data,
backfill plans, and reconstructed metadata are not runtime producers.

## Scope boundary

This change does not implement instrumentation, an observation writer,
Historical Review runtime, Human Review runtime, or any production behavior.
It does not run observation, backfill, performance, backtest, selection, or
economic evaluation, and it does not acquire market data.

## O04 source matrix

| ID | Required source | Runtime producer audit | Identity / PIT finding | Status |
| --- | --- | --- | --- | --- |
| S01 | QUALITY_RESULT / QUALITY_SNAPSHOT | `src/lib/signal-quality/evaluator.ts`, `evaluateSignalQuality`; no non-test production call site found | Caller input has no authoritative advisory identity, signal time, strategy identity, or `informationAsOf` | `SOURCE_UNVERIFIED / FAIL` |
| S02 | SIGNAL_ADVISORY | `src/lib/signal-advisory/scan.ts` (`buildAdvisory`) and `store.ts` (`claimSignal`) | Closed candle `closeTime` becomes `signalTime`; identity uses symbol, direction, signal time, and strategy version; server row has `created_at` | `SOURCE_READY / PASS` |
| S03 | ALERT_INTELLIGENCE | `src/lib/alert-intelligence/index.ts`; no non-test production invocation found | Caller-supplied inputs and research protocol delegation do not prove producer-owned identity or PIT cutoff | `SOURCE_UNVERIFIED / FAIL` |
| S04 | HISTORICAL_REVIEW_METADATA | No non-research runtime producer | `historical-review-protocol.ts` is design-only; `signal-review` is settlement/review state, not prospective Historical Review metadata | `SOURCE_ABSENT / FAIL` |
| S05 | ADVISORY_EVALUATION | `src/lib/advisory-evaluation/evaluator.ts`; no non-test production invocation or persistence found | Caller-supplied identity and research contract do not establish runtime provenance | `SOURCE_UNVERIFIED / FAIL` |
| S06 | PRESENTATION | `src/lib/signal-advisory/email.ts` and dashboard `AdvisoryTable` | Email/dashboard presentation has no R22 presentation evidence identity, `informationAsOf`, or `capturedAt` | `SOURCE_UNVERIFIED / FAIL` |

S02 is the only source currently ready. A builder or evaluator function is
not promoted to a producer merely because it exists; it must be reached by a
non-test runtime path and expose authoritative identity and PIT provenance.

## O03 timestamp matrix

| Timestamp | Runtime source | Server authoritative | Immutable | Current status |
| --- | --- | --- | --- | --- |
| `signalTime` | `scan.ts -> buildAdvisory`; closed candle `closeTime` and `tp_signal_advisories.signal_time` | yes | yes in current signal identity | `AVAILABLE_SOURCE` |
| `advisoryCreationTime` | `store.ts`; `tp_signal_advisories.created_at DEFAULT now()` | yes | no schema-level immutable-update constraint | `AVAILABLE_SOURCE` |
| `informationAsOf` | no current producer | no | n/a | `FUTURE_SOURCE` |
| `capturedAt` | no durable observation writer | no | n/a | `FUTURE_SOURCE` |
| `notificationObservedAt` | O05 observer call sites | no | n/a | `SOURCE_UNVERIFIED`; event has no `observedAt` and observer is non-durable |
| `reviewStartedAt` | no server review-start action/API/store | no | n/a | `SOURCE_ABSENT` |
| `reviewSubmittedAt` | no server review-submit action/API/store | no | n/a | `SOURCE_ABSENT` |

The required causal rules are frozen for any future implementation:

```text
informationAsOf <= signalTime <= capturedAt
signalTime <= advisoryCreationTime
signalTime <= notificationObservedAt
signalTime <= reviewStartedAt <= reviewSubmittedAt
```

The audit does not infer or backfill a missing timestamp. Unresolved or
causally invalid evidence must fail closed.

## O05 notification remediation boundary

PR #87 remediation is present as `o05RemediationImplemented=true`.
`notification-evidence.ts` and `scan.ts` define deterministic decision/event
identity and the events `CLAIM_DECISION`, `DELIVERY_ATTEMPTED`, `DELIVERED`,
`DELIVERY_FAILED`, and `DELIVERY_REGISTRY_PERSISTENCE_FAILED`.

The observer is a `BEST_EFFORT_RUNTIME_SIDECAR`. Its invocation is not durable
Observation persistence. Therefore:

```text
o05RemediationImplemented=true
observationInstrumentationImplemented=false
```

O05 does not make S06 or the missing Observation writer ready.

## S07-S10 and fail-closed result

| Gate | Result | Finding |
| --- | --- | --- |
| S07 | `FAIL` | Snapshot, notification, and human-review causal timestamps are unresolved |
| S08 | `FAIL / SOURCE_ABSENT` | No `REVIEW_STARTED` producer |
| S09 | `FAIL / SOURCE_ABSENT` | No `REVIEW_SUBMITTED` producer |
| S10 | `FAIL / SOURCE_UNVERIFIED` | No common authoritative identity/provenance/PIT chain |

All S01-S10 gates must pass for readiness. Since they do not, the result is:

```text
ROUND-022 OBSERVATION SOURCE READINESS INELIGIBLE
nextStage=STOP
```

## Governance

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
```

No remediation, Observation execution, Historical Review runtime, Human
Review runtime, performance, backtest, selection, or Production work is
authorized by this design audit.
