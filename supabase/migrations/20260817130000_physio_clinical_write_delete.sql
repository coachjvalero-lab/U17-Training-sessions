-- Physio Phase 2A: canonical clinical write authorization and safe injury deletion.
-- Read policies and clinical foreign-key behavior are intentionally unchanged.

-- Ensure the existing Physio role owns the clinical write actions in the
-- canonical role/section/action authorization model.
insert into public.app_role_section_action_grants (role_id, section_action_id)
select app_role.id, section_action.id
from public.app_roles app_role
join public.app_sections app_section on app_section.key = 'physio'
join public.app_section_actions section_action
  on section_action.section_id = app_section.id
 and section_action.action_key in ('create', 'update', 'delete')
where app_role.key = 'physio'
on conflict (role_id, section_action_id) do nothing;

-- Writes use canonical action grants plus the team ID stored on each row.
-- public.can() grants admins according to the existing admin scope; all other
-- users require the corresponding role action, section assignment, and team
-- membership.
drop policy if exists injuries_physio_insert on public.injuries;
create policy injuries_physio_insert on public.injuries
for insert to authenticated
with check (public.can('physio', 'create', team_id));

drop policy if exists injuries_physio_update on public.injuries;
create policy injuries_physio_update on public.injuries
for update to authenticated
using (public.can('physio', 'update', team_id))
with check (public.can('physio', 'update', team_id));

drop policy if exists injuries_physio_delete on public.injuries;
create policy injuries_physio_delete on public.injuries
for delete to authenticated
using (public.can('physio', 'delete', team_id));

drop policy if exists injury_follow_ups_physio_insert on public.injury_follow_ups;
create policy injury_follow_ups_physio_insert on public.injury_follow_ups
for insert to authenticated
with check (
  exists (
    select 1
    from public.injuries injury
    where injury.id = injury_follow_ups.injury_id
      and public.can('physio', 'update', injury.team_id)
  )
);

drop policy if exists physio_complaints_insert on public.physio_complaints;
create policy physio_complaints_insert on public.physio_complaints
for insert to authenticated
with check (public.can('physio', 'create', team_id));

drop policy if exists physio_complaints_update on public.physio_complaints;
create policy physio_complaints_update on public.physio_complaints
for update to authenticated
using (public.can('physio', 'update', team_id))
with check (public.can('physio', 'update', team_id));

-- RLS and the table privilege are both required. No DELETE privilege is granted
-- on complaints or follow-ups; follow-ups are removed only by their existing
-- ON DELETE CASCADE relationship when their parent injury is deleted.
grant delete on table public.injuries to authenticated;
