# TradePulse Notification Design

Status: M0 design only; no SMTP sender or formal scan exists yet.

## Transport

The later notification adapter uses Gmail SMTP from a Vercel Node.js Function:

```text
Host: smtp.gmail.com
Port: 587
Security: STARTTLS
Authentication: Gmail / Google Workspace account + App Password
Library: Nodemailer (server-only)
```

Google 2-Step Verification is required before an App Password can be created. The App Password is not the account password and must never be placed in source control, browser code, a `NEXT_PUBLIC_` variable, or logs.

## Policy

The policy is centralized, audited configuration:

| Grade | Default M0 policy | Meaning |
| --- | --- | --- |
| A | Send | High-priority alert |
| B | Send | Normal alert |
| C | Do not send | Conservative default; configurable only through an approved policy change |
| `<70` | Do not send | Keep internal scan statistics only |

Preview deployments default to notification safe mode and must not use the production recipient by default. A user-facing configuration must not turn frozen strategy parameters into arbitrary production behavior.

## Required email content

Subject and body must clearly identify the message as a TradePulse strategy signal alert and include:

- symbol and direction;
- grade and total score;
- signal time and signal candle time;
- BTC market regime and symbol market regime;
- `Entry Reference`, `Stop Reference`, `Take Profit Reference`, and `Risk / Reward`;
- EMA20, EMA50, EMA200, RSI14, and ATR14 values;
- trigger reason and invalidation condition;
- dashboard link;
- the disclaimer: “This is a strategy signal alert, not automated trading, and it does not guarantee profit.”

Every reference field must be labeled `Reference` or `Signal Reference`; the email must not call it an order, execution, or guaranteed entry.

## Delivery lifecycle

```text
Candidate accepted
  → insert signal (idempotent)
  → insert notification PENDING (unique signal/channel/recipient)
  → await SMTP send with timeout
  → mark SENT + sent_at
  → or mark FAILED + last_error + attempt_count
```

The scan function must await the sender before returning its HTTP response. It must not depend on an unawaited background task after the Vercel Function finishes.

## Reliability rules

- Use a bounded connection/send timeout.
- Retry only a small, fixed number of times for retryable transport errors.
- Persist each attempt count and last error.
- Never retry indefinitely.
- Do not log SMTP passwords, App Passwords, authorization headers, or full message credentials.
- On duplicate signal insertion, do not create a second notification.
- A failed notification must remain visible in the System view for diagnosis and controlled retry.

## Template and tests

The future template is a pure function from a signal snapshot to subject/text/HTML. It must be tested without SMTP. Nodemailer is mocked in unit/integration tests. A production SMTP smoke test is manual and explicitly gated; CI must never send a real Gmail message.

## Future environment variables

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_APP_PASSWORD
ALERT_EMAIL_FROM
ALERT_EMAIL_TO
APP_BASE_URL
NOTIFICATION_SAFE_MODE
```

All are server-only except the dashboard URL rendered into a server-generated message.
