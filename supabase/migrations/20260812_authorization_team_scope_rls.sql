-- =============================================================================
-- Team-scoped authorization hardening for planning + meetings + training tables
-- Non-destructive, additive migration.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.authorization_backfill_conflicts (
  id bigint generated always as identity primary key,
  source_table text not null,
  source_id text not null,
  source_team_value text,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (source_table, source_id, reason)
);

-- ---------------------------------------------------------------------------
-- Remove automatic default team assignment in microcycles (explicit team only).
-- ---------------------------------------------------------------------------
alter table if exists public.microcycles
  alter column team_id drop default;

alter table if exists public.microcycles
  alter column team_name drop default;

-- ---------------------------------------------------------------------------
-- Add explicit team_id to tables that represent team-owned data.
-- ---------------------------------------------------------------------------
alter table if exists public.sessions
  add column if not exists team_id text references public.auth_teams(id) on delete set null;

create index if not exists sessions_team_id_idx on public.sessions (team_id);

alter table if exists public.fitness_sessions
  add column if not exists team_id text references public.auth_teams(id) on delete set null;

create index if not exists fitness_sessions_team_id_idx on public.fitness_sessions (team_id);

alter table if exists public.meetings
  add column if not exists team_id text references public.auth_teams(id) on delete set null;

create index if not exists meetings_team_id_idx on public.meetings (team_id);

-- ---------------------------------------------------------------------------
-- Deterministic backfill from existing textual team names where possible.
-- ---------------------------------------------------------------------------
with teams as (
  select
    t.id,
    lower(trim(t.id)) as id_norm,
    lower(trim(t.name)) as name_norm
  from public.auth_teams t
),
session_candidates as (
  select
    s.id,
    lower(trim(coalesce(s.team_name, ''))) as team_norm
  from public.sessions s
  where s.team_id is null
),
resolved as (
  select
    sc.id,
    min(t.id) as resolved_team_id,
    count(*) as match_count
  from session_candidates sc
  join teams t
    on sc.team_norm <> ''
   and (sc.team_norm = t.id_norm or sc.team_norm = t.name_norm)
  group by sc.id
)
update public.sessions s
set team_id = r.resolved_team_id
from resolved r
where s.id = r.id
  and r.match_count = 1;

insert into public.authorization_backfill_conflicts (source_table, source_id, source_team_value, reason)
select
  'sessions' as source_table,
  s.id as source_id,
  s.team_name as source_team_value,
  case
    when coalesce(trim(s.team_name), '') = '' then 'missing team_name'
    when not exists (
      select 1
      from public.auth_teams t
      where lower(trim(s.team_name)) in (lower(trim(t.id)), lower(trim(t.name)))
    ) then 'no matching auth_team'
    else 'ambiguous auth_team mapping'
  end as reason
from public.sessions s
where s.team_id is null
on conflict (source_table, source_id, reason) do nothing;

with teams as (
  select
    t.id,
    lower(trim(t.id)) as id_norm,
    lower(trim(t.name)) as name_norm
  from public.auth_teams t
),
fitness_candidates as (
  select
    fs.id,
    lower(trim(coalesce(fs.team_name, ''))) as team_norm
  from public.fitness_sessions fs
  where fs.team_id is null
),
resolved as (
  select
    fc.id,
    min(t.id) as resolved_team_id,
    count(*) as match_count
  from fitness_candidates fc
  join teams t
    on fc.team_norm <> ''
   and (fc.team_norm = t.id_norm or fc.team_norm = t.name_norm)
  group by fc.id
)
update public.fitness_sessions fs
set team_id = r.resolved_team_id
from resolved r
where fs.id = r.id
  and r.match_count = 1;

insert into public.authorization_backfill_conflicts (source_table, source_id, source_team_value, reason)
select
  'fitness_sessions' as source_table,
  fs.id as source_id,
  fs.team_name as source_team_value,
  case
    when coalesce(trim(fs.team_name), '') = '' then 'missing team_name'
    when not exists (
      select 1
      from public.auth_teams t
      where lower(trim(fs.team_name)) in (lower(trim(t.id)), lower(trim(t.name)))
    ) then 'no matching auth_team'
    else 'ambiguous auth_team mapping'
  end as reason
