create table public.category_budgets (
  id bigint generated always as identity primary key,
  book_id bigint not null references public.books(id) on delete cascade,
  category_id bigint not null references public.categories(id) on delete cascade,
  effective_from date not null,
  effective_year integer generated always as (extract(year from effective_from)::integer) stored,
  effective_month integer generated always as (extract(month from effective_from)::integer) stored,
  status text not null default 'amount',
  amount integer,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp,
  constraint category_budgets_book_category_effective_year_month_key
    unique (book_id, category_id, effective_year, effective_month),
  constraint category_budgets_status_check
    check (status in ('amount', 'none')),
  constraint category_budgets_status_amount_check
    check (
      (status = 'amount' and amount is not null and amount >= 0)
      or (status = 'none' and amount is null)
    )
);

create index idx_category_budgets_book_category_effective_from
  on public.category_budgets (book_id, category_id, effective_from desc);

alter table public.category_budgets enable row level security;

create policy "Users can read member book category budgets"
  on public.category_budgets for select
  to authenticated
  using (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = public.get_authenticated_user_id()
    )
  );

create policy "Users can insert member book category budgets"
  on public.category_budgets for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = public.get_authenticated_user_id()
    )
  );

create policy "Users can update member book category budgets"
  on public.category_budgets for update
  to authenticated
  using (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = public.get_authenticated_user_id()
    )
  )
  with check (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = public.get_authenticated_user_id()
    )
  );

create or replace function public.set_category_budget_ownership()
returns trigger as $$
begin
  if new.book_id is null then
    new.book_id := public.get_authenticated_default_book_id();
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_category_budget_ownership
  before insert on public.category_budgets
  for each row
  execute function public.set_category_budget_ownership();

create or replace function public.keep_category_budget_book_id()
returns trigger as $$
begin
  new.book_id := old.book_id;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_keep_category_budget_book_id
  before update on public.category_budgets
  for each row
  execute function public.keep_category_budget_book_id();

create or replace function public.update_category_budget_updated_at()
returns trigger as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_update_category_budget_updated_at
  before update on public.category_budgets
  for each row
  execute function public.update_category_budget_updated_at();

create or replace function public.ensure_category_budget_category_book()
returns trigger as $$
begin
  if not exists (
    select 1
    from public.categories
    where categories.id = new.category_id
      and categories.book_id = new.book_id
  ) then
    raise exception 'Category budget category must belong to the same book.'
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_ensure_category_budget_category_book
  before insert or update of book_id, category_id on public.category_budgets
  for each row
  execute function public.ensure_category_budget_category_book();

create or replace function public.create_category_with_pin_and_budget(
  p_category_name text,
  p_pinned boolean,
  p_budget_amount integer default null
)
returns bigint as $$
declare
  authenticated_default_book_id bigint;
  created_category_id bigint;
  current_month_start date := date_trunc('month', current_date)::date;
begin
  authenticated_default_book_id := public.get_authenticated_default_book_id();

  insert into public.categories (book_id, name)
  values (authenticated_default_book_id, p_category_name)
  returning id into created_category_id;

  if p_pinned then
    insert into public.category_pins (category_id)
    values (created_category_id);
  end if;

  if p_budget_amount is not null then
    insert into public.category_budgets (book_id, category_id, effective_from, status, amount)
    values (
      authenticated_default_book_id,
      created_category_id,
      current_month_start,
      'amount',
      p_budget_amount
    )
    on conflict (book_id, category_id, effective_year, effective_month)
    do update
      set status = excluded.status,
          amount = excluded.amount;
  end if;

  return created_category_id;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.create_category_with_pin_and_budget(text, boolean, integer) from public;
revoke all on function public.create_category_with_pin_and_budget(text, boolean, integer) from anon;
grant execute on function public.create_category_with_pin_and_budget(text, boolean, integer) to authenticated;
grant execute on function public.create_category_with_pin_and_budget(text, boolean, integer) to service_role;

create or replace function public.update_category_with_pin_and_budget(
  p_category_id bigint,
  p_category_name text,
  p_pinned boolean,
  p_budget_amount integer default null,
  p_budget_action text default 'keep'
)
returns void as $$
declare
  authenticated_user_id bigint;
  category_book_id bigint;
  current_month_start date := date_trunc('month', current_date)::date;
  updated_category_count integer;
  has_pin boolean;
