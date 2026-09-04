# TradePulse Round-019 — Design-Only Research Freeze

Status: `DESIGN_ONLY`

Accepted research source: `research/round-015-beta-alpha-decomposition` at
`c5abf95b199faa6fc8530fc356c03528aceb5c95`.

Round-019 is a historical development study. It is not an authorization to
run performance, selection, production scanning, shadow activation, or
automatic trading.

## Product and research boundaries

TradePulse remains signal-advisory-only. Private Binance APIs, order
placement, account execution, leverage, sizing, and automatic trading remain
absent. Production, baseline-001, and the accepted research-chain source are
unchanged. The historical boundary is the existing seen-data boundary:
`2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`, with UTC epoch
millisecond arithmetic only.

Round-019 design work may inspect prior evidence metadata and accepted source
provenance. It does not read or calculate economic values, inspect forward
returns, acquire new market data, or create a performance ledger.

## R13–R18 evidence review

| Round | Evidence interpretation | Round-019 handling |
| --- | --- | --- |
| R13 | The frozen feature-family forward-edge study is negative evidence about that model family and its robustness/cost requirements. | Do not reuse the R13 feature family or wrap it in a new label. |
| R14 | The exact replay preserves the same formal source and settlement protocol; it is not a new signal architecture. | Use only the accepted native population and label/provenance contract. |
| R15 | The beta/alpha decomposition did not establish an admissible candidate; model and robustness requirements remain unresolved. | Do not carry forward beta models, alpha features, or their tuning space. |
| R16 | The derivatives microstructure study is negative evidence with recorded information-coverage limitations; it did not authorize a microstructure carry-forward. | `OPEN_INTEREST`, `MARK_INDEX_BASIS`, and `TAKER_FLOW_PERSISTENCE` are explicitly excluded. |
| R17 | The study terminated as data-ineligible, so it is not an economic result. | Do not reuse thesis lifetime, first/follow-up, or lifecycle classification. |
| R18 | The component-consensus study is negative economic evidence for that selector family. | Do not retest component counts, score/grade thresholds, weights, or compression/expansion repackaging. |

The review distinguishes information insufficiency from model/edge failure,
stability, breadth, and transaction-cost concerns. R17 is the data-completeness
case; the completed negative studies are not converted into a positive claim
or a reason to tune a prior model.

## Hypothesis inventory and decision

Five structurally distinct families were considered. Exactly one is active;
the other four are rejected before any preflight or performance work.

| ID | Mechanism family | Status | Reason |
| --- | --- | --- | --- |
| `R19-DIRECTIONAL-CONFLICT-COUNTER-MOVE` | `DIRECTIONAL_EVIDENCE_CONFLICT_AT_ENTRY` | `ACTIVE` | A decision-time event-context test that is independent of prior round model families. |
| `R19-STATE-TRANSITION-UPDATE` | `DECISION_TIME_FORMAL_STATE_TRANSITION` | `REJECTED_R17_OVERLAP` | Reuses the R17 lifecycle/state-transition problem. |
| `R19-MARKET-RELATIVE-CONFIRMATION` | `EXISTING_BTC_REGIME_ALIGNMENT` | `REJECTED_R14_R15_OVERLAP` | Reuses broad regime/beta alignment rather than a distinct event mechanism. |
| `R19-SESSION-BOUNDARY-STATE` | `UTC_CALENDAR_SESSION_STATE` | `REJECTED_R17_BREADTH_RISK` | Calendar partitioning has no admissible breadth case without result-dependent selection. |
| `R19-RANGE-EXPANSION-CONTEXT` | `CLOSED_CANDLE_RANGE_EXPANSION` | `REJECTED_R13_R14_R18_OVERLAP` | It would repackage the prior feature/expansion/component families. |

The sole active research question is:

> Within the exact baseline-001 formal stream, does a signal preceded by an
> opposite-direction immediately prior closed 1H candle have incremental H4
> net edge versus all formal controls?

### Active candidate rule

The control is the complete exact baseline-001 formal stream from the native
accepted R14 universe. The candidate retains one of those control events only
when the immediately preceding fully closed 1H candle has the opposite body
direction:

```text
CONTROL && ((direction === LONG && priorClosed1h.close < priorClosed1h.open) ||
            (direction === SHORT && priorClosed1h.close > priorClosed1h.open))
```

