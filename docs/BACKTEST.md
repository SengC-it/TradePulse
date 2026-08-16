# TradePulse Backtest Specification

Status: M3-B implementation / Draft PR; M3-C historical study has not been run.

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
must not enter performance statistics. The frozen indicator minimums remain
55 fully closed 1H candles and 205 fully closed 4H candles. They are not the
historical loader lookback. To satisfy the realtime-equivalent StrategyInput
contract at the first hourly evaluation, the loader requests at least
`periodStart - 250 * 1H` and `periodStart - 250 * 4H` respectively. The
explicit policy fields are `indicatorWarmupMinimum1h = 55`,
`indicatorWarmupMinimum4h = 205`, `strategyWindowCandles = 250`, and
`historicalLookback1h = historicalLookback4h = 250`. If an exact 250/250
window is unavailable, the run fails closed as incomplete.

The OOS period is locked before any baseline results are inspected. OOS data
must not be used to tune, select, or alter baseline-001 parameters.

## Period membership and settlement-tail policy

Period membership is determined only by the signal/evaluation time:

```text
signalTime = evaluationTime = C_t.closeTime
```

A signal belongs to DEV only when `signalTime` is inside the frozen DEV range,
and belongs to OOS only when `signalTime` is inside the frozen OOS range.
Candles after a period end must never create evaluations or signals for the
prior period.

### DEV settlement boundary

OOS candles must never be used to settle a DEV position. A DEV formal signal is
executable only when its maximum possible `bt-policy-001` settlement horizon
can be completed using fully closed 1H candles whose `closeTime` remains inside
the DEV period. The horizon contains exactly 24 held 1H candles total: held
candle #1 is the next 1H candle whose open is used for `rawEntryPrice`, and
held candles #2 through #24 are the following 23 fully closed 1H candles. The
closeTime of held candle #24 is the final required settlement boundary.

When the closeTime of required held candle #24 would be after the frozen DEV
end, record:

```text
PERIOD_END_CENSORED
```

The signal remains in the formal-signal count, but is not an executed trade and
contributes no PnL or R. Report it separately. It is not
`ENTRY_OUTSIDE_BRACKET` and must not be counted in the execution denominator.

### OOS settlement-only tail

An OOS signal may use a settlement-only tail after the frozen OOS end. The
loader may retrieve enough fully closed 1H candles and required official public
funding records to settle positions opened by OOS signals. For the last eligible
OOS signal, the settlement-only tail contains at most 24 held 1H candles:
held candle #1 is the next-open entry candle and held candle #24 is the last
required candle. The tail also includes required funding records through the
resulting settlement boundary. There is no held candle #25 in `bt-policy-001`.

Tail data may settle existing OOS signals and provide funding for those
positions, but it must never create a Strategy Engine evaluation, formal
signal, or change OOS membership. The manifest must explicitly identify these
rows and funding records as `settlementOnly` post-OOS data. If required tail
data is incomplete, the run is `DATA_INCOMPLETE`; M3-C cannot claim a complete
OOS baseline result.

## Historical universe and data source

The universe is exactly:

`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, and `BNBUSDT`.

Only Binance USDⓈ-M Futures public historical data is in scope. M3-B must use
official public Binance sources for 1H and 4H candles and, where required by
settlement, official public historical funding records for the same symbols.
No Binance API key, private API, account data, trading endpoint, proxy, VPN, or
alternate market-data provider is permitted.

The M3-B adapter uses only the verified official public endpoints below. No
credential is required and no private/trading endpoint is allowed.

## M3-B verified historical transport contract

The implementation was checked against the [official Binance USDⓈ-M Futures
REST documentation](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data#get-funding-rate-history).

- Klines use `GET https://fapi.binance.com/fapi/v1/klines` with `symbol`,
  `interval`, inclusive `startTime`/`endTime`, and `limit` up to 1500. The
  twelve-field response is parsed into the normalized `Candle` model; rows
  are never sorted, filled, or synthesized.
- Funding uses `GET https://fapi.binance.com/fapi/v1/fundingRate` with
  `symbol`, inclusive `startTime`/`endTime`, and `limit` up to 1000. The
  documented response includes `fundingRate`, `fundingTime`, and the official
  `markPrice`. A missing or invalid `markPrice` is `DATA_INCOMPLETE`; no
  candle-price fallback is permitted.