from public.fitness_sessions fs
where fs.team_id is null
on conflict (source_table, source_id, reason) do nothing;

insert into public.authorization_backfill_conflicts (source_table, source_id, source_team_value, reason)
select
  'meetings' as source_table,
  m.id::text as source_id,
  null as source_team_value,
  'missing team_id source (manual assignment required)'
from public.meetings m
where m.team_id is null
on conflict (source_table, source_id, reason) do nothing;

-- ---------------------------------------------------------------------------
-- RLS: microcycle tables (team-aware + parent-enforced child policies).
-- ---------------------------------------------------------------------------

drop policy if exists microcycles_read_planning on public.microcycles;
create policy microcycles_read_planning
  on public.microcycles
  for select
  to authenticated
  using (
    team_id is not null
    and public.can('planning', 'read', team_id)
  );

drop policy if exists microcycles_write_planning on public.microcycles;
drop policy if exists microcycles_insert_planning on public.microcycles;
drop policy if exists microcycles_update_planning on public.microcycles;
drop policy if exists microcycles_delete_planning on public.microcycles;

create policy microcycles_insert_planning
  on public.microcycles
  for insert
  to authenticated
  with check (
    team_id is not null
    and public.can('planning', 'create', team_id)
  );

create policy microcycles_update_planning
  on public.microcycles
  for update
  to authenticated
  using (
    team_id is not null
    and public.can('planning', 'update', team_id)
  )
  with check (
    team_id is not null
    and public.can('planning', 'update', team_id)
  );

create policy microcycles_delete_planning
  on public.microcycles
  for delete
  to authenticated
  using (
    team_id is not null
    and public.can('planning', 'delete', team_id)
  );

-- microcycle_days

drop policy if exists microcycle_days_read_planning on public.microcycle_days;
create policy microcycle_days_read_planning
  on public.microcycle_days
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_days.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'read', m.team_id)
    )
  );

drop policy if exists microcycle_days_write_planning on public.microcycle_days;
drop policy if exists microcycle_days_insert_planning on public.microcycle_days;
drop policy if exists microcycle_days_update_planning on public.microcycle_days;
drop policy if exists microcycle_days_delete_planning on public.microcycle_days;

create policy microcycle_days_insert_planning
  on public.microcycle_days
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_days.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'create', m.team_id)
    )
  );

create policy microcycle_days_update_planning
  on public.microcycle_days
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_days.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'update', m.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_days.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'update', m.team_id)
    )
  );

create policy microcycle_days_delete_planning
  on public.microcycle_days
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_days.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'delete', m.team_id)
    )
  );

-- microcycle_day_concepts

drop policy if exists microcycle_day_concepts_read_planning on public.microcycle_day_concepts;
create policy microcycle_day_concepts_read_planning
  on public.microcycle_day_concepts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.microcycle_days md
      join public.microcycles m on m.id = md.microcycle_id
      where md.id = microcycle_day_concepts.microcycle_day_id
        and m.team_id is not null
        and public.can('planning', 'read', m.team_id)
    )
  );

drop policy if exists microcycle_day_concepts_write_planning on public.microcycle_day_concepts;
drop policy if exists microcycle_day_concepts_insert_planning on public.microcycle_day_concepts;
drop policy if exists microcycle_day_concepts_update_planning on public.microcycle_day_concepts;
drop policy if exists microcycle_day_concepts_delete_planning on public.microcycle_day_concepts;

create policy microcycle_day_concepts_insert_planning
  on public.microcycle_day_concepts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.microcycle_days md
      join public.microcycles m on m.id = md.microcycle_id
      where md.id = microcycle_day_concepts.microcycle_day_id
        and m.team_id is not null
        and public.can('planning', 'create', m.team_id)
    )
  );

