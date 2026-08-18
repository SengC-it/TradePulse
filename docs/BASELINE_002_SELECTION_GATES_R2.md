# baseline-002 Round-002 Selection Gates

Status: **M3-R2-B UNDER REVIEW / PRE-PERFORMANCE**

This document records the machine-readable Round-002 selection contract. It
does not contain performance results and does not freeze `baseline-002`.

## Identity and provenance

```text
researchRoundId = baseline-002-research-round-002
sourceSha = 26d18ef314594f0e79583da617a0d8c17e812be9
inheritedRound001SelectionGateSha256 = 11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd
round002SelectionGateSha256 = 9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0
round002PlanSha256 = 82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511
performanceStatus = NOT_GENERATED
performanceLock = FIRST_M3_R2_C_PERFORMANCE_RESULT_GENERATED
```

The Round-002 selection gate record is a separate canonical record. Its
values, denominators, directions, comparisons, and definitions are inherited
from Round-001 without alteration. The Round-001 source and evidence remain
immutable.

## Inherited numeric gates

| Gate | Value | Direction | Comparison |
| --- | ---: | --- | --- |
| `minimumAggregateImprovement` | 0.1 R/executed-trade | MINIMUM | AT_LEAST |
| `minimumImprovedValidationFolds` | 4 folds | MINIMUM | AT_LEAST |
| `catastrophicFoldLimit` | 0 folds | MAXIMUM | AT_MOST |
| `minimumNetExpectancy` | 0.03 R/executed-trade | MINIMUM | AT_LEAST |
| `minimumProfitFactor` | 1.2 ratio | MINIMUM | AT_LEAST |
| `maximumSymbolConcentration` | 0.5 fraction | MAXIMUM | AT_MOST |
| `maximumSingleTradeConcentration` | 0.1 fraction | MAXIMUM | AT_MOST |
| `maximumFeeBurdenRatio` | 0.75 ratio | MAXIMUM | AT_MOST |
| `requiredRedundancyImprovement` | 0.3 fractional-relative-reduction | MINIMUM | AT_LEAST |
| `minimumFormalSignals` | 300 formal-signals | MINIMUM | AT_LEAST |
| `minimumExecutedTrades` | 30 executed-trades per fold | MINIMUM | AT_LEAST |
| `complexityTieThreshold` | 0.01 R/executed-trade | MAXIMUM | AT_MOST |

The exact denominators, PF status semantics, six-fold concatenation, 0.02 R
fold-improvement delta, -0.10 expectancy catastrophic rule, PF `< 0.80`
rule, sample floors, concentration rules, fee-burden rule, and five-step
selection order are the Round-001 definitions and are included in the
SHA-covered machine record.

## Redundancy applicability

Round-002 candidates are H6-H10 and C1-C4. None declares
`H1_SIGNAL_REDUNDANCY` or `H4_SIGNAL_DENSITY`. Therefore every candidate has:

```text
requiredRedundancyImprovement.applicability = NOT_APPLICABLE
requiredRedundancyImprovement.status = NOT_APPLICABLE
notApplicableCountsAsPass = false
```

`NOT_APPLICABLE` is never converted to `PASS`, zero, or an observed overlap
improvement. A structural incompatibility is not an in-round escape hatch;
the process stops and requires a new research-round decision.

## Candidate registry

There are exactly 10 result identities in this order:

```text
R2-CONTROL-BASELINE-001
R2-H6-STRICT-BTC
R2-H7-STRONG-SYMBOL
R2-H8-RECENT-PULLBACK
R2-H9-VOLUME-CONFIRM
R2-H10-BREAKOUT-010
R2-C1-BTC-STRONG-SYMBOL
R2-C2-STRONG-SYMBOL-RECENT-PULLBACK
R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT
R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT
```

The first identity is the one inherited baseline-001 CONTROL. The remaining
nine are the only Round-002 candidates. No result-dependent candidate may be
added.

## Complexity tuples

The dimensions are, in order:
`(newRules, newTunableThresholds, modifiedBaselineRules, mechanismFamiliesUsed)`.
Every value is a non-negative integer and is frozen before performance:

| Identity | Complexity tuple |
| --- | --- |
| CONTROL | `(0, 0, 0, 0)` |
| H6 | `(0, 0, 1, 1)` |
| H7 | `(0, 3, 1, 1)` |
| H8 | `(0, 1, 1, 1)` |
| H9 | `(1, 2, 0, 1)` |
| H10 | `(0, 1, 1, 1)` |
| C1 | `(0, 3, 2, 2)` |
| C2 | `(0, 4, 2, 2)` |
| C3 | `(1, 6, 2, 3)` |
| C4 | `(1, 6, 3, 4)` |

The only tested values are H7 `(1.00, 0.50, 0.10)`, H8 `maxTouchAgeBars=2`,
H9 `(volumeLookbackBars=20, minCurrentToMeanRatio=1.00)`, and H10
`breakoutBufferAtr=0.10`. H6 has `parametersTested=[]`; combinations inherit
the exact component values. No parameter grid exists.

## Decision-time and selector contract

`M3R2DecisionSnapshot` contains only:

```text
signalTime, symbol, direction, btcRegime,
symbol4hClose, symbol4hEma50, symbol4hEma200, symbol4hAtr,
symbol4hEma200FiveBarsAgo, nearestBaselinePullbackTouchAgeBars,
current1hQuoteVolume, previous20Closed1hQuoteVolumeMean,
current1hClose, previous3BreakoutExtreme, current1hAtr, breakoutMarginAtr
```

H9 uses Binance `Candle.quoteVolume`, not base `volume`; the current 1H value
is compared with the arithmetic mean of the previous 20 fully closed 1H
quote-volume values, excluding the current candle. Invalid denominators fail
closed.

The snapshot extractor accepts exactly 250 closed 1H and 250 closed 4H
candles, checks identity, chronology, continuity, timestamps, finite positive
OHLC, indicator availability, ATR positivity, pullback availability, and
breakout validity. It rejects future candles and never uses a fallback.

Selectors are pure functions over snapshots. H6-H10 use the frozen inclusive
thresholds; combinations are exact logical ANDs. They do not accept
`BacktestSignalResult` or any outcome/future/settlement field. Duplicate
`symbol|direction|signalTime` identities are rejected. Outputs are sorted by
signal time, frozen symbol order `BTCUSDT ETHUSDT SOLUSDT XRPUSDT BNBUSDT`, and
`LONG` before `SHORT`, and contain only original snapshot references.

## Pre-performance formula remediation

Before any Round-002 performance existed, review identified an implementation
defect in H7: the selector used `symbol4hEma50` instead of `symbol4hEma200` as
the close-distance reference. The implementation now follows the already
frozen H7 formula and its machine-readable selector specification: strict
directional close/EMA50/EMA200 ordering, EMA200 close distance, EMA50-EMA200
spread, and the EMA200 five-bars-ago slope, all normalized by positive
`symbol4hAtr` with inclusive thresholds. This is a pre-performance
implementation correction, not strategy tuning; the frozen protocol, gate
record, candidate identities, tuples, and gate semantics are unchanged.

`ROUND_002_INVALIDATION_REQUIRED` does not apply because no performance output
had been generated. No historical, CONTROL, or candidate-performance run was
performed for this correction.

## Stop condition

Round-002 remains `PRE-PERFORMANCE`. The exact future no-candidate result is:

```text
NO BASELINE-002 CANDIDATE — ROUND-002
```

No CONTROL capture, historical load, performance derivation, optimizer,
`baseline-002` freeze, M3-R2-C/D, M3-J, or M4 work is authorized by this
record.
