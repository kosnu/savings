drop function if exists public.ensure_authenticated_user();

create function public.ensure_authenticated_user(p_initial_display_name text)
returns void as $$
declare
  authenticated_auth_user_id uuid := auth.uid();
  authenticated_email text := auth.jwt() ->> 'email';
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

  insert into public.users (auth_user_id, name, email)
  values (
    authenticated_auth_user_id,
    p_initial_display_name,
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

revoke all on function public.ensure_authenticated_user(text) from public;
revoke all on function public.ensure_authenticated_user(text) from anon;
grant execute on function public.ensure_authenticated_user(text) to authenticated;
