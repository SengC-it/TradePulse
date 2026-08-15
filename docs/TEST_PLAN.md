# TradePulse Test Plan

Status: M1 test strategy (M0 coverage retained)

## Test layers

### Unit tests

- Config constants preserve the approved five-symbol universe, score allocation, grade thresholds, and strategy version.
- Candle completeness and validation functions reject forming, stale, missing, out-of-order, or malformed candles.
- EMA20/50/200, RSI14, ATR14, and approved volume calculations use deterministic fixtures.
- Market regime and candidate rules have explicit LONG, SHORT, and NO_TRADE cases.
- Score components and grade boundaries cover exact edges: 69, 70, 74, 75, 84, 85, and 100.
- Entry/stop/TP/TIME_EXIT reference formulas and R calculations are deterministic.
- Signal fingerprints and notification policy are deterministic.
- Score consistency tests prove the five components sum to `total_score` and that `signals.score` cannot differ from it in the persistence contract.
- Scan idempotency tests prove one stable run key per planned UTC cycle, duplicate-cycle skip behavior, and retry of the same row after failure or lease expiry.
- Email templates contain every required field and the no-trading disclaimer.

### Strategy tests

Every rule in `docs/STRATEGY.md` must have a fixed candle fixture with the expected business result. Tests must prove that:

- a valid 4H LONG_ONLY fixture produces LONG eligibility;
- a valid 4H SHORT_ONLY fixture produces SHORT eligibility;
- neither condition produces NO_TRADE;
- a forming 1H candle never produces a formal candidate;
- pullback, breakout, RSI, and regime gates are all required;
- the short mirror uses exact high/low and RSI intervals;
- BTC open-decision behavior cannot be silently assumed active.

### Integration tests

- MarketDataProvider adapter maps public exchange responses to normalized candles.
- Invalid data prevents signal persistence and creates `DATA_ERROR` or `SCAN_FAILED`.
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
