# TradePulse Test Plan

Status: M0 test strategy

## Test layers

### Unit tests

- Config constants preserve the approved five-symbol universe, score allocation, grade thresholds, and strategy version.
- Candle completeness and validation functions reject forming, stale, missing, out-of-order, or malformed candles.
- EMA20/50/200, RSI14, ATR14, and approved volume calculations use deterministic fixtures.
- Market regime and candidate rules have explicit LONG, SHORT, and NO_TRADE cases.
- Score components and grade boundaries cover exact edges: 69, 70, 74, 75, 84, 85, and 100.
- Entry/stop/TP/TIME_EXIT reference formulas and R calculations are deterministic.
- Signal fingerprints and notification policy are deterministic.
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
- Signal insertion is idempotent for the same version/symbol/direction/candle tuple.
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

## M0 executed checks

The M0 repository must pass:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

M0 unit tests cover fixed configuration, health redaction, and cron authorization. Domain, database, SMTP, and E2E tests are planned for their milestones because the corresponding systems are intentionally not implemented yet.

## Test data and safety

- Use deterministic fixtures and mocked transport.
- Never commit live credentials, real App Passwords, or production database URLs.
- Never use a real recipient in automated tests.
- Production SMTP smoke tests are manual, explicitly approved, and run only after environment review.
