# TradePulse Security Design

Status: M0 security review and constraints

## Absolute boundary

```text
TRADEPULSE DOES NOT TRADE
```

M0 contains no Binance private API, account API, balance lookup, position lookup, order endpoint, wallet connection, leverage or margin action, withdrawal permission, or trading credential. The repository must not gain any of these capabilities without a separately approved project phase.

## Secret inventory

| Secret or sensitive value | Allowed location | Forbidden location |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | Vercel Server environment / local ignored env | Browser, Git, `NEXT_PUBLIC_*`, logs |
| `CRON_SECRET` | Vercel Server environment and approved Supabase secret storage | Code, SQL plaintext, browser, logs |
| `SMTP_APP_PASSWORD` | Vercel Server environment / local ignored env | Browser, Git, logs |
| Supabase Auth tokens | HttpOnly/session handling and server request context | Logs, analytics payloads, source |
| Supabase publishable key | Browser and server client | Not a substitute for a secret key |

`.env.example` contains placeholders only. `.env.local` and all other `.env` files are ignored.

## Supabase Auth and RLS

- The Dashboard, Signals, Signal Detail, Analytics, and System pages require Supabase Auth.
- Server-side session validation follows current Supabase SSR guidance; server code does not trust an unvalidated cookie session.
- Public-schema tables have RLS enabled in the migration.
- `authenticated` is not an application authorization decision. Every global TradePulse read requires an enabled row in `tp_authorized_users` for the current `auth.uid()`.
- The current model is deliberately simple: an explicit allowlist with one `OWNER` row and zero or more `AUTHORIZED` rows. Both enabled labels grant the same read boundary; the owner distinction is for provisioning ownership, not a browser role-management API. The migration does not seed a real owner; provisioning is a server-side/admin operation using the Auth user UUID.
- `tp_authorized_users` is itself RLS-protected. A browser session can see only its own authorization row and has no insert, update, or delete policy.
- `tp_user_decisions` requires both explicit TradePulse authorization and `(select auth.uid()) = user_id` for every read/write policy. It remains strictly user-owned.
- Global tables have no browser write policies. Their authenticated table grants are filtered by the explicit authorization predicate.
- Browser code uses only Supabase URL and publishable key.
- The secret/service-level client is server-only and is reserved for bounded server operations.

The authorized-user predicate is evaluated against a database table rather than user-editable JWT metadata. Removing or disabling an authorization row therefore changes the database decision directly and does not depend on a stale client-controlled claim.

## Cron endpoint

The future `POST /api/cron/scan` endpoint must:

1. require `Authorization: Bearer <CRON_SECRET>`;
2. return `401` or `403` for missing, malformed, or wrong secrets;
3. compare the secret without logging either value;
4. reject unexpected methods;
5. create no work before authentication;
6. use a finite runtime and a bounded request budget;
7. be configured only in Supabase Cron / Vercel server settings, never in browser variables.

M0 includes and tests the isolated cron-header authorization helper but does not expose the formal scan route.

## Data integrity and privacy

- Formal signals are immutable snapshots; later strategy changes never rewrite them.
- Composite database uniqueness prevents duplicate signal fingerprints.
- `tp_signal_scores` has a database `CHECK` constraint requiring `total_score` to equal the exact sum of its five components.
- The signal persistence service calculates one score value and writes `tp_signals.score` and `tp_signal_scores.total_score` in one transaction; deferred database triggers reject a missing score row or cross-table mismatch. No layer may silently accept two different values.
- Notification uniqueness prevents duplicate delivery records.
- `tp_scan_runs.run_key` is unique per planned UTC scan cycle. Retries lock and reuse the same row, and an unexpired lease prevents a second worker from running the full cycle concurrently.
- All database timestamps are UTC `timestamptz`.
- Structured logs include timestamp, environment, scan ID, symbol, operation, status, and error code, but not credentials or full user tokens.
- Error messages stored in `tp_system_events` and `tp_notifications` must be sanitized before persistence.
- Health responses expose only application status, environment, build/version, and non-sensitive database configuration state.

## Gmail controls

- Use STARTTLS on port 587.
- Use a dedicated Gmail / Workspace account or sender identity where appropriate.
- Use a Google App Password, never the primary account password.
- Keep Preview notification safe mode enabled.
- Bound SMTP timeout and retries; await the send before returning.
- Revoke an App Password when the environment or sender is retired.

## Supply-chain and deployment controls

- Dependencies are pinned and `package-lock.json` is committed.
- Use Node.js 22+ for current Supabase client compatibility.
- Keep Preview, Local, and Production variables separate.
- Do not apply a migration to an unknown project.
- Review Vercel runtime and duration settings before enabling scanning.
- Run dependency/security checks in CI before production enablement.

## Threat model summary

| Threat | Control |
| --- | --- |
| Anonymous or unauthorized access to signals | Auth gate plus explicit authorized-user RLS with no anon policy |
| User decision reassignment | `auth.uid()` `USING` and `WITH CHECK` policies |
| Duplicate cron or email | Authenticated endpoint plus database uniqueness |
| Preview alert leakage | Safe mode and environment-separated recipients |
| Bad market data | Candle validation and no-signal-on-error rule |
| Secret leakage | Server-only variable names, no logging, ignored env files |
| Accidental trading | No private client, no trading schema, standing AGENTS.md boundary |
