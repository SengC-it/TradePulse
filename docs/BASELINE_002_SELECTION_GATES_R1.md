# baseline-002 Research Round-001 Selection Gates

Status: M3-G.2 gate freeze under review; this artifact must be merged before
M3-H starts.

This document freezes the real selection gates for exactly one research round:

```text
researchRoundId: baseline-002-research-round-001
tooling source SHA: 2f2c8f442b86bb730745908a6d6bf6a76ac43dd6
selectionGateSha256: 11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd
```

The SHA-256 is over the UTF-8 bytes of the deterministic
`BASELINE_002_RESEARCH_ROUND_001_MACHINE_RECORD` serialization produced by
`stableStringify`, with no trailing newline. The machine-readable record is
`src/lib/research/selection-gates-round-001.ts` and is validated by the
existing `SelectionGateSchema` validator. The SHA-covered record includes the
complete eligibility, applicability, aggregation, PF-status, complexity-domain,
and round-immutability semantics below; they are not Markdown-only policy.

No candidate performance was inspected, generated, loaded, compared, or
inferred while freezing these gates. All validation in M3-G.2 uses synthetic
fixtures only. `baseline-002` is not frozen and M3-H has not started.

## Exact gate record

All gates are conjunctive. A candidate is eligible only when every applicable
gate below passes and all data/provenance integrity requirements pass.

| Gate | Value | Unit | Direction / comparison | Denominator and frozen meaning |
| --- | ---: | --- | --- | --- |
| `minimumAggregateImprovement` | 0.10 | `R/executed-trade` | `MINIMUM / AT_LEAST` | Candidate aggregate validation expectancyR minus `CONTROL_BASELINE_001` aggregate validation expectancyR; pass at `>= 0.10`. |
| `minimumImprovedValidationFolds` | 4 | `folds` | `MINIMUM / AT_LEAST` | Six validation folds F1–F6; a fold improves when candidate expectancyR minus control expectancyR is `>= 0.02 R/executed-trade`. An insufficient-sample fold is not improved. |
| `catastrophicFoldLimit` | 0 | `folds` | `MAXIMUM / AT_MOST` | Six validation folds; any catastrophic fold fails the candidate. |
| `minimumNetExpectancy` | 0.03 | `R/executed-trade` | `MINIMUM / AT_LEAST` | All executed trades in concatenated F1–F6 validation segments after frozen fees, slippage, and funding. |
| `minimumProfitFactor` | 1.20 | `ratio` | `MINIMUM / AT_LEAST` | Aggregate validation positive netR divided by absolute aggregate validation negative netR. `NO_LOSSES` passes only when all sample gates pass; `NO_TRADES` fails. Infinity is never encoded. |
| `maximumSymbolConcentration` | 0.50 | `fraction` | `MAXIMUM / AT_MOST` | `topSymbolShareOfPositiveNetR` on aggregate validation data; null fails. |
| `maximumSingleTradeConcentration` | 0.10 | `fraction` | `MAXIMUM / AT_MOST` | `largestSingleTradeShareOfPositiveNetR` on aggregate validation data; null fails. |
| `maximumFeeBurdenRatio` | 0.75 | `ratio` | `MAXIMUM / AT_MOST` | Aggregate validation `feeR / abs(grossR)` using the frozen `feeBurdenRatio`; zero grossR or null fails. |
| `requiredRedundancyImprovement` | 0.30 | `fractional-relative-reduction` | `MINIMUM / AT_LEAST` | `(control overlappingSignalRate - candidate overlappingSignalRate) / control overlappingSignalRate`; applicability is defined below. |
| `minimumFormalSignals` | 300 | `formal-signals` | `MINIMUM / AT_LEAST` | Aggregate formal signals across all F1–F6 validation segments. |
| `minimumExecutedTrades` | 30 | `executed-trades` | `MINIMUM / AT_LEAST` | Each individual validation fold F1–F6 must have at least 30 executed trades. |
| `complexityTieThreshold` | 0.01 | `R/executed-trade` | `MAXIMUM / AT_MOST` | Absolute difference in aggregate validation expectancyR between two eligible candidates. |

## Machine-readable eligibility and PF semantics

The eligibility policy is immutable and SHA-covered:

```text
mode: ALL_APPLICABLE_GATES_MUST_PASS
notApplicableHandling: EXCLUDED_FROM_CONJUNCTION_NOT_COUNTED_AS_PASS
performanceGateFailure: INELIGIBLE
integrityFailure: INELIGIBLE_INCOMPLETE_EVIDENCE
```

The hard eligibility identities are exactly:

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

`complexityTieThreshold` is a selection/tie semantic and is intentionally not
an eligibility performance gate.

Aggregate PF status is also machine-readable:

