# TradePulse Round-022 — Signal Quality & Risk Advisory Engine

Phase: **SIGNAL_QUALITY_RISK_ADVISORY_DESIGN_ONLY**
Accepted source: `1a8b9c04c9dc9fa6614a7114a01addc4c6744579`
Branch: `research/round-022-signal-quality-design`

## Boundary

TradePulse remains a signal-advisory system. This design emits `LONG`, `SHORT`,
or `NO_SIGNAL` with a quality grade of `A`, `B`, `C`, or `IGNORE`. It does not
place orders, calculate position size, manage funds, automatically open or close
positions, or turn a stop/target into an execution instruction.

`humanDecisionRequired=true` and `automaticTrading=false` are immutable output
requirements.

This is a design contract only. No performance, backtest, selection, parameter
optimization, economic evaluation, forward-return read, or new market-data
acquisition is authorized.

## Signal Quality Engine

The engine evaluates an already-generated formal advisory snapshot. Required
facts are:

- direction: `LONG`, `SHORT`, or `NO_SIGNAL`;
- reference price, stop loss, and take profit;
- fully closed candle;
- fresh data;
- complete signal identity and strategy snapshot;
- an existing market regime snapshot: `BULL`, `NEUTRAL`, `BEAR`, or `UNKNOWN`.

The critical checks are fail-closed. `NO_SIGNAL`, an open candle, stale data,
an incomplete identity/snapshot, or directionally invalid risk geometry produces
`IGNORE` and cannot produce a valid advisory from this layer.

The executable pure reference implementation is
`src/lib/research/m3-r22-signal-quality-design-protocol.ts`, function
`assessR22SignalQuality`.

## LONG and SHORT assessment

Both directions use the same contract, with direction-aware ordering:

```text
LONG:  stopLoss < referencePrice < takeProfit
SHORT: takeProfit < referencePrice < stopLoss
```

If the ordering is invalid, the result is `IGNORE`. The direction is never
flipped by the quality layer.

### Grades

After all critical checks pass:

- `A`: context is `SUPPORTIVE` and risk state is `STANDARD`;
- `B`: valid advisory, but neither the A nor C rule applies;
- `C`: valid advisory with `ADVERSE` or `UNAVAILABLE` context;
- `IGNORE`: no signal or any critical validation failure.

The grade is an operational review-priority label, not a claim about future
profitability or outcome.

## Market Context Advisory

The context layer reads the existing signal snapshot context only. It does not
fetch a new market series or recalculate the strategy.

- LONG + BULL → `SUPPORTIVE`;
- SHORT + BEAR → `SUPPORTIVE`;
- LONG + BEAR or SHORT + BULL → `ADVERSE`;
- NEUTRAL → `NEUTRAL`;
- UNKNOWN → `UNAVAILABLE`.

Context never changes the signal direction and never authorizes execution.

## Risk Advisory

Risk output is static pre-trade geometry, not a realized outcome:

```text
riskDistance = abs(referencePrice - stopLoss)
rewardDistance = abs(takeProfit - referencePrice)
riskRewardRatio = rewardDistance / riskDistance
```

For valid direction-aware geometry, `riskRewardRatio >= 1` is `STANDARD` and
`riskRewardRatio < 1` is `CAUTION`. Missing, non-positive, non-finite, or
directionally invalid values are `UNAVAILABLE` and cause `IGNORE`. `NO_SIGNAL`
is `NOT_APPLICABLE`.

This output does not calculate position size, account risk, leverage, funding,
P/L, expectancy, drawdown, or any other outcome metric.

## Historical Signal Review

Round-022 defines an identity-only review boundary over
`public.tp_signal_advisories`. The identity is:

```text
(signalId, symbol, direction, signalTime, strategyId, strategyVersion)
```

The future review record may retain the quality grade, context alignment, risk
state, and review status. It does not consume `tp_signal_results`, read future
outcomes, or generate performance metrics. A separate result-linkage contract
must be approved before any outcome review exists.

## Frozen output contract

Every result contains `direction`, `qualityGrade`, `qualityStatus`,
`marketContext`, `riskAdvisory`, `reasons`, `humanDecisionRequired=true`, and
`automaticTrading=false`. `IGNORE` is a safe no-advisory state; it is not an
execution action.

## Governance

The design keeps:

- `performanceExecutionCount=0`;
- performance ledger absent;
- performance, backtest, selection, parameter optimization, and economic
  evaluation disabled;
- no new market data fetched;
- Production unchanged;
- `baseline-002=NOT_FROZEN`;
- `M3-J=BLOCKED`;
- `M4=NOT_STARTED`;
- `automaticTrading=false`.

The next step is **not** entered automatically. This branch stops at design-only
review and acceptance.
