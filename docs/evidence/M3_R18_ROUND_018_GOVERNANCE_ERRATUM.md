# M3-R18 Round-018 Performance Governance Erratum

This erratum documents governance terminology and claim-stage provenance for the single authoritative Round-018 execution. It does not alter any locked performance artifact or authorize another execution.

## Authoritative execution

- executionId: `r18-d328ac05-868b-4647-b5b3-6039e49dbe39`
- performanceExecutionCount: `1`
- finalDecision: `NO ROBUST COMPONENT-CONSENSUS EDGE — ROUND-018`
- performance rerun: `false`
- new market data fetched: `false`

## Checkpoint counter terminology correction

The locked Audit/Performance report contains the legacy field `recomputedCompletedCheckpoints=6`. For this execution, those six checkpoints were the first calculations of missing F1-F6 fold checkpoints; they were not recomputations of completed checkpoints.

The corrected interpretation is:

- `newlyComputedFoldCheckpoints: 6`
- `reusedCompletedCheckpoints: 0`
- `completedCheckpointRecomputations: 0`
- `completedCheckpointRuleViolated: false`

The legacy field name `recomputedCompletedCheckpoints` means `newlyComputedFoldCheckpoints` for this execution. The original locked field is intentionally not rewritten.

## Claim-commit executable deviation

- implementation commit: `862c17209f5bf5fe65ef295f07f98f77e9c61254`
- ledger claim commit: `3cb742d910f5782ea3cdaccd93e922762571c2ac`
- observed claim-stage files:
  - `docs/research/round-018-performance-ledger.json`
  - `scripts/m3-r18-performance.ts`
- executable change: `verifyExecutionCheckout()` and its invocation only
- `claimCommitLedgerOnlyRequirementConformed=false`
- `claimStageEconomicLogicChanged=false`
- `claimStageGateLogicChanged=false`
- `claimStageSelectorChanged=false`
- `claimStageInputIdentityChanged=false`

The checkout guard did not change the performance implementation, metric functions, profit-factor or drawdown calculations, economic join, selector, G08-G15, checkpoint-writer semantics, input hashes, or executionId. This is a disclosed governance deviation, not a performance rerun.

## Locked artifact integrity

The five published economic/selection artifacts, all F1-F6 checkpoints, and the final performance checkpoint remain byte-identical. Their current SHA-256 values are recorded in the companion JSON erratum and are regression-tested. The ledger's locked result, summary, audit, and selection hashes remain unchanged.
