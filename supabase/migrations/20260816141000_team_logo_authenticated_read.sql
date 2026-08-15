-- Club identity is shared across every authenticated portal section.

alter table public.team_logo_config enable row level security;

drop policy if exists team_logo_config_read_authenticated on public.team_logo_config;
create policy team_logo_config_read_authenticated
  on public.team_logo_config for select to authenticated
  using (auth.uid() is not null);

drop policy if exists team_logo_config_write_authenticated on public.team_logo_config;
drop policy if exists team_logo_config_write_admin on public.team_logo_config;
create policy team_logo_config_write_admin
  on public.team_logo_config for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());