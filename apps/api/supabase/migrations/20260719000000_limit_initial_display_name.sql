create or replace function public.ensure_authenticated_user()
returns void as $$
declare
  authenticated_auth_user_id uuid := auth.uid();
  authenticated_email text := auth.jwt() ->> 'email';
  authenticated_name text;
  existing_user_id bigint;
  existing_auth_user_id uuid;
begin
  if authenticated_auth_user_id is null then
    raise exception 'Authenticated user id is required.';
  end if;

  if nullif(trim(authenticated_email), '') is null then
    raise exception 'Authenticated user email is required.';
  end if;

  select id into existing_user_id
  from public.users
  where auth_user_id = authenticated_auth_user_id;

  if existing_user_id is not null then
    return;
  end if;

  authenticated_email := trim(authenticated_email);

  select id, auth_user_id
    into existing_user_id, existing_auth_user_id
  from public.users
  where email = authenticated_email;

  if existing_user_id is not null then
    if existing_auth_user_id = authenticated_auth_user_id then
      return;
    end if;

    if existing_auth_user_id is not null then
      raise exception
        'User account cannot be synchronized. Sign out and sign in again before continuing.';
    end if;

    raise exception
      'User account cannot be synchronized. Sign out and sign in again before continuing.';
  end if;

  authenticated_name := left(
    coalesce(
      nullif(trim(auth.jwt() #>> '{user_metadata,name}'), ''),
      nullif(trim(auth.jwt() #>> '{user_metadata,full_name}'), ''),
      nullif(split_part(authenticated_email, '@', 1), ''),
      'User'
    ),
    64
  );

  insert into public.users (auth_user_id, name, email)
  values (
    authenticated_auth_user_id,
    authenticated_name,
    authenticated_email
  )
  on conflict (auth_user_id) do nothing;
exception
  when foreign_key_violation then
    raise exception
      'Authenticated user % is not present in auth.users. Sign out and sign in again.',
      authenticated_auth_user_id;

  when unique_violation then
    select id, auth_user_id
      into existing_user_id, existing_auth_user_id
    from public.users
    where email = authenticated_email;

    if existing_user_id is not null then
      if existing_auth_user_id = authenticated_auth_user_id then
        return;
      end if;

      if existing_auth_user_id is not null then
        raise exception
          'User account cannot be synchronized. Sign out and sign in again before continuing.';
      end if;

      raise exception
        'User account cannot be synchronized. Sign out and sign in again before continuing.';
    end if;

    raise;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.ensure_authenticated_user() from public;
revoke all on function public.ensure_authenticated_user() from anon;
grant execute on function public.ensure_authenticated_user() to authenticated;
