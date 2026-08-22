# baseline-002 Research Round-005 Diagnosis

Status: M3-R5-A DIAGNOSIS AND HYPOTHESIS FREEZE

Authoritative base: `0cba8fc75fc65b5a53ee760bf15af9a0e0594033`

Research round: `baseline-002-research-round-005`

## Scope and evidence boundary

This document is a documentation and research-design record only. It does
not implement, select, measure, or optimize a Round-005 candidate.

The diagnosis uses only already-committed research evidence. No Binance
request, new market-data fetch, historical loader, baseline-001 execution,
Round-004 rerun, backtest, candidate-performance calculation, Gate creation,
Plan creation, threshold tuning, or parameter optimization was performed.

The research boundary remains data through
`2026-08-15T23:59:59.999Z` and is classified as
`RESEARCH_AVAILABLE_SEEN_DATA`. Data after that boundary is preserved for a
future forward evaluation and was not inspected.

## Evidence provenance

The following files are the complete evidence set used for this diagnosis.
The listed values are raw SHA-256 hashes of the files, not hashes of parsed
or reserialized content.

| Evidence artifact | Role | Raw SHA-256 |
| --- | --- | --- |
| `docs/evidence/M3_R4_D_SELECTION.json` | Round-004 frozen Gate application and final decision | `f08a3343a3316cb2f80a833c313abed18970b1fbc844dd44fe6adb3e94d19c69` |
| `docs/M3_R4_D_SELECTION.md` | Human-readable Round-004 Gate application record | `7d4f4020ef02882ee8505c751428a98f6911cfcadb1cbed3bd866ee40402dced` |
| `docs/evidence/M3_R4_ROUND_004_SUMMARY.json` | Round-004 CONTROL and H11-H14 performance evidence | `3d5da8412a972e7b2d313b975244cb0843d7989e7600cd29bc50eac7a9318a53` |
| `docs/BASELINE_002_DIAGNOSIS_R4.md` | Prior diagnosis and retired-mechanism record | `7f01d5bf3e38246910af6a0df90e2f68f6b1bf40cadb0a36fcfd6095ba180318` |
| `docs/BASELINE_002_RESEARCH_R4.md` | Prior qualitative hypothesis and standalone-protocol record | `6b36aa7ef4ec273182f4ff2a9873f95f69f1409ec4474055610dddfbf350e746` |

## Evidence and research inference

**EVIDENCE** means a statement directly supported by the immutable artifacts
listed above. **RESEARCH INFERENCE** means a forward-looking interpretation
of those observations. An inference is not a new performance measurement and
does not authorize a backtest.

## Governance reconciliation

**EVIDENCE:** Round-004 is complete. Its frozen Gate application has
`integrityStatus = COMPLETE`, zero integrity errors, no eligible candidates,
`selectionAlgorithmApplied = false`, and the exact final decision
`NO BASELINE-002 CANDIDATE — ROUND-004`.

**EVIDENCE:** Round-004 performance was produced by the sole authoritative
Attempt #7 result. That result and its selection artifacts remain unchanged.

**CONSEQUENCE:** `baseline-002 = NOT_FROZEN`, `M3-J = BLOCKED`, and
`M4 = NOT_STARTED`. Round-005 is authorized here only for diagnosis and
research design. No historical performance is authorized by R5-A.

## D1 — Round-004 structural redesign still produced no viable edge

**EVIDENCE:** Every Round-004 candidate is ineligible under the frozen Gate.
The authoritative Gate application records the following aggregate outcomes:

| Candidate | Aggregate improvement | Expectancy | Profit factor | Catastrophic folds | Fee burden |
| --- | ---: | ---: | ---: | ---: | ---: |
| H11 | approximately -0.02315348 | approximately -0.10522043 | approximately 0.82703 | 2 | approximately 2.28655 |
| H12 | approximately -0.02620422 | approximately -0.10827117 | approximately 0.83171 | 3 | approximately 3.62278 |
| H13 | approximately +0.04156295 | approximately -0.04050399 | approximately 0.90887 | 2 | approximately 2.20200 |
| H14 | approximately +0.01288380 | approximately -0.06918315 | approximately 0.88208 | 1 | approximately 27.65639 |

The evidence does not show a candidate satisfying all applicable gates.

**RESEARCH INFERENCE:** The Round-004 structural changes tested so far did
not produce a viable economic edge. Round-005 should test a different edge
architecture rather than manufacture a pass by relaxing the frozen Gate.

## D2 — H13 is directionally better but not close enough

**EVIDENCE:** H13 improved 4 of 6 validation folds, but its authoritative
record still fails:

- `minimumAggregateImprovement`;
- `catastrophicFoldLimit`;
- `minimumNetExpectancy`;
- `minimumProfitFactor`; and
- `maximumFeeBurdenRatio`.

**RESEARCH INFERENCE:** H13 is directionally stronger than H11, H12, and H14
on some diagnostics, but the observed result is not a basis for promotion,
parameter tuning, or a second H13 sweep.

Therefore H13 must not be promoted or tuned based on Round-004 outcomes.

## D3 — Cost-to-edge economics are structurally weak

**EVIDENCE:** The repository diagnostic definition is
`feeBurdenRatio = feeR / abs(grossR)`. The authoritative H11-H14 records show
large fee-burden ratios alongside non-positive expectancy and sub-1 profit
factors.

**RESEARCH INFERENCE:** Fees are consuming an excessive proportion of gross
strategy edge. Lowering fee or slippage assumptions is not the solution.
Round-005 must seek larger gross edge per trade and/or structurally lower
turnover while preserving conservative economics.

## D4 — Sample size and concentration are not primary blockers

**EVIDENCE:** The Round-004 candidate records pass the
`maximumSymbolConcentration`, `maximumSingleTradeConcentration`,
`minimumFormalSignals`, and `minimumExecutedTrades` gates.

**RESEARCH INFERENCE:** Round-005 must not optimize for producing more
trades, enlarging the sample, or increasing signal density. The focus is
economic edge and robustness.

## D5 — Incremental baseline-001 filtering is exhausted

**EVIDENCE:** The prior committed research and diagnosis records preserve the
retirement of the previously tested filtering and density families.

The following are retired from Round-005's first performance stage:

- H1 cooldown/redundancy;
- H2 cost-proxy filters;
- H3 score thresholds;
- H4 Top-N;
- H6 BTC alignment;
- H7 strong symbol regime;
- H8 pullback filter;
- H9 volume confirmation;
- H10 breakout buffer; and
- C1-C4 combinations.

The first-stage tuning of H11-H14 is also retired. Retirement preserves the
prior evidence for audit; it does not authorize recreating, sweeping, or
combining those mechanisms.

**RESEARCH INFERENCE:** Another threshold sweep of a prior mechanism would
repeat the exhausted search shape. Round-005 therefore freezes four
standalone qualitative hypotheses from distinct mechanism families.

## Round-005 design implication

**RESEARCH INFERENCE:** R5-B should make the four hypotheses executable only
after exact semantics, data availability, no-future-data behavior, and
non-weakened gates are frozen. R5-A does not create a Gate SHA, Plan SHA,
candidate registry, performance evidence, or baseline-002.

`baseline-002` remains `NOT_FROZEN`; M3-J remains `BLOCKED`; M4 remains
`NOT_STARTED`.
