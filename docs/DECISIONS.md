# Architecture Decisions

Status: M3-A backtest specification decision record (M0-M2-B decisions retained)

## ADR-001 — Use Next.js App Router on Vercel

- **Decision:** Use Next.js App Router, TypeScript, React, Route Handlers, and Vercel Node.js Functions.
- **Reason:** It matches the frozen product stack and supports a private dashboard plus finite server-side jobs.
- **Consequence:** Route Handlers must remain bounded; SMTP-capable code is explicitly Node.js runtime.

## ADR-002 — Use Supabase Cron as the hourly scheduler

- **Decision:** Supabase Cron calls the protected Vercel scan endpoint near `5 * * * *`.
- **Reason:** Supabase owns the database, cron history, and operational persistence; it avoids treating a serverless function as a resident worker.
- **Consequence:** The endpoint needs a server-only `CRON_SECRET` and must finish one bounded scan per request.

## ADR-003 — Keep Binance behind a public-data adapter

- **Decision:** Future market data enters through `MarketDataProvider`; Binance is an adapter implementation.
- **Reason:** Tests, mocks, backtests, and future data sources must not leak provider details into domain logic.
- **Consequence:** The Strategy Engine cannot import Binance URLs or HTTP clients.

## ADR-004 — One Strategy Engine for realtime and backtest

- **Decision:** Realtime Scanner and Backtest Runner both call the same framework-independent Strategy Engine.
- **Reason:** Separate implementations drift and invalidate performance claims.
- **Consequence:** Strategy inputs and outputs must be serializable, deterministic, and independent of infrastructure.

## ADR-005 — Private dashboard with Supabase Auth and RLS

- **Decision:** Dashboard pages require an authenticated Supabase session; database tables use RLS.
- **Reason:** Signal history, notification recipients, decisions, and operational events are private.
- **Consequence:** Publishable keys may reach the browser, but secret/service-level keys never do. Authenticated role checks still require row-ownership predicates where ownership exists.

## ADR-006 — No private Binance integration in M0–M8

- **Decision:** The current product discovers and reminds; it does not trade.
- **Reason:** Manual user decision is an explicit product boundary and reduces irreversible financial risk.
- **Consequence:** The schema contains no orders, fills, or positions, and the application requests no private credentials.

## ADR-007 — Version strategy behavior from day one

- **Decision:** Every signal stores an explicit `strategy_version`; the first proposed version is `baseline-001`.
- **Reason:** Git commits alone do not identify the behavior that produced a historical signal.
- **Consequence:** Any approved strategy change creates a new version and preserves historical snapshots.

## ADR-008 — Migration-first database changes

- **Decision:** Schema is committed under `supabase/migrations/`; M0 does not apply it to an unknown remote project.
- **Reason:** A reproducible, reviewable schema is safer than manual Dashboard-only changes.
- **Consequence:** Remote application requires an explicitly identified development or production project and a separate review.

## ADR-009 — Conservative notification safe mode

- **Decision:** A/B notifications are enabled by policy; C is disabled by default, and Preview is safe mode.
- **Reason:** A preview or incomplete environment must not send production alerts accidentally.
- **Consequence:** Notification policy is centralized and audited, not a user-editable strategy parameter.

## ADR-010 — REST over WebSocket for current TradePulse

- **Decision:** M1 uses Binance USDⓈ-M Futures public REST endpoints for server time, ExchangeInfo, and 1h/4h Kline snapshots. It does not implement WebSocket or a long-lived stream consumer.
- **Reason:** TradePulse currently consumes closed hourly and four-hour candles from a finite serverless request. REST is simpler, deterministic, bounded, and compatible with the current Vercel architecture.
- **Consequence:** Each snapshot requests a bounded recent history and fails closed on bad or stale data. A future need for second-level data must trigger a new architecture review before WebSocket work begins.

## ADR-011 — Freeze baseline-001 strategy specification

- **Decision:** M2-A freezes the complete baseline-001 strategy specification:
  indicator formulas, 4H symbol regimes, BTC regime and directional gating,
  1H candidate rules, entry/stop/TP references, score components, grades, and
  deterministic ranking.
- **Reason:** The Strategy Engine must implement an approved, reproducible
  contract rather than turn M0 recommendations into undocumented behavior.
- **Consequence:** baseline-001 is the only strategy version implemented by
  the future M2 engine. Any behavior change requires a reviewed Strategy
  Change and a new strategy version. M2-A itself contains documentation only.

## ADR-012 — Closed-candle indicator conventions

