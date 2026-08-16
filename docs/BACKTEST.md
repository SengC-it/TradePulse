# TradePulse Backtest Specification

Status: M3-A specification freeze; no Backtest Runner is implemented.

This document freezes the historical research protocol for baseline-001. It
defines a separate execution and settlement policy so that a change in
historical fill assumptions cannot silently change the Strategy Engine.

## Version split

Every backtest report must contain both version identifiers:

- `strategyVersion = baseline-001` — decides whether a candidate/formal signal
  exists and supplies its immutable research references.
- `backtestPolicyVersion = bt-policy-001` — defines hypothetical entry,
  slippage, fees, funding, settlement, time exit, and metric treatment.

Changing `bt-policy-001` does not change `baseline-001`. Any strategy-rule
change requires a reviewed Strategy Change and a new strategy version. The
backtest policy is a research assumption, not a claim about guaranteed fills,
fees, funding, or profit.

## Frozen evaluation periods

All timestamps are UTC and inclusive:

| Period | Start | End | Status |
| --- | --- | --- | --- |
| DEV / in-sample | `2023-01-01T00:00:00.000Z` | `2025-12-31T23:59:59.999Z` | Frozen |
| OOS | `2026-01-01T00:00:00.000Z` | `2026-08-15T23:59:59.999Z` | LOCKED |

Warm-up candles may be loaded before each period's start, but warm-up rows
must not enter performance statistics. Before the first evaluated signal time,
the loader must provide at least 205 fully closed 4H candles and 55 fully
closed 1H candles. If the required warm-up or evaluation data is unavailable,
the run fails closed as incomplete.

The OOS period is locked before any baseline results are inspected. OOS data
must not be used to tune, select, or alter baseline-001 parameters.

## Historical universe and data source

The universe is exactly:

`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, and `BNBUSDT`.

Only Binance USDⓈ-M Futures public historical data is in scope. M3-B must use
official public Binance sources for 1H and 4H candles and, where required by
settlement, official public historical funding records for the same symbols.
No Binance API key, private API, account data, trading endpoint, proxy, VPN, or
alternate market-data provider is permitted.

The exact endpoint paths and current public API contract must be verified
against official Binance documentation during M3-B implementation. M3-A makes
no network request and does not select an implementation endpoint.

## Historical data integrity

Required historical data must be:

- chronological and exactly timeframe-aligned;
- duplicate-free and free of unexpected gaps;
- finite with valid OHLC values;
- fully closed, with no forming candle;
- free of silently sorted, gap-filled, synthetic, zero-substituted, or
  otherwise fabricated rows.

Bad, incomplete, malformed, or unverifiable required data is
`DATA_INCOMPLETE` and fails closed. Historical downloads and caches must not be
committed as large datasets to Git.

M3-B must produce an auditable manifest containing at least:

- provider and public source;
- symbol and timeframe;
- requested start and end;
- actual first and last candle;
- row count;
- data retrieval timestamp;
- deterministic checksum/hash where practical;
- funding source and equivalent coverage details when funding is required.

## Backtest clock and shared Strategy Engine

Evaluate baseline-001 at every fully closed 1H evaluation point. For signal
candle `C_t`:

```text
evaluationTime = C_t.closeTime
```

The historical input supplied to the existing M2 `evaluateStrategy(...)`
function must contain only candles satisfying:

```text
candle.closeTime <= evaluationTime
```

M2's `FUTURE_DATA` protection remains authoritative. M3 must slice or load
historical data as-of each evaluation time and must not recalculate strategy
rules in a separate backtest implementation. The same Strategy Engine is the
single source of truth for future realtime and backtest callers.

All Strategy Engine evaluations are retained for research statistics. Only
evaluations with `formalSignal == true` and `totalScore >= 70` enter the
hypothetical execution simulation. Below-70 candidates may be counted as
research evaluations but do not create simulated trades or contribute PnL/R
metrics.

## Entry model

The signal becomes known only after `C_t` is fully closed. The signal's
`entry_reference = Close_t` remains a research reference and is never treated
as a fill.

`bt-policy-001` enters at the open of the next fully closed 1H candle:

```text
rawEntryPrice = next 1H candle open
slippageBpsPerSide = 5
slippageRate = 0.0005
```

Adverse entry slippage is:

```text
LONG:  entryFill = rawEntryPrice * (1 + slippageRate)
SHORT: entryFill = rawEntryPrice * (1 - slippageRate)
```

The existing signal `stop_reference` and `take_profit_reference` remain fixed.
The next-open fill is valid only when it is strictly inside the frozen bracket:

```text
LONG:  stop_reference < entryFill < take_profit_reference
SHORT: take_profit_reference < entryFill < stop_reference
```

If the fill is at or beyond either boundary, do not open a simulated position.
Record `ENTRY_OUTSIDE_BRACKET`: formal signal yes, executed trade no. Missing or
invalid next-open data is `DATA_INCOMPLETE`; no fill may be fabricated.

## Fee model

The baseline research assumption is:

```text
feeBpsPerSide = 5
feeRate = 0.0005
```

Apply the fee to both entry and exit. The assumption must be stored in every
report and exposed as a reportable policy input. A zero-fee baseline report is
invalid.

## Exit and settlement model

After entry at the next 1H open, evaluate the remainder of that same candle,
then each following fully closed 1H candle.

For LONG:

- SL is touched when `Low <= stop_reference`.
- TP is touched when `High >= take_profit_reference`.

For SHORT:

- SL is touched when `High >= stop_reference`.
- TP is touched when `Low <= take_profit_reference`.

For `bt-policy-001`, if TP and SL are both touched in the same candle, `SL`
wins. OHLC data does not reveal intrabar order, so this is the conservative
historical assumption.

The maximum hold is 24 completed 1H candles after entry. The next-open candle
is held candle 1. If neither TP nor SL occurs within those 24 held candles,
settle as `TIME_EXIT` using the close of the 24th held candle.

Exit slippage is adverse and uses the same 5 bps assumption:

```text
LONG:  exitFill = rawExitPrice * (1 - slippageRate)
SHORT: exitFill = rawExitPrice * (1 + slippageRate)
```

For TP/SL, `rawExitPrice` is the corresponding frozen reference. For
`TIME_EXIT`, it is the 24th held candle close. Slippage is embedded in the
entry and exit fills and must not be charged a second time.

## Funding

The baseline includes actual historical funding events from the official
public source. Missing, incomplete, or invalid required funding data is
`DATA_INCOMPLETE`; it must not be replaced by zero or silently ignored.

Include an event when:

```text
entryTime < fundingTime <= exitTime
```

For one base-asset unit, using the event's official mark price when available:

```text
LONG funding PnL  = -fundingRate * markPrice
SHORT funding PnL = +fundingRate * markPrice
```

Positive funding therefore costs LONG and benefits SHORT; negative funding has
the opposite effect.

## R normalization

The signal's frozen `stopDistance` is canonical:

```text
1R = stopDistance
```

The next-open entry does not redefine baseline-001's stop or TP references.

```text
LONG priceR  = (exitFill - entryFill) / stopDistance
SHORT priceR = (entryFill - exitFill) / stopDistance

