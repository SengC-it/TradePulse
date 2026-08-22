# TradePulse M3-R6-B.1B — Round-006 Final Registry, Gate, and Plan Freeze

Status: FROZEN / PERFORMANCE NOT AUTHORIZED

## Authoritative source and protocol identity

This freeze starts from the post-merge B.1A main source:

b8e03e34360ceaaf515882226940eba99bf89b1c

The accepted B.1A protocol identity is preserved byte-for-byte:

- src/lib/research/m3-r6-round-006-protocol.ts
  - Git blob: 11190e1c857071756cd26c744ac726650b64a01c
- docs/M3_R6_B1A_PROTOCOL.md
  - Git blob: ff15bae2cf393e70a7ecd07f4acd5e819e97876c
- tests/m3-r6-b1a-protocol.test.ts
  - Git blob: 870d4eda92f1ba07d44e48d6d268e5e87acda7a5

The B.1A protocol version is m3-r6-b1a-protocol-001. Its required windows,
immediate canonical next-open rule, H22 route map, stop geometry, and
complexity tuples are inputs to this freeze and are not reinterpreted here.

## Final Round-006 candidate registry

Exactly these four standalone candidates are frozen, with exactly one
variant (V1) each:

| Candidate | Variant | Mechanism family | Complexity tuple |
| --- | --- | --- | --- |
| R6-H19-CROSS-SECTIONAL-RELATIVE-STRENGTH | R6-H19-V1 | CROSS_SECTIONAL_RELATIVE_STRENGTH | (6, 0, 0, 1) |
| R6-H20-STRUCTURAL-TREND-CONTINUATION | R6-H20-V1 | STRUCTURAL_TREND_CONTINUATION | (8, 0, 0, 1) |
| R6-H21-ECONOMIC-RANGE-IMPULSE | R6-H21-V1 | ECONOMIC_RANGE_IMPULSE | (5, 2, 0, 1) |
| R6-H22-PREDECLARED-REGIME-ROUTING | R6-H22-V1 | PREDECLARED_REGIME_ROUTING | (7, 0, 0, 1) |

No combinations, replacement candidates, post-result variants, or routing
between candidates are permitted.

## Round-006 machine Gate

The canonical Gate is serialized by
src/lib/research/selection-gates-round-006.ts.

- Gate SHA-256:
  ff51cdc587f5a79cc9dd8d449202e481f4d2eed23e7f843797b8348b8cebe1f6
- inherited Round-005 Gate SHA-256:
  e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5
- inherited Round-004 Gate SHA-256:
  c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54

Round-005 numeric values and comparison directions are inherited unchanged:

| Gate | Frozen value |
| --- | --- |
| minimumAggregateImprovement | 0.1 R/executed-trade, at least |
| minimumImprovedValidationFolds | 4 folds, at least |
| catastrophicFoldLimit | 0 folds, at most |
| minimumNetExpectancy | 0.03 R/executed-trade, at least |
| minimumProfitFactor | 1.2, at least |
| maximumSymbolConcentration | 0.5, at most |
| maximumSingleTradeConcentration | 0.1, at most |
| maximumFeeBurdenRatio | 0.75, at most |
| minimumFormalSignals | 300, at least |
| minimumExecutedTrades | 30, at least |

requiredRedundancyImprovement remains present in the hard-gate identity
registry but is NOT_APPLICABLE for every Round-006 candidate and is
excluded from the conjunction rather than converted to a passing value.
There are exactly ten applicable gates. All eleven registered identities are
reported for every candidate, with no early eligibility exit.

DATA_INCOMPLETE is incomplete evidence and ineligible. ENTRY_UNAVAILABLE,
INVALID_STOP_GEOMETRY, and PERIOD_END_CENSORED are non-executed and
ineligible. NO_SIGNAL is not a formal candidate result and is excluded from
candidate metrics. Zero-trade and insufficient-sample folds are
catastrophic and fail the sample floors.

The accepted fold improvement, catastrophic-fold, aggregate F1–F6,
profit-factor, concentration, and fee-burden definitions are preserved.

