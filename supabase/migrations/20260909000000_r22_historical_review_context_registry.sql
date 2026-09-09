-- Round-022 R5 prospective, identity-only historical context registry.
-- This table stores only information that was available at a server-owned time.

create table public.tp_historical_review_context_registry (
  context_id text primary key,
  source_signal_id text not null unique
    references public.tp_signal_advisories(signal_id) on delete restrict,
  symbol text not null
    check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT')),
  timeframe text not null
    check (timeframe = '1h'),
  source_event_time timestamptz not null,
  available_at timestamptz not null default now(),
  feature_snapshot_version text not null
    check (feature_snapshot_version = 'r22-historical-identity-v1'),
  preprocessing_hash text not null,
  source_ids jsonb not null
    check (jsonb_typeof(source_ids) = 'array' and jsonb_array_length(source_ids) > 0),
  feature_snapshot jsonb not null
    check (jsonb_typeof(feature_snapshot) = 'object'),
  approval_ref text not null
    check (approval_ref = 'ROUND-022-R5-IDENTITY-ONLY-CONTEXT-V1'),
  created_at timestamptz not null default now(),

  constraint tp_historical_review_context_event_before_available_check
    check (source_event_time <= available_at)
);

alter table public.tp_historical_review_context_registry enable row level security;
revoke all on table public.tp_historical_review_context_registry from anon, authenticated;
revoke insert on table public.tp_historical_review_context_registry from service_role;
grant select on table public.tp_historical_review_context_registry to service_role;
grant insert (
  context_id,
  source_signal_id,
  symbol,
  timeframe,
  source_event_time,
  feature_snapshot_version,
  preprocessing_hash,
  source_ids,
  feature_snapshot,
  approval_ref
) on table public.tp_historical_review_context_registry to service_role;

create or replace function public.tp_historical_review_context_server_timestamp_authority()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  server_timestamp timestamptz;
begin
  server_timestamp := statement_timestamp();
  new.available_at := server_timestamp;
  new.created_at := server_timestamp;
  return new;
end;
$$;

create trigger tp_historical_review_context_server_timestamp_authority
before insert on public.tp_historical_review_context_registry
for each row execute function public.tp_historical_review_context_server_timestamp_authority();

create or replace function public.tp_historical_review_context_append_only_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'tp_historical_review_context_registry is append-only; UPDATE and DELETE are forbidden'
    using errcode = '55000';
end;
$$;

create trigger tp_historical_review_context_append_only_guard
before update or delete on public.tp_historical_review_context_registry
for each row execute function public.tp_historical_review_context_append_only_guard();

revoke all on function public.tp_historical_review_context_append_only_guard()
  from public, anon, authenticated;
grant execute on function public.tp_historical_review_context_append_only_guard()
  to service_role;
