# TradePulse baseline-002 Research Round-002 Protocol

Status: **M3-R2-A UNDER REVIEW**

This document freezes the pre-performance protocol for
`baseline-002-research-round-002`. It is a research specification, not a
strategy implementation and not a performance result.

## Authoritative predecessor state

- M3-I is **CLOSED / MERGED** on main at
  `e19a1638aed76ca65b410bad7c025e011cde5b3a`.
- Round-001's exact final decision is `NO BASELINE-002 CANDIDATE`.
- Round-001 remains immutable and closed.
- `baseline-002` is **NOT FROZEN**.
- M3-J is **BLOCKED / NOT STARTED**.
- M4 is **NOT STARTED**.

The immutable Round-001 evidence files are:

- `docs/evidence/M3_H_ROUND_001_SUMMARY.json`
- `docs/evidence/M3_I_ROUND_001_SELECTION.json`

Neither file may be changed by Round-002.

## Absolute no-run boundary

M3-R2-A performs protocol freeze only. It must not:

- call Binance or any other market-data endpoint;
- load historical data or inspect market data after
  `2026-08-15T23:59:59.999Z`;
- run CONTROL, the backtest, the Strategy Engine over historical data, or a
  historical loader;
- derive candidate performance, net R, profit factor, expectancy, or any
  other outcome metric;
- implement candidate selectors, a feature extractor, a research engine,
  `baseline-002`, an optimizer, or parameter search;
- create candidate performance reports or evidence JSON.

Synthetic and documentation-consistency checks are allowed. No performance
result is generated in this milestone.

## Research identity and data boundary

Freeze:

```text
researchRoundId = baseline-002-research-round-002
```

The Round-002 research universe is exactly:

```text
2023-01-01T00:00:00.000Z
through
2026-08-15T23:59:59.999Z
```

All data in that interval is `RESEARCH_AVAILABLE_SEEN_DATA`. No design or
candidate-selection decision may inspect data after the frozen end. No result
at or before that end may be described as true OOS.

The true forward holdout begins at the first fully closed 1H candle strictly
after the eventual `baseline-002` final freeze commit/time. That boundary is
recorded only when a candidate is actually frozen; it is not created by this
protocol.

## Unchanged system contracts

Round-002 reuses, without modification:

- symbols `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, and `BNBUSDT`;
- 1H and 4H fully closed candles;
- EMA20, EMA50, EMA200, RSI14, and ATR14;
- `baseline-001` as the CONTROL strategy;
- `bt-policy-003` and its existing intrabar settlement policy;
- next-1H-open entry;
- 5 bps adverse entry and exit slippage;
- 5 bps entry and 5 bps exit fees;
- official funding rules;
- the 24-held-candle maximum;
- existing R normalization;
- the chronological F1-F6 validation folds;
- the existing signal-level disclaimer;
- public market data only, with no private Binance API and no trading/order
  execution.

Round-002 changes only decision-time candidate retention. It does not change
strategy economics, settlement, indicators, folds, or the CONTROL outcome
ledger.

## Round-002 objective

The objective is to identify a low-complexity structural decision-time
modification that produces robust positive **net signal-level edge** after the
frozen fees, slippage, funding, and settlement assumptions.

The objective is not to maximize win rate or trade count, find the best-looking
curve, or optimize until profitable.

The predeclared mechanism families are:

- stronger market-regime alignment;
- stronger symbol-trend quality;
- fresher pullback structure;
- volume confirmation;
- stronger breakout confirmation.

## Frozen mechanism families

### H6 — `STRICT_BTC_ALIGNMENT`

BTCUSDT receives no additional BTC-direction gate. For
ETHUSDT/SOLUSDT/XRPUSDT/BNBUSDT:

- LONG requires `btcRegime == BTC_STRONG_BULL`;
- SHORT requires `btcRegime == BTC_STRONG_BEAR`;
- `BTC_NEUTRAL` blocks both non-BTC LONG and SHORT.

H6 has no threshold.

### H7 — `STRONG_SYMBOL_REGIME`

H7 reuses the existing baseline indicator formulas and replaces the weak
symbol directional regime with the following stronger 4H trend-quality
requirement.

LONG requires all of:

```text
close > EMA50
EMA50 > EMA200
(close - EMA200) / ATR >= 1.00
(EMA50 - EMA200) / ATR >= 0.50
(EMA200_now - EMA200_5ago) / ATR >= 0.10
```

SHORT requires the exact mirror:

```text
close < EMA50
EMA50 < EMA200
(EMA200 - close) / ATR >= 1.00
(EMA200 - EMA50) / ATR >= 0.50
(EMA200_5ago - EMA200_now) / ATR >= 0.10
```

ATR must be finite and greater than zero. H7 has no parameter grid.

### H8 — `RECENT_PULLBACK`

Preserve the baseline EMA20/EMA50 touch semantics, but require at least one
valid touch in exactly `t-1` or `t-2`. The current candle is excluded. A
touch in any earlier candle does not satisfy H8.

### H9 — `VOLUME_CONFIRMATION`

Use fully closed 1H data only. Define:

```text
volumeMean20 = arithmetic mean of t-20 through t-1 volumes
```

The current candle `t` is excluded. Require `currentVolume >= volumeMean20`.
All volumes must be finite and greater than or equal to zero, and
`volumeMean20` must be finite and greater than zero. Otherwise the selector
fails closed.

### H10 — `BREAKOUT_BUFFER`

Preserve the frozen previous-three-candle breakout reference and use the
existing ATR14 implementation for the current candle.

```text
LONG:
currentClose >= max(previous3High) + 0.10 * currentATR

