-- Malika Golden League - monthly internal competition
-- Date: 2026-09-07
--
-- Goals:
-- 1) Make the individual point assignment the single source of truth (instead of the
--    accumulated counters stored in public.squad_players.malika_points/malika_history).
-- 2) Persist Malika points independently of the training-session save.
-- 3) Keep every historical point: squad_players.malika_points / malika_history are
--    NOT dropped nor cleared, they are only backfilled into the new table.
--
-- The Wellness Bonus (+3) is intentionally NOT stored here: it is derived from the real
-- Wellness data at read time, so it can never be double-inserted nor go stale.

begin;

-- -----------------------------------------------------------------------------
-- 1) Assignment table (source of truth)
-- -----------------------------------------------------------------------------
create table if not exists public.malika_point_assignments (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.squad_players(id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  exercise_name text not null default '',
  competition_month text not null,
  awarded_date date not null,
  points integer not null default 0 check (points >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint malika_point_assignments_month_format check (competition_month ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint malika_point_assignments_unique_award unique (session_id, exercise_id, player_id)
);

create index if not exists malika_point_assignments_month_idx
  on public.malika_point_assignments (competition_month);

create index if not exists malika_point_assignments_player_month_idx
  on public.malika_point_assignments (player_id, competition_month);

create index if not exists malika_point_assignments_exercise_idx
  on public.malika_point_assignments (session_id, exercise_id);

create or replace function public.malika_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists malika_point_assignments_set_updated_at on public.malika_point_assignments;
create trigger malika_point_assignments_set_updated_at
before update on public.malika_point_assignments
for each row execute function public.malika_set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) RLS - same capability set that already exists today.
--    Points are assigned from Training Sessions (football/fitness/gk) and read from
--    the Squad hub, so any user holding one of those sections keeps working exactly
--    as before. No role/permission model change.
-- -----------------------------------------------------------------------------
alter table public.malika_point_assignments enable row level security;

drop policy if exists malika_point_assignments_section_access on public.malika_point_assignments;
create policy malika_point_assignments_section_access
  on public.malika_point_assignments
  for all
  to authenticated
  using (
    public.user_has_section_access('squad')
    or public.user_has_section_access('football')
    or public.user_has_section_access('fitness')
    or public.user_has_section_access('gk')
  )
  with check (
    public.user_has_section_access('squad')
    or public.user_has_section_access('football')
    or public.user_has_section_access('fitness')
    or public.user_has_section_access('gk')
  );

-- -----------------------------------------------------------------------------
-- 3) Backfill from the legacy squad_players.malika_history jsonb.
--    Nothing is deleted: legacy columns stay untouched as a safety net.
--    Legacy entries without sessionId/exerciseId get a deterministic synthetic key
--    (md5 of the entry) so two different legacy awards never collapse into one row.
-- -----------------------------------------------------------------------------
with legacy as (
  select
    p.id as player_id,
    coalesce(nullif(entry->>'sessionId', ''), 'legacy-session-' || md5(entry::text)) as session_id,
    coalesce(nullif(entry->>'exerciseId', ''), 'legacy-exercise-' || md5(entry::text)) as exercise_id,
    coalesce(nullif(entry->>'challenge', ''), 'Malika Challenge') as exercise_name,
    case
      when (entry->>'date') ~ '^[0-9]+$' then to_timestamp((entry->>'date')::bigint / 1000.0)::date
      else current_date
    end as awarded_date,
    greatest(coalesce(nullif(entry->>'points', '')::numeric, 0)::int, 0) as points
  from public.squad_players p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.malika_history) = 'array' then p.malika_history else '[]'::jsonb end
  ) as entry
)
insert into public.malika_point_assignments (
  player_id, session_id, exercise_id, exercise_name, competition_month, awarded_date, points
)
select distinct on (player_id, session_id, exercise_id)
  player_id,
  session_id,
  exercise_id,
  exercise_name,
  to_char(awarded_date, 'YYYY-MM'),
  awarded_date,
  points
from legacy
where points > 0
order by player_id, session_id, exercise_id, awarded_date desc
on conflict (session_id, exercise_id, player_id) do nothing;

-- -----------------------------------------------------------------------------
-- 4) Realtime so every coach sees points assigned by anyone else
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'malika_point_assignments'
  ) then
    execute 'alter publication supabase_realtime add table public.malika_point_assignments';
  end if;
end $$;

commit;
