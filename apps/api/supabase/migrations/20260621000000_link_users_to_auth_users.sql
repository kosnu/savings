create temp table user_auth_migration_row_counts as
select *
from (
  values
    ('users', (select count(*) from public.users)),
    ('books', (select count(*) from public.books)),
    ('book_members', (select count(*) from public.book_members)),
    ('payments', (select count(*) from public.payments)),
    ('monthly_budgets', (select count(*) from public.monthly_budgets)),
    ('categories', (select count(*) from public.categories)),
    ('category_pins', (select count(*) from public.category_pins)),
    ('category_budgets', (select count(*) from public.category_budgets))
) as counts(table_name, row_count);

create temp table user_auth_migration_existing_rows as
select 'users'::text as table_name, id as row_id from public.users
union all
select 'books', id from public.books
union all
select 'book_members', id from public.book_members
union all
select 'payments', id from public.payments
union all
select 'monthly_budgets', id from public.monthly_budgets
union all
select 'categories', id from public.categories
union all
select 'category_pins', id from public.category_pins
union all
select 'category_budgets', id from public.category_budgets;

alter table public.users
  rename column external_id to legacy_external_id;

alter table public.users
  drop constraint if exists users_external_id_key,
  alter column legacy_external_id drop not null,
  add column auth_user_id uuid;

with uuid_candidates as materialized (
  select
    users.id,
    users.legacy_external_id::uuid as auth_user_id
  from public.users
  where users.legacy_external_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
update public.users
set auth_user_id = uuid_candidates.auth_user_id
from uuid_candidates
join auth.users on auth.users.id = uuid_candidates.auth_user_id
where public.users.id = uuid_candidates.id;

alter table public.users
  add constraint users_auth_user_id_key unique (auth_user_id),
  add constraint users_auth_user_id_fkey
    foreign key (auth_user_id)
    references auth.users(id)
    on delete cascade;

create or replace function public.get_authenticated_user_id()
returns bigint as $$
declare
  authenticated_user_id bigint;
begin
  select id into authenticated_user_id
  from public.users
  where auth_user_id = auth.uid();

  if authenticated_user_id is null then
    raise exception 'User not found for auth.uid: %', auth.uid();
  end if;

  return authenticated_user_id;
end;
$$ language plpgsql security invoker stable set search_path = public;

revoke all on function public.get_authenticated_user_id() from public;
revoke all on function public.get_authenticated_user_id() from anon;
grant execute on function public.get_authenticated_user_id() to authenticated;
grant execute on function public.get_authenticated_user_id() to service_role;

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

  authenticated_name := coalesce(
    nullif(trim(auth.jwt() #>> '{user_metadata,name}'), ''),
    nullif(trim(auth.jwt() #>> '{user_metadata,full_name}'), ''),
    nullif(split_part(authenticated_email, '@', 1), ''),
    'User'
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

create or replace function public.create_default_book_for_user()
returns trigger as $$
declare
  default_book_id bigint;
begin
  insert into public.books (name)
  values ('Default Book')
  returning id into default_book_id;

  insert into public.book_members (book_id, user_id, is_default)
  values (default_book_id, new.id, true);

  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.create_default_book_for_user() from public;
revoke all on function public.create_default_book_for_user() from anon;
revoke all on function public.create_default_book_for_user() from authenticated;

revoke insert, update on table public.users from authenticated;
grant select on table public.users to authenticated;
grant update (name) on table public.users to authenticated;
grant select on table public.books to authenticated;
grant select on table public.book_members to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.monthly_budgets to authenticated;
grant select, insert, delete on table public.category_pins to authenticated;
grant select, insert, update, delete on table public.category_budgets to authenticated;

create or replace function public.delete_orphan_book_after_membership_delete()
returns trigger as $$
begin
  delete from public.books
  where id = old.book_id
    and not exists (
      select 1
      from public.book_members
      where book_members.book_id = old.book_id
    );

  return old;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists trg_delete_orphan_book_after_membership_delete on public.book_members;
create trigger trg_delete_orphan_book_after_membership_delete
  after delete on public.book_members
  for each row
  execute function public.delete_orphan_book_after_membership_delete();

create or replace function public.update_user_updated_at()
returns trigger as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists trg_update_user_updated_at on public.users;
create trigger trg_update_user_updated_at
  before update of name on public.users
  for each row
  execute function public.update_user_updated_at();

drop policy if exists "Users can read own row" on public.users;
create policy "Users can read own row"
  on public.users for select
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "Users can insert own row" on public.users;
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
  );

drop policy if exists "Users can read member books" on public.books;
create policy "Users can read member books"
  on public.books for select
  to authenticated
  using (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = books.id
        and book_members.user_id = public.get_authenticated_user_id()
    )
  );

drop policy if exists "Users can read own book memberships" on public.book_members;
create policy "Users can read own book memberships"
  on public.book_members for select
  to authenticated
  using (user_id = public.get_authenticated_user_id());

drop policy if exists "Users can read own category pins" on public.category_pins;
create policy "Users can read own category pins"
  on public.category_pins for select
  to authenticated
  using (user_id = public.get_authenticated_user_id());

drop policy if exists "Users can delete own category pins" on public.category_pins;
create policy "Users can delete own category pins"
  on public.category_pins for delete
  to authenticated
  using (user_id = public.get_authenticated_user_id());

do $$
declare
  count_record record;
  current_count bigint;
  missing_count bigint;
begin
  for count_record in
    select table_name, row_count
    from user_auth_migration_row_counts
  loop
    execute format('select count(*) from public.%I', count_record.table_name)
      into current_count;

    if current_count < count_record.row_count then
      raise exception
        'Migration deleted rows from %. before=%, after=%',
        count_record.table_name,
        count_record.row_count,
        current_count;
    end if;

    execute format(
      'select count(*)
       from user_auth_migration_existing_rows existing_rows
       where existing_rows.table_name = %L
         and not exists (
           select 1 from public.%I current_rows
           where current_rows.id = existing_rows.row_id
         )',
      count_record.table_name,
      count_record.table_name
    ) into missing_count;

    if missing_count > 0 then
      raise exception
        'Migration deleted existing rows from %. missing_count=%',
        count_record.table_name,
        missing_count;
    end if;
  end loop;
end $$;

drop table user_auth_migration_existing_rows;
drop table user_auth_migration_row_counts;