create policy microcycle_day_concepts_update_planning
  on public.microcycle_day_concepts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.microcycle_days md
      join public.microcycles m on m.id = md.microcycle_id
      where md.id = microcycle_day_concepts.microcycle_day_id
        and m.team_id is not null
        and public.can('planning', 'update', m.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.microcycle_days md
      join public.microcycles m on m.id = md.microcycle_id
      where md.id = microcycle_day_concepts.microcycle_day_id
        and m.team_id is not null
        and public.can('planning', 'update', m.team_id)
    )
  );

create policy microcycle_day_concepts_delete_planning
  on public.microcycle_day_concepts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.microcycle_days md
      join public.microcycles m on m.id = md.microcycle_id
      where md.id = microcycle_day_concepts.microcycle_day_id
        and m.team_id is not null
        and public.can('planning', 'delete', m.team_id)
    )
  );

-- microcycle_player_availability

drop policy if exists microcycle_player_availability_read_planning on public.microcycle_player_availability;
create policy microcycle_player_availability_read_planning
  on public.microcycle_player_availability
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_player_availability.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'read', m.team_id)
    )
  );

drop policy if exists microcycle_player_availability_write_planning on public.microcycle_player_availability;
drop policy if exists microcycle_player_availability_insert_planning on public.microcycle_player_availability;
drop policy if exists microcycle_player_availability_update_planning on public.microcycle_player_availability;
drop policy if exists microcycle_player_availability_delete_planning on public.microcycle_player_availability;

create policy microcycle_player_availability_insert_planning
  on public.microcycle_player_availability
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_player_availability.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'create', m.team_id)
    )
  );

create policy microcycle_player_availability_update_planning
  on public.microcycle_player_availability
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_player_availability.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'update', m.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_player_availability.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'update', m.team_id)
    )
  );

create policy microcycle_player_availability_delete_planning
  on public.microcycle_player_availability
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.microcycles m
      where m.id = microcycle_player_availability.microcycle_id
        and m.team_id is not null
        and public.can('planning', 'delete', m.team_id)
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: meetings tables (team-aware + parent-enforced child policies).
-- ---------------------------------------------------------------------------

drop policy if exists meetings_select on public.meetings;
create policy meetings_select
  on public.meetings
  for select
  to authenticated
  using (
    team_id is not null
    and public.can('meetings', 'read', team_id)
  );

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert
  on public.meetings
  for insert
  to authenticated
  with check (
    team_id is not null
    and public.can('meetings', 'create', team_id)
  );

drop policy if exists meetings_update on public.meetings;
create policy meetings_update
  on public.meetings
  for update
  to authenticated
  using (
    team_id is not null
    and public.can('meetings', 'update', team_id)
  )
  with check (
    team_id is not null
    and public.can('meetings', 'update', team_id)
  );

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete
  on public.meetings
  for delete
  to authenticated
  using (
    team_id is not null
    and public.can('meetings', 'delete', team_id)
  );

-- meeting_attendees

drop policy if exists meeting_attendees_select on public.meeting_attendees;
create policy meeting_attendees_select
  on public.meeting_attendees
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_attendees.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'read', m.team_id)
    )
  );

drop policy if exists meeting_attendees_insert on public.meeting_attendees;
create policy meeting_attendees_insert
  on public.meeting_attendees
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_attendees.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'update', m.team_id)
    )
  );

drop policy if exists meeting_attendees_update on public.meeting_attendees;
create policy meeting_attendees_update
  on public.meeting_attendees
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_attendees.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'update', m.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_attendees.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'update', m.team_id)
    )
  );

drop policy if exists meeting_attendees_delete on public.meeting_attendees;
create policy meeting_attendees_delete
  on public.meeting_attendees
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_attendees.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'update', m.team_id)
    )
  );

-- meeting_action_items