- Kline pagination advances only to the next expected open time. Funding
  pagination advances strictly after the last accepted `fundingTime`. A
  repeated page, gap, duplicate, malformed row, or non-progressing cursor
  fails closed.
- Each loaded dataset records provider, endpoint, requested and actual
  ranges, row count, retrieval time, settlement-only classification, and a
  SHA-256 checksum over canonical normalized rows. Retrieval time is excluded
  from the checksum.

The official contract confirms that funding mark price is available. If a
future upstream contract removes it, the loader must stop with
`MARK_PRICE_UNAVAILABLE`/`DATA_INCOMPLETE`; it must not substitute another
price or provider.

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

For formal Binance historical loading, `BinancePublicClient.getServerTime()`
is fetched once per study load. Every supplied historical candle must satisfy
`candle.closeTime < binanceServerTime`; a candle at or after that authoritative
time is `DATA_INCOMPLETE`. The loader never uses local `Date.now()` as market
time authority and never accepts a forming candle's partial High/Low. The
funding base range ends at the exact frozen period end, including its final
millisecond. For OOS and COMBINED, settlement-only funding starts at the next
millisecond and covers the held #24 settlement boundary; funding coverage is
event-timestamp based and does not assume an 8-hour cadence.

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

For every evaluation, the backtest adapter passes exactly 250 latest fully
closed 1H candles and exactly 250 latest fully closed 4H candles for every
approved symbol. Each supplied candle satisfies `closeTime <= evaluationTime`.
The adapter never passes full history, a 205/55 warm-up slice, 251 candles, or
an expanding window to `evaluateStrategy(...)`; the 205 4H and 55 1H values
remain minimum historical warm-up availability requirements only. Missing an
exact 250/250 window is `DATA_INCOMPLETE`.

Historical series are validated once and indexed by symbol/timeframe. Each
evaluation uses a binary search for the right-most `closeTime <= evaluationTime`
and slices exactly `[index - 249, index]`. The shared 1H evaluation timeline is
alignment-checked once across all symbols. The runner therefore never performs
a full-history `filter`/cross-symbol `some` scan for every hourly evaluation,
while retaining the same no-future, no-gap, deterministic contract.

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

There are exactly 24 held 1H candles total. The next-open entry candle is held
candle #1; held candles #2 through #24 are the following 23 fully closed 1H
candles. If neither TP nor SL occurs within held candles #1 through #24,
settle as `TIME_EXIT` at the closeTime of held candle #24. There is no held
candle #25 in `bt-policy-001`.

Exit slippage is adverse and uses the same 5 bps assumption:

```text
LONG:  exitFill = rawExitPrice * (1 - slippageRate)
SHORT: exitFill = rawExitPrice * (1 + slippageRate)
```

For TP/SL, `rawExitPrice` is the corresponding frozen reference. For
`TIME_EXIT`, it is the 24th held candle close. Slippage is embedded in the
entry and exit fills and must not be charged a second time.

## Event times and TP/SL audit convention

The backtest records these deterministic times:

```text
signalTime = C_t.closeTime
entryTime  = openTime of the next 1H candle used for rawEntryPrice
```

For `TIME_EXIT`:

```text
exitTime = closeTime of held candle #24
```

For TP/SL, `exitCandle` is the first held 1H candle whose OHLC satisfies the
frozen TP/SL resolution. Because OHLC does not reveal the intrabar trigger
timestamp, use its close only for deterministic report and audit ordering:

```text
exitTime = exitCandle.closeTime
```

This audit `exitTime` must not be treated as proof that a TP/SL trigger occurred
at the candle close. Funding uses the separate timestamp policy below and must
not invent intrabar event ordering from this report boundary.

## Funding

The baseline includes actual historical funding events from the official
public source. Every required record must contain:

- finite `fundingRate`;
- valid `fundingTime`;
- finite, positive official `markPrice`.

Missing, incomplete, non-finite, or invalid required funding data is
`DATA_INCOMPLETE`. A missing mark price must not use a candle close, candle
open, average price, zero, or any other fallback.

Funding timestamps are expected to be exchange funding timestamps. A funding
event can be charged only when the position was already open:

```text
entryTime < fundingTime
```

