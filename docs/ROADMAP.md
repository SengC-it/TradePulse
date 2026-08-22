# TradePulse Milestone Roadmap

Every milestone ends with a review, documentation update, acceptance check, and stop. No milestone is started automatically.

## M0 — Foundation & Architecture

Status: CLOSED

### Scope

Repository initialization, minimal Next.js App Router app, configuration boundaries, architecture and product documents, strategy specification, migration-based database design, Auth/Cron/SMTP/security design, and verification scripts.

### Deliverables

`package.json`, lockfile, TypeScript/ESLint/Vitest setup, App Router page, health endpoint, Supabase SSR client helpers, cron authorization helper, `.env.example`, migration, docs, `AGENTS.md`, and README.

### Tests

Build, TypeScript, lint, and deterministic M0 unit tests.

### Integration tests

None against a remote project; migration and Auth integration are designed only.

### Acceptance criteria

Fresh install and all checks pass; no trading/private Binance capability; all open strategy decisions are documented; no production remote state changed.

### Known risks

Current strategy score sub-formulas and BTC regime are incomplete; applying the migration without an identified development project would be unsafe.

### Out of scope

M1 market data and every later engine, scan, email, dashboard, and deployment.

## M1 — Market Data

Status: CLOSED / MERGED TO main

### Scope

Implement `MarketDataProvider` and Binance public REST adapter for the approved five symbols, 1H/4H candles, server time, completeness, ordering, freshness, malformed-data validation, bounded retry, and partial snapshot reporting.

### Deliverables

Normalized candle types, provider adapter, validation service, deterministic fixtures, provider error codes, mocked provider contract tests, and a manual public smoke-test command.

### Tests

Unit tests for time boundaries and invalid data; adapter contract tests with mocked public responses.

### Integration tests

Optional manually approved public Binance smoke test; no private API.

### Acceptance criteria

Only fully closed valid candles are returned; invalid data creates no signal input; five-symbol list is unchanged.

### Known risks

Exchange rate limits, maintenance, clock skew, and API schema changes.

### Out of scope

Indicators, strategy, scoring, alerts, database writes, and trading.

## M2-A — Strategy Specification Freeze

Status: CLOSED / MERGED TO main

### Scope

Freeze baseline-001 indicator formulas, market regimes, BTC directional gate,
1H candidate rules, entry/stop/TP references, score, grades, and deterministic
ranking. M2-A changes documentation only.

### Deliverables

Update only:

- docs/STRATEGY.md
- docs/DECISIONS.md
- docs/ROADMAP.md
- docs/TEST_PLAN.md

### Tests

Document exact boundary tests for every frozen formula and eligibility rule.
No indicator or Strategy Engine implementation is added in M2-A.

### Integration tests

None. M2-A does not add runtime, database, Cron, notification, or trading
integration.

### Acceptance criteria

The baseline-001 contract is explicit, closed-candle-only, deterministic,
versioned, and consistent with ADR-004. The pull request contains only the
four documentation files, normal CI passes, and the Draft PR is not merged.

### Known risks

Implementation must preserve the frozen formulas and must not invent the
M6-deferred TIME_EXIT price, same-candle TP/SL ordering, or invalidation event
ordering.

### Out of scope

Indicators, Strategy Engine code, persistence, Cron, SMTP, dashboard,
backtesting, production deployment, and all trading capability.

## M2-B — Indicators & Pure Strategy Engine

Status: CLOSED / MERGED TO main

### Scope

Implement the frozen baseline-001 indicators, BTC/symbol regimes, candidate
rules, score, grade, and ranking in one pure Strategy Engine.

### Deliverables

Indicator modules, domain types, Strategy Engine, score/ranking modules, and
complete deterministic fixtures are implemented under `src/lib/indicators/`,
`src/lib/strategy/`, and `tests/`.

### Tests

Unit and strategy tests for every formula and boundary; shared-engine contract
tests; closed-candle-only tests; and tests proving no infrastructure imports or
side effects.

### Integration tests

Market-data fixture to candidate output; no external send and no database
write.

### Acceptance criteria

All baseline-001 rules are testable, closed-candle-only, versioned, and
identical for future realtime/backtest callers. M6-deferred decisions remain
explicitly deferred. Normal local verification passes without external
services.

### Known risks

Look-ahead bias, incorrect indicator seeding, boundary-condition drift, and
accidental coupling to Binance or infrastructure.

### Out of scope

Persistence, Cron, SMTP, dashboard, backtesting, M6 event resolution, and real
trading.

## M3-A — Backtest Specification Freeze

Status: CLOSED / MERGED TO main

### Scope

Freeze the auditable historical research protocol for baseline-001 without
fetching data or implementing a Backtest Runner.

### Deliverables

Update only the M3-A specification documents:

