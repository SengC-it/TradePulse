# baseline-002 Research Round-004 Diagnosis

Status: M3-R4-A documentation-only diagnosis and structural-hypothesis freeze

Authoritative base: `main` at
`0f994ddde6d3303eb34560cdc1c8babbae5115a5`

Research round: `baseline-002-research-round-004`

## Scope and evidence boundary

This document reconciles the completed Round-003 governance result and records
the diagnosis that motivates Round-004. It does not implement, select, or
measure a Round-004 hypothesis.

Only the following committed artifacts were used. The hashes are raw
SHA-256 values of the files at the R4-A source:

| Evidence artifact | Role | Raw SHA-256 |
| --- | --- | --- |
| `docs/evidence/M3_H_ROUND_001_SUMMARY.json` | Round-001 CONTROL and 13 candidate performance records | `883001ac34470120cdbc754c2f47437bf13b6f13ce6ffb3e4f7795558a6a2fc7` |
| `docs/evidence/M3_I_ROUND_001_SELECTION.json` | Round-001 frozen-gate application | `f0eee7a85fa327a058942f5af86b3119c5c0dac5e2b5e7a9c8e04ec9c1f64a37` |
| `docs/M3_R2_C_INVALIDATION.md` | Round-002 invalidation and governance record | `ffc507ac26ce50f6852160e2b2b9cc2e4f3bc0c9a08c2bdeb9dab341dbfdd8d2` |
| `docs/evidence/M3_R3_ROUND_003_SUMMARY.json` | Round-003 CONTROL and 9 candidate performance records | `6b86ef4ef8bb9bbf8c0047b57d4322fc61f843cad6c9fdd55ab513e00b6d8d69` |
| `docs/evidence/M3_R3_C_SELECTION.json` | Round-003 frozen-gate application | `8efb765df782218b47962fa1e0328b3bb998a7fb9473206963a67a58822f32dd` |

The research data boundary remains all data through
`2026-08-15T23:59:59.999Z`. It is classified as
`RESEARCH_AVAILABLE_SEEN_DATA`, not true forward OOS. No network request,
new candle, historical download, backtest, or result recalculation was used
for this diagnosis.

## Governance reconciliation

**EVIDENCE:** Round-001 selection has `integrityStatus = COMPLETE`,
`finalDecision = NO BASELINE-002 CANDIDATE`, and 13 candidates marked
`INELIGIBLE`.

**EVIDENCE:** Round-003 selection has `integrityStatus = COMPLETE`,
`performanceEvidenceStatus = COMPLETE`,
`finalDecision = NO BASELINE-002 CANDIDATE — ROUND-003`, and all 9 candidates
marked `INELIGIBLE`. Each candidate fails the six core gates:

- `minimumAggregateImprovement`
- `minimumImprovedValidationFolds`
- `catastrophicFoldLimit`
- `minimumNetExpectancy`
- `minimumProfitFactor`
- `maximumFeeBurdenRatio`

The Round-003 selection is therefore final evidence for a no-candidate
outcome. `baseline-002` remains `NOT FROZEN`; M3-J remains `BLOCKED`; M4
remains `NOT STARTED`.

Round-002 candidate performance is explicitly excluded. Its CONTROL and
capture artifacts are `INVALIDATED_ROUND_CAPTURE_ARTIFACTS` because the
evidence pipeline defects were discovered after performance generation. The
Round-002 record may inform governance/tooling lessons only; it is not a
measured strategy result and must not be used to infer candidate performance.

## Diagnosis labels

The following distinction is mandatory:

- **EVIDENCE** means a statement directly supported by the immutable files
  listed above.
- **RESEARCH INFERENCE** means a forward-looking interpretation of those
  observations. It is not a measured performance claim.

## D1 — Current entry family has insufficient edge

**EVIDENCE:** Round-001 produced no eligible candidate. Round-003 produced
no eligible candidate, and all 9 candidates failed aggregate improvement,
net expectancy, profit factor, and fee-burden gates in addition to the
robustness gates.

**EVIDENCE:** The best Round-003 aggregate improvement is
`+0.008891748042141392 R / executed trade` for `R2-C1-BTC-STRONG-SYMBOL`.
The frozen minimum is `+0.10 R / executed trade`.

