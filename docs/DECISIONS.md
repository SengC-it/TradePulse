# Architecture Decisions

Status: M0 decision record

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

## Open decisions

The unresolved strategy choices are enumerated in [STRATEGY.md](STRATEGY.md), including BTC regime thresholds, entry reference, score sub-formulas, invalidation, TIME_EXIT price, and same-candle event ordering. M0 intentionally records recommendations without freezing them.
