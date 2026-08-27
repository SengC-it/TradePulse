# Baseline-002 Round-008 research replay

Round-008 is a strict protocol replay of the invalidated Round-007 study.
It exists to correct the framework's evidence-completeness classification;
it is not a parameter-search round and does not use Round-007 result values
for tuning.

- Research round: `baseline-002-research-round-008`
- Replay source: `04d75215987c28822a4de9c1be30e41838a1adea`
- Seen-data boundary: `2026-08-15T23:59:59.999Z`
- Classification: `STRICT_PROTOCOL_REPLAY_AFTER_FRAMEWORK_INVALIDATION`
- Candidate count: five, exactly the frozen R7 registry
- `RESULT_AFFECTING_SPEC_DIFF_COUNT`: `0`
- `baseline-002`: `NOT_FROZEN`
- `M3-J`: `BLOCKED`
- `M4`: `NOT_STARTED`

Round-007 remains `INVALIDATED_NON_AUTHORITATIVE`; see
`docs/research/round-007-invalidation.json`. Its artifacts are not copied or
rewritten. Round-008 reuses only validated cache content when identity,
checksum, range, and schema are compatible.

The product boundary remains signal advisory only. Public Binance research
data is permitted; private Binance APIs, automatic execution, and production
trading are not.
