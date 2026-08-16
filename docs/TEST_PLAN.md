# TradePulse Test Plan

Status: M2-B implementation and deterministic test coverage (M0/M1 coverage retained)

## Test layers

### Unit tests

- Config constants preserve the approved five-symbol universe, score allocation,
  grade thresholds, and strategy version baseline-001.
- Candle completeness and validation functions reject forming, stale, missing, out-of-order, or malformed candles.
- EMA20/50/200 tests prove standard alpha, SMA seeding for each period,
  recurrence, and forming-candle exclusion.
- RSI14 tests prove Wilder SMA seeding, Wilder smoothing, and the exact
  average-loss/average-gain edge results 100, 0, and 50.
- ATR14 tests prove true-range selection, first high-low TR fallback, SMA
  seeding, Wilder smoothing, and forming-candle exclusion.
- Fail-closed denominator tests prove ATR14_1H = 0 makes a candidate
  ineligible and ATR14_4H = 0 prevents normalized regime or Trend Strength
  values from qualifying.
- Required-indicator validation tests prove missing, undefined, NaN, and
  infinite indicator/reference values make the candidate ineligible and never
  produce an Infinity, NaN, or fallback score.
- Warm-up tests prove insufficient EMA200 history, RSI14 history, or ATR14
  history makes the candidate ineligible without shortening a period,
  changing a seed, extrapolating, or using a fallback indicator.
- Volume denominator tests prove fewer than 20 prior fully closed quoteVolume
  candles and a previous20QuoteVolumeMean of 0 make the candidate ineligible.
- No-epsilon tests prove invalid ATR and volume denominators never use zero,
  epsilon, Infinity, or another substitute.
- Market regime tests have explicit LONG_ONLY, SHORT_ONLY, and NO_TRADE cases,
  including strict directional boundaries.
- BTC regime tests cover BTC_STRONG_BULL, BTC_STRONG_BEAR, BTC_NEUTRAL, and
  the exact directional gating table. BTCUSDT proves that cross-symbol gating
  is not applied to itself.
- Invalid BTCUSDT 4H input tests prove non-BTC candidates are blocked and the
  invalid input is never converted into BTC_NEUTRAL.
- Pullback tests cover EMA20/EMA50 touches, LOW versus HIGH directionality,
  every W_t position from t-1 through t-5, highest applicable depth, and
  recency bonuses.
- Breakout tests cover distance <= 0, the strict 0 to 0.10 interval, and the
  0.10, 0.25, and 0.50 thresholds for both directions.
- RSI candidate tests cover strict edges at 30, 50, and 70.
- Score component tests cover every threshold and prove that the five
  components sum to total_score.
- Entry/stop/TP tests prove the current closed-candle entry reference, exact
  W_t exclusion of the signal candle, stop offsets, inclusive stop_atr
  boundaries 0.8 and 3.0, rejection outside the guard, and fixed 2R TP.
- Grade boundaries cover exact totals 69, 70, 74, 75, 84, 85, and 100.
- Deterministic ranking tests prove total-score descending order followed by
  BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT tie order.
- Strategy Engine boundary tests prove no Binance URL/client, HTTP, database,
  email, or trading dependency and no side effects.
- As-of/look-ahead tests prove every consumed candle has `closeTime <=
  evaluationTime`, future 4H data fails closed before symbol/BTC regime or
  score calculation, and invalid evaluation time never falls back to the wall
  clock.
- Signal fingerprints and notification policy are deterministic.
- Score consistency tests prove the five components sum to `total_score` and that `signals.score` cannot differ from it in the persistence contract.
- Scan idempotency tests prove one stable run key per planned UTC cycle, duplicate-cycle skip behavior, and retry of the same row after failure or lease expiry.
- Email templates contain every required field and the no-trading disclaimer.

### Strategy tests

Every rule in docs/STRATEGY.md must have a fixed candle fixture with the
expected business result. Tests must prove that:

- a valid 4H LONG_ONLY fixture produces LONG eligibility;
- a valid 4H SHORT_ONLY fixture produces SHORT eligibility;
- an incomplete or mixed 4H condition produces NO_TRADE;
- BTC_STRONG_BULL blocks SHORT and permits LONG for non-BTC symbols;
- BTC_STRONG_BEAR blocks LONG and permits SHORT for non-BTC symbols;
- BTC_NEUTRAL permits both directions according to the symbol regime;
- BTCUSDT is not cross-gated by its own BTC regime;
- a forming 1H candle never produces a formal candidate;
- pullback, breakout, RSI, stop guard, and BTC gates are all required;
- the short mirror uses exact high/low, breakout, stop, and RSI intervals;
- strict RSI edges at 30, 50, and 70 are rejected where the candidate rule
  requires an open interval;
- all component thresholds and grade thresholds match the frozen tables;
- equal-score candidates use the fixed research-universe order;
- the engine returns serializable deterministic output without side effects.
- invalid BTC regime input blocks non-BTC candidates and cannot produce a
  BTC_NEUTRAL result;
- invalid ATR, volume, or warm-up input produces NO FORMAL SIGNAL.
- an as-of historical dataset and an equivalent realtime-shaped dataset produce
  the same result, while future candles produce `FUTURE_DATA`.

### Integration tests

- MarketDataProvider adapter maps public exchange responses to normalized candles.
- A normalized closed-candle fixture produces the same Strategy Engine result
  regardless of whether it is supplied by a realtime or backtest adapter.
- Invalid data prevents signal persistence and creates `DATA_ERROR` or `SCAN_FAILED`.
- The Strategy Engine performs no database write, email send, HTTP request, or
  trading action.
