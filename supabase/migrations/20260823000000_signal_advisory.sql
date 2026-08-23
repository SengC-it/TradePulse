-- M3-R7 signal advisory delivery registry and scan observability.
-- This table is service-side only. It is not an order, fill, position, or
-- account-execution table.

alter table public.tp_scan_runs
  add column signals_sent integer not null default 0
    check (signals_sent >= 0),
  add column signals_skipped integer not null default 0
    check (signals_skipped >= 0);

create table public.tp_signal_advisories (
  signal_id text primary key,
  symbol text not null check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT')),
  direction text not null check (direction in ('LONG', 'SHORT')),
  strategy_id text not null,
  strategy_version text not null references public.tp_strategy_versions(version),
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
  scan_run_id uuid not null references public.tp_scan_runs(id) on delete restrict,
  delivery_status text not null default 'PENDING'
    check (delivery_status in ('PENDING', 'SENT', 'FAILED')),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  last_attempt_at timestamptz,
  email_message_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_failure_at timestamptz
);

create index tp_signal_advisories_signal_time_idx
  on public.tp_signal_advisories (signal_time desc);
create index tp_signal_advisories_delivery_status_idx
  on public.tp_signal_advisories (delivery_status, created_at desc);
create index tp_signal_advisories_sent_at_idx
  on public.tp_signal_advisories (sent_at desc)
  where sent_at is not null;

-- The retry transition is a database-side compare-and-set so concurrent scans
-- cannot both claim the single permitted retry attempt.
create or replace function public.tp_retry_signal_advisory(
  p_signal_id text,
  p_scan_id uuid,
  p_now timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_status text;
  existing_valid_until timestamptz;
begin
  update public.tp_signal_advisories
  set delivery_status = 'PENDING',
      attempt_count = attempt_count + 1,
      last_attempt_at = p_now,
      scan_run_id = p_scan_id,
      email_message_id = null,
      failure_reason = null,
      sent_at = null
  where signal_id = p_signal_id
    and delivery_status = 'FAILED'
    and p_now < signal_valid_until
    and attempt_count < 2
  returning delivery_status into existing_status;

  if found then
    return 'RETRY_CLAIMED';
  end if;

  select delivery_status, signal_valid_until
    into existing_status, existing_valid_until
    from public.tp_signal_advisories
   where signal_id = p_signal_id;

  if found
     and existing_status = 'FAILED'
     and p_now >= existing_valid_until then
    return 'SKIPPED_EXPIRED';
  end if;

  return 'SKIPPED_DUPLICATE';
end;
$$;

alter table public.tp_signal_advisories enable row level security;
revoke all on table public.tp_signal_advisories from anon, authenticated;
grant select, insert, update, delete on table public.tp_signal_advisories to service_role;
revoke all on function public.tp_retry_signal_advisory(text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.tp_retry_signal_advisory(text, uuid, timestamptz)
  to service_role;
