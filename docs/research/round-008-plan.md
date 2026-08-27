# Round-008 protocol replay plan

This is the machine-frozen plan for `baseline-002-research-round-008`.
Round-007 definitions, folds, features, router buckets, candidate registry,
model contract, settlement economics, and selection hierarchy are replayed
without result-affecting changes. The plan validator requires
`RESULT_AFFECTING_SPEC_DIFF_COUNT = 0`.

Canonical Plan SHA-256:
`1c58382b1d09846dc04728e7f46ab4b7a8771bee9a5228d48ddb983fa8b91812`.
The inherited Gate SHA-256 is
`d17741dbe39f10e26947fdb8e7d759e4537a6c1b07738a1c71437a7f2ec063ca`.

The only framework correction is the evidence lifecycle: economic performance
status is not evidence completeness. A structurally complete but economically
failing CONTROL remains eligible to continue the candidate stage; candidates
that fail gates are `INELIGIBLE`, not `INCOMPLETE`.

Performance is `NOT_AUTHORIZED` and `NOT_GENERATED` until the preflight checks,
synthetic lifecycle contract, offline validation, cache validation, and dataset
freeze all pass. After the lock, the one CONTROL plus five replay candidates
execute once and no post-lock fetch or rerun is permitted.
