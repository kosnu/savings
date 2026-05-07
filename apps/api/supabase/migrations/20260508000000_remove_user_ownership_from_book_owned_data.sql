do $$
begin
  if exists (select 1 from payments where book_id is null) then
    raise exception 'Book ownership is missing for existing payments.';
  end if;

  if exists (select 1 from monthly_budgets where book_id is null) then
    raise exception 'Book ownership is missing for existing monthly budgets.';
  end if;

  if exists (select 1 from category_budgets where book_id is null) then
    raise exception 'Book ownership is missing for existing category budgets.';
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

drop trigger if exists trg_set_payment_ownership on payments;
drop function if exists set_payment_ownership();

drop trigger if exists trg_set_monthly_budget_ownership on monthly_budgets;
drop function if exists set_monthly_budget_ownership();

drop trigger if exists trg_set_category_budget_ownership on category_budgets;
drop function if exists set_category_budget_ownership();

drop index if exists idx_payments_user_date_category_created;

alter table payments
  drop column user_id;

alter table monthly_budgets
  drop column user_id;

alter table category_budgets
  drop column user_id;

create or replace function set_payment_ownership()
returns trigger as $$
begin
  if new.book_id is null then
    new.book_id := get_authenticated_default_book_id();
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_payment_ownership
  before insert on payments
  for each row
  execute function set_payment_ownership();

create or replace function set_monthly_budget_ownership()
returns trigger as $$
begin
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

create or replace function set_category_budget_ownership()
returns trigger as $$
begin
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
