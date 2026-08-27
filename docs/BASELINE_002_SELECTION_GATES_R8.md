# Baseline-002 Round-008 selection gates

Round-008 inherits the exact Round-007 selection Gate and does not weaken or
retune any threshold. The canonical Gate SHA is emitted by
`src/lib/research/selection-gates-round-007.ts` and is recorded in the R8
machine record and generated evidence.

Inherited Gate SHA-256: `d17741dbe39f10e26947fdb8e7d759e4537a6c1b07738a1c71437a7f2ec063ca`.

The applicable numeric requirements include aggregate improvement `>= 0.10R`,
aggregate expectancy `>= 0.03R`, profit factor `>= 1.20`, at least four
improved and four positive validation folds, zero catastrophic folds, at least
300 formal signals, at least 30 executed trades in each validation fold,
symbol concentration `<= 0.50`, single-trade concentration `<= 0.10`, and the
unchanged fee/model-integrity gates.

`PERIOD_END_CENSORED` is formal and non-executed and is excluded from executed
metrics without invalidating otherwise complete evidence. Data incompleteness
or settlement ambiguity fails the applicable evidence closed.

Zero eligible candidates produces `NO BASELINE-002 CANDIDATE — ROUND-008`.
Selection, if applicable, is classification only; it never deploys production
or enables automatic trading.
