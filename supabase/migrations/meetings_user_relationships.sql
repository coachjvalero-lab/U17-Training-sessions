-- =============================================================================
-- Meetings Module: Migrate to UUID-based User Relationships
-- 
-- Changes from email-based to user_id (UUID) references:
-- - meeting_attendees: email (text) → user_id (UUID FK)
-- - meeting_action_items: assigned_to (text) → assigned_to_user_id (UUID FK)
-- - meetings: organizer_email (text) → organizer_user_id (UUID FK)
-- - meetings: created_by, updated_by (text emails) → user_id UUIDs (FK)
--
-- PRECONDITION: Meetings table must be empty (0 records)
-- SAFETY: This migration is destructive and only safe when Meetings is empty
-- =============================================================================

-- Step 1: Drop RLS policies (we'll recreate them after schema change)
drop policy if exists meetings_select on public.meetings;
drop policy if exists meetings_insert on public.meetings;
drop policy if exists meetings_update on public.meetings;
drop policy if exists meetings_delete on public.meetings;
drop policy if exists meeting_attendees_select on public.meeting_attendees;
drop policy if exists meeting_attendees_insert on public.meeting_attendees;
drop policy if exists meeting_attendees_update on public.meeting_attendees;
drop policy if exists meeting_attendees_delete on public.meeting_attendees;
drop policy if exists meeting_action_items_select on public.meeting_action_items;
drop policy if exists meeting_action_items_insert on public.meeting_action_items;
drop policy if exists meeting_action_items_update on public.meeting_action_items;
drop policy if exists meeting_action_items_delete on public.meeting_action_items;

-- Step 2: Drop existing indexes
drop index if exists meeting_attendees_email_idx;
drop index if exists meeting_action_items_assigned_to_idx;

-- Step 3: Modify meeting_attendees table
-- Replace email with user_id FK, keep display_name as snapshot
alter table public.meeting_attendees 
drop constraint if exists meeting_attendees_meeting_id_email_key;

alter table public.meeting_attendees
drop column if exists email;

-- NOT NULL + ON DELETE CASCADE: if a user profile is deleted their attendee
-- rows are removed, but the meeting record itself is preserved.
alter table public.meeting_attendees
add column if not exists user_id uuid
  references public.user_profiles(user_id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'meeting_attendees_meeting_id_user_id_key'
  ) then
    alter table public.meeting_attendees
    add constraint meeting_attendees_meeting_id_user_id_key unique (meeting_id, user_id);
  end if;
end $$;

-- Add index on user_id for queries
create index if not exists meeting_attendees_user_id_idx on public.meeting_attendees (user_id);

-- Step 4: Modify meeting_action_items table
-- Replace assigned_to (email string) with assigned_to_user_id (UUID FK)
alter table public.meeting_action_items
drop column if exists assigned_to;

alter table public.meeting_action_items
add column if not exists assigned_to_user_id uuid 
  references public.user_profiles(user_id) on delete set null;

-- Add index on assigned_to_user_id
create index if not exists meeting_action_items_assigned_to_user_id_idx 
  on public.meeting_action_items (assigned_to_user_id);

-- Step 5: Modify meetings table
-- Replace organizer_email with organizer_user_id
-- Replace created_by, updated_by with UUID FKs (nullable to preserve history on user deletion)
alter table public.meetings
drop column if exists organizer_email;

alter table public.meetings
add column if not exists organizer_user_id uuid 
  references public.user_profiles(user_id) on delete set null;

-- nullable so meeting record survives if the creator's profile is deleted
alter table public.meetings
drop column if exists created_by;

alter table public.meetings
add column if not exists created_by_user_id uuid
  references public.user_profiles(user_id) on delete set null;

alter table public.meetings
drop column if exists updated_by;

alter table public.meetings
add column if not exists updated_by_user_id uuid
  references public.user_profiles(user_id) on delete set null;

-- Add indexes for created_by_user_id and updated_by_user_id
create index if not exists meetings_created_by_user_id_idx on public.meetings (created_by_user_id);
create index if not exists meetings_updated_by_user_id_idx on public.meetings (updated_by_user_id);
create index if not exists meetings_organizer_user_id_idx on public.meetings (organizer_user_id);

-- Step 6: Recreate RLS policies (using UUID-based references)

-- ---- meetings ---------------------------------------------------------------

create policy meetings_select
  on public.meetings
  for select
  to authenticated
  using (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

create policy meetings_insert
  on public.meetings
  for insert
  to authenticated
  with check (
    public.is_admin_user() or public.has_section_access('meetings')
  );

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

create policy meetings_delete
  on public.meetings
  for delete
  to authenticated
  using (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

-- ---- meeting_attendees ------------------------------------------------------

create policy meeting_attendees_select
  on public.meeting_attendees
  for select
  to authenticated
  using (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

create policy meeting_attendees_insert
  on public.meeting_attendees
  for insert
  to authenticated
  with check (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

create policy meeting_attendees_update
  on public.meeting_attendees
  for update
  to authenticated
  using (public.is_admin_user() or public.has_section_access('meetings'))
  with check (public.is_admin_user() or public.has_section_access('meetings'));

create policy meeting_attendees_delete
  on public.meeting_attendees
  for delete
  to authenticated
  using (public.is_admin_user() or public.has_section_access('meetings'));

-- ---- meeting_action_items ---------------------------------------------------

create policy meeting_action_items_select
  on public.meeting_action_items
  for select
  to authenticated
  using (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

create policy meeting_action_items_insert
  on public.meeting_action_items
  for insert
  to authenticated
  with check (
    public.is_admin_user()
    or public.has_section_access('meetings')
  );

create policy meeting_action_items_update
  on public.meeting_action_items
  for update
  to authenticated
  using (public.is_admin_user() or public.has_section_access('meetings'))
  with check (public.is_admin_user() or public.has_section_access('meetings'));

create policy meeting_action_items_delete
  on public.meeting_action_items
  for delete
  to authenticated
  using (public.is_admin_user() or public.has_section_access('meetings'));