- **Decision:** EMA20/50/200 use standard EMA with alpha = 2 / (period + 1)
  and an SMA seed. RSI14 uses Wilder RSI with a 14-delta SMA seed and
  explicit zero-gain/zero-loss edge values. ATR14 uses the specified true
  range, a 14-TR SMA seed, and Wilder smoothing.
- **Reason:** Indicator seed and edge behavior materially changes candidate
  outputs and must be deterministic.
- **Consequence:** No forming candle may enter an indicator, candidate, score,
  or reference value. The M1 MarketDataProvider supplies the normalized
  closed-candle input and its approved freshness/gap policy.

## ADR-013 — BTC regime is an eligibility gate

- **Decision:** BTCUSDT 4H determines BTC_STRONG_BULL, BTC_STRONG_BEAR, or
  BTC_NEUTRAL using the frozen EMA/ATR thresholds in STRATEGY.md. The strong
  regimes block the opposite direction for the four non-BTC symbols; neutral
  permits both directions according to each symbol's own regime. BTCUSDT
  itself does not apply cross-symbol BTC gating.
- **Reason:** BTC regime is a directional eligibility condition, not a score
  component.
- **Consequence:** BTC gating cannot silently add, subtract, or otherwise
  modify a candidate score.

## ADR-014 — Baseline risk, score, grade, and ranking

- **Decision:** Entry is the current fully closed signal-candle close for
  research reference only. The stop uses exactly W_t with a 0.2 ATR14_1H
  offset, stop_atr is inclusive from 0.8 to 3.0 ATR multiples, and TP
  remains exactly 2R.
  The score allocation is 40/20/20/10/10, grades are A 85–100, B 75–84,
  C 70–74, and below 70 is not a formal signal. Ranking is total score
  descending, then the fixed research-universe order.
- **Reason:** These values define reproducible candidate eligibility and
  ordering without introducing execution behavior.
- **Consequence:** Reference values are not orders or execution prices.
  Notification delivery remains deferred to M5.

## ADR-015 — Pure, shared Strategy Engine boundary

- **Decision:** The future M2 Strategy Engine is pure and framework
  independent. It consumes normalized MarketDataProvider candles, uses
  baseline-001, and is shared by future realtime and backtest callers.
- **Reason:** One deterministic engine prevents realtime/backtest drift and
  keeps infrastructure concerns outside the strategy contract.
- **Consequence:** The engine imports no Binance URL or client, performs no
  HTTP request, database write, email send, or trading action.

## ADR-016 — Separate strategy and backtest policy versions

- **Decision:** Keep `strategyVersion = baseline-001` separate from
  `backtestPolicyVersion = bt-policy-001`. The strategy version identifies
  candidate eligibility, score, and frozen research references. The backtest
  policy version identifies hypothetical fills, slippage, fees, funding,
  settlement, time exit, and metric treatment.
- **Reason:** Historical execution assumptions must be changeable and
  auditable without silently changing the Strategy Engine or historical signal
  meaning.
- **Consequence:** Every report records both versions. A change to a frozen
  strategy rule requires a reviewed Strategy Change and a new strategy
  version; a change only to historical execution assumptions creates a new
  backtest policy version.

## ADR-017 — Freeze research periods and warm-up rules

- **Decision:** Freeze the DEV period at
  `2023-01-01T00:00:00.000Z` through `2025-12-31T23:59:59.999Z` and lock the
  OOS period at `2026-01-01T00:00:00.000Z` through
  `2026-08-15T23:59:59.999Z`. Before the first evaluation, at least 205 fully
  closed 4H candles and 55 fully closed 1H candles are required; warm-up rows
  are excluded from statistics.
- **Reason:** The evaluation boundary and indicator warm-up must be fixed
  before results are inspected to prevent look-ahead and OOS tuning.
- **Consequence:** Missing warm-up or evaluation data fails closed as
  `DATA_INCOMPLETE`. OOS data cannot select or tune baseline-001 parameters.

## ADR-018 — Signal-level conservative historical settlement

- **Decision:** The M3 backtest is signal-level research, not a portfolio
  simulation. `bt-policy-001` uses the next fully closed 1H open with 5 bps
  adverse slippage per side, 5 bps entry and exit fees, strict entry-bracket
  validation, actual public funding records, conservative SL-first ordering
  when TP and SL share a candle, and a 24-held-candle `TIME_EXIT` at the
  applicable raw close.
- **Reason:** These assumptions make the hypothetical settlement deterministic
  while keeping it separate from the frozen Strategy Engine and future
  production forward tracking.
- **Consequence:** Below-70 evaluations remain research-only; invalid fills
  are recorded as `ENTRY_OUTSIDE_BRACKET`, and missing required data fails
  closed. Overlapping signals are allowed and must be reported as such. The
  SL-first and 24-bar rules apply only to `bt-policy-001` and do not decide M6
  forward-tracking behavior.

