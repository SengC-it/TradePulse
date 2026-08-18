# baseline-002 Round-004 Selection Gates

Status: **FROZEN FOR REVIEW / NO PERFORMANCE GENERATED**

`researchRoundId = baseline-002-research-round-004`

- source SHA: `1bab6066cd4e9933c3d50ab29a38e9ad0792e5c8`
- inherited Round-003 Gate SHA:
  `297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2`
- Round-004 Gate SHA:
  `c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54`
- Plan SHA:
  `f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981`
- performance lock: `FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED`
- no-candidate outcome: `NO BASELINE-002 CANDIDATE — ROUND-004`

The Round-004 record inherits Round-003 numeric values, formulas, sample
floors, fold definitions, PF semantics, concentration definitions, and tie
rules. The only round-specific changes are the research identity, source
provenance, four-candidate applicability, and performance-lock/no-candidate
labels.

## Hard-gate registry and applicability

The exact SHA-covered registry has 11 identities, in this order:

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

All four candidates must pass the 10 applicable identities other than
`requiredRedundancyImprovement`. A failed performance gate is `INELIGIBLE`; an
integrity failure is incomplete evidence and must fail closed.

| Gate | Frozen value | Comparison / denominator |
| --- | ---: | --- |
| Minimum aggregate improvement | `+0.10 R/executed-trade` | candidate aggregate validation expectancy minus CONTROL, at least |
| Improved validation folds | `4 of 6` | fold expectancy delta at least `+0.02 R/executed-trade`, insufficient folds are not improved |
| Catastrophic fold limit | `0` | catastrophic when expectancy <= `-0.10`, NORMAL PF < `0.80`, NO_TRADES, or failed fold sample |
| Minimum net expectancy | `+0.03 R/executed-trade` | concatenated F1-F6 validation executed trades, at least |
| Minimum PF | `1.20` | aggregate positive net R / absolute negative net R; NO_TRADES fails |
| Maximum symbol concentration | `0.50` | top symbol share of positive net R, at most; null fails |
| Maximum single-trade concentration | `0.10` | largest single trade share of positive net R, at most; null fails |
| Maximum fee burden | `0.75` | fee R / absolute gross R, at most; zero/null gross fails |
| Minimum formal signals | `300` | aggregate F1-F6 validation formal signals, at least |
| Minimum executed trades | `30` | each individual F1-F6 validation fold, at least |

The inherited redundancy formula remains recorded for audit compatibility.
H11, H12, H13, and H14 all have `redundancyApplicability = NOT_APPLICABLE`;
`NOT_APPLICABLE` is excluded from the conjunction and never converted into
PASS.

## PF, folds, and tie rules

- `NORMAL` PF is compared numerically to 1.20.
- `NO_LOSSES` may pass PF only when every other applicable gate and sample floor
  passes; a null PF is not encoded as Infinity.
- `NO_TRADES` is catastrophic and fails.
- Aggregate validation concatenates non-overlapping F1-F6 validation segments;
  it is not an average and cannot include research segments or another period.
- Candidate comparison first prefers more improved validation folds.
- If tied, higher aggregate expectancy wins only when the absolute difference
  exceeds `0.01 R/executed-trade`.
- Otherwise use lexicographically smaller complexity tuple, then higher PF,
  then lexicographically smaller candidate ID.

## Immutability and stop conditions

The record becomes immutable at the first generated Round-004 performance
result. The exact invalidating categories are:

```text
GATE_VALUE, GATE_FORMULA, FOLD_IMPROVEMENT_DEFINITION,
CATASTROPHIC_FOLD_DEFINITION, APPLICABILITY_RULE, SAMPLE_FLOOR,
SELECTION_TIE_RULE, AGGREGATE_VALIDATION_DEFINITION, CANDIDATE_DEFINITION,
FEATURE_FORMULA, SELECTOR_FORMULA, COMPLEXITY_TUPLE, COST_ASSUMPTION,
FORMAL_SIGNAL_FORMULA, ENTRY_FORMULA, STOP_FORMULA, TP_FORMULA,
EXIT_FORMULA, HOLDING_HORIZON, RELATIVE_STRENGTH_FORMULA, RANKING_RULE,
FUNDING_SEMANTICS, DECISION_TIME_FIELD_SEMANTICS
```

Any such change requires:

```text
ROUND_004_INVALIDATION_REQUIRED
```

Meaning: stop, do not patch or rerun the same round, and require a new
research-round decision.

No Round-004 performance result exists in M3-R4-B. `baseline-002` remains
NOT FROZEN, M3-J remains BLOCKED, and M4 remains NOT STARTED.
