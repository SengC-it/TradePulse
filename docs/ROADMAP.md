# TradePulse Milestone Roadmap

Every milestone ends with a review, documentation update, acceptance check, and stop. No milestone is started automatically.

## M0 — Foundation & Architecture

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

### Scope

Implement `MarketDataProvider` and Binance public adapter for the approved five symbols, 1H/4H candles, server time, completeness, ordering, freshness, and malformed-data validation.

### Deliverables

Normalized candle types, provider adapter, validation service, fixtures, provider error codes, and market-data tests.

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

## M2 — Indicators & Strategy Engine

### Scope

Implement approved indicators, BTC/symbol regimes after open decisions are approved, candidate rules, score, grade, and ranking in one pure Strategy Engine.

### Deliverables

Indicator modules, domain types, Strategy Engine, score/ranking modules, and complete deterministic fixtures.

### Tests

Unit and strategy tests for every formula and boundary; shared-engine contract tests.

### Integration tests

Market-data fixture to candidate output; no external send.

### Acceptance criteria

All approved rules are testable, closed-candle-only, versioned, and identical for future realtime/backtest callers.

### Known risks

Ambiguous rules may be incorrectly frozen; no implementation before human decisions are recorded.

### Out of scope

Persistence, Cron, SMTP, dashboard, and real trading.

## M3 — Backtest

### Scope

Historical data loading and a Backtest Runner that calls the M2 Strategy Engine.

### Deliverables

Backtest input contract, result persistence, metrics, and report export.

### Tests

Regression fixtures, shared-engine equivalence, metric edge cases, and drawdown tests.

### Integration tests

Historical data adapter to backtest output on a disposable development database.

### Acceptance criteria

Reports include all required metrics and identify strategy version, data period, symbols, and assumptions.

### Known risks

Look-ahead bias, incomplete historical candles, same-candle TP/SL ambiguity, and survivorship bias.

### Out of scope

Automated optimization, parameter tuning without approval, live scan, notifications, and trading.

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
