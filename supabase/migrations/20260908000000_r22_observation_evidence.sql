-- Round-022 R1 evidence foundation.
-- This migration defines an append-only, service-side observation evidence
-- table. R1 creates no producer and writes no rows.

create table public.tp_observation_evidence (
  evidence_id text primary key,
  event_kind text not null
    check (event_kind in ('SNAPSHOT', 'NOTIFICATION', 'REVIEW', 'INSTRUMENTATION_FAILURE')),
  schema_version text not null,

  signal_id text not null
    references public.tp_signal_advisories(signal_id) on delete restrict,
  symbol text not null
    check (symbol in ('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT')),
  direction text not null
    check (direction in ('LONG', 'SHORT')),
  signal_time timestamptz not null,
  strategy_id text not null,
  strategy_version text not null,

  artifact_id text,
  artifact_type text
    check (artifact_type is null or artifact_type in (
      'QUALITY_SNAPSHOT',
      'MARKET_CONTEXT',
      'RISK_ADVISORY',
      'HISTORICAL_REVIEW_METADATA',
      'ALERT_INTELLIGENCE',
      'PRESENTATION'
    )),

  notification_observation_id text,
  review_observation_id text,
  event_type text
    check (event_type is null or event_type in ('REVIEW_STARTED', 'REVIEW_SUBMITTED')),

  information_as_of timestamptz,
  captured_at timestamptz not null,
  observed_at timestamptz,
  review_started_at timestamptz,
  review_submitted_at timestamptz,

  source_ref text not null,
  content_hash text,
  evidence_hash text,
  idempotency_key text not null unique,
  supersedes_evidence_id text
    references public.tp_observation_evidence(evidence_id) on delete restrict,

  payload jsonb not null,
  timestamp_authority jsonb not null
    check (jsonb_typeof(timestamp_authority) = 'object'),
  created_at timestamptz not null default now(),

  constraint tp_observation_evidence_snapshot_fields_check check (
    event_kind <> 'SNAPSHOT'
    or (
      artifact_id is not null
      and artifact_type is not null
      and information_as_of is not null
      and content_hash is not null
      and evidence_hash is not null
    )
  ),
  constraint tp_observation_evidence_notification_fields_check check (
    event_kind <> 'NOTIFICATION' or notification_observation_id is not null
  ),
  constraint tp_observation_evidence_review_fields_check check (
    event_kind <> 'REVIEW'
    or (review_observation_id is not null and event_type is not null)
  ),
  constraint tp_observation_evidence_information_before_signal_check check (
    information_as_of is null or information_as_of <= signal_time
  ),
  constraint tp_observation_evidence_signal_before_capture_check check (
    signal_time <= captured_at
  ),
  constraint tp_observation_evidence_signal_before_observed_check check (
    observed_at is null or signal_time <= observed_at
  ),
  constraint tp_observation_evidence_signal_before_review_check check (
    review_started_at is null or signal_time <= review_started_at
  ),
  constraint tp_observation_evidence_review_order_check check (
    review_submitted_at is null
    or (review_started_at is not null and review_started_at <= review_submitted_at)
  )
);

create unique index tp_observation_evidence_snapshot_artifact_id_idx
  on public.tp_observation_evidence (artifact_id)
  where event_kind = 'SNAPSHOT' and artifact_id is not null;

create unique index tp_observation_evidence_notification_observation_id_idx
  on public.tp_observation_evidence (notification_observation_id)
  where event_kind = 'NOTIFICATION' and notification_observation_id is not null;

create unique index tp_observation_evidence_review_identity_idx
  on public.tp_observation_evidence (review_observation_id, event_type)
  where event_kind = 'REVIEW'
    and review_observation_id is not null
    and event_type is not null;

alter table public.tp_observation_evidence enable row level security;
revoke all on table public.tp_observation_evidence from anon, authenticated;
grant select, insert on table public.tp_observation_evidence to service_role;

create or replace function public.tp_observation_evidence_append_only_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'tp_observation_evidence is append-only; UPDATE and DELETE are forbidden'
    using errcode = '55000';
end;
$$;

create trigger tp_observation_evidence_append_only_guard
before update or delete on public.tp_observation_evidence
for each row execute function public.tp_observation_evidence_append_only_guard();

revoke all on function public.tp_observation_evidence_append_only_guard()
  from public, anon, authenticated;
grant execute on function public.tp_observation_evidence_append_only_guard()
  to service_role;