## Canonical Round-006 Plan

The immutable Plan is serialized by src/lib/research/m3-r6-round-006-plan.ts.

- Plan SHA-256:
  0e9521e373764c8e9389326f84d25172693b3e3a0894e9829183bb0c7a96a591
- research round:
  baseline-002-research-round-006
- data classification:
  RESEARCH_AVAILABLE_SEEN_DATA
- research range:
  2023-01-01T00:00:00.000Z through 2026-08-15T23:59:59.999Z
- symbols:
  BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT
- folds: exact existing F1–F6
- CONTROL:
  R6-CONTROL-BASELINE-001
- strategy version: baseline-001
- backtest policy: bt-policy-003

The Plan binds the accepted B.1A protocol identity, the exact registry and
Gate SHA, official funding with the frozen mark-price fallback,
5 bps fee/slippage semantics, SL-first settlement, exactly 24 held candles,
TIME_EXIT at held candle #24 close, exact 2R, immediate canonical next-open
entry, invalid stop-geometry handling, formal identity
symbol|direction|signalTime, and deterministic output serialization.

The machine-readable metric/status contract binds the formal population and
the meaning of EXECUTED, DATA_INCOMPLETE, ENTRY_UNAVAILABLE,
INVALID_STOP_GEOMETRY, and PERIOD_END_CENSORED. Only formal evaluator signals
create records; NO_SIGNAL creates no formal record. It freezes formal signal
counts, executed-trade counts, net expectancy, PF status (including
NO_TRADES/NO_LOSSES and no Infinity encoding), fee burden, positive-net-R
concentration, aggregate improvement versus CONTROL, improved validation-fold
count, catastrophic-fold count, and the minimum executed-trade floor across
F1–F6. Finite-number rejection, negative-zero normalization, 12-decimal
metric rounding, null missing values, fold/symbol/direction ordering, and
UTF-8 `stableStringify` serialization without a trailing newline are all
explicit. The diagnostics and serializer implementation identities are bound
to their accepted-base Git blobs in the Plan.

## Selection and authorization

Eligibility is evaluated first and all applicable gates must pass. With zero
eligible candidates the result is exactly NO ROUND-006 CANDIDATE. With one
eligible candidate it is selected. With multiple eligible candidates the
predeclared hierarchy is:

1. more improved validation folds;
2. retain only candidates whose aggregate validation expectancy is within the
   inclusive 0.01 R/executed-trade band below the cohort maximum;
3. lexicographically smaller complexity tuple;
4. higher aggregate validation profit factor, with finite values before null;
5. ascending candidate ID.

The eligible-candidate list is serialized separately in ascending candidate-ID
order. The staged procedure is eligibility filter, maximum improved folds,
maximum-expectancy inclusive tie-band filter, complexity tuple, PF, and final
candidate-ID order; it is not a pairwise comparator. The machine record keeps
the accepted Round-005 Gate SHA `e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5`
separate from the inherited Round-004 ancestry SHA
`c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54`.

The future execution source SHA is deliberately NOT predeclared. The later
authorized runtime must separately provide and cross-check
`executionSourceSha === authorizedExecutionSourceSha === git HEAD`, a clean
worktree, passing required-manifest validation, absence of all authoritative
outputs, and the B.1A protocol identity, registry, Gate SHA, Plan SHA, universe,
folds, policy, and research boundary before any network access.

The performance lock is
FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED. After the first result, any
result-affecting change requires ROUND_006_INVALIDATION_REQUIRED; no
same-round patch-and-rerun is allowed.

## Milestone boundary

- performance: NOT AUTHORIZED / NOT GENERATED
- selection: NOT EXECUTED
- baseline-002: NOT_FROZEN
- M3-J: BLOCKED
- M4: NOT_STARTED

This B.1B freeze uses synthetic/offline validation only. It does not access
Binance, load historical data, inspect forward data, run CONTROL,
performance, backtest, optimizer, sweep, or candidate selection.