- `docs/BACKTEST.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `docs/TEST_PLAN.md`
- `README.md`

### Tests

Document deterministic M3-B tests for data integrity, as-of slicing, shared
Strategy Engine use, execution settlement, funding, R normalization, metrics,
and acceptance gates. Run the normal repository typecheck, lint, test, and
build checks; no external historical data is required for M3-A.

### Integration tests

None. M3-A does not add a loader, Binance request, Supabase write, Cron,
notification, deployment, or historical result.

### Acceptance criteria

`baseline-001` and `bt-policy-001` are separate and explicit; DEV and locked
OOS periods, warm-up exclusion, the five-symbol public-data universe, the
closed-candle as-of clock, next-open fill, conservative settlement, funding,
signal-level metrics, and sample/concentration gates are frozen. The PR
contains documentation only, normal CI passes, and the Draft PR is not
merged.

### Known risks

Look-ahead bias, incomplete historical data, unverified funding coverage,
execution-policy drift, and interpreting signal-level results as portfolio
performance.

### Out of scope

Historical downloading, Backtest Runner code, persistence, optimization,
parameter tuning, realtime scanning, notifications, M6 forward tracking,
production deployment, and all trading capability.

## M3-B — Historical Loader + Deterministic Backtest Runner

Status: IMPLEMENTED / MERGED TO main

### Scope

Load auditable Binance USDⓈ-M Futures public historical candles and funding
records, build as-of inputs, call the existing M2 Strategy Engine, and apply
`bt-policy-001` deterministically.

### Deliverables

Historical loader, integrity validation, required manifest/checksum coverage,
authoritative fully-closed candle validation, deterministic indexed
signal-level runner, exact 250/250 as-of Strategy Engine windows, frozen
24-held-candle settlement, funding/R/fee/slippage metrics, acceptance evaluator,
stable report serialization, CLI, and mocked tests. No second strategy
implementation is permitted.

### Tests

The M3-B tests documented in `docs/TEST_PLAN.md`, including no-future-data,
warm-up, duplicate/gap/malformed-data failure, entry bracket, SL-first,
24-bar TIME_EXIT, funding, R/fee/slippage, metric edge cases, deterministic
drawdown, and acceptance-gate fixtures.

### Integration tests

The loader is wired to the verified official Binance USDⓈ-M Futures public
Kline and funding endpoints, while CI uses mocked transport. Reproducible
local report generation is available through `npm run backtest:run`; no
private API, account data, database persistence, or production deployment is
assumed.

### Acceptance criteria

Reports include both version identifiers, required data manifests, separate
DEV/OOS/COMBINED metrics and acceptance fields, an overall decision requiring
COMBINED plus OOS for a COMBINED report, all frozen assumptions,
incomplete-data outcomes, and explicit signal-level disclaimers. M3-B does
not tune baseline-001 and does not run M3-C.

### Known risks

Look-ahead bias, incomplete historical candles, settlement-policy drift, and
survivorship bias.

### Out of scope

Automated optimization, parameter tuning without approval, M3-C acceptance,
live scan, notifications, M6 forward tracking, and trading.

## M3-B.1 — Historical Funding Compatibility Specification

Status: CLOSED / MERGED TO main

### Scope

Freeze a separate historical-data compatibility policy for older official
Binance USDⓈ-M Futures funding-history records whose `markPrice` is empty or
otherwise invalid. This is a data-source compatibility decision, not strategy
tuning. `baseline-001` and the immutable `bt-policy-001` contract remain
unchanged. No DEV/OOS/COMBINED performance metrics have been observed under
`bt-policy-002`.

### Frozen rules

- `backtestPolicyVersion = bt-policy-002` is distinct from `bt-policy-001`.
- `fundingRate` and `fundingTime` remain sourced only from
  `/fapi/v1/fundingRate`.
- A finite positive funding-history `markPrice` is used directly with
  provenance `FUNDING_RATE_HISTORY`.
- Only an invalid direct mark price may use the official
  `/fapi/v1/markPriceKlines` 1H endpoint. Select the greatest fully closed
  candle with `closeTime < fundingTime`, use its close, and record
  `MARK_PRICE_KLINE_PRE_EVENT_CLOSE`.
- No valid pre-event fallback means `DATA_INCOMPLETE`; no funding event is
  silently dropped. Ordinary klines, spot/index/premium-index prices,
  interpolation, future/current prices, entry price, zero, and alternate
  providers are forbidden.
- Existing funding economics and event timing are unchanged. Charge-level
  provenance, aggregate fallback diagnostics, symbol/UTC-year breakdowns, and
  mark-price manifest hashes are mandatory.
- Base mark-price ranges are frozen as
  `startTime = fundingRange.startTime - 1 hour` and
  `endTime = fundingRange.endTime`. OOS/COMBINED settlement tails use
  `settlementTail.startTime` through `settlementTail.fundingRange.endTime`
  with `settlementOnly = true`; ranges are never derived from observed
  performance or trade results.
- Mark-price Klines use the same authoritative study `serverTime`, require
  `closeTime < serverTime`, strict chronological order, exact 1H continuity,
  no duplicates, valid timestamps, finite positive OHLC, and valid OHLC
  relationships. Sorting, gap filling, interpolation, and synthetic candles
  are forbidden; required invalid/missing data is `DATA_INCOMPLETE`.
- Manifest coverage is usage-driven: a fallback charge requires a valid
  official mark-price manifest for the matching symbol and exact frozen base or
  settlement-tail range; tail fallback additionally requires
  `settlementOnly = true`. Missing, wrong-source, wrong-range,
  wrong-settlement, or invalid-checksum coverage makes the formal result
  `INCOMPLETE`; direct-only compatibility segments do not require an unused
  fallback manifest.
- `bt-policy-001` serializes as `m3-b-report-001`; `bt-policy-002` serializes
  as `m3-b-report-002` with the new provenance/fallback audit fields. The
  legacy schema must not be silently extended.
- Formal policy selection is explicit: missing or unknown `--policy` fails
  closed; `bt-policy-001` selects immutable legacy behavior and
  `bt-policy-002` selects compatibility behavior. M3-C replacement evidence
  must use `npm run backtest:run -- --period COMBINED --policy bt-policy-002`.

### Deliverables

The specification is merged and is implemented by the separate M3-B.2
milestone below. No M3-C performance evidence is included here.

### Acceptance gate

The specification is accepted because the four documents describe the same
direct/fallback order, strict pre-event lookback, fail-closed behavior,
provenance, manifests, and determinism. `bt-policy-001` remains unchanged and
M3-C was not rerun during this specification gate.

## M3-B.2 — Historical Funding Compatibility Implementation

Status: CLOSED / MERGED TO main

### Scope

Implement `bt-policy-002` against the merged M3-B.1 contract. The implementation
adds explicit CLI policy selection, direct-mark preservation, official
`/fapi/v1/markPriceKlines` fallback loading and validation, exact frozen ranges,
charge provenance, fallback audit fields, and mark-price manifests. The
immutable `bt-policy-001` path and `baseline-001` Strategy Engine are unchanged.

### Acceptance gate

CI must pass typecheck, lint, all deterministic tests, build, and diff checks.
The formal M3-C command is explicitly not run in this milestone. M3-C remains
blocked pending implementation review and a separately authorized historical
run.

## M3-C — Baseline Historical Run + Evidence Review

Status: INCOMPLETE / EVIDENCE MERGED

### Formal result

`M3-C bt-policy-002 Formal Run #1` was executed exactly once from main commit
`b28c9b191ad2acd74f8e74e87f51dc1a3eb9e443` using `baseline-001` and
`m3-b-report-002`. The frozen classification is **M3-C INCOMPLETE** because
the report contains 249 `SETTLEMENT_AMBIGUOUS` results (DEV 184, OOS 65),
which takes precedence over the later acceptance gates. The complete
documentation-only evidence is in `docs/M3_BASELINE_001_RESULTS.md`.