## ADR-019 — Controlled research protocol for baseline-002

- **Decision:** M3-G freezes a documentation-only research protocol, not a
  `baseline-002` strategy. Data through `2026-08-15T23:59:59.999Z` is
  permanently classified as seen research data. A true forward holdout begins
  only at the first fully closed 1H candle strictly after the final
  baseline-002 freeze commit/time. Research is limited initially to H1 signal
  redundancy, H2 cost-adjusted edge, H3 score calibration, H4 signal density,
  and H5 regime quality.
- **Reason:** The baseline-001 evidence is economically inadequate and has
  already exposed the historical interval through 2026-08-15. A bounded,
  auditable protocol is required to reduce data-mining and contamination risk
  before any new strategy behavior is tested.
- **Consequence:** Future experiments require immutable registry entries,
  small predeclared scalar grids, ablation-first controls, chronological
  calendar-based folds, frozen `bt-policy-003` economics, and multi-gate
  robustness/concentration review. M3-G runs no experiments and does not freeze
  baseline-002. M3-G.1 through M3-J and the forward holdout require separate
  milestones; M4 remains separate.

## ADR-020 — Freeze candidate-selection gates before research results

- **Decision:** All numeric baseline-002 candidate-selection gates must be
  declared in a separate M3-G.2 artifact and merged before the first M3-H
  performance experiment. M3-G.2 must record exact values, units,
  denominators, and comparison rules for improvement, fold coverage,
  catastrophic folds, expectancy, profit factor, concentration, claimed
  redundancy improvement, minimum sample, and complexity/tie handling.
  M3-I only applies this immutable record mechanically and may conclude
  `NO BASELINE-002 CANDIDATE`.
- **Reason:** Defining thresholds after observing candidate net R, PF,
  expectancy, or fold comparisons creates post-hoc selection freedom and
  invalidates the research round.
- **Consequence:** M3-G.2 must merge before M3-H, with no historical candidate
  performance result visible at its freeze point. Synthetic fixtures may test
  the gate schema. Once M3-H begins, changing a gate invalidates the round and
  requires a new research-round version and predeclared protocol. M3-I cannot
  weaken a failed gate, and no-candidate is a valid outcome.

## ADR-021 — Freeze baseline-002 research round-001 selection gates

- **Decision:** M3-G.2 freezes exactly one real gate record for
  `baseline-002-research-round-001`, sourced from
  `2f2c8f442b86bb730745908a6d6bf6a76ac43dd6`. The record freezes aggregate
  improvement, validation-fold improvement, catastrophic folds, aggregate
  expectancy and PF, symbol and single-trade concentration, fee burden,
  redundancy applicability, sample floors, and complexity/tie semantics.
- **Reason:** Numeric selection thresholds and applicability rules must exist
  before any M3-H candidate performance is observed, otherwise the research
  round permits post-hoc selection.
- **Consequence:** The canonical machine record is hashed and documented in
  `docs/BASELINE_002_SELECTION_GATES_R1.md`. All gates are conjunctive;
  integrity failures are incomplete evidence, and a later gate change after
  M3-H invalidates round-001. This milestone uses synthetic fixtures only and
  defers gate application to M3-I. It does not implement baseline-002 or run
  historical research.

## ADR-022 — Complete the SHA-covered round-001 selection contract

- **Decision:** The M3-G.2 round-001 machine record includes the all-applicable
  hard-gate conjunction and identities, explicit PF status/Infinity semantics,
  H1/H4 redundancy applicability and N/A handling, exact F1-F6 validation
  concatenation, non-negative-integer complexity domains, and structured round
  invalidation semantics. The canonical record hash is recomputed whenever
  these frozen semantics change.
- **Reason:** Critical selection semantics cannot be left only in Markdown;
  otherwise the recorded `selectionGateSha256` would not attest to the complete
  contract used by the later research milestone.
- **Consequence:** `selectionGateSha256` is now
  `11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd`.
  `NOT_APPLICABLE` is not a pass, `NO_TRADES` PF fails, failed candidates do
  not weaken gates, and invalidation requires a new research round with prior
  results retained as `SEEN_DATA`. No evaluator or candidate performance is
  introduced in this remediation.

## ADR-023 — Freeze M3-H round-001 Stage-A plan before performance output

- **Decision:** M3-H round-001 uses one fresh `bt-policy-003` CONTROL report and
  derives exactly 13 predeclared single-mechanism candidates offline from
  outcome-blind decision snapshots. The Stage-A plan is identified by
  `2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a` and is
  tied to authoritative main `99e8f86207c0bd22facf66d557e2e6f792ba0b6e`.