Therefore `fundingTime == entryTime` is always excluded; no real exchange
priority is inferred at an identical entry timestamp.

For a TP/SL exit, include an event at the exit candle boundary only when the
ordering is deterministic:

- if `fundingTime == exitCandle.openTime` and `entryTime < fundingTime`,
  include it because the position existed before the exit candle began;
- if `exitCandle.openTime < fundingTime < exitCandle.closeTime`, mark the
  affected trade and baseline run `SETTLEMENT_AMBIGUOUS` because OHLC cannot
  establish whether funding or the intrabar TP/SL happened first;
- do not include an event merely because the audit `exitTime` equals
  `exitCandle.closeTime`; without an independent ordering, that boundary is
  also `SETTLEMENT_AMBIGUOUS` rather than an invented intrabar sequence.

Funding events after entry and before the exit candle are included when their
ordering is unambiguous. For `TIME_EXIT`, include an event when:

```text
entryTime < fundingTime <= exitTime
```

because TIME_EXIT occurs deterministically at the held candle close.

For one base-asset unit, using the event's official mark price:

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
- `PERIOD_END_CENSORED` count;
- `SETTLEMENT_AMBIGUOUS` count/status;
- execution/fill rate;
- TP, SL, and TIME_EXIT counts;
- gross R and net R;
- win rate, loss rate, breakeven count;
- breakeven rate;
- profit factor and expectancy R;
- median R, average win R, average loss R;
- best trade R and worst trade R;
- cumulative fee R and cumulative funding R;
- `signalSequenceMaxDrawdownR`;
- breakdowns by symbol, LONG/SHORT, grade A/B/C, BTC regime, and month;
- overlapping-signal rate;
- top symbol share of positive net R;
- largest single-trade share of positive net R.

Performance metrics use executed trades only. `ENTRY_OUTSIDE_BRACKET` and
`PERIOD_END_CENSORED` remain formal signals, are not executed trades, and
contribute no PnL or R. `DATA_INCOMPLETE` or `SETTLEMENT_AMBIGUOUS` affecting
the required baseline run makes that run incomplete; those outcomes must not
be silently discarded.

Define the execution denominator and fill rate exactly as:

```text
eligibleExecutionSignals = formalSignals - PERIOD_END_CENSORED
executionFillRate = executedTrades / eligibleExecutionSignals
```

`ENTRY_OUTSIDE_BRACKET` remains in `eligibleExecutionSignals` because it is a
formal signal that failed the frozen execution model. If
`eligibleExecutionSignals == 0`, `executionFillRate = null`.

For each executed trade:

```text
grossR = priceR
```

Aggregate `grossR` is `sum(priceR)`. It includes adverse slippage already
embedded in `entryFill` and `exitFill`, but excludes fees and funding. `netR`
remains:

```text
netR = priceR - feeR + fundingR
```

Win is `netR > 0`, loss is `netR < 0`, and breakeven is `netR == 0`.
Expectancy is `mean(netR)`. With `executedTrades > 0`:

```text
winRate        = wins / executedTrades
lossRate       = losses / executedTrades
breakevenRate  = breakevens / executedTrades
```

When `executedTrades == 0`, all three rates are `null`.

Profit factor uses:

```text
positiveR = sum(netR where netR > 0)
negativeR = abs(sum(netR where netR < 0))
```

If `executedTrades == 0`, use `profitFactor = null` and
`profitFactorStatus = NO_TRADES`. Otherwise, if `negativeR == 0`—including an
all-breakeven executed set—use `profitFactor = null` and
`profitFactorStatus = NO_LOSSES`. Otherwise:

```text
profitFactor = positiveR / negativeR
profitFactorStatus = NORMAL
```

Never serialize JavaScript `Infinity` or `NaN`.

Calculate `signalSequenceMaxDrawdownR` from executed trades ordered by:

1. `signalTime` ascending;
2. fixed symbol order: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT;
3. `LONG` before `SHORT` if the same symbol and signal time contain more than
   one direction.

Define:

```text
equity_0 = 0 R
equity_n = cumulative sum of netR through trade n
runningPeak_n = max(0, equity_1, ..., equity_n)
drawdown_n = runningPeak_n - equity_n
signalSequenceMaxDrawdownR = max(drawdown_n)
```