SHORT:
currentClose <= min(previous3Low) - 0.10 * currentATR
```

Equality passes. ATR must be finite and greater than zero. The only buffer is
`0.10 ATR`; no 0.05, 0.15, or 0.20 sweep is permitted.

## Exact candidate registry

The registry is exactly one CONTROL plus nine candidates. No additional
candidate or combination may be added after results are observed.

| Role | Candidate ID | Mechanisms |
| --- | --- | --- |
| CONTROL | `R2-CONTROL-BASELINE-001` | baseline-001 |
| Candidate 1 | `R2-H6-STRICT-BTC` | H6 |
| Candidate 2 | `R2-H7-STRONG-SYMBOL` | H7 |
| Candidate 3 | `R2-H8-RECENT-PULLBACK` | H8 |
| Candidate 4 | `R2-H9-VOLUME-CONFIRM` | H9 |
| Candidate 5 | `R2-H10-BREAKOUT-010` | H10 |
| Candidate 6 | `R2-C1-BTC-STRONG-SYMBOL` | H6 + H7 |
| Candidate 7 | `R2-C2-STRONG-SYMBOL-RECENT-PULLBACK` | H7 + H8 |
| Candidate 8 | `R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT` | H7 + H9 + H10 |
| Candidate 9 | `R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT` | H6 + H7 + H9 + H10 |

## Strict subset and outcome-blind selection

Every Round-002 candidate must be a strict eligibility subset of baseline-001
formal signals. A candidate must never create a signal at a
symbol/signalTime/direction identity where baseline-001 did not create a
formal signal.

Future Round-002 tooling may capture additional contemporaneous decision-time
features for baseline-001 formal signals, apply the frozen selectors, and
inherit the exact CONTROL settlement/economic outcome only for retained
identities.

Selectors must not inspect any outcome or future field when retaining a
signal, including `entryTime`, `exitTime`, `exitReason`, `grossR`, `feeR`,
`fundingR`, `netR`, `heldCandleNumber`, future candles, future funding, or
settlement outcome.

## Required decision-time feature contract

Future M3-R2-B tooling exposes only contemporaneous fields needed by H6-H10.
At minimum it includes:

- `signalTime`, `symbol`, `direction`, and `btcRegime`;
- `symbol4hClose`, `symbol4hEma50`, `symbol4hEma200`, `symbol4hAtr`, and
  `symbol4hEma200FiveBarsAgo`;
- `nearestBaselinePullbackTouchAgeBars`;
- `current1hVolume` and `previous20Closed1hVolumeMean`;
- `current1hClose`, `previous3BreakoutExtreme`, `current1hAtr`, and
  `breakoutMarginAtr`.

No future/outcome field may be added to the selector input contract.

## Selection gates

Round-002 inherits the Round-001 gate values, formulas, semantics, sample
floors, PF status rules, aggregate-validation construction, fold-improvement
definition, catastrophic-fold definition, concentration rules, fee-burden
rule, and selection tie rules unchanged.

M3-R2-B may encode these rules into a separate Round-002 machine record, but
may not alter them. There is no gate-change escape hatch. If an actual
structural incompatibility is discovered, the process must stop; the gate
must not be modified inside Round-002. The protocol must instead be amended
as a new research-round decision before performance.

No future work may lower any inherited safeguard, including minimum aggregate
improvement, minimum improved folds, minimum expectancy, minimum PF,
redundancy/sample/concentration safeguards, or the fee-burden requirement.

M3-R2-B must create and freeze a separate machine-readable Round-002 gate
record, with a distinct Round-002 identity, before any Round-002 performance
output. That record must assert canonical equivalence of every inherited
gate value and semantic rule to Round-001. No gate value may be chosen after
seeing Round-002 performance.

### Redundancy-gate applicability

Round-001 `requiredRedundancyImprovement` applicability is preserved
semantically. It is REQUIRED only for a hypothesis whose declared mechanism
claims `H1_SIGNAL_REDUNDANCY` or `H4_SIGNAL_DENSITY`, including a combination
that contains either family.

None of H6, H7, H8, H9, H10, C1, C2, C3, or C4 declares H1 or H4. Therefore,
for all nine Round-002 candidates:

```text
requiredRedundancyImprovement.applicability = NOT_APPLICABLE
requiredRedundancyImprovement.status       = NOT_APPLICABLE
```

`NOT_APPLICABLE` is not counted as `PASS`. Incidental signal-count or overlap
reduction caused by H6-H10 must not be reinterpreted as an H1/H4 redundancy
mechanism. This preserves Round-001 semantics without post-result weakening
or strengthening.

### Exact selection tie rule

Round-002 inherits the exact Round-001 selection ordering:

1. greater `improvedValidationFolds`;
2. if tied, and the aggregate expectancy difference is greater than `0.01 R`,
   higher aggregate expectancy;
3. if the expectancy difference is less than or equal to `0.01 R`, the
   lexicographically smaller complexity tuple;
4. higher aggregate profit factor;
5. `experimentId` lexical ascending.

The complexity tuple is exactly:

```text
(
  newRules,
  newTunableThresholds,
  modifiedBaselineRules,
  mechanismFamiliesUsed
)
```

M3-R2-B must freeze a non-negative-integer complexity tuple for each of the
nine candidates before any performance output. No complexity value may be
changed after performance is generated.

## Folds and metric boundary

Reuse the exact existing chronological F1-F6 validation folds. There is no
random shuffle, no fold selected after results, and no averaging of fold
metrics as a substitute for concatenated validation. Fold membership remains
based on signalTime in UTC.

## Frozen execution sequence

```text
M3-R2-A  protocol freeze; documentation only
    ->
