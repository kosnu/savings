create or replace function update_category_budget_updated_at()
returns trigger as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists trg_update_category_budget_updated_at on category_budgets;

create trigger trg_update_category_budget_updated_at
  before update on category_budgets
  for each row
  execute function update_category_budget_updated_at();

create or replace function update_category_with_budget(
  p_category_id bigint,
  p_category_name text,
  p_category_budget_id bigint,
  p_budget_amount integer
)
returns void as $$
declare
  updated_category_count integer;
  updated_category_budget_count integer;
begin
  update categories
  set name = p_category_name
  where categories.id = p_category_id;

  get diagnostics updated_category_count = row_count;

  if updated_category_count <> 1 then
    raise exception 'Category was not updated.'
      using errcode = 'P0002';
  end if;

  update category_budgets
  set amount = p_budget_amount
  where category_budgets.id = p_category_budget_id
    and category_budgets.category_id = p_category_id
    and exists (
      select 1
      from categories
      where categories.id = p_category_id
        and categories.book_id = category_budgets.book_id
    );

  get diagnostics updated_category_budget_count = row_count;

  if updated_category_budget_count <> 1 then
    raise exception 'Category budget was not updated.'
      using errcode = 'P0002';
  end if;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.update_category_with_budget(bigint, text, bigint, integer) from public;
revoke all on function public.update_category_with_budget(bigint, text, bigint, integer) from anon;
grant execute on function public.update_category_with_budget(bigint, text, bigint, integer) to authenticated;
grant execute on function public.update_category_with_budget(bigint, text, bigint, integer) to service_role;
