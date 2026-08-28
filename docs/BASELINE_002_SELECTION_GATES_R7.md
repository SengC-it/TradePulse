# Round-007 Selection Gates

All applicable gates are conjunctive. There is no best-available fallback.

| Gate | Frozen rule |
| --- | --- |
| Aggregate improvement | candidate validation expectancy minus CONTROL is at least `0.10 R/executed-trade` |
| Improved folds | at least `4/6`, with candidate minus CONTROL expectancy at least `0.02 R` and both folds meeting the executed sample floor |
| Catastrophic folds | at most `0`; catastrophic means expectancy at most `-0.10`, NORMAL PF below `0.80`, NO_TRADES, or a fold below the executed sample floor |
| Net expectancy | aggregate validation expectancy at least `0.03 R/executed-trade` |
| Profit factor | aggregate PF at least `1.20`; NO_TRADES fails and NO_LOSSES passes only after sample gates |
| Concentration | top positive-net-R symbol share at most `0.50`; largest positive trade share at most `0.10` |
| Fees | aggregate fee burden at most `0.75`, with zero/null gross-R failing closed |
| Sample | aggregate formal signals at least `300`; every validation fold has at least `30` executed trades |
| Positive folds | validation expectancy is positive in at least `4/6` folds |
| Model integrity | for model candidates, all six models are finite, research-fit only, and unchanged before validation prediction |

Selection is eligibility-first. Ties use the inclusive `0.01 R` expectancy band with the exact floating rule:

```text
difference = maxExpectancy - candidateExpectancy
tolerance = Number.EPSILON * Math.max(
  1,
  Math.abs(maxExpectancy),
  Math.abs(candidateExpectancy),
  Math.abs(threshold),
)
inside iff difference - threshold <= tolerance
```

The machine-readable source is `src/lib/research/selection-gates-round-007.ts`. If no candidate passes all gates, the exact result is `NO BASELINE-002 CANDIDATE — ROUND-007` and baseline-002 remains `NOT_FROZEN`.
