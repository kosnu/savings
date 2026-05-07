alter table categories
  drop constraint if exists categories_name_key;

alter table categories
  add column book_id bigint references books(id) on delete cascade,
  add column migration_old_category_id bigint;

insert into categories (name, created_at, updated_at, book_id, migration_old_category_id)
select
  categories.name,
  categories.created_at,
  categories.updated_at,
  default_books.book_id,
  categories.id
from categories
cross join (
  select distinct book_id
  from book_members
  where is_default
) default_books
where categories.book_id is null
order by categories.id, default_books.book_id;

update payments
set category_id = new_categories.id
from categories old_categories, categories new_categories
where payments.category_id = old_categories.id
  and old_categories.book_id is null
  and new_categories.migration_old_category_id = old_categories.id
  and new_categories.book_id = payments.book_id;

update category_budgets
set category_id = new_categories.id
from categories old_categories, categories new_categories, book_members
where category_budgets.category_id = old_categories.id
  and old_categories.book_id is null
  and book_members.user_id = category_budgets.user_id
  and book_members.is_default
  and new_categories.migration_old_category_id = old_categories.id
  and new_categories.book_id = book_members.book_id;

update category_pins
set category_id = new_categories.id
from categories old_categories, categories new_categories, book_members
where category_pins.category_id = old_categories.id
  and old_categories.book_id is null
  and book_members.user_id = category_pins.user_id
  and book_members.is_default
  and new_categories.migration_old_category_id = old_categories.id
  and new_categories.book_id = book_members.book_id;

do $$
begin
  if exists (
    select 1
    from payments
    join categories on categories.id = payments.category_id
    where categories.book_id is null
  ) then
    raise exception 'Book-owned category backfill is missing for existing payments.';
  end if;

  if exists (
    select 1
    from category_budgets
    join categories on categories.id = category_budgets.category_id
    where categories.book_id is null
  ) then
    raise exception 'Book-owned category backfill is missing for existing category budgets.';
  end if;

  if exists (
    select 1
    from category_pins
    join categories on categories.id = category_pins.category_id
    where categories.book_id is null
  ) then
    raise exception 'Book-owned category backfill is missing for existing category pins.';
  end if;
end $$;

delete from categories
where book_id is null;

alter table categories
  drop column migration_old_category_id,
  alter column book_id set not null;

alter table categories
  add constraint categories_book_name_key
    unique (book_id, name);

create or replace function ensure_payment_category_book()
returns trigger as $$
begin
  if new.category_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from categories
    where categories.id = new.category_id
      and categories.book_id = new.book_id
  ) then
    raise exception 'Payment category must belong to the same book.';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_validate_payment_category_book
  before insert or update of book_id, category_id on payments
  for each row
  execute function ensure_payment_category_book();

create or replace function ensure_category_budget_category_membership()
returns trigger as $$
begin
  if not exists (
    select 1
    from categories
    join book_members on book_members.book_id = categories.book_id
    where categories.id = new.category_id
      and book_members.user_id = new.user_id
  ) then
    raise exception 'Category budget category must belong to a member book.';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_validate_category_budget_category_membership
  before insert or update of user_id, category_id on category_budgets
  for each row
  execute function ensure_category_budget_category_membership();

create or replace function ensure_category_pin_category_membership()
returns trigger as $$
begin
  if not exists (
    select 1
    from categories
    join book_members on book_members.book_id = categories.book_id
    where categories.id = new.category_id
      and book_members.user_id = new.user_id
  ) then
    raise exception 'Category pin category must belong to a member book.';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_validate_category_pin_category_membership
  before insert or update of user_id, category_id on category_pins
  for each row
  execute function ensure_category_pin_category_membership();

drop policy "Authenticated users can read all categories" on categories;

create policy "Users can read member book categories"
  on categories for select
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = categories.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

drop policy "Users can insert own category budgets" on category_budgets;

create policy "Users can insert member book category budgets"
  on category_budgets for insert
  to authenticated
  with check (
    user_id = get_authenticated_user_id()
    and exists (
      select 1
      from categories
      join book_members on book_members.book_id = categories.book_id
      where categories.id = category_budgets.category_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

drop policy "Users can insert own category pins" on category_pins;

create policy "Users can insert member book category pins"
  on category_pins for insert
  to authenticated
  with check (
    user_id = get_authenticated_user_id()
    and exists (
      select 1
      from categories
      join book_members on book_members.book_id = categories.book_id
      where categories.id = category_pins.category_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );
