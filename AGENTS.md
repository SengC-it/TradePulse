# TRADEPULSE DOES NOT TRADE

This file is a standing project constraint. It applies to every future change unless the user explicitly replaces it with a reviewed milestone decision.

## Product boundary

- TradePulse is a market-analysis, candidate-signal, notification, forward-tracking, and analytics system.
- The current and planned M0–M8 scope does not include real trading.
- Do not add Binance private APIs, account APIs, balances, positions, order creation, order modification, order cancellation, leverage changes, margin changes, wallet connections, withdrawal permissions, or automated execution.
- Do not request, store, log, or test Binance private credentials.
- Public market data is the only Binance data source allowed before a separately approved trading phase.

## Strategy integrity

- Do not change frozen strategy conditions without explicit human approval.
- Do not tune parameters to improve backtest returns without a documented Strategy Change and a new `strategy_version`.
- Do not add symbols beyond `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, and `BNBUSDT` without approval.
- Do not add unapproved indicators, machine learning, LLM judgment, news sentiment, grid logic, or martingale logic.
- Backtest and realtime scanning must call one framework-independent Strategy Engine. Never create separate strategy logic for backtest and live scanning.
- Formal signals must use fully closed candles only.

## Data and security

- All database timestamps are UTC `timestamptz`; convert only at the display boundary.
- Every formal signal stores an immutable strategy snapshot and `strategy_version`.
- Signal idempotency must cover at least strategy version, symbol, direction, and signal candle time.
- All exposed Supabase tables must have RLS and policies matching the actual ownership model.
- All schema changes must be committed as Supabase migrations. Do not rely on manual Dashboard-only schema changes.
- Supabase publishable keys may be used in browser code. Supabase secret/service-level keys, `CRON_SECRET`, SMTP credentials, and Auth tokens are server-only.
- Never create `NEXT_PUBLIC_SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, or `NEXT_PUBLIC_SMTP_*` variables.
- Do not log credentials, tokens, App Passwords, or complete authorization headers.
- Cron calls must authenticate with `Authorization: Bearer <CRON_SECRET>`; an unauthenticated scan endpoint is not acceptable.

## Engineering scope

- Keep Strategy Engine independent from Vercel, Supabase, Gmail, HTTP, React, and database code.
- Prefer the smallest implementation that satisfies the current milestone.
- Do not enter a later milestone automatically. M0 must stop before M1.
- Do not apply migrations to an unknown or production Supabase project.
- Do not create `real_orders`, `real_fills`, or `real_positions` tables.
- Preview deployments must not send production notifications by default.

## Milestone discipline

Each milestone must define scope, deliverables, unit tests, integration tests, acceptance criteria, known risks, and out of scope. Before reporting completion:

1. Run the applicable build, type check, lint, and test commands.
2. Update the relevant documentation and record any open decisions.
3. Report security boundaries and test results.
4. Stop at the milestone boundary. Do not start the next milestone without explicit approval.
