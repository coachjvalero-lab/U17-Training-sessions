-- Physio Phase 2B: Canonical clinical delete authorization for complaints.
-- Ensures Physio and Admin roles can delete complaints created accidentally or incorrectly.
-- Resulting injuries remain intact because complaints hold the FK reference, not injuries.

drop policy if exists physio_complaints_delete on public.physio_complaints;
create policy physio_complaints_delete on public.physio_complaints
for delete to authenticated
using (public.can('physio', 'delete', team_id));

grant delete on table public.physio_complaints to authenticated;
