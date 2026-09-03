-- Squad Call confirmation + match category (official / friendly / preseason / other)

alter table if exists public.matches
  add column if not exists match_category text not null default 'official';

alter table if exists public.matches
  drop constraint if exists matches_match_category_check;

alter table if exists public.matches
  add constraint matches_match_category_check
  check (match_category in ('official', 'friendly', 'preseason', 'other'));

alter table if exists public.matches
  add column if not exists squad_call_confirmed_at timestamptz null;

alter table if exists public.matches
  add column if not exists squad_call_confirmed_player_ids text[] null;

-- Backfill historical matches from their free-text competition_name so existing
-- Standings keep working without requiring every match to be re-edited manually.
update public.matches
set match_category = case
  when competition_name ilike '%friendly%' then 'friendly'
  when competition_name ilike '%preseason%'
    or competition_name ilike '%pre-season%'
    or competition_name ilike '%preparatorio%'
    or competition_name ilike '%preparatory%'
    or competition_name ilike '%pretemporada%' then 'preseason'
  else 'official'
end
where match_category = 'official';