M3-C stops here. No strategy tuning, policy change, M4 work, or trading is
authorized by this result.

### Scope

Run the frozen baseline protocol on the approved historical data and review
the evidence against the M3 acceptance gate.

### Deliverables

Reproducible DEV/OOS/COMBINED report, manifest/checksum evidence, sample-size
and concentration checks, and a documented acceptance or
`INSUFFICIENT_SAMPLE`/failed-gate result.

### Tests

Re-run the deterministic M3-B fixtures and verify report reproducibility from
the recorded inputs, versions, and policy assumptions.

### Integration tests

A separately approved public-data historical run only. No private Binance
interface, alternate provider, optimization, or production state.

### Acceptance criteria

The result is accepted only when the frozen sample, performance, and
concentration requirements pass. A failed or insufficient result is reported
as-is; no thresholds are changed to obtain a pass.

### Known risks

Historical source changes, funding coverage, sample scarcity, concentration,
and non-portfolio interpretation.

### Out of scope

Parameter tuning, robustness optimization, realtime scanning, M4, M6 policy
decisions, production deployment, and trading.

## M3-D — Intrabar Settlement Resolution Specification Freeze

Status: CLOSED / MERGED TO main

### Authority and purpose

This milestone starts from main commit
`5f8824443ef824fc061719f99b8738a06f9104e0` and addresses only the 249
`SETTLEMENT_AMBIGUOUS` outcomes documented by the immutable bt-policy-002
Formal Run #1. The prior M3-C result remains **M3-C INCOMPLETE** and is never
overwritten.

### Frozen policy

`bt-policy-003` inherits all `bt-policy-002` rules while adding deterministic
1m settlement resolution. It uses only official Binance USDⓈ-M Futures 1m
Klines for the exact ambiguous exit hours, never feeds 1m data to
`StrategyInput`, and validates exactly 60 closed continuous minutes with the
same study server time. `bt-policy-002` first freezes
`frozenExitReason = TP | SL` on the 1H candle, including its existing SL-first
result when both brackets are touched; 1m data only locates the first minute
reproducing that reason. The opposite bracket cannot change it, and failure to
reproduce it is `DATA_INCOMPLETE`. Each 1m window must also reconcile exactly
with its 1H open/high/low/close. Funding before/after the exit minute is
included/excluded by timestamp, while same-minute funding uses the frozen
conservative negative-cost rule with `CONSERVATIVE_SAME_MINUTE` provenance and
a separate audit record even when a positive credit is excluded.

The new report schema is `m3-b-report-003`. Required intrabar manifests,
symbol/UTC-year audit counts, and the existing precedence
`INCOMPLETE > INSUFFICIENT_SAMPLE > FAIL > PASS` are frozen. A complete study
requires zero remaining `SETTLEMENT_AMBIGUOUS`; missing or invalid required
minute data or manifests is `INCOMPLETE`.

### Scope and deliverables

Documentation only: `docs/BACKTEST.md`, `docs/ARCHITECTURE.md`,
`docs/TEST_PLAN.md`, and this roadmap entry. No loader, runner, strategy,
database, API, Cron, trading, or production change is included.

### Tests and acceptance

The deterministic specification tests cover frozen 1H exit reasons, 1m-only
time resolution, opposite-bracket rejection, 1m/1H aggregate reconciliation,
same-minute funding audit inclusion/exclusion, 60-row integrity, server-time
closure, manifest provenance, report schema selection, unchanged legacy
policies, count reconciliation, and zero-ambiguity acceptance. CI must pass
typecheck, lint, tests, build, and diff checks. No formal bt-policy-003
historical run is performed in the M3-D specification or M3-D.1 review.

### Out of scope

Implementation, M3-C rerun, performance-based settlement selection, strategy
tuning, M4, forward tracking, production deployment, and trading.

## M3-D.1 — Implement bt-policy-003 Intrabar Settlement Resolution

Status: CLOSED / MERGED TO main

### Scope

Implement only the already frozen M3-D `bt-policy-003` settlement-resolution
contract. `baseline-001`, `bt-policy-001`, `bt-policy-002`, strategy
thresholds, funding economics, and the immutable M3-C evidence remain
unchanged.

### Deliverables

The implementation adds a dedicated, usage-driven 1m settlement-window loader
using Binance USDⓈ-M Futures public `/fapi/v1/klines`, the single-study-server-
time closure and exact 1m/1H reconciliation guards, Phase A requirement
discovery, Phase B pure settlement resolution, separate funding-order audits,
intrabar manifests, and isolated `m3-b-report-003` fields. 1m rows never enter
`StrategyInput`; no private API, trading, persistence, or M4 work is included.

### Tests and acceptance

Deterministic tests cover exact 60-row integrity, duplicate/gap/future and
malformed OHLC rejection, frozen 1H reason preservation, first matching minute
resolution, funding boundary and conservative same-minute ordering, manifest
coverage, schema isolation, usage-driven windows, and count reconciliation.
Normal typecheck, lint, test, build, and diff checks must pass. The
bt-policy-003 implementation was merged without running the formal M3-E
evidence run in this implementation milestone.

### Out of scope

Historical evidence generation, strategy tuning, M4, forward tracking,
notifications, deployment, persistence, and trading.

## M3-E — Formal baseline-001 historical evidence under bt-policy-003

Status: CLOSED / INCOMPLETE / EVIDENCE MERGED

### Formal result

The formal `bt-policy-003` COMBINED run was executed exactly once from main
commit `e904d8e47b21f78233266da0f8281fe63d2606ca` using `baseline-001` and
`m3-b-report-003`. The report performance result is **FAIL** because the
frozen Combined and OOS net-R, expectancy-R, and profit-factor gates are not
met. The final M3-E classification is **INCOMPLETE** because the final JSON
does not record the authoritative study `serverTime`, which is required to
audit the shared 1H/4H, funding, mark-price, and 1m settlement clock.

The exact report hash, metrics, intrabar/funding audits, and all manifest
hashes are recorded in `docs/M3_BASELINE_001_POLICY003_RESULTS.md`. The raw
report remains under the ignored `.tmp/backtest/` directory and is not
committed. The merged evidence is documentation-only and does not alter runtime
behavior.

M3-E stops here. `baseline-001` was not tuned, no policy was changed during
the run, and M4 remains pending explicit authorization.

