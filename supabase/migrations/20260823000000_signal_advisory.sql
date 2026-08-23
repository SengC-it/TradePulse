-- M3-R7 signal advisory delivery registry and scan observability.
-- This table is service-side only. It is not an order, fill, position, or
-- account-execution table.

alter table public.scan_runs
  add column signals_sent integer not null default 0
    check (signals_sent >= 0),
  add column signals_skipped integer not null default 0
    check (signals_skipped >= 0);

create table public.signal_advisories (
  signal_id text primary key,
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  strategy_id text not null,
  strategy_version text not null references public.strategy_versions(version),
  signal_time timestamptz not null,
  signal_valid_until timestamptz not null check (signal_valid_until > signal_time),
  current_reference_price numeric(30, 12) not null check (current_reference_price > 0),
  suggested_entry_reference numeric(30, 12) not null check (suggested_entry_reference > 0),
  stop_loss numeric(30, 12) not null check (stop_loss > 0),
  take_profit numeric(30, 12) not null check (take_profit > 0),
  risk_reward numeric(8, 4) not null check (risk_reward > 0),
  score numeric(5, 2) not null check (score >= 70 and score <= 100),
  grade text not null check (grade in ('A', 'B', 'C')),
  market_regime jsonb not null default '{}'::jsonb check (jsonb_typeof(market_regime) = 'object'),
  data_freshness jsonb not null default '{}'::jsonb check (jsonb_typeof(data_freshness) = 'object'),
  recipient text not null,
  scan_run_id uuid not null references public.scan_runs(id) on delete restrict,
  delivery_status text not null default 'PENDING'
    check (delivery_status in ('PENDING', 'SENT', 'FAILED')),
  email_message_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_failure_at timestamptz
);

create index signal_advisories_signal_time_idx
  on public.signal_advisories (signal_time desc);
create index signal_advisories_delivery_status_idx
  on public.signal_advisories (delivery_status, created_at desc);
create index signal_advisories_sent_at_idx
  on public.signal_advisories (sent_at desc)
  where sent_at is not null;

alter table public.signal_advisories enable row level security;
revoke all on table public.signal_advisories from anon, authenticated;
grant select, insert, update, delete on table public.signal_advisories to service_role;