- Database migration applies to a disposable development database and RLS policies behave as designed.
- RLS isolation test design below proves an authenticated user without an authorization row cannot read global TradePulse tables, while an enabled authorized user can read them.
- Signal insertion is idempotent for the same version/symbol/direction/candle tuple.
- A duplicate planned scan cycle conflicts on `scan_runs.run_key` and does not create a second run row.
- Notification records transition PENDING → SENT or PENDING → FAILED.
- Forward tracker creates one terminal result and does not mutate the signal snapshot.

### Notification tests

- SMTP configuration rejects missing server-only values.
- Nodemailer is mocked; no CI test sends a real email.
- Timeout, retry limit, and exception capture are tested.
- A/B/C policy and safe mode are tested.
- The template contains required references and disclaimer without trading language.

### Cron security tests

- Missing secret returns 401/403.
- Wrong secret returns 401/403.
- Malformed or non-Bearer header returns 401/403.
- Correct secret permits the handler.
- Repeating the same scheduled hour cannot create a duplicate signal or email.

### M0 database/RLS test design

These cases are intended to run against an explicitly selected disposable Supabase project or local database after the migration is applied. M0 does not apply migrations to a remote project, so these database tests are designed but not executed here.

| Case | Session/role | Expected result |
| --- | --- | --- |
| Anonymous read of each global table | `anon` | Denied by grant and/or RLS |
| Authenticated user absent from `tradepulse_authorized_users` reads `signals`, `signal_scores`, `signal_results`, `notifications`, `scan_runs`, `system_events`, `strategy_versions`, `backtest_runs`, or `backtest_signals` | `authenticated`, `auth.uid() = user_a` | Empty result / denied; no global rows visible |
| Enabled owner reads global tables | `authenticated`, `auth.uid() = owner_id`, matching enabled row | Rows visible |
| Disabled owner reads global tables | `authenticated`, matching row with `enabled = false` | No global rows visible |
| Authorized user reads authorization table | `authenticated` | Only that user's authorization row visible |
| User decision read/write for own row | Authorized `user_a` | Own row allowed |
| User decision read/write for another user's row | Authorized `user_a`, row `user_b` | Denied by `auth.uid()` ownership predicate |
| Non-authorized user decision read/write | Authenticated `user_b` without allowlist row | Denied even when `user_id = user_b` |
| Score total mismatch | Database transaction | Component `CHECK` rejects a non-sum; deferred trigger rejects a mismatch with `signals.score` |
| Signal without score row | Database transaction commit | Deferred trigger rejects the incomplete signal snapshot |
| Duplicate scan claim | Two workers, same `run_key` | One unique row; second worker skips or retries the locked existing row according to lease/status |

The RLS assertions must inspect both table privileges and visible rows. Tests must not use a service-level key to simulate a browser session; service credentials bypass RLS and are server-only.

### Backtest regression tests

- Backtest calls the same Strategy Engine module as realtime.
- A frozen fixture produces the same candidate and score in both adapters.
- Historical signal snapshots keep their original strategy version.
- Metrics cover total signals, win rate, net R, profit factor, expectancy, average win/loss R, maximum drawdown, direction, symbol, and grade.

## M2-B execution boundary

M2-A was documentation-only and is closed. M2-B implements the pure indicator,
candidate, score, ranking, and engine tests described above. The implemented
tests use deterministic in-memory Candle fixtures only; they do not call
Binance, Supabase, HTTP, SMTP, or any other external service.

The M2-B suite currently contains 51 passing tests across the existing M0/M1
coverage and the new indicator/Strategy Engine coverage. Realtime-shaped and
backtest-shaped normalized inputs are both evaluated through the same engine
and are asserted to produce deeply equivalent results.

### E2E tests

After the private dashboard exists:

- anonymous user is redirected or rejected;
- authenticated user can view signals and detail;
- authenticated user can create/update only their own manual decision;
- no page includes buy/sell/order/wallet/account-balance controls;
- System view explains scan and notification outcomes.

## M1 market-data tests

M1 adds deterministic tests in `tests/market-data.test.ts` for:

- 1h/4h interval definitions and Binance twelve-field Kline normalization;
- closed-candle filtering using Binance server time, including forming-candle exclusion;
- exact 250-candle history selection and deterministic freshness boundaries;
- numeric, timestamp, OHLC, ordering, duplicate, gap, and insufficient-history failures;
- documented request parameters for `/fapi/v1/klines` and server-time diagnostics, including operation versus final-attempt timing;
- bounded 429/5xx retry, `Retry-After` below/equal/above the maximum, invalid `Retry-After`, ordinary 4xx fail-fast behavior, timeout classification, and HTTP 451 access restriction classification;
- a mocked Binance provider contract for all five symbols and both timeframes;
- partial snapshot behavior when one approved symbol is unavailable.

The M1 tests never call Binance. The manual public smoke test is separate:

```powershell
npm run market:smoke
```

It is allowed to access only Binance public market-data endpoints and requires no credentials.

## M0 executed checks

The M0 repository must pass:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

M0 unit tests cover fixed configuration, health redaction, cron authorization, score consistency, and scan-run idempotency. Database/RLS, domain, SMTP, and E2E tests are planned or designed for their milestones because the corresponding systems are intentionally not implemented yet.

## Test data and safety

- Use deterministic fixtures and mocked transport.
- Never commit live credentials, real App Passwords, or production database URLs.
- Never use a real recipient in automated tests.
- Production SMTP smoke tests are manual, explicitly approved, and run only after environment review.