entryFee = entryFill * feeRate
exitFee  = exitFill * feeRate
feeR = (entryFee + exitFee) / stopDistance
fundingR = fundingPnL / stopDistance

netR = priceR - feeR + fundingR
```

Do not double-count slippage: it is already present in `entryFill` and
`exitFill`.

## Signal-level research boundary

M3 is a signal-level backtest, not a portfolio equity simulation. Do not add
account balance, leverage, position sizing, margin, liquidation, capital
allocation, or one-position-only rules. Repeated formal signals may overlap.

Every report must state:

```text
THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.
```

Report overlapping-signal rate and overlapping-signal statistics so results
cannot be interpreted as real account performance.

## Required report metrics

Report separately for `DEV`, `OOS`, and `COMBINED`:

- total evaluations;
- total formal signals;
- executed trades;
- `ENTRY_OUTSIDE_BRACKET` count;
- execution/fill rate;
- TP, SL, and TIME_EXIT counts;
- gross R and net R;
- win rate, loss rate, breakeven count;
- profit factor and expectancy R;
- median R, average win R, average loss R;
- best trade R and worst trade R;
- cumulative fee R and cumulative funding R;
- `signalSequenceMaxDrawdownR`;
- breakdowns by symbol, LONG/SHORT, grade A/B/C, BTC regime, and month;
- overlapping-signal rate;
- top symbol share of positive net R;
- largest single-trade share of positive net R.

Win is `netR > 0`, loss is `netR < 0`, and breakeven is `netR == 0`.
Expectancy is `mean(netR)`. Profit factor is:

```text
sum(all positive netR) / abs(sum(all negative netR))
```

Never serialize JavaScript `Infinity`. If positive trades exist and losing R
is zero, use `profitFactor = null` and
`profitFactorStatus = NO_LOSSES`. If there are no executed trades, use
`profitFactor = null` and `profitFactorStatus = NO_TRADES`.

Calculate drawdown only from the deterministic signal sequence ordered by:

1. signal/evaluation time ascending;
2. fixed symbol order: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT.

Label it `signalSequenceMaxDrawdownR`; never call it portfolio drawdown.

## Research acceptance gate

This is a research acceptance gate, not a promise of future profit.

Minimum sample:

- COMBINED executed trades >= 100;
- OOS executed trades >= 30.

Below either minimum, report `INSUFFICIENT_SAMPLE`, never PASS.

Baseline-001 gate:

| Set | Requirements |
| --- | --- |
| COMBINED | `netR > 0`, `expectancyR > 0`, `profitFactor >= 1.25` |
| OOS | `netR > 0`, `expectancyR > 0`, `profitFactor >= 1.10` |

Concentration requirements for the applicable report are:

- top symbol share of positive net R <= 60%;
- largest single-trade share of positive net R <= 20%.

If any requirement fails, baseline-001 is not accepted as statistically
validated. No automatic tuning or OOS-driven threshold changes are allowed.

## M3 sub-gates and stop boundary

### M3-A — Backtest Specification Freeze

Documentation only. This phase freezes this protocol and does not fetch data,
implement a loader, call the Strategy Engine, write persistence, or produce a
historical result.

### M3-B — Historical Loader + Deterministic Backtest Runner

Future implementation only. It must load auditable public data, build as-of
inputs, call the existing `evaluateStrategy(...)`, apply `bt-policy-001`, and
produce deterministic DEV/OOS/COMBINED reports. It must not implement a second
strategy or optimization system.

### M3-C — Baseline Historical Run + Evidence Review

Future real historical run and acceptance decision. Only after the baseline
results are known may separate robustness research such as Monte Carlo or
parameter sensitivity be considered.

M3-A does not enter M3-B or M3-C and does not enter M4.

## M6 boundary

The SL-first same-candle rule and 24-bar TIME_EXIT close in this document belong
only to `bt-policy-001` historical settlement. They do not settle the M6
production forward-tracking policy. Forward-tracking invalidation ordering
remains `DEFERRED_TO_M6`, and no M6 decision is inferred from this document.
