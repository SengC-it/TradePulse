-- TradePulse M6 Daily Signal Review Engine V1.
-- This is a separate advisory review ledger. It never mutates legacy
-- tp_signal_results or the original signal advisory history.

create table public.tp_advisory_reviews (
  signal_id text primary key
    references public.tp_signal_advisories(signal_id),
  review_version text not null
    check (review_version = 'daily-review-001'),
  status text not null
    check (status in ('WAITING_ENTRY', 'OPEN', 'TP', 'SL', 'NO_ENTRY', 'AMBIGUOUS')),
  entry_candle_time timestamptz,
  exit_candle_time timestamptz,
  exit_reference numeric,
  result_r numeric,
  last_evaluated_candle_time timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tp_advisory_reviews_state_consistency check (
    (status = 'WAITING_ENTRY'
      and entry_candle_time is null
      and exit_candle_time is null
      and exit_reference is null
      and result_r is null)
    or
    (status = 'OPEN'
      and entry_candle_time is not null
      and exit_candle_time is null
      and exit_reference is null
      and result_r is null)
    or
    (status = 'TP'
      and entry_candle_time is not null
      and exit_candle_time is not null
      and exit_reference is not null
      and result_r = 2)
    or
    (status = 'SL'
      and entry_candle_time is not null
      and exit_candle_time is not null
      and exit_reference is not null
      and result_r = -1)
    or
    (status = 'NO_ENTRY'
      and entry_candle_time is null
      and exit_candle_time is null
      and exit_reference is null
      and result_r is null)
    or
    (status = 'AMBIGUOUS'
      and entry_candle_time is not null
      and exit_candle_time is not null
      and exit_reference is null
      and result_r is null)
  )
);

create index tp_advisory_reviews_status_idx
  on public.tp_advisory_reviews (status, updated_at desc);
create index tp_advisory_reviews_updated_at_idx
  on public.tp_advisory_reviews (updated_at desc);
create index tp_advisory_reviews_exit_candle_time_idx
  on public.tp_advisory_reviews (exit_candle_time)
  where exit_candle_time is not null;

create table public.tp_review_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text unique not null,
  scheduled_for timestamptz not null,
  status text not null default 'RUNNING'
    check (status in ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  attempt_count integer not null default 1
    check (attempt_count >= 0),
  lease_expires_at timestamptz,
  advisories_considered integer not null default 0
    check (advisories_considered >= 0),
  reviews_created integer not null default 0
    check (reviews_created >= 0),
  reviews_updated integer not null default 0
    check (reviews_updated >= 0),
  reviews_resolved integer not null default 0
    check (reviews_resolved >= 0),
  error_code text,
  created_at timestamptz not null default now()
);

create index tp_review_runs_scheduled_for_idx
  on public.tp_review_runs (scheduled_for desc);
create index tp_review_runs_status_idx
  on public.tp_review_runs (status, started_at desc);

alter table public.tp_advisory_reviews enable row level security;
alter table public.tp_review_runs enable row level security;

revoke all on table public.tp_advisory_reviews, public.tp_review_runs from anon, authenticated;
grant select, insert, update, delete on table public.tp_advisory_reviews, public.tp_review_runs to service_role;

-- Atomic daily lease/idempotency claim. The caller is service-side only.
create or replace function public.tp_claim_review_run(
  p_run_key text,
  p_scheduled_for timestamptz,
  p_now timestamptz,
  p_lease_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_run public.tp_review_runs%rowtype;
  inserted_id uuid;
begin
  insert into public.tp_review_runs (
    run_key,
    scheduled_for,
    status,
    started_at,
    attempt_count,
    lease_expires_at
  )
  values (
    p_run_key,
    p_scheduled_for,
    'RUNNING',
    p_now,
    1,
    p_lease_expires_at
  )
  on conflict (run_key) do nothing
  returning id into inserted_id;

  -- The RETURNING value is null when another caller already owns this key.
  -- This keeps the first claim at attempt_count = 1.

  if inserted_id is not null then
    return jsonb_build_object('action', 'RUN', 'runId', inserted_id);
  end if;

  select *
    into current_run
    from public.tp_review_runs
   where run_key = p_run_key
   for update;

  if current_run.status = 'SUCCEEDED' then
    return jsonb_build_object('action', 'SKIP_COMPLETED', 'runId', current_run.id);
  end if;

  if current_run.status = 'RUNNING'
     and current_run.lease_expires_at is not null
     and current_run.lease_expires_at > p_now then
    return jsonb_build_object('action', 'SKIP_IN_PROGRESS', 'runId', current_run.id);
  end if;

  update public.tp_review_runs
     set status = 'RUNNING',
         scheduled_for = p_scheduled_for,
         started_at = p_now,
         completed_at = null,
         attempt_count = current_run.attempt_count + 1,
         lease_expires_at = p_lease_expires_at,
         error_code = null
   where id = current_run.id;

  return jsonb_build_object('action', 'RUN', 'runId', current_run.id);
end;
$$;

revoke all on function public.tp_claim_review_run(text, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.tp_claim_review_run(text, timestamptz, timestamptz, timestamptz)
  to service_role;
