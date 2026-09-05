# TradePulse Round-022 — Alert Intelligence Layer

Phase: **ALERT_INTELLIGENCE_DESIGN_ONLY**  
Accepted research source: `32617afd2bf576465ddec04dccff7c93e47639e7`  
Branch: `research/round-022-alert-intelligence-design`

## Boundary

TradePulse remains a signal-advisory system. This design presents existing
signal, quality, context, risk, and historical-review metadata for a human
decision. It does not create a signal, change the Signal Engine, or authorize
execution.

Every presentation must preserve:

```text
humanDecisionRequired=true
automaticTrading=false
```

The design does not include automatic trading, order placement, position
calculation, leverage advice, automatic stop-loss/take-profit handling, or fund
management.

## Alert Intelligence Contract

The input is a composition of existing snapshots only:

- `signal`: direction, exact advisory identity, and the upstream trigger explanation;
- `quality`: the existing quality grade/score and explanations, consumed without recalculation;
- `marketContext`: regime, alignment, and explanation;
- `riskAdvisory`: risk level and explanation, without position sizing;
- `historicalReview`: identity-only review metadata and a display summary.

The output is a presentation object containing:

- alert summary;
- unchanged `LONG`, `SHORT`, or `NO_SIGNAL` direction;
- quality grade and passthrough quality score;
- deterministic priority and notification importance;
- risk explanation;
- historical context;
- explanations for why the advisory triggered, the current environment, risk,
  and historical reference;
- human review notes;
- `humanDecisionRequired=true` and `automaticTrading=false`.

The protocol is a pure metadata function in
`src/lib/research/alert-intelligence-protocol.ts`. It has no database, network,
market-data, outcome, or execution dependency.

## Direction and fail-closed behavior

The layer never flips direction and never turns `NO_SIGNAL` into a signal.

- A complete identity is required for a notification-ready LONG or SHORT.
- `NO_SIGNAL` or an incomplete identity is `SUPPRESSED`, grade `IGNORE`,
  priority `IGNORE`, and `DO_NOT_NOTIFY`.
- A missing quality snapshot, market context, or risk advisory produces a
  `DEGRADED` presentation with reduced confidence, `P3` priority, and `LOW`
  notification importance.
- Missing historical-review metadata is disclosed as unavailable; it cannot be
  replaced with an inferred outcome.

Missing inputs lower credibility; they never create a stronger alert.

## Alert prioritization

Prioritization is deterministic and uses only present-time advisory metadata:

| Priority | Rule | Notification importance | Attention rank |
| --- | --- | --- | --- |
| `P1` | Complete identity, quality `A`, supportive context, standard risk | `HIGH` | 1 |
| `P2` | Complete core inputs, but the P1 rule does not apply | `NORMAL` | 2 |
| `P3` | Quality, context, or risk input is missing/invalid | `LOW` | 3 |
| `IGNORE` | `NO_SIGNAL` or incomplete identity | `DO_NOT_NOTIFY` | — |

No priority uses PnL, forward return, future outcome, backtest, or performance
data. Priority is an attention ordering, not a profitability ranking.

## Explanation contract

The presentation must answer four separate questions without adding strategy
logic:

1. **Why triggered?** — pass through the existing upstream trigger explanation;
2. **Current environment?** — pass through market-context regime/alignment;
3. **Risk where?** — pass through the risk-advisory explanation;
4. **Historical reference?** — pass through identity-only review metadata, or
   explicitly state that it is unavailable.

The layer does not derive a new score, grade, threshold, signal, or outcome.

## Email/Web presentation contract

Email and web are consumers of the same presentation schema. This phase only
freezes data shape; it does not modify production UI, templates, SMTP, routes,
storage, scheduler, or notification delivery.

Both consumers may display:

- summary, direction, grade, score, priority, and importance;
- the four explanation fields;
- risk explanation and historical context;
- human review notes and the mandatory manual-decision boundary.

Neither consumer may add execution controls, account data, position size,
leverage, automatic stops/targets, or a future-outcome claim.

## Governance

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
newMarketDataFetched=false
Production unchanged
baseline-002=NOT_FROZEN
M3-J=BLOCKED
M4=NOT_STARTED
automaticTrading=false
```

Final design decision: `ROUND-022 ALERT INTELLIGENCE DESIGN ONLY`.
Next stage: `STOP_PENDING_DESIGN_ACCEPTANCE`.
