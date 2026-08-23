# TradePulse Email Signal Advisory

TradePulse is an advisory system. It reads public Binance market data, evaluates
the existing `baseline-001` Strategy Engine, validates a closed-candle snapshot,
deduplicates a deterministic signal identity, and sends an email for a valid
`LONG` or `SHORT` signal. `NO_SIGNAL` never sends email. A user makes any
manual trading decision; the repository contains no order, account, leverage,
position, or execution API.

## Production entry points

- Scan and scheduler: `GET /api/cron/signal-advisory`
- Authentication: `Authorization: Bearer ${CRON_SECRET}`
- Vercel schedule: `5 * * * *` in `vercel.json`
- Email function: `sendSignalEmail()` in `src/lib/signal-advisory/email.ts`
- Pipeline: `runSignalAdvisoryScan()` in `src/lib/signal-advisory/scan.ts`

The scan is safe to retry at the run level. `scan_runs.run_key` prevents the
same hourly cycle from running twice while its lease is active or after it has
succeeded. A deterministic SHA-256 `signal_id` is derived only from:

`symbol + direction + signalTime + strategyVersion`

An atomic insert into `signal_advisories` claims the first delivery attempt.
`SENT` and `PENDING` rows always return `SKIPPED_DUPLICATE`. A `FAILED` row can
be claimed once more only while the signal is still valid and its
`attempt_count` is below two; the database compare-and-set transition moves it
back to `PENDING` and increments the attempt count. An expired or exhausted
`FAILED` row is not sent again, so SMTP recovery can repair one transient
failure without creating an unlimited retry loop.

## Safety behavior

- Only fully closed candles from the existing market-data validator are used.
- Missing, malformed, partial, or stale snapshot data produces `NO_SIGNAL`.
- Only `LONG` and `SHORT` formal candidates can reach email delivery.
- SMTP failures are persisted as `FAILED` and returned as a partial scan result;
  one later invocation may retry the same valid signal at most once.
- Every scan writes counts, freshness, and errors to `scan_runs` and
  `system_events`.
- `/api/health` exposes `lastSuccessfulScan`, `lastEmailSent`, `lastError`,
  and the strategy version without returning secrets.

## Persistence

The migration `20260823000000_signal_advisory.sql` adds:

- `signal_advisories`: signal log and persistent delivery registry.
- `scan_runs.signals_sent` and `scan_runs.signals_skipped` counters.

`signal_advisories` is service-role-only and stores the advisory values,
delivery status, attempt timestamps/count, SMTP message ID, and failure reason.
It is not an execution ledger.

## Required server environment

Existing Supabase and scheduler variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (server-only)
- `CRON_SECRET` (server-only)

Gmail SMTP variables:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER`
- `SMTP_APP_PASSWORD` (Google App Password; never the account password)
- `ALERT_EMAIL_FROM`
- `ALERT_EMAIL_TO`

The Round-006 research state is independent and remains
`performance = NOT_AUTHORIZED / NOT_GENERATED`. This PR does not run research,
create evidence, freeze baseline-002, or deploy Production.