- **Reason:** Re-running the Strategy Engine or settlement separately for each
  candidate would change the comparison unit and permit result-dependent
  experiment definitions. A single frozen CONTROL ledger preserves signal-time
  selection and identical inherited economics.
- **Consequence:** Stage A must be committed and pass CI before the one CONTROL
  capture. After the first complete historical result, experiment definitions,
  selector semantics, and result derivation are immutable. M3-H remains
  descriptive and defers all gate application to M3-I; `baseline-002` is not
  frozen.

## ADR-024 — Freeze baseline-002 research round-002 protocol

- **Decision:** After M3-I closed with the exact result
  `NO BASELINE-002 CANDIDATE`, start a separate pre-performance research stream
  identified as `baseline-002-research-round-002`. Its research universe is
  exactly 2023-01-01T00:00:00.000Z through 2026-08-15T23:59:59.999Z and remains
  `RESEARCH_AVAILABLE_SEEN_DATA`. The protocol predeclares H6 strict BTC
  alignment, H7 strong symbol regime, H8 recent pullback, H9 volume
  confirmation, H10 breakout buffer, and exactly nine candidates plus the
  baseline-001 CONTROL.
- **Reason:** Round-001 produced no eligible candidate. A new mechanism family
  must therefore be predeclared as a new research round rather than changing
  the closed Round-001 registry, gates, evidence, or result.
- **Consequence:** Round-002 candidates are strict eligibility subsets of
  baseline-001 and selectors may use only contemporaneous decision-time
  features. Round-002 inherits the complete Round-001 gate contract
  unchanged: values, formulas, semantics, sample floors, PF status rules,
  aggregate-validation construction, fold-improvement and catastrophic-fold
  definitions, concentration and fee-burden rules, and selection tie rules.
  M3-R2-B may encode but may not alter that contract. An actual structural
  incompatibility stops the round and requires a new research-round decision;
  there is no in-round gate-change escape hatch.
- **Consequence (continued):** `requiredRedundancyImprovement` is REQUIRED only
  for declared H1/H4 mechanisms or combinations containing them. All nine
  Round-002 candidates declare neither, so their redundancy gate is
  `NOT_APPLICABLE` and never PASS. The exact five-step tie rule is inherited,
  and M3-R2-B must freeze each candidate's non-negative-integer complexity
  tuple before performance; neither the tuple nor the tie rules may change
  afterward. A separate equivalent machine gate record must be merged before
  any Round-002 performance output. The sequence is M3-R2-A protocol freeze,
  M3-R2-B machine gate and synthetic tooling, M3-R2-C one CONTROL
  capture/offline derivation, then M3-R2-D mechanical gate application.
  M3-R2-A is documentation-only; `baseline-002` remains not frozen, M3-J
  remains blocked/not started, and M4 remains not started.

## ADR-025 — Freeze Round-002 machine gates and pure selector tooling

- **Decision:** M3-R2-B implements only pre-performance, outcome-blind tooling
  for `baseline-002-research-round-002`: a separate canonical gate record,
  exact control/candidate registry, frozen complexity tuples and parameters,
  pure decision-time feature extraction, pure H6-H10 selectors, exact-AND
  combinations C1-C4, and synthetic tests. The gate record SHA is
  `9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0`; the
  plan SHA is
  `82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511`.
- **Reason:** Round-002 must be mechanically reproducible without allowing
  future outcomes, settlement fields, historical loader behavior, or
  performance results to influence candidate identity or selection.
- **Consequence:** H9 uses closed 1H `Candle.quoteVolume`, with the current
  candle excluded from the previous-20 mean. All nine Round-002 redundancy
  gates are `NOT_APPLICABLE` and never `PASS`. The source was pinned to
  `26d18ef314594f0e79583da617a0d8c17e812be9`, and M3-R2-B was merged before
  any Round-002 performance. M3-R2-C/D, baseline-002 freeze, M3-J, and M4
  remained unauthorized at this freeze point. The later M3-R2-C invalidation
  is recorded separately and does not alter this machine gate contract.

## ADR-026 — Invalidate Round-002 after post-performance evidence defects

- **Decision:** Classify `baseline-002-research-round-002` as
  `ROUND_002_INVALIDATION_REQUIRED`. The single CONTROL capture completed on
  source `9df170b7f72a95971825e126d4096e1e4f16be5f`, but offline evidence
  derivation exposed result-affecting defects after `runBacktest()` returned.
  The round must not be patched and rerun; PR #22 remains unmerged and
  preserved as audit evidence.
