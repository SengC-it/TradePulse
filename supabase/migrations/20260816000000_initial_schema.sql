-- TradePulse M0 initial schema design.
-- This file is committed for review and is intentionally not applied to a remote project in M0.

create extension if not exists pgcrypto;

create table public.tp_strategy_versions (
  version text primary key,
  name text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  specification_path text not null,
  created_at timestamptz not null default now()
);

insert into public.tp_strategy_versions (version, name, status, specification_path)
values ('baseline-001', 'TradePulse baseline strategy', 'DRAFT', 'docs/STRATEGY.md')
on conflict (version) do nothing;

create table public.tp_signals (
  id uuid primary key default gen_random_uuid(),
  strategy_version text not null references public.tp_strategy_versions(version),
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  signal_time timestamptz not null,
  signal_candle_time timestamptz not null,
  entry_reference numeric(30, 12) not null,
  stop_reference numeric(30, 12) not null,
  take_profit_reference numeric(30, 12) not null,
  stop_distance numeric(30, 12) not null check (stop_distance >= 0),
  stop_distance_percent numeric(12, 6) not null check (stop_distance_percent >= 0),
  risk_reward_ratio numeric(8, 4) not null check (risk_reward_ratio > 0),
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  grade text not null check (grade in ('A', 'B', 'C')),
  indicators jsonb not null default '{}'::jsonb check (jsonb_typeof(indicators) = 'object'),
  btc_market_regime text check (btc_market_regime is null or btc_market_regime in ('BTC_STRONG_BULL', 'BTC_NEUTRAL', 'BTC_STRONG_BEAR')),
  symbol_market_regime text not null check (symbol_market_regime in ('LONG_ONLY', 'SHORT_ONLY', 'NO_TRADE')),
  market_regime jsonb not null default '{}'::jsonb check (jsonb_typeof(market_regime) = 'object'),
  trigger_reason text not null,
  invalidation_condition text not null,
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  unique (strategy_version, symbol, direction, signal_candle_time)
);

create table public.tp_signal_scores (
  signal_id uuid primary key references public.tp_signals(id) on delete cascade,
  trend_strength numeric(5, 2) not null check (trend_strength >= 0 and trend_strength <= 40),
  pullback_quality numeric(5, 2) not null check (pullback_quality >= 0 and pullback_quality <= 20),
  breakout_strength numeric(5, 2) not null check (breakout_strength >= 0 and breakout_strength <= 20),
  volume_score numeric(5, 2) not null check (volume_score >= 0 and volume_score <= 10),
  risk_reward_score numeric(5, 2) not null check (risk_reward_score >= 0 and risk_reward_score <= 10),
  total_score numeric(5, 2) not null check (total_score >= 0 and total_score <= 100),
  created_at timestamptz not null default now()
);

create table public.tp_signal_results (
  signal_id uuid primary key references public.tp_signals(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN', 'TP', 'SL', 'TIME_EXIT', 'INVALIDATED')),
  exit_time timestamptz,
  exit_reference numeric(30, 12),
  result_r numeric(12, 6),
  reason text,
  evaluated_candle_time timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.tp_user_decisions (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.tp_signals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('TRADED', 'SKIPPED', 'EXPIRED', 'INVALIDATED', 'UNDECIDED')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, signal_id)
);

create table public.tp_notifications (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.tp_signals(id) on delete cascade,
  channel text not null check (channel in ('EMAIL')),
  recipient text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signal_id, channel, recipient)
);