drop policy if exists meeting_action_items_select on public.meeting_action_items;
create policy meeting_action_items_select
  on public.meeting_action_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_action_items.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'read', m.team_id)
    )
  );

drop policy if exists meeting_action_items_insert on public.meeting_action_items;
create policy meeting_action_items_insert
  on public.meeting_action_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_action_items.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'update', m.team_id)
    )
  );

drop policy if exists meeting_action_items_update on public.meeting_action_items;
create policy meeting_action_items_update
  on public.meeting_action_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_action_items.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'update', m.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_action_items.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'update', m.team_id)
    )
  );

drop policy if exists meeting_action_items_delete on public.meeting_action_items;
create policy meeting_action_items_delete
  on public.meeting_action_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_action_items.meeting_id
        and m.team_id is not null
        and public.can('meetings', 'delete', m.team_id)
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: training tables with explicit action mapping.
-- team_id remains nullable for backward compatibility during migration;
-- non-admin access requires non-null team_id.
-- ---------------------------------------------------------------------------

drop policy if exists sessions_read_authenticated on public.sessions;
create policy sessions_read_authenticated
  on public.sessions
  for select
  to authenticated
  using (
    team_id is not null
    and (
      public.can('football', 'read', team_id)
      or public.can('fitness', 'read', team_id)
      or public.can('gk', 'read', team_id)
    )
  );

drop policy if exists sessions_write_authenticated on public.sessions;
drop policy if exists sessions_write_by_section on public.sessions;
drop policy if exists sessions_insert_by_section on public.sessions;
drop policy if exists sessions_update_by_section on public.sessions;
drop policy if exists sessions_delete_by_section on public.sessions;

create policy sessions_insert_by_section
  on public.sessions
  for insert
  to authenticated
  with check (
    team_id is not null
    and (
      public.can('football', 'create', team_id)
      or public.can('fitness', 'create', team_id)
      or public.can('gk', 'create', team_id)
    )
  );

create policy sessions_update_by_section
  on public.sessions
  for update
  to authenticated
  using (
    team_id is not null
    and (
      public.can('football', 'update', team_id)
      or public.can('fitness', 'update', team_id)
      or public.can('gk', 'update', team_id)
    )
  )
  with check (
    team_id is not null
    and (
      public.can('football', 'update', team_id)
      or public.can('fitness', 'update', team_id)
      or public.can('gk', 'update', team_id)
    )
  );

create policy sessions_delete_by_section
  on public.sessions
  for delete
  to authenticated
  using (
    team_id is not null
    and (
      public.can('football', 'delete', team_id)
      or public.can('fitness', 'delete', team_id)
      or public.can('gk', 'delete', team_id)
    )
  );

-- fitness_sessions table (added in Step A migration)

drop policy if exists fitness_sessions_read_fitness_only on public.fitness_sessions;
create policy fitness_sessions_read_fitness_only
  on public.fitness_sessions
  for select
  to authenticated
  using (
    team_id is not null
    and public.can('fitness', 'read', team_id)
  );

drop policy if exists fitness_sessions_write_fitness_only on public.fitness_sessions;
drop policy if exists fitness_sessions_insert_fitness_only on public.fitness_sessions;
drop policy if exists fitness_sessions_update_fitness_only on public.fitness_sessions;
drop policy if exists fitness_sessions_delete_fitness_only on public.fitness_sessions;

create policy fitness_sessions_insert_fitness_only
  on public.fitness_sessions
  for insert
  to authenticated
  with check (
    team_id is not null
    and public.can('fitness', 'create', team_id)
  );

create policy fitness_sessions_update_fitness_only
  on public.fitness_sessions
  for update
  to authenticated
  using (
    team_id is not null
    and public.can('fitness', 'update', team_id)
  )
  with check (
    team_id is not null
    and public.can('fitness', 'update', team_id)
  );

create policy fitness_sessions_delete_fitness_only
  on public.fitness_sessions
  for delete
  to authenticated
  using (
    team_id is not null
    and public.can('fitness', 'delete', team_id)
  );