## M3-F — Study Clock Provenance Hardening

Status: CLOSED / MERGED

### Scope

Harden report provenance for future `bt-policy-003` runs only. M3-F does not
rerun baseline-001, regenerate the M3-E report, or change any settlement or
economic rule.

### Frozen compatibility boundary

- M3-E remains **CLOSED / INCOMPLETE** and its committed evidence remains
  immutable.
- Historical `m3-b-report-003` is not silently extended. The current
  `bt-policy-003` runner advances to `m3-b-report-004`.
- `m3-b-report-004.studyServerTime` is required and equals the exact
  `BacktestData.serverTime` originating from `HistoricalStudyData.serverTime`.
- The same study clock continues through intrabar settlement loading; no second
  Binance server-time request or alternate clock is permitted.
- `bt-policy-003` economics, baseline-001, and all prior policy schemas remain
  unchanged. baseline-002 research has not started, and M4 has not started.

### Tests and acceptance

Deterministic tests cover exact clock propagation, schema selection, fail-closed
missing/invalid clocks, deterministic serialization, economic/audit invariance
when only the clock changes, one-clock loader orchestration, and unchanged
legacy schemas. M3-F acceptance requires typecheck, lint, the full test suite,
build, and diff checks to pass. No formal historical run is part of M3-F.

### Out of scope

Historical performance reruns, strategy tuning, baseline-002, bt-policy-004,
M4, trading, private Binance APIs, persistence, and production deployment.

## M3-G — baseline-002 Research Protocol Specification Freeze

Status: CLOSED / MERGED TO main

### Scope

M3-G is documentation-only. It freezes the research protocol for a possible
future `baseline-002` without defining or implementing `baseline-002` itself.
The protocol is recorded in `docs/BASELINE_002_RESEARCH.md` and covers the
historical contamination boundary, the future forward holdout rule, the initial
H1–H5 hypothesis registry, append-only experiment records, small hypothesis-
driven grids, ablation-first comparisons, chronological validation folds,
robustness and concentration gates, density and score diagnostics, and the
complexity penalty.

All data through `2026-08-15T23:59:59.999Z` is explicitly
`RESEARCH-AVAILABLE / SEEN DATA`, not pristine OOS or a true holdout. The true
forward holdout begins at the first fully closed 1H candle strictly after the
final baseline-002 freeze commit/time; its exact timestamp is recorded only
when that later freeze occurs.

### Status and acceptance boundary

- M3-E remains **CLOSED / INCOMPLETE** and its committed evidence is untouched.
- M3-F is **CLOSED / MERGED**; `m3-b-report-004` and its clock provenance are
  unchanged by M3-G.
- `baseline-001` and `bt-policy-001`/`002`/`003` remain unchanged.
- No historical performance run, parameter search, optimization, or
  baseline-002 experiment is executed in M3-G.
- `baseline-002` is **NOT FROZEN**; M3-G.1, M3-G.2, M3-H, and M3-I are
  closed/merged. M3-I returned `NO BASELINE-002 CANDIDATE`; M3-R2-A is now
  under review as a separate Round-002 protocol freeze. M3-J remains blocked
  and not started.
- M4, trading, private Binance APIs, persistence, and deployment remain out of
  scope.

### Required M3-G.2 gate-freeze milestone

M3-G.2 must be completed and merged before any M3-H performance experiment.
Before that merge, no variant performance result, candidate netR/PF/expectancy,
or fold comparison may have been observed or generated. M3-G.2 must freeze the
exact numeric values and comparison rules for aggregate improvement, fold
improvement, catastrophic folds, minimum expectancy and profit factor, symbol
and single-trade concentration, claimed redundancy improvement, minimum
sample, and the simpler-candidate/tie rule. Synthetic fixtures are allowed;
historical candidate-performance runs are not.

After M3-H begins, the gates are immutable. A gate change invalidates the
current research round and requires an explicit new research-round version and
new predeclared protocol. M3-I only applies the already-frozen gates and may
return `NO BASELINE-002 CANDIDATE`; it cannot redefine thresholds or weaken a
failed gate.

## M3-G.1 — Research Tooling / Diagnostics

Status: CLOSED / MERGED TO main

### Scope

M3-G.1 implements only the pure downstream research-domain tooling under
`src/lib/research/`. It consumes explicit normalized records or an adapter from
existing backtest results; it does not load history, call Binance, access
Supabase or the filesystem at runtime, use environment or wall-clock state, or
perform trading/private API actions. Synthetic deterministic fixtures are the
only research inputs used in this milestone.

### Deliverables

- immutable M3-G F1-F6 fold definitions and signal-time-only role selection;
- strategy-version-independent normalized signal records with fail-closed
  duplicate identity validation;
- signal density, unique-hour, repeat-window, separate research-overlap, cost,
  concentration, and deterministic symbol/direction/grade/regime/month/year
  diagnostics;
- caller-supplied score buckets and descriptive monotonicity diagnostics;
- immutable H1-H5 experiment definitions/outcome attachment and deterministic
  control-first audit ordering;
- `m3-g-research-diagnostics-001` provenance/serialization and a
  `bt-policy-003` report contract;
- gate schema validation types only; the real round-001 numeric record is
  frozen separately by M3-G.2.

### Acceptance boundary

- M3-G remains **CLOSED / MERGED** and `docs/BASELINE_002_RESEARCH.md` is
  untouched.
- The dedicated M3-G.1 suite uses synthetic fixtures only; no historical
  candidate result, fold performance comparison, or baseline-001 rerun exists.
- `baseline-001`, `bt-policy-001`, `bt-policy-002`, `bt-policy-003`,
  `m3-b-report-004`, and M3-E evidence are unchanged.
- M3-G.2 owns the real round-001 gate values and is **CLOSED / MERGED**;
  `baseline-002` remains **NOT FROZEN**. M3-H, M3-I, M3-R2-A, and M3-R2-B
  are closed/merged. M3-R2-C is **INVALIDATED / STOPPED** for Round-002,
  M3-R2-D is cancelled for Round-002, M3-J is blocked/not started, and M4
  remains not started.

### Verification

The milestone required typecheck, lint, deterministic tests, build, and diff
checks. It stopped before M3-G.2 and before any historical experiment.

### M3-G.2 verification baseline