M3-R2-B  machine gate record, experiment registry, decision-time feature
          snapshot, pure selectors, and synthetic tests; no performance
    ->
M3-R2-C  pre-run source freeze, one authoritative baseline-001 CONTROL
          capture, and offline derivation of exactly nine candidates
    ->
M3-R2-D  mechanical application of the frozen Round-002 gates
```

If zero candidates are eligible, the exact decision is:

```text
NO BASELINE-002 CANDIDATE — ROUND-002
```

M3-J remains blocked. If one or more candidates are eligible, the frozen tie
rules select one mechanically; only then may baseline-002 be frozen and M3-J
separately authorized.

## Round-002 invalidation rule

Before the first Round-002 performance output, implementation defects may be
fixed and the source may be re-frozen.

After the first candidate performance output, changing candidate definitions,
thresholds, gate values, feature formulas, selector formulas, folds, cost
assumptions, or complexity rules invalidates this research round. A
result-affecting defect discovered after that point requires:

```text
ROUND_002_INVALIDATION_REQUIRED
```

The same research round must not be patched and rerun.

## Scope and stop condition

M3-R2-A changes documentation only. It does not create Round-002 source code,
selectors, feature extraction, a runner, a CLI, evidence JSON, or candidate
performance output. It does not change baseline-001, bt-policy-003, Round-001
gates, Round-001 evidence, or any trading capability.

The milestone stops after documentation verification and CI with this state:

- M3-I: **CLOSED / MERGED**;
- Round-001: **NO BASELINE-002 CANDIDATE**;
- `baseline-002`: **NOT FROZEN**;
- M3-R2-A: **UNDER REVIEW**;
- M3-J: **BLOCKED / NOT STARTED**;
- M4: **NOT STARTED**.
