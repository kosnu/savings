drop function if exists public.ensure_authenticated_user(text, text);

create or replace function public.ensure_authenticated_user()
returns void as $$
declare
  authenticated_external_id text := auth.uid()::text;
  authenticated_email text := auth.jwt() ->> 'email';
  authenticated_name text;
begin
  if authenticated_external_id is null then
    raise exception 'Authenticated user id is required.';
  end if;

  if nullif(trim(authenticated_email), '') is null then
    raise exception 'Authenticated user email is required.';
  end if;

  authenticated_email := trim(authenticated_email);
  authenticated_name := coalesce(
    nullif(trim(auth.jwt() #>> '{user_metadata,name}'), ''),
    nullif(trim(auth.jwt() #>> '{user_metadata,full_name}'), ''),
    nullif(split_part(authenticated_email, '@', 1), ''),
    'User'
  );

  insert into public.users (external_id, name, email)
  values (
    authenticated_external_id,
    authenticated_name,
    authenticated_email
  )
  on conflict (external_id) do nothing;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.ensure_authenticated_user() from public;
revoke all on function public.ensure_authenticated_user() from anon;
grant execute on function public.ensure_authenticated_user() to authenticated;
