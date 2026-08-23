-- TradePulse Dashboard V1 strategy evaluation observability.
-- This is a server-side read model. It does not change strategy behavior or
-- create an execution/result ledger.

create table public.tp_signal_evaluations (
  id uuid primary key default gen_random_uuid(),
  scan_run_id uuid not null references public.tp_scan_runs(id) on delete cascade,
  strategy_version text not null references public.tp_strategy_versions(version),
  evaluated_at timestamptz not null,
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  status text not null check (status in ('FORMAL_SIGNAL', 'CANDIDATE_BELOW_THRESHOLD', 'NO_ELIGIBLE_CANDIDATE', 'INVALID')),
  reason_code text,
  symbol_regime text,
  btc_regime text,
  score numeric(5, 2),
  grade text check (grade is null or grade in ('A', 'B', 'C')),
  formal_signal boolean not null default false,
  entry_reference numeric(30, 12),
  stop_reference numeric(30, 12),
  take_profit_reference numeric(30, 12),
  score_breakdown jsonb check (score_breakdown is null or jsonb_typeof(score_breakdown) = 'object'),
  created_at timestamptz not null default now(),
  unique (scan_run_id, symbol, direction)
);

create index tp_signal_evaluations_evaluated_at_idx
  on public.tp_signal_evaluations (evaluated_at desc);
create index tp_signal_evaluations_symbol_direction_idx
  on public.tp_signal_evaluations (symbol, direction, evaluated_at desc);
create index tp_signal_evaluations_status_idx
  on public.tp_signal_evaluations (status, evaluated_at desc);

alter table public.tp_signal_evaluations enable row level security;
revoke all on table public.tp_signal_evaluations from anon, authenticated;
grant select, insert, update, delete on table public.tp_signal_evaluations to service_role;
