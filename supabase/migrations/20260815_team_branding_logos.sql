-- Canonical club identity metadata and application-owned crest storage.

alter table public.auth_teams
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos',
  'team-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update public.auth_teams
set logo_url = case id
  when 'al-nassr-u17' then 'https://mqvuzzdswwuncjgvnahs.supabase.co/storage/v1/object/public/team-logos/al-nassr-u17.png'
  when 'jeddah-united-academy-u17' then 'https://mqvuzzdswwuncjgvnahs.supabase.co/storage/v1/object/public/team-logos/jeddah-united-academy-u17.png'
  when 'al-hilal-u17' then 'https://mqvuzzdswwuncjgvnahs.supabase.co/storage/v1/object/public/team-logos/al-hilal-u17.png'
  when 'al-ahli-u17' then 'https://mqvuzzdswwuncjgvnahs.supabase.co/storage/v1/object/public/team-logos/al-ahli-u17.png'
  when 'al-qadisiyah-u17' then 'https://mqvuzzdswwuncjgvnahs.supabase.co/storage/v1/object/public/team-logos/al-qadisiyah-u17.png'
  when 'al-ittihad-u17' then 'https://mqvuzzdswwuncjgvnahs.supabase.co/storage/v1/object/public/team-logos/al-ittihad-u17.png'
  when 'najmat-jeddah-u17' then 'https://mqvuzzdswwuncjgvnahs.supabase.co/storage/v1/object/public/team-logos/najmat-jeddah-u17.png'
  else logo_url
end,
updated_at = now()
where id in (
  'al-nassr-u17',
  'jeddah-united-academy-u17',
  'al-hilal-u17',
  'al-ahli-u17',
  'al-qadisiyah-u17',
  'al-ittihad-u17',
  'najmat-jeddah-u17'
);
