-- Team-scoped Physiotherapy clinical model.
-- This migration is additive to the authorization rollout; it does not re-enable
-- the superseded team-scope migration for unrelated modules.

create extension if not exists pgcrypto;

create table if not exists public.team_squad_players (
  team_id text not null references public.auth_teams(id) on delete cascade,
  player_id text not null references public.squad_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, player_id)
);

-- The current squad is explicitly owned by U17 Women Al Ula. Opponent and
-- academy rows in auth_teams are not squad owners.
insert into public.team_squad_players (team_id, player_id)
values
  ('u17-women-alula', 'p1'),
  ('u17-women-alula', 'p2'),
  ('u17-women-alula', 'p3'),
  ('u17-women-alula', 'p4'),
  ('u17-women-alula', 'p5'),
  ('u17-women-alula', 'p6'),
  ('u17-women-alula', 'p7'),
  ('u17-women-alula', 'p8'),
  ('u17-women-alula', 'p9'),
  ('u17-women-alula', 'p10'),
  ('u17-women-alula', 'p11'),
  ('u17-women-alula', 'p12'),
  ('u17-women-alula', 'p13'),
  ('u17-women-alula', 'p14'),
  ('u17-women-alula', 'p15'),
  ('u17-women-alula', 'p16'),
  ('u17-women-alula', 'p17'),
  ('u17-women-alula', 'p18'),
  ('u17-women-alula', 'p19'),
  ('u17-women-alula', 'p20'),
  ('u17-women-alula', 'p21'),
  ('u17-women-alula', 'p22'),
  ('u17-women-alula', 'p-1786631342367-w9bi')
on conflict (team_id, player_id) do nothing;

create index if not exists team_squad_players_player_id_idx
  on public.team_squad_players (player_id);

create or replace function public.physio_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists team_squad_players_set_updated_at on public.team_squad_players;
create trigger team_squad_players_set_updated_at
before update on public.team_squad_players
for each row execute function public.physio_set_updated_at();

