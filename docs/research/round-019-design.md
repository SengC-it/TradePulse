# TradePulse Round-019 — Design-Only Novelty and Provenance Closure

Status: `DESIGN_ONLY`

Accepted research source: `research/round-015-beta-alpha-decomposition` at
`c5abf95b199faa6fc8530fc356c03528aceb5c95`.

Round-019 is a historical design review only. No preflight, performance,
selection, ledger claim, forward-economic inspection, new market-data
acquisition, production change, shadow activation, scheduler activation, or
automatic trading is authorized.

## Decision

The prior active hypothesis
`R19-DIRECTIONAL-CONFLICT-COUNTER-MOVE` is rejected as
`REJECTED_R13_MOMENTUM_FAMILY_OVERLAP`. Its prior-candle direction conflict is
a short-horizon directional price/momentum identity already covered by the
R13 direction-adjusted 1H return/trend/momentum family. An exact formula
difference is not a new mechanism family.

The strict inventory leaves no admissible novel replacement. The frozen
decision is:

`ROUND-019 NO ADMISSIBLE NOVEL HYPOTHESIS`

No weak candidate is created. `activeHypothesis` is `null`, the candidate is
not created, and no candidate-specific input source is authorized.

## Mechanism-family review

The inventory rejects the following before any execution:

- R13 momentum/directional price context: the prior-candle counter-move is
  `REJECTED_R13_MOMENTUM_FAMILY_OVERLAP`.
- R17 lifecycle/state transition: rejected as reuse of thesis-state semantics.
- R14/R15 market-relative alignment: rejected as market-relative/beta-alpha
  reuse.
- Calendar/session state: rejected because accepted R17 explicitly rejected
  `R17-SESSION-BOUNDARY-RETURN` for lack of independently established breadth
  justification. R19 DESIGN_ONLY cannot create the missing evidence.
- Range/expansion context: rejected as R13/R14 price-volatility or R18
  compression/expansion repackaging.

This review also excludes 1H/4H/12H/24H directional-return variants,
candle-body momentum or reversal recodings, EMA/trend/momentum, volatility,
range/compression, volume, taker flow, symbol-vs-BTC movement, funding,
cross-symbol breadth, R15 beta/alpha, R16 microstructure, R17 lifecycle/state
deduplication, R18 component consensus/reweighting, score/grade threshold
changes, regime rescue, horizon rescue, and unqualified calendar/session
selection. No active mechanism family remains that is both economically
credible and independently admissible within the frozen source boundary.

## Frozen control and formal provenance

The exact control remains the complete accepted baseline-001 formal stream:

`candidate?.formalSignal && candidate.totalScore >= 70`

The authoritative runtime filtering path is
`src/lib/backtest/runner.ts`, in `runSinglePeriod`, at the
`formalCandidates` filtering expression. Its accepted-source identity is
bound in `round-019-design.json`:

- Git blob SHA: `dad472de8d2e7e4b0f0a0943b51e257afaec8ac9`
- raw SHA-256: `2f6bc2d733ef081cc2aea4b92165dc80f7f1754f1da1d4d09c03d32cc0ca4208`
- anchors: `formalCandidates` and
  `candidate?.formalSignal && candidate.totalScore >= 70`

The accepted candidate/scoring/engine/constants source blobs remain bound as
well. Tests compare every bound blob and anchor against the accepted commit;
working-tree substitution is not permitted.

The frozen population identity remains the accepted R14-native observation
freeze: five symbols, LONG/SHORT, baseline-001, the existing manifest and
observation-data hashes, and the seen-data boundary
`2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`. Because there is
no active hypothesis, `activeInputSourceProvenance` is explicitly
`NOT_APPLICABLE_NO_ACTIVE_HYPOTHESIS`, with no vague cache reference. Any
future active design would first have to bind a concrete immutable path,
manifest, status, hash, byte/count, symbol, timeframe, coverage, and dataset
identity; network acquisition, backfill, substitution, nearest matching, and
fuzzy matching remain forbidden.

## Frozen validation contracts

The accepted `RESEARCH_FOLDS` F1–F6, 24-hour purge, 24-hour embargo, and
`calculateBTCRegime()` labels remain unchanged. Because this design has no
active hypothesis or candidate, Round-019 structural preflight is permanently
inapplicable: `preflightAuthorized=false`, `round019Executable=false`, and
the G01–G07 definition list is empty. No rejected prior-candle rule or
candidate-breadth rule remains in the executable Round-019 gate configuration.

G08–G15 remain repository-wide future research standards only. They are
`NOT_APPLICABLE_NO_ADMISSIBLE_NOVEL_HYPOTHESIS` for Round-019,
`round019Executable=false`, and `performanceAuthorized=false`; they cannot
trigger Round-019 performance. No thresholds were tuned and no result can
change a definition.

No economic label value is read, calculated, or inspected. The existing
`bt-policy-003` settlement, fees, slippage, funding, and stress semantics are
only referenced as a future contract and are not executed in this task.

## Evidence outputs, ledger, and status

Round-019 performance outputs and selection outputs are `NOT_APPLICABLE`.
Their documented paths are schema references only, not reserved Round-019
generation targets. A Round-019 ledger claim is `FORBIDDEN`; the ledger is
absent and `performanceExecutionCount=0`. The one-shot round-global ledger
rules remain historical governance reference and cannot authorize this
terminated design.

```text
performance                 NOT_AUTHORIZED / NOT_GENERATED
performanceExecutionCount   0
performanceLedgerPresent    false
performanceExecuted         false
selection                   NOT_EXECUTED
selectionExecuted           false
economicValuesRead          false
economicValuesCalculated    false
economicValuesInspected     false
newMarketDataFetched        false
Production                  UNCHANGED
baseline-001                UNCHANGED
baseline-002                NOT_FROZEN
M3-J                        BLOCKED
M4                          NOT_STARTED
automaticTrading            false
```

The machine-readable decision and provenance freeze is
`docs/research/round-019-design.json`; protocol constants and design-only
status validation are in
`src/lib/research/m3-r19-round-019-protocol.ts`.