- **Reason:** The aggregate F1-F6 diagnostics path passed all CONTROL records
  into a bounded-range calculation instead of first filtering records to the
  requested inclusive range. Independently, identity hashing used lexical
  string sorting instead of the frozen signal-time/symbol/direction order.
  Either defect can invalidate evidence or create false CONTROL parity drift.
- **Consequence:** Candidate performance and Round-002 evidence are not
  generated. The captured CONTROL and decision-snapshot files are
  `INVALIDATED_ROUND_CAPTURE_ARTIFACTS`, not a baseline-002 result and not
  eligible for M3-R2-D. Reuse is only
  `CONDITIONAL_PENDING_NEW_ROUND_PROTOCOL_AND_SHA_VERIFICATION` and is not
  approved by this record. `baseline-002` remains not frozen, M3-R2-D is
  cancelled for Round-002, M3-J is blocked/not started, M4 is not started,
  and Round-003 is not started/not authorized.

## ADR-027 — Freeze Round-003 offline recovery after Round-002 invalidation

- **Decision:** Create the separate pre-performance research round
  `baseline-002-research-round-003` from authoritative main
  `a20803c9cf33aefcb1d376f916eb9fe666f1bf58`. Preserve the exact Round-002
  universe, folds, CONTROL/candidate registry, H6-H10 selectors, parameters,
  complexity tuples, `bt-policy-003`, and gate semantics. The Round-003
  machine gate SHA is
  `297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2` and
  the plan SHA is
  `d4238bec817425fddd4a1e556277aa58de84c5986da55a9e08b661cc9f621e67`.
- **Reason:** Round-002 was invalidated after performance generation because
  aggregate validation did not filter to its requested range and identity
  hashing did not use the frozen time/symbol/direction order. A new round is
  required; patching or rerunning Round-002 is forbidden.
- **Consequence:** R3-A only fixes the offline validation filter, canonical
  identity ordering, and SHA-verified reuse provenance. The exact existing
  CONTROL and decision-snapshot captures may be reused only when their raw
  hashes and envelope match the recorded values; otherwise the path fails
  closed. No Binance request, historical load, CONTROL/backtest/settlement
  run, candidate derivation, performance metric, or gate application is part
  of R3-A. `baseline-002` remains not frozen, M3-R3-B is now separately
  authorized for its offline source-freeze/one-time derivation flow, M3-J is
  blocked/not started, and M4 is not started.

### ADR-M3-R3-B — Offline Round-003 candidate derivation authorization

- **Decision:** authorize only the two-commit M3-R3-B flow: Commit A freezes
  the offline selector/evidence source and synthetic tests; after its CI
  succeeds, one exact offline command may generate the nine descriptive
  candidate diagnostics for Commit B.
- **Constraint:** the source must reuse the exact SHA-verified Round-002
  CONTROL and decision-snapshot bytes, existing frozen selectors, existing
  diagnostic helpers, and inherited CONTROL economics. It must not call
  Binance, HTTP, the historical loader, `runBacktest`, `evaluateStrategy`,
  settlement, or any strategy path.
- **Consequence:** the performance lock is
  `FIRST_M3_R3_B_PERFORMANCE_RESULT_GENERATED`; after the first real
  candidate diagnostic no result-affecting change or rerun is permitted.
  `baseline-002` remains not frozen, M3-R3-C is not started, M3-J remains
  blocked, and M4 remains not started.

## ADR-028 — Freeze Round-004 diagnosis and structural hypotheses

- **Decision:** Start `baseline-002-research-round-004` from authoritative
  main `0f994ddde6d3303eb34560cdc1c8babbae5115a5` as a documentation-only
  diagnosis and qualitative hypothesis-freeze milestone. The authoritative
  inputs and raw SHA-256 values are recorded in
  `docs/BASELINE_002_DIAGNOSIS_R4.md`.
- **Evidence basis:** Round-001 selection is complete with 13 ineligible
  candidates. Round-003 selection is complete with 9 ineligible candidates;
  its final decision is `NO BASELINE-002 CANDIDATE — ROUND-003`. Round-002
  candidate performance remains excluded because its evidence pipeline was
  invalidated after performance generation.
- **Decision:** Freeze exactly four standalone structural hypotheses for
  future review: `H11_BREAKOUT_RETEST_ENTRY` in
  `ENTRY_TIMING_REDESIGN`, `H12_PULLBACK_RECLAIM_ENTRY` in
  `ENTRY_PATTERN_REDESIGN`, `H13_ADAPTIVE_TREND_EXIT` in
  `EXIT_ARCHITECTURE_REDESIGN`, and `H14_RELATIVE_STRENGTH_CONTEXT` in
  `CROSS_ASSET_CONTEXT`. Each has exactly one future variant.
