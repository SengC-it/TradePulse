# TradePulse

TradePulse is a private research system for multi-symbol cryptocurrency market analysis, candidate signal generation, email notification, forward tracking, and strategy-performance analysis.

Current milestone: **M3-R2-B — Round-002 machine gates and pure selector tooling under review**.

## Boundary

```text
TRADEPULSE DOES NOT TRADE
```

The current project has no Binance private API integration, account access, wallet connection, order creation, order modification, cancellation, leverage control, margin control, or automated execution. It uses Binance USDⓈ-M Futures public market data only in later milestones. A signal is a research alert and reference value, not an order or a promise of profit.

M1 provides the validated public market-data layer. M2-B provides the pure,
framework-independent indicator and Strategy Engine layer. M3-B adds an
auditable public historical loader and deterministic signal-level backtest
runner that calls the same M2 Strategy Engine. It does not add persistence,
scanning, notifications, deployment, optimization, or trading. M3-C remains
immutable historical evidence; M3-E records the separate bt-policy-003 run and
remains INCOMPLETE. M3-F hardens study-clock provenance; M3-G freezes only the
research protocol, while M3-G.1 adds downstream deterministic diagnostics and
M3-G.2 freezes the round-001 candidate-selection gates. M3-H Stage A froze
the single-mechanism plan before performance, and Stage B generated one
descriptive CONTROL plus 13 offline candidate evidence records. M3-H is closed
and M3-I mechanically applied the frozen gates offline; M3-I is now closed and
the result is `NO BASELINE-002 CANDIDATE`. baseline-002 remains unfrozen.
M3-R2-A is closed/merged. M3-R2-B adds only pre-performance, synthetic,
outcome-blind gate, feature-snapshot, and selector tooling; it does not
generate performance results or start M3-R2-C/D or M3-J.

## Architecture

```text
Binance public market data
        ↓
Market Data Adapter → Candle Validation → Indicator Engine
        ↓
BTC / symbol market regimes → Strategy Engine → Scoring / Ranking
        ↓
Signal Snapshot → Forward Tracking → Analytics → Private Dashboard
        ↓
Notification Engine → Gmail SMTP (server-only, later milestone)
```

- Next.js App Router and TypeScript provide the web application and Node.js Route Handlers.
- Vercel hosts the application and finite-lifetime server functions.
- Supabase provides PostgreSQL, Auth, RLS, Cron, and persistence.
- Gmail SMTP is a server-only notification channel using STARTTLS and an App Password.
- Backtest and realtime scanning must call the same framework-independent Strategy Engine.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for boundaries and request flows.

## Local development

Requirements:

- Node.js 22 or newer
- npm
- A development Supabase project only when Supabase features are exercised

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The non-sensitive health endpoint is available at `http://localhost:3000/api/health`.

No production Supabase project, Gmail App Password, Binance account, API key, or real notification recipient is required for M1, M2-B, or M3-B.

## Commands

```powershell
npm run dev        # local Next.js development server
npm run typecheck  # TypeScript check
npm run lint       # ESLint flat-config check
npm test           # deterministic unit tests
npm run build      # production build
npm run market:smoke # manual public Binance market-data smoke test
npm run backtest:run -- --period DEV # local historical report; public data only
npm run research:m3i:select # offline mechanical M3-I gate application
npm run verify     # typecheck, lint, tests, and build
```

The backtest CLI writes generated reports only under the ignored
`.tmp/backtest/` directory. CI uses mocked historical transport and does not
call Binance. A formal DEV/OOS/COMBINED baseline study is M3-C and is not run
as part of M3-B.

Dependencies are pinned in `package.json`; `package-lock.json` is committed for reproducible installs.

## Environment variables

Copy `.env.example` to `.env.local` for local work. Values in `.env.local` must never be committed.

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are the only Supabase values allowed in browser code.
- `SUPABASE_SECRET_KEY`, `CRON_SECRET`, and SMTP credentials are server-only.
- Never add a `NEXT_PUBLIC_` prefix to a secret, service-level key, cron secret, or SMTP variable.

The complete variable inventory and preview-safe notification defaults are in [.env.example](.env.example) and [docs/SECURITY.md](docs/SECURITY.md).

## Supabase

The initial database design is committed as a migration under `supabase/migrations/`. M1 does not add a candles or market-data table and does not apply migrations to any remote project. Use a separately identified development project and the Supabase CLI workflow before applying migrations.

The migration enables RLS on every `public` table, keeps user decisions scoped to `auth.uid()`, and creates no real-trading tables. See [docs/DATABASE.md](docs/DATABASE.md).

## Vercel and scheduling

Vercel runs the Next.js application and Node.js Route Handlers. Supabase Cron is the planned hourly scheduler and will call a protected `POST /api/cron/scan` endpoint with `Authorization: Bearer <CRON_SECRET>`. The formal scanner endpoint is intentionally out of scope for M1 and is not deployed by this repository yet.

## Gmail SMTP

The later notification milestone uses `smtp.gmail.com` on port `587` with STARTTLS and a Google App Password. The App Password is created only after Google 2-Step Verification is enabled, stored only in a server environment, and never exposed to the browser or logs. Preview deployments default to notification safe mode.

## Milestones

| Milestone | Scope |
| --- | --- |
| M0 | Foundation & Architecture |
| M1 | Binance public market data and candle validation (closed) |
| M2-B | Indicators, regimes, pure strategy engine, scoring, ranking (closed) |
| M3-A | Backtest specification freeze (closed / merged) |
| M3-B | Historical loader and deterministic backtest runner (implemented / merged) |
| M3-C | Baseline historical run and evidence review (`bt-policy-002` Formal Run #1: INCOMPLETE; evidence Draft PR) |
| M3-D.1 | Intrabar settlement resolution (`bt-policy-003` implementation closed / merged) |
| M3-E | `bt-policy-003` baseline historical evidence (`INCOMPLETE`; evidence merged) |
| M3-F | Study clock provenance hardening (closed / merged) |
| M3-G | baseline-002 research protocol specification (closed / merged) |
| M3-G.1 | Research tooling and diagnostics (closed / merged; synthetic fixtures only) |
| M3-G.2 | Candidate-selection gate freeze (closed / merged; round-001 gates only) |
| M3-H | Round-001 single-mechanism research (closed / merged; evidence preserved) |
| M3-I | Round-001 mechanical candidate gate application (closed / merged; no baseline-002 candidate) |
| M3-R2-A | Round-002 research protocol freeze (closed / merged) |
| M3-R2-B | Round-002 machine gates and pure selector tooling (under review; pre-performance) |
| M4 | Realtime scanner, protected endpoint, persistence (not started) |
| M5 | Gmail notifications and delivery tracking |
| M6 | Forward tracking and signal results |
| M7 | Private dashboard and analytics |
| M8 | Production readiness, deployment, monitoring, and recovery |

Each milestone requires tests, documentation updates, acceptance review, and an explicit stop. The detailed scope is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Project documents

- [PRD](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Market data](docs/MARKET_DATA.md)
- [Strategy specification](docs/STRATEGY.md)
- [Backtest specification](docs/BACKTEST.md)
- [Database design](docs/DATABASE.md)
- [Notification design](docs/NOTIFICATIONS.md)
- [Security design](docs/SECURITY.md)
- [Test plan](docs/TEST_PLAN.md)
- [Roadmap](docs/ROADMAP.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Long-term agent constraints](AGENTS.md)
