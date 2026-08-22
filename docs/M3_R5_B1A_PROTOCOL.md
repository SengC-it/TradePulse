# M3-R5-B.1A — Round-005 protocol and H17 qualification freeze

This document freezes the pre-performance protocol for
`baseline-002-research-round-005`. It is a protocol/tooling freeze only.
It does not freeze `baseline-002`, a final candidate registry, a Gate SHA, a
Plan SHA, or any performance result.

## Frozen study boundary

- `researchRoundId`: `baseline-002-research-round-005`
- data classification: `RESEARCH_AVAILABLE_SEEN_DATA`
- start: `2023-01-01T00:00:00.000Z`
- end: `2026-08-15T23:59:59.999Z`
- symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- folds: the existing frozen F1–F6 folds
- policy: `bt-policy-003`, including its conservative fees, adverse
  slippage, funding settlement, SL-first ordering, and mark-price fallback

Every candidate is standalone. A signal identity is exactly
`symbol|direction|signalTime`. Features must be knowable at `signalTime`;
the future entry candle is never used to create a signal. There are no
combinations, parameter sweeps, optimizers, random search, or post-result
candidate choices. Each hypothesis has exactly one provisional variant.

## Common entry and settlement contract

For every candidate, `signalTime` is the close time of the decision candle or
the canonical funding time defined below. Entry is the first 1H candle whose
`openTime` is strictly greater than `signalTime`; its open is the raw entry
reference and the actual fill is governed by `bt-policy-003`.

Stops use the decision-time ATR and the actual entry fill. Take profit is
exactly `3R` unless H16's fixed decision-time EMA20 target is specified.
Settlement is SL first, then TP, otherwise TIME_EXIT at the close of the
last held candle. No candidate uses a trailing exit or a recalculated target.

## H15 — `R5-H15-HTF-TREND`

Hypothesis: `H15_HTF_LOW_FREQUENCY_TREND`; family:
`SIGNAL_TIMEFRAME_REDESIGN`.

H15 creates an independent 4H signal and does not require a baseline-001
formal signal. The current fully closed 4H candle is the decision candle and
its close is `signalTime`. EMA20, EMA50, and Wilder ATR14 are calculated on
closed 4H candles. The prior breakout range is exactly the 20 fully closed 4H
candles immediately before the current candle; the current candle is
excluded.

- LONG iff `EMA20[current] > EMA50[current]` and
  `current.close > max(high of prior 20)`.
- SHORT iff `EMA20[current] < EMA50[current]` and
  `current.close < min(low of prior 20)`.
- All comparisons are strict.
- No RSI, volume, BTC regime, score, baseline signal, buffer, secondary
  confirmation, or cooldown is used.
- Stop is `2 ATR14`; take profit is exactly `3R`.
- The maximum holding period is 48 fully closed 1H candles.
- H15 does not reuse the H13 exit overlay.

## H16 — `R5-H16-NEUTRAL-MEAN-REVERSION`

Hypothesis: `H16_NEUTRAL_REGIME_MEAN_REVERSION`; family:
`EDGE_FAMILY_REDESIGN`.

The most recent fully closed legal 4H candle at the 1H signal time supplies
the context. Neutral is exactly:

`abs(EMA20_4H - EMA50_4H) / ATR14_4H <= 0.50`, with finite `ATR14_4H > 0`.

The current fully closed 1H candle supplies EMA20, Wilder ATR14, and Wilder
RSI14 values:

- LONG iff neutral and
  `current.close <= EMA20_1H - 1.50 * ATR14_1H` and `RSI14 <= 30`.
- SHORT iff neutral and
  `current.close >= EMA20_1H + 1.50 * ATR14_1H` and `RSI14 >= 70`.

The target is the fixed decision-time `EMA20_1H`; it is never recalculated.
The stop is `1.50 ATR14`. If a LONG target is `<= entryFill`, or a SHORT
target is `>= entryFill`, the signal remains auditable but execution is
ineligible. The maximum holding period is 12 fully closed 1H candles.

## H17 — `R5-H17-FUNDING-REVERSAL`

Hypothesis: `H17_FUNDING_CROWDING_REVERSAL`; family:
`DERIVATIVES_POSITIONING_ALPHA`.

Decision-time funding slots are exactly the UTC 8-hour grid
`00:00`, `08:00`, and `16:00`, from the frozen research start through the
last canonical slot at or before the frozen research end. Noncanonical
funding records may remain available for settlement economics, but they
never create H17 alpha decisions.

H17 is conditionally eligible. Before it can enter any performance run, an
authoritative qualification must prove, for every one of the five symbols:

- every expected canonical slot is present;
- zero canonical slots are missing and zero timestamps are duplicated;
- source records are strictly chronological;
- timestamps, symbols, and funding rates are valid;
- retrieval is complete, including pagination;
- the official funding manifest has the exact requested range and a valid
  SHA-256 provenance value.

The qualification report contains only symbol, requested range, expected and
observed slot counts, missing and duplicate lists/counts, extra noncanonical
count, first/last observed timestamp, pagination and manifest provenance,
and qualification status. It must not contain funding-rate min/max/mean,
median, quantiles, positive/negative counts, threshold-hit counts, H17
signal counts, outcomes, or performance metrics.

