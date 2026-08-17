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

Status: SPECIFICATION ONLY / DRAFT PR

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
same study server time. The first 1m bracket touch determines the exit minute;
same-minute TP/SL remains SL-first. Funding before/after the exit minute is
included/excluded by timestamp, while same-minute funding uses the frozen
conservative negative-cost rule with `CONSERVATIVE_SAME_MINUTE` provenance.

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

The deterministic specification tests cover minute ordering, bracket
resolution, same-minute conservative funding, 60-row integrity, server-time
closure, manifest provenance, report schema selection, unchanged legacy
policies, and zero-ambiguity acceptance. CI must pass typecheck, lint, tests,
build, and diff checks. No formal bt-policy-003 historical run is performed in
M3-D.

### Out of scope

Implementation, M3-C rerun, performance-based settlement selection, strategy
tuning, M4, forward tracking, production deployment, and trading.

## M4 — Realtime Scanner

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
