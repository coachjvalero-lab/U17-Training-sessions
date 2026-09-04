-- Set Pieces visual redesign: add image/video fields to the existing public.set_piece_plays
-- table (does NOT touch the diagram/coordinates column or any existing rows), plus a private
-- storage bucket for the Keynote-exported set piece images.

alter table public.set_piece_plays
  add column if not exists image_url text,
  add column if not exists video_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'set-piece-images',
  'set-piece-images',
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
drop policy if exists set_piece_images_select on storage.objects;
drop policy if exists set_piece_images_insert on storage.objects;
drop policy if exists set_piece_images_update on storage.objects;
drop policy if exists set_piece_images_delete on storage.objects;

create policy set_piece_images_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'set-piece-images'
    and public.has_section_access('football')
  );

create policy set_piece_images_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'set-piece-images'
    and public.has_section_access('football')
  );

create policy set_piece_images_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'set-piece-images'
    and public.has_section_access('football')
  )
  with check (
    bucket_id = 'set-piece-images'
    and public.has_section_access('football')
  );

create policy set_piece_images_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'set-piece-images'
    and public.has_section_access('football')
  );
