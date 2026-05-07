alter table monthly_budgets
  add column book_id bigint references books(id) on delete cascade;

alter table category_budgets
  add column book_id bigint references books(id) on delete cascade;

update monthly_budgets
set book_id = book_members.book_id
from book_members
where book_members.user_id = monthly_budgets.user_id
  and book_members.is_default;

update category_budgets
set book_id = book_members.book_id
from book_members
where book_members.user_id = category_budgets.user_id
  and book_members.is_default;

do $$
begin
  if exists (select 1 from monthly_budgets where book_id is null) then
    raise exception 'Default book is missing for existing monthly budgets.';
  end if;

  if exists (select 1 from category_budgets where book_id is null) then
    raise exception 'Default book is missing for existing category budgets.';
  end if;

  if exists (
    select 1
    from category_budgets
    join categories on categories.id = category_budgets.category_id
    where categories.book_id <> category_budgets.book_id
  ) then
    raise exception 'Category budget category must belong to the same book.';
  end if;
end $$;

alter table monthly_budgets
  alter column book_id set not null,
  alter column book_id set default get_authenticated_default_book_id();

alter table category_budgets
  alter column book_id set not null,
  alter column book_id set default get_authenticated_default_book_id();

alter table monthly_budgets
  drop constraint monthly_budgets_user_effective_year_month_key,
  add constraint monthly_budgets_book_effective_year_month_key
    unique (book_id, effective_year, effective_month);

alter table category_budgets
  drop constraint category_budgets_user_category_effective_year_month_key,
  add constraint category_budgets_book_category_effective_year_month_key
    unique (book_id, category_id, effective_year, effective_month);

drop index if exists idx_monthly_budgets_user_effective_from;
drop index if exists idx_category_budgets_user_category_effective_from;

create index idx_monthly_budgets_book_effective_from
    on monthly_budgets (book_id, effective_from desc);

create index idx_category_budgets_book_category_effective_from
    on category_budgets (book_id, category_id, effective_from desc);

drop trigger if exists trg_set_monthly_budget_user_id on monthly_budgets;
drop function if exists set_monthly_budget_user_id();

create or replace function set_monthly_budget_ownership()
returns trigger as $$
begin
  new.user_id := get_authenticated_user_id();

  if new.book_id is null then
    new.book_id := get_authenticated_default_book_id();
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_monthly_budget_ownership
  before insert on monthly_budgets
  for each row
  execute function set_monthly_budget_ownership();

create or replace function keep_monthly_budget_book_id()
returns trigger as $$
begin
  new.book_id := old.book_id;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_keep_monthly_budget_book_id
  before update on monthly_budgets
  for each row
  execute function keep_monthly_budget_book_id();

drop trigger if exists trg_set_category_budget_user_id on category_budgets;
drop function if exists set_category_budget_user_id();

create or replace function set_category_budget_ownership()
returns trigger as $$
begin
  new.user_id := get_authenticated_user_id();

  if new.book_id is null then
    new.book_id := get_authenticated_default_book_id();
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_category_budget_ownership
  before insert on category_budgets
  for each row
  execute function set_category_budget_ownership();

create or replace function keep_category_budget_book_id()
returns trigger as $$
begin
  new.book_id := old.book_id;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_keep_category_budget_book_id
  before update on category_budgets
  for each row
  execute function keep_category_budget_book_id();

drop trigger if exists trg_validate_category_budget_category_membership on category_budgets;
drop function if exists ensure_category_budget_category_membership();

create or replace function ensure_category_budget_category_book()
returns trigger as $$
begin
  if not exists (
    select 1
    from categories
    where categories.id = new.category_id
      and categories.book_id = new.book_id
  ) then
    raise exception 'Category budget category must belong to the same book.';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_validate_category_budget_category_book
  before insert or update of book_id, category_id on category_budgets
  for each row
  execute function ensure_category_budget_category_book();

drop policy "Users can read own monthly budgets" on monthly_budgets;
drop policy "Users can insert own monthly budgets" on monthly_budgets;
drop policy "Users can update own monthly budgets" on monthly_budgets;

create policy "Users can read member book monthly budgets"
  on monthly_budgets for select
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = monthly_budgets.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create policy "Users can insert member book monthly budgets"
  on monthly_budgets for insert
  to authenticated
  with check (
    exists (
      select 1
      from book_members
      where book_members.book_id = monthly_budgets.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create policy "Users can update member book monthly budgets"
  on monthly_budgets for update
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = monthly_budgets.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  )
  with check (
    exists (
      select 1
      from book_members
      where book_members.book_id = monthly_budgets.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

drop policy "Users can read own category budgets" on category_budgets;
drop policy "Users can insert member book category budgets" on category_budgets;

create policy "Users can read member book category budgets"
  on category_budgets for select
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create policy "Users can insert member book category budgets"
  on category_budgets for insert
  to authenticated
  with check (
    exists (
      select 1
      from book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create policy "Users can update member book category budgets"
  on category_budgets for update
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  )
  with check (
    exists (
      select 1
      from book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );
