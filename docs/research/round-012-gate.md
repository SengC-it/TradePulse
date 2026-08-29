# Round-012 selection Gate

Eligibility is conjunctive and has no best-available promotion. A candidate
must satisfy all of the following on the frozen validation aggregate:

- at least 300 executed trades and at least 30 executed trades in every fold;
- net expectancy at least `+0.03 R/trade` and profit factor at least `1.20`;
- expectancy improvement over CONTROL at least `+0.10 R/trade`;
- at least four improved folds (candidate minus CONTROL at least `+0.02 R`)
  and four positive-expectancy folds;
- zero catastrophic folds under the existing definition;
- at least 20% improvement in maximum drawdown magnitude;
- maximum symbol concentration at most `0.50` and maximum single positive
  trade contribution at most `0.10`;
- evidence and integrity `COMPLETE`.

If both candidates are eligible, selection compares higher aggregate
expectancy, then uses the inclusive `0.01 R/trade` tie band with lower
drawdown magnitude, higher PF, fewer formal signals, and candidate ID as the
deterministic tie-breaks. Cohort and volume reports are diagnostic and do not
change these gates.
