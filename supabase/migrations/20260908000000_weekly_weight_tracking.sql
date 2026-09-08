-- Weekly Weight tracking (Testing -> Fitness -> Weekly Weight)
-- Date: 2026-09-08
--
-- Goals:
-- 1) Single source of truth for player body weight: one row per (player, week).
-- 2) squad_players.weight_kg keeps working exactly as it does today (read anywhere in
--    the app) but becomes a DERIVED/synced field: it is no longer meant to be edited
--    directly, it always mirrors the most recent player_weekly_weights row.
-- 3) History is preserved forever; nothing is overwritten, only appended.

begin;

-- -----------------------------------------------------------------------------
-- 1) Table
-- -----------------------------------------------------------------------------
create table if not exists public.player_weekly_weights (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.squad_players(id) on delete cascade,
  week_start_date date not null,
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_weekly_weights_unique_player_week unique (player_id, week_start_date)
);

create index if not exists player_weekly_weights_player_idx
  on public.player_weekly_weights (player_id, week_start_date desc);

create index if not exists player_weekly_weights_week_idx
  on public.player_weekly_weights (week_start_date);

create or replace function public.weekly_weight_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_weekly_weights_set_updated_at on public.player_weekly_weights;
create trigger player_weekly_weights_set_updated_at
before update on public.player_weekly_weights
for each row execute function public.weekly_weight_set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) Keep squad_players.weight_kg in sync with the latest weekly measurement.
--    SECURITY DEFINER because a 'fitness'-only user (who can write weekly weights)
--    may not hold 'squad' write access, yet the mirrored field must still update.
-- -----------------------------------------------------------------------------
create or replace function public.weekly_weight_sync_squad_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_player_id text := coalesce(new.player_id, old.player_id);
  latest_weight numeric(5,2);
begin
  select weight_kg into latest_weight
  from public.player_weekly_weights
  where player_id = target_player_id
  order by week_start_date desc
  limit 1;

  update public.squad_players
  set weight_kg = latest_weight,
      updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
  where id = target_player_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists player_weekly_weights_sync_squad_player on public.player_weekly_weights;
create trigger player_weekly_weights_sync_squad_player
after insert or update or delete on public.player_weekly_weights
for each row execute function public.weekly_weight_sync_squad_player();

-- -----------------------------------------------------------------------------
-- 3) RLS - same capability set as the rest of Fitness (write), readable also by
--    Squad so the player profile's derived field can be trusted / cross-checked.
-- -----------------------------------------------------------------------------
alter table public.player_weekly_weights enable row level security;

drop policy if exists player_weekly_weights_read on public.player_weekly_weights;
create policy player_weekly_weights_read
  on public.player_weekly_weights
  for select
  to authenticated
  using (
    public.user_has_section_access('fitness')
    or public.user_has_section_access('squad')
  );

drop policy if exists player_weekly_weights_write on public.player_weekly_weights;
create policy player_weekly_weights_write
  on public.player_weekly_weights
  for all
  to authenticated
  using (public.user_has_section_access('fitness'))
  with check (public.user_has_section_access('fitness'));

-- -----------------------------------------------------------------------------
-- 4) Realtime
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_weekly_weights'
  ) then
    execute 'alter publication supabase_realtime add table public.player_weekly_weights';
  end if;
end $$;

commit;