Future tooling tests must prove deterministic fold assignment, no random time
shuffle or future leakage, baseline-001 control reproducibility, immutable
experiment IDs and registry records, deterministic candidate ordering,
signal-density/duplicate-window metrics, score buckets, cost metrics,
symbol/direction/regime breakdowns, retained `studyServerTime`, unchanged
execution economics, public-data-only access, and no baseline-002 production
code.

## M3-G.2 — baseline-002 Candidate Selection Gate Freeze

Status: CLOSED / MERGED TO main

M3-G.2 freezes exactly one real machine-readable gate record for
`baseline-002-research-round-001`, sourced from
`2f2c8f442b86bb730745908a6d6bf6a76ac43dd6`. The record lives in
`src/lib/research/selection-gates-round-001.ts` and is documented in
`docs/BASELINE_002_SELECTION_GATES_R1.md`. It includes the aggregate,
validation-fold, catastrophic-fold, expectancy, PF, concentration,
redundancy, sample, fee-burden, and complexity-tie rules, with exact units,
denominators, direction, and comparison semantics. The SHA-covered record also
contains the all-applicable hard-gate conjunction, complete hard-gate identity
list, PF status/Infinity semantics, explicit N/A handling, exact F1-F6
validation construction, non-negative-integer complexity domain, and round
invalidation contract.

This milestone uses synthetic validation only. It does not run or inspect
candidate performance, fetch historical data, rerun baseline-001, implement
baseline-002, or start M3-H. The canonical gate record SHA-256 is recorded in
  the selection-gate document. Gate application/evaluator work is performed
  only in the separate M3-I milestone.

The gate record becomes immutable at the first M3-H performance result. A later
change to any recorded gate value, formula, fold-improvement definition,
catastrophic-fold definition, applicability rule, sample floor, selection tie
rule, or aggregate-validation definition invalidates round-001 and requires a
new research-round version. A failed candidate cannot weaken the gates. If no
candidate later passes every applicable gate, the valid result is
`NO BASELINE-002 CANDIDATE`.

M3-G.1 and M3-G.2 remain closed specification/tooling gates. The sequence is
M3-G → M3-G.1 → M3-G.2 → M3-H → M3-I → M3-J → forward validation after the
baseline-002 freeze. No M3-H result exists or is authorized in M3-G.2.

## M3-H — baseline-002 Research Round-001 Single-Mechanism Experiments

Status: CLOSED / MERGED; RESULTS PRESERVED; `baseline-002` NOT FROZEN

M3-H Stage A froze the machine-readable experiment plan before historical
performance output. Stage B generated one `bt-policy-003` CONTROL report and
derived all 13 candidates offline:

- authoritative main source: `99e8f86207c0bd22facf66d557e2e6f792ba0b6e`;
- research round: `baseline-002-research-round-001`;
- selection gate SHA-256:
  `11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd`;
- plan: `src/lib/research/m3-h-round-001-plan.ts`;
- plan SHA-256:
  `2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a`;
- result identities: one `CONTROL_BASELINE_001` plus exactly 13 single-mechanism
  variants; no combinations and no H5 candidate;
- all selectors receive decision-time snapshots only and derive candidate
  economics from the single authoritative bt-policy-003 CONTROL report;
- execution source: `7b3fa166d01fde79dc95ced182c3c515f904a847`;
- control report SHA-256:
  `0d620013f85bff28de11fc9ca4765d300d29630a0e0e04f9175e9c6b97715020`;
- evidence schema: `m3-h-round-001-report-001`;
- evidence decision: `DEFER_TO_M3_I_FROZEN_GATE_APPLICATION`.

Stage A includes the immutable registry, outcome-blind selectors, deterministic
offline derivation, compact evidence schema, and renderer. Stage B used one
CONTROL capture and no candidate backtest or Binance reruns. M3-H itself did
not apply M3-G.2 gates or freeze `baseline-002`; its committed evidence is the
immutable input to M3-I.

## M3-I — Mechanical Round-001 Candidate Gate Application

Status: CLOSED / MERGED; `baseline-002` NOT FROZEN

M3-I reads only the committed M3-H evidence and the frozen machine definitions.
It does not call Binance, load historical data, rerun CONTROL/backtest/Strategy
Engine, regenerate M3-H evidence, change gates, add candidates, combine
mechanisms, optimize, or tune.

Authoritative inputs:

- source `main`: `533f1017676739cdfb3a377f167b5fc42251c525`;
- input: `docs/evidence/M3_H_ROUND_001_SUMMARY.json`;
- input evidence SHA-256: `883001ac34470120cdbc754c2f47437bf13b6f13ce6ffb3e4f7795558a6a2fc7`;
- selection-gate SHA-256:
  `11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd`;
- experiment-plan SHA-256:
  `2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a`;
- M3-H CONTROL SHA-256:
  `0d620013f85bff28de11fc9ca4765d300d29630a0e0e04f9175e9c6b97715020`;
- M3-H execution source: `7b3fa166d01fde79dc95ced182c3c515f904a847`;
- M3-H studyServerTime: `1787016706276`.

The machine-readable output is
`docs/evidence/M3_I_ROUND_001_SELECTION.json`; the human-readable matrix is
`docs/M3_I_ROUND_001_SELECTION.md`. Integrity is `COMPLETE`, all 13 candidates
are `INELIGIBLE`, no candidate is eligible, and the exact final decision is:

```text
NO BASELINE-002 CANDIDATE
```

Therefore `baseline-002` remains **NOT FROZEN**, M3-J is **BLOCKED / NOT
STARTED**, and M4 remains **NOT STARTED**.

## M3-R2-A — baseline-002 Research Round-002 Protocol Freeze

Status: CLOSED / MERGED; documentation only

M3-R2-A begins the separate `baseline-002-research-round-002` stream after
Round-001 closed with `NO BASELINE-002 CANDIDATE`. The complete frozen protocol
is in `docs/BASELINE_002_RESEARCH_R2.md`.

The Round-002 research universe remains exactly
`2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`, classified as
`RESEARCH_AVAILABLE_SEEN_DATA`. No data after that boundary may be inspected
for Round-002 design or selection, and no result in that interval is true OOS.

The protocol predeclares exactly five mechanism families (H6 strict BTC
alignment, H7 strong symbol regime, H8 recent pullback, H9 volume confirmation,
and H10 breakout buffer) and exactly nine candidates plus the baseline-001
CONTROL. Every candidate is a strict eligibility subset of baseline-001 and
selectors may use only contemporaneous decision-time features.