The prior candle must satisfy the exact identity
`priorClosed1h.closeTime === signalTime - 1_HOUR_MS` and
`priorClosed1h.openTime === priorClosed1h.closeTime - 1_HOUR_MS + 1`.
Doji candles are not candidates. Missing, duplicate, malformed, ambiguous, or
non-exact candle provenance fails closed. No score component, grade, total
score threshold, lifecycle state, microstructure field, compression/range
threshold, economic filter, future label, parameter, sweep, optimizer, or
fallback classification is allowed.

This is a counter-direction event-context mechanism. It is not R13 feature
modeling, R14 replay logic, R15 beta/alpha decomposition, R16 derivatives
microstructure, R17 thesis deduplication, or R18 score-component consensus.

## Frozen population and provenance

- Population: the exact accepted R14-native baseline-001 observation universe.
- Control: every baseline-001 formal event in that population, using the
  accepted formal predicate `candidate?.formalSignal && candidate.totalScore >= 70`.
- Candidate: the single active rule above; all baseline symbols and both
  directions remain in scope.
- Strategy version: `baseline-001`.
- Primary horizon and label semantics: the existing R14-native H4 label under
  unchanged `bt-policy-003`.
- Decision-time inputs are only formal-event identity and the exact prior
  closed candle body identity/open/close.
- Existing accepted cache identity is required. Network acquisition,
  reconstructed labels, nearest/fuzzy timestamps, and subset repair are
  forbidden.

The source blobs for the formal predicate, frozen folds, regime function,
baseline constants, and accepted data/manifest are bound by the hashes in
`round-019-design.json`. The working tree cannot substitute for those accepted
source identities.

## Frozen validation protocol

The existing `RESEARCH_FOLDS` F1–F6 are reused byte-for-byte from the accepted
source. Their validation method is purged walk-forward with a fixed 24-hour
purge and 24-hour embargo; fold boundaries may not be redefined. BTC regime
labels are the accepted `calculateBTCRegime()` labels
`BTC_STRONG_BULL`, `BTC_NEUTRAL`, and `BTC_STRONG_BEAR`, used only for fixed
reporting/breadth stratification. Regime thresholds cannot change after the
freeze.

The structural gates are frozen before any result exists:

- `G01_DATA_PROVENANCE`: exact population, formal source, and prior-candle
  identity/provenance are complete and unambiguous.
- `G02_POINT_IN_TIME`: only the signal event and its exact preceding closed
  1H candle are eligible.
- `G03_AGGREGATE_BREADTH`: at least 500 economically eligible H4 label-status
  records in the candidate cohort.
- `G04_FOLD_BREADTH`: at least 50 eligible H4 records in each F1–F6
  validation fold.
- `G05_SYMBOL_BREADTH`: at least 20 candidate events for every frozen symbol.
- `G06_REGIME_BREADTH`: at least 50 candidate events in every frozen BTC
  regime stratum.
- `G07_STRUCTURAL_DISCRIMINATION`: candidate count is strictly greater than
  zero and strictly less than control count.

G08–G15 are also frozen before performance: absolute H4 edge, profit factor,
incremental edge, fold robustness, cost stress, latency stress, and drawdown
non-degradation. They are not evaluated during design, and no future result
may change their definitions.

## Metrics and settlement contract

The design freezes the existing H4 target and reporting metric names only.
No economic metric is calculated, read, or inspected in this phase. Future
performance, if separately authorized, must use the existing settlement,
fees, slippage, funding, and latency treatment. H8/H12/H24 remain reporting
only and cannot become a selection basis.

## One-shot execution governance

The future performance execution is governed by a round-global first-result
lock with at most one authoritative execution. Its ledger is
`docs/research/round-019-performance-ledger.json` and must remain absent in
this design phase. Any future execution count must be derived from that
ledger, not supplied by a caller. An alternate execution directory is
forbidden; crash continuation requires the original ledger execution ID and
frozen execution directory. Completed checkpoints must be reused, never
recomputed; missing or corrupt completed checkpoints abort. Selection cannot
be rerun, and evidence publication must use the existing final-marker rule.

No Round-019 performance, selection, ledger claim, preflight, economic
evaluation, or evidence output is authorized by this document.

## Frozen status

```text
performance                 NOT_AUTHORIZED / NOT_GENERATED
performanceExecutionCount   0
performanceLedgerPresent    false
selection                   NOT_EXECUTED
Production                  UNCHANGED
baseline-001                UNCHANGED
baseline-002                NOT_FROZEN
M3-J                        BLOCKED
M4                          NOT_STARTED
automaticTrading            false
```

The machine-readable freeze is `docs/research/round-019-design.json`; the
design-only protocol helpers are in
`src/lib/research/m3-r19-round-019-protocol.ts`. Reserved performance and
selection outputs are intentionally absent.
