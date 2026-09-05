# TradePulse Round-022 — Advisory Evaluation Design

Phase: **ADVISORY_EVALUATION_DESIGN_ONLY**
Accepted research source: `d5ead14573153c24de7d6d37bd63086f9475cde5`
Branch: `research/round-022-advisory-evaluation-design`

## Boundary and purpose

This design defines a non-economic evaluation framework for the existing
Signal Quality, Historical Review, and Alert Intelligence presentation layers.
It evaluates whether an advisory is clear, complete, risk-visible, and useful
for human review. It is not a strategy evaluator and is not a performance,
backtest, PnL, forward-return, selection, or optimization system.

The protocol observes already-produced advisory metadata only. It does not
generate signals, change signal quality, change a quality grade, alter risk
advisories, rank by future outcome, or influence a trading decision.

The product boundary remains:

```text
public market data -> signal -> quality/context/risk/review metadata
                    -> alert presentation -> HUMAN DECISION
```

```text
humanDecisionRequired=true
automaticTrading=false
```

No order execution, position sizing, leverage, automatic stop-loss/take-profit,
account management, or profit prediction is part of this design.

## Observation contract

Each evaluation observation must contain only present-time or user-review
metadata:

- signal direction and an identity key;
- quality snapshot availability and grade;
- market-context availability;
- risk-advisory availability;
- identity-only historical-review status;
- presentation observations for clarity, explanation completeness, risk
  visibility, context completeness, unnecessary-alert classification, and
  notification disposition;
- human-review observations for review completion, information sufficiency,
  and a non-economic decision-latency proxy in milliseconds.

The protocol has no field for PnL, profit, loss, forward return, performance,
or economic outcome. Historical review is metadata-only; it never carries an
outcome value.

## Advisory quality metrics

Every binary observation is mapped deterministically to `1` for true and `0`
for false. At a later batch-aggregation stage, each metric is the arithmetic
mean over evaluable observations only; no missing observation is imputed as
zero.

- `signalClarity`: the direction and identity are clear to a human reviewer;
- `explanationCompleteness`: the four presentation explanation areas are
  present;
- `riskVisibility`: the risk advisory is visible in the presentation;
- `contextCompleteness`: current market context is present.

These metrics describe presentation quality. They must not feed signal
generation, quality scoring, grade assignment, or execution logic.

## Noise reduction metrics

Rates are computed only over evaluable observations:

- `unnecessaryAlertRate` = unnecessary-alert observations / evaluable
  observations;
- `ignoreRatio` = observations with notification disposition `IGNORED` /
  evaluable observations;
- `duplicateAlertRate` = observations with disposition `DUPLICATE_SKIPPED` /
  evaluable observations.

`IGNORED`, `SUPPRESSED`, and `DUPLICATE_SKIPPED` are observed notification
dispositions. This design does not change the notification decision or the
upstream signal stream.

## Human review efficiency metrics

- `reviewCompleteness` = completed human reviews / evaluable observations;
- `informationSufficiency` = reviews marked information-sufficient /
  evaluable observations;
- `decisionLatencyProxyMs` = the arithmetic mean of supplied non-negative
  review-latency proxy values. It is a UX observation only, not a trade outcome
  or execution latency.

Missing latency is not imputed. An observation without a valid latency proxy is
`NOT_EVALUABLE`.

## Stability metric

The same observation must produce byte-equivalent deterministic protocol output
when evaluated again. `compareR22AdvisoryEvaluationStability` returns:

- `STABLE` when two observable outputs are identical;
- `NOT_STABLE` when both are observable but differ;
- `NOT_EVALUABLE` when either output is fail-closed.

Stability is checked on the same input and does not use future information.

## Fail-closed rules

No evaluation metrics are produced when any required identity, quality,
context, risk, historical metadata, presentation observation, human-review
observation, or latency proxy is missing. `NO_SIGNAL` is not an alert and is
`NOT_EVALUABLE`; it is never converted into an alert or counted as a quality
success. The protocol does not turn missing data into a zero or a favorable
assessment.

## Evaluation contract and governance

The metrics are **allowed to observe** advisory presentation and human-review
metadata. They are **forbidden to influence**:

- signal generation or direction;
- Signal Quality Score or Quality Grade;
- risk-advisory generation;
- scheduler, cron, email, or dashboard delivery behavior;
- strategy parameters, selection, performance, or trading decisions.

This branch is design-only. It does not authorize implementation, performance,
backtest, selection, economic evaluation, new market-data acquisition, shadow
activation, scheduler activation, or Production changes.

```text
performanceExecutionCount=0
performanceLedgerPresent=false
performanceExecuted=false
backtestExecuted=false
selectionExecuted=false
economicEvaluationExecuted=false
economicValuesRead=false
forwardReturnRead=false
newMarketDataFetched=false
Production unchanged
baseline-001 unchanged
baseline-002=NOT_FROZEN
M3-J=BLOCKED
M4=NOT_STARTED
automaticTrading=false
humanDecisionRequired=true
```

## Evidence outputs

This design is represented by:

- `docs/research/round-022-advisory-evaluation-design.md`;
- `docs/research/round-022-advisory-evaluation-contract.json`;
- `src/lib/research/advisory-evaluation-protocol.ts`;
- `tests/round-022-advisory-evaluation-protocol.test.ts`.

No production UI, SMTP, route, scheduler, database, or signal-engine file is
changed.

Final design decision: `ROUND-022 ADVISORY EVALUATION DESIGN ONLY`.
Next stage: `STOP_PENDING_DESIGN_ACCEPTANCE`.
