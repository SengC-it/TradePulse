# baseline-002 Research Round-004 Machine Protocol

Status: **M3-R4-B UNDER REVIEW / PRE-PERFORMANCE**

This document records the machine-readable protocol frozen by M3-R4-B. It is
not a historical result and does not authorize a CONTROL capture, a backtest,
or candidate performance generation.

## Provenance and status

- `researchRoundId`: `baseline-002-research-round-004`
- authoritative source SHA: `1bab6066cd4e9933c3d50ab29a38e9ad0792e5c8`
- R4-A diagnosis raw SHA-256:
  `7f01d5bf3e38246910af6a0df90e2f68f6b1bf40cadb0a36fcfd6095ba180318`
- R4-A research protocol raw SHA-256:
  `6b36aa7ef4ec273182f4ff2a9873f95f69f1409ec4474055610dddfbf350e746`
- Gate record SHA-256:
  `c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54`
- Plan SHA-256:
  `f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981`
- `performanceStatus`: `NOT_GENERATED`
- `performanceAuthorization`: `NONE_IN_M3_R4_B`
- `baseline-002`: **NOT FROZEN**
- M3-J: **BLOCKED**
- M4: **NOT STARTED**

The hashes are computed over stable, sorted-key JSON records without embedding
the corresponding hash inside the hashed object. Validators recompute the
hash and fail closed on any mismatch.

## Frozen CONTROL

The one CONTROL is `R4-CONTROL-BASELINE-001` and uses:

- `strategyVersion = baseline-001`;
- `backtestPolicyVersion = bt-policy-003`;
- report schema `m3-b-report-004`;
- formal signal predicate `candidate.formalSignal === true AND
  candidate.totalScore >= 70`;
- the current fully closed 1H signal candle for decision time;
- next 1H open for the inherited entry;
- unchanged stop, exact 2R TP, fees, slippage, funding, SL-first ordering,
  and `bt-policy-003` settlement economics.

M3-R4-B does not implement or invoke this CONTROL. The contract is recorded so
that a later, separately authorized performance stage cannot reinterpret it.

## Candidate registry

Exactly four standalone candidates exist, in this order:

| Candidate | Hypothesis | Mechanism family | Complexity `(newRules, newTunableThresholds, modifiedBaselineRules, mechanismFamiliesUsed)` |
| --- | --- | --- | --- |
| `R4-H11-BREAKOUT-RETEST` | `H11_BREAKOUT_RETEST_ENTRY` | `ENTRY_TIMING_REDESIGN` | `(3, 1, 2, 1)` |
| `R4-H12-PULLBACK-RECLAIM` | `H12_PULLBACK_RECLAIM_ENTRY` | `ENTRY_PATTERN_REDESIGN` | `(3, 0, 1, 1)` |
| `R4-H13-ADAPTIVE-TREND-EXIT` | `H13_ADAPTIVE_TREND_EXIT` | `EXIT_ARCHITECTURE_REDESIGN` | `(2, 1, 2, 1)` |
| `R4-H14-RELATIVE-STRENGTH` | `H14_RELATIVE_STRENGTH_CONTEXT` | `CROSS_ASSET_CONTEXT` | `(1, 2, 1, 1)` |

There are no combinations, fifth candidate, parameter sweep, grid search,
optimizer, or outcome-dependent candidate definition.

## Machine gate registry

The SHA-covered `hardGateIdentities` registry contains exactly these 11
identities, in order:

```text
minimumAggregateImprovement
minimumImprovedValidationFolds
catastrophicFoldLimit
minimumNetExpectancy
minimumProfitFactor
maximumSymbolConcentration
maximumSingleTradeConcentration
maximumFeeBurdenRatio
requiredRedundancyImprovement
minimumFormalSignals
minimumExecutedTrades
```

`requiredRedundancyImprovement` remains in the registry, but all four
Round-004 candidates serialize `redundancyApplicability = NOT_APPLICABLE`.
The other 10 identities are applicable; `NOT_APPLICABLE` is excluded from the
conjunction and is never counted as PASS.

## Decision-time contract

Candidate formation may use only candles with `closeTime <= signalTime`.
`signalTime` is the candidate's defined confirmation close for H11/H12 and
the original baseline formal signal time for H13/H14. The following are
settlement or outcome data and are forbidden in a decision predicate:

- next-open entry candle;
- held candles;
- future funding or mark-price records;
- future EMA or other future indicators;
- returns, PF, expectancy, or any realized result;
- a regime value derived after `signalTime`.

Settlement is a separate stage. H11, H12, and H14 decision snapshots contain
no future outcome values. Identity is exactly `symbol|direction|signalTime`,
ordered by signal time ascending, frozen symbol order, then LONG before SHORT.

## H11 — breakout retest entry

At closed 1H candle `t`, search origin ages 1, 2, 3, and 4 bars, newest
first. The frozen selection rule is:

```text
FIRST ORIGIN IN AGE 1→4 ORDER THAT PASSES THE COMPLETE ORIGIN+INVALIDATION+RETEST+RISK PIPELINE.
```

For each origin, reconstruct the exact baseline evaluation from data closed
by the origin time, require a formal same-symbol/same-direction score of at
least 70, compute the exact three-candle pre-origin breakout, require a
complete chronological closed-1H sequence from the first candle after origin
through the current candle inclusive, reject every stop touch in that
sequence, then apply current retest/reclaim and risk geometry. A missing,
gapped, duplicated, or sequence-not-ending-at-current candle fails that origin
closed; no origin older than four bars is considered.