```text
NORMAL: COMPARE_NUMERIC_PF_TO_MINIMUM_PROFIT_FACTOR
NO_LOSSES: PF_GATE_PASSES_ONLY_IF_ALL_SAMPLE_GATES_PASS
NO_TRADES: FAIL
encodeInfinity: false
```

## Fold, catastrophic, and applicability semantics

- An improved validation fold is counted only when the candidate-minus-control
  expectancyR delta is at least `+0.02 R/executed-trade` and the fold passes
  the frozen sample gate.
- A validation fold is catastrophic when expectancyR is `<= -0.10`, when its
  status is `NORMAL` and PF is `< 0.80`, when its status is `NO_TRADES`, or
  when its per-fold executed-trade sample floor fails. `NO_LOSSES` is not
  catastrophic solely because PF is null (`noLossesIsCatastrophicSolelyBecausePfNull: false`)
  when all sample and integrity gates pass.
- The redundancy gate is mandatory for `H1_SIGNAL_REDUNDANCY` and
  `H4_SIGNAL_DENSITY`, and for a future combination containing either
  mechanism (`combinationContainingH1OrH4: REQUIRED`). It is
  `NOT_APPLICABLE` for pure single-mechanism H2, H3, and H5 candidates.
  `notApplicableRepresentation` is `NOT_APPLICABLE`, and
  `notApplicableCountsAsPass` is `false`; N/A is not converted to numeric
  zero or treated as a pass.

## Aggregate validation construction

Aggregate validation is the SHA-covered concatenation of exactly the six
non-overlapping frozen validation segments:

```text
foldIds: F1, F2, F3, F4, F5, F6
role: VALIDATION
construction: CONCATENATE_NON_OVERLAPPING_FROZEN_VALIDATION_SEGMENTS
timeBasis: signalTime
```

It is not an average of fold metrics, research plus validation, a random
pooled period, or an alternate period.

## Complexity and deterministic tie rule

The four complexity dimensions have the frozen domain `NON_NEGATIVE_INTEGER`
and are ordered as:

1. `newRules`
2. `newTunableThresholds`
3. `modifiedBaselineRules`
4. `mechanismFamiliesUsed`

For eligible candidates:

1. Prefer more improved validation folds.
2. If that count ties, prefer higher aggregate validation expectancy when the
   difference is greater than `0.01 R/executed-trade`.
3. If the difference is at most `0.01`, prefer the lexicographically lower
   complexity tuple.
4. If the tuple ties, prefer higher aggregate validation PF.
5. If still tied, prefer lexicographically ascending `experimentId`.

This order is encoded in `simplerCandidateRule` and the companion machine
definitions. It cannot be changed after M3-H begins without invalidating this
research round. Gate application/evaluator work is deferred to the later
M3-I application boundary; this milestone does not run or rank candidates.

## Data and provenance integrity

Future evidence can be eligible only when it uses:

- `bt-policy-003` and m3-b-report-004-compatible study-clock provenance;
- a valid `studyServerTime`;
- exact F1–F6 fold ranges and `RESEARCH_AVAILABLE_SEEN_DATA` classification;
- no cross-fold records and no duplicate formal identities;
- no `DATA_INCOMPLETE` or `SETTLEMENT_AMBIGUOUS` result;
- deterministic serialization.

Any integrity failure is `INELIGIBLE / INCOMPLETE EVIDENCE`, not a
performance failure. Data through `2026-08-15T23:59:59.999Z` remains
`HISTORICAL RESEARCH VALIDATION / SEEN DATA`; it is never labelled pristine or
untouched OOS.

## Immutable boundary

The round becomes immutable at:

```text
FIRST_M3_H_PERFORMANCE_RESULT_GENERATED
```

The SHA-covered invalidating changes are exactly:

```text
GATE_VALUE
GATE_FORMULA
FOLD_IMPROVEMENT_DEFINITION
CATASTROPHIC_FOLD_DEFINITION
APPLICABILITY_RULE
SAMPLE_FLOOR
SELECTION_TIE_RULE
AGGREGATE_VALIDATION_DEFINITION
```

Any such change has the action:

```text
INVALIDATE_ROUND_AND_REQUIRE_NEW_RESEARCH_ROUND
```

Prior results from an invalidated round remain classified as `SEEN_DATA`.
The round cannot weaken its gates after a failed candidate:

```text
failedRoundCandidatePolicy: DO_NOT_WEAKEN_GATES
```

If no candidate later passes every applicable gate, the valid M3-I outcome is:

```text
NO BASELINE-002 CANDIDATE
```

This artifact does not implement or freeze `baseline-002`, does not rerun
baseline-001, does not execute M3-H, does not fetch historical market data,
and adds no trading or private Binance capability.