If retrieval aborts before a complete deterministic qualification, the
classification is `RETRIEVAL_ABORT`; no qualification artifacts are
published. If retrieval completes but any required canonical data is
missing/invalid, the classification is `DATA_NOT_AVAILABLE`; H17 is excluded
from performance. Only complete coverage yields `COMPLETE` and
`H17_DATA_QUALIFICATION=PASS`.

After, and only after, qualification PASS:

- SHORT iff `fundingRate >= +0.00020`;
- LONG iff `fundingRate <= -0.00020`;
- otherwise no H17 signal.

The thresholds are exact and are not swept. `signalTime` is the canonical
funding time and the exact canonical record is used. ATR14 is calculated from
the last fully closed 1H candle strictly preceding `fundingTime`. Entry is
the first 1H open strictly after funding time; for an aligned slot this is
one hour later, not the candle opening at the funding timestamp. Stop is
`1.50 ATR14`, take profit is `3R`, and the maximum holding period is 24
fully closed 1H candles. The triggering funding event is not charged because
the position is not open at `signalTime`; all other open-position funding
events use the unchanged `bt-policy-003` economics.

H17 does not use BTC regime, score, price trend, or any combination.

## H18 — `R5-H18-COMPRESSION-EXPANSION`

Hypothesis: `H18_VOLATILITY_COMPRESSION_EXPANSION`; family:
`VOLATILITY_STATE_ENTRY`.

H18 is a new 1H signal source and does not require a baseline-001 formal
signal. Calculate Wilder ATR14 using OHLC only. The six fully closed 1H
candles immediately before the current candle must each satisfy:

`trueRange[candle] <= 0.75 * ATR14[candle]`.

The current fully closed candle must satisfy:

`trueRange[current] >= 1.50 * ATR14[previous closed 1H]`.

The direction range is the 12 fully closed 1H candles immediately before the
current candle; the current candle is excluded:

- LONG iff compression and expansion pass and
  `current.close > max(high of prior 12)`.
- SHORT iff compression and expansion pass and
  `current.close < min(low of prior 12)`.

Comparisons are strict where stated. H18 does not use H9/H10, volume, ATR
percentiles, or a grid. Entry is next-open strict, stop is `1.50 ATR14`, TP
is `3R`, and the maximum holding period is 24 fully closed 1H candles.

## Complexity and future Gate inheritance

The provisional complexity tuples are frozen exactly as follows:

| Candidate | newRules | newTunableThresholds | modifiedBaselineRules | mechanismFamiliesUsed |
| --- | ---: | ---: | ---: | ---: |
| R5-H15-HTF-TREND | 3 | 3 | 3 | 1 |
| R5-H16-NEUTRAL-MEAN-REVERSION | 4 | 5 | 4 | 1 |
| R5-H17-FUNDING-REVERSAL | 3 | 3 | 3 | 1 |
| R5-H18-COMPRESSION-EXPANSION | 4 | 4 | 3 | 1 |

B.1B must inherit Round-004 gates without weakening:
`minimumAggregateImprovement`, `minimumImprovedValidationFolds`,
`catastrophicFoldLimit`, `minimumNetExpectancy`, `minimumProfitFactor`,
`maximumSymbolConcentration`, `maximumSingleTradeConcentration`,
`maximumFeeBurdenRatio`, `minimumFormalSignals`, and
`minimumExecutedTrades`. For H15–H18,
`requiredRedundancyImprovement=NOT_APPLICABLE`, leaving exactly 10
applicable hard gates. No final Round-005 Gate JSON/SHA or Plan SHA is
created in B.1A; the final registry is conditional on H17 qualification.

## Qualification CLI and publication contract

The future qualification command is:

```text
npm run research:m3r5:h17-qualify -- \
  --confirm-authoritative-qualification \
  --source-sha <EXACT_HEAD_SHA> \
  --round baseline-002-research-round-005 \
  --start-time <2023-01-01T00:00:00.000Z_AS_EPOCH_MS> \
  --end-time <2026-08-15T23:59:59.999Z_AS_EPOCH_MS>
```

Before network access it requires exact HEAD/source SHA, a clean worktree,
the exact round and range, and absent outputs. Reserved outputs are
`docs/evidence/M3_R5_H17_DATA_QUALIFICATION.json` and
`docs/M3_R5_H17_DATA_QUALIFICATION.md`. Destination-filesystem staging is
used; Markdown is published first and machine JSON is published last as the
commit marker. Any failed publication rolls back every destination created by
that invocation and removes staging, preserving the original error. Existing
outputs are rejected before staging. B.1A creates neither output.

## Lock and scope boundary

The future performance lock is
`FIRST_M3_R5_PERFORMANCE_RESULT_GENERATED`. Before that lock, a result-affecting
protocol change requires a newly reviewed protocol/Plan SHA. After the lock,
any change to candidate formulas, H17 thresholds or schedule, entry/stop/TP/
exit/holding/cost/folds/sample floors, complexity, availability, or decision
semantics requires `ROUND_005_INVALIDATION_REQUIRED`; it cannot be patched and
rerun in place.

B.1A performs no Binance request, historical load, backtest, CONTROL,
performance run, evidence generation, Gate/Plan freeze, candidate selection,
baseline-002 freeze, M3-J, or M4. `baseline-002` remains `NOT_FROZEN`, M3-J
remains `BLOCKED`, and M4 remains `NOT_STARTED`.