begin
  if p_budget_action not in ('keep', 'set', 'unset') then
    raise exception 'Invalid category budget action.'
      using errcode = '22023';
  end if;

  if p_budget_action = 'set' and p_budget_amount is null then
    raise exception 'Category budget amount is required.'
      using errcode = '23514';
  end if;

  if p_budget_action <> 'set' and p_budget_amount is not null then
    raise exception 'Category budget amount is only allowed for set action.'
      using errcode = '23514';
  end if;

  authenticated_user_id := public.get_authenticated_user_id();

  update public.categories
  set name = p_category_name
  where categories.id = p_category_id
  returning book_id into category_book_id;

  get diagnostics updated_category_count = row_count;

  if updated_category_count <> 1 then
    raise exception 'Category was not updated.'
      using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.category_pins
    where user_id = authenticated_user_id
      and category_id = p_category_id
  )
  into has_pin;

  if p_pinned and not has_pin then
    insert into public.category_pins (category_id)
    values (p_category_id);
  end if;

  if not p_pinned and has_pin then
    delete from public.category_pins
    where user_id = authenticated_user_id
      and category_id = p_category_id;
  end if;

  if p_budget_action = 'set' then
    insert into public.category_budgets (book_id, category_id, effective_from, status, amount)
    values (category_book_id, p_category_id, current_month_start, 'amount', p_budget_amount)
    on conflict (book_id, category_id, effective_year, effective_month)
    do update
      set status = excluded.status,
          amount = excluded.amount;
  end if;

  if p_budget_action = 'unset' then
    insert into public.category_budgets (book_id, category_id, effective_from, status, amount)
    values (category_book_id, p_category_id, current_month_start, 'none', null)
    on conflict (book_id, category_id, effective_year, effective_month)
    do update
      set status = excluded.status,
          amount = excluded.amount;
  end if;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.update_category_with_pin_and_budget(bigint, text, boolean, integer, text) from public;
revoke all on function public.update_category_with_pin_and_budget(bigint, text, boolean, integer, text) from anon;
grant execute on function public.update_category_with_pin_and_budget(bigint, text, boolean, integer, text) to authenticated;
grant execute on function public.update_category_with_pin_and_budget(bigint, text, boolean, integer, text) to service_role;

create or replace function public.delete_category_with_budget(
  p_category_id bigint
)
returns void as $$
declare
  deleted_category_count integer;
begin
  delete from public.categories
  where categories.id = p_category_id;

  get diagnostics deleted_category_count = row_count;

  if deleted_category_count <> 1 then
    raise exception 'Category was not deleted.'
      using errcode = 'P0002';
  end if;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.delete_category_with_budget(bigint) from public;
revoke all on function public.delete_category_with_budget(bigint) from anon;
grant execute on function public.delete_category_with_budget(bigint) to authenticated;
grant execute on function public.delete_category_with_budget(bigint) to service_role;

create or replace function public.get_effective_category_budgets(
  p_target_month date
)
returns jsonb as $$
declare
  authenticated_default_book_id bigint;
  target_month_end date;
begin
  authenticated_default_book_id := public.get_authenticated_default_book_id();
  target_month_end := (date_trunc('month', p_target_month)::date + interval '1 month - 1 day')::date;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'category_id', effective_budgets.category_id,
          'status', effective_budgets.status,
          'amount', effective_budgets.amount
        )
        order by effective_budgets.category_id
      )
      from (
        select distinct on (category_budgets.category_id)
          category_budgets.category_id,
          category_budgets.status,
          category_budgets.amount,
          category_budgets.effective_from
        from public.category_budgets
        join public.categories on categories.id = category_budgets.category_id
        where category_budgets.book_id = authenticated_default_book_id
          and categories.book_id = authenticated_default_book_id
          and category_budgets.effective_from <= target_month_end
        order by category_budgets.category_id, category_budgets.effective_from desc
      ) effective_budgets
    ),
    '[]'::jsonb
  );
end;
$$ language plpgsql security invoker stable set search_path = public;

revoke all on function public.get_effective_category_budgets(date) from public;
revoke all on function public.get_effective_category_budgets(date) from anon;
grant execute on function public.get_effective_category_budgets(date) to authenticated;
grant execute on function public.get_effective_category_budgets(date) to service_role;