Round-002 inherits the Round-001 gate values, formulas, semantics, sample
floors, PF status rules, aggregate-validation construction, fold-improvement
definition, catastrophic-fold definition, concentration rules, fee-burden
rule, and selection tie rules unchanged. M3-R2-B may encode them in a
separate machine record but may not alter them. An actual structural
incompatibility stops the round and requires a new research-round decision;
there is no in-round gate-change escape hatch.

`requiredRedundancyImprovement` remains REQUIRED only for declared H1 or H4
mechanisms (including combinations containing either). None of the nine
Round-002 candidates declares H1/H4, so all nine have redundancy-gate
applicability and evaluated status `NOT_APPLICABLE`; N/A is not PASS and
incidental H6-H10 overlap reduction is not an H1/H4 mechanism. The exact
five-step Round-001 tie rule and the non-negative-integer complexity tuple for
each candidate must be frozen in M3-R2-B before performance.

A separate machine-readable Round-002 gate record must be frozen and merged in
M3-R2-B before any performance output. M3-R2-A does not implement selectors,
feature extraction, a runner, a CLI, evidence generation, or baseline-002.

The frozen sequence is M3-R2-A protocol freeze, M3-R2-B machine gate and
synthetic selector tooling, M3-R2-C one authoritative CONTROL capture and
offline derivation, then M3-R2-D mechanical gate application. If no candidate
passes, the exact outcome is `NO BASELINE-002 CANDIDATE — ROUND-002` and M3-J
remains blocked.

## M3-R2-B — Round-002 Machine Gate, Registry, and Pure Selector Tooling

Status: CLOSED / MERGED; pre-performance tooling

M3-R2-B is limited to deterministic, synthetic-fixture tooling for the frozen
Round-002 protocol. It adds the SHA-covered machine gate record, the exact
one-control/nine-candidate registry, frozen complexity tuples and single-value
parameters, the outcome-blind `M3R2DecisionSnapshot` extractor, and pure H6-H10
selectors plus exact-AND combinations C1-C4. H9 uses closed 1H
`Candle.quoteVolume` and excludes the current candle from the previous-20 mean.

The gate SHA is
`9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0` and the
plan SHA is
`82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511`.
All nine Round-002 redundancy gates are `NOT_APPLICABLE`, never `PASS`.

This milestone did not call Binance, load historical data, run CONTROL or
backtest, generate evidence/performance metrics, implement `baseline-002`,
add a CLI/runner, tune parameters, or freeze baseline-002. M3-R2-C was
separately authorized after this merge; its single CONTROL capture completed,
but the Round-002 evidence pipeline was invalidated after performance was
generated. See `docs/M3_R2_C_INVALIDATION.md`.

## M3-R2-C — Round-002 Authoritative CONTROL and Evidence

Status: INVALIDATED / STOPPED; `ROUND_002_INVALIDATION_REQUIRED`

The exact source-freeze commit was
`9df170b7f72a95971825e126d4096e1e4f16be5f` on top of main
`ce50fde82fdbed7c27668647915a2ea5b4c16f79`; its CI Run #69 / ID
`32103930135` passed. The one authorized `baseline-001` / `COMBINED` /
`bt-policy-003` CONTROL completed with `studyServerTime = 1787031883099`,
`7500` formal signals, `7495` executed trades, and zero CONTROL diagnostics.

Offline evidence derivation then exposed two result-affecting defects after
`runBacktest()` returned: aggregate F1-F6 diagnostics were called without
filtering records to the requested inclusive range, and identity hashing used
lexical string ordering instead of the frozen time/symbol/direction order.
The round therefore cannot be patched and rerun. Candidate performance and
Round-002 evidence were not generated, and the captured artifacts are
invalidated-round artifacts only. `M3-R2-D` is cancelled for Round-002;
`baseline-002` remains **NOT FROZEN**, M3-J remains blocked, and M4 remains
not started. The complete closure record is
`docs/M3_R2_C_INVALIDATION.md`.

## M3-R3-A — baseline-002 Research Round-003 Offline Recovery Protocol

Status: CLOSED / MERGED; Round-002 remains INVALIDATED

M3-R3-A creates the separate `baseline-002-research-round-003` protocol after
the Round-002 evidence-pipeline invalidation. It is based on authoritative
main `a20803c9cf33aefcb1d376f916eb9fe666f1bf58` and preserves the exact
Round-002 research universe, F1-F6 folds, CONTROL/candidate registry, H6-H10
selectors, C1-C4 AND composition, parameters, complexity tuples, costs,
`bt-policy-003`, and selection-gate semantics. The machine gate SHA is
`297d658142d870557a175decb75567b68cb72b52a49a8f7c81b0c0af002f3bd2`; the
plan SHA is
`d4238bec817425fddd4a1e556277aa58de84c5986da55a9e08b661cc9f621e67`.

The only protocol repairs are: filter aggregate records to the inclusive
F1-validation-start through F6-validation-end range before diagnostics;
canonicalize formal/executed identity hashes by signal time, frozen symbol
order, and direction; and permit only exact SHA- and envelope-verified reuse
of the existing Round-002 CONTROL/snapshot captures. The verifier parses the
envelope and CONTROL from those same verified raw bytes, validates the
immutable Round-001 evidence SHA, and requires aggregate plus F1-F6
diagnostics parity before reporting all three reuse statuses as passing. The
expected artifact hashes, study clock `1787031883099`, snapshot count `7500`,
and source provenance are recorded in `docs/BASELINE_002_RESEARCH_R3.md`.

M3-R3-A permitted only machine-record validation and synthetic tests. It did
not call Binance, load historical data, run CONTROL/backtest/settlement,
derive candidate diagnostics, apply gates, or modify strategy/candidate
definitions, thresholds, complexity, baseline-001, or `bt-policy-003`.
`baseline-002` remains **NOT FROZEN**. M3-R3-B, M3-R3-C, and M3-R3-C.1/C.2
are **CLOSED / MERGED**. The final Round-003 selection result is
`NO BASELINE-002 CANDIDATE — ROUND-003`; all 9 candidates were ineligible.
M3-J is blocked, and M4 is not started. See
`docs/BASELINE_002_RESEARCH_R3.md`,
`docs/BASELINE_002_SELECTION_GATES_R3.md`, and
`docs/M3_R3_C_SELECTION.md`.

