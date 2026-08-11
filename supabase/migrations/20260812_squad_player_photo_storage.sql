-- Squad player photos storage bucket and policies
-- Scope: squad photos only

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'squad-player-photos',
  'squad-player-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove any previous policy variants for this bucket before creating the canonical set.
drop policy if exists squad_player_photos_select on storage.objects;
drop policy if exists squad_player_photos_insert on storage.objects;
drop policy if exists squad_player_photos_update on storage.objects;
drop policy if exists squad_player_photos_delete on storage.objects;

create policy squad_player_photos_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'squad-player-photos'
    and public.has_section_access('squad')
  );

create policy squad_player_photos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'squad-player-photos'
    and public.has_section_access('squad')
  );

create policy squad_player_photos_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'squad-player-photos'
    and public.has_section_access('squad')
  )
  with check (
    bucket_id = 'squad-player-photos'
    and public.has_section_access('squad')
  );

create policy squad_player_photos_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'squad-player-photos'
    and public.has_section_access('squad')
  );
