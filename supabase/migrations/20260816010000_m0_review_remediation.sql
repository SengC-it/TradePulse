-- TradePulse M0 review remediation.
-- Apply after 20260816000000_initial_schema.sql.

-- Explicit allowlist for this private application. Rows are provisioned by a
-- server-side/admin operation; authenticated browser clients cannot modify it.
create table public.tp_authorized_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_level text not null default 'AUTHORIZED' check (access_level in ('OWNER', 'AUTHORIZED')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index tp_authorized_users_one_owner_idx
  on public.tp_authorized_users (access_level)
  where access_level = 'OWNER';

create index tp_authorized_users_enabled_idx
  on public.tp_authorized_users (user_id)
  where enabled = true;

alter table public.tp_authorized_users enable row level security;

revoke all on table public.tp_authorized_users from anon, authenticated;
grant select on table public.tp_authorized_users to authenticated;
grant select, insert, update, delete on table public.tp_authorized_users to service_role;

grant select, insert, update, delete on table
  public.tp_strategy_versions,
  public.tp_signals,
  public.tp_signal_scores,
  public.tp_signal_results,
  public.tp_user_decisions,
  public.tp_notifications,
  public.tp_scan_runs,
  public.tp_system_events,
  public.tp_backtest_runs,
  public.tp_backtest_signals
to service_role;

create policy "authorized users can read their own authorization"
  on public.tp_authorized_users for select to authenticated
  using ((select auth.uid()) = user_id);

-- A run key identifies the planned schedule cycle, not the invocation time.
-- The legacy backfill keeps this additive migration safe if an empty or
-- development database already contains rows from the initial schema.
alter table public.tp_scan_runs add column run_key text;

update public.tp_scan_runs
set run_key = 'legacy:' || id::text
where run_key is null;

alter table public.tp_scan_runs
  alter column run_key set not null,
  add constraint tp_scan_runs_run_key_unique unique (run_key),
  add column attempt_count integer not null default 0,
  add constraint tp_scan_runs_attempt_count_nonnegative check (attempt_count >= 0),
  add column lease_expires_at timestamptz,
  add column last_attempt_at timestamptz;

-- The component total is a database invariant. Numeric values are exact, so
-- this check intentionally uses equality rather than a tolerance.
alter table public.tp_signal_scores
  add constraint tp_signal_scores_total_score_matches_components
  check (
    total_score =
      trend_strength +
      pullback_quality +
      breakout_strength +
      volume_score +
      risk_reward_score
  );

do $$
begin
  if exists (
    select 1
    from public.tp_signals as s
    left join public.tp_signal_scores as ss on ss.signal_id = s.id
    where ss.signal_id is null
      or s.score <> ss.total_score
  ) then
    raise exception 'Existing tp_signals contain a missing or mismatched score row'
      using errcode = '23514';
  end if;
end;
$$;

-- tp_signals.score and tp_signal_scores.total_score are duplicated read models of
-- one value. The application persistence service writes both in one
-- transaction; these deferred triggers reject a mismatch at commit time.
create or replace function public.tp_assert_signal_score_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.tp_signal_scores
    where signal_id = new.id
  ) then
    raise exception 'Signal % must have a tp_signal_scores row', new.id
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.tp_signals as s
    join public.tp_signal_scores as ss on ss.signal_id = s.id
    where s.id = new.id
      and s.score <> ss.total_score
  ) then
    raise exception 'tp_signals.score and tp_signal_scores.total_score differ for signal %', new.id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create or replace function public.tp_assert_signal_scores_total_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tp_signals as s
    join public.tp_signal_scores as ss on ss.signal_id = s.id
    where s.id = new.signal_id
      and s.score <> ss.total_score
  ) then
    raise exception 'tp_signals.score and tp_signal_scores.total_score differ for signal %', new.signal_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create or replace function public.tp_assert_signal_scores_not_deleted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tp_signals
    where id = old.signal_id
  ) then
    raise exception 'Signal % must retain its tp_signal_scores row', old.signal_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

drop trigger if exists tp_signals_score_consistency on public.tp_signals;
create constraint trigger tp_signals_score_consistency
after insert or update on public.tp_signals
deferrable initially deferred
for each row
execute function public.tp_assert_signal_score_consistency();

drop trigger if exists tp_signal_scores_total_consistency on public.tp_signal_scores;
create constraint trigger tp_signal_scores_total_consistency
after insert or update on public.tp_signal_scores
deferrable initially deferred
for each row
execute function public.tp_assert_signal_scores_total_consistency();

drop trigger if exists tp_signal_scores_not_deleted on public.tp_signal_scores;
create constraint trigger tp_signal_scores_not_deleted
after delete on public.tp_signal_scores
deferrable initially deferred
for each row
execute function public.tp_assert_signal_scores_not_deleted();

-- Replace the initial broad authenticated-read policies with the explicit
-- TradePulse authorization predicate. There are deliberately no browser
-- write policies for global operational and research tables.
drop policy if exists "authenticated users can read strategy versions" on public.tp_strategy_versions;
drop policy if exists "authenticated users can read signals" on public.tp_signals;
drop policy if exists "authenticated users can read signal scores" on public.tp_signal_scores;
drop policy if exists "authenticated users can read signal results" on public.tp_signal_results;
drop policy if exists "authenticated users can read notifications" on public.tp_notifications;
drop policy if exists "authenticated users can read scan runs" on public.tp_scan_runs;
drop policy if exists "authenticated users can read system events" on public.tp_system_events;
drop policy if exists "authenticated users can read backtest runs" on public.tp_backtest_runs;
drop policy if exists "authenticated users can read backtest signals" on public.tp_backtest_signals;

create policy "authorized TradePulse users can read strategy versions"
  on public.tp_strategy_versions for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized TradePulse users can read signals"
  on public.tp_signals for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized TradePulse users can read signal scores"
  on public.tp_signal_scores for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized TradePulse users can read signal results"
  on public.tp_signal_results for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized TradePulse users can read notifications"
  on public.tp_notifications for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized TradePulse users can read scan runs"
  on public.tp_scan_runs for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized TradePulse users can read system events"
  on public.tp_system_events for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized TradePulse users can read backtest runs"
  on public.tp_backtest_runs for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized TradePulse users can read backtest signals"
  on public.tp_backtest_signals for select to authenticated
  using (
    exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

drop policy if exists "users can read their own decisions" on public.tp_user_decisions;
drop policy if exists "users can insert their own decisions" on public.tp_user_decisions;
drop policy if exists "users can update their own decisions" on public.tp_user_decisions;
drop policy if exists "users can delete their own decisions" on public.tp_user_decisions;

create policy "authorized users can read their own decisions"
  on public.tp_user_decisions for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized users can insert their own decisions"
  on public.tp_user_decisions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized users can update their own decisions"
  on public.tp_user_decisions for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

create policy "authorized users can delete their own decisions"
  on public.tp_user_decisions for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.tp_authorized_users as au
      where au.user_id = (select auth.uid())
        and au.enabled = true
    )
  );

revoke execute on function public.tp_assert_signal_score_consistency() from public, anon, authenticated;
revoke execute on function public.tp_assert_signal_scores_total_consistency() from public, anon, authenticated;
revoke execute on function public.tp_assert_signal_scores_not_deleted() from public, anon, authenticated;