## M3-R3-B — Round-003 Candidate Derivation

Status: CLOSED / MERGED

This step is authorized only for the offline source freeze, synthetic tests,
and later one-time evidence derivation described by the M3-R3-B protocol.
Commit-A CI must pass before the formal offline command runs. Candidate gate
application remains deferred to M3-R3-C; the committed evidence is immutable.

## M3-R3-C — Round-003 Frozen Selection Gate Application

Status: CLOSED / MERGED; NO BASELINE-002 CANDIDATE

This stage applied the frozen gates mechanically to the committed Round-003
evidence only. It did not run performance, recalculate economics, change
gates, freeze `baseline-002`, start M3-J, or start M4. The recovery result is
complete and final: all 9 candidates are ineligible and no baseline-002
candidate was selected.

## M3-R3-C.1/C.2 — Round-003 Selection Implementation Recovery

Status: CLOSED / MERGED

This recovery corrected only the CONTROL count scope and identity-hash
validation defects, then performed the one separately authorized offline
selection. It preserves the frozen gate machine record, plan, candidate
definitions, thresholds, performance evidence, and tie-breaking semantics.
The final result is `NO BASELINE-002 CANDIDATE — ROUND-003`; baseline-002
remains **NOT FROZEN**.

## M3-R4-A — baseline-002 Research Round-004 Diagnosis and Structural Hypotheses

Status: CLOSED / MERGED / DIAGNOSIS AND HYPOTHESIS FREEZE

M3-R4-A starts from authoritative main
`0f994ddde6d3303eb34560cdc1c8babbae5115a5` and uses only the committed
Round-001, Round-002 invalidation, and Round-003 evidence listed in
`docs/BASELINE_002_DIAGNOSIS_R4.md`. Round-001 and Round-003 show that the
tested baseline-001 entry family has not met the frozen economic and
robustness gates; Round-002 performance remains invalidated and excluded.

R4-A retires the already-tested H1-H10 filter/density/cost/score/regime/
pullback/volume/breakout-buffer families and freezes exactly four qualitative
standalone structural hypotheses: H11 breakout retest entry, H12 pullback
reclaim entry, H13 adaptive trend exit, and H14 cross-asset relative-strength
context. Each will have one future variant only. No combinations, threshold
grid, parameter sweep, optimizer, or outcome-dependent choice is permitted.

R4-A is documentation-only. It does not implement H11-H14, create a machine
Gate or Plan record, access new data, run Binance, run a backtest, produce
candidate performance, freeze baseline-002, start M3-J, or start M4. M3-R4-B
must first specify exact formulas, execution semantics, data requirements,
complexity, non-weakened gates, canonical SHAs, and synthetic tests. Only
after M3-R4-B is reviewed and merged may Round-004 performance be authorized.

## M3-R4-B — baseline-002 Research Round-004 Exact Machine Protocol Freeze

Status: UNDER REVIEW / MACHINE PROTOCOL FREEZE; PERFORMANCE NOT AUTHORIZED

M3-R4-B is based on authoritative main
`1bab6066cd4e9933c3d50ab29a38e9ad0792e5c8` and identifies the round as
`baseline-002-research-round-004`. It adds only pre-performance, machine-
readable protocol records, pure decision-time reference helpers, synthetic
tests, and documentation. The canonical Gate SHA is
`c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54`; the
canonical Plan SHA is
`f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981`.

The frozen registry contains exactly the CONTROL
`R4-CONTROL-BASELINE-001` and four standalone candidates in this order:
`R4-H11-BREAKOUT-RETEST`, `R4-H12-PULLBACK-RECLAIM`,
`R4-H13-ADAPTIVE-TREND-EXIT`, and `R4-H14-RELATIVE-STRENGTH`. The protocol
preserves `baseline-001`, `bt-policy-003`, the five-symbol universe, the
existing fee/slippage/funding/SL-first economics, and the exact F1-F6 fold
construction. H11/H12/H14 decision predicates are outcome-blind and may use
only candles closed by signalTime; H13's 48-candle exit overlay is variant-
local and does not alter the global 24-candle policy.

Round-004 gates inherit Round-003 values and semantics. The machine registry
contains 11 hard-gate identities, of which 10 are applicable; the redundancy
gate is `NOT_APPLICABLE` for all four candidates and is excluded from the
conjunction, not treated as a pass. Any gate, formula, candidate, complexity,
cost, fold, applicability, entry/exit, horizon, ranking, funding, or
decision-time semantic change after the first performance result requires
`ROUND_004_INVALIDATION_REQUIRED` and a stop without patching or rerunning the
same round.

### Deliverables

- `src/lib/research/selection-gates-round-004.ts`: hashed Gate record and
  fail-closed validator;
- `src/lib/research/m3-r4-round-004-plan.ts`: hashed Plan, CONTROL contract,
  candidate registry, folds, provenance, and governance boundary;
- `src/lib/research/m3-r4-round-004-protocol.ts`: pure H11-H14 helpers only;
- `tests/m3-r4-b-round004.test.ts`: synthetic machine, decision-time,
  boundary, and fail-closed coverage;
- `docs/BASELINE_002_MACHINE_PROTOCOL_R4.md` and
  `docs/BASELINE_002_SELECTION_GATES_R4.md`.

### Acceptance and out of scope

CI must pass typecheck, lint, tests, and build. No Binance request, HTTP market
data, historical loader, CONTROL capture, backtest, settlement, candidate
performance, evidence derivation, selection, baseline-002 freeze, M3-J, or M4
work is part of M3-R4-B.

## M3-R4-C — baseline-002 Research Round-004 Performance Implementation Source Freeze

Status: **UNDER REVIEW / SOURCE FREEZE; PERFORMANCE NOT EXECUTED**

M3-R4-C is based on authoritative main
`fd42381d903f9b60ec98e7b297578de95dc8160b`. It implements the complete future
Round-004 performance pipeline without running it on historical data. The
frozen round is `baseline-002-research-round-004`, with Gate SHA
`c82757a5e4e3252fcda929fec5c24b83f0408c2c3251125b042c107edcfa4f54` and Plan
SHA `f05a363b7d7e48d9706c7fe471db18c36122e99e4c88884d7df54be2ccf24981`.

