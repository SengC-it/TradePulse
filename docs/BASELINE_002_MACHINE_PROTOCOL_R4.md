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
  `3c0a975cc0cbcd3dea73fc343b6298b76010d2bf7655e96986a638b646c625e5`
- Plan SHA-256:
  `bca9ac355a96b894b11f2df80ee719077f0944356f44ec26cc2fc62f7e1f8d2e`
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
first. Reconstruct the exact baseline evaluation from data closed by the
origin time. The first same-symbol/same-direction origin that is formal and
has total score at least 70 is eligible; no origin older than four bars is
considered.

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
