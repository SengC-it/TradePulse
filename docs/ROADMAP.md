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

Status: SPECIFICATION FROZEN / DOCUMENTATION ONLY

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

Status: PLANNED / NOT STARTED

### Scope

Load auditable Binance USDⓈ-M Futures public historical candles and funding
records, build as-of inputs, call the existing M2 Strategy Engine, and apply
`bt-policy-001` deterministically.

### Deliverables

Historical loader, integrity validation, manifest/checksum, deterministic
signal-level runner, and DEV/OOS/COMBINED report output. No second strategy
implementation is permitted.

### Tests

The M3-B tests documented in `docs/TEST_PLAN.md`, including no-future-data,
warm-up, duplicate/gap/malformed-data failure, entry bracket, SL-first,
24-bar TIME_EXIT, funding, R/fee/slippage, metric edge cases, deterministic
drawdown, and acceptance-gate fixtures.

### Integration tests

Approved public Binance historical-data retrieval and reproducible local
report generation. No private API, account data, database persistence, or
production deployment is assumed.

### Acceptance criteria

Reports include both version identifiers, data manifests, DEV/OOS/COMBINED
metrics, all frozen assumptions, incomplete-data outcomes, and explicit
signal-level disclaimers. M3-B does not tune baseline-001.

### Known risks

Look-ahead bias, incomplete historical candles, settlement-policy drift, and
survivorship bias.

### Out of scope

Automated optimization, parameter tuning without approval, M3-C acceptance,
live scan, notifications, M6 forward tracking, and trading.

## M3-C — Baseline Historical Run + Evidence Review

Status: PLANNED / NOT STARTED

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