- **Constraint:** Round-004 must not recreate H1-H10 or C1-C4 as filters,
  run combinations, use a threshold grid, sweep parameters, optimize, or
  choose values after observing outcomes. Gates must be no weaker than
  Round-003 and no new machine Gate SHA or Plan SHA is created by R4-A.
- **Reason:** The committed evidence supports insufficient economic edge and
  cross-fold instability in the tested baseline-001 entry family. The
  evidence does not justify another filter-only search or favorable changes
  to fees, slippage, funding, or gate thresholds.
- **Consequence:** Exact formulas, execution semantics, complexity tuples,
  data requirements, canonical Gate/Plan records, and synthetic tests are
  deferred to M3-R4-B. No Round-004 performance is authorized by R4-A.
  `baseline-002` remains not frozen, M3-J remains blocked/not started, and M4
  remains not started.

## ADR-029 — Freeze the Round-004 machine protocol before performance

- **Decision:** M3-R4-B freezes `baseline-002-research-round-004` from
  authoritative main `1bab6066cd4e9933c3d50ab29a38e9ad0792e5c8`. Its machine
  Gate is `c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54`
  and its Plan is
  `f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981`.
- **Scope:** The registry is exactly one frozen baseline-001 CONTROL and the
  four standalone H11-H14 candidates. H11/H12/H14 are decision-time-only
  pure selectors; H13 is a variant-local 48-held-candle exit overlay. The
  existing `bt-policy-003` economics, baseline-001, folds, symbols, and
  next-open semantics are preserved.
- **Gate:** Round-003 numeric values and semantics are inherited unchanged.
  The machine registry retains 11 hard-gate identities, with 10 applicable;
  redundancy is explicitly `NOT_APPLICABLE` for every Round-004 candidate and
  is excluded from the conjunction rather than counted as a pass. The tie
  rule, no-candidate outcome, performance lock, and exact structural
  invalidation categories/action are machine-recorded and SHA-validated.
- **Reason:** R4-A identified four structural hypotheses but intentionally did
  not define executable formulas. Exact machine-readable definitions,
  decision-time boundaries, audit fields, provenance, and synthetic tests must
  be frozen before any performance observation.
- **Consequence:** M3-R4-B generates no historical result and authorizes no
  performance. Binance, HTTP market data, historical loading, CONTROL,
  settlement, evidence derivation, candidate selection, baseline-002 freeze,
  M3-J, and M4 remain out of scope. A result-affecting definition change after
  the first performance result requires `ROUND_004_INVALIDATION_REQUIRED` and
  a new research-round decision.

## ADR-030 — Freeze the Round-004 performance implementation before execution

- **Decision:** M3-R4-C freezes the executable source for
  `baseline-002-research-round-004` on authoritative main
  `fd42381d903f9b60ec98e7b297578de95dc8160b`. It does not run the performance
  command or create historical evidence.
- **Scope:** The implementation preserves `baseline-001`, `bt-policy-003`,
  the frozen five-symbol universe, the global 24-held-candle policy, and all
  M3-R4-B decision formulas. H13 alone receives a `SETTLEMENT_ONLY` extension
  for held #25–#48; H13 raw output is research-only. H11/H12 use standard
  settlement and H14 reuses the same-run CONTROL outcome.
- **Execution guard:** A later authorized command must supply
  `--confirm-authoritative-run`, exact source/Gate/Plan SHA values, and the
  exact round id. Before any network access it must validate exact HEAD,
  clean worktree, successful Gate/Plan validators, and absent output files;
  missing values fail closed and outputs cannot be overwritten.
- **Phases:** Phase A discovers decision populations and the deduplicated
  intrabar requirement union without economics/evidence. Phase B loads one
  final set of 1m windows with the same study server time, runs the existing
  CONTROL, verifies identity parity, settles the candidates, and then
  serializes report schema `m3-r4-round-004-report-001`. Gate application and
  candidate selection remain deferred to M3-R4-D.
- **Consequence:** M3-R4-C is source freeze only. No Binance request,
  historical run, CONTROL, evidence artifact, candidate gate, baseline-002
  freeze, M3-J, M4, private API, or trading path is authorized. The exact
  status remains `baseline-002 NOT FROZEN`, `M3-J BLOCKED / NOT STARTED`, and
  `M4 NOT STARTED`.

## ADR-031 — Close the Round-004 frozen Gate application

- **Decision:** M3-R4-D.2 mechanically applied the frozen Gate for
  `baseline-002-research-round-004` from gate-application source
  `90b1643e8521411edaf57ab96961cb2113c90ef6`, using the unchanged Gate and
  Plan. Attempt #7 remains the sole authoritative performance result.