-- Keep this helper local to the Physio module. It intentionally uses the current
-- section-only authorization foundation plus the existing team memberships.
create or replace function public.can_access_physio_team(target_team_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user()
    or (
      public.user_has_section_access('physio')
      and exists (
        select 1 from public.user_team_memberships membership
        where membership.user_id = auth.uid()
          and membership.team_id = trim(coalesce(target_team_id, ''))
      )
    );
$$;

revoke all on function public.can_access_physio_team(text) from public;
grant execute on function public.can_access_physio_team(text) to authenticated;

create table if not exists public.injuries (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.auth_teams(id) on delete restrict,
  player_id text not null,
  injury_date date not null,
  context text not null default 'unknown' check (context in ('training', 'match', 'external', 'unknown')),
  training_session_id text references public.sessions(id) on delete restrict,
  match_id uuid references public.matches(id) on delete restrict,
  location text not null default '',
  affected_side text not null default 'unknown' check (affected_side in ('right', 'left', 'bilateral', 'not_applicable', 'unknown')),
  injury_type text not null check (injury_type in ('bone', 'joint_non_bone', 'ligament', 'tendon', 'muscle', 'skin', 'pain_non_specific', 'other')),
  clinical_diagnosis text,
  medical_diagnosis text,
  imaging_diagnosis text,
  final_diagnosis text,
  diagnosis_status text not null default 'not_established' check (diagnosis_status in ('not_established', 'clinical', 'medical', 'imaging', 'final')),
  injury_grade text,
  previous_similar_injury boolean not null default false,
  occurrence_type text not null default 'first_occurrence' check (occurrence_type in ('first_occurrence', 'recurrent')),
  previous_injury_id uuid references public.injuries(id) on delete set null,
  previous_injury_date date,
  same_location boolean,
  same_diagnosis boolean,
  playing_surface text,
  contact_type text check (contact_type in ('contact', 'non_contact')),
  contact_with text not null default 'not_applicable' check (contact_with in ('opponent', 'teammate', 'other', 'not_applicable')),
  activities text[] not null default '{}'::text[],
  pain_score smallint check (pain_score between 0 and 10),
  onset text check (onset in ('sudden', 'gradual')),
  pop_sensation boolean not null default false,
  swelling boolean not null default false,
  instability boolean not null default false,
  loss_of_strength boolean not null default false,
  reduced_range_of_motion boolean not null default false,
  other_symptoms text,
  training_duration_minutes integer check (training_duration_minutes is null or training_duration_minutes >= 0),
  training_minute integer check (training_minute is null or training_minute >= 0),
  training_phase text check (training_phase in ('warm_up', 'main_part', 'end_of_training')),
  player_continued boolean,
  continued_with_limitations boolean,
  left_training boolean,
  playing_time_minutes integer check (playing_time_minutes is null or playing_time_minutes >= 0),
  match_minute integer check (match_minute is null or match_minute >= 0),
  match_phase text check (match_phase in ('warm_up', 'first_half', 'half_time', 'second_half')),
  left_match boolean,
  current_status text not null default 'open' check (current_status in ('open', 'under_treatment', 'rehab', 'return_to_training', 'return_to_play', 'closed')),
  estimated_return_date date,
  actual_return_date date,
  closed_at timestamptz,
  legacy_record_id text,
  legacy_payload jsonb,
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  updated_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint injuries_team_player_fkey foreign key (team_id, player_id)
    references public.team_squad_players(team_id, player_id) on delete restrict,
  constraint injuries_context_source_check check (
    (context = 'training' and training_session_id is not null and match_id is null)
    or (context = 'match' and match_id is not null and training_session_id is null)
    or (context in ('external', 'unknown') and training_session_id is null and match_id is null)
  ),
  constraint injuries_return_dates_check check (
    (estimated_return_date is null or estimated_return_date >= injury_date)
    and (actual_return_date is null or actual_return_date >= injury_date)
  )
);

create unique index if not exists injuries_id_team_player_unique
  on public.injuries (id, team_id, player_id);
create unique index if not exists injuries_legacy_record_id_unique
  on public.injuries (legacy_record_id) where legacy_record_id is not null;
create index if not exists injuries_team_player_date_idx on public.injuries (team_id, player_id, injury_date desc);
create index if not exists injuries_team_date_idx on public.injuries (team_id, injury_date desc);
create index if not exists injuries_active_team_status_idx on public.injuries (team_id, current_status, injury_date desc)
  where current_status <> 'closed';
create index if not exists injuries_recurrence_idx on public.injuries (team_id, player_id, location, injury_type, injury_date desc);
create index if not exists injuries_training_session_idx on public.injuries (training_session_id) where training_session_id is not null;
create index if not exists injuries_match_idx on public.injuries (match_id) where match_id is not null;

drop trigger if exists injuries_set_updated_at on public.injuries;
create trigger injuries_set_updated_at before update on public.injuries
for each row execute function public.physio_set_updated_at();

create or replace function public.physio_validate_context_team()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.context = 'training' and not exists (
    select 1
    from public.sessions session
    join public.auth_teams team on team.id = new.team_id
    where session.id = new.training_session_id
      and lower(trim(session.team_name)) in (lower(trim(team.id)), lower(trim(team.name)))
  ) then
    raise exception 'Training session does not belong to the clinical record team.' using errcode = '23514';
  end if;

  if new.context = 'match' and not exists (
    select 1
    from public.matches match
    where match.id = new.match_id
      and match.team_id = new.team_id
  ) then
    raise exception 'Match does not belong to the clinical record team.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.physio_validate_previous_injury()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.previous_injury_id = new.id then
    raise exception 'An injury cannot reference itself as its previous injury.' using errcode = '23514';
  end if;

  if new.previous_injury_id is not null and not exists (
    select 1
    from public.injuries previous
    where previous.id = new.previous_injury_id
      and previous.team_id = new.team_id
      and previous.player_id = new.player_id
  ) then
    raise exception 'Previous injury must belong to the same team and player.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists injuries_validate_context_team on public.injuries;
create trigger injuries_validate_context_team
before insert or update of team_id, context, training_session_id, match_id on public.injuries
for each row execute function public.physio_validate_context_team();

drop trigger if exists injuries_validate_previous_injury on public.injuries;
create trigger injuries_validate_previous_injury
before insert or update of team_id, player_id, previous_injury_id on public.injuries
for each row execute function public.physio_validate_previous_injury();

create table if not exists public.injury_follow_ups (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid not null references public.injuries(id) on delete cascade,
  follow_up_date date not null default current_date,
  treatment_phase text not null default '',
  treatment_performed text not null default '',
  response_to_treatment text,
  injury_progression text,
  status text not null check (status in ('open', 'under_treatment', 'rehab', 'return_to_training', 'return_to_play', 'closed')),
  next_review_date date,
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  updated_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists injury_follow_ups_injury_date_idx on public.injury_follow_ups (injury_id, follow_up_date desc);
create index if not exists injury_follow_ups_due_idx on public.injury_follow_ups (next_review_date)
  where next_review_date is not null and status <> 'closed';
drop trigger if exists injury_follow_ups_set_updated_at on public.injury_follow_ups;
create trigger injury_follow_ups_set_updated_at before update on public.injury_follow_ups
for each row execute function public.physio_set_updated_at();

create table if not exists public.physio_complaints (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.auth_teams(id) on delete restrict,
  player_id text not null,
  occurrence_date date not null,
  context text not null default 'unknown' check (context in ('training', 'match', 'external', 'unknown')),
  training_session_id text references public.sessions(id) on delete restrict,
  match_id uuid references public.matches(id) on delete restrict,
  complaint_type text not null check (complaint_type in ('pain', 'fatigue', 'muscle_soreness', 'cramp', 'stiffness', 'feeling_of_weakness', 'feeling_of_instability', 'dizziness', 'feeling_unwell', 'other')),
  location text not null default '',
  affected_side text not null default 'unknown' check (affected_side in ('right', 'left', 'bilateral', 'not_applicable', 'unknown')),
  left_activity boolean not null default false,
  duration_band text not null check (duration_band in ('less_than_24h', '1_to_3_days', '4_to_7_days', 'more_than_7_days')),
  outcome text not null default 'ongoing' check (outcome in ('resolved', 'ongoing', 'became_injury')),
  resulting_injury_id uuid,
  notes text not null default '',
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  updated_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaints_team_player_fkey foreign key (team_id, player_id)
    references public.team_squad_players(team_id, player_id) on delete restrict,
  constraint complaints_resulting_injury_fkey foreign key (resulting_injury_id, team_id, player_id)
    references public.injuries(id, team_id, player_id) on delete restrict,
  constraint complaints_context_source_check check (
    (context = 'training' and training_session_id is not null and match_id is null)
    or (context = 'match' and match_id is not null and training_session_id is null)
    or (context in ('external', 'unknown') and training_session_id is null and match_id is null)
  ),
  constraint complaints_injury_outcome_check check (
    (outcome = 'became_injury' and resulting_injury_id is not null)
    or (outcome <> 'became_injury' and resulting_injury_id is null)
  )
);
create index if not exists physio_complaints_team_player_date_idx on public.physio_complaints (team_id, player_id, occurrence_date desc);
create index if not exists physio_complaints_resulting_injury_idx on public.physio_complaints (resulting_injury_id) where resulting_injury_id is not null;
drop trigger if exists physio_complaints_set_updated_at on public.physio_complaints;
create trigger physio_complaints_set_updated_at before update on public.physio_complaints
for each row execute function public.physio_set_updated_at();
drop trigger if exists physio_complaints_validate_context_team on public.physio_complaints;
create trigger physio_complaints_validate_context_team
before insert or update of team_id, context, training_session_id, match_id on public.physio_complaints
for each row execute function public.physio_validate_context_team();

alter table public.team_squad_players enable row level security;
alter table public.injuries enable row level security;
alter table public.injury_follow_ups enable row level security;
alter table public.physio_complaints enable row level security;

drop policy if exists team_squad_players_physio_read on public.team_squad_players;
create policy team_squad_players_physio_read on public.team_squad_players
for select to authenticated using (public.can_access_physio_team(team_id));

drop policy if exists injuries_physio_select on public.injuries;
drop policy if exists injuries_physio_insert on public.injuries;
drop policy if exists injuries_physio_update on public.injuries;
create policy injuries_physio_select on public.injuries for select to authenticated using (public.can_access_physio_team(team_id));
create policy injuries_physio_insert on public.injuries for insert to authenticated with check (public.can_access_physio_team(team_id));
create policy injuries_physio_update on public.injuries for update to authenticated using (public.can_access_physio_team(team_id)) with check (public.can_access_physio_team(team_id));

drop policy if exists injury_follow_ups_physio_select on public.injury_follow_ups;
drop policy if exists injury_follow_ups_physio_insert on public.injury_follow_ups;
drop policy if exists injury_follow_ups_physio_update on public.injury_follow_ups;
create policy injury_follow_ups_physio_select on public.injury_follow_ups for select to authenticated using (
  exists (select 1 from public.injuries injury where injury.id = injury_follow_ups.injury_id and public.can_access_physio_team(injury.team_id))
);
create policy injury_follow_ups_physio_insert on public.injury_follow_ups for insert to authenticated with check (
  exists (select 1 from public.injuries injury where injury.id = injury_follow_ups.injury_id and public.can_access_physio_team(injury.team_id))
);

drop policy if exists physio_complaints_select on public.physio_complaints;
drop policy if exists physio_complaints_insert on public.physio_complaints;
drop policy if exists physio_complaints_update on public.physio_complaints;
create policy physio_complaints_select on public.physio_complaints for select to authenticated using (public.can_access_physio_team(team_id));
create policy physio_complaints_insert on public.physio_complaints for insert to authenticated with check (public.can_access_physio_team(team_id));
create policy physio_complaints_update on public.physio_complaints for update to authenticated using (public.can_access_physio_team(team_id)) with check (public.can_access_physio_team(team_id));

revoke all on table public.team_squad_players, public.injuries, public.injury_follow_ups, public.physio_complaints from anon, authenticated;
grant select on table public.team_squad_players to authenticated;
grant select, insert, update on table public.injuries, public.physio_complaints to authenticated;
grant select, insert on table public.injury_follow_ups to authenticated;

-- Deliberately narrow, security-definer context projections. These do not give
-- Physio users broad table reads or any access to clinical data outside their team.
create or replace function public.physio_player_context(target_team_id text)
returns table (player_id text, player_name text, shirt_number text, "position" text, current_status text)
language sql stable security definer set search_path = public as $$
  select player.id, concat_ws(' ', player.first_name, player.last_name), player.number, player.position, player.status
  from public.team_squad_players link
  join public.squad_players player on player.id = link.player_id
  where link.team_id = trim(target_team_id) and public.can_access_physio_team(trim(target_team_id))
  order by player.last_name, player.first_name;
$$;
create or replace function public.physio_training_context(target_team_id text)
returns table (session_id text, session_date text, session_time text, session_number text, duration_minutes integer)
language sql stable security definer set search_path = public as $$
  select session.id, session.date, session.time, session.session_number, null::integer
  from public.sessions session join public.auth_teams team
    on lower(trim(session.team_name)) in (lower(trim(team.id)), lower(trim(team.name)))
  where team.id = trim(target_team_id) and public.can_access_physio_team(trim(target_team_id))
  order by session.date desc, session.time desc;
$$;
create or replace function public.physio_match_context(target_team_id text)
returns table (match_id uuid, match_date text, opponent_name text, match_status text)
language sql stable security definer set search_path = public as $$
  select match.id, match.date, opponent.name, match.status
  from public.matches match join public.auth_teams opponent on opponent.id = match.opponent_team_id
  where match.team_id = trim(target_team_id) and public.can_access_physio_team(trim(target_team_id))
  order by match.date desc;
$$;
create or replace function public.physio_match_participation_context(target_team_id text)
returns table (match_id uuid, player_id text, match_date text, minutes_played integer, starts boolean)
language sql stable security definer set search_path = public as $$
  select stats.match_id, stats.player_id, match.date, stats.minutes_played, stats.starts
  from public.player_match_statistics stats
  join public.matches match on match.id = stats.match_id
  join public.team_squad_players link
    on link.team_id = match.team_id and link.player_id = stats.player_id
  where match.team_id = trim(target_team_id) and public.can_access_physio_team(trim(target_team_id));
$$;
revoke all on function public.physio_player_context(text), public.physio_training_context(text), public.physio_match_context(text), public.physio_match_participation_context(text) from public;
grant execute on function public.physio_player_context(text), public.physio_training_context(text), public.physio_match_context(text), public.physio_match_participation_context(text) to authenticated;

-- Preserve legacy records in the clinical model before removing demo-only storage.
do $$
begin
  if to_regclass('public.physio_records') is not null then
    if exists (
      select 1
      from public.physio_records legacy
      where not exists (
        select 1
        from public.team_squad_players link
        where link.team_id = 'u17-women-alula'
          and link.player_id = legacy.player_id
      )
    ) then
      raise exception 'A legacy Physio record has no U17 Women Al Ula squad-player relationship.' using errcode = '23503';
    end if;

    insert into public.injuries (
      team_id, player_id, injury_date, context, location, affected_side,
      injury_type, clinical_diagnosis, diagnosis_status, injury_grade,
      previous_similar_injury, occurrence_type, contact_with, activities,
      pop_sensation, swelling, instability, loss_of_strength,
      reduced_range_of_motion, current_status, estimated_return_date,
      legacy_record_id, legacy_payload
    )
    select
      'u17-women-alula',
      legacy.player_id,
      legacy.injury_date::date,
      'unknown',
      '',
      'unknown',
      'other',
      legacy.injury_type,
      'clinical',
      nullif(trim(legacy.severity), ''),
      false,
      'first_occurrence',
      'not_applicable',
      '{}'::text[],
      false,
      false,
      false,
      false,
      false,
      case lower(trim(legacy.status))
        when 'cleared for training' then 'return_to_training'
        when 'cleared' then 'closed'
        when 'closed' then 'closed'
        when 'rehab' then 'rehab'
        when 'under treatment' then 'under_treatment'
        else 'open'
      end,
      nullif(trim(legacy.estimated_return_date), '')::date,
      legacy.id,
      to_jsonb(legacy)
    from public.physio_records legacy
    on conflict (legacy_record_id) where legacy_record_id is not null do nothing;

    if exists (
      select 1
      from public.physio_records legacy
      where not exists (
        select 1
        from public.injuries injury
        where injury.legacy_record_id = legacy.id
      )
    ) then
      raise exception 'One or more legacy Physio records were not migrated.' using errcode = '23514';
    end if;

    execute 'drop policy if exists physio_records_read_policy on public.physio_records';
    execute 'drop policy if exists physio_records_write_policy on public.physio_records';
    execute 'drop policy if exists physio_records_section_physio on public.physio_records';
    drop table public.physio_records;
  end if;
end $$;

-- Register clinical tables used by Supabase Realtime without duplicating entries.
do $$
declare
  target_table_name text;
begin
  foreach target_table_name in array array[
    'team_squad_players',
    'injuries',
    'injury_follow_ups',
    'physio_complaints'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table_name);
    end if;
  end loop;
end $$;
