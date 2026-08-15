# TradePulse Product Requirements

Status: M0 draft for human review
Strategy version in the foundation: `baseline-001`

## Product definition

TradePulse is a private, single-user research system for discovering and evaluating cryptocurrency market opportunities. It consumes public Binance USDⓈ-M Futures market data, evaluates approved rules, ranks candidate signals, notifies the user, tracks what the market did afterward, and exposes performance analytics.

The user makes every trading decision manually. A signal is an informational reference, never an order instruction and never a guarantee of profit.

## Problem

The user needs one auditable place to answer:

1. Did the scheduled scan run?
2. Did valid, fully closed market data arrive for the approved five-symbol pool?
3. Which approved strategy conditions were satisfied?
4. Why was a candidate ranked or filtered?
5. Was an alert sent successfully?
6. What happened to the signal afterward?

## Users and primary jobs

The initial user is the system owner. They need to:

- view the current market regime and recent signals;
- inspect an immutable signal snapshot, indicators, score, and trigger reason;
- receive an email alert for eligible A/B/C signals according to policy;
- record `TRADED`, `SKIPPED`, `EXPIRED`, `INVALIDATED`, or `UNDECIDED` as a human decision;
- review forward results and strategy performance by direction, symbol, and grade;
- diagnose missing scans, bad data, filtered candidates, and failed notifications.

## Approved scope

The product may eventually provide:

- public Binance market-data ingestion for `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, and `BNBUSDT`;
- 4H trend regime and 1H candidate evaluation using only approved indicators;
- deterministic score, grade, and cross-symbol ranking;
- immutable signal snapshots with strategy version and idempotency fingerprint;
- Gmail SMTP notification with delivery state and bounded retry;
- forward tracking with `OPEN`, `TP`, `SL`, `TIME_EXIT`, and `INVALIDATED`;
- private authenticated dashboard and analytics;
- backtests that call the same Strategy Engine used by realtime scans.

## M0 scope

M0 delivers the repository foundation, minimal Next.js App Router application, a non-sensitive health endpoint, environment inventory, migration-based database design, security and authentication design, precise strategy specification with explicit open decisions, notification design, testing plan, and M0–M8 roadmap.

M0 does not run a market scan, calculate indicators, execute strategy logic, run a backtest, send an email, apply a remote migration, deploy production, or connect to any private exchange API.

## Non-functional requirements

- **Safety:** no trading capability or private Binance credential path exists in the current scope.
- **Auditability:** every future formal signal stores a complete snapshot and `strategy_version`.
- **Determinism:** rules are expressed as testable formulas and operate only on closed candles.
- **Idempotency:** duplicate cron calls cannot create or notify the same signal fingerprint twice.
- **Privacy:** the dashboard requires Supabase Auth; exposed tables use RLS; secrets remain server-only.
- **Resilience:** invalid, missing, stale, or inconsistent data produces no formal signal.
- **Observability:** scan runs, system events, signal persistence, and notifications explain the end-to-end outcome.
- **Time correctness:** database timestamps are UTC; display timezone is configuration.
- **Serverless fit:** each scan is a bounded request; no permanent process or infinite loop is allowed.

## Product boundaries

There are no buy/sell buttons, wallet connections, exchange account pages, balances, positions, order pages, or automated stop-loss/take-profit instructions. `entry_reference`, `stop_reference`, and `take_profit_reference` are labeled reference values in every UI and email.

## Success criteria for M0

- A fresh checkout can install pinned dependencies and run the verification commands.
- The repository clearly states the no-trading boundary and milestone stop rule.
- The schema can be reviewed and later applied through a migration without creating trading tables.
- Strategy ambiguity is visible as `OPEN_DECISION`, not hidden in code.
- The architecture has one future Strategy Engine boundary for backtests and realtime.