- **Result:** The application is `COMPLETE` with zero integrity errors. No
  candidate passed all 10 applicable gates, so the exact final decision is
  `NO BASELINE-002 CANDIDATE — ROUND-004`; no candidate was selected.
- **Consequence:** `baseline-002` remains `NOT_FROZEN`, M3-J remains
  `BLOCKED`, and M4 remains `NOT_STARTED`. No performance rerun occurred,
  and no Gate, Plan, or candidate definition changed.

## ADR-032 — Authorize Round-005 research design only

- **Decision:** Round-004 is complete with final decision
  `NO BASELINE-002 CANDIDATE — ROUND-004`. `baseline-002` remains
  `NOT_FROZEN`. Round-005 is authorized for research-design work only.
- **Scope:** M3-R5-A freezes four qualitative standalone hypotheses:
  H15 HTF low-frequency trend architecture, H16 neutral-regime mean
  reversion, H17 funding crowding reversal, and H18 volatility compression
  to expansion. It does not freeze formulas, a Gate, a Plan, candidates, or
  performance.
- **Consequence:** No performance is authorized. M3-J remains `BLOCKED` and
  M4 remains `NOT_STARTED`. R5-B must be independently accepted and merged
  before any historical performance command.

## ADR-033 — Freeze Round-005 B.1A protocol and H17 data qualification

- **Decision:** Freeze the exact standalone H15–H18 candidate formulas,
  decision-time/next-open contracts, `bt-policy-003` settlement boundary,
  complexity tuples, and the H17 canonical UTC 8-hour data-qualification
  contract for `baseline-002-research-round-005`.
- **H17 availability:** H17 is conditional. All five symbols must contain
  every canonical `00:00`, `08:00`, and `16:00` UTC slot in the frozen
  2023-01-01 through 2026-08-15 range, with valid timestamps, strict source
  order, no duplicates, complete pagination, and auditable official manifest
  provenance. Noncanonical records may remain for settlement but cannot
  create H17 decisions. A complete retrieval with missing/invalid canonical
  data is `DATA_NOT_AVAILABLE`; a retrieval/runtime abort before complete
  qualification is `RETRIEVAL_ABORT` and produces no artifacts.
- **Report privacy:** H17 qualification artifacts contain coverage and
  provenance only. They must not expose funding-rate distributions,
  threshold-hit counts, H17 signal counts, outcomes, or performance metrics.
- **Deferred:** The final Round-005 registry, Gate SHA, and Plan SHA remain
  deferred until B.1B and a complete H17 qualification. B.1A does not access
  Binance, load historical data, run a backtest/performance command, generate
  evidence, freeze `baseline-002`, start M3-J, or start M4.
- **Lock:** The future lock is
  `FIRST_M3_R5_PERFORMANCE_RESULT_GENERATED`; after it, result-affecting
  changes require `ROUND_005_INVALIDATION_REQUIRED`.

## ADR-034 — Freeze the Round-005 B.1B final registry, Gate, and Plan

- **Decision:** The sole H17 qualification from source
  `b59b9e86a8b1070275c157f571901a6165114670` is `DATA_NOT_AVAILABLE`.
  H17 is excluded mechanically with no retry, replacement, or reinterpretation.
  The final performance registry contains `R5-CONTROL-BASELINE-001` and the
  standalone candidates `R5-H15-HTF-TREND`, `R5-H16-NEUTRAL-MEAN-REVERSION`,
  and `R5-H18-COMPRESSION-EXPANSION`; no combinations are declared.
- **Provenance:** The H17 JSON and Markdown qualification artifacts remain
  byte-for-byte authoritative. The inherited Round-004 Gate SHA is
  `c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54`;
  the frozen Round-005 Gate SHA is
  `e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5`, and
  the frozen Round-005 Plan SHA is
  `ab16a63462825441e00682f2b2bcbe04cb249e469843ce7f9a097017d992b6d1`.
- **Consequence:** Performance remains unauthorized and no future execution
  source SHA is predeclared. `baseline-002` remains `NOT_FROZEN`, M3-J remains
  `BLOCKED`, and M4 remains `NOT_STARTED`. No qualification rerun, Binance
  access, performance, Gate/Plan mutation, or candidate-definition change is
  permitted by this freeze.

## ADR-035 — Implement the Round-005 B.2 future performance machinery

- **Decision:** Implement native-data H15/H16/H18 formal-signal generation,
  bt-policy-003 execution/settlement parity, phase-A intrabar requirement
  discovery, F1–F6 evidence construction, strict CLI preflight, and
  destination-local atomic publication for the future Round-005 run.