This is a signal-sequence drawdown, never a portfolio drawdown.

Define each executed trade's active interval as the closed interval
`[entryTime, exitTime]`. Two trades overlap when those intervals have a
non-empty time intersection. An executed trade is an overlapping trade if it
overlaps at least one other executed trade.

```text
overlappingSignalRate =
  overlapping executed trades / executedTrades
```

If `executedTrades == 0`, `overlappingSignalRate = null`. Report the overlap
count as well as the rate; pair-count or combination-count is not the primary
overlap rate.

For concentration, define:

```text
totalPositiveNetR = sum(max(netR, 0)) across executed trades
symbolPositiveNetR = sum(max(netR, 0)) for each symbol
topSymbolShareOfPositiveNetR = max(symbolPositiveNetR) / totalPositiveNetR
largestSingleTradeShareOfPositiveNetR =
  max(max(netR, 0)) / totalPositiveNetR
```

Do not net negative trades against a symbol's positive contribution. If
`totalPositiveNetR == 0`, both concentration metrics are `null` and
`concentrationStatus = NO_POSITIVE_R`.

Month breakdowns use the UTC calendar month of `signalTime`, never entry or
exit month.

## Research acceptance gate

This is a research acceptance gate, not a promise of future profit.

Minimum sample:

- COMBINED executed trades >= 100;
- OOS executed trades >= 30.

Below either minimum, report `INSUFFICIENT_SAMPLE`, never PASS.

DEV is descriptive/in-sample evidence only. The formal baseline acceptance
gate applies to COMBINED and OOS.

Baseline-001 gate:

| Set | Requirements |
| --- | --- |
| COMBINED | `netR > 0`, `expectancyR > 0`, `profitFactor >= 1.25` |
| OOS | `netR > 0`, `expectancyR > 0`, `profitFactor >= 1.10` |

Concentration must pass separately for both COMBINED and OOS:

- top symbol share of positive net R <= 60%;
- largest single-trade share of positive net R <= 20%.

Any null or undefined concentration metric at an acceptance gate is FAIL, not
PASS. Any `DATA_INCOMPLETE` or `SETTLEMENT_AMBIGUOUS` affecting a required
baseline run produces `INCOMPLETE`, not PASS. If any requirement fails,
baseline-001 is not accepted as statistically validated. No automatic tuning
or OOS-driven threshold changes are allowed.

The report's `selectedPeriodAcceptance` (also retained as the compatibility
field `acceptance`) describes only the requested report period. The formal
`overallAcceptance` is the decision used by `report.status`: for OOS it equals
OOS acceptance; for COMBINED it requires both COMBINED and OOS acceptance with
precedence `INCOMPLETE > INSUFFICIENT_SAMPLE > FAIL > PASS`. DEV remains
`DESCRIPTIVE` and is not an acceptance gate. `acceptanceByPeriod` retains the
individual diagnostics so a COMBINED report cannot show PASS while OOS fails.

## M3 sub-gates and stop boundary

### M3-A — Backtest Specification Freeze

Documentation only. This phase freezes this protocol and does not fetch data,
implement a loader, call the Strategy Engine, write persistence, or produce a
historical result.

### M3-B — Historical Loader + Deterministic Backtest Runner

Implemented in the M3-B Draft PR. The loader, validation, pagination,
required manifest coverage/checksum audit, indexed as-of window builder,
shared-Strategy-Engine runner,
bt-policy-001 settlement, funding, R metrics, deterministic report serializer,
acceptance evaluator, and `npm run backtest:run -- --period DEV|OOS|COMBINED`
CLI are present. CI uses mocked transport only; the formal M3-C historical
study is not run as part of M3-B.

### M3-C — Baseline Historical Run + Evidence Review

Future real historical run and acceptance decision. Only after the baseline
results are known may separate robustness research such as Monte Carlo or
parameter sensitivity be considered.

M3-B stops before M3-C and does not enter M4.

## M6 boundary

The SL-first same-candle rule and 24-bar TIME_EXIT close in this document belong
only to `bt-policy-001` historical settlement. They do not settle the M6
production forward-tracking policy. Forward-tracking invalidation ordering
remains `DEFERRED_TO_M6`, and no M6 decision is inferred from this document.
