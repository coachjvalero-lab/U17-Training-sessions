create table if not exists public.match_plan (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  phase text not null check (phase in ('attack', 'defence', 'transitions')),
  notes text not null default '',
  video_url text,
  image_1_url text,
  image_2_url text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, phase)
);

create table if not exists public.match_set_pieces (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  attacking_notes text not null default '',
  attacking_video_url text,
  attacking_image_1_url text,
  attacking_image_2_url text,
  defensive_notes text not null default '',
  defensive_video_url text,
  defensive_image_1_url text,
  defensive_image_2_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.match_plan enable row level security;
alter table if exists public.match_set_pieces enable row level security;

drop policy if exists match_plan_read_football on public.match_plan;
drop policy if exists match_plan_write_football on public.match_plan;
create policy match_plan_read_football
  on public.match_plan
  for select
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_plan.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

create policy match_plan_write_football
  on public.match_plan
  for all
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_plan.match_id
        and public.user_has_team_membership(m.team_id)
    )
  )
  with check (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_plan.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

drop policy if exists match_set_pieces_read_football on public.match_set_pieces;
drop policy if exists match_set_pieces_write_football on public.match_set_pieces;
create policy match_set_pieces_read_football
  on public.match_set_pieces
  for select
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_set_pieces.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

create policy match_set_pieces_write_football
  on public.match_set_pieces
  for all
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_set_pieces.match_id
        and public.user_has_team_membership(m.team_id)
    )
  )
  with check (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_set_pieces.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );
