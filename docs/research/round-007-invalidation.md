# Round-007 invalidation record

Round-007 (`baseline-002-research-round-007`) is marked
`INVALIDATED_NON_AUTHORITATIVE` after its single locked execution.

- Execution source: `04d75215987c28822a4de9c1be30e41838a1adea`
- Performance lock: `FIRST_M3_R7_PERFORMANCE_RESULT_GENERATED` (`true`)
- Classification: `INVALIDATED_AFTER_PERFORMANCE_LOCK`
- Abort stage: evidence-completeness classification after CONTROL execution
- Root cause: the framework used the economic `controlReport.status` as the
  evidence-completeness decision. CONTROL was economically `FAIL`, while its
  data was structurally complete: 7,500 formal signals, 7,495 executed trades,
  5 `PERIOD_END_CENSORED`, 0 `DATA_INCOMPLETE`, and 0
  `SETTLEMENT_AMBIGUOUS`.

The five generated Round-007 outputs remain byte-for-byte unchanged and are
not authoritative. Their exact sizes and SHA-256 values are recorded in
`round-007-invalidation.json`; the artifacts are not copied or rewritten into
Round-008. Round-007 values are not used to tune Round-008
(`round007ResultsUsedForRound008Tuning=false`).

Boundary state remains:

- `baseline-002`: `NOT_FROZEN`
- `M3-J`: `BLOCKED`
- `M4`: `NOT_STARTED`