create table public.tp_scan_runs (
  id uuid primary key default gen_random_uuid(),
  scheduled_for timestamptz not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'RUNNING' check (status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  symbols_requested integer not null default 0 check (symbols_requested >= 0),
  symbols_completed integer not null default 0 check (symbols_completed >= 0),
  signals_generated integer not null default 0 check (signals_generated >= 0),
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.tp_system_events (
  id uuid primary key default gen_random_uuid(),
  event_time timestamptz not null default now(),
  level text not null check (level in ('INFO', 'WARN', 'ERROR')),
  operation text not null,
  status text not null,
  error_code text,
  scan_id uuid references public.tp_scan_runs(id) on delete set null,
  symbol text check (symbol is null or symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT')),
  message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.tp_backtest_runs (
  id uuid primary key default gen_random_uuid(),
  strategy_version text not null references public.tp_strategy_versions(version),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'RUNNING' check (status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  error_code text,
  created_at timestamptz not null default now()
);

create table public.tp_backtest_signals (
  id uuid primary key default gen_random_uuid(),
  backtest_run_id uuid not null references public.tp_backtest_runs(id) on delete cascade,
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  signal_candle_time timestamptz not null,
  entry_reference numeric(30, 12) not null,
  stop_reference numeric(30, 12) not null,
  take_profit_reference numeric(30, 12) not null,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  grade text not null check (grade in ('A', 'B', 'C')),
  result_status text check (result_status is null or result_status in ('OPEN', 'TP', 'SL', 'TIME_EXIT', 'INVALIDATED')),
  result_r numeric(12, 6),
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (backtest_run_id, symbol, direction, signal_candle_time)
);

create index tp_signals_signal_candle_time_idx on public.tp_signals (signal_candle_time desc);
create index tp_signals_symbol_direction_idx on public.tp_signals (symbol, direction, signal_time desc);
create index tp_notifications_status_idx on public.tp_notifications (status, created_at desc);
create index tp_scan_runs_started_at_idx on public.tp_scan_runs (started_at desc);
create index tp_system_events_event_time_idx on public.tp_system_events (event_time desc);
create index tp_user_decisions_user_id_idx on public.tp_user_decisions (user_id, updated_at desc);

-- RLS is enabled on every table in the exposed public schema.
alter table public.tp_strategy_versions enable row level security;
alter table public.tp_signals enable row level security;
alter table public.tp_signal_scores enable row level security;
alter table public.tp_signal_results enable row level security;
alter table public.tp_user_decisions enable row level security;
alter table public.tp_notifications enable row level security;
alter table public.tp_scan_runs enable row level security;
alter table public.tp_system_events enable row level security;
alter table public.tp_backtest_runs enable row level security;
alter table public.tp_backtest_signals enable row level security;

revoke all on table public.tp_strategy_versions, public.tp_signals, public.tp_signal_scores, public.tp_signal_results, public.tp_user_decisions, public.tp_notifications, public.tp_scan_runs, public.tp_system_events, public.tp_backtest_runs, public.tp_backtest_signals from anon;
revoke all on table public.tp_strategy_versions, public.tp_signals, public.tp_signal_scores, public.tp_signal_results, public.tp_user_decisions, public.tp_notifications, public.tp_scan_runs, public.tp_system_events, public.tp_backtest_runs, public.tp_backtest_signals from authenticated;

grant select on table public.tp_strategy_versions, public.tp_signals, public.tp_signal_scores, public.tp_signal_results, public.tp_notifications, public.tp_scan_runs, public.tp_system_events, public.tp_backtest_runs, public.tp_backtest_signals to authenticated;
grant select, insert, update, delete on table public.tp_user_decisions to authenticated;

create policy "authenticated users can read strategy versions"
  on public.tp_strategy_versions for select to authenticated using (true);

create policy "authenticated users can read signals"
  on public.tp_signals for select to authenticated using (true);

create policy "authenticated users can read signal scores"
  on public.tp_signal_scores for select to authenticated using (true);

create policy "authenticated users can read signal results"
  on public.tp_signal_results for select to authenticated using (true);

create policy "authenticated users can read notifications"
  on public.tp_notifications for select to authenticated using (true);

create policy "authenticated users can read scan runs"
  on public.tp_scan_runs for select to authenticated using (true);

create policy "authenticated users can read system events"
  on public.tp_system_events for select to authenticated using (true);

create policy "authenticated users can read backtest runs"
  on public.tp_backtest_runs for select to authenticated using (true);

create policy "authenticated users can read backtest signals"
  on public.tp_backtest_signals for select to authenticated using (true);

create policy "users can read their own decisions"
  on public.tp_user_decisions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert their own decisions"
  on public.tp_user_decisions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their own decisions"
  on public.tp_user_decisions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can delete their own decisions"
  on public.tp_user_decisions for delete to authenticated
  using ((select auth.uid()) = user_id);