The source freeze adds a guarded CLI, an unchanged standard `bt-policy-003`
loader plus H13's `SETTLEMENT_ONLY` held #25–#48 extension, research-only H13
settlement, two-phase requirement discovery/final 1m settlement, same-run
CONTROL parity, H11/H12/H14 decision-time population handling, and the
schema `m3-r4-round-004-report-001` evidence serializer. Decision indexes and
settlement indexes are separate. H13 settlement data is never passed to the
Strategy Engine, and H14 reuses the same-run CONTROL outcome rather than
settling independently.

The CLI requires `--confirm-authoritative-run`, exact source/Gate/Plan SHA
arguments, the exact round id, a clean worktree, successful frozen validators,
and no pre-existing output artifacts before any network access. It rejects
overwrite and publishes future artifacts atomically. The source-freeze branch
does not call the CLI, Binance, the historical loader, CONTROL, settlement,
evidence derivation, candidate selection, or any M3-R4-D gate.

M3-R4-C tests are synthetic and offline. `baseline-001`, `bt-policy-003`, the
five symbols, the global 24-held-candle policy, M3-J, and M4 are unchanged.
`baseline-002` remains **NOT FROZEN**, M3-J remains **BLOCKED / NOT STARTED**,
and M4 remains **NOT STARTED**. See
`docs/M3_R4_C_PERFORMANCE_IMPLEMENTATION.md`.

## M3-R5-B.1A — Round-005 exact protocol and H17 qualification tooling

Status: UNDER REVIEW / PROTOCOL AND QUALIFICATION TOOLING FREEZE; PERFORMANCE NOT AUTHORIZED

M3-R5-B.1A is based on authoritative main
`cb004575fb899d62a4d6e4f5424e3b88a43ac4ac`. It freezes exactly one
provisional standalone variant for each of H15, H16, H17, and H18, including
decision-time formulas, strict next-open entry, stops, targets, holding
horizons, complexity tuples, no-future-data semantics, and synthetic
boundary tests. H17 is conditional on complete canonical UTC 00:00/08:00/16:00
funding coverage for all five symbols. Its qualification report records only
coverage and provenance; it does not expose funding-rate distributions or
performance metrics.

The B.1A CLI is guarded by exact source SHA, round, frozen research range,
clean worktree, and absent-output checks before any future network access. It
publishes no artifact in B.1A. Final Round-005 registry, Gate SHA, Plan SHA,
H17 eligibility, and any performance remain deferred to B.1B. No Binance
request, historical loader, CONTROL, backtest, evidence generation, candidate
selection, baseline-002 freeze, M3-J, or M4 work is part of this stage.
`baseline-002` remains **NOT FROZEN**, M3-J remains **BLOCKED / NOT STARTED**,
and M4 remains **NOT STARTED**. See `docs/M3_R5_B1A_PROTOCOL.md` and
`docs/BASELINE_002_RESEARCH_R5.md`.

## M4 — Realtime Scanner

Status: NOT STARTED

### Scope

Protected finite Vercel scan endpoint called by Supabase Cron; persistence and idempotency.

### Deliverables

`POST /api/cron/scan`, scan-run lifecycle, signal persistence, rankings, structured events, and development Cron setup.

### Tests

Cron security, duplicate calls, data failure, signal snapshot immutability, and persistence tests.

### Integration tests

Supabase development project plus mocked/public market data; no production project assumption.

### Acceptance criteria

One scheduled run completes within runtime budget, bad data creates no signal, and repeated calls do not duplicate signals.

### Known risks

Serverless duration, upstream rate limits, overlapping Cron calls, and database connection limits.

### Out of scope

Real email delivery, dashboard, and all trading.

## M5 — Notifications

### Scope

Gmail SMTP sender, templates, grade policy, safe mode, bounded retry, and delivery tracking.

### Deliverables

Server-only Nodemailer adapter, `notifications` state machine, tests, and manual smoke-test procedure.

### Tests

Mock SMTP, timeout, retry, failure, template, redaction, and safe-mode tests.

### Integration tests

Manual approved Gmail smoke test in a non-production/safe recipient environment.

### Acceptance criteria

Every eligible notification is awaited and persisted as SENT or FAILED; CI never sends a real message.

### Known risks

Gmail policy changes, credentials, spam filtering, and preview leakage.

### Out of scope

Automated trading and unbounded retry.

## M6 — Forward Tracking

### Scope

Track public market outcomes for persisted signals through TP, SL, TIME_EXIT, or INVALIDATED.

### Deliverables

Tracker job/endpoint, result state machine, exit reference rules, and result analytics input.

### Tests

State transitions, 24-candle time exit, R math, same-candle ordering, and idempotent result updates.

### Integration tests

Replay fixture against persisted development signals.

### Acceptance criteria

Signal snapshots remain unchanged and each signal has at most one terminal result.

### Known risks

Intrabar ordering and exact invalidation rules.

### Out of scope

Real stops, real take-profits, and exchange account state.

## M7 — Dashboard & Analytics

### Scope

Private Authenticated Dashboard, Signals, Signal Detail, Analytics, System, and manual decisions.

### Deliverables

Protected pages, session handling, UI labels for reference values, filters, metrics, and decision forms.

### Tests

Component/unit tests and E2E auth/RLS/accessibility tests.

### Integration tests

Authenticated browser against development Supabase project.

### Acceptance criteria

Anonymous users cannot access private data; no trading-terminal controls exist; users can record only their own decisions.

### Known risks

Session refresh, caching, timezone display, and sensitive system information.

### Out of scope

Wallets, accounts, balances, positions, orders, and trading.

## M8 — Production Readiness & Deployment

### Scope

Vercel Preview/Production, Supabase Production, secret separation, monitoring, recovery, and final documentation.

### Deliverables

Deployment runbook, migration/recovery procedure, alerting, security review, smoke tests, and rollback plan.

### Tests

Full verification, security checks, migration restore test, production health check, and manual SMTP smoke test.

### Integration tests

End-to-end production-like flow with explicitly approved non-trading data and recipient.

### Acceptance criteria

Secrets are separated, Cron is authenticated, monitoring explains failures, recovery is documented, and no trading capability exists.

### Known risks

Operational misconfiguration, secret sharing, provider limits, and alert fatigue.

### Out of scope

Automatic trade execution; a future trading phase would require a new requirements and security review.