- **Boundary:** This implementation does not run performance, access Binance,
  rerun H17 qualification, apply gates, select a candidate, or freeze
  baseline-002. The future execution source SHA is supplied at runtime and is
  intentionally not predeclared in the frozen Plan.
- **Status:** Performance remains `NOT_AUTHORIZED` / `NOT_GENERATED`;
  baseline-002 remains `NOT_FROZEN`, M3-J remains `BLOCKED`, and M4 remains
  `NOT_STARTED`.

## ADR-036 — Freeze the Round-006 final registry, Gate, and Plan

- Decision: Freeze baseline-002-research-round-006 from the accepted B.1A
  post-merge source b8e03e34360ceaaf515882226940eba99bf89b1c. The four
  standalone candidates are H19, H20, H21, and H22 exactly as recorded by
  the B.1A protocol, with one variant each and unchanged complexity tuples.
- Gate: Round-005 numeric values, comparison directions, fold-improvement
  semantics, catastrophic-fold semantics, sample floors, concentration,
  profit-factor, and fee-burden definitions are inherited without weakening.
  Round-006 has exactly ten applicable gates because redundancy is
  NOT_APPLICABLE for every candidate. The accepted Round-005 Gate SHA is
  e7af8bf2137df8e0c4277c92abffab480511e25d3414682dd78836c1c973adb5; the
  inherited Round-004 ancestry SHA remains
  c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54. The
  corrected Round-006 canonical Gate SHA is
  ff51cdc587f5a79cc9dd8d449202e481f4d2eed23e7f843797b8348b8cebe1f6.
- Plan: The canonical Plan binds the five-symbol universe, F1–F6 folds,
  seen-data boundary, baseline-001, bt-policy-003, R6 protocol identity,
  Gate SHA, settlement/economics, deterministic staged selection, the complete
  metric/status/output contract, and runtime provenance checks. Its corrected
  canonical SHA is
  0e9521e373764c8e9389326f84d25172693b3e3a0894e9829183bb0c7a96a591.
- Constraint: The future performance execution SHA is not predeclared; it
  must be supplied only by a separately authorized runtime and must equal the
  authorized source SHA and the clean-worktree Git HEAD. Required manifests
  must pass and authoritative outputs must be absent before network access.
  No performance, selection, Binance access, historical exploration,
  optimizer, sweep, or evidence generation occurs in B.1B.
- Consequence: Performance remains NOT_AUTHORIZED / NOT_GENERATED,
  baseline-002 remains NOT_FROZEN, M3-J remains BLOCKED, and M4 remains
  NOT_STARTED. After FIRST_M3_R6_PERFORMANCE_RESULT_GENERATED,
  result-affecting changes require ROUND_006_INVALIDATION_REQUIRED.

## ADR-037 — Remediate the Round-006 B.1B provenance, selector, and metric contract

- **Decision:** B.1B remains pre-performance and unmerged on its existing PR.
  The machine Gate now records the accepted Round-005 Gate independently from
  the inherited Round-004 ancestry Gate. The selector is a staged algorithm:
  eligibility, maximum improved folds, an inclusive 0.01 expectancy tie band,
  complexity tuple, PF with null after finite, then candidate ID. This avoids
  the non-transitive behavior of a pairwise comparator and freezes eligible-ID
  serialization in ascending order.
- **Metric contract:** Only formal evaluator signals create records. The Plan
  explicitly defines the status semantics, formal/executed counts, PF
  NO_TRADES/NO_LOSSES behavior, fee burden, concentration, fold improvement,
  catastrophic folds, minimum fold executed trades, finite/null/rounding
  normalization, deterministic ordering, and the accepted-base implementation
  identities used for diagnostics and stable serialization.
- **Authorization:** The future source remains `null` in B.1B. A later run
  must provide the execution source, separately authorized source, and Git HEAD
  as the same SHA, plus clean worktree, passing manifests, and absent output
  artifacts before any network request. Arbitrary valid SHAs are rejected.
- **Consequence:** The corrected Gate and Plan hashes are recorded above.
  Performance remains `NOT_AUTHORIZED` / `NOT_GENERATED`; baseline-002 remains
  `NOT_FROZEN`; M3-J remains `BLOCKED`; and M4 remains `NOT_STARTED`.

## Deferred decisions

The following decisions remain explicitly marked `DEFERRED_TO_M6` for
production forward tracking and must not be inferred from the historical
backtest policy:

- forward-tracking invalidation event ordering.

`bt-policy-001` defines a historical-only TIME_EXIT price and same-candle
ordering for M3 research. Those assumptions do not change baseline-001 or
settle the M6 production policy. No other baseline-001 strategy rule remains
open for M2-A.
