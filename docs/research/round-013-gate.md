# Round-013 discovery Gate

The Round-013 Gate is conjunctive across all A–P requirements. It applies to
each of H4, H8, H12, and H24 and determines only whether a horizon is worth
carrying into Round-014. It never promotes baseline-002 or changes Production.

The frozen requirements are selected validation observations (aggregate and
per fold), mean net forward ATR, ATR-based Profit Factor, positive folds,
catastrophic-fold exclusion, positive fold Spearman count, pooled Spearman,
top/bottom decile spread and positive spread folds, 1.5× transaction-cost
stress, 7-minute latency stress, symbol concentration, single-observation
concentration, evidence integrity, and model provenance.

The exact thresholds and Gate SHA are emitted by
`src/lib/research/selection-gates-round-013.ts`. No best-available promotion
is permitted. With no eligible horizon the mechanical result is
`NO ROBUST FORWARD EDGE — ROUND-013`; an eligible horizon is only a
`ROUND-014_DESIGN_INPUT`.
