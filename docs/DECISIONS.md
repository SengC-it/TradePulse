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

## Deferred decisions

The following decisions remain explicitly marked `DEFERRED_TO_M6` for
production forward tracking and must not be inferred from the historical
backtest policy:

- forward-tracking invalidation event ordering.

`bt-policy-001` defines a historical-only TIME_EXIT price and same-candle
ordering for M3 research. Those assumptions do not change baseline-001 or
settle the M6 production policy. No other baseline-001 strategy rule remains
open for M2-A.