The breakout level is the maximum of the three fully closed candles before the
origin for LONG, or the minimum for SHORT. From the first candle after origin
through confirmation, a stop touch invalidates the origin (`low <= stop` for
LONG, `high >= stop` for SHORT). The current retest requires a touch and strict
close reclaim: `low <= level AND close > level` for LONG, mirrored for SHORT.
No ATR buffer, volume, current score, current RSI, or new regime filter is
added. Entry reference is the confirmation close; current ATR14 must be
positive; `stop_atr` is inclusive from 0.8 to 3.0 and TP is exactly 2R.

## H12 — pullback reclaim entry

The baseline 4H regime, direction, BTC blocking, and RSI ranges remain intact.
The baseline three-bar breakout, score threshold, volume, and H6-H10 filters
are not required. With `p = t - 1`, LONG requires
`(p.low <= EMA20[p] OR p.low <= EMA50[p]) AND p.close <= EMA20[p]`, and the
current close must be strictly above EMA20 and `p.high`. SHORT is the exact
mirror. The stop is the prior-five low minimum minus `0.2 * ATR14` for LONG,
or prior-five high maximum plus `0.2 * ATR14` for SHORT. ATR14 must be positive,
`stop_atr` is inclusive from 0.8 to 3.0, and TP remains exactly 2R.
The helper requires `current.closeTime == signalTime` and a timestamped
previous candle with `previous.closeTime == current.closeTime - 1H`; any
other previous candle or future current candle is invalid.

## H13 — adaptive trend exit

H13 uses the exact baseline-001 formal CONTROL population and preserves its
signal, entry, stop, score, grade, next-open, and slippage fields. Its overlay
version is `r4-h13-exit-001`. It removes the fixed TP bracket from the exit
decision, but does not change `bt-policy-003`; the protective stop remains
mandatory.

There are at most 48 fully closed held 1H candles. For held candles 1–47,
check the protective stop first. If untouched, LONG close below EMA20 or SHORT
close above EMA20 schedules a TREND_EXIT at the next candle open with existing
adverse exit slippage. If neither occurs, continue. At held candle 48, check
the stop first; otherwise close with TIME_EXIT. No EMA-triggered next-open exit
is created after held candle 48. Funding uses the existing policy-003 clock
exit boundary, rate/mark fallback, sign, and audit semantics.
The trend trigger on held candle `n` settles at held candle `n+1` OPEN, with
`rawExitPrice = held[n+1].open` and `heldCandleNumber = n+1`; held candle 48
cannot schedule another trend exit. The original baseline stop distance
remains the R denominator, and the global `bt-policy-003` held-candle
constant remains 24; H13's 48-candle overlay is local to H13.

## H14 — relative-strength context

H14 preserves baseline entry, stop, TP, settlement, and economics. At each
baseline formal signal time, compute for all five symbols:

```text
momentum24h = close(symbol, t) / close(symbol, t - 24 closed 1H bars) - 1
```

Both closes must be available, finite, and positive. Rank all five descending,
using `BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT` for ties. LONG requires
rank 1–2, SHORT requires rank 4–5, and rank 3 is blocked. Missing data is
`FAIL_CLOSED_DATA_INCOMPLETE`; it is not silently dropped. Because outcomes
are unchanged, a later performance implementation must reuse the same-run
CONTROL result by exact identity and return `DATA_INCOMPLETE` if it is absent.
The machine helper requires `current.closeTime == signalTime` and
`historical.closeTime == current.closeTime - 24H`; both candles must be
decision-time legal. t-23, t-25, future, missing, or malformed data fails
closed.

## Round-004 invalidation contract

The exact `invalidatingChanges` list is:

```text
GATE_VALUE, GATE_FORMULA, FOLD_IMPROVEMENT_DEFINITION,
CATASTROPHIC_FOLD_DEFINITION, APPLICABILITY_RULE, SAMPLE_FLOOR,
SELECTION_TIE_RULE, AGGREGATE_VALIDATION_DEFINITION, CANDIDATE_DEFINITION,
FEATURE_FORMULA, SELECTOR_FORMULA, COMPLEXITY_TUPLE, COST_ASSUMPTION,
FORMAL_SIGNAL_FORMULA, ENTRY_FORMULA, STOP_FORMULA, TP_FORMULA,
EXIT_FORMULA, HOLDING_HORIZON, RELATIVE_STRENGTH_FORMULA, RANKING_RULE,
FUNDING_SEMANTICS, DECISION_TIME_FIELD_SEMANTICS
```

After the performance lock, any listed change has the exact action
`ROUND_004_INVALIDATION_REQUIRED`: stop, do not patch or rerun the same round,
and require a new research-round decision.

## Data, folds, and safety boundary

The universe is the five frozen symbols from
`2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`, classified as
`RESEARCH_AVAILABLE_SEEN_DATA`. Signal data is 1H, trend data is 4H, and only
the existing EMA20/50/200, Wilder RSI14, and ATR14 are used. Folds are the
existing F1-F6 research/validation definitions; aggregate validation is the
concatenation of non-overlapping F1-F6 validation segments by signal time, not
an average.

This milestone contains no Binance request, HTTP client, historical loader,
CONTROL capture, backtest, settlement, funding download, evidence result,
candidate selection, baseline-002 freeze, M3-J work, or M4 work. The pure
helpers are synthetic-input utilities only.