**RESEARCH INFERENCE:** The baseline-001 signal family and its tested
filtering variants have not demonstrated sufficient economic edge. Round-004
must not assume that another threshold on the same entry family will recover
the required improvement.

## D2 — Filter-only search space is exhausted

The following tested families are retired from the first Round-004
performance stage. Retirement means that their evidence is preserved for
audit, but Round-004 must not recreate them, threshold-sweep them, or use
them as additional baseline-001 filters.

| Tested family | Committed variants / scope | Round-004 disposition |
| --- | --- | --- |
| H1 `SIGNAL_REDUNDANCY` | cooldown 6h, 12h, 24h | Retired; no cooldown sweep |
| H2 `COST_ADJUSTED_EDGE` | decision-time friction proxy variants (`R3-H2-COST-010/015/020/025`) | Retired; no cost-proxy sweep |
| H3 `SCORE_CALIBRATION` | minimum score 75, 80, 85 | Retired; no score threshold sweep |
| H4 `SIGNAL_DENSITY` | Top-N 1, 2, 3 | Retired; no Top-N search |
| H6 `STRICT_BTC_ALIGNMENT` | strict BTC alignment | Retired; no regime-threshold recreation |
| H7 `STRONG_SYMBOL_REGIME` | strong symbol regime | Retired; no regime-filter recreation |
| H8 `RECENT_PULLBACK` | recent pullback filter | Retired; no pullback-filter recreation |
| H9 `VOLUME_CONFIRMATION` | volume confirmation | Retired; no volume-filter recreation |
| H10 `BREAKOUT_BUFFER` | breakout buffer | Retired; no breakout-buffer recreation |
| C1–C4 combinations | frozen H6–H10 combinations: BTC-strong-symbol, strong-symbol/recent-pullback, strong-symbol/volume-breakout, and BTC-strong-symbol/volume-breakout | Retired; no combinations in the first Round-004 stage |

**RESEARCH INFERENCE:** The completed registry and the two valid
Round-001/Round-003 selection records cover the tested filter/density/cost/
score/regime/pullback/volume/breakout-buffer space relevant to this decision.
Continuing only by adding more thresholds would repeat the invalidated search
shape rather than test a structural change.

## D3 — Fold robustness is a core failure

**EVIDENCE:** Round-003 candidates show only `0–2` improved validation folds
under the frozen definition, while the gate requires `>= 4 / 6`. Every
candidate has at least one catastrophic validation fold, and some candidates
have three or four.

**RESEARCH INFERENCE:** Performance instability across time is structural,
not merely an aggregate-metric problem. Every Round-004 hypothesis must be
judged on cross-fold robustness, not aggregate return alone.

## D4 — Fees are an amplifier, not the only root cause

**EVIDENCE:** Every Round-003 candidate fails `maximumFeeBurdenRatio`, and
also fails `minimumNetExpectancy`, `minimumProfitFactor`, and
`minimumAggregateImprovement`.

**RESEARCH INFERENCE:** The evidence does not support manufacturing a pass by
lowering fee assumptions, lowering slippage, removing funding, or weakening
cost gates. The frozen conservative economics remain unchanged; the primary
problem is insufficient edge.

## D5 — Sample size and concentration are not the bottleneck

**EVIDENCE:** All Round-003 candidates pass the frozen
`maximumSymbolConcentration`, `maximumSingleTradeConcentration`,
`minimumFormalSignals`, and `minimumExecutedTrades` gates.

**RESEARCH INFERENCE:** Round-004 should focus on economic edge and robustness,
not on producing more signals, enlarging the sample, or optimizing symbol or
single-trade concentration.

## Round-004 implication

**RESEARCH INFERENCE:** Round-004 must test structurally different strategy
behavior, not continue incremental filtering of the baseline-001 entry
family. The qualitative hypotheses are frozen separately in
`docs/BASELINE_002_RESEARCH_R4.md`. Exact formulas, execution semantics,
complexity tuples, data requirements, and a machine-readable gate/plan record
are deferred to M3-R4-B.

No R4-A document authorizes historical performance. `baseline-002` is not
frozen, M3-R4-B is not authorized, M3-J is blocked, and M4 is not started.
