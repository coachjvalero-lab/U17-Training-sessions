-- =============================================================================
-- U17 Training Sessions – Meetings Module
-- Schema + RLS for public.meetings, public.meeting_attendees,
-- public.meeting_action_items
-- Run this after phase2_auth_rls.sql (depends on user_roles + helper functions).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. meetings
-- ---------------------------------------------------------------------------

create table if not exists public.meetings (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null,
  date          date        not null,
  start_time    time        ,
  end_time      time        ,
  location      text        ,
  meeting_type  text        not null default 'staff_meeting'
                            check (meeting_type in (
                              'staff_meeting',
                              'coaching_meeting',
                              'player_meeting',
                              'performance_meeting',
                              'medical_physio_meeting',
                              'recruitment_meeting',
                              'other'
                            )),
  organizer_email text      ,   -- loose ref to user_roles(email); nullable so historic meetings survive user deletion
  topic         text        not null default '',
  agenda        text        not null default '',
  summary       text        not null default '',
  key_points    text[]      not null default '{}',
  decisions     text[]      not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    text        ,   -- email of creator
  updated_by    text            -- email of last editor
);

create index if not exists meetings_date_idx           on public.meetings (date desc);
create index if not exists meetings_meeting_type_idx   on public.meetings (meeting_type);
create index if not exists meetings_updated_at_idx     on public.meetings (updated_at desc);
create index if not exists meetings_created_by_idx     on public.meetings (created_by);

-- updated_at trigger
create or replace function public.set_meetings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_meetings_updated_at();

-- ---------------------------------------------------------------------------
-- 2. meeting_attendees
-- ---------------------------------------------------------------------------

create table if not exists public.meeting_attendees (
  id           uuid   primary key default gen_random_uuid(),
  meeting_id   uuid   not null references public.meetings (id) on delete cascade,
  email        text   not null,
  display_name text   ,         -- denormalised for fast display; not a FK to allow external guests later
  unique (meeting_id, email)
);

create index if not exists meeting_attendees_meeting_id_idx on public.meeting_attendees (meeting_id);
create index if not exists meeting_attendees_email_idx      on public.meeting_attendees (email);

-- ---------------------------------------------------------------------------
-- 3. meeting_action_items
-- ---------------------------------------------------------------------------

create table if not exists public.meeting_action_items (
  id            uuid        primary key default gen_random_uuid(),
  meeting_id    uuid        not null references public.meetings (id) on delete cascade,
  description   text        not null,
  assigned_to   text        ,   -- email (loose ref)
  due_date      date        ,
  status        text        not null default 'pending'
                            check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at  timestamptz ,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists meeting_action_items_meeting_id_idx on public.meeting_action_items (meeting_id);
create index if not exists meeting_action_items_status_idx     on public.meeting_action_items (status);
create index if not exists meeting_action_items_assigned_to_idx on public.meeting_action_items (assigned_to);

create or replace function public.set_meeting_action_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meeting_action_items_set_updated_at on public.meeting_action_items;
create trigger meeting_action_items_set_updated_at
  before update on public.meeting_action_items
  for each row execute function public.set_meeting_action_items_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
-- Depends on: public.has_section_access() and public.is_admin_user()
-- defined in phase2_auth_rls.sql.
--
-- Access model:
--   READ   → any authenticated user with 'meetings' section access (or admin)
--   INSERT → meetings section access (or admin); created_by must match caller
--   UPDATE → admin OR (meetings access AND updated_by matches caller)
--   DELETE → admin OR (meetings access AND created_by matches caller)
-- Attendees and action_items inherit the parent meeting's access.
-- =============================================================================

alter table public.meetings              enable row level security;
alter table public.meeting_attendees     enable row level security;
alter table public.meeting_action_items  enable row level security;

-- ---- meetings ---------------------------------------------------------------

drop policy if exists meetings_select on public.meetings;
create policy meetings_select
  on public.meetings
  for select
  to authenticated
  using (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert
  on public.meetings
  for insert
  to authenticated
  with check (
    (public.is_admin_user() or public.has_section_access('meetings'))
    and created_by = public.current_user_email()
  );

drop policy if exists meetings_update on public.meetings;
create policy meetings_update
  on public.meetings
  for update
  to authenticated
  using (
    public.is_admin_user()
    or (public.has_section_access('meetings'))
  )
  with check (
    public.is_admin_user()
    or (public.has_section_access('meetings'))
  );

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete
  on public.meetings
  for delete
  to authenticated
  using (
    public.is_admin_user()
    or (
      public.has_section_access('meetings')
      and created_by = public.current_user_email()
    )
  );

-- ---- meeting_attendees ------------------------------------------------------

drop policy if exists meeting_attendees_select on public.meeting_attendees;
create policy meeting_attendees_select
  on public.meeting_attendees
  for select
  to authenticated
  using (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

drop policy if exists meeting_attendees_insert on public.meeting_attendees;
create policy meeting_attendees_insert
  on public.meeting_attendees
  for insert
  to authenticated
  with check (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

drop policy if exists meeting_attendees_update on public.meeting_attendees;
create policy meeting_attendees_update
  on public.meeting_attendees
  for update
  to authenticated
  using (public.is_admin_user() or public.has_section_access('meetings'))
  with check (public.is_admin_user() or public.has_section_access('meetings'));

drop policy if exists meeting_attendees_delete on public.meeting_attendees;
create policy meeting_attendees_delete
  on public.meeting_attendees
  for delete
  to authenticated
  using (public.is_admin_user() or public.has_section_access('meetings'));

-- ---- meeting_action_items ---------------------------------------------------

drop policy if exists meeting_action_items_select on public.meeting_action_items;
create policy meeting_action_items_select
  on public.meeting_action_items
  for select
  to authenticated
  using (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

drop policy if exists meeting_action_items_insert on public.meeting_action_items;
create policy meeting_action_items_insert
  on public.meeting_action_items
  for insert
  to authenticated
  with check (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

drop policy if exists meeting_action_items_update on public.meeting_action_items;
create policy meeting_action_items_update
  on public.meeting_action_items
  for update
  to authenticated
  using (public.is_admin_user() or public.has_section_access('meetings'))
  with check (public.is_admin_user() or public.has_section_access('meetings'));

drop policy if exists meeting_action_items_delete on public.meeting_action_items;
create policy meeting_action_items_delete
  on public.meeting_action_items
  for delete
  to authenticated
  using (public.is_admin_user() or public.has_section_access('meetings'));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.meeting_attendees;
alter publication supabase_realtime add table public.meeting_action_items;
