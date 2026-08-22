# baseline-002 Research Round-006 Diagnosis

Status: M3-R6-A DIAGNOSIS AND HYPOTHESIS FREEZE

Authoritative base: 44d203a06e1171c2fe4baa779360bb0dde16e454

Research round: baseline-002-research-round-006

## Scope and hard boundary

This document is a documentation-only diagnosis and research-design record.
It does not implement, select, measure, or optimize a Round-006 candidate.

The only inputs used here are committed repository evidence. No Binance
request, historical loader, forward-data access, baseline-001 execution,
Round-005 rerun, backtest, performance calculation, threshold sweep,
optimizer, Gate creation, Plan creation, or candidate selection was performed.

The research boundary remains:

2026-08-15T23:59:59.999Z

Classification:

RESEARCH_AVAILABLE_SEEN_DATA

Data after that boundary remains reserved for a future forward evaluation and
was not inspected.

## Committed evidence provenance

The following artifacts were read from the authoritative base commit. The
hashes below are SHA-256 values of the exact committed Git-blob bytes, not
hashes of parsed or reserialized content.

| Evidence artifact | Role | Raw SHA-256 |
| --- | --- | --- |
| docs/evidence/M3_R5_C3_SELECTION.json | Round-005 C.3 selection and governance record | 480ea600468a8f2f39d9b2b2def6727cd45a58431f40fb7f660c257145fe170a |
| docs/M3_R5_C3_SELECTION.md | Human-readable Round-005 C.3 selection record | 58e31508bbd4c83a44f772feb0662d85e46eea3053e8d57d76430d55003173c6 |
| docs/evidence/M3_R5_ROUND_005_SUMMARY.json | Round-005 performance evidence | af3f14665fcbc4d050ad432d973d7999c4627132449e1eae82faa86ac78f1860 |
| docs/M3_R5_ROUND_005_RESULTS.md | Human-readable Round-005 result record | ee6374f08493e73fc505fbd0d374a4f1d53addceb13ddbfe67cfc67ebb8a9ce0 |
| docs/BASELINE_002_DIAGNOSIS_R5.md | Prior diagnosis and retired-mechanism record | 0699764c192f089540bb38cd14210d958826a1137806b1441797cd9ad56f704b |
| docs/BASELINE_002_RESEARCH_R5.md | Prior research protocol and hypothesis record | 4de90f60f04a047041a8f01a1ce7d42c43cbaf33dba25f5a78d4533e238508bd |

The Round-005 evidence itself records its inherited Gate and Plan
provenance. R6-A does not create, change, or freeze a new Gate SHA or Plan
SHA.

## Evidence versus research inference

EVIDENCE is a statement directly supported by the committed artifacts above.
RESEARCH INFERENCE is a forward-looking interpretation. An inference is not
a performance result, does not promote a candidate, and does not authorize a
backtest.

## Governance reconciliation

EVIDENCE:

- Round-005 evidenceStatus is COMPLETE.
- The performance lock is already triggered by the prior authoritative
  Round-005 result.
- The mechanical selection applied no candidate.
- The final decision remains NO BASELINE-002 CANDIDATE — ROUND-005.
- H17 is excluded as DATA_NOT_AVAILABLE because complete decision-time
  funding qualification was not available.

CONSEQUENCE:

- baseline-002 = NOT_FROZEN
- M3-R6-A = DIAGNOSIS_AND_HYPOTHESIS_FREEZE
- M3-R6-B = NOT_STARTED / PENDING_ACCEPTANCE
- M3-J = BLOCKED
- M4 = NOT_STARTED

No Round-006 performance is authorized by R6-A.

## Round-005 candidate diagnosis

The following values are evidence copied from the committed Round-005
summary. They are not tuning targets.

| Candidate | Aggregate improvement | Improved folds | Catastrophic folds | Expectancy R | Profit factor | Additional evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| R5-H15-HTF-TREND | 0.09511918957093035 | 4 | 1 | 0.013052244943178533 | 1.026761107524 | — |
| R5-H16-NEUTRAL-MEAN-REVERSION | -0.21592840552322357 | 0 | 6 | -0.2979953501509754 | 0.541415107745 | — |
| R5-H18-COMPRESSION-EXPANSION | 0.14329629488241583 | 0 | 6 | 0.06122935025466399 | 1.092285092188 | 68 formal signals; minimum fold executed trades = 4 |

EVIDENCE: None of H15, H16, or H18 passed the frozen Round-005 candidate
selection requirements. H17 did not enter performance because its
qualification status was DATA_NOT_AVAILABLE.

RESEARCH INFERENCE: Round-005 does not justify promotion, parameter
selection, threshold adjustment, or a second sweep of any existing candidate.
The next research stage must change the edge architecture and preserve the
same seen-data boundary.

## H15 — HTF low-frequency trend

EVIDENCE: H15 improved four validation folds, but its aggregate improvement,
expectancy, and profit factor remained below the frozen requirements and one
fold was catastrophic.

RESEARCH INFERENCE: The result is a diagnostic observation, not evidence for
changing an H15 lookback, breakout, stop, or holding parameter. H15 must not
be tuned from Round-005 outcomes.

The Round-006 design therefore does not carry H15 forward as a tuned variant.
The structurally different trend-continuation hypothesis is documented
separately in the R6 registry and must not reuse H15 or the retired H8
pullback architecture.

## H16 — Neutral-regime mean reversion

EVIDENCE: H16 improved zero validation folds, had six catastrophic folds,
negative expectancy, and a sub-one profit factor.

RESEARCH INFERENCE: This mean-reversion implementation/family is retired from
Round-006 first-stage research. A future mean-reversion proposal would need a
genuinely different mechanism and an explicit new authorization; R6-A does
not propose one.

## H18 — Compression to expansion

EVIDENCE: H18 had positive aggregate improvement and positive expectancy, but
zero improved validation folds, six catastrophic folds, a profit factor below
the frozen requirement, only 68 formal signals, and a minimum fold sample of
four executed trades.

RESEARCH INFERENCE: The result suggests that large-move or volatility
economics may deserve structural research, but it does not justify tuning
H18 thresholds, expanding its sample after seeing the result, or reusing its
predicate. H18's compression-to-expansion predicate family is retired as a
direct Round-006 first-stage signal identity. Round-006 may research
volatility economics only through R6-H21's structurally different
range-impulse signal-generation mechanism.

## Retired and rejected mechanism families

The following remain retired from the first-stage research set:

- H1 cooldown/redundancy
- H2 cost-proxy filters
- H3 score thresholds
- H4 Top-N
- H6 BTC alignment
- H7 strong symbol regime
- H8 pullback filter
- H9 volume confirmation
- H10 breakout buffer
- C1-C4 combinations
- first-stage tuning of H11-H14
- tuning or threshold changes to H15, H16, or H18 from Round-005 outcomes
- H18 compression-to-expansion predicate family as a direct Round-006
  first-stage signal identity

R6-A introduces no combinations and does not revive a retired family under a
new name. In particular, R6-H20 must not become a recreation of H8, and
R6-H21 must not become H18 compression-to-expansion logic, an H18 predicate
copy, or an H18 signal plus an economic filter.

## R6-A research conclusion

RESEARCH INFERENCE:

Round-006 should examine at most four standalone qualitative mechanisms with
one variant per mechanism. The frozen registry is documented in
docs/BASELINE_002_RESEARCH_R6.md. It is a research-design registry only.

Before any performance can be considered, R6-B must independently freeze
exact formulas, candidate identities, data manifests, decision-time
semantics, no-future-data behavior, entry and settlement semantics,
falsification rules, and a non-weakened machine-readable Gate and Plan.

Until that occurs:

- baseline-002 remains NOT_FROZEN;
- M3-R6-B remains NOT_STARTED / PENDING_ACCEPTANCE;
- M3-J remains BLOCKED;
- M4 remains NOT_STARTED.
